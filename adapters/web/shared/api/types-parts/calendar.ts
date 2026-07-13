// Admin calendar markers and faculty calendar workspace/calendar contracts.
// Extracted verbatim from '../types'.

import type { FacultyTimetableTemplate } from '@kernel/shared/domain'

export type ApiAdminCalendarMarkerType =
  | 'semester-start'
  | 'semester-end'
  | 'term-test-start'
  | 'term-test-end'
  | 'holiday'
  | 'event'

export type ApiAdminCalendarMarker = {
  markerId: string
  facultyId: string
  markerType: ApiAdminCalendarMarkerType
  title: string
  note: string | null
  dateISO: string
  endDateISO: string | null
  allDay: boolean
  startMinutes: number | null
  endMinutes: number | null
  color: string
  createdAt: number
  updatedAt: number
}

export type ApiAdminFacultyCalendarWorkspace = {
  publishedAt: string | null
  markers: ApiAdminCalendarMarker[]
}

export type ApiAdminFacultyCalendar = {
  facultyId: string
  template: FacultyTimetableTemplate | null
  workspace: ApiAdminFacultyCalendarWorkspace
  directEditWindowEndsAt: string | null
  classEditingLocked: boolean
}
