import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  academicFaculties,
  academicTerms,
  batches,
  branches,
  courses,
  curriculumCourses,
  departments,
  facultyAppointments,
  facultyOfferingOwnerships,
  policyOverrides,
  roleGrants,
  sectionOfferings,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

async function expectSingleRowStatus<T extends { status: string }>(rowsPromise: Promise<T[]>, status: string) {
  const [row] = await rowsPromise
  expect(row).toBeTruthy()
  expect(row?.status).toBe(status)
}

describe('admin hierarchy routes', () => {
  it('supports academic faculties, batches, curriculum, and resolved policy inheritance', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const departmentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/departments',
      headers: { cookie: login.cookie },
    })
    expect(departmentsResponse.statusCode).toBe(200)
    const [department] = departmentsResponse.json().items
    expect(department).toBeTruthy()

    const academicFacultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/academic-faculties',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: 'MED',
        name: 'Medicine',
        overview: 'Medical programs and governance.',
        status: 'active',
      },
    })
    expect(academicFacultyCreate.statusCode).toBe(200)
    const academicFaculty = academicFacultyCreate.json()

    const departmentPatch = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/departments/${department.departmentId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        academicFacultyId: academicFaculty.academicFacultyId,
        code: department.code,
        name: department.name,
        status: department.status,
        version: department.version,
      },
    })
    expect(departmentPatch.statusCode).toBe(200)
    expect(departmentPatch.json().academicFacultyId).toBe(academicFaculty.academicFacultyId)

    const branchesResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/branches',
      headers: { cookie: login.cookie },
    })
    expect(branchesResponse.statusCode).toBe(200)
    const [branch] = branchesResponse.json().items
    expect(branch).toBeTruthy()

    const batchCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/batches',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        branchId: branch.branchId,
        admissionYear: 2022,
        batchLabel: '2022',
        currentSemester: 5,
        sectionLabels: ['A', 'B'],
        status: 'active',
      },
    })
    expect(batchCreate.statusCode).toBe(200)
    const batch = batchCreate.json()

    const termCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/terms',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        branchId: branch.branchId,
        batchId: batch.batchId,
        academicYearLabel: '2024-25',
        semesterNumber: 5,
        startDate: '2024-08-01',
        endDate: '2024-12-15',
        status: 'active',
      },
    })
    expect(termCreate.statusCode).toBe(200)
    expect(termCreate.json().batchId).toBe(batch.batchId)

    const coursesResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/courses',
      headers: { cookie: login.cookie },
    })
    expect(coursesResponse.statusCode).toBe(200)
    const [course] = coursesResponse.json().items
    expect(course).toBeTruthy()

    const curriculumCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/curriculum-courses',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        batchId: batch.batchId,
        semesterNumber: 5,
        courseId: course.courseId,
        courseCode: 'CS699',
        title: 'Governance Systems',
        credits: 4,
        status: 'active',
      },
    })
    expect(curriculumCreate.statusCode).toBe(200)
    expect(curriculumCreate.json().courseCode).toBe('CS699')

    const branchPolicyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/policy-overrides',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        scopeType: 'branch',
        scopeId: branch.branchId,
        policy: {
          ceSeeSplit: {
            ce: 55,
            see: 45,
          },
          riskRules: {
            highRiskAttendancePercentBelow: 62,
            mediumRiskAttendancePercentBelow: 74,
            highRiskCgpaBelow: 5.8,
            mediumRiskCgpaBelow: 6.8,
            highRiskBacklogCount: 3,
            mediumRiskBacklogCount: 1,
          },
        },
        status: 'active',
      },
    })
    expect(branchPolicyCreate.statusCode).toBe(200)

    const batchPolicyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/policy-overrides',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        scopeType: 'batch',
        scopeId: batch.batchId,
        policy: {
          ceComponentCaps: {
            termTestsWeight: 25,
            quizWeight: 10,
            assignmentWeight: 25,
            maxTermTests: 2,
            maxQuizzes: 2,
            maxAssignments: 3,
          },
          workingCalendar: {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            dayStart: '08:00',
            dayEnd: '15:30',
          },
        },
        status: 'active',
      },
    })
    expect(batchPolicyCreate.statusCode).toBe(200)

    const resolvedResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${batch.batchId}/resolved-policy`,
      headers: { cookie: login.cookie },
    })
    expect(resolvedResponse.statusCode).toBe(200)
    const resolved = resolvedResponse.json()
    expect(resolved.batch.batchId).toBe(batch.batchId)
    expect(resolved.scopeChain.some((item: { scopeType: string; scopeId: string }) => item.scopeType === 'batch' && item.scopeId === batch.batchId)).toBe(true)
    expect(resolved.effectivePolicy.ceSeeSplit).toEqual({ ce: 55, see: 45 })
    expect(resolved.effectivePolicy.ceComponentCaps.maxAssignments).toBe(3)
    expect(resolved.effectivePolicy.workingCalendar.days).toContain('Sat')
    expect(resolved.effectivePolicy.riskRules).toEqual({
      highRiskAttendancePercentBelow: 62,
      mediumRiskAttendancePercentBelow: 74,
      highRiskCgpaBelow: 5.8,
      mediumRiskCgpaBelow: 6.8,
      highRiskBacklogCount: 3,
      mediumRiskBacklogCount: 1,
    })
  })

  it('returns current cgpa and active academic context in the student admin list', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/students',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const items = response.json().items
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].currentCgpa).toBeTypeOf('number')
    expect(items[0].activeAcademicContext?.termId).toBeTruthy()
    expect(items[0].activeAcademicContext?.batchId).toBeTruthy()
  })

  it('allows archiving an academic faculty without moving its departments first', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const academicFacultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/academic-faculties',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: 'ART',
        name: 'Arts and Humanities',
        overview: 'Temporary archive coverage.',
        status: 'active',
      },
    })
    expect(academicFacultyCreate.statusCode).toBe(200)
    const academicFaculty = academicFacultyCreate.json()

    const departmentCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/departments',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        academicFacultyId: academicFaculty.academicFacultyId,
        code: 'ENG-LIT',
        name: 'English Literature',
        status: 'active',
      },
    })
    expect(departmentCreate.statusCode).toBe(200)
    const department = departmentCreate.json()

    const archiveResponse = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/academic-faculties/${academicFaculty.academicFacultyId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: academicFaculty.code,
        name: academicFaculty.name,
        overview: academicFaculty.overview,
        status: 'archived',
        version: academicFaculty.version,
      },
    })

    expect(archiveResponse.statusCode).toBe(200)
    expect(archiveResponse.json().status).toBe('archived')
    await expectSingleRowStatus(
      current.db.select().from(departments).where(eq(departments.departmentId, department.departmentId)),
      'active',
    )
  })

  it('cascade deletes nested academic records when an academic faculty is deleted', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const academicFacultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/academic-faculties',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: 'SCI',
        name: 'School of Sciences',
        overview: 'Delete cascade coverage.',
        status: 'active',
      },
    })
    expect(academicFacultyCreate.statusCode).toBe(200)
    const academicFaculty = academicFacultyCreate.json()

    const departmentCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/departments',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        academicFacultyId: academicFaculty.academicFacultyId,
        code: 'PHY',
        name: 'Physics',
        status: 'active',
      },
    })
    expect(departmentCreate.statusCode).toBe(200)
    const department = departmentCreate.json()

    const branchCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/branches',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        departmentId: department.departmentId,
        code: 'BSC-PHY',
        name: 'BSc Physics',
        programLevel: 'UG',
        semesterCount: 6,
        status: 'active',
      },
    })
    expect(branchCreate.statusCode).toBe(200)
    const branch = branchCreate.json()

    const batchCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/batches',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        branchId: branch.branchId,
        admissionYear: 2024,
        batchLabel: '2024',
        currentSemester: 3,
        sectionLabels: ['A'],
        status: 'active',
      },
    })
    expect(batchCreate.statusCode).toBe(200)
    const batch = batchCreate.json()

    const termCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/terms',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        branchId: branch.branchId,
        batchId: batch.batchId,
        academicYearLabel: '2026-27',
        semesterNumber: 3,
        startDate: '2026-08-01',
        endDate: '2026-12-10',
        status: 'active',
      },
    })
    expect(termCreate.statusCode).toBe(200)
    const term = termCreate.json()

    const courseCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/courses',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        courseCode: 'PH301',
        title: 'Quantum Foundations',
        defaultCredits: 4,
        departmentId: department.departmentId,
        status: 'active',
      },
    })
    expect(courseCreate.statusCode).toBe(200)
    const course = courseCreate.json()

    const curriculumCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/curriculum-courses',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        batchId: batch.batchId,
        semesterNumber: 3,
        courseId: course.courseId,
        courseCode: course.courseCode,
        title: course.title,
        credits: course.defaultCredits,
        status: 'active',
      },
    })
    expect(curriculumCreate.statusCode).toBe(200)
    const curriculum = curriculumCreate.json()

    const facultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/faculty',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        username: 'science.delete',
        email: 'science.delete@airmentor.local',
        phone: '+91 9876543210',
        password: 'faculty1234',
        employeeCode: 'SCI-001',
        displayName: 'Science Delete',
        designation: 'Assistant Professor',
        joinedOn: '2026-01-10',
        status: 'active',
      },
    })
    expect(facultyCreate.statusCode).toBe(200)
    const faculty = facultyCreate.json()

    const appointmentCreate = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${faculty.facultyId}/appointments`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        departmentId: department.departmentId,
        branchId: branch.branchId,
        isPrimary: true,
        startDate: '2026-01-10',
        status: 'active',
      },
    })
    expect(appointmentCreate.statusCode).toBe(200)
    const appointment = appointmentCreate.json()

    const roleGrantCreate = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${faculty.facultyId}/role-grants`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        roleCode: 'MENTOR',
        scopeType: 'branch',
        scopeId: branch.branchId,
        startDate: '2026-01-10',
        status: 'active',
      },
    })
    expect(roleGrantCreate.statusCode).toBe(200)
    const roleGrant = roleGrantCreate.json()

    const offeringCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/offerings',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        courseId: course.courseId,
        termId: term.termId,
        branchId: branch.branchId,
        sectionCode: 'A',
        yearLabel: '2nd Year',
        attendance: 0,
        studentCount: 0,
        stage: 1,
        stageLabel: 'Stage 1',
        stageDescription: 'Setup',
        stageColor: '#2563eb',
        tt1Done: false,
        tt2Done: false,
        tt1Locked: false,
        tt2Locked: false,
        quizLocked: false,
        assignmentLocked: false,
        pendingAction: 'Assign owner',
        status: 'active',
      },
    })
    expect(offeringCreate.statusCode).toBe(200)
    const offering = offeringCreate.json()

    const ownershipCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/offering-ownership',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        offeringId: offering.offeringId,
        facultyId: faculty.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      },
    })
    expect(ownershipCreate.statusCode).toBe(200)
    const ownership = ownershipCreate.json()

    const policyOverrideCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/policy-overrides',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        scopeType: 'academic-faculty',
        scopeId: academicFaculty.academicFacultyId,
        policy: {
          ceSeeSplit: {
            ce: 60,
            see: 40,
          },
        },
        status: 'active',
      },
    })
    expect(policyOverrideCreate.statusCode).toBe(200)
    const policyOverride = policyOverrideCreate.json()

    const deleteResponse = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/academic-faculties/${academicFaculty.academicFacultyId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: academicFaculty.code,
        name: academicFaculty.name,
        overview: academicFaculty.overview,
        status: 'deleted',
        version: academicFaculty.version,
      },
    })

    expect(deleteResponse.statusCode).toBe(200)
    expect(deleteResponse.json().status).toBe('deleted')

    await expectSingleRowStatus(
      current.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, academicFaculty.academicFacultyId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(departments).where(eq(departments.departmentId, department.departmentId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(branches).where(eq(branches.branchId, branch.branchId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(batches).where(eq(batches.batchId, batch.batchId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(academicTerms).where(eq(academicTerms.termId, term.termId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(courses).where(eq(courses.courseId, course.courseId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, curriculum.curriculumCourseId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, offering.offeringId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, ownership.ownershipId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(facultyAppointments).where(eq(facultyAppointments.appointmentId, appointment.appointmentId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(roleGrants).where(eq(roleGrants.grantId, roleGrant.grantId)),
      'deleted',
    )
    await expectSingleRowStatus(
      current.db.select().from(policyOverrides).where(eq(policyOverrides.policyOverrideId, policyOverride.policyOverrideId)),
      'deleted',
    )
  })
})
