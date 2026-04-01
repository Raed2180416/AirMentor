import { afterEach, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import {
  facultyAppointments,
  facultyOfferingOwnerships,
  mentorAssignments,
  roleGrants,
  simulationRuns,
  simulationStageCheckpoints,
  studentObservedSemesterStates,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

async function switchToRole(cookie: string, availableRoleGrants: Array<{ grantId: string; roleCode: string }>, roleCode: string) {
  if (!current) throw new Error('Test app is not initialized')
  const roleGrantId = availableRoleGrants.find(grant => grant.roleCode === roleCode)?.grantId
  expect(roleGrantId).toBeTruthy()
  const response = await current.app.inject({
    method: 'POST',
    url: '/api/session/role-context',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: { roleGrantId },
  })
  expect(response.statusCode).toBe(200)
  return response
}

function getObservedOfferingId(row: { observedStateJson: string }) {
  const payload = JSON.parse(row.observedStateJson) as Record<string, unknown>
  return typeof payload.offeringId === 'string' ? payload.offeringId : null
}

describe('student agent shell', () => {
  it('returns a deterministic card and bounded replies for in-scope course leaders', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const roleResponse = login.body.activeRoleGrant.roleCode === 'COURSE_LEADER'
      ? login.body
      : (await switchToRole(login.cookie, login.body.availableRoleGrants, 'COURSE_LEADER')).json()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    const [selectedCheckpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, 6),
    )).orderBy(asc(simulationStageCheckpoints.stageOrder))
    expect(selectedCheckpoint).toBeTruthy()
    const ownershipRows = await current.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, roleResponse.faculty.facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
    const ownedOfferingIds = new Set(ownershipRows.map(row => row.offeringId))
    expect(ownedOfferingIds.size).toBeGreaterThan(0)
    const observedRows = await current.db.select().from(studentObservedSemesterStates).where(and(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
      eq(studentObservedSemesterStates.semesterNumber, 6),
    ))
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    const [cardResponseOne, cardResponseTwo] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
        headers: { cookie: login.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
        headers: { cookie: login.cookie },
      }),
    ])

    expect(cardResponseOne.statusCode).toBe(200)
    expect(cardResponseTwo.statusCode).toBe(200)
    expect(cardResponseOne.json()).toEqual(cardResponseTwo.json())
    expect(JSON.stringify(cardResponseOne.json())).not.toContain('forgetRate')
    expect(JSON.stringify(cardResponseOne.json())).not.toContain('random')
    expect(JSON.stringify(cardResponseOne.json())).not.toContain('worldContext')

    const checkpointCardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/student-shell/students/${accessibleStudentId}/card?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(checkpointCardResponse.statusCode).toBe(200)
    expect(checkpointCardResponse.json()).toMatchObject({
      simulationStageCheckpointId: selectedCheckpoint.simulationStageCheckpointId,
      scopeDescriptor: {
        scopeType: 'student',
        simulationRunId: activeRun.simulationRunId,
        studentId: accessibleStudentId,
      },
      resolvedFrom: {
        kind: 'proof-checkpoint',
        scopeId: selectedCheckpoint.simulationStageCheckpointId,
      },
      checkpointContext: {
        simulationStageCheckpointId: selectedCheckpoint.simulationStageCheckpointId,
        stageKey: selectedCheckpoint.stageKey,
        stageAdvanceBlocked: expect.any(Boolean),
      },
      counterfactual: {
        panelLabel: 'Policy Derived',
        counterfactualLiftScaled: expect.any(Number),
      },
    })
    expect(checkpointCardResponse.json().scopeMode).toBe('proof')
    expect(checkpointCardResponse.json().countSource).toBe('proof-checkpoint')
    expect(checkpointCardResponse.json().activeOperationalSemester).toBe(6)
    expect(checkpointCardResponse.json().summaryRail.currentRiskDisplayProbabilityAllowed === false
      ? checkpointCardResponse.json().summaryRail.currentRiskSupportWarning
      : true).toBeTruthy()
    expect(checkpointCardResponse.json().summaryRail.currentRiskCalibrationMethod).toBeTruthy()
    expect(checkpointCardResponse.json().summaryRail).toMatchObject({
      riskChangeFromPreviousCheckpointScaled: expect.any(Number),
      counterfactualLiftScaled: expect.any(Number),
    })
    expect(checkpointCardResponse.json().overview.currentEvidence.coEvidenceMode).toBeTruthy()
    expect(checkpointCardResponse.json().overview.currentStatus.policyComparison?.policyPhenotype ?? null).toEqual(expect.any(String))
    expect(JSON.stringify(checkpointCardResponse.json())).not.toContain('worldContextSnapshots')

    const checkpointTimelineResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/student-shell/students/${accessibleStudentId}/timeline?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(checkpointTimelineResponse.statusCode).toBe(200)
    expect(checkpointTimelineResponse.json().items.length).toBeGreaterThan(0)

    const sessionResponse = await current.app.inject({
      method: 'POST',
      url: `/api/academic/student-shell/students/${accessibleStudentId}/sessions`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(sessionResponse.statusCode).toBe(200)
    const session = sessionResponse.json() as { studentAgentSessionId: string; messages: Array<{ messageType: string }> }
    expect(session.messages[0]?.messageType).toBe('intro')

    const [replyOne, replyTwo, blockedReply] = await Promise.all([
      current.app.inject({
        method: 'POST',
        url: `/api/academic/student-shell/sessions/${session.studentAgentSessionId}/messages`,
        headers: { cookie: login.cookie, origin: TEST_ORIGIN },
        payload: { prompt: 'Explain current semester performance' },
      }),
      current.app.inject({
        method: 'POST',
        url: `/api/academic/student-shell/sessions/${session.studentAgentSessionId}/messages`,
        headers: { cookie: login.cookie, origin: TEST_ORIGIN },
        payload: { prompt: 'Explain current semester performance' },
      }),
      current.app.inject({
        method: 'POST',
        url: `/api/academic/student-shell/sessions/${session.studentAgentSessionId}/messages`,
        headers: { cookie: login.cookie, origin: TEST_ORIGIN },
        payload: { prompt: 'Will this student definitely pass next semester?' },
      }),
    ])

    expect(replyOne.statusCode).toBe(200)
    expect(replyTwo.statusCode).toBe(200)
    expect(blockedReply.statusCode).toBe(200)

    const replyItemsOne = replyOne.json().items as Array<{ actorType: string; body: string; citations: unknown[] }>
    const replyItemsTwo = replyTwo.json().items as Array<{ actorType: string; body: string; citations: unknown[] }>
    const blockedItems = blockedReply.json().items as Array<{ actorType: string; guardrailCode: string | null; citations: Array<{ citationId: string }> }>
    expect(replyItemsOne[1]?.actorType).toBe('assistant')
    expect(replyItemsTwo[1]?.actorType).toBe('assistant')
    expect(replyItemsOne[1]?.body).toBe(replyItemsTwo[1]?.body)
    expect(replyItemsOne[1]?.citations).toEqual(replyItemsTwo[1]?.citations)
    expect(blockedItems[1]?.guardrailCode).toBe('no-future-certainty')
    expect(blockedItems[1]?.citations[0]?.citationId).toBe('guardrail-scope')

    const checkpointSessionResponse = await current.app.inject({
      method: 'POST',
      url: `/api/academic/student-shell/students/${accessibleStudentId}/sessions`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { simulationStageCheckpointId: selectedCheckpoint.simulationStageCheckpointId },
    })
    expect(checkpointSessionResponse.statusCode).toBe(200)
    expect(checkpointSessionResponse.json()).toMatchObject({
      simulationStageCheckpointId: selectedCheckpoint.simulationStageCheckpointId,
    })
    const checkpointReply = await current.app.inject({
      method: 'POST',
      url: `/api/academic/student-shell/sessions/${checkpointSessionResponse.json().studentAgentSessionId}/messages`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { prompt: 'Explain the no action comparator for this checkpoint' },
    })
    expect(checkpointReply.statusCode).toBe(200)
    const checkpointItems = checkpointReply.json().items as Array<{ body: string }>
    expect(checkpointItems[1]?.body.toLowerCase()).toContain('no-action comparator')
  })

  it('enforces mentor and HoD scope and allows system admin archived-run inspection', async () => {
    current = await createTestApp()
    const mentorLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const mentorRole = mentorLogin.body.activeRoleGrant.roleCode === 'MENTOR'
      ? mentorLogin.body
      : (await switchToRole(mentorLogin.cookie, mentorLogin.body.availableRoleGrants, 'MENTOR')).json()

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    const mentorRows = await current.db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, mentorRole.faculty.facultyId))
    const assignedStudentId = mentorRows.find(row => row.effectiveTo === null)?.studentId
    expect(assignedStudentId).toBeTruthy()
    const allObserved = await current.db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId))
    const unassignedStudentId = allObserved.find(row => row.studentId !== assignedStudentId)?.studentId
    expect(unassignedStudentId).toBeTruthy()

    const [mentorAllowed, mentorBlocked] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${assignedStudentId}/card`,
        headers: { cookie: mentorLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${unassignedStudentId}/card`,
        headers: { cookie: mentorLogin.cookie },
      }),
    ])
    expect(mentorAllowed.statusCode).toBe(200)
    expect(mentorBlocked.statusCode).toBe(403)

    const outsideHodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const outsideHodRole = outsideHodLogin.body.activeRoleGrant.roleCode === 'HOD'
      ? outsideHodLogin.body
      : (await switchToRole(outsideHodLogin.cookie, outsideHodLogin.body.availableRoleGrants, 'HOD')).json()
    expect(outsideHodRole.activeRoleGrant.roleCode).toBe('HOD')
    const outsideHodGrantId = outsideHodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    const outsideHodFacultyId = (outsideHodRole.activeRoleGrant as { facultyId?: string | null }).facultyId
    expect(outsideHodGrantId).toBeTruthy()
    expect(outsideHodFacultyId).toBeTruthy()
    await current.db.update(facultyAppointments).set({
      departmentId: 'dept_ece',
      branchId: 'branch_ece_btech',
    }).where(eq(facultyAppointments.facultyId, outsideHodFacultyId!))
    await current.db.update(roleGrants).set({
      scopeId: 'dept_ece',
    }).where(eq(roleGrants.grantId, outsideHodGrantId!))
    const outsideHodResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/student-shell/students/${assignedStudentId}/card`,
      headers: { cookie: outsideHodLogin.cookie },
    })
    expect(outsideHodResponse.statusCode).toBe(403)

    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    await current.db.update(simulationRuns).set({
      activeFlag: 0,
      status: 'archived',
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))
    const adminResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/student-shell/students/${assignedStudentId}/card?simulationRunId=${encodeURIComponent(activeRun.simulationRunId)}`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(adminResponse.statusCode).toBe(200)
    expect(adminResponse.json().simulationRunId).toBe(activeRun.simulationRunId)
  })

  it('allows HOD student shell access when the active role grant remains in scope after appointment drift', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const hodRole = hodLogin.body.activeRoleGrant.roleCode === 'HOD'
      ? hodLogin.body
      : (await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')).json()
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    const hodFacultyId = (hodRole.activeRoleGrant as { facultyId?: string | null }).facultyId
    expect(hodGrantId).toBeTruthy()
    expect(hodFacultyId).toBeTruthy()

    const hodStudentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-students',
      headers: { cookie: hodLogin.cookie },
    })
    expect(hodStudentsResponse.statusCode).toBe(200)
    const accessibleStudentId = (hodStudentsResponse.json().items as Array<{ studentId: string }>)[0]?.studentId
    expect(accessibleStudentId).toBeTruthy()

    await current.db.update(facultyAppointments).set({
      departmentId: 'dept_ece',
      branchId: 'branch_ece_btech',
    }).where(eq(facultyAppointments.facultyId, hodFacultyId!))
    await current.db.update(roleGrants).set({
      scopeType: 'department',
      scopeId: 'dept_cse',
    }).where(eq(roleGrants.grantId, hodGrantId!))

    const response = await current.app.inject({
      method: 'GET',
      url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
      headers: { cookie: hodLogin.cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      student: {
        studentId: accessibleStudentId,
      },
    })
  })

  it('allows HOD student shell access when a second active HoD grant matches the proof department', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const hodRole = hodLogin.body.activeRoleGrant.roleCode === 'HOD'
      ? hodLogin.body
      : (await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')).json()
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    const hodFacultyId = (hodRole.activeRoleGrant as { facultyId?: string | null }).facultyId
    expect(hodGrantId).toBeTruthy()
    expect(hodFacultyId).toBeTruthy()

    const hodStudentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-students',
      headers: { cookie: hodLogin.cookie },
    })
    expect(hodStudentsResponse.statusCode).toBe(200)
    const accessibleStudentId = (hodStudentsResponse.json().items as Array<{ studentId: string }>)[0]?.studentId
    expect(accessibleStudentId).toBeTruthy()

    await current.db.update(facultyAppointments).set({
      departmentId: 'dept_ece',
      branchId: 'branch_ece_btech',
    }).where(eq(facultyAppointments.facultyId, hodFacultyId!))
    await current.db.update(roleGrants).set({
      scopeType: 'department',
      scopeId: 'dept_ece',
    }).where(eq(roleGrants.grantId, hodGrantId!))
    await current.db.insert(roleGrants).values({
      grantId: 'grant_hod_test_mnc_shell_scope',
      facultyId: hodFacultyId!,
      roleCode: 'HOD',
      scopeType: 'department',
      scopeId: 'dept_cse',
      startDate: '2026-03-16',
      endDate: null,
      status: 'active',
      version: 1,
      createdAt: '2026-03-16T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z',
    })

    const response = await current.app.inject({
      method: 'GET',
      url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
      headers: { cookie: hodLogin.cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      student: {
        studentId: accessibleStudentId,
      },
    })
  })

  it('uses the activated proof semester for the default student shell while keeping checkpoint playback separate', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const roleResponse = login.body.activeRoleGrant.roleCode === 'COURSE_LEADER'
      ? login.body
      : (await switchToRole(login.cookie, login.body.availableRoleGrants, 'COURSE_LEADER')).json()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    const recomputeRiskResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeRiskResponse.statusCode).toBe(200)
    const checkpointRows = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
    ).orderBy(asc(simulationStageCheckpoints.semesterNumber), asc(simulationStageCheckpoints.stageOrder))
    const playbackCheckpoint = checkpointRows.find(row => row.semesterNumber > 4) ?? checkpointRows.at(-1)
    expect(playbackCheckpoint).toBeTruthy()

    const activateSemesterResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/activate-semester`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { semesterNumber: 4 },
    })
    expect(activateSemesterResponse.statusCode).toBe(200)

    const ownershipRows = await current.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, roleResponse.faculty.facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
    const ownedOfferingIds = new Set(ownershipRows.map(row => row.offeringId))
    const observedRows = await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    )
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    const [defaultCardResponse, checkpointCardResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
        headers: { cookie: login.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${accessibleStudentId}/card?simulationStageCheckpointId=${encodeURIComponent(playbackCheckpoint!.simulationStageCheckpointId)}`,
        headers: { cookie: login.cookie },
      }),
    ])

    expect(defaultCardResponse.statusCode).toBe(200)
    expect(checkpointCardResponse.statusCode).toBe(200)
    expect(defaultCardResponse.json().countSource).toBe('proof-run')
    expect(defaultCardResponse.json().activeOperationalSemester).toBe(4)
    expect(defaultCardResponse.json().student.currentSemester).toBe(4)
    expect(checkpointCardResponse.json().countSource).toBe('proof-checkpoint')
    expect(checkpointCardResponse.json().simulationStageCheckpointId).toBe(playbackCheckpoint!.simulationStageCheckpointId)
    expect(checkpointCardResponse.json().activeOperationalSemester).toBe(4)
    expect(checkpointCardResponse.json().student.currentSemester).toBe(playbackCheckpoint!.semesterNumber)
  })

  it('keeps the default student shell aligned with activated semesters 1 through 3', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const roleResponse = login.body.activeRoleGrant.roleCode === 'COURSE_LEADER'
      ? login.body
      : (await switchToRole(login.cookie, login.body.availableRoleGrants, 'COURSE_LEADER')).json()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    const checkpointRows = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
    ).orderBy(asc(simulationStageCheckpoints.semesterNumber), asc(simulationStageCheckpoints.stageOrder))
    const ownershipRows = await current.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, roleResponse.faculty.facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
    const ownedOfferingIds = new Set(ownershipRows.map(row => row.offeringId))
    const observedRows = await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    )
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    for (const semesterNumber of [1, 2, 3] as const) {
      const checkpoint = checkpointRows.find(row => row.semesterNumber === semesterNumber)
      expect(checkpoint).toBeTruthy()

      const activateSemesterResponse = await current.app.inject({
        method: 'POST',
        url: `/api/admin/proof-runs/${activeRun.simulationRunId}/activate-semester`,
        headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
        payload: { semesterNumber },
      })
      expect(activateSemesterResponse.statusCode).toBe(200)

      const [defaultCardResponse, checkpointCardResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${accessibleStudentId}/card?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
      ])

      expect(defaultCardResponse.statusCode).toBe(200)
      expect(checkpointCardResponse.statusCode).toBe(200)
      expect(defaultCardResponse.json().countSource).toBe('proof-run')
      expect(defaultCardResponse.json().activeOperationalSemester).toBe(semesterNumber)
      expect(defaultCardResponse.json().student.currentSemester).toBe(semesterNumber)
      expect(checkpointCardResponse.json().countSource).toBe('proof-checkpoint')
      expect(checkpointCardResponse.json().simulationStageCheckpointId).toBe(checkpoint!.simulationStageCheckpointId)
      expect(checkpointCardResponse.json().activeOperationalSemester).toBe(semesterNumber)
      expect(checkpointCardResponse.json().student.currentSemester).toBe(semesterNumber)
    }
  })

  it('keeps the default student shell aligned with activated semesters 4 through 6 using the late checkpoint walk', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const roleResponse = login.body.activeRoleGrant.roleCode === 'COURSE_LEADER'
      ? login.body
      : (await switchToRole(login.cookie, login.body.availableRoleGrants, 'COURSE_LEADER')).json()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    const checkpointRows = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
    ).orderBy(asc(simulationStageCheckpoints.semesterNumber), asc(simulationStageCheckpoints.stageOrder))
    const ownershipRows = await current.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, roleResponse.faculty.facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
    const ownedOfferingIds = new Set(ownershipRows.map(row => row.offeringId))
    const observedRows = await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    )
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    for (const semesterNumber of [4, 5, 6] as const) {
      const checkpoint = checkpointRows.filter(row => row.semesterNumber === semesterNumber).at(-1)
      expect(checkpoint).toBeTruthy()
      expect(checkpoint?.stageKey).toBe('post-see')

      const activateSemesterResponse = await current.app.inject({
        method: 'POST',
        url: `/api/admin/proof-runs/${activeRun.simulationRunId}/activate-semester`,
        headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
        payload: { semesterNumber },
      })
      expect(activateSemesterResponse.statusCode).toBe(200)

      const [defaultCardResponse, checkpointCardResponse, dashboardResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${accessibleStudentId}/card?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/admin/batches/${activeRun.batchId}/proof-dashboard`,
          headers: { cookie: adminLogin.cookie },
        }),
      ])

      expect(defaultCardResponse.statusCode).toBe(200)
      expect(checkpointCardResponse.statusCode).toBe(200)
      expect(dashboardResponse.statusCode).toBe(200)
      expect(defaultCardResponse.json().countSource).toBe('proof-run')
      expect(defaultCardResponse.json().activeOperationalSemester).toBe(semesterNumber)
      expect(defaultCardResponse.json().student.currentSemester).toBe(semesterNumber)
      const checkpointPayload = checkpointCardResponse.json()
      const dashboardCheckpoint = dashboardResponse.json().activeRunDetail?.checkpoints?.find(
        (item: { simulationStageCheckpointId: string }) => item.simulationStageCheckpointId === checkpoint!.simulationStageCheckpointId,
      )
      expect(dashboardCheckpoint).toBeTruthy()
      expect(checkpointPayload.countSource).toBe('proof-checkpoint')
      expect(checkpointPayload.simulationStageCheckpointId).toBe(checkpoint!.simulationStageCheckpointId)
      expect(checkpointPayload.activeOperationalSemester).toBe(semesterNumber)
      expect(checkpointPayload.student.currentSemester).toBe(semesterNumber)
      expect(checkpointPayload.checkpointContext?.stageKey).toBe('post-see')
      expect(checkpointPayload.checkpointContext?.stageAdvanceBlocked).toBe(dashboardCheckpoint?.stageAdvanceBlocked)
      expect(checkpointPayload.checkpointContext?.playbackAccessible).toBe(dashboardCheckpoint?.playbackAccessible)
      expect(checkpointPayload.checkpointContext?.blockedByCheckpointId ?? null).toBe(dashboardCheckpoint?.blockedByCheckpointId ?? null)
      expect(checkpointPayload.checkpointContext?.blockedProgressionReason ?? null).toBe(dashboardCheckpoint?.blockedProgressionReason ?? null)
      expect(checkpointPayload.counterfactual?.counterfactualLiftScaled).toEqual(expect.any(Number))
      expect(checkpointPayload.overview.currentStatus.policyComparison?.counterfactualLiftScaled ?? checkpointPayload.counterfactual?.counterfactualLiftScaled).toEqual(expect.any(Number))
      if (semesterNumber < 6) {
        expect(checkpointPayload.summaryRail.electiveFit).toBeNull()
      } else {
        expect(checkpointPayload.summaryRail.electiveFit).toMatchObject({
          recommendedCode: expect.any(String),
          recommendedTitle: expect.any(String),
          stream: expect.any(String),
        })
      }
    }
  })
})
