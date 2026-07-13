import { Trash2 } from 'lucide-react'
import { T, mono } from '@web/simulation/fixtures'
import type { ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import { Btn } from '@web/shared/ui/primitives'
import { FieldLabel, ModalFrame, SelectInput, TextAreaInput, TextInput } from '@web/features/admin/system-admin-ui'
import { markerDefaultTitle, markerTypeColor, markerTypeLabel, type MarkerDraft } from './calendar-workspace-helpers'

export function CalendarWorkspaceMarkerModal({
  markerDraft,
  editingMarkerId,
  setMarkerDraft,
  onClose,
  onDelete,
  onSave,
}: {
  markerDraft: MarkerDraft
  editingMarkerId: string | null
  setMarkerDraft: React.Dispatch<React.SetStateAction<MarkerDraft | null>>
  onClose: () => void
  onDelete: () => void
  onSave: () => void
}) {
  return (
    <ModalFrame
      eyebrow="Institution Marker"
      title={editingMarkerId ? 'Edit Marker' : `Create ${markerTypeLabel(markerDraft.markerType)}`}
      caption="These markers appear in the same calendar and timetable views faculty use."
      onClose={onClose}
      actions={editingMarkerId ? <Btn type="button" size="sm" variant="danger" onClick={onDelete}><Trash2 size={12} /> Delete</Btn> : undefined}
      width={640}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div>
            <FieldLabel>Type</FieldLabel>
            <SelectInput value={markerDraft.markerType} onChange={event => setMarkerDraft(current => current ? {
              ...current,
              markerType: event.target.value as ApiAdminCalendarMarkerType,
              title: markerDefaultTitle(event.target.value as ApiAdminCalendarMarkerType),
              color: markerTypeColor(event.target.value as ApiAdminCalendarMarkerType),
            } : current)}>
              <option value="semester-start">Semester Start</option>
              <option value="semester-end">Semester End</option>
              <option value="term-test-start">Term Test Start</option>
              <option value="term-test-end">Term Test End</option>
              <option value="holiday">Holiday</option>
              <option value="event">Event</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Title</FieldLabel>
            <TextInput value={markerDraft.title} onChange={event => setMarkerDraft(current => current ? { ...current, title: event.target.value } : current)} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <TextInput type="date" value={markerDraft.dateISO} onChange={event => setMarkerDraft(current => current ? { ...current, dateISO: event.target.value } : current)} />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <TextInput type="date" value={markerDraft.endDateISO} onChange={event => setMarkerDraft(current => current ? { ...current, endDateISO: event.target.value } : current)} />
          </div>
          <div>
            <FieldLabel>Start</FieldLabel>
            <TextInput type="time" value={markerDraft.start} onChange={event => setMarkerDraft(current => current ? { ...current, start: event.target.value, allDay: false } : current)} />
          </div>
          <div>
            <FieldLabel>End</FieldLabel>
            <TextInput type="time" value={markerDraft.end} onChange={event => setMarkerDraft(current => current ? { ...current, end: event.target.value, allDay: false } : current)} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 12px', borderRadius: 12, border: `1px solid ${T.border2}`, background: T.surface, ...mono, fontSize: 11, color: T.text }}>
          <input type="checkbox" checked={markerDraft.allDay} onChange={event => setMarkerDraft(current => current ? { ...current, allDay: event.target.checked } : current)} />
          All-day marker
        </label>
        <div>
          <FieldLabel>Note</FieldLabel>
          <TextAreaInput rows={4} value={markerDraft.note} onChange={event => setMarkerDraft(current => current ? { ...current, note: event.target.value } : current)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <Btn type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="button" size="sm" onClick={onSave}>Save Marker</Btn>
        </div>
      </div>
    </ModalFrame>
  )
}
