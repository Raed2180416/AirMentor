// Phase-11 simulator-based counterfactual aggregator (2026-04-23).
//
// INTENT (prompt §G.6 + §C.13 + §L.10):
//   Final Semester-6 analytics MUST use the simulator-based no-intervention
//   branch, NOT the flag-on vs flag-off snapshot diff. The flag-diff reader
//   (@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-counterfactual-reader.ts)
//   is explicitly labelled as a "temporary diagnostic" in the prompt and must
//   not drive final demo copy. UI language must use "projected" / "simulated"
//   / "counterfactual" and MUST NOT imply the risk model alone proved causal
//   uplift.
//
// DATA SHAPE (prompt §G.7, §J):
//   - Simulator runtime path (proof-control-plane-playback-governance-service)
//     persists per-(student, semester, stage, offering):
//       riskProbScaled (with-intervention from active model)
//       noActionRiskProbScaled (from buildNoActionSnapshot no-action branch)
//       projectionJson.currentEvidence (realized marks)
//       projectionJson.currentStatus.simulatedActionTaken (action applied)
//   - This module aggregates ONE runId across offerings/stages/semesters to
//     produce the full projected with-vs-without intervention report.
//
// PURE MODULE (no DB, no Date.now() — deterministic given inputs). The caller
// (academic-proof-routes + fetcher) is responsible for loading rows.

import { counterfactualAdjustment } from './proof-control-plane-playback-service.js'

// Numeric clamp matching the behaviour inside buildNoActionSnapshot in
// proof-control-plane-playback-service.ts. Inlined here to avoid pulling in
// the heavy StageEvidenceSnapshot import chain.
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ---------- Input shape ----------
// Matches the writer in proof-control-plane-playback-governance-service.ts
// (search for `studentProjectionRows.push`). Strictly the subset of columns
// + projectionJson sub-fields this aggregator needs.

export type SimulatorProjectionInputRow = {
  studentId: string
  offeringId: string | null
  semesterNumber: number
  sectionCode: string
  courseCode: string
  courseTitle: string
  // Stage is duplicated in both the checkpoint table and projectionJson.stageKey;
  // caller passes it here explicitly so this module never touches DB.
  stageKey: 'pre-tt1' | 'post-tt1' | 'post-tt2' | 'post-assignments' | 'post-see'
  riskProbScaled: number
  riskBand: 'High' | 'Medium' | 'Low'
  noActionRiskProbScaled: number
  noActionRiskBand: 'High' | 'Medium' | 'Low'
  simulatedActionTaken: string | null
  // Realized marks (from projectionJson.currentEvidence). Null when not yet
  // applicable at this stage (e.g. seePct before post-see stage).
  realizedEvidence: RealizedEvidence
}

export type RealizedEvidence = {
  attendancePct: number
  tt1Pct: number | null
  tt2Pct: number | null
  quizPct: number | null
  assignmentPct: number | null
  seePct: number | null
  weakCoCount: number
  weakQuestionCount: number
  interventionResponseScore: number | null
}

// ---------- Output shape ----------

export type CounterfactualScalarKey =
  | 'attendancePct'
  | 'tt1Pct'
  | 'tt2Pct'
  | 'quizPct'
  | 'assignmentPct'
  | 'seePct'

export type RiskBand = 'High' | 'Medium' | 'Low'

export type StudentStageCounterfactual = {
  studentId: string
  semesterNumber: number
  stageKey: SimulatorProjectionInputRow['stageKey']
  // Risk counterfactual (already computed by simulator runtime — we just
  // surface it and diff).
  realizedRiskProbScaled: number
  realizedRiskBand: RiskBand
  noActionRiskProbScaled: number
  noActionRiskBand: RiskBand
  // liftProbScaled = noActionRiskProbScaled - realizedRiskProbScaled.
  // Positive => intervention reduced risk probability (good).
  // Negative => intervention increased risk probability (rare; usually means
  // the realized path triggered deterioration elsewhere).
  liftProbScaled: number
  // Mark counterfactual: realized - noAction, per scalar. Positive => better
  // marks WITH intervention (good). Null when the scalar wasn't applicable
  // at this stage on either side.
  markDeltas: Partial<Record<CounterfactualScalarKey, number>>
  realizedMarks: Partial<Record<CounterfactualScalarKey, number>>
  noActionMarks: Partial<Record<CounterfactualScalarKey, number>>
  // Band transition — did intervention push a would-be High into Medium/Low?
  bandTransition:
    | 'no-change'
    | 'prevented-high' // no-action=High, realized=Medium or Low
    | 'prevented-medium' // no-action=Medium, realized=Low
    | 'regression' // realized band worse than no-action (shouldn't happen but we flag it)
  simulatedActionTaken: string | null
}

export type SemesterStageAggregate = {
  semesterNumber: number
  stageKey: SimulatorProjectionInputRow['stageKey']
  studentCount: number
  meanRealizedRiskProbScaled: number
  meanNoActionRiskProbScaled: number
  meanLiftProbScaled: number
  bandTransitions: {
    preventedHigh: number
    preventedMedium: number
    regression: number
    noChange: number
  }
  meanMarkDeltas: Partial<Record<CounterfactualScalarKey, number>>
}

export type SemesterAggregate = {
  semesterNumber: number
  studentCount: number
  meanRealizedRiskProbScaled: number
  meanNoActionRiskProbScaled: number
  meanLiftProbScaled: number
  preventedHighTotal: number
  preventedMediumTotal: number
  regressionTotal: number
  // Projected failures-prevented: unique students whose FINAL stage within the
  // semester had a prevented-high OR prevented-medium band transition.
  projectedFailuresPrevented: number
}

export type ProjectedFinalReport = {
  runId: string
  generatedAt: string // ISO timestamp supplied by caller (pure module — no Date.now())
  totalStudents: number
  totalSemesters: number
  totalStagePoints: number
  meanRealizedRiskProbScaled: number
  meanNoActionRiskProbScaled: number
  meanLiftProbScaled: number
  // Projected failures-prevented, aggregated across the whole run: students
  // who at any semester had a prevented-high / prevented-medium on the final
  // stage of that semester.
  projectedFailuresPreventedTotal: number
  // Lift histogram across all per-stage points. Bins are fixed at
  // [-100,-50), [-50,-20), [-20,-5), [-5,5), [5,20), [20,50), [50,100].
  liftDistribution: Array<{
    binLabel: string
    lowerInclusive: number
    upperExclusive: number
    count: number
  }>
}

export type CounterfactualSimulatorReport = {
  runId: string
  generatedAt: string
  perStudentPerStage: StudentStageCounterfactual[]
  bySemesterStage: SemesterStageAggregate[]
  bySemester: SemesterAggregate[]
  projectedFinal: ProjectedFinalReport
}

// ---------- Pure helpers ----------

const MARK_SCALAR_KEYS: ReadonlyArray<CounterfactualScalarKey> = [
  'attendancePct',
  'tt1Pct',
  'tt2Pct',
  'quizPct',
  'assignmentPct',
  'seePct',
]

const STAGE_ORDER: ReadonlyArray<SimulatorProjectionInputRow['stageKey']> = [
  'pre-tt1',
  'post-tt1',
  'post-tt2',
  'post-assignments',
  'post-see',
]

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return roundToTwo(values.reduce((s, v) => s + v, 0) / values.length)
}

// Compute no-action marks deterministically from realized marks +
// simulatedActionTaken + stageKey by applying the same counterfactualAdjustment
// penalties that buildNoActionSnapshot applies at governance time. This keeps
// live no-action risk scoring and the Phase-11 aggregator on the same
// formula (single source of truth in proof-control-plane-playback-service).
//
// Mirrors the guard in buildNoActionSnapshot: mark penalties are only applied
// at post-tt2 / post-assignments / post-see, matching the intent that earlier
// stages don't yet have enough evidence to realize intervention uplift.
function reconstructNoActionEvidence(input: {
  stageKey: SimulatorProjectionInputRow['stageKey']
  simulatedActionTaken: string | null
  realizedEvidence: RealizedEvidence
}): RealizedEvidence {
  const r = input.realizedEvidence
  const earlyStage = input.stageKey !== 'post-tt2'
    && input.stageKey !== 'post-assignments'
    && input.stageKey !== 'post-see'
  if (!input.simulatedActionTaken || earlyStage) {
    // Mirrors buildNoActionSnapshot early-return: identity marks, only clamp
    // interventionResponseScore ≤ 0 to reflect "no support received".
    return {
      ...r,
      interventionResponseScore: r.interventionResponseScore == null
        ? null
        : Math.min(r.interventionResponseScore, 0),
    }
  }
  const adj = counterfactualAdjustment(input.simulatedActionTaken)
  return {
    attendancePct: clamp(r.attendancePct - adj.attendancePenalty, 0, 100),
    tt1Pct: r.tt1Pct,
    tt2Pct: r.tt2Pct == null ? null : clamp(r.tt2Pct - adj.tt2Penalty, 0, 100),
    quizPct: r.quizPct,
    assignmentPct: r.assignmentPct,
    seePct: r.seePct == null ? null : clamp(r.seePct - adj.seePenalty, 0, 100),
    weakCoCount: r.weakCoCount + adj.weakSignalPenalty,
    weakQuestionCount: r.weakQuestionCount + adj.weakSignalPenalty,
    interventionResponseScore: r.interventionResponseScore == null
      ? -0.05
      : Math.min(r.interventionResponseScore - adj.consistencyBuff, -0.02),
  }
}

function bandTransitionLabel(
  realizedBand: RiskBand,
  noActionBand: RiskBand,
): StudentStageCounterfactual['bandTransition'] {
  const bandRank = (b: RiskBand) => (b === 'High' ? 2 : b === 'Medium' ? 1 : 0)
  const realizedRank = bandRank(realizedBand)
  const noActionRank = bandRank(noActionBand)
  if (realizedRank === noActionRank) return 'no-change'
  if (realizedRank > noActionRank) return 'regression'
  if (noActionRank === 2 && realizedRank < 2) return 'prevented-high'
  if (noActionRank === 1 && realizedRank < 1) return 'prevented-medium'
  return 'no-change'
}

// Aggregate multiple offering-level rows for the same (student, semester,
// stage) into a single row by mean-of-offerings for scalars and max-rank for
// bands.
function aggregateAcrossOfferings(
  rows: SimulatorProjectionInputRow[],
): {
  studentId: string
  semesterNumber: number
  stageKey: SimulatorProjectionInputRow['stageKey']
  riskProbScaled: number
  riskBand: RiskBand
  noActionRiskProbScaled: number
  noActionRiskBand: RiskBand
  simulatedActionTaken: string | null
  realizedEvidence: RealizedEvidence
} {
  const first = rows[0]
  const riskProbAvg = mean(rows.map(r => r.riskProbScaled))
  const noActionRiskProbAvg = mean(rows.map(r => r.noActionRiskProbScaled))
  const maxBand = (key: 'riskBand' | 'noActionRiskBand'): RiskBand => {
    const rank = (b: RiskBand) => (b === 'High' ? 2 : b === 'Medium' ? 1 : 0)
    return rows.reduce<RiskBand>((acc, row) => (rank(row[key]) > rank(acc) ? row[key] : acc), 'Low')
  }
  // Mean marks across offerings, preserving nulls when all rows are null.
  const meanScalar = (key: keyof RealizedEvidence): number | null => {
    const values = rows.map(r => r.realizedEvidence[key]).filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v),
    )
    if (values.length === 0) return null
    return roundToTwo(values.reduce((s, v) => s + v, 0) / values.length)
  }
  const aggEvidence: RealizedEvidence = {
    attendancePct: meanScalar('attendancePct') ?? 0,
    tt1Pct: meanScalar('tt1Pct'),
    tt2Pct: meanScalar('tt2Pct'),
    quizPct: meanScalar('quizPct'),
    assignmentPct: meanScalar('assignmentPct'),
    seePct: meanScalar('seePct'),
    // weakCoCount / weakQuestionCount are counts — sum rather than mean would
    // overweight; use mean to stay on the same scale as single-offering view.
    weakCoCount: Math.round(mean(rows.map(r => r.realizedEvidence.weakCoCount))),
    weakQuestionCount: Math.round(mean(rows.map(r => r.realizedEvidence.weakQuestionCount))),
    interventionResponseScore: meanScalar('interventionResponseScore'),
  }
  // Simulated action: take the first non-null action seen (deterministic given
  // input ordering). If none, null.
  const actionTaken = rows.find(r => r.simulatedActionTaken != null)?.simulatedActionTaken ?? null
  return {
    studentId: first.studentId,
    semesterNumber: first.semesterNumber,
    stageKey: first.stageKey,
    riskProbScaled: riskProbAvg,
    riskBand: maxBand('riskBand'),
    noActionRiskProbScaled: noActionRiskProbAvg,
    noActionRiskBand: maxBand('noActionRiskBand'),
    simulatedActionTaken: actionTaken,
    realizedEvidence: aggEvidence,
  }
}

function computeLiftBins(perStagePoints: StudentStageCounterfactual[]): ProjectedFinalReport['liftDistribution'] {
  const bins: ProjectedFinalReport['liftDistribution'] = [
    { binLabel: '-100..-50', lowerInclusive: -100, upperExclusive: -50, count: 0 },
    { binLabel: '-50..-20', lowerInclusive: -50, upperExclusive: -20, count: 0 },
    { binLabel: '-20..-5', lowerInclusive: -20, upperExclusive: -5, count: 0 },
    { binLabel: '-5..5', lowerInclusive: -5, upperExclusive: 5, count: 0 },
    { binLabel: '5..20', lowerInclusive: 5, upperExclusive: 20, count: 0 },
    { binLabel: '20..50', lowerInclusive: 20, upperExclusive: 50, count: 0 },
    { binLabel: '50..100', lowerInclusive: 50, upperExclusive: 101, count: 0 },
  ]
  for (const point of perStagePoints) {
    const lift = point.liftProbScaled
    for (const bin of bins) {
      if (lift >= bin.lowerInclusive && lift < bin.upperExclusive) {
        bin.count += 1
        break
      }
    }
  }
  return bins
}

// ---------- Entry point ----------

export function buildSimulatorCounterfactualReport(input: {
  runId: string
  generatedAt: string
  rows: SimulatorProjectionInputRow[]
}): CounterfactualSimulatorReport {
  // Step 1: group rows by (studentId, semesterNumber, stageKey) — collapsing
  // across offerings.
  const groupsByKey = new Map<string, SimulatorProjectionInputRow[]>()
  for (const row of input.rows) {
    const key = `${row.studentId}::${row.semesterNumber}::${row.stageKey}`
    const bucket = groupsByKey.get(key) ?? []
    bucket.push(row)
    groupsByKey.set(key, bucket)
  }

  // Step 2: per-student per-stage aggregation → counterfactual diff + band
  // transition.
  const perStudentPerStage: StudentStageCounterfactual[] = []
  for (const rows of groupsByKey.values()) {
    const agg = aggregateAcrossOfferings(rows)
    const noActionEvidence = reconstructNoActionEvidence({
      stageKey: agg.stageKey,
      simulatedActionTaken: agg.simulatedActionTaken,
      realizedEvidence: agg.realizedEvidence,
    })
    const markDeltas: Partial<Record<CounterfactualScalarKey, number>> = {}
    const realizedMarks: Partial<Record<CounterfactualScalarKey, number>> = {}
    const noActionMarks: Partial<Record<CounterfactualScalarKey, number>> = {}
    for (const scalar of MARK_SCALAR_KEYS) {
      const realizedValue = agg.realizedEvidence[scalar]
      const noActionValue = noActionEvidence[scalar]
      if (typeof realizedValue === 'number' && Number.isFinite(realizedValue)) {
        realizedMarks[scalar] = roundToTwo(realizedValue)
      }
      if (typeof noActionValue === 'number' && Number.isFinite(noActionValue)) {
        noActionMarks[scalar] = roundToTwo(noActionValue)
      }
      if (
        typeof realizedValue === 'number' && Number.isFinite(realizedValue)
        && typeof noActionValue === 'number' && Number.isFinite(noActionValue)
      ) {
        markDeltas[scalar] = roundToTwo(realizedValue - noActionValue)
      }
    }
    perStudentPerStage.push({
      studentId: agg.studentId,
      semesterNumber: agg.semesterNumber,
      stageKey: agg.stageKey,
      realizedRiskProbScaled: agg.riskProbScaled,
      realizedRiskBand: agg.riskBand,
      noActionRiskProbScaled: agg.noActionRiskProbScaled,
      noActionRiskBand: agg.noActionRiskBand,
      liftProbScaled: roundToTwo(agg.noActionRiskProbScaled - agg.riskProbScaled),
      markDeltas,
      realizedMarks,
      noActionMarks,
      bandTransition: bandTransitionLabel(agg.riskBand, agg.noActionRiskBand),
      simulatedActionTaken: agg.simulatedActionTaken,
    })
  }

  // Deterministic ordering: semester asc, stage asc, studentId asc.
  perStudentPerStage.sort((left, right) => {
    if (left.semesterNumber !== right.semesterNumber) return left.semesterNumber - right.semesterNumber
    const leftStageIdx = STAGE_ORDER.indexOf(left.stageKey)
    const rightStageIdx = STAGE_ORDER.indexOf(right.stageKey)
    if (leftStageIdx !== rightStageIdx) return leftStageIdx - rightStageIdx
    return left.studentId.localeCompare(right.studentId)
  })

  // Step 3: semester-stage aggregate.
  const bySemesterStageMap = new Map<string, StudentStageCounterfactual[]>()
  for (const point of perStudentPerStage) {
    const key = `${point.semesterNumber}::${point.stageKey}`
    const bucket = bySemesterStageMap.get(key) ?? []
    bucket.push(point)
    bySemesterStageMap.set(key, bucket)
  }
  const bySemesterStage: SemesterStageAggregate[] = []
  for (const [, points] of bySemesterStageMap.entries()) {
    const first = points[0]
    const meanMarkDeltas: Partial<Record<CounterfactualScalarKey, number>> = {}
    for (const scalar of MARK_SCALAR_KEYS) {
      const samples = points
        .map(p => p.markDeltas[scalar])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      if (samples.length > 0) meanMarkDeltas[scalar] = mean(samples)
    }
    bySemesterStage.push({
      semesterNumber: first.semesterNumber,
      stageKey: first.stageKey,
      studentCount: points.length,
      meanRealizedRiskProbScaled: mean(points.map(p => p.realizedRiskProbScaled)),
      meanNoActionRiskProbScaled: mean(points.map(p => p.noActionRiskProbScaled)),
      meanLiftProbScaled: mean(points.map(p => p.liftProbScaled)),
      bandTransitions: {
        preventedHigh: points.filter(p => p.bandTransition === 'prevented-high').length,
        preventedMedium: points.filter(p => p.bandTransition === 'prevented-medium').length,
        regression: points.filter(p => p.bandTransition === 'regression').length,
        noChange: points.filter(p => p.bandTransition === 'no-change').length,
      },
      meanMarkDeltas,
    })
  }
  bySemesterStage.sort((left, right) => {
    if (left.semesterNumber !== right.semesterNumber) return left.semesterNumber - right.semesterNumber
    return STAGE_ORDER.indexOf(left.stageKey) - STAGE_ORDER.indexOf(right.stageKey)
  })

  // Step 4: semester aggregate.
  const bySemesterMap = new Map<number, StudentStageCounterfactual[]>()
  for (const point of perStudentPerStage) {
    const bucket = bySemesterMap.get(point.semesterNumber) ?? []
    bucket.push(point)
    bySemesterMap.set(point.semesterNumber, bucket)
  }
  const bySemester: SemesterAggregate[] = []
  for (const [semesterNumber, points] of bySemesterMap.entries()) {
    // projectedFailuresPrevented: unique students whose final stage (highest
    // stage index) within this semester had prevented-high/prevented-medium.
    const finalStageByStudent = new Map<string, StudentStageCounterfactual>()
    for (const point of points) {
      const prev = finalStageByStudent.get(point.studentId)
      if (!prev) {
        finalStageByStudent.set(point.studentId, point)
        continue
      }
      const prevIdx = STAGE_ORDER.indexOf(prev.stageKey)
      const currIdx = STAGE_ORDER.indexOf(point.stageKey)
      if (currIdx > prevIdx) {
        finalStageByStudent.set(point.studentId, point)
      }
    }
    const projectedFailuresPrevented = Array.from(finalStageByStudent.values())
      .filter(p => p.bandTransition === 'prevented-high' || p.bandTransition === 'prevented-medium')
      .length
    bySemester.push({
      semesterNumber,
      studentCount: new Set(points.map(p => p.studentId)).size,
      meanRealizedRiskProbScaled: mean(points.map(p => p.realizedRiskProbScaled)),
      meanNoActionRiskProbScaled: mean(points.map(p => p.noActionRiskProbScaled)),
      meanLiftProbScaled: mean(points.map(p => p.liftProbScaled)),
      preventedHighTotal: points.filter(p => p.bandTransition === 'prevented-high').length,
      preventedMediumTotal: points.filter(p => p.bandTransition === 'prevented-medium').length,
      regressionTotal: points.filter(p => p.bandTransition === 'regression').length,
      projectedFailuresPrevented,
    })
  }
  bySemester.sort((left, right) => left.semesterNumber - right.semesterNumber)

  // Step 5: projected final — full-run projection.
  const uniqueStudents = new Set(perStudentPerStage.map(p => p.studentId))
  const uniqueSemesters = new Set(perStudentPerStage.map(p => p.semesterNumber))
  const projectedFinal: ProjectedFinalReport = {
    runId: input.runId,
    generatedAt: input.generatedAt,
    totalStudents: uniqueStudents.size,
    totalSemesters: uniqueSemesters.size,
    totalStagePoints: perStudentPerStage.length,
    meanRealizedRiskProbScaled: mean(perStudentPerStage.map(p => p.realizedRiskProbScaled)),
    meanNoActionRiskProbScaled: mean(perStudentPerStage.map(p => p.noActionRiskProbScaled)),
    meanLiftProbScaled: mean(perStudentPerStage.map(p => p.liftProbScaled)),
    projectedFailuresPreventedTotal: bySemester.reduce((sum, s) => sum + s.projectedFailuresPrevented, 0),
    liftDistribution: computeLiftBins(perStudentPerStage),
  }

  return {
    runId: input.runId,
    generatedAt: input.generatedAt,
    perStudentPerStage,
    bySemesterStage,
    bySemester,
    projectedFinal,
  }
}
