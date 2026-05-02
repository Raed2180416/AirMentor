# Proof-Risk Manifest-64  Analysis

Status: external evaluator interpretation memo  
Run: `20260427T011901Z-manifest64`  
Git SHA: `a6dd67e8`  
Date: `2026-04-27`

## 1. What this run is

This is the latest known broad-corpus proof-risk evaluator result for the repository, reported from Lightning.ai rather than from the stale repo-local archived `full64` artifact.

Intent:

- establish whether the currently favored proof-risk stack is actually better than heuristic and older baselines across a full governed corpus
- test ranking quality, calibration, queue fit, policy quality, and stage-to-stage stability together rather than as isolated ML vanity metrics

What it covers:

- `64/64` manifest seeds complete
- `1,382,400` total rows
- `259,200` held-out test rows
- one duplicate for seed `101` was discarded because it was an older zero-checkpoint run; the complete run was kept

Why it matters:

- this is the first broad-corpus result in the current audit stream that supports a credible “ship current-v8” story
- it supersedes the repo-local archived `full64-20260424T043521Z.*` story as the latest known evaluation result

## 2. Corpus integrity verdict

Intent:

- prove that the evaluator corpus itself is structurally sound before trusting any metric

What happened:

- all `64` seeds produced exactly `30/30` checkpoints
- no scenario-mismatch skips
- no non-manifest skips
- CO evidence fallback was `0` across all `1,382,400` rows

Why this matters:

- evaluator quality claims are meaningless if the corpus is partially broken, missing stages, or silently falling back to generic CO evidence
- `0` fallback means the blueprint coverage held across the full manifest diversity

Verdict:

- corpus integrity passed
- this is a hard precondition for using the rest of the report as promotion evidence

## 3. Per-head model story

### 3.1 attendanceRisk

Intent:

- detect attendance-driven failure risk early enough to trigger operational intervention

What it does well:

- Brier `0.0587` vs heuristic `0.264`
- ROC-AUC `0.9271` vs `0.774`
- PR-AUC `0.6569` vs `0.2245`
- Precision@20% `0.3708` vs `0.2257`
- Recall@20% `0.8192` vs `0.5414`

Why this matters:

- this head is a strong early-term ranking signal
- at the medium threshold, only `5.37%` of rows are flagged, but precision reaches `77.14%` with `45.77%` recall, which is a credible intervention lane

Current caveat:

- local ECE around the `0.4` boundary is `0.2012`
- mean predicted near that band is `0.3953`, but mean actual is `0.5965`
- so threshold-near cases are under-called

Operational reading:

- good for ranking and medium-threshold intervention
- not yet good enough to treat the `0.4` boundary as a high-trust probability gate without calibration or threshold revision

### 3.2 ceRisk

Intent:

- identify rare CE-related failure risk without flooding queues

What it does:

- Brier `0.0394` vs heuristic `0.2834`
- ROC-AUC `0.8716` vs `0.8182`
- PR-AUC `0.2419` vs `0.153`
- ECE `0.0884` vs `0.4527`
- positive rate only `3.47%`

Why this matters:

- this is a low-base-rate head, so pure AUC improvement is not enough; operating point discipline matters more

Operational reading:

- Precision@20% is only `0.1294`, so budget-style flagging is too noisy
- medium threshold is the correct production posture: `1.95%` flagged, `35.52%` precision, `19.96%` recall

### 3.3 seeRisk

Intent:

- estimate SEE-linked course risk late in the semester

What it does:

- Brier `0.1409` vs `0.2505`
- ROC-AUC `0.7473` vs `0.7033`
- PR-AUC `0.3952` vs `0.3552`
- ECE `0.046` vs `0.2922`

Why this matters:

- this is the hardest head; it captures a failure mode influenced by later compound effects that are less visible early

Operational reading:

- discrimination is weaker than the other heads
- calibration is still good
- use it as aggregate risk evidence, not as a high-confidence individual alert source

### 3.4 downstreamCarryoverRisk

Intent:

- detect future carryover harm driven by current-course weakness

What it does:

- Brier `0.1221` vs heuristic `0.2736`
- ROC-AUC `0.9301` vs `0.6048`
- PR-AUC `0.8255` vs `0.355`
- Precision@20% `0.7946` vs `0.3719`
- ECE `0.14`

Why this matters:

- this is the standout head in the whole suite
- the `+0.3253` AUC lift over heuristic is the single biggest discrimination gain in the run

Current caveat:

- `displayProbabilityAllowed: false`
- ECE `0.14` is too high for probability display

Operational reading:

- this head is ready for ranking, prioritization, and queue ordering
- this head is not yet ready for raw probability display to mentors or operators

### 3.5 overallCourseRisk

Intent:

- provide the blended course-level risk surface that drives the main queue and alert posture

What it does:

- Brier `0.1372` vs heuristic `0.2339`
- ROC-AUC `0.7892` vs `0.7494`
- PR-AUC `0.482` vs `0.4414`
- global ECE `0.0475` vs `0.2812`
- Precision@20% `0.4803` vs `0.4419`
- overload ratio `1.0006` vs `1.0859`

Why this matters:

- this head is the actual operational centerpiece
- it balances signal quality with queue-capacity discipline

Important detail:

- scores are concentrated in the `0.1` to `0.5` band, with zero rows above `0.8`
- this is conservative behavior, not model collapse; the blended signal is intentionally not behaving like a high-certainty binary classifier

## 4. Calibration detail that actually matters

Global calibration is good enough to ship for synthetic queue use:

- overall ECE `0.0475`
- slope `1.1893`
- intercept `-0.0686`

But local threshold behavior is where the real release risk sits.

### 4.1 overallCourseRisk at the `0.4` decision boundary

- overall local ECE `0.0061`
- sem-1 `0.345`
- sem-2 `0.139`
- sem-3 `0.0052`
- sem-4 `0.0122`
- sem-5 `0.0026`
- sem-6 `0.0164`

Meaning:

- from semester `3` onward, threshold behavior is strong
- semesters `1` and `2` are the outliers
- the model is not uniformly “bad early”; it is specifically unreliable around the `0.4` alert boundary in the first two semesters

Recommended handling:

- either suppress or de-emphasize the `0.4` alert in semesters `1` and `2`
- or use a different early-semester threshold rather than pretending one boundary works everywhere

### 4.2 Scenario-family threshold behavior

- balanced `0.0009`
- low-attendance `0.0059`
- high-forgetting `0.0102`
- weak-foundation `0.0448`
- coursework-inflation `0.0285`

Meaning:

- calibration is excellent in balanced and low-attendance settings
- weak-foundation remains the hardest scenario family near the decision boundary

## 5. Variant comparison and ship decision

| Variant | Brier | AUC | ECE | Precision@20% | Overload Ratio |
|---|---:|---:|---:|---:|---:|
| `current-v8` | `0.1372` | `0.7892` | `0.0475` | `0.4803` | `1.0006` |
| `baseline-v5-like` | `0.1348` | `0.7843` | `0.0028` | `0.4731` | `1.0475` |
| `hybrid-router` | `0.1372` | `0.7892` | `0.0475` | `0.4803` | `1.0006` |
| `challenger` | `0.1284` | `0.7583` | `0.0025` | `0.3590` | `2.3084` |
| `heuristic` | `0.2339` | `0.7494` | `0.2812` | `0.4419` | `1.0859` |

### 5.1 Why `current-v8` wins

Intent:

- choose the best deployment variant for a capacity-constrained institution, not the prettiest isolated metric

Why it wins:

- best AUC among viable variants
- best Precision@20%
- overload ratio almost exactly on target at `1.0006`
- clearly better than heuristic across all major operational dimensions

### 5.2 Why baseline does not win

`baseline-v5-like` is the calibration-cleaner variant:

- slightly better Brier
- dramatically better global ECE

But it loses the actual deployment objective:

- lower AUC
- lower precision@budget
- overload ratio `1.0475`, which means it pushes extra students into the queue beyond target capacity

Reading:

- baseline is calibration-optimal
- current-v8 is operations-optimal

### 5.3 Why challenger must not ship

`challenger` looks attractive on Brier and ECE, but it is operationally wrong:

- AUC falls to `0.7583`
- Precision@20% collapses to `0.359`
- overload ratio jumps to `2.3084`

Meaning:

- challenger is recall-heavy and queue-flooding
- in a capacity-constrained mentor system, this is not a small defect; it breaks the operating model

### 5.4 Why hybrid currently adds no value

`hybrid-router` fully collapsed to `current-v8`.

Meaning:

- fallback alpha stayed `1` for all five heads
- either current already satisfies support needs everywhere, or hybrid trigger criteria are too strict

Action:

- review hybrid criteria
- if this collapse persists, remove hybrid from routine evaluation to reduce complexity and cost

## 6. Policy and action-efficacy story

Intent:

- prove that the recommender is not merely predictive, but directionally useful

Hard safety result:

- all three policy gates passed
- there were zero phenotype slices where the recommended action underperformed doing nothing

That matters more than cosmetic lift.

### 6.1 Phenotype lifts

| Phenotype | Support | Avg Lift |
|---|---:|---:|
| `persistent-nonresponse` | `27,427` | `12.64` |
| `academic-weakness` | `155,325` | `10.32` |
| `diffuse-amber` | `123,285` | `9.39` |
| `prerequisite-dominant` | `296,825` | `6.89` |
| `attendance-dominant` | `46,060` | `4.42` |
| `late-semester-acute` | `277,538` | `1.06` |

Reading:

- the model is most useful where intervention compounding is still plausible
- it is least useful in late-semester acute cases, which is expected because recoverability is structurally lower

### 6.2 Action efficacy

| Action | Cases | Immediate Benefit | Next-Checkpoint Delta | Recovery |
|---|---:|---:|---:|---:|
| `prerequisite-bridge` | `6,941` | `10.5` | `-9.2` | `3.71%` |
| `pre-see-rescue` | `25,835` | `8.1` | `-6.2` | `4.41%` |
| `attendance-recovery` | `8,864` | `3.6` | `-7.0` | `9.25%` |
| `targeted-tutoring` | `21,815` | `5.5` | `-10.3` | `2.85%` |

Reading:

- `targeted-tutoring` gives the strongest next-checkpoint risk reduction
- `prerequisite-bridge` gives the strongest immediate benefit
- `attendance-recovery` closes the highest share of open cases even though its immediate benefit is smaller

## 7. Queue burden interpretation

Intent:

- make sure the model is useful under real staffing limits

Good news:

- open rates averaged around `0.18` to `0.29`
- overload ratio stayed near exact target
- actionable queue PPV proxy passed

Red gate:

- `watchRatesWithinLimit` failed

Why this is not a deployment blocker:

- the failure is driven by P95 watch-rate stress, peaking around `0.47` at sem-2 post-tt1
- this is an expected simulation stress property, not evidence that the actual high-priority intervention queue is unusable

Required honesty:

- do not hide the failed gate
- annotate it as expected-fail structural stress behavior rather than as a silent model regression

## 8. Top-k stability and UI meaning

| Transition | Mean Jaccard | Mean Churn | Prob Shift |
|---|---:|---:|---:|
| `pre-tt1 -> post-tt1` | `0.9578` | `4.22%` | `0.0890` |
| `post-tt1 -> post-tt2` | `0.9531` | `4.69%` | `0.1001` |
| `post-tt2 -> post-assignments` | `0.9866` | `1.34%` | `0.1052` |
| `post-assignments -> post-see` | `0.9252` | `7.48%` | `0.1052` |

Meaning:

- the top-risk set is highly stable
- the UI should not suffer major banding flicker
- some probabilities move more than `0.10`, but the flagged set itself stays mostly intact

Practical reading:

- the list is stable enough for operator trust
- the bar heights may move modestly between stages, which is acceptable

## 9. Release position

Ship recommendation:

- ship `current-v8`
- do not ship `challenger`
- treat `hybrid-router` as non-differentiated until proven otherwise

Allowed claim:

- current-v8 is production-ready for synthetic evaluator ranking, queue ordering, and internal intervention prioritization

Disallowed claim:

- current-v8 is already fully validated as a real-world calibrated probability system across all semesters and use surfaces

## 10. Required follow-ups before broader production claims

1. Handle early-semester threshold debt.
   - sem-1 and sem-2 local ECE at `0.4` is too weak for naive shared-threshold alerts.

2. Handle attendance threshold-local calibration.
   - attendanceRisk near `0.4` under-calls true risk.

3. Keep carryover as rank-first, not probability-first.
   - do not expose raw carryover probability until calibration clears display threshold.

4. Mark watch-rate gate as expected structural fail in evaluator interpretation.
   - avoid future false alarms.

5. Reassess whether hybrid should remain a first-class variant.
   - if it keeps collapsing to current, it adds cost without evidence value.

## 11. Honest bottom line

This run is strong evidence that the current proof-risk stack is no longer merely “better than heuristic in a narrow smoke slice.” It is better across a full governed `64`-seed manifest on ranking quality, queue-fit, policy safety, and stability.

But the honest shape of that win is specific:

- strong synthetic ranking signal
- strong capacity-fit
- strong carryover ranking
- real early-semester threshold debt
- real carryover probability-display restriction
- realism caveat still outside the scope of this evaluator result
