import { describe, expect, it } from 'vitest'
import { stageSummaryPayload } from '../src/lib/proof-control-plane-checkpoint-service.js'

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
})
