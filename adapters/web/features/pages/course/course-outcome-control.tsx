import { useState } from 'react'
import { T, mono, sora, type CODef } from '@web/simulation/fixtures'

export function CourseOutcomeControl({ co, active, color, disabled, onClick }: { co: CODef; active: boolean; color: string; disabled: boolean; onClick: () => void }) {
  const [open, setOpen] = useState(false)
  const tooltipId = `co-tooltip-${co.id}`
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        aria-describedby={open ? tooltipId : undefined}
        disabled={disabled}
        onClick={onClick}
        style={{ ...mono, fontSize: 9, padding: '4px 8px', borderRadius: 999, border: `1px solid ${active ? color : T.border}`, background: active ? `${color}18` : 'transparent', color: active ? color : T.muted, cursor: disabled ? 'default' : 'pointer' }}
      >
        {co.id}
      </button>
      {open ? (
        <div
          id={tooltipId}
          role="tooltip"
          data-co-tooltip="true"
          style={{ position: 'absolute', zIndex: 40, left: 0, bottom: 'calc(100% + 8px)', width: 260, padding: '10px 12px', borderRadius: 12, background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`, border: `1px solid ${color}33`, boxShadow: '0 18px 36px rgba(15, 23, 42, 0.18)', color: T.text, pointerEvents: 'none' }}
        >
          <div style={{ ...sora, fontSize: 12, fontWeight: 700, color }}>{co.id} · {co.bloom}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6, marginTop: 4 }}>{co.desc}</div>
        </div>
      ) : null}
    </span>
  )
}
