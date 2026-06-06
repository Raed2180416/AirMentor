import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scenarioFamilyForSeed } from '../src/lib/proof-risk-model.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

const PLAYWRIGHT_DEMO_SEED = 20260320
const PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
const PROOF_CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'
const OUTPUT_STEM = 'proof-realism-deep-analysis-2026-06-02'

const DEFAULT_AUDIT_SEEDS = [
  PLAYWRIGHT_DEMO_SEED,
  101,
  202,
  303,
  404,
  505,
  606,
  707,
  808,
  909,
  1010,
  1111,
] as const

const STAGES = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const
const ASSESSMENT_FIELDS = ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'] as const
const TEACHER_CALIBRATION = {
  attendanceBelow75TypicalPct: 25,
  backlogCarryoverTypicalPct: 15,
  ceStrongSeeWeakTypicalPct: 10,
  seeStrongCeWeakExpectedMaxPct: 5,
  tt1ClearHeuristicPct: 56, // 14 / 25, expressed on the 0-100 TT percentage scale.
  attendanceClearHeuristicPct: 75,
  cgpaWatchBelow: 7.5,
  cgpaHighBelow: 6.5,
} as const

const FORBIDDEN_STAGE_EVIDENCE: Record<string, string[]> = {
  'pre-tt1': ['tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'],
  'post-tt1': ['tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'],
  'post-tt2': ['quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'],
  'post-assignments': ['seePct', 'overallPct'],
  'post-see': [],
}

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

type JsonRecord = Record<string, unknown>
type NumericSummary = {
  count: number
  mean: number | null
  p10: number | null
  p50: number | null
  p90: number | null
  min: number | null
  max: number | null
}

function auditSeeds() {
  const raw = process.env.AIRMENTOR_DEEP_REALISM_SEEDS
  if (!raw) return [...DEFAULT_AUDIT_SEEDS]
  return raw
    .split(',')
    .map(item => Number(item.trim()))
    .filter(seed => Number.isInteger(seed))
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') return value as T
  if (typeof value !== 'string' || value.length === 0) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function round(value: number | null, digits = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function increment(record: Record<string, number>, key: unknown, by = 1) {
  const safeKey = typeof key === 'string' && key.length > 0 ? key : 'unknown'
  record[safeKey] = (record[safeKey] ?? 0) + by
}

function groupKey(...parts: Array<string | number | null | undefined>) {
  return parts.map(part => String(part ?? '')).join('::')
}

function numericSummary(values: Array<number | null | undefined>): NumericSummary {
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((left, right) => left - right)
  const quantile = (p: number) => {
    if (clean.length === 0) return null
    const index = (clean.length - 1) * p
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    if (lower === upper) return clean[lower]!
    return clean[lower]! + ((clean[upper]! - clean[lower]!) * (index - lower))
  }
  return {
    count: clean.length,
    mean: clean.length === 0 ? null : round(clean.reduce((sum, value) => sum + value, 0) / clean.length),
    p10: round(quantile(0.1)),
    p50: round(quantile(0.5)),
    p90: round(quantile(0.9)),
    min: clean.length === 0 ? null : round(clean[0]!),
    max: clean.length === 0 ? null : round(clean[clean.length - 1]!),
  }
}

function share(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : (round(numerator / denominator, 4) ?? 0)
}

function sharePct(numerator: number, denominator: number) {
  return (round(share(numerator, denominator) * 100) ?? 0)
}

function stageIndex(stageKey: string) {
  const index = STAGES.indexOf(stageKey as typeof STAGES[number])
  return index === -1 ? 999 : index
}

function courseFamily(title: unknown) {
  const lower = String(title ?? '').toLowerCase()
  if (lower.includes('lab') || lower.includes('workshop') || lower.includes('project')) return 'lab-project'
  if (['mathematics', 'algebra', 'probability', 'statistics', 'optimization', 'numerical', 'analysis'].some(token => lower.includes(token))) return 'math-stats'
  if (['programming', 'data structures', 'algorithm', 'python', 'computer science'].some(token => lower.includes(token))) return 'programming-core'
  if (['database', 'operating', 'network', 'software', 'distributed', 'architecture'].some(token => lower.includes(token))) return 'systems-software'
  if (['machine learning', 'artificial intelligence', 'data science', 'computer vision'].some(token => lower.includes(token))) return 'ai-data'
  if (['physics', 'chemistry', 'electronics', 'electrical'].some(token => lower.includes(token))) return 'engineering-science'
  if (['constitution', 'english', 'communication', 'management', 'environment'].some(token => lower.includes(token))) return 'humanities-professional'
  return 'other-core'
}

function compactDrivers(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(isRecord)
        .slice(0, 5)
        .map(driver => ({
          feature: typeof driver.feature === 'string' ? driver.feature : null,
          label: typeof driver.label === 'string' ? driver.label : null,
          impact: num(driver.impact),
        }))
    : []
}

async function waitForCompletedProofRun(simulationRunId: string) {
  if (!current) throw new Error('Expected test app')
  let lastStatus = 'missing'
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const { rows } = await current.pool.query(`
      select *
      from simulation_runs
      where simulation_run_id = $1
      limit 1
    `, [simulationRunId])
    const run = rows[0]
    lastStatus = run?.status ?? 'missing'
    if (run?.status === 'completed') return run as JsonRecord
    if (run?.status === 'failed') throw new Error(`Proof run ${simulationRunId} failed: ${run.failure_message ?? run.failure_code ?? 'unknown'}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for proof run ${simulationRunId}; last status ${lastStatus}`)
}

async function createFreshRun(seed: number, cookie: string) {
  if (!current) throw new Error('Expected test app')
  const createResponse = await current.app.inject({
    method: 'POST',
    url: `/api/admin/batches/${PROOF_BATCH_ID}/proof-runs`,
    headers: { cookie, origin: TEST_ORIGIN },
    payload: {
      curriculumImportVersionId: PROOF_CURRICULUM_IMPORT_ID,
      seed,
      runLabel: `vitest-deep-realism-audit-${seed}`,
      activate: false,
    },
  })
  expect(createResponse.statusCode).toBe(200)
  const created = createResponse.json() as { simulationRunId: string }
  return waitForCompletedProofRun(created.simulationRunId)
}

function addGrouped<T extends JsonRecord>(groups: Map<string, T[]>, key: string, row: T) {
  const rows = groups.get(key) ?? []
  rows.push(row)
  groups.set(key, rows)
}

function summarizeProjectionGroup(rows: JsonRecord[]) {
  const riskValues = rows.map(row => num(row.riskProbScaled))
  const mediumRows = rows.filter(row => row.riskBand === 'Medium').length
  const highRows = rows.filter(row => row.riskBand === 'High').length
  const nonIdleRows = rows.filter(row => row.queueState !== 'idle').length
  const failedRows = rows.filter(row => row.courseResult === 'Failed').length
  return {
    rowCount: rows.length,
    studentCount: new Set(rows.map(row => row.studentId)).size,
    courseCount: new Set(rows.map(row => row.courseCode)).size,
    risk: numericSummary(riskValues),
    mediumRows,
    highRows,
    mediumHighRows: mediumRows + highRows,
    mediumHighShare: share(mediumRows + highRows, rows.length),
    nonIdleQueueRows: nonIdleRows,
    nonIdleQueueShare: share(nonIdleRows, rows.length),
    failedRows,
    failedShare: share(failedRows, rows.length),
    meanScore: numericSummary(rows.map(row => num(row.courseScore))).mean,
    meanAttendance: numericSummary(rows.map(row => num(row.attendancePct))).mean,
  }
}

async function analyzeRun(run: JsonRecord) {
  if (!current) throw new Error('Expected test app')
  const runId = String(run.simulation_run_id)
  const seed = Number(run.seed)

  const [
    { rows: projectionRows },
    { rows: observedRows },
    { rows: behaviorRows },
    { rows: queueRows },
    { rows: interventionRows },
    { rows: edgeRows },
  ] = await Promise.all([
    current.pool.query(`
      select
        p.*,
        s.usn,
        s.name as student_name,
        c.stage_key as checkpoint_stage_key,
        c.stage_label as checkpoint_stage_label,
        c.stage_order
      from simulation_stage_student_projections p
      join students s on s.student_id = p.student_id
      join simulation_stage_checkpoints c on c.simulation_stage_checkpoint_id = p.simulation_stage_checkpoint_id
      where p.simulation_run_id = $1
      order by p.semester_number, c.stage_order, p.student_id, p.course_code
    `, [runId]),
    current.pool.query(`
      select *
      from student_observed_semester_states
      where simulation_run_id = $1
      order by semester_number, student_id
    `, [runId]),
    current.pool.query(`
      select *
      from student_behavior_profiles
      where simulation_run_id = $1
      order by student_id
    `, [runId]),
    current.pool.query(`
      select *
      from simulation_stage_queue_cases
      where simulation_run_id = $1
      order by semester_number, stage_key, student_id, primary_course_code
    `, [runId]),
    current.pool.query(`
      select *
      from student_intervention_response_states
      where simulation_run_id = $1
      order by semester_number, student_id, offering_id
    `, [runId]),
    current.pool.query(`
      select
        e.edge_kind,
        e.rationale,
        e.weight,
        source.semester_number as source_semester,
        source.course_code as source_course_code,
        source.title as source_course_title,
        target.semester_number as target_semester,
        target.course_code as target_course_code,
        target.title as target_course_title
      from curriculum_edges e
      join curriculum_nodes source on source.curriculum_node_id = e.source_curriculum_node_id
      join curriculum_nodes target on target.curriculum_node_id = e.target_curriculum_node_id
      where e.batch_id = $1 and e.status = 'active'
      order by source.semester_number, target.semester_number, source.course_code, target.course_code
    `, [String(run.batch_id)]),
  ])

  const behaviorByStudent = new Map<string, JsonRecord>()
  for (const row of behaviorRows) {
    behaviorByStudent.set(row.student_id, parseJson<JsonRecord>(row.profile_json, {}))
  }

  const semesterByStudent = new Map<string, JsonRecord>()
  const courseByStudentSemesterCode = new Map<string, JsonRecord>()
  for (const row of observedRows) {
    const payload = parseJson<JsonRecord>(row.observed_state_json, {})
    semesterByStudent.set(groupKey(row.student_id, row.semester_number), {
      studentId: row.student_id,
      semesterNumber: row.semester_number,
      sgpa: num(payload.sgpa),
      cgpaAfterSemester: num(payload.cgpaAfterSemester ?? payload.cgpa),
      registeredCredits: num(payload.registeredCredits),
      earnedCredits: num(payload.earnedCredits),
      backlogCount: num(payload.backlogCount),
      weakCoCount: num(payload.weakCoCount),
      interventionCount: num(payload.interventionCount),
    })
    const subjects = Array.isArray(payload.subjectScores)
      ? payload.subjectScores
      : typeof payload.courseCode === 'string'
        ? [payload]
        : []
    for (const subject of subjects) {
      if (!isRecord(subject)) continue
      const code = typeof subject.courseCode === 'string' ? subject.courseCode : null
      if (!code) continue
      courseByStudentSemesterCode.set(groupKey(row.student_id, row.semester_number, code), {
        studentId: row.student_id,
        semesterNumber: row.semester_number,
        courseCode: code,
        courseTitle: subject.title ?? subject.courseTitle ?? payload.courseTitle ?? null,
        score: num(subject.score ?? subject.finalMark),
        attendancePct: num(subject.attendancePct),
        tt1Pct: num(subject.tt1Pct),
        tt2Pct: num(subject.tt2Pct),
        quizPct: num(subject.quizPct),
        assignmentPct: num(subject.assignmentPct),
        cePct: num(subject.cePct),
        seePct: num(subject.seePct),
        result: typeof subject.result === 'string' ? subject.result : null,
        weakCoCount: num(subject.weakCoCount),
        prerequisiteCarryoverRisk: num(subject.prerequisiteCarryoverRisk),
        interventionResponse: subject.interventionResponse ?? null,
      })
    }
  }

  const edgesByTarget = new Map<string, JsonRecord[]>()
  for (const edge of edgeRows) addGrouped(edgesByTarget, String(edge.target_course_code), edge)

  const queueByCheckpointStudentCourse = new Map<string, JsonRecord[]>()
  for (const row of queueRows) {
    addGrouped(queueByCheckpointStudentCourse, groupKey(row.simulation_stage_checkpoint_id, row.student_id, row.primary_course_code), row)
  }

  const interventionByStudentSemesterOffering = new Map<string, JsonRecord[]>()
  const interventionResponseResiduals: number[] = []
  const interventionTypes: Record<string, number> = {}
  for (const row of interventionRows) {
    addGrouped(interventionByStudentSemesterOffering, groupKey(row.student_id, row.semester_number, row.offering_id), row)
    increment(interventionTypes, row.intervention_type)
    const payload = parseJson<JsonRecord>(row.response_state_json, {})
    const residual = num(payload.observedVsExpectedResidual)
    if (residual != null) interventionResponseResiduals.push(residual)
  }

  const riskBandCounts: Record<string, number> = {}
  const queueStateCounts: Record<string, number> = {}
  const checkpointStudentCounts = new Map<string, Set<string>>()
  const stageEvidenceLeaks: JsonRecord[] = []
  const failedPostSeeLowRows: JsonRecord[] = []
  const lowAttendancePostSeeLowRows: JsonRecord[] = []
  const driverlessMediumHighRows: JsonRecord[] = []
  const highRiskIdleRows: JsonRecord[] = []
  const projectionFacts: JsonRecord[] = []
  let rowsWithUpstreamPrerequisiteEvidence = 0
  let rowsWithInterventionResponse = 0
  let rowsWithSimulatedAction = 0

  for (const row of projectionRows) {
    const payload = parseJson<JsonRecord>(row.projection_json, {})
    const currentEvidence = isRecord(payload.currentEvidence) ? payload.currentEvidence : {}
    const currentStatus = isRecord(payload.currentStatus) ? payload.currentStatus : {}
    const governance = isRecord(payload.governance) ? payload.governance : {}
    const stageKey = typeof row.checkpoint_stage_key === 'string' ? row.checkpoint_stage_key : String(payload.stageKey ?? row.evidence_window)
    const semesterNumber = Number(row.semester_number)
    const snapshot = courseByStudentSemesterCode.get(groupKey(row.student_id, semesterNumber, row.course_code)) ?? null
    const semesterSummary = semesterByStudent.get(groupKey(row.student_id, semesterNumber)) ?? null
    const behavior = behaviorByStudent.get(row.student_id) ?? {}
    const queueCase = (queueByCheckpointStudentCourse.get(groupKey(row.simulation_stage_checkpoint_id, row.student_id, row.course_code)) ?? [])[0] ?? null
    const drivers = compactDrivers(currentStatus.observableDrivers)
    const upstreamEdges = (edgesByTarget.get(String(row.course_code)) ?? []).map(edge => {
      const source = courseByStudentSemesterCode.get(groupKey(row.student_id, Number(edge.source_semester), String(edge.source_course_code))) ?? null
      return {
        sourceSemester: Number(edge.source_semester),
        sourceCourseCode: String(edge.source_course_code),
        sourceCourseTitle: String(edge.source_course_title),
        sourceScore: source ? num(source.score) : null,
        sourceResult: source && typeof source.result === 'string' ? source.result : null,
      }
    })
    if (upstreamEdges.some(edge => edge.sourceScore != null)) rowsWithUpstreamPrerequisiteEvidence += 1
    const interventionEvidence = interventionByStudentSemesterOffering.get(groupKey(row.student_id, semesterNumber, row.offering_id)) ?? []
    if (snapshot?.interventionResponse || interventionEvidence.length > 0) rowsWithInterventionResponse += 1
    if (row.simulated_action_taken) rowsWithSimulatedAction += 1

    const riskBand = typeof row.risk_band === 'string' ? row.risk_band : 'unknown'
    const queueState = typeof row.queue_state === 'string' ? row.queue_state : 'unknown'
    increment(riskBandCounts, riskBand)
    increment(queueStateCounts, queueState)
    const checkpointStudents = checkpointStudentCounts.get(row.simulation_stage_checkpoint_id) ?? new Set<string>()
    checkpointStudents.add(row.student_id)
    checkpointStudentCounts.set(row.simulation_stage_checkpoint_id, checkpointStudents)

    const forbidden = FORBIDDEN_STAGE_EVIDENCE[stageKey] ?? []
    const leakedFields = forbidden.filter(field => num(currentEvidence[field]) != null)
    if (leakedFields.length > 0) {
      stageEvidenceLeaks.push({
        checkpointId: row.simulation_stage_checkpoint_id,
        semesterNumber,
        stageKey,
        studentId: row.student_id,
        courseCode: row.course_code,
        leakedFields,
      })
    }

    if (stageKey === 'post-see' && snapshot?.result === 'Failed' && riskBand === 'Low') {
      failedPostSeeLowRows.push({
        studentId: row.student_id,
        courseCode: row.course_code,
        semesterNumber,
        score: snapshot.score,
        attendancePct: snapshot.attendancePct,
        riskProbScaled: num(row.risk_prob_scaled),
      })
    }
    if (stageKey === 'post-see' && (num(snapshot?.attendancePct) ?? 100) < 75 && riskBand === 'Low') {
      lowAttendancePostSeeLowRows.push({
        studentId: row.student_id,
        courseCode: row.course_code,
        semesterNumber,
        attendancePct: snapshot?.attendancePct,
        riskProbScaled: num(row.risk_prob_scaled),
      })
    }
    if ((riskBand === 'Medium' || riskBand === 'High') && drivers.length === 0) {
      driverlessMediumHighRows.push({
        studentId: row.student_id,
        courseCode: row.course_code,
        semesterNumber,
        stageKey,
        riskBand,
        riskProbScaled: num(row.risk_prob_scaled),
      })
    }
    if (riskBand === 'High' && queueState === 'idle') {
      highRiskIdleRows.push({
        studentId: row.student_id,
        courseCode: row.course_code,
        semesterNumber,
        stageKey,
        riskProbScaled: num(row.risk_prob_scaled),
      })
    }

    projectionFacts.push({
      studentId: row.student_id,
      sectionCode: row.section_code,
      archetype: typeof behavior.archetype === 'string' ? behavior.archetype : 'unknown',
      courseCode: row.course_code,
      courseTitle: row.course_title,
      courseFamily: courseFamily(row.course_title),
      semesterNumber,
      stageKey,
      stageOrder: Number(row.stage_order),
      riskProbScaled: num(row.risk_prob_scaled),
      riskBand,
      queueState,
      reassessmentState: row.reassessment_state,
      courseScore: snapshot ? num(snapshot.score) : null,
      attendancePct: snapshot ? num(snapshot.attendancePct) : null,
      courseResult: snapshot && typeof snapshot.result === 'string' ? snapshot.result : null,
      currentCgpa: num(semesterSummary?.cgpaAfterSemester),
      backlogCount: num(semesterSummary?.backlogCount),
      weakCoCount: num(snapshot?.weakCoCount),
      prerequisiteCarryoverRisk: num(snapshot?.prerequisiteCarryoverRisk),
      upstreamWeakCount: upstreamEdges.filter(edge => (edge.sourceScore ?? 100) < 60 || edge.sourceResult === 'Failed').length,
      upstreamEvidenceCount: upstreamEdges.filter(edge => edge.sourceScore != null).length,
      queueAssignedRole: queueCase?.assigned_to_role ?? governance.assignedToRole ?? null,
      simulatedActionTaken: row.simulated_action_taken ?? null,
      driverCount: drivers.length,
      driverFeatures: drivers.map(driver => driver.feature),
      driverLabels: drivers.map(driver => driver.label),
      driverImpacts: drivers.map(driver => driver.impact),
      stageEvidence: {
        attendancePct: num(currentEvidence.attendancePct),
        tt1Pct: num(currentEvidence.tt1Pct),
        tt2Pct: num(currentEvidence.tt2Pct),
        quizPct: num(currentEvidence.quizPct),
        assignmentPct: num(currentEvidence.assignmentPct),
        cePct: num(currentEvidence.cePct),
        seePct: num(currentEvidence.seePct),
        overallPct: num(currentEvidence.overallPct),
        weakCoCount: num(currentEvidence.weakCoCount),
        weakQuestionCount: num(currentEvidence.weakQuestionCount),
        currentCgpa: num(currentStatus.currentCgpa),
        backlogCount: num(currentStatus.backlogCount),
        headProbabilities: currentStatus.headProbabilities ?? null,
      },
    })
  }

  const groups = {
    bySemesterStage: new Map<string, JsonRecord[]>(),
    byCourseFamily: new Map<string, JsonRecord[]>(),
    bySection: new Map<string, JsonRecord[]>(),
    byArchetype: new Map<string, JsonRecord[]>(),
  }
  for (const fact of projectionFacts) {
    addGrouped(groups.bySemesterStage, groupKey(fact.semesterNumber as number, fact.stageKey as string), fact)
    addGrouped(groups.byCourseFamily, String(fact.courseFamily), fact)
    addGrouped(groups.bySection, String(fact.sectionCode), fact)
    addGrouped(groups.byArchetype, String(fact.archetype), fact)
  }

  const groupMapToSummary = (map: Map<string, JsonRecord[]>) => Object.fromEntries(
    [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => [key, summarizeProjectionGroup(rows)]),
  )

  const courseSnapshots = [...courseByStudentSemesterCode.values()]
  const semesterSummaries = [...semesterByStudent.values()]
  const latestSemesterByStudent = new Map<string, JsonRecord>()
  for (const summary of semesterSummaries) {
    const studentId = String(summary.studentId)
    const existing = latestSemesterByStudent.get(studentId)
    if (!existing || Number(summary.semesterNumber ?? 0) > Number(existing.semesterNumber ?? 0)) {
      latestSemesterByStudent.set(studentId, summary)
    }
  }
  const latestSemesterSummaries = [...latestSemesterByStudent.values()]
  const yearEndSummaries = semesterSummaries.filter(summary => Number(summary.semesterNumber ?? 0) % 2 === 0)
  const latestSemesterNumber = Math.max(...semesterSummaries.map(summary => Number(summary.semesterNumber ?? 0)))
  const latestCourseSnapshots = courseSnapshots.filter(row => Number(row.semesterNumber ?? 0) === latestSemesterNumber)
  const studentLevelSharePct = (rows: JsonRecord[], predicate: (row: JsonRecord) => boolean) => {
    const studentIds = new Set(rows.map(row => String(row.studentId)))
    const affectedStudentIds = new Set(rows.filter(predicate).map(row => String(row.studentId)))
    return sharePct(affectedStudentIds.size, studentIds.size)
  }
  const failedCourseRows = courseSnapshots.filter(row => row.result !== 'Passed')
  const cePassPct = 40
  const seePassPct = 40
  const failureReasonCounts = {
    seePrimary: 0,
    cePrimary: 0,
    attendancePrimary: 0,
    otherPrimary: 0,
  }
  for (const row of failedCourseRows) {
    if ((num(row.seePct) ?? 100) < seePassPct) failureReasonCounts.seePrimary += 1
    else if ((num(row.cePct) ?? 100) < cePassPct) failureReasonCounts.cePrimary += 1
    else if ((num(row.attendancePct) ?? 100) < TEACHER_CALIBRATION.attendanceClearHeuristicPct) failureReasonCounts.attendancePrimary += 1
    else failureReasonCounts.otherPrimary += 1
  }
  const tt1ObservedRows = courseSnapshots.filter(row => num(row.tt1Pct) != null)
  const likelyClearHeuristicRows = courseSnapshots.filter(row =>
    (num(row.tt1Pct) ?? -1) >= TEACHER_CALIBRATION.tt1ClearHeuristicPct
    && (num(row.attendancePct) ?? 0) >= TEACHER_CALIBRATION.attendanceClearHeuristicPct)
  const preTt1Rows = projectionFacts.filter(row => row.stageKey === 'pre-tt1')
  const postTt1Rows = projectionFacts.filter(row => row.stageKey === 'post-tt1')
  const postTt2Rows = projectionFacts.filter(row => row.stageKey === 'post-tt2')
  const sem1PreTt1Rows = projectionFacts.filter(row => row.semesterNumber === 1 && row.stageKey === 'pre-tt1')
  const sem1PostTt1Rows = projectionFacts.filter(row => row.semesterNumber === 1 && row.stageKey === 'post-tt1')
  const teacherCalibration = {
    targetPriors: TEACHER_CALIBRATION,
    cgpa: {
      latestStudentCgpa: numericSummary(latestSemesterSummaries.map(row => num(row.cgpaAfterSemester))),
      allSemesterCgpa: numericSummary(semesterSummaries.map(row => num(row.cgpaAfterSemester))),
      latestBelow7_5Pct: sharePct(
        latestSemesterSummaries.filter(row => (num(row.cgpaAfterSemester) ?? 10) < TEACHER_CALIBRATION.cgpaWatchBelow).length,
        latestSemesterSummaries.length,
      ),
      latestBelow6_5Pct: sharePct(
        latestSemesterSummaries.filter(row => (num(row.cgpaAfterSemester) ?? 10) < TEACHER_CALIBRATION.cgpaHighBelow).length,
        latestSemesterSummaries.length,
      ),
    },
    attendance: {
      courseAttendance: numericSummary(courseSnapshots.map(row => num(row.attendancePct))),
      below75Pct: sharePct(
        courseSnapshots.filter(row => (num(row.attendancePct) ?? 100) < TEACHER_CALIBRATION.attendanceClearHeuristicPct).length,
        courseSnapshots.length,
      ),
      studentAnyCourseBelow75Pct: studentLevelSharePct(
        courseSnapshots,
        row => (num(row.attendancePct) ?? 100) < TEACHER_CALIBRATION.attendanceClearHeuristicPct,
      ),
      latestSemesterAnyCourseBelow75Pct: studentLevelSharePct(
        latestCourseSnapshots,
        row => (num(row.attendancePct) ?? 100) < TEACHER_CALIBRATION.attendanceClearHeuristicPct,
      ),
      condonationBand65To75Pct: sharePct(
        courseSnapshots.filter(row => {
          const attendance = num(row.attendancePct) ?? 100
          return attendance >= 65 && attendance < TEACHER_CALIBRATION.attendanceClearHeuristicPct
        }).length,
        courseSnapshots.length,
      ),
    },
    tt1Signal: {
      observedCourseCount: tt1ObservedRows.length,
      below14Of25Pct: sharePct(
        tt1ObservedRows.filter(row => (num(row.tt1Pct) ?? 100) < TEACHER_CALIBRATION.tt1ClearHeuristicPct).length,
        tt1ObservedRows.length,
      ),
      likelyClearHeuristicCourseCount: likelyClearHeuristicRows.length,
      likelyClearHeuristicPassPct: sharePct(
        likelyClearHeuristicRows.filter(row => row.result === 'Passed').length,
        likelyClearHeuristicRows.length,
      ),
      preTt1MediumHighPct: sharePct(preTt1Rows.filter(row => row.riskBand === 'Medium' || row.riskBand === 'High').length, preTt1Rows.length),
      postTt1MediumHighPct: sharePct(postTt1Rows.filter(row => row.riskBand === 'Medium' || row.riskBand === 'High').length, postTt1Rows.length),
      postTt2MediumHighPct: sharePct(postTt2Rows.filter(row => row.riskBand === 'Medium' || row.riskBand === 'High').length, postTt2Rows.length),
      sem1PreTt1MediumHighPct: sharePct(sem1PreTt1Rows.filter(row => row.riskBand === 'Medium' || row.riskBand === 'High').length, sem1PreTt1Rows.length),
      sem1PostTt1MediumHighPct: sharePct(sem1PostTt1Rows.filter(row => row.riskBand === 'Medium' || row.riskBand === 'High').length, sem1PostTt1Rows.length),
    },
    ceSeeMismatch: {
      ceStrongSeeWeakPct: sharePct(
        courseSnapshots.filter(row => (num(row.cePct) ?? 0) >= 60 && (num(row.seePct) ?? 100) < 55).length,
        courseSnapshots.length,
      ),
      ceStrongSeeFailPct: sharePct(
        courseSnapshots.filter(row => (num(row.cePct) ?? 0) >= 60 && (num(row.seePct) ?? 100) < seePassPct).length,
        courseSnapshots.length,
      ),
      ceEligibleSeeWeakPct: sharePct(
        courseSnapshots.filter(row => (num(row.cePct) ?? 0) >= cePassPct && (num(row.seePct) ?? 100) < seePassPct).length,
        courseSnapshots.length,
      ),
      seeStrongCeWeakPct: sharePct(
        courseSnapshots.filter(row => (num(row.seePct) ?? 0) >= 60 && (num(row.cePct) ?? 100) < cePassPct).length,
        courseSnapshots.length,
      ),
    },
    backlogs: {
      latestStudentBacklogPct: sharePct(latestSemesterSummaries.filter(row => (num(row.backlogCount) ?? 0) > 0).length, latestSemesterSummaries.length),
      yearEndCarryoverPct: sharePct(yearEndSummaries.filter(row => (num(row.backlogCount) ?? 0) > 0).length, yearEndSummaries.length),
      latestBacklogCount: numericSummary(latestSemesterSummaries.map(row => num(row.backlogCount))),
      failedCourseReasonCounts: failureReasonCounts,
      failedCourseReasonPct: {
        seePrimary: sharePct(failureReasonCounts.seePrimary, failedCourseRows.length),
        cePrimary: sharePct(failureReasonCounts.cePrimary, failedCourseRows.length),
        attendancePrimary: sharePct(failureReasonCounts.attendancePrimary, failedCourseRows.length),
        otherPrimary: sharePct(failureReasonCounts.otherPrimary, failedCourseRows.length),
      },
    },
    averageStudent: {
      latestNoBacklogPct: sharePct(latestSemesterSummaries.filter(row => (num(row.backlogCount) ?? 0) === 0).length, latestSemesterSummaries.length),
      coursePassPct: sharePct(courseSnapshots.filter(row => row.result === 'Passed').length, courseSnapshots.length),
      meanCourseScore: numericSummary(courseSnapshots.map(row => num(row.score))).mean,
    },
  }
  const scenarioFamily = scenarioFamilyForSeed(seed)
  const attendanceStressFamilies = new Set(['low-attendance', 'chronic-absentee', 'attendance-shock'])
  const failedCourseReasonPct = teacherCalibration.backlogs.failedCourseReasonPct
  const teacherCalibrationFindings = [
    ...(scenarioFamily === 'low-attendance' && teacherCalibration.attendance.latestSemesterAnyCourseBelow75Pct < 18
      ? [{
          severity: 'high',
          gate: 'teacher-attendance-prior',
          message: `Low-attendance seed has only ${teacherCalibration.attendance.latestSemesterAnyCourseBelow75Pct}% latest-semester students with any course below 75%; teacher prior is about ${TEACHER_CALIBRATION.attendanceBelow75TypicalPct}%.`,
        }]
      : []),
    ...(teacherCalibration.attendance.studentAnyCourseBelow75Pct < 15
      ? [{
          severity: 'medium',
          gate: 'teacher-attendance-prior',
          message: `Only ${teacherCalibration.attendance.studentAnyCourseBelow75Pct}% of students ever cross below 75% attendance; teacher classroom prior is about ${TEACHER_CALIBRATION.attendanceBelow75TypicalPct}%.`,
        }]
      : []),
    ...(failedCourseRows.length >= 20
      && !attendanceStressFamilies.has(scenarioFamily)
      && failedCourseReasonPct.attendancePrimary > Math.max(failedCourseReasonPct.seePrimary, failedCourseReasonPct.cePrimary)
      ? [{
          severity: 'high',
          gate: 'teacher-backlog-reason-prior',
          message: `Failed courses are attendance-dominant (${failedCourseReasonPct.attendancePrimary}%), but teacher prior says SEE failures should be the most common backlog reason and CE second.`,
        }]
      : []),
    ...(teacherCalibration.ceSeeMismatch.ceStrongSeeWeakPct < 5
      ? [{
          severity: 'medium',
          gate: 'teacher-ce-see-mismatch-prior',
          message: `CE-strong/SEE-weak mismatch is ${teacherCalibration.ceSeeMismatch.ceStrongSeeWeakPct}%; teacher prior expects about ${TEACHER_CALIBRATION.ceStrongSeeWeakTypicalPct}%.`,
        }]
      : []),
    ...(teacherCalibration.backlogs.yearEndCarryoverPct > 30
      ? [{
          severity: 'high',
          gate: 'teacher-backlog-rate-prior',
          message: `Year-end backlog carryover is ${teacherCalibration.backlogs.yearEndCarryoverPct}%; teacher prior is around ${TEACHER_CALIBRATION.backlogCarryoverTypicalPct}%.`,
        }]
      : teacherCalibration.backlogs.yearEndCarryoverPct > 22
        ? [{
            severity: 'medium',
            gate: 'teacher-backlog-rate-prior',
            message: `Year-end backlog carryover is ${teacherCalibration.backlogs.yearEndCarryoverPct}%; teacher prior is around ${TEACHER_CALIBRATION.backlogCarryoverTypicalPct}%.`,
          }]
        : []),
    ...(teacherCalibration.tt1Signal.likelyClearHeuristicCourseCount >= 1000
      && teacherCalibration.tt1Signal.likelyClearHeuristicPassPct > 99.5
      ? [{
          severity: 'medium',
          gate: 'teacher-clear-heuristic-too-perfect',
          message: `TT1>=14/25 plus attendance>=75 clears ${teacherCalibration.tt1Signal.likelyClearHeuristicPassPct}% of course rows; teacher prior says likely, not guaranteed.`,
        }]
      : []),
    ...(teacherCalibration.tt1Signal.sem1PreTt1MediumHighPct > 5
      ? [{
          severity: 'high',
          gate: 'sem1-pre-tt1-overconfidence',
          message: `Sem1 pre-TT1 has ${teacherCalibration.tt1Signal.sem1PreTt1MediumHighPct}% Medium/High rows; teacher prior says the class is mostly unknown before TT1.`,
        }]
      : []),
    ...(teacherCalibration.tt1Signal.sem1PostTt1MediumHighPct > 75
      ? [{
          severity: 'high',
          gate: 'sem1-post-tt1-overpressure',
          message: `Sem1 post-TT1 has ${teacherCalibration.tt1Signal.sem1PostTt1MediumHighPct}% Medium/High rows; TT1 should clarify risk, not flag nearly the whole class.`,
        }]
      : teacherCalibration.tt1Signal.sem1PostTt1MediumHighPct > 55
        ? [{
            severity: 'medium',
            gate: 'sem1-post-tt1-overpressure',
            message: `Sem1 post-TT1 has ${teacherCalibration.tt1Signal.sem1PostTt1MediumHighPct}% Medium/High rows; validate whether TT1 pressure is too broad.`,
          }]
        : []),
  ]

  const prerequisiteRows = projectionFacts
    .filter(row => row.stageKey === 'post-see' && Number(row.upstreamEvidenceCount ?? 0) > 0)
  const prerequisiteWeakRows = prerequisiteRows.filter(row => Number(row.upstreamWeakCount ?? 0) > 0)
  const prerequisiteStrongRows = prerequisiteRows.filter(row => Number(row.upstreamWeakCount ?? 0) === 0)
  const prerequisiteEffect = {
    weakSourceCount: prerequisiteWeakRows.length,
    strongSourceCount: prerequisiteStrongRows.length,
    weakSourceMeanTargetRisk: numericSummary(prerequisiteWeakRows.map(row => num(row.riskProbScaled))).mean,
    strongSourceMeanTargetRisk: numericSummary(prerequisiteStrongRows.map(row => num(row.riskProbScaled))).mean,
    weakSourceMeanTargetScore: numericSummary(prerequisiteWeakRows.map(row => num(row.courseScore))).mean,
    strongSourceMeanTargetScore: numericSummary(prerequisiteStrongRows.map(row => num(row.courseScore))).mean,
    weakMinusStrongRisk: round((numericSummary(prerequisiteWeakRows.map(row => num(row.riskProbScaled))).mean ?? 0)
      - (numericSummary(prerequisiteStrongRows.map(row => num(row.riskProbScaled))).mean ?? 0)),
    weakMinusStrongScore: round((numericSummary(prerequisiteWeakRows.map(row => num(row.courseScore))).mean ?? 0)
      - (numericSummary(prerequisiteStrongRows.map(row => num(row.courseScore))).mean ?? 0)),
  }

  const byStudentCourse = new Map<string, JsonRecord[]>()
  for (const fact of projectionFacts) addGrouped(byStudentCourse, groupKey(fact.studentId as string, fact.semesterNumber as number, fact.courseCode as string), fact)
  const largeUnexplainedRiskDrops: JsonRecord[] = []
  for (const [key, rows] of byStudentCourse.entries()) {
    const ordered = rows.slice().sort((left, right) => stageIndex(String(left.stageKey)) - stageIndex(String(right.stageKey)))
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]!
      const currentRow = ordered[index]!
      const previousRisk = num(previous.riskProbScaled)
      const currentRisk = num(currentRow.riskProbScaled)
      if (previousRisk == null || currentRisk == null) continue
      const drop = previousRisk - currentRisk
      if (drop >= 20 && !previous.simulatedActionTaken && !currentRow.simulatedActionTaken) {
        largeUnexplainedRiskDrops.push({
          key,
          fromStage: previous.stageKey,
          toStage: currentRow.stageKey,
          previousRisk,
          currentRisk,
          drop,
        })
      }
    }
  }

  const structuralCoverageFailures = [
    ...(new Set(projectionRows.map(row => row.student_id)).size !== 120 ? ['student-count'] : []),
    ...(checkpointStudentCounts.size !== 30 ? ['checkpoint-count'] : []),
    ...(projectionRows.length !== 21_600 ? ['projection-row-count'] : []),
    ...([...checkpointStudentCounts.entries()].some(([, students]) => students.size !== 120) ? ['checkpoint-student-coverage'] : []),
  ]

  const mediumHighRows = (riskBandCounts.Medium ?? 0) + (riskBandCounts.High ?? 0)
  const highRows = riskBandCounts.High ?? 0
  const actionableRows = (queueStateCounts.open ?? 0) + (queueStateCounts.deferred ?? 0)
  const findings = [
    ...(structuralCoverageFailures.length > 0
      ? [{ severity: 'critical', gate: 'coverage', message: `Coverage failures: ${structuralCoverageFailures.join(', ')}` }]
      : []),
    ...(stageEvidenceLeaks.length > 0
      ? [{ severity: 'critical', gate: 'stage-evidence-leakage', message: `${stageEvidenceLeaks.length} rows reveal future assessment fields before their stage.` }]
      : []),
    ...(failedPostSeeLowRows.length > 0
      ? [{ severity: 'high', gate: 'post-see-fail-low-risk', message: `${failedPostSeeLowRows.length} failed course rows are still Low risk at post-SEE.` }]
      : []),
    ...(lowAttendancePostSeeLowRows.length > 0
      ? [{ severity: 'high', gate: 'attendance-low-risk-alignment', message: `${lowAttendancePostSeeLowRows.length} post-SEE rows have attendance below 75% but Low risk.` }]
      : []),
    ...(driverlessMediumHighRows.length > 0
      ? [{ severity: 'high', gate: 'driver-explainability', message: `${driverlessMediumHighRows.length} Medium/High rows have no observable drivers.` }]
      : []),
    ...(highRiskIdleRows.length > 0
      ? [{ severity: 'high', gate: 'queue-action-alignment', message: `${highRiskIdleRows.length} High-risk rows are still idle instead of open, watch, deferred, or resolved.` }]
      : []),
    ...(mediumHighRows < 120
      ? [{ severity: 'medium', gate: 'classroom-pressure', message: `Only ${mediumHighRows} of ${projectionRows.length} rows are Medium/High; the run is too gentle for a showable pressure demo unless paired with stress seeds.` }]
      : []),
    ...(highRows === 0
      ? [{ severity: 'medium', gate: 'high-risk-tail', message: 'No High-risk rows were produced; escalation and HOD urgency cannot be proven from this seed alone.' }]
      : []),
    ...(actionableRows === 0
      ? [{ severity: 'medium', gate: 'actionable-queue', message: 'No open/deferred queue rows were produced before manual/auto advance; role action pressure must be proven with realized-path runs.' }]
      : []),
    ...(prerequisiteEffect.weakSourceCount >= 20
      && prerequisiteEffect.strongSourceCount >= 20
      && (prerequisiteEffect.weakMinusStrongRisk ?? 0) < 2
      ? [{ severity: 'medium', gate: 'prerequisite-risk-lift', message: `Weak prerequisite source rows lift target risk by only ${prerequisiteEffect.weakMinusStrongRisk}; carryover may be underpowered.` }]
      : []),
    ...(prerequisiteEffect.weakSourceCount >= 20
      && prerequisiteEffect.strongSourceCount >= 20
      && (prerequisiteEffect.weakMinusStrongScore ?? 0) > -3
      ? [{ severity: 'medium', gate: 'prerequisite-score-drag', message: `Weak prerequisite source rows reduce target score by only ${Math.abs(prerequisiteEffect.weakMinusStrongScore ?? 0)} marks; downstream drag may be too weak.` }]
      : []),
    ...teacherCalibrationFindings,
  ]

  return {
    seed,
    scenarioFamily,
    run: {
      runId,
      batchId: run.batch_id,
      activeOperationalSemester: run.active_operational_semester,
      activeStageKey: run.active_stage_key,
    },
    summary: {
      studentCount: new Set(projectionRows.map(row => row.student_id)).size,
      checkpointCount: checkpointStudentCounts.size,
      projectionRowCount: projectionRows.length,
      observedRowCount: observedRows.length,
      behaviorProfileCount: behaviorRows.length,
      queueCaseCount: queueRows.length,
      interventionResponseStateCount: interventionRows.length,
      riskBandCounts,
      queueStateCounts,
      risk: numericSummary(projectionFacts.map(row => num(row.riskProbScaled))),
      mediumHighRows,
      highRows,
      nonIdleQueueRows: projectionFacts.filter(row => row.queueState !== 'idle').length,
      rowsWithUpstreamPrerequisiteEvidence,
      rowsWithInterventionResponse,
      rowsWithSimulatedAction,
      structuralCoverageFailures,
      stageEvidenceLeakCount: stageEvidenceLeaks.length,
      failedPostSeeLowCount: failedPostSeeLowRows.length,
      lowAttendancePostSeeLowCount: lowAttendancePostSeeLowRows.length,
      driverlessMediumHighCount: driverlessMediumHighRows.length,
      highRiskIdleCount: highRiskIdleRows.length,
      largeUnexplainedRiskDropCount: largeUnexplainedRiskDrops.length,
    },
    distributions: {
      bySemesterStage: groupMapToSummary(groups.bySemesterStage),
      byCourseFamily: groupMapToSummary(groups.byCourseFamily),
      bySection: groupMapToSummary(groups.bySection),
      byArchetype: groupMapToSummary(groups.byArchetype),
      interventionTypes,
      interventionResiduals: numericSummary(interventionResponseResiduals),
    },
    teacherCalibration,
    prerequisiteEffect,
    samples: {
      failedPostSeeLowRows: failedPostSeeLowRows.slice(0, 25),
      lowAttendancePostSeeLowRows: lowAttendancePostSeeLowRows.slice(0, 25),
      driverlessMediumHighRows: driverlessMediumHighRows.slice(0, 25),
      highRiskIdleRows: highRiskIdleRows.slice(0, 25),
      stageEvidenceLeaks: stageEvidenceLeaks.slice(0, 25),
      largeUnexplainedRiskDrops: largeUnexplainedRiskDrops.slice(0, 25),
      topRiskRows: projectionFacts
        .slice()
        .sort((left, right) => Number(right.riskProbScaled ?? 0) - Number(left.riskProbScaled ?? 0))
        .slice(0, 25),
      sem1PostTt1HighestRiskRows: sem1PostTt1Rows
        .slice()
        .sort((left, right) => Number(right.riskProbScaled ?? 0) - Number(left.riskProbScaled ?? 0))
        .slice(0, 25),
      sem1PostTt1LikelyClearButMediumHighRows: sem1PostTt1Rows
        .filter(row =>
          (num((row.stageEvidence as JsonRecord)?.tt1Pct) ?? 0) >= TEACHER_CALIBRATION.tt1ClearHeuristicPct
          && (num((row.stageEvidence as JsonRecord)?.attendancePct) ?? 0) >= TEACHER_CALIBRATION.attendanceClearHeuristicPct
          && (row.riskBand === 'Medium' || row.riskBand === 'High'))
        .sort((left, right) => Number(right.riskProbScaled ?? 0) - Number(left.riskProbScaled ?? 0))
        .slice(0, 25),
      sem1PostTt1LowestRiskRows: sem1PostTt1Rows
        .slice()
        .sort((left, right) => Number(left.riskProbScaled ?? 0) - Number(right.riskProbScaled ?? 0))
        .slice(0, 25),
    },
    findings,
  }
}

function renderMarkdown(report: JsonRecord) {
  const perSeed = report.perSeed as JsonRecord[]
  const rows = perSeed.map(seedReport => {
    const summary = seedReport.summary as JsonRecord
    const risk = summary.risk as JsonRecord
    return [
      seedReport.seed,
      seedReport.scenarioFamily,
      summary.projectionRowCount,
      summary.mediumHighRows,
      summary.highRows,
      summary.nonIdleQueueRows,
      risk.max,
      summary.failedPostSeeLowCount,
      summary.lowAttendancePostSeeLowCount,
      summary.driverlessMediumHighCount,
      summary.highRiskIdleCount,
      (seedReport.findings as JsonRecord[]).map(item => `${item.severity}:${item.gate}`).join(', ') || 'none',
    ]
  })
  const teacherRows = perSeed.map(seedReport => {
    const teacher = isRecord(seedReport.teacherCalibration) ? seedReport.teacherCalibration : {}
    const cgpa = isRecord(teacher.cgpa) ? teacher.cgpa : {}
    const latestCgpa = isRecord(cgpa.latestStudentCgpa) ? cgpa.latestStudentCgpa : {}
    const attendance = isRecord(teacher.attendance) ? teacher.attendance : {}
    const backlogs = isRecord(teacher.backlogs) ? teacher.backlogs : {}
    const ceSeeMismatch = isRecord(teacher.ceSeeMismatch) ? teacher.ceSeeMismatch : {}
    const tt1Signal = isRecord(teacher.tt1Signal) ? teacher.tt1Signal : {}
    const cell = (value: unknown) => value == null ? 'n/a' : String(value)
    return [
      seedReport.seed,
      seedReport.scenarioFamily,
      cell(latestCgpa.mean),
      cell(latestCgpa.p50),
      cell(attendance.below75Pct),
      cell(attendance.latestSemesterAnyCourseBelow75Pct),
      cell(attendance.studentAnyCourseBelow75Pct),
      cell(backlogs.yearEndCarryoverPct),
      cell(ceSeeMismatch.ceStrongSeeWeakPct),
      cell(ceSeeMismatch.ceStrongSeeFailPct),
      cell(ceSeeMismatch.seeStrongCeWeakPct),
      cell(tt1Signal.likelyClearHeuristicPassPct),
      `${cell(tt1Signal.preTt1MediumHighPct)} -> ${cell(tt1Signal.postTt1MediumHighPct)}`,
      `${cell(tt1Signal.sem1PreTt1MediumHighPct)} -> ${cell(tt1Signal.sem1PostTt1MediumHighPct)}`,
    ]
  })

  const lines = [
    '# AirMentor Deep Realism Analysis - 2026-06-02',
    '',
    'This is a deterministic backend product-data audit over fresh governed proof runs. It is not browser proof and it is not real institutional validation.',
    '',
    '## Seed Summary',
    '',
    '| Seed | Scenario family | Rows | Medium+High | High | Non-idle queue | Max risk | Failed post-SEE Low | Low attendance Low | Driverless M/H | High idle | Findings |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Teacher Calibration Snapshot',
    '',
    'Teacher priors encoded here: about 25% below 75% attendance, about 15% backlog carryover, TT1 marks below 14/25 as the first strong classroom signal, CE-strong/SEE-weak mismatch around 10%, and SEE-strong/CE-weak as rare.',
    '',
    '| Seed | Scenario family | Latest CGPA mean | Latest CGPA p50 | Course attendance <75% | Latest sem any attendance <75% | Any attendance <75% | Year-end backlog % | CE strong SEE weak % | CE strong SEE fail % | SEE strong CE weak % | TT1+attendance pass % | M/H pre -> post TT1 | Sem1 M/H pre -> post TT1 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...teacherRows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Cross-Seed Verdict',
    '',
    `- Seeds audited: ${(report.seedPlan as number[]).join(', ')}`,
    `- Scenario families covered: ${Object.keys(report.crossSeedScenarioCoverage as JsonRecord).join(', ')}`,
    `- Critical finding count: ${report.crossSeedFindingCountsBySeverity && typeof report.crossSeedFindingCountsBySeverity === 'object' ? ((report.crossSeedFindingCountsBySeverity as JsonRecord).critical ?? 0) : 0}`,
    `- High finding count: ${report.crossSeedFindingCountsBySeverity && typeof report.crossSeedFindingCountsBySeverity === 'object' ? ((report.crossSeedFindingCountsBySeverity as JsonRecord).high ?? 0) : 0}`,
    `- Medium finding count: ${report.crossSeedFindingCountsBySeverity && typeof report.crossSeedFindingCountsBySeverity === 'object' ? ((report.crossSeedFindingCountsBySeverity as JsonRecord).medium ?? 0) : 0}`,
    '',
    '## Interpretation Rules',
    '',
    '- Critical findings are structural proof blockers.',
    '- High findings are product/model realism blockers for a showable university demo.',
    '- Medium findings are demo-pressure gaps: they may be acceptable for a calm baseline only if stress-family artifacts are shown beside it.',
    '',
  ]
  return `${lines.join('\n')}\n`
}

describe('proof realism deep analysis', () => {
  it('exports deterministic multi-seed realism diagnostics for trajectories, families, prerequisites, queues, and interventions', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin@airmentor.local', 'admin1234')
    const seeds = auditSeeds()
    expect(seeds.length).toBeGreaterThan(0)

    const perSeed: JsonRecord[] = []
    for (const seed of seeds) {
      const run = await createFreshRun(seed, login.cookie)
      perSeed.push(await analyzeRun(run))
    }

    const crossSeedScenarioCoverage: Record<string, number> = {}
    const crossSeedFindingCountsBySeverity: Record<string, number> = {}
    const hardContractFailures: JsonRecord[] = []
    const hardRealismFailures: JsonRecord[] = []
    for (const seedReport of perSeed) {
      increment(crossSeedScenarioCoverage, seedReport.scenarioFamily)
      for (const finding of seedReport.findings as JsonRecord[]) {
        increment(crossSeedFindingCountsBySeverity, finding.severity)
        if (finding.severity === 'critical' || finding.severity === 'high') {
          hardRealismFailures.push({
            seed: seedReport.seed,
            scenarioFamily: seedReport.scenarioFamily,
            ...finding,
          })
        }
      }
      const summary = seedReport.summary as JsonRecord
      if ((summary.structuralCoverageFailures as unknown[]).length > 0 || Number(summary.stageEvidenceLeakCount ?? 0) > 0) {
        hardContractFailures.push({
          seed: seedReport.seed,
          scenarioFamily: seedReport.scenarioFamily,
          structuralCoverageFailures: summary.structuralCoverageFailures,
          stageEvidenceLeakCount: summary.stageEvidenceLeakCount,
        })
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      schemaVersion: 'proof-realism-deep-analysis.v1',
      seedPlan: seeds,
      crossSeedScenarioCoverage,
      crossSeedFindingCountsBySeverity,
      hardContractFailures,
      hardRealismFailures,
      perSeed,
    }

    const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(path.join(outputDir, `${OUTPUT_STEM}.json`), `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(path.join(outputDir, `${OUTPUT_STEM}.md`), renderMarkdown(report))

    expect(hardContractFailures).toEqual([])
    expect(hardRealismFailures).toEqual([])
  }, 3_600_000)
})
