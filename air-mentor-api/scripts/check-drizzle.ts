import { createPool, createDb } from '../src/db/client.js'
import { facultyOfferingOwnerships, roleGrants } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  const connectionString = 'postgres://postgres:postgres@127.0.0.1:35971/postgres'
  const pool = createPool(connectionString)
  const db = createDb(pool)
  const rows = await db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, 'mnc_t2'))
  console.log('Ownerships for mnc_t2:', rows.length)
  console.log(rows.map(r => ({ ...r, status: r.status, role: r.ownershipRole })))

  const grants = await db.select().from(roleGrants).where(eq(roleGrants.facultyId, 'mnc_t2'))
  console.log('\nRole Grants for mnc_t2:', grants.length)
  console.log(grants.map(r => ({ role: r.roleCode, type: r.scopeType, id: r.scopeId })))

  pool.end()
}
main().catch(console.error)
