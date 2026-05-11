"""Shared constants + helpers for overnight DAG generator."""
from __future__ import annotations

import textwrap
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
AUTH_PROMPT = "audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md"
PROMPT_DIR = REPO / "audit-map" / "20-prompts" / "overnight"
MANIFEST_DIR = REPO / "pipeline" / "agents" / "manifests"
DAG_PATH = REPO / "pipeline" / "agents" / "overnight-dag.yaml"

PROMPT_DIR.mkdir(parents=True, exist_ok=True)
MANIFEST_DIR.mkdir(parents=True, exist_ok=True)

WENYAN_HEADER = textwrap.dedent("""\
    ## CAVEMAN WENYAN-ULTRA MODE — HARD-ENFORCED, NEVER REVERT

    `CAVEMAN_ENFORCED=1 CAVEMAN_MODE=wenyan-ultra` active. All prose
    (docs, briefings, commit bodies, result notes, visible reasoning)
    must be wenyan-ultra caveman: max compression, classical particles
    OK (之乃為其), drop articles/filler, abbreviate (DB/auth/config/
    req/res/fn/impl), arrows for causality (X → Y). Stay in-mode.

    Normal English ONLY for: source code, tests, fixtures, schema SQL,
    commit subject line, user-facing error strings, the structured
    `<<AIRMENTOR_PASS_RESULT>>` JSON marker. Nothing else.

    ## AUTHORITATIVE PROMPT

    Single source of truth:
    `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md`
    Read sections A..Q before acting. Authoritative prompt > per-node.

    ## FROZEN APPENDIX (do not reopen)

    `audit-map/14-reconciliation/final-decision-appendix.md`

    ## UI/UX PRESERVATION

    No UI/UX flow changes. Architectural/data-wiring edits only for
    `src/**/*.tsx`. If uncertain, stop and surface in `notes`.

    ## PARALLELISM SAFETY

    Write only files matched by `write_scope_glob`. Never touch
    `.windsurf/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, migrations
    (unless scope explicitly allows).
""")


def emit_intent(node_id: str, purpose: str, nonneg: list[str],
                owner_files: list[str]) -> None:
    body = "purpose: |\n"
    for line in purpose.strip().splitlines():
        body += f"  {line}\n"
    body += "nonneg:\n"
    for n in nonneg:
        body += f"  - {n}\n"
    body += "owner_files:\n"
    for f in owner_files:
        body += f"  - {f}\n"
    (MANIFEST_DIR / f"{node_id}.intent.yaml").write_text(body, encoding="utf-8")


def emit_artifacts(node_id: str, artifacts: list[dict]) -> None:
    body = "artifacts:\n"
    for a in artifacts:
        body += f"  - path: {a['path']}\n"
        body += f"    min_lines: {a.get('min_lines', 30)}\n"
        body += f"    min_bytes: {a.get('min_bytes', 1200)}\n"
        body += f"    write_mode: {a.get('write_mode', 'replace')}\n"
        secs = a.get("required_sections") or []
        if secs:
            body += "    required_sections:\n"
            for s in secs:
                body += f"      - {s!r}\n"
    (MANIFEST_DIR / f"{node_id}.artifacts.yaml").write_text(body, encoding="utf-8")


def emit_prompt(node_id: str, title: str, purpose_short: str,
                read_first: list[str], scope_body: str,
                validation_gate: str = "") -> None:
    parts = [f"# {title}", "", WENYAN_HEADER, "", "## PURPOSE", "",
             purpose_short.strip(), "", "## READ FIRST"]
    for r in read_first:
        parts.append(f"- {r}")
    parts.append("")
    parts.append(scope_body.strip())
    if validation_gate:
        parts += ["", "## VALIDATION GATE", "", validation_gate.strip()]
    parts += ["", "## OUTPUT CONTRACT",
              "", "Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.",
              "All artifacts declared in the manifest must exist with real content.",
              "`intent_affirmed=true` only if product intent preserved.",
              ""]
    (PROMPT_DIR / f"{node_id}.md").write_text("\n".join(parts), encoding="utf-8")


def emit_dag(nodes: list[dict]) -> None:
    out = [
        "# AirMentor Overnight Principal-Architect DAG",
        "# Authoritative prompt: audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md",
        "# Generated — do not edit by hand, edit build_overnight/*.py + regenerate.",
        "",
        "defaults:",
        "  context: pipeline",
        "  idle_timeout_s: 1800",
        "  hard_timeout_s: 14400",
        "  max_attempts: 4",
        "",
        "nodes:",
    ]
    for n in nodes:
        out.append(f"  - id: {n['id']}")
        out.append(f"    pass: {n['id']}")
        out.append(f"    task_class: {n['task_class']}")
        out.append(f"    risk_class: {n['risk_class']}")
        out.append(f"    reasoning_effort: {n['reasoning_effort']}")
        out.append(f"    prompt_file: audit-map/20-prompts/overnight/{n['id']}.md")
        out.append(f"    intent_file: pipeline/agents/manifests/{n['id']}.intent.yaml")
        out.append(f"    manifest_file: pipeline/agents/manifests/{n['id']}.artifacts.yaml")
        out.append(f"    write_scope_glob: {n['write_scope_glob']!r}")
        if n.get("parallel_group"):
            out.append(f"    parallel_group: {n['parallel_group']}")
        else:
            out.append("    parallel_group: ~")
        if n.get("depends_on"):
            deps = ", ".join(n["depends_on"])
            out.append(f"    depends_on: [{deps}]")
        out.append(f"    priority: {n.get('priority', 50)}")
        if n.get("idle_timeout_s"):
            out.append(f"    idle_timeout_s: {n['idle_timeout_s']}")
        if n.get("hard_timeout_s"):
            out.append(f"    hard_timeout_s: {n['hard_timeout_s']}")
        out.append("")
    DAG_PATH.write_text("\n".join(out), encoding="utf-8")
