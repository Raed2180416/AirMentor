import {
  normalizeDateISO,
  toDueLabel,
  type SharedTask,
  type TaskCalendarPlacement,
  type TimetableSlotDefinition,
} from '@kernel/shared/domain'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_TIMETABLE_SLOTS,
} from './constants'
import { resolveLegacySlotRange } from './slot-helpers'
import { minutesToTimeString, normalizeTimedRange, timeStringToMinutes } from './time-scalars'

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

export function applyPlacementToTask(task: SharedTask, placement: TaskCalendarPlacement, anchorISO?: string) {
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
    due: normalizedDate ? toDueLabel(normalizedDate, 'This week', anchorISO) : task.due,
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
