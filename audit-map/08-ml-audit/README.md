# ML Audit

Bootstrap `ml-audit-pass` completed on 2026-04-15.

## Component Index

| Component | Classification | Audit file | Primary evidence |
| --- | --- | --- | --- |
| Observable risk fallback scoring | Deterministic scoring plus heuristic thresholding | `audit-map/08-ml-audit/01-observable-risk-heuristic-fallback.md` | `air-mentor-api/src/lib/inference-engine.ts`, `air-mentor-api/src/lib/proof-risk-model.ts` |
| Proof risk production model and calibration | Trained model plus post-hoc calibration and display gating | `audit-map/08-ml-audit/02-proof-risk-production-model-and-calibration.md` | `air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts` |
| Correlation drivers and fallback provenance | Deterministic correlation artifact plus runtime fallback synthesis | `audit-map/08-ml-audit/03-proof-risk-correlation-drivers-and-runtime-fallbacks.md` | `air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` |
| Policy replay, action scoring, queue ranking, monitoring | Deterministic heuristics and ranking | `audit-map/08-ml-audit/04-policy-replay-action-scoring-and-monitoring.md` | `air-mentor-api/src/lib/proof-control-plane-playback-service.ts`, `air-mentor-api/src/lib/proof-queue-governance.ts`, `air-mentor-api/src/lib/monitoring-engine.ts` |
| Derived scenario heads and role-facing framing | Heuristic derivation plus UI explanation and suppression logic | `audit-map/08-ml-audit/05-derived-scenario-heads-and-cross-surface-framing.md` | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts`, `src/pages/risk-explorer.tsx`, `src/pages/student-shell.tsx`, `src/pages/hod-pages.tsx` |
| Curriculum linkage generation | Deterministic matching plus optional embedding and local LLM assist | `audit-map/08-ml-audit/06-curriculum-linkage-generation-pipeline.md` | `air-mentor-api/src/lib/curriculum-linkage.ts`, `air-mentor-api/scripts/curriculum_linkage_nlp.py`, `src/system-admin-faculties-workspace.tsx` |

## Cross-Cutting Findings

- AirMentor's main proof-risk surface is not a single model. It is a stack: deterministic fallback scoring, trained multi-head logistic artifacts, deterministic calibration-display suppression, deterministic correlation-driven explanations, deterministic policy replay heuristics, and UI-only advisory scenario heads.
- Live or active runtime recompute can persist `fallback-simulated` source references when checkpoint evidence or graph history is missing. That means a row can be served through the trained-risk path while still carrying downgraded provenance.
- Probability display is intentionally withheld for heads that fail held-out support or calibration quality gates. `ceRisk` remains band-only even when other heads can show probabilities.
- The current repo does not contain a fresh checked-in evaluation report for the active proof-risk artifact family, and local regeneration was blocked in this sandbox by `listen EPERM`. Reproducibility is therefore only partially proven in this pass.
- Curriculum linkage is a mixed pipeline. Deterministic prerequisite and token-overlap rules lead, optional Python NLP and sentence-transformer ranking refine, and local Ollama assist is optional and operator-environment dependent.

## Reconciled Layering (Model vs Policy vs Monitoring vs Simulator)

- **Model layer (authoritative ML scoring):** Five-head production scoring and queue-priority authority come from the trained artifact path in `air-mentor-api/src/lib/proof-risk-model.ts:69` and `air-mentor-api/src/lib/proof-risk-model.ts:351`.
- **Calibration/display layer (post-hoc guardrails):** The default calibration search includes `beta`/`venn-abers` (`air-mentor-api/src/lib/proof-risk-model.ts:102`), while baseline-v5-like excludes them (`air-mentor-api/src/lib/proof-risk-model.ts:112`); `ceRisk` display remains disabled (`air-mentor-api/src/lib/proof-risk-model.ts:701`).
- **Fallback/heuristic layer (deterministic backup):** Heuristic banding is computed in `air-mentor-api/src/lib/inference-engine.ts:72`; this is an operational fallback path, not the production model.
- **Monitoring layer (policy operations):** `alert/watch/suppress` ownership and cooldown decisions are deterministic governance logic in `air-mentor-api/src/lib/monitoring-engine.ts:25`.
- **Simulator/counterfactual layer:** Intervention counterfactual adjustment is deterministic simulation policy math in `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:209`, while runtime persists `counterfactualLiftScaled` in `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:771`.

## Metric History Notes

- Superseded: broad wording that treated all heads as probability-display eligible is superseded by explicit `ceRisk` suppression in `air-mentor-api/src/lib/proof-risk-model.ts:701`.
- Superseded: any claim that model overload equals monitoring-only behavior is superseded by runtime overload penalty to faculty budget in `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:352` and `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:377`.
- Retained: queue burden/watcher metrics remain valid and are retained for continuity in `audit-map/17-artifacts/local/2026-04-20T001738Z--proof-risk-coverage-24-hybrid-router--local--evaluation-report.md:133` and `audit-map/17-artifacts/local/2026-04-20T211458Z--proof-risk-v6-expanded-metrics--local--evaluation-report.md:82`.

## Remaining Uncovered Scope

- Fresh live verification on GitHub Pages and Railway for current proof-risk artifact availability, fallback frequency, and probability-display behavior.
- Fresh regeneration of `output/proof-risk-model/evaluation-report.{json,md}` in an environment that permits the local listeners required by the current toolchain.
- End-to-end parity checks across mentor, course leader, HoD, sysadmin, and student surfaces for the same student and checkpoint after active recompute.
