# Fresh-Sem1 Master Prompt — Followup Tickets

本文件乃 2026-04-23 overnight-pass 后，对照 `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (1003 行) 之 honest gap 账。每 ticket 含：scope / owner_files / test contract / est effort / deterministic完径 / rollback。

## Ticket 1 — intervention-response-model (Section H)

**priority**: HIGH (demo-blocking for Flow 6 + Flow 10 credibility)

**scope**: 实 Section H 所言 deterministic latent responsiveness engine：
- `responseProfile ∈ {strong,partial,weak,resistant}` 映 `responseScore {0.85,0.60,0.35,0.15}`
- `consistencyScore / supportCompatibility ∈ [0,1]` per student
- base action weights (9 actions: mentor_meeting=0.55 / attendance_warning=0.50 / extra_academic_support_plan=0.75 / targeted_remedial_plan=0.80 / hod_escalation_student_action=0.65 / faculty_followup_reminder=0.45 / generic_default_family_action=0.50 / 等)
- compatibility/stage/severity/repeat 乘子 per Section H §4-§7
- `interventionImpact = baseActionWeight × responseScore × compatibilityFactor × stageFactor × severityPenalty × repeatPenalty`
- outcome tier { strong ≥0.65, partial ≥0.35, weak < 0.35 }
- deterministic seed hash from `runId|studentId|semester|stage|caseId|actionCode`

**owner_files** (建议):
- `air-mentor-api/src/lib/proof-intervention-response-engine.ts` (新)
- `air-mentor-api/src/lib/proof-control-plane-advance-service.ts:resolveProofAdvance:218-233` (integrate at post-see-open-cases auto-resolve hook)
- `air-mentor-api/src/lib/proof-control-plane-playback-service.ts` (next-stage seeded delta injection)
- `air-mentor-api/src/db/schema.ts` (hidden-state persistence optional)

**test contract**:
```ts
describe('Section H intervention response model', () => {
  it('responseProfile deterministic from (runId, studentId): same seed -> same profile');
  it('interventionImpact formula multiplies exactly per spec');
  it('outcome tier thresholds: 0.65 / 0.35');
  it('repeat penalty stacks with diminishing returns + cap');
  it('workflow tasks (approval/unlock) do NOT trigger impact — only student-facing');
  it('same seed + same actions sequence -> bytewise identical next-stage seeded deltas');
});
```

**est effort**: 6-8 dev-hours (new engine + integration + 6 test cases + replay validation)

**rollback**: wrap integration behind `AIRMENTOR_INTERVENTION_RESPONSE_V1=1` feature flag; if engine misbehaves, unset flag, fall back to existing Phase-5 auto-resolve-without-impact.

## Ticket 2 — phase6-hod-correction-ui-wiring (Flow 9)

**priority**: HIGH (demo Flow 9 end-to-end)

**scope**: UI/route enforcement of correction cycle state machine:
`request → approve/reject → reset-unlock → teacher-edit → recompute → relock`
- P6-1: role gate on `src/pages/course-pages.tsx` HoD persona → read-only only; Course Leader retains write
- P6-2: correction-flow endpoint序 hardening in `air-mentor-api/src/modules/academic-runtime-routes.ts` + UI state machine in `src/App.tsx`
- P6-3: visibility vs editability split in `src/pages/workflow-pages.tsx`

**existing progress**: a7ea9a75 landed schema enum (`scheme`, `blueprint`, `Relocked`); frontend/route chain not wired.

**owner_files**: per overnight-impl-phase6-hod-correction.md

**test contract**: per same MD (5 describe-it items)

**est effort**: 8-10 dev-hours (3 frontend + 1 backend + tests + E2E)

**rollback**: route gate separate from write gate; if CourseLeader误伤, revert route gate only.

## Ticket 3 — phase11-analytics-counterfactual (Flow 10)

**priority**: HIGH (release blocker per master §C.13 + §I Phase11)

**scope**:
- P11-1: extract analytics (`acceptanceGates`, efficacy thresholds, counterfactual summaries) from `proof-control-plane-policy-service.ts:67-131` → new `proof-control-plane-analytics-service.ts`; policy keeps action mapping only.
- P11-2: seeded run snapshot provenance triple (`modelArtifactId + calibrationId + policyId`) on `proof-control-plane-seeded-run-service.ts:202-219` + reconcile vs runtime in `proof-control-plane-runtime-service.ts:263-277`.
- P11-3 **RELEASE BLOCKER**: stage boundary monotonicity hard-fail in `proof-control-plane-activation-service.ts:40-53` + schema boundary metadata `air-mentor-api/src/db/schema.ts:621-634`.
- simulator-based no-intervention branch for final analytics (depends on Ticket 1).

**existing progress**: aggregation MD landed (`audit-map/32-reports/overnight-validate-ml-metrics.md`); code layer untouched.

**test contract**:
```ts
describe('Phase 11 Final Analytics', () => {
  it('P11-1: policy no longer emits efficacy/acceptanceGates');
  it('P11-1: analytics sidecar carries acceptanceGates + efficacy + counterfactual');
  it('P11-1: counterfactual restricted to same-checkpoint no-action comparator');
  it('P11-2: seeded snapshot provenance carries 3-tuple');
  it('P11-2: runtime rebuild reconciles against seeded snapshot identity');
  it('P11-3: activation rejects non-monotonic stage boundary');
  it('P11-3: release gate blocks on boundary regression');
  it('simulator-based no-intervention branch produces projected trajectory');
});
```

**est effort**: P11-3 first (3-4h release-blocker), P11-1 extraction (2h), P11-2 provenance (2h), simulator branch depending on Ticket 1 (3h additional)

**rollback**: analytics extraction sidecar-only (add-only schema); activation hard-fail → start as WARN log, move to hard-fail after warning window closed.

## Ticket 4 — corrected-corpus-retrain (Phase 7 redo)

**priority**: MEDIUM (ML promotion blocker)

**scope**: export post-Phase-2 features.csv from simulated world with:
- run_id + scenario_family 列（t57 csv 缺）
- post-Phase-2 caller propagation 完结
- cgpaMissing/backlogMissing explicit 列

rerun 3 scripts on corrected corpus:
- `air-mentor-api/scripts/train_v8_local_corrected_logistic.py`
- `air-mentor-api/scripts/beta_calibrate_v8_local.py`
- `air-mentor-api/scripts/train_catboost_challenger_local.py`

**existing progress**: all 3 scripts self-contained + seed=4242 bytewise deterministic; only corpus needs regen.

**how**: `tsx air-mentor-api/scripts/evaluate-proof-risk-model.ts` with `AIRMENTOR_EVAL_DATABASE_URL=<fresh-postgres>` + seeds profile ≥ `coverage-24`. Requires `npm ci` first.

**test contract**:
- all ML scripts produce same metric shape as t57/t58/t59 interim
- 若 corrected Beta pass 5/5 heads → 可 promote
- 若 corrected CatBoost pass 5/5 gates → 可 promote shadow→serving

**est effort**: 1-2h corpus export + 10min per script rerun + 1h evaluation = 3-4h total (assuming `npm ci` + DB ready).

**rollback**: N/A - diagnostic only; does not change production serving until promotion decision.

## Ticket 5 — browser-validation-harness (Ladder-3, Flows L1-L11)

**priority**: MEDIUM (master prompt §M.3 explicit requirement)

**scope**: build Playwright or Puppeteer harness covering 11 demo flows:
- FLOW 1 Fresh start
- FLOW 2 Early evidence reaction
- FLOW 3 Manual concern watch-only
- FLOW 4 Scheduled task + Next Day
- FLOW 5 Boundary crossing
- FLOW 6 Next Stage demo auto-resolution (depends on Ticket 1)
- FLOW 7 Sem2 pre-TT1 actionable
- FLOW 8 Reopen later deterioration
- FLOW 9 HOD correction cycle (depends on Ticket 2)
- FLOW 10 Completion analytics (depends on Ticket 3)
- FLOW 11 Stop (credential deletion + session invalidation)

**owner_files**: new `tests/browser-flows/flow-<N>.spec.ts` (11 files)

**test contract**: each flow文件 must assert:
- DOM selector presence at each step
- simulated date advancement via UI
- DB state post-action
- deterministic replay: same seed + same clicks = same DOM

**est effort**: 1h per flow × 11 = 11-16 dev-hours (harness setup + fixtures + 11 specs)

**rollback**: N/A (additive test; existing manual QA unchanged).

## Ticket 6 — npm-ci-test-suite (env-unblock)

**priority**: LOW (required for post-session validation)

**scope**:
```bash
cd air-mentor-api && npm ci                    # ~5 min download
npm run test:logic 2>&1 | tee test-logic.log   # ~2 min
npm run test:integration 2>&1 | tee test-int.log  # ~5 min (needs embedded-pg)
cd .. && npm ci                                # frontend deps
cd tests && npx playwright install --with-deps  # for Ticket 5
```

**existing progress**: `f77fc528` fixed 9 TS errors; all 3 Python ML scripts green (t62 bytewise determinism confirmed).

**est effort**: 1-2h (mostly network + install time; test runs ~10 min if green)

**rollback**: N/A (read-only to code; only populates node_modules).

## Ticket 7 — parallelization-guide (infra; meta-ticket)

**priority**: LOW (meta-doc)

**scope**: document safe parallelization patterns confirmed this session:

1. **Cascade (agent-level)**:
   - 独立 tool call 并 in one block
   - dependent call 分 block 序
   - 例：并 `read_file` × 4 + 并 `write_to_file` × 2

2. **Pipeline (DAG-level)**:
   - `--parallel 4` safe via `worktree.prepare()` + `merge_controller.merge_lock()` + `busy_account_keys` + `write_scope_glob` validator
   - quota overlap 自动 via `busy_account_keys` set (一 account_key 于同时只 1 task)
   - per-slot `cooldown_until` 自动冷却 on usage-limit

3. **Context preservation across models/slots**:
   - `orchestrator/briefing.py`: `record_outcome()` writes ancestor briefing post-task; `build_pack_for()` attaches to下游 prompt bundle
   - MD artefact + DB `result_json` + `briefing_path` 3-layer redundancy
   - 证 this session: t58 briefing auto-included t57 metrics; t59 briefing auto-included t57+t58

4. **Hybrid local-shim + codex path** (proven this session):
   - local-shim for ML tasks (t57/t58/t59 + t60-t64): zero OpenAI calls, bytewise deterministic
   - codex path for impl tasks (t50-t55): xhigh reasoning, idle_timeout 5400s for complex phases
   - scheduler transparent: local-shim 直 set `state=completed` + emit `validator_passed` + `worktree_merged` events; scheduler advances on next poll

**est effort**: 2h doc-only (write up in `pipeline/docs/PARALLEL_SAFETY.md`)

**rollback**: N/A (doc only).

---

## Execution Order (deterministic)

1. **Ticket 6 (npm-ci)** — unblocks 2/3/5 validation
2. **Ticket 1 (intervention-response-model)** — foundation for 3 + 5-Flow6/10
3. **Ticket 2 (phase6-ui-wiring)** — independent; can parallel with 1
4. **Ticket 3 (phase11-analytics + P11-3 release gate)** — depends on 1
5. **Ticket 4 (corrected-corpus retrain)** — depends on 6 (npm ci for TS evaluator) + P11-3 (release gate)
6. **Ticket 5 (browser harness + 11 flows)** — depends on 1/2/3
7. **Ticket 7 (parallelization doc)** — any time; low priority

**Total est effort**: ~40-55 dev-hours for full closure per master prompt.
**MVP demo-safe effort (Tickets 1+2+3 only)**: ~20 dev-hours.

## 证

- master prompt: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:1-1003`
- DAG closure MD: `audit-map/32-reports/overnight-final-summary.md:1-100`
- impl plan: `audit-map/14-reconciliation/overnight-implementation-plan.md`
- section-H check: `grep responseProfile|responseScore` on `air-mentor-api/src/lib/` → 0 match (2026-04-23 23:10Z)
- counterfactual check: `grep counterfactual` → only `proof-control-plane-policy-service.ts:67-131`, fixed-penalty replay shape (not simulator-branch)
