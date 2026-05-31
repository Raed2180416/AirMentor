"""Optional LLM-powered deep analysis for key files.

Uses OpenAI-compatible API to generate semantic understanding of code.
Only invoked for high-risk or architecturally significant files.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional


def is_llm_available() -> bool:
    """Check if LLM integration is configured."""
    return bool(os.environ.get("OPENAI_API_KEY"))


def analyze_file_semantics(
    file_path: str,
    source: str,
    language: str,
    structural_data: dict,
    model: str = "gpt-4o",
) -> dict | None:
    """Use LLM to generate semantic understanding of a file.

    Only called for files that meet significance criteria:
    - High risk score (>6)
    - Large files (>500 lines)
    - Entrypoints
    - Files with parse errors

    Args:
        file_path: Relative path to the file
        source: Full source code
        language: Programming language
        structural_data: Deterministic data from parser/graph/metrics
        model: OpenAI model to use

    Returns:
        Dict with semantic analysis or None if unavailable
    """
    if not is_llm_available():
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    prompt = _build_analysis_prompt(file_path, source, language, structural_data)

    try:
        client = OpenAI()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior software architect performing a deep code audit. "
                               "Analyze the provided file and return a JSON response with your findings. "
                               "Be precise, cite specific line numbers, and identify real issues — "
                               "not style preferences. Focus on: architectural role, business logic, "
                               "hidden assumptions, concurrency issues, security concerns, dead code, "
                               "and AI-generated code patterns.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=4096,
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception:
        return None


def _build_analysis_prompt(
    file_path: str, source: str, language: str, structural: dict,
) -> str:
    """Build a focused analysis prompt combining deterministic data with source."""
    # Truncate source if too large
    max_source_chars = 30000
    if len(source) > max_source_chars:
        source = source[:max_source_chars] + "\n\n... [FILE TRUNCATED — too large for full LLM analysis]"

    func_summaries = json.dumps([
        {
            "name": f["name"],
            "lines": f"{f['start_line']}-{f['end_line']}",
            "complexity": f["complexity"],
            "calls": f["calls"][:10],
        }
        for f in structural.get("functions", [])[:20]
    ], indent=2)

    return f"""Analyze this file and return a JSON object with these fields:

{{
  "architectural_role": "Brief description of this file's role in the system",
  "purpose_summary": "2-3 sentence summary of what this file does",
  "business_logic": ["List of business rules or product logic implemented"],
  "hidden_assumptions": ["Assumptions the code makes that aren't validated"],
  "concurrency_concerns": ["Any race conditions, deadlock risks, or thread safety issues"],
  "security_concerns": ["Security vulnerabilities or risky patterns"],
  "ai_patterns": ["Signs this code was AI-generated (boilerplate, redundant checks, etc.)"],
  "improvement_suggestions": ["Specific, actionable improvements"],
  "dead_code_suspected": ["Lines or functions that appear unused"],
  "magic_numbers": ["Unexplained constants that should be named"],
  "error_handling_quality": "good|adequate|poor",
  "overall_confidence": "high|medium|low — how confident are you in this analysis?"
}}

File: {file_path}
Language: {language}

Deterministic analysis already performed:
- Risk score: {structural.get('risk_score', 'N/A')}/10
- Trust score: {structural.get('trust_score', 'N/A')}/10
- Complexity: {structural.get('metrics', {}).get('cyclomatic_complexity', 'N/A')}
- Maintainability: {structural.get('metrics', {}).get('maintainability_index', 'N/A')}
- Functions: {len(structural.get('functions', []))}
- Classes: {len(structural.get('classes', []))}
- Parse errors: {len(structural.get('issues', []))}

Function summaries:
{func_summaries}

Source code:
```{language}
{source}
```"""
