#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync, spawn } from 'node:child_process'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

const mode = process.argv[2] ?? 'preflight'
const outputDir = process.env.RAILWAY_DIAGNOSTIC_OUTPUT_DIR ?? 'output'
const railwayService = process.env.RAILWAY_SERVICE ?? ''
const railwayEnvironment = process.env.RAILWAY_ENVIRONMENT ?? ''
const expectedFrontendOrigin = process.env.EXPECTED_FRONTEND_ORIGIN?.trim() ?? ''
const railwayPublicApiUrl = process.env.RAILWAY_PUBLIC_API_URL?.trim() ?? ''
const apiBaseUrl = railwayPublicApiUrl
const systemAdminIdentifier = process.env.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER?.trim() ?? ''
const systemAdminPassword = process.env.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD?.trim() ?? ''
const desiredCsrfSecret = process.env.RAILWAY_CSRF_SECRET?.trim() ?? ''
const syncRailwayServiceVars = process.env.SYNC_RAILWAY_SERVICE_VARS === '1' || process.env.SYNC_RAILWAY_SERVICE_VARS === 'true'

function runRailway(args, options = {}) {
  const command = process.env.RAILWAY_CLI_BIN ?? 'railway'
  const {
    input,
    ...restOptions
  } = options
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      env: process.env,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      ...(input === undefined ? {} : { input }),
      ...restOptions,
    })
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr : ''
    const stdout = typeof error?.stdout === 'string' ? error.stdout : ''
    const message = [error?.message ?? 'Railway CLI command failed', stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
    const wrapped = new Error(message)
    wrapped.cause = error
    throw wrapped
  }
}

function safeRunRailway(args, options = {}) {
  try {
    return {
      ok: true,
      output: runRailway(args, options),
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      output: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function buildRailwayBaseArgs() {
  const args = []
  if (railwayService) args.push('--service', railwayService)
  if (railwayEnvironment) args.push('--environment', railwayEnvironment)
  return args
}

function parseKeyValueOutput(text) {
  const entries = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex < 0) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    const value = trimmed.slice(equalsIndex + 1)
    entries[key] = value
  }
  return entries
}

function splitOrigins(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function isLocalDatabaseUrl(value) {
  return /127\.0\.0\.1:5432\/airmentor$/i.test(value) || /postgres:\/\/postgres:postgres@localhost:5432\/airmentor$/i.test(value)
}

function readSetCookieValues(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie()
  const singleHeader = headers.get('set-cookie')
  return singleHeader ? [singleHeader] : []
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

function loadVariableSnapshot() {
  const inlineJson = process.env.RAILWAY_VARIABLES_JSON?.trim()
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    throw new Error('RAILWAY_VARIABLES_JSON must decode to an object map of Railway variables.')
  }
  const raw = runRailway(['variable', 'list', '--kv', ...buildRailwayBaseArgs()])
  return parseKeyValueOutput(raw)
}

function requiredPreflightChecks(variables) {
  const issues = []

  if (!expectedFrontendOrigin) {
    issues.push('EXPECTED_FRONTEND_ORIGIN is missing in the GitHub Actions environment.')
  }

  if (!variables.CSRF_SECRET) {
    issues.push('CSRF_SECRET is missing from the Railway service variables.')
  }

  if (!variables.CORS_ALLOWED_ORIGINS) {
    issues.push('CORS_ALLOWED_ORIGINS is missing from the Railway service variables.')
  } else if (expectedFrontendOrigin && !splitOrigins(variables.CORS_ALLOWED_ORIGINS).includes(expectedFrontendOrigin)) {
    issues.push(`CORS_ALLOWED_ORIGINS must include ${expectedFrontendOrigin}.`)
  }

  if (variables.SESSION_COOKIE_SECURE !== 'true') {
    issues.push(`SESSION_COOKIE_SECURE must be true for the live Pages + Railway deployment, received ${variables.SESSION_COOKIE_SECURE ?? 'unset'}.`)
  }

  if (variables.SESSION_COOKIE_SAME_SITE !== 'none') {
    issues.push(`SESSION_COOKIE_SAME_SITE must be none for the live Pages + Railway deployment, received ${variables.SESSION_COOKIE_SAME_SITE ?? 'unset'}.`)
  }

  if (!variables.DATABASE_URL) {
    issues.push('DATABASE_URL is missing from the Railway service variables.')
  } else if (isLocalDatabaseUrl(variables.DATABASE_URL)) {
    issues.push('DATABASE_URL still points at the local default AirMentor Postgres connection string.')
  }

  if (variables.HOST && variables.HOST !== '0.0.0.0') {
    issues.push(`HOST must be unset or 0.0.0.0 in production-like Railway deploys, received ${variables.HOST}.`)
  }

  return issues
}

function buildDesiredVariableUpdates(variables) {
  const updates = []
  const currentOrigins = splitOrigins(variables.CORS_ALLOWED_ORIGINS ?? '')
  const desiredOrigins = expectedFrontendOrigin
    ? Array.from(new Set([...currentOrigins, expectedFrontendOrigin]))
    : currentOrigins

  if (!variables.CSRF_SECRET) {
    if (desiredCsrfSecret) {
      updates.push({
        key: 'CSRF_SECRET',
        value: desiredCsrfSecret,
        redactValue: true,
        useStdin: true,
      })
    }
  }

  if (expectedFrontendOrigin && desiredOrigins.length > 0) {
    const nextOrigins = desiredOrigins.join(',')
    if (nextOrigins !== (variables.CORS_ALLOWED_ORIGINS ?? '')) {
      updates.push({
        key: 'CORS_ALLOWED_ORIGINS',
        value: nextOrigins,
      })
    }
  }

  if (variables.SESSION_COOKIE_SECURE !== 'true') {
    updates.push({
      key: 'SESSION_COOKIE_SECURE',
      value: 'true',
    })
  }

  if (variables.SESSION_COOKIE_SAME_SITE !== 'none') {
    updates.push({
      key: 'SESSION_COOKIE_SAME_SITE',
      value: 'none',
    })
  }

  if ((variables.HOST ?? '') !== '0.0.0.0') {
    updates.push({
      key: 'HOST',
      value: '0.0.0.0',
    })
  }

  return updates
}

function applyVariableUpdates(updates) {
  for (const update of updates) {
    const args = ['variable', 'set']
    if (update.useStdin) {
      args.push(update.key, '--stdin', '--skip-deploys', ...buildRailwayBaseArgs())
      runRailway(args, { input: update.value })
      continue
    }
    args.push(`${update.key}=${update.value}`, '--skip-deploys', ...buildRailwayBaseArgs())
    runRailway(args)
  }
}

async function writeJsonReport(fileName, payload) {
  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(outputDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a boot-smoke port')))
        return
      }
      const port = address.port
      server.close(error => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

async function pollHealth(apiUrl, attempts = 15, intervalMs = 2_000) {
  const checks = []
  const healthUrl = new URL('/health', apiUrl).toString()
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = new Date().toISOString()
    try {
      const response = await fetch(healthUrl)
      const body = await response.text().catch(() => '')
      checks.push({
        attempt,
        startedAt,
        status: response.status,
        ok: response.ok,
        body,
      })
      if (response.ok) {
        return {
          ok: true,
          checks,
        }
      }
    } catch (error) {
      checks.push({
        attempt,
        startedAt,
        status: null,
        ok: false,
        body: '',
        error: error instanceof Error ? error.message : String(error),
      })
    }
    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
  return {
    ok: false,
    checks,
  }
}

async function runBootSmoke(variables) {
  const distEntryPath = path.join(process.cwd(), 'dist/index.js')
  if (!existsSync(distEntryPath)) {
    return {
      status: 'failed',
      issues: [`Build output is missing at ${distEntryPath}. Run npm run build before boot-smoke verification.`],
      stdout: '',
      stderr: '',
      health: null,
      port: null,
      configSnapshot: null,
    }
  }

  const port = await findFreePort()
  const env = {
    ...process.env,
    ...variables,
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: variables.HOST || '0.0.0.0',
  }
  const stdoutChunks = []
  const stderrChunks = []
  const child = spawn(process.execPath, [distEntryPath], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', chunk => stdoutChunks.push(String(chunk)))
  child.stderr.on('data', chunk => stderrChunks.push(String(chunk)))

  let exitCode = null
  child.on('exit', code => {
    exitCode = code
  })

  const health = await pollHealth(`http://127.0.0.1:${port}`)
  child.kill('SIGTERM')
  const settled = await new Promise(resolve => {
    const timer = setTimeout(() => resolve({ exitCode }), 5_000)
    child.once('exit', code => {
      clearTimeout(timer)
      resolve({ exitCode: code })
    })
  })

  const stdout = stdoutChunks.join('')
  const stderr = stderrChunks.join('')
  const issues = []
  if (!health.ok) {
    issues.push('Boot smoke failed to observe a healthy /health response from the built API.')
  }
  if (settled.exitCode && settled.exitCode !== 0 && health.ok) {
    issues.push(`Built API process exited with code ${settled.exitCode} during boot-smoke verification.`)
  }
  return {
    status: issues.length === 0 ? 'passed' : 'failed',
    issues,
    stdout,
    stderr,
    health,
    port,
    configSnapshot: sanitizeVariableSnapshot(variables),
  }
}

function readRailwayDeployConfig() {
  const railwayConfigPath = path.join(process.cwd(), 'railway.json')
  if (!existsSync(railwayConfigPath)) return null
  try {
    return JSON.parse(readFileSync(railwayConfigPath, 'utf8'))
  } catch {
    return null
  }
}

function runShellCommand(command, env) {
  const shell = process.env.SHELL ?? '/bin/sh'
  return execFileSync(shell, ['-lc', command], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function runDeployPathSmoke(variables) {
  const deployConfig = readRailwayDeployConfig()
  const preDeployCommand = deployConfig?.deploy?.preDeployCommand
  if (!preDeployCommand) {
    return {
      status: 'skipped',
      issues: [],
      stdout: '',
      stderr: '',
      health: null,
      port: null,
      configSnapshot: null,
      migration: null,
    }
  }

  const postgresPort = await findFreePort()
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-railway-deploy-smoke-'))
  const embeddedPostgres = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: postgresPort,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  })

  const smokeVariables = {
    ...variables,
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${postgresPort}/postgres`,
    CSRF_SECRET: variables.CSRF_SECRET || desiredCsrfSecret || 'railway-preflight-smoke-secret',
    HOST: variables.HOST || '0.0.0.0',
  }

  try {
    await embeddedPostgres.initialise()
    await embeddedPostgres.start()

    let migrationStdout = ''
    let migrationStderr = ''
    let migrationFailed = false
    try {
      migrationStdout = runShellCommand(preDeployCommand, {
        ...process.env,
        ...smokeVariables,
        NODE_ENV: 'production',
      })
    } catch (error) {
      migrationFailed = true
      migrationStdout = typeof error?.stdout === 'string' ? error.stdout : ''
      migrationStderr = typeof error?.stderr === 'string' ? error.stderr : String(error)
    }

    const issues = []
    if (migrationFailed) {
      issues.push(`Deploy-path smoke failed while running preDeployCommand: ${preDeployCommand}`)
      return {
        status: 'failed',
        issues,
        stdout: '',
        stderr: '',
        health: null,
        port: null,
        configSnapshot: sanitizeVariableSnapshot(smokeVariables),
        migration: {
          command: preDeployCommand,
          status: 'failed',
          stdout: migrationStdout,
          stderr: migrationStderr,
        },
      }
    }

    const bootSmoke = await runBootSmoke(smokeVariables)
    return {
      ...bootSmoke,
      migration: {
        command: preDeployCommand,
        status: 'passed',
        stdout: migrationStdout,
        stderr: migrationStderr,
      },
    }
  } finally {
    await embeddedPostgres.stop().catch(() => undefined)
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function runPreflight() {
  let variables = loadVariableSnapshot()
  const syncedUpdates = []

  if (syncRailwayServiceVars) {
    const updates = buildDesiredVariableUpdates(variables)
    if (updates.length > 0) {
      applyVariableUpdates(updates)
      syncedUpdates.push(...updates.map(update => ({
        key: update.key,
        value: update.redactValue ? '[redacted]' : update.value,
      })))
      variables = loadVariableSnapshot()
    }
  }

  const issues = requiredPreflightChecks(variables)
  const bootSmoke = issues.length === 0 ? await runBootSmoke(variables) : null
  const deployPathSmoke = issues.length === 0 ? await runDeployPathSmoke(variables) : null
  if (bootSmoke && bootSmoke.status !== 'passed') {
    issues.push(...bootSmoke.issues)
  }
  if (deployPathSmoke && deployPathSmoke.status === 'failed') {
    issues.push(...deployPathSmoke.issues)
  }
  const report = {
    mode: 'preflight',
    generatedAt: new Date().toISOString(),
    railwayService: railwayService || null,
    railwayEnvironment: railwayEnvironment || null,
    expectedFrontendOrigin: expectedFrontendOrigin || null,
    status: issues.length === 0 ? 'passed' : 'failed',
    checks: {
      csrfSecretPresent: Boolean(variables.CSRF_SECRET),
      corsAllowedOrigins: variables.CORS_ALLOWED_ORIGINS ?? null,
      sessionCookieSecure: variables.SESSION_COOKIE_SECURE ?? null,
      sessionCookieSameSite: variables.SESSION_COOKIE_SAME_SITE ?? null,
      telemetrySinkConfigured: Boolean(variables.AIRMENTOR_TELEMETRY_SINK_URL),
      databaseUrlConfigured: Boolean(variables.DATABASE_URL),
      host: variables.HOST ?? null,
    },
    syncedUpdates,
    bootSmoke,
    deployPathSmoke,
    issues,
    warnings: variables.AIRMENTOR_TELEMETRY_SINK_URL
      ? []
      : ['AIRMENTOR_TELEMETRY_SINK_URL is not configured; external telemetry forwarding will remain disabled.'],
  }
  await writeJsonReport('railway-deploy-preflight.json', report)

  if (issues.length > 0) {
    console.error('Railway deploy preflight failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    console.error(`Preflight report: ${path.join(outputDir, 'railway-deploy-preflight.json')}`)
    process.exit(1)
  }

  console.log(`Railway deploy preflight passed. Report: ${path.join(outputDir, 'railway-deploy-preflight.json')}`)
}

async function runHealthCheck() {
  if (!apiBaseUrl) {
    throw new Error('RAILWAY_PUBLIC_API_URL is required for the live health verification.')
  }
  const health = await pollHealth(apiBaseUrl)
  const report = {
    mode: 'health',
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    status: health.ok ? 'passed' : 'failed',
    health,
  }
  await writeJsonReport('railway-live-healthcheck.json', report)
  if (!health.ok) {
    console.error('Railway live health verification failed.')
    console.error(`Health report: ${path.join(outputDir, 'railway-live-healthcheck.json')}`)
    process.exit(1)
  }
  console.log(`Railway live health verification passed. Report: ${path.join(outputDir, 'railway-live-healthcheck.json')}`)
}

async function runSessionContract() {
  if (!apiBaseUrl) {
    throw new Error('RAILWAY_PUBLIC_API_URL is required for the live session-contract verification.')
  }
  if (!expectedFrontendOrigin) {
    throw new Error('EXPECTED_FRONTEND_ORIGIN is required for the live session-contract verification.')
  }
  if (!systemAdminIdentifier) {
    throw new Error('AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER is required for the live session-contract verification.')
  }
  if (!systemAdminPassword) {
    throw new Error('AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD is required for the live session-contract verification.')
  }

  const loginUrl = new URL('/api/session/login', apiBaseUrl).toString()
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      origin: expectedFrontendOrigin,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      identifier: systemAdminIdentifier,
      password: systemAdminPassword,
    }),
  })

  const setCookieValues = readSetCookieValues(response.headers)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  const issues = []
  if (response.status !== 200) {
    issues.push(`login returned ${response.status} instead of 200`)
  }
  if (typeof body?.csrfToken !== 'string' || body.csrfToken.length === 0) {
    issues.push('login body is missing csrfToken')
  }
  if (!setCookieValues.some(item => item.includes('airmentor_session='))) {
    issues.push('login response did not set airmentor_session')
  }
  if (!setCookieValues.some(item => item.includes('airmentor_csrf='))) {
    issues.push('login response did not set airmentor_csrf')
  }

  const restore = issues.length === 0
    ? await fetch(new URL('/api/session', apiBaseUrl), {
        headers: {
          origin: expectedFrontendOrigin,
          accept: 'application/json',
          cookie: buildCookieHeader(setCookieValues),
        },
      }).then(async response => ({
          status: response.status,
          ok: response.ok,
          body: await response.text(),
        }))
    : null

  if (restore && !restore.ok) {
    issues.push(`session restore returned ${restore.status} instead of 200`)
  } else if (restore) {
    try {
      const parsedRestore = JSON.parse(restore.body)
      if (parsedRestore?.user?.username !== systemAdminIdentifier) {
        issues.push('session restore returned the wrong user')
      }
    } catch {
      issues.push('session restore response was not valid JSON')
    }
  }

  const report = {
    mode: 'session-contract',
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    expectedFrontendOrigin,
    identifier: systemAdminIdentifier,
    status: issues.length === 0 ? 'passed' : 'failed',
    response: {
      status: response.status,
      hasCsrfToken: typeof body?.csrfToken === 'string',
      hasSessionCookie: setCookieValues.some(item => item.includes('airmentor_session=')),
      hasCsrfCookie: setCookieValues.some(item => item.includes('airmentor_csrf=')),
      restoreStatus: restore?.status ?? null,
    },
    issues,
  }
  await writeJsonReport('railway-live-session-contract.json', report)

  if (issues.length > 0) {
    console.error('Railway live session-contract verification failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    console.error(`Session-contract report: ${path.join(outputDir, 'railway-live-session-contract.json')}`)
    process.exit(1)
  }

  console.log(`Railway live session-contract verification passed. Report: ${path.join(outputDir, 'railway-live-session-contract.json')}`)
}

function sanitizeVariableSnapshot(variables) {
  return {
    CSRF_SECRET_PRESENT: Boolean(variables.CSRF_SECRET),
    CORS_ALLOWED_ORIGINS: variables.CORS_ALLOWED_ORIGINS ?? null,
    SESSION_COOKIE_SECURE: variables.SESSION_COOKIE_SECURE ?? null,
    SESSION_COOKIE_SAME_SITE: variables.SESSION_COOKIE_SAME_SITE ?? null,
    DATABASE_URL_PRESENT: Boolean(variables.DATABASE_URL),
    DATABASE_URL_IS_LOCAL_DEFAULT: Boolean(variables.DATABASE_URL && isLocalDatabaseUrl(variables.DATABASE_URL)),
    HOST: variables.HOST ?? null,
  }
}

async function runDiagnostics() {
  const variables = loadVariableSnapshot()
  const deploymentListRaw = safeRunRailway(['deployment', 'list', '--json', ...buildRailwayBaseArgs()])
  const latestDeploymentLogs = safeRunRailway(['logs', '--latest', '--deployment', '--lines', '200', '--json', ...buildRailwayBaseArgs()])
  const latestBuildLogs = safeRunRailway(['logs', '--build', '--latest', '--lines', '200', '--json', ...buildRailwayBaseArgs()])
  const health = apiBaseUrl ? await pollHealth(apiBaseUrl, 10, 3_000) : null
  const deployStdoutPath = path.join(outputDir, 'railway-up.stdout.log')
  const deployStderrPath = path.join(outputDir, 'railway-up.stderr.log')
  const deployStdout = existsSync(deployStdoutPath) ? await readFile(deployStdoutPath, 'utf8') : null
  const deployStderr = existsSync(deployStderrPath) ? await readFile(deployStderrPath, 'utf8') : null

  const report = {
    mode: 'diagnostics',
    generatedAt: new Date().toISOString(),
    railwayService: railwayService || null,
    railwayEnvironment: railwayEnvironment || null,
    apiBaseUrl: apiBaseUrl || null,
    expectedFrontendOrigin: expectedFrontendOrigin || null,
    variableSnapshot: sanitizeVariableSnapshot(variables),
    deploymentListRaw,
    latestDeploymentLogs,
    latestBuildLogs,
    deployStdout,
    deployStderr,
    health,
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(outputDir, 'railway-deploy-diagnostics.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(path.join(outputDir, 'railway-deploy-logs.json'), `${JSON.stringify(latestDeploymentLogs, null, 2)}\n`, 'utf8')
  await writeFile(path.join(outputDir, 'railway-deploy-build-logs.json'), `${JSON.stringify(latestBuildLogs, null, 2)}\n`, 'utf8')

  console.log(`Railway deploy diagnostics captured in ${outputDir}`)
}

const runners = {
  preflight: runPreflight,
  health: runHealthCheck,
  'session-contract': runSessionContract,
  diagnostics: runDiagnostics,
}

const runner = runners[mode]
if (!runner) {
  console.error(`Unknown Railway deploy diagnostics mode: ${mode}`)
  process.exit(1)
}

await runner()
