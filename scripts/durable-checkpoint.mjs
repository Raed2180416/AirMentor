#!/usr/bin/env node
/**
 * AirMentor Durable Checkpoint System
 * SOTA 2026: Persist agent state for crash recovery
 * Inspired by: Temporal workflows, Inference.sh durable execution
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkpointDir = path.join(repoRoot, '.audit', 'checkpoints')
mkdirSync(checkpointDir, { recursive: true })

export class DurableCheckpoint {
  constructor(taskId) {
    this.taskId = taskId
    this.dir = path.join(checkpointDir, taskId)
    mkdirSync(this.dir, { recursive: true })
    this.checkpoints = this.list()
  }

  list() {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir).filter(f => f.endsWith('.json')).map(f => ({
      file: f, path: path.join(this.dir, f), seq: parseInt(f.split('-')[0]),
      ts: statSync(path.join(this.dir, f)).mtime.toISOString(),
    })).sort((a, b) => b.seq - a.seq)
  }

  save(state) {
    const seq = this.checkpoints.length ? this.checkpoints[0].seq + 1 : 1
    const cp = {
      version: '2.0', taskId: this.taskId, sequence: seq,
      timestamp: new Date().toISOString(),
      state: {
        messages: state.messages || [],
        memory: state.memory || {},
        plan: state.plan || { completed: [], pending: [], current: null },
        subAgents: state.subAgents || {},
        context: { model: state.model || 'unknown', stepName: state.step || 'unknown', tokensUsed: state.tokensUsed || 0, filesModified: state.filesModified || [], ...state.context },
      },
    }
    const file = path.join(this.dir, `${String(seq).padStart(6, '0')}-${state.step || 'cp'}.json`)
    writeFileSync(file, JSON.stringify(cp, null, 2))
    this.checkpoints.unshift({ file: path.basename(file), path: file, seq, ts: cp.timestamp })
    while (this.checkpoints.length > 20) { const old = this.checkpoints.pop(); /* archive */ }
    return { file, sequence: seq }
  }

  load() {
    if (!this.checkpoints.length) return null
    const cp = JSON.parse(readFileSync(this.checkpoints[0].path, 'utf8'))
    return { ...cp.state, _meta: { sequence: cp.sequence, timestamp: cp.timestamp } }
  }

  stats() {
    return { taskId: this.taskId, total: this.checkpoints.length, latest: this.checkpoints[0]?.seq || 0 }
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2]
  if (action === '--test') {
    const cp = new DurableCheckpoint('test-task')
    cp.save({ messages: [{role:'user',content:'Refactor'}], plan: {completed:[],pending:['a','b'],current:'a'}, step: 'analyzed', model: 'claude', tokensUsed: 5000 })
    cp.save({ messages: [{role:'user',content:'Refactor'},{role:'assistant',content:'Done'}], plan: {completed:['a'],pending:['b'],current:'b'}, step: 'refactored', model: 'claude', tokensUsed: 15000, filesModified: ['file.ts'] })
    const resumed = cp.load()
    console.log('Resumed from seq:', resumed._meta.sequence, 'step:', resumed.context.stepName, 'files:', resumed.context.filesModified)
    console.log('Stats:', cp.stats())
  } else { console.log('Usage: --test') }
}
