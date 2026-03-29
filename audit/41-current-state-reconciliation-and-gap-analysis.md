# AirMentor Current-State Reconciliation And Gap Analysis

## What this area does
This document reconciles the original audit pack against the current repository state as of 2026-03-29. It exists because the repo changed materially after the first forensic pass, which means some earlier findings are now resolved, some are only partially open, and several new implementation surfaces need to be represented explicitly in the audit set.

## Verified current baseline
- Verified commands in the current repository state:
  - `npm run verify:final-closeout`
  - `npm run lint`
  - `npm run build`
  - `npm test -- --reporter=dot`
  - `npm --workspace air-mentor-api run build`
  - `npm --workspace air-mentor-api test -- --reporter=dot`
  - `npm run inventory:compat-routes`
- Repo-local closeout note for `2026-03-29`:
  - the first `verify:final-closeout` rerun on `2026-03-29` failed only in `scripts/system-admin-live-accessibility-regression.mjs` because the faculty-detail accessibility step was still running under an academic portal session
  - the harness was fixed to re-establish a system-admin session before that check
  - the failed step and the remaining local closeout steps were rerun successfully:
    - `npm run playwright:admin-live:accessibility-regression`
    - `npm run playwright:admin-live:keyboard-regression`
    - `npm run playwright:admin-live:session-security`
- Verified deployed closeout outcome against the GitHub Pages + Railway stack:
  - `verify:proof-closure:live` passed
  - live admin acceptance, request flow, teaching parity, accessibility regression, keyboard regression, and session-security all passed
  - the previously stale Railway API rollout was resolved on `2026-03-29` after the production service was given an explicit `CSRF_SECRET`
  - GitHub Actions deploy run `23694196459` completed successfully, `/health` is green, and the live login/session contract now returns `csrfToken` plus the `airmentor_csrf` cookie
- Repo-native operational telemetry is now retained locally and surfaced in the proof dashboard’s `Recent Operational Events` card.
- Compatibility-route inventory now has an assert mode, and the closeout scripts enforce that deprecated academic runtime routes have no first-party callers.
- The acceptance and request-flow browser scripts now emit structured JSON reports, and the Railway deploy workflow captures `railway up` stdout/stderr while using explicit health-mode verification.
- Current hotspot sizes after the remediation work landed:
  - `src/App.tsx`: 4,301 LOC
  - `src/system-admin-live-app.tsx`: 7,205 LOC
  - `air-mentor-api/src/modules/academic.ts`: 3,862 LOC
  - `air-mentor-api/src/lib/msruas-proof-control-plane.ts`: 4,108 LOC
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
| Stage 0: Guardrails and measurement | Complete enough to close the stage | `.github/workflows/ci-verification.yml`, `.github/workflows/proof-browser-cadence.yml`, `.github/workflows/deploy-railway-api.yml`, startup diagnostics, frontend/backend telemetry, local retained operational events, optional sink forwarding, scheduled browser proof cadence, and PR-blocking lint/build/test gates | External sink provisioning and live production monitoring are still operational tasks, but the stage goals described in the remediation plan are now met repo-natively |
| Stage 1: Remove hidden restore behavior | Substantially complete | `src/portal-routing.ts`, `src/proof-playback.ts`, `src/App.tsx`, `src/system-admin-live-app.tsx`, restore/reset tests | Residual restore state still exists by design for identity and narrow admin route context |
| Stage 2: Split frontend shells first | Complete enough to close the stage | academic/session/sidebar/topbar/route shells and system-admin session/request/history/proof/faculties shells now exist | Root app files are still large and should keep shrinking, but the stage goal of real seams is met |
| Stage 3: Split backend route ownership | Complete enough to close the stage | `academic-bootstrap-routes.ts`, `academic-runtime-routes.ts`, `academic-proof-routes.ts`, `academic-admin-offerings-routes.ts`, `academic-access.ts` | `academic.ts` remains a large composition file |
| Stage 4: Decompose the proof control plane | Complete enough to close the repo-local stage | proof dashboard/access/batch/checkpoint/playback/playback-reset/playback-governance/policy/rebuild-context/section-risk/runtime/live-run/seeded-bootstrap/seeded-scaffolding/seeded-semester/seeded-run/stage-summary/tail services are extracted; the facade now mainly hosts stable exports and orchestration | `msruas-proof-control-plane.ts` is still large, but the remaining size is not hiding the original playback-governance or semester-generation monoliths anymore |
| Stage 5: Narrow contracts and normalize runtime + proof facts | Complete enough to close the repo-local stage | additive narrow task/task-placement/calendar routes exist; `/sync` wrappers are deprecated compatibility shims; narrow per-entity writes no longer update runtime shadow; bootstrap now ignores shadow-only task, placement, and calendar-audit extras once authoritative rows exist; faculty admin calendar publish/marker state is authoritative in `faculty_calendar_admin_workspaces`; `proof-observed-state.ts` now centralizes observed-state decoding across bootstrap and proof services | deprecated compatibility routes still remain intentionally until retirement preconditions are met, and immutable JSON snapshots remain by design for replay/audit |
| Stage 6: Security and integration hardening | Complete enough to close the repo-local stage | login throttling is now DB-backed through `login_rate_limit_windows`; CSRF tokens, startup diagnostics, additive `proofRefreshQueued` contract, degraded linkage queue handling, production-like secure-cookie defaults, and explicit `CSRF_SECRET` startup requirement are all in place; the local session-security closeout now passes | broader external edge hardening and deployment-topology-specific controls are still operational concerns, and the live Railway deployment is currently stale because the latest rollout never became healthy |
| Stage 7: Trust, accessibility, and cleanup | Complete enough to close the repo-local stage | explicit proof restore messaging, blocked-stage reasoning, queue diagnostics, recent operational events, live keyboard regression, live axe/browser accessibility regression, accessibility-tree assertions on critical live flows, a generated screen-reader preflight transcript, proof tab rails now expose explicit tab semantics, mock-admin path removed, root artifact cleanup completed, repo hygiene CI guard added and widened, manual closeout checklist committed; the live Pages proof/admin browser flows now pass against the deployed stack | deployed screen-reader/accessibility review remains a human-run release step rather than missing repo code |

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
| AM-008 Testing/observability gaps | Mostly resolved | CI gating, scheduled proof/browser runs, repo hygiene checks, diagnostics, structured telemetry, retained local operational events, proof-dashboard surfacing, optional sink forwarding, and Railway deploy diagnostics now exist; the remaining gap is provisioning and operating the sink in production |
| AM-009 Accessibility and dense custom UI risk | Mostly resolved | live keyboard regression, live axe/browser accessibility regression, accessibility-tree assertions, explicit proof-tab semantics, modal focus coverage, and the generated screen-reader preflight transcript now exist; remaining gap is the final human assistive-tech pass rather than absent automation |
| AM-010 Repo drift and non-runtime clutter | Resolved | mock-admin runtime/tests/scripts were removed, root prototype/PDF/temp artifacts were removed, and temp probes are now ignored |
| AM-011 Proof queue operability | Partially resolved | proof dashboard now exposes queue age, lease state, failure/retry state, checkpoint readiness, and recent operational events; queue operations still rely heavily on internal knowledge and scripts |
| AM-012 Runtime/proof fact normalization | Partially resolved | authoritative-first bootstrap, compatibility-only shadow routes, faculty admin calendar normalization, and central observed-state decoding now exist; immutable replay snapshots still remain intentionally JSON-heavy |
| AM-013 Verification posture not equivalent to confidence | Mostly resolved | non-deploy CI and scheduled browser/proof cadence now exist; the repo-local bar is green, compatibility-route inventory is asserted clean, and the live closeout bar is now green against the deployed stack |
| AM-014 Restore/process complexity | Partially resolved | restore state is visible and resettable, but the request workflow and some admin process density still remain cognitively heavy |
| AM-015 Environment/startup fragility | Partially resolved | startup diagnostics, repo hygiene checks, env-focused workflows, deploy-log capture, and readiness-health checks exist; deployment/runtime drift can still fail the product if configuration slips, but the stale Railway rollout was resolved on `2026-03-29` |
| AM-016 Auth/session hardening | Mostly resolved | CSRF tokens, DB-backed login throttling, auth telemetry, and explicit production-like CSRF-secret startup requirements exist; both repo-local and live session-security checks are now green |

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
- The deprecated compatibility routes now also emit HTTP deprecation signals:
  - `Deprecation: true`
  - `Sunset: 2026-12-31T00:00:00Z`
  - `X-AirMentor-Compatibility-Route: true`
  - successor `Link` headers on the legacy `/sync` endpoints
- The repo-local closeout bar is now green, but the live closeout bar is not fully green because the latest Railway deployment on `main` never became healthy and the deployed API is still serving an older login/session contract without `csrfToken` or the `airmentor_csrf` cookie.
- Secure-cookie posture, allowed origins, and CSRF enforcement are now implemented repo-locally, but production correctness still depends on deployed configuration matching the startup assumptions.
- Accessibility automation is materially stronger, and the live accessibility regression now leaves a screen-reader preflight transcript, but final screen-reader validation is still intentionally human-run.
- The live keyboard regression now records structured proof/admin focus evidence in `output/playwright/system-admin-live-keyboard-regression-report.json`, including modal focus-trap and focus-restore coverage.
- Repo-native diagnostics and telemetry now exist, and sink forwarding is now available repo-locally, but provisioning and operating an external production sink is still outside the repository boundary.

## Additional gaps the original audit did not model clearly enough
- The audit under-modeled the difference between “operator diagnostics now exist in-product” and “full observability is solved.” The new dashboard telemetry/diagnostics, sink forwarding, and Railway deploy diagnostics materially improve operability, but they are not the same as a provisioned production monitoring program.
- The audit under-modeled the fact that accessibility is now partly enforced via both live keyboard regression and live axe/browser regression instead of being entirely absent.
- The audit under-modeled the current contract split for curriculum linkage approval. Approval now distinguishes `approvalSucceeded` from `proofRefreshQueued`, which is an important API and UX change for Stage 6.
- The audit under-modeled the closeout-verification surface itself. The repo now has deterministic closeout entrypoints:
  - `npm run verify:final-closeout`
  - `PLAYWRIGHT_APP_URL=<live-pages-url> PLAYWRIGHT_API_URL=<live-railway-url> npm run verify:final-closeout:live`
- The audit also under-modeled the runtime compatibility-retention policy: narrow authoritative writes are the first-party path, while the deprecated routes are now shim-only surfaces retained for safe retirement.

## Recommended next actions
1. Keep `npm run verify:final-closeout` as the deterministic repo-local release bar; it is now the clean local evidence baseline.
2. Keep `npm run inventory:compat-routes` attached to the closeout evidence until deprecated-route retirement preconditions are satisfied.
3. Keep the Railway production variable audit in place as a release checklist item:
   - keep an explicit `CSRF_SECRET`
   - keep `CORS_ALLOWED_ORIGINS=https://raed2180416.github.io`
   - keep `SESSION_COOKIE_SECURE=true`
   - keep `SESSION_COOKIE_SAME_SITE=none`
   - keep `DATABASE_URL` valid
   - keep `HOST` unset or `0.0.0.0`
4. Keep rerunning `PLAYWRIGHT_APP_URL=<live-pages-url> PLAYWRIGHT_API_URL=<live-railway-url> AIRMENTOR_LIVE_STACK=1 npm run verify:final-closeout:live` as the deployed closeout bar after any production-affecting change.
5. Finish the remaining human-run accessibility validation work, using the generated `output/playwright/system-admin-live-screen-reader-preflight.md` artifact to drive the final screen-reader review of the highest-density proof and admin surfaces.
6. Keep deprecated compatibility routes in inventory/assert mode until retirement preconditions are satisfied, but do not remove them early.

## Cross-links
- [00 Executive Summary](./00-executive-summary.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [20 Repo Coverage Ledger](./20-repo-coverage-ledger.md)
- [21 Feature Inventory And Traceability Matrix](./21-feature-inventory-and-traceability-matrix.md)
- [22 Evidence Appendix By Issue](./22-evidence-appendix-by-issue.md)
- [42 Audit Navigation And Document Status](./42-audit-navigation-and-document-status.md)
