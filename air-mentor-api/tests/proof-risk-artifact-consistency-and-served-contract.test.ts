import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSeededProductionModelFamily } from '../src/db/seed.js'
import { createTestApp } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  vi.restoreAllMocks()
  if (current) await current.close()
  current = null
})

type JsonRecord = Record<string, unknown>

const PROMOTED_DECISIONS = new Set(['promote', 'promote-to-production', 'promote-as-primary', 'promoted'])
const DEFAULT_MODEL_DIR = path.resolve(process.cwd(), 'output/proof-risk-model')
const COVERAGE_33_DIR = path.resolve(process.cwd(), 'output/proof-risk-robustness-2026-06-01/coverage-33-all-families-stress-v2-heap6g')

function readJson<T = JsonRecord>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

function readMeta(filePath: string) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  return Object.fromEntries(lines
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const index = line.indexOf('=')
      return index === -1 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)]
    }))
}

function productionSummary(bundle: JsonRecord) {
  const production = bundle.production && typeof bundle.production === 'object' && !Array.isArray(bundle.production)
    ? bundle.production as JsonRecord
    : {}
  return {
    modelFamily: typeof production.modelFamily === 'string' ? production.modelFamily : null,
    modelVersion: typeof production.modelVersion === 'string' ? production.modelVersion : null,
    featureSchemaVersion: typeof production.featureSchemaVersion === 'string' ? production.featureSchemaVersion : null,
    splitSummary: production.splitSummary ?? null,
    worldSplitSummary: production.worldSplitSummary ?? null,
    scenarioFamilySummary: production.scenarioFamilySummary ?? null,
  }
}

function unique(values: unknown[]) {
  return [...new Set(values.map(value => String(value ?? 'unknown')))].sort()
}

describe('proof risk artifact consistency and served contract', () => {
  it('exports the raw-artifact, latest-robustness, and seeded-DB serving contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const defaultBundlePath = path.join(DEFAULT_MODEL_DIR, 'risk-model-bundle.json')
    const defaultPromotionPath = path.join(DEFAULT_MODEL_DIR, 'promotion-decision.json')
    const defaultSotaPromotionPath = path.join(DEFAULT_MODEL_DIR, 'sota/promotion-decision.json')
    const defaultMetaPath = path.join(DEFAULT_MODEL_DIR, 'meta.txt')
    const coverageBundlePath = path.join(COVERAGE_33_DIR, 'risk-model-bundle.json')
    const coverageReportPath = path.join(COVERAGE_33_DIR, 'evaluation-report.json')

    ;[
      defaultBundlePath,
      defaultPromotionPath,
      defaultSotaPromotionPath,
      defaultMetaPath,
      coverageBundlePath,
      coverageReportPath,
    ].forEach(filePath => expect(existsSync(filePath), filePath).toBe(true))

    const defaultBundle = readJson(defaultBundlePath)
    const defaultPromotion = readJson(defaultPromotionPath)
    const defaultSotaPromotion = readJson(defaultSotaPromotionPath)
    const defaultMeta = readMeta(defaultMetaPath)
    const coverageBundle = readJson(coverageBundlePath)
    const coverageReport = readJson(coverageReportPath)

    const defaultProduction = productionSummary(defaultBundle)
    const coverageProduction = productionSummary(coverageBundle)
    const defaultDecision = typeof defaultPromotion.decision === 'string' ? defaultPromotion.decision : null
    const defaultSotaDecision = typeof defaultSotaPromotion.decision === 'string' ? defaultSotaPromotion.decision : null
    const seededFamilyFromDefault = await resolveSeededProductionModelFamily(defaultBundlePath, {
      modelFamily: defaultProduction.modelFamily,
    })

    current = await createTestApp()
    const { rows: dbArtifactRows } = await current.pool.query(`
      select
        artifact_type,
        model_family,
        artifact_version,
        feature_schema_version,
        status,
        active_flag,
        created_at
      from risk_model_artifacts
      where active_flag = 1
      order by artifact_type, created_at desc
    `)

    const outputDirFromMeta = typeof defaultMeta.OUTPUT_DIR === 'string' ? defaultMeta.OUTPUT_DIR : null
    const governedSeeds = Array.isArray(coverageReport.governedSeeds) ? coverageReport.governedSeeds : []
    const scenarioFamilies = coverageProduction.scenarioFamilySummary && typeof coverageProduction.scenarioFamilySummary === 'object'
      ? Object.keys(coverageProduction.scenarioFamilySummary as Record<string, unknown>)
      : []
    const activeProductionRows = dbArtifactRows.filter(row => row.artifact_type === 'production')
    const activeProductionFamilies = unique(activeProductionRows.map(row => row.model_family))
    const warnings = [
      ...(defaultProduction.modelFamily === 'catboost' && !PROMOTED_DECISIONS.has(defaultDecision ?? '')
        ? ['Default bundle raw production.modelFamily is catboost while promotion-decision keeps the challenger as shadow; runtime must use seededFamilyFromDefault instead.']
        : []),
      ...(outputDirFromMeta && path.resolve(outputDirFromMeta) !== COVERAGE_33_DIR
        ? ['Default meta OUTPUT_DIR does not point at the expected coverage-33 robustness directory.']
        : []),
      ...(coverageProduction.modelFamily !== seededFamilyFromDefault
        ? ['Latest coverage-33 bundle family and seeded default serving family differ.']
        : []),
    ]

    const artifact = {
      generatedAt: new Date().toISOString(),
      schemaVersion: 'proof-risk-served-artifact-consistency.v1',
      defaultArtifact: {
        path: path.relative(process.cwd(), defaultBundlePath),
        production: defaultProduction,
        promotionDecision: defaultDecision,
        sotaPromotionDecision: defaultSotaDecision,
        seededFamilyFromDefault,
      },
      latestRobustnessArtifact: {
        path: path.relative(process.cwd(), coverageBundlePath),
        reportPath: path.relative(process.cwd(), coverageReportPath),
        production: coverageProduction,
        generatedAt: coverageReport.generatedAt ?? null,
        governedSeedCount: governedSeeds.length,
        scenarioFamilyCount: scenarioFamilies.length,
        projectionRowCount: coverageReport.projectionRowCount ?? coverageReport.rowCount ?? null,
      },
      metaPointer: {
        path: path.relative(process.cwd(), defaultMetaPath),
        outputDir: outputDirFromMeta,
        pointsToCoverage33: outputDirFromMeta ? path.resolve(outputDirFromMeta) === COVERAGE_33_DIR : false,
      },
      seededDatabase: {
        activeArtifactCount: dbArtifactRows.length,
        activeFamilies: unique(dbArtifactRows.map(row => row.model_family)),
        activeProductionFamilies,
        activeVersions: unique(dbArtifactRows.map(row => row.artifact_version)),
        activeFeatureSchemas: unique(dbArtifactRows.map(row => row.feature_schema_version)),
        rows: dbArtifactRows,
      },
      summary: {
        rawDefaultFamily: defaultProduction.modelFamily,
        promotionDecision: defaultDecision,
        seededFamilyFromDefault,
        latestRobustnessFamily: coverageProduction.modelFamily,
        dbActiveFamilies: unique(dbArtifactRows.map(row => row.model_family)),
        dbActiveProductionFamilies: activeProductionFamilies,
        warnings,
        servedContractOk: seededFamilyFromDefault === 'logistic'
          && coverageProduction.modelFamily === 'logistic'
          && activeProductionFamilies.length === 1
          && activeProductionFamilies[0] === 'logistic',
      },
    }

    const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(
      path.join(outputDir, 'proof-risk-served-artifact-consistency-2026-06-02.json'),
      `${JSON.stringify(artifact, null, 2)}\n`,
    )

    expect(defaultDecision).toBe('keep-as-shadow')
    expect(defaultSotaDecision).toBe('keep-as-shadow')
    expect(seededFamilyFromDefault).toBe('logistic')
    expect(coverageProduction.modelFamily).toBe('logistic')
    expect(governedSeeds).toHaveLength(33)
    expect(scenarioFamilies.length).toBeGreaterThanOrEqual(11)
    expect(artifact.metaPointer.pointsToCoverage33).toBe(true)
    expect(artifact.seededDatabase.activeArtifactCount).toBeGreaterThan(0)
    expect(artifact.seededDatabase.activeProductionFamilies).toEqual(['logistic'])
    expect(artifact.summary.servedContractOk).toBe(true)
  }, 120_000)
})
