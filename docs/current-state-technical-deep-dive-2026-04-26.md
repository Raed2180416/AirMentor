# AirMentor Current-State Technical Deep Dive

Status: repo-grounded current-state audit  
Audit date: 2026-04-26  
Repo: `/home/raed/projects/air-mentor-ui`  
Commit audited: `2aef0beb97f1e9c04e88afaf3f5fa5e99f9a14ec`  
Branch audited: `gitignore-hygiene-ctxo-cache`

## Audit basis

This document is grounded in direct inspection of:

- frontend source in `src/`
- backend source in `air-mentor-api/src/`
- frontend tests in `tests/`
- backend tests in `air-mentor-api/tests/`
- browser suites in `tests-e2e/`
- closeout docs in `docs/closeout/`
- audit automation and reports in `audit-map/`
- proof artifacts in `air-mentor-api/output/` and `output/playwright/`

Parallel subsystem scans were also run for:

- frontend/runtime
- backend/API/persistence
- proof/ML/worldbuilding
- ops/deploy/verification

This is intentionally not a restatement of older docs. Where code and docs disagree, code wins.

## Working-tree state at audit time

Core product code was not clean-room frozen. At time of audit:

- tracked local settings file modified: `.claude/settings.local.json`
- tracked Vitest result cache files modified under both root `node_modules/.vite/vitest/.../results.json` and `air-mentor-api/node_modules/.vite/vitest/.../results.json`
- untracked `.ctxo/` index/cache artifacts present

No core product source diff was active at close of audit, but this still means "current state" includes local machine artifacts around the repo.

## Bottom line

AirMentor today is not one simple web app. It is five things coupled together:

1. A teaching workspace for Course Leaders, Mentors, and HoDs.
2. A system-admin control plane for institution setup, governance, faculty/student records, requests, and proof operations.
3. A deterministic proof sandbox centered on a fixed pilot cohort.
4. A synthetic risk-scoring stack that powers triage, explanation, and counterfactual-style views.
5. A heavy closeout/evidence machine built to prove behavior across local and live stacks.

In current code, the project intent is:

- run a backend-backed academic operations portal
- keep role-scoped teaching workflows live and stateful
- give system admins a governance/control surface
- simulate a proof cohort semester by semester
- turn simulated evidence into queue/risk/action views
- preserve operational traceability through audit, telemetry, manifests, ledgers, and repeatable browser proofs

What it is not, in current truth:

- not a React Router app
- not a pure CRUD SIS/ERP clone
- not a fully cleanly separated frontend/backend architecture
- not a pure live-institution production system independent of proof state
- not an externally validated real-world predictor of student outcomes

## Canonical current scope and product boundaries

Current closeout-era boundaries are explicit in both code and closeout docs:

- pilot cohort: `Proof MNC 2023`
- pilot size: `120` students
- sections: `A`, `B`
- proof semester coverage: `1..6`
- semesters `7..8`: out of scope
- current live operational story: semester `6` is fully materialized live operational semester, semesters `1..5` are mostly historical proof state
- live verification stack: GitHub Pages frontend + Railway backend
- demo-day alternate stack: GitHub Pages frontend hitting local seeded backend via ngrok HTTPS tunnel

## Repository snapshot

### High-level size

| Area | Current count |
| --- | ---: |
| Frontend source files (`src/`) | 66 |
| Backend source files (`air-mentor-api/src/`) | 121 |
| Frontend test files (`tests/`) | 54 |
| Backend test files (`air-mentor-api/tests/`) | 68 |
| Browser test files (`tests-e2e/`) | 20 |
| DB migrations | 25 |
| DB tables in schema | 96 |
| Registered `/api/*` routes | 167 |
| Root npm scripts | 38 |
| Backend npm scripts | 12 |

### Largest code centers

| File | LOC | Why it matters |
| --- | ---: | --- |
| `src/system-admin-live-app.tsx` | 8178 | Main system-admin UI orchestrator |
| `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | 4841 | Proof-control facade/orchestrator |
| `air-mentor-api/src/modules/academic.ts` | 4331 | Academic read-model builder and contracts hub |
| `src/App.tsx` | 4192 | Academic portal orchestration and portal router |
| `air-mentor-api/src/lib/proof-risk-model.ts` | 2355 | Trained risk model implementation |
| `air-mentor-api/src/db/schema.ts` | 1440 | Full persistence contract |

### Package stack

Frontend package:

- React `19.2.0`
- Vite `7.3.1`
- TypeScript `5.9.3`
- Vitest `4.1.0`
- Playwright `1.59.1`
- Framer Motion `12.35.2`

Backend package:

- Fastify `5.6.2`
- Drizzle ORM `0.44.6`
- `pg` `8.16.3`
- `embedded-postgres` `18.3.0-beta.16`
- `argon2` `0.44.0`
- `zod` `4.1.12`
- `nodemailer` `8.0.5`

## Project intent, in product terms

### 1. Academic operations portal

This is the user-facing teaching system for:

- Course Leaders
- Mentors
- HoDs

It is meant to support:

- course oversight
- attendance and assessment entry
- scheme/blueprint/question-paper setup
- queue and intervention workflows
- calendar/timetable operations
- HoD governance and unlock review
- student history, student shell, and risk exploration

### 2. System-admin control plane

This is the back-office surface for:

- institutional hierarchy
- curriculum governance
- course/faculty/student records
- requests lifecycle
- proof-run lifecycle
- proof diagnostics and model artifacts
- restore/archive/history
- scoped registry launches

### 3. Proof-control plane

This is the synthetic proof engine and operational simulation layer. It exists to:

- generate a governed proof cohort
- materialize checkpoints across semesters/stages
- publish proof-aware academic bootstrap state
- feed HoD/student/risk surfaces
- support playback, activation, stage advance, reset, and risk recompute

### 4. Risk/explanation system

This is a hybrid of:

- deterministic heuristic scoring
- trained five-head probability models
- evidence projection
- confidence gating
- policy phenotype and no-action comparisons

Its purpose is internal prioritization, triage, explanation, and simulation support.

### 5. Closeout/evidence system

This project has a large second control plane dedicated to proving the system works:

- closeout prompt packs
- execution ledgers
- proof evidence manifests/indexes
- defect register
- audit-map prompts/policies/reports
- browser smoke suites
- live stack verification workflows

This is not side documentation. It is part of how the repo is operated.

## End-to-end runtime architecture

### Top-level flow

Browser boot:

`src/main.tsx`
-> wraps `App` in `StrictMode`
-> wraps `App` in top-level `ErrorBoundary`
-> mounts to `#root`

Top-level portal router:

`App`
-> home portal
-> academic portal
-> system-admin portal

The app is not React Router based. It is a hand-written hash portal router using:

- `#/` for home
- `#/app` for academic
- `#/admin` for system admin

### Core runtime split

There are two real runtime roots:

- academic runtime root: `OperationalApp` in `src/App.tsx`
- admin runtime root: `SystemAdminApp` in `src/system-admin-app.tsx`

Both depend on:

- `useApiConnectionTarget`
- backend health probing
- frontend startup diagnostics
- backend session APIs

## Frontend architecture deep dive

### Portal entry

`src/portal-entry.tsx` defines the public entry intent very clearly:

- one live site
- two runtime workspaces
- academic workspace remains teaching-focused
- system-admin workspace is explicitly backend-backed

The portal cards make current intent visible:

- Academic portal: teaching workspace for Course Leaders, Mentors, HoDs, backend-scoped course/student/calendar state
- System Admin portal: control plane for institution setup, records, governance, requests, and backend-backed admin operations

### Academic runtime architecture

Academic runtime is effectively two layers:

1. `OperationalApp`
2. `OperationalWorkspace`

`OperationalApp` owns:

- API target resolution
- backend session restore/login/logout/switch-role
- bootstrap request
- proof playback restore/validation
- startup bootstrap gating
- mapping backend session role grants to UI roles

`OperationalWorkspace` owns:

- page state
- route history state
- role-home logic
- queue state
- student drawer state
- course and entry workspace state
- calendar state
- proof strip/launcher integration
- page-to-page actions

This means the academic app is a state machine, not a URL-addressable SPA.

### Academic navigation model

Academic pages are internal state values, not router paths. Core page set includes:

- `dashboard`
- `students`
- `course`
- `calendar`
- `upload`
- `entry-workspace`
- `mentees`
- `department`
- `mentee-detail`
- `student-history`
- `student-shell`
- `risk-explorer`
- `unlock-review`
- `scheme-setup`
- `queue-history`
- `faculty-profile`

Page rendering fans out through `src/academic-workspace-route-surface.tsx`, which lazy-loads surfaces based on `role + page`.

### Role model

Academic roles are:

- Course Leader
- Mentor
- HoD

Role home and ACL logic lives in `src/academic-workspace-route-helpers.ts`:

- Course Leader home: `dashboard`
- Mentor home: `mentees`
- HoD home: `department`

Illegal page selections are auto-corrected back into role-legal surfaces.

### Academic session boundary

`src/academic-session-shell.tsx` provides hard gates:

- if backend not available: backend-required screen
- if not authenticated: login/password-setup flow
- if session restores: workspace opens

The academic portal is therefore backend-first at runtime, even though legacy local substrate still exists in code.

### System-admin runtime architecture

`src/system-admin-app.tsx` is a thin gate layer. It does:

- API target resolution
- first health-check wait screen
- backend-required block screen if no usable API target
- startup diagnostics emission
- backend offline/fallback indicators
- launch of `SystemAdminLiveApp`

Almost all real system-admin UI behavior lives in `src/system-admin-live-app.tsx`, an 8178-line orchestrator.

### System-admin routing model

System-admin routing is hash-parsed, not React Router based. `parseAdminRoute` handles:

- `#/admin/overview`
- `#/admin/proof-dashboard`
- `#/admin/students/:id`
- `#/admin/faculty-members/:id`
- `#/admin/requests/:id`
- `#/admin/history`
- `#/admin/faculties/...`

The admin route serializer lives beside it. This means admin state is addressable by hash, but still internally stateful and tightly coupled to sessionStorage.

### API connection logic

`src/api-connection.ts` is a major runtime contract:

- primary API base URL comes from `VITE_AIRMENTOR_API_BASE_URL`
- optional fallbacks come from `VITE_AIRMENTOR_API_FALLBACK_BASE_URLS`
- candidates are normalized to absolute URLs
- all candidates probe `/health` concurrently
- first healthy endpoint wins
- connection is repolled every 15 seconds
- `usingFallback` is tracked and surfaced in UI

This is more than config parsing. It is active runtime failover logic.

### Frontend startup diagnostics

`src/startup-diagnostics.ts` checks for environment drift such as:

- missing API base URL on production-like origins
- invalid relative API config
- localhost API use from HTTPS/public origin
- HTTP API under production-like frontend origin
- telemetry sink URL misconfiguration

This means frontend operational posture is part of runtime logic, not only deployment docs.

### Client telemetry

`src/telemetry.ts` emits client operational events:

- startup diagnostics
- startup ready
- error/warn/info event types
- optional explicit telemetry sink
- optional backend relay through `/api/client-telemetry`

### Frontend persistence model

Frontend persistence uses three layers:

1. in-memory React state
2. browser storage
3. backend persistence

Important persisted browser keys in `src/repositories.ts` include:

- theme
- current faculty IDs
- student patches
- schemes
- TT blueprints
- drafts
- cell values
- locks
- lock audit
- tasks
- resolved tasks
- timetable templates
- task placements
- calendar audit
- meetings

Additional frontend persistence facts:

- academic route history is in-memory and capped at 40 entries
- student drawer is overlay state, not a route
- proof playback selection is stored in localStorage in `src/proof-playback.ts`
- proof dashboard tab state is stored in sessionStorage
- faculties workspace section/tab state is also stored in sessionStorage

### Time anchoring

Proof-aware surfaces do not anchor to wall-clock time when proof playback is active. They anchor to backend-supplied playback time:

- pending-action labels
- due labels
- calendar anchor state

This is a key proof contract.

### Local/mock substrate still present

Current frontend is not purely backend-driven in implementation. `src/repositories.ts` still supports:

- `repositoryMode: 'local'`
- `repositoryMode: 'http'`

And `src/data.ts` is still a huge live mock corpus that exports:

- offerings
- mentees
- faculty
- student history helpers
- theme tokens
- domain scaffolding

`hydrateAcademicData(snapshot)` mutates this seeded substrate with bootstrap data. `src/data.old.ts` also still exists in-repo.

This means architecture is still transitional:

- product copy says backend-backed
- code still carries local and mock substrate

## Frontend feature inventory with intent

This section reinterprets the feature registry against current code. Registry inventory remains useful for coverage, but not all issue claims in that file remain current.

Current registry count is:

- 11 portal/session items
- 48 academic-workspace items
- 40 system-admin items
- 11 hidden-coupling behaviors
- 18 cross-cutting delta items
- 7 structural issues
- 135 tracked items total

### Portal, auth, session, and startup

Implemented features and intent:

- Portal chooser home: let users pick Academic or System Admin.
- Hash route normalization: keep portal routing stable on odd/manual hashes.
- Cross-portal workspace hint clearing: prevent stale context leakage between portals.
- Academic session restore gate: restore session before rendering academic workspace.
- Academic login form: authenticate faculty and hydrate role-scoped workspace.
- Academic role switching: change active role without new login.
- Illegal page auto-correction: stop users from remaining on role-illegal pages.
- Academic bootstrap with proof playback restore: hydrate from active proof run or saved checkpoint.
- System-admin backend-required gate: refuse admin UI when no usable backend target exists.
- System-admin session restore plus role gate: ensure active role is `SYSTEM_ADMIN`.
- Cookie-settle retry after login/role switch: reduce auth mutation vs session-read race conditions.
- Frontend startup diagnostics collection/classification: surface deployment/runtime drift early.
- Startup telemetry ready events on both portals: operational observability at client boot.
- Client telemetry sink resolution hierarchy: explicit sink, env sink, or backend relay.

### Course Leader dashboard and course workspace

- Course Leader dashboard summary cards: quick high-level course/risk/load view.
- Year section collapse/expand: reduce dashboard noise.
- Course card drilldown: move from grouped dashboard into course workspace.
- Course tab switching: separate overview/risk/attendance/assessment families.
- Stage-lock behavior in tabs: prevent premature entry into stage-bound workflows.
- Course overview metrics/checklist: show health and readiness.
- Course risk tab filtering/drilldown: triage students fast.
- Attendance entry handoff: capture attendance evidence used downstream.
- TT blueprint editing: define assessment structure before marks entry.
- TT freeze behavior: protect blueprint after protected states emerge.
- TT marks total validation: enforce raw marks policy.
- Quiz entry handoff: jump from shell into quiz entry.
- Assignment entry handoff: jump from shell into assignment entry.
- CO attainment view: show course-outcome evidence.
- Gradebook readiness banner/gating: force scheme readiness before final paths.
- SEE entry CTA from gradebook context: continue to final exam entry once ready.

### Workflow pages

- All-students roster page: section/course roster access.
- Student history page: longitudinal transcript/history view.
- Scheme setup page: backend-backed assessment scheme configuration.
- Upload page: file-entry/import-oriented workflow hub.
- Entry workspace grid: direct evidence-entry workspace for attendance/TT/etc.

### Calendar and timetable

- Academic calendar mode switch: calendar vs timetable mental model.
- Calendar navigation controls: inspect adjacent windows.
- Planner block edit surfaces: mutate scheduled units.
- Drag/resize planner behavior: fast schedule adjustment.
- Hover add-target behavior: speed new item insertion.
- Planner save/reset: commit or discard scheduling changes.
- Task placement surfaces: place intervention/task work on calendar.
- Meeting scheduling/editing: create and update academic meetings.
- Extra classes and marker detail surfaces: schedule and inspect special items.

### Mentor workbench

- Mentor workbench search: find mentees quickly.
- Mentor risk filter cards: slice queue by high/medium/low/all.
- Mentor queue row actions: jump into deeper student surfaces.
- Mentor contact actions: immediate outreach behavior from queue context.
- Mentee detail page timeline/history shell: preserve context while drilling.
- Mentee drilldowns: pivot into student shell, risk explorer, and history.

### Queue history

- Queue history filtering: inspect active/resolved/dismissed series.
- Queue history restore/resume: reactivate hidden or completed items.
- Queue history role-sensitive row actions: show context-valid next actions only.

### Unlock review and correction cycle

- Unlock review decision flow: bounded HoD unlock governance with audit trail.
- Unlock review completed-state lock: prevent duplicate terminal decisions.
- Correction-cycle metadata surfacing: show next actions, status, and cycle description from backend engine.

### HoD analytics

- HoD analytics tab family: split overview/courses/faculty/reassessments/counterfactual.
- Action-needed-only toggle: focus on unresolved governance work.
- Row-level drilldowns: move from aggregate to specific evidence.
- Queue history jump: bridge current oversight to historical queue state.

### Faculty profile

- Faculty profile read-only stacks: show permissions, appointments, scope, proof overlays.
- Faculty profile drilldowns: move from faculty context into student evidence context.

### Student shell

- Student shell tabs: overview, topic/CO, assessment, interventions, timeline, chat.
- Student shell session start/prompt send: constrained Q&A over proof-backed record.
- Timeline on-demand load: avoid eager heavy timeline load.
- Guardrail behavior: chat is explainer surface, not system-of-record mutator.

### Risk explorer

- Risk explorer tab family: overview, assessment details, advanced diagnostics.
- Feature completeness gating: communicate confidence based on evidence availability.
- No-action and scenario comparison: compare current state vs alternatives.
- Evidence grid drilldown: expose drivers/components and feature-level rationale.

### Proof launcher and proof shell reuse

- Proof launcher popup from academic surfaces: expose active run/checkpoint context.
- Shared proof shell pieces: hero/launcher/tab-shell contracts reused across proof-aware surfaces.
- Academic proof summary strip: lightweight proof context strip on academic surfaces.

### System-admin navigation and search

- Top-tab navigation: move across overview/proof/faculties/students/faculty-members/requests/history.
- Admin search dropdown: jump directly to entities or scoped workspaces.
- Breadcrumb navigation: preserve orientation in deep hierarchy/drilldown.
- Overview launch cards: accelerate entry into critical workstreams.
- Route hash parser/serializer: admin route model backed by hashes.
- Route-keyed session restore: reopen previous admin sub-context.

### System-admin action queue

- Action queue request cards: surface time-sensitive request work.
- Action queue reminder cards: keep operator to-dos inside control plane.
- Action queue hidden-record cards: expose restore-worthy archive/delete events.
- Queue bulk hide/restore controls: remove noise and recover hidden items.
- Quick add reminder: create reminder without leaving current surface.
- Dismissed queue persistence plus logout clearing semantics: preserve intentional dismissal behavior.

### System-admin requests workspace

- Request workspace list/detail pane: pair lifecycle actions with notes/context.
- Request lifecycle actions: Take Review, Needs Info, Reject, Approve, Mark Implemented, Close.
- Request note history plus note add: preserve operational narrative.
- Request version conflict protection: optimistic concurrency against stale writes.

### System-admin proof dashboard

- Proof dashboard tabs: summary, checkpoint, diagnostics, operations.
- Checkpoint selector/detail pane: inspect stage-specific proof state.
- Playback controls: previous, next, play to end, reset.
- Proof import lifecycle: create, validate, review crosswalks, approve import.
- Proof run lifecycle actions: run, rerun, retry, recompute risk, archive.
- Activation actions: activate run, activate semester.
- Snapshot restore actions: recover prior proof state.
- Checkpoint evidence view toggles: switch evidence perspective.
- Restore notice handling: tell operator restored context is active.
- Model inspection surfaces: expose current/evaluated/correlation artifact views.
- Evidence timeline inspection: show lifecycle and operational proof trail.

### System-admin history and archive

- History workspace archive list: inspect archived entities.
- Recycle-bin restore flow: recover soft-deleted records.
- Recent audit route opens: jump from event log to affected context.

### System-admin hierarchy and scope

- Hierarchy navigator chain: faculty > department > branch > batch > section.
- Hierarchy edit modals: mutate scoped entity data in place.
- Entity creation forms: faculty, department, branch, batch.
- Curriculum linkage candidate review: approve/reject proposed linkages.
- Curriculum feature binding controls: bind feature profiles to scope.
- Canonical proof-batch jump: fast path into proof-authoritative branch/batch.
- Scoped registry launchers: open filtered student/faculty registries.
- Section scope selector behavior: narrow downstream stats/filters by section.
- Governance, stage-policy, and curriculum editor surfaces: live inside extracted sysadmin workspaces.
- Provisioning helpers: create/assign academic structures and ownership.

### System-admin faculty calendar oversight

- Faculty calendar summary panel: quick read before heavy planner mode.
- Open full planner modal: dedicated planning workflow.
- Recurring block edits: manage repeating teaching schedule.
- Marker edits: manage one-off schedule events.
- Planner save/reset: commit or discard.
- Class-editing lock/direct-edit window behavior: protect governance windows.
- Alternate timetable editor: code exists, currently not clearly routed as primary user surface.

### Hidden behaviors and deep couplings

- Academic route history is in-app state, not browser history.
- Admin faculties route restores tab/section from sessionStorage by hash.
- Proof playback selection persists across sessions in localStorage.
- Proof dashboard tab persists in sessionStorage.
- Search scope is route and hierarchy aware.
- Registry-scope breadcrumb return is transient and in-memory.
- Queue dismissals persist locally beyond route changes.
- Role-page legality auto-corrects and can look like route bounce.
- Stage locks/frozen states are explicit UI contracts.
- Empty/loading/blocked screens are first-class user-visible surfaces.
- Proof run vs explicit checkpoint slice semantics differ.

### Cross-cutting backend/frontend behaviors exposed to users

- Authoritative runtime endpoints for tasks/placements/calendar/runtime slices.
- Deprecated compatibility sync endpoints with deprecation and sunset semantics.
- Successor-version `Link` header semantics for migration paths.
- Proof provenance explanation contract reused across surfaces.
- Background proof-run worker lifecycle is operator-visible through dashboard state.
- Student evidence timeline endpoint exists and is part of deeper proof tooling.
- Server-backed UI preferences with optimistic update and versioning.

## Frontend technical risks and tensions

- `src/App.tsx` and `src/system-admin-live-app.tsx` are both very large orchestrators.
- `academic-workspace-route-surface.tsx` takes a large `workspace: any` contract, a type-safety hole.
- Academic navigation is mostly not deep-linkable by URL.
- Some HTTP repository methods only mutate client cache and do not persist to backend.
- Theme application still happens via render-time side effect in academic shell.
- Product copy says backend-backed, but large mock/local substrate still exists in code.

## Backend architecture deep dive

### Boot path

`air-mentor-api/src/index.ts` does:

- load config
- create DB pool
- create Drizzle DB handle
- run startup diagnostics
- create email transport
- create telemetry persistence
- build Fastify app
- listen and emit startup-ready telemetry

### Config and environment posture

`air-mentor-api/src/config.ts` auto-derives:

- host
- cookie `SameSite`
- cookie `Secure`
- preview-link behavior
- default CSRF secret behavior
- production-like posture based on configured origins

Default local DB posture is:

- `postgres://postgres:postgres@127.0.0.1:5432/airmentor`

`air-mentor-api/src/startup-diagnostics.ts` hard-fails or warns on:

- production-like origin without proper cookie/CSRF posture
- loopback host under production-like origin set
- default local DB under production-like configuration
- missing/unsafe CSRF posture

### HTTP shell

`air-mentor-api/src/app.ts` installs:

- cookie plugin
- CORS
- Swagger
- typed error serialization
- route module registration
- proof-run worker startup

Mutating requests are:

- origin-gated
- CSRF-gated for authenticated writes

Intentional exception:

- `/api/session/login` is CSRF-exempt to avoid stale-cookie deadlock on fresh login

### Route module map

Current backend route modules and their role:

| Module | Responsibility |
| --- | --- |
| `session.ts` | login/logout/session restore/role switch/password setup/preferences |
| `institution.ts` | institution/faculty/department/branch/term master data |
| `admin-structure.ts` | hierarchy, curriculum, policy, stage-policy, provisioning |
| `people.ts` | faculty/accounts/appointments/grants |
| `students.ts` | students, enrollments, mentor assignments |
| `courses.ts` | course registry |
| `admin-requests.ts` | request workflow |
| `admin-proof-sandbox.ts` | proof dashboard, imports, lifecycle, artifacts, evidence timeline |
| `client-telemetry.ts` | client event ingestion/relay |
| `academic.ts` | academic contracts, read-model building, runtime slice integration |
| `admin-control-plane.ts` | admin search, audit feed, reminders, faculty calendar oversight, faculty profile projection |

### Academic module as contract hub

`air-mentor-api/src/modules/academic.ts` is one of the most important files in the repo. It provides:

- Zod contract definitions
- runtime-slice validators
- scheme and blueprint contracts
- task payload contracts
- placement and calendar-audit contracts
- proof scope resolution
- bootstrap read-model assembly
- viewer filtering
- dependency wiring for academic sub-routes

It is effectively:

- a read-model builder
- a contracts module
- a compatibility-layer owner
- a proof-aware scoping engine

### Data access style

There is no classical backend repository layer. Backend code generally:

- uses Drizzle tables directly
- performs orchestration in services/helpers
- performs validation/scoping in route modules or adjacent services

This reduces abstraction depth but increases coupling between route handlers and table contracts.

## Backend core flows

### 1. Session and auth flow

Main session behavior:

- `POST /api/session/login`
- `GET /api/session`
- `DELETE /api/session`
- `POST /api/session/role-context`
- `GET/PATCH /api/preferences/ui`

Key behaviors:

- hashed identifier-based rate limiting
- username or email resolution
- active user requirement
- password credential verification
- active faculty profile requirement
- active role-grant requirement
- session row creation
- CSRF token generation
- role-grant list return
- preference snapshot return

Role priority is deterministic in shared support logic:

- `SYSTEM_ADMIN`
- `COURSE_LEADER`
- `MENTOR`
- `HOD`

### 2. Password setup and reset flow

Current password setup path includes:

- request endpoint creating invite/reset token rows
- token inspect endpoint
- redeem endpoint that replaces password hash
- token consumption
- deletion of existing sessions after redeem
- preview-link emission only when local-preview behavior is allowed
- email sending behind rate limiting

### 3. Academic bootstrap flow

`GET /api/academic/bootstrap` is the core academic read API.

Its current semantics:

- only Course Leader / Mentor / HoD may call it
- hard-gates on active proof run
- if no active proof run exists, returns `NO_ACTIVE_PROOF_RUN`
- optional checkpoint param is validated for ownership/scope
- calls `buildAcademicBootstrap`
- returns offerings, faculty, students, mentees, runtime slices, tasks, placements, meetings, proof playback, and more

Academic bootstrap is therefore:

- proof-gated
- role-scoped
- checkpoint-aware
- parity-oriented

### 4. Student shell and proof access flow

Student shell routes validate:

- target run selection
- target checkpoint ownership
- viewer role scope
- faculty/session access code rules for non-admin users

Non-admin users are not free to inspect arbitrary historical or inactive proof data.

### 5. HoD proof analytics flow

Current HoD proof routes provide:

- proof summary
- proof bundle
- course-level proof analytics
- faculty-level proof analytics
- student-level proof analytics
- reassessment read/write actions

These depend on a broad denormalized proof state including:

- runs
- queue cases
- queue projections
- student projections
- offering projections
- risk assessments
- alerts
- reassessment events and resolutions
- interventions
- transcripts
- checkpoints

### 6. Proof run lifecycle flow

Main proof lifecycle starts at:

- `POST /api/admin/batches/:batchId/proof-runs`

That route:

- inserts or enqueues run work
- marks `simulation_runs.status = queued`
- relies on background worker in `proof-run-queue.ts`

The worker:

- claims rows with `FOR UPDATE SKIP LOCKED`
- uses lease tokens
- heartbeats in progress
- stamps failures
- executes proof simulation run generation

### 7. Activation, advance, archive, stop, and restore

Current proof admin routes support:

- activate run
- activate semester
- advance
- archive
- stop
- recompute risk
- restore snapshot

Activation semantics currently include:

- deactivate sibling runs
- invalidate proof sessions
- preserve or seed active semester/stage/date
- activate matching term
- publish operational projection

Advance semantics include:

- next day may cross one stage boundary
- next stage can auto-resolve post-SEE logic
- terminal runs can become `completed-inspectable`

### 8. Correction-cycle flow

Correction-cycle policy is centralized in `proof-hod-correction-cycle-engine.ts`.

It defines:

- kinds
- statuses
- actor roles
- transitions
- next actions
- whether surface reopens
- whether recompute should trigger

HTTP wiring exists in academic runtime routes, but the route itself primarily:

- loads current task payload
- computes next state through engine
- persists new unlock request + transition history
- returns engine metadata and cycle description

Important limitation:

- the route does not itself reopen UI
- the route does not itself recompute risk
- the route does not itself relock surfaces

It writes state; downstream behavior must honor that state.

### 9. Assessment entry flow

Assessment commit route behavior includes:

- offering ownership validation
- stage gate validation
- lock validation
- scheme and question-paper component membership validation
- replacement score deletion
- authoritative score insert
- TT aggregate writes
- runtime student-patch mirror updates
- optional lock updates

### 10. Attendance entry flow

Attendance entry writes:

- per-student snapshots
- offering attendance aggregate
- runtime `studentPatches` mirror

### 11. Clear-lock flow

`clear-lock` is HoD-only and clears:

- DB column locks where relevant
- runtime mirror locks

This is important because current lock truth is not fully normalized across all evidence families.

## Database and persistence model

### Persistence strategy

The backend currently uses two truth layers:

1. authoritative domain tables
2. compatibility/runtime JSON shadow in `academic_runtime_state`

Bootstrap prefers authoritative tables where possible, then merges runtime shadow where needed. This is a major architectural tension.

### Table groups

#### Institutional structure

- `institutions`
- `academic_faculties`
- `departments`
- `branches`
- `batches`
- `academic_terms`

#### Auth, session, and preferences

- `user_accounts`
- `user_password_credentials`
- `user_password_setup_tokens`
- `sessions`
- `login_rate_limit_windows`
- `ui_preferences`
- `role_grants`

#### Faculty and people

- `faculty_profiles`
- `faculty_appointments`

#### Students and mentorship

- `students`
- `student_enrollments`
- `mentor_assignments`

#### Courses and curriculum

- `courses`
- `curriculum_courses`
- `policy_overrides`
- `stage_policy_overrides`
- `curriculum_feature_profiles`
- `curriculum_feature_profile_courses`
- `batch_curriculum_feature_bindings`
- `batch_curriculum_feature_overrides`
- `curriculum_linkage_candidates`
- `curriculum_import_versions`
- `curriculum_validation_results`
- `curriculum_nodes`
- `curriculum_edges`
- `bridge_modules`
- `course_topic_partitions`
- `elective_baskets`
- `elective_options`
- `official_code_crosswalks`

#### Proof-run world generation

- `simulation_runs`
- `teacher_load_profiles`
- `teacher_allocations`
- `student_latent_states`
- `student_behavior_profiles`
- `student_topic_states`
- `student_co_states`
- `world_context_snapshots`
- `simulation_question_templates`

#### Proof playback and projections

- `simulation_stage_checkpoints`
- `simulation_stage_queue_cases`
- `simulation_stage_student_projections`
- `simulation_stage_offering_projections`
- `simulation_stage_queue_projections`
- `student_question_results`

#### Student agent shell

- `student_agent_cards`
- `student_agent_sessions`
- `student_agent_messages`

#### Risk, evidence, and proof lifecycle

- `student_observed_semester_states`
- `risk_evidence_snapshots`
- `risk_model_artifacts`
- `semester_transition_logs`
- `simulation_reset_snapshots`
- `simulation_lifecycle_audits`
- `risk_assessments`
- `reassessment_events`
- `alert_decisions`
- `alert_outcomes`
- `elective_recommendations`
- `risk_overrides`
- `alert_acknowledgements`
- `reassessment_resolutions`

#### Academic operational state

- `section_offerings`
- `offering_stage_advancement_audits`
- `faculty_offering_ownerships`
- `student_academic_profiles`
- `student_attendance_snapshots`
- `student_assessment_scores`
- `student_interventions`
- `student_intervention_response_states`
- `transcript_term_results`
- `transcript_subject_results`
- `course_outcome_overrides`
- `offering_assessment_schemes`
- `offering_question_papers`
- `academic_tasks`
- `academic_task_transitions`
- `academic_task_placements`
- `faculty_calendar_workspaces`
- `faculty_calendar_admin_workspaces`
- `academic_calendar_audit_events`
- `academic_meetings`
- `academic_assets`

#### Compatibility shadow

- `academic_runtime_state`

#### Admin workflow and observability

- `admin_requests`
- `admin_request_notes`
- `admin_request_transitions`
- `audit_events`
- `operational_telemetry_events`
- `admin_reminders`

### Important persistence asymmetries

- Tasks, placements, calendar, timetable, locks, and patches still maintain compatibility/runtime shadow state.
- Assessment locks have real DB column backing on `section_offerings`.
- Attendance lock is only mirrored through runtime `lockByOffering`, not a dedicated DB column.
- Some frontend HTTP repository methods still mutate only client cache for certain slices.

## Proof-control plane, ML, and worldbuilding deep dive

### What this subsystem actually is

Current proof subsystem is best described as:

- a deterministic academic world generator
- a governed proof-run lifecycle manager
- a checkpoint playback engine
- a synthetic evidence generator
- a scoring/explanation layer over synthetic evidence

It is not best described as:

- a validated real-world predictive model of actual student failure risk

### Canonical proof constants

Important proof identifiers are hard-coded around the MSRUAS/MNC pilot:

- department: `dept_cse`
- branch: `branch_mnc_btech`
- batch: `batch_branch_mnc_btech_2023`
- canonical simulation run seed id: `sim_mnc_2023_first6_v1`
- canonical curriculum import id: `curriculum_import_mnc_2023_first6_v1`

### Proof-control facade

`air-mentor-api/src/lib/msruas-proof-control-plane.ts` is now mostly a facade that wires specialized services for:

- batch dashboard
- activation
- semester activation
- stage advance
- runtime recompute
- playback reset
- HoD analytics
- student shell and tail services
- seeded run generation
- reset and restore
- operational projection publishing

### World generation model

Synthetic world generation includes:

- 120 students
- 2 sections of 60/60
- 6 semesters
- 30 checkpoints per full run

Scenario families are hardcoded into corpus generation:

- balanced
- weak-foundation
- low-attendance
- high-forgetting
- coursework-inflation
- exam-fragility
- carryover-heavy
- intervention-resistant

Student archetypes are also explicit:

- deep-competent
- strategic-efficient
- strategic-fragile
- cumulative-gap
- underregulated
- surface-survival

The worldbuilder tracks latent and behavioral traits such as:

- readiness
- forgetting rate
- relearn rate
- attendance propensity
- coursework reliability
- careless error rate
- intervention receptivity

### Proof realism math

`proof-world-realism-engine.ts` contains the reusable realism/math layer:

- stable Gaussian helpers
- truncated normal helpers
- beta/incomplete beta/quantile math
- anchored beta mark sampling
- forget-decay math
- mark delta computation

Important caveat:

Current product paths use this selectively. Realization logic often reduces to:

- baseline replay
- additive intervention deltas

not a full fresh stochastic re-simulation.

### Historical semester generation caveat

Historical backlogs are currently monotonic in seeded-semester logic:

- failed counts accumulate into active backlog
- there is no true backlog clearance/repeat-attempt world model

That is one of the reasons realism audit currently hard-fails.

### Risk model versions

Hard-coded versions in `proof-risk-model.ts`:

- feature schema: `observable-risk-features-v5`
- production model: `observable-risk-logit-v8`
- challenger model label: `observable-risk-catboost-challenger-v8`
- correlation artifacts: `observable-risk-correlations-v4`
- calibration: `post-hoc-calibration-v2`
- corpus manifest: `proof-corpus-v1`

### Risk heads

Five modeled heads exist:

- `attendanceRisk`
- `ceRisk`
- `seeRisk`
- `overallCourseRisk`
- `downstreamCarryoverRisk`

Operationally, `overallCourseRisk` is the main product-facing decision head.

### Feature families in model

Current features span:

- attendance/history
- CGPA/backlog
- TT1/TT2/SEE/quiz/assignment evidence
- weak CO / question mismatch / momentum / intervention residual
- prerequisite graph and carryover signals
- stage one-hot state
- interaction terms
- explicit missingness flags

### Model training and challenger truth

Current in-TS serving truth is:

- compact logistic heads
- calibration chooser across identity/sigmoid/beta/isotonic/venn-abers
- shallow tree-based challenger fitted inside TS runtime bundle builder

Important honesty point:

- the label says "CatBoost challenger"
- Python CatBoost training scripts exist
- but current serving/runtime truth is not a live Python CatBoost service

### Probability display gating

Not every head is always displayed as a surfaced probability.

Display depends on support and calibration quality gates, including:

- support count
- positives count
- ECE quality
- head-specific gating rules

CE head is explicitly not surfaced as a displayed probability.

### Heuristic fallback still matters

There are still two scoring paths in the codebase:

1. heuristic/inference engine fallback
2. trained five-head model bundle

Many runtime paths still start heuristic-first, then later rebuild/recompute trained artifacts. So it is not honest to say the model fully owns all scoring end to end.

### Evaluator and corpus facts

Current evaluator supports these seed profiles:

- `smoke-3`
- `coverage-24`
- `coverage-32`
- `manifest-64`

Known corpus sizes:

- one complete proof run: 30 checkpoints, 21,600 stage-evidence rows
- `smoke-3`: 64,800 rows
- `manifest-64`: 1,382,400 rows in the latest user-reported 2026-04-27 Lightning.ai run

### Current artifact truth is layered

Two key evaluation stories coexist:

#### Smaller `smoke-3` artifact story

`air-mentor-api/output/proof-risk-model/evaluation-report.md` was generated on 2026-04-20 and reports:

- 3 worlds
- 64,800 total rows
- 21,600 held-out test rows
- overall-course model ROC-AUC `0.8049`
- heuristic ROC-AUC `0.7611`
- overall-course model Brier `0.1216`
- heuristic Brier worse

This is the flattering result set.

#### Repo-local archived `manifest-64` artifact story

`air-mentor-api/output/proof-risk-model/full64-20260424T043521Z.md` was generated on 2026-04-24 and reports:

- 64 worlds
- 518,400 total rows
- 259,200 held-out test rows
- overall-course model ROC-AUC `0.4974`
- heuristic ROC-AUC `0.7493`
- all variants near collapse
- `flagged@budget = 1`
- overload ratio `5`

This is materially worse and more concerning.

#### Newer external `manifest-64` Lightning run story
========
On `2026-04-27`, a newer `manifest-64` evaluator result was reported from Lightning.ai and supersedes the above archived broad-corpus story as the latest known run result, though it was not yet imported into repo-local artifacts during this audit.

Reported run identity:

- run id `20260427T011901Z-manifest64`
- git SHA `a6dd67e8`
- `64/64` seeds complete
- one duplicate for seed `101` was discarded because it was an older zero-checkpoint run; the full run was kept

Reported corpus shape:

- 64 seeds
- 1,382,400 total rows
- 259,200 held-out test rows

Reported overall-course comparison against heuristic:

- model ROC-AUC `0.7892`
- heuristic ROC-AUC `0.7494`
- lift `+0.040`
- model Brier `0.1372`
- heuristic Brier `0.2339`
- Brier lift `+0.097`
- model ECE `0.047`
- heuristic ECE `0.281`

Reported head-by-head AUCs:

- `attendanceRisk`: model `0.927`, heuristic `0.774`, lift `+0.153`
- `downstreamCarryoverRisk`: model `0.930`, heuristic `0.605`, lift `+0.325`
- `ceRisk`: model `0.872`, heuristic `0.818`, lift `+0.053`
- `seeRisk`: model `0.747`, heuristic `0.703`, lift `+0.044`
- `overallCourseRisk`: model `0.789`, heuristic `0.749`, lift `+0.040`

Reported variant comparison:

- `current-v8`: AUC `0.789`, Brier `0.137`, precision@budget `0.480`
- `baseline-v5-like`: AUC `0.784`, Brier `0.135`, precision@budget `0.473`
- `challenger`: AUC `0.758`, Brier `0.128`, precision@budget `0.359`
- `heuristic`: AUC `0.749`, Brier `0.234`, precision@budget `0.442`

Reported gate and stability summary:

- policy gates: all `3` passed
- CO evidence gates: both passed, `0` fallback
- queue burden: `watchRatesWithinLimit` failed, expected because watch queue remains structurally large
- overload ratio: approximately `1.0` across stages/semesters
- calibration stability: ECE `0.047`, slope `1.19`
- adjacent-stage Jaccard scores: all above `0.925`
- probability shift: slightly above `0.10` from `post-tt1 -> post-tt2` onward, worth monitoring but not treated as release-blocking

Operational reading of that run:

- `current-v8` is the best operational variant, not because it has the prettiest single calibration number, but because it combines better AUC, better precision@budget, and overload ratio almost exactly at target.
- `baseline-v5-like` is the calibration-cleaner variant, but it still over-fills the queue relative to `current-v8` and loses slightly on AUC and precision@budget. The honest framing is `baseline` as calibration-optimal versus `current-v8` as operations-optimal.
- `challenger` is not ship-worthy for the current institutional queueing problem. Its Brier is lower, but its precision@budget collapses and overload ratio rises above `2.3`, meaning it floods the queue and breaks staffing assumptions.
- `hybrid-router` effectively collapsed to `current-v8` in this run, which means either the current stack satisfied support thresholds everywhere or the hybrid trigger logic never meaningfully activated. Either way, hybrid did not add observed value here.
- the standout head is `downstreamCarryoverRisk`, whose discrimination gain over heuristic is the largest in the suite. But that win is a ranking win, not yet a probability-display win, because calibration is still too weak for raw probability exposure.

Release-boundary reading of that run:

- broad synthetic evaluator evidence now supports shipping `current-v8` for internal ranking, queue ordering, and intervention prioritization inside the proof universe.
- it does not justify a blanket “fully real-world validated probability system” claim.
- the main remaining model debts are local, not global: early-semester threshold behavior in sem-1 and sem-2, attendance local calibration near the `0.4` boundary, and carryover probability-display restrictions.

This is materially better than the stale repo-local archived `full64` story and supports the claim that `current-v8` beats heuristic, baseline, and challenger for the actual queue-constrained synthetic operating objective.

### Evaluator inconsistency

The older broad-corpus JSON sidecar in the repo also contains an internal split inconsistency:

- world split summary says `40/12/12`
- split summary in JSON reports `train: 0`, `validation: 259200`, `test: 259200`

That means the older repo-local wide-corpus artifact is not a clean promotion truth source by itself.

### Artifact freshness mismatch

Artifact freshness is also mixed:

- current repo commit at audit: `2aef0beb97f1e9c04e88afaf3f5fa5e99f9a14ec`
- broad evaluator artifact git SHA inside report: `1c730b5f1fa905c7253e95b90f1c23d35b2cb90a`
- `evaluation-report.md` is older than `meta.txt`
- the newer Lightning.ai `manifest-64` run is newer than both, but was externally reported rather than imported into `air-mentor-api/output/` at audit time

So the repo has newer code than the last broad recorded evaluation artifact.

### Realism audit result

`audit-map/32-reports/trajectory-realism-analysis.md` currently hard-fails realism. Reported problems include:

- monotonic backlog behavior
- mark concentration around narrow middle bands
- overly narrow SGPA spread

So the honest current statement is:

- latest reported synthetic evaluator metrics for `current-v8` are strong and materially better than heuristic and baseline on the 64-world run
- local archived `full64` artifact in the repo is stale and should not be treated as the latest result
- realism caveats still remain active, so “production-ready” is defensible only in the narrow sense of synthetic evaluator performance, not as a blanket real-world predictive claim

Therefore current honest claim boundary is:

- useful internal synthetic ranking/triage/explainer stack

Current dishonest claim boundary would be:

- externally validated real-world predictor
- realistic full transcript simulator
- production-served CatBoost system
- broad-corpus stable promotion-ready model

## Deployment, tooling, and verification architecture

### Frontend deployment model

Vite config supports:

- GitHub Pages base path behavior
- local proxy behavior for `/api` and `/health` only when explicitly configured
- manual chunk splitting for vendor groups

Current closeout docs still point to this frontend target:

- `https://raed2180416.github.io/AirMentor/`

### Backend deployment model

Current closeout docs still point to this backend target:

- `https://api-production-ab72.up.railway.app/health`

Backend startup diagnostics explicitly enforce the Pages + Railway cookie/CSRF contract.

### Local dev and demo modes

Current scripts show three distinct operating postures:

- plain local Vite dev
- local seeded backend with frontend pointing to `127.0.0.1:4000`
- live-with-fallback mode using Railway primary and local fallback

Separate demo posture exists:

- Pages frontend
- local seeded backend
- ngrok HTTPS tunnel

### Nix shell

`flake.nix` provides a repo dev shell with:

- `nodejs_24`
- `jq`
- `tmux`
- `python311`
- `uv`
- `playwright-test`

This repo expects shell/tooling parity to matter.

### Script surface

Root script surface includes:

- dev
- build
- lint
- frontend tests
- backend tests
- proof-risk evaluation
- compat-route inventory
- closeout verification wrappers
- multiple Playwright live suites

Backend script surface includes:

- dev
- seeded dev
- build
- fast test
- proof RC test suite
- proof-risk evaluation
- DB migrate
- DB seed

### CI workflows

Current workflow themes:

- repo hygiene and verification
- GitHub Pages deploy
- Railway deploy with preflight and post-deploy checks
- browser proof cadence
- manual live closeout verification

### Closeout backbone

`docs/closeout/` is not generic planning. It defines:

- stage order
- authoritative plan
- deploy environment contract
- operational event taxonomy
- stage gate protocol
- demo-day runbook
- operational execution rules

### Durable evidence files

Current durable evidence backbone includes:

- `output/playwright/execution-ledger.jsonl`
- `output/playwright/proof-evidence-manifest.json`
- `output/playwright/proof-evidence-index.md`
- `output/playwright/defect-register.json`

These are treated as authoritative closeout artifacts, not convenience output.

### Audit-map role

`audit-map/` functions as a second operational control plane:

- prompts
- automation policies
- tmux wrappers
- status files
- reports
- pass coordination

Important freshness warning:

- `audit-map/32-reports/current-run-status.md` is dated `2026-04-18`
- current audit date is `2026-04-26`

So it explains operating model, but is not current live status truth.

## Validation state observed during this audit

### Commands run

Executed or harvested this turn:

- root frontend tests: `npm test -- --reporter=dot`
- backend fast suite: `npm --workspace air-mentor-api test -- --reporter=dot`
- diagnostics wrapper behavior reviewed from `package.json`
- repo counts and route/table inventories gathered
- prior current-turn proof/ops probes from subagents harvested

### Frontend test result

Root Vitest result:

- 52 test files
- 251 tests
- 52 files passed
- 251 tests passed

Historical note:

- earlier in the audit, `tests/compat-route-inventory.test.ts`, `tests/risk-explorer.test.tsx`, and `tests/run-detached.test.ts` had captured failures
- those were later fixed deterministically and the root suite was rerun green

### Backend fast suite result

Backend fast suite later completed green after deterministic test and snapshot fixes.

Per-file timing summary observed:

- suite command: `npm --workspace air-mentor-api test -- --reporter=dot`
- backend files covered: `63`
- final result: pass

Historical note:

- earlier in the audit, `tests/academic-parity.test.ts` and later `tests/openapi.test.ts` exposed stale test/snapshot truth
- those failures were corrected without changing core product behavior and the suite was rerun green

### Diagnostic wrapper caveat

`npm run diagnostics:all` is not a strict pass/fail truth source by itself because every command in the script is suffixed with `|| true`.

That means:

- exit code `0` does not imply clean TypeScript or clean ESLint
- it is useful as broad signal collection
- it is not authoritative proof of green diagnostics

### Compat-route inventory signal

Current ops scan reports that tracked academic compatibility routes have no first-party runtime callers when strict runtime-clean mode is applied. This supports the claim that compatibility paths are becoming legacy shims rather than primary runtime paths.

### Playwright/tooling signal

Current ops scan also observed Playwright available in repo tooling flow and closeout/live harness machinery fully wired.

## Current-state contradictions and stale-document findings

### 1. Feature registry issue F-01 is stale

`airmentor-feature-registry.md` still claims:

- `F-01 | No top-level React error boundary`

Current code contradicts that:

- `src/main.tsx` wraps `App` in `ErrorBoundary`
- `src/error-boundary.tsx` provides a real fallback UI and reset path

So registry remains useful for feature inventory, but not all issue claims are current.

### 2. Current run-status report is stale

`audit-map/32-reports/current-run-status.md` is older than current audit date and should not be treated as live current status.

### 3. Model artifact freshness lags code

Proof-risk artifacts reference older git SHA than current repo state.

## Architecture tensions that define current reality

### Dual-store truth

The system still spans:

- authoritative relational tables
- compatibility/runtime JSON shadow
- frontend local persistence

This is probably the single most important architectural tension.

### Monolith-style orchestrators

Large feature concentration lives in:

- `src/App.tsx`
- `src/system-admin-live-app.tsx`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`

This is powerful for velocity, but creates broad blast radius for changes.

### Proof dependence in academic portal

Academic bootstrap currently hard-gates on active proof run. That means the teaching portal is still structurally coupled to proof activation.

### Local substrate not fully dead

Product direction is backend-first, but:

- `src/data.ts` still exists and matters
- `src/data.old.ts` still exists
- local repository mode still exists
- some persisted UI/runtime behaviors remain local-first

### Validation and productization are inseparable here

This repo does not have a clean boundary between:

- product code
- platform code
- verification code
- operational evidence code

They are deliberately intertwined.

## Honest summary

AirMentor in current codebase is a large, ambitious hybrid:

- academic operations product
- admin governance console
- deterministic proof simulator
- synthetic risk/explainer engine
- closeout verification machine

Its strongest areas today are:

- surface breadth
- proof-control richness
- backend route depth
- operational verification scaffolding
- detailed persistence contracts

Its weakest truths today are:

- architectural simplicity
- clean separation of authoritative vs compatibility state
- wide-corpus ML stability
- realism of long-horizon synthetic trajectories
- deep-linkable frontend routing
- freshness/reliability of some legacy docs versus code

## Appendix: feature-registry trust level

Current `airmentor-feature-registry.md` remains useful for:

- feature enumeration
- user-facing intent phrasing
- coverage crosswalk

It is not fully authoritative for:

- current issue severity
- current architectural defects
- claims already contradicted by newer code

Use it as inventory support, not as final truth.
