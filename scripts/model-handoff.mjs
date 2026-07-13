#!/usr/bin/env node
/**
 * AirMentor Model Handoff Protocol
 * SOTA 2026: Seamless context carryover when switching models mid-task
 * Inspired by: Claude Code Context Compaction API, Hermes 4-phase compression
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const handoffDir = path.join(repoRoot, '.audit', 'handoffs')
mkdirSync(handoffDir, { recursive: true })

export async function createHandoff(sessionId, opts = {}) {
  const pkg = {
    version: '2.0',
    taskState: {
      sessionId,
      handoffId: `handoff-${Date.now()}`,
      reason: opts.reason || 'unknown',
      timestamp: new Date().toISOString(),
      modelUsed: opts.modelUsed || 'unknown',
      tokensConsumed: opts.tokensConsumed || 0,
      taskDescription: opts.taskDescription || '',
      completedSteps: (opts.completedSteps || []).map(s => ({
        id: s.id, description: s.description,
        result: (s.result?.slice?.(0, 500) || s.result),
        filesModified: s.filesModified || [],
        timestamp: s.timestamp, decision: s.decision,
        rationale: s.rationale?.slice?.(0, 300),
      })),
      remainingSteps: (opts.currentPlan || []).filter(s => !(opts.completedSteps || []).find(c => c.id === s.id)),
    },
    contextDigest: {
      filesRead: (opts.filesRead || []).map(f => ({ path: f.path, purpose: f.purpose?.slice(0, 200) })),
      keyFindings: (opts.keyFindings || []).map(f => ({ finding: f.finding?.slice?.(0, 300), confidence: f.confidence })),
    },
    memorySnapshot: {
      userPreferences: (opts.keyFindings || []).filter(f => f.type === 'preference').map(f => f.finding?.slice?.(0, 200)),
      architecturalDecisions: (opts.completedSteps || []).filter(s => s.decision).map(s => s.decision),
    },
    reasoningTrace: {
      deadEnds: (opts.completedSteps || []).filter(s => s.status === 'abandoned').map(s => ({
        attempt: s.description, whyItFailed: s.failureReason?.slice?.(0, 300),
      })),
    },
    pendingActions: (opts.pendingActions || []).map(a => ({
      id: a.id, description: a.description,
      priority: a.priority || 'medium', estimatedTokens: a.estimatedTokens || 2000,
    })),
  }
  const file = path.join(handoffDir, `${pkg.taskState.handoffId}.json`)
  writeFileSync(file, JSON.stringify(pkg, null, 2))
  return { handoffId: pkg.taskState.handoffId, file, package: pkg }
}

export async function resumeWithModel(handoffId, newModel) {
  const file = path.join(handoffDir, `${handoffId}.json`)
  if (!existsSync(file)) throw new Error(`Handoff ${handoffId} not found`)
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  const { taskState, contextDigest, memorySnapshot, reasoningTrace, pendingActions } = pkg

  const lines = [`# TASK RESUMPTION HANDOFF`, ``, `**Previous model:** ${taskState.modelUsed}`, `**New model:** ${newModel}`, `**Handoff reason:** ${taskState.reason}`, `**Progress:** ${Math.round((taskState.completedSteps.length / Math.max(taskState.remainingSteps.length + taskState.completedSteps.length, 1)) * 100)}%`, ``, `## ORIGINAL TASK`, taskState.taskDescription, ``]

  if (memorySnapshot.architecturalDecisions.length) {
    lines.push(`## DECISIONS (DO NOT OVERTURN)`)
    memorySnapshot.architecturalDecisions.forEach(d => lines.push(`- ${d}`))
    lines.push(``)
  }
  if (memorySnapshot.userPreferences.length) {
    lines.push(`## USER PREFERENCES`)
    memorySnapshot.userPreferences.forEach(p => lines.push(`- ${p}`))
    lines.push(``)
  }
  if (reasoningTrace.deadEnds.length) {
    lines.push(`## FAILED ATTEMPTS (DO NOT REPEAT)`)
    reasoningTrace.deadEnds.forEach(d => lines.push(`- **${d.attempt}**: ${d.whyItFailed}`))
    lines.push(``)
  }
  if (contextDigest.filesRead.length) {
    lines.push(`## FILES ALREADY ANALYZED`)
    contextDigest.filesRead.forEach(f => lines.push(`- \`${f.path}\`: ${f.purpose}`))
    lines.push(``)
  }
  lines.push(`## COMPLETED`)
  taskState.completedSteps.forEach(s => lines.push(`- [x] ${s.description}`))
  lines.push(``)
  lines.push(`## NEXT ACTIONS (PICK UP HERE)`)
  pendingActions.forEach(a => lines.push(`- [ ] **${a.priority.toUpperCase()}**: ${a.description}`))
  lines.push(``)
  lines.push(`## INSTRUCTIONS`)
  lines.push(`1. Review above context — this is everything the previous model knew.`)
  lines.push(`2. Do NOT repeat completed steps or failed approaches.`)
  lines.push(`3. Start with the highest-priority pending action.`)
  lines.push(`4. Honor all architectural decisions and constraints.`)

  const prompt = lines.join('\n')
  return { handoffId, newModel, resumptionPrompt: prompt, nextAction: pendingActions[0] || null }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2]
  if (action === '--test') {
    const handoff = await createHandoff('test-session-123', {
      reason: 'rate_limit', modelUsed: 'claude-sonnet-4.5', tokensConsumed: 45000,
      taskDescription: 'Refactor proof-risk-model.ts for credit-based grading',
      completedSteps: [
        { id: '1', description: 'Analyzed current structure', result: 'Found 3 main functions', decision: 'Use tree bridge as primary', rationale: 'Higher AUC on validation', timestamp: new Date().toISOString() },
        { id: '2', description: 'Identified integration points', result: 'Modify buildFeatures', timestamp: new Date().toISOString() },
      ],
      currentPlan: [
        { id: '1', description: 'Analyze' }, { id: '2', description: 'Identify' },
        { id: '3', description: 'Modify buildFeatures' }, { id: '4', description: 'Add columns' },
        { id: '5', description: 'Update tests' },
      ],
      filesRead: [
        { path: 'air-mentor-api/src/lib/proof-risk-model.ts', purpose: 'Main risk scoring logic' },
        { path: 'air-mentor-api/src/adapters/simulation/msruas-proof-sandbox.ts', purpose: 'Proof sandbox' },
      ],
      keyFindings: [
        { finding: 'Current model does not weight features by credit hours', confidence: 'high' },
        { finding: 'User prefers TypeScript types over any', confidence: 'high', type: 'preference' },
      ],
      pendingActions: [
        { id: '3', description: 'Modify buildFeatures', priority: 'high' },
        { id: '4', description: 'Add credit-weighted columns', priority: 'medium' },
        { id: '5', description: 'Run benchmark', priority: 'high' },
      ],
    })
    console.log('Handoff created:', handoff.handoffId)
    const resume = await resumeWithModel(handoff.handoffId, 'gpt-4o-mini')
    console.log('\n=== RESUMPTION PROMPT ===')
    console.log(resume.resumptionPrompt)
    console.log('\nNext action:', resume.nextAction?.description)
  } else {
    console.log(`Usage: --test`)
  }
}
