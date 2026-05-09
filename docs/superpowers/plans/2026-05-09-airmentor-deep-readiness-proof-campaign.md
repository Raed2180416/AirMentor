# AirMentor Deep Readiness Proof Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove, with browser-first evidence and research-grounded model governance, whether the local AirMentor MSRUAS demo is realistic and ready for academic evaluation, and close only the gaps that block truthful demo readiness.

**Architecture:** This is an audit-first, evidence-led campaign. Product code is not changed unless a concrete failing proof exposes a root cause and the user approves a targeted fix; docs, test harnesses, and evidence ledgers may be changed to preserve truth. The campaign moves from external evidence standards to local code/runtime proof, then to a readiness gap matrix and execution queue.

**Tech Stack:** React/Vite frontend, Fastify/Drizzle backend, local seeded backend at `http://127.0.0.1:4000`, local Vite frontend at `http://127.0.0.1:5173`, Vitest, Playwright Firefox via Nix, TypeScript, Markdown evidence ledgers.

---

## 0. Non-Negotiables

- **No production-readiness overclaim:** The demo may be academic-demo ready; it is not production predictive deployment ready until real-data validation, privacy/security, operational, and model monitoring gates pass.
- **Synthetic-data honesty:** Current demo evidence is synthetic/world-simulator based. Do not claim real institutional predictive validity.
- **Browser-first proof:** API/unit tests support claims, but every evaluator-facing claim needs browser evidence where the behavior is visible to a realistic user.
- **Intent-first testing:** Every browser proof must name role, permission, semester, stage, user intent, feature intent, expected college-evaluator observation, and false-claim guard.
- **Local-only target:** Use frontend `127.0.0.1:5173` + backend `127.0.0.1:4000` until the user explicitly asks for hosted/deployment proof.
- **Demo isolation target:** The correct future design is separate temporary demo database/schema scope. LocalStorage stores only pointer/status/playback selection; mock academic/proof data, credentials, and sessions are backend-scoped and deleted at demo end.
- **No fake causality:** Intervention panels may show deterministic simulated counterfactuals/uplift under the AirMentor world model. They must not imply causal proof from real students unless there is randomized or credible quasi-experimental evaluation.

---

## 1. External Research Synthesis

### 1.1 Educational Data Mining / Early-Warning Standards

Source: Zhang et al., "Educational Data Mining Techniques for Student Performance Prediction: Method Review and Comparison Analysis" (`https://pmc.ncbi.nlm.nih.gov/articles/PMC8688359/`).

Key standards to apply:

- **Prediction horizon separation:** SPP literature distinguishes single-course grade prediction, next-term performance prediction, and whole-learning-period prediction. AirMentor must label which horizon each prediction serves.
- **Feature/process interpretability:** EDM prediction is useful when it identifies actionable factors, not only a risk probability. AirMentor's evidence view, CO/topic weakness, attendance, prerequisite, backlog, and intervention history are necessary load-bearing surfaces.
- **Ethical caution:** Real-world SPP algorithm use needs ethical consideration because educational impact is uncertain. AirMentor must include limitations and human-review semantics.

AirMentor implication:

- Keep stage-level course risk as `single-course/stage risk`.
- Keep carryover/CGPA projection as `next-semester/learning-period simulation`.
- Avoid one global "student failure probability" claim.
- Require per-head metrics and calibration for each risk head.

### 1.2 Intervention Evaluation / Causal Inference Standards

Source: Kim & Steiner, "Quasi-Experimental Designs for Causal Inference" (`https://pmc.ncbi.nlm.nih.gov/articles/PMC6086368/`).

Key standards to apply:

- RCTs are the strongest standard for causal inference.
- If randomization is infeasible, credible quasi-experimental designs include regression discontinuity, instrumental variables, matching/propensity-score designs, and comparative interrupted time-series.
- Matching/propensity-score designs require reliable baseline confounder measurement and balancing treatment/control groups on observed covariates.

AirMentor implication:

- Current intervention deltas are **simulated response effects**, not causal treatment effects.
- UI/docs should say "simulated intervention response" or "model-estimated uplift under demo assumptions," not "proved causal impact."
- A future real pilot needs a causal protocol: eligibility threshold, matched controls or phased rollout, baseline covariates, outcome windows, attrition handling, and pre-registered estimands.

### 1.3 Synthetic Data Validation Standards

Source: AWS synthetic data quality framework (`https://aws.amazon.com/blogs/machine-learning/how-to-evaluate-the-quality-of-the-synthetic-data-measuring-from-the-perspective-of-fidelity-utility-and-privacy/`).

Key standards to apply:

- Synthetic data quality must be evaluated across **fidelity**, **utility**, and **privacy**.
- Fidelity asks whether distributions, category ratios, and correlations are preserved.
- Utility asks whether downstream ML/task performance transfers.
- Privacy asks whether sensitive or training-set information leaks.

AirMentor implication:

- Because AirMentor does not have real MSRUAS data, fidelity must be framed as domain-rule/literature fidelity, not real-data fidelity.
- Utility can be shown through downstream task performance on held-out/adversarial worlds and browser behavior, but it remains synthetic-world utility.
- Privacy risk is low for generated synthetic students, but production import/export privacy gates remain missing.

---

## 2. Current AirMentor Code Truth Map

### 2.1 Model and Evaluation

Authoritative files:

- `air-mentor-api/src/lib/proof-risk-model.ts`
- `air-mentor-api/src/lib/proof-risk-adversarial-corpus.ts`
- `air-mentor-api/scripts/evaluate-proof-risk-model.ts`
- `air-mentor-api/scripts/generate-baseline-paper-evidence.ts`
- `air-mentor-api/tests/proof-risk-model.test.ts`
- `air-mentor-api/tests/evaluate-proof-risk-model.test.ts`

Observed truth:

- `proof-risk-model.ts` has production logistic model version `observable-risk-logit-v8`, challenger version, feature schema, train/validation/test split support, calibration methods (`identity`, `sigmoid`, `beta`, `isotonic`, `venn-abers`), and risk metrics (`brierScore`, `rocAuc`, `averagePrecision`, `expectedCalibrationError`, `calibrationSlope`, `calibrationIntercept`).
- `proof-risk-adversarial-corpus.ts` generates deterministic adversarial rows using a different forgetting family, plus matched control generation.
- Current validation is strong for synthetic-model governance, but not sufficient for real-world predictive validity.

### 2.2 Stage Realism and Marks

Authoritative files:

- `air-mentor-api/src/lib/proof-stage-realization-service.ts`
- `air-mentor-api/src/lib/proof-stage-slice-simulator.ts`
- `air-mentor-api/src/lib/proof-world-realism-engine.ts`
- `air-mentor-api/src/lib/proof-control-plane-advance-service.ts`
- `tests-e2e/specs/intervention-affects-marks.spec.ts`
- `tests-e2e/specs/multi-semester-carryover.spec.ts`

Observed truth:

- `proof-stage-realization-service.ts` defines stage-visible assessment gates: pre-TT1 shows attendance only; post-TT1 adds TT1; post-TT2 adds TT2; post-assignments adds quiz/assignment/CE; post-SEE adds SEE/overall.
- `proof-stage-slice-simulator.ts` computes per-assessment formulas, attendance checkpoint slices, prerequisite average fallback, mastery, teacher effect, and difficulty.
- `proof-world-realism-engine.ts` improves mark realism using truncated normal/Beta sampling, assessment bounds, assessment responsiveness, and intervention deltas.
- Current proof is not yet complete until a 6-semester × 5-stage matrix verifies all future-assessment nulling, carryover, and no future leak for all stage checkpoints.

### 2.3 Intervention Response and Counterfactuals

Authoritative files:

- `air-mentor-api/src/lib/proof-intervention-response-engine.ts`
- `air-mentor-api/src/lib/proof-stage-realization-service.ts`
- `src/hod-counterfactual-panel.tsx`
- `tests-e2e/specs/receptivity-differentiation.spec.ts`
- `tests-e2e/specs/intervention-affects-marks.spec.ts`
- `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts`

Observed truth:

- Intervention effect is deterministic: action weight × response profile × support compatibility × stage factor × severity penalty × repeat penalty.
- Workflow-only reminders are excluded from student-facing mark movement.
- Stage factor gives earlier interventions more runway.
- `hod-counterfactual-panel.tsx` still contains flag-off/flag-on wording. This is acceptable only if the active UX truly compares two runs; otherwise copy must shift to simulator-based counterfactual language.
- Current system proves simulated response, not real causal effect.

### 2.4 Recompute and User Editability

Authoritative files:

- `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`
- `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts`
- `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts`
- `air-mentor-api/src/modules/admin-proof-sandbox.ts`
- `tests/academic-parity.test.ts`
- `tests-e2e/specs/flow-2-evidence-reaction.spec.ts`
- `tests-e2e/specs/flow-9-hod-cycle.spec.ts`

Observed truth:

- `recomputeObservedOnlyRisk` deletes/rebuilds active risk rows, can rebuild stage playback and model artifacts, loads active artifacts, derives current semester authority, and rebuilds runtime risk/queue candidates from observed rows.
- Prior evidence shows teacher attendance edits can project into recomputed proof checkpoint evidence at API level.
- Browser proof is still incomplete for the full editable-data matrix: attendance, marks, timetable/calendar, teachers, students, mentors, curriculum/linkages/configurables.

### 2.5 Demo Isolation

Authoritative files:

- `air-mentor-api/src/lib/demo-workspace-service.ts`
- `air-mentor-api/tests/demo-isolation.test.ts`
- `src/api/client.ts`

Observed truth:

- `demo-workspace-service.ts` has workspace create/list/preview/reset and deletes demo-tagged child/root rows by `demoWorkspaceId`.
- Current capability matrix may be stale because it marks demo isolation as missing while code/tests now exist.
- Current implementation is tag-based in the same database, not the selected future option of separate temp DB/schema per demo.
- Tests simulate inserted demo-tagged rows; they do not yet prove full provisioned demo workspace lifecycle with credentials, sessions, localStorage cleanup, and no global/auth mutation in browser.

### 2.6 HoD Analytics and Performance

Authoritative files:

- `air-mentor-api/tests/hod-proof-analytics.test.ts`
- `src/hod-counterfactual-panel.tsx`
- `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts`

Observed truth:

- HoD proof analytics tests assert checkpoint-scoped summary/students/faculty API alignment and prevent exposing no-action comparator fields.
- Local `/api/academic/hod/proof-bundle` has been observed around 31 seconds on seeded proof data. This is a readiness risk and needs budgeted measurement, not only longer test waits.

---

## 3. Readiness Gap Matrix

| ID | Area | Current status | Proof required | Commands / artifacts | Fix order |
|---|---|---|---|---|---|
| G1 | Browser E2E core demo | Partially green | One local Firefox run covering landing → sysadmin → create/activate proof → teacher credentials → Course Leader/Mentor/HoD login → stage/day progression → stop/reset | `nix develop -c playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-*.spec.ts --reporter=line --output=output/playwright/local-deep-realism/full-flow-rerun` | P0 |
| G2 | 30-checkpoint stage truth | Pending | Table for Sem1-6 × stages proving visible assessments, null future assessments, prior history/carryover, no future leak, no fake Sem1 prior evidence | New audit artifact `audit-map/32-reports/stage-evidence-matrix-YYYY-MM-DD.md`; backend/API extractor command or Vitest | P0 |
| G3 | Marks/CO/course-outcome mapping | Partial | For representative theory/lab/project courses: CO definitions, weak CO evidence, prerequisite weights, mastery targets, marks, and UI explanation align | Targeted backend test + browser trace from student shell/course risk explorer | P1 |
| G4 | Intervention response realism | Partial | Treated vs untreated simulated response shown as model estimate; workflow-only actions do not move marks; earlier-stage interventions have bigger runway; no causal wording | `tests-e2e/specs/intervention-affects-marks.spec.ts`, `receptivity-differentiation.spec.ts`, browser screenshot of HoD counterfactual labels | P1 |
| G5 | Causal proof boundary | Missing | UI/docs explicitly distinguish simulated uplift from causal evidence; future causal pilot protocol documented | Search for forbidden terms; create `docs/paper-evidence/causal-evaluation-protocol.md` | P1 |
| G6 | Editable attendance recompute | API evidence exists, browser incomplete | Average teacher edits attendance, sees saved value persist, sysadmin/HoD recompute changes stage evidence/risk/queue in browser | New Playwright spec or extend existing flow; preserve trace/screenshots | P1 |
| G7 | Editable marks recompute | Partial | Teacher edits TT/quiz/assignment/SEE where allowed, relocks/approves, recompute changes risk and visible evidence without future leak | New Playwright spec; API assertion against checkpoint evidence | P1 |
| G8 | Timetable/calendar/session realism | Pending | Average faculty calendar/session workflow visible; day progression updates due/overdue queues from persisted `simulationRuns.simulatedDateIso` | New Playwright spec; no fake checkpoint navigation | P2 |
| G9 | Demo isolation | Partial tag-based; selected target is temp DB/schema | Full create/provision/use/end lifecycle proves mock data, credentials, sessions, and localStorage are isolated/deleted; real/global sysadmin and teacher data unaffected | `air-mentor-api/tests/demo-isolation.test.ts` extension + browser spec + DB count snapshot artifact | P2 |
| G10 | HoD analytics | Partially green | Summary/courses/faculty/students/counterfactual visible in browser; API totals align; no no-action internal fields leak; slow endpoint measured | `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts`; backend `hod-proof-analytics.test.ts`; performance log | P2 |
| G11 | Performance budget | Missing | Define and measure budgets: proof dashboard, HoD proof bundle, recompute, stage advance, student shell. Fail if degraded beyond threshold | New `audit-map/32-reports/performance-baseline-YYYY-MM-DD.md`; command-time outputs | P2 |
| G12 | Model governance | Partial synthetic | Production/challenger/baselines/adversarial/control/family-disjoint metrics generated; calibration guard explains hidden probabilities if ECE/support poor | `npm run`/`npx tsx scripts/generate-baseline-paper-evidence.ts`; `docs/paper-evidence/03-baseline-results.md`; model diagnostics API screenshots | P3 |
| G13 | Synthetic validation | Partial | Fidelity/utility/privacy report for synthetic worlds; limitation statement that no real-data fidelity exists yet | New `docs/paper-evidence/synthetic-data-validation-report.md` | P3 |
| G14 | Real-data readiness | Missing | Import schema, validation errors, de-identification, consent, access control, retention, rollback, and real-data calibration plan documented/tested | New design doc + backend import validation tests when approved | P4 |
| G15 | Security/privacy | Missing for production | Auth/session/cookies/CORS/CSRF/audit log/privacy review for deployment target; CERT-In/Indian compliance notes if relevant | Security checklist report; no production claim before closure | P4 |
| G16 | Capability docs consistency | Stale risk | `docs/CAPABILITY_MATRIX.md`, roadmap, truth ledger, and current test reality agree | Docs diff only after evidence; no code | P0 after proof rerun |

---

## 4. Fix / Proof Order

1. **Stabilize truth ledger:** Add this plan, update current TODO state, and keep all claims in one evidence index.
2. **Run full local Firefox proof pack:** Rerun all existing green flows plus recent non-core realism specs.
3. **Generate 30-checkpoint stage matrix:** Prove stage evidence gating/carryover before changing any product behavior.
4. **Close editable-data browser gaps:** Attendance and marks first; timetable/session second; curriculum/linkage after stage matrix.
5. **Guard causal language:** Fix only copy/docs/tests if current UI implies real causal proof.
6. **Measure HoD/performance:** Convert the 31s proof-bundle observation into a measured baseline and budget.
7. **Model governance rerun:** Regenerate synthetic ML evidence, calibration summaries, adversarial/control metrics, and limitations.
8. **Demo isolation architecture decision:** Keep current tag-based test as interim; plan temp DB/schema implementation separately if user approves.
9. **Docs reconciliation:** Capability matrix and roadmap status can be updated only after evidence exists.
10. **Final readiness decision:** Produce signed-off matrix: green demo-ready, amber demo-limited, red production-blocked.

---

## 5. Execution Tasks

### Task 1: Evidence Ledger Refresh

**Files:**

- Modify: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`
- Create: `audit-map/32-reports/deep-readiness-proof-index-2026-05-09.md`

- [ ] **Step 1: Add a new proof-index artifact**

Create `audit-map/32-reports/deep-readiness-proof-index-2026-05-09.md` with:

```markdown
# Deep Readiness Proof Index — 2026-05-09

## Runtime

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4000`
- Browser: Nix Firefox through `tests-e2e/playwright.config.ts`

## Claim Rule

A claim is green only when browser, API, code path, repeatable command, and artifact path agree.

## Proof Runs

| Run | Command | Artifact | Result | Notes |
|---|---|---|---|---|
| full-flow-rerun | pending | `output/playwright/local-deep-realism/full-flow-rerun` | pending | Existing flow suite rerun. |
| stage-matrix | pending | `audit-map/32-reports/stage-evidence-matrix-2026-05-09.md` | pending | Sem1-6 × 5 stages. |
| editable-data | pending | pending | pending | Attendance/marks/timetable recompute. |
| model-governance | pending | `docs/paper-evidence/03-baseline-results.md` | pending | Synthetic-only metrics. |

## Decision Boundary

- Demo-ready requires green browser proof for evaluator-visible workflows.
- Production predictive readiness remains red until real-data validation and security/privacy gates pass.
```

- [ ] **Step 2: Append index link to existing truth ledger**

Add a row under `Current Evidence Index` linking to `deep-readiness-proof-index-2026-05-09.md`.

- [ ] **Step 3: Verify docs only**

Run:

```bash
git diff -- audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md audit-map/32-reports/deep-readiness-proof-index-2026-05-09.md
```

Expected: only documentation changes.

- [ ] **Step 4: Commit**

```bash
git add audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md audit-map/32-reports/deep-readiness-proof-index-2026-05-09.md
git commit -m "docs: add deep readiness proof index"
```

### Task 2: Full Local Browser Proof Pack

**Files:**

- Read: `tests-e2e/playwright.config.ts`
- Read: `tests-e2e/specs/*.spec.ts`
- Artifacts: `output/playwright/local-deep-realism/full-flow-rerun`

- [ ] **Step 1: Confirm servers**

Run:

```bash
curl -fsS http://127.0.0.1:4000/health
curl -fsS -I http://127.0.0.1:5173/
```

Expected:

- Backend returns `{"ok":true}`.
- Frontend returns `HTTP/1.1 200 OK`.

- [ ] **Step 2: Run flow suite**

Run:

```bash
nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/flow-1-fresh-start.spec.ts tests-e2e/specs/flow-2-evidence-reaction.spec.ts tests-e2e/specs/flow-4-scheduled-nextday.spec.ts tests-e2e/specs/flow-5-boundary-cross.spec.ts tests-e2e/specs/flow-6-nextstage-autoresolve.spec.ts tests-e2e/specs/flow-8-reopen.spec.ts tests-e2e/specs/flow-9-hod-cycle.spec.ts tests-e2e/specs/flow-10-completion-counterfactual.spec.ts tests-e2e/specs/flow-11-stop.spec.ts --reporter=line --output=output/playwright/local-deep-realism/full-flow-rerun'
```

Expected: all listed tests pass. If any fail, do not patch blindly; root-cause with trace and console/network evidence.

- [ ] **Step 3: Run non-core realism specs**

Run one at a time:

```bash
nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/intervention-affects-marks.spec.ts --reporter=line --output=output/playwright/local-deep-realism/noncore-intervention-affects-marks'
```

```bash
nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/receptivity-differentiation.spec.ts --reporter=line --output=output/playwright/local-deep-realism/noncore-receptivity-differentiation'
```

```bash
nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/multi-semester-carryover.spec.ts --reporter=line --output=output/playwright/local-deep-realism/noncore-multi-semester-carryover'
```

```bash
nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/humanised-action-labels.spec.ts --reporter=line --output=output/playwright/local-deep-realism/noncore-humanised-action-labels'
```

Expected: all pass or produce exact root-cause notes.

- [ ] **Step 4: Update proof index**

Add command, artifact path, pass/fail status, and root-cause links.

- [ ] **Step 5: Commit evidence doc updates only**

```bash
git add audit-map/32-reports/deep-readiness-proof-index-2026-05-09.md
git commit -m "docs: record local browser readiness proof"
```

### Task 3: 30-Checkpoint Stage Evidence Matrix

**Files:**

- Read: `air-mentor-api/src/lib/proof-stage-realization-service.ts`
- Read: `air-mentor-api/src/lib/proof-stage-slice-simulator.ts`
- Create: `audit-map/32-reports/stage-evidence-matrix-2026-05-09.md`
- Optional Test: `air-mentor-api/tests/stage-evidence-matrix.test.ts`

- [ ] **Step 1: Write matrix criteria**

Create `audit-map/32-reports/stage-evidence-matrix-2026-05-09.md` with:

```markdown
# Stage Evidence Matrix — 2026-05-09

## Criteria

| Stage | Attendance | TT1 | TT2 | Quiz | Assignment | CE | SEE | Overall | Future leak guard |
|---|---|---|---|---|---|---|---|---|---|
| pre-tt1 | visible | null | null | null | null | null | null | null | no TT/quiz/assignment/SEE |
| post-tt1 | visible | visible | null | null | null | null | null | null | no TT2/quiz/assignment/SEE |
| post-tt2 | visible | visible | visible | null | null | null | null | null | no quiz/assignment/SEE |
| post-assignments | visible | visible | visible | visible | visible | visible | null | null | no SEE |
| post-see | visible | visible | visible | visible | visible | visible | visible | visible | complete only now |

## Matrix

| Semester | Stage | Checkpoint ID | Students sampled | Criteria result | Carryover result | Notes |
|---|---|---|---:|---|---|---|
```

- [ ] **Step 2: Add an extractor or test**

Preferred: write a backend Vitest that loads a seeded proof run, iterates checkpoint rows, parses evidence payloads, and asserts the table criteria. If product APIs already expose the needed data, use API extraction instead of a new test.

Minimum assertions:

```ts
const visibleByStage = {
  'pre-tt1': ['attendancePct'],
  'post-tt1': ['attendancePct', 'tt1Pct'],
  'post-tt2': ['attendancePct', 'tt1Pct', 'tt2Pct'],
  'post-assignments': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct'],
  'post-see': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'],
}
const allSignals = ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct']
for (const stage of Object.keys(visibleByStage)) {
  for (const signal of allSignals) {
    if (visibleByStage[stage].includes(signal)) expect(payload[signal]).not.toBeUndefined()
    else expect(payload[signal] ?? null).toBeNull()
  }
}
```

- [ ] **Step 3: Run backend test/extractor**

If test:

```bash
npx vitest run tests/stage-evidence-matrix.test.ts --reporter=dot
```

from `air-mentor-api`.

Expected: pass, or exact stage/signal leak failure.

- [ ] **Step 4: Fill matrix artifact**

Record every Sem1-6 × stage row. If sampling is used, record sample size and why it is enough. If full population is used, record total evidence rows checked.

- [ ] **Step 5: Commit**

```bash
git add audit-map/32-reports/stage-evidence-matrix-2026-05-09.md air-mentor-api/tests/stage-evidence-matrix.test.ts
git commit -m "test: prove stage evidence matrix"
```

### Task 4: Editable Data Recompute Browser Proof

**Files:**

- Read: `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`
- Read: `tests-e2e/specs/flow-2-evidence-reaction.spec.ts`
- Read: `tests-e2e/specs/flow-9-hod-cycle.spec.ts`
- Create or Modify: `tests-e2e/specs/editable-data-recompute.spec.ts`
- Artifact: `output/playwright/local-deep-realism/editable-data-recompute`

- [ ] **Step 1: Define browser intent table in the spec header**

Use this exact intent table in the test file header:

```ts
// Intent: Prove an average Course Leader can edit observable academic evidence and that
// the local proof plane recomputes risk/queue projections from the persisted edit.
// Feature intent: editable marks/attendance must not be cosmetic; it must affect risk
// where logically relevant and must not leak future-stage evidence.
// Role: Course Leader, with HoD approval where the workflow requires it.
// Semester/stage: Sem-1 pre/post checkpoint plus one later checkpoint selected by seeded run.
// Evaluator observation: saved edit appears in UI, recompute updates risk/evidence, no console crash.
```

- [ ] **Step 2: Write failing Playwright assertion for attendance edit**

Test flow:

1. Login as Course Leader.
2. Open assigned course surface.
3. Edit one student's attendance to a sharp value such as `50`.
4. Save/relock/approval flow if required.
5. Login sysadmin or use API session to recompute observed risk.
6. Open HoD/student shell and assert attendance evidence changed.
7. Assert risk scalar or queue membership changed if the model says it should.

- [ ] **Step 3: Write failing Playwright assertion for marks edit**

Use TT/quiz/assignment field that is legal at the chosen stage. Assert visible evidence changes only for already-realized stage fields.

- [ ] **Step 4: Run spec**

```bash
nix develop -c bash -lc 'source scripts/playwright-browser-common.sh; export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"; export PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js; export AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4000 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox; playwright test --config=tests-e2e/playwright.config.ts tests-e2e/specs/editable-data-recompute.spec.ts --reporter=line --output=output/playwright/local-deep-realism/editable-data-recompute'
```

Expected first run may fail if selectors/workflow are not yet robust. Root-cause before product patch.

- [ ] **Step 5: Fix only if root cause is product behavior**

Allowed fix types after evidence:

- Missing recompute bridge.
- Broken save persistence.
- Incorrect stage gating.
- UI cannot reveal saved value despite data saved.

Not allowed without approval:

- Rewriting product flows.
- Cosmetic refactors.
- Hiding a failing assertion.

- [ ] **Step 6: Commit test and approved fix**

```bash
git add tests-e2e/specs/editable-data-recompute.spec.ts <approved-product-files-if-any>
git commit -m "test: prove editable data recomputes proof risk"
```

### Task 5: Causal-Language Guard

**Files:**

- Read: `src/hod-counterfactual-panel.tsx`
- Read: `src/**/*.tsx`
- Read: `docs/**/*.md`
- Create: `docs/paper-evidence/causal-evaluation-protocol.md`
- Optional Test: `tests/causal-language.test.ts`

- [ ] **Step 1: Search for risky language**

Run:

```bash
grep -RInE "proved causal|causal impact|interventions caused|actually moved|raised the score|guaranteed|real-world prediction" src docs air-mentor-api/src | head -100
```

Expected: list terms to classify. Do not mass-replace blindly.

- [ ] **Step 2: Create causal protocol doc**

Create `docs/paper-evidence/causal-evaluation-protocol.md` with:

```markdown
# Causal Evaluation Protocol

## Current Demo Claim

AirMentor currently demonstrates simulated intervention response under a deterministic synthetic world model. It does not prove causal intervention effects on real students.

## Future Real-Data Estimand

Primary estimand: average treatment effect on treated students for a defined intervention family over the next academic checkpoint, measured as change in attendance, CE, SEE, or course pass outcome.

## Acceptable Designs

1. Randomized phased rollout where eligible students are randomly assigned to early vs delayed intervention.
2. Regression discontinuity around a pre-specified risk threshold if policy assigns intervention by threshold.
3. Propensity-score matched comparison using baseline attendance, CGPA, backlog, prior marks, course difficulty, mentor load, and socioeconomic/context fields if available.
4. Comparative interrupted time series if intervention policy changes at a known date and comparable untreated cohorts exist.

## Minimum Data

- Baseline risk evidence before intervention.
- Intervention type, date, owner, completion status.
- Outcome window and outcome definition.
- Confounders used for matching or adjustment.
- Attrition/missingness handling.

## UI Language Rule

Use "simulated uplift", "model-estimated response", or "counterfactual under demo assumptions". Do not use "causal impact" unless a causal design has been executed and documented.
```

- [ ] **Step 3: Patch only misleading copy if found**

If `hod-counterfactual-panel.tsx` is still active and says "interventions actually move the needle" or equivalent, replace with "simulated intervention response under the proof model".

- [ ] **Step 4: Run frontend tests**

```bash
npx vitest run tests/system-admin-proof-dashboard-workspace.test.tsx tests/faculty-profile-proof.test.tsx --reporter=dot
npx tsc -p tsconfig.app.json --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add docs/paper-evidence/causal-evaluation-protocol.md src/hod-counterfactual-panel.tsx tests/causal-language.test.ts
git commit -m "docs: define causal evaluation boundary"
```

### Task 6: HoD and Performance Budget

**Files:**

- Read: `air-mentor-api/tests/hod-proof-analytics.test.ts`
- Read: `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts`
- Create: `audit-map/32-reports/performance-baseline-2026-05-09.md`

- [ ] **Step 1: Measure key endpoints**

With local backend/frontend already running, run:

```bash
time curl -fsS -o /tmp/airmentor-proof-dashboard.json http://127.0.0.1:4000/api/admin/batches/<BATCH_ID>/proof-dashboard
```

Use authenticated requests for protected APIs; if direct curl lacks cookies, measure inside Playwright by recording `performance.now()` around the API response.

- [ ] **Step 2: Record budgets**

Create `audit-map/32-reports/performance-baseline-2026-05-09.md` with:

```markdown
# Performance Baseline — 2026-05-09

## Budgets

| Surface | Budget | Reason |
|---|---:|---|
| Proof dashboard API | <= 10s local seeded | Admin should not appear frozen. |
| HoD proof bundle API | <= 15s local seeded | Current observed ~31s is too slow for evaluator flow. |
| Student shell card API | <= 8s local seeded | Student drilldown must feel interactive. |
| Recompute observed risk | <= 60s local seeded | Long-running operation is acceptable only with visible progress. |
| Stage advance | <= 45s local seeded | Proof control should complete within demo attention window. |

## Measurements

| Surface | Command/spec | Duration | Status | Artifact |
|---|---|---:|---|---|
```

- [ ] **Step 3: Run HoD tests**

```bash
npx vitest run tests/hod-proof-analytics.test.ts --reporter=dot
```

from `air-mentor-api`.

Expected: pass, with duration recorded.

- [ ] **Step 4: If HoD proof bundle exceeds budget, profile before fix**

Only profile; do not rewrite.

Look for:

- Repeated full-run scans.
- Missing checkpoint scoping.
- N+1 per student/faculty/course queries.
- Unbounded lifecycle audit joins.

- [ ] **Step 5: Commit performance artifact**

```bash
git add audit-map/32-reports/performance-baseline-2026-05-09.md
git commit -m "docs: record local performance baseline"
```

### Task 7: Model Governance Rerun

**Files:**

- Read: `air-mentor-api/src/lib/proof-risk-model.ts`
- Read: `air-mentor-api/src/lib/proof-risk-adversarial-corpus.ts`
- Read: `air-mentor-api/scripts/generate-baseline-paper-evidence.ts`
- Modify: `docs/paper-evidence/03-baseline-results.md`
- Create: `docs/paper-evidence/synthetic-data-validation-report.md`

- [ ] **Step 1: Run model tests**

```bash
npx vitest run tests/proof-risk-model.test.ts tests/evaluate-proof-risk-model.test.ts --reporter=dot
```

from `air-mentor-api`.

Expected: pass.

- [ ] **Step 2: Generate paper evidence**

Run the existing evidence script from `air-mentor-api` using the repo's current script invocation. If no package script exists, use:

```bash
npx tsx scripts/generate-baseline-paper-evidence.ts
```

Expected: `docs/paper-evidence/03-baseline-results.md` updated or regenerated with baseline, challenger, calibration, and adversarial/control results.

- [ ] **Step 3: Create synthetic validation report**

Create `docs/paper-evidence/synthetic-data-validation-report.md` with:

```markdown
# Synthetic Data Validation Report

## Claim Boundary

AirMentor synthetic data is validated for domain-rule and literature-grounded plausibility, not for fidelity to private MSRUAS records. No real institutional dataset was available for direct fidelity testing.

## Fidelity Checks

| Check | Evidence | Status |
|---|---|---|
| Stage evidence visibility | `audit-map/32-reports/stage-evidence-matrix-2026-05-09.md` | pending |
| Assessment distributions | `proof-world-realism-engine` tests and mark distribution summaries | pending |
| Scenario family coverage | `docs/paper-evidence/scenario-grounding.md` | existing |
| CO/prerequisite semantics | curriculum feature config tests | pending rerun |

## Utility Checks

| Check | Evidence | Status |
|---|---|---|
| Logistic production model metrics | `docs/paper-evidence/03-baseline-results.md` | pending rerun |
| Baselines | `trainMajorityClassBaseline`, `trainTwoFeatureLogisticBaseline` | pending rerun |
| Adversarial corpus | `proof-risk-adversarial-corpus.ts` | pending rerun |
| Browser workflow utility | `output/playwright/local-deep-realism/*` | pending rerun |

## Privacy Checks

| Check | Evidence | Status |
|---|---|---|
| Synthetic students not copied from real records | no real training set used | green for demo |
| Credentials deleted on stop | flow-11 + backend unit | pending rerun |
| Real-data import privacy | not implemented | red for production |

## Decision

Synthetic-world utility may support demo and paper-method claims. Real-world predictive validity remains blocked until pilot data validation.
```

- [ ] **Step 4: Commit**

```bash
git add docs/paper-evidence/03-baseline-results.md docs/paper-evidence/synthetic-data-validation-report.md
git commit -m "docs: refresh synthetic model governance evidence"
```

### Task 8: Demo Isolation Decision Plan

**Files:**

- Read: `air-mentor-api/src/lib/demo-workspace-service.ts`
- Read: `air-mentor-api/tests/demo-isolation.test.ts`
- Create: `docs/superpowers/specs/2026-05-09-demo-temp-db-isolation-design.md`

- [ ] **Step 1: State current vs target design**

Create `docs/superpowers/specs/2026-05-09-demo-temp-db-isolation-design.md` with:

```markdown
# Demo Temporary Database Isolation Design

## Current Implementation

AirMentor currently supports `demoWorkspaceId` tagging and reset deletion for tagged rows. This is useful but not the selected final isolation model.

## Target Implementation

Each demo run uses a separate temporary database/schema scope. Browser localStorage stores only a pointer/status/playback selection. All mock academic/proof data, proof credentials, and sessions live inside the isolated backend scope and are deleted at demo end.

## Required Proof

1. Create demo scope.
2. Provision complete mock academic/proof dataset.
3. Login as generated demo teacher/HoD.
4. Advance proof stages and edit evidence.
5. Stop/end demo.
6. Prove demo credentials fail after stop.
7. Prove sysadmin and non-demo academic data remain unchanged.
8. Prove localStorage contains no academic data.

## Open Engineering Choice

Choose between PostgreSQL schema-per-demo and embedded/temp database-per-demo for local-only demo. Do not implement until approved.
```

- [ ] **Step 2: Commit design only**

```bash
git add docs/superpowers/specs/2026-05-09-demo-temp-db-isolation-design.md
git commit -m "docs: design temp database demo isolation"
```

### Task 9: Final Readiness Gap Matrix

**Files:**

- Create: `audit-map/32-reports/final-readiness-gap-matrix-2026-05-09.md`

- [ ] **Step 1: Create final matrix**

Create `audit-map/32-reports/final-readiness-gap-matrix-2026-05-09.md` with:

```markdown
# Final Readiness Gap Matrix — 2026-05-09

## Legend

- Green: browser + API + code + command evidence agree.
- Amber: demo-safe with limitation disclosed.
- Red: blocks demo readiness or production claim.

| Area | Demo readiness | Production readiness | Evidence | Remaining fix |
|---|---|---|---|---|
| Browser evaluator workflow | pending | red | pending | pending |
| Stage evidence realism | pending | amber | pending | pending |
| Marks/CO/prereq mapping | pending | amber | pending | pending |
| Intervention response | pending | red for causal claim | pending | causal wording/protocol |
| Editable data recompute | pending | amber | pending | pending |
| Demo isolation | amber if tag-based only | red | pending | temp DB/schema design |
| HoD analytics | pending | amber | pending | performance budget |
| ML model governance | amber synthetic-only | red | pending | real-data validation |
| Synthetic data validation | amber | red | pending | real-data fidelity unavailable |
| Security/privacy | amber local-only | red | pending | deployment privacy/security gates |
```

- [ ] **Step 2: Fill after tasks 1-8**

No placeholder should remain. Every `pending` must become green/amber/red with artifact path.

- [ ] **Step 3: Commit**

```bash
git add audit-map/32-reports/final-readiness-gap-matrix-2026-05-09.md
git commit -m "docs: publish readiness gap matrix"
```

---

## 6. Completion Criteria

The campaign is complete only when:

- Full local Firefox flow suite passes with saved artifact paths.
- Non-core realism specs pass or have exact root-cause/fix records.
- 30-checkpoint stage evidence matrix is filled.
- Attendance and marks edit/recompute are proven in browser.
- HoD analytics browser/API alignment is green and performance is measured.
- Model governance artifacts are regenerated.
- Synthetic-data validation report states fidelity/utility/privacy boundaries.
- Demo isolation current-vs-target is documented.
- Final readiness matrix states what is green/amber/red without overclaim.

---

## 7. Self-Review

- **Spec coverage:** Covers external EDM/causal/synthetic standards, code audit, proof matrix, fix order, model governance, demo isolation, performance, and final readiness matrix.
- **Placeholder scan:** Remaining `pending` entries are intentionally initial values in templates and must be replaced by task execution before final matrix commit.
- **Type/path consistency:** Paths are exact for the current repo. Product-code file paths are read-only unless task-specific evidence justifies a fix.
