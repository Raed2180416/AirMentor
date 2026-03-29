import { spawnSync } from 'node:child_process'
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

afterEach(async () => {
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
})
