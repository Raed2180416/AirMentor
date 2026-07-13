import { T, mono, sora } from '@web/simulation/fixtures'
import { getAccessibleDangerAccent, withAlpha } from './color'
import { UI_FONT_SIZES } from './tokens'

export function BrandMark({ label = 'AM', tone = T.accent, size = 38 }: { label?: string; tone?: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: `linear-gradient(160deg, ${tone}, ${withAlpha(tone, 'd8')})`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: `0 16px 30px ${withAlpha(tone, '2a')}`,
        ...sora,
        fontWeight: 800,
        fontSize: Math.max(12, Math.round(size * 0.34)),
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  )
}

export function NotificationCountBadge({ count, cap = 99 }: { count: number; cap?: number }) {
  const background = getAccessibleDangerAccent(T.danger)
  return (
    <span
      data-queue-count-badge="true"
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        background,
        color: '#fff',
        ...mono,
        fontSize: UI_FONT_SIZES.eyebrow,
        fontWeight: 700,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4px',
        boxShadow: `0 10px 18px ${withAlpha(background, '24')}`,
      }}
    >
      {Math.min(count, cap)}
    </span>
  )
}
