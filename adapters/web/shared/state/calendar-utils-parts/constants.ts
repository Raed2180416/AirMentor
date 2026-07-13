import type { TimetableSlotDefinition, Weekday } from '@kernel/shared/domain'
import { timeStringToMinutes } from './time-scalars'

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
