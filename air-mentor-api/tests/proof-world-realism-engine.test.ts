import { describe, expect, it } from 'vitest'
import {
  ASSESSMENT_BOUNDS,
  ASSESSMENT_RESPONSIVENESS,
  applyAnchorDecay,
  applyForgetDecay,
  betaIncomplete,
  betaQuantile,
  computeMarkDelta,
  realizeAssessmentMark,
  stableAnchoredBeta,
  stableGaussian,
  stableTruncatedNormal,
} from '../src/lib/proof-world-realism-engine.js'
import type {
  StudentLatentProfileForIntervention,
} from '../src/lib/proof-intervention-response-types.js'

function makeProfile(overrides: Partial<{
  forgetRate: number
  relearnRate: number
  studyGainRate: number
  consistency: number
  volatility: number
  recoveryTendency: number
  relapseTendency: number
  practiceCompliance: number
  helpSeekingTendency: number
  examPressure: number
  interventionReceptivity: number
  temporaryUpliftCredit: number
  expectedRecoveryThreshold: number
}> = {}): StudentLatentProfileForIntervention {
  return {
    dynamics: {
      forgetRate: overrides.forgetRate ?? 0.1,
      relearnRate: overrides.relearnRate ?? 0.55,
      studyGainRate: overrides.studyGainRate ?? 0.5,
      consistency: overrides.consistency ?? 0.6,
      volatility: overrides.volatility ?? 0.2,
      recoveryTendency: overrides.recoveryTendency ?? 0.5,
      relapseTendency: overrides.relapseTendency ?? 0.2,
    },
    behavior: {
      practiceCompliance: overrides.practiceCompliance ?? 0.55,
      helpSeekingTendency: overrides.helpSeekingTendency ?? 0.4,
      examPressure: overrides.examPressure ?? 0.35,
    },
    intervention: {
      interventionReceptivity: overrides.interventionReceptivity ?? 0.6,
      temporaryUpliftCredit: overrides.temporaryUpliftCredit ?? 0.1,
      expectedRecoveryThreshold: overrides.expectedRecoveryThreshold ?? 0.12,
    },
  }
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdev(values: number[]): number {
  const m = mean(values)
  const variance = mean(values.map(v => (v - m) ** 2))
  return Math.sqrt(variance)
}

describe('world-realism-engine · stableGaussian + stableTruncatedNormal', () => {
  it('stableGaussian is deterministic for the same seed', () => {
    const a = stableGaussian('fixed-seed', 50, 8)
    const b = stableGaussian('fixed-seed', 50, 8)
    expect(a).toBe(b)
  })

  it('stableGaussian over many seeds approximates mean and stdev analytically', () => {
    const draws: number[] = []
    for (let i = 0; i < 3000; i++) draws.push(stableGaussian(`seed-${i}`, 60, 10))
    expect(mean(draws)).toBeGreaterThan(58)
    expect(mean(draws)).toBeLessThan(62)
    expect(stdev(draws)).toBeGreaterThan(9)
    expect(stdev(draws)).toBeLessThan(11)
  })

  it('stableTruncatedNormal always returns within [min, max]', () => {
    for (let i = 0; i < 500; i++) {
      const v = stableTruncatedNormal({
        seed: `trunc-${i}`,
        mean: 50,
        stdev: 20,
        min: 40,
        max: 70,
      })
      expect(v).toBeGreaterThanOrEqual(40)
      expect(v).toBeLessThanOrEqual(70)
    }
  })
})

describe('world-realism-engine · betaIncomplete + betaQuantile', () => {
  it('betaIncomplete matches known CDF values to 4 decimals', () => {
    // Beta(2, 2) is symmetric; CDF at 0.5 should be 0.5.
    expect(betaIncomplete(0.5, 2, 2)).toBeCloseTo(0.5, 4)
    // Beta(1, 1) is uniform; CDF at 0.3 should be 0.3.
    expect(betaIncomplete(0.3, 1, 1)).toBeCloseTo(0.3, 4)
    // Beta(3, 1) concentrates near 1; CDF at 0.5 should be 0.125 (x^3).
    expect(betaIncomplete(0.5, 3, 1)).toBeCloseTo(0.125, 4)
  })

  it('betaQuantile is inverse of betaIncomplete for various (a, b, u)', () => {
    const cases: Array<[number, number, number]> = [
      [2, 2, 0.25],
      [2, 2, 0.75],
      [5, 2, 0.5],
      [2, 5, 0.5],
      [10, 10, 0.9],
      [3, 7, 0.1],
    ]
    for (const [a, b, u] of cases) {
      const x = betaQuantile(u, a, b)
      const back = betaIncomplete(x, a, b)
      expect(back).toBeCloseTo(u, 5)
    }
  })

  it('betaQuantile edge cases', () => {
    expect(betaQuantile(0, 2, 3)).toBe(0)
    expect(betaQuantile(1, 2, 3)).toBe(1)
  })
})

describe('world-realism-engine · stableAnchoredBeta', () => {
  it('draws cluster tightly near anchor when concentration is high', () => {
    const draws: number[] = []
    for (let i = 0; i < 2000; i++) {
      draws.push(stableAnchoredBeta({ seed: `s-${i}`, anchor: 0.7, concentration: 60 }))
    }
    expect(mean(draws)).toBeGreaterThan(0.65)
    expect(mean(draws)).toBeLessThan(0.75)
    expect(stdev(draws)).toBeLessThan(0.08)
  })

  it('draws spread more with low concentration', () => {
    const draws: number[] = []
    for (let i = 0; i < 2000; i++) {
      draws.push(stableAnchoredBeta({ seed: `ss-${i}`, anchor: 0.5, concentration: 6 }))
    }
    expect(stdev(draws)).toBeGreaterThan(0.14)
  })

  it('is deterministic per seed', () => {
    const first = stableAnchoredBeta({ seed: 'fixed', anchor: 0.4, concentration: 30 })
    for (let i = 0; i < 20; i++) {
      expect(stableAnchoredBeta({ seed: 'fixed', anchor: 0.4, concentration: 30 })).toBe(first)
    }
  })
})

describe('world-realism-engine · realizeAssessmentMark', () => {
  it('returns within assessment bounds for all types', () => {
    const profile = makeProfile()
    for (const type of Object.keys(ASSESSMENT_BOUNDS) as Array<keyof typeof ASSESSMENT_BOUNDS>) {
      for (let i = 0; i < 40; i++) {
        const mark = realizeAssessmentMark({
          seed: `${type}-${i}`,
          assessmentType: type,
          anchorPct: 60,
          studentProfile: profile,
          interventionDeltaPct: 0,
        })
        expect(mark).toBeGreaterThanOrEqual(ASSESSMENT_BOUNDS[type].min)
        expect(mark).toBeLessThanOrEqual(ASSESSMENT_BOUNDS[type].max)
      }
    }
  })

  it('zero intervention delta keeps realized mark centered near anchor over many seeds', () => {
    const profile = makeProfile({ volatility: 0.2 })
    const draws: number[] = []
    for (let i = 0; i < 1000; i++) {
      draws.push(realizeAssessmentMark({
        seed: `center-${i}`,
        assessmentType: 'tt2',
        anchorPct: 65,
        studentProfile: profile,
        interventionDeltaPct: 0,
      }))
    }
    expect(mean(draws)).toBeGreaterThan(60)
    expect(mean(draws)).toBeLessThan(70)
  })

  it('positive intervention delta shifts the realized distribution upward', () => {
    const profile = makeProfile({ volatility: 0.2 })
    const baselineDraws: number[] = []
    const upliftedDraws: number[] = []
    for (let i = 0; i < 500; i++) {
      const seed = `shift-${i}`
      baselineDraws.push(realizeAssessmentMark({
        seed,
        assessmentType: 'tt2',
        anchorPct: 55,
        studentProfile: profile,
        interventionDeltaPct: 0,
      }))
      upliftedDraws.push(realizeAssessmentMark({
        seed,
        assessmentType: 'tt2',
        anchorPct: 55,
        studentProfile: profile,
        interventionDeltaPct: 6,
      }))
    }
    expect(mean(upliftedDraws) - mean(baselineDraws)).toBeGreaterThan(4.5)
    expect(mean(upliftedDraws) - mean(baselineDraws)).toBeLessThan(7)
  })

  it('is deterministic per seed', () => {
    const profile = makeProfile()
    const first = realizeAssessmentMark({
      seed: 'deterministic',
      assessmentType: 'quiz',
      anchorPct: 70,
      studentProfile: profile,
      interventionDeltaPct: 3,
    })
    for (let i = 0; i < 10; i++) {
      expect(realizeAssessmentMark({
        seed: 'deterministic',
        assessmentType: 'quiz',
        anchorPct: 70,
        studentProfile: profile,
        interventionDeltaPct: 3,
      })).toBe(first)
    }
  })
})

describe('world-realism-engine · applyForgetDecay', () => {
  it('no intervention: decay = forgetRate * (days / 14)', () => {
    const profile = makeProfile({ forgetRate: 0.2 })
    const decay = applyForgetDecay({
      studentProfile: profile,
      daysElapsedSinceLastEngagement: 14,
      hadInterventionInWindow: false,
    })
    expect(decay).toBeCloseTo(0.2, 6)
  })

  it('with intervention: decay attenuated by relearnRate', () => {
    const profile = makeProfile({ forgetRate: 0.2, relearnRate: 0.5 })
    const decayNoInt = applyForgetDecay({
      studentProfile: profile,
      daysElapsedSinceLastEngagement: 14,
      hadInterventionInWindow: false,
    })
    const decayWithInt = applyForgetDecay({
      studentProfile: profile,
      daysElapsedSinceLastEngagement: 14,
      hadInterventionInWindow: true,
    })
    expect(decayWithInt).toBeLessThan(decayNoInt)
    // expected: 0.2 * (1 - 0.5 * 0.4) = 0.2 * 0.8 = 0.16
    expect(decayWithInt).toBeCloseTo(0.16, 6)
  })

  it('caps decay at 0.3', () => {
    const profile = makeProfile({ forgetRate: 0.28 })
    const decay = applyForgetDecay({
      studentProfile: profile,
      daysElapsedSinceLastEngagement: 60,
      hadInterventionInWindow: false,
    })
    expect(decay).toBeLessThanOrEqual(0.3)
  })

  it('zero days -> zero decay', () => {
    const profile = makeProfile({ forgetRate: 0.2 })
    const decay = applyForgetDecay({
      studentProfile: profile,
      daysElapsedSinceLastEngagement: 0,
      hadInterventionInWindow: false,
    })
    expect(decay).toBe(0)
  })
})

describe('world-realism-engine · applyAnchorDecay', () => {
  it('reduces anchor proportionally to decay', () => {
    const profile = makeProfile({ forgetRate: 0.2, relearnRate: 0.5 })
    const decayedNoInt = applyAnchorDecay({
      anchorPct: 80,
      studentProfile: profile,
      daysElapsedSinceLastEngagement: 14,
      hadInterventionInWindow: false,
    })
    expect(decayedNoInt).toBeCloseTo(64, 0)  // 80 * (1 - 0.2) = 64
    const decayedWithInt = applyAnchorDecay({
      anchorPct: 80,
      studentProfile: profile,
      daysElapsedSinceLastEngagement: 14,
      hadInterventionInWindow: true,
    })
    expect(decayedWithInt).toBeCloseTo(67.2, 1)  // 80 * (1 - 0.16)
    expect(decayedWithInt).toBeGreaterThan(decayedNoInt)
  })
})

describe('world-realism-engine · computeMarkDelta', () => {
  it('zero impact -> zero delta', () => {
    expect(computeMarkDelta({
      totalInterventionImpact: 0,
      dominantTier: null,
      assessmentType: 'tt2',
    })).toBe(0)
  })

  it('strong tier produces larger delta than partial, partial larger than weak', () => {
    const deltaStrong = computeMarkDelta({
      totalInterventionImpact: 0.8,
      dominantTier: 'strong',
      assessmentType: 'tt2',
    })
    const deltaPartial = computeMarkDelta({
      totalInterventionImpact: 0.8,
      dominantTier: 'partial',
      assessmentType: 'tt2',
    })
    const deltaWeak = computeMarkDelta({
      totalInterventionImpact: 0.8,
      dominantTier: 'weak',
      assessmentType: 'tt2',
    })
    expect(deltaStrong).toBeGreaterThan(deltaPartial)
    expect(deltaPartial).toBeGreaterThan(deltaWeak)
  })

  it('delta stays within assessment responsiveness bounds', () => {
    for (const type of Object.keys(ASSESSMENT_RESPONSIVENESS) as Array<keyof typeof ASSESSMENT_RESPONSIVENESS>) {
      const delta = computeMarkDelta({
        totalInterventionImpact: 0.95,
        dominantTier: 'strong',
        assessmentType: type,
      })
      expect(delta).toBeLessThanOrEqual(ASSESSMENT_RESPONSIVENESS[type].max)
    }
  })

  it('TT1 cannot move (already happened)', () => {
    expect(computeMarkDelta({
      totalInterventionImpact: 0.9,
      dominantTier: 'strong',
      assessmentType: 'tt1',
    })).toBe(0)
  })
})
