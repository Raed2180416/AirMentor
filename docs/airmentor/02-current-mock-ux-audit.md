# Current Mock UX Audit

## Purpose

This document reflects the current state of the React mock after the mock-flow completion pass.

It now combines:

- rendered audit findings from Playwright screenshots
- code inspection notes from `src/App.tsx` and `src/data.ts`
- product-rule alignment against the rest of the `docs/airmentor/` pack

## Audit Method

- Rendered screenshots were captured from the live Vite app with the Nix-backed Playwright CLI.
- Screenshots live under `output/playwright/audit/final/`.
- Audit-specific query params were used to deep-link into mock states for repeatable review:
  - `mockTeacher`
  - `mockRole`
  - `mockPage`
  - `mockOfferingId`
  - `mockStudentUsn`
  - `mockMenteeId`
  - `mockUnlockTaskId`
  - `mockKind`
  - `mockTab`

## Current Surface Status

| Surface | Status | Notes |
| --- | --- | --- |
| Login | Walkable | Mock faculty login still uses seeded credentials and local session state |
| Active role switcher | Walkable | Role change now resets invalid context and lands on a valid home page |
| Course Leader dashboard | Walkable | Still strong as the main operational home |
| Course detail tabs | Walkable | Overview, risk, attendance, and gradebook are strong; TT, quiz, assignment, and CO remain mock-backed |
| Scheme setup | Implemented | Explicit page now exists and blocks entry changes after entry starts |
| Data entry hub | Walkable | Now shows scheme gating and lock-state messaging more explicitly |
| Entry workspace | Walkable | Lock workflow no longer silently bypassed by HoD |
| Student drawer | Walkable | Now links to student history and supports defer-to-Mentor without HoD self-escalation |
| Student history | Implemented | Transcript and prior-semester context are now first-class in the mock |
| Action queue sidebar | Walkable | Single-owner model is now visible through owner chips and reassignment actions |
| Queue history page | Implemented | Transition trail and resolved history are now inspectable in a dedicated page |
| Remedial plan modal | Walkable | Still one of the better-complete flows in the mock |
| Mentor mentee list | Walkable | No longer a dead-end |
| Mentor detail page | Implemented | Adds course risk map, intervention timeline, queue context, and history entry point |
| HoD department view | Walkable | Supervisory drill-down remains effective |
| Unlock review page | Implemented | Pending review, reject path, and reset/unlock completion are represented |
| Calendar | Walkable | Still simple, but fit for mock-flow review |
| Narrow-width top-level pass | Usable with caveats | Side panels now auto-collapse, but the top bar remains dense and some pages still feel tight |

## Page-By-Page Notes

### Login

What works:

- seeded faculty identities are clear enough for mock review
- login is fast and deterministic

Current caveat:

- still uses a mock password and no account-state variations

### Role Switching And Top Bar

What works:

- active-role switching is explicit and central to the product model
- page context is now reset more safely when the active role changes

Current caveat:

- narrow-width top bar is still visually dense once role pills and utility controls share the same row

### Course Leader Dashboard

What works:

- remains the strongest overview page in the app
- priority alerts, assigned classes, and queue context work well together
- top-risk cards still create momentum toward action

Current caveat:

- stat cards on narrow widths are readable, but still visually compressed

### Course Detail

What works:

- academic tabs still provide a strong mental model for offering-level work
- gradebook now points to explicit scheme setup instead of implying a hidden rules engine

Current caveat:

- some tabs are still representational mock views rather than fully resolved operational screens

### Scheme Setup

What works:

- formalizes a previously missing step
- makes university-fixed rules versus configurable rules easy to read
- now signals that scheme changes are blocked after entry begins

Current caveat:

- most seeded Course Leader offerings already have entry activity, so the read-only-after-start scenario is easier to demonstrate than a pristine pre-entry setup scenario

### Data Entry Hub And Entry Workspace

What works:

- one consistent route still works well for all entry kinds
- scheme gating is now explicit
- HoD no longer silently edits locked data without unlock/reset context

Current caveat:

- import jobs, validation reports, and error-state UX are still not modeled

### Student Drawer

What works:

- mentor now sees summary academics instead of a hard wall
- student history entry point is present
- defer-to-Mentor and defer-to-HoD are separated correctly
- HoD self-escalation affordance is gone

Current caveat:

- the drawer remains information-dense and will need hierarchy tuning later if more fields are added

### Student History

What works:

- prior-semester context is now visible
- backlog and repeated-subject cases are represented
- Mentor visibility is appropriately summary-level, while Course Leader and HoD see richer score detail

Current caveat:

- transcript is still seeded mock data and not yet wired to import lifecycle or transcript corrections

### Action Queue And Queue History

What works:

- owner is visible on active cards
- reassignment is explicit
- transition history is retained
- resolved items are no longer purged after two days
- unlock tasks now have a visible review entry point

Current caveat:

- queue is still sidebar-first, which may feel cramped if the product later grows notification volume significantly

### Mentor Workspace

What works:

- mentee cards now lead somewhere real
- mentee detail provides intervention, risk, and history context in one place
- overdue remedial example makes the mentor queue feel more realistic

Current caveat:

- mentor quick-add remains offering-based under the hood, which is acceptable for the mock but not the final permission model

### HoD Workspace

What works:

- faculty drill-down plus unlock review makes the HoD role feel supervisory rather than editorial
- queue-review and reset flow now matches the docs far more closely

Current caveat:

- faculty-level metrics are still derived from seeded mock data rather than persisted departmental facts

## Major Improvements Since The Initial Audit

- `mentee-detail` exists and is wired from the mentee list.
- `student-history` exists and is reachable from both mentor and student drill-down paths.
- `unlock-review` exists and supports review decisions.
- `scheme-setup` exists as an explicit page.
- `queue-history` exists and makes the single-owner queue model visible.
- Mentor summary academics now match the documented visibility intent more closely.
- HoD no longer bypasses lock state silently in entry pages.
- resolved queue items are retained for history instead of disappearing on a timer.

## Remaining Mock Caveats

- The mock still relies on `localStorage` for persistence.
- Transcript, queue, and lock history are still frontend-owned, not backend-owned.
- Gradebook still shows SEE as placeholder until real SEE entry and grade computation are wired.
- Mobile is now usable for core top-level flows, but the header and some dense data views still need polish.
- No import validation, transcript ingestion UI, or real notification channels exist yet.

## Conclusion

The mock is now materially closer to a complete, reviewable end-to-end faculty flow. The biggest missing pieces are no longer navigation dead ends; they are backend durability, real academic engines, and remaining frontend polish.
