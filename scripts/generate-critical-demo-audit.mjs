#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const evidenceRoot = process.env.AIRMENTOR_DEMO_REALITY_EVIDENCE_DIR
  ?? path.join(root, 'output/playwright/demo-reality-hardening')
const jsonDir = path.join(evidenceRoot, 'json')
const csvDir = path.join(evidenceRoot, 'csv')
const outDir = path.join(root, 'output')
const reportPath = path.join(outDir, 'critical-demo-audit.md')
const jsonReportPath = path.join(outDir, 'critical-demo-audit.json')

const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']
const markFields = ['attendancePct', 'tt1Pct', 'tt2Pct', 'quizPct', 'assignmentPct', 'seePct']
const riskBands = ['High', 'Medium', 'Low']

async function readJson(name, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(jsonDir, name), 'utf8'))
  } catch {
    return fallback
  }
}

async function readText(filePath, fallback = '') {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return fallback
  }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value)
      value = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(value)
      if (row.some(cell => cell.length > 0)) rows.push(row)
      row = []
      value = ''
    } else {
      value += char
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value)
    if (row.some(cell => cell.length > 0)) rows.push(row)
  }
  if (rows.length === 0) return []
  const headers = rows[0]
  return rows.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
}

async function readCsv(name) {
  const text = await readText(path.join(csvDir, name))
  return parseCsv(text)
}

function num(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isTrue(value) {
  return String(value).toLowerCase() === 'true'
}

function mean(values) {
  const filtered = values.filter(value => typeof value === 'number' && Number.isFinite(value))
  if (!filtered.length) return null
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function pct(count, total) {
  return total > 0 ? round((count / total) * 100, 1) : 0
}

function countBy(rows, keyFn) {
  const counts = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}

function unique(rows, keyFn) {
  return new Set(rows.map(keyFn).filter(Boolean))
}

function stageSort(left, right) {
  return num(left.semesterNumber) - num(right.semesterNumber)
    || stageOrder.indexOf(left.stageKey) - stageOrder.indexOf(right.stageKey)
}

function riskBandFromScore(score) {
  if (score === null) return 'Unknown'
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

function practicalRiskReason(row) {
  const marks = row.realizedMarks ?? {}
  const risk = row.realizedRiskProbScaled
  const band = row.realizedRiskBand ?? riskBandFromScore(risk)
  const drivers = []
  if (num(marks.attendancePct) !== null && num(marks.attendancePct) < 75) drivers.push(`attendance ${round(num(marks.attendancePct), 1)}%`)
  if (num(marks.tt1Pct) !== null && num(marks.tt1Pct) < 45) drivers.push(`TT1 ${round(num(marks.tt1Pct), 1)}%`)
  if (num(marks.tt2Pct) !== null && num(marks.tt2Pct) < 45) drivers.push(`TT2 ${round(num(marks.tt2Pct), 1)}%`)
  if (num(marks.quizPct) !== null && num(marks.quizPct) < 45) drivers.push(`quiz ${round(num(marks.quizPct), 1)}%`)
  if (num(marks.assignmentPct) !== null && num(marks.assignmentPct) < 45) drivers.push(`assignment ${round(num(marks.assignmentPct), 1)}%`)
  if (num(marks.seePct) !== null && num(marks.seePct) < 45) drivers.push(`SEE ${round(num(marks.seePct), 1)}%`)
  const practical = band === 'Low' || drivers.length > 0 || risk < 45
  return {
    practical,
    reason: practical
      ? (drivers.length ? `Observable academic evidence supports ${band}: ${drivers.join(', ')}.` : `Risk band ${band} is consistent with absence of severe visible marks/attendance flags at this stage.`)
      : `Risk band ${band} is not directly explainable from aggregate stage marks alone; needs course-level drivers/CGPA/backlog evidence.`,
  }
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => cell === null || cell === undefined ? '' : String(cell)).join(' | ')} |`),
  ].join('\n')
}

function summarizeStageRisk(stageRiskRows) {
  return [...stageRiskRows].sort(stageSort).map(row => {
    const total = num(row.totalStudents) ?? 0
    const high = num(row.highRiskCount) ?? 0
    const medium = num(row.mediumRiskCount) ?? 0
    const low = num(row.lowRiskCount) ?? 0
    return {
      semesterNumber: num(row.semesterNumber),
      stageKey: row.stageKey,
      totalStudents: total,
      highRiskCount: high,
      mediumRiskCount: medium,
      lowRiskCount: low,
      highRiskPct: pct(high, total),
      mediumRiskPct: pct(medium, total),
      lowRiskPct: pct(low, total),
      openQueueCount: num(row.openQueueCount) ?? 0,
      watchQueueCount: num(row.watchQueueCount) ?? 0,
      deferredQueueCount: num(row.deferredQueueCount) ?? 0,
      resolvedQueueCount: num(row.resolvedQueueCount) ?? 0,
    }
  })
}

function summarizeMarks(counterfactual) {
  const rows = counterfactual?.perStudentPerStage ?? []
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.semesterNumber}:${row.stageKey}`
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  return [...grouped.values()].map(groupRows => {
    const first = groupRows[0]
    const markSummary = Object.fromEntries(markFields.map(field => [field, round(mean(groupRows.map(row => num(row.realizedMarks?.[field]))), 2)]))
    const noActionMarkSummary = Object.fromEntries(markFields.map(field => [field, round(mean(groupRows.map(row => num(row.noActionMarks?.[field]))), 2)]))
    const actionCounts = countBy(groupRows.filter(row => row.simulatedActionTaken), row => row.simulatedActionTaken)
    const practicalSample = groupRows
      .filter(row => row.realizedRiskBand !== 'Low')
      .slice(0, 5)
      .map(row => ({
        studentId: row.studentId,
        riskBand: row.realizedRiskBand,
        riskProbScaled: row.realizedRiskProbScaled,
        ...practicalRiskReason(row),
      }))
    return {
      semesterNumber: first.semesterNumber,
      stageKey: first.stageKey,
      studentCount: groupRows.length,
      meanRisk: round(mean(groupRows.map(row => num(row.realizedRiskProbScaled))), 2),
      meanNoActionRisk: round(mean(groupRows.map(row => num(row.noActionRiskProbScaled))), 2),
      meanLift: round(mean(groupRows.map(row => num(row.liftProbScaled))), 2),
      marks: markSummary,
      noActionMarks: noActionMarkSummary,
      bandCounts: countBy(groupRows, row => row.realizedRiskBand ?? riskBandFromScore(num(row.realizedRiskProbScaled))),
      simulatedActionCount: groupRows.filter(row => row.simulatedActionTaken).length,
      actionCounts,
      practicalSample,
    }
  }).sort(stageSort)
}

function summarizeInterventions(counterfactual) {
  const byStage = counterfactual?.bySemesterStage ?? []
  return byStage.map(row => ({
    semesterNumber: row.semesterNumber,
    stageKey: row.stageKey,
    meanRealizedRiskProbScaled: row.meanRealizedRiskProbScaled,
    meanNoActionRiskProbScaled: row.meanNoActionRiskProbScaled,
    meanLiftProbScaled: row.meanLiftProbScaled,
    preventedHigh: row.bandTransitions?.preventedHigh ?? 0,
    preventedMedium: row.bandTransitions?.preventedMedium ?? 0,
    regression: row.bandTransitions?.regression ?? 0,
    meanMarkDeltas: row.meanMarkDeltas ?? {},
  })).sort(stageSort)
}

function summarizeManualEdits(marksEdit) {
  return (marksEdit?.caseResults ?? []).map(row => ({
    studentId: row.studentId,
    pattern: row.pattern,
    expectedTt1Pct: row.expectedTt1Pct,
    beforeTt1Pct: row.beforeTt1Pct,
    afterTt1Pct: row.afterTt1Pct,
    beforeRiskScore: row.beforeRiskScore,
    afterRiskScore: row.afterRiskScore,
    directionallyCorrect: row.pattern === 'worsen'
      ? row.afterRiskScore > row.beforeRiskScore
      : row.pattern === 'improve'
        ? row.afterRiskScore <= row.beforeRiskScore
        : Math.abs(row.afterRiskScore - row.beforeRiskScore) >= 1,
  }))
}

function summarizeFinalBundle(bundlePayload) {
  const bundle = bundlePayload?.bundle ?? null
  const students = bundle?.students ?? []
  const checkpoint = bundle?.summary?.activeRunContext?.checkpointContext ?? null
  const topLevelElectiveFitCount = (bundle?.electiveFits ?? []).length
  const studentElectiveFitCount = students.filter(student => student.electiveFit).length
  const studentSnapshots = students.slice(0, 10).map(student => ({
    studentId: student.studentId,
    currentSemester: student.currentSemester,
    riskBand: student.currentRiskBand,
    riskProbScaled: student.currentRiskProbScaled,
    queueState: student.currentQueueState,
    electiveFit: student.electiveFit,
    courseSnapshotCount: student.courseSnapshots?.length ?? 0,
    courseSnapshots: (student.courseSnapshots ?? []).map(snapshot => ({
      courseCode: snapshot.courseCode,
      courseTitle: snapshot.courseTitle,
      riskBand: snapshot.riskBand,
      riskProbScaled: snapshot.riskProbScaled,
      queueState: snapshot.queueState,
      drivers: (snapshot.drivers ?? []).map(driver => `${driver.feature}: ${driver.label}`),
    })),
  }))
  return {
    checkpoint,
    studentCount: students.length,
    electiveFitCount: Math.max(topLevelElectiveFitCount, studentElectiveFitCount),
    topLevelElectiveFitCount,
    studentElectiveFitCount,
    summaryElectiveDistribution: bundle?.summary?.electiveDistribution ?? [],
    studentSnapshots,
  }
}

function summarizeDriverEvidence(driverRows, queueRows) {
  const highMediumPairs = unique(queueRows.filter(row => ['high', 'medium'].includes(String(row.riskBand).toLowerCase())), row => `${row.checkpointId}:${row.studentId}`)
  const coveredPairs = unique(driverRows, row => `${row.checkpointId}:${row.studentId}`)
  const availableRows = driverRows.filter(row => row.driverAvailable === undefined || isTrue(row.driverAvailable))
  const unavailableRows = driverRows.filter(row => row.driverAvailable !== undefined && !isTrue(row.driverAvailable))
  return {
    rowCount: driverRows.length,
    highMediumStudentCheckpointCount: highMediumPairs.size,
    coveredStudentCheckpointCount: coveredPairs.size,
    availableDriverRows: availableRows.length,
    unavailableDriverRows: unavailableRows.length,
    coveragePct: highMediumPairs.size > 0 ? pct(coveredPairs.size, highMediumPairs.size) : 0,
    completeForHighMedium: highMediumPairs.size > 0 && coveredPairs.size >= highMediumPairs.size,
  }
}

function summarizeInterventionCap(capAudit, checkpointDetails, queueRows) {
  const expectedRows = (checkpointDetails?.checkpointCount ?? 0) * unique(queueRows, row => row.studentId).size
  const legacyCheckedRows = Object.keys(capAudit?.interventionCounts ?? {}).length
  const checkedRows = capAudit?.studentStageRowsChecked ?? legacyCheckedRows
  const violations = capAudit?.violations ?? []
  return {
    checkpointCount: capAudit?.checkpointCount ?? null,
    expectedStudentStageRows: expectedRows,
    checkedStudentStageRows: checkedRows,
    courseRowsChecked: capAudit?.courseRowsChecked ?? null,
    violationCount: violations.length,
    fullCoverage: expectedRows > 0 && checkedRows >= expectedRows,
    capRespected: violations.length === 0,
  }
}

function validateClaims({ checkpointDetails, stageRisk, queueRows, electiveRows, marks, finalBundle, counterfactual }) {
  const uniqueStudents = unique(queueRows, row => row.studentId)
  const uniqueCheckpoints = unique(queueRows, row => row.checkpointId)
  const finalSem6PostSee = stageRisk.find(row => row.semesterNumber === 6 && row.stageKey === 'post-see')
  const finalBundleCheckpoint = finalBundle?.checkpoint
  const activeElectiveRows = electiveRows.filter(row => isTrue(row.active))
  return [
    {
      claim: '30 checkpoints exist',
      status: checkpointDetails?.checkpointCount === 30 ? 'verified' : 'failed',
      evidence: `${checkpointDetails?.checkpointCount ?? 'missing'} checkpoints`,
    },
    {
      claim: '120 students covered at every checkpoint',
      status: uniqueStudents.size === 120 && uniqueCheckpoints.size === 30 && queueRows.length === 3600 ? 'verified' : 'failed',
      evidence: `${uniqueStudents.size} students × ${uniqueCheckpoints.size} checkpoints = ${queueRows.length} queue rows`,
    },
    {
      claim: 'Final stage is balanced / ~30% high risk',
      status: finalSem6PostSee && finalSem6PostSee.highRiskPct <= 40 ? 'verified' : 'contradicted',
      evidence: finalSem6PostSee ? `Sem 6 post-see high=${finalSem6PostSee.highRiskCount}/120 (${finalSem6PostSee.highRiskPct}%)` : 'missing sem6 post-see row',
    },
    {
      claim: 'Manual TT1 edits directionally affect risk',
      status: marks.length > 0 && marks.every(row => row.directionallyCorrect) ? 'verified' : 'failed',
      evidence: marks.map(row => `${row.studentId} ${row.pattern}: TT1 ${row.beforeTt1Pct}->${row.afterTt1Pct}, risk ${row.beforeRiskScore}->${row.afterRiskScore}`).join('; '),
    },
    {
      claim: 'Elective recommendations are active / captured',
      status: activeElectiveRows.length > 0 ? 'verified' : electiveRows.length > 0 ? 'inactive-evidence' : 'missing-evidence',
      evidence: `${activeElectiveRows.length} active elective rows, ${electiveRows.length} total elective evidence rows; bundle electiveFitCount=${finalBundle?.electiveFitCount ?? 0}`,
    },
    {
      claim: 'Final HoD JSON bundle is sem6 post-see',
      status: finalBundleCheckpoint?.semesterNumber === 6 && finalBundleCheckpoint?.stageKey === 'post-see' ? 'verified' : 'contradicted',
      evidence: finalBundleCheckpoint ? `captured ${finalBundleCheckpoint.semesterNumber}:${finalBundleCheckpoint.stageKey}` : 'missing bundle checkpoint',
    },
    {
      claim: 'Intervention effects are modest and non-regressive',
      status: counterfactual?.projectedFinal?.meanLiftProbScaled > 0 && counterfactual?.bySemesterStage?.every(row => (row.bandTransitions?.regression ?? 0) === 0) ? 'verified' : 'needs-review',
      evidence: `mean lift=${counterfactual?.projectedFinal?.meanLiftProbScaled ?? 'missing'}, prevented=${counterfactual?.projectedFinal?.projectedFailuresPreventedTotal ?? 'missing'}, regressions=${counterfactual?.bySemesterStage?.reduce((sum, row) => sum + (row.bandTransitions?.regression ?? 0), 0) ?? 'missing'}`,
    },
  ]
}

function buildMarkdown(report) {
  const stageRows = report.stageRisk.map(row => [
    row.semesterNumber,
    row.stageKey,
    `${row.highRiskCount} (${row.highRiskPct}%)`,
    `${row.mediumRiskCount} (${row.mediumRiskPct}%)`,
    `${row.lowRiskCount} (${row.lowRiskPct}%)`,
    row.openQueueCount,
    row.watchQueueCount,
    row.deferredQueueCount,
    row.resolvedQueueCount,
  ])

  const markRows = report.markProgression.map(row => [
    row.semesterNumber,
    row.stageKey,
    row.meanRisk,
    row.meanNoActionRisk,
    row.meanLift,
    row.marks.attendancePct,
    row.marks.tt1Pct,
    row.marks.tt2Pct,
    row.marks.quizPct,
    row.marks.assignmentPct,
    row.marks.seePct,
    row.simulatedActionCount,
  ])

  const interventionRows = report.interventionsByStage.map(row => [
    row.semesterNumber,
    row.stageKey,
    row.meanRealizedRiskProbScaled,
    row.meanNoActionRiskProbScaled,
    row.meanLiftProbScaled,
    row.preventedHigh,
    row.regression,
    Object.entries(row.meanMarkDeltas).map(([key, value]) => `${key}:${value}`).join(' '),
  ])

  const claimRows = report.claimValidation.map(row => [row.status, row.claim, row.evidence])
  const editRows = report.manualEditResults.map(row => [row.studentId, row.pattern, `${row.beforeTt1Pct} -> ${row.afterTt1Pct}`, `${row.beforeRiskScore} -> ${row.afterRiskScore}`, row.directionallyCorrect ? 'yes' : 'no'])
  const electiveActivation = report.electiveActivation
  const finalCheckpointLabel = `${report.finalBundle.checkpoint?.semesterNumber ?? 'missing'}:${report.finalBundle.checkpoint?.stageKey ?? 'missing'}`
  const finalCheckpointVerdict = report.finalBundle.checkpoint?.semesterNumber === 6 && report.finalBundle.checkpoint?.stageKey === 'post-see'
    ? 'This is the persisted sem6 post-SEE final HoD bundle.'
    : 'This is not the sem6 post-SEE final HoD bundle.'
  const finalSamples = report.finalBundle.studentSnapshots.slice(0, 3).flatMap(student => student.courseSnapshots.slice(0, 3).map(snapshot => [
    student.studentId,
    student.riskBand,
    student.riskProbScaled,
    snapshot.courseCode,
    snapshot.riskBand,
    snapshot.riskProbScaled,
    snapshot.drivers.slice(0, 2).join(' · '),
  ]))

  return `# AirMentor Critical Demo Audit

Generated: ${new Date().toISOString()}
Evidence root: \`${evidenceRoot}\`

## Executive Verdict

${report.executiveVerdict.map(item => `- **${item.title}:** ${item.value}`).join('\n')}

## Claim Validation

${markdownTable(['Status', 'Claim', 'Evidence'], claimRows)}

## Stage-wise Risk and Queue Status

${markdownTable(['Sem', 'Stage', 'High', 'Medium', 'Low', 'Open', 'Watch', 'Deferred', 'Resolved'], stageRows)}

## Stage-wise Marks Progression and Intervention Lift

Values are cohort means from \`counterfactual-simulator.json/perStudentPerStage\`.

${markdownTable(['Sem', 'Stage', 'Mean Risk', 'No-action Risk', 'Lift', 'Attendance', 'TT1', 'TT2', 'Quiz', 'Assignment', 'SEE', 'Actions'], markRows)}

## Stage-wise Intervention Effects

${markdownTable(['Sem', 'Stage', 'Realized Risk', 'No-action Risk', 'Lift', 'Prevented High', 'Regressions', 'Mean Mark Deltas'], interventionRows)}

## Manual Mark Edit Verification

${markdownTable(['Student', 'Pattern', 'TT1 Before -> After', 'Risk Before -> After', 'Directionally Correct'], editRows)}

## Elective Activation

- **Captured elective rows:** ${electiveActivation.capturedRows}
- **Captured active elective rows:** ${electiveActivation.activeRows}
- **Captured active stages:** ${electiveActivation.activeStages.length ? electiveActivation.activeStages.join(', ') : 'none'}
- **Captured inactive stages:** ${electiveActivation.inactiveStages.length ? electiveActivation.inactiveStages.join(', ') : 'none'}
- **Current evidence verdict:** ${electiveActivation.verdict}
- **Reason:** ${electiveActivation.reason}

## Bulk Driver and Intervention-Cap Evidence

- **Driver rows:** ${report.driverEvidence.rowCount}
- **High/medium student-checkpoints covered:** ${report.driverEvidence.coveredStudentCheckpointCount}/${report.driverEvidence.highMediumStudentCheckpointCount} (${report.driverEvidence.coveragePct}%)
- **Driver rows with exposed course-level drivers:** ${report.driverEvidence.availableDriverRows}
- **Intervention cap rows checked:** ${report.interventionCapEvidence.checkedStudentStageRows}/${report.interventionCapEvidence.expectedStudentStageRows}
- **Intervention cap violations:** ${report.interventionCapEvidence.violationCount}

## Subject-specific Performance and Drivers Sample

This section uses the captured HoD bundle, currently \`${finalCheckpointLabel}\`. ${finalCheckpointVerdict}

${markdownTable(['Student', 'Overall Band', 'Overall Risk', 'Course', 'Course Band', 'Course Risk', 'Drivers'], finalSamples)}

## Practical Without-ML Reasoning Sample

${report.practicalRiskSamples.map(sample => `- **${sample.semesterNumber}:${sample.stageKey} ${sample.studentId}:** ${sample.riskBand} ${sample.riskProbScaled} — ${sample.reason}`).join('\n')}

## Important Gaps Before Strong Demo Claims

${report.gaps.map(gap => `- **${gap.title}:** ${gap.detail}`).join('\n')}
`
}

async function main() {
  const [checkpointDetails, counterfactual, finalBundlePayload, marksEdit, capAudit, stageRiskRows, queueRows, electiveRows, driverRows] = await Promise.all([
    readJson('checkpoint-details.json'),
    readJson('counterfactual-simulator.json'),
    readJson('final-hod-proof-bundle.json'),
    readJson('marks-edit-before-after.json'),
    readJson('intervention-cap-audit.json'),
    readCsv('stage-risk-table.csv'),
    readCsv('queue-table.csv'),
    readCsv('elective-distribution-table.csv'),
    readCsv('student-driver-table.csv'),
  ])

  const stageRisk = summarizeStageRisk(stageRiskRows)
  const markProgression = summarizeMarks(counterfactual)
  const interventionsByStage = summarizeInterventions(counterfactual)
  const manualEditResults = summarizeManualEdits(marksEdit)
  const finalBundle = summarizeFinalBundle(finalBundlePayload)
  const driverEvidence = summarizeDriverEvidence(driverRows, queueRows)
  const interventionCapEvidence = summarizeInterventionCap(capAudit, checkpointDetails, queueRows)
  const claimValidation = validateClaims({ checkpointDetails, stageRisk, queueRows, electiveRows, marks: manualEditResults, finalBundle, counterfactual })
  const activeElectiveRows = electiveRows.filter(row => isTrue(row.active))
  const activeElectiveStages = [...new Set(activeElectiveRows.map(row => `${row.semesterNumber}:${row.stageKey}`))]
  const inactiveElectiveStages = [...new Set(electiveRows.filter(row => !isTrue(row.active)).map(row => `${row.semesterNumber}:${row.stageKey}`))]
  const electiveActivation = {
    capturedRows: electiveRows.length,
    activeRows: activeElectiveRows.length,
    activeStages: activeElectiveStages,
    inactiveStages: inactiveElectiveStages,
    verdict: activeElectiveRows.length > 0 ? 'active recommendations verified from CSV' : electiveRows.length > 0 ? 'inactive states captured; no active recommendations' : 'missing evidence',
    reason: activeElectiveRows.length > 0
      ? 'The E2E run captured active electiveFit rows from the HoD bundle/student electiveFit payload.'
      : electiveRows.length > 0
        ? 'The E2E run captured explicit inactive rows per checkpoint, but no active electiveFit row was returned.'
        : 'The captured CSV contains only a header or is missing.',
  }
  const practicalRiskSamples = markProgression.flatMap(row => row.practicalSample.map(sample => ({
    semesterNumber: row.semesterNumber,
    stageKey: row.stageKey,
    ...sample,
  }))).slice(0, 20)

  const sem6PostSee = stageRisk.find(row => row.semesterNumber === 6 && row.stageKey === 'post-see')
  const executiveVerdict = [
    { title: 'Checkpoint coverage', value: `${checkpointDetails?.checkpointCount ?? 0}/30 checkpoints; ${queueRows.length} student-checkpoint queue rows` },
    { title: 'Current risk realism', value: sem6PostSee ? `Sem6 post-see is extremely severe: ${sem6PostSee.highRiskCount}/120 High (${sem6PostSee.highRiskPct}%). Do not claim final-stage balanced distribution.` : 'Sem6 post-see missing' },
    { title: 'Manual edit flow', value: manualEditResults.every(row => row.directionallyCorrect) ? 'Directionally verified for 3 TT1 cases at sem1 post-see.' : 'Manual edit verification failed or incomplete.' },
    { title: 'Elective evidence', value: activeElectiveRows.length > 0 ? `${activeElectiveRows.length} active rows captured.` : electiveRows.length > 0 ? 'Inactive rows captured; no active recommendations yet.' : 'Not captured; needs E2E/API evidence fix.' },
    { title: 'Driver evidence', value: `${driverEvidence.rowCount} driver rows; ${driverEvidence.coveredStudentCheckpointCount}/${driverEvidence.highMediumStudentCheckpointCount} high/medium student-checkpoints covered.` },
    { title: 'Intervention cap evidence', value: interventionCapEvidence.fullCoverage ? `${interventionCapEvidence.checkedStudentStageRows}/${interventionCapEvidence.expectedStudentStageRows} student-stage rows checked; violations=${interventionCapEvidence.violationCount}.` : `${interventionCapEvidence.checkedStudentStageRows}/${interventionCapEvidence.expectedStudentStageRows} student-stage rows checked; still incomplete.` },
    { title: 'ML authority', value: 'Evidence still documents TypeScript proof-risk heads as serving; CatBoost is shadow/offline.' },
  ]

  const gaps = [
    ...(activeElectiveRows.length === 0 ? [{
      title: electiveRows.length > 0 ? 'Elective activation not active in captured evidence' : 'Elective activation not proven',
      detail: electiveRows.length > 0
        ? `Captured ${electiveRows.length} elective evidence rows, but all are inactive. Do not claim active recommendations until active=true rows exist.`
        : 'The CSV has zero rows or is missing. Capture a sem6 post-see HoD bundle and risk explorer electiveFit before claiming exact activation.',
    }] : []),
    ...(!driverEvidence.completeForHighMedium ? [{
      title: 'All-student driver reasoning not fully proven',
      detail: `student-driver-table.csv covers ${driverEvidence.coveredStudentCheckpointCount}/${driverEvidence.highMediumStudentCheckpointCount} high/medium student-checkpoints with ${driverEvidence.rowCount} rows.`,
    }] : []),
    ...(finalBundle.checkpoint?.semesterNumber === 6 && finalBundle.checkpoint?.stageKey === 'post-see' ? [] : [{
      title: 'Final HoD JSON is not final semester',
      detail: `final-hod-proof-bundle.json captured ${finalBundle.checkpoint?.semesterNumber}:${finalBundle.checkpoint?.stageKey}; screenshot advances later but JSON was not refreshed.`,
    }]),
    {
      title: 'Risk distribution is more crisis-like than narrative',
      detail: sem6PostSee ? `Sem6 post-see high-risk rate is ${sem6PostSee.highRiskPct}%, which may be demo-dramatic but is not an average/balanced real-world cohort.` : 'Sem6 post-see missing.',
    },
    ...(!interventionCapEvidence.fullCoverage || !interventionCapEvidence.capRespected ? [{
      title: interventionCapEvidence.fullCoverage ? 'Intervention cap violations found' : 'Intervention cap evidence is incomplete',
      detail: interventionCapEvidence.fullCoverage
        ? `Checked ${interventionCapEvidence.checkedStudentStageRows} student-stage rows; violations=${interventionCapEvidence.violationCount}.`
        : `intervention-cap-audit checks ${interventionCapEvidence.checkedStudentStageRows}/${interventionCapEvidence.expectedStudentStageRows} expected student-stage rows.`,
    }] : []),
  ]

  const report = {
    generatedAt: new Date().toISOString(),
    evidenceRoot,
    executiveVerdict,
    claimValidation,
    stageRisk,
    markProgression,
    interventionsByStage,
    manualEditResults,
    electiveActivation,
    finalBundle,
    driverEvidence,
    interventionCapEvidence,
    practicalRiskSamples,
    gaps,
  }

  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2), 'utf8')
  await fs.writeFile(reportPath, buildMarkdown(report), 'utf8')
  console.log(`Wrote ${reportPath}`)
  console.log(`Wrote ${jsonReportPath}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
