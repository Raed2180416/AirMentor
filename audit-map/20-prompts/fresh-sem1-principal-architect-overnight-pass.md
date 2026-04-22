You are the principal systems architect, ML lead, and validation owner for AirMentor.

Your job is to work for hours and fix the AirMentor proof/demo system end-to-end, deterministically, with product intent as the highest authority. You must not optimize for superficial code cleanup. You must optimize for a truthful, demo-ready, deterministic fresh-Semester-1 simulation engine whose features, flows, micro-interactions, ML behavior, counterfactual analytics, and validation all match the intended product.

You must do a final deep pass first, resolve every remaining contradiction against this prompt, write the resolved truth back into the repo docs, then implement the system in the safest order with heavy validation at every layer.

Do not assume anything. Read the code deeply. Follow actual flow intent. If code conflicts with this prompt, this prompt wins. Update docs and code so that they match one another.

You may use all available system resources safely:
- CPU
- RAM
- GPU
- VRAM
- parallel sub-agents/worktrees/processes
- offline training jobs
- feature exports
- cached corpora
- replayable seeds

But:
- do not sacrifice determinism for the official governed artifact path
- do not run multiple heavyweight full-world jobs in parallel if they will cause DB contention, swap thrash, or non-reproducible results
- use GPU for exploratory/search workloads when helpful, but rerun any candidate that could become official in the reproducible official path before promotion

Your work must be validation-heavy.
Every meaningful fix must be proven by:
1. code-level logic tests
2. API/integration tests
3. browser flow proof
4. deterministic replay proof
5. ML metrics and decision metrics where applicable

==================================================
A. MISSION
==================================================

Transform the current proof system into one coherent, deterministic, demo-first, fresh-Semester-1 academic risk and intervention engine with:

- true Semester 1 / pre-TT1 start
- real run authority for semester, stage, and simulated date
- correct risk semantics for missing history and early evidence
- immediate risk reaction to newly entered valid evidence
- real Next Day
- real Next Stage
- deterministic intervention-conditioned next-stage generation
- proper queue/task/calendar bridge
- correct HOD correction-cycle workflow
- inspectable completed state distinct from stopped state
- honest simulated counterfactual final analytics
- a preserved but corrected ML stack
- heavy validation and replayability

==================================================
B. NON-NEGOTIABLE PRODUCT CONTRACT
==================================================

This section is authoritative. Do not reinterpret it.

1. AirMentor has two surfaces:
   - Sysadmin panel
   - Teacher portfolio

2. Teacher portfolio roles:
   - Course Leader
   - Mentor
   - Head of Department (HOD)

3. Goal:
   - identify students at risk of catastrophic academic outcomes early
   - let teachers intervene before failure or major deterioration
   - show a believable end-to-end working demo

4. Demo world:
   - MSRUAS BTech Math and Computing
   - 2023 batch
   - 2 sections
   - 6 semesters
   - fixed proof cohort/curriculum scaffold
   - section-level configurable environmental differences

5. Semester stages:
   - pre-TT1
   - post-TT1
   - post-TT2
   - post-assignments
   - post-SEE

6. Stage/date anchors for the default Semester 1 demo:
   - semester start: 2023-08-18
   - TT1 boundary: 2023-09-29
   - TT2 boundary: 2023-11-19
   - post-assignments boundary default: 2023-12-10
   - SEE boundary: 2023-12-25

7. Equivalent day offsets from semester start for default demo config:
   - TT1: 42
   - TT2: 93
   - post-assignments: 114
   - SEE: 129

8. Next Stage:
   - advances to the next legal stage
   - snaps simulated date to that stage boundary
   - runs real transition logic
   - is not playback-only

9. Next Day:
   - advances simulated date by exactly one day
   - if it reaches or crosses the next stage boundary, it auto-advances stage immediately
   - must use the same transition pipeline as Next Stage
   - is not decorative

10. Stage boundaries must be strictly increasing within a semester.
    If not, run activation must fail.

11. Sysadmin sets the top-level CE vs SEE split.
    Default demo:
    - CE = 60%
    - SEE = 40%

12. Teachers control the internal CE decomposition:
    - quizzes
    - assignments
    - combinations/counts
    - subject-specific internal structure

13. Quizzes and assignments:
    - may be entered any time before semester end
    - once entered, must affect risk immediately
    - must be visible to risk/governance immediately when validly entered

14. Scheme/CE decomposition:
    - directly editable before dependent marks exist
    - if dependent marks already exist, change requires HOD approval/unlock correction cycle

15. TT1/TT2/SEE marks:
    - normal edit windows apply
    - post-lock edits require HOD approval/unlock

16. Manual teacher-created queue items:
    - are first-class intervention events
    - count in final analytics as interventions if they are student-facing interventions

17. Dismissal:
    - dismissal = handled
    - handled closes the case for that episode

18. Reopening:
    - a later deterioration creates a new later case
    - do not resurrect the old case in place

19. If mentor ownership changes, tasks move owner automatically.

20. If a proof-generated task is dragged on the calendar, the underlying due/scheduled date changes too.

21. Final analytics after Semester 6:
    - must compare with-intervention vs without-intervention
    - must be honest simulated counterfactual
    - must not claim the risk model alone proved causal uplift

22. Completed and stopped are different:
    - completed = inspectable, login still allowed, history available, reset/replay allowed
    - stopped = credentials deleted, login blocked, sessions invalidated

23. Demo mode vs real-world mode:
    - Demo mode: unresolved actionable cases may auto-resolve on Next Stage
    - Real-world semantics: unresolved cases remain open until resolved or semester end
    - Demo implementation may keep demo-mode semantics, but must label/architect them explicitly

==================================================
C. FINAL RESOLUTIONS TO ALL REMAINING AMBIGUITIES
==================================================

These are now frozen. Do not reopen them.

1. Semester 1 / pre-TT1 watch-only semantics
   - System-generated model output is watch-only.
   - Show risk/watch indicators in:
     - risk watch surfaces
     - dashboard summaries
     - student/teacher risk views
   - Do NOT auto-open system-generated actionable queue cases there.
   - Do NOT auto-create proof-generated scheduled tasks there.
   - Teachers may still manually create a student concern item or follow-up if they choose.
   - From Semester 2 onward, pre-TT1 may become actionable because previous semester performance is a real risk input.

2. Primary student concern case identity
   - concernContextKey = studentId + offeringId + concernFamily + semesterNumber

3. Canonical concernFamily taxonomy for primary student concern cases
   - attendance-risk
   - coursework-risk
   - exam-risk
   - broad-academic-risk
   - mentoring-followup

4. Workflow task categories are NOT primary student concern families
   Keep them separate:
   - approval-unlock
   - escalation-review
   - calendar-followup-task
   - hod-workflow-review

5. Primary risk case types
   - model-generated
   - teacher-created-manual

6. Workflow task types
   - approval-request
   - unlock-request
   - escalation-task
   - scheduled-followup-task

7. Canonical counting semantics
   - Headline risk case counts use primary student concern cases only.
   - Workflow tasks are counted separately in operational workflow analytics.
   - Queue summary cards, queue preview, teacher views, and final analytics must all use the same canonical primary-case definition by default.
   - If supporting/internal shadow rows are retained internally, they must not leak into headline counts.

8. HoD role semantics
   - HOD is NOT the default owner for ordinary model-generated risk cases.
   - Default ordinary risk routing:
     - High risk -> Mentor
     - Medium watch -> Course Leader
   - HOD owns:
     - approval/unlock workflow
     - explicit escalations
     - oversight analytics
     - exception handling
   - A case becomes HOD-owned only if explicitly escalated or if it is an approval/unlock workflow task.

9. Model vs policy vs simulator boundary
   - Model: predicts risk only
   - Policy/action layer: chooses recommended intervention
   - Monitoring/governance layer: decides owner/due/cooldown/open/watch routing
   - Simulator/intervention engine: determines future with-intervention and no-action trajectories
   - UI copy must keep these distinct

10. Seed generation authority
   - Seeded next-stage generation is a simulation engine, not the authoritative live risk scorer.
   - Runtime/UI risk must always be rescored from authoritative observed state.
   - Never present a seed-generated risk number as more authoritative than the runtime rescored value.

11. Missingness semantics
   - Use one production model family for demo phase, not stage-specific separate models.
   - Add explicit missingness companion features where appropriate.
   - Keep evidence-layer null semantics correct.
   - Use safe neutral numeric slots only together with explicit missingness signals, never silent zero-collapse.
   - Semester 1 prior CGPA/backlog/history must be absent/unknown, not zero.

12. Operational banding and queue opening
   - Keep overallCourseRisk as the primary operational head for UI banding and ranking in this demo phase.
   - Do not move to a composed decision score yet.
   - Keep supportive heads for diagnostics and display.
   - Queue opening remains governed by policy/capacity/budget and is not equivalent to “all high-risk rows become open cases.”

13. Final analytics scope
   - Keep checkpoint-level simulated counterfactual lift for drilldowns if useful.
   - Final Semester 6 analytics must also aggregate semester-level and full-run projected results.
   - Final copy must use words like:
     - projected
     - simulated
     - counterfactual
   - Never imply the risk model alone learned/proved uplift.

14. Post-assignments date default
   - If not otherwise configured in setup, use 2023-12-10 for the Semester 1 demo default.
   - Generalize later semesters through snapshotted stage offsets from semester start, not ad hoc hardcoding.

15. Manual unresolved cases on Next Stage in demo mode
   - In demo mode, all open actionable primary student concern cases may auto-resolve on Next Stage.
   - For teacher-created manual cases, if the teacher explicitly selected an action, use that action.
   - If no explicit action is stored, map concernFamily to a default policy action deterministically.
   - Workflow-only items such as approval requests must not falsely count as student-facing resolved interventions unless they lead to one.

==================================================
D. AUTHORITATIVE PRODUCT FLOWS AND MICRO-INTERACTION INTENT
==================================================

You must design and validate micro-interactions according to actual intent, not superficial page structure.

1. Navigation visibility is not the same as editability.
   - Role-authorized pages/tabs remain visible.
   - Stage/lock state governs editability.
   - Do not fake stage gating by hiding tabs.
   - Show clear explanation states for not-yet-applicable editing surfaces.

2. Risk Watch intent
   - Teachers must be able to inspect risk/watch views even when no actionable queue case exists.
   - Especially important for Semester 1 / pre-TT1 watch-only behavior.

3. Assessment surface intent
   - Show the surface if the role is authorized.
   - If marks are not yet applicable or locked, explain why.
   - Do not silently hide assessment surfaces just because the stage is not yet open.

4. Queue intent
   - Queue is for actionable work and tracked follow-up.
   - It is not just a dashboard.
   - Primary case state, owner, due state, and scheduled representation must agree across views.

5. Calendar intent
   - Proof-generated tasks are real scheduled commitments in the demo.
   - Scheduling and dragging must mutate underlying authoritative dates.
   - Queue and calendar must show the same reality.

6. HOD correction-cycle intent
   - Approval is not the edit itself.
   - Correct flow:
     request -> approve/reject -> reset & unlock -> teacher edit -> recompute -> relock
   - If scope includes scheme/blueprint, the editor must truly reopen.

7. Completion intent
   - After Semester 6, the run is inspectable and reviewable.
   - The user should still be able to inspect:
     - teacher portfolio
     - student histories
     - action history
     - final analytics

8. Stop intent
   - Stop ends active proof access and deletes proof credentials.
   - Do not treat stop as mere archive.

==================================================
E. REQUIRED DOCUMENT RECONCILIATION BEFORE CODING
==================================================

Before major code changes, do one final deep-pass reconciliation and update the docs so they all say the same thing.

Mandatory inspection surfaces:
- all current deep-dive/spec/refactor-plan docs
- implementation validation spec
- ML/risk investigation docs
- runbook docs
- CatBoost integration plan
- current code in backend/frontend for proof lifecycle, risk, queue, calendar, HOD unlock, and seeded simulation

At minimum inspect:
- air-mentor-api/src/lib/proof-risk-model.ts
- air-mentor-api/src/lib/inference-engine.ts
- air-mentor-api/src/lib/monitoring-engine.ts
- air-mentor-api/src/lib/proof-queue-governance.ts
- air-mentor-api/src/lib/proof-control-plane-runtime-service.ts
- air-mentor-api/src/lib/proof-control-plane-playback-service.ts
- air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts
- air-mentor-api/src/lib/proof-control-plane-live-run-service.ts
- air-mentor-api/src/lib/proof-control-plane-activation-service.ts
- air-mentor-api/src/lib/proof-control-plane-tail-service.ts
- air-mentor-api/src/modules/academic-runtime-routes.ts
- air-mentor-api/src/modules/academic.ts
- src/App.tsx
- src/domain.ts
- src/pages/calendar-pages.tsx
- src/system-admin-live-app.tsx
- src/pages/hod-pages.tsx
- teacher/student risk and monitoring surfaces

You must:
1. produce a conflict matrix:
   - product intent
   - current doc statement
   - current code truth
   - final resolved rule
   - file(s) to change
2. update docs so all contradictions are removed
3. write a short final decision appendix in-repo that captures the frozen defaults from this prompt

Do not let old contradictory text remain in the repo after this pass.

==================================================
F. CURRENT ML TRUTH YOU MUST START FROM
==================================================

Treat this as the current starting diagnosis.

1. The current “ML system” is layered:
   - trained observable-risk production artifact
   - challenger artifact path
   - heuristic fallback inference
   - heuristic action policy
   - heuristic monitoring/governance
   - seeded world shaping inputs and residuals

2. The production path is currently logistic-scorecard style, with five heads:
   - attendanceRisk
   - ceRisk
   - seeRisk
   - overallCourseRisk
   - downstreamCarryoverRisk

3. Operational banding and queue priority currently use overallCourseRisk only.

4. Current v7 coverage-24 result:
   - baseline (v5-like): ROC-AUC 0.7846 / Brier 0.1369 / ECE 0.0070 / Overload 1.0100
   - current logistic v7: ROC-AUC 0.7894 / Brier 0.1359 / ECE 0.0067 / Overload 1.1127
   - hybrid: ROC-AUC 0.7892 / Brier 0.1359 / ECE 0.0067 / Overload 1.1127
   - challenger depth-2 tree: ROC-AUC 0.7406 / Brier 0.1358 / ECE 0.0022 / Overload 1.4293
   - heuristic fallback: ROC-AUC 0.7512 / Brier 0.2343 / ECE 0.2792 / Overload 1.0049

5. Interpretation:
   - v7 improved global ranking/proper-scoring slightly
   - but v7 failed the overload guardrail
   - hybrid did not rescue overload
   - depth-2 tree challenger is not promotable
   - heuristic remains worse as a general predictor
   - do not promote v7 unchanged

6. Latest ML architectural conclusions:
   - do not start by tuning weights blindly
   - fix world semantics first
   - fix stage/date authority first
   - fix missingness and stale evidence leakage first
   - fix case identity first
   - then retrain corrected production baseline
   - then compare corrected logistic vs CatBoost challenger on the corrected frozen corpus
   - keep model=risk, policy=action, simulator=counterfactual

==================================================
G. FROZEN ML STRATEGY
==================================================

This is the ML strategy you must implement unless hard evidence proves a better path while preserving determinism and product intent.

1. Production risk strategy for next official candidate
   - build a corrected logistic baseline (call it v8 or equivalent)
   - retrain only after:
     - fresh-Sem1 world authority is fixed
     - stage/date truth is fixed
     - missingness semantics are fixed
     - coursework visibility timing is fixed
     - stale checkpoint leakage is removed
     - case identity is fixed

2. Challenger strategy
   - use CatBoost as the serious challenger family
   - use it as shadow/benchmark first
   - do not promote CatBoost just because it has higher AUC somewhere
   - promote only if it beats corrected logistic on:
     - ranking
     - proper scoring
     - local calibration near operational thresholds
     - overload / budget stability
     - replayability / serving trustworthiness

3. Calibration strategy
   - default production calibrator path: Beta calibration by head
   - Venn–Abers can be used as a shadow/diagnostic uncertainty path if useful
   - local threshold behavior around 0.4 and 0.85 must be analyzed, not just global ECE

4. Missingness strategy
   - add explicit missingness indicators
   - do not silently collapse unknown history or absent assessments to misleading values
   - one production model family with missingness-aware features is preferred in this demo phase over stage-specific separate models

5. Decision-layer strategy
   - do not try to solve overload by model complexity alone
   - keep:
     - risk scoring
     - queue opening
     - action policy
     - no-action / intervention simulation
     as separate layers
   - queue opening should remain capacity- and policy-aware

6. Counterfactual strategy
   - final analytics must use the simulator-based no-intervention path
   - current fixed penalty replay may remain as temporary diagnostic, but must not remain the final Semester 6 analytics logic

7. Seed-generation strategy
   - seeded generation remains a pedagogical simulation engine
   - runtime risk display must always rescore from authoritative observed state
   - do not let the simulator pretend to be the model

==================================================
H. FROZEN INTERVENTION RESPONSE MODEL
==================================================

You must implement a deterministic latent responsiveness model.

1. Hidden per-student simulation parameters (derived deterministically from run seed and stable identifiers)
   - responseProfile in { strong, partial, weak, resistant }
   - responseScore numeric [0,1]
   - consistencyScore numeric [0,1]
   - supportCompatibility numeric [0,1] or compatible family-specific score
   - optional family-specific compatibility if needed

2. Default response profile numeric anchors
   - strong -> 0.85
   - partial -> 0.60
   - weak -> 0.35
   - resistant -> 0.15

3. Base action weights (default starting values; document them; tune only with evidence)
   - mentor_meeting -> 0.55
   - faculty_followup_reminder -> 0.45
   - attendance_warning -> 0.50
   - extra_academic_support_plan -> 0.75
   - targeted_remedial_plan -> 0.80
   - hod_escalation_student_action -> 0.65
   - generic_default_family_action -> 0.50

4. Concern-family compatibility bonus
   - if intervention matches dominant problem type, apply modest positive multiplier
   - do not make this huge
   - recommended default compatibility multipliers:
     - strong match: 1.10
     - neutral: 1.00
     - weak mismatch: 0.90

5. Stage/timing factor
   Earlier interventions should help more.
   Recommended starting multipliers:
   - Sem2+ pre-TT1 actionable: 1.10
   - post-TT1: 1.00
   - post-TT2: 0.85
   - post-assignments: 0.70
   - post-SEE carryover mitigation only: 0.50

6. Severity penalty
   The worse the student already is, the harder it is to recover fully.
   Recommended starting multipliers:
   - mild: 1.00
   - moderate: 0.85
   - severe: 0.70
   - extreme: 0.55

7. Repeat penalty (diminishing returns)
   - first handled intervention: 1.00
   - second: 0.60
   - third and later: 0.35
   - cap total effect

8. Deterministic impact formula
   Use a formula of this shape:
   interventionImpact = baseActionWeight * responseScore * compatibilityFactor * stageFactor * severityPenalty * repeatPenalty

9. Outcome tier thresholds (default)
   - impact >= 0.65 -> strong improvement
   - impact >= 0.35 -> partial improvement
   - else -> weak/no improvement

10. How outcome tier changes next-stage generation
   - strong improvement:
     - attendance modestly improves
     - coursework expected performance improves
     - TT/SEE expected score band improves
     - intervention residual improves
   - partial improvement:
     - some improvement, not full recovery
   - weak/no improvement:
     - little or no meaningful improvement
   Use deterministic bounded deltas, not free random noise.

11. Deterministic seeded deltas
   Use stable hashing / deterministic unit sampling from:
   - runId
   - studentId
   - semester
   - stage
   - caseId
   - actionCode
   to select bounded deltas within the tier range.
   Same seed and same actions must reproduce the same behavior exactly.

12. Repeated interventions
   - stack with diminishing returns
   - clamp total effect
   - do not allow spam interventions to produce unrealistic guaranteed recovery

13. Workflow vs student-facing actions
   - approval/unlock workflow tasks do not themselves change the student outcome trajectory
   - only student-facing interventions affect uplift and next-stage seeded improvement

==================================================
I. EXACT CODE/DATA CHANGES TO MAKE
==================================================

Work in the safest order.

PHASE 0 — FINAL AUDIT + DOC RECONCILIATION
- Build a final conflict matrix.
- Update deep-dive/spec/validation docs so they all match this prompt.
- Add a concise final decision appendix.
- Remove obsolete contradictory wording.

PHASE 1 — RUN AUTHORITY / FRESH-SEM1 CORE
- Make simulation_runs authoritative for:
  - active semester
  - active stage
  - simulated date
  - simulated datetime
  - stage boundary metadata
  - setup config
  - scenario config
  - run mode
  - lifecycle state
- Eliminate all sem6 bootstrap assumptions from startup paths.
- Make fresh run start at Semester 1 / pre-TT1.
- Ensure no fake prior transcript or history exists for fresh Sem1.
- Add/expand stage-entry and baseline snapshots.
- Distinguish completed-inspectable vs stopped in backend semantics.

PHASE 2 — FEATURE/EVIDENCE/RUNTIME CORRECTNESS
- Stop deriving live stage from evidence presence.
- Use authoritative run stage instead.
- Remove stale checkpoint evidence reuse from live scoring.
- Make Semester 1 prior history null-safe.
- Add explicit missingness indicators.
- Ensure early absent TT/SEE etc. are not misencoded as worst-case values.
- Make quiz/assignment evidence visible to risk as soon as entered.
- Unify route write semantics with playback/runtime visibility semantics.
- Keep model serving on authoritative observed state.

PHASE 3 — PRIMARY CASE MODEL / QUEUE / WORKFLOW TASKS
- Replace broad student+semester keying with concernContextKey.
- Separate:
  - primary student concern cases
  - workflow tasks
- Ensure:
  - dismissal = handled
  - later deterioration opens new case
  - manual teacher-created student concern cases count as interventions
- Make canonical counting semantics consistent everywhere.
- Ensure Mentor/Course Leader/HOD ownership rules match the frozen contract.
- Implement immediate rerouting on mentor/offering ownership change.

PHASE 4 — QUEUE/TASK/CALENDAR BRIDGE
- Every actionable proof case that requires work must bridge into academic tasks/calendar as needed.
- Calendar drag must mutate underlying due date.
- Queue and calendar must agree on owner/date/state.
- Proof-mode calendar must use simulated date, not browser date.
- Workflow tasks must be represented without polluting primary case counts.

PHASE 5 — NEXT DAY / NEXT STAGE / RESET / STOP
- Implement real advance-day.
- Implement real advance-stage.
- Next Day must auto-advance stage on boundary crossing through the same transition pipeline.
- Implement demo auto-resolution semantics correctly.
- Implement Reset Current Stage.
- Implement Complete Reset.
- Implement Stop Simulation with credential deletion and session invalidation.
- Preserve completed-inspectable behavior after Semester 6.

PHASE 6 — HOD CORRECTION CYCLE
- Implement explicit correction-cycle state machine:
  request -> approve/reject -> reset & unlock -> teacher edit -> recompute -> relock
- Ensure scope-aware unlock:
  - evidence-only
  - scheme
  - blueprint
- Ensure scheme/blueprint editors truly reopen when approved.

PHASE 7 — CORRECTED PRODUCTION ML BASELINE
- Build corrected frozen corpus after world/feature semantics are fixed.
- Train corrected logistic baseline (v8 or equivalent).
- Add missingness-aware features.
- Evaluate:
  - ROC-AUC
  - PR-AUC
  - Brier
  - ECE
  - local calibration near 0.4 and 0.85
  - overload ratio
  - precision/recall at budget
  - stage/semester/scenario stability
- Do not promote if overload remains unsafe.

PHASE 8 — OVERLOAD ROOT-CAUSE ANALYSIS
On the corrected and current corpus, do the following before changing thresholds blindly:
- overallCourseRisk histograms by stage and semester
- local reliability around 0.4 and 0.85
- overload by stage, semester, scenario family
- interaction-feature ablations:
  - none
  - TT interaction only
  - coursework interaction only
  - stage×TT only
  - stage×coursework only
  - all
- determine whether overload comes from score bunching, local miscalibration, or interaction effects

PHASE 9 — CALIBRATION
- Use Beta calibration as the default candidate path.
- Optionally run Venn–Abers as diagnostic/shadow.
- Evaluate both global and local calibration.
- Do not rely on global ECE alone.

PHASE 10 — CATBOOST CHALLENGER
- Keep CatBoost as the serious challenger family.
- Train on the corrected frozen corpus.
- Use maximum hardware safely for search workloads.
- If using GPU for search/sweeps, rerun any promotable candidate through the official reproducible path before promotion.
- Integrate CatBoost as a shadow/challenger path, not immediate production.
- Compare logistic vs CatBoost on the corrected decision metrics, not AUC alone.

PHASE 11 — FINAL ANALYTICS
- Replace fixed penalty comparator for final demo analytics with simulator-based no-intervention branch.
- Keep current simpler comparator only as temporary diagnostic if needed.
- Final analytics page must show:
  - projected with-intervention outcomes
  - projected without-intervention outcomes
  - failures prevented estimate
  - score/risk/backlog trends
  - manual interventions
  - HOD escalations/workflow separately
  - semester-wise and student-wise drilldowns

==================================================
J. ML-SPECIFIC MUST-PRESERVE / MUST-CHANGE LIST
==================================================

Preserve:
- artifact registry
- evidence snapshot infrastructure
- governed manifest + split discipline
- policy/action separation from pure risk scoring
- queue governance layer
- diagnostic head display metadata

Change:
- sem6-centric world assumptions
- stage inferred from evidence presence
- silent missingness collapse
- stale checkpoint evidence reuse
- hidden early coursework evidence
- overly broad case identity
- shallow intervention-response logic
- final analytics relying on crude fixed penalty replay
- user-facing copy that blurs model, policy, and simulator

==================================================
K. HARDWARE / PARALLELIZATION PLAN
==================================================

Use maximum safe hardware, but intelligently.

1. Parallelize safely:
   - parallel static code audits across subsystems
   - parallel doc reconciliation tasks
   - parallel per-head evaluation/calibration jobs on frozen feature exports
   - parallel CatBoost challenger sweeps if RAM/VRAM allow
   - parallel browser test writing/execution where isolated

2. Do NOT:
   - run multiple heavyweight full-world generation/evaluator jobs simultaneously if they will fight over DB state or swap memory
   - cause swap thrash or OOM just to increase nominal worker count
   - sacrifice deterministic official artifacts

3. Preferred performance strategy:
   - fix world semantics once
   - build frozen governed corpus once
   - export authoritative feature tables
   - iterate many ML/calibration candidates on the frozen corpus
   - regenerate the full world only when simulator/world semantics change

4. Observability:
   - add/keep phase timing logs
   - track:
     - world creation time
     - recompute time
     - corpus extraction time
     - training time
     - scoring time
     - report generation time
   - use this to optimize safely

==================================================
L. EXACT DEMO FLOWS YOU MUST PROVE
==================================================

These are not optional. Build and validate them.

FLOW 1 — Fresh start
- Sysadmin launches fresh Semester 1 / pre-TT1 run
- Teachers can log in
- No fake history shown
- No prior CGPA/backlog invented
- Risk Watch visible
- No system-generated actionable queue rows yet in Sem1 pre-TT1

FLOW 2 — Early evidence reaction
- Teacher enters early quiz or assignment in Sem1 pre-TT1
- Risk changes immediately
- Evidence appears in feature snapshot and UI
- Still watch-only for system-generated cases in Sem1 pre-TT1

FLOW 3 — Manual concern in watch-only phase
- Teacher manually creates a concern/follow-up for a student in Sem1 pre-TT1
- It appears as a valid manual student concern/work item
- It counts in intervention analytics appropriately
- It does not violate the rule that system-generated pre-TT1 cases are watch-only

FLOW 4 — Scheduled task and Next Day
- Teacher schedules a follow-up for a future day
- It appears on calendar
- It becomes visible in queue on the correct simulated day
- Moving it on calendar mutates due date
- Overdue state behaves correctly

FLOW 5 — Boundary crossing by Next Day
- Simulated date crosses a stage boundary
- Stage auto-advances exactly once
- Same authoritative transition pipeline as Next Stage
- No duplicate transition side effects

FLOW 6 — Next Stage demo auto-resolution
- Leave an actionable case unresolved
- Click Next Stage
- Case auto-resolves in demo mode
- Intervention-response state updates
- Next seeded data changes accordingly
- Improvement is usually present, but not always

FLOW 7 — Sem2 pre-TT1 actionable logic
- Student enters Semester 2 with previous semester performance
- Risk can now become actionable pre-TT1 if warranted
- Queue ownership matches policy
- This differs appropriately from Semester 1 pre-TT1 behavior

FLOW 8 — Reopen later deterioration
- Student stabilizes after one case
- Later deterioration occurs in same semester
- New later case opens with a new case ID
- Old case stays closed
- Analytics remain readable

FLOW 9 — HOD correction cycle
- Teacher requests post-lock edit
- HOD gets workflow item
- HOD approves
- Surface truly reopens
- Teacher edits
- Risk recomputes
- Surface relocks

FLOW 10 — Completion and final analytics
- Run reaches Semester 6 / post-SEE
- Run becomes completed-inspectable
- Teachers still inspect history
- Final analytics page opens from quick panel
- With-vs-without intervention simulated counterfactual is visible
- Manual interventions and workflow metrics are separated correctly

FLOW 11 — Stop
- Sysadmin stops simulation
- Sessions invalidated
- Proof credentials deleted
- Teacher login blocked again

==================================================
M. VALIDATION LADDER
==================================================

Every meaningful feature must be proven at the correct layers.

1. Logic/unit validation
   - feature construction
   - missingness
   - stage authority
   - concern keying
   - intervention impact formula
   - local calibration utilities
   - no-action simulation branch

2. API/integration validation
   - run creation
   - day advance
   - stage advance
   - reset stage
   - complete reset
   - stop
   - correction cycle
   - queue/calendar bridge

3. Browser validation
   - system-admin flows
   - teacher flows
   - mentor flows
   - HOD flows
   - calendar flows
   - final analytics flows

4. Deterministic replay validation
   - same seed + same actions = same outcomes
   - same feature snapshot + same artifact = same risk output
   - manual edits reflected deterministically
   - intervention-response outcomes stable

5. ML evaluation validation
   - global metrics
   - local threshold behavior
   - overload
   - precision/recall at budget
   - stage/semester/scenario breakdown
   - calibration
   - challenger shadow comparisons

==================================================
N. EXACT ML ANALYSIS TASKS TO RUN
==================================================

1. Analyze current v7 overload root cause before changing thresholds
2. Produce stage- and semester-conditioned score histograms for overallCourseRisk
3. Produce local reliability around 0.4 and 0.85
4. Produce overload by:
   - stage
   - semester
   - scenario family
5. Run interaction-feature ablations
6. Determine whether overload is caused by:
   - local miscalibration
   - score bunching near thresholds
   - specific interaction features
   - stage-conditioned distribution shift
7. Build corrected logistic baseline after world fixes
8. Calibrate corrected baseline
9. Train CatBoost challenger on corrected frozen corpus
10. Compare corrected logistic vs challenger on decision-aware metrics, not only AUC

==================================================
O. WHAT NOT TO DO
==================================================

Do not:
- start by tuning model weights before fixing world/feature truth
- leave sem6 bootstrap assumptions in place
- keep stage inferred from evidence presence
- keep stale checkpoint evidence reuse in live scoring
- collapse unknown prior history into zero-like values
- hide assessment tabs instead of correctly separating visibility from editability
- let early coursework be entered but ignored by risk
- conflate model output with recommended action
- conflate approval/unlock workflow tasks with primary student concern case counts
- conflate simulated counterfactual with learned causal uplift
- promote a model that improves AUC but fails overload/local threshold safety
- sacrifice reproducibility for faster official artifact generation
- declare success without browser proof of the intended demo flows

==================================================
P. DELIVERABLES
==================================================

By the end of the overnight run, produce:

1. Updated docs with contradictions removed
2. Final decision appendix
3. Code changes implementing the corrected architecture
4. Test additions/updates
5. Validation artifacts
6. ML analysis outputs:
   - plots/tables
   - stage/semester/scenario breakdowns
   - overload diagnostics
   - calibration diagnostics
   - logistic vs CatBoost comparison
7. Final implementation summary:
   - what was changed
   - why
   - what remains
   - what is safe for demo
   - what is still experimental
8. Final “demo script” checklist:
   - exact steps to show the product convincingly

==================================================
Q. REPORTING FORMAT DURING WORK
==================================================

Work independently and deeply.
Do not ask for clarification unless absolutely impossible.
If a detail is minor and not explicitly specified, use the frozen defaults in this prompt and document the choice.

Maintain a running internal change log of:
- intent
- old behavior
- new behavior
- files changed
- validation performed
- remaining risk

When blocked:
- do not stop at the first obstacle
- inspect deeper
- use temporary instrumentation
- create reduced repros
- compare runtime vs playback
- compare UI vs API vs DB truth
- keep going until the behavior is explained and either fixed or explicitly documented

Final rule:
The goal is not just green tests.
The goal is one coherent, deterministic, truthful demo engine whose product intent, ML semantics, queue behavior, calendar behavior, intervention behavior, and validation all agree."

critical note, do not and i repeat do not  change any existing intended ui/ux flow in website, the fies should be architectural mathcing intent of ui/ux 
use caveman wynen ultra mode (max compression) skill across every single model
i need you to make sure we can safely implement paralllisation of tasks so you can continue working on 0other items whilw you wait on output of one and then continue on

now wire this in exactly you must use caveman wynene ultra forced and never forget this ever, priotity sk
and also please verify that we can safely  parallelizeto save time, we never lose important context when mvoing from one model to the next . theres never any errors with this
