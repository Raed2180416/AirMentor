import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { T, mono, stageColor } from './data'
import type { RiskBand, Stage } from './domain'

export const Chip = ({ children, color = T.muted, size = 11 }: { children: ReactNode; color?: string; size?: number }) => (
  <span style={{ ...mono, fontSize: size, padding: '2px 8px', borderRadius: 4, background: `${color}12`, color, border: `1px solid ${color}26`, whiteSpace: 'nowrap' as const, display: 'inline-block' }}>{children}</span>
)

export function HScrollArea({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const drag = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, active: false })
  const [dragging, setDragging] = useState(false)

  const endDrag = useCallback(() => {
    drag.current.active = false
    drag.current.pointerId = -1
    setDragging(false)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, [data-no-drag-scroll="true"]')) return
    const el = ref.current
    if (!el) return
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft, active: true }
    setDragging(true)
    el.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !drag.current.active || drag.current.pointerId !== e.pointerId) return
    const delta = e.clientX - drag.current.startX
    el.scrollLeft = drag.current.startScrollLeft - delta
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || drag.current.pointerId !== e.pointerId) return
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    endDrag()
  }, [endDrag])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    if (e.key === 'ArrowRight') {
      el.scrollBy({ left: 80, behavior: 'smooth' })
    } else if (e.key === 'ArrowLeft') {
      el.scrollBy({ left: -80, behavior: 'smooth' })
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`scrollable-x scroll-pane scroll-pane--dense${dragging ? ' is-dragging' : ''}`}
      style={{ overflowX: 'auto', cursor: dragging ? 'grabbing' : 'grab', overscrollBehaviorX: 'contain', ...style }}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
      onPointerLeave={e => {
        if (drag.current.active && drag.current.pointerId === e.pointerId) onPointerUp(e)
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

export const Bar = ({ val, max = 100, color, h = 5 }: { val: number; max?: number; color: string; h?: number }) => (
  <div style={{ width: '100%', height: h, background: T.surface3, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${Math.max(0, Math.min(100, (val / max) * 100))}%`, height: '100%', background: color }} /></div>
)

export const Card = ({ children, style = {}, glow, onClick }: { children: ReactNode; style?: CSSProperties; glow?: string; onClick?: () => void }) => (
  <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${glow ? glow + '40' : T.border}`, borderRadius: 14, padding: 16, boxShadow: glow ? `0 0 0 1px ${glow}22 inset, 0 14px 40px ${glow}10` : 'none', transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease', ...style }}>{children}</div>
)

export const PageShell = ({ size, children, style = {} }: { size: 'wide' | 'standard' | 'narrow'; children: ReactNode; style?: CSSProperties }) => (
  <div className={`page-shell page-shell--${size}`} style={{ animation: 'fadeUp 0.35s ease', ...style }}>
    {children}
  </div>
)

export const Btn = ({ children, onClick, variant = 'primary', size = 'md', type = 'button', disabled = false }: { children: ReactNode; onClick?: () => void; variant?: string; size?: string; type?: 'button' | 'submit' | 'reset'; disabled?: boolean }) => {
  const pad = size === 'sm' ? '8px 12px' : size === 'lg' ? '12px 18px' : '10px 14px'
  const fs = size === 'sm' ? 11 : size === 'lg' ? 14 : 12
  const v = variant === 'ghost' ? { bg: 'transparent', border: T.border2, color: T.text } : variant === 'danger' ? { bg: T.danger, border: T.danger, color: '#fff' } : { bg: T.accent, border: T.accent, color: '#fff' }
  return <button type={type} disabled={disabled} onClick={onClick} style={{ borderRadius: 9, padding: pad, border: `1px solid ${v.border}`, background: disabled ? `${T.surface3}` : v.bg, color: disabled ? T.dim : v.color, cursor: disabled ? 'not-allowed' : 'pointer', ...mono, fontSize: fs, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>{children}</button>
}

export const TH = ({ children }: { children: ReactNode }) => (
  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${T.border}`, ...mono, fontSize: 10, color: T.dim, fontWeight: 500, whiteSpace: 'nowrap' }}>{children}</th>
)

export const TD = ({ children, style = {}, ...rest }: { children: ReactNode; style?: CSSProperties; colSpan?: number }) => (
  <td {...rest} style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle', ...style }}>{children}</td>
)

export const RiskBadge = ({ band, prob }: { band: RiskBand | null; prob: number | null }) => {
  const c = band === 'High' ? T.danger : band === 'Medium' ? T.warning : band === 'Low' ? T.success : T.dim
  return <Chip color={c}>{band ? `${band}${prob !== null ? ` · ${Math.round(prob * 100)}%` : ''}` : 'No Score'}</Chip>
}

export const StagePips = ({ current }: { current: Stage }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    {[1, 2, 3].map(s => <div key={s} style={{ width: 7, height: 7, borderRadius: 2, background: s <= current ? stageColor(s as Stage) : T.border2, boxShadow: s <= current ? `0 0 8px ${stageColor(s as Stage)}44` : 'none' }} />)}
  </div>
)
