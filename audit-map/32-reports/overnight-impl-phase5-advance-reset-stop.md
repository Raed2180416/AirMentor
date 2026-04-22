# Overnight Impl Phase 5: Next Day / Next Stage / Reset / Stop

- 期：依 unified plan `P5-1`、`P5-3` 行，於允寫 scope 內補 service 與 tests；UI/UX 檔未動。
- 權威缺口仍在：named prompt / extra handoff path 於 tracked corpus 缺；今仍依 unified plan、ledger、frozen appendix proxy truth 行事。
- 本 pass 不觸 frozen appendix，不改 `src/**/*.tsx`，不越 scope 至 `admin-proof-sandbox.ts` 或 `msruas-proof-control-plane.ts`。

## Edits Applied

- `P5-1` 新增 `air-mentor-api/src/lib/proof-control-plane-advance-service.ts:1-402`。
- 其內 `parseProofAdvanceStageBoundarySnapshot` 與 `buildProofAdvanceChain`（`123-175`）先建 deterministic semester-stage chain，守 chain-first。
- `resolveProofAdvance`（`189-235`）分流 `next-day` / `next-stage`：
  - `next-day` = `simulatedDateIso + 1 day`。
  - 若跨過 next checkpoint boundary，僅推一段 stage，無 duplicate hop。
  - `next-stage` = 直 snap 至 next checkpoint boundary date。
- 同檔 `218-233` 補 terminal 語義：
  - 最末 checkpoint 停於 `completed-inspectable`。
  - `post-see` transition 回傳 `autoResolutionMode='post-see-open-cases-may-auto-resolve'`，供同一 playback rebuild chain 吃既有 auto-resolve semantics。
- 同檔 `278-357` 補持久化面：
  - 更新 `activeOperationalSemester`、`activeStageKey`、`simulatedDateIso`、`lifecycleState`。
  - stage transition 時寫 `Stage entry snapshot` 至 `simulation_reset_snapshots`。
  - 若 caller 給 `rebuildSimulationStagePlayback` / `publishOperationalProjection`，則同鏈觸發 rebuild / publish / audit。
- `P5-3` 擴 `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:19-340`。
- `resolveCurrentStageResetSnapshot`（`108-129`）今可自 stage-entry snapshot 或 baseline-like snapshot 還原 current stage authority。
- `resetCurrentProofStage`（`176-243`）今明確：
  - 先清 stage-scoped cards / sessions / evidence / queue / checkpoints。
  - 復寫 current stage authority。
  - 可選 rebuild playback、republish active projection、emit `reset-current-stage` audit。
- `completeProofSimulationReset`（`245-300`）今明確：
  - 取 baseline snapshot。
  - 以 `startProofSimulationRun` 新建 run。
  - emit `complete-reset` audit。
- `stopProofSimulationRun`（`302-340`）今明確：
  - 刪 credentials。
  - invalidate batch sessions。
  - 將 run lifecycle 改 `stopped`，active flag 歸零。
  - emit `stopped` audit。
- 舊 `resetPlaybackStageArtifacts`（`132-174`）保留，僅作 split-reset 之 artifact eraser，不偷建新 run。

## Tests Added / Updated

- 新增 `air-mentor-api/tests/proof-control-plane-advance-service.test.ts:121-250`。
- 其驗：
  - boundary crossing idempotency：`122-179`。
  - next-stage snap + post-see auto-resolution signal：`181-210`。
  - semester-6 terminal `completed-inspectable` preserve：`212-250`。
- 新增 `air-mentor-api/tests/proof-control-plane-playback-reset-service.test.ts:255-376`。
- 其驗：
  - reset current stage restores stage-entry snapshot and clears artifacts：`256-301`。
  - complete reset recreates new run from baseline snapshot：`303-335`。
  - stop invalidates sessions / credentials and stamps stopped lifecycle：`337-375`。
- 更新 `air-mentor-api/tests/proof-queue-governance.test.ts:271-345`。
- 其補 post-see auto-resolution branch coverage：
  - prior-open + watch-only path resolves / closes：`271-307`。
  - prior-open + no-actionable path resolves / `no_longer_actionable`：`309-345`。
- 既有 regression 守門仍併跑：
  - `air-mentor-api/tests/proof-control-plane-activation-service.test.ts`
  - `air-mentor-api/tests/proof-control-plane-tail-service.test.ts`

## Validation Run

- 指令：
  - `npm --workspace air-mentor-api exec vitest run tests/proof-control-plane-advance-service.test.ts tests/proof-control-plane-playback-reset-service.test.ts tests/proof-queue-governance.test.ts tests/proof-control-plane-activation-service.test.ts tests/proof-control-plane-tail-service.test.ts`
  - `npx tsc -p air-mentor-api/tsconfig.json --noEmit`
- 結果：
  - vitest：`5` files / `21` tests，皆過。
  - backend `tsc`：過。
- 途中 scope 外 generated `air-mentor-api/node_modules/.vite/vitest/.../results.json` 曾被 test runner 觸動；已回原，未留 diff。

## Remaining Risk

- route wiring 尚未接：
  - `admin-proof-sandbox.ts`
  - `msruas-proof-control-plane.ts`
  今 pass 只落 service / tests；若要 operator surface 真露 `next-day` / `next-stage` / `reset-current-stage` / `stop`，仍需後續接線。
- `complete-reset` 之「clean Sem1 / pre-tt1」最終 truth，仍倚賴 snapshot payload 與 upstream `startProofSimulationRun` source lane；本 pass 已定 contract，未改 seed/runtime producer。
- `post-see` auto-resolution 仍靠既有 queue governance 分支；今 pass 僅保 next-stage service 會回 rebuild signal 與 branch coverage，未改 governance core。
- `stopped` lifecycle 既已可由 service 打標；然若其他 selector 仍只看 `activeFlag/status` 而不看 `lifecycleState`，則 route-level consumers 仍需後續全鏈收斂。
- 權威 prompt 缺席之 proxy-authority caveat 仍在；今報僅據 current tracked corpus 與 unified plan。
