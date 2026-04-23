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

async function seedCorrectionCycleTask(request: { put: Function }, csrfToken: string) {
  // Put a pristine task into the academic store so the correction-cycle
  // route has something to drive. Status is 'New' and no unlockRequest
  // payload yet — the 'request' transition must be the first one legal.
  const taskId = `flow9-hod-cycle-${Date.now()}`
  const studentId = 'mnc_s_2023_001'
  const offeringId = 'off_mnc_2023_sem1_programming'
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

  const { session: clSession } = await loginWithApiContext(request, 'course-leader')
  const { taskId } = await seedCorrectionCycleTask(request, clSession.csrfToken)

  // Step 1 — Course Leader opens unlock request (kind=tt1 → evidence scope).
  const requestResp = await drive(request, clSession.csrfToken, taskId, {
    action: 'request',
    kind: 'tt1',
    note: 'Correction needed per flow-9 test',
  })
  expect(requestResp.ok(), `request: expected 2xx got ${requestResp.status()}`).toBeTruthy()
  const requestBody = await requestResp.json()
  expect(requestBody.unlockRequest.status).toBe('Pending')
  expect(requestBody.engine.nextStatus).toBe('Pending')
  expect(requestBody.engine.scope).toBe('evidence')

  // Step 2 — HOD approves.
  const { session: hodSession } = await loginWithApiContext(request, 'hod')
  const approveResp = await drive(request, hodSession.csrfToken, taskId, {
    action: 'approve',
    reviewNote: 'Approved per flow-9 test',
  })
  expect(approveResp.ok(), `approve: expected 2xx got ${approveResp.status()}`).toBeTruthy()
  const approveBody = await approveResp.json()
  expect(approveBody.unlockRequest.status).toBe('Approved')

  // Step 3 — HOD drives reset-complete. Engine must mark surfaceReopens=true.
  const resetResp = await drive(request, hodSession.csrfToken, taskId, {
    action: 'reset-complete',
  })
  expect(resetResp.ok(), `reset-complete: expected 2xx got ${resetResp.status()}`).toBeTruthy()
  const resetBody = await resetResp.json()
  expect(resetBody.unlockRequest.status).toBe('Reset Completed')
  expect(resetBody.engine.surfaceReopens).toBeTruthy()

  // Step 4 — Course leader submits correction; engine flips triggersRecompute.
  const submitResp = await drive(request, clSession.csrfToken, taskId, {
    action: 'teacher-edit-submit',
    note: 'Corrected TT1 mark submitted',
  })
  expect(submitResp.ok(), `teacher-edit-submit: expected 2xx got ${submitResp.status()}`).toBeTruthy()
  const submitBody = await submitResp.json()
  expect(submitBody.unlockRequest.status).toBe('Reset Completed')
  expect(submitBody.engine.triggersRecompute).toBeTruthy()

  // Step 5 — HOD relocks. Terminal.
  const relockResp = await drive(request, hodSession.csrfToken, taskId, {
    action: 'relock',
  })
  expect(relockResp.ok(), `relock: expected 2xx got ${relockResp.status()}`).toBeTruthy()
  const relockBody = await relockResp.json()
  expect(relockBody.unlockRequest.status).toBe('Relocked')
  expect(relockBody.engine.nextActions).toEqual([])
})

test('flow-9 HOD cycle: illegal transitions rejected (engine contract via route)', async ({ request, seededRun }) => {
  expect(seededRun.runId).toBeTruthy()
  // A Course Leader cannot approve (HOD/SYSTEM_ADMIN only). Engine returns
  // forbidden-role → 403.
  const { session: clSession } = await loginWithApiContext(request, 'course-leader')
  const { taskId } = await seedCorrectionCycleTask(request, clSession.csrfToken)
  // Open a Pending request first.
  const requestResp = await drive(request, clSession.csrfToken, taskId, {
    action: 'request',
    kind: 'tt1',
  })
  expect(requestResp.ok()).toBeTruthy()
  // Course Leader attempts approve → must fail with 403.
  const illegalApprove = await request.post(`/api/academic/unlock-requests/${encodeURIComponent(taskId)}/transition`, {
    headers: { 'X-AirMentor-CSRF': clSession.csrfToken },
    data: { action: 'approve' },
    failOnStatusCode: false,
  })
  expect(illegalApprove.ok()).toBeFalsy()
  expect(illegalApprove.status()).toBe(403)

  // HOD attempts reset-complete before approve → engine says illegal-
  // transition → 400.
  const { session: hodSession } = await loginWithApiContext(request, 'hod')
  const illegalReset = await request.post(`/api/academic/unlock-requests/${encodeURIComponent(taskId)}/transition`, {
    headers: { 'X-AirMentor-CSRF': hodSession.csrfToken },
    data: { action: 'reset-complete' },
    failOnStatusCode: false,
  })
  expect(illegalReset.ok()).toBeFalsy()
  expect(illegalReset.status()).toBe(400)
})
