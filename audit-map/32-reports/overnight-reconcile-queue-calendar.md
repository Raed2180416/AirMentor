# Overnight Reconcile: Queue / Calendar / HOD

## Findings

此报唯据仓内现码核对 queue / case / calendar / HOD 诸断语；凡可证者皆附 file:line。

- `concernContextKey`：Auth Prompt C(2) 命 `studentId + offeringId + concernFamily + semesterNumber` (4元)；现码 `proof-queue-governance.ts:149` 产 `studentId + semester + offId + courseCode + family` (5元)，多出 `courseCode` 乃冗余，且顺序不一。
- Case Taxonomy：Auth Prompt C(3-4) 严分 Primary Family (risk) 与 Workflow Category (task)；现码 `fallbackConcernFamily` 仍杂糅 `course-offering-risk` 等旧名，未全量落实 canonical taxonomy。
- Ownership Routing：合 Auth Prompt C(8) — High -> Mentor, Medium -> Course Leader, HOD 司 escalation/unlock；`monitoring-engine.ts:43` 已实作此分流。
- `dismissal=handled`：Auth Prompt B(17) 称 `dismissal = handled`；现码 `proof-queue-governance.ts:302` 映射 `resolved -> dismissed`，语义尚合然术语未一。
- Reopen Logic：Auth Prompt B(18) 命 deterioration 开新案、勿复活旧案；现码 `proof-queue-governance.ts:306` 设 `reopened` 状态且给 `reopenedFromCaseId` 指向旧案，实乃新案 ID，符。
- Queue ↔ Calendar：Auth Prompt B(20) 命 calendar drag 必更 due date；`calendar-pages.tsx:1428` 调 `onScheduleTask` 写回 `dueDateISO`，符。
- Demo Auto-resolution：Auth Prompt C(15) 命 demo mode 下 Next Stage 自动结案；现码仅见 `post-see` 结案，general demo resolution flag 尚缺。
- HOD Correction Cycle：Auth Prompt D(6) 命 `request -> approve -> reset-unlock -> edit -> recompute -> relock`；`academic-runtime-routes.ts:1285` 已见 `clear-lock` 路由，链条基本成型。
- Manual Concern：Auth Prompt B(16) 命 manual concern 为 1st class intervention；现码 `monitoring-engine.ts:42` 已计入 `manualInterventionCount`，符。

## Ledger

| ID | Topic | Verdict | files_to_change | validation_hook | Evidence |
| --- | --- | --- | --- | --- | --- |
| L-01 | `concernContextKey` literal | Open drift | `audit-map/14-reconciliation/final-decision-appendix.md`<br>`air-mentor-api/src/lib/proof-queue-governance.ts` | `rg -n "concernContextKeyForCandidate" air-mentor-api/src/lib` | `air-mentor-api/src/lib/proof-queue-governance.ts:147-156`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:188` |
| L-02 | Primary Family Taxonomy | Open drift | `air-mentor-api/src/lib/proof-queue-governance.ts` | `rg -n "fallbackConcernFamily" air-mentor-api/src/lib` | `air-mentor-api/src/lib/proof-queue-governance.ts:141-145`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:191-196` |
| L-03 | Workflow Task Exclusion | Open drift | `air-mentor-api/src/lib/proof-queue-governance.ts` | `rg -n "primaryCase" air-mentor-api/src/lib/proof-queue-governance.ts` | Workflow tasks 严禁计入 primary student concern cases；须于 `createCaseDecision` 显化隔离。 |
| L-04 | Ownership routing | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "queueOwnerRole" air-mentor-api/src/lib/monitoring-engine.ts` | `air-mentor-api/src/lib/monitoring-engine.ts:43-65`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:220-231` |
| L-05 | Dismissal=handled | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "resolved.*dismissed" air-mentor-api/src/lib/proof-queue-governance.ts` | `air-mentor-api/src/lib/proof-queue-governance.ts:301-303`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:145` |
| L-06 | Reopen new case | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "reopenedFromCaseId" air-mentor-api/src/lib/proof-queue-governance.ts` | `air-mentor-api/src/lib/proof-queue-governance.ts:336-336`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:149` |
| L-07 | Calendar due-date write | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "onScheduleTask.*dateISO" src/pages/calendar-pages.tsx` | `src/pages/calendar-pages.tsx:1428-1433`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:154` |
| L-08 | Demo auto-resolution | Open drift | `air-mentor-api/src/lib/proof-queue-governance.ts` | `rg -n "resolved.*stageKey === 'post-see'" air-mentor-api/src/lib/proof-queue-governance.ts` | `air-mentor-api/src/lib/proof-queue-governance.ts:491`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:270` |
| L-09 | Manual intervention count | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "manualInterventionCount" air-mentor-api/src/lib/monitoring-engine.ts` | `air-mentor-api/src/lib/monitoring-engine.ts:42-42`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:141` |
| L-10 | HOD clear-lock bit | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "clear-lock" air-mentor-api/src/modules/academic-runtime-routes.ts` | `air-mentor-api/src/modules/academic-runtime-routes.ts:1285-1331`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:138` |
| L-11 | HOD Correction machine | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "Unlock requested|approve" src/App.tsx` | `src/App.tsx:3114-3195`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:309-312` |
| L-12 | Watch visible != blocking | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "Action Needed" src/pages/hod-pages.tsx` | `src/pages/hod-pages.tsx:154-165`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:289` |
| L-13 | Workflow task types | Resolved in code | `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | `rg -n "approval-request|unlock-request" air-mentor-api/src/lib/proof-queue-governance.ts` | `air-mentor-api/src/lib/proof-queue-governance.ts:208-213`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:208-213` |

## Evidence

- `concernContextKey`：现码产 5-tuple [studentId, semester, offId, courseCode, family]；Auth C(2) 仅求 4-tuple。 `air-mentor-api/src/lib/proof-queue-governance.ts:149-156`
- Taxonomy：`fallbackConcernFamily` 仍产 `course-offering-risk`；未见 `attendance-risk` 等 canonical literal。 `air-mentor-api/src/lib/proof-queue-governance.ts:141-145`
- Ownership：`buildMonitoringDecision` 依 `riskBand` 分 Mentor/Course Leader；符。 `air-mentor-api/src/lib/monitoring-engine.ts:43-65`
- Reopen：`createCaseDecision` 置 `canonicalStatus = 'reopened'` 并指回 `priorCaseState.caseId`；符。 `air-mentor-api/src/lib/proof-queue-governance.ts:306-336`
- Calendar：`onScheduleTask` 传 `dateISO` 且 `applyPlacementToTask` 写回 `dueDateISO`；符。 `src/pages/calendar-pages.tsx:1428`, `src/calendar-utils.ts:645-662`
- Auto-resolution：`governProofQueueStage` 仅在 `post-see` 强转 `resolved`；demo 态通用自动结案未见。 `air-mentor-api/src/lib/proof-queue-governance.ts:491`
- HOD Correction：`academic-runtime-routes.ts` 具 `unlock-request` 与 `clear-lock` 路由；`App.tsx` 具 approve UI。 `air-mentor-api/src/modules/academic-runtime-routes.ts:1249-1331`, `src/App.tsx:3114-3195`

## Mitigation Plan

1. 校准 `concernContextKey`：将 `proof-queue-governance.ts` 中 literal 依 Auth C(2) 改为 4-tuple，去冗余 `courseCode`。
2. 清理 Taxonomy：全量更替 `fallbackConcernFamily` 与 monitoring output 为 `attendance-risk` 等 5 类主案。
3. 补足 Demo Flag：于 `governProofQueueStage` 入参增 `isDemoMode`；若为真，则 Next Stage 强转 unresolved actionable 为 `resolved`。
4. 统一 Handled 术语：文档及 UI 文案改 `dismissed` 为 `handled` 以符 Auth B(17)。
5. 闭环 Correction Cycle：于 HOD docs 显化 `recompute -> relock` 步；现码 recompute 靠 rerun simulation 触发，须记之。

## Recommendations

- 冻结 `concernContextKey`：4元组格式乃 frozen spec，不得偏离。 `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:188`
- 冻结 Taxonomy：Primary Student Concern Case 仅限 5 类；Workflow Task 不计入 headline counts。 `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:190-203`
- 固化 Calendar 桥接：due-date write-back 乃权威路径，不可退回仅预览。 `src/pages/calendar-pages.tsx:1411-1416`
- 守 read-only HOD： HoD  oversight 须源于 persisted proof summary，非前端 runtime calc。 `src/pages/hod-pages.tsx:216-225`
- 落实 Semester 1 watch-only： pre-TT1 不得产 actionable system case。 `air-mentor-api/src/lib/proof-queue-governance.ts:234-240`
