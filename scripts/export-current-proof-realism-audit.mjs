#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pgPkg from 'pg'

const { Client } = pgPkg

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://airmentor:airmentor@127.0.0.1:5432/airmentor'

function parseArgs(argv) {
  const parsed = {
    outputDir: process.env.AIRMENTOR_REALISM_AUDIT_DIR ?? 'output/manual-realism-audit',
    runId: process.env.AIRMENTOR_SIMULATION_RUN_ID ?? '',
  }
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--out' || arg === '--output-dir') {
      parsed.outputDir = argv[index + 1] ?? parsed.outputDir
      index += 1
    } else if (arg === '--run-id') {
      parsed.runId = argv[index + 1] ?? parsed.runId
      index += 1
    } else if (!arg.startsWith('--') && !parsed.runId) {
      parsed.runId = arg
    }
  }
  return parsed
}

const { outputDir, runId: requestedRunId } = parseArgs(process.argv)

const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']

function parseJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function stageKeyFromEvidenceWindow(value) {
  const raw = String(value ?? '')
  for (const stage of stageOrder) {
    if (raw === stage || raw.endsWith(`-${stage}`)) return stage
  }
  return raw
}

function cgpaBand(cgpa) {
  if (!Number.isFinite(cgpa)) return 'missing'
  if (cgpa < 7) return 'bad_lt_7'
  if (cgpa < 8) return 'below_average_7_8'
  if (cgpa < 8.5) return 'above_average_8_8_5'
  if (cgpa <= 9.4) return 'really_good_8_5_9_4'
  return 'exceptional_gt_9_4'
}

function csvEscape(value) {
  if (value == null) return ''
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r\t]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`
  return raw
}

function writeCsv(path, rows) {
  const headers = rows.length > 0
    ? Array.from(rows.reduce((set, row) => {
        Object.keys(row).forEach(key => set.add(key))
        return set
      }, new Set()))
    : []
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ]
  writeFileSync(path, `${lines.join('\n')}\n`)
}

function mean(values) {
  const clean = values.filter(Number.isFinite)
  if (!clean.length) return null
  return clean.reduce((sum, value) => sum + value, 0) / clean.length
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function quantile(values, q) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return null
  const pos = (clean.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (clean[base + 1] == null) return clean[base]
  return clean[base] + rest * (clean[base + 1] - clean[base])
}

function summarize(values) {
  const clean = values.filter(Number.isFinite)
  return {
    n: clean.length,
    mean: round(mean(clean)),
    median: round(quantile(clean, 0.5)),
    p10: round(quantile(clean, 0.1)),
    p25: round(quantile(clean, 0.25)),
    p75: round(quantile(clean, 0.75)),
    p90: round(quantile(clean, 0.9)),
    min: clean.length ? round(Math.min(...clean)) : null,
    max: clean.length ? round(Math.max(...clean)) : null,
  }
}

function groupBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

async function main() {
  mkdirSync(outputDir, { recursive: true })
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const runResult = requestedRunId
    ? await client.query('select * from simulation_runs where simulation_run_id = $1', [requestedRunId])
    : await client.query("select * from simulation_runs where status = 'active' order by updated_at desc limit 1")
  const run = runResult.rows[0]
  if (!run) throw new Error(`No simulation run found${requestedRunId ? ` for ${requestedRunId}` : ''}`)
  const runId = run.simulation_run_id

  const studentResult = await client.query(`
      select distinct s.*
      from students s
      join simulation_stage_student_projections p on p.student_id = s.student_id
      where p.simulation_run_id = $1
      order by s.student_id
    `, [runId])
  const observedResult = await client.query(`
      select *
      from student_observed_semester_states
      where simulation_run_id = $1
      order by semester_number, student_id, student_observed_semester_state_id
    `, [runId])
  const projectionResult = await client.query(`
      select *
      from simulation_stage_student_projections
      where simulation_run_id = $1
      order by semester_number, evidence_window, student_id, course_code
    `, [runId])
  const checkpointResult = await client.query(`
      select *
      from simulation_stage_checkpoints
      where simulation_run_id = $1
      order by semester_number, stage_order
    `, [runId])
  const queueResult = await client.query(`
      select *
      from simulation_stage_queue_cases
      where simulation_run_id = $1
      order by semester_number, stage_key, student_id, primary_course_code
    `, [runId])
  const interventionResult = await client.query(`
      select *
      from student_intervention_response_states
      where simulation_run_id = $1
      order by semester_number, student_id, offering_id
    `, [runId])
  const curriculumEdgeResult = await client.query(`
      select *
      from curriculum_edges
      where batch_id = $1
      order by edge_kind, source_curriculum_node_id, target_curriculum_node_id
    `, [run.batch_id])
  const roleResult = await client.query(`
      select fp.faculty_id, fp.display_name, rg.role_code, foo.offering_id, foo.ownership_role
      from faculty_profiles fp
      left join role_grants rg on rg.faculty_id = fp.faculty_id and rg.status = 'active'
      left join faculty_offering_ownerships foo on foo.faculty_id = fp.faculty_id
      order by fp.faculty_id, rg.role_code, foo.offering_id
    `)

  const students = studentResult.rows
  const studentById = new Map(students.map(student => [student.student_id, student]))
  const observedRows = observedResult.rows
  const projectionRowsRaw = projectionResult.rows
  const queueRows = queueResult.rows
  const interventionRows = interventionResult.rows
  const curriculumEdges = curriculumEdgeResult.rows
  const roleRows = roleResult.rows

  const studentSemesterRows = []
  const courseScoreRows = []
  const courseOutcomeRows = []

  for (const row of observedRows) {
    const payload = parseJson(row.observed_state_json, {})
    const student = studentById.get(row.student_id) ?? {}
    if (Array.isArray(payload.subjectScores)) {
      studentSemesterRows.push({
        studentId: row.student_id,
        studentName: student.name,
        semesterNumber: row.semester_number,
        rowShape: 'semester-aggregate',
        sgpa: payload.sgpa ?? null,
        cgpa: payload.cgpaAfterSemester ?? payload.cgpa ?? null,
        cgpaBand: cgpaBand(Number(payload.cgpaAfterSemester ?? payload.cgpa)),
        backlogCount: payload.backlogCount ?? null,
        weakCoCount: payload.weakCoCount ?? null,
        registeredCredits: payload.registeredCredits ?? null,
        earnedCredits: payload.earnedCredits ?? null,
        interventionCount: payload.interventionCount ?? null,
      })
      for (const subject of payload.subjectScores) {
        const base = {
          studentId: row.student_id,
          studentName: student.name,
          semesterNumber: row.semester_number,
          observedRowShape: 'semester-aggregate-subject',
          offeringId: subject.offeringId ?? null,
          courseCode: subject.courseCode ?? null,
          courseTitle: subject.title ?? subject.courseTitle ?? null,
          credits: subject.credits ?? null,
          score: subject.score ?? subject.finalMark ?? null,
          attendancePct: subject.attendancePct ?? null,
          tt1Pct: subject.tt1Pct ?? null,
          tt2Pct: subject.tt2Pct ?? null,
          quizPct: subject.quizPct ?? null,
          assignmentPct: subject.assignmentPct ?? null,
          cePct: subject.cePct ?? null,
          seePct: subject.seePct ?? null,
          gradeLabel: subject.gradeLabel ?? null,
          gradePoint: subject.gradePoint ?? null,
          result: subject.result ?? null,
          weakCoCount: subject.weakCoCount ?? null,
          prerequisiteCarryoverRisk: subject.prerequisiteCarryoverRisk ?? null,
          interventionType: subject.interventionResponse?.interventionType ?? null,
          interventionAccepted: subject.interventionResponse?.accepted ?? null,
          interventionCompleted: subject.interventionResponse?.completed ?? null,
          interventionRecoveryConfirmed: subject.interventionResponse?.recoveryConfirmed ?? null,
        }
        courseScoreRows.push(base)
        for (const co of subject.coSummary ?? []) {
          courseOutcomeRows.push({
            ...base,
            coCode: co.coCode ?? null,
            coTitle: co.coTitle ?? null,
            coMastery: co.mastery ?? null,
            coEvidenceMode: co.evidenceMode ?? null,
            coTrend: co.trend ?? null,
            transferGap: co.transferGap ?? null,
            recoveryAfterIntervention: co.recoveryAfterIntervention ?? null,
          })
        }
      }
    } else {
      studentSemesterRows.push({
        studentId: row.student_id,
        studentName: student.name,
        semesterNumber: row.semester_number,
        rowShape: 'course-row-proxy',
        sgpa: payload.sgpa ?? null,
        cgpa: payload.cgpaAfterSemester ?? payload.cgpa ?? null,
        cgpaBand: cgpaBand(Number(payload.cgpaAfterSemester ?? payload.cgpa)),
        backlogCount: payload.backlogCount ?? null,
        weakCoCount: payload.weakCoCount ?? null,
        registeredCredits: payload.registeredCredits ?? null,
        earnedCredits: payload.earnedCredits ?? null,
        interventionCount: payload.interventionCount ?? null,
      })
      const base = {
        studentId: row.student_id,
        studentName: student.name,
        semesterNumber: row.semester_number,
        observedRowShape: 'course-row',
        offeringId: payload.offeringId ?? null,
        courseCode: payload.courseCode ?? null,
        courseTitle: payload.courseTitle ?? payload.title ?? null,
        credits: payload.credits ?? null,
        score: payload.score ?? payload.finalMark ?? null,
        attendancePct: payload.attendancePct ?? null,
        tt1Pct: payload.tt1Pct ?? null,
        tt2Pct: payload.tt2Pct ?? null,
        quizPct: payload.quizPct ?? null,
        assignmentPct: payload.assignmentPct ?? null,
        cePct: payload.cePct ?? null,
        seePct: payload.seePct ?? null,
        gradeLabel: payload.gradeLabel ?? null,
        gradePoint: payload.gradePoint ?? null,
        result: payload.result ?? null,
        weakCoCount: payload.weakCoCount ?? null,
        prerequisiteCarryoverRisk: payload.prerequisiteCarryoverRisk ?? null,
        interventionType: payload.interventionResponse?.interventionType ?? null,
        interventionAccepted: payload.interventionResponse?.accepted ?? null,
        interventionCompleted: payload.interventionResponse?.completed ?? null,
        interventionRecoveryConfirmed: payload.interventionResponse?.recoveryConfirmed ?? null,
      }
      courseScoreRows.push(base)
      for (const co of payload.coSummary ?? []) {
        courseOutcomeRows.push({
          ...base,
          coCode: co.coCode ?? null,
          coTitle: co.coTitle ?? null,
          coMastery: co.mastery ?? null,
          coEvidenceMode: co.evidenceMode ?? null,
          coTrend: co.trend ?? null,
          transferGap: co.transferGap ?? null,
          recoveryAfterIntervention: co.recoveryAfterIntervention ?? null,
        })
      }
    }
  }

  const projectionRows = projectionRowsRaw.map(row => {
    const payload = parseJson(row.projection_json, {})
    const status = payload.currentStatus ?? {}
    return {
      studentId: row.student_id,
      studentName: studentById.get(row.student_id)?.name ?? null,
      semesterNumber: row.semester_number,
      evidenceWindow: row.evidence_window,
      stageKey: payload.stageKey ?? stageKeyFromEvidenceWindow(row.evidence_window),
      stageLabel: payload.stageLabel ?? null,
      offeringId: row.offering_id,
      courseCode: row.course_code,
      courseTitle: row.course_title,
      riskProbScaled: row.risk_prob_scaled,
      riskBand: row.risk_band,
      noActionRiskProbScaled: row.no_action_risk_prob_scaled,
      noActionRiskBand: row.no_action_risk_band,
      counterfactualLiftScaled: (row.no_action_risk_prob_scaled ?? 0) - (row.risk_prob_scaled ?? 0),
      simulatedActionTaken: row.simulated_action_taken,
      recommendedAction: row.recommended_action,
      queueState: row.queue_state,
      reassessmentState: row.reassessment_state,
      currentCgpa: status.currentCgpa ?? null,
      backlogCount: status.backlogCount ?? null,
      previousRiskProbScaled: status.previousRiskProbScaled ?? null,
      riskChangeFromPreviousCheckpointScaled: status.riskChangeFromPreviousCheckpointScaled ?? null,
      weakCoCount: payload.currentEvidence?.weakCoCount ?? null,
      weakQuestionCount: payload.currentEvidence?.weakQuestionCount ?? null,
      coEvidenceMode: payload.currentEvidence?.coEvidenceMode ?? null,
      queueOwnerRole: status.queueOwnerRole ?? null,
      monitoringDecisionType: status.monitoringDecisionType ?? null,
      observableDrivers: (status.observableDrivers ?? []).map(driver => driver.label).join(' | '),
      attentionAreas: (status.attentionAreas ?? []).join(' | '),
    }
  })

  const finalProjectionRows = projectionRows.filter(row => row.semesterNumber === 6 && row.stageKey === 'post-see')
  const semesterByStudent = groupBy(studentSemesterRows, row => row.studentId)
  const finalProjectionByStudent = groupBy(finalProjectionRows, row => row.studentId)
  const interventionByStudent = groupBy(interventionRows, row => row.student_id)

  const studentJourneyRows = students.map(student => {
    const semRows = (semesterByStudent.get(student.student_id) ?? [])
      .filter(row => row.rowShape === 'semester-aggregate' || row.semesterNumber === 6)
    const bySem = new Map()
    for (const row of semRows) {
      if (!bySem.has(row.semesterNumber)) bySem.set(row.semesterNumber, row)
    }
    const finalRows = finalProjectionByStudent.get(student.student_id) ?? []
    const finalCgpa = bySem.get(6)?.cgpa ?? null
    const s1 = bySem.get(1)?.cgpa ?? null
    const s6 = finalCgpa
    return {
      studentId: student.student_id,
      studentName: student.name,
      cgpaS1: bySem.get(1)?.cgpa ?? null,
      cgpaS2: bySem.get(2)?.cgpa ?? null,
      cgpaS3: bySem.get(3)?.cgpa ?? null,
      cgpaS4: bySem.get(4)?.cgpa ?? null,
      cgpaS5: bySem.get(5)?.cgpa ?? null,
      cgpaS6: finalCgpa,
      finalCgpaBand: cgpaBand(Number(finalCgpa)),
      cgpaDeltaS1ToS6: Number.isFinite(Number(s1)) && Number.isFinite(Number(s6)) ? round(Number(s6) - Number(s1)) : null,
      finalBacklogCount: bySem.get(6)?.backlogCount ?? null,
      finalAvgRiskScaled: round(mean(finalRows.map(row => Number(row.riskProbScaled)))),
      finalMaxRiskScaled: finalRows.length ? Math.max(...finalRows.map(row => Number(row.riskProbScaled))) : null,
      finalHighCourseCount: finalRows.filter(row => row.riskBand === 'High').length,
      finalMediumCourseCount: finalRows.filter(row => row.riskBand === 'Medium').length,
      finalLowCourseCount: finalRows.filter(row => row.riskBand === 'Low').length,
      finalAvgCounterfactualLiftScaled: round(mean(finalRows.map(row => Number(row.counterfactualLiftScaled)))),
      runScopedInterventionResponseCount: (interventionByStudent.get(student.student_id) ?? []).length,
    }
  })

  const courseStageSummaryRows = []
  for (const [key, rows] of groupBy(projectionRows, row => `${row.semesterNumber}\t${row.stageKey}\t${row.courseCode}`).entries()) {
    const [semesterNumber, stageKey, courseCode] = key.split('\t')
    courseStageSummaryRows.push({
      semesterNumber: Number(semesterNumber),
      stageKey,
      courseCode,
      courseTitle: rows[0]?.courseTitle ?? null,
      rowCount: rows.length,
      studentCount: new Set(rows.map(row => row.studentId)).size,
      avgRiskScaled: round(mean(rows.map(row => Number(row.riskProbScaled)))),
      minRiskScaled: Math.min(...rows.map(row => Number(row.riskProbScaled))),
      maxRiskScaled: Math.max(...rows.map(row => Number(row.riskProbScaled))),
      highCount: rows.filter(row => row.riskBand === 'High').length,
      mediumCount: rows.filter(row => row.riskBand === 'Medium').length,
      lowCount: rows.filter(row => row.riskBand === 'Low').length,
      avgCounterfactualLiftScaled: round(mean(rows.map(row => Number(row.counterfactualLiftScaled)))),
      actionMix: [...groupBy(rows, row => row.simulatedActionTaken || 'none').entries()]
        .map(([action, actionRows]) => `${action}:${actionRows.length}`)
        .join('; '),
    })
  }

  const courseScoreSummaryRows = []
  for (const [key, rows] of groupBy(courseScoreRows, row => `${row.semesterNumber}\t${row.courseCode}`).entries()) {
    const [semesterNumber, courseCode] = key.split('\t')
    courseScoreSummaryRows.push({
      semesterNumber: Number(semesterNumber),
      courseCode,
      courseTitle: rows[0]?.courseTitle ?? null,
      rowCount: rows.length,
      avgScore: round(mean(rows.map(row => Number(row.score)))),
      minScore: Math.min(...rows.map(row => Number(row.score))),
      maxScore: Math.max(...rows.map(row => Number(row.score))),
      failRows: rows.filter(row => row.result !== 'Passed').length,
      avgAttendancePct: round(mean(rows.map(row => Number(row.attendancePct)))),
      avgCePct: round(mean(rows.map(row => Number(row.cePct)))),
      avgSeePct: round(mean(rows.map(row => Number(row.seePct)))),
      avgWeakCoCount: round(mean(rows.map(row => Number(row.weakCoCount)))),
    })
  }

  const finalCgpas = studentJourneyRows.map(row => Number(row.cgpaS6))
  const metrics = {
    generatedAt: new Date().toISOString(),
    run: {
      simulationRunId: runId,
      runLabel: run.run_label,
      status: run.status,
      batchId: run.batch_id,
      activeOperationalSemester: run.active_operational_semester,
      activeStageKey: run.active_stage_key,
    },
    counts: {
      students: students.length,
      observedRows: observedRows.length,
      normalizedCourseScoreRows: courseScoreRows.length,
      courseOutcomeRows: courseOutcomeRows.length,
      projections: projectionRows.length,
      checkpoints: checkpointResult.rows.length,
      queueCases: queueRows.length,
      runScopedInterventionResponses: interventionRows.length,
      curriculumEdges: curriculumEdges.length,
    },
    cgpaBands: Object.fromEntries([...groupBy(studentJourneyRows, row => row.finalCgpaBand).entries()].map(([band, rows]) => [band, rows.length])),
    finalCgpaSummary: summarize(finalCgpas),
    finalRiskSummary: summarize(studentJourneyRows.map(row => Number(row.finalAvgRiskScaled))),
    finalBacklogSummary: summarize(studentJourneyRows.map(row => Number(row.finalBacklogCount))),
    rowShapeBySemester: Object.fromEntries([...groupBy(studentSemesterRows, row => `${row.semesterNumber}:${row.rowShape}`).entries()].map(([shape, rows]) => [shape, rows.length])),
  }

  const manifest = {
    metrics,
    files: {
      metrics: 'metrics.json',
      studentJourneys: 'student_journeys.csv',
      studentSemesterSummaries: 'student_semester_summaries.csv',
      courseScores: 'course_scores.csv',
      courseOutcomes: 'course_outcomes.csv',
      projections: 'stage_student_projections.csv',
      courseStageSummary: 'course_stage_summary.csv',
      courseScoreSummary: 'course_score_summary.csv',
      queueCases: 'queue_cases.csv',
      interventionResponses: 'intervention_responses.csv',
      curriculumEdges: 'curriculum_edges.csv',
      facultyRoleScope: 'faculty_role_scope.csv',
    },
  }

  writeFileSync(join(outputDir, 'metrics.json'), JSON.stringify(metrics, null, 2))
  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  writeCsv(join(outputDir, 'student_journeys.csv'), studentJourneyRows)
  writeCsv(join(outputDir, 'student_semester_summaries.csv'), studentSemesterRows)
  writeCsv(join(outputDir, 'course_scores.csv'), courseScoreRows)
  writeCsv(join(outputDir, 'course_outcomes.csv'), courseOutcomeRows)
  writeCsv(join(outputDir, 'stage_student_projections.csv'), projectionRows)
  writeCsv(join(outputDir, 'course_stage_summary.csv'), courseStageSummaryRows)
  writeCsv(join(outputDir, 'course_score_summary.csv'), courseScoreSummaryRows)
  writeCsv(join(outputDir, 'queue_cases.csv'), queueRows)
  writeCsv(join(outputDir, 'intervention_responses.csv'), interventionRows)
  writeCsv(join(outputDir, 'curriculum_edges.csv'), curriculumEdges)
  writeCsv(join(outputDir, 'faculty_role_scope.csv'), roleRows)

    console.log(JSON.stringify({ outputDir, ...metrics }, null, 2))
  } finally {
    await client.end()
  }
}

main().catch(async error => {
  console.error(error)
  process.exitCode = 1
})
