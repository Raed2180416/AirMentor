import type { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T, mono } from '@web/simulation/fixtures'
import { UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from './tokens'

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
