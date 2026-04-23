import { asc, eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import { parseJson } from './json.js'
import { playbackCheckpointNowIso } from './proof-control-plane-playback-service.js'
import {
  buildProofRunStageBoundarySnapshot,
  type ProofRunStageBoundarySnapshot,
} from './proof-control-plane-rebuild-context-service.js'
import {
  DEFAULT_STAGE_POLICY,
  stagePolicyStageByKey,
  stagePolicyStageKeyValues,
  type StagePolicyPayload,
  type StagePolicyStageKey,
} from './stage-policy.js'
import { STAGE_REALIZATION_FLAG_NAME } from './proof-stage-realization-evidence-applier.js'

// Phase-6c audit payload builder. Exported so unit tests can exercise the payload
// shape without standing up a full DB mock. persistResolvedAdvance passes the same
// resolution object in.
export type StageRealizationAppliedAuditPayload = {
  transitionFrom: { semesterNumber: number; stageKey: StagePolicyStageKey }
  transitionTo: { semesterNumber: number; stageKey: StagePolicyStageKey }
  crossedSemesterBoundary: boolean
  realizationFlag: string
  note: string
}

export function buildStageRealizationAppliedAuditPayload(input: {
  resolution: ProofAdvanceResolution
}): StageRealizationAppliedAuditPayload {
  return {
    transitionFrom: {
      semesterNumber: input.resolution.previous.semesterNumber,
      stageKey: input.resolution.previous.stageKey,
    },
    transitionTo: {
      semesterNumber: input.resolution.current.semesterNumber,
      stageKey: input.resolution.current.stageKey,
    },
    crossedSemesterBoundary: input.resolution.crossedSemesterBoundary,
    realizationFlag: STAGE_REALIZATION_FLAG_NAME,
    note: 'Stage evidence re-realized with intervention deltas folded in (Phase 6d).',
  }
}

export function isStageRealizationAuditEnabled(): boolean {
  return process.env[STAGE_REALIZATION_FLAG_NAME] === '1'
}

type AdvanceProofRunRow = Pick<typeof simulationRuns.$inferSelect,
  | 'simulationRunId'
  | 'batchId'
  | 'createdAt'
  | 'semesterStart'
  | 'semesterEnd'
  | 'activeFlag'
  | 'activeOperationalSemester'
  | 'activeStageKey'
  | 'simulatedDateIso'
  | 'lifecycleState'
  | 'stageBoundaryJson'
>

export type ProofAdvanceMode = 'next-day' | 'next-stage'

export type ProofAdvanceServiceDeps = {
  createId: (prefix: string) => string
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
  stagePolicy?: StagePolicyPayload
}

export type AdvanceProofSimulationInput = {
  simulationRunId: string
  actorFacultyId?: string | null
  now: string
  policy?: ResolvedPolicy
}

export type ProofAdvanceChainPoint = {
  chainIndex: number
  positionId: string
  previousPositionId: string | null
  nextPositionId: string | null
  semesterNumber: number
  stageKey: StagePolicyStageKey
  stageOrder: number
  occurredAt: string
}

export type ProofAdvanceResolution = {
  mode: ProofAdvanceMode
  previous: ProofAdvanceChainPoint
  current: ProofAdvanceChainPoint
  next: ProofAdvanceChainPoint | null
  simulatedDateIso: string
  stageTransitioned: boolean
  crossedSemesterBoundary: boolean
  terminalLifecyclePreserved: boolean
  lifecycleState: string
  nextBoundaryAt: string | null
  autoResolutionMode: 'post-see-open-cases-may-auto-resolve' | null
}

type ResetSnapshotPayload = {
  snapshotType?: string | null
  runAuthority?: {
    activeOperationalSemester?: number | null
    activeStageKey?: string | null
    lifecycleState?: string | null
    runMode?: string | null
    simulatedDateIso?: string | null
    stageBoundary?: ProofRunStageBoundarySnapshot | null
  }
  transition?: Record<string, unknown>
}

function addDaysIso(value: string, days: number) {
  const next = new Date(value)
  if (Number.isNaN(next.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString()
}

function normalizeStageKey(value: string | null | undefined): StagePolicyStageKey | null {
  if (!value) return null
  return stagePolicyStageKeyValues.includes(value as StagePolicyStageKey)
    ? value as StagePolicyStageKey
    : null
}

export function parseProofAdvanceStageBoundarySnapshot(input: {
  stageBoundaryJson?: string | null
  checkpointRows?: Array<Pick<typeof simulationStageCheckpoints.$inferSelect,
    'simulationStageCheckpointId' | 'semesterNumber' | 'stageKey' | 'stageOrder'
  >>
}) {
  const parsed = parseJson(input.stageBoundaryJson, null as ProofRunStageBoundarySnapshot | null)
  if (
    parsed
    && Array.isArray(parsed.availableSemesters)
    && Array.isArray(parsed.semesters)
  ) {
    return parsed
  }
  return buildProofRunStageBoundarySnapshot(input.checkpointRows ?? [])
}

export function buildProofAdvanceChain(input: {
  run: Pick<AdvanceProofRunRow, 'createdAt' | 'semesterStart' | 'semesterEnd'>
  stageBoundary: ProofRunStageBoundarySnapshot
  stagePolicy?: StagePolicyPayload
}) {
  const policy = input.stagePolicy ?? DEFAULT_STAGE_POLICY
  const orderedPoints: ProofAdvanceChainPoint[] = []
  input.stageBoundary.semesters
    .slice()
    .sort((left, right) => left.semesterNumber - right.semesterNumber)
    .forEach(semester => {
      if (semester.semesterNumber < input.run.semesterStart || semester.semesterNumber > input.run.semesterEnd) {
        return
      }
      semester.stageKeys.forEach((stageKey, stageIndex) => {
        const normalizedStageKey = normalizeStageKey(stageKey)
        if (!normalizedStageKey) return
        const stageDef = stagePolicyStageByKey(policy, normalizedStageKey)
        orderedPoints.push({
          chainIndex: orderedPoints.length,
          positionId: `${semester.semesterNumber}::${normalizedStageKey}`,
          previousPositionId: null,
          nextPositionId: null,
          semesterNumber: semester.semesterNumber,
          stageKey: normalizedStageKey,
          stageOrder: semester.stageOrders[stageIndex] ?? stageDef.order,
          occurredAt: playbackCheckpointNowIso(input.run.createdAt, semester.semesterNumber, stageDef),
        })
      })
    })
  orderedPoints.forEach((point, index) => {
    point.previousPositionId = orderedPoints[index - 1]?.positionId ?? null
    point.nextPositionId = orderedPoints[index + 1]?.positionId ?? null
  })
  return orderedPoints
}

function resolveCurrentChainPoint(
  chain: ProofAdvanceChainPoint[],
  run: Pick<AdvanceProofRunRow, 'activeOperationalSemester' | 'activeStageKey'>,
) {
  const activeOperationalSemester = run.activeOperationalSemester ?? chain[0]?.semesterNumber ?? 1
  const activeStageKey = normalizeStageKey(run.activeStageKey) ?? chain.find(point => point.semesterNumber === activeOperationalSemester)?.stageKey ?? chain[0]?.stageKey
  return chain.find(point => (
    point.semesterNumber === activeOperationalSemester
    && point.stageKey === activeStageKey
  )) ?? chain.find(point => point.semesterNumber === activeOperationalSemester) ?? chain[0] ?? null
}

export function resolveProofAdvance(input: {
  mode: ProofAdvanceMode
  run: AdvanceProofRunRow
  stageBoundary: ProofRunStageBoundarySnapshot
  stagePolicy?: StagePolicyPayload
  now?: string
}) {
  const chain = buildProofAdvanceChain({
    run: input.run,
    stageBoundary: input.stageBoundary,
    stagePolicy: input.stagePolicy,
  })
  if (chain.length === 0) {
    throw new Error('Simulation run stage chain is empty')
  }
  const previous = resolveCurrentChainPoint(chain, input.run)
  if (!previous) {
    throw new Error('Simulation run current stage is unavailable')
  }
  const next = chain[previous.chainIndex + 1] ?? null
  const currentDateIso = input.run.simulatedDateIso ?? previous.occurredAt ?? input.now ?? input.run.createdAt
  const advancedDateIso = input.mode === 'next-day'
    ? addDaysIso(currentDateIso, 1)
    : (next?.occurredAt ?? currentDateIso)
  const stageTransitioned = next != null && (
    input.mode === 'next-stage'
    || next.occurredAt.localeCompare(advancedDateIso) <= 0
  )
  const current = stageTransitioned ? next! : previous
  const terminalLifecyclePreserved = current.chainIndex === chain.length - 1
  const lifecycleState = terminalLifecyclePreserved ? 'completed-inspectable' : 'active'
  return {
    mode: input.mode,
    previous,
    current,
    next: chain[current.chainIndex + 1] ?? null,
    simulatedDateIso: advancedDateIso,
    stageTransitioned,
    crossedSemesterBoundary: previous.semesterNumber !== current.semesterNumber,
    terminalLifecyclePreserved,
    lifecycleState,
    nextBoundaryAt: (chain[current.chainIndex + 1] ?? null)?.occurredAt ?? null,
    autoResolutionMode: stageTransitioned && current.stageKey === 'post-see'
      ? 'post-see-open-cases-may-auto-resolve'
      : null,
  } satisfies ProofAdvanceResolution
}

async function loadAdvanceContext(db: AppDb, simulationRunId: string) {
  const [run, checkpointRows] = await Promise.all([
    db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, simulationRunId)).then(rows => rows[0] ?? null),
    db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, simulationRunId)).orderBy(
      asc(simulationStageCheckpoints.semesterNumber),
      asc(simulationStageCheckpoints.stageOrder),
    ),
  ])
  if (!run) throw new Error('Simulation run not found')
  return {
    run,
    checkpointRows,
    stageBoundary: parseProofAdvanceStageBoundarySnapshot({
      stageBoundaryJson: run.stageBoundaryJson,
      checkpointRows,
    }),
  }
}

function buildStageEntrySnapshotPayload(input: {
  resolution: ProofAdvanceResolution
  stageBoundary: ProofRunStageBoundarySnapshot
}) {
  return {
    snapshotType: 'stage-entry',
    runAuthority: {
      activeOperationalSemester: input.resolution.current.semesterNumber,
      activeStageKey: input.resolution.current.stageKey,
      lifecycleState: input.resolution.lifecycleState,
      simulatedDateIso: input.resolution.simulatedDateIso,
      stageBoundary: input.stageBoundary,
    },
    transition: {
      fromPositionId: input.resolution.previous.positionId,
      toPositionId: input.resolution.current.positionId,
      crossedSemesterBoundary: input.resolution.crossedSemesterBoundary,
      autoResolutionMode: input.resolution.autoResolutionMode,
    },
  } satisfies ResetSnapshotPayload
}

async function persistResolvedAdvance(
  db: AppDb,
  input: AdvanceProofSimulationInput & { mode: ProofAdvanceMode },
  deps: ProofAdvanceServiceDeps,
  run: AdvanceProofRunRow,
  stageBoundary: ProofRunStageBoundarySnapshot,
  resolution: ProofAdvanceResolution,
) {
  await db.update(simulationRuns).set({
    activeOperationalSemester: resolution.current.semesterNumber,
    activeStageKey: resolution.current.stageKey,
    simulatedDateIso: resolution.simulatedDateIso,
    lifecycleState: resolution.lifecycleState,
    stageBoundaryJson: JSON.stringify(stageBoundary),
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, run.simulationRunId))

  if (resolution.stageTransitioned) {
    await db.insert(simulationResetSnapshots).values({
      simulationResetSnapshotId: deps.createId('simulation_reset'),
      simulationRunId: run.simulationRunId,
      batchId: run.batchId,
      snapshotLabel: `Stage entry snapshot: semester ${resolution.current.semesterNumber} ${resolution.current.stageKey}`,
      snapshotJson: JSON.stringify(buildStageEntrySnapshotPayload({
        resolution,
        stageBoundary,
      })),
      createdAt: input.now,
    })
    if (deps.rebuildSimulationStagePlayback && input.policy) {
      await deps.rebuildSimulationStagePlayback(db, {
        simulationRunId: run.simulationRunId,
        policy: input.policy,
        now: input.now,
      })
    }
    // Phase-6c: when AIRMENTOR_STAGE_REALIZATION_V1=1 is set, the rebuildSimulation-
    // StagePlayback call above will have re-realized every student's evidence with
    // intervention deltas folded in (via the Phase-6d wire). Emit a companion
    // audit entry so faculty / HoD / auditors can see the stage transition WAS
    // realization-aware. Downstream consumers (HoD console, audit trail) can read
    // this marker to render the "marks reflect interventions" badge on the stage
    // timeline. Flag-off path skips this entry.
    if (isStageRealizationAuditEnabled()) {
      await deps.emitSimulationAudit(db, {
        simulationRunId: run.simulationRunId,
        batchId: run.batchId,
        actionType: 'stage-realization-applied',
        payload: buildStageRealizationAppliedAuditPayload({ resolution }),
        createdByFacultyId: input.actorFacultyId ?? null,
        now: input.now,
      })
    }
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
    actionType: input.mode === 'next-day' ? 'advanced-day' : 'advanced-stage',
    payload: {
      previousOperationalSemester: resolution.previous.semesterNumber,
      activeOperationalSemester: resolution.current.semesterNumber,
      previousStageKey: resolution.previous.stageKey,
      activeStageKey: resolution.current.stageKey,
      simulatedDateIso: resolution.simulatedDateIso,
      stageTransitioned: resolution.stageTransitioned,
      crossedSemesterBoundary: resolution.crossedSemesterBoundary,
      lifecycleState: resolution.lifecycleState,
      nextBoundaryAt: resolution.nextBoundaryAt,
      autoResolutionMode: resolution.autoResolutionMode,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })

  return {
    ok: true as const,
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    previousOperationalSemester: resolution.previous.semesterNumber,
    activeOperationalSemester: resolution.current.semesterNumber,
    previousStageKey: resolution.previous.stageKey,
    activeStageKey: resolution.current.stageKey,
    simulatedDateIso: resolution.simulatedDateIso,
    stageTransitioned: resolution.stageTransitioned,
    crossedSemesterBoundary: resolution.crossedSemesterBoundary,
    lifecycleState: resolution.lifecycleState,
    autoResolutionMode: resolution.autoResolutionMode,
  }
}

async function advanceProofSimulation(
  db: AppDb,
  input: AdvanceProofSimulationInput & { mode: ProofAdvanceMode },
  deps: ProofAdvanceServiceDeps,
) {
  const { run, stageBoundary } = await loadAdvanceContext(db, input.simulationRunId)
  if (run.lifecycleState === 'stopped') {
    throw new Error('Stopped proof runs must be restored before advancement')
  }
  if (!stageBoundary.strictlyMonotonic) {
    throw new Error('Simulation run stage boundaries are invalid')
  }
  const resolution = resolveProofAdvance({
    mode: input.mode,
    run,
    stageBoundary,
    stagePolicy: deps.stagePolicy,
    now: input.now,
  })
  return persistResolvedAdvance(db, input, deps, run, stageBoundary, resolution)
}

export async function advanceProofSimulationDay(
  db: AppDb,
  input: AdvanceProofSimulationInput,
  deps: ProofAdvanceServiceDeps,
) {
  return advanceProofSimulation(db, {
    ...input,
    mode: 'next-day',
  }, deps)
}

export async function advanceProofSimulationStage(
  db: AppDb,
  input: AdvanceProofSimulationInput,
  deps: ProofAdvanceServiceDeps,
) {
  return advanceProofSimulation(db, {
    ...input,
    mode: 'next-stage',
  }, deps)
}
