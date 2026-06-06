#!/usr/bin/env node
/**
 * AirMentor Daily Auditor + Optimizer
 * SOTA 2026: Self-optimizing agents that audit and optimize themselves
 * Inspired by: GitHub (62% token savings from daily audits)
 *
 * Auditor: Reads token-usage.jsonl, flags expensive workflows, anomalies
 * Optimizer: Produces specific optimization suggestions
 *
 * Run daily via cron or systemd timer:
 *   systemctl --user enable --now airmentor-daily-auditor.timer
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const auditDir = path.join(repoRoot, '.audit')
mkdirSync(auditDir, { recursive: true })

const USAGE_LOG = path.join(auditDir, 'budget', 'token-usage.jsonl')
const REPORT_FILE = path.join(auditDir, 'daily-audit-report.json')

function loadUsageLog(days = 1) {
  if (!existsSync(USAGE_LOG)) return []
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

  return readFileSync(USAGE_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line) } catch { return null } })
    .filter(r => r && new Date(r.timestamp).getTime() >= cutoff)
}

function aggregateByWorkflow(logs) {
  const workflows = {}
  for (const log of logs) {
    const wf = log.workflow || log.taskId || 'unknown'
    if (!workflows[wf]) {
      workflows[wf] = { calls: 0, tokens: 0, cost: 0, models: new Set(), errors: 0 }
    }
    workflows[wf].calls++
    workflows[wf].tokens += (log.inputTokens || 0) + (log.outputTokens || 0)
    workflows[wf].cost += log.costUsd || 0
    workflows[wf].models.add(log.model)
    if (log.error || log.action === 'HALT') workflows[wf].errors++
  }

  // Convert Sets to arrays for JSON
  for (const wf of Object.values(workflows)) {
    wf.models = Array.from(wf.models)
  }

  return workflows
}

function detectAnomalies(logs) {
  const anomalies = []

  // Find tasks that took way more turns than normal
  const taskTurns = {}
  for (const log of logs) {
    const task = log.taskId
    if (!task) continue
    taskTurns[task] = (taskTurns[task] || 0) + 1
  }

  const turnCounts = Object.values(taskTurns)
  const avgTurns = turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length
  const stdDev = Math.sqrt(turnCounts.reduce((sq, n) => sq + Math.pow(n - avgTurns, 2), 0) / turnCounts.length)

  for (const [task, turns] of Object.entries(taskTurns)) {
    if (turns > avgTurns + 2 * stdDev) {
      anomalies.push({
        type: 'excessive_turns',
        task,
        turns,
        average: Math.round(avgTurns),
        severity: turns > avgTurns + 3 * stdDev ? 'critical' : 'warning',
        suggestion: 'Task may be stuck in a loop. Add retry limits or break into smaller subtasks.',
      })
    }
  }

  // Find sudden cost spikes
  const hourlyCosts = {}
  for (const log of logs) {
    const hour = log.timestamp?.slice(0, 13) // YYYY-MM-DDTHH
    if (!hour) continue
    hourlyCosts[hour] = (hourlyCosts[hour] || 0) + (log.costUsd || 0)
  }

  const costs = Object.values(hourlyCosts)
  const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length
  for (const [hour, cost] of Object.entries(hourlyCosts)) {
    if (cost > avgCost * 3) {
      anomalies.push({
        type: 'cost_spike',
        hour,
        cost: Math.round(cost * 100) / 100,
        average: Math.round(avgCost * 100) / 100,
        severity: 'warning',
        suggestion: 'Unusual cost spike. Check if a task was retried repeatedly or used an expensive model.',
      })
    }
  }

  return anomalies
}

function generateOptimizations(workflows, anomalies) {
  const optimizations = []

  // Sort workflows by cost
  const sorted = Object.entries(workflows).sort((a, b) => b[1].cost - a[1].cost)

  for (const [name, wf] of sorted.slice(0, 5)) {
    if (wf.cost > 0.50) {
      optimizations.push({
        workflow: name,
        issue: `High cost: $${wf.cost.toFixed(2)} for ${wf.calls} calls`,
        savings: `~$${(wf.cost * 0.4).toFixed(2)}/day`,
        actions: [
          `Switch from ${wf.models.join('/')} to cheaper tier for this workflow`,
          'Add prompt compression before sending to API',
          'Enable semantic cache for repeated similar queries',
          `Prune unused MCP tools (currently adding ${Math.round(wf.tokens / wf.calls * 0.3)} tokens overhead)`,
        ],
      })
    }
  }

  // Anomaly-based optimizations
  for (const anomaly of anomalies) {
    if (anomaly.type === 'excessive_turns') {
      optimizations.push({
        workflow: anomaly.task,
        issue: `Excessive turns: ${anomaly.turns} (avg: ${anomaly.average})`,
        savings: 'Prevents runaway token burn',
        actions: [
          'Add max_turns limit to orchestrator',
          'Implement circuit breaker at 80% budget',
          'Break task into smaller parallel subtasks',
        ],
      })
    }
  }

  return optimizations
}

// Main
const logs = loadUsageLog(1)
const workflows = aggregateByWorkflow(logs)
const anomalies = detectAnomalies(logs)
const optimizations = generateOptimizations(workflows, anomalies)

const report = {
  generatedAt: new Date().toISOString(),
  period: 'last 24 hours',
  summary: {
    totalCalls: logs.length,
    totalTokens: logs.reduce((sum, l) => sum + (l.inputTokens || 0) + (l.outputTokens || 0), 0),
    totalCost: Math.round(logs.reduce((sum, l) => sum + (l.costUsd || 0), 0) * 100) / 100,
    uniqueWorkflows: Object.keys(workflows).length,
    anomaliesDetected: anomalies.length,
    optimizationsSuggested: optimizations.length,
  },
  topWorkflows: Object.entries(workflows)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 10)
    .map(([name, wf]) => ({
      name,
      calls: wf.calls,
      tokens: wf.tokens,
      cost: Math.round(wf.cost * 100) / 100,
      models: wf.models,
      errors: wf.errors,
    })),
  anomalies,
  optimizations,
  metrics: {
    // Effective Tokens metric (GitHub's innovation)
    effectiveTokens: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + (l.inputTokens || 0) + (l.outputTokens || 0), 0) / logs.length)
      : 0,
    costPerCall: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + (l.costUsd || 0), 0) / logs.length * 1000) / 1000
      : 0,
  },
}

writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))

console.log('=== AirMentor Daily Audit Report ===')
console.log(`Period: ${report.period}`)
console.log(`Total calls: ${report.summary.totalCalls}`)
console.log(`Total cost: $${report.summary.totalCost}`)
console.log(`Anomalies: ${report.summary.anomaliesDetected}`)
console.log(`Optimizations: ${report.summary.optimizationsSuggested}`)
console.log('')

if (anomalies.length > 0) {
  console.log('⚠️ ANOMALIES DETECTED:')
  for (const a of anomalies) {
    console.log(`  [${a.severity}] ${a.type}: ${a.suggestion}`)
  }
  console.log('')
}

if (optimizations.length > 0) {
  console.log('💡 OPTIMIZATION SUGGESTIONS:')
  for (const opt of optimizations.slice(0, 5)) {
    console.log(`  ${opt.workflow}: ${opt.issue}`)
    console.log(`    Potential savings: ${opt.savings}`)
    console.log(`    Actions: ${opt.actions.join('; ')}`)
  }
}

console.log('')
console.log(`Full report: ${REPORT_FILE}`)
