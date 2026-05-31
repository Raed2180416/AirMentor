"""Agent-in-the-loop deep analysis engine.

Architecture to prevent context loss:
1. ONE file per invocation — self-contained, no cross-file state
2. Every claim cites a line number — no floating assertions
3. Every category addressed — "NOT APPLICABLE" is explicit
4. Uncertainty flagged — agent admits what it doesn't know
5. Results saved to disk immediately — context loss is harmless
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

# ── The Deep Analysis Prompt ─────────────────────────────────────────────
# Designed to prevent: vagueness, skipping, hallucination, context drift, overconfidence

DEEP_ANALYSIS_PROMPT = """You are performing a DEEP CODE AUDIT as a senior systems architect with security expertise.

## CRITICAL RULES
1. EVERY claim MUST cite a specific line number. No floating assertions.
2. If UNSURE, flag it: "SPECULATIVE" vs "CONFIRMED".
3. Do NOT suggest style changes. Only substantive issues.
4. Read the ENTIRE source. Functions at the bottom matter as much as the top.
5. If code is AI-generated, identify telltale patterns.

## REQUIRED JSON OUTPUT

{
  "architectural_analysis": {
    "primary_role": "What this file ACTUALLY does",
    "layer": "presentation|business-logic|data-access|infrastructure|utility|unknown",
    "coupling": "tight|moderate|loose",
    "cohesion": "high|medium|low — one responsibility or many?"
  },
  "function_analysis": [
    {
      "name": "function name",
      "lines": "start-end",
      "actual_purpose": "What it really does",
      "side_effects": ["observable side effects with line numbers"],
      "error_handling": "adequate|missing|over-engineered|not-applicable",
      "input_validation": "thorough|partial|none|not-applicable",
      "concurrency_risk": "NONE or description with line",
      "security_concern": "NONE or description with line",
      "ai_patterns": ["signs of AI generation"],
      "improvements": ["actionable suggestions with line refs"]
    }
  ],
  "data_flow": {
    "state_managed": ["persistent state variables with lines"],
    "transformations": ["key data transforms with line ranges"],
    "external_calls": ["external APIs/services called with lines"],
    "validation_gaps": ["unvalidated data entry points with lines"]
  },
  "error_handling": {
    "quality": "robust|adequate|fragile|missing",
    "swallowed_errors": ["lines where errors caught but not handled"],
    "missing_error_paths": ["operations that can fail but aren't wrapped, with lines"]
  },
  "security": {
    "risk_level": "low|medium|high|critical",
    "vulnerabilities": [
      {
        "type": "injection|xss|authz-bypass|data-exposure|misconfiguration|other",
        "line": 0,
        "description": "specific issue",
        "severity": "low|medium|high|critical",
        "confidence": "CONFIRMED|SPECULATIVE"
      }
    ],
    "authz_gaps": ["missing authorization checks with lines"],
    "secret_handling": "secure|exposed|not-applicable"
  },
  "code_quality": {
    "dead_code_suspected": ["lines/functions that appear unused"],
    "magic_values": ["unexplained constants with lines and suggested names"],
    "god_functions": ["functions doing too much, with lines"],
    "testability": "easy|moderate|hard — how testable is this code?"
  },
  "architecture_issues": {
    "circular_dependency_risk": "NONE or description",
    "abstraction_leaks": ["where implementation details leak through API, with lines"],
    "srp_violations": ["where file/class does multiple unrelated things, with lines"]
  },
  "summary": {
    "overall_trust": "high|medium|low — would you deploy this to production?",
    "critical_issues": ["issues that MUST be fixed"],
    "uncertain_areas": ["things you're unsure about — be honest"],
    "best_line": "the single best-written line number",
    "worst_line": "the most problematic line number"
  }
}

## DETERMINISTIC DATA (already extracted)

{structural_data}

## SOURCE CODE

```{language}
{source}
```

Analyze NOW. Be thorough. Be specific. Be honest about uncertainty."""


def build_analysis_input(
    file_path: str,
    source: str,
    language: str,
    structural_data: dict,
) -> str:
    """Build the complete analysis prompt for a single file.

    Args:
        file_path: Relative path to the file
        source: Full source code
        language: Programming language
        structural_data: Deterministic data from parser/graph/metrics

    Returns:
        Complete prompt string ready for the agent
    """
    # Build a concise structural summary
    structural_summary = {
        "file": file_path,
        "language": language,
        "lines": structural_data.get("metrics", {}).get("total_lines", 0),
        "functions": [
            {
                "name": f["name"],
                "lines": f"{f['start_line']}-{f['end_line']}",
                "params": f.get("params", []),
                "complexity": f.get("complexity", 0),
                "calls": f.get("calls", [])[:15],
                "exported": f.get("is_exported", False),
            }
            for f in structural_data.get("functions", [])
        ],
        "classes": [
            {
                "name": c["name"],
                "lines": f"{c['start_line']}-{c['end_line']}",
                "bases": c.get("base_classes", []),
            }
            for c in structural_data.get("classes", [])
        ],
        "imports": [
            {"module": i["module"], "names": i.get("names", [])}
            for i in structural_data.get("imports", [])
        ][:30],
        "exports": structural_data.get("exports", []),
        "risk_score": structural_data.get("risk_score", 0),
        "trust_score": structural_data.get("trust_score", 0),
        "parse_errors": structural_data.get("issues", []),
    }

    return DEEP_ANALYSIS_PROMPT.replace(
        "{structural_data}", json.dumps(structural_summary, indent=2)
    ).replace(
        "{language}", language
    ).replace(
        "{source}", source
    )


def save_analysis_result(
    output_dir: Path,
    file_path: str,
    analysis: dict,
) -> Path:
    """Save agent analysis to the shadow file immediately.

    This is the key to preventing context loss — results are persisted
    before the agent moves to the next file.
    """
    shadow_path = output_dir / (file_path + ".json")
    shadow_path.parent.mkdir(parents=True, exist_ok=True)

    # Read existing shadow data if present
    existing = {}
    if shadow_path.exists():
        try:
            existing = json.loads(shadow_path.read_text())
        except Exception:
            pass

    # Merge agent analysis
    existing["agent_deep_analysis"] = analysis

    shadow_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
    return shadow_path


def get_files_for_deep_analysis(
    file_metrics: list,
    parsed_files: dict,
    max_files: int = 30,
) -> list[tuple[str, float]]:
    """Select which files deserve deep agent analysis.

    Priority: high risk > large files > entrypoints > parse errors.
    Returns list of (file_path, priority_score).
    """
    candidates = []
    for fm in file_metrics:
        pf = parsed_files.get(fm.path)
        if not pf:
            continue

        score = 0.0
        if fm.risk_score > 6:
            score += fm.risk_score * 2
        if fm.risk_score > 3:
            score += fm.risk_score
        if fm.total_lines > 500:
            score += 3
        if fm.total_lines > 200:
            score += 1
        if fm.cyclomatic_complexity > 50:
            score += 3
        if fm.cyclomatic_complexity > 20:
            score += 1
        if pf.parse_errors:
            score += 5
        if fm.entropy_contribution > 0.3:
            score += 2
        if fm.fan_in > 10:
            score += 2  # Heavily depended upon

        if score > 0:
            candidates.append((fm.path, score))

    candidates.sort(key=lambda x: -x[1])
    return candidates[:max_files]
