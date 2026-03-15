import { describe, expect, it } from 'vitest'
import { createLocalAirMentorRepositories } from '../src/repositories'
import { FACULTY, OFFERINGS } from '../src/data'
import type { CalendarAuditEvent, SharedTask, TaskCalendarPlacement } from '../src/domain'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly data = new Map<string, string>()

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }

  removeItem(key: string) {
    this.data.delete(key)
  }
}

describe('repositories', () => {
  it('migrates the legacy faculty session key and clears only AirMentor-owned persistence', async () => {
    const storage = new MemoryStorage()
    storage.setItem('airmentor-theme', 'frosted-focus-light')
    storage.setItem('airmentor-current-teacher-id', 't4')
    storage.setItem('airmentor-locks', JSON.stringify({}))
    storage.setItem('unrelated-cache-key', 'keep-me')

    const repositories = createLocalAirMentorRepositories(storage)

    expect(repositories.sessionPreferences.getCurrentFacultyIdSnapshot()).toBe('t4')

    await repositories.sessionPreferences.saveCurrentFacultyId('t1')
    expect(storage.getItem('airmentor-current-faculty-id')).toBe('t1')
    expect(storage.getItem('airmentor-current-teacher-id')).toBeNull()

    await repositories.clearPersistedState()

    expect(storage.getItem('airmentor-theme')).toBeNull()
    expect(storage.getItem('airmentor-current-faculty-id')).toBeNull()
    expect(storage.getItem('airmentor-locks')).toBeNull()
    expect(storage.getItem('unrelated-cache-key')).toBe('keep-me')
  })

  it('returns a backend-shaped payload for task upserts without mutating unrelated storage', async () => {
    const repositories = createLocalAirMentorRepositories(new MemoryStorage())
    const task: SharedTask = {
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
      status: 'New',
      actionHint: 'Follow up on TT1 correction',
      priority: 92,
      createdAt: 1,
      updatedAt: 2,
      assignedTo: 'Course Leader',
      taskType: 'Academic',
      escalated: false,
    }

    const payload = await repositories.tasks.upsertTask(task)

    expect(payload).toMatchObject({
      taskId: 'task-1',
      studentId: 's-1',
      offeringId: 'c3-A',
      assignedTo: 'Course Leader',
      taskType: 'Academic',
      status: 'New',
      note: 'Follow up on TT1 correction',
      dueLabel: 'Today',
      createdAt: 1,
      updatedAt: 2,
    })
  })

  it('persists and recovers calendar templates, task placements, and audit events', async () => {
    const storage = new MemoryStorage()
    const repositories = createLocalAirMentorRepositories(storage)
    const templates = repositories.calendar.getTimetableTemplatesSnapshot(FACULTY, OFFERINGS)
    const facultyId = FACULTY[0].facultyId

    expect(templates[facultyId]?.classBlocks.length).toBeGreaterThan(0)

    const placement: TaskCalendarPlacement = {
      taskId: 'task-1',
      dateISO: '2026-03-18',
      placementMode: 'timed',
      slotId: 'p2',
      startTime: '09:20',
      endTime: '10:10',
      updatedAt: 12,
    }
    const audit: CalendarAuditEvent = {
      id: 'audit-1',
      facultyId,
      actorRole: 'Course Leader',
      actorFacultyId: facultyId,
      timestamp: 44,
      actionKind: 'task-scheduled',
      targetType: 'task',
      targetId: 'task-1',
      note: 'Scheduled Academic follow-up',
      after: {
        dateISO: '2026-03-18',
        slotId: 'p2',
        placementMode: 'timed',
      },
    }

    await repositories.calendar.saveTaskPlacements({ 'task-1': placement })
    await repositories.calendar.saveCalendarAudit([audit])

    const recoveredPlacements = repositories.calendar.getTaskPlacementsSnapshot()
    const recoveredAudit = repositories.calendar.getCalendarAuditSnapshot()

    expect(recoveredPlacements['task-1']).toEqual({
      ...placement,
      startMinutes: 560,
      endMinutes: 610,
    })
    expect(recoveredAudit).toEqual([audit])
  })
})
