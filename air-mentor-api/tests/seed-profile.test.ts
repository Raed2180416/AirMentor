import { afterEach, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import {
  academicFaculties,
  academicTerms,
  batches,
  branches,
  departments,
  facultyProfiles,
  roleGrants,
  simulationRuns,
  students,
  userAccounts,
} from '../src/db/schema.js'
import { MSRUAS_PROOF_BATCH_ID } from '../src/adapters/simulation/msruas-proof-sandbox.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  await current?.close()
  current = null
})

describe('seed profiles', () => {
  it('supports a control-only startup profile without demo students, teaching faculty, or proof sandbox data', async () => {
    current = await createTestApp({
      seedProfile: 'control-only',
    })

    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(login.response.statusCode).toBe(200)
    expect(login.body.activeRoleGrant.roleCode).toBe('SYSTEM_ADMIN')

    const [users, faculty, grants, seededAcademicFaculties, seededDepartments, seededBranches, seededBatches, seededStudents, proofBatches, proofStudents] = await Promise.all([
      current.db.select().from(userAccounts),
      current.db.select().from(facultyProfiles),
      current.db.select().from(roleGrants),
      current.db.select().from(academicFaculties),
      current.db.select().from(departments),
      current.db.select().from(branches),
      current.db.select().from(batches),
      current.db.select().from(students),
      current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select().from(students).where(like(students.studentId, 'mnc_student_%')),
    ])

    expect(users.map(user => user.username)).toEqual(['sysadmin'])
    expect(faculty.map(item => item.facultyId)).toEqual(['fac_sysadmin'])
    expect(grants.map(grant => grant.roleCode)).toEqual(['SYSTEM_ADMIN'])
    expect(seededAcademicFaculties).toHaveLength(0)
    expect(seededDepartments).toHaveLength(0)
    expect(seededBranches).toHaveLength(0)
    expect(seededBatches).toHaveLength(0)
    expect(seededStudents).toHaveLength(0)
    expect(proofBatches).toHaveLength(0)
    expect(proofStudents).toHaveLength(0)
  })

  it('does not materialize proof sandbox data from a read-only proof dashboard request', async () => {
    current = await createTestApp({
      seedProfile: 'control-only',
    })
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const dashboardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(dashboardResponse.statusCode).toBe(404)

    const [proofBatches, proofStudents] = await Promise.all([
      current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select().from(students).where(like(students.studentId, 'mnc_student_%')),
    ])
    expect(proofBatches).toHaveLength(0)
    expect(proofStudents).toHaveLength(0)
  })

  it('keeps concurrent proof panel read-only requests from materializing the proof sandbox', async () => {
    current = await createTestApp({
      seedProfile: 'control-only',
    })
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const endpoints = [
      `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/setup-readiness`,
      `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/resolved-policy`,
      `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/resolved-stage-policy`,
    ]

    const responses = await Promise.all(endpoints.map(url => current!.app.inject({
      method: 'GET',
      url,
      headers: { cookie: adminLogin.cookie },
    })))

    expect(responses.map(response => response.statusCode)).toEqual([404, 404, 404, 404])
    const [proofBatches, proofStudents] = await Promise.all([
      current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select().from(students).where(like(students.studentId, 'mnc_student_%')),
    ])
    expect(proofBatches).toHaveLength(0)
    expect(proofStudents).toHaveLength(0)
  })

  it('supports system-admin initial data loading with empty control-only cohorts', async () => {
    current = await createTestApp({
      seedProfile: 'control-only',
    })
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const endpoints = [
      '/api/admin/institution',
      '/api/admin/academic-faculties',
      '/api/admin/departments',
      '/api/admin/branches',
      '/api/admin/batches',
      '/api/admin/terms',
      '/api/admin/faculty',
      '/api/admin/students',
      '/api/admin/courses',
      '/api/admin/curriculum-courses',
      '/api/admin/policy-overrides',
      '/api/admin/stage-policy-overrides',
      '/api/admin/offerings',
      '/api/admin/offering-ownership',
      '/api/admin/requests',
      '/api/admin/reminders',
    ]

    const responses = await Promise.all(endpoints.map(url => current!.app.inject({
      method: 'GET',
      url,
      headers: { cookie: adminLogin.cookie },
    })))
    expect(responses.map(response => response.statusCode)).toEqual(
      endpoints.map(() => 200),
    )

    const payloads = Object.fromEntries(responses.map((response, index) => [endpoints[index], response.json()]))
    expect(payloads['/api/admin/academic-faculties'].items).toHaveLength(0)
    expect(payloads['/api/admin/departments'].items).toHaveLength(0)
    expect(payloads['/api/admin/branches'].items).toHaveLength(0)
    expect(payloads['/api/admin/batches'].items).toHaveLength(0)
    expect(payloads['/api/admin/terms'].items).toHaveLength(0)
    expect(payloads['/api/admin/students'].items).toHaveLength(0)
    expect(payloads['/api/admin/courses'].items).toHaveLength(0)
    expect(payloads['/api/admin/faculty'].items.map((item: { facultyId: string }) => item.facultyId)).toEqual(['fac_sysadmin'])
  })

  it('materializes proof sandbox data only from an explicit proof import request', async () => {
    current = await createTestApp({
      seedProfile: 'control-only',
    })
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const importResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-imports`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(importResponse.statusCode).toBe(200)

    const [proofBatches, proofStudents] = await Promise.all([
      current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select().from(students).where(like(students.studentId, 'mnc_student_%')),
    ])
    expect(proofBatches).toHaveLength(1)
    expect(proofStudents).toHaveLength(120)
  })

  it('starts the explicit first-six-semester proof import at semester 1 authority', async () => {
    current = await createTestApp({
      seedProfile: 'control-only',
    })
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const importResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-imports`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(importResponse.statusCode).toBe(200)

    const [[proofBatch], [activeRun], termRows] = await Promise.all([
      current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select().from(academicTerms).where(eq(academicTerms.batchId, MSRUAS_PROOF_BATCH_ID)),
    ])

    expect(proofBatch.currentSemester).toBe(6)
    expect(activeRun).toMatchObject({
      semesterStart: 1,
      semesterEnd: 6,
      activeOperationalSemester: 1,
      activeStageKey: 'pre-tt1',
    })
    expect(termRows.find(term => term.semesterNumber === 1)?.status).toBe('active')
    expect(termRows.find(term => term.semesterNumber === 6)?.status).toBe('archived')
  })
})
