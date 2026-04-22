# Overnight Audit: Primary Case / Queue / Workflow

- 範圍：`air-mentor-api/src/lib/proof-queue-governance.ts`、`air-mentor-api/src/lib/monitoring-engine.ts`、`air-mentor-api/src/lib/proof-active-run.ts`、`air-mentor-api/src/lib/proof-run-queue.ts`。
- 法：唯讀深審；產品 source 未改。
- 權柄 caveat：指定 prompt `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 與 handoff `audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md` 皆未入 tracked corpus，故本報只取 proxy authority：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`、`audit-map/14-reconciliation/overnight-unified-ledger.md:42-57`、`audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27`。
- 統一映射：依 pass mandate，諸 finding 一律掛 `Phase 3`；此為稽核 staging bucket，非再分派 owner lane。

## Findings

1. `F1` `proof-queue-governance.ts`：期望主案 identity 可直驗 `studentId + offeringId + concernFamily + semesterNumber`；現 `ProofQueueCandidate`、`ProofQueuePriorCaseState`、`ProofQueueCaseDecision` 皆無 `concernContextKey` 與 `concernFamily`，僅留 `caseKey/sourceKey/primarySourceKey`。此使 primary-case 與 workflow artifact 之邊界須靠外部約定，非 contract 自證。證：`air-mentor-api/src/lib/proof-queue-governance.ts:19-64`。severity=`high`，target_phase=`Phase 3`。
2. `F2` `proof-queue-governance.ts`：期望並案/排序粒度至少含 offering 與 concern family；現 open/watch primary candidate 之 deterministic tie-break 只用 ``${studentId}::${semesterNumber}::${courseCode}``。同學期同生跨 offering 或同課多 concern family，易被壓平。證：`air-mentor-api/src/lib/proof-queue-governance.ts:254-299`。severity=`high`，target_phase=`Phase 3`。
3. `F3` `proof-queue-governance.ts`：期望 dismissal=handled=episode close，後續惡化另起新案；現 prior-open case 於 `post-see` 且仍有 watch candidate 時直接轉 `resolved`，無 watch candidate 時亦以 `no_longer_actionable` 轉 `resolved`。此為 stage-driven auto-close，非 episode-driven close。證：`air-mentor-api/src/lib/proof-queue-governance.ts:332-369`。severity=`high`，target_phase=`Phase 3`。
4. `F4` `proof-queue-governance.ts`：期望 prior state 足表 episode lineage、dismissal kind、reopen 與 later-deterioration new-case trigger；現 prior state 僅 `{ open, primarySourceKey }`。故「舊案已閉、後續惡化另起新案」於治理層不可被精確表達。證：`air-mentor-api/src/lib/proof-queue-governance.ts:44-47`、`air-mentor-api/src/lib/proof-queue-governance.ts:321-369`。severity=`critical`，target_phase=`Phase 3`。
5. `F5` `monitoring-engine.ts`：期望 workflow 決策可區分 manual teacher-created concern、student-facing intervention、offering lineage、concern family；現 input 僅 `riskProb/riskBand/previousRiskBand/cooldown/evidenceWindowCount/interventionResidual/nowIso`，caller 亦未補前述欄位。故「manual concern 算 intervention」於此層無從成立。證：`air-mentor-api/src/lib/monitoring-engine.ts:1-17`、`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:677-685`、`air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:274-282`。severity=`high`，target_phase=`Phase 3`。
6. `F6` `monitoring-engine.ts`：期望 ownership change 即時產 task rewrite / reassignment contract，且 HoD 僅承 approval/unlock/escalation/oversight；現函式只返 `queueOwnerRole`、due/cooldown、note，且分支僅 `High -> Mentor`、`Medium/Low -> Course Leader`，`HoD` 雖在型別 union 中而實作不可達。證：`air-mentor-api/src/lib/monitoring-engine.ts:11-17`、`air-mentor-api/src/lib/monitoring-engine.ts:25-74`。severity=`medium`，target_phase=`Phase 3`。
7. `F7` `proof-active-run.ts`：期望 active-run selector 自驗 active truth，免 stale row 以 freshness 奪權；現 helper 僅按 `updatedAt -> createdAt -> activeOperationalSemester -> runLabel` 排序，完全不驗 `activeFlag/status/sourceType`，其 caller 雖多先行過濾，然 helper 本身不保證語義。證：`air-mentor-api/src/lib/proof-active-run.ts:1-16`、`air-mentor-api/src/lib/proof-control-plane-hod-service.ts:235-240`、`air-mentor-api/src/modules/academic.ts:2063-2069`。severity=`high`，target_phase=`Phase 3`。
8. `F8` `proof-run-queue.ts`：期望 expired worker reclaim 不重放同一 run；現 claim query 允 `status='running'` 且 lease 過期之 row 再被 claim，後續以同一 `simulationRunId` 再呼 `startProofSimulationRun`。若舊 worker 遲到完成，則 workflow/headline state 有重放競態。證：`air-mentor-api/src/lib/proof-run-queue.ts:261-299`、`air-mentor-api/src/lib/proof-run-queue.ts:354-369`、`air-mentor-api/src/lib/proof-run-queue.ts:426-433`。severity=`critical`，target_phase=`Phase 3`。
9. `F9` `proof-run-queue.ts`：期望 retry 保留新 attempt lineage；現 retry 直接回寫同 row 為 `queued`，保留原 `createdAt`，並於 `progressJson` 自指 `retryOf: run.simulationRunId`。attempt provenance 被壓平，後續 audit 難辨首次執行與重試。證：`air-mentor-api/src/lib/proof-run-queue.ts:213-258`。severity=`medium`，target_phase=`Phase 3`。
10. `F10` `proof-run-queue.ts`：期望 queued rerun 以明示 opt-in 才 activate；現 enqueue helper 採 `input.activate ?? true`，且批次 refresh caller 明示 `activate: true`。此使 queue worker 之默姿偏向直接推 active workflow，而非保守排隊待審。證：`air-mentor-api/src/lib/proof-run-queue.ts:131-176`、`air-mentor-api/src/modules/admin-structure.ts:1917-1925`。severity=`medium`，target_phase=`Phase 3`。

## Evidence

- authority gap 已凍結：tracked corpus 無 named prompt；appendix 不得合成 rule。證：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`。
- queue/workflow 之 proxy truth 已入 unified ledger：`concernContextKey` 缺碼、ownership routing、dismissal semantics、reopen deterioration、workflow task != primary case。證：`audit-map/14-reconciliation/overnight-unified-ledger.md:42-57`。
- mitigation plan 之 phase anchor：本 pass 依 mandate 將全部 finding 對映 `Phase 3`。證：`audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27`。
- `proof-queue-governance.ts` 現碼主軸：candidate/decision contract、grouping、cap-prune、watch/resolved branch。證：`air-mentor-api/src/lib/proof-queue-governance.ts:19-64`、`air-mentor-api/src/lib/proof-queue-governance.ts:224-377`。
- `monitoring-engine.ts` 現碼主軸：workflow decision 僅依 risk band 與 residual/cooldown，無 concern/manual/task rewrite contract。證：`air-mentor-api/src/lib/monitoring-engine.ts:1-75`。
- `proof-active-run.ts` 現碼主軸：純 recency selector。證：`air-mentor-api/src/lib/proof-active-run.ts:1-16`。
- `proof-run-queue.ts` 現碼主軸：enqueue default activate、retry overwrite same row、expired-running reclaim。證：`air-mentor-api/src/lib/proof-run-queue.ts:131-299`、`air-mentor-api/src/lib/proof-run-queue.ts:354-477`。

## Recommendations

- `Phase 3` 先補 case identity contract：`concernContextKey`、`concernFamily`、episode/case id 三者須同時入 queue producer/consumer，免再以 `caseKey` 泛代。
- `Phase 3` 將 primary-case lifecycle 與 workflow-task lifecycle 明拆：`dismissed/handled/closed` 應為顯式 episode state，`watch` 僅 workflow visibility，不得反寫 headline close。
- `Phase 3` 擴 monitoring contract：至少納 manual-origin、student-facing intervention 計數、offeringId、concernFamily；ownership change 應輸出可執行 reassignment signal，而非 note-only。
- `Phase 3` 收緊 run authority：active-run helper 應僅接受已驗 active rows或自驗 active truth；queue reclaim 須加 idempotency fence；retry 應新建 attempt row。
- `Phase 3` 改 activation 默姿：背景 rerun 改 explicit opt-in activate，並將 queue/projection provenance 分清「queued」「executed」「activated」三層。

## Findings Table

| ID | Owner File | Expected | Current Code Truth | Severity | target_phase | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | `proof-queue-governance.ts` | 主案鍵可直驗 `studentId + offeringId + concernFamily + semesterNumber` | contract 無 `concernContextKey` / `concernFamily`，僅 `caseKey/sourceKey/primarySourceKey` | high | Phase 3 | `air-mentor-api/src/lib/proof-queue-governance.ts:19-64` |
| F2 | `proof-queue-governance.ts` | 並案/排序粒度不可忽略 offering 與 concern family | deterministic tie-break 僅 `studentId::semesterNumber::courseCode` | high | Phase 3 | `air-mentor-api/src/lib/proof-queue-governance.ts:254-299` |
| F3 | `proof-queue-governance.ts` | dismissal=handled=closed；後續惡化另起新案 | `post-see` prior-open + watch candidate 直轉 `resolved`；無新 candidate 亦以 `no_longer_actionable` 轉 `resolved` | high | Phase 3 | `air-mentor-api/src/lib/proof-queue-governance.ts:332-369` |
| F4 | `proof-queue-governance.ts` | prior state 足表 episode lineage/reopen/new-case trigger | prior state 僅 `{ open, primarySourceKey }` | critical | Phase 3 | `air-mentor-api/src/lib/proof-queue-governance.ts:44-47`; `air-mentor-api/src/lib/proof-queue-governance.ts:321-369` |
| F5 | `monitoring-engine.ts` | workflow 決策可識別 manual concern、student-facing intervention、offering lineage | input/caller 皆無 manual/offering/concern fields | high | Phase 3 | `air-mentor-api/src/lib/monitoring-engine.ts:1-17`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:677-685`; `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:274-282` |
| F6 | `monitoring-engine.ts` | ownership change 即時驅動 task rewrite；HoD 僅 approval/unlock/escalation | output 僅 role/due/cooldown/note；實作僅回 Mentor 或 Course Leader，HoD 不可達 | medium | Phase 3 | `air-mentor-api/src/lib/monitoring-engine.ts:11-17`; `air-mentor-api/src/lib/monitoring-engine.ts:25-74` |
| F7 | `proof-active-run.ts` | selector 自證 active truth，免 stale row 奪權 | helper 純按 recency/semester/label 排序 | high | Phase 3 | `air-mentor-api/src/lib/proof-active-run.ts:1-16`; `air-mentor-api/src/lib/proof-control-plane-hod-service.ts:235-240`; `air-mentor-api/src/modules/academic.ts:2063-2069` |
| F8 | `proof-run-queue.ts` | lease reclaim 不得重放同一 run | expired `running` row 可再 claim，且以同 `simulationRunId` 再執行 | critical | Phase 3 | `air-mentor-api/src/lib/proof-run-queue.ts:261-299`; `air-mentor-api/src/lib/proof-run-queue.ts:354-369`; `air-mentor-api/src/lib/proof-run-queue.ts:426-433` |
| F9 | `proof-run-queue.ts` | retry 應形成新 attempt lineage | retry 回寫同 row，`retryOf` 自指原 id，`createdAt` 不變 | medium | Phase 3 | `air-mentor-api/src/lib/proof-run-queue.ts:213-258` |
| F10 | `proof-run-queue.ts` | queued rerun 僅明示要求時 activate | helper `input.activate ?? true`；batch refresh caller 固定 `activate: true` | medium | Phase 3 | `air-mentor-api/src/lib/proof-run-queue.ts:131-176`; `air-mentor-api/src/modules/admin-structure.ts:1917-1925` |

## Severity Distribution

| Severity | Count | Findings |
| --- | --- | --- |
| critical | 2 | `F4`, `F8` |
| high | 5 | `F1`, `F2`, `F3`, `F5`, `F7` |
| medium | 3 | `F6`, `F9`, `F10` |
| low | 0 | none |

## Target-Phase Mapping

- `Phase 3`：`F1`、`F2`、`F3`、`F4`、`F5`、`F6`、`F7`、`F8`、`F9`、`F10`。
- 依據：pass mandate 已定「Map every finding to Phase 3」；本報不另拆自然 owner lane。phase anchor：`audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27`。
- 含義：此 mapping 供 unified mitigation merge 與後續排程；不表示諸 drift 自然都屬 semester-authority docs lane。
