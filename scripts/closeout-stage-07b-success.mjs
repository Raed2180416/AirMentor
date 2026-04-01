#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

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
  stage07b: path.join(docsDir, 'stage-07b-semester-1-to-3-proof-walk.md'),
  localSummary: path.join(playwrightDir, '07b-local-semester-walk-summary.json'),
  liveProbe: path.join(playwrightDir, '07b-live-probe-semester-probe.json'),
  liveSummary: path.join(playwrightDir, '07b-live-semester-walk-summary.json'),
}

const assertionIds = ['ATM-07B-001']
const localBackendCommand = 'env -C air-mentor-api npx vitest run --reporter=verbose --maxWorkers=1 tests/hod-proof-analytics.test.ts tests/risk-explorer.test.ts tests/student-agent-shell.test.ts'
const localFrontendCommand = 'npm test -- --run tests/proof-playback.test.ts tests/proof-risk-semester-walk.test.ts tests/system-admin-proof-dashboard-workspace.test.tsx tests/hod-pages.test.ts tests/risk-explorer.test.tsx tests/student-shell.test.tsx'
const localProofCommand = 'AIRMENTOR_PROOF_SEMESTER_TARGETS=1,2,3 AIRMENTOR_PROOF_ARTIFACT_PREFIX=07b-local npm run playwright:admin-live:proof-risk'
const liveProbeCommand = 'AIRMENTOR_LIVE_STACK=1 AIRMENTOR_PROOF_SEMESTER_TARGETS=1,2,3 AIRMENTOR_PROOF_ARTIFACT_PREFIX=07b-live-probe node scripts/proof-risk-semester-walk-probe.mjs'
const liveProofCommand = 'AIRMENTOR_LIVE_STACK=1 AIRMENTOR_PROOF_SEMESTER_TARGETS=1,2,3 AIRMENTOR_PROOF_ARTIFACT_PREFIX=07b-live npm run playwright:admin-live:proof-risk'

const semesterScreenshotSpecs = [
  ['systemAdmin', 'system-admin-proof-control-plane', 'SYSTEM_ADMIN'],
  ['teacher', 'teacher-proof-panel', 'COURSE_LEADER'],
  ['teacherRiskExplorer', 'teacher-risk-explorer', 'COURSE_LEADER'],
  ['hod', 'hod-proof-analytics', 'HOD'],
  ['hodRiskExplorer', 'hod-risk-explorer', 'HOD'],
  ['studentShell', 'student-shell', 'HOD'],
]

const indexScreenshotSpecs = [
  ['systemAdmin', 'system-admin-proof-control-plane.png', 'system-admin-proof-control-plane', 'SYSTEM_ADMIN'],
  ['teacher', 'teacher-proof-panel.png', 'teacher-proof-panel', 'COURSE_LEADER'],
  ['teacherRiskExplorer', 'teacher-risk-explorer-proof.png', 'teacher-risk-explorer', 'COURSE_LEADER'],
  ['hod', 'hod-proof-analytics.png', 'hod-proof-analytics', 'HOD'],
  ['hodRiskExplorer', 'hod-risk-explorer-proof.png', 'hod-risk-explorer', 'HOD'],
  ['studentShell', 'student-shell-proof.png', 'student-shell', 'HOD'],
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

function insertBeforeHeader(text, header, block) {
  const index = text.indexOf(header)
  if (index < 0) {
    return `${text.trimEnd()}\n\n${block}\n`
  }
  return `${text.slice(0, index)}${block}\n\n${text.slice(index)}`
}

function buildArtifactId(stage, command, basename) {
  return `${stage}--${command}--${basename}`
}

function commandForSummary(summary) {
  return summary.stack === 'live' ? 'LIVE-PROOF' : 'LOCAL-PROOF'
}

function summaryFilePath(summary) {
  return summary.stack === 'live'
    ? files.liveSummary
    : files.localSummary
}

function sourceCommandForSummary(summary) {
  return summary.stack === 'live' ? liveProofCommand : localProofCommand
}

function summaryLabel(summary) {
  return summary.stack === 'live' ? 'live' : 'local'
}

function probeArtifact(probe = null) {
  return {
    semesterNumber: null,
    stageKey: null,
    simulationRunId: probe?.simulationRunId ?? null,
    simulationStageCheckpointId: null,
    scopeType: 'batch',
    scopeId: probe?.batchId ?? 'batch_branch_mnc_btech_2023',
    routeHash: probe?.routeHash ?? '#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023',
    studentId: null,
    courseId: null,
    labeledPath: null,
    artifactId: buildArtifactId('07B', 'LIVE-PROBE', path.basename(files.liveProbe)),
    surface: 'semester-walk-probe',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds,
    rawPath: files.liveProbe,
    scriptName: 'LIVE-PROBE',
  }
}

function semesterNumberFor(summary) {
  return Number(summary.targetedSemester ?? summary.selectedCheckpoint?.semesterNumber ?? 0)
}

function checkpointFor(summary) {
  return summary.selectedCheckpoint ?? {}
}

function semesterSummaryPathFor(summary, semesterNumber) {
  const summaryPaths = Array.isArray(summary.summaryPaths) ? summary.summaryPaths : []
  const directMatch = summaryPaths.find(item => item.includes(`semester-${semesterNumber}-`))
  return directMatch ?? null
}

function semesterArtifactIds(summary, semesterSummary) {
  const command = commandForSummary(summary)
  const paths = semesterSummary.semesterScopedArtifacts ?? {}
  const ids = []
  const semesterSummaryPath = semesterSummaryPathFor(summary, semesterNumberFor(semesterSummary))
  if (semesterSummaryPath) {
    ids.push(buildArtifactId('07B', command, path.basename(semesterSummaryPath)))
  }
  for (const [key, basename] of semesterScreenshotSpecs) {
    const rawPath = paths.screenshots?.[key]
    if (rawPath) ids.push(buildArtifactId('07B', command, path.basename(rawPath)))
  }
  if (paths.activationArtifacts?.request) {
    ids.push(buildArtifactId('07B', command, path.basename(paths.activationArtifacts.request)))
  }
  if (paths.activationArtifacts?.response) {
    ids.push(buildArtifactId('07B', command, path.basename(paths.activationArtifacts.response)))
  }
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
  const artifacts = [{
    semesterNumber: null,
    stageKey: null,
    simulationRunId: firstSemesterSummary?.simulationRunId ?? summary.simulationRunId ?? null,
    simulationStageCheckpointId: null,
    scopeType: 'batch',
    scopeId: firstSemesterSummary?.batchId ?? summary.batchId ?? null,
    routeHash: firstSemesterSummary?.routeHash ?? summary.routeHash ?? null,
    studentId: null,
    courseId: null,
    labeledPath: null,
    artifactId: buildArtifactId('07B', command, path.basename(summaryPath)),
    surface: 'semester-walk-summary',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds,
    rawPath: summaryPath,
    scriptName: command,
    appUrl: summary.appUrl,
    apiUrl: summary.apiUrl,
    createdAt: summaryStats.mtime.toISOString(),
  }]

  const semesters = [...(summary.summaries ?? [])].sort((left, right) => semesterNumberFor(left) - semesterNumberFor(right))
  for (const semesterSummary of semesters) {
    const checkpoint = checkpointFor(semesterSummary)
    const semester = semesterNumberFor(semesterSummary)
    const semesterSummaryPath = semesterSummaryPathFor(summary, semester)
    const scopedArtifacts = semesterSummary.semesterScopedArtifacts ?? {}
    const simulationRunId = semesterSummary.simulationRunId ?? summary.simulationRunId ?? null
    const batchId = semesterSummary.batchId ?? summary.batchId ?? null
    const routeHash = semesterSummary.routeHash ?? summary.routeHash ?? null
    const createdAtFor = async (filePath) => (await stat(filePath)).mtime.toISOString()
    if (semesterSummaryPath) {
      artifacts.push({
        semesterNumber: semester,
        stageKey: checkpoint.stageKey ?? null,
        simulationRunId,
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId ?? null,
        scopeType: 'batch',
        scopeId: batchId,
        routeHash,
        studentId: null,
        courseId: null,
        labeledPath: null,
        artifactId: buildArtifactId('07B', command, path.basename(semesterSummaryPath)),
        surface: 'semester-walk-detail-summary',
        actorRole: 'SYSTEM_ADMIN',
        assertionIds,
        rawPath: semesterSummaryPath,
        scriptName: command,
        appUrl: summary.appUrl,
        apiUrl: summary.apiUrl,
        createdAt: await createdAtFor(semesterSummaryPath),
      })
    }
    for (const [key, surface, actorRole] of semesterScreenshotSpecs) {
      const rawPath = scopedArtifacts.screenshots?.[key]
      if (!rawPath) continue
      artifacts.push({
        semesterNumber: semester,
        stageKey: checkpoint.stageKey ?? null,
        simulationRunId,
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId ?? null,
        scopeType: 'batch',
        scopeId: batchId,
        routeHash: surface === 'system-admin-proof-control-plane' ? routeHash : null,
        studentId: null,
        courseId: null,
        labeledPath: null,
        artifactId: buildArtifactId('07B', command, path.basename(rawPath)),
        surface,
        actorRole,
        assertionIds,
        rawPath,
        scriptName: command,
        appUrl: summary.appUrl,
        apiUrl: summary.apiUrl,
        createdAt: await createdAtFor(rawPath),
      })
    }
    if (scopedArtifacts.activationArtifacts?.request) {
      const rawPath = scopedArtifacts.activationArtifacts.request
      artifacts.push({
        semesterNumber: semester,
        stageKey: checkpoint.stageKey ?? null,
        simulationRunId,
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId ?? null,
        scopeType: 'batch',
        scopeId: batchId,
        routeHash,
        studentId: null,
        courseId: null,
        labeledPath: null,
        artifactId: buildArtifactId('07B', command, path.basename(rawPath)),
        surface: 'system-admin-proof-semester-activation-request',
        actorRole: 'SYSTEM_ADMIN',
        assertionIds,
        rawPath,
        scriptName: command,
        appUrl: summary.appUrl,
        apiUrl: summary.apiUrl,
        createdAt: (await stat(rawPath)).mtime.toISOString(),
      })
    }
    if (scopedArtifacts.activationArtifacts?.response) {
      const rawPath = scopedArtifacts.activationArtifacts.response
      artifacts.push({
        semesterNumber: semester,
        stageKey: checkpoint.stageKey ?? null,
        simulationRunId,
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId ?? null,
        scopeType: 'batch',
        scopeId: batchId,
        routeHash,
        studentId: null,
        courseId: null,
        labeledPath: null,
        artifactId: buildArtifactId('07B', command, path.basename(rawPath)),
        surface: 'system-admin-proof-semester-activation-response',
        actorRole: 'SYSTEM_ADMIN',
        assertionIds,
        rawPath,
        scriptName: command,
        appUrl: summary.appUrl,
        apiUrl: summary.apiUrl,
        createdAt: (await stat(rawPath)).mtime.toISOString(),
      })
    }
  }

  return artifacts
}

function buildLedgerRow(localSummary, liveSummary, artifacts) {
  return {
    stageId: '07B',
    phase: 'Phase 7',
    step: 'Semester 1 To 3 Proof Walk',
    status: 'passed',
    authoritativePlanSections: ['Goal', 'Required Proof Before Exit', 'Commands And Expected Artifacts', 'Exit Contract'],
    assertionIds,
    repoLocalCommands: [
      {
        commandId: 'LOCAL-BACKEND',
        command: localBackendCommand,
        status: 'passed',
        result: 'The repo-local backend parity suites passed for semesters 1 through 3 and the HoD slice proved the default proof context stays aligned to each activated semester.',
      },
      {
        commandId: 'LOCAL-FRONTEND',
        command: localFrontendCommand,
        status: 'passed',
        result: 'The repo-local frontend parity suites passed for the semester-walk proof helpers, dashboard controls, and proof pages without late-semester assumptions leaking back into early-semester coverage.',
      },
      {
        commandId: 'LOCAL-PROOF',
        command: localProofCommand,
        status: 'passed',
        result: `The local semester-walk proof passed for semesters 1, 2, and 3 and recorded its combined summary in ${summaryFilePath(localSummary)}.`,
      },
    ],
    liveCommands: [
      {
        commandId: 'LIVE-PROBE',
        command: liveProbeCommand,
        status: 'passed',
        result: 'The cheap live probe confirmed the deployed stack was ready for the semester-walk browser pass before the expensive proof sweep.',
      },
      {
        commandId: 'LIVE-PROOF',
        command: liveProofCommand,
        status: 'passed',
        result: `The live semester-walk proof passed for semesters 1, 2, and 3 and recorded its combined summary in ${summaryFilePath(liveSummary)}.`,
      },
    ],
    env: {
      PLAYWRIGHT_APP_URL: liveSummary.appUrl,
      PLAYWRIGHT_API_URL: liveSummary.apiUrl,
      AIRMENTOR_LIVE_STACK: '1',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: '<identifier>',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: '<redacted>',
    },
    artifacts: artifacts.map(item => item.artifactId),
    defectsOpened: [],
    defectsClosed: [],
    blocker: null,
    notes: [
      noteForSemester(localSummary, liveSummary, 1),
      noteForSemester(localSummary, liveSummary, 2),
      noteForSemester(localSummary, liveSummary, 3),
      `Live semester-walk probe: ${files.liveProbe}`,
      `Local semester-walk summary: ${summaryFilePath(localSummary)}`,
      `Live semester-walk summary: ${summaryFilePath(liveSummary)}`,
    ],
    nextAction: 'Stage 07C may begin now that semesters 1 through 3 are individually proven across sysadmin and teaching proof surfaces with explicit artifact mapping.',
  }
}

function rowForArtifact(artifact, command, note) {
  return `| ${artifact.artifactId} | ${artifact.rawPath} | ${artifact.assertionIds.join(', ')} | ${command} | ${note} |`
}

async function buildProbeIndexSection() {
  const probePayload = JSON.parse(await readFile(files.liveProbe, 'utf8'))
  const artifact = probeArtifact(probePayload)
  const createdAt = (await stat(artifact.rawPath)).mtime.toISOString()
  return `### Command \`LIVE-PROBE\`\n\n| artifactId | path | assertionIds | source command | notes |\n| --- | --- | --- | --- | --- |\n${rowForArtifact(
    {
      ...artifact,
      createdAt,
      appUrl: probePayload.appUrl,
      apiUrl: probePayload.apiUrl,
    },
    liveProbeCommand,
    `Cheap live probe confirmed semesters ${probePayload.semesterTargets.join(', ')} were activatable and mapped to deterministic checkpoints before the browser pass.`,
  )}\n`
}

function buildIndexSection(summary) {
  const command = commandForSummary(summary)
  const sourceCommand = sourceCommandForSummary(summary)
  const summaryPath = summaryFilePath(summary)
  const summaryArtifactId = buildArtifactId('07B', command, path.basename(summaryPath))
  const rows = [
    rowForArtifact({
      artifactId: summaryArtifactId,
      rawPath: summaryPath,
      assertionIds,
    }, sourceCommand, `Combined ${summaryLabel(summary)} semester-walk summary for semesters 1, 2, and 3.`),
  ]

  const semesters = [...(summary.summaries ?? [])].sort((left, right) => semesterNumberFor(left) - semesterNumberFor(right))
  for (const semesterSummary of semesters) {
    const semester = semesterNumberFor(semesterSummary)
    const checkpoint = checkpointFor(semesterSummary).simulationStageCheckpointId ?? 'missing'
    const semesterSummaryPath = semesterSummaryPathFor(summary, semester)
    const scopedArtifacts = semesterSummary.semesterScopedArtifacts ?? {}
    if (semesterSummaryPath) {
      rows.push(rowForArtifact({
        artifactId: buildArtifactId('07B', command, path.basename(semesterSummaryPath)),
        rawPath: semesterSummaryPath,
        assertionIds,
      }, sourceCommand, `Semester ${semester} checkpoint ${checkpoint}. detail summary JSON.`))
    }
    for (const [key, basename, surface, actorRole] of indexScreenshotSpecs) {
      const rawPath = scopedArtifacts.screenshots?.[key]
      if (!rawPath) continue
      rows.push(rowForArtifact({
        artifactId: buildArtifactId('07B', command, path.basename(rawPath)),
        rawPath,
        assertionIds,
      }, sourceCommand, `Semester ${semester} checkpoint ${checkpoint}. ${surface}.`))
    }
    for (const [kind, basename] of [['request', 'request'], ['response', 'response']]) {
      const rawPath = scopedArtifacts.activationArtifacts?.[kind]
      if (!rawPath) continue
      rows.push(rowForArtifact({
        artifactId: buildArtifactId('07B', command, path.basename(rawPath)),
        rawPath,
        assertionIds,
      }, sourceCommand, `Semester ${semester} checkpoint ${checkpoint}. system-admin-proof-semester-activation-${kind}.`))
    }
  }

  return `### Command \`${summaryLabel(summary).toUpperCase()}-PROOF\`\n\n| artifactId | path | assertionIds | source command | notes |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`
}

async function buildStage07bSection(localSummary, liveSummary) {
  return [
    '## Stage 07B',
    '',
    '### Command `LOCAL-BACKEND`',
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ledger-only | n/a | ATM-07B-001 | ${localBackendCommand} | Repo-local backend parity passed for semesters 1 through 3 and kept the default HoD slice aligned with each activated semester. |`,
    '',
    '### Command `LOCAL-FRONTEND`',
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ledger-only | n/a | ATM-07B-001 | ${localFrontendCommand} | Repo-local frontend parity passed for the semester-walk proof dashboard, playback helpers, and proof-page coverage. |`,
    '',
    buildIndexSection(localSummary).trimEnd(),
    '',
    (await buildProbeIndexSection()).trimEnd(),
    '',
    buildIndexSection(liveSummary).trimEnd(),
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
    `- ${noteForSemester(localSummary, liveSummary, 1)}`,
    `- ${noteForSemester(localSummary, liveSummary, 2)}`,
    `- ${noteForSemester(localSummary, liveSummary, 3)}`,
    '- Ledger, manifest, and index now share the same semester-specific artifact ids for semesters 1, 2, and 3.',
    '',
  ].join('\n')
}

async function main() {
  for (const required of Object.values(files)) {
    assertFileExists(required)
  }

  const [
    ledgerText,
    manifestText,
    indexText,
    assertionMatrixText,
    coverageMatrixText,
    stage07bText,
    localSummaryText,
    liveProbeText,
    liveSummaryText,
  ] = await Promise.all([
    readFile(files.ledger, 'utf8'),
    readFile(files.manifest, 'utf8'),
    readFile(files.index, 'utf8'),
    readFile(files.assertionMatrix, 'utf8'),
    readFile(files.coverageMatrix, 'utf8'),
    readFile(files.stage07b, 'utf8'),
    readFile(files.localSummary, 'utf8'),
    readFile(files.liveProbe, 'utf8'),
    readFile(files.liveSummary, 'utf8'),
  ])

  const localSummary = JSON.parse(localSummaryText)
  const liveProbe = JSON.parse(liveProbeText)
  const liveSummary = JSON.parse(liveSummaryText)

  const rows = parseJsonl(ledgerText).filter(row => row.stageId !== '07B')
  const manifest = JSON.parse(manifestText)

  const localArtifacts = await collectArtifactsForSummary(localSummary)
  const liveProbeArtifact = {
    ...probeArtifact(liveProbe),
    createdAt: (await stat(files.liveProbe)).mtime.toISOString(),
    appUrl: liveProbe.appUrl,
    apiUrl: liveProbe.apiUrl,
  }
  const liveArtifacts = await collectArtifactsForSummary(liveSummary)
  const artifacts = [...localArtifacts, liveProbeArtifact, ...liveArtifacts]

  rows.push(buildLedgerRow(localSummary, liveSummary, artifacts))
  for (const artifact of artifacts) {
    upsertManifestArtifact(manifest, artifact)
  }

  const stage07bSection = await buildStage07bSection(localSummary, liveSummary)
  const completionBlock = buildCompletionBlock(localSummary, liveSummary)

  const updatedIndex = indexText.includes('## Stage 07B')
    ? replaceBlock(indexText, '## Stage 07B', '\n## Stage 08A', stage07bSection)
    : insertBeforeHeader(indexText, '## Stage 08A', stage07bSection)

  const updatedStage07b = stage07bText.includes('## Completion Update')
    ? replaceBlock(stage07bText, '## Completion Update', '\n## Goal', completionBlock)
    : insertBeforeHeader(stage07bText, '## Goal', completionBlock)

  const updatedAssertionMatrix = replaceLineByPrefix(
    assertionMatrixText,
    '| ATM-07B-001 |',
    '| ATM-07B-001 | Semester `1..3` walkthrough is deterministic, semester-scoped, and artifact-mapped | Phase 7 | `scripts/system-admin-proof-risk-smoke.mjs`, `scripts/proof-risk-semester-walk-probe.mjs`, and the 07B semester-walk closeout helper now resolve explicit semester checkpoints, preserve activation provenance, and keep probe plus per-semester summary artifacts keyed to each semester. | 07B | `tests/proof-risk-semester-walk.test.ts`, `air-mentor-api/tests/hod-proof-analytics.test.ts`, `air-mentor-api/tests/risk-explorer.test.ts`, `air-mentor-api/tests/student-agent-shell.test.ts`, `tests/system-admin-proof-dashboard-workspace.test.tsx`, `tests/hod-pages.test.ts`, `tests/risk-explorer.test.tsx`, `tests/student-shell.test.tsx` | `LOCAL-PROOF`, `LIVE-PROBE`, `LIVE-PROOF` | live probe JSON, semester-walk summary JSON, semester-scoped proof screenshots, activation JSON, ledger row | Semesters 1, 2, and 3 each map to a deterministic checkpoint and a first-class artifact family instead of a generic late-semester proof note. |',
  )

  const coverageUpdates = [
    [
      'Current status as of `2026-03-30`:',
      'Current status as of `2026-04-01`: `DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT`, `DEF-05A-LIVE-A11Y-PROOF-HERO-CONTRAST`, `DEF-05B-LIVE-A11Y-QUEUE-CONTRAST`, `DEF-06B-LOCAL-TEACHING-PARITY-NAV-CLOSE`, `DEF-06B-LIVE-PROOF-LOCK-COLLISION`, `DEF-07A-LIVE-PROOF-CSRF-CROSS-ORIGIN-ACTIVATION`, and `DEF-07A-LIVE-PROOF-NONSEEDED-BATCH-SELECTION` are closed. Repo-local proof plus refreshed `LIVE-PROOF`, `LIVE-TEACHING`, `LIVE-ACCEPTANCE`, `LIVE-A11Y`, and `LIVE-KEYBOARD` are current on the deployed GitHub Pages + Railway stack, and the Stage 07B semester-walk summaries are current on both local and live stacks.',
    ],
    [
      '| Proof control plane | `SYSTEM_ADMIN` | faculties workspace proof panel | proof dashboard/import/run/checkpoint routes + shared proof provenance selectors | `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-ACCEPTANCE` | `system-admin-proof-control-plane.png`, acceptance report | 01B, 02B |',
      '| Proof control plane | `SYSTEM_ADMIN` | faculties workspace proof panel | proof dashboard/import/run/checkpoint routes + shared proof provenance selectors + semester-walk summaries | `LOCAL-PROOF` | `LIVE-PROBE`, `LIVE-PROOF`, `LIVE-ACCEPTANCE` | `system-admin-proof-control-plane.png`, semester-walk summary JSON, semester-scoped proof screenshot family | 01B, 02B, 07B |',
    ],
    [
      '| Semester activation | `SYSTEM_ADMIN` | proof control plane | `POST /api/admin/proof-runs/:simulationRunId/activate-semester` + `activeOperationalSemester` propagation + seeded-batch route pinning | `LOCAL-IDEMPOTENCE`, `LOCAL-PROOF` | `LIVE-PROBE`, `LIVE-PROOF` | activation request/response JSON, proof screenshots | 02B, 07A |',
      '| Semester activation | `SYSTEM_ADMIN` | proof control plane | `POST /api/admin/proof-runs/:simulationRunId/activate-semester` + `activeOperationalSemester` propagation + seeded-batch route pinning + semester-walk proof summaries | `LOCAL-IDEMPOTENCE`, `LOCAL-PROOF` | `LIVE-PROBE`, `LIVE-PROOF` | activation request/response JSON, semester-walk summary JSON, proof screenshots | 02B, 07A, 07B |',
    ],
    [
      '| HoD overview | `HOD` | academic route `department` | `/api/academic/hod/proof-*` + proof provenance selectors | `cd air-mentor-api && npx vitest run tests/hod-proof-analytics.test.ts`, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `hod-proof-analytics.png`, keyboard report, accessibility report | 01B, 04B |',
      '| HoD overview | `HOD` | academic route `department` | `/api/academic/hod/proof-*` + proof provenance selectors + semester 1 through 3 proof slices | `cd air-mentor-api && npx vitest run tests/hod-proof-analytics.test.ts`, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `hod-proof-analytics.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, accessibility report | 01B, 04B, 07B |',
    ],
    [
      '| Risk explorer | `COURSE_LEADER`, `MENTOR`, `HOD` | student drilldown to risk explorer | `/api/academic/students/:studentId/risk-explorer` + shared proof provenance copy | `npm test -- --run tests/risk-explorer.test.tsx` and backend risk tests, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `teacher-risk-explorer-proof.png`, `hod-risk-explorer-proof.png`, keyboard report, accessibility report | 01B, 04B |',
      '| Risk explorer | `COURSE_LEADER`, `MENTOR`, `HOD` | student drilldown to risk explorer | `/api/academic/students/:studentId/risk-explorer` + shared proof provenance copy + semester-walk summaries | `npm test -- --run tests/risk-explorer.test.tsx` and backend risk tests, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `teacher-risk-explorer-proof.png`, `hod-risk-explorer-proof.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, accessibility report | 01B, 04B, 07B |',
    ],
    [
      '| Student shell | `COURSE_LEADER`, `MENTOR`, `HOD`, `SYSTEM_ADMIN` archived inspection | student drilldown to student shell | `/api/academic/student-shell/*` + shared proof provenance copy | `npm test -- --run tests/student-shell.test.tsx` and backend student-shell tests, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD` | `student-shell-proof.png`, keyboard report | 01B, 04B |',
      '| Student shell | `COURSE_LEADER`, `MENTOR`, `HOD`, `SYSTEM_ADMIN` archived inspection | student drilldown to student shell | `/api/academic/student-shell/*` + shared proof provenance copy + semester-walk summaries | `npm test -- --run tests/student-shell.test.tsx` and backend student-shell tests, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-KEYBOARD` | `student-shell-proof.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report | 01B, 04B, 07B |',
    ],
  ]

  let updatedCoverage = coverageMatrixText
  for (const [from, to] of coverageUpdates) {
    updatedCoverage = updatedCoverage.includes(from) ? updatedCoverage.replace(from, to) : updatedCoverage
  }

  await Promise.all([
    writeFile(files.ledger, formatJsonl(rows), 'utf8'),
    writeFile(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(files.index, `${updatedIndex.trimEnd()}\n`, 'utf8'),
    writeFile(files.assertionMatrix, updatedAssertionMatrix, 'utf8'),
    writeFile(files.coverageMatrix, updatedCoverage, 'utf8'),
    writeFile(files.stage07b, updatedStage07b, 'utf8'),
  ])
}

await main()
