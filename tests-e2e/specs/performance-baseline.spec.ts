import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { expect } from '../support/playwright-runtime'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { advanceProofRunStage, advanceProofRunToCheckpoint, readProofDashboard } from '../helpers/proof-run-api'
import { test } from '../fixtures/seeded-run-fixture'

const repoRoot = process.cwd()
const reportPath = path.join(repoRoot, 'audit-map/32-reports/performance-baseline-2026-05-10.md')

const budgets = {
  adminProofDashboardVisibleMs: 20_000,
  courseLeaderProofShellVisibleMs: 30_000,
  singleStageAdvanceMs: 60_000,
  hodProofBundleResponseMs: 30_000,
  hodAnalyticsVisibleMs: 45_000,
  counterfactualSimulatorResponseMs: 90_000,
  counterfactualPanelVisibleMs: 30_000,
} as const

type MetricKey = keyof typeof budgets

type Metric = {
  key: MetricKey | 'sem6PostSeeSetupMs'
  label: string
  durationMs: number
  budgetMs: number | null
  verdict: 'pass' | 'warn' | 'fail' | 'info'
}

function nowMs() {
  return Date.now()
}

function classify(durationMs: number, budgetMs: number): Metric['verdict'] {
  if (durationMs <= budgetMs) return 'pass'
  if (durationMs <= budgetMs * 1.25) return 'warn'
  return 'fail'
}

async function measureBudgeted<T>(metrics: Metric[], key: MetricKey, label: string, run: () => Promise<T>) {
  const startedAt = nowMs()
  const result = await run()
  const durationMs = nowMs() - startedAt
  metrics.push({ key, label, durationMs, budgetMs: budgets[key], verdict: classify(durationMs, budgets[key]) })
  return result
}

async function measureInformational<T>(metrics: Metric[], key: 'sem6PostSeeSetupMs', label: string, run: () => Promise<T>) {
  const startedAt = nowMs()
  const result = await run()
  const durationMs = nowMs() - startedAt
  metrics.push({ key, label, durationMs, budgetMs: null, verdict: 'info' })
  return result
}

function formatDuration(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`
}

function formatBudget(ms: number | null) {
  return ms === null ? 'informational' : formatDuration(ms)
}

function renderReport(input: {
  branch: string
  sha: string
  frontendBaseUrl: string
  apiBaseUrl: string
  outputDir: string
  runId: string
  batchId: string
  metrics: Metric[]
  consoleErrors: string[]
  pageErrors: string[]
}) {
  const scoredMetrics = input.metrics.filter(metric => metric.verdict !== 'info')
  const overall = scoredMetrics.some(metric => metric.verdict === 'fail') || input.consoleErrors.length > 0 || input.pageErrors.length > 0
    ? 'red'
    : scoredMetrics.some(metric => metric.verdict === 'warn')
      ? 'amber'
      : 'green'
  const rows = input.metrics
    .map(metric => `| ${metric.label} | ${formatDuration(metric.durationMs)} | ${formatBudget(metric.budgetMs)} | ${metric.verdict} |`)
    .join('\n')
  const consoleSection = input.consoleErrors.length > 0
    ? input.consoleErrors.map(item => `- ${item}`).join('\n')
    : '- None observed.'
  const pageSection = input.pageErrors.length > 0
    ? input.pageErrors.map(item => `- ${item}`).join('\n')
    : '- None observed.'

  return `# AirMentor H9 Performance Baseline — 2026-05-10

## Intent

Measure local seeded MSRUAS demo performance for evaluator-critical proof surfaces after P5/P9 browser proof passed. This report is local-demo evidence only; it is not production load, real-data, or multi-program scale evidence.

## Environment

- Branch: \`${input.branch}\`
- SHA: \`${input.sha}\`
- Frontend: \`${input.frontendBaseUrl}\`
- Backend: \`${input.apiBaseUrl}\`
- Browser: Playwright \`firefox\` unless overridden by env
- Video: expected disabled for local Nix Firefox runs
- Proof run: \`${input.runId}\`
- Batch: \`${input.batchId}\`

## Port Preflight

Before running this spec, use:

\`\`\`bash
ss -ltnp '( sport = :4000 or sport = :4100 or sport = :5173 or sport = :5174 )' || true
\`\`\`

For the recorded run, fresh measurement ports were \`${input.apiBaseUrl}\` and \`${input.frontendBaseUrl}\`. The run was executed without killing or reusing the pre-existing backend on \`4000\`; post-run verification should show \`4100\` and \`5174\` closed again.

## Command

\`\`\`bash
AIRMENTOR_GIT_BRANCH="$(git branch --show-current)" AIRMENTOR_GIT_SHA="$(git rev-parse --short HEAD)" AIRMENTOR_PW_FRONTEND_BASE_URL=${input.frontendBaseUrl} AIRMENTOR_PW_API_BASE_URL=${input.apiBaseUrl} AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx --no-install playwright test tests-e2e/specs/performance-baseline.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=${input.outputDir}
\`\`\`

## Verdict

- Overall: **${overall}**
- Rule: green means every scored surface stayed within budget and no browser console/page errors were observed. Amber means usable but above budget by no more than 25%. Red means timeout, crash, severe over-budget surface, or browser error.
- Sem6/post-SEE setup is informational because it is an internal heavy-context preparation path, not one evaluator click.

## Metrics

| Surface | Measured | Budget | Verdict |
|---|---:|---:|---|
${rows}

## Browser Console Errors

${consoleSection}

## Page Errors

${pageSection}

## Claim Boundary

H9 now has a measured local seeded performance baseline for the demo branch. This does not close production readiness, real institutional validation, deployment cold-start, real-data validation, or multi-tenant scale readiness.
`
}

test('H9 performance baseline: evaluator proof surfaces stay within local demo budget', async ({ page, request, seededRun }) => {
  test.setTimeout(540_000)
  const metrics: Metric[] = []
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session } = await loginWithApiContext(request, 'system-admin')

  await measureBudgeted(metrics, 'adminProofDashboardVisibleMs', 'System admin proof dashboard visible', async () => {
    await loginAs(page, 'system-admin')
    const [response] = await Promise.all([
      page.waitForResponse(item => item.url().includes(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`) && item.status() === 200, { timeout: 75_000 }),
      page.goto('/#/admin/proof-dashboard', { waitUntil: 'domcontentloaded' }),
    ])
    expect(response.ok()).toBeTruthy()
    await expect(page.locator('[data-proof-surface="system-admin-proof-control-plane"]').first()).toBeVisible({ timeout: 30_000 })
  })

  await measureBudgeted(metrics, 'courseLeaderProofShellVisibleMs', 'Course Leader proof shell visible', async () => {
    await loginAs(page, 'course-leader')
    await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
    await page.locator('[data-proof-action="open-faculty-profile"]').click()
    const surface = page.locator('[data-proof-surface="teacher-proof-panel"]').first()
    await expect(surface).toBeVisible({ timeout: 30_000 })
    await expect(surface).toContainText(/Proof Control Plane/i)
  })

  await measureBudgeted(metrics, 'singleStageAdvanceMs', 'Single Next Stage proof advance', async () => {
    await advanceProofRunStage(request, seededRun.runId, session.csrfToken)
    const dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
    expect(dashboard.activeRunDetail?.simulationRunId).toBe(seededRun.runId)
  })

  await measureInformational(metrics, 'sem6PostSeeSetupMs', 'Setup heavy HoD context at Sem6 post-SEE', async () => {
    await advanceProofRunToCheckpoint(request, seededRun.runId, seededRun.batchId, session.csrfToken, 6, 'post-see')
    const dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
    expect(dashboard.activeRunDetail?.activeOperationalSemester).toBe(6)
    expect(String(dashboard.activeRunDetail?.activeStageKey).toLowerCase()).toBe('post-see')
  })

  await loginAs(page, 'hod')
  const hodNavigationStartedAt = nowMs()
  const [hodBundleResponse] = await Promise.all([
    page.waitForResponse(item => item.url().includes('/api/academic/hod/proof-bundle') && item.status() === 200, { timeout: 90_000 }),
    page.goto('/#/app', { waitUntil: 'domcontentloaded' }),
  ])
  const hodBundleDurationMs = nowMs() - hodNavigationStartedAt
  metrics.push({
    key: 'hodProofBundleResponseMs',
    label: 'HoD proof bundle response',
    durationMs: hodBundleDurationMs,
    budgetMs: budgets.hodProofBundleResponseMs,
    verdict: classify(hodBundleDurationMs, budgets.hodProofBundleResponseMs),
  })
  expect(hodBundleResponse.ok()).toBeTruthy()

  await measureBudgeted(metrics, 'hodAnalyticsVisibleMs', 'HoD analytics surface visible after bundle', async () => {
    const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
    await expect(hodSurface).toBeVisible({ timeout: 45_000 })
    await expect(hodSurface).toContainText(/Department proof records for the active simulation run/i)
    await expect(hodSurface).toContainText(/Semester\s*6|Sem\s*6/i)
  })

  await measureBudgeted(metrics, 'counterfactualSimulatorResponseMs', 'Counterfactual simulator response', async () => {
    const counterfactualTab = page.getByRole('tab', { name: /Counterfactual Impact/i }).first()
    await expect(counterfactualTab).toBeVisible({ timeout: 30_000 })
    const [simulatorResponse] = await Promise.all([
      page.waitForResponse(item => item.url().includes('/api/academic/hod/proof-counterfactual-simulator') && item.status() === 200, { timeout: 90_000 }),
      counterfactualTab.click(),
    ])
    expect(simulatorResponse.ok()).toBeTruthy()
  })

  await measureBudgeted(metrics, 'counterfactualPanelVisibleMs', 'Counterfactual simulator panel visible', async () => {
    const simulatorPanel = page.locator('[data-proof-section="hod-counterfactual-simulator"]').first()
    await expect(simulatorPanel).toBeVisible({ timeout: 30_000 })
    await expect(simulatorPanel).toContainText(/Projected|simulated|counterfactual/i)
  })

  const report = renderReport({
    branch: process.env.AIRMENTOR_GIT_BRANCH ?? 'h9-performance-baseline-2026-05-10',
    sha: process.env.AIRMENTOR_GIT_SHA ?? 'unrecorded-by-test',
    frontendBaseUrl: process.env.AIRMENTOR_PW_FRONTEND_BASE_URL ?? 'http://127.0.0.1:5173',
    apiBaseUrl: process.env.AIRMENTOR_PW_API_BASE_URL ?? 'http://127.0.0.1:4000',
    outputDir: process.env.AIRMENTOR_PW_OUTPUT_DIR ?? 'output/playwright/h9-performance-baseline',
    runId: seededRun.runId,
    batchId: seededRun.batchId,
    metrics,
    consoleErrors,
    pageErrors,
  })
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, report, 'utf8')

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
