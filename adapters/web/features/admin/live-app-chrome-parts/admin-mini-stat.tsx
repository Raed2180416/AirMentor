import { T, mono, sora } from '@web/simulation/fixtures'
import { UI_FONT_SIZES, withAlpha } from '@web/shared/ui/primitives'

export function AdminMiniStat({
  label,
  value,
  tone = T.accent,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${withAlpha(tone, '1c')}`, background: `linear-gradient(180deg, ${withAlpha(tone, '0a')}, ${T.surface})`, padding: '12px 14px', minWidth: 0, maxWidth: 240, boxShadow: `0 8px 18px ${withAlpha(tone, '0a')}` }}>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.micro, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 'clamp(16px, 1.8vw, 20px)', fontWeight: 800, color: T.text, marginTop: 6, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
