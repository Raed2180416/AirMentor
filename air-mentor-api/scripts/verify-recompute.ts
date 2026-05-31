import { createPool, createDb } from '../src/db/client.js'
import { simulationStageCheckpoints, simulationStageStudentProjections, riskAssessments, riskEvidenceSnapshots, alertDecisions } from '../src/db/schema.js'
import { count, eq, sql } from 'drizzle-orm'

async function run() {
  const pool = createPool('postgres://postgres:postgres@127.0.0.1:35471/postgres')
  const db = createDb(pool)

  const [checkpointCount] = await db.select({ count: count() }).from(simulationStageCheckpoints)
  const [projectionCount] = await db.select({ count: count() }).from(simulationStageStudentProjections)
  const [riskCount] = await db.select({ count: count() }).from(riskAssessments)
  const [evidenceCount] = await db.select({ count: count() }).from(riskEvidenceSnapshots)
  const [alertCount] = await db.select({ count: count() }).from(alertDecisions)

  console.log(JSON.stringify({
    checkpoints: checkpointCount.count,
    projections: projectionCount.count,
    riskAssessments: riskCount.count,
    evidenceSnapshots: evidenceCount.count,
    alertDecisions: alertCount.count,
  }, null, 2))

  // Get risk band distribution
  const bandDist = await db.select({
    riskBand: riskAssessments.riskBand,
    count: count(),
  }).from(riskAssessments).groupBy(riskAssessments.riskBand)
  console.log('\nRisk Band Distribution:', JSON.stringify(bandDist, null, 2))

  // Get projection risk band distribution
  const projBandDist = await db.select({
    riskBand: simulationStageStudentProjections.riskBand,
    count: count(),
  }).from(simulationStageStudentProjections).groupBy(simulationStageStudentProjections.riskBand)
  console.log('\nProjection Risk Band Distribution:', JSON.stringify(projBandDist, null, 2))

  // Get stage checkpoint breakdown
  const stageDist = await db.select({
    semesterNumber: simulationStageCheckpoints.semesterNumber,
    stageKey: simulationStageCheckpoints.stageKey,
  }).from(simulationStageCheckpoints).orderBy(simulationStageCheckpoints.semesterNumber, simulationStageCheckpoints.stageKey)
  console.log('\nStage Checkpoints:', JSON.stringify(stageDist, null, 2))

  // Sample projections to see risk scores
  const sampleProj = await db.select({
    studentId: simulationStageStudentProjections.studentId,
    offeringId: simulationStageStudentProjections.offeringId,
    riskProbScaled: simulationStageStudentProjections.riskProbScaled,
    riskBand: simulationStageStudentProjections.riskBand,
    noActionRiskProbScaled: simulationStageStudentProjections.noActionRiskProbScaled,
    noActionRiskBand: simulationStageStudentProjections.noActionRiskBand,
    recommendedAction: simulationStageStudentProjections.recommendedAction,
  }).from(simulationStageStudentProjections).limit(10)
  console.log('\nSample Projections (10):', JSON.stringify(sampleProj, null, 2))

  await pool.end()
}
run().catch(console.error)
