# Overnight Reconcile: Queue / Calendar / HOD

## Findings
Queue vs Calendar contradictions analyzed. 
System checks reveal misalignments in concernContextKey, dismissal states, and deterioration gates.
Spec demands concernContextKey, code uses queueCaseId. Fix code to match spec.
Code separates correctly. No primary cases in workflow views.
High -> Mentor, Medium -> CL. Code matches spec.

## Ledger
1. concernContextKey mismatch: spec demands concernContextKey, code uses queueCaseId. Fix code to match spec.
2. workflow vs primary cases: code separates correctly. No primary cases in workflow views.
3. ownership routing: High -> Mentor, Medium -> CL. Code matches spec.
4. dismissal vs handled states: Code uses boolean !!task.dismissal. Doc says dismissal=handled. Update doc.
5. reopen-later-deterioration: Spec claims deterioration escalation. Code lacks this. Implement gate.
6. queue calendar bridge: Drag updates dueDateISO. Works as expected.
7. drag to due date: Drag sets dueDateISO: normalizedDate. Matches spec.
8. demo auto-resolution: Spec mentions demo auto-resolve. Code lacks this. Remove from spec or implement.
9. HOD correction cycle: Clear-lock implemented. Works as expected.
10. recompute and relock: Tracing requires multiple routes. Needs unified doc.

## Evidence
- QC-001: air-mentor-api/src/lib/proof-queue-governance.ts:49-64
- QC-002: air-mentor-api/src/lib/proof-queue-governance.ts:55
- QC-004: src/domain.ts:205-212
- QC-005: src/App.tsx:2422-2425
- QC-008: air-mentor-api/src/lib/proof-queue-governance.ts:337-370

## Mitigation Plan
- Add concernContextKey to relevant interfaces.
- Update docs to reflect boolean dismissal state.
- Implement reopen-later-deterioration gate if required by product.

## Recommendations
- Align specs strictly with implemented code.
- Add deterioration logic.
- Refactor documentation to unify HOD correction cycle.
- Clarify demo auto-resolution paths.
- Ensure all states are explicitly handled in UI.
- Add more tests for calendar drag events.
- Audit all governance logic for alignment.
- Regular synchronization of specs and code.
- Continuous review of queue and calendar states.
- Monitor deterioration rates.
- Improve HOD workflow visibility.
