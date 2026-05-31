import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../air-mentor-api/.env') })

function esc(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

async function query(pool: Pool, sql: string): Promise<any[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await pool.query(sql)
      return result.rows
    } catch (err: any) {
      console.error(`  Attempt ${attempt} failed: ${err.code || err.message}`)
      if (attempt === 3) throw err
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  return []
}

async function extract() {
  console.log('Extracting massive demo dump...')
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.RAILWAY_TEST_DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5432/airmentor'
  console.log('Connecting to:', dbUrl.replace(/:[^:@]+@/, ':***@'))

  const pool = new Pool({
    connectionString: dbUrl,
    max: 2,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 60_000,
    ssl: dbUrl.includes('rlwy.net') ? { rejectUnauthorized: false } : undefined,
  })

  // Warm up connection
  console.log('Warming up connection...')
  const warmup = await pool.query('SELECT 1 as ping')
  console.log('  Connection OK:', warmup.rows[0])

  // ─── 1. Risk assessments ───
  console.log('Querying risk_assessments + students...')
  const riskRows = await query(pool, `
    SELECT
      s.student_id, s.usn, s.name,
      r.term_id, r.offering_id, r.assessment_scope,
      r.risk_prob_scaled, r.risk_band, r.recommended_action,
      r.drivers_json, r.evidence_window,
      r.model_version, r.source_type, r.assessed_at
    FROM risk_assessments r
    LEFT JOIN students s ON r.student_id = s.student_id
    ORDER BY r.student_id, r.assessed_at
  `)
  const riskHeader = 'studentId,usn,name,termId,offeringId,assessmentScope,riskProbScaled,riskBand,recommendedAction,driversJson,evidenceWindow,modelVersion,sourceType,assessedAt'
  const riskCsv = riskRows.map(r =>
    [r.student_id, r.usn, esc(r.name), r.term_id, r.offering_id, r.assessment_scope, r.risk_prob_scaled, r.risk_band, r.recommended_action, esc(r.drivers_json), r.evidence_window, r.model_version, r.source_type, r.assessed_at].join(',')
  )
  const riskPath = join(process.cwd(), 'student_risk_trajectories_exhaustive.csv')
  writeFileSync(riskPath, [riskHeader, ...riskCsv].join('\n'))
  console.log(`  → Wrote ${riskRows.length} risk rows`)

  // ─── 2. Assessment scores ───
  console.log('Querying student_assessment_scores...')
  const scoreRows = await query(pool, `
    SELECT student_id, offering_id, term_id, component_type, component_code, score, max_score, evaluated_at
    FROM student_assessment_scores
    ORDER BY student_id, offering_id
  `)
  const scoreHeader = 'studentId,offeringId,termId,componentType,componentCode,score,maxScore,evaluatedAt'
  const scoreCsv = scoreRows.map(r =>
    [r.student_id, r.offering_id, r.term_id, r.component_type, r.component_code, r.score, r.max_score, r.evaluated_at].join(',')
  )
  writeFileSync(join(process.cwd(), 'student_assessment_scores_exhaustive.csv'), [scoreHeader, ...scoreCsv].join('\n'))
  console.log(`  → Wrote ${scoreRows.length} score rows`)

  // ─── 3. Attendance ───
  console.log('Querying student_attendance_snapshots...')
  const attRows = await query(pool, `
    SELECT student_id, offering_id, present_classes, total_classes, attendance_percent, source, captured_at
    FROM student_attendance_snapshots
    ORDER BY student_id, offering_id
  `)
  const attHeader = 'studentId,offeringId,presentClasses,totalClasses,attendancePercent,source,capturedAt'
  const attCsv = attRows.map(r =>
    [r.student_id, r.offering_id, r.present_classes, r.total_classes, r.attendance_percent, r.source, r.captured_at].join(',')
  )
  writeFileSync(join(process.cwd(), 'student_attendance_exhaustive.csv'), [attHeader, ...attCsv].join('\n'))
  console.log(`  → Wrote ${attRows.length} attendance rows`)

  // ─── 4. Interventions ───
  console.log('Querying student_interventions...')
  const intRows = await query(pool, `
    SELECT intervention_id, student_id, faculty_id, offering_id, intervention_type, note, occurred_at, created_at
    FROM student_interventions
    ORDER BY student_id, offering_id
  `)
  const intHeader = 'interventionId,studentId,facultyId,offeringId,interventionType,note,occurredAt,createdAt'
  const intCsv = intRows.map(r =>
    [r.intervention_id, r.student_id, r.faculty_id, r.offering_id, r.intervention_type, esc(r.note), r.occurred_at, r.created_at].join(',')
  )
  writeFileSync(join(process.cwd(), 'student_interventions_exhaustive.csv'), [intHeader, ...intCsv].join('\n'))
  console.log(`  → Wrote ${intRows.length} intervention rows`)

  // ─── Summary ───
  console.log('\n═══ EXHAUSTIVE DUMP SUMMARY ═══')
  console.log(`Risk trajectories:    ${riskRows.length} rows`)
  console.log(`Assessment scores:    ${scoreRows.length} rows`)
  console.log(`Attendance snapshots: ${attRows.length} rows`)
  console.log(`Interventions:        ${intRows.length} rows`)

  await pool.end()
  console.log('Done.')
}

extract().catch(err => {
  console.error('FATAL:', err.message || err)
  process.exit(1)
})
