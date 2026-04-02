import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MessageSquare, Shield } from 'lucide-react'
import { T, mono, sora } from '../data'
import type { Role } from '../domain'
import type {
  ApiStudentAgentCard,
  ApiStudentAgentMessage,
  ApiStudentAgentPanelLabel,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
} from '../api/types'
import { describeProofAvailability, describeProofProvenance } from '../proof-provenance'
import { ProofSurfaceHero, ProofSurfaceLauncher, ProofSurfaceTabPanel, ProofSurfaceTabs } from '../proof-surface-shell'
import { Btn, Card, Chip, FieldInput, PageBackButton, PageShell } from '../ui-primitives'
import { EmptyState, InfoBanner, MetricCard } from '../system-admin-ui'

type StudentShellTabId = 'overview' | 'topic-co' | 'assessment' | 'interventions' | 'timeline' | 'chat'

function PanelLabel({ label }: { label: ApiStudentAgentPanelLabel }) {
  const color = label === 'Observed'
    ? T.accent
    : label === 'Policy Derived'
      ? T.warning
      : label === 'Simulation Internal'
        ? T.success
        : T.muted
  return (
    <span style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
      {label}
    </span>
  )
}

function CitationList({ citations }: { citations: ApiStudentAgentMessage['citations'] }) {
  if (citations.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      {citations.map(citation => (
        <div key={citation.citationId} style={{ border: `1px solid ${T.border2}`, borderRadius: 10, padding: '8px 10px', background: T.surface2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PanelLabel label={citation.panelLabel} />
            <div style={{ ...mono, fontSize: 10, color: T.text }}>{citation.label}</div>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>{citation.summary}</div>
        </div>
      ))}
    </div>
  )
}

function MessageBubble({ message }: { message: ApiStudentAgentMessage }) {
  const isUser = message.actorType === 'user'
  return (
    <Card style={{
      padding: 12,
      background: isUser ? `${T.accent}12` : T.surface2,
      border: `1px solid ${isUser ? `${T.accent}33` : T.border2}`,
      justifySelf: isUser ? 'end' : 'stretch',
      maxWidth: isUser ? '80%' : '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ ...mono, fontSize: 10, color: isUser ? T.accent : T.text }}>
          {isUser ? 'Prompt' : message.messageType === 'guardrail' ? 'Guardrail' : message.messageType === 'intro' ? 'Session Intro' : 'Deterministic Reply'}
        </div>
        {message.guardrailCode ? <Chip color={T.warning}>{message.guardrailCode}</Chip> : null}
      </div>
      <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.8, marginTop: 6 }}>{message.body}</div>
      <CitationList citations={message.citations} />
    </Card>
  )
}

export function StudentShellPage({
  role,
  studentId,
  onBack,
  loadCard,
  loadTimeline,
  startSession,
  sendMessage,
  initialCard = null,
  initialTimeline = [],
  initialSession = null,
  initialActiveTab = 'overview',
  initialError = '',
}: {
  role: Role
  studentId: string
  onBack: () => void
  loadCard?: (studentId: string) => Promise<ApiStudentAgentCard>
  loadTimeline?: (studentId: string) => Promise<{ items: ApiStudentAgentTimelineItem[] }>
  startSession?: (studentId: string) => Promise<ApiStudentAgentSession>
  sendMessage?: (sessionId: string, payload: { prompt: string }) => Promise<{ items: ApiStudentAgentMessage[] }>
  initialCard?: ApiStudentAgentCard | null
  initialTimeline?: ApiStudentAgentTimelineItem[]
  initialSession?: ApiStudentAgentSession | null
  initialActiveTab?: StudentShellTabId
  initialError?: string
}) {
  const [activeTab, setActiveTab] = useState<StudentShellTabId>(initialActiveTab)
  const [card, setCard] = useState<ApiStudentAgentCard | null>(initialCard)
  const [timeline, setTimeline] = useState<ApiStudentAgentTimelineItem[]>(initialTimeline)
  const [session, setSession] = useState<ApiStudentAgentSession | null>(initialSession)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(!initialCard && !!loadCard)
  const [timelineLoading, setTimelineLoading] = useState(initialActiveTab === 'timeline' && !initialTimeline.length && !!loadTimeline)
  const [timelineLoadedStudentId, setTimelineLoadedStudentId] = useState<string | null>(initialTimeline.length > 0 ? studentId : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)

  useEffect(() => {
    setTimeline(initialTimeline)
    setTimelineLoadedStudentId(initialTimeline.length > 0 ? studentId : null)
    setTimelineLoading(initialActiveTab === 'timeline' && !initialTimeline.length && !!loadTimeline)
  }, [initialActiveTab, initialTimeline, loadTimeline, studentId])

  useEffect(() => {
    if (!loadCard) return
    let cancelled = false
    setLoading(true)
    setError('')
    void loadCard(studentId)
      .then(nextCard => {
        if (!cancelled) setCard(nextCard)
      })
      .catch(nextError => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load the student shell card.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadCard, studentId])

  useEffect(() => {
    if (!loadTimeline || activeTab !== 'timeline' || timelineLoadedStudentId === studentId) return
    let cancelled = false
    setTimelineLoading(true)
    setError('')
    void loadTimeline(studentId)
      .then(result => {
        if (!cancelled) {
          setTimeline(result.items)
          setTimelineLoadedStudentId(studentId)
        }
      })
      .catch(nextError => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load the student shell timeline.')
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, loadTimeline, studentId, timelineLoadedStudentId])

  const handleStartSession = async () => {
    if (!startSession) return
    setBusy(true)
    setError('')
    try {
      const nextSession = await startSession(studentId)
      setSession(nextSession)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not start the student shell session.')
    } finally {
      setBusy(false)
    }
  }

  const handleSendPrompt = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || !sendMessage || !prompt.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await sendMessage(session.studentAgentSessionId, { prompt: prompt.trim() })
      setSession(current => current ? {
        ...current,
        messages: [...current.messages, ...result.items],
        updatedAt: result.items[result.items.length - 1]?.updatedAt ?? current.updatedAt,
      } : current)
      setPrompt('')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not send the deterministic shell prompt.')
    } finally {
      setBusy(false)
    }
  }

  const timelineBySemester = useMemo(() => {
    const grouped = new Map<number, ApiStudentAgentTimelineItem[]>()
    timeline.forEach(item => {
      const key = item.semesterNumber ?? 0
      grouped.set(key, [...(grouped.get(key) ?? []), item])
    })
    return [...grouped.entries()].sort(([left], [right]) => left - right)
  }, [timeline])

  if (loading) {
    return (
      <PageShell size="wide">
        <InfoBanner message="Loading deterministic student shell..." />
      </PageShell>
    )
  }

  if (!card) {
    return (
      <PageShell size="wide">
        <div data-proof-surface="student-shell" data-proof-state={error ? 'load-error' : 'empty'} style={{ display: 'grid', gap: 12 }}>
          {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}
          <EmptyState title="Student shell unavailable" body={error ? 'The bounded proof card failed to load for this student.' : 'A bounded proof card could not be built for this student.'} />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell size="wide">
      <div style={{ display: 'grid', gap: 18, paddingBottom: 26 }}>
        <PageBackButton onClick={onBack} dataProofAction="student-shell-back" />

        <ProofSurfaceHero
          surface="student-shell"
          entityId={card.checkpointContext?.simulationStageCheckpointId ?? undefined}
          studentId={card.student.studentId}
          eyebrow="Student Shell"
          title={`${card.student.studentName} · deterministic proof explainer`}
          description={card.disclaimer}
          icon={<Shield size={22} color={T.accent} />}
          badges={(
            <>
              <Chip color={T.accent}>{role}</Chip>
              <Chip color={T.success}>{card.runContext.runLabel}</Chip>
              <Chip color={T.warning}>Seed {card.runContext.seed}</Chip>
              {card.checkpointContext ? <Chip color={T.orange}>{`Sem ${card.checkpointContext.semesterNumber} · ${card.checkpointContext.stageLabel}`}</Chip> : null}
            </>
          )}
          notices={(
            <>
              <InfoBanner message={`Active proof context ${card.runContext.runLabel} · ${card.runContext.status} · created ${new Date(card.runContext.createdAt).toLocaleString('en-IN')} · deterministic shell mode${card.checkpointContext ? ` · checkpoint ${card.checkpointContext.stageLabel} (semester ${card.checkpointContext.semesterNumber})` : ''}.`} />
              <div data-proof-section="authority-banner">
                <InfoBanner message="Authoritative bounded proof explainer for the selected checkpoint. Summary, timeline, and chat all bind to this proof card only; the chat cannot override policy-derived records or disclose hidden state." />
                <InfoBanner tone="neutral" message={describeProofProvenance(card)} />
                <InfoBanner tone="neutral" message={describeProofAvailability(card)} />
              </div>
            </>
          )}
        />

        <ProofSurfaceLauncher
          targetId="student-shell-proof-controls"
          label="Jump to student proof controls"
          dataProofEntityId={card.student.studentId}
        />

        {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 16 }}>
          <div style={{ display: 'grid', gap: 14, alignSelf: 'start' }}>
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
                {card.summaryRail.counterfactualLiftScaled != null ? <Chip color={card.summaryRail.counterfactualLiftScaled > 0 ? T.success : card.summaryRail.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${card.summaryRail.counterfactualLiftScaled > 0 ? '+' : ''}${card.summaryRail.counterfactualLiftScaled}`}</Chip> : null}
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
                CGPA {card.summaryRail.currentCgpa.toFixed(2)} · backlogs {card.summaryRail.backlogCount}
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
              <MetricCard label="TT Window" value={`${Math.round(card.overview.currentEvidence.tt1Pct)}% / ${Math.round(card.overview.currentEvidence.tt2Pct)}%`} helper="TT1 and TT2" />
              <MetricCard label="SEE" value={`${Math.round(card.overview.currentEvidence.seePct)}%`} helper="Observed semester-end evidence" />
              <MetricCard label="Weak COs" value={String(card.overview.currentEvidence.weakCoCount)} helper="Current weak course outcomes" />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <ProofSurfaceTabs
              controlId="student-shell-proof-controls"
              idBase="student-shell"
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'topic-co', label: 'Topic & CO' },
                { id: 'assessment', label: 'Assessment Evidence' },
                { id: 'interventions', label: 'Interventions' },
                { id: 'timeline', label: 'Timeline' },
                { id: 'chat', label: 'Shell Chat' },
              ]}
              activeTab={activeTab}
              onChange={tabId => setActiveTab(tabId as StudentShellTabId)}
              ariaLabel="Student shell sections"
              actionName="student-shell-tab"
            />

            <ProofSurfaceTabPanel
              idBase="student-shell"
              tabId={activeTab}
              activeTab={activeTab}
              sectionId={activeTab === 'topic-co' ? 'topic-co-panel' : `${activeTab}-panel`}
              minHeight={420}
            >
            {activeTab === 'overview' ? (
              <div data-proof-section="overview-panel" style={{ display: 'grid', gap: 14 }}>
                <Card data-proof-section="overview-observed-evidence" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label={card.overview.observedLabel} />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current observed evidence</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
                    Attendance {Math.round(card.overview.currentEvidence.attendancePct)}% · TT1 {Math.round(card.overview.currentEvidence.tt1Pct)}% · TT2 {Math.round(card.overview.currentEvidence.tt2Pct)}% · quiz {Math.round(card.overview.currentEvidence.quizPct)}% · assignment {Math.round(card.overview.currentEvidence.assignmentPct)}% · SEE {Math.round(card.overview.currentEvidence.seePct)}%.
                  </div>
                  {card.overview.currentEvidence.coEvidenceMode ? (
                    <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>
                      CO evidence mode: {card.overview.currentEvidence.coEvidenceMode}.
                    </div>
                  ) : null}
                </Card>
                <Card data-proof-section="overview-policy-status" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label={card.overview.policyLabel} />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current policy-derived status</div>
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
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>No-action comparator</div>
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
            ) : null}

            {activeTab === 'topic-co' ? (
              <div data-proof-section="topic-co-panel" style={{ display: 'grid', gap: 14 }}>
                <Card data-proof-section="topic-buckets" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label={card.topicAndCo.panelLabel} />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Topic buckets</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    {([
                      ['Known', card.topicAndCo.topicBuckets.known, T.success],
                      ['Partial', card.topicAndCo.topicBuckets.partial, T.warning],
                      ['Blocked', card.topicAndCo.topicBuckets.blocked, T.danger],
                      ['High Uncertainty', card.topicAndCo.topicBuckets.highUncertainty, T.accent],
                    ] as const).map(([label, topics, color]) => (
                      <Card key={label} style={{ padding: 10, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 10, color }}>{label}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {topics.length > 0 ? topics.map(topic => <Chip key={`${label}-${topic}`} color={color}>{topic}</Chip>) : <Chip color={T.dim}>None</Chip>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>
                <Card data-proof-section="weak-course-outcomes" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label={card.topicAndCo.panelLabel} />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Weak course outcomes</div>
                  {card.topicAndCo.weakCourseOutcomes.length > 0 ? card.topicAndCo.weakCourseOutcomes.map(item => (
                    <Card key={item.coCode} style={{ padding: 10, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.coCode} · {item.coTitle}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                        Trend {item.trend} · TT1 {Math.round(item.tt1Pct)}% · TT2 {Math.round(item.tt2Pct)}% · SEE {Math.round(item.seePct)}% · transfer gap {item.transferGap.toFixed(2)}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {item.topics.map(topic => <Chip key={`${item.coCode}-${topic}`} color={T.warning}>{topic}</Chip>)}
                      </div>
                    </Card>
                  )) : <EmptyState title="No weak course outcomes" body="The bounded card does not mark any current CO weakness on the active proof record." />}
                </Card>
              </div>
            ) : null}

            {activeTab === 'assessment' ? (
              <div data-proof-section="assessment-panel" style={{ display: 'grid', gap: 14 }}>
                <Card data-proof-section="assessment-evidence" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label={card.assessmentEvidence.panelLabel} />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Observed course evidence</div>
                  {card.assessmentEvidence.components.map(item => (
                    <Card key={`${item.courseCode}-${item.sectionCode ?? 'na'}`} style={{ padding: 10, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · {item.courseTitle}{item.sectionCode ? ` · Section ${item.sectionCode}` : ''}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                        Attendance {Math.round(item.attendancePct)}% · TT1 {Math.round(item.tt1Pct)}% · TT2 {Math.round(item.tt2Pct)}% · quiz {Math.round(item.quizPct)}% · assignment {Math.round(item.assignmentPct)}% · SEE {Math.round(item.seePct)}%.
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <Chip color={T.warning}>Weak COs {item.weakCoCount}</Chip>
                        <Chip color={T.danger}>Weak questions {item.weakQuestionCount}</Chip>
                        {item.drivers.slice(0, 3).map(driver => <Chip key={`${item.courseCode}-${driver.feature}`} color={driver.impact >= 0 ? T.warning : T.success}>{driver.label}</Chip>)}
                      </div>
                    </Card>
                  ))}
                </Card>
                <Card data-proof-section="question-pattern-summary" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label="Observed" />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Question-pattern summary</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
                    Weak questions {card.topicAndCo.questionPatterns.weakQuestionCount} · careless errors {card.topicAndCo.questionPatterns.carelessErrorCount} · transfer-gap signals {card.topicAndCo.questionPatterns.transferGapCount}.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {card.topicAndCo.questionPatterns.commonWeakTopics.map(topic => <Chip key={`weak-topic-${topic}`} color={T.danger}>{topic}</Chip>)}
                    {card.topicAndCo.questionPatterns.commonWeakCourseOutcomes.map(coCode => <Chip key={`weak-co-${coCode}`} color={T.warning}>{coCode}</Chip>)}
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === 'interventions' ? (
              <div data-proof-section="interventions-panel" style={{ display: 'grid', gap: 14 }}>
                <Card data-proof-section="reassessments" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label={card.interventions.panelLabel} />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Reassessments</div>
                  {card.interventions.currentReassessments.length > 0 ? card.interventions.currentReassessments.map(item => (
                    <Card key={item.reassessmentEventId} style={{ padding: 10, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · {item.courseTitle}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                        {item.status} · assigned to {item.assignedToRole} · due {new Date(item.dueAt).toLocaleString('en-IN')}
                      </div>
                    </Card>
                  )) : <Chip color={T.success}>No active reassessments</Chip>}
                </Card>
                <Card data-proof-section="intervention-history" style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <PanelLabel label={card.interventions.panelLabel} />
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Intervention history</div>
                  {card.interventions.interventionHistory.length > 0 ? card.interventions.interventionHistory.map(item => (
                    <Card key={item.interventionId} style={{ padding: 10, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.interventionType}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{item.note}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <Chip color={item.accepted === true ? T.success : item.accepted === false ? T.warning : T.dim}>Accepted {item.accepted == null ? 'n/a' : item.accepted ? 'Yes' : 'No'}</Chip>
                        <Chip color={item.completed === true ? T.success : item.completed === false ? T.warning : T.dim}>Completed {item.completed == null ? 'n/a' : item.completed ? 'Yes' : 'No'}</Chip>
                        {item.recoveryConfirmed != null ? <Chip color={item.recoveryConfirmed ? T.success : T.warning}>Recovery {item.recoveryConfirmed ? 'Confirmed' : 'Watch'}</Chip> : null}
                      </div>
                    </Card>
                  )) : <Chip color={T.dim}>No intervention history</Chip>}
                </Card>
              </div>
            ) : null}

            {activeTab === 'timeline' ? (
              <div>
                <Card data-proof-section="timeline-panel" style={{ padding: 16, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <PanelLabel label="Observed" />
                      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 6 }}>Bounded proof timeline</div>
                    </div>
                    {timelineLoading ? <Chip color={T.dim}>Loading timeline...</Chip> : null}
                  </div>
                  {timelineBySemester.length > 0 ? timelineBySemester.map(([semesterNumber, items]) => (
                    <Card key={`timeline-${semesterNumber}`} style={{ padding: 12, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>
                        {semesterNumber > 0 ? `Semester ${semesterNumber}` : 'Cross-semester log'}
                      </div>
                      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                        {items.map(item => (
                          <Card key={item.timelineItemId} style={{ padding: 10, background: T.surface }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <PanelLabel label={item.panelLabel} />
                              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.title}</div>
                            </div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{item.detail}</div>
                            <CitationList citations={item.citations} />
                          </Card>
                        ))}
                      </div>
                    </Card>
                  )) : <EmptyState title="No timeline entries" body="The proof card does not currently expose timeline items." />}
                </Card>
              </div>
            ) : null}

            {activeTab === 'chat' ? (
              <div style={{ display: 'grid', gap: 14 }}>
                <Card data-proof-section="chat-panel" style={{ padding: 16, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <PanelLabel label="Policy Derived" />
                      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 6 }}>Deterministic shell chat</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                        The shell replies only from the stored card. It cannot predict future certainty, override policy-derived records, or disclose hidden simulation internals{card.checkpointContext ? ` beyond the selected checkpoint ${card.checkpointContext.stageLabel}` : ''}.
                      </div>
                      <div aria-label="Message type legend" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        <Chip color={T.warning}>Guardrail</Chip>
                        <Chip color={T.accent}>Session Intro</Chip>
                        <Chip color={T.success}>Deterministic Reply</Chip>
                      </div>
                    </div>
                    {!session ? (
                      <Btn dataProofAction="student-shell-start-session" onClick={handleStartSession} disabled={busy || !startSession}>
                        <MessageSquare size={14} />
                        {busy ? 'Starting...' : 'Start Session'}
                      </Btn>
                    ) : (
                      <Chip color={T.success}>{session.responseMode}</Chip>
                    )}
                  </div>

                  {session ? (
                    <>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {session.messages.map(message => <MessageBubble key={message.studentAgentMessageId} message={message} />)}
                      </div>
                      <form onSubmit={handleSendPrompt} style={{ display: 'grid', gap: 10 }}>
                        <FieldInput
                          aria-label="Student shell prompt"
                          placeholder="Ask about current performance, weak topics, reassessment status, intervention history, elective fit, or compare semesters"
                          value={prompt}
                          onChange={event => setPrompt(event.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Btn type="submit" dataProofAction="student-shell-send-prompt" disabled={busy || !prompt.trim() || !sendMessage}>
                            {busy ? 'Sending...' : 'Send Prompt'}
                          </Btn>
                        </div>
                      </form>
                    </>
                  ) : (
                    <EmptyState title="No active shell session" body="Start a deterministic session to ask bounded questions about the current proof card." />
                  )}
                </Card>
              </div>
            ) : null}
            </ProofSurfaceTabPanel>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
