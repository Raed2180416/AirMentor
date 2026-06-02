import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

const PLAYWRIGHT_DEMO_SEED = 20260320
const PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
const PROOF_CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

async function waitForCompletedProofRun(simulationRunId: string) {
  if (!current) throw new Error('Expected test app')
  let lastStatus = 'missing'
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const { rows } = await current.pool.query(`
      select *
      from simulation_runs
      where simulation_run_id = $1
      limit 1
    `, [simulationRunId])
    const run = rows[0]
    lastStatus = run?.status ?? 'missing'
    if (run?.status === 'completed') return run
    if (run?.status === 'failed') throw new Error(`Proof run ${simulationRunId} failed: ${run.failure_message ?? run.failure_code ?? 'unknown'}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for proof run ${simulationRunId}; last status ${lastStatus}`)
}

const STAGES = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const

type JsonRecord = Record<string, unknown>

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

function mean(values: Array<number | null>): number | null {
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (clean.length === 0) return null
  return clean.reduce((sum, value) => sum + value, 0) / clean.length
}

function increment(record: Record<string, number>, key: unknown) {
  const safeKey = typeof key === 'string' && key.length > 0 ? key : 'unknown'
  record[safeKey] = (record[safeKey] ?? 0) + 1
}

function groupKey(...parts: Array<string | number | null | undefined>) {
  return parts.map(part => String(part ?? '')).join('::')
}

function compactDrivers(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((driver): driver is JsonRecord => !!driver && typeof driver === 'object' && !Array.isArray(driver))
        .slice(0, 5)
        .map(driver => ({
          feature: typeof driver.feature === 'string' ? driver.feature : null,
          label: typeof driver.label === 'string' ? driver.label : null,
          impact: num(driver.impact),
        }))
    : []
}

function stageIndex(stageKey: string) {
  const index = STAGES.indexOf(stageKey as typeof STAGES[number])
  return index === -1 ? 999 : index
}

describe('proof student trajectory ledger', () => {
  it('exports joined 120-student trajectory evidence across stages, courses, drivers, queue, prerequisites, and interventions', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin@airmentor.local', 'admin1234')

    const createResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${PROOF_BATCH_ID}/proof-runs`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        curriculumImportVersionId: PROOF_CURRICULUM_IMPORT_ID,
        seed: PLAYWRIGHT_DEMO_SEED,
        runLabel: 'vitest-fresh-student-trajectory-ledger',
        activate: false,
      },
    })
    expect(createResponse.statusCode).toBe(200)
    const created = createResponse.json() as { simulationRunId: string }
    const run = await waitForCompletedProofRun(created.simulationRunId)

    const [
      { rows: projectionRows },
      { rows: observedRows },
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
      `, [run.simulation_run_id]),
      current.pool.query(`
        select *
        from student_observed_semester_states
        where simulation_run_id = $1
        order by semester_number, student_id
      `, [run.simulation_run_id]),
      current.pool.query(`
        select *
        from simulation_stage_queue_cases
        where simulation_run_id = $1
        order by semester_number, stage_key, student_id, primary_course_code
      `, [run.simulation_run_id]),
      current.pool.query(`
        select *
        from student_intervention_response_states
        where simulation_run_id = $1
        order by semester_number, student_id, offering_id
      `, [run.simulation_run_id]),
      current.pool.query(`
        select
          e.curriculum_edge_id,
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
      `, [run.batch_id]),
    ])

    const semesterByStudent = new Map<string, JsonRecord>()
    const courseByStudentSemesterCode = new Map<string, JsonRecord>()
    for (const row of observedRows) {
      const payload = parseJson<JsonRecord>(row.observed_state_json, {})
      const semesterSummary = {
        sgpa: num(payload.sgpa),
        cgpaAfterSemester: num(payload.cgpaAfterSemester ?? payload.cgpa),
        registeredCredits: num(payload.registeredCredits),
        earnedCredits: num(payload.earnedCredits),
        backlogCount: num(payload.backlogCount),
        weakCoCount: num(payload.weakCoCount),
        interventionCount: num(payload.interventionCount),
      }
      semesterByStudent.set(groupKey(row.student_id, row.semester_number), semesterSummary)
      const subjects = Array.isArray(payload.subjectScores)
        ? payload.subjectScores
        : typeof payload.courseCode === 'string'
          ? [payload]
          : []
      for (const subject of subjects) {
        if (!subject || typeof subject !== 'object' || Array.isArray(subject)) continue
        const course = subject as JsonRecord
        const courseCode = typeof course.courseCode === 'string' ? course.courseCode : null
        if (!courseCode) continue
        courseByStudentSemesterCode.set(groupKey(row.student_id, row.semester_number, courseCode), {
          offeringId: typeof course.offeringId === 'string' ? course.offeringId : null,
          courseCode,
          courseTitle: typeof course.title === 'string'
            ? course.title
            : typeof course.courseTitle === 'string' ? course.courseTitle : null,
          credits: num(course.credits),
          score: num(course.score ?? course.finalMark),
          attendancePct: num(course.attendancePct),
          tt1Pct: num(course.tt1Pct),
          tt2Pct: num(course.tt2Pct),
          quizPct: num(course.quizPct),
          assignmentPct: num(course.assignmentPct),
          cePct: num(course.cePct),
          seePct: num(course.seePct),
          gradeLabel: typeof course.gradeLabel === 'string' ? course.gradeLabel : null,
          gradePoint: num(course.gradePoint),
          result: typeof course.result === 'string' ? course.result : null,
          weakCoCount: num(course.weakCoCount),
          prerequisiteCarryoverRisk: num(course.prerequisiteCarryoverRisk),
          coSummaryCount: Array.isArray(course.coSummary) ? course.coSummary.length : 0,
          interventionResponse: course.interventionResponse ?? null,
        })
      }
    }

    const queueById = new Map<string, JsonRecord>()
    const queueByCheckpointStudentCourse = new Map<string, JsonRecord[]>()
    for (const row of queueRows) {
      queueById.set(row.simulation_stage_queue_case_id, row)
      const key = groupKey(row.simulation_stage_checkpoint_id, row.student_id, row.primary_course_code)
      const list = queueByCheckpointStudentCourse.get(key) ?? []
      list.push(row)
      queueByCheckpointStudentCourse.set(key, list)
    }

    const interventionsByStudentSemesterOffering = new Map<string, JsonRecord[]>()
    const interventionsByStudentSemester = new Map<string, JsonRecord[]>()
    for (const row of interventionRows) {
      const byCourseKey = groupKey(row.student_id, row.semester_number, row.offering_id)
      const bySemesterKey = groupKey(row.student_id, row.semester_number)
      const courseList = interventionsByStudentSemesterOffering.get(byCourseKey) ?? []
      const semesterList = interventionsByStudentSemester.get(bySemesterKey) ?? []
      courseList.push(row)
      semesterList.push(row)
      interventionsByStudentSemesterOffering.set(byCourseKey, courseList)
      interventionsByStudentSemester.set(bySemesterKey, semesterList)
    }

    const edgesByTarget = new Map<string, JsonRecord[]>()
    for (const row of edgeRows) {
      const list = edgesByTarget.get(String(row.target_course_code)) ?? []
      list.push(row)
      edgesByTarget.set(String(row.target_course_code), list)
    }

    const checkpointStudentCounts = new Map<string, Set<string>>()
    const riskBandCounts: Record<string, number> = {}
    const queueStateCounts: Record<string, number> = {}
    const stageCounts: Record<string, number> = {}
    const highStudentStage = new Map<string, { highRows: number; nonIdleRows: number }>()
    let rowsMissingCourseSnapshot = 0
    let rowsMissingSemesterSummary = 0
    let driverlessHighRows = 0
    let rowsWithPrerequisiteCarryoverRisk = 0
    let rowsWithUpstreamPrerequisiteEvidence = 0
    let rowsWithCrossCourseDrivers = 0
    let rowsWithInterventionEvidence = 0
    let rowsWithSimulatedAction = 0

    const ledgerRows = projectionRows.map(row => {
      const payload = parseJson<JsonRecord>(row.projection_json, {})
      const currentEvidence = (payload.currentEvidence && typeof payload.currentEvidence === 'object' && !Array.isArray(payload.currentEvidence))
        ? payload.currentEvidence as JsonRecord
        : {}
      const currentStatus = (payload.currentStatus && typeof payload.currentStatus === 'object' && !Array.isArray(payload.currentStatus))
        ? payload.currentStatus as JsonRecord
        : {}
      const governance = (payload.governance && typeof payload.governance === 'object' && !Array.isArray(payload.governance))
        ? payload.governance as JsonRecord
        : {}
      const actionPath = (payload.actionPath && typeof payload.actionPath === 'object' && !Array.isArray(payload.actionPath))
        ? payload.actionPath as JsonRecord
        : {}
      const policyComparison = (currentStatus.policyComparison && typeof currentStatus.policyComparison === 'object' && !Array.isArray(currentStatus.policyComparison))
        ? currentStatus.policyComparison as JsonRecord
        : {}
      const stageKey = typeof row.checkpoint_stage_key === 'string' ? row.checkpoint_stage_key : String(payload.stageKey ?? row.evidence_window)
      const courseSnapshot = courseByStudentSemesterCode.get(groupKey(row.student_id, row.semester_number, row.course_code)) ?? null
      const semesterSummary = semesterByStudent.get(groupKey(row.student_id, row.semester_number)) ?? null
      const queueCaseId = typeof governance.queueCaseId === 'string' ? governance.queueCaseId : null
      const queueCase = (queueCaseId ? queueById.get(queueCaseId) : null)
        ?? (queueByCheckpointStudentCourse.get(groupKey(row.simulation_stage_checkpoint_id, row.student_id, row.course_code)) ?? [])[0]
        ?? null
      const interventionRowsForCourse = interventionsByStudentSemesterOffering.get(groupKey(row.student_id, row.semester_number, row.offering_id)) ?? []
      const interventionRowsForSemester = interventionsByStudentSemester.get(groupKey(row.student_id, row.semester_number)) ?? []
      const prerequisiteEdges = (edgesByTarget.get(String(row.course_code)) ?? []).map(edge => {
        const sourceCourse = courseByStudentSemesterCode.get(groupKey(row.student_id, edge.source_semester as number, edge.source_course_code as string)) ?? null
        return {
          curriculumEdgeId: edge.curriculum_edge_id,
          edgeKind: edge.edge_kind,
          sourceSemester: edge.source_semester,
          sourceCourseCode: edge.source_course_code,
          sourceCourseTitle: edge.source_course_title,
          weight: num(edge.weight),
          sourceScore: sourceCourse ? num(sourceCourse.score) : null,
          sourceResult: sourceCourse && typeof sourceCourse.result === 'string' ? sourceCourse.result : null,
          sourceWeak: sourceCourse ? (num(sourceCourse.score) ?? 100) < 60 || sourceCourse.result !== 'Passed' : null,
        }
      })
      const drivers = compactDrivers(currentStatus.observableDrivers)
      const queueState = typeof row.queue_state === 'string' ? row.queue_state : 'unknown'
      const riskBand = typeof row.risk_band === 'string' ? row.risk_band : 'unknown'

      increment(riskBandCounts, riskBand)
      increment(queueStateCounts, queueState)
      increment(stageCounts, stageKey)
      const checkpointStudents = checkpointStudentCounts.get(row.simulation_stage_checkpoint_id) ?? new Set<string>()
      checkpointStudents.add(row.student_id)
      checkpointStudentCounts.set(row.simulation_stage_checkpoint_id, checkpointStudents)

      if (!courseSnapshot) rowsMissingCourseSnapshot += 1
      if (!semesterSummary) rowsMissingSemesterSummary += 1
      if (riskBand === 'High' && drivers.length === 0) driverlessHighRows += 1
      if ((num(courseSnapshot?.prerequisiteCarryoverRisk) ?? 0) > 0.4) rowsWithPrerequisiteCarryoverRisk += 1
      if (prerequisiteEdges.some(edge => edge.sourceScore !== null)) rowsWithUpstreamPrerequisiteEvidence += 1
      if (Array.isArray(currentStatus.crossCourseDrivers) && currentStatus.crossCourseDrivers.length > 0) rowsWithCrossCourseDrivers += 1
      if (courseSnapshot?.interventionResponse || interventionRowsForCourse.length > 0 || interventionRowsForSemester.length > 0) rowsWithInterventionEvidence += 1
      if (row.simulated_action_taken) rowsWithSimulatedAction += 1
      if (riskBand === 'High') {
        const key = groupKey(row.student_id, row.semester_number, stageKey)
        const entry = highStudentStage.get(key) ?? { highRows: 0, nonIdleRows: 0 }
        entry.highRows += 1
        if (queueState !== 'idle') entry.nonIdleRows += 1
        highStudentStage.set(key, entry)
      }

      return {
        student: {
          studentId: row.student_id,
          usn: row.usn,
          name: row.student_name,
          sectionCode: row.section_code,
        },
        checkpoint: {
          checkpointId: row.simulation_stage_checkpoint_id,
          semesterNumber: row.semester_number,
          stageKey,
          stageOrder: row.stage_order,
          stageLabel: row.checkpoint_stage_label,
          evidenceWindow: row.evidence_window,
        },
        course: {
          offeringId: row.offering_id,
          courseCode: row.course_code,
          courseTitle: row.course_title,
          snapshot: courseSnapshot,
          prerequisiteEvidence: {
            carryoverRisk: num(courseSnapshot?.prerequisiteCarryoverRisk),
            upstreamEdges: prerequisiteEdges,
          },
        },
        semester: semesterSummary,
        risk: {
          riskProbScaled: num(row.risk_prob_scaled),
          riskBand,
          noActionRiskProbScaled: num(row.no_action_risk_prob_scaled),
          noActionRiskBand: row.no_action_risk_band,
          counterfactualLiftScaled: num(currentStatus.counterfactualLiftScaled ?? policyComparison.counterfactualLiftScaled ?? row.no_action_risk_prob_scaled - row.risk_prob_scaled),
          riskChangeFromPreviousCheckpointScaled: num(currentStatus.riskChangeFromPreviousCheckpointScaled ?? payload.riskChangeFromPreviousCheckpointScaled),
          modelVersion: typeof currentStatus.modelVersion === 'string' ? currentStatus.modelVersion : null,
          calibrationVersion: typeof currentStatus.calibrationVersion === 'string' ? currentStatus.calibrationVersion : null,
          headProbabilities: currentStatus.headProbabilities ?? null,
          drivers,
          crossCourseDrivers: currentStatus.crossCourseDrivers ?? null,
        },
        currentEvidence: {
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
          coEvidenceMode: typeof currentEvidence.coEvidenceMode === 'string' ? currentEvidence.coEvidenceMode : null,
          interventionRecoveryStatus: typeof currentEvidence.interventionRecoveryStatus === 'string' ? currentEvidence.interventionRecoveryStatus : null,
        },
        queue: {
          queueState,
          reassessmentState: row.reassessment_state,
          queueCaseId,
          assignedToRole: queueCase?.assigned_to_role ?? currentStatus.queueOwnerRole ?? null,
          assignedFacultyId: queueCase?.assigned_faculty_id ?? governance.assignedFacultyId ?? null,
          status: queueCase?.status ?? null,
          governanceReason: queueCase?.governance_reason ?? governance.governanceReason ?? null,
          countsTowardCapacity: queueCase?.counts_toward_capacity ?? governance.countsTowardCapacity ?? null,
          priorityRank: queueCase?.priority_rank ?? governance.priorityRank ?? null,
        },
        action: {
          recommendedAction: row.recommended_action,
          simulatedActionTaken: row.simulated_action_taken,
          taskType: actionPath.taskType ?? null,
          actionCatalog: policyComparison.actionCatalog ?? null,
          policyRationale: policyComparison.rationale ?? null,
        },
        intervention: {
          observedCourseResponse: courseSnapshot?.interventionResponse ?? null,
          courseResponseStateCount: interventionRowsForCourse.length,
          semesterResponseStateCount: interventionRowsForSemester.length,
          responseStateSamples: interventionRowsForCourse.slice(0, 3).map(intervention => parseJson<JsonRecord>(intervention.response_state_json, {})),
        },
      }
    })

    ledgerRows.sort((left, right) => (
      Number(left.checkpoint.semesterNumber) - Number(right.checkpoint.semesterNumber)
      || stageIndex(String(left.checkpoint.stageKey)) - stageIndex(String(right.checkpoint.stageKey))
      || String(left.student.studentId).localeCompare(String(right.student.studentId))
      || String(left.course.courseCode).localeCompare(String(right.course.courseCode))
    ))

    const students = new Map<string, typeof ledgerRows>()
    for (const row of ledgerRows) {
      const list = students.get(row.student.studentId) ?? []
      list.push(row)
      students.set(row.student.studentId, list)
    }

    const studentSummaries = [...students.entries()].map(([studentId, rows]) => {
      const finalSemester = rows.filter(row => row.checkpoint.semesterNumber === 6 && row.checkpoint.stageKey === 'post-see')
      const semesterSummaries = new Map<number, JsonRecord>()
      rows.forEach(row => {
        if (row.semester) semesterSummaries.set(row.checkpoint.semesterNumber, row.semester)
      })
      return {
        studentId,
        usn: rows[0]?.student.usn ?? null,
        name: rows[0]?.student.name ?? null,
        semestersCovered: [...semesterSummaries.keys()].sort((left, right) => left - right),
        coursesCovered: new Set(rows.map(row => `${row.checkpoint.semesterNumber}:${row.course.courseCode}`)).size,
        projectionRows: rows.length,
        highRows: rows.filter(row => row.risk.riskBand === 'High').length,
        mediumRows: rows.filter(row => row.risk.riskBand === 'Medium').length,
        nonIdleQueueRows: rows.filter(row => row.queue.queueState !== 'idle').length,
        finalCgpa: num(semesterSummaries.get(6)?.cgpaAfterSemester),
        finalPostSeeMaxRisk: finalSemester.length > 0 ? Math.max(...finalSemester.map(row => row.risk.riskProbScaled ?? 0)) : null,
        finalPostSeeAvgRisk: round(mean(finalSemester.map(row => row.risk.riskProbScaled))),
      }
    }).sort((left, right) => left.studentId.localeCompare(right.studentId))

    const highStudentStageGaps = [...highStudentStage.entries()]
      .filter(([, value]) => value.nonIdleRows === 0)
      .map(([key, value]) => ({ key, ...value }))
    const badCheckpointCoverage = [...checkpointStudentCounts.entries()]
      .filter(([, studentIds]) => studentIds.size !== 120)
      .map(([checkpointId, studentIds]) => ({ checkpointId, studentCount: studentIds.size }))

    const manifest = {
      generatedAt: new Date().toISOString(),
      schemaVersion: 'proof-student-trajectory-ledger.v1',
      run: {
        runId: run.simulation_run_id,
        batchId: run.batch_id,
        activeOperationalSemester: run.active_operational_semester,
        activeStageKey: run.active_stage_key,
      },
      summary: {
        studentCount: students.size,
        checkpointCount: checkpointStudentCounts.size,
        projectionRowCount: ledgerRows.length,
        riskBandCounts,
        queueStateCounts,
        stageCounts,
        badCheckpointCoverage,
        highStudentStageCount: highStudentStage.size,
        highStudentStageGaps,
        driverlessHighRows,
        rowsMissingCourseSnapshot,
        rowsMissingSemesterSummary,
        rowsWithPrerequisiteCarryoverRisk,
        rowsWithUpstreamPrerequisiteEvidence,
        rowsWithCrossCourseDrivers,
        rowsWithInterventionEvidence,
        rowsWithSimulatedAction,
        warnings: [
          ...(rowsWithPrerequisiteCarryoverRisk === 0
            ? ['No non-zero observed course prerequisiteCarryoverRisk scalar was present; downstream prerequisite evidence is carried by upstream edge joins and crossCourseDrivers instead.']
            : []),
          ...(rowsWithInterventionEvidence === 0
            ? ['No run-scoped intervention response evidence was present in this freshly seeded checkpoint universe; intervention effectiveness still needs a realized-path artifact after stage advances.']
            : []),
          ...(rowsWithSimulatedAction === 0
            ? ['No simulatedActionTaken rows were present in the initial recomputed ledger; action-effect evidence still needs a post-advance realized-path artifact.']
            : []),
        ],
      },
      studentSummaries,
      ledgerRows,
    }

    const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
    mkdirSync(outputDir, { recursive: true })
    const outputStem = 'proof-student-trajectory-ledger-2026-06-02'
    writeFileSync(
      path.join(outputDir, `${outputStem}.json`),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    writeFileSync(
      path.join(outputDir, `${outputStem}.summary.json`),
      `${JSON.stringify({
        generatedAt: manifest.generatedAt,
        schemaVersion: manifest.schemaVersion,
        run: manifest.run,
        summary: manifest.summary,
        studentSummaries: manifest.studentSummaries,
      }, null, 2)}\n`,
    )

    expect(students.size).toBe(120)
    expect(checkpointStudentCounts.size).toBe(30)
    expect(ledgerRows).toHaveLength(21_600)
    expect(badCheckpointCoverage).toEqual([])
    expect(rowsMissingCourseSnapshot).toBe(0)
    expect(rowsMissingSemesterSummary).toBe(0)
    expect(driverlessHighRows).toBe(0)
    expect(highStudentStageGaps).toEqual([])
    expect(rowsWithUpstreamPrerequisiteEvidence).toBeGreaterThan(0)
    expect(rowsWithCrossCourseDrivers).toBeGreaterThan(0)
  }, 300_000)
})
