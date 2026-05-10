# AirMentor Truth Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the verified full-realism closure truth from `full-realism-demo-closure` onto the current `college-demo-2026-04-27` workspace branch, then reverify that root has honest H8/N1 evidence and explicit residual gaps.

**Architecture:** This is a reconciliation lane, not a new feature. Use ordered cherry-picks of the six verified closure commits, avoid manual doc-only truth drift, and rerun focused backend/text/type/browser checks before claiming root is current.

**Tech Stack:** Git, TypeScript, Vitest, Playwright Firefox, existing AirMentor proof-run APIs and docs.

---

## File Structure

- Modify via cherry-pick: `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts`
  - Carries closure proof-run queue/bootstrap support imported from the closure commit.
- Modify via cherry-pick: `air-mentor-api/src/lib/proof-realism-audit.ts`
  - Contains proof realism comparison helpers used by backend tests.
- Modify via cherry-pick: `air-mentor-api/src/lib/proof-run-queue.ts`
  - Preserves closure support for proof-run queue metadata.
- Modify via cherry-pick: `air-mentor-api/src/modules/admin-proof-sandbox.ts`
  - Preserves route wiring for Section B override-run realism proof.
- Modify via cherry-pick: `air-mentor-api/tests/proof-realism-audit.test.ts`
  - Backend proof for 30-checkpoint seeded realism and true baseline/stressed override-run comparison.
- Modify via cherry-pick: `air-mentor-api/tests/proof-run-queue.test.ts`
  - Regression coverage for imported proof-run queue behavior.
- Modify via cherry-pick: `tests-e2e/helpers/proof-run-api.ts`
  - Playwright API helpers for proof dashboard/checkpoint/recompute/advance flows.
- Create via cherry-pick: `tests-e2e/specs/editable-data-recompute.spec.ts`
  - Browser/API proof that Course Leader attendance edit reaches recomputed proof evidence.
- Create via cherry-pick: `tests-e2e/specs/full-demo-ladder.spec.ts`
  - Browser proof across sysadmin, Course Leader, Mentor, HoD, Sem 1, and Sem 6 surfaces.
- Create via cherry-pick: `tests/causal-language.test.ts`
  - Text guard against synthetic proof overclaim.
- Create via cherry-pick: `docs/paper-evidence/causal-evaluation-protocol.md`
  - Written boundary for synthetic proof vs production/causal claims.
- Modify via cherry-pick: `audit-map/32-reports/proof-realism-audit-2026-05-10.md`
  - Closure evidence ledger.
- Modify via cherry-pick: `docs/CAPABILITY_MATRIX.md`
  - Conservative N1/H8 status update.

---

## Task 1: Preflight Current Root And Closure Branch

**Files:**
- Read: `docs/CAPABILITY_MATRIX.md`
- Read: `audit-map/32-reports/proof-realism-audit-2026-05-10.md`
- Read: closure branch history and diff

- [ ] **Step 1: Verify branch and clean tree**

Run:

```bash
git status --short --branch
```

Expected:

```text
## college-demo-2026-04-27
```

and no modified/staged/untracked files except intentional plan/spec files already committed.

- [ ] **Step 2: Verify closure commits**

Run:

```bash
git log --oneline --decorate --left-right --cherry-pick college-demo-2026-04-27...full-realism-demo-closure --max-count=20
```

Expected output includes exactly these closure commits on the `full-realism-demo-closure` side:

```text
77b48cad docs: update proof realism closure evidence
66abe80c test: tune override-run risk threshold
62f2bc00 test: guard causal claim language
ad491506 test: prove full browser demo ladder
7c749ac1 test: prove editable data recomputes proof evidence
2dd09225 test: prove override-run proof realism
```

- [ ] **Step 3: Verify diff scope is narrow**

Run:

```bash
git diff --stat college-demo-2026-04-27..full-realism-demo-closure -- docs/CAPABILITY_MATRIX.md audit-map/32-reports/proof-realism-audit-2026-05-10.md docs/paper-evidence tests tests-e2e air-mentor-api/tests air-mentor-api/src/lib/proof-realism-audit.ts air-mentor-api/src/lib/proof-run-queue.ts air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts air-mentor-api/src/modules/admin-proof-sandbox.ts
```

Expected: diff only in closure proof/test/docs files. Stop if broad unrelated source files appear.

---

## Task 2: Cherry-Pick Closure Commits Onto Root

**Files:**
- Modify via Git: closure diff files listed in File Structure

- [ ] **Step 1: Apply true override-run realism commit**

Run:

```bash
git cherry-pick 2dd09225
```

Expected: commit applies cleanly or conflicts only inside proof realism/queue/sandbox files.

If conflicts occur, inspect:

```bash
git status --short
git diff --name-only --diff-filter=U
```

Allowed conflict files:

```text
air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts
air-mentor-api/src/lib/proof-realism-audit.ts
air-mentor-api/src/lib/proof-run-queue.ts
air-mentor-api/src/modules/admin-proof-sandbox.ts
air-mentor-api/tests/proof-realism-audit.test.ts
air-mentor-api/tests/proof-run-queue.test.ts
```

Stop if any unrelated conflict appears.

- [ ] **Step 2: Apply editable-data recompute commit**

Run:

```bash
git cherry-pick 7c749ac1
```

Expected: creates/updates only Playwright helper and `editable-data-recompute` spec.

- [ ] **Step 3: Apply full browser ladder commit**

Run:

```bash
git cherry-pick ad491506
```

Expected: creates/updates only Playwright helper and `full-demo-ladder` spec.

- [ ] **Step 4: Apply claim-safety guard commit**

Run:

```bash
git cherry-pick 62f2bc00
```

Expected: creates `tests/causal-language.test.ts`, creates causal protocol doc, and applies any narrow wording fix from the closure branch.

- [ ] **Step 5: Apply threshold tuning commit**

Run:

```bash
git cherry-pick 66abe80c
```

Expected: adjusts only override-run test thresholds based on observed generated-run deltas.

- [ ] **Step 6: Apply closure evidence docs commit**

Run:

```bash
git cherry-pick 77b48cad
```

Expected: updates only `docs/CAPABILITY_MATRIX.md` and `audit-map/32-reports/proof-realism-audit-2026-05-10.md`.

- [ ] **Step 7: Confirm root contains closure artifacts**

Run:

```bash
test -f tests-e2e/specs/editable-data-recompute.spec.ts
test -f tests-e2e/specs/full-demo-ladder.spec.ts
test -f tests/causal-language.test.ts
test -f docs/paper-evidence/causal-evaluation-protocol.md
git status --short
```

Expected: all `test -f` commands exit 0; `git status --short` shows a clean working tree after cherry-pick commits complete.

---

## Task 3: Targeted Backend/Text/Type Verification

**Files:**
- Test: `air-mentor-api/tests/proof-realism-audit.test.ts`
- Test: `tests/causal-language.test.ts`
- Config: `air-mentor-api/tsconfig.json`
- Config: `tsconfig.tests.json`

- [ ] **Step 1: Run backend realism and causal guard tests**

Run:

```bash
npx vitest run tests/proof-realism-audit.test.ts tests/causal-language.test.ts --reporter=dot --testTimeout=300000
```

Expected:

```text
Test Files  2 passed
Tests  5 passed
```

If the exact runtime differs, record it. If `proof-realism-audit` takes several minutes, wait for completion rather than interrupting.

- [ ] **Step 2: Run backend typecheck**

Run:

```bash
npx tsc -p air-mentor-api/tsconfig.json --noEmit --pretty false
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run root tests typecheck**

Run:

```bash
npx tsc -p tsconfig.tests.json --noEmit --pretty false
```

Expected: no TypeScript errors.

If this reports known pre-existing top-level await or zod locale errors, document the exact errors and prove they are not from the cherry-picked files before continuing.

---

## Task 4: Browser Verification Preflight And Focused Pack

**Files:**
- Test: `tests-e2e/specs/proof-ui-population.spec.ts`
- Test: `tests-e2e/specs/editable-data-recompute.spec.ts`
- Test: `tests-e2e/specs/full-demo-ladder.spec.ts`
- Config: `tests-e2e/playwright.config.ts`

- [ ] **Step 1: Check whether expected local ports are listening**

Run:

```bash
python - <<'PY'
import socket
for host, port in [('127.0.0.1', 5174), ('127.0.0.1', 4100), ('127.0.0.1', 5173), ('127.0.0.1', 4000)]:
    sock = socket.socket()
    sock.settimeout(0.5)
    try:
        sock.connect((host, port))
        print(f'{host}:{port} open')
    except OSError:
        print(f'{host}:{port} closed')
    finally:
        sock.close()
PY
```

Expected: identify whether closure ports `5174/4100` or default ports `5173/4000` are available.

- [ ] **Step 2: Run focused browser pack if closure ports are open**

Run this when `127.0.0.1:5174` and `127.0.0.1:4100` are open:

```bash
AIRMENTOR_PW_SKIP_WEBSERVER=1 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5174 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/proof-ui-population.spec.ts tests-e2e/specs/editable-data-recompute.spec.ts tests-e2e/specs/full-demo-ladder.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/root-truth-reconciliation
```

Expected:

```text
3 passed
```

- [ ] **Step 3: Run focused browser pack on default ports if default servers are open**

Run this when `127.0.0.1:5173` and `127.0.0.1:4000` are open and closure ports are closed:

```bash
AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/proof-ui-population.spec.ts tests-e2e/specs/editable-data-recompute.spec.ts tests-e2e/specs/full-demo-ladder.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/root-truth-reconciliation
```

Expected:

```text
3 passed
```

- [ ] **Step 4: Defer browser verification if no servers are open**

If no frontend/backend pair is open, do not claim browser rerun. Record:

```text
Browser verification deferred: no matching local frontend/backend server pair was open during Phase 0 preflight.
```

Then leave the closure branch's prior browser evidence in the audit report as imported evidence, not fresh root rerun evidence.

---

## Task 5: Final Evidence And Next-Lane Summary

**Files:**
- Read: `docs/CAPABILITY_MATRIX.md`
- Read: `audit-map/32-reports/proof-realism-audit-2026-05-10.md`

- [ ] **Step 1: Confirm conservative matrix rows**

Run:

```bash
grep -n "works locally for seeded M&C proof\|E2E suite (Playwright)" docs/CAPABILITY_MATRIX.md
```

Expected output includes:

```text
8 scenario families implemented (`scenarioProfileForSeed`) | works locally for seeded M&C proof
E2E suite (Playwright) for full demo walkthrough | partial
```

- [ ] **Step 2: Confirm final residual gaps are still explicit**

Run:

```bash
grep -n "Real institutional data import\|Production ML accuracy\|Deployment closeout\|Multi-program generalization" audit-map/32-reports/proof-realism-audit-2026-05-10.md
```

Expected output includes all four residual boundaries.

- [ ] **Step 3: Review final git history and status**

Run:

```bash
git log --oneline --decorate --max-count=10
git status --short
```

Expected:

- latest commits include this plan/spec and the six closure commits,
- working tree is clean except intentionally ignored generated artifacts.

- [ ] **Step 4: Recommend next lane**

Final answer should state:

```text
Next recommended lane: P5 demo isolation/reset, because it protects later browser proof, auth/session state, reset semantics, and multi-program work from global-data pollution.
```

Do not start P5 until Phase 0 verification is summarized.
