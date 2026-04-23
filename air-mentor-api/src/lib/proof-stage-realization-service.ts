// Stage-realization orchestrator — combines slice-simulator (per-assessment baselines),
// intervention-response-engine (Section H impact), and world-realism-engine (mark deltas)
// into a single pure-service entry point that produces the realized marks for a single
// (student, course, stage) triple.
//
// Pure service: no DB writes, no wall-clock, no network. The Phase 5/6 activation and
// advance-service integrations invoke this service with loaded state, then persist the
// result via drizzle.
//
// Determinism: for any (runSeed, studentId, course, stage, intervention list) the output
// is a bytewise-stable function of the inputs. The intervention list is ordered by the
// caller; the engine respects that order for repeat-penalty ordinals.
//
// Feature flag: AIRMENTOR_STAGE_REALIZATION_V1=1 enables the per-stage realization path
// at the integration layer. This module itself is flag-neutral — it only exposes a
// helper `isStageRealizationEnabled()` for callers. The service always computes a
// correct realization whether or not the flag is set.

import type {
  AssessmentType,
  InterventionApplication,
  InterventionImpactTier,
  InterventionStageKey,
  StudentTrajectoryForSimulation,
  CourseForSimulation,
  StudentLatentProfileForIntervention,
} from './proof-intervention-response-types.js'
import {
  sumInterventionImpacts,
} from './proof-intervention-response-engine.js'
import {
  computeMarkDelta,
  ASSESSMENT_BOUNDS,
} from './proof-world-realism-engine.js'
import {
  computeStageSliceBundle,
  computeAttendanceHistoryForStage,
  type AttendanceHistoryEntry,
  type StageSliceBundle,
} from './proof-stage-slice-simulator.js'

// ---------- Feature flag ----------

export const STAGE_REALIZATION_FLAG_NAME = 'AIRMENTOR_STAGE_REALIZATION_V1'

export function isStageRealizationEnabled(): boolean {
  return process.env[STAGE_REALIZATION_FLAG_NAME] === '1'
}

// ---------- Stage -> assessments newly realized at this stage ----------

// For each stage, which assessment fields receive new values when the stage is entered.
// Older assessments keep their values from prior-stage realization; later assessments
// remain null until their own stage is entered. This matches the observed-evidence
// pattern where missing signals are represented as null.
export const STAGE_NEW_REALIZATIONS: Readonly<Record<InterventionStageKey, ReadonlyArray<AssessmentType | 'attendanceCheckpoint' | 'ce' | 'overall'>>> = {
  'pre-tt1':          ['attendanceCheckpoint', 'attendance'],
  'post-tt1':         ['attendanceCheckpoint', 'attendance', 'tt1'],
  'post-tt2':         ['attendanceCheckpoint', 'attendance', 'tt2', 'quiz', 'assignment'],
  'post-assignments': ['attendanceCheckpoint', 'attendance', 'ce'],
  'post-see':         ['attendanceCheckpoint', 'attendance', 'see', 'overall'],
}

// Cumulative set of assessments visible at / before this stage (for callers that need
// to emit complete evidence snapshots from the per-stage realizations).
export const STAGE_CUMULATIVE_VISIBLE: Readonly<Record<InterventionStageKey, ReadonlySet<AssessmentType | 'ce' | 'overall'>>> = {
  'pre-tt1':          new Set<AssessmentType | 'ce' | 'overall'>(['attendance']),
  'post-tt1':         new Set<AssessmentType | 'ce' | 'overall'>(['attendance', 'tt1']),
  'post-tt2':         new Set<AssessmentType | 'ce' | 'overall'>(['attendance', 'tt1', 'tt2', 'quiz', 'assignment']),
  'post-assignments': new Set<AssessmentType | 'ce' | 'overall'>(['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'ce']),
  'post-see':         new Set<AssessmentType | 'ce' | 'overall'>(['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'ce', 'see', 'overall']),
}

// ---------- Input / Output contract ----------

// A single intervention application as provided by the caller. runId and studentId are
// injected by the orchestrator from the enclosing simulation context.
export type StageRealizationInterventionInput = {
  caseId: string
  actionCode: InterventionApplication['actionCode']
  concernFamily: InterventionApplication['concernFamily']
  ordinalInStageForStudent: number
  stageKeyApplied: InterventionStageKey
  semesterNumberApplied: number
  dominantWeaknessHint: InterventionApplication['dominantWeaknessHint']
  severityContext: InterventionApplication['severityContext']
}

export type StageRealizationInput = {
  runId: string
  runSeed: number
  student: StudentTrajectoryForSimulation
  course: CourseForSimulation
  semesterNumber: number
  stageKey: InterventionStageKey
  facultyId: string
  scoresByCourseTitle: Map<string, number>
  interventionsInWindow: ReadonlyArray<StageRealizationInterventionInput>
}

export type StageRealizationAssessmentValues = {
  attendancePct: number | null
  tt1Pct: number | null
  tt2Pct: number | null
  quizPct: number | null
  assignmentPct: number | null
  cePct: number | null
  seePct: number | null
  attendanceHistory: Array<AttendanceHistoryEntry | null>
}

export type StageRealizationInterventionSummary = {
  totalImpact: number
  dominantTier: InterventionImpactTier | null
  appliedCount: number
  markDeltas: {
    attendance: number
    tt1: number
    tt2: number
    quiz: number
    assignment: number
    see: number
  }
}

export type StageRealizationResult = {
  baseline: StageSliceBundle
  realized: StageSliceBundle
  stageAssessments: StageRealizationAssessmentValues
  interventionImpact: StageRealizationInterventionSummary
  metadata: {
    runSeed: number
    runId: string
    studentId: string
    courseCompilerId: string
    semesterNumber: number
    stageKey: InterventionStageKey
    flagEnabledAtCaller: boolean
  }
}

// ---------- Helpers ----------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// Re-derive CE from the possibly-delta-shifted component marks. Uses the same weighting
// as the stage-slice-simulator's computeCePct but without re-drawing the CE noise
// (callers should stick with the baseline CE noise term so the intervention effect
// flows only through the component marks it was meant to move).
function rebuildCePct(input: {
  baselineCePct: number
  baselineTt1Pct: number
  baselineTt2Pct: number
  baselineQuizPct: number
  baselineAssignmentPct: number
  newTt1Pct: number
  newTt2Pct: number
  newQuizPct: number
  newAssignmentPct: number
}): number {
  const baselineWeighted =
      input.baselineTt1Pct * 0.28
    + input.baselineTt2Pct * 0.27
    + input.baselineQuizPct * 0.2
    + input.baselineAssignmentPct * 0.25
  const baselineNoise = input.baselineCePct - baselineWeighted
  const newWeighted =
      input.newTt1Pct * 0.28
    + input.newTt2Pct * 0.27
    + input.newQuizPct * 0.2
    + input.newAssignmentPct * 0.25
  return clamp(roundTo(newWeighted + baselineNoise, 2), 10, 97)
}

function studentProfileForEngine(student: StudentTrajectoryForSimulation): StudentLatentProfileForIntervention {
  return {
    dynamics: student.profile.dynamics,
    behavior: {
      practiceCompliance: student.profile.behavior.practiceCompliance,
      helpSeekingTendency: student.profile.behavior.helpSeekingTendency,
      examPressure: student.profile.behavior.examPressure,
    },
    intervention: student.profile.intervention,
  }
}

// ---------- Entry point ----------

export function realizeStageForCourse(input: StageRealizationInput): StageRealizationResult {
  const baseline = computeStageSliceBundle({
    student: input.student,
    course: input.course,
    semesterNumber: input.semesterNumber,
    scoresByCourseTitle: input.scoresByCourseTitle,
    facultyId: input.facultyId,
    runSeed: input.runSeed,
  })

  // Build intervention applications the intervention-response-engine expects. Runtime-only
  // fields (runId, studentId) get injected here from the enclosing simulation context.
  const engineProfile = studentProfileForEngine(input.student)
  const applications = input.interventionsInWindow.map(entry => ({
    application: {
      runId: input.runId,
      studentId: input.student.studentId,
      semesterNumber: entry.semesterNumberApplied,
      stageKey: entry.stageKeyApplied,
      caseId: entry.caseId,
      actionCode: entry.actionCode,
      concernFamily: entry.concernFamily,
      ordinalInStageForStudent: entry.ordinalInStageForStudent,
      severityContext: entry.severityContext,
      dominantWeaknessHint: entry.dominantWeaknessHint,
    } satisfies InterventionApplication,
    profile: engineProfile,
  }))

  const impact = sumInterventionImpacts(applications)

  const markDeltas = {
    attendance: computeMarkDelta({
      totalInterventionImpact: impact.totalImpact,
      dominantTier: impact.dominantTier,
      assessmentType: 'attendance',
    }),
    tt1: computeMarkDelta({
      totalInterventionImpact: impact.totalImpact,
      dominantTier: impact.dominantTier,
      assessmentType: 'tt1',
    }),
    tt2: computeMarkDelta({
      totalInterventionImpact: impact.totalImpact,
      dominantTier: impact.dominantTier,
      assessmentType: 'tt2',
    }),
    quiz: computeMarkDelta({
      totalInterventionImpact: impact.totalImpact,
      dominantTier: impact.dominantTier,
      assessmentType: 'quiz',
    }),
    assignment: computeMarkDelta({
      totalInterventionImpact: impact.totalImpact,
      dominantTier: impact.dominantTier,
      assessmentType: 'assignment',
    }),
    see: computeMarkDelta({
      totalInterventionImpact: impact.totalImpact,
      dominantTier: impact.dominantTier,
      assessmentType: 'see',
    }),
  }

  const realizedAttendance = clamp(
    roundTo(baseline.attendancePct + markDeltas.attendance, 2),
    ASSESSMENT_BOUNDS.attendance.min,
    ASSESSMENT_BOUNDS.attendance.max,
  )
  const realizedTt1 = clamp(
    roundTo(baseline.tt1Pct + markDeltas.tt1, 2),
    ASSESSMENT_BOUNDS.tt1.min,
    ASSESSMENT_BOUNDS.tt1.max,
  )
  const realizedTt2 = clamp(
    roundTo(baseline.tt2Pct + markDeltas.tt2, 2),
    ASSESSMENT_BOUNDS.tt2.min,
    ASSESSMENT_BOUNDS.tt2.max,
  )
  const realizedQuiz = clamp(
    roundTo(baseline.quizPct + markDeltas.quiz, 2),
    ASSESSMENT_BOUNDS.quiz.min,
    ASSESSMENT_BOUNDS.quiz.max,
  )
  const realizedAssignment = clamp(
    roundTo(baseline.assignmentPct + markDeltas.assignment, 2),
    ASSESSMENT_BOUNDS.assignment.min,
    ASSESSMENT_BOUNDS.assignment.max,
  )
  const realizedSee = clamp(
    roundTo(baseline.seePct + markDeltas.see, 2),
    ASSESSMENT_BOUNDS.see.min,
    ASSESSMENT_BOUNDS.see.max,
  )
  const realizedCe = rebuildCePct({
    baselineCePct: baseline.cePct,
    baselineTt1Pct: baseline.tt1Pct,
    baselineTt2Pct: baseline.tt2Pct,
    baselineQuizPct: baseline.quizPct,
    baselineAssignmentPct: baseline.assignmentPct,
    newTt1Pct: realizedTt1,
    newTt2Pct: realizedTt2,
    newQuizPct: realizedQuiz,
    newAssignmentPct: realizedAssignment,
  })

  const realized: StageSliceBundle = {
    ...baseline,
    attendancePct: realizedAttendance,
    tt1Pct: realizedTt1,
    tt2Pct: realizedTt2,
    quizPct: realizedQuiz,
    assignmentPct: realizedAssignment,
    seePct: realizedSee,
    cePct: realizedCe,
    courseworkToTtGap: roundTo(((realizedQuiz + realizedAssignment) / 2) - ((realizedTt1 + realizedTt2) / 2), 2),
    ttMomentum: roundTo(realizedTt2 - realizedTt1, 2),
  }

  // Build stage-scoped assessment payload — cumulative: this stage + everything visible
  // before it gets a value; future-stage assessments are null.
  const visibleSet = STAGE_CUMULATIVE_VISIBLE[input.stageKey]
  const stageAssessments: StageRealizationAssessmentValues = {
    attendancePct: visibleSet.has('attendance') ? realized.attendancePct : null,
    tt1Pct: visibleSet.has('tt1') ? realized.tt1Pct : null,
    tt2Pct: visibleSet.has('tt2') ? realized.tt2Pct : null,
    quizPct: visibleSet.has('quiz') ? realized.quizPct : null,
    assignmentPct: visibleSet.has('assignment') ? realized.assignmentPct : null,
    cePct: visibleSet.has('ce') ? realized.cePct : null,
    seePct: visibleSet.has('see') ? realized.seePct : null,
    attendanceHistory: computeAttendanceHistoryForStage({
      attendancePct: realized.attendancePct,
      student: input.student,
      course: input.course,
      semesterNumber: input.semesterNumber,
      runSeed: input.runSeed,
      stageKey: input.stageKey,
    }),
  }

  return {
    baseline,
    realized,
    stageAssessments,
    interventionImpact: {
      totalImpact: impact.totalImpact,
      dominantTier: impact.dominantTier,
      appliedCount: impact.appliedCount,
      markDeltas,
    },
    metadata: {
      runSeed: input.runSeed,
      runId: input.runId,
      studentId: input.student.studentId,
      courseCompilerId: input.course.internalCompilerId,
      semesterNumber: input.semesterNumber,
      stageKey: input.stageKey,
      flagEnabledAtCaller: isStageRealizationEnabled(),
    },
  }
}

// ---------- Convenience for multi-course realization ----------

export type StageRealizationStudentInput = Omit<StageRealizationInput, 'course' | 'interventionsInWindow'> & {
  courses: ReadonlyArray<CourseForSimulation>
  interventionsByCourseCompilerId: ReadonlyMap<string, ReadonlyArray<StageRealizationInterventionInput>>
}

export function realizeStageForStudent(input: StageRealizationStudentInput): Array<StageRealizationResult> {
  return input.courses.map(course => realizeStageForCourse({
    runId: input.runId,
    runSeed: input.runSeed,
    student: input.student,
    course,
    semesterNumber: input.semesterNumber,
    stageKey: input.stageKey,
    facultyId: input.facultyId,
    scoresByCourseTitle: input.scoresByCourseTitle,
    interventionsInWindow: input.interventionsByCourseCompilerId.get(course.internalCompilerId) ?? [],
  }))
}
