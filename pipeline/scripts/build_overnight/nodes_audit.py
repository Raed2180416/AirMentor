"""Wave 3 parallel code audit + Wave 4 merge implementation plan."""
from __future__ import annotations

import textwrap


COMMON_READ = [
    "audit-map/14-reconciliation/final-decision-appendix.md",
    "audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md",
    "audit-map/14-reconciliation/overnight-unified-ledger.md",
    "audit-map/32-reports/overnight-unified-mitigation-plan.md",
]


def _audit(node_id: str, title: str, owner_files: list[str],
           read_code: list[str], focus: str,
           extra_sections: list[str] | None = None) -> dict:
    secs = ["## Findings", "## Evidence", "## Recommendations",
            "## Findings Table", "## Severity Distribution",
            "## Target-Phase Mapping"]
    if extra_sections:
        secs += extra_sections
    return dict(
        id=node_id,
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=85, parallel_group="overnight-audit",
        depends_on=["overnight-merge-final-decisions"],
        write_scope_glob="audit-map/17-artifacts/**;audit-map/32-reports/**;audit-map/24-agent-memory/**",
        title=title,
        purpose_short=(
            f"Deep audit: {title}. Per-file findings table — expected vs current code truth "
            f"(file:line) — with target-phase and severity."
        ),
        nonneg=[
            "Do not modify source (read-only pass)",
            "Every finding has file:line citation",
            "Severity ∈ {low, medium, high, critical}",
            "target_phase must map to the unified mitigation plan",
        ],
        owner_files=owner_files,
        read_first=COMMON_READ + read_code,
        scope_body=focus,
        validation_gate="≥8 findings with file:line evidence; every finding has target_phase.",
        artifacts=[dict(
            path=f"audit-map/32-reports/{node_id}.md",
            min_lines=40, min_bytes=1500,
            required_sections=[f"# {title}"] + secs,
        )],
    )


def nodes() -> list[dict]:
    out: list[dict] = []

    out.append(_audit(
        "overnight-audit-run-authority",
        "Overnight Audit: Run Authority / Fresh-Sem1 Core",
        owner_files=[
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-runtime-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-live-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-tail-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-advance-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts",
            "air-mentor-api/src/db/schema.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-runtime-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-live-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-tail-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-advance-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts",
            "air-mentor-api/src/db/schema.ts",
        ],
        focus=textwrap.dedent("""\
            ## FOCUS
            - `simulation_runs` authority fields (activeOperationalSemester, activeStageKey,
              simulatedDateIso, setupConfigJson, scenarioConfigJson, lifecycleState, runMode,
              stageBoundaryJson).
            - Fresh Sem1 / pre-TT1 start: no sem6 bootstrap, no fake prior transcript.
            - completed-inspectable vs stopped semantics.
            - Next Stage / Next Day / Reset Current Stage / Complete Reset / Stop.
            - Stage boundaries strictly increasing; activation fails otherwise.

            Map every finding to phase 1/5/11 of auth prompt.
        """),
    ))

    out.append(_audit(
        "overnight-audit-feature-evidence",
        "Overnight Audit: Feature / Evidence / Runtime Correctness",
        owner_files=[
            "air-mentor-api/src/lib/proof-risk-model.ts",
            "air-mentor-api/src/lib/inference-engine.ts",
            "air-mentor-api/src/lib/proof-observed-state.ts",
            "air-mentor-api/src/lib/proof-provenance.ts",
            "air-mentor-api/src/modules/academic-runtime-routes.ts",
            "air-mentor-api/src/modules/academic.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-risk-model.ts",
            "air-mentor-api/src/lib/inference-engine.ts",
            "air-mentor-api/src/lib/proof-observed-state.ts",
            "air-mentor-api/src/lib/proof-provenance.ts",
            "air-mentor-api/src/modules/academic-runtime-routes.ts",
            "air-mentor-api/src/modules/academic.ts",
        ],
        focus=textwrap.dedent("""\
            ## FOCUS
            - Stage derivation must use authoritative run stage, NOT evidence presence.
            - Stale checkpoint evidence reuse — every path where prior-checkpoint data
              leaks into current scoring.
            - Missingness: Sem1 prior CGPA/backlog null-safe, not zero. Find silent
              zero-collapse. Plan missingness companion features.
            - Quiz/assignment visibility: entered values must be visible to risk
              immediately. Route write semantics must match playback/runtime.
            - Model serves from authoritative observed state, never seeded simulator output.

            Map every finding to Phase 2.
        """),
    ))

    out.append(_audit(
        "overnight-audit-case-queue-workflow",
        "Overnight Audit: Primary Case / Queue / Workflow",
        owner_files=[
            "air-mentor-api/src/lib/proof-queue-governance.ts",
            "air-mentor-api/src/lib/monitoring-engine.ts",
            "air-mentor-api/src/lib/proof-active-run.ts",
            "air-mentor-api/src/lib/proof-run-queue.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-queue-governance.ts",
            "air-mentor-api/src/lib/monitoring-engine.ts",
            "air-mentor-api/src/lib/proof-active-run.ts",
            "air-mentor-api/src/lib/proof-run-queue.ts",
        ],
        focus=textwrap.dedent("""\
            ## FOCUS
            - concernContextKey = studentId + offeringId + concernFamily + semesterNumber.
            - Primary vs workflow separation; workflow must not inflate headline counts.
            - Dismissal = handled = case closed for that episode.
            - Later deterioration → new caseId; old case stays closed.
            - Manual teacher-created concerns count as interventions when student-facing.
            - Ownership: High→Mentor, Medium→Course Leader, HOD only for approval/
              unlock/escalation/oversight. Ownership change rewrites tasks immediately.

            Map every finding to Phase 3.
        """),
    ))

    out.append(_audit(
        "overnight-audit-frontend-flows",
        "Overnight Audit: Frontend UI/UX Flow Preservation",
        owner_files=[
            "src/App.tsx",
            "src/domain.ts",
            "src/pages/calendar-pages.tsx",
            "src/pages/hod-pages.tsx",
            "src/pages/course-pages.tsx",
            "src/system-admin-live-app.tsx",
        ],
        read_code=[
            "src/App.tsx",
            "src/domain.ts",
            "src/pages/calendar-pages.tsx",
            "src/pages/hod-pages.tsx",
            "src/pages/course-pages.tsx",
            "src/system-admin-live-app.tsx",
        ],
        focus=textwrap.dedent("""\
            ## FOCUS
            Read-only audit. Map each visible flow to auth-prompt flows L1..L11. NO UI/UX
            redesign proposals — user mandates preservation. Only surface architectural/
            data-wiring gaps that cause wrong data or hidden editability.

            - Navigation visibility vs editability separation.
            - Risk Watch visible in Sem1 pre-TT1 (no actionable queue rows).
            - Assessment surfaces always visible; lock/unlock governs edit.
            - Queue/calendar agree on owner/date/state.
            - Calendar uses simulated date in proof mode.

            Map every gap to the specific backend phase that owns the fix.
        """),
    ))

    out.append(_audit(
        "overnight-audit-ml-boundaries",
        "Overnight Audit: Model / Policy / Monitoring / Simulator Layer Separation",
        owner_files=[
            "air-mentor-api/src/lib/proof-risk-model.ts",
            "air-mentor-api/src/lib/proof-queue-governance.ts",
            "air-mentor-api/src/lib/monitoring-engine.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-risk-model.ts",
            "air-mentor-api/src/lib/proof-queue-governance.ts",
            "air-mentor-api/src/lib/monitoring-engine.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-policy-service.ts",
        ],
        focus=textwrap.dedent("""\
            ## FOCUS
            Audit the model/policy/monitoring/simulator boundary (auth prompt C9).
            Find every cross-layer violation:
            - Model picking an action (should be policy).
            - Simulator as authoritative scorer (runtime must rescore).
            - Monitoring emitting a predicted risk number (should only route).
            - Policy making calibration decisions (should only map risk → action).

            Audit intervention-response formula (auth prompt H): runSeed + studentId +
            semester + stage + caseId + actionCode → bounded delta must be deterministic.

            Map findings to Phase 7 (training), Phase 11 (final analytics), or
            cross-layer cleanup under Phase 3/4.
        """),
    ))

    # Wave 4 merge
    out.append(dict(
        id="overnight-merge-implementation-plan",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=80, parallel_group=None,
        depends_on=[
            "overnight-audit-run-authority",
            "overnight-audit-feature-evidence",
            "overnight-audit-case-queue-workflow",
            "overnight-audit-frontend-flows",
            "overnight-audit-ml-boundaries",
        ],
        write_scope_glob="audit-map/14-reconciliation/**;audit-map/24-agent-memory/**;audit-map/32-reports/**",
        title="Overnight Merge: Implementation Plan",
        purpose_short=(
            "Consolidate every code audit into ordered implementation plan. Per phase: "
            "edit list, test additions, validation gates, rollback strategy."
        ),
        nonneg=[
            "Plan cites file:line for every edit target",
            "Plan must not alter frozen decision appendix",
            "Phase order matches auth prompt (1→2→3→4→5→6 then 8→7→9→10→11 ML chain)",
        ],
        owner_files=["audit-map/14-reconciliation/overnight-implementation-plan.md"],
        read_first=[
            "audit-map/32-reports/overnight-audit-run-authority.md",
            "audit-map/32-reports/overnight-audit-feature-evidence.md",
            "audit-map/32-reports/overnight-audit-case-queue-workflow.md",
            "audit-map/32-reports/overnight-audit-frontend-flows.md",
            "audit-map/32-reports/overnight-audit-ml-boundaries.md",
            "audit-map/32-reports/overnight-unified-mitigation-plan.md",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            Emit master plan with numbered edits per phase. Each edit row:
              file | location | change | test | rollback | owner_phase.

            Downstream impl nodes MUST read this plan first.
        """),
        validation_gate="Every phase section ≥3 edit rows; all rows have file:line.",
        artifacts=[dict(
            path="audit-map/14-reconciliation/overnight-implementation-plan.md",
            min_lines=100, min_bytes=3500,
            required_sections=[
                "# Overnight Implementation Plan",
                "## Phase 1 — Run Authority",
                "## Phase 2 — Feature / Evidence / Runtime",
                "## Phase 3 — Primary Case / Queue / Workflow",
                "## Phase 4 — Queue / Calendar Bridge",
                "## Phase 5 — Next Day / Next Stage / Reset / Stop",
                "## Phase 6 — HOD Correction Cycle",
                "## Phase 7 — Corrected v8 Baseline Training",
                "## Phase 8 — Overload Root Cause Analysis",
                "## Phase 9 — Calibration",
                "## Phase 10 — CatBoost Challenger",
                "## Phase 11 — Final Analytics Counterfactual",
            ],
        )],
    ))

    return out
