import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scannedRoots = ['src', 'docs', 'audit-map/32-reports']
const checkedExtensions = new Set(['.ts', '.tsx', '.md'])
const explicitlyScopedBoundaryFiles = new Set([
  'audit-map/32-reports/airmentor-claim-ledger-2026-05-11.md',
  'audit-map/32-reports/proof-forensic-realism-2026-05-11.md',
  'docs/paper-evidence/airmentor-paper-evidence-boundaries-2026-05-11.md',
  'docs/paper-evidence/causal-evaluation-protocol.md',
  'docs/superpowers/plans/2026-05-10-airmentor-full-realism-demo-closure.md',
  'docs/superpowers/plans/2026-05-11-airmentor-phase1-deterministic-realism.md',
  'docs/superpowers/specs/2026-05-11-airmentor-deterministic-realism-product-campaign-design.md',
])

const prohibitedPatterns = [
  /interventions proved/i,
  /caused by interventions/i,
  /risk model proved/i,
  /guarantees? student success/i,
  /production-grade prediction/i,
  /real-world causal proof/i,
  /real institutional predictive validity/i,
  /hosted production readiness/i,
  /generalizes? across all programs/i,
  /validated on real MSRUAS data/i,
]

function collectFiles(root: string): string[] {
  try {
    const info = statSync(root)
    if (!info.isDirectory()) return []
  } catch {
    return []
  }

  const files: string[] = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(path)
        continue
      }
      const extension = path.slice(path.lastIndexOf('.'))
      if (checkedExtensions.has(extension)) files.push(path)
    }
  }
  return files
}

function isAllowedBoundaryLine(file: string, index: number, lines: string[]) {
  const normalized = file.replaceAll('\\', '/')
  const localContext = lines.slice(Math.max(0, index - 3), index + 1).join(' ')
  return explicitlyScopedBoundaryFiles.has(normalized)
    || /\b(must not|never|not yet|does not justify|do not overclaim|forbidden|prohibited|does not make|cannot change|do not claim|does not claim|unless accompanied by|no production-readiness overclaim|synthetic-data honesty|non-claims)\b/i.test(localContext)
}

const checkedFiles = scannedRoots.flatMap(collectFiles)

describe('causal and production claim language', () => {
  it('does not overclaim causal or production predictive proof', () => {
    const offenders: string[] = []
    for (const file of checkedFiles) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (isAllowedBoundaryLine(file, index, lines)) return
        for (const pattern of prohibitedPatterns) {
          if (pattern.test(line)) offenders.push(`${file}:${index + 1} matches ${pattern}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it('keeps a written protocol for synthetic proof boundaries', () => {
    const protocol = readFileSync('docs/paper-evidence/causal-evaluation-protocol.md', 'utf8')
    expect(protocol).toMatch(/synthetic but realistic/i)
    expect(protocol).toMatch(/must not claim/i)
    expect(protocol).toMatch(/Production claims require real historical data/i)
  })

  it('keeps a paper evidence boundary matrix for N1, N2, and N3 claims', () => {
    const boundaryMatrix = readFileSync('docs/paper-evidence/airmentor-paper-evidence-boundaries-2026-05-11.md', 'utf8')
    expect(boundaryMatrix).toMatch(/N1: synthetic scenario engine/i)
    expect(boundaryMatrix).toMatch(/N2: adaptable per-program calibration/i)
    expect(boundaryMatrix).toMatch(/N3: config-driven curriculum risk/i)
    expect(boundaryMatrix).toMatch(/Forbidden wording/i)
    expect(boundaryMatrix).toMatch(/Evidence missing/i)
  })
})
