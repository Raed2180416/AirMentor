import { afterEach, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import {
  batches,
  facultyOfferingOwnerships,
  mentorAssignments,
  riskEvidenceSnapshots,
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

function sortObservedRows<T extends { studentId: string; semesterNumber: number; createdAt?: string }>(rows: T[]) {
  return rows
    .slice()
    .sort((left, right) => left.studentId.localeCompare(right.studentId)
      || left.semesterNumber - right.semesterNumber
      || String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
}

describe('student risk explorer', () => {
  it('returns checkpoint-bound proof analysis for an in-scope course leader and matches shell evidence', async () => {
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

    const observedRows = sortObservedRows(await current.db.select().from(studentObservedSemesterStates).where(and(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
      eq(studentObservedSemesterStates.semesterNumber, 6),
    )))
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    const [riskExplorerResponse, cardResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/students/${accessibleStudentId}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
        headers: { cookie: login.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${accessibleStudentId}/card?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
        headers: { cookie: login.cookie },
      }),
    ])

    expect(riskExplorerResponse.statusCode).toBe(200)
    expect(cardResponse.statusCode).toBe(200)

    const riskExplorer = riskExplorerResponse.json() as {
      simulationStageCheckpointId: string | null
      scopeDescriptor: { scopeType: string; simulationRunId: string | null; studentId: string | null }
      resolvedFrom: { kind: string; scopeId: string | null }
      scopeMode: string
      countSource: string
      activeOperationalSemester: number | null
      checkpointContext: {
        simulationStageCheckpointId: string
        stageKey: string
        semesterNumber: number
        stageAdvanceBlocked?: boolean
      }
      modelProvenance: {
        simulationCalibrated: true
        modelVersion: string | null
        displayProbabilityAllowed?: boolean | null
        supportWarning?: string | null
        coEvidenceMode?: string | null
      }
      featureCompleteness: {
        confidenceClass: 'high' | 'medium' | 'low'
      }
      featureConfidenceClass: 'high' | 'medium' | 'low'
      derivedScenarioHeads: {
        scale: 'advisory-index-0-100'
        displayProbabilityAllowed: false
        supportWarning: string
      }
      trainedRiskHeads: { currentRiskBand: string | null; overallCourseRiskProbScaled: number | null }
      trainedRiskHeadDisplays?: Record<string, {
        displayProbabilityAllowed: boolean
        supportWarning: string | null
        calibrationMethod: string
      } | undefined> | null
      currentEvidence: { attendancePct: number; weakCoCount: number; coEvidenceMode?: string | null }
      currentStatus: {
        riskBand: string | null
        riskProbScaled: number | null
        riskChangeFromPreviousCheckpointScaled?: number | null
        counterfactualLiftScaled?: number | null
        policyComparison?: { counterfactualLiftScaled: number | null; policyPhenotype?: string | null } | null
      }
      counterfactual: { panelLabel: string; counterfactualLiftScaled?: number | null } | null
      policyComparison?: { counterfactualLiftScaled: number | null; policyPhenotype?: string | null } | null
      weakCourseOutcomes: unknown[]
    }
    const card = cardResponse.json() as {
      simulationStageCheckpointId: string | null
      overview: {
        currentEvidence: { attendancePct: number; weakCoCount: number; coEvidenceMode?: string | null }
        currentStatus: {
          riskBand: string | null
          riskProbScaled: number | null
          riskChangeFromPreviousCheckpointScaled?: number | null
          counterfactualLiftScaled?: number | null
          policyComparison?: { counterfactualLiftScaled: number | null; policyPhenotype?: string | null } | null
        }
      }
    }

    expect(riskExplorer).toMatchObject({
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
      modelProvenance: {
        simulationCalibrated: true,
      },
      counterfactual: {
        panelLabel: 'Policy Derived',
        counterfactualLiftScaled: expect.any(Number),
      },
    })
    expect(riskExplorer.scopeMode).toBe('proof')
    expect(riskExplorer.countSource).toBe('proof-checkpoint')
    expect(riskExplorer.activeOperationalSemester).toBe(selectedCheckpoint.semesterNumber)
    expect(riskExplorer.checkpointContext.semesterNumber).toBe(selectedCheckpoint.semesterNumber)
    expect(riskExplorer.trainedRiskHeads.currentRiskBand).toBeTruthy()
    const overallCourseHeadDisplay = riskExplorer.trainedRiskHeadDisplays?.overallCourseRisk ?? null
    if (overallCourseHeadDisplay?.displayProbabilityAllowed === false) {
      expect(riskExplorer.trainedRiskHeads.overallCourseRiskProbScaled).toBeNull()
      expect(overallCourseHeadDisplay.supportWarning).toBeTruthy()
    } else {
      expect(riskExplorer.trainedRiskHeads.overallCourseRiskProbScaled).not.toBeNull()
    }
    expect(riskExplorer.currentEvidence.attendancePct).toBe(card.overview.currentEvidence.attendancePct)
    expect(riskExplorer.currentEvidence.weakCoCount).toBe(card.overview.currentEvidence.weakCoCount)
    expect(riskExplorer.modelProvenance.coEvidenceMode).toBe(card.overview.currentEvidence.coEvidenceMode)
    expect(riskExplorer.currentStatus.riskBand).toBe(card.overview.currentStatus.riskBand)
    expect(riskExplorer.currentStatus.riskProbScaled).toBe(card.overview.currentStatus.riskProbScaled)
    expect(riskExplorer.currentStatus.riskChangeFromPreviousCheckpointScaled).toBe(card.overview.currentStatus.riskChangeFromPreviousCheckpointScaled)
    expect(riskExplorer.currentStatus.counterfactualLiftScaled).toBe(card.overview.currentStatus.counterfactualLiftScaled)
    expect(riskExplorer.policyComparison?.counterfactualLiftScaled ?? null).toBe(card.overview.currentStatus.policyComparison?.counterfactualLiftScaled ?? null)
    expect(riskExplorer.policyComparison?.policyPhenotype ?? null).toBe(card.overview.currentStatus.policyComparison?.policyPhenotype ?? null)
    expect(riskExplorer.featureConfidenceClass).toBe(riskExplorer.featureCompleteness.confidenceClass)
    expect(riskExplorer.derivedScenarioHeads.scale).toBe('advisory-index-0-100')
    expect(riskExplorer.derivedScenarioHeads.displayProbabilityAllowed).toBe(false)
    expect(riskExplorer.derivedScenarioHeads.supportWarning).toContain('advisory indices')
    expect(riskExplorer.weakCourseOutcomes.length).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(riskExplorer)).not.toContain('forgetRate')
    expect(JSON.stringify(riskExplorer)).not.toContain('worldContext')
    expect(JSON.stringify(riskExplorer)).not.toContain('randomSeed')
  })

  it('enforces scoped access and lets sysadmin inspect an archived run explicitly', async () => {
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
        url: `/api/academic/students/${assignedStudentId}/risk-explorer`,
        headers: { cookie: mentorLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/students/${unassignedStudentId}/risk-explorer`,
        headers: { cookie: mentorLogin.cookie },
      }),
    ])
    expect(mentorAllowed.statusCode).toBe(200)
    expect(mentorBlocked.statusCode).toBe(403)

    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    await current.db.update(simulationRuns).set({
      activeFlag: 0,
      status: 'archived',
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))
    const adminResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/students/${assignedStudentId}/risk-explorer?simulationRunId=${encodeURIComponent(activeRun.simulationRunId)}`,
      headers: { cookie: adminLogin.cookie },
    })
    expect(adminResponse.statusCode).toBe(200)
    expect(adminResponse.json().simulationRunId).toBe(activeRun.simulationRunId)
  })

  it('suppresses displayed probabilities when fallback-simulated evidence is partial', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const roleResponse = login.body.activeRoleGrant.roleCode === 'COURSE_LEADER'
      ? login.body
      : (await switchToRole(login.cookie, login.body.availableRoleGrants, 'COURSE_LEADER')).json()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()

    const firstRecompute = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(firstRecompute.statusCode).toBe(200)

    const ownershipRows = await current.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, roleResponse.faculty.facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
    const ownedOfferingIds = new Set(ownershipRows.map(row => row.offeringId))
    const observedRows = sortObservedRows(await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    ))
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    await current.db.delete(riskEvidenceSnapshots).where(and(
      eq(riskEvidenceSnapshots.simulationRunId, activeRun.simulationRunId),
      eq(riskEvidenceSnapshots.studentId, accessibleStudentId!),
      eq(riskEvidenceSnapshots.stageKey, 'post-see'),
    ))

    const secondRecompute = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(secondRecompute.statusCode).toBe(200)

    const explorerResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/students/${accessibleStudentId}/risk-explorer`,
      headers: { cookie: login.cookie },
    })
    expect(explorerResponse.statusCode).toBe(200)
    const explorerPayload = explorerResponse.json() as {
      featureCompleteness: {
        complete: boolean
        fallbackMode: 'graph-aware' | 'policy-only'
        confidenceClass: 'high' | 'medium' | 'low'
      }
      featureConfidenceClass: 'high' | 'medium' | 'low'
      modelProvenance: {
        coEvidenceMode?: string | null
        displayProbabilityAllowed?: boolean | null
        supportWarning?: string | null
      }
      trainedRiskHeads: {
        overallCourseRiskProbScaled: number | null
      }
      currentStatus: {
        riskProbScaled: number | null
      }
    }

    expect(explorerPayload.featureCompleteness.complete).toBe(false)
    expect(explorerPayload.featureCompleteness.fallbackMode).toBe('policy-only')
    expect(explorerPayload.featureCompleteness.confidenceClass).toBe('low')
    expect(explorerPayload.featureConfidenceClass).toBe('low')
    expect(explorerPayload.modelProvenance.coEvidenceMode).toBe('fallback-simulated')
    expect(explorerPayload.modelProvenance.displayProbabilityAllowed).toBe(false)
    expect(explorerPayload.modelProvenance.supportWarning).toContain('Fallback-simulated evidence is low confidence')
    expect(explorerPayload.trainedRiskHeads.overallCourseRiskProbScaled).toBeNull()
    expect(explorerPayload.currentStatus.riskProbScaled).toBeNull()
  })

  it('keeps the same checkpoint provenance tuple aligned across sysadmin, HoD, faculty profile, student shell, and risk explorer', async () => {
    current = await createTestApp()
    const facultyLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
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

    const [selectedCheckpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, 6),
    )).orderBy(asc(simulationStageCheckpoints.stageOrder))
    expect(selectedCheckpoint).toBeTruthy()

    let activeRoleCode = facultyLogin.body.activeRoleGrant.roleCode
    if (activeRoleCode !== 'COURSE_LEADER') {
      await switchToRole(facultyLogin.cookie, facultyLogin.body.availableRoleGrants, 'COURSE_LEADER')
      activeRoleCode = 'COURSE_LEADER'
    }

    const facultyProfileResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/faculty-profile/${facultyLogin.body.faculty.facultyId}?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
      headers: { cookie: facultyLogin.cookie },
    })
    expect(facultyProfileResponse.statusCode).toBe(200)
    const facultyProfile = facultyProfileResponse.json() as {
      proofOperations: {
        scopeDescriptor: { simulationRunId?: string | null; simulationStageCheckpointId?: string | null }
        resolvedFrom: { kind: string; scopeId: string | null }
        scopeMode: string
        countSource: string
        activeOperationalSemester: number | null
        monitoringStudent?: { studentId: string } | null
        monitoringQueue: Array<{ studentId: string }>
      }
    }
    const mentorRows = await current.db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, facultyLogin.body.faculty.facultyId))
    const mentorScopedStudentId = mentorRows.find(row => row.effectiveTo === null)?.studentId ?? mentorRows[0]?.studentId ?? null
    const primaryStudentId = facultyProfile.proofOperations.monitoringStudent?.studentId
      ?? facultyProfile.proofOperations.monitoringQueue[0]?.studentId
      ?? mentorScopedStudentId
      ?? null
    expect(primaryStudentId).toBeTruthy()

    const [riskExplorerResponse, studentShellResponse, sysadminCheckpointStudentResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/students/${primaryStudentId}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
        headers: { cookie: facultyLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${primaryStudentId}/card?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
        headers: { cookie: facultyLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/admin/proof-runs/${activeRun.simulationRunId}/checkpoints/${selectedCheckpoint.simulationStageCheckpointId}/students/${primaryStudentId}`,
        headers: { cookie: adminLogin.cookie },
      }),
    ])

    if (activeRoleCode !== 'HOD') {
      await switchToRole(facultyLogin.cookie, facultyLogin.body.availableRoleGrants, 'HOD')
      activeRoleCode = 'HOD'
    }
    const hodSummaryResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/hod/proof-summary?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
      headers: { cookie: facultyLogin.cookie },
    })

    expect(riskExplorerResponse.statusCode).toBe(200)
    expect(studentShellResponse.statusCode).toBe(200)
    expect(hodSummaryResponse.statusCode).toBe(200)
    expect(sysadminCheckpointStudentResponse.statusCode).toBe(200)

    const riskExplorer = riskExplorerResponse.json() as {
      simulationRunId: string
      simulationStageCheckpointId: string | null
      activeOperationalSemester: number | null
      scopeMode: string
      countSource: string
      resolvedFrom: { kind: string; scopeId: string | null }
      student: { studentId: string }
    }
    const studentShell = studentShellResponse.json() as {
      simulationRunId: string
      simulationStageCheckpointId: string | null
      activeOperationalSemester: number | null
      scopeMode: string
      countSource: string
      resolvedFrom: { kind: string; scopeId: string | null }
      student: { studentId: string }
    }
    const hodSummary = hodSummaryResponse.json() as {
      activeRunContext: { simulationRunId: string }
      scopeDescriptor: { simulationStageCheckpointId: string | null }
      activeOperationalSemester: number | null
      scopeMode: string
      countSource: string
      resolvedFrom: { kind: string; scopeId: string | null }
    }
    const sysadminCheckpointStudent = sysadminCheckpointStudentResponse.json() as {
      checkpoint: { simulationStageCheckpointId: string; semesterNumber: number }
      student: { studentId: string }
    }

    const facultyTuple = {
      simulationRunId: facultyProfile.proofOperations.scopeDescriptor.simulationRunId,
      simulationStageCheckpointId: facultyProfile.proofOperations.scopeDescriptor.simulationStageCheckpointId,
      activeOperationalSemester: facultyProfile.proofOperations.activeOperationalSemester,
      scopeMode: facultyProfile.proofOperations.scopeMode,
      countSource: facultyProfile.proofOperations.countSource,
      resolvedFrom: {
        kind: facultyProfile.proofOperations.resolvedFrom.kind,
        scopeId: facultyProfile.proofOperations.resolvedFrom.scopeId,
      },
      studentId: primaryStudentId,
    }
    const riskTuple = {
      simulationRunId: riskExplorer.simulationRunId,
      simulationStageCheckpointId: riskExplorer.simulationStageCheckpointId,
      activeOperationalSemester: riskExplorer.activeOperationalSemester,
      scopeMode: riskExplorer.scopeMode,
      countSource: riskExplorer.countSource,
      resolvedFrom: {
        kind: riskExplorer.resolvedFrom.kind,
        scopeId: riskExplorer.resolvedFrom.scopeId,
      },
      studentId: riskExplorer.student.studentId,
    }
    const studentShellTuple = {
      simulationRunId: studentShell.simulationRunId,
      simulationStageCheckpointId: studentShell.simulationStageCheckpointId,
      activeOperationalSemester: studentShell.activeOperationalSemester,
      scopeMode: studentShell.scopeMode,
      countSource: studentShell.countSource,
      resolvedFrom: {
        kind: studentShell.resolvedFrom.kind,
        scopeId: studentShell.resolvedFrom.scopeId,
      },
      studentId: studentShell.student.studentId,
    }
    const hodTuple = {
      simulationRunId: hodSummary.activeRunContext.simulationRunId,
      simulationStageCheckpointId: hodSummary.scopeDescriptor.simulationStageCheckpointId,
      activeOperationalSemester: hodSummary.activeOperationalSemester,
      scopeMode: hodSummary.scopeMode,
      countSource: hodSummary.countSource,
      resolvedFrom: {
        kind: hodSummary.resolvedFrom.kind,
        scopeId: hodSummary.resolvedFrom.scopeId,
      },
    }
    const sysadminTuple = {
      simulationRunId: activeRun.simulationRunId,
      simulationStageCheckpointId: sysadminCheckpointStudent.checkpoint.simulationStageCheckpointId,
      activeOperationalSemester: sysadminCheckpointStudent.checkpoint.semesterNumber,
      studentId: sysadminCheckpointStudent.student.studentId,
    }

    expect(facultyTuple).toEqual(riskTuple)
    expect(studentShellTuple).toEqual(riskTuple)
    expect(hodTuple).toEqual({
      simulationRunId: riskTuple.simulationRunId,
      simulationStageCheckpointId: riskTuple.simulationStageCheckpointId,
      activeOperationalSemester: riskTuple.activeOperationalSemester,
      scopeMode: riskTuple.scopeMode,
      countSource: riskTuple.countSource,
      resolvedFrom: riskTuple.resolvedFrom,
    })
    expect(sysadminTuple).toEqual({
      simulationRunId: riskTuple.simulationRunId,
      simulationStageCheckpointId: riskTuple.simulationStageCheckpointId,
      activeOperationalSemester: riskTuple.activeOperationalSemester,
      studentId: riskTuple.studentId,
    })
  })

  it('uses the activated proof semester for the default risk explorer while keeping checkpoint playback separate', async () => {
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
    const observedRows = sortObservedRows(await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    ))
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    const [defaultExplorerResponse, checkpointExplorerResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/students/${accessibleStudentId}/risk-explorer`,
        headers: { cookie: login.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/students/${accessibleStudentId}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(playbackCheckpoint!.simulationStageCheckpointId)}`,
        headers: { cookie: login.cookie },
      }),
    ])

    expect(defaultExplorerResponse.statusCode).toBe(200)
    expect(checkpointExplorerResponse.statusCode).toBe(200)
    expect(defaultExplorerResponse.json().countSource).toBe('proof-run')
    expect(defaultExplorerResponse.json().activeOperationalSemester).toBe(4)
    expect(checkpointExplorerResponse.json().countSource).toBe('proof-checkpoint')
    expect(checkpointExplorerResponse.json().activeOperationalSemester).toBe(playbackCheckpoint!.semesterNumber)
    expect(checkpointExplorerResponse.json().simulationStageCheckpointId).toBe(playbackCheckpoint!.simulationStageCheckpointId)
    expect(checkpointExplorerResponse.json().checkpointContext?.semesterNumber).toBe(playbackCheckpoint!.semesterNumber)
  })

  it('keeps the default risk explorer aligned with activated semesters 1 through 3', async () => {
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
    const observedRows = sortObservedRows(await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    ))
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

      const [defaultExplorerResponse, checkpointExplorerResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${accessibleStudentId}/risk-explorer`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${accessibleStudentId}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
      ])

      expect(defaultExplorerResponse.statusCode).toBe(200)
      expect(checkpointExplorerResponse.statusCode).toBe(200)
      const defaultPayload = defaultExplorerResponse.json()
      expect(defaultPayload.countSource).toBe('proof-run')
      expect(defaultPayload.activeOperationalSemester).toBe(semesterNumber)
      expect(defaultPayload.simulationStageCheckpointId ?? null).toBeNull()
      expect(defaultPayload.checkpointContext ?? null).toBeNull()
      expect(checkpointExplorerResponse.json().countSource).toBe('proof-checkpoint')
      expect(checkpointExplorerResponse.json().activeOperationalSemester).toBe(checkpoint!.semesterNumber)
      expect(checkpointExplorerResponse.json().simulationStageCheckpointId).toBe(checkpoint!.simulationStageCheckpointId)
      expect(checkpointExplorerResponse.json().checkpointContext?.semesterNumber).toBe(checkpoint!.semesterNumber)
      const checkpointPayload = checkpointExplorerResponse.json()
      const checkpointCandidates = checkpointPayload.policyComparison?.candidates ?? []
      expect(checkpointCandidates.length).toBeGreaterThan(0)
      const checkpointRecommendedAction = checkpointPayload.policyComparison?.recommendedAction ?? null
      if (checkpointRecommendedAction) {
        expect(checkpointCandidates.some((item: { action: string }) => item.action === checkpointRecommendedAction)).toBe(true)
      }
      const actionCatalog = checkpointPayload.policyComparison?.actionCatalog ?? null
      expect(actionCatalog?.version).toBe('policy-action-catalog-v1')
      expect(actionCatalog?.stageKey).toBe(checkpointPayload.checkpointContext?.stageKey)
      expect(actionCatalog?.allCandidatesStageValid).toBe(true)
      expect(actionCatalog?.recommendedActionStageValid).toBe(true)
      if (actionCatalog) {
        const stageActions = new Set(actionCatalog.stageActions as string[])
        expect(checkpointCandidates.every((item: { action: string }) => stageActions.has(item.action))).toBe(true)
      }
      const checkpointNoActionRisk = checkpointPayload.policyComparison?.noActionRiskProbScaled ?? checkpointPayload.counterfactual?.noActionRiskProbScaled
      expect(checkpointNoActionRisk).toEqual(expect.any(Number))
    }
  })

  it('keeps the default risk explorer aligned with activated semesters 4 through 6 using the late checkpoint walk', async () => {
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
    const observedRows = sortObservedRows(await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    ))
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

      const [defaultExplorerResponse, checkpointExplorerResponse, dashboardResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${accessibleStudentId}/risk-explorer`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${accessibleStudentId}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(checkpoint!.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/admin/batches/${activeRun.batchId}/proof-dashboard`,
          headers: { cookie: adminLogin.cookie },
        }),
      ])

      expect(defaultExplorerResponse.statusCode).toBe(200)
      expect(checkpointExplorerResponse.statusCode).toBe(200)
      expect(dashboardResponse.statusCode).toBe(200)
      const defaultPayload = defaultExplorerResponse.json()
      expect(['proof-run', 'proof-checkpoint']).toContain(defaultPayload.countSource)
      expect(defaultPayload.activeOperationalSemester).toBe(semesterNumber)
      if (defaultPayload.countSource === 'proof-checkpoint') {
        expect(defaultPayload.simulationStageCheckpointId).toBe(checkpoint!.simulationStageCheckpointId)
        expect(defaultPayload.checkpointContext?.semesterNumber).toBe(semesterNumber)
        expect(defaultPayload.checkpointContext?.stageKey).toBe('post-see')
      } else {
        expect(defaultPayload.simulationStageCheckpointId ?? null).toBeNull()
        expect(defaultPayload.checkpointContext ?? null).toBeNull()
      }
      const checkpointPayload = checkpointExplorerResponse.json()
      const dashboardCheckpoint = dashboardResponse.json().activeRunDetail?.checkpoints?.find(
        (item: { simulationStageCheckpointId: string }) => item.simulationStageCheckpointId === checkpoint!.simulationStageCheckpointId,
      )
      expect(dashboardCheckpoint).toBeTruthy()
      expect(checkpointPayload.countSource).toBe('proof-checkpoint')
      expect(checkpointPayload.activeOperationalSemester).toBe(checkpoint!.semesterNumber)
      expect(checkpointPayload.simulationStageCheckpointId).toBe(checkpoint!.simulationStageCheckpointId)
      expect(checkpointPayload.checkpointContext?.semesterNumber).toBe(checkpoint!.semesterNumber)
      expect(checkpointPayload.checkpointContext?.stageKey).toBe('post-see')
      expect(checkpointPayload.checkpointContext?.stageAdvanceBlocked).toBe(dashboardCheckpoint?.stageAdvanceBlocked)
      expect(checkpointPayload.checkpointContext?.playbackAccessible).toBe(dashboardCheckpoint?.playbackAccessible)
      expect(checkpointPayload.checkpointContext?.blockedByCheckpointId ?? null).toBe(dashboardCheckpoint?.blockedByCheckpointId ?? null)
      expect(checkpointPayload.checkpointContext?.blockedProgressionReason ?? null).toBe(dashboardCheckpoint?.blockedProgressionReason ?? null)
      expect(checkpointPayload.modelProvenance?.evidenceWindow).toBe(`${semesterNumber}-post-see`)
      const checkpointCandidates = checkpointPayload.policyComparison?.candidates ?? []
      expect(checkpointCandidates.length).toBeGreaterThan(0)
      const checkpointRecommendedAction = checkpointPayload.policyComparison?.recommendedAction ?? null
      if (checkpointRecommendedAction) {
        expect(checkpointCandidates.some((item: { action: string }) => item.action === checkpointRecommendedAction)).toBe(true)
      }
      const actionCatalog = checkpointPayload.policyComparison?.actionCatalog ?? null
      expect(actionCatalog?.version).toBe('policy-action-catalog-v1')
      expect(actionCatalog?.stageKey).toBe(checkpointPayload.checkpointContext?.stageKey)
      expect(actionCatalog?.allCandidatesStageValid).toBe(true)
      expect(actionCatalog?.recommendedActionStageValid).toBe(true)
      if (actionCatalog) {
        const stageActions = new Set(actionCatalog.stageActions as string[])
        expect(checkpointCandidates.every((item: { action: string }) => stageActions.has(item.action))).toBe(true)
      }
      const checkpointNoActionRisk = checkpointPayload.policyComparison?.noActionRiskProbScaled ?? checkpointPayload.counterfactual?.noActionRiskProbScaled
      expect(checkpointNoActionRisk).toEqual(expect.any(Number))
      expect(checkpointPayload.policyComparison?.counterfactualLiftScaled ?? checkpointPayload.counterfactual?.counterfactualLiftScaled).toEqual(expect.any(Number))
      if (semesterNumber < 6) {
        expect(checkpointPayload.electiveFit).toBeNull()
      } else {
        expect(checkpointPayload.electiveFit).toMatchObject({
          recommendedCode: expect.any(String),
          recommendedTitle: expect.any(String),
          stream: expect.any(String),
        })
      }
    }
  })

  it('keeps default proof surfaces checkpoint-explicit when semester pointers diverge', async () => {
    current = await createTestApp()
    const facultyLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const roleResponse = facultyLogin.body.activeRoleGrant.roleCode === 'COURSE_LEADER'
      ? facultyLogin.body
      : (await switchToRole(facultyLogin.cookie, facultyLogin.body.availableRoleGrants, 'COURSE_LEADER')).json()
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
    ).orderBy(
      asc(simulationStageCheckpoints.semesterNumber),
      asc(simulationStageCheckpoints.stageOrder),
    )
    const forcedActiveSemester = checkpointRows.at(-1)?.semesterNumber
    expect(forcedActiveSemester).not.toBeNull()
    if (forcedActiveSemester == null) throw new Error('Expected proof checkpoint semester')
    await current.db.update(simulationRuns).set({
      activeOperationalSemester: forcedActiveSemester,
    }).where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))

    const [activeBatch] = await current.db.select().from(batches).where(eq(batches.batchId, activeRun.batchId))
    expect(activeBatch).toBeTruthy()
    const mismatchSemester = forcedActiveSemester === 1 ? 2 : forcedActiveSemester - 1
    await current.db.update(batches).set({
      currentSemester: mismatchSemester,
    }).where(eq(batches.batchId, activeRun.batchId))

    const ownershipRows = await current.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, roleResponse.faculty.facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
    const ownedOfferingIds = new Set(ownershipRows.map(row => row.offeringId))
    const observedRows = sortObservedRows(await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    ))
    const accessibleStudentId = observedRows.find(row => {
      const offeringId = getObservedOfferingId(row)
      return !!offeringId && ownedOfferingIds.has(offeringId)
    })?.studentId
    expect(accessibleStudentId).toBeTruthy()

    const [facultyProfileResponse, riskExplorerResponse, studentShellResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/faculty-profile/${roleResponse.faculty.facultyId}`,
        headers: { cookie: facultyLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/students/${accessibleStudentId}/risk-explorer`,
        headers: { cookie: facultyLogin.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${accessibleStudentId}/card`,
        headers: { cookie: facultyLogin.cookie },
      }),
    ])

    expect(facultyProfileResponse.statusCode).toBe(200)
    expect(riskExplorerResponse.statusCode).toBe(200)
    expect(studentShellResponse.statusCode).toBe(200)

    const roleSwitchResponse = await switchToRole(facultyLogin.cookie, roleResponse.availableRoleGrants, 'HOD')
    expect(roleSwitchResponse.statusCode).toBe(200)

    const hodSummaryResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/hod/proof-summary',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(hodSummaryResponse.statusCode).toBe(200)

    const facultyProfile = facultyProfileResponse.json() as {
      proofOperations: {
        countSource: string
        activeOperationalSemester: number | null
        scopeDescriptor: { simulationStageCheckpointId: string | null }
        resolvedFrom: { kind: string; scopeId: string | null }
      }
    }
    const riskExplorer = riskExplorerResponse.json() as {
      countSource: string
      activeOperationalSemester: number | null
      simulationStageCheckpointId: string | null
      resolvedFrom: { kind: string; scopeId: string | null }
    }
    const studentShell = studentShellResponse.json() as {
      countSource: string
      activeOperationalSemester: number | null
      simulationStageCheckpointId: string | null
      resolvedFrom: { kind: string; scopeId: string | null }
    }
    const hodSummary = hodSummaryResponse.json() as {
      countSource: string
      activeOperationalSemester: number | null
      scopeDescriptor: { simulationStageCheckpointId: string | null }
      resolvedFrom: { kind: string; scopeId: string | null }
    }

    const fallbackCheckpointId = riskExplorer.simulationStageCheckpointId
      ?? studentShell.simulationStageCheckpointId
      ?? facultyProfile.proofOperations.scopeDescriptor.simulationStageCheckpointId
      ?? hodSummary.scopeDescriptor.simulationStageCheckpointId
    expect(fallbackCheckpointId).toBeTruthy()

    expect(facultyProfile.proofOperations.countSource).toBe('proof-checkpoint')
    expect(facultyProfile.proofOperations.activeOperationalSemester).toBe(forcedActiveSemester)
    expect(facultyProfile.proofOperations.scopeDescriptor.simulationStageCheckpointId).toBe(fallbackCheckpointId)
    expect(facultyProfile.proofOperations.resolvedFrom).toMatchObject({
      kind: 'proof-checkpoint',
      scopeId: fallbackCheckpointId,
    })

    expect(riskExplorer.countSource).toBe('proof-checkpoint')
    expect(riskExplorer.activeOperationalSemester).toBe(forcedActiveSemester)
    expect(riskExplorer.simulationStageCheckpointId).toBe(fallbackCheckpointId)
    expect(riskExplorer.resolvedFrom).toMatchObject({
      kind: 'proof-checkpoint',
      scopeId: fallbackCheckpointId,
    })

    expect(studentShell.countSource).toBe('proof-checkpoint')
    expect(studentShell.activeOperationalSemester).toBe(forcedActiveSemester)
    expect(studentShell.simulationStageCheckpointId).toBe(fallbackCheckpointId)
    expect(studentShell.resolvedFrom).toMatchObject({
      kind: 'proof-checkpoint',
      scopeId: fallbackCheckpointId,
    })

    expect(hodSummary.countSource).toBe('proof-checkpoint')
    expect(hodSummary.activeOperationalSemester).toBe(forcedActiveSemester)
    expect(hodSummary.scopeDescriptor.simulationStageCheckpointId).toBe(fallbackCheckpointId)
    expect(hodSummary.resolvedFrom).toMatchObject({
      kind: 'proof-checkpoint',
      scopeId: fallbackCheckpointId,
    })
  })
})
