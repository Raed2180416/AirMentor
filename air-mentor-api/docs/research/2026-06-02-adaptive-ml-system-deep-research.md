# Deep Research: Research-Grade Adaptive ML System for AirMentor

## Executive Summary

The current AirMentor ML system is a **static, train-once-serve-forever** architecture. The "balanced" seed 101 failure (100% Medium/High risk across all stages) is not a bug to patch — it is an **inevitable symptom** of a system that cannot adapt its decision boundary to the data distribution it encounters. This document presents a research-grade adaptive architecture that can handle arbitrary real-world class distributions without band-aid fixes.

---

## 1. Deep Diagnosis: Why the Current System Fails

### 1.1 Current Architecture

The serving pipeline in `proof-risk-model.ts` has three modes:

1. **Heuristic fallback** (`inferObservableRisk`) — used when no trained model exists or evidence is critically sparse
2. **Logistic regression production model** — trained once on `PROOF_CORPUS_MANIFEST` (64 seeds, index-based split 40/12/12)
3. **CatBoost/Depth-2 Tree challenger** — shadow-only, trained on same corpus

The training is **batch, offline, and deterministic**: `trainLogisticBaseCompact` runs 160 iterations of gradient descent with grouped L2 regularization, then `chooseCalibration` picks the best calibrator by Brier score. The resulting weights are frozen in JSON artifacts.

### 1.2 The "Balanced" Seed Root Cause

From `proof-realism-deep-analysis-2026-06-02.json`, seed 101 shows 100% Medium/High risk at every stage. Why?

| Layer | Problem | Evidence |
|-------|---------|----------|
| **Data Generator** | `balanced` scenario in `learning-dynamics-constants.ts` applies **zero shifts** to all latent traits. Students cluster tightly around mean ability. Very few actual failures. | `generate_v2_data.py` — `balanced` has no family-specific adjustments |
| **Training** | `trainLogisticBaseCompact` uses `positiveWeight = n / (2 * positives)`. When positives are extremely rare, this becomes enormous (~50x). | Line 1893 in `proof-risk-model.ts` |
| **Calibration** | The model learns to push **all** students toward the positive-class logit to compensate for class imbalance. | Seed 101 predictions cluster at ~0.46 probability |
| **Thresholds** | `Medium >= 0.40` catches this cluster. Every student becomes Medium risk. | `PRODUCTION_RISK_THRESHOLDS` at line 29-32 |

The fundamental issue: **the model has no mechanism to detect that the target distribution has changed and that its learned weights are now inappropriate.**

### 1.3 Why Static Models Are Doomed for Education

Real university classrooms exhibit extreme distribution variation:

- **Section effects**: One section may have 40% at-risk; another 8%
- **Temporal drift**: Post-pandemic vs. pre-pandemic student preparedness
- **Course-specific priors**: Electives vs. core courses have different base rates
- **Semester progression**: Pre-TT1 uncertainty is fundamentally different from post-SEE certainty

A static model trained on a fixed corpus assumes `P(Y|X)` is identical across all these contexts. It is not.

---

## 2. Research Landscape Review

### 2.1 Bayesian Methods for Educational Risk Prediction

**Key paper**: Rico-Juan et al. (2024) — "Automatic Re..." (cited in Frontiers 2025 review)

**Relevance to AirMentor**: Bayesian logistic regression naturally maintains a posterior distribution over weights. As new evidence arrives (TT1 scores, attendance updates), the posterior updates. More importantly, the **posterior predictive variance** gives us a measure of uncertainty that is high when the model is in an unfamiliar distribution — exactly what we need to detect the "balanced" seed scenario.

**Why this matters**: Instead of outputting a point probability of 0.46, a Bayesian model outputs a distribution. If the posterior is broad and centered near the decision boundary, the system can **refrain from classifying** or fall back to heuristic mode.

### 2.2 Conformal Prediction & Risk Control

**Key paper**: ICLR 2024 — "Conformal Risk Control" (Angelopoulos et al.)

**Relevance**: Conformal prediction provides **finite-sample guarantees** on miscoverage rates without distributional assumptions. For AirMentor, this means:

- Given a calibration set from the *current* class distribution, we can guarantee that no more than, say, 10% of flagged "High" students are false positives
- When the distribution shifts, the conformal calibration set becomes unrepresentative, and the guarantees break — **this is a detectable signal**

**Implementation**: Split conformal prediction on the per-class/semester calibration set. If the empirical coverage drops below the nominal level, trigger adaptation.

### 2.3 Test-Time Training (TTT)

**Key paper**: Akyurek et al. (2024) — "The Surprising Effectiveness of Test-Time Training for Few-Shot Learning" (arXiv:2411.07279)

**Core insight**: A model can be updated at inference time using only the current test batch. For AirMentor, this means:

- At the start of a new semester, collect the first week of attendance + first quiz
- Run a few gradient steps on the base model using these examples (with self-supervised or pseudo-label objectives)
- The model adapts to the new section's distribution without any historical labels

**Critical caveat**: TTT works best when the test batch has some structure. For AirMentor, a "batch" is naturally a course section (~30-60 students) — large enough for meaningful adaptation, small enough to be distinct.

### 2.4 Concept Drift Detection in Educational Data

**Key paper**: "Model Drift in Deployed Machine Learning Models for Predicting..." (MDPI 2025)

**Findings**: The primary contributor to model degradation in student prediction is **concept shift** — the relationship between features and outcomes changes over time. The paper advocates continuous monitoring and recalibration.

**Relevant techniques**:
- **PSI (Population Stability Index)**: Compare feature distributions between training and current data
- **KS-test**: Detect shifts in individual feature marginals
- **Page-Hinkley test**: Sequential change detection for streaming data

### 2.5 Neural Additive Models (NAMs) & Explainable Boosting Machines

**Key paper**: Agarwal et al. (2021) — "Neural Additive Models: Interpretable Machine Learning with Neural Nets" (NeurIPS)

**Relevance**: NAMs learn a sum of per-feature neural networks. They are as interpretable as logistic regression (each feature has a learned shape function) but can capture non-linear relationships. The `interpret.ml` EBM implementation achieves XGBoost-level accuracy while remaining fully editable.

**For AirMentor**: Replace the linear `trainLogisticBaseCompact` with a NAM/EBM backbone. Each feature gets a shape function. When drift is detected, only the shape functions for shifted features need re-estimation — not the entire model.

### 2.6 Domain Adaptation via Importance Weighting

**Technique**: Kernel Mean Matching (KMM) or Covariate Shift Correction

**Idea**: If we can detect that the current section's feature distribution `P(X)` differs from training, we can reweight training examples to match. This is **unsupervised adaptation** — no labels needed from the target domain.

**For AirMentor**: At the start of each semester, compute importance weights between the current section's feature vectors and the training corpus. Use these weights in the logistic loss. This directly addresses the "balanced seed" problem: if the current section is all medium-ability students, the model down-weights training examples from extreme scenarios.

---

## 3. Proposed Architecture: AIR-ADAPT (Adaptive Risk Inference)

### 3.1 Design Principles

1. **Uncertainty-aware serving**: Every prediction must carry an uncertainty estimate
2. **Distribution-shift detection**: The system must know when it is out of its depth
3. **Graceful degradation**: When uncertain, fall back to heuristics — never confidently wrong
4. **Interpretable adaptation**: Teachers must understand why the model changed its mind
5. **No global retraining**: Adaptation must be local to the current context (section/semester)

### 3.2 Tiered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 3: META-CONTROLLER                       │
│  Decides which tier serves each prediction based on context    │
│  Inputs: uncertainty, drift score, evidence sparsity           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  TIER 2A:    │    │   TIER 2B:       │    │   TIER 2C:       │
│  Adaptive    │    │  Conformal       │    │  Test-Time       │
│  Bayesian    │    │  Calibrator      │    │  Trainer (TTT)   │
│  Logistic    │    │  (post-hoc       │    │  (Neural/EBM     │
│  Regression  │    │   uncertainty)   │    │   backbone)      │
└──────────────┘    └──────────────────┘    └──────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              TIER 1: STATIC BASE MODELS                         │
│  Pre-trained logistic + EBM + ensemble on full corpus            │
│  These never change; they provide the initialization            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Tier 2A: Adaptive Bayesian Logistic Regression (ABLR)

**Core idea**: Maintain a posterior over weights for each context (e.g., each section/course offering).

**Mathematical formulation**:

```
Prior: w ~ N(0, Σ_train)  where Σ_train is from the pre-trained static model
Likelihood: y_i ~ Bernoulli(sigmoid(w^T x_i))
Posterior: w | D_section ~ N(μ_post, Σ_post)
```

Update rule (Laplace approximation, online):

```python
# At the start of semester: μ = w_static, Σ = λ * I  (conservative)
# After each assessment (TT1, quiz, etc.):
H = Σ^{-1} + Σ_i p_i(1-p_i) x_i x_i^T  # Hessian
μ_new = μ + Σ_new · Σ_i (y_i - p_i) x_i   # Newton step
```

**Why this solves the "balanced" seed problem**:

- The prior is centered at the static model weights
- If the section has few failures, the likelihood pulls the posterior toward lower-risk predictions
- The posterior variance increases when the section is small or noisy
- When posterior variance is high, Tier 3 suppresses display probability

**Implementation in AirMentor terms**:

```typescript
// New type in proof-risk-model.ts
export type BayesianHeadArtifact = {
  headKey: RiskHeadKey
  baseWeights: Record<ObservableFeatureKey, number>  // from static model
  baseIntercept: number
  // Per-context posterior parameters
  posteriorMean: Record<ObservableFeatureKey, number>  // deviations from base
  posteriorCovDiagonal: Record<ObservableFeatureKey, number>  // variances
  contextId: string  // e.g., "CSE202-Fall2026-SectionA"
  evidenceCount: number
  lastUpdatedAt: string
}
```

### 3.4 Tier 2B: Conformal Calibrator with Drift Detection

**Purpose**: Provide finite-sample calibration guarantees and detect when they break.

**Algorithm**:

1. For each new class/section, maintain a **calibration pool** of the first N students with known outcomes (or pseudo-outcomes from heuristics)
2. For each prediction, compute a **conformal prediction set** instead of a point probability
3. Track the **empirical coverage** over the calibration pool
4. If coverage drops below the nominal level (e.g., 90%), flag distribution shift

**For AirMentor specifically**:

- Stages provide natural calibration points. After TT1, we know which students struggled. After SEE, we know who failed.
- The conformal score can be `|y - p|`. The prediction set for a new student is all y values whose conformal score is below the quantile of calibration scores.
- If the calibration set's coverage is maintained, the model is well-calibrated for this context.

### 3.5 Tier 2C: Test-Time Training for Section Adaptation

**Purpose**: When a section is truly novel (e.g., new course, new instructor, new grading policy), use self-supervised adaptation.

**Self-supervised objective for AirMentor**:

Since we don't have labels at test time, we use the **temporal structure** of the data:

```
Given: student i at stage t (pre-TT1)
Predict: student i at stage t+1 (post-TT1)

Loss: L = MSE(f(x_i^{pre-TT1}), x_i^{post-TT1})
```

This forces the model to learn dynamics that are consistent with how students actually evolve. A few gradient steps on this objective adapt the model to the section's specific progression patterns.

### 3.6 Tier 3: Meta-Controller

The meta-controller decides, for each prediction:

1. **Which tier to use?**
   - Evidence sparse + no context history → Tier 1 (static) + high uncertainty
   - Evidence moderate + context has some history → Tier 2A (Bayesian update)
   - Outcome labels available → Tier 2B (conformal calibration)
   - Novel context detected → Tier 2C (TTT)

2. **Display probability allowed?**
   - If posterior variance > threshold OR conformal coverage < target → **suppress display**
   - This is the adaptive equivalent of `displayProbabilityAllowedForHead`

3. **Which threshold to use?**
   - Static thresholds (0.40/0.65) assume a fixed base rate
   - Adaptive thresholds: set by conformal calibration to maintain a fixed false positive rate (e.g., 10% of flagged students are false alarms)

---

## 4. Concrete Implementation Roadmap

### Phase 1: Uncertainty Quantification Foundation (Weeks 1-2)

**Goal**: Add uncertainty estimates to the current static model without changing the model architecture.

**Steps**:
1. Implement **Monte Carlo dropout** wrapper around the existing logistic model
   - During inference, randomly drop features with probability p
   - Run 50 forward passes, compute mean and variance of predictions
   - High variance = high uncertainty
2. Add `predictionUncertainty` field to `ModelBackedRiskOutput`
3. Update `displayProbabilityAllowedForHead` to suppress display when variance > 0.05
4. Run audit on seeds 20260320 and 101. Expect: seed 101 should now show suppressed probabilities rather than false Medium risk

**Why this is not a band-aid**: It doesn't patch the model's weights. It adds an honest uncertainty signal that prevents the model from making overconfident wrong predictions.

### Phase 2: Bayesian Online Update (Weeks 3-4)

**Goal**: Replace the static weight vector with a Bayesian posterior that updates per context.

**Steps**:
1. Define `BayesianHeadArtifact` type (see Section 3.3)
2. Implement `initializeBayesianPosterior(staticModel, contextId)`
3. Implement `updateBayesianPosterior(artifact, newEvidenceRows)` using Laplace approximation
4. Implement `scoreWithBayesianModel(artifact, featureVector)` → returns `{meanProb, variance}`
5. In `scoreObservableRiskWithModel`, when a `contextId` is provided and evidence is sufficient, use Bayesian scoring instead of static scoring
6. Persist Bayesian artifacts per context in the database (or JSON files keyed by `offering_id`)

**Validation**:
- Simulate two sections with different base rates
- Section A: 30% failure rate (high-forgetting-like)
- Section B: 5% failure rate (balanced-like)
- Static model should give similar predictions to both
- Bayesian model should adapt: Section A gets higher risk estimates, Section B gets lower

### Phase 3: Distribution Shift Detection (Weeks 5-6)

**Goal**: Automatically detect when a new context is outside the training distribution.

**Steps**:
1. Implement **feature distribution monitoring**:
   - For each feature, compute PSI between training corpus and current context
   - Aggregate into a single `driftScore`
2. Implement **prediction distribution monitoring**:
   - Track empirical positive rate in current context
   - Compare to expected positive rate from training
   - Flag `baseRateMismatch` if ratio > 2x
3. Implement **conformal coverage tracking**:
   - After each stage where outcomes are revealed (post-TT1, post-SEE), check if the model's confidence intervals covered the true outcomes at the promised rate
4. Expose drift metrics in model serving output

**Integration with Meta-Controller**:
```typescript
if (driftScore > 0.25 || baseRateMismatch || conformalCoverage < 0.80) {
  // Trigger adaptation or suppression
  useTier = 'bayesian-adapted'
  displayProbabilityAllowed = false
}
```

### Phase 4: Adaptive Thresholds (Weeks 7-8)

**Goal**: Replace fixed thresholds (0.40, 0.65) with context-calibrated thresholds.

**Current problem**: A threshold of 0.65 for "High" means "model thinks 65% chance of failure." But what if the true base rate in this section is only 3%? Then 0.65 is absurdly high, and no one gets flagged.

**Solution**: Conformal threshold calibration

```python
# Given calibration set of size N with true labels y and predictions p
# Find threshold tau such that:
#   P(y=1 | p >= tau) = target_precision  (e.g., 0.70)
#   AND
#   P(p >= tau | y=1) = target_recall    (e.g., 0.80)

# This is solved by binary search on tau using the calibration set
```

**For AirMentor**:
- After each semester, each course offering has a calibration set
- Compute adaptive `mediumThreshold` and `highThreshold` for that offering
- Store in `AdaptiveThresholdArtifact`
- Apply in `scoreObservableRiskWithModel` when `offeringId` is known

### Phase 5: EBM Backbone + Test-Time Training (Weeks 9-12)

**Goal**: Replace the linear logistic model with a more expressive but still interpretable model, and add TTT capability.

**EBM (Explainable Boosting Machine)**:
- Use `interpretml` Python package (or implement a lightweight version)
- Train EBM on the full corpus
- Each feature gets a shape function (learned via gradient boosting)
- Prediction = sigmoid(intercept + sum_i shape_i(feature_i))
- **Adaptation**: When drift is detected, re-fit only the shape functions for the drifted features, holding others fixed

**Test-Time Training**:
- Define a self-supervised objective using temporal student trajectories
- At inference time for a new section, run 10 gradient steps on the self-supervised loss using the first few weeks of data
- Use the adapted model for predictions in that section

---

## 5. Specific Fixes for the "Balanced" Seed Problem

Using the adaptive architecture, here's exactly how seed 101 would be handled:

### Without Adaptation (Current System)
```
Training corpus: mix of extreme scenarios (high-forgetting, chronic-absentee, etc.)
Seed 101 data: all students near mean ability, very few failures
Model: learned to expect ~15% failure rate from training
Prediction on seed 101: pushes everyone to ~0.46 to match expected base rate
Result: 100% Medium risk (0.46 >= 0.40)
```

### With Adaptive Bayesian Update
```
Step 1: Initialize posterior from static model (expecting ~15% failure rate)
Step 2: Observe first few students in seed 101
        - Attendance: all above 75%
        - TT1 scores: all reasonable
        - No historical backlogs
Step 3: Bayesian update pulls posterior toward lower-risk predictions
        - Posterior mean for "attendancePctScaled" weight becomes more negative
        - Posterior mean for "currentCgpaScaled" weight becomes more negative
Step 4: After observing ~30 students with no failures
        - Posterior predicts ~5% failure rate for this section
        - Most students: probability ~0.15 → Low risk
        - A few weak students: probability ~0.35 → still Low (below 0.40)
Result: ~10% Medium, ~2% High, ~88% Low — realistic for a well-performing class
```

### With Conformal Calibration
```
Calibration set: first 20 students from seed 101, with outcomes after SEE
Observed: only 1 failure out of 20 (5%)
Model predictions: [0.42, 0.44, 0.45, ..., 0.41] for these 20
True labels: [0, 0, 0, ..., 1]

Conformal score for 90% coverage:
  Find the 90th percentile of |y_i - p_i| over calibration set
  = 0.45 (since most y_i = 0, and p_i ≈ 0.45)

Prediction set for new student with p = 0.46:
  [0.46 - 0.45, 0.46 + 0.45] = [0.01, 0.91]
  This is very wide → high uncertainty

Meta-controller decision: suppress display probability, show heuristic band only
```

---

## 6. Research Gaps & Future Work

1. **Multi-task meta-learning**: Train a meta-learner (MAML-style) across many synthetic scenario families so it can adapt to a new scenario in <10 gradient steps
2. **Causal inference for interventions**: Current system treats intervention response as a feature. A causal model would estimate counterfactuals: "What would happen if we assigned a mentor to this student?"
3. **Fairness-aware adaptation**: When adapting to a new section, ensure the model does not over-correct in ways that disadvantage demographic subgroups
4. **Human-in-the-loop adaptation**: Teachers could rate prediction quality. These ratings become labels for online learning

---

## 7. Conclusion

The current AirMentor ML system is a well-engineered static pipeline with excellent calibration infrastructure, but it cannot adapt to the real world's inherent distribution diversity. The "balanced" seed failure is not a calibration problem — it is an **adaptation problem**.

The proposed AIR-ADAPT architecture adds three adaptive tiers on top of the existing static base:
1. **Bayesian online updates** for per-context adaptation
2. **Conformal calibration** for honest uncertainty and drift detection
3. **Test-time training** for truly novel contexts

This is a research-grade solution because:
- It has principled foundations in statistical learning theory
- It provides finite-sample guarantees (conformal)
- It quantifies uncertainty honestly (Bayesian)
- It degrades gracefully when uncertain (meta-controller)
- It maintains interpretability (EBM backbone, explainable updates)

**Next step**: Implement Phase 1 (Monte Carlo dropout uncertainty) as the minimum viable adaptive signal. This requires no model retraining, no data changes, and no serving contract changes — only a wrapper around existing inference.
