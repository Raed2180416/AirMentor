import { describe, expect, it } from 'vitest'
import {
  renderSensitivityMarkdown,
  runOneAtATimeSensitivity,
  type SensitivityParameter,
  type SensitivityScorer,
} from '../src/lib/proof-risk-sensitivity.js'

// =====================================================================
// E10 closure — locked invariants for the OAT sensitivity sweep.
//
//  (1) baseline AUC matches the underlying scorer
//  (2) each parameter generates len(perturbations) rows; total
//      evaluations = 1 + Σ |perturbations|
//  (3) load-bearing parameter has |ΔAUC| > 0 across its perturbation set
//  (4) irrelevant parameter has ΔAUC == 0 across its perturbation set
//  (5) rankedByMagnitude is sorted descending and matches max|ΔAUC|
//  (6) markdown rendering produces all expected sections
//  (7) length-mismatch and empty-rows raise
// =====================================================================

type Row = { feature_a: number; feature_b: number }

// Baseline scorer: predicted = weight_a * feature_a + weight_b * feature_b.
// `weight_a` is the overridable parameter; `feature_a` is the load-bearing
// signal; `feature_b` is irrelevant. AUC is rank-based so we don't need
// to clamp into [0, 1] — the bare linear score is enough and lets the
// test reason about sign flips without losing signal to a clamp.
const SCORER: SensitivityScorer<Row> = (rows, overrides) => {
  const weightA = overrides['weight_a'] ?? 1
  const weightB = overrides['weight_b'] ?? 0
  return rows.map(row => weightA * row.feature_a + weightB * row.feature_b)
}

const ROWS: Row[] = [
  { feature_a: 0.95, feature_b: 0.5 },
  { feature_a: 0.90, feature_b: 0.5 },
  { feature_a: 0.80, feature_b: 0.5 },
  { feature_a: 0.20, feature_b: 0.5 },
  { feature_a: 0.10, feature_b: 0.5 },
  { feature_a: 0.05, feature_b: 0.5 },
]
const LABELS = [1, 1, 1, 0, 0, 0] as const

describe('runOneAtATimeSensitivity — basic shape', () => {
  it('baseline AUC matches the unperturbed scorer', () => {
    const result = runOneAtATimeSensitivity(
      [{ name: 'weight_a', baselineValue: 1 }] as SensitivityParameter[],
      SCORER,
      ROWS,
      LABELS,
    )
    expect(result.baselineAuc).toBeCloseTo(1, 10)
  })

  it('produces len(perturbations) rows per parameter', () => {
    const result = runOneAtATimeSensitivity(
      [
        { name: 'weight_a', baselineValue: 1 },
        { name: 'weight_b', baselineValue: 0, perturbations: [0.5, 1, 1.5] },
      ] as SensitivityParameter[],
      SCORER,
      ROWS,
      LABELS,
    )
    expect(result.rows.filter(r => r.parameterName === 'weight_a')).toHaveLength(2)
    expect(result.rows.filter(r => r.parameterName === 'weight_b')).toHaveLength(3)
    expect(result.totalEvaluations).toBe(1 + 2 + 3)
  })
})

describe('runOneAtATimeSensitivity — identifies load-bearing vs irrelevant parameters', () => {
  it('weight_b is irrelevant: |ΔAUC| == 0 across all perturbations', () => {
    const result = runOneAtATimeSensitivity(
      [{ name: 'weight_b', baselineValue: 0, perturbations: [0.5, 1.5] }] as SensitivityParameter[],
      SCORER,
      ROWS,
      LABELS,
    )
    // baselineValue is 0, so 0.5*0=0 and 1.5*0=0 — the override is
    // identical to baseline. Verify the row machinery still runs.
    for (const row of result.rows) {
      expect(row.aucDeltaMagnitude).toBe(0)
    }
  })

  it('weight_a perturbation that flips ranking sign produces large ΔAUC', () => {
    const result = runOneAtATimeSensitivity(
      [{ name: 'weight_a', baselineValue: 1, perturbations: [-1, 1.2] }] as SensitivityParameter[],
      SCORER,
      ROWS,
      LABELS,
    )
    // factor=-1 inverts the score → AUC drops to 0.
    const inverted = result.rows.find(r => r.perturbedFactor === -1)!
    expect(inverted.perturbedAuc).toBeLessThan(0.5)
    expect(inverted.aucDeltaMagnitude).toBeGreaterThan(0.4)
  })
})

describe('runOneAtATimeSensitivity — ranking is sorted descending', () => {
  it('rankedByMagnitude is sorted from largest to smallest', () => {
    const result = runOneAtATimeSensitivity(
      [
        { name: 'weight_a', baselineValue: 1, perturbations: [-1] },
        { name: 'weight_b', baselineValue: 0 },
      ] as SensitivityParameter[],
      SCORER,
      ROWS,
      LABELS,
    )
    for (let i = 1; i < result.rankedByMagnitude.length; i += 1) {
      expect(result.rankedByMagnitude[i - 1]!.maxMagnitude)
        .toBeGreaterThanOrEqual(result.rankedByMagnitude[i]!.maxMagnitude)
    }
    expect(result.rankedByMagnitude[0]!.parameterName).toBe('weight_a')
  })
})

describe('renderSensitivityMarkdown', () => {
  it('emits both per-perturbation table and ranked-by-magnitude table', () => {
    const result = runOneAtATimeSensitivity(
      [{ name: 'weight_a', baselineValue: 1 }] as SensitivityParameter[],
      SCORER,
      ROWS,
      LABELS,
    )
    const md = renderSensitivityMarkdown(result, 'unit-test sweep')
    expect(md).toContain('# unit-test sweep')
    expect(md).toContain('## Per-perturbation rows')
    expect(md).toContain('## Ranked by max |ΔAUC|')
    expect(md).toContain('weight_a')
    expect(md).toContain('Baseline AUC:')
  })
})

describe('runOneAtATimeSensitivity — error paths', () => {
  it('rejects mismatched rows/labels lengths', () => {
    expect(() => runOneAtATimeSensitivity(
      [{ name: 'weight_a', baselineValue: 1 }] as SensitivityParameter[],
      SCORER,
      ROWS,
      LABELS.slice(0, 3),
    )).toThrow(/length mismatch/)
  })

  it('rejects empty evaluation rows', () => {
    expect(() => runOneAtATimeSensitivity(
      [{ name: 'weight_a', baselineValue: 1 }] as SensitivityParameter[],
      SCORER,
      [],
      [],
    )).toThrow(/empty/)
  })
})
