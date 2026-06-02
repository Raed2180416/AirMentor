import { describe, expect, it } from 'vitest'
import {
  ASSIGNMENT_WEAK_IMPACT,
  ATTENDANCE_HIGH_RISK_IMPACT,
  ATTENDANCE_MEDIUM_RISK_IMPACT,
  ATTENDANCE_TREND_IMPACT,
  BACKLOG_HIGH_RISK_IMPACT,
  BACKLOG_MEDIUM_RISK_IMPACT,
  BLOOM_LEVEL_MASTERY_TARGET,
  CGPA_HIGH_RISK_IMPACT,
  CGPA_MEDIUM_RISK_IMPACT,
  CONSTANTS_SOURCE_CLASS_SUMMARY,
  INFERENCE_BASELINE_RISK,
  INFERENCE_RISK_LOWER_CLAMP,
  INFERENCE_RISK_UPPER_CLAMP,
  INTERVENTION_NEGATIVE_RESPONSE_IMPACT,
  INTERVENTION_NEGATIVE_RESPONSE_THRESHOLD,
  INTERVENTION_POSITIVE_RESPONSE_IMPACT,
  INTERVENTION_POSITIVE_RESPONSE_THRESHOLD,
  MASTERY_WEAKNESS_RATIO,
  PREREQUISITE_EDGE_DEFAULT_WEIGHT,
  QUESTION_WEAKNESS_HIGH_IMPACT,
  QUESTION_WEAKNESS_MEDIUM_IMPACT,
  QUIZ_WEAK_IMPACT,
  RISK_BAND_HIGH_THRESHOLD,
  RISK_BAND_MEDIUM_THRESHOLD,
  SCENARIO_FINGERPRINTS,
  TERM_SIGNAL_VERY_LOW_IMPACT,
  TERM_SIGNAL_WATCH_IMPACT,
  WEAK_CO_HIGH_IMPACT,
  WEAK_CO_MEDIUM_IMPACT,
  type ScenarioFamily,
} from '../src/lib/learning-dynamics-constants.js'

// =====================================================================
// Invariants protected by these tests are the contract referenced in
// air-mentor-api/src/lib/learning-dynamics-constants.ts.
// They guarantee:
//   (1) every impact stays in a literature-plausible bounded range,
//   (2) every "high" impact dominates its "medium" pair,
//   (3) Bloom-level mastery targets monotonically increase,
//   (4) band thresholds stay ordered and inside [0, 1],
//   (5) clamps are inside [0, 1] and below/above the band thresholds,
//   (6) attendance dominates other drivers (Credé meta-analysis claim),
//   (7) scenario fingerprints carry one load-bearing axis except `balanced`.
// =====================================================================

describe('learning-dynamics-constants — impact magnitudes are bounded', () => {
  const impacts: Array<{ name: string; value: number }> = [
    { name: 'ATTENDANCE_HIGH_RISK_IMPACT', value: ATTENDANCE_HIGH_RISK_IMPACT },
    { name: 'ATTENDANCE_MEDIUM_RISK_IMPACT', value: ATTENDANCE_MEDIUM_RISK_IMPACT },
    { name: 'CGPA_HIGH_RISK_IMPACT', value: CGPA_HIGH_RISK_IMPACT },
    { name: 'CGPA_MEDIUM_RISK_IMPACT', value: CGPA_MEDIUM_RISK_IMPACT },
    { name: 'BACKLOG_HIGH_RISK_IMPACT', value: BACKLOG_HIGH_RISK_IMPACT },
    { name: 'BACKLOG_MEDIUM_RISK_IMPACT', value: BACKLOG_MEDIUM_RISK_IMPACT },
    { name: 'TERM_SIGNAL_VERY_LOW_IMPACT', value: TERM_SIGNAL_VERY_LOW_IMPACT },
    { name: 'TERM_SIGNAL_WATCH_IMPACT', value: TERM_SIGNAL_WATCH_IMPACT },
    { name: 'ATTENDANCE_TREND_IMPACT', value: ATTENDANCE_TREND_IMPACT },
    { name: 'QUESTION_WEAKNESS_HIGH_IMPACT', value: QUESTION_WEAKNESS_HIGH_IMPACT },
    { name: 'QUESTION_WEAKNESS_MEDIUM_IMPACT', value: QUESTION_WEAKNESS_MEDIUM_IMPACT },
    { name: 'QUIZ_WEAK_IMPACT', value: QUIZ_WEAK_IMPACT },
    { name: 'ASSIGNMENT_WEAK_IMPACT', value: ASSIGNMENT_WEAK_IMPACT },
    { name: 'WEAK_CO_HIGH_IMPACT', value: WEAK_CO_HIGH_IMPACT },
    { name: 'WEAK_CO_MEDIUM_IMPACT', value: WEAK_CO_MEDIUM_IMPACT },
    { name: 'INTERVENTION_NEGATIVE_RESPONSE_IMPACT', value: INTERVENTION_NEGATIVE_RESPONSE_IMPACT },
    { name: 'INTERVENTION_POSITIVE_RESPONSE_IMPACT', value: INTERVENTION_POSITIVE_RESPONSE_IMPACT },
  ]

  it.each(impacts)('$name lies inside [-0.30, 0.30]', ({ value }) => {
    expect(value).toBeGreaterThanOrEqual(-0.30)
    expect(value).toBeLessThanOrEqual(0.30)
  })
})

describe('learning-dynamics-constants — high impacts dominate medium pairs', () => {
  const pairs: Array<{ pair: string; high: number; medium: number }> = [
    { pair: 'attendance', high: ATTENDANCE_HIGH_RISK_IMPACT, medium: ATTENDANCE_MEDIUM_RISK_IMPACT },
    { pair: 'cgpa', high: CGPA_HIGH_RISK_IMPACT, medium: CGPA_MEDIUM_RISK_IMPACT },
    { pair: 'backlog', high: BACKLOG_HIGH_RISK_IMPACT, medium: BACKLOG_MEDIUM_RISK_IMPACT },
    { pair: 'term-signal', high: TERM_SIGNAL_VERY_LOW_IMPACT, medium: TERM_SIGNAL_WATCH_IMPACT },
    { pair: 'question-weakness', high: QUESTION_WEAKNESS_HIGH_IMPACT, medium: QUESTION_WEAKNESS_MEDIUM_IMPACT },
    { pair: 'weak-co', high: WEAK_CO_HIGH_IMPACT, medium: WEAK_CO_MEDIUM_IMPACT },
  ]

  it.each(pairs)('$pair high > medium', ({ high, medium }) => {
    expect(high).toBeGreaterThan(medium)
  })
})

describe('learning-dynamics-constants — band thresholds ordered + inside [0,1]', () => {
  it('LOWER_CLAMP < MEDIUM_THRESHOLD < HIGH_THRESHOLD < UPPER_CLAMP', () => {
    expect(INFERENCE_RISK_LOWER_CLAMP).toBeLessThan(RISK_BAND_MEDIUM_THRESHOLD)
    expect(RISK_BAND_MEDIUM_THRESHOLD).toBeLessThan(RISK_BAND_HIGH_THRESHOLD)
    expect(RISK_BAND_HIGH_THRESHOLD).toBeLessThan(INFERENCE_RISK_UPPER_CLAMP)
  })

  it('all clamps and thresholds inside [0, 1]', () => {
    for (const value of [
      INFERENCE_RISK_LOWER_CLAMP,
      INFERENCE_BASELINE_RISK,
      RISK_BAND_MEDIUM_THRESHOLD,
      RISK_BAND_HIGH_THRESHOLD,
      INFERENCE_RISK_UPPER_CLAMP,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('positive intervention threshold is positive, negative threshold is negative', () => {
    expect(INTERVENTION_POSITIVE_RESPONSE_THRESHOLD).toBeGreaterThan(0)
    expect(INTERVENTION_NEGATIVE_RESPONSE_THRESHOLD).toBeLessThan(0)
  })
})

describe('learning-dynamics-constants — attendance is the dominant single driver', () => {
  // Credé et al. (2010) ρ=0.44 attendance-grade is the strongest known
  // predictor of college performance. The heuristic must reflect this:
  // ATTENDANCE_HIGH_RISK_IMPACT must be the largest of the
  // single-signal impact constants (excluding compounding multi-signal
  // bands like multiple-CO weakness, which are by construction smaller
  // than attendance high-risk).
  it('ATTENDANCE_HIGH_RISK_IMPACT >= every other positive impact', () => {
    const others = [
      CGPA_HIGH_RISK_IMPACT,
      BACKLOG_HIGH_RISK_IMPACT,
      TERM_SIGNAL_VERY_LOW_IMPACT,
      ATTENDANCE_TREND_IMPACT,
      QUESTION_WEAKNESS_HIGH_IMPACT,
      QUIZ_WEAK_IMPACT,
      ASSIGNMENT_WEAK_IMPACT,
      WEAK_CO_HIGH_IMPACT,
      INTERVENTION_NEGATIVE_RESPONSE_IMPACT,
    ]
    for (const value of others) {
      expect(ATTENDANCE_HIGH_RISK_IMPACT).toBeGreaterThanOrEqual(value)
    }
  })
})

describe('learning-dynamics-constants — Bloom mastery targets monotone increasing', () => {
  it('remember <= understand < apply < analyze < evaluate < create', () => {
    const ladder = [
      BLOOM_LEVEL_MASTERY_TARGET.remember,
      BLOOM_LEVEL_MASTERY_TARGET.understand,
      BLOOM_LEVEL_MASTERY_TARGET.apply,
      BLOOM_LEVEL_MASTERY_TARGET.analyze,
      BLOOM_LEVEL_MASTERY_TARGET.evaluate,
      BLOOM_LEVEL_MASTERY_TARGET.create,
    ]
    expect(BLOOM_LEVEL_MASTERY_TARGET.remember).toBeLessThanOrEqual(BLOOM_LEVEL_MASTERY_TARGET.understand)
    for (let i = 1; i < ladder.length - 1; i += 1) {
      const left = ladder[i] as number
      const right = ladder[i + 1] as number
      expect(left).toBeLessThan(right)
    }
    for (const target of ladder) {
      expect(target).toBeGreaterThanOrEqual(0)
      expect(target).toBeLessThanOrEqual(1)
    }
  })
})

describe('learning-dynamics-constants — mastery-weakness ratio + edge weights sane', () => {
  it('MASTERY_WEAKNESS_RATIO is inside (0, 1)', () => {
    expect(MASTERY_WEAKNESS_RATIO).toBeGreaterThan(0)
    expect(MASTERY_WEAKNESS_RATIO).toBeLessThan(1)
  })

  it('explicit edge weight strictly greater than added edge weight', () => {
    expect(PREREQUISITE_EDGE_DEFAULT_WEIGHT.explicit).toBeGreaterThan(PREREQUISITE_EDGE_DEFAULT_WEIGHT.added)
    expect(PREREQUISITE_EDGE_DEFAULT_WEIGHT.explicit).toBeLessThanOrEqual(1)
    expect(PREREQUISITE_EDGE_DEFAULT_WEIGHT.added).toBeGreaterThan(0)
  })
})

describe('learning-dynamics-constants — scenario fingerprints have load-bearing axes', () => {
  // Each non-balanced family must have at least one dimension with
  // |shift| >= 0.05 — that is the family's documented load-bearing axis
  // (paper-evidence/scenario-grounding.md). The `balanced` family is
  // the deliberate null/control and must be all zeros.
  const expectations: Record<ScenarioFamily, { kind: 'load-bearing' | 'null' }> = {
    'weak-foundation': { kind: 'load-bearing' },
    'low-attendance': { kind: 'load-bearing' },
    'high-forgetting': { kind: 'load-bearing' },
    'coursework-inflation': { kind: 'load-bearing' },
    'exam-fragility': { kind: 'load-bearing' },
    'carryover-heavy': { kind: 'load-bearing' },
    'intervention-resistant': { kind: 'load-bearing' },
    'chronic-absentee': { kind: 'load-bearing' },
    'attendance-shock': { kind: 'load-bearing' },
    'mental-health-disruption': { kind: 'load-bearing' },
    balanced: { kind: 'null' },
  }

  for (const [family, expectation] of Object.entries(expectations) as Array<
    [ScenarioFamily, { kind: 'load-bearing' | 'null' }]
  >) {
    it(`${family} fingerprint matches its expected ${expectation.kind} shape`, () => {
      const fingerprint = SCENARIO_FINGERPRINTS[family]
      const magnitudes = Object.values(fingerprint).map(Math.abs)
      const max = Math.max(...magnitudes)
      if (expectation.kind === 'load-bearing') {
        expect(max).toBeGreaterThanOrEqual(0.05)
      } else {
        expect(max).toBe(0)
      }
    })
  }
})

describe('learning-dynamics-constants — fingerprint values lie inside [-0.15, 0.15]', () => {
  it.each(Object.entries(SCENARIO_FINGERPRINTS))('%s', (_family, fingerprint) => {
    for (const value of Object.values(fingerprint)) {
      expect(value).toBeGreaterThanOrEqual(-0.15)
      expect(value).toBeLessThanOrEqual(0.15)
    }
  })
})

describe('learning-dynamics-constants — disclosure summary is internally consistent', () => {
  it('source-class counts sum to total', () => {
    const { total, literature, institutional, engineering } = CONSTANTS_SOURCE_CLASS_SUMMARY
    expect(literature + institutional + engineering).toBe(total)
  })
})
