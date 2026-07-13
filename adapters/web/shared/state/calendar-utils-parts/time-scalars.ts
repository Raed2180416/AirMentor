import { DEFAULT_DAY_START_MINUTES, MIN_EVENT_DURATION_MINUTES } from './constants'

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
