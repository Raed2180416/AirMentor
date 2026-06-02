import { and, asc, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageQueueCases,
  simulationStageQueueProjections,
  studentInterventions,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import { parseJson } from './json.js'
import { buildDeterministicId, playbackCheckpointNowIso } from './proof-control-plane-playback-service.js'
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
import { conflict } from './http-errors.js'

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
  | 'updatedAt'
>

export type ProofAdvanceMode = 'next-day' | 'previous-day' | 'next-stage'

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
  hasUnrealizedInterventionsSinceLastAdvance?: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    since: string | null
    now: string
  }) => Promise<boolean>
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

type AdvanceCheckpointRow = Pick<typeof simulationStageCheckpoints.$inferSelect,
  'simulationStageCheckpointId' | 'semesterNumber' | 'stageKey' | 'stageOrder'
>

type AutoResolutionDecision = {
  action: 'intervene' | 'dismiss'
  interventionMode: 'recurring' | 'one-time' | null
}

type AutoResolutionApplied = AutoResolutionDecision & {
  interventionType: string | null
  note: string
}

type AutoResolutionSummary = {
  checkedCheckpointCount: number
  openCaseCount: number
  resolvedCount: number
  dismissedCount: number
  interventionCount: number
  recurringInterventionCount: number
  oneTimeInterventionCount: number
  statusOnly: boolean
}

const EMPTY_AUTO_RESOLUTION_SUMMARY: AutoResolutionSummary = {
  checkedCheckpointCount: 0,
  openCaseCount: 0,
  resolvedCount: 0,
  dismissedCount: 0,
  interventionCount: 0,
  recurringInterventionCount: 0,
  oneTimeInterventionCount: 0,
  statusOnly: false,
}

const AUTO_RESOLUTION_SOURCE = 'proof-stage-auto-resolution-v1'

const MODEL_KNOWN_INTERVENTION_TYPES = new Set([
  'mentor-check-in',
  'mentor-outreach',
  'prerequisite-bridge',
  'structured-study-plan',
  'targeted-tutoring',
  'pre-see-rescue',
  'outreach-plus-tutoring',
  'attendance-recovery-follow-up',
  'faculty-outreach',
  'alert-only',
  'support',
])

const WORKFLOW_ONLY_ACTIONS = new Set(['no-action', 'alert-only', 'faculty-outreach'])

function addDaysIso(value: string, days: number) {
  const next = new Date(value)
  if (Number.isNaN(next.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString()
}

async function shouldPrimeStagePlaybackRebuild(input: {
  db: AppDb
  run: AdvanceProofRunRow
  request: AdvanceProofSimulationInput & { mode: ProofAdvanceMode }
  deps: ProofAdvanceServiceDeps
}) {
  if (!input.deps.rebuildSimulationStagePlayback || !input.request.policy) return false
  if (!isStageRealizationAuditEnabled()) return false
  if (!input.deps.hasUnrealizedInterventionsSinceLastAdvance) return false
  return input.deps.hasUnrealizedInterventionsSinceLastAdvance(input.db, {
    simulationRunId: input.run.simulationRunId,
    batchId: input.run.batchId,
    since: input.run.updatedAt ?? input.run.createdAt ?? null,
    now: input.request.now,
  })
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

function buildFallbackCurrentChainPoint(input: {
  run: Pick<AdvanceProofRunRow, 'activeOperationalSemester' | 'activeStageKey' | 'createdAt' | 'semesterStart'>
  stagePolicy?: StagePolicyPayload
}): ProofAdvanceChainPoint {
  const policy = input.stagePolicy ?? DEFAULT_STAGE_POLICY
  const stageKey = normalizeStageKey(input.run.activeStageKey) ?? 'pre-tt1'
  const stageDef = stagePolicyStageByKey(policy, stageKey)
  const semesterNumber = input.run.activeOperationalSemester ?? input.run.semesterStart ?? 1
  return {
    chainIndex: 0,
    positionId: `${semesterNumber}::${stageKey}`,
    previousPositionId: null,
    nextPositionId: null,
    semesterNumber,
    stageKey,
    stageOrder: stageDef.order,
    occurredAt: playbackCheckpointNowIso(input.run.createdAt, semesterNumber, stageDef),
  }
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
    if (input.mode === 'previous-day') {
      const current = buildFallbackCurrentChainPoint({
        run: input.run,
        stagePolicy: input.stagePolicy,
      })
      const currentDateIso = input.run.simulatedDateIso ?? input.now ?? input.run.createdAt
      return {
        mode: input.mode,
        previous: current,
        current,
        next: null,
        simulatedDateIso: addDaysIso(currentDateIso, -1),
        stageTransitioned: false,
        crossedSemesterBoundary: false,
        terminalLifecyclePreserved: false,
        lifecycleState: input.run.lifecycleState ?? 'active',
        nextBoundaryAt: null,
        autoResolutionMode: null,
      } satisfies ProofAdvanceResolution
    }
    throw conflict('Proof run is still preparing its stage checkpoints. Try again after the worker finishes.')
  }
  const previous = resolveCurrentChainPoint(chain, input.run)
  if (!previous) {
    throw new Error('Simulation run current stage is unavailable')
  }
  const next = chain[previous.chainIndex + 1] ?? null
  const currentDateIso = input.run.simulatedDateIso ?? previous.occurredAt ?? input.now ?? input.run.createdAt
  const advancedDateIso = input.mode === 'next-day'
    ? addDaysIso(currentDateIso, 1)
    : input.mode === 'previous-day'
      ? addDaysIso(currentDateIso, -1)
      : (next?.occurredAt ?? currentDateIso)
  const stageTransitioned = next != null && (
    input.mode === 'next-stage'
    || (input.mode === 'next-day' && next.occurredAt.localeCompare(advancedDateIso) <= 0)
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

function autoResolutionDecision(studentId: string, stageKey: string): AutoResolutionDecision {
  let hash = 0
  const key = `${studentId}::${stageKey}`
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i)
    hash |= 0
  }
  const normalized = Math.abs(hash) % 100

  if (normalized < 30) {
    return { action: 'dismiss', interventionMode: null }
  }
  const interveneBucket = normalized - 30
  if (interveneBucket < 28) {
    return { action: 'intervene', interventionMode: 'recurring' }
  }
  return { action: 'intervene', interventionMode: 'one-time' }
}

function normalizedInterventionType(
  recommendedAction: string | null | undefined,
  interventionMode: AutoResolutionDecision['interventionMode'],
) {
  const recommended = typeof recommendedAction === 'string' ? recommendedAction.trim() : ''
  if (
    recommended
    && MODEL_KNOWN_INTERVENTION_TYPES.has(recommended)
    && !WORKFLOW_ONLY_ACTIONS.has(recommended)
  ) {
    return recommended
  }
  return interventionMode === 'recurring' ? 'structured-study-plan' : 'mentor-check-in'
}

function autoResolutionApplied(
  queueCase: typeof simulationStageQueueCases.$inferSelect,
): AutoResolutionApplied {
  const decision = autoResolutionDecision(queueCase.studentId, queueCase.stageKey)
  if (decision.action === 'dismiss') {
    return {
      ...decision,
      interventionType: null,
      note: `Auto-dismissed ${queueCase.stageKey} queue item after checkpoint review; no intervention was applied.`,
    }
  }
  const interventionType = normalizedInterventionType(queueCase.recommendedAction, decision.interventionMode)
  return {
    ...decision,
    interventionType,
    note: decision.interventionMode === 'recurring'
      ? `Auto-applied recurring ${interventionType} for ${queueCase.stageKey}; follow-ups remain active until risk improves.`
      : `Auto-applied one-time ${interventionType} for ${queueCase.stageKey}; single review session recorded.`,
  }
}

function withAutoResolutionDetail(
  rawJson: string,
  applied: AutoResolutionApplied,
  now: string,
) {
  const detail = parseJson(rawJson, {} as Record<string, unknown>)
  return JSON.stringify({
    ...detail,
    autoResolution: {
      source: AUTO_RESOLUTION_SOURCE,
      action: applied.action,
      interventionMode: applied.interventionMode,
      interventionType: applied.interventionType,
      resolvedAt: now,
      version: 1,
    },
    note: applied.note,
    resolvedAt: now,
  })
}

function priorCheckpointsForResolution(input: {
  checkpointRows: AdvanceCheckpointRow[]
  current: ProofAdvanceChainPoint
}) {
  return input.checkpointRows.filter(row => (
    row.semesterNumber < input.current.semesterNumber
    || (row.semesterNumber === input.current.semesterNumber && row.stageOrder < input.current.stageOrder)
  ))
}

async function insertAutoResolutionInterventions(input: {
  db: AppDb
  simulationRunId: string
  queueCases: Array<typeof simulationStageQueueCases.$inferSelect>
  resolutionByCaseId: Map<string, AutoResolutionApplied>
  now: string
}) {
  const interventionRows: Array<typeof studentInterventions.$inferInsert> = []
  for (const queueCase of input.queueCases) {
    const applied = input.resolutionByCaseId.get(queueCase.simulationStageQueueCaseId)
    if (!applied || applied.action !== 'intervene' || !applied.interventionType) continue
    interventionRows.push({
      interventionId: buildDeterministicId('intervention_auto_resolution', [
        input.simulationRunId,
        queueCase.simulationStageQueueCaseId,
      ]),
      studentId: queueCase.studentId,
      facultyId: queueCase.assignedFacultyId ?? null,
      offeringId: queueCase.primaryOfferingId ?? null,
      interventionType: applied.interventionType,
      note: applied.note,
      occurredAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  const chunkSize = 50
  for (let i = 0; i < interventionRows.length; i += chunkSize) {
    await input.db
      .insert(studentInterventions)
      .values(interventionRows.slice(i, i + chunkSize))
      .onConflictDoNothing()
  }
}

async function autoResolvePriorStageQueueCases(input: {
  db: AppDb
  simulationRunId: string
  checkpointRows: AdvanceCheckpointRow[]
  current: ProofAdvanceChainPoint
  now: string
  writeInterventions: boolean
}): Promise<AutoResolutionSummary> {
  const priorCheckpoints = priorCheckpointsForResolution({
    checkpointRows: input.checkpointRows,
    current: input.current,
  })
  const checkpointIds = priorCheckpoints.map(row => row.simulationStageCheckpointId)
  if (checkpointIds.length === 0) {
    return { ...EMPTY_AUTO_RESOLUTION_SUMMARY, statusOnly: !input.writeInterventions }
  }

  const queueCases = await input.db
    .select()
    .from(simulationStageQueueCases)
    .where(
      and(
        eq(simulationStageQueueCases.simulationRunId, input.simulationRunId),
        eq(simulationStageQueueCases.status, 'Open'),
        inArray(simulationStageQueueCases.simulationStageCheckpointId, checkpointIds),
      ),
    )
  const openCases = queueCases.filter(queueCase => (
    queueCase.simulationRunId === input.simulationRunId
    && queueCase.status === 'Open'
    && checkpointIds.includes(queueCase.simulationStageCheckpointId)
  ))
  if (openCases.length === 0) {
    return {
      ...EMPTY_AUTO_RESOLUTION_SUMMARY,
      checkedCheckpointCount: checkpointIds.length,
      statusOnly: !input.writeInterventions,
    }
  }

  const caseIds = openCases.map(queueCase => queueCase.simulationStageQueueCaseId)
  const projectionRows = await input.db
    .select()
    .from(simulationStageQueueProjections)
    .where(inArray(simulationStageQueueProjections.simulationStageQueueCaseId, caseIds))
  const resolutionByCaseId = new Map<string, AutoResolutionApplied>()
  openCases.forEach(queueCase => {
    resolutionByCaseId.set(queueCase.simulationStageQueueCaseId, autoResolutionApplied(queueCase))
  })

  if (input.writeInterventions) {
    await insertAutoResolutionInterventions({
      db: input.db,
      simulationRunId: input.simulationRunId,
      queueCases: openCases,
      resolutionByCaseId,
      now: input.now,
    })
  }

  for (const queueCase of openCases) {
    const applied = resolutionByCaseId.get(queueCase.simulationStageQueueCaseId)!
    await input.db
      .update(simulationStageQueueCases)
      .set({
        status: 'Resolved',
        countsTowardCapacity: 0,
        detailJson: withAutoResolutionDetail(queueCase.detailJson, applied, input.now),
        updatedAt: input.now,
      })
      .where(eq(simulationStageQueueCases.simulationStageQueueCaseId, queueCase.simulationStageQueueCaseId))
  }

  for (const projectionRow of projectionRows) {
    if (!projectionRow.simulationStageQueueCaseId) continue
    const applied = resolutionByCaseId.get(projectionRow.simulationStageQueueCaseId)
    if (!applied) continue
    await input.db
      .update(simulationStageQueueProjections)
      .set({
        status: 'Resolved',
        simulatedActionTaken: applied.interventionType ?? 'no-action',
        detailJson: withAutoResolutionDetail(projectionRow.detailJson, applied, input.now),
        updatedAt: input.now,
      })
      .where(eq(simulationStageQueueProjections.simulationStageQueueProjectionId, projectionRow.simulationStageQueueProjectionId))
  }

  const applied = [...resolutionByCaseId.values()]
  return {
    checkedCheckpointCount: checkpointIds.length,
    openCaseCount: openCases.length,
    resolvedCount: openCases.length,
    dismissedCount: applied.filter(item => item.action === 'dismiss').length,
    interventionCount: applied.filter(item => item.action === 'intervene').length,
    recurringInterventionCount: applied.filter(item => item.interventionMode === 'recurring').length,
    oneTimeInterventionCount: applied.filter(item => item.interventionMode === 'one-time').length,
    statusOnly: !input.writeInterventions,
  }
}

async function persistResolvedAdvance(
  db: AppDb,
  input: AdvanceProofSimulationInput & { mode: ProofAdvanceMode },
  deps: ProofAdvanceServiceDeps,
  run: AdvanceProofRunRow,
  checkpointRows: AdvanceCheckpointRow[],
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

  let autoResolutionSummary: AutoResolutionSummary | null = null
  let playbackRebuiltForStageTransition = false
  const rebuildStagePlayback = async () => {
    if (!deps.rebuildSimulationStagePlayback || !input.policy) return
    await deps.rebuildSimulationStagePlayback(db, {
      simulationRunId: run.simulationRunId,
      policy: input.policy,
      now: input.now,
    })
    playbackRebuiltForStageTransition = true
  }

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
      if (await shouldPrimeStagePlaybackRebuild({
        db,
        run,
        request: input,
        deps,
      })) {
        await rebuildStagePlayback()
      }
      autoResolutionSummary = await autoResolvePriorStageQueueCases({
        db,
        simulationRunId: run.simulationRunId,
        checkpointRows,
        current: resolution.current,
        now: input.now,
        writeInterventions: true,
      })

      if (autoResolutionSummary.interventionCount > 0) {
        await rebuildStagePlayback()
        await autoResolvePriorStageQueueCases({
          db,
          simulationRunId: run.simulationRunId,
          checkpointRows,
          current: resolution.current,
          now: input.now,
          writeInterventions: false,
        })
      }

      if (autoResolutionSummary.resolvedCount > 0) {
        await deps.emitSimulationAudit(db, {
          simulationRunId: run.simulationRunId,
          batchId: run.batchId,
          actionType: 'stage-queue-auto-resolved',
          payload: {
            source: AUTO_RESOLUTION_SOURCE,
            transitionFrom: {
              semesterNumber: resolution.previous.semesterNumber,
              stageKey: resolution.previous.stageKey,
            },
            transitionTo: {
              semesterNumber: resolution.current.semesterNumber,
              stageKey: resolution.current.stageKey,
            },
            summary: autoResolutionSummary,
          },
          createdByFacultyId: input.actorFacultyId ?? null,
          now: input.now,
        })
      }
    }
    // Phase-6c: only emit this marker when playback was actually re-realized for
    // this transition. Ordinary stage pointer movement can reuse the existing
    // checkpoint universe; manual or auto interventions still trigger rebuilds.
    if (isStageRealizationAuditEnabled() && playbackRebuiltForStageTransition) {
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
    actionType: input.mode === 'next-day'
      ? 'advanced-day'
      : input.mode === 'previous-day'
        ? 'advanced-previous-day'
        : 'advanced-stage',
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
      autoResolutionSummary,
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
    autoResolutionSummary,
  }
}

async function advanceProofSimulation(
  db: AppDb,
  input: AdvanceProofSimulationInput & { mode: ProofAdvanceMode },
  deps: ProofAdvanceServiceDeps,
) {
  const { run, checkpointRows, stageBoundary } = await loadAdvanceContext(db, input.simulationRunId)
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
  return persistResolvedAdvance(db, input, deps, run, checkpointRows, stageBoundary, resolution)
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

export async function advanceProofSimulationPreviousDay(
  db: AppDb,
  input: AdvanceProofSimulationInput,
  deps: ProofAdvanceServiceDeps,
) {
  return advanceProofSimulation(db, {
    ...input,
    mode: 'previous-day',
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
