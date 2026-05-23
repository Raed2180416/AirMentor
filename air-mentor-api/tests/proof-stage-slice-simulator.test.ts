import { describe, expect, it } from 'vitest'
import {
  ATTENDANCE_STAGE_CHECKPOINT_INDEX,
  computeAssignmentPct,
  computeAttendanceHistory,
  computeAttendanceHistoryForStage,
  computeAttendancePct,
  computeCePct,
  computeCourseDifficulty,
  computeCourseEmphasis,
  computeMastery,
  computePrerequisiteAverage,
  computeQuizPct,
  computeSeePct,
  computeStageSliceBundle,
  computeTT1Pct,
  computeTT2PctFromTT1,
  computeTeacherEffect,
  isLabLikeCourse,
  shouldCondone,
  stableBetween,
  stableUnit,
} from '../src/lib/proof-stage-slice-simulator.js'
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
      externalWorkObligation: 0,
      commuteStress: 0,
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

describe('stage-slice-simulator · pure seed helpers', () => {
  it('stableUnit is deterministic', () => {
    expect(stableUnit('seed-a')).toBe(stableUnit('seed-a'))
    expect(stableUnit('seed-a')).not.toBe(stableUnit('seed-b'))
  })

  it('stableBetween returns values in [min, max)', () => {
    for (let i = 0; i < 1000; i++) {
      const value = stableBetween(`s-${i}`, -5, 12)
      expect(value).toBeGreaterThanOrEqual(-5)
      expect(value).toBeLessThanOrEqual(12)
    }
  })
})

describe('stage-slice-simulator · course shape helpers', () => {
  it('isLabLikeCourse detects lab/project/workshop in title or assessmentProfile', () => {
    expect(isLabLikeCourse({ title: 'Data Structures Lab', assessmentProfile: '' })).toBe(true)
    expect(isLabLikeCourse({ title: 'Capstone Project', assessmentProfile: '' })).toBe(true)
    expect(isLabLikeCourse({ title: 'Computer Science', assessmentProfile: 'workshop' })).toBe(true)
    expect(isLabLikeCourse({ title: 'Mathematics', assessmentProfile: 'tt1,tt2,see' })).toBe(false)
  })

  it('computeCourseEmphasis: math-heavy course -> high mathWeight', () => {
    const result = computeCourseEmphasis({ title: 'Applied Mathematics for Computing' })
    expect(result.mathWeight).toBe(0.7)
    expect(result.computingWeight).toBe(0.34)
  })

  it('computeCourseEmphasis: computing-heavy course -> high computingWeight', () => {
    const result = computeCourseEmphasis({ title: 'Database Management Systems' })
    expect(result.computingWeight).toBe(0.72)
    expect(result.mathWeight).toBe(0.35)
  })

  it('computeCourseEmphasis: neutral course -> balanced weights', () => {
    const result = computeCourseEmphasis({ title: 'Introduction to Humanities' })
    expect(result.mathWeight).toBe(0.5)
    expect(result.computingWeight).toBe(0.5)
  })
})

describe('stage-slice-simulator · prerequisite average', () => {
  it('empty prior scores -> 0.58 default', () => {
    const course = makeCourse({ explicitPrerequisites: ['Algebra'], addedPrerequisites: [] })
    expect(computePrerequisiteAverage(course, new Map())).toBe(0.58)
  })

  it('available prior scores: weighted normalized 0-1 value', () => {
    const course = makeCourse({ explicitPrerequisites: ['Algebra', 'Discrete Math'], addedPrerequisites: [] })
    const scores = new Map<string, number>([['Algebra', 80], ['Discrete Math', 60]])
    expect(computePrerequisiteAverage(course, scores)).toBeCloseTo(0.7, 4)
  })

  it('clamps to [0.2, 0.95]', () => {
    const course = makeCourse({ explicitPrerequisites: ['Toy'], addedPrerequisites: [] })
    const highScores = new Map<string, number>([['Toy', 99]])
    expect(computePrerequisiteAverage(course, highScores)).toBeLessThanOrEqual(0.95)
    const lowScores = new Map<string, number>([['Toy', 5]])
    expect(computePrerequisiteAverage(course, lowScores)).toBeGreaterThanOrEqual(0.2)
  })
})

describe('stage-slice-simulator · deterministic multi-fn scalar outputs', () => {
  it('computeCourseDifficulty is deterministic + rises with semester', () => {
    const student = makeStudent()
    const course = makeCourse()
    const s1 = computeCourseDifficulty({ student, course, semesterNumber: 1, runSeed: 42 })
    const s3 = computeCourseDifficulty({ student, course, semesterNumber: 3, runSeed: 42 })
    const s6 = computeCourseDifficulty({ student, course, semesterNumber: 6, runSeed: 42 })
    expect(s1).toBeLessThan(s3)
    expect(s3).toBeLessThan(s6)
    // determinism
    expect(computeCourseDifficulty({ student, course, semesterNumber: 3, runSeed: 42 })).toBe(s3)
  })

  it('computeTeacherEffect is in [-0.06, 0.08]', () => {
    const course = makeCourse()
    for (let i = 0; i < 50; i++) {
      const effect = computeTeacherEffect(`faculty_${i}`, course, i % 2 === 0 ? 'A' : 'B', 42)
      expect(effect).toBeGreaterThanOrEqual(-0.06)
      expect(effect).toBeLessThanOrEqual(0.08)
    }
  })

  it('computeMastery clamps to [0.22, 0.96]', () => {
    const weakStudent = makeStudent({
      latentBase: {
        academicPotential: 0.2,
        mathematicsFoundation: 0.2,
        computingFoundation: 0.2,
        selfRegulation: 0.2,
        attendanceDiscipline: 0.2,
        supportResponsiveness: 0.2,
        externalWorkObligation: 0.2,
        commuteStress: 0.2,
      },
    })
    const strongStudent = makeStudent({
      latentBase: {
        academicPotential: 0.95,
        mathematicsFoundation: 0.95,
        computingFoundation: 0.95,
        selfRegulation: 0.95,
        attendanceDiscipline: 0.95,
        supportResponsiveness: 0.95,
        externalWorkObligation: 0.1,
        commuteStress: 0.1,
      },
    })
    const emphasis = computeCourseEmphasis({ title: 'Algorithms' })
    const weakMastery = computeMastery({ student: weakStudent, emphasis, prereq: 0.2, teaching: 0, difficulty: 0.5 })
    const strongMastery = computeMastery({ student: strongStudent, emphasis, prereq: 0.95, teaching: 0.08, difficulty: 0.28 })
    expect(weakMastery).toBeGreaterThanOrEqual(0.22)
    expect(weakMastery).toBeLessThan(0.5)
    expect(strongMastery).toBeLessThanOrEqual(0.96)
    expect(strongMastery).toBeGreaterThan(0.75)
  })
})

describe('stage-slice-simulator · per-assessment fns', () => {
  const student = makeStudent()
  const course = makeCourse()
  const runSeed = 1234

  it('computeAttendancePct in [52, 98]', () => {
    const pct = computeAttendancePct({ student, course, difficulty: 0.5, runSeed })
    expect(pct).toBeGreaterThanOrEqual(52)
    expect(pct).toBeLessThanOrEqual(98)
    // determinism
    expect(computeAttendancePct({ student, course, difficulty: 0.5, runSeed })).toBe(pct)
  })

  it('computeTT1Pct in [8, 97]', () => {
    for (let sem = 1; sem <= 6; sem++) {
      const diff = computeCourseDifficulty({ student, course, semesterNumber: sem, runSeed })
      const emphasis = computeCourseEmphasis(course)
      const mastery = computeMastery({ student, emphasis, prereq: 0.6, teaching: 0.02, difficulty: diff })
      const tt1 = computeTT1Pct({ student, course, mastery, difficulty: diff, runSeed })
      expect(tt1).toBeGreaterThanOrEqual(8)
      expect(tt1).toBeLessThanOrEqual(97)
    }
  })

  it('computeTT2PctFromTT1 in [8, 99] and responds to tt1 anchor', () => {
    const tt2Low = computeTT2PctFromTT1({ student, course, tt1Pct: 20, runSeed })
    const tt2High = computeTT2PctFromTT1({ student, course, tt1Pct: 80, runSeed })
    expect(tt2Low).toBeGreaterThanOrEqual(8)
    expect(tt2High).toBeLessThanOrEqual(99)
    // High tt1 anchor should pull tt2 higher
    expect(tt2High).toBeGreaterThan(tt2Low)
  })

  it('computeQuizPct + computeAssignmentPct + computeCePct + computeSeePct all deterministic + bounded', () => {
    const emphasis = computeCourseEmphasis(course)
    const diff = computeCourseDifficulty({ student, course, semesterNumber: 3, runSeed })
    const mastery = computeMastery({ student, emphasis, prereq: 0.6, teaching: 0.03, difficulty: diff })
    const tt1 = computeTT1Pct({ student, course, mastery, difficulty: diff, runSeed })
    const tt2 = computeTT2PctFromTT1({ student, course, tt1Pct: tt1, runSeed })
    const quiz = computeQuizPct({ student, course, mastery, difficulty: diff, runSeed })
    const assignment = computeAssignmentPct({ student, course, mastery, difficulty: diff, runSeed })
    const ce = computeCePct({ student, course, tt1Pct: tt1, tt2Pct: tt2, quizPct: quiz, assignmentPct: assignment, runSeed })
    const see = computeSeePct({ student, course, mastery, difficulty: diff, runSeed })
    expect(quiz).toBeGreaterThanOrEqual(8); expect(quiz).toBeLessThanOrEqual(99)
    expect(assignment).toBeGreaterThanOrEqual(10); expect(assignment).toBeLessThanOrEqual(99)
    expect(ce).toBeGreaterThanOrEqual(10); expect(ce).toBeLessThanOrEqual(97)
    expect(see).toBeGreaterThanOrEqual(8); expect(see).toBeLessThanOrEqual(98)
    // determinism: exact same inputs -> exact same values
    const quiz2 = computeQuizPct({ student, course, mastery, difficulty: diff, runSeed })
    expect(quiz2).toBe(quiz)
  })

  it('lab-like course uses labExecutionStrength for assignment', () => {
    const labStudent = makeStudent({
      profile: {
        ...makeStudent().profile,
        assessment: {
          ...makeStudent().profile.assessment,
          labExecutionStrength: 0.9,
          assignmentCompletionStrength: 0.1,
        },
      },
    })
    const labCourse = makeCourse({ title: 'Data Structures Lab', assessmentProfile: 'rubric' })
    const normalCourse = makeCourse({ title: 'Algorithms Theory', assessmentProfile: 'tt' })
    const labAssign = computeAssignmentPct({ student: labStudent, course: labCourse, mastery: 0.6, difficulty: 0.4, runSeed: 42 })
    const normalAssign = computeAssignmentPct({ student: labStudent, course: normalCourse, mastery: 0.6, difficulty: 0.4, runSeed: 42 })
    // Lab student with 0.9 labExecution should score higher on lab course than on
    // the non-lab course (where we fall back to 0.1 assignmentCompletion).
    expect(labAssign).toBeGreaterThan(normalAssign)
  })
})

describe('stage-slice-simulator · attendance history', () => {
  const student = makeStudent()
  const course = makeCourse()
  const runSeed = 99

  it('computeAttendanceHistory produces 4 checkpoints (wk4/wk8/wk12/wk16)', () => {
    const history = computeAttendanceHistory({
      attendancePct: 80,
      student,
      course,
      semesterNumber: 2,
      runSeed,
    })
    expect(history).toHaveLength(4)
    expect(history.map(h => h.checkpoint)).toEqual(['wk4', 'wk8', 'wk12', 'wk16'])
    for (const entry of history) {
      expect(entry.attendancePct).toBeGreaterThanOrEqual(48)
      expect(entry.attendancePct).toBeLessThanOrEqual(99)
      expect(entry.presentClasses).toBeLessThanOrEqual(entry.totalClasses)
    }
  })

  it('computeAttendanceHistoryForStage truncates to stage-appropriate slice', () => {
    const preTt1Slice = computeAttendanceHistoryForStage({
      attendancePct: 80,
      student,
      course,
      semesterNumber: 2,
      runSeed,
      stageKey: 'pre-tt1',
    })
    expect(preTt1Slice[0]).not.toBeNull()
    expect(preTt1Slice[1]).toBeNull()
    expect(preTt1Slice[2]).toBeNull()
    expect(preTt1Slice[3]).toBeNull()

    const postTt2Slice = computeAttendanceHistoryForStage({
      attendancePct: 80,
      student,
      course,
      semesterNumber: 2,
      runSeed,
      stageKey: 'post-tt2',
    })
    expect(postTt2Slice[0]).not.toBeNull()
    expect(postTt2Slice[1]).not.toBeNull()
    expect(postTt2Slice[2]).not.toBeNull()
    expect(postTt2Slice[3]).toBeNull()

    const postSeeSlice = computeAttendanceHistoryForStage({
      attendancePct: 80,
      student,
      course,
      semesterNumber: 2,
      runSeed,
      stageKey: 'post-see',
    })
    expect(postSeeSlice.every(entry => entry !== null)).toBe(true)
  })

  it('ATTENDANCE_STAGE_CHECKPOINT_INDEX mapping is contiguous and monotonic', () => {
    expect(ATTENDANCE_STAGE_CHECKPOINT_INDEX['pre-tt1']).toBe(0)
    expect(ATTENDANCE_STAGE_CHECKPOINT_INDEX['post-tt1']).toBe(1)
    expect(ATTENDANCE_STAGE_CHECKPOINT_INDEX['post-tt2']).toBe(2)
    expect(ATTENDANCE_STAGE_CHECKPOINT_INDEX['post-assignments']).toBe(3)
    expect(ATTENDANCE_STAGE_CHECKPOINT_INDEX['post-see']).toBe(3)
  })
})

describe('stage-slice-simulator · condonation', () => {
  it('shouldCondone is deterministic + split ~58/42 across a cohort', () => {
    let condoneCount = 0
    for (let i = 0; i < 500; i++) {
      const s = makeStudent({ studentId: `s_${i}` })
      const c = makeCourse({ internalCompilerId: `c_${i}` })
      if (shouldCondone({ student: s, course: c, runSeed: 42 })) condoneCount += 1
    }
    // Expect ~58% condonation rate (threshold > 0.42 on unit)
    const rate = condoneCount / 500
    expect(rate).toBeGreaterThan(0.48)
    expect(rate).toBeLessThan(0.68)
  })
})

describe('stage-slice-simulator · computeStageSliceBundle', () => {
  const student = makeStudent()
  const course = makeCourse()

  it('returns bundle with all numeric fields populated', () => {
    const bundle = computeStageSliceBundle({
      student,
      course,
      semesterNumber: 3,
      scoresByCourseTitle: new Map([['Algebra', 72]]),
      facultyId: 'faculty_x',
      runSeed: 9999,
    })
    const keys = Object.keys(bundle)
    expect(keys).toContain('mastery')
    expect(keys).toContain('attendancePct')
    expect(keys).toContain('tt1Pct')
    expect(keys).toContain('tt2Pct')
    expect(keys).toContain('quizPct')
    expect(keys).toContain('assignmentPct')
    expect(keys).toContain('cePct')
    expect(keys).toContain('seePct')
    expect(keys).toContain('courseworkToTtGap')
    expect(keys).toContain('ttMomentum')
    expect(keys).toContain('prerequisiteCarryoverRisk')
    for (const value of Object.values(bundle)) expect(Number.isFinite(value)).toBe(true)
  })

  it('is bytewise deterministic', () => {
    const input = {
      student,
      course,
      semesterNumber: 3,
      scoresByCourseTitle: new Map<string, number>([['Algebra', 72]]),
      facultyId: 'faculty_x',
      runSeed: 9999,
    }
    const first = computeStageSliceBundle(input)
    for (let i = 0; i < 20; i++) {
      expect(computeStageSliceBundle(input)).toEqual(first)
    }
  })

  it('teacher effect (unrounded) varies by section code', () => {
    // Only teacherEffect seed includes the section code; every other downstream seed
    // is student-scoped. So the section-sensitivity invariant lives on teacherEffect.
    // We compare the unrounded raw values (bundle rounds to 2 places, which can
    // coincidentally collide across the 14-bucket teacher-effect range).
    const tA = computeTeacherEffect('faculty_x', course, 'A', 9999)
    const tB = computeTeacherEffect('faculty_x', course, 'B', 9999)
    expect(tA).not.toBe(tB)
  })
})
