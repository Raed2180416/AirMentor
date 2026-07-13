import { T, mono } from '@web/simulation/fixtures'
import type { ApiStudentAgentMessage, ApiStudentAgentPanelLabel } from '@web/shared/api/types'
import { normalizeProofPanelLabel } from '@web/simulation/proof-provenance'
import { Card, Chip } from '@web/shared/ui/primitives'

export function PanelLabel({ label }: { label: ApiStudentAgentPanelLabel }) {
  const normalizedLabel = normalizeProofPanelLabel(label)
  const color = label === 'Observed'
    ? T.accent
    : label === 'Policy Derived'
      ? T.warning
      : label === 'Simulation Internal'
        ? T.success
        : T.muted
  return (
    <span style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
      {normalizedLabel}
    </span>
  )
}

export function formatEvidencePct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : 'Not recorded yet'
}

export function CitationList({ citations }: { citations: ApiStudentAgentMessage['citations'] }) {
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

export function MessageBubble({ message }: { message: ApiStudentAgentMessage }) {
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
