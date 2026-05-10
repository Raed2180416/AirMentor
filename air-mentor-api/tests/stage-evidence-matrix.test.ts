import { asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const
type StageKey = typeof stageOrder[number]

const allSignals = ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'] as const
const visibleByStage: Record<StageKey, ReadonlyArray<typeof allSignals[number]>> = {
  'pre-tt1': ['attendancePct'],
  'post-tt1': ['attendancePct', 'tt1Pct'],
  'post-tt2': ['attendancePct', 'tt1Pct', 'tt2Pct'],
  'post-assignments': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct'],
  'post-see': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'],
}

afterEach(async () => {
  if (current) await current.close()
  current = null
})

function readCurrentEvidence(row: typeof simulationStageStudentProjections.$inferSelect) {
  const payload = JSON.parse(row.projectionJson) as { currentEvidence?: Record<string, unknown>; currentStatus?: Record<string, unknown> }
  return {
    currentEvidence: payload.currentEvidence ?? {},
    currentStatus: payload.currentStatus ?? {},
  }
}

describe('stage evidence matrix', () => {
  it('proves the six-semester five-stage evidence visibility contract from real proof rows', async () => {
    current = await createTestApp()
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

    const checkpointRows = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
    ).orderBy(
      asc(simulationStageCheckpoints.semesterNumber),
      asc(simulationStageCheckpoints.stageOrder),
    )
    expect(checkpointRows).toHaveLength(30)

    const matrixKeys = checkpointRows.map(row => `${row.semesterNumber}:${row.stageKey}`)
    expect(matrixKeys).toEqual(Array.from({ length: 6 }, (_, index) => index + 1).flatMap(semester =>
      stageOrder.map(stage => `${semester}:${stage}`),
    ))

    const projectionRows = await current.db.select().from(simulationStageStudentProjections).where(
      eq(simulationStageStudentProjections.simulationRunId, activeRun.simulationRunId),
    )
    expect(projectionRows.length).toBeGreaterThan(0)

    for (const checkpoint of checkpointRows) {
      const stageKey = checkpoint.stageKey as StageKey
      expect(stageOrder).toContain(stageKey)
      const checkpointProjectionRows = projectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      expect(checkpointProjectionRows.length, `${checkpoint.semesterNumber}:${stageKey}`).toBeGreaterThan(0)
      for (const row of checkpointProjectionRows) {
        const { currentEvidence, currentStatus } = readCurrentEvidence(row)
        for (const signal of allSignals) {
          if (visibleByStage[stageKey].includes(signal)) {
            expect(currentEvidence[signal], `${checkpoint.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${signal}`).not.toBeNull()
            expect(currentEvidence[signal], `${checkpoint.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${signal}`).not.toBeUndefined()
          } else {
            expect(currentEvidence[signal] ?? null, `${checkpoint.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${signal}`).toBeNull()
          }
        }
        expect(typeof currentStatus.riskProbScaled).toBe('number')
        if (checkpoint.semesterNumber === 1 && stageKey !== 'post-see') {
          expect(Number(currentStatus.backlogCount ?? 0)).toBe(0)
        }
        if (checkpoint.semesterNumber > 1) {
          expect(currentEvidence.currentCgpa ?? currentStatus.currentCgpa ?? null).not.toBeUndefined()
        }
      }
    }
  })
})
