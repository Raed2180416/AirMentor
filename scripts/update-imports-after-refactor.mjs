#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const ROOT = resolve(process.cwd())
const SOURCE_DIRS = ['adapters', 'kernel', 'universities', 'tests', 'tests-e2e', 'air-mentor-api/src']
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs'])

const REPLACEMENTS = [
  // Cross-cutting UI modules that moved to adapters/web/* aliases
  { pattern: /from\s+['"](?:\.\.\/)+data['"]|from\s+['"]\.\/data['"]|from\s+['"]\.\.\/\.\.\/data['"]|from\s+['"]\.\.\/\.\.\/\.\.\/data['"]/g, to: "from '@web/simulation/fixtures'" },
  { pattern: /from\s+['"](?:\.\.\/)+domain['"]|from\s+['"]\.\/domain['"]|from\s+['"]\.\.\/\.\.\/domain['"]/g, to: "from '@kernel/shared/domain'" },
  { pattern: /from\s+['"](?:\.\.\/)+selectors['"]|from\s+['"]\.\/selectors['"]|from\s+['"]\.\.\/\.\.\/selectors['"]/g, to: "from '@web/shared/state/selectors'" },
  { pattern: /from\s+['"](?:\.\.\/)+repositories['"]|from\s+['"]\.\/repositories['"]|from\s+['"]\.\.\/\.\.\/repositories['"]/g, to: "from '@persistence/repositories/air-mentor-repositories'" },
  { pattern: /from\s+['"](?:\.\.\/)+theme['"]|from\s+['"]\.\/theme['"]|from\s+['"]\.\.\/\.\.\/theme['"]/g, to: "from '@web/shared/ui/theme'" },
  { pattern: /from\s+['"](?:\.\.\/)+ui-primitives['"]|from\s+['"]\.\/ui-primitives['"]|from\s+['"]\.\.\/\.\.\/ui-primitives['"]/g, to: "from '@web/shared/ui/primitives'" },
  { pattern: /from\s+['"](?:\.\.\/)+api\/client['"]|from\s+['"]\.\/api\/client['"]|from\s+['"]\.\.\/\.\.\/api\/client['"]/g, to: "from '@web/shared/api/client'" },
  { pattern: /from\s+['"](?:\.\.\/)+api\/types['"]|from\s+['"]\.\/api\/types['"]|from\s+['"]\.\.\/\.\.\/api\/types['"]/g, to: "from '@web/shared/api/types'" },
  { pattern: /from\s+['"](?:\.\.\/)+api-connection['"]|from\s+['"]\.\/api-connection['"]|from\s+['"]\.\.\/\.\.\/api-connection['"]/g, to: "from '@web/shared/api/api-connection'" },
  { pattern: /from\s+['"](?:\.\.\/)+session-response-helpers['"]|from\s+['"]\.\/session-response-helpers['"]|from\s+['"]\.\.\/\.\.\/session-response-helpers['"]/g, to: "from '@web/shared/api/session-response-helpers'" },
  { pattern: /from\s+['"](?:\.\.\/)+demo-workspace-pointer['"]|from\s+['"]\.\/demo-workspace-pointer['"]|from\s+['"]\.\.\/\.\.\/demo-workspace-pointer['"]/g, to: "from '@web/simulation/demo-workspace-pointer'" },
  { pattern: /from\s+['"](?:\.\.\/)+calendar-utils['"]|from\s+['"]\.\/calendar-utils['"]|from\s+['"]\.\.\/\.\.\/calendar-utils['"]/g, to: "from '@web/shared/state/calendar-utils'" },
  { pattern: /from\s+['"](?:\.\.\/)+page-utils['"]|from\s+['"]\.\/page-utils['"]|from\s+['"]\.\.\/\.\.\/page-utils['"]/g, to: "from '@web/shared/state/page-utils'" },
  { pattern: /from\s+['"](?:\.\.\/)+action-code-humaniser['"]|from\s+['"]\.\/action-code-humaniser['"]|from\s+['"]\.\.\/\.\.\/action-code-humaniser['"]/g, to: "from '@web/shared/state/action-code-humaniser'" },
  { pattern: /from\s+['"](?:\.\.\/)+startup-diagnostics['"]|from\s+['"]\.\/startup-diagnostics['"]|from\s+['"]\.\.\/\.\.\/startup-diagnostics['"]/g, to: "from '@web/shared/state/startup-diagnostics'" },
  { pattern: /from\s+['"](?:\.\.\/)+telemetry['"]|from\s+['"]\.\/telemetry['"]|from\s+['"]\.\.\/\.\.\/telemetry['"]/g, to: "from '@web/shared/state/telemetry'" },
  { pattern: /from\s+['"](?:\.\.\/)+backend-health-indicator['"]|from\s+['"]\.\/backend-health-indicator['"]|from\s+['"]\.\.\/\.\.\/backend-health-indicator['"]/g, to: "from '@web/shared/components/backend-health-indicator'" },
  { pattern: /from\s+['"](?:\.\.\/)+obsidian-graph['"]|from\s+['"]\.\/obsidian-graph['"]|from\s+['"]\.\.\/\.\.\/obsidian-graph['"]/g, to: "from '@web/shared/components/obsidian-graph'" },
  { pattern: /from\s+['"](?:\.\.\/)+error-boundary['"]|from\s+['"]\.\/error-boundary['"]|from\s+['"]\.\.\/\.\.\/error-boundary['"]/g, to: "from '@web/shared/components/error-boundary'" },
  { pattern: /from\s+['"](?:\.\.\/)+proof-([a-z\-]+)['"]|from\s+['"]\.\/proof-([a-z\-]+)['"]|from\s+['"]\.\.\/\.\.\/proof-([a-z\-]+)['"]/g, to: "from '@web/simulation/proof-$1'" },
  { pattern: /from\s+['"](?:\.\.\/)+demo-workspace-([a-z\-]+)['"]|from\s+['"]\.\/demo-workspace-([a-z\-]+)['"]|from\s+['"]\.\.\/\.\.\/demo-workspace-([a-z\-]+)['"]/g, to: "from '@web/simulation/demo-workspace-$1'" },
  // Feature modules
  { pattern: /from\s+['"](?:\.\.\/)+admin\/([^'"]+)['"]/g, to: "from '@web/features/admin/$1'" },
  { pattern: /from\s+['"]\.\.\/admin\/([^'"]+)['"]/g, to: "from '@web/features/admin/$1'" },
  { pattern: /from\s+['"](?:\.\.\/)+app\/([^'"]+)['"]/g, to: "from '@web/app/$1'" },
  { pattern: /from\s+['"]\.\.\/app\/([^'"]+)['"]/g, to: "from '@web/app/$1'" },
  { pattern: /from\s+['"](?:\.\.\/)+hooks\/([^'"]+)['"]/g, to: "from '@web/shared/hooks/$1'" },
  { pattern: /from\s+['"](?:\.\.\/)+components\/([^'"]+)['"]/g, to: "from '@web/shared/components/$1'" },
  { pattern: /from\s+['"](?:\.\.\/)+pages\/([^'"]+)['"]/g, to: "from '@web/features/pages/$1'" },
]

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

function applyReplacements(source) {
  let result = source
  for (const { pattern, to } of REPLACEMENTS) {
    result = result.replace(pattern, to)
  }
  return result
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
      const updated = applyReplacements(original)
      if (updated !== original) {
        writeFileSync(path, updated)
        console.log(`updated ${relative(ROOT, path)}`)
      }
    }
  }
}

main()
