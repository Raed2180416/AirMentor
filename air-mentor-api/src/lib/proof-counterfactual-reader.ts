// Phase-11 counterfactual reader (2026-04-23).
//
// Given two snapshots of per-student per-stage marks for the SAME seeded run
// — one under the baseline (AIRMENTOR_STAGE_REALIZATION_V1 off = unmodified
// seeded trajectory) and one under the realized path (flag on + interventions
// applied) — this module produces a deterministic diff report that answers
// "how much did interventions actually move the needle?".
//
// Pure fn: no DB / filesystem I/O. Operates on two arrays of row shapes
// matching what /api/proof/runs/:id/students/:sid/marks returns. Safe to call
// in unit tests without any infra setup.
//
// Flag gating: the reader itself is flag-agnostic. Callers choose which pair
// of runs to pass in. The UI consumer will read both via the same API with
// different AIRMENTOR_STAGE_REALIZATION_V1 env-pins at the server boundary.

// ---------- Input shapes ----------

export type ProofMarkSnapshotRow = {
  studentId: string
  semesterNumber: number
  stageKey: 'pre-tt1' | 'post-tt1' | 'post-tt2' | 'pre-see' | 'post-see'
  tt1Pct?: number | null
  tt2Pct?: number | null
  quizPct?: number | null
  assignmentPct?: number | null
  seePct?: number | null
  totalPct?: number | null
}

// ---------- Output shapes ----------

export type CounterfactualScalar = 'tt1Pct' | 'tt2Pct' | 'quizPct' | 'assignmentPct' | 'seePct' | 'totalPct'

export type CounterfactualStudentStageDiff = {
  studentId: string
  semesterNumber: number
  stageKey: string
  // Delta = realized - baseline for each mark scalar. Null when either side
  // missing / undefined (i.e. the scalar is not yet realized at this stage).
  deltas: Partial<Record<CounterfactualScalar, number>>
}

export type CounterfactualAggregate = {
  totalStudents: number
  totalStages: number
  totalStudentStagePairs: number
  byScalar: Record<CounterfactualScalar, {
    samples: number
    meanDelta: number
    medianDelta: number
    positiveCount: number
    negativeCount: number
    zeroCount: number
    maxDelta: number
    minDelta: number
  }>
}

export type CounterfactualReport = {
  runIdBaseline: string
  runIdRealized: string
  studentStageDiffs: CounterfactualStudentStageDiff[]
  aggregate: CounterfactualAggregate
}

// ---------- Pure helpers ----------

const SCALAR_KEYS: ReadonlyArray<CounterfactualScalar> = [
  'tt1Pct',
  'tt2Pct',
  'quizPct',
  'assignmentPct',
  'seePct',
  'totalPct',
]

function rowKey(row: ProofMarkSnapshotRow): string {
  return `${row.studentId}::${row.semesterNumber}::${row.stageKey}`
}

function toMap(rows: ProofMarkSnapshotRow[]): Map<string, ProofMarkSnapshotRow> {
  const map = new Map<string, ProofMarkSnapshotRow>()
  for (const row of rows) {
    map.set(rowKey(row), row)
  }
  return map
}

function diffScalars(
  baseline: ProofMarkSnapshotRow,
  realized: ProofMarkSnapshotRow,
): Partial<Record<CounterfactualScalar, number>> {
  const deltas: Partial<Record<CounterfactualScalar, number>> = {}
  for (const scalar of SCALAR_KEYS) {
    const bv = baseline[scalar]
    const rv = realized[scalar]
    if (bv == null || rv == null) continue
    if (!Number.isFinite(bv) || !Number.isFinite(rv)) continue
    // Round delta to 4 decimals to absorb floating-point noise. Enough
    // precision for a %-scale delta while remaining test-stable.
    deltas[scalar] = Math.round((rv - bv) * 10_000) / 10_000
  }
  return deltas
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

function buildAggregate(diffs: CounterfactualStudentStageDiff[]): CounterfactualAggregate {
  const uniqueStudents = new Set<string>()
  const uniqueStages = new Set<string>()
  const samplesByScalar: Record<CounterfactualScalar, number[]> = {
    tt1Pct: [],
    tt2Pct: [],
    quizPct: [],
    assignmentPct: [],
    seePct: [],
    totalPct: [],
  }
  for (const diff of diffs) {
    uniqueStudents.add(diff.studentId)
    uniqueStages.add(`${diff.semesterNumber}::${diff.stageKey}`)
    for (const scalar of SCALAR_KEYS) {
      const value = diff.deltas[scalar]
      if (value != null && Number.isFinite(value)) samplesByScalar[scalar].push(value)
    }
  }
  const byScalar = {} as CounterfactualAggregate['byScalar']
  for (const scalar of SCALAR_KEYS) {
    const samples = samplesByScalar[scalar]
    const mean = samples.length === 0 ? 0 : samples.reduce((s, v) => s + v, 0) / samples.length
    byScalar[scalar] = {
      samples: samples.length,
      meanDelta: Math.round(mean * 10_000) / 10_000,
      medianDelta: Math.round(median(samples) * 10_000) / 10_000,
      positiveCount: samples.filter(v => v > 0.001).length,
      negativeCount: samples.filter(v => v < -0.001).length,
      zeroCount: samples.filter(v => Math.abs(v) <= 0.001).length,
      maxDelta: samples.length === 0 ? 0 : Math.max(...samples),
      minDelta: samples.length === 0 ? 0 : Math.min(...samples),
    }
  }
  return {
    totalStudents: uniqueStudents.size,
    totalStages: uniqueStages.size,
    totalStudentStagePairs: diffs.length,
    byScalar,
  }
}

// ---------- Entry point ----------

export function buildCounterfactualReport(input: {
  runIdBaseline: string
  runIdRealized: string
  baselineRows: ProofMarkSnapshotRow[]
  realizedRows: ProofMarkSnapshotRow[]
}): CounterfactualReport {
  const baselineMap = toMap(input.baselineRows)
  const realizedMap = toMap(input.realizedRows)

  // Iterate over realizedMap (the flag-on path) — if a student-stage was
  // realized but has no baseline, we skip the pair (cannot diff). The
  // aggregate's totalStudents counts only students with at least one pair.
  const diffs: CounterfactualStudentStageDiff[] = []
  for (const [key, realizedRow] of realizedMap.entries()) {
    const baselineRow = baselineMap.get(key)
    if (!baselineRow) continue
    const deltas = diffScalars(baselineRow, realizedRow)
    if (Object.keys(deltas).length === 0) continue
    diffs.push({
      studentId: realizedRow.studentId,
      semesterNumber: realizedRow.semesterNumber,
      stageKey: realizedRow.stageKey,
      deltas,
    })
  }
  // Deterministic ordering: by (semesterNumber, stageKey, studentId).
  const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'pre-see', 'post-see']
  diffs.sort((a, b) => {
    if (a.semesterNumber !== b.semesterNumber) return a.semesterNumber - b.semesterNumber
    const aStageIdx = stageOrder.indexOf(a.stageKey)
    const bStageIdx = stageOrder.indexOf(b.stageKey)
    if (aStageIdx !== bStageIdx) return aStageIdx - bStageIdx
    return a.studentId.localeCompare(b.studentId)
  })

  return {
    runIdBaseline: input.runIdBaseline,
    runIdRealized: input.runIdRealized,
    studentStageDiffs: diffs,
    aggregate: buildAggregate(diffs),
  }
}
