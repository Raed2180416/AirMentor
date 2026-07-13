import type { ReactNode } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import {
  Card,
  Chip,
  UI_FONT_SIZES,
  withAlpha,
} from '@web/shared/ui/primitives'

export function SectionLaunchCard({
  title,
  caption,
  helper,
  icon,
  tone = T.accent,
  active,
  onClick,
}: {
  title: string
  caption: string
  helper: string
  icon: ReactNode
  tone?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <Card
      surface={active ? 'selected' : 'launch'}
      glow={active ? tone : undefined}
      onClick={onClick}
      style={{
        padding: 22,
        minHeight: 196,
        background: active
          ? `linear-gradient(160deg, ${withAlpha(tone, '0a')} 0%, ${withAlpha(tone, '06')} 18%, ${T.surface} 100%)`
          : `linear-gradient(160deg, ${withAlpha(tone, '08')} 0%, ${T.surface} 20%, ${T.surface2} 100%)`,
        display: 'grid',
        alignContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tone}16`, color: tone }}>
          {icon}
        </div>
        <div>
          <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
          <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: tone }}>{caption}</div>
        </div>
      </div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

export function OverviewSupportCard({
  title,
  value,
  helper,
  tone = T.accent,
  onClick,
}: {
  title: string
  value: string
  helper: string
  tone?: string
  onClick?: () => void
}) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 18,
        borderRadius: 18,
        border: `1px solid ${withAlpha(tone, '14')}`,
        background: `linear-gradient(180deg, ${withAlpha(tone, '08')}, ${T.surface})`,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      <div style={{ ...sora, fontSize: 30, fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.muted, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

export function ActionQueueCard({
  title,
  subtitle,
  chips,
  trailing,
  tone = T.warning,
  onClick,
}: {
  title: string
  subtitle: string
  chips: string[]
  trailing?: ReactNode
  tone?: string
  onClick?: () => void
}) {
  const primaryContent = (
    <>
      <span style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text, display: 'block' }}>{title}</span>
      <span style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.muted, marginTop: 4, lineHeight: 1.7, display: 'block' }}>{subtitle}</span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {chips.map(chip => <Chip key={chip} color={tone} size={9}>{chip}</Chip>)}
      </span>
    </>
  )

  return (
    <Card data-action-queue-card="true" style={{ padding: 12, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        {onClick
          ? (
            <button
              type="button"
              data-action-queue-primary="true"
              onClick={onClick}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              {primaryContent}
            </button>
          )
          : <div style={{ flex: 1, minWidth: 0 }}>{primaryContent}</div>}
        {trailing ? <div style={{ flexShrink: 0 }}>{trailing}</div> : null}
      </div>
    </Card>
  )
}
