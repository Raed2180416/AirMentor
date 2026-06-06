#!/usr/bin/env node
/**
 * AirMentor Subagent Orchestrator
 * SOTA 2026: Parallel subagent spawning with task decomposition
 * Inspired by: Claude Code Dynamic Workflows, Claude Code Agent Teams, Swarms mode
 *
 * Architecture:
 *   - Task arrives → Classify complexity → Decompose into subtasks
 *   - Spawn subagents in parallel where dependencies allow
 *   - Aggregate results, resolve conflicts, synthesize final output
 *   - Track token budget per task, circuit break on overrun
 *
 * Usage: node scripts/subagent-orchestrator.mjs --task task.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const auditDir = path.join(repoRoot, '.audit')
mkdirSync(auditDir, { recursive: true })

// Token budget per task tier (in tokens)
const BUDGETS = {
  T1: 8_000,    // Simple: single file, <100 lines
  T2: 32_000,   // Standard: 2-5 files, component creation
  T3: 64_000,   // Complex: 5-15 files, cross-domain refactor
  T4: 128_000,  // Deep: architecture, multi-file redesign
}

// Max subagents per task (SOTA: 3-4 max before orchestration overhead exceeds benefit)
const MAX_SUBAGENTS = 4

// Subagent personas with specialized prompts
const PERSONAS = {
  navigator: {
    role: 'Codebase Navigator',
    strength: 'Finding files, understanding imports, mapping dependencies',
    weakness: 'Cannot write code, only navigates and reports paths',
    tier: 'T1', // Can use cheapest model
    maxTokens: 4_000,
  },
  implementer: {
    role: 'Implementation Agent',
    strength: 'Writing code, following patterns, type safety',
    weakness: 'Does not understand architecture without context',
    tier: 'T2',
    maxTokens: 16_000,
  },
  reviewer: {
    role: 'Code Reviewer',
    strength: 'Finding bugs, edge cases, style violations, security issues',
    weakness: 'Cannot write new features, only critiques existing code',
    tier: 'T1',
    maxTokens: 8_000,
  },
  tester: {
    role: 'Test Writer',
    strength: 'Writing unit tests, integration tests, edge case coverage',
    weakness: 'Needs implementation context to write meaningful tests',
    tier: 'T2',
    maxTokens: 12_000,
  },
  architect: {
    role: 'System Architect',
    strength: 'Design patterns, API design, database schema, performance',
    weakness: 'Does not write implementation details',
    tier: 'T3',
    maxTokens: 12_000,
  },
}

/**
 * Classify task complexity to determine tier and decomposition strategy
 */
function classifyTask(task) {
  const { description, files, linesOfCode } = task
  const text = (description || '').toLowerCase()
  const fileCount = files?.length || 0
  const loc = linesOfCode || 0

  // Architecture / design keywords
  if (/refactor|redesign|architecture|pattern|schema|migrate/.test(text)) {
    return { tier: 'T4', canParallel: false, needsArchitect: true, estimatedSubagents: 1 }
  }

  // Multi-file changes with clear boundaries
  if (fileCount > 5 || loc > 500) {
    return { tier: 'T3', canParallel: true, needsArchitect: false, estimatedSubagents: Math.min(3, Math.ceil(fileCount / 2)) }
  }

  // Standard multi-file
  if (fileCount > 1 || loc > 100) {
    return { tier: 'T2', canParallel: fileCount > 2, needsArchitect: false, estimatedSubagents: Math.min(2, fileCount) }
  }

  // Simple single-file
  return { tier: 'T1', canParallel: false, needsArchitect: false, estimatedSubagents: 1 }
}

/**
 * Decompose a task into subtasks based on file boundaries
 */
function decompose(task, classification) {
  const subtasks = []
  const { files = [] } = task

  // Always start with navigator for context gathering
  subtasks.push({
    id: 'navigate',
    persona: 'navigator',
    goal: `Map dependencies and exports for: ${files.join(', ')}`,
    inputs: { files },
    dependencies: [], // No deps — can run immediately
  })

  if (classification.needsArchitect) {
    subtasks.push({
      id: 'design',
      persona: 'architect',
      goal: `Design approach for: ${task.description}`,
      inputs: { description: task.description, files },
      dependencies: ['navigate'],
    })
  }

  // Group files into parallel work units
  const workUnits = chunkFiles(files, classification.estimatedSubagents)
  for (let i = 0; i < workUnits.length; i++) {
    const unit = workUnits[i]
    subtasks.push({
      id: `implement-${i}`,
      persona: 'implementer',
      goal: `Implement changes for: ${unit.join(', ')}`,
      inputs: { files: unit, description: task.description },
      dependencies: classification.needsArchitect ? ['navigate', 'design'] : ['navigate'],
    })
  }

  // Always end with review
  subtasks.push({
    id: 'review',
    persona: 'reviewer',
    goal: `Review all proposed changes for correctness and style`,
    inputs: { files, description: task.description },
    dependencies: workUnits.map((_, i) => `implement-${i}`),
  })

  return subtasks
}

function chunkFiles(files, count) {
  if (count <= 1) return [files]
  const chunks = []
  const perChunk = Math.ceil(files.length / count)
  for (let i = 0; i < files.length; i += perChunk) {
    chunks.push(files.slice(i, i + perChunk))
  }
  return chunks
}

/**
 * Circuit breaker: Check if we've exceeded budget
 */
function checkBudget(taskId, tier, spentSoFar) {
  const budget = BUDGETS[tier]
  const usage = spentSoFar / budget

  if (usage > 1.0) {
    return { action: 'HALT', reason: `Budget exceeded: ${spentSoFar}/${budget} tokens`, severity: 'critical' }
  }
  if (usage > 0.8) {
    return { action: 'WARN', reason: `Budget at 80%: ${spentSoFar}/${budget} tokens`, severity: 'warning' }
  }
  if (usage > 0.5) {
    return { action: 'LOG', reason: `Budget at 50%: ${spentSoFar}/${budget} tokens`, severity: 'info' }
  }
  return { action: 'CONTINUE', reason: 'Within budget', severity: 'ok' }
}

/**
 * Build the execution DAG from subtasks
 */
function buildDAG(subtasks) {
  const nodeMap = new Map(subtasks.map(s => [s.id, { ...s, status: 'pending', children: [] }]))

  // Build reverse edges (children)
  for (const node of nodeMap.values()) {
    for (const depId of node.dependencies) {
      const dep = nodeMap.get(depId)
      if (dep) dep.children.push(node.id)
    }
  }

  return nodeMap
}

/**
 * Execute DAG with parallel scheduling
 */
async function executeDAG(dag, taskId, tier) {
  const results = new Map()
  let spentTokens = 0
  const startTime = Date.now()
  const log = []

  function readyNodes() {
    return Array.from(dag.values()).filter(n =>
      n.status === 'pending' &&
      n.dependencies.every(d => results.has(d))
    )
  }

  while (true) {
    const ready = readyNodes()
    if (ready.length === 0) break

    // Run all ready nodes in parallel (up to MAX_SUBAGENTS)
    const batch = ready.slice(0, MAX_SUBAGENTS)
    const batchPromises = batch.map(async node => {
      node.status = 'running'
      const budgetCheck = checkBudget(taskId, tier, spentTokens)

      if (budgetCheck.action === 'HALT') {
        node.status = 'halted'
        return { id: node.id, error: budgetCheck.reason, tokens: 0 }
      }

      // In production: call API router with persona-specific prompt
      // For now: simulate with metadata
      const persona = PERSONAS[node.persona]
      const estimatedTokens = persona.maxTokens
      spentTokens += estimatedTokens

      const result = {
        id: node.id,
        persona: node.persona,
        goal: node.goal,
        tier: persona.tier,
        tokens: estimatedTokens,
        inputs: node.inputs,
        dependencies: node.dependencies,
        status: 'completed',
      }

      node.status = 'completed'
      return result
    })

    const batchResults = await Promise.all(batchPromises)
    for (const r of batchResults) {
      results.set(r.id, r)
      log.push({
        timestamp: new Date().toISOString(),
        taskId,
        subagentId: r.id,
        persona: r.persona,
        tier: r.tier,
        tokens: r.tokens,
        status: r.error ? 'error' : 'completed',
        error: r.error || null,
      })
    }
  }

  // Check for halted nodes
  const halted = Array.from(dag.values()).filter(n => n.status === 'halted')
  const failed = Array.from(dag.values()).filter(n => n.status !== 'completed' && n.status !== 'halted')

  return {
    taskId,
    tier,
    totalTokens: spentTokens,
    budget: BUDGETS[tier],
    durationMs: Date.now() - startTime,
    subagentCount: dag.size,
    completedCount: results.size,
    haltedCount: halted.length,
    failedCount: failed.length,
    results: Object.fromEntries(results),
    log,
  }
}

// Main
const taskFile = process.argv.find((_, i, arr) => arr[i - 1] === '--task')
if (!taskFile) {
  console.error('Usage: node scripts/subagent-orchestrator.mjs --task task.json')
  process.exit(1)
}

const task = JSON.parse(readFileSync(taskFile, 'utf8'))
const classification = classifyTask(task)
const subtasks = decompose(task, classification)
const dag = buildDAG(subtasks)

console.log(`Task: ${task.id || 'unknown'}`)
console.log(`Tier: ${classification.tier}`)
console.log(`Budget: ${BUDGETS[classification.tier].toLocaleString()} tokens`)
console.log(`Parallelizable: ${classification.canParallel}`)
console.log(`Subagents: ${subtasks.length}`)
console.log('')
console.log('Execution plan:')
for (const st of subtasks) {
  const deps = st.dependencies.length > 0 ? ` (after: ${st.dependencies.join(', ')})` : ' (parallel)'
  console.log(`  [${st.id}] ${st.persona}: ${st.goal}${deps}`)
}
console.log('')

const execution = await executeDAG(dag, task.id || 'unknown', classification.tier)

// Write audit log
const auditFile = path.join(auditDir, `subagent-execution-${task.id || Date.now()}.json`)
writeFileSync(auditFile, JSON.stringify(execution, null, 2))

console.log(JSON.stringify(execution, null, 2))
