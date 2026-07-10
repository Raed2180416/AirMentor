import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { T, mono, sora } from '../data'
import { Btn, UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from '../ui-primitives'

export function RequiredNoteModal({ title, description, submitLabel, onClose, onSubmit }: { title: string; description: string; submitLabel: string; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.985 }}
        transition={UI_TRANSITION_MEDIUM}
        style={{ width: '100%', maxWidth: 520, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: '0 24px 60px rgba(2, 6, 23, 0.32)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{title}</div>
          <button aria-label="Close note modal" title="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={16} /></button>
        </div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 10 }}>{description}</div>
        <textarea aria-label="Required note" value={note} onChange={e => setNote(e.target.value)} rows={5} placeholder="Enter the required note" style={{ width: '100%', resize: 'none', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '10px 12px' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={() => {
            if (!note.trim()) return
            onSubmit(note.trim())
          }}>{submitLabel}</Btn>
        </div>
      </motion.div>
    </motion.div>
  )
}
