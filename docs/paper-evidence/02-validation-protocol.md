# 02 — Validation Protocol

> Phase: P2 (Validation Methodology Fix), task 2.1
> Companion: `docs/paper-evidence/scenario-grounding.md`,
> `docs/references.bib`,
> `audit-map/24-agent-memory/p2-entry-context-2026-05-01.md`,
> `air-mentor-api/src/lib/proof-risk-model.ts`
> Date: 2026-05-01

This file is the methodological contract for the paper Experiments
section. It reconciles two evaluation protocols that coexist in the
codebase, documents which protocol backs which paper claim, and lists
the deferred validation work that P2 has not yet finished.

---

## 1. Two protocols, two questions

### Protocol A — In-distribution, family-balanced (legacy)

- **Source:** `PROOF_CORPUS_MANIFEST[*].split` — original index-based
  field at `air-mentor-api/src/lib/proof-risk-model.ts:202-213`.
- **Partition:** 40 train / 12 validation / 12 test rows of a 64-row
  manifest, assigned by index. Family rotation is `index % 8`, so
  every scenario family appears in every split.
- **Question answered:** "Given a population sampled from the same
  generative process, does the trained model rank correctly?" — i.e.
  ranking and calibration *under in-distribution conditions*.
- **Used by:** the deployed production training pipeline (variants
  `production-v8`, `production-v7`, `baseline-v5-like`); the
  evaluator's `manifest-64`, `coverage-24`, `coverage-32`, and `smoke-3`
  profiles defined in `air-mentor-api/scripts/evaluate-proof-risk-model.ts`.
- **What it cannot answer:** generalisation to scenario families the
  training corpus has never seen.

### Protocol B — Out-of-distribution, family-disjoint (P2 addition)

- **Source:** `PROOF_CORPUS_MANIFEST[*].generativeSplit` — new field
  added in this phase; helper `selectGenerativeSplitEntries(split)`.
- **Partition:** family-disjoint per roadmap §5 P2 task 2.1:

  | Split | Families | Manifest entries (out of 64) |
  |---|---|---:|
  | train | weak-foundation, low-attendance, high-forgetting, coursework-inflation | 32 |
  | validation | exam-fragility, carryover-heavy | 16 |
  | test | intervention-resistant, balanced | 16 |

- **Question answered:** "Trained on a subset of the documented failure
  modes, does the model usefully rank instances from held-out failure
  modes?" — i.e. cross-family generalisation. This is the test that
  defends paper claim N1 ("reproduces failure modes that generalise")
  rather than merely "reproduces failure modes that were trained on".
- **What it cannot answer:** generalisation across academic *programs*
  (curricula). That is P6 + P7's job.

### Why both exist

The roadmap §4 row E8 originally framed the legacy protocol as a
distribution leak. It is — but only with respect to the cross-family
generalisation question. For the production-training question
(in-distribution ranking) the legacy split is the right tool. The two
protocols answer two different questions; the paper Experiments
section reports both, and the gap between them **is the load-bearing
finding** for honest paper claims.

---

## 2. Closure of roadmap §4 row E8

E8 is closed by:

1. The new `generativeSplit` field on every manifest entry.
2. The `generativeSplitForFamily()` helper, which is total (every
   `PROOF_SCENARIO_FAMILIES` member resolves to one split) and
   verified by `tests/proof-generative-split.test.ts`.
3. The `selectGenerativeSplitEntries(split)` helper that returns the
   family-disjoint partition.
4. **Tests guarantee** (15 invariants in `tests/proof-generative-split.test.ts`):
   - exhaustive + disjoint family assignment
   - field consistency (`generativeSplit` matches `scenarioFamily`)
   - sizing (32 / 16 / 16) for the round-robin 64-world manifest
   - the two protocols genuinely disagree (otherwise the new protocol
     would be cosmetic)
   - balanced family lands only in test under Protocol B
5. **No regression on Protocol A** — `proof-risk-model.test.ts`,
   `proof-risk-scoring-parity.test.ts`,
   `evaluate-proof-risk-model.test.ts` all pass with the new field.

---

## 3. Expected outcome and risk register update

Roadmap §8 row 2 states "AUC drops sharply after distribution leak fix
— probability high, impact medium, mitigation: expected; report
honestly. May reveal smaller true gap." — that prediction holds for
Protocol B.

The paper Experiments section (P10) will report, side by side:

| Metric (overallCourseRisk) | Protocol A test | Protocol B test |
|---|---|---|
| ROC-AUC | (existing v8 evaluator) | (new — to be measured in P2.5) |
| Brier | (existing) | (new) |
| ECE | (existing) | (new) |
| Bootstrap 95% CI on AUC | **missing — E13** | **missing — E13** |
| Permutation feature importance (top-5) | **missing — E14** | **missing — E14** |
| Decision-utility @ budget=K | **partial — coverage in evaluator** | **missing** |

The "(new — to be measured in P2.5)" rows are produced by re-running
the evaluator with `selectGenerativeSplitEntries` instead of the
index-based split. The runner script change is small; the load-bearing
work is the metric collection, calibration check on held-out families,
and reliability-diagram export.

If Protocol B numbers are weak (e.g. AUC < 0.65 on overallCourseRisk),
paper claim N1 must be downgraded from "reproduces failure modes that
generalise" to "reproduces in-distribution failure modes; cross-family
generalisation is an open question". This is the **honest disclosure
path** required by `docs/POSITIONING.md` option A.

---

## 4. What P2 has *not* yet done (carried into next P2 commits)

| Item | Roadmap ref | Disposition |
|---|---|---|
| Re-run evaluator on Protocol B; emit per-head per-stage metrics | P2.1 follow-up | Wire in the evaluator script's `EVAL_SEED_PROFILES` map: add `generative-split-train`, `generative-split-val`, `generative-split-test` profiles. |
| Add majority-class baseline + 2-feature logistic baseline | P2 task 2.2 | New configs in `proof-risk-model.ts`; train + score under both protocols; emit comparison table to `docs/paper-evidence/03-baseline-results.md`. |
| Sensitivity sweep (±20% per critical parameter) | P2 task 2.3 | New script `scripts/sensitivity-sweep.ts`; reads `learning-dynamics-constants.ts` + `SCENARIO_FINGERPRINTS`; emits `docs/paper-evidence/04-sensitivity-analysis.md`. |
| Adversarial corpus (different generative process) | P2 task 2.4 (stretch) | E11 closure. Power-law forgetting variant, etc. Emit boundary-of-generalisation document. |
| Reliability diagram exporter | P2 task 2.5 | E12 closure (Brier / ECE already in `RiskMetricSummary`; only the diagram artifact is missing). |
| Bootstrap CIs on AUC | E13 closure | New helper in `proof-risk-model.ts`. Not a separate phase; folded into evaluator output. |
| Permutation feature importance | E14 closure | Same — helper + evaluator wire-in. |

These will land as discrete commits, each with a roadmap §4 status flip
in `docs/CHANGELOG.md`.

---

## 5. Reviewer-question pre-empt

| Likely reviewer question | Answer in this phase |
|---|---|
| "Why didn't you use cross-validation?" | k-fold CV is appropriate for in-distribution generalisation (Protocol A in spirit); it does not answer cross-family generalisation. We used family-disjoint hold-out for that question and report both protocols. |
| "Why these particular 4 / 2 / 2 family assignments?" | Train preserves the four broad failure-mode classes covered in `scenario-grounding.md` (cognitive deficit + engagement deficit + coursework + state-dependent). Validation holds out the *state-dependent* class (exam-fragility, carryover-heavy). Test holds out *barrier* + *control* (intervention-resistant, balanced) — the two hardest. |
| "Why round-robin family assignment in the underlying 64-world manifest?" | Each family contributes exactly 8 worlds in both protocols. That keeps the per-family coverage uniform and prevents one family from dominating either protocol's training signal by accident of indexing. |
| "Why didn't you change the production split?" | Two reasons: (a) regenerating the deployed `production-v8` artifact requires the same `split` field that trained it, and we don't want to invalidate the existing evaluation evidence on the wider `coverage-24` and `manifest-64` profiles; (b) the index-based split answers a real question (in-distribution ranking) that we still want answered. We add the new protocol as an additional axis, not a replacement. |
| "Are these numbers honest given the synthetic-only ground truth?" | The paper Limitations section (per `docs/POSITIONING.md` choice A) states upfront that the labels and the populations are both synthetic, and that the protocols defend cross-family generalisation, not real-cohort generalisation. P11's data-ingestion design doc + P12's pilot conversation are where real-data validation begins. |

---

## 6. Reproduction note

To reproduce the family-disjoint partition for any future audit:

```ts
import { selectGenerativeSplitEntries } from 'air-mentor-api/src/lib/proof-risk-model'
const trainEntries = selectGenerativeSplitEntries('train')
const valEntries   = selectGenerativeSplitEntries('validation')
const testEntries  = selectGenerativeSplitEntries('test')
```

The 32 / 16 / 16 sizing and the family disjointness are guaranteed by
`tests/proof-generative-split.test.ts`. If `PROOF_SCENARIO_FAMILIES`
ever grows beyond 8, the 32 / 16 / 16 numbers shift and these tests
will fail loudly — that is the intended belt-and-braces.
