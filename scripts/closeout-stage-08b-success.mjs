#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const stageId = '08B'
const stageTitle = 'Role E2E HoD Student Session Security'
const phase = 'Phase 8'
const assertionIds = ['ATM-08B-001']
const liveAppUrl = 'https://raed2180416.github.io/AirMentor/'
const liveApiUrl = 'https://api-production-ab72.up.railway.app/'
const liveFrontendOrigin = 'https://raed2180416.github.io'

const repoRoot = process.cwd()
const playwrightDir = path.join(repoRoot, 'output', 'playwright')
const detachedDir = path.join(repoRoot, 'output', 'detached')
const docsDir = path.join(repoRoot, 'docs', 'closeout')
const apiOutputDir = path.join(repoRoot, 'air-mentor-api', 'output')
const liveSystemAdminIdentifierEnv = 'AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER'
const liveSystemAdminPasswordEnv = 'AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD'
const liveCredentialPlaceholders = `${liveSystemAdminIdentifierEnv}=<identifier> ${liveSystemAdminPasswordEnv}=<password>`
const expectedSessionCheckNames = [
  'login_with_secure_cookie_posture',
  'session_restore_after_reload',
  'mutation_without_csrf_rejected',
  'mutation_with_valid_csrf_succeeds',
  'mismatched_origin_rejected',
  'session_logout_clears_server_session',
  'expired_or_invalidated_session_requires_reauth',
  'reauth_after_expired_or_invalidated_session_succeeds',
]
const detachedLogPrefixes = {
  localBackend: 'airmentor-08b-local-backend-',
  localFrontend: 'airmentor-08b-local-frontend-',
  localSession: 'airmentor-08b-local-session-security-',
  localProofRc: 'airmentor-08b-local-proof-rc-',
  liveContract: 'airmentor-08b-live-session-contract-',
  liveSession: 'airmentor-08b-live-session-security-',
  liveProof: 'airmentor-08b-live-proof-',
  liveA11y: 'airmentor-08b-live-a11y-',
  liveKeyboard: 'airmentor-08b-live-keyboard-',
  liveDenied: 'airmentor-08b-live-denied-',
}

const files = {
  ledger: path.join(playwrightDir, 'execution-ledger.jsonl'),
  manifest: path.join(playwrightDir, 'proof-evidence-manifest.json'),
  index: path.join(playwrightDir, 'proof-evidence-index.md'),
  defects: path.join(playwrightDir, 'defect-register.json'),
  assertionMatrix: path.join(docsDir, 'assertion-traceability-matrix.md'),
  coverageMatrix: path.join(docsDir, 'sysadmin-teaching-proof-coverage-matrix.md'),
  stage08b: path.join(docsDir, 'stage-08b-role-e2e-hod-student-session-security.md'),
  localSessionReport: path.join(playwrightDir, '08b-local-session-security-system-admin-live-session-security-report.json'),
  localProofSummary: path.join(playwrightDir, '08b-local-proof-risk-smoke-summary.json'),
  localProofSystemAdmin: path.join(playwrightDir, '08b-local-system-admin-proof-control-plane.png'),
  localProofTeacher: path.join(playwrightDir, '08b-local-teacher-proof-panel.png'),
  localProofTeacherRisk: path.join(playwrightDir, '08b-local-teacher-risk-explorer-proof.png'),
  localProofHod: path.join(playwrightDir, '08b-local-hod-proof-analytics.png'),
  localProofHodRisk: path.join(playwrightDir, '08b-local-hod-risk-explorer-proof.png'),
  localProofStudentShell: path.join(playwrightDir, '08b-local-student-shell-proof.png'),
  localActivationRequest: path.join(playwrightDir, '08b-local-system-admin-proof-semester-activation-local-request.json'),
  localActivationResponse: path.join(playwrightDir, '08b-local-system-admin-proof-semester-activation-local-response.json'),
  liveSessionContract: path.join(apiOutputDir, '08b-live-contract-railway-live-session-contract.json'),
  liveSessionReport: path.join(playwrightDir, '08b-live-session-security-system-admin-live-session-security-report.json'),
  liveProofSummary: path.join(playwrightDir, '08b-live-proof-risk-smoke-summary.json'),
  liveProofSystemAdmin: path.join(playwrightDir, '08b-live-system-admin-proof-control-plane.png'),
  liveProofTeacher: path.join(playwrightDir, '08b-live-teacher-proof-panel.png'),
  liveProofTeacherRisk: path.join(playwrightDir, '08b-live-teacher-risk-explorer-proof.png'),
  liveProofHod: path.join(playwrightDir, '08b-live-hod-proof-analytics.png'),
  liveProofHodRisk: path.join(playwrightDir, '08b-live-hod-risk-explorer-proof.png'),
  liveProofStudentShell: path.join(playwrightDir, '08b-live-student-shell-proof.png'),
  liveActivationRequest: path.join(playwrightDir, '08b-live-system-admin-proof-semester-activation-live-request.json'),
  liveActivationResponse: path.join(playwrightDir, '08b-live-system-admin-proof-semester-activation-live-response.json'),
  liveAccessibilityReport: path.join(playwrightDir, '08b-live-a11y', 'system-admin-live-accessibility-report.json'),
  liveAccessibilityTranscript: path.join(playwrightDir, '08b-live-a11y', 'system-admin-live-screen-reader-preflight.md'),
  liveAccessibilityScreenshot: path.join(playwrightDir, '08b-live-a11y', 'system-admin-live-accessibility-regression.png'),
  liveKeyboardReport: path.join(playwrightDir, '08b-live-keyboard-system-admin-live-keyboard-regression-report.json'),
  liveKeyboardScreenshot: path.join(playwrightDir, '08b-live-keyboard-system-admin-live-keyboard-regression.png'),
  liveDeniedArtifact: path.join(playwrightDir, '08b-live-denied-hod-proof-invalid-checkpoint-live.json'),
}

const localBackendCommand = 'env -C air-mentor-api npx vitest run --reporter=verbose --maxWorkers=1 tests/session.test.ts tests/startup-diagnostics.test.ts tests/academic-access.test.ts'
const localFrontendCommand = 'npm test -- --run tests/api-client.test.ts tests/frontend-startup-diagnostics.test.ts tests/hod-pages.test.ts tests/student-shell.test.tsx tests/risk-explorer.test.tsx'
const localSessionCommand = 'AIRMENTOR_SESSION_SECURITY_ARTIFACT_PREFIX=08b-local-session-security npm run playwright:admin-live:session-security'
const localProofRcCommand = 'AIRMENTOR_PROOF_ARTIFACT_PREFIX=08b-local npm run verify:proof-closure:proof-rc'
const liveSessionContractCommand = `env -C air-mentor-api RAILWAY_PUBLIC_API_URL=${liveApiUrl} EXPECTED_FRONTEND_ORIGIN=${liveFrontendOrigin} ${liveCredentialPlaceholders} RAILWAY_DIAGNOSTIC_ARTIFACT_PREFIX=08b-live-contract npm run verify:live-session-contract`
const liveSessionCommand = `AIRMENTOR_SESSION_SECURITY_ARTIFACT_PREFIX=08b-live-session-security AIRMENTOR_LIVE_STACK=1 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} ${liveCredentialPlaceholders} npm run playwright:admin-live:session-security`
const liveProofCommand = `AIRMENTOR_PROOF_ARTIFACT_PREFIX=08b-live AIRMENTOR_LIVE_STACK=1 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} ${liveCredentialPlaceholders} npm run playwright:admin-live:proof-risk`
const liveAccessibilityCommand = `PLAYWRIGHT_OUTPUT_DIR=output/playwright/08b-live-a11y AIRMENTOR_LIVE_STACK=1 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} ${liveCredentialPlaceholders} npm run playwright:admin-live:accessibility-regression`
const liveKeyboardCommand = `AIRMENTOR_KEYBOARD_ARTIFACT_PREFIX=08b-live-keyboard AIRMENTOR_LIVE_STACK=1 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} ${liveCredentialPlaceholders} npm run playwright:admin-live:keyboard-regression`
const liveDeniedCommand = `AIRMENTOR_DENIED_ARTIFACT_PREFIX=08b-live-denied AIRMENTOR_LIVE_STACK=1 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} ${liveCredentialPlaceholders} node scripts/hod-proof-invalid-checkpoint-probe.mjs`

const artifactSpecs = [
  { command: 'LOCAL-SESSION', rawPath: files.localSessionReport, surface: 'session-security-report', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localProofSummary, surface: 'proof-risk-smoke-summary', actorRole: 'SYSTEM_ADMIN', proofSummary: 'local' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localProofSystemAdmin, surface: 'system-admin-proof-control-plane', actorRole: 'SYSTEM_ADMIN', proofSummary: 'local', useRouteHash: true },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localProofTeacher, surface: 'teacher-proof-panel', actorRole: 'COURSE_LEADER', proofSummary: 'local' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localProofTeacherRisk, surface: 'teacher-risk-explorer', actorRole: 'COURSE_LEADER', proofSummary: 'local' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localProofHod, surface: 'hod-proof-analytics', actorRole: 'HOD', proofSummary: 'local' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localProofHodRisk, surface: 'hod-risk-explorer', actorRole: 'HOD', proofSummary: 'local' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localProofStudentShell, surface: 'student-shell', actorRole: 'HOD', proofSummary: 'local' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localActivationRequest, surface: 'proof-semester-activation-request', actorRole: 'SYSTEM_ADMIN', proofSummary: 'local' },
  { command: 'LOCAL-PROOF-RC', rawPath: files.localActivationResponse, surface: 'proof-semester-activation-response', actorRole: 'SYSTEM_ADMIN', proofSummary: 'local' },
  { command: 'LIVE-CONTRACT', rawPath: files.liveSessionContract, surface: 'railway-live-session-contract', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LIVE-SESSION', rawPath: files.liveSessionReport, surface: 'session-security-report', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LIVE-PROOF', rawPath: files.liveProofSummary, surface: 'proof-risk-smoke-summary', actorRole: 'SYSTEM_ADMIN', proofSummary: 'live' },
  { command: 'LIVE-PROOF', rawPath: files.liveProofSystemAdmin, surface: 'system-admin-proof-control-plane', actorRole: 'SYSTEM_ADMIN', proofSummary: 'live', useRouteHash: true },
  { command: 'LIVE-PROOF', rawPath: files.liveProofTeacher, surface: 'teacher-proof-panel', actorRole: 'COURSE_LEADER', proofSummary: 'live' },
  { command: 'LIVE-PROOF', rawPath: files.liveProofTeacherRisk, surface: 'teacher-risk-explorer', actorRole: 'COURSE_LEADER', proofSummary: 'live' },
  { command: 'LIVE-PROOF', rawPath: files.liveProofHod, surface: 'hod-proof-analytics', actorRole: 'HOD', proofSummary: 'live' },
  { command: 'LIVE-PROOF', rawPath: files.liveProofHodRisk, surface: 'hod-risk-explorer', actorRole: 'HOD', proofSummary: 'live' },
  { command: 'LIVE-PROOF', rawPath: files.liveProofStudentShell, surface: 'student-shell', actorRole: 'HOD', proofSummary: 'live' },
  { command: 'LIVE-PROOF', rawPath: files.liveActivationRequest, surface: 'proof-semester-activation-request', actorRole: 'SYSTEM_ADMIN', proofSummary: 'live' },
  { command: 'LIVE-PROOF', rawPath: files.liveActivationResponse, surface: 'proof-semester-activation-response', actorRole: 'SYSTEM_ADMIN', proofSummary: 'live' },
  { command: 'LIVE-A11Y', rawPath: files.liveAccessibilityReport, surface: 'accessibility-report', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LIVE-A11Y', rawPath: files.liveAccessibilityTranscript, surface: 'screen-reader-preflight', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LIVE-A11Y', rawPath: files.liveAccessibilityScreenshot, surface: 'accessibility-regression', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LIVE-KEYBOARD', rawPath: files.liveKeyboardReport, surface: 'system-admin-keyboard-regression-report', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LIVE-KEYBOARD', rawPath: files.liveKeyboardScreenshot, surface: 'system-admin-keyboard-regression', actorRole: 'SYSTEM_ADMIN' },
  { command: 'LIVE-DENIED', rawPath: files.liveDeniedArtifact, surface: 'hod-proof-invalid-checkpoint', actorRole: 'HOD' },
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

function isLoopbackHttpUrl(value) {
  try {
    const parsed = new URL(String(value ?? ''))
    return parsed.protocol === 'http:' && (
      parsed.hostname === '127.0.0.1'
      || parsed.hostname === 'localhost'
    )
  } catch {
    return false
  }
}

function upsertManifestArtifact(manifest, artifact) {
  const index = manifest.artifacts.findIndex(item => item.artifactId === artifact.artifactId)
  if (index >= 0) {
    manifest.artifacts[index] = artifact
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

function buildArtifactId(command, rawPath) {
  return `${stageId}--${command}--${path.basename(rawPath)}`
}

async function resolveLatestDetachedLog(prefix) {
  const entries = await readdir(detachedDir, { withFileTypes: true })
  const matchingEntries = entries
    .filter(entry => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.log'))
    .map(entry => path.join(detachedDir, entry.name))
  assert(matchingEntries.length > 0, `Could not find detached log for prefix: ${prefix}`)
  const matchingWithStats = await Promise.all(matchingEntries.map(async logPath => ({
    logPath,
    stats: await stat(logPath),
  })))
  matchingWithStats.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs)
  return matchingWithStats[0].logPath
}

async function validateDetachedLog(prefix) {
  const logPath = await resolveLatestDetachedLog(prefix)
  const logText = await readFile(logPath, 'utf8')
  const trimmed = logText.trimEnd()
  assert(/\bexit=0$/.test(trimmed), `Detached command did not finish successfully: ${logPath}`)
  return logPath
}

function commandSource(command) {
  switch (command) {
    case 'LOCAL-SESSION':
      return localSessionCommand
    case 'LOCAL-PROOF-RC':
      return localProofRcCommand
    case 'LIVE-CONTRACT':
      return liveSessionContractCommand
    case 'LIVE-SESSION':
      return liveSessionCommand
    case 'LIVE-PROOF':
      return liveProofCommand
    case 'LIVE-A11Y':
      return liveAccessibilityCommand
    case 'LIVE-KEYBOARD':
      return liveKeyboardCommand
    case 'LIVE-DENIED':
      return liveDeniedCommand
    default:
      throw new Error(`Unsupported command: ${command}`)
  }
}

function noteForArtifact(artifact) {
  switch (artifact.surface) {
    case 'session-security-report':
      return `${artifact.scriptName === 'LIVE-SESSION' ? 'Live' : 'Local'} session-security report for login, restore, invalidation recovery, CSRF, and origin posture.`
    case 'railway-live-session-contract':
      return 'Live cross-origin session-contract report from the Railway readiness probe.'
    case 'proof-risk-smoke-summary':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} HoD/student proof-risk summary for the 08B closeout.`
    case 'system-admin-proof-control-plane':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} seeded proof control-plane screenshot proving deterministic proof entry before HoD/student traversal.`
    case 'hod-proof-analytics':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} HoD analytics proof screenshot for the 08B role closeout.`
    case 'teacher-proof-panel':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} teacher proof panel screenshot carried with the 08B proof traversal before HoD/student drilldowns.`
    case 'teacher-risk-explorer':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} teacher risk explorer screenshot carried with the 08B proof traversal before HoD/student drilldowns.`
    case 'hod-risk-explorer':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} HoD risk explorer screenshot for the 08B role closeout.`
    case 'student-shell':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} HoD-launched student-shell screenshot for the 08B role closeout.`
    case 'proof-semester-activation-request':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} proof-semester activation request JSON proving deterministic checkpoint selection context.`
    case 'proof-semester-activation-response':
      return `${artifact.scriptName === 'LIVE-PROOF' ? 'Live' : 'Local'} proof-semester activation response JSON proving deterministic checkpoint selection context.`
    case 'accessibility-report':
      return 'Live accessibility regression report for the 08B proof/admin/session surfaces.'
    case 'screen-reader-preflight':
      return 'Live screen-reader preflight transcript for the 08B accessibility pass.'
    case 'accessibility-regression':
      return 'Live accessibility regression screenshot for the 08B proof/admin/session surfaces.'
    case 'system-admin-keyboard-regression-report':
      return 'Live keyboard regression report for request, proof, portal-switch, and restore flows.'
    case 'system-admin-keyboard-regression':
      return 'Live keyboard regression screenshot for the 08B closeout.'
    case 'hod-proof-invalid-checkpoint':
      return 'Denied-path artifact proving invalid checkpoint fallback remains explicit instead of returning false data.'
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

async function buildArtifact(spec, proofSummary, context, extra = {}) {
  const createdAt = (await stat(spec.rawPath)).mtime.toISOString()
  const selectedCheckpoint = proofSummary?.selectedCheckpoint ?? null
  return {
    semesterNumber: extra.semesterNumber ?? selectedCheckpoint?.semesterNumber ?? null,
    stageKey: extra.stageKey ?? selectedCheckpoint?.stageKey ?? null,
    simulationRunId: extra.simulationRunId ?? proofSummary?.simulationRunId ?? null,
    simulationStageCheckpointId: extra.simulationStageCheckpointId ?? selectedCheckpoint?.simulationStageCheckpointId ?? null,
    scopeType: extra.scopeType ?? (proofSummary ? 'batch' : null),
    scopeId: extra.scopeId ?? proofSummary?.batchId ?? null,
    routeHash: spec.useRouteHash ? (proofSummary?.routeHash ?? null) : null,
    studentId: extra.studentId ?? null,
    courseId: null,
    labeledPath: null,
    artifactId: buildArtifactId(spec.command, spec.rawPath),
    surface: spec.surface,
    actorRole: spec.actorRole,
    assertionIds,
    rawPath: spec.rawPath,
    scriptName: spec.command,
    appUrl: context?.appUrl ?? null,
    apiUrl: context?.apiUrl ?? null,
    createdAt,
  }
}

function buildLedgerRow({ localSession, localProof, liveContract, liveSession, liveProof, liveKeyboard, defectsClosed, artifacts }) {
  return {
    stageId,
    phase,
    step: stageTitle,
    status: 'passed',
    authoritativePlanSections: ['Goal', 'Required Proof Before Exit', 'Commands And Expected Artifacts', 'Exit Contract'],
    assertionIds,
    repoLocalCommands: [
      {
        commandId: 'LOCAL-BACKEND',
        command: localBackendCommand,
        status: 'passed',
        result: 'The targeted backend session/startup/access suites passed for the 08B security closeout.',
      },
      {
        commandId: 'LOCAL-FRONTEND',
        command: localFrontendCommand,
        status: 'passed',
        result: 'The targeted frontend client/session/HoD/student/risk suites passed for the 08B security closeout.',
      },
      {
        commandId: 'LOCAL-SESSION',
        command: localSessionCommand,
        status: 'passed',
        result: `The local session-security smoke passed with the stage-scoped report in ${files.localSessionReport}.`,
      },
      {
        commandId: 'LOCAL-PROOF-RC',
        command: localProofRcCommand,
        status: 'passed',
        result: `The local proof-rc lane passed with the stage-scoped proof summary in ${files.localProofSummary} plus HoD/student proof screenshots and semester-activation JSON for 08B.`,
      },
    ],
    liveCommands: [
      {
        commandId: 'LIVE-CONTRACT',
        command: liveSessionContractCommand,
        status: 'passed',
        result: `The live cross-origin session contract passed with the stage-scoped report in ${files.liveSessionContract}.`,
      },
      {
        commandId: 'LIVE-SESSION',
        command: liveSessionCommand,
        status: 'passed',
        result: `The live session-security smoke passed with the stage-scoped report in ${files.liveSessionReport}.`,
      },
      {
        commandId: 'LIVE-PROOF',
        command: liveProofCommand,
        status: 'passed',
        result: `The live HoD/student proof rerun passed with the stage-scoped summary in ${files.liveProofSummary} plus HoD/student proof screenshots and semester-activation JSON for 08B.`,
      },
      {
        commandId: 'LIVE-A11Y',
        command: liveAccessibilityCommand,
        status: 'passed',
        result: `The live accessibility regression passed with isolated 08B artifacts in ${files.liveAccessibilityReport}, ${files.liveAccessibilityTranscript}, and ${files.liveAccessibilityScreenshot}.`,
      },
      {
        commandId: 'LIVE-KEYBOARD',
        command: liveKeyboardCommand,
        status: 'passed',
        result: `The live keyboard regression passed with the stage-scoped report in ${files.liveKeyboardReport} and screenshot in ${files.liveKeyboardScreenshot}.`,
      },
      {
        commandId: 'LIVE-DENIED',
        command: liveDeniedCommand,
        status: 'passed',
        result: `The live invalid-checkpoint denied-path probe passed with the stage-scoped artifact in ${files.liveDeniedArtifact}.`,
      },
    ],
    env: {
      PLAYWRIGHT_APP_URL: liveAppUrl,
      PLAYWRIGHT_API_URL: liveApiUrl,
      AIRMENTOR_LIVE_STACK: '1',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: '<identifier>',
      AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: '<redacted>',
      EXPECTED_FRONTEND_ORIGIN: liveFrontendOrigin,
    },
    artifacts: artifacts.map(item => item.artifactId),
    defectsOpened: [],
    defectsClosed,
    blocker: null,
    notes: [
      `Local session app URL: ${localSession.appUrl}`,
      `Local proof selection: ${localProof.selectedCheckpoint?.surfaceLabel ?? 'missing checkpoint label'}`,
      `Live session contract attempts used: ${liveContract.retryWindow?.attemptsUsed ?? 'unknown'}`,
      `Live session app URL: ${liveSession.appUrl}`,
      `Live proof selection: ${liveProof.selectedCheckpoint?.surfaceLabel ?? 'missing checkpoint label'}`,
      `Live keyboard late checkpoint: ${liveKeyboard.lateCheckpointWalk?.checkpoint?.surfaceLabel ?? 'missing checkpoint label'}`,
      `Denied-path artifact recorded for 08B: ${files.liveDeniedArtifact}`,
      defectsClosed.length > 0
        ? `Closed 08B defects carried into this pass: ${defectsClosed.join(', ')}`
        : 'No 08B defects were opened or left unresolved during the recorded pass.',
    ],
    nextAction: 'Stage 08C may begin now that HoD/student proof, session/origin/CSRF, live accessibility, live keyboard, and denied-path evidence are recorded under the 08B closeout backbone.',
  }
}

function buildCompletionBlock(defectsClosed) {
  const defectLine = defectsClosed.length > 0
    ? `- Closed Stage 08B defects: \`${defectsClosed.join('`, `')}\``
    : '- Closed Stage 08B defects: none'
  return [
    '## Completion Update',
    '- Status: `passed`',
    `- Local backend suite: \`${localBackendCommand}\``,
    `- Local frontend suite: \`${localFrontendCommand}\``,
    `- Local session-security report: \`${path.relative(repoRoot, files.localSessionReport)}\``,
    `- Local proof summary: \`${path.relative(repoRoot, files.localProofSummary)}\``,
    `- Live session-contract report: \`${path.relative(repoRoot, files.liveSessionContract)}\``,
    `- Live session-security report: \`${path.relative(repoRoot, files.liveSessionReport)}\``,
    `- Live proof summary: \`${path.relative(repoRoot, files.liveProofSummary)}\``,
    `- Live accessibility report: \`${path.relative(repoRoot, files.liveAccessibilityReport)}\``,
    `- Live keyboard report: \`${path.relative(repoRoot, files.liveKeyboardReport)}\``,
    `- Denied-path artifact: \`${path.relative(repoRoot, files.liveDeniedArtifact)}\``,
    defectLine,
    '- Ledger, manifest, and evidence index now share the same 08B session-security, HoD/student proof, accessibility, keyboard, and denied-path artifact ids.',
    '',
  ].join('\n')
}

function buildStageSection(commandArtifacts) {
  const sections = [
    '## Stage 08B',
    '',
    '### Command `LOCAL-BACKEND`',
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ledger-only | n/a | ${assertionIds.join(', ')} | ${localBackendCommand} | Targeted backend session/startup/access suites passed for 08B. |`,
    '',
    '### Command `LOCAL-FRONTEND`',
    '',
    '| artifactId | path | assertionIds | source command | notes |',
    '| --- | --- | --- | --- | --- |',
    `| ledger-only | n/a | ${assertionIds.join(', ')} | ${localFrontendCommand} | Targeted frontend client/session/HoD/student/risk suites passed for 08B. |`,
    '',
  ]

  for (const command of ['LOCAL-SESSION', 'LOCAL-PROOF-RC', 'LIVE-CONTRACT', 'LIVE-SESSION', 'LIVE-PROOF', 'LIVE-A11Y', 'LIVE-KEYBOARD', 'LIVE-DENIED']) {
    const section = buildIndexSection(command, commandArtifacts[command])
    if (section) sections.push(section.trimEnd(), '')
  }

  return `${sections.join('\n').trimEnd()}\n`
}

async function validateSessionReport(filePath, expectedAppUrl = null, expectedApiUrl = null) {
  const report = JSON.parse(await readFile(filePath, 'utf8'))
  const checks = Array.isArray(report.checks) ? report.checks : []
  const failedChecks = checks.filter(check => check?.status !== 'passed').map(check => check?.name ?? 'unknown')
  assert(checks.length > 0, `Report has no checks: ${filePath}`)
  assert(failedChecks.length === 0, `Report still has failing checks in ${filePath}: ${failedChecks.join(', ')}`)
  const checkNames = checks.map(check => check?.name).filter(Boolean)
  assert.deepEqual(checkNames, expectedSessionCheckNames, `Unexpected session checks in ${filePath}`)
  if (expectedAppUrl != null) assert.equal(normalizeUrl(report.appUrl), normalizeUrl(expectedAppUrl), `Unexpected appUrl in ${filePath}`)
  if (expectedApiUrl != null) assert.equal(normalizeUrl(report.apiUrl), normalizeUrl(expectedApiUrl), `Unexpected apiUrl in ${filePath}`)
  if (expectedAppUrl == null) assert(isLoopbackHttpUrl(report.appUrl), `Local session report must use a loopback appUrl in ${filePath}`)
  if (expectedApiUrl == null) assert(isLoopbackHttpUrl(report.apiUrl), `Local session report must use a loopback apiUrl in ${filePath}`)
  return report
}

async function validateProofSummary(filePath, expectedStack, expectedAppUrl = null, expectedApiUrl = null) {
  const summary = JSON.parse(await readFile(filePath, 'utf8'))
  assert.equal(summary.summaryKind, 'proof-risk-smoke', `Unexpected summaryKind in ${filePath}`)
  assert.equal(summary.stack, expectedStack, `Unexpected stack in ${filePath}`)
  assert(summary.selectedCheckpoint?.simulationStageCheckpointId, `Missing selected checkpoint in ${filePath}`)
  if (expectedAppUrl != null) assert.equal(normalizeUrl(summary.appUrl), normalizeUrl(expectedAppUrl), `Unexpected appUrl in ${filePath}`)
  if (expectedApiUrl != null) assert.equal(normalizeUrl(summary.apiUrl), normalizeUrl(expectedApiUrl), `Unexpected apiUrl in ${filePath}`)
  return summary
}

async function validateSessionContract(filePath) {
  const report = JSON.parse(await readFile(filePath, 'utf8'))
  assert.equal(report.status, 'passed', `Live session contract did not pass in ${filePath}`)
  assert.equal(normalizeUrl(report.apiBaseUrl), normalizeUrl(liveApiUrl), `Unexpected apiBaseUrl in ${filePath}`)
  assert.equal(normalizeUrl(report.expectedFrontendOrigin), normalizeUrl(liveFrontendOrigin), `Unexpected expectedFrontendOrigin in ${filePath}`)
  assert.equal(report.response?.status, 200, `Unexpected contract response status in ${filePath}`)
  assert.equal(report.response?.restoreStatus, 200, `Unexpected contract restoreStatus in ${filePath}`)
  return report
}

async function validateAccessibilityReport(filePath) {
  const report = JSON.parse(await readFile(filePath, 'utf8'))
  assert(Array.isArray(report) && report.length > 0, `Accessibility report must be a non-empty array: ${filePath}`)
  const blockers = report
    .filter(item => Array.isArray(item?.violations))
    .flatMap(item => item.violations)
  assert.equal(blockers.length, 0, `Accessibility violations remain in ${filePath}`)
  return report
}

async function validateKeyboardReport(filePath, expectedAppUrl = null, expectedApiUrl = null) {
  const report = JSON.parse(await readFile(filePath, 'utf8'))
  const checks = Array.isArray(report.checks) ? report.checks : []
  const failedChecks = checks.filter(check => check?.status !== 'passed').map(check => check?.name ?? 'unknown')
  assert(checks.length > 0, `Keyboard report has no checks: ${filePath}`)
  assert(failedChecks.length === 0, `Keyboard report still has failing checks in ${filePath}: ${failedChecks.join(', ')}`)
  if (expectedAppUrl != null) assert.equal(normalizeUrl(report.appUrl), normalizeUrl(expectedAppUrl), `Unexpected appUrl in ${filePath}`)
  if (expectedApiUrl != null) assert.equal(normalizeUrl(report.apiUrl), normalizeUrl(expectedApiUrl), `Unexpected apiUrl in ${filePath}`)
  return report
}

async function validateDeniedArtifact(filePath) {
  const report = JSON.parse(await readFile(filePath, 'utf8'))
  assert.equal(normalizeUrl(report.appUrl), normalizeUrl(liveAppUrl), `Unexpected denied artifact appUrl in ${filePath}`)
  assert.equal(normalizeUrl(report.apiUrl), normalizeUrl(liveApiUrl), `Unexpected denied artifact apiUrl in ${filePath}`)
  assert.equal(report.response?.status, 404, `Denied artifact must capture a 404 response in ${filePath}`)
  assert.equal(report.response?.body?.error, 'NOT_FOUND', `Denied artifact must capture NOT_FOUND in ${filePath}`)
  assert(report.proofContext?.simulationStageCheckpointId, `Denied artifact missing proofContext.simulationStageCheckpointId in ${filePath}`)
  return report
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
    stage08bText,
    localSession,
    localProof,
    liveContract,
    liveSession,
    liveProof,
    liveAccessibility,
    liveKeyboard,
    liveDenied,
    localBackendLog,
    localFrontendLog,
    localSessionLog,
    localProofRcLog,
    liveContractLog,
    liveSessionLog,
    liveProofLog,
    liveA11yLog,
    liveKeyboardLog,
    liveDeniedLog,
  ] = await Promise.all([
    readFile(files.ledger, 'utf8'),
    readFile(files.manifest, 'utf8'),
    readFile(files.index, 'utf8'),
    readFile(files.defects, 'utf8'),
    readFile(files.assertionMatrix, 'utf8'),
    readFile(files.coverageMatrix, 'utf8'),
    readFile(files.stage08b, 'utf8'),
    validateSessionReport(files.localSessionReport),
    validateProofSummary(files.localProofSummary, 'local'),
    validateSessionContract(files.liveSessionContract),
    validateSessionReport(files.liveSessionReport, liveAppUrl, liveApiUrl),
    validateProofSummary(files.liveProofSummary, 'live', liveAppUrl, liveApiUrl),
    validateAccessibilityReport(files.liveAccessibilityReport),
    validateKeyboardReport(files.liveKeyboardReport, liveAppUrl, liveApiUrl),
    validateDeniedArtifact(files.liveDeniedArtifact),
    validateDetachedLog(detachedLogPrefixes.localBackend),
    validateDetachedLog(detachedLogPrefixes.localFrontend),
    validateDetachedLog(detachedLogPrefixes.localSession),
    validateDetachedLog(detachedLogPrefixes.localProofRc),
    validateDetachedLog(detachedLogPrefixes.liveContract),
    validateDetachedLog(detachedLogPrefixes.liveSession),
    validateDetachedLog(detachedLogPrefixes.liveProof),
    validateDetachedLog(detachedLogPrefixes.liveA11y),
    validateDetachedLog(detachedLogPrefixes.liveKeyboard),
    validateDetachedLog(detachedLogPrefixes.liveDenied),
  ])

  const defects = JSON.parse(defectsText)
  const open08aDefects = (defects.items ?? []).filter(item => String(item.defectId ?? '').startsWith('DEF-08A-') && item.status !== 'closed')
  assert.equal(open08aDefects.length, 0, `Open 08A defects remain: ${open08aDefects.map(item => item.defectId).join(', ')}`)
  const stageDefects = (defects.items ?? []).filter(item => String(item.defectId ?? '').startsWith('DEF-08B-'))
  const openStageDefects = stageDefects.filter(item => item.status !== 'closed')
  assert.equal(openStageDefects.length, 0, `Open 08B defects remain: ${openStageDefects.map(item => item.defectId).join(', ')}`)
  const closedStageDefects = stageDefects.filter(item => item.status === 'closed').map(item => item.defectId)

  const rows = parseJsonl(ledgerText).filter(row => row.stageId !== stageId)
  const previous08a = rows.findLast?.(row => row.stageId === '08A') ?? [...rows].reverse().find(row => row.stageId === '08A')
  assert(previous08a?.status === 'passed', 'Stage 08A must be passed before Stage 08B is recorded.')

  const manifest = JSON.parse(manifestText)
  assert(Array.isArray(manifest.artifacts), 'Proof evidence manifest must expose an artifacts array.')
  assert(manifest.artifacts.some(item => String(item?.artifactId ?? '').startsWith('08A--')), 'Stage 08A artifacts must already exist in the evidence manifest.')
  assert(indexText.includes('## Stage 08A'), 'Stage 08A evidence index section must exist before Stage 08B is recorded.')
  const proofSummaries = {
    local: localProof,
    live: liveProof,
  }
  const commandContexts = {
    'LOCAL-SESSION': { appUrl: localSession.appUrl, apiUrl: localSession.apiUrl },
    'LOCAL-PROOF-RC': { appUrl: localProof.appUrl, apiUrl: localProof.apiUrl },
    'LIVE-CONTRACT': { appUrl: liveAppUrl, apiUrl: liveApiUrl },
    'LIVE-SESSION': { appUrl: liveSession.appUrl, apiUrl: liveSession.apiUrl },
    'LIVE-PROOF': { appUrl: liveProof.appUrl, apiUrl: liveProof.apiUrl },
    'LIVE-A11Y': { appUrl: liveAppUrl, apiUrl: liveApiUrl },
    'LIVE-KEYBOARD': { appUrl: liveKeyboard.appUrl, apiUrl: liveKeyboard.apiUrl },
    'LIVE-DENIED': { appUrl: liveAppUrl, apiUrl: liveApiUrl },
  }
  const artifacts = []
  const commandArtifacts = {
    'LOCAL-SESSION': [],
    'LOCAL-PROOF-RC': [],
    'LIVE-CONTRACT': [],
    'LIVE-SESSION': [],
    'LIVE-PROOF': [],
    'LIVE-A11Y': [],
    'LIVE-KEYBOARD': [],
    'LIVE-DENIED': [],
  }

  for (const spec of artifactSpecs) {
    const extra = spec.command === 'LIVE-DENIED'
      ? {
          simulationStageCheckpointId: liveDenied.proofContext?.simulationStageCheckpointId ?? null,
          simulationRunId: liveDenied.proofContext?.simulationRunId ?? null,
          studentId: liveDenied.proofContext?.studentId ?? null,
          scopeType: 'denied-path',
          scopeId: liveDenied.actor?.scopeId ?? null,
        }
      : {}
    const artifact = await buildArtifact(
      spec,
      spec.proofSummary ? proofSummaries[spec.proofSummary] : null,
      commandContexts[spec.command],
      extra,
    )
    artifacts.push(artifact)
    commandArtifacts[spec.command].push(artifact)
    upsertManifestArtifact(manifest, artifact)
  }

  rows.push(buildLedgerRow({
    localSession,
    localProof,
    liveContract,
    liveSession,
    liveProof,
    liveKeyboard,
    defectsClosed: closedStageDefects,
    artifacts,
  }))

  rows[rows.length - 1].notes.push(
    `Local backend detached log: ${path.relative(repoRoot, localBackendLog)}`,
    `Local frontend detached log: ${path.relative(repoRoot, localFrontendLog)}`,
    `Local session detached log: ${path.relative(repoRoot, localSessionLog)}`,
    `Local proof detached log: ${path.relative(repoRoot, localProofRcLog)}`,
    `Live session-contract detached log: ${path.relative(repoRoot, liveContractLog)}`,
    `Live session detached log: ${path.relative(repoRoot, liveSessionLog)}`,
    `Live proof detached log: ${path.relative(repoRoot, liveProofLog)}`,
    `Live accessibility detached log: ${path.relative(repoRoot, liveA11yLog)}`,
    `Live keyboard detached log: ${path.relative(repoRoot, liveKeyboardLog)}`,
    `Live denied-path detached log: ${path.relative(repoRoot, liveDeniedLog)}`,
  )

  const stageSection = buildStageSection(commandArtifacts)
  const completionBlock = buildCompletionBlock(closedStageDefects)
  const updatedIndex = indexText.includes('## Stage 08B')
    ? replaceStageSection(indexText, '## Stage 08B', stageSection)
    : insertBeforeHeader(indexText, '## Stage 08C', stageSection)
  const updatedStage08b = stage08bText.includes('## Completion Update')
    ? replaceBlock(stage08bText, '## Completion Update', '\n## Goal', completionBlock)
    : insertBeforeHeader(stage08bText, '## Goal', completionBlock)

  const atm08b001 = '| ATM-08B-001 | HoD, student-proof, session restore, CSRF/origin, denied-path, and live keyboard/accessibility flows remain complete | Phase 8 | `scripts/system-admin-live-session-security.mjs`, `scripts/check-railway-deploy-readiness.mjs`, `scripts/system-admin-proof-risk-smoke.mjs`, `scripts/system-admin-live-accessibility-regression.mjs`, `scripts/system-admin-live-keyboard-regression.mjs`, and the 08B closeout helper now pin session-security, cross-origin session-contract, HoD/student proof, live accessibility, live keyboard, and denied-path evidence under stage-scoped artifacts. | 08B | `LOCAL-BACKEND`, `LOCAL-FRONTEND`, `LOCAL-SESSION`, `LOCAL-PROOF-RC` | `LIVE-CONTRACT`, `LIVE-SESSION`, `LIVE-PROOF`, `LIVE-A11Y`, `LIVE-KEYBOARD`, `LIVE-DENIED` | session-security report, live session-contract report, HoD/student proof screenshots, accessibility report, keyboard report, denied-path JSON, ledger row | HoD and student proof flows plus session/origin/CSRF protections remain explicit locally and live, including invalid-checkpoint and denied cases. |'
  const updatedAssertionMatrix = replaceLineByPrefix(assertionMatrixText, '| ATM-08B-001 |', atm08b001)

  let updatedCoverage = replaceLineByPrefix(
    coverageMatrixText,
    'Current status as of `2026-04-01`:',
    'Current status as of `2026-04-01`: `DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT`, `DEF-05A-LIVE-A11Y-PROOF-HERO-CONTRAST`, `DEF-05B-LIVE-A11Y-QUEUE-CONTRAST`, `DEF-06B-LOCAL-TEACHING-PARITY-NAV-CLOSE`, `DEF-06B-LIVE-PROOF-LOCK-COLLISION`, `DEF-07A-LIVE-PROOF-CSRF-CROSS-ORIGIN-ACTIVATION`, `DEF-07A-LIVE-PROOF-NONSEEDED-BATCH-SELECTION`, `DEF-08A-LOCAL-REQUEST-FLOW-PREVIEW-PORT-DRIFT`, and `DEF-08A-LOCAL-TEACHING-PARITY-PORTAL-HANDOFF` are closed. Stage `08A` and `08B` closeout artifacts are current, and no Stage `08A` or `08B` defects remain open in the defect register.',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| HoD overview | `HOD` | academic route `department` |',
    '| HoD overview | `HOD` | academic route `department` | `/api/academic/hod/proof-*` + proof provenance selectors + semester 1 through 6 proof slices | `cd air-mentor-api && npx vitest run tests/hod-proof-analytics.test.ts`, `LOCAL-PROOF-RC` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `hod-proof-analytics.png`, semester-walk summary JSON, semester-activation JSON, keyboard report, accessibility report | 01B, 04B, 07B, 07C, 08B |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Risk explorer | `COURSE_LEADER`, `MENTOR`, `HOD` | student drilldown to risk explorer |',
    '| Risk explorer | `COURSE_LEADER`, `MENTOR`, `HOD` | student drilldown to risk explorer | `/api/academic/students/:studentId/risk-explorer` + shared proof provenance copy + semester-walk summaries | `npm test -- --run tests/risk-explorer.test.tsx` and backend risk tests, `LOCAL-PROOF-RC` | `LIVE-PROOF`, `LIVE-KEYBOARD`, `LIVE-A11Y` | `teacher-risk-explorer-proof.png`, `hod-risk-explorer-proof.png`, semester-walk summary JSON, keyboard report, accessibility report | 01B, 04B, 07B, 07C, 08B |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Student shell | `COURSE_LEADER`, `MENTOR`, `HOD`, `SYSTEM_ADMIN` archived inspection | student drilldown to student shell |',
    '| Student shell | `COURSE_LEADER`, `MENTOR`, `HOD`, `SYSTEM_ADMIN` archived inspection | student drilldown to student shell | `/api/academic/student-shell/*` + shared proof provenance copy + semester-walk summaries | `npm test -- --run tests/student-shell.test.tsx` and backend student-shell tests, `LOCAL-PROOF-RC` | `LIVE-PROOF`, `LIVE-KEYBOARD` | `student-shell-proof.png`, semester-walk summary JSON, keyboard report, keyboard screenshot | 01B, 04B, 07B, 07C, 08B |',
  )
  updatedCoverage = replaceLineByPrefix(
    updatedCoverage,
    '| Invalid checkpoint or inactive HoD slice returns explicit not-found/empty state instead of false data | `HOD` | HoD overview and HoD risk-explorer drilldowns |',
    '| Invalid checkpoint or inactive HoD slice returns explicit not-found/empty state instead of false data | `HOD` | HoD overview and HoD risk-explorer drilldowns | HoD proof summary + checkpoint-scoped academic routes | HoD proof tests | `LIVE-PROOF`, `LIVE-DENIED` | `hod-proof-analytics.png`, `08b-live-denied-hod-proof-invalid-checkpoint-live.json` | 04B, 08B |',
  )

  await Promise.all([
    writeFile(files.ledger, formatJsonl(rows), 'utf8'),
    writeFile(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(files.index, `${updatedIndex.trimEnd()}\n`, 'utf8'),
    writeFile(files.assertionMatrix, updatedAssertionMatrix, 'utf8'),
    writeFile(files.coverageMatrix, updatedCoverage, 'utf8'),
    writeFile(files.stage08b, updatedStage08b, 'utf8'),
  ])
}

await main()
