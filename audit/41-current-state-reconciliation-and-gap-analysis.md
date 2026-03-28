# AirMentor Current-State Reconciliation And Gap Analysis

## What this area does
This document reconciles the original audit pack against the current repository state as of 2026-03-28. It exists because the repo changed materially after the first forensic pass, which means some earlier findings are now resolved, some are only partially open, and several new implementation surfaces need to be represented explicitly in the audit set.

## Verified current baseline
- Verified commands in the current repository state:
  - `npm run lint`
  - `npm run build`
  - `npm test -- --reporter=dot`
  - `npm --workspace air-mentor-api run build`
  - `npm --workspace air-mentor-api test -- --reporter=dot`
  - `npm run inventory:compat-routes`
- Current hotspot sizes after the remediation work landed:
  - `src/App.tsx`: 4,257 LOC
  - `src/system-admin-live-app.tsx`: 7,205 LOC
  - `air-mentor-api/src/modules/academic.ts`: 3,862 LOC
  - `air-mentor-api/src/lib/msruas-proof-control-plane.ts`: 4,079 LOC
- Current extracted proof services:
  - `air-mentor-api/src/lib/proof-control-plane-access.ts`
  - `air-mentor-api/src/lib/proof-control-plane-batch-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-dashboard-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-policy-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-playback-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-section-risk-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-hod-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-seeded-scaffolding-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-stage-summary-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-tail-service.ts`
  - `air-mentor-api/src/lib/proof-observed-state.ts`

## Stage status
| Stage | Current status | Evidence | Remaining work |
| --- | --- | --- | --- |
| Stage 0: Guardrails and measurement | Complete enough to close the stage | `.github/workflows/ci-verification.yml`, `.github/workflows/proof-browser-cadence.yml`, startup diagnostics, frontend/backend telemetry, scheduled browser proof cadence, PR-blocking lint/build/test gates | External production observability stack is still absent, but the stage goals described in the remediation plan are now met repo-natively |
| Stage 1: Remove hidden restore behavior | Substantially complete | `src/portal-routing.ts`, `src/proof-playback.ts`, `src/App.tsx`, `src/system-admin-live-app.tsx`, restore/reset tests | Residual restore state still exists by design for identity and narrow admin route context |
| Stage 2: Split frontend shells first | Complete enough to close the stage | academic/session/sidebar/topbar/route shells and system-admin session/request/history/proof/faculties shells now exist | Root app files are still large and should keep shrinking, but the stage goal of real seams is met |
| Stage 3: Split backend route ownership | Complete enough to close the stage | `academic-bootstrap-routes.ts`, `academic-runtime-routes.ts`, `academic-proof-routes.ts`, `academic-admin-offerings-routes.ts`, `academic-access.ts` | `academic.ts` remains a large composition file |
| Stage 4: Decompose the proof control plane | Complete enough to close the repo-local stage | proof dashboard/access/batch/checkpoint/playback/playback-reset/playback-governance/policy/rebuild-context/section-risk/runtime/live-run/seeded-bootstrap/seeded-scaffolding/seeded-semester/seeded-run/stage-summary/tail services are extracted; the facade now mainly hosts stable exports and orchestration | `msruas-proof-control-plane.ts` is still large, but the remaining size is not hiding the original playback-governance or semester-generation monoliths anymore |
| Stage 5: Narrow contracts and normalize runtime + proof facts | Complete enough to close the repo-local stage | additive narrow task/task-placement/calendar routes exist; `/sync` wrappers are deprecated compatibility shims; narrow per-entity writes no longer update runtime shadow; bootstrap now ignores shadow-only task, placement, and calendar-audit extras once authoritative rows exist; faculty admin calendar publish/marker state is authoritative in `faculty_calendar_admin_workspaces`; `proof-observed-state.ts` now centralizes observed-state decoding across bootstrap and proof services | deprecated compatibility routes still remain intentionally until retirement preconditions are met, and immutable JSON snapshots remain by design for replay/audit |
| Stage 6: Security and integration hardening | Complete enough to close the repo-local stage | login throttling is now DB-backed through `login_rate_limit_windows`; CSRF tokens, startup diagnostics, additive `proofRefreshQueued` contract, degraded linkage queue handling, production-like secure-cookie defaults, and explicit `CSRF_SECRET` startup requirement are all in place | broader external edge hardening and deployment-topology-specific controls are still operational concerns, not missing repo code |
| Stage 7: Trust, accessibility, and cleanup | Complete enough to close the repo-local stage | explicit proof restore messaging, blocked-stage reasoning, queue diagnostics, live keyboard regression, live axe/browser accessibility regression, accessibility-tree assertions on critical live flows, proof tab rails now expose explicit tab semantics, mock-admin path removed, root artifact cleanup completed, repo hygiene CI guard added and widened, manual closeout checklist committed | deployed screen-reader/accessibility review remains a human-run release step rather than missing repo code |

## AM issue reconciliation
| Issue | Current status | Why |
| --- | --- | --- |
| AM-001 Monolithic runtime orchestrators | Partially resolved | Frontend shells and backend route modules were split, but the four main hotspots still remain large |
| AM-002 Split persistence model | Mostly resolved | `#/` no longer auto-enters remembered workspaces, restore state is explicit and resettable, but low-risk identity/route convenience state still remains |
| AM-003 Heavy bootstrap and coarse sync contracts | Mostly resolved | narrow task/task-placement/calendar routes exist, `/sync` routes are now deprecated compatibility shims, first-party runtime writes no longer use the generic runtime route, bootstrap stops merging shadow-only task/placement/calendar extras once authoritative rows exist, and compatibility-route caller inventory now reports no first-party runtime callers |
| AM-004 Scattered scope and authorization logic | Partially resolved | academic access is more centralized, but scope reasoning is still split across admin, frontend visibility, and proof layers |
| AM-005 Capability framing / proof UX trust | Mostly resolved | proof restore state, blocked-stage messaging, queue diagnostics, and the student-shell trust legend are clearer; remaining validation is now about deployed-user interpretation rather than missing repo-local surfaces |
| AM-006 Proof control-plane concentration | Mostly resolved | playback governance, seeded semester generation, and observed-state decoding are now extracted; the main façade is still large but is materially more orchestration-oriented |
| AM-007 Curriculum linkage brittleness | Partially resolved | approval now separates approval success from proof-refresh queue success, but the helper/integration path is still operationally brittle |
| AM-008 Testing/observability gaps | Partially resolved | CI gating, scheduled proof/browser runs, repo hygiene checks, diagnostics, and structured telemetry now exist; external runtime observability is still absent |
| AM-009 Accessibility and dense custom UI risk | Mostly resolved | live keyboard regression, live axe/browser accessibility regression, accessibility-tree assertions, and explicit proof-tab semantics now exist; remaining gap is screen-reader/manual validation rather than absent automation |
| AM-010 Repo drift and non-runtime clutter | Resolved | mock-admin runtime/tests/scripts were removed, root prototype/PDF/temp artifacts were removed, and temp probes are now ignored |
| AM-011 Proof queue operability | Partially resolved | proof dashboard now exposes queue age, lease state, failure/retry state, and checkpoint readiness; queue operations still rely heavily on internal knowledge and scripts |
| AM-012 Runtime/proof fact normalization | Partially resolved | authoritative-first bootstrap, compatibility-only shadow routes, faculty admin calendar normalization, and central observed-state decoding now exist; immutable replay snapshots still remain intentionally JSON-heavy |
| AM-013 Verification posture not equivalent to confidence | Mostly resolved | non-deploy CI and scheduled browser/proof cadence now exist; artifact freshness and some heavy-path cadence questions remain |
| AM-014 Restore/process complexity | Partially resolved | restore state is visible and resettable, but the request workflow and some admin process density still remain cognitively heavy |
| AM-015 Environment/startup fragility | Partially resolved | startup diagnostics, repo hygiene checks, and env-focused workflows exist, but deployment/runtime drift can still fail the product if configuration slips |
| AM-016 Auth/session hardening | Mostly resolved | CSRF tokens, DB-backed login throttling, auth telemetry, and explicit production-like CSRF-secret startup requirements exist; remaining hardening is mainly deployment-topology-specific |

## Resolved findings that were stale in the original audit
- `#/` is now neutral again. `src/portal-routing.ts` and `tests/portal-routing.test.ts` show that `#/` stays on `home` instead of auto-entering a stored workspace.
- CSRF is no longer “missing.” It now exists in:
  - `air-mentor-api/src/lib/csrf.ts`
  - `air-mentor-api/src/app.ts`
  - `air-mentor-api/src/modules/session.ts`
  - `src/api/client.ts`
  - `src/api/types.ts`
- Login throttling is no longer “missing” or process-local. It now exists in `air-mentor-api/src/modules/session.ts` with persistent buckets stored in `login_rate_limit_windows`.
- CI is no longer deploy-only. It now includes:
  - `.github/workflows/ci-verification.yml`
  - `.github/workflows/proof-browser-cadence.yml`
- `.github/workflows/ci-verification.yml` now also enforces a narrow repo-hygiene guard so the removed mock/prototype/temp artifacts cannot silently return.
- Mock-admin runtime surfaces are no longer in the repo. The following old evidence is stale:
  - `src/system-admin-mock-app.tsx`
  - `src/system-admin-mock-data.ts`
  - `tests/system-admin-mock-data.test.ts`
  - `scripts/system-admin-mock-acceptance.mjs`
  - `scripts/playwright-admin-mock-acceptance.sh`

## New repo surfaces that the original audit under-covered
- Frontend startup diagnostics and telemetry:
  - `src/startup-diagnostics.ts`
  - `src/telemetry.ts`
  - `tests/frontend-startup-diagnostics.test.ts`
  - `tests/frontend-telemetry.test.ts`
- Backend startup diagnostics and telemetry:
  - `air-mentor-api/src/startup-diagnostics.ts`
  - `air-mentor-api/src/lib/telemetry.ts`
  - `air-mentor-api/tests/startup-diagnostics.test.ts`
- Proof-control-plane service extraction:
  - `air-mentor-api/src/lib/proof-control-plane-access.ts`
  - `air-mentor-api/src/lib/proof-control-plane-batch-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-dashboard-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-hod-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-policy-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts`
  - `air-mentor-api/src/lib/proof-control-plane-tail-service.ts`
  - `air-mentor-api/src/lib/proof-observed-state.ts`
- Frontend shell decomposition:
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
  - `src/system-admin-scoped-registry-launches.tsx`
- Academic route ownership split:
  - `air-mentor-api/src/modules/academic-access.ts`
  - `air-mentor-api/src/modules/academic-bootstrap-routes.ts`
  - `air-mentor-api/src/modules/academic-runtime-routes.ts`
  - `air-mentor-api/src/modules/academic-proof-routes.ts`
  - `air-mentor-api/src/modules/academic-admin-offerings-routes.ts`
- New regression coverage:
  - `air-mentor-api/tests/academic-access.test.ts`
  - `air-mentor-api/tests/academic-runtime-narrow-routes.test.ts`
  - `air-mentor-api/tests/proof-control-plane-access.test.ts`
  - `air-mentor-api/tests/proof-control-plane-dashboard-service.test.ts`
  - `tests/proof-playback.test.ts`
  - `tests/system-admin-ui.test.tsx`
  - `tests/system-admin-proof-dashboard-workspace.test.tsx`
  - `scripts/playwright-admin-live-keyboard-regression.sh`
  - `scripts/system-admin-live-keyboard-regression.mjs`

## What is still not fully resolved
- Deprecated academic compatibility routes intentionally remain live:
  - `/api/academic/runtime/:stateKey`
  - `/api/academic/tasks/sync`
  - `/api/academic/task-placements/sync`
  - `/api/academic/calendar-audit/sync`
- `npm run inventory:compat-routes` now reports no first-party runtime callers. Remaining references are route registration, backend compatibility tests, the OpenAPI snapshot, and audit-pack documentation.
- Secure-cookie posture, allowed origins, and CSRF enforcement are now implemented repo-locally, but production correctness still depends on deployed configuration matching the startup assumptions.
- Accessibility automation is materially stronger, but screen-reader validation is still intentionally human-run.
- Repo-native diagnostics and telemetry now exist, but external production observability is still outside the repository boundary.

## Additional gaps the original audit did not model clearly enough
- The audit under-modeled the difference between “operator diagnostics now exist in-product” and “full observability is solved.” The new dashboard telemetry/diagnostics materially improve operability, but they are not the same as full production monitoring.
- The audit under-modeled the fact that accessibility is now partly enforced via both live keyboard regression and live axe/browser regression instead of being entirely absent.
- The audit under-modeled the current contract split for curriculum linkage approval. Approval now distinguishes `approvalSucceeded` from `proofRefreshQueued`, which is an important API and UX change for Stage 6.
- The audit under-modeled the closeout-verification surface itself. The repo now has deterministic closeout entrypoints:
  - `npm run verify:final-closeout`
  - `PLAYWRIGHT_APP_URL=<live-pages-url> PLAYWRIGHT_API_URL=<live-railway-url> npm run verify:final-closeout:live`
- The audit also under-modeled the runtime compatibility-retention policy: narrow authoritative writes are the first-party path, while the deprecated routes are now shim-only surfaces retained for safe retirement.

## Recommended next actions
1. Run `npm run verify:final-closeout` to keep the repo-local engineering and browser bar synchronized as one deterministic closeout suite.
2. Run `npm run inventory:compat-routes` and keep the output attached to the closeout evidence until deprecated-route retirement preconditions are satisfied.
3. Run `PLAYWRIGHT_APP_URL=<live-pages-url> PLAYWRIGHT_API_URL=<live-railway-url> npm run verify:final-closeout:live` against the deployed GitHub Pages + Railway stack.
4. Finish the remaining human-run accessibility validation work, especially screen-reader review of the highest-density proof and admin surfaces.
5. Keep the audit pack current by updating the core documents linked below whenever release-closeout evidence changes state.

## Cross-links
- [00 Executive Summary](./00-executive-summary.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [20 Repo Coverage Ledger](./20-repo-coverage-ledger.md)
- [21 Feature Inventory And Traceability Matrix](./21-feature-inventory-and-traceability-matrix.md)
- [22 Evidence Appendix By Issue](./22-evidence-appendix-by-issue.md)
- [42 Audit Navigation And Document Status](./42-audit-navigation-and-document-status.md)
