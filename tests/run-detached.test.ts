import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = path.join(process.cwd(), 'scripts/run-detached.sh')
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function waitForLogExit(logPath: string, expectedExit: number) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const logText = await readFile(logPath, 'utf8')
      if (logText.includes(`exit=${expectedExit}`)) {
        return logText
      }
    } catch {
      // The detached wrapper creates the log asynchronously.
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  throw new Error(`Timed out waiting for ${logPath} to contain exit=${expectedExit}`)
}

describe('run-detached wrapper', () => {
  it('records a non-zero exit line when the detached command fails', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'airmentor-detached-'))
    tempDirs.push(outputDir)

    const result = spawnSync('bash', [scriptPath, 'unit-failure', 'bash', '-lc', 'exit 7'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        DETACHED_RUN_OUTPUT_DIR: outputDir,
      },
    })

    expect(result.status).toBe(0)

    const logPath = result.stdout
      .split('\n')
      .map(line => line.trim())
      .find(line => line.startsWith('log='))
      ?.slice(4)

    expect(logPath).toBeTruthy()

    const logText = await waitForLogExit(logPath ?? '', 7)
    expect(logText).toContain('command=bash -lc exit\\ 7')
    expect(logText).toContain('exit=7')
  })
})
