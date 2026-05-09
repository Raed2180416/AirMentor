import type { ApiAcademicFacultyProfile } from './api/types'
import { T, mono, sora } from './data'
import { describeProofProvenance } from './proof-provenance'
import { ProofSurfaceLauncher } from './proof-surface-shell'
import { ProofSimulationControls, type ProofAdvanceControlMode, type ProofPlaybackControlDirection } from './proof-simulation-controls'
import { InfoBanner } from './system-admin-ui'
import { Btn, Card, Chip } from './ui-primitives'

type AcademicProofSummaryStripProps = {
  profile: ApiAcademicFacultyProfile | null
  surfaceId: string
  surfaceLabel: string
  onAdvanceProofRun?: (simulationRunId: string, mode: ProofAdvanceControlMode) => void
  onStopProofRun?: (simulationRunId: string) => void
  onStepProofPlayback?: (direction: ProofPlaybackControlDirection) => void
}

function toMetricId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  const metricId = toMetricId(label)
  return (
    <div
      data-proof-summary-metric={metricId}
      style={{ padding: '10px 12px', borderRadius: 10, background: T.surface2, display: 'grid', gap: 4 }}
    >
      <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div data-proof-summary-value={metricId} style={{ ...sora, fontSize: 17, fontWeight: 700, color: T.text }}>{value}</div>
    </div>
  )
}

export function AcademicProofSummaryStrip({
  profile,
  surfaceId,
  surfaceLabel,
  onAdvanceProofRun,
  onStopProofRun,
  onStepProofPlayback,
}: AcademicProofSummaryStripProps) {
  const proofOps = profile?.proofOperations ?? null
  const summarySurfaceId = `${surfaceId}-proof-summary`
  if (!profile || !proofOps) {
    return (
      <Card
        id={summarySurfaceId}
        data-proof-surface="academic-proof-summary"
        data-proof-scope={surfaceId}
        style={{ padding: 16, display: 'grid', gap: 12, marginBottom: 20 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Proof Summary</div>
            <div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{surfaceLabel}</div>
          </div>
          <Chip color={T.dim}>Proof context unavailable</Chip>
        </div>
        <InfoBanner message="This page does not have a proof snapshot yet. The summary stays empty instead of guessing queue counts, semester scope, or monitored students." />
      </Card>
    )
  }

  const selectedCheckpoint = proofOps.selectedCheckpoint
  const semesterMetricLabel = selectedCheckpoint ? 'Selected Checkpoint' : (proofOps.scopeMode === 'proof' ? 'Preview Semester' : 'Live Semester')
  const semesterValue = selectedCheckpoint?.semesterNumber ?? proofOps.activeOperationalSemester
  const semesterMetricValue = selectedCheckpoint
    ? `Semester ${selectedCheckpoint.semesterNumber} · ${selectedCheckpoint.stageLabel}`
    : semesterValue != null
      ? `Semester ${semesterValue}`
      : 'Unavailable'
  const highWatchCount = selectedCheckpoint?.highRiskCount ?? proofOps.monitoringQueue.filter(item => item.riskBand === 'High').length
  const openQueueCount = selectedCheckpoint?.openQueueCount ?? proofOps.monitoringQueue.length
  const monitoredStudentCount = new Set(proofOps.monitoringQueue.map(item => item.studentId)).size
  const electiveFitCount = proofOps.electiveFits.length
  const activeRunCount = proofOps.activeRunContexts.length
  const proofModeChipLabel = proofOps.scopeMode === 'proof' ? 'Preview data' : 'Live data'
  const activeProofRun = proofOps.activeRunContexts[0] ?? null
  const activeRunCheckpoints = proofOps.activeRunCheckpoints ?? []
  const proofControlHandlers = activeProofRun && onAdvanceProofRun && onStepProofPlayback
    ? { onAdvanceProofRun, onStopProofRun, onStepProofPlayback }
    : null

  return (
    <>
      <ProofSurfaceLauncher
        targetId={summarySurfaceId}
        label="Proof Control"
        dataProofEntityId={selectedCheckpoint?.simulationStageCheckpointId ?? proofOps.activeRunContexts[0]?.simulationRunId ?? profile.facultyId}
        popupTitle={`${surfaceLabel} proof context`}
        popupCaption={selectedCheckpoint
          ? `Semester ${selectedCheckpoint.semesterNumber} · ${selectedCheckpoint.stageLabel}`
          : proofOps.scopeDescriptor.label}
        popupContent={() => (
          <div style={{ display: 'grid', gap: 12 }}>
            <InfoBanner message="This popup uses the same proof snapshot as the full proof pages. Queue, monitored-student, and elective-fit counts stay aligned to the selected scope and stage." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <SummaryMetric label={semesterMetricLabel} value={semesterMetricValue} />
              <SummaryMetric label="Open Queue" value={String(openQueueCount)} />
              <SummaryMetric label="Monitored Students" value={String(monitoredStudentCount)} />
              <SummaryMetric label="Elective Fits" value={String(electiveFitCount)} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={T.accent}>{proofOps.scopeDescriptor.label}</Chip>
              <Chip color={proofOps.scopeMode === 'proof' ? T.warning : T.success}>
                {proofModeChipLabel}
              </Chip>
              <Chip color={T.success}>{`${activeRunCount} run${activeRunCount === 1 ? '' : 's'}`}</Chip>
            </div>
            {proofControlHandlers ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ProofSimulationControls
                  activeRunDetail={activeProofRun}
                  activeRunCheckpoints={activeRunCheckpoints}
                  selectedProofCheckpoint={selectedCheckpoint}
                  selectedProofCheckpointCanStepForward={Boolean(selectedCheckpoint?.nextCheckpointId)}
                  selectedProofCheckpointCanPlayToEnd={Boolean(selectedCheckpoint?.nextCheckpointId)}
                  createDisabled
                  stopDisabled={!proofControlHandlers.onStopProofRun}
                  onCreateProofSimulation={() => undefined}
                  onStopProofRun={proofControlHandlers.onStopProofRun ?? (() => undefined)}
                  onAdvanceProofRun={proofControlHandlers.onAdvanceProofRun}
                  onRestoreProofSnapshot={() => undefined}
                  onResetProofRunFromScratch={() => undefined}
                  onStepProofPlayback={proofControlHandlers.onStepProofPlayback}
                />
              </div>
            ) : null}
          </div>
        )}
        popupFooter={({ closePopup, jumpToTarget }) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Btn size="sm" variant="ghost" onClick={jumpToTarget}>Open proof summary</Btn>
            <Btn size="sm" variant="ghost" onClick={closePopup}>Close</Btn>
          </div>
        )}
      />
      <Card
        id={summarySurfaceId}
        data-proof-surface="academic-proof-summary"
        data-proof-scope={surfaceId}
        style={{ padding: 16, display: 'grid', gap: 12, marginBottom: 20 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Proof Summary</div>
            <div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{surfaceLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div data-proof-summary-scope-label={proofOps.scopeDescriptor.label}>
              <Chip color={T.accent}>{proofOps.scopeDescriptor.label}</Chip>
            </div>
            <div data-proof-summary-mode={proofOps.scopeMode}>
              <Chip color={proofOps.scopeMode === 'proof' ? T.warning : T.success}>
                {proofModeChipLabel}
              </Chip>
            </div>
          </div>
        </div>

        <InfoBanner tone="neutral" message={describeProofProvenance(proofOps)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <SummaryMetric label={semesterMetricLabel} value={semesterMetricValue} />
          <SummaryMetric label="High Watch" value={String(highWatchCount)} />
          <SummaryMetric label="Open Queue" value={String(openQueueCount)} />
          <SummaryMetric label="Monitored Students" value={String(monitoredStudentCount)} />
          <SummaryMetric label="Elective Fits" value={String(electiveFitCount)} />
          <SummaryMetric label="Active Runs" value={String(activeRunCount)} />
        </div>
      </Card>
    </>
  )
}
