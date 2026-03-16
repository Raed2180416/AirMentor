import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

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
})
