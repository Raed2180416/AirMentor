import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSeededProductionModelFamily } from '../src/db/seed.js'

const promotedDecisions = ['promote', 'promote-to-production', 'promote-as-primary', 'promoted']
const catBoostHeads = ['attendanceRisk', 'ceRisk', 'seeRisk', 'overallCourseRisk', 'downstreamCarryoverRisk']
const tempDirs: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function writePromotionFixture(decision: string | null) {
  const dir = await mkdtemp(path.join(tmpdir(), 'airmentor-risk-contract-'))
  tempDirs.push(dir)
  const bundlePath = path.join(dir, 'risk-model-bundle.json')
  await writeFile(bundlePath, JSON.stringify({ production: { modelFamily: 'catboost' } }), 'utf8')
  if (decision !== null) {
    await writeFile(path.join(dir, 'promotion-decision.json'), JSON.stringify({ decision }), 'utf8')
  }
  return bundlePath
}

describe('proof risk served model contract', () => {
  it('does not seed a shadow-only CatBoost challenger as the served production model', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bundlePath = await writePromotionFixture('keep-as-shadow')

    await expect(resolveSeededProductionModelFamily(bundlePath, { modelFamily: 'catboost' })).resolves.toBe('logistic')
  })

  it.each(promotedDecisions)('recognizes %s as an explicit CatBoost promotion decision', async decision => {
    const bundlePath = await writePromotionFixture(decision)

    await expect(resolveSeededProductionModelFamily(bundlePath, { modelFamily: 'catboost' })).resolves.toBe('catboost')
  })

  it('treats a missing promotion decision as shadow-only for serving', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bundlePath = await writePromotionFixture(null)

    await expect(resolveSeededProductionModelFamily(bundlePath, { modelFamily: 'catboost' })).resolves.toBe('logistic')
  })

  it('captures the current repo artifact contract without trusting the raw model family label alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bundlePath = path.resolve(process.cwd(), 'output/proof-risk-model/risk-model-bundle.json')
    const decisionPath = path.resolve(process.cwd(), 'output/proof-risk-model/promotion-decision.json')
    expect(existsSync(bundlePath)).toBe(true)
    expect(existsSync(decisionPath)).toBe(true)

    const bundle = JSON.parse(await readFile(bundlePath, 'utf8')) as {
      production?: { modelFamily?: string | null; modelVersion?: string | null }
    }
    const decision = JSON.parse(await readFile(decisionPath, 'utf8')) as { decision?: string }
    const seededFamily = await resolveSeededProductionModelFamily(bundlePath, {
      modelFamily: bundle.production?.modelFamily ?? null,
    })

    if (decision.decision && promotedDecisions.includes(decision.decision)) {
      expect(seededFamily).toBe(bundle.production?.modelFamily ?? 'logistic')
      if (seededFamily === 'catboost') {
        const missing = catBoostHeads.filter(head => !existsSync(path.resolve(process.cwd(), `output/proof-risk-model/catboost_${head}_v1.json`)))
        expect(missing).toEqual([])
        expect(bundle.production?.modelVersion ?? '').not.toMatch(/logit/i)
      }
    } else if (bundle.production?.modelFamily === 'catboost') {
      expect(seededFamily).toBe('logistic')
    }
  })
})
