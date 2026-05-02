import { describe, expect, it } from 'vitest'
import {
  trainMajorityClassBaseline,
  trainTwoFeatureLogisticBaseline,
  type BaselineFeatureRow,
} from '../src/lib/proof-risk-baselines.js'
import { rocAucFromArrays } from '../src/lib/proof-risk-evaluation-stats.js'

// =====================================================================
// E9 closure — paper baselines.
//
// Locked invariants:
//  (1) majority-class returns the empirical positive rate for every row
//  (2) majority-class AUC is exactly 0.5 (no information)
//  (3) majority-class on empty labels returns the 0.5 fallback
//  (4) 2-feature logistic converges deterministically; AUC ≥ 0.9 on a
//      separable 2-feature signal
//  (5) 2-feature logistic predicts probabilities in (0, 1)
//  (6) Length-mismatch inputs raise
//  (7) Re-fit on the same data is reproducible (same weights)
// =====================================================================

describe('majority-class baseline', () => {
  it('returns the empirical positive rate of the train labels for every prediction row', () => {
    const labels = [1, 1, 0, 0, 0]
    const baseline = trainMajorityClassBaseline(labels)
    expect(baseline.empiricalPositiveRate).toBeCloseTo(0.4, 10)
    const predicted = baseline.predict([
      { attendancePct: 90, currentCgpa: 8 },
      { attendancePct: 50, currentCgpa: 4 },
    ])
    expect(predicted).toEqual([0.4, 0.4])
  })

  it('produces AUC = 0.5 (canonical no-information AUC)', () => {
    const labels = [1, 0, 1, 0, 1, 0, 1, 0]
    const baseline = trainMajorityClassBaseline(labels)
    const rows: BaselineFeatureRow[] = labels.map((_, i) => ({
      attendancePct: 80 + i, currentCgpa: 7,
    }))
    const predicted = baseline.predict(rows)
    expect(rocAucFromArrays(predicted, labels)).toBe(0.5)
  })

  it('falls back to 0.5 on empty training labels', () => {
    const baseline = trainMajorityClassBaseline([])
    expect(baseline.empiricalPositiveRate).toBe(0.5)
    expect(baseline.trainSize).toBe(0)
    const predicted = baseline.predict([{ attendancePct: 88, currentCgpa: 7 }])
    expect(predicted).toEqual([0.5])
  })

  it('reports trainSize and positiveCount', () => {
    const baseline = trainMajorityClassBaseline([1, 1, 1, 0, 0])
    expect(baseline.trainSize).toBe(5)
    expect(baseline.positiveCount).toBe(3)
  })
})

describe('two-feature logistic baseline', () => {
  // Synthetic signal: low attendance + low CGPA → positive (at-risk).
  const TRAIN_ROWS: ReadonlyArray<BaselineFeatureRow> = [
    { attendancePct: 92, currentCgpa: 9.0 },
    { attendancePct: 88, currentCgpa: 8.5 },
    { attendancePct: 85, currentCgpa: 8.0 },
    { attendancePct: 80, currentCgpa: 7.5 },
    { attendancePct: 78, currentCgpa: 7.0 },
    { attendancePct: 70, currentCgpa: 6.5 },
    { attendancePct: 65, currentCgpa: 6.0 },
    { attendancePct: 60, currentCgpa: 5.5 },
    { attendancePct: 55, currentCgpa: 5.0 },
    { attendancePct: 50, currentCgpa: 4.5 },
    { attendancePct: 45, currentCgpa: 4.0 },
    { attendancePct: 40, currentCgpa: 3.5 },
  ] as const
  const TRAIN_LABELS = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1] as const

  it('converges deterministically on the synthetic signal', () => {
    const baseline = trainTwoFeatureLogisticBaseline(TRAIN_ROWS, TRAIN_LABELS)
    expect(baseline.converged).toBe(true)
    expect(baseline.iterations).toBeGreaterThan(0)
    expect(baseline.iterations).toBeLessThanOrEqual(50)
  })

  it('produces AUC >= 0.9 on the train set (sanity check, not held-out)', () => {
    const baseline = trainTwoFeatureLogisticBaseline(TRAIN_ROWS, TRAIN_LABELS)
    const predicted = baseline.predict(TRAIN_ROWS)
    const auc = rocAucFromArrays(predicted, TRAIN_LABELS)
    expect(auc).toBeGreaterThanOrEqual(0.9)
  })

  it('every predicted probability is strictly inside (0, 1)', () => {
    const baseline = trainTwoFeatureLogisticBaseline(TRAIN_ROWS, TRAIN_LABELS)
    const predicted = baseline.predict(TRAIN_ROWS)
    for (const p of predicted) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('weights are reproducible across reruns', () => {
    const a = trainTwoFeatureLogisticBaseline(TRAIN_ROWS, TRAIN_LABELS)
    const b = trainTwoFeatureLogisticBaseline(TRAIN_ROWS, TRAIN_LABELS)
    expect(a.weights).toEqual(b.weights)
    expect(a.iterations).toEqual(b.iterations)
  })

  it('rejects mismatched rows/labels lengths', () => {
    expect(() => trainTwoFeatureLogisticBaseline(
      TRAIN_ROWS,
      TRAIN_LABELS.slice(0, 5),
    )).toThrow(/length mismatch/)
  })

  it('falls back gracefully on empty training set', () => {
    const baseline = trainTwoFeatureLogisticBaseline([], [])
    const predicted = baseline.predict([{ attendancePct: 88, currentCgpa: 7 }])
    expect(predicted).toEqual([0.5])
    expect(baseline.iterations).toBe(0)
  })

  it('intercept-only on constant features still yields valid probabilities', () => {
    const constantRows: BaselineFeatureRow[] = Array.from({ length: 6 }, () => ({ attendancePct: 80, currentCgpa: 7 }))
    const labels = [1, 1, 1, 0, 0, 0]
    const baseline = trainTwoFeatureLogisticBaseline(constantRows, labels)
    const predicted = baseline.predict(constantRows)
    for (const p of predicted) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    }
  })
})
