import { describe, expect, it } from 'vitest'
import { FACULTY, OFFERINGS } from '../src/data'
import type { SharedTask } from '../src/domain'
import {
  assignAgendaLanes,
  DEFAULT_TIMETABLE_SLOTS,
  applyPlacementToTask,
  buildPlacementForRange,
  buildPlacementForSlot,
  buildUntimedPlacement,
  getSpannedSlotIds,
  getWeekDates,
  minutesToTimeString,
  seedFacultyTimetableTemplate,
  startOfWeekISO,
} from '../src/calendar-utils'

const faculty = FACULTY.find(item => item.facultyId === 't1') ?? FACULTY[0]
const offerings = OFFERINGS.filter(item => faculty.offeringIds.includes(item.offId))

describe('calendar utils', () => {
  it('seeds a deterministic Monday-Saturday timetable template without duplicate occupied cells', () => {
    const first = seedFacultyTimetableTemplate(faculty, offerings)
    const second = seedFacultyTimetableTemplate(faculty, offerings)

    expect(first.classBlocks.map(block => `${block.id}:${block.day}:${block.slotId}`)).toEqual(
      second.classBlocks.map(block => `${block.id}:${block.day}:${block.slotId}`),
    )

    const occupied = first.classBlocks.flatMap(block => getSpannedSlotIds(block.slotId, block.slotSpan, first.slots).map(slotId => `${block.day}:${slotId}`))
    expect(new Set(occupied).size).toBe(occupied.length)
    expect(first.classBlocks.every(block => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].includes(block.day))).toBe(true)
  })

  it('keeps one-time tasks one-time while updating recurring task metadata from placements', () => {
    const baseTask: SharedTask = {
      id: 'task-1',
      studentId: 'student-1',
      studentName: 'Aarav Sharma',
      studentUsn: '1MS23CS001',
      offeringId: offerings[0]?.offId ?? 'c3-A',
      courseCode: offerings[0]?.code ?? 'CS401',
      courseName: offerings[0]?.title ?? 'Algorithms',
      year: offerings[0]?.year ?? '2nd Year',
      riskProb: 0.8,
      riskBand: 'High',
      title: 'Academic follow-up',
      due: 'This week',
      status: 'New',
      actionHint: 'Follow-up needed',
      priority: 80,
      createdAt: 1,
      updatedAt: 2,
      assignedTo: 'Course Leader',
      taskType: 'Academic',
    }

    const timedPlacement = buildPlacementForSlot({
      taskId: baseTask.id,
      dateISO: '2026-03-18',
      slot: DEFAULT_TIMETABLE_SLOTS[1],
    })
    const oneTimeUpdated = applyPlacementToTask(baseTask, timedPlacement, DEFAULT_TIMETABLE_SLOTS[1])

    expect(oneTimeUpdated.dueDateISO).toBe('2026-03-18')
    expect(oneTimeUpdated.scheduleMeta).toBeUndefined()

    const recurringTask: SharedTask = {
      ...baseTask,
      id: 'task-2',
      scheduleMeta: {
        mode: 'scheduled',
        preset: 'weekly',
        status: 'active',
        nextDueDateISO: '2026-03-20',
      },
    }
    const untimedPlacement = buildUntimedPlacement({ taskId: recurringTask.id, dateISO: '2026-03-24' })
    const recurringUpdated = applyPlacementToTask(recurringTask, untimedPlacement)

    expect(recurringUpdated.dueDateISO).toBe('2026-03-24')
    expect(recurringUpdated.scheduleMeta?.nextDueDateISO).toBe('2026-03-24')
    expect(recurringUpdated.scheduleMeta?.time).toBeUndefined()
  })

  it('keeps week derivation Monday-based for the timetable workspace', () => {
    expect(startOfWeekISO('2026-03-19')).toBe('2026-03-16')
    expect(getWeekDates('2026-03-19')).toEqual([
      '2026-03-16',
      '2026-03-17',
      '2026-03-18',
      '2026-03-19',
      '2026-03-20',
      '2026-03-21',
    ])
  })

  it('builds exact-minute placements for freeform timed scheduling', () => {
    const placement = buildPlacementForRange({
      taskId: 'task-3',
      dateISO: '2026-03-19',
      startMinutes: 545,
      endMinutes: 615,
      dayStartMinutes: 480,
      dayEndMinutes: 1080,
    })

    expect(placement.startMinutes).toBe(545)
    expect(placement.endMinutes).toBe(615)
    expect(placement.startTime).toBe(minutesToTimeString(545))
    expect(placement.endTime).toBe(minutesToTimeString(615))
  })

  it('assigns stable side-by-side lanes for overlapping events', () => {
    const lanes = assignAgendaLanes([
      { id: 'class-a', startMinutes: 540, endMinutes: 600 },
      { id: 'task-a', startMinutes: 555, endMinutes: 620 },
      { id: 'task-b', startMinutes: 560, endMinutes: 610 },
      { id: 'task-c', startMinutes: 630, endMinutes: 680 },
    ])

    expect(lanes.map(item => `${item.id}:${item.lane}/${item.laneCount}`)).toEqual([
      'class-a:0/3',
      'task-a:1/3',
      'task-b:2/3',
      'task-c:0/1',
    ])
  })
})
