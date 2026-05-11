import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ledgerPath = 'audit-map/32-reports/airmentor-claim-ledger-2026-05-11.md'

type LedgerRow = {
  claimId: string
  claim: string
  scope: string
  runtimeProof: string
  evidencePaths: string
  status: string
  boundary: string
  ownerLane: string
  forbiddenOverclaim: string
}

function splitMarkdownRow(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

function parseLedgerRows(markdown: string): LedgerRow[] {
  return markdown.split('\n')
    .filter(line => /^\| CL-[A-Z0-9-]+ \|/.test(line))
    .map(line => {
      const cells = splitMarkdownRow(line)
      return {
        claimId: cells[0] ?? '',
        claim: cells[1] ?? '',
        scope: cells[2] ?? '',
        runtimeProof: cells[3] ?? '',
        evidencePaths: cells[4] ?? '',
        status: cells[5] ?? '',
        boundary: cells[6] ?? '',
        ownerLane: cells[7] ?? '',
        forbiddenOverclaim: cells[8] ?? '',
      }
    })
}

function evidencePaths(row: LedgerRow) {
  if (row.evidencePaths.toLowerCase() === 'none') return []
  return row.evidencePaths.split('<br>').map(path => path.trim()).filter(Boolean)
}

const allowedStatuses = new Set(['proven', 'partial', 'demo-only', 'blocked', 'stale', 'missing'])
const allowedLanes = new Set(['Lane 0', 'Lane 1', 'Lane 2', 'Lane 3', 'Lane 4', 'Lane 5', 'Lane 6', 'Lane 7', 'Lane 8'])

describe('AirMentor claim ledger', () => {
  it('exists with required deterministic evidence fields', () => {
    expect(existsSync(ledgerPath)).toBe(true)
    const rows = parseLedgerRows(readFileSync(ledgerPath, 'utf8'))
    expect(rows.length).toBeGreaterThanOrEqual(10)

    for (const row of rows) {
      expect(row.claimId).toMatch(/^CL-[A-Z0-9-]+$/)
      expect(row.claim.length).toBeGreaterThan(20)
      expect(row.scope.length).toBeGreaterThan(8)
      expect(row.runtimeProof.length).toBeGreaterThan(3)
      expect(allowedStatuses.has(row.status), `${row.claimId} status ${row.status}`).toBe(true)
      expect(row.boundary.length, `${row.claimId} boundary`).toBeGreaterThan(20)
      expect(allowedLanes.has(row.ownerLane), `${row.claimId} lane ${row.ownerLane}`).toBe(true)
      expect(row.forbiddenOverclaim.length, `${row.claimId} forbidden overclaim`).toBeGreaterThan(20)
    }
  })

  it('requires proven claims to name existing test or artifact evidence', () => {
    const rows = parseLedgerRows(readFileSync(ledgerPath, 'utf8'))
    const provenRows = rows.filter(row => row.status === 'proven' || row.status === 'demo-only')
    expect(provenRows.length).toBeGreaterThan(0)

    for (const row of provenRows) {
      const paths = evidencePaths(row)
      expect(paths.length, `${row.claimId} evidence path count`).toBeGreaterThan(0)
      for (const path of paths) {
        expect(existsSync(path), `${row.claimId} missing ${path}`).toBe(true)
      }
      expect(row.boundary.toLowerCase(), `${row.claimId} boundary`).toMatch(/synthetic|local|demo|blocked|not real|not production/)
    }
  })

  it('keeps real-data, production, causal, P6, P7, and hosted deployment claims blocked unless evidence exists', () => {
    const rows = parseLedgerRows(readFileSync(ledgerPath, 'utf8'))
    const blockedIds = new Set(rows.filter(row => row.status === 'blocked' || row.status === 'missing').map(row => row.claimId))
    expect(blockedIds).toContain('CL-REAL-DATA-VALIDATION')
    expect(blockedIds).toContain('CL-PRODUCTION-ML')
    expect(blockedIds).toContain('CL-CAUSAL-IMPACT')
    expect(blockedIds).toContain('CL-P6-MULTI-PROGRAM')
    expect(blockedIds).toContain('CL-P7-RECALIBRATION')
    expect(blockedIds).toContain('CL-HOSTED-DEPLOYMENT')
  })
})
