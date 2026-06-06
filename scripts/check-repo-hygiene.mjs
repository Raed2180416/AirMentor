#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const ALLOWED_MODIFIED = new Set(
  (process.env.AIRMENTOR_HYGIENE_ALLOW_MODIFIED ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean),
)

const GENERATED_PREFIXES = [
  '.audit/',
  '.agents/',
  '.devin/',
  '.kiro/skills/',
  '.ctxo/index/',
  '.worktrees/',
  'air-mentor-api/.eval-db-',
  'air-mentor-api/output/',
  'air-mentor-api/tmp/',
  'air-mentor-api/tmp_db/',
  'air-mentor-api/catboost_info/',
  'catboost_info/',
  'dist/',
  'output/',
  'test-results/',
  'tests-e2e/artifacts/',
  'tmp/',
]

const GENERATED_EXACT = new Set([
  '.env',
  '.mcp.json',
  '.vscode/mcp.json',
  '.windsurf/mcp.json',
  'air-mentor-api/.env',
  'all_microdata_dump.json',
  'context.json',
  'context_main.json',
  'deep_cohort_analysis.json',
  'detailed_cohort_analysis.json',
  'repomix-output.xml',
  'repomix-src-output.xml',
  'student_risk_trajectories.csv',
])

const GENERATED_SUFFIXES = [
  '/context.json',
  '/__pycache__',
  '.log',
  '.pid',
  '.pyc',
  '.sqlite',
  '.sqlite3',
  '.db',
]

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
}

function isGeneratedPath(path) {
  return GENERATED_EXACT.has(path)
    || GENERATED_PREFIXES.some(prefix => path.startsWith(prefix))
    || GENERATED_SUFFIXES.some(suffix => path.endsWith(suffix))
}

function parseStatusLine(line) {
  return {
    status: line.slice(0, 2),
    path: line.slice(3),
  }
}

const lines = git(['status', '--porcelain=v1'])
  .split('\n')
  .filter(Boolean)
  .map(parseStatusLine)

const trackedGenerated = lines.filter(item => item.status.trim() && item.status !== '??' && isGeneratedPath(item.path))
const untrackedGenerated = lines.filter(item => item.status === '??' && isGeneratedPath(item.path))
const unexpectedUntracked = lines.filter(item => item.status === '??' && !isGeneratedPath(item.path))
const unexpectedModified = lines.filter(item => item.status !== '??' && !isGeneratedPath(item.path) && !ALLOWED_MODIFIED.has(item.path))

const summary = {
  totalDirty: lines.length,
  trackedGenerated: trackedGenerated.length,
  untrackedGenerated: untrackedGenerated.length,
  unexpectedUntracked: unexpectedUntracked.length,
  unexpectedModified: unexpectedModified.length,
}

console.log(JSON.stringify(summary, null, 2))

function printSample(label, items) {
  if (items.length === 0) return
  console.log(`\n${label}:`)
  for (const item of items.slice(0, 40)) {
    console.log(`${item.status} ${item.path}`)
  }
  if (items.length > 40) console.log(`... ${items.length - 40} more`)
}

printSample('Tracked generated artifacts that should be untracked in a hygiene commit', trackedGenerated)
printSample('Unexpected modified tracked paths', unexpectedModified)
printSample('Unexpected untracked paths', unexpectedUntracked)

if (trackedGenerated.length > 0 || unexpectedUntracked.length > 0 || unexpectedModified.length > 0) {
  process.exitCode = 1
}
