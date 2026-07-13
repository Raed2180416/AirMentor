import { motion, useReducedMotion } from 'framer-motion'
import { T, stageColor } from '@web/simulation/fixtures'
import type { RiskBand, Stage } from '@kernel/shared/domain'
import { Chip } from './chip'
import { UI_TRANSITION_FAST } from './tokens'

export const RiskBadge = ({ band, prob }: { band: RiskBand | null; prob: number | null }) => {
  const c = band === 'High' ? T.danger : band === 'Medium' ? T.warning : band === 'Low' ? T.success : T.dim
  return <Chip color={c}>{band ? `${band}${prob !== null ? ` · ${Math.round(prob * 100)}%` : ''}` : 'No Score'}</Chip>
}

export const StagePips = ({ current }: { current: Stage }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5, 6].map(s => (
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
