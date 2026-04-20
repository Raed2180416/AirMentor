# Flow: Proof Virtual Date Due Label

## Intent
Demonstrate how the virtual date from proof playback drives UI task due labels.

## Data Flow
1. Backend `GET /api/academic/bootstrap` returns `proofPlayback.currentDateISO`.
2. Frontend `src/academic-session-shell.tsx` receives and stores it in context/state.
3. Task rendering components call `toDueLabel(task.dueDateISO, proofPlayback.currentDateISO)`.
4. `src/calendar-utils.ts` calculates relative time (e.g., "Today", "This week") based on the anchor.

## Parity / Provenance
Matches live behavior but uses the injected virtual anchor instead of `Date.now()`.
Solves GAP-7.
