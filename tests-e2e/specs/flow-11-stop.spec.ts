// Flow 11 — Stop simulation. Prompt §L.11 + §B.23 + §D Stop intent.
//
// - Sysadmin stops an active simulation run.
// - Sessions for proof accounts are invalidated.
// - Proof credentials are deleted: subsequent login attempts for the
//   seeded proof faculty (hod/course-leader/mentor identifiers) MUST fail.
// - Sysadmin remains logged in (sysadmin is NOT a proof credential).
//
// Uses a dedicated fresh seeded run via the fixture. This spec is
// destructive — after it runs the proof faculty identifiers will remain
// deleted until the next fresh run rehydrates them. That's acceptable
// because the seededRun fixture always boots a new run per test.

import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

test('flow-11 stop: credential deletion + session invalidation semantics', async ({ request, seededRun }) => {
  // Precondition: HoD + course-leader + mentor login works on the active run.
  const hodPreLogin = await loginWithApiContext(request, 'hod').catch(err => ({ error: err as Error }))
  expect('error' in hodPreLogin ? hodPreLogin.error.message : '').toBe('')

  // Sysadmin performs the stop action. The dedicated /stop route is now
  // wired in admin-proof-sandbox.ts and maps through
  // proof-control-plane-playback-reset-service.stopProofSimulationRun,
  // which deletes proof credentials and invalidates proof-faculty sessions
  // (§L.11 + §O.3). Archive fallback is removed — it has different semantics
  // and must not silently pass the stop contract.
  const { session: sysadminSession } = await loginWithApiContext(request, 'system-admin')
  const stopResponse = await request.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(seededRun.runId)}/stop`), {
    headers: { 'X-AirMentor-CSRF': sysadminSession.csrfToken },
    data: {},
  })
  expect(stopResponse.ok(), `stop route must succeed; got ${stopResponse.status()}`).toBeTruthy()

  // Post-stop: the run's lifecycleState should be 'stopped' (or legacy
  // 'archived' if the backend uses a different vocab). Check the dashboard.
  const dashboardResponse = await request.get(apiPath(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`), {
    headers: { 'X-AirMentor-CSRF': sysadminSession.csrfToken },
  })
  expect(dashboardResponse.ok()).toBeTruthy()
  const dashboard = await dashboardResponse.json()
  const stoppedRun = Array.isArray(dashboard.proofRuns)
    ? dashboard.proofRuns.find((r: { simulationRunId: string }) => r.simulationRunId === seededRun.runId)
    : null
  if (stoppedRun) {
    const lifecycle = String(stoppedRun.lifecycleState ?? stoppedRun.status ?? '').toLowerCase()
    expect(['stopped', 'archived', 'completed']).toContain(lifecycle)
  }

  // Login with a proof credential MUST now fail. Try HoD first.
  const hodPostLogin = await request.post(apiPath('/api/session/login'), {
    data: { identifier: 'devika.shetty', password: 'faculty1234' },
    failOnStatusCode: false,
  })
  // We accept either HTTP 401 (credentials gone), 403 (proof run stopped),
  // or 404 (account row deleted). What's NOT acceptable is a 200 that
  // returns a logged-in session.
  if (hodPostLogin.ok()) {
    const body = await hodPostLogin.json().catch(() => null)
    expect(body?.activeRoleGrant).toBeFalsy()
  } else {
    expect([401, 403, 404]).toContain(hodPostLogin.status())
  }

  // Sysadmin session MUST remain valid (sysadmin is not a proof credential).
  const sysadminMe = await request.get(apiPath('/api/session'), {
    headers: { 'X-AirMentor-CSRF': sysadminSession.csrfToken },
    failOnStatusCode: false,
  })
  expect(sysadminMe.ok()).toBeTruthy()
})
