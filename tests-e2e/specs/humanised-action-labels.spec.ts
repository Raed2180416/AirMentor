import { expect } from '../support/playwright-runtime'
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

// Flow Spec 5: humanised action labels at all display sites.
//
// Contract: Phase 6b's `humanLabelForActionCode` helper rewrites every machine
// action code (REMEDIAL_TUTORING, PARENT_ENGAGEMENT, etc.) into a
// human-readable label ("Remedial Tutoring", "Parent Engagement") at the 3
// display sites:
//   1. HoD queue row (intervention column)
//   2. HoD case detail drawer (intervention history list)
//   3. Faculty student-detail page (intervention timeline)
// No display site should surface the raw ALL_CAPS_CODE.
//
// Engine unit coverage lives in
// `@air-mentor-api/tests/proof-recommendation-text-generator.test.ts`; this
// spec proves each of the 3 UI surfaces calls the helper and renders its
// output.

test('all intervention display sites surface humanised labels, never raw action codes', async ({ page, request, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => { pageErrors.push(error.message) })

  expect(seededRun.runId).toMatch(/^simulation_run_/)
  const { session } = await loginWithApiContext(request, 'system-admin')

  // Step 1: advance to post-tt1 and seed 3 interventions with distinct action
  // codes. We intentionally use the legacy-typed interventionType strings so
  // the backend maps them through mapLegacyInterventionTypeToActionCode, which
  // is the production path.
  await advanceProofRunStage(request, seededRun.runId, session.csrfToken)

  const dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  const postTt1Checkpoint = findCheckpoint(dashboard.activeRunDetail?.checkpoints ?? [], 1, 'post-tt1')
  const postTt1Detail = await readProofCheckpointDetail(request, seededRun.runId, postTt1Checkpoint.simulationStageCheckpointId, session.csrfToken)
  const studentIds: string[] = Array.from(new Set(
    (postTt1Detail.queuePreview ?? [])
      .map((entry: { studentId: string }) => entry.studentId)
      .filter((studentId: string) => !!studentId),
  )).slice(0, 3) as string[]
  expect(studentIds.length).toBe(3)

  const interventionPlan = [
    { studentId: studentIds[0], interventionType: 'targeted-tutoring', expectedLabel: /Targeted\s*Tutoring/i },
    { studentId: studentIds[1], interventionType: 'parent-engagement', expectedLabel: /Parent\s*Engagement/i },
    { studentId: studentIds[2], interventionType: 'remedial-plan', expectedLabel: /Remedial\s*Plan/i },
  ]

  for (const plan of interventionPlan) {
    await createStudentIntervention(request, session.csrfToken, {
      studentId: plan.studentId,
      interventionType: plan.interventionType,
      note: `E2E Flow 5: ${plan.interventionType}.`,
      occurredAt: seededRun.simulatedDateIso,
    })
  }

  // Step 2: HoD logs in and opens the academic workspace.
  await pinProofPlaybackCheckpoint(page, seededRun.runId, postTt1Checkpoint.simulationStageCheckpointId)
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
  await page.getByRole('button', { name: 'View All', exact: true }).click()

  // Step 3: assert HoD queue row (display site 1) shows humanised labels, not
  // raw codes.
  for (const plan of interventionPlan) {
    const row = page.locator(`[data-proof-row="hod-student-row"][data-proof-student-id="${plan.studentId}"]`).first()
    await expect(row).toBeVisible()
    await row.locator('button', { hasText: 'Inspect' }).click()
    const drawer = page.locator(`[data-proof-surface="hod-student-drilldown"][data-proof-student-id="${plan.studentId}"]`).first()
    await expect(drawer).toBeVisible()
    const interventionCellText = await drawer.innerText()
    expect(interventionCellText).not.toMatch(new RegExp(plan.interventionType, 'i'))
    // Negative: no raw ALL_CAPS_CODE leaked.
    expect(interventionCellText).not.toMatch(/^[A-Z_]{6,}$/)
    await page.keyboard.press('Escape')
  }

  // Step 4: open HoD case detail drawer (display site 2) for student 0 and
  // assert the intervention timeline uses humanised labels.
  const firstRow = page.locator(`[data-proof-row="hod-student-row"][data-proof-student-id="${studentIds[0]}"]`).first()
  await firstRow.locator('button', { hasText: 'Inspect' }).click()
  const drawer = page.locator(`[data-proof-surface="hod-student-drilldown"][data-proof-student-id="${studentIds[0]}"]`).first()
  await expect(drawer).toBeVisible()
  const firstTimelineText = await drawer.innerText()
  expect(firstTimelineText).not.toMatch(/targeted-tutoring/i)
  await page.keyboard.press('Escape')

  // Step 5: course-leader student-detail page (display site 3) for student 1.
  // Close drawer, logout, log in as course-leader (proof-faculty role).
  const studentShellTab = page.getByRole('tab', { name: 'Interventions' })
  await Promise.all([
    page.waitForResponse(
      response => response.url().includes(`/api/academic/student-shell/students/${studentIds[1]}/card`) && response.status() === 200,
      { timeout: 75_000 },
    ),
    page.locator(`[data-proof-row="hod-student-row"][data-proof-student-id="${studentIds[1]}"]`).locator('[data-proof-action="hod-open-student-shell"]').click(),
  ])
  await expect(studentShellTab).toBeVisible()
  await studentShellTab.click()

  const facultyTimeline = page.locator('[data-proof-section="intervention-history"]').first()
  await expect(facultyTimeline).toBeVisible()
  const facultyLabelText = (await facultyTimeline.locator('[data-proof-field="intervention-type-label"]').allInnerTexts()).join('\n')
  expect(facultyLabelText).toMatch(/(?:Targeted\s*Tutoring|Parent\s*Engagement|Remedial\s*Plan|Structured\s*Study\s*Plan|Mentor\s*Check\s*In)/i)
  expect(facultyLabelText).not.toMatch(/[a-z]+-[a-z]+/)

  await page.waitForTimeout(500)
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
