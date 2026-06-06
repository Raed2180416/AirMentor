import fs from 'node:fs/promises'
import path from 'node:path'
import { test } from '../fixtures/seeded-run-fixture'
import { expect } from '../support/playwright-runtime'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { pinProofPlaybackCheckpoint } from '../helpers/proof-playback'
import {
  findCheckpoint,
  readProofCheckpointDetail,
  readProofDashboard,
} from '../helpers/proof-run-api'

const OUTPUT_ROOT = path.join(process.cwd(), 'output/playwright/proof-browser-sentinel-matrix')

type CheckpointSummary = {
  semesterNumber: number
  stageKey: string
  simulationStageCheckpointId: string
  totalStudentProjectionCount?: number
  studentCount?: number
  highRiskCount?: number
  mediumRiskCount?: number
  lowRiskCount?: number
}

const BASE_SENTINELS = [
  { label: 'sem1-pre-tt1-baseline', semesterNumber: 1, stageKey: 'pre-tt1' },
  { label: 'sem6-pre-tt1-late-baseline', semesterNumber: 6, stageKey: 'pre-tt1' },
  { label: 'sem6-post-see-close', semesterNumber: 6, stageKey: 'post-see' },
] as const

const ROLE_SURFACES = [
  {
    role: 'course-leader',
    selector: '[data-proof-surface="teacher-proof-panel"]',
    text: /Proof Control Plane/i,
    openFacultyProfile: true,
  },
  {
    role: 'mentor',
    selector: '[data-proof-surface="teacher-proof-panel"]',
    text: /Proof Control Plane/i,
    openFacultyProfile: true,
  },
  {
    role: 'hod',
    selector: '[data-proof-surface="hod-proof-analytics"]',
    text: /Department proof records|Semester|Sem/i,
    openFacultyProfile: false,
  },
] as const

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function checkpointLabel(checkpoint: CheckpointSummary) {
  return `Semester ${checkpoint.semesterNumber} / ${checkpoint.stageKey}`
}

function checkpointDisplayStage(stageKey: string) {
  switch (stageKey) {
    case 'pre-tt1':
      return 'Pre TT1'
    case 'post-tt1':
      return 'Post TT1'
    case 'post-tt2':
      return 'Post TT2'
    case 'post-assignments':
      return 'Post Assignments'
    case 'post-see':
      return 'Post SEE'
    default:
      return stageKey
  }
}

function checkpointDisplayPattern(checkpoint: CheckpointSummary) {
  return new RegExp(`Semester\\s*${checkpoint.semesterNumber}\\s*[·/]\\s*${checkpointDisplayStage(checkpoint.stageKey)}`, 'i')
}

function riskTailCount(checkpoint: CheckpointSummary) {
  return Number(checkpoint.mediumRiskCount ?? 0) + Number(checkpoint.highRiskCount ?? 0)
}

function selectRiskTailCheckpoint(checkpoints: CheckpointSummary[]) {
  return checkpoints
    .filter(checkpoint => riskTailCount(checkpoint) > 0)
    .sort((left, right) =>
      Number(right.highRiskCount ?? 0) - Number(left.highRiskCount ?? 0)
      || riskTailCount(right) - riskTailCount(left)
      || Number(right.totalStudentProjectionCount ?? 0) - Number(left.totalStudentProjectionCount ?? 0)
      || left.semesterNumber - right.semesterNumber
      || left.stageKey.localeCompare(right.stageKey),
    )[0] ?? null
}

async function capture(page: { screenshot(options: { path: string; fullPage?: boolean }): Promise<Buffer> }, fileName: string) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })
  await page.screenshot({ path: path.join(OUTPUT_ROOT, fileName), fullPage: false })
}

test('proof browser sentinel matrix: pinned checkpoints render across core roles', async ({ page, request, seededRun }) => {
  test.setTimeout(360_000)
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true })
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session } = await loginWithApiContext(request, 'system-admin')
  const dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  const checkpointRows = asArray<CheckpointSummary>(dashboard.activeRunDetail?.checkpoints)
  expect(checkpointRows.length).toBe(30)

  const fixedCheckpoints = BASE_SENTINELS.map(item => ({
    ...item,
    checkpoint: findCheckpoint(checkpointRows, item.semesterNumber, item.stageKey),
  }))
  const riskTailCheckpoint = selectRiskTailCheckpoint(checkpointRows)
  expect(riskTailCheckpoint, 'Fresh proof run must expose at least one Medium/High risk checkpoint for the demo smoke').toBeTruthy()
  const checkpoints = [
    ...fixedCheckpoints,
    {
      label: `risk-tail-sem${riskTailCheckpoint!.semesterNumber}-${riskTailCheckpoint!.stageKey}`,
      semesterNumber: riskTailCheckpoint!.semesterNumber,
      stageKey: riskTailCheckpoint!.stageKey,
      checkpoint: riskTailCheckpoint!,
    },
  ].filter((item, index, values) =>
    values.findIndex(candidate => candidate.checkpoint.simulationStageCheckpointId === item.checkpoint.simulationStageCheckpointId) === index,
  )

  const matrix: Array<Record<string, unknown>> = []
  for (const item of checkpoints) {
    const detail = await readProofCheckpointDetail(
      request,
      seededRun.runId,
      item.checkpoint.simulationStageCheckpointId,
      session.csrfToken,
    )
    expect(detail.checkpoint?.simulationStageCheckpointId).toBe(item.checkpoint.simulationStageCheckpointId)
    const projectionRows = Number(item.checkpoint.totalStudentProjectionCount ?? 0)
    const studentCount = Number(item.checkpoint.studentCount ?? 0)
    const bandCounts = {
      Low: Number(item.checkpoint.lowRiskCount ?? 0),
      Medium: Number(item.checkpoint.mediumRiskCount ?? 0),
      High: Number(item.checkpoint.highRiskCount ?? 0),
    }
    expect(projectionRows, `${item.label} should expose projection rows`).toBeGreaterThan(0)
    expect(studentCount, `${item.label} should expose students`).toBeGreaterThan(0)
    const atRiskCount = bandCounts.Medium + bandCounts.High
    matrix.push({
      sentinel: item.label,
      checkpointId: item.checkpoint.simulationStageCheckpointId,
      checkpoint: checkpointLabel(item.checkpoint),
      studentRows: studentCount,
      projectionRows,
      queuePreviewRows: asArray(detail.queuePreview).length,
      offeringRollups: asArray(detail.offeringRollups).length,
      bandCounts,
      atRiskCount,
      selectedAsRiskTail: item.checkpoint.simulationStageCheckpointId === riskTailCheckpoint!.simulationStageCheckpointId,
    })
  }

  await loginAs(page, 'system-admin')
  const adminCheckpoint = checkpoints[0].checkpoint
  await pinProofPlaybackCheckpoint(page, seededRun.runId, adminCheckpoint.simulationStageCheckpointId, 'system-admin')
  await page.goto('/#/admin/proof-dashboard', { waitUntil: 'domcontentloaded' })
  const adminSurface = page.locator('[data-proof-surface="system-admin-proof-control-plane"]').first()
  await expect(adminSurface).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('[data-proof-section="checkpoint-buttons"]').first()).toBeVisible()
  await capture(page, 'system-admin-sem1-pre-tt1.png')
  matrix.push({
    role: 'system-admin',
    sentinel: 'sem1-pre-tt1-baseline',
    rendered: true,
    checkpointId: adminCheckpoint.simulationStageCheckpointId,
  })

  for (const item of checkpoints) {
    for (const roleSurface of ROLE_SURFACES) {
      await loginAs(page, roleSurface.role)
      await pinProofPlaybackCheckpoint(page, seededRun.runId, item.checkpoint.simulationStageCheckpointId)
      await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
      if (roleSurface.openFacultyProfile) {
        await page.locator('[data-proof-action="open-faculty-profile"]').click()
      }
      const surface = page.locator(roleSurface.selector).first()
      await expect(surface).toBeVisible({ timeout: 45_000 })
      await expect(page.getByText(roleSurface.text).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('[data-proof-section="proof-playback-notice"]').first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(checkpointDisplayPattern(item.checkpoint)).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('[data-proof-surface="academic-proof-summary"]')).toHaveCount(0)
      await capture(page, `${roleSurface.role}-${item.label}.png`)
      matrix.push({
        role: roleSurface.role,
        sentinel: item.label,
        checkpointId: item.checkpoint.simulationStageCheckpointId,
        rendered: true,
      })
    }
  }

  await fs.mkdir(OUTPUT_ROOT, { recursive: true })
  await fs.writeFile(
    path.join(OUTPUT_ROOT, 'proof-browser-sentinel-matrix.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      runId: seededRun.runId,
      batchId: seededRun.batchId,
      sentinelCount: checkpoints.length,
      renderedRoleCheckCount: matrix.filter(item => item.rendered === true).length,
      matrix,
    }, null, 2)}\n`,
    'utf8',
  )

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
