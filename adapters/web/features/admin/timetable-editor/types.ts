import type { Offering } from '@web/simulation/fixtures'
import type { FacultyTimetableClassBlock, Weekday } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType, ApiAdminFacultyCalendar } from '@web/shared/api/types'

export type SystemAdminTimetableEditorProps = {
  facultyId: string
  facultyName: string
  offerings: Offering[]
  calendar: ApiAdminFacultyCalendar | null
  onSave: (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => Promise<void>
}

export type HoverTarget = {
  dateISO: string
  day: Weekday
}

export type PlannerEventCard = {
  id: string
  eventType: 'class' | 'marker'
  title: string
  subtitle: string
  accent: string
  startMinutes: number
  endMinutes: number
  dateISO: string
  day: Weekday
  classBlock?: FacultyTimetableClassBlock
  marker?: ApiAdminCalendarMarker
  lane: number
  laneCount: number
}

export type InteractionPreview = {
  dateISO: string
  day: Weekday
  startMinutes: number
  endMinutes: number
}

export type PendingDrag = {
  mode: 'pending'
  kind: 'drag'
  eventType: 'class' | 'marker'
  entityId: string
  durationMinutes: number
  offsetMinutes: number
  startedAt: { x: number; y: number }
  cursor: { x: number; y: number }
}

export type ActiveDrag = Omit<PendingDrag, 'mode'> & {
  mode: 'active'
  preview: InteractionPreview | null
}

export type PendingResize = {
  mode: 'pending'
  kind: 'resize'
  eventType: 'class' | 'marker'
  entityId: string
  edge: 'start' | 'end'
  dateISO: string
  day: Weekday
  startedAt: { x: number; y: number }
  cursor: { x: number; y: number }
}

export type ActiveResize = Omit<PendingResize, 'mode'> & {
  mode: 'active'
  preview: InteractionPreview | null
}

export type InteractionState = PendingDrag | ActiveDrag | PendingResize | ActiveResize

export type MarkerDraft = {
  markerId: string
  markerType: ApiAdminCalendarMarkerType
  title: string
  note: string
  dateISO: string
  endDateISO: string
  allDay: boolean
  start: string
  end: string
  color: string
}

export type ExtraClassDraft = {
  blockId: string
  offeringId: string
  dateISO: string
  start: string
  end: string
}

export type EditorSheetState =
  | { type: 'marker'; mode: 'create' | 'edit'; draft: MarkerDraft }
  | { type: 'extra-class'; mode: 'create' | 'edit'; draft: ExtraClassDraft }
  | { type: 'class-info'; block: FacultyTimetableClassBlock }
