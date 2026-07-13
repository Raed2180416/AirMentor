import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T, mono, sora } from '@web/simulation/fixtures'
import { withAlpha } from './color'
import { UI_FONT_SIZES, UI_RADII, UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from './tokens'
import { getIconButtonStyle, getSurfaceStyle } from './surface-styles'

function getFocusableElements(root: HTMLElement | null) {
  if (!root) return [] as HTMLElement[]
  return Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(node => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true' && node.dataset.focusGuard !== 'true')
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
  const onCloseRef = useRef(onClose)
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 860)
  const focusBoundary = useCallback((boundary: 'first' | 'last') => {
    const focusables = getFocusableElements(panelRef.current)
    if (focusables.length === 0) {
      panelRef.current?.focus()
      return
    }
    const first = closeButtonRef.current && focusables.includes(closeButtonRef.current) ? closeButtonRef.current : focusables[0]
    const last = focusables[focusables.length - 1]
    ;(boundary === 'first' ? first : last)?.focus()
  }, [])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

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
      focusBoundary('first')
    }, 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
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
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!activeElement || !panelRef.current?.contains(activeElement)) {
        event.preventDefault()
        focusBoundary(event.shiftKey ? 'last' : 'first')
        return
      }
      if (event.shiftKey && (activeElement === first || activeElement === panelRef.current)) {
        event.preventDefault()
        focusBoundary('last')
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        focusBoundary('first')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus?.()
    }
  }, [focusBoundary])

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
        <span
          data-focus-guard="true"
          tabIndex={0}
          onFocus={() => focusBoundary('last')}
          style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
        />
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
        {footer ? (
          <div style={{ padding: isCompact ? '14px 18px 18px' : '16px 22px 20px', background: withAlpha(T.surface, 'f2') }}>
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${withAlpha(T.border2, '24')} 14%, ${withAlpha(T.border2, '62')} 50%, ${withAlpha(T.border2, '24')} 86%, transparent)`, marginBottom: 12, opacity: 0.88 }} />
            {footer}
          </div>
        ) : null}
        <span
          data-focus-guard="true"
          tabIndex={0}
          onFocus={() => focusBoundary('first')}
          style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
        />
      </motion.div>
    </motion.div>
  )
}
