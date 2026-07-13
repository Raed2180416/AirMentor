import { type ReactNode, useId } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Card } from '@web/shared/ui/primitives'

type CompactStatCardProps = {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: string
}

export function CompactStatCard({ label, value, detail, tone = T.accent }: CompactStatCardProps) {
  return (
    <Card style={{ padding: 12, background: T.surface, minHeight: 88, display: 'grid', gap: 6 }}>
      <div style={{ ...mono, fontSize: 10, color: tone }}>{label}</div>
      <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.6 }}>{value}</div>
      {detail ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{detail}</div> : null}
    </Card>
  )
}

type ScrollCardProps = {
  title: string
  eyebrow?: string
  maxHeight?: number
  children: ReactNode
}

export function ScrollCard({ title, eyebrow, maxHeight = 240, children }: ScrollCardProps) {
  const titleId = useId()

  return (
    <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
      {eyebrow ? <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{eyebrow}</div> : null}
      <div id={titleId} style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
      <div
        data-proof-scroll-region={title.toLowerCase().replaceAll(' ', '-')}
        aria-labelledby={titleId}
        tabIndex={0}
        style={{ maxHeight, overflowY: 'auto', paddingRight: 4, display: 'grid', gap: 8, scrollbarGutter: 'stable' }}
      >
        {children}
      </div>
    </Card>
  )
}
