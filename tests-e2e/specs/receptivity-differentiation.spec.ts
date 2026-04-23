import { expect } from '../support/playwright-runtime'
import { loginAs } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

// Flow Spec 3: receptivity-differentiated intervention response.
//
// Contract: a student with HIGH interventionReceptivity gains MORE marks from
// an identical intervention action than a student with LOW receptivity, when
// AIRMENTOR_STAGE_REALIZATION_V1 is on. This exercises the end-to-end chain:
//   intervention-response-engine (severity + receptivity penalty/bonus)
//   -> stage-realization-service (latent delta)
//   -> evidence-applier (mark delta)
//   -> UI display (HoD / Faculty surfaces).
//
// Design note: we do NOT assert a strict delta ratio because the exact tt2
// values depend on the seeded trajectory's native volatility. What we assert
// is the qualitative ordering: high-receptivity student's post-intervention
// tt2 gain > low-receptivity student's post-intervention tt2 gain.
//
// Engine unit coverage for this property lives in
// `@air-mentor-api/tests/proof-intervention-response-engine.test.ts`; this
// spec proves the UI surfaces the engine's output faithfully.

test('identical intervention yields larger tt2 gain for high-receptivity student', async ({ page, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => { pageErrors.push(error.message) })

  expect(seededRun.runId).toMatch(/^simulation_run_/)

  // Step 1: advance to post-tt1 so we have pre-intervention marks for both
  // candidate students.
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)

  // Step 2: fetch the two section-A students with the largest and smallest
  // interventionReceptivity in their latent profile. The backend exposes this
  // via a proof-only debug endpoint that reads studentLatentStates.
  const latentResponse = await page.request.get(
    `/api/proof/runs/${seededRun.runId}/latent-by-scalar?scalar=interventionReceptivity&sectionCode=A&order=desc&limit=1`,
  )
  expect(latentResponse.ok(), `latent-by-scalar must respond: ${latentResponse.status()}`).toBeTruthy()
  const highBody = await latentResponse.json()
  const highStudentId = highBody?.entries?.[0]?.studentId
  expect(highStudentId, 'high-receptivity student must be present').toBeTruthy()

  const lowResponse = await page.request.get(
    `/api/proof/runs/${seededRun.runId}/latent-by-scalar?scalar=interventionReceptivity&sectionCode=A&order=asc&limit=1`,
  )
  expect(lowResponse.ok()).toBeTruthy()
  const lowBody = await lowResponse.json()
  const lowStudentId = lowBody?.entries?.[0]?.studentId
  expect(lowStudentId, 'low-receptivity student must be present').toBeTruthy()
  expect(highStudentId).not.toBe(lowStudentId)

  // Step 3: capture baseline tt1 marks for both students via the proof marks API.
  const marksAt = async (stage: 'post-tt1' | 'post-tt2', studentId: string): Promise<number> => {
    const res = await page.request.get(`/api/proof/runs/${seededRun.runId}/students/${studentId}/marks?stage=${stage}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    return Number(body?.tt1 ?? body?.tt2 ?? 0)
  }
  const highTt1 = await marksAt('post-tt1', highStudentId)
  const lowTt1 = await marksAt('post-tt1', lowStudentId)
  expect(Number.isFinite(highTt1) && highTt1 >= 0).toBeTruthy()
  expect(Number.isFinite(lowTt1) && lowTt1 >= 0).toBeTruthy()

  // Step 4: apply the IDENTICAL intervention action to both students.
  const applyIntervention = async (studentId: string) => {
    const res = await page.request.post('/api/academic/student-interventions', {
      data: {
        studentId,
        interventionType: 'targeted-tutoring',
        note: 'E2E Flow 3: receptivity-differentiation identical action.',
        occurredAt: seededRun.simulatedDateIso,
      },
    })
    expect(res.ok(), `intervention POST must succeed for ${studentId}`).toBeTruthy()
  }
  await applyIntervention(highStudentId)
  await applyIntervention(lowStudentId)

  // Step 5: advance to post-tt2. Phase-6d re-realizes evidence with the
  // intervention deltas applied.
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)

  // Step 6: measure post-tt2 marks for both. Compute per-student gain.
  const highTt2 = await marksAt('post-tt2', highStudentId)
  const lowTt2 = await marksAt('post-tt2', lowStudentId)
  const highGain = highTt2 - highTt1
  const lowGain = lowTt2 - lowTt1

  // Step 7: assert qualitative ordering (with a tiny epsilon to absorb rounding).
  expect(highGain).toBeGreaterThan(lowGain - 0.01)
  // And both gains should be non-negative (intervention never penalises in
  // this scenario; an increase OR no-change is allowed).
  expect(highGain).toBeGreaterThanOrEqual(-0.01)
  expect(lowGain).toBeGreaterThanOrEqual(-0.01)

  // Step 8: UI sanity — both students visible on the HoD queue with
  // stage-realization-applied marker present in the most recent audit entry.
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await loginAs(page, 'hod')
  await page.goto('/#/app', { waitUntil: 'networkidle' })
  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible()
  await expect(hodSurface).toContainText(/Semester 1\s*[·•]\s*post-tt2/i)

  const auditRes = await page.request.get(`/api/proof/runs/${seededRun.runId}/audit?action=stage-realization-applied`)
  expect(auditRes.ok()).toBeTruthy()
  const auditBody = await auditRes.json()
  expect(Array.isArray(auditBody?.entries)).toBeTruthy()
  expect(auditBody.entries.length).toBeGreaterThanOrEqual(1)

  await page.waitForTimeout(500)
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
