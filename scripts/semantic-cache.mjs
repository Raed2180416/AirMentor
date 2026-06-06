#!/usr/bin/env node
/**
 * AirMentor Semantic Cache
 * SOTA 2026: Two-tier caching (exact + semantic) for agent prompts
 * Inspired by: NiteAgent (45-80% cost reduction), GitHub Agentic Workflows
 *
 * Tier 1: Exact match (SHA256 of prompt + model) — instant
 * Tier 2: Semantic match (cosine similarity of embeddings) — higher hit rate
 *
 * Usage: const cache = new SemanticCache();
 *        const cached = cache.get(prompt, model);
 *        if (!cached) { response = await callModel(prompt); cache.set(prompt, model, response); }
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:url'

const CACHE_FILE = '.audit/semantic-cache.json'
const SIMILARITY_THRESHOLD = 0.92

// Simple embedding: character n-gram frequency vector (no external deps)
function embed(text, dim = 128) {
  const vector = new Array(dim).fill(0)
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()

  // Hash-based embedding: deterministic, no external deps
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

  // Normalize to unit vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    return vector.map(v => v / magnitude)
  }
  return vector
}

function cosineSimilarity(a, b) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot // Already normalized
}

class SemanticCache {
  constructor(filePath = CACHE_FILE) {
    this.filePath = filePath
    this.exact = new Map() // key -> { response, timestamp, hits }
    this.semantic = new Map() // embedding -> key
    this.hits = 0
    this.misses = 0
    this.load()
  }

  _exactKey(prompt, model) {
    return createHash('sha256').update(`${prompt}:${model}`).digest('hex')
  }

  load() {
    if (!existsSync(this.filePath)) return
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf8'))
      this.exact = new Map(data.exact || [])
      this.semantic = new Map(data.semantic || [])
    } catch { /* ignore corrupt cache */ }
  }

  save() {
    const data = {
      exact: Array.from(this.exact.entries()),
      semantic: Array.from(this.semantic.entries()),
      stats: { hits: this.hits, misses: this.misses, hitRate: this.hitRate() },
      savedAt: new Date().toISOString(),
    }
    writeFileSync(this.filePath, JSON.stringify(data, null, 2))
  }

  get(prompt, model) {
    const key = this._exactKey(prompt, model)

    // Tier 1: Exact match
    if (this.exact.has(key)) {
      const entry = this.exact.get(key)
      entry.hits = (entry.hits || 0) + 1
      this.hits++
      return { ...entry.response, cached: true, matchType: 'exact' }
    }

    // Tier 2: Semantic match
    const emb = embed(prompt)
    for (const [cachedPrompt, cachedKey] of this.semantic.entries()) {
      const cachedEmb = JSON.parse(cachedPrompt)
      if (cosineSimilarity(emb, cachedEmb) >= SIMILARITY_THRESHOLD) {
        const entry = this.exact.get(cachedKey)
        if (entry) {
          entry.hits = (entry.hits || 0) + 1
          this.hits++
          return { ...entry.response, cached: true, matchType: 'semantic' }
        }
      }
    }

    this.misses++
    return null
  }

  set(prompt, model, response) {
    const key = this._exactKey(prompt, model)
    const emb = embed(prompt)

    this.exact.set(key, {
      response,
      timestamp: new Date().toISOString(),
      hits: 0,
    })
    this.semantic.set(JSON.stringify(emb), key)
    this.save()
  }

  hitRate() {
    const total = this.hits + this.misses
    return total > 0 ? this.hits / total : 0
  }

  stats() {
    return {
      exactEntries: this.exact.size,
      semanticEntries: this.semantic.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hitRate(),
    }
  }
}

// Export for use by orchestrator
export { SemanticCache, embed, cosineSimilarity }

// CLI for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const cache = new SemanticCache()

  if (process.argv[2] === '--stats') {
    console.log(JSON.stringify(cache.stats(), null, 2))
  } else if (process.argv[2] === '--test') {
    // Test similarity
    const emb1 = embed('Write a function to sort an array')
    const emb2 = embed('Write a function to sort a list')
    const emb3 = embed('Create a database migration for users table')

    console.log('Similarity (sort array vs sort list):', cosineSimilarity(emb1, emb2))
    console.log('Similarity (sort array vs db migration):', cosineSimilarity(emb1, emb3))
  } else {
    console.log(`Usage:
  node scripts/semantic-cache.mjs --stats
  node scripts/semantic-cache.mjs --test`)
  }
}
