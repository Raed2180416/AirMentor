import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import {
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
} from '../src/db/schema.js'
import { scenarioFamilyForSeed } from '../src/lib/proof-risk-model.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

const PLAYWRIGHT_DEMO_SEED = 20260320
const PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
const PROOF_CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

function increment(record: Record<string, number>, key: string | null | undefined) {
  const safeKey = key && key.length > 0 ? key : 'unknown'
  record[safeKey] = (record[safeKey] ?? 0) + 1
}

async function waitForCompletedProofRun(simulationRunId: string) {
  if (!current) throw new Error('Expected test app')
  let lastStatus = 'missing'
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const [run] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, simulationRunId))
    lastStatus = run?.status ?? 'missing'
    if (run?.status === 'completed') return run
    if (run?.status === 'failed') throw new Error(`Proof run ${simulationRunId} failed: ${run.failureMessage ?? run.failureCode ?? 'unknown'}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for proof run ${simulationRunId}; last status ${lastStatus}`)
}

function summarizeRiskTail(input: {
  runId: string
  seed: number
  checkpointRows: Array<typeof simulationStageCheckpoints.$inferSelect>
  projectionRows: Array<typeof simulationStageStudentProjections.$inferSelect>
}) {
  const riskBandCounts: Record<string, number> = {}
  const queueStateCounts: Record<string, number> = {}
  const byCheckpoint = new Map<string, Array<typeof input.projectionRows[number]>>()
  for (const row of input.projectionRows) {
    increment(riskBandCounts, row.riskBand)
    increment(queueStateCounts, row.queueState)
    const rows = byCheckpoint.get(row.simulationStageCheckpointId) ?? []
    rows.push(row)
    byCheckpoint.set(row.simulationStageCheckpointId, rows)
  }
  const orderedRows = input.projectionRows.slice().sort((left, right) => right.riskProbScaled - left.riskProbScaled)
  const checkpointSummaries = input.checkpointRows
    .slice()
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
    .map(checkpoint => {
      const rows = byCheckpoint.get(checkpoint.simulationStageCheckpointId) ?? []
      return {
        checkpointId: checkpoint.simulationStageCheckpointId,
        semesterNumber: checkpoint.semesterNumber,
        stageKey: checkpoint.stageKey,
        projectionRows: rows.length,
        studentCount: new Set(rows.map(row => row.studentId)).size,
        maxRiskProbScaled: rows.length === 0 ? null : Math.max(...rows.map(row => row.riskProbScaled)),
        mediumRows: rows.filter(row => row.riskBand === 'Medium').length,
        highRows: rows.filter(row => row.riskBand === 'High').length,
      }
    })
  return {
    generatedAt: new Date().toISOString(),
    runId: input.runId,
    seed: input.seed,
    scenarioFamily: scenarioFamilyForSeed(input.seed),
    checkpointCount: input.checkpointRows.length,
    projectionRowCount: input.projectionRows.length,
    riskBandCounts,
    queueStateCounts,
    maxRiskProbScaled: orderedRows[0]?.riskProbScaled ?? null,
    topRiskRows: orderedRows.slice(0, 20).map(row => ({
      studentId: row.studentId,
      semesterNumber: row.semesterNumber,
      courseCode: row.courseCode,
      evidenceWindow: row.evidenceWindow,
      riskBand: row.riskBand,
      riskProbScaled: row.riskProbScaled,
      queueState: row.queueState,
    })),
    checkpointSummaries,
  }
}

describe('fresh proof-run risk tail', () => {
  it('fresh Playwright demo seed produces non-empty risk tail and coverage', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${PROOF_BATCH_ID}/proof-runs`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        curriculumImportVersionId: PROOF_CURRICULUM_IMPORT_ID,
        seed: PLAYWRIGHT_DEMO_SEED,
        runLabel: 'vitest-fresh-demo-risk-tail',
        activate: false,
      },
    })
    expect(createResponse.statusCode).toBe(200)
    const created = createResponse.json() as { simulationRunId: string }
    await waitForCompletedProofRun(created.simulationRunId)

    const [checkpointRows, projectionRows] = await Promise.all([
      current.db.select().from(simulationStageCheckpoints).where(
        eq(simulationStageCheckpoints.simulationRunId, created.simulationRunId),
      ).orderBy(asc(simulationStageCheckpoints.semesterNumber), asc(simulationStageCheckpoints.stageOrder)),
      current.db.select().from(simulationStageStudentProjections).where(
        eq(simulationStageStudentProjections.simulationRunId, created.simulationRunId),
      ),
    ])
    const report = summarizeRiskTail({
      runId: created.simulationRunId,
      seed: PLAYWRIGHT_DEMO_SEED,
      checkpointRows,
      projectionRows,
    })
    const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(
      path.join(outputDir, 'proof-fresh-run-risk-tail-2026-06-02.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    )

    expect(checkpointRows).toHaveLength(30)
    expect(projectionRows).toHaveLength(21_600)
    expect(report.maxRiskProbScaled).toBeGreaterThanOrEqual(40)
    expect((report.riskBandCounts.Medium ?? 0) + (report.riskBandCounts.High ?? 0)).toBeGreaterThan(0)
  }, 240_000)
})
