import { DEFAULT_TASK_DURATION_MINUTES, normalizeTimedRange } from '@web/shared/state/calendar-utils'
import type { AddTargetState, InteractionState } from './types'

export function browserTodayISO() {
  const today = new Date()
  const year = today.getFullYear()
  const month = `${today.getMonth() + 1}`.padStart(2, '0')
  const day = `${today.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveCalendarAnchorDateISO(currentDateISO?: string) {
  return typeof currentDateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(currentDateISO)
    ? currentDateISO
    : browserTodayISO()
}

export function hoverUntimedBucket(interaction: InteractionState | null, dateISO: string) {
  return interaction?.mode === 'active' && interaction.preview?.placementMode === 'untimed' && interaction.preview.dateISO === dateISO
}

export function normalizeTimedAddTarget(target: AddTargetState, dayStartMinutes: number, dayEndMinutes: number): AddTargetState {
  if (target.placementMode !== 'timed') return target
  const normalized = normalizeTimedRange(
    target.startMinutes ?? dayStartMinutes,
    target.endMinutes ?? ((target.startMinutes ?? dayStartMinutes) + DEFAULT_TASK_DURATION_MINUTES),
    dayStartMinutes,
    dayEndMinutes,
  )
  return {
    ...target,
    placementMode: 'timed',
    startMinutes: normalized.startMinutes,
    endMinutes: normalized.endMinutes,
  }
}

export function normalizeTimeValue(value: string, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallback
  return (hours * 60) + minutes
}
