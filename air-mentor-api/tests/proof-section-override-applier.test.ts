import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BOUND_LATENT_MAX,
  BOUND_LATENT_MIN,
  BOUND_LATENT_SHIFT,
  SECTION_OVERRIDE_FLAG_NAME,
  applySectionOverridesToProfile,
  parseSectionOverridesJson,
  type ProfileLatentForOverride,
  type SectionOverrides,
} from '../src/lib/proof-section-override-applier.js'

function makeLatent(): ProfileLatentForOverride {
  return {
    behavior: {
      practiceCompliance: 0.55,
      helpSeekingTendency: 0.45,
      examPressure: 0.35,
      attendancePropensity: 0.65,
    },
    dynamics: {
      consistency: 0.55,
      volatility: 0.22,
    },
    intervention: {
      interventionReceptivity: 0.5,
    },
  }
}

describe('parseSectionOverridesJson', () => {
  it('returns null for nullish / empty / non-JSON input', () => {
    expect(parseSectionOverridesJson(null)).toBeNull()
    expect(parseSectionOverridesJson(undefined)).toBeNull()
    expect(parseSectionOverridesJson('')).toBeNull()
    expect(parseSectionOverridesJson('{ broken')).toBeNull()
    expect(parseSectionOverridesJson('"just a string"')).toBeNull()
    expect(parseSectionOverridesJson('null')).toBeNull()
  })

  it('parses a well-formed section-B override', () => {
    const parsed = parseSectionOverridesJson(JSON.stringify({
      B: {
        practiceCompliance: 0.45,
        interventionReceptivity: 0.62,
        examPressure: 0.55,
      },
    }))
    expect(parsed).not.toBeNull()
    expect(parsed?.B?.practiceCompliance).toBe(0.45)
    expect(parsed?.B?.interventionReceptivity).toBe(0.62)
    expect(parsed?.B?.examPressure).toBe(0.55)
  })

  it('clamps out-of-band values to null (rejection)', () => {
    const parsed = parseSectionOverridesJson(JSON.stringify({
      A: {
        practiceCompliance: 0.95,   // > 0.9 -> reject
        examPressure: 0.05,         // < 0.2 -> reject
        interventionReceptivity: 0.5,
      },
    }))
    expect(parsed?.A?.practiceCompliance).toBeNull()
    expect(parsed?.A?.examPressure).toBeNull()
    expect(parsed?.A?.interventionReceptivity).toBe(0.5)
  })

  it('ignores unknown scalar keys', () => {
    const parsed = parseSectionOverridesJson(JSON.stringify({
      A: { unknownKey: 0.5, practiceCompliance: 0.55 },
    }))
    expect(parsed?.A?.practiceCompliance).toBe(0.55)
    expect((parsed?.A as Record<string, unknown>).unknownKey).toBeUndefined()
  })

  it('preserves explicit null (means "use batch default")', () => {
    const parsed = parseSectionOverridesJson(JSON.stringify({
      A: { practiceCompliance: null, examPressure: 0.5 },
    }))
    expect(parsed?.A?.practiceCompliance).toBeNull()
    expect(parsed?.A?.examPressure).toBe(0.5)
  })
})

describe('applySectionOverridesToProfile · flag gating', () => {
  const originalFlag = process.env[SECTION_OVERRIDE_FLAG_NAME]

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[SECTION_OVERRIDE_FLAG_NAME]
    else process.env[SECTION_OVERRIDE_FLAG_NAME] = originalFlag
  })

  it('flag unset -> latent returned unchanged, applied=false', () => {
    delete process.env[SECTION_OVERRIDE_FLAG_NAME]
    const base = makeLatent()
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'A',
      overrides: { A: { practiceCompliance: 0.85 } },
      studentId: 'stud_001',
      runSeed: 'run-1',
    })
    expect(result.applied).toBe(false)
    expect(result.latent).toEqual(base)
  })

  it('flag=1 + null overrides -> identity', () => {
    process.env[SECTION_OVERRIDE_FLAG_NAME] = '1'
    const base = makeLatent()
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'A',
      overrides: null,
      studentId: 'stud_001',
      runSeed: 'run-1',
    })
    expect(result.applied).toBe(false)
    expect(result.latent).toEqual(base)
  })

  it('flag=1 + no override for this section -> identity', () => {
    process.env[SECTION_OVERRIDE_FLAG_NAME] = '1'
    const base = makeLatent()
    const overrides: SectionOverrides = { B: { practiceCompliance: 0.85 } }
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'A',
      overrides,
      studentId: 'stud_001',
      runSeed: 'run-1',
    })
    expect(result.applied).toBe(false)
    expect(result.latent).toEqual(base)
  })
})

describe('applySectionOverridesToProfile · shift behavior', () => {
  beforeEach(() => {
    process.env[SECTION_OVERRIDE_FLAG_NAME] = '1'
  })
  afterEach(() => {
    delete process.env[SECTION_OVERRIDE_FLAG_NAME]
  })

  it('applies mean shift bounded by BOUND_LATENT_SHIFT=0.15', () => {
    const base = makeLatent()
    // practiceCompliance baseline 0.55; target 0.85 -> raw shift 0.3, capped to 0.15
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'A',
      overrides: { A: { practiceCompliance: 0.85 } },
      studentId: 'stud_001',
      runSeed: 'run-1',
    })
    expect(result.applied).toBe(true)
    // shift + jitter in [-0.06, +0.06], so next in [0.55 + 0.15 - 0.06, 0.55 + 0.15 + 0.06]
    expect(result.latent.behavior.practiceCompliance).toBeGreaterThan(base.behavior.practiceCompliance)
    expect(result.latent.behavior.practiceCompliance).toBeGreaterThanOrEqual(0.55 + 0.15 - BOUND_LATENT_SHIFT - 0.06 - 0.001)
    expect(result.latent.behavior.practiceCompliance).toBeLessThanOrEqual(BOUND_LATENT_MAX + 0.001)
  })

  it('clamps final value to [BOUND_LATENT_MIN, BOUND_LATENT_MAX]', () => {
    const base = makeLatent()
    base.behavior.practiceCompliance = BOUND_LATENT_MAX  // 0.9
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'A',
      overrides: { A: { practiceCompliance: BOUND_LATENT_MAX } },
      studentId: 'stud_001',
      runSeed: 'run-1',
    })
    expect(result.latent.behavior.practiceCompliance).toBeLessThanOrEqual(BOUND_LATENT_MAX + 0.001)
    expect(result.latent.behavior.practiceCompliance).toBeGreaterThanOrEqual(BOUND_LATENT_MIN - 0.001)
  })

  it('does NOT shift scalars not in the override', () => {
    const base = makeLatent()
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'A',
      overrides: { A: { practiceCompliance: 0.85 } },
      studentId: 'stud_001',
      runSeed: 'run-1',
    })
    // examPressure NOT in override -> stays at baseline
    expect(result.latent.behavior.examPressure).toBe(base.behavior.examPressure)
    // interventionReceptivity NOT in override -> stays
    expect(result.latent.intervention.interventionReceptivity).toBe(base.intervention.interventionReceptivity)
    // consistency NOT in override -> stays
    expect(result.latent.dynamics.consistency).toBe(base.dynamics.consistency)
    // attendancePropensity NOT in override -> stays
    expect(result.latent.behavior.attendancePropensity).toBe(base.behavior.attendancePropensity)
  })

  it('multi-scalar shift changes every targeted scalar', () => {
    const base = makeLatent()
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'B',
      overrides: {
        B: {
          practiceCompliance: 0.4,
          helpSeekingTendency: 0.35,
          examPressure: 0.55,
          attendancePropensity: 0.55,
          consistency: 0.42,
          volatility: 0.38,
          interventionReceptivity: 0.65,
        },
      },
      studentId: 'stud_B_042',
      runSeed: 'run-9',
    })
    expect(result.applied).toBe(true)
    expect(result.shiftsBySclalar.practiceCompliance).toBeDefined()
    expect(result.shiftsBySclalar.examPressure).toBeDefined()
    expect(result.shiftsBySclalar.interventionReceptivity).toBeDefined()
    expect(result.latent.behavior.practiceCompliance).not.toBe(base.behavior.practiceCompliance)
    expect(result.latent.behavior.examPressure).not.toBe(base.behavior.examPressure)
    expect(result.latent.intervention.interventionReceptivity).not.toBe(base.intervention.interventionReceptivity)
  })

  it('is deterministic by (runSeed, sectionCode, studentId, scalar): 20 calls identical', () => {
    const base = makeLatent()
    const overrides: SectionOverrides = {
      B: {
        practiceCompliance: 0.42,
        interventionReceptivity: 0.62,
      },
    }
    const first = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'B',
      overrides,
      studentId: 'stud_B_042',
      runSeed: 'run-12',
    })
    for (let i = 0; i < 20; i++) {
      const again = applySectionOverridesToProfile({
        latent: base,
        sectionCode: 'B',
        overrides,
        studentId: 'stud_B_042',
        runSeed: 'run-12',
      })
      expect(again.latent).toEqual(first.latent)
    }
  })

  it('different students get different jitter (within-section variance preserved)', () => {
    const base = makeLatent()
    const overrides: SectionOverrides = {
      B: { practiceCompliance: 0.42 },
    }
    const studentA = applySectionOverridesToProfile({
      latent: base, sectionCode: 'B', overrides, studentId: 'stud_B_001', runSeed: 'run-12',
    })
    const studentB = applySectionOverridesToProfile({
      latent: base, sectionCode: 'B', overrides, studentId: 'stud_B_099', runSeed: 'run-12',
    })
    // Different students -> different jitter -> different final value
    expect(studentA.latent.behavior.practiceCompliance).not.toBe(studentB.latent.behavior.practiceCompliance)
  })

  it('different runSeeds change jitter for same (sectionCode, studentId, scalar)', () => {
    const base = makeLatent()
    const overrides: SectionOverrides = {
      B: { practiceCompliance: 0.42 },
    }
    const seed1 = applySectionOverridesToProfile({
      latent: base, sectionCode: 'B', overrides, studentId: 'stud_B_001', runSeed: 'run-1',
    })
    const seed2 = applySectionOverridesToProfile({
      latent: base, sectionCode: 'B', overrides, studentId: 'stud_B_001', runSeed: 'run-2',
    })
    expect(seed1.latent.behavior.practiceCompliance).not.toBe(seed2.latent.behavior.practiceCompliance)
  })

  it('target = current -> small jitter only (no mean shift)', () => {
    const base = makeLatent()
    // target = baseline -> raw shift = 0, only jitter remains
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'A',
      overrides: { A: { practiceCompliance: base.behavior.practiceCompliance } },
      studentId: 'stud_001',
      runSeed: 'run-1',
    })
    // Jitter in [-0.06, +0.06]
    const delta = result.latent.behavior.practiceCompliance - base.behavior.practiceCompliance
    expect(Math.abs(delta)).toBeLessThanOrEqual(0.06 + 0.001)
  })

  it('shiftsBySclalar reports net change per scalar', () => {
    const base = makeLatent()
    const result = applySectionOverridesToProfile({
      latent: base,
      sectionCode: 'B',
      overrides: { B: { examPressure: 0.55 } },
      studentId: 'stud_B_001',
      runSeed: 'run-7',
    })
    expect(result.shiftsBySclalar.examPressure).toBeDefined()
    expect(result.shiftsBySclalar.practiceCompliance).toBeUndefined()  // not in override
    const reportedShift = result.shiftsBySclalar.examPressure!
    expect(result.latent.behavior.examPressure).toBeCloseTo(base.behavior.examPressure + reportedShift, 10)
  })
})
