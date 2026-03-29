# AirMentor Accessibility Audit

## What this area does
This document audits accessibility risks across keyboard use, semantics, focus behavior, copy, contrast, and dense proof/admin surfaces.

## Confirmed observations
- The frontend uses many custom-styled controls with inline style objects rather than a mature component library with baked-in accessibility guarantees.
- The system-admin and academic shells both rely heavily on custom buttons, nested panels, and dense tables or grids.
- Proof surfaces use many `data-proof-*` hooks, which is good for testing structure but does not by itself ensure semantic accessibility.
- There is now a live keyboard regression flow and a dedicated live axe/browser accessibility regression flow:
  - `scripts/system-admin-live-keyboard-regression.mjs`
  - `scripts/system-admin-live-accessibility-regression.mjs`
  - `.github/workflows/proof-browser-cadence.yml`

## Current-state reconciliation (2026-03-28)
- The original “no evidence of systematic keyboard-flow testing” finding is now too strong. The repo does contain:
  - `scripts/playwright-admin-live-keyboard-regression.sh`
  - `scripts/system-admin-live-keyboard-regression.mjs`
  - structured keyboard evidence in `output/playwright/system-admin-live-keyboard-regression-report.json`
  - scheduled execution in `.github/workflows/proof-browser-cadence.yml`
  - fresh live axe/browser verification output in `output/playwright/system-admin-live-accessibility-report.json`
  - generated screen-reader preflight transcript in `output/playwright/system-admin-live-screen-reader-preflight.md`
  - accessibility-tree assertions inside `scripts/system-admin-live-accessibility-regression.mjs`
  - related render-level coverage in `tests/system-admin-ui.test.tsx` and `tests/system-admin-proof-dashboard-workspace.test.tsx`
  - explicit `tablist` / `tab` / `aria-selected` semantics on the major proof tab rails in `student-shell.tsx`, `risk-explorer.tsx`, `hod-pages.tsx`, and the system-admin detail rails
  - modal focus-trap and focus-restore assertions inside the live keyboard regression for the student detail dialog
- The accessibility issue remains only partially open because:
  - the repo now generates a screen-reader preflight transcript, but there is still no completed human assistive-technology pass
  - dense custom UI surfaces remain central to the product
  - the live browser suite currently covers high-risk flows rather than every route
  - the remaining semantics gaps are now narrow enough to be covered by direct tests such as `tests/system-admin-accessibility-contracts.test.tsx` and `tests/ui-primitives-modal.test.tsx`

## Key workflows and contracts
### High-risk accessibility areas
- Portal selection and login flows
- Admin hierarchical navigation
- Dense request and proof control surfaces
- Calendar and timetable interactions
- Tabbed proof views in student shell and risk explorer
- Large custom detail panels with inline actions

## Findings
### Accessibility strengths
- The proof pages at least expose stable section structure, which makes future accessibility auditing more tractable.
- Some controls use explicit button semantics, and acceptance scripts rely on role queries in many places, indicating the markup is not entirely div-driven.
- The major proof tab rails now expose explicit tab semantics instead of acting purely as visual segmented buttons.

### Accessibility weaknesses
- Keyboard-flow testing, live axe/browser checks, live accessibility-tree assertions, and a generated screen-reader preflight transcript now exist for high-risk portal, admin, proof, dialog, and teacher proof paths, but the final human screen-reader pass is still absent.
- Keyboard-flow testing, live axe/browser checks, live accessibility-tree assertions, a generated screen-reader preflight transcript, and direct contract tests for tab semantics and modal focus behavior now exist for high-risk portal, admin, proof, dialog, and teacher proof paths, but the final human screen-reader pass is still absent.
- Dense custom UIs and inline-style-heavy implementations increase the chance of inconsistent focus rings, insufficient semantics, and unclear interactive affordances.
- The app’s information density raises cognitive accessibility concerns even where technical semantics may exist.

## Implications
- **User impact:** keyboard-only and assistive-technology users are at risk of friction on the most complex screens.
- **Engineering impact:** accessibility defects will be harder to retrofit because interaction logic and presentation are tightly interwoven in large components.
- **Product impact:** institutional software that handles faculty workflows and student-risk interpretation needs stronger accessibility guarantees than are currently evidenced.

## Recommendations
- Keep the live browser accessibility regression suite green and extend it when new high-risk flows are added.
- Audit focus management for tab switches, route changes, modal-like detail panels, and back navigation from risk explorer and student shell.
- Extract reusable accessible primitives for tabs, disclosure panels, table actions, and status chips rather than repeating bespoke implementations.

## Confirmed facts vs inference
### Confirmed facts
- A live keyboard regression path exists and runs through the proof-browser cadence workflow.
- A live axe/browser accessibility regression suite now exists for portal, login, admin request detail, proof dashboard, dialog, and teacher proof flows, and it now also asserts key accessibility-tree roles/names for those critical surfaces.
- The admin hierarchy, faculty detail, and modal focus contracts also have direct regression coverage in `tests/system-admin-accessibility-contracts.test.tsx` and `tests/ui-primitives-modal.test.tsx`.
- Large custom UI surfaces still dominate the active app.

### Reasonable inference
- Accessibility debt is likely broader than the currently visible tests suggest because the codebase optimizes first for domain functionality and only secondarily for reusable semantic structure.

## Cross-links
- [03 Frontend Audit](./03-frontend-audit.md)
- [09 Testing Quality And Observability Audit](./09-testing-quality-and-observability-audit.md)
- [11 UX / UI Audit](./11-ux-ui-audit.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
