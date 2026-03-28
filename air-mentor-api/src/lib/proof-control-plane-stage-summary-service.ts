import {
  electiveRecommendations,
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
} from '../db/schema.js'
import type { StageCourseProjectionSource } from './msruas-proof-control-plane.js'

export type ProofControlPlaneStageSummaryServiceDeps = {
  average: (values: number[]) => number
  buildDeterministicId: (prefix: string, parts: Array<string | number>) => string
  parseJson: <T>(value: string | null | undefined, fallback: T) => T
  roundToOne: (value: number) => number
  stageSummaryPayload: (input: {
    checkpoint: typeof simulationStageCheckpoints.$inferInsert
    studentRows: Array<typeof simulationStageStudentProjections.$inferInsert>
    queueRows: Array<typeof simulationStageQueueProjections.$inferInsert>
    offeringRows: Array<typeof simulationStageOfferingProjections.$inferInsert>
    electiveVisibleCount: number
  }) => Record<string, unknown>
}

export type BuildPlaybackStageSummariesInput = {
  simulationRunId: string
  now: string
  checkpointBySemesterStage: Map<string, typeof simulationStageCheckpoints.$inferInsert>
  orderedCheckpointRows: Array<typeof simulationStageCheckpoints.$inferInsert>
  studentProjectionRows: Array<typeof simulationStageStudentProjections.$inferInsert>
  queueProjectionRows: Array<typeof simulationStageQueueProjections.$inferInsert>
  sources: StageCourseProjectionSource[]
  electiveRows: Array<typeof electiveRecommendations.$inferSelect>
}

export type BuildPlaybackStageSummariesResult = {
  checkpointRows: Array<typeof simulationStageCheckpoints.$inferInsert>
  offeringProjectionRows: Array<typeof simulationStageOfferingProjections.$inferInsert>
}

export function buildPlaybackStageSummaries(
  input: BuildPlaybackStageSummariesInput,
  deps: ProofControlPlaneStageSummaryServiceDeps,
): BuildPlaybackStageSummariesResult {
  const offeringProjectionRows: Array<typeof simulationStageOfferingProjections.$inferInsert> = []
  const offeringGroups = new Map<string, Array<typeof simulationStageStudentProjections.$inferInsert>>()
  input.studentProjectionRows.forEach(row => {
    const key = `${row.simulationStageCheckpointId}::${row.offeringId ?? row.courseCode}::${row.sectionCode}`
    offeringGroups.set(key, [...(offeringGroups.get(key) ?? []), row])
  })

  offeringGroups.forEach(rows => {
    const first = rows[0]
    if (!first) return
    const firstProjection = deps.parseJson(first.projectionJson, {} as Record<string, unknown>)
    const checkpoint = input.checkpointBySemesterStage.get(`${first.semesterNumber}::${String(firstProjection.stageKey ?? '')}`)
      ?? input.orderedCheckpointRows.find(row => row.simulationStageCheckpointId === first.simulationStageCheckpointId)
    if (!checkpoint) return

    const pendingAction = [...new Set(rows.map(row => row.simulatedActionTaken).filter((value): value is string => !!value))][0] ?? null
    const projectionJson = {
      averageRiskProbScaled: deps.roundToOne(deps.average(rows.map(row => row.riskProbScaled))),
      highRiskCount: rows.filter(row => row.riskBand === 'High').length,
      mediumRiskCount: rows.filter(row => row.riskBand === 'Medium').length,
      openQueueCount: input.queueProjectionRows.filter(row =>
        row.simulationStageCheckpointId === first.simulationStageCheckpointId
        && row.courseCode === first.courseCode
        && row.sectionCode === first.sectionCode
        && row.status === 'Open').length,
      studentCount: rows.length,
      averageAttendancePct: deps.roundToOne(deps.average(rows.map(row => {
        const payload = deps.parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.attendancePct ?? 0)
      }))),
      averageTt1Pct: deps.roundToOne(deps.average(rows.map(row => {
        const payload = deps.parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.tt1Pct ?? 0)
      }))),
      averageTt2Pct: deps.roundToOne(deps.average(rows.map(row => {
        const payload = deps.parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.tt2Pct ?? 0)
      }))),
      averageSeePct: deps.roundToOne(deps.average(rows.map(row => {
        const payload = deps.parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.seePct ?? 0)
      }))),
      pendingAction,
    }

    offeringProjectionRows.push({
      simulationStageOfferingProjectionId: deps.buildDeterministicId('stage_offering_projection', [first.simulationStageCheckpointId, first.offeringId ?? first.courseCode, first.sectionCode]),
      simulationStageCheckpointId: first.simulationStageCheckpointId,
      simulationRunId: input.simulationRunId,
      offeringId: first.offeringId,
      curriculumNodeId: input.sources.find(source =>
        source.studentId === first.studentId
        && source.semesterNumber === first.semesterNumber
        && source.courseCode === first.courseCode
        && source.sectionCode === first.sectionCode)?.curriculumNodeId ?? null,
      semesterNumber: first.semesterNumber,
      sectionCode: first.sectionCode,
      courseCode: first.courseCode,
      courseTitle: first.courseTitle,
      stage: checkpoint.stageOrder,
      stageLabel: checkpoint.stageLabel,
      stageDescription: checkpoint.stageDescription,
      pendingAction,
      projectionJson: JSON.stringify(projectionJson),
      createdAt: input.now,
      updatedAt: input.now,
    })
  })

  input.orderedCheckpointRows.forEach(checkpoint => {
    const checkpointStudentRows = input.studentProjectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
    const checkpointQueueRows = input.queueProjectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
    const checkpointOfferingRows = offeringProjectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
    const electiveVisibleCount = checkpoint.stageKey === 'post-see'
      ? input.electiveRows.length
      : 0
    checkpoint.summaryJson = JSON.stringify(deps.stageSummaryPayload({
      checkpoint,
      studentRows: checkpointStudentRows,
      queueRows: checkpointQueueRows,
      offeringRows: checkpointOfferingRows,
      electiveVisibleCount,
    }))
  })

  return {
    checkpointRows: input.orderedCheckpointRows,
    offeringProjectionRows,
  }
}
