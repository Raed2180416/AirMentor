import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const proofRunQueueMocks = vi.hoisted(() => ({
  startProofSimulationRun: vi.fn(),
}))

vi.mock('../src/lib/msruas-proof-control-plane.js', () => ({
  startProofSimulationRun: proofRunQueueMocks.startProofSimulationRun,
}))

import { startProofRunWorker } from '../src/lib/proof-run-queue.js'

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
    worker_lease_token: null,
    created_at: '2026-04-03T00:00:00.000Z',
    updated_at: '2026-04-03T00:00:00.000Z',
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
    expect(query).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(query).toHaveBeenCalledTimes(2)
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
      /WHERE\s+\(\s*status = 'queued'\s+OR\s+\(status = 'running' AND worker_lease_token IS NOT NULL\)\s*\)/,
    )
    expect(claimSql).not.toContain(`status IN ('queued', 'running')`)

    await stopWorker()
  })
})
