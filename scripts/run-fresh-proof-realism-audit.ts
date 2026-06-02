#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createDb, createPool } from '../air-mentor-api/src/db/client.ts'
import {
  ensureMsruasProofSandboxSeeded,
  MSRUAS_PROOF_BATCH_ID,
  MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
} from '../air-mentor-api/src/lib/msruas-proof-sandbox.ts'
import { startProofSimulationRun } from '../air-mentor-api/src/lib/msruas-proof-control-plane.ts'
import { DEFAULT_POLICY } from '../air-mentor-api/src/modules/admin-structure.ts'

const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']

type Args = {
  seed: number
  outDir: string
  label: string
  activate: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    seed: Number(process.env.AIRMENTOR_AUDIT_SEED ?? 101),
    outDir: process.env.AIRMENTOR_REALISM_AUDIT_DIR ?? 'output/manual-realism-audit',
    label: process.env.AIRMENTOR_AUDIT_LABEL ?? 'Manual Realism Audit Run',
    activate: process.env.AIRMENTOR_AUDIT_ACTIVATE === '1',
  }
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--seed') {
      args.seed = Number(argv[index + 1] ?? args.seed)
      index += 1
    } else if (arg === '--out') {
      args.outDir = argv[index + 1] ?? args.outDir
      index += 1
    } else if (arg === '--label') {
      args.label = argv[index + 1] ?? args.label
      index += 1
    } else if (arg === '--activate') {
      args.activate = true
    }
  }
  return args
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return fallback
  }
}

function round(value: number | null | undefined, digits = 2) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(Number(value) * factor) / factor
}

function quantile(values: number[], q: number) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (clean.length === 0) return null
  const position = (clean.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  const next = clean[base + 1]
  return next == null ? clean[base] : clean[base] + rest * (next - clean[base])
}

function summarize(values: number[]) {
  const clean = values.filter(Number.isFinite)
  return {
    n: clean.length,
    mean: round(clean.reduce((sum, value) => sum + value, 0) / clean.length),
    p10: round(quantile(clean, 0.1)),
    p25: round(quantile(clean, 0.25)),
    median: round(quantile(clean, 0.5)),
    p75: round(quantile(clean, 0.75)),
    p90: round(quantile(clean, 0.9)),
    min: clean.length ? round(Math.min(...clean)) : null,
    max: clean.length ? round(Math.max(...clean)) : null,
  }
}

function cgpaBand(cgpa: number) {
  if (!Number.isFinite(cgpa)) return 'missing'
  if (cgpa < 7) return 'bad_lt_7'
  if (cgpa < 8) return 'below_average_7_8'
  if (cgpa < 8.5) return 'above_average_8_8_5'
  if (cgpa <= 9.4) return 'really_good_8_5_9_4'
  return 'exceptional_gt_9_4'
}

function stageKey(value: string) {
  return stageOrder.find(stage => value === stage || value.endsWith(`-${stage}`)) ?? value
}

function groupBy<T>(rows: T[], keyFn: (row: T) => string) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyFn(row)
    map.set(key, [...(map.get(key) ?? []), row])
  }
  return map
}

const args = parseArgs(process.argv)
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://airmentor:airmentor@127.0.0.1:5432/airmentor'
const now = new Date().toISOString()
const pool = createPool(databaseUrl, { max: 4 })
const db = createDb(pool)

try {
  mkdirSync(args.outDir, { recursive: true })
  await ensureMsruasProofSandboxSeeded(db, { now, policy: DEFAULT_POLICY })
  const run = await startProofSimulationRun(db, {
    batchId: MSRUAS_PROOF_BATCH_ID,
    curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
    policy: DEFAULT_POLICY,
    now,
    seed: args.seed,
    runLabel: args.label,
    activate: args.activate,
  })
  const runId = run.simulationRunId
  const [observedResult, projectionResult, queueResult, checkpointResult] = await Promise.all([
    pool.query(`
      select student_id, semester_number, section_code, observed_state_json
      from student_observed_semester_states
      where simulation_run_id = $1
      order by semester_number, student_id
    `, [runId]),
    pool.query(`
      select student_id, semester_number, course_code, course_title, evidence_window,
             risk_prob_scaled, risk_band, no_action_risk_prob_scaled, no_action_risk_band
      from simulation_stage_student_projections
      where simulation_run_id = $1
      order by semester_number, evidence_window, student_id, course_code
    `, [runId]),
    pool.query(`
      select semester_number, stage_key, assigned_to_role, status, primary_course_code
      from simulation_stage_queue_cases
      where simulation_run_id = $1
    `, [runId]),
    pool.query(`
      select semester_number, stage_key, summary_json
      from simulation_stage_checkpoints
      where simulation_run_id = $1
    `, [runId]),
  ])

  const semesterRows: Array<{
    studentId: string
    semesterNumber: number
    cgpa: number
    sgpa: number | null
    backlogCount: number
  }> = []
  const courseRows: Array<{
    studentId: string
    semesterNumber: number
    courseCode: string | null
    score: number
    attendancePct: number
    cePct: number
    seePct: number
    result: string
    gradeLabel: string | null
    gradePoint: number | null
  }> = []
  const latestSemesterByStudent = new Map<string, typeof semesterRows[number]>()

  for (const row of observedResult.rows) {
    const payload = parseJson<Record<string, any>>(row.observed_state_json, {})
    if (Array.isArray(payload.subjectScores)) {
      const semesterRow = {
        studentId: row.student_id,
        semesterNumber: Number(row.semester_number),
        cgpa: Number(payload.cgpaAfterSemester ?? payload.cgpa),
        sgpa: Number.isFinite(Number(payload.sgpa)) ? Number(payload.sgpa) : null,
        backlogCount: Number(payload.backlogCount ?? 0),
      }
      semesterRows.push(semesterRow)
      latestSemesterByStudent.set(`${row.student_id}::${row.semester_number}`, semesterRow)
      for (const subject of payload.subjectScores) {
        courseRows.push({
          studentId: row.student_id,
          semesterNumber: Number(row.semester_number),
          courseCode: subject.courseCode ?? null,
          score: Number(subject.score ?? subject.finalMark),
          attendancePct: Number(subject.attendancePct),
          cePct: Number(subject.cePct),
          seePct: Number(subject.seePct),
          result: String(subject.result ?? ''),
          gradeLabel: subject.gradeLabel ?? null,
          gradePoint: Number.isFinite(Number(subject.gradePoint)) ? Number(subject.gradePoint) : null,
        })
      }
    } else {
      const key = `${row.student_id}::${row.semester_number}`
      if (!latestSemesterByStudent.has(key)) {
        const semesterRow = {
          studentId: row.student_id,
          semesterNumber: Number(row.semester_number),
          cgpa: Number(payload.cgpaAfterSemester ?? payload.cgpa),
          sgpa: null,
          backlogCount: Number(payload.backlogCount ?? 0),
        }
        semesterRows.push(semesterRow)
        latestSemesterByStudent.set(key, semesterRow)
      }
      courseRows.push({
        studentId: row.student_id,
        semesterNumber: Number(row.semester_number),
        courseCode: payload.courseCode ?? null,
        score: Number(payload.score ?? payload.finalMark),
        attendancePct: Number(payload.attendancePct),
        cePct: Number(payload.cePct),
        seePct: Number(payload.seePct),
        result: String(payload.result ?? ''),
        gradeLabel: payload.gradeLabel ?? null,
        gradePoint: Number.isFinite(Number(payload.gradePoint)) ? Number(payload.gradePoint) : null,
      })
    }
  }

  const cgpaBySemester = [...groupBy(semesterRows, row => String(row.semesterNumber)).entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([semesterNumber, rows]) => {
      const cgpas = rows.map(row => row.cgpa)
      const backlogs = rows.map(row => row.backlogCount)
      return {
        semesterNumber: Number(semesterNumber),
        ...summarize(cgpas),
        bands: rows.reduce<Record<string, number>>((acc, row) => {
          const band = cgpaBand(row.cgpa)
          acc[band] = (acc[band] ?? 0) + 1
          return acc
        }, {
          bad_lt_7: 0,
          below_average_7_8: 0,
          above_average_8_8_5: 0,
          really_good_8_5_9_4: 0,
          exceptional_gt_9_4: 0,
        }),
        avgBacklog: round(backlogs.reduce((sum, value) => sum + value, 0) / backlogs.length),
        maxBacklog: backlogs.length ? Math.max(...backlogs) : null,
      }
    })

  const marksBySemester = [...groupBy(courseRows, row => String(row.semesterNumber)).entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([semesterNumber, rows]) => ({
      semesterNumber: Number(semesterNumber),
      score: summarize(rows.map(row => row.score)),
      failRows: rows.filter(row => row.result !== 'Passed' || row.gradePoint === 0).length,
      avgAttendance: round(rows.reduce((sum, row) => sum + row.attendancePct, 0) / rows.length),
      avgCe: round(rows.reduce((sum, row) => sum + row.cePct, 0) / rows.length),
      avgSee: round(rows.reduce((sum, row) => sum + row.seePct, 0) / rows.length),
    }))

  const riskByStage = [...groupBy(projectionResult.rows, row => `${row.semester_number}::${stageKey(row.evidence_window)}`).entries()]
    .sort(([a], [b]) => {
      const [semA, stageA] = a.split('::')
      const [semB, stageB] = b.split('::')
      if (Number(semA) !== Number(semB)) return Number(semA) - Number(semB)
      return stageOrder.indexOf(stageA) - stageOrder.indexOf(stageB)
    })
    .map(([key, rows]) => {
      const [semesterNumber, stage] = key.split('::')
      return {
        semesterNumber: Number(semesterNumber),
        stageKey: stage,
        rows: rows.length,
        students: new Set(rows.map(row => row.student_id)).size,
        avgRisk: round(rows.reduce((sum, row) => sum + Number(row.risk_prob_scaled), 0) / rows.length / 100),
        p90Risk: round(quantile(rows.map(row => Number(row.risk_prob_scaled) / 100), 0.9)),
        maxRisk: round(Math.max(...rows.map(row => Number(row.risk_prob_scaled) / 100))),
        high: rows.filter(row => row.risk_band === 'High').length,
        medium: rows.filter(row => row.risk_band === 'Medium').length,
        low: rows.filter(row => row.risk_band === 'Low').length,
        highStudents: new Set(rows.filter(row => row.risk_band === 'High').map(row => row.student_id)).size,
        mediumOrHighStudents: new Set(rows.filter(row => row.risk_band === 'High' || row.risk_band === 'Medium').map(row => row.student_id)).size,
      }
    })

  const queueByRole = [...groupBy(queueResult.rows, row => String(row.assigned_to_role ?? 'unassigned')).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([role, rows]) => ({
      role,
      cases: rows.length,
      uniqueCourses: new Set(rows.map(row => row.primary_course_code)).size,
    }))

  const output = {
    generatedAt: now,
    runId,
    seed: args.seed,
    label: args.label,
    counts: {
      observed: observedResult.rowCount,
      projections: projectionResult.rowCount,
      checkpoints: checkpointResult.rowCount,
      queueCases: queueResult.rowCount,
      students: new Set(semesterRows.map(row => row.studentId)).size,
      courseRows: courseRows.length,
    },
    cgpaBySemester,
    marksBySemester,
    riskByStage,
    queueByRole,
  }

  const outFile = join(args.outDir, `fresh-average-class-run-summary-seed-${args.seed}.json`)
  writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify({
    outFile,
    runId,
    seed: args.seed,
    sem6CgpaMean: cgpaBySemester.find(row => row.semesterNumber === 6)?.mean,
    sem6Bands: cgpaBySemester.find(row => row.semesterNumber === 6)?.bands,
    sem6FailRows: marksBySemester.find(row => row.semesterNumber === 6)?.failRows,
    sem6Risk: riskByStage.filter(row => row.semesterNumber === 6),
  }, null, 2))
} finally {
  await pool.end()
}
