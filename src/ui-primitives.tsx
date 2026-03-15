import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T, mono, stageColor } from './data'
import type { RiskBand, Stage } from './domain'

export const UI_EASE = [0.22, 1, 0.36, 1] as const
export const UI_TRANSITION_FAST = { duration: 0.18, ease: UI_EASE } as const
export const UI_TRANSITION_MEDIUM = { duration: 0.26, ease: UI_EASE } as const

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

export const Bar = ({ val, max = 100, color, h = 5 }: { val: number; max?: number; color: string; h?: number }) => {
  const shouldReduceMotion = useReducedMotion()
  const width = `${Math.max(0, Math.min(100, (val / max) * 100))}%`

  return (
    <div style={{ width: '100%', height: h, background: T.surface3, borderRadius: 999, overflow: 'hidden' }}>
      <motion.div
        initial={false}
        animate={{ width }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 24, mass: 0.55 }}
        style={{ height: '100%', background: color }}
      />
    </div>
  )
}

export const Card = ({ children, style = {}, glow, onClick }: { children: ReactNode; style?: CSSProperties; glow?: string; onClick?: () => void }) => {
  const shouldReduceMotion = useReducedMotion()
  const interactive = typeof onClick === 'function'
  const baseShadow = style.boxShadow ?? (glow ? `0 0 0 1px ${glow}22 inset, 0 14px 40px ${glow}10` : '0 10px 32px rgba(15, 23, 42, 0.05)')
  const hoverShadow = style.boxShadow
    ? style.boxShadow
    : glow
      ? `0 0 0 1px ${glow}30 inset, 0 20px 46px ${glow}18`
      : '0 18px 44px rgba(15, 23, 42, 0.09)'

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }

  return (
    <motion.div
      data-surface="card"
      data-interactive={interactive ? 'true' : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      initial={false}
      whileHover={!shouldReduceMotion ? {
        y: interactive ? -4 : -2,
        scale: interactive ? 1.008 : 1.003,
        borderColor: glow ? `${glow}66` : T.border2,
        boxShadow: hoverShadow,
      } : undefined}
      whileTap={interactive && !shouldReduceMotion ? { scale: 0.994, y: -1 } : undefined}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_MEDIUM}
      style={{
        background: T.surface,
        border: `1px solid ${glow ? glow + '40' : T.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: baseShadow,
        cursor: interactive ? 'pointer' : style.cursor,
        ...style,
      }}
    >
      {children}
    </motion.div>
  )
}

export const PageShell = ({ size, children, style = {} }: { size: 'wide' | 'standard' | 'narrow'; children: ReactNode; style?: CSSProperties }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={`page-shell page-shell--${size}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_MEDIUM}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export const PageBackButton = ({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      data-pressable="true"
      onClick={onClick}
      whileHover={!shouldReduceMotion ? { x: -4 } : undefined}
      whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_FAST}
      style={{
        ...mono,
        fontSize: 11,
        color: T.accent,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        marginBottom: 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </motion.button>
  )
}

export const Btn = ({ children, onClick, variant = 'primary', size = 'md', type = 'button', disabled = false }: { children: ReactNode; onClick?: () => void; variant?: string; size?: string; type?: 'button' | 'submit' | 'reset'; disabled?: boolean }) => {
  const shouldReduceMotion = useReducedMotion()
  const pad = size === 'sm' ? '8px 12px' : size === 'lg' ? '12px 18px' : '10px 14px'
  const fs = size === 'sm' ? 11 : size === 'lg' ? 14 : 12
  const v = variant === 'ghost' ? { bg: 'transparent', border: T.border2, color: T.text } : variant === 'danger' ? { bg: T.danger, border: T.danger, color: '#fff' } : { bg: T.accent, border: T.accent, color: '#fff' }
  const baseShadow = disabled
    ? 'none'
    : variant === 'ghost'
      ? '0 8px 20px rgba(15, 23, 42, 0.04)'
      : `0 14px 28px ${v.border}24`
  const hoverShadow = disabled
    ? 'none'
    : variant === 'ghost'
      ? '0 14px 28px rgba(15, 23, 42, 0.08)'
      : `0 18px 36px ${v.border}34`

  return (
    <motion.button
      type={type}
      disabled={disabled}
      data-pressable="true"
      onClick={onClick}
      initial={false}
      whileHover={!disabled && !shouldReduceMotion ? { y: -2, scale: 1.01, boxShadow: hoverShadow } : undefined}
      whileTap={!disabled && !shouldReduceMotion ? { y: 0, scale: 0.98 } : undefined}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_FAST}
      style={{
        borderRadius: 9,
        padding: pad,
        border: `1px solid ${v.border}`,
        background: disabled ? `${T.surface3}` : v.bg,
        color: disabled ? T.dim : v.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: baseShadow,
        ...mono,
        fontSize: fs,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </motion.button>
  )
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

export const StagePips = ({ current }: { current: Stage }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3].map(s => (
        <motion.div
          key={s}
          initial={false}
          animate={{
            scale: s <= current ? 1 : 0.92,
            background: s <= current ? stageColor(s as Stage) : T.border2,
            boxShadow: s <= current ? `0 0 10px ${stageColor(s as Stage)}44` : 'none',
          }}
          transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_FAST}
          style={{ width: 7, height: 7, borderRadius: 2 }}
        />
      ))}
    </div>
  )
}
