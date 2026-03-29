import { spawnSync } from 'node:child_process'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = path.join(process.cwd(), 'scripts/verify-final-closeout-live.sh')
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function makeStubBinDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'airmentor-closeout-live-'))
  tempDirs.push(dir)
  const logPath = path.join(dir, 'npm-log.jsonl')
  const npmStubPath = path.join(dir, 'npm')
  await writeFile(
    npmStubPath,
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs')",
      "const args = process.argv.slice(2)",
      "const record = {",
      '  args,',
      '  expectedFrontendOrigin: process.env.EXPECTED_FRONTEND_ORIGIN ?? null,',
      '  railwayPublicApiUrl: process.env.RAILWAY_PUBLIC_API_URL ?? null,',
      '  syncRailwayServiceVars: process.env.SYNC_RAILWAY_SERVICE_VARS ?? null,',
      '  liveSystemAdminIdentifier: process.env.AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER ?? null,',
      '  liveSystemAdminPasswordPresent: Boolean(process.env.AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD),',
      '  liveStack: process.env.AIRMENTOR_LIVE_STACK ?? null,',
      '  railwayService: process.env.RAILWAY_SERVICE ?? null,',
      '  railwayTokenPresent: Boolean(process.env.RAILWAY_TOKEN),',
      '  railwayVariablesJsonPresent: Boolean(process.env.RAILWAY_VARIABLES_JSON),',
      '}',
      "fs.appendFileSync(process.env.AIRMENTOR_NPM_STUB_LOG, `${JSON.stringify(record)}\\n`, 'utf8')",
      "if (process.env.AIRMENTOR_NPM_FAIL_PREFLIGHT === '1' && args.includes('deploy:railway:preflight')) {",
      "  console.error('Simulated Railway preflight failure')",
      '  process.exit(13)',
      '}',
      "console.log(`npm ${args.join(' ')}`)",
    ].join('\n'),
    'utf8',
  )
  await chmod(npmStubPath, 0o755)
  return { dir, logPath }
}

async function readStubLog(logPath: string) {
  const raw = await readFile(logPath, 'utf8')
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as {
      args: string[]
      expectedFrontendOrigin: string | null
      railwayPublicApiUrl: string | null
      syncRailwayServiceVars: string | null
      liveSystemAdminIdentifier: string | null
      liveSystemAdminPasswordPresent: boolean
      liveStack: string | null
      railwayService: string | null
      railwayTokenPresent: boolean
      railwayVariablesJsonPresent: boolean
    })
}

describe('verify-final-closeout-live wrapper', () => {
  it('fails fast when live system-admin credentials are missing', async () => {
    const { dir, logPath } = await makeStubBinDir()
    const result = spawnSync('bash', [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        PLAYWRIGHT_APP_URL: 'https://raed2180416.github.io/AirMentor/',
        PLAYWRIGHT_API_URL: 'https://api-production-ab72.up.railway.app/',
        PATH: `${dir}:${process.env.PATH}`,
        AIRMENTOR_NPM_STUB_LOG: logPath,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER and AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD are required')
  })

  it('skips Railway preflight when Railway auth/context is unavailable', async () => {
    const { dir, logPath } = await makeStubBinDir()
    const result = spawnSync('bash', [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        PLAYWRIGHT_APP_URL: 'https://raed2180416.github.io/AirMentor/',
        PLAYWRIGHT_API_URL: 'https://api-production-ab72.up.railway.app/',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: 'railway.sysadmin',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'railway-secret',
        PATH: `${dir}:${process.env.PATH}`,
        AIRMENTOR_NPM_STUB_LOG: logPath,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Skipping Railway deploy preflight because Railway auth/context is not configured.')

    const calls = await readStubLog(logPath)
    expect(calls.map(call => call.args.join(' '))).toEqual([
      'run inventory:compat-routes -- --assert-runtime-clean',
      '--workspace air-mentor-api run verify:live-session-contract',
      'run verify:proof-closure:live',
      'run playwright:admin-live:acceptance',
      'run playwright:admin-live:request-flow',
      'run playwright:admin-live:teaching-parity',
      'run playwright:admin-live:accessibility-regression',
      'run playwright:admin-live:keyboard-regression',
      'run playwright:admin-live:session-security',
    ])
    expect(calls[1]).toMatchObject({
      liveSystemAdminIdentifier: 'railway.sysadmin',
      liveSystemAdminPasswordPresent: true,
    })
  })

  it('runs Railway preflight before the live verification chain and auto-enables sync when a CSRF secret is present', async () => {
    const { dir, logPath } = await makeStubBinDir()
    const result = spawnSync('bash', [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        PLAYWRIGHT_APP_URL: 'https://raed2180416.github.io/AirMentor/',
        PLAYWRIGHT_API_URL: 'https://api-production-ab72.up.railway.app/',
        RAILWAY_TOKEN: 'railway-token',
        RAILWAY_SERVICE: 'air-mentor-api',
        RAILWAY_CSRF_SECRET: 'csrf-secret',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: 'railway.sysadmin',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'railway-secret',
        PATH: `${dir}:${process.env.PATH}`,
        AIRMENTOR_NPM_STUB_LOG: logPath,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Running Railway deploy preflight before live closeout verification...')

    const calls = await readStubLog(logPath)
    expect(calls.map(call => call.args.join(' '))).toEqual([
      'run inventory:compat-routes -- --assert-runtime-clean',
      '--workspace air-mentor-api run deploy:railway:preflight',
      '--workspace air-mentor-api run verify:live-session-contract',
      'run verify:proof-closure:live',
      'run playwright:admin-live:acceptance',
      'run playwright:admin-live:request-flow',
      'run playwright:admin-live:teaching-parity',
      'run playwright:admin-live:accessibility-regression',
      'run playwright:admin-live:keyboard-regression',
      'run playwright:admin-live:session-security',
    ])
    expect(calls[1]).toMatchObject({
      expectedFrontendOrigin: 'https://raed2180416.github.io',
      railwayPublicApiUrl: 'https://api-production-ab72.up.railway.app/',
      syncRailwayServiceVars: 'true',
      liveSystemAdminIdentifier: 'railway.sysadmin',
      liveSystemAdminPasswordPresent: true,
      railwayService: 'air-mentor-api',
      railwayTokenPresent: true,
    })
  })

  it('fails fast when Railway preflight fails', async () => {
    const { dir, logPath } = await makeStubBinDir()
    const result = spawnSync('bash', [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        PLAYWRIGHT_APP_URL: 'https://raed2180416.github.io/AirMentor/',
        PLAYWRIGHT_API_URL: 'https://api-production-ab72.up.railway.app/',
        RAILWAY_TOKEN: 'railway-token',
        RAILWAY_SERVICE: 'air-mentor-api',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER: 'railway.sysadmin',
        AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD: 'railway-secret',
        AIRMENTOR_NPM_FAIL_PREFLIGHT: '1',
        PATH: `${dir}:${process.env.PATH}`,
        AIRMENTOR_NPM_STUB_LOG: logPath,
      },
    })

    expect(result.status).toBe(13)

    const calls = await readStubLog(logPath)
    expect(calls.map(call => call.args.join(' '))).toEqual([
      'run inventory:compat-routes -- --assert-runtime-clean',
      '--workspace air-mentor-api run deploy:railway:preflight',
    ])
  })
})
