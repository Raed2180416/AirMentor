# AirMentor Implementation Spec AM-015

## Problem statement
AirMentor depends on a configuration-sensitive frontend, backend, local-live stack, and deploy workflow arrangement, but the current environment model is still easy to drift and only partly self-diagnosing.

## Exact code locations
- Frontend environment dependence:
  - `vite.config.ts`
  - `src/system-admin-app.tsx`
  - `src/App.tsx`
  - `VITE_AIRMENTOR_API_BASE_URL`
- Root verification and live scripts:
  - `package.json`
  - `scripts/dev-live.sh`
  - `scripts/live-admin-common.sh`
- Backend runtime config:
  - `air-mentor-api/src/config.ts`
  - `air-mentor-api/src/app.ts`
  - `air-mentor-api/scripts/start-seeded-server.ts`
- Deploy surfaces:
  - `.github/workflows/deploy-pages.yml`
  - `.github/workflows/deploy-railway-api.yml`
  - `air-mentor-api/railway.json`

## Root cause
The product spans multiple targets and modes, but environment rules are still spread across frontend checks, Vite proxy configuration, backend defaults, local scripts, and deploy workflows rather than being enforced by one clear preflight system.

## Full dependency graph
- frontend boot -> `VITE_AIRMENTOR_API_BASE_URL` or Vite proxy -> backend origin/cookie expectations
- backend boot -> config defaults -> DB, CORS, session cookie, host, port
- local live scripts -> seeded server -> embedded Postgres + dynamic port allocation + same-origin proxy assumptions
- deploy workflows -> GitHub vars/secrets -> Railway health verification or skip paths

## Affected user journeys
- opening the teaching workspace
- opening the system-admin workspace
- running local live verification
- shipping frontend and backend deploys safely

## Risk if left unfixed
- environment mistakes continue to look like product outages
- local live parity remains fragile
- deploy workflows can succeed or skip without reflecting full confidence
- debugging startup failures remains slower than necessary

## Target future architecture or behavior
- one explicit environment matrix defines valid modes:
  - local mockless frontend + live backend
  - local seeded live stack
  - deployed frontend
  - deployed backend
- startup diagnostics and CI preflight checks fail clearly and early

## Concrete refactor or fix plan
1. Publish an environment contract matrix covering required vars, optional vars, and supported modes.
2. Add backend diagnostics for:
   - active CORS allowlist
   - cookie security posture
   - DB target
   - worker startup
3. Add frontend diagnostics that explain whether it is using direct API base URL or same-origin proxy mode.
4. Add CI preflight checks for deployment-required variables before deploy jobs start.
5. Unify local live startup checks so seeded stack assumptions fail early with clear remediation.

## Sequencing plan
- Start alongside AM-013 so verification and environment work improve together.
- Keep diagnostics additive before changing any actual runtime defaults.

## Migration strategy
- Add diagnostics and preflight first.
- Tighten environment enforcement only after deploy and local-live teams can see and fix current drift.

## Testing plan
- Add tests or smoke checks for missing required env behavior.
- Validate live scripts in a clean environment and an intentionally misconfigured environment.
- Verify that deploy workflows report skipped configuration explicitly.

## Rollout plan
- Stage 1: diagnostics and environment matrix.
- Stage 2: CI preflight.
- Stage 3: stricter production-mode validation.

## Fallback / rollback plan
- Diagnostics can be retained even if stricter enforcement proves too disruptive.
- If preflight blocks legitimate flows, downgrade to warning mode while documenting the gap.

## Acceptance criteria
- Every supported run mode has an explicit environment contract.
- Frontend and backend startup failures are actionable rather than generic.
- CI exposes missing deploy configuration before or during verification, not after user-visible failure.
- Local live-stack boot has a clear health signal.

## Open questions
- Should local proxy mode remain the default local-live approach, or should all local modes use explicit API base URLs?
- Which deployment target is authoritative for production-like verification?

## Complexity and change risk
- Complexity: M
- Risk of change: Medium
- Prerequisite issues: AM-013
- Downstream issues unblocked: AM-016
