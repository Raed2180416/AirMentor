# Overnight Reconcile: Queue / Calendar / HOD

## Findings

及至丙申年三月，校对 Queue / Case / Calendar / HOD 诸章，得见：

*   **Key Drift**: `concernContextKey` 格式(5-part)悖 Auth C(2) (4-part)。冗余 `courseCode` 乃紊乱之源。
*   **Taxonomy Drift**: Primary family 未收拢至 canonical 5-head。`course-offering-risk` 仍存，污名未除。
*   **Workflow Contamination**: `primaryCase` 逻辑恒真，致 workflow task 混入 primary counts。悖 Auth C(4/7)。
*   **Demo Incompleteness**: Auto-resolution 仅限 `post-see`。`Next Stage` 之 demo 结案逻辑尚虚。
*   **HOD Cycle**: `request -> relock` 链条已具雏形，然 recompute 触发机制欠文。
*   **Calendar**: Drag-mutation UI 符，API 持久化待考。

## Ledger

| ID | Topic | File:Line | Claim | Validation Hook |
| :--- | :--- | :--- | :--- | :--- |
| QC-L-01 | `concernContextKey` | `proof-queue-governance.ts:149` | Format [S,Off,F,Sem] required; code has 5 parts. | `grep "concernContextKeyForCandidate"` |
| QC-L-02 | Primary Taxonomy | `proof-queue-governance.ts:141` | `fallbackConcernFamily` uses legacy names; must align C(3). | `grep "fallbackConcernFamily"` |
| QC-L-03 | Primary vs Workflow | `proof-queue-governance.ts:347` | `primaryCase: true` hardcoded; must isolate workflow. | `grep "primaryCase: true"` |
| QC-L-04 | Demo Auto-Resolve | `proof-queue-governance.ts:491` | Auto-resolve incomplete; missing `Next Stage` demo-mode. | `grep "post-see.*resolved"` |
| QC-L-05 | Watch-only Sem1 | `proof-queue-governance.ts:234` | `pre-tt1` watch-only gate active; matches C(1). | `grep "pre_tt1_observation_only"` |
| QC-L-06 | Calendar Drag | `calendar-pages.tsx:892` | Drag mutates date via `onScheduleTask`; matches B(20). | `grep "onScheduleTask"` |
| QC-L-07 | Dismissal = Handled | `proof-queue-governance.ts:315` | `resolved -> dismissed` mapping; matches B(17). | `grep "dismissed.*resolved"` |
| QC-L-08 | HOD Ownership | `monitoring-engine.ts:55` | `oversightOwnerRole` is HoD; primary routed to M/CL. | `grep "oversightOwnerRole.*HoD"` |
| QC-L-09 | Reopening | `proof-queue-governance.ts:307` | Deterioration -> `reopened` case; matches B(18). | `grep "reopened"` |
| QC-L-10 | Ownership Move | `proof-queue-governance.ts:312` | `ownershipChanged` reassignment; matches B(19). | `grep "ownershipChanged"` |
| QC-L-11 | HOD Correction | `academic-runtime-routes.ts:1285` | `clear-lock` route present; cycle chain formed. | `grep "clear-lock"` |
| QC-L-12 | Manual Concern | `monitoring-engine.ts:42` | `manualInterventionCount` includes teacher concern. | `grep "manualInterventionCount"` |

## Evidence

*   `concernContextKey` drift: `air-mentor-api/src/lib/proof-queue-governance.ts:149-156`
*   Taxonomy drift: `air-mentor-api/src/lib/proof-queue-governance.ts:144`
*   Workflow contamination: `air-mentor-api/src/lib/proof-queue-governance.ts:347-348`
*   Ownership routing: `air-mentor-api/src/lib/monitoring-engine.ts:43-65`
*   Calendar drag: `src/pages/calendar-pages.tsx:892-903`
*   HOD machine: `air-mentor-api/src/modules/academic-runtime-routes.ts:1285-1331`

## Mitigation Plan

1.  **Refactor Key**: 缩减 `concernContextKey` 至 4元组，去冗余 `courseCode`。
2.  **Cleanse Taxonomy**: 依 C(3) 收拢 `fallbackConcernFamily` 名。
3.  **Isolate Workflow**: `primaryCase` 设为 `family in PrimaryTaxonomy`；workflow tasks 归类 `ProofQueueWorkflowCategory`。
4.  **Inject Demo Flag**: 在 `governProofQueueStage` 引入 `isDemoMode`；`Next Stage` 时 `open -> resolved`。
5.  **Audit HOD Cycle**: 文档补齐 `recompute -> relock` 逻辑。

## Recommendations

*   **Frozen Key**: 4元组 literal 乃法，不可偏离。
*   **Frozen Taxonomy**: 5类主案乃界，不可混淆。
*   **Deterministic Bridge**: Calendar drag 须直通 API，保实。
*   **HOD Integrity**: Oversight view 须源于 persisted summary，防 runtime drift。
