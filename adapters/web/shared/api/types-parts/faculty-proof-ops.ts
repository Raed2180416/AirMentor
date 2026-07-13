// Faculty-facing proof operations (monitoring queue + elective fits) contract.
// Extracted verbatim from '../types'.

import type {
  ApiCountSource,
  ApiResolvedFrom,
  ApiScopeDescriptor,
  ApiScopeMode,
} from './policy'
import type { ApiSimulationStageCheckpointSummary } from './proof-dashboard'

export type ApiFacultyProofOperations = {
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  activeRunContexts: Array<{
    batchId: string
    batchLabel: string
    branchName: string | null
    simulationRunId: string
    runLabel: string
    status: string
    seed: number
    createdAt: string
  }>
  selectedCheckpoint: ApiSimulationStageCheckpointSummary | null
  activeRunCheckpoints?: ApiSimulationStageCheckpointSummary[]
  monitoringQueue: Array<{
    riskAssessmentId: string
    simulationRunId: string | null
    batchId: string | null
    batchLabel: string | null
    branchName: string | null
    studentId: string
    studentName: string
    usn: string
    offeringId: string
    courseCode: string
    courseTitle: string
    sectionCode: string | null
    riskBand: string
    riskProbScaled: number
    recommendedAction: string
    riskChangeFromPreviousCheckpointScaled?: number | null
    counterfactualLiftScaled?: number | null
    drivers: Array<{ label: string; impact: number; feature: string }>
    dueAt: string | null
    reassessmentStatus: string | null
    decisionType: string | null
    decisionNote: string | null
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
    override: {
      overrideBand: string
      overrideNote: string
      createdAt: string
    } | null
    acknowledgement: {
      status: string
      note: string | null
      createdAt: string
    } | null
    resolution: {
      resolutionStatus: string
      note: string | null
      createdAt: string
    } | null
  }>
  electiveFits: Array<{
    electiveRecommendationId: string
    studentId: string
    studentName: string
    usn: string
    recommendedCode: string
    recommendedTitle: string
    stream: string
    rationale: string[]
    alternatives: Array<{ code: string; title: string; stream: string }>
    updatedAt: string
  }>
}
