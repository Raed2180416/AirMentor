import { T, mono, sora } from '@web/simulation/fixtures'
import { normalizeProofPanelLabel } from '@web/simulation/proof-provenance'
import { Card } from '@web/shared/ui/primitives'

export function PanelLabel({ children, color = T.accent }: { children: string; color?: string }) {
  const normalizedLabel = normalizeProofPanelLabel(children)
  return (
    <span style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
      {normalizedLabel}
    </span>
  )
}

export function TableCard({
  title,
  caption,
  children,
  ...rest
}: {
  title: string
  caption: string
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>) {
  return (
    <Card style={{ padding: 16, display: 'grid', gap: 12 }} {...rest}>
      <div>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{title}</div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{caption}</div>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </Card>
  )
}
