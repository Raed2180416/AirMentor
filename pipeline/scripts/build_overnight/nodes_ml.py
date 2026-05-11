"""ML RCA (parallel, read-only) + training/calibration/challenger (serial)."""
from __future__ import annotations

import textwrap


RCA_COMMON_READ = [
    "audit-map/14-reconciliation/final-decision-appendix.md",
    "audit-map/14-reconciliation/overnight-implementation-plan.md",
    "audit-map/32-reports/overnight-audit-ml-boundaries.md",
]


def _rca(node_id: str, title: str, focus: str,
         extra_sections: list[str] | None = None) -> dict:
    secs = ["## Inputs", "## Findings", "## Evidence",
            "## Next-Steps Hypotheses", "## Recommendations"]
    if extra_sections:
        secs += extra_sections
    return dict(
        id=node_id,
        task_class="structured", risk_class="medium", reasoning_effort="high",
        priority=75, parallel_group="overnight-ml-rca",
        depends_on=["overnight-merge-implementation-plan"],
        write_scope_glob="audit-map/08-ml-audit/**;audit-map/22-evals/**;audit-map/32-reports/**",
        title=title,
        purpose_short=(
            f"{title}. Read-only diagnostic on current corpus. No threshold changes."
        ),
        nonneg=[
            "Do not modify model source",
            "Do not promote any candidate model",
            "Every chart/table cites exact input feature export path",
        ],
        owner_files=[f"audit-map/22-evals/{node_id}.md"],
        read_first=RCA_COMMON_READ + [
            "air-mentor-api/air-mentor-api/output/",
            "air-mentor-api/catboost_info/",
            "air-mentor-api/src/lib/proof-risk-model.ts",
        ],
        scope_body=focus,
        validation_gate="Report cites corpus path + produces ≥1 actionable hypothesis.",
        artifacts=[dict(
            path=f"audit-map/22-evals/{node_id}.md",
            min_lines=30, min_bytes=1000,
            required_sections=[f"# {title}"] + secs,
        )],
    )


def nodes() -> list[dict]:
    out: list[dict] = []

    out.append(_rca(
        "overnight-ml-rca-histograms-current",
        "Overnight ML RCA: overallCourseRisk histograms by stage & semester",
        textwrap.dedent("""\
            ## SCOPE
            Produce stage- and semester-conditioned score histograms for
            overallCourseRisk on CURRENT corpus (auth prompt N2). Bins: {pre-tt1,
            post-tt1, post-tt2, post-assignments, post-see} × semester{1..6}.
            Record counts, means, p10/p25/p50/p75/p90, overload mass >0.85.
            Emit a markdown table per stage × semester. CSV optional under
            `audit-map/22-evals/data/`.
        """),
    ))

    out.append(_rca(
        "overnight-ml-rca-local-reliability-current",
        "Overnight ML RCA: local reliability at 0.4 and 0.85",
        textwrap.dedent("""\
            ## SCOPE
            Produce local reliability diagrams at 0.4 and 0.85 decision
            thresholds on CURRENT corpus (auth prompt N3). Bin predicted probs
            in ±0.05 windows; compute observed failure rates; compute local
            ECE at each band. Emit per-stage tables.
        """),
    ))

    out.append(_rca(
        "overnight-ml-rca-overload-breakdowns-current",
        "Overnight ML RCA: overload by stage / semester / scenario family",
        textwrap.dedent("""\
            ## SCOPE
            Decompose v7 overload (1.1127) by stage × semester × scenario family.
            Report per-cell queue-opening rate, capacity, overload ratio.
            Identify worst cells to target in calibration/threshold work.
            No threshold changes — diagnostic only.
        """),
    ))

    out.append(_rca(
        "overnight-ml-rca-interaction-ablations-current",
        "Overnight ML RCA: interaction-feature ablations",
        textwrap.dedent("""\
            ## SCOPE
            Run interaction-feature ablations on current corpus (auth prompt N5,
            Phase 8):
              - none
              - TT interaction only
              - coursework interaction only
              - stage × TT only
              - stage × coursework only
              - all
            Report ROC-AUC, Brier, ECE, overload for each ablation.
            Determine whether overload is caused by local miscalibration,
            score bunching near thresholds, specific interaction features,
            or stage-conditioned distribution shift.
        """),
    ))

    # Phase 7: v8 corrected baseline training (serial, depends on all impl + RCA)
    out.append(dict(
        id="overnight-ml-v8-corrected-logistic",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=63, parallel_group=None,
        depends_on=[
            "overnight-impl-phase1-run-authority",
            "overnight-impl-phase2-feature-correctness",
            "overnight-impl-phase3-case-queue",
            "overnight-ml-rca-histograms-current",
            "overnight-ml-rca-local-reliability-current",
            "overnight-ml-rca-overload-breakdowns-current",
            "overnight-ml-rca-interaction-ablations-current",
        ],
        write_scope_glob=(
            "air-mentor-api/air-mentor-api/output/**;"
            "air-mentor-api/scripts/**;"
            "audit-map/08-ml-audit/**;"
            "audit-map/22-evals/**;"
            "audit-map/32-reports/**"
        ),
        title="Overnight ML Phase 7: Corrected v8 Logistic Baseline",
        purpose_short=(
            "Build corrected frozen corpus after world/feature fixes, train v8 logistic "
            "baseline with missingness-aware features, evaluate on full decision metric set."
        ),
        nonneg=[
            "Do not promote if overload remains unsafe (>1.0)",
            "Must use the corrected corpus only (post-Phase-2 world fixes)",
            "Every eval metric has a JSON sidecar with exact numbers",
            "Deterministic seed; reproducibility gate must pass",
        ],
        owner_files=[
            "audit-map/22-evals/overnight-ml-v8-corrected-logistic.md",
        ],
        read_first=[
            "audit-map/14-reconciliation/overnight-implementation-plan.md",
            "audit-map/22-evals/overnight-ml-rca-overload-breakdowns-current.md",
            "audit-map/22-evals/overnight-ml-rca-interaction-ablations-current.md",
            "air-mentor-api/src/lib/proof-risk-model.ts",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            1. Build corrected frozen corpus from post-Phase-2 world.
            2. Train v8 corrected logistic baseline with missingness-aware features.
            3. Evaluate:
               - ROC-AUC, PR-AUC
               - Brier
               - ECE (global)
               - local calibration near 0.4 and 0.85
               - overload ratio
               - precision/recall at budget
               - stage / semester / scenario stability
            4. Compare against v7 and heuristic baselines.
            5. Emit reproducibility manifest (seed, feature list, split hash).
        """),
        validation_gate=(
            "Overload ratio ≤1.00 on corrected corpus; ROC-AUC ≥0.78; "
            "ECE ≤0.010; reproducibility manifest present; promotion decision stated."
        ),
        artifacts=[dict(
            path="audit-map/22-evals/overnight-ml-v8-corrected-logistic.md",
            min_lines=40, min_bytes=1500,
            required_sections=[
                "# Overnight ML Phase 7: Corrected v8 Logistic Baseline",
                "## Inputs", "## Training", "## Metrics",
                "## Comparison vs v7", "## Promotion Decision",
                "## Reproducibility Manifest",
            ],
        )],
        hard_timeout_s=36000,
    ))

    # Phase 9: calibration
    out.append(dict(
        id="overnight-ml-beta-calibration",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=62, parallel_group=None,
        depends_on=["overnight-ml-v8-corrected-logistic"],
        write_scope_glob=(
            "air-mentor-api/air-mentor-api/output/**;"
            "air-mentor-api/scripts/**;"
            "air-mentor-api/src/lib/proof-risk-model.ts;"
            "audit-map/08-ml-audit/**;"
            "audit-map/22-evals/**;"
            "audit-map/32-reports/**"
        ),
        title="Overnight ML Phase 9: Beta Calibration (default) + Venn-Abers (shadow)",
        purpose_short=(
            "Apply Beta calibration by head as default production path. Run Venn-Abers "
            "as diagnostic. Evaluate global + local calibration."
        ),
        nonneg=[
            "Beta calibration per head (5 heads)",
            "Do not rely on global ECE alone; local bands 0.4/0.85 must improve",
            "Promotion blocked if local calibration worsens",
        ],
        owner_files=[
            "audit-map/22-evals/overnight-ml-beta-calibration.md",
        ],
        read_first=[
            "audit-map/22-evals/overnight-ml-v8-corrected-logistic.md",
            "air-mentor-api/src/lib/proof-risk-model.ts",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            1. Fit Beta calibration per head on corrected corpus.
            2. Evaluate global ECE and local ECE at 0.4 / 0.85 bands.
            3. Run Venn-Abers as shadow diagnostic (uncertainty path).
            4. Emit promotion decision: calibrated vs uncalibrated.
            5. If promotion accepted, update `proof-risk-model.ts` calibration hook
               with a surgical edit (≤150 lines net diff).
        """),
        validation_gate=(
            "Local ECE at 0.4 ≤ pre-cal; local ECE at 0.85 ≤ pre-cal; global ECE not worse."
        ),
        artifacts=[dict(
            path="audit-map/22-evals/overnight-ml-beta-calibration.md",
            min_lines=30, min_bytes=1200,
            required_sections=[
                "# Overnight ML Phase 9: Beta Calibration",
                "## Inputs", "## Calibration Curves",
                "## Local Bands (0.4 / 0.85)", "## Venn-Abers Diagnostic",
                "## Promotion Decision",
            ],
        )],
        hard_timeout_s=14400,
    ))

    # Phase 10: CatBoost challenger
    out.append(dict(
        id="overnight-ml-catboost-challenger",
        task_class="high-stakes", risk_class="high", reasoning_effort="xhigh",
        priority=61, parallel_group=None,
        depends_on=["overnight-ml-beta-calibration"],
        write_scope_glob=(
            "air-mentor-api/air-mentor-api/output/**;"
            "air-mentor-api/catboost_info/**;"
            "air-mentor-api/scripts/**;"
            "audit-map/08-ml-audit/**;"
            "audit-map/22-evals/**;"
            "audit-map/32-reports/**"
        ),
        title="Overnight ML Phase 10: CatBoost Challenger",
        purpose_short=(
            "Train CatBoost challenger on corrected frozen corpus as shadow. "
            "Compare vs corrected v8 logistic on decision-aware metrics, not AUC alone."
        ),
        nonneg=[
            "Challenger kept as shadow/benchmark only",
            "Do not promote CatBoost unless it beats logistic on ranking AND proper "
            "scoring AND local calibration AND overload AND replayability",
            "GPU search candidates must be rerun through official reproducible path",
        ],
        owner_files=[
            "audit-map/22-evals/overnight-ml-catboost-challenger.md",
        ],
        read_first=[
            "audit-map/22-evals/overnight-ml-v8-corrected-logistic.md",
            "audit-map/22-evals/overnight-ml-beta-calibration.md",
        ],
        scope_body=textwrap.dedent("""\
            ## SCOPE
            1. Train CatBoost challenger on corrected corpus. GPU search if available.
            2. Evaluate full decision-metric set (same as Phase 7).
            3. Compare logistic vs CatBoost head-to-head.
            4. Decide: shadow-continue vs candidate-promotion vs reject.
            5. If promotable, rerun top candidate through reproducible official path.
        """),
        validation_gate=(
            "CatBoost metrics table emitted; head-to-head comparison vs v8 present; "
            "promotion decision stated."
        ),
        artifacts=[dict(
            path="audit-map/22-evals/overnight-ml-catboost-challenger.md",
            min_lines=30, min_bytes=1200,
            required_sections=[
                "# Overnight ML Phase 10: CatBoost Challenger",
                "## Inputs", "## Training", "## Metrics",
                "## Head-to-Head vs Logistic v8",
                "## Promotion Decision",
            ],
        )],
        hard_timeout_s=21600,
    ))

    return out
