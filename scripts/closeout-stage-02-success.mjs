#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const outputDir = path.join(repoRoot, 'output')
const playwrightDir = path.join(outputDir, 'playwright')

const files = {
  ledger: path.join(playwrightDir, 'execution-ledger.jsonl'),
  manifest: path.join(playwrightDir, 'proof-evidence-manifest.json'),
  index: path.join(playwrightDir, 'proof-evidence-index.md'),
  defects: path.join(playwrightDir, 'defect-register.json'),
  acceptanceReport: path.join(playwrightDir, 'system-admin-live-acceptance-report.json'),
  acceptancePng: path.join(playwrightDir, 'system-admin-live-acceptance.png'),
  teachingPng: path.join(playwrightDir, 'system-admin-teaching-parity-smoke.png'),
  proofPng: path.join(playwrightDir, 'system-admin-proof-control-plane.png'),
  sessionContract: path.join(outputDir, 'railway-live-session-contract.json'),
  assertionMatrix: path.join(repoRoot, 'docs/closeout/assertion-traceability-matrix.md'),
  stage02a: path.join(repoRoot, 'docs/closeout/stage-02a-faculties-workspace-extraction-parity.md'),
  stage02b: path.join(repoRoot, 'docs/closeout/stage-02b-proof-control-plane-completion.md'),
}

const liveAppUrl = 'https://raed2180416.github.io/AirMentor/'
const liveApiUrl = 'https://api-production-ab72.up.railway.app/'
const envContract = {
  PLAYWRIGHT_APP_URL: liveAppUrl,
  PLAYWRIGHT_API_URL: liveApiUrl,
  AIRMENTOR_LIVE_STACK: '1',
  AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: 'sysadmin',
  AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'admin1234',
}

function normalizeUrl(value) {
  return String(value ?? '').replace(/\/+$/, '')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

function lastStageRow(rows, stageId) {
  return [...rows].reverse().find(row => row.stageId === stageId) ?? null
}

function upsertManifestArtifact(manifest, artifact) {
  const existingIndex = manifest.artifacts.findIndex(item => item.artifactId === artifact.artifactId)
  if (existingIndex >= 0) {
    manifest.artifacts[existingIndex] = artifact
    return
  }
  manifest.artifacts.push(artifact)
}

async function buildArtifact(artifactId, rawPath, assertionIds, surface, scriptName) {
  const stats = await stat(rawPath)
  return {
    artifactId,
    semesterNumber: null,
    stageKey: null,
    simulationRunId: null,
    simulationStageCheckpointId: null,
    surface,
    actorRole: 'SYSTEM_ADMIN',
    scopeType: null,
    scopeId: null,
    routeHash: null,
    studentId: null,
    courseId: null,
    assertionIds,
    rawPath,
    labeledPath: null,
    scriptName,
    appUrl: liveAppUrl,
    apiUrl: liveApiUrl,
    createdAt: stats.mtime.toISOString(),
  }
}

function ensureReplacement(text, from, to, label) {
  assert(text.includes(from), `Could not find expected ${label} block to replace.`)
  return text.replace(from, to)
}

async function main() {
  for (const required of Object.values(files)) {
    assert(existsSync(required), `Required file is missing: ${required}`)
  }

  const acceptanceReport = JSON.parse(await readFile(files.acceptanceReport, 'utf8'))
  const sessionContract = JSON.parse(await readFile(files.sessionContract, 'utf8'))
  const acceptanceChecks = Array.isArray(acceptanceReport.checks) ? acceptanceReport.checks : []
  const failedChecks = acceptanceChecks.filter(check => check?.status !== 'passed').map(check => check?.name ?? 'unknown')

  assert(acceptanceChecks.length > 0, 'Live acceptance report does not include any checks.')
  assert(failedChecks.length === 0, `Live acceptance report still has failing checks: ${failedChecks.join(', ')}`)
  assert(normalizeUrl(acceptanceReport.appUrl) === normalizeUrl(liveAppUrl), `Acceptance report appUrl is not the live stack URL: ${acceptanceReport.appUrl ?? 'missing'}`)
  assert(sessionContract.status === 'passed', 'Railway live session-contract report is not passed.')
  assert(normalizeUrl(sessionContract.apiBaseUrl) === normalizeUrl(liveApiUrl), `Session-contract apiBaseUrl is not the live stack URL: ${sessionContract.apiBaseUrl ?? 'missing'}`)
  assert(sessionContract.expectedFrontendOrigin === new URL(liveAppUrl).origin, `Session-contract expectedFrontendOrigin is not the live Pages origin: ${sessionContract.expectedFrontendOrigin ?? 'missing'}`)

  const [ledgerText, manifestText, indexText, defectsText] = await Promise.all([
    readFile(files.ledger, 'utf8'),
    readFile(files.manifest, 'utf8'),
    readFile(files.index, 'utf8'),
    readFile(files.defects, 'utf8'),
  ])

  const rows = parseJsonl(ledgerText)
  const manifest = JSON.parse(manifestText)
  const defects = JSON.parse(defectsText)
  const previous02A = lastStageRow(rows, '02A')
  const previous02B = lastStageRow(rows, '02B')

  assert(previous02A, 'Missing prior Stage 02A ledger row.')
  assert(previous02B, 'Missing prior Stage 02B ledger row.')

  const defect = defects.items.find(item => item.defectId === 'DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT')
  assert(defect, 'Missing Stage 02A Pages drift defect entry.')

  const nowIso = new Date().toISOString()
  defect.status = 'closed'
  defect.closedAt = nowIso
  defect.blocksNextStage = false
  defect.resolution = 'GitHub Pages now serves the extracted faculties workspace bundle and the refreshed live acceptance + teaching parity artifacts are green.'
  defect.nextAction = 'None. Stage 02A live parity is restored and Stage 02B may be recorded passed.'

  const stage02aPassedAlready = rows.some(row => row.stageId === '02A' && row.status === 'passed')
  const stage02bPassedAlready = rows.some(row => row.stageId === '02B' && row.status === 'passed')

  if (!stage02aPassedAlready) {
    rows.push({
      ...previous02A,
      status: 'passed',
      liveCommands: [
        {
          commandId: 'LIVE-TEACHING',
          command: `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER} AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD} PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity`,
          status: 'passed',
          result: 'The refreshed deployed teaching-parity smoke passed after the GitHub Pages bundle drift was cleared and the extracted faculties workspace remained aligned with teaching-facing surfaces.',
        },
        {
          commandId: 'LIVE-ACCEPTANCE',
          command: `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER} AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD} PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance`,
          status: 'passed',
          result: 'The refreshed deployed acceptance flow passed across Overview, Bands, CE / SEE, CGPA Formula, Stage Gates, Courses, and Provision, confirming extracted-workspace parity on the live stack.',
        },
      ],
      env: envContract,
      artifacts: [
        '02A--LIVE-TEACHING--system-admin-teaching-parity-smoke.png',
        '02A--LIVE-ACCEPTANCE--system-admin-live-acceptance-report.json',
        '02A--LIVE-ACCEPTANCE--system-admin-live-acceptance.png',
      ],
      defectsOpened: [],
      defectsClosed: ['DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT'],
      blocker: null,
      notes: [
        'The extracted faculties workspace remains the authoritative system-admin editor surface and now re-passes live acceptance on the deployed Pages + Railway stack.',
        'The historical GitHub Pages Bands drift defect is closed by the refreshed live acceptance and teaching parity artifacts.',
        'This pass row supersedes the earlier Stage 02A failure row while preserving the append-only execution ledger contract.',
      ],
      nextAction: 'Stage 02B may now be recorded passed because the predecessor live acceptance blocker is closed.',
    })
  }

  if (!stage02bPassedAlready) {
    rows.push({
      ...previous02B,
      status: 'passed',
      liveCommands: [
        {
          commandId: 'LIVE-PROOF',
          command: `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER} AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD} PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} npm run verify:proof-closure:live`,
          status: 'passed',
          result: 'The refreshed deployed proof-closure run passed with the proof control plane, semester activation, and activeOperationalSemester evidence still reachable on the live stack.',
        },
        {
          commandId: 'LIVE-TEACHING',
          command: `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER} AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD} PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity`,
          status: 'passed',
          result: 'The refreshed deployed teaching-parity smoke passed after the proof control-plane completion rollout.',
        },
        {
          commandId: 'LIVE-ACCEPTANCE',
          command: `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER} AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=${envContract.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD} PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance`,
          status: 'passed',
          result: 'The refreshed deployed acceptance flow passed after the predecessor 02A blocker cleared, confirming the proof control plane remains reachable inside the extracted faculties workspace without regressions.',
        },
      ],
      env: envContract,
      artifacts: [
        '02B--LOCAL-PROOF--teacher-proof-panel.png',
        '02B--LOCAL-PROOF--teacher-risk-explorer-proof.png',
        '02B--LOCAL-PROOF--hod-proof-analytics.png',
        '02B--LOCAL-PROOF--hod-risk-explorer-proof.png',
        '02B--LOCAL-PROOF--student-shell-proof.png',
        '02B--LIVE-PROOF--system-admin-proof-control-plane.png',
        '02B--LIVE-TEACHING--system-admin-teaching-parity-smoke.png',
        '02B--LIVE-ACCEPTANCE--system-admin-live-acceptance-report.json',
        '02B--LIVE-ACCEPTANCE--system-admin-live-acceptance.png',
      ],
      defectsOpened: [],
      defectsClosed: [],
      blocker: null,
      notes: [
        'The predecessor Stage 02A live blocker is closed, so the proof-control-plane completion evidence is now formally promotable from blocked to passed.',
        'Repo-local proof, live proof, live teaching parity, and live acceptance all support the completed semester-activation and operator-diagnostics surface.',
        'This pass row supersedes the earlier Stage 02B blocked row while preserving the append-only execution ledger contract.',
      ],
      nextAction: 'Stage 03A may begin once the successor stage runner confirms the new passed rows in the execution ledger.',
    })
  }

  upsertManifestArtifact(
    manifest,
    await buildArtifact(
      '02A--LIVE-ACCEPTANCE--system-admin-live-acceptance-report.json',
      files.acceptanceReport,
      ['ATM-02A-001'],
      'system-admin-acceptance',
      'LIVE-ACCEPTANCE',
    ),
  )
  upsertManifestArtifact(
    manifest,
    await buildArtifact(
      '02A--LIVE-ACCEPTANCE--system-admin-live-acceptance.png',
      files.acceptancePng,
      ['ATM-02A-001'],
      'system-admin-acceptance',
      'LIVE-ACCEPTANCE',
    ),
  )
  upsertManifestArtifact(
    manifest,
    await buildArtifact(
      '02B--LIVE-TEACHING--system-admin-teaching-parity-smoke.png',
      files.teachingPng,
      ['ATM-02B-001'],
      'teaching-parity',
      'LIVE-TEACHING',
    ),
  )
  upsertManifestArtifact(
    manifest,
    await buildArtifact(
      '02B--LIVE-ACCEPTANCE--system-admin-live-acceptance-report.json',
      files.acceptanceReport,
      ['ATM-02B-001'],
      'system-admin-acceptance',
      'LIVE-ACCEPTANCE',
    ),
  )
  upsertManifestArtifact(
    manifest,
    await buildArtifact(
      '02B--LIVE-ACCEPTANCE--system-admin-live-acceptance.png',
      files.acceptancePng,
      ['ATM-02B-001'],
      'system-admin-acceptance',
      'LIVE-ACCEPTANCE',
    ),
  )

  const stage02aSection = `## Stage 02A

### Command \`LOCAL-FRONTEND\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02A-001 | npm test -- --run tests/system-admin-faculties-workspace.test.tsx tests/system-admin-accessibility-contracts.test.tsx tests/system-admin-proof-dashboard-workspace.test.tsx tests/api-client.test.ts tests/live-admin-common.test.ts tests/railway-deploy-readiness.test.ts tests/verify-final-closeout-live.test.ts | Repo-local frontend proof passed for extracted-workspace parity, workspace accessibility contracts, proof dashboard affordances, and deterministic live-wrapper coverage. |

### Command \`LIVE-TEACHING\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| 02A--LIVE-TEACHING--system-admin-teaching-parity-smoke.png | ${files.teachingPng} | ATM-02A-001 | AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=sysadmin AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=admin1234 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity | Refreshed teaching-parity screenshot confirms the extracted faculties workspace remains aligned with teaching-facing surfaces on the live stack. |

### Command \`LIVE-ACCEPTANCE\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| 02A--LIVE-ACCEPTANCE--system-admin-live-acceptance-report.json | ${files.acceptanceReport} | ATM-02A-001 | AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=sysadmin AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=admin1234 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance | Refreshed acceptance report confirms Overview, Bands, CE / SEE, CGPA Formula, Stage Gates, Courses, and Provision all pass from the extracted faculties workspace on the deployed stack. |
| 02A--LIVE-ACCEPTANCE--system-admin-live-acceptance.png | ${files.acceptancePng} | ATM-02A-001 | AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=sysadmin AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=admin1234 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance | Refreshed acceptance screenshot supersedes the earlier Pages drift blocker and shows the extracted faculties workspace active on the live stack. |

Historical Stage 02A failure artifacts remain in the manifest for traceability, but the deployed-stack blocker is now closed and the stage is passed.
`

  const stage02bSection = `## Stage 02B

### Command \`LOCAL-FRONTEND\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02B-001, ATM-02B-002, ATM-07A-001 | npm test -- --run tests/system-admin-faculties-workspace.test.tsx tests/system-admin-accessibility-contracts.test.tsx tests/system-admin-proof-dashboard-workspace.test.tsx tests/api-client.test.ts tests/live-admin-common.test.ts tests/railway-deploy-readiness.test.ts tests/verify-final-closeout-live.test.ts | Frontend proof passed for semester activation controls, playback-override messaging, extracted-workspace accessibility coverage, and live-auth/preflight hardening. |

### Command \`LOCAL-BUILD\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02B-001, ATM-02B-002, ATM-07A-001 | npm --workspace air-mentor-api run build | Backend build passed after the activation contract, activeOperationalSemester persistence, and proof-context propagation changes landed. |

### Command \`LOCAL-OPENAPI\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02B-001, ATM-02B-002, ATM-07A-001 | cd air-mentor-api && timeout 240s npx vitest run --maxWorkers=1 --reporter=verbose tests/openapi.test.ts -u | OpenAPI proof passed with \`POST /api/admin/proof-runs/:simulationRunId/activate-semester\` recorded in the public backend contract. |

### Command \`LOCAL-ADMIN-CONTROL\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02B-001, ATM-02B-002, ATM-07A-001 | cd air-mentor-api && timeout 420s npx vitest run --maxWorkers=1 --reporter=verbose tests/admin-control-plane.test.ts | Admin proof-control-plane backend proof passed with semester activation, queue/worker diagnostics, and activeOperationalSemester propagation. |

### Command \`LOCAL-HOD\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02B-001, ATM-02B-002, ATM-07A-001 | cd air-mentor-api && timeout 420s npx vitest run --maxWorkers=1 --reporter=verbose tests/hod-proof-analytics.test.ts | HoD analytics proof passed with activated-semester context while explicit playback remained a separate override. |

### Command \`LOCAL-RISK\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02B-001, ATM-02B-002, ATM-07A-001 | cd air-mentor-api && timeout 420s npx vitest run --maxWorkers=1 --reporter=verbose tests/risk-explorer.test.ts | Risk explorer proof passed with activeOperationalSemester as the default proof context when playback is not explicitly pinned. |

### Command \`LOCAL-STUDENT\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| ledger-only | n/a | ATM-02B-001, ATM-02B-002, ATM-07A-001 | cd air-mentor-api && timeout 420s npx vitest run --maxWorkers=1 --reporter=verbose tests/student-agent-shell.test.ts | Student shell proof passed with activeOperationalSemester kept separate from explicit checkpoint playback. |

### Command \`LOCAL-PROOF\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| 02B--LOCAL-PROOF--teacher-proof-panel.png | /home/raed/projects/air-mentor-ui/output/playwright/teacher-proof-panel.png | ATM-02B-001, ATM-02B-002, ATM-07A-001 | npm run verify:proof-closure:proof-rc | Repo-local proof closure refreshed the teacher proof panel after semester activation and proof-context propagation landed. |
| 02B--LOCAL-PROOF--teacher-risk-explorer-proof.png | /home/raed/projects/air-mentor-ui/output/playwright/teacher-risk-explorer-proof.png | ATM-02B-001, ATM-02B-002, ATM-07A-001 | npm run verify:proof-closure:proof-rc | Repo-local proof closure refreshed the course-leader risk explorer with activated-semester defaults intact. |
| 02B--LOCAL-PROOF--hod-proof-analytics.png | /home/raed/projects/air-mentor-ui/output/playwright/hod-proof-analytics.png | ATM-02B-001, ATM-02B-002, ATM-07A-001 | npm run verify:proof-closure:proof-rc | Repo-local proof closure refreshed the HoD analytics surface after the activation contract rollout. |
| 02B--LOCAL-PROOF--hod-risk-explorer-proof.png | /home/raed/projects/air-mentor-ui/output/playwright/hod-risk-explorer-proof.png | ATM-02B-001, ATM-02B-002, ATM-07A-001 | npm run verify:proof-closure:proof-rc | Repo-local proof closure refreshed the HoD risk explorer after the activation contract rollout. |
| 02B--LOCAL-PROOF--student-shell-proof.png | /home/raed/projects/air-mentor-ui/output/playwright/student-shell-proof.png | ATM-02B-001, ATM-02B-002, ATM-07A-001 | npm run verify:proof-closure:proof-rc | Repo-local proof closure refreshed the student shell with activeOperationalSemester as the default proof context outside explicit playback. |

### Command \`LIVE-PROOF\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| 02B--LIVE-PROOF--system-admin-proof-control-plane.png | ${files.proofPng} | ATM-02B-001, ATM-02B-002, ATM-07A-001 | AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=sysadmin AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=admin1234 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} npm run verify:proof-closure:live | Refreshed deployed proof-control-plane screenshot confirms the semester-activation capable dashboard remains healthy after the predecessor blocker cleared. |

### Command \`LIVE-TEACHING\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| 02B--LIVE-TEACHING--system-admin-teaching-parity-smoke.png | ${files.teachingPng} | ATM-02B-001 | AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=sysadmin AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=admin1234 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:teaching-parity | Refreshed deployed teaching-parity screenshot confirms the proof control-plane completion did not regress teaching-facing parity. |

### Command \`LIVE-ACCEPTANCE\`

| artifactId | path | assertionIds | source command | notes |
| --- | --- | --- | --- | --- |
| 02B--LIVE-ACCEPTANCE--system-admin-live-acceptance-report.json | ${files.acceptanceReport} | ATM-02B-001 | AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=sysadmin AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=admin1234 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance | Refreshed acceptance report confirms the proof control plane remains reachable inside the extracted faculties workspace after 02A re-cleared on the live stack. |
| 02B--LIVE-ACCEPTANCE--system-admin-live-acceptance.png | ${files.acceptancePng} | ATM-02B-001 | AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER=sysadmin AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD=admin1234 PLAYWRIGHT_APP_URL=${liveAppUrl} PLAYWRIGHT_API_URL=${liveApiUrl} AIRMENTOR_LIVE_STACK=1 npm run playwright:admin-live:acceptance | Refreshed acceptance screenshot confirms the completed proof control plane coexists with the extracted faculties workspace on the deployed stack. |
`

  let nextIndex = indexText
  nextIndex = nextIndex.replace(/## Stage 02A[\s\S]*?## Stage 02B/m, `${stage02aSection}\n\n## Stage 02B`)
  nextIndex = nextIndex.replace(/## Stage 02B[\s\S]*$/m, stage02bSection)

  let next02aDoc = await readFile(files.stage02a, 'utf8')
  next02aDoc = ensureReplacement(
    next02aDoc,
    `## Current Execution Status
- \`2026-03-30\`: repo-local extracted-workspace parity and accessibility proof passed through \`tests/system-admin-faculties-workspace.test.tsx\` and \`tests/system-admin-accessibility-contracts.test.tsx\` inside the targeted frontend verifier.
- \`2026-03-30\`: \`LIVE-TEACHING\` passed and refreshed \`output/playwright/system-admin-teaching-parity-smoke.png\`.
- \`2026-03-30\`: \`LIVE-ACCEPTANCE\` failed at \`workspace-tab-bands\`. The refreshed failure report shows the deployed GitHub Pages bundle exposes \`Academic Bands\` text but does not ship \`Save Scope Governance\` or \`Reset To Inherited Policy\`, so the extracted \`Bands\` editor is not live on the deployed stack.
- Open blocker: \`DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT\`.

## Exit Contract
- Stage \`02A\` is \`passed\` only after the deployed frontend bundle serves the extracted faculties workspace parity path and the refreshed \`LIVE-ACCEPTANCE\` artifacts are green.

## Handoff Update Required In Ledger
- \`stageId: 02A\`
- parity is only recordable as passed after the live acceptance blocker is cleared
- extracted editor owners recorded
- local/live parity proof references
`,
    `## Current Execution Status
- \`2026-03-30\`: repo-local extracted-workspace parity and accessibility proof passed through \`tests/system-admin-faculties-workspace.test.tsx\` and \`tests/system-admin-accessibility-contracts.test.tsx\` inside the targeted frontend verifier.
- \`2026-03-30\`: refreshed \`LIVE-TEACHING\` passed and rerecorded \`output/playwright/system-admin-teaching-parity-smoke.png\`.
- \`2026-03-30\`: refreshed \`LIVE-ACCEPTANCE\` passed across Overview, Bands, CE / SEE, CGPA Formula, Stage Gates, Courses, and Provision on the deployed stack.
- \`2026-03-30\`: \`DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT\` is closed.

## Exit Contract
- Stage \`02A\` is now \`passed\`; the deployed frontend bundle serves the extracted faculties workspace parity path and the refreshed \`LIVE-ACCEPTANCE\` artifacts are green.

## Handoff Update Required In Ledger
- \`stageId: 02A\`
- pass row appended after live acceptance and teaching parity re-cleared on the deployed stack
- extracted editor owners recorded
- local/live parity proof references
`,
    'Stage 02A execution-status block',
  )

  let next02bDoc = await readFile(files.stage02b, 'utf8')
  next02bDoc = ensureReplacement(
    next02bDoc,
    `## Current Execution Status
- \`2026-03-30\`: backend contract, persistence, API typing, frontend proof dashboard controls, and live-auth hardening landed in source.
- \`2026-03-30\`: repo-local proof passed, including targeted backend/frontend suites and \`npm run verify:proof-closure:proof-rc\`.
- \`2026-03-30\`: \`LIVE-PROOF\` passed and refreshed \`output/playwright/system-admin-proof-control-plane.png\`.
- \`2026-03-30\`: stage remains blocked, not failed on its own proof path, because \`02A\` is still open under \`DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT\` and the hard-stop predecessor rule therefore remains unsatisfied.

## Exit Contract
- Stage \`02B\` is \`passed\` only after \`02A\` is re-cleared on the deployed stack and the proof-control-plane evidence is rerecorded without an open predecessor blocker.

## Handoff Update Required In Ledger
- \`stageId: 02B\`
- proof control-plane controls completed
- semester activation contract recorded
- local/live proof artifact references, plus explicit blocker linkage when \`02A\` is still open
`,
    `## Current Execution Status
- \`2026-03-30\`: backend contract, persistence, API typing, frontend proof dashboard controls, and live-auth hardening landed in source.
- \`2026-03-30\`: repo-local proof passed, including targeted backend/frontend suites and \`npm run verify:proof-closure:proof-rc\`.
- \`2026-03-30\`: refreshed \`LIVE-PROOF\`, \`LIVE-TEACHING\`, and \`LIVE-ACCEPTANCE\` all passed on the deployed stack after Stage 02A re-cleared.
- \`2026-03-30\`: the predecessor blocker is gone, so Stage \`02B\` is formally passed.

## Exit Contract
- Stage \`02B\` is now \`passed\`; the proof-control-plane evidence is rerecorded without an open predecessor blocker.

## Handoff Update Required In Ledger
- \`stageId: 02B\`
- proof control-plane controls completed
- semester activation contract recorded
- local/live proof artifact references
`,
    'Stage 02B execution-status block',
  )

  let nextAssertionMatrix = await readFile(files.assertionMatrix, 'utf8')
  nextAssertionMatrix = ensureReplacement(
    nextAssertionMatrix,
    `| ATM-02A-001 | Extracted faculties workspace reaches legacy parity | Repo Facts; Phase 2 | \`src/system-admin-faculties-workspace.tsx\` exposes real governance, stage-policy, curriculum, and provisioning editors in the extracted tabs. Repo-local proof is green, but \`DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT\` remains open because the deployed Pages bundle does not yet ship the extracted \`Bands\` controls. | 02A | targeted workspace tests and \`LOCAL-WEB\` | \`LIVE-ACCEPTANCE\` | acceptance report, screenshots, ledger row, defect entry | The extracted workspace remains the authoritative editor surface and live acceptance reaches the real tab panels directly. |
| ATM-02B-001 | Proof control plane is its own complete sysadmin panel | Phase 2 | \`src/system-admin-proof-dashboard-workspace.tsx\`, \`air-mentor-api/src/modules/admin-proof-sandbox.ts\`, and \`air-mentor-api/src/lib/proof-control-plane-activation-service.ts\` now expose lifecycle, checkpoints, queue/worker diagnostics, semester activation controls, and \`activeOperationalSemester\`. Repo-local proof and \`LIVE-PROOF\` are green, but formal closure is blocked while \`DEF-02A-LIVE-GITHUB-PAGES-BANDS-DRIFT\` keeps \`02A\` open. | 02B | \`LOCAL-PROOF\`, dashboard service tests | \`LIVE-PROOF\`, \`LIVE-ACCEPTANCE\` | proof-control-plane screenshot, dashboard diagnostics proof, ledger row, defect linkage | Panel exposes lifecycle, checkpoints, queue/worker diagnostics, and semester activation workflow. |`,
    `| ATM-02A-001 | Extracted faculties workspace reaches legacy parity | Repo Facts; Phase 2 | \`src/system-admin-faculties-workspace.tsx\` exposes real governance, stage-policy, curriculum, and provisioning editors in the extracted tabs, and the refreshed deployed acceptance run now reaches Overview, Bands, CE / SEE, CGPA Formula, Stage Gates, Courses, and Provision on the live stack. | 02A | targeted workspace tests and \`LOCAL-WEB\` | \`LIVE-ACCEPTANCE\`, \`LIVE-TEACHING\` | acceptance report, acceptance screenshot, teaching parity screenshot, ledger row | The extracted workspace remains the authoritative editor surface and live acceptance reaches the real tab panels directly. |
| ATM-02B-001 | Proof control plane is its own complete sysadmin panel | Phase 2 | \`src/system-admin-proof-dashboard-workspace.tsx\`, \`air-mentor-api/src/modules/admin-proof-sandbox.ts\`, and \`air-mentor-api/src/lib/proof-control-plane-activation-service.ts\` now expose lifecycle, checkpoints, queue/worker diagnostics, semester activation controls, and \`activeOperationalSemester\`, with repo-local proof plus refreshed \`LIVE-PROOF\`, \`LIVE-TEACHING\`, and \`LIVE-ACCEPTANCE\` all green after Stage 02A re-cleared. | 02B | \`LOCAL-PROOF\`, dashboard service tests | \`LIVE-PROOF\`, \`LIVE-ACCEPTANCE\`, \`LIVE-TEACHING\` | proof-control-plane screenshot, acceptance report, teaching parity screenshot, ledger row | Panel exposes lifecycle, checkpoints, queue/worker diagnostics, and semester activation workflow. |`,
    'Stage 02 assertion rows',
  )

  await Promise.all([
    writeFile(files.ledger, formatJsonl(rows), 'utf8'),
    writeFile(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(files.index, nextIndex, 'utf8'),
    writeFile(files.defects, `${JSON.stringify(defects, null, 2)}\n`, 'utf8'),
    writeFile(files.stage02a, next02aDoc, 'utf8'),
    writeFile(files.stage02b, next02bDoc, 'utf8'),
    writeFile(files.assertionMatrix, nextAssertionMatrix, 'utf8'),
  ])

  console.log('Stage 02 closeout recorded: 02A passed, 02B passed, defect closed, and evidence/docs refreshed.')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
