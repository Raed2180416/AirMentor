import assert from 'node:assert/strict'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'

const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? appUrl
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const deniedArtifactPrefix = (process.env.AIRMENTOR_DENIED_ARTIFACT_PREFIX ?? '').trim()
const isLiveStack = process.env.AIRMENTOR_LIVE_STACK === '1'
const seededProofBatchId = 'batch_branch_mnc_btech_2023'
const teachingPasswordCandidates = ['faculty1234', '1234']
const defaultHodUsername = isLiveStack ? 'kavitha.rao' : 'devika.shetty'
const invalidCheckpointId = `stage_checkpoint_invalid_${isLiveStack ? '08b_live' : '08b_local'}`
const allowedOrigin = new URL(appUrl).origin
const requestTimeoutMs = Math.max(5_000, Number.parseInt(process.env.AIRMENTOR_DENIED_REQUEST_TIMEOUT_MS ?? '30000', 10) || 30_000)
const seededStudentId = process.env.AIRMENTOR_DENIED_STUDENT_ID?.trim() || 'student_675135a6-1349-4658-85d5-1b1b07258a1c'

const { identifier: systemAdminIdentifier, password: systemAdminPassword } = resolveSystemAdminLiveCredentials({
  scriptLabel: 'HoD invalid checkpoint probe',
})

await mkdir(outputDir, { recursive: true })

const reportPath = path.join(outputDir, isLiveStack ? 'hod-proof-invalid-checkpoint-live.json' : 'hod-proof-invalid-checkpoint-local.json')

function buildPrefixedArtifactPath(rawPath) {
  if (!deniedArtifactPrefix) return null
  return path.join(path.dirname(rawPath), `${deniedArtifactPrefix}-${path.basename(rawPath)}`)
}

async function copyPrefixedArtifact(rawPath) {
  const prefixedPath = buildPrefixedArtifactPath(rawPath)
  if (!prefixedPath) return null
  await copyFile(rawPath, prefixedPath)
  return prefixedPath
}

function readCookieHeader(cookieJar) {
  return Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ')
}

function rememberResponseCookies(cookieJar, response) {
  const setCookieValues = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (() => {
        const value = response.headers.get('set-cookie')
        return value ? [value] : []
      })()

  for (const item of setCookieValues) {
    const [cookiePair, ...attributeParts] = item.split(';')
    const [cookieName, ...cookieValueParts] = cookiePair.split('=')
    if (!cookieName) continue
    const cookieValue = cookieValueParts.join('=')
    const normalizedAttributes = attributeParts.map(attribute => attribute.trim().toLowerCase())
    const shouldClearCookie = cookieValue.length === 0
      || normalizedAttributes.some(attribute => attribute === 'max-age=0')
      || normalizedAttributes.some(attribute => attribute.startsWith('expires=thu, 01 jan 1970'))
    if (shouldClearCookie) {
      cookieJar.delete(cookieName)
      continue
    }
    cookieJar.set(cookieName, cookieValue)
  }
}

async function apiRequest(cookieJar, routePath, init = {}, options = {}) {
  const url = new URL(routePath, apiUrl).toString()
  const headers = new Headers(init.headers)
  headers.set('origin', options.origin ?? allowedOrigin)
  const cookieHeader = readCookieHeader(cookieJar)
  if (cookieHeader) headers.set('cookie', cookieHeader)
  const method = (init.method ?? 'GET').toUpperCase()
  if (options.includeCsrf ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = cookieJar.get('airmentor_csrf')
    if (csrfToken) headers.set('x-airmentor-csrf', csrfToken)
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error(`Timed out after ${requestTimeoutMs}ms: ${method} ${routePath}`)), requestTimeoutMs)
  console.log(`[denied] ${method} ${routePath}`)
  const response = await fetch(url, {
    ...init,
    headers,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId))
  rememberResponseCookies(cookieJar, response)
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { response, body }
}

async function login(cookieJar, identifier, password) {
  const result = await apiRequest(cookieJar, '/api/session/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ identifier, password }),
  }, { includeCsrf: false })
  assert.equal(result.response.status, 200, `Expected login for ${identifier} to succeed, got ${result.response.status}`)
  return result.body
}

async function resolveTeachingPassword(username) {
  for (const candidate of teachingPasswordCandidates) {
    const cookieJar = new Map()
    const result = await apiRequest(cookieJar, '/api/session/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ identifier: username, password: candidate }),
    }, { includeCsrf: false })
    if (result.response.ok) return candidate
  }
  throw new Error(`Could not resolve a working HoD password for ${username}`)
}

async function ensureHodRole(cookieJar, sessionPayload) {
  if (sessionPayload?.activeRoleGrant?.roleCode === 'HOD') return sessionPayload
  const hodGrantId = sessionPayload?.availableRoleGrants?.find(grant => grant.roleCode === 'HOD')?.grantId
  assert(hodGrantId, 'Expected the seeded HoD user to expose an HOD role grant')
  const switched = await apiRequest(cookieJar, '/api/session/role-context', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ roleGrantId: hodGrantId }),
  })
  assert.equal(switched.response.status, 200, `Expected HOD role switch to succeed, got ${switched.response.status}`)
  return switched.body
}

const adminCookieJar = new Map()
const hodCookieJar = new Map()

try {
  console.log('[denied] login system admin')
  await login(adminCookieJar, systemAdminIdentifier, systemAdminPassword)
  console.log('[denied] read seeded proof dashboard')
  const dashboard = (await apiRequest(adminCookieJar, `/api/admin/batches/${seededProofBatchId}/proof-dashboard`)).body
  const checkpoints = Array.isArray(dashboard?.activeRunDetail?.checkpoints) ? dashboard.activeRunDetail.checkpoints : []
  const validCheckpoint = checkpoints.at(-1) ?? checkpoints[0] ?? null
  assert(validCheckpoint?.simulationStageCheckpointId, 'Expected the seeded proof dashboard to expose at least one checkpoint')

  console.log('[denied] resolve seeded HoD password')
  const hodPassword = await resolveTeachingPassword(defaultHodUsername)
  console.log('[denied] login HoD and switch role if needed')
  const hodSession = await ensureHodRole(hodCookieJar, await login(hodCookieJar, defaultHodUsername, hodPassword))

  const invalidRoute = `/api/academic/students/${encodeURIComponent(seededStudentId)}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(invalidCheckpointId)}`
  console.log('[denied] request invalid checkpoint risk explorer')
  const invalidResponse = await apiRequest(hodCookieJar, invalidRoute, { method: 'GET' }, { includeCsrf: false })
  assert.equal(invalidResponse.response.status, 404, `Expected invalid checkpoint request to return 404, got ${invalidResponse.response.status}`)
  assert.equal(invalidResponse.body?.error, 'NOT_FOUND', 'Expected invalid checkpoint request to return NOT_FOUND')

  const report = {
    generatedAt: new Date().toISOString(),
    appUrl,
    apiUrl,
    actor: {
      username: defaultHodUsername,
      role: hodSession?.activeRoleGrant?.roleCode ?? 'HOD',
      grantId: hodSession?.activeRoleGrant?.grantId ?? null,
      scopeType: hodSession?.activeRoleGrant?.scopeType ?? null,
      scopeId: hodSession?.activeRoleGrant?.scopeId ?? null,
    },
    proofContext: {
      simulationRunId: dashboard?.activeRunDetail?.simulationRunId ?? null,
      simulationStageCheckpointId: validCheckpoint.simulationStageCheckpointId,
      studentId: seededStudentId,
    },
    invalidRequest: {
      route: `/api/academic/students/${seededStudentId}/risk-explorer`,
      simulationStageCheckpointId: invalidCheckpointId,
    },
    response: {
      status: invalidResponse.response.status,
      body: invalidResponse.body,
    },
  }

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const prefixedPath = await copyPrefixedArtifact(reportPath)
  console.log(`HoD invalid-checkpoint probe passed. Report: ${reportPath}`)
  if (prefixedPath) {
    console.log(`Prefixed denied-path report: ${prefixedPath}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  throw error
}
