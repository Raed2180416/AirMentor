#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const SOURCE_ROOTS = [
  resolve(process.cwd(), 'adapters'),
  resolve(process.cwd(), 'kernel'),
  resolve(process.cwd(), 'universities'),
]
const RATCHET_PATH = resolve(process.cwd(), 'docs/architecture-line-ratchet.json')
const MAX_NEW_PRODUCTION_FILE_LINES = 400
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

const RATCHET_PATH_RENAMES = {
  'src/admin': 'adapters/web/features/admin',
  'src/api': 'adapters/web/shared/api',
  'src/app': 'adapters/web/app',
  'src/hooks': 'adapters/web/shared/hooks',
  'src/components': 'adapters/web/shared/components',
  'src/pages': 'adapters/web/features/pages',
  'src/theme.ts': 'adapters/web/shared/ui/theme.ts',
  'src/ui-primitives.tsx': 'adapters/web/shared/ui/primitives.tsx',
  'src/domain.ts': 'kernel/shared/domain.ts',
  'src/data.ts': 'adapters/web/simulation/fixtures.ts',
  'src/selectors.ts': 'kernel/grading/assessment-weights.ts',
  'src/repositories.ts': 'adapters/persistence/repositories/air-mentor-repositories.ts',
  'src/system-admin-live-data.ts': 'adapters/web/features/admin/system-admin-live-data.ts',
  'src/system-admin-live-app.tsx': 'adapters/web/features/admin/system-admin-live-app.tsx',
  'src/system-admin-ui.tsx': 'adapters/web/features/admin/system-admin-ui.tsx',
  'src/system-admin-app.tsx': 'adapters/web/features/admin/system-admin-app.tsx',
  'src/system-admin-curriculum-graph.tsx': 'adapters/web/features/admin/system-admin-curriculum-graph.tsx',
  'src/system-admin-faculties-workspace.tsx': 'adapters/web/features/admin/system-admin-faculties-workspace.tsx',
  'src/system-admin-faculty-calendar-workspace.tsx': 'adapters/web/features/admin/system-admin-faculty-calendar-workspace.tsx',
  'src/system-admin-history-workspace.tsx': 'adapters/web/features/admin/system-admin-history-workspace.tsx',
  'src/system-admin-overview-helpers.ts': 'adapters/web/features/admin/system-admin-overview-helpers.ts',
  'src/system-admin-proof-dashboard-workspace.tsx': 'adapters/web/features/admin/system-admin-proof-dashboard-workspace.tsx',
  'src/system-admin-provisioning-helpers.ts': 'adapters/web/features/admin/system-admin-provisioning-helpers.ts',
  'src/system-admin-request-workspace.tsx': 'adapters/web/features/admin/system-admin-request-workspace.tsx',
  'src/system-admin-scoped-registry-launches.tsx': 'adapters/web/features/admin/system-admin-scoped-registry-launches.tsx',
  'src/system-admin-session-shell.tsx': 'adapters/web/features/admin/system-admin-session-shell.tsx',
  'src/system-admin-timetable-editor.tsx': 'adapters/web/features/admin/system-admin-timetable-editor.tsx',
  'src/system-admin-action-queue.ts': 'adapters/web/features/admin/system-admin-action-queue.ts',
  'src/academic-faculty-profile-page.tsx': 'adapters/web/features/academic-faculty-profile-page.tsx',
  'src/academic-route-pages.tsx': 'adapters/web/features/academic-route-pages.tsx',
  'src/academic-session-shell.tsx': 'adapters/web/features/academic-session-shell.tsx',
  'src/academic-workspace-content-shell.tsx': 'adapters/web/features/academic-workspace-content-shell.tsx',
  'src/academic-workspace-route-helpers.ts': 'adapters/web/features/academic-workspace-route-helpers.ts',
  'src/academic-workspace-route-surface.tsx': 'adapters/web/features/academic-workspace-route-surface.tsx',
  'src/academic-workspace-sidebar.tsx': 'adapters/web/features/academic-workspace-sidebar.tsx',
  'src/academic-workspace-topbar.tsx': 'adapters/web/features/academic-workspace-topbar.tsx',
  'src/portal-entry.tsx': 'adapters/web/app/portal-entry.tsx',
  'src/portal-routing.ts': 'adapters/web/app/portal-routing.ts',
  'src/course-config-drawer.tsx': 'adapters/web/features/curriculum/course-config-drawer.tsx',
  'src/curriculum-graph-workspace.tsx': 'adapters/web/features/curriculum/curriculum-graph-workspace.tsx',
  'src/proof-monitoring-tasks.ts': 'adapters/web/simulation/proof-monitoring-tasks.ts',
  'src/proof-pilot.ts': 'adapters/web/simulation/proof-pilot.ts',
  'src/proof-playback.ts': 'adapters/web/simulation/proof-playback.ts',
  'src/proof-provenance.ts': 'adapters/web/simulation/proof-provenance.ts',
  'src/proof-simulation-controls.tsx': 'adapters/web/simulation/proof-simulation-controls.tsx',
  'src/proof-surface-shell.tsx': 'adapters/web/simulation/proof-surface-shell.tsx',
  'src/demo-workspace-badge.tsx': 'adapters/web/simulation/demo-workspace-badge.tsx',
  'src/demo-workspace-pointer.ts': 'adapters/web/simulation/demo-workspace-pointer.ts',
  'src/action-code-humaniser.ts': 'adapters/web/shared/state/action-code-humaniser.ts',
  'src/admin-request-selection.ts': 'adapters/web/features/admin/admin-request-selection.ts',
  'src/admin-section-scope.ts': 'adapters/web/features/admin/admin-section-scope.ts',
  'src/api-connection.ts': 'adapters/web/shared/api/api-connection.ts',
  'src/backend-health-indicator.tsx': 'adapters/web/shared/components/backend-health-indicator.tsx',
  'src/batch-setup-readiness.ts': 'adapters/web/features/admin/batch-setup-readiness.ts',
  'src/calendar-utils.ts': 'adapters/web/shared/state/calendar-utils.ts',
  'src/obsidian-graph.tsx': 'adapters/web/shared/components/obsidian-graph.tsx',
  'src/page-utils.ts': 'adapters/web/shared/state/page-utils.ts',
  'src/session-response-helpers.ts': 'adapters/web/shared/api/session-response-helpers.ts',
  'src/startup-diagnostics.ts': 'adapters/web/shared/state/startup-diagnostics.ts',
  'src/student-checkpoint-parity.ts': 'adapters/web/features/academic/student-checkpoint-parity.ts',
  'src/telemetry.ts': 'adapters/web/shared/state/telemetry.ts',
  'src/App.tsx': 'adapters/web/app/App.tsx',
  'src/App.css': 'adapters/web/app/App.css',
  'src/main.tsx': 'adapters/web/app/main.tsx',
  'src/index.css': 'adapters/web/app/index.css',
  'src/error-boundary.tsx': 'adapters/web/shared/components/error-boundary.tsx',
}

function readRatchet() {
  if (!existsSync(RATCHET_PATH)) {
    throw new Error(`Missing architecture ratchet: ${relative(process.cwd(), RATCHET_PATH)}`)
  }

  const parsed = JSON.parse(readFileSync(RATCHET_PATH, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || typeof parsed.maxLinesByPath !== 'object') {
    throw new Error('Architecture ratchet must define maxLinesByPath.')
  }

  return parsed.maxLinesByPath
}

function resolveLegacyLimit(ratchet, path) {
  const direct = ratchet[path]
  if (direct != null) return { limit: direct, status: 'legacy file' }
  for (const [oldPrefix, newPrefix] of Object.entries(RATCHET_PATH_RENAMES)) {
    if (path === newPrefix || path.startsWith(`${newPrefix}/`)) {
      const oldPath = path.replace(newPrefix, oldPrefix)
      const renamed = ratchet[oldPath]
      if (renamed != null) return { limit: renamed, status: 'legacy file' }
    }
  }
  return null
}

function listSourceFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = resolve(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(absolutePath)
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) return []
    return [absolutePath]
  })
}

function countLines(path) {
  const source = readFileSync(path, 'utf8')
  return source === '' ? 0 : source.split('\n').length - 1
}

const maxLinesByPath = readRatchet()
const violations = []

for (const sourceRoot of SOURCE_ROOTS) {
  for (const absolutePath of listSourceFiles(sourceRoot)) {
    const path = relative(process.cwd(), absolutePath)
    const lineCount = countLines(absolutePath)
    const legacy = resolveLegacyLimit(maxLinesByPath, path)
    const limit = legacy?.limit ?? MAX_NEW_PRODUCTION_FILE_LINES
    const status = legacy?.status ?? 'new file'

    if (lineCount > limit) {
      violations.push({ path, lineCount, limit, status })
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary check failed:')
  for (const violation of violations) {
    console.error(`- ${violation.path}: ${violation.lineCount} lines exceeds ${violation.status} limit of ${violation.limit}`)
  }
  process.exitCode = 1
} else {
  console.log(`Architecture boundary check passed: new production files <= ${MAX_NEW_PRODUCTION_FILE_LINES} lines; legacy files did not grow.`)
}
