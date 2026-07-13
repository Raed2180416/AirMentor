import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { T } from '@web/simulation/fixtures'
import { ProofSimulationControls } from '@web/simulation/proof-simulation-controls'
import { ProofSurfaceHero, ProofSurfaceLauncher, ProofSurfaceTabs } from '@web/simulation/proof-surface-shell'
import { InfoBanner, RestoreBanner } from './system-admin-ui'
import { Chip } from '@web/shared/ui/primitives'
import type {
  CheckpointEvidenceView,
  ProofDashboardTabId,
  SystemAdminProofDashboardWorkspaceProps,
} from './proof-dashboard/proof-dashboard-types'
import {
  formatProofProgress,
  proofDashboardTabStorageKey,
  readDiagnosticNumber,
  readProgressPhase,
  readStoredProofDashboardTab,
} from './proof-dashboard/proof-dashboard-helpers'
import { ProofDashboardRail } from './proof-dashboard/proof-dashboard-rail'
import { ProofSummaryPanel } from './proof-dashboard/proof-summary-panel'
import { ProofCheckpointPanel } from './proof-dashboard/proof-checkpoint-panel'
import { ProofDiagnosticsPanel } from './proof-dashboard/proof-diagnostics-panel'
import { ProofOperationsPanel } from './proof-dashboard/proof-operations-panel'
import { ProofPendingPanel } from './proof-dashboard/proof-pending-panel'
import { ProofLauncherPopupContent, launcherPopupFooter } from './proof-dashboard/proof-launcher-popup'

export function SystemAdminProofDashboardWorkspace({
  proofDashboard,
  proofDashboardLoading,
  batchSetupReadiness: _batchSetupReadiness = null,
  dashboardLayout = 'embedded',
  showLauncher = true,
  initialActiveDashboardTab,
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
  onValidateLatestProofImport,
  onReviewPendingCrosswalks,
  onApproveLatestProofImport,
  onCreateProofRun,
  onRecomputeProofRunRisk,
  onCreateProofSimulation = onCreateProofRun,
  onActivateProofRun,
  onActivateProofSemester,
  onAdvanceProofRun = () => {},
  onRetryProofRun,
  onStopProofRun = () => {},
  onArchiveProofRun,
  onRestoreProofSnapshot,
  onResetProofRunFromScratch = () => {},
  onResetProofPlaybackSelection,
  onDismissProofPlaybackRestoreNotice,
  onSelectProofCheckpoint,
  onStepProofPlayback,
  formatSplitSummary,
  formatKeyedCounts,
  formatHeadSupportSummary,
  formatDiagnosticSummary,
}: SystemAdminProofDashboardWorkspaceProps) {
  const [activeDashboardTab, setActiveDashboardTab] = useState<ProofDashboardTabId>(() => initialActiveDashboardTab ?? readStoredProofDashboardTab() ?? 'summary')
  const [activeCheckpointEvidenceView, setActiveCheckpointEvidenceView] = useState<CheckpointEvidenceView>('queue')
  const previousSelectedCheckpointId = useRef<string | null>(null)
  useEffect(() => {
    if (proofDashboardLoading) return
    if (!selectedProofCheckpoint && activeDashboardTab === 'checkpoint') {
      const resetToSummaryTimer = window.setTimeout(() => {
        setActiveDashboardTab(currentTab => currentTab === 'checkpoint' ? 'summary' : currentTab)
      }, 0)
      return () => window.clearTimeout(resetToSummaryTimer)
    }
  }, [activeDashboardTab, proofDashboardLoading, selectedProofCheckpoint])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(proofDashboardTabStorageKey, activeDashboardTab)
  }, [activeDashboardTab])
  useEffect(() => {
    const currentSelectedCheckpointId = selectedProofCheckpoint?.simulationStageCheckpointId ?? null
    if (
      initialActiveDashboardTab == null
      && currentSelectedCheckpointId
      && previousSelectedCheckpointId.current !== currentSelectedCheckpointId
      && activeDashboardTab === 'summary'
    ) {
      const openCheckpointTabTimer = window.setTimeout(() => {
        setActiveDashboardTab(currentTab => currentTab === 'summary' ? 'checkpoint' : currentTab)
      }, 0)
      previousSelectedCheckpointId.current = currentSelectedCheckpointId
      return () => window.clearTimeout(openCheckpointTabTimer)
    }
    previousSelectedCheckpointId.current = currentSelectedCheckpointId
  }, [activeDashboardTab, initialActiveDashboardTab, selectedProofCheckpoint])
  const activeRunDetail = proofDashboard?.activeRunDetail ?? null
  const activeRunSnapshots = activeRunDetail?.snapshots ?? []
  const activeRunBaselineSnapshot = activeRunSnapshots.find(item => /baseline/i.test(item.snapshotLabel))
    ?? activeRunSnapshots[0]
  const activeRunResetStageSnapshot = activeRunSnapshots[0] ?? null
  const activeQueueDiagnostics = activeRunDetail?.queueDiagnostics
  const activeOperationalSemester = activeRunDetail?.activeOperationalSemester ?? null
  const playbackOverridesActiveSemester = !!(
    selectedProofCheckpoint
    && activeOperationalSemester != null
    && selectedProofCheckpoint.semesterNumber !== activeOperationalSemester
  )
  const importsCount = proofDashboard?.imports.length ?? 0
  const pendingProofRun = !activeRunDetail
    ? proofDashboard?.proofRuns.find(run => run.status === 'running' || run.status === 'queued') ?? proofDashboard?.proofRuns[0] ?? null
    : null
  const pendingProofRunProgress = pendingProofRun?.progress
  const pendingProofRunPhase = readProgressPhase(pendingProofRunProgress, pendingProofRun?.status ?? 'queued')
  const pendingProofRunPercent = typeof pendingProofRunProgress?.percent === 'number'
    ? Math.max(0, Math.min(100, pendingProofRunProgress.percent))
    : pendingProofRun?.status === 'running' ? 50 : 0
  const pendingProofRunProgressLabel = pendingProofRun
    ? formatProofProgress(pendingProofRun.progress, pendingProofRun.status)
    : null
  const pendingProofRunAge = typeof pendingProofRun?.queueAgeSeconds === 'number'
    ? `${Math.max(0, Math.round(pendingProofRun.queueAgeSeconds))}s in queue`
    : null
  const proofRunStatusColor = (status: string) =>
    status === 'running' ? T.accent : status === 'completed' ? T.success : status === 'failed' ? T.danger : T.dim
  const productionEvaluation = activeProductionDiagnostics?.evaluation
  const productionEvaluationKeys = productionEvaluation && typeof productionEvaluation === 'object'
    ? Object.keys(productionEvaluation as Record<string, unknown>).slice(0, 5).join(' · ') || 'none'
    : null
  const coEvidenceDiagnostics = activeDiagnosticsCoEvidence
  const coEvidenceTotalRows = readDiagnosticNumber(coEvidenceDiagnostics, 'totalRows')
  const coEvidenceFallbackCount = readDiagnosticNumber(coEvidenceDiagnostics, 'fallbackCount') ?? 0
  const coEvidenceNonFallbackCount = coEvidenceTotalRows != null
    ? Math.max(0, coEvidenceTotalRows - coEvidenceFallbackCount)
    : null
  const hasRuntimeGovernedDiagnostics = (
    (activeRunDetail?.modelDiagnostics.activeRunFeatureRowCount ?? 0) > 0
    || (activeRunDetail?.modelDiagnostics.sourceRunCount ?? 0) > 0
    || (coEvidenceTotalRows ?? 0) > 0
    || !!activeDiagnosticsPolicyDiagnostics
  )
  const evaluationStatusLine = productionEvaluationKeys
    ? `Evaluation keys: ${productionEvaluationKeys}`
    : hasRuntimeGovernedDiagnostics
      ? 'Runtime diagnostics are available for this run even though no stored evaluation artifact is active.'
      : 'No evaluation payload is available.'
  const hasQueuePreview = (selectedProofCheckpointDetail?.queuePreview.length ?? 0) > 0
  const hasOfferingRollups = (selectedProofCheckpointDetail?.offeringRollups.length ?? 0) > 0
  useEffect(() => {
    if (activeCheckpointEvidenceView === 'queue' && hasQueuePreview) return
    if (activeCheckpointEvidenceView === 'offerings' && hasOfferingRollups) return
    const nextEvidenceView: CheckpointEvidenceView = hasQueuePreview ? 'queue' : hasOfferingRollups ? 'offerings' : 'queue'
    const syncCheckpointEvidenceViewTimer = window.setTimeout(() => {
      setActiveCheckpointEvidenceView(currentView => currentView === nextEvidenceView ? currentView : nextEvidenceView)
    }, 0)
    return () => window.clearTimeout(syncCheckpointEvidenceViewTimer)
  }, [activeCheckpointEvidenceView, hasOfferingRollups, hasQueuePreview, selectedProofCheckpoint?.simulationStageCheckpointId])
  const proofSimulationControls = (beforeAction?: () => void) => (
    <ProofSimulationControls
      activeRunDetail={activeRunDetail}
      activeRunCheckpoints={activeRunCheckpoints}
      selectedProofCheckpoint={selectedProofCheckpoint}
      selectedProofCheckpointCanStepForward={selectedProofCheckpointCanStepForward}
      selectedProofCheckpointCanPlayToEnd={selectedProofCheckpointCanPlayToEnd}
      baselineSnapshot={activeRunBaselineSnapshot}
      resetStageSnapshot={activeRunResetStageSnapshot}
      createDisabled={proofDashboardLoading}
      onCreateProofSimulation={onCreateProofSimulation}
      onStopProofRun={onStopProofRun}
      onAdvanceProofRun={onAdvanceProofRun}
      onRestoreProofSnapshot={onRestoreProofSnapshot}
      onResetProofRunFromScratch={onResetProofRunFromScratch}
      onStepProofPlayback={onStepProofPlayback}
      onRecomputeProofRunRisk={onRecomputeProofRunRisk}
      beforeAction={beforeAction}
    />
  )

  return (
    <ProofSurfaceHero
      surface="system-admin-proof-control-plane"
      entityId={selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail?.simulationRunId ?? undefined}
      dataProofDashboardLayout={dashboardLayout}
      eyebrow="Simulation Controls"
      title="Simulation Controls"
      description="Import live data, run the simulation, and review results stage by stage using the checkpoint controls below."
      headerActionsLayout="stacked"
      headerActions={(
        proofSimulationControls()
      )}
      badges={activeRunDetail ? (
        <>
          <Chip color={T.success}>Active run {activeRunDetail.runLabel}</Chip>
          <Chip color={activeOperationalSemester != null ? T.accent : T.dim}>
            {activeOperationalSemester != null ? `Semester ${activeOperationalSemester}` : 'Semester unavailable'}
          </Chip>
          <Chip color={selectedProofCheckpoint ? T.warning : T.dim}>
            {selectedProofCheckpoint ? `${selectedProofCheckpoint.stageLabel} · S${selectedProofCheckpoint.semesterNumber}` : 'No checkpoint selected'}
          </Chip>
          <Chip color={T.dim}>{importsCount} imports</Chip>
        </>
      ) : pendingProofRun ? (
        <>
          <Chip color={proofRunStatusColor(pendingProofRun.status)}>{pendingProofRun.status}</Chip>
          <Chip color={T.dim}>{pendingProofRun.runLabel}</Chip>
          <Chip color={T.dim}>{pendingProofRunPhase} · {pendingProofRunPercent}%</Chip>
        </>
      ) : null}
      notices={proofDashboardLoading || proofPlaybackRestoreNotice || playbackOverridesActiveSemester ? (
        <>
          {proofDashboardLoading ? <InfoBanner message="Loading proof control-plane data..." /> : null}
          {proofPlaybackRestoreNotice ? (
            <RestoreBanner
              tone={proofPlaybackRestoreNotice.tone}
              title={proofPlaybackRestoreNotice.tone === 'error' ? 'Proof playback reset required' : 'Proof playback restored'}
              message={proofPlaybackRestoreNotice.message}
              actionLabel="Reset playback"
              onAction={onResetProofPlaybackSelection}
              onDismiss={onDismissProofPlaybackRestoreNotice}
            />
          ) : null}
          {playbackOverridesActiveSemester ? (
            <InfoBanner
              tone="neutral"
              message={`You are viewing Semester ${selectedProofCheckpoint?.semesterNumber} · ${selectedProofCheckpoint?.stageLabel}. Live operations stay on Semester ${activeOperationalSemester} until you switch the live semester.`}
            />
          ) : null}
        </>
      ) : null}
      style={{ padding: 14, background: T.surface2, gap: 14 }}
    >
      {showLauncher ? (
        <ProofSurfaceLauncher
          targetId="system-admin-proof-controls"
          label="Jump to proof controls"
          dataProofEntityId={selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail?.simulationRunId}
          popupTitle="Proof launcher"
          popupCaption="Quick access to the active proof run, semester, and verification state."
          popupContent={(
            <ProofLauncherPopupContent
              activeRunDetail={activeRunDetail}
              selectedProofCheckpoint={selectedProofCheckpoint}
              activeOperationalSemester={activeOperationalSemester}
              activeQueueDiagnostics={activeQueueDiagnostics}
              renderSimulationControls={proofSimulationControls}
            />
          )}
          popupFooter={launcherPopupFooter ?? undefined}
          popupSize="lg"
        />
      ) : null}

      {activeRunDetail ? (
        <motion.div layout id="system-admin-proof-controls" style={{ display: 'grid', gap: 14 }}>
          <ProofDashboardRail
            activeRunDetail={activeRunDetail}
            activeOperationalSemester={activeOperationalSemester}
            activeQueueDiagnostics={activeQueueDiagnostics}
            selectedProofCheckpoint={selectedProofCheckpoint}
            selectedProofCheckpointBlocked={selectedProofCheckpointBlocked}
            selectedProofCheckpointHasBlockedProgression={selectedProofCheckpointHasBlockedProgression}
            selectedProofCheckpointCanStepForward={selectedProofCheckpointCanStepForward}
            selectedProofCheckpointCanPlayToEnd={selectedProofCheckpointCanPlayToEnd}
            activeRunCheckpoints={activeRunCheckpoints}
            activeRunBaselineSnapshot={activeRunBaselineSnapshot}
            playbackOverridesActiveSemester={playbackOverridesActiveSemester}
            onActivateProofSemester={onActivateProofSemester}
            onStepProofPlayback={onStepProofPlayback}
            onResetProofRunFromScratch={onResetProofRunFromScratch}
            onSelectProofCheckpoint={onSelectProofCheckpoint}
          />

          <ProofSurfaceTabs
            idBase="system-admin-proof-dashboard"
            controlId="system-admin-proof-dashboard-tabs"
            ariaLabel="Proof control-plane sections"
            activeTab={activeDashboardTab}
            onChange={tabId => setActiveDashboardTab(tabId as ProofDashboardTabId)}
            tabs={[
              { id: 'summary', label: 'Summary' },
              { id: 'checkpoint', label: 'Checkpoint', disabled: !selectedProofCheckpoint },
              { id: 'diagnostics', label: 'Diagnostics' },
              { id: 'operations', label: 'Operations' },
            ]}
            style={{ position: 'sticky', top: 0, zIndex: 2, background: T.surface2, paddingTop: 2, paddingBottom: 8 }}
          />

          <ProofSummaryPanel
            activeTab={activeDashboardTab}
            activeRunDetail={activeRunDetail}
            activeRunSnapshots={activeRunSnapshots}
            selectedProofCheckpoint={selectedProofCheckpoint}
            activeQueueDiagnostics={activeQueueDiagnostics}
            coEvidenceTotalRows={coEvidenceTotalRows}
            coEvidenceNonFallbackCount={coEvidenceNonFallbackCount}
            coEvidenceFallbackCount={coEvidenceFallbackCount}
            hasRuntimeGovernedDiagnostics={hasRuntimeGovernedDiagnostics}
            evaluationStatusLine={evaluationStatusLine}
            activeProductionDiagnostics={activeProductionDiagnostics}
            activeDiagnosticsDisplayProbabilityAllowed={activeDiagnosticsDisplayProbabilityAllowed}
            activeDiagnosticsSupportWarning={activeDiagnosticsSupportWarning}
          />

          <ProofCheckpointPanel
            activeTab={activeDashboardTab}
            selectedProofCheckpoint={selectedProofCheckpoint}
            selectedProofCheckpointDetail={selectedProofCheckpointDetail}
            activeCheckpointEvidenceView={activeCheckpointEvidenceView}
            setActiveCheckpointEvidenceView={setActiveCheckpointEvidenceView}
            hasQueuePreview={hasQueuePreview}
            hasOfferingRollups={hasOfferingRollups}
          />

          <ProofDiagnosticsPanel
            activeTab={activeDashboardTab}
            activeDiagnosticsTrainingManifestVersion={activeDiagnosticsTrainingManifestVersion}
            activeDiagnosticsCalibrationVersion={activeDiagnosticsCalibrationVersion}
            activeDiagnosticsSplitSummary={activeDiagnosticsSplitSummary}
            activeDiagnosticsWorldSplitSummary={activeDiagnosticsWorldSplitSummary}
            activeModelDiagnostics={activeModelDiagnostics}
            activeDiagnosticsScenarioFamilies={activeDiagnosticsScenarioFamilies}
            activeDiagnosticsHeadSupportSummary={activeDiagnosticsHeadSupportSummary}
            activeDiagnosticsGovernedRunCount={activeDiagnosticsGovernedRunCount}
            activeDiagnosticsSkippedRunCount={activeDiagnosticsSkippedRunCount}
            activeDiagnosticsDisplayProbabilityAllowed={activeDiagnosticsDisplayProbabilityAllowed}
            activeDiagnosticsSupportWarning={activeDiagnosticsSupportWarning}
            evaluationStatusLine={evaluationStatusLine}
            activeDiagnosticsCoEvidence={activeDiagnosticsCoEvidence}
            activeDiagnosticsPolicyDiagnostics={activeDiagnosticsPolicyDiagnostics}
            activeDiagnosticsPolicyAcceptance={activeDiagnosticsPolicyAcceptance}
            activeDiagnosticsOverallCourseRuntime={activeDiagnosticsOverallCourseRuntime}
            activeDiagnosticsQueueBurden={activeDiagnosticsQueueBurden}
            activeDiagnosticsUiParity={activeDiagnosticsUiParity}
            activeProductionDiagnostics={activeProductionDiagnostics}
            formatSplitSummary={formatSplitSummary}
            formatKeyedCounts={formatKeyedCounts}
            formatHeadSupportSummary={formatHeadSupportSummary}
            formatDiagnosticSummary={formatDiagnosticSummary}
          />

          <ProofOperationsPanel
            activeTab={activeDashboardTab}
            proofDashboard={proofDashboard}
            activeRunDetail={activeRunDetail}
            activeRunBaselineSnapshot={activeRunBaselineSnapshot}
            activeRunSnapshots={activeRunSnapshots}
            importsCount={importsCount}
            proofRunStatusColor={proofRunStatusColor}
            onValidateLatestProofImport={onValidateLatestProofImport}
            onReviewPendingCrosswalks={onReviewPendingCrosswalks}
            onApproveLatestProofImport={onApproveLatestProofImport}
            onActivateProofRun={onActivateProofRun}
            onRetryProofRun={onRetryProofRun}
            onArchiveProofRun={onArchiveProofRun}
            onResetProofRunFromScratch={onResetProofRunFromScratch}
            onRestoreProofSnapshot={onRestoreProofSnapshot}
          />
        </motion.div>
      ) : pendingProofRun ? (
        <ProofPendingPanel
          pendingProofRun={pendingProofRun}
          proofRunStatusColor={proofRunStatusColor}
          pendingProofRunProgressLabel={pendingProofRunProgressLabel}
          pendingProofRunPhase={pendingProofRunPhase}
          pendingProofRunPercent={pendingProofRunPercent}
          pendingProofRunAge={pendingProofRunAge}
        />
      ) : (
        <InfoBanner message="No proof run exists for this batch yet. Create an import, approve it, then start the first run." />
      )}
    </ProofSurfaceHero>
  )
}
