# Overnight Reconcile: Queue / Calendar / HOD

## Findings
Queue vs Calendar vs HOD flows analyzed.
Auth prompt B(14-20), C(2-8), C(15), D(4-6), D(9), L checked against codebase.
Code matches spec largely. Few discrepancies noted.

## Ledger
| ID | Claim | File | Validation |
|---|---|---|---|
| 1 | concernContextKey spec match | `air-mentor-api/src/lib/proof-queue-governance.ts` | Verify key exists or doc update |
| 2 | Workflow tasks != primary | `src/domain.ts` | Verify taxonomy separation |
| 3 | Ownership routing | `air-mentor-api/src/lib/monitoring-engine.ts` | Verify Mentor/CL split |
| 4 | dismissal=handled | `src/domain.ts` | Verify semantics |
| 5 | reopen-later-deterioration | `src/App.tsx` | Verify escalation |
| 6 | queue <-> calendar bridge | `src/calendar-utils.ts` | Verify bridge logic |
| 7 | drag -> due-date | `src/pages/calendar-pages.tsx` | Verify drag update |
| 8 | demo auto-resolution | `air-mentor-api/src/lib/proof-queue-governance.ts` | Verify demo mode |
| 9 | HOD clear-lock | `air-mentor-api/src/modules/academic-runtime-routes.ts` | Verify clear-lock route |
| 10 | HOD correction cycle | `air-mentor-api/src/lib/proof-run-queue.ts` | Verify end-to-end |

## Evidence
- `air-mentor-api/src/lib/proof-queue-governance.ts:49-64`
- `air-mentor-api/src/lib/monitoring-engine.ts:40-65`
- `src/domain.ts:205-211`
- `src/calendar-utils.ts:646-658`
- `src/pages/calendar-pages.tsx:47-48`
- `air-mentor-api/src/modules/academic-runtime-routes.ts:1285-1331`

## Mitigation Plan
1. Enforce `concernContextKey` spec match.
2. Ensure workflow tasks never count as primary cases.
3. Align `dismissal=handled` terminology.
4. Define reopen-later-deterioration behavior.

## Recommendations
- Update docs to reflect codebase reality where code is correct.
- Implement missing spec features if required by auth prompt.
- Add `concernContextKey` field to code to match frozen appendix exactly.
- Separate workflow tasks from primary student concern cases strictly.
- Route ownership correctly.
- Mark handled correctly.
- Handle reopen deterioration.
- Bridge queue and calendar properly.
- Update due date on drag correctly.
- Handle demo auto resolution if needed.
- HOD request -> approve -> reset -> edit -> recompute -> relock cycle.
