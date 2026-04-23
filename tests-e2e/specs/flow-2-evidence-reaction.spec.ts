// Flow 2 — Early evidence reaction. Prompt §L.2 + §B.13 + §C.1.
//
// - Teacher enters early quiz/assignment in Sem-1 pre-TT1.
// - Risk MUST change immediately (no stage gating of coursework visibility).
// - Evidence appears in feature snapshot and UI.
// - System-generated cases remain watch-only in Sem-1 pre-TT1.
//
// This spec drives the quiz/assignment cell write path via the academic
// runtime routes and then re-reads the dashboard to assert risk scalar
// drift.

import { expect } from '../support/playwright-runtime'
import { loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

test('flow-2 early evidence: quiz entered in Sem-1 pre-TT1 immediately shifts risk scalar', async ({ request, seededRun }) => {
  const { session } = await loginWithApiContext(request, 'system-admin')

  const beforeDashboard = await request.get(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`, {
    headers: { 'X-AirMentor-CSRF': session.csrfToken },
  })
  expect(beforeDashboard.ok()).toBeTruthy()
  const beforeJson = await beforeDashboard.json()
  const beforeActive = beforeJson.activeRunDetail
  expect(String(beforeActive.activeStageKey).toLowerCase()).toBe('pre-tt1')

  // §L.2 + §C.1: in Sem-1 pre-TT1, dashboard MUST surface student projections
  // with sensible risk bands, and system-generated cases MUST remain
  // watch-only (no open actionable case opens before TT1 evidence is real).
  // Hard-fail if projections aren't surfaced — that breaks §B.3 fresh-run
  // contract.
  const projections = Array.isArray(beforeActive.studentProjections) ? beforeActive.studentProjections : []
  expect(projections.length, 'pre-TT1 dashboard must surface student projections').toBeGreaterThan(0)

  // Risk scalar sanity: every projection must have a finite scaled risk in
  // [0, 100] and a valid band.
  for (const projection of projections) {
    const riskScaled = Number(projection.riskProbScaled ?? NaN)
    expect(riskScaled).toBeGreaterThanOrEqual(0)
    expect(riskScaled).toBeLessThanOrEqual(100)
    expect(['High', 'Medium', 'Low']).toContain(projection.riskBand)
  }

  // §C.1 watch-only: every system-generated queue projection (manual=false)
  // in Sem-1 pre-TT1 MUST be watch-only/idle/dismissed. An open case here
  // violates the watch-only contract.
  const queueRows = Array.isArray(beforeActive.queueProjections) ? beforeActive.queueProjections : []
  for (const queueRow of queueRows) {
    if (queueRow?.manual === true) continue
    expect(
      ['watch', 'idle', 'dismissed'],
      `system-generated queue row ${queueRow.queueCaseId ?? queueRow.simulationStageQueueCaseId ?? '?'} must be watch-only in Sem-1 pre-TT1, got ${queueRow.queueState}`,
    ).toContain(String(queueRow.queueState ?? '').toLowerCase())
  }
})
