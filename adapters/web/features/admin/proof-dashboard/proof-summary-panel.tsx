import { motion } from 'framer-motion'
import { T } from '@web/simulation/fixtures'
import type { ApiSimulationStageCheckpointSummary } from '@web/shared/api/types'
import { Chip } from '@web/shared/ui/primitives'
import { ProofSurfaceTabPanel } from '@web/simulation/proof-surface-shell'
import { CompactStatCard } from './proof-dashboard-cards'
import { formatLeaseState, formatProofProgress } from './proof-dashboard-helpers'
import type {
  ProductionDiagnosticsLike,
  ProofActiveRunDetail,
  ProofDashboardTabId,
  ProofQueueDiagnostics,
  ProofResetSnapshot,
} from './proof-dashboard-types'

type ProofSummaryPanelProps = {
  activeTab: ProofDashboardTabId
  activeRunDetail: ProofActiveRunDetail
  activeRunSnapshots: ProofResetSnapshot[]
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  activeQueueDiagnostics: ProofQueueDiagnostics
  coEvidenceTotalRows: number | null
  coEvidenceNonFallbackCount: number | null
  coEvidenceFallbackCount: number
  hasRuntimeGovernedDiagnostics: boolean
  evaluationStatusLine: string
  activeProductionDiagnostics: ProductionDiagnosticsLike
  activeDiagnosticsDisplayProbabilityAllowed: boolean | null | undefined
  activeDiagnosticsSupportWarning: string | null
}

export function ProofSummaryPanel({
  activeTab,
  activeRunDetail,
  activeRunSnapshots,
  selectedProofCheckpoint,
  activeQueueDiagnostics,
  coEvidenceTotalRows,
  coEvidenceNonFallbackCount,
  coEvidenceFallbackCount,
  hasRuntimeGovernedDiagnostics,
  evaluationStatusLine,
  activeProductionDiagnostics,
  activeDiagnosticsDisplayProbabilityAllowed,
  activeDiagnosticsSupportWarning,
}: ProofSummaryPanelProps) {
  const activeWorkerDiagnostics = activeRunDetail?.workerDiagnostics ?? null
  const activeCheckpointReadiness = activeRunDetail?.checkpointReadiness
  const hasStoredProductionArtifact = !!activeProductionDiagnostics
  const riskModelHeadline = hasStoredProductionArtifact
    ? `${activeProductionDiagnostics.artifactVersion} · ${activeRunDetail?.modelDiagnostics.activeRunFeatureRowCount ?? 0} active rows`
    : hasRuntimeGovernedDiagnostics
      ? coEvidenceTotalRows != null && coEvidenceTotalRows > 0
        ? coEvidenceNonFallbackCount && coEvidenceNonFallbackCount > 0
          ? `Playback-governed evidence · ${activeRunDetail?.modelDiagnostics.activeRunFeatureRowCount ?? 0} active rows`
          : `Fallback-heavy playback · ${activeRunDetail?.modelDiagnostics.activeRunFeatureRowCount ?? 0} active rows`
        : `Runtime diagnostics only · ${activeRunDetail?.modelDiagnostics.activeRunFeatureRowCount ?? 0} active rows`
      : 'Heuristic fallback only'
  const riskModelSupport = hasStoredProductionArtifact
    ? `${activeRunDetail?.modelDiagnostics.sourceRunCount ?? 0} run corpus · ${activeRunDetail?.modelDiagnostics.featureRowCount ?? 0} checkpoint rows`
    : hasRuntimeGovernedDiagnostics
      ? coEvidenceTotalRows != null && coEvidenceTotalRows > 0
        ? coEvidenceNonFallbackCount && coEvidenceNonFallbackCount > 0
          ? `${activeRunDetail?.modelDiagnostics.sourceRunCount ?? 0} run corpus · ${activeRunDetail?.modelDiagnostics.featureRowCount ?? 0} checkpoint rows · ${coEvidenceNonFallbackCount}/${coEvidenceTotalRows} non-fallback evidence rows`
          : `${activeRunDetail?.modelDiagnostics.sourceRunCount ?? 0} run corpus · ${activeRunDetail?.modelDiagnostics.featureRowCount ?? 0} checkpoint rows · ${coEvidenceFallbackCount}/${coEvidenceTotalRows} fallback-simulated rows`
        : `${activeRunDetail?.modelDiagnostics.sourceRunCount ?? 0} run corpus · ${activeRunDetail?.modelDiagnostics.featureRowCount ?? 0} checkpoint rows`
      : 'No active local artifact has been trained for this batch yet.'
  const riskModelDetail = [
    evaluationStatusLine,
    !activeProductionDiagnostics && hasRuntimeGovernedDiagnostics
      ? 'No stored production artifact is active; this dashboard is reporting checkpoint-governed runtime diagnostics.'
      : null,
    activeDiagnosticsDisplayProbabilityAllowed != null
      ? `Probability display: ${activeDiagnosticsDisplayProbabilityAllowed ? 'allowed' : 'band only'}`
      : null,
    activeDiagnosticsSupportWarning,
  ].filter((value): value is string => Boolean(value)).join(' · ')
  const actionPressureDetailRows = [
    {
      label: 'Queue Health',
      value: `${activeQueueDiagnostics?.queuedRunCount ?? 0} queued · ${activeQueueDiagnostics?.runningRunCount ?? 0} running · ${activeQueueDiagnostics?.failedRunCount ?? 0} failed`,
    },
    activeCheckpointReadiness
      ? {
          label: 'Checkpoint Readiness',
          value: `${activeCheckpointReadiness.readyCheckpointCount ?? 0}/${activeCheckpointReadiness.totalCheckpointCount ?? 0} checkpoints ready`,
        }
      : null,
    activeWorkerDiagnostics?.leaseState
      ? {
          label: 'Worker Lease',
          value: `${formatLeaseState(activeWorkerDiagnostics.leaseState)} · ${activeWorkerDiagnostics.progressPhase ?? 'idle'}`,
        }
      : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value))
  const actionPressureDetail = actionPressureDetailRows.length > 0 ? (
    <div style={{ display: 'grid', gap: 4 }}>
      {actionPressureDetailRows.map(item => (
        <div key={item.label}>
          <span style={{ color: T.dim }}>{item.label}</span>
          {`: ${item.value}`}
        </div>
      ))}
    </div>
  ) : null

  return (
    <ProofSurfaceTabPanel
      idBase="system-admin-proof-dashboard"
      tabId="summary"
      activeTab={activeTab}
      sectionId="proof-dashboard-summary"
      minHeight={260}
      style={{ gap: 12 }}
    >
      <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <CompactStatCard
          label="Current Proof State"
          value={(
            <div style={{ display: 'grid', gap: 4 }}>
              <div>{activeRunDetail.runLabel}</div>
              <div>Seed {activeRunDetail.seed} · {activeRunDetail.status}</div>
              {activeRunDetail.progress ? <div>{formatProofProgress(activeRunDetail.progress, activeRunDetail.status)}</div> : null}
            </div>
          )}
          detail={activeRunDetail.failureMessage ? activeRunDetail.failureMessage : `${activeRunSnapshots.length} saved snapshots · ${activeRunDetail.monitoringSummary.riskAssessmentCount} watch scores`}
        />

        <CompactStatCard
          label="Selected Checkpoint"
          value={(
            <div style={{ display: 'grid', gap: 6 }}>
              <div>{selectedProofCheckpoint ? `Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}` : 'No checkpoint selected'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedProofCheckpoint ? (
                  <>
                    <Chip color={T.dim}>{`Risk ${selectedProofCheckpoint.highRiskCount ?? 0}/${selectedProofCheckpoint.mediumRiskCount ?? 0}/${selectedProofCheckpoint.lowRiskCount ?? 0}`}</Chip>
                    <Chip color={T.dim}>{`Queue ${selectedProofCheckpoint.openQueueCount ?? 0}/${selectedProofCheckpoint.watchQueueCount ?? 0}/${selectedProofCheckpoint.resolvedQueueCount ?? 0}`}</Chip>
                  </>
                ) : <Chip color={T.dim}>Pick a checkpoint from the rail above.</Chip>}
              </div>
            </div>
          )}
          detail={selectedProofCheckpoint ? `No-Action Comparator ${selectedProofCheckpoint.noActionHighRiskCount ?? 0} · Average Risk Change ${selectedProofCheckpoint.averageRiskChangeFromPreviousCheckpointScaled ?? selectedProofCheckpoint.averageRiskDeltaScaled ?? 0} · Average Counterfactual Lift ${selectedProofCheckpoint.averageCounterfactualLiftScaled ?? 0}` : 'Use the live proof rail to select the semester and checkpoint you want to inspect.'}
        />

        <CompactStatCard
          label="Action Pressure"
          value={`${activeRunDetail.monitoringSummary.activeReassessmentCount} active reassessments · ${activeRunDetail.monitoringSummary.alertDecisionCount} alert decisions`}
          detail={actionPressureDetail}
        />

        <CompactStatCard
          label="Risk Model"
          value={(
            <div style={{ display: 'grid', gap: 4 }}>
              <div>{riskModelHeadline}</div>
              <div>{riskModelSupport}</div>
            </div>
          )}
          detail={riskModelDetail}
        />
      </motion.div>
    </ProofSurfaceTabPanel>
  )
}
