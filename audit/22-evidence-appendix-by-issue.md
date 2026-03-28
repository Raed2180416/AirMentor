# AirMentor Evidence Appendix By Issue

## What this area does
This appendix is the hard-evidence layer for the issue catalog. For each AM issue, it lists the exact files, symbols, routes, tables, tests, and code-backed observations that support the finding, plus whether the issue is directly confirmed or still partly inferred.

## Confirmed observations
- Every issue in the current AM namespace is backed by active code, tests, scripts, configs, or tracked artifacts.
- Some issues are confirmed partly by presence and partly by absence. For example, observability debt is evidenced by the lack of telemetry integrations or metrics surfaces, not by one broken function.
- The strongest evidence sources are:
  - active route modules in `air-mentor-api/src/modules/`
  - orchestration hotspots in `src/App.tsx`, `src/system-admin-live-app.tsx`, `air-mentor-api/src/modules/academic.ts`, and `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
  - seeded integration tests and browser scripts

## Current-state reconciliation (2026-03-28)
| Issue | Current status | Reconciliation summary |
| --- | --- | --- |
| AM-001 | Partial | hotspot sizes are materially lower and route/shell seams now exist, but the main orchestrators still remain large |
| AM-002 | Mostly resolved | `#/` is neutral again and restore state is explicit/resettable |
| AM-003 | Mostly resolved | narrow runtime routes exist, `/sync` routes are now deprecated compatibility shims, narrow per-entity writes no longer update runtime shadow, first-party runtime writes no longer use the generic runtime route, and authoritative-first bootstrap plus central observed-state decoding now carry most of the normalization load |
| AM-004 | Partial | academic access evaluators now exist, but scope reasoning is still not fully centralized across all layers |
| AM-005 | Mostly resolved | proof trust framing is clearer, with adjacent trust legend copy in the student shell; remaining uncertainty is about deployed-user interpretation rather than missing repo-local controls |
| AM-006 | Mostly resolved | proof services are extracted further, including playback governance and seeded semester generation, but the main proof facade still remains large |
| AM-007 | Partial | linkage approval now has an explicit degraded contract, but helper/runtime brittleness remains |
| AM-008 | Partial | CI, diagnostics, repo-native telemetry, and repo hygiene gates now exist; external observability still does not |
| AM-009 | Mostly resolved | keyboard regression, live axe/browser accessibility regression, and accessibility-tree assertions all exist; screen-reader-specific evidence is still incomplete |
| AM-010 | Resolved | mock-admin runtime surface is gone and the root prototype/temp clutter was removed |
| AM-011 | Partial | queue/checkpoint diagnostics are now visible, but deep operability still depends on internal knowledge |
| AM-012 | Partial | authoritative-first bootstrap, compatibility-only shadow routes, and central observed-state decoding now exist, but immutable replay snapshots remain JSON-heavy by design |
| AM-013 | Mostly resolved | non-deploy CI and scheduled proof/browser flows now exist, and `verify:final-closeout*` now encode the deterministic closeout bar, but release discipline still matters operationally |
| AM-014 | Partial | restore/process density is better surfaced but still cognitively heavy |
| AM-015 | Partial | startup diagnostics and repo hygiene gates exist, but environment drift can still break the product |
| AM-016 | Mostly resolved | rate limiting and CSRF exist; production-like startup now requires an explicit CSRF secret, and rate limiting is now DB-backed |

## Key workflows and contracts
### AM-001
- Exact files: `src/App.tsx`, `src/system-admin-live-app.tsx`, `air-mentor-api/src/modules/academic.ts`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Exact symbols: `OperationalApp`, `SystemAdminLiveApp`, `buildAcademicBootstrap`, `registerAcademicRoutes`, `buildStudentAgentCard`, `buildStudentRiskExplorer`, `startStudentAgentSession`, `sendStudentAgentMessage`
- Exact routes/tables: `/api/academic/bootstrap`, `/api/academic/student-shell/*`, `/api/academic/students/:studentId/risk-explorer`, proof tables in `schema.ts`
- Evidence: current hotspot LOC counts are 4,257, 7,205, 3,862, and 4,079 respectively; extracted shells and route registrars now exist, but each file still owns multiple distinct responsibilities instead of one narrow domain seam
- Why it supports the issue: the implementation concentration is directly observable in file size, symbol breadth, and route ownership
- Status: partially resolved but still directly evidenced
- Additional proof that would reduce remaining uncertainty: git change-frequency analysis by file and incident history by hotspot

### AM-002
- Exact files: `src/repositories.ts`, `src/portal-routing.ts`, `src/proof-playback.ts`, `src/system-admin-live-app.tsx`, `src/App.tsx`
- Exact symbols: `createLocalAirMentorRepositories`, `createHttpSessionPreferencesRepository`, `resolvePortalRoute`, `readProofPlaybackSelection`, `writeProofPlaybackSelection`
- Exact routes/tables: `/api/academic/bootstrap`, `/api/academic/runtime/:stateKey`, `/api/academic/tasks/sync`, browser keys including `airmentor-proof-playback-selection` and `airmentor-admin-ui:${routeToHash(route)}`
- Evidence: route restoration, workspace hints, proof playback persistence, and invalid-checkpoint fallback are all implemented across browser storage plus server-backed bootstrap
- Why it supports the issue: the same visible state is sourced from React state, backend state, local storage, and session storage
- Status: confirmed directly
- Additional proof: telemetry or recorded session replays of restore-path confusion in real usage

### AM-003
- Exact files: `air-mentor-api/src/modules/academic.ts`, `src/App.tsx`, `src/api/client.ts`, `src/repositories.ts`
- Exact symbols: `buildAcademicBootstrap`, `getAcademicBootstrap`, runtime sync methods in `AirMentorApiClient`
- Exact routes/tables: `/api/academic/bootstrap`, `/api/academic/runtime/:stateKey`, `/api/academic/tasks/sync`, `/api/academic/task-placements/sync`, `/api/academic/calendar-audit/sync`, `/api/academic/tasks`, `/api/academic/task-placements`, `/api/academic/calendar-audit`, tables `academic_runtime_state`, `academic_tasks`, `academic_task_placements`, `academic_calendar_audit_events`
- Evidence: bootstrap is still aggregate; narrow runtime routes now exist; the old `/sync` endpoints remain live but are now deprecated compatibility shims; first-party runtime writes no longer use the generic runtime route; authoritative task/placement/calendar rows now override shadow-only runtime extras; narrow per-entity writes no longer touch runtime shadow; and `proof-observed-state.ts` now centralizes observed-state decoding across bootstrap and proof services
- Why it supports the issue: broad hydration plus broad sync creates drift, overwrite, and scale pressure
- Status: partially resolved but still directly evidenced
- Additional proof: payload-size logging and concurrent-edit conflict traces

### AM-004
- Exact files: `air-mentor-api/src/modules/support.ts`, `air-mentor-api/src/modules/academic.ts`, `air-mentor-api/src/modules/admin-control-plane.ts`, `src/system-admin-live-data.ts`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Exact symbols: `resolveRequestAuth`, `requireRole`, `sortActiveRoleGrantRows`, `evaluateAcademicAccess`, `buildAcademicAccessDeniedErrorDetails`, `isFacultyProofQueueItemVisible`, `isFacultyProofStudentVisible`, `resolveProofReassessmentAccess`, `isAcademicFacultyVisible`, `isDepartmentVisible`
- Exact routes/tables: session routes, proof routes, faculty-profile route, admin search, role and appointment tables
- Evidence: academic access evaluators now exist, but generic role checks, overlap checks, proof access filters, and frontend visibility helpers are still split across modules
- Why it supports the issue: there is no single reusable policy object that explains end-to-end visibility
- Status: partially resolved but still directly evidenced
- Additional proof: centralized access-matrix tests spanning all route families

### AM-005
- Exact files: `src/pages/student-shell.tsx`, `src/pages/risk-explorer.tsx`, `src/pages/hod-pages.tsx`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Exact symbols: `StudentShellPage`, `RiskExplorerPage`, `HodView`, `buildIntroShellMessage`, `classifyStudentAgentPrompt`, `buildGuardrailReply`, `buildAssistantReply`
- Exact routes/tables: `/api/academic/student-shell/*`, `/api/academic/students/:studentId/risk-explorer`, proof card/session/message tables
- Evidence: the UI uses labels like `Student Shell` and `Risk Explorer`, but the backend classifier and reply builder are deterministic and checkpoint-bound; tests assert bounded language and disclaimers
- Why it supports the issue: careful backend restraint exists, but capability framing can still exceed actual behavior
- Status: confirmed directly, with UX-overread risk partly inferred from naming
- Additional proof: moderated user testing on interpretation of feature names and disclaimers

### AM-006
- Exact files: `air-mentor-api/src/lib/msruas-proof-control-plane.ts`, `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`, `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts`, `air-mentor-api/src/lib/proof-control-plane-section-risk-service.ts`, `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts`, `air-mentor-api/src/lib/proof-control-plane-seeded-scaffolding-service.ts`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts`, `air-mentor-api/src/lib/proof-control-plane-stage-summary-service.ts`, `air-mentor-api/src/modules/academic.ts`, `air-mentor-api/src/modules/admin-proof-sandbox.ts`, `air-mentor-api/src/lib/proof-run-queue.ts`
- Exact symbols: `startProofSimulationRun`, `rebuildSimulationStagePlayback`, `buildStudentAgentCard`, `buildStudentRiskExplorer`, `startStudentAgentSession`, `sendStudentAgentMessage`, exported proof sandbox route registrar
- Exact routes/tables: proof dashboard/import/run/checkpoint routes; `simulation_runs`, `simulation_stage_checkpoints`, `risk_assessments`, `student_agent_cards`, `student_agent_sessions`, `student_agent_messages`
- Evidence: the main facade is now 4,079 lines even after preserving stable exports, while playback governance and seeded semester generation have moved into dedicated services; route modules still call into the facade for multiple user journeys
- Why it supports the issue: the proof platform’s most important logic is architecturally concentrated in one place
- Status: partially resolved but still directly evidenced
- Additional proof: change-frequency correlation showing unrelated proof features repeatedly co-changing in the same file

### AM-007
- Exact files: `air-mentor-api/src/modules/admin-structure.ts`, `air-mentor-api/src/lib/curriculum-linkage.ts`, `air-mentor-api/src/lib/curriculum-linkage-python.ts`, `air-mentor-api/scripts/curriculum_linkage_nlp.py`
- Exact symbols: linkage candidate regeneration and approval paths in `admin-structure.ts`, Python helper wrapper
- Exact routes/tables: `/api/admin/batches/:batchId/curriculum/bootstrap`, `/curriculum/linkage-candidates`, `curriculum_linkage_candidates`, graph tables, import tables
- Evidence: candidate generation depends on deterministic heuristics plus an optional Python/Ollama path; approval can trigger proof refresh behavior
- Why it supports the issue: this is a cross-runtime, partially nondeterministic subsystem with weaker test depth than core proof/session flows
- Status: confirmed directly
- Additional proof: automated quality scoring for approved vs rejected candidate sets and runtime-health metrics for the helper path

### AM-008
- Exact files: `.github/workflows/ci-verification.yml`, `.github/workflows/proof-browser-cadence.yml`, `src/startup-diagnostics.ts`, `src/telemetry.ts`, `air-mentor-api/src/startup-diagnostics.ts`, `air-mentor-api/src/lib/telemetry.ts`, runtime-wide absence of an external telemetry/exporter layer
- Exact symbols: repo-native operational events and startup diagnostics now exist, but there is still no Sentry/metrics exporter/tracing backend in the repo
- Exact routes/tables: audit-style persistence in `audit_events`; no general-purpose external metrics or event sink route
- Evidence: package manifests still contain no external observability SDK; CI and structured telemetry now exist inside the repo, but external runtime observability is still absent
- Why it supports the issue: the observability gap is evidenced by missing instrumentation surfaces across the repo
- Status: partially resolved; residual issue is directly evidenced by what is still absent
- Additional proof: production environment inventory confirming no external telemetry layer exists outside the repo

### AM-009
- Exact files: `src/ui-primitives.tsx`, `src/system-admin-ui.tsx`, `src/system-admin-live-app.tsx`, `src/App.tsx`, `src/pages/student-shell.tsx`, `src/pages/risk-explorer.tsx`
- Exact symbols: custom buttons, cards, tabs, surfaces, inline shell controls
- Exact routes/tables: frontend-only concern; no dedicated a11y service layer
- Evidence: large custom control layer and dense inline-style layouts remain; live keyboard regression, live axe/browser accessibility regression, and accessibility-tree assertions now exist; major proof tab rails now expose explicit `tablist` / `tab` / `aria-selected` semantics, but screen-reader-specific verification is still absent
- Why it supports the issue: accessibility and cognitive-load risks are structural and under-tested
- Status: partially resolved; live regression coverage now exists for keyboard and axe/browser checks, but manual assistive-technology validation is still not evidenced
- Additional proof: screen-reader walkthrough recordings or equivalent manual verification notes

### AM-010
- Exact files: tracked root prototype/PDF artifacts removed; local temp probe files now ignored
- Exact symbols: removed root drift artifacts plus ignored generated probes
- Exact routes/tables: these artifacts have no live-route role
- Evidence: the mock admin runtime path and the tracked root drift artifacts have been removed from the current tree, and CI now fails if those specific prototype/temp artifacts reappear
- Why it supports the issue: the repo surface materially exceeds the true runtime surface, and local scratch noise makes that even harder to interpret
- Status: resolved in the current working tree and no longer directly evidenced by tracked runtime-surface clutter
- Additional proof: n/a beyond keeping generated artifacts ignored

### AM-011
- Exact files: `air-mentor-api/src/lib/proof-run-queue.ts`, `air-mentor-api/src/app.ts`, `air-mentor-api/src/modules/admin-proof-sandbox.ts`, `scripts/system-admin-proof-risk-smoke.mjs`
- Exact symbols: `startProofRunWorker`, queue metadata builders, proof-run lifecycle routes
- Exact routes/tables: proof-run create/retry/activate/archive/recompute/restore; `simulation_runs`, `simulation_stage_checkpoints`, `simulation_lifecycle_audits`, `simulation_reset_snapshots`
- Evidence: queue worker uses poll/lease/heartbeat; proof dashboard now surfaces queue age, lease state, retry/failure, and checkpoint readiness, but missing checkpoints still often require smoke-script prewarm or manual route operations
- Why it supports the issue: queue correctness exists, but queue operability depends on code knowledge and scripts
- Status: partially resolved but still directly evidenced
- Additional proof: queue age/failure metrics or production incident history

### AM-012
- Exact files: `air-mentor-api/src/db/schema.ts`, `air-mentor-api/src/lib/json.ts`, `air-mentor-api/src/modules/academic.ts`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Exact files: `air-mentor-api/src/db/schema.ts`, `air-mentor-api/src/lib/json.ts`, `air-mentor-api/src/lib/proof-observed-state.ts`, `air-mentor-api/src/modules/academic.ts`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Exact symbols/tables: `academic_runtime_state`, `simulation_runs`, `student_agent_cards`, `risk_evidence_snapshots`, `student_observed_semester_states`, JSON parse/stringify helpers
- Exact routes: runtime sync endpoints and proof payload assemblers that read/write JSON-heavy records
- Evidence: many operationally important records are still serialized payload carriers instead of normalized relations, but authoritative-first bootstrap, compatibility-only runtime shadowing, and central observed-state decoding now reduce ad hoc merge/parsing drift
- Why it supports the issue: snapshot convenience is trading away inspectability and source-of-truth clarity
- Status: confirmed directly
- Additional proof: quantitative inventory of JSON-column read/write frequency by route

### AM-013
- Exact files: `air-mentor-api/scripts/run-vitest-suite.mjs`, root `package.json`, `.github/workflows/deploy-pages.yml`, `.github/workflows/deploy-railway-api.yml`, browser scripts in `scripts/`
- Exact symbols: `proofRcFiles` set in the backend runner; `verify:proof-closure*` and `verify:final-closeout*` scripts in root package
- Exact routes/tables: indirect; this issue is about detection paths rather than product routes
- Evidence: proof-heavy test files are intentionally excluded from the fast suite; non-deploy CI and scheduled browser/proof cadence now exist; `verify:final-closeout` and `verify:final-closeout:live` now encode the explicit local and deployed closeout bar
- Why it supports the issue: the green baseline is not equivalent to full product confidence
- Status: mostly resolved but residual issue remains directly evidenced
- Additional proof: CI run history showing whether proof-closure or proof-rc flows are regularly executed

### AM-014
- Exact files: `src/system-admin-live-app.tsx`, `air-mentor-api/src/modules/admin-requests.ts`, `scripts/system-admin-live-request-flow.mjs`
- Exact symbols: request detail handlers, request action routes, session-storage route restore, typed request-note flows
- Exact routes/tables: `/api/admin/requests*`, `admin_requests`, `admin_request_notes`, `admin_request_transitions`, `audit_events`
- Evidence: request workflow is a rigid backend state machine, and the live admin UI restores request-oriented route state plus deep links on reload
- Why it supports the issue: the system is operationally complete but cognitively process-heavy
- Status: confirmed directly
- Additional proof: user task-completion/error data for request progression

### AM-015
- Exact files: `vite.config.ts`, `src/system-admin-app.tsx`, `src/App.tsx`, `air-mentor-api/src/config.ts`, `.github/workflows/deploy-pages.yml`, `.github/workflows/deploy-railway-api.yml`, `air-mentor-api/railway.json`, `scripts/dev-live.sh`, `air-mentor-api/scripts/start-seeded-server.ts`
- Exact symbols: env-dependent app bootstrapping, Railway health verification, local-live proxy setup
- Exact routes/tables: `/health` is used by Railway post-deploy validation when configured
- Evidence: frontend runtime can hard-stop without API base URL; Railway deploy can no-op when env vars are missing; local-live path depends on same-origin proxying and seeded-server assumptions
- Why it supports the issue: environment drift becomes a first-order product failure mode
- Status: confirmed directly
- Additional proof: deployment environment inventory across staging/production

### AM-016
- Exact files: `air-mentor-api/src/modules/session.ts`, `air-mentor-api/src/app.ts`, `air-mentor-api/src/config.ts`, `air-mentor-api/src/lib/csrf.ts`, `air-mentor-api/src/startup-diagnostics.ts`
- Exact symbols: login, session restore, role switch, cookie config, origin checks, CSRF token builder, startup cookie/origin diagnostics
- Exact routes/tables: `/api/session/login`, `/api/session`, `/api/session/role-context`, `sessions`, `user_password_credentials`
- Evidence: login rate limiting and CSRF now exist, throttling state is now persisted in `login_rate_limit_windows`, production-like startup requires an explicit `CSRF_SECRET`, and cookie posture is environment-aware; the remaining gap is broader deployment hardening and dependency on deployment correctness
- Why it supports the issue: the session model is coherent but lightly hardened
- Status: partially resolved but still directly evidenced
- Additional proof: external WAF/reverse-proxy policies, if any, that mitigate abuse outside the repo

## Findings
### Evidence quality
- AM-001 through AM-007 and AM-011 through AM-016 are mostly direct-code issues.
- AM-008 and parts of AM-009 depend partly on absence evidence and therefore benefit most from environment or runtime confirmation outside the repo.

## Implications
- The issues are now evidence-anchored enough to support direct implementation specs.
- Remaining uncertainty is narrow and mostly about runtime frequency or operational history, not whether the issue exists.

## Recommendations
- Use this appendix as the common evidence layer for implementation planning, not as a replacement for the issue catalog.
- When an issue is fixed, update both the issue spec and this appendix so the evidence chain stays current.

## Confirmed facts vs inference
### Confirmed facts
- Every issue section above is backed by exact files, functions, routes, tables, tests, or tracked artifacts in the repo.

### Strongly supported inference
- The blast radius and user-trust consequences of some issues still depend on production frequency data that is not present in the repository.

## Cross-links
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [23 Implementation Spec AM-001](./23-implementation-spec-AM-001.md)
- [38 Implementation Spec AM-016](./38-implementation-spec-AM-016.md)
- [40 Risk Register And Migration Watchouts](./40-risk-register-and-migration-watchouts.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
