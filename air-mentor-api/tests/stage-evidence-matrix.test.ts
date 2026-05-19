import { asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  riskEvidenceSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
} from '../src/db/schema.js'
import {
  OBSERVABLE_FEATURE_KEYS,
  featureVectorArrayFromPayload,
  type ObservableFeaturePayload,
  type ObservableSourceRefs,
} from '../src/lib/proof-risk-model.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const
type StageKey = typeof stageOrder[number]

const allSignals = ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'] as const
const riskAssessmentSignals = ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'seePct'] as const
const visibleByStage: Record<StageKey, ReadonlyArray<typeof allSignals[number]>> = {
  'pre-tt1': ['attendancePct'],
  'post-tt1': ['attendancePct', 'tt1Pct'],
  'post-tt2': ['attendancePct', 'tt1Pct', 'tt2Pct'],
  'post-assignments': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct'],
  'post-see': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'],
}
const visibleRiskAssessmentsByStage: Record<StageKey, ReadonlyArray<typeof riskAssessmentSignals[number]>> = {
  'pre-tt1': [],
  'post-tt1': ['tt1Pct'],
  'post-tt2': ['tt1Pct', 'tt2Pct'],
  'post-assignments': ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct'],
  'post-see': ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'seePct'],
}
const missingnessFeatureByAssessment: Record<typeof riskAssessmentSignals[number], typeof OBSERVABLE_FEATURE_KEYS[number]> = {
  tt1Pct: 'tt1MissingScaled',
  tt2Pct: 'tt2MissingScaled',
  quizPct: 'quizMissingScaled',
  assignmentPct: 'assignmentMissingScaled',
  seePct: 'seeMissingScaled',
}
const stageIndicatorByStage: Record<StageKey, typeof OBSERVABLE_FEATURE_KEYS[number]> = {
  'pre-tt1': 'stagePreTt1Scaled',
  'post-tt1': 'stagePostTt1Scaled',
  'post-tt2': 'stagePostTt2Scaled',
  'post-assignments': 'stagePostAssignmentsScaled',
  'post-see': 'stagePostSeeScaled',
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

function featureValue(payload: ObservableFeaturePayload, key: typeof riskAssessmentSignals[number]) {
  return payload[key]
}

function vectorValue(payload: ObservableFeaturePayload, refs: ObservableSourceRefs, key: typeof OBSERVABLE_FEATURE_KEYS[number]) {
  const vector = featureVectorArrayFromPayload(payload, refs)
  return vector[OBSERVABLE_FEATURE_KEYS.indexOf(key)]
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

    const riskEvidenceRows = await current.db.select().from(riskEvidenceSnapshots).where(
      eq(riskEvidenceSnapshots.simulationRunId, activeRun.simulationRunId),
    )
    expect(riskEvidenceRows.length).toBeGreaterThan(0)

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

    for (const row of riskEvidenceRows) {
      const stageKey = row.stageKey as StageKey
      expect(stageOrder).toContain(stageKey)
      const payload = JSON.parse(row.featureJson) as ObservableFeaturePayload
      const refs = JSON.parse(row.sourceRefsJson) as ObservableSourceRefs
      expect(refs.stageKey).toBe(stageKey)
      for (const signal of riskAssessmentSignals) {
        const value = featureValue(payload, signal)
        const missingness = vectorValue(payload, refs, missingnessFeatureByAssessment[signal])
        if (visibleRiskAssessmentsByStage[stageKey].includes(signal)) {
          expect(value, `${row.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${signal}`).not.toBeNull()
          expect(missingness, `${row.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${signal}:missingness`).toBe(0)
        } else {
          expect(value, `${row.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${signal}`).toBeNull()
          expect(missingness, `${row.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${signal}:missingness`).toBe(1)
        }
      }
      for (const [indicatorStage, indicator] of Object.entries(stageIndicatorByStage) as Array<[StageKey, typeof OBSERVABLE_FEATURE_KEYS[number]]>) {
        expect(vectorValue(payload, refs, indicator), `${row.semesterNumber}:${stageKey}:${row.studentId}:${row.courseCode}:${indicator}`).toBe(indicatorStage === stageKey ? 1 : 0)
      }
    }
  })
})
