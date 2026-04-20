import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const workspaceRootDir = path.resolve(rootDir, '..')
const testsDir = path.join(rootDir, 'tests')
const passThroughArgs = process.argv.slice(2)
const explicitFileArgs = passThroughArgs.filter(arg => /\.test\.tsx?$/.test(arg))
const passThroughArgsWithoutFiles = passThroughArgs.filter(arg => !/\.test\.tsx?$/.test(arg))
const suite = process.env.AIRMENTOR_BACKEND_SUITE === 'proof-rc' ? 'proof-rc' : 'fast'
const proofRcFiles = new Set([
  path.join(testsDir, 'hod-proof-analytics.test.ts'),
  path.join(testsDir, 'risk-explorer.test.ts'),
  path.join(testsDir, 'student-agent-shell.test.ts'),
])

function resolveVitestEntrypoint() {
  const candidates = [
    path.join(rootDir, 'node_modules', '.bin', 'vitest'),
    path.join(workspaceRootDir, 'node_modules', '.bin', 'vitest'),
    path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs'),
    path.join(workspaceRootDir, 'node_modules', 'vitest', 'vitest.mjs'),
  ]
  const resolved = candidates.find(candidate => existsSync(candidate))
  if (!resolved) {
    throw new Error(`Could not find a Vitest entrypoint. Checked: ${candidates.join(', ')}`)
  }
  return resolved
}

const vitestEntrypoint = resolveVitestEntrypoint()

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectTestFiles(fullPath)
    if (entry.isFile() && entry.name.endsWith('.test.ts')) return [fullPath]
    return []
  }))
  return nested.flat().sort((left, right) => left.localeCompare(right))
}

function runVitestFile(file) {
  return new Promise((resolve) => {
    const start = Date.now()
    const child = spawn(vitestEntrypoint, ['run', file, ...passThroughArgsWithoutFiles], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        AIRMENTOR_TELEMETRY_ENABLED: process.env.AIRMENTOR_TELEMETRY_ENABLED ?? 'false',
        AIRMENTOR_PROOF_RC: suite === 'proof-rc' ? '1' : '0',
      },
      stdio: 'inherit',
    })
    child.on('error', (error) => {
      resolve({
        file,
        code: 1,
        durationMs: Date.now() - start,
        signal: null,
        error,
      })
    })
    child.on('exit', (code, signal) => {
      resolve({
        file,
        code: code ?? (signal ? 1 : 0),
        durationMs: Date.now() - start,
        signal: signal ?? null,
        error: null,
      })
    })
  })
}

function formatDuration(durationMs) {
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(2)}s`
}

const allFiles = await collectTestFiles(testsDir)
const selectedFiles = explicitFileArgs.length > 0
  ? explicitFileArgs.map(file => (path.isAbsolute(file) ? file : path.resolve(rootDir, file)))
  : (suite === 'proof-rc'
    ? allFiles
    : allFiles.filter(file => !proofRcFiles.has(file)))

if (selectedFiles.length === 0) {
  console.error(`[air-mentor-api] No test files selected for suite ${suite}.`)
  process.exit(1)
}

console.log(`[air-mentor-api] Running ${suite} backend suite across ${selectedFiles.length} test files.`)

const timings = []
for (const file of selectedFiles) {
  console.log(`\n[air-mentor-api] -> ${path.relative(rootDir, file)}`)
  const result = await runVitestFile(file)
  timings.push(result)
  console.log(`[air-mentor-api] <- ${path.relative(rootDir, file)} in ${formatDuration(result.durationMs)}`)
  if (result.code !== 0) {
    console.error(`[air-mentor-api] Test file failed: ${path.relative(rootDir, file)}${result.signal ? ` (signal ${result.signal})` : ''}${result.error ? ` (${result.error.message})` : ''}`)
    break
  }
}

console.log('\n[air-mentor-api] Per-file timings')
timings
  .slice()
  .sort((left, right) => right.durationMs - left.durationMs)
  .forEach(result => {
    console.log(`- ${path.relative(rootDir, result.file)} :: ${formatDuration(result.durationMs)}`)
  })

const failed = timings.find(result => result.code !== 0)
if (failed) process.exit(failed.code)
