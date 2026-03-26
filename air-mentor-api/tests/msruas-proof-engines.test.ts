import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'
import { inferObservableRisk } from '../src/lib/inference-engine.js'
import { buildMonitoringDecision } from '../src/lib/monitoring-engine.js'
import {
  ceMinimumPctForPolicy,
  ceShortfallLabelFromPct,
  stageCourseworkEvidenceForStage,
} from '../src/lib/msruas-proof-control-plane.js'
import {
  calculateCgpa,
  calculateSgpa,
  evaluateAttendanceStatus,
  evaluateCourseStatus,
  type MsruasDeterministicPolicy,
} from '../src/lib/msruas-rules.js'

const deterministicPolicy: MsruasDeterministicPolicy = {
  gradeBands: DEFAULT_POLICY.gradeBands,
  attendanceRules: {
    minimumPercent: DEFAULT_POLICY.attendanceRules.minimumRequiredPercent,
  },
  condonationRules: {
    minimumPercent: DEFAULT_POLICY.attendanceRules.condonationFloorPercent,
    shortagePercent: DEFAULT_POLICY.condonationRules.maximumShortagePercent,
    requiresApproval: DEFAULT_POLICY.condonationRules.requiresApproval,
  },
  eligibilityRules: {
    minimumAttendancePercent: DEFAULT_POLICY.attendanceRules.minimumRequiredPercent,
    minimumCeForSee: DEFAULT_POLICY.eligibilityRules.minimumCeForSeeEligibility,
  },
  passRules: {
    ceMinimum: DEFAULT_POLICY.passRules.minimumCeMark,
    seeMinimum: DEFAULT_POLICY.passRules.minimumSeeMark,
    overallMinimum: DEFAULT_POLICY.passRules.minimumOverallMark,
    ceMaximum: DEFAULT_POLICY.passRules.ceMaximum,
    seeMaximum: DEFAULT_POLICY.passRules.seeMaximum,
    overallMaximum: DEFAULT_POLICY.passRules.overallMaximum,
  },
  roundingRules: {
    statusMarkRounding: DEFAULT_POLICY.roundingRules.statusMarkRounding,
    sgpaCgpaDecimals: DEFAULT_POLICY.roundingRules.sgpaCgpaDecimals,
  },
  sgpaCgpaRules: {
    includeFailedCredits: DEFAULT_POLICY.sgpaCgpaRules.includeFailedCredits,
    repeatedCoursePolicy: DEFAULT_POLICY.sgpaCgpaRules.repeatedCoursePolicy,
  },
}

describe('msruas proof engines', () => {
  it('applies attendance, condonation, rounding, pass/fail, and SGPA or CGPA rules deterministically', () => {
    expect(evaluateAttendanceStatus({
      attendancePercent: 78,
      policy: deterministicPolicy,
    })).toMatchObject({
      status: 'eligible',
      condonationRequired: false,
    })

    expect(evaluateAttendanceStatus({
      attendancePercent: 70,
      policy: deterministicPolicy,
    })).toMatchObject({
      status: 'condonable',
      condonationRequired: true,
    })

    expect(evaluateAttendanceStatus({
      attendancePercent: 70,
      condoned: true,
      policy: deterministicPolicy,
    })).toMatchObject({
      status: 'eligible',
      condonationRequired: false,
    })

    expect(evaluateAttendanceStatus({
      attendancePercent: 64.9,
      policy: deterministicPolicy,
    })).toMatchObject({
      status: 'ineligible',
      condonationRequired: false,
    })

    expect(evaluateAttendanceStatus({
      attendancePercent: 65,
      policy: deterministicPolicy,
    })).toMatchObject({
      status: 'condonable',
      condonationRequired: true,
    })

    expect(evaluateAttendanceStatus({
      attendancePercent: 74.99,
      policy: deterministicPolicy,
    })).toMatchObject({
      status: 'condonable',
      condonationRequired: true,
    })

    expect(evaluateAttendanceStatus({
      attendancePercent: 75,
      policy: deterministicPolicy,
    })).toMatchObject({
      status: 'eligible',
      condonationRequired: false,
    })

    const passed = evaluateCourseStatus({
      attendancePercent: 70,
      condoned: true,
      ceMark: 23.6,
      seeMark: 16.2,
      policy: deterministicPolicy,
    })
    expect(passed).toMatchObject({
      ceRounded: 24,
      seeRounded: 16,
      overallRounded: 40,
      seeEligible: true,
      passed: true,
      result: 'Passed',
    })

    const failed = evaluateCourseStatus({
      attendancePercent: 70,
      condoned: true,
      ceMark: 23.4,
      seeMark: 16.2,
      policy: deterministicPolicy,
    })
    expect(failed).toMatchObject({
      ceRounded: 23,
      seeRounded: 16,
      overallRounded: 40,
      seeEligible: false,
      passed: false,
      result: 'Failed',
      gradeLabel: 'F',
    })

    expect(evaluateCourseStatus({
      attendancePercent: 75,
      policy: deterministicPolicy,
      ceMark: 23.9,
      seeMark: 16,
    })).toMatchObject({
      ceRounded: 24,
      seeRounded: 16,
      overallRounded: 40,
      passed: true,
      result: 'Passed',
    })

    expect(evaluateCourseStatus({
      attendancePercent: 75,
      policy: deterministicPolicy,
      ceMark: 23.49,
      seeMark: 16,
    })).toMatchObject({
      ceRounded: 23,
      seeRounded: 16,
      passed: false,
      result: 'Failed',
    })

    expect(evaluateCourseStatus({
      attendancePercent: 75,
      policy: deterministicPolicy,
      ceMark: 24,
      seeMark: 15.49,
    })).toMatchObject({
      ceRounded: 24,
      seeRounded: 15,
      passed: false,
      result: 'Failed',
    })

    expect(evaluateCourseStatus({
      attendancePercent: 75,
      policy: deterministicPolicy,
      ceMark: 24,
      seeMark: 16,
    })).toMatchObject({
      ceRounded: 24,
      seeRounded: 16,
      overallRounded: 40,
      passed: true,
      result: 'Passed',
    })

    const sgpa = calculateSgpa({
      attempts: [
        { courseCode: 'AMC101', credits: 4, gradePoint: 10, result: 'Passed' },
        { courseCode: 'AMC102', credits: 3, gradePoint: 8, result: 'Passed' },
        { courseCode: 'AMC103', credits: 3, gradePoint: 0, result: 'Failed' },
      ],
      policy: deterministicPolicy,
    })
    expect(sgpa).toBe(9.14)

    const cgpa = calculateCgpa({
      termAttempts: [
        [
          { courseCode: 'AMC101', credits: 4, gradePoint: 10, result: 'Passed' },
          { courseCode: 'AMC102', credits: 3, gradePoint: 8, result: 'Passed' },
        ],
        [
          { courseCode: 'AMC201', credits: 4, gradePoint: 9, result: 'Passed' },
          { courseCode: 'AMC202', credits: 2, gradePoint: 7, result: 'Passed' },
        ],
      ],
      policy: deterministicPolicy,
    })
    expect(cgpa).toBe(8.77)
  })

  it('scores only observable evidence and drives monitoring decisions with cooldown protection', () => {
    const inferred = inferObservableRisk({
      attendancePct: 62,
      currentCgpa: 5.8,
      backlogCount: 2,
      tt1Pct: 34,
      tt2Pct: 48,
      seePct: 39,
      quizPct: 41,
      assignmentPct: 43,
      weakCoCount: 2,
      attendanceHistoryRiskCount: 3,
      questionWeaknessCount: 4,
      interventionResponseScore: -0.11,
      policy: DEFAULT_POLICY,
    })

    expect(inferred.riskBand).toBe('High')
    expect(inferred.riskProb).toBeGreaterThanOrEqual(0.7)
    expect(inferred.observableDrivers.map(driver => driver.feature)).toContain('attendance')
    expect(inferred.observableDrivers.map(driver => driver.feature)).toContain('cgpa')
    expect(inferred.observableDrivers.map(driver => driver.feature)).toContain('see')
    expect(inferred.observableDrivers.map(driver => driver.feature)).toContain('question-pattern')

    const cooledDown = buildMonitoringDecision({
      riskProb: inferred.riskProb,
      riskBand: inferred.riskBand,
      cooldownUntil: '2026-12-31T00:00:00.000Z',
      nowIso: '2026-03-22T00:00:00.000Z',
    })
    expect(cooledDown).toMatchObject({
      decisionType: 'suppress',
      queueOwnerRole: 'Course Leader',
      cooldownUntil: '2026-12-31T00:00:00.000Z',
    })

    const activeHigh = buildMonitoringDecision({
      riskProb: inferred.riskProb,
      riskBand: inferred.riskBand,
      previousRiskBand: 'Medium',
      evidenceWindowCount: 3,
      interventionResidual: -0.11,
      nowIso: '2026-03-22T00:00:00.000Z',
    })
    expect(activeHigh).toMatchObject({
      decisionType: 'alert',
      queueOwnerRole: 'Mentor',
    })

    const steppedDown = buildMonitoringDecision({
      riskProb: 0.48,
      riskBand: 'Medium',
      previousRiskBand: 'High',
      evidenceWindowCount: 2,
      interventionResidual: -0.04,
      nowIso: '2026-03-22T00:00:00.000Z',
    })
    expect(steppedDown).toMatchObject({
      decisionType: 'watch',
      queueOwnerRole: 'Course Leader',
    })
    expect(steppedDown.note).toContain('Risk eased from high to medium')
  })

  it('converts CE thresholds to percentages and only surfaces coursework once the stage allows it', () => {
    expect(ceMinimumPctForPolicy(DEFAULT_POLICY)).toBe(40)
    expect(ceShortfallLabelFromPct(39.9, DEFAULT_POLICY)).toBe(1)
    expect(ceShortfallLabelFromPct(40, DEFAULT_POLICY)).toBe(0)

    expect(stageCourseworkEvidenceForStage({
      stageKey: 'pre-tt1',
      quizPct: 72,
      assignmentPct: 74,
    })).toEqual({
      quizPct: null,
      assignmentPct: null,
    })

    expect(stageCourseworkEvidenceForStage({
      stageKey: 'post-tt1',
      quizPct: 72,
      assignmentPct: 74,
    })).toEqual({
      quizPct: null,
      assignmentPct: null,
    })

    expect(stageCourseworkEvidenceForStage({
      stageKey: 'post-tt2',
      quizPct: 72,
      assignmentPct: 74,
    })).toEqual({
      quizPct: 72,
      assignmentPct: 74,
    })
  })

  it('keeps the first-6-semester curriculum seed structurally complete for the proof batch', () => {
    const seedPath = new URL('../src/db/seeds/msruas-mnc-curriculum.json', import.meta.url)
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as {
      courses: Array<{
        credits: number
        explicitPrerequisites: string[]
        addedPrerequisites: string[]
        bridgeModules: string[]
      }>
      electives: Array<unknown>
    }

    const courseCount = seed.courses.length
    const totalCredits = seed.courses.reduce((sum, course) => sum + course.credits, 0)
    const explicitEdges = seed.courses.reduce((sum, course) => sum + course.explicitPrerequisites.length, 0)
    const addedEdges = seed.courses.reduce((sum, course) => sum + course.addedPrerequisites.length, 0)
    const bridgeRows = seed.courses.filter(course => course.bridgeModules.length > 0).length
    const electiveMappings = seed.electives.length

    expect(courseCount).toBe(36)
    expect(totalCredits).toBe(118)
    expect(explicitEdges).toBe(24)
    expect(addedEdges).toBe(20)
    expect(bridgeRows).toBe(10)
    expect(electiveMappings).toBe(18)
  })
})
