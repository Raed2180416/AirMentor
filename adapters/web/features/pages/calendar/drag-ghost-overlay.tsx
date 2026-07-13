import { AnimatePresence, motion } from 'framer-motion'
import { T, mono, sora } from '@web/simulation/fixtures'
import { minutesToDisplayLabel } from '@web/shared/state/calendar-utils'
import type { InteractionState } from './types'

export function DragGhostOverlay({ interaction }: { interaction: InteractionState | null }) {
  return (
    <AnimatePresence>
      {interaction?.mode === 'active' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 0.98, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: interaction.cursor.x + 16,
            top: interaction.cursor.y + 12,
            zIndex: 180,
            pointerEvents: 'none',
            width: 220,
            borderRadius: 14,
            border: `1px solid ${interaction.accent}55`,
            background: `${T.surface}`,
            boxShadow: `0 18px 40px ${interaction.accent}20`,
            padding: '10px 12px',
          }}
        >
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {interaction.kind === 'resize' ? 'Resizing' : 'Moving'}
          </div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{interaction.title}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{interaction.subtitle}</div>
          {interaction.preview?.placementMode === 'timed' && typeof interaction.preview.startMinutes === 'number' && typeof interaction.preview.endMinutes === 'number' && (
            <div style={{ ...mono, fontSize: 10, color: interaction.preview.valid ? T.accent : T.danger, marginTop: 6 }}>
              {interaction.preview.dateISO} · {minutesToDisplayLabel(interaction.preview.startMinutes)} - {minutesToDisplayLabel(interaction.preview.endMinutes)}
            </div>
          )}
          {interaction.preview?.placementMode === 'untimed' && (
            <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 6 }}>
              {interaction.preview.dateISO} · No preferred time
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
