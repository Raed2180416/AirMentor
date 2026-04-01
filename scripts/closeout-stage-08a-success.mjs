#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const stageId = '08A'
const stageTitle = 'Role E2E Sysadmin Course Leader Mentor'
const phase = 'Phase 8'
const assertionIds = ['ATM-08A-001', 'ATM-08A-002']
const liveAppUrl = 'https://raed2180416.github.io/AirMentor/'
const liveApiUrl = 'https://api-production-ab72.up.railway.app/'

const repoRoot = process.cwd()
const playwrightDir = path.join(repoRoot, 'output', 'playwright')
const docsDir = path.join(repoRoot, 'docs', 'closeout')

const files = {
  ledger: path.join(playwrightDir, 'execution-ledger.jsonl'),
  manifest: path.join(playwrightDir, 'proof-evidence-manifest.json'),
  index: path.join(playwrightDir, 'proof-evidence-index.md'),
  defects: path.join(playwrightDir, 'defect-register.json'),
  assertionMatrix: path.join(docsDir, 'assertion-traceability-matrix.md'),
  coverageMatrix: path.join(docsDir, 'sysadmin-teaching-proof-coverage-matrix.md'),
  stage08a: path.join(docsDir, 'stage-08a-role-e2e-sysadmin-course-leader-mentor.md'),
  localAcceptanceReport: path.join(playwrightDir, '08a-local-acceptance-system-admin-live-acceptance-report.json'),
  localAcceptanceScreenshot: path.join(playwrightDir, '08a-local-acceptance-system-admin-live-acceptance.png'),
  localRequestReport: path.join(playwrightDir, '08a-local-request-flow-system-admin-live-request-flow-report.json'),
  localRequestScreenshot: path.join(playwrightDir, '08a-local-request-flow-system-admin-live-request-flow.png'),
  localTeachingParity: path.join(playwrightDir, '08a-local-teaching-system-admin-teaching-parity-smoke.png'),
  localCourseLeaderDashboard: path.join(playwrightDir, '08a-local-teaching-course-leader-dashboard-proof.png'),
  localMentorView: path.join(playwrightDir, '08a-local-teaching-mentor-view-proof.png'),
  localQueueHistory: path.join(playwrightDir, '08a-local-teaching-queue-history-proof.png'),
  localProofSummary: path.join(playwrightDir, '08a-local-proof-risk-smoke-summary.json'),
  localProofSystemAdmin: path.join(playwrightDir, '08a-local-system-admin-proof-control-plane.png'),
  localProofTeacher: path.join(playwrightDir, '08a-local-teacher-proof-panel.png'),
  localProofTeacherRisk: path.join(playwrightDir, '08a-local-teacher-risk-explorer-proof.png'),
  liveAcceptanceReport: path.join(playwrightDir, '08a-live-acceptance-system-admin-live-acceptance-report.json'),
  liveAcceptanceScreenshot: path.join(playwrightDir, '08a-live-acceptance-system-admin-live-acceptance.png'),
  liveRequestReport: path.join(playwrightDir, '08a-live-request-flow-system-admin-live-request-flow-report.json'),
  liveRequestScreenshot: path.join(playwrightDir, '08a-live-request-flow-system-admin-live-request-flow.png'),
  liveTeachingParity: path.join(playwrightDir, '08a-live-teaching-system-admin-teaching-parity-smoke.png'),
  liveCourseLeaderDashboard: path.join(playwrightDir, '08a-live-teaching-course-leader-dashboard-proof.png'),
  liveMentorView: path.join(playwrightDir, '08a-live-teaching-mentor-view-proof.png'),
  liveQueueHistory: path.join(playwrightDir, '08a-live-teaching-queue-history-proof.png'),
  liveProofSummary: path.join(playwrightDir, '08a-live-proof-risk-smoke-summary.json'),
  liveProofSystemAdmin: path.join(playwrightDir, '08a-live-system-admin-proof-control-plane.png'),
  liveProofTeacher: path.join(playwrightDir, '08a-live-teacher-proof-panel.png'),
  liveProofTeacherRisk: path.join(playwrightDir, '08a-live-teacher-risk-explorer-proof.png'),
}

const localProofRcCommand = 'npm run verify:proof-closure:proof-rc'
const localAcceptanceCommand = 'AIRMENTOR_ACCEPTANCE_ARTIFACT_PREFIX=08a-local-acceptance npm run playwright:admin-live:acceptance'
const localRequestsCommand = 'AIRMENTOR_REQUEST_FLOW_ARTIFACT_PREFIX=08a-local-request-flow npm run playwright:admin-live:request-flow'
const localTeachingCommand = 'AIRMENTOR_TEACHING_PARITY_ARTIFACT_PREFIX=08a-local-teaching npm run playwright:admin-live:teaching-parity'
const localProofCommand = 'AIRMENTOR_PROOF_ARTIFACT_PREFIX=08a-local npm run playwright:admin-live:proof-risk'
const liveAcceptanceCommand = `PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 AIRMENTOR_ACCEPTANCE_ARTIFACT_PREFIX=08a-live-acceptance npm run playwright:admin-live:acceptance`
const liveRequestsCommand = `PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 AIRMENTOR_REQUEST_FLOW_ARTIFACT_PREFIX=08a-live-request-flow npm run playwright:admin-live:request-flow`
const liveTeachingCommand = `PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 AIRMENTOR_TEACHING_PARITY_ARTIFACT_PREFIX=08a-live-teaching npm run playwright:admin-live:teaching-parity`
const liveProofCommand = `PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 AIRMENTOR_PROOF_ARTIFACT_PREFIX=08a-live npm run playwright:admin-live:proof-risk`

const artifactSpecs = [
  {
    command: 'LOCAL-ACCEPTANCE',
    rawPath: files.localAcceptanceReport,
    surface: 'system-admin-acceptance',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LOCAL-ACCEPTANCE',
    rawPath: files.localAcceptanceScreenshot,
    surface: 'system-admin-acceptance',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LOCAL-REQUESTS',
    rawPath: files.localRequestReport,
    surface: 'system-admin-request-flow',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LOCAL-REQUESTS',
    rawPath: files.localRequestScreenshot,
    surface: 'system-admin-request-flow',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LOCAL-TEACHING',
    rawPath: files.localTeachingParity,
    surface: 'teaching-parity',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: assertionIds,
  },
  {
    command: 'LOCAL-TEACHING',
    rawPath: files.localCourseLeaderDashboard,
    surface: 'course-leader-dashboard',
    actorRole: 'COURSE_LEADER',
    assertionIds: ['ATM-08A-002'],
  },
  {
    command: 'LOCAL-TEACHING',
    rawPath: files.localMentorView,
    surface: 'mentor-view',
    actorRole: 'MENTOR',
    assertionIds: ['ATM-08A-002'],
  },
  {
    command: 'LOCAL-TEACHING',
    rawPath: files.localQueueHistory,
    surface: 'queue-history',
    actorRole: 'MENTOR',
    assertionIds: ['ATM-08A-002'],
  },
  {
    command: 'LOCAL-PROOF',
    rawPath: files.localProofSummary,
    surface: 'proof-risk-smoke-summary',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: assertionIds,
    proofSummary: 'local',
  },
  {
    command: 'LOCAL-PROOF',
    rawPath: files.localProofSystemAdmin,
    surface: 'system-admin-proof-control-plane',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
    proofSummary: 'local',
    useRouteHash: true,
  },
  {
    command: 'LOCAL-PROOF',
    rawPath: files.localProofTeacher,
    surface: 'teacher-proof-panel',
    actorRole: 'COURSE_LEADER',
    assertionIds: ['ATM-08A-002'],
    proofSummary: 'local',
  },
  {
    command: 'LOCAL-PROOF',
    rawPath: files.localProofTeacherRisk,
    surface: 'teacher-risk-explorer',
    actorRole: 'COURSE_LEADER',
    assertionIds: ['ATM-08A-002'],
    proofSummary: 'local',
  },
  {
    command: 'LIVE-ACCEPTANCE',
    rawPath: files.liveAcceptanceReport,
    surface: 'system-admin-acceptance',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LIVE-ACCEPTANCE',
    rawPath: files.liveAcceptanceScreenshot,
    surface: 'system-admin-acceptance',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LIVE-REQUESTS',
    rawPath: files.liveRequestReport,
    surface: 'system-admin-request-flow',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LIVE-REQUESTS',
    rawPath: files.liveRequestScreenshot,
    surface: 'system-admin-request-flow',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
  },
  {
    command: 'LIVE-TEACHING',
    rawPath: files.liveTeachingParity,
    surface: 'teaching-parity',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: assertionIds,
  },
  {
    command: 'LIVE-TEACHING',
    rawPath: files.liveCourseLeaderDashboard,
    surface: 'course-leader-dashboard',
    actorRole: 'COURSE_LEADER',
    assertionIds: ['ATM-08A-002'],
  },
  {
    command: 'LIVE-TEACHING',
    rawPath: files.liveMentorView,
    surface: 'mentor-view',
    actorRole: 'MENTOR',
    assertionIds: ['ATM-08A-002'],
  },
  {
    command: 'LIVE-TEACHING',
    rawPath: files.liveQueueHistory,
    surface: 'queue-history',
    actorRole: 'MENTOR',
    assertionIds: ['ATM-08A-002'],
  },
  {
    command: 'LIVE-PROOF',
    rawPath: files.liveProofSummary,
    surface: 'proof-risk-smoke-summary',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: assertionIds,
    proofSummary: 'live',
  },
  {
    command: 'LIVE-PROOF',
    rawPath: files.liveProofSystemAdmin,
    surface: 'system-admin-proof-control-plane',
    actorRole: 'SYSTEM_ADMIN',
    assertionIds: ['ATM-08A-001'],
    proofSummary: 'live',
    useRouteHash: true,
  },
  {
    command: 'LIVE-PROOF',
    rawPath: files.liveProofTeacher,
    surface: 'teacher-proof-panel',
    actorRole: 'COURSE_LEADER',
    assertionIds: ['ATM-08A-002'],
    proofSummary: 'live',
  },
  {
    command: 'LIVE-PROOF',
    rawPath: files.liveProofTeacherRisk,
    surface: 'teacher-risk-explorer',
    actorRole: 'COURSE_LEADER',
    assertionIds: ['ATM-08A-002'],
    proofSummary: 'live',
  },
]

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

function normalizeUrl(value) {
  return String(value ?? '').replace(/\/+$/, '')
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

function buildArtifactId(command, rawPath) {
  return `${stageId}--${command}--${path.basename(rawPath)}`
}

function commandSource(command) {
  switch (command) {
    case 'LOCAL-ACCEPTANCE':
      return localAcceptanceCommand
    case 'LOCAL-REQUESTS':
      return localRequestsCommand
    case 'LOCAL-TEACHING':
      return localTeachingCommand
    case 'LOCAL-PROOF':
      return localProofCommand
    case 'LIVE-ACCEPTANCE':
      return liveAcceptanceCommand
    case 'LIVE-REQUESTS':
      return liveRequestsCommand
    case 'LIVE-TEACHING':
      return liveTeachingCommand
    case 'LIVE-PROOF':
      return liveProofCommand
    default:
      throw new Error(`Unsupported command: ${command}`)
  }
}

function noteForArtifact(artifact) {
  switch (artifact.surface) {
    case 'system-admin-acceptance':
      return `${artifact.scriptName === 'LIVE-ACCEPTANCE' ? 'Live' : 'Local'} system-admin acceptance artifact for the end-to-end governance journey.`
    case 'system-admin-request-flow':
      return `${artifact.scriptName === 'LIVE-REQUESTS' ? 'Live' : 'Local'} governed request workflow artifact for the role-e2e closeout.`
    case 'teaching-parity':
      return `${artifact.scriptName === 'LIVE-TEACHING' ? 'Live' : 'Local'} sysadmin-to-teaching handoff artifact proving profile parity.`
    case 'course-leader-dashboard':
      return `${artifact.scriptName === 'LIVE-TEACHING' ? 'Live' : 'Local'} course leader dashboard artifact after sysadmin handoff.`
    case 'mentor-view':
      return `${artifact.scriptName === 'LIVE-TEACHING' ? 'Live' : 'Local'} mentor landing artifact proving role-parity after handoff.`
    case 'queue-history':
      return `${artifact.scriptName === 'LIVE-TEACHING' ? 'Live' : 'Local'} mentor queue-history artifact proving downstream teaching navigation.`
    case 'proof-risk-smoke-summary':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} proof-risk smoke summary for the 08A role-facing proof surfaces.`
    case 'system-admin-proof-control-plane':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} proof control-plane screenshot for the 08A sysadmin proof entrypoint.`
    case 'teacher-proof-panel':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} teacher proof-panel screenshot for the 08A course-leader flow.`
    case 'teacher-risk-explorer':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} teacher risk-explorer screenshot for the 08A downstream proof flow.`
    default:
      return `${artifact.scriptName} artifact for ${artifact.surface}.`
  }
}

function buildIndexSection(title, artifacts) {
  if (artifacts.length === 0) return ''
  const sourceCommand = commandSource(title)
  const rows = artifacts.map(artifact => `| ${artifact.artifactId} | ${artifact.rawPath} | ${artifact.assertionIds.join(', ')} | ${sourceCommand} | ${noteForArtifact(artifact)} |`)
  return [
    `### Command \`${title}\``,
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}

async function buildArtifact(spec, proofSummary, context) {
  const createdAt = (await stat(spec.rawPath)).mtime.toISOString()
  const selectedCheckpoint = proofSummary?.selectedCheckpoint ?? null
  return {
    semesterNumber: selectedCheckpoint?.semesterNumber ?? null,
    stageKey: selectedCheckpoint?.stageKey ?? null,
    simulationRunId: proofSummary?.simulationRunId ?? null,
    simulationStageCheckpointId: selectedCheckpoint?.simulationStageCheckpointId ?? null,
    scopeType: proofSummary ? 'batch' : null,
    scopeId: proofSummary?.batchId ?? null,
    routeHash: spec.useRouteHash ? (proofSummary?.routeHash ?? null) : null,
    studentId: null,
    courseId: null,
    labeledPath: null,
    artifactId: buildArtifactId(spec.command, spec.rawPath),
    surface: spec.surface,
    actorRole: spec.actorRole,
    assertionIds: spec.assertionIds,
    rawPath: spec.rawPath,
    scriptName: spec.command,
    appUrl: proofSummary?.appUrl ?? context?.appUrl ?? null,
    apiUrl: proofSummary?.apiUrl ?? context?.apiUrl ?? null,
    createdAt,
  }
}

function buildLedgerRow({ localAcceptance, localRequests, localProof, liveAcceptance, liveRequests, liveProof, defectsClosed, artifacts }) {
  return {
    stageId,
    phase,
    step: stageTitle,
    status: 'passed',
    authoritativePlanSections: ['Goal', 'Required Proof Before Exit', 'Commands And Expected Artifacts', 'Exit Contract'],
    assertionIds,
    repoLocalCommands: [
      {
        commandId: 'LOCAL-PROOF-RC',
        command: localProofRcCommand,
        status: 'passed',
        result: 'The authoritative repo-local proof-rc suite passed, keeping the role-facing proof stack green before the stage-scoped 08A artifact rerun.',
      },
      {
        commandId: 'LOCAL-ACCEPTANCE',
        command: localAcceptanceCommand,
        status: 'passed',
        result: `The local sysadmin acceptance flow passed with stage-scoped artifacts in ${files.localAcceptanceReport} and ${files.localAcceptanceScreenshot}.`,
      },
      {
        commandId: 'LOCAL-REQUESTS',
        command: localRequestsCommand,
        status: 'passed',
        result: `The local governed request journey passed with stage-scoped artifacts in ${files.localRequestReport} and ${files.localRequestScreenshot}.`,
      },
      {
        commandId: 'LOCAL-TEACHING',
        command: localTeachingCommand,
        status: 'passed',
        result: `The local sysadmin-to-teaching parity flow passed with stage-scoped artifacts in ${files.localTeachingParity}, ${files.localCourseLeaderDashboard}, ${files.localMentorView}, and ${files.localQueueHistory}.`,
      },
      {
        commandId: 'LOCAL-PROOF',
        command: localProofCommand,
        status: 'passed',
        result: `The local role-facing proof rerun passed with the stage-scoped summary in ${files.localProofSummary} and the teacher-facing proof screenshots pinned for 08A.`,
      },
    ],
    liveCommands: [
      {
        commandId: 'LIVE-ACCEPTANCE',
        command: liveAcceptanceCommand,
        status: 'passed',
        result: `The live sysadmin acceptance flow passed against GitHub Pages + Railway with stage-scoped artifacts in ${files.liveAcceptanceReport} and ${files.liveAcceptanceScreenshot}.`,
      },
      {
        commandId: 'LIVE-REQUESTS',
        command: liveRequestsCommand,
        status: 'passed',
        result: `The live governed request journey passed with stage-scoped artifacts in ${files.liveRequestReport} and ${files.liveRequestScreenshot}.`,
      },
      {
        commandId: 'LIVE-TEACHING',
        command: liveTeachingCommand,
        status: 'passed',
        result: `The live sysadmin-to-teaching parity flow passed with stage-scoped artifacts in ${files.liveTeachingParity}, ${files.liveCourseLeaderDashboard}, ${files.liveMentorView}, and ${files.liveQueueHistory}.`,
      },
      {
        commandId: 'LIVE-PROOF',
        command: liveProofCommand,
        status: 'passed',
        result: `The live role-facing proof rerun passed with the stage-scoped summary in ${files.liveProofSummary} and the teacher-facing proof screenshots pinned for 08A.`,
      },
    ],
    env: {
      PLAYWRIGHT_APP_URL: liveProof.appUrl,
      PLAYWRIGHT_API_URL: liveProof.apiUrl,
      AIRMENTOR_LIVE_STACK: '1',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: '<identifier>',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: '<redacted>',
    },
    artifacts: artifacts.map(item => item.artifactId),
    defectsOpened: [],
    defectsClosed,
    blocker: null,
    notes: [
      `Local acceptance app URL: ${localAcceptance.appUrl}`,
      `Local request-flow app URL: ${localRequests.appUrl}`,
      `Local proof selection: ${localProof.selectedCheckpoint?.surfaceLabel ?? 'missing checkpoint label'}`,
      `Live acceptance app URL: ${liveAcceptance.appUrl}`,
      `Live request-flow app URL: ${liveRequests.appUrl}`,
      `Live proof selection: ${liveProof.selectedCheckpoint?.surfaceLabel ?? 'missing checkpoint label'}`,
      defectsClosed.length > 0
        ? `Closed 08A defects carried into this pass: ${defectsClosed.join(', ')}`
        : 'No 08A defects were opened or left unresolved during the recorded pass.',
    ],
    nextAction: 'Stage 08B may begin now that Sysadmin, Course Leader, and Mentor flows are artifact-backed locally and live, and no 08A blocker remains open.',
  }
}

function buildCompletionBlock(defectsClosed) {
  const defectLine = defectsClosed.length > 0
    ? `- Closed Stage 08A defects: \`${defectsClosed.join('`, `')}\``
    : '- Closed Stage 08A defects: none'
  return [
    '## Completion Update',
    '- Status: `passed`',
    `- Local acceptance report: \`${path.relative(repoRoot, files.localAcceptanceReport)}\``,
    `- Local request-flow report: \`${path.relative(repoRoot, files.localRequestReport)}\``,
    `- Local teaching parity screenshot: \`${path.relative(repoRoot, files.localTeachingParity)}\``,
    `- Local proof summary: \`${path.relative(repoRoot, files.localProofSummary)}\``,
    `- Live acceptance report: \`${path.relative(repoRoot, files.liveAcceptanceReport)}\``,
    `- Live request-flow report: \`${path.relative(repoRoot, files.liveRequestReport)}\``,
    `- Live teaching parity screenshot: \`${path.relative(repoRoot, files.liveTeachingParity)}\``,
    `- Live proof summary: \`${path.relative(repoRoot, files.liveProofSummary)}\``,
    defectLine,
    '- Ledger, manifest, and evidence index now share the same 08A role-e2e artifact ids for sysadmin, course leader, mentor, and teacher-facing proof surfaces.',
    '',
  ].join('\n')
}

function buildStageSection(commandArtifacts) {
  return [
    '## Stage 08A',
    '',
    '### Command `LOCAL-PROOF-RC`',
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ledger-only | n/a | ${assertionIds.join(', ')} | ${localProofRcCommand} | The authoritative repo-local proof-rc suite passed before the stage-scoped 08A proof rerun, keeping the broader proof closure bar green. |`,
    '',
    buildIndexSection('LOCAL-ACCEPTANCE', commandArtifacts['LOCAL-ACCEPTANCE']).trimEnd(),
    '',
    buildIndexSection('LOCAL-REQUESTS', commandArtifacts['LOCAL-REQUESTS']).trimEnd(),
    '',
    buildIndexSection('LOCAL-TEACHING', commandArtifacts['LOCAL-TEACHING']).trimEnd(),
    '',
    buildIndexSection('LOCAL-PROOF', commandArtifacts['LOCAL-PROOF']).trimEnd(),
    '',
    buildIndexSection('LIVE-ACCEPTANCE', commandArtifacts['LIVE-ACCEPTANCE']).trimEnd(),
    '',
    buildIndexSection('LIVE-REQUESTS', commandArtifacts['LIVE-REQUESTS']).trimEnd(),
    '',
    buildIndexSection('LIVE-TEACHING', commandArtifacts['LIVE-TEACHING']).trimEnd(),
    '',
    buildIndexSection('LIVE-PROOF', commandArtifacts['LIVE-PROOF']).trimEnd(),
    '',
  ].join('\n')
}

async function validateReport(filePath, expectedAppUrl = null) {
  const report = JSON.parse(await readFile(filePath, 'utf8'))
  const checks = Array.isArray(report.checks) ? report.checks : []
  const failedChecks = checks.filter(check => check?.status !== 'passed').map(check => check?.name ?? 'unknown')
  assert(checks.length > 0, `Report has no checks: ${filePath}`)
  assert(failedChecks.length === 0, `Report still has failing checks in ${filePath}: ${failedChecks.join(', ')}`)
  if (expectedAppUrl != null) {
    assert.equal(normalizeUrl(report.appUrl), normalizeUrl(expectedAppUrl), `Unexpected appUrl in ${filePath}`)
  }
  return report
}

async function validateProofSummary(filePath, expectedStack, expectedAppUrl = null, expectedApiUrl = null) {
  const summary = JSON.parse(await readFile(filePath, 'utf8'))
  assert.equal(summary.summaryKind, 'proof-risk-smoke', `Unexpected summaryKind in ${filePath}`)
  assert.equal(summary.stack, expectedStack, `Unexpected stack in ${filePath}`)
  assert(summary.selectedCheckpoint?.simulationStageCheckpointId, `Missing selected checkpoint in ${filePath}`)
  if (expectedAppUrl != null) {
    assert.equal(normalizeUrl(summary.appUrl), normalizeUrl(expectedAppUrl), `Unexpected appUrl in ${filePath}`)
  }
  if (expectedApiUrl != null) {
    assert.equal(normalizeUrl(summary.apiUrl), normalizeUrl(expectedApiUrl), `Unexpected apiUrl in ${filePath}`)
  }
  return summary
}

async function main() {
  for (const requiredPath of Object.values(files)) {
    assert(existsSync(requiredPath), `Required file is missing: ${requiredPath}`)
  }

  const [
    ledgerText,
    manifestText,
    indexText,
    defectsText,
    assertionMatrixText,
    coverageMatrixText,
    stage08aText,
    localAcceptance,
    localRequests,
    localProof,
    liveAcceptance,
    liveRequests,
    liveProof,
  ] = await Promise.all([
    readFile(files.ledger, 'utf8'),
    readFile(files.manifest, 'utf8'),
    readFile(files.index, 'utf8'),
    readFile(files.defects, 'utf8'),
    readFile(files.assertionMatrix, 'utf8'),
    readFile(files.coverageMatrix, 'utf8'),
    readFile(files.stage08a, 'utf8'),
    validateReport(files.localAcceptanceReport),
    validateReport(files.localRequestReport),
    validateProofSummary(files.localProofSummary, 'local'),
    validateReport(files.liveAcceptanceReport, liveAppUrl),
    validateReport(files.liveRequestReport, liveAppUrl),
    validateProofSummary(files.liveProofSummary, 'live', liveAppUrl, liveApiUrl),
  ])

  const defects = JSON.parse(defectsText)
  const stage08aDefects = (defects.items ?? []).filter(item => String(item.defectId ?? '').startsWith('DEF-08A-'))
  const open08aDefects = stage08aDefects.filter(item => item.status !== 'closed')
  assert.equal(open08aDefects.length, 0, `Open 08A defects remain: ${open08aDefects.map(item => item.defectId).join(', ')}`)
  const closed08aDefects = stage08aDefects.filter(item => item.status === 'closed').map(item => item.defectId)

  const rows = parseJsonl(ledgerText).filter(row => row.stageId !== stageId)
  const manifest = JSON.parse(manifestText)
  const previous07c = rows.findLast?.(row => row.stageId === '07C')
    ?? [...rows].reverse().find(row => row.stageId === '07C')
  assert(previous07c?.status === 'passed', 'Stage 07C must be passed before Stage 08A is recorded.')

  const proofSummaries = { local: localProof, live: liveProof }
  const commandContexts = {
    'LOCAL-ACCEPTANCE': { appUrl: localAcceptance.appUrl, apiUrl: localProof.apiUrl },
    'LOCAL-REQUESTS': { appUrl: localRequests.appUrl, apiUrl: localProof.apiUrl },
    'LOCAL-TEACHING': { appUrl: localProof.appUrl, apiUrl: localProof.apiUrl },
    'LOCAL-PROOF': { appUrl: localProof.appUrl, apiUrl: localProof.apiUrl },
    'LIVE-ACCEPTANCE': { appUrl: liveAcceptance.appUrl, apiUrl: liveProof.apiUrl },
    'LIVE-REQUESTS': { appUrl: liveRequests.appUrl, apiUrl: liveProof.apiUrl },
    'LIVE-TEACHING': { appUrl: liveProof.appUrl, apiUrl: liveProof.apiUrl },
    'LIVE-PROOF': { appUrl: liveProof.appUrl, apiUrl: liveProof.apiUrl },
  }
  const artifacts = []
  const commandArtifacts = {
    'LOCAL-ACCEPTANCE': [],
    'LOCAL-REQUESTS': [],
    'LOCAL-TEACHING': [],
    'LOCAL-PROOF': [],
    'LIVE-ACCEPTANCE': [],
    'LIVE-REQUESTS': [],
    'LIVE-TEACHING': [],
    'LIVE-PROOF': [],
  }

  for (const spec of artifactSpecs) {
    const artifact = await buildArtifact(
      spec,
      spec.proofSummary ? proofSummaries[spec.proofSummary] : null,
      commandContexts[spec.command],
    )
    artifacts.push(artifact)
    commandArtifacts[spec.command].push(artifact)
    upsertManifestArtifact(manifest, artifact)
  }

  rows.push(buildLedgerRow({
    localAcceptance,
    localRequests,
    localProof,
    liveAcceptance,
    liveRequests,
    liveProof,
    defectsClosed: closed08aDefects,
    artifacts,
  }))

  const stageSection = buildStageSection(commandArtifacts)
  const completionBlock = buildCompletionBlock(closed08aDefects)

  const updatedIndex = indexText.includes('## Stage 08A')
    ? replaceStageSection(indexText, '## Stage 08A', stageSection)
    : insertBeforeHeader(indexText, '## Stage 08B', stageSection)

  const updatedStage08a = stage08aText.includes('## Completion Update')
    ? replaceBlock(stage08aText, '## Completion Update', '\n## Goal', completionBlock)
    : insertBeforeHeader(stage08aText, '## Goal', completionBlock)

  const atm08a001 = '| ATM-08A-001 | Sysadmin role flow is complete end to end with deterministic acceptance, requests, teaching handoff, and proof entry artifacts | Phase 8 | `scripts/system-admin-live-acceptance.mjs`, `scripts/system-admin-live-request-flow.mjs`, `scripts/system-admin-teaching-parity-smoke.mjs`, `scripts/system-admin-proof-risk-smoke.mjs`, and the 08A closeout helper now pin the sysadmin acceptance path, governed request workflow, teaching handoff, and proof entry artifact family under stage-scoped prefixes. | 08A | `LOCAL-PROOF-RC`, `LOCAL-ACCEPTANCE`, `LOCAL-REQUESTS`, `LOCAL-TEACHING`, `LOCAL-PROOF` | `LIVE-ACCEPTANCE`, `LIVE-REQUESTS`, `LIVE-TEACHING`, `LIVE-PROOF` | acceptance/request reports, teaching handoff screenshot, proof-risk summary, proof control-plane screenshot, ledger row | Sysadmin can launch, govern requests, hand off into teaching mode, and reach the proof control plane locally and live with stage-scoped artifacts. |'
  const atm08a002 = '| ATM-08A-002 | Course leader and mentor role flows are complete end to end with parity through dashboard, mentor, queue, and teacher proof surfaces | Phase 8 | `scripts/system-admin-teaching-parity-smoke.mjs`, `scripts/system-admin-proof-risk-smoke.mjs`, and the 08A closeout helper now pin course-leader dashboard, mentor, queue-history, teacher-proof-panel, and teacher-risk-explorer evidence under stage-scoped prefixes for both local and live runs. | 08A | `LOCAL-TEACHING`, `LOCAL-PROOF` | `LIVE-TEACHING`, `LIVE-PROOF` | teaching parity screenshot family, teacher proof screenshots, proof-risk summary, ledger row | Course Leader and Mentor can reach the faculty profile, dashboard, mentor view, queue history, and downstream teacher proof surfaces from direct teaching mode and sysadmin handoff locally and live. |'

  let updatedAssertionMatrix = replaceLineByPrefix(assertionMatrixText, '| ATM-08A-001 |', atm08a001)
  updatedAssertionMatrix = replaceLineByPrefix(updatedAssertionMatrix, '| ATM-08A-002 |', atm08a002)

  let updatedCoverage = replaceLineByPrefix(
    coverageMatrixText,
    'Current status as of `2026-04-01`:',
    'Current status as of `2026-04-01`: `DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT`, `DEF-05A-LIVE-A11Y-PROOF-HERO-CONTRAST`, `DEF-05B-LIVE-A11Y-QUEUE-CONTRAST`, `DEF-06B-LOCAL-TEACHING-PARITY-NAV-CLOSE`, `DEF-06B-LIVE-PROOF-LOCK-COLLISION`, `DEF-07A-LIVE-PROOF-CSRF-CROSS-ORIGIN-ACTIVATION`, `DEF-07A-LIVE-PROOF-NONSEEDED-BATCH-SELECTION`, `DEF-08A-LOCAL-REQUEST-FLOW-PREVIEW-PORT-DRIFT`, and `DEF-08A-LOCAL-TEACHING-PARITY-PORTAL-HANDOFF` are closed. Stage `08A` local and live acceptance, request-flow, teaching parity, and role-facing proof artifacts are current, and no Stage `08A` defects remain open in the defect register.',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Requests workflow | `SYSTEM_ADMIN` | `#/admin/requests` | admin requests routes |',
    '| Requests workflow | `SYSTEM_ADMIN` | `#/admin/requests` | admin requests routes | request tests, `LOCAL-REQUESTS` | `LIVE-REQUESTS` | `system-admin-live-request-flow-report.json` | 03A, 08A |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Proof control plane | `SYSTEM_ADMIN` | faculties workspace proof panel |',
    '| Proof control plane | `SYSTEM_ADMIN` | faculties workspace proof panel | proof dashboard/import/run/checkpoint routes + shared proof provenance selectors + semester-walk summaries | `LOCAL-PROOF-RC`, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-ACCEPTANCE` | `system-admin-proof-control-plane.png`, `proof-risk-smoke-summary.json`, acceptance report | 01B, 02B, 07B, 07C, 08A |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Faculty profile | `COURSE_LEADER`, `MENTOR`, `HOD` | academic workspace `faculty-profile` |',
    '| Faculty profile | `COURSE_LEADER`, `MENTOR`, `HOD` | academic workspace `faculty-profile` | `/api/academic/faculty-profile/:facultyId` | `npm test -- --run tests/faculty-profile-proof.test.tsx`, `LOCAL-TEACHING` | `LIVE-TEACHING`, `LIVE-PROOF` | `system-admin-teaching-parity-smoke.png`, `teacher-proof-panel.png` | 04A, 08A |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Teacher proof panel | `COURSE_LEADER` | faculty profile proof section |',
    '| Teacher proof panel | `COURSE_LEADER` | faculty profile proof section | faculty profile + proof bundle + proof provenance formatting + late-stage playback overlay | targeted faculty/profile tests, `LOCAL-TEACHING`, `LOCAL-PROOF` | `LIVE-PROOF`, `LIVE-TEACHING`, `LIVE-TEACHING-PROOF`, `LIVE-KEYBOARD` | `teacher-proof-panel.png`, semester-walk summary JSON, semester-scoped proof screenshots, keyboard report, keyboard screenshot | 01B, 04A, 07B, 07C, 08A |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Course leader dashboard | `COURSE_LEADER` | academic dashboard |',
    '| Course leader dashboard | `COURSE_LEADER` | academic dashboard | `/api/academic/bootstrap` | selectors/page tests, `LOCAL-TEACHING` | `LIVE-TEACHING` | `course-leader-dashboard-proof.png` | 04A, 08A |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Mentor mentee list | `MENTOR` | academic route `mentees` |',
    '| Mentor mentee list | `MENTOR` | academic route `mentees` | bootstrap + mentor assignments | mentor-specific tests, `LOCAL-TEACHING` | `LIVE-TEACHING` | `mentor-view-proof.png` | 04A, 08A |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Mentee detail | `MENTOR` | academic route `mentee-detail` |',
    '| Mentee detail | `MENTOR` | academic route `mentee-detail` | bootstrap + student history | mentor/history tests, `LOCAL-TEACHING` | `LIVE-TEACHING` | `mentor-view-proof.png` | 04A, 08A |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Queue history | `COURSE_LEADER`, `MENTOR`, `HOD` | academic route `queue-history` |',
    '| Queue history | `COURSE_LEADER`, `MENTOR`, `HOD` | academic route `queue-history` | academic task routes | domain/runtime tests, `LOCAL-TEACHING` | `LIVE-TEACHING`, `LIVE-KEYBOARD` | `queue-history-proof.png`, keyboard report | 04A, 08A |',
  )

  await Promise.all([
    writeFile(files.ledger, formatJsonl(rows), 'utf8'),
    writeFile(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(files.index, `${updatedIndex.trimEnd()}\n`, 'utf8'),
    writeFile(files.assertionMatrix, updatedAssertionMatrix, 'utf8'),
    writeFile(files.coverageMatrix, updatedCoverage, 'utf8'),
    writeFile(files.stage08a, updatedStage08a, 'utf8'),
  ])
}

await main()
