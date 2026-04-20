import { sectionOfferings } from '../src/db/schema.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('academic admin offering routes', () => {
  it('rejects stage mutations on the generic offering patch route', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    const [offering] = await current.db.select().from(sectionOfferings)
    expect(offering).toBeTruthy()

    const response = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/offerings/${offering!.offeringId}`,
      headers: {
        cookie: login.cookie,
        origin: TEST_ORIGIN,
      },
      payload: {
        courseId: offering!.courseId,
        termId: offering!.termId,
        branchId: offering!.branchId,
        sectionCode: offering!.sectionCode,
        yearLabel: offering!.yearLabel,
        attendance: offering!.attendance,
        studentCount: offering!.studentCount,
        stage: offering!.stage + 1,
        stageLabel: `${offering!.stageLabel} changed`,
        stageDescription: offering!.stageDescription,
        stageColor: offering!.stageColor,
        tt1Done: offering!.tt1Done === 1,
        tt2Done: offering!.tt2Done === 1,
        tt1Locked: offering!.tt1Locked === 1,
        tt2Locked: offering!.tt2Locked === 1,
        quizLocked: offering!.quizLocked === 1,
        assignmentLocked: offering!.assignmentLocked === 1,
        finalsLocked: offering!.finalsLocked === 1,
        pendingAction: offering!.pendingAction,
        status: offering!.status,
        version: offering!.version,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: 'BAD_REQUEST',
      message: 'Use the dedicated advance-stage flow to change class stage state.',
    })
  })
})
