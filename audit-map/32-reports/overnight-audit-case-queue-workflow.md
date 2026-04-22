# Overnight Audit: Primary Case / Queue / Workflow

- 範圍：`air-mentor-api/src/lib/proof-queue-governance.ts`、`air-mentor-api/src/lib/monitoring-engine.ts`、`air-mentor-api/src/lib/proof-active-run.ts`、`air-mentor-api/src/lib/proof-run-queue.ts`。
- 方式：唯讀審核；product source 未改。
- authority caveat：named pass prompt 缺 tracked corpus，故今依 proxy authority：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`、`audit-map/20-prompts/prompt-index.md:16-82`、`audit-map/14-reconciliation/overnight-unified-ledger.md:42-57`、`audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27`。
- pass mandate：諸 finding 一律映 `Phase 3`，雖其自然落點後續或分散於 queue/HOD/contract lanes。

## Findings

1. `F1` 主案 identity 期當可驗 `studentId + offeringId + concernFamily + semesterNumber`；現 queue contract 僅露 `caseKey/sourceKey/primarySourceKey/countsTowardCapacity`，未見 `concernContextKey` literal，故 primary-case 與 workflow-case 之 boundary 不可機械校驗。證：`air-mentor-api/src/lib/proof-queue-governance.ts:19-64`；proxy expectation：`audit-map/14-reconciliation/overnight-unified-ledger.md:42-42`。
2. `F2` 上游 case 粒度已寬：playback `caseKeyForStageSource` 與 live `liveCaseKey` 皆只到 `studentId::semesterNumber`；queue governance 之 deterministic tie-break 又僅至 `studentId::semesterNumber::courseCode`。`offeringId` 與 `concernFamily` 皆漏，故同學期多 offering / 多 concern 易並案。證：`air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:144-149`、`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:328-328`、`air-mentor-api/src/lib/proof-queue-governance.ts:254-279`。
3. `F3` 現行 closure 由 stage 推導：prior-open case 於 `post-see` 若仍有 watch candidate，直接標 `resolved`；若無 watch candidate，亦以 `no_longer_actionable` 標 `resolved`。此乃 stage-exit semantics，非 explicit dismissal/handled episode-close semantics。證：`air-mentor-api/src/lib/proof-queue-governance.ts:332-369`；proxy expectation：`audit-map/14-reconciliation/overnight-unified-ledger.md:45-49`。
4. `F4` prior state 過薄。`ProofQueuePriorCaseState` 僅 `{ open, primarySourceKey }`；既無 episode/case lineage，亦無 dismissal kind、reopen timestamp、new-case trigger。故「已關舊案 + 後續惡化新案」於此層無法被精確表述。證：`air-mentor-api/src/lib/proof-queue-governance.ts:44-47`、`air-mentor-api/src/lib/proof-queue-governance.ts:321-367`。
5. `F5` monitoring contract 無 concern/workflow/context 輸入。其 input 僅 `riskBand`、`cooldownUntil`、`evidenceWindowCount`、`interventionResidual` 等；caller 亦未傳 manual teacher-created concern、student-facing intervention、offering lineage、concern family。故「manual concern 算 intervention」無從在此層驗證。證：`air-mentor-api/src/lib/monitoring-engine.ts:1-9`、`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:677-685`、`air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:274-282`。
6. `F6` ownership 決策僅回 role label 與 note；未攜 task rewrite / reassignment contract。High→Mentor、Medium→Course Leader 於文字上成立，然 ownership change 並不在此層即時重寫 workflow tasks；HoD type 雖在 union 中，實作分支未回 HoD，approval/unlock/escalation 亦未由此函式表達。證：`air-mentor-api/src/lib/monitoring-engine.ts:11-17`、`air-mentor-api/src/lib/monitoring-engine.ts:39-74`；proxy expectation：`audit-map/14-reconciliation/overnight-unified-ledger.md:43-46`。
7. `F7` active-run selector 假定 caller 已全然淨化。函式僅依 `updatedAt -> createdAt -> activeOperationalSemester -> runLabel` 排序，未自驗 `activeFlag/status/sourceType`；然其為 HOD 與 academic gate 之 decisive selector，若出現雙 active / stale active rows，則 freshest row 先勝。證：`air-mentor-api/src/lib/proof-active-run.ts:1-16`、`air-mentor-api/src/lib/proof-control-plane-hod-service.ts:235-240`、`air-mentor-api/src/modules/academic.ts:2062-2069`。
8. `F8` queue worker 允 expired `running` row 被重新 claim，並以同一 `simulationRunId` 再次執行 `startProofSimulationRun`；其中無 idempotency fence，僅 lease-based reclaim。若舊 worker 遲到完成，則 active workflow / headline state 有重跑競態。證：`air-mentor-api/src/lib/proof-run-queue.ts:261-299`、`air-mentor-api/src/lib/proof-run-queue.ts:354-369`。
9. `F9` enqueue 採 opt-out activation。helper 以 `input.activate ?? true` 落 `requestedActivate`；另 batch refresh caller 亦明示 `activate: true`。故 queued rerun 之系統默姿偏向推 active workflow，而非保守待審。證：`air-mentor-api/src/lib/proof-run-queue.ts:143-176`、`air-mentor-api/src/modules/admin-structure.ts:1917-1925`。
10. `F10` retry 非新 attempt row，而係原 row 回寫 `status='queued'` 並自指 `retryOf`。此舉壓平 attempt lineage，使 queue provenance 與 active-run selection 更難區分「原執行」與「重試執行」。證：`air-mentor-api/src/lib/proof-run-queue.ts:213-258`、`air-mentor-api/src/modules/admin-proof-sandbox.ts:347-355`。

## Evidence

- proxy authority gap 已於 appendix 固化：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`。
- prompt corpus 可見 index，未見 named overnight prompt：`audit-map/20-prompts/prompt-index.md:16-82`。
- unified ledger 已鎖 queue/workflow 關鍵 drift：`concernContextKey` 缺碼、ownership routing、dismissal semantics、reopen deterioration、demo auto-resolution、HOD correction cycle。證：`audit-map/14-reconciliation/overnight-unified-ledger.md:42-57`。
- unified mitigation plan 雖自然 owner 未必同 lane，然本 pass 依 mandate 皆映 `Phase 3`。phase anchor：`audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27`。
- queue governance 之核心現況：candidate/decision contract、rank/admit path、watch/resolved branch。證：`air-mentor-api/src/lib/proof-queue-governance.ts:19-64`、`air-mentor-api/src/lib/proof-queue-governance.ts:224-377`。
- monitoring engine 之核心現況：input 無 case context，output 僅 role/note/timing。證：`air-mentor-api/src/lib/monitoring-engine.ts:1-75`。
- active-run helper 之核心現況：純 recency sort。證：`air-mentor-api/src/lib/proof-active-run.ts:1-16`。
- run queue 之核心現況：enqueue default activate、retry overwrite same row、lease reclaim rerun。證：`air-mentor-api/src/lib/proof-run-queue.ts:131-299`、`air-mentor-api/src/lib/proof-run-queue.ts:326-369`。

## Recommendations

- Phase 3 先鎖 case identity contract：補 `concernContextKey` 與 explicit episode/case id，且 producer/consumer 同步，不得再以 `caseKey` 泛指一切。
- Phase 3 先拆 primary-case lifecycle 與 workflow-task lifecycle：`handled/dismissed/closed` 應為顯式 episode state；`post-see` 不得以 stage alone 自動關案。
- Phase 3 擴 monitoring contract：至少納 `offeringId`、`concernFamily`、manual-origin、student-facing intervention count；ownership 變更須產可執行 task-rewrite signal。
- Phase 3 收緊 active-run / run-queue：selector 自驗 active truth；expired-run reclaim 須加 idempotency fence；retry 須新 attempt row；activate 改 explicit opt-in。
- Phase 3 handoff 文案須保留 authority gap：named prompt 缺席乃事實，不可偽造 appendix rule body。

## Findings Table

| ID | File | Expected | Current Code Truth | Severity | target_phase |
| --- | --- | --- | --- | --- | --- |
| F1 | `proof-queue-governance.ts` | 主案鍵可驗 `studentId+offeringId+concernFamily+semesterNumber` | contract 僅 `caseKey/sourceKey/primarySourceKey`；無 `concernContextKey`。`air-mentor-api/src/lib/proof-queue-governance.ts:19-64` | high | Phase 3 |
| F2 | `proof-queue-governance.ts` | 不同 offering / concern family / episode 不並案 | playback/live caseKey 只到 `studentId::semesterNumber`，queue tie-break 只到 `courseCode`。`air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:144-149`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:328-328`; `air-mentor-api/src/lib/proof-queue-governance.ts:254-279` | high | Phase 3 |
| F3 | `proof-queue-governance.ts` | dismissal=handled=episode close；後續惡化另起新案 | prior-open case 於 `post-see` / `no_longer_actionable` 直接 `resolved`。`air-mentor-api/src/lib/proof-queue-governance.ts:332-369` | high | Phase 3 |
| F4 | `proof-queue-governance.ts` | prior state 足表 closed/opened/reopened/new-case lineage | prior state 僅 `{ open, primarySourceKey }`。`air-mentor-api/src/lib/proof-queue-governance.ts:44-47`; `air-mentor-api/src/lib/proof-queue-governance.ts:321-367` | critical | Phase 3 |
| F5 | `monitoring-engine.ts` | workflow 決策可識別 manual concern 與 intervention semantics | input 無 student/offering/concern/manual fields；caller 亦未補。`air-mentor-api/src/lib/monitoring-engine.ts:1-9`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:677-685`; `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:274-282` | high | Phase 3 |
| F6 | `monitoring-engine.ts` | ownership change 即刻驅動 task reassignment；HoD 僅 approval/unlock/escalation | 函式僅返 role/note/timing；無 task rewrite contract，HoD branch 未實際返回。`air-mentor-api/src/lib/monitoring-engine.ts:11-17`; `air-mentor-api/src/lib/monitoring-engine.ts:39-74` | medium | Phase 3 |
| F7 | `proof-active-run.ts` | active-run selector 自證 active truth，避免 stale/freshness 偏選 | 純按 recency/semester/label sort；不驗 `activeFlag/status/sourceType`。`air-mentor-api/src/lib/proof-active-run.ts:1-16` | high | Phase 3 |
| F8 | `proof-run-queue.ts` | stale worker reclaim 不應再執同一 run 而重放 workflow | expired `running` row 可再 claim，且同 `simulationRunId` 重執。`air-mentor-api/src/lib/proof-run-queue.ts:261-299`; `air-mentor-api/src/lib/proof-run-queue.ts:354-369` | critical | Phase 3 |
| F9 | `proof-run-queue.ts` | queued rerun 僅顯式要求時始 activate | helper `input.activate ?? true`，且 batch refresh caller 明示 `activate: true`。`air-mentor-api/src/lib/proof-run-queue.ts:143-176`; `air-mentor-api/src/modules/admin-structure.ts:1917-1925` | medium | Phase 3 |
| F10 | `proof-run-queue.ts` | retry 應保留 fresh attempt lineage | retry 回寫同 row，再加自指 `retryOf`。`air-mentor-api/src/lib/proof-run-queue.ts:213-258` | medium | Phase 3 |

## Severity Distribution

| Severity | Count | Findings |
| --- | --- | --- |
| critical | 2 | `F4`, `F8` |
| high | 5 | `F1`, `F2`, `F3`, `F5`, `F7` |
| medium | 3 | `F6`, `F9`, `F10` |
| low | 0 | none |

## Target-Phase Mapping

- `Phase 3`：`F1`、`F2`、`F3`、`F4`、`F5`、`F6`、`F7`、`F8`、`F9`、`F10`。
- 映射依據：本 pass mandate 固定 `Phase 3`；report 不另改 bucket。plan anchor：`audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27`。
- 釋義：此 mapping 為審核出表之統一 staging bucket，非對 downstream natural owner lane 之再裁決。
