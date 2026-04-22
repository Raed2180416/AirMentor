"""Serial impl phases 1..6 + phase 11 final analytics."""
from __future__ import annotations

import textwrap


IMPL_COMMON_READ = [
    "audit-map/14-reconciliation/final-decision-appendix.md",
    "audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md",
    "audit-map/14-reconciliation/overnight-unified-ledger.md",
    "audit-map/14-reconciliation/overnight-implementation-plan.md",
    "audit-map/32-reports/overnight-unified-mitigation-plan.md",
]


def _impl(node_id: str, title: str, phase: str, scope: str,
          owner_files: list[str], read_code: list[str],
          focus: str, audit_report: str,
          depends_on: list[str],
          extra_gate: str = "",
          priority: int = 70) -> dict:
    return dict(
        id=node_id,
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=priority, parallel_group=None,
        depends_on=depends_on,
        write_scope_glob=scope,
        title=title,
        purpose_short=(
            f"Implement {phase}. Surgical edits only, matching unified implementation plan. "
            f"Preserve UI/UX flow. Add/update tests. Produce per-edit summary report."
        ),
        nonneg=[
            "Every edit must be listed in the implementation plan",
            "Preserve existing UI/UX flow in src/**/*.tsx",
            "Never alter the frozen decision appendix",
            "Every new behavior has at least one unit or integration test",
            "Never edit AGENTS.md, CLAUDE.md, .windsurf/, .claude/",
        ],
        owner_files=owner_files,
        read_first=IMPL_COMMON_READ + [audit_report] + read_code,
        scope_body=focus,
        validation_gate=(
            "All listed edits applied with file:line evidence; "
            "`npm --prefix air-mentor-api test` (or targeted subset) passes for touched modules; "
            "report cites every edit with line range. " + extra_gate
        ).strip(),
        artifacts=[dict(
            path=f"audit-map/32-reports/{node_id}.md",
            min_lines=40, min_bytes=1500,
            required_sections=[
                f"# {title}",
                "## Edits Applied",
                "## Tests Added / Updated",
                "## Validation Run",
                "## Remaining Risk",
            ],
        )],
        hard_timeout_s=21600,
    )


def nodes() -> list[dict]:
    out: list[dict] = []

    out.append(_impl(
        "overnight-impl-phase1-run-authority",
        "Overnight Impl Phase 1: Run Authority / Fresh-Sem1 Core",
        phase="Phase 1 (run authority)",
        scope=(
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-runtime-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-live-run-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-tail-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts;"
            "air-mentor-api/src/db/**;"
            "air-mentor-api/tests/**;"
            "audit-map/32-reports/**"
        ),
        owner_files=[
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-runtime-service.ts",
            "air-mentor-api/src/db/schema.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-runtime-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-live-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-tail-service.ts",
        ],
        focus=textwrap.dedent("""\
            ## SCOPE
            Apply Phase 1 edits from the unified plan. Targets:
            - `simulation_runs` authoritative fields present + populated by activation.
            - Eliminate sem6 bootstrap assumptions from startup paths.
            - Fresh runs start at Semester 1 / pre-TT1.
            - No fake prior transcript/history for fresh Sem1.
            - Add/expand stage-entry + baseline snapshots.
            - Distinguish completed-inspectable vs stopped in backend semantics.

            Test additions required: activation builds correct fresh-Sem1 state; no prior
            CGPA/backlog values present; lifecycleState transitions are legal.
        """),
        audit_report="audit-map/32-reports/overnight-audit-run-authority.md",
        depends_on=["overnight-merge-implementation-plan"],
        priority=72,
    ))

    out.append(_impl(
        "overnight-impl-phase2-feature-correctness",
        "Overnight Impl Phase 2: Feature / Evidence / Runtime Correctness",
        phase="Phase 2 (feature/evidence/runtime correctness)",
        scope=(
            "air-mentor-api/src/lib/proof-risk-model.ts;"
            "air-mentor-api/src/lib/inference-engine.ts;"
            "air-mentor-api/src/lib/proof-observed-state.ts;"
            "air-mentor-api/src/lib/proof-provenance.ts;"
            "air-mentor-api/src/modules/academic-runtime-routes.ts;"
            "air-mentor-api/src/modules/academic.ts;"
            "air-mentor-api/tests/**;"
            "audit-map/32-reports/**"
        ),
        owner_files=[
            "air-mentor-api/src/lib/proof-risk-model.ts",
            "air-mentor-api/src/lib/inference-engine.ts",
            "air-mentor-api/src/lib/proof-observed-state.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-risk-model.ts",
            "air-mentor-api/src/lib/inference-engine.ts",
            "air-mentor-api/src/lib/proof-observed-state.ts",
            "air-mentor-api/src/modules/academic-runtime-routes.ts",
        ],
        focus=textwrap.dedent("""\
            ## SCOPE
            Apply Phase 2 edits from the unified plan. Targets:
            - Stop deriving live stage from evidence presence. Use authoritative run stage.
            - Remove stale checkpoint evidence reuse from live scoring.
            - Make Semester 1 prior history null-safe.
            - Add explicit missingness indicators (companion features).
            - Ensure early absent TT/SEE are NOT encoded as worst-case.
            - Make quiz/assignment evidence visible to risk as soon as entered.
            - Unify route write semantics with playback/runtime visibility semantics.
            - Keep model serving on authoritative observed state only.

            Test additions: missingness-aware feature unit tests; stale checkpoint
            leakage regression test; early-evidence immediate-reaction integration test.
        """),
        audit_report="audit-map/32-reports/overnight-audit-feature-evidence.md",
        depends_on=["overnight-impl-phase1-run-authority"],
        priority=71,
    ))

    out.append(_impl(
        "overnight-impl-phase3-case-queue",
        "Overnight Impl Phase 3: Primary Case / Queue / Workflow",
        phase="Phase 3 (primary case model / queue / workflow tasks)",
        scope=(
            "air-mentor-api/src/lib/proof-queue-governance.ts;"
            "air-mentor-api/src/lib/monitoring-engine.ts;"
            "air-mentor-api/src/lib/proof-active-run.ts;"
            "air-mentor-api/src/lib/proof-run-queue.ts;"
            "air-mentor-api/src/modules/academic.ts;"
            "air-mentor-api/src/modules/academic-runtime-routes.ts;"
            "air-mentor-api/tests/**;"
            "audit-map/32-reports/**"
        ),
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
            ## SCOPE
            Apply Phase 3 edits from the unified plan. Targets:
            - Replace broad student+semester keying with concernContextKey everywhere.
            - Separate primary student concern cases from workflow tasks.
            - dismissal = handled; later deterioration opens a new case (new caseId);
              old case stays closed.
            - Manual teacher-created concerns count as interventions.
            - Canonical counting semantics consistent across surfaces.
            - Ownership: High→Mentor, Medium→Course Leader; HOD only for approval/
              unlock/escalation/oversight. Ownership change rewrites tasks immediately.

            Test additions: concernContextKey collision test; reopen-new-case test;
            workflow-count-separation assertion; ownership-change rewiring test.
        """),
        audit_report="audit-map/32-reports/overnight-audit-case-queue-workflow.md",
        depends_on=["overnight-impl-phase2-feature-correctness"],
        priority=70,
    ))

    out.append(_impl(
        "overnight-impl-phase4-calendar-bridge",
        "Overnight Impl Phase 4: Queue / Task / Calendar Bridge",
        phase="Phase 4 (queue/task/calendar bridge)",
        scope=(
            "air-mentor-api/src/lib/proof-control-plane-section-risk-service.ts;"
            "air-mentor-api/src/lib/proof-queue-governance.ts;"
            "air-mentor-api/src/modules/academic-runtime-routes.ts;"
            "air-mentor-api/src/modules/academic.ts;"
            "src/pages/calendar-pages.tsx;"
            "air-mentor-api/tests/**;"
            "tests/**;"
            "audit-map/32-reports/**"
        ),
        owner_files=[
            "air-mentor-api/src/modules/academic-runtime-routes.ts",
            "src/pages/calendar-pages.tsx",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-queue-governance.ts",
            "air-mentor-api/src/modules/academic-runtime-routes.ts",
            "air-mentor-api/src/modules/academic.ts",
            "src/pages/calendar-pages.tsx",
        ],
        focus=textwrap.dedent("""\
            ## SCOPE
            Apply Phase 4 edits from the unified plan. Targets:
            - Every actionable proof case that requires work bridges to academic tasks/calendar.
            - Calendar drag mutates underlying due date.
            - Queue and calendar agree on owner/date/state.
            - Proof-mode calendar uses simulated date, NOT browser date.
            - Workflow tasks represented without polluting primary case counts.

            UI/UX PRESERVATION: `src/pages/calendar-pages.tsx` edits must be data-wiring
            only. No visual/UX changes. If design change seems required, stop and record
            in notes instead of editing.

            Test additions: drag-mutates-date API test; simulated-date rendering assertion.
        """),
        audit_report="audit-map/32-reports/overnight-audit-frontend-flows.md",
        depends_on=["overnight-impl-phase3-case-queue"],
        priority=69,
        extra_gate="src/pages/calendar-pages.tsx diff ≤ 200 lines net.",
    ))

    out.append(_impl(
        "overnight-impl-phase5-advance-reset-stop",
        "Overnight Impl Phase 5: Next Day / Next Stage / Reset / Stop",
        phase="Phase 5 (next day / next stage / reset / stop)",
        scope=(
            "air-mentor-api/src/lib/proof-control-plane-advance-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-tail-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-policy-service.ts;"
            "air-mentor-api/src/modules/academic-runtime-routes.ts;"
            "air-mentor-api/tests/**;"
            "audit-map/32-reports/**"
        ),
        owner_files=[
            "air-mentor-api/src/lib/proof-control-plane-advance-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-control-plane-advance-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-tail-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts",
        ],
        focus=textwrap.dedent("""\
            ## SCOPE
            Apply Phase 5 edits from the unified plan. Targets:
            - Real advance-day: simulated date += 1 day.
            - Real advance-stage: snap to next stage boundary via the same transition pipeline.
            - Next Day auto-advances stage on boundary crossing (one transition, no duplicates).
            - Demo auto-resolution semantics on Next Stage (open actionable cases may auto-resolve).
            - Reset Current Stage (restore stage-entry snapshot).
            - Complete Reset (recreate clean Sem1 / pre-TT1).
            - Stop Simulation (credential deletion + session invalidation).
            - Preserve completed-inspectable after Semester 6.

            Test additions: boundary-crossing idempotency; auto-resolution branch coverage;
            reset restores stage-entry snapshot; stop invalidates sessions.
        """),
        audit_report="audit-map/32-reports/overnight-audit-run-authority.md",
        depends_on=["overnight-impl-phase4-calendar-bridge"],
        priority=68,
    ))

    out.append(_impl(
        "overnight-impl-phase6-hod-correction",
        "Overnight Impl Phase 6: HOD Correction Cycle",
        phase="Phase 6 (HOD correction cycle state machine)",
        scope=(
            "air-mentor-api/src/lib/proof-control-plane-hod-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts;"
            "air-mentor-api/src/modules/academic.ts;"
            "src/pages/hod-pages.tsx;"
            "air-mentor-api/tests/**;"
            "audit-map/32-reports/**"
        ),
        owner_files=[
            "air-mentor-api/src/lib/proof-control-plane-hod-service.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-control-plane-hod-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts",
            "air-mentor-api/src/modules/academic.ts",
            "src/pages/hod-pages.tsx",
        ],
        focus=textwrap.dedent("""\
            ## SCOPE
            Apply Phase 6 edits from the unified plan. Targets:
            - Explicit correction-cycle state machine:
              request → approve/reject → reset & unlock → teacher edit → recompute → relock.
            - Scope-aware unlock: evidence-only / scheme / blueprint.
            - Scheme/blueprint editors truly reopen when approved.

            UI/UX PRESERVATION: `src/pages/hod-pages.tsx` edits data-wiring only.

            Test additions: correction-cycle state transitions; scope-aware unlock gates;
            relock enforcement after recompute.
        """),
        audit_report="audit-map/32-reports/overnight-audit-run-authority.md",
        depends_on=["overnight-impl-phase5-advance-reset-stop"],
        priority=67,
        extra_gate="src/pages/hod-pages.tsx diff ≤ 150 lines net.",
    ))

    out.append(_impl(
        "overnight-impl-phase11-final-analytics",
        "Overnight Impl Phase 11: Final Analytics Counterfactual",
        phase="Phase 11 (final analytics counterfactual)",
        scope=(
            "air-mentor-api/src/lib/proof-control-plane-dashboard-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-stage-summary-service.ts;"
            "air-mentor-api/src/lib/proof-control-plane-batch-service.ts;"
            "air-mentor-api/tests/**;"
            "audit-map/32-reports/**"
        ),
        owner_files=[
            "air-mentor-api/src/lib/proof-control-plane-dashboard-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-stage-summary-service.ts",
        ],
        read_code=[
            "air-mentor-api/src/lib/proof-control-plane-dashboard-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-stage-summary-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-batch-service.ts",
        ],
        focus=textwrap.dedent("""\
            ## SCOPE
            Apply Phase 11 edits from the unified plan. Targets:
            - Replace fixed-penalty comparator with simulator-based no-intervention branch.
            - Keep simpler comparator as temporary diagnostic only.
            - Final analytics shows: projected with-intervention vs without-intervention,
              failures-prevented estimate, score/risk/backlog trends, manual interventions,
              HOD escalations/workflow separately, semester-wise + student-wise drilldowns.
            - Copy uses `projected`, `simulated`, `counterfactual` — never implies causal uplift.

            Test additions: counterfactual branch deterministic under seed; copy-assertion
            tests on analytics UI strings (architectural only — do not change UI layout).
        """),
        audit_report="audit-map/32-reports/overnight-audit-ml-boundaries.md",
        depends_on=["overnight-impl-phase6-hod-correction"],
        priority=64,
    ))

    return out
