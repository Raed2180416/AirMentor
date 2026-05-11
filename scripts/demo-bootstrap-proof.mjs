#!/usr/bin/env node
// College demo (2026-04-27): non-interactive bootstrap of an active
// proof simulation run on the local seeded backend. Idempotent — if a
// run with checkpoints is already active, it exits cleanly.

import assert from 'node:assert/strict'

const apiUrl = process.env.AIRMENTOR_API_URL ?? 'http://127.0.0.1:4000'
const appUrl = process.env.AIRMENTOR_APP_URL ?? 'http://127.0.0.1:5173'
const sysadminId = process.env.AIRMENTOR_SYSADMIN_ID ?? 'sysadmin'
const sysadminPw = process.env.AIRMENTOR_SYSADMIN_PW ?? 'admin1234'
const batchId = process.env.AIRMENTOR_BATCH_ID ?? 'batch_branch_mnc_btech_2023'

const ORIGIN = new URL(appUrl).origin

function readSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie()
  const sc = res.headers.get('set-cookie') ?? ''
  return sc ? sc.split(/,(?=\s*[^;,=\s]+=[^;]+)/g).map(s => s.trim()).filter(Boolean) : []
}
function buildCookieHeader(setCookies) {
  return setCookies.map(s => s.split(';')[0]).filter(Boolean).join('; ')
}
function mergeCookies(prev, fresh) {
  const map = new Map()
  for (const item of (prev ?? '').split('; ').filter(Boolean)) {
    const [k, ...rest] = item.split('=')
    map.set(k, rest.join('='))
  }
  for (const item of fresh) {
    const [pair] = item.split(';')
    const [k, ...rest] = pair.split('=')
    if (k) map.set(k, rest.join('='))
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function login() {
  const res = await fetch(new URL('/api/session/login', apiUrl), {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ identifier: sysadminId, password: sysadminPw }),
  })
  const text = await res.text()
  assert.equal(res.status, 200, `login failed ${res.status}: ${text.slice(0, 400)}`)
  return { cookieHeader: buildCookieHeader(readSetCookies(res)), csrfToken: JSON.parse(text).csrfToken }
}
async function api(s, p, init = {}) {
  const res = await fetch(new URL(p, apiUrl), {
    method: init.method ?? 'GET',
    headers: {
      origin: ORIGIN, accept: 'application/json',
      ...(s.csrfToken ? { 'x-airmentor-csrf': s.csrfToken } : {}),
      ...(s.cookieHeader ? { cookie: s.cookieHeader } : {}),
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const sc = readSetCookies(res)
  if (sc.length) {
    s.cookieHeader = mergeCookies(s.cookieHeader, sc)
    const refresh = sc.find(c => c.startsWith('airmentor_csrf='))
    if (refresh) s.csrfToken = decodeURIComponent(refresh.split('=')[1].split(';')[0])
  }
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, body, text }
}

const session = await login()
console.log('[bootstrap] sysadmin login ok')

let dash = (await api(session, `/api/admin/batches/${batchId}/proof-dashboard`)).body
const initialActive = dash?.activeRunDetail
if (initialActive?.checkpoints?.length) {
  console.log(`[bootstrap] active run already healthy: ${initialActive.simulationRunId} status=${initialActive.status} checkpoints=${initialActive.checkpoints.length}`)
  process.exit(0)
}

if (!dash?.imports?.length) {
  console.log('[bootstrap] creating proof curriculum import')
  const r = await api(session, `/api/admin/batches/${batchId}/proof-imports`, { method: 'POST', body: {} })
  if (r.status >= 400) console.log(`[bootstrap] import create non-OK ${r.status}: ${String(r.text).slice(0, 200)}`)
  dash = (await api(session, `/api/admin/batches/${batchId}/proof-dashboard`)).body
}
let latestImport = dash.imports?.[0]
assert(latestImport, 'no curriculum import after bootstrap')

if (latestImport.status !== 'approved' && latestImport.status !== 'validated') {
  console.log(`[bootstrap] validating import ${latestImport.curriculumImportVersionId}`)
  await api(session, `/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/validate`, { method: 'POST' })
  dash = (await api(session, `/api/admin/batches/${batchId}/proof-dashboard`)).body
  latestImport = dash.imports?.[0] ?? latestImport
}
if (latestImport.status !== 'approved') {
  console.log(`[bootstrap] approving import ${latestImport.curriculumImportVersionId}`)
  await api(session, `/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/approve`, { method: 'POST' })
  dash = (await api(session, `/api/admin/batches/${batchId}/proof-dashboard`)).body
  latestImport = dash.imports?.find(i => i.status === 'approved') ?? dash.imports?.[0] ?? latestImport
}

const activeRunId = dash.activeRunDetail?.simulationRunId
if (activeRunId && !(dash.activeRunDetail.checkpoints?.length)) {
  console.log(`[bootstrap] recomputing risk to materialize checkpoints for ${activeRunId}`)
  await api(session, `/api/admin/proof-runs/${encodeURIComponent(activeRunId)}/recompute-risk`, { method: 'POST' })
}
dash = (await api(session, `/api/admin/batches/${batchId}/proof-dashboard`)).body

if (!dash.activeRunDetail?.checkpoints?.length) {
  console.log('[bootstrap] no checkpoints yet; enqueuing fresh activated run')
  await api(session, `/api/admin/batches/${batchId}/proof-runs`, {
    method: 'POST',
    body: {
      curriculumImportVersionId: latestImport.curriculumImportVersionId,
      activate: true,
    },
  })
}

const deadline = Date.now() + 360_000
while (Date.now() < deadline) {
  dash = (await api(session, `/api/admin/batches/${batchId}/proof-dashboard`)).body
  if (dash.activeRunDetail?.checkpoints?.length) break
  await new Promise(r => setTimeout(r, 1500))
}
const finalActive = dash.activeRunDetail
if (!finalActive?.checkpoints?.length) {
  console.error('[bootstrap] timed out waiting for checkpoints')
  process.exit(2)
}
console.log(`[bootstrap] DONE active=${finalActive.simulationRunId} status=${finalActive.status} checkpoints=${finalActive.checkpoints.length} sem=${finalActive.activeOperationalSemester}`)
