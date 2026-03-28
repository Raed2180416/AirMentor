# AirMentor System Architecture Overview

## What this area does
This document maps the end-to-end system: frontend runtime, backend modules, database model, API surface, proof/AI pipeline, worker processes, config, deployment, and testing.

## Confirmed observations
- Frontend runtime entry points:
  - `src/main.tsx`
  - `src/App.tsx`
  - `src/system-admin-app.tsx`
  - `src/system-admin-live-app.tsx`
  - `src/portal-entry.tsx`
- Frontend shared infrastructure:
  - `src/repositories.ts`
  - `src/api/client.ts`
  - `src/api/types.ts`
  - `src/selectors.ts`
  - `src/calendar-utils.ts`
  - `src/system-admin-live-data.ts`
  - `src/proof-playback.ts`
  - `src/startup-diagnostics.ts`
  - `src/telemetry.ts`
- Frontend shell/workspace decomposition now exists around the original hotspot files:
  - `src/academic-session-shell.tsx`
  - `src/academic-workspace-topbar.tsx`
  - `src/academic-workspace-sidebar.tsx`
  - `src/academic-workspace-content-shell.tsx`
  - `src/academic-workspace-route-surface.tsx`
  - `src/academic-route-pages.tsx`
  - `src/system-admin-session-shell.tsx`
  - `src/system-admin-proof-dashboard-workspace.tsx`
  - `src/system-admin-request-workspace.tsx`
  - `src/system-admin-history-workspace.tsx`
  - `src/system-admin-hierarchy-workspace-shell.tsx`
  - `src/system-admin-faculties-workspace.tsx`
- Backend assembly:
  - `air-mentor-api/src/app.ts`
  - route modules in `air-mentor-api/src/modules/*.ts`
  - libraries in `air-mentor-api/src/lib/*.ts`
  - schema in `air-mentor-api/src/db/schema.ts`
  - startup diagnostics in `air-mentor-api/src/startup-diagnostics.ts`
  - structured telemetry in `air-mentor-api/src/lib/telemetry.ts`
- Runtime service endpoints in `air-mentor-api/src/app.ts` include `/`, `/health`, and `/openapi.json`.
- Deployment and build:
  - frontend build in `vite.config.ts`
  - GitHub Pages deploy in `.github/workflows/deploy-pages.yml`
  - Railway API deploy in `.github/workflows/deploy-railway-api.yml`
  - non-deploy verification in `.github/workflows/ci-verification.yml`
  - scheduled proof/browser cadence in `.github/workflows/proof-browser-cadence.yml`
  - Railway runtime in `air-mentor-api/railway.json`
  - local live-stack bootstrapping in `scripts/dev-live.sh`, `scripts/live-admin-common.sh`, and `air-mentor-api/scripts/start-seeded-server.ts`

## Key workflows and contracts
### Frontend architecture
| Layer | Files | Responsibility |
| --- | --- | --- |
| Portal routing | `src/portal-routing.ts`, `src/portal-entry.tsx` | Hash-based workspace selection and storage-backed route hints |
| Academic orchestration | `src/App.tsx`, `src/academic-session-shell.tsx`, `src/academic-workspace-route-surface.tsx`, `src/academic-workspace-sidebar.tsx`, `src/academic-workspace-topbar.tsx` | Login, role switching, teaching shell wiring, proof-bound navigation, route-local composition, repository synchronization |
| System admin orchestration | `src/system-admin-live-app.tsx`, `src/system-admin-session-shell.tsx`, `src/system-admin-proof-dashboard-workspace.tsx`, `src/system-admin-request-workspace.tsx`, `src/system-admin-history-workspace.tsx`, `src/system-admin-faculties-workspace.tsx` | Admin route parsing, dataset hydration, search, requests, proof dashboard, audit and calendar surfaces through route/workspace seams |
| Repository abstraction | `src/repositories.ts` | Local mode and HTTP mode persistence for preferences, runtime slices, tasks, calendar, meetings, proof-adjacent state |
| Typed transport | `src/api/client.ts`, `src/api/types.ts` | End-to-end request/response contracts, CSRF token propagation, proof-dashboard diagnostics |
| Diagnostics and telemetry | `src/startup-diagnostics.ts`, `src/telemetry.ts` | Startup environment checks and structured frontend operational events |

### Backend architecture
| Module | Files | Responsibility |
| --- | --- | --- |
| Core app | `air-mentor-api/src/app.ts` | Fastify assembly, CORS, cookie support, Swagger, module registration, proof worker lifecycle |
| Session/auth | `air-mentor-api/src/modules/session.ts`, `support.ts` | Session cookie auth, role switching, UI preferences, shared authorization helpers |
| Admin domain | `institution.ts`, `people.ts`, `students.ts`, `courses.ts`, `admin-structure.ts`, `admin-control-plane.ts`, `admin-requests.ts` | CRUD and operational administration |
| Academic domain | `academic.ts`, `academic-bootstrap-routes.ts`, `academic-runtime-routes.ts`, `academic-proof-routes.ts`, `academic-admin-offerings-routes.ts`, `academic-access.ts` | Composition root plus split academic bootstrap/profile, runtime writes, proof reads, admin-style offering/provisioning surfaces, and shared access evaluation |
| Proof admin | `admin-proof-sandbox.ts` | Proof import, validation, review, run creation, checkpoint detail, recomputation, snapshot restore |
| Diagnostics and telemetry | `startup-diagnostics.ts`, `lib/telemetry.ts` | Startup validation, production-like cookie/origin checks, and structured backend events |

### Data model architecture
`air-mentor-api/src/db/schema.ts` groups into six broad families:
1. Institutional hierarchy and identity.
2. Curriculum and policy configuration.
3. Simulation, checkpoint, and projection state.
4. Risk-model, evidence, and student shell artifacts.
5. Live teaching runtime artifacts.
6. Admin workflow and audit artifacts.

### AI / proof architecture
| Layer | Files | Responsibility |
| --- | --- | --- |
| Deterministic rules | `air-mentor-api/src/lib/msruas-rules.ts`, `msruas-proof-sandbox.ts`, `msruas-proof-control-plane.ts`, `monitoring-engine.ts` | Rule-based academic and monitoring behavior |
| Observable heuristics | `air-mentor-api/src/lib/inference-engine.ts` | Feature-derived drivers and observable risk |
| Trained risk artifacts | `air-mentor-api/src/lib/proof-risk-model.ts` | Feature vectorization, training, calibration, evaluation, support gating |
| Curriculum graph features | `air-mentor-api/src/lib/graph-summary.ts`, `curriculum-linkage.ts`, `curriculum-linkage-python.ts` | Prerequisite and linkage-aware summaries |
| Queueing and execution | `air-mentor-api/src/lib/proof-run-queue.ts`, `proof-queue-governance.ts` | Async run execution, queue ranking, caps, governance |
| UI payload shaping and proof services | `air-mentor-api/src/lib/msruas-proof-control-plane.ts`, `proof-control-plane-access.ts`, `proof-control-plane-batch-service.ts`, `proof-control-plane-checkpoint-service.ts`, `proof-control-plane-dashboard-service.ts`, `proof-control-plane-hod-service.ts`, `proof-control-plane-live-run-service.ts`, `proof-control-plane-policy-service.ts`, `proof-control-plane-runtime-service.ts`, `proof-control-plane-tail-service.ts` | HoD analytics, faculty proof view, student shell cards, risk explorer payloads, evidence timelines, policy diagnostics, queue/checkpoint diagnostics, and proof runtime seams |

### Runtime and local-live assumptions
- CORS and origin enforcement are asymmetric by design:
  - requests with no `Origin` are permitted by CORS
  - no-origin mutating requests are separately blocked by the `onRequest` hook
- Proof worker lifecycle is unconditional in app startup.
- Session/login/restore now also carry a double-submit CSRF contract:
  - session routes return `csrfToken`
  - mutating client requests send `X-AirMentor-CSRF`
  - startup diagnostics fail production-like boot when cookie/origin configuration is unsafe
- Local live mode is effectively same-origin proxy mode:
  - `AIRMENTOR_UI_PROXY_API_TARGET="$api_base_url"`
  - `VITE_AIRMENTOR_API_BASE_URL="/"`
- Seeded live verification depends on embedded Postgres, a readiness file or JSON log event, and dynamic API-port allocation in `air-mentor-api/scripts/start-seeded-server.ts`.

## Current-state reconciliation (2026-03-28)
- The architecture has materially changed since the first pass:
  - frontend shell seams now exist around both root apps
  - backend academic route ownership is split across dedicated modules
  - proof orchestration is still centered in one facade, but several proof services are now extracted
  - CI is no longer deploy-only
  - frontend and backend startup diagnostics plus structured telemetry now exist
- The hotspot picture is improved but not eliminated. Current LOC concentrations are:
  - `src/App.tsx`: `4,257`
  - `src/system-admin-live-app.tsx`: `7,205`
  - `air-mentor-api/src/modules/academic.ts`: `3,862`
  - `air-mentor-api/src/lib/msruas-proof-control-plane.ts`: `5,237`
- The architectural risk is now less “no seams exist” and more “the remaining seams still terminate in a few large orchestration files.”

- Additional current-state reconciliation:
  - faculty timetable templates are authoritative in `faculty_calendar_workspaces`
  - faculty admin calendar publish/marker state is now authoritative in `faculty_calendar_admin_workspaces`, with `academic_runtime_state.adminCalendarByFacultyId` kept as a compatibility shadow for teaching bootstrap consumers
  - the proof facade now also delegates playback reset, section-risk precompute, seeded scaffolding, seeded-run bootstrap, playback rebuild-context prep, stage-summary aggregation, and seeded-run finalization into dedicated proof-control-plane services

## Findings
### Architectural strengths
- The system has clean typed seams between frontend and backend contracts through `src/api/types.ts` and `src/api/client.ts`.
- The backend uses module registration instead of one monolithic route file.
- The schema captures institutional, workflow, and proof state explicitly rather than burying those concepts in ad hoc blobs only.

### Architectural weaknesses
- Module boundaries exist and are materially better than before, but responsibility concentration still defeats part of the benefit. The remaining biggest macro-service is `air-mentor-api/src/lib/msruas-proof-control-plane.ts`, with `src/system-admin-live-app.tsx`, `src/App.tsx`, and `air-mentor-api/src/modules/academic.ts` still larger than they should be.
- Runtime state authority is ambiguous. Some state is authoritative in Postgres, some in local storage, some in session storage, and some in React component state.
- The proof system is architecturally ambitious and now better instrumented, but it is still not fully decomposed or externally observable.

## Implications
- The architecture is capable enough to support current product breadth, but it does so through concentration and convention more than through maintainable decomposition.
- Changes that cross route modules, repository mode, and proof playback are likely to create regressions that are hard to localize quickly.

## Recommendations
- Refactor by responsibility slice, not by “move helpers to another file.” The best cuts are:
  - academic session/bootstrap composition
  - teaching runtime sync
  - proof playback state
  - request workflow
  - HoD analytics
  - student shell and risk explorer payload composition
- Introduce a clearer authoritative-state model between client storage and backend runtime records.
- Add system-level instrumentation for proof run creation, checkpoint availability, shell usage, and error rates.

## Confirmed facts vs inference
### Confirmed facts
- All layers and files named above exist and participate in the live runtime.
- The proof worker is started from `air-mentor-api/src/app.ts` and stopped on app close.
- The frontend and backend are deployed separately through GitHub Pages and Railway configuration.

### Reasonable inference
- The architecture likely scaled feature-by-feature around successful seeded demos and parity tests, which preserved momentum but accumulated responsibility in a few hotspot files.

## Cross-links
- [03 Frontend Audit](./03-frontend-audit.md)
- [04 Backend Audit](./04-backend-audit.md)
- [05 Database And Data Flow Audit](./05-database-and-data-flow-audit.md)
- [06 API And Integration Audit](./06-api-and-integration-audit.md)
- [10 Performance Scalability And Reliability Audit](./10-performance-scalability-and-reliability-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
