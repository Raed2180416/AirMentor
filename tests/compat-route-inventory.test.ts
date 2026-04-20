import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = path.join(process.cwd(), 'scripts/report-compat-route-callers.mjs')

describe('compatibility route inventory', () => {
  it('reports no first-party runtime callers and passes strict mode', { timeout: 15_000 }, () => {
    const stdout = execFileSync('node', [scriptPath, '--json', '--assert-runtime-clean'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    const report = JSON.parse(stdout) as {
      runtimeCallerCount: number
      findings: Array<{ route: string; runtimeCallers: Array<{ path: string; line: number }> }>
    }

    expect(report.runtimeCallerCount).toBe(0)
    expect(report.findings.every(item => item.runtimeCallers.length === 0)).toBe(true)
  })
})
