// Coordinator/barrel for calendar utilities. Implementation lives in
// ./calendar-utils-parts/*. This module re-exports the identical public surface
// so existing '@web/shared/state/calendar-utils' importers keep working unchanged.

export type {
  MonthCell,
  ReflowedClassRange,
  TimedAgendaLayoutInput,
  TimedAgendaLayoutResult,
} from './calendar-utils-parts/types'

export {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_TASK_DURATION_MINUTES,
  DEFAULT_TIMETABLE_SLOTS,
  MIN_EVENT_DURATION_MINUTES,
  WEEKDAY_ORDER,
} from './calendar-utils-parts/constants'

export {
  clampMinuteValue,
  clampRangeToDayBounds,
  minutesToDisplayLabel,
  minutesToTimeString,
  normalizeTimedRange,
  rangeOverlaps,
  timeStringToMinutes,
} from './calendar-utils-parts/time-scalars'

export {
  assignAgendaLanes,
  buildTimeGuides,
  reflowClassDayRanges,
  resolveTimedHoverRange,
} from './calendar-utils-parts/agenda-layout'

export {
  addDaysISO,
  buildMonthGrid,
  classBlockOccursOnDate,
  formatMonthLabel,
  formatShortDate,
  formatWeekRange,
  getWeekDates,
  getWeekdayForDateISO,
  startOfWeekISO,
} from './calendar-utils-parts/date-helpers'

export {
  clampSlotSpan,
  getSlotMap,
  getSpannedSlotIds,
} from './calendar-utils-parts/slot-helpers'

export {
  normalizeFacultyTimetableTemplate,
  seedFacultyTimetableTemplate,
} from './calendar-utils-parts/timetable-template'

export {
  applyPlacementToTask,
  buildPlacementForRange,
  buildPlacementForSlot,
  buildUntimedPlacement,
  normalizeTaskCalendarPlacement,
} from './calendar-utils-parts/placement'
