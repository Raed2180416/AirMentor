type Verdict = 'pass' | 'fail'

type StageKey = 'pre-tt1' | 'post-tt1' | 'post-tt2' | 'post-assignments' | 'post-see'

type SignalKey = 'attendancePct' | 'tt1Pct' | 'tt2Pct' | 'quizPct' | 'assignmentPct' | 'cePct' | 'seePct' | 'overallPct'

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

type TimelineEntry = {
  studentId: string
  semesterNumber: number
  stageKey: string
  attendancePct: number | null
  tt1Pct: number | null
  tt2Pct: number | null
  quizPct: number | null
  assignmentPct: number | null
  cePct: number | null
  seePct: number | null
  overallPct: number | null
  currentCgpa: number | null
  backlogCount: number | null
  riskProbScaled: number | null
  riskBand: string
}

export type ProofForensicRealismAuditReport = {
  stageVisibility: {
    verdict: Verdict
    checkpointCount: number
    projectionCount: number
    futureLeakCount: number
    missingRequiredEvidenceCount: number
    checkedStageKeys: string[]
  }
  riskDriverAlignment: {
    verdict: Verdict
    highRiskPostSeeCount: number
    explainedHighRiskCount: number
    unexplainedHighRiskCount: number
  }
  aggregateRealism: {
    verdict: Verdict
    postSeeProjectionCount: number
    postSeePassRate: number
    highRiskShare: number
    mediumRiskShare: number
    lowRiskShare: number
    sectionSummaries: Record<string, { projectionCount: number; meanRisk: number; meanOverall: number }>
  }
  trajectoryAnomalies: {
    futureLeakage: string[]
    missingRequiredEvidence: string[]
    impossibleJumps: string[]
    riskDriverMismatch: string[]
    sectionImbalance: string[]
  }
  selectedStudentTimeline: TimelineEntry[]
  issues: string[]
}

const stageOrder: StageKey[] = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']
const allSignals: SignalKey[] = ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct']
const visibleByStage: Record<StageKey, ReadonlyArray<SignalKey>> = {
  'pre-tt1': ['attendancePct'],
  'post-tt1': ['attendancePct', 'tt1Pct'],
  'post-tt2': ['attendancePct', 'tt1Pct', 'tt2Pct'],
  'post-assignments': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct'],
  'post-see': ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'cePct', 'seePct', 'overallPct'],
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function safeJson(raw: string) {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function objectOrEmpty(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function numberOrNull(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function readProjection(row: ProjectionRow) {
  const payload = safeJson(row.projectionJson)
  const evidence = objectOrEmpty(payload.currentEvidence)
  const status = objectOrEmpty(payload.currentStatus)
  return { evidence, status }
}

function mean(values: number[]) {
  if (values.length === 0) return 0
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 4)
}

function share(count: number, total: number) {
  if (total === 0) return 0
  return roundTo(count / total, 4)
}

function isStageKey(stageKey: string): stageKey is StageKey {
  return stageOrder.includes(stageKey as StageKey)
}

function rowRisk(row: ProjectionRow, status: Record<string, unknown>) {
  return numberOrNull(status.riskProbScaled) ?? row.riskProbScaled
}

function rowRiskBand(row: ProjectionRow, status: Record<string, unknown>) {
  return typeof status.riskBand === 'string' ? status.riskBand : row.riskBand
}

function isHighRisk(row: ProjectionRow, status: Record<string, unknown>) {
  return rowRiskBand(row, status).toLowerCase() === 'high' || rowRisk(row, status) >= 70
}

function explainableHighRisk(evidence: Record<string, unknown>, status: Record<string, unknown>) {
  const attendancePct = numberOrNull(evidence.attendancePct)
  const overallPct = numberOrNull(evidence.overallPct)
  const seePct = numberOrNull(evidence.seePct)
  const backlogCount = numberOrNull(status.backlogCount) ?? numberOrNull(evidence.backlogCount)
  const currentCgpa = numberOrNull(status.currentCgpa) ?? numberOrNull(evidence.currentCgpa)
  return (attendancePct != null && attendancePct < 75)
    || (overallPct != null && overallPct < 60)
    || (seePct != null && seePct < 55)
    || (backlogCount != null && backlogCount > 0)
    || (currentCgpa != null && currentCgpa < 7)
}

function signalValue(evidence: Record<string, unknown>, signal: SignalKey) {
  return numberOrNull(evidence[signal])
}

function buildTimeline(input: {
  projectionRows: ProjectionRow[]
  checkpointById: Map<string, CheckpointRow>
}) {
  const sorted = [...input.projectionRows].sort((left, right) => {
    const leftCheckpoint = input.checkpointById.get(left.simulationStageCheckpointId)
    const rightCheckpoint = input.checkpointById.get(right.simulationStageCheckpointId)
    return left.studentId.localeCompare(right.studentId)
      || left.semesterNumber - right.semesterNumber
      || (leftCheckpoint?.stageOrder ?? 999) - (rightCheckpoint?.stageOrder ?? 999)
      || left.courseCode.localeCompare(right.courseCode)
  })
  const selectedStudentId = sorted[0]?.studentId
  if (!selectedStudentId) return []
  return sorted.filter(row => row.studentId === selectedStudentId).map(row => {
    const checkpoint = input.checkpointById.get(row.simulationStageCheckpointId)
    const { evidence, status } = readProjection(row)
    return {
      studentId: row.studentId,
      semesterNumber: row.semesterNumber,
      stageKey: checkpoint?.stageKey ?? 'unknown',
      attendancePct: signalValue(evidence, 'attendancePct'),
      tt1Pct: signalValue(evidence, 'tt1Pct'),
      tt2Pct: signalValue(evidence, 'tt2Pct'),
      quizPct: signalValue(evidence, 'quizPct'),
      assignmentPct: signalValue(evidence, 'assignmentPct'),
      cePct: signalValue(evidence, 'cePct'),
      seePct: signalValue(evidence, 'seePct'),
      overallPct: signalValue(evidence, 'overallPct'),
      currentCgpa: numberOrNull(status.currentCgpa) ?? numberOrNull(evidence.currentCgpa),
      backlogCount: numberOrNull(status.backlogCount) ?? numberOrNull(evidence.backlogCount),
      riskProbScaled: rowRisk(row, status),
      riskBand: rowRiskBand(row, status),
    }
  })
}

function aggregateSections(rows: ProjectionRow[]) {
  const grouped: Record<string, ProjectionRow[]> = {}
  for (const row of rows) grouped[row.sectionCode] = [...(grouped[row.sectionCode] ?? []), row]
  return Object.fromEntries(Object.entries(grouped).map(([sectionCode, sectionRows]) => {
    const risks = sectionRows.map(row => rowRisk(row, readProjection(row).status))
    const overall = sectionRows
      .map(row => signalValue(readProjection(row).evidence, 'overallPct'))
      .filter((value): value is number => value != null)
    return [sectionCode, {
      projectionCount: sectionRows.length,
      meanRisk: mean(risks),
      meanOverall: mean(overall),
    }]
  }))
}

export function auditProofForensicRealismRows(input: {
  checkpointRows: CheckpointRow[]
  projectionRows: ProjectionRow[]
}): ProofForensicRealismAuditReport {
  const checkpointById = new Map(input.checkpointRows.map(row => [row.simulationStageCheckpointId, row]))
  const futureLeakage: string[] = []
  const missingRequiredEvidence: string[] = []
  const impossibleJumps: string[] = []
  const riskDriverMismatch: string[] = []
  const sectionImbalance: string[] = []
  const issues: string[] = []

  for (const row of input.projectionRows) {
    const checkpoint = checkpointById.get(row.simulationStageCheckpointId)
    if (!checkpoint) {
      missingRequiredEvidence.push(`${row.studentId}:${row.courseCode}:missing checkpoint ${row.simulationStageCheckpointId}`)
      continue
    }
    if (!isStageKey(checkpoint.stageKey)) {
      missingRequiredEvidence.push(`${row.studentId}:${row.courseCode}:unknown stage ${checkpoint.stageKey}`)
      continue
    }
    const { evidence } = readProjection(row)
    const visibleSignals = visibleByStage[checkpoint.stageKey]
    for (const signal of allSignals) {
      if (visibleSignals.includes(signal)) {
        if (evidence[signal] == null) missingRequiredEvidence.push(`${checkpoint.semesterNumber}:${checkpoint.stageKey}:${row.studentId}:${row.courseCode}:${signal}`)
      } else if (evidence[signal] != null) {
        futureLeakage.push(`${checkpoint.semesterNumber}:${checkpoint.stageKey}:${row.studentId}:${row.courseCode}:${signal}`)
      }
    }
  }

  const postSeeRows = input.projectionRows.filter(row => checkpointById.get(row.simulationStageCheckpointId)?.stageKey === 'post-see')
  const postSeeWithOverall = postSeeRows
    .map(row => ({ row, projection: readProjection(row) }))
    .filter(item => signalValue(item.projection.evidence, 'overallPct') != null)
  const passingPostSeeCount = postSeeWithOverall.filter(item => signalValue(item.projection.evidence, 'overallPct')! >= 50).length
  const postSeePassRate = share(passingPostSeeCount, postSeeWithOverall.length)

  let highRiskPostSeeCount = 0
  let explainedHighRiskCount = 0
  for (const row of postSeeRows) {
    const { evidence, status } = readProjection(row)
    if (!isHighRisk(row, status)) continue
    highRiskPostSeeCount += 1
    if (explainableHighRisk(evidence, status)) explainedHighRiskCount += 1
    else riskDriverMismatch.push(`${row.studentId}:${row.courseCode}:high risk without attendance/overall/SEE/backlog/CGPA driver`)
  }

  const riskBands = postSeeRows.map(row => {
    const { status } = readProjection(row)
    const band = rowRiskBand(row, status).toLowerCase()
    const risk = rowRisk(row, status)
    if (band === 'high' || risk >= 70) return 'high'
    if (band === 'low' || risk < 45) return 'low'
    return 'medium'
  })

  const sectionSummaries = aggregateSections(postSeeRows)
  const sectionMeanOverall = Object.entries(sectionSummaries)
    .filter(([, summary]) => summary.meanOverall > 0)
    .map(([sectionCode, summary]) => ({ sectionCode, meanOverall: summary.meanOverall }))
  const maxSection = sectionMeanOverall.reduce<typeof sectionMeanOverall[number] | null>((best, item) => !best || item.meanOverall > best.meanOverall ? item : best, null)
  const minSection = sectionMeanOverall.reduce<typeof sectionMeanOverall[number] | null>((best, item) => !best || item.meanOverall < best.meanOverall ? item : best, null)
  if (maxSection && minSection && maxSection.meanOverall - minSection.meanOverall > 18) {
    sectionImbalance.push(`${maxSection.sectionCode}:${minSection.sectionCode}:overall delta ${roundTo(maxSection.meanOverall - minSection.meanOverall, 4)}`)
  }

  const stageVisibilityVerdict: Verdict = futureLeakage.length === 0 && missingRequiredEvidence.length === 0 ? 'pass' : 'fail'
  const riskDriverVerdict: Verdict = riskDriverMismatch.length === 0 ? 'pass' : 'fail'
  const aggregateVerdict: Verdict = postSeeWithOverall.length > 0
    && postSeePassRate > 0.45
    && postSeePassRate < 0.95
    && stageVisibilityVerdict === 'pass'
    && sectionImbalance.length === 0
    ? 'pass'
    : 'fail'

  if (futureLeakage.length > 0) issues.push(`${futureLeakage.length} future evidence leaks`)
  if (missingRequiredEvidence.length > 0) issues.push(`${missingRequiredEvidence.length} required evidence values missing`)
  if (riskDriverMismatch.length > 0) issues.push(`${riskDriverMismatch.length} high-risk post-SEE rows lack configured drivers`)
  if (postSeeWithOverall.length === 0) issues.push('No post-SEE rows with overall evidence')
  if (postSeeWithOverall.length > 0 && (postSeePassRate <= 0.45 || postSeePassRate >= 0.95)) issues.push(`Post-SEE pass rate ${postSeePassRate} outside synthetic sanity band`)
  if (sectionImbalance.length > 0) issues.push(`${sectionImbalance.length} section imbalance warnings`)

  return {
    stageVisibility: {
      verdict: stageVisibilityVerdict,
      checkpointCount: input.checkpointRows.length,
      projectionCount: input.projectionRows.length,
      futureLeakCount: futureLeakage.length,
      missingRequiredEvidenceCount: missingRequiredEvidence.length,
      checkedStageKeys: input.checkpointRows.map(row => `${row.semesterNumber}:${row.stageKey}`),
    },
    riskDriverAlignment: {
      verdict: riskDriverVerdict,
      highRiskPostSeeCount,
      explainedHighRiskCount,
      unexplainedHighRiskCount: highRiskPostSeeCount - explainedHighRiskCount,
    },
    aggregateRealism: {
      verdict: aggregateVerdict,
      postSeeProjectionCount: postSeeWithOverall.length,
      postSeePassRate,
      highRiskShare: share(riskBands.filter(band => band === 'high').length, riskBands.length),
      mediumRiskShare: share(riskBands.filter(band => band === 'medium').length, riskBands.length),
      lowRiskShare: share(riskBands.filter(band => band === 'low').length, riskBands.length),
      sectionSummaries,
    },
    trajectoryAnomalies: {
      futureLeakage,
      missingRequiredEvidence,
      impossibleJumps,
      riskDriverMismatch,
      sectionImbalance,
    },
    selectedStudentTimeline: buildTimeline({ projectionRows: input.projectionRows, checkpointById }),
    issues,
  }
}

export function renderProofForensicRealismMarkdown(report: ProofForensicRealismAuditReport) {
  const issueLines = report.issues.length > 0
    ? report.issues.map(issue => `- ${issue}`).join('\n')
    : '- None'
  const timelineLines = report.selectedStudentTimeline.slice(0, 12).map(item => (
    `| ${item.studentId} | ${item.semesterNumber} | ${item.stageKey} | ${item.attendancePct ?? 'null'} | ${item.overallPct ?? 'null'} | ${item.riskProbScaled ?? 'null'} | ${item.riskBand} |`
  )).join('\n')
  return `# Proof Forensic Realism Report — 2026-05-11

## Intent

Prove seeded M&C synthetic proof rows are stage-safe and internally plausible beyond basic row population.

## Feature Intent

A college evaluator can understand which evidence was available at a stage, why risk is explainable, and which claims remain synthetic-only.

## Summary

| Check | Verdict | Value |
|---|---|---:|
| Stage visibility | ${report.stageVisibility.verdict} | ${report.stageVisibility.checkpointCount} checkpoints; ${report.stageVisibility.projectionCount} projections |
| Future leak violations | ${report.stageVisibility.futureLeakCount === 0 ? 'pass' : 'fail'} | ${report.stageVisibility.futureLeakCount} |
| Missing required evidence | ${report.stageVisibility.missingRequiredEvidenceCount === 0 ? 'pass' : 'fail'} | ${report.stageVisibility.missingRequiredEvidenceCount} |
| Risk driver alignment | ${report.riskDriverAlignment.verdict} | ${report.riskDriverAlignment.explainedHighRiskCount}/${report.riskDriverAlignment.highRiskPostSeeCount} high-risk rows explained |
| Aggregate realism | ${report.aggregateRealism.verdict} | post-SEE pass rate ${report.aggregateRealism.postSeePassRate} |

Future leak violations: ${report.stageVisibility.futureLeakCount}

## Selected Student Timeline Sample

| Student | Semester | Stage | Attendance | Overall | Risk | Band |
|---|---:|---|---:|---:|---:|---|
${timelineLines}

## Issues

${issueLines}

## Allowed claim

Seeded M&C synthetic proof run passes forensic internal realism checks when this report is generated from passing Phase 1 verification.

## Forbidden claim

This report cannot claim real MSRUAS cohort behavior, real institutional predictive validity, causal intervention proof, or hosted production readiness.
`
}
