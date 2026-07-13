import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { T, mono } from '@web/simulation/fixtures'

const dotTransition = {
  duration: 0.8,
  repeat: Infinity,
  repeatType: 'reverse' as const,
  ease: 'easeInOut' as const,
}

export function ReevaluatingRiskLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-proof-state="reevaluating-risk"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 28,
        padding: '5px 9px',
        borderRadius: 999,
        border: `1px solid ${T.border}`,
        background: T.surface2,
        color: T.muted,
        boxShadow: '0 8px 22px rgba(2, 6, 23, 0.12)',
      }}
    >
      <Activity size={14} aria-hidden="true" color={T.accent} />
      <span style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        Reevaluating risk
      </span>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {[0, 1, 2].map(index => (
          <motion.span
            key={index}
            animate={{ opacity: [0.35, 1], y: [0, -2] }}
            transition={{ ...dotTransition, delay: index * 0.12 }}
            style={{
              width: 4,
              height: 4,
              borderRadius: 999,
              background: T.accent,
              display: 'inline-block',
            }}
          />
        ))}
      </span>
    </div>
  )
}
