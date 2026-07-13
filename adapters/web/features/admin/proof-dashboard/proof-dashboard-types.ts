import type {
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiSimulationStageCheckpointSummary,
} from '@web/shared/api/types'
import type { BatchSetupReadiness } from '@web/features/admin/batch-setup-readiness'
import type { ProofAdvanceControlMode } from '@web/simulation/proof-simulation-controls'

export type DiagnosticsRecord = Record<string, unknown> | null | undefined

export type ProductionDiagnosticsLike = {
  artifactVersion?: string | null
  evaluation?: unknown
  correlations?: Record<string, unknown> | null
} | null

export type ModelDiagnosticsLike = {
  scenarioFamilySummary?: Record<string, unknown> | null
} | null

export type ProofPlaybackNotice = { tone: 'neutral' | 'error'; message: string } | null

export type PlaybackDirection = 'previous' | 'next' | 'start' | 'end'
export type ProofDashboardTabId = 'summary' | 'checkpoint' | 'diagnostics' | 'operations'

export type CheckpointEvidenceView = 'queue' | 'offerings'

export type ProofActiveRunDetail = NonNullable<ApiProofDashboard['activeRunDetail']>
export type ProofResetSnapshot = ProofActiveRunDetail['snapshots'][number]
export type ProofQueueDiagnostics = ProofActiveRunDetail['queueDiagnostics']
export type ProofRunSummary = ApiProofDashboard['proofRuns'][number]

export type SystemAdminProofDashboardWorkspaceProps = {
  proofDashboard: ApiProofDashboard | null
  proofDashboardLoading: boolean
  batchSetupReadiness?: BatchSetupReadiness | null
  dashboardLayout?: 'embedded' | 'page'
  showLauncher?: boolean
  initialActiveDashboardTab?: ProofDashboardTabId
  activeRunCheckpoints: ApiSimulationStageCheckpointSummary[]
  activeModelDiagnostics: ModelDiagnosticsLike
  activeProductionDiagnostics: ProductionDiagnosticsLike
  activeDiagnosticsTrainingManifestVersion: string | null | undefined
  activeDiagnosticsCalibrationVersion: string | null | undefined
  activeDiagnosticsSplitSummary: DiagnosticsRecord
  activeDiagnosticsWorldSplitSummary: DiagnosticsRecord
  activeDiagnosticsScenarioFamilies: DiagnosticsRecord
  activeDiagnosticsHeadSupportSummary: DiagnosticsRecord
  activeDiagnosticsGovernedRunCount: number | null | undefined
  activeDiagnosticsSkippedRunCount: number | null | undefined
  activeDiagnosticsDisplayProbabilityAllowed: boolean | null | undefined
  activeDiagnosticsSupportWarning: string | null
  activeDiagnosticsPolicyDiagnostics: DiagnosticsRecord
  activeDiagnosticsCoEvidence: DiagnosticsRecord
  activeDiagnosticsPolicyAcceptance: DiagnosticsRecord
  activeDiagnosticsOverallCourseRuntime: DiagnosticsRecord
  activeDiagnosticsQueueBurden: DiagnosticsRecord
  activeDiagnosticsUiParity: DiagnosticsRecord
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  selectedProofCheckpointDetail: ApiProofRunCheckpointDetail | null
  selectedProofCheckpointBlocked: boolean
  selectedProofCheckpointHasBlockedProgression: boolean
  selectedProofCheckpointCanStepForward: boolean
  selectedProofCheckpointCanPlayToEnd: boolean
  proofPlaybackRestoreNotice: ProofPlaybackNotice
  onCreateProofImport: () => void
  onValidateLatestProofImport: () => void
  onReviewPendingCrosswalks: () => void
  onApproveLatestProofImport: () => void
  onCreateProofSimulation?: () => void
  onCreateProofRun: () => void
  onRecomputeProofRunRisk: () => void
  onActivateProofRun: (simulationRunId: string) => void
  onActivateProofSemester: (simulationRunId: string, semesterNumber: number) => void
  onAdvanceProofRun?: (simulationRunId: string, mode: ProofAdvanceControlMode) => void
  onRetryProofRun: (simulationRunId: string) => void
  onStopProofRun?: (simulationRunId: string) => void
  onArchiveProofRun: (simulationRunId: string) => void
  onRestoreProofSnapshot: (simulationRunId: string, simulationResetSnapshotId?: string) => void
  onResetProofRunFromScratch?: (simulationRunId: string, simulationResetSnapshotId?: string) => void
  onResetProofPlaybackSelection: () => void
  onDismissProofPlaybackRestoreNotice?: () => void
  onSelectProofCheckpoint: (checkpointId: string) => void
  onStepProofPlayback: (direction: PlaybackDirection) => void
  formatSplitSummary: (summary: DiagnosticsRecord) => string
  formatKeyedCounts: (summary: DiagnosticsRecord) => string
  formatHeadSupportSummary: (summary: DiagnosticsRecord) => string
  formatDiagnosticSummary: (summary: DiagnosticsRecord) => string
}
