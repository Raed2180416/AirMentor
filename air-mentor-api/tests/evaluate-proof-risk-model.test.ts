import { describe, expect, it } from 'vitest'
import {
  buildQueueBurdenStageSummaries,
  queueRollupSectionKey,
  queueRollupStudentKey,
  type QueueBurdenRunObservation,
} from '../scripts/evaluate-proof-risk-model.js'

describe('evaluate proof risk model helpers', () => {
  it('keys queue rollups by run and entity id', () => {
    expect(queueRollupStudentKey('run-a', 'student-1')).toBe('run-a::student-1')
    expect(queueRollupSectionKey('run-a', 'A')).toBe('run-a::A')
    expect(queueRollupStudentKey('run-a', 'student-1')).not.toBe(queueRollupStudentKey('run-b', 'student-1'))
    expect(queueRollupSectionKey('run-a', 'A')).not.toBe(queueRollupSectionKey('run-b', 'A'))
  })

  it('summarizes queue burden with per-run p95 gating instead of cross-run unions', () => {
    const observations: QueueBurdenRunObservation[] = [
      {
        simulationRunId: 'run-a',
        semesterNumber: 1,
        stageKey: 'post-reassessment',
        stageOrder: 3,
        uniqueStudentCount: 120,
        openQueueStudentCount: 36,
        watchStudentCount: 18,
        sectionMaxActionableRate: 0.32,
        actionableQueuePpvProxy: 0.68,
      },
      {
        simulationRunId: 'run-b',
        semesterNumber: 1,
        stageKey: 'post-reassessment',
        stageOrder: 3,
        uniqueStudentCount: 120,
        openQueueStudentCount: 72,
        watchStudentCount: 24,
        sectionMaxActionableRate: 0.41,
        actionableQueuePpvProxy: 0.71,
      },
      {
        simulationRunId: 'run-a',
        semesterNumber: 1,
        stageKey: 'post-see',
        stageOrder: 5,
        uniqueStudentCount: 120,
        openQueueStudentCount: 36,
        watchStudentCount: 12,
        sectionMaxActionableRate: 0.34,
        actionableQueuePpvProxy: 0.66,
      },
      {
        simulationRunId: 'run-b',
        semesterNumber: 1,
        stageKey: 'post-see',
        stageOrder: 5,
        uniqueStudentCount: 120,
        openQueueStudentCount: 42,
        watchStudentCount: 18,
        sectionMaxActionableRate: 0.36,
        actionableQueuePpvProxy: 0.64,
      },
    ]

    const summaries = buildQueueBurdenStageSummaries(observations)
    expect(summaries).toHaveLength(2)

    const postReassessment = summaries.find(item => item.stageKey === 'post-reassessment')
    expect(postReassessment).toMatchObject({
      runCount: 2,
      threshold: 0.3,
      meanActionableOpenRate: 0.45,
      medianActionableOpenRate: 0.6,
      p95ActionableOpenRate: 0.6,
      maxActionableOpenRate: 0.6,
      meanWatchRate: 0.175,
      p95SectionMaxActionableRate: 0.41,
      minActionableQueuePpvProxy: 0.68,
      passesActionableRate: false,
      passesSectionTolerance: false,
      passesWatchRate: true,
      passesPpvProxy: true,
    })

    const postSee = summaries.find(item => item.stageKey === 'post-see')
    expect(postSee).toMatchObject({
      runCount: 2,
      threshold: 0.35,
      meanActionableOpenRate: 0.325,
      p95ActionableOpenRate: 0.35,
      maxActionableOpenRate: 0.35,
      meanWatchRate: 0.125,
      p95SectionMaxActionableRate: 0.36,
      minActionableQueuePpvProxy: 0.64,
      passesActionableRate: true,
      passesSectionTolerance: true,
      passesWatchRate: true,
      passesPpvProxy: true,
    })
  })
})
