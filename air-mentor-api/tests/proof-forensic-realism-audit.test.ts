import { asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
} from '../src/db/schema.js'
import {
  auditProofForensicRealismRows,
  renderProofForensicRealismMarkdown,
} from '../src/lib/proof-forensic-realism-audit.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

function projectionRow(stageKey: string, evidence: Record<string, unknown>, status: Record<string, unknown> = {}) {
  return {
    simulationStageCheckpointId: `checkpoint_${stageKey}`,
    studentId: 'student_001',
    semesterNumber: 1,
    sectionCode: 'A',
    courseCode: 'MNC101',
    riskProbScaled: Number(status.riskProbScaled ?? 45),
    riskBand: String(status.riskBand ?? 'Medium'),
    projectionJson: JSON.stringify({ currentEvidence: evidence, currentStatus: status }),
  }
}

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

describe('proof forensic realism audit', () => {
  it('flags future evidence when a pre-TT1 projection exposes TT1 marks', () => {
    const report = auditProofForensicRealismRows({
      checkpointRows: [{
        simulationStageCheckpointId: 'checkpoint_pre-tt1',
        semesterNumber: 1,
        stageKey: 'pre-tt1',
        stageOrder: 1,
      }],
      projectionRows: [projectionRow('pre-tt1', { attendancePct: 76, tt1Pct: 91 })],
    })

    expect(report.stageVisibility.verdict).toBe('fail')
    expect(report.stageVisibility.futureLeakCount).toBe(1)
    expect(report.trajectoryAnomalies.futureLeakage[0]).toContain('tt1Pct')
  })

  it('detects high-risk post-SEE rows without explainable drivers', () => {
    const report = auditProofForensicRealismRows({
      checkpointRows: [{
        simulationStageCheckpointId: 'checkpoint_post-see',
        semesterNumber: 1,
        stageKey: 'post-see',
        stageOrder: 5,
      }],
      projectionRows: [projectionRow('post-see', {
        attendancePct: 88,
        tt1Pct: 84,
        tt2Pct: 86,
        quizPct: 85,
        assignmentPct: 87,
        cePct: 86,
        seePct: 88,
        overallPct: 87,
      }, { riskProbScaled: 91, riskBand: 'High' })],
    })

    expect(report.riskDriverAlignment.verdict).toBe('fail')
    expect(report.riskDriverAlignment.unexplainedHighRiskCount).toBe(1)
    expect(report.trajectoryAnomalies.riskDriverMismatch[0]).toContain('student_001')
  })

  it('passes the active seeded proof run and renders a durable markdown report', async () => {
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

    const report = auditProofForensicRealismRows({ checkpointRows, projectionRows })
    const markdown = renderProofForensicRealismMarkdown(report)

    expect(report.stageVisibility.verdict).toBe('pass')
    expect(report.stageVisibility.checkpointCount).toBe(30)
    expect(report.stageVisibility.futureLeakCount).toBe(0)
    expect(report.stageVisibility.missingRequiredEvidenceCount).toBe(0)
    expect(report.riskDriverAlignment.verdict).toBe('pass')
    expect(report.riskDriverAlignment.highRiskPostSeeCount).toBeGreaterThan(0)
    expect(report.aggregateRealism.verdict).toBe('pass')
    expect(report.aggregateRealism.postSeePassRate).toBeGreaterThan(0.45)
    expect(report.aggregateRealism.postSeePassRate).toBeLessThan(0.95)
    expect(markdown).toMatch(/Proof Forensic Realism Report/)
    expect(markdown).toMatch(/Future leak violations: 0/)
    expect(markdown).toMatch(/Allowed claim/)
    expect(markdown).toMatch(/Forbidden claim/)
  }, 300_000)
})
