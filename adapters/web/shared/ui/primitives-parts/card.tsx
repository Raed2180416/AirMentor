import type { CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T } from '@web/simulation/fixtures'
import { withAlpha } from './color'
import { UI_RADII, UI_TRANSITION_MEDIUM } from './tokens'
import { getSurfaceStyle } from './surface-styles'

type CardProps = {
  children: ReactNode
  style?: CSSProperties
  glow?: string
  surface?: 'panel' | 'launch' | 'selected'
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

function getCardSurfaceStyle(surface: NonNullable<CardProps['surface']>, tone: string): CSSProperties {
  if (surface === 'selected') {
    return getSurfaceStyle('selected', tone)
  }
  if (surface === 'launch') {
    return {
      background: `linear-gradient(160deg, ${withAlpha(tone, '0a')} 0%, ${withAlpha(tone, '03')} 20%, ${T.surface} 100%)`,
      border: `1px solid ${withAlpha(tone, '12')}`,
      boxShadow: `0 8px 18px ${withAlpha(tone, '06')}`,
      borderRadius: UI_RADII.card,
    }
  }
  return getSurfaceStyle('primary', tone)
}

export const Card = ({ children, style = {}, glow, surface, onClick, ...rest }: CardProps) => {
  const shouldReduceMotion = useReducedMotion()
  const interactive = typeof onClick === 'function'
  const tone = glow ?? T.accent
  const variant = surface ?? (glow ? 'selected' : 'panel')
  const cardSurface = getCardSurfaceStyle(variant, tone)
  const baseShadow = style.boxShadow ?? cardSurface.boxShadow ?? '0 10px 28px rgba(15, 23, 42, 0.07)'
  const hoverShadow = style.boxShadow
    ? style.boxShadow
    : variant === 'launch'
      ? `0 12px 26px ${withAlpha(tone, '08')}`
      : variant === 'selected'
        ? `0 12px 26px ${withAlpha(tone, '0a')}`
        : '0 14px 32px rgba(15, 23, 42, 0.09)'

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
      data-surface={variant}
      data-interactive={interactive ? 'true' : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      initial={false}
      whileHover={interactive && !shouldReduceMotion ? {
        boxShadow: hoverShadow,
        opacity: 0.998,
      } : undefined}
      whileTap={interactive && !shouldReduceMotion ? { opacity: 0.985 } : undefined}
      transition={shouldReduceMotion ? { duration: 0 } : UI_TRANSITION_MEDIUM}
      style={{
        ...cardSurface,
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
