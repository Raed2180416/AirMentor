"""Wave 1 doc reconciliation + Wave 2 merge-final-decisions."""
from __future__ import annotations

import textwrap

from .common import AUTH_PROMPT


def nodes() -> list[dict]:
    out: list[dict] = []

    # ---- Wave 1 ----
    out.append(dict(
        id="overnight-reconcile-proof-lifecycle",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=95, parallel_group="overnight-docs", depends_on=[],
        write_scope_glob="audit-map/14-reconciliation/**;audit-map/32-reports/**;audit-map/24-agent-memory/**",
        title="Overnight Reconcile: Proof Lifecycle",
        purpose_short=(
            "Reconcile proof-lifecycle docs (activation, runtime, stage/date authority, "
            "completed-inspectable vs stopped, reset semantics) with authoritative prompt. "
            "Produce per-claim ledger with file:line evidence."
        ),
        nonneg=[
            "Every claim has a file:line citation",
            "Do not overwrite final-decision-appendix.md",
            "Do not modify backend or frontend source",
        ],
        owner_files=[
            # NOTE: each parallel docs-reconcile node writes to a DISTINCT
            # file so parallel merges cannot collide. The merge-final-decisions
            # node below consolidates all three into the shared
            # `contradiction-matrix.md`.
            "docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md",
            "docs/closeout/stage-07b-semester-1-to-3-proof-walk.md",
            "docs/closeout/stage-07c-semester-4-to-6-proof-walk.md",
            "audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md",
        ],
        read_first=[
            AUTH_PROMPT + " sections B, C(1), C(10-15), D, L (flows 1-6, 10-11)",
            "audit-map/14-reconciliation/final-decision-appendix.md",
            "audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md",
            "air-mentor-api/src/lib/proof-control-plane-activation-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-runtime-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-tail-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-live-run-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts",
            "air-mentor-api/src/lib/proof-control-plane-advance-service.ts",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            Topics: proof lifecycle (setup-draft → active-run → completed-inspectable
            / stopped / reset-current-stage / complete-reset), stage/date authority,
            Next Day / Next Stage transition pipeline, semester boundaries.

            Emit one ledger row per claim:
              claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook

            If doc contradicts frozen appendix, mark `needs-doc-update`. Never touch appendix.
            Emit `## Mitigation Plan` keyed by phase 1/5/7 of auth prompt.
        """),
        validation_gate="Ledger must contain ≥10 rows AND Mitigation Plan section populated.",
        artifacts=[dict(
            path="audit-map/32-reports/overnight-reconcile-proof-lifecycle.md",
            min_lines=40, min_bytes=1500,
            required_sections=[
                "# Overnight Reconcile: Proof Lifecycle",
                "## Findings", "## Ledger", "## Evidence",
                "## Mitigation Plan", "## Recommendations",
            ],
        )],
    ))

    out.append(dict(
        id="overnight-reconcile-ml-docs",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=95, parallel_group="overnight-docs", depends_on=[],
        write_scope_glob="audit-map/14-reconciliation/**;audit-map/08-ml-audit/**;audit-map/32-reports/**;audit-map/24-agent-memory/**",
        title="Overnight Reconcile: ML Strategy",
        purpose_short=(
            "Reconcile ML/risk/calibration/counterfactual docs with auth prompt F/G/H/J/N. "
            "Separate model vs policy vs monitoring vs simulator claims. Record v7 overload diagnosis."
        ),
        nonneg=[
            "Every ML claim cites file:line in src or trained artifacts",
            "Do not touch air-mentor-api/src/lib/proof-risk-model.ts",
            "Do not delete prior ML metric entries; mark superseded instead",
        ],
        owner_files=[
            "audit-map/08-ml-audit/README.md",
            "audit-map/14-reconciliation/contradiction-matrix-ml.md",
            "audit-map/32-reports/overnight-reconcile-ml.md",
        ],
        read_first=[
            AUTH_PROMPT + " sections F, G, H, J, N",
            "air-mentor-api/src/lib/proof-risk-model.ts",
            "air-mentor-api/src/lib/inference-engine.ts",
            "air-mentor-api/src/lib/monitoring-engine.ts",
            "air-mentor-api/src/lib/proof-observed-state.ts",
            "air-mentor-api/air-mentor-api/output/",
            "air-mentor-api/catboost_info/",
            "docs/closeout/final-authoritative-plan.md",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            Reconcile claims about heads (attendanceRisk, ceRisk, seeRisk, overallCourseRisk,
            downstreamCarryoverRisk), operational banding, v7 overload (1.1127 vs 1.0 baseline),
            challenger status, calibration method (Beta-by-head default), missingness strategy,
            seeded-vs-runtime scoring authority, counterfactual scope (simulator-based),
            intervention-response formula.

            Ledger columns: claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact.
            Close every claim that contradicts layer separation rule.
        """),
        validation_gate="v7 overload diagnosis ≥3 candidate causes ranked; ≥8 ledger rows.",
        artifacts=[dict(
            path="audit-map/32-reports/overnight-reconcile-ml.md",
            min_lines=50, min_bytes=2000,
            required_sections=[
                "# Overnight Reconcile: ML Strategy",
                "## Findings", "## Ledger", "## Evidence",
                "## v7 Overload Diagnosis", "## Mitigation Plan",
                "## Recommendations",
            ],
        )],
    ))

    out.append(dict(
        id="overnight-reconcile-queue-calendar-docs",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=95, parallel_group="overnight-docs", depends_on=[],
        write_scope_glob="audit-map/14-reconciliation/**;audit-map/32-reports/**;audit-map/24-agent-memory/**",
        title="Overnight Reconcile: Queue / Calendar / HOD",
        purpose_short=(
            "Reconcile queue/case/calendar/HOD-correction docs vs auth prompt "
            "B(14-20), C(2-8), C(15), D(4-6), D(9), L."
        ),
        nonneg=[
            "Every claim cites file:line in current code",
            "concernContextKey spec must match frozen appendix exactly",
            "Workflow tasks never count as primary student concern cases",
        ],
        owner_files=[
            "audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md",
            "audit-map/32-reports/overnight-reconcile-queue-calendar.md",
        ],
        read_first=[
            AUTH_PROMPT + " sections B(14-20), C(2-8), C(15), D(4-6), D(9), L",
            "audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md",
            "air-mentor-api/src/lib/proof-queue-governance.ts",
            "air-mentor-api/src/lib/monitoring-engine.ts",
            "air-mentor-api/src/lib/proof-active-run.ts",
            "air-mentor-api/src/lib/proof-run-queue.ts",
            "air-mentor-api/src/lib/proof-control-plane-hod-service.ts",
            "src/pages/calendar-pages.tsx",
            "src/pages/hod-pages.tsx",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            Topics: concernContextKey, case taxonomy (primary vs workflow), ownership routing,
            dismissal=handled, reopen-later-deterioration, queue↔calendar bridge, drag→due-date,
            demo auto-resolution, HOD correction cycle (request→approve→reset-unlock→edit→recompute→relock).

            Emit ledger with files_to_change + validation hook per claim.
        """),
        validation_gate="≥10 ledger rows covering all listed topics.",
        artifacts=[dict(
            path="audit-map/32-reports/overnight-reconcile-queue-calendar.md",
            min_lines=40, min_bytes=1500,
            required_sections=[
                "# Overnight Reconcile: Queue / Calendar / HOD",
                "## Findings", "## Ledger", "## Evidence",
                "## Mitigation Plan", "## Recommendations",
            ],
        )],
    ))

    # ---- Wave 2 ----
    out.append(dict(
        id="overnight-merge-final-decisions",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=90, parallel_group=None,
        depends_on=[
            "overnight-reconcile-proof-lifecycle",
            "overnight-reconcile-ml-docs",
            "overnight-reconcile-queue-calendar-docs",
        ],
        write_scope_glob="audit-map/14-reconciliation/**;audit-map/24-agent-memory/**;audit-map/32-reports/**",
        title="Overnight Merge: Final Decisions + Unified Mitigation Plan",
        purpose_short=(
            "Merge three reconciliations into unified conflict-free ledger + "
            "phase-ordered mitigation plan. Append new frozen rules to appendix only if "
            "they already exist in the authoritative prompt."
        ),
        nonneg=[
            "Never weaken a frozen rule already in the appendix",
            "Every appended rule cites auth-prompt section",
            "Merge deterministic: same inputs → same output",
        ],
        owner_files=[
            "audit-map/14-reconciliation/contradiction-matrix.md",
            "audit-map/14-reconciliation/final-decision-appendix.md",
            "audit-map/14-reconciliation/reconciliation-log.md",
            "audit-map/24-agent-memory/working-knowledge.md",
        ],
        read_first=[
            "audit-map/32-reports/overnight-reconcile-proof-lifecycle.md",
            "audit-map/32-reports/overnight-reconcile-ml.md",
            "audit-map/32-reports/overnight-reconcile-queue-calendar.md",
            "audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md",
            "audit-map/14-reconciliation/contradiction-matrix-ml.md",
            "audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md",
            "audit-map/14-reconciliation/final-decision-appendix.md",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            1. Concat all three contradiction matrices + ledgers into
               `audit-map/14-reconciliation/overnight-unified-ledger.md`
               and consolidate into the shared
               `audit-map/14-reconciliation/contradiction-matrix.md`.
            2. Dedupe; preserve file:line citations.
            3. If auth prompt adds a rule not yet in the frozen appendix, append under
               a new `## Overnight Additions (2026-04-22)` section. Never overwrite.
            4. Emit `audit-map/32-reports/overnight-unified-mitigation-plan.md` ordered
               by phase (1 → 11). Each row: file | location | change | test | rollback.

            Downstream impl nodes MUST read the unified plan first.
        """),
        validation_gate="Unified ledger ≥40 lines; mitigation plan has all 11 phase sections.",
        artifacts=[
            dict(
                path="audit-map/14-reconciliation/overnight-unified-ledger.md",
                min_lines=40, min_bytes=1800,
                required_sections=[
                    "# Overnight Unified Ledger",
                    "## Proof Lifecycle", "## ML Strategy", "## Queue / Calendar / HOD",
                ],
            ),
            dict(
                path="audit-map/32-reports/overnight-unified-mitigation-plan.md",
                min_lines=60, min_bytes=2500,
                required_sections=[
                    "# Overnight Unified Mitigation Plan",
                    "## Phase 1", "## Phase 2", "## Phase 3", "## Phase 4",
                    "## Phase 5", "## Phase 6", "## Phase 7", "## Phase 8",
                    "## Phase 9", "## Phase 10", "## Phase 11",
                ],
            ),
        ],
    ))

    return out
