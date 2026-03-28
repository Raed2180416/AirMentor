# AirMentor API And Integration Audit

## What this area does
This document audits the API surface, client-server contract quality, and external or environment-driven integrations that affect AirMentor’s runtime behavior.

## Confirmed observations
- `src/api/client.ts` exposes a broad typed client with coverage across session, academic runtime, HoD proof, student shell, risk explorer, admin CRUD, request workflow, curriculum linkage, proof operations, offerings, and reminders.
- `src/api/types.ts` is the shared source of truth for transport shapes on the frontend.
- Backend route coverage spans:
  - session and preferences
  - academic bootstrap and runtime sync
  - additive narrow academic runtime routes for tasks, task placements, and calendar audit
  - HoD proof bundle/summaries
  - student shell and risk explorer
  - admin CRUD domains
  - proof import/run/checkpoint endpoints
  - curriculum linkage and provisioning
- `admin-control-plane.ts` also exposes:
  - `GET /api/admin/search` with route metadata and a 20-result cap
  - `GET /api/admin/audit-events/recent`
  - private reminder CRUD scoped to the current system-admin faculty context
  - faculty-calendar read/write with direct-edit window computation
  - `/api/academic/faculty-profile/:facultyId` even though that path looks “academic”
- External integrations are limited but important:
  - Railway deployment
  - GitHub Pages frontend deployment
  - optional OLLAMA-backed curriculum linkage helper through `air-mentor-api/src/lib/curriculum-linkage.ts`, `curriculum-linkage-python.ts`, and `air-mentor-api/scripts/curriculum_linkage_nlp.py`
- Session/login/restore transport now carries a `csrfToken`, and authenticated mutating requests send `X-AirMentor-CSRF`.
- Curriculum linkage approval now distinguishes `approvalSucceeded` from `proofRefreshQueued`, with degraded-path warning data in the response contract.

## Key workflows and contracts
### Contract strengths
- `AirMentorApiClient` uses `credentials: 'include'` consistently, matching the backend’s cookie session model.
- `AirMentorApiClient` now automatically captures `csrfToken` from session/login/restore responses and sends `X-AirMentor-CSRF` on authenticated writes.
- The client includes dedicated methods for proof checkpoint detail and student detail rather than forcing a generic raw fetch layer.
- The API surface expresses role-specific workflows directly, such as:
  - `/api/academic/hod/proof-*`
  - `/api/academic/student-shell/*`
  - `/api/admin/batches/:batchId/curriculum/linkage-candidates/*`
  - `/api/admin/proof-runs/*`
- Request workflow is a real state machine, not just ad hoc buttons. The backend transition graph is:
  - `New -> In Review | Rejected`
  - `In Review -> Needs Info | Approved | Rejected`
  - `Needs Info -> In Review | Rejected`
  - `Approved -> Implemented | Rejected`
  - `Rejected -> Closed`
  - `Implemented -> Closed`

### Integration controls
- Frontend/API local integration depends on `VITE_AIRMENTOR_API_BASE_URL` and optional proxying through `AIRMENTOR_UI_PROXY_API_TARGET` in `vite.config.ts`.
- Curriculum linkage can use OLLAMA settings from `AIRMENTOR_OLLAMA_BASE_URL`, `OLLAMA_HOST`, and `AIRMENTOR_CURRICULUM_LINKAGE_OLLAMA_MODEL`.
- The Python helper path can be overridden with `AIRMENTOR_CURRICULUM_LINKAGE_PYTHON` and timeout configuration.

## Current-state reconciliation (2026-03-28)
- The API is broader than the original audit described:
  - the old coarse `/sync` routes still exist
  - additive narrow routes now also exist for `tasks`, `task-placements`, and `calendar-audit`
  - proof dashboard payloads now expose queue age, lease state, retry/failure state, and checkpoint readiness diagnostics
  - session/auth transport now includes a first-class CSRF contract
  - curriculum linkage approval now returns explicit degraded-path warning data instead of implying proof-refresh enqueue always succeeded
- The main remaining API debt is now dual-contract drift rather than a total absence of narrower contracts.

## Findings
### API strengths
- The API is broad but explicit. Most important user flows have named endpoints rather than hidden overloaded RPCs.
- The typed client and tests in `tests/api-client.test.ts`, `air-mentor-api/tests/openapi.test.ts`, and seeded route tests reduce contract drift.

### API weaknesses
- The API is also very large for a product at this maturity. One client class covers almost every system surface, which increases change coupling and makes capability boundaries harder to reason about.
- Several runtime sync endpoints are still coarse-grained, even though additive narrow replacements now exist:
  - `/api/academic/runtime/:stateKey`
  - `/api/academic/tasks/sync`
  - `/api/academic/task-placements/sync`
  - `/api/academic/calendar-audit/sync`
- The current contract risk is coexistence drift: both the coarse and narrow runtime contracts are live until cutover finishes.
- The optional OLLAMA linkage path introduces a second execution environment and partial nondeterminism into an otherwise tightly controlled platform.

## Implications
- **Technical consequence:** the API layer is type-safe but not small. It can remain correct while still becoming harder to evolve safely.
- **Operational consequence:** integration issues can emerge from configuration shape alone, especially proxy setup and OLLAMA availability.
- **Product consequence:** some screens depend on very large aggregated responses instead of smaller task-specific contracts.

## Recommendations
- Split the frontend API client into domain-specific clients or modules while retaining shared transport helpers.
- Finish migrating runtime writes onto the narrower delta/entity-level contracts and retire the coarse `/sync` paths only after parity is proven.
- Put explicit capability flags and failure telemetry around curriculum linkage so the UI can explain when OLLAMA-backed assistance is unavailable or degraded.
- Split “academic” and “admin” endpoint ownership more honestly. `/api/academic/faculty-profile/:facultyId` and multiple admin-style surfaces currently hide in unexpected modules.

## Confirmed facts vs inference
### Confirmed facts
- The API methods and route families listed above are present.
- The frontend build proxy is conditional in `vite.config.ts`.
- OLLAMA integration is optional and environment-controlled.

### Reasonable inference
- The current client surface is manageable mainly because a small number of engineers likely understand most of the system. It will become harder to maintain as ownership broadens.

## Cross-links
- [02 System Architecture Overview](./02-system-architecture-overview.md)
- [04 Backend Audit](./04-backend-audit.md)
- [05 Database And Data Flow Audit](./05-database-and-data-flow-audit.md)
- [18 Proof Sandbox And Curriculum Linkage Audit](./18-proof-sandbox-and-curriculum-linkage-audit.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
