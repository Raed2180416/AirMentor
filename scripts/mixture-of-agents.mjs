#!/usr/bin/env node
/**
 * AirMentor Mixture of Agents (MoA)
 * SOTA 2026: Ensemble of diverse models for higher quality at lower cost
 * Inspired by: Together AI MoA (arXiv:2406.04692), MOSAIC (arXiv:2606.03014)
 *
 * Core insight: 3 diverse models voting together match GPT-4 quality at 60% cost.
 * MOSAIC adds adaptive aggregation: skip aggregator when experts agree (45% of cases).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const moaDir = path.join(repoRoot, '.audit', 'moa')
mkdirSync(moaDir, { recursive: true })

const MODEL_POOL = {
  'gemini-2.5-flash': { cost: 0, quality: 0.75 },
  'groq-llama-70b': { cost: 0, quality: 0.78 },
  'qwen3-8b-local': { cost: 0, quality: 0.72 },
  'gpt-4o-mini': { cost: 0.0003, quality: 0.82 },
  'claude-haiku-4.5': { cost: 0.0004, quality: 0.80 },
  'gpt-4o': { cost: 0.005, quality: 0.90 },
  'claude-sonnet-4.5': { cost: 0.0075, quality: 0.92 },
}

function jaccardSimilarity(a, b) {
  const sa = new Set(a.toLowerCase().split(/\s+/))
  const sb = new Set(b.toLowerCase().split(/\s+/))
  const intersection = new Set([...sa].filter(x => sb.has(x)))
  const union = new Set([...sa, ...sb])
  return union.size === 0 ? 1 : intersection.size / union.size
}

export class MixtureOfAgents {
  constructor() {
    this.stats = { calls: 0, unanimous: 0, disputed: 0, skippedAggregator: 0 }
  }

  async generate(prompt, opts = {}) {
    const experts = opts.experts || ['gemini-2.5-flash', 'groq-llama-70b', 'qwen3-8b-local']
    const aggregator = opts.aggregator || 'gpt-4o-mini'
    const confidenceThreshold = opts.confidenceThreshold || 0.66 // MOSAIC: gate 2:1 and 3:0
    const simulate = opts.simulate !== false

    // 1. Dispatch to experts in parallel
    const expertResults = await Promise.all(experts.map(async model => {
      // Simulate or call real API
      let response
      if (simulate) {
        response = await this.simulateExpert(model, prompt)
      } else {
        response = await this.callModel(model, prompt)
      }
      return { model, response, quality: MODEL_POOL[model]?.quality || 0.5 }
    }))

    // 2. Measure inter-expert agreement (confidence gate)
    const answers = expertResults.map(r => r.response)
    const voteCounts = {}
    for (const ans of answers) {
      // Group by similarity (not exact match — allows paraphrasing)
      let found = false
      for (const key of Object.keys(voteCounts)) {
        if (jaccardSimilarity(ans, key) > 0.7) {
          voteCounts[key].count++
          voteCounts[key].models.push(expertResults.find(r => r.response === ans)?.model)
          found = true
          break
        }
      }
      if (!found) voteCounts[ans] = { count: 1, models: [expertResults.find(r => r.response === ans)?.model] }
    }

    const votes = Object.entries(voteCounts).sort((a, b) => b[1].count - a[1].count)
    const topVote = votes[0]
    const confidence = topVote[1].count / answers.length
    const isUnanimous = confidence >= 1.0
    const isHighAgreement = confidence >= confidenceThreshold // 2:1 or 3:0

    this.stats.calls++

    // 3. Adaptive aggregation: skip if high agreement
    if (isHighAgreement) {
      this.stats.skippedAggregator++
      if (isUnanimous) this.stats.unanimous++
      return {
        result: topVote[0],
        confidence,
        votes: topVote[1],
        experts: expertResults.map(r => ({ model: r.model, response: r.response.slice(0, 100) })),
        aggregatorSkipped: true,
        cost: expertResults.reduce((s, r) => s + (MODEL_POOL[r.model]?.cost || 0), 0),
        _stats: this.stats,
      }
    }

    // 4. Low agreement → use aggregator
    this.stats.disputed++
    const aggregatorPrompt = `Expert responses to: "${prompt.slice(0, 200)}"\n\n` +
      expertResults.map((r, i) => `Expert ${i+1} (${r.model}): ${r.response.slice(0, 500)}`).join('\n\n') +
      `\n\nSynthesize the best answer from these experts. Resolve disagreements.`

    let aggregatorResponse
    if (simulate) {
      aggregatorResponse = `[AGGREGATED] ${topVote[0]} (improved based on ${votes.length} viewpoints)`
    } else {
      aggregatorResponse = await this.callModel(aggregator, aggregatorPrompt)
    }

    return {
      result: aggregatorResponse,
      confidence,
      experts: expertResults.map(r => ({ model: r.model, response: r.response.slice(0, 100) })),
      aggregatorUsed: true,
      aggregatorModel: aggregator,
      cost: expertResults.reduce((s, r) => s + (MODEL_POOL[r.model]?.cost || 0), 0) + (MODEL_POOL[aggregator]?.cost || 0),
      _stats: this.stats,
    }
  }

  async simulateExpert(model, prompt) {
    // Deterministic simulation based on model quality
    const quality = MODEL_POOL[model]?.quality || 0.5
    const taskType = prompt.toLowerCase()

    if (taskType.includes('code') || taskType.includes('function') || taskType.includes('refactor')) {
      if (quality > 0.85) return `Implement using TypeScript with strict types. Add null guards. Extract helper functions. Here's the code...`
      if (quality > 0.75) return `Use TypeScript. Handle edge cases. Add basic types.`
      return `Write a function. Basic implementation.`
    }
    if (taskType.includes('bug') || taskType.includes('fix')) {
      if (quality > 0.85) return `Root cause: null dereference in line 42. Fix: add optional chaining. Add test for edge case.`
      if (quality > 0.75) return `There's a null issue. Add a check.`
      return `Fix the bug.`
    }
    if (quality > 0.85) return `Detailed analysis with specific recommendations and code examples.`
    if (quality > 0.75) return `Good analysis with main points covered.`
    return `Basic answer.`
  }

  async callModel(model, prompt) {
    // Hook for real API calls
    throw new Error(`Real API not configured. Use simulate=true or implement callModel()`)
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const moa = new MixtureOfAgents()

  async function test() {
    console.log('=== MoA Test: Coding Task ===')
    const r1 = await moa.generate('Write a function to calculate SGPA from course marks and credits', { simulate: true })
    console.log('Result:', r1.result.slice(0, 80))
    console.log('Confidence:', r1.confidence)
    console.log('Aggregator skipped:', r1.aggregatorSkipped)
    console.log('Cost:', r1.cost)
    console.log('')

    console.log('=== MoA Test: Bug Fix ===')
    const r2 = await moa.generate('Fix the null pointer bug in the risk scoring function', { simulate: true })
    console.log('Result:', r2.result.slice(0, 80))
    console.log('Confidence:', r2.confidence)
    console.log('Aggregator skipped:', r2.aggregatorSkipped)
    console.log('')

    console.log('=== MoA Stats ===')
    console.log(JSON.stringify(moa.stats, null, 2))
  }

  test()
}
