#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const SOURCE_DIRS = ['adapters', 'kernel', 'universities']
const EXTENSIONS = new Set(['.ts', '.tsx'])

const PROOF_MODULE_BY_SYMBOL = {
  CANONICAL_PROOF_BATCH_ID: 'proof-pilot',
  CANONICAL_PROOF_ACADEMIC_FACULTY_ID: 'proof-pilot',
  CANONICAL_PROOF_BRANCH_ID: 'proof-pilot',
  CANONICAL_PROOF_DEPARTMENT_ID: 'proof-pilot',
  isCanonicalProofBatchId: 'proof-pilot',
  resolveAdminDirectoryScopeFilter: 'proof-pilot',
  resolveAuthoritativeOperationalSemester: 'proof-pilot',
  resolveCanonicalProofBatch: 'proof-pilot',
  resolveProofDashboardBatchId: 'proof-pilot',
  clearProofPlaybackSelection: 'proof-playback',
  readSharedProofPlaybackSelection: 'proof-playback',
  writeProofPlaybackSelection: 'proof-playback',
  ProofSurfaceLauncher: 'proof-surface-shell',
  ProofSimulationControls: 'proof-simulation-controls',
  ProofAdvanceControlMode: 'proof-simulation-controls',
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.venv' || entry.name === 'dist') continue
      yield* walk(absolutePath)
    } else if (entry.isFile() && EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      yield absolutePath
    }
  }
}

function inferProofModule(source) {
  for (const [symbol, module] of Object.entries(PROOF_MODULE_BY_SYMBOL)) {
    if (source.includes(symbol)) return module
  }
  return null
}

function fixProofImports(source) {
  // Match multi-line import blocks ending in '@web/simulation/proof-'
  const importBlockPattern = /from\s+['"]@web\/simulation\/proof-['"]/g
  return source.replace(importBlockPattern, () => {
    // Determine module by looking at the entire source (simplistic)
    const module = inferProofModule(source)
    return `from '@web/simulation/${module ?? 'proof-pilot'}'`
  })
}

function fixAdminLocalImports(source, filePath) {
  if (!filePath.includes('/adapters/web/features/admin/')) return source
  // Replace self-referencing ./admin/ with ./
  return source
    .replace(/from\s+['"]\.\.\/admin\/([^'"]+)['"]/g, "from './$1'")
    .replace(/from\s+['"]\.\/admin\/([^'"]+)['"]/g, "from './$1'")
}

function fixHooksLocalImports(source, filePath) {
  // Files that were originally at src/ root and imported ./hooks/ now live under adapters/web/features or app
  // These should use the shared hooks alias.
  if (filePath.includes('/adapters/web/')) {
    return source.replace(/from\s+['"]\.\/hooks\/([^'"]+)['"]/g, "from '@web/shared/hooks/$1'")
  }
  return source
}

function fixDataLocalImports(source, filePath) {
  // Same for ./data, ./domain in root-level files that moved
  if (filePath.includes('/adapters/web/')) {
    return source
      .replace(/from\s+['"]\.\/data['"]/g, "from '@web/simulation/fixtures'")
      .replace(/from\s+['"]\.\/domain['"]/g, "from '@kernel/shared/domain'")
  }
  return source
}

function main() {
  for (const dir of SOURCE_DIRS) {
    const absoluteDir = resolve(ROOT, dir)
    try {
      statSync(absoluteDir)
    } catch {
      continue
    }
    for (const path of walk(absoluteDir)) {
      const original = readFileSync(path, 'utf8')
      let updated = original
      updated = fixProofImports(updated)
      updated = fixAdminLocalImports(updated, path)
      updated = fixHooksLocalImports(updated, path)
      updated = fixDataLocalImports(updated, path)
      if (updated !== original) {
        writeFileSync(path, updated)
        console.log(`fixed ${path.replace(`${ROOT}/`, '')}`)
      }
    }
  }
}

main()
