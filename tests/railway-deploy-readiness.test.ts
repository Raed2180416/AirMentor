import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = path.join(process.cwd(), 'scripts/check-railway-deploy-readiness.mjs')
const liveOrigin = 'https://raed2180416.github.io'
const railwayVariables = {
  CORS_ALLOWED_ORIGINS: liveOrigin,
  CSRF_SECRET: 'csrf-secret',
  SESSION_COOKIE_SECURE: 'true',
  SESSION_COOKIE_SAME_SITE: 'none',
  DATABASE_URL: 'postgres://railway.internal/airmentor',
  AIRMENTOR_TELEMETRY_SINK_URL: 'https://telemetry.example.com/ingest',
  HOST: '0.0.0.0',
}

const tempDirs: string[] = []
const childProcesses: ChildProcess[] = []

afterEach(async () => {
  await Promise.all(childProcesses.splice(0).map(async child => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
    }
    if (child.exitCode === null) {
      await new Promise(resolve => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL')
        }, 1_000)
        child.once('exit', () => {
          clearTimeout(timer)
          resolve(undefined)
        })
      })
    }
  }))
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function makeOutputDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'airmentor-railway-preflight-'))
  tempDirs.push(dir)
  return dir
}

async function makeBootSmokeAppDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'airmentor-railway-app-'))
  tempDirs.push(dir)
  await mkdir(path.join(dir, 'dist'), { recursive: true })
  await writeFile(
    path.join(dir, 'dist/index.js'),
    [
      "const http = require('node:http')",
      "const port = Number(process.env.PORT || '0')",
      "const host = process.env.HOST || '127.0.0.1'",
      'const server = http.createServer((req, res) => {',
      "  if (req.url === '/health') {",
      "    res.writeHead(200, { 'content-type': 'application/json' })",
      "    res.end(JSON.stringify({ ok: true }))",
      '    return',
      '  }',
      '  res.writeHead(404)',
      "  res.end('not found')",
      '})',
      'server.listen(port, host)',
      "process.on('SIGTERM', () => server.close(() => process.exit(0)))",
    ].join('\n'),
    'utf8',
  )
  return dir
}

async function startSessionContractServer(mode: 'transient-login' | 'always-401') {
  const dir = await mkdtemp(path.join(tmpdir(), 'airmentor-session-contract-server-'))
  tempDirs.push(dir)
  const scriptPath = path.join(dir, 'session-contract-server.mjs')

  await writeFile(
    scriptPath,
    [
      "import http from 'node:http'",
      'let loginAttempts = 0',
      "const mode = process.env.SESSION_CONTRACT_TEST_MODE || 'transient-login'",
      'const server = http.createServer((req, res) => {',
      "  if (req.url === '/api/session/login' && req.method === 'POST') {",
      '    loginAttempts += 1',
      "    if (mode === 'transient-login' && loginAttempts === 1) {",
      "      res.writeHead(401, { 'content-type': 'application/json' })",
      "      res.end(JSON.stringify({ error: 'warming_up' }))",
      '      return',
      '    }',
      "    if (mode === 'always-401') {",
      "      res.writeHead(401, { 'content-type': 'application/json' })",
      "      res.end(JSON.stringify({ error: 'invalid_credentials' }))",
      '      return',
      '    }',
      "    res.writeHead(200, {",
      "      'content-type': 'application/json',",
      "      'set-cookie': [",
      "        'airmentor_session=session-ready; Path=/; HttpOnly; Secure; SameSite=None',",
      "        'airmentor_csrf=csrf-ready; Path=/; Secure; SameSite=None',",
      '      ],',
      '    })',
      "    res.end(JSON.stringify({ csrfToken: 'csrf-ready' }))",
      '    return',
      '  }',
      "  if (req.url === '/api/session' && req.method === 'GET') {",
      "    if ((req.headers.cookie || '').includes('airmentor_session=session-ready')) {",
      "      res.writeHead(200, { 'content-type': 'application/json' })",
      "      res.end(JSON.stringify({ user: { username: 'sysadmin' } }))",
      '      return',
      '    }',
      '  }',
      "  res.writeHead(404, { 'content-type': 'application/json' })",
      "  res.end(JSON.stringify({ error: 'not_found' }))",
      '})',
      'server.keepAliveTimeout = 1',
      "server.listen(0, '127.0.0.1', () => {",
      '  const address = server.address()',
      "  if (!address || typeof address === 'string') throw new Error('missing address')",
      "  console.log(`PORT=${address.port}`)",
      '})',
      "process.on('SIGTERM', () => {",
      '  server.closeAllConnections?.()',
      '  server.closeIdleConnections?.()',
      '  server.close(() => process.exit(0))',
      '})',
    ].join('\n'),
    'utf8',
  )

  const child = spawn('node', [scriptPath], {
    env: {
      ...process.env,
      SESSION_CONTRACT_TEST_MODE: mode,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  childProcesses.push(child)

  return await new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const onData = (chunk: Buffer | string) => {
      stdout += chunk.toString()
      const match = stdout.match(/PORT=(\d+)/)
      if (match) {
        cleanup()
        resolve(`http://127.0.0.1:${match[1]}`)
      }
    }
    const onStderr = (chunk: Buffer | string) => {
      stderr += chunk.toString()
    }
    const onExit = (code: number | null) => {
      cleanup()
      reject(new Error(`Session-contract server exited before startup (code ${code ?? 'null'}): ${stderr || stdout}`))
    }
    const cleanup = () => {
      child.stdout?.off('data', onData)
      child.stderr?.off('data', onStderr)
      child.off('exit', onExit)
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onStderr)
    child.on('exit', onExit)
  })
}

describe('Railway deploy readiness script', () => {
  it('passes preflight when the required variables are present', async () => {
    const outputDir = await makeOutputDir()
    const appDir = await makeBootSmokeAppDir()

    const result = spawnSync('node', [scriptPath, 'preflight'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        RAILWAY_SERVICE: 'air-mentor-api',
        EXPECTED_FRONTEND_ORIGIN: liveOrigin,
        RAILWAY_DIAGNOSTIC_OUTPUT_DIR: outputDir,
        RAILWAY_VARIABLES_JSON: JSON.stringify(railwayVariables),
      },
    })

    expect(result.status).toBe(0)
    const report = JSON.parse(await readFile(path.join(outputDir, 'railway-deploy-preflight.json'), 'utf8'))
    expect(result.stdout).toContain('Railway deploy preflight passed')
    expect(report.status).toBe('passed')
    expect(report.checks.telemetrySinkConfigured).toBe(true)
  })

  it('fails preflight when CSRF_SECRET is missing', async () => {
    const outputDir = await makeOutputDir()
    const appDir = await makeBootSmokeAppDir()

    const result = spawnSync('node', [scriptPath, 'preflight'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        RAILWAY_SERVICE: 'air-mentor-api',
        EXPECTED_FRONTEND_ORIGIN: liveOrigin,
        RAILWAY_DIAGNOSTIC_OUTPUT_DIR: outputDir,
        RAILWAY_VARIABLES_JSON: JSON.stringify({
          ...railwayVariables,
          CSRF_SECRET: '',
        }),
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('CSRF_SECRET is missing')
  })

  it('fails preflight when the expected frontend origin is missing from CORS_ALLOWED_ORIGINS', async () => {
    const outputDir = await makeOutputDir()
    const appDir = await makeBootSmokeAppDir()

    const result = spawnSync('node', [scriptPath, 'preflight'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        RAILWAY_SERVICE: 'air-mentor-api',
        EXPECTED_FRONTEND_ORIGIN: liveOrigin,
        RAILWAY_DIAGNOSTIC_OUTPUT_DIR: outputDir,
        RAILWAY_VARIABLES_JSON: JSON.stringify({
          ...railwayVariables,
          CORS_ALLOWED_ORIGINS: 'https://example.com',
        }),
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`CORS_ALLOWED_ORIGINS must include ${liveOrigin}.`)
  })

  it('fails the live session contract when the system-admin identifier is missing', async () => {
    const outputDir = await makeOutputDir()
    const appDir = await makeBootSmokeAppDir()

    const result = spawnSync('node', [scriptPath, 'session-contract'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        RAILWAY_PUBLIC_API_URL: 'https://api-production-ab72.up.railway.app/',
        EXPECTED_FRONTEND_ORIGIN: liveOrigin,
        AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'railway-secret',
        RAILWAY_DIAGNOSTIC_OUTPUT_DIR: outputDir,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER is required')
  })

  it('retries the live session contract until login settles after deploy', { timeout: 15_000 }, async () => {
    const outputDir = await makeOutputDir()
    const appDir = await makeBootSmokeAppDir()
    const apiBaseUrl = await startSessionContractServer('transient-login')

    const result = spawnSync('node', [scriptPath, 'session-contract'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        RAILWAY_PUBLIC_API_URL: apiBaseUrl,
        EXPECTED_FRONTEND_ORIGIN: liveOrigin,
        AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: 'sysadmin',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'admin1234',
        RAILWAY_LIVE_SESSION_CONTRACT_MAX_ATTEMPTS: '3',
        RAILWAY_LIVE_SESSION_CONTRACT_RETRY_DELAY_MS: '0',
        RAILWAY_DIAGNOSTIC_OUTPUT_DIR: outputDir,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('passed after 2 attempt(s)')
    const report = JSON.parse(await readFile(path.join(outputDir, 'railway-live-session-contract.json'), 'utf8'))
    expect(report.status).toBe('passed')
    expect(report.retryWindow.attemptsUsed).toBe(2)
    expect(report.retryWindow.recoveredAfterAttempt).toBe(2)
    expect(report.attempts).toHaveLength(2)
    expect(report.attempts[0].status).toBe(401)
    expect(report.attempts[1].status).toBe(200)
  })

  it('fails the live session contract after exhausting the retry window', { timeout: 15_000 }, async () => {
    const outputDir = await makeOutputDir()
    const appDir = await makeBootSmokeAppDir()
    const apiBaseUrl = await startSessionContractServer('always-401')

    const result = spawnSync('node', [scriptPath, 'session-contract'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        RAILWAY_PUBLIC_API_URL: apiBaseUrl,
        EXPECTED_FRONTEND_ORIGIN: liveOrigin,
        AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: 'sysadmin',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'admin1234',
        RAILWAY_LIVE_SESSION_CONTRACT_MAX_ATTEMPTS: '2',
        RAILWAY_LIVE_SESSION_CONTRACT_RETRY_DELAY_MS: '0',
        RAILWAY_DIAGNOSTIC_OUTPUT_DIR: outputDir,
      },
    })

    expect(result.status).toBe(1)
    const report = JSON.parse(await readFile(path.join(outputDir, 'railway-live-session-contract.json'), 'utf8'))
    expect(report.status).toBe('failed')
    expect(report.retryWindow.attemptsUsed).toBe(2)
    expect(report.attempts).toHaveLength(2)
    expect(report.issues).toContain('login returned 401 instead of 200')
  })
})
