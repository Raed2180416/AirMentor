import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'

const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? appUrl
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const { identifier, password } = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin live session security smoke',
  identifierAliases: ['AIRMENTOR_LOGIN_IDENTIFIER'],
  passwordAliases: ['AIRMENTOR_LOGIN_PASSWORD'],
})

await mkdir(outputDir, { recursive: true })

const successReport = path.join(outputDir, 'system-admin-live-session-security-report.json')
const failureReport = path.join(outputDir, 'system-admin-live-session-security-failure.json')
const allowedOrigin = new URL(appUrl).origin
const evilOrigin = 'https://evil.example'

const cookieJar = new Map()

function readCookieHeader() {
  return Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ')
}

function rememberResponseCookies(response) {
  const setCookieValues = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (() => {
        const value = response.headers.get('set-cookie')
        return value ? [value] : []
      })()

  for (const item of setCookieValues) {
    const [cookiePair] = item.split(';')
    const [cookieName, ...cookieValueParts] = cookiePair.split('=')
    if (!cookieName) continue
    cookieJar.set(cookieName, cookieValueParts.join('='))
  }
  return setCookieValues
}

async function apiRequest(routePath, init = {}, options = {}) {
  const url = new URL(routePath, apiUrl).toString()
  const headers = new Headers(init.headers)
  const origin = options.origin ?? allowedOrigin
  headers.set('origin', origin)
  const cookieHeader = readCookieHeader()
  if (cookieHeader) headers.set('cookie', cookieHeader)
  const method = (init.method ?? 'GET').toUpperCase()
  if (options.includeCsrf ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = cookieJar.get('airmentor_csrf')
    if (csrfToken) headers.set('x-airmentor-csrf', csrfToken)
  }
  const response = await fetch(url, { ...init, headers })
  const setCookieValues = rememberResponseCookies(response)
  let body = null
  const text = await response.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { response, body, setCookieValues }
}

async function writeReport(targetPath, payload) {
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

const report = {
  generatedAt: new Date().toISOString(),
  appUrl,
  apiUrl,
  allowedOrigin,
  checks: [],
}

try {
  const login = await apiRequest('/api/session/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ identifier, password }),
  }, { includeCsrf: false })
  assert.equal(login.response.status, 200, `expected login to succeed, got ${login.response.status}`)
  assert.equal(login.body?.user?.username, identifier, 'expected logged-in username to match')
  assert.equal(typeof login.body?.csrfToken, 'string', 'expected response csrfToken')
  assert.ok(cookieJar.get('airmentor_session'), 'expected session cookie after login')
  assert.ok(cookieJar.get('airmentor_csrf'), 'expected csrf cookie after login')

  if (allowedOrigin.startsWith('https://') && new URL(apiUrl).origin !== allowedOrigin) {
    const joinedSetCookie = login.setCookieValues.join(' ; ')
    assert.match(joinedSetCookie, /Secure/i, 'expected Secure cookie attribute for cross-origin HTTPS login')
    assert.match(joinedSetCookie, /SameSite=None/i, 'expected SameSite=None cookie attribute for cross-origin HTTPS login')
  }
  report.checks.push({ name: 'login_with_secure_cookie_posture', status: 'passed' })

  const restore = await apiRequest('/api/session', { method: 'GET' }, { includeCsrf: false })
  assert.equal(restore.response.status, 200, `expected session restore to succeed, got ${restore.response.status}`)
  assert.equal(restore.body?.user?.username, identifier, 'expected restored session user')
  report.checks.push({ name: 'session_restore_after_reload', status: 'passed' })

  const currentGrantId = restore.body?.activeRoleGrant?.grantId
  const alternateGrant = restore.body?.availableRoleGrants?.find(grant => grant.grantId !== currentGrantId)
  assert.ok(alternateGrant, 'expected an alternate role grant for role-context mutation smoke')

  const csrfRejected = await apiRequest('/api/session/role-context', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ roleGrantId: alternateGrant.grantId }),
  }, { includeCsrf: false })
  assert.equal(csrfRejected.response.status, 403, `expected missing-CSRF mutation to fail, got ${csrfRejected.response.status}`)
  assert.equal(csrfRejected.body?.error, 'FORBIDDEN_CSRF', 'expected missing-CSRF rejection code')
  report.checks.push({ name: 'mutation_without_csrf_rejected', status: 'passed' })

  const switched = await apiRequest('/api/session/role-context', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ roleGrantId: alternateGrant.grantId }),
  })
  assert.equal(switched.response.status, 200, `expected valid role switch to succeed, got ${switched.response.status}`)
  assert.equal(switched.body?.activeRoleGrant?.grantId, alternateGrant.grantId, 'expected role switch to update active grant')
  report.checks.push({ name: 'mutation_with_valid_csrf_succeeds', status: 'passed' })

  const forbiddenOrigin = await apiRequest('/api/session/role-context', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ roleGrantId: currentGrantId }),
  }, { origin: evilOrigin })
  assert.equal(forbiddenOrigin.response.status, 403, `expected bad origin to fail, got ${forbiddenOrigin.response.status}`)
  assert.equal(forbiddenOrigin.body?.error, 'FORBIDDEN_ORIGIN', 'expected forbidden origin rejection code')
  report.checks.push({ name: 'mismatched_origin_rejected', status: 'passed' })

  await writeReport(successReport, report)
  console.log(`Session security smoke passed. Report: ${successReport}`)
} catch (error) {
  report.error = error instanceof Error ? { message: error.message, stack: error.stack ?? null } : { message: String(error) }
  await writeReport(failureReport, report)
  console.error(`Session security smoke failed. Report: ${failureReport}`)
  throw error
}
