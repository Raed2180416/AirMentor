# ML System Map

Aggregate confirmed ML, heuristic, and inference surfaces from `08-ml-audit/`.

## Confirmed Component Families

| Family | Classification | Primary evidence | Primary audit note |
| --- | --- | --- | --- |
| Observable risk fallback scoring | Deterministic plus heuristic | `air-mentor-api/src/lib/inference-engine.ts` | `08-ml-audit/01-observable-risk-heuristic-fallback.md` |
| Proof-risk production and challenger artifacts | Trained plus post-hoc calibration | `air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | `08-ml-audit/02-proof-risk-production-model-and-calibration.md` |
| Correlation-driver augmentation and provenance downgrade path | Deterministic artifact plus runtime fallback synthesis | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | `08-ml-audit/03-proof-risk-correlation-drivers-and-runtime-fallbacks.md` |
| Policy replay, action scoring, queue ranking, monitoring | Deterministic heuristics | `air-mentor-api/src/lib/proof-control-plane-playback-service.ts`, `air-mentor-api/src/lib/proof-queue-governance.ts`, `air-mentor-api/src/lib/monitoring-engine.ts` | `08-ml-audit/04-policy-replay-action-scoring-and-monitoring.md` |
| Derived scenario heads and role-facing framing | Heuristic derivation plus UI gating | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts`, `src/pages/risk-explorer.tsx`, `src/pages/student-shell.tsx` | `08-ml-audit/05-derived-scenario-heads-and-cross-surface-framing.md` |
| Curriculum linkage generation | Mixed deterministic plus optional embedding and local LLM assist | `air-mentor-api/src/lib/curriculum-linkage.ts`, `air-mentor-api/scripts/curriculum_linkage_nlp.py` | `08-ml-audit/06-curriculum-linkage-generation-pipeline.md` |

## System-Level Findings

- The repo contains one clear trained-model family: governed proof-risk artifacts stored in `riskModelArtifacts`. Most other "intelligent" behavior is deterministic or heuristic and should not be described as standalone ML.
- The trained proof-risk path is surrounded by deterministic safety rails: calibration selection, head-display suppression, policy replay support warnings, correlation gating, and role-facing disclaimers.
- GAP-6 remains intentionally deferred: section environment parameters, seeded simulation behavior knobs, and runtime band thresholds are still code-owned defaults rather than per-run slider-configurable settings.
- Runtime can serve trained-risk shapes with downgraded provenance via `fallback-simulated` source refs when checkpoint evidence or graph-aware history is missing.
- Cross-surface semantic truth is not fully proven yet. Academic routes can reuse the active model without the same correlation and provenance context carried by proof-specific tail services.
- The curriculum-linkage stack is the main non-proof ML-adjacent system. It mixes deterministic rules with optional `sentence-transformers` embeddings and optional local Ollama assist, but no benchmark artifact was found in repo.

## Verification Posture

- Verified locally:
  - Frontend proof and risk UI tests: `tests/system-admin-proof-dashboard-workspace.test.tsx`, `tests/risk-explorer.test.tsx`, `tests/student-shell.test.tsx`, `tests/student-shell-loading.test.tsx`, `tests/faculty-profile-proof.test.tsx`, `tests/hod-pages.test.ts`, `tests/academic-proof-summary-strip.test.tsx`
  - Backend model and heuristic tests: `air-mentor-api/tests/proof-risk-model.test.ts`, `air-mentor-api/tests/evaluate-proof-risk-model.test.ts`, `air-mentor-api/tests/proof-queue-governance.test.ts`, `air-mentor-api/tests/policy-phenotypes.test.ts`, `air-mentor-api/tests/msruas-curriculum-compiler.test.ts`, `air-mentor-api/tests/proof-control-plane-dashboard-service.test.ts`
- Blocked in this sandbox:
  - Fresh route-level backend verification for `risk-explorer`, `student-agent-shell`, `hod-proof-analytics`, and `admin-curriculum-feature-config` due `listen EPERM`
  - Fresh `evaluate:proof-risk-model` artifact generation due the same listener restriction
- Not yet proven in this pass:
  - Current live artifact availability on GitHub Pages and Railway
  - Cross-role parity for the same student truth after active recompute
  - Fresh per-run override behavior for thresholds or environment knobs, because no DB/UI config path exists yet for those deferred controls
