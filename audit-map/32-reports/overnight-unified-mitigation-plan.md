# Overnight Unified Mitigation Plan

- 纪日：`2026-04-25`。
- 此 phase `1..11` 乃 downstream merge-order，非 `final-authoritative-plan` 原 phase 号逐字复制。
- 权威升格：`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 今已可直引；`audit-map/14-reconciliation/final-decision-appendix.md` 已含 `## Overnight Additions (2026-04-25)` 真实条目。计划切至 **direct-authority** 模式。
- 推次：先锁 authority / blocking-discrepancy → 再收 proof-doc truth → 再收 queue/calendar/HOD doc truth → 再拆 ML doc → 再补 contract/code gaps → 最后跑 regression + handoff freeze。
- Downstream impl node 须先读本计划，再读 `audit-map/14-reconciliation/overnight-unified-ledger.md`，方可动手。

## Phase 1

Authority freeze + P1 blocking discrepancy resolution。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `audit-map/14-reconciliation/final-decision-appendix.md` | `## Overnight Additions (2026-04-25)` | 确认 15 条已追加条目全引 auth-prompt section；禁 synthetic rule；未来追加须 section-cited。 | `rg -n "Auth Prompt\|auth-prompt" audit-map/14-reconciliation/final-decision-appendix.md` | 若条目缺 section citation，则删该条目并补标注。 |
| `audit-map/14-reconciliation/overnight-unified-ledger.md` | authority note; blocking section | 固化 direct-authority 升格记录；`BLK-PL-01` Sem1 offset parity 列为 P1 blocking。 | `rg -n "BLK-PL-01\|direct-authority\|blocking discrepancy" audit-map/14-reconciliation/overnight-unified-ledger.md` | 若 upstream 权威再变，重跑 ledger merge 并重写 authority 注。 |
| `air-mentor-api/src/lib/stage-policy.ts` | Sem1 offsets `105/117/129/141` | 择一：(a) 改 offsets 至 `42/93/114/129` 以对齐 auth-prompt；或 (b) 出 prompt errata 声明 policy 为新权威；须在此 phase 决定，解除 blocking。 | `rg -n "semesterDayOffset\|StageDayOffset" air-mentor-api/src/lib/stage-policy.ts` | 任一方向若造成 proof walkthrough regression，则回退至当前 policy offsets 并保留 `BLK-PL-01` open。 |
| `audit-map/24-agent-memory/working-knowledge.md` | Overnight Merge Final Decisions section | 更新 2026-04-25 知识：completed-inspectable、workflow task != primary case、ML 四层拆分、appendix 15 条已真实写入。 | `rg -n "2026-04-25\|direct-authority\|concernContextKey" audit-map/24-agent-memory/working-knowledge.md` | 若 upstream 真值变，以新 dated section 覆旧段，不重写历史记录。 |

## Phase 2

Proof lifecycle document truth — 07A activation contract。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` | activation contract section（`61-68`） | 补 activation dual gate（range guard → checkpoint available-semester guard）、run/batch rewrite 双写、active-only republish、`strictlyMonotonic` hard-fail、stopped-run ban（须 restore 先行）。 | `rg -n "semesterStart\|available semester\|activeOperationalSemester\|stopped.*restore\|strictlyMonotonic" docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` | 若 prose 误导 live operators，回退至 "route exists only" 并以 exact backend terms 重写。 |
| `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` | reset flow section（`23`） | 补 `complete-reset` = `restoreProofSimulationSnapshot` 另起新 run 且 `activate:true`；与 `reset-current-stage` 明分。 | `rg -n "complete-reset\|startProofSimulationRun" docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` | 若命名与 code 不符，删 prose；先修 code 再补文档。 |
| `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` | runtime authority section（`75-80`） | 补 seed vs runtime authority boundary：seed 为 simulation engine，不是 authoritative live risk scorer；runtime 以 observed 重算为准。 | `rg -n "runtime\|rescore\|observed" docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` | 若 retrain 改变 seed 语义，重写本段。 |

## Phase 3

Proof lifecycle document truth — 07B/07C walk。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md` | semester authority narrative（`72-74`） | 补 operational `run -> batch` 与 checkpoint-bound `checkpoint -> run -> batch` ladders；补 drift reroute rule（run/batch drift 时回 checkpoint summary）。 | `rg -n "activeOperationalSemester\|checkpoint semester\|reroute\|run.*batch" docs/closeout/stage-07b-semester-1-to-3-proof-walk.md` | 若 ladder 文案与 code 冲突，先删 prose，待 service truth 稳定再补。 |
| `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md` | lifecycle glossary（`42-43`） | 补 `completed-inspectable` vs `stopped` 形式化定义：completed → 可 immutable checkpoint 检视；stopped → 删凭证 + 禁登录。 | `rg -n "completed-inspectable\|stopped.*credential\|lifecycle.*gloss" docs/closeout/stage-07b-semester-1-to-3-proof-walk.md` | 若 backend enum 变，同步更新定义。 |
| `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md` | stage/date/progression narrative（`58-77`） | 补 `run.activeStageKey` authority、`run.createdAt + semesterDayOffset` deterministic formula、chain-first gate-second、`openQueueCount > 0` 阻止 advance、first-blocked cascade、`reset-current-stage` 定名、demo auto-resolve note。 | `rg -n "activeStageKey\|semesterDayOffset\|admin-confirmed\|first blocked\|reset-current-stage\|post-see.*auto" docs/closeout/stage-07c-semester-4-to-6-proof-walk.md` | 若 walkthrough copy 仍引 UI intuition，回退新增 prose，仅保留 code-quoted facts。 |
| `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md` | Next Day / Next Stage section（`64-65`） | 明写 Next Day = exact `+1 day`；Next Stage = snap to next boundary；两者同走 `advanceProofSimulation` pipeline，side-effects 共线。 | `rg -n "exact.*1 day\|next.*boundary\|advanceProofSimulation" docs/closeout/stage-07c-semester-4-to-6-proof-walk.md` | 若 pipeline 分岔，先修 code，再分开文档章节。 |

## Phase 4

Queue / taxonomy / workflow isolation doc truth。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `audit-map/32-reports/overnight-reconcile-queue-calendar.md` | taxonomy recommendations | 将 `workflow task != primary case` 与 `watching visible != blocking` 提升为 canonical wording；列出 5 类 primary taxonomy。 | `rg -n "workflow task\|primary case\|Watching\|attendance-risk\|coursework-risk" audit-map/32-reports/overnight-reconcile-queue-calendar.md` | 若 later code adds hybrid semantics，删 canonical claim，改为 conditional wording。 |
| `audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md` | QC-002 / QC-009 rows | 更新 `concernContextKey` drift status（open-code-drift）；更新 demo auto-resolution 状态（open-doc-drift）；增补 `fallbackConcernFamily` legacy name list。 | `rg -n "concernContextKey\|fallbackConcernFamily\|course-offering-risk" audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md` | 若 code 先修，更新 status 为 `resolved-in-code`。 |

## Phase 5

Calendar bridge + HOD correction cycle closure。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `src/pages/calendar-pages.tsx`, `src/calendar-utils.ts`, `src/App.tsx` | drag / reschedule / audit path | 确认且明文验证 "drag/detail-reschedule = `onScheduleTask` → `applyPlacementToTask` → `dueDateISO` write → calendar audit event"；不得退回 pure-preview 叙事；同时验证 API 端 `due_at` 持久化。 | `tests/calendar-utils.test.ts` + `rg -n "onScheduleTask\|applyPlacementToTask\|task-rescheduled" src/pages/calendar-pages.tsx src/calendar-utils.ts src/App.tsx` | 若 UX redesign 改路径，需同时更正文档与 audit event 名，不可只改 UI。 |
| `src/pages/hod-pages.tsx`, `src/App.tsx`, `air-mentor-api/src/modules/academic-runtime-routes.ts` | HOD correction cycle | 闭环全链：`request -> approve/reject -> clear-lock/reset-unlock -> teacher edit -> recompute -> relock`；保留 `CLEAR_LOCK` route 与 `lock:true` relock truth；补缺失的 `recompute -> relock` 文档段。 | `rg -n "clear-lock\|CLEAR_LOCK\|lock: true\|Reset completed and unlocked" src/pages/hod-pages.tsx src/App.tsx air-mentor-api/src/modules/academic-runtime-routes.ts` | 若 route semantics 改变，先回退文案链路，不带 stale step。 |

## Phase 6

ML doc truth — four-layer split + overload diagnosis。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | model / policy / monitoring / simulator-runtime headings | 将四层分栏固化到所有 ML closeout / handoff 文；"五头先行，band 后映"；"counterfactual = same-checkpoint no-action comparator"；"CatBoost 仍非 runtime challenger"；"active calibrator = isotonic，非 Beta default"。 | `rg -n "model\|policy\|monitoring\|simulator-runtime\|five head\|depth-2-tree\|isotonic" audit-map/08-ml-audit/README.md audit-map/32-reports/overnight-reconcile-ml.md` | 若 downstream docs 无法维持四层分栏，至少保留 explicit owner sentence per claim。 |
| `audit-map/32-reports/overnight-reconcile-ml.md` | v7 overload section | 固化诊断："missingness authority 未贯通 + score bunching + interaction skew + capacity clamp 混叠"；拆双账本：`model_overload_ratio` vs `capacity_clamp_ratio`。 | `rg -n "overload\|missingness\|score bunching\|capacity_clamp" audit-map/32-reports/overnight-reconcile-ml.md` | 若 v8 retrain 改变 overload 图像，以 new dated section 覆旧段，不删旧诊断。 |

## Phase 7

ML code gaps — missingness callers + calibration / challenger truth。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`, `air-mentor-api/src/modules/academic.ts` | feature payload builders | 真补 v8 missingness 时，贯通 `cgpaMissing` / `backlogMissing` callers 至 `buildObservableFeaturePayload`；未贯通前，文档保留 `superseded`；勿宣 "v8 fully landed"。 | `rg -n "cgpaMissing\|backlogMissing\|buildObservableFeaturePayload" air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts air-mentor-api/src/lib/proof-control-plane-runtime-service.ts air-mentor-api/src/modules/academic.ts` | 若 retrain 未就绪，回退 caller changes 与 artifact promotion，并恢复 old feature flags。 |
| `air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/output/proof-risk-model/evaluation-report.json` | calibrator / challenger truth | 仅当 artifact 真变更后，方可改 "active calibrator" 与 "serious challenger family" 文案；CatBoost 不得先宣。 | `rg -n "isotonic\|beta\|depth-2-tree\|CatBoost" air-mentor-api/src/lib/proof-risk-model.ts air-mentor-api/output/proof-risk-model/evaluation-report.json air-mentor-api/catboost_info/catboost_training.json` | 若 challenger experiment 失败，保留 `depth-2-tree` truth，不保留 half-wired family union。 |

## Phase 8

ML code gaps — intervention fn + latent param schema + counterfactual wording。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/proof-control-plane-playback-service.ts` | intervention utility（`710-717`） | 若产品坚持 prompt intent（auth-prompt H），以 multiplicative response fn 取代现 additive blend，并同步文档明示 new factors（compatibility / severity / repeat structure）。 | `rg -n "0.35.*next\|0.35.*stable\|0.2.*close\|additive\|multiplicative" air-mentor-api/src/lib/proof-control-plane-playback-service.ts` + focused policy tests | 若 multiplicative fn 造成 regression，回退 fn 公式，并把 doc 状态恢复为 open drift。 |
| `air-mentor-api/src/db/schema.ts` | `student_latent_states`（`534-543`） | 若 latent responsiveness 须升为 first-class truth，则加列并迁移；迁移前文档不得伪称已实现。 | schema diff + focused backend tests around latent-state read/write | 若 migration 未完整 rollout，回退 schema change，保持 JSON-only truth。 |
| `audit-map/32-reports/overnight-reconcile-ml.md` | counterfactual wording | 所有 counterfactual prose 仅写 same-checkpoint no-action comparator；不得跨阶段泛化。 | `rg -n "same-checkpoint\|no-action" audit-map/32-reports/overnight-reconcile-ml.md air-mentor-api/src/lib/proof-control-plane-policy-service.ts air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | 若 policy contract later expands，重写所有 docs in one batch；不留 mixed wording。 |

## Phase 9

Contract-sensitive impl — `concernContextKey` + case identity。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/proof-queue-governance.ts`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`, `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` | `concernContextKey` producer/consumer path | 若 appendix/spec 需 `concernContextKey`，须于 queue contract、playback detailJson、runtime payload、HOD parser 四端同补；格式固定为 `[studentId + offeringId + concernFamily + semesterNumber]`；不可拿 `queueCaseId` / `primaryCase` 代称。 | `rg -n "concernContextKey\|queueCaseId\|primaryCase\|countsTowardCapacity" air-mentor-api/src/lib` | 任一 consumer 未就绪，整体回退新 literal，保老键。 |
| `air-mentor-api/src/lib/proof-queue-governance.ts` | `fallbackConcernFamily` taxonomy | 收紧至 auth-prompt C.3 canonical 5 类；`primaryCase` 逻辑须区分 workflow task。 | `rg -n "fallbackConcernFamily\|course-offering-risk\|primaryCase" air-mentor-api/src/lib/proof-queue-governance.ts` | 若 new taxonomy 破坏 historical queue rows，回退 taxonomy change 并补 migration plan。 |
| `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts` | case identity key（`144-149`） | 收紧 governance case identity 粒度，向 training key `course + stage` 靠近，避免 `studentId::semesterNumber` 过宽。 | `rg -n "caseKey\|studentId.*semesterNumber\|stageKey" air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts air-mentor-api/src/lib/proof-risk-model.ts` | 若 new key 破坏 historical continuity / reopen semantics，回退 key scheme 并补 migration plan。 |

## Phase 10

Sem6 residue cleanup + final analytics scope。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | sem6 residue（`1504-1507`, `3098-3105`, `3326-3328`, `4066-4070`, `4341-4349`） | 清 sem6 residue：避免 `currentSemester: 6`、`sem6Options`、hard-coded sem6 bootstrap 继续污染 `activeOperationalSemester` contract。 | `rg -n "currentSemester: 6\|sem6Options\|semester 6\|activeOperationalSemester" air-mentor-api/src/lib/msruas-proof-control-plane.ts` | 若 active-semester walkthrough regress，回退 sem6 cleanup 并保留 residue note。 |
| `docs/closeout/final-authoritative-plan.md` | Phase 7 / 8 / 10 crosswalk（reference-only） | downstream impl 写 closeout 时，将 sem6 cleanup 同 Phase 1 count provenance、Phase 4 parity、Phase 7 semester walk、Phase 8 role flows 一并复核。（auth-prompt J / N scope。） | focused role + proof tests after cleanup | 若 one role regresses，回退 cleanup patch，保留 doc-only TODO。 |
| `audit-map/32-reports/overnight-reconcile-ml.md` | final analytics scope section | 补 "Final Semester 6 analytics 须 aggregate semester-level 与 full-run projected results；copy 须用 projected / simulated / counterfactual 词汇"。（appendix "Final analytics scope" 已冻。） | `rg -n "projected\|simulated\|counterfactual\|semester.*aggregate" audit-map/32-reports/overnight-reconcile-ml.md` | 若产品语义变，以 dated section 覆旧段。 |

## Phase 11

Focused regression + handoff freeze。

| file | location | change | test | rollback |
| --- | --- | --- | --- | --- |
| `air-mentor-api/tests/*`, `tests/*` | proof / ML / queue / calendar / HOD suites | 最少跑 focused packs：proof activation / tail / checkpoint / risk-model / risk-explorer / HOD-pages / student-shell / calendar-utils；sandbox 若阻 DB listener，保留 command + blocker evidence。 | `air-mentor-api/tests/risk-explorer.test.ts`, `air-mentor-api/tests/proof-risk-model.test.ts`, `air-mentor-api/tests/hod-proof-analytics.test.ts`, `tests/calendar-utils.test.ts`, `tests/risk-explorer.test.tsx`, `tests/student-shell.test.tsx` | 任一 focused suite regression，回退最近 phase patch；不带 failing known-regression 前推。 |
| `audit-map/14-reconciliation/reconciliation-log.md` | final handoff freeze section | 写明 open drifts、phase order、rollback triggers、blocking discrepancy（BLK-PL-01）、direct-authority升格；downstream node 先读 unified plan。 | `rg -n "unified plan\|direct-authority\|open drifts\|rollback\|BLK-PL-01" audit-map/14-reconciliation/reconciliation-log.md` | 若 later pass supersedes plan，新增 dated section；不重写历史 phase order。 |
| `audit-map/24-agent-memory/working-knowledge.md` | final memory sync | 确认 Phase 1-11 执行证据已写入 working-knowledge；open drifts / proxy-authority-caveat / rollback triggers 皆可追溯。 | `rg -n "Phase.*11\|Sem1 offset\|concernContextKey\|direct-authority" audit-map/24-agent-memory/working-knowledge.md` | 若 later pass 翻案，以 new dated section 覆旧记忆段。 |

## Phase Ordering Rationale

- **P1**：先锁 authority 升格 + Sem1 offset blocking，封堵"fully reconciled"伪称。
- **P2-P3**：收 proof lifecycle doc truth（07A/07B/07C）；下游实现节点不应依 stale closeout prose 动手。
- **P4**：收 queue/taxonomy/workflow isolation doc truth；为 P9 contract impl 备地。
- **P5**：calendar bridge + HOD cycle 闭环；两者均有 code 支撑，文档落后。
- **P6-P8**：拆 ML doc truth，补 missingness callers、intervention fn、latent schema；先稳 doc 真值，再谈 artifact 升级。
- **P9**：contract-sensitive impl：`concernContextKey` + case identity；需 P4 doc 先稳。
- **P10**：sem6 residue cleanup + final analytics scope；须 P3 semester walk 先收。
- **P11**：focused regression + handoff freeze；任一 phase patch regression 须在此处拦截。
