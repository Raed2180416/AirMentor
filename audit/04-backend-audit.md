# AirMentor Backend Audit

## What this area does
This document audits the Fastify backend: module boundaries, route ownership, shared helpers, request handling, proof orchestration, and operational patterns.

## Confirmed observations
- `air-mentor-api/src/app.ts` composes the application, applies origin checks for mutating requests, registers CORS/cookies/Swagger, loads all route modules, and starts the proof worker.
- `air-mentor-api/src/modules/support.ts` centralizes shared concerns:
  - session restoration
  - role enforcement
  - optimistic version validation
  - audit event emission
  - admin request transition helpers
- `air-mentor-api/src/modules/session.ts` installs app-wide auth resolution, treats `GET /api/session` as a keepalive, selects the default active role through `sortActiveRoleGrantRows(...)`, and only allows role switches to grants already attached to the session.
- `air-mentor-api/src/modules/session.ts` now also enforces login throttling and returns a session-bound `csrfToken` that the client must echo on mutating requests.
- Domain modules are broad rather than narrow:
  - `academic.ts` is now a composition root over split registrars for bootstrap/profile, proof, runtime, and admin-style offering/provisioning surfaces.
  - `admin-structure.ts` owns faculty hierarchy, policy resolution, curriculum feature config, linkage, stage policy, and proof-refresh enqueue behavior.
- `admin-control-plane.ts` is broader than its name suggests. It owns multi-entity search, recent audit events, reminders, faculty-calendar policy enforcement, and the large faculty-profile projection route at `/api/academic/faculty-profile/:facultyId`.
- Proof operations span modules and libraries:
  - admin routes in `admin-proof-sandbox.ts`
  - academic accessors in split academic route modules
  - orchestration in `msruas-proof-control-plane.ts` plus extracted proof service files
  - queueing in `proof-run-queue.ts`
- Backend startup diagnostics and structured operational telemetry now exist in `startup-diagnostics.ts` and `lib/telemetry.ts`.

## Key workflows and contracts
### Route ownership
| Module | Example routes |
| --- | --- |
| `session.ts` | `/api/session`, `/api/session/login`, `/api/session/role-context`, `/api/preferences/ui` |
| `institution.ts` | `/api/admin/institution`, `/api/admin/departments`, `/api/admin/branches`, `/api/admin/terms` |
| `people.ts` | `/api/admin/faculty`, appointments, role grants |
| `students.ts` | `/api/admin/students`, enrollments, mentor assignments |
| `admin-requests.ts` | `/api/admin/requests/*` |
| `admin-control-plane.ts` | `/api/admin/search`, recent audit events, reminders, faculty calendar lock-window enforcement, faculty profile projection |
| `admin-structure.ts` | academic faculties, batches, curriculum, policy, linkage, provisioning |
| `academic.ts` + split academic route modules | public faculty, bootstrap, HoD proof endpoints, student shell, risk explorer, runtime sync, meetings, attendance, schemes, offerings, batch-stage/provisioning utilities, course outcomes, interventions, transcripts |
| `admin-proof-sandbox.ts` | proof dashboard, proof imports, proof runs, checkpoints, evidence timeline, model-artifact inspection, recompute, archive, retry, activate, snapshot restore |

## Current-state reconciliation (2026-03-28)
- Stage 3 is materially complete:
  - `academic-bootstrap-routes.ts`
  - `academic-runtime-routes.ts`
  - `academic-proof-routes.ts`
  - `academic-admin-offerings-routes.ts`
  - `academic-access.ts`
- Stage 6 backend hardening is also materially underway:
  - CSRF double-submit protection is active in `air-mentor-api/src/app.ts`
  - login throttling is active in `air-mentor-api/src/modules/session.ts`
  - degraded proof-refresh enqueue is explicit in `air-mentor-api/src/modules/admin-structure.ts`
- The strongest remaining backend concentration is now the proof-control-plane facade and several still-broad admin modules, not the original `academic.ts` layout alone.

## Findings
### Backend strengths
- Shared helper usage is better than typical CRUD Fastify code. `requireAuth`, `requireRole`, `expectVersion`, `parseOrThrow`, and audit helpers create a consistent baseline.
- The backend test harness exercises real app routes and seeded data, which increases confidence in cross-module contracts.
- Cookie auth and role-switching are explicit rather than hidden behind custom middleware magic.

### Backend weaknesses
- Module names understate the true responsibility concentration. `academic.ts` and `admin-structure.ts` are not just route registrars; they are large orchestration layers.
- Proof orchestration crosses too many boundaries for one feature family:
  - route modules
  - queue worker
  - model artifacts
  - seeded simulation
  - academic scope filters
  - UI payload shaping
- Error handling is standardized, and observability is better than before, but it is still not complete. Structured proof/auth/linkage events now exist, yet there is still no external production observability stack or fully normalized operator surface.

## Implications
- **Technical consequence:** regressions in academic or proof behavior may require reading both a route module and `msruas-proof-control-plane.ts` before the real cause is obvious.
- **Operational consequence:** queue stalls, recompute drift, or scope bugs can occur without rich telemetry to localize them quickly.
- **Product consequence:** backend complexity is high in precisely the areas where the UI makes the strongest trust claims.

## Recommendations
- Split `academic.ts` into route registrars by subdomain:
  - keep the current route split and continue shrinking the composition root
- Split `admin-structure.ts` into hierarchy/policy/curriculum/provisioning services with thinner route wrappers.
- Add structured operational events for proof-run queue transitions, checkpoint availability, recompute failures, and scope-denied access patterns.
- Finish the remaining proof-control-plane decomposition and pull request workflow transitions, reminder semantics, and faculty-calendar lock-window rules into smaller domain services so `admin-control-plane.ts` stops acting as a policy grab-bag.

## Confirmed facts vs inference
### Confirmed facts
- The route modules and helper functions named above exist and are active.
- The proof worker is always started when the app is built.
- Mutating requests are rejected if the `Origin` header is missing or outside the configured allowlist.

### Reasonable inference
- The team has already reached the point where backend feature work is gated more by cognitive load than by missing framework capabilities.

## Cross-links
- [02 System Architecture Overview](./02-system-architecture-overview.md)
- [06 API And Integration Audit](./06-api-and-integration-audit.md)
- [07 Auth Security And Privacy Audit](./07-auth-security-and-privacy-audit.md)
- [10 Performance Scalability And Reliability Audit](./10-performance-scalability-and-reliability-audit.md)
- [18 Proof Sandbox And Curriculum Linkage Audit](./18-proof-sandbox-and-curriculum-linkage-audit.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
