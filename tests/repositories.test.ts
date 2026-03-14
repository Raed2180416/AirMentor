import { describe, expect, it } from 'vitest'
import { createLocalAirMentorRepositories } from '../src/repositories'
import type { SharedTask } from '../src/domain'

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
})
