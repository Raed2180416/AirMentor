import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentAgentCard } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { PanelLabel, formatEvidencePct } from './shared'

export function StudentShellOverviewTab({ card }: { card: ApiStudentAgentCard }) {
  return (
    <div data-proof-section="overview-panel" style={{ display: 'grid', gap: 14 }}>
      <Card data-proof-section="overview-observed-evidence" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <PanelLabel label={card.overview.observedLabel} />
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current observed evidence</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
          Attendance {Math.round(card.overview.currentEvidence.attendancePct)}% · TT1 {formatEvidencePct(card.overview.currentEvidence.tt1Pct)} · TT2 {formatEvidencePct(card.overview.currentEvidence.tt2Pct)} · quiz {formatEvidencePct(card.overview.currentEvidence.quizPct)} · assignment {formatEvidencePct(card.overview.currentEvidence.assignmentPct)} · SEE {formatEvidencePct(card.overview.currentEvidence.seePct)}.
        </div>
        {card.overview.currentEvidence.coEvidenceMode ? (
          <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>
            CO evidence mode: {card.overview.currentEvidence.coEvidenceMode}.
          </div>
        ) : null}
      </Card>
      <Card data-proof-section="overview-policy-status" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <PanelLabel label={card.overview.policyLabel} />
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current status</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
          Watch {card.overview.currentStatus.riskBand ?? 'Unavailable'}{card.overview.currentStatus.riskProbScaled != null ? ` at ${card.overview.currentStatus.riskProbScaled}%` : card.summaryRail.currentRiskDisplayProbabilityAllowed === false ? ' in band-only mode' : ''} · recommended action {card.overview.currentStatus.recommendedAction ?? 'none'} · reassessment {card.overview.currentStatus.reassessmentStatus ?? 'none'}{card.overview.currentStatus.queueState ? ` · queue ${card.overview.currentStatus.queueState}` : ''}{card.overview.currentStatus.simulatedActionTaken ? ` · simulated action ${card.overview.currentStatus.simulatedActionTaken}` : ''}.
        </div>
        {card.overview.currentStatus.previousRiskBand || card.overview.currentStatus.riskChangeFromPreviousCheckpointScaled != null ? (
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Previous band {card.overview.currentStatus.previousRiskBand ?? 'NA'}{card.overview.currentStatus.previousRiskProbScaled != null ? ` · ${card.overview.currentStatus.previousRiskProbScaled}%` : ''}{card.overview.currentStatus.riskChangeFromPreviousCheckpointScaled != null ? ` · change ${card.overview.currentStatus.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${card.overview.currentStatus.riskChangeFromPreviousCheckpointScaled}` : ''}.
          </div>
        ) : null}
        {card.overview.currentStatus.counterfactualLiftScaled != null ? (
          <div style={{ ...mono, fontSize: 10, color: card.overview.currentStatus.counterfactualLiftScaled > 0 ? T.success : card.overview.currentStatus.counterfactualLiftScaled < 0 ? T.warning : T.dim, lineHeight: 1.8 }}>
            Counterfactual lift vs no-action: {card.overview.currentStatus.counterfactualLiftScaled > 0 ? '+' : ''}{card.overview.currentStatus.counterfactualLiftScaled} scaled points.
          </div>
        ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {card.overview.currentStatus.attentionAreas.map(area => <Chip key={area} color={T.warning}>{area}</Chip>)}
      </div>
    </Card>
    {card.counterfactual ? (
      <Card data-proof-section="no-action-comparator" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <PanelLabel label={card.counterfactual.panelLabel} />
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>No-action view</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
            {card.counterfactual.noActionRiskBand ?? 'Unavailable'}{card.counterfactual.noActionRiskProbScaled != null ? ` at ${card.counterfactual.noActionRiskProbScaled}%` : ''} · lift {card.counterfactual.counterfactualLiftScaled ?? 0} scaled points.
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            {card.counterfactual.note}
          </div>
        </Card>
      ) : null}
      <Card data-proof-section="overview-semester-summary" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <PanelLabel label="Observed" />
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Semester evidence summary</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {card.overview.semesterSummaries.map(item => (
            <Card key={item.semesterNumber} style={{ padding: 10, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>Semester {item.semesterNumber}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                SGPA {item.sgpa.toFixed(2)} · CGPA {item.cgpaAfterSemester.toFixed(2)} · backlogs {item.backlogCount} · weak COs {item.weakCoCount} · question coverage {item.questionResultCoverage}
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  )
}
