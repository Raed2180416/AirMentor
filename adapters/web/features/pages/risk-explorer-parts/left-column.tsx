import { TrendingDown } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentRiskExplorer } from '@web/shared/api/types'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner, MetricCard } from '@web/features/admin/system-admin-ui'
import { formatEvidencePct, formatSignedPoints } from './helpers'

export function RiskExplorerLeftColumn({
  explorer,
  activeTab,
}: {
  explorer: ApiStudentRiskExplorer
  activeTab: 'overview' | 'details' | 'advanced'
}) {
  const policyComparison = explorer.policyComparison ?? explorer.currentStatus.policyComparison ?? null
  const counterfactual = explorer.counterfactual
  const xaiRiskReduction = explorer.xaiRiskReduction ?? null
  const policyComparisonCandidates = policyComparison && 'candidates' in policyComparison
    ? policyComparison.candidates
    : []
  const policyComparisonRationale = policyComparison
    ? ('policyRationale' in policyComparison ? policyComparison.policyRationale : policyComparison.rationale)
    : ''

  return (
    <div style={{ flex: '1 1 320px', maxWidth: 360, display: 'grid', gap: 14 }}>
      {(activeTab === 'overview' || activeTab === 'advanced') && (
        <Card data-proof-section="current-status" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current Status</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {explorer.currentStatus.riskBand ? <Chip color={explorer.currentStatus.riskBand === 'High' ? T.danger : explorer.currentStatus.riskBand === 'Medium' ? T.warning : T.success}>{explorer.currentStatus.riskBand}</Chip> : null}
            {explorer.currentStatus.riskProbScaled != null ? <Chip color={T.dim}>{`${explorer.currentStatus.riskProbScaled}%`}</Chip> : null}
            {explorer.currentStatus.queueState ? <Chip color={T.orange}>{explorer.currentStatus.queueState}</Chip> : null}
            {explorer.checkpointContext?.stageAdvanceBlocked ? <Chip color={T.danger}>Checkpoint blocked</Chip> : null}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              Recommended action: {humanLabelForActionCode(explorer.currentStatus.recommendedAction) ?? 'None'}
            </div>
            {explorer.currentStatus.recommendedAction ? (
              <div style={{ ...mono, fontSize: 10, color: T.accent, lineHeight: 1.7, border: `1px solid ${T.border2}`, borderRadius: 10, background: T.surface2, padding: '6px 8px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                Simulated intervention: {humanLabelForActionCode(explorer.currentStatus.recommendedAction)}
              </div>
            ) : null}
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
            Reassessment: {explorer.currentStatus.reassessmentStatus ?? 'None'}{explorer.currentStatus.nextDueAt ? ` · due ${new Date(explorer.currentStatus.nextDueAt).toLocaleString('en-IN')}` : ''}.
          </div>
          {explorer.currentStatus.previousRiskBand || explorer.currentStatus.riskChangeFromPreviousCheckpointScaled != null ? (
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
              Previous band {explorer.currentStatus.previousRiskBand ?? 'NA'}{explorer.currentStatus.previousRiskProbScaled != null ? ` · ${explorer.currentStatus.previousRiskProbScaled}%` : ''}{explorer.currentStatus.riskChangeFromPreviousCheckpointScaled != null ? ` · change ${explorer.currentStatus.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${explorer.currentStatus.riskChangeFromPreviousCheckpointScaled}` : ''}.
            </div>
          ) : null}
        </Card>
      )}

      {activeTab === 'details' && (
        <Card data-proof-section="current-evidence" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current Evidence</div>
          <MetricCard label="Attendance" value={`${explorer.currentEvidence.attendancePct}%`} helper="Checkpoint-visible attendance only." />
          <MetricCard label="TT1 / TT2" value={`${formatEvidencePct(explorer.currentEvidence.tt1Pct)} / ${formatEvidencePct(explorer.currentEvidence.tt2Pct)}`} helper="Observed term-test evidence." />
          <MetricCard label="Quiz / Assignment" value={`${formatEvidencePct(explorer.currentEvidence.quizPct)} / ${formatEvidencePct(explorer.currentEvidence.assignmentPct)}`} helper="Coursework evidence." />
          <MetricCard label="SEE" value={formatEvidencePct(explorer.currentEvidence.seePct)} helper="SEE evidence where available in the selected window." />
          <MetricCard label="Focus Outcomes / Weak Questions" value={`${explorer.currentEvidence.weakCoCount} / ${explorer.currentEvidence.weakQuestionCount}`} helper="Observed weakness counts only." />
        </Card>
      )}

      {activeTab === 'advanced' && (
        <>
          <Card data-proof-section="policy-comparison" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Simulated Intervention / Realized Path</div>
            {policyComparison ? (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {'policyPhenotype' in policyComparison && policyComparison.policyPhenotype ? <Chip color={T.orange}>{policyComparison.policyPhenotype}</Chip> : null}
                  {policyComparison.recommendedAction ? <Chip color={T.accent}>{humanLabelForActionCode(policyComparison.recommendedAction)}</Chip> : null}
                  {policyComparison.simulatedActionTaken ? <Chip color={T.warning}>{humanLabelForActionCode(policyComparison.simulatedActionTaken)}</Chip> : null}
                </div>
                {policyComparisonCandidates.length > 0 ? (
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                    Top action candidates: {policyComparisonCandidates.slice(0, 3).map((item: { action: string; utility: number }) => `${item.action} (${item.utility.toFixed(2)})`).join(' · ')}
                  </div>
                ) : null}
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{policyComparisonRationale}</div>
              </>
            ) : counterfactual ? (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {counterfactual.noActionRiskBand ? <Chip color={T.warning}>{counterfactual.noActionRiskBand}</Chip> : null}
                  {counterfactual.noActionRiskProbScaled != null ? <Chip color={T.dim}>{`${counterfactual.noActionRiskProbScaled}% no action`}</Chip> : null}
                  {counterfactual.counterfactualLiftScaled != null ? <Chip color={counterfactual.counterfactualLiftScaled > 0 ? T.success : counterfactual.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`${counterfactual.counterfactualLiftScaled > 0 ? '+' : ''}${counterfactual.counterfactualLiftScaled} pts`}</Chip> : null}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{counterfactual.note}</div>
              </>
            ) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No checkpoint-bound no-action comparator is available on the active-risk view.</div>
            )}
          </Card>

          <Card data-proof-section="xai-risk-reduction" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingDown size={16} color={T.success} />
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>XAI Risk Reduction</div>
            </div>
            {xaiRiskReduction ? (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip color={T.accent}>{xaiRiskReduction.explanationMode}</Chip>
                  <Chip color={T.dim}>deterministic replay</Chip>
                  {xaiRiskReduction.topDriverEvidence?.length ? <Chip color={T.dim}>observable drivers attached</Chip> : null}
                </div>
                {xaiRiskReduction.summary ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <MetricCard label="Risk reduced by" value={formatSignedPoints(xaiRiskReduction.summary.riskReducedByProbScaled)} helper={xaiRiskReduction.summary.label} />
                    <MetricCard label="No action" value={xaiRiskReduction.summary.baselineRiskProbScaled == null ? 'NA' : `${xaiRiskReduction.summary.baselineRiskProbScaled}%`} helper="Deterministic no-action replay." />
                    <MetricCard label="Realized path" value={xaiRiskReduction.summary.simulatedRiskProbScaled == null ? 'NA' : `${xaiRiskReduction.summary.simulatedRiskProbScaled}%`} helper="Saved checkpoint projection rows." />
                  </div>
                ) : null}
                <div style={{ display: 'grid', gap: 6 }}>
                  {xaiRiskReduction.deltaTimeline.slice(-5).map(point => (
                    <div key={`${point.stageKey}-${point.label}`} style={{ display: 'grid', gap: 4, border: `1px solid ${T.border2}`, borderRadius: 8, padding: 8, background: T.surface2 }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div style={{ ...mono, fontSize: 10, color: T.text }}>{point.label}</div>
                        <Chip color={point.riskReducedByProbScaled > 0 ? T.success : point.riskReducedByProbScaled < 0 ? T.warning : T.dim}>{formatSignedPoints(point.riskReducedByProbScaled)}</Chip>
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                        no action {point.baselineRiskProbScaled}% · realized {point.simulatedRiskProbScaled}%{point.activeInterventions.length > 0 ? ` · ${point.activeInterventions.map(action => humanLabelForActionCode(action) ?? action).join(' · ')}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {xaiRiskReduction.componentImpacts.map(component => (
                    <div key={component.componentKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderTop: `1px solid ${T.border2}`, paddingTop: 6 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{component.componentLabel}</div>
                      <div style={{ ...mono, fontSize: 10, color: component.direction === 'risk-reduction' ? T.success : T.muted }}>
                        {component.baselineScore == null || component.simulatedScore == null ? 'NA' : `${component.baselineScore} -> ${component.simulatedScore} (${formatSignedPoints(component.lift)})`}
                      </div>
                    </div>
                  ))}
                </div>
                <InfoBanner tone="neutral" message={xaiRiskReduction.disclaimer} />
              </>
            ) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No checkpoint replay evidence is available for a risk-reduction explanation.</div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
