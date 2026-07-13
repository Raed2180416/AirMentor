import { useCalendarBaseState } from './use-calendar-base-state'
import { useCalendarColumns } from './use-calendar-columns'
import { useCalendarInteractions } from './use-calendar-interactions'
import type { CalendarTimetablePageProps } from './types'

export function useCalendarTimetablePage(props: CalendarTimetablePageProps) {
  const base = useCalendarBaseState(props)
  const columns = useCalendarColumns(props, base)
  const interactions = useCalendarInteractions(props, base, columns)
  return { ...base, ...columns, ...interactions }
}
