# AirMentor Implementation Spec AM-016

## Problem statement
The current session system is understandable and functionally correct for a trusted internal baseline, but it lacks common abuse-resistance and production-hardening layers such as rate limiting, stronger cookie posture defaults, and richer auth-failure monitoring.

## Exact code locations
- Session routes:
  - `air-mentor-api/src/modules/session.ts`
  - `/api/session`
  - `/api/session/login`
  - `/api/session/role-context`
- Shared auth resolution:
  - `air-mentor-api/src/modules/support.ts`
  - `resolveRequestAuth`
  - `requireAuth`
  - `requireRole`
  - `sortActiveRoleGrantRows`
- Cookie and origin enforcement:
  - `air-mentor-api/src/app.ts`
  - `sendCookie`
  - `app.addHook('onRequest', ...)`
- Default config:
  - `air-mentor-api/src/config.ts`
  - `sessionCookieName`
  - `sessionCookieSecure`
  - `sessionCookieSameSite`
  - `sessionTtlHours`

## Root cause
The auth layer was built for baseline session correctness and role switching, not for hostile or semi-hostile operating conditions, so it relies heavily on deployment hygiene and trusted users.

## Full dependency graph
- login route -> username lookup -> password verification -> session insert -> cookie issuance
- session restore -> `GET /api/session` keepalive -> role grant resolution
- role switching -> session row mutation -> frontend scope changes
- app-wide mutation protection -> origin allowlist + same-site cookie + per-route auth checks

## Affected user journeys
- login
- returning to an active session
- role switching
- any authenticated admin or academic mutation route

## Risk if left unfixed
- brute-force and abusive login patterns remain harder to deter or detect
- production security posture stays too dependent on perfect environment configuration
- enterprise-readiness lags behind the maturity of the domain logic

## Target future architecture or behavior
- login and sensitive mutation routes have explicit abuse protections
- production cookie posture is secure by default or loudly rejected when unsafe
- auth-failure and suspicious activity signals are observable
- role-default behavior is still convenient but more explicit

## Concrete refactor or fix plan
1. Add rate limiting for login and other high-impact auth-sensitive routes.
2. Emit structured auth events for:
   - invalid credentials
   - inactive user
   - missing faculty profile
   - missing grants
   - repeated failures by client or identifier
3. Make insecure production cookie combinations fail loudly in startup checks.
4. Review whether mutating admin routes need CSRF tokens in addition to origin and same-site protections.
5. Add more explicit user-facing messaging around default role selection where it changes effective scope.

## Sequencing plan
- Start after AM-008 telemetry and AM-015 environment diagnostics exist.
- Land additive monitoring and rate limiting before tightening production-only cookie enforcement.

## Migration strategy
- Keep local dev and seeded QA usable with environment-aware bypasses.
- Apply stricter cookie requirements only in production-like modes first.
- Roll out rate limits with observation thresholds before aggressive blocking.

## Testing plan
- Route tests for rate-limited login and role switching.
- Config tests for secure-cookie enforcement rules.
- Smoke validation that seeded scripts still authenticate in supported local modes.

## Rollout plan
- Stage 1: auth telemetry and diagnostics.
- Stage 2: gentle rate limiting and warning-only secure-cookie checks.
- Stage 3: stronger production enforcement once verified in deployed environments.

## Fallback / rollback plan
- Keep rate limits configurable so they can be relaxed without reverting code.
- If production cookie enforcement blocks legitimate traffic, downgrade to warning mode temporarily while keeping telemetry active.

## Acceptance criteria
- Login attempts are rate limited or otherwise abuse-protected.
- Production-mode startup clearly rejects or warns on unsafe cookie posture.
- Auth failures are observable as structured events.
- Local seeded workflows remain intentionally supported, not accidentally broken.

## Open questions
- Which environments should count as production-like for secure-cookie enforcement?
- Is origin plus same-site sufficient for the current admin mutation surface, or should CSRF tokens become mandatory?

## Complexity and change risk
- Complexity: M
- Risk of change: Medium
- Prerequisite issues: AM-008, AM-015
- Downstream issues unblocked: none
