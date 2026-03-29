# AirMentor Repo Coverage Ledger

## What this area does
This ledger proves repository coverage. It records each major folder or file family, its purpose, whether it is active runtime, test-only, tooling, prototype, mock, temp, or dead artifact, whether it was fully reviewed during the forensic pass, and which issue IDs are linked to it.

## Confirmed observations
- The active runtime is concentrated in `src/` and `air-mentor-api/src/`.
- The repo also contains meaningful non-runtime surfaces:
  - browser automation and local-live bootstrappers in `scripts/`
  - backend bootstrappers and offline evaluators in `air-mentor-api/scripts/`
  - CI verification, cadence, and deploy workflows in `.github/workflows/`
  - tracked output and stray artifacts at the repo root and `air-mentor-api/output/`
- Existing audit documents covered most major domains, but this ledger closes the “did you even inspect X?” gap.

## Current-state reconciliation (2026-03-28)
- This ledger predates several structural and operational changes.
- The most important current corrections are:
  - CI is no longer deploy-only; `.github/workflows/ci-verification.yml` and `.github/workflows/proof-browser-cadence.yml` now exist.
  - `.github/workflows/ci-verification.yml` now also contains a repo-hygiene guard for removed prototype/temp artifacts.
  - the mock-admin runtime/tests/scripts are no longer present in the repo and should no longer be listed as active mock surfaces.
  - frontend and backend shell/route/service extraction created new active runtime files that now deserve explicit coverage.
  - startup diagnostics and telemetry now exist in both frontend and backend code.
- See [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md) for the exact status table and uncovered surfaces.

## Key workflows and contracts
| Path | Purpose | Classification | Fully reviewed | High-level findings | Linked issues |
| --- | --- | --- | --- | --- | --- |
| `/home/raed/projects/air-mentor-ui/package.json` | Frontend workspace scripts and integrated verification entrypoints | Tooling | Yes | `verify:proof-closure*` scripts encode the real proof verification bar; browser Playwright entrypoints are first-class | `AM-013`, `AM-015` |
| `/home/raed/projects/air-mentor-ui/vite.config.ts` | Frontend build, proxy, chunking | Active runtime/tooling | Yes | Live mode depends on `VITE_AIRMENTOR_API_BASE_URL` and optional proxy target; config drift is user-visible quickly | `AM-003`, `AM-015` |
| `/home/raed/projects/air-mentor-ui/src/App.tsx` | Academic runtime shell and teaching workspace orchestration | Active runtime | Yes | 4,257 LOC hotspot; much thinner than before, but still large and still composes auth, bootstrap, route, and proof state | `AM-001`, `AM-002`, `AM-003`, `AM-005` |
| `/home/raed/projects/air-mentor-ui/src/system-admin-live-app.tsx` | System-admin live control plane shell | Active runtime | Yes | 7,199 LOC hotspot; route/workspace extraction landed, but the live admin root is still large | `AM-001`, `AM-002`, `AM-014` |
| `/home/raed/projects/air-mentor-ui/src/academic-session-shell.tsx` and related academic workspace shells | Academic route/session shell decomposition | Active runtime | Yes | New shell layer now owns session gating, top bar, sidebar, route surface, and route-page composition outside `App.tsx` | `AM-001`, `AM-009` |
| `/home/raed/projects/air-mentor-ui/src/system-admin-session-shell.tsx`, `/home/raed/projects/air-mentor-ui/src/system-admin-proof-dashboard-workspace.tsx`, `/home/raed/projects/air-mentor-ui/src/system-admin-request-workspace.tsx`, `/home/raed/projects/air-mentor-ui/src/system-admin-history-workspace.tsx`, `/home/raed/projects/air-mentor-ui/src/system-admin-hierarchy-workspace-shell.tsx`, `/home/raed/projects/air-mentor-ui/src/system-admin-faculties-workspace.tsx` | System-admin shell/workspace decomposition | Active runtime | Yes | New workspace boundaries reduce the amount of route/proof/request UI still owned directly by `system-admin-live-app.tsx` | `AM-001`, `AM-009`, `AM-014` |
| `/home/raed/projects/air-mentor-ui/src/repositories.ts` | Local/HTTP repository abstraction and browser persistence | Active runtime | Yes | Hybrid local-first and backend-first persistence remains active; storage keys and sync behavior are central to hidden-state issues | `AM-002`, `AM-003` |
| `/home/raed/projects/air-mentor-ui/src/proof-playback.ts` | Proof checkpoint persistence | Active runtime | Yes | Small file, but high-trust behavior; playback selection is storage-backed and participates in fallback/reset logic | `AM-002`, `AM-005` |
| `/home/raed/projects/air-mentor-ui/src/system-admin-live-data.ts` | Admin selectors, visibility, search shaping | Active runtime | Yes | Scope and visibility logic lives partly here instead of one centralized policy layer | `AM-004`, `AM-014` |
| `/home/raed/projects/air-mentor-ui/src/pages/` | Academic route-level page components | Active runtime | Yes | Student shell, risk explorer, HoD view, calendar, workflow, and course detail all traced end-to-end | `AM-001`, `AM-005`, `AM-009` |
| `/home/raed/projects/air-mentor-ui/src/system-admin-faculty-calendar-workspace.tsx` | Admin view of faculty calendar/timetable | Active runtime | Yes | Intentionally constrained compared with teaching workspace; uses lock-window semantics | `AM-005`, `AM-014` |
| `/home/raed/projects/air-mentor-ui/src/system-admin-timetable-editor.tsx` | Admin timetable editor | Active runtime | Yes | 14-day direct-edit window and lock semantics are hard-coded here | `AM-004`, `AM-014` |
| `/home/raed/projects/air-mentor-ui/src/system-admin-ui.tsx` | Admin-specific primitives and shells | Active runtime | Yes | Dense custom control layer; contributes to accessibility and consistency debt | `AM-009` |
| `/home/raed/projects/air-mentor-ui/src/ui-primitives.tsx` | Shared UI primitives | Active runtime | Yes | Large custom primitive surface, limited accessibility-specific test coverage | `AM-009` |
| `/home/raed/projects/air-mentor-ui/src/portal-entry.tsx` and `/home/raed/projects/air-mentor-ui/src/portal-routing.ts` | Portal selector and hash routing | Active runtime | Yes | `#/` is neutral again; workspace hints no longer auto-enter the portal | `AM-002`, `AM-005` |
| `/home/raed/projects/air-mentor-ui/src/data.ts`, `/home/raed/projects/air-mentor-ui/src/domain.ts`, `/home/raed/projects/air-mentor-ui/src/selectors.ts`, `/home/raed/projects/air-mentor-ui/src/calendar-utils.ts`, `/home/raed/projects/air-mentor-ui/src/page-utils.ts` | Local domain model, selectors, utilities | Active runtime/transitional | Yes | Still influence backend parity seed generation and local-mode behavior; not purely historical | `AM-002`, `AM-003`, `AM-013` |
| `/home/raed/projects/air-mentor-ui/src/system-admin-app.tsx` | Live admin app wrapper and env gate | Active runtime | Yes | Emits startup telemetry and still hard-fails without API base URL; live admin is no longer mock-first | `AM-015` |
| `/home/raed/projects/air-mentor-ui/src/startup-diagnostics.ts`, `/home/raed/projects/air-mentor-ui/src/telemetry.ts`, `/home/raed/projects/air-mentor-ui/air-mentor-api/src/startup-diagnostics.ts`, `/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/telemetry.ts` | Startup diagnostics and repo-native telemetry | Active runtime/tooling | Yes | New operational surface for auth, bootstrap, proof-run lifecycle, linkage failures, and env diagnostics | `AM-008`, `AM-015`, `AM-016` |
| `/home/raed/projects/air-mentor-ui/tests/` | Frontend unit/render tests | Test-only | Yes | Contract/render coverage is stronger than before and now includes proof playback restore messaging, proof dashboard diagnostics, startup diagnostics, and telemetry | `AM-002`, `AM-005`, `AM-008`, `AM-009`, `AM-013` |
| `/home/raed/projects/air-mentor-ui/scripts/` | Browser automation and local-live helpers | Tooling | Yes | Encodes real product paths, seeded credentials, proof prewarm behavior, environment assumptions, live keyboard regression, and live axe/browser accessibility regression | `AM-009`, `AM-011`, `AM-013`, `AM-015` |
| `/home/raed/projects/air-mentor-ui/.github/workflows/` | GitHub Actions verification and deployment automation | Tooling | Yes | Now includes non-deploy CI gating, repo hygiene enforcement, and scheduled proof/browser cadence in addition to deploy workflows | `AM-008`, `AM-010`, `AM-013`, `AM-015` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/package.json` | Backend scripts and suite partitioning | Tooling | Yes | Backend test partitioning is explicit in package scripts; `dev:seeded` is a first-class path | `AM-011`, `AM-013`, `AM-015` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/app.ts`, `/home/raed/projects/air-mentor-ui/air-mentor-api/src/config.ts`, `/home/raed/projects/air-mentor-ui/air-mentor-api/src/index.ts` | Backend assembly, config, process lifecycle | Active runtime | Yes | Origin enforcement, cookie behavior, worker lifecycle, and env defaults are all here | `AM-004`, `AM-011`, `AM-015`, `AM-016` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/modules/` | Route modules | Active runtime | Yes | Route ownership is now split more explicitly across `academic-*.ts` modules plus `academic-access.ts`; `academic.ts` remains a large composition root | `AM-001` through `AM-016` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/` | Backend domain libraries, proof engines, helpers | Active runtime | Yes | Proof engine concentration is reduced by extracted access, batch, checkpoint, dashboard, HoD, live-run, runtime, and tail services, but the main proof façade is still large | `AM-004`, `AM-006`, `AM-007`, `AM-011`, `AM-012` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/msruas-curriculum-compiler.ts` | Base curriculum XLSX parser and compiler | Tooling | Yes | Converts human-readable Excel syllabus to AI proof graph. Contains extreme rigid hardcodes and local paths. Needs extraction. | `AM-013` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/academic-provisioning.ts` | Deterministic faculty timetable generator | Active runtime | Yes | Tetris-slots teaching loads into a fixed 6-slot daily grid using pseudo-random hashing. Has fragile string heuristics. | `AM-004` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/db/schema.ts` | Database model | Active runtime | Yes | 1,384 LOC schema; table families mapped and traced to features/issues | `AM-003`, `AM-012` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/db/migrations/` | Schema evolution history | Tooling/runtime history | Yes | Migration chain confirms staged growth from admin CRUD to runtime, proof, queueing, and linkage | `AM-003`, `AM-012` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/src/db/seeds/` and `/home/raed/projects/air-mentor-ui/air-mentor-api/src/db/seed.ts` | Seed data and seed loader | Tooling/test/runtime bootstrap | Yes | Seeded MSRUAS and platform data materially shape tests, demos, and local-live behavior | `AM-005`, `AM-011`, `AM-013` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/tests/` | Backend integration/unit tests | Test-only | Yes | Strong seeded integration harness; proof-heavy files are partitioned from the fast suite | `AM-004`, `AM-005`, `AM-011`, `AM-013`, `AM-016` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/tests/helpers/test-app.ts` | Embedded Postgres test harness | Test-only/tooling | Yes | Critical evidence source; creates real app + DB rather than mocks | `AM-003`, `AM-013`, `AM-015` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/scripts/` | Backend tooling, seeded server, offline eval, NLP helper | Tooling | Yes | `run-vitest-suite.mjs`, `start-seeded-server.ts`, and `evaluate-proof-risk-model.ts` materially affect verification and operability | `AM-007`, `AM-011`, `AM-013`, `AM-015` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/output/` | Generated backend output | Local generated artifact | Yes | This directory is now ignored and should remain untracked; proof-risk freshness is still not enforced in CI through a separate artifact strategy | `AM-008`, `AM-010`, `AM-013` |
| `/home/raed/projects/air-mentor-ui/air-mentor-api/scripts/__pycache__/curriculum_linkage_nlp.cpython-313.pyc` | Ignored Python bytecode | Local generated artifact | Yes | Exists locally but is ignored by `.gitignore`; indicates hygiene pressure around the linkage helper without being part of committed source | `AM-010` |
| `/home/raed/projects/air-mentor-ui/audit/` | Audit pack | Audit artifact | Yes | Existing baseline docs plus deterministic appendix reviewed and used as upgrade inputs, not as source-of-truth replacements for code | none |

## Findings
### Coverage result
- All major runtime directories and file families were reviewed.
- All major test, script, migration, seed, and workflow surfaces were reviewed.
- The repo-noise perimeter was also reviewed, including committed prototypes, local temp probes, ignored generated artifacts, tracked output, and presentation artifacts.

### Blind-spot status
- No major folder was left unclassified.
- Smaller config files such as `.hintrc`, `.vscode/settings.json`, and `flake.*` were inspected for context but do not materially change the runtime audit conclusions.
- Existing prose docs such as `README.md` were deliberately not treated as authoritative evidence because the user instructed that docs are stale.

## Implications
- This ledger closes the repo-coverage challenge directly: there is now an explicit accounting for runtime, tests, tooling, and drift artifacts.
- The strongest engineering risks come from active runtime hotspots, not from unreviewed folders.
- The strongest repo-hygiene risks come from tracked drift artifacts and tool-driven verification paths that encode hidden operational assumptions.

## Recommendations
- Keep this ledger updated whenever new runtime families, scripts, or artifact classes are introduced.
- Use the linked issue IDs here as the bridge from raw repo coverage to actual implementation work.
- When deleting or archiving repo-drift artifacts, update this ledger and `AM-010` together.

## Confirmed facts vs inference
### Confirmed facts
- Every path listed above was present in the repository and reviewed.
- The classification labels are grounded in code behavior, tests, script execution role, or lack of runtime references.

### Strongly supported inference
- Some root-level config files and legacy artifacts will remain low-value noise unless the repo is explicitly cleaned as part of the remediation program.

## Cross-links
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [21 Feature Inventory And Traceability Matrix](./21-feature-inventory-and-traceability-matrix.md)
- [22 Evidence Appendix By Issue](./22-evidence-appendix-by-issue.md)
- [39 90-Day Execution Plan](./39-90-day-execution-plan.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
