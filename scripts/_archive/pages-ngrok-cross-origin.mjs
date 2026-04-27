#!/usr/bin/env node
// Phase-6 cross-origin browser test: GitHub Pages origin -> ngrok backend.
// Uses Playwright Chromium (headless) bundled in the local nix store.
//
// What we measure:
//   1. Does Pages frontend load over HTTPS?
//   2. Does fetch(ngrokUrl + '/health', {credentials:'include'}) succeed (CORS + cert)?
//   3. Does POST /api/session/login from the Pages origin succeed and persist cookies?
//   4. Does a follow-up authenticated GET succeed (session cookie carried)?
//   5. What SameSite/Secure flags does the browser actually accept on the cookies?

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ngrokUrl = 'https://<reserved-ngrok-domain>.ngrok-free.dev'
const pagesUrl = 'https://raed2180416.github.io/AirMentor/'
const outDir = '/home/raed/projects/air-mentor-ui/docs/demo/screenshots-2026-04-27/ngrok'
await mkdir(outDir, { recursive: true })

const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? '/nix/store/x5vl8zfrg4bn9r5qqy7vd1vx9q8ws6a1-playwright-chromium/chrome-linux64/chrome'

const browser = await chromium.launch({
  headless: true,
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: false })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(`[${msg.type()}] ${msg.text()}`)
})
page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`))

const out = { ngrokUrl, pagesUrl, steps: [] }

async function shot(name) {
  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  out.steps.push({ shot: file })
}

// 1. Load Pages
await page.goto(pagesUrl, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)
await shot('01-pages-loaded')
out.steps.push({ pagesLocation: page.url() })

// 2. Fetch /health from ngrok with credentials
const healthRes = await page.evaluate(async (u) => {
  try {
    const r = await fetch(u + '/health', {
      method: 'GET',
      credentials: 'include',
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
    return { ok: r.ok, status: r.status, body: await r.text() }
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}, ngrokUrl)
out.steps.push({ healthFromBrowser: healthRes })

// 3. POST /api/session/login with credentials
const loginRes = await page.evaluate(async (u) => {
  try {
    const r = await fetch(u + '/api/session/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ identifier: 'sysadmin', password: 'admin1234' }),
    })
    let body = null
    try { body = await r.json() } catch {}
    return {
      ok: r.ok, status: r.status,
      sessionId: body?.sessionId ?? null,
      csrfToken: body?.csrfToken ? '[REDACTED-' + body.csrfToken.length + 'B]' : null,
    }
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}, ngrokUrl)
out.steps.push({ loginFromBrowser: loginRes })

// Inspect what cookies the browser actually accepted for ngrok origin
const cookies = await ctx.cookies(ngrokUrl)
out.steps.push({
  cookiesAfterLogin: cookies.map(c => ({
    name: c.name,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expires: c.expires,
    valueLen: typeof c.value === 'string' ? c.value.length : null,
  })),
})

// 4. Authenticated GET — does the browser send the cookie back?
const dashRes = await page.evaluate(async (u) => {
  try {
    const r = await fetch(u + '/api/admin/batches/batch_branch_mnc_btech_2023/proof-dashboard', {
      method: 'GET',
      credentials: 'include',
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
    let body = null
    try { body = await r.json() } catch {}
    return {
      ok: r.ok, status: r.status,
      activeRunId: body?.activeRunDetail?.simulationRunId ?? null,
      activeStatus: body?.activeRunDetail?.status ?? null,
      checkpointCount: body?.activeRunDetail?.checkpoints?.length ?? null,
      errorMessage: body?.message ?? null,
    }
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}, ngrokUrl)
out.steps.push({ dashboardFromBrowser: dashRes })

// 5. Try POST that requires CSRF — role-context. Will fail without csrf header
//    but more importantly fail if the cookie wasn't preserved cross-site.
//    We pass the csrf token returned by the login.
const csrfFromLogin = (await page.evaluate(async (u) => {
  // Re-login to grab a fresh csrf token in plaintext for this call
  const r = await fetch(u + '/api/session/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'ngrok-skip-browser-warning': '1' },
    body: JSON.stringify({ identifier: 'sysadmin', password: 'admin1234' }),
  })
  const j = await r.json().catch(() => ({}))
  return j?.csrfToken ?? null
}, ngrokUrl))
const roleRes = await page.evaluate(async ({ u, csrf }) => {
  try {
    const r = await fetch(u + '/api/session/role-context', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'ngrok-skip-browser-warning': '1',
        ...(csrf ? { 'x-airmentor-csrf': csrf } : {}),
      },
      body: JSON.stringify({ roleGrantId: 'grant_sysadmin_global' }),
    })
    let body = null
    try { body = await r.json() } catch {}
    return { ok: r.ok, status: r.status, activeRoleCode: body?.activeRoleGrant?.roleCode ?? null, errorMessage: body?.message ?? null }
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}, { u: ngrokUrl, csrf: csrfFromLogin })
out.steps.push({ roleContextFromBrowser: roleRes })

await shot('02-after-cross-origin-tests')
out.consoleErrors = consoleErrors

await ctx.close()
await browser.close()

const summaryFile = '/tmp/airmentor-demo-logs/ngrok-cross-origin-summary.json'
await writeFile(summaryFile, JSON.stringify(out, null, 2))
console.log('SUMMARY', summaryFile)
console.log(JSON.stringify(out, null, 2))
