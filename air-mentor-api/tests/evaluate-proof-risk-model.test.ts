import { describe, expect, it } from 'vitest'
import {
  blendProbabilityRows,
  buildHybridBlendPlan,
  chooseHybridBlendAlpha,
  buildQueueBurdenStageSummaries,
  evaluationPaths,
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
        stageKey: 'post-tt2',
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
        stageKey: 'post-tt2',
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

    const postTt2 = summaries.find(item => item.stageKey === 'post-tt2')
    expect(postTt2).toMatchObject({
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

  it('chooses challenger route when challenger clearly beats current', () => {
    const currentRows = [
      { label: 1, prob: 0.35 },
      { label: 1, prob: 0.4 },
      { label: 0, prob: 0.62 },
      { label: 0, prob: 0.58 },
    ]
    const challengerRows = [
      { label: 1, prob: 0.82 },
      { label: 1, prob: 0.75 },
      { label: 0, prob: 0.12 },
      { label: 0, prob: 0.08 },
    ]

    const choice = chooseHybridBlendAlpha(currentRows, challengerRows, 'attendanceRisk')
    expect(choice.alpha).toBe(0)
    expect(choice.metrics.logLoss).toBeLessThan(0.3)
  })

  it('builds stage-specific hard-route plan with current fallback on empty slices', () => {
    const currentRows = [
      { label: 1, prob: 0.78 },
      { label: 0, prob: 0.18 },
      { label: 1, prob: 0.74 },
      { label: 0, prob: 0.2 },
    ]
    const challengerRows = [
      { label: 1, prob: 0.61 },
      { label: 0, prob: 0.31 },
      { label: 1, prob: 0.58 },
      { label: 0, prob: 0.33 },
    ]
    const plan = buildHybridBlendPlan(
      'attendanceRisk',
      {
        current: currentRows,
        challenger: challengerRows,
      },
      {
        'pre-tt1': {
          current: [
            { label: 1, prob: 0.3 },
            { label: 0, prob: 0.7 },
          ],
          challenger: [
            { label: 1, prob: 0.8 },
            { label: 0, prob: 0.2 },
          ],
        },
        'post-tt2': {
          current: [
            { label: 1, prob: 0.85 },
            { label: 0, prob: 0.15 },
          ],
          challenger: [
            { label: 1, prob: 0.55 },
            { label: 0, prob: 0.45 },
          ],
        },
      },
    )

    expect(plan.fallbackAlpha).toBe(1)
    expect(plan.byStage['pre-tt1']?.alpha).toBe(0)
    expect(plan.byStage['post-tt2']?.alpha).toBe(1)

    expect(blendProbabilityRows(
      [
        { label: 1, prob: 0.22 },
        { label: 0, prob: 0.68 },
      ],
      [
        { label: 1, prob: 0.79 },
        { label: 0, prob: 0.19 },
      ],
      plan.byStage['pre-tt1']!.alpha,
    )).toEqual([
      { label: 1, prob: 0.79 },
      { label: 0, prob: 0.19 },
    ])
  })

  it('supports custom evaluation output paths for concurrent runs', () => {
    const previousDir = process.env.AIRMENTOR_EVAL_OUTPUT_DIR
    const previousStem = process.env.AIRMENTOR_EVAL_OUTPUT_STEM
    process.env.AIRMENTOR_EVAL_OUTPUT_DIR = 'tmp/proof-risk-runs'
    process.env.AIRMENTOR_EVAL_OUTPUT_STEM = 'coverage-24-hybrid'
    try {
      expect(evaluationPaths('/repo-root')).toEqual({
        outputDir: '/repo-root/tmp/proof-risk-runs',
        jsonPath: '/repo-root/tmp/proof-risk-runs/coverage-24-hybrid.json',
        markdownPath: '/repo-root/tmp/proof-risk-runs/coverage-24-hybrid.md',
      })
    } finally {
      if (previousDir === undefined) delete process.env.AIRMENTOR_EVAL_OUTPUT_DIR
      else process.env.AIRMENTOR_EVAL_OUTPUT_DIR = previousDir
      if (previousStem === undefined) delete process.env.AIRMENTOR_EVAL_OUTPUT_STEM
      else process.env.AIRMENTOR_EVAL_OUTPUT_STEM = previousStem
    }
  })
})
