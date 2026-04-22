# Overnight Impl Phase 4: Queue / Task / Calendar Bridge

## Scope Guard

- 旨：Phase 4 queue/task/calendar bridge。
- 守：僅改 allowlist 內檔。
- 守：`src/pages/calendar-pages.tsx` 只動 data wiring；UI flow 未改。
- 守：frozen appendix 未觸。
- 守：每項新行為皆補 unit 或 integration test。
- 注：authoritative prompt path 仍缺 tracked corpus；故以 unified plan / ledger / mitigation 為實依。

## Implementation Plan

- P4-A `air-mentor-api/src/modules/academic.ts`
- 以 proof queue projection 生 synthetic workflow task。
- 僅取 `primaryCase=true` 且 `countsTowardCapacity=true` 且 `status='Open'`。
- task id 固化為 `proof-workflow-task::<queueCaseId>`，避 supporting row 重覆。
- proof playback date authority 改取 run `simulatedDateIso`；checkpoint `createdAt` 僅 fallback。

- P4-B `air-mentor-api/src/modules/academic-runtime-routes.ts`
- placement save 後，task payload / `dueDateIso` 同步換日。
- 若 task 有 recurring `scheduleMeta.nextDueDateISO`，亦同寫。
- 不升 task version，避既有 `saveTasks` / `saveTaskPlacements` 競態互撞。

- P4-C `src/pages/calendar-pages.tsx`
- page 接可選 `currentDateISO`。
- 初始選日與月錨服 supplied proof date；無 prop 時仍退 browser 今日。
- prop 變時同步更新選日/月錨；不改任何互動形態。

- P4-D tests / report
- backend 補 helper unit tests 與 integration draft。
- frontend 補 simulated-date rendering assertion。
- 本報逐 edit / test / validation / risk 記錄。

## Edits Applied

- `air-mentor-api/src/modules/academic.ts`
- 新增 proof bridge helpers：`proofWorkflowTaskIdFromQueueCaseId`、`taskDateISOFromTimestamp`、`taskDueLabelFromDate`、`proofPlaybackCurrentDateISO`、`buildProofWorkflowTaskFromQueueProjection`。
- bootstrap query 今讀 `simulationStageQueueProjections`。
- bootstrap 今以 queue projection 合成 workflow task，並與 persisted `academic_tasks` merge；persisted row 優先。
- `proofPlayback.currentDateISO` 今先讀 run `simulatedDateIso`，無則退 checkpoint date。

- `air-mentor-api/src/modules/academic-runtime-routes.ts`
- 抽出 `taskPayloadWithPlacementDate` pure helper。
- `persistAcademicTaskPlacement` 今於換日 reschedule 時同步寫 task `dueDateIso` / payload `dueDateISO` / recurring `nextDueDateISO`。
- 同步 task runtime shadow drift evidence，令 bootstrap/task/placement date truth 對齊。

- `src/pages/calendar-pages.tsx`
- 新增 `currentDateISO?: string` prop。
- 新增 `browserTodayISO` / `resolveCalendarAnchorDateISO`。
- `selectedDateISO`、`monthAnchorISO` 今可由 supplied proof date 起算。
- diff net `+25/-8`，低於 `≤200` gate。

- `air-mentor-api/tests/academic-proof-calendar-bridge.unit.test.ts`
- 驗 simulated date authority。
- 驗 primary actionable projection 才生 workflow task；supporting row 不生重覆 task。

- `air-mentor-api/tests/academic-runtime-route-helpers.test.ts`
- 驗 placement payload helper 會回寫 `dueDateISO` 與 recurring `nextDueDateISO`。

- `air-mentor-api/tests/academic-runtime-narrow-routes.test.ts`
- 補 API integration case：reschedule placement 後，task `dueDateISO` 應換日。
- 此測於本 sandbox 因 embedded-postgres listen `EPERM` 未能實跑；測案仍保留供正常 env 驗證。

- `air-mentor-api/tests/academic-proof-calendar-bridge.test.ts`
- 補 integration case：proof queue projection → bootstrap runtime task bridge，並驗 playback simulated date。
- 此測同受 sandbox `EPERM` 阻。

- `tests/calendar-pages.test.tsx`
- 驗 calendar page 若供 `currentDateISO`，首屏選日/月錨服 proof date，不取 browser 日。

## Tests Added / Updated

- Added `air-mentor-api/tests/academic-proof-calendar-bridge.unit.test.ts`
- Added `air-mentor-api/tests/academic-runtime-route-helpers.test.ts`
- Added `air-mentor-api/tests/academic-proof-calendar-bridge.test.ts`
- Updated `air-mentor-api/tests/academic-runtime-narrow-routes.test.ts`
- Added `tests/calendar-pages.test.tsx`

## Validation Run

- Passed `npm --workspace air-mentor-api exec vitest run tests/academic-proof-calendar-bridge.unit.test.ts tests/academic-runtime-route-helpers.test.ts`
- Passed `npm exec vitest run tests/calendar-pages.test.tsx`
- Passed `npx tsc -p tests/tsconfig.json --noEmit`

- Blocked `npm --workspace air-mentor-api exec vitest run tests/academic-proof-calendar-bridge.test.ts tests/academic-runtime-narrow-routes.test.ts`
- blocker：sandbox 禁 embedded-postgres bind `127.0.0.1`，錯為 `listen EPERM: operation not permitted 127.0.0.1`

- Blocked `npx tsc -p air-mentor-api/tsconfig.json --noEmit`
- blocker：既存 scope 外型錯仍在 `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- 其錯與本次 Phase 4 改檔無涉，故僅記錄，不跨 scope 修。

## Remaining Risk

- runtime route 已同步 task due date，然 frontend HTTP path 仍依 `saveTasks` 與 `saveTaskPlacements` 兩 effect；version 雖未升，實機仍宜補一輪 full-stack drag smoke。
- `CalendarTimetablePage` 已可受 proof date prop，惟呼叫點現 scope 外，若後續欲讓 academic workspace 首屏必然服 playback date，仍應在 caller 層顯式傳 `currentDateISO`。
- integration tests 已寫，當前 sandbox 無法啟 embedded-postgres；在正常 CI / dev host 應補跑，以證 queue projection bridge 與 placement API 全鏈無回歸。
- backend full `tsc` 仍被既存 `msruas-proof-control-plane.ts` 型錯遮蔽；若欲取全綠 build，需另批處理該檔。
