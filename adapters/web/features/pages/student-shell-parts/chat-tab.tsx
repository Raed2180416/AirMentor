import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { MessageSquare } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentAgentCard, ApiStudentAgentMessage, ApiStudentAgentSession } from '@web/shared/api/types'
import { Btn, Card, Chip, FieldInput } from '@web/shared/ui/primitives'
import { EmptyState } from '@web/features/admin/system-admin-ui'
import { MessageBubble, PanelLabel } from './shared'

export function StudentShellChatTab({
  card,
  session,
  prompt,
  setPrompt,
  busy,
  startSession,
  sendMessage,
  handleStartSession,
  handleSendPrompt,
}: {
  card: ApiStudentAgentCard
  session: ApiStudentAgentSession | null
  prompt: string
  setPrompt: Dispatch<SetStateAction<string>>
  busy: boolean
  startSession?: (studentId: string) => Promise<ApiStudentAgentSession>
  sendMessage?: (sessionId: string, payload: { prompt: string }) => Promise<{ items: ApiStudentAgentMessage[] }>
  handleStartSession: () => Promise<void>
  handleSendPrompt: (event: FormEvent) => Promise<void>
}) {
  return (
    <div style={{ flex: '999 1 400px', display: 'grid', gap: 14 }}>
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
  )
}
