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

const STAGES = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const
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

function addDaysIso(value: string, days: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO date: ${value}`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function stageIndex(stageKey: string | null | undefined) {
  const index = STAGES.indexOf(stageKey as typeof STAGES[number])
  return index === -1 ? 999 : index
}

function nextStage(stageKey: string) {
  const index = stageIndex(stageKey)
  return STAGES[Math.min(index + 1, STAGES.length - 1)]
}

function roleCodeForAssignedRole(value: unknown) {
  switch (value) {
    case 'Course Leader':
      return 'COURSE_LEADER'
    case 'Mentor':
      return 'MENTOR'
    case 'HOD':
      return 'HOD'
    default:
      return null
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function evidenceFromProjection(row: JsonRecord) {
  const payload = parseJson<JsonRecord>(row.projection_json, {})
  const currentEvidence = isRecord(payload.currentEvidence) ? payload.currentEvidence : {}
  const currentStatus = isRecord(payload.currentStatus) ? payload.currentStatus : {}
  const policyComparison = isRecord(currentStatus.policyComparison) ? currentStatus.policyComparison : {}
  const actionPath = isRecord(payload.actionPath) ? payload.actionPath : {}
  const governance = isRecord(payload.governance) ? payload.governance : {}

  const evidence = Object.fromEntries(ASSESSMENT_KEYS.map(key => [
    key,
    num(currentEvidence[key]),
  ])) as Record<typeof ASSESSMENT_KEYS[number], number | null>

  return {
    checkpointId: row.simulation_stage_checkpoint_id,
    semesterNumber: num(row.semester_number),
    stageKey: typeof row.stage_key === 'string' ? row.stage_key : null,
    stageOrder: num(row.stage_order),
    riskBand: typeof row.risk_band === 'string' ? row.risk_band : null,
    riskProbScaled: num(row.risk_prob_scaled),
    noActionRiskProbScaled: num(row.no_action_risk_prob_scaled),
    counterfactualLiftScaled: num(currentStatus.counterfactualLiftScaled ?? policyComparison.counterfactualLiftScaled),
    recommendedAction: typeof row.recommended_action === 'string' ? row.recommended_action : null,
    simulatedActionTaken: typeof row.simulated_action_taken === 'string' ? row.simulated_action_taken : null,
    policySimulatedActionTaken: typeof policyComparison.simulatedActionTaken === 'string' ? policyComparison.simulatedActionTaken : null,
    taskType: actionPath.taskType ?? null,
    queueCaseId: typeof governance.queueCaseId === 'string' ? governance.queueCaseId : null,
    queueState: typeof row.queue_state === 'string' ? row.queue_state : null,
    reassessmentState: typeof row.reassessment_state === 'string' ? row.reassessment_state : null,
    interventionRecoveryStatus: typeof currentEvidence.interventionRecoveryStatus === 'string' ? currentEvidence.interventionRecoveryStatus : null,
    evidence,
  }
}

function compareStageRows(beforeRows: JsonRecord[], afterRows: JsonRecord[]) {
  const beforeByStage = new Map(beforeRows.map(row => [String(row.stage_key), evidenceFromProjection(row)]))
  const afterByStage = new Map(afterRows.map(row => [String(row.stage_key), evidenceFromProjection(row)]))
  return STAGES.map(stageKey => {
    const before = beforeByStage.get(stageKey) ?? null
    const after = afterByStage.get(stageKey) ?? null
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

async function injectJson(cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) {
  if (!current) throw new Error('Missing test app')
  const response = await current.app.inject({
    method,
    url,
    headers: { cookie, origin: TEST_ORIGIN },
    payload,
  } as any)
  const body = response.payload ? response.json() : null
  return { statusCode: response.statusCode, body, payload: response.payload }
}

async function switchToRole(cookie: string, availableRoleGrants: Array<{ grantId: string; roleCode: string }>, roleCode: string) {
  if (!current) throw new Error('Missing test app')
  const grant = availableRoleGrants.find(item => item.roleCode === roleCode)
  expect(grant).toBeTruthy()
  const response = await current.app.inject({
    method: 'POST',
    url: '/api/session/role-context',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: { roleGrantId: grant!.grantId },
  })
  expect(response.statusCode).toBe(200)
}

async function loadSeries(simulationRunId: string, studentId: string, offeringId: string) {
  if (!current) throw new Error('Missing test app')
  const { rows } = await current.pool.query(`
    select p.*, c.stage_key, c.stage_order
    from simulation_stage_student_projections p
    join simulation_stage_checkpoints c on c.simulation_stage_checkpoint_id = p.simulation_stage_checkpoint_id
    where p.simulation_run_id = $1
      and p.student_id = $2
      and p.offering_id = $3
    order by c.stage_order
  `, [simulationRunId, studentId, offeringId])
  return rows as JsonRecord[]
}

function chooseInterventionType(row: JsonRecord) {
  const stageKey = String(row.stage_key)
  const riskBand = String(row.risk_band)
  const courseTitle = String(row.course_title ?? '').toLowerCase()
  if (riskBand === 'High') return 'prerequisite-bridge'
  if (stageKey === 'post-assignments') return 'pre-see-rescue'
  if (courseTitle.includes('physics') || courseTitle.includes('mathematics')) return 'targeted-tutoring'
  if (row.queue_state === 'deferred') return 'structured-study-plan'
  return 'mentor-check-in'
}

function selectCohort(candidateRows: JsonRecord[]) {
  const selected: JsonRecord[] = []
  const seenTarget = new Set<string>()
  const add = (row: JsonRecord) => {
    const key = `${row.student_id}::${row.offering_id}`
    if (seenTarget.has(key)) return
    seenTarget.add(key)
    selected.push(row)
  }

  candidateRows
    .filter(row => row.risk_band === 'High')
    .forEach(add)

  const mediumGroupCounts = new Map<string, number>()
  candidateRows
    .filter(row => row.risk_band === 'Medium' && row.queue_state !== 'idle')
    .forEach(row => {
      const groupKey = `${row.semester_number}::${row.stage_key}::${row.queue_state}`
      const count = mediumGroupCounts.get(groupKey) ?? 0
      if (count >= 2) return
      add(row)
      mediumGroupCounts.set(groupKey, count + 1)
    })

  return selected.slice(0, 48)
}

function containsStudent(payload: unknown, studentId: string) {
  return JSON.stringify(payload).includes(studentId)
}

describe('proof realized intervention effect ledger', () => {
  it('exports a broad post-advance intervention ledger for high and actionable medium proof cases', async () => {
    const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'

    try {
      current = await createTestApp()
      const sysadmin = await loginAs(current.app, 'sysadmin@airmentor.local', 'admin1234')
      const hod = await loginAs(current.app, 'devika.shetty', 'faculty1234')
      if (hod.body.activeRoleGrant?.roleCode !== 'HOD') {
        await switchToRole(hod.cookie, hod.body.availableRoleGrants ?? [], 'HOD')
      }

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

      const recomputeResponse = await injectJson(
        sysadmin.cookie,
        'POST',
        `/api/admin/proof-runs/${encodeURIComponent(simulationRunId)}/recompute-risk`,
        {},
      )
      expect(recomputeResponse.statusCode).toBe(200)

      const { rows: candidateRowsRaw } = await current.pool.query(`
        select
          p.*,
          c.stage_key,
          c.stage_order,
          s.usn,
          s.name as student_name,
          qp.assigned_to_role,
          qp.assigned_faculty_id,
          qp.task_type,
          qp.status as queue_projection_status,
          qp.simulation_stage_queue_case_id,
          qp.detail_json as queue_projection_detail_json,
          qc.governance_reason,
          qc.priority_rank,
          qc.counts_toward_capacity,
          qc.status as queue_case_status
        from simulation_stage_student_projections p
        join simulation_stage_checkpoints c on c.simulation_stage_checkpoint_id = p.simulation_stage_checkpoint_id
        join students s on s.student_id = p.student_id
        left join simulation_stage_queue_projections qp
          on qp.simulation_stage_checkpoint_id = p.simulation_stage_checkpoint_id
          and qp.student_id = p.student_id
          and qp.offering_id = p.offering_id
        left join simulation_stage_queue_cases qc
          on qc.simulation_stage_queue_case_id = qp.simulation_stage_queue_case_id
        where p.simulation_run_id = $1
          and c.stage_key <> 'post-see'
          and (p.risk_band = 'High' or p.queue_state <> 'idle')
        order by
          case p.risk_band when 'High' then 0 when 'Medium' then 1 else 2 end,
          p.semester_number,
          c.stage_order,
          p.queue_state,
          p.risk_prob_scaled desc,
          p.student_id,
          p.course_code
      `, [simulationRunId])
      const candidateRows = candidateRowsRaw as JsonRecord[]
      const selectedRows = selectCohort(candidateRows)
      expect(selectedRows.length).toBeGreaterThanOrEqual(24)
      expect(selectedRows.some(row => row.risk_band === 'High')).toBe(true)
      expect(selectedRows.some(row => row.risk_band === 'Medium')).toBe(true)

      const selectedCheckpointIds = [...new Set(selectedRows.map(row => String(row.simulation_stage_checkpoint_id)))]
      const hodVisibilityByCheckpoint = new Map<string, unknown>()
      for (const checkpointId of selectedCheckpointIds) {
        const response = await injectJson(
          hod.cookie,
          'GET',
          `/api/academic/hod/proof-bundle?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}`,
        )
        expect(response.statusCode).toBe(200)
        hodVisibilityByCheckpoint.set(checkpointId, response.body)
      }

      const assignedFacultyIds = [...new Set(selectedRows
        .map(row => typeof row.assigned_faculty_id === 'string' ? row.assigned_faculty_id : null)
        .filter((value): value is string => !!value))]
      const { rows: facultyUserRows } = await current.pool.query(`
        select fp.faculty_id, ua.username
        from faculty_profiles fp
        join user_accounts ua on ua.user_id = fp.user_id
        where fp.faculty_id = any($1::text[])
      `, [assignedFacultyIds])
      const usernameByFacultyId = new Map(facultyUserRows.map(row => [String(row.faculty_id), String(row.username)]))
      const loginByFacultyRole = new Map<string, Awaited<ReturnType<typeof loginAs>>>()
      const facultyProfileCache = new Map<string, { body: unknown; username: string; roleCode: string }>()
      for (const row of selectedRows) {
        const assignedFacultyId = typeof row.assigned_faculty_id === 'string' ? row.assigned_faculty_id : null
        if (!assignedFacultyId) continue
        const roleCode = roleCodeForAssignedRole(row.assigned_to_role)
        if (!roleCode) continue
        const username = usernameByFacultyId.get(assignedFacultyId)
        expect(username).toBeTruthy()
        const checkpointId = String(row.simulation_stage_checkpoint_id)
        const cacheKey = `${assignedFacultyId}::${roleCode}::${checkpointId}`
        if (facultyProfileCache.has(cacheKey)) continue
        const loginKey = `${assignedFacultyId}::${roleCode}`
        let facultyLogin = loginByFacultyRole.get(loginKey)
        if (!facultyLogin) {
          facultyLogin = await loginAs(current.app, username!, 'faculty1234')
          if (facultyLogin.body.activeRoleGrant?.roleCode !== roleCode) {
            await switchToRole(facultyLogin.cookie, facultyLogin.body.availableRoleGrants ?? [], roleCode)
          }
          loginByFacultyRole.set(loginKey, facultyLogin)
        }
        const response = await injectJson(
          facultyLogin.cookie,
          'GET',
          `/api/academic/faculty-profile/${encodeURIComponent(assignedFacultyId)}?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}`,
        )
        expect(response.statusCode).toBe(200)
        facultyProfileCache.set(cacheKey, { body: response.body, username: username!, roleCode })
      }

      const beforeSeriesByTarget = new Map<string, JsonRecord[]>()
      for (const row of selectedRows) {
        const key = `${row.student_id}::${row.offering_id}`
        beforeSeriesByTarget.set(key, await loadSeries(simulationRunId, String(row.student_id), String(row.offering_id)))
      }

      await current.pool.query(`
        update simulation_runs
        set updated_at = '2026-03-15T00:00:00.000Z'
        where simulation_run_id = $1
      `, [simulationRunId])

      const interventions: JsonRecord[] = []
      for (const row of selectedRows) {
        const selectedEvidence = evidenceFromProjection(row)
        const selectedStageOccurredAt = parseJson<JsonRecord>(row.projection_json, {}).stageOccurredAt
        const occurredAt = addDaysIso(String(selectedStageOccurredAt), 1)
        const interventionType = chooseInterventionType(row)
        const response = await injectJson(
          sysadmin.cookie,
          'POST',
          '/api/admin/student-interventions',
          {
            studentId: row.student_id,
            offeringId: row.offering_id,
            interventionType,
            note: `Broad realized-effect proof: ${interventionType} after ${row.stage_key} for ${row.course_code}.`,
            occurredAt,
          },
        )
        expect(response.statusCode).toBe(200)
        const body = response.body as { interventionId: string; ok: true }
        interventions.push({
          interventionId: body.interventionId,
          studentId: row.student_id,
          offeringId: row.offering_id,
          courseCode: row.course_code,
          selectedCheckpointId: row.simulation_stage_checkpoint_id,
          selectedStageKey: row.stage_key,
          appliedStageKey: nextStage(String(row.stage_key)),
          interventionType,
          occurredAt,
          beforeRiskBand: selectedEvidence.riskBand,
          beforeRiskProbScaled: selectedEvidence.riskProbScaled,
          recommendedAction: selectedEvidence.recommendedAction,
          expectedCounterfactualLiftScaled: selectedEvidence.counterfactualLiftScaled,
        })
      }

      const advanceResponse = await injectJson(
        sysadmin.cookie,
        'POST',
        `/api/admin/proof-runs/${encodeURIComponent(simulationRunId)}/advance`,
        { mode: 'stage' },
      )
      expect(advanceResponse.statusCode).toBe(200)
      expect((advanceResponse.body as JsonRecord).stageTransitioned).toBe(true)

      const ledgerRows = []
      let positiveDownstreamRows = 0
      let preApplicationPositiveDeltaCount = 0
      let negativeAssessmentDeltaCount = 0
      for (const row of selectedRows) {
        const targetKey = `${row.student_id}::${row.offering_id}`
        const intervention = interventions.find(item => `${item.studentId}::${item.offeringId}` === targetKey)!
        const beforeSeries = beforeSeriesByTarget.get(targetKey) ?? []
        const afterSeries = await loadSeries(simulationRunId, String(row.student_id), String(row.offering_id))
        const stageComparisons = compareStageRows(beforeSeries, afterSeries)
        const appliedStageIndex = stageIndex(String(intervention.appliedStageKey))
        const beforeApplicationDeltas = stageComparisons.flatMap(stage =>
          stageIndex(stage.stageKey) < appliedStageIndex
            ? ASSESSMENT_KEYS.map(key => stage.assessmentDeltas[key])
            : [],
        )
        const downstreamDeltas = stageComparisons.flatMap(stage =>
          stageIndex(stage.stageKey) >= appliedStageIndex
            ? ASSESSMENT_KEYS.map(key => stage.assessmentDeltas[key])
            : [],
        )
        const positiveDownstreamDeltaCount = downstreamDeltas.filter(delta => (delta ?? 0) > 0).length
        const negativeDeltaCount = stageComparisons
          .flatMap(stage => ASSESSMENT_KEYS.map(key => stage.assessmentDeltas[key]))
          .filter(delta => (delta ?? 0) < 0).length
        const prePositive = beforeApplicationDeltas.filter(delta => (delta ?? 0) > 0).length
        positiveDownstreamRows += positiveDownstreamDeltaCount > 0 ? 1 : 0
        preApplicationPositiveDeltaCount += prePositive
        negativeAssessmentDeltaCount += negativeDeltaCount

        const checkpointId = String(row.simulation_stage_checkpoint_id)
        const assignedFacultyId = typeof row.assigned_faculty_id === 'string' ? row.assigned_faculty_id : null
        const assignedRoleCode = roleCodeForAssignedRole(row.assigned_to_role)
        const facultyProfileProof = assignedFacultyId && assignedRoleCode
          ? facultyProfileCache.get(`${assignedFacultyId}::${assignedRoleCode}::${checkpointId}`)
          : null
        const hodPayload = hodVisibilityByCheckpoint.get(checkpointId)

        ledgerRows.push({
          student: {
            studentId: row.student_id,
            usn: row.usn,
            name: row.student_name,
            sectionCode: row.section_code,
          },
          course: {
            offeringId: row.offering_id,
            courseCode: row.course_code,
            courseTitle: row.course_title,
            semesterNumber: row.semester_number,
          },
          selectedQueueCase: {
            checkpointId,
            stageKey: row.stage_key,
            riskBand: row.risk_band,
            riskProbScaled: num(row.risk_prob_scaled),
            queueState: row.queue_state,
            reassessmentState: row.reassessment_state,
            queueCaseId: row.simulation_stage_queue_case_id,
            assignedToRole: row.assigned_to_role,
            assignedFacultyId,
            queueProjectionStatus: row.queue_projection_status,
            queueCaseStatus: row.queue_case_status,
            governanceReason: row.governance_reason,
            priorityRank: num(row.priority_rank),
            countsTowardCapacity: row.counts_toward_capacity,
          },
          intervention,
          visibility: {
            hodBundleContainsStudent: containsStudent(hodPayload, String(row.student_id)),
            assignedFacultyProfileChecked: !!facultyProfileProof,
            assignedFacultyUsername: facultyProfileProof?.username ?? null,
            assignedFacultyRoleCode: facultyProfileProof?.roleCode ?? null,
            assignedFacultyProfileContainsStudent: facultyProfileProof
              ? containsStudent(facultyProfileProof.body, String(row.student_id))
              : null,
          },
          effect: {
            appliedStageKey: intervention.appliedStageKey,
            positiveDownstreamDeltaCount,
            negativeAssessmentDeltaCount: negativeDeltaCount,
            preApplicationPositiveDeltaCount: prePositive,
            minRiskDeltaScaled: stageComparisons
              .map(stage => stage.riskDeltaScaled)
              .filter((value): value is number => typeof value === 'number')
              .reduce((min, value) => Math.min(min, value), 0),
            maxRiskDeltaScaled: stageComparisons
              .map(stage => stage.riskDeltaScaled)
              .filter((value): value is number => typeof value === 'number')
              .reduce((max, value) => Math.max(max, value), 0),
            stageComparisons,
          },
        })
      }

      const { rows: allProjectionRows } = await current.pool.query(`
        select p.student_id, p.semester_number, c.stage_key, p.risk_band, p.queue_state
        from simulation_stage_student_projections p
        join simulation_stage_checkpoints c on c.simulation_stage_checkpoint_id = p.simulation_stage_checkpoint_id
        where p.simulation_run_id = $1
      `, [simulationRunId])
      const highStudentStage = new Map<string, { highRows: number; nonIdleRows: number }>()
      for (const row of allProjectionRows) {
        if (row.risk_band !== 'High') continue
        const key = `${row.student_id}::${row.semester_number}::${row.stage_key}`
        const entry = highStudentStage.get(key) ?? { highRows: 0, nonIdleRows: 0 }
        entry.highRows += 1
        if (row.queue_state !== 'idle') entry.nonIdleRows += 1
        highStudentStage.set(key, entry)
      }
      const highStudentStageGaps = [...highStudentStage.entries()]
        .filter(([, value]) => value.nonIdleRows === 0)
        .map(([key, value]) => ({ key, ...value }))

      const hodVisibilityGaps = ledgerRows.filter(row => row.visibility.hodBundleContainsStudent !== true)
      const assignedFacultyActionQueueGaps = ledgerRows.filter(row => (
        row.selectedQueueCase.queueProjectionStatus === 'Open'
        && row.visibility.assignedFacultyProfileContainsStudent !== true
      ))
      const assignedFacultyProfileMisses = ledgerRows.filter(row => (
        row.visibility.assignedFacultyProfileChecked
        && row.visibility.assignedFacultyProfileContainsStudent !== true
      ))
      const visibilityGaps = [...hodVisibilityGaps, ...assignedFacultyActionQueueGaps]

      const artifact = {
        generatedAt: new Date().toISOString(),
        schemaVersion: 'proof-realized-intervention-effect-ledger.v1',
        run: {
          simulationRunId,
          batchId: run!.batch_id,
          realizationFlag: STAGE_REALIZATION_FLAG_NAME,
          advanceResult: advanceResponse.body,
        },
        summary: {
          candidateRowCount: candidateRows.length,
          selectedInterventionCount: selectedRows.length,
          highSelectedRows: selectedRows.filter(row => row.risk_band === 'High').length,
          mediumSelectedRows: selectedRows.filter(row => row.risk_band === 'Medium').length,
          interventionTypes: [...new Set(interventions.map(item => item.interventionType))].sort(),
          positiveDownstreamRows,
          negativeAssessmentDeltaCount,
          preApplicationPositiveDeltaCount,
          highStudentStageCount: highStudentStage.size,
          highStudentStageGaps,
          hodVisibilityGapCount: hodVisibilityGaps.length,
          assignedFacultyOpenQueueGapCount: assignedFacultyActionQueueGaps.length,
          assignedFacultyProfileMissCount: assignedFacultyProfileMisses.length,
          visibilityGapCount: visibilityGaps.length,
          visibilityNote: 'HOD proof bundle is the required global visibility surface for watch/deferred rows. Faculty-profile queues expose primary Open action items; watch/deferred rows are audited but not counted as assigned-faculty open-queue gaps.',
          caveat: 'This is deterministic simulation evidence for realized-path wiring and timing. It is not causal treated-vs-control evidence from real cohorts.',
        },
        ledgerRows,
        visibilityGaps,
        assignedFacultyProfileMisses,
      }

      const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
      mkdirSync(outputDir, { recursive: true })
      writeFileSync(
        path.join(outputDir, 'proof-realized-intervention-effect-ledger-2026-06-02.json'),
        `${JSON.stringify(artifact, null, 2)}\n`,
      )

      expect(artifact.summary.highStudentStageGaps).toEqual([])
      expect(artifact.summary.positiveDownstreamRows).toBe(selectedRows.length)
      expect(artifact.summary.negativeAssessmentDeltaCount).toBe(0)
      expect(artifact.summary.preApplicationPositiveDeltaCount).toBe(0)
      expect(artifact.summary.visibilityGapCount).toBe(0)
    } finally {
      if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
      else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
    }
  }, 240_000)
})
