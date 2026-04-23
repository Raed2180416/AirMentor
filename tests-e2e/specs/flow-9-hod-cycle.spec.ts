// Flow 9 — HOD correction cycle. Prompt §L.9 + §D.6 + §C.6 + §C.15.
//
// - Course Leader opens an unlock-request on an academic task → Pending.
// - HOD approves → Approved.
// - HOD drives reset-complete → Reset Completed (editor reopens).
// - Course Leader submits corrected value → stays Reset Completed,
//   engine.triggersRecompute = true.
// - HOD relocks → Relocked (cycle closed).
//
// Route: POST /api/academic/unlock-requests/:taskId/transition (single
// endpoint that drives proof-hod-correction-cycle-engine.ts).

import { expect } from '../support/playwright-runtime'
import { loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

async function seedCorrectionCycleTask(request: {
  put: Function
  post: Function
}, csrfTokenPromise: Promise<string>) {
  // Put a pristine task into the academic store so the correction-cycle
  // route has something to drive. Status is 'New' and no unlockRequest
  // payload yet — the 'request' transition must be the first legal one.
  // Uses a SYSTEM_ADMIN CSRF token because scope-free task seeding needs
  // the admin bypass in assertViewerCanManageTask.
  const taskId = `flow9-hod-cycle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  // Seeded proof cohort uses mnc_student_NNN identifiers (buildStudentTrajectory
  // in msruas-proof-sandbox.ts) and mnc_s6_<code>_<section> offering IDs.
  // mnc_s6_amc_s6_32_a = Sem6 Data Science & Analytics section A, which the
  // round-robin ownership assignment in seedMsruasProofSandbox assigns to
  // mnc_t2 (rohit.menon) — the Course Leader identity used by the fixture.
  const studentId = 'mnc_student_001'
  const offeringId = 'mnc_s6_amc_s6_32_a'
  const csrfToken = await csrfTokenPromise
  const resp = await request.put(`/api/academic/tasks/${encodeURIComponent(taskId)}`, {
    headers: { 'X-AirMentor-CSRF': csrfToken },
    data: {
      task: {
        id: taskId,
        studentId,
        studentName: 'Flow-9 Seeded Student',
        studentUsn: 'MNC2023-FLOW9',
        offeringId,
        courseCode: 'SEED-CODE',
        courseName: 'Seed Course',
        year: '2023',
        riskProb: 0.5,
        riskBand: 'Medium',
        title: 'Flow-9 correction cycle fixture',
        due: 'This week',
        status: 'New',
        actionHint: 'Unlock-request correction cycle fixture',
        priority: 1,
        createdAt: Date.now(),
        assignedTo: 'Course Leader',
      },
    },
  })
  expect(resp.ok(), `seed task PUT must succeed; got ${resp.status()}`).toBeTruthy()
  return { taskId, offeringId }
}

async function drive(request: { post: Function }, csrfToken: string, taskId: string, body: Record<string, unknown>) {
  return request.post(`/api/academic/unlock-requests/${encodeURIComponent(taskId)}/transition`, {
    headers: { 'X-AirMentor-CSRF': csrfToken },
    data: body,
  })
}

test('flow-9 HOD cycle: teacher request → HOD approve → reset-complete → teacher edit → relock', async ({ request, seededRun }) => {
  expect(seededRun.runId).toMatch(/^simulation_run_/)

  // Playwright's test-scoped request fixture shares ONE cookie jar across
  // the whole test. Logging in as a different role rotates the session
  // cookie, which then invalidates the previous role's CSRF token. So we
  // re-login right before each transition that needs a specific role.

  // Seed as SYSTEM_ADMIN so the scope check is bypassed.
  const sysSeed = await loginWithApiContext(request, 'system-admin')
  const { taskId } = await seedCorrectionCycleTask(request, Promise.resolve(sysSeed.session.csrfToken))

  // Step 1 — Course Leader opens unlock request.
  const cl1 = await loginWithApiContext(request, 'course-leader')
  const requestResp = await drive(request, cl1.session.csrfToken, taskId, {
    action: 'request',
    kind: 'tt1',
    note: 'Correction needed per flow-9 test',
  })
  expect(requestResp.ok(), `request: expected 2xx got ${requestResp.status()}`).toBeTruthy()
  const requestBody = await requestResp.json()
  expect(requestBody.unlockRequest.status).toBe('Pending')
  expect(requestBody.engine.nextStatus).toBe('Pending')
  expect(requestBody.engine.scope).toBe('evidence')

  // Step 2 — HOD approves (re-login to rotate session cookie).
  const hod1 = await loginWithApiContext(request, 'hod')
  const approveResp = await drive(request, hod1.session.csrfToken, taskId, {
    action: 'approve',
    reviewNote: 'Approved per flow-9 test',
  })
  expect(approveResp.ok(), `approve: expected 2xx got ${approveResp.status()}`).toBeTruthy()
  expect((await approveResp.json()).unlockRequest.status).toBe('Approved')

  // Step 3 — HOD drives reset-complete. Engine must mark surfaceReopens=true.
  const resetResp = await drive(request, hod1.session.csrfToken, taskId, {
    action: 'reset-complete',
  })
  expect(resetResp.ok(), `reset-complete: expected 2xx got ${resetResp.status()}`).toBeTruthy()
  const resetBody = await resetResp.json()
  expect(resetBody.unlockRequest.status).toBe('Reset Completed')
  expect(resetBody.engine.surfaceReopens).toBeTruthy()

  // Step 4 — Course leader re-login, submits correction.
  const cl2 = await loginWithApiContext(request, 'course-leader')
  const submitResp = await drive(request, cl2.session.csrfToken, taskId, {
    action: 'teacher-edit-submit',
    note: 'Corrected TT1 mark submitted',
  })
  expect(submitResp.ok(), `teacher-edit-submit: expected 2xx got ${submitResp.status()}`).toBeTruthy()
  const submitBody = await submitResp.json()
  expect(submitBody.unlockRequest.status).toBe('Reset Completed')
  expect(submitBody.engine.triggersRecompute).toBeTruthy()

  // Step 5 — HOD re-login, relocks.
  const hod2 = await loginWithApiContext(request, 'hod')
  const relockResp = await drive(request, hod2.session.csrfToken, taskId, {
    action: 'relock',
  })
  expect(relockResp.ok(), `relock: expected 2xx got ${relockResp.status()}`).toBeTruthy()
  const relockBody = await relockResp.json()
  expect(relockBody.unlockRequest.status).toBe('Relocked')
  expect(relockBody.engine.nextActions).toEqual([])
})

test('flow-9 HOD cycle: illegal transitions rejected (engine contract via route)', async ({ request, seededRun }) => {
  expect(seededRun.runId).toBeTruthy()
  // Seed as SYSTEM_ADMIN (bypasses ownership) so the illegal-transition
  // assertions exercise engine branches, not route scope checks.
  const sysSeed = await loginWithApiContext(request, 'system-admin')
  const { taskId } = await seedCorrectionCycleTask(request, Promise.resolve(sysSeed.session.csrfToken))

  // Course Leader re-login, open a Pending request first.
  const cl = await loginWithApiContext(request, 'course-leader')
  const requestResp = await drive(request, cl.session.csrfToken, taskId, {
    action: 'request',
    kind: 'tt1',
  })
  expect(requestResp.ok()).toBeTruthy()

  // Re-login as Course Leader explicitly so cookie is fresh, attempt approve
  // → must fail with 403 (engine forbidden-role).
  const cl2 = await loginWithApiContext(request, 'course-leader')
  const illegalApprove = await request.post(`/api/academic/unlock-requests/${encodeURIComponent(taskId)}/transition`, {
    headers: { 'X-AirMentor-CSRF': cl2.session.csrfToken },
    data: { action: 'approve' },
    failOnStatusCode: false,
  })
  expect(illegalApprove.ok()).toBeFalsy()
  expect(illegalApprove.status()).toBe(403)

  // HOD re-login, attempt reset-complete before approve → engine says
  // illegal-transition → 400.
  const hod = await loginWithApiContext(request, 'hod')
  const illegalReset = await request.post(`/api/academic/unlock-requests/${encodeURIComponent(taskId)}/transition`, {
    headers: { 'X-AirMentor-CSRF': hod.session.csrfToken },
    data: { action: 'reset-complete' },
    failOnStatusCode: false,
  })
  expect(illegalReset.ok()).toBeFalsy()
  expect(illegalReset.status()).toBe(400)
})
