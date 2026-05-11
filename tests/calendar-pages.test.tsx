import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Offering } from '../src/data'
import type {
  AcademicMeeting,
  FacultyAccount,
  FacultyTimetableTemplate,
  SharedTask,
  TaskCalendarPlacement,
} from '../src/domain'
import { formatMonthLabel, formatShortDate } from '../src/calendar-utils'
import { CalendarTimetablePage } from '../src/pages/calendar-pages'

afterEach(() => {
  vi.useRealTimers()
})

const faculty: FacultyAccount = {
  facultyId: 'mnc_t1',
  name: 'Dr. Asha Rao',
  initials: 'AR',
  allowedRoles: ['Course Leader', 'Mentor', 'HoD'],
  dept: 'Mathematics and Computing',
  roleTitle: 'Professor',
  email: 'asha.rao@example.edu',
  courseCodes: ['MC601'],
  offeringIds: ['off_mc601_a'],
  menteeIds: [],
}

const offering: Offering = {
  offId: 'off_mc601_a',
  id: 'off_mc601_a',
  code: 'MC601',
  title: 'Graph Theory',
  year: 'III Year',
  dept: 'MNC',
  sem: 6,
  section: 'A',
  count: 60,
  attendance: 84,
  stage: 2,
  stageInfo: { stage: 2, label: 'In Progress', desc: 'Checkpoint active', color: '#3b82f6' },
  tt1Done: true,
  tt2Done: false,
  pendingAction: null,
  sections: ['A'],
  enrolled: [60],
  att: [84],
}

const task: SharedTask = {
  id: 'proof-workflow-task::queue_case_001',
  studentId: 'student_001',
  studentName: 'Aarav Sharma',
  studentUsn: '1MS23MC001',
  offeringId: offering.offId,
  courseCode: offering.code,
  courseName: offering.title,
  year: offering.year,
  riskProb: 0.82,
  riskBand: 'High',
  title: 'Follow-up: targeted tutoring',
  due: 'Today',
  dueDateISO: '2026-03-20',
  status: 'New',
  actionHint: 'Review the proof workflow task and confirm the next intervention.',
  priority: 82,
  createdAt: Date.parse('2026-03-16T09:00:00.000Z'),
  updatedAt: Date.parse('2026-03-16T09:10:00.000Z'),
  assignedTo: 'Course Leader',
  taskType: 'Follow-up',
  sourceRole: 'System',
}

const placement: TaskCalendarPlacement = {
  taskId: task.id,
  dateISO: '2026-03-20',
  placementMode: 'timed',
  startMinutes: 570,
  endMinutes: 600,
  startTime: '09:30',
  endTime: '10:00',
  updatedAt: Date.parse('2026-03-16T09:10:00.000Z'),
}

const timetable: FacultyTimetableTemplate = {
  facultyId: faculty.facultyId,
  slots: [],
  dayStartMinutes: 480,
  dayEndMinutes: 1080,
  classBlocks: [],
  updatedAt: Date.parse('2026-03-16T09:00:00.000Z'),
}

describe('CalendarTimetablePage', () => {
  it('anchors the initial calendar selection to the supplied proof date instead of the browser date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23T12:00:00.000Z'))

    const markup = renderToStaticMarkup(createElement(CalendarTimetablePage, {
      onBack: () => {},
      currentTeacher: faculty,
      activeRole: 'Course Leader',
      allowedRoles: faculty.allowedRoles,
      facultyOfferings: [offering],
      mergedTasks: [task],
      meetings: [] as AcademicMeeting[],
      resolvedTaskIds: {},
      timetable,
      adminMarkers: [],
      taskPlacements: { [task.id]: placement },
      currentDateISO: '2026-03-20',
      onScheduleTask: () => {},
      onUpdateMeeting: () => {},
      onMoveClassBlock: () => {},
      onResizeClassBlock: () => {},
      onEditClassTiming: () => {},
      onCreateExtraClass: () => {},
      onOpenTaskComposer: () => {},
      onOpenCourse: () => {},
      onOpenActionQueue: () => {},
      onUpdateTimetableBounds: () => {},
      onDismissTask: () => {},
      onDismissSeries: () => {},
    }))

    expect(markup).toContain(formatShortDate('2026-03-20'))
    expect(markup).toContain(formatMonthLabel('2026-03-01'))
    expect(markup).not.toContain(formatShortDate('2026-04-23'))
    expect(markup).not.toContain(formatMonthLabel('2026-04-01'))
  })
})
