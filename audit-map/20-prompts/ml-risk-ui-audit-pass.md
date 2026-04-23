# ML Risk UI Audit Pass

> **You are a subagent dispatched by the AirMentor pipeline. Read this entire prompt before touching code. The sections below are ordered by importance — product intent first, technical instructions second.**

## 1. Product intent (read carefully)

AirMentor's risk-inference engine (CatBoost model, see `air-mentor-api/src/lib/proof-risk-model.ts`) produces a per-(student, course, stage) risk band + risk probability + top drivers + recommended action. Every UI surface in the app consumes this output: HoD overview, student risk explorer, queue tile, mentor dashboard.

**The product only ships if the ML outputs are surfaced honestly and completely.** If a faculty sees a risk band but no "why", they cannot act. If the risk probability jumps from 15 % to 70 % between stages with no explanation, they lose trust. If the recommended action is a cryptic enum code (`tier1-direct-intervention`) instead of human text, the UX dies.

The user just finished wiring the `humanLabelForActionCode()` helper at 3 display sites (Track A Phase 6b). More wiring is likely needed but we don't know where.

## 2. Feature intent for this task

**Audit every UI surface that consumes ML risk output** and produce a report of:

1. Which UI surface shows which ML field (risk band, risk probability, top drivers, recommended action, counterfactual lift, model version, calibration version).
2. Which surfaces show raw enum codes that should be humanised (like `recommendedAction`) — flag them with proposed fixes.
3. Which surfaces hide important driver signals that the faculty needs to act (e.g., "top drivers" not shown anywhere, yet faculty needs them).
4. Consistency check: does the same studentId show the same risk band across different UI surfaces at the same stage?
5. Model transparency: is the model version + calibration version visible where it should be (e.g., HoD console)?
6. Counterfactual lift ("what happens if we take no action") — surfaced or buried?
7. Top-drivers panel — do UI surfaces explain WHY a student is at risk?

## 3. Real-world grounding

- Risk bands at MSRUAS drive real decisions: call parents, assign mentors, issue warning letters. Faculty must be able to defend decisions ("we acted because the model said X").
- Faculty cannot be expected to decode ML codes. "tier1-direct-intervention" is jargon; "Run targeted remedial plan" is actionable.
- Model transparency builds trust. Hiding the model version is fine for students but unacceptable for the HoD view.
- Realistic mentoring at an Indian engineering school: the mentor (a single faculty member) has 15-30 mentees. They need at-a-glance summaries, not dashboards.

## 4. How it ties into the rest of the app

- Risk inference: `air-mentor-api/src/lib/proof-risk-model.ts` (`scoreObservableRiskWithModel`) returns `{ riskBand, riskProb, observableDrivers, recommendedAction, modelVersion, calibrationVersion, ... }`.
- This output flows through `buildStageEvidenceSnapshot` → `buildPlaybackGovernanceArtifacts` → `simulationStageStudentProjections` / `simulationStageQueueProjections` rows → `src/modules/academic.ts` endpoints → React UI.
- React consumers: `src/pages/hod-pages.tsx`, `src/pages/course-pages.tsx`, `src/pages/academic-*`, `src/pages/student-shell.tsx`, `src/risk-explorer.tsx` (the tests under `tests/risk-explorer.test.tsx` are the reference for what should render).

## 5. Deliverables (acceptance criteria)

### `audit-map/32-reports/ml-risk-ui-audit.md`
Required sections:
- `# ML Risk UI Audit`
- `## Scope` — which UI files, which API endpoints, which DB tables.
- `## Coverage matrix` — table with columns: UI surface | risk band shown? | risk prob shown? | top drivers shown? | recommended action shown? | recommendedAction humanised? | model version visible? | counterfactual lift shown?
- `## Findings` — per-surface narrative.
- `## Gaps that would hurt the demo` — prioritised list.
- `## Proposed fixes` — each with target file:line, suggested change, acceptance test.
- `## Follow-up code-changes` — ordered ticket list for the engine team.

Use `@`-prefixed absolute paths for every file reference (AirMentor convention).

## 6. Non-negotiables

- **Do not** modify source code. This is a pure audit task.
- **Do not** file false-positives. Every gap you flag must have a file:line citation to back it up.
- **Do not** paraphrase the coverage matrix — it must be a concrete table.
- Run the app if you need to. Take screenshots if useful. But the report must stand on code citations, not screenshots alone.

## 7. Exit contract

When done, emit the structured exit marker with:
- `artifacts`: the audit report.
- `verification_commands`: the grep / rg commands you used to find each finding (so the user can reproduce).
- `known_gaps`: any UI surface you couldn't audit (e.g., mobile, internal tools).
- `followup_tasks`: ordered ticket list for fix PRs.
