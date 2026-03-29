import { afterEach, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import {
  facultyOfferingOwnerships,
  mentorAssignments,
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

    const observedRows = await current.db.select().from(studentObservedSemesterStates).where(and(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
      eq(studentObservedSemesterStates.semesterNumber, 6),
    ))
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
	      checkpointContext: { simulationStageCheckpointId: string; stageKey: string; stageAdvanceBlocked?: boolean }
	      modelProvenance: {
	        simulationCalibrated: true
	        modelVersion: string | null
	        displayProbabilityAllowed?: boolean | null
	        supportWarning?: string | null
	        coEvidenceMode?: string | null
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
    expect(riskExplorer.activeOperationalSemester).toBe(6)
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
    const observedRows = await current.db.select().from(studentObservedSemesterStates).where(
      eq(studentObservedSemesterStates.simulationRunId, activeRun.simulationRunId),
    )
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
    expect(checkpointExplorerResponse.json().activeOperationalSemester).toBe(4)
    expect(checkpointExplorerResponse.json().simulationStageCheckpointId).toBe(playbackCheckpoint!.simulationStageCheckpointId)
  })
})
