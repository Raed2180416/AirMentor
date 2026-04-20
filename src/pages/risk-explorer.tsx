import { useEffect, useState } from 'react'
import { Activity, Eye, TrendingDown } from 'lucide-react'
import { T, mono, sora } from '../data'
import type { Role } from '../domain'
import type { ApiFeatureCompleteness, ApiFeatureProvenance, ApiRiskHeadDisplay, ApiStudentRiskExplorer } from '../api/types'
import { describeProofModelUsefulness, describeProofProvenance } from '../proof-provenance'
import { ProofSurfaceHero, ProofSurfaceLauncher, ProofSurfaceTabPanel, ProofSurfaceTabs } from '../proof-surface-shell'
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
  return `Provenance · import ${importVersion} · fingerprint ${fingerprint} · nodes ${featureProvenance.graphNodeCount} · edges ${featureProvenance.graphEdgeCount} · history ${featureProvenance.historyCourseCount}`
}

function renderAuthorityBannerMessage(explorer: ApiStudentRiskExplorer) {
  const advisoryNote = 'Predicted scenarios stay advisory.'
  if (explorer.countSource === 'proof-checkpoint') {
    const checkpointLabel = explorer.checkpointContext?.stageLabel
      ? ` at ${explorer.checkpointContext.stageLabel}`
      : ''
    return `Viewing the saved checkpoint${checkpointLabel}. Risk heads on this page come from the selected proof window; ${advisoryNote}`
  }
  if (explorer.countSource === 'proof-run') {
    return `Viewing the active proof run. Risk heads on this page follow the current proof semester; ${advisoryNote}`
  }
  if (explorer.countSource === 'operational-semester') {
    return `Viewing live semester data. Risk heads on this page are anchored to operational evidence; ${advisoryNote}`
  }
  return 'Risk provenance is limited for this payload. Treat the derived outputs as advisory only.'
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
            <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7, overflowWrap: 'anywhere', wordBreak: 'break-word', flex: 1, minWidth: 180 }}>{item.label}</div>
            <Chip color={item.impact >= 0 ? T.warning : T.success}>
              {`${item.impact >= 0 ? '+' : ''}${Math.round(item.impact * 100)} pts`}
            </Chip>
          </div>
        </Card>
      ))}
    </div>
  )
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
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const result = await loadExplorer(studentId)
        if (!cancelled) setExplorer(result)
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load the risk explorer.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
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
    { label: 'Semester SGPA Drop', value: explorer.derivedScenarioHeads.semesterSgpaDropRiskProbScaled, helper: 'Derived advisory index from trained course heads plus semester trend.' },
    { label: 'Cumulative CGPA Drop', value: explorer.derivedScenarioHeads.cumulativeCgpaDropRiskProbScaled, helper: 'Derived advisory index for running CGPA pressure.' },
    { label: 'Elective Mismatch', value: explorer.derivedScenarioHeads.electiveMismatchRiskProbScaled, helper: 'Derived advisory index for elective-fit mismatch pressure.' },
  ]

  return (
    <PageShell size="wide">
      <div style={{ display: 'grid', gap: 18, paddingBottom: 28 }}>
        <PageBackButton onClick={onBack} dataProofAction="risk-explorer-back" />

        <ProofSurfaceHero
          surface="risk-explorer"
          entityId={explorer.checkpointContext?.simulationStageCheckpointId ?? undefined}
          studentId={explorer.student.studentId}
          eyebrow="Student Success Profile"
          title={explorer.student.studentName}
          description={explorer.disclaimer}
          icon={<Activity size={22} color={T.accent} />}
          badges={(
            <>
              <Chip color={T.accent}>{role}</Chip>
              <Chip color={T.success}>{explorer.runContext.runLabel}</Chip>
              {explorer.modelProvenance.calibrationMethod ? <Chip color={T.orange}>{`Cal ${explorer.modelProvenance.calibrationMethod}`}</Chip> : null}
              {explorer.modelProvenance.displayProbabilityAllowed === false ? <Chip color={T.warning}>Band only</Chip> : null}
              {explorer.modelProvenance.coEvidenceMode ? <Chip color={T.dim}>{explorer.modelProvenance.coEvidenceMode}</Chip> : null}
              {featureCompleteness ? <Chip color={featureCompleteness.complete ? T.success : T.warning}>{renderFeatureCompletenessLabel(featureCompleteness)}</Chip> : null}
              {explorer.checkpointContext ? <Chip color={T.orange}>{`Sem ${explorer.checkpointContext.semesterNumber} · ${explorer.checkpointContext.stageLabel}`}</Chip> : null}
              {explorer.checkpointContext?.stageAdvanceBlocked ? <Chip color={T.danger}>Stage blocked</Chip> : null}
              {explorer.trainedRiskHeads.currentRiskBand ? <Chip color={explorer.trainedRiskHeads.currentRiskBand === 'High' ? T.danger : explorer.trainedRiskHeads.currentRiskBand === 'Medium' ? T.warning : T.success}>{explorer.trainedRiskHeads.currentRiskBand}</Chip> : null}
            </>
          )}
          notices={(
            <>
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
                <InfoBanner message={renderAuthorityBannerMessage(explorer)} />
                <InfoBanner tone="neutral" message={describeProofProvenance(explorer)} />
                <InfoBanner tone="neutral" message={describeProofModelUsefulness(explorer)} />
              </div>
            </>
          )}
        >
          <Card style={{ padding: 14, display: 'grid', gap: 10, background: T.surface2 }}>
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Feature Completeness</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {featureCompleteness ? (
                <>
                  <Chip color={featureCompleteness.complete ? T.success : T.warning}>{featureCompleteness.complete ? 'Complete' : 'Incomplete'}</Chip>
                  <Chip color={featureCompleteness.fallbackMode === 'graph-aware' ? T.success : T.warning}>{renderFeatureCompletenessLabel(featureCompleteness)}</Chip>
                  <Chip color={featureCompleteness.confidenceClass === 'high' ? T.success : featureCompleteness.confidenceClass === 'medium' ? T.warning : T.danger}>{`Confidence ${featureCompleteness.confidenceClass}`}</Chip>
                  <Chip color={featureCompleteness.graphAvailable ? T.success : T.danger}>Graph {featureCompleteness.graphAvailable ? 'available' : 'missing'}</Chip>
                  <Chip color={featureCompleteness.historyAvailable ? T.success : T.danger}>History {featureCompleteness.historyAvailable ? 'available' : 'missing'}</Chip>
                </>
              ) : (
                <Chip color={T.dim}>Unavailable</Chip>
              )}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              {featureCompleteness ? `Missing dimensions: ${featureCompleteness.missing.join(' · ') || 'none'} · confidence ${featureCompleteness.confidenceClass}.` : 'No feature-completeness metadata is attached to this proof payload.'}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              {renderFeatureProvenanceValue(featureProvenance)}
            </div>
          </Card>
        </ProofSurfaceHero>

        <ProofSurfaceLauncher
          targetId="risk-explorer-proof-controls"
          label="Jump to risk proof controls"
          dataProofEntityId={explorer.student.studentId}
          popupTitle="Risk proof control surface"
          popupCaption={explorer.checkpointContext
            ? `Semester ${explorer.checkpointContext.semesterNumber} · ${explorer.checkpointContext.stageLabel}`
            : explorer.runContext.runLabel}
          popupContent={() => (
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoBanner message="Read the current risk view, no-action view, and intervention path together. This popup stays locked to the selected proof run and stage." />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Model output</div>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{explorer.currentStatus.riskBand ?? 'Unavailable'}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{explorer.currentStatus.recommendedAction ?? 'No simulated intervention'}</div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>No-action comparator</div>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{explorer.counterfactual?.noActionRiskBand ?? 'Unavailable'}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{explorer.counterfactual?.counterfactualLiftScaled != null ? `${explorer.counterfactual.counterfactualLiftScaled > 0 ? '+' : ''}${explorer.counterfactual.counterfactualLiftScaled} scaled points` : 'No lift reported'}</div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feature completeness</div>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{renderFeatureCompletenessLabel(featureCompleteness)}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{featureCompleteness?.missing.join(' · ') || 'No missing dimensions'}</div>
                </Card>
              </div>
            </div>
          )}
          popupFooter={({ closePopup, jumpToTarget }) => (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Btn size="sm" variant="ghost" onClick={jumpToTarget}>Open proof controls</Btn>
              <Btn size="sm" variant="ghost" onClick={closePopup}>Close</Btn>
            </div>
          )}
        />

        {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}
        
        <ProofSurfaceTabs
          controlId="risk-explorer-proof-controls"
          idBase="risk-explorer"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'details', label: 'Assessment Details' },
            { id: 'advanced', label: 'Advanced Diagnostics' },
          ]}
          activeTab={activeTab}
          onChange={tabId => setActiveTab(tabId as 'overview' | 'details' | 'advanced')}
          ariaLabel="Risk explorer sections"
          actionName="risk-explorer-tab"
        />

        <ProofSurfaceTabPanel
          idBase="risk-explorer"
          tabId={activeTab}
          activeTab={activeTab}
          sectionId={`risk-explorer-panel-${activeTab}`}
          minHeight={420}
        >
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip color={T.orange}>Advisory Index</Chip>
                  <Chip color={T.dim}>{explorer.derivedScenarioHeads.scale}</Chip>
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{explorer.derivedScenarioHeads.supportWarning}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{explorer.derivedScenarioHeads.note}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {derivedHeads.map(head => (
                    <HeadCard
                      key={head.label}
                      label={head.label}
                      value={head.value == null ? 'NA' : `${head.value} pts`}
                      helper={head.helper}
                      tone={head.value != null && head.value >= 70 ? 'danger' : head.value != null && head.value >= 35 ? 'warning' : 'success'}
                    />
                  ))}
                </div>
              </Card>
            </>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 320px', maxWidth: 360, display: 'grid', gap: 14 }}>
              {(activeTab === 'overview' || activeTab === 'advanced') && (
                <Card data-proof-section="current-status" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Model Output</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {explorer.currentStatus.riskBand ? <Chip color={explorer.currentStatus.riskBand === 'High' ? T.danger : explorer.currentStatus.riskBand === 'Medium' ? T.warning : T.success}>{explorer.currentStatus.riskBand}</Chip> : null}
                    {explorer.currentStatus.riskProbScaled != null ? <Chip color={T.dim}>{`${explorer.currentStatus.riskProbScaled}%`}</Chip> : null}
                    {explorer.currentStatus.queueState ? <Chip color={T.orange}>{explorer.currentStatus.queueState}</Chip> : null}
                    {explorer.checkpointContext?.stageAdvanceBlocked ? <Chip color={T.danger}>Checkpoint blocked</Chip> : null}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      Model output: {explorer.currentStatus.recommendedAction ?? 'None'}
                    </div>
                    {explorer.currentStatus.recommendedAction ? (
                      <div style={{ ...mono, fontSize: 10, color: T.accent, lineHeight: 1.7, border: `1px solid ${T.border2}`, borderRadius: 10, background: T.surface2, padding: '6px 8px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        Simulated intervention: {explorer.currentStatus.recommendedAction.replace(/-/g, ' ')}
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
                  <MetricCard label="TT1 / TT2" value={`${explorer.currentEvidence.tt1Pct}% / ${explorer.currentEvidence.tt2Pct}%`} helper="Observed term-test evidence." />
                  <MetricCard label="Quiz / Assignment" value={`${explorer.currentEvidence.quizPct}% / ${explorer.currentEvidence.assignmentPct}%`} helper="Coursework evidence." />
                  <MetricCard label="SEE" value={`${explorer.currentEvidence.seePct}%`} helper="SEE evidence where available in the selected window." />
                  <MetricCard label="Focus Outcomes / Weak Questions" value={`${explorer.currentEvidence.weakCoCount} / ${explorer.currentEvidence.weakQuestionCount}`} helper="Observed weakness counts only." />
                </Card>
              )}

              {activeTab === 'advanced' && (
                <Card data-proof-section="policy-comparison" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Simulated Intervention / Realized Path</div>
                  {policyComparison ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {'policyPhenotype' in policyComparison && policyComparison.policyPhenotype ? <Chip color={T.orange}>{policyComparison.policyPhenotype}</Chip> : null}
                        {policyComparison.recommendedAction ? <Chip color={T.accent}>{policyComparison.recommendedAction}</Chip> : null}
                        {policyComparison.simulatedActionTaken ? <Chip color={T.warning}>{policyComparison.simulatedActionTaken}</Chip> : null}
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

            <div style={{ flex: '999 1 400px', display: 'grid', gap: 14 }}>
              {activeTab === 'overview' && (
                <Card data-proof-section="top-observable-drivers" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Eye size={16} color={T.accent} />
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Top Observable Drivers</div>
                  </div>
                  <InfoBanner tone="neutral" message="Driver points show each observable feature's contribution to risk at this checkpoint. Positive points increase risk pressure; negative points reduce it. They are directional contributions, not standalone marks." />
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
          {activeTab === 'advanced' && (
            <Card data-proof-section="no-action-comparator" style={{ padding: 16, display: 'grid', gap: 10, marginTop: 14 }}>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>No-Action Comparator</div>
              {counterfactual ? (
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
        </ProofSurfaceTabPanel>
      </div>
      </PageShell>
  )
}
