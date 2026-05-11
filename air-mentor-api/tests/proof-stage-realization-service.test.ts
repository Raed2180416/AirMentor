import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STAGE_CUMULATIVE_VISIBLE,
  STAGE_NEW_REALIZATIONS,
  STAGE_REALIZATION_FLAG_NAME,
  isStageRealizationEnabled,
  realizeStageForCourse,
  realizeStageForStudent,
  type StageRealizationInput,
  type StageRealizationInterventionInput,
} from '../src/lib/proof-stage-realization-service.js'
import type {
  CourseForSimulation,
  StudentTrajectoryForSimulation,
} from '../src/lib/proof-intervention-response-types.js'

function makeStudent(overrides: Partial<StudentTrajectoryForSimulation> = {}): StudentTrajectoryForSimulation {
  return {
    studentId: overrides.studentId ?? 'stud_alpha',
    sectionCode: overrides.sectionCode ?? 'A',
    latentBase: {
      academicPotential: 0.62,
      mathematicsFoundation: 0.64,
      computingFoundation: 0.6,
      selfRegulation: 0.66,
      attendanceDiscipline: 0.68,
      supportResponsiveness: 0.56,
      ...overrides.latentBase,
    },
    profile: {
      readiness: {
        mathReadiness: 0.64,
        programmingReadiness: 0.6,
        logicReadiness: 0.55,
        statsReadiness: 0.55,
        systemsReadiness: 0.5,
        communicationReadiness: 0.5,
        labReadiness: 0.55,
        ...(overrides.profile?.readiness ?? {}),
      },
      dynamics: {
        forgetRate: 0.1,
        relearnRate: 0.55,
        transferGainRate: 0.4,
        studyGainRate: 0.46,
        fatigueRate: 0.08,
        consistency: 0.6,
        volatility: 0.22,
        recoveryTendency: 0.55,
        relapseTendency: 0.2,
        ...(overrides.profile?.dynamics ?? {}),
      },
      behavior: {
        attendancePropensity: 0.68,
        helpSeekingTendency: 0.42,
        selfCheckTendency: 0.48,
        deadlineDiscipline: 0.66,
        examPressure: 0.35,
        timePressureSensitivity: 0.3,
        practiceCompliance: 0.56,
        courseworkReliability: 0.72,
        ...(overrides.profile?.behavior ?? {}),
      },
      assessment: {
        quizRecallStrength: 0.5,
        assignmentCompletionStrength: 0.55,
        termTestApplicationStrength: 0.54,
        seeEndurance: 0.58,
        labExecutionStrength: 0.52,
        partialCreditConversion: 0.55,
        carelessErrorRate: 0.08,
        multiStepBreakdownRisk: 0.18,
        ...(overrides.profile?.assessment ?? {}),
      },
      intervention: {
        interventionReceptivity: 0.6,
        temporaryUpliftCredit: 0.1,
        expectedRecoveryThreshold: 0.12,
        ...(overrides.profile?.intervention ?? {}),
      },
    },
  }
}

function makeCourse(overrides: Partial<CourseForSimulation> = {}): CourseForSimulation {
  return {
    internalCompilerId: overrides.internalCompilerId ?? 'course_algorithms',
    title: overrides.title ?? 'Design and Analysis of Algorithms',
    assessmentProfile: overrides.assessmentProfile ?? 'tt1,tt2,see',
    explicitPrerequisites: overrides.explicitPrerequisites ?? [],
    addedPrerequisites: overrides.addedPrerequisites ?? [],
  }
}

function makeInput(overrides: Partial<StageRealizationInput> = {}): StageRealizationInput {
  return {
    runId: overrides.runId ?? 'run_test',
    runSeed: overrides.runSeed ?? 4242,
    student: overrides.student ?? makeStudent(),
    course: overrides.course ?? makeCourse(),
    semesterNumber: overrides.semesterNumber ?? 3,
    stageKey: overrides.stageKey ?? 'post-tt2',
    facultyId: overrides.facultyId ?? 'faculty_x',
    scoresByCourseTitle: overrides.scoresByCourseTitle ?? new Map(),
    interventionsInWindow: overrides.interventionsInWindow ?? [],
  }
}

function makeIntervention(overrides: Partial<StageRealizationInterventionInput> = {}): StageRealizationInterventionInput {
  return {
    caseId: overrides.caseId ?? 'case_a',
    actionCode: overrides.actionCode ?? 'targeted_remedial_plan',
    concernFamily: overrides.concernFamily ?? 'coursework',
    ordinalInStageForStudent: overrides.ordinalInStageForStudent ?? 1,
    stageKeyApplied: overrides.stageKeyApplied ?? 'post-tt1',
    semesterNumberApplied: overrides.semesterNumberApplied ?? 3,
    dominantWeaknessHint: overrides.dominantWeaknessHint ?? 'coursework',
    severityContext: overrides.severityContext ?? {
      riskBand: 'Medium',
      cgpa: 6.0,
      backlogCount: 0,
    },
  }
}

describe('stage-realization-service · feature flag', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    delete process.env[STAGE_REALIZATION_FLAG_NAME]
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('isStageRealizationEnabled returns false without flag', () => {
    expect(isStageRealizationEnabled()).toBe(false)
  })

  it('isStageRealizationEnabled returns true with flag=1', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    expect(isStageRealizationEnabled()).toBe(true)
  })

  it('isStageRealizationEnabled returns false with flag=0 / other values', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '0'
    expect(isStageRealizationEnabled()).toBe(false)
    process.env[STAGE_REALIZATION_FLAG_NAME] = 'true'
    expect(isStageRealizationEnabled()).toBe(false)
  })
})

describe('stage-realization-service · stage mapping', () => {
  it('STAGE_NEW_REALIZATIONS covers all 5 stages', () => {
    expect(Object.keys(STAGE_NEW_REALIZATIONS).sort()).toEqual([
      'post-assignments', 'post-see', 'post-tt1', 'post-tt2', 'pre-tt1',
    ])
  })

  it('STAGE_CUMULATIVE_VISIBLE monotonically expands across stages', () => {
    const preSize = STAGE_CUMULATIVE_VISIBLE['pre-tt1'].size
    const postTt1Size = STAGE_CUMULATIVE_VISIBLE['post-tt1'].size
    const postTt2Size = STAGE_CUMULATIVE_VISIBLE['post-tt2'].size
    const postAsgSize = STAGE_CUMULATIVE_VISIBLE['post-assignments'].size
    const postSeeSize = STAGE_CUMULATIVE_VISIBLE['post-see'].size
    expect(preSize).toBeLessThan(postTt1Size)
    expect(postTt1Size).toBeLessThan(postTt2Size)
    expect(postTt2Size).toBeLessThan(postAsgSize)
    expect(postAsgSize).toBeLessThan(postSeeSize)
  })

  it('post-see cumulative visible includes all assessment types + ce + overall', () => {
    const postSee = STAGE_CUMULATIVE_VISIBLE['post-see']
    expect(postSee.has('attendance')).toBe(true)
    expect(postSee.has('tt1')).toBe(true)
    expect(postSee.has('tt2')).toBe(true)
    expect(postSee.has('quiz')).toBe(true)
    expect(postSee.has('assignment')).toBe(true)
    expect(postSee.has('see')).toBe(true)
    expect(postSee.has('ce')).toBe(true)
    expect(postSee.has('overall')).toBe(true)
  })
})

describe('stage-realization-service · realizeStageForCourse baseline behaviour', () => {
  it('zero interventions → realized === baseline bytewise (except rebuilt CE)', () => {
    const result = realizeStageForCourse(makeInput({ interventionsInWindow: [] }))
    expect(result.realized.attendancePct).toBe(result.baseline.attendancePct)
    expect(result.realized.tt1Pct).toBe(result.baseline.tt1Pct)
    expect(result.realized.tt2Pct).toBe(result.baseline.tt2Pct)
    expect(result.realized.quizPct).toBe(result.baseline.quizPct)
    expect(result.realized.assignmentPct).toBe(result.baseline.assignmentPct)
    expect(result.realized.seePct).toBe(result.baseline.seePct)
    expect(result.realized.cePct).toBe(result.baseline.cePct)
    expect(result.interventionImpact.totalImpact).toBe(0)
    expect(result.interventionImpact.appliedCount).toBe(0)
    expect(result.interventionImpact.dominantTier).toBeNull()
  })

  it('is bytewise deterministic for identical inputs', () => {
    const input = makeInput()
    const first = realizeStageForCourse(input)
    for (let i = 0; i < 10; i++) {
      expect(realizeStageForCourse(input)).toEqual(first)
    }
  })
})

describe('stage-realization-service · intervention delta application', () => {
  it('single student-facing intervention lifts realized marks vs baseline', () => {
    const input = makeInput({
      stageKey: 'post-tt2',
      interventionsInWindow: [
        makeIntervention({
          actionCode: 'targeted_remedial_plan',
          concernFamily: 'coursework',
          dominantWeaknessHint: 'coursework',
          severityContext: { riskBand: 'High', cgpa: 5.5, backlogCount: 1 },
        }),
      ],
    })
    const result = realizeStageForCourse(input)
    expect(result.interventionImpact.totalImpact).toBeGreaterThan(0)
    expect(result.realized.tt2Pct).toBeGreaterThanOrEqual(result.baseline.tt2Pct)
    expect(result.realized.quizPct).toBeGreaterThanOrEqual(result.baseline.quizPct)
    expect(result.realized.assignmentPct).toBeGreaterThanOrEqual(result.baseline.assignmentPct)
  })

  it('TT1 stays immutable (responsiveness = 0)', () => {
    const input = makeInput({
      interventionsInWindow: [
        makeIntervention({ actionCode: 'targeted_remedial_plan', stageKeyApplied: 'post-tt1' }),
      ],
    })
    const result = realizeStageForCourse(input)
    expect(result.interventionImpact.markDeltas.tt1).toBe(0)
    expect(result.realized.tt1Pct).toBe(result.baseline.tt1Pct)
  })

  it('workflow-only actions contribute zero delta to all assessments', () => {
    const input = makeInput({
      interventionsInWindow: [
        makeIntervention({ actionCode: 'faculty_followup_reminder' }),
        makeIntervention({ actionCode: 'generic_default_family_action', caseId: 'case_b' }),
      ],
    })
    const result = realizeStageForCourse(input)
    expect(result.interventionImpact.totalImpact).toBe(0)
    expect(result.interventionImpact.appliedCount).toBe(0)
    expect(result.realized.tt2Pct).toBe(result.baseline.tt2Pct)
    expect(result.realized.quizPct).toBe(result.baseline.quizPct)
  })

  it('cumulative impact capped so delta cannot exceed responsiveness ceiling', () => {
    const apps: StageRealizationInterventionInput[] = []
    for (let i = 0; i < 6; i++) {
      apps.push(makeIntervention({
        caseId: `case_${i}`,
        actionCode: 'targeted_remedial_plan',
        ordinalInStageForStudent: 1,
        semesterNumberApplied: 3,
        stageKeyApplied: 'post-tt1',
        severityContext: { riskBand: 'Low', cgpa: 8.5, backlogCount: 0 },
      }))
    }
    const result = realizeStageForCourse(makeInput({
      interventionsInWindow: apps,
      student: makeStudent({
        profile: {
          ...makeStudent().profile,
          behavior: {
            ...makeStudent().profile.behavior,
            practiceCompliance: 0.95,
          },
          intervention: {
            ...makeStudent().profile.intervention,
            interventionReceptivity: 0.95,
          },
        },
      }),
    }))
    expect(result.interventionImpact.totalImpact).toBeLessThanOrEqual(0.95)
    // tt2 responsiveness range is [-2, 14]; delta cannot exceed 14
    expect(result.interventionImpact.markDeltas.tt2).toBeLessThanOrEqual(14)
  })

  it('CE recomputes correctly when component marks shift', () => {
    const input = makeInput({
      interventionsInWindow: [
        makeIntervention({ actionCode: 'targeted_remedial_plan', severityContext: { riskBand: 'High', cgpa: 5.5, backlogCount: 1 } }),
      ],
    })
    const result = realizeStageForCourse(input)
    // New CE should equal weighted new components + baseline CE noise residual
    const expectedBaselineWeighted =
        result.baseline.tt1Pct * 0.28
      + result.baseline.tt2Pct * 0.27
      + result.baseline.quizPct * 0.2
      + result.baseline.assignmentPct * 0.25
    const baselineNoise = result.baseline.cePct - expectedBaselineWeighted
    const expectedNewWeighted =
        result.realized.tt1Pct * 0.28
      + result.realized.tt2Pct * 0.27
      + result.realized.quizPct * 0.2
      + result.realized.assignmentPct * 0.25
    const expectedCe = Math.round((expectedNewWeighted + baselineNoise) * 100) / 100
    // Clamped to [10, 97]; since baseline CE was in range, new should be close
    const clampedExpected = Math.max(10, Math.min(97, expectedCe))
    expect(result.realized.cePct).toBeCloseTo(clampedExpected, 2)
  })
})

describe('stage-realization-service · stage visibility filtering', () => {
  const student = makeStudent()
  const course = makeCourse()

  it('pre-tt1 only exposes attendance; all else null', () => {
    const result = realizeStageForCourse(makeInput({ student, course, stageKey: 'pre-tt1' }))
    expect(result.stageAssessments.attendancePct).not.toBeNull()
    expect(result.stageAssessments.tt1Pct).toBeNull()
    expect(result.stageAssessments.tt2Pct).toBeNull()
    expect(result.stageAssessments.quizPct).toBeNull()
    expect(result.stageAssessments.assignmentPct).toBeNull()
    expect(result.stageAssessments.cePct).toBeNull()
    expect(result.stageAssessments.seePct).toBeNull()
  })

  it('post-tt1 exposes attendance + tt1; not tt2/quiz/assignment/ce/see', () => {
    const result = realizeStageForCourse(makeInput({ student, course, stageKey: 'post-tt1' }))
    expect(result.stageAssessments.attendancePct).not.toBeNull()
    expect(result.stageAssessments.tt1Pct).not.toBeNull()
    expect(result.stageAssessments.tt2Pct).toBeNull()
    expect(result.stageAssessments.quizPct).toBeNull()
    expect(result.stageAssessments.assignmentPct).toBeNull()
    expect(result.stageAssessments.cePct).toBeNull()
    expect(result.stageAssessments.seePct).toBeNull()
  })

  it('post-tt2 exposes attendance + tt1 + tt2 + quiz + assignment; not ce/see', () => {
    const result = realizeStageForCourse(makeInput({ student, course, stageKey: 'post-tt2' }))
    expect(result.stageAssessments.attendancePct).not.toBeNull()
    expect(result.stageAssessments.tt1Pct).not.toBeNull()
    expect(result.stageAssessments.tt2Pct).not.toBeNull()
    expect(result.stageAssessments.quizPct).not.toBeNull()
    expect(result.stageAssessments.assignmentPct).not.toBeNull()
    expect(result.stageAssessments.cePct).toBeNull()
    expect(result.stageAssessments.seePct).toBeNull()
  })

  it('post-assignments exposes CE; not see yet', () => {
    const result = realizeStageForCourse(makeInput({ student, course, stageKey: 'post-assignments' }))
    expect(result.stageAssessments.cePct).not.toBeNull()
    expect(result.stageAssessments.seePct).toBeNull()
  })

  it('post-see exposes every assessment', () => {
    const result = realizeStageForCourse(makeInput({ student, course, stageKey: 'post-see' }))
    expect(result.stageAssessments.attendancePct).not.toBeNull()
    expect(result.stageAssessments.tt1Pct).not.toBeNull()
    expect(result.stageAssessments.tt2Pct).not.toBeNull()
    expect(result.stageAssessments.quizPct).not.toBeNull()
    expect(result.stageAssessments.assignmentPct).not.toBeNull()
    expect(result.stageAssessments.cePct).not.toBeNull()
    expect(result.stageAssessments.seePct).not.toBeNull()
  })

  it('attendance history stage truncation matches stage', () => {
    const preTt1 = realizeStageForCourse(makeInput({ student, course, stageKey: 'pre-tt1' }))
    expect(preTt1.stageAssessments.attendanceHistory[0]).not.toBeNull()
    expect(preTt1.stageAssessments.attendanceHistory[1]).toBeNull()

    const postTt2 = realizeStageForCourse(makeInput({ student, course, stageKey: 'post-tt2' }))
    expect(postTt2.stageAssessments.attendanceHistory[0]).not.toBeNull()
    expect(postTt2.stageAssessments.attendanceHistory[1]).not.toBeNull()
    expect(postTt2.stageAssessments.attendanceHistory[2]).not.toBeNull()
    expect(postTt2.stageAssessments.attendanceHistory[3]).toBeNull()

    const postSee = realizeStageForCourse(makeInput({ student, course, stageKey: 'post-see' }))
    expect(postSee.stageAssessments.attendanceHistory.every(entry => entry !== null)).toBe(true)
  })
})

describe('stage-realization-service · realizeStageForStudent multi-course', () => {
  it('delegates to realizeStageForCourse per course with scoped interventions', () => {
    const courseA = makeCourse({ internalCompilerId: 'course_a', title: 'Algorithms' })
    const courseB = makeCourse({ internalCompilerId: 'course_b', title: 'Databases' })
    const student = makeStudent()
    const results = realizeStageForStudent({
      runId: 'run_multi',
      runSeed: 7777,
      student,
      courses: [courseA, courseB],
      semesterNumber: 4,
      stageKey: 'post-tt2',
      facultyId: 'faculty_y',
      scoresByCourseTitle: new Map(),
      interventionsByCourseCompilerId: new Map([
        ['course_a', [makeIntervention({
          actionCode: 'structured_study_plan',
          severityContext: { riskBand: 'High', cgpa: 5.0, backlogCount: 1 },
        })]],
        // course_b has no interventions
      ]),
    })
    expect(results).toHaveLength(2)
    // course_a has intervention -> delta > 0
    expect(results[0]!.interventionImpact.totalImpact).toBeGreaterThan(0)
    // course_b has no intervention -> delta = 0
    expect(results[1]!.interventionImpact.totalImpact).toBe(0)
  })

  it('is deterministic across reruns', () => {
    const courseA = makeCourse({ internalCompilerId: 'course_a' })
    const courseB = makeCourse({ internalCompilerId: 'course_b' })
    const input = {
      runId: 'run_det',
      runSeed: 1234,
      student: makeStudent(),
      courses: [courseA, courseB],
      semesterNumber: 3,
      stageKey: 'post-tt2' as const,
      facultyId: 'fac',
      scoresByCourseTitle: new Map<string, number>(),
      interventionsByCourseCompilerId: new Map<string, StageRealizationInterventionInput[]>([
        ['course_a', [makeIntervention()]],
      ]),
    }
    const first = realizeStageForStudent(input)
    for (let i = 0; i < 5; i++) {
      expect(realizeStageForStudent(input)).toEqual(first)
    }
  })
})

describe('stage-realization-service · metadata', () => {
  it('carries runSeed, stageKey, courseCompilerId, flagEnabledAtCaller', () => {
    const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]
    delete process.env[STAGE_REALIZATION_FLAG_NAME]
    try {
      const result = realizeStageForCourse(makeInput({ runSeed: 42 }))
      expect(result.metadata.runSeed).toBe(42)
      expect(result.metadata.stageKey).toBe('post-tt2')
      expect(result.metadata.courseCompilerId).toBe('course_algorithms')
      expect(result.metadata.flagEnabledAtCaller).toBe(false)
      process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
      const enabled = realizeStageForCourse(makeInput())
      expect(enabled.metadata.flagEnabledAtCaller).toBe(true)
    } finally {
      if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
      else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
    }
  })
})
