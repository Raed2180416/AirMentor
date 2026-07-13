import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { simulationRuns } from '../src/db/schema.js'
import { MSRUAS_PROOF_BATCH_ID } from '../src/adapters/simulation/msruas-proof-sandbox.js'
import { createTestApp, loginAs, TEST_NOW } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  await current?.close()
  current = null
})

describe('teacher login after sysadmin proof run creation', () => {
  it('keeps the teacher dashboard gated before the seeded sandbox is lifecycle-published', async () => {
    current = await createTestApp()

    const teacherLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    expect(teacherLogin.response.statusCode).toBe(200)
    const bootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: teacherLogin.cookie },
    })

    expect(bootstrapResponse.statusCode).toBe(403)
    expect(bootstrapResponse.json()).toMatchObject({ error: 'NO_ACTIVE_PROOF_RUN' })
  })

  it('keeps teachers able to bootstrap when an activating replacement proof run is building', async () => {
    current = await createTestApp()
    const [activeRun] = await current.db.select().from(simulationRuns)
    expect(activeRun).toBeTruthy()
    await current.db
      .update(simulationRuns)
      .set({
        lifecycleState: 'active',
        activeOperationalSemester: 1,
        activeStageKey: 'pre-tt1',
        status: 'active',
        updatedAt: TEST_NOW,
      })
      .where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))

    await current.db.insert(simulationRuns).values({
      simulationRunId: 'simulation_run_replacement_building',
      batchId: MSRUAS_PROOF_BATCH_ID,
      curriculumImportVersionId: activeRun.curriculumImportVersionId,
      curriculumFeatureProfileId: activeRun.curriculumFeatureProfileId,
      curriculumFeatureProfileFingerprint: activeRun.curriculumFeatureProfileFingerprint,
      parentSimulationRunId: activeRun.simulationRunId,
      runLabel: 'Replacement proof run building',
      status: 'running',
      activeFlag: 0,
      seed: 20260429,
      sectionCount: activeRun.sectionCount,
      studentCount: activeRun.studentCount,
      facultyCount: activeRun.facultyCount,
      semesterStart: activeRun.semesterStart,
      semesterEnd: activeRun.semesterEnd,
      activeOperationalSemester: activeRun.activeOperationalSemester,
      activeStageKey: activeRun.activeStageKey,
      simulatedDateIso: activeRun.simulatedDateIso,
      setupConfigJson: activeRun.setupConfigJson,
      scenarioConfigJson: activeRun.scenarioConfigJson,
      lifecycleState: 'running',
      runMode: activeRun.runMode,
      stageBoundaryJson: activeRun.stageBoundaryJson,
      sourceType: activeRun.sourceType,
      policySnapshotJson: activeRun.policySnapshotJson,
      engineVersionsJson: activeRun.engineVersionsJson,
      metricsJson: activeRun.metricsJson,
      progressJson: JSON.stringify({
        phase: 'running',
        percent: 10,
        requestedActivate: true,
        executionStarted: true,
      }),
      startedAt: TEST_NOW,
      completedAt: null,
      failureCode: null,
      failureMessage: null,
      workerLeaseToken: 'proof_worker_lease_test',
      workerLeaseExpiresAt: '2026-03-16T00:01:00.000Z',
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    const teacherLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    expect(teacherLogin.response.statusCode).toBe(200)
    const bootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: teacherLogin.cookie },
    })
    expect(bootstrapResponse.statusCode).toBe(200)

    const activeRuns = (await current.db.select().from(simulationRuns))
      .filter(run => run.batchId === MSRUAS_PROOF_BATCH_ID && run.activeFlag === 1)
    expect(activeRuns).toHaveLength(1)
  })
})
