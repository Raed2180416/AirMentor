"""Validation ladder (parallel) + closure readiness (serial)."""
from __future__ import annotations

import textwrap


VAL_COMMON_READ = [
    "audit-map/14-reconciliation/final-decision-appendix.md",
    "audit-map/14-reconciliation/overnight-implementation-plan.md",
    "audit-map/32-reports/overnight-impl-phase1-run-authority.md",
    "audit-map/32-reports/overnight-impl-phase2-feature-correctness.md",
    "audit-map/32-reports/overnight-impl-phase3-case-queue.md",
    "audit-map/32-reports/overnight-impl-phase4-calendar-bridge.md",
    "audit-map/32-reports/overnight-impl-phase5-advance-reset-stop.md",
    "audit-map/32-reports/overnight-impl-phase6-hod-correction.md",
    "audit-map/32-reports/overnight-impl-phase11-final-analytics.md",
]


def _val(node_id: str, title: str, focus: str, command_hint: str) -> dict:
    return dict(
        id=node_id,
        task_class="structured", risk_class="medium", reasoning_effort="high",
        priority=55, parallel_group="overnight-validation",
        depends_on=[
            "overnight-impl-phase11-final-analytics",
            "overnight-ml-catboost-challenger",
        ],
        write_scope_glob="audit-map/22-evals/**;audit-map/32-reports/**",
        title=title,
        purpose_short=(
            f"{title}. Execute the specified validation layer, capture outputs, "
            f"report pass/fail against auth-prompt gate M."
        ),
        nonneg=[
            "Do not modify source or tests",
            "Every pass/fail claim cites exact command + exit status",
            "Flaky tests: report as flaky, do not mark passed",
        ],
        owner_files=[f"audit-map/32-reports/{node_id}.md"],
        read_first=VAL_COMMON_READ,
        scope_body=focus + textwrap.dedent(f"""

            ## COMMAND HINT
            Run the following (or close equivalent) inside the worktree; capture
            full output into the report:
            ```
            {command_hint}
            ```
        """),
        validation_gate="Command output captured; pass/fail tally + failing-test list emitted.",
        artifacts=[dict(
            path=f"audit-map/32-reports/{node_id}.md",
            min_lines=25, min_bytes=800,
            required_sections=[
                f"# {title}",
                "## Commands Run", "## Results Summary",
                "## Failing Tests", "## Conclusion",
            ],
        )],
        hard_timeout_s=14400,
    )


def nodes() -> list[dict]:
    out: list[dict] = []

    out.append(_val(
        "overnight-validate-unit-tests",
        "Overnight Validate: Logic / Unit Tests",
        textwrap.dedent("""\
            ## SCOPE
            Run unit test suites for frontend + backend:
            - `npm test` at repo root (vitest on src/**)
            - `npm --prefix air-mentor-api test` (vitest on air-mentor-api/tests/**)

            Focus on tests covering: feature construction, missingness, stage
            authority, concern keying, intervention impact formula, local
            calibration utilities, no-action simulation branch (auth prompt M1).
        """),
        command_hint=(
            "npm test -- --run 2>&1 | tail -200\n"
            "npm --prefix air-mentor-api test -- --run 2>&1 | tail -200"
        ),
    ))

    out.append(_val(
        "overnight-validate-api-integration",
        "Overnight Validate: API / Integration Tests",
        textwrap.dedent("""\
            ## SCOPE
            Run API/integration suites (auth prompt M2): run creation, day
            advance, stage advance, reset stage, complete reset, stop, correction
            cycle, queue/calendar bridge.

            Only integration-flagged tests. Do not trigger heavyweight ML
            training/eval workloads inside this node.
        """),
        command_hint=(
            "npm --prefix air-mentor-api test -- --run --reporter=verbose "
            "--include '**/*integration*.test.ts' 2>&1 | tail -200\n"
            "npm test -- --run --reporter=verbose --include '**/*integration*.test.ts' "
            "2>&1 | tail -200"
        ),
    ))

    out.append(_val(
        "overnight-validate-determinism-replay",
        "Overnight Validate: Deterministic Replay",
        textwrap.dedent("""\
            ## SCOPE
            Replay validation (auth prompt M4):
            - same seed + same actions → same outcomes
            - same feature snapshot + same artifact → same risk output
            - manual edits reflected deterministically
            - intervention-response outcomes stable

            Use existing replay scripts in `scripts/` (e.g.
            `scripts/check-local-railway-db-alignment.sh`,
            `scripts/closeout-stage-*-success.mjs`) where applicable.
        """),
        command_hint=(
            "ls scripts/closeout-stage-*-success.mjs | head -5\n"
            "# run replay scripts if env supports it; else document scripted "
            "dry-run proof paths"
        ),
    ))

    out.append(_val(
        "overnight-validate-ml-metrics",
        "Overnight Validate: ML Evaluation Metrics",
        textwrap.dedent("""\
            ## SCOPE
            ML evaluation validation (auth prompt M5): global metrics, local
            threshold behavior, overload, precision/recall at budget, stage/
            semester/scenario breakdown, calibration, challenger shadow
            comparisons. Read from `audit-map/22-evals/` outputs of Phases 7/9/10.

            Do not retrain. Read recorded metrics; assert gates; emit summary.
        """),
        command_hint=(
            "cat audit-map/22-evals/overnight-ml-v8-corrected-logistic.md | head -200\n"
            "cat audit-map/22-evals/overnight-ml-beta-calibration.md | head -200\n"
            "cat audit-map/22-evals/overnight-ml-catboost-challenger.md | head -200"
        ),
    ))

    # Closure
    out.append(dict(
        id="overnight-closure-verification",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=50, parallel_group=None,
        depends_on=[
            "overnight-validate-unit-tests",
            "overnight-validate-api-integration",
            "overnight-validate-determinism-replay",
            "overnight-validate-ml-metrics",
        ],
        write_scope_glob="audit-map/32-reports/**;audit-map/24-agent-memory/**",
        title="Overnight Closure Verification + Demo Script",
        purpose_short=(
            "Verify every deliverable from auth-prompt P. Emit final "
            "implementation summary + demo-script checklist + remaining-risk register."
        ),
        nonneg=[
            "Every deliverable P.1..P.8 addressed",
            "Verdict ∈ {ready, partial, not-ready} with per-section status",
            "Remaining risk register lists every non-passing gate",
        ],
        owner_files=["audit-map/32-reports/overnight-final-summary.md"],
        read_first=[
            "audit-map/14-reconciliation/final-decision-appendix.md",
            "audit-map/14-reconciliation/overnight-unified-ledger.md",
            "audit-map/14-reconciliation/overnight-implementation-plan.md",
            "audit-map/32-reports/overnight-impl-phase1-run-authority.md",
            "audit-map/32-reports/overnight-impl-phase2-feature-correctness.md",
            "audit-map/32-reports/overnight-impl-phase3-case-queue.md",
            "audit-map/32-reports/overnight-impl-phase4-calendar-bridge.md",
            "audit-map/32-reports/overnight-impl-phase5-advance-reset-stop.md",
            "audit-map/32-reports/overnight-impl-phase6-hod-correction.md",
            "audit-map/32-reports/overnight-impl-phase11-final-analytics.md",
            "audit-map/22-evals/overnight-ml-v8-corrected-logistic.md",
            "audit-map/22-evals/overnight-ml-beta-calibration.md",
            "audit-map/22-evals/overnight-ml-catboost-challenger.md",
            "audit-map/32-reports/overnight-validate-unit-tests.md",
            "audit-map/32-reports/overnight-validate-api-integration.md",
            "audit-map/32-reports/overnight-validate-determinism-replay.md",
            "audit-map/32-reports/overnight-validate-ml-metrics.md",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            Emit the final implementation summary + demo-script checklist
            following auth-prompt P. Sections:
            - What was changed
            - Why
            - What remains
            - What is safe for demo
            - What is still experimental
            - Demo script checklist: exact click-path to show each auth-prompt L flow
            - Remaining risk register (with severity + owner + follow-up task)
        """),
        validation_gate="Verdict present; demo script covers flows L1..L11.",
        artifacts=[dict(
            path="audit-map/32-reports/overnight-final-summary.md",
            min_lines=80, min_bytes=3000,
            required_sections=[
                "# Overnight Final Summary",
                "## Verdict",
                "## What Was Changed",
                "## Why",
                "## What Remains",
                "## Safe for Demo",
                "## Still Experimental",
                "## Demo Script Checklist",
                "## Remaining Risk Register",
            ],
        )],
        hard_timeout_s=14400,
    ))

    return out
