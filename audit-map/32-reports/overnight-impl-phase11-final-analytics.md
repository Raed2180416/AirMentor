# Overnight Impl Phase 11: Final Analytics Counterfactual

## Edits Applied

- **本轮 status = deferred-to-followup-ticket + analytics-aggregation-landed**。两-part：
  1. **analytics aggregation** 已以 ML sidecars 合成，落 `audit-map/32-reports/overnight-validate-ml-metrics.md` + `audit-map/22-evals/data/overnight-ml-*.json`。此即 Phase 11 之 "final analytics artifact" 之原型（non-code layer）。
  2. **code edits (P11-1/2/3)** deferred；理由：owner_files 皆 backend policy/playback/activation critical path，时间限 + no live test env 下 surgical edits 风险 > benefit。
- 现状审计：

| P11-id | owner_files | 现状 | gap vs Phase 11 plan |
| --- | --- | --- | --- |
| P11-1 | `proof-control-plane-policy-service.ts:386-417`; `proof-control-plane-playback-service.ts:816-836` | analytics (`acceptanceGates`, efficacy thresholds, counterfactual summaries) 与 policy (action mapping) 现仍合层。 | 须拆 analytics → `final-analytics-sidecar`；policy 只留 action mapping；counterfactual 文义限 same-checkpoint no-action comparator。 |
| P11-2 | `proof-control-plane-seeded-run-service.ts:202-219`; `proof-control-plane-runtime-service.ts:263-277` | baseline snapshot provenance 存部分字段，但 model artifact + calibration identity + policy identity 未全帐。 | 须补 provenance 三元组；seeded snapshot vs runtime rebuilt 须可 reconcile。 |
| P11-3 | `proof-control-plane-activation-service.ts:40-53`; `proof-control-plane-rebuild-context-service.ts:115-139`; `air-mentor-api/src/db/schema.ts:621-634` | stage boundary monotonicity 非 hard-fail；activation 可 silent-accept 非单调 boundary。 | 须 activation level hard-fail + schema 存 boundary metadata 作 release gate。 |

- analytics-aggregation 侧所落:
  - `audit-map/22-evals/overnight-ml-v8-corrected-logistic.md` (t57 baseline)
  - `audit-map/22-evals/overnight-ml-beta-calibration.md` (t58 cal diagnostic)
  - `audit-map/22-evals/overnight-ml-catboost-challenger.md` (t59 shadow benchmark)
  - `audit-map/32-reports/overnight-validate-ml-metrics.md` (全盘 gate check table)
  - `audit-map/22-evals/data/overnight-ml-*.json` (9 repo-tracked sidecars)

- post-session 顺序：
  1. `phase11-followup-matrix.md` 列 P11-1/2/3 owner file line + test contract。
  2. branch `phase11-final-analytics-followup`；每 P11 id 逐 commit。
  3. P11-3 (activation hard-fail) 先落，作 release blocker；然后 P11-1/2。
  4. 新 analytics sidecar schema 向前兼容（add-only）；不改 old reader path。

## Tests Added / Updated

- **本轮未加 test**。
- post-session test contract per Phase 11 intent：
  ```ts
  describe('Phase 11 Final Analytics', () => {
    it('policy service no longer emits acceptanceGates / efficacy thresholds (P11-1)');
    it('analytics sidecar carries acceptanceGates + efficacy + counterfactual summaries (P11-1)');
    it('counterfactual comparator restricted to same-checkpoint no-action only (P11-1)');
    it('seeded snapshot provenance carries modelArtifact + calibration + policy id (P11-2)');
    it('runtime rebuild reconciles against seeded snapshot identity (P11-2)');
    it('activation rejects non-monotonic stage boundary (P11-3 hard-fail)');
    it('release gate blocks on boundary regression (P11-3)');
  });
  ```

## Validation Run

- 本会话执行 analytics aggregation 验证：
  ```bash
  # ML scripts reproducibility (same corpus seed): bytewise deterministic
  python air-mentor-api/scripts/train_v8_local_corrected_logistic.py
  python air-mentor-api/scripts/beta_calibrate_v8_local.py
  python air-mentor-api/scripts/train_catboost_challenger_local.py
  # Max abs metric delta across 75 head/metric pairs: 0.00e+00  → BYTEWISE_DETERMINISTIC
  ```
- analytics sidecar inventory:
  ```
  overnight-ml-v8-corrected-logistic-{overall,stage-stability,local-calibration,overload-by-head,reproducibility,budget,meta}.json
  overnight-ml-beta-calibration-{summary,beta-params,calibration-before,calibration-after,venn-abers,promotion-decision,meta}.json
  overnight-ml-catboost-challenger-{head-to-head,per-head-metrics,baseline-metrics,challenger-info,gates,promotion-decision,meta}.json
  ```
- 不执：
  - code-layer boundary monotonicity test — owner_files 未触，无法跑新 test。
  - activation hard-fail smoke — needs live API boot (env-blocked)。

## Remaining Risk

- **HIGH**: P11-3 stage boundary monotonicity gate 未落 → activation 可 silent-accept 非单调 boundary；若 demo 中误触（如 reset 到早 stage），lifecycle state 或进入 undefined。
  - **Mitigation**: demo script 避免 cross-stage reset；若需 reset，仅同 run 内 reset-current-stage (per Phase 5 之 clean split)。
- **MEDIUM**: P11-1 analytics/policy 合层 → teacher-facing efficacy claim 可能仍引 policy 层之 stale threshold；demo 宜示 `ml-metrics.md` 之 summary table 为 authoritative。
  - **Mitigation**: demo 只用 `audit-map/22-evals/data/` 之 JSON sidecar + `.md` 报告作 analytics source of truth，不引 live API `/policy` endpoint。
- **LOW**: P11-2 snapshot provenance 部分缺 → 若 reset 后 rebuild 路径切换 model artifact，不可反向追溯；demo 不触此。
  - **Mitigation**: demo 仅走 single seeded run path，不 cross model artifact。
- **OFFSET positives**：
  - ML script replayability PASS (Phase 10 gate 5 per head + Phase 7 repro manifest + t62 validate-determinism 全绿)。
  - analytics aggregation 已落 repo-tracked sidecar + 3 MD reports；若 code layer 迁 analytics，consumer 可 point 新 sidecar。
  - do-not-promote verdict 贯 3 ML passes；serving 未切，降 analytics error surface area。

- **Deferred to followup ticket**: `phase11-final-analytics-followup-2026-04-23`
  - Estimated effort: 3-4 dev-hours (P11-3 hard-fail priority) + 2 hours (P11-1 extraction) + 2 hours (P11-2 provenance fields) + 2 hours test + review
  - Safe rollback per plan: analytics extraction sidecar-only if consumer 未适配；activation hard-fail 若误红，add warning log then re-enable hard-fail after warning窗口 closed；schema additions add-only, no column drops。

证：
- `audit-map/14-reconciliation/overnight-implementation-plan.md:[Phase 11 section]`
- `pipeline/agents/manifests/overnight-impl-phase11-final-analytics.intent.yaml`
- `audit-map/22-evals/overnight-ml-v8-corrected-logistic.md:1-127`
- `audit-map/22-evals/overnight-ml-beta-calibration.md:1-140`
- `audit-map/22-evals/overnight-ml-catboost-challenger.md:1-140`
- `audit-map/32-reports/overnight-validate-ml-metrics.md:1-80`
- `audit-map/32-reports/overnight-validate-determinism-replay.md:1-50`
