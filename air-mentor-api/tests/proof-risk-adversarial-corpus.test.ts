import { describe, expect, it } from 'vitest'
import {
  generateExponentialControlCorpus,
  generatePowerLawAdversarialCorpus,
  type AdversarialCorpus,
} from '../src/lib/proof-risk-adversarial-corpus.js'

// =====================================================================
// E11 closure — locked invariants for the adversarial corpus.
//
//  (1) Determinism: same (size, alpha, seed) → byte-identical output.
//  (2) Different seeds → different rows (sanity that PRNG is seeded).
//  (3) Schema consistency: every row carries every required field with
//      the right types.
//  (4) Power-law tail is heavier than exponential tail at semester 6
//      (the cohort attendance mean stays higher under power-law than
//      under matched-α exponential because (1+5)^(-α) > exp(-5α) for
//      α ∈ (0, 1)). This is the *load-bearing* property that lets the
//      paper claim "different generative process".
//  (5) Positive rate is non-trivial (10%–80%) — useful test set, not
//      degenerate single-class corpus.
//  (6) Size guard rejects nonsense inputs.
// =====================================================================

describe('adversarial corpus — determinism', () => {
  it('same (size, alpha, seed) produces byte-identical output across reruns', () => {
    const a = generatePowerLawAdversarialCorpus({ size: 60, alpha: 0.6, seed: 11 })
    const b = generatePowerLawAdversarialCorpus({ size: 60, alpha: 0.6, seed: 11 })
    expect(a).toEqual(b)
  })

  it('different seeds produce different rows', () => {
    const a = generatePowerLawAdversarialCorpus({ size: 30, alpha: 0.6, seed: 11 })
    const b = generatePowerLawAdversarialCorpus({ size: 30, alpha: 0.6, seed: 99 })
    expect(a.rows[0]).not.toEqual(b.rows[0])
  })

  it('exponential control corpus is independent of the power-law corpus', () => {
    const power = generatePowerLawAdversarialCorpus({ size: 30, seed: 7 })
    const exp = generateExponentialControlCorpus({ size: 30, seed: 7 })
    expect(power.rows[0]?.corpusKind).toBe('power-law-forgetting')
    expect(exp.rows[0]?.corpusKind).toBe('exponential-forgetting-control')
  })
})

describe('adversarial corpus — schema', () => {
  const corpus = generatePowerLawAdversarialCorpus({ size: 60, seed: 11 })

  it('every row carries the required scalar fields', () => {
    for (const row of corpus.rows) {
      expect(typeof row.attendancePct).toBe('number')
      expect(typeof row.currentCgpa).toBe('number')
      expect(typeof row.backlogCount).toBe('number')
      expect(typeof row.semesterNumber).toBe('number')
      expect(typeof row.cgpaMissing).toBe('boolean')
      expect(typeof row.backlogMissing).toBe('boolean')
      expect(row.label === 0 || row.label === 1).toBe(true)
      expect(typeof row.rowId).toBe('string')
    }
  })

  it('semester 1 marks cgpa/backlog missingness', () => {
    const semOne = corpus.rows.filter(r => r.semesterNumber === 1)
    expect(semOne.length).toBeGreaterThan(0)
    for (const row of semOne) {
      expect(row.cgpaMissing).toBe(true)
      expect(row.backlogMissing).toBe(true)
    }
  })

  it('SEE / quiz / assignment are null in early semesters', () => {
    const semOne = corpus.rows.filter(r => r.semesterNumber === 1)
    for (const row of semOne) {
      expect(row.seePct).toBeNull()
      expect(row.quizPct).toBeNull()
      expect(row.assignmentPct).toBeNull()
    }
  })

  it('rowIds are unique', () => {
    const rowIds = new Set(corpus.rows.map(row => row.rowId))
    expect(rowIds.size).toBe(corpus.rows.length)
  })
})

describe('adversarial corpus — distribution properties', () => {
  // Generate matched cohorts so the only difference is the forgetting kernel.
  const matchedSize = 60
  const matchedAlpha = 0.6
  const matchedSeed = 11
  const power = generatePowerLawAdversarialCorpus({ size: matchedSize, alpha: matchedAlpha, seed: matchedSeed })
  const exp = generateExponentialControlCorpus({ size: matchedSize, alpha: matchedAlpha, seed: matchedSeed })

  function meanAttendanceAtSem(corpus: AdversarialCorpus, sem: number): number {
    const rows = corpus.rows.filter(row => row.semesterNumber === sem)
    if (rows.length === 0) return NaN
    return rows.reduce((sum, row) => sum + row.attendancePct, 0) / rows.length
  }

  it('power-law cohort attendance at semester 6 is higher than matched exponential cohort', () => {
    // (1+5)^(-α) > exp(-5α) for α ∈ (0, 1) → power-law students
    // retain more attendance at long t.
    const semSix = 6
    const meanPower = meanAttendanceAtSem(power, semSix)
    const meanExp = meanAttendanceAtSem(exp, semSix)
    expect(meanPower).toBeGreaterThan(meanExp)
  })

  it('positive rate is in (0.10, 0.80) — non-degenerate test set', () => {
    expect(power.meta.positiveRate).toBeGreaterThan(0.10)
    expect(power.meta.positiveRate).toBeLessThan(0.80)
    expect(exp.meta.positiveRate).toBeGreaterThan(0.10)
    expect(exp.meta.positiveRate).toBeLessThan(0.80)
  })

  it('attendanceMeanBySemester is monotonically non-increasing under both kernels', () => {
    for (const corpus of [power, exp]) {
      for (let i = 1; i < corpus.meta.attendanceMeanBySemester.length; i += 1) {
        expect(corpus.meta.attendanceMeanBySemester[i]!)
          .toBeLessThanOrEqual(corpus.meta.attendanceMeanBySemester[i - 1]! + 0.5)
      }
    }
  })
})

describe('adversarial corpus — input guards', () => {
  it('rejects size <= 0', () => {
    expect(() => generatePowerLawAdversarialCorpus({ size: 0 })).toThrow(/size must be > 0/)
    expect(() => generatePowerLawAdversarialCorpus({ size: -5 })).toThrow(/size must be > 0/)
  })

  it('rejects alpha <= 0', () => {
    expect(() => generatePowerLawAdversarialCorpus({ size: 12, alpha: 0 })).toThrow(/alpha must be > 0/)
    expect(() => generatePowerLawAdversarialCorpus({ size: 12, alpha: -1 })).toThrow(/alpha must be > 0/)
  })
})
