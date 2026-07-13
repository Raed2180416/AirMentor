// HoD-facing counterfactual analytics and the Phase-11 simulator report
// contracts. Extracted verbatim from '../types'.

export type ApiAcademicHodProofCounterfactualScalar =
  | 'tt1Pct'
  | 'tt2Pct'
  | 'quizPct'
  | 'assignmentPct'
  | 'seePct'
  | 'totalPct'

export type ApiAcademicHodProofCounterfactualStudentStageDiff = {
  studentId: string
  semesterNumber: number
  stageKey: string
  deltas: Partial<Record<ApiAcademicHodProofCounterfactualScalar, number>>
}

export type ApiAcademicHodProofCounterfactualAggregate = {
  totalStudents: number
  totalStages: number
  totalStudentStagePairs: number
  byScalar: Record<ApiAcademicHodProofCounterfactualScalar, {
    samples: number
    meanDelta: number
    medianDelta: number
    positiveCount: number
    negativeCount: number
    zeroCount: number
    maxDelta: number
    minDelta: number
  }>
}

export type ApiProofRunCheckpointStudentSummary = {
  studentId: string
  studentName: string
  usn: string
  sectionCode: string
  currentSemester: number
  currentRiskBand: string
  currentRiskProbScaled: number
  currentQueueState?: string | null
  currentReassessmentStatus: string | null
  primaryCourseCode: string
  primaryCourseTitle: string
  nextDueAt: string | null
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
}

export type ApiAcademicHodProofCounterfactualReport = {
  runIdBaseline: string
  runIdRealized: string
  studentStageDiffs: ApiAcademicHodProofCounterfactualStudentStageDiff[]
  aggregate: ApiAcademicHodProofCounterfactualAggregate
}

// Phase-11 simulator counterfactual report (authoritative Sem-6 analytics).
// Matches `CounterfactualSimulatorReport` produced by
// `@air-mentor-api/src/lib/proof-counterfactual-simulator-aggregator.ts`.
// UI language MUST stay projected/simulated (§C.13 + §G.6 + §L.10) — never
// present simulator output as causal proof on its own.

export type ApiAcademicHodProofSimulatorStageKey =
  | 'pre-tt1'
  | 'post-tt1'
  | 'post-tt2'
  | 'post-assignments'
  | 'post-see'

export type ApiAcademicHodProofSimulatorRiskBand = 'High' | 'Medium' | 'Low'

export type ApiAcademicHodProofSimulatorScalarKey =
  | 'attendancePct'
  | 'tt1Pct'
  | 'tt2Pct'
  | 'quizPct'
  | 'assignmentPct'
  | 'seePct'

export type ApiAcademicHodProofSimulatorBandTransition =
  | 'no-change'
  | 'prevented-high'
  | 'prevented-medium'
  | 'regression'

export type ApiAcademicHodProofSimulatorStudentStage = {
  studentId: string
  semesterNumber: number
  stageKey: ApiAcademicHodProofSimulatorStageKey
  realizedRiskProbScaled: number
  realizedRiskBand: ApiAcademicHodProofSimulatorRiskBand
  noActionRiskProbScaled: number
  noActionRiskBand: ApiAcademicHodProofSimulatorRiskBand
  liftProbScaled: number
  markDeltas: Partial<Record<ApiAcademicHodProofSimulatorScalarKey, number>>
  realizedMarks: Partial<Record<ApiAcademicHodProofSimulatorScalarKey, number>>
  noActionMarks: Partial<Record<ApiAcademicHodProofSimulatorScalarKey, number>>
  bandTransition: ApiAcademicHodProofSimulatorBandTransition
  simulatedActionTaken: string | null
}

export type ApiAcademicHodProofSimulatorSemesterStageAggregate = {
  semesterNumber: number
  stageKey: ApiAcademicHodProofSimulatorStageKey
  studentCount: number
  meanRealizedRiskProbScaled: number
  meanNoActionRiskProbScaled: number
  meanLiftProbScaled: number
  bandTransitions: {
    preventedHigh: number
    preventedMedium: number
    regression: number
    noChange: number
  }
  meanMarkDeltas: Partial<Record<ApiAcademicHodProofSimulatorScalarKey, number>>
}

export type ApiAcademicHodProofSimulatorSemesterAggregate = {
  semesterNumber: number
  studentCount: number
  meanRealizedRiskProbScaled: number
  meanNoActionRiskProbScaled: number
  meanLiftProbScaled: number
  preventedHighTotal: number
  preventedMediumTotal: number
  regressionTotal: number
  projectedFailuresPrevented: number
}

export type ApiAcademicHodProofSimulatorProjectedFinal = {
  runId: string
  generatedAt: string
  totalStudents: number
  totalSemesters: number
  totalStagePoints: number
  meanRealizedRiskProbScaled: number
  meanNoActionRiskProbScaled: number
  meanLiftProbScaled: number
  projectedFailuresPreventedTotal: number
  liftDistribution: Array<{
    binLabel: string
    lowerInclusive: number
    upperExclusive: number
    count: number
  }>
}

export type ApiAcademicHodProofCounterfactualSimulatorReport = {
  runId: string
  generatedAt: string
  perStudentPerStage: ApiAcademicHodProofSimulatorStudentStage[]
  bySemesterStage: ApiAcademicHodProofSimulatorSemesterStageAggregate[]
  bySemester: ApiAcademicHodProofSimulatorSemesterAggregate[]
  projectedFinal: ApiAcademicHodProofSimulatorProjectedFinal
}
