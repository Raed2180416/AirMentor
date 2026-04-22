# Overnight Unified Mitigation Plan

- 此 phase `1..11` 乃 downstream merge-order，非 `final-authoritative-plan` 原 phase 号之逐字复制。
- 权威闸：named prompt / frozen appendix 于 tracked corpus 皆缺；故 plan 以 `docs/closeout/final-authoritative-plan.md` `Phase 1/5/7/8` 与 ATM `07A/07B/07C` 为 proxy authority，仅排可证变更。
- 推次：先改 vocabulary / docs truth，再改 producer/consumer contract，末后跑 regression 与 handoff freeze。

## Phase 1

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `audit-map/14-reconciliation/final-decision-appendix.md` | file root | 冻结 appendix gap：明记 named prompt/appendix 缺席，`Overnight Additions (2026-04-22)` 为空，禁 synthetic frozen rules。 | `rg -n "Frozen Status|Overnight Additions|None" audit-map/14-reconciliation/final-decision-appendix.md` | named prompt 真入 tracked corpus 后，仅以 direct section-cited append 替换空白项。 |
| `audit-map/14-reconciliation/overnight-unified-ledger.md` | authority note; merge rule | 固化 proxy authority、dedupe rule、open-vs-resolved boundary，供后续 impl node 同读。 | `rg -n "locked-proxy|Merge rule|Open implementation drifts" audit-map/14-reconciliation/overnight-unified-ledger.md` | 若 direct authority 复现，则重跑 ledger merge；不保留 proxy-only wording。 |
| `audit-map/24-agent-memory/working-knowledge.md` | overnight merge section | 统一记忆：`completed-inspectable`、`workflow task != primary case`、ML 四层分拆、appendix 无新增。 | `rg -n "Overnight Merge Final Decisions|completed-inspectable|workflow task != primary case" audit-map/24-agent-memory/working-knowledge.md` | 若 upstream truth 变，则以新 ledger section 覆旧记忆段。 |

## Phase 2

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` | activation contract; reset flow | 补 activation dual gate、run/batch rewrite、active-only republish、`complete-reset = restore snapshot -> new active run`。 | `rg -n "semesterStart|available semester|activeOperationalSemester|complete-reset" docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md air-mentor-api/src/lib/proof-control-plane-activation-service.ts air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | 若 prose 误导 live operators，则回退至 “route exists only” 并重写 with exact backend terms。 |
| `air-mentor-api/src/lib/proof-control-plane-activation-service.ts` | `activateSemesterForProofRun` | 若 impl node 触码，则仅补 comments / diagnostics，不改 gate order。 | focused backend proof activation test or `rg -n "semesterStart|semesterEnd|availableSemesters" air-mentor-api/src/lib/proof-control-plane-activation-service.ts` | 任何 gate-order regression 一律回退，保持 `range -> checkpoint availability -> rewrite -> republish`。 |

## Phase 3

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md` | semester authority narrative | 补 operational `run -> batch` 与 checkpoint `checkpoint -> run -> batch` ladders，及 drift reroute rule。 | `rg -n "activeOperationalSemester|checkpoint semester|reroute|run -> batch" docs/closeout/stage-07b-semester-1-to-3-proof-walk.md air-mentor-api/src/lib/proof-control-plane-tail-service.ts` | 若 ladder 文案与 code 冲突，先删 prose，待 service truth 再补。 |
| `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md` | stage/date/progression narrative | 补 `run.activeStageKey` authority、fixed offsets、chain-first gate-second、queue/task clearance、first-blocked cascade、`reset-current-stage` 定名。 | `rg -n "activeStageKey|semesterDayOffset|admin-confirmed|first blocked|reset-current-stage" docs/closeout/stage-07c-semester-4-to-6-proof-walk.md air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts air-mentor-api/src/lib/stage-policy.ts air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts` | 若 walkthrough copy 仍引 UI intuition，则回退新增 prose，仅保留 code-quoted facts。 |

## Phase 4

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/proof-queue-governance.ts` | contract / queue pruning | 明锁 taxonomy：primary case、`countsTowardCapacity`、watch-vs-blocking。若 future impl 引 `concernContextKey`，须保持旧键兼容。 | `rg -n "countsTowardCapacity|governanceReason|assignedRole|caseKey" air-mentor-api/src/lib/proof-queue-governance.ts` | 若 new key 破坏 existing payload readers，则回退新键，仅保留 old contract。 |
| `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | taxonomy recommendations | 将 `workflow task != primary case` 与 `watching visible != blocking` 提升为 canonical wording。 | `rg -n "workflow task|primary case|Watching" audit-map/32-reports/overnight-reconcile-queue-calendar.md` | 若 later code adds hybrid semantics，删 canonical claim，改为 conditional wording。 |

## Phase 5

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `src/pages/calendar-pages.tsx`, `src/calendar-utils.ts`, `src/App.tsx` | drag / reschedule / audit path | 保留且明文验证 “drag/detail-reschedule = `onScheduleTask` -> `dueDateISO` write -> calendar audit”；不得退回 pure-preview 叙事。 | frontend tests `tests/calendar-utils.test.ts` plus `rg -n "onScheduleTask|applyPlacementToTask|task-rescheduled" src/pages/calendar-pages.tsx src/calendar-utils.ts src/App.tsx` | 若 UX redesign 改路径，需同时更正文档与 audit event 名，不可只改 UI。 |
| `src/pages/hod-pages.tsx`, `air-mentor-api/src/modules/academic-runtime-routes.ts` | HOD correction flow / clear-lock | 串成单链：`request -> approve/reject -> clear-lock/reset-unlock -> edit -> recompute -> relock`；保留 `CLEAR_LOCK` 与 `lock:true` relock truth。 | `rg -n "clear-lock|CLEAR_LOCK|lock: true|Reset completed and unlocked" src/pages/hod-pages.tsx src/App.tsx air-mentor-api/src/modules/academic-runtime-routes.ts` | 若 route semantics 改变，则先回退文案链路，不带 stale step。 |

## Phase 6

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | model/policy/monitoring/runtime headings | 将四层分栏固化到所有 ML closeout / handoff 文；明确“五头先行，band 后映”。 | `rg -n "model|policy|monitoring|simulator-runtime|head first, band second" audit-map/08-ml-audit/README.md audit-map/32-reports/overnight-reconcile-ml.md` | 若 downstream docs 无法维持四层分栏，则至少保留 explicit owner sentence per claim。 |
| `air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/src/lib/inference-engine.ts`, `air-mentor-api/src/lib/monitoring-engine.ts` | scorer / explainer / workflow split | impl node 若补注释或 telemetry，须强化分层，不可把 monitoring/driver logic回写成 model output。 | targeted ML/unit tests plus `rg -n "RiskHeadKey|inferObservableRisk|buildMonitoringDecision" air-mentor-api/src/lib/proof-risk-model.ts air-mentor-api/src/lib/inference-engine.ts air-mentor-api/src/lib/monitoring-engine.ts` | 若 instrumentation 造成 public contract drift，则回退 instrumentation。 |

## Phase 7

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`, `air-mentor-api/src/modules/academic.ts` | feature payload builders | 真补 v8 missingness 时，须贯通 `cgpaMissing` / `backlogMissing` callers 至 `buildObservableFeaturePayload`；未贯通前，文档保留 `superseded`。 | `rg -n "cgpaMissing|backlogMissing|buildObservableFeaturePayload" air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts air-mentor-api/src/lib/proof-control-plane-runtime-service.ts air-mentor-api/src/modules/academic.ts air-mentor-api/src/lib/proof-risk-model.ts` | 若 retrain 未就绪，则回退 caller changes 与 artifact promotion，一并恢复 old feature flags。 |
| `air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/output/proof-risk-model/evaluation-report.json` | calibrator / challenger truth | 仅当 artifact 真变更后，方可改 “active calibrator” 与 “serious challenger family” 文案；CatBoost 不得先宣。 | `rg -n "isotonic|beta|depth-2-tree|CatBoost" air-mentor-api/src/lib/proof-risk-model.ts air-mentor-api/output/proof-risk-model/evaluation-report.json air-mentor-api/catboost_info/catboost_training.json` | 若 challenger experiment 失败，则保留 current `depth-2-tree` truth，不保留 half-wired family union。 |

## Phase 8

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/proof-control-plane-playback-service.ts` | intervention utility | 若产品坚持 prompt intent，则以 multiplicative response fn 取代现 additive blend，并同步文档明示 new factors。 | `rg -n "0.35 .* next|0.35 .* stable|0.2 .* close" air-mentor-api/src/lib/proof-control-plane-playback-service.ts` plus focused policy tests | 若 multiplicative fn 伤现 regression，则回退 fn 公式，并把 doc 状态恢复为 open drift。 |
| `air-mentor-api/src/db/schema.ts` | `student_latent_states` | 若 latent responsiveness 要升为 first-class truth，则加列，不再仅 `latentStateJson`；迁移前文档不得伪称已实现。 | schema diff + focused backend tests around latent-state read/write | 若 migration 未完整 rollout，则回退 schema change，保持 JSON-only truth。 |
| `audit-map/32-reports/overnight-reconcile-ml.md` | counterfactual wording | 所有 counterfactual prose 仅可写 same-checkpoint no-action comparator，不得跨阶段泛化。 | `rg -n "same-checkpoint|no-action" audit-map/32-reports/overnight-reconcile-ml.md air-mentor-api/src/lib/proof-control-plane-policy-service.ts air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | 若 policy contract later expands, rewrite all docs in one batch; 不留 mixed wording。 |

## Phase 9

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/proof-queue-governance.ts`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`, `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` | `concernContextKey` producer/consumer path | 若 appendix/spec 终需 `concernContextKey`，须于 queue contract、playback detailJson、runtime payload、HOD parser 四端同补；不可拿 `queueCaseId` / `primaryCase` 代称。 | `rg -n "concernContextKey|queueCaseId|primaryCase|countsTowardCapacity" air-mentor-api/src/lib` | 任一 consumer 未就绪即整体回退新 literal，保老键。 |
| `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts` | case identity key | 收紧 governance case identity 粒度，至少向 training key 靠近，避免 `studentId::semesterNumber` 过宽。 | `rg -n "caseKey|studentId::semesterNumber|stageKey" air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts air-mentor-api/src/lib/proof-risk-model.ts` | 若 new key 破坏 historical continuity / reopen semantics，则回退 key scheme 并补 migration plan。 |

## Phase 10

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | seeded profile / offering bootstrap / electives | 清 sem6 residue：避免 `currentSemester: 6`、`sem6Options`、hard-coded sem6 bootstrap 继续污染 activeOperationalSemester contract。 | `rg -n "currentSemester: 6|sem6Options|semester 6|activeOperationalSemester" air-mentor-api/src/lib/msruas-proof-control-plane.ts` | 若 active-semester walkthrough regress，则回退 sem6 cleanup 并保留 residue note。 |
| `docs/closeout/final-authoritative-plan.md` (future reference only) | Phase 1 / 4 / 7 / 8 crosswalk | downstream impl 写 closeout 时，须将 sem6 cleanup 同 Phase 1 count provenance、Phase 4 parity、Phase 7 semester walk、Phase 8 role flows一并复核。 | run focused role + proof tests after cleanup | 若 one role regresses，回退 cleanup patch，保留 doc-only TODO。 |

## Phase 11

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/tests/*`, `tests/*` | proof / ML / queue / calendar / HOD suites | 最少跑 focused packs：proof activation / tail / checkpoint / risk model / risk explorer / HOD pages / student shell / calendar utils；sandbox 若阻 DB listener，则保留 command + blocker evidence。 | `air-mentor-api/tests/risk-explorer.test.ts`, `air-mentor-api/tests/student-agent-shell.test.ts`, `air-mentor-api/tests/hod-proof-analytics.test.ts`, `air-mentor-api/tests/proof-risk-model.test.ts`, `tests/calendar-utils.test.ts`, `tests/risk-explorer.test.tsx`, `tests/student-shell.test.tsx` | 任一 focused suite regression，则回退最近 phase patch；不得带 failing known-regression 前推。 |
| `audit-map/14-reconciliation/reconciliation-log.md`, `audit-map/24-agent-memory/working-knowledge.md` | final handoff freeze | 写明 open drifts、phase order、rollback triggers、proxy-authority caveat；downstream node 先读 unified plan。 | `rg -n "unified plan|proxy authority|open drifts|rollback" audit-map/14-reconciliation/reconciliation-log.md audit-map/24-agent-memory/working-knowledge.md` | 若 later pass supersedes plan，则新增 dated section；不重写历史 phase order。 |

## Phase Ordering Notes

- P1 先锁 authority/source gap，与 frozen-rule non-action。
- P2-P5 先收 proof / queue / calendar / HOD 叙事真值，免 downstream 依 stale prose 动手。
- P6-P8 再拆 ML doc truth 与真实 code gaps，避免 calibration / challenger / multiplicative fn 混写。
- P9-P10 才触 contract-sensitive impl：`concernContextKey`、case identity、sem6 residue。
- P11 最后跑 focused regression，并固化 handoff / rollback。
