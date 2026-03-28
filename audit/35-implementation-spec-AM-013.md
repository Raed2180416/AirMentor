# AirMentor Implementation Spec AM-013

## Problem statement
AirMentor’s default green baseline does not exercise all of the system’s heaviest proof, browser, and live-stack flows, so the verification story is stronger on contracts than on full-system confidence.

## Exact code locations
- Root verification scripts:
  - `package.json`
  - `verify:proof-closure`
  - `verify:proof-closure:proof-rc`
  - `verify:proof-closure:live`
- Backend suite partition:
  - `air-mentor-api/package.json`
  - `air-mentor-api/scripts/run-vitest-suite.mjs`
- Acceptance and smoke scripts:
  - `scripts/system-admin-live-acceptance.mjs`
  - `scripts/system-admin-live-request-flow.mjs`
  - `scripts/system-admin-proof-risk-smoke.mjs`
  - `scripts/system-admin-teaching-parity-smoke.mjs`
- CI workflows:
  - `.github/workflows/deploy-pages.yml`
  - `.github/workflows/deploy-railway-api.yml`

## Root cause
Heavy proof and browser flows were separated from the fast suite for cost and speed reasons, but no always-on verification program replaced them.

## Full dependency graph
- root scripts -> frontend build/test + backend build/test + proof smoke
- backend suite runner -> fast versus `proof-rc` gating
- browser scripts -> seeded live stack bootstrapping + real flow coverage
- GitHub workflows -> deploy targets with limited non-deploy verification coverage

## Affected user journeys
- proof dashboard creation and playback
- faculty proof panel
- student shell and risk explorer
- admin request workflow
- live admin and teaching parity flows

## Risk if left unfixed
- high-value regressions continue to slip past default verification
- refactors will feel riskier than they need to because proof confidence is not automated enough
- deployments can look healthy while important journeys are not actually proven

## Target future architecture or behavior
- a clearly tiered verification program:
  - fast PR checks
  - scheduled or gated proof-heavy backend checks
  - scheduled or gated browser/live-stack flows
- CI status accurately represents confidence in the flagship flows

## Concrete refactor or fix plan
1. Add a dedicated non-deploy CI workflow for lint, build, frontend tests, and backend fast tests.
2. Promote proof-closure scripts into regular CI cadence:
   - at minimum on main-branch merge or nightly
   - ideally as a gated pre-release job
3. Add explicit CI reporting for the `proof-rc` suite rather than burying it behind optional local commands.
4. Treat the live admin, request, proof smoke, and parity scripts as named acceptance gates.
5. Publish a verification matrix showing which issues and features each suite covers.

## Sequencing plan
- Start with CI visibility and naming.
- Then add proof-heavy and browser suites on a realistic cadence.
- Keep cadence aligned with AM-008 telemetry so gaps can be observed both in CI and runtime.

## Migration strategy
- Add new workflows before changing existing deploy workflows.
- Keep fast feedback loops for normal PRs while adding slower confidence jobs on merge, schedule, or release branches.

## Testing plan
- Validate that each new workflow runs in CI with clear pass/fail states.
- Add smoke assertions that environment bootstrappers fail clearly when prerequisites are missing.
- Verify that proof-heavy jobs cover the expected test files and scripts.

## Rollout plan
- Stage 1: non-deploy CI workflow.
- Stage 2: proof-rc cadence.
- Stage 3: browser/live-stack cadence.
- Stage 4: documented coverage matrix and branch policy alignment.

## Fallback / rollback plan
- If new jobs are too expensive or flaky, keep them visible as non-blocking required reports first instead of silently removing them.
- Preserve the fast suite while iterating on heavier jobs.

## Acceptance criteria
- CI has a non-deploy verification workflow.
- The repository exposes a clear difference between fast confidence and full proof confidence.
- At least one regular automated cadence covers proof-heavy backend tests and one covers live browser flows.
- Feature owners can point to the exact suite that protects each flagship feature.

## Open questions
- Which heavy suites should be blocking versus advisory?
- What cadence is acceptable for seeded live-stack browser flows?

## Complexity and change risk
- Complexity: M
- Risk of change: Medium
- Prerequisite issues: AM-008
- Downstream issues unblocked: AM-001, AM-006, AM-010, AM-015
