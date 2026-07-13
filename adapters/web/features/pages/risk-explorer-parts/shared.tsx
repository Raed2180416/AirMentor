import { T, mono, sora } from '@web/simulation/fixtures'
import { Card, Chip } from '@web/shared/ui/primitives'

export function HeadCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper: string
  tone?: 'danger' | 'warning' | 'success' | 'neutral'
}) {
  const color = tone === 'danger'
    ? T.danger
    : tone === 'warning'
      ? T.warning
      : tone === 'success'
        ? T.success
        : T.text
  return (
    <Card style={{ padding: 14, display: 'grid', gap: 6, background: T.surface2 }}>
      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{helper}</div>
    </Card>
  )
}

export function DriverList({
  items,
  emptyMessage,
}: {
  items: Array<{ label: string; impact: number; feature?: string }>
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <div style={{ ...mono, fontSize: 10, color: T.muted }}>{emptyMessage}</div>
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((item, index) => (
        <Card key={`${item.feature ?? 'driver'}-${index}`} style={{ padding: 10, background: T.surface2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7, overflowWrap: 'anywhere', wordBreak: 'break-word', flex: 1, minWidth: 180 }}>{item.label}</div>
            <Chip color={item.impact >= 0 ? T.warning : T.success}>
              {`${item.impact >= 0 ? '+' : ''}${Math.round(item.impact * 100)} pts`}
            </Chip>
          </div>
        </Card>
      ))}
    </div>
  )
}
