#!/usr/bin/env node
/**
 * AirMentor Self-Consistency Voter
 * SOTA 2026: Majority voting across N model completions for higher accuracy
 * Inspired by: Self-Consistency Improves Chain of Thought Reasoning in Language Models (Wang et al.)
 * Usage: N=3-5 samples at different temperatures, pick most common answer
 *
 * Usage with API router:
 *   node scripts/self-consistency-voter.mjs --samples 5 --prompt "task.json"
 */

import { readFileSync } from 'node:fs'

const samples = parseInt(process.argv.find((_, i, arr) => arr[i - 1] === '--samples')?.replace(/^--samples=/, '') || '3')
const promptFile = process.argv.find((_, i, arr) => arr[i - 1] === '--prompt')

if (!promptFile) {
  console.error('Usage: node scripts/self-consistency-voter.mjs --samples 5 --prompt task.json')
  process.exit(1)
}

const task = JSON.parse(readFileSync(promptFile, 'utf8'))

/**
 * Normalize a code snippet for comparison:
 * - Remove comments
 * - Normalize whitespace
 * - Sort import statements
 * - Normalize quotes
 */
function normalizeCode(code) {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/['"]([^'"]*)['"]/g, '"$1"')
    .replace(/;\s*}/g, '}')
    .trim()
    .toLowerCase()
}

/**
 * Extract the core "answer" from a completion.
 * For code: the code block between ``` markers
 * For text: the last paragraph (usually the conclusion)
 */
function extractAnswer(completion) {
  // Try code block
  const codeMatch = completion.match(/```(?:\w+)?\n([\s\S]*?)```/)
  if (codeMatch) return normalizeCode(codeMatch[1])

  // Try last paragraph
  const paragraphs = completion.split('\n\n').filter(p => p.trim())
  return paragraphs[paragraphs.length - 1]?.trim().toLowerCase() || completion.trim().toLowerCase()
}

/**
 * Simple string similarity (Levenshtein-based proxy)
 */
function similarity(a, b) {
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1.0
  const diff = longer.split('').filter((c, i) => c !== (shorter[i] || '')).length
  return 1 - diff / longer.length
}

/**
 * Cluster completions by similarity and pick the largest cluster
 */
function majorityVote(completions) {
  const answers = completions.map(extractAnswer)

  // Greedy clustering
  const clusters = []
  for (const answer of answers) {
    let found = false
    for (const cluster of clusters) {
      if (similarity(answer, cluster.representative) > 0.85) {
        cluster.members.push(answer)
        found = true
        break
      }
    }
    if (!found) {
      clusters.push({ representative: answer, members: [answer] })
    }
  }

  clusters.sort((a, b) => b.members.length - a.members.length)
  const winner = clusters[0]

  return {
    winner: winner.representative,
    confidence: winner.members.length / answers.length,
    voteDistribution: clusters.map(c => ({
      size: c.members.length,
      representative: c.representative.slice(0, 200),
    })),
    rawCompletions: completions,
  }
}

// Simulate voting (in production, this would call the API router N times)
// For now, this is the voting algorithm that the orchestrator will use
console.log(JSON.stringify({
  schemaVersion: 'airmentor-self-consistency-v1',
  task: task.id || 'unknown',
  samplesRequested: samples,
  algorithm: 'greedy-similarity-clustering',
  similarityThreshold: 0.85,
  note: 'This voter is designed to be called by the orchestrator after sampling N completions from the API router.',
  usage: 'The orchestrator should: 1) Call API with temperature=0.7 for N samples, 2) Pass completions here, 3) Use winner with confidence>0.5, 4) If confidence<0.5, escalate to higher tier.',
}, null, 2))
