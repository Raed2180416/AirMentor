import { describe, expect, it } from 'vitest'
import {
  canAccessPage,
  findStudentProfileLaunchTarget,
  getHomePage,
  resolveAssignedMentees,
  resolveRoleSyncState,
} from '../src/academic-workspace-route-helpers'

const allMentees = [
  { id: 'mentee-student_001', usn: '1MS23MC001', name: 'Aarav Sharma', phone: '+91-9000000001', year: 'III Year', section: 'A', dept: 'MNC', courseRisks: [], avs: 0.72, interventions: [], prevCgpa: 7.1 },
  { id: 'mentee-student_002', usn: '1MS23MC002', name: 'Meera Iyer', phone: '+91-9000000002', year: 'III Year', section: 'A', dept: 'MNC', courseRisks: [], avs: 0.32, interventions: [], prevCgpa: 8.1 },
]

const offerings = [
  { id: 'course_1', offId: 'off_mc601_a', code: 'MC601', title: 'Graph Theory', year: 'III Year', dept: 'MNC', sem: 6, section: 'A', count: 60, attendance: 91, stage: 2, stageInfo: { stage: 2, label: 'In Progress', desc: 'Mid-semester', color: '#3b82f6' }, tt1Done: true, tt2Done: false, pendingAction: null, sections: ['A'], enrolled: [60], att: [91] },
  { id: 'course_2', offId: 'off_mc602_a', code: 'MC602', title: 'Optimization', year: 'III Year', dept: 'MNC', sem: 6, section: 'A', count: 60, attendance: 91, stage: 2, stageInfo: { stage: 2, label: 'In Progress', desc: 'Mid-semester', color: '#3b82f6' }, tt1Done: true, tt2Done: false, pendingAction: null, sections: ['A'], enrolled: [60], att: [91] },
]

const studentsByOffering = {
  off_mc601_a: [
    { id: 'student_001', usn: '1MS23MC001', name: 'Aarav Sharma' },
  ],
  off_mc602_a: [
    { id: 'student_002', usn: '1MS23MC002', name: 'Meera Iyer' },
  ],
}

describe('academic workspace route helpers', () => {
  it('prefers faculty-profile mentor scope over bootstrap mentee hints', () => {
    const assigned = resolveAssignedMentees(allMentees as never[], {
      facultyId: 'mnc_t1',
      name: 'Dr. Asha Rao',
      initials: 'AR',
      allowedRoles: ['Mentor'],
      dept: 'MNC',
      roleTitle: 'Professor',
      email: 'asha.rao@example.edu',
      courseCodes: [],
      offeringIds: [],
      menteeIds: ['mentee-student_001', 'mentee-student_002'],
    }, {
      facultyId: 'mnc_t1',
      displayName: 'Dr. Asha Rao',
      designation: 'Professor',
      employeeCode: 'F001',
      joinedOn: '2020-06-01',
      email: 'asha.rao@example.edu',
      phone: null,
      primaryDepartment: null,
      appointments: [],
      permissions: [],
      subjectRunCourseLeaderScope: [],
      mentorScope: { activeStudentCount: 1, studentIds: ['student_001'] },
      currentOwnedClasses: [],
      currentBatchContexts: [],
      timetableStatus: { hasTemplate: false, publishedAt: null, directEditWindowEndsAt: null },
      requestSummary: { openCount: 0, recent: [] },
      reassessmentSummary: { openCount: 0, nextDueAt: null, recentDecisionTypes: [] },
      proofOperations: {
        scopeDescriptor: { scopeType: 'proof', scopeId: 'checkpoint_001', label: '2023 Mathematics and Computing', batchId: 'batch_mnc_2023', sectionCode: null, branchName: 'B.Tech Mathematics and Computing', simulationRunId: 'run_001', simulationStageCheckpointId: 'checkpoint_001', studentId: null },
        resolvedFrom: { kind: 'proof-checkpoint', scopeType: 'proof', scopeId: 'checkpoint_001', label: 'Semester Close · Proof Run 1' },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 6,
        activeRunContexts: [],
        selectedCheckpoint: null,
        monitoringQueue: [],
        electiveFits: [],
      },
    } as never)

    expect(assigned.map(mentee => mentee.id)).toEqual(['mentee-student_001'])
  })

  it('prefers the declared offering when opening a bounded partial profile', () => {
    const target = findStudentProfileLaunchTarget({
      studentId: 'student_002',
      offeringId: 'off_mc602_a',
      offerings: offerings as never[],
      getStudentsForOffering: offering => (studentsByOffering as Record<string, unknown[]>)[offering.offId] as never[],
    })

    expect(target).toMatchObject({
      offering: expect.objectContaining({ offId: 'off_mc602_a' }),
      student: expect.objectContaining({ id: 'student_002' }),
    })
  })

  it('preserves valid mentor queue-history navigation when role metadata refreshes', () => {
    expect(canAccessPage('Mentor', 'queue-history')).toBe(true)
    expect(getHomePage('Mentor')).toBe('mentees')

    expect(resolveRoleSyncState({
      allowedRoles: ['Course Leader', 'Mentor', 'HoD'],
      initialRole: 'Mentor',
      role: 'Mentor',
      page: 'queue-history',
    })).toBeNull()
  })

  it('falls back to the role home page when the current page is no longer allowed', () => {
    expect(resolveRoleSyncState({
      allowedRoles: ['Mentor'],
      initialRole: 'Mentor',
      role: 'Mentor',
      page: 'scheme-setup',
    })).toEqual({
      role: 'Mentor',
      page: 'mentees',
    })
  })
})
