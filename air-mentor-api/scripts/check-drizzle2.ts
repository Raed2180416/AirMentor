import { createPool, createDb } from '../src/db/client.js'
import { sectionOfferings, academicTerms, batches } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  const connectionString = 'postgres://postgres:postgres@127.0.0.1:35971/postgres'
  const pool = createPool(connectionString)
  const db = createDb(pool)

  const oRows = await db.select().from(sectionOfferings).where(eq(sectionOfferings.status, 'active'))
  console.log('Active sectionOfferings:', oRows.length)
  console.log(oRows.map(r => ({ id: r.offeringId, termId: r.termId })))

  const tRows = await db.select().from(academicTerms)
  console.log('Academic terms:', tRows.map(r => ({ id: r.termId, sem: r.semesterNumber, status: r.status, batchId: r.batchId })))

  const bRows = await db.select().from(batches)
  console.log('Batches:', bRows.map(r => ({ id: r.batchId, status: r.status })))

  pool.end()
}
main().catch(console.error)
