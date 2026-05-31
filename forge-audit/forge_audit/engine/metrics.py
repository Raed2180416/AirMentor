"""Complexity, maintainability, and risk scoring engine.

Computes deterministic metrics for every file and function:
- Cyclomatic complexity
- Maintainability index
- Coupling (fan-in / fan-out)
- Risk score (change-proneness estimation)
- Trust score (confidence in correctness)
- Entropy index (architectural coherence)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

from .parser import ParsedFile, FunctionInfo
from .graph import CodeGraph


@dataclass
class FileMetrics:
    path: str
    language: str
    total_lines: int
    code_lines: int
    comment_lines: int
    blank_lines: int
    function_count: int
    class_count: int
    import_count: int
    avg_function_length: float
    max_function_length: int
    cyclomatic_complexity: int
    maintainability_index: float
    fan_in: int  # How many files import this
    fan_out: int  # How many files this imports
    coupling_score: float
    risk_score: float
    trust_score: float
    entropy_contribution: float
    is_test: bool
    has_tests: bool  # Whether corresponding test file exists


@dataclass
class ProjectMetrics:
    root: str
    total_files: int
    total_lines: int
    total_functions: int
    total_classes: int
    avg_complexity: float
    avg_maintainability: float
    risk_distribution: dict[str, int]  # risk_band -> count
    trust_distribution: dict[str, int]
    top_risk_files: list[FileMetrics]
    top_complex_functions: list[tuple[str, str, int]]  # (file, func, complexity)
    dependency_depth: int
    cycle_count: int
    dead_code_count: int
    test_coverage_estimate: float  # files with tests / total source files


def compute_file_metrics(
    pf: ParsedFile,
    graph: CodeGraph | None = None,
    is_test: bool = False,
    has_tests: bool = False,
) -> FileMetrics:
    """Compute all metrics for a single parsed file.

    Args:
        pf: ParsedFile from the parser engine
        graph: Optional CodeGraph for coupling metrics
        is_test: Whether this is a test file
        has_tests: Whether a corresponding test file exists

    Returns:
        FileMetrics with all computed scores
    """
    code_lines = pf.total_lines - pf.comment_lines - pf.blank_lines

    # Cyclomatic complexity (sum of function complexities)
    total_complexity = sum(f.complexity for f in pf.functions) or 1

    # Average function length
    if pf.functions:
        func_lengths = [f.end_line - f.start_line + 1 for f in pf.functions]
        avg_func_len = sum(func_lengths) / len(func_lengths)
        max_func_len = max(func_lengths)
    else:
        avg_func_len = 0
        max_func_len = 0

    # Maintainability Index (0-100 scale, higher is better)
    # Based on: MI = 171 - 5.2*ln(V) - 0.23*CC - 16.2*ln(LOC)
    # Where V = Halstead Volume (approximated), CC = cyclomatic complexity
    halstead_vol = code_lines * math.log(max(code_lines, 1)) * 0.5
    mi_raw = 171 - 5.2 * math.log(max(halstead_vol, 1)) - 0.23 * total_complexity - 16.2 * math.log(max(code_lines, 1))
    maintainability = max(0, min(100, mi_raw))

    # Coupling from graph
    fan_in = 0
    fan_out = len(pf.imports)
    if graph:
        # Count files that import this file
        for edge in graph.import_edges:
            if edge.resolved_file == pf.path:
                fan_in += 1

    coupling_score = _compute_coupling(fan_in, fan_out, pf.total_lines)

    # Risk score (0-10, higher = riskier to change)
    risk_score = _compute_risk(
        total_complexity, coupling_score, pf.total_lines,
        len(pf.functions), pf.parse_errors, is_test,
    )

    # Trust score (0-10, higher = more trustworthy)
    trust_score = _compute_trust(
        pf, total_complexity, maintainability, has_tests, is_test,
    )

    # Entropy contribution (how much this file adds to architectural entropy)
    entropy = _compute_entropy_contribution(pf, fan_in, fan_out)

    return FileMetrics(
        path=pf.path,
        language=pf.language,
        total_lines=pf.total_lines,
        code_lines=code_lines,
        comment_lines=pf.comment_lines,
        blank_lines=pf.blank_lines,
        function_count=len(pf.functions),
        class_count=len(pf.classes),
        import_count=len(pf.imports),
        avg_function_length=round(avg_func_len, 1),
        max_function_length=max_func_len,
        cyclomatic_complexity=total_complexity,
        maintainability_index=round(maintainability, 1),
        fan_in=fan_in,
        fan_out=fan_out,
        coupling_score=round(coupling_score, 2),
        risk_score=round(risk_score, 1),
        trust_score=round(trust_score, 1),
        entropy_contribution=round(entropy, 3),
        is_test=is_test,
        has_tests=has_tests,
    )


def compute_project_metrics(
    file_metrics: list[FileMetrics],
    graph: CodeGraph | None = None,
) -> ProjectMetrics:
    """Compute aggregate project-level metrics.

    Args:
        file_metrics: List of per-file metrics
        graph: Optional CodeGraph for dependency analysis

    Returns:
        ProjectMetrics with aggregate scores
    """
    source_files = [m for m in file_metrics if not m.is_test]
    test_files = [m for m in file_metrics if m.is_test]

    if not source_files:
        return ProjectMetrics(
            root="",
            total_files=0, total_lines=0, total_functions=0, total_classes=0,
            avg_complexity=0, avg_maintainability=0,
            risk_distribution={}, trust_distribution={},
            top_risk_files=[], top_complex_functions=[],
            dependency_depth=0, cycle_count=0, dead_code_count=0,
            test_coverage_estimate=0,
        )

    total_funcs = sum(m.function_count for m in source_files)
    total_classes = sum(m.class_count for m in source_files)
    avg_complexity = sum(m.cyclomatic_complexity for m in source_files) / len(source_files)
    avg_maint = sum(m.maintainability_index for m in source_files) / len(source_files)

    # Risk distribution
    risk_dist: dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for m in source_files:
        if m.risk_score < 3:
            risk_dist["low"] += 1
        elif m.risk_score < 6:
            risk_dist["medium"] += 1
        elif m.risk_score < 8:
            risk_dist["high"] += 1
        else:
            risk_dist["critical"] += 1

    # Trust distribution
    trust_dist: dict[str, int] = {"low": 0, "medium": 0, "high": 0}
    for m in source_files:
        if m.trust_score < 4:
            trust_dist["low"] += 1
        elif m.trust_score < 7:
            trust_dist["medium"] += 1
        else:
            trust_dist["high"] += 1

    # Top risk files
    top_risk = sorted(source_files, key=lambda m: -m.risk_score)[:20]

    # Test coverage estimate
    files_with_tests = sum(1 for m in source_files if m.has_tests)
    coverage_est = (files_with_tests / len(source_files)) * 100 if source_files else 0

    # Dependency depth and cycles from graph
    dep_depth = 0
    cycle_count = 0
    dead_count = 0
    if graph:
        cycles = __import__("forge_audit.engine.graph", fromlist=["find_cycles"]).find_cycles(graph)
        cycle_count = len(cycles)
        dead = __import__("forge_audit.engine.graph", fromlist=["find_dead_code"]).find_dead_code(graph)
        dead_count = len(dead)

    return ProjectMetrics(
        root=source_files[0].path.split("/")[0] if source_files else "",
        total_files=len(file_metrics),
        total_lines=sum(m.total_lines for m in file_metrics),
        total_functions=total_funcs,
        total_classes=total_classes,
        avg_complexity=round(avg_complexity, 1),
        avg_maintainability=round(avg_maint, 1),
        risk_distribution=risk_dist,
        trust_distribution=trust_dist,
        top_risk_files=top_risk,
        top_complex_functions=[],
        dependency_depth=dep_depth,
        cycle_count=cycle_count,
        dead_code_count=dead_count,
        test_coverage_estimate=round(coverage_est, 1),
    )


def _compute_coupling(fan_in: int, fan_out: int, lines: int) -> float:
    """Compute coupling score (0-1, higher = more coupled)."""
    if lines == 0:
        return 0
    # Normalize by file size
    return min(1.0, (fan_in + fan_out) / max(lines / 10, 1))


def _compute_risk(
    complexity: int, coupling: float, lines: int,
    func_count: int, parse_errors: list[str], is_test: bool,
) -> float:
    """Compute risk score (0-10).

    Risk factors:
    - High complexity
    - High coupling
    - Large file size
    - Many functions (coordination risk)
    - Parse errors
    """
    if is_test:
        return 1.0  # Tests are low risk to change

    score = 0.0

    # Complexity contribution (0-3)
    if complexity > 100:
        score += 3
    elif complexity > 50:
        score += 2
    elif complexity > 20:
        score += 1

    # Coupling contribution (0-3)
    score += coupling * 3

    # Size contribution (0-2)
    if lines > 1000:
        score += 2
    elif lines > 500:
        score += 1
    elif lines > 200:
        score += 0.5

    # Function count contribution (0-1)
    if func_count > 30:
        score += 1
    elif func_count > 15:
        score += 0.5

    # Parse errors (0-1)
    if parse_errors:
        score += min(1, len(parse_errors) * 0.5)

    return min(10, score)


def _compute_trust(
    pf: ParsedFile, complexity: int, maintainability: float,
    has_tests: bool, is_test: bool,
) -> float:
    """Compute trust score (0-10, higher = more trustworthy).

    Trust factors:
    - Low complexity
    - High maintainability
    - Has tests
    - Has exports (public API, more reviewed)
    - No parse errors
    - Reasonable file size
    """
    if is_test:
        return 8.0  # Tests are generally trustworthy

    score = 5.0  # Start neutral

    # Complexity penalty
    if complexity > 50:
        score -= 2
    elif complexity > 20:
        score -= 1
    elif complexity < 5:
        score += 1

    # Maintainability bonus
    if maintainability > 70:
        score += 2
    elif maintainability > 50:
        score += 1
    elif maintainability < 30:
        score -= 2

    # Test bonus
    if has_tests:
        score += 1.5

    # Parse error penalty
    if pf.parse_errors:
        score -= len(pf.parse_errors) * 0.5

    # Size reasonableness
    if 50 < pf.total_lines < 500:
        score += 0.5
    elif pf.total_lines > 2000:
        score -= 1

    # Exports suggest reviewed API
    if pf.exports:
        score += 0.5

    return max(0, min(10, score))


def _compute_entropy_contribution(
    pf: ParsedFile, fan_in: int, fan_out: int,
) -> float:
    """Compute architectural entropy contribution.

    High entropy = file doesn't follow clear patterns, has unusual
    coupling characteristics, or shows signs of architectural drift.
    """
    entropy = 0.0

    # Unusual coupling patterns
    if fan_in == 0 and fan_out == 0 and pf.functions:
        entropy += 0.3  # Island — no connections

    if fan_out > 20:
        entropy += 0.2  # Too many dependencies

    # Mixed concerns (many imports + many exports + many functions = god file)
    if len(pf.imports) > 15 and len(pf.exports) > 10 and len(pf.functions) > 20:
        entropy += 0.3

    # Parse errors suggest drift
    if pf.parse_errors:
        entropy += 0.1 * len(pf.parse_errors)

    # Very large files with few functions = likely data/config, not code
    if pf.total_lines > 500 and len(pf.functions) < 3 and pf.language not in (
        "json", "yaml", "toml", "csv", "markdown",
    ):
        entropy += 0.2

    return min(1.0, entropy)
