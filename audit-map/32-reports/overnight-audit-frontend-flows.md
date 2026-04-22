# Overnight Audit: Frontend UI/UX Flow Preservation

- 纪日：`2026-04-22`。
- 范围：`src/App.tsx`, `src/domain.ts`, `src/pages/calendar-pages.tsx`, `src/pages/hod-pages.tsx`, `src/pages/course-pages.tsx`, `src/system-admin-live-app.tsx`，并取必要邻近 helper 佐证。
- 约束：只读审计；未改 `src/**`。
- 权威缺口：命名 prompt `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 缺席，故本文之 `L1..L11` 皆 proxy flow id，锚 `docs/closeout/final-authoritative-plan.md:323-426`、`docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:56-80`、`audit-map/14-reconciliation/final-decision-appendix.md:5-11`、`audit-map/14-reconciliation/overnight-unified-ledger.md:5-15`。
- 校验闸：`8` findings，皆具 `file:line`、severity、target_phase。

## Findings

1. `F01` 权威源缺口仍在，故本轮不能对缺席 prompt 作直接 `L1..L11` 逐条核对，只能以 proxy authority 审前端流。`audit-map/14-reconciliation/final-decision-appendix.md:5-11`, `audit-map/14-reconciliation/overnight-unified-ledger.md:5-15`
2. `F02` assessment entry flow 仍以 lock 决定 workspace 可见性；锁后卡面可见而 workspace 不可开，违“面常显、lock 只辖 edit”。`src/page-utils.ts:49-56`, `src/pages/workflow-pages.tsx:555-579`
3. `F03` 课程页 `Risk Watch` 于 stage `< 2` 即锁，致 Sem1 `pre-tt1` 不得见“无 actionable queue 而仍可见 watch surface”之目标态。`src/pages/course-pages.tsx:67-84`, `src/pages/course-pages.tsx:129-139`
4. `F04` HoD 经 `course` 路径仍得同一 `CourseDetail` 写入口：blueprint 改写、TT/quiz/assignment/SEE 入口、scheme setup 皆仍挂上，visibility/editability 未分离。`src/academic-workspace-route-surface.tsx:258-273`, `src/pages/course-pages.tsx:417-442`, `src/pages/course-pages.tsx:547-613`, `src/pages/course-pages.tsx:704-733`
5. `F05` HoD overview 默认 `Action Needed only`，先滤尽 `watching`；semester-start 若本应“watch visible, queue non-actionable”，首页将偏空。`src/pages/hod-pages.tsx:124-165`
6. `F06` proof mode 之模拟日期只用于 due-label anchor；queue 激活、topbar 时钟、greeting 仍服 wall clock，calendar/queue 与 playback date 未同权。`src/App.tsx:1170-1175`, `src/App.tsx:1543-1575`, `src/App.tsx:1718-1723`, `src/domain.ts:358-360`, `src/domain.ts:401-437`
7. `F07` HoD calendar 扩 scope 至 `allOfferings`，然 timetable anchor 仍取登录 HoD 自身 faculty timetable；owner/date/state 同屏混置之险仍在。`src/App.tsx:1307-1317`, `src/App.tsx:1478-1501`, `src/academic-workspace-route-surface.tsx:292-317`
8. `F08` sysadmin 已算得 `authoritativeOperationalSemester`，但 batch edit modal 仍绑定 `selectedBatch.currentSemester`；activation 后 operational semester 之 UI truth 仍可漂移。`src/system-admin-live-app.tsx:2684-2688`, `src/system-admin-live-app.tsx:3129-3143`, `src/system-admin-live-app.tsx:8157-8164`

## Evidence

### Proxy Flow Crosswalk

| Proxy flow | 义 | Authority |
| --- | --- | --- |
| `L1` | Sysadmin proof control plane / activation / playback | `docs/closeout/final-authoritative-plan.md:373-386` |
| `L2` | Sysadmin hierarchy / batch / semester editor | `docs/closeout/final-authoritative-plan.md:373-386` |
| `L3` | Course proof panel / `Risk Watch` | `docs/closeout/final-authoritative-plan.md:328-334`, `docs/closeout/final-authoritative-plan.md:388-395` |
| `L4` | Assessment entry / lock / unlock / relock | `docs/closeout/final-authoritative-plan.md:388-395` |
| `L5` | Mentor mentee / recurring task / hide-restore | `docs/closeout/final-authoritative-plan.md:397-403` |
| `L6` | Calendar / timetable / queue-date alignment | `docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:56-59` |
| `L7` | Queue history / dismiss / reopen / restore | `docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:59-60` |
| `L8` | HoD overview / course hotspots / faculty ops | `docs/closeout/final-authoritative-plan.md:405-410`, `docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:61-64` |
| `L9` | HoD unlock review / correction cycle | `docs/closeout/final-authoritative-plan.md:405-410`, `docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:60` |
| `L10` | Risk explorer / student shell / partial profile | `docs/closeout/final-authoritative-plan.md:412-418`, `docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:65-67` |
| `L11` | Session restore / proof-playback restore / invalid-checkpoint fallback | `docs/closeout/final-authoritative-plan.md:420-426`, `docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:72-80` |

### Expectation Anchors

- Sem1 acceptance 直书：`no priority alerts at pre-tt1`、`no actionable queue at semester start`、`all semester-1 courses visible and editable`。`docs/closeout/final-authoritative-plan.md:323-371`
- HoD / risk / student parity 直书：同 checkpoint、同 semester、同 scope，且 HoD 不得假现 `No active proof run`。`docs/closeout/final-authoritative-plan.md:236-255`, `docs/closeout/stage-04b-hod-risk-explorer-student-shell-parity.md:33-40`
- Faculty / queue parity 直书：proof-scoped count、student launch、teaching ownership 分离。`docs/closeout/stage-04a-faculty-profile-course-leader-mentor-parity.md:32-39`
- Unified mitigation phase owner：`Phase 1` authority gap，`Phase 2` activation contract，`Phase 4` watch-vs-blocking taxonomy，`Phase 5` calendar/HoD correction flow。`audit-map/32-reports/overnight-unified-mitigation-plan.md:7-41`

### Current-Code Anchors

- `src/pages/course-pages.tsx:67-84`, `src/pages/course-pages.tsx:129-139`
- `src/academic-workspace-route-surface.tsx:258-317`
- `src/pages/hod-pages.tsx:124-165`, `src/pages/hod-pages.tsx:787-792`
- `src/App.tsx:1170-1175`, `src/App.tsx:1543-1575`, `src/App.tsx:1718-1723`, `src/App.tsx:2422-2488`, `src/App.tsx:3114-3195`
- `src/domain.ts:358-437`
- `src/system-admin-live-app.tsx:2684-2688`, `src/system-admin-live-app.tsx:3129-3143`, `src/system-admin-live-app.tsx:8157-8164`

## Recommendations

1. 先行 `Phase 1`：保留 proxy-flow 审计法，待命名 prompt 真入 tracked corpus 后，再将 `L1..L11` 由 proxy 改 direct cite。
2. 收敛 `Phase 5`：强拆 visibility 与 editability。HoD `course` 仅留 read-only hotspot/drilldown；entry hub / blueprint / scheme setup 写入口只留 Course Leader。
3. 收敛 `Phase 4`：HoD overview 默认显 `open + watching`，以 copy 明示 “Watching visible, non-blocking”；勿以默认 filter 抹去 semester-start watch surface。
4. 收敛 `Phase 5`：proof mode 下统一 date authority，令 queue activation、calendar labels、topbar time-context 皆服 playback/currentDate。
5. 收敛 `Phase 2`：sysadmin batch editor 之 `Active Semester` 应显 `authoritativeOperationalSemester` 或显式 provenance，免 activation 后 form truth 漂移。

## Findings Table

| ID | Proxy flow | Expected | Current code truth | target_phase | severity |
| --- | --- | --- | --- | --- | --- |
| `F01` | `L1-L11` | 审计应直引命名 prompt。`audit-map/14-reconciliation/final-decision-appendix.md:5-11` | prompt 缺席；ledger 仅准 proxy authority。`audit-map/14-reconciliation/overnight-unified-ledger.md:5-15` | `Phase 1` | `high` |
| `F02` | `L4` | assessment surface 常显；lock 仅禁 edit。`docs/closeout/final-authoritative-plan.md:388-395` | `canOpenWorkspace = isApplicableForStage && !isLocked`；locked card 点击直返。`src/page-utils.ts:49-56`, `src/pages/workflow-pages.tsx:555-579` | `Phase 5` | `high` |
| `F03` | `L3` | Sem1 `pre-tt1` 应无 actionable queue，然 course watch surface 仍应可见。`docs/closeout/final-authoritative-plan.md:328-334` | `tabLocked('risk')` 于 `offering.stage < 2` 即锁；tab 文案仍在但不可入。`src/pages/course-pages.tsx:67-84`, `src/pages/course-pages.tsx:129-139` | `Phase 3` | `high` |
| `F04` | `L8-L9` | HoD analytics 只读；更正链应走 unlock review，不走 generic course editing。`docs/closeout/stage-04b-hod-risk-explorer-student-shell-parity.md:33-40`, `docs/closeout/final-authoritative-plan.md:405-410` | HoD route 仍挂 `CourseDetail` 全写入口；TT blueprint/entry CTA 仅看 lock，不看 role。`src/academic-workspace-route-surface.tsx:258-273`, `src/pages/course-pages.tsx:417-442`, `src/pages/course-pages.tsx:547-613`, `src/pages/course-pages.tsx:704-733` | `Phase 5` | `critical` |
| `F05` | `L8` | `watching` 应可见且不计 blocking；semester-start 不应因 zero-open 而失 watch context。`audit-map/32-reports/overnight-unified-mitigation-plan.md:29-34`, `docs/closeout/final-authoritative-plan.md:328-334` | 初值 `showActionNeededOnly=true`；overview 先滤 `open`，`watching` 仅在 filter 关或 drilldown 后见。`src/pages/hod-pages.tsx:124-165`, `src/pages/hod-pages.tsx:787-792` | `Phase 4` | `high` |
| `F06` | `L6-L11` | proof calendar/queue 应服 simulated date。`docs/closeout/final-authoritative-plan.md:323-371`, `docs/closeout/final-authoritative-plan.md:420-425` | `proofVirtualDateISO` 只锚 due-label；`pendingActionCount`、`formattedCurrentTime`、`toTodayISO()` 仍取 wall clock。`src/App.tsx:1170-1175`, `src/App.tsx:1543-1575`, `src/App.tsx:1718-1723`, `src/domain.ts:358-437` | `Phase 5` | `high` |
| `F07` | `L6-L8` | calendar 与 queue 应对齐所见 owner/date/state。`docs/closeout/sysadmin-teaching-proof-coverage-matrix.md:56-64` | HoD scope 将 `assignedOfferings` 扩至全 offering，然 timetable 仍取登录 HoD facultyId；department task 可落于单人 timetable。`src/App.tsx:1307-1317`, `src/App.tsx:1478-1501`, `src/academic-workspace-route-surface.tsx:292-317` | `Phase 5` | `medium` |
| `F08` | `L1-L2` | operational surface 应服 `run.activeOperationalSemester -> batch.currentSemester -> fallback`。`audit-map/14-reconciliation/overnight-unified-ledger.md:14-16` | app 已算 `authoritativeOperationalSemester`，但 batch edit hydration 与 modal input 仍绑定 `selectedBatch.currentSemester`。`src/system-admin-live-app.tsx:2684-2688`, `src/system-admin-live-app.tsx:3129-3143`, `src/system-admin-live-app.tsx:8157-8164` | `Phase 2` | `medium` |

## Severity Distribution

| severity | count | findings |
| --- | --- | --- |
| `critical` | `1` | `F04` |
| `high` | `5` | `F01`, `F02`, `F03`, `F05`, `F06` |
| `medium` | `2` | `F07`, `F08` |
| `low` | `0` | `none` |

## Target-Phase Mapping

| target_phase | findings | why |
| --- | --- | --- |
| `Phase 1` | `F01` | 先锁 authority/source gap；今轮只能 proxy 审计。 |
| `Phase 2` | `F08` | activation contract 与 run/batch rewrite 之 UI 映射仍漂。 |
| `Phase 3` | `F03` | semester 1 walkthrough 目标态未入 course watch surface。 |
| `Phase 4` | `F05` | `watching visible != blocking` 之 taxonomy 未成默认首页行为。 |
| `Phase 5` | `F02`, `F04`, `F06`, `F07` | visibility/editability、calendar/date authority、HoD correction/calendar owner 对齐，皆集中于前端 flow wiring。 |

