# Trajectory Realism Analyzer Pass

> **You are a subagent dispatched by the AirMentor pipeline. Read this entire prompt before touching code. The sections below are ordered by importance — product intent first, technical instructions second.**

## 1. Product intent (read carefully)

AirMentor's proof simulation generates synthetic student trajectories at MSRUAS — a real Indian university. The trajectories drive every downstream UI surface: risk bands, intervention queues, mentor dashboards, HoD overviews.

**The product only ships if the simulated trajectories look credibly real.** If a trustworthy faculty member scrolls through 120 student cards and thinks "these numbers are fake / too uniform / unrealistic distribution", the demo dies.

The user just finished building the per-stage intervention-response engine (Track A Phase 1-6b). Marks are now affected by interventions via a deterministic stage-realization pipeline. This analyzer is the **unbiased critic** — its job is to produce a report that tells the user, with evidence, whether the generated trajectories pass a realism smoke test.

## 2. Feature intent for this task

Produce a **critical, unbiased review report** of the current simulated trajectories covering:

1. **Mark distribution realism**: are TT1/TT2/quiz/assignment/SEE distributions plausible for an Indian engineering university? Are they too normal / too uniform / showing edge clustering?
2. **CGPA distribution realism**: is the sem-end CGPA spread plausible (median, spread, tails)? Are there absurd outliers?
3. **Attendance realism**: does the attendance distribution match what MSRUAS would actually see? Are condonation rates plausible?
4. **Backlog progression realism**: do backlog counts grow / shrink in patterns that match real university behaviour?
5. **Intervention effect realism**: given Phase-5 `applyRealizationToEvidenceSnapshot` is now live, do the intervention deltas move marks by realistic amounts? (Too small = invisible. Too large = unrealistic miracle.)
6. **Prerequisite correlation realism**: do students who struggled in a prereq course (e.g., Math 1) actually score lower in its dependent course (e.g., Math 2)?
7. **Teacher effect realism**: do students in the same section but different teachers show plausible variance?

Critique each dimension. Flag anything that would fail a faculty review. Be harsh.

## 3. Real-world grounding

- MSRUAS (Ramaiah University of Applied Sciences) is a real Indian engineering university.
- Typical B.E./B.Tech. class mark distribution (ballpark priors for realism):
  - Pass rate ~85-92 %.
  - Median final marks ~55-65 %.
  - SEE typically harder than CE: SEE mean ~5 % below CE mean.
  - Attendance mean ~80-85 %, condonation band 65-75 %, 5-10 % of students hit condonation.
  - CGPA spread sem-1: median ~6.5-7.2, SD ~1.0-1.2.
  - Backlog rate: 10-15 % of students carry at least one backlog at sem 1 close.
  - Correlation between prereq mark and dependent course mark: Spearman ~0.35-0.5.
- These are priors, not specs. Your job is to **compare** the sim output against these priors and surface deltas.

## 4. How it ties into the rest of the app

- The trajectories you're analysing are produced by `air-mentor-api/src/lib/msruas-proof-sandbox.ts` → `simulateSemesterCourse` (legacy monolith) or, when `AIRMENTOR_STAGE_REALIZATION_V1=1`, the new Phase 1-6 engines in `air-mentor-api/src/lib/proof-stage-*.ts`.
- Access them via the DB (SQLite at `$HOME/.local/state/airmentor/pipeline.db` OR the air-mentor-api Drizzle instance — read `air-mentor-api/src/db/client.ts` to find the connection).
- Tables of interest: `studentAssessmentScores`, `studentAttendanceSnapshots`, `studentObservedSemesterStates`, `transcriptTermResults`, `transcriptSubjectResults`, `studentLatentStates`.

## 5. Deliverables (acceptance criteria)

### `scripts/analyze-trajectory-realism.mjs`
- A Node script that:
  1. Connects to the AirMentor proof DB (read-only).
  2. Loads the most recent active simulation run.
  3. Computes the 7 realism statistics listed in Section 2.
  4. Writes a markdown report to `audit-map/32-reports/trajectory-realism-analysis.md`.
- Deterministic — same DB state → same report.
- Uses `better-sqlite3` (already in `package.json`) OR the existing Drizzle connection. Prefer Drizzle to stay aligned with app types.

### `audit-map/32-reports/trajectory-realism-analysis.md`
Required sections (every agent's report must have them):
- `# Trajectory Realism Analysis`
- `## TL;DR verdict` — one paragraph, blunt.
- `## Sim run under review` — runId, seed, scenarioFamily, student count.
- `## Section 1: Mark distributions`
- `## Section 2: CGPA distribution`
- `## Section 3: Attendance`
- `## Section 4: Backlog progression`
- `## Section 5: Intervention effect (flag on vs flag off)`
- `## Section 6: Prereq correlations`
- `## Section 7: Teacher effect`
- `## Open realism concerns`
- `## Recommended fixes ordered by impact`

Each Section N must include:
- What was measured.
- Observed statistics (numbers, not adjectives).
- Priors for MSRUAS-like institutions (from Section 3 of this prompt).
- **Verdict**: Pass / Soft fail / Hard fail. No weasel words.
- Evidence file:line references to either the analyzer script output or raw DB query.

## 6. Non-negotiables

- **Do not** modify any source code under `src/**`, `air-mentor-api/src/**`, or `tests/**`.
- **Do not** modify the simulation engines (you're auditing them, not changing them).
- **Do not** soft-pedal findings. If a distribution looks fake, say so.
- **Do not** hallucinate priors. Only use priors from this prompt or documented sources. Cite when you do.
- **Do** make the script re-runnable. User must be able to `node scripts/analyze-trajectory-realism.mjs` and regenerate the report.
- **Do** cover the case where no simulation run is active — report that honestly, not a fabricated analysis.

## 7. Exit contract

When done, emit the structured exit marker with:
- `artifacts`: every file created.
- `verification_commands`: how to rerun the analyzer + view the report.
- `known_gaps`: metrics you couldn't compute (e.g., no intervention data in flag-off runs).
- `followup_tasks`: realism fixes the engine team should tackle next.
