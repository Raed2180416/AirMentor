// Proof reassessment queue states, governance fields, acknowledgement /
// resolution payloads and requests/responses, and checkpoint-detail /
// evidence-timeline projections. Extracted verbatim from '../types'.

import type { ApiRoleCode } from './session'
import type { ApiSimulationStageCheckpointSummary } from './proof-dashboard'

export type ApiProofQueueState = 'open' | 'opened' | 'watch' | 'deferred' | 'resolved'

export type ApiProofRecoveryState = 'under_watch' | 'confirmed_improvement'

export type ApiProofReassessmentResolutionOutcome =
  | 'completed_awaiting_evidence'
  | 'completed_improving'
  | 'not_completed'
  | 'no_show'
  | 'switch_intervention'
  | 'administratively_closed'

export type ApiProofQueueGovernanceFields = {
  queueCaseId?: string | null
  primaryCase?: boolean | null
  countsTowardCapacity?: boolean | null
  priorityRank?: number | null
  governanceReason?: string | null
  supportingCourseCount?: number | null
  assignedFacultyId?: string | null
}

export type ApiProofReassessmentAcknowledgement = {
  acknowledgedByFacultyId?: string | null
  status: string
  note: string | null
  createdAt: string
}

export type ApiProofReassessmentResolutionPayload = {
  outcome: ApiProofReassessmentResolutionOutcome
  temporaryResponseCredit: number
  recoveryState: ApiProofRecoveryState
  queueCaseId: string
  actorRole: ApiRoleCode | string
  resolvedAt: string
  version: number
}

export type ApiProofReassessmentResolution = {
  resolvedByFacultyId?: string | null
  resolutionStatus: string
  note: string | null
  createdAt: string
  outcome?: ApiProofReassessmentResolutionOutcome | null
  recoveryState?: ApiProofRecoveryState | null
  resolutionJson?: ApiProofReassessmentResolutionPayload | null
}

export type ApiProofReassessmentAcknowledgeRequest = {
  note?: string
}

export type ApiProofReassessmentResolveRequest = {
  outcome: ApiProofReassessmentResolutionOutcome
  note?: string
}

export type ApiProofReassessmentAcknowledgeResponse = {
  reassessmentEventId: string
  acknowledgement: ApiProofReassessmentAcknowledgement & {
    acknowledgementId: string
    alertDecisionId: string
  }
}

export type ApiProofReassessmentResolveResponse = {
  reassessmentEventId: string
  resolution: ApiProofReassessmentResolution & {
    reassessmentResolutionId: string
    resolutionJson: ApiProofReassessmentResolutionPayload
  }
}

export type ApiProofRunCheckpointDetail = {
  checkpoint: ApiSimulationStageCheckpointSummary
    queuePreview: Array<{
      simulationStageQueueProjectionId: string
      studentId: string
    offeringId: string | null
    semesterNumber: number
    sectionCode: string | null
    courseCode: string
    courseTitle: string
    assignedToRole: string
    taskType: string
    status: string
      riskBand: string
      riskProbScaled: number
      noActionRiskProbScaled: number | null
      recommendedAction: string | null
      simulatedActionTaken: string | null
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      coEvidenceMode?: string | null
      detail: Record<string, unknown> & ApiProofQueueGovernanceFields
    }>
  offeringRollups: Array<{
    simulationStageOfferingProjectionId: string
    offeringId: string | null
    curriculumNodeId: string | null
    semesterNumber: number
    sectionCode: string
    courseCode: string
    courseTitle: string
    stage: number
    stageLabel: string
    stageDescription: string
    pendingAction: string | null
    projection: Record<string, unknown>
  }>
}

export type ApiProofRunCheckpointStudentDetail = {
  checkpoint: ApiSimulationStageCheckpointSummary
  student: {
    studentId: string
    studentName: string
    usn: string
  }
    projections: Array<{
      simulationStageStudentProjectionId: string
      offeringId: string | null
    semesterNumber: number
    sectionCode: string
    courseCode: string
    courseTitle: string
    riskBand: string
    riskProbScaled: number
      noActionRiskBand: string | null
      noActionRiskProbScaled: number | null
      recommendedAction: string | null
      simulatedActionTaken: string | null
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      queueState: string | null
      reassessmentState: string | null
      evidenceWindow: string
    projection: Record<string, unknown>
  }>
}

export type ApiProofStudentEvidenceTimelineItem = {
  studentObservedSemesterStateId: string
  semesterNumber: number
  termId: string | null
  sectionCode: string
  observedState: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
