import { describe, expect, it } from 'vitest'
import {
  buildCounterfactualReport,
  type ProofMarkSnapshotRow,
} from '../src/lib/proof-counterfactual-reader.js'

function mk(
  studentId: string,
  stageKey: ProofMarkSnapshotRow['stageKey'],
  tt1: number | null = null,
  tt2: number | null = null,
  semesterNumber = 1,
): ProofMarkSnapshotRow {
  return {
    studentId,
    semesterNumber,
    stageKey,
    tt1Pct: tt1,
    tt2Pct: tt2,
    quizPct: null,
    assignmentPct: null,
    seePct: null,
    totalPct: null,
  }
}

describe('buildCounterfactualReport', () => {
  it('empty inputs -> empty diffs and aggregate counts zero', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [],
      realizedRows: [],
    })
    expect(report.studentStageDiffs).toEqual([])
    expect(report.aggregate.totalStudents).toBe(0)
    expect(report.aggregate.totalStages).toBe(0)
    expect(report.aggregate.totalStudentStagePairs).toBe(0)
    expect(report.aggregate.byScalar.tt2Pct.samples).toBe(0)
  })

  it('single student, single stage -> single positive delta on tt2', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [mk('stud_001', 'post-tt2', 52, 50)],
      realizedRows: [mk('stud_001', 'post-tt2', 52, 64)],
    })
    expect(report.studentStageDiffs).toHaveLength(1)
    const d = report.studentStageDiffs[0]
    expect(d.studentId).toBe('stud_001')
    expect(d.stageKey).toBe('post-tt2')
    expect(d.deltas.tt2Pct).toBe(14)
    // tt1 unchanged -> delta 0 (but included because both sides have the value).
    expect(d.deltas.tt1Pct).toBe(0)
    expect(report.aggregate.totalStudents).toBe(1)
    expect(report.aggregate.byScalar.tt2Pct.meanDelta).toBe(14)
    expect(report.aggregate.byScalar.tt2Pct.medianDelta).toBe(14)
    expect(report.aggregate.byScalar.tt2Pct.positiveCount).toBe(1)
  })

  it('skips scalars missing on either side', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [mk('stud_001', 'post-tt1', 48, null)],
      realizedRows: [mk('stud_001', 'post-tt1', 48, 55)],
    })
    expect(report.studentStageDiffs[0].deltas.tt2Pct).toBeUndefined()
    expect(report.studentStageDiffs[0].deltas.tt1Pct).toBe(0)
  })

  it('skips rows missing on either side (realized-only students dropped)', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [mk('stud_001', 'post-tt1', 50, null)],
      realizedRows: [
        mk('stud_001', 'post-tt1', 50, null),
        mk('stud_002', 'post-tt1', 55, null),  // no baseline pair -> dropped
      ],
    })
    // stud_001 has only tt1 on both sides which maps to delta 0 -> the row
    // IS included because there is one valid scalar; stud_002 is skipped.
    const ids = report.studentStageDiffs.map(d => d.studentId)
    expect(ids).toEqual(['stud_001'])
  })

  it('multi-student aggregate: mean/median/positive/negative/zero counts', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [
        mk('stud_A', 'post-tt2', 50, 50),
        mk('stud_B', 'post-tt2', 50, 50),
        mk('stud_C', 'post-tt2', 50, 50),
        mk('stud_D', 'post-tt2', 50, 50),
      ],
      realizedRows: [
        mk('stud_A', 'post-tt2', 50, 60),   // +10
        mk('stud_B', 'post-tt2', 50, 55),   // +5
        mk('stud_C', 'post-tt2', 50, 50),   // 0
        mk('stud_D', 'post-tt2', 50, 45),   // -5
      ],
    })
    const tt2 = report.aggregate.byScalar.tt2Pct
    expect(tt2.samples).toBe(4)
    expect(tt2.meanDelta).toBe((10 + 5 + 0 + -5) / 4)
    expect(tt2.medianDelta).toBe((0 + 5) / 2)
    expect(tt2.positiveCount).toBe(2)
    expect(tt2.negativeCount).toBe(1)
    expect(tt2.zeroCount).toBe(1)
    expect(tt2.maxDelta).toBe(10)
    expect(tt2.minDelta).toBe(-5)
  })

  it('deterministic ordering by (semester, stage-index, studentId)', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [
        mk('stud_Z', 'post-tt1', 40, null, 1),
        mk('stud_A', 'post-tt2', 50, 50, 1),
        mk('stud_B', 'pre-tt1', null, null, 1),
        mk('stud_M', 'post-tt2', 60, 60, 2),
      ],
      realizedRows: [
        mk('stud_Z', 'post-tt1', 40, null, 1),
        mk('stud_A', 'post-tt2', 50, 55, 1),
        mk('stud_M', 'post-tt2', 60, 65, 2),
      ],
    })
    const order = report.studentStageDiffs.map(d => `${d.semesterNumber}-${d.stageKey}-${d.studentId}`)
    expect(order).toEqual([
      '1-post-tt1-stud_Z',
      '1-post-tt2-stud_A',
      '2-post-tt2-stud_M',
    ])
  })

  it('is deterministic across 10 replays with shuffled input', () => {
    const baseline = [
      mk('stud_001', 'post-tt2', 50, 50),
      mk('stud_002', 'post-tt2', 55, 55),
      mk('stud_003', 'post-tt1', 48, null),
    ]
    const realized = [
      mk('stud_003', 'post-tt1', 48, null),
      mk('stud_001', 'post-tt2', 50, 64),
      mk('stud_002', 'post-tt2', 55, 60),
    ]
    const first = buildCounterfactualReport({
      runIdBaseline: 'r-base', runIdRealized: 'r-real',
      baselineRows: baseline,
      realizedRows: realized,
    })
    for (let i = 0; i < 10; i++) {
      const again = buildCounterfactualReport({
        runIdBaseline: 'r-base', runIdRealized: 'r-real',
        baselineRows: [...baseline].reverse(),
        realizedRows: [...realized].reverse(),
      })
      expect(again.studentStageDiffs).toEqual(first.studentStageDiffs)
      expect(again.aggregate).toEqual(first.aggregate)
    }
  })

  it('aggregates multi-stage per student as separate pairs', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [
        mk('stud_001', 'post-tt1', 50, null),
        mk('stud_001', 'post-tt2', 50, 50),
      ],
      realizedRows: [
        mk('stud_001', 'post-tt1', 50, null),  // tt1 unchanged
        mk('stud_001', 'post-tt2', 50, 58),    // tt2 +8
      ],
    })
    expect(report.studentStageDiffs).toHaveLength(2)
    expect(report.aggregate.totalStudents).toBe(1)
    expect(report.aggregate.totalStages).toBe(2)
    expect(report.aggregate.totalStudentStagePairs).toBe(2)
    expect(report.aggregate.byScalar.tt2Pct.samples).toBe(1)
  })

  it('rounds deltas to 4 decimals to absorb floating-point noise', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'r-base',
      runIdRealized: 'r-real',
      baselineRows: [mk('stud_001', 'post-tt2', 50.1, 50.00005)],
      realizedRows: [mk('stud_001', 'post-tt2', 50.1, 50.00010)],
    })
    expect(report.studentStageDiffs[0].deltas.tt2Pct).toBe(0.0001)
  })

  it('carries runIds through to output untouched', () => {
    const report = buildCounterfactualReport({
      runIdBaseline: 'simulation_run_base_abc',
      runIdRealized: 'simulation_run_real_xyz',
      baselineRows: [mk('stud_001', 'post-tt2', 50, 50)],
      realizedRows: [mk('stud_001', 'post-tt2', 50, 60)],
    })
    expect(report.runIdBaseline).toBe('simulation_run_base_abc')
    expect(report.runIdRealized).toBe('simulation_run_real_xyz')
  })
})
