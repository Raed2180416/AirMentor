import { motion } from 'framer-motion'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type {
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiSimulationStageCheckpointSummary,
} from './api/types'
import { T, mono, sora } from './data'
import { describeProofAvailability, describeProofProvenance, type ProofProvenanceLike } from './proof-provenance'
import { ProofSurfaceHero, ProofSurfaceLauncher, ProofSurfaceTabPanel, ProofSurfaceTabs } from './proof-surface-shell'
import { InfoBanner, RestoreBanner } from './system-admin-ui'
import { Btn, Card, Chip, getAccessiblePrimaryAccent } from './ui-primitives'

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
type ProofDashboardTabId = 'summary' | 'checkpoint' | 'diagnostics' | 'operations'
const proofDashboardTabStorageKey = 'airmentor-system-admin-proof-dashboard-tab'

function readStoredProofDashboardTab(): ProofDashboardTabId | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(proofDashboardTabStorageKey)
  return value === 'summary' || value === 'checkpoint' || value === 'diagnostics' || value === 'operations'
    ? value
    : null
}

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

function formatOperationalEventDetails(details: Record<string, unknown>) {
  const summaryEntries = Object.entries(details).slice(0, 3).map(([key, value]) => {
    if (value == null) return `${key}: null`
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return `${key}: ${String(value)}`
    }
    return `${key}: ${JSON.stringify(value)}`
  })
  return summaryEntries.length > 0 ? summaryEntries.join(' · ') : 'No additional details.'
}

function readDiagnosticNumber(record: DiagnosticsRecord, key: string) {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>)[key]
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function readDiagnosticRecord(record: DiagnosticsRecord, key: string) {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>)[key]
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function formatDiagnosticModeLabel(value: string) {
  return value.replaceAll('-', ' ')
}

function summarizeCoEvidenceMix(summary: DiagnosticsRecord) {
  const byMode = readDiagnosticRecord(summary, 'byMode')
  if (!byMode) return null
  const entries = Object.entries(byMode)
    .map(([mode, count]) => [mode, Number(count)] as const)
    .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]) && entry[1] > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  if (entries.length === 0) return null
  return entries
    .slice(0, 3)
    .map(([mode, count]) => `${formatDiagnosticModeLabel(mode)} ${count}`)
    .join(' · ')
}

type CompactStatCardProps = {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: string
}

function CompactStatCard({ label, value, detail, tone = T.accent }: CompactStatCardProps) {
  return (
    <Card style={{ padding: 12, background: T.surface, minHeight: 88, display: 'grid', gap: 6 }}>
      <div style={{ ...mono, fontSize: 10, color: tone }}>{label}</div>
      <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.6 }}>{value}</div>
      {detail ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{detail}</div> : null}
    </Card>
  )
}

type ScrollCardProps = {
  title: string
  eyebrow?: string
  maxHeight?: number
  children: ReactNode
}

function ScrollCard({ title, eyebrow, maxHeight = 240, children }: ScrollCardProps) {
  return (
    <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
      {eyebrow ? <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{eyebrow}</div> : null}
      <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
      <div
        data-proof-scroll-region={title.toLowerCase().replaceAll(' ', '-')}
        style={{ maxHeight, overflowY: 'auto', paddingRight: 4, display: 'grid', gap: 8, scrollbarGutter: 'stable' }}
      >
        {children}
      </div>
    </Card>
  )
}

type CheckpointEvidenceView = 'queue' | 'offerings'

type SystemAdminProofDashboardWorkspaceProps = {
  proofDashboard: ApiProofDashboard | null
  proofDashboardLoading: boolean
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
  onCreateProofRun: () => void
  onRecomputeProofRunRisk: () => void
  onActivateProofRun: (simulationRunId: string) => void
  onActivateProofSemester: (simulationRunId: string, semesterNumber: number) => void
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
  onCreateProofImport,
  onValidateLatestProofImport,
  onReviewPendingCrosswalks,
  onApproveLatestProofImport,
  onCreateProofRun,
  onRecomputeProofRunRisk,
  onActivateProofRun,
  onActivateProofSemester,
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
  const [activeDashboardTab, setActiveDashboardTab] = useState<ProofDashboardTabId>(() => initialActiveDashboardTab ?? readStoredProofDashboardTab() ?? 'summary')
  const [activeCheckpointEvidenceView, setActiveCheckpointEvidenceView] = useState<CheckpointEvidenceView>('queue')
  const previousSelectedCheckpointId = useRef<string | null>(null)
  useEffect(() => {
    if (proofDashboardLoading) return
    if (!selectedProofCheckpoint && activeDashboardTab === 'checkpoint') {
      setActiveDashboardTab('summary')
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
      setActiveDashboardTab('checkpoint')
    }
    previousSelectedCheckpointId.current = currentSelectedCheckpointId
  }, [activeDashboardTab, initialActiveDashboardTab, selectedProofCheckpoint])
  const activeRunDetail = proofDashboard?.activeRunDetail ?? null
  const accessibleRailEyebrowColor = getAccessiblePrimaryAccent()
  const activeRunSnapshots = activeRunDetail?.snapshots ?? []
  const activeQueueDiagnostics = activeRunDetail?.queueDiagnostics
  const activeWorkerDiagnostics = activeRunDetail?.workerDiagnostics ?? null
  const activeCheckpointReadiness = activeRunDetail?.checkpointReadiness
  const activeOperationalSemester = activeRunDetail?.activeOperationalSemester ?? null
  const availableOperationalSemesters = Array.from(new Set(
    activeRunCheckpoints
      .map(item => item.semesterNumber)
      .filter((value): value is number => Number.isFinite(value)),
  )).sort((left, right) => left - right)
  const playbackOverridesActiveSemester = !!(
    selectedProofCheckpoint
    && activeOperationalSemester != null
    && selectedProofCheckpoint.semesterNumber !== activeOperationalSemester
  )
  const lifecycleAudit = proofDashboard?.lifecycleAudit ?? []
  const recentOperationalEvents = proofDashboard?.recentOperationalEvents ?? []
  const importsCount = proofDashboard?.imports.length ?? 0
  const crosswalkReviewCount = proofDashboard?.crosswalkReviewQueue.length ?? 0
  const proofRunCount = proofDashboard?.proofRuns.length ?? 0
  const teacherLoadCount = activeRunDetail?.teacherAllocationLoad.length ?? 0
  const queuePreviewCount = activeRunDetail?.queuePreview.length ?? 0
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
  const coEvidenceMixSummary = summarizeCoEvidenceMix(coEvidenceDiagnostics)
  const hasStoredProductionArtifact = !!activeProductionDiagnostics
  const hasRuntimeGovernedDiagnostics = (
    (activeRunDetail?.modelDiagnostics.activeRunFeatureRowCount ?? 0) > 0
    || (activeRunDetail?.modelDiagnostics.sourceRunCount ?? 0) > 0
    || (coEvidenceTotalRows ?? 0) > 0
    || !!activeDiagnosticsPolicyDiagnostics
  )
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
  const evaluationStatusLine = productionEvaluationKeys
    ? `Evaluation keys: ${productionEvaluationKeys}`
    : hasRuntimeGovernedDiagnostics
      ? 'Runtime diagnostics are available for this run even though no stored evaluation artifact is active.'
      : 'No evaluation payload is available.'
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
  const dashboardProvenance: ProofProvenanceLike | null = activeRunDetail
    ? {
        scopeDescriptor: {
          scopeType: 'proof',
          scopeId: selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail.simulationRunId,
          label: selectedProofCheckpoint ? `System admin proof route · ${selectedProofCheckpoint.stageLabel}` : 'System admin proof route',
          batchId: null,
          sectionCode: null,
          branchName: null,
          simulationRunId: activeRunDetail.simulationRunId,
          simulationStageCheckpointId: selectedProofCheckpoint?.simulationStageCheckpointId ?? null,
          studentId: null,
        },
        resolvedFrom: {
          kind: selectedProofCheckpoint ? 'proof-checkpoint' : 'proof-run',
          scopeType: 'proof',
          scopeId: selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail.simulationRunId,
          label: selectedProofCheckpoint ? `${selectedProofCheckpoint.stageLabel} · ${activeRunDetail.runLabel}` : activeRunDetail.runLabel,
        },
        scopeMode: 'proof',
        countSource: selectedProofCheckpoint ? 'proof-checkpoint' : 'proof-run',
        activeOperationalSemester,
      }
    : null
  const hasQueuePreview = (selectedProofCheckpointDetail?.queuePreview.length ?? 0) > 0
  const hasOfferingRollups = (selectedProofCheckpointDetail?.offeringRollups.length ?? 0) > 0
  useEffect(() => {
    if (activeCheckpointEvidenceView === 'queue' && hasQueuePreview) return
    if (activeCheckpointEvidenceView === 'offerings' && hasOfferingRollups) return
    if (hasQueuePreview) {
      setActiveCheckpointEvidenceView('queue')
      return
    }
    if (hasOfferingRollups) {
      setActiveCheckpointEvidenceView('offerings')
      return
    }
    setActiveCheckpointEvidenceView('queue')
  }, [activeCheckpointEvidenceView, hasOfferingRollups, hasQueuePreview, selectedProofCheckpoint?.simulationStageCheckpointId])
  const actionPressureDetail = [
    `${activeQueueDiagnostics?.queuedRunCount ?? 0} queued · ${activeQueueDiagnostics?.runningRunCount ?? 0} running · ${activeQueueDiagnostics?.failedRunCount ?? 0} failed`,
    activeCheckpointReadiness
      ? `${activeCheckpointReadiness.readyCheckpointCount ?? 0}/${activeCheckpointReadiness.totalCheckpointCount ?? 0} checkpoints ready`
      : null,
    activeWorkerDiagnostics?.leaseState
      ? `Worker ${formatLeaseState(activeWorkerDiagnostics.leaseState)} · ${activeWorkerDiagnostics.progressPhase ?? 'idle'}`
      : null,
  ].filter((value): value is string => Boolean(value)).join(' · ')

  return (
    <ProofSurfaceHero
      surface="system-admin-proof-control-plane"
      entityId={selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail?.simulationRunId ?? undefined}
      eyebrow="Proof Control Plane"
      title="Proof Control Plane"
      description="A compact proof shell for run control, checkpoint playback, and runtime evidence."
      headerActions={(
        <>
          <Btn size="sm" dataProofAction="proof-create-import" onClick={onCreateProofImport}>Create Import</Btn>
          <Btn size="sm" dataProofAction="proof-run-rerun" onClick={onCreateProofRun} disabled={!importsCount}>Run / Rerun</Btn>
          <Btn size="sm" variant="ghost" dataProofAction="proof-recompute-risk" onClick={onRecomputeProofRunRisk} disabled={!activeRunDetail}>Recompute Risk</Btn>
        </>
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
            />
          ) : null}
          {playbackOverridesActiveSemester ? (
            <InfoBanner
              tone="neutral"
              message={`Playback override active. The dashboard is pinned to Semester ${selectedProofCheckpoint?.semesterNumber} · ${selectedProofCheckpoint?.stageLabel}, while the operational semester remains Semester ${activeOperationalSemester}.`}
            />
          ) : null}
        </>
      ) : null}
      style={{ padding: 14, background: T.surface2, gap: 14 }}
    >
      <ProofSurfaceLauncher
        targetId="system-admin-proof-controls"
        label="Jump to proof controls"
        disabled={!activeRunDetail}
        dataProofEntityId={selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail?.simulationRunId}
      />

      {activeRunDetail ? (
        <motion.div layout id="system-admin-proof-controls" style={{ display: 'grid', gap: 14 }}>
          <Card data-proof-section="proof-dashboard-rail" style={{ padding: 12, background: T.surface, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: 4, minWidth: 220, flex: 1 }}>
                <div style={{ ...mono, fontSize: 10, color: accessibleRailEyebrowColor }}>Proof workflow rail</div>
                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Semester + checkpoint controls stay visible here.</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                  Use this rail to activate the live proof semester, step playback, and inspect the selected checkpoint without bouncing between tabs.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Chip color={T.success}>Run {activeRunDetail.runLabel}</Chip>
                <Chip color={activeOperationalSemester != null ? T.accent : T.dim}>
                  {activeOperationalSemester != null ? `Semester ${activeOperationalSemester}` : 'Semester unavailable'}
                </Chip>
                <Chip color={selectedProofCheckpoint ? T.warning : T.dim}>
                  {selectedProofCheckpoint ? `${selectedProofCheckpoint.stageLabel} · S${selectedProofCheckpoint.semesterNumber}` : 'No checkpoint selected'}
                </Chip>
                <Chip color={T.dim}>{`${activeQueueDiagnostics?.queuedRunCount ?? 0} queued`}</Chip>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Operational semester</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2, scrollbarGutter: 'stable' }}>
                {availableOperationalSemesters.map(semesterNumber => (
                  <Btn
                    key={semesterNumber}
                    size="sm"
                    variant={semesterNumber === activeOperationalSemester ? 'solid' : 'ghost'}
                    dataProofAction={`proof-activate-semester-${semesterNumber}`}
                    disabled={semesterNumber === activeOperationalSemester}
                    onClick={() => onActivateProofSemester(activeRunDetail.simulationRunId, semesterNumber)}
                  >
                    Sem {semesterNumber}
                  </Btn>
                ))}
              </div>
            </div>

            {selectedProofCheckpoint ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: 4, minWidth: 220, flex: 1 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>Selected checkpoint</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.7 }}>
                      Semester {selectedProofCheckpoint.semesterNumber} · {selectedProofCheckpoint.stageLabel} · {selectedProofCheckpoint.stageDescription}
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

                <div data-proof-section="selected-checkpoint-banner">
                  <InfoBanner
                    tone={selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'error' : 'neutral'}
                    message={`Selected checkpoint: semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}. ${selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'Playback progression is blocked until all queue items at this checkpoint are resolved.' : 'This stage is synced into the academic playback overlay for teaching surfaces.'}`}
                  />
                </div>

                <div data-proof-section="checkpoint-buttons" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2, scrollbarGutter: 'stable' }}>
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
              </>
            ) : null}

            {dashboardProvenance ? (
              <details data-proof-section="proof-dashboard-scope-details">
                <summary style={{ ...mono, fontSize: 10, color: T.dim, cursor: 'pointer' }}>Scope details</summary>
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{describeProofProvenance(dashboardProvenance)}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{describeProofAvailability(dashboardProvenance)}</div>
                  {playbackOverridesActiveSemester ? (
                    <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                      Playback override active. The dashboard is pinned to Semester {selectedProofCheckpoint?.semesterNumber} · {selectedProofCheckpoint?.stageLabel}, while the operational semester remains Semester {activeOperationalSemester}.
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </Card>

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

          <ProofSurfaceTabPanel
            idBase="system-admin-proof-dashboard"
            tabId="summary"
            activeTab={activeDashboardTab}
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
                    {activeRunDetail.progress ? <div>{String(activeRunDetail.progress.phase ?? 'running')} · {String(activeRunDetail.progress.percent ?? 0)}%</div> : null}
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

          <ProofSurfaceTabPanel
            idBase="system-admin-proof-dashboard"
            tabId="checkpoint"
            activeTab={activeDashboardTab}
            sectionId="proof-dashboard-checkpoint"
            minHeight={320}
            style={{ gap: 12 }}
          >
            {selectedProofCheckpoint ? (
              <Card data-proof-section="checkpoint-playback" style={{ padding: 12, background: T.surface, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Checkpoint Playback</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                      Evidence for the selected checkpoint. Use the proof rail above to step playback or switch checkpoints.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn
                      size="sm"
                      variant={activeCheckpointEvidenceView === 'queue' ? 'primary' : 'ghost'}
                      onClick={() => setActiveCheckpointEvidenceView('queue')}
                      disabled={!hasQueuePreview}
                    >
                      Queue Detail
                    </Btn>
                    <Btn
                      size="sm"
                      variant={activeCheckpointEvidenceView === 'offerings' ? 'primary' : 'ghost'}
                      onClick={() => setActiveCheckpointEvidenceView('offerings')}
                      disabled={!hasOfferingRollups}
                    >
                      Offering Detail
                    </Btn>
                  </div>
                </div>

                <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
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
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>Risk Movement</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                      {selectedProofCheckpoint.averageRiskChangeFromPreviousCheckpointScaled ?? selectedProofCheckpoint.averageRiskDeltaScaled ?? 0} scaled points
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      {selectedProofCheckpoint.noActionHighRiskCount ?? 0} no-action high-risk rows
                    </div>
                  </Card>
                  <Card style={{ padding: 12, background: T.surface2 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>Counterfactual Lift</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                      {selectedProofCheckpoint.averageCounterfactualLiftScaled ?? 0} scaled points
                    </div>
                  </Card>
                </motion.div>

                <ScrollCard
                  title={activeCheckpointEvidenceView === 'offerings' ? 'Offering action summary' : 'Stage queue preview'}
                  eyebrow="Playback evidence"
                  maxHeight={300}
                >
                  {activeCheckpointEvidenceView === 'offerings'
                    ? selectedProofCheckpointDetail?.offeringRollups.length ? selectedProofCheckpointDetail.offeringRollups.slice(0, 8).map(item => {
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
                    }) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No offering rollups are available for this checkpoint.</div>
                    : selectedProofCheckpointDetail?.queuePreview.length ? selectedProofCheckpointDetail.queuePreview.slice(0, 8).map(item => (
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
                </ScrollCard>
              </Card>
            ) : (
              <InfoBanner message="Select a checkpoint to inspect playback, queue, and offering rollups." />
            )}
          </ProofSurfaceTabPanel>

          <ProofSurfaceTabPanel
            idBase="system-admin-proof-dashboard"
            tabId="diagnostics"
            activeTab={activeDashboardTab}
            sectionId="proof-dashboard-diagnostics"
            minHeight={300}
            style={{ gap: 12 }}
          >
            <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Corpus + Split</div>
                <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.6 }}>Manifest {activeDiagnosticsTrainingManifestVersion ?? 'unknown'}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Splits: {formatSplitSummary(activeDiagnosticsSplitSummary)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Worlds: {formatSplitSummary(activeDiagnosticsWorldSplitSummary)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Scenario families: {formatKeyedCounts(activeModelDiagnostics?.scenarioFamilySummary ?? activeDiagnosticsScenarioFamilies)}</div>
                {activeDiagnosticsHeadSupportSummary ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Head support: {formatHeadSupportSummary(activeDiagnosticsHeadSupportSummary)}</div> : null}
                {activeDiagnosticsGovernedRunCount != null || activeDiagnosticsSkippedRunCount != null ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Governed runs: {activeDiagnosticsGovernedRunCount ?? 'unknown'} · skipped runs: {activeDiagnosticsSkippedRunCount ?? 0}</div> : null}
              </Card>

              <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Calibration + Policy</div>
                <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.6 }}>Calibration {activeDiagnosticsCalibrationVersion ?? 'unknown'}</div>
                {activeDiagnosticsDisplayProbabilityAllowed != null ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Probability display: {activeDiagnosticsDisplayProbabilityAllowed ? 'allowed' : 'band only'}</div> : null}
                {activeDiagnosticsSupportWarning ? <div style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.6 }}>Support: {activeDiagnosticsSupportWarning}</div> : null}
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>{evaluationStatusLine}</div>
                {coEvidenceMixSummary ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>CO evidence mix: {coEvidenceMixSummary}</div> : null}
                {activeDiagnosticsPolicyDiagnostics ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Governed policy: {formatDiagnosticSummary(activeDiagnosticsPolicyDiagnostics)}</div> : null}
                {activeDiagnosticsCoEvidence ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Governed CO evidence: {formatDiagnosticSummary(activeDiagnosticsCoEvidence)}</div> : null}
                {activeDiagnosticsPolicyAcceptance ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Policy gates: {formatDiagnosticSummary(activeDiagnosticsPolicyAcceptance)}</div> : null}
                {activeDiagnosticsOverallCourseRuntime ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Overall-course runtime: {formatDiagnosticSummary(activeDiagnosticsOverallCourseRuntime)}</div> : null}
                {activeDiagnosticsQueueBurden ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Queue burden: {formatDiagnosticSummary(activeDiagnosticsQueueBurden)}</div> : null}
                {activeDiagnosticsUiParity ? <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.6 }}>Active-run parity: {formatDiagnosticSummary(activeDiagnosticsUiParity)}</div> : null}
                {activeProductionDiagnostics?.correlations ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Correlations: {Object.keys(activeProductionDiagnostics.correlations).slice(0, 5).join(' · ') || 'none'}</div> : null}
              </Card>
            </motion.div>
          </ProofSurfaceTabPanel>

          <ProofSurfaceTabPanel
            idBase="system-admin-proof-dashboard"
            tabId="operations"
            activeTab={activeDashboardTab}
            sectionId="proof-dashboard-operations"
            minHeight={320}
            style={{ gap: 12 }}
          >
            <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <ScrollCard title="Administrative Actions" eyebrow="Operations" maxHeight={220}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <Btn size="sm" variant="ghost" dataProofAction="proof-validate-import" onClick={onValidateLatestProofImport} disabled={!importsCount}>Validate Import</Btn>
                  <Btn size="sm" variant="ghost" dataProofAction="proof-review-crosswalks" onClick={onReviewPendingCrosswalks} disabled={!crosswalkReviewCount}>Review Mappings</Btn>
                  <Btn size="sm" variant="ghost" dataProofAction="proof-approve-import" onClick={onApproveLatestProofImport} disabled={!importsCount}>Approve Import</Btn>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                    Imports {importsCount} · Crosswalk review {crosswalkReviewCount} · Runs {proofRunCount} · Teacher load {teacherLoadCount} · Queue preview {queuePreviewCount}
                  </div>
                </div>
              </ScrollCard>

              <ScrollCard title="Imports" eyebrow="Operations" maxHeight={190}>
                {proofDashboard?.imports.length ? proofDashboard.imports.slice(0, 3).map(item => (
                  <Card key={item.curriculumImportVersionId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.sourceLabel}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      {item.status} · {item.validationStatus} · {item.unresolvedMappingCount} unresolved mappings
                    </div>
                  </Card>
                )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof imports yet.</div>}
              </ScrollCard>

              <ScrollCard title="Crosswalk Review" eyebrow="Operations" maxHeight={190}>
                {proofDashboard?.crosswalkReviewQueue.length ? proofDashboard.crosswalkReviewQueue.slice(0, 5).map(item => (
                  <Card key={item.officialCodeCrosswalkId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.internalCompilerId}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      {item.officialWebCode ?? 'No public code'} · {item.confidence}
                    </div>
                  </Card>
                )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No pending crosswalk reviews.</div>}
              </ScrollCard>

              <ScrollCard title="Runs" eyebrow="Operations" maxHeight={190}>
                {proofDashboard?.proofRuns.length ? proofDashboard.proofRuns.slice(0, 4).map(item => (
                  <Card key={item.simulationRunId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.runLabel}</div>
                      <Chip color={item.activeFlag ? T.success : T.dim}>{item.activeFlag ? 'Active' : item.status}</Chip>
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Seed {item.seed} · {new Date(item.createdAt).toLocaleString('en-IN')}</div>
                    {item.progress ? <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{String(item.progress.phase ?? item.status)} · {String(item.progress.percent ?? 0)}%</div> : null}
                    {item.queueAgeSeconds != null || item.leaseState || item.retryState ? (
                      <div style={{ ...mono, fontSize: 10, color: item.leaseState === 'expired' ? T.warning : T.muted, marginTop: 4, lineHeight: 1.6 }}>
                        Queue age {formatAgeSeconds(item.queueAgeSeconds)} · lease {formatLeaseState(item.leaseState)}{item.retryState ? ` · ${item.retryState}` : ''}
                      </div>
                    ) : null}
                    {item.failureMessage ? <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 4, lineHeight: 1.6 }}>{item.failureMessage}</div> : null}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {!item.activeFlag && item.status === 'completed' ? <Btn size="sm" variant="ghost" onClick={() => onActivateProofRun(item.simulationRunId)}>Set Active</Btn> : null}
                      {item.status === 'failed' ? <Btn size="sm" variant="ghost" onClick={() => onRetryProofRun(item.simulationRunId)}>Retry</Btn> : null}
                      <Btn size="sm" variant="ghost" onClick={() => onArchiveProofRun(item.simulationRunId)}>Archive</Btn>
                      {activeRunSnapshots[0] ? <Btn size="sm" variant="ghost" onClick={() => onRestoreProofSnapshot(item.simulationRunId, activeRunSnapshots[0]?.simulationResetSnapshotId)}>Restore Snapshot</Btn> : null}
                    </div>
                  </Card>
                )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof simulation runs yet.</div>}
              </ScrollCard>

              <ScrollCard title="Teacher Load" eyebrow="Operations" maxHeight={190}>
                {activeRunDetail.teacherAllocationLoad.length ? activeRunDetail.teacherAllocationLoad.slice(0, 6).map(load => (
                  <Card key={load.teacherLoadProfileId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{load.facultyName}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      Sem {load.semesterNumber} · {load.weeklyContactHours} contact hrs · {load.assignedCredits} credits
                    </div>
                  </Card>
                )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No teacher-load rows yet.</div>}
              </ScrollCard>

              <ScrollCard title="Queue Preview" eyebrow="Operations" maxHeight={190}>
                {activeRunDetail.queuePreview.length ? activeRunDetail.queuePreview.slice(0, 6).map(item => (
                  <Card key={item.reassessmentEventId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.studentName} · {item.courseCode}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      {item.assignedToRole} · {item.status} · due {new Date(item.dueAt).toLocaleString('en-IN')}
                    </div>
                    {item.sourceKind === 'checkpoint-playback' ? <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Playback fallback · {item.stageLabel ?? 'checkpoint-sourced'}</div> : null}
                    {item.coEvidenceMode ? <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>CO evidence mode: {item.coEvidenceMode}.</div> : null}
                  </Card>
                )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No active reassessment queue items.</div>}
              </ScrollCard>

              <ScrollCard title="Lifecycle Audit" eyebrow="Operations" maxHeight={190}>
                {lifecycleAudit.length ? lifecycleAudit.slice(0, 6).map(item => (
                  <Card key={item.simulationLifecycleAuditId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.actionType}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                      {item.createdByFacultyName ?? 'System'} · {new Date(item.createdAt).toLocaleString('en-IN')}
                    </div>
                  </Card>
                )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof lifecycle audit entries yet.</div>}
              </ScrollCard>

              <ScrollCard title="Recent Operational Events" eyebrow="Operations" maxHeight={190}>
                {recentOperationalEvents.length ? recentOperationalEvents.slice(0, 8).map(item => (
                  <Card key={item.operationalTelemetryEventId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.name}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>
                          {formatOperationalEventDetails(item.details)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Chip color={item.level === 'error' ? T.danger : item.level === 'warn' ? T.warning : T.accent} size={9}>{item.level}</Chip>
                        <Chip color={item.source === 'client' ? T.success : T.dim} size={9}>{item.source}</Chip>
                      </div>
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                      {new Date(item.timestamp).toLocaleString('en-IN')}
                    </div>
                  </Card>
                )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No recent operational events retained yet.</div>}
              </ScrollCard>
            </motion.div>
          </ProofSurfaceTabPanel>
        </motion.div>
      ) : (
        <InfoBanner message="No proof run exists for this batch yet. Create an import, approve it, then start the first run." />
      )}
    </ProofSurfaceHero>
  )
}
