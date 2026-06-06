#!/usr/bin/env node
/**
 * AirMentor Quality Benchmark Suite
 * Measures agent quality improvement over time
 * Run weekly to track: pass rate, bug catch rate, token efficiency, hallucination rate
 *
 * Usage: node scripts/quality-benchmark.mjs --baseline  (capture baseline)
 *        node scripts/quality-benchmark.mjs --compare   (compare to baseline)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const auditDir = path.join(repoRoot, '.audit')

const BASELINE_FILE = path.join(auditDir, 'quality-baseline.json')
const CURRENT_FILE = path.join(auditDir, 'quality-current.json')

// Test cases for measuring agent quality
const TEST_CASES = [
  {
    id: 'find-file',
    type: 'navigation',
    prompt: 'Find the file that contains the SystemAdminLiveApp component',
    expected: 'src/system-admin-live-app.tsx',
    weight: 1.0,
  },
  {
    id: 'find-function',
    type: 'navigation',
    prompt: 'Find the function buildAcademicBootstrap in the codebase',
    expected: 'air-mentor-api/src/modules/academic.ts',
    weight: 1.0,
  },
  {
    id: 'understand-dependency',
    type: 'reasoning',
    prompt: 'Which files import from proof-risk-model.ts?',
    expected: 'multiple',
    weight: 1.5,
  },
  {
    id: 'code-generation',
    type: 'generation',
    prompt: 'Write a TypeScript function that calculates SGPA from course marks and credits',
    criteria: ['correct formula', 'type safety', 'handles edge cases'],
    weight: 2.0,
  },
  {
    id: 'bug-fix',
    type: 'fix',
    prompt: 'Fix a potential null pointer in scoreWithTreeBridge',
    criteria: ['identifies null risk', 'adds proper guard', 'preserves existing logic'],
    weight: 2.0,
  },
  {
    id: 'refactor-suggestion',
    type: 'architecture',
    prompt: 'Suggest how to break SystemAdminLiveApp into smaller components',
    criteria: ['specific file names', 'clear responsibilities', 'preserves functionality'],
    weight: 1.5,
  },
]

function captureMetrics() {
  // In production, these would be measured from actual agent runs
  // For now, we define the measurement framework

  const metrics = {
    // From token usage logs
    totalTasks: 0,
    firstAttemptPasses: 0,
    bugsCaughtBySelfReview: 0,
    hallucinations: 0, // wrong file paths, non-existent functions

    // From deterministic index
    indexCoverage: 0, // % of files indexed
    navigationAccuracy: 0, // % of navigation queries that find correct file

    // Efficiency
    avgTokensPerTask: 0,
    toolCallReduction: 0, // % reduction in tool calls vs baseline

    // Speed
    avgTimeToSolution: 0,
  }

  // Try to load actual data
  const usageLog = path.join(auditDir, 'budget', 'token-usage.jsonl')
  if (existsSync(usageLog)) {
    const logs = readFileSync(usageLog, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)

    metrics.totalTasks = logs.length
    metrics.avgTokensPerTask = logs.length > 0
      ? logs.reduce((s, l) => s + (l.inputTokens || 0) + (l.outputTokens || 0), 0) / logs.length
      : 0
  }

  // Try to load index stats
  const indexFile = path.join(auditDir, 'deterministic-index', 'knowledge-graph.json')
  if (existsSync(indexFile)) {
    const index = JSON.parse(readFileSync(indexFile, 'utf8'))
    metrics.indexCoverage = index.summary?.filesIndexed || 0
  }

  return metrics
}

function compareToBaseline(baseline, current) {
  const changes = {}
  for (const key of Object.keys(current)) {
    if (typeof current[key] === 'number' && typeof baseline[key] === 'number') {
      const delta = current[key] - baseline[key]
      const pct = baseline[key] !== 0 ? ((delta / baseline[key]) * 100).toFixed(1) : 'N/A'
      changes[key] = {
        baseline: baseline[key],
        current: current[key],
        delta: Math.round(delta * 100) / 100,
        percentChange: pct,
        trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      }
    }
  }
  return changes
}

// Main
const action = process.argv[2]
if (action === '--baseline') {
  const metrics = captureMetrics()
  writeFileSync(BASELINE_FILE, JSON.stringify(metrics, null, 2))
  console.log('Baseline captured:', BASELINE_FILE)
  console.log(JSON.stringify(metrics, null, 2))
} else if (action === '--current') {
  const metrics = captureMetrics()
  writeFileSync(CURRENT_FILE, JSON.stringify(metrics, null, 2))
  console.log('Current metrics captured:', CURRENT_FILE)
  console.log(JSON.stringify(metrics, null, 2))
} else if (action === '--compare') {
  if (!existsSync(BASELINE_FILE)) {
    console.log('No baseline found. Run: node scripts/quality-benchmark.mjs --baseline')
    process.exit(1)
  }
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
  const current = existsSync(CURRENT_FILE)
    ? JSON.parse(readFileSync(CURRENT_FILE, 'utf8'))
    : captureMetrics()

  const comparison = compareToBaseline(baseline, current)

  console.log('=== Quality Benchmark Comparison ===')
  console.log('Metric                  Baseline    Current     Delta       Trend')
  console.log('--------------------    --------    -------     -----       -----')
  for (const [key, val] of Object.entries(comparison)) {
    const baseline = typeof val.baseline === 'number' ? val.baseline.toFixed(2) : val.baseline
    const current = typeof val.current === 'number' ? val.current.toFixed(2) : val.current
    const delta = val.delta > 0 ? `+${val.delta}` : val.delta
    const trend = val.trend === 'up' ? '▲' : val.trend === 'down' ? '▼' : '—'
    console.log(`${key.padEnd(22)} ${baseline.padStart(8)} ${current.padStart(8)} ${delta.padStart(10)} ${trend}`)
  }

  // Quality score
  const passRate = current.firstAttemptPasses / Math.max(current.totalTasks, 1)
  const bugCatchRate = current.bugsCaughtBySelfReview / Math.max(current.totalTasks, 1)
  const efficiency = 1 / Math.max(current.avgTokensPerTask, 1)
  const hallucinationRate = current.hallucinations / Math.max(current.totalTasks, 1)

  const qualityScore = (
    passRate * 40 +
    bugCatchRate * 30 +
    efficiency * 1000 * 20 +
    (1 - hallucinationRate) * 10
  )

  console.log('')
  console.log(`Quality Score: ${qualityScore.toFixed(1)}/100`)
  console.log(`  Pass rate: ${(passRate * 100).toFixed(1)}%`)
  console.log(`  Bug catch rate: ${(bugCatchRate * 100).toFixed(1)}%`)
  console.log(`  Efficiency: ${current.avgTokensPerTask.toFixed(0)} tokens/task`)
  console.log(`  Hallucination rate: ${(hallucinationRate * 100).toFixed(1)}%`)
} else if (action === '--test-cases') {
  console.log('=== Test Cases ===')
  for (const tc of TEST_CASES) {
    console.log(`[${tc.id}] ${tc.type}: ${tc.prompt}`)
    console.log(`  Weight: ${tc.weight}`)
  }
} else {
  console.log(`Usage:
  node scripts/quality-benchmark.mjs --baseline    (capture baseline)
  node scripts/quality-benchmark.mjs --current     (capture current metrics)
  node scripts/quality-benchmark.mjs --compare     (compare to baseline)
  node scripts/quality-benchmark.mjs --test-cases  (list test cases)`)
}
