import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T, mono, sora, stageColor } from './data'
import type { RiskBand, Stage, ThemeMode } from './domain'
import { isLightTheme } from './theme'

export const UI_EASE = [0.22, 1, 0.36, 1] as const
export const UI_TRANSITION_FAST = { duration: 0.18, ease: UI_EASE } as const
export const UI_TRANSITION_MEDIUM = { duration: 0.26, ease: UI_EASE } as const
export const UI_FONT_SIZES = {
  micro: 9,
  eyebrow: 10,
  meta: 11,
  body: 12,
  bodyStrong: 13,
  title: 16,
  heading: 18,
  hero: 28,
} as const
export const UI_RADII = {
  chip: 10,
  button: 12,
  field: 14,
  card: 18,
  panel: 20,
  modal: 24,
  pill: 999,
} as const

type SurfaceRole = 'primary' | 'secondary' | 'field' | 'selected' | 'warning' | 'danger' | 'success' | 'modal'

export function withAlpha(color: string, alpha: string) {
  if (!color.startsWith('#')) return color
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}${alpha}`
  }
  return `${color.slice(0, 7)}${alpha}`
}

export function getSurfaceStyle(role: SurfaceRole, tone = T.accent): CSSProperties {
  if (role === 'field') {
    return {
      background: T.surface,
      border: `1px solid ${T.border2}`,
      boxShadow: `inset 0 1px 0 ${withAlpha(T.surface3, 'f2')}`,
      borderRadius: UI_RADII.field,
    }
  }
  if (role === 'selected') {
    return {
      background: `linear-gradient(180deg, ${withAlpha(tone, '16')}, ${T.surface})`,
      border: `1px solid ${withAlpha(tone, '4d')}`,
      boxShadow: `0 0 0 1px ${withAlpha(tone, '14')} inset, 0 16px 34px ${withAlpha(tone, '14')}`,
      borderRadius: UI_RADII.card,
    }
  }
  if (role === 'warning' || role === 'danger' || role === 'success') {
    return {
      background: `linear-gradient(180deg, ${withAlpha(tone, '12')}, ${T.surface})`,
      border: `1px solid ${withAlpha(tone, '30')}`,
      boxShadow: `0 18px 40px ${withAlpha(tone, '16')}`,
      borderRadius: UI_RADII.card,
    }
  }
  if (role === 'secondary') {
    return {
      background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`,
      border: `1px solid ${T.border}`,
      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
      borderRadius: UI_RADII.card,
    }
  }
  if (role === 'modal') {
    return {
      background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
      border: `1px solid ${T.border}`,
      boxShadow: '0 32px 86px rgba(2, 6, 23, 0.32)',
      borderRadius: UI_RADII.modal,
    }
  }
  return {
    background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
    border: `1px solid ${T.border}`,
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
    borderRadius: UI_RADII.card,
  }
}

export function getFieldChromeStyle({
  minHeight = 42,
  dense = false,
  tone = 'neutral',
}: {
  minHeight?: number
  dense?: boolean
  tone?: 'neutral' | 'selected'
} = {}): CSSProperties {
  const toneColor = tone === 'selected' ? T.accent : T.border2
  return {
    width: '100%',
    minHeight,
    ...mono,
    fontSize: dense ? UI_FONT_SIZES.meta : UI_FONT_SIZES.body,
    background: T.surface,
    color: T.text,
    colorScheme: 'inherit',
    border: `1px solid ${tone === 'selected' ? withAlpha(T.accent, '55') : toneColor}`,
    borderRadius: UI_RADII.field,
    padding: dense ? '8px 10px' : '10px 12px',
    boxShadow: `inset 0 1px 0 ${withAlpha(T.surface3, 'f2')}`,
  }
}

export function getShellBarStyle(themeMode: ThemeMode): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'grid',
    gap: 12,
    padding: '12px 20px 16px',
    background: isLightTheme(themeMode) ? 'rgba(247,251,255,0.88)' : 'rgba(9,14,22,0.88)',
    backdropFilter: 'blur(16px)',
    borderBottom: `1px solid ${T.border}`,
    boxShadow: isLightTheme(themeMode) ? '0 12px 28px rgba(15, 23, 42, 0.06)' : '0 16px 34px rgba(2, 6, 23, 0.22)',
  }
}

export function getIconButtonStyle({
  active = false,
  tone = T.accent,
  subtle = false,
  size = 38,
}: {
  active?: boolean
  tone?: string
  subtle?: boolean
  size?: number
} = {}): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: UI_RADII.button,
    border: `1px solid ${active ? withAlpha(tone, '55') : subtle ? T.border : T.border2}`,
    background: active
      ? `linear-gradient(180deg, ${withAlpha(tone, '16')}, ${T.surface})`
      : subtle
        ? 'transparent'
        : `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
    color: active ? tone : T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    boxShadow: active ? `0 12px 28px ${withAlpha(tone, '18')}` : '0 8px 18px rgba(15, 23, 42, 0.05)',
  }
}

export function getSegmentedGroupStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: 4,
    padding: 4,
    borderRadius: UI_RADII.panel,
    background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`,
    border: `1px solid ${T.border}`,
    boxShadow: `inset 0 1px 0 ${withAlpha(T.surface3, 'f0')}`,
  }
}

export function getSegmentedButtonStyle({
  active,
  disabled = false,
  tone = T.accent,
  compact = false,
}: {
  active: boolean
  disabled?: boolean
  tone?: string
  compact?: boolean
}): CSSProperties {
  return {
    ...sora,
    fontWeight: 700,
    fontSize: compact ? UI_FONT_SIZES.meta : UI_FONT_SIZES.body,
    padding: compact ? '7px 12px' : '8px 14px',
    minHeight: compact ? 34 : 38,
    borderRadius: UI_RADII.button,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? `linear-gradient(180deg, ${tone}, ${withAlpha(tone, 'd8')})` : 'transparent',
    color: active ? '#fff' : disabled ? T.dim : T.muted,
    opacity: disabled ? 0.55 : 1,
    boxShadow: active ? `0 12px 24px ${withAlpha(tone, '26')}` : 'none',
    whiteSpace: 'nowrap',
  }
}

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

export function FieldInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...getFieldChromeStyle(), ...(props.style ?? {}) }} />
}

export function FieldSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...getFieldChromeStyle(), ...(props.style ?? {}) }} />
}

export function FieldTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...getFieldChromeStyle(), resize: 'vertical', ...(props.style ?? {}) }} />
}

function getFocusableElements(root: HTMLElement | null) {
  if (!root) return [] as HTMLElement[]
  return Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(node => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true')
}

export function ModalWorkspace({
  eyebrow,
  title,
  caption,
  onClose,
  footer,
  children,
  size = 'md',
  width,
  zIndex = 130,
  bodyStyle,
}: {
  eyebrow?: string
  title: string
  caption?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  width?: number
  zIndex?: number
  bodyStyle?: CSSProperties
}) {
  const shouldReduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 860)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setIsCompact(window.innerWidth < 860)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      const focusables = getFocusableElements(panelRef.current)
      ;(closeButtonRef.current ?? focusables[0] ?? panelRef.current)?.focus()
    }, 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = getFocusableElements(panelRef.current)
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus?.()
    }
  }, [onClose])

  const isFullSize = size === 'full'
  const sizeWidth = size === 'sm' ? 560 : size === 'lg' ? 880 : size === 'xl' ? 1040 : isFullSize ? 1480 : 720
  const resolvedWidth = width ?? sizeWidth

  return (
    <motion.div
      onClick={onClose}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_FAST}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(6, 12, 20, 0.54)',
        backdropFilter: 'blur(14px)',
        padding: isCompact ? 0 : isFullSize ? '14px 12px' : '32px 18px',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 28, scale: 0.972 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.985 }}
        transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_MEDIUM}
        style={{
          ...getSurfaceStyle('modal'),
          width: isCompact ? '100vw' : isFullSize ? `min(calc(100vw - 28px), ${resolvedWidth}px)` : `min(100%, ${resolvedWidth}px)`,
          maxWidth: isCompact ? '100vw' : isFullSize ? `min(calc(100vw - 28px), ${resolvedWidth}px)` : resolvedWidth,
          height: isCompact ? '100dvh' : isFullSize ? 'calc(100dvh - 28px)' : 'auto',
          maxHeight: isCompact ? '100dvh' : isFullSize ? 'calc(100dvh - 28px)' : 'min(88vh, 920px)',
          borderRadius: isCompact ? 0 : isFullSize ? UI_RADII.modal : undefined,
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: isCompact ? '18px 18px 16px' : '20px 22px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            {eyebrow ? <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div> : null}
            <div style={{ ...sora, fontSize: isCompact ? 22 : 24, fontWeight: 800, color: T.text, lineHeight: 1.08 }}>{title}</div>
            {caption ? <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, lineHeight: 1.8 }}>{caption}</div> : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close dialog"
            title="Close"
            onClick={onClose}
            style={{ ...getIconButtonStyle({ subtle: false, size: 38 }) }}
          >
            ×
          </button>
        </div>
        <div className="scroll-pane scroll-pane--dense" style={{ overflowY: 'auto', padding: isCompact ? 18 : 20, ...bodyStyle }}>
          {children}
        </div>
        {footer ? <div style={{ padding: isCompact ? '14px 18px 18px' : '16px 22px 20px', borderTop: `1px solid ${T.border}`, background: withAlpha(T.surface, 'f2') }}>{footer}</div> : null}
      </motion.div>
    </motion.div>
  )
}

export const Chip = ({ children, color = T.muted, size = 11 }: { children: ReactNode; color?: string; size?: number }) => (
  <span style={{ ...mono, fontSize: size, padding: '3px 8px', borderRadius: UI_RADII.chip, background: withAlpha(color, '12'), color, border: `1px solid ${withAlpha(color, '28')}`, whiteSpace: 'nowrap' as const, display: 'inline-block' }}>{children}</span>
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

type CardProps = {
  children: ReactNode
  style?: CSSProperties
  glow?: string
  onClick?: () => void
} & Omit<
  HTMLAttributes<HTMLDivElement>,
  'onAnimationEnd'
  | 'onAnimationEndCapture'
  | 'onAnimationIteration'
  | 'onAnimationIterationCapture'
  | 'onAnimationStart'
  | 'onAnimationStartCapture'
  | 'onDrag'
  | 'onDragCapture'
  | 'onDragEnd'
  | 'onDragEndCapture'
  | 'onDragStart'
  | 'onDragStartCapture'
>

export const Card = ({ children, style = {}, glow, onClick, ...rest }: CardProps) => {
  const shouldReduceMotion = useReducedMotion()
  const interactive = typeof onClick === 'function'
  const role = glow ? 'selected' : 'primary'
  const surface = getSurfaceStyle(role, glow ?? T.accent)
  const baseShadow = style.boxShadow ?? (glow ? `0 0 0 1px ${withAlpha(glow, '22')} inset, 0 14px 40px ${withAlpha(glow, '10')}` : '0 10px 28px rgba(15, 23, 42, 0.07)')
  const hoverShadow = style.boxShadow
    ? style.boxShadow
    : glow
      ? `0 0 0 1px ${withAlpha(glow, '36')} inset, 0 20px 46px ${withAlpha(glow, '18')}`
      : '0 16px 34px rgba(15, 23, 42, 0.1)'

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }

  return (
    <motion.div
      {...rest}
      data-surface="card"
      data-interactive={interactive ? 'true' : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      initial={false}
      whileHover={interactive && !shouldReduceMotion ? {
        borderColor: glow ? withAlpha(glow, '66') : T.border2,
        boxShadow: hoverShadow,
        opacity: 0.998,
      } : undefined}
      whileTap={interactive && !shouldReduceMotion ? { opacity: 0.985 } : undefined}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_MEDIUM}
      style={{
        ...surface,
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
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_MEDIUM}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export const PageBackButton = ({
  onClick,
  label = 'Back',
  dataProofAction,
}: {
  onClick: () => void
  label?: string
  dataProofAction?: string
}) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      data-pressable="true"
      data-proof-action={dataProofAction}
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

export const Btn = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  dataProofAction,
  dataProofEntityId,
  ariaLabel,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: string
  size?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  dataProofAction?: string
  dataProofEntityId?: string
  ariaLabel?: string
  title?: string
}) => {
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
      data-proof-action={dataProofAction}
      data-proof-entity-id={dataProofEntityId}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      initial={false}
      whileHover={!disabled && !shouldReduceMotion ? { boxShadow: hoverShadow, opacity: 0.998 } : undefined}
      whileTap={!disabled && !shouldReduceMotion ? { opacity: 0.985 } : undefined}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_FAST}
      style={{
        borderRadius: 9,
        padding: pad,
        border: `1px solid ${v.border}`,
        background: disabled ? T.surface3 : variant === 'ghost' ? `linear-gradient(180deg, ${T.surface}, ${T.surface2})` : v.bg,
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
  <th style={{ textAlign: 'left', padding: '11px 12px', borderBottom: `1px solid ${T.border}`, ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</th>
)

export const TD = ({ children, style = {}, ...rest }: { children: ReactNode; style?: CSSProperties; colSpan?: number }) => (
  <td {...rest} style={{ padding: '11px 12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle', ...style }}>{children}</td>
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
