""".audit/ shadow JSON file generator.

Produces a JSON twin for each source file containing:
- Structural metadata (functions, classes, imports, exports)
- Line-level annotations
- Risk and trust scores
- Call and dependency graphs
- Detected issues
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from ..engine.parser import ParsedFile
from ..engine.graph import CodeGraph
from ..engine.metrics import FileMetrics


def generate_shadow_json(
    pf: ParsedFile,
    metrics: FileMetrics,
    graph: CodeGraph | None = None,
) -> dict:
    """Generate the .audit shadow JSON for a single file.

    This is the primary output artifact — a complete structured
    representation of everything known about a file.

    Args:
        pf: ParsedFile from the parser
        metrics: Computed FileMetrics
        graph: Optional CodeGraph for cross-references

    Returns:
        Dict ready for JSON serialization
    """
    # Inbound and outbound references from graph
    inbound_files: list[str] = []
    outbound_files: list[str] = []
    inbound_calls: list[dict] = []
    outbound_calls: list[dict] = []

    if graph:
        for edge in graph.import_edges:
            if edge.resolved_file == pf.path:
                inbound_files.append(edge.importer_file)
            if edge.importer_file == pf.path and edge.resolved_file:
                outbound_files.append(edge.resolved_file)

        for edge in graph.call_edges:
            if edge.callee_file == pf.path:
                inbound_calls.append({
                    "caller_file": edge.caller_file,
                    "caller_func": edge.caller_func,
                    "callee_func": edge.callee_func or edge.callee_name,
                })
            if edge.caller_file == pf.path:
                outbound_calls.append({
                    "callee_name": edge.callee_name,
                    "callee_file": edge.callee_file,
                    "callee_func": edge.callee_func,
                    "resolved": edge.is_resolved,
                    "external": edge.is_external,
                })

    # Build function summaries
    functions = []
    for func in pf.functions:
        functions.append({
            "name": func.name,
            "start_line": func.start_line,
            "end_line": func.end_line,
            "params": func.params,
            "return_type": func.return_type,
            "is_async": func.is_async,
            "is_exported": func.is_exported,
            "decorators": func.decorators,
            "calls": func.calls,
            "complexity": func.complexity,
            "length_lines": func.end_line - func.start_line + 1,
        })

    # Build class summaries
    classes = []
    for cls in pf.classes:
        classes.append({
            "name": cls.name,
            "start_line": cls.start_line,
            "end_line": cls.end_line,
            "base_classes": cls.base_classes,
            "is_exported": cls.is_exported,
            "method_count": len(cls.methods),
            "methods": [
                {
                    "name": m.name,
                    "start_line": m.start_line,
                    "complexity": m.complexity,
                }
                for m in cls.methods
            ],
        })

    # Line-level annotations (critical lines only)
    line_annotations = _generate_line_annotations(pf)

    # Issues
    issues = []
    if pf.parse_errors:
        for err in pf.parse_errors:
            issues.append({
                "type": "parse_error",
                "severity": "high",
                "description": err,
            })

    # Dead code detection
    if graph:
        from ..engine.graph import find_dead_code
        dead = find_dead_code(graph)
        for entry in dead:
            if entry.startswith(pf.path + ":"):
                func_name = entry.split(":")[-1]
                issues.append({
                    "type": "dead_code",
                    "severity": "medium",
                    "function_name": func_name,
                    "description": f"Function '{func_name}' is never called internally",
                })

    return {
        "file_path": pf.path,
        "language": pf.language,
        "architectural_role": _infer_role(pf),
        "subsystem": _infer_subsystem(pf.path),
        "inbound_usages": sorted(set(inbound_files)),
        "outbound_dependencies": sorted(set(outbound_files)),
        "inbound_calls": inbound_calls,
        "outbound_calls": outbound_calls,
        "functions": functions,
        "classes": classes,
        "imports": [
            {"module": imp.module, "names": imp.names, "line": imp.line}
            for imp in pf.imports
        ],
        "exports": pf.exports,
        "line_annotations": line_annotations,
        "issues": issues,
        "metrics": {
            "total_lines": metrics.total_lines,
            "code_lines": metrics.code_lines,
            "comment_lines": metrics.comment_lines,
            "blank_lines": metrics.blank_lines,
            "function_count": metrics.function_count,
            "class_count": metrics.class_count,
            "cyclomatic_complexity": metrics.cyclomatic_complexity,
            "maintainability_index": metrics.maintainability_index,
            "fan_in": metrics.fan_in,
            "fan_out": metrics.fan_out,
            "coupling_score": metrics.coupling_score,
        },
        "trust_score": metrics.trust_score,
        "risk_score": metrics.risk_score,
        "entropy_contribution": metrics.entropy_contribution,
        "has_tests": metrics.has_tests,
        "is_test": metrics.is_test,
    }


def write_shadow_file(
    pf: ParsedFile,
    metrics: FileMetrics,
    output_dir: Path,
    graph: CodeGraph | None = None,
) -> Path:
    """Write a .audit shadow JSON file for a source file.

    The shadow file is placed at .audit/<relative_path>.json,
    mirroring the source tree structure.

    Args:
        pf: ParsedFile
        metrics: FileMetrics
        output_dir: Root directory for .audit output
        graph: Optional CodeGraph

    Returns:
        Path to the written shadow file
    """
    shadow_data = generate_shadow_json(pf, metrics, graph)

    # Mirror directory structure
    shadow_path = output_dir / (pf.path + ".json")
    shadow_path.parent.mkdir(parents=True, exist_ok=True)

    with open(shadow_path, "w", encoding="utf-8") as f:
        json.dump(shadow_data, f, indent=2, ensure_ascii=False)

    return shadow_path


def write_index_json(
    all_metrics: list[FileMetrics],
    project_metrics,
    graph: CodeGraph | None,
    output_dir: Path,
) -> Path:
    """Write the top-level .audit/index.json with project overview.

    Args:
        all_metrics: All file metrics
        project_metrics: Aggregate project metrics
        graph: Optional CodeGraph
        output_dir: Root directory for .audit output

    Returns:
        Path to the written index file
    """
    index = {
        "project_root": str(output_dir.parent),
        "audit_timestamp": None,  # Filled by caller
        "summary": {
            "total_files": project_metrics.total_files,
            "total_lines": project_metrics.total_lines,
            "total_functions": project_metrics.total_functions,
            "total_classes": project_metrics.total_classes,
            "avg_complexity": project_metrics.avg_complexity,
            "avg_maintainability": project_metrics.avg_maintainability,
            "risk_distribution": project_metrics.risk_distribution,
            "trust_distribution": project_metrics.trust_distribution,
            "cycle_count": project_metrics.cycle_count,
            "dead_code_count": project_metrics.dead_code_count,
            "test_coverage_estimate": project_metrics.test_coverage_estimate,
        },
        "top_risk_files": [
            {
                "path": m.path,
                "risk_score": m.risk_score,
                "trust_score": m.trust_score,
                "complexity": m.cyclomatic_complexity,
                "lines": m.total_lines,
            }
            for m in sorted(all_metrics, key=lambda x: -x.risk_score)[:30]
        ],
        "entrypoints": [],
        "cycles": [],
    }

    if graph:
        from ..engine.graph import find_cycles
        index["cycles"] = find_cycles(graph)
        index["entrypoints"] = [
            pf.path for pf in graph.files.values()
            if any(f.name in ("main", "run", "start", "app") for f in pf.functions)
        ]

    output_dir.mkdir(parents=True, exist_ok=True)
    index_path = output_dir / "index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    return index_path


def _generate_line_annotations(pf: ParsedFile) -> list[dict]:
    """Generate annotations for significant lines in the file."""
    annotations = []

    for i, line in enumerate(pf.lines, 1):
        stripped = line.strip()

        # Import lines
        if stripped.startswith(("import ", "from ")) and pf.language == "python":
            annotations.append({
                "line": i,
                "code": stripped[:120],
                "intent": "Import external dependency",
                "risk": "none",
            })

        # Function definitions
        elif any(stripped.startswith(kw) for kw in ("def ", "async def ", "function ", "class ")):
            annotations.append({
                "line": i,
                "code": stripped[:120],
                "intent": f"Define {'function' if 'def ' in stripped or 'function ' in stripped else 'class'}",
                "risk": "none",
            })

        # Error handling
        elif any(kw in stripped for kw in ("raise ", "throw ", "Error(", "Exception(")):
            annotations.append({
                "line": i,
                "code": stripped[:120],
                "intent": "Error handling / exception flow",
                "risk": "medium",
            })

        # State mutation
        elif any(kw in stripped for kw in ("global ", "nonlocal ", "self.", "this.")):
            annotations.append({
                "line": i,
                "code": stripped[:120],
                "intent": "State mutation or access",
                "risk": "low",
            })

        # Async/await
        elif "await " in stripped or "async " in stripped:
            annotations.append({
                "line": i,
                "code": stripped[:120],
                "intent": "Asynchronous operation",
                "risk": "low",
            })

    return annotations


def _infer_role(pf: ParsedFile) -> str:
    """Infer the architectural role of a file from its contents and path."""
    path_lower = pf.path.lower()

    if "test" in path_lower or "spec" in path_lower:
        return "Test"
    if "route" in path_lower or "controller" in path_lower or "handler" in path_lower:
        return "API Route / Controller"
    if "service" in path_lower:
        return "Service Layer"
    if "model" in path_lower or "schema" in path_lower or "entity" in path_lower:
        return "Data Model"
    if "util" in path_lower or "helper" in path_lower:
        return "Utility"
    if "config" in path_lower or "setting" in path_lower:
        return "Configuration"
    if "middleware" in path_lower:
        return "Middleware"
    if "hook" in path_lower:
        return "React Hook"
    if "component" in path_lower or pf.language in ("typescript-react", "javascript-react"):
        return "UI Component"
    if "page" in path_lower:
        return "Page"
    if "script" in path_lower:
        return "Script"
    if "migration" in path_lower:
        return "Database Migration"
    if pf.language == "shell":
        return "Shell Script"

    return "Module"


def _infer_subsystem(path: str) -> str:
    """Infer the subsystem/domain from the file path."""
    parts = Path(path).parts
    if len(parts) > 1:
        return parts[0]
    return "root"
