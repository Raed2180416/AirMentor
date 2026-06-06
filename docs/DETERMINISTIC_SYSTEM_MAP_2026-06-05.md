# AirMentor Deterministic System Map — 2026-06-05

Generated via LogicStamp, ctxo, codegraph, code_search, and dedicated skill analysis.

---

## 1. Core Serving Entry Point

**`scoreObservableRiskWithModel`**
- File: `air-mentor-api/src/lib/proof-risk-model.ts`
- Callers: 20 functions across playback governance, runtime service, academic module, evaluation scripts
- Blast radius (ctxo): 35 impacted symbols, 7 clusters

Internal chain: fallback suppression → `inferObservableRisk` → `featureVectorFromPayload` → `scoreWithLogistic` / `scoreWithTreeBridge` → `crossCourseDriversFromCorrelations` → `modelContextDriversFromPayload`

---

## 2. Feature Vector (48-dim v6 Contract)

Built by `buildObservableFeaturePayload` (20 callers) → `featureVectorFromPayload`.

Key fields:
- `attendancePct`, `currentCgpa`, `backlogCount`, `backlogCredits`
- `activeBacklogCredits`, `historicalBacklogCredits`, `lowerYearBlockerCredits`, `backlogAttemptCount`
- `tt1Pct`, `tt2Pct`, `quizPct`, `assignmentPct`, `seePct`
- `weakCoCount`, `weakQuestionCount`, `interventionResponseScore`
- `prerequisiteAveragePct`, `prerequisiteFailureCount`, `downstreamDependencyLoad`, `weakPrerequisiteChainCount`, `repeatedWeakPrerequisiteFamilyCount`
- `sectionRiskRate`, `semesterProgress`, `semesterNumber`

---

## 3. Risk Heads & Thresholds

5 heads: `attendanceRisk`, `ceRisk`, `seeRisk`, `overallCourseRisk`, `downstreamCarryoverRisk`
Each has: production thresholds, support minimums, display ECE limits, calibration version.

---

## 4. Model Scoring Stack

- **Logistic fallback:** `scoreWithLogisticRaw` → sigmoid → `applyCalibration` (sigmoid/beta/isotonic)
- **Tree bridge (gated):** `scoreWithCatBoost`, `scoreWithEbm` — requires `AIRMENTOR_ENABLE_TREE_BRIDGE_SERVING=1` AND `AIRMENTOR_ALLOW_TREE_PROXY_EXPLANATIONS=1`
- **Challenger:** `scoreObservableRiskWithChallengerModel` — shadow A/B

---

## 5. Python Data Generator

`air-mentor-api/scripts/generate_v2_data.py` — SimulatorV2

- `generate_student_latents()` → latent traits via stable hash
- `simulate_course()` → attendance, TT1, TT2, quiz, assignment, SEE (nullable when ineligible)
- `compute_features()` → 48-dim feature vector, stage-aware masking
- `compute_labels()` → heuristic risk labels per head
- `generate_dataset()` → governed CSV with train/val/test splits

Known discrepancies (to fix):
- Python historically used 40/60 CE/SEE weighting (MSRUAS is 60/40)
- `feat_25` was semester number; TypeScript uses `semesterProgress` (stage order / total stages)
- `DEFAULT_POLICY.sgpaCgpaRules.includeFailedCredits` was `false`; must be `true` for MSRUAS attempted-credit formula

---

## 6. Training Pipeline

`air-mentor-api/scripts/train_sota_ensemble.py`

Per head:
1. Data validation
2. Augmentation (Gaussian noise + mixup)
3. Train 5 model families (XGBoost, LightGBM, CatBoost, EBM, Logistic)
4. Fit calibration on validation
5. Model selection (validation metrics + robustness gates + overload correction)
6. Fairness (equalized odds)
7. Explanation parity checks
8. Save artifacts

Current decision: `deployAllowed=false`, `internalSyntheticResearchUseAllowed=true`

---

## 7. Curriculum & Worldbuilding

Curriculum source: `air-mentor-api/src/db/seeds/msruas-mnc-curriculum.json`
- 60 courses across 6 semesters
- Fields: title, semester, credits, assessmentProfile, explicitPrerequisites, addedPrerequisites, bridgeModules, tt1Topics, tt2Topics, seeTopics, workbookTopics, internalCompilerId, officialWebCode

Compiler: `msruas-curriculum-compiler.ts` — XLSX → JSON, cycle detection, completeness certificate

Graph tables: `curriculumNodes`, `curriculumEdges`, `bridgeModules`, `courseTopicPartitions`

---

## 8. Sandbox Seeding Flow

`seedMsruasProofSandbox()` callers: `seed.ts`, `msruas-proof-control-plane.ts`, `test-sandbox.ts`, `verify-seeding-alignment.ts`

Seeds in order:
1. Institution / Branch / Department
2. Batch (`MSRUAS_PROOF_BATCH_ID`)
3. Faculty (`PROOF_FACULTY` — 10 faculty, HOD/CL/Mentor roles)
4. Students (120, deterministic names, stable Beta latent traits)
5. Courses (from JSON)
6. Curriculum nodes/edges (prerequisite graph)
7. Offerings (sections A + B)
8. Mentor assignments
9. Simulation run (`MSRUAS_PROOF_SIMULATION_RUN_ID`)

---

## 9. Semester Simulation Flow

`proof-control-plane-seeded-semester-service.ts` loops semesters 1→5:

Per student + course:
- `simulateSemesterCourse()` → marks
- `simulateQuestionResults()` → topic-level outcomes
- `buildCourseOutcomeStates()` → CO mastery
- `buildTopicStateRows()` → topic states

Per semester:
- `classifyBacklogReason()` → attendance/CE/SEE failure
- `backlogClearanceProbability()` → deterministic recovery with latent traits + age/near-miss boost
- Writes `transcriptTermResults` (SGPA, credits, backlog)
- Writes `transcriptSubjectResults` (marks, grades, failure modes)
- Writes `studentObservedSemesterStates` (full JSON state)

---

## 10. Deterministic Math Engine

`proof-world-realism-engine.ts` — pure functions, no DB, no wall-clock

- `stableUnit(seed)` — FNV-1a hash
- `stableGaussian()` — Box-Muller
- `stableTruncatedNormal()` — reroll up to 4x, then clamp
- `betaQuantile()` / `betaIncomplete()` — Lanczos + continued fractions
- `stableAnchoredBeta()` — Beta-distributed mark realization
- `realizeAssessmentMark()` — anchored Beta + intervention delta + bounds
- `applyForgetDecay()` — between-stage knowledge decay

---

## 11. Control Plane Orchestration

`msruas-proof-control-plane.ts` (5,553 lines) — service dependency injection pattern

Key exports:
- `startProofSimulationRun()` — create + bootstrap
- `advanceProofSimulationDay()` / `advanceProofSimulationStage()` — time advance
- `stopProofSimulationRun()` — cleanup
- `recomputeObservedOnlyRisk()` — risk recompute
- `buildHodProofAnalytics()` / `buildFacultyProofView()` — dashboards

---

## 12. Inference Engine

`inference-engine.ts`

- `policyRiskFloorFromObservableInput()` — policy minimum risk
- `inferObservableRisk()` — heuristic fallback
- `inferObservableDrivers()` — driver extraction from evidence
- `evaluateCatastrophicAbsorbingState()` — terminal state detection
- `isCriticallySparseAcademicEvidence()` — suppression gate

---

## 13. UI Simulation Controls

`src/proof-simulation-controls.tsx`

Actions: Create Proof Run, Next Stage, Next Day, Previous Day, Playback (prev/next/start/end), Reset Stage, Reset Proof Run, Recompute Risk

---

## 14. Key Files & Their Roles

| File | Role |
|------|------|
| `proof-risk-model.ts` | Feature vector, model scoring, calibration, drivers |
| `inference-engine.ts` | Fallback heuristic, policy floors, driver inference |
| `generate_v2_data.py` | Synthetic data generator (48 features, 5 heads) |
| `train_sota_ensemble.py` | Multi-model trainer with calibration & fairness |
| `msruas-proof-sandbox.ts` | Deterministic cohort seeding |
| `proof-control-plane-seeded-semester-service.ts` | Semester simulation, grades, backlog |
| `proof-world-realism-engine.ts` | Pure deterministic math (Beta, Gaussian, decay) |
| `msruas-proof-control-plane.ts` | 5.5k-line orchestration layer |
| `msruas-curriculum-compiler.ts` | Curriculum XLSX → JSON compiler |
| `msruas-rules.ts` | MSRUAS policy: attendance, CE/SEE eligibility, pass, SGPA/CGPA |
| `msruas-mnc-curriculum.json` | 60-course curriculum seed |
| `proof-simulation-controls.tsx` | UI buttons for simulation control |
| `system-admin-proof-dashboard-workspace.tsx` | Admin proof dashboard |

---

## 15. Discrepancies & Action Items

1. **Backlog sensitivity score** in `proof-risk-model.ts` must be corrected to use credit-based backlog features (v6), not subject-count proxy (v5)
2. **`includeFailedCredits`** must be `true` in `DEFAULT_POLICY` for MSRUAS attempted-credit SGPA/CGPA
3. **Python `feat_25`** must emit `semesterProgress` (stage fraction), not raw semester number
4. **Python CE/SEE weighting** must align with MSRUAS 60/40
5. **CatBoost serving** remains gated (`deployAllowed=false`); do not wire into production until governed gates pass
6. **Tree bridge scoring** requires both env vars; explanations are proxy-only

---

*Map generated 2026-06-05. Covers 283 components, 282 bundles, 22 folders across the workspace.*
