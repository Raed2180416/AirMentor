/**
 * Intent-driven tests for simulation flow gaps.
 * Each test verifies that the FEATURE INTENT is upheld, not just that code runs.
 *
 * GAP-1: Proof offerings must have assessment schemes after simulation activation.
 * GAP-2: Assessment kind cannot be locked before the required stage is reached.
 * GAP-3: HOD clear-lock route must clear the DB column, not just the runtime blob.
 * GAP-5: Academic bootstrap must gate on an active proof run.
 */

import fastify, { type FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  academicTerms,
  offeringAssessmentSchemes,
  sectionOfferings,
  simulationRuns,
  sessions,
} from '../src/db/schema.js'
import { registerAcademicBootstrapRoutes } from '../src/modules/academic-bootstrap-routes.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

// ---------------------------------------------------------------------------
// GAP-5: Bootstrap gate — academic portal must block if no active proof run
// ---------------------------------------------------------------------------

describe('GAP-5: bootstrap blocks without active proof run', () => {
  let app: ReturnType<typeof fastify> | null = null

  afterEach(async () => {
    if (app) await app.close()
    app = null
  })

  it('returns 403 NO_ACTIVE_PROOF_RUN when no active simulation run exists', async () => {
    const buildAcademicBootstrap = vi.fn()
    const db = {
      select: () => ({
        from: (_table: unknown) => ({
          where: async () => [], // no active runs
        }),
      }),
    }
    const context = { db, now: () => '2026-03-31T00:00:00.000Z' }

    app = fastify()
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.auth = {
        sessionId: 'session_hod',
        userId: 'fac_hod_cse',
        username: 'hod.cse',
        email: 'hod.cse@msruas.ac.in',
        facultyId: 'fac_hod_cse',
        facultyName: 'HOD CSE',
        activeRoleGrant: {
          grantId: 'grant_hod_cse',
          facultyId: 'fac_hod_cse',
          roleCode: 'HOD',
          scopeType: 'branch',
          scopeId: 'branch_cse_btech',
          status: 'active',
          version: 1,
        },
        availableRoleGrants: [],
      }
    })
    await registerAcademicBootstrapRoutes(app, context as never, {
      academicBootstrapQuerySchema: z.object({
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
      academicRoleCodes: ['COURSE_LEADER', 'MENTOR', 'HOD'],
      buildAcademicBootstrap,
      buildPublicFacultyList: vi.fn().mockResolvedValue([]),
      resolveAcademicStageCheckpoint: vi.fn(),
    } as never)

    const response = await app.inject({ method: 'GET', url: '/api/academic/bootstrap' })

    // Intent: teacher sees an explicit gate, not a blank/broken workspace.
    expect(response.statusCode).toBe(403)
    const body = response.json()
    expect(body.code).toBe('NO_ACTIVE_PROOF_RUN')
    // buildAcademicBootstrap must NOT be called — no point querying empty data
    expect(buildAcademicBootstrap).not.toHaveBeenCalled()
  })

  it('returns 200 when an active simulation run exists', async () => {
    const bootstrapPayload = {
      offerings: [],
      faculty: [],
      mentees: [],
      proofPlayback: null,
    }
    const buildAcademicBootstrap = vi.fn().mockResolvedValue(bootstrapPayload)
    const db = {
      select: () => ({
        from: (_table: unknown) => ({
          where: async () => [{ simulationRunId: 'active_run_001' }],
        }),
      }),
    }
    const context = { db, now: () => '2026-03-31T00:00:00.000Z' }

    app = fastify()
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.auth = {
        sessionId: 'session_hod',
        userId: 'fac_hod_cse',
        username: 'hod.cse',
        email: 'hod.cse@msruas.ac.in',
        facultyId: 'fac_hod_cse',
        facultyName: 'HOD CSE',
        activeRoleGrant: {
          grantId: 'grant_hod_cse',
          facultyId: 'fac_hod_cse',
          roleCode: 'HOD',
          scopeType: 'branch',
          scopeId: 'branch_cse_btech',
          status: 'active',
          version: 1,
        },
        availableRoleGrants: [],
      }
    })
    await registerAcademicBootstrapRoutes(app, context as never, {
      academicBootstrapQuerySchema: z.object({
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
      academicRoleCodes: ['COURSE_LEADER', 'MENTOR', 'HOD'],
      buildAcademicBootstrap,
      buildPublicFacultyList: vi.fn().mockResolvedValue([]),
      resolveAcademicStageCheckpoint: vi.fn(),
    } as never)

    const response = await app.inject({ method: 'GET', url: '/api/academic/bootstrap' })
    expect(response.statusCode).toBe(200)
    expect(buildAcademicBootstrap).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Integration tests (require embedded Postgres + full seed)
// ---------------------------------------------------------------------------

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

// Helper: get a proof offering ID from the seeded sandbox.
// The sandbox creates sem6 offerings for batch_branch_mnc_btech_2023 / term_mnc_sem6.
async function getProofOfferingId(db: Awaited<ReturnType<typeof createTestApp>>['db']): Promise<string> {
  // The sandbox always creates the active run for the MNC batch with sem6 offerings
  const [activeRun] = await db
    .select({ simulationRunId: simulationRuns.simulationRunId, batchId: simulationRuns.batchId })
    .from(simulationRuns)
    .where(eq(simulationRuns.activeFlag, 1))

  if (!activeRun) throw new Error('No active proof run found in test DB')

  // Sandbox creates offerings under term_mnc_sem6 — the active semester
  const terms = await db
    .select({ termId: academicTerms.termId, semesterNumber: academicTerms.semesterNumber })
    .from(academicTerms)
    .where(eq(academicTerms.batchId, activeRun.batchId))

  // Prefer the highest semester number (sem6 is where the sandbox puts offerings)
  const sem6Term = terms.sort((a, b) => b.semesterNumber - a.semesterNumber)[0]
  if (!sem6Term) throw new Error(`No term found for batch ${activeRun.batchId}`)

  const [offering] = await db
    .select({ offeringId: sectionOfferings.offeringId })
    .from(sectionOfferings)
    .where(eq(sectionOfferings.termId, sem6Term.termId))

  if (!offering) throw new Error(`No offering found for term ${sem6Term.termId} (sem ${sem6Term.semesterNumber})`)
  return offering.offeringId
}

// ---------------------------------------------------------------------------
// GAP-1: Assessment scheme gate — stage advance blocked if no scheme
// ---------------------------------------------------------------------------

describe('GAP-1: offering assessment scheme gates stage advancement', () => {
  it('stage-eligibility reports blocking reason when no scheme row exists for a proof offering', async () => {
    current = await createTestApp()
    const { app, db } = current

    const offeringId = await getProofOfferingId(db)

    // Remove any scheme row to simulate the pre-fix state
    await db
      .delete(offeringAssessmentSchemes)
      .where(eq(offeringAssessmentSchemes.offeringId, offeringId))

    const adminLogin = await loginAs(app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const eligibilityResponse = await app.inject({
      method: 'GET',
      url: `/api/admin/offerings/${offeringId}/stage-eligibility`,
      headers: { cookie: adminLogin.cookie },
    })

    expect(eligibilityResponse.statusCode).toBe(200)
    const body = eligibilityResponse.json()
    // Intent: without a configured scheme, stage advance must be blocked.
    // The scheme is what the proof-seeding flow creates (GAP-1 fix in publishOperationalProjection).
    const isBlocked = !body.eligible || body.blockingReasons?.some((reason: string) => reason.toLowerCase().includes('scheme'))
    expect(isBlocked, 'Stage advance must be blocked when no assessment scheme exists').toBe(true)
  })

  it('stage-eligibility does not report scheme blocking reason when scheme is Configured', async () => {
    current = await createTestApp()
    const { app, db } = current

    const offeringId = await getProofOfferingId(db)
    const now = '2026-03-16T00:00:00.000Z'

    // Insert a Configured scheme — matches exactly what GAP-1 fix inserts via publishOperationalProjection
    const schemeJson = JSON.stringify({
      finalsMax: 50,
      termTestWeights: { tt1: 15, tt2: 15 },
      quizWeight: 15,
      assignmentWeight: 15,
      quizCount: 2,
      assignmentCount: 2,
      quizComponents: [
        { id: 'quiz-1', label: 'Quiz 1', rawMax: 10, weightage: 7 },
        { id: 'quiz-2', label: 'Quiz 2', rawMax: 10, weightage: 8 },
      ],
      assignmentComponents: [
        { id: 'assignment-1', label: 'Assignment 1', rawMax: 10, weightage: 7 },
        { id: 'assignment-2', label: 'Assignment 2', rawMax: 10, weightage: 8 },
      ],
      policyContext: { ce: 60, see: 40, maxTermTests: 2, maxQuizzes: 2, maxAssignments: 2 },
      status: 'Configured',
    })
    await db.delete(offeringAssessmentSchemes).where(eq(offeringAssessmentSchemes.offeringId, offeringId))
    await db.insert(offeringAssessmentSchemes).values({
      offeringId,
      configuredByFacultyId: null,
      schemeJson,
      policySnapshotJson: JSON.stringify({ ceSeeSplit: { ce: 60, see: 40 } }),
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })

    const adminLogin = await loginAs(app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const eligibilityResponse = await app.inject({
      method: 'GET',
      url: `/api/admin/offerings/${offeringId}/stage-eligibility`,
      headers: { cookie: adminLogin.cookie },
    })

    expect(eligibilityResponse.statusCode).toBe(200)
    const body = eligibilityResponse.json()
    // Intent: a Configured scheme must NOT block stage advancement on its own.
    const schemeBlockingReason = body.blockingReasons?.find((reason: string) => reason.toLowerCase().includes('scheme'))
    expect(schemeBlockingReason, 'A Configured scheme must not appear as a blocking reason').toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// GAP-2: Stage gate — cannot lock evidence before required stage
// ---------------------------------------------------------------------------

describe('GAP-2: stage gate prevents locking future-stage evidence', () => {
  it('rejects locking tt2 when offering is at pre-tt1 stage (stage=1)', async () => {
    current = await createTestApp()
    const { app, db } = current

    const offeringId = await getProofOfferingId(db)

    // Force stage=1 for deterministic test
    await db
      .update(sectionOfferings)
      .set({ stage: 1 })
      .where(eq(sectionOfferings.offeringId, offeringId))

    // Login as a Course Leader
    const login = await loginAs(app, 'devika.shetty', 'faculty1234')
    expect(login.response.statusCode).toBe(200)

    // Attempt to lock tt2 at stage 1 — must be rejected
    // Intent: tt2 is post-tt1 evidence; locking it before TT1 has concluded
    //         corrupts the proof timeline. The gate must block this.
    const response = await app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${offeringId}/assessment-entries/tt2`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { lock: true, entries: [], evaluatedAt: '2026-03-16T00:00:00.000Z' },
    })

    expect(response.statusCode).toBe(403)
    const body = response.json()
    expect(body.message).toContain('required stage')
  })

  it('allows locking tt1 at pre-tt1 stage (stage=1) — tt1 is valid at stage 1', async () => {
    current = await createTestApp()
    const { app, db } = current

    const offeringId = await getProofOfferingId(db)

    await db
      .update(sectionOfferings)
      .set({ stage: 1, tt1Locked: 0 })
      .where(eq(sectionOfferings.offeringId, offeringId))

    const login = await loginAs(app, 'devika.shetty', 'faculty1234')
    expect(login.response.statusCode).toBe(200)

    // Intent: locking tt1 at stage 1 is valid — TT1 evidence is expected at this stage.
    const response = await app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${offeringId}/assessment-entries/tt1`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { lock: true, entries: [], evaluatedAt: '2026-03-16T00:00:00.000Z' },
    })

    // 200 = lock accepted (not rejected by the stage gate)
    expect(response.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// GAP-3: HOD clear-lock must clear the DB column, not just the runtime blob
// ---------------------------------------------------------------------------

// devika.shetty has HOD + COURSE_LEADER + MENTOR roles in the sandbox.
// Switch to HOD role via role-context API so the clear-lock route accepts the call.
async function loginAsHOD(app: Awaited<ReturnType<typeof createTestApp>>['app']) {
  const login = await loginAs(app, 'devika.shetty', 'faculty1234')
  expect(login.response.statusCode).toBe(200)
  // Switch active role to HOD
  const roleSwitch = await app.inject({
    method: 'POST',
    url: '/api/session/role-context',
    headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    payload: { roleGrantId: 'grant_mnc_t1_hod' },
  })
  expect(roleSwitch.statusCode).toBe(200)
  // Collect updated cookie after role switch
  const setCookieHeader = roleSwitch.headers['set-cookie']
  const updatedCookie = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : (setCookieHeader ?? login.cookie)
  return updatedCookie || login.cookie
}

describe('GAP-3: HOD clear-lock clears the DB lock column', () => {
  it('clears tt1Locked DB column and returns cleared:true', async () => {
    current = await createTestApp()
    const { app, db } = current

    const offeringId = await getProofOfferingId(db)

    // Lock it directly in the DB (simulating a Course Leader commit)
    await db
      .update(sectionOfferings)
      .set({ tt1Locked: 1 })
      .where(eq(sectionOfferings.offeringId, offeringId))

    const [before] = await db
      .select({ tt1Locked: sectionOfferings.tt1Locked })
      .from(sectionOfferings)
      .where(eq(sectionOfferings.offeringId, offeringId))
    expect(before.tt1Locked).toBe(1)

    // HOD calls clear-lock
    const hodCookie = await loginAsHOD(app)

    const clearResponse = await app.inject({
      method: 'POST',
      url: `/api/academic/offerings/${offeringId}/assessment-entries/tt1/clear-lock`,
      headers: { cookie: hodCookie, origin: TEST_ORIGIN },
      payload: {},
    })

    expect(clearResponse.statusCode).toBe(200)
    const body = clearResponse.json()
    // Intent: the response must confirm the lock was actually cleared
    expect(body.ok).toBe(true)
    expect(body.cleared).toBe(true)
    expect(body.offeringId).toBe(offeringId)
    expect(body.kind).toBe('tt1')

    // Intent: the DB column must be cleared — not just the runtime blob.
    // If only the blob was cleared, the commit route would still reject new writes.
    const [after] = await db
      .select({ tt1Locked: sectionOfferings.tt1Locked })
      .from(sectionOfferings)
      .where(eq(sectionOfferings.offeringId, offeringId))
    expect(after.tt1Locked).toBe(0)
  })

  it('returns cleared:false when lock was already cleared (idempotent)', async () => {
    current = await createTestApp()
    const { app, db } = current

    const offeringId = await getProofOfferingId(db)

    // Ensure unlocked
    await db
      .update(sectionOfferings)
      .set({ tt1Locked: 0 })
      .where(eq(sectionOfferings.offeringId, offeringId))

    const hodCookie = await loginAsHOD(app)

    const clearResponse = await app.inject({
      method: 'POST',
      url: `/api/academic/offerings/${offeringId}/assessment-entries/tt1/clear-lock`,
      headers: { cookie: hodCookie, origin: TEST_ORIGIN },
      payload: {},
    })

    expect(clearResponse.statusCode).toBe(200)
    const body = clearResponse.json()
    expect(body.ok).toBe(true)
    // Intent: already-unlocked is not an error — caller just sees cleared:false
    expect(body.cleared).toBe(false)
    expect(body.reason).toBe('already-unlocked')
  })

  it('rejects clear-lock when called by Course Leader active role (not HOD)', async () => {
    current = await createTestApp()
    const { app, db } = current

    const offeringId = await getProofOfferingId(db)

    await db.update(sectionOfferings).set({ tt1Locked: 1 }).where(eq(sectionOfferings.offeringId, offeringId))

    // Login with COURSE_LEADER active role (the default role at login)
    const clLogin = await loginAs(app, 'devika.shetty', 'faculty1234')
    expect(clLogin.response.statusCode).toBe(200)

    const clearResponse = await app.inject({
      method: 'POST',
      url: `/api/academic/offerings/${offeringId}/assessment-entries/tt1/clear-lock`,
      headers: { cookie: clLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })

    // Intent: only HOD active role can approve lock clearance — role separation is the whole point
    expect(clearResponse.statusCode).toBe(403)

    // DB column must still be locked
    const [row] = await db
      .select({ tt1Locked: sectionOfferings.tt1Locked })
      .from(sectionOfferings)
      .where(eq(sectionOfferings.offeringId, offeringId))
    expect(row.tt1Locked).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// GAP-4: Session invalidation on proof run archive/activate
// ---------------------------------------------------------------------------

describe('GAP-4: archiving a proof run invalidates sandbox faculty sessions', () => {
  it('sandbox faculty session is rejected after archive', async () => {
    current = await createTestApp()
    const { app, db } = current

    // Login as a sandbox faculty member
    const facultyLogin = await loginAs(app, 'devika.shetty', 'faculty1234')
    expect(facultyLogin.response.statusCode).toBe(200)

    // Extract session ID from login response body
    const facultySessionId: string = facultyLogin.body?.sessionId
    expect(facultySessionId, 'Login response must include sessionId').toBeTruthy()

    // Verify the session is alive — bootstrap should return 200 (active run exists)
    const bootstrapBefore = await app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(bootstrapBefore.statusCode).toBe(200)

    // Identify the active run to archive
    const [activeRun] = await db
      .select({ simulationRunId: simulationRuns.simulationRunId })
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeDefined()

    // Confirm faculty session row exists before archive
    const [facultySessionBefore] = await db.select().from(sessions).where(eq(sessions.sessionId, facultySessionId))
    expect(facultySessionBefore, 'Faculty session must exist before archive').toBeDefined()

    // Sysadmin archives the active run
    const adminLogin = await loginAs(app, 'sysadmin', 'admin1234')
    expect(adminLogin.response.statusCode).toBe(200)

    const archiveResponse = await app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/archive`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
    })
    expect(archiveResponse.statusCode).toBe(200)

    // Intent: after archive, sandbox faculty session must be gone from the sessions table.
    // If the session row persists, the faculty could continue operating in a stale proof context.
    const [facultySessionAfter] = await db.select().from(sessions).where(eq(sessions.sessionId, facultySessionId))
    expect(facultySessionAfter, 'Faculty session must be deleted after archive').toBeUndefined()

    // Further confirm: the bootstrap request with the old cookie must be rejected (401/403)
    const bootstrapAfter = await app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect([401, 403]).toContain(bootstrapAfter.statusCode)
  })
})
