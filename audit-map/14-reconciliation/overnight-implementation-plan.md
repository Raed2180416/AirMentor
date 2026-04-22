# Overnight Implementation Plan

- 权威注：命名 prompt `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 于此 tracked corpus 缺；故今文仅据 frozen appendix、unified mitigation plan、五份 code audit 汇总，不改 appendix rule body。证：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`, `audit-map/32-reports/overnight-unified-mitigation-plan.md:3-5`.
- 排次注：本计划守下游硬闸之 phase 顺 `1→2→3→4→5→6→8→7→9→10→11`；`Phase 8` 先于 `Phase 7`，以先定 overload 因，再训 v8 baseline。证：`audit-map/32-reports/overnight-unified-mitigation-plan.md:86-92`.
- 行规：各 row 皆给 `file | location | change | test | rollback | owner_phase`；`location` 只写实存 `file:line`，供 downstream impl node 直跳。

## Phase 1 — Run Authority

先收 run-row authority、Fresh-Sem1 seed truth、runtime semester authority、lifecycle selector 一致性。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P1-1 | `air-mentor-api/src/db/schema.ts`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | `air-mentor-api/src/db/schema.ts:475-505`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4333-4354` | 为 `simulation_runs` 补齐 `activeStageKey`、`simulatedDateIso`、`setupConfigJson`、`scenarioConfigJson`、`lifecycleState`、`runMode`、`stageBoundaryJson` 等持久 authority；run activate/archive/restore 只读写同一 contract。 | schema migration test；run CRUD parity test；activation/archive/restore snapshot round-trip。 | 新栏位先 nullable + dual-write；若 selector/activation 回归，即停新写、保旧读、回退 migration 使用面。 | Phase 1 |
| P1-2 | `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts`; `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:61-65`; `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:81-105`; `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:92-358` | 另开 Fresh-Sem1 seed lane：`semesterStart=1`、`activeOperationalSemester=1`、`pre-tt1`、无 fake transcript；禁 `ensureSem6Offerings` 与 sem1..5 synthetic observed history。 | seeded bootstrap fixture；Sem1 no-transcript proof seed test；seeded semester snapshot golden。 | 以 feature flag 保旧 sem6 seed path；若 new lane 破现回放，则切回旧 path，保留新 lane 代码不启用。 | Phase 1 |
| P1-3 | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:172-186`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294-297`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:686-730` | seeded finalize 不再以 fake observed rows 回写 live profile；runtime recompute 一律服 `run.activeOperationalSemester`，不得再以 terminal semester 产 active evidence/risk。 | runtime recompute respects active semester test；seeded finalize no-profile-writeback test；risk row semester parity assertion。 | 若 recompute 改动致 active risk 空窗，则回退 runtime semester source 至旧逻辑，同时停发新 risk rows。 | Phase 1 |
| P1-4 | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts`; `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts`; `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts` | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:401-428`; `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:454-457`; `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:245-248` | 统一 `completed-inspectable` 后端语义：producer/consumer 同看单一 lifecycle authority；移除 tail `?? 6` fallback，no-active-run 时回 explicit unavailable。 | activeFlag/status parity suite；faculty tail no-fallback test；operator lifecycle smoke。 | 若 selector 大面积失效，则先回退为旧 activeFlag path，但保留 unavailable sentinel 与 sem6 fallback 删除。 | Phase 1 |

### Test Additions

- 新增 Fresh-Sem1 seed fixture：验 `no historical transcript`、`activeOperationalSemester=1`、`pre-tt1` 起跑。
- 新增 run-row persistence pack：验 activation/archive/restore 后 authority 欄未丢。
- 新增 runtime semester authority pack：验 active risk/evidence semester 与 selected run 一致。

### Validation Gates

- 任一 active run 皆可于 DB 直读 `activeOperationalSemester`、`activeStageKey`、`simulatedDateIso`、`lifecycleState`。
- Fresh-Sem1 seed 不得生成 sem1..5 synthetic transcript/observed rows，亦不得触 live profile writeback。
- 无 active run 时，faculty/student tail 仅回 unavailable，不得再透出 implicit sem6。

### Rollback Strategy

- schema dual-write 先上，reader 切换后再删旧分支；若 reader 异常，先回读旧字段，不急删新字段。
- seed lane 以 explicit flag 切流；新 lane 不稳即切回旧 lane，并冻结下游 phase。

## Phase 2 — Feature / Evidence / Runtime

先封 zero-vs-missingness、stage authority、stale risk reuse、checkpoint-bound observed state、assessment 即时重算。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P2-1 | `air-mentor-api/src/lib/proof-risk-model.ts` | `air-mentor-api/src/lib/proof-risk-model.ts:60-74`; `air-mentor-api/src/lib/proof-risk-model.ts:509-512`; `air-mentor-api/src/lib/proof-risk-model.ts:2272-2334` | 修 feature builder：`0` 分视为有效 evidence；`cgpaMissing/backlogMissing` 由 caller 显式传入，不得再以 `false` 静默补空。 | model feature unit tests for zero-score inclusion；missingness fixture tests；feature snapshot diff。 | 若 serving 侧暂未全贯通，则先保旧 numeric path，但把 silent default 改 hard-fail / log。 | Phase 2 |
| P2-2 | `air-mentor-api/src/modules/academic.ts`; `air-mentor-api/src/lib/inference-engine.ts` | `air-mentor-api/src/modules/academic.ts:1197-1217`; `air-mentor-api/src/modules/academic.ts:1424-1462`; `air-mentor-api/src/modules/academic.ts:2593-2614`; `air-mentor-api/src/modules/academic.ts:3336-3349`; `air-mentor-api/src/lib/inference-engine.ts:9-22`; `air-mentor-api/src/lib/inference-engine.ts:53-79` | academic/runtime/degraded scorer 全面传 `cgpaMissing`、`backlogMissing`、authoritative `stageKey/sourceRefs`；禁再以 `offering.stage` 与 zero fallback 代 authority。 | academic runtime risk pack；degraded inference parity tests；stage one-hot propagation assertions。 | 若 fallback scorer 暂无法同构，则先保 stageKey/sourceRefs，missingness 维持 warning-only，不放大 drift。 | Phase 2 |
| P2-3 | `air-mentor-api/src/db/schema.ts`; `air-mentor-api/src/modules/academic.ts`; `air-mentor-api/src/modules/academic-runtime-routes.ts`; `air-mentor-api/src/lib/proof-observed-state.ts`; `air-mentor-api/src/lib/proof-provenance.ts` | `air-mentor-api/src/db/schema.ts:870-886`; `air-mentor-api/src/modules/academic.ts:2802-2818`; `air-mentor-api/src/modules/academic.ts:2958-2964`; `air-mentor-api/src/modules/academic.ts:3295-3336`; `air-mentor-api/src/modules/academic.ts:3408-3426`; `air-mentor-api/src/modules/academic-runtime-routes.ts:1193-1278`; `air-mentor-api/src/lib/proof-observed-state.ts:5-10`; `air-mentor-api/src/lib/proof-provenance.ts:24-78` | persisted risk key 至少纳 `simulationRunId + assessmentScope + evidenceWindow`；checkpoint observed summary 改绑 selected checkpoint / predecessor chain；assessment commit 后同步 invalidate + recompute risk；provenance 增 stage/evidence identity。 | persisted-risk key migration test；checkpoint overlay regression test；assessment commit immediate-visibility E2E；provenance shape snapshot。 | 若 rekey 迁移风险高，则先双写新 key + 旧 key，并让 reader 优先新 key；若 recompute 耗时过高，则先异步排队但强制 stale-read miss。 | Phase 2 |

### Test Additions

- 新增 `0` 分、`null`、missing flag 三分离 fixture，覆盖 coursework/CGPA/backlog。
- 新增 runtime/playback stage authority suite，验 `sourceRefs.stageKey` 真入 score path。
- 新增 assessment-commit parity test，验输入 quiz/assignment 后 risk 即变。

### Validation Gates

- `0` 分不再从 averages/features 消失；missingness 不再塌为 `false` 或 `0`。
- persisted risk 读 path 命中当前 run/current scope/current evidence window，旧 run 不得覆今值。
- selected checkpoint 切换后，observed summary 与 provenance 同步换向，不得复用同学期晚于该 checkpoint 之 row。

### Rollback Strategy

- risk rekey 采双写双读；若读链不稳，reader 回旧 key，但保留新 key 填充。
- immediate recompute 若压垮写路，则切 async queue + stale-miss policy，不退回 stale persisted risk 优先级。

## Phase 3 — Primary Case / Queue / Workflow

先拆 primary case 与 workflow task，补 case identity、episode lineage、active-run selector、queue idempotency。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P3-1 | `air-mentor-api/src/lib/proof-queue-governance.ts` | `air-mentor-api/src/lib/proof-queue-governance.ts:19-64`; `air-mentor-api/src/lib/proof-queue-governance.ts:254-299` | 在 queue candidate/decision/prior state 中补 `concernContextKey`、`concernFamily`、offering-aware case identity；排序/并案不再仅靠 `studentId::semester::courseCode`。 | queue governance unit tests for multi-offering same-course collisions；identity snapshot tests。 | 若 consumer 尚未就绪，则先双写新旧 key；reader 保旧 key 优先，不让 reopen 历史断裂。 | Phase 3 |
| P3-2 | `air-mentor-api/src/lib/proof-queue-governance.ts`; `air-mentor-api/src/lib/monitoring-engine.ts` | `air-mentor-api/src/lib/proof-queue-governance.ts:321-369`; `air-mentor-api/src/lib/monitoring-engine.ts:1-17`; `air-mentor-api/src/lib/monitoring-engine.ts:25-74` | 将 primary-case lifecycle 明拆为 `opened/open/watch/resolved/dismissed/reopened` episode 状态；workflow monitoring input/output 补 manual-origin、offeringId、concernFamily、reassignment signal。 | episode lifecycle tests；watch-vs-resolved parity tests；monitoring contract snapshot tests。 | 若 downstream surface 先只懂旧 enums，则先新增 fields/notes，不即删旧 `resolved` 分支。 | Phase 3 |
| P3-3 | `air-mentor-api/src/lib/proof-active-run.ts`; `air-mentor-api/src/lib/proof-run-queue.ts` | `air-mentor-api/src/lib/proof-active-run.ts:1-16`; `air-mentor-api/src/lib/proof-run-queue.ts:131-176`; `air-mentor-api/src/lib/proof-run-queue.ts:213-258`; `air-mentor-api/src/lib/proof-run-queue.ts:261-299`; `air-mentor-api/src/lib/proof-run-queue.ts:354-433` | `selectMostRecentProofRun` 仅吃已验 active rows或自验 lifecycle；queue retry 改新 attempt row；expired lease reclaim 加 idempotency fence；默认 `activate=false`，仅 explicit opt-in activate。 | queue worker reclaim race tests；retry lineage tests；active-run selector contract tests。 | 若 reclaim fence 影响吞吐，则先保 fence 于 active rerun lane，其他 queue 维持旧 claim 逻辑。 | Phase 3 |

### Test Additions

- 新增同生同课跨 offering / concern-family collision fixture。
- 新增 `post-see` watch-only vs resolved episode tests。
- 新增 expired-lease dual-worker race simulation，验不重放同一 `simulationRunId`。

### Validation Gates

- primary case 与 workflow task 各自有 stable id；task close 不得直接等同 case close。
- queue retry 必生成可追 attempt lineage；审计可分首跑、重试、激活三层。
- active-run helper 不得仅凭 recency 夺权；非 active row 永不被选中。

### Rollback Strategy

- 新旧 case key 并存一段窗口；若 HOD/runtime consumer 未跟上，维持旧 key 读取。
- reclaim fence 若引 worker 堵塞，可局部关闭 new reclaim path，但保留 retry 新 attempt 设计。

## Phase 4 — Queue / Calendar Bridge

先固 `watching visible != blocking`、`workflow task != primary case`、calendar due-date 写回与 audit 事件。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P4-1 | `air-mentor-api/src/lib/proof-queue-governance.ts`; `src/domain.ts` | `air-mentor-api/src/lib/proof-queue-governance.ts:82-86`; `air-mentor-api/src/lib/proof-queue-governance.ts:309-349`; `src/domain.ts:286-318`; `src/domain.ts:429-437` | 固化 `countsTowardCapacity`、`watch` 非 blocking、`SharedTask` 仅 workflow 层；任何 queue/calendar bridge 不得把 task 当 primary concern case。 | queue capacity tests；domain type contract snapshot；HOD aggregate counts tests。 | 若前端旧 surface 仍依赖 task-as-case 文义，则先保 alias 字段，不改 canonical semantics。 | Phase 4 |
| P4-2 | `src/pages/calendar-pages.tsx`; `src/calendar-utils.ts`; `src/App.tsx` | `src/pages/calendar-pages.tsx:866-906`; `src/pages/calendar-pages.tsx:1411-1416`; `src/calendar-utils.ts:645-662`; `src/App.tsx:2442-2488` | 保证 drag/detail-reschedule 皆经 `onScheduleTask -> applyPlacementToTask -> dueDateISO write`，并持续发 `task-scheduled/task-rescheduled/task-unscheduled` audit。 | calendar drag/drop tests；detail reschedule tests；audit event snapshot tests。 | 若 UI refactor 改调度入口，需同批改 audit event 与 domain mapping；单点改 UI 一律回退。 | Phase 4 |
| P4-3 | `src/pages/hod-pages.tsx`; `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` | `src/pages/hod-pages.tsx:124-165`; `src/pages/hod-pages.tsx:787-792`; `air-mentor-api/src/lib/proof-control-plane-hod-service.ts:651-718` | HoD overview 默认显 `open + watching`，并将 blocking/visible 分账；summary card 明示 `watching` 可见但不阻 stage advance。 | HOD overview filter tests；summary aggregation tests；semester-start watch-only screenshot/golden tests。 | 若默认显 watch 造成旧 dashboard 噪音，可保 toggle，但不可退回隐藏 watch 为默认。 | Phase 4 |

### Test Additions

- 新增 queue capacity clamp vs watch visibility regression pack。
- 新增 calendar audit trail tests，验 schedule/unschedule/reschedule 三事件。
- 新增 HoD overview semester-start fixture，验 `watching` 可见且 `Action Needed` 不误增。

### Validation Gates

- `countsTowardCapacity=false` 之 case 永不进入 blocking/open counts，但可在可见 surface 出现。
- calendar 每次 due-date 变动皆有 state write 与 audit event，二者缺一即 fail。
- HoD 默认页不得把 `watching` 全滤空。

### Rollback Strategy

- domain/type 改动先保兼容字段；若 UI 旧组件崩，先回读 alias，勿回 semantic core。
- calendar bridge 若 refactor 出错，回退整条 schedule path，不保半改 audit/event 状态。

## Phase 5 — Next Day / Next Stage / Reset / Stop

先定 deterministic progression chain、blocked cascade、reset split、stop lifecycle。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P5-1 | `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts`; `air-mentor-api/src/lib/stage-policy.ts` | `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:115-139`; `air-mentor-api/src/lib/stage-policy.ts:94-145` | Next Day / Next Stage 改守 `chain-first, gate-second`：先建 deterministic stage chain 与 `previous/next` ids，后施 queue/task clearance。 | progression chain unit tests；stage-order monotonic tests；checkpoint link snapshot。 | 若新 chain 破旧 checkpoint urls，则保留旧 ids 映射层，勿立删旧 label。 | Phase 5 |
| P5-2 | `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts`; `air-mentor-api/src/lib/proof-control-plane-tail-service.ts` | `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:53-57`; `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:99-100`; `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:141-160`; `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1624-1643` | 落实 blocked cascade：一旦 first blocked checkpoint 出现，其后 checkpoint 全 `playbackAccessible=false`，student/HOD payload 下沉明确 reason。 | blocked-progression tests；tail payload reason snapshot；checkpoint accessibility matrix test。 | 若阻断逻辑误伤 inspectable playback，则保留 reasons 输出，临时回旧 accessibility gate。 | Phase 5 |
| P5-3 | `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`; `air-mentor-api/src/modules/admin-proof-sandbox.ts`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:15-56`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:187-214`; `air-mentor-api/src/modules/admin-proof-sandbox.ts:367-483`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4279-4299` | 明拆 `reset-current-stage` 与 `complete-reset`；前者只清 checkpoint artifacts，后者 `restore snapshot -> new active run`；另补 explicit stop action / stopped lifecycle，而非仅 archive/restore。 | reset split integration tests；operator stop/restore smoke；new active run creation test。 | 若 stop lifecycle 暂未全链路就绪，则先出 stop API + hidden UI，不改 archive 旧流。 | Phase 5 |

### Test Additions

- 新增 progression-chain golden，验每 stage `previous/next` 稳定。
- 新增 blocked cascade pack，验 first-blocked 之后全 inaccessible。
- 新增 reset split + stop lifecycle E2E。

### Validation Gates

- Next Day / Next Stage 不得在未建稳链前直接判 gate。
- `complete-reset` 必产新 run id；`reset-current-stage` 不得偷建新 run。
- operator surface 必能区分 `active / completed-inspectable / stopped / archived`。

### Rollback Strategy

- reset/stop 以 route-level flag 上线；若 operator confusion 高，先藏 UI，不回退 underlying logs。
- blocked cascade 若误封只读 playback，可先宽 UI gate，但保留 blocked reason 数据。

## Phase 6 — HOD Correction Cycle

先把 HoD 更正闭环收成单链：可见、审批、清锁、编辑、重算、复锁；并切断 generic course 写入口。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P6-1 | `src/academic-workspace-route-surface.tsx`; `src/pages/course-pages.tsx` | `src/academic-workspace-route-surface.tsx:258-273`; `src/pages/course-pages.tsx:417-442`; `src/pages/course-pages.tsx:547-613`; `src/pages/course-pages.tsx:704-733` | HoD 经 `course` 路只留 read-only hotspot/drilldown；assessment entry、blueprint、scheme setup 等 generic write hub 仅 Course Leader 保留。 | role-gated route tests；HoD read-only page tests；Course Leader edit-path regression tests。 | 若 role split 误伤 Course Leader，则先回 route gate，不回 generic HoD write 入口。 | Phase 6 |
| P6-2 | `src/App.tsx`; `air-mentor-api/src/modules/academic-runtime-routes.ts` | `src/App.tsx:3114-3195`; `air-mentor-api/src/modules/academic-runtime-routes.ts:1249-1331` | 将 correction 流程固化为 `request -> approve/reject -> clear-lock/reset-unlock -> edit -> recompute -> relock`；UI/route 同名同序，不留旁路。 | correction approval E2E；clear-lock/relock API tests；recompute-after-edit parity test。 | 若 recompute 耗时致审批卡住，则拆为 queued recompute，但 UI 仍守同一链路状态。 | Phase 6 |
| P6-3 | `src/page-utils.ts`; `src/pages/workflow-pages.tsx` | `src/page-utils.ts:49-56`; `src/pages/workflow-pages.tsx:555-579` | visibility 与 editability 分拆：assessment workspace 锁后仍可开以便审阅，唯编辑控件受 lock/role gate；利 HoD correction 后复核。 | locked-workspace visibility tests；edit-control gating tests；post-review inspectability smoke。 | 若 surface 误开编辑，立回退 edit controls，而保留 inspectable workspace。 | Phase 6 |

### Test Additions

- 新增 HoD route read-only regression pack。
- 新增 correction-cycle E2E，覆盖 approve/reject/clear-lock/recompute/relock。
- 新增 locked-workspace inspectability tests。

### Validation Gates

- HoD 不得再由 generic course page 直接改 TT/quiz/assignment/SEE。
- 每次 correction approval 后，audit log 可还原清锁、编辑、重算、复锁顺序。
- 锁态下 workspace 仍可查看上下文，但无任何写入口。

### Rollback Strategy

- route gate 与 write gate 分离发布；若只读/可写误绑，先回写 gate，保可见性。
- correction queue 若超时，先降级为后台重算，不撤审批审计链。

## Phase 8 — Overload Root Cause Analysis

先把 “overload 非单一 calibration 问题” 写成可复验因果：missingness authority、stage skew、capacity clamp 三路分离。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P8-1 | `air-mentor-api/scripts/evaluate-proof-risk-model.ts`; `air-mentor-api/output/proof-risk-model/evaluation-report.json` | `air-mentor-api/scripts/evaluate-proof-risk-model.ts:523-550`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:58769-58939` | 扩离线 eval：除总体 `budgetMetrics` 外，再按 stage/feature ablation 输出 overload 分解，禁止报告继续把 overload 单归 calibration。 | offline eval diff test；report schema snapshot；ablation support-threshold checks。 | 若新 report schema 扰现 consumer，则先增并列 section，不覆旧字段。 | Phase 8 |
| P8-2 | `air-mentor-api/src/lib/proof-risk-model.ts`; `air-mentor-api/src/lib/inference-engine.ts` | `air-mentor-api/src/lib/proof-risk-model.ts:60-74`; `air-mentor-api/src/lib/proof-risk-model.ts:2272-2335`; `air-mentor-api/src/lib/inference-engine.ts:9-22`; `air-mentor-api/src/lib/inference-engine.ts:53-79` | 为 RCA 加 offline feature masks：可分别关闭 missingness、stage indicators、fallback heuristic，量化 unknown-vs-zero 与 degraded-path 贡献。 | feature-mask unit tests；offline ablation reproducibility tests。 | 若 mask 侵入 serving path，则退回 offline-only build flag，勿带入 runtime。 | Phase 8 |
| P8-3 | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`; `air-mentor-api/src/lib/proof-queue-governance.ts` | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:352-379`; `air-mentor-api/src/lib/proof-queue-governance.ts:82-86`; `air-mentor-api/src/lib/proof-queue-governance.ts:309-349` | runtime/queue metrics 增 faculty budget、section cap、watch-pruned counts，令 RCA 可分 “模型高风险” 与 “容量钳制转 watch” 两类来源。 | capacity-metrics unit tests；queue analytics snapshot；watch-pruned counter assertions。 | 若 telemetry 体积过大，则先聚合到 stage/semester 粒度，不回退指标概念。 | Phase 8 |

### Test Additions

- 新增 overload ablation regression，固定 seed 比较 `missingness/stage/capacity` 三维 lift。
- 新增 report-schema tests，防止 RCA sections 漏失。
- 新增 queue analytics counters tests，验 watch-pruned 与 admitted case 分流。

### Validation Gates

- RCA 结论必须可指出各因子贡献，禁止再出 “calibration only” 单因叙述。
- offline masks 不得影响 serving path 预测结果。
- capacity-clamp metrics 与 queue governance counts 必可交叉核对。

### Rollback Strategy

- RCA 先作为 offline/report 改动上线；若 consumer 未接新 schema，保并行旧段。
- 新 telemetry 若成本过高，先降聚合度，不删关键 counters。

## Phase 7 — Corrected v8 Baseline Training

于 P8 因果明后，再修 v8 baseline：missingness 真贯通，方可重训与发布新 report。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P7-1 | `air-mentor-api/src/lib/proof-risk-model.ts` | `air-mentor-api/src/lib/proof-risk-model.ts:60-74`; `air-mentor-api/src/lib/proof-risk-model.ts:2272-2335` | 将 v8 baseline feature contract 收紧为 missingness-aware 必传；去 silent default，保留 schema/version 注释与 feature export 一致。 | feature-schema unit tests；training dataset build tests；artifact compatibility checks。 | 若 caller 尚未齐，先 fail-fast 于 training path，serving path 维持旧 artifact。 | Phase 7 |
| P7-2 | `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`; `air-mentor-api/src/modules/academic.ts` | `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:222-243`; `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:296-310`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:548-566`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:639-650`; `air-mentor-api/src/modules/academic.ts:1424-1445` | playback/runtime/live academic callers 全补 `cgpaMissing/backlogMissing`；训练与服务同一 feature truth，不再半落地。 | playback/runtime/live parity tests；missingness propagation E2E；artifact feature checksum tests。 | 若任一 caller 暂阻塞，则停 retrain/promote，只保 code path behind flag。 | Phase 7 |
| P7-3 | `air-mentor-api/output/proof-risk-model/evaluation-report.json`; `air-mentor-api/src/lib/proof-risk-model.ts` | `air-mentor-api/output/proof-risk-model/evaluation-report.json:9118-9122`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:15451-15455`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:68721-68724`; `air-mentor-api/src/lib/proof-risk-model.ts:121-129` | 仅于 caller propagation 完成后重训 v8 baseline，并刷新 evaluation report / default config；报告需直示 active calibration 与 challenger family 现状。 | training pipeline smoke；evaluation report snapshot diff；artifact manifest checks。 | 若新 baseline 指标不稳，则保旧 production artifact，记录 superseded report，不切 serving default。 | Phase 7 |

### Test Additions

- 新增 v8 baseline corpus build tests，验 missingness flag 真落 dataset。
- 新增 playback/runtime/live caller propagation suite。
- 新增 retrain artifact manifest + report snapshot tests。

### Validation Gates

- training dataset 中 `cgpaMissingScaled/backlogMissingScaled` 分布须与 runtime inputs 对齐。
- 未全 caller propagation 前，任何新 v8 report 一律不得标 `production`.
- 新 baseline report 必直示 calibration/challenger truth，不得夸大已切换内容。

### Rollback Strategy

- training 与 serving promotion 分离；训练成功不等于 serving 切换。
- 若新 artifact 回归，保 report 归档，但 production bundle 继续指向旧 artifact。

## Phase 9 — Calibration

单收 calibrator 选择、artifact truth、runtime provenance；使 “为何选 isotonic/非 beta” 可检可追。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P9-1 | `air-mentor-api/src/lib/proof-risk-model.ts` | `air-mentor-api/src/lib/proof-risk-model.ts:95-129`; `air-mentor-api/src/lib/proof-risk-model.ts:970-1045` | 显式化 calibration chooser：allowed methods、selection metric、display-probability gate 皆由 held-out metrics 驱动，不由注释/默认值暗示。 | chooser unit tests；calibration metric comparison tests；reliability-bin snapshot tests。 | 若 chooser 改动致 artifact 不兼容，则保旧 chooser 序列，先只补 logging/metadata。 | Phase 9 |
| P9-2 | `air-mentor-api/output/proof-risk-model/evaluation-report.json` | `air-mentor-api/output/proof-risk-model/evaluation-report.json:3484-3490`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:7059-7064`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:9118-9122`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:15451-15455`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:68721-68724` | report 明列候选与胜出 calibrator，活跃 truth 仍以 `isotonic` 为准；任何 beta claim 仅可作 candidate/experiment，不得写 active default。 | report truth snapshot tests；docs/assertion guard tests；candidate-vs-active consistency check。 | 若 report consumer 未接 candidate list，则先保 active-only 字段，附加 side section。 | Phase 9 |
| P9-3 | `air-mentor-api/src/lib/proof-provenance.ts`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | `air-mentor-api/src/lib/proof-provenance.ts:24-78`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263-277` | provenance / runtime payload 增 `calibrationMethod`、artifact version、`assessedAt`、evidenceWindow identity；使 calibration 切换后 surface 可自证其源。 | provenance snapshot tests；runtime payload contract tests；assessment audit trail checks。 | 若 payload 变更会破前端 reader，则先附于 metadata sidecar，不改旧 flat fields。 | Phase 9 |

### Test Additions

- 新增 chooser deterministic tests，固定数据集下胜出 method 稳定。
- 新增 report candidate/active truth tests。
- 新增 provenance payload tests，验 calibration/artifact identity 可见。

### Validation Gates

- 任何 active calibration claim 皆须被 report 与 runtime provenance 双证。
- beta/venn-abers 若未胜出，不得在 UI/docs/plan 中表述为 default。
- calibration 切换后，旧 risk rows 仍可追溯所用 method/version。

### Rollback Strategy

- provenance 扩字段先 sidecar，reader 全跟上后再折入主 payload。
- report candidate list 若扰 consumer，先隐藏 candidate section，但保 active truth 不变。

## Phase 10 — CatBoost Challenger

只在 “脚本、artifact、serving truth” 三者同闭后，才准 CatBoost 自 experiment 升 challenger family。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P10-1 | `air-mentor-api/src/lib/proof-risk-model.ts` | `air-mentor-api/src/lib/proof-risk-model.ts:97-101`; `air-mentor-api/src/lib/proof-risk-model.ts:121-129`; `air-mentor-api/src/lib/proof-risk-model.ts:2009-2037`; `air-mentor-api/src/lib/proof-risk-model.ts:2229-2240` | 补 challenger manifest / loader contract，使 `catboost` family 仅在 bundle 真载入时出现；默认 family 继续 `depth-2-tree`，直至 serving path 完整。 | challenger manifest tests；bundle serialization tests；runtime loader smoke。 | 若 CatBoost loader 未成，保 union/type 支持，但 default 与 bundle 继续锁 `depth-2-tree`。 | Phase 10 |
| P10-2 | `air-mentor-api/scripts/train_catboost_challenger.py`; `air-mentor-api/catboost_info/catboost_training.json` | `air-mentor-api/scripts/train_catboost_challenger.py:5-35`; `air-mentor-api/scripts/train_catboost_challenger.py:109-169`; `air-mentor-api/catboost_info/catboost_training.json:1-4` | 规范 CatBoost 训练脚本、依赖守卫、输出 manifest；`catboost_info` 仅作 offline experiment 证据，未接 serving 前不得冒充 runtime challenger。 | python training smoke；artifact manifest validation；dependency-missing guard test。 | 若 Python/CatBoost 环境不稳，则保 script/manifest 离线使用，不接 TS serving path。 | Phase 10 |
| P10-3 | `air-mentor-api/output/proof-risk-model/evaluation-report.json`; `air-mentor-api/src/lib/proof-risk-model.ts` | `air-mentor-api/output/proof-risk-model/evaluation-report.json:5471-5478`; `air-mentor-api/output/proof-risk-model/evaluation-report.json:58733-58745`; `air-mentor-api/src/lib/proof-risk-model.ts:12`; `air-mentor-api/src/lib/proof-risk-model.ts:137-142` | report/version strings 仅在 runtime bundle 真换后才改写 CatBoost challenger truth；未换前，一律保持 `depth-2-tree` active challenger。 | report challenger-family snapshot tests；version-string consistency checks；promotion checklist runbook test。 | 若 report 已写 CatBoost 而 serving 未换，立回 report/version 文案，不触 code path。 | Phase 10 |

### Test Additions

- 新增 CatBoost manifest/loader contract tests。
- 新增 Python training dependency-guard smoke。
- 新增 report-vs-serving challenger truth consistency tests。

### Validation Gates

- CatBoost promotion 需同时满足：脚本产物可读、bundle 可载、report/version 真切换。
- 仅有 `catboost_info` 或训练日志，不构成 serving challenger。
- runtime bundle 未换前，任何 `challengerModelFamily` 仍须为 `depth-2-tree`。

### Rollback Strategy

- CatBoost 以 offline experiment、serving loader、promotion flag 三层隔离；任一层坏，止于该层。
- 若 promotion 后线上异常，立切回 `depth-2-tree` artifact，不改 training artifacts 归档。

## Phase 11 — Final Analytics Counterfactual

最后收 analytics/counterfactual 边界、seed snapshot provenance、stage-boundary regression gate；由此决定能否整体 closeout。

| id | file | location | change | test | rollback | owner_phase |
| --- | --- | --- | --- | --- | --- | --- |
| P11-1 | `air-mentor-api/src/lib/proof-control-plane-policy-service.ts`; `air-mentor-api/src/lib/proof-control-plane-playback-service.ts` | `air-mentor-api/src/lib/proof-control-plane-policy-service.ts:386-417`; `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816-836` | analytics 与 policy 分层：`acceptanceGates`、efficacy thresholds、counterfactual summaries 移至 final analytics lane；policy 仅留 action mapping；counterfactual 文义只准 same-checkpoint no-action comparator。 | policy-vs-analytics boundary tests；counterfactual same-checkpoint tests；teacher-facing wording assertions。 | 若 analytics extraction 一步过大，则先把 analytics 挂 sidecar object，policy 主体不再扩张。 | Phase 11 |
| P11-2 | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:202-219`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263-277` | baseline snapshot/provenance 补 model artifact、calibration、policy identity；seeded snapshot 与 runtime rebuilt artifacts 可对账，供 final analytics freeze。 | snapshot provenance tests；reset snapshot round-trip tests；artifact identity parity checks。 | 若 snapshot schema 变更风险大，则先向 `snapshotJson` 加 sidecar metadata，不改 old readers。 | Phase 11 |
| P11-3 | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts`; `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts`; `air-mentor-api/src/db/schema.ts` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:40-53`; `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:115-139`; `air-mentor-api/src/db/schema.ts:621-634` | 补 final regression gate：stage boundary monotonicity 必须 fail-fast；boundary metadata 入 schema / activation validation，作为整链发版闸。 | activation monotonic-boundary reject test；checkpoint boundary snapshot test；release gate checklist。 | 若 schema-boundary 写入赶不上本轮，至少先加 activation hard-fail，不准 silent accept。 | Phase 11 |

### Test Additions

- 新增 same-checkpoint no-action counterfactual regression pack。
- 新增 snapshot provenance parity tests，验 seed/runtime artifact identity 可对账。
- 新增 stage-boundary monotonicity reject tests，作为 release blocker。

### Validation Gates

- analytics/policy 分层后，teacher-facing efficacy claim 只可源 final analytics artifact。
- reset snapshot 与 runtime active artifacts 可双向核对 model/calibration/policy identity。
- activation 对非单调 boundary 必 fail-fast；此 gate 不通过则整轮不发。

### Rollback Strategy

- analytics extraction 可先 sidecar 化；若 consumer 未适配，不回退 boundary principle。
- final release gate 若新增大量红灯，则冻结 phase 7-10 promotion，不带 known regression 前推。

## Global Handoff

- 下游 impl node 先读本文件，再按 phase 取 owner files；不得跳过 `Phase 1` 与 `Phase 2` 直碰 ML promotion。
- `Phase 8` 先于 `Phase 7` 乃硬序；未完成 RCA，不得宣称 corrected v8 baseline 已定因。
- frozen appendix 仍不改；若命名 prompt 日后入库，只能增 direct-cited crosswalk，不得回填臆造旧 rule。证：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`.
