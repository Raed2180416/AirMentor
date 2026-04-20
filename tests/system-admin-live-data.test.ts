import { describe, expect, it } from 'vitest'
import {
  defaultRegistryFilter,
  compareAdminTimestampsDesc,
  deriveCurrentYearLabel,
  findLatestEnrollment,
  findLatestMentorAssignment,
  hydrateRegistryFilter,
  isBatchVisible,
  isBranchVisible,
  isCourseVisible,
  isDepartmentVisible,
  isFacultyMemberVisible,
  isOfferingVisible,
  isStudentVisible,
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
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      credentialStatus: {
        passwordConfigured: false,
        activeSetupRequest: false,
        latestPurpose: null,
        latestRequestedAt: null,
        latestExpiresAt: null,
      },
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

describe('system-admin-live-data', () => {
  it('sorts missing admin timestamps after real updates', () => {
    const timestamps = ['2026-03-19T09:00:00.000Z', undefined, '2026-03-18T09:00:00.000Z']
    expect([...timestamps].sort((left, right) => compareAdminTimestampsDesc(left, right))).toEqual([
      '2026-03-19T09:00:00.000Z',
      '2026-03-18T09:00:00.000Z',
      undefined,
    ])
  })

  it('hydrates registry filters from scope and falls back to empty defaults', () => {
    expect(defaultRegistryFilter()).toEqual({
      academicFacultyId: '',
      departmentId: '',
      branchId: '',
      batchId: '',
      sectionCode: '',
    })
    expect(hydrateRegistryFilter({
      academicFacultyId: 'af_eng',
      departmentId: 'dept_cse',
      branchId: 'branch_cse',
      batchId: 'batch_2022',
      sectionCode: 'A',
      label: 'Engineering and Technology · Computer Science and Engineering · Batch 2022 · Section A',
    })).toEqual({
      academicFacultyId: 'af_eng',
      departmentId: 'dept_cse',
      branchId: 'branch_cse',
      batchId: 'batch_2022',
      sectionCode: 'A',
    })
    expect(hydrateRegistryFilter(null)).toEqual(defaultRegistryFilter())
  })

  it('prefers active enrollment and mentor assignment but falls back to the newest records', () => {
    const enrollments = [
      {
        enrollmentId: 'enroll_old',
        studentId: 'student_1',
        branchId: 'branch_cse',
        termId: 'term_5',
        sectionCode: 'B',
        rosterOrder: 2,
        academicStatus: 'regular',
        startDate: '2024-01-01',
        endDate: null,
        version: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        enrollmentId: 'enroll_new',
        studentId: 'student_1',
        branchId: 'branch_cse',
        termId: 'term_5',
        sectionCode: 'A',
        rosterOrder: 1,
        academicStatus: 'regular',
        startDate: '2025-01-01',
        endDate: null,
        version: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]
    const mentorAssignments = [
      {
        assignmentId: 'mentor_old',
        studentId: 'student_1',
        facultyId: 'fac_1',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
        source: 'manual',
        version: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        assignmentId: 'mentor_new',
        studentId: 'student_1',
        facultyId: 'fac_2',
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
        source: 'manual',
        version: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]

    expect(findLatestEnrollment({
      enrollments,
      activeAcademicContext: { enrollmentId: 'enroll_old' },
    })?.enrollmentId).toBe('enroll_old')
    expect(findLatestEnrollment({
      enrollments,
      activeAcademicContext: null,
    })).toBeNull()

    expect(findLatestMentorAssignment({
      mentorAssignments,
      activeMentorAssignment: mentorAssignments[0],
    })?.assignmentId).toBe('mentor_old')
    expect(findLatestMentorAssignment({
      mentorAssignments,
      activeMentorAssignment: null,
    })).toBeNull()
  })

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

  it('hides descendants when their academic faculty is archived', () => {
    const archivedDataset: LiveAdminDataset = {
      ...dataset,
      academicFaculties: dataset.academicFaculties.map(item => item.academicFacultyId === 'af_eng' ? { ...item, status: 'archived' } : item),
    }

    expect(isDepartmentVisible(archivedDataset, 'dept_cse')).toBe(false)
    expect(isBranchVisible(archivedDataset, 'branch_cse')).toBe(false)
    expect(isBatchVisible(archivedDataset, 'batch_2022')).toBe(false)
    expect(isCourseVisible(archivedDataset, 'course_1')).toBe(false)
    expect(isStudentVisible(archivedDataset, 'student_1')).toBe(false)
    expect(isFacultyMemberVisible(archivedDataset, 'fac_1')).toBe(false)
    expect(searchLiveAdminWorkspace(archivedDataset, 'Aisha')).toHaveLength(0)
    expect(searchLiveAdminWorkspace(archivedDataset, 'Nandini')).toHaveLength(0)
    expect(searchLiveAdminWorkspace(archivedDataset, 'CS699')).toHaveLength(0)
  })

  it('finds faculty assignments from ownership records', () => {
    const assignments = listFacultyAssignments(dataset, 'fac_1')
    expect(assignments).toHaveLength(1)
    expect(assignments[0].offering?.code).toBe('CS699')
  })

  it('drops ownership-linked assignments when the linked term is no longer visible', () => {
    const archivedTermDataset: LiveAdminDataset = {
      ...dataset,
      terms: dataset.terms.map(item => item.termId === 'term_5' ? { ...item, status: 'archived' } : item),
    }

    expect(isOfferingVisible(archivedTermDataset, archivedTermDataset.offerings[0])).toBe(false)
    expect(listFacultyAssignments(archivedTermDataset, 'fac_1')).toHaveLength(0)
  })

  it('searches across students, batches, and faculty members', () => {
    expect(searchLiveAdminWorkspace(dataset, 'Aisha')[0]?.route.section).toBe('students')
    expect(searchLiveAdminWorkspace(dataset, '2022')[0]?.route.batchId).toBe('batch_2022')
    expect(searchLiveAdminWorkspace(dataset, 'Nandini')[0]?.route.section).toBe('faculty-members')
  })

  it('targets search results to the active panel and current hierarchy scope', () => {
    const scopedDataset: LiveAdminDataset = {
      ...dataset,
      students: [
        ...dataset.students,
        {
          ...dataset.students[0],
          studentId: 'student_2',
          usn: '1AM22CS099',
          name: 'Aria Sen',
          email: 'aria@airmentor.local',
          activeAcademicContext: {
            ...dataset.students[0].activeAcademicContext!,
            sectionCode: 'B',
          },
        },
      ],
    }

    expect(searchLiveAdminWorkspace(scopedDataset, 'mentor', { section: 'requests' })[0]?.route.section).toBe('requests')
    expect(searchLiveAdminWorkspace(scopedDataset, 'Aisha', { section: 'students' })).toHaveLength(0)
    expect(searchLiveAdminWorkspace(scopedDataset, 'Aria', { section: 'students', scope: { batchId: 'batch_2022', sectionCode: 'A' } })).toHaveLength(0)
    expect(searchLiveAdminWorkspace(scopedDataset, 'Aisha', { section: 'students', scope: { batchId: 'batch_2022', sectionCode: 'A' } })[0]?.route.studentId).toBe('student_1')
  })

  it('treats proof-dashboard as a searchable admin section without leaking the scoping model', () => {
    const proofDashboardResults = searchLiveAdminWorkspace(dataset, 'Aisha', { section: 'proof-dashboard' })
    const proofDashboardScopedResults = searchLiveAdminWorkspace(dataset, 'Aisha', {
      section: 'proof-dashboard',
      scope: { batchId: 'batch_2022', sectionCode: 'A' },
    })

    expect(proofDashboardResults).toHaveLength(1)
    expect(proofDashboardResults[0].route.section).toBe('students')
    expect(proofDashboardScopedResults).toHaveLength(1)
    expect(proofDashboardScopedResults[0].route).toMatchObject({
      section: 'students',
      studentId: 'student_1',
    })
  })

  it('scores scoped requests appropriately', () => {
    const requestDataset: LiveAdminDataset = {
      ...dataset,
      requests: [
        {
          ...dataset.requests[0],
          adminRequestId: 'req_batch',
          scopeType: 'batch',
          scopeId: 'batch_2022',
          summary: 'Mentor gap in batch 2022',
        },
        {
          ...dataset.requests[0],
          adminRequestId: 'req_inst',
          scopeType: 'institution',
          scopeId: 'inst_1',
          summary: 'Global issue',
        },
      ],
    }
    const results = searchLiveAdminWorkspace(requestDataset, 'issue', { section: 'requests' })
    expect(results).toHaveLength(1)
    expect(results[0].route.section).toBe('requests')
    
    // Exact request matches should surface
    const batchMatches = searchLiveAdminWorkspace(requestDataset, 'gap', { section: 'requests', scope: { batchId: 'batch_2022' } })
    expect(batchMatches[0].route.requestId).toBe('req_batch')
  })
})
