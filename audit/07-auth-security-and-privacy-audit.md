# AirMentor Auth Security And Privacy Audit

## What this area does
This document audits authentication, authorization, session handling, origin protections, privacy boundaries, and sensitive-data exposure patterns.

## Confirmed observations
- Authentication is cookie-session-based through `air-mentor-api/src/modules/session.ts`.
- Session restoration and role grant resolution happen via `resolveRequestAuth` in `air-mentor-api/src/modules/support.ts`.
- `registerSessionRoutes()` installs a `preHandler` that resolves `request.auth` from the session cookie across the app, not only for session routes.
- Authorization is mostly route-level and role-grant-based through `requireAuth`, `requireRole`, and scope-aware logic inside `academic.ts`, `admin-control-plane.ts`, and proof-access helpers.
- Mutating requests are blocked when the `Origin` header is absent or not allowlisted in `air-mentor-api/src/app.ts`.
- Session cookie posture from `air-mentor-api/src/config.ts` is now environment-aware:
  - cookie name `airmentor_session`
  - local-first default remains `secure = false`, `sameSite = lax`
  - production-like origins now default to `secure = true`, `sameSite = none`
  - TTL = 7 days
- Explicit CSRF protection now exists through `air-mentor-api/src/lib/csrf.ts`, `air-mentor-api/src/app.ts`, `air-mentor-api/src/modules/session.ts`, `src/api/client.ts`, and `src/api/types.ts`.
- Login throttling and auth telemetry now exist in `air-mentor-api/src/modules/session.ts`.
- The proof surfaces intentionally limit explanatory language and scope. Tests enforce mentor, course-leader, HoD, and system-admin access boundaries in `air-mentor-api/tests/student-agent-shell.test.ts` and `air-mentor-api/tests/risk-explorer.test.ts`.

## Current-state reconciliation (2026-03-28)
- The earlier claim that there was no rate limiting and no explicit CSRF strategy is no longer correct.
- What is now true:
  - login throttling is enforced in `air-mentor-api/src/modules/session.ts`
  - login throttling state is persisted in `login_rate_limit_windows`, so it is no longer process-local
  - mutating authenticated requests require `X-AirMentor-CSRF`
  - the server validates the session-bound CSRF token against both cookie and header in `air-mentor-api/src/app.ts`
  - session/login/restore payloads now expose `csrfToken` for the typed client to retain and replay
  - production-like startup now fails if `CSRF_SECRET` is not explicitly configured
- What still remains open:
  - field-level minimization for large proof/admin payloads is still limited
  - deployment-topology-specific hardening such as edge-level abuse controls may still be desirable outside the repo

## Key workflows and contracts
### Auth flow
1. User logs in with username and password at `/api/session/login`.
2. Backend validates the password hash from `user_password_credentials`.
3. Login is effectively username-based even though the request field is named `identifier`.
4. Login requires an active user account, an active faculty profile, and at least one active role grant.
5. Backend selects the default active role grant from sorted active grants using the explicit role priority order in `support.ts`.
6. `GET /api/session` also refreshes `lastSeenAt` and `updatedAt`, so it acts as a keepalive.
7. `POST /api/session/role-context` can only switch to one of `auth.availableRoleGrants`.
8. Cookie session is stored in `sessions` and sent as `httpOnly` cookie.
9. Frontend restores session via `/api/session`.

### Authorization model
- Role grant codes: `SYSTEM_ADMIN`, `HOD`, `COURSE_LEADER`, `MENTOR`
- Role scope comes from `role_grants.scopeType` and `scopeId`
- Proof access is further constrained by academic ownership, mentor assignment, HoD branch supervision, or explicit system-admin override for archived runs
- Some write paths are stricter than generic role checks:
  - faculty-calendar workspace writes require `COURSE_LEADER`, matching `auth.facultyId`, and an open direct-edit window
  - student-shell message posting requires the session viewer faculty and role to match the shell session and, for academic roles, the active proof run

## Findings
### Security strengths
- The backend does not rely only on frontend hiding. Proof-access tests explicitly verify allowed and denied scenarios.
- Session cookies are `httpOnly`, and mutating requests require an allowlisted origin.
- Optimistic concurrency checks reduce stale-write races in many admin flows.

### Security and privacy weaknesses
- Login throttling now exists and is DB-backed, but there is still no full anomaly-detection or lockout policy beyond rate limiting.
- CSRF protection is now materially stronger because it requires a session-bound double-submit token, but the remaining posture still depends on correct cookie and origin configuration.
- local development still defaults to insecure cookies by design, so deployment correctness remains important even though production-like defaults are stricter.
- Proof endpoints return rich student and faculty detail payloads. Access appears role-scoped correctly, but field-level minimization is limited because large shaped payloads are returned wholesale once access is granted.

## Implications
- **Technical consequence:** the current auth model is understandable and internally consistent, but it lacks several abuse-hardening layers.
- **Operational consequence:** if a production configuration mistake leaves secure cookies disabled or origin allowlists too broad, the security posture drops sharply.
- **Privacy consequence:** proof payloads are intentionally rich for authorized faculty, which makes access control correctness especially important.

## Recommendations
- Keep login throttling in place and extend it into clearer anomaly/lockout posture if abuse pressure grows.
- Keep the production-like secure-cookie and explicit-CSRF-secret startup gates strict, and document the expected deploy-time env contract clearly.
- Keep the explicit CSRF token contract as mandatory for authenticated mutations and extend coverage if any mutating route still bypasses the shared protection layer.
- Add field-level data minimization review for proof and admin detail payloads so authorized users receive only the data required for that task.

## Confirmed facts vs inference
### Confirmed facts
- Cookie and origin behavior are exactly as described above in `config.ts` and `app.ts`.
- CSRF token generation and validation are now exactly as described above in `csrf.ts`, `session.ts`, `app.ts`, `src/api/client.ts`, and `src/api/types.ts`.
- Login throttling is now present in `session.ts` and emits auth operational telemetry.
- Scope denial tests exist for mentor, HoD, and archived-run access in proof endpoints.
- `air-mentor-api/tests/http-smoke.test.ts` manually preserves `set-cookie`, always sends `Origin`, and exercises login, session restore, and role switch as a client-like transport/session contract test.

### Reasonable inference
- The app is likely intended for trusted institutional operators, which explains the current balance between usability and hardening. That trust assumption should still be made explicit in deployment guidance.

## Cross-links
- [04 Backend Audit](./04-backend-audit.md)
- [06 API And Integration Audit](./06-api-and-integration-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
