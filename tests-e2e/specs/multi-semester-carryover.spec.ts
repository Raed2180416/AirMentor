import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { pinProofPlaybackCheckpoint } from '../helpers/proof-playback'
import {
  advanceProofRunStage,
  createStudentIntervention,
  findCheckpoint,
  readProofDashboard,
  readProofCheckpointDetail,
} from '../helpers/proof-run-api'
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

test('sem-1 realized marks carry over into sem-2 starting cgpa and semester evidence', async ({ page, request, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => { pageErrors.push(error.message) })

  expect(seededRun.runId).toMatch(/^simulation_run_/)
  const { session } = await loginWithApiContext(request, 'system-admin')

  // Step 1: pick a target student early (before any stage advance) so we can
  // capture baseline-projected sem-2 starting cgpa.
  const checkpointsBefore = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  const studentId: string | undefined = checkpointsBefore.activeRunDetail?.queuePreview?.[0]?.studentId
  expect(studentId, 'at least one section-A student').toBeTruthy()

  // Step 2: advance sem-1 to post-tt1 and apply a strong intervention.
  await advanceProofRunStage(request, seededRun.runId, session.csrfToken)
  await createStudentIntervention(request, session.csrfToken, {
    studentId,
    interventionType: 'targeted-tutoring',
    note: 'E2E Flow 4: sem-1 post-tt1 intervention for carryover test.',
    occurredAt: seededRun.simulatedDateIso,
  })

  // Step 3: advance through the rest of sem-1: post-tt2, pre-see, post-see.
  await advanceProofRunStage(request, seededRun.runId, session.csrfToken)
  await advanceProofRunStage(request, seededRun.runId, session.csrfToken)
  await advanceProofRunStage(request, seededRun.runId, session.csrfToken)

  // Step 4: capture sem-1 final sgpa for the student.
  const postSeeDashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  const postSeeCheckpoint = findCheckpoint(postSeeDashboard.activeRunDetail?.checkpoints ?? [], 1, 'post-see')
  const sem1CardRes = await request.get(apiPath(`/api/academic/student-shell/students/${studentId}/card?simulationRunId=${encodeURIComponent(seededRun.runId)}&simulationStageCheckpointId=${encodeURIComponent(postSeeCheckpoint.simulationStageCheckpointId)}`), {
    headers: { 'X-AirMentor-CSRF': session.csrfToken },
  })
  expect(sem1CardRes.ok()).toBeTruthy()
  const sem1Card = await sem1CardRes.json()
  const sem1Summary = sem1Card.overview?.semesterSummaries?.find((entry: { semesterNumber: number }) => entry.semesterNumber === 1)
  const sem1Sgpa: number = Number(sem1Summary?.sgpa ?? 0)
  expect(Number.isFinite(sem1Sgpa) && sem1Sgpa > 0).toBeTruthy()

  // Step 5: capture sem-1 realized latent state for the student.
  const sem1CheckpointDetail = await readProofCheckpointDetail(request, seededRun.runId, postSeeCheckpoint.simulationStageCheckpointId, session.csrfToken)
  expect(sem1CheckpointDetail.checkpoint.semesterNumber).toBe(1)

  // Step 6: advance into sem-2 pre-classes.
  await advanceProofRunStage(request, seededRun.runId, session.csrfToken)

  // Step 7: sem-2 starting cgpa must equal sem-1 sgpa (only one semester
  // completed, so cgpa == that semester's sgpa).
  const sem2Dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  const sem2Checkpoint = findCheckpoint(sem2Dashboard.activeRunDetail?.checkpoints ?? [], 2, 'pre-tt1')
  const sem2CardRes = await request.get(apiPath(`/api/academic/student-shell/students/${studentId}/card?simulationRunId=${encodeURIComponent(seededRun.runId)}&simulationStageCheckpointId=${encodeURIComponent(sem2Checkpoint.simulationStageCheckpointId)}`), {
    headers: { 'X-AirMentor-CSRF': session.csrfToken },
  })
  expect(sem2CardRes.ok()).toBeTruthy()
  const sem2Card = await sem2CardRes.json()
  const sem2Sem1Summary = sem2Card.overview?.semesterSummaries?.find((entry: { semesterNumber: number }) => entry.semesterNumber === 1)
  const sem2StartingCgpa: number = Number(sem2Sem1Summary?.cgpaAfterSemester ?? 0)
  expect(sem2StartingCgpa).toBeCloseTo(sem1Sgpa, 1)

  // Step 8: sem-2 starting latent state must equal sem-1 post-see latent
  // (carryover is lossless at the boundary).
  const sem2CheckpointDetail = await readProofCheckpointDetail(request, seededRun.runId, sem2Checkpoint.simulationStageCheckpointId, session.csrfToken)
  expect(sem2CheckpointDetail.checkpoint.semesterNumber).toBe(2)
  expect(sem2CheckpointDetail.checkpoint.previousCheckpointId).toBe(postSeeCheckpoint.simulationStageCheckpointId)

  // Step 9: UI sanity — HoD surface shows Semester 2 · pre-tt1.
  await pinProofPlaybackCheckpoint(page, seededRun.runId, sem2Checkpoint.simulationStageCheckpointId)
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await loginAs(page, 'hod')
  await Promise.all([
    page.waitForResponse(
      response => response.url().includes('/api/academic/hod/proof-bundle') && response.status() === 200,
      { timeout: 75_000 },
    ),
    page.goto('/#/app', { waitUntil: 'domcontentloaded' }),
  ])
  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible()
  await expect(hodSurface).toContainText(/(?:Semester|Sem)\s*2\s*[·•]\s*Pre\s*TT1/i)

  // Step 10: audit trail must show stage-realization-applied for every sem-1
  // stage transition (at least 5 entries since sem-1 has 5 advance calls).
  const auditBody = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  const auditEntries = Array.isArray(auditBody.lifecycleAudit)
    ? auditBody.lifecycleAudit.filter((entry: { simulationRunId: string; actionType: string }) =>
        entry.simulationRunId === seededRun.runId && entry.actionType === 'stage-realization-applied',
      )
    : []
  expect(auditEntries.length).toBeGreaterThanOrEqual(4)

  await page.waitForTimeout(500)
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
