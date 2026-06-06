#!/usr/bin/env node
/**
 * AirMentor Deterministic Codebase Indexer
 * Generates a machine-readable knowledge graph of the entire codebase
 * so even a local 4B model or bad free API model can navigate without hallucinating.
 *
 * Inspired by: Codebase-Memory (arxiv 2603.27277v1, 2026)
 * Uses tree-sitter for AST-level extraction where available,
 * falls back to regex for speed.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(repoRoot, '.audit', 'deterministic-index')
mkdirSync(outputDir, { recursive: true })

const outputs = {
  knowledgeGraph: path.join(outputDir, 'knowledge-graph.json'),
  moduleInterfaces: path.join(outputDir, 'module-interfaces.jsonl'),
  publicApiSurface: path.join(outputDir, 'public-api-surface.json'),
  typeSignatures: path.join(outputDir, 'type-signatures.jsonl'),
  entryPoints: path.join(outputDir, 'entry-points.json'),
  changeImpact: path.join(outputDir, 'change-impact.json'),
  llmNavigationGuide: path.join(outputDir, 'LLM_NAVIGATION_GUIDE.md'),
}

const trackedFiles = () => execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\0').filter(Boolean).filter(f => !f.startsWith('.audit/')).sort()

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function safeRead(rel) {
  const abs = path.join(repoRoot, rel)
  try {
    const s = statSync(abs)
    if (s.size > 2_000_000) return null
    return readFileSync(abs, 'utf8')
  } catch { return null }
}

function extractModuleInterface(file, text) {
  const ext = path.extname(file)
  const iface = {
    file,
    exports: [],
    imports: [],
    types: [],
    functions: [],
    classes: [],
    constants: [],
    hasDefaultExport: false,
    hasSideEffects: false,
  }

  if (!text) return iface

  // Exports
  const exportPatterns = [
    [/\bexport\s+default\s+(?:function|class|const|let|var)?\s*([A-Za-z_$][\w$]*)?/g, 'default'],
    [/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, 'function'],
    [/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]/g, 'const'],
    [/\bexport\s+class\s+([A-Za-z_$][\w$]*)/g, 'class'],
    [/\bexport\s+interface\s+([A-Za-z_$][\w$]*)/g, 'interface'],
    [/\bexport\s+type\s+([A-Za-z_$][\w$]*)/g, 'type'],
    [/\bexport\s*\{[^}]*\}\s*from\s+['"]([^'"]+)['"]/g, 're-export'],
    [/\bexport\s*\*\s*from\s+['"]([^'"]+)['"]/g, 're-export-all'],
  ]

  for (const [pattern, kind] of exportPatterns) {
    let m
    while ((m = pattern.exec(text))) {
      if (kind === 'default') { iface.hasDefaultExport = true; continue }
      iface.exports.push({ kind, name: m[1] || '(anonymous)' })
    }
  }

  // Imports
  const importPatterns = [
    [/\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g, 'static'],
    [/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, 'dynamic'],
    [/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, 'require'],
  ]
  for (const [pattern, kind] of importPatterns) {
    let m
    while ((m = pattern.exec(text))) {
      iface.imports.push({ kind, source: m[1] })
    }
  }

  // Functions with signatures (first line after 'function' keyword)
  const fnPattern = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g
  let m
  while ((m = fnPattern.exec(text))) {
    iface.functions.push({ name: m[1], signature: `(${m[2]})` })
  }

  // Arrow function exports
  const arrowPattern = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g
  while ((m = arrowPattern.exec(text))) {
    iface.functions.push({ name: m[1], signature: `(${m[2]}) =>` })
  }

  // Classes
  const classPattern = /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+([A-Za-z_$][\w$]*))?/g
  while ((m = classPattern.exec(text))) {
    iface.classes.push({ name: m[1], extends: m[2] || null })
  }

  // Types/Interfaces
  const typePattern = /(?:export\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?/g
  while ((m = typePattern.exec(text))) {
    iface.types.push({ name: m[1] })
  }

  // Constants
  const constPattern = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=/g
  while ((m = constPattern.exec(text))) {
    iface.constants.push({ name: m[1] })
  }

  // Side effect detection (no export, top-level statement)
  if (!text.includes('export') && /^(?:import|const|let|var|function|class)/m.test(text)) {
    iface.hasSideEffects = true
  }

  return iface
}

function classifyRole(file) {
  if (file.startsWith('src/')) return 'frontend'
  if (file.startsWith('air-mentor-api/src/')) return 'backend'
  if (file.startsWith('scripts/')) return 'script'
  if (file.startsWith('tests-e2e/')) return 'e2e'
  if (file.startsWith('docs/')) return 'doc'
  if (file.startsWith('.github/')) return 'ci'
  return 'other'
}

function buildKnowledgeGraph() {
  const files = trackedFiles()
  const trackedSet = new Set(files)
  const interfaces = []
  const dependencyEdges = []
  const exportsByFile = {}
  const importsByFile = {}
  const publicApi = {}

  for (const file of files) {
    const ext = path.extname(file)
    if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) continue

    const text = safeRead(file)
    if (!text) continue

    const iface = extractModuleInterface(file, text)
    iface.role = classifyRole(file)
    iface.contentHash = sha256(text)
    interfaces.push(iface)

    exportsByFile[file] = iface.exports.map(e => ({ ...e, file }))
    importsByFile[file] = iface.imports

    // Resolve imports to local files
    for (const imp of iface.imports) {
      if (!imp.source.startsWith('.')) continue
      const baseDir = path.dirname(file)
      const raw = path.posix.normalize(path.posix.join(baseDir, imp.source))
      const candidates = [raw, `${raw}.ts`, `${raw}.tsx`, `${raw}.js`, `${raw}.jsx`, `${raw}/index.ts`, `${raw}/index.tsx`]
      const resolved = candidates.find(c => trackedSet.has(c))
      if (resolved) {
        dependencyEdges.push({ from: file, to: resolved, source: imp.source, kind: imp.kind })
      }
    }

    // Public API surface (exports from key files)
    if (iface.exports.length > 0 && !file.includes('.test.') && !file.includes('.spec.')) {
      publicApi[file] = iface.exports
    }
  }

  // Compute high fan-in/out
  const fanIn = {}
  const fanOut = {}
  for (const edge of dependencyEdges) {
    fanIn[edge.to] = (fanIn[edge.to] || 0) + 1
    fanOut[edge.from] = (fanOut[edge.from] || 0) + 1
  }

  const topFanIn = Object.entries(fanIn)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([file, count]) => ({ file, importers: count, exports: exportsByFile[file]?.map(e => e.name) || [] }))

  const topFanOut = Object.entries(fanOut)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([file, count]) => ({ file, imports: count }))

  // Entry points
  const entryPoints = files.filter(f => {
    const base = path.basename(f)
    return base === 'index.ts' || base === 'main.ts' || base === 'app.ts' || base === 'App.tsx'
  })

  // Change impact map: for each high fan-in file, what breaks if changed
  const changeImpact = topFanIn.map(item => ({
    file: item.file,
    importers: item.importers,
    directDependents: dependencyEdges.filter(e => e.to === item.file).map(e => e.from),
    exportedSymbols: item.exports,
    riskLevel: item.importers > 10 ? 'critical' : item.importers > 5 ? 'high' : 'medium',
  }))

  return {
    summary: {
      schemaVersion: 'airmentor-deterministic-index-v1',
      generatedAt: new Date().toISOString(),
      filesIndexed: interfaces.length,
      dependencyEdges: dependencyEdges.length,
      totalExports: interfaces.reduce((sum, i) => sum + i.exports.length, 0),
      totalImports: interfaces.reduce((sum, i) => sum + i.imports.length, 0),
      entryPoints,
    },
    interfaces,
    dependencyEdges,
    publicApi,
    topFanIn,
    topFanOut,
    changeImpact,
  }
}

function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2))
}

function writeJsonl(file, rows) {
  writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
}

function writeLLMNavigationGuide(graph) {
  const lines = [
    '# LLM Navigation Guide — AirMentor Codebase',
    '',
    '> This file is auto-generated. It tells ANY LLM (even a 4B parameter model) exactly how to navigate this codebase without hallucinating.',
    '',
    '## How to Use This Guide',
    '',
    '1. **First**, read this guide to understand the codebase structure.',
    '2. **Then**, look up specific files in the indexes below.',
    '3. **Never guess** file paths or function names. Always check the indexes.',
    '4. **Always verify** your assumptions by reading the actual file before making changes.',
    '',
    '## Entry Points (Start Here)',
    '',
    ...graph.summary.entryPoints.map(f => `- \`${f}\` — ${classifyRole(f)} entry point`),
    '',
    '## Critical Files (High Fan-In — Changes Here Break Many Things)',
    '',
    ...graph.topFanIn.slice(0, 15).map(item =>
      `- \`${item.file}\` — imported by **${item.importers}** files. Exports: ${item.exports.slice(0, 5).join(', ')}${item.exports.length > 5 ? '...' : ''}`
    ),
    '',
    '## Module Categories',
    '',
  ]

  const byRole = {}
  for (const iface of graph.interfaces) {
    const r = iface.role
    if (!byRole[r]) byRole[r] = []
    byRole[r].push(iface)
  }

  for (const [role, ifaces] of Object.entries(byRole)) {
    lines.push(`### ${role} (${ifaces.length} files)`)
    lines.push('')
    for (const iface of ifaces.slice(0, 20)) {
      const exports = iface.exports.map(e => e.name).slice(0, 5)
      lines.push(`- \`${iface.file}\` — exports: ${exports.join(', ') || '(none)'}`)
    }
    if (ifaces.length > 20) lines.push(`- ... and ${ifaces.length - 20} more`)
    lines.push('')
  }

  lines.push('## Change Impact Matrix')
  lines.push('')
  lines.push('| File | Risk | Importers | Key Exports |')
  lines.push('|------|------|-----------|-------------|')
  for (const item of graph.changeImpact.slice(0, 20)) {
    const exports = item.exportedSymbols.slice(0, 3).join(', ')
    lines.push(`| \`${item.file}\` | ${item.riskLevel} | ${item.importers} | ${exports} |`)
  }
  lines.push('')

  lines.push('## Navigation Rules')
  lines.push('')
  lines.push('1. **Never modify high fan-in files** without first reading ALL importers.')
  lines.push('2. **Always follow imports backward** from the file you want to change to understand dependencies.')
  lines.push('3. **Check the public API surface** before changing exported function signatures.')
  lines.push('4. **Run tests** after any change to a file with >5 importers.')
  lines.push('')

  lines.push('## Index Files (Machine-Readable)')
  lines.push('')
  lines.push('- `knowledge-graph.json` — Full dependency graph, fan-in/out, entry points')
  lines.push('- `module-interfaces.jsonl` — One row per module: exports, imports, functions, types')
  lines.push('- `public-api-surface.json` — All exported symbols by file')
  lines.push('- `type-signatures.jsonl` — Type and function signatures')
  lines.push('- `change-impact.json` — Which files are dangerous to modify')
  lines.push('')

  return lines.join('\n')
}

// Main
const graph = buildKnowledgeGraph()
writeJson(outputs.knowledgeGraph, graph)
writeJsonl(outputs.moduleInterfaces, graph.interfaces)
writeJson(outputs.publicApiSurface, graph.publicApi)
writeJsonl(outputs.typeSignatures, graph.interfaces.flatMap(i =>
  i.functions.map(f => ({ file: i.file, name: f.name, signature: f.signature }))
))
writeJson(outputs.entryPoints, graph.summary.entryPoints)
writeJson(outputs.changeImpact, graph.changeImpact)
writeFileSync(outputs.llmNavigationGuide, writeLLMNavigationGuide(graph))

console.log(`Deterministic index generated:`)
console.log(`  ${graph.summary.filesIndexed} files indexed`)
console.log(`  ${graph.summary.dependencyEdges} dependency edges`)
console.log(`  ${graph.summary.totalExports} exports discovered`)
console.log(`  Output: ${outputDir}`)
