# AirMentor Manual Closeout Checklist

## What this area does
This document captures the remaining human-run validation steps that are intentionally not treated as repo-automatable gates. It exists so “complete” does not depend on memory or hallway knowledge.

## Required manual checks
### 0. Deterministic closeout commands
- Run the full repo-local closeout suite:
  - `npm run verify:final-closeout`
- Run the compatibility-route caller inventory:
  - `npm run inventory:compat-routes`
- Run the deployed verification suite with real URLs:
  - `PLAYWRIGHT_APP_URL=<live-pages-url> PLAYWRIGHT_API_URL=<live-railway-url> npm run verify:final-closeout:live`
- Record results in `44-final-closeout-evidence-2026-03-28.md`.

### 1. Screen-reader pass on critical flows
- Verify the academic proof surfaces with VoiceOver, NVDA, or JAWS:
  - student shell tab rail, message timeline, and trust legend
  - risk explorer tab rail and section switching
  - HoD proof sections and detail dialogs
- Verify the system-admin critical flows:
  - request workflow navigation and dialog close/return focus
  - proof dashboard tab/section changes
  - hierarchy workspace tabs and panel announcements
- Acceptance bar:
  - active tab names are announced correctly
  - tabpanel content is associated with the active tab
  - modal open/close focus behavior is understandable and stable
  - no unlabeled actionable control remains on the critical flows

### 2. Production cookie, origin, and CSRF verification
- Validate production-like deployment behavior with the real frontend origin and API origin:
  - login succeeds with secure cookies enabled
  - session restore succeeds after reload
  - mutating requests without `X-AirMentor-CSRF` are rejected
  - mutating requests with valid session and CSRF token succeed
  - cross-origin or mismatched-origin mutation attempts are rejected
- Acceptance bar:
  - no mutating request bypasses CSRF enforcement
  - no valid user path fails because of cookie or origin misconfiguration

### 3. Deprecated academic runtime compatibility route review
- Inventory any remaining callers of:
  - `/api/academic/runtime/:stateKey`
  - `/api/academic/tasks/sync`
  - `/api/academic/task-placements/sync`
  - `/api/academic/calendar-audit/sync`
- Confirm whether any non-first-party client still depends on them.
- Acceptance bar:
  - caller inventory is explicit
  - compatibility routes are either still justified or scheduled for retirement

### 4. Deprecated route retirement preconditions
- Do not remove deprecated compatibility routes until all are true:
  - caller inventory is empty
  - OpenAPI diff is reviewed and approved
  - two consecutive green release cycles complete without compatibility-route dependence
  - bootstrap behavior is confirmed authoritative-first in production-like flows

### 5. Operational smoke after deployment
- Run the live smoke set on the deployed environment:
  - admin request flow
  - academic teaching bootstrap
  - proof dashboard load
  - student shell load
  - risk explorer load
- Acceptance bar:
  - no startup diagnostics error is present
  - no proof checkpoint or queue-health panel is stuck in an unexpected failed state
  - no degraded linkage/proof-refresh state is hidden from the operator

## Notes
- This checklist is the intentional closeout boundary for the remaining non-repo-local work.
- Failing any item above means the remediation program is not yet operationally closed, even if lint, build, tests, and browser regressions are green.
