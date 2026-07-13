import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner, SectionHeading, TextAreaInput, TextInput } from '../system-admin-ui'
import type { Dispatch, SetStateAction } from 'react'
import type {
  ApiPolicyOverride,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiStagePolicyOverride,
} from '@web/shared/api/types'
import type { PolicyFormState, StagePolicyFormState } from '../system-admin-live-app'
import type { WorkspaceMetaScope } from './types'
import {
  STAGE_EVIDENCE_OPTIONS,
  describeGovernanceResolutionMessage,
  describeGovernanceRollbackMessage,
  describeResolvedFromLabel,
  formatScopeModeLabel,
} from './workspace-helpers'
import { LabeledField, ToggleField } from './workspace-primitives'

type GovernancePanelsProps = {
  activeGovernanceScope: WorkspaceMetaScope | null
  universityTab: string
  activeScopeChain: WorkspaceMetaScope[]
  resolvedBatchPolicy: ApiResolvedBatchPolicy | null
  resolvedStagePolicy: ApiResolvedBatchStagePolicy | null
  activeScopePolicyOverride: ApiPolicyOverride | null
  activeScopeStageOverride: ApiStagePolicyOverride | null
  policyForm: PolicyFormState
  setPolicyForm: Dispatch<SetStateAction<PolicyFormState>>
  stagePolicyForm: StagePolicyFormState
  setStagePolicyForm: Dispatch<SetStateAction<StagePolicyFormState>>
  handleSaveScopePolicy: () => Promise<void>
  handleResetScopePolicy: () => Promise<void>
  handleSaveScopeStagePolicy: () => Promise<void>
  handleResetScopeStagePolicy: () => Promise<void>
}

export function GovernancePanels({
  activeGovernanceScope,
  universityTab,
  activeScopeChain,
  resolvedBatchPolicy,
  resolvedStagePolicy,
  activeScopePolicyOverride,
  activeScopeStageOverride,
  policyForm,
  setPolicyForm,
  stagePolicyForm,
  setStagePolicyForm,
  handleSaveScopePolicy,
  handleResetScopePolicy,
  handleSaveScopeStagePolicy,
  handleResetScopeStagePolicy,
}: GovernancePanelsProps) {
  const policyScopeChipLabel = resolvedBatchPolicy?.scopeDescriptor.label ?? activeGovernanceScope?.label ?? 'Institution defaults'
  const stagePolicyScopeChipLabel = resolvedStagePolicy?.scopeDescriptor.label ?? activeGovernanceScope?.label ?? 'Institution defaults'
  const policyResolvedFromChipLabel = describeResolvedFromLabel(resolvedBatchPolicy, activeScopeChain)
  const stagePolicyResolvedFromChipLabel = describeResolvedFromLabel(resolvedStagePolicy, activeScopeChain)
  const policyStatusChips = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Chip color={activeScopePolicyOverride ? T.orange : T.dim}>{activeScopePolicyOverride ? 'Local override active' : 'Inherited policy'}</Chip>
      <Chip color={T.accent}>{`Scope ${policyScopeChipLabel}`}</Chip>
      <Chip color={T.warning}>{`Resolved from ${policyResolvedFromChipLabel}`}</Chip>
      <Chip color={T.success}>{`${formatScopeModeLabel(resolvedBatchPolicy?.scopeMode ?? activeGovernanceScope?.scopeType ?? 'institution')} mode`}</Chip>
    </div>
  )
  const stagePolicyStatusChips = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Chip color={activeScopeStageOverride ? T.orange : T.dim}>{activeScopeStageOverride ? 'Local stage override active' : 'Inherited stage policy'}</Chip>
      <Chip color={T.accent}>{`Scope ${stagePolicyScopeChipLabel}`}</Chip>
      <Chip color={T.warning}>{`Resolved from ${stagePolicyResolvedFromChipLabel}`}</Chip>
      <Chip color={T.success}>{`${formatScopeModeLabel(resolvedStagePolicy?.scopeMode ?? activeGovernanceScope?.scopeType ?? 'institution')} mode`}</Chip>
    </div>
  )
  const policyLineageNotices = (
    <>
      <InfoBanner message={describeGovernanceResolutionMessage({
        activeGovernanceScope,
        activeScopeChain,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      })}
      />
      <InfoBanner message={describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: !!activeScopePolicyOverride,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      })}
      />
    </>
  )
  const stagePolicyLineageNotices = (
    <>
      <InfoBanner message={describeGovernanceResolutionMessage({
        activeGovernanceScope,
        activeScopeChain,
        resolved: resolvedStagePolicy,
        subject: 'stage policy',
      })}
      />
      <InfoBanner message={describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: !!activeScopeStageOverride,
        resolved: resolvedStagePolicy,
        subject: 'stage policy',
      })}
      />
    </>
  )
  const policyActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Btn type="button" onClick={() => void handleSaveScopePolicy()}>Save Scope Governance</Btn>
      <Btn type="button" variant="ghost" onClick={() => void handleResetScopePolicy()}>Reset To Inherited Policy</Btn>
    </div>
  )
  const stagePolicyActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Btn type="button" onClick={() => void handleSaveScopeStagePolicy()}>Save Stage Policy</Btn>
      <Btn type="button" variant="ghost" onClick={() => void handleResetScopeStagePolicy()}>Reset To Inherited Stage Policy</Btn>
    </div>
  )
  const governanceBandsPanel = activeGovernanceScope && universityTab === 'bands' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="Academic Bands" eyebrow="Evaluation" caption={`Resolved grade bands for ${activeGovernanceScope?.label ?? 'the active scope'}. Save here to create or update the local override at this exact scope.`} />
      {policyStatusChips}
      {policyLineageNotices}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <LabeledField label="O minimum"><TextInput value={policyForm.oMin} onChange={event => setPolicyForm(prev => ({ ...prev, oMin: event.target.value }))} /></LabeledField>
        <LabeledField label="A+ minimum"><TextInput value={policyForm.aPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, aPlusMin: event.target.value }))} /></LabeledField>
        <LabeledField label="A minimum"><TextInput value={policyForm.aMin} onChange={event => setPolicyForm(prev => ({ ...prev, aMin: event.target.value }))} /></LabeledField>
        <LabeledField label="B+ minimum"><TextInput value={policyForm.bPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, bPlusMin: event.target.value }))} /></LabeledField>
        <LabeledField label="B minimum"><TextInput value={policyForm.bMin} onChange={event => setPolicyForm(prev => ({ ...prev, bMin: event.target.value }))} /></LabeledField>
        <LabeledField label="C minimum"><TextInput value={policyForm.cMin} onChange={event => setPolicyForm(prev => ({ ...prev, cMin: event.target.value }))} /></LabeledField>
        <LabeledField label="P minimum"><TextInput value={policyForm.pMin} onChange={event => setPolicyForm(prev => ({ ...prev, pMin: event.target.value }))} /></LabeledField>
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
        Grade bands descend from O to P. Validation happens on save and will reject any upward gaps or invalid thresholds.
      </div>
      {policyActions}
    </Card>
  ) : null
  const governanceCeSeePanel = activeGovernanceScope && universityTab === 'ce-see' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="CE / SEE Split" eyebrow="Assessment" caption={`Configure the CE/SEE split, component caps, attendance, condonation, and working calendar at ${activeGovernanceScope?.label ?? 'the active scope'}.`} />
      {policyStatusChips}
      {policyLineageNotices}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <LabeledField label="CE"><TextInput value={policyForm.ce} onChange={event => setPolicyForm(prev => ({ ...prev, ce: event.target.value }))} /></LabeledField>
        <LabeledField label="SEE"><TextInput value={policyForm.see} onChange={event => setPolicyForm(prev => ({ ...prev, see: event.target.value }))} /></LabeledField>
        <LabeledField label="Term test weight"><TextInput value={policyForm.termTestsWeight} onChange={event => setPolicyForm(prev => ({ ...prev, termTestsWeight: event.target.value }))} /></LabeledField>
        <LabeledField label="Quiz weight"><TextInput value={policyForm.quizWeight} onChange={event => setPolicyForm(prev => ({ ...prev, quizWeight: event.target.value }))} /></LabeledField>
        <LabeledField label="Assignment weight"><TextInput value={policyForm.assignmentWeight} onChange={event => setPolicyForm(prev => ({ ...prev, assignmentWeight: event.target.value }))} /></LabeledField>
        <LabeledField label="Max term tests"><TextInput value={policyForm.maxTermTests} onChange={event => setPolicyForm(prev => ({ ...prev, maxTermTests: event.target.value }))} /></LabeledField>
        <LabeledField label="Max quizzes"><TextInput value={policyForm.maxQuizzes} onChange={event => setPolicyForm(prev => ({ ...prev, maxQuizzes: event.target.value }))} /></LabeledField>
        <LabeledField label="Max assignments"><TextInput value={policyForm.maxAssignments} onChange={event => setPolicyForm(prev => ({ ...prev, maxAssignments: event.target.value }))} /></LabeledField>
      </div>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Working Calendar</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Day start"><TextInput value={policyForm.dayStart} onChange={event => setPolicyForm(prev => ({ ...prev, dayStart: event.target.value }))} /></LabeledField>
          <LabeledField label="Day end"><TextInput value={policyForm.dayEnd} onChange={event => setPolicyForm(prev => ({ ...prev, dayEnd: event.target.value }))} /></LabeledField>
          <LabeledField label="Coursework weeks"><TextInput value={policyForm.courseworkWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, courseworkWeeks: event.target.value }))} /></LabeledField>
          <LabeledField label="Exam prep weeks"><TextInput value={policyForm.examPreparationWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, examPreparationWeeks: event.target.value }))} /></LabeledField>
          <LabeledField label="SEE weeks"><TextInput value={policyForm.seeWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, seeWeeks: event.target.value }))} /></LabeledField>
          <LabeledField label="Total weeks"><TextInput value={policyForm.totalWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, totalWeeks: event.target.value }))} /></LabeledField>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map(day => (
            <ToggleField
              key={day}
              label={day}
              checked={policyForm.workingDays.includes(day)}
              onChange={checked => setPolicyForm(prev => ({
                ...prev,
                workingDays: checked
                  ? prev.workingDays.includes(day) ? prev.workingDays : [...prev.workingDays, day]
                  : prev.workingDays.filter(item => item !== day),
              }))}
            />
          ))}
        </div>
      </Card>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Attendance And Eligibility</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Minimum attendance %"><TextInput value={policyForm.minimumAttendancePercent} onChange={event => setPolicyForm(prev => ({ ...prev, minimumAttendancePercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Condonation floor %"><TextInput value={policyForm.condonationFloorPercent} onChange={event => setPolicyForm(prev => ({ ...prev, condonationFloorPercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Condonation shortage %"><TextInput value={policyForm.condonationShortagePercent} onChange={event => setPolicyForm(prev => ({ ...prev, condonationShortagePercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Minimum CE for SEE"><TextInput value={policyForm.minimumCeForSeeEligibility} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCeForSeeEligibility: event.target.value }))} /></LabeledField>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ToggleField label="Condonation requires approval" checked={policyForm.condonationRequiresApproval} onChange={checked => setPolicyForm(prev => ({ ...prev, condonationRequiresApproval: checked }))} />
          <ToggleField label="Allow condonation for SEE eligibility" checked={policyForm.allowCondonationForSeeEligibility} onChange={checked => setPolicyForm(prev => ({ ...prev, allowCondonationForSeeEligibility: checked }))} />
        </div>
      </Card>
      {policyActions}
    </Card>
  ) : null
  const governanceCgpaPanel = activeGovernanceScope && universityTab === 'cgpa' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="CGPA And Progression" eyebrow="Rules" caption={`Configure pass thresholds, rounding, repeat handling, progression, and risk thresholds for ${activeGovernanceScope?.label ?? 'the active scope'}.`} />
      {policyStatusChips}
      {policyLineageNotices}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <LabeledField label="Minimum CE mark"><TextInput value={policyForm.minimumCeMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCeMark: event.target.value }))} /></LabeledField>
        <LabeledField label="Minimum SEE mark"><TextInput value={policyForm.minimumSeeMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumSeeMark: event.target.value }))} /></LabeledField>
        <LabeledField label="Minimum overall mark"><TextInput value={policyForm.minimumOverallMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumOverallMark: event.target.value }))} /></LabeledField>
        <LabeledField label="SGPA / CGPA decimals"><TextInput value={policyForm.sgpaCgpaDecimals} onChange={event => setPolicyForm(prev => ({ ...prev, sgpaCgpaDecimals: event.target.value }))} /></LabeledField>
        <LabeledField label="Repeat-course policy">
          <select value={policyForm.repeatedCoursePolicy} onChange={event => setPolicyForm(prev => ({ ...prev, repeatedCoursePolicy: event.target.value as PolicyFormState['repeatedCoursePolicy'] }))} style={{ width: '100%' }}>
            <option value="latest-attempt">Latest attempt</option>
            <option value="best-attempt">Best attempt</option>
          </select>
        </LabeledField>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ToggleField label="Apply rounding before status determination" checked={policyForm.applyBeforeStatusDetermination} onChange={checked => setPolicyForm(prev => ({ ...prev, applyBeforeStatusDetermination: checked }))} />
      </div>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Progression</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Pass mark %"><TextInput value={policyForm.passMarkPercent} onChange={event => setPolicyForm(prev => ({ ...prev, passMarkPercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Minimum CGPA"><TextInput value={policyForm.minimumCgpaForPromotion} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCgpaForPromotion: event.target.value }))} /></LabeledField>
        </div>
        <ToggleField label="Require no active backlogs" checked={policyForm.requireNoActiveBacklogs} onChange={checked => setPolicyForm(prev => ({ ...prev, requireNoActiveBacklogs: checked }))} />
      </Card>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Risk Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="High-risk attendance below"><TextInput value={policyForm.highRiskAttendancePercentBelow} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskAttendancePercentBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="Medium-risk attendance below"><TextInput value={policyForm.mediumRiskAttendancePercentBelow} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskAttendancePercentBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="High-risk CGPA below"><TextInput value={policyForm.highRiskCgpaBelow} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskCgpaBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="Medium-risk CGPA below"><TextInput value={policyForm.mediumRiskCgpaBelow} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskCgpaBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="High-risk backlog count"><TextInput value={policyForm.highRiskBacklogCount} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskBacklogCount: event.target.value }))} /></LabeledField>
          <LabeledField label="Medium-risk backlog count"><TextInput value={policyForm.mediumRiskBacklogCount} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskBacklogCount: event.target.value }))} /></LabeledField>
        </div>
      </Card>
      {policyActions}
    </Card>
  ) : null
  const stagePolicyPanel = activeGovernanceScope && universityTab === 'stage' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="Stage Policy" eyebrow="Lifecycle" caption={`Configure inherited class-stage gates at ${activeGovernanceScope?.label ?? 'the active scope'}.`} />
      {stagePolicyStatusChips}
      {stagePolicyLineageNotices}
      <div style={{ display: 'grid', gap: 12 }}>
        {stagePolicyForm.stages.map((stage, index) => (
          <Card key={stage.key} style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{stage.label || `Stage ${index + 1}`}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{stage.key}</div>
              </div>
              <Chip color={T.accent}>{`Offset day ${stage.semesterDayOffset}`}</Chip>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <LabeledField label="Label"><TextInput value={stage.label} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></LabeledField>
              <LabeledField label="Semester day offset"><TextInput value={stage.semesterDayOffset} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, semesterDayOffset: event.target.value } : item) }))} /></LabeledField>
              <LabeledField label="Advancement mode">
                <select value={stage.advancementMode} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, advancementMode: event.target.value as StagePolicyFormState['stages'][number]['advancementMode'] } : item) }))} style={{ width: '100%' }}>
                  <option value="admin-confirmed">Admin confirmed</option>
                  <option value="automatic">Automatic</option>
                </select>
              </LabeledField>
              <LabeledField label="Color"><TextInput value={stage.color} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item) }))} /></LabeledField>
            </div>
            <LabeledField label="Description"><TextAreaInput value={stage.description} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} rows={3} /></LabeledField>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Required evidence</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {STAGE_EVIDENCE_OPTIONS.map(option => (
                  <ToggleField
                    key={`${stage.key}:${option}`}
                    label={option}
                    checked={stage.requiredEvidence.includes(option)}
                    onChange={checked => setStagePolicyForm(prev => ({
                      ...prev,
                      stages: prev.stages.map((item, itemIndex) => itemIndex === index ? {
                        ...item,
                        requiredEvidence: checked
                          ? item.requiredEvidence.includes(option) ? item.requiredEvidence : [...item.requiredEvidence, option]
                          : item.requiredEvidence.filter(evidence => evidence !== option),
                      } : item),
                    }))}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ToggleField label="Require queue clearance" checked={stage.requireQueueClearance} onChange={checked => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, requireQueueClearance: checked } : item) }))} />
              <ToggleField label="Require task clearance" checked={stage.requireTaskClearance} onChange={checked => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, requireTaskClearance: checked } : item) }))} />
            </div>
          </Card>
        ))}
      </div>
      {stagePolicyActions}
    </Card>
  ) : null

  return (
    <>
      {governanceBandsPanel}
      {governanceCeSeePanel}
      {governanceCgpaPanel}
      {stagePolicyPanel}
    </>
  )
}
