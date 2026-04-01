#!/usr/bin/env node
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const scope = (process.argv[2] ?? '').trim()
const prefix = (process.argv[3] ?? `08c-${scope}`).trim()

if (scope !== 'local' && scope !== 'live') {
  console.error('Usage: node scripts/snapshot-final-closeout-artifacts.mjs <local|live> [prefix]')
  process.exit(1)
}

const repoRoot = process.cwd()
const playwrightDir = path.join(repoRoot, 'output', 'playwright')
const apiOutputDir = path.join(repoRoot, 'air-mentor-api', 'output')
const stageId = '08C'

const baseSpecs = [
  { command: 'CLOSEOUT-PROOF', surface: 'system-admin-proof-control-plane', source: path.join(playwrightDir, 'system-admin-proof-control-plane.png') },
  { command: 'CLOSEOUT-PROOF', surface: 'teacher-proof-panel', source: path.join(playwrightDir, 'teacher-proof-panel.png') },
  { command: 'CLOSEOUT-PROOF', surface: 'teacher-risk-explorer', source: path.join(playwrightDir, 'teacher-risk-explorer-proof.png') },
  { command: 'CLOSEOUT-PROOF', surface: 'hod-proof-analytics', source: path.join(playwrightDir, 'hod-proof-analytics.png') },
  { command: 'CLOSEOUT-PROOF', surface: 'hod-risk-explorer', source: path.join(playwrightDir, 'hod-risk-explorer-proof.png') },
  { command: 'CLOSEOUT-PROOF', surface: 'student-shell', source: path.join(playwrightDir, 'student-shell-proof.png') },
  { command: 'CLOSEOUT-PROOF', surface: 'proof-semester-activation-request-local', source: path.join(playwrightDir, 'system-admin-proof-semester-activation-local-request.json'), only: 'local' },
  { command: 'CLOSEOUT-PROOF', surface: 'proof-semester-activation-response-local', source: path.join(playwrightDir, 'system-admin-proof-semester-activation-local-response.json'), only: 'local' },
  { command: 'CLOSEOUT-PROOF', surface: 'proof-semester-activation-request-live', source: path.join(playwrightDir, 'system-admin-proof-semester-activation-live-request.json'), only: 'live' },
  { command: 'CLOSEOUT-PROOF', surface: 'proof-semester-activation-response-live', source: path.join(playwrightDir, 'system-admin-proof-semester-activation-live-response.json'), only: 'live' },
  { command: 'CLOSEOUT-ACCEPTANCE', surface: 'system-admin-live-acceptance-report', source: path.join(playwrightDir, 'system-admin-live-acceptance-report.json') },
  { command: 'CLOSEOUT-ACCEPTANCE', surface: 'system-admin-live-acceptance', source: path.join(playwrightDir, 'system-admin-live-acceptance.png') },
  { command: 'CLOSEOUT-REQUEST-FLOW', surface: 'system-admin-live-request-flow-report', source: path.join(playwrightDir, 'system-admin-live-request-flow-report.json') },
  { command: 'CLOSEOUT-REQUEST-FLOW', surface: 'system-admin-live-request-flow', source: path.join(playwrightDir, 'system-admin-live-request-flow.png') },
  { command: 'CLOSEOUT-TEACHING', surface: 'system-admin-teaching-parity-smoke', source: path.join(playwrightDir, 'system-admin-teaching-parity-smoke.png') },
  { command: 'CLOSEOUT-TEACHING', surface: 'course-leader-dashboard-proof', source: path.join(playwrightDir, 'course-leader-dashboard-proof.png') },
  { command: 'CLOSEOUT-TEACHING', surface: 'mentor-view-proof', source: path.join(playwrightDir, 'mentor-view-proof.png') },
  { command: 'CLOSEOUT-TEACHING', surface: 'queue-history-proof', source: path.join(playwrightDir, 'queue-history-proof.png') },
  { command: 'CLOSEOUT-A11Y', surface: 'system-admin-live-accessibility-report', source: path.join(playwrightDir, 'system-admin-live-accessibility-report.json') },
  { command: 'CLOSEOUT-A11Y', surface: 'system-admin-live-screen-reader-preflight', source: path.join(playwrightDir, 'system-admin-live-screen-reader-preflight.md') },
  { command: 'CLOSEOUT-A11Y', surface: 'system-admin-live-accessibility-regression', source: path.join(playwrightDir, 'system-admin-live-accessibility-regression.png') },
  { command: 'CLOSEOUT-KEYBOARD', surface: 'system-admin-live-keyboard-regression-report', source: path.join(playwrightDir, 'system-admin-live-keyboard-regression-report.json') },
  { command: 'CLOSEOUT-KEYBOARD', surface: 'system-admin-live-keyboard-regression', source: path.join(playwrightDir, 'system-admin-live-keyboard-regression.png') },
  { command: 'CLOSEOUT-SESSION', surface: 'system-admin-live-session-security-report', source: path.join(playwrightDir, 'system-admin-live-session-security-report.json') },
]

const liveOnlySpecs = [
  { command: 'LIVE-CONTRACT', surface: 'railway-live-session-contract', source: path.join(apiOutputDir, 'railway-live-session-contract.json') },
]

const specs = [
  ...baseSpecs.filter(spec => !spec.only || spec.only === scope),
  ...(scope === 'live' ? liveOnlySpecs : []),
]

function destinationFor(sourcePath) {
  const targetDir = sourcePath.startsWith(apiOutputDir) ? apiOutputDir : playwrightDir
  return path.join(targetDir, `${prefix}-${path.basename(sourcePath)}`)
}

async function copySpec(spec) {
  if (!existsSync(spec.source)) {
    throw new Error(`Missing closeout artifact for ${scope}: ${spec.source}`)
  }
  const destination = destinationFor(spec.source)
  await mkdir(path.dirname(destination), { recursive: true })
  await copyFile(spec.source, destination)
  const copiedStats = await stat(destination)
  return {
    stageId,
    scope,
    command: spec.command,
    surface: spec.surface,
    source: spec.source,
    destination,
    copiedAt: copiedStats.mtime.toISOString(),
  }
}

const copiedArtifacts = []
for (const spec of specs) {
  copiedArtifacts.push(await copySpec(spec))
}

const bundlePath = path.join(playwrightDir, `${prefix}-closeout-artifact-bundle.json`)
await writeFile(bundlePath, `${JSON.stringify({
  stageId,
  scope,
  prefix,
  copiedArtifacts,
}, null, 2)}\n`, 'utf8')

console.log(bundlePath)
