import {
  normalizeDateISO,
  type FacultyAccount,
  type FacultyTimetableClassBlock,
  type FacultyTimetableTemplate,
  type TimetableSlotDefinition,
} from '@kernel/shared/domain'
import type { Offering } from '@web/simulation/fixtures'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_TASK_DURATION_MINUTES,
  DEFAULT_TIMETABLE_SLOTS,
  MIN_EVENT_DURATION_MINUTES,
  WEEKDAY_ORDER,
} from './constants'
import { getSlotMap, resolveLegacySlotRange } from './slot-helpers'
import { normalizeTimedRange, timeStringToMinutes } from './time-scalars'

function getSeedCellSequence(slots: TimetableSlotDefinition[]) {
  return WEEKDAY_ORDER.flatMap((day, dayIndex) => slots.slice(0, 6).map((slot, slotIndex) => ({
    day,
    slotId: slot.id,
    rank: dayIndex + (slotIndex * WEEKDAY_ORDER.length),
  })))
}

function findCellIndex(cells: ReturnType<typeof getSeedCellSequence>, occupied: Set<string>, startIndex: number) {
  for (let offset = 0; offset < cells.length; offset += 1) {
    const cell = cells[(startIndex + offset) % cells.length]
    if (!occupied.has(`${cell.day}::${cell.slotId}`)) return (startIndex + offset) % cells.length
  }
  return startIndex % cells.length
}

export function seedFacultyTimetableTemplate(faculty: FacultyAccount, offerings: Offering[]): FacultyTimetableTemplate {
  const slots = DEFAULT_TIMETABLE_SLOTS
  const cells = getSeedCellSequence(slots)
  const occupied = new Set<string>()
  const classBlocks: FacultyTimetableClassBlock[] = []
  const sortedOfferings = [...offerings].sort((left, right) => left.offId.localeCompare(right.offId))

  sortedOfferings.forEach((offering, offeringIndex) => {
    for (let occurrence = 0; occurrence < 2; occurrence += 1) {
      const startIndex = (offeringIndex + (occurrence * sortedOfferings.length)) % cells.length
      const resolvedIndex = findCellIndex(cells, occupied, startIndex)
      const cell = cells[resolvedIndex]
      const slot = slots.find(item => item.id === cell.slotId) ?? slots[0]
      occupied.add(`${cell.day}::${cell.slotId}`)
      classBlocks.push({
        id: `class-${faculty.facultyId}-${offering.offId}-${occurrence + 1}`,
        facultyId: faculty.facultyId,
        offeringId: offering.offId,
        courseCode: offering.code,
        courseName: offering.title,
        section: offering.section,
        year: offering.year,
        day: cell.day,
        startMinutes: timeStringToMinutes(slot.startTime),
        endMinutes: timeStringToMinutes(slot.endTime),
        slotId: cell.slotId,
        slotSpan: 1,
      })
    }
  })

  return {
    facultyId: faculty.facultyId,
    slots,
    dayStartMinutes: DEFAULT_DAY_START_MINUTES,
    dayEndMinutes: DEFAULT_DAY_END_MINUTES,
    classBlocks,
    updatedAt: Date.now(),
  }
}

export function normalizeFacultyTimetableTemplate(
  template: FacultyTimetableTemplate | undefined,
  faculty: FacultyAccount,
  offerings: Offering[],
) {
  if (!template) return seedFacultyTimetableTemplate(faculty, offerings)
  const slotMap = getSlotMap(DEFAULT_TIMETABLE_SLOTS)
  const offeringIds = new Set(offerings.map(offering => offering.offId))
  const dayStartMinutes = typeof template.dayStartMinutes === 'number' ? template.dayStartMinutes : DEFAULT_DAY_START_MINUTES
  const dayEndMinutes = typeof template.dayEndMinutes === 'number' ? template.dayEndMinutes : DEFAULT_DAY_END_MINUTES

  const mappedClassBlocks = template.classBlocks
    .filter(block => offeringIds.has(block.offeringId))
    .map(block => {
      const legacyRange = resolveLegacySlotRange(block.slotId, block.slotSpan, DEFAULT_TIMETABLE_SLOTS)
      const rawStart = typeof block.startMinutes === 'number'
        ? block.startMinutes
        : (legacyRange?.startMinutes ?? DEFAULT_DAY_START_MINUTES)
      const rawEnd = typeof block.endMinutes === 'number'
        ? block.endMinutes
        : (legacyRange?.endMinutes ?? (rawStart + DEFAULT_TASK_DURATION_MINUTES))
      const normalizedRange = normalizeTimedRange(rawStart, rawEnd, dayStartMinutes, dayEndMinutes)
      const normalizedKind: FacultyTimetableClassBlock['kind'] = block.kind === 'extra' ? 'extra' : 'regular'
      return {
        ...block,
        facultyId: faculty.facultyId,
        kind: normalizedKind,
        dateISO: block.dateISO ? (normalizeDateISO(block.dateISO) ?? undefined) : undefined,
        day: WEEKDAY_ORDER.includes(block.day) ? block.day : 'Mon',
        startMinutes: normalizedRange.startMinutes,
        endMinutes: normalizedRange.endMinutes,
        slotId: block.slotId && slotMap[block.slotId] ? block.slotId : undefined,
        slotSpan: typeof block.slotSpan === 'number' ? Math.max(1, Math.round(block.slotSpan)) : undefined,
      }
    })
  const orderedClassBlocks = mappedClassBlocks
    .slice()
    .sort((left, right) => (
      (left.dateISO ?? '').localeCompare(right.dateISO ?? '')
      || left.day.localeCompare(right.day)
      || left.startMinutes - right.startMinutes
      || left.endMinutes - right.endMinutes
      || left.offeringId.localeCompare(right.offeringId)
    ))
  const classBlocks = orderedClassBlocks.reduce<FacultyTimetableClassBlock[]>((acc, block) => {
    const existingIndex = acc.findIndex(existing => {
      if (existing.offeringId !== block.offeringId) return false
      if ((existing.kind ?? 'regular') !== (block.kind ?? 'regular')) return false
      if ((existing.dateISO ?? '') !== (block.dateISO ?? '')) return false
      if (existing.day !== block.day) return false
      const overlapMinutes = Math.min(existing.endMinutes, block.endMinutes) - Math.max(existing.startMinutes, block.startMinutes)
      const minDuration = Math.min(existing.endMinutes - existing.startMinutes, block.endMinutes - block.startMinutes)
      const nearlySameWindow = Math.abs(existing.startMinutes - block.startMinutes) <= 10 && Math.abs(existing.endMinutes - block.endMinutes) <= 10
      const heavilyOverlapping = overlapMinutes > 0 && overlapMinutes >= Math.max(20, Math.floor(minDuration * 0.7))
      return nearlySameWindow || heavilyOverlapping
    })
    if (existingIndex < 0) {
      acc.push(block)
      return acc
    }
    const existing = acc[existingIndex]!
    const existingDuration = existing.endMinutes - existing.startMinutes
    const nextDuration = block.endMinutes - block.startMinutes
    const shouldReplace = (
      ((existing.kind ?? 'regular') === 'extra' && (block.kind ?? 'regular') === 'regular')
      || nextDuration > existingDuration
      || (!!block.slotId && !existing.slotId)
    )
    if (shouldReplace) acc[existingIndex] = block
    return acc
  }, [])

  return {
    facultyId: faculty.facultyId,
    slots: Array.isArray(template.slots) && template.slots.length > 0 ? template.slots : DEFAULT_TIMETABLE_SLOTS,
    dayStartMinutes,
    dayEndMinutes: Math.max(dayStartMinutes + MIN_EVENT_DURATION_MINUTES, dayEndMinutes),
    classBlocks: classBlocks.length > 0 ? classBlocks : seedFacultyTimetableTemplate(faculty, offerings).classBlocks,
    updatedAt: template.updatedAt ?? Date.now(),
  }
}
