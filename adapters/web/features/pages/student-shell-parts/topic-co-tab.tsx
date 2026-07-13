import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentAgentCard } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { EmptyState } from '@web/features/admin/system-admin-ui'
import { PanelLabel, formatEvidencePct } from './shared'

export function StudentShellTopicCoTab({ card }: { card: ApiStudentAgentCard }) {
  return (
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
              Trend {item.trend} · TT1 {formatEvidencePct(item.tt1Pct)} · TT2 {formatEvidencePct(item.tt2Pct)} · SEE {formatEvidencePct(item.seePct)} · transfer gap {item.transferGap.toFixed(2)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {item.topics.map(topic => <Chip key={`${item.coCode}-${topic}`} color={T.warning}>{topic}</Chip>)}
            </div>
          </Card>
        )) : <EmptyState title="No weak course outcomes" body="The bounded card does not mark any current CO weakness on the active proof record." />}
      </Card>
    </div>
  )
}
