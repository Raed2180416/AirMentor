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
| Active proof run + new provisioning collision rule | broken | C9 → P5 (decision pending) |
| Reset Demo Workspace | missing | C10 → P5 |
| Provisioning preview / dry run | missing | C11 → P5 |
| Demo data isolation (`demoWorkspaceId`) | missing | C1, H1 → P5 |
| Multi-program switch | missing | D9 → P6 |

## 4. Inference & risk

| Feature | Status | Refs |
|---|---|---|
| Observable risk heuristic engine | works (literature-anchored, see `docs/paper-evidence/01-literature-table.md`) | C14 closed (P1 done) |
| Trained logistic baseline (proof-risk-model.ts on 64 worlds) | partial — in-distribution split protocol A (legacy index-based) backs production-v8; family-disjoint protocol B added in P2.1 for cross-family generalisation reporting | E8 closed (P2.1); E9 partial → P2 |
| Decision-tree challenger | partial — `depth-2-tree` family in code; `catboost` Python-interop scaffolded; not promoted | E8 closed (P2.1); promotion pending P7 |
| Recommended-action band thresholds (≥0.7 / ≥0.35) | partial | hardcoded GAP-6 | C14, audit-map/08-ml-audit/01 |
| Driver impact values 0.28 / 0.14 / 0.20 / 0.10 / 0.05 | works (literature-anchored via `learning-dynamics-constants.ts`; engineering-tier rows disclosed in `docs/paper-evidence/01-literature-table.md`) | C14, E1–E5 closed (P1 done) |
| weakCO threshold (`tt2Pct < 50 ‖ seePct < 45`) | broken (hardcoded, ignores config) | C4 → P3 |
| Per-program model artifact / version | missing | F1, F2 → P7 |
| Calibration metrics (Brier, ECE, reliability) | missing | E12 → P2 |
| Bootstrap CIs on AUC | missing | E13 → P2 |
| Permutation feature importance | missing | E14 → P2 |
| Recalibration service | missing | F3, F5 → P7 |

## 5. Curriculum

| Feature | Status | Refs |
|---|---|---|
| Curriculum import schema (default `edgeKind=explicit`) | works | A2 closed |
| Course outcomes generated at runtime by `coDefinitionsForCourse` | broken (ignores config) | C2, C3 → P3 |
| Edge weight numerically affects prerequisite signal | broken (`explicit` ≡ `added`) | C5, C6 → P3 |
| Course outcome → mastery target mapping (Bloom-driven) | missing | P3 task 3.2 |
| Impact preview before save | missing | C7 → P3 |
| Configuration change audit log | missing | C8 → P3 |
| `outcomesJson` stored but never read by `readRuntimeCurriculum` | broken | C2 → P3 |

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
| 8 scenario families implemented (`scenarioProfileForSeed`) | works | `air-mentor-api/src/lib/msruas-proof-control-plane.ts:988-1036` |
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
| "Retrain" terminology | cosmetic — should be "Recalibrate" until real data | B8 → P3 (decision L8) |

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
| Demo isolation regression test (global rows untouched) | missing | H1 → P5/P9 |
| Multi-program proof-run integration test | missing | H4 → P6/P9 |
| Recalibration service test | missing | H5 → P7/P9 |
| Config wire-through test (outcome → mastery target) | missing | H6 → P3/P9 |
| Edge-weight wire-through test | missing | H7 → P3/P9 |
| E2E suite (Playwright) for full demo walkthrough | missing | H8 → P9 |
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
| `node_modules/.vite/*` tracked despite gitignore | broken | **K8** (new, follow-up P0) |

---

## How to use this file

When you finish a phase task, edit the matching row's status and Refs. When a
new feature surfaces, add a row in the matching section with phase ID. The
matrix is the contract for the paper's "system overview" figure (P10).
