import { describe, expect, it } from 'vitest'
import {
  bootstrapAucCi,
  bootstrapBrierCi,
  bootstrapMetricCi,
  brierScoreFromArrays,
  permutationFeatureImportance,
  reliabilityDiagramData,
  rocAucFromArrays,
  type FeatureRow,
} from '../src/lib/proof-risk-evaluation-stats.js'

// =====================================================================
// Locked invariants for the validation-stats module.
// Closes roadmap §4 rows E12 (partial), E13, E14.
//
// (1) AUC: matches Mann-Whitney U closed-form on tiny labelled cases;
//     0.5 on degenerate input; bounded in [0,1].
// (2) Bootstrap CIs are deterministic with a fixed seed.
// (3) Bootstrap CI lower ≤ point estimate ≤ upper (loose inequality —
//     point can sit on the boundary at extreme inputs).
// (4) Bootstrap CI tightens as B grows for a real signal.
// (5) Permutation importance for an irrelevant feature ≈ 0.
// (6) Permutation importance for a load-bearing feature ≫ 0.
// (7) Reliability data: ECE ∈ [0,1]; MCE ≥ ECE; bin counts sum to N.
// =====================================================================

// Tiny synthetic dataset. The signal is in `feature_a`; `feature_b`
// is pure noise. Used by both bootstrap and permutation tests.
const TINY_FEATURES: ReadonlyArray<FeatureRow<'feature_a' | 'feature_b'>> = [
  { feature_a: 0.95, feature_b: 0.10 },
  { feature_a: 0.90, feature_b: 0.81 },
  { feature_a: 0.85, feature_b: 0.32 },
  { feature_a: 0.80, feature_b: 0.55 },
  { feature_a: 0.20, feature_b: 0.41 },
  { feature_a: 0.15, feature_b: 0.18 },
  { feature_a: 0.10, feature_b: 0.62 },
  { feature_a: 0.05, feature_b: 0.74 },
] as const
const TINY_LABELS = [1, 1, 1, 1, 0, 0, 0, 0] as const

// Score = feature_a (perfect ranking on TINY_FEATURES).
const PERFECT_SCORE_FN = (rows: ReadonlyArray<FeatureRow<'feature_a' | 'feature_b'>>) =>
  rows.map(row => row.feature_a)

describe('rocAucFromArrays', () => {
  it('returns 1.0 for perfectly separated probabilities', () => {
    const predicted = [0.9, 0.8, 0.2, 0.1]
    const actual = [1, 1, 0, 0]
    expect(rocAucFromArrays(predicted, actual)).toBe(1)
  })

  it('returns 0.0 for perfectly inverted probabilities', () => {
    const predicted = [0.9, 0.8, 0.2, 0.1]
    const actual = [0, 0, 1, 1]
    expect(rocAucFromArrays(predicted, actual)).toBe(0)
  })

  it('returns 0.5 when one class is empty', () => {
    expect(rocAucFromArrays([0.1, 0.2, 0.3], [1, 1, 1])).toBe(0.5)
    expect(rocAucFromArrays([0.1, 0.2, 0.3], [0, 0, 0])).toBe(0.5)
  })

  it('throws on length mismatch', () => {
    expect(() => rocAucFromArrays([0.1, 0.2], [1])).toThrow(/length mismatch/)
  })

  it('handles tied predictions deterministically', () => {
    // All tied → AUC = 0.5 by the rank-sum formula.
    const predicted = [0.5, 0.5, 0.5, 0.5]
    const actual = [1, 0, 1, 0]
    expect(rocAucFromArrays(predicted, actual)).toBe(0.5)
  })
})

describe('brierScoreFromArrays', () => {
  it('returns 0 for perfect predictions', () => {
    expect(brierScoreFromArrays([1, 0, 1, 0], [1, 0, 1, 0])).toBe(0)
  })

  it('returns 1 for perfectly wrong deterministic predictions', () => {
    expect(brierScoreFromArrays([0, 1, 0, 1], [1, 0, 1, 0])).toBe(1)
  })

  it('returns 0.25 for the no-information predictor', () => {
    // p̂ = 0.5 for every row, half the rows positive
    expect(brierScoreFromArrays([0.5, 0.5, 0.5, 0.5], [1, 0, 1, 0])).toBeCloseTo(0.25, 10)
  })
})

describe('bootstrapAucCi — determinism and shape', () => {
  it('is deterministic across reruns with the same seed', () => {
    const predicted = [0.9, 0.8, 0.7, 0.6, 0.4, 0.3, 0.2, 0.1]
    const actual = [1, 1, 1, 1, 0, 0, 0, 0]
    const a = bootstrapAucCi(predicted, actual, { B: 200, seed: 7 })
    const b = bootstrapAucCi(predicted, actual, { B: 200, seed: 7 })
    expect(a).toEqual(b)
  })

  it('produces different bootstrap means for different seeds (sanity check)', () => {
    // Use a noisy signal so resampling yields varying AUC; perfectly
    // separated inputs collapse every resample to AUC=1 and the seed
    // wouldn't matter.
    const predicted = [0.85, 0.62, 0.51, 0.66, 0.40, 0.55, 0.30, 0.45]
    const actual = [1, 1, 0, 1, 0, 1, 0, 0]
    const a = bootstrapAucCi(predicted, actual, { B: 200, seed: 7 })
    const b = bootstrapAucCi(predicted, actual, { B: 200, seed: 13 })
    expect(a.bootstrapMean).not.toEqual(b.bootstrapMean)
  })

  it('lower ≤ pointEstimate ≤ upper', () => {
    const predicted = [0.9, 0.8, 0.7, 0.6, 0.4, 0.3, 0.2, 0.1]
    const actual = [1, 1, 1, 1, 0, 0, 0, 0]
    const result = bootstrapAucCi(predicted, actual, { B: 500, seed: 42 })
    expect(result.pointEstimate).toBe(1)
    expect(result.lower).toBeLessThanOrEqual(result.pointEstimate)
    expect(result.upper).toBeGreaterThanOrEqual(result.pointEstimate)
  })

  it('records B, alpha, seed, bootstrapMean in the result', () => {
    const result = bootstrapAucCi([0.9, 0.1], [1, 0], { B: 50, alpha: 0.1, seed: 99 })
    expect(result.B).toBe(50)
    expect(result.alpha).toBe(0.1)
    expect(result.seed).toBe(99)
    expect(typeof result.bootstrapMean).toBe('number')
  })

  it('rejects invalid B and alpha', () => {
    expect(() => bootstrapAucCi([0.5], [1], { B: 0 })).toThrow(/B must be > 0/)
    expect(() => bootstrapAucCi([0.5], [1], { alpha: 0 })).toThrow(/alpha must be in/)
    expect(() => bootstrapAucCi([0.5], [1], { alpha: 1 })).toThrow(/alpha must be in/)
  })

  it('handles empty input gracefully', () => {
    const result = bootstrapAucCi([], [], { B: 5 })
    expect(result.pointEstimate).toBe(0.5)
    expect(result.lower).toBe(0.5)
    expect(result.upper).toBe(0.5)
  })
})

describe('bootstrapMetricCi — works for arbitrary metric', () => {
  it('Brier convenience wrapper agrees with explicit metric call', () => {
    const predicted = [0.9, 0.7, 0.3, 0.1]
    const actual = [1, 1, 0, 0]
    const wrapper = bootstrapBrierCi(predicted, actual, { B: 100, seed: 5 })
    const explicit = bootstrapMetricCi(brierScoreFromArrays, predicted, actual, { B: 100, seed: 5 })
    expect(wrapper).toEqual(explicit)
  })

  it('CI tightens as B grows on a stable signal', () => {
    const predicted = [0.95, 0.93, 0.91, 0.85, 0.80, 0.20, 0.18, 0.10, 0.07, 0.05]
    const actual = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]
    const small = bootstrapAucCi(predicted, actual, { B: 50, seed: 11 })
    const large = bootstrapAucCi(predicted, actual, { B: 1000, seed: 11 })
    const widthSmall = small.upper - small.lower
    const widthLarge = large.upper - large.lower
    // Larger B should not produce a tighter CI by *much*, but it should
    // produce a CI as tight as the small one, not wider.
    expect(widthLarge).toBeLessThanOrEqual(widthSmall + 1e-9)
  })
})

describe('permutationFeatureImportance — irrelevant vs load-bearing features', () => {
  it('load-bearing feature has positive delta; irrelevant feature ≈ 0', () => {
    const result = permutationFeatureImportance(
      TINY_FEATURES,
      TINY_LABELS,
      ['feature_a', 'feature_b'],
      PERFECT_SCORE_FN,
      rocAucFromArrays,
      { B: 30, seed: 17 },
    )
    expect(result.perFeature.feature_a.delta).toBeGreaterThan(0.2)
    // Irrelevant feature: shuffling doesn't change the score because
    // the score function ignores feature_b. Delta must be 0.
    expect(result.perFeature.feature_b.delta).toBe(0)
  })

  it('is deterministic across reruns with the same seed', () => {
    const a = permutationFeatureImportance(
      TINY_FEATURES,
      TINY_LABELS,
      ['feature_a'],
      PERFECT_SCORE_FN,
      rocAucFromArrays,
      { B: 20, seed: 17 },
    )
    const b = permutationFeatureImportance(
      TINY_FEATURES,
      TINY_LABELS,
      ['feature_a'],
      PERFECT_SCORE_FN,
      rocAucFromArrays,
      { B: 20, seed: 17 },
    )
    expect(a).toEqual(b)
  })

  it('returns one entry per requested feature key', () => {
    const result = permutationFeatureImportance(
      TINY_FEATURES,
      TINY_LABELS,
      ['feature_a', 'feature_b'],
      PERFECT_SCORE_FN,
      rocAucFromArrays,
      { B: 5, seed: 17 },
    )
    expect(Object.keys(result.perFeature).sort()).toEqual(['feature_a', 'feature_b'])
  })

  it('rejects invalid B', () => {
    expect(() => permutationFeatureImportance(
      TINY_FEATURES, TINY_LABELS, ['feature_a'], PERFECT_SCORE_FN, rocAucFromArrays, { B: 0 },
    )).toThrow(/B must be > 0/)
  })

  it('throws on length mismatch', () => {
    expect(() => permutationFeatureImportance(
      [{ feature_a: 1 }] as FeatureRow<'feature_a'>[],
      [1, 0],
      ['feature_a'],
      ((rows: ReadonlyArray<FeatureRow<'feature_a'>>) => rows.map(row => row.feature_a)),
      rocAucFromArrays,
    )).toThrow(/length mismatch/)
  })

  it('honours metricDirection=lower-is-better (Brier-style metric)', () => {
    const result = permutationFeatureImportance(
      TINY_FEATURES,
      TINY_LABELS,
      ['feature_a'],
      PERFECT_SCORE_FN,
      brierScoreFromArrays,
      { B: 30, seed: 17, metricDirection: 'lower-is-better' },
    )
    // Permuting the load-bearing feature increases Brier; with
    // lower-is-better, delta = permuted - baseline > 0.
    expect(result.perFeature.feature_a.delta).toBeGreaterThan(0)
  })
})

describe('reliabilityDiagramData', () => {
  it('ECE = 0 when predictions are perfectly calibrated against the empirical rate', () => {
    // 40 rows, p̂=0.25 on all of them, 10 positives → empirical 0.25 → ECE 0.
    const predicted = new Array<number>(40).fill(0.25)
    const actual = predicted.map((_, i) => (i < 10 ? 1 : 0))
    const result = reliabilityDiagramData(predicted, actual, { numBins: 10 })
    expect(result.expectedCalibrationError).toBeCloseTo(0, 10)
    expect(result.maxCalibrationError).toBeCloseTo(0, 10)
  })

  it('ECE > 0 when predictions diverge from empirical rate', () => {
    const predicted = new Array<number>(40).fill(0.9)
    const actual = predicted.map(() => 0)
    const result = reliabilityDiagramData(predicted, actual, { numBins: 10 })
    expect(result.expectedCalibrationError).toBeGreaterThan(0)
  })

  it('totalCount equals predicted.length and bin counts sum to it', () => {
    const predicted = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]
    const actual = [0, 0, 0, 1, 0, 1, 1, 1, 1, 1]
    const result = reliabilityDiagramData(predicted, actual, { numBins: 10 })
    expect(result.totalCount).toBe(predicted.length)
    const sum = result.bins.reduce((acc, bin) => acc + bin.count, 0)
    expect(sum).toBe(predicted.length)
  })

  it('MCE ≥ ECE on all populated inputs', () => {
    const predicted = [0.1, 0.2, 0.3, 0.7, 0.8, 0.9, 0.95]
    const actual = [0, 1, 0, 0, 1, 1, 1]
    const result = reliabilityDiagramData(predicted, actual, { numBins: 5 })
    expect(result.maxCalibrationError).toBeGreaterThanOrEqual(result.expectedCalibrationError)
  })

  it('rejects numBins ≤ 0', () => {
    expect(() => reliabilityDiagramData([0.5], [1], { numBins: 0 })).toThrow(/numBins must be > 0/)
  })

  it('throws on length mismatch', () => {
    expect(() => reliabilityDiagramData([0.5, 0.5], [1])).toThrow(/length mismatch/)
  })
})
