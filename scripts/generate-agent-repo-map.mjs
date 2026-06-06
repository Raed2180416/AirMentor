import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(repoRoot, 'docs/agent-map')

const outputs = {
  summary: path.join(outputDir, 'repo-map.json'),
  files: path.join(outputDir, 'files.jsonl'),
  symbols: path.join(outputDir, 'symbols.jsonl'),
  imports: path.join(outputDir, 'imports.jsonl'),
  routes: path.join(outputDir, 'routes.jsonl'),
  tests: path.join(outputDir, 'tests.jsonl'),
  directories: path.join(outputDir, 'directories.json'),
  markdown: path.join(outputDir, 'AGENT_REPO_MAP_2026-06-06.md'),
  strategy: path.join(outputDir, 'CODEBASE_MAPPING_STRATEGY_2026-06-06.md'),
}

const sourceExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.sh',
  '.sql',
  '.css',
  '.html',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.nix',
])
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sh', '.sql'])
const importableExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css']
const skippedIgnoredPrefixes = [
  '.git/',
  'node_modules/',
  'air-mentor-api/node_modules/',
  'dist/',
  'air-mentor-api/dist/',
  'air-mentor-api/output/',
  'tests-e2e/artifacts/',
  '.ctxo/',
  '.logicstamp/',
]

function runGit(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
}

function safeRead(relativePath) {
  const absolute = path.join(repoRoot, relativePath)
  try {
    const stats = statSync(absolute)
    if (stats.size > 1_500_000) return null
    return readFileSync(absolute, 'utf8')
  } catch {
    return null
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function normalizePath(value) {
  return value.split(path.sep).join('/')
}

function trackedFiles() {
  return runGit(['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
    .filter(file => !file.startsWith('docs/agent-map/'))
    .sort((a, b) => a.localeCompare(b))
}

function ignoredFiles() {
  try {
    return runGit(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'])
      .split('\0')
      .filter(Boolean)
      .filter(file => !skippedIgnoredPrefixes.some(prefix => file.startsWith(prefix)))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function readPackage(relativePath) {
  const text = safeRead(relativePath)
  return text ? JSON.parse(text) : null
}

function extOf(file) {
  return path.extname(file) || '[no-ext]'
}

function topDir(file) {
  return file.split('/')[0] || '.'
}

function classifyFile(file) {
  if (file.startsWith('src/')) return 'frontend'
  if (file.startsWith('air-mentor-api/src/')) return 'backend'
  if (file.startsWith('air-mentor-api/scripts/')) return 'backend-script'
  if (file.startsWith('scripts/')) return 'repo-script'
  if (file.startsWith('tests-e2e/')) return 'e2e-test'
  if (file.startsWith('tests/') || file.startsWith('air-mentor-api/tests/')) return 'unit-test'
  if (file.startsWith('docs/')) return 'documentation'
  if (file.startsWith('pipeline/')) return 'pipeline'
  if (file.startsWith('forge-audit/')) return 'forge-audit'
  if (file.includes('/model-contract/')) return 'model-contract'
  if (file.startsWith('.github/')) return 'ci'
  if (
    file.startsWith('.windsurf/')
    || file.startsWith('.claude/')
    || file.startsWith('.codex')
    || file.startsWith('.kiro/')
    || file.startsWith('.agents/')
  ) {
    return 'agent-config'
  }
  if (
    file.endsWith('package.json')
    || file.endsWith('package-lock.json')
    || file.includes('tsconfig')
    || file.includes('vite.config')
    || file.includes('vitest.config')
    || file.includes('playwright.config')
    || file.endsWith('flake.nix')
    || file.endsWith('flake.lock')
  ) {
    return 'build-config'
  }
  return 'other'
}

function splitLines(text) {
  return text.split(/\r\n|\r|\n/)
}

function lineCount(text) {
  if (!text) return 0
  return text.length === 0 ? 0 : splitLines(text).length
}

function nonEmptyLineCount(text) {
  if (!text) return 0
  return splitLines(text).filter(line => line.trim()).length
}

function commentLineCount(text, ext) {
  if (!text) return 0
  const lines = splitLines(text)
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css'].includes(ext)) {
    return lines.filter(line => /^\s*(\/\/|\/\*|\*)/.test(line)).length
  }
  if (ext === '.py' || ext === '.sh') return lines.filter(line => /^\s*#/.test(line)).length
  if (ext === '.sql') return lines.filter(line => /^\s*(--|\/\*)/.test(line)).length
  if (ext === '.md') return lines.filter(line => /^\s*<!--/.test(line)).length
  return 0
}

function lineStarts(text) {
  const starts = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') starts.push(index + 1)
  }
  return starts
}

function lineForIndex(starts, index) {
  let low = 0
  let high = starts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (starts[mid] <= index) low = mid + 1
    else high = mid - 1
  }
  return high + 1
}

function findBraceEndLine(text, starts, startIndex) {
  const openIndex = text.indexOf('{', startIndex)
  if (openIndex === -1) return null
  let depth = 0
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index]
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return lineForIndex(starts, index)
    }
  }
  return null
}

function addRegexMatches(records, text, starts, kind, pattern) {
  let match
  while ((match = pattern.exec(text))) {
    const startLine = lineForIndex(starts, match.index)
    records.push({
      kind,
      name: match[1],
      startLine,
      endLine: findBraceEndLine(text, starts, match.index),
    })
  }
}

function inferSymbolEndLines(symbols, fileLineCount) {
  const sorted = [...symbols].sort((a, b) => a.startLine - b.startLine || a.name.localeCompare(b.name))
  return sorted.map((symbol, index) => ({
    ...symbol,
    endLine: symbol.endLine ?? Math.max(symbol.startLine, (sorted[index + 1]?.startLine ?? fileLineCount + 1) - 1),
  }))
}

function extractImports(file, text, ext) {
  const imports = []
  if (!text) return imports
  const starts = lineStarts(text)
  const add = (specifier, index, kind) => {
    imports.push({ specifier, line: lineForIndex(starts, index), kind })
  }
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    const patterns = [
      ['import', /\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g],
      ['dynamic-import', /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g],
      ['require', /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g],
      ['re-export', /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g],
    ]
    for (const [kind, pattern] of patterns) {
      let match
      while ((match = pattern.exec(text))) add(match[1], match.index, kind)
    }
  } else if (ext === '.py') {
    const fromPattern = /^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gm
    const importPattern = /^\s*import\s+([A-Za-z0-9_.,\s]+)/gm
    let match
    while ((match = fromPattern.exec(text))) add(match[1], match.index, 'from-import')
    while ((match = importPattern.exec(text))) {
      for (const item of match[1].split(',')) {
        const name = item.trim().split(/\s+/)[0]
        if (name) add(name, match.index, 'import')
      }
    }
  } else if (ext === '.sh') {
    const sourcePattern = /^\s*(?:source|\.)\s+(["']?)([^"'\s]+)\1/gm
    let match
    while ((match = sourcePattern.exec(text))) add(match[2], match.index, 'source')
  }
  return [...new Map(imports.map(item => [`${item.kind}:${item.specifier}:${item.line}`, item])).values()]
}

function extractSymbols(text, ext) {
  if (!text) return []
  const starts = lineStarts(text)
  const records = []
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    addRegexMatches(records, text, starts, 'function', /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)
    addRegexMatches(records, text, starts, 'class', /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g)
    addRegexMatches(records, text, starts, 'interface', /\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g)
    addRegexMatches(records, text, starts, 'type', /\b(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/g)
    addRegexMatches(records, text, starts, 'enum', /\b(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/g)
    addRegexMatches(records, text, starts, 'const', /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/g)
  } else if (ext === '.py') {
    addRegexMatches(records, text, starts, 'function', /^\s*def\s+([A-Za-z_][\w]*)\s*\(/gm)
    addRegexMatches(records, text, starts, 'class', /^\s*class\s+([A-Za-z_][\w]*)\s*[\(:]/gm)
  } else if (ext === '.sh') {
    addRegexMatches(records, text, starts, 'function', /^\s*([A-Za-z_][\w-]*)\s*\(\)\s*\{/gm)
    addRegexMatches(records, text, starts, 'function', /^\s*function\s+([A-Za-z_][\w-]*)/gm)
  }
  return inferSymbolEndLines(records, lineCount(text))
}

function extractHeadings(text, ext) {
  if (!text || ext !== '.md') return []
  return splitLines(text)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(item => /^#{1,4}\s+/.test(item.text))
    .slice(0, 30)
}

function extractApiRoutes(file, text, ext) {
  if (!text || !['.ts', '.tsx', '.js', '.mjs'].includes(ext)) return []
  const starts = lineStarts(text)
  const routes = []
  const patterns = [
    /\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /route\s*\(\s*\{\s*method:\s*['"`]([^'"`]+)['"`]\s*,\s*url:\s*['"`]([^'"`]+)['"`]/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text))) {
      const method = match[1].toUpperCase()
      const route = match[2]
      if (route.startsWith('/')) {
        routes.push({ method, route, file, line: lineForIndex(starts, match.index) })
      }
    }
  }
  return routes
}

function extractTestCases(file, text, ext) {
  if (!text || !['.ts', '.tsx', '.js', '.mjs'].includes(ext)) return []
  if (!file.includes('test') && !file.includes('spec')) return []
  const starts = lineStarts(text)
  const cases = []
  const pattern = /\b(describe|it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let match
  while ((match = pattern.exec(text))) {
    cases.push({ kind: match[1], name: match[2], line: lineForIndex(starts, match.index) })
  }
  return cases
}

function extractReactSignals(text, ext) {
  if (!text || !['.tsx', '.jsx'].includes(ext)) return { components: [], hooks: [] }
  const components = new Set()
  const hooks = new Set()
  const patterns = [
    /\bfunction\s+([A-Z][A-Za-z0-9_]*)\s*\(/g,
    /\bconst\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[^=]+)=>/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text))) components.add(match[1])
  }
  const hookPattern = /\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g
  let match
  while ((match = hookPattern.exec(text))) hooks.add(match[1])
  return { components: [...components].sort(), hooks: [...hooks].sort() }
}

function resolveLocalImport(fromFile, specifier, trackedSet) {
  if (!specifier.startsWith('.')) return null
  const baseDir = path.dirname(fromFile)
  const raw = normalizePath(path.normalize(path.join(baseDir, specifier)))
  const candidates = []
  if (path.extname(raw)) candidates.push(raw)
  for (const ext of importableExtensions) candidates.push(`${raw}${ext}`)
  for (const ext of importableExtensions) candidates.push(`${raw}/index${ext}`)
  return candidates.find(candidate => trackedSet.has(candidate)) ?? null
}

function increment(map, key, by = 1) {
  map[key] = (map[key] ?? 0) + by
}

function topEntries(object, limit = 25) {
  return Object.entries(object)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }))
}

function summarizePackage(pkg) {
  if (!pkg) return null
  return {
    name: pkg.name,
    version: pkg.version,
    type: pkg.type,
    workspaces: pkg.workspaces ?? [],
    scripts: pkg.scripts ?? {},
    dependencies: Object.keys(pkg.dependencies ?? {}).sort(),
    devDependencies: Object.keys(pkg.devDependencies ?? {}).sort(),
    engines: pkg.engines ?? {},
  }
}

function entryPointCatalog(fileSummaryByPath) {
  const entries = [
    ['Frontend app shell', 'src/App.tsx', 'Main academic/demo frontend shell and route switchboard.'],
    ['Frontend live admin shell', 'src/system-admin-live-app.tsx', 'Live System Admin surface and proof playback/admin control entry.'],
    ['Frontend API client', 'src/api/client.ts', 'Browser-to-backend contract wrapper. High risk for runtime parity.'],
    ['Frontend domain model', 'src/domain.ts', 'Shared frontend domain types/helpers imported across UI surfaces.'],
    ['Backend server entry', 'air-mentor-api/src/index.ts', 'API process entrypoint.'],
    ['Backend app factory', 'air-mentor-api/src/app.ts', 'Fastify app composition, CORS/session/security hooks, and module registration.'],
    ['Backend DB schema', 'air-mentor-api/src/db/schema.ts', 'Database schema source of truth.'],
    ['Backend seeded server', 'air-mentor-api/scripts/start-seeded-server.ts', 'Deterministic demo backend launcher.'],
    ['Proof runtime service', 'air-mentor-api/src/lib/proof-control-plane-runtime-service.ts', 'Observed evidence recomputation, risk rows, playback rebuild, and checkpoint projection updates.'],
    ['Proof risk model', 'air-mentor-api/src/lib/proof-risk-model.ts', 'Runtime proof-risk scoring/model contract logic.'],
    ['Proof risk contract bundle', 'air-mentor-api/model-contract/proof-risk-model/risk-model-bundle.json', 'Tracked serving model contract.'],
    ['Proof risk promotion decision', 'air-mentor-api/model-contract/proof-risk-model/promotion-decision.json', 'Governed shadow-vs-serving decision.'],
    ['E2E config', 'tests-e2e/playwright.config.ts', 'Browser proof harness configuration.'],
    ['Root package scripts', 'package.json', 'Primary command registry.'],
    ['API package scripts', 'air-mentor-api/package.json', 'Backend command registry.'],
  ]
  return entries
    .filter(([, file]) => fileSummaryByPath.has(file))
    .map(([name, file, note]) => {
      const summary = fileSummaryByPath.get(file)
      return {
        name,
        file,
        role: summary.role,
        lines: summary.lines,
        localImports: summary.importCounts.local,
        symbols: summary.symbolCount,
        note,
      }
    })
}

function packageScriptRows(pkg, prefix) {
  if (!pkg?.scripts) return []
  return Object.entries(pkg.scripts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, command]) => [`${prefix}:${name}`, command])
}

function buildMap() {
  const files = trackedFiles()
  const trackedSet = new Set(files)
  const ignored = ignoredFiles()
  const rootPackage = summarizePackage(readPackage('package.json'))
  const apiPackage = summarizePackage(readPackage('air-mentor-api/package.json'))
  const branch = runGit(['branch', '--show-current']).trim()

  const byExtension = {}
  const byRole = {}
  const byTopDirectory = {}
  const directorySummaries = {}
  const fileSummaries = []
  const dependencyEdges = []
  const reverseImports = {}
  const forwardImports = {}
  const externalImports = {}
  const routeRows = []
  const testRows = []
  const symbolRows = []
  const anomalies = []
  let totalBytes = 0
  let totalLines = 0
  let totalNonEmptyLines = 0
  let totalCommentLines = 0

  for (const file of files) {
    const absolute = path.join(repoRoot, file)
    const stats = statSync(absolute)
    const ext = extOf(file)
    const role = classifyFile(file)
    const top = topDir(file)
    const text = sourceExtensions.has(ext) ? safeRead(file) : null
    const lines = text === null ? 0 : lineCount(text)
    const nonEmpty = text === null ? 0 : nonEmptyLineCount(text)
    const comments = text === null ? 0 : commentLineCount(text, ext)
    const imports = extractImports(file, text, ext)
    const symbols = extractSymbols(text, ext)
    const headings = extractHeadings(text, ext)
    const routes = extractApiRoutes(file, text, ext)
    const tests = extractTestCases(file, text, ext)
    const react = extractReactSignals(text, ext)
    const localImports = []
    const unresolvedRelativeImports = []
    const packageImports = []

    for (const item of imports) {
      const resolved = resolveLocalImport(file, item.specifier, trackedSet)
      const row = { from: file, specifier: item.specifier, kind: item.kind, line: item.line, resolved }
      if (resolved) {
        localImports.push(row)
        dependencyEdges.push({ from: file, to: resolved, specifier: item.specifier, line: item.line, kind: item.kind })
        increment(forwardImports, file)
        increment(reverseImports, resolved)
      } else if (item.specifier.startsWith('.')) {
        unresolvedRelativeImports.push(row)
      } else {
        packageImports.push(row)
        increment(externalImports, item.specifier.split('/')[0].startsWith('@')
          ? item.specifier.split('/').slice(0, 2).join('/')
          : item.specifier.split('/')[0])
      }
    }

    totalBytes += stats.size
    totalLines += lines
    totalNonEmptyLines += nonEmpty
    totalCommentLines += comments
    increment(byExtension, ext)
    increment(byRole, role)
    increment(byTopDirectory, top)

    const dir = normalizePath(path.dirname(file))
    if (!directorySummaries[dir]) {
      directorySummaries[dir] = { path: dir, fileCount: 0, bytes: 0, lines: 0, roles: {}, extensions: {} }
    }
    directorySummaries[dir].fileCount += 1
    directorySummaries[dir].bytes += stats.size
    directorySummaries[dir].lines += lines
    increment(directorySummaries[dir].roles, role)
    increment(directorySummaries[dir].extensions, ext)

    if (/^\u001b|^xdg_|^"/.test(file) || file.includes('xdg_data_home=') || file.includes('xdg_config_home=')) {
      anomalies.push({
        file,
        reason: 'Tracked path looks like escaped environment-variable output; remove from active repo unless a current owner proves otherwise.',
      })
    }

    const fileSummary = {
      path: file,
      role,
      extension: ext,
      bytes: stats.size,
      lines,
      nonEmptyLines: nonEmpty,
      commentLines: comments,
      sha256: text === null ? null : sha256(text),
      importCounts: {
        total: imports.length,
        local: localImports.length,
        package: packageImports.length,
        unresolvedRelative: unresolvedRelativeImports.length,
      },
      symbolCount: symbols.length,
      routeCount: routes.length,
      testCaseCount: tests.length,
      headings,
      react,
    }
    fileSummaries.push(fileSummary)

    for (const symbol of symbols) {
      symbolRows.push({
        file,
        role,
        extension: ext,
        ...symbol,
        spanLines: Math.max(1, symbol.endLine - symbol.startLine + 1),
      })
    }
    routeRows.push(...routes)
    for (const test of tests) testRows.push({ file, role, ...test })
  }

  const ignoredByTopDirectory = {}
  const ignoredExamples = []
  for (const file of ignored) {
    increment(ignoredByTopDirectory, topDir(file))
    if (ignoredExamples.length < 80) ignoredExamples.push(file)
  }

  const importRows = dependencyEdges.map(edge => ({
    ...edge,
    fromRole: classifyFile(edge.from),
    toRole: classifyFile(edge.to),
  }))

  const highFanIn = topEntries(reverseImports, 40).map(item => ({
    path: item.key,
    importers: item.value,
    role: classifyFile(item.key),
  }))
  const highFanOut = topEntries(forwardImports, 40).map(item => ({
    path: item.key,
    localImports: item.value,
    role: classifyFile(item.key),
  }))
  const fileSummaryByPath = new Map(fileSummaries.map(file => [file.path, file]))
  const directoryRows = Object.values(directorySummaries).sort((a, b) => a.path.localeCompare(b.path))

  return {
    summary: {
      schemaVersion: 'airmentor-agent-repo-map-v2',
      repoRoot,
      generationPolicy: 'Volatile timestamp, HEAD, and git status are intentionally omitted so regeneration stays content-stable across staging and commits.',
      git: {
        branch,
      },
      outputs: Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, normalizePath(path.relative(repoRoot, value))])),
      packages: {
        root: rootPackage,
        api: apiPackage,
      },
      totals: {
        trackedFiles: files.length,
        ignoredEntriesObserved: ignored.length,
        bytes: totalBytes,
        lines: totalLines,
        nonEmptyLines: totalNonEmptyLines,
        commentLines: totalCommentLines,
        localDependencyEdges: dependencyEdges.length,
        symbols: symbolRows.length,
        apiRoutes: routeRows.length,
        testCases: testRows.length,
        filesWithTests: new Set(testRows.map(test => test.file)).size,
        anomalies: anomalies.length,
      },
      counts: {
        byExtension,
        byRole,
        byTopDirectory,
        ignoredByTopDirectory,
      },
      graph: {
        highFanIn,
        highFanOut,
        topExternalImports: topEntries(externalImports, 40),
      },
      entryPoints: entryPointCatalog(fileSummaryByPath),
      routeOwnership: routeOwnership(routeRows),
      componentOwnership: componentOwnership(fileSummaries),
      anomalies,
      ignoredExamples,
      mcpObservations: [
        'CTXO is callable, but the observed overlay was stale relative to current Git state; use it as a hint, not deletion authority.',
        'Codegraph context switching failed because this checkout has no .codegraphcontext file; do not treat Codegraph as current deletion authority yet.',
        'LogicStamp compare-modes succeeded for the TypeScript/TSX slice: 258 files, 186,791 GPT-4 header tokens, and 1,312,917 GPT-4 source tokens.',
      ],
    },
    rows: {
      files: fileSummaries.sort((a, b) => a.path.localeCompare(b.path)),
      symbols: symbolRows.sort((a, b) => a.file.localeCompare(b.file) || a.startLine - b.startLine || a.name.localeCompare(b.name)),
      imports: importRows.sort((a, b) => a.from.localeCompare(b.from) || a.line - b.line || a.to.localeCompare(b.to)),
      routes: routeRows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.route.localeCompare(b.route)),
      tests: testRows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name)),
      directories: directoryRows,
    },
  }
}

function routeOwnership(routes) {
  const byFile = {}
  for (const route of routes) {
    if (!byFile[route.file]) byFile[route.file] = { routeCount: 0, methods: {}, examples: [] }
    byFile[route.file].routeCount += 1
    increment(byFile[route.file].methods, route.method)
    if (byFile[route.file].examples.length < 8) byFile[route.file].examples.push(`${route.method} ${route.route}`)
  }
  return Object.entries(byFile)
    .sort((a, b) => b[1].routeCount - a[1].routeCount || a[0].localeCompare(b[0]))
    .map(([file, info]) => ({ file, ...info }))
}

function componentOwnership(files) {
  return files
    .filter(file => file.react?.components?.length || file.react?.hooks?.length)
    .sort((a, b) => (b.react.components.length + b.react.hooks.length) - (a.react.components.length + a.react.hooks.length))
    .slice(0, 50)
    .map(file => ({
      file: file.path,
      role: file.role,
      lines: file.lines,
      components: file.react.components,
      hooks: file.react.hooks,
    }))
}

function mdTable(headers, rows) {
  const clean = value => String(value ?? '').replace(/\n/g, '<br>').replace(/\|/g, '\\|')
  return [
    `| ${headers.map(clean).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(clean).join(' | ')} |`),
  ].join('\n')
}

function formatBytes(bytes) {
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function largestDirectories(rows, limit = 25) {
  return [...rows]
    .sort((a, b) => b.lines - a.lines || b.fileCount - a.fileCount)
    .slice(0, limit)
    .map(info => [
      info.path,
      info.fileCount,
      formatBytes(info.bytes),
      info.lines,
      Object.entries(info.roles).sort((a, b) => b[1] - a[1]).map(([role, count]) => `${role}:${count}`).join(', '),
    ])
}

function writeJsonl(filePath, rows) {
  writeFileSync(filePath, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`)
}

function writeMarkdown(map) {
  const { summary, rows } = map
  const roleRows = topEntries(summary.counts.byRole, 30).map(item => [item.key, item.value])
  const extRows = topEntries(summary.counts.byExtension, 30).map(item => [item.key, item.value])
  const topDirRows = topEntries(summary.counts.byTopDirectory, 30).map(item => [item.key, item.value])
  const routeRows = rows.routes.slice(0, 80).map(route => [route.method, route.route, `${route.file}:${route.line}`])
  const anomalyRows = summary.anomalies.map(item => [item.file, item.reason])

  return [
    '# AirMentor Agent Repository Map',
    '',
    'Generated by `npm run agent:map` from Git-tracked files in the current checkout.',
    '',
    'This is the durable navigation layer for future agents. It is deterministic, repo-owned, and split into small machine-readable indexes so agents can query only what they need.',
    '',
    '## Current State',
    '',
    mdTable(
      ['Item', 'Value'],
      [
        ['Branch', summary.git.branch],
        ['Generation policy', summary.generationPolicy],
        ['Tracked files', summary.totals.trackedFiles],
        ['Tracked bytes', formatBytes(summary.totals.bytes)],
        ['Tracked source/doc lines', summary.totals.lines],
        ['Non-empty lines', summary.totals.nonEmptyLines],
        ['Comment lines', summary.totals.commentLines],
        ['Local dependency edges', summary.totals.localDependencyEdges],
        ['Symbols/blocks discovered', summary.totals.symbols],
        ['API route registrations found', summary.totals.apiRoutes],
        ['Test cases discovered', summary.totals.testCases],
        ['Tracked path anomalies', summary.totals.anomalies],
      ],
    ),
    '',
    '## Agent Read Order',
    '',
    '1. Read `.github/copilot-instructions.md` for current product truth and change rules.',
    '2. Read this file for repo shape and hotspots.',
    '3. Query `docs/agent-map/files.jsonl`, `symbols.jsonl`, `imports.jsonl`, `routes.jsonl`, and `tests.jsonl` for exact navigation.',
    '4. Read `docs/agent-map/CODEBASE_MAPPING_STRATEGY_2026-06-06.md`, `context-compare-modes.json`, and `TRACKED_ANOMALY_CLEANUP_2026-06-06.md` before changing the mapping/deletion policy.',
    '5. For product/model context, read `docs/PRODUCT_DIRECTION_AND_PRUNING_2026-06-06.md`, `docs/POSITIONING.md`, and `docs/REPOSITORY_STORAGE_AND_BRANCH_CLEANUP_AUDIT_2026-06-06.md`.',
    '6. For runtime model serving, inspect `air-mentor-api/model-contract/README.md`, `risk-model-bundle.json`, and `promotion-decision.json` before touching ML code.',
    '7. For visible proof behavior, start with `tests-e2e/specs/shared-proof-playback-sync.spec.ts`, `tests-e2e/specs/complete-realism-audit-2026-06-04.spec.ts`, and `tests-e2e/playwright.config.ts`.',
    '',
    '## Machine-Readable Indexes',
    '',
    mdTable(
      ['File', 'Contents'],
      [
        ['`repo-map.json`', 'Compact summary, counts, entry points, high fan-in/out, MCP observations, and output paths.'],
        ['`files.jsonl`', 'One row per tracked file: role, extension, size, line counts, hashes, import counts, headings, React signals.'],
        ['`symbols.jsonl`', 'One row per discovered top-level symbol/block with start/end lines. This is the closest current artifact to block-by-block mapping.'],
        ['`imports.jsonl`', 'One row per resolved local dependency edge with source line and from/to roles.'],
        ['`routes.jsonl`', 'One row per discovered API route registration with method, route, file, and line.'],
        ['`tests.jsonl`', 'One row per discovered `describe`/`it`/`test` case with file and line.'],
        ['`directories.json`', 'Directory-level file counts, bytes, line counts, roles, and extensions.'],
      ],
    ),
    '',
    '## Tooling Findings',
    '',
    '- CTXO is callable, but the observed overlay was stale relative to current Git state; use it as a hint, not deletion authority.',
    '- Codegraph context switching failed because this checkout has no `.codegraphcontext` file; do not treat Codegraph as current deletion authority yet.',
    '- LogicStamp compare-modes succeeded for the TypeScript/TSX slice: 258 files, 186,791 GPT-4 header tokens, and 1,312,917 GPT-4 source tokens.',
    '- Repomix is useful for one-shot AI context packs, but it creates large aggregate files and should remain an on-demand artifact outside Git.',
    '- SCIP/Sourcegraph-style indexing is the right future precise-navigation direction if we add CI-backed semantic indexing.',
    '- Knip is the right next OSS candidate for JS/TS dead-code hints, but deletion decisions still need repo tests and product intent review.',
    '',
    '## Entry Points',
    '',
    mdTable(
      ['Name', 'File', 'Lines', 'Local imports', 'Symbols', 'Note'],
      summary.entryPoints.map(item => [item.name, item.file, item.lines, item.localImports, item.symbols, item.note]),
    ),
    '',
    '## Package Scripts',
    '',
    mdTable(['Script', 'Command'], [
      ...packageScriptRows(summary.packages.root, 'root'),
      ...packageScriptRows(summary.packages.api, 'api'),
    ]),
    '',
    '## Role Inventory',
    '',
    mdTable(['Role', 'Files'], roleRows),
    '',
    '## Extension Inventory',
    '',
    mdTable(['Extension', 'Files'], extRows),
    '',
    '## Top Directories',
    '',
    mdTable(['Top directory', 'Tracked files'], topDirRows),
    '',
    '## Largest Source Directories By Lines',
    '',
    mdTable(['Directory', 'Files', 'Bytes', 'Lines', 'Roles'], largestDirectories(rows.directories)),
    '',
    '## High Fan-In Files',
    '',
    'These files are imported by many tracked local files. Treat changes here as higher blast-radius until verified.',
    '',
    mdTable(
      ['File', 'Importers', 'Role'],
      summary.graph.highFanIn.slice(0, 30).map(item => [item.path, item.importers, item.role]),
    ),
    '',
    '## High Fan-Out Files',
    '',
    'These files import many local files. They are useful entry points for understanding a slice of the system.',
    '',
    mdTable(
      ['File', 'Local imports', 'Role'],
      summary.graph.highFanOut.slice(0, 30).map(item => [item.path, item.localImports, item.role]),
    ),
    '',
    '## API Route Registrations',
    '',
    'This regex-based list is a navigation aid, not a formal OpenAPI contract. It records only slash-prefixed route registrations so cache/map keys are not mistaken for endpoints. Use `routes.jsonl` for the full generated route list.',
    '',
    mdTable(['Method', 'Route', 'File:line'], routeRows),
    '',
    '## Tracked Path Anomalies',
    '',
    anomalyRows.length ? mdTable(['Path', 'Reason'], anomalyRows) : 'No tracked path anomalies detected by the current heuristic.',
    '',
    '## Regeneration',
    '',
    '```bash',
    'npm run agent:map',
    '```',
  ].join('\n')
}

function writeStrategy() {
  return [
    '# Agent Codebase Mapping Strategy',
    '',
    '**Decision date:** 2026-06-06',
    '',
    '## Goal',
    '',
    'Build a deterministic, refreshable memory layer that future agents can use before reading raw source. The layer must be useful for line-by-line and block-by-block documentation later, but it must not turn the active repository back into a bulk artifact dump.',
    '',
    '## SOTA Scan Summary',
    '',
    '- Repomix is good for packing a repository into an AI-friendly file, with git-aware filtering and security checks. Use it only on demand and store outputs outside Git.',
    '- Sourcegraph precise code navigation relies on the open SCIP protocol and CI/build-backed indexes. This is the most credible future path for precise semantic navigation.',
    '- Semgrep is useful for SAST, supply-chain, and secret scanning across TypeScript, JavaScript, Python, SQL-adjacent configs, and more. Use it as a security layer, not as the primary architecture map.',
    '- Recent Codebase-Memory research supports persistent Tree-sitter knowledge graphs over repeated grep-only exploration, but the repo still needs a deterministic local artifact that does not depend on external MCP cache freshness.',
    '- Knip is a strong candidate for JS/TS unused files, exports, and dependency hints. Treat its output as a deletion queue, never as automatic deletion authority.',
    '',
    '## Chosen Baseline',
    '',
    'The committed baseline is `scripts/generate-agent-repo-map.mjs`. It uses only Node built-ins and Git, so it can run immediately after clone without installing dependencies.',
    '',
    'It emits:',
    '',
    '- file inventory with hashes and line counts;',
    '- symbol/block spans with start and end lines;',
    '- local import graph edges;',
    '- slash-prefixed API route registrations;',
    '- test case inventory;',
    '- directory and role summaries;',
    '- high fan-in/high fan-out hotspots;',
    '- known MCP freshness caveats.',
    '',
    '## Why Not Heavy Comments Yet',
    '',
    'Line-by-line comments should come after this map is stable. Commenting first risks baking misunderstandings into source. The correct sequence is map, verify, generate docs, then add comments only where the map and tests show durable behavior.',
    '',
    '## Tool Policy',
    '',
    '- Prefer repo-owned generated indexes over hidden MCP state.',
    '- Keep generated indexes compact and queryable with `rg` and `jq`.',
    '- Store large one-shot context packs, browser recordings, model runs, and graph databases outside Git.',
    '- When using CTXO, Codegraph, LogicStamp, Repomix, Knip, Semgrep, or SCIP, record freshness, command, output location, and deletion policy.',
    '- Do not delete code based only on static unused-code findings; require product-intent review and test evidence.',
    '',
    '## Refresh Command',
    '',
    '```bash',
    'npm run agent:map',
    '```',
    '',
    '## Source Links',
    '',
    '- Repomix guide: https://repomix.com/guide/',
    '- SCIP protocol: https://github.com/sourcegraph/scip',
    '- Semgrep docs: https://docs.semgrep.dev/',
    '- Codebase-Memory paper: https://arxiv.org/abs/2603.27277',
    '- Knip docs: https://knip.dev/',
    '- Tree-sitter parse CLI: https://tree-sitter.github.io/tree-sitter/cli/parse.html',
    '- dependency-cruiser: https://github.com/sverweij/dependency-cruiser',
  ].join('\n')
}

function writeAll() {
  mkdirSync(outputDir, { recursive: true })
  for (const filePath of Object.values(outputs)) {
    if (existsSync(filePath)) rmSync(filePath, { force: true })
  }
  const map = buildMap()
  writeFileSync(outputs.summary, `${JSON.stringify(map.summary, null, 2)}\n`)
  writeJsonl(outputs.files, map.rows.files)
  writeJsonl(outputs.symbols, map.rows.symbols)
  writeJsonl(outputs.imports, map.rows.imports)
  writeJsonl(outputs.routes, map.rows.routes)
  writeJsonl(outputs.tests, map.rows.tests)
  writeFileSync(outputs.directories, `${JSON.stringify(map.rows.directories, null, 2)}\n`)
  writeFileSync(outputs.markdown, `${writeMarkdown(map)}\n`)
  writeFileSync(outputs.strategy, `${writeStrategy()}\n`)
  return map
}

const map = writeAll()
console.log(`agent map generated: ${normalizePath(path.relative(repoRoot, outputs.markdown))}`)
console.log(`tracked files: ${map.summary.totals.trackedFiles}`)
console.log(`symbols: ${map.summary.totals.symbols}`)
console.log(`local imports: ${map.summary.totals.localDependencyEdges}`)
