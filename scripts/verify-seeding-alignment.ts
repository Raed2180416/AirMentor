import { eq } from 'drizzle-orm'
import { getAppDb } from '../air-mentor-api/src/db/client.js'
import {
  studentAssessmentScores,
  simulationRuns,
} from '../air-mentor-api/src/db/schema.js'
import { seedMsruasProofSandbox } from '../air-mentor-api/src/adapters/simulation/msruas-proof-sandbox.js'
import { advanceProofSimulationStage } from '../air-mentor-api/src/adapters/simulation/proof-control-plane-advance-service.js'
import { DEFAULT_POLICY } from '../air-mentor-api/src/modules/admin-structure.js'

async function run() {
  const db = await getAppDb()
  const now = new Date().toISOString()
  const MSRUAS_PROOF_BATCH_ID = 'batch_mnc_cse_2023' // default from msruas-proof-sandbox
  
  console.log('1. Fetching institution...')
  const instRows = await db.execute('SELECT institution_id FROM institutions LIMIT 1')
  const institutionId = (instRows.rows[0] as { institution_id?: string } | undefined)?.institution_id
  if (!institutionId) throw new Error('No institution found')

  console.log('2. Running Path A (seedMsruasProofSandbox directly)')
  await seedMsruasProofSandbox(db, {
    institutionId,
    now,
    policy: DEFAULT_POLICY
  })

  // Get TT1 marks for a course (e.g. some course in sem 1)
  const scoresA = await db.select().from(studentAssessmentScores)
    .where(eq(studentAssessmentScores.batchId, MSRUAS_PROOF_BATCH_ID))
  
  const tt1ScoresA = scoresA.filter(s => s.componentType === 'tt1')
  console.log(`Path A seeded ${tt1ScoresA.length} TT1 scores.`)

  console.log('3. Fetching active run for Path B')
  const runs = await db.select().from(simulationRuns).where(eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID))
  const run = runs.find(r => r.activeFlag === 1) || runs[0]
  if (!run) throw new Error('No run found')

  // We need to simulate Path B which is advancing stage.
  // We should clean the db or reset to start.
  // Actually, wait, if Path A seeded everything, then TT1 is already seeded.
  // The test requires:
  // "Reset to a clean state. Enter the same manual marks... Click Next Stage... Compare auto-filled students"
  
  console.log('\n--- This script verifies Path A vs Path B seeding alignment ---')
  console.log('Currently, Path B (advanceProofSimulationStage) does NOT seem to call seedMsruasProofSandbox.')
  console.log('If Path B does not seed data, they are not aligned.')
  
  // Let's check if advanceProofSimulationStage has any seeding logic inside it.
  console.log(advanceProofSimulationStage.toString())

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
