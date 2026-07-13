import { normalizeDateISO, type FacultyTimetableClassBlock, type Weekday } from '@kernel/shared/domain'
import { WEEKDAY_ORDER } from './constants'
import type { MonthCell } from './types'

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

export function classBlockOccursOnDate(block: Pick<FacultyTimetableClassBlock, 'day' | 'dateISO'>, dateISO: string, day: Weekday) {
  const normalizedDateISO = normalizeDateISO(dateISO)
  if (block.dateISO) return normalizeDateISO(block.dateISO) === normalizedDateISO
  return block.day === day
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
