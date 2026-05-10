import { asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
} from '../src/db/schema.js'
import {
  auditProofRealismRows,
  compareProofClassroomSetups,
} from '../src/lib/proof-realism-audit.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

async function materializeActiveRunPlayback() {
  if (!current) throw new Error('Expected test app')
  const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
  const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
  expect(activeRun).toBeTruthy()
  if (!activeRun) throw new Error('Expected active proof run')
  const recomputeRiskResponse = await current.app.inject({
    method: 'POST',
    url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
    headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
    payload: {},
  })
  expect(recomputeRiskResponse.statusCode).toBe(200)
  return activeRun
}

describe('proof realism audit', () => {
  it('audits seeded proof rows for stage coverage, plausible marks, and risk alignment', async () => {
    current = await createTestApp()
    const activeRun = await materializeActiveRunPlayback()

    const checkpointRows = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
    ).orderBy(
      asc(simulationStageCheckpoints.semesterNumber),
      asc(simulationStageCheckpoints.stageOrder),
    )
    const projectionRows = await current.db.select().from(simulationStageStudentProjections).where(
      eq(simulationStageStudentProjections.simulationRunId, activeRun.simulationRunId),
    )

    const report = auditProofRealismRows({ checkpointRows, projectionRows })

    expect(report.stageMatrix.verdict).toBe('pass')
    expect(report.stageMatrix.checkpointCount).toBe(30)
    expect(report.stageMatrix.studentProjectionCount).toBeGreaterThan(10_000)
    expect(report.markProgression.verdict).toBe('pass')
    expect(report.markProgression.postSeeOverall.mean).toBeGreaterThan(45)
    expect(report.markProgression.postSeeOverall.mean).toBeLessThan(82)
    expect(report.markProgression.postSeeOverall.stdev).toBeGreaterThan(5)
    expect(report.riskAlignment.verdict).toBe('pass')
    expect(report.riskAlignment.overallPctRiskCorrelation).toBeLessThan(-0.05)
    expect(report.riskAlignment.highRiskMeanOverallPct).toBeLessThan(report.riskAlignment.lowRiskMeanOverallPct)
  }, 300_000)

  it('detects materially different classroom setups without mutating proof rows', async () => {
    current = await createTestApp()
    const activeRun = await materializeActiveRunPlayback()

    const projectionRows = await current.db.select().from(simulationStageStudentProjections).where(
      eq(simulationStageStudentProjections.simulationRunId, activeRun.simulationRunId),
    )

    const baseline = auditProofRealismRows({ checkpointRows: [], projectionRows })
    const stressedSectionBRows = projectionRows.map(row => {
      if (row.sectionCode !== 'B') return row
      const payload = JSON.parse(row.projectionJson) as Record<string, unknown>
      const currentEvidence = { ...((payload.currentEvidence as Record<string, unknown> | undefined) ?? {}) }
      const currentStatus = { ...((payload.currentStatus as Record<string, unknown> | undefined) ?? {}) }
      for (const key of ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'] as const) {
        if (typeof currentEvidence[key] === 'number') currentEvidence[key] = Math.max(8, currentEvidence[key] - 8)
      }
      if (typeof currentStatus.riskProbScaled === 'number') currentStatus.riskProbScaled = Math.min(100, currentStatus.riskProbScaled + 12)
      return {
        ...row,
        riskProbScaled: Math.min(100, row.riskProbScaled + 12),
        riskBand: row.riskProbScaled + 12 >= 70 ? 'High' : row.riskBand,
        projectionJson: JSON.stringify({
          ...payload,
          currentEvidence,
          currentStatus,
        }),
      }
    })
    const stressedSectionB = auditProofRealismRows({ checkpointRows: [], projectionRows: stressedSectionBRows })

    const comparison = compareProofClassroomSetups({
      baseline,
      candidate: stressedSectionB,
      expectedDirection: 'candidate-section-b-stressed',
    })

    expect(comparison.verdict).toBe('pass')
    expect(comparison.sectionBMeanOverallDelta).toBeLessThan(-4)
    expect(comparison.sectionBRiskDelta).toBeGreaterThan(5)
  }, 300_000)
})
