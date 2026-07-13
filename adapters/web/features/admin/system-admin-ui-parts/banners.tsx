import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, UI_FONT_SIZES } from '@web/shared/ui/primitives'

export function InfoBanner({ tone = 'neutral', message }: { tone?: 'neutral' | 'error' | 'success'; message: string }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.text
  const accent = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      style={{ ...mono, fontSize: UI_FONT_SIZES.body, color, border: `1px solid ${accent}40`, background: `${accent}12`, borderRadius: 14, padding: '11px 13px', lineHeight: 1.7 }}
    >
      {message}
    </div>
  )
}

export function RestoreBanner({
  title,
  message,
  tone = 'neutral',
  actionLabel = 'Reset',
  onAction,
  dismissLabel = 'Dismiss',
  onDismiss,
}: {
  title: string
  message: string
  tone?: 'neutral' | 'error' | 'success'
  actionLabel?: string
  onAction: () => void
  dismissLabel?: string
  onDismiss?: () => void
}) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return (
    <div
      data-restore-banner="true"
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      style={{
        borderRadius: 16,
        border: `1px solid ${color}40`,
        background: `linear-gradient(180deg, ${color}12, ${T.surface})`,
        padding: '12px 14px',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
          <div style={{ ...sora, fontSize: 14, fontWeight: 800, color: T.text }}>{title}</div>
          <div style={{ ...mono, fontSize: UI_FONT_SIZES.body, color: T.muted, lineHeight: 1.8 }}>{message}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn type="button" variant="ghost" onClick={onAction}>{actionLabel}</Btn>
          {onDismiss ? <Btn type="button" variant="ghost" onClick={onDismiss}>{dismissLabel}</Btn> : null}
        </div>
      </div>
    </div>
  )
}

export function QueueBulkActions({
  canHideAll,
  hiddenCount,
  onHideAll,
  onRestoreAll,
}: {
  canHideAll: boolean
  hiddenCount: number
  onHideAll: () => void
  onRestoreAll: () => void
}) {
  return (
    <div
      data-queue-bulk-actions="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`,
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Queue Controls</div>
        <div data-queue-hidden-count={hiddenCount > 0 ? String(hiddenCount) : '0'} style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted }}>
          {hiddenCount > 0 ? `${hiddenCount} hidden right now.` : 'Nothing hidden right now.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn type="button" variant="ghost" onClick={onHideAll} disabled={!canHideAll}>Hide all</Btn>
        <Btn type="button" variant="ghost" onClick={onRestoreAll} disabled={hiddenCount === 0}>Restore all hidden</Btn>
      </div>
    </div>
  )
}
