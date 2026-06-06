import { and, desc, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  riskEvidenceSnapshots,
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationStageQueueCases,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  studentAgentCards,
  studentAgentMessages,
  studentAgentSessions,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import { parseJson } from './json.js'

type PlaybackResetSnapshotPayload = {
  snapshotType?: string | null
  curriculumImportVersionId?: string | null
  seed?: number | null
  policySnapshot?: ResolvedPolicy | null
  runAuthority?: {
    activeOperationalSemester?: number | null
    activeStageKey?: string | null
    lifecycleState?: string | null
    simulatedDateIso?: string | null
    stageBoundary?: unknown
  }
}

export type ProofPlaybackResetServiceDeps = {
  emitSimulationAudit: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    actionType: string
    payload: Record<string, unknown>
    createdByFacultyId?: string | null
    now: string
  }) => Promise<void>
  publishOperationalProjection?: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    now: string
  }) => Promise<void>
  rebuildSimulationStagePlayback?: (db: AppDb, input: {
    simulationRunId: string
    policy: ResolvedPolicy
    now: string
  }) => Promise<unknown>
  startProofSimulationRun?: (db: AppDb, input: {
    batchId: string
    curriculumImportVersionId: string
    policy: ResolvedPolicy
    curriculumFeatureProfileId?: string | null
    curriculumFeatureProfileFingerprint?: string | null
    actorFacultyId?: string | null
    now: string
    seed?: number
    runLabel?: string
    parentSimulationRunId?: string | null
    activate?: boolean
    skipArtifactRebuild?: boolean
    skipActiveRiskRecompute?: boolean
  }) => Promise<{
    simulationRunId: string
    activeFlag: boolean
  }>
  deleteProofCredentials?: (db: AppDb, batchId: string) => Promise<{ deletedCount: number }>
  invalidateProofBatchSessions?: (db: AppDb, batchId: string, demoWorkspaceId?: string | null) => Promise<void>
}

export type ResetCurrentProofStageInput = {
  simulationRunId: string
  actorFacultyId?: string | null
  now: string
  simulationResetSnapshotId?: string
  policy?: ResolvedPolicy
}

export type CompleteProofSimulationResetInput = {
  simulationRunId: string
  actorFacultyId?: string | null
  now: string
  simulationResetSnapshotId?: string
  policy?: ResolvedPolicy
}

export type StopProofSimulationRunInput = {
  simulationRunId: string
  actorFacultyId?: string | null
  now: string
}

function parsePlaybackResetSnapshotPayload(row: typeof simulationResetSnapshots.$inferSelect) {
  return parseJson(row.snapshotJson, {} as PlaybackResetSnapshotPayload)
}

function stageSnapshotMatchesRun(
  payload: PlaybackResetSnapshotPayload,
  run: Pick<typeof simulationRuns.$inferSelect, 'activeOperationalSemester' | 'activeStageKey'>,
) {
  return payload.runAuthority?.activeOperationalSemester === run.activeOperationalSemester
    && payload.runAuthority?.activeStageKey === run.activeStageKey
}

export function resolveCurrentStageResetSnapshot(input: {
  snapshots: Array<typeof simulationResetSnapshots.$inferSelect>
  run: Pick<typeof simulationRuns.$inferSelect, 'activeOperationalSemester' | 'activeStageKey'>
  simulationResetSnapshotId?: string
}) {
  if (input.simulationResetSnapshotId) {
    return input.snapshots.find(row => row.simulationResetSnapshotId === input.simulationResetSnapshotId) ?? null
  }
  return input.snapshots.find(row => {
    const payload = parsePlaybackResetSnapshotPayload(row)
    return stageSnapshotMatchesRun(payload, input.run)
  }) ?? null
}

function resolveCompleteResetSnapshot(input: {
  snapshots: Array<typeof simulationResetSnapshots.$inferSelect>
  simulationResetSnapshotId?: string
}) {
  if (input.simulationResetSnapshotId) {
    return input.snapshots.find(row => row.simulationResetSnapshotId === input.simulationResetSnapshotId) ?? null
  }
  return input.snapshots.find(row => row.snapshotLabel.toLowerCase().includes('baseline')) ?? input.snapshots.at(-1) ?? null
}

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
      inArray(riskEvidenceSnapshots.simulationStageCheckpointId, checkpointIds),
    ))
  }
  if (checkpointIds.length > 0) {
    await db.delete(simulationStageQueueProjections).where(inArray(
      simulationStageQueueProjections.simulationStageCheckpointId,
      checkpointIds,
    ))
    await db.delete(simulationStageQueueCases).where(inArray(
      simulationStageQueueCases.simulationStageCheckpointId,
      checkpointIds,
    ))
    await db.delete(simulationStageOfferingProjections).where(inArray(
      simulationStageOfferingProjections.simulationStageCheckpointId,
      checkpointIds,
    ))
    await db.delete(simulationStageStudentProjections).where(inArray(
      simulationStageStudentProjections.simulationStageCheckpointId,
      checkpointIds,
    ))
    await db.delete(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, simulationRunId))
  }
}

export async function resetCurrentProofStage(
  db: AppDb,
  input: ResetCurrentProofStageInput,
  deps: ProofPlaybackResetServiceDeps,
) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const snapshotRows = await db.select().from(simulationResetSnapshots).where(
    eq(simulationResetSnapshots.simulationRunId, run.simulationRunId),
  ).orderBy(desc(simulationResetSnapshots.createdAt))
  const snapshot = resolveCurrentStageResetSnapshot({
    snapshots: snapshotRows,
    run,
    simulationResetSnapshotId: input.simulationResetSnapshotId,
  })
  if (!snapshot) throw new Error('Stage entry snapshot not found')

  const payload = parsePlaybackResetSnapshotPayload(snapshot)
  const restoredAuthority = payload.runAuthority ?? {}
  await resetPlaybackStageArtifacts(db, run.simulationRunId)
  await db.update(simulationRuns).set({
    activeOperationalSemester: restoredAuthority.activeOperationalSemester ?? run.activeOperationalSemester,
    activeStageKey: restoredAuthority.activeStageKey ?? run.activeStageKey,
    simulatedDateIso: restoredAuthority.simulatedDateIso ?? run.simulatedDateIso ?? input.now,
    lifecycleState: run.activeFlag === 1 ? 'active' : (restoredAuthority.lifecycleState ?? run.lifecycleState),
    stageBoundaryJson: restoredAuthority.stageBoundary == null
      ? run.stageBoundaryJson
      : JSON.stringify(restoredAuthority.stageBoundary),
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, run.simulationRunId))

  if (deps.rebuildSimulationStagePlayback && input.policy) {
    await deps.rebuildSimulationStagePlayback(db, {
      simulationRunId: run.simulationRunId,
      policy: input.policy,
      now: input.now,
    })
  }
  if (run.activeFlag === 1 && deps.publishOperationalProjection) {
    await deps.publishOperationalProjection(db, {
      simulationRunId: run.simulationRunId,
      batchId: run.batchId,
      now: input.now,
    })
  }
  await deps.emitSimulationAudit(db, {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    actionType: 'reset-current-stage',
    payload: {
      simulationResetSnapshotId: snapshot.simulationResetSnapshotId,
      activeOperationalSemester: restoredAuthority.activeOperationalSemester ?? run.activeOperationalSemester,
      activeStageKey: restoredAuthority.activeStageKey ?? run.activeStageKey,
      simulatedDateIso: restoredAuthority.simulatedDateIso ?? run.simulatedDateIso ?? input.now,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })
  return {
    ok: true as const,
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    simulationResetSnapshotId: snapshot.simulationResetSnapshotId,
    activeOperationalSemester: restoredAuthority.activeOperationalSemester ?? run.activeOperationalSemester,
    activeStageKey: restoredAuthority.activeStageKey ?? run.activeStageKey,
    simulatedDateIso: restoredAuthority.simulatedDateIso ?? run.simulatedDateIso ?? input.now,
  }
}

export async function completeProofSimulationReset(
  db: AppDb,
  input: CompleteProofSimulationResetInput,
  deps: ProofPlaybackResetServiceDeps,
) {
  if (!deps.startProofSimulationRun) {
    throw new Error('Complete reset dependencies are not configured')
  }
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const snapshotRows = await db.select().from(simulationResetSnapshots).where(
    eq(simulationResetSnapshots.simulationRunId, run.simulationRunId),
  ).orderBy(desc(simulationResetSnapshots.createdAt))
  const snapshot = resolveCompleteResetSnapshot({
    snapshots: snapshotRows,
    simulationResetSnapshotId: input.simulationResetSnapshotId,
  })
  if (!snapshot) throw new Error('Simulation snapshot not found')
  const payload = parsePlaybackResetSnapshotPayload(snapshot)
  const curriculumImportVersionId = String(payload.curriculumImportVersionId ?? run.curriculumImportVersionId ?? '')
  if (!curriculumImportVersionId) throw new Error('Simulation snapshot is missing its curriculum import version')
  const policy = input.policy ?? payload.policySnapshot
  if (!policy) throw new Error('Simulation snapshot is missing its policy payload')

  const recreated = await deps.startProofSimulationRun(db, {
    batchId: run.batchId,
    curriculumImportVersionId,
    policy,
    curriculumFeatureProfileId: run.curriculumFeatureProfileId ?? null,
    curriculumFeatureProfileFingerprint: run.curriculumFeatureProfileFingerprint ?? null,
    actorFacultyId: input.actorFacultyId ?? null,
    now: input.now,
    seed: Number(payload.seed ?? run.seed),
    runLabel: `${run.runLabel} reset`,
    parentSimulationRunId: run.simulationRunId,
    activate: true,
  })
  await deps.emitSimulationAudit(db, {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    actionType: 'complete-reset',
    payload: {
      simulationResetSnapshotId: snapshot.simulationResetSnapshotId,
      recreatedSimulationRunId: recreated.simulationRunId,
      curriculumImportVersionId,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })
  return {
    ok: true as const,
    batchId: run.batchId,
    sourceSimulationRunId: run.simulationRunId,
    simulationRunId: recreated.simulationRunId,
  }
}

export async function stopProofSimulationRun(
  db: AppDb,
  input: StopProofSimulationRunInput,
  deps: ProofPlaybackResetServiceDeps,
) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')

  await db.update(simulationRuns).set({
    activeFlag: 0,
    lifecycleState: 'stopped',
    status: run.status === 'active' ? 'completed' : run.status,
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, run.simulationRunId))

  const credentialSweep = deps.deleteProofCredentials
    ? await deps.deleteProofCredentials(db, run.batchId)
    : { deletedCount: 0 }
  if (deps.invalidateProofBatchSessions) {
    await deps.invalidateProofBatchSessions(db, run.batchId, run.demoWorkspaceId ?? null)
  }

  await deps.emitSimulationAudit(db, {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    actionType: 'stopped',
    payload: {
      previousLifecycleState: run.lifecycleState ?? null,
      deletedCredentialCount: credentialSweep.deletedCount,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })

  return {
    ok: true as const,
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    deletedCredentialCount: credentialSweep.deletedCount,
  }
}
