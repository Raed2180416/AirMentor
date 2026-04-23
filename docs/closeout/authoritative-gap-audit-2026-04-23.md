# Authoritative Gap Audit — 2026-04-23

Scope: current repo truth for "complete product + realistic demo" intent.

Method:
- code-path audit in `src/`, `air-mentor-api/src/`, `tests-e2e/`, `pipeline/`, `docs/`, `audit-map/`
- direct local runtime probes against seeded backend
- Playwright harness verification
- no reliance on stale closeout claims when code/artifacts disagree

## 1. Hard Truth Summary

Status buckets:

| Area | Truth |
| --- | --- |
| Proof control-plane base | partially real |
| Final simulator analytics API | real |
| Teacher/HOD final analytics UI wiring | not authoritative yet |
| Next Day / Next Stage HTTP wiring | missing |
| HOD correction-cycle engine | real |
| HOD correction-cycle HTTP state machine | missing |
| Stop service semantics | real in service layer only |
| Stop HTTP route | missing |
| Queue/calendar due-date writeback | real in backend |
| Queue/calendar simulated-date authority in frontend | still leaking wall-clock |
| Browser E2E truth | not yet trustworthy |
| Flow-spec suite | exists, but many flows soft-pass missing features |
| ML promotion state | still blocked / interim |
| Pipeline "parallel-safe" claim | partly true, partly overstated |

## 2. What Was Fixed In This Pass

Playwright harness fixes landed:

- `tests-e2e/playwright.config.ts`
  - Vite `webServer` now starts from repo root, not `tests-e2e/`, so local root URL stops returning false `404` and readiness checks stop lying.
  - config now supports attached/manual mode via `AIRMENTOR_PW_SKIP_WEBSERVER=1`.
  - config now accepts custom attached-stack URLs via `AIRMENTOR_PW_FRONTEND_BASE_URL` and `AIRMENTOR_PW_API_BASE_URL`.
- `tests-e2e/fixtures/seeded-run-fixture.ts`
  - fixture now waits for checkpoint materialization before `activate`, which removes the fresh-run activation race.
- `package.json`
  - `e2e:install` includes Firefox + Chromium.
  - `e2e:attached` added for manual local stacks.

Evidence:
- `tests-e2e/playwright.config.ts:5-56`
- `tests-e2e/fixtures/seeded-run-fixture.ts:39-158`
- `package.json:32-34`

## 3. Runtime / Harness Reality

### 3.1 Fresh-run activation race was real

Fresh created proof runs are queued with background materialization. Immediate activate can hang; activate after checkpoints exist works.

Evidence:
- queue-created run starts with background-worker metadata and `activeOperationalSemester = semesterEnd`: `air-mentor-api/src/lib/proof-run-queue.ts:163-178`
- activation later resets active semester to `semesterStart` / `pre-tt1`: `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4435-4448`
- fixture now waits for checkpoints before activate: `tests-e2e/fixtures/seeded-run-fixture.ts:39-118`

### 3.2 Playwright-managed stack still not fully trustworthy

Even after cwd fix, Playwright-managed runs still leak/reuse seeded backend processes badly enough to poison later runs on fixed ports. Manual attached mode is now safer than default local `webServer` mode.

Observed truth:
- `npm run e2e -- --list` can leave seeded backend alive on `4000`
- later `npm run e2e ...` can fail with `http://127.0.0.1:4000/health is already used`
- raw/manual attached stack on alternate ports (`4010/5174`) is stable enough for API probes

### 3.3 Browser validation still blocked by environment

Current blockers:
- local Playwright browser runtime previously failed on host libs
- MCP Playwright browser is also blocked in this session: Chromium wrapper expects `/opt/google/chrome/chrome`

Result: real browser UI validation is still not end-to-end trustworthy on this host, even though API/runtime probes can run.

## 4. Backend Product Gaps

### 4.1 `/advance` not wired

Service layer exists:
- `air-mentor-api/src/lib/proof-control-plane-advance-service.ts:411-449`

But admin HTTP routes expose only:
- `/activate`
- `/activate-semester`
- `/archive`

Evidence:
- `air-mentor-api/src/modules/admin-proof-sandbox.ts:367-435`

Impact:
- Flow 4/5/6/8 depend on `/api/admin/proof-runs/:id/advance`
- all are still contract-style / soft-pass specs, not hard green proof

### 4.2 `/stop` not wired

Stop semantics exist in service:
- deletes proof credentials
- invalidates sessions
- marks lifecycle `stopped`

Evidence:
- `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:302-340`

But no admin `/stop` route exists:
- `air-mentor-api/src/modules/admin-proof-sandbox.ts:367-435`

Impact:
- Flow 11 currently falls back to `/archive` and exits cleanly on `404`
- this does not prove stop semantics in runtime

### 4.3 HOD correction-cycle engine exists, routes do not

Engine is real:
- `air-mentor-api/src/lib/proof-hod-correction-cycle-engine.ts:1-220`

HTTP routes for:
- `/api/academic/unlock-requests`
- `/approve`
- `/reset-complete`
- `/teacher-edit-submit`
- `/relock`

were not found in current backend route modules.

Impact:
- Phase 6 remains big gap
- flow-9 spec documents missing routes and returns instead of failing

### 4.4 Final analytics API is real, but UI still calls diagnostic route

Backend truth:
- diagnostic diff route: `air-mentor-api/src/modules/academic-proof-routes.ts:192-222`
- authoritative simulator route: `air-mentor-api/src/modules/academic-proof-routes.ts:224-247`

Frontend truth:
- client still calls diagnostic diff route: `src/api/client.ts:527-533`
- HOD panel comment still describes old diff architecture: `src/hod-counterfactual-panel.tsx:11-24`
- panel mounts only if URL contains `counterfactualBaseline`, otherwise nothing is rendered: `src/academic-workspace-route-surface.tsx:257-269`

Impact:
- Phase 11 API exists
- teacher/HOD demo flow is still not wired to authoritative path by default
- flow-10 UI spec even accepts "Counterfactual panel not wired" as success: `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts:83-96`

## 5. Queue / Calendar Reality

### 5.1 Backend bridge is real

Task placement updates persist underlying task due date.

Evidence:
- `air-mentor-api/src/modules/academic-runtime-routes.ts:473-483`

### 5.2 Frontend still leaks wall-clock authority

Queue activation and due labels still default to real current date unless callers explicitly pass proof date.

Evidence:
- `src/domain.ts:346-355`
- `src/domain.ts:401-436`
- `src/App.tsx:1546`

Impact:
- backend can store simulated schedule truth
- frontend still computes key queue/calendar visibility off wall clock in current code paths

## 6. Fresh Sem1 Truth

Fresh Sem1 intent is only fully true after activation, not at queued-run birth.

Evidence:
- queued run initializes `activeOperationalSemester` to `semesterEnd`: `air-mentor-api/src/lib/proof-run-queue.ts:169-171`
- activation corrects to start semester: `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4435-4447`

Meaning:
- "fresh Sem1 default" is runtime-correct after activation
- storage/canonical row is still misleading before activation

## 7. Flow-Spec Truth

Seventeen Playwright specs exist. That is better than "0/11 written". But many required flows still do not hard-fail when implementation is missing.

Hard warning: current suite is not same thing as validated product behavior.

Soft-pass flows:
- Flow 2 returns if no student projections, unsupported assessment write, or no matching projection: `tests-e2e/specs/flow-2-evidence-reaction.spec.ts:31-70`
- Flow 4 returns on unsupported task create / task placement / task read / day advance: `tests-e2e/specs/flow-4-scheduled-nextday.spec.ts:31-79`
- Flow 6 returns if `/advance` missing: `tests-e2e/specs/flow-6-nextstage-autoresolve.spec.ts:28-37`
- Flow 9 returns on missing unlock routes at every stage: `tests-e2e/specs/flow-9-hod-cycle.spec.ts:31-104`
- Flow 11 returns on missing `/stop`: `tests-e2e/specs/flow-11-stop.spec.ts:36-49`

Weak assertions:
- Flow 10 UI accepts "Counterfactual panel not wired": `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts:83-96`
- Flow 6 open-case assertion is deliberately weak and does not prove actual auto-resolution history: `tests-e2e/specs/flow-6-nextstage-autoresolve.spec.ts:52-65`

Meaning:
- flow coverage exists as contract scaffolding
- but "spec exists" still often means "missing feature documented, test green anyway"

## 8. Pipeline Truth

### 8.1 What is true

Pipeline does contain real parallel-safety mechanisms:
- SQLite/WAL task claim
- per-task worktrees
- `parallel_group`
- account cooldown / busy-account guards
- merge controller

Evidence claimed in docs:
- `pipeline/README.md:12-26`
- `pipeline/RUNBOOK.md:113-124`

### 8.2 What is not yet true enough

Current unit suite in pipeline venv is red:

- `pipeline/tests/test_dag.py::test_load_and_materialise`
- `pipeline/tests/test_dag.py::test_materialise_idempotent`
- `pipeline/tests/test_router.py::test_pick_prefers_higher_provider_priority`

Observed via:
- `pipeline/.venv/bin/pytest pipeline/tests/test_dag.py pipeline/tests/test_router.py -q`

Break reasons:
- DAG materialization now enforces git-tracked files, but tests still build tmp untracked prompt files without setting bypass env:
  - guard: `pipeline/orchestrator/dag.py:187-236`
- provider priority says `codex` > `github-copilot`:
  - `pipeline/orchestrator/slot_ledger.py:33-46`
  - but router test still expects Copilot to win:
  - `pipeline/tests/test_router.py:34-40`

Docs drift:
- runbook still says `# 51 passed`: `pipeline/RUNBOOK.md:106-124`
- current suite is not fully green

Net:
- pipeline is promising and partly solid
- "safe parallelism" claim is overstated until tests/docs are reconciled and green again

## 9. ML / Calibration Truth

### 9.1 Corpus still interim

Current tracked model/calibration/challenger artifacts all still mark corpus as `interim`.

Evidence:
- `air-mentor-api/output/proof-risk-model/local-v8-corrected-logistic-latest.json`
- `air-mentor-api/output/proof-risk-model/beta-calibration-v8-local-latest.json:1-108`
- `air-mentor-api/output/proof-risk-model/catboost-challenger-local-latest.json`

### 9.2 Beta calibration not promotable on current tracked artifact

Current tracked latest artifact says per-head blocking still exists.

Evidence:
- `air-mentor-api/output/proof-risk-model/beta-calibration-v8-local-latest.json:98-107`

Example:
- `attendanceRisk` has `betaBlockedPerHead: true`
- `worsensLocal04: true`

### 9.3 Evaluation corpus report is stale and incomplete

Tracked `evaluation-report.json` is older (`2026-04-20`) and still shows incomplete governed-run evidence.

Evidence:
- `air-mentor-api/output/proof-risk-model/evaluation-report.json:1-100`

Notable:
- `incompleteGovernedRunIds` includes `sim_mnc_2023_first6_v1`
- many manifest seeds missing

### 9.4 Doc/artifact drift exists inside ML closeout

Closeout doc claims:
- corrected beta-vs-raw gate
- only `1/5 blocked`
- artifact dir `beta-calibration-v8-local-20260423T022222Z/`

Evidence:
- `audit-map/22-evals/overnight-ml-beta-calibration.md:5-74`

But current tracked latest JSON is dated `2026-04-22T23:10:44+00:00` and still shows head-level blocking in latest repo-tracked artifact:
- `air-mentor-api/output/proof-risk-model/beta-calibration-v8-local-latest.json:1-108`

Net:
- ML progress real
- promotable/default-production claim still not earned from current tracked truth

## 10. Doc Canon Drift

`docs/closeout/frozen-decision-appendix.md` correctly freezes several intended contracts, including:
- simulator route authoritative
- stop != archive
- HOD correction-cycle true sequence

Evidence:
- `docs/closeout/frozen-decision-appendix.md:186`
- `docs/closeout/frozen-decision-appendix.md:204-211`
- `docs/closeout/frozen-decision-appendix.md:251-255`

But current codebase still diverges from those frozen statements in the exact gaps listed above.

`audit-map/14-reconciliation/final-decision-appendix.md` is not authoritative enough; it still effectively says no frozen rule body was added.

## 11. Current Priority Order

If goal is "real product + realistic teacher demo", current highest-value gap order is:

1. wire `/advance` and `/stop` routes to existing services
2. wire HOD correction-cycle HTTP/state persistence around existing engine
3. move HOD final analytics UI off diagnostic diff route onto simulator route
4. remove wall-clock leakage from queue/calendar task activation
5. convert soft-pass flow specs into hard-fail runtime checks for required flows
6. stabilize Playwright local browser environment so browser truth is real, not inferred
7. reconcile pipeline tests/docs before claiming safe parallel orchestration
8. rerun ML promotion only after corrected corpus is authoritative

