import { useEffect, useState } from 'react'
import { Activity, Eye, TrendingDown } from 'lucide-react'
import { T, mono, sora } from '../data'
import type { Role } from '../domain'
import type { ApiFeatureCompleteness, ApiFeatureProvenance, ApiRiskHeadDisplay, ApiStudentRiskExplorer } from '../api/types'
import { Btn, Card, Chip, PageBackButton, PageShell } from '../ui-primitives'
import { EmptyState, InfoBanner, MetricCard } from '../system-admin-ui'

function HeadCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper: string
  tone?: 'danger' | 'warning' | 'success' | 'neutral'
}) {
  const color = tone === 'danger'
    ? T.danger
    : tone === 'warning'
      ? T.warning
      : tone === 'success'
        ? T.success
        : T.text
  return (
    <Card style={{ padding: 14, display: 'grid', gap: 6, background: T.surface2 }}>
      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{helper}</div>
    </Card>
  )
}

function deriveBandLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null
  if (value >= 70) return 'High'
  if (value >= 35) return 'Medium'
  return 'Low'
}

function renderHeadValue(display: ApiRiskHeadDisplay | undefined, value: number | null) {
  if (display?.displayProbabilityAllowed !== false && value != null) return `${value}%`
  const band = display?.riskBand ?? deriveBandLabel(value)
  return band ? `${band} band` : 'Band only'
}

function renderHeadHelper(display: ApiRiskHeadDisplay | undefined, baseHelper: string) {
  const pieces = [baseHelper]
  if (display?.calibrationMethod) pieces.push(`Calibration ${display.calibrationMethod}`)
  if (display?.supportWarning) pieces.push(display.supportWarning)
  return pieces.join(' · ')
}

function renderFeatureCompletenessLabel(featureCompleteness: ApiFeatureCompleteness | null) {
  if (!featureCompleteness) return 'Unavailable'
  return featureCompleteness.fallbackMode === 'graph-aware' ? 'Graph aware' : 'Policy only'
}

function renderFeatureProvenanceValue(featureProvenance: ApiFeatureProvenance | null) {
  if (!featureProvenance) return 'No provenance available'
  const fingerprint = featureProvenance.curriculumFeatureProfileFingerprint
    ? featureProvenance.curriculumFeatureProfileFingerprint.slice(0, 8)
    : 'none'
  const importVersion = featureProvenance.curriculumImportVersionId ?? 'none'
  return `Import ${importVersion} · Fingerprint ${fingerprint} · Nodes ${featureProvenance.graphNodeCount} · Edges ${featureProvenance.graphEdgeCount} · History ${featureProvenance.historyCourseCount}`
}

function DriverList({
  items,
  emptyMessage,
}: {
  items: Array<{ label: string; impact: number; feature?: string }>
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <div style={{ ...mono, fontSize: 10, color: T.muted }}>{emptyMessage}</div>
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((item, index) => (
        <Card key={`${item.feature ?? 'driver'}-${index}`} style={{ padding: 10, background: T.surface2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7 }}>{item.label}</div>
            <Chip color={item.impact >= 0 ? T.warning : T.success}>
              {`${item.impact >= 0 ? '+' : ''}${Math.round(item.impact * 100)} pts`}
            </Chip>
          </div>
        </Card>
      ))}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return <Btn size="sm" variant={active ? 'primary' : 'ghost'} onClick={onClick}>{children}</Btn>
}

export function RiskExplorerPage({
  role,
  studentId,
  onBack,
  loadExplorer,
  initialExplorer,
  initialError = '',
  initialTab,
}: {
  role: Role
  studentId: string
  onBack: () => void
  loadExplorer?: (studentId: string) => Promise<ApiStudentRiskExplorer>
  initialExplorer?: ApiStudentRiskExplorer | null
  initialError?: string
  initialTab?: 'overview' | 'details' | 'advanced'
}) {
  const [explorer, setExplorer] = useState<ApiStudentRiskExplorer | null>(initialExplorer ?? null)
  const [loading, setLoading] = useState(!!loadExplorer && !initialExplorer)
  const [error, setError] = useState(initialError)
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'advanced'>(initialTab ?? 'overview')

  useEffect(() => {
    if (!loadExplorer) return
    let cancelled = false
    setLoading(true)
    setError('')
    void loadExplorer(studentId)
      .then(result => {
        if (!cancelled) setExplorer(result)
      })
      .catch(nextError => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load the risk explorer.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadExplorer, studentId])

  if (loading) {
    return (
      <PageShell size="wide">
        <InfoBanner message="Loading proof risk explorer..." />
      </PageShell>
    )
  }

  if (!explorer) {
    return (
      <PageShell size="wide">
        <div data-proof-surface="risk-explorer" data-proof-state={error ? 'load-error' : 'empty'} style={{ display: 'grid', gap: 12 }}>
          {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}
          <EmptyState title="Risk explorer unavailable" body={error ? 'The proof-backed risk-analysis payload failed to load for this student.' : 'A proof-backed risk-analysis payload could not be built for this student.'} />
        </div>
      </PageShell>
    )
  }

  const headDisplays = explorer.trainedRiskHeadDisplays ?? {}
  const policyComparison = explorer.policyComparison ?? explorer.currentStatus.policyComparison ?? null
  const counterfactual = explorer.counterfactual
  const featureCompleteness = explorer.featureCompleteness ?? explorer.riskCompleteness ?? explorer.prerequisiteMap.completeness ?? null
  const featureProvenance = explorer.featureProvenance ?? null
  const policyComparisonCandidates = policyComparison && 'candidates' in policyComparison
    ? policyComparison.candidates
    : []
  const policyComparisonRationale = policyComparison
    ? ('policyRationale' in policyComparison ? policyComparison.policyRationale : policyComparison.rationale)
    : ''
  const trainedHeads = [
    {
      key: 'attendanceRisk',
      label: 'Attendance / Eligibility',
      value: explorer.trainedRiskHeads.attendanceRiskProbScaled,
      helper: renderHeadHelper(headDisplays.attendanceRisk, 'Observable attendance risk only.'),
      display: headDisplays.attendanceRisk,
    },
    {
      key: 'ceRisk',
      label: 'CE Shortfall',
      value: explorer.trainedRiskHeads.ceRiskProbScaled,
      helper: renderHeadHelper(headDisplays.ceRisk, 'Checkpoint risk of falling below the CE floor.'),
      display: headDisplays.ceRisk,
    },
    {
      key: 'seeRisk',
      label: 'SEE Projection',
      value: explorer.trainedRiskHeads.seeRiskProbScaled,
      helper: renderHeadHelper(headDisplays.seeRisk, 'Checkpoint risk of SEE shortfall from observed signals.'),
      display: headDisplays.seeRisk,
    },
    {
      key: 'overallCourseRisk',
      label: 'Overall Course Fail',
      value: explorer.trainedRiskHeads.overallCourseRiskProbScaled,
      helper: renderHeadHelper(headDisplays.overallCourseRisk, 'Primary trained head for course-level failure pressure.'),
      display: headDisplays.overallCourseRisk,
    },
    {
      key: 'downstreamCarryoverRisk',
      label: 'Carryover',
      value: explorer.trainedRiskHeads.downstreamCarryoverRiskProbScaled,
      helper: renderHeadHelper(headDisplays.downstreamCarryoverRisk, 'Downstream adverse-pressure head over prerequisite chains.'),
      display: headDisplays.downstreamCarryoverRisk,
    },
  ]
  const derivedHeads = [
    { label: 'Semester SGPA Drop', value: explorer.derivedScenarioHeads.semesterSgpaDropRiskProbScaled, helper: 'Derived from trained course heads plus semester trend.' },
    { label: 'Cumulative CGPA Drop', value: explorer.derivedScenarioHeads.cumulativeCgpaDropRiskProbScaled, helper: 'Derived scenario pressure on the running CGPA.' },
    { label: 'Elective Mismatch', value: explorer.derivedScenarioHeads.electiveMismatchRiskProbScaled, helper: 'Derived scenario mismatch pressure for the current elective fit.' },
  ]

  return (
    <PageShell size="wide">
      <div style={{ display: 'grid', gap: 18, paddingBottom: 28 }}>
        <PageBackButton onClick={onBack} dataProofAction="risk-explorer-back" />

        <Card
          data-proof-surface="risk-explorer"
          data-proof-entity-id={explorer.checkpointContext?.simulationStageCheckpointId ?? undefined}
          data-proof-student-id={explorer.student.studentId}
          style={{ padding: 20, display: 'grid', gap: 16, background: `linear-gradient(160deg, ${T.surface}, ${T.surface2})` }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <Activity size={22} color={T.accent} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Student Success Profile</div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 24, color: T.text, marginTop: 8 }}>{explorer.student.studentName}</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{explorer.disclaimer}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={T.accent}>{role}</Chip>
              <Chip color={T.success}>{explorer.runContext.runLabel}</Chip>
              {explorer.modelProvenance.calibrationMethod ? <Chip color={T.orange}>{`Cal ${explorer.modelProvenance.calibrationMethod}`}</Chip> : null}
              {explorer.modelProvenance.displayProbabilityAllowed === false ? <Chip color={T.warning}>Band only</Chip> : null}
              {explorer.modelProvenance.coEvidenceMode ? <Chip color={T.dim}>{explorer.modelProvenance.coEvidenceMode}</Chip> : null}
              {featureCompleteness ? <Chip color={featureCompleteness.complete ? T.success : T.warning}>{renderFeatureCompletenessLabel(featureCompleteness)}</Chip> : null}
              {explorer.checkpointContext ? <Chip color={T.orange}>{`Sem ${explorer.checkpointContext.semesterNumber} · ${explorer.checkpointContext.stageLabel}`}</Chip> : null}
              {explorer.checkpointContext?.stageAdvanceBlocked ? <Chip color={T.danger}>Stage blocked</Chip> : null}
              {explorer.trainedRiskHeads.currentRiskBand ? <Chip color={explorer.trainedRiskHeads.currentRiskBand === 'High' ? T.danger : explorer.trainedRiskHeads.currentRiskBand === 'Medium' ? T.warning : T.success}>{explorer.trainedRiskHeads.currentRiskBand}</Chip> : null}
            </div>
          </div>
          <InfoBanner message={`Proof context ${explorer.runContext.runLabel} · ${explorer.runContext.status} · created ${new Date(explorer.runContext.createdAt).toLocaleString('en-IN')} · model ${explorer.modelProvenance.modelVersion ?? 'fallback'}${explorer.modelProvenance.calibrationVersion ? ` · calibration ${explorer.modelProvenance.calibrationVersion}` : ''}${explorer.checkpointContext ? ` · checkpoint ${explorer.checkpointContext.stageLabel}` : ''}.`} />
          {explorer.modelProvenance.supportWarning ? <InfoBanner tone="neutral" message={explorer.modelProvenance.supportWarning} /> : null}
          {featureCompleteness && !featureCompleteness.complete ? (
            <InfoBanner
              tone="neutral"
              message={`Feature fallback is ${featureCompleteness.fallbackMode}. Missing: ${featureCompleteness.missing.join(' · ') || 'none'}.`}
            />
          ) : null}
          {explorer.checkpointContext?.stageAdvanceBlocked ? (
            <InfoBanner
              tone="error"
              message={`Playback progression is blocked at this checkpoint until ${explorer.checkpointContext.blockingQueueItemCount ?? 0} queue item(s) are resolved. This risk explorer remains read-only on the selected proof stage.`}
            />
          ) : null}
          <div data-proof-section="authority-banner">
            <InfoBanner message="Authoritative proof surface for checkpoint-bound analysis. Trained heads are proof-backed for this selected evidence window; derived scenario heads and policy comparisons remain advisory." />
          </div>
          <Card style={{ padding: 14, display: 'grid', gap: 10, background: T.surface2 }}>
            <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Feature Completeness</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {featureCompleteness ? (
                <>
                  <Chip color={featureCompleteness.complete ? T.success : T.warning}>{featureCompleteness.complete ? 'Complete' : 'Incomplete'}</Chip>
                  <Chip color={featureCompleteness.fallbackMode === 'graph-aware' ? T.success : T.warning}>{renderFeatureCompletenessLabel(featureCompleteness)}</Chip>
                  <Chip color={featureCompleteness.graphAvailable ? T.success : T.danger}>Graph {featureCompleteness.graphAvailable ? 'available' : 'missing'}</Chip>
                  <Chip color={featureCompleteness.historyAvailable ? T.success : T.danger}>History {featureCompleteness.historyAvailable ? 'available' : 'missing'}</Chip>
                </>
              ) : (
                <Chip color={T.dim}>Unavailable</Chip>
              )}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              {featureCompleteness ? `Missing dimensions: ${featureCompleteness.missing.join(' · ') || 'none'}.` : 'No completeness metadata is attached to this proof payload.'}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              {renderFeatureProvenanceValue(featureProvenance)}
            </div>
          </Card>
        </Card>

        {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}
        
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: `1px solid ${T.surface2}`, paddingBottom: 12 }}>
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
          <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Assessment Details</TabButton>
          <TabButton active={activeTab === 'advanced'} onClick={() => setActiveTab('advanced')}>Advanced Diagnostics</TabButton>
        </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {activeTab === 'advanced' && (
            <>
              <Card data-proof-section="trained-risk-heads" style={{ padding: 16, display: 'grid', gap: 10 }}>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Trained Risk Heads</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                  {trainedHeads.map(head => (
                    <HeadCard
                      key={head.key}
                      label={head.label}
                      value={renderHeadValue(head.display, head.value)}
                      helper={head.helper}
                      tone={head.display?.riskBand === 'High' || (head.value != null && head.value >= 70) ? 'danger' : head.display?.riskBand === 'Medium' || (head.value != null && head.value >= 35) ? 'warning' : 'success'}
                    />
                  ))}
                </div>
              </Card>

              <Card data-proof-section="derived-risk-heads" style={{ padding: 16, display: 'grid', gap: 10 }}>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Derived Scenario Heads</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{explorer.derivedScenarioHeads.note}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {derivedHeads.map(head => (
                    <HeadCard
                      key={head.label}
                      label={head.label}
                      value={head.value == null ? 'NA' : `${head.value}%`}
                      helper={head.helper}
                      tone={head.value != null && head.value >= 70 ? 'danger' : head.value != null && head.value >= 35 ? 'warning' : 'success'}
                    />
                  ))}
                </div>
              </Card>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: 16 }}>
            <div style={{ display: 'grid', gap: 14, alignSelf: 'start' }}>
              {(activeTab === 'overview' || activeTab === 'advanced') && (
                <Card data-proof-section="current-status" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current Status</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {explorer.currentStatus.riskBand ? <Chip color={explorer.currentStatus.riskBand === 'High' ? T.danger : explorer.currentStatus.riskBand === 'Medium' ? T.warning : T.success}>{explorer.currentStatus.riskBand}</Chip> : null}
                    {explorer.currentStatus.riskProbScaled != null ? <Chip color={T.dim}>{`${explorer.currentStatus.riskProbScaled}%`}</Chip> : null}
                    {explorer.currentStatus.queueState ? <Chip color={T.orange}>{explorer.currentStatus.queueState}</Chip> : null}
                    {explorer.checkpointContext?.stageAdvanceBlocked ? <Chip color={T.danger}>Checkpoint blocked</Chip> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7 }}>
                      Action Plan: {explorer.currentStatus.recommendedAction ?? 'None'}
                    </div>
                    {explorer.currentStatus.recommendedAction ? (
                      <Btn size="sm" variant="primary">Assign {explorer.currentStatus.recommendedAction.replace(/-/g, ' ')}</Btn>
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
                  {explorer.currentStatus.counterfactualLiftScaled != null && activeTab === 'advanced' ? (
                    <div style={{ ...mono, fontSize: 10, color: explorer.currentStatus.counterfactualLiftScaled > 0 ? T.success : explorer.currentStatus.counterfactualLiftScaled < 0 ? T.warning : T.dim, lineHeight: 1.7 }}>
                      Counterfactual lift vs no-action: {explorer.currentStatus.counterfactualLiftScaled > 0 ? '+' : ''}{explorer.currentStatus.counterfactualLiftScaled} scaled points.
                    </div>
                  ) : null}
                </Card>
              )}

              {activeTab === 'details' && (
                <Card data-proof-section="current-evidence" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current Evidence</div>
                  <MetricCard label="Attendance" value={`${explorer.currentEvidence.attendancePct}%`} helper="Checkpoint-visible attendance only." />
                  <MetricCard label="TT1 / TT2" value={`${explorer.currentEvidence.tt1Pct}% / ${explorer.currentEvidence.tt2Pct}%`} helper="Observed term-test evidence." />
                  <MetricCard label="Quiz / Assignment" value={`${explorer.currentEvidence.quizPct}% / ${explorer.currentEvidence.assignmentPct}%`} helper="Coursework evidence." />
                  <MetricCard label="SEE" value={`${explorer.currentEvidence.seePct}%`} helper="SEE evidence where available in the selected window." />
                  <MetricCard label="Focus Outcomes / Weak Questions" value={`${explorer.currentEvidence.weakCoCount} / ${explorer.currentEvidence.weakQuestionCount}`} helper="Observed weakness counts only." />
                </Card>
              )}

              {activeTab === 'advanced' && (
                <Card data-proof-section="policy-comparison" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Policy Comparison</div>
                  {policyComparison ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {'policyPhenotype' in policyComparison && policyComparison.policyPhenotype ? <Chip color={T.orange}>{policyComparison.policyPhenotype}</Chip> : null}
                        {policyComparison.recommendedAction ? <Chip color={T.accent}>{policyComparison.recommendedAction}</Chip> : null}
                        {policyComparison.simulatedActionTaken ? <Chip color={T.warning}>{policyComparison.simulatedActionTaken}</Chip> : null}
                        {policyComparison.noActionRiskBand ? <Chip color={T.warning}>{policyComparison.noActionRiskBand}</Chip> : null}
                        {policyComparison.noActionRiskProbScaled != null ? <Chip color={T.dim}>{`${policyComparison.noActionRiskProbScaled}% no action`}</Chip> : null}
                        {policyComparison.counterfactualLiftScaled != null ? <Chip color={policyComparison.counterfactualLiftScaled > 0 ? T.success : policyComparison.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`${policyComparison.counterfactualLiftScaled > 0 ? '+' : ''}${policyComparison.counterfactualLiftScaled} pts`}</Chip> : null}
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
              )}
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {activeTab === 'overview' && (
                <Card data-proof-section="top-observable-drivers" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Eye size={16} color={T.accent} />
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Top Observable Drivers</div>
                  </div>
                  <DriverList items={explorer.topDrivers} emptyMessage="No observable driver list is available for this evidence window." />
                </Card>
              )}

              {activeTab === 'advanced' && (
                <Card data-proof-section="cross-course-pressure" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingDown size={16} color={T.warning} />
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Cross-Course And Prerequisite Pressure</div>
                  </div>
                  {explorer.crossCourseDrivers.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {explorer.crossCourseDrivers.map((driver, index) => (
                        <Card key={`${driver}-${index}`} style={{ padding: 10, background: T.surface2 }}>
                          <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7 }}>{driver}</div>
                        </Card>
                      ))}
                    </div>
                  ) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No stable cross-course watch factors are attached to the current evidence row.</div>}
                  <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7 }}>
                    Prerequisites: {explorer.prerequisiteMap.prerequisiteCourseCodes.length > 0 ? explorer.prerequisiteMap.prerequisiteCourseCodes.join(' · ') : 'None tracked on this row.'}
                  </div>
                  {explorer.prerequisiteMap.weakPrerequisiteCourseCodes.length > 0 ? (
                    <div style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.7 }}>
                      Weak prerequisite carryover: {explorer.prerequisiteMap.weakPrerequisiteCourseCodes.join(' · ')}
                    </div>
                  ) : null}
                </Card>
              )}

              {(activeTab === 'details' || activeTab === 'overview') && (
                <Card data-proof-section="weak-course-outcomes" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Focus Outcomes</div>
                  {explorer.weakCourseOutcomes.length > 0 ? explorer.weakCourseOutcomes.map(item => (
                    <Card key={item.coCode} style={{ padding: 10, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.coCode} · {item.coTitle}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>
                        TT1 {item.tt1Pct}% · TT2 {item.tt2Pct}% · SEE {item.seePct}% · trend {item.trend} · gap {item.transferGap}
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{item.topics.join(' · ')}</div>
                    </Card>
                  )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No focus areas are currently surfaced on the proof row.</div>}
                </Card>
              )}

              {activeTab === 'details' && (
                <>
                  <Card data-proof-section="question-patterns" style={{ padding: 16, display: 'grid', gap: 10 }}>
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Question Patterns</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <MetricCard label="Weak Questions" value={String(explorer.questionPatterns.weakQuestionCount)} helper="Count of currently weak question traces." />
                      <MetricCard label="Careless Errors" value={String(explorer.questionPatterns.carelessErrorCount)} helper="Observed careless-error pattern count." />
                      <MetricCard label="Transfer Gaps" value={String(explorer.questionPatterns.transferGapCount)} helper="Observed transfer-demand weakness count." />
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                      Common weak topics: {explorer.questionPatterns.commonWeakTopics.join(' · ') || 'None'}
                    </div>
                  </Card>

                  <Card data-proof-section="semester-trajectory" style={{ padding: 16, display: 'grid', gap: 10 }}>
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Semester Trajectory</div>
                    {explorer.semesterSummaries.map(item => (
                      <Card key={item.semesterNumber} style={{ padding: 10, background: T.surface2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ ...mono, fontSize: 10, color: T.text }}>Semester {item.semesterNumber}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted }}>SGPA {item.sgpa} · CGPA {item.cgpaAfterSemester}</div>
                        </div>
                      </Card>
                    ))}
                  </Card>
                </>
              )}

              {activeTab === 'advanced' && explorer.electiveFit && (
                <Card data-proof-section="elective-fit" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Elective Fit</div>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>
                    {explorer.electiveFit.recommendedCode} · {explorer.electiveFit.recommendedTitle} · {explorer.electiveFit.stream}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                    {explorer.electiveFit.rationale.join(' · ')}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'details' && (
          <Card data-proof-section="component-evidence-grid" style={{ padding: 16, display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Component Evidence Grid</div>
            {explorer.assessmentComponents.length > 0 ? explorer.assessmentComponents.map(component => (
              <Card key={`${component.courseCode}-${component.sectionCode ?? 'na'}`} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{component.courseCode} · {component.courseTitle}{component.sectionCode ? ` · Section ${component.sectionCode}` : ''}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8, marginTop: 4 }}>
                  Attendance {component.attendancePct}% · TT1 {component.tt1Pct}% · TT2 {component.tt2Pct}% · Quiz {component.quizPct}% · Assignment {component.assignmentPct}% · SEE {component.seePct}% · Focus Outcomes {component.weakCoCount} · Weak questions {component.weakQuestionCount}
                </div>
              </Card>
            )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No component-level evidence rows are available on this proof explorer.</div>}
          </Card>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" dataProofAction="risk-explorer-back-bottom" onClick={onBack}>Back</Btn>
        </div>
      </PageShell>
  )
}
