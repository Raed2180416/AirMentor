# Trajectory Realism Analysis

## TL;DR verdict

Overall verdict: **Hard fail**. The reconstructed MSRUAS proof run is not uniformly fake, but it does not clear a realism smoke test cleanly. The strongest problem is structural backlog behavior: backlogs only climb and never clear, which will read as synthetic to any faculty reviewer. Marks, attendance, prerequisite linkage, intervention lift, and teacher spread need to be read in that context: some are plausible enough to pass a quick glance, but the cohort still carries obvious generator fingerprints.

## Sim run under review

- Run ID: `simulation_run_9b12baad-d1db-4a81-a752-9aa47641b929`
- Seed: `5353`
- Scenario family: `coursework-inflation`
- Student count: 120
- Metadata source: local-evaluation-artifact-fallback
- Metadata note: Local pipeline.db lacked app simulation tables; metadata fell back to the latest governed local evaluation artifact.
- Active stage used for intervention comparison: `post-tt1` (with `pre-see-rescue` replayed at `post-assignments` by action semantics)
- Evidence: audit-map/17-artifacts/local/2026-04-20T211458Z--proof-risk-v6-expanded-metrics--local--evaluation-report.md:7-27; scripts/analyze-trajectory-realism.mjs:354-442; scripts/analyze-trajectory-realism.mjs:443-534

## Section 1: Mark distributions

- What was measured: all 4,320 reconstructed course attempts across semesters 1-6, using TT1/TT2/quiz/assignment/CE/SEE/final marks from the current deterministic generator.
- Observed pass rate: 81.6%.
- Observed final-mark median / mean: 53.00 / 53.30.
- Observed CE mean / SEE mean: 56.30 / 48.81; CE exceeds SEE by 7.49 points.
- Assignment clustering: 0.0% at >=95 and 0.0% at 99.
- TT1 lower tail: 0.0% below 20.
- Final-mark bins: 0-40=3.1%; 40-50=27.2%; 50-60=51.2%; 60-70=17.4%; 70-80=1.1%; 80-100=0.0%.
- Priors for MSRUAS-like cohorts: pass rate ~85-92%; median final mark ~55-65%; SEE mean should sit roughly 5 points below CE mean; visible but not extreme tails.
- Verdict: **Hard fail**
- Evidence: mark aggregation and verdict logic (scripts/analyze-trajectory-realism.mjs:728-1206; scripts/analyze-trajectory-realism.mjs:1295-1570; scripts/analyze-trajectory-realism.mjs:1571-1773)

## Section 2: CGPA distribution

- What was measured: semester-1 SGPA spread for all 120 students, plus pre-semester-6 cumulative CGPA after the seeded semester-1..5 transcript history.
- Observed semester-1 SGPA median / SD: 5.74 / 0.64.
- Observed semester-1 P10 / P90: 4.78 / 6.48.
- Observed semester-1 tails: 0.0% at >=9.0 and 13.3% below 5.0.
- Observed pre-semester-6 cumulative CGPA median / SD: 5.49 / 0.56.
- Priors for semester 1: median ~6.5-7.2, SD ~1.0-1.2, with tails present but not absurd. Later-semester cumulative CGPA can tighten, but it should still be grounded in a realistic semester-1 launch state.
- Verdict: **Hard fail**
- Evidence: SGPA/CGPA reconstruction and verdict logic (scripts/analyze-trajectory-realism.mjs:535-727; scripts/analyze-trajectory-realism.mjs:1295-1570; scripts/analyze-trajectory-realism.mjs:1571-1773)

## Section 3: Attendance

- What was measured: all reconstructed attendance snapshots at course level across semesters 1-6.
- Observed attendance mean / median: 86.97 / 87.00.
- Observed condonation-band share (65-75): 4.1%.
- Observed below-75 share: 4.1%.
- Observed below-65 share: 0.0%.
- Observed >=90 share: 38.8%.
- Priors for MSRUAS-like cohorts: mean ~80-85%; condonation band 65-75 should hold roughly 5-10% of rows; a minority should fall below 65.
- Verdict: **Soft fail**
- Evidence: attendance generation and verdict logic (scripts/analyze-trajectory-realism.mjs:728-1206; scripts/analyze-trajectory-realism.mjs:1295-1570; scripts/analyze-trajectory-realism.mjs:1571-1773)

## Section 4: Backlog progression

- What was measured: cumulative backlog count after each seeded historical semester (1-5) for all 120 students.
| Semester | Mean Backlog | Share >=1 | Share >=2 |
| --- | --- | --- | --- |
| S1 | 0.55 | 32.5% | 15.8% |
| S2 | 1.38 | 47.5% | 30.8% |
| S3 | 2.26 | 57.5% | 42.5% |
| S4 | 3.37 | 65.8% | 51.7% |
| S5 | 4.92 | 74.2% | 63.3% |
- Monotone backlog accumulation share: 100.0%.
- Priors for MSRUAS-like cohorts: semester-1 carryover should land around 10-15% of students, and later semesters should show both fresh failures and some backlog clearance. Pure monotone accumulation is not realistic.
- Verdict: **Hard fail**
- Evidence: historical semester replay and verdict logic (scripts/analyze-trajectory-realism.mjs:1295-1570; scripts/analyze-trajectory-realism.mjs:1571-1773)

## Section 5: Intervention effect (flag on vs flag off)

- What was measured: semester-6 baseline evidence ("flag off") versus the same evidence after applying the current realization math ("flag on") with one generated intervention per active course row.
- Active-stage comparison sample: 720 course rows.
- Mean total intervention impact score: 0.292.
- SEE delta median / mean: 0.62 / 1.77.
- Final-mark delta median / P95: 1.00 / 4.00.
- Zero-effect share: 0.0%.
| Intervention | Cases | Mean SEE Delta | Median Final Delta |
| --- | --- | --- | --- |
| mentor-check-in | 237 | 1.04 | 0.00 |
| targeted-tutoring | 470 | 2.16 | 1.00 |
| pre-see-rescue | 12 | 0.56 | 0.00 |
| prerequisite-bridge | 1 | 0.74 | 1.00 |
- Priors: intervention lifts should be visible but not miraculous. Roughly 2-8 SEE points and single-digit final-mark shifts are plausible; zero-lift interventions are too weak, double-digit miracles are too strong.
- Verdict: **Soft fail**
- Evidence: realization replay and verdict logic (scripts/analyze-trajectory-realism.mjs:1207-1294; scripts/analyze-trajectory-realism.mjs:1295-1570; scripts/analyze-trajectory-realism.mjs:1571-1773)

## Section 6: Prereq correlations

- What was measured: Spearman correlation between each prerequisite course mark and its downstream dependent course mark across the full student cohort.
- Edge count with data: 44.
- Observed median rho: 0.382.
- Observed IQR: 0.305 to 0.445.
- Share of edges inside prior band (0.35-0.50): 47.7%.
- Share of edges below 0.20: 4.5%.
| Source | Target | Edge Type | Spearman rho |
| --- | --- | --- | --- |
| Artificial Intelligence | Mini Project | added_soft_or_bridge | 0.179 |
| Machine Learning | Mini Project | added_soft_or_bridge | 0.196 |
| Probability and Statistics | Machine Learning | explicit | 0.229 |
| Engineering Mathematics-1 | Probability and Statistics | explicit | 0.249 |
| Programming in C | Parallel & Distributed Computing | added_soft_or_bridge | 0.253 |
- Priors: downstream-course performance should usually correlate with prerequisite performance in the 0.35-0.50 band, not collapse toward zero.
- Verdict: **Pass**
- Evidence: prerequisite edge replay and verdict logic (scripts/analyze-trajectory-realism.mjs:443-534; scripts/analyze-trajectory-realism.mjs:1295-1570; scripts/analyze-trajectory-realism.mjs:1571-1773)

## Section 7: Teacher effect

- What was measured: sem-6 same-student counterfactual replays across all course-leader faculty IDs, summarized as mark-range spread at student and section-cohort level.
- Student-level teacher-range median / P95: 5.00 / 6.00.
- Section-cohort mean-range median / max: 4.67 / 5.47.
- Priors: some teacher spread is credible, but section-level average shifts should stay in a low-single-digit to high-single-digit band rather than disappearing or exploding.
- Verdict: **Pass**
- Evidence: teacher counterfactual replay and verdict logic (scripts/analyze-trajectory-realism.mjs:728-1206; scripts/analyze-trajectory-realism.mjs:1295-1570; scripts/analyze-trajectory-realism.mjs:1571-1773)

## Open realism concerns

- Backlog progression is the clearest red flag. 100.0% of students show monotone non-clearing backlog counts, which is generator behavior, not registrar behavior.
- Mark distribution is compressed in the middle: 51.2% of rows land in the 50-60 band, while only 1.1% reach 70-80 and 0.0% reach 80+.
- Semester-1 GPA shape is sensitive to the grading rule that excludes failed-credit drag from SGPA/CGPA. The reconstructed semester-1 SD is 0.64, which should be read alongside that policy choice.
- Intervention lift is not zero, which is good, but it now depends on an inferred active stage and generated concern-family mapping inside this audit harness rather than raw stored intervention rows.
- This sandbox could not read live app tables from local SQLite; run metadata came from the latest local governed evaluation artifact instead of direct DB rows.
- Evidence: audit-map/17-artifacts/local/2026-04-20T211458Z--proof-risk-v6-expanded-metrics--local--evaluation-report.md:7-27; scripts/analyze-trajectory-realism.mjs:354-442; scripts/analyze-trajectory-realism.mjs:1774-1948

## Recommended fixes ordered by impact

1. Add backlog clearance / repeat-attempt logic before backlog counts are rolled forward. The current cumulative shape is the biggest realism breaker and will be obvious in transcript views.
2. Rework baseline mark realization away from simple additive noise around deterministic anchors, with explicit calibration for both weak and excellent tails. The strongest giveaway right now is middle-band compression.
3. Recalibrate semester-1 grade-point spread after fixing backlog handling. A realistic first-semester GPA launch matters more than later cumulative smoothing.
4. Tune attendance mean and condonation occupancy together. The mean can look fine while the shortage band still feels under- or over-populated.
5. Keep the intervention realization engine, but validate the stage-key and concern-family data path against stored rows so flag-on analytics are not relying on reconstructed semantics.
- Evidence: scripts/analyze-trajectory-realism.mjs:1571-1773; scripts/analyze-trajectory-realism.mjs:1207-1294

## Repro Notes

- Regenerate with: `node scripts/analyze-trajectory-realism.mjs`
- Output path: `audit-map/32-reports/trajectory-realism-analysis.md`
- Determinism note: same repo state + same local artifact set + same run metadata yields the same report byte-for-byte.
- Source files referenced by this analyzer: `air-mentor-api/src/db/seeds/msruas-mnc-curriculum.json`, `audit-map/17-artifacts/local/2026-04-20T211458Z--proof-risk-v6-expanded-metrics--local--evaluation-report.md`, and the current proof-control-plane formulas mirrored in scripts/analyze-trajectory-realism.mjs.
