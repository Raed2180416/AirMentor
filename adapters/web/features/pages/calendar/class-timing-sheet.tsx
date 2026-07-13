import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { Weekday } from '@kernel/shared/domain'
import { WEEKDAY_ORDER, formatShortDate } from '@web/shared/state/calendar-utils'
import { Btn, UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from '@web/shared/ui/primitives'
import { iconButtonStyle, sheetFieldStyle } from './styles'
import type { ClassEditState } from './types'

export function ClassTimingSheet({
  value,
  onClose,
  onChange,
  onSave,
}: {
  value: ClassEditState
  onClose: () => void
  onChange: (next: Partial<ClassEditState>) => void
  onSave: () => void
}) {
  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 145, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        onClick={event => event.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.985 }}
        transition={UI_TRANSITION_MEDIUM}
        style={{ width: '100%', maxWidth: 440, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, display: 'grid', gap: 14, boxShadow: '0 24px 60px rgba(2, 6, 23, 0.32)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{value.title}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{value.subtitle}</div>
            <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>
              {value.dateISO
                ? `One-off extra class for ${formatShortDate(value.dateISO)}. Time edits keep it on that exact date.`
                : 'Custom time edits snap against neighbouring classes on save.'}
            </div>
          </div>
          <button type="button" aria-label="Close class timing editor" onClick={onClose} style={iconButtonStyle()}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: value.dateISO ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          {!value.dateISO && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ ...mono, fontSize: 10, color: T.muted }}>Day</span>
              <select value={value.day} onChange={event => onChange({ day: event.target.value as Weekday })} style={sheetFieldStyle()}>
                {WEEKDAY_ORDER.map(day => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
          )}
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ ...mono, fontSize: 10, color: T.muted }}>Start</span>
            <input type="time" value={value.start} onChange={event => onChange({ start: event.target.value })} style={sheetFieldStyle()} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ ...mono, fontSize: 10, color: T.muted }}>End</span>
            <input type="time" value={value.end} onChange={event => onChange({ end: event.target.value })} style={sheetFieldStyle()} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={onSave}>Save Timing</Btn>
        </div>
      </motion.div>
    </motion.div>
  )
}
