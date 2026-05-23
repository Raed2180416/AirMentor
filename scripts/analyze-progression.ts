import { Pool } from 'pg'

async function analyze() {
  const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/air-mentor-dev' })
  const res = await pool.query(`
    SELECT 
      student_id, 
      semester_ordinal, 
      stage_key, 
      observed_state_json->>'riskProb' as risk_prob,
      observed_state_json->>'riskBand' as risk_band,
      observed_state_json->>'cgpa' as cgpa,
      observed_state_json->>'attendancePct' as attendance
    FROM student_observed_semester_states
    WHERE student_id IN ('mnc_student_001', 'mnc_student_060', 'mnc_student_119')
    ORDER BY student_id, semester_ordinal, stage_key
  `)
  
  console.log("Student Progression Analysis:")
  let currentStudent = ''
  for (const row of res.rows) {
    if (row.student_id !== currentStudent) {
      console.log(`\n--- ${row.student_id} ---`)
      currentStudent = row.student_id
    }
    console.log(`Sem ${row.semester_ordinal} Stage ${row.stage_key} | Risk: ${(parseFloat(row.risk_prob) * 100).toFixed(1)}% (${row.risk_band}) | CGPA: ${row.cgpa} | Attendance: ${row.attendance}%`)
  }
  await pool.end()
}

analyze().catch(console.error)
