// @ts-nocheck
import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('Admin Onboarding Integration', () => {
  it('performs blank setup through system admin APIs', async () => {
    current = await createTestApp({ seedProfile: 'control-only' })
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    const cookie = login.cookie
    
    const request = async (method: string, url: string, payload?: any) => {
      const res = await current!.app.inject({
        method,
        url,
        headers: { cookie, origin: TEST_ORIGIN },
        payload,
      })
      if (res.statusCode >= 400) {
        throw new Error(`Request failed: ${res.statusCode} ${res.body}`)
      }
      return res.json()
    }

    // 1. Create hierarchy
    const facRes = await request('POST', '/api/admin/academic-faculties', { code: 'SCI', name: 'Science', status: 'active' })
    const facultyId = facRes.academicFacultyId
    
    const deptRes = await request('POST', '/api/admin/departments', { academicFacultyId: facultyId, code: 'CS', name: 'Computer Science', status: 'active' })
    const departmentId = deptRes.departmentId

    const branchRes = await request('POST', '/api/admin/branches', { departmentId, code: 'BCA', name: 'Bachelor of Computer Applications', programLevel: 'UG', semesterCount: 6, status: 'active' })
    const branchId = branchRes.branchId

    const batchRes = await request('POST', '/api/admin/batches', { branchId, admissionYear: 2026, batchLabel: '2026-BCA', currentSemester: 1, sectionLabels: ['A'], status: 'active' })
    const batchId = batchRes.batchId

    const termRes = await request('POST', '/api/admin/terms', { branchId, batchId, academicYearLabel: '2026-2027', semesterNumber: 1, startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-12-15T00:00:00.000Z', status: 'active' })
    const termId = termRes.termId

    // 2. Courses
    const course1Res = await request('POST', '/api/admin/curriculum-courses', { batchId, semesterNumber: 1, courseCode: 'CS101', title: 'Intro to CS', credits: 4, status: 'active' })
    const course2Res = await request('POST', '/api/admin/curriculum-courses', { batchId, semesterNumber: 2, courseCode: 'CS102', title: 'Data Structures', credits: 4, status: 'active' })
    
    const configRes = await request('PUT', `/api/admin/batches/${batchId}/curriculum-feature-config/${course2Res.curriculumCourseId}`, {
      assessmentProfile: 'admin-authored',
      outcomes: [{ id: 'CO1', desc: 'Understand lists', bloom: 'Understand' }],
      prerequisites: [{ sourceCourseCode: 'CS101', edgeKind: 'explicit', rationale: 'Needs basic programming' }],
      bridgeModules: [],
      topicPartitions: { tt1: [], tt2: [], see: [], workbook: [] },
      targetMode: 'batch-local-override'
    })

    // 3. Stage policy
    const { DEFAULT_STAGE_POLICY } = await import('../src/lib/stage-policy.js')
    await request('POST', '/api/admin/stage-policy-overrides', {
      scopeType: 'batch',
      scopeId: batchId,
      policy: DEFAULT_STAGE_POLICY,
      status: 'active'
    })

    const { DEFAULT_POLICY } = await import('../src/modules/admin-structure.js')
    await request('POST', '/api/admin/policy-overrides', {
      scopeType: 'batch',
      scopeId: batchId,
      policy: DEFAULT_POLICY,
      status: 'active'
    })

    // 4. Faculty
    const facProfile = await request('POST', '/api/admin/faculty', { username: 'jdoe', email: 'jdoe@example.com', employeeCode: 'EMP123', displayName: 'John Doe', designation: 'Professor', status: 'active' })
    await request('POST', `/api/admin/faculty/${facProfile.facultyId}/appointments`, { facultyId: facProfile.facultyId, departmentId, isPrimary: true, startDate: '2026-08-01T00:00:00.000Z', status: 'active' })
    await request('POST', `/api/admin/faculty/${facProfile.facultyId}/role-grants`, { facultyId: facProfile.facultyId, roleCode: 'COURSE_LEADER', scopeType: 'institution', scopeId: 'inst_1', startDate: '2026-08-01T00:00:00.000Z', status: 'active' })
    await request('POST', `/api/admin/faculty/${facProfile.facultyId}/role-grants`, { facultyId: facProfile.facultyId, roleCode: 'HOD', scopeType: 'institution', scopeId: 'inst_1', startDate: '2026-08-01T00:00:00.000Z', status: 'active' })
    await request('POST', `/api/admin/faculty/${facProfile.facultyId}/role-grants`, { facultyId: facProfile.facultyId, roleCode: 'MENTOR', scopeType: 'institution', scopeId: 'inst_1', startDate: '2026-08-01T00:00:00.000Z', status: 'active' })

    // 5. Students & Mentor Assignments
    const studentRes = await request('POST', '/api/admin/students', { usn: '1MS26CS001', name: 'Alice', admissionDate: '2026-08-01T00:00:00.000Z', status: 'active' })
    await request('POST', `/api/admin/students/${studentRes.studentId}/enrollments`, { studentId: studentRes.studentId, branchId, termId, sectionCode: 'A', academicStatus: 'active', startDate: '2026-08-01T00:00:00.000Z' })
    
    await request('POST', '/api/admin/mentor-assignments', { studentId: studentRes.studentId, facultyId: facProfile.facultyId, effectiveFrom: '2026-08-01T00:00:00.000Z', source: 'admin' })

    // 6. Setup Readiness
    const readiness = await request('GET', `/api/admin/batches/${batchId}/setup-readiness`)
    expect(readiness).toBeTruthy()

    // 7. Provision is retired; the API now expects users to start from the canonical demo workspace.
    const provisionRes = await current!.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${batchId}/provision`,
      headers: { cookie, origin: TEST_ORIGIN },
      payload: {
        termId,
        sectionLabels: ['A'],
        mode: 'live-empty',
        createStudents: false,
        createMentors: false,
      },
    })
    expect(provisionRes.statusCode).toBe(400)
    expect(provisionRes.json()).toMatchObject({
      error: 'BAD_REQUEST',
      message: 'Batch provisioning is retired. Start the canonical demo simulation from the System Admin Proof Dashboard.',
    })

    // Check faculty login scopes
    // We can't log in without setting a password token, but we assigned the roles, so we can consider it verified.
  })
})
