# Reconciliation Memory: Queue / Calendar / HOD

## Status
- **Date**: 2026-04-25
- **Pass**: overnight-reconcile-queue-calendar-docs
- **Mode**: CAVEMAN WENYAN-ULTRA

## Knowledge base
- `concernContextKey`: Current 5-part [studentId, semester, offId, courseCode, family]. MUST BE 4-part [studentId, offId, family, semester].
- `concernFamily`: Canonical 5 types (attendance-risk, coursework-risk, exam-risk, broad-academic-risk, mentoring-followup).
- `primaryCase`: Boolean flag used for counting. Must exclude workflow tasks (approval-unlock, etc).
- `ownership`: Mentor (High), CL (Medium), HOD (Oversight/Workflow).
- `calendar`: `onScheduleTask` is the bridge for due-date mutation.

## Decisions
- [x] Contradiction matrix updated with 10+ rows.
- [x] Overnight report generated with findings/ledger/evidence/mitigation.
- [x] Drift in `concernContextKey` identified for Phase 3 fix.
- [x] Taxonomy cleanup scheduled for Phase 3 fix.
- [x] Demo auto-resolution gap noted for Phase 5 fix.

## Citations
- `air-mentor-api/src/lib/proof-queue-governance.ts:149-156` (concernContextKey)
- `air-mentor-api/src/lib/proof-queue-governance.ts:141-145` (fallbackConcernFamily)
- `air-mentor-api/src/lib/monitoring-engine.ts:43-65` (ownership routing)
- `src/pages/calendar-pages.tsx:892-903` (calendar drag)
- `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:188` (frozen C(2) key)
