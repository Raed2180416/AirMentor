// Student-agent panels, citations, timeline/message/session, and the composite
// student-agent card contract. Extracted verbatim from '../types'.

import type { ApiRoleCode } from './session'
import type {
  ApiCountSource,
  ApiResolvedFrom,
  ApiScopeDescriptor,
  ApiScopeMode,
} from './policy'
import type { ApiRiskCalibrationMethod } from './risk'
import type { ApiProofQueueState, ApiProofRecoveryState } from './proof-reassessment'

export type ApiStudentAgentPanelLabel = 'Observed' | 'Policy Derived' | 'Simulation Internal' | 'Human Action Log'

export type ApiStudentAgentCitation = {
  citationId: string
  label: string
  panelLabel: ApiStudentAgentPanelLabel
  summary: string
}

export type ApiStudentAgentTimelineItem = {
  timelineItemId: string
  panelLabel: ApiStudentAgentPanelLabel
  kind: 'semester-summary' | 'intervention' | 'reassessment' | 'resolution' | 'elective-fit'
  title: string
  detail: string
  occurredAt: string
  semesterNumber: number | null
  citations: ApiStudentAgentCitation[]
}

export type ApiStudentAgentMessage = {
  studentAgentMessageId: string
  actorType: string
  messageType: string
  body: string
  citations: ApiStudentAgentCitation[]
  guardrailCode: string | null
  createdAt: string
  updatedAt: string
}

export type ApiStudentAgentSession = {
  studentAgentSessionId: string
  simulationRunId: string
  simulationStageCheckpointId: string | null
  studentId: string
  viewerFacultyId: string | null
  viewerRole: ApiRoleCode
  status: string
  responseMode: 'deterministic'
  cardVersion: number
  messages: ApiStudentAgentMessage[]
  createdAt: string
  updatedAt: string
}

export type ApiStudentAgentCard = {
  studentAgentCardId: string
  simulationRunId: string
  simulationStageCheckpointId: string | null
  cardVersion: number
  sourceSnapshotHash: string
  disclaimer: string
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  runContext: {
    simulationRunId: string
    runLabel: string
    status: string
    seed: number
    createdAt: string
    batchLabel: string | null
    branchName: string | null
  }
  checkpointContext: {
    simulationStageCheckpointId: string
    semesterNumber: number
    stageKey: string
    stageLabel: string
    stageDescription: string
    stageOrder: number
    previousCheckpointId: string | null
    nextCheckpointId: string | null
    stageAdvanceBlocked?: boolean | null
    blockingQueueItemCount?: number | null
    playbackAccessible?: boolean | null
    blockedByCheckpointId?: string | null
    blockedProgressionReason?: string | null
  } | null
  student: {
    studentId: string
    studentName: string
    usn: string
    sectionCode: string
    currentSemester: number
    programScopeVersion: string | null
    mentorTrack: string | null
  }
  allowedIntents: string[]
  summaryRail: {
    currentRiskBand: string | null
    currentRiskProbScaled: number | null
    previousRiskBand?: string | null
    previousRiskProbScaled?: number | null
    riskChangeFromPreviousCheckpointScaled?: number | null
    counterfactualLiftScaled?: number | null
    currentRiskDisplayProbabilityAllowed?: boolean | null
    currentRiskSupportWarning?: string | null
    currentRiskCalibrationMethod?: ApiRiskCalibrationMethod | null
    currentRiskConfidenceClass?: 'high' | 'medium' | 'low' | null
    primaryCourseCode: string | null
    primaryCourseTitle: string | null
    nextDueAt: string | null
    currentReassessmentStatus: string | null
    currentQueueState?: ApiProofQueueState | null
    currentRecoveryState?: ApiProofRecoveryState | null
    currentCgpa: number
    predictedCgpa?: number | null
    backlogCount: number
    electiveFit: {
      recommendedCode: string
      recommendedTitle: string
      stream: string
      rationale: string[]
      alternatives: Array<{ code: string; title: string; stream: string }>
    } | null
  }
  overview: {
    observedLabel: ApiStudentAgentPanelLabel
    policyLabel: ApiStudentAgentPanelLabel
    currentEvidence: {
      attendancePct: number
      tt1Pct: number | null
      tt2Pct: number | null
      quizPct: number | null
      assignmentPct: number | null
      seePct: number | null
      weakCoCount: number
      weakQuestionCount: number
      interventionRecoveryStatus: string | null
      coEvidenceMode?: string | null
    }
    currentStatus: {
      riskBand: string | null
      riskProbScaled: number | null
      riskCompleteness?: {
        graphAvailable: boolean
        historyAvailable: boolean
        complete: boolean
        missing: Array<'graph' | 'history'>
        fallbackMode: 'graph-aware' | 'policy-only'
        confidenceClass: 'high' | 'medium' | 'low'
      } | null
      featureCompleteness?: {
        graphAvailable: boolean
        historyAvailable: boolean
        complete: boolean
        missing: Array<'graph' | 'history'>
        fallbackMode: 'graph-aware' | 'policy-only'
        confidenceClass: 'high' | 'medium' | 'low'
      } | null
      featureProvenance?: {
        curriculumImportVersionId: string | null
        curriculumFeatureProfileFingerprint: string | null
        graphNodeCount: number
        graphEdgeCount: number
        historyCourseCount: number
      } | null
      featureConfidenceClass?: 'high' | 'medium' | 'low' | null
      previousRiskBand?: string | null
      previousRiskProbScaled?: number | null
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      reassessmentStatus: string | null
      resolutionStatus?: string | null
      nextDueAt: string | null
      recommendedAction: string | null
      queueState: ApiProofQueueState | null
      simulatedActionTaken: string | null
      attentionAreas: string[]
      queueCaseId?: string | null
      primaryCase?: boolean | null
      countsTowardCapacity?: boolean | null
      priorityRank?: number | null
      governanceReason?: string | null
      supportingCourseCount?: number | null
      assignedFacultyId?: string | null
      recoveryState?: ApiProofRecoveryState | null
      observedResidual?: number | null
      policyComparison?: {
        policyPhenotype?: string | null
        recommendedAction: string | null
        simulatedActionTaken: string | null
        noActionRiskBand: string | null
        noActionRiskProbScaled: number | null
        counterfactualLiftScaled: number | null
        rationale: string
        actionCatalog?: {
          version: string
          stageKey: string
          stageActions: string[]
          phenotype: string
          phenotypeActions: string[]
          allCandidatesStageValid: boolean
          recommendedActionStageValid: boolean
        } | null
      } | null
    }
    semesterSummaries: Array<{
      semesterNumber: number
      riskBands: string[]
      sgpa: number
      cgpaAfterSemester: number
      backlogCount: number
      weakCoCount: number
      questionResultCoverage: number
      interventionCount: number
    }>
  }
  topicAndCo: {
    panelLabel: ApiStudentAgentPanelLabel
    topicBuckets: {
      known: string[]
      partial: string[]
      blocked: string[]
      highUncertainty: string[]
    }
    weakCourseOutcomes: Array<{
      coCode: string
      coTitle: string
      trend: string
      topics: string[]
      tt1Pct: number | null
      tt2Pct: number | null
      seePct: number | null
      transferGap: number
      coEvidenceMode?: string | null
    }>
    questionPatterns: {
      weakQuestionCount: number
      carelessErrorCount: number
      transferGapCount: number
      commonWeakTopics: string[]
      commonWeakCourseOutcomes: string[]
    }
    simulationTags: string[]
  }
  assessmentEvidence: {
    panelLabel: ApiStudentAgentPanelLabel
    components: Array<{
      courseCode: string
      courseTitle: string
      sectionCode: string | null
      attendancePct: number
      tt1Pct: number | null
      tt2Pct: number | null
      quizPct: number | null
      assignmentPct: number | null
      seePct: number | null
      weakCoCount: number
      weakQuestionCount: number
      drivers: Array<{ label: string; impact: number; feature: string }>
      coEvidenceMode?: string | null
    }>
  }
  interventions: {
    panelLabel: ApiStudentAgentPanelLabel
    currentReassessments: Array<{
      reassessmentEventId: string
      courseCode: string
      courseTitle: string
      status: string
      dueAt: string
      assignedToRole: string
      assignedFacultyId?: string | null
      queueCaseId?: string | null
      primaryCase?: boolean | null
      countsTowardCapacity?: boolean | null
      priorityRank?: number | null
      governanceReason?: string | null
      supportingCourseCount?: number | null
      recoveryState?: ApiProofRecoveryState | null
      observedResidual?: number | null
    }>
    interventionHistory: Array<{
      interventionId: string
      interventionType: string
      note: string
      occurredAt: string
      accepted: boolean | null
      completed: boolean | null
      recoveryConfirmed: boolean | null
      recoveryState?: ApiProofRecoveryState | null
      observedResidual: number | null
    }>
    humanActionLog: Array<{
      title: string
      detail: string
      occurredAt: string
    }>
  }
  counterfactual: {
    panelLabel: ApiStudentAgentPanelLabel
    noActionRiskBand: string | null
    noActionRiskProbScaled: number | null
    counterfactualLiftScaled: number | null
    note: string
  } | null
  citations: ApiStudentAgentCitation[]
}
