import { expect } from '../support/playwright-runtime'
import { loginAs } from '../helpers/login-as'
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

test('all intervention display sites surface humanised labels, never raw action codes', async ({ page, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => { pageErrors.push(error.message) })

  expect(seededRun.runId).toMatch(/^simulation_run_/)

  // Step 1: advance to post-tt1 and seed 3 interventions with distinct action
  // codes. We intentionally use the legacy-typed interventionType strings so
  // the backend maps them through mapLegacyInterventionTypeToActionCode, which
  // is the production path.
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)
  await page.request.post(`/api/proof/runs/${seededRun.runId}/advance-stage`)

  const studentsRes = await page.request.get(`/api/proof/runs/${seededRun.runId}/students?sectionCode=A&limit=3`)
  expect(studentsRes.ok()).toBeTruthy()
  const studentsBody = await studentsRes.json()
  const studentIds: string[] = (studentsBody?.entries ?? []).map((entry: { studentId: string }) => entry.studentId)
  expect(studentIds.length).toBe(3)

  const interventionPlan = [
    { studentId: studentIds[0], interventionType: 'targeted-tutoring', expectedLabel: /Targeted\s*Tutoring/i },
    { studentId: studentIds[1], interventionType: 'parent-engagement', expectedLabel: /Parent\s*Engagement/i },
    { studentId: studentIds[2], interventionType: 'remedial-plan', expectedLabel: /Remedial\s*Plan/i },
  ]

  for (const plan of interventionPlan) {
    const res = await page.request.post('/api/academic/student-interventions', {
      data: {
        studentId: plan.studentId,
        interventionType: plan.interventionType,
        note: `E2E Flow 5: ${plan.interventionType}.`,
        occurredAt: seededRun.simulatedDateIso,
      },
    })
    expect(res.ok()).toBeTruthy()
  }

  // Step 2: HoD logs in and opens the academic workspace.
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await loginAs(page, 'hod')
  await page.goto('/#/app', { waitUntil: 'networkidle' })

  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible()

  // Step 3: assert HoD queue row (display site 1) shows humanised labels, not
  // raw codes.
  for (const plan of interventionPlan) {
    const row = hodSurface.locator(`[data-testid="proof-queue-row"][data-student-id="${plan.studentId}"]`).first()
    await expect(row).toBeVisible()
    const interventionCellText = await row.locator('[data-testid="proof-queue-intervention-label"]').innerText()
    expect(interventionCellText).toMatch(plan.expectedLabel)
    // Negative: no raw ALL_CAPS_CODE leaked.
    expect(interventionCellText).not.toMatch(/^[A-Z_]{6,}$/)
  }

  // Step 4: open HoD case detail drawer (display site 2) for student 0 and
  // assert the intervention timeline uses humanised labels.
  const firstRow = hodSurface.locator(`[data-testid="proof-queue-row"][data-student-id="${studentIds[0]}"]`).first()
  await firstRow.click()
  const drawer = page.locator('[data-testid="proof-case-detail-drawer"]').first()
  await expect(drawer).toBeVisible()
  const timelineEntries = drawer.locator('[data-testid="proof-intervention-history-entry"]')
  await expect(timelineEntries.first()).toBeVisible()
  const firstTimelineText = await timelineEntries.first().innerText()
  expect(firstTimelineText).toMatch(/Targeted\s*Tutoring/i)
  expect(firstTimelineText).not.toMatch(/TARGETED_TUTORING/)

  // Step 5: course-leader student-detail page (display site 3) for student 1.
  // Close drawer, logout, log in as course-leader (proof-faculty role).
  await page.keyboard.press('Escape')
  await page.goto('/#/app/logout', { waitUntil: 'networkidle' })
  await loginAs(page, 'course-leader')
  await page.goto(`/#/app/academic/students/${studentIds[1]}`, { waitUntil: 'networkidle' })

  const facultyTimeline = page.locator('[data-testid="faculty-intervention-timeline"]').first()
  await expect(facultyTimeline).toBeVisible()
  const facultyTimelineText = await facultyTimeline.innerText()
  expect(facultyTimelineText).toMatch(/Parent\s*Engagement/i)
  expect(facultyTimelineText).not.toMatch(/PARENT_ENGAGEMENT/)

  await page.waitForTimeout(500)
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
