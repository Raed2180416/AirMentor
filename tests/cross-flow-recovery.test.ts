import { describe, it, expect, vi } from 'vitest'
import { createAirMentorRepositories } from '../src/repositories'
import type { AirMentorApiClientLike } from '../src/api/client'
import type { SharedTask } from '../src/domain'

describe('Cross-Flow Recovery Pass', () => {
  it('P11-C04: Partial failure recovery without phantom success UI (saveTasks)', async () => {
    // Mock API client that fails on saveAcademicTask
    const mockClient = {
      saveAcademicTask: vi.fn().mockRejectedValue(new Error('Network error')),
    } as unknown as AirMentorApiClientLike

    const repositories = createAirMentorRepositories({
      repositoryMode: 'http',
      apiClient: mockClient,
      academicBootstrap: {
        runtime: {
          tasks: [],
          resolvedTasks: {},
          studentPatches: {},
          drafts: {},
          cellValues: {},
          lockByOffering: {},
          lockAuditByTarget: {},
          timetableByFacultyId: {},
          taskPlacements: {},
          calendarAudit: [],
          schemeByOffering: {},
          ttBlueprintsByOffering: {},
          adminCalendarByFacultyId: {},
        },
        professor: { id: 'prof-1', name: 'Prof', email: 'prof@example.com', dept: 'CS', role: 'Professor', initials: 'PR' },
        faculty: [],
        offerings: [],
        yearGroups: [],
        mentees: [],
        teachers: [],
        subjectRuns: [],
        studentsByOffering: {},
        studentHistoryByUsn: {},
        courseOutcomesByOffering: {},
        assessmentSchemesByOffering: {},
        questionPapersByOffering: {},
        coAttainmentByOffering: {},
        meetings: [],
      },
    })

    const newTask: SharedTask = {
      id: 'task-1',
      studentId: 'student-1',
      studentName: 'John Doe',
      studentUsn: 'USN123',
      offeringId: 'offering-1',
      courseCode: 'CS101',
      courseName: 'Intro to CS',
      year: '2023',
      riskProb: 0,
      riskBand: 'Low',
      title: 'Follow up',
      due: 'This week',
      status: 'New',
      actionHint: 'Hint',
      priority: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskType: 'Follow-up',
      assignedTo: 'Course Leader',
      escalated: false,
      transitionHistory: [],
    }

    // Attempt to save the task
    await expect(repositories.tasks.saveTasks([newTask])).rejects.toThrow('Network error')

    // The local cache should NOT have the task if the API call failed
    const snapshot = repositories.tasks.getTasksSnapshot(() => [])
    
    // We want to assert that the snapshot should be empty (no phantom success).
    expect(snapshot).toHaveLength(0)
  })

  it('P12-C03: Degradation paths preserve actionable user feedback without false success states (saveDrafts)', async () => {
    const mockClient = {
      saveAcademicDrafts: vi.fn().mockRejectedValue(new Error('Network error')),
    } as unknown as AirMentorApiClientLike

    const repositories = createAirMentorRepositories({
      repositoryMode: 'http',
      apiClient: mockClient,
      academicBootstrap: {
        runtime: {
          tasks: [],
          resolvedTasks: {},
          studentPatches: {},
          drafts: {},
          cellValues: {},
          lockByOffering: {},
          lockAuditByTarget: {},
          timetableByFacultyId: {},
          taskPlacements: {},
          calendarAudit: [],
          schemeByOffering: {},
          ttBlueprintsByOffering: {},
          adminCalendarByFacultyId: {},
        },
        professor: { id: 'prof-1', name: 'Prof', email: 'prof@example.com', dept: 'CS', role: 'Professor', initials: 'PR' },
        faculty: [],
        offerings: [],
        yearGroups: [],
        mentees: [],
        teachers: [],
        subjectRuns: [],
        studentsByOffering: {},
        studentHistoryByUsn: {},
        courseOutcomesByOffering: {},
        assessmentSchemesByOffering: {},
        questionPapersByOffering: {},
        coAttainmentByOffering: {},
        meetings: [],
      },
    })

    const newDrafts = { 'offering-1::tt1': Date.now() }

    await expect(repositories.entryData.saveDrafts(newDrafts)).rejects.toThrow('Network error')

    const snapshot = repositories.entryData.getDraftSnapshot()
    expect(snapshot).toEqual({})
  })
})
