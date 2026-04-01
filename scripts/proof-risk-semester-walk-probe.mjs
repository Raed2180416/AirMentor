#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  normalizeSemesterTargetList,
  resolveSemesterWalkCheckpoint,
  sanitizeArtifactPrefix,
} from './proof-risk-semester-walk.mjs'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'

const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? appUrl
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const isLiveStack = process.env.AIRMENTOR_LIVE_STACK === '1'
const seededProofRoute = '#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023'
const seededProofBatchId = 'batch_branch_mnc_btech_2023'
const semesterTargets = normalizeSemesterTargetList(process.env.AIRMENTOR_PROOF_SEMESTER_TARGETS ?? '1,2,3')
const artifactPrefix = sanitizeArtifactPrefix(
  (process.env.AIRMENTOR_PROOF_ARTIFACT_PREFIX ?? '').trim()
    || (isLiveStack ? 'proof-risk-live-probe' : 'proof-risk-local-probe'),
)

assert(semesterTargets.length > 0, 'AIRMENTOR_PROOF_SEMESTER_TARGETS must include at least one semester number')
assert(artifactPrefix, 'AIRMENTOR_PROOF_ARTIFACT_PREFIX must resolve to a non-empty artifact prefix')

const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'Proof risk semester-walk probe',
})

await mkdir(outputDir, { recursive: true })

const probeArtifactPath = path.join(outputDir, `${artifactPrefix}-semester-probe.json`)

function readSetCookieValues(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie()
  const singleHeader = headers.get('set-cookie')
  return singleHeader
    ? singleHeader
      .split(/,(?=\s*[^;,=\s]+=[^;]+)/g)
      .map(item => item.trim())
      .filter(Boolean)
    : []
}

function buildCookieHeader(setCookieValues) {
  const pairs = []
  for (const item of setCookieValues) {
    const [cookiePair] = item.split(';')
    if (!cookiePair) continue
    pairs.push(cookiePair)
  }
  return pairs.join('; ')
}

function describeCheckpoint(checkpoint) {
  return {
    simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
    semesterNumber: checkpoint.semesterNumber,
    stageKey: checkpoint.stageKey ?? null,
    stageLabel: checkpoint.stageLabel ?? null,
    stageDescription: checkpoint.stageDescription ?? null,
    stageOrder: typeof checkpoint.stageOrder === 'number' ? checkpoint.stageOrder : null,
    stageAdvanceBlocked: typeof checkpoint.stageAdvanceBlocked === 'boolean' ? checkpoint.stageAdvanceBlocked : null,
    blockingQueueItemCount: Number.isFinite(Number(checkpoint.blockingQueueItemCount))
      ? Number(checkpoint.blockingQueueItemCount)
      : Number.isFinite(Number(checkpoint.openQueueCount))
        ? Number(checkpoint.openQueueCount)
        : null,
    playbackAccessible: typeof checkpoint.playbackAccessible === 'boolean' ? checkpoint.playbackAccessible : null,
    blockedByCheckpointId: typeof checkpoint.blockedByCheckpointId === 'string' ? checkpoint.blockedByCheckpointId : null,
    blockedProgressionReason: typeof checkpoint.blockedProgressionReason === 'string' ? checkpoint.blockedProgressionReason : null,
    noActionHighRiskCount: Number.isFinite(Number(checkpoint.noActionHighRiskCount))
      ? Number(checkpoint.noActionHighRiskCount)
      : null,
    averageCounterfactualLiftScaled: Number.isFinite(Number(checkpoint.averageCounterfactualLiftScaled))
      ? Number(checkpoint.averageCounterfactualLiftScaled)
      : null,
    electiveVisibleCount: Number.isFinite(Number(checkpoint.electiveVisibleCount))
      ? Number(checkpoint.electiveVisibleCount)
      : null,
  }
}

async function login() {
  const response = await fetch(new URL('/api/session/login', apiUrl), {
    method: 'POST',
    headers: {
      origin: new URL(appUrl).origin,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      identifier: systemAdminCredentials.identifier,
      password: systemAdminCredentials.password,
    }),
  })
  const setCookieValues = readSetCookieValues(response.headers)
  const bodyText = await response.text()
  const body = bodyText ? JSON.parse(bodyText) : null
  assert.equal(response.status, 200, `System admin login failed with ${response.status}: ${bodyText.slice(0, 800)}`)
  assert(typeof body?.csrfToken === 'string' && body.csrfToken.length > 0, 'System admin login response is missing csrfToken')
  const cookieHeader = buildCookieHeader(setCookieValues)
  assert(cookieHeader.includes('airmentor_session='), 'System admin login did not set airmentor_session')
  assert(cookieHeader.includes('airmentor_csrf='), 'System admin login did not set airmentor_csrf')
  return {
    cookieHeader,
    csrfToken: body.csrfToken,
  }
}

async function adminApiRequest(session, apiPath, init = {}) {
  const { body, ...restInit } = init
  const controller = new AbortController()
  const timeoutMs = typeof restInit.timeout === 'number' ? restInit.timeout : 120_000
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(new URL(apiPath, apiUrl), {
      method: restInit.method ?? 'GET',
      headers: {
        origin: new URL(appUrl).origin,
        accept: 'application/json',
        cookie: session.cookieHeader,
        'x-airmentor-csrf': session.csrfToken,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      throw new Error(`Admin API ${apiPath} failed with ${response.status}: ${text.slice(0, 800)}`)
    }
    return text ? JSON.parse(text) : null
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function main() {
  const session = await login()
  const dashboard = await adminApiRequest(session, `/api/admin/batches/${seededProofBatchId}/proof-dashboard`)
  const activeRun = dashboard?.activeRunDetail ?? null
  assert(activeRun?.simulationRunId, `Seeded proof dashboard for ${seededProofBatchId} is missing an active run`)
  const checkpoints = Array.isArray(activeRun.checkpoints) ? activeRun.checkpoints.slice() : []
  assert(checkpoints.length > 0, `Seeded proof dashboard for ${seededProofBatchId} is missing checkpoints`)

  const availableOperationalSemesters = Array.from(new Set(
    checkpoints
      .map(item => Number(item?.semesterNumber))
      .filter(Number.isFinite),
  )).sort((left, right) => left - right)
  const previousOperationalSemester = activeRun.activeOperationalSemester ?? null

  const summaries = []
  for (const semesterNumber of semesterTargets) {
    assert(
      availableOperationalSemesters.includes(semesterNumber),
      `Seeded proof dashboard does not expose semester ${semesterNumber}; available semesters: ${availableOperationalSemesters.join(', ')}`,
    )
    const selectedCheckpoint = resolveSemesterWalkCheckpoint(checkpoints, semesterNumber)
    const activationRequest = { semesterNumber }
    const activationResponse = await adminApiRequest(
      session,
      `/api/admin/proof-runs/${encodeURIComponent(activeRun.simulationRunId)}/activate-semester`,
      {
        method: 'POST',
        body: activationRequest,
      },
    )
    assert.equal(
      activationResponse.activeOperationalSemester,
      semesterNumber,
      `Activation response should report operational semester ${semesterNumber}`,
    )
    const dashboardAfterActivation = await adminApiRequest(session, `/api/admin/batches/${seededProofBatchId}/proof-dashboard`)
    assert.equal(
      dashboardAfterActivation?.activeRunDetail?.activeOperationalSemester,
      semesterNumber,
      `Seeded proof dashboard should reflect operational semester ${semesterNumber} after activation`,
    )
    const refreshedCheckpoints = Array.isArray(dashboardAfterActivation?.activeRunDetail?.checkpoints)
      ? dashboardAfterActivation.activeRunDetail.checkpoints
      : checkpoints
    const refreshedSelectedCheckpoint = resolveSemesterWalkCheckpoint(refreshedCheckpoints, semesterNumber)
    summaries.push({
      semesterNumber,
      activationRequest,
      activationResponse,
      selectedCheckpoint: describeCheckpoint(refreshedSelectedCheckpoint),
    })
  }

  let restoreResponse = null
  if (
    previousOperationalSemester != null
    && previousOperationalSemester !== semesterTargets.at(-1)
    && availableOperationalSemesters.includes(previousOperationalSemester)
  ) {
    restoreResponse = await adminApiRequest(
      session,
      `/api/admin/proof-runs/${encodeURIComponent(activeRun.simulationRunId)}/activate-semester`,
      {
        method: 'POST',
        body: {
          semesterNumber: previousOperationalSemester,
        },
      },
    )
    const restoredDashboard = await adminApiRequest(session, `/api/admin/batches/${seededProofBatchId}/proof-dashboard`)
    assert.equal(
      restoredDashboard?.activeRunDetail?.activeOperationalSemester,
      previousOperationalSemester,
      `Seeded proof dashboard should restore operational semester ${previousOperationalSemester}`,
    )
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    stack: isLiveStack ? 'live' : 'local',
    appUrl,
    apiUrl,
    batchId: seededProofBatchId,
    routeHash: seededProofRoute,
    simulationRunId: activeRun.simulationRunId,
    previousOperationalSemester,
    availableOperationalSemesters,
    semesterTargets,
    restoreResponse,
    summaries,
  }

  await writeFile(probeArtifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log('Semester-walk probe passed.')
  console.log(`Probe artifact: ${probeArtifactPath}`)
  for (const summary of summaries) {
    console.log(`- semester ${summary.semesterNumber}: ${summary.selectedCheckpoint.simulationStageCheckpointId}`)
  }
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
