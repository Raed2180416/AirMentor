"""forge-audit CLI — beautiful terminal interface for deep codebase auditing.

Usage:
    forge-audit audit /path/to/project          # Full audit
    forge-audit audit . --tui                    # Interactive TUI mode
    forge-audit query "authentication"           # Search the audit DB
    forge-audit blast-radius src/auth/service.ts # Impact analysis
    forge-audit status                           # Show last audit summary
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import (
    Progress, SpinnerColumn, BarColumn, TextColumn,
    TimeElapsedColumn, TimeRemainingColumn,
)
from rich.syntax import Syntax
from rich.tree import Tree
from rich import box
from rich.layout import Layout
from rich.live import Live
from rich.columns import Columns

from .engine import (
    scan_directory, parse_file, build_graph,
    compute_file_metrics, compute_project_metrics,
)
from .storage import (
    create_store, close_store,
    insert_scan_result, insert_parsed_file, insert_graph,
    insert_metrics, finalize_run,
    query_riskiest_files, query_callers_of, query_blast_radius, query_search,
)
from .storage.shadow import write_shadow_file, write_index_json
from .engine.agent import (
    build_analysis_input, save_analysis_result,
    get_files_for_deep_analysis,
)

app = typer.Typer(
    name="forge-audit",
    help="Deep codebase audit tool — deterministic analysis + optional LLM augmentation",
    add_completion=False,
)
console = Console()


# ── Main audit command ───────────────────────────────────────────────────

@app.command()
def audit(
    target: str = typer.Argument(".", help="Directory to audit"),
    output: str = typer.Option(".audit", help="Output directory for shadow files"),
    db: str = typer.Option(".audit/audit.db", help="SQLite database path"),
    ignore: Optional[list[str]] = typer.Option(None, "--ignore", "-i", help="Extra patterns to ignore"),
    max_file_mb: float = typer.Option(50.0, help="Skip files larger than this (MB)"),
    tui: bool = typer.Option(False, "--tui", help="Launch interactive TUI after audit"),
    agent: bool = typer.Option(False, "--agent", help="Generate deep analysis prompts for AI agent review"),
    agent_max: int = typer.Option(30, "--agent-max", help="Max files for agent deep analysis"),
    json_output: bool = typer.Option(False, "--json", help="Output summary as JSON"),
) -> None:
    """Run a complete deterministic audit of a directory.

    This performs a single-pass analysis extracting:
    - File inventory with language detection
    - AST parsing via Tree-sitter (functions, classes, imports, calls)
    - Call graph and dependency graph construction
    - Complexity, maintainability, risk, and trust scoring
    - .audit/ shadow JSON files for every source file
    - SQLite knowledge graph for querying
    """
    root = Path(target).resolve()
    if not root.exists():
        console.print(f"[red]Error:[/red] Directory not found: {root}")
        raise typer.Exit(1)

    output_dir = root / output
    db_path = root / db

    console.print()
    console.print(Panel.fit(
        f"[bold cyan]forge-audit[/bold cyan] v1.0.0\n"
        f"Target: [bold]{root}[/bold]\n"
        f"Output: [dim]{output_dir}[/dim]",
        border_style="cyan",
    ))

    # ── Phase 1: Scan ────────────────────────────────────────────────
    console.print("\n[bold]Phase 1/4:[/bold] Repository Census")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task("Scanning directory tree...", total=None)
        scan = scan_directory(root, extra_ignore=ignore, max_file_size_mb=max_file_mb)

    _print_scan_summary(scan)

    # ── Phase 2: Parse ───────────────────────────────────────────────
    console.print("\n[bold]Phase 2/4:[/bold] AST Parsing & Graph Construction")

    parsed_files: dict[str, any] = {}
    source_files = [f for f in scan.files if f.category == "source" and not f.is_binary]

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
    ) as progress:
        task = progress.add_task("Parsing source files...", total=len(source_files))

        for fi in source_files:
            try:
                source = fi.path.read_text(encoding="utf-8", errors="replace")
                pf = parse_file(fi.path, fi.language, source)
                pf.path = fi.relative_path  # Normalize to relative path
                parsed_files[fi.relative_path] = pf
            except Exception:
                pass
            progress.advance(task)

    console.print(f"  ✓ Parsed [bold]{len(parsed_files)}[/bold] source files")

    # Build graph
    graph = build_graph(root, parsed_files, scan.files)

    resolved = sum(1 for e in graph.call_edges if e.is_resolved)
    unresolved = sum(1 for e in graph.call_edges if not e.is_resolved)
    external = sum(1 for e in graph.call_edges if e.is_external)
    console.print(f"  ✓ Call graph: [bold]{len(graph.call_edges)}[/bold] edges "
                  f"([green]{resolved} resolved[/green], "
                  f"[yellow]{unresolved} unresolved[/yellow], "
                  f"[dim]{external} external[/dim])")
    console.print(f"  ✓ Import graph: [bold]{len(graph.import_edges)}[/bold] edges")

    # ── Phase 3: Metrics ─────────────────────────────────────────────
    console.print("\n[bold]Phase 3/4:[/bold] Metrics & Risk Scoring")

    # Detect test file pairs
    test_pairs: set[str] = set()
    for f in scan.files:
        if f.is_test:
            # Try to find corresponding source file
            name = f.relative_path
            for pattern in [".test.", ".spec.", "_test.", "test_", "spec/"]:
                candidate = name.replace(pattern, ".").replace("/test/", "/").replace("__tests__/", "")
                test_pairs.add(candidate)

    file_metrics = []
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
    ) as progress:
        task = progress.add_task("Computing metrics...", total=len(parsed_files))

        for path, pf in parsed_files.items():
            is_test = any(f.is_test for f in scan.files if f.relative_path == path)
            has_tests = path in test_pairs
            fm = compute_file_metrics(pf, graph, is_test=is_test, has_tests=has_tests)
            file_metrics.append(fm)
            progress.advance(task)

    project_metrics = compute_project_metrics(file_metrics, graph)
    _print_metrics_summary(project_metrics)

    # ── Phase 4: Store & Generate ────────────────────────────────────
    console.print("\n[bold]Phase 4/4:[/bold] Storage & Shadow Files")

    store = create_store(db_path, str(root))
    insert_scan_result(store, scan)

    with Progress(transient=True) as progress:
        task = progress.add_task("Writing to database...", total=len(parsed_files) + 1)
        for pf in parsed_files.values():
            insert_parsed_file(store, pf)
            progress.advance(task)
        progress.advance(task)  # extra tick

    insert_graph(store, graph)
    insert_metrics(store, file_metrics)
    finalize_run(store, project_metrics)

    # Generate shadow files
    shadow_count = 0
    with Progress(transient=True) as progress:
        task = progress.add_task("Generating .audit shadow files...", total=len(parsed_files))
        for path, pf in parsed_files.items():
            fm = next((m for m in file_metrics if m.path == path), None)
            if fm:
                write_shadow_file(pf, fm, output_dir, graph)
                shadow_count += 1
            progress.advance(task)

    # Write index
    write_index_json(file_metrics, project_metrics, graph, output_dir)

    close_store(store)

    console.print(f"  ✓ [bold]{shadow_count}[/bold] shadow files → [dim]{output_dir}/[/dim]")
    console.print(f"  ✓ Knowledge graph → [dim]{db_path}[/dim]")

    # ── Optional Agent analysis ──────────────────────────────────────
    if agent:
        _run_agent_analysis(parsed_files, file_metrics, graph, output_dir, agent_max)

    # ── Final summary ────────────────────────────────────────────────
    elapsed = (time.monotonic() - __import__('time').monotonic()) * 1000
    console.print()
    console.print(Panel.fit(
        f"[bold green]Audit Complete[/bold green]\n"
        f"Files: {scan.total_files} | Lines: {scan.total_lines:,} | "
        f"Functions: {project_metrics.total_functions}\n"
        f"Shadow files: {shadow_count} | DB: {db_path.name}\n"
        f"Duration: {elapsed:.0f}ms",
        border_style="green",
    ))

    if json_output:
        console.print(json.dumps({
            "total_files": scan.total_files,
            "total_lines": scan.total_lines,
            "total_functions": project_metrics.total_functions,
            "avg_complexity": project_metrics.avg_complexity,
            "avg_maintainability": project_metrics.avg_maintainability,
            "risk_distribution": project_metrics.risk_distribution,
            "shadow_files": shadow_count,
        }, indent=2))

    if tui:
        _launch_tui(store)


# ── Query command ────────────────────────────────────────────────────────

@app.command()
def query(
    search_term: str = typer.Argument(..., help="Search term for full-text search"),
    db: str = typer.Option(".audit/audit.db", help="SQLite database path"),
    limit: int = typer.Option(20, help="Max results"),
) -> None:
    """Search the audit database for functions and files."""
    db_path = Path(db)
    if not db_path.exists():
        console.print(f"[red]No audit database found at {db_path}[/red]")
        console.print("Run [bold]forge-audit audit[/bold] first.")
        raise typer.Exit(1)

    from .storage.db import AuditStore
    import sqlite3

    conn = sqlite3.connect(str(db_path))
    # Get latest audit run
    run_id = conn.execute("SELECT MAX(id) FROM audit_runs WHERE status='complete'").fetchone()[0]
    if not run_id:
        console.print("[red]No completed audit runs found.[/red]")
        raise typer.Exit(1)

    store = AuditStore(db_path=db_path, conn=conn, audit_run_id=run_id)
    results = query_search(store, search_term, limit)

    if not results:
        console.print(f"[yellow]No results for '{search_term}'[/yellow]")
        return

    table = Table(title=f"Search: '{search_term}'", box=box.ROUNDED)
    table.add_column("Type", style="cyan")
    table.add_column("Name/Path", style="bold")
    table.add_column("File/Language")
    table.add_column("Relevance", justify="right")

    for r in results:
        if r["type"] == "function":
            table.add_row("Function", r["name"], r["file"], f"{r['rank']:.2f}")
        else:
            table.add_row("File", r["path"], r.get("language", ""), f"{r['rank']:.2f}")

    console.print(table)
    conn.close()


# ── Blast radius command ─────────────────────────────────────────────────

@app.command()
def blast_radius(
    file_path: str = typer.Argument(..., help="File to analyze impact for"),
    db: str = typer.Option(".audit/audit.db", help="SQLite database path"),
    max_depth: int = typer.Option(5, help="Maximum dependency depth"),
) -> None:
    """Show which files would be affected by changing a given file."""
    db_path = Path(db)
    if not db_path.exists():
        console.print(f"[red]No audit database found at {db_path}[/red]")
        raise typer.Exit(1)

    from .storage.db import AuditStore
    import sqlite3

    conn = sqlite3.connect(str(db_path))
    run_id = conn.execute("SELECT MAX(id) FROM audit_runs WHERE status='complete'").fetchone()[0]
    store = AuditStore(db_path=db_path, conn=conn, audit_run_id=run_id)

    result = query_blast_radius(store, file_path, max_depth)

    if not result:
        console.print(f"[green]No files depend on '{file_path}'[/green] (within depth {max_depth})")
        return

    total_affected = sum(len(v) for v in result.values())
    console.print(f"\n[bold]Blast Radius:[/bold] [cyan]{file_path}[/cyan]")
    console.print(f"Affected files: [bold red]{total_affected}[/bold red] within depth {max_depth}\n")

    tree = Tree(f"[bold]{file_path}[/bold] (changed file)")
    for depth_str in sorted(result.keys(), key=int):
        depth = int(depth_str)
        depth_node = tree.add(f"[yellow]Depth {depth}[/yellow] ({len(result[depth_str])} files)")
        for f in result[depth_str][:10]:
            depth_node.add(f"[dim]{f}[/dim]")
        if len(result[depth_str]) > 10:
            depth_node.add(f"[dim]... and {len(result[depth_str]) - 10} more[/dim]")

    console.print(tree)
    conn.close()


# ── Status command ────────────────────────────────────────────────────────

@app.command()
def status(
    db: str = typer.Option(".audit/audit.db", help="SQLite database path"),
) -> None:
    """Show the most recent audit summary."""
    db_path = Path(db)
    if not db_path.exists():
        console.print("[yellow]No audit has been run yet.[/yellow]")
        console.print("Run [bold]forge-audit audit <directory>[/bold] to start.")
        return

    import sqlite3
    conn = sqlite3.connect(str(db_path))
    row = conn.execute(
        "SELECT root_path, started_at, finished_at, total_files, total_lines, "
        "total_functions, summary_json FROM audit_runs WHERE status='complete' "
        "ORDER BY id DESC LIMIT 1"
    ).fetchone()

    if not row:
        console.print("[yellow]No completed audits found.[/yellow]")
        return

    summary = json.loads(row[6]) if row[6] else {}

    console.print()
    console.print(Panel.fit(
        f"[bold cyan]Last Audit[/bold cyan]\n"
        f"Project: [bold]{row[0]}[/bold]\n"
        f"Files: {row[3]} | Lines: {row[4]:,} | Functions: {row[5]}\n"
        f"Avg Complexity: {summary.get('avg_complexity', 'N/A')} | "
        f"Avg Maintainability: {summary.get('avg_maintainability', 'N/A')}\n"
        f"Cycles: {summary.get('cycle_count', 0)} | "
        f"Dead code: {summary.get('dead_code_count', 0)}",
        border_style="cyan",
    ))

    # Risk distribution
    risk = summary.get("risk_distribution", {})
    if risk:
        risk_table = Table(box=box.SIMPLE)
        risk_table.add_column("Risk Level")
        risk_table.add_column("Files", justify="right")
        colors = {"low": "green", "medium": "yellow", "high": "red", "critical": "bold red"}
        for level, count in risk.items():
            risk_table.add_row(f"[{colors.get(level, 'white')}]{level}[/]", str(count))
        console.print(risk_table)

    # Riskiest files
    from .storage.db import AuditStore
    run_id = conn.execute("SELECT MAX(id) FROM audit_runs WHERE status='complete'").fetchone()[0]
    store = AuditStore(db_path=db_path, conn=conn, audit_run_id=run_id)
    risky = query_riskiest_files(store, 10)

    if risky:
        console.print("\n[bold]Top Risk Files:[/bold]")
        risk_table = Table(box=box.SIMPLE)
        risk_table.add_column("File")
        risk_table.add_column("Risk", justify="right")
        risk_table.add_column("Trust", justify="right")
        risk_table.add_column("Lines", justify="right")
        for r in risky:
            risk_table.add_row(
                r["path"], f"[red]{r['risk_score']}[/red]",
                f"[green]{r['trust_score']}[/green]", str(r["total_lines"]),
            )
        console.print(risk_table)

    conn.close()


# ── Helpers ──────────────────────────────────────────────────────────────

def _print_scan_summary(scan) -> None:
    """Print a beautiful scan summary."""
    # Language breakdown
    lang_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 2))
    lang_table.add_column(style="bold")
    lang_table.add_column(justify="right")

    top_langs = list(scan.language_counts.items())[:10]
    for lang, count in top_langs:
        lang_table.add_row(lang, str(count))

    if len(scan.language_counts) > 10:
        lang_table.add_row(
            f"[dim]+{len(scan.language_counts) - 10} more[/dim]", ""
        )

    # Category breakdown
    cat_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 2))
    cat_table.add_column(style="bold")
    cat_table.add_column(justify="right")
    for cat, count in scan.category_counts.items():
        cat_table.add_row(cat, str(count))

    grid = Table(box=box.SIMPLE, show_header=False, padding=(0, 4))
    grid.add_column()
    grid.add_column()
    grid.add_row(lang_table, cat_table)

    console.print(Panel(grid, title="Repository Census", border_style="blue"))
    console.print(
        f"  Files: [bold]{scan.total_files}[/bold] | "
        f"Lines: [bold]{scan.total_lines:,}[/bold] | "
        f"Size: [bold]{_format_size(scan.total_size_bytes)}[/bold] | "
        f"Entrypoints: [bold]{len(scan.entrypoints)}[/bold]"
    )


def _print_metrics_summary(pm) -> None:
    """Print metrics summary."""
    risk = pm.risk_distribution
    trust = pm.trust_distribution

    metrics_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 2))
    metrics_table.add_column(style="bold")
    metrics_table.add_column(justify="right")
    metrics_table.add_row("Avg Complexity", f"{pm.avg_complexity}")
    metrics_table.add_row("Avg Maintainability", f"{pm.avg_maintainability}/100")
    metrics_table.add_row("Cycles Detected", f"[{'red' if pm.cycle_count else 'green'}]{pm.cycle_count}[/]")
    metrics_table.add_row("Dead Code", f"[yellow]{pm.dead_code_count}[/] functions")
    metrics_table.add_row("Est. Test Coverage", f"{pm.test_coverage_estimate:.0f}%")

    risk_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 2))
    risk_table.add_column(style="bold")
    risk_table.add_column(justify="right")
    colors = {"low": "green", "medium": "yellow", "high": "red", "critical": "bold red"}
    for level in ("critical", "high", "medium", "low"):
        if level in risk:
            risk_table.add_row(
                f"[{colors[level]}]{level}[/]", str(risk[level])
            )

    grid = Table(box=box.SIMPLE, show_header=False, padding=(0, 4))
    grid.add_column()
    grid.add_column()
    grid.add_row(metrics_table, risk_table)

    console.print(Panel(grid, title="Project Metrics", border_style="magenta"))


def _run_agent_analysis(parsed_files, file_metrics, graph, output_dir, max_files) -> None:
    """Generate deep analysis prompts for AI agent review.

    This produces self-contained prompt files that an AI agent (like Cascade)
    can process one at a time. Each prompt has everything needed for thorough
    analysis — the agent never needs cross-file context.
    """
    candidates = get_files_for_deep_analysis(file_metrics, parsed_files, max_files)

    if not candidates:
        console.print("\n[yellow]No files met the threshold for deep agent analysis.[/yellow]")
        return

    console.print(f"\n[bold cyan]Agent Deep Analysis:[/bold cyan] {len(candidates)} high-significance files selected")

    prompts_dir = output_dir / "_agent_prompts"
    prompts_dir.mkdir(parents=True, exist_ok=True)

    for i, (file_path, score) in enumerate(candidates):
        pf = parsed_files.get(file_path)
        fm = next((m for m in file_metrics if m.path == file_path), None)
        if not pf or not fm:
            continue

        source = "\n".join(pf.lines)

        from .storage.shadow import generate_shadow_json
        structural = generate_shadow_json(pf, fm, graph)

        prompt = build_analysis_input(file_path, source, pf.language, structural)

        # Save prompt for agent to process
        prompt_path = prompts_dir / f"{i+1:03d}_{file_path.replace('/', '_')}.prompt.md"
        prompt_path.write_text(prompt)

        console.print(
            f"  [{i+1}/{len(candidates)}] [bold]{file_path}[/bold] "
            f"(risk={fm.risk_score}, score={score:.1f}) → [dim]{prompt_path.name}[/dim]"
        )

    console.print(f"\n  [green]✓[/green] {len(candidates)} agent prompts → [dim]{prompts_dir}/[/dim]")
    console.print("  [dim]Feed each .prompt.md to an AI agent and save results back with --agent-merge[/dim]")


def _launch_tui(store) -> None:
    """Launch the Textual TUI for interactive exploration."""
    try:
        from .ui.tui import AuditTUI
        from textual.app import App
        # This would launch a full Textual app
        console.print("\n[dim]TUI mode not yet implemented. Use query/status commands.[/dim]")
    except ImportError:
        console.print("\n[dim]Textual not available for TUI mode.[/dim]")


def _format_size(bytes_val: int) -> str:
    """Format bytes to human-readable size."""
    for unit in ("B", "KB", "MB", "GB"):
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"


def main() -> None:
    app()


if __name__ == "__main__":
    main()
