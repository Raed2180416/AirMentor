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
These documents still contain their original audit structure, but now also include explicit `Current-state reconciliation (2026-03-28)` sections that tell you what changed:

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
As of `2026-03-28`, the primary unresolved items are:

1. Repo-local implementation work is closed enough that the remaining work is now closeout verification, not major refactoring.
   - Use `npm run verify:final-closeout` for the deterministic local + seeded-browser confidence bar.
2. Compatibility governance remains intentionally open.
   - The deprecated `/sync` and generic `/api/academic/runtime/:stateKey` routes are still live as compatibility surfaces.
   - Use `npm run inventory:compat-routes` to confirm they still have no first-party runtime callers.
3. Manual and deployed operational closeout is intentionally separate from repo-local completion.
   - Use `43-manual-closeout-checklist.md` for the remaining screen-reader, deployed cookie/origin/CSRF, deprecated-route inventory, and post-deploy smoke steps.
   - Use `44-final-closeout-evidence-2026-03-28.md` for dated automated and deployed evidence.

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
