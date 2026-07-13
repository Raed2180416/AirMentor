/**
 * computeConfigImpactPreview — project the risk-distribution impact of a
 * proposed curriculum-feature outcome change against the active proof run.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import {
  curriculumCourses,
  curriculumNodes,
  riskEvidenceSnapshots,
  simulationRuns,
  studentCoStates,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { parseJson } from '../../../../lib/json.js'
import { inferObservableRisk } from '../../../../lib/inference-engine.js'
import { BLOOM_LEVEL_MASTERY_TARGET, MASTERY_WEAKNESS_RATIO } from '../../../../lib/learning-dynamics-constants.js'
import { DEFAULT_POLICY } from '../../../../application/use-cases/admin-structure/resolved-policy.js'
import { findCurriculumNodeForCourse } from './curriculum-import-core.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'

export async function computeConfigImpactPreview(context: RouteContext, input: {
  batchId: string
  curriculumCourseId: string
  proposedOutcomes: Array<{ id: string; bloom: string }>
}) {
  const [courseRow] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, input.curriculumCourseId))
  if (!courseRow || courseRow.batchId !== input.batchId) return null

  const nodeRows = await context.db.select().from(curriculumNodes)
  const nodeRow = findCurriculumNodeForCourse(nodeRows, courseRow)
  if (!nodeRow) return null

  const runRows = await context.db.select().from(simulationRuns)
    .where(and(eq(simulationRuns.batchId, input.batchId), isNotNull(simulationRuns.activeFlag)))
    .orderBy(desc(simulationRuns.updatedAt))
  const activeRun = runRows.find(r => r.status === 'active') ?? runRows[0] ?? null
  if (!activeRun) return null

  const coRows = await context.db.select().from(studentCoStates)
    .where(and(
      eq(studentCoStates.simulationRunId, activeRun.simulationRunId),
      eq(studentCoStates.curriculumNodeId, nodeRow.curriculumNodeId),
    ))

  const cosByStudent = new Map<string, Array<{ coCode: string; mastery: number }>>()
  for (const row of coRows) {
    const state = parseJson(row.stateJson, {} as Record<string, unknown>)
    const mastery = typeof state.coMasteryEstimate === 'number' ? state.coMasteryEstimate : 0
    const list = cosByStudent.get(row.studentId) ?? []
    list.push({ coCode: row.coCode, mastery })
    cosByStudent.set(row.studentId, list)
  }
  if (cosByStudent.size === 0) return null

  const resolvedFeatures = await resolveBatchCurriculumFeatures(context, input.batchId)
  const currentItem = resolvedFeatures.items.find(item => item.curriculumCourseId === input.curriculumCourseId)
  const currentOutcomes = currentItem?.resolvedConfig.outcomes ?? []

  const bloomToTarget = (bloom: string): number =>
    BLOOM_LEVEL_MASTERY_TARGET[bloom as keyof typeof BLOOM_LEVEL_MASTERY_TARGET] ?? BLOOM_LEVEL_MASTERY_TARGET.apply

  const currentTargets = currentOutcomes.map(o => bloomToTarget(o.bloom))
  const proposedTargets = input.proposedOutcomes.map(o => bloomToTarget(o.bloom))

  const evidenceRows = await context.db.select({
    studentId: riskEvidenceSnapshots.studentId,
    featureJson: riskEvidenceSnapshots.featureJson,
    createdAt: riskEvidenceSnapshots.createdAt,
  }).from(riskEvidenceSnapshots)
    .where(and(
      eq(riskEvidenceSnapshots.simulationRunId, activeRun.simulationRunId),
      eq(riskEvidenceSnapshots.batchId, input.batchId),
    ))
    .orderBy(desc(riskEvidenceSnapshots.createdAt))

  const latestEvidenceByStudent = new Map<string, Record<string, unknown>>()
  for (const row of evidenceRows) {
    if (!latestEvidenceByStudent.has(row.studentId)) {
      latestEvidenceByStudent.set(row.studentId, parseJson(row.featureJson, {} as Record<string, unknown>))
    }
  }

  const policy = DEFAULT_POLICY

  type BandCount = { Low: number; Medium: number; High: number }
  const current: BandCount = { Low: 0, Medium: 0, High: 0 }
  const projected: BandCount = { Low: 0, Medium: 0, High: 0 }
  const affectedStudents: Array<{
    studentId: string
    currentRiskBand: string
    projectedRiskBand: string
    currentWeakCoCount: number
    projectedWeakCoCount: number
  }> = []

  for (const [studentId, cos] of cosByStudent) {
    const evidence = latestEvidenceByStudent.get(studentId)
    if (!evidence) continue

    const currentWeak = cos.filter((co, i) =>
      co.mastery < (currentTargets[i] ?? BLOOM_LEVEL_MASTERY_TARGET.apply) * MASTERY_WEAKNESS_RATIO,
    ).length
    const proposedWeak = cos.filter((co, i) =>
      co.mastery < (proposedTargets[i] ?? BLOOM_LEVEL_MASTERY_TARGET.apply) * MASTERY_WEAKNESS_RATIO,
    ).length

    const attendance = typeof evidence.attendancePct === 'number' ? evidence.attendancePct : 75
    const cgpa = typeof evidence.currentCgpa === 'number' ? evidence.currentCgpa : 6.0
    const backlog = typeof evidence.backlogCount === 'number' ? evidence.backlogCount : 0

    const currentInfer = inferObservableRisk({
      attendancePct: attendance,
      currentCgpa: cgpa,
      backlogCount: backlog,
      tt1Pct: typeof evidence.tt1Pct === 'number' ? evidence.tt1Pct : null,
      tt2Pct: typeof evidence.tt2Pct === 'number' ? evidence.tt2Pct : null,
      seePct: typeof evidence.seePct === 'number' ? evidence.seePct : null,
      quizPct: typeof evidence.quizPct === 'number' ? evidence.quizPct : null,
      assignmentPct: typeof evidence.assignmentPct === 'number' ? evidence.assignmentPct : null,
      weakCoCount: currentWeak,
      attendanceHistoryRiskCount: typeof evidence.attendanceHistoryRiskCount === 'number' ? evidence.attendanceHistoryRiskCount : 0,
      questionWeaknessCount: typeof evidence.weakQuestionCount === 'number' ? evidence.weakQuestionCount : 0,
      interventionResponseScore: typeof evidence.interventionResponseScore === 'number' ? evidence.interventionResponseScore : null,
      policy,
    })
    const projectedInfer = proposedWeak === currentWeak ? currentInfer : inferObservableRisk({
      attendancePct: attendance,
      currentCgpa: cgpa,
      backlogCount: backlog,
      tt1Pct: typeof evidence.tt1Pct === 'number' ? evidence.tt1Pct : null,
      tt2Pct: typeof evidence.tt2Pct === 'number' ? evidence.tt2Pct : null,
      seePct: typeof evidence.seePct === 'number' ? evidence.seePct : null,
      quizPct: typeof evidence.quizPct === 'number' ? evidence.quizPct : null,
      assignmentPct: typeof evidence.assignmentPct === 'number' ? evidence.assignmentPct : null,
      weakCoCount: proposedWeak,
      attendanceHistoryRiskCount: typeof evidence.attendanceHistoryRiskCount === 'number' ? evidence.attendanceHistoryRiskCount : 0,
      questionWeaknessCount: typeof evidence.weakQuestionCount === 'number' ? evidence.weakQuestionCount : 0,
      interventionResponseScore: typeof evidence.interventionResponseScore === 'number' ? evidence.interventionResponseScore : null,
      policy,
    })

    current[currentInfer.riskBand]++
    projected[projectedInfer.riskBand]++

    if (currentInfer.riskBand !== projectedInfer.riskBand || currentWeak !== proposedWeak) {
      affectedStudents.push({
        studentId,
        currentRiskBand: currentInfer.riskBand,
        projectedRiskBand: projectedInfer.riskBand,
        currentWeakCoCount: currentWeak,
        projectedWeakCoCount: proposedWeak,
      })
    }
  }

  const total = Math.max(1, cosByStudent.size)
  return {
    studentCount: cosByStudent.size,
    currentDistribution: {
      low: Math.round((current.Low / total) * 100) / 100,
      medium: Math.round((current.Medium / total) * 100) / 100,
      high: Math.round((current.High / total) * 100) / 100,
    },
    projectedDistribution: {
      low: Math.round((projected.Low / total) * 100) / 100,
      medium: Math.round((projected.Medium / total) * 100) / 100,
      high: Math.round((projected.High / total) * 100) / 100,
    },
    delta: {
      low: Math.round(((projected.Low - current.Low) / total) * 100) / 100,
      medium: Math.round(((projected.Medium - current.Medium) / total) * 100) / 100,
      high: Math.round(((projected.High - current.High) / total) * 100) / 100,
    },
    affectedStudents: affectedStudents.slice(0, 50),
  }
}
