import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const commonPath = path.join(process.cwd(), 'scripts/live-admin-common.sh')

describe('live-admin-common.sh', () => {
  it('injects deterministic seeded credentials for local wrappers', () => {
    const result = spawnSync('bash', ['-lc', `source "${commonPath}"; unset AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD; AIRMENTOR_LIVE_STACK=0; ensure_system_admin_live_credentials; printf '%s\\n%s\\n' "$AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER" "$AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD"`], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    })

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('sysadmin\nadmin1234')
  })

  it('fails fast for live wrappers when canonical credentials are missing', () => {
    const result = spawnSync('bash', ['-lc', `source "${commonPath}"; unset AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD; AIRMENTOR_LIVE_STACK=1; ensure_system_admin_live_credentials`], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER and AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD are required')
  })
})
