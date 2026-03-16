import { describe, expect, it } from 'vitest'
import {
  createMockAdminState,
  deriveCurrentYearLabel,
  implementAdminRequest,
  resolvePolicyForBatch,
  searchAdminWorkspace,
} from '../src/system-admin-mock-data'

describe('system admin mock data', () => {
  it('derives the current year label from active semester', () => {
    expect(deriveCurrentYearLabel(1)).toBe('1st Year')
    expect(deriveCurrentYearLabel(4)).toBe('2nd Year')
    expect(deriveCurrentYearLabel(6)).toBe('3rd Year')
    expect(deriveCurrentYearLabel(8)).toBe('4th Year')
  })

  it('resolves inherited batch policy overrides', () => {
    const state = createMockAdminState()
    const resolved = resolvePolicyForBatch(state, 'batch-cse-2022')

    expect(resolved).not.toBeNull()
    expect(resolved?.effectivePolicy.assessment.ce).toBe(50)
    expect(resolved?.effectivePolicy.assessment.see).toBe(50)
    expect(resolved?.effectivePolicy.assessment.maxQuizCount).toBe(3)
    expect(resolved?.effectivePolicy.schedule.dayStart).toBe('08:30')
    expect(resolved?.effectivePolicy.gradingBands[0]?.minScore).toBe(92)
  })

  it('searches across students, faculty members, batches, and courses', () => {
    const state = createMockAdminState()

    const studentResults = searchAdminWorkspace(state, 'aisha')
    const facultyResults = searchAdminWorkspace(state, 'nandini')
    const batchResults = searchAdminWorkspace(state, '2022')
    const courseResults = searchAdminWorkspace(state, 'CS652')

    expect(studentResults.some(item => item.kind === 'student' && item.title === 'Aisha Khan')).toBe(true)
    expect(facultyResults.some(item => item.kind === 'faculty-member' && item.title === 'Prof. Nandini Shah')).toBe(true)
    expect(batchResults.some(item => item.kind === 'batch' && item.title.includes('2022'))).toBe(true)
    expect(courseResults.some(item => item.kind === 'course' && item.title.includes('CS652'))).toBe(true)
  })

  it('implements mentor reassignment requests', () => {
    const next = implementAdminRequest(createMockAdminState(), 'req-mentor-1', 'Mentor mapping updated.')

    const student = next.students.find(item => item.id === 'stu-aisha')
    const request = next.requests.find(item => item.id === 'req-mentor-1')

    expect(student?.mentorFacultyMemberId).toBe('fm-neha')
    expect(request?.status).toBe('Implemented')
    expect(request?.implementationNote).toBe('Mentor mapping updated.')
  })

  it('implements timetable change requests', () => {
    const next = implementAdminRequest(createMockAdminState(), 'req-timetable-1', 'Timetable changed for placement slot conflict.')
    const facultyMember = next.facultyMembers.find(item => item.id === 'fm-arjun')
    const assignment = facultyMember?.teachingAssignments.find(item => item.id === 'ta-arjun-dslab')

    expect(assignment?.weeklyPattern).toEqual(['Tue 14:00-15:00', 'Thu 14:00-15:00'])
  })
})
