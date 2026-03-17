import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { academicAssets } from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('academic bootstrap', () => {
  it('ignores legacy academic asset snapshots and derives the live view from admin-owned records', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 't1', '1234')

    await current.db.update(academicAssets).set({
      payloadJson: JSON.stringify({
        name: 'Legacy Mock Professor',
        id: 'legacy-professor',
        dept: 'Legacy Department',
        role: 'Legacy Role',
        initials: 'LM',
        email: 'legacy@example.com',
      }),
      version: 99,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicAssets.assetKey, 'professor'))

    await current.db.update(academicAssets).set({
      payloadJson: JSON.stringify([{ facultyId: 'legacy-faculty', name: 'Legacy Faculty', dept: 'LEG', roleTitle: 'Demo', allowedRoles: ['Course Leader'] }]),
      version: 99,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicAssets.assetKey, 'faculty'))

    await current.db.update(academicAssets).set({
      payloadJson: JSON.stringify([{ offId: 'legacy-offering', code: 'LEG101', title: 'Legacy Demo Course' }]),
      version: 99,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicAssets.assetKey, 'offerings'))

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const snapshot = response.json()
    expect(snapshot.professor).toMatchObject({
      id: 't1',
      name: 'Dr. Kavitha Rao',
      dept: 'CSE',
      role: 'Course Leader',
    })
    expect(snapshot.faculty.some((faculty: { facultyId: string }) => faculty.facultyId === 'legacy-faculty')).toBe(false)
    expect(snapshot.offerings.some((offering: { offId: string }) => offering.offId === 'legacy-offering')).toBe(false)
    expect(snapshot.faculty.find((faculty: { facultyId: string }) => faculty.facultyId === 't1')?.allowedRoles).toContain('Course Leader')
    expect(snapshot.offerings.find((offering: { offId: string }) => offering.offId === 'c3-A')?.title).toBe('Design & Analysis of Algorithms')
    expect(snapshot.studentsByOffering['c3-A']?.length ?? 0).toBeGreaterThan(0)
    expect(snapshot.studentHistoryByUsn['1MS23CS001']).toMatchObject({
      usn: '1MS23CS001',
      studentName: 'Aarav Sharma',
    })
    expect(Array.isArray(snapshot.runtime.tasks)).toBe(true)
  })

  it('reflects admin master-data changes into the academic bootstrap on the next fetch', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const academicLogin = await loginAs(current.app, 't1', '1234')

    const coursePatch = await current.app.inject({
      method: 'PATCH',
      url: '/api/admin/courses/c3',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseCode: 'CS401',
        title: 'Algorithms and Performance Engineering',
        defaultCredits: 4,
        departmentId: 'dept_cse',
        status: 'active',
        version: 1,
      },
    })
    expect(coursePatch.statusCode).toBe(200)

    const ownershipPatch = await current.app.inject({
      method: 'PATCH',
      url: '/api/admin/offering-ownership/ownership_t2_c6-A',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        offeringId: 'c6-A',
        facultyId: 't1',
        ownershipRole: 'owner',
        status: 'active',
        version: 1,
      },
    })
    expect(ownershipPatch.statusCode).toBe(200)

    const bootstrap = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: academicLogin.cookie },
    })
    expect(bootstrap.statusCode).toBe(200)
    const snapshot = bootstrap.json()

    expect(snapshot.offerings.find((offering: { offId: string }) => offering.offId === 'c3-A')?.title).toBe('Algorithms and Performance Engineering')
    const t1 = snapshot.faculty.find((faculty: { facultyId: string }) => faculty.facultyId === 't1')
    expect(t1?.offeringIds).toContain('c6-A')
    expect(t1?.courseCodes).toContain('CS601')
  })
})
