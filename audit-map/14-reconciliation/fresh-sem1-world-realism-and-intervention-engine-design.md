# Fresh-Sem1 World Realism + Intervention Engine — Architectural Design

**日期**：2026-04-23
**scope**：bridge for master §H (intervention response) + §I.Phase-7..11 (ML correctness) + user-request realistic per-stage mark distribution mirroring intervention effect.
**non-goals**：no `src/**/*.tsx` edit, no UI/UX behavior change, no route change, no destructive migration.
**UI/UX 保**：all new code lives in `air-mentor-api/src/lib/` + tests. integration points = (1) 3-line hook in `proof-control-plane-advance-service.ts` post `persistResolvedAdvance`; (2) `recommendedAction` text-source swap in queue projection. text content 改，UI shape 不动.

## A. 現狀 audit (honest base)

### A.1 mark gen — upfront one-shot (核 realism gap)

`msruas-proof-control-plane.ts:1585-1737` `simulateSemesterCourse` 於 run activation 一次性计所有 course × 所有 sem × 所有 student 之 marks. linear-additive + `stableBetween(...)` uniform noise + clamp. 呼叫点：`buildSeededHistoricalSemesterRows` (sem 1-5) + `buildSeededSemesterSixRows` (sem 6). 即所有 stage marks 已落 DB on activation. `Next Stage` / `Next Day` 只 swap `activeStageKey`/`simulatedDateIso`, 不 re-materialize marks.

### A.2 trajectory rich 但未 exploit

`buildStudentTrajectory` @ `:1474-1561` — 41 latent fields per student. `simulateSemesterCourse` 用 ~12. 未用 15+ 字段 (forgetRate/relearnRate/studyGainRate/fatigueRate/consistency/volatility/recoveryTendency/relapseTendency/transferGainRate/partialCreditConversion/carelessErrorRate/timePressureSensitivity/temporaryUpliftCredit/expectedRecoveryThreshold/multiStepBreakdownRisk) — 正是 intervention-response + realistic-decay 所需.

### A.3 scenario family — 8 已定义

`msruas-proof-control-plane.ts:950-1009`. `ScenarioProfile` 字段 (sectionAbilityShift/sectionDisciplineShift/forgetRateShift/courseworkReliabilityShift/examPressureShift/supportResponsivenessShift) 定义 8 families：balanced/weak-foundation/low-attendance/high-forgetting/coursework-inflation/exam-fragility/carryover-heavy/intervention-resistant.

### A.4 intervention wiring — 残缺

- historical side (sem ≥3 only)：`proof-control-plane-seeded-semester-service.ts:170-226` 录 `studentInterventionResponseStates` with `residual`. 无 stage-mark 反馈.
- stage evidence side：`proof-control-plane-playback-service.ts:203-207` `pickInterventionResponseForStage` returns residual at post-tt2/post-assignments/post-see. feeds `interventionResponseScore` inference driver only.
- counterfactual side：`proof-control-plane-playback-service.ts:209-237` `counterfactualAdjustment(actionTaken)` = fixed-penalty map (attendancePenalty/tt2Penalty/seePenalty/weakSignalPenalty/consistencyBuff per action). 是 §I.Phase-11 所指 "fixed penalty replay" — 非 simulator-based，非 Section H 形.
- **Section H engine 零 match**：`grep responseProfile|responseScore|consistencyScore|supportCompatibility` → 0 (前 agent 确认 2026-04-23 23:10Z).

### A.5 advance — chain-nav only

`proof-control-plane-advance-service.ts:189-234` `resolveProofAdvance` 只 chain navigation + date bump. `autoResolutionMode='post-see-open-cases-may-auto-resolve'` 只 signal queue governance. 不 触 re-simulation.

### A.6 ML 状态

- schema v5 = 43 obs + 2 missingness flags = 45 total (`proof-risk-model.ts:21-74`).
- serving = `logit-v7` (overload 1.1127, ROC 0.7894). v8 interim. Beta 3/5 regress. CatBoost 0/5 pass 5-gate.
- recommended-action = 3 静态 string (`inference-engine.ts:184-188` + copy in `proof-risk-model.ts:2152-2156`):
  - High → 'Immediate mentor follow-up and reassessment before the next evaluation checkpoint.'
  - Medium → 'Schedule a monitored reassessment and review the current intervention plan.'
  - Low → 'Continue routine monitoring on the current evidence window.'

### A.7 queue → UI contract

`academic.ts:968-1029` `buildProofWorkflowTaskFromQueueProjection` 用 `recommendedAction` 构造 `title` + `actionHint`. 字段 shape 固定；content opaque 于 UI. **换 text 不 break UI**.

## B. 核心 shift — mark realization strategy (决断)

| opt | desc | realism | touch | risk |
|:-:|---|:-:|:-:|:-:|
| A | keep upfront. delta at score-time only. marks frozen; risk shifts | low | ~50 LOC | demo 穿帮 (mark 不 change) |
| B | full per-stage realization. generate only up to current stage; gen next on advance | high | ~1200 LOC (activation + seeded-sem-service rewrite) | high (demo-critical path) |
| **C** | **hybrid: upfront = baseline (no-intervention) trajectory. on stage advance, materialize current-stage marks = baseline + cumulative intervention delta. feature-flagged** | **high** | **~600 LOC; 3 new modules + 1 hook + flag** | **low (flag-gated A/B)** |

**推**：Option C.

**why C**:
1. master §H.10 "deterministic bounded deltas, not free random noise" → C 实此于 baseline-on-top delta.
2. §H.11 "same seed + same actions → identical behavior" → seed key `runId::studentId::sem::stage::caseId::actionCode` → bytewise replay.
3. §P.D "Final analytics with-vs-without intervention" → C 自留 baseline = no-intervention branch (§I.Phase-11 simulator requirement met for free).
4. UI/UX 保：DB schema 不变；consumer 不需知是 baseline or re-materialized.
5. flag-able：`AIRMENTOR_MARK_REALIZATION_V1=1`. off → current behavior. on → delta engine.

## C. 模组设计

### C.1 `proof-intervention-response-engine.ts` (new, ~250 LOC)

pure fn module, no DB. 实 master §H literally.

```ts
export type ResponseProfile = 'strong' | 'partial' | 'weak' | 'resistant'
export const RESPONSE_SCORE_BY_PROFILE = {
  strong: 0.85, partial: 0.60, weak: 0.35, resistant: 0.15,
} as const

export const BASE_ACTION_WEIGHT = {
  mentor_meeting: 0.55,
  faculty_followup_reminder: 0.45,
  attendance_warning: 0.50,
  extra_academic_support_plan: 0.75,
  targeted_remedial_plan: 0.80,
  hod_escalation_student_action: 0.65,
  structured_study_plan: 0.70,
  peer_study_group: 0.40,
  generic_default_family_action: 0.50,
} as const

// deterministic — weighted by studentProfile.intervention.interventionReceptivity + behavior.practiceCompliance
export function deriveResponseProfile(input: {
  runId: string
  studentId: string
  studentProfile: StudentTrajectory['profile']
}): { profile: ResponseProfile; responseScore: number; consistencyScore: number }

// match: concernFamily ↔ actionCode dominant. 1.10/1.00/0.90 scaled by interventionReceptivity soft-cap [0.7, 1.3]
export function supportCompatibility(input: {
  actionCode: ProofInterventionActionCode
  concernFamily: ProofQueueConcernFamily | null
  studentProfile: StudentTrajectory['profile']
  dominantWeaknessHint: 'attendance' | 'coursework' | 'exam' | 'broad' | 'mentoring' | null
}): number

// Sem2+ pre-tt1 → 1.10; post-tt1 → 1.00; post-tt2 → 0.85; post-assignments → 0.70; post-see → 0.50
export function stageFactor(stageKey: PlaybackStageKey, semesterNumber: number): number

// mild 1.00 / moderate 0.85 / severe 0.70 / extreme 0.55 from (riskBand, cgpa, backlog)
export function severityPenalty(band: 'High'|'Medium'|'Low', cgpa: number, backlog: number): number

// 1st 1.00, 2nd 0.60, 3rd+ 0.35 cap
export function repeatPenalty(ordinal: number): number

// §H.8 formula. tier: ≥0.65 strong / ≥0.35 partial / else weak
export function computeInterventionImpact(
  app: InterventionApplication,
  studentProfile: StudentTrajectory['profile'],
): { impact: number; tier: 'strong'|'partial'|'weak'; breakdown: {...} }

// workflow-only (approval/unlock/faculty_followup_reminder) return false per §H.13
export function isStudentFacing(actionCode: ProofInterventionActionCode): boolean
```

**seed chain**：every draw keyed `${runId}::${studentId}::${sem}::${stage}::${caseId}::${actionCode}` → bytewise replay.

### C.2 `proof-world-realism-engine.ts` (new, ~180 LOC)

math helpers. pure fn.

```ts
// replaces stableBetween uniform noise with truncated-normal (bell)
export function stableTruncatedNormal(s: { seed: string; mean: number; stdev: number; min: number; max: number }): number

// anchored Beta — realistic mark draw given per-student anchor + volatility-controlled concentration
// α = anchor × κ + 1; β = (1 − anchor) × κ + 1; κ = clamp(35 × (1 − volatility), 6, 50)
// u = stableUnit(seed); x = betaQuantile(u, α, β)
export function stableAnchoredBeta(s: { seed: string; anchor: number; concentration: number }): number

// per-assessment realized mark: raw ← stableAnchoredBeta(anchor = baseline/100) × 100; then raw + interventionDeltaPct; clamp per-assessment
export function realizeAssessmentMark(s: {
  seed: string
  assessmentType: 'attendance'|'tt1'|'tt2'|'quiz'|'assignment'|'see'
  anchorPct: number  // baseline from simulateSemesterCourse
  student: StudentTrajectory['profile']
  interventionDeltaPct: number
}): number

// forget-decay between stages
// decay = forgetRate × (daysElapsed / 14). if intervention in window: × (1 − relearnRate × 0.4). in [0, 0.3]
export function applyForgetDecay(s: {
  studentProfile: StudentTrajectory['profile']
  daysElapsedSinceLastEngagement: number
  hadInterventionInWindow: boolean
}): number
```

### C.3 `proof-mark-realization-service.ts` (new, ~220 LOC)

integration layer. called from `persistResolvedAdvance` after stage transition.

```ts
export async function realizeStageMarksIfEnabled(db: AppDb, input: {
  simulationRunId: string
  previousStageKey: StagePolicyStageKey
  currentStageKey: StagePolicyStageKey
  currentSemesterNumber: number
  runSeed: number
  policy: ResolvedPolicy
  stagePolicy: StagePolicyPayload
  now: string
}): Promise<{ realized: boolean; deltaSummary: StageDeltaSummary | null }> {
  if (process.env.AIRMENTOR_MARK_REALIZATION_V1 !== '1') return { realized: false, deltaSummary: null }

  // 1. load baseline marks (from existing DB rows — written at activation by seeded pipeline)
  // 2. load intervention applications in window (prev-stage-close → current-stage-open) with concernFamily + caseId + actionCode
  // 3. per student × course × assessment:
  //    a. responseProfile (cached per student+run)
  //    b. Σ interventionImpact over window (capped per §H.12)
  //    c. markDelta via ASSESSMENT_RESPONSIVENESS table
  //    d. realized = realizeAssessmentMark(seed, type, baseline/100, profile, delta)
  //    e. UPDATE student_assessment_scores / student_question_results / student_co_states
  // 4. re-derive cePct, overallMark, gradeLabel, result via evaluateCourseStatus
  // 5. emit 'stage-marks-realized' audit + return deltaSummary
}

const ASSESSMENT_RESPONSIVENESS = {
  attendance: { min: -2, max: 10 },
  tt2:        { min: -2, max: 14 },  // most plastic post-TT1 intervention
  quiz:       { min: -1, max:  9 },
  assignment: { min: -1, max: 11 },
  see:        { min: -2, max: 13 },
  // tt1 cannot be realized (already happened)
} as const
```

### C.4 `proof-recommendation-text-generator.ts` (new, ~180 LOC)

replaces 3-static-string with deterministic templated text.

```ts
export type RecommendationTextInput = {
  riskBand: 'High'|'Medium'|'Low'
  stageKey: PlaybackStageKey
  semesterNumber: number
  topDrivers: ObservableDriver[]  // sorted, from inferObservableDrivers
  currentCgpa: number | null
  backlogCount: number | null
  activeInterventionHistory: {
    appliedCount: number
    lastTier: 'strong'|'partial'|'weak' | null
    lastActionCode: ProofInterventionActionCode | null
    consecutiveSevereStages: number
  }
  deferHodFlag: boolean
}

// rule: High + (backlog≥2 OR consecSevere≥2 OR cgpa<4.5) + lastTier!=='strong'
export function deriveDeferHod(s: { riskBand; currentCgpa; backlogCount; consecutiveSevereStages; lastTier }): boolean

export function generateRecommendationText(input: RecommendationTextInput): {
  headline: string       // queue title prefix
  rationale: string      // queue actionHint (2-3 sentence)
  suggestedActions: ProofInterventionActionCode[]
  metricsSummary: string // "attendance 28%, TT1 32%, CGPA 4.8, backlog 2"
  deferTo: 'Mentor'|'Course Leader'|'HoD'
}
```

**example output (deterministic)**：

input：High + post-tt2 + sem3 + drivers=[attendance28%, tt1 32%, weakCo 3] + cgpa=4.8 + backlog=2 + consecutiveSevere=2 + lastTier=weak + deferHod=true

output：
- headline：`"Escalate to HoD: repeated severe risk despite 2 prior interventions"`
- rationale：`"High-risk pattern persists across 2 consecutive stages. Attendance 28% (well below 75% threshold), TT1 32%, and 3 weak course outcomes indicate broad academic struggle. Prior intervention (weak tier) did not produce recovery. Escalate to Head of Department for corrective plan."`
- suggestedActions：`['hod_escalation_student_action']`
- metricsSummary：`"attendance 28%, TT1 32%, CGPA 4.8, backlog 2"`
- deferTo：`'HoD'`

vs current ("Immediate mentor follow-up and reassessment...") — 无 metric、无 history、无 defer-logic.

### C.5 ML feature schema bump — v6

`proof-risk-model.ts:21-74` add 4 fields：

```ts
'cumulativeInterventionImpactScaled',
'lastInterventionTierScaled',     // 0 / 0.15 / 0.35 / 0.60 / 0.85
'stageResponseLagScaled',         // stages since last intervention, normalized
'consecutiveSevereStagesScaled',
```

`RISK_FEATURE_SCHEMA_VERSION = 'observable-risk-features-v6'` (bump from v5).

backward-compat：empty history → all 4 = 0. Existing v5 artefacts gracefully degrade.

after v6 lands + corrected corpus exported (existing Ticket 4) → retrain v8-v6 logistic + Beta + CatBoost → promote if 5-gate pass.

## D. 数学 model

### D.1 realistic mark distribution (anchored Beta)

current：`tt1Pct = clamp(24 + mastery×42 + … + stableBetween(seed, -14, 12), 8, 97)` — uniform noise → too-flat histogram.

replacement (realized-mark layer)：

```
μ = linearBase / 100                  # anchor from existing simulateSemesterCourse
κ = clamp(35 × (1 − volatility), 6, 50)  # concentration; low-volatility = tight
α = μ × κ + 1
β = (1 − μ) × κ + 1
u = stableUnit(`${runSeed}::${studentId}::${courseId}::${stageKey}::${assessmentType}::realize`)
x = betaQuantile(u, α, β)
raw = x × 100
realized = clamp(raw + interventionDeltaPct, assessmentMin, assessmentMax)
```

betaQuantile via regularized incomplete beta inversion (Numerical Recipes §6.4 Newton iteration on `betainc`, 10 iter, tol 1e-7) — all integer arith once α+β ≤ 60, stable.

### D.2 intervention delta (§H.8 + assessment responsiveness)

per intervention application i in window [prevStageClose, currentStageOpen]：

```
responseScore = RESPONSE_SCORE_BY_PROFILE[deriveResponseProfile(runId, studentId, profile).profile]
compat = supportCompatibility(action_i, concernFamily_i, profile, dominantWeaknessHint)
stage = stageFactor(stageKey_applied_i, sem)
sev = severityPenalty(riskBand_i, cgpa_i, backlog_i)
repeat = repeatPenalty(ordinalInStage_i)

impact_i = BASE_ACTION_WEIGHT[action_i] × responseScore × compat × stage × sev × repeat
tier_i = impact_i ≥ 0.65 ? 'strong' : impact_i ≥ 0.35 ? 'partial' : 'weak'
```

per-stage cumulative impact (capped per §H.12)：
```
totalImpact = min(0.95, Σ_i [ isStudentFacing(action_i) ? impact_i : 0 ])
```

markDelta per assessment (sign convention: positive = improvement)：
```
tierMultiplier = tier = 'strong' ? 1.00 : tier = 'partial' ? 0.55 : 0.15
responsivenessRange = ASSESSMENT_RESPONSIVENESS[assessmentType]
baseDelta = totalImpact × (responsivenessRange.max - responsivenessRange.min) × tierMultiplier
markDelta = clamp(baseDelta, responsivenessRange.min, responsivenessRange.max)
```

example walk-through (sem3, post-tt2, student midRisk, 1 mentor_meeting + 1 structured_study_plan; responseProfile=partial → responseScore=0.60; both student-facing; dominantWeakness=coursework → structured_study_plan compat=1.10, mentor_meeting compat=1.00)：

```
mentor_meeting:    0.55 × 0.60 × 1.00 × 0.85 × 0.85 × 1.00 = 0.238 (weak tier)
structured_study:  0.70 × 0.60 × 1.10 × 0.85 × 0.85 × 0.60 = 0.200 (weak tier, 2nd ordinal)
totalImpact = 0.438 (capped at 0.95)
tt2 delta = 0.438 × (14 − (−2)) × 0.15 = 1.05 pct points  # weak tier mult
see delta = 0.438 × (13 − (−2)) × 0.15 = 0.99 pct points
```

realistic bounded shift. if responseProfile=strong → responseScore=0.85 → impact≈0.62 (strong tier) → tt2 delta ≈ 7.0 pct. same seed+actions reproducible.

### D.3 forget-decay between stages

pre-existing `forgetRate` ∈ [0.02, 0.28] already computed per student. apply at realization:

```
daysElapsed = daysBetween(prevStageOpen, currentStageOpen)
hadIntervention = totalImpact > 0
decay = forgetRate × (daysElapsed / 14)
if hadIntervention: decay × (1 − relearnRate × 0.4)
decay = clamp(decay, 0, 0.3)

anchorAdjusted = μ × (1 − decay)   # shift anchor down by decay fraction
```

so long-no-engagement + high-forget student without intervention → drifts down; with intervention → decay attenuated by relearn.

## E. implementation order (phased, parallel-safe bands marked)

### phase A — new modules (parallel-safe; distinct new files)

- **A1**：`proof-intervention-response-engine.ts` + `tests/proof-intervention-response-engine.test.ts`
- **A2**：`proof-world-realism-engine.ts` + `tests/proof-world-realism-engine.test.ts`
- **A3**：`proof-recommendation-text-generator.ts` + `tests/proof-recommendation-text-generator.test.ts`
- **A4**：types/consts extraction in new `proof-intervention-response-types.ts` (shared type file) + `tests/..-types.test.ts`

safe to create all 4 module pairs in one cascade-block (4 `write_to_file` + 4 `write_to_file` = 8 independent calls) — 零 file overlap.

### phase B — integration hooks (sequential; touches existing files)

must sequence: each touches existing live code.

- **B1**：add `realizeStageMarksIfEnabled` hook in `proof-control-plane-advance-service.ts` `persistResolvedAdvance` (after `rebuildSimulationStagePlayback` call). flag-gated.
- **B2**：`proof-mark-realization-service.ts` (new, but depends on A1+A2 exports).
- **B3**：feature schema v6 in `proof-risk-model.ts` — bump `OBSERVABLE_FEATURE_KEYS` + `RISK_FEATURE_SCHEMA_VERSION`. update `featureVectorFromPayload` + `featurePayloadFromEvidence` derivers.
- **B4**：queue projection `recommendedAction` text swap — in `proof-queue-governance.ts` or caller that writes `simulationStageQueueProjections.recommendedAction`. pipe through `generateRecommendationText`.

### phase C — validate

- **C1**：`npx tsc -p air-mentor-api/tsconfig.json --noEmit` green
- **C2**：vitest new test files green
- **C3**：determinism: rerun same-seed same-actions twice → bytewise identical output (all 4 modules + integration)
- **C4**：v5 feature-schema artefacts continue to serve (backward-compat)

### phase D — ML retrain (depends on C + corrected corpus)

- **D1**：export corrected corpus on v6 schema (from fresh pg, seeds ≥ coverage-24)
- **D2**：rerun `train_v8_local_corrected_logistic.py` + `beta_calibrate_v8_local.py` + `train_catboost_challenger_local.py` on v6 corpus
- **D3**：5-gate promotion eval — if pass → swap serving from v7 → v8-v6; else keep v7

## F. parallelization safety (this session)

### F.1 cascade agent level (proven throughout this session)

- 独立 tool call 并 in one block (本 session 用 multi-file `read_file` × 4 + `grep_search` × 3 并 in 单个 response)
- dependent call 分 block 序 (e.g., `read_file` → `edit` 必分)
- 无 shared-state race — tool calls atomic on filesystem
- 本 session 之证：`list_dir` × 2 + `grep_search` × 2 + `read_file` × 3 皆 parallel, 零 conflict

### F.2 context preservation cross-model/cross-session

current session：所有 context 于单一 chat，无 handoff needed. 持久化 via：
- MD artefact on disk (this file + 其他 audit-map/14-reconciliation/*.md)
- DB rows (intervention_response_states / simulation_runs / stage_checkpoints)
- git commit (every incremental impl = signed commit)

if future session opens：read `audit-map/14-reconciliation/fresh-sem1-world-realism-and-intervention-engine-design.md` + `fresh-sem1-master-prompt-followup-tickets.md` + last commit — 零 context loss.

### F.3 pipeline DAG level (已证 reference, not used this session)

- worktree.prepare() per-task = filesystem isolation
- merge_controller.merge_lock (SQLite+fcntl) = shared-ledger write race-free
- busy_account_keys = quota overlap protection
- write_scope_glob validator = cross-task overlap gate
- briefing.py 3-layer (MD artefact + DB result_json + briefing_path) = cross-slot context redundancy

### F.4 hybrid path proven (reference)

this session之前 user 确认 local-shim (deterministic python) + codex (high-reasoning impl) hybrid proven — t57/t58/t59 local, t50-t55 codex. scheduler state-machine atomic via SQLite WAL. 本 session 不用 pipeline per user request, 但 pattern retained for future.

## G. UI/UX no-touch 证

all work localized to：
- `air-mentor-api/src/lib/proof-intervention-response-engine.ts` (new)
- `air-mentor-api/src/lib/proof-world-realism-engine.ts` (new)
- `air-mentor-api/src/lib/proof-mark-realization-service.ts` (new)
- `air-mentor-api/src/lib/proof-recommendation-text-generator.ts` (new)
- `air-mentor-api/tests/proof-*.test.ts` (new × 4)
- `air-mentor-api/src/lib/proof-control-plane-advance-service.ts` (+3 LOC hook)
- `air-mentor-api/src/lib/proof-queue-governance.ts` (text-source swap, no schema change)
- `air-mentor-api/src/lib/proof-risk-model.ts` (feature-key additions + schema version bump, backward-compat)

zero `src/**/*.tsx` changes. zero routes. zero UI component touched.

UI consumer integration point：`academic.ts:buildProofWorkflowTaskFromQueueProjection` reads `recommendedAction` + uses as `title` prefix + `actionHint` fallback. swap 只改 string content；shape 同.

## H. test contract (per module)

### H.1 intervention-response-engine
- `deriveResponseProfile` idempotent across 1000 reruns (bytewise JSON)
- `computeInterventionImpact` matches §H.8 hand-computed to 1e-6
- tier boundaries exact at 0.35 + 0.65
- repeat penalty stacks + caps at 0.35
- workflow action → `isStudentFacing=false` → impact=0 (not applied)
- same (runId, studentId, args) → identical bytewise
- profile distribution monte-carlo: receptivity=0.9 student → ≥60% strong/partial profile across 1000 draws; receptivity=0.2 → ≥60% weak/resistant

### H.2 world-realism-engine
- `stableTruncatedNormal` histogram on 10000 samples matches truncated-normal mean/var analytic to 2 decimal
- `stableAnchoredBeta(anchor=0.3, κ=20)` mode ≈ 0.3 (±0.02) over 10000 samples
- `stableAnchoredBeta(anchor=0.8, κ=50)` tight cluster (std ≤ 0.05)
- `realizeAssessmentMark` + intervention delta 0 → ≈ anchor × 100 ± small noise
- `realizeAssessmentMark` + positive delta → mean shifts up by delta over 1000 seeds
- `applyForgetDecay` daysElapsed=14 forgetRate=0.2 no-intervention → 0.2 exactly; with intervention relearn=0.5 → 0.16

### H.3 mark-realization-service
- flag off → returns `{realized: false}` no DB write
- flag on + no intervention in window → marks unchanged (baseline = realized)
- flag on + 1 strong intervention → tt2/see move up by expected delta
- flag on + 1 weak intervention → tt2/see move up by smaller delta
- flag on + workflow-only intervention → marks unchanged
- determinism: 2 runs same seed same interventions → identical UPDATE row-set

### H.4 recommendation-text-generator
- `deriveDeferHod` truth table exhaustive (8 cases)
- `generateRecommendationText` outputs match snapshot for 6 canonical scenarios
- bytewise identical for same input
- `suggestedActions` always non-empty for riskBand=High unless deferHod
- `deferTo` in {Mentor, Course Leader, HoD} always

### H.5 ML v6 schema
- `featureVectorFromPayload` length = 49 (45 existing + 4 new)
- v5 artifact + v6 schema → graceful fallback (4 new features = 0)
- `scoreObservableRiskWithModel` + v6 artefact + history → nonzero contribution from cumulativeInterventionImpact
- deterministic: same payload → same score bytewise

### H.6 integration (advance-service hook)
- flag off → `realizeStageMarksIfEnabled` returns false
- flag on + transition pre-tt1 → post-tt1 → marks realized
- flag on + transition within same stage (next-day no-cross) → no realization
- 2 runs same seed same advance sequence → identical DB state

## I. risk register

| risk | sev | mitig | rollback |
|---|:-:|---|---|
| feature flag leak to prod | HIGH | env check + unit test | unset AIRMENTOR_MARK_REALIZATION_V1 |
| betaQuantile numerical instability at extremes | MED | Newton tol 1e-7, 10 iter cap, fallback to anchor | existing uniform noise path |
| intervention delta spam exploit | MED | §H.12 cap 0.95 + repeatPenalty 0.35 floor + per-stage cap | logic-test |
| v5 → v6 artefact migration break | MED | backward-compat: empty history → 0-fill | keep v5 artefacts as fallback |
| recommendation text regresses demo | LOW | snapshot tests + A/B text flag | revert to static 3-string |
| forget-decay breaks baseline replay | LOW | decay only applied in realization path, baseline untouched | flag off |

## J. open decision points (need user confirm before code)

1. **mark realization strategy** — Option A/B/C above. recommend C.
2. **realization scope** — realize only stage-of-advance, or realize retroactive stages if run reset mid-flight? recommend "stage-of-advance only" (keep baseline untouched).
3. **intervention scope** — only queue-governance-created cases, or include manually-created teacher cases? recommend "both, but only student-facing actions per §H.13 filter".
4. **text generator style** — 5 template variants per (band × stage × defer), or full combinatorial 75? recommend 5 template variants + metric substitution (smaller surface, easier snapshot testing).
5. **ML retrain timing** — retrain v8-v6 immediately after B3 lands, or wait for corrected corpus from Ticket 4? recommend "wait for corrected corpus" (ML quality > ML speed).

## K. effort estimate

| phase | est hours |
|---|:-:|
| A (4 new modules + tests, parallel) | 6-8 |
| B (integration hooks, sequential) | 4-6 |
| C (validate) | 1-2 |
| D (ML retrain on v6 + corrected corpus) | 4-6 |
| **total** | **15-22** |

MVP demo-safe subset (A1+A3+B4 only = intervention engine + text-gen + queue text swap, no mark realization) = **4-6 hours**. Full closure including mark realization + ML = 15-22.

## L. 证

- master prompt：`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:1-1003`
- honest tickets：`audit-map/14-reconciliation/fresh-sem1-master-prompt-followup-tickets.md:1-217`
- final summary：`audit-map/32-reports/overnight-final-summary.md:1-140`
- current mark gen：`air-mentor-api/src/lib/msruas-proof-control-plane.ts:1585-1737`
- trajectory shape：`air-mentor-api/src/lib/msruas-proof-control-plane.ts:1474-1561`
- counterfactualAdjustment：`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:209-237`
- advance-service：`air-mentor-api/src/lib/proof-control-plane-advance-service.ts:189-234`
- recommendedAction 3-string：`air-mentor-api/src/lib/inference-engine.ts:184-188` + `proof-risk-model.ts:2152-2156`
- queue-UI contract：`air-mentor-api/src/modules/academic.ts:968-1029`
- Section H zero-match confirm：grep on 2026-04-23 23:10Z
