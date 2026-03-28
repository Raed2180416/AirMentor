# AirMentor State Management And Client Logic Audit

## What this area does
This document audits the frontend state model: React state, repository mode, browser storage, backend synchronization, route restoration, and proof playback state.

## Confirmed observations
- `src/repositories.ts` defines `RepositoryMode = 'local' | 'http'` and keeps support for both modes.
- Browser persistence keys include theme mode, current faculty, current admin faculty, legacy teacher ID, student patches, scheme state, blueprint state, drafts, cell values, locks, lock audit, task caches, timetable templates, task placements, calendar audit, meetings, and proof playback selection.
- `src/proof-playback.ts` persists the selected proof run/checkpoint in local storage under `airmentor-proof-playback-selection`.
- `src/system-admin-live-app.tsx` stores dismissed queue items in local storage and route snapshots in session storage.
- `src/portal-routing.ts` restores the portal from storage hints even when the current hash is the home route, preferring current admin context over academic context.
- Admin route restoration in `src/system-admin-live-app.tsx` is specific to the `faculties` section and restores `tab`, `sectionCode`, and scroll position.

## Key workflows and contracts
### Client state sources
| Source | Examples |
| --- | --- |
| React component state | large `useState` sets in `src/App.tsx` and `src/system-admin-live-app.tsx` |
| Local storage | theme, faculty/admin hints, proof playback selection, local repository slices |
| Session storage | admin route snapshots |
| Backend bootstrap | `/api/academic/bootstrap` and large admin list endpoints |
| Backend runtime sync | `/api/academic/runtime/:stateKey`, tasks sync, placements sync, calendar audit sync, faculty calendar workspace |

### Hidden-state behaviors
- portal auto-resolution from prior faculty/admin keys
- route restoration after reload in the admin UI
- checkpoint persistence across proof surfaces and reload
- proof-playback invalidation fallback on `403/404`, including local-storage reset and bootstrap retry without the checkpoint
- local repository fallback and legacy teacher ID support

## Findings
### State-management strengths
- The repository abstraction made backend adoption possible without rewriting every consumer at once.
- Proof playback persistence is intentionally centralized in `src/proof-playback.ts` instead of being scattered ad hoc.

### State-management weaknesses
- State authority is ambiguous. The same domain can exist in memory, storage, and backend runtime records.
- Hidden persisted state affects visible navigation. That is convenient for experts but easy to misread as random UI behavior.
- Coarse sync endpoints encourage whole-slice replacement, which increases overwrite risk and makes conflict recovery coarse.

## Implications
- **Technical consequence:** debugging becomes “which copy won?” rather than “what is the current state?”
- **User consequence:** reload behavior can be inconsistent with mental models because the app restores workspace, route, or checkpoint context automatically.
- **Product consequence:** convenience features risk undermining trust if the system appears to “jump” to remembered state without explaining it.

## Recommendations
- Define one authoritative source for each runtime slice and document it in code.
- Limit browser storage to explicit convenience state with visible reset affordances.
- Replace whole-slice sync with narrower entity-level saves where user edits are naturally scoped.
- Add visible “restored from previous session” hints for checkpoint and route restoration.
- Document route restoration more honestly: it is currently a narrow faculty-view convenience, not a general admin navigation state system.

## Confirmed facts vs inference
### Confirmed facts
- The storage keys and repository behaviors listed above are present in `src/repositories.ts`, `src/proof-playback.ts`, and `src/system-admin-live-app.tsx`.
- `createHttpSessionPreferencesRepository` includes retry-based settlement logic after login and role switching.

### Reasonable inference
- The storage-rich design reflects a migration from local-first behavior to backend-first behavior, leaving multiple persistence patterns alive simultaneously.

## Cross-links
- [03 Frontend Audit](./03-frontend-audit.md)
- [05 Database And Data Flow Audit](./05-database-and-data-flow-audit.md)
- [10 Performance Scalability And Reliability Audit](./10-performance-scalability-and-reliability-audit.md)
- [11 UX / UI Audit](./11-ux-ui-audit.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
