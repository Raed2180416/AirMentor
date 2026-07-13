import { motion, useReducedMotion } from 'framer-motion'
import { T } from '@web/simulation/fixtures'

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
