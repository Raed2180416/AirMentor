# AirMentor Forensic Executive Summary

## What this area does
This document summarizes what AirMentor is trying to be, what the codebase currently delivers, where the highest-risk gaps live, and which changes should happen first. It is based on code, tests, configs, migrations, scripts, seeds, and CI. Existing prose documentation was intentionally excluded because the current repository explicitly treats it as stale.

## Confirmed observations
- AirMentor is a dual-portal product: an academic teaching workspace rooted in `src/App.tsx` and a system-admin control plane rooted in `src/system-admin-live-app.tsx` and `src/system-admin-app.tsx`.
- The frontend is a Vite/React application with a typed API client in `src/api/client.ts`, shared contracts in `src/api/types.ts`, hash-based routing in `src/portal-routing.ts`, and repository abstraction in `src/repositories.ts`.
- The backend is a Fastify application assembled in `air-mentor-api/src/app.ts` from ten route modules, with Drizzle schema definitions in `air-mentor-api/src/db/schema.ts`.
- The proof and AI layer is not a generic conversational AI stack. It is a hybrid system composed of deterministic academic rules, observable-risk model artifacts, deterministic monitoring heuristics, graph-aware curriculum summaries, queue governance rules, seeded simulation, and bounded faculty-facing proof UIs. The main orchestration lives in `air-mentor-api/src/lib/msruas-proof-control-plane.ts`.
- The deterministic operating surface is larger than the earlier summary made explicit. Portal auto-routing, request transitions, session keepalive/default-role behavior, timetable lock windows, queue thresholds, probability-display suppression, and proof-playback fallback behavior are all hard-coded. Those rules are enumerated in [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md).
- Verified baseline from the current repository state:
  - `npm run verify:final-closeout` now passes repo-locally.
  - `npm test -- --reporter=dot` passed across 18 frontend test files and 72 tests.
  - `npm --workspace air-mentor-api test -- --reporter=dot` passed the fast backend suite across 19 backend test files.
  - `npm run build` passed.
  - `npm --workspace air-mentor-api run build` passed.

## Current-state reconciliation (2026-03-29)
- The repo is no longer in the same state as the original forensic pass. The authoritative current-state reconciliation is [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md).
- Four original audit claims are now materially outdated:
  - `#/` no longer auto-enters stored workspaces; `src/portal-routing.ts` now keeps `#/` on `home`.
  - non-deploy CI and scheduled proof/browser verification now exist in `.github/workflows/ci-verification.yml` and `.github/workflows/proof-browser-cadence.yml`.
  - explicit CSRF tokens and login throttling now exist in `air-mentor-api/src/app.ts` and `air-mentor-api/src/modules/session.ts`, and production-like startup now hard-fails if `CSRF_SECRET` is missing.
  - the Railway deploy workflow is no longer a blind `railway up`; it now runs a Railway variable preflight, exercises the configured `preDeployCommand` plus startup path against an embedded Postgres smoke environment, can probe the live login/session contract, and uploads failure diagnostics when deploys still fail.
  - the mock-admin runtime path and the root-level prototype/temp/PDF artifacts called out in AM-010 have now been removed; remaining repo-noise pressure is limited to ignored/generated outputs rather than tracked runtime confusion.
- Operational closeout is now narrower than the original audit implied:
  - the repo-local closeout suite is green
  - the live GitHub Pages browser flows are green
  - the live Railway session-security bar is now green as well after the production service was given an explicit `CSRF_SECRET` and GitHub Actions run `23694196459` completed successfully
  - the remaining closeout work is now manual accessibility / UX signoff and compatibility-route retirement governance rather than a live deployment blocker
- Repo-native operational telemetry is now retained locally and surfaced in the proof dashboard’s `Recent Operational Events` card, so the repo now explains more failure modes without requiring an external sink.
- Compatibility-route inventory now has an assert mode and is enforced by the final closeout scripts, so first-party callers for the deprecated academic runtime routes stay explicitly zero.
- The acceptance and request-flow browser scripts now emit structured JSON reports, and the Railway deploy workflow now captures `railway up` stdout/stderr while using the readiness script’s explicit health mode.
- Accessibility coverage is no longer only implicit: tab semantics, modal focus-trap/restore, and the critical admin/proof tab rails are now directly covered by tests.
- The hotspot risk is reduced but not closed. The major files are smaller than during the initial pass, and route/shell/service extraction has landed, but the main orchestrators still remain large:
  - `src/App.tsx` at 4,301 LOC
  - `src/system-admin-live-app.tsx` at 7,205 LOC
  - `air-mentor-api/src/modules/academic.ts` at 3,862 LOC
  - `air-mentor-api/src/lib/msruas-proof-control-plane.ts` at 4,108 LOC

## Key workflows and contracts
| Area | Confirmed contract |
| --- | --- |
| Portal selection | `src/portal-entry.tsx` and `src/portal-routing.ts` choose between home, academic, and admin hash routes, and `#/` now stays neutral on `home` unless the user explicitly navigates into a workspace. |
| Academic runtime | `src/App.tsx` and `src/repositories.ts` hydrate backend bootstrap data, persist runtime edits, and coordinate faculty role context, task state, calendar state, and proof playback. |
| System admin | `src/system-admin-live-app.tsx` loads broad admin datasets, request detail, proof dashboard, faculty calendars, and route snapshots into one client runtime. |
| Session/auth | `air-mentor-api/src/modules/session.ts` issues cookie sessions, resolves `request.auth` across the app, keeps sessions alive through `GET /api/session`, exposes constrained role-switching, and restores UI preferences. |
| Institutional control plane | `air-mentor-api/src/modules/institution.ts`, `people.ts`, `students.ts`, `courses.ts`, `admin-structure.ts`, and `admin-requests.ts` manage the institution graph and operating workflows. |
| Proof operations | `air-mentor-api/src/modules/admin-proof-sandbox.ts`, `academic.ts`, `proof-run-queue.ts`, and `msruas-proof-control-plane.ts` handle proof import, validation, run lifecycle, playback checkpoints, HoD analytics, risk explorer, and student shell. |

## Findings
### Overall assessment
AirMentor has a strong product core. The repository shows a clear institutional use case, unusually rich seeded domain data, typed client-server contracts, seeded backend integration tests, and a proof subsystem that is more disciplined than its UI language first suggests. The strongest work is the domain modeling and the insistence on deterministic boundaries around faculty-facing proof explanations.

The weakest part of the implementation is structural concentration. Four files carry a disproportionate amount of product behavior:
- `src/App.tsx`
- `src/system-admin-live-app.tsx`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`

That concentration creates most of the downstream problems: hard-to-predict cross-file effects, hidden route and storage state, duplicated scope logic, expensive bootstrap and sync flows, and a high change-failure rate for any feature that crosses UI, backend, and proof layers.

### Strongest aspects of the current implementation
- The product intent is legible from code, seeds, and tests. This is not a generic ERP or chatbot. It is an academic operations product with explicit faculty roles, governance, proof playback, and intervention workflows.
- The backend uses typed schemas, consistent version checks, and route-level role enforcement helpers in `air-mentor-api/src/modules/support.ts`.
- The proof layer is explicit about deterministic boundaries. Tests in `air-mentor-api/tests/student-agent-shell.test.ts`, `air-mentor-api/tests/risk-explorer.test.ts`, `tests/student-shell.test.tsx`, and `tests/risk-explorer.test.tsx` assert disclaimers, guardrails, and the absence of free-form “AI says” behavior.
- The seeded test harness in `air-mentor-api/tests/helpers/test-app.ts` is materially useful. It exercises the real Fastify app against an embedded Postgres instance instead of mocking the whole system.

### Weakest aspects of the current implementation
- Runtime orchestration is oversized and coupled across UI, storage, role context, proof playback, and data fetches. This is the main maintainability problem. See `AM-001`, `AM-003`, and `AM-012` in [Issue catalog](./15-issue-catalog-prioritized.md).
- The client persistence model is split across backend state, local storage, session storage, and in-memory React state. This creates hidden state and makes route reload behavior hard to reason about. See `AM-002` and `AM-014`.
- The proof platform is sophisticated, but its orchestration is concentrated in one 12k-line engine and a second 6k-line route module. That is a major long-term correctness and onboarding risk. See `AM-006`.
- External observability is no longer absent repo-locally. The repo now supports optional telemetry sink forwarding and deploy-failure diagnostics, but it still does not provision or operate a production sink, user-flow analytics layer, or full error aggregation stack by itself. See `AM-008`.

## Implications
- **User trust risk:** the proof UIs are careful, but surrounding UX can still feel opaque because checkpoint selection, role switching, route restoration, and hidden persisted state shape what the user sees without always explaining why.
- **Correctness risk:** large orchestrator files and coarse sync APIs raise the likelihood of regressions that remain type-safe but still break user flows or overwrite runtime state.
- **Maintainability risk:** the repo is operating successfully now because the domain is encoded deeply in a few places, not because the architecture makes change safe.
- **ML quality risk:** the model layer is more constrained than a typical AI feature, which is good for safety, but the product still lacks evaluation telemetry, online monitoring, and a clean separation between deterministic rules, derived heuristics, and trained outputs.

## Recommendations
1. Keep `npm run verify:final-closeout` as the deterministic repo-local release bar.
2. Keep `PLAYWRIGHT_APP_URL=<live-pages-url> PLAYWRIGHT_API_URL=<live-railway-url> AIRMENTOR_LIVE_STACK=1 npm run verify:final-closeout:live` as the deployed confidence bar.
3. Keep compatibility routes on a retirement path, but do not remove them until caller inventory is empty and release-cycle evidence is green.
4. Complete the remaining human-run screen-reader and product-intent/UX checks recorded in the audit pack.
5. Provision the telemetry sink path and keep the new Railway deploy diagnostics active in production before materially expanding the proof feature set.

## Confirmed facts vs inference
### Confirmed facts
- The active portals, routes, schemas, tests, and proof flows described above are present in code.
- The mock-admin runtime path no longer exists in the repo, and the root-level prototype/temp/PDF artifacts previously called out in AM-010 have been removed. Remaining local repo noise is now limited to ignored/generated outputs such as browser logs or helper bytecode rather than tracked product-surface confusion.
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts` and `src/system-admin-live-app.tsx` remain the dominant implementation hotspots by size and responsibility, but they now sit alongside newly extracted shell/route/service modules.

### Reasonable inference
- The team is using the seeded MSRUAS dataset as both a proof showcase and a regression harness, not just as fixture data.
- The architecture likely evolved by repeatedly extending working surfaces instead of extracting subsystems once those surfaces succeeded. The code shape strongly suggests accretion rather than greenfield modular design.

## Cross-links
- [01 Product Intent And User Experience Overview](./01-product-intent-and-user-experience-overview.md)
- [02 System Architecture Overview](./02-system-architecture-overview.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [14 Cross-File Cross-System Issue Map](./14-cross-file-cross-system-issue-map.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [17 Non-Technical Explanation For Stakeholders](./17-non-technical-explanation-for-stakeholders.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
- [42 Audit Navigation And Document Status](./42-audit-navigation-and-document-status.md)
