#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const EXTENSIONS = new Set(['.ts', '.tsx'])

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

function applyToFile(path, rules) {
  const original = readFileSync(path, 'utf8')
  let updated = original
  for (const { pattern, to } of rules) {
    updated = updated.replace(pattern, to)
  }
  if (updated !== original) {
    writeFileSync(path, updated)
    console.log(`fixed ${path.replace(`${ROOT}/`, '')}`)
  }
}

const adminFilesRules = [
  // A: files directly in admin/ imported src-root siblings via ../system-admin-*
  { pattern: /from\s+['"]\.\.\/system-admin-([^'"]+)['"]/g, to: "from './system-admin-$1'" },
]

const adminSectionsRules = [
  // B: files in admin/sections/ imported src-root siblings via ../../system-admin-*
  { pattern: /from\s+['"]\.\.\.\.\/system-admin-([^'"]+)['"]/g, to: "from '../system-admin-$1'" },
]

const featuresRootRules = [
  // C: files in features/ root imported src-root system-admin-* via ./system-admin-*
  { pattern: /from\s+['"]\.\/system-admin-([^'"]+)['"]/g, to: "from '@web/features/admin/system-admin-$1'" },
]

const pagesRules = [
  // D: files in features/pages/ imported src-root system-admin-* via ../system-admin-*
  { pattern: /from\s+['"]\.\.\/system-admin-([^'"]+)['"]/g, to: "from '@web/features/admin/system-admin-$1'" },
]

const appRules = [
  // E: App.tsx imports
  { pattern: /from\s+['"]\.\/system-admin-([^'"]+)['"]/g, to: "from '@web/features/admin/system-admin-$1'" },
  { pattern: /from\s+['"]\.\/academic-faculty-profile-page['"]/g, to: "from '@web/features/academic-faculty-profile-page'" },
  { pattern: /from\s+['"]\.\/academic-session-shell['"]/g, to: "from '@web/features/academic-session-shell'" },
  { pattern: /from\s+['"]\.\/app\/([^'"]+)['"]/g, to: "from './$1'" },
]

const operationalWorkspaceRules = [
  { pattern: /from\s+['"]\.\.\/portal-routing['"]/g, to: "from './portal-routing'" },
  { pattern: /from\s+['"]\.\.\/academic-session-shell['"]/g, to: "from '@web/features/academic-session-shell'" },
  { pattern: /from\s+['"]\.\.\/academic-workspace-sidebar['"]/g, to: "from '@web/features/academic-workspace-sidebar'" },
  { pattern: /from\s+['"]\.\.\/academic-workspace-topbar['"]/g, to: "from '@web/features/academic-workspace-topbar'" },
  { pattern: /from\s+['"]\.\.\/academic-workspace-route-surface['"]/g, to: "from '@web/features/academic-workspace-route-surface'" },
  { pattern: /from\s+['"]\.\.\/academic-workspace-route-helpers['"]/g, to: "from '@web/features/academic-workspace-route-helpers'" },
  { pattern: /from\s+['"]\.\.\/student-checkpoint-parity['"]/g, to: "from '@web/features/academic/student-checkpoint-parity'" },
]

const mainRules = [
  { pattern: /from\s+['"]\.\/error-boundary\.tsx['"]/g, to: "from './error-boundary'" },
]

const clientRules = [
  { pattern: /from\s+['"]\.\.\/demo-workspace-pointer\.js['"]/g, to: "from '@web/simulation/demo-workspace-pointer'" },
  { pattern: /from\s+['"]\.\.\/domain\.js['"]/g, to: "from '@kernel/shared/domain'" },
]

const proofPilotRules = [
  { pattern: /from\s+['"]\.\/system-admin-live-data['"]/g, to: "from '@web/features/admin/system-admin-live-data'" },
]

const facultyCalendarRules = [
  { pattern: /from\s+['"]\.\/pages\/calendar-pages['"]/g, to: "from '@web/features/pages/calendar-pages'" },
]

const topbarRules = [
  { pattern: /from\s+['"]\.\/components\/reevaluating-risk-loader['"]/g, to: "from '@web/shared/components/reevaluating-risk-loader'" },
]

const proofSymbolFixes = [
  // academic-faculty-profile-page.tsx
  { file: 'adapters/web/features/academic-faculty-profile-page.tsx', pattern: /from\s+['"]@web\/simulation\/proof-playback['"]/g, to: "from '@web/simulation/proof-surface-shell'" },
  // system-admin-proof-dashboard-workspace.tsx
  { file: 'adapters/web/features/admin/system-admin-proof-dashboard-workspace.tsx', pattern: /from\s+['"]@web\/simulation\/proof-surface-shell['"]/g, to: "from '@web/simulation/proof-surface-shell'" },
]

function main() {
  for (const path of walk(resolve(ROOT, 'adapters/web/features/admin'))) {
    if (path.includes('/adapters/web/features/admin/sections/')) {
      applyToFile(path, adminSectionsRules)
    } else {
      applyToFile(path, adminFilesRules)
    }
  }
  for (const path of walk(resolve(ROOT, 'adapters/web/features'))) {
    if (path.includes('/adapters/web/features/pages/')) {
      applyToFile(path, pagesRules)
    } else if (!path.includes('/adapters/web/features/admin/')) {
      applyToFile(path, featuresRootRules)
    }
  }
  for (const path of walk(resolve(ROOT, 'adapters/web/app'))) {
    const base = path.split('/').pop()
    if (base === 'App.tsx') applyToFile(path, appRules)
    if (base === 'operational-workspace.tsx') applyToFile(path, operationalWorkspaceRules)
    if (base === 'main.tsx') applyToFile(path, mainRules)
  }
  const clientPath = resolve(ROOT, 'adapters/web/shared/api/client.ts')
  if (statSync(clientPath)) applyToFile(clientPath, clientRules)
  const proofPilotPath = resolve(ROOT, 'adapters/web/simulation/proof-pilot.ts')
  if (statSync(proofPilotPath)) applyToFile(proofPilotPath, proofPilotRules)
  const facultyCalendarPath = resolve(ROOT, 'adapters/web/features/admin/system-admin-faculty-calendar-workspace.tsx')
  if (statSync(facultyCalendarPath)) applyToFile(facultyCalendarPath, facultyCalendarRules)
  const topbarPath = resolve(ROOT, 'adapters/web/features/academic-workspace-topbar.tsx')
  if (statSync(topbarPath)) applyToFile(topbarPath, topbarRules)

  for (const { file, pattern, to } of proofSymbolFixes) {
    const filePath = resolve(ROOT, file)
    try {
      statSync(filePath)
      applyToFile(filePath, [{ pattern, to }])
    } catch {}
  }
}

main()
