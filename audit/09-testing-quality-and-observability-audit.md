# AirMentor Testing Quality And Observability Audit

## What this area does
This document audits automated verification, seeded integration coverage, browser acceptance scripts, logging, monitoring, and quality-detection gaps.

## Confirmed observations
- Verified commands in the current repository state:
  - `npm test -- --reporter=dot`
  - `npm --workspace air-mentor-api test -- --reporter=dot`
  - `npm run build`
  - `npm --workspace air-mentor-api run build`
- Frontend tests cover:
  - API client contract behavior
  - repository behavior
  - portal routing
  - selectors and calendar utilities
  - proof page rendering
  - HoD/faculty proof surfaces
  - live admin data helpers
- Backend fast tests cover:
  - session routes
  - admin foundation and hierarchy
  - curriculum feature config
  - HTTP smoke
  - OpenAPI snapshot
  - proof risk model and evaluation helpers
  - policy phenotype logic
  - proof queue governance
  - academic bootstrap parity
  - HoD analytics
  - student shell and risk explorer
- `air-mentor-api/scripts/run-vitest-suite.mjs` codifies backend suite partitioning:
  - fast mode excludes `hod-proof-analytics.test.ts`, `risk-explorer.test.ts`, and `student-agent-shell.test.ts`
  - proof-heavy inclusion is controlled by `AIRMENTOR_BACKEND_SUITE=proof-rc`
  - child runs receive `AIRMENTOR_PROOF_RC`
- `air-mentor-api/tests/admin-control-plane.test.ts` contains proof-rc-gated skipped tests through `proofRcIt = process.env.AIRMENTOR_PROOF_RC === '1' ? it : it.skip`.
- Browser acceptance scripts exist but are not part of the default unit/integration commands:
  - `scripts/firefox-acceptance.mjs`
  - `scripts/system-admin-live-acceptance.mjs`
  - `scripts/system-admin-live-request-flow.mjs`
  - `scripts/system-admin-proof-risk-smoke.mjs`
  - `scripts/system-admin-teaching-parity-smoke.mjs`
- Additional live keyboard regression now exists:
  - `scripts/playwright-admin-live-keyboard-regression.sh`
  - `scripts/system-admin-live-keyboard-regression.mjs`
- Additional live accessibility regression now exists:
  - `scripts/playwright-admin-live-accessibility-regression.sh`
  - `scripts/system-admin-live-accessibility-regression.mjs`
- Root package scripts define a stronger integrated proof verification bar than the default commands:
  - `verify:proof-closure`
  - `verify:proof-closure:proof-rc`
  - `verify:proof-closure:live`
- CI posture is no longer deploy-only:
  - `.github/workflows/ci-verification.yml`
  - `.github/workflows/proof-browser-cadence.yml`
  - `.github/workflows/deploy-pages.yml`
  - `.github/workflows/deploy-railway-api.yml`

## Current-state reconciliation (2026-03-28)
- The original “deploy-only CI” finding is stale. The repo now has:
  - non-deploy lint/build/test gating in `.github/workflows/ci-verification.yml`
  - repo hygiene enforcement in `.github/workflows/ci-verification.yml` for removed prototype/temp artifacts
  - scheduled and `main`-merge proof/browser cadence in `.github/workflows/proof-browser-cadence.yml`
  - a live keyboard regression path for proof/admin restore and traversal
  - a live axe/browser accessibility regression path for portal, login, request detail, proof dashboard, dialog, and teacher proof flows
- The original “no structured observability surfaces” finding is also now incomplete. The repo now has:
  - frontend telemetry in `src/telemetry.ts`
  - backend telemetry in `air-mentor-api/src/lib/telemetry.ts`
  - local operational-event retention in `air-mentor-api/src/lib/operational-event-store.ts`
  - proof-dashboard surfacing of recent retained events in `air-mentor-api/src/lib/proof-control-plane-batch-service.ts` and `src/system-admin-proof-dashboard-workspace.tsx`
  - optional external telemetry sink forwarding in both telemetry modules
  - frontend startup diagnostics in `src/startup-diagnostics.ts`
  - backend startup diagnostics in `air-mentor-api/src/startup-diagnostics.ts`
  - Railway deploy preflight and live session-contract diagnostics in `.github/workflows/deploy-railway-api.yml`
  - coverage in `tests/frontend-telemetry.test.ts`, `tests/frontend-startup-diagnostics.test.ts`, `tests/system-admin-proof-dashboard-workspace.test.tsx`, `air-mentor-api/tests/client-telemetry.test.ts`, `air-mentor-api/tests/telemetry.test.ts`, `air-mentor-api/tests/admin-proof-observability.test.ts`, and `air-mentor-api/tests/startup-diagnostics.test.ts`
- The issue is narrower now. What remains open is production provisioning of an external sink, broader runtime analytics, and deeper operational failure-mode coverage beyond the current deploy preflight, retained local events, and log artifacts.

## Key workflows and contracts
### What automated tests currently validate
- Typed client URLs and query shapes.
- Core frontend utility determinism.
- Proof UI copy, section IDs, and bounded-language guarantees.
- Backend login, role switching, admin CRUD, and seeded academic bootstrap.
- Proof model determinism, support warnings, queue governance, and selected proof endpoints.
- HoD proof analytics and student shell / risk explorer access control.

### What the browser scripts validate
- Live admin happy-path CRUD for faculties, departments, branches, batches, terms, curriculum, admin search, faculty detail, and request progression.
- Request deep-link persistence and reload behavior.
- System-admin to teaching-workspace parity for edited faculty profile data.
- Seeded proof prewarm, checkpoint persistence, teacher proof panel, risk explorer, student shell, and HoD analytics.
- Keyboard traversal and proof restore/reset behavior in the live admin proof surface.
- `scripts/firefox-acceptance.mjs` validates an older local UX path with password `1234`, sidebar collapse/expand, calendar/timetable opening, queue history, and hard-reset development data. It is a legacy local smoke, not a live-stack proof or admin regression suite.
- The live-browser wrappers are also environment bootstrappers:
  - they can enter `nix develop`
  - build and preview the frontend
  - start the seeded backend
  - expect a Playwright browser bundle and seeded credentials

### What the current suite does not validate well
- Production observability behavior against a provisioned external telemetry backend because the repo now supports sink forwarding and local retained events but does not configure or operate the sink by itself.
- Full multi-user conflict behavior for storage-backed runtime slices.
- Screen-reader-oriented verification beyond the new keyboard and live axe/browser regression flows.
- End-to-end deployment wiring through GitHub Pages plus Railway.
- Degraded behavior when proof queues stall, OLLAMA is unavailable, or large admin loads slow down.
- CI freshness for tracked proof-risk evaluation artifacts in `air-mentor-api/output/proof-risk-model/`.

## Findings
### Testing strengths
- The seeded backend harness in `air-mentor-api/tests/helpers/test-app.ts` is substantial and materially improves confidence.
- The proof layer has better explicit guardrail tests than many AI-adjacent products.
- The acceptance scripts encode realistic business flows rather than only superficial smoke checks.

### Testing and observability weaknesses
- The strongest end-to-end flows are outside the default CI-facing commands.
- The skipped proof-rc coverage means the heaviest proof control plane scenarios are not always part of the fast baseline.
- There is now integrated repo-native telemetry, local operational-event retention, optional sink forwarding, startup diagnostics, and Railway deploy preflight/health capture, but there is still no provisioned analytics, tracing, or error-aggregation layer in the live environment.
- Deployment workflows can report success while skipping real deployment or post-deploy verification if Railway variables are missing or `RAILWAY_PUBLIC_API_URL` is unset.

## Implications
- **Engineering consequence:** test confidence is good for contracts and seeded route behavior, weaker for holistic browser UX and operational failure modes.
- **Operational consequence:** without a provisioned sink, the team still cannot reliably distinguish “the proof system is healthy but the UX is confusing” from “the proof system is silently degraded.”
- **Product consequence:** quality improvements are harder to prioritize because little production evidence is being collected.

## Recommendations
- Keep the new CI and proof-browser cadence workflows authoritative and make sure they stay green as the proof surfaces continue to split.
- Keep `verify:proof-closure` and `verify:proof-closure:proof-rc` aligned with the workflows so local and CI confidence bars do not drift.
- Provision the new sink-capable telemetry path into an external runtime telemetry stack before relying on production evidence for proof expansion; the repo-local retained-event surface is already useful, but it is not a substitute for production observability.
- Keep the new browser accessibility regression suite aligned with the live keyboard flow and extend it when new high-risk screens are added.
- Track proof-rc suite execution explicitly in CI rather than leaving the heavy proof flow mostly optional.
- Add freshness checks for tracked proof-risk evaluation artifacts so committed reports cannot silently drift from current code.

## Confirmed facts vs inference
### Confirmed facts
- The commands listed above passed.
- The proof-rc tests are conditionally skipped unless `AIRMENTOR_PROOF_RC=1`.
- The acceptance scripts described above exist and exercise the named flows.
- The repo now contains non-deploy verification workflows, repo-native telemetry, startup diagnostics, and a live keyboard regression path.
- `scripts/dev-live.sh`, `scripts/live-admin-common.sh`, and `air-mentor-api/scripts/start-seeded-server.ts` together define a seeded live-stack contract based on embedded Postgres, dynamic API-port allocation, deterministic academic seed time, and wall-clock session expiry.

### Reasonable inference
- The team is relying on seeded data and manual or script-driven browser acceptance to validate the most complex proof scenarios, because those scenarios are too heavy for the default fast suite.

## Cross-links
- [10 Performance Scalability And Reliability Audit](./10-performance-scalability-and-reliability-audit.md)
- [11 UX / UI Audit](./11-ux-ui-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
