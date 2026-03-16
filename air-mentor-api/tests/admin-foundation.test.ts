import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('admin foundation routes', () => {
  it('returns 409 conflicts for stale PATCH versions', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const created = await current.app.inject({
      method: 'POST',
      url: '/api/admin/departments',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: 'ECE',
        name: 'Electronics and Communication Engineering',
        status: 'active',
      },
    })
    expect(created.statusCode).toBe(200)
    const department = created.json()

    const firstPatch = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/departments/${department.departmentId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: 'ECE',
        name: 'Electronics Engineering',
        status: 'active',
        version: 1,
      },
    })
    expect(firstPatch.statusCode).toBe(200)

    const conflictPatch = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/departments/${department.departmentId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        code: 'ECE',
        name: 'Electronics and Communication Engineering',
        status: 'inactive',
        version: 1,
      },
    })
    expect(conflictPatch.statusCode).toBe(409)
    expect(conflictPatch.json().error).toBe('CONFLICT')
  })

  it('supports the full admin-request decision flow and emits audit detail', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 't1', '1234')
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    expect(hodGrantId).toBeTruthy()
    const switched = await current.app.inject({
      method: 'POST',
      url: '/api/session/role-context',
      headers: { cookie: hodLogin.cookie, origin: TEST_ORIGIN },
      payload: { roleGrantId: hodGrantId },
    })
    expect(switched.statusCode).toBe(200)

    const created = await current.app.inject({
      method: 'POST',
      url: '/api/admin/requests',
      headers: { cookie: hodLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        requestType: 'master-data correction request',
        scopeType: 'department',
        scopeId: 'dept_cse',
        targetEntityRefs: [{ entityType: 'student', entityId: 'student_001' }],
        priority: 'P2',
        summary: 'Correct student phone number',
        details: 'Phone number is missing country code.',
        dueAt: '2026-03-18T12:00:00.000Z',
        slaPolicyCode: 'P2_STANDARD',
        payload: { field: 'phone' },
      },
    })
    expect(created.statusCode).toBe(200)
    const request = created.json()
    expect(request.status).toBe('New')

    const invalidTransition = await current.app.inject({
      method: 'POST',
      url: `/api/admin/requests/${request.adminRequestId}/mark-implemented`,
      headers: { cookie: hodLogin.cookie, origin: TEST_ORIGIN },
      payload: { version: 1 },
    })
    expect(invalidTransition.statusCode).toBe(403)

    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const assigned = await current.app.inject({
      method: 'POST',
      url: `/api/admin/requests/${request.adminRequestId}/assign`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { version: 1, noteBody: 'Claimed for review.' },
    })
    expect(assigned.statusCode).toBe(200)
    expect(assigned.json().status).toBe('In Review')

    const approved = await current.app.inject({
      method: 'POST',
      url: `/api/admin/requests/${request.adminRequestId}/approve`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { version: 2, noteBody: 'Approved after review.' },
    })
    expect(approved.statusCode).toBe(200)
    expect(approved.json().status).toBe('Approved')

    const implemented = await current.app.inject({
      method: 'POST',
      url: `/api/admin/requests/${request.adminRequestId}/mark-implemented`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { version: 3, noteBody: 'Applied data correction.' },
    })
    expect(implemented.statusCode).toBe(200)
    expect(implemented.json().status).toBe('Implemented')

    const closed = await current.app.inject({
      method: 'POST',
      url: `/api/admin/requests/${request.adminRequestId}/close`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { version: 4, noteBody: 'Closing out request.' },
    })
    expect(closed.statusCode).toBe(200)
    expect(closed.json().status).toBe('Closed')

    const audit = await current.app.inject({
      method: 'GET',
      url: `/api/admin/requests/${request.adminRequestId}/audit`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(audit.statusCode).toBe(200)
    expect(audit.json().transitions).toHaveLength(5)
    expect(audit.json().auditEvents.length).toBeGreaterThanOrEqual(4)
  })
})
