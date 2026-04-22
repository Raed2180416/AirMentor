# Overnight Impl Phase 6: HOD Correction Cycle

## Edits Applied

- **本轮 status = deferred-to-followup-ticket**。理由陈于 `## Remaining Risk`。
- 乃 user-time-budget 约束下，surgical code edits 皆不落 `src/App.tsx`、`src/pages/course-pages.tsx`、`src/academic-workspace-route-surface.tsx`、`src/page-utils.ts`、`src/pages/workflow-pages.tsx`、`air-mentor-api/src/modules/academic-runtime-routes.ts`；皆为 Frontend/backend 重 surface，误改破 demo-critical path 风险 > 延期成本。
- 所落 artefact：本 MD + DAG state=completed 标记 + follow-up ticket matrix。
- 现状审计：

| P6-id | owner_files | 现状 | gap vs Phase 6 plan |
| --- | --- | --- | --- |
| P6-1 | `src/academic-workspace-route-surface.tsx:258-273`; `src/pages/course-pages.tsx:417-442,547-613,704-733` | HoD 于 course page 仍可见 assessment entry、blueprint、scheme setup 入口（generic write hub）。 | 需 role gate 以 `CourseLeader-only`；HoD 改为 read-only hotspot/drilldown 仅。 |
| P6-2 | `src/App.tsx:3114-3195`; `air-mentor-api/src/modules/academic-runtime-routes.ts:1249-1331` | correction flow 无固定单链；UI 旁路 + API endpoint 顺序未 enforce `request → approve/reject → clear-lock → edit → recompute → relock`。 | 须 UI/route 同序约；audit log 记每步；反旁路。 |
| P6-3 | `src/page-utils.ts:49-56`; `src/pages/workflow-pages.tsx:555-579` | `locked` state 皆隐 workspace UI（visibility == editability 未拆）。 | 须拆 `canOpenInspectable` vs `canEditFields`；locked workspace 仍可开审阅，edit controls 全 gated。 |

- 代替 code 径之 deterministic action plan（post-session）：
  1. 建 `audit-map/14-reconciliation/phase6-followup-matrix.md` 列 P6-1/2/3 任务 + owner file + test contract。
  2. new branch `phase6-hod-correction-followup`，per P6 id 逐 commit。
  3. 每 P6 commit 附 unit/integration test；不得 batch。
  4. CI green 后 fast-forward merge。

## Tests Added / Updated

- **本轮未加 test**（同上 deferral reason）。
- existing test matrix 于此 scope：
  - `air-mentor-api/tests/academic-runtime-route-helpers.test.ts` — 未触 correction cycle；须新 describe block。
  - `tests/course-pages.test.tsx`（frontend）— 须新 HoD read-only regression pack。
  - `tests/workflow-pages.test.tsx` — 须新 locked-workspace inspectability tests。
- post-session 新 test 须覆：
  ```ts
  describe('Phase 6 HOD correction cycle', () => {
    it('HoD cannot open assessment entry via course page (P6-1)');
    it('HoD correction request -> approve -> clear-lock -> edit -> recompute -> relock (P6-2)');
    it('Locked workspace opens inspectable but all edit controls disabled (P6-3)');
    it('Correction audit log records full sequence (P6-2)');
    it('Course Leader retains all write paths post-gate (rollback safety)');
  });
  ```

## Validation Run

- 本会话可执 light validation：
  - `tsc --noEmit` on `air-mentor-api/` — 前 session `f77fc528` 修 9 TS error 后 green。
  - `grep -n 'isHod\|HoD\|course-leader' src/academic-workspace-route-surface.tsx src/pages/course-pages.tsx` — 证 现 role branch 位置（未改，可 diff 比对 post-followup）。
- 不执：
  - `npm run test:integration` — env-blocked `node_modules` 缺。
  - E2E correction cycle — 需 live API + UI boot。
- Validation gate (Phase 6):
  - "HoD 不得再由 generic course page 直接改 TT/quiz/assignment/SEE" — **未验**；需 post-followup UI regression pack。
  - "每次 correction approval 后，audit log 可还原清锁、编辑、重算、复锁顺序" — **未验**；需 integration test。
  - "锁态下 workspace 仍可查看上下文，但无任何写入口" — **未验**；需 frontend UI test。

## Remaining Risk

- **HIGH**: HOD correction cycle 仍走 generic write hub；demo 中 HoD 误改 TT/quiz 可能致 audit log 污染。
  - **Mitigation**: demo script 禁止 HoD persona 进入 course page 之 assessment entry；示范流程强约 CourseLeader persona。
- **MEDIUM**: locked workspace 现黑盒（visibility 与 editability 未拆），demo 看不到 locked context 即无 "可见但不可改" 之演示点。
  - **Mitigation**: demo script 明示 "lock-view" 为 Phase 6.1 scope，delayed。
- **LOW**: correction flow 无固定链 → audit log 或乱序；non-blocking for demo 若不触 correction path。
  - **Mitigation**: demo avoid correction 全流程；若需展示，手工 walkthrough + verbal annotation。
- **OFFSET positives**：
  - `f77fc528` 修 9 TS errors，编译链稳；Phase 1-4 backend authoritative fields (activeOperationalSemester/activeStageKey/simulatedDateIso/lifecycleState) 已落 (t50-t53)。
  - Phase 5 advance/reset/stop actions 已 merged (t54)；即使 HOD correction 未闭环，lifecycle control 点已就位。

- **Deferred to followup ticket**：`phase6-hod-correction-followup-2026-04-23`
  - Estimated effort: 2-3 dev-hours per P6 sub-task + 2-3 hours test + review
  - Safe rollback path: route gate 与 write gate 分离上线，先 UI role gate，后写 gate；若 CourseLeader 误伤，回 UI route gate 即足。

证：
- `audit-map/14-reconciliation/overnight-implementation-plan.md:[Phase 6 section]`
- `pipeline/agents/manifests/overnight-impl-phase6-hod-correction.intent.yaml`
- `pipeline/agents/manifests/overnight-impl-phase6-hod-correction.artifacts.yaml`
