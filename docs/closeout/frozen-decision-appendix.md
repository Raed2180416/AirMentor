# Frozen Decision Appendix — AirMentor Product + ML Contract

Session: 2026-04-23
Branch: `promote-proof-dashboard-origin`
Source of truth: the original deep-audit prompt (the "principal systems architect" charter).

This appendix freezes every non-negotiable contract from prompt Sections B, C, D, G, H, and L so that docs, code, and demo copy all cite the same truth. Where `@path:line` citations appear, they refer to the head of the repo at the commit preceding this session.

---

## 1. Product Contract (prompt §B — frozen)

### Surfaces and roles

- Two surfaces: sysadmin panel and teacher portfolio.
- Teacher portfolio roles: Course Leader, Mentor, Head of Department (HOD).

### World

- Cohort: MSRUAS BTech Math and Computing, 2023 batch, 2 sections, 6 semesters, fixed proof cohort/curriculum scaffold.
- Section-level configurable environmental differences via `sectionOverridesJson` (Track C, committed `8bdda2a5`–`82105676`).

### Semester stages (canonical keys)

- `pre-tt1`
- `post-tt1`
- `post-tt2`
- `post-assignments`
- `post-see`

Stage keys are enumerated in `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/stage-policy.ts:33-40`. **Do not introduce a `pre-see` key.** The intent-level label "pre-SEE" maps to `post-assignments` (the checkpoint after assignments are in but before SEE).

### Default Semester-1 anchors (2023 batch)

| Event | Date | Day offset from semester start |
|---|---|---|
| Semester start | 2023-08-18 | 0 |
| TT1 boundary | 2023-09-29 | 42 |
| TT2 boundary | 2023-11-19 | 93 |
| Post-assignments boundary | 2023-12-10 | 114 |
| SEE boundary | 2023-12-25 | 129 |

Boundaries MUST be strictly increasing within a semester. If not, run activation MUST fail.

### Stage transitions

- **Next Stage**: advances to the next legal stage, snaps simulated date to stage boundary, runs real transition logic. Not playback-only.
- **Next Day**: advances simulated date by exactly one day. If it crosses the next boundary, auto-advance stage exactly once through the SAME transition pipeline. Not decorative.

### CE/SEE and editability

- Sysadmin sets top-level CE vs SEE split (default: CE = 60%, SEE = 40%).
- Teachers control internal CE decomposition (quizzes, assignments, counts, combinations).
- Quizzes/assignments may be entered any time before semester end; once entered, MUST affect risk immediately and be visible to risk/governance immediately.
- Scheme/CE decomposition editable before dependent marks exist. Otherwise requires HOD approval/unlock.
- TT1/TT2/SEE marks: normal edit windows apply; post-lock edits require HOD approval/unlock.

### Manual cases and dismissal

- Manual teacher-created queue items are first-class intervention events and count in final analytics as interventions if student-facing.
- Dismissal = handled. Handled closes the case for that episode.
- Later deterioration creates a NEW later case; do not resurrect the old case in place.
- Mentor ownership change → tasks move owner automatically.
- Proof-generated task drag on calendar → underlying due/scheduled date changes too.

### Final analytics (§B.21, §C.13)

- After Semester 6, compare with-intervention vs without-intervention. **Must be honest simulated counterfactual.** Must NOT claim the risk model alone proved causal uplift.
- Final copy MUST use words like **projected**, **simulated**, **counterfactual**.

### Run lifecycle (§B.22, §B.23)

- **Completed**: inspectable, login still allowed, history available, reset/replay allowed.
- **Stopped**: credentials deleted, login blocked, sessions invalidated.
- Demo mode: unresolved actionable cases MAY auto-resolve on Next Stage.
- Real-world semantics: unresolved cases remain open until resolved or semester end.
- Demo implementation may keep demo-mode semantics but MUST label/architect explicitly.

---

## 2. Final Resolutions (prompt §C — frozen)

### §C.1 Semester-1 / pre-TT1 watch-only semantics

- System-generated model output is watch-only.
- Show risk/watch indicators in risk watch surfaces, dashboard summaries, student/teacher risk views.
- **Do NOT auto-open** system-generated actionable queue cases in Sem-1 pre-TT1.
- **Do NOT auto-create** proof-generated scheduled tasks there.
- Teachers may still manually create a student concern or follow-up.
- From Semester 2 onward, pre-TT1 MAY become actionable because previous-semester performance is real risk input.

### §C.2 Primary student concern case identity

```
concernContextKey = studentId + offeringId + concernFamily + semesterNumber
```

Wired in `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-queue-governance.ts:147-156`.

### §C.3 Canonical concernFamily taxonomy

Primary student concern families:

- `attendance-risk`
- `coursework-risk`
- `exam-risk`
- `broad-academic-risk`
- `mentoring-followup`

### §C.4 Workflow task categories (NOT primary concern families)

- `approval-unlock`
- `escalation-review`
- `calendar-followup-task`
- `hod-workflow-review`

### §C.5 Primary risk case types

- `model-generated`
- `teacher-created-manual`

### §C.6 Workflow task types

- `approval-request`
- `unlock-request`
- `escalation-task`
- `scheduled-followup-task`

### §C.7 Canonical counting semantics

- Headline risk case counts use **primary student concern cases only**.
- Workflow tasks counted separately in operational workflow analytics.
- Queue summary cards, queue preview, teacher views, and final analytics MUST use the same canonical primary-case definition by default.
- If supporting/internal shadow rows are retained internally, they MUST NOT leak into headline counts.

### §C.8 HOD role semantics

- HOD is **NOT** the default owner for ordinary model-generated risk cases.
- Default ordinary risk routing:
  - High risk → Mentor
  - Medium watch → Course Leader
- HOD owns: approval/unlock workflow, explicit escalations, oversight analytics, exception handling.
- A case becomes HOD-owned only if explicitly escalated or if it is an approval/unlock workflow task.

### §C.9 Model vs policy vs simulator boundary

| Layer | Responsibility |
|---|---|
| Model | Predicts risk only |
| Policy/action | Chooses recommended intervention |
| Monitoring/governance | Decides owner/due/cooldown/open/watch routing |
| Simulator/intervention engine | Determines future with-intervention and no-action trajectories |

UI copy MUST keep these distinct. No sentence may conflate model output with recommended action, or simulated counterfactual with learned causal uplift.

### §C.10 Seed vs runtime authority

- Seeded next-stage generation is a **simulation engine**, not the authoritative live risk scorer.
- Runtime/UI risk MUST always be rescored from authoritative observed state.
- Never present a seed-generated risk number as more authoritative than the runtime rescored value.

### §C.11 Missingness semantics

- One production model family for demo phase (not stage-specific separate models).
- Explicit missingness companion features where appropriate.
- Evidence-layer null semantics correct.
- Safe neutral numeric slots only together with explicit missingness signals; **never silent zero-collapse**.
- Semester-1 prior CGPA/backlog/history MUST be absent/unknown, not zero.

Wired: `cgpaMissing` + `backlogMissing` in `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-risk-model.ts:168-177` + v8 feature vector at `:60-63`.

### §C.12 Operational banding and queue opening

- `overallCourseRisk` remains the primary operational head for UI banding and ranking in this demo phase.
- Do NOT move to composed decision score yet.
- Supportive heads remain for diagnostics/display.
- Queue opening governed by policy/capacity/budget — NOT equivalent to "all high-risk rows become open cases".

### §C.13 Final analytics scope

- Checkpoint-level simulated counterfactual lift kept for drilldowns if useful.
- Final Sem-6 analytics MUST also aggregate semester-level and full-run **projected** results.
- Copy MUST use words: projected, simulated, counterfactual.
- Never imply the risk model alone learned/proved uplift.

Phase-11 simulator-based counterfactual wired this session at `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-counterfactual-simulator-aggregator.ts` + route `/api/academic/hod/proof-counterfactual-simulator` in `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/modules/academic-proof-routes.ts:224-248`. The legacy flag-diff route `/proof-counterfactual` remains as **diagnostic only** (§G.6).

### §C.14 Post-assignments date default

- Semester-1 default: 2023-12-10.
- Generalise later semesters through snapshotted stage offsets from semester start.

### §C.15 Manual unresolved cases on Next Stage in demo mode

- All open actionable primary student concern cases MAY auto-resolve on Next Stage.
- Teacher-created manual cases: use explicit selected action if present.
- No explicit action → map concernFamily to default policy action deterministically.
- Workflow-only items (approval requests) MUST NOT falsely count as student-facing resolved interventions unless they lead to one.

---

## 3. Micro-interaction Intent (prompt §D — frozen)

- Navigation visibility ≠ editability. Role-authorised pages/tabs stay visible; stage/lock state governs editability. **Do not fake stage gating by hiding tabs.**
- Risk Watch: teachers MUST inspect risk/watch views even when no actionable queue case exists.
- Assessment surfaces: show if role authorised; if not yet applicable or locked, explain why. Do not silently hide.
- Queue: actionable work and tracked follow-up, not a dashboard. Primary case state, owner, due state, scheduled representation MUST agree across views.
- Calendar: proof-generated tasks are real scheduled commitments. Scheduling/dragging MUTATES underlying authoritative dates. Queue and calendar MUST show the same reality.
- HOD correction-cycle: approval is NOT the edit itself. Correct flow is `request → approve/reject → reset & unlock → teacher edit → recompute → relock`. If scope includes scheme/blueprint, the editor MUST truly reopen.
- Completion: after Sem-6, run is inspectable and reviewable. User still inspects teacher portfolio, student histories, action history, final analytics.
- Stop: ends active proof access and deletes proof credentials. NOT archive.

---

## 4. Frozen ML Strategy (prompt §G — frozen)

### §G.1 Production risk strategy (next candidate)

- Build corrected logistic baseline (v8). Retrain only AFTER:
  - Fresh-Sem1 world authority fixed ✅
  - Stage/date truth fixed ✅
  - Missingness semantics fixed ✅
  - Coursework visibility timing fixed ✅
  - Stale checkpoint leakage removed ✅
  - Case identity fixed ✅

### §G.2 Challenger strategy

- CatBoost is the serious challenger family.
- Shadow/benchmark first. Do NOT promote on AUC alone.
- Promote only if beats corrected logistic on: ranking, proper scoring, local calibration near operational thresholds, overload/budget stability, replayability/serving trustworthiness.

### §G.3 Calibration strategy

- Default production calibrator: Beta calibration by head.
- Venn–Abers as shadow/diagnostic uncertainty path if useful.
- Local threshold behaviour around 0.4 and 0.85 MUST be analysed, not just global ECE.

### §G.4 Missingness strategy

- Explicit missingness indicators.
- No silent collapse of unknown history / absent assessments.
- One production family with missingness-aware features preferred over stage-specific models.

### §G.5 Decision-layer strategy

- Do NOT solve overload by model complexity alone.
- Keep separate: risk scoring, queue opening, action policy, no-action/intervention simulation.
- Queue opening remains capacity- and policy-aware.

### §G.6 Counterfactual strategy

- Final analytics MUST use simulator-based no-intervention path.
- Current fixed-penalty replay / flag-diff reader MAY remain as **temporary diagnostic**, but MUST NOT remain the final Sem-6 analytics logic.
- Authoritative path: `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-counterfactual-simulator-aggregator.ts` (new this session).

### §G.7 Seed-generation strategy

- Seeded generation remains a pedagogical simulation engine.
- Runtime risk display MUST always rescore from authoritative observed state.
- Do NOT let the simulator pretend to be the model.

---

## 5. Frozen Intervention-Response Model (prompt §H — frozen)

Wired in `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-intervention-response-engine.ts`.

### §H.1 Hidden per-student simulation parameters

Deterministic from run seed + stable identifiers:

- `responseProfile ∈ { strong, partial, weak, resistant }`
- `responseScore ∈ [0, 1]`
- `consistencyScore ∈ [0, 1]`
- `supportCompatibility ∈ [0, 1]` (or family-specific)
- Optional family-specific compatibility

### §H.2 Default response-profile numeric anchors

| Profile | Score |
|---|---|
| strong | 0.85 |
| partial | 0.60 |
| weak | 0.35 |
| resistant | 0.15 |

### §H.3 Base action weights

| Action | Weight |
|---|---|
| `mentor_meeting` | 0.55 |
| `faculty_followup_reminder` | 0.45 |
| `attendance_warning` | 0.50 |
| `extra_academic_support_plan` | 0.75 |
| `targeted_remedial_plan` | 0.80 |
| `hod_escalation_student_action` | 0.65 |
| `generic_default_family_action` | 0.50 |

Extension set actually wired (`@proof-intervention-response-engine.ts:46-56`): adds `structured_study_plan` (0.70) and `peer_study_group` (0.40).

### §H.4 Concern-family compatibility multipliers

- Strong match: **1.10**
- Neutral: 1.00
- Weak mismatch: **0.90**

### §H.5 Stage/timing multipliers

| Stage | Multiplier |
|---|---|
| Sem2+ pre-TT1 actionable | 1.10 |
| post-TT1 | 1.00 |
| post-TT2 | 0.85 |
| post-assignments | 0.70 |
| post-SEE carryover mitigation only | 0.50 |

### §H.6 Severity penalty

| Severity | Multiplier |
|---|---|
| mild | 1.00 |
| moderate | 0.85 |
| severe | 0.70 |
| extreme | 0.55 |

### §H.7 Repeat penalty (diminishing returns)

- 1st handled intervention: 1.00
- 2nd: 0.60
- 3rd and later: 0.35
- Cap total effect.

### §H.8 Deterministic impact formula

```
interventionImpact = baseActionWeight
                   × responseScore
                   × compatibilityFactor
                   × stageFactor
                   × severityPenalty
                   × repeatPenalty
```

### §H.9 Outcome tier thresholds

| Impact threshold | Tier |
|---|---|
| impact ≥ 0.65 | strong improvement |
| impact ≥ 0.35 | partial improvement |
| else | weak / no improvement |

### §H.10 Outcome-tier → next-stage generation

- **Strong**: attendance modestly improves; coursework expected performance improves; TT/SEE expected band improves; intervention residual improves.
- **Partial**: some improvement, not full recovery.
- **Weak/no**: little or no meaningful improvement.

Use deterministic bounded deltas, not free random noise.

### §H.11 Deterministic seeded deltas

Stable hashing / deterministic unit sampling from: `runId`, `studentId`, `semester`, `stage`, `caseId`, `actionCode`. Same seed + same actions → bytewise-identical results.

### §H.12 Repeated interventions

- Stack with diminishing returns.
- Clamp total effect.
- Do NOT allow spam interventions to yield unrealistic guaranteed recovery.

### §H.13 Workflow vs student-facing actions

- Approval/unlock workflow tasks do NOT themselves change student outcome trajectory.
- Only student-facing interventions affect uplift and next-stage seeded improvement.

`STUDENT_FACING_ACTIONS` whitelist wired at `@proof-intervention-response-engine.ts:61-69`.

---

## 6. Required demo flows (prompt §L — frozen checklist)

Every flow MUST pass browser validation before demo. Status is tracked in the session TODO.

| # | Flow | Description | Spec file |
|---|---|---|---|
| 1 | Fresh start | Sysadmin launches fresh Sem-1/pre-TT1 run; teachers log in; no fake history/CGPA/backlog; risk watch visible; no system-generated actionable queue rows | `tests-e2e/specs/flow-1-fresh-start.spec.ts` (pending) |
| 2 | Early evidence reaction | Teacher enters early quiz/assignment in Sem-1 pre-TT1; risk changes immediately; evidence appears in feature snapshot + UI; still watch-only for system-gen cases | `flow-2-early-evidence.spec.ts` (pending) |
| 3 | Manual concern in watch-only | Teacher manually creates concern/follow-up; appears as valid manual work item; counts in intervention analytics; does NOT violate watch-only for system-gen | Contract: `receptivity-differentiation.spec.ts` (partial) |
| 4 | Scheduled task + Next Day | Teacher schedules follow-up for future day; appears on calendar; becomes visible in queue on simulated day; moving on calendar mutates due date; overdue state correct | `flow-4-scheduled-nextday.spec.ts` (pending) |
| 5 | Boundary cross by Next Day | Simulated date crosses stage boundary; stage auto-advances exactly once; same authoritative transition pipeline; no duplicate transition side-effects | `flow-5-boundary-cross.spec.ts` (pending) |
| 6 | Next Stage auto-resolve | Leave actionable case unresolved; Next Stage; case auto-resolves in demo mode; intervention-response state updates; next seeded data changes | `flow-6-nextstage-autoresolve.spec.ts` (pending) |
| 7 | Sem-2 pre-TT1 actionable | Student enters Sem-2 with prev-sem performance; risk can now be actionable pre-TT1 if warranted; queue ownership matches policy | Contract: `multi-semester-carryover.spec.ts` (partial) |
| 8 | Reopen deterioration | Student stabilises after one case; later deterioration in same semester; new later case with new caseId; old case stays closed; analytics readable | `flow-8-reopen.spec.ts` (pending) |
| 9 | HOD correction cycle | Teacher requests post-lock edit; HOD gets workflow item; approves; surface truly reopens; teacher edits; risk recomputes; surface relocks | `flow-9-hod-cycle.spec.ts` (pending) |
| 10 | Completion + final analytics | Run reaches Sem-6/post-SEE; completed-inspectable; teachers inspect history; final analytics opens; with-vs-without intervention simulated counterfactual visible; manual interventions + HOD workflow separated | `flow-10-completion.spec.ts` (pending) |
| 11 | Stop | Sysadmin stops simulation; sessions invalidated; proof credentials deleted; teacher login blocked again | `flow-11-stop.spec.ts` (pending) |

---

## 7. Parallelisation Safety (prompt §K — frozen)

| Action | Safe? | Rationale |
|---|---|---|
| Parallel static code audits across subsystems | ✅ | Read-only |
| Parallel doc reconciliation | ✅ | Disjoint files |
| Parallel per-head evaluation/calibration jobs on frozen feature exports | ✅ | Frozen corpus, no DB contention |
| Parallel CatBoost challenger sweeps if RAM/VRAM allow | ✅ | Rerun any promotable candidate in reproducible path before promotion |
| Parallel browser test writing/execution where isolated | ✅ | Each spec uses an isolated backend port |
| Parallel full-world generation/evaluator jobs against shared DB | ❌ | DB contention, swap thrash, non-reproducible |
| Dev-worktree per-task | ✅ | `@/home/raed/projects/air-mentor-ui/pipeline/orchestrator/worktree.py` git worktree + fcntl |

Context-loss prevention: `@/home/raed/projects/air-mentor-ui/pipeline/orchestrator/briefing.py` `record_outcome`→`build_pack_for` chains ancestor briefings into the next task prompt. SQLite WAL + `fcntl` merge locks prevent cross-task corruption. `busy_account_keys` prevents auth quota over-use.

---

## 8. What NOT to do (prompt §O — frozen)

- Do NOT start by tuning model weights before fixing world/feature truth.
- Do NOT leave Sem-6 bootstrap assumptions in place.
- Do NOT keep stage inferred from evidence presence.
- Do NOT keep stale checkpoint evidence reuse in live scoring.
- Do NOT collapse unknown prior history into zero-like values.
- Do NOT hide assessment tabs instead of correctly separating visibility from editability.
- Do NOT let early coursework be entered but ignored by risk.
- Do NOT conflate model output with recommended action.
- Do NOT conflate approval/unlock workflow tasks with primary student concern case counts.
- Do NOT conflate simulated counterfactual with learned causal uplift.
- Do NOT promote a model that improves AUC but fails overload/local threshold safety.
- Do NOT sacrifice reproducibility for faster official artifact generation.
- Do NOT declare success without browser proof of the intended demo flows.

---

## 9. Open gaps at session checkpoint (2026-04-23)

Delta between prompt freeze and repo HEAD:

| Phase | Status | Owner / next step |
|---|---|---|
| Phase 0 (doc reconcile) | This appendix ✅ | — |
| Phase 1 (run authority) | ⚠️ Schema wired; fresh-Sem1 default enforcement unit test pending | Session |
| Phase 2 (feature/runtime) | ✅ `cgpaMissing`/`backlogMissing` wired | — |
| Phase 3 (concernContextKey) | ✅ wired | — |
| Phase 4 (queue/calendar bridge) | ⚠️ Drag→dueAt mutation verification pending | Session |
| Phase 5 (Next Day/Stage) | ⚠️ Boundary cross + demo auto-resolve + stop verify pending | Session |
| Phase 6 (HOD correction cycle) | ❌ Zod payload exists, state machine enforcer missing | Session |
| Phase 7 (v8 retrain) | ⚠️ v8 trained on interim corpus; post-Phase-2 rerun + promotion pending | Session |
| Phase 8 (overload RCA) | ✅ 12-gate checker + histograms exist | — |
| Phase 9 (Beta calibration) | ❌ local-ECE @ 0.4 = 0.13 (gate 0.02) — fix pending | Session |
| Phase 10 (CatBoost challenger) | ✅ trained + shadow-wired | — |
| Phase 11 (simulator analytics) | ✅ aggregator + route wired this session | — |
| Intervention Response (§H) | ✅ wired | — |
| Browser flow specs (§L) | ❌ 3/11 exist as frozen contracts; 0/11 running | Session |

---

## 10. How to use this appendix

- When in doubt about a product or ML contract, quote this appendix not prior drafts.
- Any change to these contracts requires an explicit amendment — never silent drift.
- Demo copy reviewers: compare every risk/counterfactual/analytics sentence against §1.C.13 + §4.G.6 + §5.H.13 before shipping.
