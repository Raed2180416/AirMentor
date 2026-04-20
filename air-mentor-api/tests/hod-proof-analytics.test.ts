import { afterEach, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import { facultyAppointments, roleGrants, simulationRuns, simulationStageCheckpoints } from '../src/db/schema.js'
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

describe('hod proof analytics', () => {
  it('serves live in-scope HoD analytics and reconciles with dashboard and faculty profile', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

    const [summaryResponse, coursesResponse, facultyResponse, studentsResponse, reassessmentsResponse, dashboardResponse, profileResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-summary',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-courses',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-faculty',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-reassessments',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/admin/batches/batch_branch_mnc_btech_2023/proof-dashboard',
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/faculty-profile/mnc_t1',
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(coursesResponse.statusCode).toBe(200)
    expect(facultyResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(reassessmentsResponse.statusCode).toBe(200)
    expect(dashboardResponse.statusCode).toBe(200)
    expect(profileResponse.statusCode).toBe(200)

    const summary = summaryResponse.json()
    const courses = coursesResponse.json().items as Array<{ courseCode: string }>
    const faculty = facultyResponse.json().items as Array<{ facultyId: string; queueLoad: number }>
    const students = studentsResponse.json().items as Array<{
      studentId: string
      sectionCode: string
      currentRiskBand: string
      evidenceTimeline: Array<{ semesterNumber: number }>
      observedEvidence: {
        tt2Pct: number
        seePct: number
        weakCoCount: number
        weakQuestionCount: number
      }
    }>
    const reassessments = reassessmentsResponse.json().items as Array<{ status: string }>
    const dashboard = dashboardResponse.json()
    const profile = profileResponse.json()

    expect(summary.activeRunContext).not.toBeNull()
    expect(summary.scopeDescriptor).toMatchObject({
      scopeType: 'proof',
      simulationRunId: summary.activeRunContext.simulationRunId,
    })
    expect(summary.resolvedFrom).toMatchObject({
      kind: 'proof-run',
      scopeType: 'proof',
      scopeId: summary.activeRunContext.simulationRunId,
    })
    expect(summary.scopeMode).toBe('proof')
    expect(summary.countSource).toBe('proof-run')
    expect(summary.activeOperationalSemester).toBe(6)
    expect(summary.activeRunContext.simulationRunId).toBe(dashboard.activeRunDetail.simulationRunId)
    expect(summary.monitoringSummary.riskAssessmentCount).toBe(dashboard.activeRunDetail.monitoringSummary.riskAssessmentCount)
    expect(summary.monitoringSummary.activeReassessmentCount).toBe(dashboard.activeRunDetail.monitoringSummary.activeReassessmentCount)
    expect(summary.monitoringSummary.alertDecisionCount).toBe(dashboard.activeRunDetail.monitoringSummary.alertDecisionCount)
    expect(summary.totals.studentsCovered).toBeGreaterThan(0)
    expect(courses.length).toBeGreaterThan(0)
    expect(faculty.length).toBeGreaterThan(0)
    expect(students.length).toBeGreaterThan(0)
    expect(reassessments.length).toBeGreaterThan(0)
    expect(students[0]?.evidenceTimeline.length).toBeGreaterThanOrEqual(6)
    expect(students[0]?.evidenceTimeline[0]?.semesterNumber).toBe(1)
    expect(courses[0]).toEqual(expect.objectContaining({
      tt2WeakCount: expect.any(Number),
      seeWeakCount: expect.any(Number),
      weakQuestionSignalCount: expect.any(Number),
    }))
    expect(students[0]?.observedEvidence).toEqual(expect.objectContaining({
      tt2Pct: expect.any(Number),
      seePct: expect.any(Number),
      weakCoCount: expect.any(Number),
      weakQuestionCount: expect.any(Number),
    }))
    expect(students[0]?.observedEvidence).toHaveProperty('coEvidenceMode')
    expect(students[0]?.observedEvidence).not.toHaveProperty('forgetRate')
    expect(summary.totals.highRiskCount).toBe(students.filter(row => row.currentRiskBand === 'High').length)
    expect(summary.totals.mediumRiskCount).toBe(students.filter(row => row.currentRiskBand === 'Medium').length)
    for (const sectionRow of summary.sectionComparison as Array<{
      sectionCode: string
      studentCount: number
      highRiskCount: number
      mediumRiskCount: number
    }>) {
      expect(sectionRow.studentCount).toBe(students.filter(row => row.sectionCode === sectionRow.sectionCode).length)
      expect(sectionRow.highRiskCount).toBe(students.filter(row => row.sectionCode === sectionRow.sectionCode && row.currentRiskBand === 'High').length)
      expect(sectionRow.mediumRiskCount).toBe(students.filter(row => row.sectionCode === sectionRow.sectionCode && row.currentRiskBand === 'Medium').length)
    }

    const hodFacultyRow = faculty.find(row => row.facultyId === 'mnc_t1')
    expect(hodFacultyRow).toBeTruthy()
    expect(hodFacultyRow?.queueLoad).toBe(profile.proofOperations.monitoringQueue.length)
  })

  it('keeps a department-scoped HoD in scope even when the active proof batch is on a sibling branch', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

    const [summaryResponse, studentsResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-summary',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students',
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(summaryResponse.json().activeRunContext).not.toBeNull()
    expect(summaryResponse.json().scope.departmentNames).toContain('Computer Science and Engineering')
    expect(studentsResponse.json().items.length).toBeGreaterThan(0)
  })

  it('keeps an in-scope HoD role grant authoritative when faculty appointments drift out of scope', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    const hodFacultyId = (hodLogin.body.activeRoleGrant as { facultyId?: string | null }).facultyId

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }
    expect(hodGrantId).toBeTruthy()
    expect(hodFacultyId).toBeTruthy()

    await current.db.update(facultyAppointments).set({
      departmentId: 'dept_ece',
      branchId: 'branch_ece_btech',
    }).where(eq(facultyAppointments.facultyId, hodFacultyId!))
    await current.db.update(roleGrants).set({
      scopeType: 'department',
      scopeId: 'dept_cse',
    }).where(eq(roleGrants.grantId, hodGrantId!))

    const [summaryResponse, studentsResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-summary',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students',
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(summaryResponse.json().activeRunContext).not.toBeNull()
    expect(summaryResponse.json().scope.departmentNames).toContain('Computer Science and Engineering')
    expect(studentsResponse.json().items.length).toBeGreaterThan(0)
  })

  it('keeps HoD analytics in scope when another active HoD grant matches the proof department', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    const hodFacultyId = (hodLogin.body.activeRoleGrant as { facultyId?: string | null }).facultyId

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }
    expect(hodGrantId).toBeTruthy()
    expect(hodFacultyId).toBeTruthy()

    await current.db.update(facultyAppointments).set({
      departmentId: 'dept_ece',
      branchId: 'branch_ece_btech',
    }).where(eq(facultyAppointments.facultyId, hodFacultyId!))
    await current.db.update(roleGrants).set({
      scopeType: 'department',
      scopeId: 'dept_ece',
    }).where(eq(roleGrants.grantId, hodGrantId!))
    await current.db.insert(roleGrants).values({
      grantId: 'grant_hod_test_mnc_scope',
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

    const [summaryResponse, studentsResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-summary',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students',
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(summaryResponse.json().activeRunContext).not.toBeNull()
    expect(summaryResponse.json().scope.departmentNames).toContain('Computer Science and Engineering')
    expect(studentsResponse.json().items.length).toBeGreaterThan(0)
  })

  it('returns an empty view for HODs outside the active proof department scope', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    const hodFacultyId = (hodLogin.body.activeRoleGrant as { facultyId?: string | null }).facultyId

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }
    expect(hodGrantId).toBeTruthy()
    expect(hodFacultyId).toBeTruthy()

    await current.db.update(facultyAppointments).set({
      departmentId: 'dept_ece',
      branchId: 'branch_ece_btech',
    }).where(eq(facultyAppointments.facultyId, hodFacultyId!))
    await current.db.update(roleGrants).set({
      scopeId: 'dept_ece',
    }).where(eq(roleGrants.grantId, hodGrantId!))

    const [summaryResponse, studentsResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-summary',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students',
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(summaryResponse.json().activeRunContext).toBeNull()
    expect(studentsResponse.json().items).toEqual([])
  })

  it('supports deterministic filtering for section, risk band, and reassessment status', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

    const baseStudentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-students',
      headers: { cookie: hodLogin.cookie },
    })
    expect(baseStudentsResponse.statusCode).toBe(200)
    const baseStudents = baseStudentsResponse.json().items as Array<{ primaryCourseCode: string }>
    expect(baseStudents.length).toBeGreaterThan(0)
    const primaryCourseCode = baseStudents[0]?.primaryCourseCode
    expect(primaryCourseCode).toBeTruthy()

    const [sectionResponse, riskResponse, courseResponse, reassessmentResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students?section=A',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students?riskBand=High',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-courses?courseCode=${encodeURIComponent(primaryCourseCode ?? '')}`,
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-reassessments?status=Open',
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(sectionResponse.statusCode).toBe(200)
    expect(riskResponse.statusCode).toBe(200)
    expect(courseResponse.statusCode).toBe(200)
    expect(reassessmentResponse.statusCode).toBe(200)

    const sectionStudents = sectionResponse.json().items as Array<{ sectionCode: string }>
    const highRiskStudents = riskResponse.json().items as Array<{ currentRiskBand: string }>
    const filteredCourses = courseResponse.json().items as Array<{ courseCode: string }>
    const openReassessments = reassessmentResponse.json().items as Array<{ status: string }>

    expect(sectionStudents.length).toBeGreaterThan(0)
    expect(sectionStudents.every(item => item.sectionCode === 'A')).toBe(true)
    expect(highRiskStudents.length).toBeGreaterThan(0)
    expect(highRiskStudents.every(item => item.currentRiskBand === 'High')).toBe(true)
    expect(filteredCourses).toEqual([
      expect.objectContaining({ courseCode: primaryCourseCode }),
    ])
    expect(openReassessments.length).toBeGreaterThan(0)
    expect(openReassessments.every(item => item.status === 'Open')).toBe(true)
  })

  it('projects checkpoint-scoped HoD analytics without exposing no-action comparator fields', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    const [checkpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, 6),
    )).orderBy(asc(simulationStageCheckpoints.stageOrder))
    expect(checkpoint).toBeTruthy()

    const [summaryResponse, studentsResponse, facultyResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-summary?simulationStageCheckpointId=${encodeURIComponent(checkpoint.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-students?simulationStageCheckpointId=${encodeURIComponent(checkpoint.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-faculty?simulationStageCheckpointId=${encodeURIComponent(checkpoint.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(facultyResponse.statusCode).toBe(200)
    expect(summaryResponse.json().resolvedFrom).toMatchObject({
      kind: 'proof-checkpoint',
      scopeType: 'proof',
      scopeId: checkpoint.simulationStageCheckpointId,
    })
    expect(summaryResponse.json().countSource).toBe('proof-checkpoint')
    expect(summaryResponse.json().activeOperationalSemester).toBe(6)
    expect(summaryResponse.json().activeRunContext?.checkpointContext).toMatchObject({
      simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
      stageKey: checkpoint.stageKey,
    })
    expect(
      summaryResponse.json().backlogDistribution.reduce((sum: number, row: { studentCount: number }) => sum + row.studentCount, 0),
    ).toBe(summaryResponse.json().totals.studentsCovered)
    expect(studentsResponse.json().items.length).toBeGreaterThan(0)
    expect(summaryResponse.json().totals.highRiskCount).toBe(
      studentsResponse.json().items.filter((row: { currentRiskBand: string }) => row.currentRiskBand === 'High').length,
    )
    expect(summaryResponse.json().totals.mediumRiskCount).toBe(
      studentsResponse.json().items.filter((row: { currentRiskBand: string }) => row.currentRiskBand === 'Medium').length,
    )
    expect(studentsResponse.json().items[0]).toEqual(expect.objectContaining({
      riskChangeFromPreviousCheckpointScaled: expect.any(Number),
      counterfactualLiftScaled: expect.any(Number),
    }))
    expect(studentsResponse.json().items[0]?.observedEvidence).toHaveProperty('coEvidenceMode')
    expect(JSON.stringify(studentsResponse.json())).not.toContain('noActionRiskProbScaled')
    expect(facultyResponse.json().items.length).toBeGreaterThan(0)
  }, 300000)

  it('keeps explicit checkpoint playback available even if the run active flag drifts off', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    const recomputeRiskResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeRiskResponse.statusCode).toBe(200)
    const [checkpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, 6),
    )).orderBy(asc(simulationStageCheckpoints.stageOrder))
    expect(checkpoint).toBeTruthy()

    await current.db.update(simulationRuns).set({
      activeFlag: 0,
      status: 'archived',
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))

    const [summaryResponse, studentsResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-summary?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-students?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(summaryResponse.json().countSource).toBe('proof-checkpoint')
    expect(summaryResponse.json().activeRunContext).toMatchObject({
      simulationRunId: activeRun.simulationRunId,
      status: 'archived',
      checkpointContext: {
        simulationStageCheckpointId: checkpoint!.simulationStageCheckpointId,
      },
    })
    expect(studentsResponse.json().items.length).toBeGreaterThan(0)
  }, 300000)

  it('does not expose inactive runs in the HoD summary', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

    await current.db.update(simulationRuns).set({
      activeFlag: 0,
      status: 'archived',
      updatedAt: '2026-03-16T00:00:00.000Z',
    })

    const summaryResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-summary',
      headers: { cookie: hodLogin.cookie },
    })

    expect(summaryResponse.statusCode).toBe(200)
    expect(summaryResponse.json().activeRunContext).toBeNull()
    expect(summaryResponse.json().totals.studentsCovered).toBe(0)
  })

  it('uses the activated proof semester as the default HoD slice while keeping checkpoint playback separate', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

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

    const [summaryResponse, studentsResponse, checkpointSummaryResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-summary',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students',
        headers: { cookie: hodLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-summary?simulationStageCheckpointId=${encodeURIComponent(playbackCheckpoint!.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      }),
    ])

    expect(summaryResponse.statusCode).toBe(200)
    expect(studentsResponse.statusCode).toBe(200)
    expect(checkpointSummaryResponse.statusCode).toBe(200)
    const summaryPayload = summaryResponse.json()
    expect(summaryPayload.activeOperationalSemester).toBe(4)
    expect(['proof-run', 'proof-checkpoint']).toContain(summaryPayload.countSource)
    if (summaryPayload.countSource === 'proof-checkpoint') {
      expect(summaryPayload.activeRunContext?.checkpointContext?.semesterNumber).toBe(4)
    } else {
      expect(summaryPayload.activeRunContext?.checkpointContext).toBeUndefined()
    }
    expect(studentsResponse.json().items.length).toBeGreaterThan(0)
    expect(studentsResponse.json().items.every((item: { currentSemester: number }) => item.currentSemester === 4)).toBe(true)
    expect(checkpointSummaryResponse.json().countSource).toBe('proof-checkpoint')
    expect(checkpointSummaryResponse.json().activeOperationalSemester).toBe(playbackCheckpoint!.semesterNumber)
    expect(checkpointSummaryResponse.json().activeRunContext?.checkpointContext?.simulationStageCheckpointId).toBe(playbackCheckpoint!.simulationStageCheckpointId)
  })

  it('keeps the default HoD slice aligned with activated semesters 1 through 3', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

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

      const summaryResponse = await current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-summary',
        headers: { cookie: hodLogin.cookie },
      })
      const checkpointSummaryResponse = await current.app.inject({
        method: 'GET',
        url: `/api/academic/hod/proof-summary?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
        headers: { cookie: hodLogin.cookie },
      })
      const studentsResponse = await current.app.inject({
        method: 'GET',
        url: '/api/academic/hod/proof-students',
        headers: { cookie: hodLogin.cookie },
      })

      expect(summaryResponse.statusCode).toBe(200)
      expect(checkpointSummaryResponse.statusCode).toBe(200)
      expect(studentsResponse.statusCode).toBe(200)
      const summaryPayload = summaryResponse.json()
      const studentsPayload = studentsResponse.json()
      expect(['proof-run', 'proof-checkpoint']).toContain(summaryPayload.countSource)
      expect(summaryPayload.activeOperationalSemester).toBe(semesterNumber)
      if (summaryPayload.countSource === 'proof-checkpoint') {
        expect(summaryPayload.activeRunContext?.checkpointContext?.semesterNumber).toBe(semesterNumber)
      } else {
        expect(summaryPayload.activeRunContext?.checkpointContext).toBeUndefined()
      }
      expect(studentsPayload.items.every((item: { currentSemester: number }) => item.currentSemester === semesterNumber)).toBe(true)
      expect(summaryPayload.totals.studentsCovered).toBe(studentsPayload.items.length)
      expect(summaryPayload.totals.highRiskCount).toBe(
        studentsPayload.items.filter((item: { currentRiskBand: string }) => item.currentRiskBand === 'High').length,
      )
      expect(summaryPayload.totals.mediumRiskCount).toBe(
        studentsPayload.items.filter((item: { currentRiskBand: string }) => item.currentRiskBand === 'Medium').length,
      )
      expect(checkpointSummaryResponse.json().countSource).toBe('proof-checkpoint')
      expect(checkpointSummaryResponse.json().activeOperationalSemester).toBe(semesterNumber)
      expect(checkpointSummaryResponse.json().activeRunContext?.checkpointContext?.simulationStageCheckpointId).toBe(checkpoint!.simulationStageCheckpointId)
    }
  })

  it('keeps the default HoD slice aligned with activated semesters 4 through 6 using the late checkpoint walk', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    if (hodLogin.body.activeRoleGrant.roleCode !== 'HOD') {
      await switchToRole(hodLogin.cookie, hodLogin.body.availableRoleGrants, 'HOD')
    }

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

    for (const semesterNumber of [4, 5, 6] as const) {
      const checkpointsForSemester = checkpointRows.filter(row => row.semesterNumber === semesterNumber)
      const checkpoint = checkpointsForSemester.at(-1)
      expect(checkpoint).toBeTruthy()
      expect(checkpoint?.stageKey).toBe('post-see')

      const activateSemesterResponse = await current.app.inject({
        method: 'POST',
        url: `/api/admin/proof-runs/${activeRun.simulationRunId}/activate-semester`,
        headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
        payload: { semesterNumber },
      })
      expect(activateSemesterResponse.statusCode).toBe(200)

      const [summaryResponse, checkpointSummaryResponse, studentsResponse, dashboardResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: '/api/academic/hod/proof-summary',
          headers: { cookie: hodLogin.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/hod/proof-summary?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
          headers: { cookie: hodLogin.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: '/api/academic/hod/proof-students',
          headers: { cookie: hodLogin.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/admin/batches/${activeRun.batchId}/proof-dashboard`,
          headers: { cookie: adminLogin.cookie },
        }),
      ])

      expect(summaryResponse.statusCode).toBe(200)
      expect(checkpointSummaryResponse.statusCode).toBe(200)
      expect(studentsResponse.statusCode).toBe(200)
      expect(dashboardResponse.statusCode).toBe(200)
      const studentsPayload = studentsResponse.json()
      const summaryPayload = summaryResponse.json()
      expect(['proof-run', 'proof-checkpoint']).toContain(summaryPayload.countSource)
      expect(summaryPayload.activeOperationalSemester).toBe(semesterNumber)
      if (summaryPayload.countSource === 'proof-checkpoint') {
        expect(summaryPayload.activeRunContext?.checkpointContext?.semesterNumber).toBe(semesterNumber)
      } else {
        expect(summaryPayload.activeRunContext?.checkpointContext).toBeUndefined()
      }
      const dashboardCheckpoint = dashboardResponse.json().activeRunDetail?.checkpoints?.find(
        (item: { simulationStageCheckpointId: string }) => item.simulationStageCheckpointId === checkpoint!.simulationStageCheckpointId,
      )
      expect(dashboardCheckpoint).toBeTruthy()
      expect(studentsPayload.items.every((item: { currentSemester: number }) => item.currentSemester === semesterNumber)).toBe(true)
      expect(summaryPayload.totals.studentsCovered).toBe(studentsPayload.items.length)
      expect(summaryPayload.totals.highRiskCount).toBe(
        studentsPayload.items.filter((item: { currentRiskBand: string }) => item.currentRiskBand === 'High').length,
      )
      expect(summaryPayload.totals.mediumRiskCount).toBe(
        studentsPayload.items.filter((item: { currentRiskBand: string }) => item.currentRiskBand === 'Medium').length,
      )
      const electiveFits = studentsPayload.items.map((item: Record<string, unknown>) => item.electiveFit ?? null)
      if (semesterNumber < 6) {
        expect(electiveFits.every((item: unknown) => item == null)).toBe(true)
      } else {
        expect(electiveFits.some((item: unknown) => !!item)).toBe(true)
      }
      const checkpointSummaryPayload = checkpointSummaryResponse.json()
      expect(checkpointSummaryPayload.countSource).toBe('proof-checkpoint')
      expect(checkpointSummaryPayload.activeOperationalSemester).toBe(semesterNumber)
      expect(checkpointSummaryPayload.activeRunContext?.checkpointContext?.simulationStageCheckpointId).toBe(checkpoint!.simulationStageCheckpointId)
      expect(checkpointSummaryPayload.activeRunContext?.checkpointContext?.stageKey).toBe('post-see')
      expect(checkpointSummaryPayload.activeRunContext?.checkpointContext?.stageAdvanceBlocked).toBe(dashboardCheckpoint?.stageAdvanceBlocked)
      expect(checkpointSummaryPayload.activeRunContext?.checkpointContext?.playbackAccessible).toBe(dashboardCheckpoint?.playbackAccessible)
      expect(checkpointSummaryPayload.activeRunContext?.checkpointContext?.blockedByCheckpointId ?? null).toBe(dashboardCheckpoint?.blockedByCheckpointId ?? null)
      expect(checkpointSummaryPayload.activeRunContext?.checkpointContext?.blockedProgressionReason ?? null).toBe(dashboardCheckpoint?.blockedProgressionReason ?? null)
      if (semesterNumber < 6) {
        expect(checkpointSummaryPayload.electiveDistribution).toEqual([])
      } else {
        expect(checkpointSummaryPayload.electiveDistribution.length).toBeGreaterThan(0)
      }
    }
  })
})
