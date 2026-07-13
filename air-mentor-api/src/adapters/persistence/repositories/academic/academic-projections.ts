/**
 * Academic UI projections — offering-card, mentee, and student fallback shapes
 * plus the student transcript-history record and the bootstrap projection type
 * aliases.
 *
 * These map db/schema rows (offerings, students, enrollments, terms, branches,
 * departments, assessment cells) into the client-facing shapes, so they live in
 * the persistence layer. Moved verbatim from modules/academic.ts.
 */
import {
  academicTerms,
  branches,
  courses,
  departments,
  sectionOfferings,
  studentAssessmentScores,
  studentEnrollments,
  students,
} from '../../../../db/schema.js'
import { DEFAULT_STAGE_POLICY, type StagePolicyPayload } from '../../../../lib/stage-policy.js'
import type {
  GraphAwareFeatureCompleteness,
  GraphAwareFeatureProvenance,
  GraphAwarePrerequisiteSummaryCompleteness,
} from '../../../../lib/graph-summary.js'
import { buildAdvisoryNotes } from '../../../../application/use-cases/academic/academic-risk.js'

export function offeringStageSnapshot(offering: typeof sectionOfferings.$inferSelect, policy: StagePolicyPayload) {
  const currentOrder = Math.min(Math.max(1, offering.stage), policy.stages.length)
  const currentStage = policy.stages.find(stage => stage.order === currentOrder) ?? policy.stages[0]
  const nextStage = policy.stages.find(stage => stage.order === currentOrder + 1) ?? null
  return {
    currentOrder,
    currentStage,
    nextStage,
  }
}

export function inferMenteeFallback(input: {
  student: typeof students.$inferSelect
  enrollment?: typeof studentEnrollments.$inferSelect
  deptCode: string
  yearLabel: string
  prevCgpa: number
  avs?: number
  primaryRiskProb?: number | null
  primaryRiskBand?: 'Low' | 'Medium' | 'High' | null
  primaryCourseCode?: string | null
  primaryQueueState?: string | null
  courseRisks?: Array<{
    code: string
    title: string
    risk: number
    band: 'Low' | 'Medium' | 'High'
    stage: number
    queueState?: string | null
    recommendedAction?: string | null
    primaryCase?: boolean
    countsTowardCapacity?: boolean
    priorityRank?: number | null
  }>
  interventions?: Array<{ date: string; type: string; note: string }>
}) {
  return {
    id: `mentee-${input.student.studentId}`,
    usn: input.student.usn,
    name: input.student.name,
    phone: input.student.phone ?? '',
    year: input.yearLabel,
    section: input.enrollment?.sectionCode ?? 'A',
    dept: input.deptCode,
    courseRisks: input.courseRisks ?? [],
    avs: input.avs ?? -1,
    primaryRiskProb: input.primaryRiskProb ?? null,
    primaryRiskBand: input.primaryRiskBand ?? null,
    primaryCourseCode: input.primaryCourseCode ?? null,
    primaryQueueState: input.primaryQueueState ?? null,
    prevCgpa: input.prevCgpa,
    interventions: input.interventions ?? [],
  }
}

export function inferStudentFallback(input: {
  offering: {
    offId: string
    attendance: number
    tt1Done: boolean
    tt2Done: boolean
    stage: number
  }
  student: typeof students.$inferSelect
  prevCgpa: number
  currentCgpa?: number
  attendanceSnapshot?: {
    presentClasses: number
    totalClasses: number
  }
  assessments?: Record<string, { score: number; maxScore: number; evaluatedAt: string }>
  assessmentCells?: Array<typeof studentAssessmentScores.$inferSelect>
  interventions?: Array<{ date: string; type: string; note: string }>
  risk?: {
    riskProb: number
    riskBand: 'Low' | 'Medium' | 'High'
    riskCompleteness?: GraphAwarePrerequisiteSummaryCompleteness | null
    featureCompleteness?: GraphAwareFeatureCompleteness | null
    featureProvenance?: GraphAwareFeatureProvenance | null
  }
  reasons?: Array<{ label: string; impact: number; feature: string }>
  coScores?: Array<{ coId: string; attainment: number }>
  whatIf?: Array<{ label: string; current: string; target: string; currentRisk: number; newRisk: number }>
  flags?: { backlog: boolean; lowAttendance: boolean; declining: boolean }
}) {
  const tt1 = input.assessments?.tt1
  const tt2 = input.assessments?.tt2
  const quiz1 = input.assessments?.quiz1
  const quiz2 = input.assessments?.quiz2
  const asgn1 = input.assessments?.asgn1
  const asgn2 = input.assessments?.asgn2
  const quizScores = Object.fromEntries((input.assessmentCells ?? [])
    .filter(cell => /^quiz\d+$/.test(cell.componentType) && cell.componentCode)
    .map(cell => [cell.componentCode as string, cell.score]))
  const assignmentScores = Object.fromEntries((input.assessmentCells ?? [])
    .filter(cell => /^asgn\d+$/.test(cell.componentType) && cell.componentCode)
    .map(cell => [cell.componentCode as string, cell.score]))
  const totalClasses = input.attendanceSnapshot?.totalClasses ?? 0
  const presentClasses = input.attendanceSnapshot?.presentClasses ?? 0
  return {
    id: `${input.offering.offId}::${input.student.studentId}`,
    usn: input.student.usn,
    name: input.student.name,
    phone: input.student.phone ?? '',
    present: presentClasses,
    totalClasses,
    tt1Score: tt1?.score ?? null,
    tt1Max: tt1?.maxScore ?? 25,
    tt2Score: tt2?.score ?? null,
    tt2Max: tt2?.maxScore ?? 25,
    quiz1: quiz1?.score ?? null,
    quiz2: quiz2?.score ?? null,
    asgn1: asgn1?.score ?? null,
    asgn2: asgn2?.score ?? null,
    quizScores: Object.keys(quizScores).length > 0 ? quizScores : undefined,
    assignmentScores: Object.keys(assignmentScores).length > 0 ? assignmentScores : undefined,
    prevCgpa: input.prevCgpa,
    currentCgpa: input.currentCgpa ?? input.prevCgpa,
    riskProb: input.risk?.riskProb ?? null,
    riskBand: input.risk?.riskBand ?? null,
    riskCompleteness: input.risk?.riskCompleteness ?? null,
    featureCompleteness: input.risk?.featureCompleteness ?? null,
    featureProvenance: input.risk?.featureProvenance ?? null,
    reasons: input.reasons ?? [],
    coScores: input.coScores ?? [],
    whatIf: input.whatIf ?? [],
    interventions: input.interventions ?? [],
    flags: input.flags ?? {
      backlog: input.prevCgpa > 0 && input.prevCgpa < 5.5,
      lowAttendance: totalClasses > 0 && ((presentClasses / Math.max(1, totalClasses)) * 100) < 75,
      declining: false,
    },
  }
}

export function buildStudentHistoryRecord(input: {
  student: typeof students.$inferSelect
  enrollment?: typeof studentEnrollments.$inferSelect
  term?: typeof academicTerms.$inferSelect
  branch?: typeof branches.$inferSelect
  department?: typeof departments.$inferSelect
  prevCgpa: number
  currentCgpa: number
  completedCreditsForCgpa: number
  activeBacklogCredits: number
  repeatSubjects: string[]
  progressionStatus: 'Eligible' | 'Review' | 'Hold'
  trend: 'Improving' | 'Stable' | 'Declining'
  latestBacklogCount: number
  electiveRecommendation?: {
    recommendedCode: string
    recommendedTitle: string
    stream: string
    rationale: string
    alternatives: Array<{ code: string; title: string; stream: string }>
  } | null
  transcriptTerms?: Array<{
    termId: string
    label: string
    semesterNumber: number
    academicYear: string
    sgpa: number
    registeredCredits: number
    earnedCredits: number
    backlogCount: number
    subjects: Array<{
      code: string
      title: string
      credits: number
      score: number
      gradeLabel: string
      gradePoint: number
      result: string
    }>
  }>
}) {
  const departmentCode = input.department?.code ?? input.branch?.code ?? 'GEN'
  const programLabel = input.branch?.name ?? input.department?.name ?? departmentCode
  const notes = input.transcriptTerms && input.transcriptTerms.length > 0
    ? buildAdvisoryNotes({
        currentCgpa: input.currentCgpa,
        latestBacklogCount: input.latestBacklogCount,
        activeBacklogCredits: input.activeBacklogCredits,
        repeatSubjects: input.repeatSubjects,
        progressionStatus: input.progressionStatus,
        trend: input.trend,
      })
    : (input.prevCgpa > 0
        ? ['Transcript history has not been published yet. Current CGPA reflects the latest recorded student profile.']
        : ['Transcript history has not been published yet for this student.'])

  return {
    usn: input.student.usn,
    studentName: input.student.name,
    program: programLabel,
    dept: departmentCode,
    trend: input.trend,
    currentCgpa: input.currentCgpa,
    completedCreditsForCgpa: input.completedCreditsForCgpa,
    activeBacklogCredits: input.activeBacklogCredits,
    progressionStatus: input.progressionStatus,
    advisoryNotes: notes,
    repeatSubjects: input.repeatSubjects,
    electiveRecommendation: input.electiveRecommendation ?? null,
    terms: input.transcriptTerms && input.transcriptTerms.length > 0
      ? input.transcriptTerms
      : input.term
      ? [
          {
            termId: input.term.termId,
            label: `Semester ${input.term.semesterNumber}`,
            semesterNumber: input.term.semesterNumber,
            academicYear: input.term.academicYearLabel,
            sgpa: 0,
            registeredCredits: 0,
            earnedCredits: 0,
            backlogCount: 0,
            subjects: [],
          },
        ]
      : [],
  }
}

export type AcademicStudentProjection = ReturnType<typeof inferStudentFallback> & Record<string, unknown>
export type AcademicMenteeProjection = ReturnType<typeof inferMenteeFallback> & Record<string, unknown>
export type AcademicOfferingProjection = Omit<ReturnType<typeof mapOfferingRow>, 'termId' | 'branchId' | 'tt1Locked' | 'tt2Locked' | 'quizLocked' | 'asgnLocked' | 'finalsLocked'> & {
  termId?: string
  branchId?: string
  tt1Locked?: boolean
  tt2Locked?: boolean
  quizLocked?: boolean
  asgnLocked?: boolean
  finalsLocked?: boolean
} & Record<string, unknown>

export type PlaybackObservedStudentSummary = {
  currentCgpa: number | null
  backlogCount: number | null
}

export type PlaybackStudentCheckpointOverlay = {
  simulationStageCheckpointId: string
  riskProbScaled: number
  riskBand: 'Low' | 'Medium' | 'High'
  queueState: string | null
  reassessmentState: string | null
  recommendedAction: string | null
  primaryCase: boolean
  countsTowardCapacity: boolean
  priorityRank: number | null
  riskChangeFromPreviousCheckpointScaled: number | null
  counterfactualLiftScaled: number | null
  attentionAreas: string[]
  observableDrivers: Array<{ label: string; impact: number; feature: string }>
  attendancePct: number | null
  tt1Pct: number | null
  tt2Pct: number | null
  quizPct: number | null
  assignmentPct: number | null
  seePct: number | null
}

export function mapOfferingRow(input: {
  offering: typeof sectionOfferings.$inferSelect
  course: typeof courses.$inferSelect
  term: typeof academicTerms.$inferSelect
  department: typeof departments.$inferSelect | undefined
  stagePolicy?: StagePolicyPayload
  computedCount?: number
}) {
  const count = input.computedCount ?? input.offering.studentCount
  const resolvedStage = input.stagePolicy?.stages.find(stage => stage.order === input.offering.stage)
    ?? DEFAULT_STAGE_POLICY.stages.find(stage => stage.order === input.offering.stage)
    ?? null
  return {
    id: input.course.courseId,
    offId: input.offering.offeringId,
    termId: input.offering.termId,
    branchId: input.offering.branchId,
    code: input.course.courseCode,
    title: input.course.title,
    year: input.offering.yearLabel,
    dept: input.department?.code ?? 'CSE',
    sem: input.term.semesterNumber,
    section: input.offering.sectionCode,
    count,
    attendance: input.offering.attendance,
    stage: input.offering.stage,
    stageInfo: {
      stage: input.offering.stage,
      label: resolvedStage?.label ?? input.offering.stageLabel,
      desc: resolvedStage?.description ?? input.offering.stageDescription,
      color: resolvedStage?.color ?? input.offering.stageColor,
    },
    tt1Done: !!input.offering.tt1Done,
    tt2Done: !!input.offering.tt2Done,
    tt1Locked: !!input.offering.tt1Locked,
    tt2Locked: !!input.offering.tt2Locked,
    quizLocked: !!input.offering.quizLocked,
    asgnLocked: !!input.offering.assignmentLocked,
    finalsLocked: !!input.offering.finalsLocked,
    pendingAction: input.offering.pendingAction,
    sections: [input.offering.sectionCode],
    enrolled: [count],
    att: [input.offering.attendance],
  }
}
