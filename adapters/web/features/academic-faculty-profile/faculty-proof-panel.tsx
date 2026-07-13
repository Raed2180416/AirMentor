import { T, mono } from '@web/simulation/fixtures'
import { describeProofProvenance } from '@web/simulation/proof-provenance'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { ProofSurfaceHero } from '@web/simulation/proof-surface-shell'
import { ProofSimulationControls, type ProofPlaybackControlDirection } from '@web/simulation/proof-simulation-controls'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import {
  formatDateLabel,
  formatEvidencePct,
  subtleDividerStyle,
  type ProofCheckpoint,
  type ProofElectiveFit,
  type ProofMonitoringItem,
  type ProofOps,
  type ProofRunContext,
} from './profile-helpers'

type FacultyProofPanelProps = {
  proofOps: ProofOps | null
  proofModeActive: boolean
  selectedProofCheckpoint: ProofCheckpoint | null
  activeProofRun: ProofRunContext | null
  activeRunCheckpoints: ProofCheckpoint[]
  leadingElectiveFit: ProofElectiveFit | null
  leadingProofQueueItem: ProofMonitoringItem | null
  onOpenStudentProfile: (studentId: string, offeringId?: string | null) => void
  onOpenStudentShell: (studentId: string) => void
  onOpenRiskExplorer: (studentId: string) => void
  onAdvanceProofRun?: (simulationRunId: string, mode: 'day' | 'previous-day' | 'stage') => void
  onStopProofRun?: (simulationRunId: string) => void
  onStepProofPlayback: (direction: ProofPlaybackControlDirection) => void
}

export function FacultyProofPanel({
  proofOps,
  proofModeActive,
  selectedProofCheckpoint,
  activeProofRun,
  activeRunCheckpoints,
  leadingElectiveFit,
  leadingProofQueueItem,
  onOpenStudentProfile,
  onOpenStudentShell,
  onOpenRiskExplorer,
  onAdvanceProofRun,
  onStopProofRun,
  onStepProofPlayback,
}: FacultyProofPanelProps) {
  return (
    <ProofSurfaceHero
      surface="teacher-proof-panel"
      entityId={selectedProofCheckpoint?.simulationStageCheckpointId ?? undefined}
      eyebrow="Proof Control Plane"
      title="Proof Control Plane"
      description="This panel only surfaces rerunnable proof data: active simulation runs, observed risk queue items, and elective-fit summaries. It does not expose latent-state internals."
      style={{ order: -1, gridColumn: '1 / -1' }}
      headerActions={activeProofRun && onAdvanceProofRun ? (
        <ProofSimulationControls
          activeRunDetail={activeProofRun}
          activeRunCheckpoints={activeRunCheckpoints}
          selectedProofCheckpoint={selectedProofCheckpoint}
          selectedProofCheckpointCanStepForward={Boolean(selectedProofCheckpoint?.nextCheckpointId)}
          selectedProofCheckpointCanPlayToEnd={Boolean(selectedProofCheckpoint?.nextCheckpointId)}
          baselineSnapshot={null}
          resetStageSnapshot={null}
          createDisabled
          stopDisabled={!onStopProofRun}
          onCreateProofSimulation={() => undefined}
          onStopProofRun={onStopProofRun ?? (() => undefined)}
          onAdvanceProofRun={onAdvanceProofRun}
          onRestoreProofSnapshot={() => undefined}
          onResetProofRunFromScratch={() => undefined}
          onStepProofPlayback={onStepProofPlayback}
        />
      ) : undefined}
      notices={(
        <div data-proof-section="proof-authority-note" style={{ display: 'grid', gap: 8 }}>
          <InfoBanner message="This proof panel controls the faculty preview data only. Nearby teaching summaries follow the selected preview stage where possible, while permissions and timetable governance stay on live data." />
          {proofOps ? <InfoBanner tone="neutral" message={describeProofProvenance(proofOps)} /> : null}
        </div>
      )}
    >
      {proofOps ? (
        <>
          <div style={{ display: 'grid', gap: 10, minHeight: 320, alignContent: 'start' }}>
            <Card data-proof-section="active-run-contexts" style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>Active run contexts</div>
              {proofOps.activeRunContexts.length > 0 ? proofOps.activeRunContexts.slice(0, 3).map(run => (
                <div key={run.simulationRunId} style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                  {run.batchLabel} · {run.runLabel} · {run.status} · Seed {run.seed} · Created {formatDateLabel(run.createdAt)}
                </div>
              )) : (
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>No active run is linked to this faculty context.</div>
              )}
            </Card>

            {selectedProofCheckpoint ? (
              <Card
                data-proof-section="checkpoint-overlay"
                data-proof-entity-id={selectedProofCheckpoint.simulationStageCheckpointId}
                style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}
              >
                <div style={{ ...mono, fontSize: 10, color: T.text }}>Checkpoint overlay</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                  Sem {selectedProofCheckpoint.semesterNumber} · {selectedProofCheckpoint.stageLabel} · {selectedProofCheckpoint.stageDescription}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Chip color={T.warning}>{`${selectedProofCheckpoint.highRiskCount ?? 0} high watch`}</Chip>
                  <Chip color={T.accent}>{`${selectedProofCheckpoint.openQueueCount ?? 0} open queue`}</Chip>
                  {selectedProofCheckpoint.stageAdvanceBlocked ? <Chip color={T.danger}>Stage blocked</Chip> : null}
                  {selectedProofCheckpoint.blockedProgressionReason ? <Chip color={T.dim}>{selectedProofCheckpoint.blockedProgressionReason}</Chip> : null}
                </div>
              </Card>
            ) : null}

            <Card data-proof-section="monitoring-queue" style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>Monitoring queue</div>
              {proofOps.monitoringQueue.length > 0 ? proofOps.monitoringQueue.slice(0, 3).map(item => (
                <div key={item.riskAssessmentId} style={{ display: 'grid', gap: 8 }}>
                  <div style={subtleDividerStyle} aria-hidden="true" />
                  <div
                    data-proof-row="teacher-monitoring-item"
                    data-proof-student-id={item.studentId}
                    style={{ display: 'grid', gap: 4 }}
                  >
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>
                      {item.studentName} · {item.courseCode} · {item.riskBand} · {humanLabelForActionCode(item.recommendedAction) ?? 'No action'}
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                      Evidence: attendance {formatEvidencePct(item.observedEvidence.attendancePct)}, TT1 {formatEvidencePct(item.observedEvidence.tt1Pct)}, TT2 {formatEvidencePct(item.observedEvidence.tt2Pct)}, quiz {formatEvidencePct(item.observedEvidence.quizPct)}, assignment {formatEvidencePct(item.observedEvidence.assignmentPct)}, SEE {formatEvidencePct(item.observedEvidence.seePct)}, weak COs {item.observedEvidence.weakCoCount}, weak questions {item.observedEvidence.weakQuestionCount}, CGPA {item.observedEvidence.cgpa}, backlogs {item.observedEvidence.backlogCount}.
                    </div>
                    {item.observedEvidence.interventionRecoveryStatus ? (
                      <div style={{ ...mono, fontSize: 10, color: T.dim }}>
                        Intervention recovery status: {item.observedEvidence.interventionRecoveryStatus}.
                      </div>
                    ) : null}
                    {item.observedEvidence.coEvidenceMode ? (
                      <div style={{ ...mono, fontSize: 10, color: T.dim }}>
                        CO evidence mode: {item.observedEvidence.coEvidenceMode}.
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {item.drivers.slice(0, 3).map((driver, index) => (
                        <Chip key={`${item.riskAssessmentId}-${driver.feature}-${index}-${driver.label}`} color={driver.impact >= 0 ? T.danger : T.success}>{driver.label}</Chip>
                      ))}
                      {item.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={item.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : item.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${item.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${item.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                      {item.counterfactualLiftScaled != null ? <Chip color={item.counterfactualLiftScaled > 0 ? T.success : item.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Counterfactual lift ${item.counterfactualLiftScaled > 0 ? '+' : ''}${item.counterfactualLiftScaled}`}</Chip> : null}
                      <Btn
                        size="sm"
                        variant="ghost"
                        dataProofAction="teacher-proof-open-partial-profile"
                        dataProofEntityId={item.studentId}
                        onClick={() => onOpenStudentProfile(item.studentId, item.offeringId)}
                      >
                        Open Student
                      </Btn>
                      <Btn
                        size="sm"
                        variant="ghost"
                        dataProofAction="teacher-proof-open-risk-explorer"
                        dataProofEntityId={item.studentId}
                        onClick={() => onOpenRiskExplorer(item.studentId)}
                      >
                        Open Risk Explorer
                      </Btn>
                      <Btn
                        size="sm"
                        variant="ghost"
                        dataProofAction="teacher-proof-open-student-shell"
                        dataProofEntityId={item.studentId}
                        onClick={() => onOpenStudentShell(item.studentId)}
                      >
                        Open Student Shell
                      </Btn>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>No governed queue items are currently linked to this profile.</div>
              )}
            </Card>

            <Card data-proof-section="elective-fit" style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>{proofModeActive ? 'Proof-semester elective fit' : 'Semester-6 elective fit'}</div>
              {leadingElectiveFit ? (
                <>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>
                    {leadingElectiveFit.studentName} · {leadingElectiveFit.recommendedCode} · {leadingElectiveFit.recommendedTitle}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                    Stream {leadingElectiveFit.stream}. Rationale: {leadingElectiveFit.rationale.slice(0, 3).join(' · ') || 'Observed performance and prerequisite fit.'}
                  </div>
                  <div
                    data-proof-row="teacher-elective-fit"
                    data-proof-student-id={leadingElectiveFit.studentId}
                    style={{ display: 'flex', justifyContent: 'flex-end' }}
                  >
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn
                        size="sm"
                        variant="ghost"
                        dataProofAction="teacher-proof-open-partial-profile"
                        dataProofEntityId={leadingElectiveFit.studentId}
                        onClick={() => onOpenStudentProfile(leadingElectiveFit.studentId)}
                      >
                        Open Student
                      </Btn>
                      <Btn
                        size="sm"
                        variant="ghost"
                        dataProofAction="teacher-proof-open-risk-explorer"
                        dataProofEntityId={leadingElectiveFit.studentId}
                        onClick={() => onOpenRiskExplorer(leadingElectiveFit.studentId)}
                      >
                        Open Risk Explorer
                      </Btn>
                      <Btn
                        size="sm"
                        variant="ghost"
                        dataProofAction="teacher-proof-open-student-shell"
                        dataProofEntityId={leadingElectiveFit.studentId}
                        onClick={() => onOpenStudentShell(leadingElectiveFit.studentId)}
                      >
                        Open Student Shell
                      </Btn>
                    </div>
                  </div>
                  {leadingElectiveFit.alternatives.length > 0 ? (
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                      Alternatives: {leadingElectiveFit.alternatives.slice(0, 3).map(option => option.code).join(' · ')}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>No elective recommendation is currently available for this profile.</div>
              )}
            </Card>

            {activeProofRun ? (
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                Active proof context: {activeProofRun.batchLabel} · {activeProofRun.runLabel} · {activeProofRun.status} · {activeProofRun.branchName ?? 'Branch unavailable'}.
              </div>
            ) : null}
            {selectedProofCheckpoint ? (
              <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>
                Stage overlay active: semester {selectedProofCheckpoint.semesterNumber}, {selectedProofCheckpoint.stageLabel}. This read-only view is aligned to the sysadmin playback checkpoint{selectedProofCheckpoint.stageAdvanceBlocked ? ' and is currently blocked for forward progression.' : ''}.
              </div>
            ) : null}
            {leadingProofQueueItem ? (
              <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>
                Latest queue item: {leadingProofQueueItem.studentName} in {leadingProofQueueItem.courseCode} is marked {leadingProofQueueItem.riskBand} with a follow-up window of {leadingProofQueueItem.dueAt ? formatDateLabel(leadingProofQueueItem.dueAt) : 'unspecified'}.
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof sandbox is attached to this faculty profile yet.</div>
      )}
    </ProofSurfaceHero>
  )
}
