import { describe, expect, it } from 'vitest'
import { canDismissCurrentOccurrence, getNextScheduledDate, isTaskActiveForQueue, type SharedTask } from '../src/domain'

function buildTask(overrides: Partial<SharedTask> = {}): SharedTask {
  return {
    id: 'task-1',
    studentId: 's-1',
    studentName: 'Aarav Sharma',
    studentUsn: '1MS23CS001',
    offeringId: 'c3-A',
    courseCode: 'CS401',
    courseName: 'Design & Analysis of Algorithms',
    year: '2nd Year',
    riskProb: 0.82,
    riskBand: 'High',
    title: 'Academic follow-up',
    due: 'Today',
    dueDateISO: '2026-03-18',
    status: 'New',
    actionHint: 'Follow up on TT1 correction',
    priority: 92,
    createdAt: 1,
    updatedAt: 2,
    assignedTo: 'Course Leader',
    taskType: 'Academic',
    ...overrides,
  }
}

describe('domain task lifecycle helpers', () => {
  it('treats dismissed tasks as inactive for queue counts', () => {
    const active = buildTask()
    const dismissed = buildTask({
      id: 'task-2',
      dismissal: {
        kind: 'task',
        dismissedAt: 3,
        dismissedByFacultyId: 't1',
      },
    })

    expect(isTaskActiveForQueue(active, {}, '2026-03-18')).toBe(true)
    expect(isTaskActiveForQueue(dismissed, {}, '2026-03-18')).toBe(false)
  })

  it('allows dismiss-current only for live recurring occurrences with a next date', () => {
    const recurring = buildTask({
      scheduleMeta: {
        mode: 'scheduled',
        preset: 'weekly',
        status: 'active',
        nextDueDateISO: '2026-03-18',
      },
    })
    const paused = buildTask({
      id: 'task-3',
      scheduleMeta: {
        mode: 'scheduled',
        preset: 'weekly',
        status: 'paused',
        nextDueDateISO: '2026-03-18',
      },
    })
    const exhaustedCustom = buildTask({
      id: 'task-4',
      dueDateISO: '2026-03-24',
      scheduleMeta: {
        mode: 'scheduled',
        preset: 'custom dates',
        status: 'active',
        nextDueDateISO: '2026-03-24',
        skippedDatesISO: ['2026-03-28'],
        customDates: [
          { dateISO: '2026-03-24' },
          { dateISO: '2026-03-28' },
        ],
      },
    })

    expect(getNextScheduledDate(recurring.scheduleMeta, recurring.dueDateISO)).toBe('2026-03-25')
    expect(canDismissCurrentOccurrence(recurring)).toBe(true)
    expect(canDismissCurrentOccurrence(paused)).toBe(false)
    expect(canDismissCurrentOccurrence(exhaustedCustom)).toBe(false)
  })
})
