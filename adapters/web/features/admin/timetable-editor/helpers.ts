import type { Offering } from '@web/simulation/fixtures'
import { T } from '@web/simulation/fixtures'
import type { FacultyAccount, FacultyTimetableClassBlock, FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_TIMETABLE_SLOTS,
  MIN_EVENT_DURATION_MINUTES,
  assignAgendaLanes,
  classBlockOccursOnDate,
  getWeekdayForDateISO,
  minutesToTimeString,
  normalizeFacultyTimetableTemplate,
  normalizeTimedRange,
  timeStringToMinutes,
} from '@web/shared/state/calendar-utils'
import type { MarkerDraft, PlannerEventCard } from './types'

export const PIXELS_PER_MINUTE = 1.02
export const DRAG_THRESHOLD_PX = 4

export function toInitials(name: string) {
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

export function markerSpansDate(marker: Pick<ApiAdminCalendarMarker, 'dateISO' | 'endDateISO'>, dateISO: string) {
  const endDateISO = marker.endDateISO || marker.dateISO
  return dateISO >= marker.dateISO && dateISO <= endDateISO
}

export function sortMarkers(markers: ApiAdminCalendarMarker[]) {
  return [...markers].sort((left, right) => {
    if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
    if ((left.startMinutes ?? -1) !== (right.startMinutes ?? -1)) return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    return left.title.localeCompare(right.title)
  })
}

export function createMarkerDraft(input: { markerType: ApiAdminCalendarMarkerType; facultyId: string; dateISO: string; timed?: { startMinutes: number; endMinutes: number } }) {
  const color = markerTypeColor(input.markerType)
  return {
    markerId: `marker-${Date.now()}`,
    markerType: input.markerType,
    title: markerDefaultTitle(input.markerType),
    note: '',
    dateISO: input.dateISO,
    endDateISO: '',
    allDay: !input.timed,
    start: minutesToTimeString(input.timed?.startMinutes ?? DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(input.timed?.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 60)),
    color,
  }
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

export function createExtraClassDraft(dateISO: string, offerings: Offering[], timed?: { startMinutes: number; endMinutes: number }, existing?: FacultyTimetableClassBlock) {
  return {
    blockId: existing?.id ?? '',
    offeringId: existing?.offeringId ?? offerings[0]?.offId ?? '',
    dateISO,
    start: minutesToTimeString(existing?.startMinutes ?? timed?.startMinutes ?? DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(existing?.endMinutes ?? timed?.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 50)),
  }
}

export function markerDraftFromMarker(marker: ApiAdminCalendarMarker, dayStartMinutes: number): MarkerDraft {
  return {
    markerId: marker.markerId,
    markerType: marker.markerType,
    title: marker.title,
    note: marker.note ?? '',
    dateISO: marker.dateISO,
    endDateISO: marker.endDateISO ?? '',
    allDay: marker.allDay,
    start: minutesToTimeString(marker.startMinutes ?? dayStartMinutes),
    end: minutesToTimeString(marker.endMinutes ?? (dayStartMinutes + 60)),
    color: marker.color,
  }
}

export function getColumnMinuteValue(event: PointerEvent, rect: DOMRect, dayStartMinutes: number, dayEndMinutes: number) {
  const relativeY = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
  const minutes = dayStartMinutes + Math.round(relativeY / PIXELS_PER_MINUTE)
  return normalizeTimedRange(minutes, minutes + MIN_EVENT_DURATION_MINUTES, dayStartMinutes, dayEndMinutes).startMinutes
}

export function computeTimedLayout(items: PlannerEventCard[]) {
  const laidOut = assignAgendaLanes(items.map(item => ({
    id: item.id,
    startMinutes: item.startMinutes,
    endMinutes: item.endMinutes,
  })))
  const layoutById = Object.fromEntries(laidOut.map(item => [item.id, item]))
  return items.map(item => ({
    ...item,
    lane: layoutById[item.id]?.lane ?? 0,
    laneCount: layoutById[item.id]?.laneCount ?? 1,
  }))
}

export function buildAllDayMarkersByDate(weekDates: string[], markers: ApiAdminCalendarMarker[]): Record<string, ApiAdminCalendarMarker[]> {
  return Object.fromEntries(weekDates.map(dateISO => [
    dateISO,
    markers.filter(marker => marker.allDay && markerSpansDate(marker, dateISO)),
  ]))
}

export function buildTimedEventsByDate(
  weekDates: string[],
  classBlocks: FacultyTimetableClassBlock[],
  markers: ApiAdminCalendarMarker[],
  dayStartMinutes: number,
): Record<string, PlannerEventCard[]> {
  return Object.fromEntries(weekDates.map(dateISO => {
    const day = getWeekdayForDateISO(dateISO)
    if (!day) return [dateISO, [] as PlannerEventCard[]]
    const classEvents: PlannerEventCard[] = classBlocks
      .filter(block => classBlockOccursOnDate(block, dateISO, day))
      .map(block => ({
        id: `class:${block.id}`,
        eventType: 'class' as const,
        title: `${block.courseCode} · Sec ${block.section}`,
        subtitle: block.kind === 'extra' ? `${block.courseName} · extra class` : block.courseName,
        accent: block.kind === 'extra' ? T.orange : T.accent,
        startMinutes: block.startMinutes,
        endMinutes: block.endMinutes,
        dateISO,
        day,
        classBlock: block,
        lane: 0,
        laneCount: 1,
      }))
    const markerEvents: PlannerEventCard[] = markers
      .filter(marker => !marker.allDay && markerSpansDate(marker, dateISO) && marker.startMinutes != null && marker.endMinutes != null)
      .map(marker => ({
        id: `marker:${marker.markerId}`,
        eventType: 'marker' as const,
        title: marker.title,
        subtitle: markerTypeLabel(marker.markerType),
        accent: marker.color,
        startMinutes: marker.startMinutes ?? dayStartMinutes,
        endMinutes: marker.endMinutes ?? (dayStartMinutes + 60),
        dateISO,
        day,
        marker,
        lane: 0,
        laneCount: 1,
      }))
    return [dateISO, computeTimedLayout([...classEvents, ...markerEvents])]
  }))
}
