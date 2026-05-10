# Capability Matrix

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md` §4. One row per
> user-visible or load-bearing feature, with an honest status.
> Updated at every phase exit.
> Version: 2026-05-01.

## Status legend

| Status | Meaning |
|---|---|
| `works` | Functions end-to-end on the demo branch with regression test coverage. |
| `partial` | Core path works but a documented gap exists (linked roadmap issue ID). |
| `cosmetic` | Implementation present, but the user-visible label, copy, or visual polish is misleading or unclear. |
| `demo-only` | Functions for the M&C 2023 hardcoded program; will not generalise without P6. |
| `broken` | A required behaviour does not exist or actively misleads. |
| `missing` | Capability intentionally absent today; tracked for a future phase. |

`Refs:` columns point to roadmap §4 issue IDs.

---

## 1. Authentication & session

| Feature | Status | Evidence | Gap / Refs |
|---|---|---|---|
| Public portal chooser & hash routing | works | `audit-map/04-feature-atoms/public-portal-chooser-and-routing.md` | — |
| Academic session bootstrap & login gate | works | `tests/academic-session-shell.test.tsx` | — |
| Role switching & route sync | works | `audit-map/04-feature-atoms/academic-role-switching-and-route-sync.md` | — |
| Stop proof run does not invalidate sysadmin session | partial | evidence only, no dedicated test | H2 → P9 |
| Faculty session stable across proof lifecycle | partial | not tested | H3 → P9 |

## 2. System-admin shell

| Feature | Status | Refs |
|---|---|---|
| Search, breadcrumbs, top tabs | works | — |
| Action queue hide / restore / reminder | works | — |
| Hierarchy workspace (departments, branches, batches) | works | — |
| Faculty calendar + timetable planner | works | — |
| History archive + recycle-bin restore | works | — |
| Requests workspace transitions | works | — |
| Live academic form save (Zod validation, nested error paths) | works | A2, A3, A4 closed |
| "Provisioning" tab semantics | cosmetic / demo-only | B1, C12 → P4, P5 |
| Restore-notice dismiss pattern (one-session) | partial | A6 closed for proof-playback only; broaden in P4 | B5 |

## 3. Proof control plane

| Feature | Status | Refs |
|---|---|---|
| Proof dashboard "no simulation yet" guard for queued/running | works | A1 closed |
| Checkpoints & playback | works | — |
| Background worker polls `simulationRuns` every 5s | works | — |
| Active proof run + new provisioning collision rule | partial — demo-scoped proof-run activation no longer deactivates the global active run; broader provisioning collision UX still pending | `air-mentor-api/tests/demo-isolation.test.ts` → P5 |
| Reset Demo Workspace | partial — schema drop + demo-session invalidation verified by `air-mentor-api/tests/demo-isolation.test.ts`; full seeded demo data-plane reset still pending | C10 → P5 |
| Provisioning preview / dry run | works for estimate-only preview via `air-mentor-api/tests/demo-isolation.test.ts` | C11 → P5 |
| Demo data isolation (`demoWorkspaceId`) | partial — schema registry/reset, demo session pointer isolation, scoped academic bootstrap guard, scoped academic snapshot builder, demo proof-run scope propagation, demo/global activation non-interference, proof-run admin route scope guard, academic proof route scope guard, student-shell proof-run scope guard, and reassessment proof-run scope guard verified by `air-mentor-api/tests/demo-isolation.test.ts`, `air-mentor-api/tests/proof-control-plane-seeded-bootstrap-service.test.ts`, `tests/demo-workspace-pointer.test.ts`, and `tests/api-client.test.ts`; broad academic/proof schema routing and seeded per-demo data remain deferred | C1, H1 → P5/P9 |
| Multi-program switch | missing | D9 → P6 |

## 4. Inference & risk

| Feature | Status | Refs |
|---|---|---|
| Observable risk heuristic engine | works (literature-anchored, see `docs/paper-evidence/01-literature-table.md`) | C14 closed (P1 done) |
| Trained logistic baseline (proof-risk-model.ts on 64 worlds) | partial — in-distribution split protocol A (legacy index-based) backs production-v8; family-disjoint protocol B added in P2.1 for cross-family generalisation reporting | E8 closed (P2.1); E9 partial → P2 |
| Decision-tree challenger | partial — `depth-2-tree` family in code; `catboost` Python-interop scaffolded; not promoted | E8 closed (P2.1); promotion pending P7 |
| Recommended-action band thresholds (≥0.7 / ≥0.35) | partial | hardcoded GAP-6 | C14, audit-map/08-ml-audit/01 |
| Driver impact values 0.28 / 0.14 / 0.20 / 0.10 / 0.05 | works (literature-anchored via `learning-dynamics-constants.ts`; engineering-tier rows disclosed in `docs/paper-evidence/01-literature-table.md`) | C14, E1–E5 closed (P1 done) |
| weakCO threshold (mastery < masteryTarget × 0.85) | works — mastery-based, Bloom-anchored; C4 closed (P3) | C4 closed |
| Per-program model artifact / version | missing | F1, F2 → P7 |
| Calibration metrics (Brier, ECE, reliability) | works (Brier/ECE/slope/intercept in `RiskMetricSummary`; `reliabilityDiagramData()` in `proof-risk-evaluation-stats.ts`; figure render P10) | E12 closed (P2 deep-dig) |
| Bootstrap CIs on AUC | works (`bootstrapAucCi` / `bootstrapBrierCi` / `bootstrapMetricCi` in `proof-risk-evaluation-stats.ts`) | E13 closed (P2 deep-dig) |
| Permutation feature importance | works (`permutationFeatureImportance()` in `proof-risk-evaluation-stats.ts`) | E14 closed (P2 deep-dig) |
| Adversarial corpus (power-law forgetting + control) | works (`proof-risk-adversarial-corpus.ts`) | E11 closed (P2 deep-dig) |
| Majority-class baseline | works (`trainMajorityClassBaseline`) | E9 closed (P2 deep-dig) |
| 2-feature logistic baseline (attendance + CGPA, IRLS) | works (`trainTwoFeatureLogisticBaseline`) | E9 closed (P2 deep-dig) |
| OAT sensitivity sweep | works (`runOneAtATimeSensitivity` + markdown render) | E10 closed (P2 deep-dig) |
| Evaluator generative-split-{train,val,test} profiles | works (in `EVAL_SEED_PROFILES`) | D18 closed (P2 deep-dig) |
| Paper-evidence generator (baseline + corpus + permutation) | works (`scripts/generate-baseline-paper-evidence.ts` → `docs/paper-evidence/03-baseline-results.md`) | D19-partial closed (P2 deep-dig); full evaluator rerun handed off |
| Recalibration service | missing | F3, F5 → P7 |

## 5. Curriculum

| Feature | Status | Refs |
|---|---|---|
| Curriculum import schema (default `edgeKind=explicit`) | works | A2 closed |
| Course outcomes generated at runtime by `coDefinitionsForCourse` | works — reads `outcomesJson`; Bloom mastery target derived per CO; C2, C3 closed (P3) | C2, C3 closed |
| Edge weight numerically affects prerequisite signal | works — explicit=1.0, added=0.5, overridable; weighted average in risk inference; C5, C6 closed (P3) | C5, C6 closed |
| Course outcome → mastery target mapping (Bloom-driven) | works — `BLOOM_LEVEL_MASTERY_TARGET` map wired in `coDefinitionsForCourse`; P3 task 3.2 closed | P3 closed |
| Impact preview before save | works — `POST /curriculum-feature-config/preview` + UI risk-distribution delta panel; C7 closed (P3) | C7 closed |
| Configuration change audit log | works — before/after config + projectedDelta in audit events; history endpoint; C8 closed (P3) | C8 closed |
| `outcomesJson` stored and read by `coDefinitionsForCourse` | works — C2 closed (P3) | C2 closed |

## 6. Linkage (text-matching prerequisite suggester)

| Feature | Status | Refs |
|---|---|---|
| 3-signal candidate generation (manifest + Jaccard + Ollama qwen2.5:7b) | works | `audit-map/04-feature-atoms/system-admin-hierarchy-workspace-and-proof-control-plane.md` |
| Approve / reject / regenerate UI | cosmetic (labels confusing) | B2, B6 → P4 |
| Confidence + signal source in UI | missing | B6 → P4 |

## 7. Multi-program scalability

| Feature | Status | Refs |
|---|---|---|
| BTech CSE M&C 2023 demo | demo-only | D1–D7 → P6 |
| `MSRUAS_PROOF_*` exported constants | broken | D1 → P6 |
| `1MS23MC{nnn}` USN format | demo-only | D2 → P6 |
| `studentCount: 120 / sectionCount: 2 / sem 1–6` | demo-only | D3 → P6 |
| `PROOF_FACULTY` array hardcoded | demo-only | D4 → P6 |
| `proof_program_templates` table | missing | D7 → P6 |
| Second program (BTech ECE 2024) | missing — paper claim N2 lacks evidence | D8 → P6 |

## 8. Scenario engine (research claim N1)

| Feature | Status | Refs |
|---|---|---|
| 8 scenario families implemented (`scenarioProfileForSeed`) | works locally for seeded M&C proof | `air-mentor-api/src/lib/msruas-proof-control-plane.ts:988-1036`; true Section B override-run comparison covered by `air-mentor-api/tests/proof-realism-audit.test.ts`; D6 still missing for per-program family subset |
| Family parameter shifts grounded in literature | works (literature anchors per family in `docs/paper-evidence/scenario-grounding.md`; magnitudes engineering-tier defended by P2 sensitivity sweep) | C15, E6 closed (P1 done) |
| Per-program family subset | missing | D6 → P6 |

## 9. UX polish (cosmetic group, all P4)

| Issue | Status | Refs |
|---|---|---|
| Provisioning tab vs proof-run flow naming | cosmetic | B1 → P4 |
| Linkage labels (Curriculum linkage candidate / Approve / Reject) | cosmetic | B2 → P4 |
| Batch binding / save-target / pinned-profile / target-scope labels | cosmetic | B3 → P4 |
| Rounded-radius / shadow / spacing visual consistency | cosmetic | B4 → P4 |
| Demo vs live badge on Provisioning UI | cosmetic / demo-only | B7 → P5 |
| "Retrain" terminology | works — renamed to "Recalibrate" throughout; B8 closed (P3) | B8 closed |

## 10. Deployment surface

| Feature | Status | Refs |
|---|---|---|
| GitHub Pages frontend | works | `.github/workflows/deploy-pages.yml` |
| Railway backend | works (current) | — |
| `RENDER_PUBLIC_API_URL` fallback wired in workflows + readiness | works (P0 P8-prep commit) | G12 → P8 |
| Render `render.yaml` IaC | missing | G1 → P8 |
| `/health` endpoint | missing | G2 → P8 |
| Background worker as separate Render process | missing | G3 → P8 |
| Render Postgres migration plan | missing | G4, G5 → P8 |
| CORS allowlist for Pages → Render | missing | G6 → P8 |
| Cookie SameSite/Secure for cross-origin | missing | G7 → P8 |
| Custom domain decision | pending | G8, L7 → P8 |
| Render-specific health probes in `verify-live-closeout.yml` | partial | G10 → P8 |
| `scripts/check-render-deploy-readiness.mjs` rename | partial | G11 → P8 |
| Cold-start mitigation (plan choice) | pending | G14, L4 → P8 |
| Rollback plan | missing | G9 → P8 |

## 11. Test coverage

| Surface | Status | Refs |
|---|---|---|
| Critical-path coverage audit (≥80%) | missing | H10 → P9 |
| Demo isolation regression test (global rows untouched) | partial — backend schema/reset/session-pointer/scoped-bootstrap/scoped-academic-snapshot/proof-run activation/admin-scope/academic-proof-scope/student-shell-scope/reassessment-scope regressions and frontend pointer/header tests covered; full browser walkthrough pending | H1 → P5/P9 |
| Multi-program proof-run integration test | missing | H4 → P6/P9 |
| Recalibration service test | missing | H5 → P7/P9 |
| Config wire-through test (outcome → mastery target) | works — `tests/admin-curriculum-feature-config.test.ts`; H6 closed (P3) | H6 closed |
| Edge-weight wire-through test | works — covered in `admin-curriculum-feature-config` suite; H7 closed (P3) | H7 closed |
| E2E suite (Playwright) for full demo walkthrough | partial | focused local Firefox specs: `tests-e2e/specs/proof-ui-population.spec.ts`, `tests-e2e/specs/editable-data-recompute.spec.ts`, `tests-e2e/specs/full-demo-ladder.spec.ts`; H8 remains open for full regression pack/performance |
| Performance baseline | missing | H9 → P9 |
| Snapshot test audit | missing | H11 → P9 |

## 12. Process

| Feature | Status | Refs |
|---|---|---|
| `air-mentor-api/dist/` untracked + gitignored | works | K1 closed (P0) |
| `.claude/settings.local.json` gitignored, shared subset committed | works | K2 closed (P0) |
| `docs/CHANGELOG.md` | works | K4 closed (P0) |
| `docs/CAPABILITY_MATRIX.md` (this file) | works | K5 closed (P0) |
| `docs/POSITIONING.md` (L1 default A) | works | L1 default proposed (P0) |
| `docs/BRANCH_STRATEGY.md` | works | K7 closed (P0) |
| `docs/paper-evidence/` directory | works | E15 closed (P0, README only) |
| Branch protection on `main` | pending | K7 (manual GitHub step) |
| `node_modules/.vite/*` tracked despite gitignore | works | K8 closed (`9b6421d1`) |
| Broader `node_modules/*` tracked (21,086 files) | works | D1 / K8 broader closed (`24d6ec26`) — repo dropped from ≈27,400 to 6,361 tracked files |
| Untracked durable artefacts (audit reports, design docs, readiness governance) | works | D3 closed (`77f0c468`) — 17 artefacts committed |
| Pre-existing `msruas-proof-engines.test.ts > "converts CE thresholds"` failure | works | D4 closed (`dc57600f`) |
| Duplicate `ScenarioFamily` type | works | D8 closed (`5a25de3d`) — re-export from canonical source |
| In-flight `src/*` realism-readiness WIP (~50 files) | partial — captured-with-handoff | K9 — `audit-map/24-agent-memory/deferred-disposition-2026-05-02.md` §D2 |
| Branch protection on `main` | missing — captured-with-handoff | K12 / D6 — manual GitHub UI step |
| Demo branch ↔ `main` reconciliation | missing — captured-with-handoff | K13 / D7 |
| Full evaluator rerun under generative-split-* profiles | missing — needs embedded-postgres-capable host | D19-rest |
| CatBoost Python-interop end-to-end | scaffold-only — captured-with-handoff | D20 / P7 |
| L1–L9 user decisions | defaults proposed; user confirmation pending | D5 |

---

## How to use this file

When you finish a phase task, edit the matching row's status and Refs. When a
new feature surfaces, add a row in the matching section with phase ID. The
matrix is the contract for the paper's "system overview" figure (P10).
