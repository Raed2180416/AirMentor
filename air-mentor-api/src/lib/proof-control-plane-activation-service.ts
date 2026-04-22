import { asc, eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  batches,
  simulationRuns,
  simulationStageCheckpoints,
} from '../db/schema.js'
import { buildProofRunStageBoundarySnapshot } from './proof-control-plane-rebuild-context-service.js'

export type ActivateProofOperationalSemesterInput = {
  simulationRunId: string
  semesterNumber: number
  actorFacultyId?: string | null
  now: string
}

export type ProofControlPlaneActivationServiceDeps = {
  emitSimulationAudit: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    actionType: string
    payload: Record<string, unknown>
    createdByFacultyId?: string | null
    now: string
  }) => Promise<void>
  publishOperationalProjection: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    now: string
  }) => Promise<void>
}

export function canActivateProofRunLifecycle(lifecycleState: string | null | undefined) {
  return lifecycleState == null || lifecycleState !== 'stopped'
}

export async function activateProofOperationalSemester(
  db: AppDb,
  input: ActivateProofOperationalSemesterInput,
  deps: ProofControlPlaneActivationServiceDeps,
) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')

  if (input.semesterNumber < run.semesterStart || input.semesterNumber > run.semesterEnd) {
    throw new Error(`Semester ${input.semesterNumber} is outside the proof run range ${run.semesterStart}-${run.semesterEnd}`)
  }

  const checkpointRows = await db.select().from(simulationStageCheckpoints).where(
    eq(simulationStageCheckpoints.simulationRunId, run.simulationRunId),
  ).orderBy(
    asc(simulationStageCheckpoints.semesterNumber),
    asc(simulationStageCheckpoints.stageOrder),
  )
  const availableSemesters = Array.from(new Set(checkpointRows.map(row => row.semesterNumber))).sort((left, right) => left - right)
  if (availableSemesters.length > 0 && !availableSemesters.includes(input.semesterNumber)) {
    throw new Error(`Semester ${input.semesterNumber} is not available for this proof run`)
  }
  const stageBoundary = buildProofRunStageBoundarySnapshot(checkpointRows)
  if (!stageBoundary.strictlyMonotonic) {
    throw new Error('Simulation run stage boundaries are invalid')
  }
  if (!canActivateProofRunLifecycle(run.lifecycleState)) {
    throw new Error('Stopped proof runs must be restored before activation')
  }

  const previousOperationalSemester = run.activeOperationalSemester ?? run.semesterEnd ?? null
  const previousLifecycleState = run.lifecycleState ?? null
  const semesterBoundary = stageBoundary.semesters.find(item => item.semesterNumber === input.semesterNumber) ?? null
  const targetStageKey = semesterBoundary?.entryStageKey ?? run.activeStageKey ?? 'pre-tt1'

  await db.update(simulationRuns).set({
    activeOperationalSemester: input.semesterNumber,
    activeStageKey: targetStageKey,
    simulatedDateIso: run.simulatedDateIso ?? input.now,
    lifecycleState: 'active',
    stageBoundaryJson: JSON.stringify(stageBoundary),
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, run.simulationRunId))
  await db.update(batches).set({
    currentSemester: input.semesterNumber,
    updatedAt: input.now,
  }).where(eq(batches.batchId, run.batchId))

  if (run.activeFlag === 1) {
    await deps.publishOperationalProjection(db, {
      simulationRunId: run.simulationRunId,
      batchId: run.batchId,
      now: input.now,
    })
  }

  await deps.emitSimulationAudit(db, {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    actionType: 'semester-activated',
    payload: {
      previousOperationalSemester,
      activeOperationalSemester: input.semesterNumber,
      previousLifecycleState,
      lifecycleState: 'active',
      activeStageKey: targetStageKey,
      availableSemesters,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })

  return {
    ok: true as const,
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    activeOperationalSemester: input.semesterNumber,
    previousOperationalSemester,
  }
}
