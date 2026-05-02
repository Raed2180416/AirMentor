# AirMentor Current-State Technical Deep Dive, Expanded

Status: companion expansion of `current-state-technical-deep-dive-2026-04-26.md`  
Audit date: 2026-04-26  
Companion to: `docs/current-state-technical-deep-dive-2026-04-26.md`

## Scope of this companion

This file expands the major points and feature families from the base deep-dive.

Granularity choice:

- expanded here: every major architecture point and every feature family from the base document
- not expanded here: all `135` atomic registry rows one by one

Each point follows the same frame:

- `Intent`
- `What it does`
- `How it works`
- `Why it exists`
- `Current caveats`

## Corrections carried forward from the base document

### Proof-risk latest-result semantics

- `evaluation-report.md/json` are the newest default-output files by filesystem mtime, but they still describe a `smoke-3` run.
- `full64-20260424T043521Z.*` is the newest visible archived `manifest-64` broad-corpus artifact.
- local `*latest.json` alias files for corrected logistic, beta calibration, and challenger are separate again; they are not the same thing as the top-level evaluation report.

### External evaluator update on 2026-04-27

- A newer `manifest-64` evaluator result was reported from Lightning.ai after the base audit.
- This newer result should be treated as the latest known evaluation run result.
- It was not yet imported into repo-local archived artifacts during the original audit pass, so repo-local stale-artifact caveats still matter.
- Reported run identity:
  - run id `20260427T011901Z-manifest64`
  - git SHA `a6dd67e8`
  - `64/64` seeds complete
  - one duplicate for seed `101` was discarded because it was an older zero-checkpoint run; the complete run was kept
- Reported shape and outcome:
  - `64` seeds
  - `1,382,400` rows
  - `259,200` held-out test rows
  - overall-course model ROC-AUC `0.7892`
  - overall-course heuristic ROC-AUC `0.7494`
  - model Brier `0.1372`
  - heuristic Brier `0.2339`
  - model ECE `0.047`
  - heuristic ECE `0.281`
  - `current-v8` beat `baseline-v5-like` on AUC and precision@budget
  - `challenger` had lower Brier but materially worse precision@budget and over-flagging behavior
  - policy and CO evidence gates passed
  - queue burden watch-rate gate still failed
  - overload ratio stayed around `1.0`
  - adjacent-stage Jaccard stayed above `0.925`

### External evaluator interpretation

- `Intent`:
  Decide whether the current promoted proof-risk stack is actually the right operating choice, not merely whether it can beat heuristic on a narrow metric.
- `What it says`:
  `current-v8` is the best operations-fit variant in this run, `baseline-v5-like` is the cleaner calibration variant, `challenger` is a queue-flooding non-ship variant, and `hybrid-router` added no observed differentiation because it collapsed to `current-v8`.
- `How to read it`:
  The important winning pattern is not just AUC. It is AUC plus precision@budget plus overload ratio near `1.0` plus clean policy-gate behavior plus `0` CO fallback. That combination is what makes the run promotion-relevant rather than merely interesting.
- `Why it matters`:
  This lets the project make a much stronger internal synthetic-release case than the stale repo-local archived `full64` artifact did.
- `Current caveats`:
  Early-semester threshold behavior is still weak around the `0.4` boundary, attendance local calibration near that same boundary is still under-called, carryover remains a ranking-only head for now, and the realism caveat is still outside the scope of this run.

### Validation latest-check semantics

As of the latest direct checks after deterministic test and snapshot fixes, the primary local suites are green.

- direct root `npm test -- --reporter=dot` passed with `52/52` files and `251/251` tests
- direct backend fast suite `npm --workspace air-mentor-api test -- --reporter=dot` passed across `63` backend test files
- Vitest cache files can still only be treated as secondary signals, not primary truth

So current truth is that the main frontend and backend local verification lanes did reach green, even though older audit-time notes captured earlier failures before those fixes landed.

## 1. Product pillars

### 1.1 Academic operations portal

- Intent:
  Build the day-to-day operating surface for Course Leaders, Mentors, and HoDs.
- What it does:
  Gives teaching-side users course, roster, risk, calendar, evidence-entry, queue, and governance surfaces.
- How it works:
  Frontend academic state is bootstrapped from `/api/academic/bootstrap`, then routed through an internal page-state machine instead of URL routes.
- Why it exists:
  The product needs a role-scoped teaching workspace, not only a proof dashboard or admin console.
- Current caveats:
  It is still structurally coupled to proof activation and still carries legacy local/mock substrate.

### 1.2 System-admin control plane

- Intent:
  Build the back-office plane for institutional setup, governance, proof operations, and records.
- What it does:
  Manages hierarchy, curriculum/policy, faculty/student registries, requests, reminders, proof runs, and restore/history flows.
- How it works:
  A backend-required admin shell resolves the API target, restores admin session state, then mounts a large live control-plane app with hash-based route parsing.
- Why it exists:
  The academic portal alone cannot safely expose institution-wide authoring, provisioning, or proof-run lifecycle controls.
- Current caveats:
  The live app is a very large orchestrator, and route/sessionStorage coupling is strong.

### 1.3 Proof-control plane

- Intent:
  Provide a deterministic synthetic cohort and semester-stage lifecycle that the rest of the product can operate against.
- What it does:
  Creates governed proof runs, checkpoints, projections, playback state, run activation, semester activation, advance, restore, and recompute behavior.
- How it works:
  Backend services build and persist synthetic world state into proof tables, then publish proof-aware read models and playback context to teaching/admin surfaces.
- Why it exists:
  The product’s demo, validation, and much of its operational semantics rely on proof-backed evidence rather than raw institutional live data.
- Current caveats:
  The academic portal still hard-gates on an active proof run, which keeps proof coupling high.

### 1.4 Risk and explanation system

- Intent:
  Rank, explain, and prioritize student/course risk inside the synthetic proof universe.
- What it does:
  Produces five head scores, risk bands, queue burden signals, no-action comparisons, and explanatory evidence slices.
- How it works:
  Uses a hybrid of heuristic fallback, trained logistic heads, tree challenger logic, stage-aware evidence features, and runtime recomputation.
- Why it exists:
  The product needs triage and action guidance, not just transcript display or static proof playback.
- Current caveats:
  It is valid for synthetic internal ranking claims, not for strong real-world predictive claims.

### 1.5 Closeout and evidence system

- Intent:
  Make implementation and verification resumable, inspectable, and auditable across local and live stacks.
- What it does:
  Stores ledgers, evidence manifests, indexes, defect registers, scripts, runbooks, and automation policies.
- How it works:
  Browser suites, stage docs, status files, and detached outputs all deposit durable artifacts that become part of repo truth.
- Why it exists:
  This project is operated through proof obligations, not only through informal “seems okay” checks.
- Current caveats:
  Some audit/status files age out; old operational files cannot be treated as live truth without timestamp checking.

## 2. Runtime architecture points

### 2.1 Top-level browser boot

- Intent:
  Start the product safely and capture whole-app render crashes.
- What it does:
  Mounts the React app under `StrictMode` and a top-level `ErrorBoundary`.
- How it works:
  `src/main.tsx` renders `App` inside `ErrorBoundary`; `src/error-boundary.tsx` provides fallback UI and reset behavior.
- Why it exists:
  A top-level crash boundary prevents total silent collapse and disproves older claims that no such boundary exists.
- Current caveats:
  This protects top-level React render crashes, but not every async/imperative failure path.

### 2.2 Portal router

- Intent:
  Split one deployment into multiple role-appropriate product entries.
- What it does:
  Sends users to home, academic, or admin workspace using hash parsing.
- How it works:
  `App` interprets `#/`, `#/app`, and `#/admin` and mounts different runtime roots.
- Why it exists:
  AirMentor is one deployed site serving two very different operating surfaces.
- Current caveats:
  This is hand-rolled routing, not a router framework with URL-state guarantees.

### 2.3 Academic runtime root

- Intent:
  Separate session/bootstrap/control concerns from surface-level page behavior.
- What it does:
  Handles API target, auth/session restore, bootstrap fetch, proof playback restore, and role binding before entering the live workspace.
- How it works:
  `OperationalApp` computes connection and session truth first, then mounts `OperationalWorkspace`.
- Why it exists:
  Teaching screens should not each own bootstrap/session/proof logic separately.
- Current caveats:
  Much cross-feature state still converges back into one huge `App.tsx`.

### 2.4 Academic workspace state machine

- Intent:
  Keep complex teaching flows responsive without deep URL dependence.
- What it does:
  Manages page, route history, overlays, queue, course context, and drilldowns in memory.
- How it works:
  A page enum plus route snapshot/history array controls which surface renders and how “back” behavior works.
- Why it exists:
  Many flows are modal/overlay/stateful in ways that were easier to ship through app-state routing than full URL routing.
- Current caveats:
  Reload and deep-link behavior are weaker than in a real URL-addressable router.

### 2.5 System-admin runtime root

- Intent:
  Refuse to open admin UI against missing or unhealthy backend state.
- What it does:
  Resolves API target, blocks until first health check, emits startup telemetry, and mounts the live admin app only when backend posture is acceptable.
- How it works:
  `SystemAdminApp` wraps `SystemAdminLiveApp` with connection, health, and diagnostic gates.
- Why it exists:
  Admin actions are stateful and governance-sensitive; a half-configured admin shell would be dangerous.
- Current caveats:
  This root is thin, but the app it launches is still extremely large.

### 2.6 API target resolution

- Intent:
  Support local, live, and fallback backend topologies without changing product code.
- What it does:
  Chooses one usable API base URL from primary plus optional fallbacks.
- How it works:
  `useApiConnectionTarget()` normalizes candidates, probes `/health`, picks the first healthy one, and keeps polling.
- Why it exists:
  The repo intentionally supports GitHub Pages + Railway, GitHub Pages + local tunnel, and local-first dev modes.
- Current caveats:
  “Latest active backend” can differ from configured primary; users/operators can misread what server they are actually on if they ignore fallback banners.

### 2.7 Startup diagnostics

- Intent:
  Detect deployment posture mistakes at runtime rather than only in docs.
- What it does:
  Flags bad API URL, localhost-over-HTTPS/public-origin mismatches, insecure remote API, and telemetry sink misconfiguration.
- How it works:
  Frontend computes diagnostic records and emits them through client telemetry; backend does similar environment validation on startup.
- Why it exists:
  This repo regularly moves between local, Pages, Railway, and tunnel setups; posture drift is common.
- Current caveats:
  Diagnostics are strong guidance, not full end-to-end correctness proof.

### 2.8 Client telemetry

- Intent:
  Give the frontend operational observability without depending only on console logs.
- What it does:
  Emits structured startup and runtime events to console, sink URL, or backend relay.
- How it works:
  `src/telemetry.ts` formats events, `client-telemetry.ts` validates/stores or relays them server-side.
- Why it exists:
  Proof/live stack debugging needs more than screenshots; it needs causal event traces.
- Current caveats:
  Telemetry usefulness depends on sink configuration and retention of backend telemetry tables.

### 2.9 Browser persistence

- Intent:
  Preserve operator continuity across refreshes and portal reentry.
- What it does:
  Stores theme, faculty selection, proof playback, tasks, meetings, drafts, locks, placements, and other runtime slices.
- How it works:
  `src/repositories.ts` wraps localStorage/sessionStorage and, in HTTP mode, mixes local snapshots with backend persistence.
- Why it exists:
  Teaching/admin flows are multi-step and interruption-prone.
- Current caveats:
  Some slices are still only cache-mutated in HTTP mode; persistence truth is not fully uniform.

### 2.10 Proof playback time anchoring

- Intent:
  Make proof views reflect checkpoint time, not machine clock time.
- What it does:
  Drives due labels, queue labels, and calendar anchors from playback date.
- How it works:
  Academic surfaces read `proofPlayback.currentDateISO` from bootstrap/proof context and derive time-sensitive display from it.
- Why it exists:
  Otherwise playback would visually lie about state chronology.
- Current caveats:
  Any helper leaking wall-clock defaults becomes a semantic bug, not a cosmetic one.

### 2.11 Local/mock substrate

- Intent:
  Preserve fallback/dev/test scaffolding while backend-first migration continues.
- What it does:
  Provides mock datasets, local repository mode, and seed mutation helpers.
- How it works:
  `src/data.ts`, `src/data.old.ts`, and local repository logic can still seed the app and be hydrated by backend snapshots.
- Why it exists:
  The product grew from mock-driven surfaces toward backend truth; old scaffolding was not fully deleted.
- Current caveats:
  Architectural messaging says backend-first, but code truth still contains transitional local-first layers.

## 3. Academic feature families

### 3.1 Portal/session/auth family

- Intent:
  Get the right user into the right workspace with the right role context.
- What it does:
  Handles portal entry, academic login, role switching, backend-required blocks, session restore, and bootstrap gating.
- How it works:
  Uses session APIs, role grants, hash routing, connection health, and proof-aware bootstrap restore.
- Why it exists:
  Teaching-side access is role-scoped and cannot be safely faked by frontend-only identity state.
- Current caveats:
  Auth flow remains deeply tied to backend availability and proof-run availability.

### 3.2 Course Leader dashboard and course family

- Intent:
  Give course owners a single place to assess class health and enter stage-bounded evidence.
- What it does:
  Shows summaries, grouped courses, tabs for overview/risk/attendance/TT/quizzes/assignments/CO/gradebook, and entry CTAs.
- How it works:
  Bootstrapped offerings plus role-scoped routes feed course pages, scheme/blueprint state, locks, and question-paper configuration.
- Why it exists:
  Course Leaders need both monitoring and direct evidence-entry workflows.
- Current caveats:
  Stage-lock logic and lock-mirror logic depend on both authoritative and compatibility state.

### 3.3 Workflow pages family

- Intent:
  Support teaching-side operational data management beyond the course tab shell.
- What it does:
  Provides roster, transcript/history, scheme setup, upload hub, and entry workspace flows.
- How it works:
  Uses shared bootstrap data, selection state, and backend writes for schemes, papers, patches, and evidence-entry commits.
- Why it exists:
  A single course detail screen cannot efficiently host every row-oriented or configuration-heavy workflow.
- Current caveats:
  There is still coupling between these pages and large shared workspace state.

### 3.4 Calendar and timetable family

- Intent:
  Make teaching tasks and student intervention work schedulable in the same operating environment.
- What it does:
  Offers planner modes, block editing, drag/resize, meetings, task placements, extra classes, and detail sheets.
- How it works:
  Frontend planner state syncs with backend calendar workspace tables, meetings tables, placement tables, and audit events.
- Why it exists:
  Risk/intervention work has calendar consequences; it cannot stay detached from the teaching schedule.
- Current caveats:
  Calendar truth spans multiple stores and rich UI state, which increases drift risk.

### 3.5 Mentor workbench family

- Intent:
  Turn mentee oversight into a triageable operational queue.
- What it does:
  Supports search, risk slicing, row actions, contact actions, mentee detail, and drilldown into deeper proof/explainer surfaces.
- How it works:
  Mentee data is bootstrapped and filtered by mentor scope, then linked into student history, shell, and risk explorer pages.
- Why it exists:
  Mentors need student-by-student casework, not only aggregate dashboard cards.
- Current caveats:
  Mentor flows depend on bootstrap scoping and route-state correctness; weak scoping would leak wrong students.

### 3.6 Queue history family

- Intent:
  Preserve lifecycle memory of academic interventions and handoffs.
- What it does:
  Shows active/resolved/dismissed queue lines and allows restore/resume behavior.
- How it works:
  Queue tasks plus transition history plus local dismissal state are combined into role-sensitive table behavior.
- Why it exists:
  Academic intervention work is longitudinal; operators need audit trail and resumption paths.
- Current caveats:
  Some dismissal behavior still relies on local persistence semantics.

### 3.7 Unlock review and correction-cycle family

- Intent:
  Govern evidence reopening without ad hoc manual side effects.
- What it does:
  Lets HoDs approve/reject/relock correction requests with cycle metadata and transition history.
- How it works:
  Backend correction engine defines allowed transitions; runtime routes persist next task state and unlock-request payloads.
- Why it exists:
  Evidence correction is a governed workflow, not a freeform overwrite.
- Current caveats:
  Engine exists and HTTP wiring exists, but reopen/recompute/relock side effects still depend on the rest of the stack honoring that state correctly.

### 3.8 HoD analytics family

- Intent:
  Give department-level visibility into hotspots, faculty workload, reassessment, and proof-state governance.
- What it does:
  Shows overview/courses/faculty/students/reassessments/counterfactual-style panels plus filters and drilldowns.
- How it works:
  HoD analytics routes assemble denormalized proof state across runs, risks, projections, alerts, and outcomes.
- Why it exists:
  HoDs operate on aggregation and governance, not only on per-student form entry.
- Current caveats:
  Counterfactual semantics remain synthetic and policy-heuristic, not causal proof.

### 3.9 Faculty profile family

- Intent:
  Show who a faculty member is in the system and what they are allowed to do.
- What it does:
  Displays appointments, grants, scope, overlays, and drilldowns into related evidence.
- How it works:
  Admin/control-plane projection routes and academic read-only surfaces map faculty records into display stacks.
- Why it exists:
  Faculty identity, grant, and scope truth are central to route access and operational responsibility.
- Current caveats:
  Profile display is read-focused; edit authority lives elsewhere in the admin stack.

### 3.10 Student shell family

- Intent:
  Provide a bounded, explainable assistant view over a single student’s proof-backed record.
- What it does:
  Offers tabs for overview, topic/CO, assessment evidence, interventions, timeline, and chat.
- How it works:
  Student-shell backend routes resolve run/checkpoint, scope-check access, then serve card/session/message/timeline data.
- Why it exists:
  The product wants guided explanation and intervention context, not only raw table rows.
- Current caveats:
  This is constrained explainer infrastructure, not a write-authoritative agent platform.

### 3.11 Risk explorer family

- Intent:
  Explain why a student or case is risky and how policy/action choices compare.
- What it does:
  Shows head-level metrics, completeness, drivers, evidence slices, and alternative scenario comparisons.
- How it works:
  Explorer routes combine trained head outputs, heuristic-derived comparisons, feature completeness, and proof evidence.
- Why it exists:
  Without explanation, queue/risk outputs would be much less usable and trustworthy.
- Current caveats:
  Probability display is gated and synthetic-world validity is limited.

### 3.12 Proof launcher family

- Intent:
  Keep users aware of run/checkpoint context while moving through teaching surfaces.
- What it does:
  Provides a lightweight proof summary strip and launcher popup for current playback/run state.
- How it works:
  Shared proof UI primitives read current proof context and present consistent shell/launcher language across surfaces.
- Why it exists:
  Proof context is semantically important and easy to lose if hidden.
- Current caveats:
  Different proof-aware surfaces need different levels of shell reuse; over-unifying them creates regressions.

## 4. System-admin feature families

### 4.1 Overview, navigation, and search family

- Intent:
  Let admins move quickly across a large governance/control surface.
- What it does:
  Provides top tabs, breadcrumbs, search dropdowns, and launch cards.
- How it works:
  Hash routes, route parsers, in-memory route state, and filtered entity search drive navigation.
- Why it exists:
  The admin surface is too broad to navigate efficiently through one flat page or one hierarchy tree alone.
- Current caveats:
  Hash-route and sessionStorage restore behavior can reopen surprising contexts.

### 4.2 Action queue family

- Intent:
  Put urgent operator work in front of everything else.
- What it does:
  Surfaces request cards, reminders, hidden-record recoveries, dismissal controls, and quick reminder creation.
- How it works:
  Admin request tables, reminder tables, audit/history state, and local dismissal behavior are aggregated into a queue.
- Why it exists:
  Control planes become unusable if everything is equally prominent all the time.
- Current caveats:
  Some queue-hide behavior is still persistence-policy-heavy rather than fully server-authoritative.

### 4.3 Requests workspace family

- Intent:
  Formalize admin request handling into an auditable lifecycle.
- What it does:
  Supports list/detail review, transitions, notes, and version protection.
- How it works:
  Request routes persist state transitions and notes into dedicated request tables with optimistic concurrency semantics.
- Why it exists:
  Governance requests need traceability and terminal states, not only informal comments.
- Current caveats:
  Operational quality depends on users actually following the intended request lifecycle.

### 4.4 Proof dashboard family

- Intent:
  Give admins a first-class operational cockpit for the synthetic proof stack.
- What it does:
  Exposes summary, checkpoints, diagnostics, operations, imports, run lifecycle, snapshot restore, activation, and evidence timeline.
- How it works:
  Admin proof sandbox routes call dashboard, queue, activation, restore, recompute, and artifact services.
- Why it exists:
  Proof control is the highest-leverage admin capability and must be operator-visible.
- Current caveats:
  Artifact semantics are layered and can be misread if “latest” means path mtime instead of broad archive or sidecar alias.

### 4.5 History and archive family

- Intent:
  Preserve reversibility and historical trace for admin changes.
- What it does:
  Shows archive history, restore flows, and route-from-audit behavior.
- How it works:
  Archive/recycle data and audit events are surfaced through dedicated history workspaces.
- Why it exists:
  Admin control planes without restoration/audit become brittle and dangerous.
- Current caveats:
  Old history truth is useful, but users must distinguish archival history from current operational state.

### 4.6 Hierarchy and scope family

- Intent:
  Make institutional scope explicit and operable at every level.
- What it does:
  Lets admins navigate faculty, department, branch, batch, and section while editing, provisioning, or launching scoped registries.
- How it works:
  Hierarchy routes, scope IDs, policy resolution, and workspace shells coordinate the selected scope with downstream views.
- Why it exists:
  AirMentor’s governance and count semantics are scope-sensitive; scope must be explicit.
- Current caveats:
  Section scope logic is important and duplicated in a few places; drift here would be high-impact.

### 4.7 Faculty calendar oversight family

- Intent:
  Give admins oversight and edit paths over faculty scheduling surfaces.
- What it does:
  Shows calendar summaries, full planner mode, recurring block edits, marker edits, and save/reset flows.
- How it works:
  Dedicated admin calendar workspace tables plus planner UI handle faculty schedule projection and mutation.
- Why it exists:
  Faculty operations and academic task scheduling intersect; admins need visibility and governance.
- Current caveats:
  Planner richness makes drift/debuggability harder than in simple CRUD screens.

## 5. Backend platform points

### 5.1 Boot/config/startup layer

- Intent:
  Start only in a coherent environment and make unsafe posture explicit.
- What it does:
  Loads config, DB, telemetry/email services, validates deployment posture, and boots Fastify.
- How it works:
  `index.ts`, `config.ts`, and `startup-diagnostics.ts` collaborate before app listen.
- Why it exists:
  This backend runs under local, tunnel, and live deployment modes with different cookie/CORS/CSRF needs.
- Current caveats:
  Startup correctness is necessary but not sufficient for route/runtime correctness.

### 5.2 HTTP shell and security layer

- Intent:
  Provide route registration, serialization, CORS/cookie policy, and write protection.
- What it does:
  Installs Fastify plugins and enforces origin + CSRF write gates.
- How it works:
  `app.ts` applies request hooks before registered modules handle route logic.
- Why it exists:
  Teaching/admin/proof routes all mutate sensitive state; write barriers must be central.
- Current caveats:
  Special-case exemptions like login are necessary but must stay narrowly justified.

### 5.3 Session/auth backend family

- Intent:
  Make user identity, faculty identity, and role identity all explicit server-side truths.
- What it does:
  Supports login, logout, restore, role-context switching, password setup/reset, and UI preferences.
- How it works:
  Session tables, rate-limit windows, role grants, faculty profiles, and CSRF token issuance are assembled into one payload.
- Why it exists:
  A single “logged in” boolean would be too weak for multi-role scoped workflows.
- Current caveats:
  Role/faculty/session coupling makes seed and grant consistency very important.

### 5.4 Academic bootstrap family

- Intent:
  Return the whole academic portal parity snapshot in one proof-aware payload.
- What it does:
  Sends offerings, faculty, students, mentees, runtime state, schemes, papers, tasks, placements, calendar state, and optional proof playback context.
- How it works:
  `buildAcademicBootstrap` loads many relational tables, merges runtime shadow state, scopes by proof run/checkpoint and viewer role, then serializes one snapshot.
- Why it exists:
  The academic frontend is driven by one cohesive bootstrap contract rather than many isolated data fetches.
- Current caveats:
  This is a large, central blast-radius API and it hard-gates on active proof runs.

### 5.5 Academic proof-access family

- Intent:
  Prevent users from seeing proof data they are not entitled to view.
- What it does:
  Validates run, checkpoint, viewer, faculty context, and access-code scope for shell/timeline/message routes.
- How it works:
  Academic proof routes delegate to run/checkpoint resolvers and scope-check helpers before data assembly.
- Why it exists:
  Proof data includes synthetic but sensitive cohort-level operational views.
- Current caveats:
  Any scoping bug here becomes a high-severity cross-viewer leak.

### 5.6 HoD analytics backend family

- Intent:
  Build department-level proof analytics from many denormalized tables.
- What it does:
  Serves summaries, bundles, course/faculty/student rollups, and reassessment actions.
- How it works:
  Analytics services aggregate runs, projections, risk rows, alerts, queue cases, interventions, and transcripts.
- Why it exists:
  HoDs need synthesized oversight, not raw table joins.
- Current caveats:
  These outputs inherit all caveats of the synthetic world and proof scoring stack.

### 5.7 Proof lifecycle backend family

- Intent:
  Provide reliable run creation, background processing, activation, playback, and archive semantics.
- What it does:
  Queues runs, leases work, heartbeats, marks failure, activates runs/semesters, advances, archives, restores, and recomputes risk.
- How it works:
  `proof-run-queue.ts` plus proof-control services coordinate DB state transitions and worker execution.
- Why it exists:
  Proof lifecycle is too long and stateful to run as one synchronous route-only action.
- Current caveats:
  Worker health and stale lifecycle state can become operationally confusing without artifact/audit checks.

### 5.8 Correction-cycle backend family

- Intent:
  Encode unlock/correction/relock semantics as a rule system rather than hand-coded route branches everywhere.
- What it does:
  Determines valid transitions, actor actions, reopen/recompute semantics, and cycle descriptions.
- How it works:
  A pure engine computes state transitions; routes persist resulting task payload and history.
- Why it exists:
  The teaching correction cycle is semantically complex and recurring.
- Current caveats:
  Persistence of next state exists; full downstream side-effect orchestration is still distributed.

### 5.9 Attendance and assessment backend family

- Intent:
  Make evidence-entry authoritative and stage/lock aware.
- What it does:
  Commits attendance rows, assessment scores, TT aggregates, runtime mirrors, and lock updates.
- How it works:
  Narrow routes validate ownership, stage, lock, scheme membership, then write authoritative rows and compatibility mirrors.
- Why it exists:
  Evidence-entry is the source of later risk/queue/proof semantics.
- Current caveats:
  Lock semantics are asymmetric between assessment and attendance.

### 5.10 Admin governance backend family

- Intent:
  Put institutional authoring and proof operations behind explicit backend contracts.
- What it does:
  Serves structure, people, students, courses, curriculum, provisioning, proof admin, requests, reminders, search, and faculty profile projections.
- How it works:
  Many route modules write directly through Drizzle-backed service helpers rather than through a repository layer.
- Why it exists:
  Frontend-only governance logic would be untrustworthy and impossible to audit well.
- Current caveats:
  Direct table access plus large modules creates high coupling and broad regression surface.

## 6. Persistence and data-model points

### 6.1 Authoritative tables

- Intent:
  Hold normalized domain truth for auth, structure, proof state, academic operations, and observability.
- What it does:
  Persists 96 tables across all product subsystems.
- How it works:
  Drizzle schema definitions encode table names, PKs, FKs, and version/status/timestamp patterns.
- Why it exists:
  The product has too many long-lived entities and workflows to be safely local-only.
- Current caveats:
  Breadth is high; schema understanding is mandatory before major refactors.

### 6.2 Runtime compatibility shadow

- Intent:
  Preserve older runtime-slice semantics while authoritative table migration continues.
- What it does:
  Stores JSON slices like patches, locks, tasks, placements, meetings, and other compatibility state in `academic_runtime_state`.
- How it works:
  Academic module validators read and write keyed JSON slices, then bootstrap merges them with authoritative reads.
- Why it exists:
  It reduces migration pressure by allowing new narrow routes and older broad sync assumptions to coexist.
- Current caveats:
  This is the main dual-truth tension in the codebase.

### 6.3 Audit and telemetry persistence

- Intent:
  Preserve observability and admin/operational accountability.
- What it does:
  Stores audit events, operational telemetry, request notes/transitions, and reminders.
- How it works:
  Route/service actions emit structured events that land in dedicated observability/workflow tables.
- Why it exists:
  The project emphasizes traceability and proof of behavior, not silent mutation.
- Current caveats:
  Observability value depends on operators actually consulting these artifacts during debugging.

### 6.4 Lock semantics

- Intent:
  Prevent invalid or premature editing once evidence states should harden.
- What it does:
  Tracks assessment and attendance lock state across offerings and runtime mirrors.
- How it works:
  Assessment lock uses DB-backed offering fields; attendance lock is mirrored through runtime state.
- Why it exists:
  Stage-bounded evidence integrity is central to the correction/governance model.
- Current caveats:
  Lock asymmetry makes reasoning and testing harder.

### 6.5 Optimistic concurrency

- Intent:
  Prevent stale concurrent overwrites on sensitive entities.
- What it does:
  Uses versions or expected-update markers for tasks, placements, meetings, reminders, preferences, and related flows.
- How it works:
  Routes compare client-supplied expected values against stored versions before applying mutations.
- Why it exists:
  Multiple actors and long-running surfaces can otherwise silently trample each other.
- Current caveats:
  Broad compatibility routes still weaken the elegance of this model.

## 7. Proof, ML, and worldbuilding points

### 7.1 Synthetic decision-simulator framing

- Intent:
  Model how a proof cohort evolves academically and operationally through semesters/stages.
- What it does:
  Generates and updates a synthetic academic world that later feeds dashboards, shells, explorers, and queues.
- How it works:
  World generation, checkpoint materialization, and runtime risk recompute all write into proof tables and read models.
- Why it exists:
  The product’s demo and validation story depends on rich proof state, not only on static mocks.
- Current caveats:
  This is synthetic internal truth, not external academic reality.

### 7.2 Worldbuilder

- Intent:
  Produce students, faculty load, course progression, and stage evidence with repeatable governed variation.
- What it does:
  Uses scenario families, archetypes, latent traits, behavior profiles, and synthetic assessment generation.
- How it works:
  The proof-control plane and seeded-semester services compute marks, risk factors, interventions, and progression state across semesters.
- Why it exists:
  The risk and queue system needs nontrivial longitudinal evidence, not flat random rows.
- Current caveats:
  Backlog clearance realism and some score distributions remain weak.

### 7.3 Realism engine

- Intent:
  Provide mathematically grounded helpers for mark realization and decay rather than pure arbitrary constants everywhere.
- What it does:
  Supplies bounded randomization, beta-based mark shaping, decay, and delta math.
- How it works:
  Shared realism functions are consumed by stage realization and worldbuilding logic.
- Why it exists:
  A pure deterministic formula without realism helpers would make all trajectories too rigid and easy to overfit.
- Current caveats:
  Current product behavior still often reduces to baseline replay plus additive deltas.

### 7.4 Risk model

- Intent:
  Convert synthetic observed evidence into prioritized risk heads and operationally useful scores.
- What it does:
  Produces attendance, CE, SEE, overall-course, and downstream-carryover risk signals.
- How it works:
  Uses feature-schema v5, logistic v8 heads, calibration choice, and a shallow tree challenger path.
- Why it exists:
  Queue triage and explanation require more structure than one heuristic formula.
- Current caveats:
  Probability display is gated and heuristic fallback still matters in some runtime paths.

### 7.5 Model-serving truth vs model-artifact truth

- Intent:
  Distinguish what the live TS runtime actually uses from what offline scripts can train or archive.
- What it does:
  Separates runtime logistic/tree scoring from Python-side CatBoost experiments and local calibration artifacts.
- How it works:
  Runtime serving lives in TS libs and backend routes; local sidecars live in `output/proof-risk-model/*latest.json` and timestamped dirs.
- Why it exists:
  Without this distinction, it is easy to falsely claim that an offline challenger is the live served model.
- Current caveats:
  Naming still invites confusion, especially around “CatBoost challenger”.

### 7.6 Evaluator truth

- Intent:
  Compare heuristic, current, baseline, hybrid, and challenger performance over governed proof corpora.
- What it does:
  Writes summary metrics, action rollups, queue burden, calibration, reproducibility, and broad or narrow corpus reports.
- How it works:
  `evaluate-proof-risk-model.ts` creates/reuses governed runs, builds artifacts, computes metrics, and emits JSON/Markdown plus sidecars.
- Why it exists:
  The risk system needs explicit promotion/debug evidence, not only intuition.
- Current caveats:
  “Latest” report semantics are layered. The stale repo-local archived `full64` artifact looked dramatically worse than `smoke-3`, but the newer externally reported Lightning `manifest-64` run materially improved that broad-corpus story and now stands as latest known evaluator truth. The deeper technical reading is:
  - `current-v8` should be preferred as the operations-optimal variant because queue-fit and precision@budget matter more than isolated calibration neatness
  - `baseline-v5-like` remains useful as a calibration reference point, not as the preferred deployed queueing variant
  - `challenger` currently fails the institutional-capacity objective even though some scalar metrics look attractive
  - `hybrid-router` presently behaves as a naming layer over `current-v8`, not as a meaningfully distinct deployed behavior

### 7.7 Artifact semantics

- Intent:
  Make it possible to talk precisely about which proof-risk result set one means.
- What it does:
  Distinguishes top-level default report, archived full64 report, and local alias sidecars.
- How it works:
  Different scripts and write paths update different filenames with different notions of “latest.”
- Why it exists:
  The same folder currently mixes operational summary, archive snapshots, and component-local aliases.
- Current caveats:
  If “latest” is used casually, it becomes false very fast. In current truth there are at least three distinct “latest” meanings:
  - newest top-level repo-local default report
  - newest repo-local archived `full64` snapshot
  - newest externally reported evaluator run, currently the `2026-04-27` Lightning `manifest-64` result
  This matters because different arguments depend on different artifacts:
  - “what is the latest broad evaluation verdict?” points to the external Lightning run
  - “what is physically checked into repo-local output?” points to stale local artifacts
  - “what does runtime likely serve?” points to the active TypeScript/backend stack plus local sidecars, not to whichever Markdown file has the newest timestamp

### 7.8 Realism and validity boundary

- Intent:
  Keep claims honest.
- What it does:
  Defines where current proof-risk/worldbuilding can and cannot be trusted.
- How it works:
  Realism audits, evaluator reports, and artifact comparisons expose synthetic-only strengths and realism weaknesses.
- Why it exists:
  Without an explicit honesty boundary, product/demo narratives would overclaim model quality.
- Current caveats:
  The realism audit is currently a hard fail, so this caveat is active, not hypothetical. The honest synthesis is:
  - synthetic evaluator quality for the latest reported `manifest-64` run is strong enough to call `current-v8` materially improved over heuristic and baseline
  - that same result is strong enough to justify ranking, queue-ordering, and intervention-prioritization claims inside the synthetic proof universe
  - it is not strong enough to justify unrestricted probability-display claims, especially for carryover
  - it is not strong enough to erase early-semester threshold debt in sem-1 and sem-2
  - that does not erase realism concerns in the world generator
  - “production-ready” is supportable only in the narrow sense of internal synthetic evaluator metrics unless and until realism and external validity claims are separately established

## 8. Deployment, tooling, and verification points

### 8.1 Frontend deployment model

- Intent:
  Ship the UI to GitHub Pages while keeping backend target configurable.
- What it does:
  Builds a static frontend with environment-driven API base and optional local proxy behavior.
- How it works:
  Vite base/path logic and env vars shape the built asset URLs and local preview proxy behavior.
- Why it exists:
  The repo’s chosen deployment story is Pages frontend, not a monolithic fullstack deploy.
- Current caveats:
  Live correctness still depends heavily on backend cookie/CORS posture.

### 8.2 Backend deployment model

- Intent:
  Ship a live API under Railway-like runtime constraints with verified cookie/CSRF behavior.
- What it does:
  Runs the Fastify/Drizzle backend with live session-contract checks and readiness preflight.
- How it works:
  Railway deploy workflow, startup diagnostics, and readiness scripts gate environment assumptions.
- Why it exists:
  Pages frontend needs a live API, and this repo wants that connection verified, not assumed.
- Current caveats:
  Local and demo tunnel modes still matter, so Railway is not the only real operating mode.

### 8.3 Local development and demo modes

- Intent:
  Support both engineer-local work and live-demo scenarios.
- What it does:
  Provides plain Vite, local seeded backend, Railway-primary-with-local-fallback, and Pages-plus-ngrok demo flows.
- How it works:
  Shell scripts set env vars, start seeded backend or sync DBs, and sometimes run preview/tunnel wrappers.
- Why it exists:
  The product has to function in multiple truth modes before full production hardening.
- Current caveats:
  These modes create runtime ambiguity if operators forget which one is actually active.

### 8.4 CI and browser-proof stack

- Intent:
  Make repo truth measurable from lint to live browser behavior.
- What it does:
  Runs lint, build, frontend tests, backend tests, proof/browser cadence, Pages deploy, Railway deploy, and live closeout checks.
- How it works:
  GitHub Actions workflows plus local shell wrappers compose these checks in different combinations.
- Why it exists:
  This repo’s risk is not just compile failures; it is semantic drift across many surfaces.
- Current caveats:
  Some wrappers, like `diagnostics:all`, are signal-collection helpers rather than strict truth gates.

### 8.5 Closeout evidence backbone

- Intent:
  Preserve proof that a given stage or claim was actually checked.
- What it does:
  Stores assertion catalogs, ledgers, manifests, evidence indexes, and defect registers.
- How it works:
  Scripts and manual closeout passes append durable artifact records to repo-tracked files.
- Why it exists:
  User and repo culture here demand resumable, inspectable operational truth.
- Current caveats:
  Artifact freshness and stage date must always be checked before assuming “passed” still means now.

### 8.6 Audit-map control plane

- Intent:
  Coordinate long-running audit passes and proof work outside chat-only state.
- What it does:
  Holds prompts, automation policies, reports, status files, wrappers, and operator notes.
- How it works:
  File-backed audit procedures and detached-run outputs live under `audit-map/` and `output/detached/`.
- Why it exists:
  This repo’s operating model assumes interruptions, resumptions, and multiple pass types.
- Current caveats:
  Stale `current-run-status` style files can mislead if timestamp ignored.

## 9. Validation and truth-state points

### 9.1 Direct frontend test truth

- Intent:
  Establish whether root frontend unit/integration tests are currently green.
- What it does:
  Runs the root Vitest suite.
- How it works:
  `npm test -- --reporter=dot` executes the configured frontend test set.
- Why it exists:
  Frontend regressions in routing, explorer text, or detached wrappers show up here first.
- Current caveats:
  Earlier during the audit this suite was red, but latest direct check passed at `52/52` files and `251/251` tests.

### 9.2 Direct backend fast-suite truth

- Intent:
  Establish whether the backend’s main fast verification lane is currently green.
- What it does:
  Runs the custom sequential backend test wrapper.
- How it works:
  `node scripts/run-vitest-suite.mjs` runs backend files in a defined order and reports per-file timings.
- Why it exists:
  Some backend tests are heavy; the repo separates fast lane and proof-rc lane.
- Current caveats:
  Earlier during the audit this suite was red, but latest direct check passed across `63` backend test files after deterministic test and snapshot fixes.

### 9.3 Cache-file truth

- Intent:
  See what the latest local Vitest caches say without pretending they are perfect truth.
- What it does:
  Records pass/fail states and durations for recent test executions.
- How it works:
  Vitest updates `results.json` files under `.vite/vitest/...`.
- Why it exists:
  They provide fast local evidence of recent failure state.
- Current caveats:
  They can retain stale-looking entries when not all files rerun through the same path.

### 9.4 Diagnostics-wrapper truth

- Intent:
  Collect TypeScript and ESLint signals across many packages quickly.
- What it does:
  Runs multiple `tsc` and lint commands.
- How it works:
  `diagnostics:all` chains commands, but each one is followed by `|| true`.
- Why it exists:
  It is a broad signal collector for operator convenience.
- Current caveats:
  Exit `0` here does not mean clean repo.

### 9.5 Compat-route inventory truth

- Intent:
  Detect whether deprecated compatibility routes are still used by first-party runtime code.
- What it does:
  Scans repo callers and reports runtime-clean or not.
- How it works:
  `report-compat-route-callers.mjs` searches target dirs and filters caller classes.
- Why it exists:
  The repo is migrating from broad compatibility sync behavior toward narrower authoritative routes.
- Current caveats:
  Inventory outputs can include docs/logs/audit chatter unless strict runtime filtering is applied.

## 10. Main architecture caveats

### 10.1 Dual truth

- Intent:
  Transitional coexistence between old and new data models.
- What it does:
  Keeps authoritative tables, runtime JSON shadow, and browser-local state all alive together.
- How it works:
  Bootstrap and narrow write routes merge, mirror, or prefer one truth source over another.
- Why it exists:
  Full cutover was not finished in one move.
- Current caveats:
  This is the highest-value simplification target in the codebase.

### 10.2 Large orchestrators

- Intent:
  Centralize multi-surface behavior quickly.
- What it does:
  Concentrates a lot of coordination logic into a few massive files.
- How it works:
  Shared state, navigation, and handlers live together rather than through many small owners.
- Why it exists:
  It accelerated feature growth and preserved behavior while the product evolved.
- Current caveats:
  Blast radius and local reasoning cost are high.

### 10.3 Proof coupling

- Intent:
  Keep academic portal truth tied to active simulation context.
- What it does:
  Refuses academic bootstrap without active proof run and threads proof context across surfaces.
- How it works:
  Bootstrap route checks active runs before constructing teaching payloads.
- Why it exists:
  The current cohort/offerings/student surface is proof-materialized, not general live SIS truth.
- Current caveats:
  This makes the teaching portal dependent on proof admin state.

### 10.4 Documentation drift

- Intent:
  None. This is a failure mode.
- What it does:
  Causes older documents or status files to say things current code no longer says.
- How it works:
  Long-lived repo surfaces evolve faster than every audit file gets refreshed.
- Why it exists:
  The repo is broad, fast-moving, and artifact-heavy.
- Current caveats:
  Code and current-dated artifacts must outrank older prose.
