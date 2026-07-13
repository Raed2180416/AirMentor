import type { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T, mono } from '@web/simulation/fixtures'
import { getAccessibleDangerAccent, getAccessiblePrimaryAccent } from './color'
import { UI_TRANSITION_FAST } from './tokens'

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
  ariaControls,
  ariaSelected,
  tabIndex,
  id,
  role,
  title,
  style: styleOverride,
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
  ariaControls?: string
  ariaSelected?: boolean
  tabIndex?: number
  id?: string
  role?: string
  title?: string
  style?: CSSProperties
}) => {
  const shouldReduceMotion = useReducedMotion()
  const pad = size === 'sm' ? '8px 12px' : size === 'lg' ? '12px 18px' : '10px 14px'
  const fs = size === 'sm' ? 11 : size === 'lg' ? 14 : 12
  const accessiblePrimaryAccent = getAccessiblePrimaryAccent(T.accent)
  const accessibleDangerAccent = getAccessibleDangerAccent(T.danger)
  const v = variant === 'ghost'
    ? { bg: 'transparent', border: T.border2, color: T.text }
    : variant === 'danger'
      ? { bg: accessibleDangerAccent, border: accessibleDangerAccent, color: '#fff' }
      : { bg: accessiblePrimaryAccent, border: accessiblePrimaryAccent, color: '#fff' }
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
      id={id}
      type={type}
      disabled={disabled}
      data-pressable="true"
      data-proof-action={dataProofAction}
      data-proof-entity-id={dataProofEntityId}
      role={role}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-selected={ariaSelected}
      tabIndex={tabIndex}
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
        ...styleOverride,
      }}
    >
      {children}
    </motion.button>
  )
}
