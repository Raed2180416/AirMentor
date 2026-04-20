import type { Pool } from 'pg'
import { and, eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  academicTerms,
  batches,
  facultyOfferingOwnerships,
  sectionOfferings,
  simulationRuns,
  studentEnrollments,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import { createId } from './ids.js'
import { parseJson } from './json.js'
import { startProofSimulationRun } from './msruas-proof-control-plane.js'
import { MSRUAS_PROOF_BATCH_ID, PROOF_FACULTY } from './msruas-proof-sandbox.js'
import { emitOperationalEvent, normalizeTelemetryError } from './telemetry.js'

const WORKER_POLL_MS = 5_000
const WORKER_LEASE_MS = 60_000
const WORKER_HEARTBEAT_MS = 15_000

type QueueMetadata = {
  sectionCount: number
  studentCount: number
  facultyCount: number
  semesterStart: number
  semesterEnd: number
  sourceType: 'simulation' | 'live-runtime'
  metrics: Record<string, unknown>
}

type QueueRow = {
  simulation_run_id: string
  batch_id: string
  curriculum_import_version_id: string | null
  curriculum_feature_profile_id: string | null
  curriculum_feature_profile_fingerprint: string | null
  parent_simulation_run_id: string | null
  run_label: string
  status: string
  active_flag: number
  seed: number
  section_count: number
  student_count: number
  faculty_count: number
  semester_start: number
  semester_end: number
  source_type: string
  policy_snapshot_json: string
  progress_json: string | null
  worker_lease_token: string | null
  created_at: string
  updated_at: string
}

async function buildQueueMetadata(db: AppDb, batchId: string): Promise<QueueMetadata> {
  if (batchId === MSRUAS_PROOF_BATCH_ID) {
    return {
      sectionCount: 2,
      studentCount: 120,
      facultyCount: PROOF_FACULTY.length,
      semesterStart: 1,
      semesterEnd: 6,
      sourceType: 'simulation',
      metrics: {
        proofGoal: 'adaptation-readiness',
        sectionDistribution: { A: 60, B: 60 },
      },
    }
  }

  const [batch] = await db.select().from(batches).where(eq(batches.batchId, batchId))
  if (!batch) throw new Error('Batch not found')
  const termRows = await db.select().from(academicTerms).where(eq(academicTerms.batchId, batchId))
  const activeTerm = termRows
    .filter(row => row.status === 'active')
    .slice()
    .sort((left, right) => right.semesterNumber - left.semesterNumber || right.updatedAt.localeCompare(left.updatedAt))[0]
    ?? termRows
      .slice()
      .sort((left, right) => right.semesterNumber - left.semesterNumber || right.updatedAt.localeCompare(left.updatedAt))[0]
    ?? null
  const semesterNumber = activeTerm?.semesterNumber ?? batch.currentSemester
  if (!activeTerm) {
    return {
      sectionCount: 0,
      studentCount: 0,
      facultyCount: 0,
      semesterStart: semesterNumber,
      semesterEnd: semesterNumber,
      sourceType: 'live-runtime',
      metrics: {
        proofGoal: 'live-runtime-playback',
        queueState: 'waiting-for-term',
      },
    }
  }

  const [offeringRows, enrollmentRows, ownershipRows] = await Promise.all([
    db.select().from(sectionOfferings).where(eq(sectionOfferings.termId, activeTerm.termId)),
    db.select().from(studentEnrollments).where(and(
      eq(studentEnrollments.termId, activeTerm.termId),
      eq(studentEnrollments.academicStatus, 'active'),
    )),
    db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
  ])
  const offeringIdSet = new Set(offeringRows.map(row => row.offeringId))
  const sectionDistribution = Object.fromEntries(
    Array.from(new Set(offeringRows.map(row => row.sectionCode))).map(sectionCode => [
      sectionCode,
      enrollmentRows.filter(row => row.sectionCode === sectionCode).length,
    ]),
  )

  return {
    sectionCount: new Set(offeringRows.map(row => row.sectionCode)).size,
    studentCount: enrollmentRows.length,
    facultyCount: new Set(ownershipRows.filter(row => row.offeringId != null && offeringIdSet.has(row.offeringId)).map(row => row.facultyId)).size,
    semesterStart: semesterNumber,
    semesterEnd: semesterNumber,
    sourceType: 'live-runtime',
    metrics: {
      proofGoal: 'live-runtime-playback',
      termId: activeTerm.termId,
      sectionDistribution,
    },
  }
}

export async function enqueueProofSimulationRun(db: AppDb, input: {
  batchId: string
  curriculumImportVersionId: string
  policy: ResolvedPolicy
  curriculumFeatureProfileId?: string | null
  curriculumFeatureProfileFingerprint?: string | null
  now: string
  seed?: number
  runLabel?: string
  parentSimulationRunId?: string | null
  activate?: boolean
}) {
  const queueMetadata = await buildQueueMetadata(db, input.batchId)
  const runSeed = input.seed ?? Math.floor(Date.now() % 100000)
  const simulationRunId = createId('simulation_run')
  const activateRequested = input.activate ?? true
  const modeLabel = queueMetadata.sourceType === 'simulation' ? 'MSRUAS proof rerun' : 'Live batch proof run'
  await db.insert(simulationRuns).values({
    simulationRunId,
    batchId: input.batchId,
    curriculumImportVersionId: input.curriculumImportVersionId,
    curriculumFeatureProfileId: input.curriculumFeatureProfileId ?? null,
    curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    parentSimulationRunId: input.parentSimulationRunId ?? null,
    runLabel: input.runLabel ?? `${modeLabel} ${runSeed}`,
    status: 'queued',
    activeFlag: 0,
    seed: runSeed,
    sectionCount: queueMetadata.sectionCount,
    studentCount: queueMetadata.studentCount,
    facultyCount: queueMetadata.facultyCount,
    semesterStart: queueMetadata.semesterStart,
    semesterEnd: queueMetadata.semesterEnd,
    activeOperationalSemester: queueMetadata.semesterEnd,
    sourceType: queueMetadata.sourceType,
    policySnapshotJson: JSON.stringify(input.policy),
    engineVersionsJson: JSON.stringify({
      queueMode: 'background-worker',
    }),
    metricsJson: JSON.stringify(queueMetadata.metrics),
    progressJson: JSON.stringify({
      phase: 'queued',
      percent: 0,
      requestedActivate: activateRequested,
      mode: queueMetadata.sourceType,
    }),
    startedAt: null,
    completedAt: null,
    failureCode: null,
    failureMessage: null,
    workerLeaseToken: null,
    workerLeaseExpiresAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  })
  emitOperationalEvent('proof.run.queued', {
    simulationRunId,
    batchId: input.batchId,
    curriculumImportVersionId: input.curriculumImportVersionId,
    curriculumFeatureProfileId: input.curriculumFeatureProfileId ?? null,
    curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    sourceType: queueMetadata.sourceType,
    requestedActivate: activateRequested,
  })
  return {
    simulationRunId,
    status: 'queued',
    activeFlag: false,
    createdAt: input.now,
    startedAt: null,
    completedAt: null,
    failureCode: null,
    failureMessage: null,
    progress: {
      phase: 'queued',
      percent: 0,
      requestedActivate: activateRequested,
      mode: queueMetadata.sourceType,
    } as Record<string, unknown>,
  }
}

export async function retryQueuedProofSimulationRun(db: AppDb, input: {
  simulationRunId: string
  now: string
}) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  await db.update(simulationRuns).set({
    status: 'queued',
    activeFlag: 0,
    progressJson: JSON.stringify({
      phase: 'queued',
      percent: 0,
      requestedActivate: Boolean(parseJson(run.progressJson, {} as Record<string, unknown>).requestedActivate ?? true),
      mode: run.sourceType,
      retryOf: run.simulationRunId,
    }),
    startedAt: null,
    completedAt: null,
    failureCode: null,
    failureMessage: null,
    workerLeaseToken: null,
    workerLeaseExpiresAt: null,
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  emitOperationalEvent('proof.run.requeued', {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    curriculumImportVersionId: run.curriculumImportVersionId,
  })
  return {
    simulationRunId: run.simulationRunId,
    status: 'queued',
    activeFlag: false,
    createdAt: run.createdAt,
    startedAt: null,
    completedAt: null,
    failureCode: null,
    failureMessage: null,
    progress: {
      phase: 'queued',
      percent: 0,
      requestedActivate: Boolean(parseJson(run.progressJson, {} as Record<string, unknown>).requestedActivate ?? true),
      mode: run.sourceType,
      retryOf: run.simulationRunId,
    } as Record<string, unknown>,
  }
}

async function claimNextQueuedProofRun(pool: Pick<Pool, 'query'>, now: string, leaseToken: string) {
  const leaseExpiresAt = new Date(Date.parse(now) + WORKER_LEASE_MS).toISOString()
  const claim = await pool.query<QueueRow>(`
    WITH candidate AS (
      SELECT simulation_run_id
      FROM simulation_runs
      WHERE (
        status = 'queued'
        OR (status = 'running' AND worker_lease_token IS NOT NULL)
      )
        AND (worker_lease_expires_at IS NULL OR worker_lease_expires_at < $1)
      ORDER BY
        CASE status WHEN 'queued' THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE simulation_runs AS runs
    SET
      status = 'running',
      worker_lease_token = $2,
      worker_lease_expires_at = $3,
      started_at = COALESCE(runs.started_at, $1),
      completed_at = NULL,
      failure_code = NULL,
      failure_message = NULL,
      progress_json = $4,
      updated_at = $1
    FROM candidate
    WHERE runs.simulation_run_id = candidate.simulation_run_id
    RETURNING runs.*
  `, [
    now,
    leaseToken,
    leaseExpiresAt,
    JSON.stringify({ phase: 'running', percent: 5 }),
  ])
  return claim.rows[0] ?? null
}

async function heartbeatProofRunLease(pool: Pick<Pool, 'query'>, input: {
  simulationRunId: string
  leaseToken: string
  now: string
}) {
  const leaseExpiresAt = new Date(Date.parse(input.now) + WORKER_LEASE_MS).toISOString()
  await pool.query(`
    UPDATE simulation_runs
    SET worker_lease_expires_at = $1, updated_at = $2
    WHERE simulation_run_id = $3 AND worker_lease_token = $4
  `, [leaseExpiresAt, input.now, input.simulationRunId, input.leaseToken])
}

async function finalizeProofRunLease(pool: Pick<Pool, 'query'>, input: {
  simulationRunId: string
  leaseToken: string
  now: string
}) {
  await pool.query(`
    UPDATE simulation_runs
    SET worker_lease_token = NULL, worker_lease_expires_at = NULL, updated_at = $1
    WHERE simulation_run_id = $2 AND worker_lease_token = $3
  `, [input.now, input.simulationRunId, input.leaseToken])
}

async function failProofRun(pool: Pick<Pool, 'query'>, input: {
  simulationRunId: string
  leaseToken: string
  now: string
  error: unknown
}) {
  const message = input.error instanceof Error ? input.error.message : String(input.error ?? 'Unknown proof worker failure')
  await pool.query(`
    UPDATE simulation_runs
    SET
      status = 'failed',
      completed_at = $1,
      failure_code = 'PROOF_RUN_EXECUTION_FAILED',
      failure_message = $2,
      progress_json = $3,
      worker_lease_token = NULL,
      worker_lease_expires_at = NULL,
      updated_at = $1
    WHERE simulation_run_id = $4 AND worker_lease_token = $5
  `, [
    input.now,
    message,
    JSON.stringify({ phase: 'failed', percent: 100, message }),
    input.simulationRunId,
    input.leaseToken,
  ])
}

async function executeClaimedProofRun(db: AppDb, row: QueueRow) {
  const progress = parseJson(row.progress_json, {} as Record<string, unknown>)
  await startProofSimulationRun(db, {
    simulationRunId: row.simulation_run_id,
    batchId: row.batch_id,
    curriculumImportVersionId: row.curriculum_import_version_id ?? '',
    policy: parseJson(row.policy_snapshot_json, {} as ResolvedPolicy),
    curriculumFeatureProfileId: row.curriculum_feature_profile_id,
    curriculumFeatureProfileFingerprint: row.curriculum_feature_profile_fingerprint,
    actorFacultyId: null,
    now: new Date().toISOString(),
    seed: row.seed,
    runLabel: row.run_label,
    parentSimulationRunId: row.parent_simulation_run_id,
    activate: Boolean(progress.requestedActivate ?? true),
  })
}

export function startProofRunWorker(input: {
  db: AppDb
  pool: Pick<Pool, 'query'>
  clock?: () => string
  pollMs?: number
  heartbeatMs?: number
  startDelayMs?: number
}) {
  const now = input.clock ?? (() => new Date().toISOString())
  const pollMs = input.pollMs ?? WORKER_POLL_MS
  const heartbeatMs = input.heartbeatMs ?? WORKER_HEARTBEAT_MS
  const startDelayMs = input.startDelayMs ?? 2_000
  let disposed = false
  let timeout: NodeJS.Timeout | null = null
  let heartbeat: NodeJS.Timeout | null = null
  let running = false
  let activeTick: Promise<void> | null = null

  const schedule = (delayMs: number) => {
    if (disposed) return
    timeout = setTimeout(() => {
      timeout = null
      activeTick = tick().catch(error => {
        console.error('Proof worker tick failed', error)
      }).finally(() => {
        if (activeTick) activeTick = null
      })
    }, delayMs)
  }

  const tick = async () => {
    if (disposed || running) return
    running = true
    try {
      const leaseToken = createId('proof_worker_lease')
      const claimed = await claimNextQueuedProofRun(input.pool, now(), leaseToken)
      if (!claimed) return
      emitOperationalEvent('proof.run.claimed', {
        simulationRunId: claimed.simulation_run_id,
        batchId: claimed.batch_id,
        leaseToken,
        priorStatus: claimed.status,
      })

      heartbeat = setInterval(() => {
        void heartbeatProofRunLease(input.pool, {
          simulationRunId: claimed.simulation_run_id,
          leaseToken,
          now: now(),
        }).catch(error => {
          if (!disposed) console.error('Proof worker heartbeat failed', error)
        })
      }, heartbeatMs)

      try {
        await executeClaimedProofRun(input.db, claimed)
        await finalizeProofRunLease(input.pool, {
          simulationRunId: claimed.simulation_run_id,
          leaseToken,
          now: now(),
        })
        emitOperationalEvent('proof.run.executed', {
          simulationRunId: claimed.simulation_run_id,
          batchId: claimed.batch_id,
          leaseToken,
        })
      } catch (error) {
        await failProofRun(input.pool, {
          simulationRunId: claimed.simulation_run_id,
          leaseToken,
          now: now(),
          error,
        })
        emitOperationalEvent('proof.run.failed', {
          simulationRunId: claimed.simulation_run_id,
          batchId: claimed.batch_id,
          leaseToken,
          error: normalizeTelemetryError(error),
        }, { level: 'error' })
        console.error('Proof worker execution failed', error)
      } finally {
        if (heartbeat) {
          clearInterval(heartbeat)
          heartbeat = null
        }
      }
    } finally {
      running = false
      if (!disposed) schedule(pollMs)
    }
  }

  schedule(startDelayMs)
  return async () => {
    disposed = true
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    await activeTick?.catch(() => undefined)
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
  }
}
