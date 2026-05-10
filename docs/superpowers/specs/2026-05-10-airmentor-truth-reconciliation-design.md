# AirMentor Truth Reconciliation Design — 2026-05-10

## Intent

Bring the current root workspace branch back into alignment with the newest verified closure truth before starting new gap-lane implementation.

The immediate problem is not a new product feature. The current workspace is on `college-demo-2026-04-27`, while the verified full-realism closure commits live on `full-realism-demo-closure`. As a result, `docs/CAPABILITY_MATRIX.md` and the local proof realism audit report in the root branch are stale for H8/N1-style evidence.

## Feature Intent

An evaluator, reviewer, or next implementation agent reading the root branch should see the same truth that was already proven on the closure branch:

- focused browser proof exists for sysadmin, Course Leader, Mentor, HoD, editable-data recompute, and full demo ladder surfaces,
- true Section B override-run proof exists for seeded M&C proof realism,
- synthetic proof claims are guarded from causal or production ML overclaim,
- residual gaps remain explicit: real historical validation, multi-program generalization, deployment closeout, performance baseline, snapshot/coverage audit, and demo isolation/reset.

## Current Context

- Current root branch: `college-demo-2026-04-27`.
- Working tree: clean.
- Closure branch: `full-realism-demo-closure`.
- Closure branch is ahead by six narrow commits:
  - `2dd09225 test: prove override-run proof realism`
  - `7c749ac1 test: prove editable data recomputes proof evidence`
  - `ad491506 test: prove full browser demo ladder`
  - `62f2bc00 test: guard causal claim language`
  - `66abe80c test: tune override-run risk threshold`
  - `77b48cad docs: update proof realism closure evidence`
- Diff scope is narrow: proof realism tests/helpers, two Playwright specs, claim-safety guard, proof-run queue wiring, audit report, and capability matrix rows.

## Approach Options

### Option A: Cherry-pick the six closure commits in order

Use the existing closure commits as the source of truth and apply them linearly onto `college-demo-2026-04-27`.

Pros:

- Preserves reviewed commit boundaries.
- Minimizes accidental side-branch history merge.
- Keeps root branch history easy to audit.
- Matches the actual closure evidence already generated.

Cons:

- May require conflict resolution if root moved in the same files.
- Requires focused re-verification after the cherry-pick.

### Option B: Merge `full-realism-demo-closure` into root

Merge the branch directly.

Pros:

- Fast if histories are clean.
- Preserves branch topology.

Cons:

- Pulls branch topology into the demo root.
- Harder to review if unrelated branch state exists.
- Less controlled for a truth-reconciliation phase.

### Option C: Manually port only docs and matrix rows

Copy the final `docs/CAPABILITY_MATRIX.md` and audit report updates without tests/product commits.

Pros:

- Lowest code churn.
- Fastest doc-only update.

Cons:

- Dangerous truth drift: docs would claim evidence whose test files are not present on root.
- Violates the evidence-first rule.
- Leaves the root branch unable to rerun the closure pack.

## Recommendation

Use **Option A: ordered cherry-pick**.

Reason: Phase 0 is a reconciliation lane, not a new feature lane. The root branch should inherit exactly the already-proven closure artifacts and their supporting tests, then rerun focused verification to make the root branch authoritative.

## Scope

In scope:

1. Apply the six closure commits to `college-demo-2026-04-27` in chronological order.
2. Resolve conflicts only inside the closure diff scope.
3. Re-run targeted verification for the imported evidence.
4. Update only reconciliation metadata if needed.
5. Produce a clean status/diff summary for user review.

Out of scope:

- P5 demo workspace isolation/reset implementation.
- P6 multi-program template implementation.
- P7 recalibration/model governance implementation.
- P8 deployment readiness implementation.
- P9 performance baseline or full regression pack implementation.
- Any production ML or real-data validation claim.

## Reconciliation Plan

### Step 1: Preflight

Verify:

- root branch is `college-demo-2026-04-27`,
- working tree is clean,
- `full-realism-demo-closure` exists,
- closure commits are exactly the expected six commits,
- no untracked generated artifacts are staged.

Stop if the working tree is dirty or the closure branch has unexpected commits.

### Step 2: Apply closure commits

Cherry-pick in this order:

1. `2dd09225`
2. `7c749ac1`
3. `ad491506`
4. `62f2bc00`
5. `66abe80c`
6. `77b48cad`

Conflict policy:

- Preserve root changes if they are newer and do not weaken closure evidence.
- Preserve closure changes if they add the tests, proof helpers, causal guard, or exact evidence rows.
- Do not invent new behavior during conflict resolution.
- If a conflict changes product behavior beyond the imported closure commit, stop and report before continuing.

### Step 3: Verify imported truth

Minimum verification commands:

```bash
npx vitest run tests/proof-realism-audit.test.ts tests/causal-language.test.ts --reporter=dot --testTimeout=300000
npx tsc -p air-mentor-api/tsconfig.json --noEmit --pretty false
npx tsc -p tsconfig.tests.json --noEmit --pretty false
```

Browser verification target, if local frontend/backend servers are available or can be started safely:

```bash
AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5174 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/proof-ui-population.spec.ts tests-e2e/specs/editable-data-recompute.spec.ts tests-e2e/specs/full-demo-ladder.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/root-truth-reconciliation
```

If browser servers are not already available, do not start long-running processes without checking current ports/processes first.

### Step 4: Evidence ledger check

Confirm root branch now contains:

- `tests-e2e/specs/editable-data-recompute.spec.ts`,
- `tests-e2e/specs/full-demo-ladder.spec.ts`,
- `tests/causal-language.test.ts`,
- `docs/paper-evidence/causal-evaluation-protocol.md`,
- updated `audit-map/32-reports/proof-realism-audit-2026-05-10.md`,
- updated `docs/CAPABILITY_MATRIX.md` rows for N1/H8.

The matrix should remain conservative:

- N1 scenario engine: works locally for seeded M&C proof, not multi-program.
- H8 E2E: partial, not full regression pack/performance.
- P5/P6/P7/P8/P9 rows remain open unless separately implemented and verified.

### Step 5: Final summary

Report:

- commits applied,
- conflicts encountered or none,
- verification commands and exact results,
- remaining gap-lane order,
- next recommended implementation lane.

## Attackable Gaps After Phase 0

### Lane P5: Demo isolation/reset

Highest dependency value. It protects later proof, browser, auth, and reset work from polluting global rows.

Open rows include:

- `C1/H1` demo data isolation and regression for global rows untouched,
- `C9` active proof/provisioning collision rule,
- `C10` reset demo workspace,
- `C11` provisioning preview/dry run,
- demo/live badge honesty.

### Lane P6: Multi-program generalization

Needed before claiming AirMentor generalizes beyond M&C 2023.

Open rows include:

- hardcoded `MSRUAS_PROOF_*` constants,
- `1MS23MC{nnn}` USN assumptions,
- fixed student/section/semester counts,
- hardcoded `PROOF_FACULTY`,
- missing `proof_program_templates`,
- missing second program proof run,
- missing per-program scenario family subset.

### Lane P7: Recalibration/model governance

Needed before any stronger ML governance or paper claim.

Open rows include:

- per-program model artifact/version,
- recalibration service,
- recalibration test,
- CatBoost Python interop end-to-end,
- real-data validation boundary.

### Lane P8: Deployment readiness

Needed before Render/backend deployment claim.

Open rows include:

- `render.yaml`,
- `/health`,
- separate worker process,
- Render Postgres migration plan,
- CORS/cookie contract,
- rollback plan,
- Render readiness checker cleanup.

### Lane P9: Regression/performance pack

Needed to make closure evidence repeatable at scale.

Open rows include:

- critical-path coverage audit,
- full Playwright walkthrough pack beyond focused specs,
- performance baseline,
- stale snapshot audit,
- dedicated session stability regressions.

## Risks

- A cherry-pick may conflict with newer root work. Mitigation: stop on product-level conflict and ask for review.
- Focused tests may be long-running. Mitigation: run backend/text/type checks first, then browser pack only after environment preflight.
- Documentation may appear to close more than the tests prove. Mitigation: keep H8 partial and P6/P7/P8/P9 open.
- Existing local servers may not match closure verification ports. Mitigation: inspect ports before starting/reusing servers.

## Acceptance Criteria

Phase 0 is complete only when:

1. The closure commits are present on `college-demo-2026-04-27` or an explicit blocker is documented.
2. Root branch contains the closure test/docs artifacts.
3. Targeted backend/text/type verification passes or failures are classified with evidence.
4. Browser verification is rerun or explicitly deferred because server preflight is not available.
5. `docs/CAPABILITY_MATRIX.md` reflects closure truth without promoting unverified P5/P6/P7/P8/P9 gaps.
6. Final response names the next lane by impact.

## Non-Claims

This phase does not claim:

- real institutional predictive validity,
- production ML accuracy,
- full multi-program support,
- deployment readiness,
- complete E2E/performance coverage,
- demo workspace isolation/reset.
