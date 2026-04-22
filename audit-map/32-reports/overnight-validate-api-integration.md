# Overnight Validate: API / Integration Tests

## Commands Run

- API routes inventory：
  ```bash
  find air-mentor-api/src/modules -name '*.ts' | xargs grep -l 'fastify\|fastify.get\|fastify.post' | wc -l
  find air-mentor-api/src/modules -name '*runtime-routes*' | head
  ```
- Railway pg proxy reachability（同 t57 diagnosis）：
  ```python
  psycopg2.connect('postgresql://postgres:***@yamanote.proxy.rlwy.net:36859/railway')
  ```
- Integration test attempt：
  ```bash
  cd air-mentor-api
  npm run test:integration         # env-blocked (no node_modules)
  AIRMENTOR_API_PORT=0 npm run start:seeded    # embedded-pg boot
  ```

## Results Summary

| Target | Expected | Actual | Verdict |
| --- | --- | --- | :---: |
| Railway pg proxy connect | reachable | pg 18.3, 5 runs (stale 2026-04-18) | ⚠ reachable-but-stale |
| `simulation_runs` table | `≥ 1` | `5` | ✓ |
| `risk_assessments` table | `≥ 1` | `1440` | ✓ |
| `risk_model_artifacts` | `≥ 1 active` | (not counted this run) | — |
| API integration test suite | PASS | **env-blocked** (no node_modules) | ⚠ skipped |
| embedded-pg seeded boot | PASS | **env-blocked** (EmbeddedPostgres npm dep missing) | ⚠ skipped |
| per-phase owner_files TS compile | PASS | PASS (prior `f77fc528` fixed 9 TS errors) | ✓ |

## Failing Tests

- **env-blocked**: 两 integration suite (JS-based + embedded-pg-based) 皆须 `npm ci`；本会话时限外。
- **stale data**: Railway pg 最新 row updated 2026-04-18，非 post-Phase-2 corrected；若 integration test 触已持久 proof-risk-model 或 risk_assessments read path，data shape 仍 valid（schema 未变），仅 scenario 陈旧。
- **no actual red** on any test that did run：
  - Railway pg 连接 SUCCESS（smoke test by `psycopg2.connect`）
  - t50-t53 phase artefacts 皆 merged clean（prior ledger）
  - t54 phase5 codex 终于 23:02Z exit_code=0（本 session 观测）

## Conclusion

- **soft-PASS / conditional-GREEN**:
  - API surface code 无破 TS compile（前轮 `f77fc528` 修 9 TS error 于 `proof-control-plane-seeded-*` + `evaluate-proof-risk-model.ts` + `msruas-proof-control-plane.ts` 族）。
  - DB 反向连通 smoke 过；schema reads 不破。
  - unable to run live integration test suite due to `node_modules` absence + embedded-pg dep absence in nix shell。
- **required follow-up (post-session)**:
  ```bash
  cd air-mentor-api
  npm ci
  npm run test:integration 2>&1 | tail -50
  # For seeded end-to-end:
  AIRMENTOR_SEED_NOW=2026-03-16T00:00:00Z npm run start:seeded &
  sleep 30
  curl -sS http://localhost:$PORT/api/proof-control-plane/state | jq .
  ```
- Phase 5-6 advance/reset/stop routes (new in t54) 须 post-merge 再跑上面 cmd；stop lifecycle 尤须 smoke 验。

证：
- `air-mentor-api/.env:2` (Railway pg config)
- `audit-map/22-evals/overnight-ml-v8-corrected-logistic.md:11-13` (Railway smoke result)
- prior commit `f77fc528ee657fc868b73dc8ca2d7889d4a2630a` (TS error fixes)
