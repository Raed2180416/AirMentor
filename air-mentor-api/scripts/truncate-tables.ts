import { createPool, createDb } from '../src/db/client.js'
import { sql } from 'drizzle-orm'
import { 
  simulationRuns,
  simulationStageStudentProjections,
  riskAssessments,
  studentObservedSemesterStates,
  semesterTransitionLogs,
  studentLatentStates
} from '../src/db/schema.js'

async function run() {
  const pool = createPool(process.env.DATABASE_URL!)
  const db = createDb(pool)
  console.log('Truncating massive tables...')
  await db.execute(sql`TRUNCATE TABLE ${riskAssessments} CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE ${simulationStageStudentProjections} CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE ${studentObservedSemesterStates} CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE ${semesterTransitionLogs} CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE ${studentLatentStates} CASCADE;`)
  await db.execute(sql`TRUNCATE TABLE ${simulationRuns} CASCADE;`)
  console.log('Truncated. Disk space should be freed up.')
  process.exit(0)
}

run().catch(console.error)
