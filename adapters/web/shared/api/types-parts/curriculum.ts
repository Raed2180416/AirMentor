// Course outcomes and overrides, curriculum feature config (payload/profile/
// binding/override/item/bundle), curriculum graph (nodes/edges/suggestions/
// bundle), proof-refresh, and linkage candidate contracts.
// Extracted verbatim from '../types'.

import type { ApiScopeType } from './policy'

export type ApiCourseOutcomeScopeType = 'institution' | 'branch' | 'batch' | 'offering'

export type ApiCourseOutcome = {
  id: string
  desc: string
  bloom: string
}

export type ApiCourseOutcomeOverride = {
  courseOutcomeOverrideId: string
  courseId: string
  scopeType: ApiCourseOutcomeScopeType
  scopeId: string
  outcomes: ApiCourseOutcome[]
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiResolvedCourseOutcomeSet = {
  offeringId: string
  courseId: string
  outcomes: ApiCourseOutcome[]
}

export type ApiCurriculumFeatureConfigPayload = {
  assessmentProfile: string
  outcomes: ApiCourseOutcome[]
  prerequisites: Array<{
    sourceCourseCode: string
    edgeKind: 'explicit' | 'added'
    rationale: string
  }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
  targetMode?: 'batch-local-override' | 'scope-profile'
  targetScopeType?: ApiScopeType
  targetScopeId?: string
  curriculumFeatureProfileId?: string | null
}

export type ApiCurriculumFeatureProfile = {
  curriculumFeatureProfileId: string
  name: string
  scopeType: ApiScopeType
  scopeId: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBatchCurriculumFeatureBinding = {
  batchId: string
  curriculumFeatureProfileId: string | null
  bindingMode: 'inherit-scope-profile' | 'pin-profile' | 'local-only'
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBatchCurriculumFeatureOverride = {
  batchCurriculumFeatureOverrideId: string
  batchId: string
  curriculumCourseId: string
  courseId: string | null
  courseCode: string
  title: string
  override: ApiCurriculumFeatureConfigPayload
  featureFingerprint?: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiCurriculumFeatureConfigItem = {
  curriculumCourseId: string
  curriculumImportVersionId: string | null
  curriculumNodeId: string | null
  courseId: string | null
  semesterNumber: number
  courseCode: string
  title: string
  credits: number
  assessmentProfile: string
  outcomes: ApiCourseOutcome[]
  outcomeOverride: ApiCourseOutcomeOverride | null
  prerequisites: Array<{
    curriculumEdgeId: string
    sourceCurriculumNodeId: string
    sourceCourseCode: string
    sourceTitle: string
    edgeKind: string
    rationale: string
    status: string
  }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
  resolvedConfig?: ApiCurriculumFeatureConfigPayload
  featureFingerprint?: string
  resolvedSource?: {
    mode: 'materialized' | 'scope-profile' | 'pinned-profile' | 'batch-local-override'
    label: string
    scopeType?: ApiScopeType
    scopeId?: string
    curriculumFeatureProfileId?: string | null
  }
  appliedProfiles?: ApiCurriculumFeatureProfile[]
  localOverride?: ApiBatchCurriculumFeatureOverride | null
}

export type ApiCurriculumFeatureConfigBundle = {
  batchId: string
  curriculumImportVersion: {
    curriculumImportVersionId: string
    sourceLabel: string
    sourceType: string
    status: string
    validationStatus: string
    updatedAt: string
  } | null
  binding?: ApiBatchCurriculumFeatureBinding
  availableProfiles?: ApiCurriculumFeatureProfile[]
  primaryCurriculumFeatureProfileId?: string | null
  curriculumFeatureProfileFingerprint?: string
  items: ApiCurriculumFeatureConfigItem[]
}

export type ApiGraphNode = {
  draftNodeId: string
  baseCurriculumNodeId?: string | null
  courseCode: string
  title: string
  semesterNumber: number
  credits: number
  positionX: number
  positionY: number
  assessmentProfile: string
  outcomes: Array<{ id: string; desc: string; bloom: string }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
}

export type ApiGraphEdge = {
  draftEdgeId: string
  baseCurriculumEdgeId?: string | null
  sourceDraftNodeId: string
  targetDraftNodeId: string
  edgeKind: 'explicit' | 'added' | 'corequisite' | 'cross_semester'
  rationale: string
  weight: number
  sourceOutcomeId?: string | null
  targetOutcomeId?: string | null
}

export type ApiGraphSuggestion = {
  suggestionId: string
  targetDraftNodeId: string | null
  sourceDraftNodeId: string | null
  edgeKind: string
  rationale: string
  confidenceScaled: number
  sources: string[]
  status: string
}

export type ApiCurriculumGraphBundle = {
  batchId: string
  baseCurriculumImportVersionId: string
  draftStatus: 'draft' | 'none'
  draftId: string | null
  nodes: ApiGraphNode[]
  edges: ApiGraphEdge[]
  history: {
    canUndo: boolean
    canRedo: boolean
    eventCount: number
  }
  suggestions: ApiGraphSuggestion[]
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
}

export type ApiProofRefresh = {
  affectedBatchIds: string[]
  queuedSimulationRunIds: string[]
  curriculumImportVersionId: string | null
  failedBatchIds: string[]
  status: 'not-needed' | 'queued' | 'degraded'
  warning: string | null
}

export type ApiCurriculumLinkageGenerationStatus = {
  status: 'ok' | 'degraded' | 'error'
  warnings: string[]
  provider: 'python-nlp' | 'typescript-fallback'
}

export type ApiCurriculumFeatureConfigSaveResult = {
  ok: true
  batchId: string
  curriculumCourseId: string
  curriculumImportVersionId: string | null
  affectedBatchIds?: string[]
  proofRefresh?: ApiProofRefresh
  targetMode?: 'batch-local-override' | 'scope-profile'
  curriculumFeatureProfileId?: string | null
}

export type ApiCurriculumFeatureConfigHistoryEvent = {
  auditEventId: string
  action: string
  actorRole: string
  actorId: string | null
  before: unknown | null
  after: unknown | null
  metadata: unknown | null
  createdAt: string
}

export type ApiCurriculumFeatureConfigPreview = {
  studentCount: number
  currentDistribution: { low: number; medium: number; high: number }
  projectedDistribution: { low: number; medium: number; high: number }
  delta: { low: number; medium: number; high: number }
  affectedStudents: Array<{
    studentId: string
    currentRiskBand: string
    projectedRiskBand: string
    currentWeakCoCount: number
    projectedWeakCoCount: number
  }>
}

export type ApiCurriculumFeatureBindingSaveResult = {
  ok: true
  batchId: string
  curriculumImportVersionId: string | null
  affectedBatchIds: string[]
  proofRefresh?: ApiProofRefresh
  binding: ApiBatchCurriculumFeatureBinding
}

export type ApiCurriculumBootstrapResult = {
  ok: true
  batchId: string
  manifestKey: 'msruas-mnc-seed'
  affectedBatchIds: string[]
  proofRefresh?: ApiProofRefresh
  candidateGenerationStatus: ApiCurriculumLinkageGenerationStatus
  curriculumImportVersionId: string | null
  curriculumFeatureProfileId: string
  curriculumFeatureProfileFingerprint: string
  createdCourseCount: number
  upsertedProfileCourseCount: number
  generatedCandidateCount: number
}

export type ApiCurriculumLinkageCandidate = {
  curriculumLinkageCandidateId: string
  batchId: string
  curriculumCourseId: string
  sourceCurriculumCourseId?: string | null
  sourceCourseId?: string | null
  sourceCourseCode: string
  sourceTitle: string
  targetCourseCode: string
  targetTitle: string
  edgeKind: 'explicit' | 'added'
  rationale: string
  confidenceScaled: number
  sources: string[]
  signalSummary: Record<string, unknown>
  status: string
  reviewNote?: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiCurriculumLinkageCandidateRegenerateResult = {
  ok: true
  batchId: string
  curriculumCourseId: string | null
  items: ApiCurriculumLinkageCandidate[]
  candidateGenerationStatus: ApiCurriculumLinkageGenerationStatus
}

export type ApiCurriculumLinkageApprovalResult = {
  ok: true
  batchId: string
  curriculumLinkageCandidateId: string
  approvalSucceeded: true
  proofRefreshQueued: boolean
  proofRefreshWarning: string | null
  affectedBatchIds: string[]
  curriculumImportVersionId: string | null
  proofRefresh?: ApiProofRefresh
}
