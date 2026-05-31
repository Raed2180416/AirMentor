import { createPool, createDb } from '../src/db/client.js'
import { simulationStageCheckpoints, simulationStageStudentProjections, riskAssessments, alertDecisions, studentObservedSemesterStates, students } from '../src/db/schema.js'
import { eq, count, sql, and, inArray, desc, asc } from 'drizzle-orm'
import { writeFileSync } from 'fs'

async function run() {
  const pool = createPool('postgres://postgres:postgres@127.0.0.1:35471/postgres')
  const db = createDb(pool)

  const report: Record<string, unknown> = {}

  // 1. Risk band distribution per semester per stage
  const projByStage = await db.select({
    semesterNumber: simulationStageCheckpoints.semesterNumber,
    stageKey: simulationStageCheckpoints.stageKey,
    riskBand: simulationStageStudentProjections.riskBand,
    count: count(),
  })
    .from(simulationStageStudentProjections)
    .innerJoin(simulationStageCheckpoints, eq(simulationStageStudentProjections.simulationStageCheckpointId, simulationStageCheckpoints.simulationStageCheckpointId))
    .groupBy(simulationStageCheckpoints.semesterNumber, simulationStageCheckpoints.stageKey, simulationStageStudentProjections.riskBand)
    .orderBy(simulationStageCheckpoints.semesterNumber, simulationStageCheckpoints.stageKey)
  report.riskDistributionByStage = projByStage

  // 2. High risk students trajectory — who was high risk in sem 1 and what happened?
  const sem1HighRisk = await db.select({
    studentId: simulationStageStudentProjections.studentId,
    riskProbScaled: simulationStageStudentProjections.riskProbScaled,
  })
    .from(simulationStageStudentProjections)
    .innerJoin(simulationStageCheckpoints, eq(simulationStageStudentProjections.simulationStageCheckpointId, simulationStageCheckpoints.simulationStageCheckpointId))
    .where(and(
      eq(simulationStageCheckpoints.semesterNumber, 1),
      eq(simulationStageCheckpoints.stageKey, 'post-see'),
      eq(simulationStageStudentProjections.riskBand, 'High'),
    ))
  const highRiskStudentIds = [...new Set(sem1HighRisk.map(r => r.studentId))]
  report.sem1HighRiskStudents = { count: highRiskStudentIds.length, ids: highRiskStudentIds.slice(0, 20) }

  // 3. Track those high-risk students across all semesters
  if (highRiskStudentIds.length > 0) {
    const trajectories = await db.select({
      studentId: simulationStageStudentProjections.studentId,
      semesterNumber: simulationStageCheckpoints.semesterNumber,
      stageKey: simulationStageCheckpoints.stageKey,
      riskProbScaled: simulationStageStudentProjections.riskProbScaled,
      riskBand: simulationStageStudentProjections.riskBand,
      noActionRiskProbScaled: simulationStageStudentProjections.noActionRiskProbScaled,
      recommendedAction: simulationStageStudentProjections.recommendedAction,
    })
      .from(simulationStageStudentProjections)
      .innerJoin(simulationStageCheckpoints, eq(simulationStageStudentProjections.simulationStageCheckpointId, simulationStageCheckpoints.simulationStageCheckpointId))
      .where(inArray(simulationStageStudentProjections.studentId, highRiskStudentIds.slice(0, 5)))
      .orderBy(simulationStageStudentProjections.studentId, simulationStageCheckpoints.semesterNumber, simulationStageCheckpoints.stageKey)
    report.highRiskTrajectories = trajectories
  }

  // 4. Average risk score per semester (post-see stage only)
  const avgRiskBySem = await db.select({
    semesterNumber: simulationStageCheckpoints.semesterNumber,
    avgRiskProb: sql<number>`round(avg(${simulationStageStudentProjections.riskProbScaled})::numeric, 1)`,
    maxRiskProb: sql<number>`max(${simulationStageStudentProjections.riskProbScaled})`,
    minRiskProb: sql<number>`min(${simulationStageStudentProjections.riskProbScaled})`,
    highCount: sql<number>`count(*) filter (where ${simulationStageStudentProjections.riskBand} = 'High')`,
    medCount: sql<number>`count(*) filter (where ${simulationStageStudentProjections.riskBand} = 'Medium')`,
    lowCount: sql<number>`count(*) filter (where ${simulationStageStudentProjections.riskBand} = 'Low')`,
  })
    .from(simulationStageStudentProjections)
    .innerJoin(simulationStageCheckpoints, eq(simulationStageStudentProjections.simulationStageCheckpointId, simulationStageCheckpoints.simulationStageCheckpointId))
    .where(eq(simulationStageCheckpoints.stageKey, 'post-see'))
    .groupBy(simulationStageCheckpoints.semesterNumber)
    .orderBy(simulationStageCheckpoints.semesterNumber)
  report.semesterSummary = avgRiskBySem

  // 5. Alert decision distribution
  const alertDist = await db.select({
    decisionType: alertDecisions.decisionType,
    count: count(),
  }).from(alertDecisions).groupBy(alertDecisions.decisionType)
  report.alertDistribution = alertDist

  // 6. Counterfactual lift — how much worse would students be without intervention?
  const liftStats = await db.select({
    semesterNumber: simulationStageCheckpoints.semesterNumber,
    avgLift: sql<number>`round(avg(${simulationStageStudentProjections.noActionRiskProbScaled} - ${simulationStageStudentProjections.riskProbScaled})::numeric, 2)`,
    maxLift: sql<number>`max(${simulationStageStudentProjections.noActionRiskProbScaled} - ${simulationStageStudentProjections.riskProbScaled})`,
  })
    .from(simulationStageStudentProjections)
    .innerJoin(simulationStageCheckpoints, eq(simulationStageStudentProjections.simulationStageCheckpointId, simulationStageCheckpoints.simulationStageCheckpointId))
    .where(eq(simulationStageCheckpoints.stageKey, 'post-see'))
    .groupBy(simulationStageCheckpoints.semesterNumber)
    .orderBy(simulationStageCheckpoints.semesterNumber)
  report.counterfactualLift = liftStats

  // 7. Live risk assessments (sem 6 current)
  const liveRisks = await db.select({
    studentId: riskAssessments.studentId,
    riskProbScaled: riskAssessments.riskProbScaled,
    riskBand: riskAssessments.riskBand,
    recommendedAction: riskAssessments.recommendedAction,
  })
    .from(riskAssessments)
    .where(eq(riskAssessments.riskBand, 'High'))
    .limit(20)
  report.currentHighRiskStudents = liveRisks

  // 8. Observed states sample for high risk
  if (liveRisks.length > 0) {
    const obsRows = await db.select({
      studentId: studentObservedSemesterStates.studentId,
      semesterNumber: studentObservedSemesterStates.semesterNumber,
      sectionCode: studentObservedSemesterStates.sectionCode,
      payloadJson: studentObservedSemesterStates.payloadJson,
    })
      .from(studentObservedSemesterStates)
      .where(and(
        inArray(studentObservedSemesterStates.studentId, liveRisks.slice(0, 3).map(r => r.studentId)),
        eq(studentObservedSemesterStates.semesterNumber, 6),
      ))
      .limit(15)
    report.highRiskObservedStates = obsRows.map(r => ({
      studentId: r.studentId,
      semesterNumber: r.semesterNumber,
      sectionCode: r.sectionCode,
      payload: typeof r.payloadJson === 'string' ? JSON.parse(r.payloadJson) : r.payloadJson,
    }))
  }

  writeFileSync('/home/raed/.gemini/antigravity/brain/657ef0f6-dc88-46e8-bd4a-d77cf56a8fc8/scratch/cohort-analysis-data.json', JSON.stringify(report, null, 2))
  console.log('Written to cohort-analysis-data.json')
  console.log('\n=== SEMESTER SUMMARY (post-SEE) ===')
  console.log(JSON.stringify(avgRiskBySem, null, 2))
  console.log('\n=== ALERT DISTRIBUTION ===')
  console.log(JSON.stringify(alertDist, null, 2))
  console.log('\n=== COUNTERFACTUAL LIFT ===')
  console.log(JSON.stringify(liftStats, null, 2))
  console.log('\n=== CURRENT HIGH RISK (top 10) ===')
  console.log(JSON.stringify(liveRisks.slice(0, 10), null, 2))

  await pool.end()
}
run().catch(console.error)
