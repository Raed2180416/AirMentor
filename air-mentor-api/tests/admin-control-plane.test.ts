import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  academicRuntimeState,
  facultyAppointments,
  facultyOfferingOwnerships,
  mentorAssignments,
  officialCodeCrosswalks,
  riskEvidenceSnapshots,
  roleGrants,
  sectionOfferings,
  simulationRuns,
  simulationQuestionTemplates,
  studentBehaviorProfiles,
  studentCoStates,
  studentObservedSemesterStates,
  studentQuestionResults,
  studentTopicStates,
  studentInterventionResponseStates,
} from '../src/db/schema.js'
import { MSRUAS_PROOF_BATCH_ID } from '../src/lib/msruas-proof-sandbox.js'
import { PROOF_CORPUS_MANIFEST } from '../src/lib/proof-risk-model.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null
const proofRcIt = process.env.AIRMENTOR_PROOF_RC === '1' ? it : it.skip

afterEach(async () => {
  if (current) await current.close()
  current = null
})

async function switchRoleContext(cookie: string, roleGrantId: string) {
  if (!current) throw new Error('Test app is not initialized')
  const response = await current.app.inject({
    method: 'POST',
    url: '/api/session/role-context',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: { roleGrantId },
  })
  expect(response.statusCode).toBe(200)
  return response
}

function weekdayFromDateIso(value: string) {
  const parsed = new Date(value)
  const weekday = parsed.getUTCDay()
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday] ?? null) as string | null
}

function timetableBlocksCanOverlap(
  left: { kind?: string; dateISO?: string; day: string },
  right: { kind?: string; dateISO?: string; day: string },
) {
  if (left.kind === 'extra' && left.dateISO && right.kind === 'extra' && right.dateISO) {
    return left.dateISO === right.dateISO
  }
  if (left.kind === 'extra' && left.dateISO && right.kind !== 'extra') {
    return weekdayFromDateIso(left.dateISO) === right.day
  }
  if (right.kind === 'extra' && right.dateISO && left.kind !== 'extra') {
    return weekdayFromDateIso(right.dateISO) === left.day
  }
  return left.day === right.day
}

function timetableRangesOverlap(
  left: { startMinutes: number; endMinutes: number },
  right: { startMinutes: number; endMinutes: number },
) {
  return left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes
}

describe('admin control plane routes', () => {
  it('rejects assigning a second active owner to the same offering', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const duplicateOwnership = await current.app.inject({
      method: 'POST',
      url: '/api/admin/offering-ownership',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        offeringId: 'c6-A',
        facultyId: 't1',
        ownershipRole: 'owner',
        status: 'active',
      },
    })

    expect(duplicateOwnership.statusCode).toBe(400)
    expect(duplicateOwnership.json().message).toMatch(/active faculty owner/i)
  })

  it('limits HoD faculty profile access to supervised departments and branches', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const facultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/faculty',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        username: 'ece.scope',
        email: 'ece.scope@msruas.ac.in',
        phone: '+91-9000000999',
        password: 'faculty1234',
        employeeCode: 'EMP-T990',
        displayName: 'Dr. ECE Scope',
        designation: 'Professor',
        joinedOn: '2024-01-01',
        status: 'active',
      },
    })
    expect(facultyCreate.statusCode).toBe(200)
    const createdFaculty = facultyCreate.json()

    const appointmentCreate = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${createdFaculty.facultyId}/appointments`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        departmentId: 'dept_ece',
        branchId: 'branch_ece_btech',
        isPrimary: true,
        startDate: '2024-01-01',
        status: 'active',
      },
    })
    expect(appointmentCreate.statusCode).toBe(200)

    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    expect(hodGrantId).toBeTruthy()
    const switchRoleResponse = await current.app.inject({
      method: 'POST',
      url: '/api/session/role-context',
      headers: { cookie: hodLogin.cookie, origin: TEST_ORIGIN },
      payload: { roleGrantId: hodGrantId },
    })
    expect(switchRoleResponse.statusCode).toBe(200)

    const inScopeResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/faculty-profile/t2',
      headers: { cookie: hodLogin.cookie },
    })
    expect(inScopeResponse.statusCode).toBe(200)

    const outOfScopeResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/faculty-profile/${createdFaculty.facultyId}`,
      headers: { cookie: hodLogin.cookie },
    })
    expect(outOfScopeResponse.statusCode).toBe(403)
  })

  it('propagates admin-created faculty records into teaching login, bootstrap, and faculty profile', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const facultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/faculty',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        username: 'meera.iyer',
        email: 'meera.iyer@msruas.ac.in',
        phone: '+91-9000000901',
        password: 'faculty1234',
        employeeCode: 'EMP-T900',
        displayName: 'Dr. Meera Iyer',
        designation: 'Professor',
        joinedOn: '2024-01-01',
        status: 'active',
      },
    })
    expect(facultyCreate.statusCode).toBe(200)
    const createdFaculty = facultyCreate.json()

    const appointmentCreate = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${createdFaculty.facultyId}/appointments`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        departmentId: 'dept_ece',
        branchId: 'branch_ece_btech',
        isPrimary: true,
        startDate: '2024-01-01',
        status: 'active',
      },
    })
    expect(appointmentCreate.statusCode).toBe(200)

    for (const roleCode of ['COURSE_LEADER', 'MENTOR'] as const) {
      const roleGrantCreate = await current.app.inject({
        method: 'POST',
        url: `/api/admin/faculty/${createdFaculty.facultyId}/role-grants`,
        headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
        payload: {
          roleCode,
          scopeType: 'branch',
          scopeId: 'branch_ece_btech',
          startDate: '2024-01-01',
          status: 'active',
        },
      })
      expect(roleGrantCreate.statusCode).toBe(200)
    }

    const eceOfferingsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/offerings',
      headers: { cookie: adminLogin.cookie },
    })
    expect(eceOfferingsResponse.statusCode).toBe(200)
    const eceSeedOffering = eceOfferingsResponse.json().items.find((item: { branchId?: string }) => item.branchId === 'branch_ece_btech') ?? null
    expect(eceSeedOffering).toBeTruthy()
    if (!eceSeedOffering) throw new Error('Expected a seeded ECE offering for the ownership test')

    const eceOfferingCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/offerings',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseId: eceSeedOffering.id,
        termId: eceSeedOffering.termId,
        branchId: eceSeedOffering.branchId,
        sectionCode: 'Z',
        yearLabel: eceSeedOffering.year,
        attendance: 0,
        studentCount: 0,
        stage: 1,
        stageLabel: 'Stage 1',
        stageDescription: 'Setup',
        stageColor: '#2563eb',
        tt1Done: false,
        tt2Done: false,
        tt1Locked: false,
        tt2Locked: false,
        quizLocked: false,
        assignmentLocked: false,
        pendingAction: null,
        status: 'active',
      },
    })
    expect(eceOfferingCreate.statusCode).toBe(200)
    const eceOffering = eceOfferingCreate.json()

    const studentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/students',
      headers: { cookie: adminLogin.cookie },
    })
    expect(studentsResponse.statusCode).toBe(200)
    const student = studentsResponse.json().items.find((item: { activeMentorAssignment: unknown }) => !item.activeMentorAssignment) ?? studentsResponse.json().items[0]
    expect(student).toBeTruthy()

    const ownershipCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/offering-ownership',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        offeringId: eceOffering.offeringId,
        facultyId: createdFaculty.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      },
    })
    expect(ownershipCreate.statusCode).toBe(200)

    const mentorAssignmentCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/mentor-assignments',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        studentId: student.studentId,
        facultyId: createdFaculty.facultyId,
        effectiveFrom: '2026-03-01',
        source: 'sysadmin-seeded-test',
      },
    })
    expect(mentorAssignmentCreate.statusCode).toBe(200)

    const publicFaculty = await current.app.inject({
      method: 'GET',
      url: '/api/academic/public/faculty',
    })
    expect(publicFaculty.statusCode).toBe(200)
    expect(publicFaculty.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        facultyId: createdFaculty.facultyId,
        name: 'Dr. Meera Iyer',
        dept: 'ECE',
        roleTitle: 'Professor',
        allowedRoles: ['Course Leader', 'Mentor'],
      }),
    ]))

    const facultyLogin = await loginAs(current.app, 'meera.iyer', 'faculty1234')
    expect(facultyLogin.response.statusCode).toBe(200)

    const bootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(bootstrapResponse.statusCode).toBe(200)
    const bootstrap = bootstrapResponse.json()
    const bootstrapFaculty = bootstrap.faculty.find((item: { facultyId: string }) => item.facultyId === createdFaculty.facultyId)
    const teacherCard = bootstrap.teachers.find((item: { id: string }) => item.id === createdFaculty.facultyId)

    expect(bootstrapFaculty).toMatchObject({
      facultyId: createdFaculty.facultyId,
      name: 'Dr. Meera Iyer',
      email: 'meera.iyer@msruas.ac.in',
      dept: 'ECE',
      roleTitle: 'Professor',
      allowedRoles: ['Course Leader', 'Mentor'],
    })
    expect(bootstrapFaculty?.offeringIds).toContain(eceOffering.offeringId)
    expect(bootstrapFaculty?.menteeIds.length).toBe(1)
    expect(teacherCard?.dept).toBe('ECE')

    const profileResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/faculty-profile/${createdFaculty.facultyId}`,
      headers: { cookie: facultyLogin.cookie },
    })
    expect(profileResponse.statusCode).toBe(200)
    const profile = profileResponse.json()

    expect(profile.primaryDepartment).toEqual({
      departmentId: 'dept_ece',
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
    })
    expect(profile.joinedOn).toBe('2024-01-01')
    expect(profile.permissions.map((item: { roleCode: string }) => item.roleCode).sort()).toEqual(['COURSE_LEADER', 'MENTOR'])
    expect(profile.appointments[0]).toMatchObject({
      departmentId: 'dept_ece',
      departmentName: 'Electronics and Communication Engineering',
      departmentCode: 'ECE',
      branchId: 'branch_ece_btech',
      branchName: 'B.Tech ECE',
      branchCode: 'BTECH-ECE',
      isPrimary: true,
    })
    expect(profile.currentOwnedClasses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        offeringId: eceOffering.offeringId,
        ownershipRole: 'owner',
      }),
    ]))
    expect(profile.subjectRunCourseLeaderScope.length).toBeGreaterThan(0)
    expect(profile.mentorScope.activeStudentCount).toBe(1)
  })

  proofRcIt('runs the proof control plane end to end and exposes proof operations on the faculty profile', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const createImportResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-imports`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(createImportResponse.statusCode).toBe(200)
    const createdImport = createImportResponse.json()
    expect(createdImport.validation).toMatchObject({
      semesterCoverage: [1, 6],
      courseCount: 36,
      totalCredits: 118,
      explicitEdgeCount: 24,
      addedEdgeCount: 20,
      bridgeModuleCount: 10,
      electiveOptionCount: 18,
    })

    const validateResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-imports/${createdImport.curriculumImportVersionId}/validate`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(validateResponse.statusCode).toBe(200)
    expect(validateResponse.json()).toMatchObject({
      semesterCoverage: [1, 6],
      courseCount: 36,
      totalCredits: 118,
      explicitEdgeCount: 24,
      addedEdgeCount: 20,
      bridgeModuleCount: 10,
      electiveOptionCount: 18,
    })

    const crosswalkRows = await current.db.select().from(officialCodeCrosswalks).where(eq(officialCodeCrosswalks.curriculumImportVersionId, createdImport.curriculumImportVersionId))
    const pendingCrosswalks = crosswalkRows.filter(row => row.reviewStatus === 'pending-review')
    expect(pendingCrosswalks.length).toBeGreaterThan(0)

    const reviewResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-imports/${createdImport.curriculumImportVersionId}/review-crosswalks`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        reviews: pendingCrosswalks.map(row => ({
          officialCodeCrosswalkId: row.officialCodeCrosswalkId,
          reviewStatus: 'reviewed',
        })),
      },
    })
    expect(reviewResponse.statusCode).toBe(200)
    expect(reviewResponse.json()).toEqual({
      ok: true,
      count: pendingCrosswalks.length,
    })

    const approveResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-imports/${createdImport.curriculumImportVersionId}/approve`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(approveResponse.statusCode).toBe(200)
    expect(approveResponse.json()).toEqual({ ok: true })

    const createRunResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-runs`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        curriculumImportVersionId: createdImport.curriculumImportVersionId,
        seed: PROOF_CORPUS_MANIFEST[0]!.seed,
        runLabel: 'route-proof-test',
        activate: false,
      },
    })
    expect(createRunResponse.statusCode).toBe(200)
    expect(createRunResponse.json()).toMatchObject({
      activeFlag: false,
    })
    const runId = createRunResponse.json().simulationRunId as string

    const activateResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${runId}/activate`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(activateResponse.statusCode).toBe(200)
    expect(activateResponse.json()).toEqual({ ok: true })

    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${runId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeResponse.statusCode).toBe(200)
    expect(recomputeResponse.json()).toEqual({ ok: true })

    const dashboardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(dashboardResponse.statusCode).toBe(200)
    const dashboard = dashboardResponse.json()
    expect(dashboard.imports.some((item: { curriculumImportVersionId: string; status: string }) => (
      item.curriculumImportVersionId === createdImport.curriculumImportVersionId && item.status === 'approved'
    ))).toBe(true)
    expect(dashboard.proofRuns.some((item: { simulationRunId: string; activeFlag: boolean }) => (
      item.simulationRunId === runId && item.activeFlag
    ))).toBe(true)
    expect(dashboard.activeRunDetail).toMatchObject({
      simulationRunId: runId,
      status: 'active',
    })
    expect(dashboard.activeRunDetail.checkpoints.length).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.teacherAllocationLoad.length).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.queuePreview.length).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.coverageDiagnostics).toMatchObject({
      behaviorProfileCoverage: { count: 120, expected: 120 },
    })
    expect(dashboard.activeRunDetail.coverageDiagnostics.topicStateCoverage.count).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.coverageDiagnostics.coStateCoverage.count).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.coverageDiagnostics.questionTemplateCoverage.count).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.coverageDiagnostics.questionResultCoverage.count).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.coverageDiagnostics.interventionResponseCoverage.count).toBeGreaterThan(0)
    expect(dashboard.activeRunDetail.modelDiagnostics.production).toMatchObject({
      artifactVersion: expect.stringContaining('observable-risk-logit'),
      modelFamily: 'logistic-scorecard',
    })
    expect(dashboard.activeRunDetail.modelDiagnostics.activeRunFeatureRowCount).toBeGreaterThan(0)
    const [modelActiveResponse, modelEvaluationResponse, modelCorrelationResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: '/api/admin/proof-models/active',
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/admin/proof-models/evaluation',
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: '/api/admin/proof-models/correlations',
        headers: { cookie: adminLogin.cookie },
      }),
    ])
    expect(modelActiveResponse.statusCode).toBe(200)
    expect(modelEvaluationResponse.statusCode).toBe(200)
    expect(modelCorrelationResponse.statusCode).toBe(200)
    expect(modelActiveResponse.json().production).toMatchObject({
      modelVersion: expect.stringContaining('observable-risk-logit'),
    })
    expect(modelEvaluationResponse.json().production).toMatchObject({
      governedRunCount: expect.any(Number),
      skippedRunCount: expect.any(Number),
      coEvidenceDiagnostics: {
        totalRows: expect.any(Number),
        fallbackCount: expect.any(Number),
      },
      policyDiagnostics: {
        acceptanceGates: {
          structuredStudyPlanWithinLimit: expect.any(Boolean),
          targetedTutoringBeatsStructuredStudyPlanAcademicSlice: expect.any(Boolean),
          noRecommendedActionUnderperformsNoAction: expect.any(Boolean),
        },
        counterfactualPolicyDiagnostics: {
          byAction: expect.any(Object),
          byPhenotype: expect.any(Object),
        },
        realizedPathDiagnostics: {
          byAction: expect.any(Object),
          byPhenotype: expect.any(Object),
        },
        byPhenotype: expect.any(Object),
      },
    })
    expect(Array.isArray(modelCorrelationResponse.json().correlations?.prerequisiteEdges)).toBe(true)
    expect(dashboard.lifecycleAudit.length).toBeGreaterThan(0)

    const timetableRuntimeRow = await current.db
      .select()
      .from(academicRuntimeState)
      .where(eq(academicRuntimeState.stateKey, 'timetableByFacultyId'))
      .then(rows => rows[0] ?? null)
    expect(timetableRuntimeRow).toBeTruthy()
    const timetablePayload = timetableRuntimeRow ? JSON.parse(timetableRuntimeRow.payloadJson) as Record<string, { classBlocks?: Array<{ id: string; day: string; kind?: string; dateISO?: string; startMinutes: number; endMinutes: number }> }> : {}
    for (const [facultyId, template] of Object.entries(timetablePayload)) {
      const classBlocks = template.classBlocks ?? []
      for (let index = 0; index < classBlocks.length; index += 1) {
        const left = classBlocks[index]
        for (let compareIndex = index + 1; compareIndex < classBlocks.length; compareIndex += 1) {
          const right = classBlocks[compareIndex]
          if (!timetableBlocksCanOverlap(left, right)) continue
          expect(
            timetableRangesOverlap(left, right),
            `Proof timetable should not overlap for ${facultyId}: ${left.id} vs ${right.id}`,
          ).toBe(false)
        }
      }
    }

    const observedRows = await current.db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, runId))
    expect(observedRows.length).toBeGreaterThan(0)
    const [behaviorProfiles, topicStates, coStates, questionTemplates, questionResults, interventionResponses, featureRows] = await Promise.all([
      current.db.select().from(studentBehaviorProfiles).where(eq(studentBehaviorProfiles.simulationRunId, runId)),
      current.db.select().from(studentTopicStates).where(eq(studentTopicStates.simulationRunId, runId)),
      current.db.select().from(studentCoStates).where(eq(studentCoStates.simulationRunId, runId)),
      current.db.select().from(simulationQuestionTemplates).where(eq(simulationQuestionTemplates.simulationRunId, runId)),
      current.db.select().from(studentQuestionResults).where(eq(studentQuestionResults.simulationRunId, runId)),
      current.db.select().from(studentInterventionResponseStates).where(eq(studentInterventionResponseStates.simulationRunId, runId)),
      current.db.select().from(riskEvidenceSnapshots).where(eq(riskEvidenceSnapshots.simulationRunId, runId)),
    ])
    expect(behaviorProfiles).toHaveLength(120)
    expect(topicStates.length).toBeGreaterThan(0)
    expect(coStates.length).toBeGreaterThan(0)
    expect(questionTemplates.length).toBeGreaterThan(0)
    expect(questionResults.length).toBeGreaterThan(0)
    expect(interventionResponses.length).toBeGreaterThan(0)
    expect(featureRows.filter(row => !!row.simulationStageCheckpointId).length).toBeGreaterThan(0)

    const sem6CoState = coStates.find(row => row.semesterNumber === 6 && !!row.offeringId)
    expect(sem6CoState).toBeTruthy()
    if (!sem6CoState) throw new Error('Expected a semester-6 CO state row')
    const sem6CoPayload = JSON.parse(sem6CoState.stateJson) as {
      coObservedScoreHistory?: {
        tt1Pct?: number
        tt2Pct?: number
      }
    }
    const relatedTemplates = questionTemplates.filter(template => {
      if (template.offeringId !== sem6CoState.offeringId) return false
        const tags = JSON.parse(template.coTagsJson) as string[]
        return tags.includes(sem6CoState.coCode)
      })
    const relatedTemplateIds = new Set(relatedTemplates.map(template => template.simulationQuestionTemplateId))
    const relatedResults = questionResults.filter(result =>
      result.studentId === sem6CoState.studentId
      && result.offeringId === sem6CoState.offeringId
      && relatedTemplateIds.has(result.simulationQuestionTemplateId))
    const componentPct = (componentType: 'tt1' | 'tt2') => {
      const componentResults = relatedResults.filter(result => result.componentType === componentType)
      const score = componentResults.reduce((sum, result) => sum + result.score, 0)
      const max = componentResults.reduce((sum, result) => sum + result.maxScore, 0)
      return max > 0 ? Math.round((score / max) * 100) : null
    }
    expect(componentPct('tt1')).toBe(Math.round(Number(sem6CoPayload.coObservedScoreHistory?.tt1Pct ?? 0)))
    expect(componentPct('tt2')).toBe(Math.round(Number(sem6CoPayload.coObservedScoreHistory?.tt2Pct ?? 0)))
    const sem6Observed = observedRows.find((row: { semesterNumber: number }) => row.semesterNumber === 6)
    expect(sem6Observed).toBeTruthy()
    const sem6Payload = sem6Observed ? JSON.parse(sem6Observed.observedStateJson) as Record<string, unknown> : {}
    expect(sem6Payload).toEqual(expect.objectContaining({
      tt2Pct: expect.any(Number),
      seePct: expect.any(Number),
      weakCoCount: expect.any(Number),
      questionEvidenceSummary: expect.any(Object),
      interventionResponse: expect.any(Object),
    }))
    expect(sem6Payload).not.toHaveProperty('forgetRate')
    const studentId = observedRows[0]?.studentId
    if (!studentId) throw new Error('Expected an observed student state for the proof run')

    const evidenceResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/proof-runs/${runId}/students/${studentId}/evidence-timeline`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(evidenceResponse.statusCode).toBe(200)
    const evidenceItems = evidenceResponse.json().items as Array<{ semesterNumber: number }>
    expect(evidenceItems.length).toBeGreaterThanOrEqual(6)
    expect(evidenceItems[0]).toMatchObject({ semesterNumber: 1 })
    expect(evidenceItems.at(-1)).toMatchObject({ semesterNumber: 6 })

    const facultyLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    expect(facultyLogin.response.statusCode).toBe(200)

    const profileResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/faculty-profile/mnc_t1',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(profileResponse.statusCode).toBe(200)
    const profile = profileResponse.json()
    expect(profile.proofOperations.activeRunContexts.some((item: { simulationRunId: string }) => item.simulationRunId === runId)).toBe(true)
    expect(profile.proofOperations.monitoringQueue.length).toBeGreaterThan(0)
    expect(profile.proofOperations.electiveFits.length).toBeGreaterThan(0)
    expect(profile.proofOperations.monitoringQueue[0]).toMatchObject({
      simulationRunId: runId,
      observedEvidence: expect.objectContaining({
        tt2Pct: expect.any(Number),
        seePct: expect.any(Number),
        weakCoCount: expect.any(Number),
        weakQuestionCount: expect.any(Number),
      }),
    })
    const firstCheckpointId = (
      dashboard.activeRunDetail.checkpoints.find((item: { openQueueCount?: number }) => (item.openQueueCount ?? 0) > 0)
      ?? dashboard.activeRunDetail.checkpoints[0]
    )?.simulationStageCheckpointId as string
    expect(firstCheckpointId).toBeTruthy()

    const [checkpointListResponse, checkpointDetailOne, checkpointDetailTwo] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/admin/proof-runs/${runId}/checkpoints`,
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/admin/proof-runs/${runId}/checkpoints/${firstCheckpointId}`,
        headers: { cookie: adminLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/admin/proof-runs/${runId}/checkpoints/${firstCheckpointId}`,
        headers: { cookie: adminLogin.cookie },
      }),
    ])
    expect(checkpointListResponse.statusCode).toBe(200)
    expect(checkpointDetailOne.statusCode).toBe(200)
    expect(checkpointDetailTwo.statusCode).toBe(200)
    const checkpointItems = checkpointListResponse.json().items as Array<{ simulationStageCheckpointId: string; stageLabel: string }>
    expect(checkpointItems.length).toBe(dashboard.activeRunDetail.checkpoints.length)
    expect(checkpointItems.some(item => item.simulationStageCheckpointId === firstCheckpointId)).toBe(true)
    expect(checkpointDetailOne.json()).toEqual(checkpointDetailTwo.json())
    expect(checkpointDetailOne.json().checkpoint).toMatchObject({
      simulationStageCheckpointId: firstCheckpointId,
      stageLabel: expect.any(String),
      stageAdvanceBlocked: expect.any(Boolean),
      blockingQueueItemCount: expect.any(Number),
    })
    expect(checkpointDetailOne.json().queuePreview.length).toBeGreaterThanOrEqual(0)
    if (checkpointDetailOne.json().queuePreview[0]) {
      expect(checkpointDetailOne.json().queuePreview[0]).toMatchObject({
        riskChangeFromPreviousCheckpointScaled: expect.any(Number),
        counterfactualLiftScaled: expect.any(Number),
      })
    }

    const checkpointStudentResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/proof-runs/${runId}/checkpoints/${firstCheckpointId}/students/${studentId}`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(checkpointStudentResponse.statusCode).toBe(200)
    expect(checkpointStudentResponse.json()).toMatchObject({
      checkpoint: { simulationStageCheckpointId: firstCheckpointId },
      student: { studentId },
    })
    expect(checkpointStudentResponse.json().projections.length).toBeGreaterThan(0)
    expect(checkpointStudentResponse.json().projections[0]).toMatchObject({
      riskChangeFromPreviousCheckpointScaled: expect.any(Number),
      counterfactualLiftScaled: expect.any(Number),
    })

    const bootstrapCheckpointResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(firstCheckpointId)}`,
      headers: { cookie: facultyLogin.cookie },
    })
    expect(bootstrapCheckpointResponse.statusCode).toBe(200)
    expect(bootstrapCheckpointResponse.json().proofPlayback).toMatchObject({
      simulationStageCheckpointId: firstCheckpointId,
    })
    const checkpointOfferings = bootstrapCheckpointResponse.json().offerings as Array<{ stage: number; stageInfo?: { label?: string }; pendingAction?: string | null }>
    expect(checkpointOfferings.some(item => typeof item.stage === 'number' && typeof item.stageInfo?.label === 'string' && item.stageInfo.label.length > 0)).toBe(true)

    const facultyProfileCheckpointResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/faculty-profile/mnc_t1?simulationStageCheckpointId=${encodeURIComponent(firstCheckpointId)}`,
      headers: { cookie: facultyLogin.cookie },
    })
    expect(facultyProfileCheckpointResponse.statusCode).toBe(200)
    expect(facultyProfileCheckpointResponse.json().proofOperations.selectedCheckpoint).toMatchObject({
      simulationStageCheckpointId: firstCheckpointId,
      stageAdvanceBlocked: expect.any(Boolean),
    })
    expect(Array.isArray(facultyProfileCheckpointResponse.json().proofOperations.monitoringQueue)).toBe(true)
    if (facultyProfileCheckpointResponse.json().proofOperations.monitoringQueue[0]) {
      expect(facultyProfileCheckpointResponse.json().proofOperations.monitoringQueue[0]).toMatchObject({
        riskChangeFromPreviousCheckpointScaled: expect.any(Number),
        counterfactualLiftScaled: expect.any(Number),
      })
      expect(facultyProfileCheckpointResponse.json().proofOperations.monitoringQueue[0].observedEvidence).toHaveProperty('coEvidenceMode')
    }
  })

  proofRcIt('recomputes the seeded baseline active proof run when it starts without checkpoints', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const beforeDashboardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(beforeDashboardResponse.statusCode).toBe(200)
    const beforeDashboard = beforeDashboardResponse.json()
    expect(beforeDashboard.activeRunDetail).toBeTruthy()
    expect(beforeDashboard.activeRunDetail.simulationRunId).toBe('sim_mnc_2023_first6_v1')
    expect(beforeDashboard.activeRunDetail.checkpoints.length).toBe(0)

    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${beforeDashboard.activeRunDetail.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeResponse.statusCode).toBe(200)
    expect(recomputeResponse.json()).toEqual({ ok: true })

    const afterDashboardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(afterDashboardResponse.statusCode).toBe(200)
    const afterDashboard = afterDashboardResponse.json()
    expect(afterDashboard.activeRunDetail).toMatchObject({
      simulationRunId: 'sim_mnc_2023_first6_v1',
      status: 'active',
    })
    expect(afterDashboard.activeRunDetail.checkpoints.length).toBeGreaterThan(0)
    expect(afterDashboard.activeRunDetail.modelDiagnostics.production).toMatchObject({
      artifactVersion: expect.stringContaining('observable-risk-logit'),
      modelFamily: 'logistic-scorecard',
    })
  }, 120_000)

  it('supports reminders and audit search across admin-managed entities', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const reminderCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/reminders',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        title: 'Follow up with HoD',
        body: 'Review cross-department load balancing.',
        dueAt: '2026-03-20T09:00:00.000Z',
        status: 'pending',
      },
    })
    expect(reminderCreate.statusCode).toBe(200)
    const createdReminder = reminderCreate.json()

    const reminderPatch = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/reminders/${createdReminder.reminderId}`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        title: createdReminder.title,
        body: createdReminder.body,
        dueAt: createdReminder.dueAt,
        status: 'done',
        version: createdReminder.version,
      },
    })
    expect(reminderPatch.statusCode).toBe(200)

    const remindersResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/reminders',
      headers: { cookie: adminLogin.cookie },
    })
    expect(remindersResponse.statusCode).toBe(200)
    expect(remindersResponse.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reminderId: createdReminder.reminderId,
        status: 'done',
      }),
    ]))

    const auditResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/audit-events?entityType=AdminReminder&entityId=${createdReminder.reminderId}`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(auditResponse.statusCode).toBe(200)
    expect(auditResponse.json().items.map((item: { action: string }) => item.action)).toEqual(['created', 'updated'])

    const searchResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/search?q=Kavitha',
      headers: { cookie: adminLogin.cookie },
    })
    expect(searchResponse.statusCode).toBe(200)
    expect(searchResponse.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'faculty-member',
        route: expect.objectContaining({
          section: 'faculty-members',
          facultyMemberId: 't1',
        }),
      }),
    ]))
  })

  it('soft-deleting a faculty cascades appointments, permissions, ownerships, and mentor links out of the live teaching surface', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const facultyCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/faculty',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        username: 'delete.me',
        email: 'delete.me@msruas.ac.in',
        phone: '+91-9000000999',
        password: 'faculty1234',
        employeeCode: 'EMP-DEL-01',
        displayName: 'Delete Me',
        designation: 'Assistant Professor',
        joinedOn: null,
        status: 'active',
      },
    })
    expect(facultyCreate.statusCode).toBe(200)
    const createdFaculty = facultyCreate.json()

    const appointmentCreate = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${createdFaculty.facultyId}/appointments`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        departmentId: 'dept_cse',
        branchId: 'branch_cse_btech',
        isPrimary: true,
        startDate: '2024-06-01',
        status: 'active',
      },
    })
    expect(appointmentCreate.statusCode).toBe(200)

    const roleGrantCreate = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${createdFaculty.facultyId}/role-grants`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        roleCode: 'MENTOR',
        scopeType: 'branch',
        scopeId: 'branch_cse_btech',
        startDate: '2024-06-01',
        status: 'active',
      },
    })
    expect(roleGrantCreate.statusCode).toBe(200)

    const [branchOfferings, branchActiveOwnershipRows] = await Promise.all([
      current.db.select().from(sectionOfferings).where(eq(sectionOfferings.branchId, 'branch_cse_btech')),
      current.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    ])
    const branchActiveOfferingIds = new Set(branchActiveOwnershipRows.map(item => item.offeringId))
    const offering = branchOfferings.find(item => !branchActiveOfferingIds.has(item.offeringId)) ?? null
    expect(offering).toBeTruthy()
    if (!offering) throw new Error('Expected an unassigned CSE offering for the ownership test')

    const ownershipCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/offering-ownership',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        offeringId: offering.offeringId,
        facultyId: createdFaculty.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      },
    })
    expect(ownershipCreate.statusCode).toBe(200)

    const studentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/students',
      headers: { cookie: adminLogin.cookie },
    })
    expect(studentsResponse.statusCode).toBe(200)
    const student = studentsResponse.json().items[0]
    expect(student).toBeTruthy()

    const mentorAssignmentCreate = await current.app.inject({
      method: 'POST',
      url: '/api/admin/mentor-assignments',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        studentId: student.studentId,
        facultyId: createdFaculty.facultyId,
        effectiveFrom: '2026-03-01',
        source: 'sysadmin-delete-test',
      },
    })
    expect(mentorAssignmentCreate.statusCode).toBe(200)

    const facultyDelete = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/faculty/${createdFaculty.facultyId}`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        username: createdFaculty.username,
        email: createdFaculty.email,
        phone: createdFaculty.phone,
        employeeCode: createdFaculty.employeeCode,
        displayName: createdFaculty.displayName,
        designation: createdFaculty.designation,
        joinedOn: createdFaculty.joinedOn,
        status: 'deleted',
        version: createdFaculty.version,
      },
    })
    expect(facultyDelete.statusCode).toBe(200)

    const appointmentRows = await current.db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, createdFaculty.facultyId))
    const grantRows = await current.db.select().from(roleGrants).where(eq(roleGrants.facultyId, createdFaculty.facultyId))
    const ownershipRows = await current.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, createdFaculty.facultyId))
    const assignmentRows = await current.db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, createdFaculty.facultyId))

    expect(appointmentRows.every(item => item.status === 'deleted')).toBe(true)
    expect(grantRows.every(item => item.status === 'deleted')).toBe(true)
    expect(ownershipRows.every(item => item.status === 'deleted')).toBe(true)
    expect(assignmentRows.every(item => item.effectiveTo === '2026-03-16')).toBe(true)

    const publicFaculty = await current.app.inject({
      method: 'GET',
      url: '/api/academic/public/faculty',
    })
    expect(publicFaculty.statusCode).toBe(200)
    expect(publicFaculty.json().items.some((item: { facultyId: string }) => item.facultyId === createdFaculty.facultyId)).toBe(false)

    const deletedFacultyLogin = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: { origin: TEST_ORIGIN },
      payload: { identifier: 'delete.me', password: 'faculty1234' },
    })
    expect(deletedFacultyLogin.statusCode).not.toBe(200)
  })

  it('enforces the faculty timetable direct-edit window while keeping markers editable and reflected in teaching profile status', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const facultyLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    expect(adminLogin.response.statusCode).toBe(200)
    expect(facultyLogin.response.statusCode).toBe(200)

    const offeringsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/offerings',
      headers: { cookie: adminLogin.cookie },
    })
    expect(offeringsResponse.statusCode).toBe(200)
    const offering = offeringsResponse.json().items.find((item: { offId: string }) => item.offId === 'c3-A') ?? offeringsResponse.json().items[0]
    expect(offering).toBeTruthy()

    const template = {
      facultyId: 't1',
      slots: [{ id: 'slot-1', label: 'P1', startTime: '09:00', endTime: '10:00' }],
      dayStartMinutes: 540,
      dayEndMinutes: 1020,
      classBlocks: [{
        id: 'block-1',
        facultyId: 't1',
        offeringId: offering.offId,
        courseCode: offering.code,
        courseName: offering.title,
        section: offering.section,
        year: offering.year,
        day: 'Mon',
        kind: 'regular',
        startMinutes: 540,
        endMinutes: 600,
        slotId: 'slot-1',
        slotSpan: 1,
      }],
      updatedAt: 1,
    }
    const workspace = {
      publishedAt: null,
      markers: [{
        markerId: 'marker-1',
        facultyId: 't1',
        markerType: 'semester-start',
        title: 'Semester Start',
        note: 'Opening day',
        dateISO: '2026-08-01',
        endDateISO: null,
        allDay: true,
        startMinutes: null,
        endMinutes: null,
        color: '#2563eb',
        createdAt: 1,
        updatedAt: 1,
      }],
    }

    const initialSave = await current.app.inject({
      method: 'PUT',
      url: '/api/admin/faculty-calendar/t1',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { template, workspace },
    })
    expect(initialSave.statusCode).toBe(200)
    const savedCalendar = initialSave.json()
    expect(savedCalendar.workspace.publishedAt).toBeTruthy()
    expect(savedCalendar.classEditingLocked).toBe(false)

    const profileResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/faculty-profile/t1',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(profileResponse.statusCode).toBe(200)
    expect(profileResponse.json().timetableStatus).toMatchObject({
      hasTemplate: true,
      publishedAt: savedCalendar.workspace.publishedAt,
    })

    const bootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(bootstrapResponse.statusCode).toBe(200)
    expect(bootstrapResponse.json().runtime.adminCalendarByFacultyId.t1.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        markerId: 'marker-1',
        markerType: 'semester-start',
        title: 'Semester Start',
      }),
    ]))

    const recentAuditResponse = await current.app.inject({
      method: 'GET',
      url: '/api/admin/audit-events/recent?limit=20',
      headers: { cookie: adminLogin.cookie },
    })
    expect(recentAuditResponse.statusCode).toBe(200)
    expect(recentAuditResponse.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'FacultyTimetableAdmin',
        entityId: 't1',
      }),
    ]))

    const [calendarRow] = await current.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'adminCalendarByFacultyId'))
    expect(calendarRow).toBeTruthy()
    const currentPayload = JSON.parse(calendarRow.payloadJson) as Record<string, unknown>
    await current.db.update(academicRuntimeState).set({
      payloadJson: JSON.stringify({
        ...currentPayload,
        t1: {
          ...(currentPayload.t1 as Record<string, unknown>),
          publishedAt: '2026-02-01T00:00:00.000Z',
        },
      }),
      version: calendarRow.version + 1,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicRuntimeState.stateKey, 'adminCalendarByFacultyId'))

    const markerOnlySave = await current.app.inject({
      method: 'PUT',
      url: '/api/admin/faculty-calendar/t1',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        template,
        workspace: {
          publishedAt: '2026-02-01T00:00:00.000Z',
          markers: [
            {
              ...workspace.markers[0],
              note: 'Opening day updated by admin after the class edit window.',
              updatedAt: 2,
            },
          ],
        },
      },
    })
    expect(markerOnlySave.statusCode).toBe(200)
    expect(markerOnlySave.json().classEditingLocked).toBe(true)

    const blockedTemplateSave = await current.app.inject({
      method: 'PUT',
      url: '/api/admin/faculty-calendar/t1',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        template: {
          ...template,
          classBlocks: [
            ...template.classBlocks,
            {
              ...template.classBlocks[0],
              id: 'block-2',
              startMinutes: 600,
              endMinutes: 660,
            },
          ],
          updatedAt: 2,
        },
        workspace: markerOnlySave.json().workspace,
      },
    })
    expect(blockedTemplateSave.statusCode).toBe(403)
  })

  proofRcIt('serves HoD proof analytics from the active proof run with faculty-profile parity and deterministic filters', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const dashboardResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(dashboardResponse.statusCode).toBe(200)
    const dashboard = dashboardResponse.json()
    expect(dashboard.activeRunDetail).toBeTruthy()

    const hodLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    expect(hodLogin.response.statusCode).toBe(200)
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    expect(hodGrantId).toBeTruthy()
    await switchRoleContext(hodLogin.cookie, hodGrantId!)

    const summaryResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-summary',
      headers: { cookie: hodLogin.cookie },
    })
    expect(summaryResponse.statusCode).toBe(200)
    const summary = summaryResponse.json()
    expect(summary.activeRunContext).toMatchObject({
      simulationRunId: dashboard.activeRunDetail.simulationRunId,
      sourceLabel: 'Live proof records',
    })
    expect(summary.monitoringSummary).toMatchObject(dashboard.activeRunDetail.monitoringSummary)
    expect(summary.totals.studentsCovered).toBeGreaterThan(0)
    expect(summary.sectionComparison.length).toBeGreaterThan(0)
    expect(summary.facultyLoadSummary.facultyCount).toBeGreaterThan(0)

    const facultyResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-faculty?facultyId=mnc_t1',
      headers: { cookie: hodLogin.cookie },
    })
    expect(facultyResponse.statusCode).toBe(200)
    const facultyItems = facultyResponse.json().items
    expect(facultyItems).toHaveLength(1)

    const facultyProfileResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/faculty-profile/mnc_t1',
      headers: { cookie: hodLogin.cookie },
    })
    expect(facultyProfileResponse.statusCode).toBe(200)
    const facultyProfile = facultyProfileResponse.json()
    expect(facultyItems[0]).toMatchObject({
      facultyId: 'mnc_t1',
      weeklyContactHours: expect.any(Number),
    })
    expect(facultyProfile.proofOperations.monitoringQueue.length).toBeGreaterThan(0)
    expect(facultyItems[0].queueLoad).toBeGreaterThanOrEqual(facultyProfile.proofOperations.monitoringQueue.length)

    const studentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-students',
      headers: { cookie: hodLogin.cookie },
    })
    expect(studentsResponse.statusCode).toBe(200)
    const studentItems = studentsResponse.json().items
    expect(studentItems.length).toBeGreaterThan(0)
    const firstStudent = studentItems[0]
    if (!firstStudent) throw new Error('Expected at least one HoD student watch row')

    const filteredStudentResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/hod/proof-students?section=${encodeURIComponent(firstStudent.sectionCode)}&studentId=${encodeURIComponent(firstStudent.studentId)}`,
      headers: { cookie: hodLogin.cookie },
    })
    expect(filteredStudentResponse.statusCode).toBe(200)
    expect(filteredStudentResponse.json().items).toEqual([
      expect.objectContaining({
        studentId: firstStudent.studentId,
        sectionCode: firstStudent.sectionCode,
      }),
    ])

    const courseResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/hod/proof-courses?courseCode=${encodeURIComponent(firstStudent.primaryCourseCode)}`,
      headers: { cookie: hodLogin.cookie },
    })
    expect(courseResponse.statusCode).toBe(200)
    expect(courseResponse.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        courseCode: firstStudent.primaryCourseCode,
      }),
    ]))

    const reassessmentResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/hod/proof-reassessments?studentId=${encodeURIComponent(firstStudent.studentId)}`,
      headers: { cookie: hodLogin.cookie },
    })
    expect(reassessmentResponse.statusCode).toBe(200)
    const reassessmentItems = reassessmentResponse.json().items
    expect(reassessmentItems.length).toBeGreaterThan(0)
    expect(reassessmentItems.every((item: { studentId: string; simulationRunId: string }) => (
      item.studentId === firstStudent.studentId
      && item.simulationRunId === dashboard.activeRunDetail.simulationRunId
    ))).toBe(true)
  })

  proofRcIt('scopes faculty proof operations to the active teaching role so proof links stay reachable', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    expect(login.response.statusCode).toBe(200)
    const facultyId = login.body.faculty.facultyId as string

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()

    const [ownershipRows, mentorRows, observedRows] = await Promise.all([
      current.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, facultyId)),
      current.db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, facultyId)),
      current.db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId)),
    ])

    const ownedOfferingIds = new Set(ownershipRows.filter(row => row.status === 'active').map(row => row.offeringId))
    const mentorStudentIds = new Set(mentorRows.filter(row => row.effectiveTo === null).map(row => row.studentId))
    const courseLeaderStudentIds = new Set(
      observedRows.flatMap(row => {
        const payload = JSON.parse(row.observedStateJson) as Record<string, unknown>
        const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
        return offeringId && ownedOfferingIds.has(offeringId) ? [row.studentId] : []
      }),
    )
    expect(ownedOfferingIds.size).toBeGreaterThan(0)
    expect(mentorStudentIds.size).toBeGreaterThan(0)
    expect(courseLeaderStudentIds.size).toBeGreaterThan(0)

    const loadProfileForRole = async (roleCode: 'COURSE_LEADER' | 'MENTOR') => {
      const grantId = login.body.availableRoleGrants.find((grant: { roleCode: string; grantId: string }) => grant.roleCode === roleCode)?.grantId
      expect(grantId).toBeTruthy()
      await switchRoleContext(login.cookie, grantId!)
      const response = await current!.app.inject({
        method: 'GET',
        url: `/api/academic/faculty-profile/${facultyId}`,
        headers: { cookie: login.cookie },
      })
      expect(response.statusCode).toBe(200)
      return response.json().proofOperations as {
        monitoringQueue: Array<{ studentId: string; offeringId: string }>
        electiveFits: Array<{ studentId: string }>
      }
    }

    const courseLeaderProof = await loadProfileForRole('COURSE_LEADER')
    expect(courseLeaderProof.monitoringQueue.length).toBeGreaterThan(0)
    expect(courseLeaderProof.monitoringQueue.every(item => ownedOfferingIds.has(item.offeringId))).toBe(true)
    expect(courseLeaderProof.electiveFits.every(item => courseLeaderStudentIds.has(item.studentId))).toBe(true)
    if (courseLeaderProof.monitoringQueue[0]) {
      const [explorerResponse, studentShellResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${courseLeaderProof.monitoringQueue[0].studentId}/risk-explorer`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${courseLeaderProof.monitoringQueue[0].studentId}/card`,
          headers: { cookie: login.cookie },
        }),
      ])
      expect(explorerResponse.statusCode).toBe(200)
      expect(studentShellResponse.statusCode).toBe(200)
    }

    const mentorProof = await loadProfileForRole('MENTOR')
    expect(mentorProof.monitoringQueue.length).toBeGreaterThan(0)
    expect(mentorProof.monitoringQueue.every(item => mentorStudentIds.has(item.studentId))).toBe(true)
    expect(mentorProof.electiveFits.every(item => mentorStudentIds.has(item.studentId))).toBe(true)
    if (mentorProof.monitoringQueue[0]) {
      const [explorerResponse, studentShellResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${mentorProof.monitoringQueue[0].studentId}/risk-explorer`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${mentorProof.monitoringQueue[0].studentId}/card`,
          headers: { cookie: login.cookie },
        }),
      ])
      expect(explorerResponse.statusCode).toBe(200)
      expect(studentShellResponse.statusCode).toBe(200)
    }
  })

  proofRcIt('returns an empty HoD proof surface outside the supervised proof branch', async () => {
    current = await createTestApp()
    const hodLogin = await loginAs(current.app, 'kavitha.rao', '1234')
    expect(hodLogin.response.statusCode).toBe(200)
    const hodGrantId = hodLogin.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    expect(hodGrantId).toBeTruthy()
    await switchRoleContext(hodLogin.cookie, hodGrantId!)

    const summaryResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-summary',
      headers: { cookie: hodLogin.cookie },
    })
    expect(summaryResponse.statusCode).toBe(200)
    expect(summaryResponse.json()).toMatchObject({
      activeRunContext: null,
      totals: {
        studentsCovered: 0,
      },
    })

    const studentsResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-students',
      headers: { cookie: hodLogin.cookie },
    })
    expect(studentsResponse.statusCode).toBe(200)
    expect(studentsResponse.json().items).toEqual([])
  })
})
