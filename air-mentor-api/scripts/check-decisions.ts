import { createPool, createDb } from '../src/db/client.js'
import { sql } from 'drizzle-orm'

async function main() {
  const pool = createPool('postgres://postgres:postgres@127.0.0.1:35471/postgres')
  const db = createDb(pool)

  const r = await db.execute(sql.raw("SELECT decision_type, count(*) FROM alert_decisions GROUP BY decision_type"))
  console.log(r.rows)
  await pool.end()
}
main().catch(console.error)
