import { describe, expect, it } from 'vitest'
import {
  computeOverviewScopedCounts,
  describeRegistryScope,
  isCurrentRoleGrant,
  isLeaderLikeOwnership,
  matchesFacultyScope,
  matchesOfferingScope,
  matchesStudentScope,
} from '../src/system-admin-overview-helpers'
import type { LiveAdminDataset } from '../src/system-admin-live-data'

const dataset: LiveAdminDataset = {
  institution: {
    institutionId: 'inst_1',
    name: 'AirMentor University',
    timezone: 'Asia/Kolkata',
    academicYearStartMonth: 7,
    status: 'active',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  academicFaculties: [
    {
      academicFacultyId: 'af_eng',
      institutionId: 'inst_1',
      code: 'ENG',
      name: 'Engineering and Technology',
      overview: null,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  departments: [
    {
      departmentId: 'dept_cse',
      institutionId: 'inst_1',
      academicFacultyId: 'af_eng',
      code: 'CSE',
      name: 'Computer Science and Engineering',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  branches: [
    {
      branchId: 'branch_cse',
      departmentId: 'dept_cse',
      code: 'CSE',
      name: 'Computer Science and Engineering',
      programLevel: 'UG',
      semesterCount: 8,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  batches: [
    {
      batchId: 'batch_2022',
      branchId: 'branch_cse',
      admissionYear: 2022,
      batchLabel: '2022',
      currentSemester: 5,
      sectionLabels: ['A', 'B'],
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  terms: [
    {
      termId: 'term_5',
      branchId: 'branch_cse',
      batchId: 'batch_2022',
      academicYearLabel: '2024-25',
      semesterNumber: 5,
      startDate: '2024-08-01',
      endDate: '2024-12-15',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  facultyMembers: [
    {
      facultyId: 'fac_1',
      userId: 'user_1',
      username: 'prof',
      email: 'prof@airmentor.local',
      phone: null,
      employeeCode: 'EMP001',
      displayName: 'Prof. Nandini Shah',
      designation: 'Professor',
      joinedOn: null,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      appointments: [
        {
          appointmentId: 'appt_1',
          facultyId: 'fac_1',
          departmentId: 'dept_cse',
          branchId: 'branch_cse',
          isPrimary: true,
          startDate: '2024-01-01',
          endDate: null,
          status: 'active',
          version: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      roleGrants: [
        {
          grantId: 'grant_1',
          facultyId: 'fac_1',
          roleCode: 'COURSE_LEADER',
          scopeType: 'department',
          scopeId: 'dept_cse',
          startDate: '2024-01-01',
          endDate: null,
          status: 'active',
          version: 1,
        },
      ],
    },
  ],
  students: [
    {
      studentId: 'student_1',
      institutionId: 'inst_1',
      usn: '1AM22CS001',
      rollNumber: null,
      name: 'Aisha Khan',
      email: 'aisha@airmentor.local',
      phone: null,
      admissionDate: '2022-08-01',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      currentCgpa: 8.4,
      activeAcademicContext: {
        enrollmentId: 'enroll_1',
        branchId: 'branch_cse',
        branchName: 'Computer Science and Engineering',
        departmentId: 'dept_cse',
        departmentName: 'Computer Science and Engineering',
        termId: 'term_5',
        academicYearLabel: '2024-25',
        semesterNumber: 5,
        sectionCode: 'A',
        batchId: 'batch_2022',
        batchLabel: '2022',
        admissionYear: 2022,
        academicStatus: 'active',
      },
      activeMentorAssignment: {
        assignmentId: 'mentor_assign_1',
        studentId: 'student_1',
        facultyId: 'fac_1',
        effectiveFrom: '2024-08-01',
        effectiveTo: null,
        source: 'sysadmin-manual',
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      enrollments: [],
      mentorAssignments: [],
    },
    {
      studentId: 'student_2',
      institutionId: 'inst_1',
      usn: '1AM22CS002',
      rollNumber: null,
      name: 'Ravi Patel',
      email: 'ravi@airmentor.local',
      phone: null,
      admissionDate: '2022-08-01',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      currentCgpa: 7.2,
      activeAcademicContext: {
        enrollmentId: 'enroll_2',
        branchId: 'branch_cse',
        branchName: 'Computer Science and Engineering',
        departmentId: 'dept_cse',
        departmentName: 'Computer Science and Engineering',
        termId: 'term_5',
        academicYearLabel: '2024-25',
        semesterNumber: 5,
        sectionCode: 'B',
        batchId: 'batch_2022',
        batchLabel: '2022',
        admissionYear: 2022,
        academicStatus: 'active',
      },
      activeMentorAssignment: null,
      enrollments: [],
      mentorAssignments: [],
    },
  ],
  courses: [
    {
      courseId: 'course_1',
      institutionId: 'inst_1',
      courseCode: 'CS699',
      title: 'Governance Systems',
      defaultCredits: 4,
      departmentId: 'dept_cse',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  curriculumCourses: [
    {
      curriculumCourseId: 'curr_1',
      batchId: 'batch_2022',
      semesterNumber: 5,
      courseId: 'course_1',
      courseCode: 'CS699',
      title: 'Governance Systems',
      credits: 4,
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  policyOverrides: [],
  offerings: [
    {
      id: 'course_1',
      offId: 'off_1',
      code: 'CS699',
      title: 'Governance Systems',
      year: '3rd Year',
      dept: 'CSE',
      sem: 5,
      section: 'A',
      count: 60,
      attendance: 92,
      stage: 2,
      stageInfo: {
        stage: 2,
        label: 'In Progress',
        desc: 'Mid-semester',
        color: '#3b82f6',
      },
      tt1Done: true,
      tt2Done: false,
      pendingAction: null,
      sections: ['A'],
      enrolled: [60],
      att: [92],
      branchId: 'branch_cse',
      termId: 'term_5',
    },
  ],
  ownerships: [
    {
      ownershipId: 'own_1',
      offeringId: 'off_1',
      facultyId: 'fac_1',
      ownershipRole: 'PRIMARY',
      status: 'active',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  requests: [
    {
      adminRequestId: 'req_1',
      requestType: 'Mentor Assignment',
      scopeType: 'batch',
      scopeId: 'batch_2022',
      targetEntityRefs: [],
      priority: 'P2',
      status: 'New',
      requestedByRole: 'HOD',
      requestedByFacultyId: 'fac_1',
      ownedByRole: 'SYSTEM_ADMIN',
      ownedByFacultyId: null,
      summary: 'Mentor gap in 3rd year CSE',
      details: 'A student is still waiting for mentor assignment.',
      notesThreadId: 'thread_1',
      dueAt: '2026-03-25T09:00:00.000Z',
      slaPolicyCode: 'std',
      decision: null,
      payload: {},
      version: 1,
      createdAt: '2026-03-19T09:00:00.000Z',
      updatedAt: '2026-03-19T09:00:00.000Z',
      requesterName: 'Admin Desk',
      ownerName: null,
    },
  ],
  reminders: [],
}

describe('system-admin-overview-helpers', () => {
  describe('isLeaderLikeOwnership', () => {
    it('recognizes course, leader, owner, and primary roles', () => {
      expect(isLeaderLikeOwnership('PRIMARY')).toBe(true)
      expect(isLeaderLikeOwnership('COURSE_LEADER')).toBe(true)
      expect(isLeaderLikeOwnership('course leader')).toBe(true)
      expect(isLeaderLikeOwnership('owner')).toBe(true)
      expect(isLeaderLikeOwnership('ASSISTANT')).toBe(false)
      expect(isLeaderLikeOwnership('TA')).toBe(false)
    })
  })

  describe('isCurrentRoleGrant', () => {
    it('returns true only for active grants', () => {
      expect(isCurrentRoleGrant({ ...dataset.facultyMembers[0].roleGrants[0], status: 'active' })).toBe(true)
      expect(isCurrentRoleGrant({ ...dataset.facultyMembers[0].roleGrants[0], status: 'revoked' })).toBe(false)
    })
  })

  describe('describeRegistryScope', () => {
    it('returns null when no scope is selected', () => {
      expect(describeRegistryScope(dataset, null)).toBeNull()
      expect(describeRegistryScope(dataset, {})).toBeNull()
    })

    it('returns the academic faculty name for faculty-level scope', () => {
      expect(describeRegistryScope(dataset, { academicFacultyId: 'af_eng' })).toBe('Engineering and Technology')
    })

    it('returns the department name for department-level scope', () => {
      expect(describeRegistryScope(dataset, { departmentId: 'dept_cse' })).toBe('Computer Science and Engineering')
    })

    it('returns the branch name for branch-level scope', () => {
      expect(describeRegistryScope(dataset, { branchId: 'branch_cse' })).toBe('Computer Science and Engineering')
    })

    it('returns year and batch label for batch-level scope', () => {
      const label = describeRegistryScope(dataset, { batchId: 'batch_2022', branchId: 'branch_cse' })
      expect(label).toContain('3rd Year')
      expect(label).toContain('Batch 2022')
      expect(label).toContain('CSE')
    })

    it('returns section, batch, and branch for section-level scope', () => {
      const label = describeRegistryScope(dataset, {
        sectionCode: 'A',
        batchId: 'batch_2022',
        branchId: 'branch_cse',
      })
      expect(label).toContain('Section A')
      expect(label).toContain('Batch 2022')
      expect(label).toContain('CSE')
    })
  })

  describe('matchesStudentScope', () => {
    it('matches all students when scope is null', () => {
      expect(matchesStudentScope(dataset.students[0], dataset, null)).toBe(true)
      expect(matchesStudentScope(dataset.students[1], dataset, null)).toBe(true)
    })

    it('filters students by section code', () => {
      const sectionA = { sectionCode: 'A', batchId: 'batch_2022' }
      const sectionB = { sectionCode: 'B', batchId: 'batch_2022' }
      expect(matchesStudentScope(dataset.students[0], dataset, sectionA)).toBe(true)
      expect(matchesStudentScope(dataset.students[1], dataset, sectionA)).toBe(false)
      expect(matchesStudentScope(dataset.students[1], dataset, sectionB)).toBe(true)
    })

    it('filters students by academic faculty', () => {
      expect(matchesStudentScope(dataset.students[0], dataset, { academicFacultyId: 'af_eng' })).toBe(true)
      expect(matchesStudentScope(dataset.students[0], dataset, { academicFacultyId: 'af_other' })).toBe(false)
    })

    it('rejects students without active academic context', () => {
      const noContext = { ...dataset.students[0], activeAcademicContext: null }
      expect(matchesStudentScope(noContext, dataset, { batchId: 'batch_2022' })).toBe(false)
    })
  })

  describe('matchesFacultyScope', () => {
    it('matches all faculty when scope has no selection', () => {
      expect(matchesFacultyScope(dataset.facultyMembers[0], dataset, null)).toBe(true)
      expect(matchesFacultyScope(dataset.facultyMembers[0], dataset, {})).toBe(true)
    })

    it('matches faculty by department appointment', () => {
      expect(matchesFacultyScope(dataset.facultyMembers[0], dataset, { departmentId: 'dept_cse' })).toBe(true)
      expect(matchesFacultyScope(dataset.facultyMembers[0], dataset, { departmentId: 'dept_other' })).toBe(false)
    })

    it('matches faculty by ownership when no direct appointment match', () => {
      const noAppointments = {
        ...dataset.facultyMembers[0],
        appointments: [],
      }
      expect(matchesFacultyScope(noAppointments, dataset, { departmentId: 'dept_cse' })).toBe(true)
    })
  })

  describe('matchesOfferingScope', () => {
    it('matches all offerings when scope has no selection', () => {
      expect(matchesOfferingScope(dataset.offerings[0], dataset, null)).toBe(true)
      expect(matchesOfferingScope(dataset.offerings[0], dataset, {})).toBe(true)
    })

    it('filters offerings by branch', () => {
      expect(matchesOfferingScope(dataset.offerings[0], dataset, { branchId: 'branch_cse' })).toBe(true)
      expect(matchesOfferingScope(dataset.offerings[0], dataset, { branchId: 'branch_other' })).toBe(false)
    })

    it('filters offerings by section code', () => {
      expect(matchesOfferingScope(dataset.offerings[0], dataset, { sectionCode: 'A' })).toBe(true)
      expect(matchesOfferingScope(dataset.offerings[0], dataset, { sectionCode: 'B' })).toBe(false)
    })

    it('filters offerings by batch via term lookup', () => {
      expect(matchesOfferingScope(dataset.offerings[0], dataset, { batchId: 'batch_2022' })).toBe(true)
      expect(matchesOfferingScope(dataset.offerings[0], dataset, { batchId: 'batch_other' })).toBe(false)
    })
  })

  describe('computeOverviewScopedCounts', () => {
    it('returns global student counts when scope is null', () => {
      const counts = computeOverviewScopedCounts(dataset, null)
      expect(counts.studentCount).toBe(2)
      expect(counts.mentoredCount).toBe(1)
      expect(counts.mentorGapCount).toBe(1)
      expect(counts.facultyCount).toBe(0)
      expect(counts.ownershipCount).toBe(0)
    })

    it('returns scoped counts for faculty-level scope', () => {
      const counts = computeOverviewScopedCounts(dataset, { academicFacultyId: 'af_eng' })
      expect(counts.studentCount).toBe(2)
      expect(counts.mentoredCount).toBe(1)
      expect(counts.mentorGapCount).toBe(1)
      expect(counts.facultyCount).toBe(1)
      expect(counts.ownershipCount).toBe(1)
    })

    it('returns scoped counts for batch-level scope', () => {
      const counts = computeOverviewScopedCounts(dataset, { batchId: 'batch_2022' })
      expect(counts.studentCount).toBe(2)
      expect(counts.mentoredCount).toBe(1)
      expect(counts.mentorGapCount).toBe(1)
    })

    it('returns scoped counts for section-level scope', () => {
      const countsA = computeOverviewScopedCounts(dataset, { sectionCode: 'A', batchId: 'batch_2022' })
      expect(countsA.studentCount).toBe(1)
      expect(countsA.mentoredCount).toBe(1)
      expect(countsA.mentorGapCount).toBe(0)

      const countsB = computeOverviewScopedCounts(dataset, { sectionCode: 'B', batchId: 'batch_2022' })
      expect(countsB.studentCount).toBe(1)
      expect(countsB.mentoredCount).toBe(0)
      expect(countsB.mentorGapCount).toBe(1)
    })

    it('returns zero students for non-existent scope', () => {
      const counts = computeOverviewScopedCounts(dataset, { academicFacultyId: 'af_nonexistent' })
      expect(counts.studentCount).toBe(0)
      expect(counts.facultyCount).toBe(0)
    })
  })
})
