# Proof / Demo Scaffolding Removal Path

**Date:** 2026-06-06  
**Status:** ACTIVE — these components are validated demo scaffolding with a planned production removal path  
**Product Truth:** The demo layer exists to prove the product works. Once proven, it is removed and replaced with live-data runtime paths.

---

## 1. Demo Scaffolding Inventory

### 1.1 Backend Services (DEMO — Remove After Validation)

| Component | File | Function | Live Equivalent | Removal Complexity |
|-----------|------|----------|-----------------|-------------------|
| MSRUAS Proof Control Plane | `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | `simulateSemesterCourse`, `publishOperationalProjection` | Live: `air-mentor-api/src/modules/academic-runtime-routes.ts` + real assessment entry | High — 150+ complexity functions, MSRUAS-specific |
| Proof Sandbox | `air-mentor-api/src/lib/msruas-proof-sandbox.ts` | `seedMsruasProofSandboxUnsafe` | Live: Real student enrollment + real assessment data | High — 211 complexity, deep seeding logic |
| Seeded Semester Service | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | Semester progression orchestration | Live: Real academic calendar progression | Medium |
| Proof Runtime Service | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | `recomputeObservedOnlyRisk` | Live: Real-time risk recomputation on evidence change | **PARTIAL RETAIN** — recompute logic is shared |
| Proof Advance Service | `air-mentor-api/src/lib/proof-control-plane-advance-service.ts` | Stage advancement | Live: Natural semester progression (no manual advance) | Low |
| Playback Governance | `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts` | `buildPlaybackGovernanceArtifacts` | Live: Audit trail (different mechanism) | Low |
| Rebuild Context | `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts` | `preparePlaybackRebuildContext` | Live: None — real data doesn't need rebuild | Low |
| Policy Diagnostics | `air-mentor-api/src/lib/proof-control-plane-policy-service.ts` | `buildPolicyDiagnostics` | Live: Policy validation remains useful | **RETAIN** |
| Tail Service | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts` | `buildStudentAgentCardFresh`, `buildFacultyProofView` | Live: Live-data card builders | **REFACTOR** — rename to live-data builders |
| HOD Service | `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` | `buildHodProofAnalytics` | Live: Live-data HOD analytics | **REFACTOR** — adapt to live data |

### 1.2 Backend Routes (DEMO — Remove After Validation)

| Route Module | File | Demo Routes | Live Equivalent |
|--------------|------|-------------|-----------------|
| Admin control plane | `air-mentor-api/src/modules/admin-control-plane.ts` | `proof-runs`, `proof-imports`, `proof-sandbox` CRUD | None — replaced by live data flows |
| Academic proof routes | `air-mentor-api/src/modules/academic-proof-routes.ts` | Student shell scoped to proof run/checkpoint | Live: Student routes without proof scope |

### 1.3 Frontend Components (DEMO — Remove After Validation)

| Component | File | Purpose | Live Equivalent |
|-----------|------|---------|-----------------|
| Proof dashboard workspace | `src/system-admin-proof-dashboard-workspace.tsx` | Admin demo playback controls | System Admin live monitoring dashboard |
| Proof simulation controls | `src/proof-simulation-controls.tsx` | Next Stage, Recompute Risk buttons | None — live data advances naturally |
| HoD counterfactual simulator | `src/hod-counterfactual-simulator-panel.tsx` | What-if analysis for demo | Could be retained as "scenario planning" feature |

### 1.4 Scripts & Generators (DEMO — Archive After Validation)

| Script | File | Purpose | Archive Policy |
|--------|------|---------|----------------|
| Synthetic cohort generator | `air-mentor-api/scripts/generate_v2_data.py` | Generates fake students/marks | Archive with reproduction instructions |
| Archetype benchmark | `air-mentor-api/scripts/archetype_benchmark.py` | Special student archetype testing | Archive |
| Trajectory dumper | `air-mentor-api/scripts/dump_trajectories.py` | Debug trajectory export | Archive |
| Demo stage realization | `air-mentor-api/scripts/demo-stage-realization-flow.mjs` | Demo flow script | Delete |
| Deep realism analyzer | `air-mentor-api/scripts/analyze_deep_realism.py` | Synthetic realism checks | Archive |
| Curriculum linkage NLP | `air-mentor-api/scripts/curriculum_linkage_nlp.py` | LLM-assisted curriculum linking | **RETAIN** — useful for live onboarding |

### 1.5 Python ML Scripts (RESEARCH TRACK — Keep but Separate)

These are NOT demo scaffolding. They are the **research and model training pipeline** that will eventually produce production models. They belong in a separate `research/` directory or `ml-pipeline/` package.

| Script | Purpose | Disposition |
|--------|---------|-------------|
| `train_sota_ensemble.py` | Main challenger training | Move to `research/` |
| `train_catboost_challenger.py` | CatBoost trainer | Move to `research/` |
| `run_sota_policy_benchmark.py` | Benchmark orchestrator | Move to `research/` |
| `run_shadow_tabular_benchmark.py` | Shadow benchmark | Move to `research/` |
| `evaluate_intervention_policies.py` | Policy evaluation | Move to `research/` |
| `product_readiness_report.py` | Deployment readiness | Move to `research/` |
| `fairness_deep_dive.py` | Fairness analysis | Move to `research/` |
| `queue_workload_report.py` | Workload analysis | Move to `research/` |
| `run_ablation_suite.py` | Feature ablation | Move to `research/` |
| `export_shadow_predictions.py` | Prediction export | Move to `research/` |
| `validate_synthetic_quality.py` | Data quality check | Move to `research/` |
| `tree-scoring-bridge.py` | Inference bridge | **KEEP in production** — needed for serving |

---

## 2. Migration Path: Demo → Production

### Phase 1: Parallel Runtime Strengthening (Current)
- Ensure every demo feature has an equivalent live path
- Example: Proof student shell → Live student shell via `academic-proof-routes.ts` refactoring
- Status: **IN PROGRESS**

### Phase 2: Live-Data Parity (Next 30 Days)
- Connect live assessment entry (`academic-runtime-routes.ts`) directly to risk recomputation
- Remove the need for "advance stage" buttons — risk updates automatically on evidence entry
- Status: **NOT STARTED**

### Phase 3: Scaffolding Removal (After Live Parity)
- Delete `msruas-proof-control-plane.ts` and `msruas-proof-sandbox.ts`
- Delete proof-specific route modules
- Delete proof UI components
- Move research scripts to separate directory
- Status: **NOT STARTED**

### Phase 4: University-Agnostic Runtime (After Scaffolding Removal)
- Replace hardcoded MSRUAS simulator with configurable runtime engine
- All policy, grading, and progression rules driven by `DEFAULT_POLICY` and institution overrides
- Status: **NOT STARTED**

---

## 3. Shared Components (Both Demo and Live)

These components serve BOTH demo and live paths. They must be carefully disentangled:

| Component | File | Demo Usage | Live Usage | Disentanglement Strategy |
|-----------|------|------------|------------|-------------------------|
| Risk model definitions | `air-mentor-api/src/lib/proof-risk-model.ts` | Shadow model evaluation | Production logistic serving | Already separated via env flags (`AIRMENTOR_ENABLE_TREE_BRIDGE_SERVING`) |
| Runtime service | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | `recomputeObservedOnlyRisk` for demo | Same function for live | **CORE SHARED** — keep, remove proof-specific params |
| Policy engine | `air-mentor-api/src/lib/proof-control-plane-policy-service.ts` | Policy diagnostics | Policy validation | **CORE SHARED** — keep, rename if needed |
| Student shell | `src/pages/student-shell.tsx` | Proof-scoped | Live-scoped | Parameterize by data source (proof vs live) |
| Risk explorer | `src/pages/risk-explorer.tsx` | Proof-scoped | Live-scoped | Parameterize by data source |

---

## 4. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-06 | Demo scaffolding WILL be removed, not maintained indefinitely | Product intent correction: this is a real product, demo is temporary |
| 2026-06-06 | Research/ML scripts move to `research/` directory | Separate product code from R&D pipeline |
| 2026-06-06 | `tree-scoring-bridge.py` stays in production | Required for governed model serving |
| 2026-06-06 | `recomputeObservedOnlyRisk` and policy engine are SHARED | Both demo and live need risk recomputation and policy validation |
