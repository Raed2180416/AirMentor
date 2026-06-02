import fs from 'node:fs/promises'
import path from 'node:path'
import { test } from '../fixtures/seeded-run-fixture'
import { expect } from '../support/playwright-runtime'
import { getAcademicBootstrap } from '../helpers/automation-flow'
import { loginAs, loginWithApiContext } from '../helpers/login-as'

const OUTPUT_ROOT = path.join(process.cwd(), 'output/playwright/course-leader-tt-blueprint-sentinel')

type QuestionPaperNode = {
  id: string
  label?: string
  maxMarks?: number
  children?: QuestionPaperNode[]
}

function flattenLeaves(nodes: QuestionPaperNode[]): QuestionPaperNode[] {
  return nodes.flatMap(node => Array.isArray(node.children) && node.children.length > 0 ? flattenLeaves(node.children) : [node])
}

async function readSavedTt1FromBootstrap(
  requestContext: Parameters<typeof getAcademicBootstrap>[0],
  offeringId: string,
  csrfToken: string,
) {
  const bootstrap = await getAcademicBootstrap(requestContext, csrfToken)
  const paper = bootstrap.questionPapersByOffering?.[offeringId]?.tt1
  if (!paper) throw new Error(`Bootstrap did not include saved TT1 question paper for ${offeringId}`)
  return {
    offeringId,
    blueprint: paper as {
      kind: 'tt1'
      totalMarks: number
      nodes: QuestionPaperNode[]
    },
  }
}

async function capture(page: { screenshot(options: { path: string; fullPage?: boolean }): Promise<Buffer> }, fileName: string) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })
  await page.screenshot({ path: path.join(OUTPUT_ROOT, fileName), fullPage: true })
}

test('course leader TT blueprint sentinel: invalid totals block entry and valid blueprint round-trips', async ({ page, request, seededRun }) => {
  test.setTimeout(420_000)
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true })
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })

  const consoleErrors: string[] = []
  const tt1SaveStatuses: number[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.request().method() === 'PUT' && response.url().includes('/api/academic/offerings/') && response.url().includes('/question-papers/tt1')) {
      tt1SaveStatuses.push(response.status())
    }
  })

  const { session: bootstrapSession } = await loginWithApiContext(request, 'course-leader')
  const bootstrap = await getAcademicBootstrap(request, bootstrapSession.csrfToken)
  const offerings = Array.isArray(bootstrap.offerings) ? bootstrap.offerings : []
  const primaryOffering = offerings.find((offering: { sem?: number; section?: string }) =>
    offering.sem === 1 && String(offering.section ?? '').toUpperCase() === 'A',
  ) ?? offerings[0]
  expect(primaryOffering, 'Course Leader bootstrap should expose at least one offering').toBeTruthy()
  const primaryOfferingId = String(primaryOffering.offId ?? primaryOffering.id)
  const primaryCourseCode = String(primaryOffering.code)
  const primarySection = String(primaryOffering.section)

  const { session: pageSession } = await loginAs(page, 'course-leader')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Course Leader Dashboard/i)).toBeVisible({ timeout: 45_000 })

  const courseCard = page.locator('div[data-surface="selected"][data-interactive="true"]')
    .filter({ hasText: primaryCourseCode })
    .filter({ hasText: `Sec ${primarySection}` })
    .first()
  await expect(courseCard).toBeVisible({ timeout: 30_000 })
  await courseCard.click()
  await expect(page.getByRole('button', { name: /TT1/i })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /TT1/i }).click()
  await expect(page.getByText(/TT1 Blueprint Builder/i)).toBeVisible({ timeout: 20_000 })

  const saveCountBeforeInvalidDraft = tt1SaveStatuses.length
  await page.getByRole('button', { name: /Add Part/i }).first().click()
  await expect(page.getByText(/Total 26\/25/i)).toBeVisible({ timeout: 10_000 })
  const proceedButton = page.getByRole('button', { name: /Proceed to TT1 Entry/i })
  await expect(proceedButton).toBeDisabled()
  await capture(page, 'tt1-invalid-total-blocked.png')
  await page.waitForTimeout(1_000)
  const saveCountAfterInvalidDraft = tt1SaveStatuses.length
  expect(saveCountAfterInvalidDraft, 'Invalid 26/25 local draft must not be persisted to backend').toBe(saveCountBeforeInvalidDraft)

  const firstMaxInput = page.locator('input[type="number"]').first()
  const firstMax = Number(await firstMaxInput.inputValue())
  expect(firstMax, 'First TT leaf max mark should be reducible to repair the 26/25 draft').toBeGreaterThan(1)
  const saveAfterRepair = page.waitForResponse(response =>
    response.request().method() === 'PUT'
    && response.url().includes(`/api/academic/offerings/${encodeURIComponent(primaryOfferingId)}/question-papers/tt1`)
    && response.status() === 200,
  { timeout: 45_000 })
  await firstMaxInput.fill(String(firstMax - 1))
  await saveAfterRepair
  await expect(page.getByText(/Total 25\/25/i)).toBeVisible({ timeout: 10_000 })
  await expect(proceedButton).toBeEnabled()

  const q1bPart = page.getByLabel('Canonical part label Q1b').locator('xpath=ancestor::div[2]')
  const saveAfterCo2 = page.waitForResponse(response =>
    response.request().method() === 'PUT'
    && response.url().includes(`/api/academic/offerings/${encodeURIComponent(primaryOfferingId)}/question-papers/tt1`)
    && response.status() === 200,
  { timeout: 45_000 })
  await q1bPart.getByRole('button', { name: /^CO2$/ }).click()
  await saveAfterCo2

  const saveAfterCo3 = page.waitForResponse(response =>
    response.request().method() === 'PUT'
    && response.url().includes(`/api/academic/offerings/${encodeURIComponent(primaryOfferingId)}/question-papers/tt1`)
    && response.status() === 200,
  { timeout: 45_000 })
  await q1bPart.getByRole('button', { name: /^CO3$/ }).click()
  await saveAfterCo3

  const savedPaper = await readSavedTt1FromBootstrap(page.context().request, primaryOfferingId, pageSession.csrfToken)
  const savedLeaves = flattenLeaves(savedPaper.blueprint.nodes)
  const savedLeafIds = savedLeaves.map(leaf => leaf.id)
  expect(savedPaper.blueprint.totalMarks).toBe(25)
  expect(savedLeafIds).toContain('tt1-q1-p2')
  const q1b = savedLeaves.find(leaf => leaf.id === 'tt1-q1-p2')
  expect(q1b?.maxMarks).toBe(1)
  expect(q1b?.children).toBeUndefined()

  await page.reload({ waitUntil: 'domcontentloaded' })
  if (!await page.getByText(/TT1 Blueprint Builder/i).isVisible({ timeout: 8_000 }).catch(() => false)) {
    await expect(page.getByText(/Course Leader Dashboard/i)).toBeVisible({ timeout: 45_000 })
    await courseCard.click()
    await expect(page.getByRole('button', { name: /TT1/i })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /TT1/i }).click()
  }
  await expect(page.getByText(/Total 25\/25/i)).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Proceed to TT1 Entry/i }).click()
  await expect(page.getByText(/Direct Entry Workspace/i)).toBeVisible({ timeout: 30_000 })
  await page.locator('#entry-workspace-class').selectOption(primaryOfferingId)
  await expect(page.locator(`input[data-leaf-id="${savedLeafIds[0]}"]`).first()).toBeVisible({ timeout: 20_000 })
  const renderedLeafIds = await page.locator('input[data-leaf-id]').evaluateAll(elements =>
    Array.from(new Set(elements.map(element => element.getAttribute('data-leaf-id')).filter(Boolean))),
  )
  expect(renderedLeafIds).toEqual(savedLeafIds)
  await capture(page, 'tt1-valid-blueprint-entry-grid.png')

  const blueprintConsoleErrors = consoleErrors.filter(message => message.includes('question-paper blueprints'))
  expect(blueprintConsoleErrors, 'Blueprint persistence should not emit console errors during the sentinel').toEqual([])

  await fs.writeFile(path.join(OUTPUT_ROOT, 'course-leader-tt-blueprint-sentinel.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    runId: seededRun.runId,
    offeringId: primaryOfferingId,
    courseCode: primaryCourseCode,
    section: primarySection,
    invalidDraft: {
      totalMarks: 26,
      persistedSaveCountBeforeInvalidDraft: saveCountBeforeInvalidDraft,
      observedSaveCountAfterInvalidDraft: saveCountAfterInvalidDraft,
    },
    savedBlueprint: {
      totalMarks: savedPaper.blueprint.totalMarks,
      leafIds: savedLeafIds,
      q1b,
    },
    renderedLeafIds,
    tt1SaveStatuses,
  }, null, 2))
})
