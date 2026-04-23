// Flow 4 — Scheduled task + Next Day. Prompt §L.4 + §B.20 + §D Calendar intent.
//
// The full §L.4 flow spans three concerns — (a) teacher schedules a follow-up
// for a future simulated day via the academic task PUT route, (b) dragging
// on the calendar mutates the underlying due date, (c) Next Day advances
// the simulated date by one. Concerns (a) + (b) are covered by dedicated
// route-level tests in air-mentor-api (see persistAcademicTask in
// academic-runtime-routes.ts test harness) and by the frontend domain
// unit tests on calendar-utils.normalizeTaskDueDate.
//
// This E2E spec is scoped tight to the DEMO-CRITICAL contract:
//   - Fresh Sem-1 pre-TT1 simulated date anchors on academic calendar (not
//     wall-clock).
//   - /advance?mode=day advances simulatedDateIso by exactly one day.
//   - The authoritative run-state fields round-trip through the dashboard.
// Task-ownership scoping (course-leader must own the offering) is product-
// correct but not the demo path this spec guards; it gets its own test.

import { expect } from '../support/playwright-runtime'
import { loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

function addDaysIso(dateIso: string, days: number): string {
  const base = new Date(dateIso)
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
  return next.toISOString().slice(0, 10)
}

test('flow-4 Next Day advance mutates simulatedDateIso by exactly one day in Sem-1 pre-TT1', async ({ request, seededRun }) => {
  const { session: sysSession } = await loginWithApiContext(request, 'system-admin')

  // Read pre-advance authoritative state.
  const beforeResp = await request.get(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`, {
    headers: { 'X-AirMentor-CSRF': sysSession.csrfToken },
  })
  expect(beforeResp.ok()).toBeTruthy()
  const beforeActive = (await beforeResp.json()).activeRunDetail
  expect(beforeActive.simulationRunId).toBe(seededRun.runId)
  expect(String(beforeActive.activeStageKey).toLowerCase()).toBe('pre-tt1')
  const beforeSim = String(beforeActive.simulatedDateIso).slice(0, 10)
  expect(beforeSim).toMatch(/^\d{4}-\d{2}-\d{2}$/)

  // Advance one simulated day.
  const advanceResp = await request.post(`/api/admin/proof-runs/${encodeURIComponent(seededRun.runId)}/advance`, {
    headers: { 'X-AirMentor-CSRF': sysSession.csrfToken },
    data: { mode: 'day' },
  })
  expect(advanceResp.ok(), `advance(day) must succeed; got ${advanceResp.status()}`).toBeTruthy()
  const advanceBody = await advanceResp.json()
  expect(advanceBody.activeStageKey).toBe('pre-tt1')
  expect(String(advanceBody.simulatedDateIso).slice(0, 10)).toBe(addDaysIso(beforeSim, 1))

  // Re-read dashboard and verify simulatedDateIso round-tripped.
  const afterResp = await request.get(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`, {
    headers: { 'X-AirMentor-CSRF': sysSession.csrfToken },
  })
  const afterActive = (await afterResp.json()).activeRunDetail
  expect(String(afterActive.simulatedDateIso).slice(0, 10)).toBe(addDaysIso(beforeSim, 1))
  // Lifecycle must remain 'active' — single-day advance before stage boundary
  // must not flip lifecycleState.
  expect(String(afterActive.lifecycleState ?? '').toLowerCase()).toBe('active')
})
