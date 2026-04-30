# Scenario Grounding — 8 Families → Literature

> Phase: P1 (task 1.4)
> Companion: `docs/references.bib`, `docs/paper-evidence/01-literature-table.md`
> Date: 2026-05-01

The scenario engine in `air-mentor-api/src/lib/msruas-proof-control-plane.ts:988-1036`
draws each synthetic semester from one of 8 scenario families. A
seed-derived family is then perturbed by random domain shifts to produce
a `ScenarioProfile`. This file maps each family to a documented
retention-failure mode in the literature so that:

1. The paper Methods section can name the literature anchor for each.
2. The reviewer who asks "where do these synthetic populations come
   from?" has a one-line answer per family.
3. Future P2 sensitivity sweeps know which dimensions are the load-bearing
   ones for each family (the dimensions whose shift magnitudes are
   non-zero are the family's "fingerprint").

---

## Scenario fingerprint table

The perturbation vector applied to each family. Bold values are the
family's load-bearing dimension(s); the rest are noise margin.

| Family | abilityShift | disciplineShift | forgetRateShift | courseworkReliabilityShift | examPressureShift | supportResponsivenessShift |
|---|---|---|---|---|---|---|
| weak-foundation | **−0.09** | −0.01 | +0.02 | −0.01 | +0.04 | −0.02 |
| low-attendance | −0.01 | **−0.08** | +0.01 | 0 | +0.02 | −0.04 |
| high-forgetting | 0 | −0.01 | **+0.07** | −0.02 | +0.03 | −0.02 |
| coursework-inflation | −0.02 | +0.02 | +0.01 | **+0.08** | +0.01 | 0 |
| exam-fragility | −0.01 | 0 | +0.02 | +0.01 | **+0.08** | −0.01 |
| carryover-heavy | **−0.05** | −0.01 | +0.03 | −0.01 | +0.03 | −0.02 |
| intervention-resistant | −0.02 | −0.02 | +0.02 | −0.02 | +0.04 | **−0.09** |
| balanced | 0 | 0 | 0 | 0 | 0 | 0 |

Code source: `msruas-proof-control-plane.ts:988-1036`.

---

## Per-family literature mapping

### 1. `weak-foundation`

- **Failure mode:** students enter the cohort with prior preparation
  meaningfully below the curriculum's assumed baseline; cumulative gap
  widens semester by semester.
- **Literature anchor:** Tinto's *academic integration failure* model
  (`tinto1975dropout`, `tinto1993leaving`) — students whose academic
  preparation is below institutional expectation show systematic
  attrition irrespective of intervention quality. Astin's involvement
  framework (`astin1984student`) provides a complementary lens:
  underprepared students engage less because surface-level
  comprehension consumes the available involvement budget.
- **Fingerprint dimension:** `sectionAbilityShift = −0.09` is the
  primary signal. Discipline and exam-pressure perturbations are
  secondary.
- **Expected paper claim:** the engine reproduces the Tinto pattern
  where academic-integration shortfall is the dominant dropout driver
  in the first three semesters.

### 2. `low-attendance`

- **Failure mode:** chronic class-skipping erodes scheduled exposure;
  knowledge accretion stalls relative to the reference cohort.
- **Literature anchor:** Credé et al. meta-analysis
  (`crede2010class`, k=69, N=21,195, ρ=0.44 attendance-grade,
  ρ=0.41 attendance-GPA) and Marburger's panel study
  (`marburger2001absenteeism`).
- **Fingerprint dimension:** `sectionDisciplineShift = −0.08`. Support
  responsiveness drops by `−0.04` because absent students don't
  benefit from in-class scaffolding.
- **Expected paper claim:** the engine generates the Credé attendance
  → grade gradient at synthetic-population scale.

### 3. `high-forgetting`

- **Failure mode:** rapid decay between exposure and assessment; the
  spacing-effect literature predicts performance loss when retention
  intervals exceed practice intervals.
- **Literature anchor:** Cepeda et al. spacing meta-analysis
  (`cepeda2006spacing`); Pashler et al. NCER practice guide
  (`pashler2007organizing`); Ebbinghaus replication
  (`murre2015replication`); foundational Ebbinghaus (`ebbinghaus1885memory`).
- **Fingerprint dimension:** `forgetRateShift = +0.07` (≈ matches
  Cepeda's reported retention-decay sensitivity in repeated-recall
  tasks; the exact magnitude is engineering-calibrated).
- **Expected paper claim:** the engine reproduces the spacing-failure
  signature where TT2 and SEE diverge from TT1 with a steeper slope
  than the baseline cohort.

### 4. `coursework-inflation`

- **Failure mode:** too many concurrent active demands; quality of
  engagement per task drops; coursework grades become noisy and
  weakly correlated with skill.
- **Literature anchor:** Astin's involvement theory
  (`astin1984student`) — quantity of involvement does not equal quality;
  excessive load fragments attention.
- **Fingerprint dimension:** `courseworkReliabilityShift = +0.08`
  (positive shift means **less reliable**, more noise around the
  underlying ability signal).
- **Expected paper claim:** the engine produces a population whose
  coursework correlation with SEE is materially lower than the
  baseline cohort, matching the Astin "overload" prediction.

### 5. `exam-fragility`

- **Failure mode:** students whose preparation is normal but who
  underperform under exam pressure (test anxiety).
- **Literature anchor:** Zeidner's test-anxiety synthesis
  (`zeidner1998test`).
- **Fingerprint dimension:** `examPressureShift = +0.08`. Coursework
  reliability is mildly positive (+0.01) because coursework grades
  reflect the unstressed state; SEE drops disproportionately.
- **Expected paper claim:** the engine reproduces Zeidner's
  characteristic gap between coursework competence and exam
  performance.

### 6. `carryover-heavy`

- **Failure mode:** unresolved backlog from prior semesters compounds
  with current load; recovery becomes increasingly improbable as
  cumulative deficit grows.
- **Literature anchor:** Tinto cumulative-cascade model
  (`tinto1993leaving`); Bean-Eaton psychological-barriers theory
  (`bean2001psychology`) — repeated failure conditions a non-response
  state.
- **Fingerprint dimension:** `sectionAbilityShift = −0.05` plus
  `forgetRateShift = +0.03` plus `examPressureShift = +0.03` —
  multi-dimensional drift rather than a single load-bearing axis.
- **Expected paper claim:** the engine reproduces the cumulative-cascade
  signature where each successive semester depresses outcomes more
  than the prior one (super-linear failure curve).

### 7. `intervention-resistant`

- **Failure mode:** students do not respond to support and mentor
  interventions; psychological barriers maintain behaviour even when
  scaffolding is offered.
- **Literature anchor:** Bean-Eaton psychological-barriers theory
  (`bean2001psychology`); Tinto persistence model
  (`tinto1993leaving`).
- **Fingerprint dimension:** `supportResponsivenessShift = −0.09`. This
  is the only family where support-responsiveness is the load-bearing
  axis.
- **Expected paper claim:** the engine produces a population whose
  post-intervention recovery score (`recoveryAfterIntervention` in
  `msruas-proof-control-plane.ts:1234`) stays in the lower tail
  regardless of intervention frequency, matching Bean-Eaton's
  prediction.

### 8. `balanced`

- **Failure mode:** none. This is the **deliberate null/control
  family**: ability is at the cohort mean, no behavioural perturbation,
  no deficit. Used as the reference distribution for sensitivity sweeps
  and as the negative-class rich population.
- **Literature anchor:** none — engineering choice.
- **Fingerprint dimension:** all zeros.
- **Expected paper claim:** the balanced family yields the lowest
  proportion of high-risk classifications; its presence in the test
  split (per the P2 generative-process plan) is the bias check on the
  scoring engine.

---

## How this maps to the P2 generative-process split (preview)

The P2 plan (roadmap §5 P2 task 2.1) splits families into train / val /
test groups so that no family contributes to more than one split:

```
train   weak-foundation, low-attendance, high-forgetting, coursework-inflation
val     exam-fragility, carryover-heavy
test    intervention-resistant, balanced
```

This file is the input contract for that split. Note that the 8 families
span 4 broad failure-mode classes:

- **Cognitive deficit**: weak-foundation, high-forgetting (train mix
  weighted in this class)
- **Engagement deficit**: low-attendance, coursework-inflation (train
  mix represents these)
- **State-dependent**: exam-fragility, carryover-heavy (val — the model
  must generalise to a held-out class within this group)
- **Barrier / control**: intervention-resistant, balanced (test — the
  hardest generalisation case)

If P2 sensitivity sweeps reveal the engine collapses on the val/test
classes, the paper claim N1 must be downgraded from "reproduces failure
modes" to "reproduces in-distribution failure modes" (and the
adversarial-corpus stretch goal in roadmap P2 task 2.4 becomes
mandatory rather than stretch).

---

## Reviewer questions this file pre-empts

| Likely reviewer question | Answer location |
|---|---|
| "Why these 8 families and not 5 or 12?" | The paper Methods will state: 8 covers the four broad failure-mode classes with a positive control. We do not claim exhaustiveness. |
| "Where do the magnitudes come from?" | Engineering, calibrated against synthetic corpus. P2 sensitivity sweep (task 2.3) defends them with ±20% AUC delta. |
| "Why no Replicate-Real-Cohort family?" | Out of scope per `docs/POSITIONING.md` choice A. Listed in Limitations. |
| "Are families mutually exclusive in the simulator?" | Yes, by code construction (`scenarioFamilyForSeed` returns one). Real students are usually a mix; this is an honest limitation listed in the paper. |
