import type { Offering } from '@web/simulation/fixtures'
import { T } from '@web/simulation/fixtures'
import type { FacultyAccount, FacultyTimetableClassBlock, FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_TIMETABLE_SLOTS,
  classBlockOccursOnDate,
  formatShortDate,
  minutesToTimeString,
  normalizeFacultyTimetableTemplate,
  timeStringToMinutes,
} from '@web/shared/state/calendar-utils'

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

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'AM'
}

export function buildPlannerFaculty(facultyId: string, facultyName: string, offerings: Offering[]): FacultyAccount {
  return {
    facultyId,
    name: facultyName,
    initials: toInitials(facultyName),
    email: '',
    dept: '',
    roleTitle: 'System Admin Timetable',
    allowedRoles: ['Course Leader'],
    courseCodes: offerings.map(offering => offering.code),
    offeringIds: offerings.map(offering => offering.offId),
    menteeIds: [],
  }
}

export function createFallbackTemplate(facultyId: string, facultyName: string, offerings: Offering[], template: FacultyTimetableTemplate | null): FacultyTimetableTemplate {
  if (offerings.length > 0) {
    return normalizeFacultyTimetableTemplate(template ?? undefined, buildPlannerFaculty(facultyId, facultyName, offerings), offerings) as FacultyTimetableTemplate
  }
  return {
    facultyId,
    slots: DEFAULT_TIMETABLE_SLOTS,
    dayStartMinutes: template?.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES,
    dayEndMinutes: template?.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES,
    classBlocks: template?.classBlocks ?? [],
    updatedAt: template?.updatedAt ?? Date.now(),
  }
}

export function markerTypeLabel(markerType: ApiAdminCalendarMarkerType) {
  switch (markerType) {
    case 'semester-start': return 'Semester Start'
    case 'semester-end': return 'Semester End'
    case 'term-test-start': return 'Term Test Start'
    case 'term-test-end': return 'Term Test End'
    case 'holiday': return 'Holiday'
    default: return 'Event'
  }
}

export function markerTypeColor(markerType: ApiAdminCalendarMarkerType) {
  switch (markerType) {
    case 'semester-start': return T.success
    case 'semester-end': return T.orange
    case 'term-test-start': return T.blue
    case 'term-test-end': return T.accent
    case 'holiday': return T.danger
    default: return T.pink
  }
}

export function markerDefaultTitle(markerType: ApiAdminCalendarMarkerType) {
  switch (markerType) {
    case 'semester-start': return 'Semester begins'
    case 'semester-end': return 'Semester closes'
    case 'term-test-start': return 'Term test window opens'
    case 'term-test-end': return 'Term test window closes'
    case 'holiday': return 'University holiday'
    default: return 'University event'
  }
}

export function sortMarkers(markers: ApiAdminCalendarMarker[]) {
  return [...markers].sort((left, right) => {
    if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
    if ((left.startMinutes ?? -1) !== (right.startMinutes ?? -1)) return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    return left.title.localeCompare(right.title)
  })
}

export function createMarkerDraft(input: { markerType: ApiAdminCalendarMarkerType; dateISO: string }) {
  return {
    markerId: `marker-${Date.now()}`,
    markerType: input.markerType,
    title: markerDefaultTitle(input.markerType),
    note: '',
    dateISO: input.dateISO,
    endDateISO: '',
    allDay: true,
    start: minutesToTimeString(DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(DEFAULT_DAY_START_MINUTES + 60),
    color: markerTypeColor(input.markerType),
  } satisfies MarkerDraft
}

export function createMarkerFromDraft(facultyId: string, draft: MarkerDraft, existing?: ApiAdminCalendarMarker): ApiAdminCalendarMarker {
  return {
    markerId: existing?.markerId ?? draft.markerId,
    facultyId,
    markerType: draft.markerType,
    title: draft.title.trim() || markerDefaultTitle(draft.markerType),
    note: draft.note.trim() || null,
    dateISO: draft.dateISO,
    endDateISO: draft.endDateISO.trim() || null,
    allDay: draft.allDay,
    startMinutes: draft.allDay ? null : timeStringToMinutes(draft.start),
    endMinutes: draft.allDay ? null : timeStringToMinutes(draft.end),
    color: draft.color,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
}

export function createMarkerEditorDraft(marker: ApiAdminCalendarMarker): MarkerDraft {
  return {
    markerId: marker.markerId,
    markerType: marker.markerType,
    title: marker.title,
    note: marker.note ?? '',
    dateISO: marker.dateISO,
    endDateISO: marker.endDateISO ?? '',
    allDay: marker.allDay,
    start: minutesToTimeString(marker.startMinutes ?? DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(marker.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 60)),
    color: marker.color,
  }
}

export function formatMarkerWindow(marker: ApiAdminCalendarMarker) {
  if (marker.allDay) {
    return marker.endDateISO ? `${formatShortDate(marker.dateISO)} to ${formatShortDate(marker.endDateISO)}` : formatShortDate(marker.dateISO)
  }
  return `${formatShortDate(marker.dateISO)} · ${minutesToTimeString(marker.startMinutes ?? DEFAULT_DAY_START_MINUTES)} - ${minutesToTimeString(marker.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 60))}`
}

export function resolveCollisionPool(blocks: FacultyTimetableClassBlock[], candidateBlock: FacultyTimetableClassBlock) {
  if (candidateBlock.kind === 'extra' && candidateBlock.dateISO) {
    return blocks.filter(item => item.id === candidateBlock.id || classBlockOccursOnDate(item, candidateBlock.dateISO!, candidateBlock.day))
  }
  return blocks.filter(item => item.id === candidateBlock.id || (item.day === candidateBlock.day && !item.dateISO))
}
