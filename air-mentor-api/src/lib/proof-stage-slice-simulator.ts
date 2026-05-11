// Stage-slice simulator — per-assessment pure-fn helpers extracted from the monolithic
// simulateSemesterCourse() in msruas-proof-control-plane.ts.
//
// The existing simulateSemesterCourse computes ALL of a course's marks (tt1, tt2, quiz,
// assignment, attendance, ce, see, grade) in one pass at run activation time. Phase B of
// the world-realism-and-intervention plan requires per-stage realization: tt1 is computed
// when the pre-tt1 -> post-tt1 boundary is crossed, tt2 when post-tt1 -> post-tt2 is
// crossed, and so on.
//
// This module exposes each mark formula as an independent pure function. The formulas
// are byte-identical to the originals so the new stage-realization service can produce
// a baseline trajectory that exactly matches what simulateSemesterCourse would have
// produced, and then layer intervention deltas on top.
//
// No DB. No wall-clock. Every output is a deterministic function of the seed and the
// numeric inputs. The seeds are identical to those used in msruas-proof-control-plane.ts,
// which means the simulator can replay exactly the same evidence the activation pipeline
// would have produced for any given (runSeed, studentId, courseId, semesterNumber).

import type {
  CourseForSimulation,
  StudentTrajectoryForSimulation,
} from './proof-intervention-response-types.js'

// ---------- Pure utility helpers (local copies; keeps this module standalone) ----------

export function stableUnit(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

export function stableBetween(seed: string, min: number, max: number): number {
  return min + stableUnit(seed) * (max - min)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// ---------- Course shape helpers ----------

export function isLabLikeCourse(course: Pick<CourseForSimulation, 'title' | 'assessmentProfile'>): boolean {
  const haystack = `${course.title} ${course.assessmentProfile}`.toLowerCase()
  return haystack.includes('lab') || haystack.includes('project') || haystack.includes('workshop')
}

export type CourseEmphasis = { mathWeight: number; computingWeight: number }

export function computeCourseEmphasis(course: Pick<CourseForSimulation, 'title'>): CourseEmphasis {
  const lower = course.title.toLowerCase()
  const mathHeavy = ['mathematics', 'algebra', 'probability', 'statistics', 'optimization', 'numerical', 'analysis', 'computation'].some(token => lower.includes(token))
  const computingHeavy = ['programming', 'computer', 'database', 'operating', 'network', 'software', 'algorithm', 'machine', 'data', 'distributed', 'logic', 'intelligence'].some(token => lower.includes(token))
  return {
    mathWeight: mathHeavy ? 0.7 : computingHeavy ? 0.35 : 0.5,
    computingWeight: computingHeavy ? 0.72 : mathHeavy ? 0.34 : 0.5,
  }
}

// Weighted average of prerequisite course scores on 0-100 scale, normalized to [0, 1].
// Returns 0.58 (a bland mid-level default) when no prior scores are available yet.
export function computePrerequisiteAverage(
  course: Pick<CourseForSimulation, 'explicitPrerequisites' | 'addedPrerequisites'>,
  scoresByCourseTitle: Map<string, number>,
): number {
  const signals = [...course.explicitPrerequisites, ...course.addedPrerequisites]
    .map(title => scoresByCourseTitle.get(title))
    .filter((value): value is number => typeof value === 'number')
  if (signals.length === 0) return 0.58
  return clamp(signals.reduce((sum, value) => sum + value, 0) / (signals.length * 100), 0.2, 0.95)
}

// ---------- Seed builders (byte-identical to msruas-proof-control-plane.ts) ----------

export function teacherEffectSeed(
  facultyId: string,
  course: Pick<CourseForSimulation, 'internalCompilerId'>,
  sectionCode: 'A' | 'B',
  runSeed: number,
): string {
  return `run-${runSeed}-${facultyId}-${course.internalCompilerId}-${sectionCode}`
}

export function difficultySeed(
  student: Pick<StudentTrajectoryForSimulation, 'studentId'>,
  course: Pick<CourseForSimulation, 'internalCompilerId'>,
  runSeed: number,
): string {
  return `run-${runSeed}-${student.studentId}-${course.internalCompilerId}-difficulty`
}

function assessmentSeed(
  student: Pick<StudentTrajectoryForSimulation, 'studentId'>,
  course: Pick<CourseForSimulation, 'internalCompilerId'>,
  runSeed: number,
  key: string,
): string {
  return `run-${runSeed}-${student.studentId}-${course.internalCompilerId}-${key}`
}

// ---------- Teacher effect ----------

export function computeTeacherEffect(
  facultyId: string,
  course: Pick<CourseForSimulation, 'internalCompilerId'>,
  sectionCode: 'A' | 'B',
  runSeed: number,
): number {
  return stableBetween(teacherEffectSeed(facultyId, course, sectionCode, runSeed), -0.06, 0.08)
}

// ---------- Difficulty ----------

export function computeCourseDifficulty(input: {
  student: Pick<StudentTrajectoryForSimulation, 'studentId'>
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  semesterNumber: number
  runSeed: number
}): number {
  const noise = stableBetween(difficultySeed(input.student, input.course, input.runSeed), -0.03, 0.05)
  return 0.28 + input.semesterNumber * 0.05 + noise
}

// ---------- Mastery (latent summary) ----------

export function computeMastery(input: {
  student: StudentTrajectoryForSimulation
  emphasis: CourseEmphasis
  prereq: number
  teaching: number
  difficulty: number
}): number {
  const base = input.student.latentBase
  const profile = input.student.profile
  const raw =
      base.academicPotential * 0.32
    + base.mathematicsFoundation * input.emphasis.mathWeight * 0.24
    + base.computingFoundation * input.emphasis.computingWeight * 0.24
    + base.selfRegulation * 0.12
    + base.supportResponsiveness * 0.08
    + profile.readiness.logicReadiness * 0.06
    + profile.readiness.statsReadiness * 0.05
    + input.prereq * 0.18
    + input.teaching
    - input.difficulty * 0.22
    + 0.06
  return clamp(raw, 0.22, 0.96)
}

// ---------- Attendance % ----------

export function computeAttendancePct(input: {
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  difficulty: number
  runSeed: number
}): number {
  const base = input.student.latentBase
  const profile = input.student.profile
  const raw = 58
    + base.attendanceDiscipline * 30
    + base.selfRegulation * 8
    + base.supportResponsiveness * 4
    + profile.behavior.attendancePropensity * 6
    - input.difficulty * 8
    + stableBetween(assessmentSeed(input.student, input.course, input.runSeed, 'attendance'), -7, 9)
  return clamp(Math.round(raw), 52, 98)
}

// ---------- Attendance history per checkpoint (wk4 / wk8 / wk12 / wk16) ----------

export type AttendanceHistoryEntry = {
  checkpoint: 'wk4' | 'wk8' | 'wk12' | 'wk16'
  checkpointLabel: string
  presentClasses: number
  totalClasses: number
  attendancePct: number
}

const ATTENDANCE_CHECKPOINTS: ReadonlyArray<{ checkpoint: AttendanceHistoryEntry['checkpoint']; checkpointLabel: string; totalClasses: number }> = [
  { checkpoint: 'wk4', checkpointLabel: 'Week 4', totalClasses: 8 },
  { checkpoint: 'wk8', checkpointLabel: 'Week 8', totalClasses: 16 },
  { checkpoint: 'wk12', checkpointLabel: 'Week 12', totalClasses: 24 },
  { checkpoint: 'wk16', checkpointLabel: 'Week 16', totalClasses: 32 },
]

// Stage -> index-to-materialize map. pre-tt1 realizes wk4; post-tt1 realizes wk8;
// post-tt2 realizes wk12; post-assignments realizes wk16; post-see keeps wk16.
export const ATTENDANCE_STAGE_CHECKPOINT_INDEX: Readonly<Record<
  'pre-tt1' | 'post-tt1' | 'post-tt2' | 'post-assignments' | 'post-see',
  number
>> = {
  'pre-tt1': 0,
  'post-tt1': 1,
  'post-tt2': 2,
  'post-assignments': 3,
  'post-see': 3,
}

export function computeAttendanceHistory(input: {
  attendancePct: number
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  semesterNumber: number
  runSeed: number
}): AttendanceHistoryEntry[] {
  return ATTENDANCE_CHECKPOINTS.map((checkpoint, index) => {
    const drift = stableBetween(
      `run-${input.runSeed}-${input.student.studentId}-${input.course.internalCompilerId}-${input.semesterNumber}-${checkpoint.checkpoint}`,
      -4 - index,
      4,
    )
    const pct = clamp(
      Math.round(
        input.attendancePct
          + drift
          + (index - 1.5) * 1.4 * (input.student.profile.behavior.attendancePropensity - 0.5),
      ),
      48,
      99,
    )
    return {
      checkpoint: checkpoint.checkpoint,
      checkpointLabel: checkpoint.checkpointLabel,
      presentClasses: Math.round((pct / 100) * checkpoint.totalClasses),
      totalClasses: checkpoint.totalClasses,
      attendancePct: pct,
    }
  })
}

// Attendance history slice for a given stage. Checkpoints after the stage's index are
// left as `null` so callers can distinguish "not yet realized" from "realized zero".
export function computeAttendanceHistoryForStage(input: {
  attendancePct: number
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  semesterNumber: number
  runSeed: number
  stageKey: keyof typeof ATTENDANCE_STAGE_CHECKPOINT_INDEX
}): Array<AttendanceHistoryEntry | null> {
  const full = computeAttendanceHistory({
    attendancePct: input.attendancePct,
    student: input.student,
    course: input.course,
    semesterNumber: input.semesterNumber,
    runSeed: input.runSeed,
  })
  const lastIdx = ATTENDANCE_STAGE_CHECKPOINT_INDEX[input.stageKey]
  return full.map((entry, idx) => (idx <= lastIdx ? entry : null))
}

// ---------- Term tests ----------

export function computeTT1Pct(input: {
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  mastery: number
  difficulty: number
  runSeed: number
}): number {
  const profile = input.student.profile
  const raw = 24
    + input.mastery * 42
    + profile.assessment.termTestApplicationStrength * 16
    + profile.behavior.practiceCompliance * 8
    - profile.behavior.examPressure * 12
    - input.difficulty * 7
    + stableBetween(assessmentSeed(input.student, input.course, input.runSeed, 'tt1'), -14, 12)
  return clamp(roundTo(raw, 2), 8, 97)
}

// TT2 is modelled as tt1 + (relearn/help) - forget + noise. This matches the intuition
// that by TT2 the student has had a chance to recover from TT1 weaknesses (relearn) or
// slipped further (forget). Intervention deltas that shift tt1 therefore propagate
// downstream through this formula in the baseline, which is correct behaviour.
export function computeTT2PctFromTT1(input: {
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  tt1Pct: number
  runSeed: number
}): number {
  const dynamics = input.student.profile.dynamics
  const behavior = input.student.profile.behavior
  const raw = input.tt1Pct
    + dynamics.relearnRate * 8
    + behavior.helpSeekingTendency * 5
    - dynamics.forgetRate * 4
    + stableBetween(assessmentSeed(input.student, input.course, input.runSeed, 'tt2'), -12, 14)
  return clamp(roundTo(raw, 2), 8, 99)
}

// ---------- Quiz ----------

export function computeQuizPct(input: {
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  mastery: number
  difficulty: number
  runSeed: number
}): number {
  const profile = input.student.profile
  const raw = 22
    + input.mastery * 38
    + profile.assessment.quizRecallStrength * 20
    + profile.behavior.selfCheckTendency * 7
    - input.difficulty * 5
    + stableBetween(assessmentSeed(input.student, input.course, input.runSeed, 'quiz'), -14, 12)
  return clamp(roundTo(raw, 2), 8, 99)
}

// ---------- Assignment (uses labExecutionStrength for lab-like courses, else assignmentCompletionStrength) ----------

export function computeAssignmentPct(input: {
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId' | 'title' | 'assessmentProfile'>
  mastery: number
  difficulty: number
  runSeed: number
}): number {
  const profile = input.student.profile
  const assignmentBase = isLabLikeCourse(input.course)
    ? profile.assessment.labExecutionStrength
    : profile.assessment.assignmentCompletionStrength
  const raw = 24
    + input.mastery * 34
    + assignmentBase * 18
    + profile.behavior.deadlineDiscipline * 8
    + profile.behavior.courseworkReliability * 6
    - input.difficulty * 4
    + stableBetween(assessmentSeed(input.student, input.course, input.runSeed, 'assignment'), -12, 12)
  return clamp(roundTo(raw, 2), 10, 99)
}

// ---------- CE (weighted combination) ----------

export function computeCePct(input: {
  student: Pick<StudentTrajectoryForSimulation, 'studentId'>
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
  runSeed: number
}): number {
  const raw = input.tt1Pct * 0.28
    + input.tt2Pct * 0.27
    + input.quizPct * 0.2
    + input.assignmentPct * 0.25
    + stableBetween(assessmentSeed(input.student, input.course, input.runSeed, 'ce'), -6, 6)
  return clamp(roundTo(raw, 2), 10, 97)
}

// ---------- SEE ----------

export function computeSeePct(input: {
  student: StudentTrajectoryForSimulation
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  mastery: number
  difficulty: number
  runSeed: number
}): number {
  const profile = input.student.profile
  const raw = 18
    + input.mastery * 46
    + profile.assessment.seeEndurance * 18
    + profile.dynamics.transferGainRate * 10
    - profile.behavior.examPressure * 10
    - input.difficulty * 9
    + stableBetween(assessmentSeed(input.student, input.course, input.runSeed, 'see'), -14, 12)
  return clamp(roundTo(raw, 2), 8, 98)
}

// ---------- Condonation coin flip ----------

// Matches the existing condonation rule: 42% probability of being condoned when
// attendance is below policy minimum but above the condonation floor.
export function shouldCondone(input: {
  student: Pick<StudentTrajectoryForSimulation, 'studentId'>
  course: Pick<CourseForSimulation, 'internalCompilerId'>
  runSeed: number
}): boolean {
  return stableUnit(assessmentSeed(input.student, input.course, input.runSeed, 'condonation')) > 0.42
}

// ---------- Aggregate helpers (convenience for callers that want the full bundle) ----------

export type StageSliceBundle = {
  mastery: number
  prereq: number
  teaching: number
  difficulty: number
  attendancePct: number
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
  cePct: number
  seePct: number
  courseworkToTtGap: number
  ttMomentum: number
  prerequisiteCarryoverRisk: number
}

// Bundle that reproduces the same core fields simulateSemesterCourse returns, using
// only the slice functions above. Useful for cross-validation tests and for the
// stage-realization baseline path where no intervention has been applied yet.
export function computeStageSliceBundle(input: {
  student: StudentTrajectoryForSimulation
  course: CourseForSimulation
  semesterNumber: number
  scoresByCourseTitle: Map<string, number>
  facultyId: string
  runSeed: number
}): StageSliceBundle {
  const emphasis = computeCourseEmphasis(input.course)
  const prereq = computePrerequisiteAverage(input.course, input.scoresByCourseTitle)
  const teaching = computeTeacherEffect(input.facultyId, input.course, input.student.sectionCode, input.runSeed)
  const difficulty = computeCourseDifficulty({
    student: input.student,
    course: input.course,
    semesterNumber: input.semesterNumber,
    runSeed: input.runSeed,
  })
  const mastery = computeMastery({ student: input.student, emphasis, prereq, teaching, difficulty })
  const attendancePct = computeAttendancePct({
    student: input.student,
    course: input.course,
    difficulty,
    runSeed: input.runSeed,
  })
  const tt1Pct = computeTT1Pct({ student: input.student, course: input.course, mastery, difficulty, runSeed: input.runSeed })
  const tt2Pct = computeTT2PctFromTT1({ student: input.student, course: input.course, tt1Pct, runSeed: input.runSeed })
  const quizPct = computeQuizPct({ student: input.student, course: input.course, mastery, difficulty, runSeed: input.runSeed })
  const assignmentPct = computeAssignmentPct({
    student: input.student,
    course: input.course,
    mastery,
    difficulty,
    runSeed: input.runSeed,
  })
  const cePct = computeCePct({
    student: input.student,
    course: input.course,
    tt1Pct,
    tt2Pct,
    quizPct,
    assignmentPct,
    runSeed: input.runSeed,
  })
  const seePct = computeSeePct({
    student: input.student,
    course: input.course,
    mastery,
    difficulty,
    runSeed: input.runSeed,
  })
  return {
    mastery: roundTo(mastery, 2),
    prereq: roundTo(prereq, 2),
    teaching: roundTo(teaching, 2),
    difficulty: roundTo(difficulty, 2),
    attendancePct,
    tt1Pct,
    tt2Pct,
    quizPct,
    assignmentPct,
    cePct,
    seePct,
    courseworkToTtGap: roundTo(((quizPct + assignmentPct) / 2) - ((tt1Pct + tt2Pct) / 2), 2),
    ttMomentum: roundTo(tt2Pct - tt1Pct, 2),
    prerequisiteCarryoverRisk: roundTo(clamp((1 - prereq) + difficulty * 0.18 - mastery * 0.12, 0.02, 0.92), 2),
  }
}
