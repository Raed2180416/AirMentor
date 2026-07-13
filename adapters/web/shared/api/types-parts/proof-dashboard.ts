// Proof control-plane dashboard, proof-semester activation, and simulation
// stage-checkpoint summary contracts. Extracted verbatim from '../types'.

export type ApiProofDashboard = {
  imports: Array<{
    curriculumImportVersionId: string
    sourceLabel: string
    sourceChecksum: string
    outputChecksum: string
    compilerVersion: string
    validationStatus: string
    unresolvedMappingCount: number
    status: string
    approvedAt: string | null
    createdAt: string
    certificate: Record<string, unknown>
  }>
  latestValidation: {
    validatorVersion: string
    status: string
    summary: Record<string, unknown>
  } | null
  crosswalkReviewQueue: Array<{
    officialCodeCrosswalkId: string
    internalCompilerId: string
    officialWebCode: string | null
    officialWebTitle: string | null
    confidence: string
    reviewStatus: string
    evidenceSource: string
  }>
  proofRuns: Array<{
    simulationRunId: string
    runLabel: string
    status: string
    activeFlag: boolean
    seed: number
    createdAt: string
    startedAt: string | null
    completedAt: string | null
    failureCode: string | null
    failureMessage: string | null
    progress: Record<string, unknown> | null
    metrics: Record<string, unknown>
    queueAgeSeconds?: number | null
    leaseState?: 'leased' | 'expired' | 'released' | null
    leaseExpiresAt?: string | null
    retryState?: 'retryable' | 'retry-of-previous-run' | null
    retryOfSimulationRunId?: string | null
    failureState?: 'none' | 'retryable'
  }>
  activeRunDetail: {
    simulationRunId: string
    runLabel: string
    seed: number
    activeOperationalSemester: number | null
    activeStageKey?: string | null
    createdAt: string
    startedAt: string | null
    completedAt: string | null
    status: string
    failureCode: string | null
    failureMessage: string | null
    progress: Record<string, unknown> | null
    monitoringSummary: {
      riskAssessmentCount: number
      activeReassessmentCount: number
      alertDecisionCount: number
      acknowledgementCount: number
      resolutionCount: number
    }
    coverageDiagnostics: {
      behaviorProfileCoverage: {
        count: number
        expected: number
      }
      topicStateCoverage: {
        count: number
      }
      coStateCoverage: {
        count: number
      }
      questionTemplateCoverage: {
        count: number
      }
      questionResultCoverage: {
        count: number
      }
      interventionResponseCoverage: {
        count: number
      }
      worldContextCoverage: {
        count: number
      }
    }
    modelDiagnostics: {
      featureRowCount: number
      activeRunFeatureRowCount: number
      sourceRunCount: number
      trainingManifestVersion?: string | null
      runtimeSummary?: Record<string, unknown> | null
      overallCourseRuntimeSummary?: Record<string, unknown> | null
      queueBurdenSummary?: Record<string, unknown> | null
      stageRollups?: Array<Record<string, unknown>> | null
      acceptanceGateSummary?: Record<string, unknown> | null
      splitSummary?: {
        train: number
        validation: number
        test: number
      } | null
      worldSplitSummary?: {
        train: number
        validation: number
        test: number
      } | null
      scenarioFamilySummary?: Record<string, number> | null
      headSupportSummary?: Record<string, unknown> | null
      calibrationVersion?: string | null
      policyDiagnostics?: Record<string, unknown> | null
      coEvidenceDiagnostics?: Record<string, unknown> | null
      uiParityDiagnostics?: Record<string, unknown> | null
      production: {
        artifactVersion: string
        modelFamily: string
        createdAt: string
        evaluation: Record<string, unknown>
        trainingManifestVersion?: string | null
        splitSummary?: Record<string, number> | null
        worldSplitSummary?: Record<string, number> | null
        scenarioFamilySummary?: Record<string, number> | null
        headSupportSummary?: Record<string, unknown> | null
        calibrationVersion?: string | null
        policyDiagnostics?: Record<string, unknown> | null
        coEvidenceDiagnostics?: Record<string, unknown> | null
        uiParityDiagnostics?: Record<string, unknown> | null
        correlations?: Record<string, unknown> | null
      } | null
      challenger: {
        artifactVersion: string
        modelFamily: string
        createdAt: string
        evaluation: Record<string, unknown>
        trainingManifestVersion?: string | null
        splitSummary?: Record<string, number> | null
        worldSplitSummary?: Record<string, number> | null
        scenarioFamilySummary?: Record<string, number> | null
        headSupportSummary?: Record<string, unknown> | null
        calibrationVersion?: string | null
        policyDiagnostics?: Record<string, unknown> | null
        coEvidenceDiagnostics?: Record<string, unknown> | null
        uiParityDiagnostics?: Record<string, unknown> | null
        correlations?: Record<string, unknown> | null
      } | null
      correlations: Record<string, unknown> | null
    }
    queueDiagnostics?: {
      queuedRunCount: number
      runningRunCount: number
      failedRunCount: number
      retryableRunCount: number
      retryInFlightCount: number
      oldestQueuedRunAgeSeconds: number | null
      expiredLeaseRunCount: number
    }
    workerDiagnostics?: {
      queueAgeSeconds: number | null
      leaseState: 'leased' | 'expired' | 'released' | null
      leaseExpiresAt: string | null
      retryState: 'retryable' | 'retry-of-previous-run' | null
      retryOfSimulationRunId: string | null
      failureState: 'none' | 'retryable'
      progressPhase: string | null
      progressPercent: number | null
    } | null
    checkpointReadiness?: {
      totalCheckpointCount: number
      readyCheckpointCount: number
      blockedCheckpointCount: number
      playbackBlockedCheckpointCount: number
      totalBlockingQueueItemCount: number
      firstBlockedCheckpointId: string | null
      lastReadyCheckpointId: string | null
    }
    teacherAllocationLoad: Array<{
      teacherLoadProfileId: string
      facultyId: string
      facultyName: string
      semesterNumber: number
      sectionLoadCount: number
      weeklyContactHours: number
      assignedCredits: number
      permissions: string[]
    }>
    queuePreview: Array<{
      reassessmentEventId: string
      studentId: string
      studentName: string
      usn: string
      courseCode: string
      courseTitle: string
      sectionCode: string | null
      assignedToRole: string
      dueAt: string
      status: string
      riskBand: string
      riskProbScaled: number
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      coEvidenceMode?: string | null
      sourceKind?: 'runtime-reassessment' | 'checkpoint-playback'
      simulationStageCheckpointId?: string | null
      stageLabel?: string | null
    }>
    snapshots: Array<{
      simulationResetSnapshotId: string
      snapshotLabel: string
      createdAt: string
      payload: Record<string, unknown>
    }>
    checkpoints: ApiSimulationStageCheckpointSummary[]
  } | null
  lifecycleAudit: Array<{
    simulationLifecycleAuditId: string
    simulationRunId: string
    actionType: string
    payload: Record<string, unknown>
    createdByFacultyName: string | null
    createdAt: string
  }>
  recentOperationalEvents: Array<{
    operationalTelemetryEventId: string
    source: 'backend' | 'client'
    name: string
    level: 'info' | 'warn' | 'error'
    timestamp: string
    details: Record<string, unknown>
    createdAt: string
  }>
}

export type ApiActivateProofSemesterRequest = {
  semesterNumber: 1 | 2 | 3 | 4 | 5 | 6
}

export type ApiActivateProofSemesterResponse = {
  ok: true
  simulationRunId: string
  batchId: string
  activeOperationalSemester: number
  previousOperationalSemester: number | null
}

export type ApiSimulationStageCheckpointSummary = {
  simulationStageCheckpointId: string
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageLabel: string
  stageDescription: string
  stageOrder: number
  previousCheckpointId: string | null
  nextCheckpointId: string | null
  totalStudentProjectionCount?: number
  studentCount?: number
  offeringCount?: number
  highRiskCount?: number
  mediumRiskCount?: number
  lowRiskCount?: number
  openQueueCount?: number
  watchQueueCount?: number
  deferredQueueCount?: number
  watchStudentCount?: number
  resolvedQueueCount?: number
  noActionHighRiskCount?: number
  electiveVisibleCount?: number
  averageRiskDeltaScaled?: number
  averageRiskChangeFromPreviousCheckpointScaled?: number
  averageCounterfactualLiftScaled?: number
  stageAdvanceBlocked?: boolean
  blockingQueueItemCount?: number
  playbackAccessible?: boolean
  blockedByCheckpointId?: string | null
  blockedProgressionReason?: string | null
}
