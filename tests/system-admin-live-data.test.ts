import { describe, expect, it } from 'vitest'
import {
  deriveCurrentYearLabel,
  isVisibleAdminRecord,
  listCurriculumBySemester,
  listFacultyAssignments,
  searchLiveAdminWorkspace,
  type LiveAdminDataset,
} from '../src/system-admin-live-data'

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
      sectionLabels: ['A'],
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
      roleGrants: [],
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
  requests: [],
}

describe('system-admin-live-data', () => {
  it('derives the current year label from the active semester', () => {
    expect(deriveCurrentYearLabel(5)).toBe('3rd Year')
  })

  it('groups curriculum by semester', () => {
    const grouped = listCurriculumBySemester(dataset, 'batch_2022')
    expect(grouped).toHaveLength(1)
    expect(grouped[0].semesterNumber).toBe(5)
    expect(grouped[0].courses[0].courseCode).toBe('CS699')
  })

  it('treats archived records as hidden from primary admin views', () => {
    expect(isVisibleAdminRecord('active')).toBe(true)
    expect(isVisibleAdminRecord('archived')).toBe(false)

    const archivedDataset: LiveAdminDataset = {
      ...dataset,
      curriculumCourses: [
        ...dataset.curriculumCourses,
        {
          curriculumCourseId: 'curr_2',
          batchId: 'batch_2022',
          semesterNumber: 6,
          courseId: 'course_1',
          courseCode: 'CS700',
          title: 'Archived Curriculum',
          credits: 3,
          status: 'archived',
          version: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      academicFaculties: [
        ...dataset.academicFaculties,
        {
          academicFacultyId: 'af_archived',
          institutionId: 'inst_1',
          code: 'ARC',
          name: 'Archived Faculty',
          overview: null,
          status: 'archived',
          version: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }

    expect(listCurriculumBySemester(archivedDataset, 'batch_2022')).toHaveLength(1)
    expect(searchLiveAdminWorkspace(archivedDataset, 'Archived Faculty')).toHaveLength(0)
  })

  it('finds faculty assignments from ownership records', () => {
    const assignments = listFacultyAssignments(dataset, 'fac_1')
    expect(assignments).toHaveLength(1)
    expect(assignments[0].offering?.code).toBe('CS699')
  })

  it('searches across students, batches, and faculty members', () => {
    expect(searchLiveAdminWorkspace(dataset, 'Aisha')[0]?.route.section).toBe('students')
    expect(searchLiveAdminWorkspace(dataset, '2022')[0]?.route.batchId).toBe('batch_2022')
    expect(searchLiveAdminWorkspace(dataset, 'Nandini')[0]?.route.section).toBe('faculty-members')
  })
})
