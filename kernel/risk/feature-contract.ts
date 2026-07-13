// Graph-completeness contract types. Moved verbatim from
// air-mentor-api/src/lib/graph-summary.ts so kernel/risk stays framework-free and
// self-contained (kernel must not import from air-mentor-api/src). They are
// re-exported from graph-summary.ts to preserve every existing import path.
type GraphCompletenessFlag = 'graph' | 'history'

export type FeatureConfidenceClass = 'high' | 'medium' | 'low'

export type GraphAwareFeatureCompleteness = {
  graphAvailable: boolean
  historyAvailable: boolean
  complete: boolean
  missing: GraphCompletenessFlag[]
  fallbackMode: 'graph-aware' | 'policy-only'
  confidenceClass: FeatureConfidenceClass
}

export type GraphAwarePrerequisiteSummaryCompleteness = GraphAwareFeatureCompleteness

export type ObservableFeaturePayload = {
  attendancePct: number
  attendanceTrend: number
  attendanceHistoryRiskCount: number
  currentCgpa: number
  backlogCount: number
  // Explicit missingness: true when prior CGPA/backlog unknown (e.g. Semester 1 with no history).
  // Used to prevent zero from being misread as "worst-case CGPA/zero backlog" in the feature vector.
  cgpaMissing: boolean
  backlogMissing: boolean
  tt1Pct: number | null
  tt2Pct: number | null
  seePct: number | null
  quizPct: number | null
  assignmentPct: number | null
  weakCoCount: number
  weakQuestionCount: number
  courseworkToTtGap: number
  ttMomentum: number
  interventionResponseScore: number | null
  prerequisitePressure: number
  prerequisiteAveragePct: number
  prerequisiteFailureCount: number
  prerequisiteChainDepth: number
  prerequisiteWeakCourseRate: number
  prerequisiteCarryoverLoad: number
  prerequisiteRecencyWeightedFailure: number
  downstreamDependencyLoad: number
  weakPrerequisiteChainCount: number
  repeatedWeakPrerequisiteFamilyCount: number
  semesterNumber: number
  semesterProgress: number
  sectionRiskRate: number
  // v6 backlog-credit decomposition fields (optional for backward compat with v5 DB rows)
  activeBacklogCredits?: number
  historicalBacklogCredits?: number
  lowerYearBlockerCredits?: number
  backlogSensitivityScore?: number
}

export type ObservableLabelPayload = {
  attendanceRiskLabel: 0 | 1
  ceShortfallLabel: 0 | 1
  seeShortfallLabel: 0 | 1
  overallCourseFailLabel: 0 | 1
  downstreamCarryoverLabel: 0 | 1
}

export type ObservableSourceRefs = {
  simulationRunId: string
  simulationStageCheckpointId: string | null
  studentId: string
  offeringId: string | null
  semesterNumber: number
  sectionCode: string
  courseCode: string
  courseTitle: string
  courseFamily?: string | null
  coEvidenceMode?: string | null
  stageKey: string | null
  prerequisiteCourseCodes: string[]
  prerequisiteWeakCourseCodes: string[]
  weakCourseOutcomeCodes: string[]
  dominantQuestionTopics: string[]
  prerequisiteCompleteness?: GraphAwarePrerequisiteSummaryCompleteness | null
  featureCompleteness?: GraphAwareFeatureCompleteness | null
  featureConfidenceClass?: FeatureConfidenceClass | null
}

export type ObservableRiskEvidenceRow = {
  riskEvidenceSnapshotId: string
  batchId: string
  featurePayload: ObservableFeaturePayload
  labelPayload: ObservableLabelPayload
  sourceRefs: ObservableSourceRefs
}
