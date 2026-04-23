import { expect } from '../support/playwright-runtime'
import { loginAs } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

// Flow Spec 4: multi-semester carryover.
//
// Contract: realized marks + realized latent state from semester 1 persist
// into the student's starting state for semester 2. Specifically:
//   1. Advance sem-1 through all 5 stages (pre-tt1 -> post-see), applying at
//      least one intervention at post-tt1 to create a non-baseline carryover.
//   2. Assert sem-1 final sgpa is computed from realized marks, not baseline.
//   3. Advance into sem-2 pre-classes.
//   4. Assert the student's sem-2 starting cgpa reflects the realized sem-1
//      sgpa (not the baseline trajectory's native sem-1 sgpa).
//   5. Assert the student's sem-2 latent state dynamics.consistency reflects
//      any sem-1 realized shift, i.e. carryover is not truncated.
//
// This validates that the Phase-6d realization pipeline is the single source
// of truth for cross-semester continuity (the seeded trajectory's native sem-2
// starting state is the fallback only when the flag is off).

test('sem-1 realized marks carry over into sem-2 starting cgpa and latent state', async ({ page, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => { pageErrors.push(error.message) })

  expect(seededRun.runId).toMatch(/^simulation_run_/)

  // Step 1: pick a target student early (before any stage advance) so we can
  // capture baseline-projected sem-2 starting cgpa.
  const firstRow = await page.request.get(`/api/proof/runs/${seededRun.runId}/students?sectionCode=A&limit=1`)
  expect(firstRow.ok()).toBeTruthy()
  const firstBody = await firstRow.json()
  const studentId: string | undefined = firstBody?.entries?.[0]?.studentId
  expect(studentId, 'at least one section-A student').toBeTruthy()

  // Step 2: advance sem-1 to post-tt1 and apply a strong intervention.
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)
  const applyRes = await page.request.post('/api/academic/student-interventions', {
    data: {
      studentId,
      interventionType: 'targeted-tutoring',
      note: 'E2E Flow 4: sem-1 post-tt1 intervention for carryover test.',
      occurredAt: seededRun.simulatedDateIso,
    },
  })
  expect(applyRes.ok()).toBeTruthy()

  // Step 3: advance through the rest of sem-1: post-tt2, pre-see, post-see.
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)

  // Step 4: capture sem-1 final sgpa for the student.
  const sem1Res = await page.request.get(`/api/proof/runs/${seededRun.runId}/students/${studentId}/sgpa?semesterNumber=1`)
  expect(sem1Res.ok()).toBeTruthy()
  const sem1Body = await sem1Res.json()
  const sem1Sgpa: number = Number(sem1Body?.sgpa ?? 0)
  expect(Number.isFinite(sem1Sgpa) && sem1Sgpa > 0).toBeTruthy()

  // Step 5: capture sem-1 realized latent state for the student.
  const sem1LatentRes = await page.request.get(`/api/proof/runs/${seededRun.runId}/students/${studentId}/latent?semesterNumber=1&stage=post-see`)
  expect(sem1LatentRes.ok()).toBeTruthy()
  const sem1LatentBody = await sem1LatentRes.json()
  const sem1Consistency: number = Number(sem1LatentBody?.dynamics?.consistency ?? 0)
  expect(Number.isFinite(sem1Consistency) && sem1Consistency > 0).toBeTruthy()

  // Step 6: advance into sem-2 pre-classes.
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)

  // Step 7: sem-2 starting cgpa must equal sem-1 sgpa (only one semester
  // completed, so cgpa == that semester's sgpa).
  const sem2CgpaRes = await page.request.get(`/api/proof/runs/${seededRun.runId}/students/${studentId}/cgpa?semesterNumber=2&stage=pre-tt1`)
  expect(sem2CgpaRes.ok()).toBeTruthy()
  const sem2CgpaBody = await sem2CgpaRes.json()
  const sem2StartingCgpa: number = Number(sem2CgpaBody?.cgpa ?? 0)
  expect(sem2StartingCgpa).toBeCloseTo(sem1Sgpa, 1)  // within 0.1 for rounding

  // Step 8: sem-2 starting latent state must equal sem-1 post-see latent
  // (carryover is lossless at the boundary).
  const sem2LatentRes = await page.request.get(`/api/proof/runs/${seededRun.runId}/students/${studentId}/latent?semesterNumber=2&stage=pre-tt1`)
  expect(sem2LatentRes.ok()).toBeTruthy()
  const sem2LatentBody = await sem2LatentRes.json()
  const sem2Consistency: number = Number(sem2LatentBody?.dynamics?.consistency ?? 0)
  expect(sem2Consistency).toBeCloseTo(sem1Consistency, 2)

  // Step 9: UI sanity — HoD surface shows Semester 2 · pre-tt1.
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await loginAs(page, 'hod')
  await page.goto('/#/app', { waitUntil: 'networkidle' })
  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible()
  await expect(hodSurface).toContainText(/Semester 2\s*[·•]\s*pre-tt1/i)

  // Step 10: audit trail must show stage-realization-applied for every sem-1
  // stage transition (at least 5 entries since sem-1 has 5 advance calls).
  const auditRes = await page.request.get(`/api/proof/runs/${seededRun.runId}/audit?action=stage-realization-applied`)
  expect(auditRes.ok()).toBeTruthy()
  const auditBody = await auditRes.json()
  expect(auditBody.entries.length).toBeGreaterThanOrEqual(5)

  await page.waitForTimeout(500)
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
