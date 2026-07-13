import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ReevaluatingRiskLoader } from '@web/shared/components/reevaluating-risk-loader'
import type { Role } from '@kernel/shared/domain'
import type {
  ApiStudentAgentCard,
  ApiStudentAgentMessage,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
} from '@web/shared/api/types'
import { ProofSurfaceTabPanel, ProofSurfaceTabs } from '@web/simulation/proof-surface-shell'
import { PageBackButton, PageShell } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner } from '@web/features/admin/system-admin-ui'
import { StudentShellHeader } from './student-shell-parts/student-shell-header'
import { StudentShellSummaryRail } from './student-shell-parts/summary-rail'
import { StudentShellOverviewTab } from './student-shell-parts/overview-tab'
import { StudentShellTopicCoTab } from './student-shell-parts/topic-co-tab'
import { StudentShellAssessmentTab } from './student-shell-parts/assessment-tab'
import { StudentShellInterventionsTab } from './student-shell-parts/interventions-tab'
import { StudentShellTimelineTab } from './student-shell-parts/timeline-tab'
import { StudentShellChatTab } from './student-shell-parts/chat-tab'

type StudentShellTabId = 'overview' | 'topic-co' | 'assessment' | 'interventions' | 'timeline' | 'chat'

const EMPTY_STUDENT_AGENT_TIMELINE: ApiStudentAgentTimelineItem[] = []

export function StudentShellPage({
  role,
  studentId,
  onBack,
  loadCard,
  loadTimeline,
  startSession,
  sendMessage,
  initialCard = null,
  initialTimeline = EMPTY_STUDENT_AGENT_TIMELINE,
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20vh' }}>
          <ReevaluatingRiskLoader />
        </div>
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

        <StudentShellHeader card={card} role={role} />

        {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <StudentShellSummaryRail card={card} />

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
              <StudentShellOverviewTab card={card} />
            ) : null}

            {activeTab === 'topic-co' ? (
              <StudentShellTopicCoTab card={card} />
            ) : null}

            {activeTab === 'assessment' ? (
              <StudentShellAssessmentTab card={card} />
            ) : null}

            {activeTab === 'interventions' ? (
              <StudentShellInterventionsTab card={card} />
            ) : null}

            {activeTab === 'timeline' ? (
              <StudentShellTimelineTab timelineBySemester={timelineBySemester} timelineLoading={timelineLoading} />
            ) : null}

            {activeTab === 'chat' ? (
              <StudentShellChatTab
                card={card}
                session={session}
                prompt={prompt}
                setPrompt={setPrompt}
                busy={busy}
                startSession={startSession}
                sendMessage={sendMessage}
                handleStartSession={handleStartSession}
                handleSendPrompt={handleSendPrompt}
              />
            ) : null}
            </ProofSurfaceTabPanel>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
