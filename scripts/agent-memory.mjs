#!/usr/bin/env node
/**
 * AirMentor Agent Memory
 * SOTA 2026: Persistent cross-session memory with entity linking
 * Inspired by: Mem0 (multi-scope memory, graph memory, actor-aware memory)
 *
 * Four-scope memory model:
 *   - user_id: persists across all sessions
 *   - agent_id: per-agent instance
 *   - session_id: single conversation/workflow
 *   - org_id: shared organizational context
 *
 * Features:
 *   - Multi-signal retrieval: semantic similarity + BM25 keyword + entity linking
 *   - Actor-aware: tracks who said what (user vs agent)
 *   - Metadata filtering: filter by context tags
 *
 * Usage:
 *   const memory = new AgentMemory({ userId: 'user-1', agentId: 'coder-1' });
 *   memory.add("User prefers TypeScript over Python", { context: 'preference' });
 *   const results = memory.search("programming language preference");
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const memoryDir = path.join(repoRoot, '.audit', 'memory')
mkdirSync(memoryDir, { recursive: true })

// Simple BM25-like scoring
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
}

function bm25Score(queryTokens, docTokens, k1 = 1.5, b = 0.75) {
  const docLen = docTokens.length
  const avgDocLen = docLen // Simplified: use doc length as avg
  const docFreq = {}
  for (const t of docTokens) docFreq[t] = (docFreq[t] || 0) + 1

  let score = 0
  for (const qt of queryTokens) {
    const freq = docFreq[qt] || 0
    if (freq === 0) continue
    const idf = Math.log(1 + (1 / (freq + 0.5))) // Simplified IDF
    score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (docLen / avgDocLen))))
  }
  return score
}

// Trigram embedding (same as semantic cache)
function embed(text, dim = 128) {
  const vector = new Array(dim).fill(0)
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.slice(i, i + 3)
    let hash = 0
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash) + trigram.charCodeAt(j)
      hash |= 0
    }
    const idx = Math.abs(hash) % dim
    vector[idx] += 1
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) return vector.map(v => v / magnitude)
  return vector
}

function cosineSimilarity(a, b) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

function extractEntities(text) {
  // Simple entity extraction: proper nouns, quoted strings, code identifiers
  const entities = []

  // Quoted strings
  const quoted = text.match(/"([^"]+)"/g)
  if (quoted) entities.push(...quoted.map(q => q.slice(1, -1)))

  // CamelCase / PascalCase identifiers
  const identifiers = text.match(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g)
  if (identifiers) entities.push(...identifiers)

  // File paths
  const paths = text.match(/\b[a-zA-Z0-9_-]+\.[a-zA-Z]{2,6}\b/g)
  if (paths) entities.push(...paths)

  // Key terms (capitalized phrases)
  const keyTerms = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
  if (keyTerms) entities.push(...keyTerms)

  return [...new Set(entities)].slice(0, 20)
}

class AgentMemory {
  constructor({ userId = 'default', agentId = 'default', sessionId = null, orgId = null } = {}) {
    this.userId = userId
    this.agentId = agentId
    this.sessionId = sessionId || `session-${Date.now()}`
    this.orgId = orgId

    this.storeFile = path.join(memoryDir, `memory-${userId}.json`)
    this.entityFile = path.join(memoryDir, `entities-${userId}.json`)

    this.memories = []
    this.entities = new Map()

    this.load()
  }

  load() {
    if (existsSync(this.storeFile)) {
      try {
        this.memories = JSON.parse(readFileSync(this.storeFile, 'utf8'))
      } catch { this.memories = [] }
    }
    if (existsSync(this.entityFile)) {
      try {
        const data = JSON.parse(readFileSync(this.entityFile, 'utf8'))
        this.entities = new Map(Object.entries(data))
      } catch { this.entities = new Map() }
    }
  }

  save() {
    writeFileSync(this.storeFile, JSON.stringify(this.memories, null, 2))
    writeFileSync(this.entityFile, JSON.stringify(Object.fromEntries(this.entities), null, 2))
  }

  add(content, metadata = {}) {
    const memory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      embedding: embed(content),
      entities: extractEntities(content),
      metadata: {
        ...metadata,
        userId: this.userId,
        agentId: this.agentId,
        sessionId: this.sessionId,
        orgId: this.orgId,
        actor: metadata.actor || 'user',
        timestamp: new Date().toISOString(),
      },
    }

    // Store entities for linking
    for (const entity of memory.entities) {
      if (!this.entities.has(entity)) this.entities.set(entity, [])
      this.entities.get(entity).push(memory.id)
    }

    this.memories.push(memory)

    // Prune to last 500 memories per user
    if (this.memories.length > 500) {
      const removed = this.memories.shift()
      // Clean up entity references
      for (const entity of removed.entities) {
        const refs = this.entities.get(entity)
        if (refs) {
          const filtered = refs.filter(id => id !== removed.id)
          if (filtered.length === 0) this.entities.delete(entity)
          else this.entities.set(entity, filtered)
        }
      }
    }

    this.save()
    return memory.id
  }

  search(query, { limit = 5, filters = {} } = {}) {
    const queryTokens = tokenize(query)
    const queryEmbedding = embed(query)
    const queryEntities = extractEntities(query)

    const scored = this.memories.map(mem => {
      // 1. Semantic similarity (0-1)
      const semanticScore = cosineSimilarity(queryEmbedding, mem.embedding)

      // 2. BM25 keyword score (0-1, normalized)
      const docTokens = tokenize(mem.content)
      const bm25Raw = bm25Score(queryTokens, docTokens)
      const bm25ScoreNorm = Math.min(bm25Raw / 10, 1) // Normalize

      // 3. Entity linking boost
      const entityMatches = mem.entities.filter(e => queryEntities.includes(e)).length
      const entityBoost = entityMatches > 0 ? 0.1 + (entityMatches * 0.05) : 0

      // 4. Actor recency boost (user facts > agent inferences)
      const actorBoost = mem.metadata.actor === 'user' ? 0.05 : 0

      // 5. Temporal decay (newer = better)
      const ageHours = (Date.now() - new Date(mem.metadata.timestamp).getTime()) / (1000 * 60 * 60)
      const recencyBoost = Math.max(0, 0.1 - (ageHours / 1680)) // Decay over 10 weeks

      // Combine scores (multi-signal fusion)
      const combinedScore =
        semanticScore * 0.5 +
        bm25ScoreNorm * 0.25 +
        entityBoost +
        actorBoost +
        recencyBoost

      return { memory: mem, score: combinedScore }
    })

    // Apply metadata filters
    let filtered = scored
    for (const [key, value] of Object.entries(filters)) {
      filtered = filtered.filter(s => s.memory.metadata[key] === value)
    }

    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score)

    return filtered.slice(0, limit).map(s => ({
      id: s.memory.id,
      content: s.memory.content,
      score: Math.round(s.score * 1000) / 1000,
      metadata: s.memory.metadata,
      entities: s.memory.entities,
    }))
  }

  // Get memories for a specific session
  getSessionMemories(sessionId) {
    return this.memories
      .filter(m => m.metadata.sessionId === sessionId)
      .map(m => ({ id: m.id, content: m.content, timestamp: m.metadata.timestamp }))
  }

  // Get user preferences (high-confidence recurring patterns)
  getPreferences() {
    const preferenceMemories = this.memories.filter(
      m => m.metadata.context === 'preference' || m.metadata.context === 'style'
    )
    return preferenceMemories.slice(-20).map(m => m.content)
  }

  stats() {
    return {
      totalMemories: this.memories.length,
      uniqueEntities: this.entities.size,
      sessions: [...new Set(this.memories.map(m => m.metadata.sessionId))].length,
      userId: this.userId,
      agentId: this.agentId,
    }
  }
}

// Export for use
export { AgentMemory, extractEntities, embed, cosineSimilarity }

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2]

  if (action === '--test') {
    const memory = new AgentMemory({ userId: 'test-user', agentId: 'coder-1' })

    // Add some memories
    memory.add("User prefers TypeScript over Python for backend services", { context: 'preference', actor: 'user' })
    memory.add("The proof-risk-model.ts file handles all risk scoring logic", { context: 'codebase', actor: 'agent' })
    memory.add("User wants deterministic seeding in test data generation", { context: 'requirement', actor: 'user' })
    memory.add("SGPA calculation uses credit-weighted grade points", { context: 'domain', actor: 'agent' })
    memory.add("User prefers async/await over callbacks in TypeScript", { context: 'preference', actor: 'user' })

    // Search
    console.log("Search: 'programming preference'")
    const results1 = memory.search("programming preference")
    for (const r of results1) {
      console.log(`  ${r.score}: ${r.content}`)
    }

    console.log("\nSearch: 'risk scoring file'")
    const results2 = memory.search("risk scoring file")
    for (const r of results2) {
      console.log(`  ${r.score}: ${r.content}`)
    }

    console.log("\nSearch: 'grading system'")
    const results3 = memory.search("grading system")
    for (const r of results3) {
      console.log(`  ${r.score}: ${r.content}`)
    }

    console.log("\nStats:", memory.stats())
  } else if (action === '--stats') {
    const userId = process.argv[3] || 'default'
    const memory = new AgentMemory({ userId })
    console.log(JSON.stringify(memory.stats(), null, 2))
  } else {
    console.log(`AirMentor Agent Memory

Usage:
  --test          Run self-test with sample memories
  --stats [user]  Show memory stats for user

Multi-signal retrieval:
  1. Semantic similarity (50% weight)
  2. BM25 keyword matching (25% weight)
  3. Entity linking boost (variable)
  4. Actor preference boost (user facts prioritized)
  5. Temporal recency boost (newer = better)

Four-scope model:
  - user_id: persists across all sessions
  - agent_id: per-agent instance
  - session_id: single conversation
  - org_id: shared organizational context`)
  }
}
