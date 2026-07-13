import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { T, mono, sora, type Offering } from '@web/simulation/fixtures'
import { formatShortDate, minutesToTimeString } from '@web/shared/state/calendar-utils'
import { Btn, UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from '@web/shared/ui/primitives'
import { normalizeTimeValue } from './calendar-helpers'
import { iconButtonStyle, sheetFieldStyle } from './styles'
import type { ExtraClassDraftState } from './types'

export function ExtraClassSheet({
  draft,
  offerings,
  onClose,
  onChange,
  onSave,
}: {
  draft: ExtraClassDraftState
  offerings: Offering[]
  onClose: () => void
  onChange: (next: Partial<ExtraClassDraftState>) => void
  onSave: () => void
}) {
  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 142, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        onClick={event => event.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.985 }}
        transition={UI_TRANSITION_MEDIUM}
        style={{ width: '100%', maxWidth: 560, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, display: 'grid', gap: 14, boxShadow: '0 24px 60px rgba(2, 6, 23, 0.32)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Schedule Extra Class</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>One-off class on {formatShortDate(draft.dateISO)}. This stays linked to the real course workspace.</div>
          </div>
          <button type="button" aria-label="Close extra class editor" onClick={onClose} style={iconButtonStyle()}>
            <X size={14} />
          </button>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ ...mono, fontSize: 10, color: T.muted }}>Class</span>
          <select value={draft.offeringId} onChange={event => onChange({ offeringId: event.target.value })} style={sheetFieldStyle()}>
            {offerings.map(offering => (
              <option key={offering.offId} value={offering.offId}>{offering.code} · Sec {offering.section} · {offering.title}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ ...mono, fontSize: 10, color: T.muted }}>Start</span>
            <input type="time" value={minutesToTimeString(draft.startMinutes)} onChange={event => onChange({ startMinutes: normalizeTimeValue(event.target.value, draft.startMinutes) })} style={sheetFieldStyle()} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ ...mono, fontSize: 10, color: T.muted }}>End</span>
            <input type="time" value={minutesToTimeString(draft.endMinutes)} onChange={event => onChange({ endMinutes: normalizeTimeValue(event.target.value, draft.endMinutes) })} style={sheetFieldStyle()} />
          </label>
        </div>

        <div style={{ ...mono, fontSize: 10, color: T.dim }}>
          If this extra class overlaps the day, neighbouring classes will only reflow when there is a real collision.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={onSave}>Save Extra Class</Btn>
        </div>
      </motion.div>
    </motion.div>
  )
}
