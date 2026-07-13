// HoD-facing proof monitoring: run context, summary, course/faculty rollups,
// student watch, reassessment records, and the composite bundle.
// Extracted verbatim from '../types'.

import type {
  ApiCountSource,
  ApiResolvedFrom,
  ApiScopeDescriptor,
  ApiScopeMode,
} from './policy'
import type { ApiSimulationStageCheckpointSummary } from './proof-dashboard'
import type {
  ApiProofQueueState,
  ApiProofReassessmentAcknowledgement,
  ApiProofReassessmentResolution,
  ApiProofRecoveryState,
  ApiProofStudentEvidenceTimelineItem,
} from './proof-reassessment'

export type ApiAcademicHodProofRunContext = {
  simulationRunId: string
  batchId: string
  batchLabel: string
  branchName: string | null
  runLabel: string
  status: string
  seed: number
  createdAt: string
  sourceLabel: string
  checkpointContext?: ApiSimulationStageCheckpointSummary | null
}

export type ApiAcademicHodProofSummary = {
  activeRunContext: ApiAcademicHodProofRunContext | null
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  scope: {
    departmentNames: string[]
    branchNames: string[]
  }
  monitoringSummary: {
    riskAssessmentCount: number
    activeReassessmentCount: number
    alertDecisionCount: number
    acknowledgementCount: number
    resolutionCount: number
  }
  totals: {
    studentsCovered: number
    highRiskCount: number
    mediumRiskCount: number
    deferredQueueCount: number
    averageQueueAgeHours: number
    manualOverrideCount: number
    unresolvedAlertCount: number
    resolvedAlertCount: number
  }
  sectionComparison: Array<{
    sectionCode: string
    studentCount: number
    highRiskCount: number
    mediumRiskCount: number
    averageAttendancePct: number
    openReassessmentCount: number
    deferredQueueCount: number
  }>
  semesterRiskDistribution: Array<{
    semesterNumber: number
    highPressureCount: number
    reviewCount: number
    stableCount: number
    basis: string
  }>
  backlogDistribution: Array<{
    bucket: string
    studentCount: number
  }>
  electiveDistribution: Array<{
    stream: string
    recommendationCount: number
  }>
  facultyLoadSummary: {
    facultyCount: number
    overloadedFacultyCount: number
    averageWeeklyContactHours: number
  }
}

export type ApiAcademicHodProofCourseRollup = {
  courseCode: string
  title: string
  sectionCodes: string[]
  riskCountHigh: number
  riskCountMedium: number
  averageAttendancePct: number
  tt1WeakCount: number
  tt2WeakCount: number
  seeWeakCount: number
  weakQuestionSignalCount: number
  backlogCarryoverCount: number
  openReassessmentCount: number
  resolvedReassessmentCount: number
  studentCount: number
}

export type ApiAcademicHodProofFacultyRollup = {
  facultyId: string
  facultyName: string
  designation: string
  permissions: string[]
  weeklyContactHours: number
  sectionLoadCount: number
  assignedSections: string[]
  queueLoad: number
  avgAcknowledgementLagHours: number
  reassessmentClosureRate: number
  interventionCount: number
  overloadFlag: boolean
}

export type ApiAcademicHodProofStudentWatch = {
  studentId: string
  studentName: string
  usn: string
  sectionCode: string
  currentSemester: number
  currentRiskBand: string
  currentRiskProbScaled: number
  currentQueueState?: ApiProofQueueState | null
  currentRecoveryState?: ApiProofRecoveryState | null
  previousRiskBand?: string | null
  previousRiskProbScaled?: number | null
  riskChangeFromPreviousCheckpointScaled?: number | null
  counterfactualLiftScaled?: number | null
  queueCaseId?: string | null
  countsTowardCapacity?: boolean | null
  governanceReason?: string | null
  supportingCourseCount?: number | null
  assignedFacultyId?: string | null
  primaryCourseCode: string
  primaryCourseTitle: string
  currentReassessmentStatus: string | null
  nextDueAt: string | null
  observedEvidence: {
    attendancePct: number
    tt1Pct: number | null
    tt2Pct: number | null
    quizPct: number | null
    assignmentPct: number | null
    seePct: number | null
    cgpa: number
    backlogCount: number
    weakCoCount: number
    weakQuestionCount: number
    interventionRecoveryStatus: string | null
    coEvidenceMode?: string | null
  }
  electiveFit: {
    recommendedCode: string
    recommendedTitle: string
    stream: string
    rationale: string[]
    alternatives: Array<{ code: string; title: string; stream: string }>
  } | null
  courseSnapshots: Array<{
    riskAssessmentId: string
    offeringId: string
    courseCode: string
    courseTitle: string
    sectionCode: string | null
    riskBand: string
    riskProbScaled: number
    queueState?: ApiProofQueueState | null
    queueCaseId?: string | null
    primaryCase?: boolean | null
    countsTowardCapacity?: boolean | null
    recommendedAction: string
    riskChangeFromPreviousCheckpointScaled?: number | null
    counterfactualLiftScaled?: number | null
    observedEvidence: {
      attendancePct: number
      tt1Pct: number | null
      tt2Pct: number | null
      quizPct: number | null
      assignmentPct: number | null
      seePct: number | null
      cgpa: number
      backlogCount: number
      weakCoCount: number
      weakQuestionCount: number
      interventionRecoveryStatus: string | null
      coEvidenceMode?: string | null
    }
    drivers: Array<{ label: string; impact: number; feature: string }>
  }>
  evidenceTimeline: ApiProofStudentEvidenceTimelineItem[]
}

export type ApiAcademicHodProofReassessment = {
  reassessmentEventId: string
  simulationRunId: string
  runLabel: string
  studentId: string
  studentName: string
  usn: string
  courseCode: string
  courseTitle: string
  sectionCode: string | null
  assignedToRole: string
  assignedFacultyId?: string | null
  dueAt: string
  status: string
  riskBand: string
  riskProbScaled: number
  decisionType: string | null
  decisionNote: string | null
  queueCaseId?: string | null
  primaryCase?: boolean | null
  countsTowardCapacity?: boolean | null
  priorityRank?: number | null
  governanceReason?: string | null
  supportingCourseCount?: number | null
  recoveryState?: ApiProofRecoveryState | null
  observedResidual?: number | null
  acknowledgement: ApiProofReassessmentAcknowledgement | null
  resolution: ApiProofReassessmentResolution | null
}

export type ApiAcademicHodProofBundle = {
  summary: ApiAcademicHodProofSummary
  courses: ApiAcademicHodProofCourseRollup[]
  faculty: ApiAcademicHodProofFacultyRollup[]
  students: ApiAcademicHodProofStudentWatch[]
  reassessments: ApiAcademicHodProofReassessment[]
}
