import {
  normalizeDateISO,
  toDueLabel,
  type FacultyAccount,
  type FacultyTimetableClassBlock,
  type FacultyTimetableTemplate,
  type SharedTask,
  type TaskCalendarPlacement,
  type TimetableSlotDefinition,
  type Weekday,
} from './domain'
import type { Offering } from './data'

export const WEEKDAY_ORDER: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const DEFAULT_TIMETABLE_SLOTS: TimetableSlotDefinition[] = [
  { id: 'p1', label: 'P1', startTime: '08:30', endTime: '09:20' },
  { id: 'p2', label: 'P2', startTime: '09:20', endTime: '10:10' },
  { id: 'p3', label: 'P3', startTime: '10:25', endTime: '11:15' },
  { id: 'p4', label: 'P4', startTime: '11:15', endTime: '12:05' },
  { id: 'p5', label: 'P5', startTime: '13:00', endTime: '13:50' },
  { id: 'p6', label: 'P6', startTime: '13:50', endTime: '14:40' },
  { id: 'p7', label: 'P7', startTime: '14:50', endTime: '15:40' },
  { id: 'p8', label: 'P8', startTime: '15:40', endTime: '16:30' },
]

export const MIN_EVENT_DURATION_MINUTES = 20
export const DEFAULT_TASK_DURATION_MINUTES = 50
export const DEFAULT_DAY_START_MINUTES: number = timeStringToMinutes(DEFAULT_TIMETABLE_SLOTS[0].startTime)
export const DEFAULT_DAY_END_MINUTES: number = timeStringToMinutes(DEFAULT_TIMETABLE_SLOTS[DEFAULT_TIMETABLE_SLOTS.length - 1].endTime)

export type MonthCell = {
  dateISO: string
  inCurrentMonth: boolean
}

export type TimedAgendaLayoutInput = {
  id: string
  startMinutes: number
  endMinutes: number
}

export type TimedAgendaLayoutResult<T extends TimedAgendaLayoutInput> = T & {
  lane: number
  laneCount: number
}

export type ReflowedClassRange = {
  startMinutes: number
  endMinutes: number
}

function parseLocalDate(dateISO: string) {
  const normalized = normalizeDateISO(dateISO)
  if (!normalized) return null
  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toLocalISO(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

function resolveLegacySlotRange(slotId: string | undefined, slotSpan: number | undefined, slots: TimetableSlotDefinition[]) {
  if (!slotId) return null
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return null
  const span = clampSlotSpan(slotId, Math.max(1, Math.round(slotSpan ?? 1)), slots)
  const startSlot = slots[startIndex]
  const endSlot = slots[Math.min(slots.length - 1, startIndex + span - 1)]
  return {
    startMinutes: timeStringToMinutes(startSlot.startTime),
    endMinutes: timeStringToMinutes(endSlot.endTime),
  }
}

function resolvePlacementMinutes(placement: TaskCalendarPlacement) {
  if (placement.placementMode !== 'timed') return { startMinutes: undefined, endMinutes: undefined }
  const parsedStart = typeof placement.startMinutes === 'number'
    ? placement.startMinutes
    : (placement.startTime ? timeStringToMinutes(placement.startTime) : undefined)
  const parsedEnd = typeof placement.endMinutes === 'number'
    ? placement.endMinutes
    : (placement.endTime ? timeStringToMinutes(placement.endTime) : undefined)
  if (typeof parsedStart === 'number' && typeof parsedEnd === 'number') {
    return normalizeTimedRange(parsedStart, parsedEnd, DEFAULT_DAY_START_MINUTES, DEFAULT_DAY_END_MINUTES)
  }
  const legacyRange = resolveLegacySlotRange(placement.slotId, 1, DEFAULT_TIMETABLE_SLOTS)
  if (!legacyRange) return { startMinutes: undefined, endMinutes: undefined }
  return normalizeTimedRange(legacyRange.startMinutes, legacyRange.endMinutes, DEFAULT_DAY_START_MINUTES, DEFAULT_DAY_END_MINUTES)
}

export function timeStringToMinutes(value?: string): number {
  if (!value) return DEFAULT_DAY_START_MINUTES
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return DEFAULT_DAY_START_MINUTES
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return DEFAULT_DAY_START_MINUTES
  return (hours * 60) + minutes
}

export function minutesToTimeString(minutes: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  const hours = `${Math.floor(safe / 60)}`.padStart(2, '0')
  const mins = `${safe % 60}`.padStart(2, '0')
  return `${hours}:${mins}`
}

export function minutesToDisplayLabel(minutes: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  const hours24 = Math.floor(safe / 60)
  const mins = `${safe % 60}`.padStart(2, '0')
  const suffix = hours24 >= 12 ? 'pm' : 'am'
  const hours12 = ((hours24 + 11) % 12) + 1
  return `${hours12}:${mins} ${suffix}`
}

export function clampMinuteValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function normalizeTimedRange(startMinutes: number, endMinutes: number, dayStartMinutes: number, dayEndMinutes: number, minimumDuration = MIN_EVENT_DURATION_MINUTES) {
  const boundedStart = clampMinuteValue(startMinutes, dayStartMinutes, dayEndMinutes - minimumDuration)
  const boundedEnd = clampMinuteValue(endMinutes, boundedStart + minimumDuration, dayEndMinutes)
  if ((boundedEnd - boundedStart) < minimumDuration) {
    return {
      startMinutes: boundedStart,
      endMinutes: Math.min(dayEndMinutes, boundedStart + minimumDuration),
    }
  }
  return {
    startMinutes: boundedStart,
    endMinutes: boundedEnd,
  }
}

export function clampRangeToDayBounds(startMinutes: number, endMinutes: number, dayStartMinutes: number, dayEndMinutes: number, minimumDuration = MIN_EVENT_DURATION_MINUTES) {
  const duration = Math.max(minimumDuration, Math.round(endMinutes - startMinutes))
  const clampedStart = clampMinuteValue(startMinutes, dayStartMinutes, dayEndMinutes - duration)
  return {
    startMinutes: clampedStart,
    endMinutes: clampMinuteValue(clampedStart + duration, clampedStart + minimumDuration, dayEndMinutes),
  }
}

export function rangeOverlaps(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return leftStart < rightEnd && rightStart < leftEnd
}

export function resolveTimedHoverRange(
  minute: number,
  items: Array<{ startMinutes: number; endMinutes: number }>,
  dayStartMinutes: number,
  dayEndMinutes: number,
  preferredDuration = DEFAULT_TASK_DURATION_MINUTES,
  minimumDuration = MIN_EVENT_DURATION_MINUTES,
) {
  const merged = [...items]
    .sort((left, right) => {
      if (left.startMinutes !== right.startMinutes) return left.startMinutes - right.startMinutes
      return left.endMinutes - right.endMinutes
    })
    .reduce<Array<{ startMinutes: number; endMinutes: number }>>((acc, item) => {
      if (acc.length === 0) return [{ startMinutes: item.startMinutes, endMinutes: item.endMinutes }]
      const previous = acc[acc.length - 1]
      if (item.startMinutes <= previous.endMinutes) {
        previous.endMinutes = Math.max(previous.endMinutes, item.endMinutes)
        return acc
      }
      acc.push({ startMinutes: item.startMinutes, endMinutes: item.endMinutes })
      return acc
    }, [])

  const occupied = merged.find(item => item.startMinutes <= minute && minute < item.endMinutes)
  if (occupied) return null

  let gapStartMinutes = dayStartMinutes
  let gapEndMinutes = dayEndMinutes

  for (const item of merged) {
    if (item.endMinutes <= minute) gapStartMinutes = Math.max(gapStartMinutes, item.endMinutes)
    if (item.startMinutes > minute) {
      gapEndMinutes = Math.min(gapEndMinutes, item.startMinutes)
      break
    }
  }

  const gapDuration = gapEndMinutes - gapStartMinutes
  if (gapDuration < minimumDuration) return null

  const duration = Math.max(minimumDuration, Math.min(preferredDuration, gapDuration))
  const startMinutes = clampMinuteValue(minute, gapStartMinutes, gapEndMinutes - duration)
  return {
    gapStartMinutes,
    gapEndMinutes,
    startMinutes,
    endMinutes: startMinutes + duration,
  }
}

export function classBlockOccursOnDate(block: Pick<FacultyTimetableClassBlock, 'day' | 'dateISO'>, dateISO: string, day: Weekday) {
  const normalizedDateISO = normalizeDateISO(dateISO)
  if (block.dateISO) return normalizeDateISO(block.dateISO) === normalizedDateISO
  return block.day === day
}

export function buildTimeGuides(dayStartMinutes: number, dayEndMinutes: number, intervalMinutes = 60) {
  const start = Math.floor(dayStartMinutes / intervalMinutes) * intervalMinutes
  const guides: number[] = []
  for (let minute = start; minute <= dayEndMinutes; minute += intervalMinutes) {
    if (minute >= dayStartMinutes && minute <= dayEndMinutes) guides.push(minute)
  }
  if (!guides.includes(dayEndMinutes)) guides.push(dayEndMinutes)
  return guides
}

export function assignAgendaLanes<T extends TimedAgendaLayoutInput>(items: T[]): Array<TimedAgendaLayoutResult<T>> {
  const sorted = [...items].sort((left, right) => {
    if (left.startMinutes !== right.startMinutes) return left.startMinutes - right.startMinutes
    if (left.endMinutes !== right.endMinutes) return left.endMinutes - right.endMinutes
    return left.id.localeCompare(right.id)
  })

  const output: Array<TimedAgendaLayoutResult<T>> = []
  let cluster: Array<T & { lane: number }> = []
  let active: Array<{ lane: number; endMinutes: number }> = []

  const flushCluster = () => {
    if (cluster.length === 0) return
    const laneCount = cluster.reduce((max, item) => Math.max(max, item.lane + 1), 1)
    cluster.forEach(item => output.push({ ...item, laneCount }))
    cluster = []
    active = []
  }

  sorted.forEach(item => {
    active = active.filter(entry => entry.endMinutes > item.startMinutes)
    if (cluster.length > 0 && active.length === 0) flushCluster()

    const occupiedLanes = new Set(active.map(entry => entry.lane))
    let lane = 0
    while (occupiedLanes.has(lane)) lane += 1

    cluster.push({ ...item, lane })
    active.push({ lane, endMinutes: item.endMinutes })
  })

  flushCluster()
  return output
}

export function reflowClassDayRanges<T extends { id: string; startMinutes: number; endMinutes: number }>(input: {
  blocks: T[]
  targetId: string
  desiredStartMinutes: number
  desiredEndMinutes: number
  dayStartMinutes: number
  dayEndMinutes: number
  snapThresholdMinutes?: number
}) {
  const target = input.blocks.find(block => block.id === input.targetId)
  if (!target) return null

  const minimumDuration = MIN_EVENT_DURATION_MINUTES
  const snapThresholdMinutes = input.snapThresholdMinutes ?? 14
  const durationById = Object.fromEntries(
    input.blocks.map(block => [block.id, Math.max(minimumDuration, block.endMinutes - block.startMinutes)]),
  ) as Record<string, number>

  const others = input.blocks
    .filter(block => block.id !== input.targetId)
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes || left.id.localeCompare(right.id))

  const desiredRange = normalizeTimedRange(
    input.desiredStartMinutes,
    input.desiredEndMinutes,
    input.dayStartMinutes,
    input.dayEndMinutes,
    minimumDuration,
  )
  const desiredTargetDuration = Math.max(minimumDuration, desiredRange.endMinutes - desiredRange.startMinutes)
  const totalOtherDuration = others.reduce((sum, block) => sum + durationById[block.id], 0)
  const maximumTargetDuration = Math.max(minimumDuration, input.dayEndMinutes - input.dayStartMinutes - totalOtherDuration)
  const targetDuration = Math.min(desiredTargetDuration, maximumTargetDuration)

  let snappedStartMinutes = desiredRange.startMinutes
  let snappedEndMinutes = desiredRange.startMinutes + targetDuration
  const desiredOverlaps = others.some(block => rangeOverlaps(desiredRange.startMinutes, desiredRange.startMinutes + targetDuration, block.startMinutes, block.endMinutes))
  if (!desiredOverlaps) {
    const snapCandidates = others.flatMap(block => [block.startMinutes, block.endMinutes])
    let bestSnapDistance = snapThresholdMinutes + 1
    snapCandidates.forEach(edge => {
      const startDistance = Math.abs(desiredRange.startMinutes - edge)
      if (startDistance < bestSnapDistance) {
        bestSnapDistance = startDistance
        snappedStartMinutes = edge
        snappedEndMinutes = edge + targetDuration
      }
      const endDistance = Math.abs((desiredRange.startMinutes + targetDuration) - edge)
      if (endDistance < bestSnapDistance) {
        bestSnapDistance = endDistance
        snappedStartMinutes = edge - targetDuration
        snappedEndMinutes = edge
      }
    })
  }

  const buildRanges = (candidateStartMinutes: number, candidateEndMinutes: number) => {
    const ordered = [...others, { id: input.targetId, startMinutes: candidateStartMinutes, endMinutes: candidateEndMinutes }]
      .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes || left.id.localeCompare(right.id))
    const targetIndex = ordered.findIndex(block => block.id === input.targetId)
    const previousBlocks = ordered.slice(0, targetIndex)
    const nextBlocks = ordered.slice(targetIndex + 1)

    const rangesById: Record<string, ReflowedClassRange> = {
      [input.targetId]: {
        startMinutes: candidateStartMinutes,
        endMinutes: candidateEndMinutes,
      },
    }

    let previousCursor = candidateStartMinutes
    for (let index = previousBlocks.length - 1; index >= 0; index -= 1) {
      const block = previousBlocks[index]
      const duration = durationById[block.id]
      const overlapsTarget = block.endMinutes > previousCursor
      const endMinutes = overlapsTarget ? previousCursor : block.endMinutes
      const startMinutes = endMinutes - duration
      rangesById[block.id] = { startMinutes, endMinutes }
      previousCursor = startMinutes
    }

    let nextCursor = candidateEndMinutes
    nextBlocks.forEach(block => {
      const duration = durationById[block.id]
      const overlapsTarget = block.startMinutes < nextCursor
      const startMinutes = overlapsTarget ? nextCursor : block.startMinutes
      const endMinutes = startMinutes + duration
      rangesById[block.id] = { startMinutes, endMinutes }
      nextCursor = endMinutes
    })

    const earliestStartMinutes = Math.min(...Object.values(rangesById).map(range => range.startMinutes))
    const latestEndMinutes = Math.max(...Object.values(rangesById).map(range => range.endMinutes))

    return {
      rangesById,
      earliestStartMinutes,
      latestEndMinutes,
    }
  }

  const snappedRange = clampRangeToDayBounds(
    snappedStartMinutes,
    snappedEndMinutes,
    input.dayStartMinutes,
    input.dayEndMinutes,
    targetDuration,
  )

  let candidateStartMinutes = snappedRange.startMinutes
  let candidateEndMinutes = snappedRange.endMinutes
  let resolved = buildRanges(candidateStartMinutes, candidateEndMinutes)

  for (let iteration = 0; iteration < input.blocks.length + 2; iteration += 1) {
    if (resolved.earliestStartMinutes >= input.dayStartMinutes && resolved.latestEndMinutes <= input.dayEndMinutes) break
    const shiftMinutes = resolved.earliestStartMinutes < input.dayStartMinutes
      ? input.dayStartMinutes - resolved.earliestStartMinutes
      : input.dayEndMinutes - resolved.latestEndMinutes
    const shifted = clampRangeToDayBounds(
      candidateStartMinutes + shiftMinutes,
      candidateEndMinutes + shiftMinutes,
      input.dayStartMinutes,
      input.dayEndMinutes,
      targetDuration,
    )
    candidateStartMinutes = shifted.startMinutes
    candidateEndMinutes = shifted.endMinutes
    resolved = buildRanges(candidateStartMinutes, candidateEndMinutes)
  }

  if (resolved.earliestStartMinutes < input.dayStartMinutes || resolved.latestEndMinutes > input.dayEndMinutes) return null

  const changedBlockIds = input.blocks
    .filter(block => {
      const nextRange = resolved.rangesById[block.id]
      return nextRange.startMinutes !== block.startMinutes || nextRange.endMinutes !== block.endMinutes
    })
    .map(block => block.id)

  return {
    rangesById: resolved.rangesById,
    changedBlockIds,
    targetRange: resolved.rangesById[input.targetId],
  }
}

export function addDaysISO(dateISO: string, delta: number) {
  const base = parseLocalDate(dateISO)
  if (!base) return dateISO
  const next = new Date(base)
  next.setDate(base.getDate() + delta)
  return toLocalISO(next)
}

export function startOfWeekISO(dateISO: string) {
  const base = parseLocalDate(dateISO)
  if (!base) return dateISO
  const day = base.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDaysISO(dateISO, mondayOffset)
}

export function getWeekDates(dateISO: string) {
  const weekStart = startOfWeekISO(dateISO)
  return WEEKDAY_ORDER.map((_day, index) => addDaysISO(weekStart, index))
}

export function getWeekdayForDateISO(dateISO: string): Weekday | null {
  const base = parseLocalDate(dateISO)
  if (!base) return null
  const day = base.getDay()
  if (day === 0) return null
  return WEEKDAY_ORDER[day - 1] ?? null
}

export function buildMonthGrid(dateISO: string): MonthCell[] {
  const base = parseLocalDate(dateISO)
  if (!base) return []
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1)
  const startOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
  monthStart.setDate(monthStart.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(monthStart)
    date.setDate(monthStart.getDate() + index)
    return {
      dateISO: toLocalISO(date),
      inCurrentMonth: date.getMonth() === base.getMonth(),
    }
  })
}

export function formatMonthLabel(dateISO: string) {
  const base = parseLocalDate(dateISO)
  if (!base) return dateISO
  return base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function formatShortDate(dateISO: string) {
  const base = parseLocalDate(dateISO)
  if (!base) return dateISO
  return base.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
}

export function formatWeekRange(dateISO: string) {
  const weekDates = getWeekDates(dateISO)
  const start = parseLocalDate(weekDates[0])
  const end = parseLocalDate(weekDates[weekDates.length - 1])
  if (!start || !end) return dateISO
  const startLabel = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const endLabel = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} - ${endLabel}`
}

export function getSlotMap(slots: TimetableSlotDefinition[]) {
  return Object.fromEntries(slots.map(slot => [slot.id, slot])) as Record<string, TimetableSlotDefinition>
}

export function clampSlotSpan(slotId: string, slotSpan: number, slots: TimetableSlotDefinition[]) {
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return 1
  return Math.max(1, Math.min(Math.max(1, Math.round(slotSpan)), slots.length - startIndex))
}

export function getSpannedSlotIds(slotId: string, slotSpan: number, slots: TimetableSlotDefinition[]) {
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return [slotId]
  return slots.slice(startIndex, startIndex + clampSlotSpan(slotId, slotSpan, slots)).map(slot => slot.id)
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

export function normalizeTaskCalendarPlacement(placement: TaskCalendarPlacement) {
  const normalizedDate = normalizeDateISO(placement.dateISO) ?? placement.dateISO
  if (placement.placementMode !== 'timed') {
    return {
      ...placement,
      dateISO: normalizedDate,
      updatedAt: placement.updatedAt ?? Date.now(),
    }
  }
  const resolvedRange = resolvePlacementMinutes(placement)
  return {
    ...placement,
    dateISO: normalizedDate,
    startMinutes: resolvedRange.startMinutes,
    endMinutes: resolvedRange.endMinutes,
    startTime: typeof resolvedRange.startMinutes === 'number' ? minutesToTimeString(resolvedRange.startMinutes) : placement.startTime,
    endTime: typeof resolvedRange.endMinutes === 'number' ? minutesToTimeString(resolvedRange.endMinutes) : placement.endTime,
    updatedAt: placement.updatedAt ?? Date.now(),
  }
}

export function applyPlacementToTask(task: SharedTask, placement: TaskCalendarPlacement) {
  const normalizedDate = normalizeDateISO(placement.dateISO) ?? task.dueDateISO
  const nextScheduleMeta = task.scheduleMeta?.mode === 'scheduled'
    ? {
        ...task.scheduleMeta,
        nextDueDateISO: normalizedDate,
        time: placement.placementMode === 'timed' && typeof placement.startMinutes === 'number'
          ? minutesToTimeString(placement.startMinutes)
          : undefined,
      }
    : task.scheduleMeta
  return {
    ...task,
    dueDateISO: normalizedDate,
    due: normalizedDate ? toDueLabel(normalizedDate) : task.due,
    updatedAt: Date.now(),
    scheduleMeta: nextScheduleMeta,
  }
}

export function buildPlacementForRange(input: {
  taskId: string
  dateISO: string
  startMinutes: number
  endMinutes: number
  dayStartMinutes?: number
  dayEndMinutes?: number
}): TaskCalendarPlacement {
  const normalizedRange = normalizeTimedRange(
    input.startMinutes,
    input.endMinutes,
    input.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES,
    input.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES,
  )
  return {
    taskId: input.taskId,
    dateISO: input.dateISO,
    placementMode: 'timed',
    startMinutes: normalizedRange.startMinutes,
    endMinutes: normalizedRange.endMinutes,
    startTime: minutesToTimeString(normalizedRange.startMinutes),
    endTime: minutesToTimeString(normalizedRange.endMinutes),
    updatedAt: Date.now(),
  }
}

export function buildPlacementForSlot(input: {
  taskId: string
  dateISO: string
  slot: TimetableSlotDefinition
}): TaskCalendarPlacement {
  return buildPlacementForRange({
    taskId: input.taskId,
    dateISO: input.dateISO,
    startMinutes: timeStringToMinutes(input.slot.startTime),
    endMinutes: timeStringToMinutes(input.slot.endTime),
  })
}

export function buildUntimedPlacement(input: { taskId: string; dateISO: string }): TaskCalendarPlacement {
  return {
    taskId: input.taskId,
    dateISO: input.dateISO,
    placementMode: 'untimed',
    updatedAt: Date.now(),
  }
}
