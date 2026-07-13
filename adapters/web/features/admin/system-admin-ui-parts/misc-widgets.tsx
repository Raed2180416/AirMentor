import {
  type CSSProperties,
  type ReactNode,
} from 'react'
import { T, mono } from '@web/simulation/fixtures'
import {
  ModalWorkspace,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  withAlpha,
} from '@web/shared/ui/primitives'

export function DayToggle({ days, selected, onChange }: { days: readonly string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div style={{ ...getSegmentedGroupStyle(), flexWrap: 'wrap' }}>
      {days.map(day => {
        const active = selected.includes(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(active ? selected.filter(item => item !== day) : [...selected, day])}
            style={getSegmentedButtonStyle({ active, compact: true })}
          >
            {day}
          </button>
        )
      })}
    </div>
  )
}

export function EntityButton({ selected, onClick, children, style: extraStyle }: { selected?: boolean; onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <button
      type="button"
      data-nav-item="true"
      data-active={selected ? 'true' : 'false'}
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 16,
        border: `1px solid ${selected ? withAlpha(T.accent, '50') : T.border}`,
        background: selected ? `linear-gradient(180deg, ${withAlpha(T.accent, '18')}, ${T.surface})` : `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
        padding: '14px 15px',
        minHeight: 84,
        display: 'grid',
        alignContent: 'start',
        gap: 6,
        cursor: 'pointer',
        width: '100%',
        boxShadow: selected ? `0 14px 28px ${withAlpha(T.accent, '14')}` : undefined,
        transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  )
}

export function HeroBadge({ children, color = T.accent, compact = false }: { children: ReactNode; color?: string; compact?: boolean }) {
  return (
    <span style={{ ...mono, fontSize: compact ? 9 : 10, lineHeight: 1, color, border: `1px solid ${color}30`, background: `${color}12`, borderRadius: 999, padding: compact ? '5px 8px' : '6px 10px', display: 'inline-flex', alignItems: 'center', gap: compact ? 5 : 6, alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export function AuthFeature({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: `${color}10`, border: `1px solid ${color}22`, boxShadow: `0 18px 40px ${color}10` }}>
      <div style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
    </div>
  )
}

export function ModalFrame({
  eyebrow,
  title,
  caption,
  onClose,
  actions,
  children,
  width = 680,
}: {
  eyebrow?: string
  title: string
  caption?: string
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
  width?: number
}) {
  return (
    <ModalWorkspace
      eyebrow={eyebrow}
      title={title}
      caption={caption}
      onClose={onClose}
      width={width}
      footer={actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div> : undefined}
      zIndex={120}
    >
      {children}
    </ModalWorkspace>
  )
}
