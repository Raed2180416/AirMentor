# AirMentor Implementation Spec AM-009

## Problem statement
AirMentor’s most important screens are information-dense custom layouts with uneven semantic structure, limited accessibility-specific regression coverage, and several interaction patterns that still depend on bespoke keyboard and focus behavior.

## Exact code locations
- Shared interaction primitives:
  - `src/ui-primitives.tsx`
  - `getFocusableElements`
  - `ModalFrame`
  - `EntityButton`
  - `Btn`
- Dense runtime shells:
  - `src/App.tsx`
  - `src/system-admin-live-app.tsx`
- Proof-heavy pages:
  - `src/pages/student-shell.tsx`
  - `src/pages/risk-explorer.tsx`
  - `src/pages/hod-pages.tsx`
- Supporting tests with limited a11y depth:
  - `tests/student-shell.test.tsx`
  - `tests/risk-explorer.test.tsx`
  - `tests/hod-pages.test.ts`

## Root cause
Feature coverage and visual control outran the extraction of a small, consistently accessible primitive set. Accessibility behavior exists in pockets, but the dominant shells still compose large custom regions faster than the design system evolves.

## Full dependency graph
- `src/ui-primitives.tsx` -> shared buttons, dialogs, and interactive containers -> `src/App.tsx` and `src/system-admin-live-app.tsx`
- `src/App.tsx` -> academic navigation, proof panels, faculty profile drilldowns -> student shell and risk explorer pages
- `src/system-admin-live-app.tsx` -> hierarchy drilldowns, request detail, proof dashboard, modal editors
- Dense shells + limited accessibility automation -> regression risk across keyboard, focus, semantics, and cognitive load

## Affected user journeys
- system-admin hierarchy navigation and record editing
- proof checkpoint playback and proof detail inspection
- student shell and risk explorer tab switching
- HoD analytics inspection
- modal-based editing for student, faculty, and hierarchy records

## Risk if left unfixed
- keyboard users encounter friction or dead ends
- dense layouts remain harder to learn and slower to operate
- semantic and focus regressions will keep slipping past ordinary render tests
- institutional adoption risk increases for users expecting accessible internal systems

## Target future architecture or behavior
- a smaller accessible primitive set owns button semantics, tab behavior, list selection, banners, and modal focus rules
- dense shells are broken into clearer landmark regions with consistent headings and keyboard order
- critical proof and admin flows have automated accessibility checks in CI

## Concrete refactor or fix plan
1. Audit the shared primitives and classify which patterns are already safe to standardize.
2. Replace custom clickable containers on critical flows with explicit button, tab, or link semantics.
3. Standardize tablists, panel headings, and focus return behavior for:
   - student shell
   - risk explorer
   - HoD analytics
   - system-admin detail panels
4. Add persistent landmark and heading hierarchy to the densest shells before larger visual simplification.
5. Add automated keyboard and `axe`-style checks for the highest-risk flows.
6. Simplify or collapse secondary detail on the heaviest admin and proof screens to reduce cognitive load.

## Sequencing plan
- Start after AM-008 instrumentation and alongside AM-014 UX work.
- Coordinate with AM-001 shell decomposition so semantics are fixed as shells split, not after.
- Leave major visual restyling until after the critical interaction model is stabilized.

## Migration strategy
- Refactor one journey at a time:
  - proof pages first
  - request and hierarchy detail next
  - broad admin shell cleanup last
- Keep existing appearance as stable as possible while upgrading semantics and keyboard behavior.

## Testing plan
- Add browser-based accessibility checks for:
  - student shell
  - risk explorer
  - HoD proof analytics
  - system-admin request detail
  - system-admin entity edit modals
- Add explicit keyboard traversal assertions for dialogs, tab rails, and back-navigation controls.
- Keep existing feature tests green while adding accessibility assertions incrementally.

## Rollout plan
- Land primitive improvements first.
- Migrate proof pages next because they are smaller surfaces with high user-trust value.
- Migrate the heaviest admin surfaces after shell decomposition reduces blast radius.

## Fallback / rollback plan
- Accessibility changes should be landed in narrow UI slices.
- If a semantic upgrade breaks styling or interaction timing, revert that screen-level change while keeping shared primitive fixes that already pass tests.

## Acceptance criteria
- Critical proof and admin flows are fully keyboard-operable.
- Dialogs restore focus correctly and trap focus while open.
- Tab rails expose consistent semantics and selected state.
- At least the top proof and admin pages pass automated accessibility checks without critical violations.
- Dense screens have clearer heading and section structure than the current baseline.

## Open questions
- Which browser and assistive-tech combinations matter most for the deployment environment?
- Should some of the densest admin panels become separate routes instead of ever-denser single screens?

## Complexity and change risk
- Complexity: L
- Risk of change: Medium
- Prerequisite issues: AM-001, AM-008
- Downstream issues unblocked: AM-014
