# AIR-MENTOR-UI Master Roadmap

> Version: 2026-05-01
> Owner: Raed (solo dev, AI-heavy assist)
> Scope: every issue raised across architectural review chat (2026-04 → 2026-05) →
>        research paper publishable + Render production-ready + multi-program scalable.
> Status format per item: `done | partial | pending | deferred`

---

## 0. How To Use This Document

This is the **single source of truth** for outstanding work. Three lenses:

1. **Issue Registry (§4)** — every concern raised in chat, status, phase mapping.
2. **Phase Catalog (§5)** — execution plan, P0–P12.
3. **Traceability Matrix (§10)** — issue ID → phase ID, two-way pointer.

When work completes, mark status in §4 and add to `docs/CHANGELOG.md` (to be created in P0).

When new issue surfaces, add to §4 with new ID and map into a phase before implementation.

---

## 1. Goals Hierarchy

```
Tier 1 (must)  Research paper publishable @ EDM / IEEE TLT / AIED
Tier 2 (must)  Demo defensible — every UI label/feature self-explains, no穿帮
Tier 3 (must)  Render backend + GitHub Pages frontend prod-ready contract
Tier 4 (should) Multi-program template (proof of scalability for paper claim)
Tier 5 (should) Production scaling architecture seeds (designs, not implementations)
Tier 6 (nice)  First pilot deployment readiness
```

---

## 2. Novelty Claims (paper核心)

```
Claim N1: Realistic student-environment simulation engine
          → grounded in retention/learning literature
          → 8 scenario families mapped to documented failure modes
          → reproduces statistical signatures of those failure modes

Claim N2: Adaptable risk model architecture with per-program calibration
          → same model schema, recalibrated parameters per curriculum
          → demonstrated on ≥2 programs (M&C 2023 + ECE 2024)
          → quantitative confidence bounds on transfer

Claim N3: Configuration-driven simulation that surfaces curriculum-specific risk
          → course outcomes, prerequisites, edge weights numerically affect output
          → impact preview reveals config sensitivity before commit
```

What we explicitly do NOT claim (paper limitations §):
```
× Validated on real student data
× Production-ready for institutional deployment
× Generalizes across all academic structures (only undergrad semester-based tested)
× Replaces existing institutional risk processes
```

---

## 3. Current State Snapshot (2026-05-01)

```
Branch:       college-demo-2026-04-27
Backend:      air-mentor-api/, currently Railway
Frontend:     src/, GitHub Pages
DB:           Postgres (Drizzle ORM)
ML:           logistic regression + decision tree challenger (proof-risk-model.ts)
              trained on 64 synthetic worlds (PROOF_CORPUS_MANIFEST:156-166)
Demo program: BTech CSE Mathematics & Computing 2023 (hardcoded)
Background:   single-thread worker polling simulationRuns table every 5s
Inference:    rule-based, hardcoded impact values (inference-engine.ts:39-191)
```

Working tree state at roadmap inception (per `git status`):
- ~50+ modified files in `air-mentor-api/dist/*` (build artifacts)
- Modified workflow files (deploy-pages, verify-live-closeout)
- Modified scripts/check-railway-deploy-readiness.mjs
- Modified .claude/settings.local.json
→ P0 hygiene task

---

## 4. Issue Registry — Every Concern Raised In Chat

Status legend: `done | partial | pending | deferred`
Phase ID maps to §5 catalog.

### Group A — Already Completed (verified in chat tests)

| ID | Issue | Status | Phase | Files of record |
|---|---|---|---|---|
| A1 | Proof dashboard "No simulation yet" panel when run is queued/running but `activeRunDetail` null | done | (closed) | `src/system-admin-proof-dashboard-workspace.tsx`, `tests/system-admin-proof-dashboard-workspace.test.tsx` |
| A2 | Backend curriculum schema defaulted missing `edgeKind` to `explicit` | done | (closed) | `air-mentor-api/src/modules/admin-structure.ts` |
| A3 | Frontend live-save validator rejected same-semester `added` prerequisites | done | (closed) | `src/system-admin-live-app.tsx`, `tests/system-admin-live-form-submit.test.tsx` |
| A4 | Nested Zod errors flattened — no path like `prerequisites.0.edgeKind` | done | (closed) | `air-mentor-api/src/modules/support.ts` |
| A5 | Faculty overview false `0 profiles · scope required` when no scope selected | done | (closed) | `src/system-admin-overview-helpers.ts`, `src/system-admin-live-app.tsx` |
| A6 | Proof-playback restore notice not dismissible without resetting playback | done | (closed) | `src/system-admin-proof-dashboard-workspace.tsx`, `src/system-admin-ui.tsx` |
| A7 | Proof control labels said "Simulation" instead of "Proof Run" (partial sweep) | done | (closed) | `src/proof-simulation-controls.tsx` |

### Group B — Pending UX/Label Clarity

| ID | Issue | Status | Phase |
|---|---|---|---|
| B1 | "Provisioning" tab vs "Proof Run" semantic confusion — separate tab or fold into proof-run flow? | pending | P4 |
| B2 | "Curriculum linkage candidate / Review / Approve / Reject / Regenerate" labels unclear | pending | P4 |
| B3 | "Batch binding / Save target mode / Pinned profile / Target scope" confusing — needs human-language labels | pending | P4 |
| B4 | Rounded entity rail / dropdown visual consistency pass | pending | P4 |
| B5 | One-session dismiss pattern (A6) needs to extend to all restore notices | pending | P4 |
| B6 | Linkage candidate UI must show confidence + which signal (manifest/semantic/LLM) produced it | pending | P4 |
| B7 | Provisioning UI must distinguish demo vs live (add badge, hide live action by default) | pending | P5 |
| B8 | "Retrain" terminology in UI — should be "Recalibrate" until real data exists | pending | P3 |

### Group C — Architecture / Demo Defensibility

| ID | Issue | Status | Phase |
|---|---|---|---|
| C1 | Demo data not isolated from canonical/global academic state (no `demoWorkspaceId` concept) | pending | P5 |
| C2 | `curriculumImportVersions.outcomesJson` stored but never read by `readRuntimeCurriculum` (schema.ts:284, msruas-proof-control-plane.ts:3048) | pending | P3 |
| C3 | Course outcomes generated at runtime by `coDefinitionsForCourse` (msruas-proof-control-plane.ts:1068-1077) — ignores config | pending | P3 |
| C4 | `weakCO` threshold hardcoded `tt2Pct < 50 || seePct < 45` (msruas-proof-control-plane.ts:1286) | pending | P3 |
| C5 | `prerequisiteAverage` ignores edge weight, only counts signals (msruas-proof-control-plane.ts:1601-1607) | pending | P3 |
| C6 | `edgeKind='explicit'` and `edgeKind='added'` mathematically equivalent — semantics fix didn't propagate to numerics | pending | P3 |
| C7 | No impact preview before saving config — user can't see effect of changes | pending | P3 |
| C8 | No configuration change audit log | pending | P3 |
| C9 | Active proof run + new provisioning collision rule undefined (Option A: provision then create run; Option B: stale flag; Option C: block) | pending | P5 |
| C10 | "Reset Demo Workspace" operation does not exist | pending | P5 |
| C11 | Provisioning preview ("dry run") UI does not exist | pending | P5 |
| C12 | Provisioning tab is conceptually redundant — does only `sectionOfferings` + `facultyOfferingOwnerships` + `teacherAllocations` which proof run reads | pending | P5 |
| C13 | "Retrain on save" actually only reruns deterministic simulation — naming misleading | pending | P3 |
| C14 | Rule-based inference engine impact values (0.28, 0.14, 0.2, 0.1, 0.05) hardcoded without literature anchor (inference-engine.ts:39-191) | done (P1) — anchored via `learning-dynamics-constants.ts`; engineering-tier rows disclosed | P1 |
| C15 | `ScenarioProfile` 8 families (weak-foundation etc) hardcoded with shift values not grounded in literature (msruas-proof-control-plane.ts:988-1036) | done (P1) — `scenario-grounding.md` maps each family; magnitudes deferred to P2 sensitivity sweep | P1 |

### Group D — Multi-program Scalability

| ID | Issue | Status | Phase |
|---|---|---|---|
| D1 | `MSRUAS_PROOF_DEPARTMENT_ID`, `_BRANCH_ID`, `_BATCH_ID`, `_SIMULATION_RUN_ID`, `_CURRICULUM_IMPORT_ID` hardcoded as exported constants (msruas-proof-sandbox.ts:180-184) | pending | P6 |
| D2 | USN format hardcoded `1MS23MC{nnn}` (msruas-proof-control-plane.ts:1520) | pending | P6 |
| D3 | `studentCount: 120`, `sectionCount: 2`, `semesterStart: 1`, `semesterEnd: 6` hardcoded constants (proof-control-plane-seeded-bootstrap-service.ts:159-163) | pending | P6 |
| D4 | `PROOF_FACULTY` array hardcoded for M&C | pending | P6 |
| D5 | 60+ courses baked into `air-mentor-api/src/db/seeds/msruas-mnc-curriculum.json` — no abstraction | pending | P6 |
| D6 | `scenarioProfileForSeed` not parameterizable per program | pending | P6 |
| D7 | No `proof_program_templates` table | pending | P6 |
| D8 | No second program (BTech ECE 2024) demonstration — paper claim N2 lacks evidence | pending | P6 |
| D9 | No program selector UI | pending | P6 |

### Group E — Research Paper Rigor

| ID | Issue | Status | Phase |
|---|---|---|---|
| E1 | Learning rate baseline values lack citation (Bjork, Cepeda) | done (P1) — `cepeda2006spacing`, `bjork1994memory`, `atkinson1972optimizing`, `corbett1995knowledge`, `anderson1996actr` | P1 |
| E2 | Forgetting rate values lack citation (Ebbinghaus, Pashler) | done (P1) — `ebbinghaus1885memory`, `murre2015replication`, `pashler2007organizing` | P1 |
| E3 | Attendance impact 0.28 lacks citation (Credé meta-analysis) | done (P1) — `crede2010class` ρ=0.44, `marburger2001absenteeism` | P1 |
| E4 | Risk thresholds (50%/45%) lack institutional/literature justification | done (P1) — disclosed as institutional (MSRUAS regulation) in `docs/paper-evidence/01-literature-table.md`; replaced by Bloom-derived rule in P3 | P1 |
| E5 | Intervention response model lacks citation (Tinto, Bean) | done (P1) — `tinto1993leaving`, `bean2001psychology` | P1 |
| E6 | 8 scenario families not mapped to documented retention failure modes | done (P1) — `docs/paper-evidence/scenario-grounding.md` | P1 |
| E7 | No `references.bib` exists | done (P1) — 22 entries in `docs/references.bib` | P1 |
| E8 | Distribution leak: train and validate on same generative process (PROOF_CORPUS_MANIFEST 64 worlds split randomly) | done (P2.1) — `generativeSplit` field family-disjoint per protocol B in `docs/paper-evidence/02-validation-protocol.md`; protocol A retained for in-distribution evaluation | P2 |
| E9 | No baseline models for comparison (majority class, simple logistic, RF) | partial — `baseline-v5-like` + `depth-2-tree` challenger + heuristic already exist; majority-class + 2-feature logistic still missing | P2 |
| E10 | No sensitivity analysis on critical parameters | pending | P2 |
| E11 | No adversarial validation corpus (different generative process) | pending | P2 |
| E12 | No calibration metrics (Brier, ECE, reliability diagram) | partial — Brier / ECE / slope / intercept in `RiskMetricSummary`; reliability-diagram artifact still missing | P2 |
| E13 | No bootstrap confidence intervals on AUC | pending | P2 |
| E14 | No per-feature importance via permutation | pending | P2 |
| E15 | No `docs/paper-evidence/` artifacts directory | done (P0+P1) — directory + README + `01-literature-table.md` + `scenario-grounding.md` committed | P1 |

### Group F — Recalibration Mechanism

| ID | Issue | Status | Phase |
|---|---|---|---|
| F1 | No per-program model artifact storage (one global model only) | pending | P7 |
| F2 | No `risk_model_versions` table | pending | P7 |
| F3 | No recalibration service with versioning | pending | P7 |
| F4 | No evidence comparing M&C model on ECE without recalibration vs after | pending | P7 |
| F5 | No recalibration UX (trigger button, version history, diff vs previous) | pending | P7 |
| F6 | Inference engine doesn't read active model version per program | pending | P7 |

### Group G — Render Migration + Prod Deploy

| ID | Issue | Status | Phase |
|---|---|---|---|
| G1 | No `render.yaml` IaC | pending | P8 |
| G2 | No `/health` endpoint | pending | P8 |
| G3 | Background worker may be inline web process — Render needs separation | pending | P8 |
| G4 | Env vars not migrated (`DATABASE_URL` format may differ Railway → Render) | pending | P8 |
| G5 | DB migration plan undefined (pg_dump from Railway, restore to Render) | pending | P8 |
| G6 | CORS allowed origins config for Render domain | pending | P8 |
| G7 | Cookie SameSite/Secure for cross-origin Pages → Render | pending | P8 |
| G8 | DNS / custom domain decision pending | pending | P8 |
| G9 | Rollback plan undocumented | pending | P8 |
| G10 | `verify-live-closeout.yml` partial — needs Render-specific health probes | partial | P8 |
| G11 | `scripts/check-railway-deploy-readiness.mjs` needs Render rename + Render-specific checks | partial | P8 |
| G12 | `RENDER_PUBLIC_API_URL` already supported as primary, Railway as fallback (verify) | partial | P8 |
| G13 | Frontend `.env.production` `VITE_API_BASE_URL` strategy needs lock | pending | P8 |
| G14 | Cold start latency on Render free tier — may need Starter plan | decision | P8 |

### Group H — Test Coverage / Regression Hardening

| ID | Issue | Status | Phase |
|---|---|---|---|
| H1 | No regression test asserting global academic rows unchanged after demo provisioning | pending | P5, P9 |
| H2 | No regression test for stop proof run not invalidating sysadmin session | partial (evidence found, no dedicated test) | P9 |
| H3 | No regression test for faculty session stability through proof lifecycle | pending | P9 |
| H4 | No multi-program proof run integration test | pending | P6, P9 |
| H5 | No recalibration service test | pending | P7, P9 |
| H6 | No config wire-through test (change outcome → mastery target → simulation output changes) | pending | P3, P9 |
| H7 | No edge weight wire-through test | pending | P3, P9 |
| H8 | No E2E suite (Playwright) for full demo walkthrough | pending | P9 |
| H9 | No performance baseline / regression check | pending | P9 |
| H10 | Coverage audit not performed | pending | P9 |
| H11 | Stale snapshot tests not audited | pending | P9 |

### Group I — Paper Drafting

| ID | Issue | Status | Phase |
|---|---|---|---|
| I1 | No paper outline | pending | P10 |
| I2 | No `paper/` directory with LaTeX scaffold | pending | P10 |
| I3 | No architecture diagram figure | pending | P10 |
| I4 | No baseline-comparison plot | pending | P10 |
| I5 | No sensitivity analysis plot | pending | P10 |
| I6 | No calibration plots | pending | P10 |
| I7 | No risk distribution histograms | pending | P10 |
| I8 | Methods section draft pending | pending | P10 |
| I9 | Experiments section draft pending | pending | P10 |
| I10 | Discussion / Limitations section pending | pending | P10 |
| I11 | Internal review pending | pending | P10 |
| I12 | Submission pending | pending | P10 |

### Group J — Production Scaling Seeds (post-paper)

| ID | Issue | Status | Phase |
|---|---|---|---|
| J1 | Multi-tenancy design doc absent | pending | P11 |
| J2 | Real data ingestion design doc absent | pending | P11 |
| J3 | Per-customer model versioning design doc absent (extends F1) | pending | P11 |
| J4 | Observability seeds (metrics emission scaffold) absent | pending | P11 |
| J5 | Audit log seeds extension (extends C8) absent | pending | P11 |

### Group K — Repo / Process Hygiene

| ID | Issue | Status | Phase |
|---|---|---|---|
| K1 | `air-mentor-api/dist/*` build artifacts tracked & modified — pollutes git status | done (P0) | P0 |
| K2 | `.claude/settings.local.json` modified — review what should be local-only | done (P0) — split into committed `.claude/settings.json` + gitignored `.claude/settings.local.json` | P0 |
| K3 | Modified workflow files (deploy-pages, verify-live-closeout) — commit/discard decision | done (P0) — committed as `phase(P8-prep)` with Render fallback | P0 |
| K4 | No `docs/CHANGELOG.md` for phase tracking | done (P0) | P0 |
| K5 | No `docs/CAPABILITY_MATRIX.md` (works/partial/cosmetic) | done (P0) | P0 |
| K6 | `.gitignore` should exclude `dist/` | done (P0) — explicit `air-mentor-api/dist/` + `.claude/settings.local.json` | P0 |
| K7 | Branch strategy for phase work (`research/p1-*`, etc.) | done (P0) — `docs/BRANCH_STRATEGY.md`; remote branch protection still pending manual GitHub step | P0 |
| K8 | `node_modules/.vite/*` files tracked despite gitignore — same root cause as K1 | pending (new, P0 follow-up) | P0 |

### Group L — Strategic Decisions Required

| ID | Decision | Owner | Required by phase |
|---|---|---|---|
| L1 | Product positioning A (simulation platform) vs B (real-data prediction) vs C (academic ops platform) | Raed | P0 — **default proposed: A** in `docs/POSITIONING.md`; override path documented |
| L2 | Paper venue + deadline (EDM 2027 / AIED / IEEE TLT / other) | Raed | P0 — **default proposed: EDM 2027 (~Feb 2027)**, fallback AIED 2027 / IEEE TLT, in `docs/CHANGELOG.md` top |
| L3 | Second program (ECE 2024) — required for paper claim N2 or deferred? | Raed | P6 entry |
| L4 | Render plan budget (free / starter $7 per service / standard $25) | Raed | P8 entry |
| L5 | Demo data clean-slate before P5 (snapshot+wipe accumulated test runs?) | Raed | P5 entry |
| L6 | Recalibration evidence quality bar (AUC > 0.75 / 0.80?) — paper claim language | Raed | P7 |
| L7 | Frontend Pages domain — keep github.io or custom? | Raed | P8 |
| L8 | Recalibrate vs Retrain — fully replace UI terminology or coexist? | Raed | P3 |
| L9 | Provisioning tab fate — keep with demo badge / fold into proof-run / delete? | Raed | P5 |

---

## 5. Phase Catalog

Dependency graph:
```
P0 ─┬─→ P1 ─→ P2 ───┐
    │                ├─→ P10 (paper drafting, parallel from P3 onward)
    ├─→ P3 ──┐       │
    ├─→ P4 ──┤       │
    │        ├─→ P5 ─┴─→ P6 ─→ P7 ─┐
    └─→ P8 ──┘                      ├─→ P11
             └────→ P9 ─────────────┘
```

Effort estimates assume **AI-heavy assist** (test scaffolding, refactor, doc gen).
Solo-dev unassisted multiply by ~1.7×.

---

### P0 — Truth Lock & Repo Hygiene (1 week)

**Issues addressed:** K1–K7, L1, L2, plus answering decision points L3–L9 (deferred-decision OK).

**Goal:** clean working tree, position decided, paper venue locked, master tracking docs in place.

**Tasks:**
```
0.1  Decide K1: add air-mentor-api/dist/ to .gitignore, untrack with git rm --cached -r
0.2  Decide K2: split .claude/settings.local.json (commit shared, gitignore local)
0.3  Decide K3: commit workflow tweaks under separate commit, or stash/discard
0.4  Create docs/CAPABILITY_MATRIX.md  (every feature: works/partial/cosmetic/broken)
0.5  Create docs/CHANGELOG.md  (phase log scaffold)
0.6  Create docs/paper-evidence/ directory + README
0.7  Answer L1 (positioning) → write 1-page in docs/POSITIONING.md
0.8  Answer L2 (paper venue + deadline) → write to top of docs/CHANGELOG.md
0.9  Set branch strategy: protect main, create research/p1-literature etc as needed
0.10 git status clean
```

**Exit criteria:**
- `git status` shows clean working tree
- docs/MASTER_ROADMAP_2026-05-01.md, docs/CAPABILITY_MATRIX.md, docs/POSITIONING.md, docs/CHANGELOG.md committed
- L1, L2 decided

**AI leverage:** high (status analysis, capability matrix scaffold, doc generation)

---

### P1 — Literature Foundation (2-3 weeks)

**Issues addressed:** C14, C15, E1–E7, E15

**Goal:** every magic number in inference + scenario engine has literature anchor or honest disclosure. Paper Methods section grounding writeable.

**Tasks:**
```
1.1  Literature scan, 6 themes (1 week)
     - Learning rate / mastery dynamics: Atkinson, Corbett-Anderson, Bjork
     - Forgetting / retention: Ebbinghaus, Murre-Dros, Pashler
     - Attendance → outcome: Credé meta-analysis, Marburger
     - Risk / dropout: Tinto, Bean-Eaton, Astin
     - EDM baselines: Romero-Ventura survey, Aldowah, Bujang
     - Multi-program transfer: Hunt et al.
     Output: docs/paper-evidence/01-literature-table.md (Parameter | Current | Source | Citation)

1.2  Create air-mentor-api/src/lib/learning-dynamics-constants.ts (week 2)
     Each constant: JSDoc with citation key
     Example:
     /** Forgetting per day. Cepeda et al 2006 ~7%/day. @bib cepeda2006spacing */
     export const DAILY_FORGETTING_RATE = 0.07

1.3  Refactor inference-engine.ts:39-191 to reference named constants (week 2)
     Each impact value (0.28, 0.14, 0.2, 0.1, 0.05) → named const + citation
     Unanchored ones → marked TODO + flagged in paper limitations

1.4  Map 8 scenario families to literature (week 3)
     msruas-proof-control-plane.ts:988-1036
     family               literature anchor
     weak-foundation   →  Tinto academic integration failure
     low-attendance    →  Credé attendance-grade r=0.41
     high-forgetting   →  Pashler spacing failure
     coursework-inflation → Astin involvement overload
     exam-fragility    →  test anxiety lit (Zeidner)
     carryover-heavy   →  Tinto cumulative cascade
     intervention-resistant → Bean psychological barriers
     balanced          →  control / null
     Output: docs/paper-evidence/scenario-grounding.md

1.5  Build docs/references.bib (≥ 15 entries)

1.6  Audit risk thresholds (50% / 45% etc) → MSRUAS academic policy or institutional convention disclosure
```

**Files created:**
```
air-mentor-api/src/lib/learning-dynamics-constants.ts
docs/references.bib
docs/paper-evidence/01-literature-table.md
docs/paper-evidence/scenario-grounding.md
```

**Files modified:**
```
air-mentor-api/src/lib/inference-engine.ts
air-mentor-api/src/lib/msruas-proof-control-plane.ts
air-mentor-api/src/lib/proof-risk-model.ts
```

**Tests added:**
```
air-mentor-api/tests/learning-dynamics-constants.test.ts
  - assert constants in literature-supported ranges
```

**Exit criteria:**
- Every inference impact value has citation OR is marked unanchored
- 8 scenario families have literature mapping
- references.bib ≥ 15 entries
- Methods §"Parameter Grounding" draft committed

---

### P2 — Validation Methodology Fix (1-2 weeks)

**Issues addressed:** E8–E14, partially Q from chat re distribution leak

**Goal:** train/val/test split that survives reviewer scrutiny; baseline comparisons; sensitivity sweep.

**Tasks:**
```
2.1  Generative-Process Split (week 1)
     Split 8 scenario families:
       train families:   weak-foundation, low-attendance, high-forgetting, coursework-inflation
       val families:     exam-fragility, carryover-heavy
       test families:    intervention-resistant, balanced
     Modify proof-risk-model.ts PROOF_CORPUS_MANIFEST: add `split` per row
     trainLogisticBaseCompact() reads only train splits
     Separate evaluate functions for val/test

2.2  Baseline models in air-mentor-api/src/lib/baseline-models.ts (week 1)
     Baseline 1: majority-class predictor
     Baseline 2: logistic on (attendance, CGPA) only
     Baseline 3: random forest on top-5 features
     Baseline 4: full model
     Evaluate all on test families

2.3  Sensitivity sweep scripts/sensitivity-sweep.ts (week 2)
     Each critical parameter ±20%
     Report AUC delta

2.4  Adversarial corpus air-mentor-api/src/lib/adversarial-corpus.ts (week 2 stretch)
     Different generative process (e.g., power-law forgetting instead of exponential)
     Evaluate, document boundary of generalization

2.5  Calibration metrics
     Brier score, Expected Calibration Error, reliability diagram
     Per-split reporting
```

**Files created:**
```
air-mentor-api/src/lib/baseline-models.ts
air-mentor-api/src/lib/adversarial-corpus.ts
scripts/sensitivity-sweep.ts
docs/paper-evidence/02-validation-protocol.md
docs/paper-evidence/03-baseline-results.md
docs/paper-evidence/04-sensitivity-analysis.md
```

**Files modified:**
```
air-mentor-api/src/lib/proof-risk-model.ts
```

**Tests added:**
```
air-mentor-api/tests/baseline-models.test.ts
air-mentor-api/tests/validation-split.test.ts
```

**Exit criteria:**
- Train/val/test family split implemented
- 4 baselines evaluated on test families with table output
- Sensitivity sweep CSV/markdown generated
- Calibration metrics per split
- Paper Experiments section data ready

---

### P3 — Config → Simulation Wire-up (2-3 weeks)

**Issues addressed:** B8, C2–C8, C13, H6, H7

**Goal:** every UI configuration that user can change actually affects numerical output. Demo passes "show me change effect" test.

**Tasks:**
```
3.1  Schema extensions (week 1)
     air-mentor-api/src/db/schema.ts
       curriculumNodes:
         + outcomeBloomLevel: enum('remember','understand','apply','analyze','evaluate','create')
         + outcomeMasteryTarget: real (0-1)  -- derived from level or override
       curriculumEdges:
         + weight: real default 1.0
         + weightOverride: real nullable
     Drizzle migration generated + reviewed

3.2  Course outcome → mastery target (week 1-2)
     msruas-proof-control-plane.ts:1068-1077
     coDefinitionsForCourse() reads outcomeBloomLevel
     Bloom → target mapping:
       remember/understand → 0.50
       apply              → 0.60
       analyze            → 0.70
       evaluate           → 0.80
       create             → 0.90

3.3  weakCO threshold parameterized (week 2)
     msruas-proof-control-plane.ts:1286
     was: tt2Pct < 50 || seePct < 45
     new: mastery < (target * 0.85)

3.4  Edge weight wire-up (week 2)
     msruas-proof-control-plane.ts:1601-1607
     prerequisiteAverage() weighted by edge.weight
     edgeKind default mapping:
       explicit → 1.0
       added    → 0.5
     overridable per-edge

3.5  Impact preview endpoint (week 2-3)
     POST /api/admin/batches/:batchId/curriculum-feature-config/preview
     body: proposed config
     response: { currentDistribution, projectedDistribution, delta, affectedStudents[] }
     Uses lightweight inference (not full simulation rerun) for sub-second response

3.6  Impact preview UI (week 3)
     src/components/config-impact-preview.tsx
     Save button disabled until preview shown
     Display before/after risk distribution

3.7  Recalibrate vs Retrain naming (week 3)
     UI sweep: "Retrain" → "Recalibrate"
     Endpoint rename: /retrain → /recalibrate
     docs/MODEL_LIFECYCLE.md explains semantics

3.8  Configuration change audit log (week 3)
     New table: configChangeAudits
     columns: id, actor, before_json, after_json, affected_batches, projected_delta, applied_at
     UI: "Configuration history" panel
```

**Files created:**
```
src/components/config-impact-preview.tsx
air-mentor-api/src/modules/curriculum-config-preview.ts
docs/MODEL_LIFECYCLE.md
air-mentor-api/src/db/migrations/xxx-curriculum-extensions.sql
air-mentor-api/src/db/migrations/xxx-config-change-audits.sql
```

**Files modified:**
```
air-mentor-api/src/db/schema.ts
air-mentor-api/src/lib/msruas-proof-control-plane.ts
air-mentor-api/src/modules/admin-structure.ts
src/system-admin-live-app.tsx
src/system-admin-proof-dashboard-workspace.tsx
```

**Tests added:**
```
tests/config-impact-preview.test.tsx
tests/curriculum-feature-wire-through.test.ts
  - change outcome target → assert mastery threshold delta
  - change edge weight → assert prerequisite average delta
air-mentor-api/tests/curriculum-config-preview-route.test.ts
```

**Exit criteria:**
- Change course outcome in UI → simulation output numerically differs
- Change edge weight → prerequisite average differs
- Save config shows impact preview before commit
- "Retrain" terminology removed from UI; replaced with "Recalibrate"
- Config change history queryable

---

### P4 — UX Label & Concept Clarity Sweep (1-2 weeks)

**Issues addressed:** B1–B6, A7 finalize

**Goal:** every UI label self-explains; demo walkthrough passes "what does this do" test.

**Tasks:**
```
4.1  Linkage UI sweep (week 1)
     "Curriculum linkage candidates" → "Prerequisite suggestions"
     "Regenerate selected course" → "Re-suggest prerequisites for [course]"
     "Approve" → "Accept suggested prerequisite"
     "Reject" → "Reject suggestion"
     "Manually add prerequisite" button new
     Each suggestion shows confidence + source signal:
       "92% — official curriculum manifest"
       "67% — topic similarity"
       "78% — AI suggestion (qwen2.5:7b)"

4.2  Binding/scope/profile UI sweep (week 1)
     Replace technical labels with action-oriented:
     
     "Apply this configuration to:"
       ◯ Just this batch
       ◯ All batches in this department
       ◯ All batches in this branch
       ◯ Override with a specific profile [dropdown]
     
     "If multiple configurations exist, prefer:"
       ◯ Most specific (batch-level)
       ◯ Department default
       ◯ This pinned profile [dropdown]
     
     Advanced settings collapsed by default

4.3  Visual consistency pass (week 2)
     Rounded radius / shadow / spacing audit
     Status badge colors: queued (gray) / running (blue) / completed (green) / failed (red)

4.4  Restore-notice dismiss pattern broadened (week 2)
     Extract useDismissibleSessionNotice hook
     Apply to all restore notices (not just proof playback)

4.5  Tooltip pass
     Every confusing term in sysadmin UI gets hover tooltip
     Especially: scenario family, scope profile, recalibrate
```

**Files created:**
```
src/hooks/use-dismissible-session-notice.ts
src/components/linkage-suggestion-card.tsx (with confidence + source)
```

**Files modified:**
```
src/system-admin-live-app.tsx
src/system-admin-ui.tsx
src/system-admin-proof-dashboard-workspace.tsx
src/proof-simulation-controls.tsx
```

**Tests added:**
```
tests/linkage-suggestion-display.test.tsx
tests/binding-mode-ui.test.tsx
tests/dismissible-session-notice.test.ts
```

**Exit criteria:**
- Manual demo walkthrough: every label self-explains without external context
- Linkage suggestion shows confidence + source
- Advanced settings folded by default
- Visual QA pass per pixel

---

### P5 — Demo Isolation Layer (1-2 weeks)

**Issues addressed:** B7, C1, C9–C12, H1, L9

**Goal:** Demo provisioning capability proven safely. Same code path, disposable target.

**Tasks:**
```
5.1  Demo workspace concept (week 1)
     New table demoWorkspaces (id, name, owner, createdAt)
     All mutable demo rows tagged with demoWorkspaceId
     Migration: add demoWorkspaceId column to all relevant tables
       sectionOfferings, facultyOfferingOwnerships, teacherAllocations,
       simulationRuns, studentBehaviorProfiles, etc.

5.2  Provision Demo Batch flow (week 1)
     POST /api/admin/demo-workspaces
     POST /api/admin/demo-workspaces/:id/provision
       body: { sectionLabels, studentsPerSection, faculty selections }
       runs same provisioning service path
       all writes scoped to demoWorkspaceId
     Backend rejects writes to canonical/global IDs in demo mode

5.3  Provisioning preview (dry run) (week 1-2)
     POST /api/admin/demo-workspaces/:id/provision/preview
     returns plan: terms, sections, students, mentor assignments, offerings
     no writes

5.4  Reset demo workspace (week 2)
     DELETE /api/admin/demo-workspaces/:id
     deletes all rows where demoWorkspaceId = ?
     leaves global / live data untouched

5.5  Active proof run + provisioning collision rule (week 2)
     Adopt Option A from chat: provision first, then create proof run
     UI flow: Demo workspace → Provision → Create Proof Run From Demo Batch → Reset
     If active proof run exists when provision attempted: surface "Reset proof run first"

5.6  Demo badge UI (week 2)
     Top bar: "Demo workspace · disposable data"
     Confirmation dialog on every mutating action: "Modifies demo data only"

5.7  Decision L9 implementation
     Provisioning tab fate per L9 decision:
       option keep: keep with badge + isolation
       option fold: move provisioning into proof-run creation wizard
       option delete: remove tab entirely
```

**Files created:**
```
air-mentor-api/src/lib/demo-workspace-service.ts
air-mentor-api/src/db/migrations/xxx-demo-workspaces.sql
src/components/demo-workspace-badge.tsx
```

**Files modified:**
```
air-mentor-api/src/db/schema.ts
air-mentor-api/src/lib/academic-provisioning.ts (require demoWorkspaceId)
src/system-admin-faculties-workspace.tsx
src/system-admin-ui.tsx
```

**Tests added:**
```
air-mentor-api/tests/demo-isolation.test.ts  (CRITICAL)
  - snapshot global academic row counts (studentAcademicProfiles, studentEnrollments,
    mentorAssignments, courseOfferings, teacherAllocations, curriculumCourses,
    academicTerms, facultyOwnerships)
  - run demo provisioning + proof run + reset
  - assert global counts unchanged

air-mentor-api/tests/demo-workspace-reset.test.ts
  - reset deletes all demo rows
  - leaves orphan-free state

tests/provisioning-preview.test.tsx
```

**Exit criteria:**
- Reset demo workspace deletes demo rows, leaves global untouched (proven by snapshot test)
- Provisioning without demoWorkspaceId rejected
- UI shows demo badge + reset button
- L9 decision implemented

---

### P6 — Multi-program Template Architecture (3 weeks)

**Issues addressed:** D1–D9, L3, partial H4

**Goal:** M&C 2023 from hardcoded constants → DB-driven template. Second program (ECE 2024) demonstrated end-to-end. Paper claim N2 has evidence.

**Tasks:**
```
6.1  proofProgramTemplates schema (week 1)
     CREATE TABLE proof_program_templates (
       id text primary key,                  -- 'mnc-2023', 'ece-2024'
       name text,
       department_id text,
       branch_id text,
       batch_id text,
       usn_format text,                      -- '1MS{yy}MC{nnn}'
       semester_count integer,
       section_count integer,
       student_count integer,
       scenario_family_set jsonb,            -- which families apply
       curriculum_seed_path text,            -- 'seeds/mnc.json'
       assessment_pattern text,              -- 'tt1+tt2+see'
       time_model text,                      -- 'semester' or 'trimester'
       realism_parameters jsonb,             -- per-program param overrides
       active boolean default true
     )

6.2  Migrate M&C from constants to template (week 1-2)
     Insert template row for mnc-2023
     Replace all MSRUAS_PROOF_* references with readProgramTemplate(programId).x
     msruas-proof-sandbox.ts:180-184 → delete, route through template service
     air-mentor-api/src/lib/program-template-service.ts (new)

6.3  USN generation parameterized (week 2)
     formatUsn(template.usn_format, { yy, nnn, branchCode })
     Template syntax: {key} placeholders

6.4  Curriculum loader generic (week 2)
     readRuntimeCurriculum(programId) → reads template.curriculum_seed_path
     Multiple JSON files supported

6.5  Scenario families per program (week 2)
     scenarioProfileForProgram(programId, seed)
     Reads template.scenario_family_set
     Different programs may have different family subsets

6.6  Add second program: BTech ECE 2024 (week 3)
     air-mentor-api/src/db/seeds/msruas-ece-curriculum.json
       Minimum viable: 30+ courses across 6 semesters
       ECE-specific scenario families if applicable
     INSERT proof_program_template row for 'ece-2024'
     Run full pipeline: provisioning → proof run → recalibration preview
     Document in docs/paper-evidence/05-multi-program-evidence.md

6.7  Program selector UI (week 3)
     Sysadmin can switch active program
     Demo workspace tied to one program at a time
     src/components/program-selector.tsx
```

**Files created:**
```
air-mentor-api/src/db/migrations/xxx-program-templates.sql
air-mentor-api/src/db/seeds/msruas-ece-curriculum.json
air-mentor-api/src/lib/program-template-service.ts
src/components/program-selector.tsx
docs/paper-evidence/05-multi-program-evidence.md
```

**Files modified (extensive):**
```
air-mentor-api/src/lib/msruas-proof-sandbox.ts
air-mentor-api/src/lib/msruas-proof-control-plane.ts
air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts
air-mentor-api/src/lib/proof-control-plane-runtime-service.ts
... (~15+ files referencing MSRUAS_PROOF_*)
```

**Tests added:**
```
tests/program-template.test.ts
tests/multi-program-proof-run.test.ts
  - run end-to-end on M&C 2023 (regression)
  - run end-to-end on ECE 2024 (new)
```

**Exit criteria:**
- M&C 2023 fully template-driven (no MSRUAS_PROOF_* exported constants)
- ECE 2024 runs full pipeline without code changes (only new template row + JSON)
- Adding hypothetical third program = INSERT row + JSON, no code change
- Multi-program evidence document committed

---

### P7 — Adaptive Recalibration Mechanism (2-3 weeks)

**Issues addressed:** F1–F6, L6, partially H5

**Goal:** "Adaptable model" claim N2 has empirical evidence. Per-program model versioning operational.

**Tasks:**
```
7.1  risk_model_versions schema (week 1)
     CREATE TABLE risk_model_versions (
       id uuid primary key,
       program_id text references proof_program_templates(id),
       version integer,
       weights_json jsonb,
       metrics_json jsonb,
       trained_at timestamp,
       active boolean
     )

7.2  Recalibration service (week 1)
     air-mentor-api/src/lib/recalibration-service.ts
     POST /api/admin/programs/:programId/recalibrate
     Pipeline:
       1. Generate program-specific synthetic corpus (uses template scenario_family_set)
       2. Fit logistic regression weights on corpus train split
       3. Evaluate on validation families
       4. Save as risk_model_versions row
       5. Optionally promote to active

7.3  Per-program model lookup in inference (week 2)
     proof-risk-model.ts: read active model for programId
     Apply weights to features

7.4  Recalibration evidence experiments (week 2)
     Experiment 1: Baseline (M&C model)
       Train on M&C corpus, eval on M&C test families. Report AUC.
     Experiment 2: Cross-program (no calibration)
       Apply M&C model to ECE corpus. Report AUC. Expect drop.
     Experiment 3: Cross-program (recalibrated)
       Recalibrate on ECE corpus. Report AUC. Expect recovery.
     Output: docs/paper-evidence/06-recalibration-results.md

7.5  Confidence bounds (week 2-3)
     Bootstrap CIs on AUC (1000 resamples)
     Per-feature importance via permutation
     Calibration plots per program

7.6  Recalibration UX (week 3)
     src/components/model-recalibration-panel.tsx
     - "Recalibrate now" button
     - Current model version, last trained, metrics
     - Previous versions with diff
     - Rollback capability
```

**Files created:**
```
air-mentor-api/src/lib/recalibration-service.ts
air-mentor-api/src/db/migrations/xxx-risk-model-versions.sql
src/components/model-recalibration-panel.tsx
docs/paper-evidence/06-recalibration-results.md
```

**Files modified:**
```
air-mentor-api/src/lib/proof-risk-model.ts
air-mentor-api/src/db/schema.ts
```

**Tests added:**
```
tests/recalibration-service.test.ts
  - recalibrate creates new version
  - inference uses active version
  - rollback works
  - cross-program transfer evidence
```

**Exit criteria:**
- Recalibration produces new versioned model artifact per program
- Inference reads program-specific active model
- Evidence: M&C model on ECE underperforms; ECE-recalibrated model recovers
- Bootstrap CIs reported (e.g., "AUC 0.78 ± 0.04 95% CI")
- Paper claim N2 quantitatively backed

---

### P8 — Render Migration & Production Deploy Contract (1-2 weeks)

**Issues addressed:** G1–G14, L4, L7

**Goal:** Production backend on Render, frontend on GitHub Pages, end-to-end verified.

**Tasks:**
```
8.1  Render service mapping (day 1)
     - Web Service: air-mentor-api (Node)
     - Background Worker: air-mentor-worker (proof run queue processor)
     - Postgres: air-mentor-db
     - Optional Cron: cleanup jobs

8.2  air-mentor-api/render.yaml (day 1-2)
     services:
       - type: web
         name: air-mentor-api
         env: node
         buildCommand: npm install && npm run build
         startCommand: node dist/index.js
         healthCheckPath: /health
         envVars:
           - key: DATABASE_URL
             fromDatabase: { name: air-mentor-db, property: connectionString }
           - key: NODE_ENV
             value: production
           - ...
       - type: worker
         name: air-mentor-worker
         env: node
         buildCommand: npm install && npm run build
         startCommand: node dist/proof-run-worker.js
         envVars: ...
     databases:
       - name: air-mentor-db
         databaseName: air_mentor
         plan: starter   # per L4 decision

8.3  Health check endpoint (day 2-3)
     air-mentor-api/src/routes/health.ts
     GET /health
     checks: DB connectivity, worker lease state, queue depth
     returns 200 + JSON status

8.4  Background worker separated as own process (day 3)
     Currently may be inline in web — Render requires separate Node process
     Create air-mentor-api/src/proof-run-worker.ts entry
     Refactor split between web app and worker startup logic

8.5  Env var migration (day 3-4)
     Map Railway env list → Render env list
     Handle DATABASE_URL format differences
     PORT auto-injected by Render

8.6  GitHub Pages frontend update (day 4)
     .env.production
       VITE_API_BASE_URL = RENDER_PUBLIC_API_URL
     .github/workflows/deploy-pages.yml: ensure RENDER_PUBLIC_API_URL primary

8.7  CORS + cookie config (day 4)
     Backend CORS allowlist: GitHub Pages origin (raedansari.github.io or custom)
     Cookie SameSite=None; Secure for cross-origin

8.8  Database migration (day 5)
     pg_dump from Railway (after app paused)
     pg_restore to Render
     Verify extensions (uuid-ossp, etc.)
     Verify connection pool config
     Verify backup schedule

8.9  DNS / custom domain (day 5)
     Per L7: keep raedansari.github.io OR custom (e.g., airmentor.app)
     If custom: api.airmentor.app CNAME → render

8.10 verify-live-closeout.yml refresh (day 6)
     Health probe on Render URL
     Login + session check
     Proof run smoke test

8.11 scripts/check-render-deploy-readiness.mjs (day 6)
     Rename from check-railway-deploy-readiness.mjs
     Render-specific health probes

8.12 Rollback plan (day 7)
     docs/ROLLBACK_PLAN.md
     - Railway kept paused for N days as backup
     - DNS switchback procedure
     - DB sync strategy during transition
```

**Files created:**
```
air-mentor-api/render.yaml
air-mentor-api/src/proof-run-worker.ts (entry)
air-mentor-api/src/routes/health.ts
scripts/check-render-deploy-readiness.mjs
docs/RENDER_MIGRATION.md
docs/ROLLBACK_PLAN.md
```

**Files modified:**
```
.github/workflows/deploy-pages.yml
.github/workflows/verify-live-closeout.yml
air-mentor-api/src/index.ts (web/worker split)
air-mentor-api/src/config.ts (Render env handling)
.env.production (frontend)
```

**Exit criteria:**
- Render staging deploy success
- Health endpoint returns 200
- Background worker processes queued proof runs
- Frontend on Pages communicates with Render API
- Login + role switch works cross-origin
- Proof run end-to-end works on prod
- DB migration verified (row count match)
- Rollback plan documented

---

### P9 — Test Coverage & Regression Hardening (2 weeks)

**Issues addressed:** H1–H11

**Goal:** Critical paths protected by regression net. Coverage acceptable for post-paper iteration.

**Tasks:**
```
9.1  Coverage audit (week 1)
     npx vitest run --coverage
     Target: critical paths ≥ 80%
       - inference engine
       - recalibration service
       - demo isolation
       - program template service

9.2  Critical regression tests (week 1)
     air-mentor-api/tests/critical/
       demo-isolation.test.ts          (P5 reinforce)
       multi-program.test.ts           (P6 reinforce)
       recalibration.test.ts           (P7 reinforce)
       config-wire-through.test.ts     (P3 reinforce)
       proof-run-lifecycle.test.ts
       faculty-session-stability.test.ts (H3)
       stop-proof-no-logout.test.ts    (H2)
       render-deploy-smoke.test.ts

9.3  E2E suite — Playwright (week 1-2)
     tests-e2e/demos/
       proof-run-end-to-end.spec.ts
       config-impact-preview.spec.ts
       multi-program-switch.spec.ts
       linkage-review.spec.ts
       demo-reset.spec.ts
       login-roleswitch.spec.ts

9.4  Performance baseline (week 2)
     scripts/perf-baseline.ts
     Measure: proof run execution time (cold/warm), inference latency p50/p99,
              hot DB query latency
     baseline.json checked in
     CI fails if regression > 20%

9.5  Snapshot test audit (week 2)
     Review all snapshots
     Update for current UI
     Delete stale
```

**Files created:**
```
air-mentor-api/tests/critical/*.test.ts
tests-e2e/demos/*.spec.ts
scripts/perf-baseline.ts
playwright.config.ts (if not exists)
```

**Exit criteria:**
- Coverage ≥ 80% on critical paths
- E2E suite green on staging
- Perf baseline locked in CI
- Snapshot tests current

---

### P10 — Paper Drafting & Submission (3-4 weeks, parallel from P3 onward)

**Issues addressed:** I1–I12

**Goal:** Paper submitted to chosen venue (per L2).

**Tasks:**
```
10.1 Outline (week 1)
     paper/main.tex
     paper/sections/
       introduction.tex
       related-work.tex
       methodology.tex      (P1 evidence)
       experiments.tex      (P2 + P6 + P7 evidence)
       discussion.tex
       conclusion.tex

10.2 Methods + Experiments draft (week 2-3)
     Pull from docs/paper-evidence/01–06
     Specifically:
       - Parameter grounding (P1)
       - Generative-process split (P2)
       - Baselines + sensitivity (P2)
       - Multi-program transfer (P6)
       - Recalibration evidence (P7)

10.3 Figures (week 3)
     scripts/paper-figures/
       architecture-diagram.py
       baseline-comparison.py
       sensitivity-plot.py
       calibration-plot.py
       risk-distribution.py

10.4 Limitations + Future Work (week 3)
     Honest disclosure:
       - synthetic data only, no real-data validation
       - single institution proxy
       - undergrad semester-only tested
       - rule-based inference paths (acknowledge)
     Future work refs J1–J5 design docs (P11)

10.5 Internal review (week 4)
     Advisor / supervisor pass
     Address comments

10.6 Submission per venue format (week 4)
```

**Files created:**
```
paper/main.tex
paper/sections/*.tex
paper/figures/*.pdf
scripts/paper-figures/*.py
```

**Exit criteria:**
- Paper draft complete
- All figures generated from real experiment data
- Limitations honest, no overclaim
- Submitted to venue per L2

**AI leverage:** medium for LaTeX mechanical, low for claims/limitations (must be human-written)

---

### P11 — Production Scaling Seeds (1-2 weeks, post-paper)

**Issues addressed:** J1–J5

**Goal:** Architecture extension points designed (not implemented). Paper Future Work section can reference real designs.

**Tasks:**
```
11.1 docs/architecture/MULTI_TENANCY.md
     - per-customer schema vs row-level security
     - data isolation guarantees
     - migration strategy from current single-tenant

11.2 docs/architecture/DATA_INGESTION.md
     - CSV upload contract
     - schema mapping (customer fields → system fields)
     - validation pipeline
     - quarantine model for bad rows

11.3 docs/architecture/MODEL_VERSIONING.md
     Extends F-group implementations
     - model artifact storage (S3/disk)
     - rollback semantics
     - calibration vs retraining boundary

11.4 air-mentor-api/src/lib/metrics.ts
     Minimal metrics emission scaffold (Prometheus-compatible)
     - inference latency histogram
     - proof run duration
     - DB query times

11.5 docs/architecture/AUDIT_LOG.md
     Extends C8 (configChangeAudits)
     - retention
     - PII handling
     - export format
```

**Files created:**
```
docs/architecture/*.md
air-mentor-api/src/lib/metrics.ts (scaffold)
```

**Exit criteria:**
- 4 design docs committed
- Metrics emission scaffold in place
- Paper Future Work references live docs

---

### P12 — First Pilot Conversion Readiness (deferred, post-paper)

**Goal:** Convert post-paper artifacts into a sales-ready pilot offering. Mostly product/sales work, light engineering.

**Tasks (sketched, refined when pilot opportunity surfaces):**
```
- Sales deck per L1 positioning
- Onboarding runbook
- Pilot success metrics
- SLA scoping (uptime, response time)
- Contract / data-handling agreement template
```

---

## 6. Cross-cutting Concerns

### 6.1 Verification Discipline

Every phase exit must run:
```
# Frontend
cd /home/raed/projects/air-mentor-ui
npx vitest run --reporter=dot
npx tsc -p tsconfig.app.json --noEmit

# Backend
cd /home/raed/projects/air-mentor-ui/air-mentor-api
npx vitest run --reporter=dot
npx tsc -p tsconfig.json --noEmit
```

Each phase must produce ≥ 1 new regression test.

### 6.2 Git Discipline

Branch strategy:
```
main
research/p1-literature
research/p2-validation
research/p3-wireup
...
```

Commit message convention:
```
phase(P1): literature-anchor learning rates [paper]
phase(P3): wire course outcomes to mastery target
phase(P8): migrate backend to render
```

### 6.3 Paper Evidence Tracking

`docs/paper-evidence/`:
```
01-literature-table.md         (P1)
scenario-grounding.md          (P1)
02-validation-protocol.md      (P2)
03-baseline-results.md         (P2)
04-sensitivity-analysis.md     (P2)
05-multi-program-evidence.md   (P6)
06-recalibration-results.md    (P7)
methods-section-draft.md       (P10)
```

### 6.4 Update Cadence For This Roadmap

When phase task done → update §4 status + add `docs/CHANGELOG.md` entry.
When new issue surfaces → add to §4 with new ID + map to a phase.
Quarterly review of Tier ranking (§1) and positioning (L1).

---

## 7. AI Leverage Strategy

### 7.1 Per-phase AI vs human balance

| Phase | AI use | Human required |
|---|---|---|
| P0 | Capability matrix scaffold, status analysis | Positioning decision, venue lock |
| P1 | Literature search + bibtex, refactor | Literature interpretation, cite quality |
| P2 | Code, scripts, metrics implementation | Methodology decisions |
| P3 | Schema, wire-up, tests | Bloom-mastery mapping numbers |
| P4 | Label sweep, tooltip generation | Tooltip tone/voice |
| P5 | Schema, isolation tests | Invariant design |
| P6 | Refactor mechanics, ECE seed scaffold | ECE realism review |
| P7 | Pipeline, CI calc, UX scaffold | Claim language, recalibration evidence interpretation |
| P8 | render.yaml, scripts, migration mechanics | Production cutover gate |
| P9 | Test scaffolding (huge speedup) | Critical path identification |
| P10 | LaTeX mechanical, figure code | Claims, limitations, narrative |
| P11 | Doc scaffolds | Architecture decisions |

### 7.2 AI collaboration rules

```
1. Architectural decisions: AI gives options, you pick.
2. Every AI-generated code path must run a test.
3. Paper claims are written human-first; AI used only for polish.
4. Refactors: must view diff before commit.
5. AI-generated tests must include 1 intentionally failing case to verify they test something.
6. Literature: AI for candidates, human reads originals.
7. Status reports: human-written. Don't let AI summarize your own work.
```

### 7.3 Weekly cadence template

```
Mon         AI-heavy: phase plan refine, test scaffolding batch, refactor mechanical
Tue–Thu     Implementation: AI-assist with per-step verification
Fri         Human-only: week review, architecture decisions, paper writing, next-week plan
```

---

## 8. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Literature has no perfect parameter match (P1) | medium | medium | Mark "closest analogue", disclose in paper |
| AUC drops sharply after distribution leak fix (P2) | high | medium | Expected; report honestly. May reveal smaller true gap. |
| Wire-up breaks existing tests (P3) | medium | low | Incremental + per-step test |
| ECE seed unrealistic (P6) | medium | medium | Same literature grounding as M&C, ECE-specific failure modes |
| Render data migration loss (P8) | low | high | Dump+verify+rollback plan |
| Paper rejection (P10) | medium | medium | Have downward-venue fallback; iterate |
| Scope creep | high | high | Strict phase gates, exit criteria binding |
| AI hallucinated logic shipped | medium | medium | Mandatory diff review + tests |
| Solo dev burnout | medium | high | Weekly checkpoints, buffer time, no-AI-Friday |
| Distribution leak fix exposes weak engine | medium | medium | Pivot paper claim to "framework + sensitivity" |
| ECE curriculum data unavailable | medium | medium | Fall back to small synthetic ECE-like 30-course program |
| Render cold-start kills demo experience (G14) | medium | low | Upgrade to Starter plan or warmup ping |

---

## 9. Timeline & Decision Points

### 9.1 Compressed timeline (AI heavy assist)

Working back from paper deadline T (per L2):
```
T - 17 weeks: P0 (1w)
T - 16 weeks: P1 start
T - 14 weeks: P1 done; P2 start; P10 outline
T - 13 weeks: P2 done; P3 + P4 parallel; P10 Methods drafting
T - 11 weeks: P3 + P4 done; P5 start
T - 10 weeks: P5 done; P6 start
T -  8 weeks: P6 done; P7 start; P10 Experiments drafting
T -  6 weeks: P7 done; P10 polish + figures
T -  3 weeks: P10 internal review
T -  1 week:  P10 submit

Post-paper:
T +  1 week:  P8 Render migration
T +  3 weeks: P9 test hardening
T +  4 weeks: P11 prod seeds
T +  6 weeks: P12 sketched
```

### 9.2 Decision points (must answer before phase entry)

| Decision | Phase entry blocked | Notes |
|---|---|---|
| L1: Positioning A/B/C | P0 exit | Drives everything. Default A for college project. |
| L2: Paper venue + deadline | P0 exit | Drives timeline compression |
| L3: ECE 2024 required? | P6 entry | If deferred → paper claim N2 weakened |
| L4: Render plan budget | P8 entry | Free tier has cold start. Starter ($7/mo per service) recommended. |
| L5: Demo data clean-slate before P5? | P5 entry | Recommend yes — snapshot then wipe accumulated test runs |
| L6: Recalibration AUC bar | P7 closeout | Determines paper claim language |
| L7: Frontend domain | P8 entry | Pages github.io vs custom |
| L8: Recalibrate vs Retrain coexist? | P3 entry | Recommend full replace |
| L9: Provisioning tab fate | P5 entry | Recommend fold-into-proof-run + demo isolation |

---

## 10. Traceability Matrix (issue → phase)

```
A1–A7   → closed
B1      → P4
B2      → P4
B3      → P4
B4      → P4
B5      → P4
B6      → P4
B7      → P5
B8      → P3
C1      → P5
C2–C8   → P3
C9–C12  → P5
C13     → P3
C14–C15 → P1
D1–D9   → P6
E1–E7   → P1
E8–E14  → P2
E15     → P1
F1–F6   → P7
G1–G14  → P8
H1      → P5, P9
H2–H3   → P9
H4      → P6, P9
H5      → P7, P9
H6–H7   → P3, P9
H8–H11  → P9
I1–I12  → P10
J1–J5   → P11
K1–K7   → P0
L1–L9   → decision points (gate phase entry)
```

---

## 11. Verification Discipline (reusable checklist per phase)

```
Phase: ____
Branch: research/p_-____
Started: ____
Targeted exit: ____

[ ] All tasks complete per §5
[ ] Exit criteria met
[ ] New regression tests added (≥1)
[ ] All existing tests still pass:
    [ ] frontend vitest
    [ ] frontend tsc
    [ ] backend vitest
    [ ] backend tsc
[ ] §4 issue statuses updated
[ ] docs/CHANGELOG.md entry added
[ ] Paper evidence file added (if applicable)
[ ] Diff reviewed (no AI hallucination shipped)
[ ] PR created and self-merged or peer-reviewed
[ ] Branch merged to main
```

---

## 12. Glossary

| Term | Definition |
|---|---|
| Proof Run | Deterministic simulation of 120 student trajectories across 6 semesters. Generates evidence, risk, intervention rows. |
| Provisioning | Creates `sectionOfferings` + `facultyOfferingOwnerships` + `teacherAllocations` rows. Currently exposed as separate tab; P5 may fold into proof-run flow. |
| Curriculum Linkage | Text-matching algorithm proposing prerequisite edges (manifest + Jaccard semantic + LLM via Ollama qwen2.5:7b). Not ML training. |
| Linkage Candidate | Proposed prerequisite edge with confidence score, awaiting admin approval. |
| Regenerate (linkage) | Re-runs the 3-signal matching to produce new candidates. |
| Scenario Profile | Per-run student-population behavior shifts (8 hardcoded families). |
| Recalibration | Refit logistic regression weights on new program's synthetic corpus, same architecture. NOT real-data retraining. |
| Retrain (true) | Reserved for when real student data exists and labels available. Not currently possible. |
| Demo Workspace | Disposable namespace for demo data, isolated from canonical academic state. New in P5. |
| Program Template | DB row defining a program's structure (USN format, semester count, scenario families, curriculum source). New in P6. |
| Distribution Leak | When train and validation share the same generative process — circular validation. Fixed in P2. |
| Generative-Process Split | Train families ⊥ val families ⊥ test families. New in P2. |
| Active Run vs Pending Run | Both are real proof runs. UI must surface both (fixed in A1). |
| Edge Kind | `explicit` (official prerequisite) vs `added` (admin support link). Semantic fix in A2/A3; numerical wire-up in P3 (C5/C6). |
| Bloom Level | Pedagogical taxonomy (remember/understand/apply/analyze/evaluate/create). Mapped to mastery targets in P3. |

---

## End — This document is alive. Update §4 and `docs/CHANGELOG.md` per phase.
