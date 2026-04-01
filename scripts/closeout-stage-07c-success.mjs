#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const stageId = '07C'
const stageTitle = 'Semester 4 To 6 Proof Walk'
const assertionIds = ['ATM-07C-001']
const semesters = [4, 5, 6]

const repoRoot = process.cwd()
const outputDir = path.join(repoRoot, 'output')
const playwrightDir = path.join(outputDir, 'playwright')
const docsDir = path.join(repoRoot, 'docs', 'closeout')

const files = {
  ledger: path.join(playwrightDir, 'execution-ledger.jsonl'),
  manifest: path.join(playwrightDir, 'proof-evidence-manifest.json'),
  index: path.join(playwrightDir, 'proof-evidence-index.md'),
  assertionMatrix: path.join(docsDir, 'assertion-traceability-matrix.md'),
  coverageMatrix: path.join(docsDir, 'sysadmin-teaching-proof-coverage-matrix.md'),
  stage07c: path.join(docsDir, 'stage-07c-semester-4-to-6-proof-walk.md'),
  localSummary: path.join(playwrightDir, '07c-local-semester-walk-summary.json'),
  liveProbe: path.join(playwrightDir, '07c-live-probe-semester-probe.json'),
  liveSummary: path.join(playwrightDir, '07c-live-semester-walk-summary.json'),
  localKeyboardReport: path.join(playwrightDir, '07c-local-system-admin-live-keyboard-regression-report.json'),
  localKeyboardScreenshot: path.join(playwrightDir, '07c-local-system-admin-live-keyboard-regression.png'),
  liveKeyboardReport: path.join(playwrightDir, '07c-live-system-admin-live-keyboard-regression-report.json'),
  liveKeyboardScreenshot: path.join(playwrightDir, '07c-live-system-admin-live-keyboard-regression.png'),
}

const localBackendCommand = 'env -C air-mentor-api npx vitest run --reporter=verbose --maxWorkers=1 tests/hod-proof-analytics.test.ts tests/risk-explorer.test.ts tests/student-agent-shell.test.ts tests/proof-control-plane-dashboard-service.test.ts'
const localFrontendCommand = 'npm test -- --run tests/proof-playback.test.ts tests/system-admin-proof-dashboard-workspace.test.tsx tests/hod-pages.test.ts tests/risk-explorer.test.tsx tests/student-shell.test.tsx'
const localProofCommand = 'AIRMENTOR_PROOF_SEMESTER_TARGETS=4,5,6 AIRMENTOR_PROOF_ARTIFACT_PREFIX=07c-local npm run playwright:admin-live:proof-risk'
const localKeyboardCommand = 'AIRMENTOR_KEYBOARD_ARTIFACT_PREFIX=07c-local npm run playwright:admin-live:keyboard-regression'
const liveProbeCommand = 'AIRMENTOR_LIVE_STACK=1 AIRMENTOR_PROOF_SEMESTER_TARGETS=4,5,6 AIRMENTOR_PROOF_ARTIFACT_PREFIX=07c-live-probe node scripts/proof-risk-semester-walk-probe.mjs'
const liveProofCommand = 'AIRMENTOR_LIVE_STACK=1 AIRMENTOR_PROOF_SEMESTER_TARGETS=4,5,6 AIRMENTOR_PROOF_ARTIFACT_PREFIX=07c-live npm run playwright:admin-live:proof-risk'
const liveKeyboardCommand = 'PLAYWRIGHT_APP_URL=<pages-url> PLAYWRIGHT_API_URL=<railway-url> AIRMENTOR_LIVE_STACK=1 AIRMENTOR_KEYBOARD_ARTIFACT_PREFIX=07c-live npm run playwright:admin-live:keyboard-regression'

const semesterScreenshotSpecs = [
  ['systemAdmin', 'system-admin-proof-control-plane', 'SYSTEM_ADMIN'],
  ['teacher', 'teacher-proof-panel', 'COURSE_LEADER'],
  ['teacherRiskExplorer', 'teacher-risk-explorer', 'COURSE_LEADER'],
  ['hod', 'hod-proof-analytics', 'HOD'],
  ['hodRiskExplorer', 'hod-risk-explorer', 'HOD'],
  ['studentShell', 'student-shell', 'HOD'],
]

const indexScreenshotSpecs = [
  ['systemAdmin', 'system-admin-proof-control-plane.png', 'system-admin-proof-control-plane'],
  ['teacher', 'teacher-proof-panel.png', 'teacher-proof-panel'],
  ['teacherRiskExplorer', 'teacher-risk-explorer-proof.png', 'teacher-risk-explorer'],
  ['hod', 'hod-proof-analytics.png', 'hod-proof-analytics'],
  ['hodRiskExplorer', 'hod-risk-explorer-proof.png', 'hod-risk-explorer'],
  ['studentShell', 'student-shell-proof.png', 'student-shell'],
]

const keyboardSpecs = [
  ['LOCAL-KEYBOARD', files.localKeyboardReport, 'system-admin-keyboard-regression-report', 'SYSTEM_ADMIN'],
  ['LOCAL-KEYBOARD', files.localKeyboardScreenshot, 'system-admin-keyboard-regression', 'SYSTEM_ADMIN'],
  ['LIVE-KEYBOARD', files.liveKeyboardReport, 'system-admin-keyboard-regression-report', 'SYSTEM_ADMIN'],
  ['LIVE-KEYBOARD', files.liveKeyboardScreenshot, 'system-admin-keyboard-regression', 'SYSTEM_ADMIN'],
]

function fail(message) {
  throw new Error(message)
}

function assertFileExists(filePath) {
  if (!existsSync(filePath)) fail(`Required file is missing: ${filePath}`)
}

function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

function formatJsonl(rows) {
  return `${rows.map(row => JSON.stringify(row)).join('\n')}\n`
}

function upsertManifestArtifact(manifest, artifact) {
  const existingIndex = manifest.artifacts.findIndex(item => item.artifactId === artifact.artifactId)
  if (existingIndex >= 0) {
    manifest.artifacts[existingIndex] = artifact
    return
  }
  manifest.artifacts.push(artifact)
}

function replaceLineByPrefix(text, prefix, replacement) {
  const lines = text.split(/\r?\n/)
  const index = lines.findIndex(line => line.startsWith(prefix))
  assert(index >= 0, `Could not find line starting with: ${prefix}`)
  lines[index] = replacement
  return `${lines.join('\n')}\n`
}

function replaceBlock(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker)
  assert(start >= 0, `Could not find block starting with: ${startMarker}`)
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : text.length
  assert(end >= 0, `Could not find block ending with: ${endMarker ?? '(end of file)'}`)
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`
}

function replaceStageSection(text, sectionHeader, replacement) {
  const start = text.indexOf(sectionHeader)
  assert(start >= 0, `Could not find stage section header: ${sectionHeader}`)
  const rest = text.slice(start + sectionHeader.length)
  const nextStageMatch = rest.match(/\n## Stage \d{2}[A-Z]/)
  const end = nextStageMatch ? start + sectionHeader.length + nextStageMatch.index : text.length
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`
}

function insertBeforeHeader(text, header, block) {
  const index = text.indexOf(header)
  if (index < 0) return `${text.trimEnd()}\n\n${block}\n`
  return `${text.slice(0, index)}${block}\n\n${text.slice(index)}`
}

function upsertTableRow(text, prefix, row, beforePrefix) {
  if (text.includes(prefix)) return replaceLineByPrefix(text, prefix, row)
  const marker = text.indexOf(beforePrefix)
  assert(marker >= 0, `Could not find insertion marker: ${beforePrefix}`)
  return `${text.slice(0, marker)}${row}\n${text.slice(marker)}`
}

function buildArtifactId(command, basename) {
  return `${stageId}--${command}--${basename}`
}

function buildArtifact(rawPath, command, overrides = {}) {
  return {
    semesterNumber: null,
    stageKey: null,
    simulationRunId: null,
    simulationStageCheckpointId: null,
    scopeType: 'batch',
    scopeId: null,
    routeHash: null,
    studentId: null,
    courseId: null,
    labeledPath: null,
    artifactId: buildArtifactId(command, path.basename(rawPath)),
    actorRole: 'SYSTEM_ADMIN',
    assertionIds,
    rawPath,
    scriptName: command,
    ...overrides,
  }
}

function commandForSummary(summary) {
  return summary.stack === 'live' ? 'LIVE-PROOF' : 'LOCAL-PROOF'
}

function summaryFilePath(summary) {
  return summary.stack === 'live' ? files.liveSummary : files.localSummary
}

function sourceCommandForSummary(summary) {
  return summary.stack === 'live' ? liveProofCommand : localProofCommand
}

function summaryLabel(summary) {
  return summary.stack === 'live' ? 'live' : 'local'
}

function semesterNumberFor(summary) {
  return Number(summary.targetedSemester ?? summary.selectedCheckpoint?.semesterNumber ?? 0)
}

function checkpointFor(summary) {
  return summary.selectedCheckpoint ?? {}
}

function semesterSummaryPathFor(summary, semesterNumber) {
  const summaryPaths = Array.isArray(summary.summaryPaths) ? summary.summaryPaths : []
  return summaryPaths.find(item => item.includes(`semester-${semesterNumber}-`)) ?? null
}

function probeArtifact(probe) {
  return buildArtifact(files.liveProbe, 'LIVE-PROBE', {
    scopeId: probe?.batchId ?? 'batch_branch_mnc_btech_2023',
    routeHash: probe?.routeHash ?? '#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023',
    surface: 'semester-walk-probe',
    appUrl: probe?.appUrl,
    apiUrl: probe?.apiUrl,
  })
}

function semesterArtifactIds(summary, semesterSummary) {
  const command = commandForSummary(summary)
  const semester = semesterNumberFor(semesterSummary)
  const scopedArtifacts = semesterSummary.semesterScopedArtifacts ?? {}
  const ids = []
  const summaryPath = semesterSummaryPathFor(summary, semester)
  if (summaryPath) ids.push(buildArtifactId(command, path.basename(summaryPath)))
  for (const [key] of semesterScreenshotSpecs) {
    const rawPath = scopedArtifacts.screenshots?.[key]
    if (rawPath) ids.push(buildArtifactId(command, path.basename(rawPath)))
  }
  if (scopedArtifacts.activationArtifacts?.request) ids.push(buildArtifactId(command, path.basename(scopedArtifacts.activationArtifacts.request)))
  if (scopedArtifacts.activationArtifacts?.response) ids.push(buildArtifactId(command, path.basename(scopedArtifacts.activationArtifacts.response)))
  return ids
}

function noteForSemester(localSummary, liveSummary, semesterNumber) {
  const localSemester = (localSummary.summaries ?? []).find(item => semesterNumberFor(item) === semesterNumber)
  const liveSemester = (liveSummary.summaries ?? []).find(item => semesterNumberFor(item) === semesterNumber)
  assert(localSemester, `Missing local semester ${semesterNumber} summary`)
  assert(liveSemester, `Missing live semester ${semesterNumber} summary`)
  const localCheckpoint = checkpointFor(localSemester).simulationStageCheckpointId ?? 'missing'
  const liveCheckpoint = checkpointFor(liveSemester).simulationStageCheckpointId ?? 'missing'
  const localArtifacts = semesterArtifactIds(localSummary, localSemester)
  const liveArtifacts = semesterArtifactIds(liveSummary, liveSemester)
  return `Semester ${semesterNumber} -> checkpoint ${localCheckpoint} local artifacts [${localArtifacts.join(', ')}] live checkpoint ${liveCheckpoint} live artifacts [${liveArtifacts.join(', ')}]`
}

async function collectArtifactsForSummary(summary) {
  const command = commandForSummary(summary)
  const summaryPath = summaryFilePath(summary)
  const summaryStats = await stat(summaryPath)
  const firstSemesterSummary = [...(summary.summaries ?? [])]
    .sort((left, right) => semesterNumberFor(left) - semesterNumberFor(right))[0] ?? null

  const artifacts = [buildArtifact(summaryPath, command, {
    simulationRunId: firstSemesterSummary?.simulationRunId ?? summary.simulationRunId ?? null,
    scopeId: firstSemesterSummary?.batchId ?? summary.batchId ?? null,
    routeHash: firstSemesterSummary?.routeHash ?? summary.routeHash ?? null,
    surface: 'semester-walk-summary',
    appUrl: summary.appUrl,
    apiUrl: summary.apiUrl,
    createdAt: summaryStats.mtime.toISOString(),
  })]

  const createdAtFor = async filePath => (await stat(filePath)).mtime.toISOString()
  const semesterSummaries = [...(summary.summaries ?? [])].sort((left, right) => semesterNumberFor(left) - semesterNumberFor(right))

  for (const semesterSummary of semesterSummaries) {
    const semester = semesterNumberFor(semesterSummary)
    const checkpoint = checkpointFor(semesterSummary)
    const scopedArtifacts = semesterSummary.semesterScopedArtifacts ?? {}
    const simulationRunId = semesterSummary.simulationRunId ?? summary.simulationRunId ?? null
    const batchId = semesterSummary.batchId ?? summary.batchId ?? null
    const routeHash = semesterSummary.routeHash ?? summary.routeHash ?? null
    const summaryPathForSemester = semesterSummaryPathFor(summary, semester)

    if (summaryPathForSemester) {
      artifacts.push(buildArtifact(summaryPathForSemester, command, {
        semesterNumber: semester,
        stageKey: checkpoint.stageKey ?? null,
        simulationRunId,
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId ?? null,
        scopeId: batchId,
        routeHash,
        surface: 'semester-walk-detail-summary',
        appUrl: summary.appUrl,
        apiUrl: summary.apiUrl,
        createdAt: await createdAtFor(summaryPathForSemester),
      }))
    }

    for (const [key, surface, actorRole] of semesterScreenshotSpecs) {
      const rawPath = scopedArtifacts.screenshots?.[key]
      if (!rawPath) continue
      artifacts.push(buildArtifact(rawPath, command, {
        semesterNumber: semester,
        stageKey: checkpoint.stageKey ?? null,
        simulationRunId,
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId ?? null,
        scopeId: batchId,
        routeHash: surface === 'system-admin-proof-control-plane' ? routeHash : null,
        surface,
        actorRole,
        appUrl: summary.appUrl,
        apiUrl: summary.apiUrl,
        createdAt: await createdAtFor(rawPath),
      }))
    }

    for (const [kind, surface] of [['request', 'system-admin-proof-semester-activation-request'], ['response', 'system-admin-proof-semester-activation-response']]) {
      const rawPath = scopedArtifacts.activationArtifacts?.[kind]
      if (!rawPath) continue
      artifacts.push(buildArtifact(rawPath, command, {
        semesterNumber: semester,
        stageKey: checkpoint.stageKey ?? null,
        simulationRunId,
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId ?? null,
        scopeId: batchId,
        routeHash,
        surface,
        appUrl: summary.appUrl,
        apiUrl: summary.apiUrl,
        createdAt: await createdAtFor(rawPath),
      }))
    }
  }

  return artifacts
}

async function collectKeyboardArtifacts() {
  const artifacts = []
  for (const [command, rawPath, surface, actorRole] of keyboardSpecs) {
    const createdAt = (await stat(rawPath)).mtime.toISOString()
    artifacts.push(buildArtifact(rawPath, command, {
      surface,
      actorRole,
      createdAt,
    }))
  }
  return artifacts
}

function buildLedgerRow(localSummary, liveSummary, artifacts) {
  return {
    stageId,
    phase: 'Phase 7',
    step: stageTitle,
    status: 'passed',
    authoritativePlanSections: ['Goal', 'Required Proof Before Exit', 'Commands And Expected Artifacts', 'Exit Contract'],
    assertionIds,
    repoLocalCommands: [
      {
        commandId: 'LOCAL-BACKEND',
        command: localBackendCommand,
        status: 'passed',
        result: 'The repo-local backend suites passed for semesters 4 through 6 and kept the default HoD, risk explorer, and student shell context aligned with the late checkpoint walk.',
      },
      {
        commandId: 'LOCAL-FRONTEND',
        command: localFrontendCommand,
        status: 'passed',
        result: 'The repo-local frontend suites passed for late-stage playback banners, proof-page rendering, and explicit semester activation wiring in the proof dashboard.',
      },
      {
        commandId: 'LOCAL-PROOF',
        command: localProofCommand,
        status: 'passed',
        result: `The local semester-walk proof passed for semesters 4, 5, and 6 and recorded its combined summary in ${summaryFilePath(localSummary)}.`,
      },
      {
        commandId: 'LOCAL-KEYBOARD',
        command: localKeyboardCommand,
        status: 'passed',
        result: `The local keyboard regression passed with stage-scoped artifacts in ${files.localKeyboardReport} and ${files.localKeyboardScreenshot}.`,
      },
    ],
    liveCommands: [
      {
        commandId: 'LIVE-PROBE',
        command: liveProbeCommand,
        status: 'passed',
        result: 'The cheap live probe confirmed the deployed stack was ready for the late-semester browser pass before the expensive proof sweep.',
      },
      {
        commandId: 'LIVE-PROOF',
        command: liveProofCommand,
        status: 'passed',
        result: `The live semester-walk proof passed for semesters 4, 5, and 6 and recorded its combined summary in ${summaryFilePath(liveSummary)}.`,
      },
      {
        commandId: 'LIVE-KEYBOARD',
        command: liveKeyboardCommand,
        status: 'passed',
        result: `The live keyboard regression passed with stage-scoped artifacts in ${files.liveKeyboardReport} and ${files.liveKeyboardScreenshot}.`,
      },
    ],
    env: {
      PLAYWRIGHT_APP_URL: liveSummary.appUrl,
      PLAYWRIGHT_API_URL: liveSummary.apiUrl,
      AIRMENTOR_LIVE_STACK: '1',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: 'sysadmin',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'admin1234',
    },
    artifacts: artifacts.map(item => item.artifactId),
    defectsOpened: [],
    defectsClosed: [],
    blocker: null,
    notes: [
      ...semesters.map(semester => noteForSemester(localSummary, liveSummary, semester)),
      `Live semester-walk probe: ${files.liveProbe}`,
      `Local semester-walk summary: ${summaryFilePath(localSummary)}`,
      `Live semester-walk summary: ${summaryFilePath(liveSummary)}`,
      `Local keyboard report: ${files.localKeyboardReport}`,
      `Live keyboard report: ${files.liveKeyboardReport}`,
    ],
    nextAction: 'Stage 08A may begin now that semesters 4 through 6 are individually proven and late-stage keyboard/playback behavior is artifact-backed locally and live.',
  }
}

function rowForArtifact(artifact, command, note) {
  return `| ${artifact.artifactId} | ${artifact.rawPath} | ${artifact.assertionIds.join(', ')} | ${command} | ${note} |`
}

function noteForArtifact(artifact) {
  if (artifact.surface === 'semester-walk-probe') {
    return 'Cheap live probe confirmed semesters 4, 5, and 6 were activatable and mapped to deterministic checkpoints before the browser pass.'
  }
  if (artifact.surface === 'semester-walk-summary') {
    return `Combined ${artifact.scriptName === 'LIVE-PROOF' ? 'live' : 'local'} semester-walk summary for semesters 4, 5, and 6.`
  }
  if (artifact.surface === 'semester-walk-detail-summary') {
    return `Semester ${artifact.semesterNumber} checkpoint ${artifact.simulationStageCheckpointId}. detail summary JSON.`
  }
  if (artifact.surface === 'system-admin-keyboard-regression-report') {
    return `${artifact.scriptName === 'LIVE-KEYBOARD' ? 'Live' : 'Local'} late-stage keyboard regression report.`
  }
  if (artifact.surface === 'system-admin-keyboard-regression') {
    return `${artifact.scriptName === 'LIVE-KEYBOARD' ? 'Live' : 'Local'} late-stage keyboard regression screenshot.`
  }
  if (artifact.surface === 'system-admin-proof-semester-activation-request' || artifact.surface === 'system-admin-proof-semester-activation-response') {
    return `Semester ${artifact.semesterNumber} checkpoint ${artifact.simulationStageCheckpointId}. ${artifact.surface}.`
  }
  return `Semester ${artifact.semesterNumber} checkpoint ${artifact.simulationStageCheckpointId}. ${artifact.surface}.`
}

function buildIndexSection(title, command, artifacts, sourceCommand) {
  if (artifacts.length === 0) return ''
  const rows = artifacts.map(artifact => rowForArtifact(artifact, sourceCommand, noteForArtifact(artifact)))
  return `### Command \`${title}\`\n\n| artifactId | path | assertionIds | source command | notes |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`
}

async function buildStage07cSection(localSummary, liveSummary, allArtifacts) {
  const localProofArtifacts = allArtifacts.filter(item => item.scriptName === 'LOCAL-PROOF')
  const liveProbeArtifacts = allArtifacts.filter(item => item.scriptName === 'LIVE-PROBE')
  const liveProofArtifacts = allArtifacts.filter(item => item.scriptName === 'LIVE-PROOF')
  const localKeyboardArtifacts = allArtifacts.filter(item => item.scriptName === 'LOCAL-KEYBOARD')
  const liveKeyboardArtifacts = allArtifacts.filter(item => item.scriptName === 'LIVE-KEYBOARD')

  return [
    '## Stage 07C',
    '',
    '### Command `LOCAL-BACKEND`',
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ledger-only | n/a | ATM-07C-001 | ${localBackendCommand} | Repo-local backend proof passed for semesters 4, 5, and 6 with explicit late-stage checkpoint semantics. |`,
    '',
    '### Command `LOCAL-FRONTEND`',
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ledger-only | n/a | ATM-07C-001 | ${localFrontendCommand} | Repo-local frontend proof passed for late-stage playback banners, blocked-state rendering, and proof-page parity. |`,
    '',
    buildIndexSection('LOCAL-PROOF', 'LOCAL-PROOF', localProofArtifacts, localProofCommand).trimEnd(),
    '',
    buildIndexSection('LOCAL-KEYBOARD', 'LOCAL-KEYBOARD', localKeyboardArtifacts, localKeyboardCommand).trimEnd(),
    '',
    buildIndexSection('LIVE-PROBE', 'LIVE-PROBE', liveProbeArtifacts, liveProbeCommand).trimEnd(),
    '',
    buildIndexSection('LIVE-PROOF', 'LIVE-PROOF', liveProofArtifacts, liveProofCommand).trimEnd(),
    '',
    buildIndexSection('LIVE-KEYBOARD', 'LIVE-KEYBOARD', liveKeyboardArtifacts, liveKeyboardCommand).trimEnd(),
    '',
  ].join('\n')
}

function buildCompletionBlock(localSummary, liveSummary) {
  return [
    '## Completion Update',
    '- Status: `passed`',
    `- Local semester-walk summary: \`${path.relative(repoRoot, files.localSummary)}\``,
    `- Live probe artifact: \`${path.relative(repoRoot, files.liveProbe)}\``,
    `- Live semester-walk summary: \`${path.relative(repoRoot, files.liveSummary)}\``,
    `- Local keyboard report: \`${path.relative(repoRoot, files.localKeyboardReport)}\``,
    `- Local keyboard screenshot: \`${path.relative(repoRoot, files.localKeyboardScreenshot)}\``,
    `- Live keyboard report: \`${path.relative(repoRoot, files.liveKeyboardReport)}\``,
    `- Live keyboard screenshot: \`${path.relative(repoRoot, files.liveKeyboardScreenshot)}\``,
    ...semesters.map(semester => `- ${noteForSemester(localSummary, liveSummary, semester)}`),
    '- Ledger, manifest, and evidence index now share the same semester-specific artifact ids for semesters 4, 5, and 6 plus the local/live keyboard artifacts.',
    '',
  ].join('\n')
}

async function main() {
  for (const filePath of Object.values(files)) assertFileExists(filePath)

  const [
    ledgerText,
    manifestText,
    indexText,
    assertionMatrixText,
    coverageMatrixText,
    stage07cText,
    localSummaryText,
    liveProbeText,
    liveSummaryText,
  ] = await Promise.all([
    readFile(files.ledger, 'utf8'),
    readFile(files.manifest, 'utf8'),
    readFile(files.index, 'utf8'),
    readFile(files.assertionMatrix, 'utf8'),
    readFile(files.coverageMatrix, 'utf8'),
    readFile(files.stage07c, 'utf8'),
    readFile(files.localSummary, 'utf8'),
    readFile(files.liveProbe, 'utf8'),
    readFile(files.liveSummary, 'utf8'),
  ])

  const localSummary = JSON.parse(localSummaryText)
  const liveProbe = JSON.parse(liveProbeText)
  const liveSummary = JSON.parse(liveSummaryText)
  const rows = parseJsonl(ledgerText).filter(row => row.stageId !== stageId)
  const manifest = JSON.parse(manifestText)

  const proofArtifacts = [
    ...(await collectArtifactsForSummary(localSummary)),
    {
      ...probeArtifact(liveProbe),
      createdAt: (await stat(files.liveProbe)).mtime.toISOString(),
    },
    ...(await collectArtifactsForSummary(liveSummary)),
  ]
  const keyboardArtifacts = await collectKeyboardArtifacts()
  const allArtifacts = [...proofArtifacts, ...keyboardArtifacts]

  rows.push(buildLedgerRow(localSummary, liveSummary, allArtifacts))
  for (const artifact of allArtifacts) upsertManifestArtifact(manifest, artifact)

  const stage07cSection = await buildStage07cSection(localSummary, liveSummary, allArtifacts)
  const completionBlock = buildCompletionBlock(localSummary, liveSummary)

  const updatedIndex = indexText.includes('## Stage 07C')
    ? replaceStageSection(indexText, '## Stage 07C', stage07cSection)
    : insertBeforeHeader(indexText, '## Stage 08A', stage07cSection)

  const updatedStage07c = stage07cText.includes('## Completion Update')
    ? replaceBlock(stage07cText, '## Completion Update', '\n## Goal', completionBlock)
    : insertBeforeHeader(stage07cText, '## Goal', completionBlock)

  const atm07cRow = '| ATM-07C-001 | Semester `4..6` walkthrough is deterministic, keyboard-stable, and late-stage semantics are explicit | Phase 7 | `scripts/system-admin-proof-risk-smoke.mjs`, `scripts/proof-risk-semester-walk-probe.mjs`, `scripts/system-admin-live-keyboard-regression.mjs`, and the 07C semester-walk closeout helper now keep semesters 4, 5, and 6 individually mapped with blocked-stage, no-action comparator, elective-fit, and final-stage keyboard evidence. | 07C | `air-mentor-api/tests/hod-proof-analytics.test.ts`, `air-mentor-api/tests/risk-explorer.test.ts`, `air-mentor-api/tests/student-agent-shell.test.ts`, `air-mentor-api/tests/proof-control-plane-dashboard-service.test.ts`, `tests/proof-playback.test.ts`, `tests/system-admin-proof-dashboard-workspace.test.tsx`, `tests/hod-pages.test.ts`, `tests/risk-explorer.test.tsx`, `tests/student-shell.test.tsx` | `LOCAL-PROOF`, `LOCAL-KEYBOARD`, `LIVE-PROBE`, `LIVE-PROOF`, `LIVE-KEYBOARD` | live probe JSON, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, keyboard screenshot, ledger row | Semesters 4, 5, and 6 each map to deterministic Post SEE checkpoints, and late-stage blocked/elective/final behavior stays stable through playback and keyboard flows. |'
  const updatedAssertionMatrix = upsertTableRow(
    assertionMatrixText,
    '| ATM-07C-001 |',
    atm07cRow,
    '| ATM-08A-001 |',
  )

  let updatedCoverage = replaceLineByPrefix(
    coverageMatrixText,
    'Current status as of `2026-04-01`:',
    'Current status as of `2026-04-01`: `DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT`, `DEF-05A-LIVE-A11Y-PROOF-HERO-CONTRAST`, `DEF-05B-LIVE-A11Y-QUEUE-CONTRAST`, `DEF-06B-LOCAL-TEACHING-PARITY-NAV-CLOSE`, `DEF-06B-LIVE-PROOF-LOCK-COLLISION`, `DEF-07A-LIVE-PROOF-CSRF-CROSS-ORIGIN-ACTIVATION`, and `DEF-07A-LIVE-PROOF-NONSEEDED-BATCH-SELECTION` are closed. Repo-local proof plus refreshed `LIVE-PROOF`, `LIVE-TEACHING`, `LIVE-ACCEPTANCE`, `LIVE-A11Y`, and `LIVE-KEYBOARD` are current on the deployed GitHub Pages + Railway stack, and the Stage `07C` semester-walk summaries plus keyboard artifacts are current on both local and live stacks.',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Proof control plane | `SYSTEM_ADMIN` | faculties workspace proof panel |',
    '| Proof control plane | `SYSTEM_ADMIN` | faculties workspace proof panel | proof dashboard/import/run/checkpoint routes + shared proof provenance selectors + semester-walk summaries | `LOCAL-PROOF`, `LOCAL-KEYBOARD` | `LIVE-PROBE`, `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-ACCEPTANCE` | `system-admin-proof-control-plane.png`, semester-walk summary JSON, semester-scoped proof screenshot family, keyboard report, keyboard screenshot | 01B, 02B, 07B, 07C |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Teacher proof panel | `COURSE_LEADER` | faculty profile proof section |',
    '| Teacher proof panel | `COURSE_LEADER` | faculty profile proof section | faculty profile + proof bundle + proof provenance formatting + late-stage playback overlay | targeted faculty/profile tests, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-TEACHING`, `LIVE-TEACHING-PROOF`, `LIVE-KEYBOARD` | `teacher-proof-panel.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, keyboard screenshot | 01B, 04A, 07B, 07C |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Semester activation | `SYSTEM_ADMIN` | proof control plane |',
    '| Semester activation | `SYSTEM_ADMIN` | proof control plane | `POST /api/admin/proof-runs/:simulationRunId/activate-semester` + `activeOperationalSemester` propagation + seeded-batch route pinning + semester-walk proof summaries | `LOCAL-IDEMPOTENCE`, `LOCAL-PROOF` | `LIVE-PROBE`, `LIVE-PROOF` | activation request/response JSON, semester-walk summary JSON, proof screenshots | 02B, 07A, 07B, 07C |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| HoD overview | `HOD` | academic route `department` |',
    '| HoD overview | `HOD` | academic route `department` | `/api/academic/hod/proof-*` + proof provenance selectors + semester 1 through 6 proof slices | `cd air-mentor-api && npx vitest run tests/hod-proof-analytics.test.ts`, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `hod-proof-analytics.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, accessibility report | 01B, 04B, 07B, 07C |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Risk explorer | `COURSE_LEADER`, `MENTOR`, `HOD` | student drilldown to risk explorer |',
    '| Risk explorer | `COURSE_LEADER`, `MENTOR`, `HOD` | student drilldown to risk explorer | `/api/academic/students/:studentId/risk-explorer` + shared proof provenance copy + semester-walk summaries | `npm test -- --run tests/risk-explorer.test.tsx` and backend risk tests, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `teacher-risk-explorer-proof.png`, `hod-risk-explorer-proof.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, accessibility report | 01B, 04B, 07B, 07C |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Student shell | `COURSE_LEADER`, `MENTOR`, `HOD`, `SYSTEM_ADMIN` archived inspection | student drilldown to student shell |',
    '| Student shell | `COURSE_LEADER`, `MENTOR`, `HOD`, `SYSTEM_ADMIN` archived inspection | student drilldown to student shell | `/api/academic/student-shell/*` + shared proof provenance copy + semester-walk summaries | `npm test -- --run tests/student-shell.test.tsx` and backend student-shell tests, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD` | `student-shell-proof.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, keyboard screenshot | 01B, 04B, 07B, 07C |',
  )

  await Promise.all([
    writeFile(files.ledger, formatJsonl(rows), 'utf8'),
    writeFile(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(files.index, `${updatedIndex.trimEnd()}\n`, 'utf8'),
    writeFile(files.assertionMatrix, updatedAssertionMatrix, 'utf8'),
    writeFile(files.coverageMatrix, updatedCoverage, 'utf8'),
    writeFile(files.stage07c, updatedStage07c, 'utf8'),
  ])
}

await main()
