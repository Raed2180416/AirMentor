import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SECTION_OVERRIDE_FLAG_NAME, type SectionOverrides } from '../src/lib/proof-section-override-applier.js'
import {
  maybeApplySectionOverridesToTrajectory,
  roundToTwo,
  type TrajectoryLikeForOverride,
} from '../src/lib/proof-section-override-trajectory-wire.js'

// Fixture shaped like the StudentTrajectory that msruas-proof-control-plane.ts
// builds. We include every "other" key that the real trajectory has so the
// structural spread proves it passes extra fields through untouched.
function makeFixtureTrajectory(overrides: Partial<{ sectionCode: string; studentId: string }> = {}): TrajectoryLikeForOverride {
  return {
    studentId: overrides.studentId ?? 'mnc_student_042',
    usn: '1MS23MC042',
    name: 'Test Student',
    sectionCode: overrides.sectionCode ?? 'B',
    archetype: 'strategic-fragile',
    latentBase: {
      academicPotential: 0.58,
      mathematicsFoundation: 0.61,
      computingFoundation: 0.55,
      selfRegulation: 0.6,
      attendanceDiscipline: 0.66,
      supportResponsiveness: 0.52,
    },
    profile: {
      programScopeVersion: 'mnc-first-6-sem-v1',
      currentSemester: 6,
      mentorTrack: 'mixed',
      electiveTrackInterestProfile: {
        codingAndCryptography: 0.5,
      },
      readiness: {
        mathReadiness: 0.61,
      },
      dynamics: {
        forgetRate: 0.1,
        relearnRate: 0.55,
        transferGainRate: 0.4,
        studyGainRate: 0.48,
        fatigueRate: 0.07,
        consistency: 0.55,
        volatility: 0.22,
        recoveryTendency: 0.5,
        relapseTendency: 0.18,
      },
      behavior: {
        attendancePropensity: 0.66,
        helpSeekingTendency: 0.45,
        selfCheckTendency: 0.48,
        deadlineDiscipline: 0.6,
        examPressure: 0.35,
        timePressureSensitivity: 0.3,
        practiceCompliance: 0.55,
        courseworkReliability: 0.72,
      },
      assessment: {
        quizRecallStrength: 0.5,
      },
      intervention: {
        interventionReceptivity: 0.5,
        temporaryUpliftCredit: 0.1,
        expectedRecoveryThreshold: 0.12,
      },
    },
  }
}

describe('maybeApplySectionOverridesToTrajectory · flag gating', () => {
  const originalFlag = process.env[SECTION_OVERRIDE_FLAG_NAME]
  afterEach(() => {
    if (originalFlag === undefined) delete process.env[SECTION_OVERRIDE_FLAG_NAME]
    else process.env[SECTION_OVERRIDE_FLAG_NAME] = originalFlag
  })

  it('flag unset + overrides present -> identity passthrough', () => {
    delete process.env[SECTION_OVERRIDE_FLAG_NAME]
    const trajectory = makeFixtureTrajectory()
    const overrides: SectionOverrides = { B: { practiceCompliance: 0.4 } }
    const result = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
    expect(result).toBe(trajectory)
  })

  it('flag=1 + null overrides -> identity passthrough', () => {
    process.env[SECTION_OVERRIDE_FLAG_NAME] = '1'
    const trajectory = makeFixtureTrajectory()
    const result = maybeApplySectionOverridesToTrajectory(trajectory, null, 12)
    expect(result).toBe(trajectory)
  })

  it('flag=1 + overrides present but none for this section -> identity passthrough', () => {
    process.env[SECTION_OVERRIDE_FLAG_NAME] = '1'
    const trajectory = makeFixtureTrajectory({ sectionCode: 'A' })
    const overrides: SectionOverrides = { B: { practiceCompliance: 0.4 } }
    const result = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
    expect(result).toBe(trajectory)
  })
})

describe('maybeApplySectionOverridesToTrajectory · shift behavior', () => {
  beforeEach(() => {
    process.env[SECTION_OVERRIDE_FLAG_NAME] = '1'
  })
  afterEach(() => {
    delete process.env[SECTION_OVERRIDE_FLAG_NAME]
  })

  it('flag=1 + override present -> adjusts target scalars only', () => {
    const trajectory = makeFixtureTrajectory()
    const overrides: SectionOverrides = {
      B: {
        practiceCompliance: 0.4,
        examPressure: 0.55,
      },
    }
    const result = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
    // Object identity changed (applied)
    expect(result).not.toBe(trajectory)
    // Targeted scalars changed
    expect(result.profile.behavior.practiceCompliance).not.toBe(trajectory.profile.behavior.practiceCompliance)
    expect(result.profile.behavior.examPressure).not.toBe(trajectory.profile.behavior.examPressure)
    // Non-targeted scalars preserved
    expect(result.profile.behavior.helpSeekingTendency).toBe(trajectory.profile.behavior.helpSeekingTendency)
    expect(result.profile.behavior.attendancePropensity).toBe(trajectory.profile.behavior.attendancePropensity)
    expect(result.profile.intervention.interventionReceptivity).toBe(trajectory.profile.intervention.interventionReceptivity)
    expect(result.profile.dynamics.consistency).toBe(trajectory.profile.dynamics.consistency)
    expect(result.profile.dynamics.volatility).toBe(trajectory.profile.dynamics.volatility)
  })

  it('preserves non-override profile fields (readiness, assessment, etc.) via structural spread', () => {
    const trajectory = makeFixtureTrajectory()
    const overrides: SectionOverrides = { B: { practiceCompliance: 0.4 } }
    const result = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
    // Fields outside the override targets are passed through untouched.
    expect(result.profile.readiness).toEqual(trajectory.profile.readiness)
    expect(result.profile.assessment).toEqual(trajectory.profile.assessment)
    expect(result.profile.electiveTrackInterestProfile).toEqual(trajectory.profile.electiveTrackInterestProfile)
    expect(result.profile.currentSemester).toBe(trajectory.profile.currentSemester)
    expect(result.profile.programScopeVersion).toBe(trajectory.profile.programScopeVersion)
    // Non-profile trajectory fields preserved too.
    expect(result.latentBase).toEqual(trajectory.latentBase)
    expect(result.archetype).toBe(trajectory.archetype)
    expect(result.usn).toBe(trajectory.usn)
    expect(result.name).toBe(trajectory.name)
  })

  it('preserves other behavior scalars via structural spread (courseworkReliability etc.)', () => {
    const trajectory = makeFixtureTrajectory()
    const overrides: SectionOverrides = { B: { practiceCompliance: 0.4 } }
    const result = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
    expect(result.profile.behavior.courseworkReliability).toBe(trajectory.profile.behavior.courseworkReliability)
    expect(result.profile.behavior.selfCheckTendency).toBe(trajectory.profile.behavior.selfCheckTendency)
    expect(result.profile.behavior.deadlineDiscipline).toBe(trajectory.profile.behavior.deadlineDiscipline)
    expect(result.profile.behavior.timePressureSensitivity).toBe(trajectory.profile.behavior.timePressureSensitivity)
  })

  it('applied scalars are roundToTwo-normalized (match existing precision convention)', () => {
    const trajectory = makeFixtureTrajectory()
    const overrides: SectionOverrides = {
      B: {
        practiceCompliance: 0.4,
        examPressure: 0.55,
        interventionReceptivity: 0.62,
        consistency: 0.42,
        volatility: 0.38,
      },
    }
    const result = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
    for (const key of ['practiceCompliance', 'examPressure'] as const) {
      const value = result.profile.behavior[key]
      expect(value).toBe(roundToTwo(value))
    }
    expect(result.profile.intervention.interventionReceptivity).toBe(roundToTwo(result.profile.intervention.interventionReceptivity))
    expect(result.profile.dynamics.consistency).toBe(roundToTwo(result.profile.dynamics.consistency))
    expect(result.profile.dynamics.volatility).toBe(roundToTwo(result.profile.dynamics.volatility))
  })

  it('is deterministic for same (runSeed, studentId, sectionCode) across 10 replays', () => {
    const trajectory = makeFixtureTrajectory()
    const overrides: SectionOverrides = { B: { practiceCompliance: 0.4, examPressure: 0.55 } }
    const first = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
    for (let i = 0; i < 10; i++) {
      const again = maybeApplySectionOverridesToTrajectory(trajectory, overrides, 12)
      expect(again.profile.behavior.practiceCompliance).toBe(first.profile.behavior.practiceCompliance)
      expect(again.profile.behavior.examPressure).toBe(first.profile.behavior.examPressure)
    }
  })

  it('different students in same section -> different shifted values (within-section variance preserved)', () => {
    const trajA = makeFixtureTrajectory({ studentId: 'mnc_student_001', sectionCode: 'B' })
    const trajB = makeFixtureTrajectory({ studentId: 'mnc_student_099', sectionCode: 'B' })
    const overrides: SectionOverrides = { B: { practiceCompliance: 0.4 } }
    const resultA = maybeApplySectionOverridesToTrajectory(trajA, overrides, 12)
    const resultB = maybeApplySectionOverridesToTrajectory(trajB, overrides, 12)
    expect(resultA.profile.behavior.practiceCompliance).not.toBe(resultB.profile.behavior.practiceCompliance)
  })

  it('section A override does not affect section B students', () => {
    const trajB = makeFixtureTrajectory({ sectionCode: 'B' })
    const overrides: SectionOverrides = { A: { practiceCompliance: 0.4 } }
    const result = maybeApplySectionOverridesToTrajectory(trajB, overrides, 12)
    expect(result).toBe(trajB)  // identity — no override for B
  })
})
