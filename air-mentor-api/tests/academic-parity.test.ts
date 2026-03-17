import { afterEach, describe, expect, it } from 'vitest'
import platformSeed from '../src/db/seeds/platform.seed.json' with { type: 'json' }
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('academic parity bootstrap', () => {
  it('matches the seeded academic projection exactly for the baseline mock dataset', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 't1', '1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const snapshot = response.json()
    expect(snapshot.professor).toEqual(platformSeed.academicAssets.professor)
    expect(snapshot.faculty).toEqual(platformSeed.academicAssets.faculty)
    expect(snapshot.offerings).toEqual(platformSeed.academicAssets.offerings)
    expect(snapshot.yearGroups).toEqual(platformSeed.academicAssets.yearGroups)
    expect(snapshot.mentees).toEqual(Object.values(platformSeed.academicAssets.menteesByUsn))
    expect(snapshot.teachers).toEqual(platformSeed.academicAssets.teachers)
    expect(snapshot.subjectRuns).toEqual(platformSeed.academicAssets.subjectRuns)
    expect(snapshot.studentsByOffering).toEqual(platformSeed.academicAssets.studentsByOffering)
    expect(snapshot.studentHistoryByUsn).toEqual(platformSeed.academicAssets.studentHistoryByUsn)
    expect(snapshot.runtime).toEqual({
      ...platformSeed.academicAssets.runtime,
      adminCalendarByFacultyId: {},
    })
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
