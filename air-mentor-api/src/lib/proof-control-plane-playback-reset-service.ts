import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  riskEvidenceSnapshots,
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationStageQueueCases,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  studentAgentCards,
  studentAgentMessages,
  studentAgentSessions,
} from '../db/schema.js'

export async function resetPlaybackStageArtifacts(
  db: AppDb,
  simulationRunId: string,
) {
  const [existingCards, existingSessions, existingCheckpoints, existingStageEvidenceRows] = await Promise.all([
    db.select().from(studentAgentCards).where(eq(studentAgentCards.simulationRunId, simulationRunId)),
    db.select().from(studentAgentSessions).where(eq(studentAgentSessions.simulationRunId, simulationRunId)),
    db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, simulationRunId)),
    db.select().from(riskEvidenceSnapshots).where(eq(riskEvidenceSnapshots.simulationRunId, simulationRunId)),
  ])

  const stageCardIds = existingCards
    .filter(row => !!row.simulationStageCheckpointId)
    .map(row => row.studentAgentCardId)
  const stageSessionIds = existingSessions
    .filter(row => !!row.simulationStageCheckpointId)
    .map(row => row.studentAgentSessionId)
  const checkpointIds = existingCheckpoints.map(row => row.simulationStageCheckpointId)
  const stageEvidenceIds = existingStageEvidenceRows
    .filter(row => !!row.simulationStageCheckpointId)
    .map(row => row.riskEvidenceSnapshotId)

  if (stageSessionIds.length > 0) {
    await db.delete(studentAgentMessages).where(inArray(studentAgentMessages.studentAgentSessionId, stageSessionIds))
    await db.delete(studentAgentSessions).where(inArray(studentAgentSessions.studentAgentSessionId, stageSessionIds))
  }
  if (stageCardIds.length > 0) {
    await db.delete(studentAgentCards).where(inArray(studentAgentCards.studentAgentCardId, stageCardIds))
  }
  if (stageEvidenceIds.length > 0) {
    await db.delete(riskEvidenceSnapshots).where(and(
      eq(riskEvidenceSnapshots.simulationRunId, simulationRunId),
      isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
    ))
  }
  if (checkpointIds.length > 0) {
    await db.delete(simulationStageQueueProjections).where(eq(simulationStageQueueProjections.simulationRunId, simulationRunId))
    await db.delete(simulationStageQueueCases).where(eq(simulationStageQueueCases.simulationRunId, simulationRunId))
    await db.delete(simulationStageOfferingProjections).where(eq(simulationStageOfferingProjections.simulationRunId, simulationRunId))
    await db.delete(simulationStageStudentProjections).where(eq(simulationStageStudentProjections.simulationRunId, simulationRunId))
    await db.delete(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, simulationRunId))
  }
}
