import { describe, expect, it } from 'vitest'
import { stageSummaryPayload, withProofPlaybackGate } from '../src/adapters/simulation/proof-control-plane-checkpoint-service.js'

describe('proof-control-plane-checkpoint-service', () => {
  it('summarizes checkpoint risk and queue counts by unique student and primary queue case', () => {
    const summary = stageSummaryPayload({
      checkpoint: {
        simulationStageCheckpointId: 'checkpoint_sem1_pre_tt1',
        simulationRunId: 'run_001',
        semesterNumber: 1,
        stageKey: 'pre-tt1',
        stageLabel: 'Pre TT1',
        stageDescription: 'Observation-only semester start checkpoint.',
        stageOrder: 1,
        previousCheckpointId: null,
        nextCheckpointId: 'checkpoint_sem1_post_tt1',
      } as never,
      studentRows: [
        {
          studentId: 'student_001',
          riskBand: 'Medium',
          noActionRiskBand: 'High',
          queueState: 'idle',
          projectionJson: JSON.stringify({ riskChangeFromPreviousCheckpointScaled: 0, counterfactualLiftScaled: 0 }),
        },
        {
          studentId: 'student_001',
          riskBand: 'High',
          noActionRiskBand: 'High',
          queueState: 'idle',
          projectionJson: JSON.stringify({ riskChangeFromPreviousCheckpointScaled: 1, counterfactualLiftScaled: 2 }),
        },
        {
          studentId: 'student_002',
          riskBand: 'Medium',
          noActionRiskBand: 'Medium',
          queueState: 'watch',
          projectionJson: JSON.stringify({ riskChangeFromPreviousCheckpointScaled: 2, counterfactualLiftScaled: 4 }),
        },
        {
          studentId: 'student_003',
          riskBand: 'Low',
          noActionRiskBand: 'Low',
          queueState: 'watch',
          projectionJson: JSON.stringify({ riskChangeFromPreviousCheckpointScaled: -1, counterfactualLiftScaled: 1 }),
        },
      ] as never,
      queueRows: [
        {
          studentId: 'student_002',
          status: 'Watching',
          detailJson: JSON.stringify({ primaryCase: true, countsTowardCapacity: false }),
        },
        {
          studentId: 'student_002',
          status: 'Watching',
          detailJson: JSON.stringify({ primaryCase: false, countsTowardCapacity: false }),
        },
        {
          studentId: 'student_003',
          status: 'Resolved',
          detailJson: JSON.stringify({ primaryCase: true, countsTowardCapacity: false }),
        },
        {
          studentId: 'student_001',
          status: 'Open',
          detailJson: JSON.stringify({ primaryCase: true, countsTowardCapacity: true }),
        },
        {
          studentId: 'student_001',
          status: 'Open',
          detailJson: JSON.stringify({ primaryCase: false, countsTowardCapacity: false }),
        },
      ] as never,
      offeringRows: [{}, {}, {}] as never,
      electiveVisibleCount: 0,
    })

    expect(summary).toMatchObject({
      totalStudentProjectionCount: 4,
      studentCount: 3,
      offeringCount: 3,
      highRiskCount: 1,
      mediumRiskCount: 1,
      lowRiskCount: 1,
      openQueueCount: 1,
      watchQueueCount: 1,
      watchStudentCount: 1,
      resolvedQueueCount: 1,
      noActionHighRiskCount: 1,
      stageAdvanceBlocked: true,
      blockingQueueItemCount: 1,
    })
  })

  it('does not gate later playback on historical open queue cases that later move to watching', () => {
    const gated = withProofPlaybackGate([
      {
        simulationStageCheckpointId: 'checkpoint_sem2_post_tt1',
        simulationRunId: 'run_001',
        semesterNumber: 2,
        stageKey: 'post-tt1',
        stageLabel: 'Post TT1',
        stageDescription: 'First checkpoint after TT1 evidence is present and locked.',
        stageOrder: 2,
        previousCheckpointId: null,
        nextCheckpointId: 'checkpoint_sem2_post_tt2',
        openQueueCount: 10,
        watchQueueCount: 43,
        resolvedQueueCount: 0,
        liveBlockingQueueItemCount: 0,
      },
      {
        simulationStageCheckpointId: 'checkpoint_sem2_post_tt2',
        simulationRunId: 'run_001',
        semesterNumber: 2,
        stageKey: 'post-tt2',
        stageLabel: 'Post TT2',
        stageDescription: 'Second checkpoint after TT2 evidence is present and locked.',
        stageOrder: 3,
        previousCheckpointId: 'checkpoint_sem2_post_tt1',
        nextCheckpointId: 'checkpoint_sem6_post_see',
        openQueueCount: 0,
        watchQueueCount: 10,
        resolvedQueueCount: 0,
        liveBlockingQueueItemCount: 0,
      },
      {
        simulationStageCheckpointId: 'checkpoint_sem6_post_see',
        simulationRunId: 'run_001',
        semesterNumber: 6,
        stageKey: 'post-see',
        stageLabel: 'Post SEE',
        stageDescription: 'Final evidence checkpoint after SEE lands.',
        stageOrder: 5,
        previousCheckpointId: 'checkpoint_sem2_post_tt2',
        nextCheckpointId: null,
        openQueueCount: 0,
        watchQueueCount: 0,
        resolvedQueueCount: 0,
        liveBlockingQueueItemCount: 0,
      },
    ] as never)

    expect(gated.find(item => item.simulationStageCheckpointId === 'checkpoint_sem2_post_tt1')).toMatchObject({
      stageAdvanceBlocked: false,
      blockingQueueItemCount: 0,
      playbackAccessible: true,
    })
    expect(gated.find(item => item.simulationStageCheckpointId === 'checkpoint_sem6_post_see')).toMatchObject({
      playbackAccessible: true,
      blockedByCheckpointId: null,
      blockedProgressionReason: null,
    })
  })

  it('overrides stale checkpoint queue counters from live queue-case rows', () => {
    const gated = withProofPlaybackGate([
      {
        simulationStageCheckpointId: 'checkpoint_sem2_post_tt1',
        simulationRunId: 'run_001',
        semesterNumber: 2,
        stageKey: 'post-tt1',
        stageLabel: 'Post TT1',
        stageDescription: 'First checkpoint after TT1 evidence is present and locked.',
        stageOrder: 2,
        previousCheckpointId: null,
        nextCheckpointId: 'checkpoint_sem2_post_tt2',
        openQueueCount: 13,
        watchQueueCount: 18,
        resolvedQueueCount: 0,
        deferredQueueCount: 78,
        liveBlockingQueueItemCount: 13,
      },
    ] as never, [
      {
        simulationStageCheckpointId: 'checkpoint_sem2_post_tt1',
        studentId: 'student_001',
        semesterNumber: 2,
        status: 'Resolved',
        countsTowardCapacity: 0,
        caseJson: JSON.stringify({ caseKey: 'student_001::2' }),
      },
      {
        simulationStageCheckpointId: 'checkpoint_sem2_post_tt1',
        studentId: 'student_002',
        semesterNumber: 2,
        status: 'Watching',
        countsTowardCapacity: 0,
        caseJson: JSON.stringify({ caseKey: 'student_002::2' }),
      },
      {
        simulationStageCheckpointId: 'checkpoint_sem2_post_tt1',
        studentId: 'student_003',
        semesterNumber: 2,
        status: 'Deferred',
        countsTowardCapacity: 0,
        caseJson: JSON.stringify({ caseKey: 'student_003::2' }),
      },
    ] as never)

    expect(gated[0]).toMatchObject({
      openQueueCount: 0,
      resolvedQueueCount: 1,
      watchQueueCount: 1,
      deferredQueueCount: 1,
      stageAdvanceBlocked: false,
    })
  })
})
