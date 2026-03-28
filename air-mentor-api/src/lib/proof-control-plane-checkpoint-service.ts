import {
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
} from '../db/schema.js'
import { parseJson } from './json.js'
import type { ProofCheckpointSummaryPayload } from './msruas-proof-control-plane.js'

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

export function stageSummaryPayload(input: {
  checkpoint: typeof simulationStageCheckpoints.$inferInsert
  studentRows: Array<typeof simulationStageStudentProjections.$inferInsert>
  queueRows: Array<typeof simulationStageQueueProjections.$inferInsert>
  offeringRows: Array<typeof simulationStageOfferingProjections.$inferInsert>
  electiveVisibleCount: number
}) {
  const queueDetails = input.queueRows.map(row => ({
    row,
    detail: parseJson(row.detailJson, {} as Record<string, unknown>),
  }))
  const highRiskCount = input.studentRows.filter(row => row.riskBand === 'High').length
  const mediumRiskCount = input.studentRows.filter(row => row.riskBand === 'Medium').length
  const openQueueCount = queueDetails.filter(item =>
    item.row.status === 'Open'
    && Boolean(item.detail.primaryCase)
    && Boolean(item.detail.countsTowardCapacity)).length
  const watchQueueCount = input.queueRows.filter(row => row.status === 'Watching').length
  const resolvedQueueCount = input.queueRows.filter(row => row.status === 'Resolved').length
  const watchStudentCount = new Set(
    input.studentRows
      .filter(row => row.queueState === 'watch')
      .map(row => row.studentId),
  ).size
  const averageRiskDeltaScaled = roundToOne(average(
    input.studentRows.map(row => {
      const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
      return Number(payload.riskChangeFromPreviousCheckpointScaled ?? payload.riskDeltaScaled ?? 0)
    }),
  ))
  const averageCounterfactualLiftScaled = roundToOne(average(
    input.studentRows.map(row => {
      const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
      return Number(payload.counterfactualLiftScaled ?? ((payload.noActionComparator as Record<string, unknown> | undefined)?.deltaScaled ?? 0))
    }),
  ))
  return {
    simulationStageCheckpointId: input.checkpoint.simulationStageCheckpointId,
    simulationRunId: input.checkpoint.simulationRunId,
    semesterNumber: input.checkpoint.semesterNumber,
    stageKey: input.checkpoint.stageKey,
    stageLabel: input.checkpoint.stageLabel,
    stageDescription: input.checkpoint.stageDescription,
    stageOrder: input.checkpoint.stageOrder,
    previousCheckpointId: input.checkpoint.previousCheckpointId ?? null,
    nextCheckpointId: input.checkpoint.nextCheckpointId ?? null,
    totalStudentProjectionCount: input.studentRows.length,
    studentCount: new Set(input.studentRows.map(row => row.studentId)).size,
    offeringCount: input.offeringRows.length,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount: input.studentRows.length - highRiskCount - mediumRiskCount,
    openQueueCount,
    watchQueueCount,
    watchStudentCount,
    resolvedQueueCount,
    noActionHighRiskCount: input.studentRows.filter(row => row.noActionRiskBand === 'High').length,
    electiveVisibleCount: input.electiveVisibleCount,
    averageRiskDeltaScaled,
    averageRiskChangeFromPreviousCheckpointScaled: averageRiskDeltaScaled,
    averageCounterfactualLiftScaled,
    stageAdvanceBlocked: openQueueCount > 0,
    blockingQueueItemCount: openQueueCount,
  }
}

export function queueStatusPriority(status: string | null | undefined) {
  if (status === 'Open') return 2
  if (status === 'Watching') return 1
  if (status === 'Resolved') return 0
  return -1
}

export function queueProjectionDetail(
  row: typeof simulationStageQueueProjections.$inferSelect | typeof simulationStageQueueProjections.$inferInsert,
) {
  return parseJson(row.detailJson, {} as Record<string, unknown>)
}

export function queueProjectionAssignedFacultyId(
  row: typeof simulationStageQueueProjections.$inferSelect | typeof simulationStageQueueProjections.$inferInsert,
) {
  if (row.assignedFacultyId) return row.assignedFacultyId
  const detail = queueProjectionDetail(row)
  return typeof detail.assignedFacultyId === 'string' ? detail.assignedFacultyId : null
}

export function parseProofCheckpointSummary(
  row: typeof simulationStageCheckpoints.$inferSelect,
): ProofCheckpointSummaryPayload {
  return parseJson(row.summaryJson, {
    simulationStageCheckpointId: row.simulationStageCheckpointId,
    simulationRunId: row.simulationRunId,
    semesterNumber: row.semesterNumber,
    stageKey: row.stageKey,
    stageLabel: row.stageLabel,
    stageDescription: row.stageDescription,
    stageOrder: row.stageOrder,
    previousCheckpointId: row.previousCheckpointId ?? null,
    nextCheckpointId: row.nextCheckpointId ?? null,
  } satisfies ProofCheckpointSummaryPayload)
}

export function withProofPlaybackGate(summaries: ProofCheckpointSummaryPayload[]) {
  const firstBlockedIndex = summaries.findIndex(summary => Number(summary.blockingQueueItemCount ?? summary.openQueueCount ?? 0) > 0)
  return summaries.map((summary, index) => {
    const stageAdvanceBlocked = Number(summary.blockingQueueItemCount ?? summary.openQueueCount ?? 0) > 0
    const playbackAccessible = firstBlockedIndex === -1 || index <= firstBlockedIndex
    const blockedByCheckpointId = firstBlockedIndex !== -1 && index > firstBlockedIndex
      ? summaries[firstBlockedIndex]?.simulationStageCheckpointId ?? null
      : null
    return {
      ...summary,
      stageAdvanceBlocked,
      blockingQueueItemCount: Number(summary.blockingQueueItemCount ?? summary.openQueueCount ?? 0),
      playbackAccessible,
      blockedByCheckpointId,
      blockedProgressionReason: !playbackAccessible && blockedByCheckpointId
        ? `Playback is blocked until all queue items for checkpoint ${blockedByCheckpointId} are resolved.`
        : stageAdvanceBlocked
          ? 'Playback cannot advance past this checkpoint until all queue items are resolved.'
          : null,
    }
  })
}
