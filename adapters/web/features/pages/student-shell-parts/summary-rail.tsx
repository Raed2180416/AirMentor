import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentAgentCard } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner, MetricCard } from '@web/features/admin/system-admin-ui'
import { PanelLabel, formatEvidencePct } from './shared'

export function StudentShellSummaryRail({ card }: { card: ApiStudentAgentCard }) {
  return (
    <div style={{ flex: '1 1 320px', maxWidth: 360, display: 'grid', gap: 14 }}>
      <Card data-proof-section="summary-rail" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Summary Rail</div>
        <div style={{ ...mono, fontSize: 10, color: T.text }}>{card.student.studentName}</div>
        <div style={{ ...mono, fontSize: 10, color: T.muted }}>{card.student.usn} · Section {card.student.sectionCode} · Semester {card.student.currentSemester}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={card.summaryRail.currentRiskBand === 'High' ? T.danger : card.summaryRail.currentRiskBand === 'Medium' ? T.warning : T.success}>
            {card.summaryRail.currentRiskBand ?? 'No watch band'}
          </Chip>
          {card.summaryRail.currentRiskProbScaled != null ? <Chip color={T.dim}>{card.summaryRail.currentRiskProbScaled}%</Chip> : null}
          {card.summaryRail.currentRiskDisplayProbabilityAllowed === false ? <Chip color={T.warning}>Band only</Chip> : null}
          {card.summaryRail.currentRiskCalibrationMethod ? <Chip color={T.orange}>{`Cal ${card.summaryRail.currentRiskCalibrationMethod}`}</Chip> : null}
          {card.checkpointContext?.stageAdvanceBlocked ? <Chip color={T.danger}>Stage blocked</Chip> : null}
          {card.overview.currentEvidence.coEvidenceMode ? <Chip color={T.dim}>{card.overview.currentEvidence.coEvidenceMode}</Chip> : null}
          {card.overview.currentStatus.policyComparison?.policyPhenotype ? <Chip color={T.orange}>{card.overview.currentStatus.policyComparison.policyPhenotype}</Chip> : null}
          {card.summaryRail.previousRiskBand ? <Chip color={T.dim}>{`Prev ${card.summaryRail.previousRiskBand}`}</Chip> : null}
          {card.summaryRail.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={card.summaryRail.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : card.summaryRail.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`${card.summaryRail.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${card.summaryRail.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
          {card.summaryRail.counterfactualLiftScaled != null ? <Chip color={card.summaryRail.counterfactualLiftScaled > 0 ? T.success : card.summaryRail.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Counterfactual lift ${card.summaryRail.counterfactualLiftScaled > 0 ? '+' : ''}${card.summaryRail.counterfactualLiftScaled}`}</Chip> : null}
        </div>
        {card.summaryRail.currentRiskSupportWarning ? <InfoBanner tone="neutral" message={card.summaryRail.currentRiskSupportWarning} /> : null}
        {card.checkpointContext?.stageAdvanceBlocked ? (
          <InfoBanner
            tone="error"
            message={`Playback progression is blocked until ${card.checkpointContext.blockingQueueItemCount ?? 0} queue item(s) at this checkpoint are resolved. This shell stays read-only on the selected proof stage.`}
          />
        ) : null}
        <div style={{ ...mono, fontSize: 10, color: T.text }}>
          {card.summaryRail.primaryCourseCode ?? 'No primary course'}{card.summaryRail.primaryCourseTitle ? ` · ${card.summaryRail.primaryCourseTitle}` : ''}
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.text }}>
          Reassessment: {card.summaryRail.currentReassessmentStatus ?? 'None'}{card.summaryRail.nextDueAt ? ` · due ${new Date(card.summaryRail.nextDueAt).toLocaleString('en-IN')}` : ''}
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.text }}>
          {card.summaryRail.predictedCgpa != null
            ? `Pred CGPA ${card.summaryRail.predictedCgpa.toFixed(2)} · current CGPA ${card.summaryRail.currentCgpa.toFixed(2)} · backlogs ${card.summaryRail.backlogCount}`
            : `CGPA ${card.summaryRail.currentCgpa.toFixed(2)} · backlogs ${card.summaryRail.backlogCount}`}
        </div>
        {card.checkpointContext ? (
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Checkpoint: {card.checkpointContext.stageLabel} · {card.checkpointContext.stageDescription}
          </div>
        ) : null}
        {card.summaryRail.electiveFit ? (
          <Card style={{ padding: 10, background: T.surface2 }}>
            <PanelLabel label="Policy Derived" />
            <div style={{ ...mono, fontSize: 10, color: T.text, marginTop: 6 }}>
              {card.summaryRail.electiveFit.recommendedCode} · {card.summaryRail.electiveFit.recommendedTitle}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
              {card.summaryRail.electiveFit.stream}
            </div>
          </Card>
        ) : null}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <MetricCard label="Attendance" value={`${Math.round(card.overview.currentEvidence.attendancePct)}%`} helper="Current observed attendance" />
        <MetricCard label="TT Window" value={`${formatEvidencePct(card.overview.currentEvidence.tt1Pct)} / ${formatEvidencePct(card.overview.currentEvidence.tt2Pct)}`} helper="TT1 and TT2" />
        <MetricCard label="SEE" value={formatEvidencePct(card.overview.currentEvidence.seePct)} helper="Observed semester-end evidence" />
        <MetricCard label="Weak COs" value={String(card.overview.currentEvidence.weakCoCount)} helper="Current weak course outcomes" />
      </div>
    </div>
  )
}
