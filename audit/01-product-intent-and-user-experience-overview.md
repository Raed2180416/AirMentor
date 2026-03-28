# AirMentor Product Intent And User Experience Overview

## What this area does
This document reconstructs AirMentor’s intended product behavior from code, copy, seeds, routes, and tests. It focuses on who the product is for, what journeys the implementation prioritizes, and where the lived UX diverges from that intent.

## Confirmed observations
- The portal copy in `src/portal-entry.tsx` defines two workspaces: “Teaching Workspace” for Course Leaders, Mentors, and HoDs, and “System Admin Control Plane” for institution setup, faculty and student records, governance, and requests.
- `src/App.tsx` and `src/system-admin-app.tsx` both require `VITE_AIRMENTOR_API_BASE_URL` for live operation. The code has moved decisively toward backend-backed runtime behavior.
- The academic workspace includes workflow pages, course detail pages, calendar/timetable views, faculty profile proof surfaces, HoD analytics, student shell, and risk explorer. These are spread across `src/pages/*.tsx`, `src/system-admin-faculty-calendar-workspace.tsx`, `src/calendar-utils.ts`, and `src/selectors.ts`.
- The system-admin workspace includes institutional hierarchy setup, faculty and student administration, request workflow management, curriculum governance, proof control plane actions, admin search, audit history, reminders, and faculty calendar oversight. The main selectors and route helpers live in `src/system-admin-live-data.ts`.
- The live admin faculty planner is intentionally not full parity with the teaching workspace. `src/system-admin-faculty-calendar-workspace.tsx` suppresses tasks and meetings, disallows task creation, prevents course-workspace opening, and forces a `month-only` layout.
- HoD proof analytics default to an operational queue view. In `src/pages/hod-pages.tsx`, `showActionNeededOnly` starts as `true`.

## Key workflows and contracts
### Primary user types
| User type | Confirmed code evidence | Primary objective |
| --- | --- | --- |
| System admin | `SYSTEM_ADMIN` grant in `air-mentor-api/src/modules/support.ts`, admin login path in `src/system-admin-app.tsx`, route surface in `air-mentor-api/src/modules/*` | Configure institution, people, batches, policies, requests, provisioning, and proof lifecycle |
| HoD | `HOD` role in session and scope helpers, HoD proof endpoints in `air-mentor-api/src/modules/academic.ts`, HoD UI in `src/pages/hod-pages.tsx` | Supervise faculty and student risk at proof-run or checkpoint scope |
| Course leader | Role-switching in `src/App.tsx`, faculty proof panel and student shell/risk explorer access in `air-mentor-api/tests/student-agent-shell.test.ts` | Operate teaching workflows, manage course-level student risk, interpret bounded proof evidence |
| Mentor | Scope checks in student shell and risk explorer tests | Track mentees, explain current status, act on interventions and follow-up |

### Primary user journeys
1. Choose portal from a neutral home route, with any restored workspace or proof state made explicit and resettable.
2. Authenticate and assume a role context via session cookie and role grant.
3. Load either the academic bootstrap or system-admin workspace dataset.
4. Perform role-specific actions:
   - Academic: grading, course workflow, meetings, calendar, proof panel, student shell, risk explorer.
   - Admin: institution hierarchy, people, requests, offerings, policies, curriculum linkage, proof operations.
5. Persist or sync changes through backend APIs, storage-backed repositories, or both.

### Core product promise implied by the code
AirMentor promises a role-aware academic operating system that combines institutional control-plane data with proof-backed student-risk interpretation, without handing faculty an unconstrained AI assistant.

## Findings
### Product strengths
- The product intent is specific and coherent. The codebase does not pretend to be a general AI assistant. It aims to help academic operators make grounded decisions from institutional records plus checkpoint-bound proof evidence.
- The teaching and admin workspaces are differentiated cleanly at the portal level. The copy in `src/portal-entry.tsx` accurately frames that split.
- The proof UX is comparatively honest inside the proof surfaces themselves. `src/pages/student-shell.tsx` and `src/pages/risk-explorer.tsx` explicitly frame the shell as a deterministic explainer and the explorer as simulation-calibrated analysis.

### Product weaknesses
- Some UX state is still implementation-driven rather than user-driven. Local and session storage, route snapshots, and proof playback persistence can restore screens and filters from prior work, but the `home` portal route is now neutral again and restored state is surfaced more explicitly than it was in the original audit pass.
- The product asks users to carry a high cognitive load across role switching, deep-linked admin routes, batch context, hidden scope filters, proof checkpoints, and multiple detail surfaces.
- The request workflow is technically functional but more process-centric than user-centric. The state machine is visible, but the UX still relies on knowing what “Take Review”, “Mark Implemented”, and “Close” mean in sequence.
- Calendar and timetable governance leaks implementation policy into the UX. Direct edits are only open for a 14-day window after publication, recurring classes become read-only when locked, and durable timetable changes are expected to flow through approval rather than direct editing.

## Implications
- **User impact:** the product can feel powerful for expert users and opaque for occasional users.
- **Business impact:** the domain credibility is strong, but trust can erode if users feel that proof outputs or restored states appear “magically” rather than predictably.
- **Engineering impact:** product logic is encoded across UI, backend, and storage layers instead of being represented as simpler user-facing state machines.

## Recommendations
- Explicitly surface current scope, role, and checkpoint at every proof-bound screen.
- Treat restored route and playback state as opt-in session convenience, not silent default behavior.
- Rework request and admin flows around “what happens next” copy instead of workflow shorthand.
- Reduce the number of pages where implementation artifacts such as batch IDs, route fragments, or hidden storage snapshots influence the visible screen without explanation.

## Confirmed facts vs inference
### Confirmed facts
- Portal split, role codes, and proof surface labels are explicit in code.
- Faculty-facing proof surfaces deliberately avoid unconstrained AI language.
- The admin request flow is a multistage sequence surfaced in both backend routes and Playwright scripts.

### Reasonable inference
- The product is optimized for internal institutional users who can tolerate dense control surfaces better than external end users could.
- The product’s UX decisions favor completeness over guided simplicity because the implementation is trying to preserve operational breadth inside a small number of screens.

## Cross-links
- [03 Frontend Audit](./03-frontend-audit.md)
- [11 UX / UI Audit](./11-ux-ui-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
