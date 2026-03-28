# AirMentor Frontend Audit

## What this area does
This document audits the React/Vite frontend, including portal routing, application orchestration, repository mode switching, proof playback state, page composition, and admin/client logic.

## Confirmed observations
- `src/App.tsx` is the primary academic runtime orchestrator. It handles login, role context, route state, local and HTTP repository initialization, faculty profile loading, course and workflow pages, proof playback, HoD views, risk explorer, and student shell navigation.
- `src/system-admin-live-app.tsx` is the primary system-admin runtime orchestrator. It parses admin routes, restores route snapshots from session storage, loads broad admin datasets, drives search, request detail, proof control plane, faculty calendars, and many UI dialogs.
- Frontend shell decomposition now exists around those roots:
  - academic session, topbar, sidebar, content, and route surfaces
  - system-admin session, proof dashboard, request, history, hierarchy, and faculties workspaces
- That admin route restoration is narrower than the broad label suggests: it stores `tab` and `sectionCode` under `airmentor-admin-ui:${routeToHash(route)}`, applies only to the `faculties` section, and also restores scroll position.
- `src/repositories.ts` implements both local and HTTP-backed repositories. The HTTP path still persists theme and faculty hints in browser storage and restores session preferences through retries.
- `src/system-admin-app.tsx` hard-fails without `VITE_AIRMENTOR_API_BASE_URL`.
- The UI is highly inline-style-driven. `src/portal-entry.tsx`, `src/system-admin-app.tsx`, `src/App.tsx`, and `src/system-admin-live-app.tsx` all embed large amounts of presentational logic directly in components.
- `src/system-admin-faculty-calendar-workspace.tsx` intentionally suppresses tasks, meetings, and task creation so the admin faculty planner remains an institutional calendar surface rather than full teaching-workspace parity.
- `src/system-admin-timetable-editor.tsx` and `src/system-admin-faculty-calendar-workspace.tsx` both encode a 14-day direct-edit window and lock semantics for recurring class edits.
- Frontend startup diagnostics and telemetry now exist in `src/startup-diagnostics.ts` and `src/telemetry.ts`.

## Key workflows and contracts
### Runtime composition
- Academic runtime:
  - Portal selection through `src/portal-routing.ts`
  - Session/login and role switch through API client + repositories
  - Bootstrap hydration through `AirMentorApiClient.getAcademicBootstrap`
  - Derived selectors through `src/selectors.ts`
  - Page rendering through `src/pages/course-pages.tsx`, `workflow-pages.tsx`, `calendar-pages.tsx`, `hod-pages.tsx`, `student-shell.tsx`, and `risk-explorer.tsx`
- System admin runtime:
  - Admin route parse/serialize inside `src/system-admin-live-app.tsx`
  - Visibility and search helpers in `src/system-admin-live-data.ts`
  - Request, history, proof, and hierarchy flow coordination through extracted workspace components

## Current-state reconciliation (2026-03-28)
- The original frontend audit was accurate about concentration, but some of its strongest statements are now historical:
  - `#/` no longer auto-enters a remembered workspace
  - proof restore is now explicit and resettable
  - the mock system-admin runtime path has been removed from the current tree
  - keyboard regression coverage now exists for the live admin/proof/portal flows
- Stage 2 is effectively complete. The root files are still large, but they are no longer the only place where route, proof, and session concerns live.

## Findings
### Frontend strengths
- The portal split is explicit and understandable.
- The API client is comprehensive and typed.
- Proof UI pages themselves are comparatively disciplined. `tests/student-shell.test.tsx`, `tests/risk-explorer.test.tsx`, `tests/faculty-profile-proof.test.tsx`, and `tests/hod-pages.test.ts` assert concrete proof surface sections and disclaimers.

### Frontend weaknesses
- Large components still act as mini-frameworks, but they now do so through extracted shells rather than as pure inline monoliths. This is still most severe in `src/App.tsx` and `src/system-admin-live-app.tsx`.
- Repository mode and storage behavior leak into UI behavior. The user experience depends on hidden persisted keys such as `AIRMENTOR_STORAGE_KEYS.currentFacultyId`, `AIRMENTOR_STORAGE_KEYS.currentAdminFacultyId`, theme mode, proof playback selection, dismissed queue items, and route snapshots.
- Presentational logic remains too concentrated in the root runtime files, which keeps change-scoping and deterministic regression reasoning harder than it should be.

## Implications
- **Technical consequence:** feature changes require reading and safely editing thousands of lines of UI orchestration.
- **User consequence:** reload and navigation behavior can feel stateful in surprising ways because session and local storage influence which portal, faculty, route, or checkpoint is restored.
- **Product consequence:** the live product looks like one app, but the repo still partially behaves like a transition from mock/local-first to backend-first runtime.

## Recommendations
- Extract front-end feature shells by domain:
  - academic auth/session shell
  - teaching runtime shell
  - faculty proof shell
  - student shell / risk explorer shell
  - system-admin request shell
  - system-admin proof shell
- Replace broad component-local state in the admin app with route-scoped loaders and smaller domain stores.
- Continue shrinking the remaining root orchestrators and clean up residual root-level prototype/temp artifacts that are not part of the live runtime.
- Make storage-driven restore behavior explicit in the UI so route, checkpoint, and planner restoration does not feel arbitrary.

## Confirmed facts vs inference
### Confirmed facts
- The active admin path refuses to run without a backend.
- The portal router now resolves only from the explicit hash route.
- Proof playback uses browser storage through `src/proof-playback.ts`.

### Reasonable inference
- The frontend was originally more local-first and was then evolved toward backend-backed runtime parity, leaving transitional abstractions in place.

## Cross-links
- [08 State Management And Client Logic Audit](./08-state-management-and-client-logic-audit.md)
- [11 UX / UI Audit](./11-ux-ui-audit.md)
- [12 Accessibility Audit](./12-accessibility-audit.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
