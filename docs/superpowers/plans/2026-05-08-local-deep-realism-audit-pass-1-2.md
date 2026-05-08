# Local Deep Realism Audit Pass 1-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the current-truth ledger and local E2E evidence loop for AirMentor’s local MSRUAS proof demo before deeper repairs.

**Architecture:** Use existing local startup scripts, existing API routes, existing Playwright support, and small evidence artifacts under `audit-map/32-reports/` plus `output/playwright/local-deep-realism/`. Do not trust stale docs until code/API/browser evidence agrees. Keep this pass read-heavy; fixes only happen after a reproducible failing flow is found.

**Tech Stack:** React 19, Vite, Fastify, Drizzle, embedded/local Postgres harnesses, Vitest, Playwright Firefox via nix shell, zsh scripts.

---

## File Structure

- Modify: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`
  - Responsibility: source-of-truth ledger for verified local demo/product facts, stale doc notes, open blockers, and evidence paths.
- Modify: `audit-map/24-agent-memory/known-facts.md`
  - Responsibility: append durable facts only after Pass 1/2 evidence is collected.
- Create or update as needed: `output/playwright/local-deep-realism/`
  - Responsibility: screenshots, trace/video if enabled, console/network dumps, run summaries. This directory is generated evidence and should not be committed unless a specific artifact is intentionally promoted.
- Read only unless a failure requires repair: `scripts/demo-start-backend.sh`, `scripts/demo-start-frontend.sh`, `scripts/demo-bootstrap-proof.mjs`, `tests-e2e/specs/*.spec.ts`, `tests-e2e/fixtures/seeded-run-fixture.ts`, `air-mentor-api/src/modules/admin-proof-sandbox.ts`, `air-mentor-api/src/modules/academic*.ts`, `src/system-admin-proof-dashboard-workspace.tsx`, `src/academic-route-pages.tsx`, `src/pages/course-pages.tsx`, `src/hod-counterfactual-panel.tsx`.

## Execution Rules

- Do not stage or commit unrelated WIP already present in the repository.
- Use `git status --short` before and after each task.
- Use `PAGER=cat` compatible commands; never change directory inside command strings.
- Prefer targeted test commands before full suites.
- If a browser/API test fails, attach exact status, URL, role, screenshot path, console error, and suspected code path in the truth ledger before fixing.

### Task 1: Create Pass 1 truth ledger shell

**Files:**
- Create: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`

- [ ] **Step 1: Write the ledger shell**

Create `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md` with this exact structure:

```markdown
# Local Deep Realism Truth Ledger — 2026-05-08

## Runtime Target

- Frontend: local Vite app at `http://127.0.0.1:5173`.
- Backend: local Fastify API at `http://127.0.0.1:4000`.
- Hosted GitHub Pages/Railway: deferred for this campaign.

## Verification Rules

A claim is green only when browser, API, code path, and a repeatable command or test agree.

## Current Evidence Index

| Evidence | Path | Status | Notes |
|---|---|---|---|
| Design spec | `docs/superpowers/specs/2026-05-08-local-deep-realism-audit-design.md` | green | Approved local-only campaign scope. |

## Current Truth Snapshot

| Area | Verified fact | Evidence | Status |
|---|---|---|---|
| Local target | Local frontend + local backend are the only active targets for this pass. | user instruction + design spec | green |

## Stale or Risky Prior Claims

| Claim | Source | Risk | New verification needed |
|---|---|---|---|
| GitHub Pages fallback is a target | older demo docs | stale | Ignore for current pass; local only. |

## Flow Matrix

| Flow | Browser proof | API proof | Code path | Result | Evidence path |
|---|---|---|---|---|---|
| Sysadmin login | pending | pending | pending | pending | pending |
| Proof bootstrap/create/activate | pending | pending | pending | pending | pending |
| Course Leader login | pending | pending | pending | pending | pending |
| Mentor login | pending | pending | pending | pending | pending |
| HoD analytics/counterfactual | pending | pending | pending | pending | pending |
| Next Day / Previous Day / Next Stage | pending | pending | pending | pending | pending |
| Attendance edit recompute | pending | pending | pending | pending | pending |
| Marks edit recompute | pending | pending | pending | pending | pending |
| Timetable/calendar interaction | pending | pending | pending | pending | pending |
| Stage evidence gating | pending | pending | pending | pending | pending |

## Findings

No findings yet.

## Fix Queue

| Priority | Finding | Root cause | Proposed fix | Status |
|---|---|---|---|---|

## Commands Run

No commands run yet.
```

- [ ] **Step 2: Verify file exists**

Run: `test -s audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md && sed -n '1,80p' audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`

Expected: command exits 0 and prints the ledger header plus the flow matrix.

- [ ] **Step 3: Commit only the ledger shell**

Run: `git status --short audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md && git add audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md && git commit -m "docs: start local realism truth ledger"`

Expected: commit succeeds and no unrelated WIP is staged.

### Task 2: Refresh current code/script/test map

**Files:**
- Modify: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`

- [ ] **Step 1: Inspect authoritative local startup and E2E files**

Run these read-only commands:

```bash
sed -n '1,220p' scripts/demo-start-backend.sh
sed -n '1,220p' scripts/demo-start-frontend.sh
sed -n '1,180p' scripts/demo-bootstrap-proof.mjs
find tests-e2e -maxdepth 3 -type f | sort
sed -n '1,220p' tests-e2e/fixtures/seeded-run-fixture.ts
```

Expected: commands print script/test paths without mutating files.

- [ ] **Step 2: Inspect core route and UI files**

Run these read-only commands:

```bash
sed -n '160,610p' air-mentor-api/src/modules/admin-proof-sandbox.ts
sed -n '1,220p' src/system-admin-proof-dashboard-workspace.tsx
sed -n '1,220p' src/proof-simulation-controls.tsx
sed -n '1,220p' src/hod-counterfactual-panel.tsx
```

Expected: commands identify route and component names used by local proof controls.

- [ ] **Step 3: Update the ledger map**

Append a section named `## Current Code Map — Pass 1` with these rows after the `## Current Truth Snapshot` table:

```markdown
## Current Code Map — Pass 1

| Surface | Authoritative file(s) | Notes |
|---|---|---|
| Local backend startup | `scripts/demo-start-backend.sh`, `air-mentor-api/scripts/start-seeded-server.ts` | Local seeded backend is the proof runtime target for this pass. |
| Local frontend startup | `scripts/demo-start-frontend.sh`, `package.json` scripts | Local Vite frontend is the browser target for this pass. |
| Proof bootstrap | `scripts/demo-bootstrap-proof.mjs`, `air-mentor-api/src/modules/admin-proof-sandbox.ts` | Sysadmin APIs create/import/activate/recompute/advance local proof runs. |
| E2E fixtures | `tests-e2e/fixtures/seeded-run-fixture.ts`, `tests-e2e/specs/*.spec.ts` | Existing tests create isolated seeded runs and log in proof roles. |
| Sysadmin proof UI | `src/system-admin-proof-dashboard-workspace.tsx`, `src/proof-simulation-controls.tsx` | Controls stage/day advance, active run views, recompute, and stop/archive actions. |
| Teacher/HOD UI | `src/academic-route-pages.tsx`, `src/hod-counterfactual-panel.tsx`, `src/pages/course-pages.tsx` | Teacher role surfaces consume academic bootstrap and proof context. |
```

- [ ] **Step 4: Commit the ledger map**

Run: `git add audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md && git commit -m "docs: map local proof audit surfaces"`

Expected: commit contains only the ledger update.

### Task 3: Establish local server status without starting duplicates

**Files:**
- Modify: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`

- [ ] **Step 1: Check if local services already exist**

Run:

```bash
(printf 'backend '; curl -fsS http://127.0.0.1:4000/health || true; printf '\nfrontend '; curl -fsS -I http://127.0.0.1:5173/ | head -n 5 || true)
```

Expected: either health/status output or connection failure text. This step is read-only.

- [ ] **Step 2: Start missing backend only if health fails**

If backend health failed, run non-blocking: `bash scripts/demo-start-backend.sh`

Expected: backend eventually reports `{"ok":true}` at `/health`.

- [ ] **Step 3: Start missing frontend only if frontend HEAD fails**

If frontend HEAD failed, run non-blocking: `bash scripts/demo-start-frontend.sh`

Expected: frontend serves `http://127.0.0.1:5173/`.

- [ ] **Step 4: Record server evidence**

Append this template to `## Commands Run` and fill actual command outcomes:

```markdown
- `curl -fsS http://127.0.0.1:4000/health`: result recorded on 2026-05-08.
- `curl -fsS -I http://127.0.0.1:5173/`: result recorded on 2026-05-08.
```

- [ ] **Step 5: Commit server-status evidence**

Run: `git add audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md && git commit -m "docs: record local demo server status"`

Expected: commit contains only ledger evidence.

### Task 4: Run targeted type/test smoke before browser work

**Files:**
- Modify: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`

- [ ] **Step 1: Run frontend targeted tests**

Run:

```bash
npx vitest run tests/system-admin-proof-dashboard-workspace.test.tsx tests/faculty-profile-proof.test.tsx tests/academic-route-pages.test.tsx --reporter=dot
```

Expected: PASS or exact failing test names. Do not fix yet; record failures first.

- [ ] **Step 2: Run backend targeted tests**

Run from `air-mentor-api` working directory:

```bash
npx vitest run tests/proof-control-plane-advance-service.test.ts tests/proof-control-plane-dashboard-service.test.ts tests/proof-queue-governance.test.ts tests/academic-proof-routes.test.ts --reporter=dot
```

Expected: PASS or exact failing test names. Do not fix yet; record failures first.

- [ ] **Step 3: Run type checks if targeted tests pass**

Run:

```bash
npx tsc -p tsconfig.app.json --noEmit --pretty false
```

Run from `air-mentor-api` working directory:

```bash
npx tsc -p tsconfig.json --noEmit --pretty false
```

Expected: no TypeScript errors or exact error locations.

- [ ] **Step 4: Record smoke results**

Add/update `## Current Evidence Index` rows:

```markdown
| Frontend targeted Vitest | terminal output | pending | system-admin/faculty/academic route smoke. |
| Backend targeted Vitest | terminal output | pending | proof advance/dashboard/queue/academic route smoke. |
| Frontend TypeScript | terminal output | pending | `tsconfig.app.json` noEmit. |
| Backend TypeScript | terminal output | pending | `air-mentor-api/tsconfig.json` noEmit. |
```

Use `green` only for commands that passed.

- [ ] **Step 5: Commit smoke evidence**

Run: `git add audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md && git commit -m "docs: record targeted local smoke results"`

Expected: commit contains only ledger evidence.

### Task 5: Run nix-wrapped Playwright local E2E smoke

**Files:**
- Modify: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`
- Generated: `output/playwright/local-deep-realism/`

- [ ] **Step 1: Create evidence directory**

Run: `mkdir -p output/playwright/local-deep-realism`

Expected: directory exists.

- [ ] **Step 2: List available Playwright specs**

Run: `find tests-e2e/specs -maxdepth 1 -type f -name '*.spec.ts' | sort`

Expected: prints flow specs, including fresh-start and proof-control flows if present.

- [ ] **Step 3: Run the most relevant local Firefox smoke specs via nix wrapper**

Use the repo’s existing nix wrapper pattern if present in `package.json` or scripts. If no wrapper script exists, run this explicit nix shell command:

```bash
nix shell nixpkgs#nodejs_22 nixpkgs#firefox nixpkgs#xvfb-run -c bash -lc 'AIRMENTOR_API_URL=http://127.0.0.1:4000 AIRMENTOR_APP_URL=http://127.0.0.1:5173 PLAYWRIGHT_BROWSER=firefox npx playwright test tests-e2e/specs/flow-1-fresh-start.spec.ts --project=firefox --reporter=line --output=output/playwright/local-deep-realism'
```

Expected: PASS or a failure with screenshot/trace under `output/playwright/local-deep-realism`.

- [ ] **Step 4: If flow-1 passes, run proof-control/advance specs**

Run matching specs only if they exist:

```bash
find tests-e2e/specs -maxdepth 1 -type f \( -name '*next*.spec.ts' -o -name '*stage*.spec.ts' -o -name '*control*.spec.ts' -o -name '*flow-6*.spec.ts' \) | sort
```

Then run each selected spec via the same nix shell pattern.

Expected: PASS or exact failing URL/action/assertion.

- [ ] **Step 5: Attach browser evidence to ledger**

Update `## Flow Matrix` rows for any flow exercised. For each failure, add a `## Findings` entry:

```markdown
### Finding N — Short title

- Flow: `flow-name`
- Browser evidence: `output/playwright/local-deep-realism/...`
- API evidence: `route/status/body excerpt`
- Console/network evidence: `error text or none`
- Suspected code path: `file:path`
- Severity: P0/P1/P2
- Next action: reproduce with targeted API/test before fixing
```

- [ ] **Step 6: Commit Playwright evidence ledger**

Run: `git add audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md && git commit -m "docs: record local playwright smoke evidence"`

Expected: only ledger is committed. Do not commit generated screenshots unless explicitly promoted.

### Task 6: Convert first reproducible P0/P1 failure into a fix plan

**Files:**
- Modify: `audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md`
- Modify: exact code/test files identified by the finding only after reproducing.

- [ ] **Step 1: Choose the highest-severity reproducible failure**

Use this priority order:

1. Local app cannot start or login.
2. Sysadmin cannot create/activate/control proof run.
3. Teacher roles cannot log in or see scoped proof data.
4. Stage evidence leaks future marks or hides available evidence.
5. User edit does not recompute risk/queue.
6. UI wording overclaims synthetic/model reality.

Expected: one finding is selected and marked `in repair` in the ledger.

- [ ] **Step 2: Write or identify a failing regression test**

If the failure is backend logic, add/target a Vitest test under `air-mentor-api/tests/`.
If the failure is frontend UI state, add/target a Vitest test under `tests/`.
If the failure only reproduces in browser integration, add/target an E2E test under `tests-e2e/specs/`.

Expected: the selected test fails before code changes.

- [ ] **Step 3: Implement the smallest root-cause fix**

Touch only files implicated by Step 2. Avoid cosmetic refactors. Preserve local-only target and truthful wording.

Expected: the failing test passes without breaking prior targeted smoke.

- [ ] **Step 4: Re-run affected smoke commands**

Run the selected failing test, then the nearest existing targeted suite from Task 4 or Task 5.

Expected: selected test and nearest suite pass.

- [ ] **Step 5: Update ledger and commit fix**

Update `## Findings` and `## Fix Queue` with final root cause, files changed, and verification commands. Commit only related files:

```bash
git add audit-map/32-reports/local-deep-realism-truth-ledger-2026-05-08.md <changed-test-files> <changed-code-files>
git commit -m "fix: repair local proof <specific-flow>"
```

Expected: focused commit with evidence and fix.

## Self-Review

- Spec coverage: This plan covers Pass 1 current-truth refresh and Pass 2 local E2E proof from the design spec. Passes 3-6 intentionally follow after first evidence/fix loop.
- Unfinished-marker scan: no incomplete-marker or vague test-only steps remain.
- Type consistency: all referenced files and commands match existing AirMentor paths or explicitly generated evidence paths.
- Scope: plan is bounded to local-only runtime and first reproducible repair, not full production hardening.
