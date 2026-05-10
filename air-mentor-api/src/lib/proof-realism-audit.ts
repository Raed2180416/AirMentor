type Verdict = 'pass' | 'fail'

type CheckpointRow = {
  simulationStageCheckpointId: string
  semesterNumber: number
  stageKey: string
  stageOrder: number
}

type ProjectionRow = {
  simulationStageCheckpointId: string
  studentId: string
  semesterNumber: number
  sectionCode: string
  courseCode: string
  riskProbScaled: number
  riskBand: string
  projectionJson: string
}

type NumericSummary = {
  count: number
  mean: number
  stdev: number
  min: number
  max: number
}

type SectionSummary = {
  projectionCount: number
  postSeeCount: number
  meanPostSeeOverallPct: number
  meanRiskProbScaled: number
}

export type ProofRealismAuditReport = {
  stageMatrix: {
    verdict: Verdict
    checkpointCount: number
    studentProjectionCount: number
    missingStageKeys: string[]
    projectionCoverageByCheckpoint: Array<{ checkpointId: string; count: number }>
  }
  markProgression: {
    verdict: Verdict
    postSeeOverall: NumericSummary
    postSeeCe: NumericSummary
    postSeeSee: NumericSummary
    invalidMarkCount: number
  }
  riskAlignment: {
    verdict: Verdict
    overallPctRiskCorrelation: number
    highRiskMeanOverallPct: number
    lowRiskMeanOverallPct: number
    highRiskCount: number
    lowRiskCount: number
  }
  sections: Record<string, SectionSummary>
  issues: string[]
}

export type ProofClassroomSetupComparison = {
  verdict: Verdict
  sectionBMeanOverallDelta: number
  sectionBRiskDelta: number
  issues: string[]
}

const EXPECTED_STAGE_KEYS = Array.from({ length: 6 }, (_, semesterIndex) => {
  const semesterNumber = semesterIndex + 1
  return ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'].map(stage => `${semesterNumber}:${stage}`)
}).flat()

function roundTo(value: number, places: number) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function numberOrNull(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function safeJson(raw: string) {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function readProjection(row: ProjectionRow) {
  const payload = safeJson(row.projectionJson)
  const evidence = (payload.currentEvidence && typeof payload.currentEvidence === 'object')
    ? payload.currentEvidence as Record<string, unknown>
    : {}
  const status = (payload.currentStatus && typeof payload.currentStatus === 'object')
    ? payload.currentStatus as Record<string, unknown>
    : {}
  return { evidence, status }
}

function summarize(values: number[]): NumericSummary {
  if (values.length === 0) return { count: 0, mean: 0, stdev: 0, min: 0, max: 0 }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
  return {
    count: values.length,
    mean: roundTo(mean, 4),
    stdev: roundTo(Math.sqrt(variance), 4),
    min: roundTo(Math.min(...values), 4),
    max: roundTo(Math.max(...values), 4),
  }
}

function pearson(left: number[], right: number[]) {
  if (left.length < 2 || left.length !== right.length) return 0
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length
  let numerator = 0
  let leftSq = 0
  let rightSq = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index]! - leftMean
    const rightDelta = right[index]! - rightMean
    numerator += leftDelta * rightDelta
    leftSq += leftDelta ** 2
    rightSq += rightDelta ** 2
  }
  const denominator = Math.sqrt(leftSq * rightSq)
  return denominator === 0 ? 0 : roundTo(numerator / denominator, 6)
}

function mean(values: number[]) {
  if (values.length === 0) return 0
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 4)
}

function sectionSummaries(rows: ProjectionRow[]) {
  const grouped: Record<string, ProjectionRow[]> = {}
  for (const row of rows) grouped[row.sectionCode] = [...(grouped[row.sectionCode] ?? []), row]
  return Object.fromEntries(Object.entries(grouped).map(([sectionCode, sectionRows]) => {
    const postSeeOverall = sectionRows
      .filter(row => row.semesterNumber === 6)
      .map(row => numberOrNull(readProjection(row).evidence.overallPct))
      .filter((value): value is number => value != null)
    return [sectionCode, {
      projectionCount: sectionRows.length,
      postSeeCount: postSeeOverall.length,
      meanPostSeeOverallPct: mean(postSeeOverall),
      meanRiskProbScaled: mean(sectionRows.map(row => row.riskProbScaled)),
    } satisfies SectionSummary]
  }))
}

export function auditProofRealismRows(input: {
  checkpointRows: CheckpointRow[]
  projectionRows: ProjectionRow[]
}): ProofRealismAuditReport {
  const issues: string[] = []
  const matrixKeys = new Set(input.checkpointRows.map(row => `${row.semesterNumber}:${row.stageKey}`))
  const missingStageKeys = EXPECTED_STAGE_KEYS.filter(key => input.checkpointRows.length > 0 && !matrixKeys.has(key))
  const projectionCoverageByCheckpoint = input.checkpointRows.map(checkpoint => ({
    checkpointId: checkpoint.simulationStageCheckpointId,
    count: input.projectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId).length,
  }))
  if (missingStageKeys.length > 0) issues.push(`Missing stage checkpoints: ${missingStageKeys.join(', ')}`)
  if (projectionCoverageByCheckpoint.some(item => item.count === 0)) issues.push('At least one checkpoint has no student projections')

  const postSeeRows = input.projectionRows.filter(row => {
    const { evidence } = readProjection(row)
    return numberOrNull(evidence.overallPct) != null
      && numberOrNull(evidence.cePct) != null
      && numberOrNull(evidence.seePct) != null
  })
  const overallValues = postSeeRows.map(row => numberOrNull(readProjection(row).evidence.overallPct)).filter((value): value is number => value != null)
  const ceValues = postSeeRows.map(row => numberOrNull(readProjection(row).evidence.cePct)).filter((value): value is number => value != null)
  const seeValues = postSeeRows.map(row => numberOrNull(readProjection(row).evidence.seePct)).filter((value): value is number => value != null)
  const allMarkValues = input.projectionRows.flatMap(row => {
    const { evidence } = readProjection(row)
    return ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct']
      .map(key => numberOrNull(evidence[key]))
      .filter((value): value is number => value != null)
  })
  const invalidMarkCount = allMarkValues.filter(value => value < 0 || value > 100).length
  if (invalidMarkCount > 0) issues.push(`${invalidMarkCount} marks outside 0..100`)
  const postSeeOverall = summarize(overallValues)
  if (postSeeOverall.count === 0) issues.push('No post-SEE overall marks found')
  if (postSeeOverall.count > 0 && (postSeeOverall.mean < 45 || postSeeOverall.mean > 82)) issues.push(`Post-SEE mean ${postSeeOverall.mean} outside plausible band`)
  if (postSeeOverall.count > 1 && postSeeOverall.stdev < 5) issues.push(`Post-SEE standard deviation ${postSeeOverall.stdev} too compressed`)

  const riskPairs = postSeeRows.map(row => {
    const { evidence, status } = readProjection(row)
    return {
      overall: numberOrNull(evidence.overallPct),
      risk: numberOrNull(status.riskProbScaled) ?? row.riskProbScaled,
      band: row.riskBand,
    }
  }).filter(pair => pair.overall != null)
  const overallPctRiskCorrelation = pearson(
    riskPairs.map(pair => pair.overall!),
    riskPairs.map(pair => pair.risk),
  )
  const highRiskOverall = riskPairs.filter(pair => pair.band === 'High' || pair.risk >= 70).map(pair => pair.overall!)
  const lowRiskOverall = riskPairs.filter(pair => pair.band === 'Low' || pair.risk < 45).map(pair => pair.overall!)
  const highRiskMeanOverallPct = mean(highRiskOverall)
  const lowRiskMeanOverallPct = mean(lowRiskOverall)
  if (riskPairs.length > 10 && overallPctRiskCorrelation >= -0.05) issues.push(`Risk correlation ${overallPctRiskCorrelation} is not inverse enough`)
  if (highRiskOverall.length > 0 && lowRiskOverall.length > 0 && highRiskMeanOverallPct >= lowRiskMeanOverallPct) issues.push('High-risk students do not have lower mean overall marks than low-risk students')

  return {
    stageMatrix: {
      verdict: missingStageKeys.length === 0 && projectionCoverageByCheckpoint.every(item => item.count > 0) ? 'pass' : 'fail',
      checkpointCount: input.checkpointRows.length,
      studentProjectionCount: input.projectionRows.length,
      missingStageKeys,
      projectionCoverageByCheckpoint,
    },
    markProgression: {
      verdict: invalidMarkCount === 0 && postSeeOverall.count > 0 && postSeeOverall.mean >= 45 && postSeeOverall.mean <= 82 && postSeeOverall.stdev >= 5 ? 'pass' : 'fail',
      postSeeOverall,
      postSeeCe: summarize(ceValues),
      postSeeSee: summarize(seeValues),
      invalidMarkCount,
    },
    riskAlignment: {
      verdict: overallPctRiskCorrelation < -0.05 && (highRiskOverall.length === 0 || lowRiskOverall.length === 0 || highRiskMeanOverallPct < lowRiskMeanOverallPct) ? 'pass' : 'fail',
      overallPctRiskCorrelation,
      highRiskMeanOverallPct,
      lowRiskMeanOverallPct,
      highRiskCount: highRiskOverall.length,
      lowRiskCount: lowRiskOverall.length,
    },
    sections: sectionSummaries(input.projectionRows),
    issues,
  }
}

export function compareProofClassroomSetups(input: {
  baseline: ProofRealismAuditReport
  candidate: ProofRealismAuditReport
  expectedDirection: 'candidate-section-b-stressed'
  minSectionBMeanOverallDrop?: number
  minSectionBRiskIncrease?: number
}): ProofClassroomSetupComparison {
  const issues: string[] = []
  const baselineB = input.baseline.sections.B
  const candidateB = input.candidate.sections.B
  if (!baselineB || !candidateB) issues.push('Missing section B in one setup')
  const sectionBMeanOverallDelta = candidateB && baselineB
    ? roundTo(candidateB.meanPostSeeOverallPct - baselineB.meanPostSeeOverallPct, 4)
    : 0
  const sectionBRiskDelta = candidateB && baselineB
    ? roundTo(candidateB.meanRiskProbScaled - baselineB.meanRiskProbScaled, 4)
    : 0
  const minSectionBMeanOverallDrop = input.minSectionBMeanOverallDrop ?? 4
  const minSectionBRiskIncrease = input.minSectionBRiskIncrease ?? 5
  if (input.expectedDirection === 'candidate-section-b-stressed') {
    if (sectionBMeanOverallDelta > -minSectionBMeanOverallDrop) issues.push(`Section B overall delta ${sectionBMeanOverallDelta} is not materially lower`)
    if (sectionBRiskDelta <= minSectionBRiskIncrease) issues.push(`Section B risk delta ${sectionBRiskDelta} is not materially higher`)
  }
  return {
    verdict: issues.length === 0 ? 'pass' : 'fail',
    sectionBMeanOverallDelta,
    sectionBRiskDelta,
    issues,
  }
}
