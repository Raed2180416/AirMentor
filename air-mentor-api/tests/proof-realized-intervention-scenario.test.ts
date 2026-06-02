import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { STAGE_REALIZATION_FLAG_NAME } from '../src/lib/proof-stage-realization-evidence-applier.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

type JsonRecord = Record<string, unknown>

const STAGE_ORDER = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const
const ASSESSMENT_KEYS = ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'] as const

function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') return value as T
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function round(value: number | null, digits = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function stageIndex(stageKey: string) {
  const index = STAGE_ORDER.indexOf(stageKey as typeof STAGE_ORDER[number])
  return index === -1 ? 999 : index
}

function evidenceFromProjection(row: JsonRecord) {
  const payload = parseJson<JsonRecord>(row.projection_json, {})
  const currentEvidence = payload.currentEvidence && typeof payload.currentEvidence === 'object' && !Array.isArray(payload.currentEvidence)
    ? payload.currentEvidence as JsonRecord
    : {}
  const currentStatus = payload.currentStatus && typeof payload.currentStatus === 'object' && !Array.isArray(payload.currentStatus)
    ? payload.currentStatus as JsonRecord
    : {}
  const policyComparison = currentStatus.policyComparison && typeof currentStatus.policyComparison === 'object' && !Array.isArray(currentStatus.policyComparison)
    ? currentStatus.policyComparison as JsonRecord
    : {}

  const evidence: Record<typeof ASSESSMENT_KEYS[number], number | null> = {
    attendancePct: num(currentEvidence.attendancePct),
    tt1Pct: num(currentEvidence.tt1Pct),
    tt2Pct: num(currentEvidence.tt2Pct),
    quizPct: num(currentEvidence.quizPct),
    assignmentPct: num(currentEvidence.assignmentPct),
    cePct: num(currentEvidence.cePct),
    seePct: num(currentEvidence.seePct),
    overallPct: num(currentEvidence.overallPct),
  }

  return {
    checkpointId: row.simulation_stage_checkpoint_id,
    semesterNumber: num(row.semester_number),
    stageKey: typeof row.stage_key === 'string' ? row.stage_key : null,
    stageOrder: num(row.stage_order),
    riskBand: typeof row.risk_band === 'string' ? row.risk_band : null,
    riskProbScaled: num(row.risk_prob_scaled),
    noActionRiskProbScaled: num(row.no_action_risk_prob_scaled),
    simulatedActionTaken: typeof row.simulated_action_taken === 'string' ? row.simulated_action_taken : null,
    policySimulatedActionTaken: typeof policyComparison.simulatedActionTaken === 'string' ? policyComparison.simulatedActionTaken : null,
    interventionRecoveryStatus: typeof currentEvidence.interventionRecoveryStatus === 'string' ? currentEvidence.interventionRecoveryStatus : null,
    evidence,
  }
}

function compareStages(beforeRows: JsonRecord[], afterRows: JsonRecord[]) {
  const beforeByStage = new Map(beforeRows.map(row => [String(row.stage_key), evidenceFromProjection(row)]))
  const afterByStage = new Map(afterRows.map(row => [String(row.stage_key), evidenceFromProjection(row)]))

  return STAGE_ORDER.map(stageKey => {
    const before = beforeByStage.get(stageKey)
    const after = afterByStage.get(stageKey)
    const assessmentDeltas = Object.fromEntries(ASSESSMENT_KEYS.map(key => {
      const beforeValue = before?.evidence[key] ?? null
      const afterValue = after?.evidence[key] ?? null
      return [key, beforeValue == null || afterValue == null ? null : round(afterValue - beforeValue)]
    })) as Record<typeof ASSESSMENT_KEYS[number], number | null>

    return {
      stageKey,
      before,
      after,
      assessmentDeltas,
      riskDeltaScaled: before?.riskProbScaled == null || after?.riskProbScaled == null
        ? null
        : round(after.riskProbScaled - before.riskProbScaled),
    }
  })
}

async function loadProjectionSeries(input: {
  pool: Awaited<ReturnType<typeof createTestApp>>['pool']
  simulationRunId: string
  studentId: string
  offeringId: string
}) {
  const { rows } = await input.pool.query(`
    select
      p.*,
      c.stage_key,
      c.stage_order
    from simulation_stage_student_projections p
    join simulation_stage_checkpoints c on c.simulation_stage_checkpoint_id = p.simulation_stage_checkpoint_id
    where p.simulation_run_id = $1
      and p.student_id = $2
      and p.offering_id = $3
    order by c.stage_order
  `, [input.simulationRunId, input.studentId, input.offeringId])
  return rows as JsonRecord[]
}

describe('proof realized intervention scenario', () => {
  it('exports deterministic before/after evidence for a targeted intervention flowing through stage realization', async () => {
    const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'

    try {
      current = await createTestApp()
      const login = await loginAs(current.app, 'sysadmin@airmentor.local', 'admin1234')
      const { rows: runRows } = await current.pool.query(`
        select *
        from simulation_runs
        where active_flag = 1
        order by updated_at desc
        limit 1
      `)
      const run = runRows[0] as JsonRecord | undefined
      expect(run).toBeTruthy()
      const simulationRunId = String(run!.simulation_run_id)

      const recomputeResponse = await current.app.inject({
        method: 'POST',
        url: `/api/admin/proof-runs/${encodeURIComponent(simulationRunId)}/recompute-risk`,
        headers: { cookie: login.cookie, origin: TEST_ORIGIN },
        payload: {},
      })
      expect(recomputeResponse.statusCode).toBe(200)

      const { rows: candidateRows } = await current.pool.query(`
        select
          p.student_id,
          s.usn,
          s.name as student_name,
          p.offering_id,
          p.course_code,
          p.course_title,
          p.semester_number,
          p.risk_prob_scaled,
          p.risk_band,
          p.projection_json
        from simulation_stage_student_projections p
        join simulation_stage_checkpoints c on c.simulation_stage_checkpoint_id = p.simulation_stage_checkpoint_id
        join students s on s.student_id = p.student_id
        where p.simulation_run_id = $1
          and p.semester_number = 1
          and c.stage_key = 'post-see'
        order by
          case p.risk_band when 'High' then 0 when 'Medium' then 1 else 2 end,
          p.risk_prob_scaled desc,
          p.student_id,
          p.course_code
        limit 1
      `, [simulationRunId])
      const candidate = candidateRows[0] as JsonRecord | undefined
      expect(candidate).toBeTruthy()
      expect(candidate!.offering_id).toBeTruthy()

      const selected = {
        studentId: String(candidate!.student_id),
        usn: String(candidate!.usn),
        studentName: String(candidate!.student_name),
        offeringId: String(candidate!.offering_id),
        courseCode: String(candidate!.course_code),
        courseTitle: String(candidate!.course_title),
        semesterNumber: Number(candidate!.semester_number),
        baselinePostSeeRiskBand: String(candidate!.risk_band),
        baselinePostSeeRiskProbScaled: num(candidate!.risk_prob_scaled),
      }

      const beforeRows = await loadProjectionSeries({
        pool: current.pool,
        simulationRunId,
        studentId: selected.studentId,
        offeringId: selected.offeringId,
      })
      expect(beforeRows).toHaveLength(5)

      await current.pool.query(`
        update simulation_runs
        set updated_at = '2026-03-15T00:00:00.000Z'
        where simulation_run_id = $1
      `, [simulationRunId])

      const interventionResponse = await current.app.inject({
        method: 'POST',
        url: '/api/admin/student-interventions',
        headers: { cookie: login.cookie, origin: TEST_ORIGIN },
        payload: {
          studentId: selected.studentId,
          offeringId: selected.offeringId,
          interventionType: 'targeted-tutoring',
          note: 'Proof realized-path scenario: targeted tutoring before the next checkpoint.',
          occurredAt: '2026-03-17T00:00:00.000Z',
        },
      })
      expect(interventionResponse.statusCode).toBe(200)
      const interventionBody = interventionResponse.json() as { interventionId: string; ok: true }

      const advanceResponse = await current.app.inject({
        method: 'POST',
        url: `/api/admin/proof-runs/${encodeURIComponent(simulationRunId)}/advance`,
        headers: { cookie: login.cookie, origin: TEST_ORIGIN },
        payload: { mode: 'stage' },
      })
      expect(advanceResponse.statusCode).toBe(200)
      const advanceBody = advanceResponse.json() as JsonRecord
      expect(advanceBody.stageTransitioned).toBe(true)

      const afterRows = await loadProjectionSeries({
        pool: current.pool,
        simulationRunId,
        studentId: selected.studentId,
        offeringId: selected.offeringId,
      })
      expect(afterRows).toHaveLength(5)

      const { rows: interventionRows } = await current.pool.query(`
        select intervention_id, student_id, offering_id, intervention_type, note, occurred_at, created_at
        from student_interventions
        where student_id = $1 and offering_id = $2
        order by occurred_at, intervention_id
      `, [selected.studentId, selected.offeringId])
      const stageComparisons = compareStages(beforeRows, afterRows)
      const assessmentDeltas = stageComparisons.flatMap(stage =>
        ASSESSMENT_KEYS.map(key => ({
          stageKey: stage.stageKey,
          field: key,
          delta: stage.assessmentDeltas[key],
        })),
      )
      const positiveAssessmentDeltas = assessmentDeltas.filter(item => (item.delta ?? 0) > 0)
      const negativeAssessmentDeltas = assessmentDeltas.filter(item => (item.delta ?? 0) < 0)
      const riskDeltas = stageComparisons
        .map(stage => stage.riskDeltaScaled)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

      const artifact = {
        generatedAt: new Date().toISOString(),
        schemaVersion: 'proof-realized-intervention-scenario.v1',
        run: {
          simulationRunId,
          batchId: run!.batch_id,
          realizationFlag: STAGE_REALIZATION_FLAG_NAME,
          activeStageBeforeAdvance: run!.active_stage_key,
          activeSemesterBeforeAdvance: run!.active_operational_semester,
          advanceResult: advanceBody,
        },
        selected,
        intervention: {
          route: 'POST /api/admin/student-interventions',
          interventionId: interventionBody.interventionId,
          interventionType: 'targeted-tutoring',
          occurredAt: '2026-03-17T00:00:00.000Z',
          storedRows: interventionRows,
        },
        summary: {
          stageCount: stageComparisons.length,
          storedInterventionRows: interventionRows.length,
          positiveAssessmentDeltaCount: positiveAssessmentDeltas.length,
          negativeAssessmentDeltaCount: negativeAssessmentDeltas.length,
          maxPositiveAssessmentDelta: positiveAssessmentDeltas.length > 0
            ? Math.max(...positiveAssessmentDeltas.map(item => item.delta ?? 0))
            : 0,
          minRiskDeltaScaled: riskDeltas.length > 0 ? Math.min(...riskDeltas) : null,
          maxRiskDeltaScaled: riskDeltas.length > 0 ? Math.max(...riskDeltas) : null,
          note: 'Risk deltas are reported, not forced: the contract asserted here is that the stored intervention deterministically changes downstream realized assessment evidence without harming any visible assessment cell.',
        },
        stageComparisons,
      }

      const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
      mkdirSync(outputDir, { recursive: true })
      writeFileSync(
        path.join(outputDir, 'proof-realized-intervention-scenario-2026-06-01.json'),
        `${JSON.stringify(artifact, null, 2)}\n`,
      )

      expect(interventionRows.length).toBeGreaterThanOrEqual(1)
      expect(stageComparisons.map(stage => stage.stageKey).sort((left, right) => stageIndex(left) - stageIndex(right))).toEqual([...STAGE_ORDER])
      expect(positiveAssessmentDeltas.length).toBeGreaterThan(0)
      expect(negativeAssessmentDeltas).toEqual([])
      expect(stageComparisons.some(stage => ['post-tt2', 'post-assignments', 'post-see'].includes(stage.stageKey)
        && Object.values(stage.assessmentDeltas).some(delta => (delta ?? 0) > 0))).toBe(true)
    } finally {
      if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
      else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
    }
  }, 180_000)
})
