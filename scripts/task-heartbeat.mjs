#!/usr/bin/env node
/**
 * AirMentor Task Heartbeat Monitor
 * SOTA 2026: Progress verification for long-running tasks before kill decision
 * Inspired by: OpenClaw HEARTBEAT.md, Hermes Agent heartbeat, Azure Monitor
 *
 * Problem: Training jobs, data generation, builds can hang silently for hours
 * Solution: Periodic heartbeat checks with progress verification
 *
 * Usage:
 *   node scripts/task-heartbeat.mjs --start --task training-job-123 --pid 45678 --check-interval 30
 *   node scripts/task-heartbeat.mjs --check --task training-job-123
 *   node scripts/task-heartbeat.mjs --stop --task training-job-123
 */

import { execSync, spawn } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
  readdirSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const heartbeatDir = path.join(repoRoot, '.audit', 'heartbeats')
mkdirSync(heartbeatDir, { recursive: true })

// Config
const DEFAULT_CHECK_INTERVAL_SEC = 30
const DEFAULT_STALL_THRESHOLD_SEC = 120  // Kill if no progress for 2 min
const DEFAULT_MAX_RUNTIME_SEC = 3600     // Hard kill after 1 hour

function getStateFile(taskId) {
  return path.join(heartbeatDir, `${taskId}.json`)
}

function loadState(taskId) {
  const file = getStateFile(taskId)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch { return null }
}

function saveState(taskId, state) {
  writeFileSync(getStateFile(taskId), JSON.stringify(state, null, 2))
}

/**
 * Extract progress indicators from a process
 * Returns metrics that prove the task is still making progress
 */
function checkProgress(taskId, pid, taskType) {
  const state = loadState(taskId) || {
    taskId,
    pid,
    taskType,
    startedAt: new Date().toISOString(),
    lastCheckAt: null,
    lastProgressAt: null,
    checks: [],
    progressLog: [],
    status: 'running',
  }

  const now = Date.now()
  const check = {
    timestamp: new Date().toISOString(),
    pidExists: false,
    cpuPercent: 0,
    memoryMB: 0,
    outputChanged: false,
    progressDetected: false,
    logTail: '',
  }

  // 1. Check if PID still exists
  try {
    process.kill(pid, 0) // Signal 0 = existence check
    check.pidExists = true
  } catch {
    check.pidExists = false
  }

  if (!check.pidExists) {
    state.status = 'exited'
    state.checks.push(check)
    saveState(taskId, state)
    return { status: 'exited', reason: 'Process no longer exists', state }
  }

  // 2. Check CPU usage (proof of activity)
  try {
    const psOutput = execSync(`ps -p ${pid} -o %cpu,%mem,rss,etime --no-headers`, { encoding: 'utf8', timeout: 5000 })
    const parts = psOutput.trim().split(/\s+/)
    check.cpuPercent = parseFloat(parts[0]) || 0
    check.memoryMB = Math.round((parseInt(parts[2]) || 0) / 1024)
  } catch {
    // Process may have exited between checks
  }

  // 3. Check output file growth (log tail)
  const logFile = path.join(repoRoot, '.audit', `${taskId}.log`)
  if (existsSync(logFile)) {
    const stats = statSync(logFile)
    const lastSize = state.lastLogSize || 0
    check.outputChanged = stats.size > lastSize
    state.lastLogSize = stats.size

    // Read tail for progress keywords
    try {
      const tail = execSync(`tail -c 2000 ${logFile}`, { encoding: 'utf8' })
      check.logTail = tail.slice(-500)

      // Detect progress keywords
      const progressPatterns = [
        /epoch\s+\d+\s*\/\s*\d+/i,           // ML training
        /step\s+\d+\s*\/\s*\d+/i,             // Training steps
        /batch\s+\d+\s*\/\s*\d+/i,            // Batch processing
        /progress[:\s]+\d+[%\s]/i,           // Generic progress
        /completed?[:\s]+\d+\s*\/\s*\d+/i,     // Completion count
        /processed[:\s]+\d+/i,                // Items processed
        /generat(?:ing|ed)[:\s]+\d+/i,        // Generation count
        /saved\s+to/i,                        // File saved
        /writing\s+row/i,                     // Data writing
        /\d+\.?\d*%\s*complete/i,            // Percentage
      ]

      check.progressDetected = progressPatterns.some(p => p.test(tail))
    } catch {}
  }

  // 4. Check output directory for new files (for data generation)
  const outputDir = taskType === 'data-generation' ? path.join(repoRoot, 'air-mentor-api', 'output') : null
  if (outputDir && existsSync(outputDir)) {
    const files = readdirSync(outputDir)
    const newestFile = files
      .map(f => ({ name: f, mtime: statSync(path.join(outputDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]

    if (newestFile) {
      const lastFileTime = state.lastOutputFileTime || 0
      if (newestFile.mtime > lastFileTime) {
        check.outputChanged = true
        check.progressDetected = true
        state.lastOutputFileTime = newestFile.mtime
      }
    }
  }

  // Determine if task is making progress
  const hasProgress = check.progressDetected || check.outputChanged || check.cpuPercent > 1.0

  if (hasProgress) {
    state.lastProgressAt = new Date().toISOString()
    state.progressLog.push({
      at: new Date().toISOString(),
      cpu: check.cpuPercent,
      memory: check.memoryMB,
      indicator: check.progressDetected ? 'progress_keyword' : check.outputChanged ? 'output_growth' : 'cpu_activity',
    })
    // Trim progress log to last 50 entries
    if (state.progressLog.length > 50) state.progressLog = state.progressLog.slice(-50)
  }

  state.lastCheckAt = new Date().toISOString()
  state.checks.push(check)

  // Trim checks to last 100
  if (state.checks.length > 100) state.checks = state.checks.slice(-100)

  // STALL DETECTION
  const lastProgressTime = state.lastProgressAt ? new Date(state.lastProgressAt).getTime() : now
  const timeSinceProgress = (now - lastProgressTime) / 1000
  const runtime = (now - new Date(state.startedAt).getTime()) / 1000

  // Decision logic
  if (timeSinceProgress > DEFAULT_STALL_THRESHOLD_SEC) {
    state.status = 'stalled'
    saveState(taskId, state)
    return {
      status: 'stalled',
      reason: `No progress detected for ${Math.round(timeSinceProgress)}s (threshold: ${DEFAULT_STALL_THRESHOLD_SEC}s)`,
      recommendation: 'KILL_AND_RESTART',
      state,
    }
  }

  if (runtime > DEFAULT_MAX_RUNTIME_SEC) {
    state.status = 'timeout'
    saveState(taskId, state)
    return {
      status: 'timeout',
      reason: `Exceeded max runtime of ${DEFAULT_MAX_RUNTIME_SEC}s (actual: ${Math.round(runtime)}s)`,
      recommendation: 'KILL',
      state,
    }
  }

  if (!check.pidExists) {
    state.status = 'exited'
    saveState(taskId, state)
    return { status: 'exited', reason: 'Process exited', state }
  }

  state.status = 'running'
  saveState(taskId, state)
  return {
    status: 'running',
    reason: `Healthy. Last progress ${Math.round(timeSinceProgress)}s ago. CPU: ${check.cpuPercent.toFixed(1)}%.`,
    state,
  }
}

function startHeartbeat(taskId, pid, taskType, checkIntervalSec) {
  const intervalMs = (checkIntervalSec || DEFAULT_CHECK_INTERVAL_SEC) * 1000

  console.log(`Starting heartbeat monitor for task ${taskId} (PID: ${pid})`)
  console.log(`Check interval: ${checkIntervalSec || DEFAULT_CHECK_INTERVAL_SEC}s`)
  console.log(`Stall threshold: ${DEFAULT_STALL_THRESHOLD_SEC}s`)
  console.log(`Max runtime: ${DEFAULT_MAX_RUNTIME_SEC}s`)

  // Immediate first check
  const result = checkProgress(taskId, pid, taskType)
  console.log(`[${new Date().toISOString()}] ${result.status}: ${result.reason}`)

  // Periodic checks
  const interval = setInterval(() => {
    const r = checkProgress(taskId, pid, taskType)
    console.log(`[${new Date().toISOString()}] ${r.status}: ${r.reason}`)

    if (r.status === 'stalled' || r.status === 'timeout') {
      console.log(`ACTION REQUIRED: ${r.recommendation}`)
      console.log(`To kill: kill -9 ${pid}`)
      // Optionally auto-kill:
      // try { process.kill(pid, 'SIGTERM'); setTimeout(() => process.kill(pid, 'SIGKILL'), 5000) } catch {}
    }

    if (r.status === 'exited' || r.status === 'timeout') {
      clearInterval(interval)
      console.log('Heartbeat monitor stopped.')
    }
  }, intervalMs)

  // Keep process alive
  process.on('SIGINT', () => {
    clearInterval(interval)
    console.log('Heartbeat monitor interrupted.')
    process.exit(0)
  })
}

// CLI
const args = process.argv.slice(2)
const action = args[0]

if (action === '--start') {
  const taskId = args[args.indexOf('--task') + 1]
  const pid = parseInt(args[args.indexOf('--pid') + 1])
  const taskType = args[args.indexOf('--type') + 1] || 'generic'
  const interval = parseInt(args[args.indexOf('--interval') + 1]) || DEFAULT_CHECK_INTERVAL_SEC

  if (!taskId || !pid) {
    console.error('Usage: --start --task <id> --pid <pid> [--type <type>] [--interval <sec>]')
    process.exit(1)
  }

  startHeartbeat(taskId, pid, taskType, interval)
} else if (action === '--check') {
  const taskId = args[args.indexOf('--task') + 1]
  if (!taskId) {
    console.error('Usage: --check --task <id>')
    process.exit(1)
  }
  const state = loadState(taskId)
  if (!state) {
    console.log(`No heartbeat state found for ${taskId}`)
    process.exit(1)
  }
  const pid = state.pid
  const result = checkProgress(taskId, pid, state.taskType)
  console.log(JSON.stringify(result, null, 2))
} else if (action === '--status') {
  const taskId = args[args.indexOf('--task') + 1]
  if (!taskId) {
    console.error('Usage: --status --task <id>')
    process.exit(1)
  }
  const state = loadState(taskId)
  if (!state) {
    console.log(`No state for ${taskId}`)
    process.exit(1)
  }
  console.log(JSON.stringify({
    taskId: state.taskId,
    status: state.status,
    pid: state.pid,
    startedAt: state.startedAt,
    lastCheckAt: state.lastCheckAt,
    lastProgressAt: state.lastProgressAt,
    checkCount: state.checks?.length || 0,
    progressEvents: state.progressLog?.length || 0,
  }, null, 2))
} else if (action === '--list') {
  const files = readdirSync(heartbeatDir).filter(f => f.endsWith('.json'))
  console.log('Active heartbeat monitors:')
  for (const f of files) {
    const state = JSON.parse(readFileSync(path.join(heartbeatDir, f), 'utf8'))
    console.log(`  ${state.taskId}: ${state.status} (PID: ${state.pid}, started: ${state.startedAt})`)
  }
} else {
  console.log(`AirMentor Task Heartbeat Monitor

Usage:
  --start --task <id> --pid <pid> [--type <type>] [--interval <sec>]
    Start monitoring a long-running task

  --check --task <id>
    Perform a single progress check

  --status --task <id>
    Show current monitor status

  --list
    List all active monitors

Examples:
  # Monitor a Python training job
  node task-heartbeat.mjs --start --task train-v6-model --pid 12345 --type training --interval 60

  # Monitor data generation
  node task-heartbeat.mjs --start --task generate-proof-data --pid 67890 --type data-generation

Progress detection methods:
  - CPU activity (>1% = alive)
  - Log file growth (new bytes written)
  - Progress keywords in output (epoch, step, batch, progress, %)
  - Output directory file changes (mtime)

Kill conditions:
  - STALL: No progress for ${DEFAULT_STALL_THRESHOLD_SEC} seconds
  - TIMEOUT: Exceeds ${DEFAULT_MAX_RUNTIME_SEC} seconds total runtime
  - EXIT: Process no longer exists`)
}
