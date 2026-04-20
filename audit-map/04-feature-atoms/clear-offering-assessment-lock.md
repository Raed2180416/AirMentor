# Feature Atom: Clear Offering Assessment Lock

## Intent
Allow HOD to fully clear the database lock column for a given assessment, fixing GAP-3.

## Surface
- Backend `POST /api/academic/offerings/:offeringId/assessment-entries/:kind/clear-lock`
- API Client `clearOfferingAssessmentLock`
- Repositories `locksAudit.clearRemoteLock`

## Behavior
1. HOD clicks reset.
2. Frontend calls repository to clear remote lock.
3. Backend sets the specific DB column (e.g., `tt1Locked`) to 0 and clears the runtime blob key.
4. Frontend updates local lock state.

## Dependencies
- `sectionOfferings` table
- `academicRuntimeState` table
