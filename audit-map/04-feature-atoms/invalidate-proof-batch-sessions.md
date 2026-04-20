# Feature Atom: Invalidate Proof Batch Sessions

## Intent
Ensure branch-scoped faculty sessions are invalidated on archive/activate to prevent stale access.

## Surface
Backend helper in `air-mentor-api/src/lib/msruas-proof-control-plane.ts`.

## Behavior
When a proof simulation run is archived or activated, this helper deletes all active sessions for faculty profiles scoped to that proof batch.

## Dependencies
- DB `sessions` table
- DB `facultyProfiles` table

## Edge Cases
- Must not delete sysadmin sessions.
- Must not delete sessions for other branches.
- Graceful degradation if no sessions exist.
