import { normalizeDateISO, toDueLabel, type FacultyAccount, type FacultyTimetableClassBlock, type FacultyTimetableTemplate, type SharedTask, type TaskCalendarPlacement, type TimetableSlotDefinition, type Weekday } from './domain'
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

type MonthCell = {
  dateISO: string
  inCurrentMonth: boolean
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

export function getSpannedSlotIds(slotId: string, slotSpan: number, slots: TimetableSlotDefinition[]) {
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return [slotId]
  return slots.slice(startIndex, startIndex + clampSlotSpan(slotId, slotSpan, slots)).map(slot => slot.id)
}

export function clampSlotSpan(slotId: string, slotSpan: number, slots: TimetableSlotDefinition[]) {
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return 1
  return Math.max(1, Math.min(Math.max(1, Math.round(slotSpan)), slots.length - startIndex))
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
        slotId: cell.slotId,
        slotSpan: 1,
      })
    }
  })

  return {
    facultyId: faculty.facultyId,
    slots,
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
  const classBlocks = template.classBlocks
    .filter(block => offeringIds.has(block.offeringId))
    .map(block => ({
      ...block,
      facultyId: faculty.facultyId,
      slotId: slotMap[block.slotId] ? block.slotId : DEFAULT_TIMETABLE_SLOTS[0].id,
      day: WEEKDAY_ORDER.includes(block.day) ? block.day : 'Mon',
      slotSpan: clampSlotSpan(block.slotId, Math.max(1, Math.min(3, Math.round(block.slotSpan || 1))), DEFAULT_TIMETABLE_SLOTS),
    }))
  return {
    facultyId: faculty.facultyId,
    slots: Array.isArray(template.slots) && template.slots.length > 0 ? template.slots : DEFAULT_TIMETABLE_SLOTS,
    classBlocks: classBlocks.length > 0 ? classBlocks : seedFacultyTimetableTemplate(faculty, offerings).classBlocks,
    updatedAt: template.updatedAt ?? Date.now(),
  }
}

export function applyPlacementToTask(
  task: SharedTask,
  placement: TaskCalendarPlacement,
  slot?: TimetableSlotDefinition,
) {
  const normalizedDate = normalizeDateISO(placement.dateISO) ?? task.dueDateISO
  const nextScheduleMeta = task.scheduleMeta?.mode === 'scheduled'
    ? {
        ...task.scheduleMeta,
        nextDueDateISO: normalizedDate,
        time: placement.placementMode === 'timed' ? (slot?.startTime ?? placement.startTime ?? task.scheduleMeta.time) : undefined,
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

export function buildPlacementForSlot(input: {
  taskId: string
  dateISO: string
  slot: TimetableSlotDefinition
}): TaskCalendarPlacement {
  return {
    taskId: input.taskId,
    dateISO: input.dateISO,
    placementMode: 'timed',
    slotId: input.slot.id,
    startTime: input.slot.startTime,
    endTime: input.slot.endTime,
    updatedAt: Date.now(),
  }
}

export function buildUntimedPlacement(input: { taskId: string; dateISO: string }): TaskCalendarPlacement {
  return {
    taskId: input.taskId,
    dateISO: input.dateISO,
    placementMode: 'untimed',
    updatedAt: Date.now(),
  }
}
