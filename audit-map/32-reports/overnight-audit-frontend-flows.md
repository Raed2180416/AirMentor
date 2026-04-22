# Overnight Audit: Frontend UI/UX Flow Preservation

- 範圍：`src/App.tsx`, `src/domain.ts`, `src/pages/calendar-pages.tsx`, `src/pages/hod-pages.tsx`, `src/pages/course-pages.tsx`, `src/system-admin-live-app.tsx`。
- 本輪唯讀；`src/**` 未改。
- named authority `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 缺席，故下列 `L1..L11` 只為 audit-local proxy flow map，據 proxy authority 與現碼可視 surface 立，不冒稱 direct appendix rule。`audit-map/14-reconciliation/final-decision-appendix.md:5-11`, `audit-map/20-prompts/prompt-index.md:16-82`, `audit-map/01-inventory/docs-index.md:15-55`

## Findings

- 共 `9` 項：`critical 1`, `high 3`, `medium 5`, `low 0`。
- 主漂一：proof 虛日僅餵 due-label；calendar 初日、queue active gate、composer default date 仍吃實鐘。`src/App.tsx:1170-1172`, `src/pages/calendar-pages.tsx:315-322`, `src/App.tsx:876-880`, `src/App.tsx:1543-1543`, `src/App.tsx:386-392`, `src/App.tsx:629-630`, `src/domain.ts:429-436`
- 主漂二：course surface 尚以 stage gate 隱 risk/TT2，未純以 lock/edit 分層；Sem1 pre-TT1 可視性因此受損。`docs/closeout/final-authoritative-plan.md:323-335`, `docs/closeout/final-authoritative-plan.md:388-395`, `src/pages/course-pages.tsx:67-84`, `src/pages/course-pages.tsx:129-138`
- 主漂三：HoD/sysadmin 尚見 restore/chrome 漂，易傷 read-only proof 與 scoped deep-link 保真。`src/pages/hod-pages.tsx:235-236`, `src/pages/hod-pages.tsx:477-478`, `src/system-admin-live-app.tsx:552-564`, `src/system-admin-live-app.tsx:2670-2688`

## Evidence

- proxy authority 與 frozen appendix 缺席已鎖：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`, `audit-map/14-reconciliation/overnight-unified-ledger.md:3-8`
- unified mitigation owner-phase：`audit-map/32-reports/overnight-unified-mitigation-plan.md:29-41`, `audit-map/32-reports/overnight-unified-mitigation-plan.md:72-84`
- expected early-semester / role-flow contract：`docs/closeout/final-authoritative-plan.md:236-250`, `docs/closeout/final-authoritative-plan.md:323-370`, `docs/closeout/final-authoritative-plan.md:373-426`
- proof/student/HoD parity anchors：`docs/closeout/assertion-traceability-matrix.md:22-36`

| L | proxy visible flow | anchors |
| --- | --- | --- |
| L1 | sysadmin overview / registry rail | `src/system-admin-live-app.tsx:552-564`, `src/system-admin-live-app.tsx:1661-1693` |
| L2 | sysadmin proof dashboard / semester chrome | `src/system-admin-live-app.tsx:553-555`, `src/system-admin-live-app.tsx:2392-2396`, `src/system-admin-live-app.tsx:2670-2688` |
| L3 | course-leader home / teaching shell | `src/academic-workspace-route-helpers.ts:7-18`, `src/App.tsx:1109-1114` |
| L4 | queue history / action queue | `src/App.tsx:1111-1113`, `src/App.tsx:876-880`, `src/App.tsx:1543-1543` |
| L5 | calendar / timetable | `src/App.tsx:1112-1112`, `src/pages/calendar-pages.tsx:314-322`, `src/pages/calendar-pages.tsx:1223-1309` |
| L6 | course detail / assessments / risk watch | `src/pages/course-pages.tsx:67-84`, `src/pages/course-pages.tsx:126-143`, `src/pages/course-pages.tsx:394-780` |
| L7 | upload / scheme / entry | `src/App.tsx:1113-1113`, `src/academic-workspace-route-helpers.ts:13-18`, `src/pages/course-pages.tsx:731-749` |
| L8 | mentor mentees / mentor calendar | `src/App.tsx:1115-1119`, `src/academic-workspace-route-helpers.ts:15-18` |
| L9 | HoD department proof / reassessment audit | `src/App.tsx:1120-1124`, `src/pages/hod-pages.tsx:233-236`, `src/pages/hod-pages.tsx:348-356`, `src/pages/hod-pages.tsx:712-772` |
| L10 | risk explorer / student shell / drilldowns | `src/App.tsx:862-864`, `src/pages/hod-pages.tsx:577-595`, `src/pages/hod-pages.tsx:797-814` |
| L11 | unlock review / correction cycle | `src/academic-workspace-route-helpers.ts:13-18`, `src/App.tsx:3114-3195` |

## Recommendations

- `Phase 3`：拆 stage gate 與 surface visibility；Sem1 pre-TT1 仍須見 course/risk/TT2 surface，editability 另由 lock/state 管。
- `Phase 4`：watch 與 blocking 分帳到底；medium/high watch affordance 常顯，勿以 `highRisk > 0` 作唯一入口。
- `Phase 5`：將 `proofVirtualDateISO/currentDateISO` 注入 calendar 初日、queue active gate、composer default date；HoD read-only proof 面若不許改，則去 dead CTA；若許改，則補可證 action wire。
- `Phase 10`：sysadmin proof chrome 改綁 `authoritativeOperationalSemester`，勿回讀 batch residue。
- `Phase 11`：section scope 進 sharable route/hash，莫僅寄 sessionStorage。

## Findings Table

| ID | file | L | severity | target_phase | expected | current truth | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | `src/pages/course-pages.tsx` | L6 | high | Phase 3 | Sem1 pre-`tt1` 應無 actionable queue，然課程 surface 仍全可見，不待 stage 推進始露。 | `tabLocked` 以 stage 鎖 `risk`，segmented nav 因此拒開；pre-`tt1` watch surface 自主 nav 消失。 | `docs/closeout/final-authoritative-plan.md:323-335`, `src/pages/course-pages.tsx:67-71`, `src/pages/course-pages.tsx:129-138` |
| F-02 | `src/pages/course-pages.tsx` | L6 | high | Phase 4 | high/medium watch metrics 皆應可點入，watch 可見但不等於 blocking。 | overview watch 卡僅於 `highRisk > 0` 時 render；若僅 medium watch，overview 無 watch affordance。 | `docs/closeout/final-authoritative-plan.md:236-250`, `src/pages/course-pages.tsx:172-185`, `src/pages/course-pages.tsx:226-235` |
| F-03 | `src/pages/course-pages.tsx` | L6 | medium | Phase 3 | assessment surface 應常顯；lock/state 管 edit，不應由 nav gate 與深鏈各說各話。 | `TT2` 在 segmented nav 被 `tabLocked` 禁入，然 overview checklist 仍直接 `setTab('tt2')`；可視/可編契約不一。 | `docs/closeout/final-authoritative-plan.md:388-395`, `src/pages/course-pages.tsx:67-68`, `src/pages/course-pages.tsx:181-185`, `src/pages/course-pages.tsx:198-203`, `src/pages/course-pages.tsx:129-138` |
| F-04 | `src/pages/calendar-pages.tsx` | L5 | high | Phase 5 | proof playback 既有 `currentDateISO`，calendar 初始日應隨 proof 虛日，不隨 wall clock。 | `selectedDateISO` 直由 `new Date()` 生，未讀 proof date；proof mode 開屏即可能落錯日。 | `src/App.tsx:1170-1172`, `src/pages/calendar-pages.tsx:314-322`, `docs/closeout/final-authoritative-plan.md:365-370` |
| F-05 | `src/App.tsx`, `src/domain.ts` | L4/L5 | critical | Phase 5 | queue/calendar 應同服 proof date authority；semester-start 不得因實鐘誤生 actionable rows。 | ActionQueue active list、topbar badge 皆以 `toTodayISO()` 判活；`isTaskActiveForQueue` default 亦吃 wall-clock。 | `docs/closeout/final-authoritative-plan.md:323-335`, `src/App.tsx:1170-1172`, `src/App.tsx:876-880`, `src/App.tsx:1543-1543`, `src/domain.ts:429-436` |
| F-06 | `src/App.tsx` | L5 | medium | Phase 5 | proof scheduling/composer default date 應落於 proof 虛日，免新建 task/meeting 漏入真實今日。 | recurring task fallback 與 meeting composer 初值皆用 `toTodayISO()`；proof playback 下新建日期可脫節。 | `src/App.tsx:1170-1172`, `src/App.tsx:386-392`, `src/App.tsx:629-630` |
| F-07 | `src/pages/hod-pages.tsx` | L9 | medium | Phase 5 | HoD proof overlay 已明言 read-only、僅示 persisted audit outcomes；若不可改，action CTA 不應現。 | overview rows 對 governed `open` 仍 render `Acknowledge` 按鈕，且此處無 handler；成 dead CTA / 假可編。 | `src/pages/hod-pages.tsx:235-236`, `src/pages/hod-pages.tsx:477-478`, `src/pages/hod-pages.tsx:550-576`, `docs/closeout/assertion-traceability-matrix.md:24-25` |
| F-08 | `src/system-admin-live-app.tsx` | L1/L2 | medium | Phase 11 | section-aware admin state 應可 deep-link / refresh 保持，不只暫存於 session。 | `routeToHash` 未帶 `selectedSectionCode`；section scope 只另存 `sessionStorage` key，故分享/硬刷新不可 deterministic round-trip。 | `docs/closeout/final-authoritative-plan.md:219-221`, `docs/closeout/assertion-traceability-matrix.md:20-21`, `src/system-admin-live-app.tsx:552-564`, `src/system-admin-live-app.tsx:1467-1468`, `src/system-admin-live-app.tsx:2345-2349` |
| F-09 | `src/system-admin-live-app.tsx` | L2 | medium | Phase 10 | proof chrome 應以 active / authoritative operational semester 為準，不回讀 batch residue。 | canonical proof scope label 仍取 `canonicalProofBatch.currentSemester`，而 `authoritativeOperationalSemester` 已另算未入此 label。 | `docs/closeout/assertion-traceability-matrix.md:20-21`, `audit-map/32-reports/overnight-unified-mitigation-plan.md:76-77`, `src/system-admin-live-app.tsx:2670-2688` |

## Severity Distribution

| severity | count | IDs |
| --- | --- | --- |
| critical | 1 | `F-05` |
| high | 3 | `F-01`, `F-02`, `F-04` |
| medium | 5 | `F-03`, `F-06`, `F-07`, `F-08`, `F-09` |
| low | 0 | `—` |

## Target-Phase Mapping

| target_phase | findings | owned mitigation lane |
| --- | --- | --- |
| Phase 3 | `F-01`, `F-03` | semester/stage visibility contract，先拆「surface visible」與「editable」 |
| Phase 4 | `F-02` | watch-vs-blocking taxonomy 與 clickable watch affordance |
| Phase 5 | `F-04`, `F-05`, `F-06`, `F-07` | calendar/date authority、queue-calendar parity、HoD proof read-only contract |
| Phase 10 | `F-09` | `currentSemester` residue 清理，proof chrome 改綁 operational semester |
| Phase 11 | `F-08` | route/deep-link/state restore hardening 與 final regression freeze |

