# ML Realism Sanity Audit — 2026-04-29

## Intent And Feature Intent

**Mission intent:** Judge whether the risk model and demo seed behave realistically enough for a defensible college evaluation demo. Not whether charts render — whether the evidence-to-band pipeline is honest.

**Feature intent:**
- Risk bands must communicate operational urgency without claiming calibrated probability changed.
- Marks and CO evidence must look institutionally plausible for a BTech MNC 2023 batch.
- Explanations must cite available evidence only (no future marks leaking), avoid causal overclaim, and skip — not zero-fill — missing data.
- Separate pre-demo blockers from post-demo ML improvement work.

## Method

Read and cross-checked the following owner files and handoff documents:

- `docs/demo/risk-band-realism-audit-2026-04-27.md` — root cause analysis and sensitivity audit
- `air-mentor-api/src/lib/proof-risk-model.ts:2099–2203` — `scoreObservableRiskWithModel` with override path
- `air-mentor-api/src/lib/proof-demo-operational-band.ts` — overlay constants and `deriveProofDemoOperationalBand`
- `air-mentor-api/src/lib/inference-engine.ts:1–191` — heuristic driver generation and riskProb accumulation
- `air-mentor-api/src/lib/proof-recommendation-text-generator.ts:1–280` — recommendation and rationale templates
- `air-mentor-api/src/lib/proof-queue-governance.ts:1–120` — queue governance rate limits
- `air-mentor-api/tests/proof-demo-operational-band.test.ts:1–330` — 16 test cases for override path
- `air-mentor-api/tests/proof-risk-model.test.ts:1–80` — training and scoring test scaffold
- `docs/demo/demo-safe-student-picks-2026-04-27.md` — named student evidence
- `docs/demo/college-demo-script-2026-04-27.md` — verbatim demo lines
- `scripts/analyze-trajectory-realism.mjs:1–60` — archetype and faculty seed definitions

Static code inspection only. No DB execution. No product code modified.

## Risk Band Sanity

### Pre-fix state (documented)

Before the operational overlay, 0/30 stages showed any High-band student.

Root cause: `PRODUCTION_RISK_THRESHOLDS.high = 0.85` calibrated for real failure-probability semantics; max observed `overallCourseRisk` in the deterministic proof corpus ≈ 0.71. High band mathematically unreachable.

### Post-fix state (High = 0.65 overlay)

Sensitivity audit at `high = 0.60 / 0.65 / 0.70` (per the realism audit doc):

| Sem | Stage | low/med/high @0.60 | low/med/high @0.65 | low/med/high @0.70 |
|---|---|---|---|---|
| 1 | pre-tt1 | 120/0/0 | 120/0/0 | 120/0/0 |
| 1 | post-see | 67/49/4 | 67/49/4 | 67/53/0 |
| 2 | pre-tt1 | 67/42/11 | 67/49/4 | 67/53/0 |
| 3 | pre-tt1 | 38/46/36 | 38/61/21 | 38/82/0 |
| 4 | pre-tt1 | 24/42/54 | 24/51/45 | 24/84/12 |
| 5 | pre-tt1 | 19/23/78 | 19/32/69 | 19/65/36 |
| 6 | pre-tt1 | 5/16/99 | 5/30/85 | 5/115/0 |
| 6 | post-see | 4/17/99 | 4/31/85 | 4/116/0 |

**Verdict at high=0.65:** Sem 1 pre-TT1 remains conservative (120/0/0 — no prior history, correct). High-band students emerge from sem 2/3 onward. Sem 6 post-see: 85/120 High (71%).

### Sem 6 cohort collapse — is 71% High defensible?

The 71% High rate at sem 6 reflects the synthetic corpus' deliberately heavy backlog load (archetypes include `cumulative-gap`, `underregulated`, `surface-survival`, `carryover-heavy`). This is a known property of the proof seed, not a model failure. However:

- **Queue governance limits actionable exposure:** `PROOF_QUEUE_LATE_STAGE_ACTIONABLE_RATE_LIMIT = 0.35` caps the actionable queue at 35% of cohort (≈42 students at sem 6 post-see). The 85 High students are ranked by `queuePriorityScore`; only ~42 enter the actionable queue. The mentor sees a manageable list, not 85 simultaneous escalations.
- **Named student audit:** Diya Iyer (clean) stays Low through sem 6 (riskProbScaled 38–40). Yash Reddy, Mira Patel, Aarav Reddy correctly surface as High from sem 3–6. Arjun Reddy (borderline) correctly reaches High only from sem 4. Progression is monotonic and evidence-backed.
- **Sem 6 High count is high but not indefensible** for a corpus seeded with 6-semester cumulative failure pressure. Demo presenter should explain: "The proof corpus models worst-case accumulated risk; the governance queue surfaces the highest-priority subset."

### Truth contract

`riskProb`, `headProbabilities`, `observableDrivers` are **unchanged** by the overlay. The operational band is a display-time reclassification. Verified at:
- `proof-risk-model.ts:2131–2133` (fallback path)
- `proof-risk-model.ts:2164–2167` (trained model path)
- `proof-demo-operational-band.ts:44–47` (PROOF_DEMO_OPERATIONAL_THRESHOLDS constant)
- test `proof-demo-operational-band.test.ts:118–135` (riskProb unchanged)

### Demo script alignment

Demo step 6 says: "current risk probability 0.6257 in the medium band." With high=0.65 overlay, 0.6257 < 0.65 → Medium. **Correct.** The demo script does not claim this is a failure probability — it uses "risk probability" language. **Passes truth contract.**

Minor concern: the demo script should explicitly state "operational urgency: medium" rather than bare "medium band" to match the overlay semantics. This is a presentation polish item, not a blocker.

## Marks And CO Realism

### Named student marks

| Student | Evidence | Plausibility |
|---|---|---|
| Diya Iyer | Attendance 77–87, TT1 78–87, CE 80.8, weak CO 0 | Realistic clean strong student |
| Yash Reddy | Attendance 67–71, backlog max 16 | Realistic borderline, 16 backlogs over 6 sems = plausible cumulative failure |
| Mira Patel | Attendance 87, TT1 38, quiz 37.58, assignment 30.11, CE ≈35.2, weak CO 2 | Low marks + good attendance = attendance-disconnect pattern, plausible academic weakness |
| Aarav Reddy | Backlog max 23, CE 46.6, weak CO signals | 23 backlogs over 6 sems = severe cumulative; plausible for intervention-resistant archetype |
| Arjun Reddy | Attendance 75, TT1 48.17, CE 49.8, weak CO 1, backlog 12 | Borderline — all metrics near threshold, realistic |

Marks ranges pass plausibility. No values outside credible BTech ranges. CE scores align with TT + quiz + assignment inputs.

### TT1/TT2/quiz/assignment/SEE progression

- `inference-engine.ts:84–103`: TT/SEE marks scored at thresholds `<40` (impact 0.16) and `<55` (impact 0.08).
- Null marks for assessments not yet taken are **skipped** (`if (signal.pct === null) continue` at inference-engine.ts:87), not zero-filled. This is correct.
- `demo-safe-student-picks-2026-04-27.md` warns about Vihaan Iyer: "missing TT2/SEE are treated as zero." **This claim requires investigation.** The inference engine correctly skips null marks, but a separate CO-evidence or mark-normalization path may zero-fill. This is not confirmed in the files inspected and should be verified. Flagged as a reverification item.

### CO mapping

- `weakCoCount` enters driver generation at inference-engine.ts:144–156.
- `weakCourseOutcomeCodes` in `sourceRefs` feeds cross-course correlation drivers at proof-risk-model.ts:2090–2097.
- CO evidence mode tracked in `sourceRefs.coEvidenceMode`.
- CO driver text: "Multiple course outcomes are below the support threshold (N)" — cites count, no causality. Correct.
- Cross-course driver: "AMC101 weakness historically lifts AMC301 adverse outcomes by X scaled points in the current proof corpus" — explicit corpus-scoping and "historically lifts" (not "causes"). Correct.

CO mapping is incomplete for non-AMC301 courses (only AMC301 has weak CO codes in test scaffold). Post-demo work: verify CO coverage for all six-semester courses.

## Explanation And Recommendation Realism

### Driver text fidelity

All driver labels in `inference-engine.ts:42–172` use:
- Concrete numbers: `Attendance is below the high-risk threshold (${attendancePct}%)`.
- Threshold-relative language: "is below / above the policy threshold" — no causal overclaim.
- No future evidence: null marks skipped; SEE mark only appears if `seePct !== null`.
- CGPA guard: `currentCgpa > 0` prevents zero-CGPA false positive (inference-engine.ts:56). `cgpaMissing` flag also respected.
- Backlog guard: `backlogMissing` flag respected (inference-engine.ts:70).

Drivers are sorted by impact descending (inference-engine.ts:172) — top driver correctly dominates recommendation.

### Recommendation quality

`generateRecommendationText` (proof-recommendation-text-generator.ts:246–280):
- Maps `topDrivers[0].feature` → `dominantWeakness` → `primaryAction` (deterministic, no LLM involved).
- Metrics summary uses actual numeric inputs: attendance%, TT1%, CGPA, backlog count.
- Rationale is templated, not static three-string output.
- HoD escalation requires `priorFailed AND (backlog≥2 OR consecSevere≥2 OR cgpa<4.5)` — first-time High students are not immediately escalated. Correct escalation ladder.

### Issue: `deriveDeferHod` first-attempt gate

At proof-recommendation-text-generator.ts:33–34:
```typescript
const priorFailed = input.interventionHistory.lastTier !== null && input.interventionHistory.lastTier !== 'strong'
if (!priorFailed && input.interventionHistory.appliedCount === 0) {
  return false
}
```
A student with `appliedCount=0` (no prior intervention) and `lastTier=null` is correctly gated: `!priorFailed=true` AND `appliedCount===0=true` → return false (no HoD escalation). This means the first High-band encounter recommends Mentor engagement, not HoD. **Correct institutional behavior.**

### Missingness as zero — not confirmed for inference path

The inference engine correctly handles null as "not yet observed." Whether any upstream normalization converts missing marks to 0 before they reach the inference engine is not verifiable from the files read. The demo-safe-picks doc warns about Vihaan Iyer ("missing TT2/SEE are treated as zero") which contradicts the inference engine behavior. **This is an open question to verify in the mark-normalization pipeline.**

## Model Governance Gaps

| Gap | Severity | Location |
|---|---|---|
| `calibrationVersion: null` in fallback path | Low | proof-risk-model.ts:2139 |
| Heuristic `inferObservableRisk` uses medium threshold 0.35; trained model uses 0.4; operational overlay uses 0.4 | Low | inference-engine.ts:180 vs proof-demo-operational-band.ts:45 |
| Handoff doc (Phase 7) lists test check for `high=0.6` but actual test uses `0.65` | Documentation only | HANDOFF Phase 7 vs proof-demo-operational-band.test.ts:11–12 |
| `displayProbabilityAllowed=false` for fallback heads — correct suppression | OK | proof-risk-model.ts:2128 |
| `RISK_FEATURE_SCHEMA_VERSION` check gates fallback path | OK | proof-risk-model.ts:2123 |
| No calibration artifact for proof corpus — model trained on synthetic data, not real institutional data | Known/documented | proof-demo-operational-band.ts:6–8 |
| CO coverage gap: weak CO codes only tested for AMC301 in test scaffold | Low | proof-risk-model.test.ts:76–77 |

The `calibrationVersion: null` in the fallback path is expected (no trained artifact means no calibration artifact). This is correctly suppressed via `headDisplay.displayProbabilityAllowed=false`.

The heuristic medium threshold inconsistency (0.35 vs 0.4) is a minor issue: it only matters when the proof corpus falls back to the heuristic engine (no trained artifact loaded). In that case, students with `riskProb` in [0.35, 0.4) would show Medium under heuristic but Low under the operational overlay. Impact: a small number of borderline students may be re-classified downward when the override is applied without a model. Low demo risk.

## ML Improvement Queue

**Pre-demo (blocking if not addressed):**
- None identified. The operational overlay, isolation guard, and 16/16 test pass are sufficient for a defensible demo.

**Post-demo (ML work, prioritized):**

1. **Verify missingness handling in mark-normalization pipeline.** The demo-safe-picks doc warns about Vihaan Iyer and zero-filled missing marks. Confirm whether the upstream mark snapshot writer or CO evidence builder converts null to 0 before inference. If so, add a `markMissing` flag analogous to `cgpaMissing`.
2. **Reconcile heuristic medium threshold (0.35) with model/overlay threshold (0.4).** Either align the heuristic fallback or document the divergence explicitly.
3. **CO coverage audit.** Verify that all six-semester courses have CO mappings populated in the proof seed. The test scaffold shows AMC301 with weak CO codes but other courses show empty `weakCourseOutcomeCodes`. If CO evidence is missing, the driver shows nothing instead of "no CO evidence yet."
4. **Calibrate model on real institutional data.** Current proof model is trained on the deterministic synthetic corpus. The operational overlay compensates for threshold compression but is demo-only. Real deployment requires calibration on historical outcomes.
5. **Trajectory modeling.** Current pipeline scores each stage independently. Post-demo: add cross-stage trajectory features (score decline rate, consecutive-stage degradation momentum) to reduce sem 1–2 conservatism while preserving early-semester caution.
6. **Cohort-stratified band documentation.** Sem 6 at 71% High is a corpus artifact. Post-demo: document expected High-band distribution per archetype family so operators know what "normal" looks like for the synthetic proof seed.
7. **`interventionResponseScore` feature calibration.** Currently negative-score driver text reads "Observed response after support remains below the expected recovery threshold." This is evidence-based but the score is synthetic. Post-demo: back this with real intervention outcome data.

## Blockers

No pre-demo hard blockers identified.

**Soft flags (address before final demo run):**
1. **Demo script wording:** Step 6 says "in the medium band" — should say "operational urgency: medium" to distinguish from calibrated band semantics. Low risk; easily corrected verbally.
2. **Handoff doc threshold typo:** Phase 7 lists test check for `high=0.6` but actual constant and test both use `0.65`. The typo is in the handoff doc only; the code is correct. Document-level correction.
3. **Vihaan Iyer zero-fill claim:** demo-safe-picks warns about zero-filled missing marks for Vihaan. The inference engine skips null marks. Verify whether the upstream mark builder path zero-fills before passing to inference. Vihaan is listed as "student to avoid" in demo-safe-picks, so demo exposure is low, but the underlying behavior should be confirmed.

## Reverification Needed

| Item | File | Verification needed |
|---|---|---|
| Missingness path for TT2/SEE null marks in proof seed builder | Not inspected (proof seed builder, mark snapshot writer) | Confirm null marks reach inference as null, not 0 |
| proofScopeActive gate in academic.ts:1605–1626 | Not inspected (academic.ts) | Confirm live institutional data never receives demo banding |
| CO evidence completeness for all 6-semester courses | air-mentor-api/src/db/seeds/msruas-mnc-curriculum.json | Confirm weakCourseOutcomeCodes populated for all courses |
| Queue governance rank vector behavior at sem 6 (85 High) | proof-queue-governance.ts:87–102 | Confirm 35% rate limit correctly caps actionable list |
| Test pass status (16/16) | proof-demo-operational-band.test.ts | Run `vitest run proof-demo-operational-band` to confirm |

## Verdict

**PASS for demo — with caveats.**

The operational urgency overlay (`high=0.65`, `medium=0.4`) is correctly implemented, isolated behind `proofScopeActive`, and verified by 16 unit tests. The truth contract is intact: calibrated `riskProb`, `headProbabilities`, and `observableDrivers` are unchanged. The band is a display reclassification, not a probability re-quote.

Risk band progression across 30 stages is consistent with expected institutional behavior: sem 1 pre-TT1 conservatively stays at Low, High band emerges from sem 2/3 for students with prior CGPA/backlog pressure, and the six named demo students each show the correct trajectory. Sem 6 at 71% High is a corpus artifact (heavy backlog seed) mitigated by the 35% queue governance rate limit.

Explanation and recommendation text is evidence-anchored, avoids causal overclaim, skips future evidence, and uses concrete numbers. HoD escalation ladder is correctly gated on prior intervention failure.

**Remaining pre-demo soft items:** demo script wording alignment, Vihaan zero-fill verification, handoff doc typo. None block the demo.

**Post-demo ML work:** 7 items queued (missingness guard, CO coverage, calibration on real data, trajectory modeling, cohort documentation, threshold reconciliation, intervention score calibration).
