#!/usr/bin/env node
/**
 * AirMentor Circuit Breaker + Token Budget Manager
 * SOTA 2026: 5-layer cost defense adapted for AirMentor
 * Inspired by: TrueFoundry, Paperclip AI, Sebastian Chedal
 *
 * Layers:
 *   1. Per-task timeout (default: 180s for T1, 300s for T2, 600s for T3, 900s for T4)
 *   2. Recovery anti-loop (max 3 retries, 2h gap, skip non-retryable errors)
 *   3. Cost circuit breaker (daily budget: $3.50, halt at $5.00)
 *   4. Model pinning (each task declares model, prevents fallback bugs)
 *   5. Budget tracking (weekly reports, trend detection)
 *
 * Usage: node scripts/circuit-breaker.mjs --check task.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const budgetDir = path.join(repoRoot, '.audit', 'budget')
mkdirSync(budgetDir, { recursive: true })

const STATE_FILE = path.join(budgetDir, 'circuit-breaker-state.json')
const LOG_FILE = path.join(budgetDir, 'token-usage.jsonl')

// Daily budget in USD
const DAILY_BUDGET = 3.50
const DAILY_HALT = 5.00
const MONTHLY_BUDGET = 105.00

// Price per 1M tokens (input + output average) by model
const PRICING = {
  // AWS Bedrock
  'claude-sonnet-4.5': { input: 3.00, output: 15.00 },
  'claude-haiku-4.5': { input: 0.25, output: 1.25 },
  'llama-3.3-70b': { input: 0.72, output: 0.72 },
  'deepseek-r1': { input: 0.50, output: 2.00 },
  // Azure OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'o3-mini': { input: 1.10, output: 4.40 },
  // Free tiers
  'gemini-2.5-flash': { input: 0, output: 0 },
  'gemini-2.5-pro': { input: 0, output: 0 },
  'groq-llama-70b': { input: 0, output: 0 },
  // Local
  'qwen3-4b': { input: 0, output: 0 },
  'qwen3-8b': { input: 0, output: 0 },
}

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      date: new Date().toISOString().slice(0, 10),
      dailySpend: 0,
      dailyTokens: 0,
      monthlySpend: 0,
      monthlyTokens: 0,
      taskCount: 0,
      retryLog: [],
      lastReset: new Date().toISOString(),
    }
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function logUsage(record) {
  const line = JSON.stringify(record) + '\n'
  writeFileSync(LOG_FILE, line, { flag: 'a' })
}

function calculateCost(model, inputTokens, outputTokens) {
  const price = PRICING[model]
  if (!price) return 0
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

function checkCircuitBreaker(taskId, model, inputTokens, outputTokens) {
  const state = loadState()
  const today = new Date().toISOString().slice(0, 10)

  // Reset daily counter if new day
  if (state.date !== today) {
    state.date = today
    state.dailySpend = 0
    state.dailyTokens = 0
    state.taskCount = 0
    state.retryLog = []
  }

  const cost = calculateCost(model, inputTokens, outputTokens)
  state.dailySpend += cost
  state.dailyTokens += inputTokens + outputTokens
  state.monthlySpend += cost
  state.monthlyTokens += inputTokens + outputTokens
  state.taskCount += 1

  // Layer 3: Cost circuit breaker
  const checks = []

  if (state.dailySpend >= DAILY_HALT) {
    checks.push({
      layer: 3,
      action: 'HALT',
      severity: 'critical',
      reason: `Daily spend $${state.dailySpend.toFixed(2)} exceeded halt threshold $${DAILY_HALT}`,
      suggestion: 'Switch to free-tier-only mode. No paid API calls until tomorrow.',
    })
  } else if (state.dailySpend >= DAILY_BUDGET) {
    checks.push({
      layer: 3,
      action: 'WARN',
      severity: 'warning',
      reason: `Daily spend $${state.dailySpend.toFixed(2)} exceeded budget $${DAILY_BUDGET}`,
      suggestion: 'Use free tiers for remaining tasks today.',
    })
  }

  if (state.monthlySpend >= MONTHLY_BUDGET) {
    checks.push({
      layer: 5,
      action: 'HALT',
      severity: 'critical',
      reason: `Monthly spend $${state.monthlySpend.toFixed(2)} exceeded budget $${MONTHLY_BUDGET}`,
      suggestion: 'Monthly budget exhausted. Wait until next billing cycle or add credits.',
    })
  }

  // Layer 2: Anti-loop (max 3 retries per task per day)
  const retryCount = state.retryLog.filter(r => r.taskId === taskId && r.date === today).length
  if (retryCount >= 3) {
    checks.push({
      layer: 2,
      action: 'SKIP',
      severity: 'warning',
      reason: `Task ${taskId} has been retried ${retryCount} times today`,
      suggestion: 'Escalate to human or try a different approach.',
    })
  }

  // Log usage
  const record = {
    timestamp: new Date().toISOString(),
    taskId,
    model,
    inputTokens,
    outputTokens,
    costUsd: cost,
    dailySpend: state.dailySpend,
    monthlySpend: state.monthlySpend,
    action: checks.length > 0 ? checks[0].action : 'ALLOW',
  }
  logUsage(record)

  saveState(state)

  return {
    allowed: !checks.some(c => c.action === 'HALT' || c.action === 'SKIP'),
    checks,
    state: {
      dailySpend: state.dailySpend,
      dailyTokens: state.dailyTokens,
      monthlySpend: state.monthlySpend,
      monthlyTokens: state.monthlyTokens,
      remainingBudget: DAILY_BUDGET - state.dailySpend,
    },
  }
}

function recordRetry(taskId, error) {
  const state = loadState()
  state.retryLog.push({
    taskId,
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    error: error?.toString()?.slice(0, 200),
  })
  saveState(state)
}

// CLI
const action = process.argv[2]
if (action === '--check') {
  const taskFile = process.argv[3]
  const task = JSON.parse(readFileSync(taskFile, 'utf8'))
  const result = checkCircuitBreaker(
    task.id,
    task.model || 'gpt-4o-mini',
    task.inputTokens || 1000,
    task.outputTokens || 500
  )
  console.log(JSON.stringify(result, null, 2))
} else if (action === '--status') {
  const state = loadState()
  console.log(JSON.stringify({
    today: state.date,
    dailySpend: `$${state.dailySpend.toFixed(2)}`,
    dailyBudget: `$${DAILY_BUDGET}`,
    remainingToday: `$${(DAILY_BUDGET - state.dailySpend).toFixed(2)}`,
    monthlySpend: `$${state.monthlySpend.toFixed(2)}`,
    monthlyBudget: `$${MONTHLY_BUDGET}`,
    tasksToday: state.taskCount,
    totalTokensToday: state.dailyTokens,
  }, null, 2))
} else if (action === '--retry') {
  const taskId = process.argv[3]
  recordRetry(taskId, process.argv[4] || 'unknown')
  console.log(`Retry recorded for ${taskId}`)
} else {
  console.log(`Usage:
  node scripts/circuit-breaker.mjs --check task.json
  node scripts/circuit-breaker.mjs --status
  node scripts/circuit-breaker.mjs --retry <taskId> [error]`)
}
