import { describe, expect, it } from 'vitest'
import {
  buildCheckpointReadinessDiagnostics,
  buildProofQueueDiagnostics,
  buildProofWorkerDiagnostics,
  decorateProofRunsWithOperationalDiagnostics,
} from '../src/lib/proof-control-plane-dashboard-service.js'

describe('proof-control-plane-dashboard-service', () => {
  it('derives queue, lease, retry, and worker diagnostics from proof runs', () => {
    const runs = decorateProofRunsWithOperationalDiagnostics([
      {
        simulationRunId: 'run_queued',
        status: 'queued',
        activeFlag: false,
        createdAt: '2026-03-28T09:00:00.000Z',
        startedAt: null,
        completedAt: null,
        failureCode: null,
        failureMessage: null,
        progress: { phase: 'queued', percent: 0 },
        workerLeaseExpiresAt: null,
      },
      {
        simulationRunId: 'run_running',
        status: 'running',
        activeFlag: true,
        createdAt: '2026-03-28T08:30:00.000Z',
        startedAt: '2026-03-28T08:45:00.000Z',
        completedAt: null,
        failureCode: null,
        failureMessage: null,
        progress: { phase: 'running', percent: 45, retryOf: 'run_failed' },
        workerLeaseExpiresAt: '2026-03-28T09:31:00.000Z',
      },
      {
        simulationRunId: 'run_failed',
        status: 'failed',
        activeFlag: false,
        createdAt: '2026-03-28T08:00:00.000Z',
        startedAt: '2026-03-28T08:05:00.000Z',
        completedAt: '2026-03-28T08:20:00.000Z',
        failureCode: 'PROOF_RUN_EXECUTION_FAILED',
        failureMessage: 'boom',
        progress: { phase: 'failed', percent: 100 },
        workerLeaseExpiresAt: null,
      },
    ], '2026-03-28T09:30:00.000Z')

    expect(runs[0]).toMatchObject({
      simulationRunId: 'run_queued',
      queueAgeSeconds: 1800,
      leaseState: null,
      retryState: null,
      failureState: 'none',
    })
    expect(runs[1]).toMatchObject({
      simulationRunId: 'run_running',
      queueAgeSeconds: 2700,
      leaseState: 'leased',
      retryState: 'retry-of-previous-run',
      retryOfSimulationRunId: 'run_failed',
    })
    expect(runs[2]).toMatchObject({
      simulationRunId: 'run_failed',
      leaseState: 'released',
      retryState: 'retryable',
      failureState: 'retryable',
    })

    expect(buildProofQueueDiagnostics(runs)).toEqual({
      queuedRunCount: 1,
      runningRunCount: 1,
      failedRunCount: 1,
      retryableRunCount: 1,
      retryInFlightCount: 1,
      oldestQueuedRunAgeSeconds: 1800,
      expiredLeaseRunCount: 0,
    })
    expect(buildProofWorkerDiagnostics(runs[1])).toEqual({
      queueAgeSeconds: 2700,
      leaseState: 'leased',
      leaseExpiresAt: '2026-03-28T09:31:00.000Z',
      retryState: 'retry-of-previous-run',
      retryOfSimulationRunId: 'run_failed',
      failureState: 'none',
      progressPhase: 'running',
      progressPercent: 45,
    })
  })

  it('summarizes checkpoint readiness for dashboard diagnostics', () => {
    expect(buildCheckpointReadinessDiagnostics([
      {
        simulationStageCheckpointId: 'cp_1',
        playbackAccessible: true,
        stageAdvanceBlocked: false,
        blockingQueueItemCount: 0,
      },
      {
        simulationStageCheckpointId: 'cp_2',
        playbackAccessible: true,
        stageAdvanceBlocked: true,
        blockingQueueItemCount: 3,
      },
      {
        simulationStageCheckpointId: 'cp_3',
        playbackAccessible: false,
        stageAdvanceBlocked: false,
        openQueueCount: 1,
      },
    ])).toEqual({
      totalCheckpointCount: 3,
      readyCheckpointCount: 1,
      blockedCheckpointCount: 2,
      playbackBlockedCheckpointCount: 1,
      totalBlockingQueueItemCount: 4,
      firstBlockedCheckpointId: 'cp_2',
      lastReadyCheckpointId: 'cp_1',
    })
  })
})
