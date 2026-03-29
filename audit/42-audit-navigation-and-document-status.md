# AirMentor Audit Navigation And Document Status

## What this area does
This guide removes ambiguity about how to read the audit folder after the repository changed. Some documents are current-state ledgers, some are subsystem audits with reconciliation addenda, and some are intentionally historical implementation specs.

## Current source-of-truth documents
Use these first if the goal is to understand the repo as it exists now:

- `00-executive-summary.md`
- `15-issue-catalog-prioritized.md`
- `16-recommended-remediation-roadmap.md`
- `20-repo-coverage-ledger.md`
- `21-feature-inventory-and-traceability-matrix.md`
- `22-evidence-appendix-by-issue.md`
- `41-current-state-reconciliation-and-gap-analysis.md`
- `43-manual-closeout-checklist.md`
- `44-final-closeout-evidence-2026-03-28.md`

## Subsystem audits with current-state reconciliation
These documents still contain their original audit structure, but now also include explicit `Current-state reconciliation (2026-03-29)` sections that tell you what changed:

- `02-system-architecture-overview.md`
- `03-frontend-audit.md`
- `04-backend-audit.md`
- `05-database-and-data-flow-audit.md`
- `06-api-and-integration-audit.md`
- `07-auth-security-and-privacy-audit.md`
- `09-testing-quality-and-observability-audit.md`
- `10-performance-scalability-and-reliability-audit.md`
- `11-ux-ui-audit.md`
- `12-accessibility-audit.md`
- `14-cross-file-cross-system-issue-map.md`
- `18-proof-sandbox-and-curriculum-linkage-audit.md`
- `19-deterministic-rules-and-operating-assumptions.md`
- `39-90-day-execution-plan.md`
- `40-risk-register-and-migration-watchouts.md`

## Historical or target-state documents
These are still useful, but they should not be treated as the current-state ledger:

- `23-implementation-spec-AM-001.md` through `38-implementation-spec-AM-016.md`
  - These are remediation specs. They describe intended changes, acceptance criteria, and original execution targets.
  - They may still mention pre-remediation files or future-tense work even when part of that work has already landed.
- `39-90-day-execution-plan.md`
  - This is now a historical baseline plan. Read it together with `16` and `41`.

## Current unresolved work
As of `2026-03-29`, the primary unresolved items are:

1. Repo-local implementation work is closed enough that the remaining work is now closeout verification, not major refactoring.
   - `npm run verify:final-closeout` is the deterministic local + seeded-browser confidence bar, and the `2026-03-29` rerun is green after a harness-only accessibility fix was applied and the failed step plus remaining steps were rerun successfully.
   - Use `npm --workspace air-mentor-api run deploy:railway:preflight` and `npm --workspace air-mentor-api run verify:live-session-contract` when the question is Railway deployment health rather than product code.
   - Use `npm run inventory:compat-routes -- --assert-runtime-clean` to keep deprecated compatibility callers explicitly absent during closeout.
2. Compatibility governance remains intentionally open.
   - The deprecated `/sync` and generic `/api/academic/runtime/:stateKey` routes are still live as compatibility surfaces.
   - Use `npm run inventory:compat-routes` to confirm they still have no first-party runtime callers.
3. Deployed operational closeout is now green as well.
   - The live GitHub Pages browser flows are passing, the live session-security bar is passing, and GitHub Actions deploy run `23694196459` completed successfully after the Railway production service was given an explicit `CSRF_SECRET`.
   - The deploy workflow now includes Railway variable preflight, live session-contract verification, and a diagnostics artifact on failure.
   - The acceptance and request-flow scripts now emit structured JSON reports, and the deploy workflow now captures `railway up` stdout/stderr while using readiness health-mode verification.
   - Use `44-final-closeout-evidence-2026-03-28.md` for the exact run IDs, probe output, and artifact paths.
4. Manual closeout remains intentionally separate from automated completion.
   - Use `43-manual-closeout-checklist.md` for the remaining screen-reader, compatibility-route retirement, product-intent/UX, and post-deploy review items.
   - The live accessibility regression now also writes `output/playwright/system-admin-live-screen-reader-preflight.md` to make that review deterministic.

## Recommended reading order
1. `41-current-state-reconciliation-and-gap-analysis.md`
2. `15-issue-catalog-prioritized.md`
3. `21-feature-inventory-and-traceability-matrix.md`
4. `22-evidence-appendix-by-issue.md`
5. The subsystem audit relevant to the area you want to change
6. `43-manual-closeout-checklist.md` if the change touches release readiness or completion claims
7. `44-final-closeout-evidence-2026-03-28.md` for the latest automated and live verification record

## Cross-links
- [00 Executive Summary](./00-executive-summary.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [20 Repo Coverage Ledger](./20-repo-coverage-ledger.md)
- [21 Feature Inventory And Traceability Matrix](./21-feature-inventory-and-traceability-matrix.md)
- [22 Evidence Appendix By Issue](./22-evidence-appendix-by-issue.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
- [43 Manual Closeout Checklist](./43-manual-closeout-checklist.md)
- [44 Final Closeout Evidence 2026-03-28](./44-final-closeout-evidence-2026-03-28.md)
