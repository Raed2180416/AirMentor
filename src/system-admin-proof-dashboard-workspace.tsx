import type {
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiSimulationStageCheckpointSummary,
} from './api/types'
import { T, mono, sora } from './data'
import { InfoBanner, RestoreBanner } from './system-admin-ui'
import { Btn, Card, Chip } from './ui-primitives'

type DiagnosticsRecord = Record<string, unknown> | null | undefined

type ProductionDiagnosticsLike = {
  artifactVersion?: string | null
  evaluation?: unknown
  correlations?: Record<string, unknown> | null
} | null

type ModelDiagnosticsLike = {
  scenarioFamilySummary?: Record<string, unknown> | null
} | null

type ProofPlaybackNotice = { tone: 'neutral' | 'error'; message: string } | null

type PlaybackDirection = 'previous' | 'next' | 'start' | 'end'

function formatAgeSeconds(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'n/a'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h`
}

function formatLeaseState(leaseState: 'leased' | 'expired' | 'released' | null | undefined) {
  if (!leaseState) return 'unleased'
  return leaseState
}

type SystemAdminProofDashboardWorkspaceProps = {
  proofDashboard: ApiProofDashboard | null
  proofDashboardLoading: boolean
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
  onCreateProofRun: () => void
  onRecomputeProofRunRisk: () => void
  onActivateProofRun: (simulationRunId: string) => void
  onRetryProofRun: (simulationRunId: string) => void
  onArchiveProofRun: (simulationRunId: string) => void
  onRestoreProofSnapshot: (simulationRunId: string, simulationResetSnapshotId?: string) => void
  onResetProofPlaybackSelection: () => void
  onSelectProofCheckpoint: (checkpointId: string) => void
  onStepProofPlayback: (direction: PlaybackDirection) => void
  formatSplitSummary: (summary: DiagnosticsRecord) => string
  formatKeyedCounts: (summary: DiagnosticsRecord) => string
  formatHeadSupportSummary: (summary: DiagnosticsRecord) => string
  formatDiagnosticSummary: (summary: DiagnosticsRecord) => string
}

export function SystemAdminProofDashboardWorkspace({
  proofDashboard,
  proofDashboardLoading,
  activeRunCheckpoints,
  activeModelDiagnostics,
  activeProductionDiagnostics,
  activeDiagnosticsTrainingManifestVersion,
  activeDiagnosticsCalibrationVersion,
  activeDiagnosticsSplitSummary,
  activeDiagnosticsWorldSplitSummary,
  activeDiagnosticsScenarioFamilies,
  activeDiagnosticsHeadSupportSummary,
  activeDiagnosticsGovernedRunCount,
  activeDiagnosticsSkippedRunCount,
  activeDiagnosticsDisplayProbabilityAllowed,
  activeDiagnosticsSupportWarning,
  activeDiagnosticsPolicyDiagnostics,
  activeDiagnosticsCoEvidence,
  activeDiagnosticsPolicyAcceptance,
  activeDiagnosticsOverallCourseRuntime,
  activeDiagnosticsQueueBurden,
  activeDiagnosticsUiParity,
  selectedProofCheckpoint,
  selectedProofCheckpointDetail,
  selectedProofCheckpointBlocked,
  selectedProofCheckpointHasBlockedProgression,
  selectedProofCheckpointCanStepForward,
  selectedProofCheckpointCanPlayToEnd,
  proofPlaybackRestoreNotice,
  onCreateProofImport,
  onValidateLatestProofImport,
  onReviewPendingCrosswalks,
  onApproveLatestProofImport,
  onCreateProofRun,
  onRecomputeProofRunRisk,
  onActivateProofRun,
  onRetryProofRun,
  onArchiveProofRun,
  onRestoreProofSnapshot,
  onResetProofPlaybackSelection,
  onSelectProofCheckpoint,
  onStepProofPlayback,
  formatSplitSummary,
  formatKeyedCounts,
  formatHeadSupportSummary,
  formatDiagnosticSummary,
}: SystemAdminProofDashboardWorkspaceProps) {
  const activeRunDetail = proofDashboard?.activeRunDetail ?? null
  const activeRunSnapshots = activeRunDetail?.snapshots ?? []
  const activeQueueDiagnostics = activeRunDetail?.queueDiagnostics
  const activeWorkerDiagnostics = activeRunDetail?.workerDiagnostics ?? null
  const activeCheckpointReadiness = activeRunDetail?.checkpointReadiness
  const lifecycleAudit = proofDashboard?.lifecycleAudit ?? []
  const productionEvaluation = activeProductionDiagnostics?.evaluation
  const productionEvaluationKeys = productionEvaluation && typeof productionEvaluation === 'object'
    ? Object.keys(productionEvaluation as Record<string, unknown>).slice(0, 5).join(' · ') || 'none'
    : null

  return (
    <Card data-proof-surface="system-admin-proof-control-plane" style={{ padding: 14, background: T.surface2, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Proof Control Plane</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
            Curriculum import, crosswalk review, active run control, monitoring state, and snapshot restore all run from the backend proof shell now.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" dataProofAction="proof-create-import" onClick={onCreateProofImport}>Create Import</Btn>
          <Btn size="sm" variant="ghost" dataProofAction="proof-validate-import" onClick={onValidateLatestProofImport} disabled={!proofDashboard?.imports.length}>Validate Import</Btn>
          <Btn size="sm" variant="ghost" dataProofAction="proof-review-crosswalks" onClick={onReviewPendingCrosswalks} disabled={!proofDashboard?.crosswalkReviewQueue.length}>Review Mappings</Btn>
          <Btn size="sm" variant="ghost" dataProofAction="proof-approve-import" onClick={onApproveLatestProofImport} disabled={!proofDashboard?.imports.length}>Approve Import</Btn>
          <Btn size="sm" dataProofAction="proof-run-rerun" onClick={onCreateProofRun} disabled={!proofDashboard?.imports.length}>Run / Rerun</Btn>
          <Btn size="sm" variant="ghost" dataProofAction="proof-recompute-risk" onClick={onRecomputeProofRunRisk} disabled={!activeRunDetail}>Recompute Risk</Btn>
        </div>
      </div>

      {proofDashboardLoading ? <InfoBanner message="Loading proof control-plane data..." /> : null}

      {activeRunDetail ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Active Run</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>{activeRunDetail.runLabel}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>Seed {activeRunDetail.seed} · {activeRunDetail.status}</div>
              {activeRunDetail.progress ? (
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                  {String(activeRunDetail.progress.phase ?? 'running')} · {String(activeRunDetail.progress.percent ?? 0)}%
                </div>
              ) : null}
              {activeRunDetail.failureMessage ? (
                <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 6, lineHeight: 1.6 }}>
                  {activeRunDetail.failureMessage}
                </div>
              ) : null}
            </Card>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Monitoring</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {activeRunDetail.monitoringSummary.riskAssessmentCount} watch scores · {activeRunDetail.monitoringSummary.activeReassessmentCount} open reassessments
              </div>
            </Card>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Alerts</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {activeRunDetail.monitoringSummary.alertDecisionCount} decisions · {activeRunDetail.monitoringSummary.acknowledgementCount} acknowledgements
              </div>
            </Card>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Snapshots</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>{activeRunSnapshots.length} saved</div>
            </Card>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queue Health</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {activeQueueDiagnostics?.queuedRunCount ?? 0} queued · {activeQueueDiagnostics?.runningRunCount ?? 0} running · {activeQueueDiagnostics?.failedRunCount ?? 0} failed
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.6 }}>
                Oldest queue age {formatAgeSeconds(activeQueueDiagnostics?.oldestQueuedRunAgeSeconds)} · retryable failures {activeQueueDiagnostics?.retryableRunCount ?? 0}
              </div>
              {(activeQueueDiagnostics?.expiredLeaseRunCount ?? 0) > 0 ? (
                <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 6, lineHeight: 1.6 }}>
                  {activeQueueDiagnostics?.expiredLeaseRunCount} run leases have expired.
                </div>
              ) : null}
            </Card>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Worker Lease</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {formatLeaseState(activeWorkerDiagnostics?.leaseState)} · phase {activeWorkerDiagnostics?.progressPhase ?? 'n/a'}
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.6 }}>
                Queue age {formatAgeSeconds(activeWorkerDiagnostics?.queueAgeSeconds)} · progress {activeWorkerDiagnostics?.progressPercent ?? 'n/a'}%
              </div>
              {activeWorkerDiagnostics?.leaseExpiresAt ? (
                <div style={{ ...mono, fontSize: 10, color: activeWorkerDiagnostics.leaseState === 'expired' ? T.warning : T.muted, marginTop: 6, lineHeight: 1.6 }}>
                  Lease expires {new Date(activeWorkerDiagnostics.leaseExpiresAt).toLocaleString('en-IN')}
                </div>
              ) : null}
            </Card>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Checkpoint Readiness</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {activeCheckpointReadiness?.readyCheckpointCount ?? 0}/{activeCheckpointReadiness?.totalCheckpointCount ?? 0} ready
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.6 }}>
                {activeCheckpointReadiness?.blockedCheckpointCount ?? 0} blocked · {activeCheckpointReadiness?.playbackBlockedCheckpointCount ?? 0} playback gated · {activeCheckpointReadiness?.totalBlockingQueueItemCount ?? 0} blocking queue items
              </div>
              {activeCheckpointReadiness?.firstBlockedCheckpointId ? (
                <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 6, lineHeight: 1.6 }}>
                  First blocked checkpoint {activeCheckpointReadiness.firstBlockedCheckpointId}
                </div>
              ) : null}
            </Card>
            <Card style={{ padding: 12, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Stage 2 Coverage</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {activeRunDetail.coverageDiagnostics.behaviorProfileCoverage.count}/{activeRunDetail.coverageDiagnostics.behaviorProfileCoverage.expected} profiles · {activeRunDetail.coverageDiagnostics.questionResultCoverage.count} question results
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                Topic {activeRunDetail.coverageDiagnostics.topicStateCoverage.count} · CO {activeRunDetail.coverageDiagnostics.coStateCoverage.count} · response {activeRunDetail.coverageDiagnostics.interventionResponseCoverage.count}
              </div>
            </Card>
            <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 10 }}>
              <div>
                <div style={{ ...mono, fontSize: 10, color: T.dim }}>Risk Model</div>
                <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                  {activeProductionDiagnostics
                    ? `${activeProductionDiagnostics.artifactVersion} · ${activeRunDetail.modelDiagnostics.activeRunFeatureRowCount} active rows`
                    : 'Heuristic fallback only'}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                  {activeProductionDiagnostics
                    ? `${activeRunDetail.modelDiagnostics.sourceRunCount} run corpus · ${activeRunDetail.modelDiagnostics.featureRowCount} checkpoint rows`
                    : 'No active local artifact has been trained for this batch yet.'}
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim }}>Corpus + Split</div>
                <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.6 }}>
                  Manifest {activeDiagnosticsTrainingManifestVersion ?? 'unknown'}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                  Splits: {formatSplitSummary(activeDiagnosticsSplitSummary)}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                  Worlds: {formatSplitSummary(activeDiagnosticsWorldSplitSummary)}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                  Scenario families: {formatKeyedCounts(activeModelDiagnostics?.scenarioFamilySummary ?? activeDiagnosticsScenarioFamilies)}
                </div>
                {activeDiagnosticsHeadSupportSummary ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Head support: {formatHeadSupportSummary(activeDiagnosticsHeadSupportSummary)}
                  </div>
                ) : null}
                {activeDiagnosticsGovernedRunCount != null || activeDiagnosticsSkippedRunCount != null ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Governed runs: {activeDiagnosticsGovernedRunCount ?? 'unknown'} · skipped runs: {activeDiagnosticsSkippedRunCount ?? 0}
                  </div>
                ) : null}
              </div>

              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim }}>Calibration + Policy</div>
                <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.6 }}>
                  Calibration {activeDiagnosticsCalibrationVersion ?? 'unknown'}
                </div>
                {activeDiagnosticsDisplayProbabilityAllowed != null ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Probability display: {activeDiagnosticsDisplayProbabilityAllowed ? 'allowed' : 'band only'}
                  </div>
                ) : null}
                {activeDiagnosticsSupportWarning ? (
                  <div style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.6 }}>
                    Support: {activeDiagnosticsSupportWarning}
                  </div>
                ) : null}
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                  {productionEvaluationKeys ? `Evaluation keys: ${productionEvaluationKeys}` : 'No evaluation payload is available.'}
                </div>
                {activeDiagnosticsPolicyDiagnostics ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Governed policy: {formatDiagnosticSummary(activeDiagnosticsPolicyDiagnostics)}
                  </div>
                ) : null}
                {activeDiagnosticsCoEvidence ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Governed CO evidence: {formatDiagnosticSummary(activeDiagnosticsCoEvidence)}
                  </div>
                ) : null}
                {activeDiagnosticsPolicyAcceptance ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Policy gates: {formatDiagnosticSummary(activeDiagnosticsPolicyAcceptance)}
                  </div>
                ) : null}
                {activeDiagnosticsOverallCourseRuntime ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Overall-course runtime: {formatDiagnosticSummary(activeDiagnosticsOverallCourseRuntime)}
                  </div>
                ) : null}
                {activeDiagnosticsQueueBurden ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Queue burden: {formatDiagnosticSummary(activeDiagnosticsQueueBurden)}
                  </div>
                ) : null}
                {activeDiagnosticsUiParity ? (
                  <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.6 }}>
                    Active-run parity: {formatDiagnosticSummary(activeDiagnosticsUiParity)}
                  </div>
                ) : null}
                {activeProductionDiagnostics?.correlations ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                    Correlations: {Object.keys(activeProductionDiagnostics.correlations).slice(0, 5).join(' · ') || 'none'}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          {selectedProofCheckpoint ? (
            <Card data-proof-section="checkpoint-playback" style={{ padding: 12, background: T.surface, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Checkpoint Playback</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                    Read-only playback overlay for the active proof run. The run itself does not mutate while stepping through stage checkpoints.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn
                    size="sm"
                    variant="ghost"
                    dataProofAction="proof-playback-reset"
                    onClick={() => onStepProofPlayback('start')}
                    disabled={activeRunCheckpoints.length === 0 || selectedProofCheckpoint.simulationStageCheckpointId === activeRunCheckpoints[0]?.simulationStageCheckpointId}
                  >
                    Reset To Start
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    dataProofAction="proof-playback-previous"
                    onClick={() => onStepProofPlayback('previous')}
                    disabled={!selectedProofCheckpoint.previousCheckpointId}
                  >
                    Previous
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    dataProofAction="proof-playback-next"
                    onClick={() => onStepProofPlayback('next')}
                    disabled={!selectedProofCheckpointCanStepForward || !selectedProofCheckpoint.nextCheckpointId}
                  >
                    Next
                  </Btn>
                  <Btn
                    size="sm"
                    dataProofAction="proof-playback-end"
                    onClick={() => onStepProofPlayback('end')}
                    disabled={!selectedProofCheckpointCanPlayToEnd}
                  >
                    Play To End
                  </Btn>
                </div>
              </div>

              {proofPlaybackRestoreNotice ? (
                <RestoreBanner
                  tone={proofPlaybackRestoreNotice.tone}
                  title={proofPlaybackRestoreNotice.tone === 'error' ? 'Proof playback reset required' : 'Proof playback restored'}
                  message={proofPlaybackRestoreNotice.message}
                  actionLabel="Reset playback"
                  onAction={onResetProofPlaybackSelection}
                />
              ) : null}

              <div data-proof-section="selected-checkpoint-banner">
                <InfoBanner
                  tone={selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'error' : 'neutral'}
                  message={`Selected checkpoint: semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel} · ${selectedProofCheckpoint.stageDescription}. ${selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'Playback progression is blocked until all queue items at this checkpoint are resolved.' : 'This stage is synced into the academic playback overlay for teaching surfaces.'}`}
                />
              </div>

              <div data-proof-section="checkpoint-buttons" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {activeRunCheckpoints.map(item => (
                  <Btn
                    key={item.simulationStageCheckpointId}
                    size="sm"
                    dataProofAction="proof-select-checkpoint"
                    dataProofEntityId={item.simulationStageCheckpointId}
                    variant={item.simulationStageCheckpointId === selectedProofCheckpoint.simulationStageCheckpointId ? 'primary' : 'ghost'}
                    onClick={() => onSelectProofCheckpoint(item.simulationStageCheckpointId)}
                  >
                    {`S${item.semesterNumber} · ${item.stageLabel}${item.playbackAccessible === false ? ' · blocked' : ''}`}
                  </Btn>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <Card style={{ padding: 12, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Risk Snapshot</div>
                  <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                    {selectedProofCheckpoint.highRiskCount ?? 0} high · {selectedProofCheckpoint.mediumRiskCount ?? 0} medium · {selectedProofCheckpoint.lowRiskCount ?? 0} low
                  </div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queue State</div>
                  <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                    {selectedProofCheckpoint.openQueueCount ?? 0} open · {selectedProofCheckpoint.watchQueueCount ?? 0} watch · {selectedProofCheckpoint.resolvedQueueCount ?? 0} resolved
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0} blocking students · {selectedProofCheckpoint.watchStudentCount ?? 0} watched students
                  </div>
                  {selectedProofCheckpoint.stageAdvanceBlocked ? (
                    <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 4, lineHeight: 1.6 }}>
                      Stage progression blocked{selectedProofCheckpoint.blockedProgressionReason ? ` · ${selectedProofCheckpoint.blockedProgressionReason}` : ''}.
                    </div>
                  ) : null}
                </Card>
                <Card style={{ padding: 12, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>No-Action Comparator</div>
                  <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                    {selectedProofCheckpoint.noActionHighRiskCount ?? 0} high-risk rows without simulated support
                  </div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Average Risk Change</div>
                  <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                    {selectedProofCheckpoint.averageRiskChangeFromPreviousCheckpointScaled ?? selectedProofCheckpoint.averageRiskDeltaScaled ?? 0} scaled points
                  </div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Average Counterfactual Lift</div>
                  <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                    {selectedProofCheckpoint.averageCounterfactualLiftScaled ?? 0} scaled points
                  </div>
                </Card>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
                  <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Stage queue preview</div>
                  {selectedProofCheckpointDetail?.queuePreview.length ? selectedProofCheckpointDetail.queuePreview.slice(0, 8).map(item => (
                    <Card key={item.simulationStageQueueProjectionId} style={{ padding: 10, background: T.surface }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · {item.assignedToRole} · {item.riskBand} · {item.status}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                        {item.taskType} · action {item.simulatedActionTaken ?? item.recommendedAction ?? 'none'} · risk {item.riskProbScaled}%{item.noActionRiskProbScaled != null ? ` vs no-action ${item.noActionRiskProbScaled}%` : ''}.
                      </div>
                      {item.coEvidenceMode ? (
                        <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                          CO evidence mode: {item.coEvidenceMode}.
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {item.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={item.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : item.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${item.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${item.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                        {item.counterfactualLiftScaled != null ? <Chip color={item.counterfactualLiftScaled > 0 ? T.success : item.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${item.counterfactualLiftScaled > 0 ? '+' : ''}${item.counterfactualLiftScaled}`}</Chip> : null}
                      </div>
                    </Card>
                  )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No stage queue items exist at this checkpoint.</div>}
                </Card>

                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
                  <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Offering action summary</div>
                  {selectedProofCheckpointDetail?.offeringRollups.length ? selectedProofCheckpointDetail.offeringRollups.slice(0, 8).map(item => {
                    const projection = item.projection
                    const averageRisk = typeof projection.averageRiskProbScaled === 'number' ? projection.averageRiskProbScaled : null
                    const openQueueCount = typeof projection.openQueueCount === 'number' ? projection.openQueueCount : null
                    return (
                      <Card key={item.simulationStageOfferingProjectionId} style={{ padding: 10, background: T.surface }}>
                        <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · Section {item.sectionCode}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                          {item.pendingAction ?? 'No pending action'}{averageRisk != null ? ` · avg risk ${averageRisk}%` : ''}{openQueueCount != null ? ` · open queue ${openQueueCount}` : ''}.
                        </div>
                        {typeof projection.coEvidenceMode === 'string' && projection.coEvidenceMode.length > 0 ? (
                          <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                            CO evidence mode: {projection.coEvidenceMode}.
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          {typeof projection.riskChangeFromPreviousCheckpointScaled === 'number' ? <Chip color={projection.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : projection.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${projection.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${projection.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                          {typeof projection.counterfactualLiftScaled === 'number' ? <Chip color={projection.counterfactualLiftScaled > 0 ? T.success : projection.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${projection.counterfactualLiftScaled > 0 ? '+' : ''}${projection.counterfactualLiftScaled}`}</Chip> : null}
                        </div>
                      </Card>
                    )
                  }) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No offering rollups are available for this checkpoint.</div>}
                </Card>
              </div>
            </Card>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Imports</div>
              {proofDashboard?.imports.length ? proofDashboard.imports.slice(0, 3).map(item => (
                <Card key={item.curriculumImportVersionId} style={{ padding: 10, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.sourceLabel}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {item.status} · {item.validationStatus} · {item.unresolvedMappingCount} unresolved mappings
                  </div>
                </Card>
              )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof imports yet.</div>}
            </Card>

            <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Crosswalk Review</div>
              {proofDashboard?.crosswalkReviewQueue.length ? proofDashboard.crosswalkReviewQueue.slice(0, 5).map(item => (
                <Card key={item.officialCodeCrosswalkId} style={{ padding: 10, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.internalCompilerId}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {item.officialWebCode ?? 'No public code'} · {item.confidence}
                  </div>
                </Card>
              )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No pending crosswalk reviews.</div>}
            </Card>

            <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Runs</div>
              {proofDashboard?.proofRuns.length ? proofDashboard.proofRuns.slice(0, 4).map(item => (
                <Card key={item.simulationRunId} style={{ padding: 10, background: T.surface2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.runLabel}</div>
                    <Chip color={item.activeFlag ? T.success : T.dim}>{item.activeFlag ? 'Active' : item.status}</Chip>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Seed {item.seed} · {new Date(item.createdAt).toLocaleString('en-IN')}</div>
                  {item.progress ? (
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      {String(item.progress.phase ?? item.status)} · {String(item.progress.percent ?? 0)}%
                    </div>
                  ) : null}
                  {item.queueAgeSeconds != null || item.leaseState || item.retryState ? (
                    <div style={{ ...mono, fontSize: 10, color: item.leaseState === 'expired' ? T.warning : T.muted, marginTop: 4, lineHeight: 1.6 }}>
                      Queue age {formatAgeSeconds(item.queueAgeSeconds)} · lease {formatLeaseState(item.leaseState)}{item.retryState ? ` · ${item.retryState}` : ''}
                    </div>
                  ) : null}
                  {item.failureMessage ? (
                    <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 4, lineHeight: 1.6 }}>{item.failureMessage}</div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {!item.activeFlag && item.status === 'completed' ? <Btn size="sm" variant="ghost" onClick={() => onActivateProofRun(item.simulationRunId)}>Set Active</Btn> : null}
                    {item.status === 'failed' ? <Btn size="sm" variant="ghost" onClick={() => onRetryProofRun(item.simulationRunId)}>Retry</Btn> : null}
                    <Btn size="sm" variant="ghost" onClick={() => onArchiveProofRun(item.simulationRunId)}>Archive</Btn>
                    {activeRunSnapshots[0] ? <Btn size="sm" variant="ghost" onClick={() => onRestoreProofSnapshot(item.simulationRunId, activeRunSnapshots[0]?.simulationResetSnapshotId)}>Restore Snapshot</Btn> : null}
                  </div>
                </Card>
              )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof simulation runs yet.</div>}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Teacher Load</div>
              {activeRunDetail.teacherAllocationLoad.slice(0, 6).map(load => (
                <Card key={load.teacherLoadProfileId} style={{ padding: 10, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>{load.facultyName}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    Sem {load.semesterNumber} · {load.weeklyContactHours} contact hrs · {load.assignedCredits} credits
                  </div>
                </Card>
              ))}
            </Card>

            <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Queue Preview</div>
              {activeRunDetail.queuePreview.length ? activeRunDetail.queuePreview.map(item => (
                <Card key={item.reassessmentEventId} style={{ padding: 10, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.studentName} · {item.courseCode}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {item.assignedToRole} · {item.status} · due {new Date(item.dueAt).toLocaleString('en-IN')}
                  </div>
                  {item.sourceKind === 'checkpoint-playback' ? (
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      Playback fallback · {item.stageLabel ?? 'checkpoint-sourced'}
                    </div>
                  ) : null}
                  {item.coEvidenceMode ? (
                    <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                      CO evidence mode: {item.coEvidenceMode}.
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {item.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={item.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : item.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${item.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${item.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                    {item.counterfactualLiftScaled != null ? <Chip color={item.counterfactualLiftScaled > 0 ? T.success : item.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${item.counterfactualLiftScaled > 0 ? '+' : ''}${item.counterfactualLiftScaled}`}</Chip> : null}
                  </div>
                </Card>
              )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No active reassessment queue items.</div>}
            </Card>

            <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Lifecycle Audit</div>
              {lifecycleAudit.length ? lifecycleAudit.slice(0, 6).map(item => (
                <Card key={item.simulationLifecycleAuditId} style={{ padding: 10, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.actionType}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {item.createdByFacultyName ?? 'System'} · {new Date(item.createdAt).toLocaleString('en-IN')}
                  </div>
                </Card>
              )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof lifecycle audit entries yet.</div>}
            </Card>
          </div>
        </div>
      ) : (
        <InfoBanner message="No proof run exists for this batch yet. Create an import, approve it, then start the first run." />
      )}
    </Card>
  )
}
