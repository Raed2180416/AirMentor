# Observable Risk Heuristic Fallback

- Component name: Observable risk heuristic fallback engine
- Type: Deterministic scoring plus heuristic thresholding
- Intent: Produce an explainable risk band, pseudo-probability, and driver list when no trained artifact is available and provide the driver explanations reused by the trained path
- Source files: `air-mentor-api/src/lib/inference-engine.ts`, `air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/src/modules/academic.ts`
- Inputs: Attendance, cumulative attendance, CGPA, backlog count, TT1 and TT2, SEE, quiz and assignment percentages, weak CO count, weak question count, intervention-response score, policy `riskRules`
- Transformations:
  - `inferObservableDrivers()` applies fixed impacts per signal family
  - `inferObservableRisk()` seeds risk at `0.08`, sums impacts, clamps to `0.05..0.95`, and bands at `Low` or `Medium` or `High`
  - `inferObservableRisk()` returns deterministic recommended actions from the final band
  - `scoreObservableRiskWithModel()` reuses this fallback when no active trained artifact exists or the feature schema mismatches
- Outputs: `riskBand`, `riskProbability`, ordered driver list, recommended actions, and in fallback mode a synthetic multi-head display where all heads inherit the same fallback probability
- Thresholds and gates:
  - Band thresholds: `>=0.7` high, `>=0.35` medium, else low
  - Explicit thresholds in code: TT1 `<40`, TT2 `<40`, SEE `<55`
  - Attendance, CGPA, and backlog thresholds come from policy `riskRules`
  - Weak-question, weak-CO, quiz, assignment, and intervention-response thresholds are hard-coded in `inference-engine.ts`
- Calibration or provenance: No learned calibration. Provenance is hand-authored heuristic logic backed by code, not by held-out evaluation
- Fallback path: This component is itself the fallback path for proof-risk scoring; when used from `scoreObservableRiskWithModel()`, the returned `modelVersion` becomes `observable-inference-v2`
- Persistence and artifacts:
  - No standalone model artifact
  - Fallback-scored rows still flow into `riskAssessments` through the proof control plane
  - When served through `scoreObservableRiskWithModel()`, fallback output is embedded in the same response shape as trained output
- UI presentation surfaces:
  - `src/system-admin-proof-dashboard-workspace.tsx`
  - `src/pages/risk-explorer.tsx`
  - `src/pages/student-shell.tsx`
  - `src/pages/hod-pages.tsx`
  - `src/academic-proof-summary-strip.tsx`
- Evaluation evidence:
  - Code-backed only for scoring logic
  - Verified by `air-mentor-api/tests/proof-risk-model.test.ts`
  - Frontend fallback and explanation rendering verified by `tests/system-admin-proof-dashboard-workspace.test.tsx`, `tests/risk-explorer.test.tsx`, `tests/student-shell.test.tsx`, `tests/hod-pages.test.ts`, and `tests/academic-proof-summary-strip.test.tsx`
- Reproducibility status: High for code-path reproduction, low for semantic trust. The heuristic is reproducible from source but not empirically validated as a predictive model in this pass
- Failure or misleading modes:
  - The numeric output can look like calibrated probability even when it is only heuristic accumulation
  - Fallback mode copies one scalar risk into multiple heads, which can overstate model richness
  - Driver impacts are handcrafted and should not be mistaken for learned feature attribution
  - Per-run threshold or environment tuning is not operator-configurable yet; current thresholds remain code-owned defaults under deferred GAP-6
- Risks:
  - Silent degradation from trained scoring to fallback scoring can preserve a polished UI while reducing semantic truth
  - Users may over-trust the numeric output because it shares the trained-risk response envelope
- Confidence: High on implementation classification, medium on operational frequency because fresh live verification was not run in this pass

## Known GAP-6 / Hardcoded Thresholds
Section environment parameters and runtime band thresholds (e.g., medium 0.40, high 0.85) remain hardcoded defaults rather than per-run slider-configurable settings. This is intentional and deferred (GAP-6).
