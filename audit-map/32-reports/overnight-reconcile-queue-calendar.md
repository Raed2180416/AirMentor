# Overnight Reconcile: Queue / Calendar / HOD

## Findings
查 code vs docs. 乃見：
- `concernContextKey` spec 必合 frozen appendix. (現缺於 code, 需補之)
- Workflow tasks 絕非 primary student concern cases. (Code 己分明, 無虞)
- HOD cycle 循: req → approve → reset-unlock → edit → recompute → relock. (Code 己具, 惟缺總述文檔)
- Queue ↔ Calendar bridge 需 drag → due-date mutation. (Code 己實踐, 且生 audit trail)
- Dismissal 卽 handled. (Code 乃 boolean `!!task.dismissal`, 非 string enum, 文檔當更之)
- Reopen-later 觸 deterioration. (Code 缺此門限, 當建之, 否則違 spec)
- Demo auto-resolution 需 auto-close. (Code 查無此徑, 宜自 spec 刪除)

## Ledger
1. Topic: concernContextKey | Validation: strict schema match | File: air-mentor-api/src/lib/proof-queue-governance.ts:49-64
2. Topic: case taxonomy (workflow) | Validation: workflow not in primary | File: air-mentor-api/src/lib/proof-queue-governance.ts:55
3. Topic: ownership routing | Validation: assign owner id | File: air-mentor-api/src/lib/monitoring-engine.ts:40-65
4. Topic: dismissal=handled | Validation: status transition | File: src/domain.ts:205-212
5. Topic: reopen-later-deterioration | Validation: trigger re-eval | File: air-mentor-api/src/lib/monitoring-engine.ts:25-75
6. Topic: queue↔calendar bridge | Validation: sync events | File: src/calendar-utils.ts:646-658
7. Topic: drag→due-date | Validation: patch due-date | File: src/pages/calendar-pages.tsx:47-48
8. Topic: demo auto-resolution | Validation: auto-close flag | File: air-mentor-api/src/lib/proof-queue-governance.ts:337-370
9. Topic: HOD correction cycle | Validation: state machine sequence | File: air-mentor-api/src/modules/academic-runtime-routes.ts:1285-1331
10. Topic: reset-unlock | Validation: auth gate UI | File: air-mentor-api/src/lib/proof-control-plane-hod-service.ts:372-380

## Evidence
- `air-mentor-api/src/lib/proof-queue-governance.ts:49-64` 示 `concernContextKey` 缺漏之處.
- `air-mentor-api/src/lib/monitoring-engine.ts:40-65` 示 routing logic (High → Mentor).
- `src/domain.ts:205-212` 示 primary vs workflow structure 及 dismissal state.
- `src/calendar-utils.ts:646-658` 示 calendar drag 觸發 `dueDateISO` 更新.
- `air-mentor-api/src/modules/academic-runtime-routes.ts:1285-1331` 示 HOD lock / unlock API 機制.

## Mitigation Plan
- 補 `concernContextKey` 於 API 介面, 以合 frozen appendix 之義.
- 改文檔所述之 dismissal 狀態, 以符 code 中之 boolean `!!task.dismissal`.
- 築 reopen-later deterioration gate, 俾符 spec 所言之 escalation 徑.
- 撤 demo auto-resolution 於 spec 之言, 因無實 code 應之.
- 撰 HOD cycle 總述, 統合 req → approve → relock 之散見邏輯.

## Recommendations
- 嚴守 `concernContextKey` schema validation 於 API boundary (zod).
- 隔 primary vs workflow metrics 以免 statistics skew, 尤當計算 capacity 時.
- 確 ownership re-routing (High → Mentor) 皆留 audit trail.
- 監 reopen-later metrics 察 deterioration, 防 case 滯留.
- 固 Calendar drag UX 避 race conditions 於 `dueDateISO` 同步時.
- 審 HOD workflow 之可見度, 俾 frontend 可明示當前鎖定狀態.

<<AIRMENTOR_PASS_RESULT>>
{
  "pass": "overnight-reconcile-queue-calendar-docs",
  "status": "completed",
  "artifacts": [
    "audit-map/32-reports/overnight-reconcile-queue-calendar.md"
  ],
  "citations": [
    "audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md:5",
    "audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md:8",
    "audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md:9",
    "audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md:12",
    "air-mentor-api/src/lib/proof-queue-governance.ts:49-64",
    "air-mentor-api/src/lib/monitoring-engine.ts:40-65",
    "src/calendar-utils.ts:646-658"
  ],
  "intent_affirmed": true,
  "notes": "Reconciled queue/calendar docs vs code. Imposed caveman wenyan-ultra. Logged findings and mitigations per frozen appendix."
}
<<END>>
