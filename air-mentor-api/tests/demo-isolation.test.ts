import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestApp, loginAs, TEST_NOW, TEST_ORIGIN } from './helpers/test-app.js'
import {
  students,
  sectionOfferings,
  simulationRuns,
  demoWorkspaces,
  batches,
  sessions,
  simulationStageCheckpoints,
  studentObservedSemesterStates,
} from '../src/db/schema.js'
import {
  assertSafeDemoScopeName,
  buildDemoScopeName,
  demoWorkspaceSchemaExists,
  quotePgIdentifier,
} from '../src/lib/demo-workspace-scope.js'
import {
  MSRUAS_PROOF_BATCH_ID,
  MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
} from '../src/lib/msruas-proof-sandbox.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('demo workspace isolation', () => {
  it('builds safe demo schema names and rejects unsafe identifiers', async () => {
    expect(buildDemoScopeName('demo_ws_abc123')).toBe('demo_ws_demo_ws_abc123')
    expect(buildDemoScopeName('demo-ws-ABC.123')).toBe('demo_ws_demo_ws_abc_123')
    expect(() => assertSafeDemoScopeName('demo_ws_good_123')).not.toThrow()
    expect(() => assertSafeDemoScopeName('public')).toThrow(/Unsafe demo scope name/)
    expect(() => assertSafeDemoScopeName('demo_ws_bad;drop')).toThrow(/Unsafe demo scope name/)
    expect(quotePgIdentifier('demo_ws_good_123')).toBe('"demo_ws_good_123"')
  })

  it('creates demo workspaces with schema-scope registry metadata', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    const [batch] = await current.db.select().from(batches)
    expect(batch).toBeTruthy()

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Schema Scope Demo', batchId: batch.batchId },
    })
    expect(createRes.statusCode).toBe(200)
    const body = createRes.json() as {
      demoWorkspaceId: string
      scopeKind?: string | null
      scopeName?: string | null
      sourceBatchId?: string | null
      metadataJson?: string | null
    }
    expect(body.scopeKind).toBe('schema')
    expect(body.scopeName).toMatch(/^demo_ws_[a-z0-9_]+$/)
    expect(body.sourceBatchId).toBe(batch.batchId)

    const [row] = await current.db
      .select()
      .from(demoWorkspaces)
      .where(eq(demoWorkspaces.demoWorkspaceId, body.demoWorkspaceId))
    expect(row.scopeKind).toBe('schema')
    expect(row.scopeName).toBe(body.scopeName)
    expect(row.sourceBatchId).toBe(batch.batchId)
    expect(row.createdByFacultyId).toBeTruthy()
    expect(await demoWorkspaceSchemaExists(current.pool, body.scopeName ?? '')).toBe(true)
  })

  it('binds demo sessions to the active demo workspace pointer and rejects pointer drift', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Session Scope Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'sysadmin', password: 'admin1234' },
    })
    expect(demoLoginRes.statusCode).toBe(200)
    const demoLoginBody = demoLoginRes.json() as { sessionId: string; demoWorkspaceId?: string | null }
    expect(demoLoginBody.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)

    const demoCookie = Array.isArray(demoLoginRes.headers['set-cookie'])
      ? demoLoginRes.headers['set-cookie'][0]
      : demoLoginRes.headers['set-cookie']
    expect(demoCookie).toBeTruthy()

    const [sessionRow] = await current.db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionId, demoLoginBody.sessionId))
    expect(sessionRow.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)

    const restoreWithPointer = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        cookie: demoCookie,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(restoreWithPointer.statusCode).toBe(200)
    expect((restoreWithPointer.json() as { demoWorkspaceId?: string | null }).demoWorkspaceId).toBe(demoWs.demoWorkspaceId)

    const restoreWithoutPointer = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: demoCookie },
    })
    expect(restoreWithoutPointer.statusCode).toBe(401)

    const otherCreateRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Other Session Scope Demo' },
    })
    expect(otherCreateRes.statusCode).toBe(200)
    const otherWs = otherCreateRes.json() as { demoWorkspaceId: string }

    const restoreWithWrongPointer = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        cookie: demoCookie,
        'x-airmentor-demo-workspace': otherWs.demoWorkspaceId,
      },
    })
    expect(restoreWithWrongPointer.statusCode).toBe(401)

    const globalRestore = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: adminLogin.cookie },
    })
    expect(globalRestore.statusCode).toBe(200)
    expect((globalRestore.json() as { demoWorkspaceId?: string | null }).demoWorkspaceId).toBeNull()

    const resetRes = await current.app.inject({
      method: 'DELETE',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
    })
    expect(resetRes.statusCode).toBe(200)
    expect((resetRes.json() as { deletedSessions?: number }).deletedSessions).toBe(1)

    const restoreAfterReset = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        cookie: demoCookie,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(restoreAfterReset.statusCode).toBe(401)
  })

  it('does not let a demo-bound teacher bootstrap from the global active proof run', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Bootstrap Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoTeacherLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'devika.shetty', password: 'faculty1234' },
    })
    expect(demoTeacherLoginRes.statusCode).toBe(200)
    const demoTeacherCookie = Array.isArray(demoTeacherLoginRes.headers['set-cookie'])
      ? demoTeacherLoginRes.headers['set-cookie'][0]
      : demoTeacherLoginRes.headers['set-cookie']
    expect(demoTeacherCookie).toBeTruthy()

    const [globalActiveRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveRun).toBeTruthy()
    expect(globalActiveRun.demoWorkspaceId).toBeNull()

    const bootstrapRes = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: {
        cookie: demoTeacherCookie,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(bootstrapRes.statusCode).toBe(403)
    expect(bootstrapRes.json()).toMatchObject({
      error: 'NO_ACTIVE_PROOF_RUN',
    })
  })

  it('tags proof runs created from a demo-bound sysadmin session with the demo workspace', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Proof Run Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoAdminLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'sysadmin', password: 'admin1234' },
    })
    expect(demoAdminLoginRes.statusCode).toBe(200)
    const demoAdminCookie = Array.isArray(demoAdminLoginRes.headers['set-cookie'])
      ? demoAdminLoginRes.headers['set-cookie'][0]
      : demoAdminLoginRes.headers['set-cookie']
    expect(demoAdminCookie).toBeTruthy()

    const createRunRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-runs`,
      headers: {
        cookie: demoAdminCookie,
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: {
        curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
        seed: 20260510,
        runLabel: 'Scoped proof run demo test',
        activate: false,
      },
    })
    expect(createRunRes.statusCode).toBe(200)
    const createdRun = createRunRes.json() as { simulationRunId: string }

    const [runRow] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, createdRun.simulationRunId))
    expect(runRow.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)
  })

  it('activates a demo proof run without deactivating the global active proof run', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Activation Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoAdminLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'sysadmin', password: 'admin1234' },
    })
    expect(demoAdminLoginRes.statusCode).toBe(200)
    const demoAdminCookie = Array.isArray(demoAdminLoginRes.headers['set-cookie'])
      ? demoAdminLoginRes.headers['set-cookie'][0]
      : demoAdminLoginRes.headers['set-cookie']
    expect(demoAdminCookie).toBeTruthy()

    const [globalActiveRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveRun).toBeTruthy()
    expect(globalActiveRun.demoWorkspaceId).toBeNull()

    const demoRunId = `simulation_run_demo_activation_${Date.now()}`
    await current.db.insert(simulationRuns).values({
      ...globalActiveRun,
      simulationRunId: demoRunId,
      parentSimulationRunId: globalActiveRun.simulationRunId,
      runLabel: 'Scoped activation demo run',
      status: 'completed',
      activeFlag: 0,
      demoWorkspaceId: demoWs.demoWorkspaceId,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })
    await current.db.insert(simulationStageCheckpoints).values({
      simulationStageCheckpointId: `stage_checkpoint_demo_activation_${Date.now()}`,
      simulationRunId: demoRunId,
      semesterNumber: 1,
      stageKey: 'pre-tt1',
      stageLabel: 'Pre TT1',
      stageDescription: 'Initial demo checkpoint',
      stageOrder: 1,
      previousCheckpointId: null,
      nextCheckpointId: null,
      summaryJson: JSON.stringify({ scope: 'demo-activation-test' }),
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    const activateRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${demoRunId}/activate`,
      headers: {
        cookie: demoAdminCookie,
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(activateRes.statusCode).toBe(200)

    const [globalAfter] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, globalActiveRun.simulationRunId))
    const [demoAfter] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, demoRunId))
    expect(globalAfter.activeFlag).toBe(1)
    expect(globalAfter.status).toBe('active')
    expect(demoAfter.activeFlag).toBe(1)
    expect(demoAfter.status).toBe('active')
    expect(demoAfter.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)
  })

  it('rejects demo admin control of a global proof run', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Control Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoAdminLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'sysadmin', password: 'admin1234' },
    })
    expect(demoAdminLoginRes.statusCode).toBe(200)
    const demoAdminCookie = Array.isArray(demoAdminLoginRes.headers['set-cookie'])
      ? demoAdminLoginRes.headers['set-cookie'][0]
      : demoAdminLoginRes.headers['set-cookie']
    expect(demoAdminCookie).toBeTruthy()

    const [globalActiveRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveRun.demoWorkspaceId).toBeNull()

    const activateRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${globalActiveRun.simulationRunId}/activate`,
      headers: {
        cookie: demoAdminCookie,
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(activateRes.statusCode).toBe(403)
    expect(activateRes.json()).toMatchObject({
      error: 'PROOF_RUN_SCOPE_MISMATCH',
    })
  })

  it('rejects global admin control of a demo proof run', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Global Control Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const [globalActiveRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveRun.demoWorkspaceId).toBeNull()

    const demoRunId = `simulation_run_demo_global_control_${Date.now()}`
    await current.db.insert(simulationRuns).values({
      ...globalActiveRun,
      simulationRunId: demoRunId,
      parentSimulationRunId: globalActiveRun.simulationRunId,
      runLabel: 'Scoped global control demo run',
      status: 'completed',
      activeFlag: 0,
      demoWorkspaceId: demoWs.demoWorkspaceId,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })
    await current.db.insert(simulationStageCheckpoints).values({
      simulationStageCheckpointId: `stage_checkpoint_demo_global_control_${Date.now()}`,
      simulationRunId: demoRunId,
      semesterNumber: 1,
      stageKey: 'pre-tt1',
      stageLabel: 'Pre TT1',
      stageDescription: 'Initial demo checkpoint',
      stageOrder: 1,
      previousCheckpointId: null,
      nextCheckpointId: null,
      summaryJson: JSON.stringify({ scope: 'demo-global-control-test' }),
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    const activateRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${demoRunId}/activate`,
      headers: {
        cookie: adminLogin.cookie,
        origin: TEST_ORIGIN,
      },
    })
    expect(activateRes.statusCode).toBe(403)
    expect(activateRes.json()).toMatchObject({
      error: 'PROOF_RUN_SCOPE_MISMATCH',
    })
  })

  it('does not expose global academic rows when a demo active proof run has no demo rows', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Academic Snapshot Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoTeacherLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'devika.shetty', password: 'faculty1234' },
    })
    expect(demoTeacherLoginRes.statusCode).toBe(200)
    const demoTeacherCookie = Array.isArray(demoTeacherLoginRes.headers['set-cookie'])
      ? demoTeacherLoginRes.headers['set-cookie'][0]
      : demoTeacherLoginRes.headers['set-cookie']
    expect(demoTeacherCookie).toBeTruthy()

    const [globalActiveRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveRun.demoWorkspaceId).toBeNull()

    const demoRunId = `simulation_run_demo_snapshot_${Date.now()}`
    await current.db.insert(simulationRuns).values({
      ...globalActiveRun,
      simulationRunId: demoRunId,
      parentSimulationRunId: globalActiveRun.simulationRunId,
      runLabel: 'Scoped academic snapshot demo run',
      status: 'active',
      activeFlag: 1,
      demoWorkspaceId: demoWs.demoWorkspaceId,
      createdAt: '2026-05-10T00:00:01.000Z',
      updatedAt: '2026-05-10T00:00:01.000Z',
    })

    const bootstrapRes = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: {
        cookie: demoTeacherCookie,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(bootstrapRes.statusCode).toBe(200)
    const snapshot = bootstrapRes.json() as {
      offerings: unknown[]
      mentees: unknown[]
      studentsByOffering: Record<string, unknown[]>
    }
    expect(snapshot.offerings).toHaveLength(0)
    expect(snapshot.mentees).toHaveLength(0)
    expect(Object.values(snapshot.studentsByOffering).flat()).toHaveLength(0)
  })

  it('rejects demo academic control of a global proof run', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Academic Control Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoTeacherLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'devika.shetty', password: 'faculty1234' },
    })
    expect(demoTeacherLoginRes.statusCode).toBe(200)
    const demoTeacherCookie = Array.isArray(demoTeacherLoginRes.headers['set-cookie'])
      ? demoTeacherLoginRes.headers['set-cookie'][0]
      : demoTeacherLoginRes.headers['set-cookie']
    expect(demoTeacherCookie).toBeTruthy()

    const [globalActiveRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveRun.demoWorkspaceId).toBeNull()

    const stopRes = await current.app.inject({
      method: 'POST',
      url: `/api/academic/proof-runs/${globalActiveRun.simulationRunId}/stop`,
      headers: {
        cookie: demoTeacherCookie,
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(stopRes.statusCode).toBe(403)
    expect(stopRes.json()).toMatchObject({
      error: 'PROOF_RUN_SCOPE_MISMATCH',
    })
  })

  it('rejects demo student-shell access to a global proof run', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Scoped Student Shell Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoAdminLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'sysadmin', password: 'admin1234' },
    })
    expect(demoAdminLoginRes.statusCode).toBe(200)
    const demoAdminCookie = Array.isArray(demoAdminLoginRes.headers['set-cookie'])
      ? demoAdminLoginRes.headers['set-cookie'][0]
      : demoAdminLoginRes.headers['set-cookie']
    expect(demoAdminCookie).toBeTruthy()

    const [globalActiveRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveRun.demoWorkspaceId).toBeNull()
    const [observedState] = await current.db
      .select()
      .from(studentObservedSemesterStates)
      .where(eq(studentObservedSemesterStates.simulationRunId, globalActiveRun.simulationRunId))
    expect(observedState).toBeTruthy()

    const cardRes = await current.app.inject({
      method: 'GET',
      url: `/api/academic/student-shell/students/${observedState.studentId}/card?simulationRunId=${encodeURIComponent(globalActiveRun.simulationRunId)}`,
      headers: {
        cookie: demoAdminCookie,
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(cardRes.statusCode).toBe(403)
    expect(cardRes.json()).toMatchObject({
      error: 'PROOF_RUN_SCOPE_MISMATCH',
    })
  })

  it('creates, lists, and resets a demo workspace without touching live data', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    // Snapshot global counts before any demo data
    const baseStudents = await current.db.select().from(students)
    const baseOfferings = await current.db.select().from(sectionOfferings)
    const baseRuns = await current.db.select().from(simulationRuns)

    // 1 — Create demo workspace
    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'College Demo Jan 2026' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }
    expect(demoWs.demoWorkspaceId).toBeTruthy()

    // 2 — List confirms workspace is present
    const listRes = await current.app.inject({
      method: 'GET',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(listRes.statusCode).toBe(200)
    const listed = listRes.json() as Array<{ demoWorkspaceId: string }>
    expect(listed.some(r => r.demoWorkspaceId === demoWs.demoWorkspaceId)).toBe(true)

    // 3 — Insert demo-tagged rows directly to simulate provisioned data
    const { branches, courses, academicTerms, institutions } = await import('../src/db/schema.js')
    const [firstBranch] = await current.db.select().from(branches)
    const [firstCourse] = await current.db.select().from(courses)
    const [firstTerm] = await current.db.select().from(academicTerms)
    const [firstInstitution] = await current.db.select().from(institutions)
    expect(firstBranch).toBeTruthy()
    expect(firstCourse).toBeTruthy()
    expect(firstTerm).toBeTruthy()
    expect(firstInstitution).toBeTruthy()

    const demoStudentId = `student_demo_test_${Date.now()}`
    await current.db.insert(students).values({
      studentId: demoStudentId,
      institutionId: firstInstitution.institutionId,
      usn: 'DEMO001',
      rollNumber: null,
      name: 'Demo Student One',
      email: null,
      phone: null,
      admissionDate: TEST_NOW,
      status: 'active',
      demoWorkspaceId: demoWs.demoWorkspaceId,
      version: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    const demoOfferingId = `offering_demo_test_${Date.now()}`
    await current.db.insert(sectionOfferings).values({
      offeringId: demoOfferingId,
      courseId: firstCourse.courseId,
      termId: firstTerm.termId,
      branchId: firstBranch.branchId,
      sectionCode: 'DEMO-A',
      yearLabel: '1 Year',
      attendance: 0,
      studentCount: 0,
      stage: 1,
      stageLabel: 'Demo',
      stageDescription: 'Demo offering',
      stageColor: '#888',
      tt1Done: 0,
      tt2Done: 0,
      tt1Locked: 0,
      tt2Locked: 0,
      quizLocked: 0,
      assignmentLocked: 0,
      finalsLocked: 0,
      pendingAction: null,
      status: 'active',
      demoWorkspaceId: demoWs.demoWorkspaceId,
      version: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    // 4 — Counts increased by exactly the inserted demo rows
    const midStudents = await current.db.select().from(students)
    const midOfferings = await current.db.select().from(sectionOfferings)
    expect(midStudents.length).toBe(baseStudents.length + 1)
    expect(midOfferings.length).toBe(baseOfferings.length + 1)

    // 5 — Reset demo workspace via API
    const resetRes = await current.app.inject({
      method: 'DELETE',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(resetRes.statusCode).toBe(200)
    const resetBody = resetRes.json() as { deletedStudents: number; deletedOfferings: number; deletedRuns: number }
    expect(resetBody.deletedStudents).toBe(1)
    expect(resetBody.deletedOfferings).toBe(1)
    expect(resetBody.deletedRuns).toBe(0)

    // 6 — Global counts returned to baseline; no demo residue
    const afterStudents = await current.db.select().from(students)
    const afterOfferings = await current.db.select().from(sectionOfferings)
    const afterRuns = await current.db.select().from(simulationRuns)
    expect(afterStudents.length).toBe(baseStudents.length)
    expect(afterOfferings.length).toBe(baseOfferings.length)
    expect(afterRuns.length).toBe(baseRuns.length)

    // 7 — Workspace record itself is gone
    const wsRow = await current.db
      .select()
      .from(demoWorkspaces)
      .where(eq(demoWorkspaces.demoWorkspaceId, demoWs.demoWorkspaceId))
    expect(wsRow.length).toBe(0)

    // 8 — List is now empty (or back to pre-test count)
    const listAfterRes = await current.app.inject({
      method: 'GET',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(listAfterRes.statusCode).toBe(200)
    const listedAfter = listAfterRes.json() as Array<{ demoWorkspaceId: string }>
    expect(listedAfter.some(r => r.demoWorkspaceId === demoWs.demoWorkspaceId)).toBe(false)
  })

  it('drops the demo schema on reset while preserving global rows', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const baseStudents = await current.db.select().from(students)
    const baseOfferings = await current.db.select().from(sectionOfferings)
    const baseRuns = await current.db.select().from(simulationRuns)

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Reset Schema Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string; scopeName: string | null }
    expect(demoWs.scopeName).toBeTruthy()
    expect(await demoWorkspaceSchemaExists(current.pool, demoWs.scopeName ?? '')).toBe(true)

    const quotedScopeName = quotePgIdentifier(demoWs.scopeName ?? '')
    await current.pool.query(`CREATE TABLE ${quotedScopeName}.demo_marker (id TEXT PRIMARY KEY)`)
    await current.pool.query(`INSERT INTO ${quotedScopeName}.demo_marker (id) VALUES ('marker_1')`)

    const resetRes = await current.app.inject({
      method: 'DELETE',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(resetRes.statusCode).toBe(200)
    const resetBody = resetRes.json() as { deletedSchema?: boolean; scopeName?: string | null }
    expect(resetBody.deletedSchema).toBe(true)
    expect(resetBody.scopeName).toBe(demoWs.scopeName)
    expect(await demoWorkspaceSchemaExists(current.pool, demoWs.scopeName ?? '')).toBe(false)

    expect((await current.db.select().from(students)).length).toBe(baseStudents.length)
    expect((await current.db.select().from(sectionOfferings)).length).toBe(baseOfferings.length)
    expect((await current.db.select().from(simulationRuns)).length).toBe(baseRuns.length)
  })

  it('preview provisioning returns estimated counts', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Preview Test WS' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    // Fetch a valid batchId and termId from the seeded DB
    const { batches, academicTerms } = await import('../src/db/schema.js')
    const [batch] = await current.db.select().from(batches)
    const [term] = await current.db.select().from(academicTerms).where(
      eq(academicTerms.batchId, batch.batchId),
    )
    expect(batch).toBeTruthy()
    expect(term).toBeTruthy()

    const previewRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}/provision/preview`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        batchId: batch.batchId,
        termId: term.termId,
        sectionLabels: ['A', 'B'],
        studentsPerSection: 30,
      },
    })
    expect(previewRes.statusCode).toBe(200)
    const preview = previewRes.json() as {
      estimatedStudentCount: number
      estimatedOfferingCount: number
      sections: string[]
    }
    expect(preview.estimatedStudentCount).toBe(60)
    expect(preview.sections).toEqual(['A', 'B'])
    expect(preview.estimatedOfferingCount).toBeGreaterThanOrEqual(0)
  })
})
