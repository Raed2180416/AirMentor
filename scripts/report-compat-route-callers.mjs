import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const args = new Set(process.argv.slice(2))
const outputJson = args.has('--json')
const assertRuntimeClean = args.has('--assert-runtime-clean')

const trackedRoots = [
  '.github',
  'air-mentor-api/src',
  'air-mentor-api/tests',
  'audit-map',
  'scripts',
  'src',
  'tests',
]

const ignoredNames = new Set([
  '.git',
  'dist',
  'node_modules',
  'output',
])

const routePatterns = [
  {
    route: '/api/academic/runtime/:stateKey',
    snippets: [
      '/api/academic/runtime/:stateKey',
      '/api/academic/runtime/{stateKey}',
      '/api/academic/runtime/tasks',
      '/api/academic/runtime/taskPlacements',
      '/api/academic/runtime/calendarAudit',
    ],
  },
  {
    route: '/api/academic/tasks/sync',
    snippets: ['/api/academic/tasks/sync'],
  },
  {
    route: '/api/academic/task-placements/sync',
    snippets: ['/api/academic/task-placements/sync'],
  },
  {
    route: '/api/academic/calendar-audit/sync',
    snippets: ['/api/academic/calendar-audit/sync'],
  },
]

function classifyPath(relativePath) {
  if (relativePath.startsWith('src/')) return 'first-party-frontend'
  if (relativePath.startsWith('air-mentor-api/src/')) {
    if (relativePath === 'air-mentor-api/src/modules/academic-runtime-routes.ts') {
      return 'route-definition'
    }
    return 'first-party-backend'
  }
  if (relativePath.startsWith('tests/') || relativePath.startsWith('air-mentor-api/tests/')) return 'tests'
  if (relativePath.startsWith('scripts/')) return 'scripts'
  if (relativePath.startsWith('.github/')) return 'ci'
  if (relativePath.startsWith('audit-map/') || relativePath.startsWith('audit/')) return 'audit-docs'
  return 'other'
}

async function walk(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir)
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) continue
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(relativePath))
      continue
    }
    files.push(relativePath)
  }
  return files
}

const fileContents = new Map()
for (const root of trackedRoots) {
  for (const relativePath of await walk(root)) {
    if (relativePath === 'scripts/report-compat-route-callers.mjs') continue
    const absolutePath = path.join(repoRoot, relativePath)
    fileContents.set(relativePath, await readFile(absolutePath, 'utf8'))
  }
}

const findings = routePatterns.map(({ route, snippets }) => {
  const references = []
  for (const [relativePath, content] of fileContents.entries()) {
    const lines = content.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (!snippets.some(snippet => line.includes(snippet))) return
      references.push({
        path: relativePath,
        line: index + 1,
        classification: classifyPath(relativePath),
      })
    })
  }
  const runtimeCallers = references.filter(reference => (
    reference.classification === 'first-party-frontend'
    || reference.classification === 'first-party-backend'
  ))
  return { route, references, runtimeCallers }
})

const generatedAt = new Date().toISOString()

if (outputJson) {
  console.log(JSON.stringify({
    generatedAt,
    findings,
    runtimeCallerCount: findings.reduce((count, finding) => count + finding.runtimeCallers.length, 0),
  }, null, 2))
} else {
  const output = [
  '# Academic Compatibility Route Inventory',
  '',
  `Generated: ${generatedAt}`,
  '',
  ]

  for (const finding of findings) {
    const byClass = new Map()
    for (const reference of finding.references) {
      const current = byClass.get(reference.classification) ?? []
      current.push(reference)
      byClass.set(reference.classification, current)
    }

    output.push(`## ${finding.route}`)
    output.push('')
    output.push(finding.runtimeCallers.length === 0
      ? '- first-party runtime callers: none'
      : `- first-party runtime callers: ${finding.runtimeCallers.length}`)
    if (finding.references.length === 0) {
      output.push('')
      continue
    }

    for (const classification of ['first-party-frontend', 'first-party-backend', 'route-definition', 'tests', 'scripts', 'ci', 'audit-docs', 'other']) {
      const references = byClass.get(classification)
      if (!references || references.length === 0) continue
      output.push(`- ${classification}:`)
      for (const reference of references) {
        output.push(`  - ${reference.path}:${reference.line}`)
      }
    }
    output.push('')
  }

  console.log(output.join('\n'))
}

if (assertRuntimeClean) {
  const leakedRuntimeCallers = findings.flatMap(finding =>
    finding.runtimeCallers.map(reference => ({
      route: finding.route,
      path: reference.path,
      line: reference.line,
      classification: reference.classification,
    })),
  )
  if (leakedRuntimeCallers.length > 0) {
    const summary = leakedRuntimeCallers
      .map(reference => `${reference.route} -> ${reference.path}:${reference.line}`)
      .join(' | ')
    console.error(`Compatibility route inventory failed: first-party runtime callers remain. ${summary}`)
    process.exitCode = 1
  }
}
