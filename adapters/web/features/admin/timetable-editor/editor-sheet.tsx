import type { Dispatch, SetStateAction } from 'react'
import { Trash2, X } from 'lucide-react'
import type { Offering } from '@web/simulation/fixtures'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import { minutesToDisplayLabel } from '@web/shared/state/calendar-utils'
import { Btn, Card } from '@web/shared/ui/primitives'
import { markerDefaultTitle, markerTypeColor, markerTypeLabel } from './helpers'
import { fieldStyle, iconButtonStyle, sheetBackdropStyle, sheetCardStyle, textAreaStyle } from './styles'
import type { EditorSheetState } from './types'

function FieldLabel({ children }: { children: string }) {
  return <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>{children}</div>
}

export function EditorSheet({
  editorSheet,
  setEditorSheet,
  saveEditorSheet,
  deleteEditorSheetItem,
  offerings,
}: {
  editorSheet: EditorSheetState
  setEditorSheet: Dispatch<SetStateAction<EditorSheetState | null>>
  saveEditorSheet: () => void
  deleteEditorSheetItem: () => void
  offerings: Offering[]
}) {
  return (
    <div onClick={() => setEditorSheet(null)} style={sheetBackdropStyle}>
      <div onClick={event => event.stopPropagation()} style={sheetCardStyle(editorSheet.type === 'class-info' ? 420 : 560)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>
              {editorSheet.type === 'marker'
                ? `${editorSheet.mode === 'edit' ? 'Edit' : 'Create'} ${markerTypeLabel(editorSheet.draft.markerType)}`
                : editorSheet.type === 'extra-class'
                  ? `${editorSheet.mode === 'edit' ? 'Edit' : 'Schedule'} Extra Class`
                  : `${editorSheet.block.courseCode} · Sec ${editorSheet.block.section}`}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
              {editorSheet.type === 'class-info'
                ? 'Recurring teaching block. Drag or resize it directly on the planner to change timing.'
                : 'Changes stay local until you press Save Planner.'}
            </div>
          </div>
          <button type="button" onClick={() => setEditorSheet(null)} style={iconButtonStyle()}>
            <X size={14} />
          </button>
        </div>

        {editorSheet.type === 'class-info' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <Card style={{ padding: 12, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>{editorSheet.block.courseName}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                {editorSheet.block.day} · {minutesToDisplayLabel(editorSheet.block.startMinutes)} - {minutesToDisplayLabel(editorSheet.block.endMinutes)}
              </div>
            </Card>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn type="button" size="sm" variant="ghost" onClick={() => setEditorSheet(null)}>Close</Btn>
            </div>
          </div>
        ) : editorSheet.type === 'marker' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <FieldLabel>Type</FieldLabel>
                <select value={editorSheet.draft.markerType} onChange={event => setEditorSheet(current => current?.type === 'marker' ? {
                  ...current,
                  draft: {
                    ...current.draft,
                    markerType: event.target.value as ApiAdminCalendarMarkerType,
                    title: markerDefaultTitle(event.target.value as ApiAdminCalendarMarkerType),
                    color: markerTypeColor(event.target.value as ApiAdminCalendarMarkerType),
                  },
                } : current)} style={fieldStyle}>
                  <option value="semester-start">Semester Start</option>
                  <option value="semester-end">Semester End</option>
                  <option value="term-test-start">Term Test Start</option>
                  <option value="term-test-end">Term Test End</option>
                  <option value="holiday">Holiday</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div>
                <FieldLabel>Title</FieldLabel>
                <input value={editorSheet.draft.title} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)} style={fieldStyle} />
              </div>
              <div>
                <FieldLabel>Date</FieldLabel>
                <input type="date" value={editorSheet.draft.dateISO} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, dateISO: event.target.value } } : current)} style={fieldStyle} />
              </div>
              <div>
                <FieldLabel>End Date</FieldLabel>
                <input type="date" value={editorSheet.draft.endDateISO} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, endDateISO: event.target.value } } : current)} style={fieldStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                  <input type="checkbox" checked={editorSheet.draft.allDay} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, allDay: event.target.checked } } : current)} />
                  All-day planner marker
                </label>
              </div>
              {!editorSheet.draft.allDay ? (
                <>
                  <div>
                    <FieldLabel>Start</FieldLabel>
                    <input type="time" value={editorSheet.draft.start} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, start: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>End</FieldLabel>
                    <input type="time" value={editorSheet.draft.end} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, end: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                </>
              ) : null}
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Note</FieldLabel>
                <textarea value={editorSheet.draft.note} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, note: event.target.value } } : current)} rows={3} style={textAreaStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>{editorSheet.mode === 'edit' ? <Btn type="button" size="sm" variant="danger" onClick={deleteEditorSheetItem}><Trash2 size={12} /> Delete</Btn> : null}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="button" size="sm" variant="ghost" onClick={() => setEditorSheet(null)}>Cancel</Btn>
                <Btn type="button" size="sm" onClick={saveEditorSheet}>Apply Marker</Btn>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <FieldLabel>Class</FieldLabel>
                <select value={editorSheet.draft.offeringId} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, offeringId: event.target.value } } : current)} style={fieldStyle}>
                  <option value="">Select class</option>
                  {offerings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · Sec {offering.section} · {offering.title}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Date</FieldLabel>
                <input type="date" value={editorSheet.draft.dateISO} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, dateISO: event.target.value } } : current)} style={fieldStyle} />
              </div>
              <div>
                <FieldLabel>Start</FieldLabel>
                <input type="time" value={editorSheet.draft.start} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, start: event.target.value } } : current)} style={fieldStyle} />
              </div>
              <div>
                <FieldLabel>End</FieldLabel>
                <input type="time" value={editorSheet.draft.end} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, end: event.target.value } } : current)} style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>{editorSheet.mode === 'edit' ? <Btn type="button" size="sm" variant="danger" onClick={deleteEditorSheetItem}><Trash2 size={12} /> Delete</Btn> : null}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="button" size="sm" variant="ghost" onClick={() => setEditorSheet(null)}>Cancel</Btn>
                <Btn type="button" size="sm" onClick={saveEditorSheet}>Apply Class</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
