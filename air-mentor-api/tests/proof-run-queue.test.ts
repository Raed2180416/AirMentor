import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const proofRunQueueMocks = vi.hoisted(() => ({
  startProofSimulationRun: vi.fn(),
}))

vi.mock('../src/adapters/simulation/msruas-proof-control-plane.js', () => ({
  startProofSimulationRun: proofRunQueueMocks.startProofSimulationRun,
}))

import { startProofRunWorker } from '../src/lib/proof-run-queue.js'
import {
  enqueueProofSimulationRun,
  retryQueuedProofSimulationRun,
} from '../src/lib/proof-run-queue.js'

function createClaimedRunRow() {
  return {
    simulation_run_id: 'simulation_run_001',
    batch_id: 'batch_branch_mnc_btech_2023',
    curriculum_import_version_id: 'curriculum_import_001',
    curriculum_feature_profile_id: null,
    curriculum_feature_profile_fingerprint: null,
    parent_simulation_run_id: null,
    run_label: 'Proof run 001',
    status: 'queued',
    active_flag: 0,
    seed: 42,
    section_count: 2,
    student_count: 120,
    faculty_count: 6,
    semester_start: 1,
    semester_end: 6,
    source_type: 'simulation',
    policy_snapshot_json: '{}',
    progress_json: JSON.stringify({ requestedActivate: true }),
    section_overrides_json: JSON.stringify({ B: { examPressure: 0.88 } }),
    worker_lease_token: null,
    created_at: '2026-04-03T00:00:00.000Z',
    updated_at: '2026-04-03T00:00:00.000Z',
  }
}

function createInsertOnlyDb() {
  const insertValues = vi.fn().mockResolvedValue(undefined)
  return {
    db: {
      insert: vi.fn(() => ({
        values: insertValues,
      })),
    },
    insertValues,
  }
}

function createSelectInsertDb(run: Record<string, unknown>) {
  const selectWhere = vi.fn().mockResolvedValue([run])
  const selectFrom = vi.fn(() => ({
    where: selectWhere,
  }))
  const insertValues = vi.fn().mockResolvedValue(undefined)
  return {
    db: {
      select: vi.fn(() => ({
        from: selectFrom,
      })),
      insert: vi.fn(() => ({
        values: insertValues,
      })),
    },
    insertValues,
  }
}

describe('proof run queue worker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('waits for an in-flight proof run to finish before stopping', async () => {
    let resolveRun!: () => void
    const runPromise = new Promise<void>(resolve => {
      resolveRun = resolve
    })
    proofRunQueueMocks.startProofSimulationRun.mockReturnValue(runPromise)

    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [createClaimedRunRow()] })
      .mockResolvedValueOnce({ rows: [{ simulation_run_id: 'simulation_run_001' }] })
      .mockResolvedValueOnce({ rows: [] })

    const stopWorker = startProofRunWorker({
      db: {} as never,
      pool: { query },
      clock: () => '2026-04-03T00:00:00.000Z',
      startDelayMs: 0,
      pollMs: 1_000,
      heartbeatMs: 1_000,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(proofRunQueueMocks.startProofSimulationRun).toHaveBeenCalledTimes(1)

    let stopped = false
    const stopPromise = stopWorker().then(() => {
      stopped = true
    })

    await Promise.resolve()
    expect(stopped).toBe(false)

    resolveRun()
    await stopPromise

    expect(stopped).toBe(true)
    expect(query).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(query).toHaveBeenCalledTimes(3)
  })

  it('does not let the worker steal direct synchronous running runs', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })

    const stopWorker = startProofRunWorker({
      db: {} as never,
      pool: { query },
      clock: () => '2026-04-03T00:00:00.000Z',
      startDelayMs: 0,
      pollMs: 1_000,
      heartbeatMs: 1_000,
    })

    await vi.advanceTimersByTimeAsync(0)

    const claimSql = String(query.mock.calls[0]?.[0] ?? '')
    expect(claimSql).toMatch(
      /status = 'queued'[\s\S]+status = 'running'[\s\S]+worker_lease_token IS NOT NULL[\s\S]+executionStarted/,
    )
    expect(claimSql).not.toContain(`status IN ('queued', 'running')`)

    await stopWorker()
  })

  it('passes queued section overrides into proof run execution', async () => {
    proofRunQueueMocks.startProofSimulationRun.mockResolvedValue(undefined)
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [createClaimedRunRow()] })
      .mockResolvedValueOnce({ rows: [{ simulation_run_id: 'simulation_run_001' }] })
      .mockResolvedValueOnce({ rows: [] })

    const stopWorker = startProofRunWorker({
      db: {} as never,
      pool: { query },
      clock: () => '2026-04-03T00:00:00.000Z',
      startDelayMs: 0,
      pollMs: 1_000,
      heartbeatMs: 1_000,
    })

    await vi.advanceTimersByTimeAsync(0)
    await stopWorker()

    expect(proofRunQueueMocks.startProofSimulationRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      sectionOverridesJson: JSON.stringify({ B: { examPressure: 0.88 } }),
    }))
  })

  it('defaults queued reruns to non-activating mode until explicitly requested', async () => {
    const { db, insertValues } = createInsertOnlyDb()

    const queued = await enqueueProofSimulationRun(db as never, {
      batchId: 'batch_branch_mnc_btech_2023',
      curriculumImportVersionId: 'curriculum_import_001',
      policy: {} as never,
      now: '2026-04-03T00:00:00.000Z',
    })

    expect(queued.progress).toMatchObject({
      requestedActivate: false,
    })
    expect(insertValues.mock.calls[0]?.[0]).toMatchObject({
      status: 'queued',
      sectionOverridesJson: null,
      progressJson: expect.stringContaining('"requestedActivate":false'),
    })
  })

  it('creates a fresh retry attempt row instead of mutating the original run', async () => {
    const run = {
      simulationRunId: 'simulation_run_001',
      batchId: 'batch_branch_mnc_btech_2023',
      curriculumImportVersionId: 'curriculum_import_001',
      curriculumFeatureProfileId: null,
      curriculumFeatureProfileFingerprint: null,
      parentSimulationRunId: null,
      runLabel: 'Proof run 001',
      status: 'failed',
      activeFlag: 0,
      seed: 42,
      sectionCount: 2,
      studentCount: 120,
      facultyCount: 6,
      semesterStart: 1,
      semesterEnd: 6,
      activeOperationalSemester: 6,
      activeStageKey: 'post-assignments',
      simulatedDateIso: null,
      setupConfigJson: null,
      scenarioConfigJson: null,
      lifecycleState: 'completed',
      runMode: 'background-worker',
      stageBoundaryJson: null,
      sourceType: 'simulation',
      policySnapshotJson: '{}',
      engineVersionsJson: '{}',
      metricsJson: '{}',
      progressJson: JSON.stringify({ requestedActivate: true, attemptNumber: 1 }),
      startedAt: '2026-04-03T00:00:00.000Z',
      completedAt: '2026-04-03T00:30:00.000Z',
      failureCode: 'PROOF_RUN_EXECUTION_FAILED',
      failureMessage: 'boom',
      workerLeaseToken: null,
      workerLeaseExpiresAt: null,
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:30:00.000Z',
    }
    const { db, insertValues } = createSelectInsertDb(run)

    const retried = await retryQueuedProofSimulationRun(db as never, {
      simulationRunId: run.simulationRunId,
      now: '2026-04-03T01:00:00.000Z',
    })

    expect(retried.simulationRunId).not.toBe(run.simulationRunId)
    expect(retried.progress).toMatchObject({
      requestedActivate: true,
      retryOf: run.simulationRunId,
      attemptNumber: 2,
    })
    expect(insertValues.mock.calls[0]?.[0]).toMatchObject({
      parentSimulationRunId: run.simulationRunId,
      status: 'queued',
      progressJson: expect.stringContaining('"attemptNumber":2'),
    })
  })
})
