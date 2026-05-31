import { createPool, createDb } from '../src/db/client.js'
import { sql } from 'drizzle-orm'

async function main() {
  const pool = createPool('postgres://postgres:postgres@127.0.0.1:44047/postgres')
  const db = createDb(pool)

  const tables = [
    'alert_decisions', 'alert_outcomes', 'reassessment_events', 'reassessment_resolutions',
    'academic_meetings', 'student_topic_states', 'student_co_states',
    'student_question_results', 'student_assessment_scores', 'student_attendance_snapshots',
    'interventions', 'action_queue_items', 'risk_assessments', 'risk_evidence_snapshots',
    'simulation_stage_checkpoints', 'simulation_stage_student_projections'
  ]

  for (const t of tables) {
    try {
      const r = await db.execute(sql.raw('SELECT COUNT(*) as c FROM ' + t))
      console.log(t + ': ' + r.rows[0].c)
    } catch(e: any) {
      console.log(t + ': ERROR - ' + e.message.slice(0, 60))
    }
  }
  await pool.end()
}
main().catch(console.error)
