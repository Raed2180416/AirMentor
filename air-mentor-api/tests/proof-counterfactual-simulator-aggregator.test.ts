import { describe, expect, it } from 'vitest'
import {
  buildSimulatorCounterfactualReport,
  type SimulatorProjectionInputRow,
  type RealizedEvidence,
} from '../src/lib/proof-counterfactual-simulator-aggregator.js'

// Test-factory for a single (student, semester, stage, offering) row that
// matches what proof-control-plane-playback-governance-service persists into
// simulation_stage_student_projections + projectionJson. Tests inject rows
// directly so the aggregator can be exercised without touching DB.
function mkRow(overrides: Partial<SimulatorProjectionInputRow> = {}): SimulatorProjectionInputRow {
  const realizedEvidence: RealizedEvidence = {
    attendancePct: 82,
    tt1Pct: 68,
    tt2Pct: 70,
    quizPct: 75,
    assignmentPct: 72,
    seePct: 74,
    weakCoCount: 1,
    weakQuestionCount: 2,
    interventionResponseScore: 0.1,
    ...(overrides.realizedEvidence ?? {}),
  }
  const { realizedEvidence: _ignoreRealized, ...restOverrides } = overrides
  return {
    studentId: 'stud_001',
    offeringId: 'off_001',
    semesterNumber: 1,
    sectionCode: 'A',
    courseCode: 'CS101',
    courseTitle: 'Intro to CS',
    stageKey: 'post-tt2',
    riskProbScaled: 40,
    riskBand: 'Medium',
    noActionRiskProbScaled: 60,
    noActionRiskBand: 'High',
    simulatedActionTaken: 'targeted-tutoring',
    ...restOverrides,
    realizedEvidence,
  }
}

describe('buildSimulatorCounterfactualReport — empty + single-point', () => {
  it('empty rows yield zero aggregates and empty perStudentPerStage', () => {
    const report = buildSimulatorCounterfactualReport({
      runId: 'run_empty',
      generatedAt: '2026-04-23T12:00:00Z',
      rows: [],
    })
    expect(report.perStudentPerStage).toEqual([])
    expect(report.bySemesterStage).toEqual([])
    expect(report.bySemester).toEqual([])
    expect(report.projectedFinal.totalStudents).toBe(0)
    expect(report.projectedFinal.totalSemesters).toBe(0)
    expect(report.projectedFinal.totalStagePoints).toBe(0)
    expect(report.projectedFinal.projectedFailuresPreventedTotal).toBe(0)
    // Lift distribution bins always returned (for stable UI histograms), all zero.
    expect(report.projectedFinal.liftDistribution).toHaveLength(7)
    expect(report.projectedFinal.liftDistribution.every(b => b.count === 0)).toBe(true)
  })

  it('single point: risk lift + mark delta computed from canonical adjustment', () => {
    const report = buildSimulatorCounterfactualReport({
      runId: 'run_1',
      generatedAt: '2026-04-23T12:00:00Z',
      rows: [mkRow()],
    })
    expect(report.perStudentPerStage).toHaveLength(1)
    const point = report.perStudentPerStage[0]
    expect(point.studentId).toBe('stud_001')
    expect(point.semesterNumber).toBe(1)
    expect(point.stageKey).toBe('post-tt2')
    // liftProb = noAction - realized = 60 - 40 = 20.
    expect(point.liftProbScaled).toBe(20)
    // Action is 'targeted-tutoring' at post-tt2 → tt2Penalty=14, seePenalty=10.
    // tt2 realized=70, so no-action=70-14=56, delta=70-56=14.
    expect(point.markDeltas.tt2Pct).toBeCloseTo(14, 5)
    // see realized=74, no-action=74-10=64, delta=10.
    expect(point.markDeltas.seePct).toBeCloseTo(10, 5)
    // attendance not penalised for targeted-tutoring → delta 0.
    expect(point.markDeltas.attendancePct).toBeCloseTo(0, 5)
    // Bands: realized=Medium, noAction=High → prevented-high.
    expect(point.bandTransition).toBe('prevented-high')
  })
})

describe('band transition taxonomy', () => {
  it('no-change when bands equal', () => {
    const row = mkRow({ riskBand: 'Low', noActionRiskBand: 'Low' })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    expect(report.perStudentPerStage[0].bandTransition).toBe('no-change')
  })
  it('prevented-high when no-action=High, realized=Medium', () => {
    const row = mkRow({ riskBand: 'Medium', noActionRiskBand: 'High' })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    expect(report.perStudentPerStage[0].bandTransition).toBe('prevented-high')
  })
  it('prevented-high when no-action=High, realized=Low', () => {
    const row = mkRow({ riskBand: 'Low', noActionRiskBand: 'High' })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    expect(report.perStudentPerStage[0].bandTransition).toBe('prevented-high')
  })
  it('prevented-medium when no-action=Medium, realized=Low', () => {
    const row = mkRow({ riskBand: 'Low', noActionRiskBand: 'Medium' })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    expect(report.perStudentPerStage[0].bandTransition).toBe('prevented-medium')
  })
  it('regression when realized band worse than no-action', () => {
    const row = mkRow({ riskBand: 'High', noActionRiskBand: 'Medium' })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    expect(report.perStudentPerStage[0].bandTransition).toBe('regression')
  })
})

describe('early-stage behaviour — prompt §C.1, §G.6 watch-only semantics', () => {
  it('pre-tt1 with no action: no mark penalty; interventionResponseScore clamped ≤ 0', () => {
    const row = mkRow({
      stageKey: 'pre-tt1',
      simulatedActionTaken: null,
      realizedEvidence: {
        attendancePct: 90,
        tt1Pct: null,
        tt2Pct: null,
        quizPct: null,
        assignmentPct: null,
        seePct: null,
        weakCoCount: 0,
        weakQuestionCount: 0,
        interventionResponseScore: 0.5,
      },
    })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    const point = report.perStudentPerStage[0]
    // No mark deltas present because stage has no assessment marks yet.
    expect(point.markDeltas.tt1Pct).toBeUndefined()
    expect(point.markDeltas.tt2Pct).toBeUndefined()
    // attendancePct is always present but unchanged because no action was taken.
    expect(point.markDeltas.attendancePct).toBeCloseTo(0, 5)
  })

  it('post-tt1 with action: marks unchanged because penalty stage is post-tt2+', () => {
    const row = mkRow({
      stageKey: 'post-tt1',
      simulatedActionTaken: 'targeted-tutoring',
      realizedEvidence: {
        attendancePct: 80,
        tt1Pct: 70,
        tt2Pct: null,
        quizPct: null,
        assignmentPct: null,
        seePct: null,
        weakCoCount: 1,
        weakQuestionCount: 1,
        interventionResponseScore: 0.1,
      },
    })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    const point = report.perStudentPerStage[0]
    // tt1 recorded but identity on early stages.
    expect(point.markDeltas.tt1Pct).toBeCloseTo(0, 5)
    expect(point.markDeltas.attendancePct).toBeCloseTo(0, 5)
  })
})

describe('determinism — same inputs in any order yield same report', () => {
  it('shuffle 10 rows 3 times → reports identical', () => {
    const rows: SimulatorProjectionInputRow[] = []
    for (let i = 0; i < 10; i += 1) {
      rows.push(mkRow({
        studentId: `stud_${String(i).padStart(3, '0')}`,
        offeringId: `off_${i % 3}`,
        stageKey: (i % 2 === 0 ? 'post-tt2' : 'post-see'),
        riskProbScaled: 30 + (i % 20),
        noActionRiskProbScaled: 50 + (i % 30),
        simulatedActionTaken: i % 3 === 0 ? 'targeted-tutoring' : i % 3 === 1 ? 'mentor-check-in' : null,
      }))
    }
    const baseline = JSON.stringify(buildSimulatorCounterfactualReport({
      runId: 'r', generatedAt: 't', rows,
    }))
    for (let shuffle = 0; shuffle < 3; shuffle += 1) {
      const shuffled = [...rows].sort(() => Math.random() - 0.5)
      const report = JSON.stringify(buildSimulatorCounterfactualReport({
        runId: 'r', generatedAt: 't', rows: shuffled,
      }))
      expect(report).toBe(baseline)
    }
  })
})

describe('multi-offering aggregation', () => {
  it('two offerings for same student same stage → mean marks + max band', () => {
    const offA = mkRow({
      offeringId: 'off_A',
      riskProbScaled: 30,
      riskBand: 'Low',
      noActionRiskProbScaled: 45,
      noActionRiskBand: 'Medium',
      realizedEvidence: {
        attendancePct: 80,
        tt1Pct: 60,
        tt2Pct: 60,
        quizPct: 70,
        assignmentPct: 70,
        seePct: 70,
        weakCoCount: 1,
        weakQuestionCount: 1,
        interventionResponseScore: 0.1,
      },
    })
    const offB = mkRow({
      offeringId: 'off_B',
      riskProbScaled: 50,
      riskBand: 'Medium',
      noActionRiskProbScaled: 80,
      noActionRiskBand: 'High',
      realizedEvidence: {
        attendancePct: 80,
        tt1Pct: 80,
        tt2Pct: 80,
        quizPct: 70,
        assignmentPct: 70,
        seePct: 70,
        weakCoCount: 1,
        weakQuestionCount: 1,
        interventionResponseScore: 0.1,
      },
    })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [offA, offB] })
    expect(report.perStudentPerStage).toHaveLength(1)
    const point = report.perStudentPerStage[0]
    // Mean across offerings: tt2 = (60 + 80) / 2 = 70.
    expect(point.realizedMarks.tt2Pct).toBeCloseTo(70, 5)
    // Max band: Low vs Medium → Medium (realized); Medium vs High → High (noAction).
    expect(point.realizedRiskBand).toBe('Medium')
    expect(point.noActionRiskBand).toBe('High')
    // Lift: mean(30, 50) vs mean(45, 80) = 40 vs 62.5 → ~22.5.
    expect(point.liftProbScaled).toBeCloseTo(22.5, 1)
  })
})

describe('realism bounds', () => {
  it('no-action marks clamped ≥ 0 even when realized close to 0', () => {
    const row = mkRow({
      stageKey: 'post-see',
      simulatedActionTaken: 'targeted-tutoring',
      realizedEvidence: {
        attendancePct: 5,
        tt1Pct: 30,
        tt2Pct: 8,
        quizPct: 20,
        assignmentPct: 20,
        seePct: 8,
        weakCoCount: 3,
        weakQuestionCount: 3,
        interventionResponseScore: 0.0,
      },
    })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    const point = report.perStudentPerStage[0]
    // tt2Pct realized=8, penalty=14 → noAction=0 clamp, delta=8.
    expect(point.noActionMarks.tt2Pct).toBeCloseTo(0, 5)
    expect(point.markDeltas.tt2Pct).toBeCloseTo(8, 5)
    // seePct realized=8, penalty=10 → noAction=0 clamp, delta=8.
    expect(point.noActionMarks.seePct).toBeCloseTo(0, 5)
    expect(point.markDeltas.seePct).toBeCloseTo(8, 5)
  })

  it('noAction marks never exceed 100 even when realized is 100', () => {
    // action = attendance-recovery-follow-up bumps attendance penalty 8
    const row = mkRow({
      stageKey: 'post-see',
      simulatedActionTaken: 'attendance-recovery-follow-up',
      realizedEvidence: {
        attendancePct: 100,
        tt1Pct: null,
        tt2Pct: 90,
        quizPct: null,
        assignmentPct: null,
        seePct: 90,
        weakCoCount: 0,
        weakQuestionCount: 0,
        interventionResponseScore: 0.3,
      },
    })
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows: [row] })
    const point = report.perStudentPerStage[0]
    expect(point.noActionMarks.attendancePct).toBeCloseTo(92, 5)
    expect(point.realizedMarks.attendancePct).toBeCloseTo(100, 5)
    expect(point.markDeltas.attendancePct).toBeCloseTo(8, 5)
  })
})

describe('semester aggregates', () => {
  it('mean lift and band totals roll up per-semester', () => {
    const rows: SimulatorProjectionInputRow[] = [
      mkRow({ studentId: 'a', stageKey: 'post-tt2', riskProbScaled: 30, noActionRiskProbScaled: 60, riskBand: 'Low', noActionRiskBand: 'High' }),
      mkRow({ studentId: 'b', stageKey: 'post-tt2', riskProbScaled: 40, noActionRiskProbScaled: 70, riskBand: 'Medium', noActionRiskBand: 'High' }),
      mkRow({ studentId: 'c', stageKey: 'post-tt2', riskProbScaled: 50, noActionRiskProbScaled: 55, riskBand: 'Medium', noActionRiskBand: 'Medium' }),
    ]
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows })
    expect(report.bySemester).toHaveLength(1)
    const sem = report.bySemester[0]
    expect(sem.semesterNumber).toBe(1)
    expect(sem.studentCount).toBe(3)
    // Mean lift = mean(30, 30, 5) = 21.67.
    expect(sem.meanLiftProbScaled).toBeCloseTo(21.67, 1)
    expect(sem.preventedHighTotal).toBe(2) // a and b both no-action=High, realized<High.
    expect(sem.preventedMediumTotal).toBe(0)
    expect(sem.regressionTotal).toBe(0)
  })

  it('projectedFailuresPrevented counts unique students from final stage only', () => {
    // Student x: post-tt2 prevented-high, post-see no-change.
    // Student y: post-tt2 no-change, post-see prevented-medium.
    const rows: SimulatorProjectionInputRow[] = [
      mkRow({
        studentId: 'x', stageKey: 'post-tt2',
        riskProbScaled: 30, riskBand: 'Medium',
        noActionRiskProbScaled: 60, noActionRiskBand: 'High',
      }),
      mkRow({
        studentId: 'x', stageKey: 'post-see',
        riskProbScaled: 25, riskBand: 'Low',
        noActionRiskProbScaled: 25, noActionRiskBand: 'Low',
      }),
      mkRow({
        studentId: 'y', stageKey: 'post-tt2',
        riskProbScaled: 50, riskBand: 'Medium',
        noActionRiskProbScaled: 50, noActionRiskBand: 'Medium',
      }),
      mkRow({
        studentId: 'y', stageKey: 'post-see',
        riskProbScaled: 30, riskBand: 'Low',
        noActionRiskProbScaled: 50, noActionRiskBand: 'Medium',
      }),
    ]
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows })
    const sem = report.bySemester[0]
    // Final stage (post-see) for x = no-change; for y = prevented-medium.
    // Only y should count.
    expect(sem.projectedFailuresPrevented).toBe(1)
    expect(report.projectedFinal.projectedFailuresPreventedTotal).toBe(1)
  })
})

describe('lift distribution histogram', () => {
  it('assigns each point to exactly one bin', () => {
    // Craft 7 points, one per bin.
    const lifts = [-75, -35, -10, 0, 10, 35, 75]
    const rows = lifts.map((lift, i) => mkRow({
      studentId: `s_${i}`,
      stageKey: 'post-tt2',
      riskProbScaled: 50,
      noActionRiskProbScaled: 50 + lift,
    }))
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows })
    expect(report.projectedFinal.liftDistribution.every(b => b.count === 1)).toBe(true)
    // Sum across bins equals point count.
    expect(report.projectedFinal.liftDistribution.reduce((s, b) => s + b.count, 0)).toBe(lifts.length)
  })
})

describe('ordering', () => {
  it('perStudentPerStage sorted by (semester, stage-index, studentId)', () => {
    const rows: SimulatorProjectionInputRow[] = [
      mkRow({ studentId: 'b', semesterNumber: 2, stageKey: 'post-see' }),
      mkRow({ studentId: 'a', semesterNumber: 1, stageKey: 'pre-tt1' }),
      mkRow({ studentId: 'c', semesterNumber: 1, stageKey: 'post-tt2' }),
      mkRow({ studentId: 'a', semesterNumber: 1, stageKey: 'post-tt2' }),
    ]
    const report = buildSimulatorCounterfactualReport({ runId: 'r', generatedAt: 't', rows })
    const keys = report.perStudentPerStage.map(p => `${p.semesterNumber}::${p.stageKey}::${p.studentId}`)
    expect(keys).toEqual([
      '1::pre-tt1::a',
      '1::post-tt2::a',
      '1::post-tt2::c',
      '2::post-see::b',
    ])
  })
})
