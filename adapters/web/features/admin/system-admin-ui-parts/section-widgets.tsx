import { type ReactNode } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Card, UI_FONT_SIZES } from '@web/shared/ui/primitives'

export function MetricCard({ label, value, helper, onClick }: { label: string; value: string; helper: string; onClick?: () => void }) {
  return (
    <Card style={{ padding: 18, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 800, color: T.text, marginTop: 10, lineHeight: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

export function SectionHeading({
  title,
  caption,
  eyebrow,
  actions,
  toneColor = T.accent,
}: {
  title: string
  caption: string
  eyebrow?: string
  actions?: ReactNode
  toneColor?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: 4 }}>
        {eyebrow ? <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: toneColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div> : null}
        <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1.1 }}>{title}</div>
        <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, lineHeight: 1.8 }}>{caption}</div>
      </div>
      {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ padding: 28, textAlign: 'center' }}>
      <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
    </Card>
  )
}
