# P2 Entry Context — 2026-05-01

> Companion to `docs/MASTER_ROADMAP_2026-05-01.md` §5 P2.
> Captures the deltas between the roadmap (which assumed minimal ML
> infrastructure) and the actual `air-mentor-api/src/lib/proof-risk-model.ts`
> reality at P2 entry, plus the deferred items P2 must keep in mind.
> Do **not** delete this file before P10 paper drafting — it is the
> reviewer-facing "we already had this" audit trail.

---

## 1. Roadmap-vs-Reality reconciliation

The roadmap §5 P2 was scoped from the assumption that the ML pipeline was
a minimal `trainLogisticBaseCompact()` on a 64-world manifest. **It is not.**

| Roadmap P2 task expectation | Actual codebase state |
|---|---|
| 2.1 "Add `split` per row to manifest" | `PROOF_CORPUS_MANIFEST` already has `split: 'train' \| 'validation' \| 'test'` (`proof-risk-model.ts:106-107, 156-166`); 40 / 12 / 12 partition. |
| 2.1 "Generative-Process Split (train families ⊥ val ⊥ test)" | **Not present.** Existing split is family-balanced (round-robin `index % 8`), so all 8 families appear in all 3 splits — exactly the distribution-leak setup E8 calls out. **This is the real load-bearing P2 work.** |
| 2.2 "Baseline 1: majority-class predictor" | Not present as a named config. Add. |
| 2.2 "Baseline 2: logistic on (attendance, CGPA) only" | Not present. Add. |
| 2.2 "Baseline 3: random forest on top-5" | Stronger than this exists: `depth-2-tree` in-process challenger family + `catboost` Python-interop scaffold (`ChallengerModelFamily`). RF specifically is missing. |
| 2.2 "Baseline 4: full model" | Present as `production-v8` with 43 features (cgpa/backlog missingness scaled, stage indicators, interaction features). |
| 2.3 "Sensitivity sweep ±20% per critical parameter" | Not present. Add. |
| 2.4 "Adversarial corpus" | Not present. Stretch. |
| 2.5 "Brier, ECE, reliability diagram" | Brier + ECE + slope + intercept already in `RiskMetricSummary` (`proof-risk-model.ts:249-259`). Reliability **bin** structure exists (`ReliabilityBin`); a *diagram exporter* (PNG/PDF) does not. |
| 2.5 "Per-split reporting" | Already in evaluator artifacts. |
| E13 "No bootstrap CIs on AUC" | Not present. Add. |
| E14 "No permutation feature importance" | Not present. Add. |

**Implication for §4 status flips at P2 close:**
- E12 should be partial (we have ECE/Brier/slope/intercept but no reliability diagram artifact).
- E13, E14, E11 (adversarial corpus) remain pending.
- E8 closes when generative-process split is wired.
- E9 (no baselines for comparison) is **already partially closed** by `BASELINE_V5_LIKE_PROOF_RISK_TRAINING_CONFIG` + `depth-2-tree` challenger; closes fully once two simpler baselines (majority + 2-feature logistic) are added per roadmap text.
- E10 (no sensitivity analysis) closes with the sweep script.

---

## 2. The hybrid-router + coverage-24 evidence (do not lose)

`audit-map/32-reports/proof-risk-model-investigation-2026-04-20.md`
documents an extensive prior investigation:
- **`coverage-24` profile** (8 train + 8 val + 8 test; each split is
  family-balanced) — defined in `air-mentor-api/scripts/evaluate-proof-risk-model.ts:299`.
- **Hybrid router experiment** running per-head per-stage allowlisted
  routing between current `v6` and `depth-2-tree` challenger. **Did not
  promote** on the wide `coverage-24` rerun: it gained on Brier / log-loss
  / PR-AUC for some heads but lost ROC-AUC and ECE on others.
- **Final research read** (file lines 268–292): keep `v6` (now `v8` in code)
  as production default; per-head routing only with guardrails;
  CatBoost as next serious challenger; Beta + Venn-Abers calibrators
  preferred; conformal-style abstain/escalate for safe interventions.

P2 must **not** discard this. The generative-process split is a
*different protocol* answering a *different question*: it asks "does
the engine generalise to held-out failure modes?" rather than
"does the ranking improve on a wider seed pool?" Both protocols stay.

The paper Experiments section will report metrics on **both** the
existing family-balanced `coverage-24` (in-distribution) and the new
family-disjoint generative-process split (out-of-distribution) so the
reviewer sees the gap. **Risk** (already in roadmap §8 row 2): AUC
likely drops sharply on generative-process split. That is **expected
and reportable**, not a failure.

---

## 3. The pre-existing failing test — root cause + handoff

`air-mentor-api/tests/msruas-proof-engines.test.ts:338` "converts CE
thresholds to percentages and only surfaces coursework once the stage
allows it" — fails on the demo branch **before** P1, verified by
`git stash` round-trip on 2026-05-01.

Root cause: divergence between the test and `stageCourseworkEvidenceForStage`
in `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:83-98`.

```ts
// CODE (proof-control-plane-playback-service.ts:88)
if (input.stageKey === 'pre-tt1' || input.stageKey === 'post-tt1' || input.stageKey === 'post-tt2') {
  return { quizPct: null, assignmentPct: null }
}
```

```ts
// TEST (msruas-proof-engines.test.ts:361-368)
expect(stageCourseworkEvidenceForStage({
  stageKey: 'post-tt2',
  quizPct: 72,
  assignmentPct: 74,
})).toEqual({ quizPct: 72, assignmentPct: 74 })
```

**Code suppresses coursework at `post-tt2`; test expects it visible at
`post-tt2`.** One side is stale. Resolution requires deciding the
intended stage gate semantics (pedagogical: "when in the term lifecycle
does coursework first count for risk evidence?"):

- **Option A** (test is right): coursework should surface at `post-tt2`
  because by then internal-evaluation evidence is final. **Fix code:
  remove `'post-tt2'` from the suppression list.**
- **Option B** (code is right): coursework only surfaces at
  `post-assignments` (when assignment grades are explicit) or
  `post-see` (after final). **Fix test: change line 365 to
  `quizPct: null, assignmentPct: null`.**

The right call probably depends on the realism-readiness audits in
`audit-map/32-reports/realism-readiness-security-2026-04-30.md`
(untracked). **Handoff to whoever owns the realism-readiness branch.**

P2 does NOT touch this — but P2 cannot pretend the suite is green.
P2's verification step asserts "this one pre-existing failure is the
only failure introduced by neither P0 nor P1 nor P2". If a second
failure appears, P2 owns it.

---

## 4. Deferred items kept in mind during P2

- **L1 default A** (simulation platform) — assumed confirmed; if user
  flips to B/C the paper claim N1 framing changes and P2 evidence
  needs reframing.
- **L2 default EDM 2027** — timeline math in `docs/CHANGELOG.md`
  assumes ~Feb 2027; T-3w internal review ~mid-Jan 2027.
- **L3 ECE 2024 required for N2** — gates P6; P2 does not depend.
- **L4 Render plan** — unrelated to P2.
- **L5 Demo data clean-slate before P5** — unrelated to P2.
- **L6 Recalibration AUC bar** — partially relevant: P2's bootstrap CIs
  on AUC will inform the bar choice in P7.
- **L7 frontend domain** — unrelated to P2.
- **L8 Recalibrate vs Retrain coexist** — implied default = "full
  replace" because L1=A (simulation has no real-data retrain). Lock in
  P3 task 3.7.
- **L9 Provisioning tab fate** — unrelated to P2.

---

## 5. Other deferred items P2 must keep in mind

| Item | Status at P2 entry | What P2 does about it |
|---|---|---|
| ~21,109 tracked `node_modules/` entries | broader K8 — too large for this turn | Capture here; sweep in a dedicated session with code-owner sign-off. K8 narrow scope (`.vite/`) closed in commit `5f2cd413`'s follow-up. |
| Duplicate `ScenarioFamily` type (`learning-dynamics-constants.ts:304` vs `proof-risk-model.ts:96`) | compile-safe (same 8 strings, different order) | P2 task 2.1 reuses `PROOF_SCENARIO_FAMILIES` from `proof-risk-model.ts` to avoid divergence; eventual reconciliation belongs to whichever phase touches `learning-dynamics-constants.ts` next. |
| ~50 in-progress `air-mentor-api/src/*` and `src/*` modifications + audit-map `32-reports` untracked | existing work from realism-readiness audits | P2 leaves them untouched. Not committed by any P0 / P1 / P2 commit. The realism branch owner integrates them. |
| `tests/msruas-proof-engines.test.ts > "converts CE thresholds"` | pre-existing failure (Section 3 above) | not touched; P2 verification gate accepts this one specific failure as carry-over. |
| Hybrid-router research lane | not promoted | Stays as-is. P2 evidence reports it as the in-distribution finding; cross-references the new generative-process protocol. |
| CatBoost Python-interop scaffold | not wired end-to-end (per `phase 10 intent` comment in proof-risk-model.ts:97-100) | P2 does not run CatBoost. The bootstrap-CI / permutation-importance work added by P2 does not depend on it. |
| `.vite` cache regenerating each build | now gitignored | nothing further. |

---

## 6. The branch question

P2 work in this session continues on `college-demo-2026-04-27`
(default proposed in this conversation). Cutting `research/p2-validation`
off it is correct per `docs/BRANCH_STRATEGY.md` once the demo branch
work is fully merged to `main`. Until that merge happens, doing P2 on
the demo branch is a calculated trade-off: it keeps history
contiguous; it costs branch-isolation. If a major regression surfaces
on demo branch from non-P2 work, P2 commits will be cherry-picked.
