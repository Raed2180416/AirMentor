import { createPool, createDb } from '../src/db/client.js'
import { sql } from 'drizzle-orm'

async function main() {
  const pool = createPool('postgres://postgres:postgres@127.0.0.1:44047/postgres')
  const db = createDb(pool)

  const r = await db.execute(sql.raw("SELECT decision_type, count(*) FROM alert_decisions WHERE offering_id LIKE '%_s6_%' GROUP BY decision_type"))
  console.log('Sem 6 alert decisions:', r.rows)
  const r2 = await db.execute(sql.raw("SELECT decision_type, count(*) FROM alert_decisions GROUP BY decision_type"))
  console.log('All alert decisions:', r2.rows)
  await pool.end()
}
main().catch(console.error)
