import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scannedRoots = ['src', 'docs', 'audit-map/32-reports']
const checkedExtensions = new Set(['.ts', '.tsx', '.md'])
const explicitlyScopedBoundaryFiles = new Set([
  'docs/paper-evidence/causal-evaluation-protocol.md',
  'docs/superpowers/plans/2026-05-10-airmentor-full-realism-demo-closure.md',
])

const prohibitedPatterns = [
  /interventions proved/i,
  /caused by interventions/i,
  /risk model proved/i,
  /guarantees? student success/i,
  /production-grade prediction/i,
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

function isAllowedBoundaryLine(file: string, line: string) {
  const normalized = file.replaceAll('\\', '/')
  return explicitlyScopedBoundaryFiles.has(normalized)
    || /\b(must not|never|not yet|does not justify|do not overclaim|forbidden|prohibited|does not make|cannot change)\b/i.test(line)
}

const checkedFiles = scannedRoots.flatMap(collectFiles)

describe('causal and production claim language', () => {
  it('does not overclaim causal or production predictive proof', () => {
    const offenders: string[] = []
    for (const file of checkedFiles) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (isAllowedBoundaryLine(file, line)) return
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
})
