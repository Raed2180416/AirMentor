import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('Admin Onboarding E2E Flow', () => {
  it('supports full blank academic setup to proof run', async () => {
    current = await createTestApp()
    const sysadmin = await loginAs(current.app, 'sysadmin', 'admin1234')
    
    // --- Step 1: Hierarchy Creation ---
    
    // Create Academic Faculty
    const facultyRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/academic-faculties',
      headers: { cookie: sysadmin.cookie, origin: TEST_ORIGIN },
      payload: {
        code: 'ENG',
        name: 'Engineering Faculty',
        status: 'active',
      },
    })
    expect(facultyRes.statusCode).toBe(200)
    const academicFaculty = facultyRes.json()

    // Create Department
    const deptRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/departments',
      headers: { cookie: sysadmin.cookie, origin: TEST_ORIGIN },
      payload: {
        academicFacultyId: academicFaculty.academicFacultyId,
        code: 'SWE',
        name: 'Software Engineering Department',
        status: 'active',
      },
    })
    expect(deptRes.statusCode).toBe(200)
    const department = deptRes.json()

    // Create Branch
    const branchRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/branches',
      headers: { cookie: sysadmin.cookie, origin: TEST_ORIGIN },
      payload: {
        departmentId: department.departmentId,
        code: 'SWE_BTECH',
        name: 'Software Engineering (B.Tech)',
        programLevel: 'B.Tech',
        semesterCount: 8,
        status: 'active',
      },
    })
    if (branchRes.statusCode !== 200) console.error(branchRes.json())
    expect(branchRes.statusCode).toBe(200)
    const branch = branchRes.json()

    // Create Batch
    const batchRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/batches',
      headers: { cookie: sysadmin.cookie, origin: TEST_ORIGIN },
      payload: {
        branchId: branch.branchId,
        admissionYear: 2028,
        batchLabel: '2028',
        currentSemester: 1,
        sectionLabels: ['A'],
        status: 'active',
      },
    })
    expect(batchRes.statusCode).toBe(200)
    const batch = batchRes.json()

    // Create Term
    const termRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/terms',
      headers: { cookie: sysadmin.cookie, origin: TEST_ORIGIN },
      payload: {
        branchId: branch.branchId,
        batchId: batch.batchId,
        academicYearLabel: '2028-29',
        semesterNumber: 1,
        startDate: '2028-08-01',
        endDate: '2028-12-15',
        status: 'active',
      },
    })
    expect(termRes.statusCode).toBe(200)
    const term = termRes.json()
    
    // --- Output for debugging ---
    expect(term.termId).toBeTruthy()
  })
})
