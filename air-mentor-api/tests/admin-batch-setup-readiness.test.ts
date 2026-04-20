import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  batches,
  curriculumCourses,
  facultyAppointments,
  roleGrants,
  studentEnrollments,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('GET /api/admin/batches/:batchId/setup-readiness', () => {
  it('returns 404 for unknown batch', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/nonexistent_batch/setup-readiness',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns ready=true with empty blockers for fully-seeded batch', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/setup-readiness',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.blockers).toBeInstanceOf(Array)
    expect(body.ready).toBe(body.blockers.length === 0)
    expect(typeof body.batchLabel).toBe('string')
  })

  it('reports curriculum blocker when all curriculum rows are archived', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    await current.db.update(curriculumCourses)
      .set({ status: 'archived' })
      .where(eq(curriculumCourses.batchId, 'batch_branch_mnc_btech_2023'))

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/setup-readiness',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ready).toBe(false)
    expect(body.blockers.some((b: string) => b.includes('curriculum rows'))).toBe(true)
  })

  it('reports faculty blocker when all branch appointments are archived', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [batch] = await current.db.select().from(batches)
      .where(eq(batches.batchId, 'batch_branch_mnc_btech_2023'))
    expect(batch).toBeTruthy()

    await current.db.update(facultyAppointments)
      .set({ status: 'archived' })
      .where(eq(facultyAppointments.branchId, batch!.branchId))

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/setup-readiness',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ready).toBe(false)
    expect(body.blockers.some((b: string) => b.includes('faculty appointments'))).toBe(true)
  })

  it('reports mentor blocker when no MENTOR grants exist for batch or branch', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    await current.db.update(roleGrants)
      .set({ status: 'archived' })
      .where(eq(roleGrants.roleCode, 'MENTOR'))

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/setup-readiness',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ready).toBe(false)
    expect(body.blockers.some((b: string) => b.includes('mentor-ready'))).toBe(true)
  })

  it('respects optional sectionCode filter and still returns valid response', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/setup-readiness?sectionCode=A',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(Array.isArray(body.blockers)).toBe(true)
    expect(typeof body.ready).toBe('boolean')
  })

  it('reports students blocker when all enrollments are ended', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [batch] = await current.db.select().from(batches)
      .where(eq(batches.batchId, 'batch_branch_mnc_btech_2023'))
    expect(batch).toBeTruthy()

    const batchTermRows = await current.db.select().from(
      (await import('../src/db/schema.js')).academicTerms,
    ).where(eq((await import('../src/db/schema.js')).academicTerms.batchId, 'batch_branch_mnc_btech_2023'))
    const termIds = batchTermRows.map(t => t.termId)

    if (termIds.length > 0) {
      const { inArray } = await import('drizzle-orm')
      await current.db.update(studentEnrollments)
        .set({ endDate: '2025-01-01' })
        .where(inArray(studentEnrollments.termId, termIds))
    }

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/setup-readiness',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ready).toBe(false)
    expect(body.blockers.some((b: string) =>
      b.includes('student(s) still need an active enrollment') || b.includes('student(s) still need a mentor'),
    )).toBe(true)
  })

  it('requires SYSTEM_ADMIN role', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const hodGrantId = hodLogin.body.availableRoleGrants.find(
      (g: { roleCode: string }) => g.roleCode === 'HOD',
    )?.grantId
    await current.app.inject({
      method: 'POST',
      url: '/api/session/role-context',
      headers: { cookie: hodLogin.cookie, origin: TEST_ORIGIN },
      payload: { roleGrantId: hodGrantId },
    })

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/setup-readiness',
      headers: { cookie: hodLogin.cookie },
    })

    expect(response.statusCode).toBe(403)
  })
})
