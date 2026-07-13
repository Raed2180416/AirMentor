import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofStudentWatch } from '@web/shared/api/types'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { Btn, Card, Chip, ModalWorkspace, RiskBadge, TH, TD } from '@web/shared/ui/primitives'
import { InfoBanner, MetricCard, formatDateTime } from '@web/features/admin/system-admin-ui'
import { PanelLabel, TableCard } from './hod-shared-components'
import { formatPercent, governedQueueLabel, resolveGovernedQueueState, toRiskBand } from './hod-helpers'

export function HodStudentModal({
  selectedStudent,
  setSelectedStudentId,
  onOpenRiskExplorer,
  onOpenStudentShell,
}: {
  selectedStudent: ApiAcademicHodProofStudentWatch
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string | null>>
  onOpenRiskExplorer: (studentId: string) => void
  onOpenStudentShell: (studentId: string) => void
}) {
  return (
    <ModalWorkspace
      eyebrow="Student Drilldown"
      title={`${selectedStudent.studentName} · ${selectedStudent.usn}`}
      caption="Observed evidence, policy-derived status, semester timeline, and elective-fit context for the active proof run."
      onClose={() => setSelectedStudentId(null)}
      size="xl"
    >
      <div data-proof-surface="hod-student-drilldown" data-proof-student-id={selectedStudent.studentId} style={{ display: 'grid', gap: 16 }}>
        {(() => {
          const governedQueueState = resolveGovernedQueueState(selectedStudent.currentReassessmentStatus)
          return governedQueueState ? (
            <InfoBanner
              tone={governedQueueState === 'open' ? 'error' : governedQueueState === 'watch' ? 'neutral' : 'success'}
              message={`${governedQueueLabel(governedQueueState)}${selectedStudent.nextDueAt ? ` · due ${formatDateTime(selectedStudent.nextDueAt)}` : ''}. Watching remains visible here but does not count as a blocking open case.`}
            />
          ) : null
        })()}
        <div data-proof-section="hod-student-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              size="sm"
              variant="ghost"
              dataProofAction="hod-open-risk-explorer"
              dataProofEntityId={selectedStudent.studentId}
              onClick={() => onOpenRiskExplorer(selectedStudent.studentId)}
            >
              Open Risk Explorer
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              dataProofAction="hod-open-student-shell"
              dataProofEntityId={selectedStudent.studentId}
              onClick={() => onOpenStudentShell(selectedStudent.studentId)}
            >
              Open Student Shell
            </Btn>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <MetricCard label="Section" value={selectedStudent.sectionCode} helper="Current section in the active run." />
          <MetricCard label="Risk" value={`${selectedStudent.currentRiskBand} · ${selectedStudent.currentRiskProbScaled}%`} helper="Current risk band from the observable-only inference layer." />
          {selectedStudent.riskChangeFromPreviousCheckpointScaled != null ? (
            <MetricCard label="Risk Change" value={`${selectedStudent.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${selectedStudent.riskChangeFromPreviousCheckpointScaled}`} helper="Stage-to-stage risk delta from the selected playback checkpoint." />
          ) : null}
          {selectedStudent.counterfactualLiftScaled != null ? (
            <MetricCard label="Counterfactual Lift" value={`${selectedStudent.counterfactualLiftScaled > 0 ? '+' : ''}${selectedStudent.counterfactualLiftScaled}`} helper="Checkpoint replay lift over the no-action comparator." />
          ) : null}
          <MetricCard label="Attendance" value={formatPercent(selectedStudent.observedEvidence.attendancePct)} helper="Current observed attendance in the active semester slice." />
          <MetricCard label="Backlogs" value={String(selectedStudent.observedEvidence.backlogCount)} helper="Transcript-backed backlog count available in the active run context." />
          <MetricCard label="Weak COs" value={String(selectedStudent.observedEvidence.weakCoCount)} helper="Observed COs under the current support threshold." />
          <MetricCard label="Weak Questions" value={String(selectedStudent.observedEvidence.weakQuestionCount)} helper="Question-level weakness count in the active evidence window." />
        </div>

        <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
          <PanelLabel color={T.accent}>Observed</PanelLabel>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current evidence</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip color={T.accent}>{`TT1 ${formatPercent(selectedStudent.observedEvidence.tt1Pct)}`}</Chip>
            <Chip color={T.accent}>{`TT2 ${formatPercent(selectedStudent.observedEvidence.tt2Pct)}`}</Chip>
            <Chip color={T.success}>{`Quiz ${formatPercent(selectedStudent.observedEvidence.quizPct)}`}</Chip>
            <Chip color={T.warning}>{`Assignment ${formatPercent(selectedStudent.observedEvidence.assignmentPct)}`}</Chip>
            <Chip color={T.warning}>{`SEE ${formatPercent(selectedStudent.observedEvidence.seePct)}`}</Chip>
            <Chip color={T.muted}>{`CGPA ${selectedStudent.observedEvidence.cgpa.toFixed(2)}`}</Chip>
          </div>
          {selectedStudent.observedEvidence.interventionRecoveryStatus ? (
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>
              Intervention recovery status: {selectedStudent.observedEvidence.interventionRecoveryStatus}.
            </div>
          ) : null}
          {selectedStudent.observedEvidence.coEvidenceMode ? (
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>
              CO evidence mode: {selectedStudent.observedEvidence.coEvidenceMode}.
            </div>
          ) : null}
        </Card>

        <TableCard title="Course snapshots" caption="Course-specific watch rows available for this student in the active semester.">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Course</TH>
                <TH>Risk</TH>
                <TH>Attendance</TH>
                <TH>Assessment Window</TH>
                <TH>Recommended Action</TH>
              </tr>
            </thead>
            <tbody>
              {selectedStudent.courseSnapshots.map(snapshot => (
                <tr key={snapshot.riskAssessmentId}>
                  <TD>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{snapshot.courseCode}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{snapshot.courseTitle}</div>
                  </TD>
                  <TD><RiskBadge band={toRiskBand(snapshot.riskBand)} prob={snapshot.riskProbScaled / 100} /></TD>
                  <TD>{formatPercent(snapshot.observedEvidence.attendancePct)}</TD>
                  <TD>{`TT1 ${formatPercent(snapshot.observedEvidence.tt1Pct)} · TT2 ${formatPercent(snapshot.observedEvidence.tt2Pct)} · SEE ${formatPercent(snapshot.observedEvidence.seePct)}`}</TD>
                  <TD>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div>{humanLabelForActionCode(snapshot.recommendedAction) ?? 'No action'}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {snapshot.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={snapshot.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : snapshot.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${snapshot.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${snapshot.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                        {snapshot.counterfactualLiftScaled != null ? <Chip color={snapshot.counterfactualLiftScaled > 0 ? T.success : snapshot.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Counterfactual lift ${snapshot.counterfactualLiftScaled > 0 ? '+' : ''}${snapshot.counterfactualLiftScaled}`}</Chip> : null}
                        {snapshot.observedEvidence.coEvidenceMode ? <Chip color={T.dim}>{snapshot.observedEvidence.coEvidenceMode}</Chip> : null}
                      </div>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Semester evidence timeline" caption="Semester-grouped evidence windows already persisted for this student in the proof run.">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Semester</TH>
                <TH>Section</TH>
                <TH>Risk Bands</TH>
                <TH>Evidence Windows</TH>
                <TH>Updated</TH>
              </tr>
            </thead>
            <tbody>
              {selectedStudent.evidenceTimeline.map(item => {
                const riskBands = Array.isArray(item.observedState.riskBands)
                  ? item.observedState.riskBands.filter((value): value is string => typeof value === 'string')
                  : []
                const evidenceWindowCount = typeof item.observedState.evidenceWindowCount === 'number'
                  ? item.observedState.evidenceWindowCount
                  : 1
                return (
                  <tr key={item.studentObservedSemesterStateId}>
                    <TD>{`Sem ${item.semesterNumber}`}</TD>
                    <TD>{item.sectionCode}</TD>
                    <TD>{riskBands.length > 0 ? riskBands.join(', ') : 'Recorded'}</TD>
                    <TD>{evidenceWindowCount}</TD>
                    <TD>{formatDateTime(item.updatedAt)}</TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableCard>

        <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
          <PanelLabel color={T.success}>Policy Derived</PanelLabel>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Elective fit</div>
          {selectedStudent.electiveFit ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip color={T.success}>{selectedStudent.electiveFit.recommendedCode}</Chip>
                <Chip color={T.accent}>{selectedStudent.electiveFit.stream}</Chip>
                <Chip color={T.muted}>{selectedStudent.electiveFit.recommendedTitle}</Chip>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                {selectedStudent.electiveFit.rationale.join(' · ')}
              </div>
            </>
          ) : (
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>No elective recommendation is available for this student in the current proof run.</div>
          )}
        </Card>
      </div>
    </ModalWorkspace>
  )
}
