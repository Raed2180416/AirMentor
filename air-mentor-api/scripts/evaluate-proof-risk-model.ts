import { mkdir, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { and, asc, count, eq, gt, inArray, isNotNull } from 'drizzle-orm'
import { createTestApp, TEST_NOW } from '../tests/helpers/test-app.js'
import { MSRUAS_PROOF_BATCH_ID } from '../src/lib/msruas-proof-sandbox.js'
import {
  officialCodeCrosswalks,
  riskEvidenceSnapshots,
  riskModelArtifacts,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
} from '../src/db/schema.js'
import { inferObservableRisk } from '../src/lib/inference-engine.js'
import {
  activateProofSimulationRun,
  approveProofCurriculumImport,
  buildCoEvidenceDiagnosticsFromRows,
  buildPolicyDiagnostics,
  createProofCurriculumImport,
  getProofRiskModelActive,
  getProofRiskModelCorrelations,
  getProofRiskModelEvaluation,
  mergeCoEvidenceDiagnostics,
  mergePolicyDiagnostics,
  recomputeObservedOnlyRisk,
  reviewProofCrosswalks,
  startProofSimulationRun,
  validateProofCurriculumImport,
} from '../src/lib/msruas-proof-control-plane.js'
import { resolveBatchPolicy } from '../src/modules/admin-structure.js'
import {
  PROOF_CORPUS_MANIFEST,
  PROOF_CORPUS_MANIFEST_VERSION,
  scoreObservableRiskWithModel,
  type ObservableFeaturePayload,
  type ObservableLabelPayload,
  type ObservableSourceRefs,
  type RiskHeadKey,
} from '../src/lib/proof-risk-model.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'
import {
  PROOF_QUEUE_ACTIONABLE_PPV_PROXY_MINIMUM,
  PROOF_QUEUE_GOVERNANCE_THRESHOLDS,
  PROOF_QUEUE_SECTION_EXCESS_TOLERANCE,
  PROOF_QUEUE_WATCH_RATE_LIMIT,
  proofQueueActionableRateLimitForStage,
} from '../src/lib/proof-queue-governance.js'

type SplitName = 'train' | 'validation' | 'test'

type ProbabilityRow = {
  label: number
  prob: number
}

type HeadMetrics = {
  brier: number
  rocAuc: number
  expectedCalibrationError: number
  positiveRate: number
  support: number
}

type ActionRollup = {
  action: string
  cases: number
  averageImmediateBenefitScaled: number
  averageNextCheckpointImprovementScaled: number | null
  recoveryRate: number | null
}

type RuntimeSummary = {
  model: HeadMetrics
  heuristic: HeadMetrics
  brierLift: number
  aucLift: number
}

type StageRollup = {
  semesterNumber: number
  stageKey: string
  stageOrder: number
  projectionCount: number
  uniqueStudentCount: number
  highRiskProjectionCount: number
  highRiskStudentCount: number
  mediumRiskProjectionCount: number
  averageRiskProbScaled: number
  averageCounterfactualLiftScaled: number
  openQueueProjectionCount: number
  openQueueStudentCount: number
  watchStudentCount: number
  studentCount: number
  highRiskCount: number
  mediumRiskCount: number
  openQueueCount: number
}

type QueueStageRunRollupSeed = {
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageOrder: number
  uniqueStudents: Set<string>
  openQueueStudents: Set<string>
  watchStudents: Set<string>
  actionableNoActionRiskByStudent: Map<string, number>
  sectionStats: Map<string, { uniqueStudents: Set<string>; openQueueStudents: Set<string> }>
}

export type QueueBurdenRunObservation = {
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageOrder: number
  uniqueStudentCount: number
  openQueueStudentCount: number
  watchStudentCount: number
  sectionMaxActionableRate: number
  actionableQueuePpvProxy: number
}

export type QueueBurdenStageSummary = {
  semesterNumber: number
  stageKey: string
  stageOrder: number
  runCount: number
  threshold: number
  meanActionableOpenRate: number
  medianActionableOpenRate: number
  p95ActionableOpenRate: number
  maxActionableOpenRate: number
  meanWatchRate: number
  medianWatchRate: number
  p95WatchRate: number
  maxWatchRate: number
  meanSectionMaxActionableRate: number
  medianSectionMaxActionableRate: number
  p95SectionMaxActionableRate: number
  maxSectionMaxActionableRate: number
  meanActionableQueuePpvProxy: number
  medianActionableQueuePpvProxy: number
  p95ActionableQueuePpvProxy: number
  minActionableQueuePpvProxy: number
  passesActionableRate: boolean
  passesSectionTolerance: boolean
  passesWatchRate: boolean
  passesPpvProxy: boolean
}

const DEFAULT_SEEDS = PROOF_CORPUS_MANIFEST.map(entry => entry.seed)
const DEFAULT_PROGRESS_EVERY = 8
const DEFAULT_CREATE_CONCURRENCY = Math.min(4, Math.max(1, availableParallelism() - 1))
const EVAL_PAGE_SIZE = 5_000

function parseSeeds() {
  const raw = process.env.AIRMENTOR_EVAL_SEEDS?.trim()
  if (!raw) return DEFAULT_SEEDS
  return raw
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isFinite(value))
}

function parseProgressEvery() {
  const raw = Number(process.env.AIRMENTOR_EVAL_PROGRESS_EVERY ?? DEFAULT_PROGRESS_EVERY)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_PROGRESS_EVERY
}

function parseCreateConcurrency() {
  const raw = Number(process.env.AIRMENTOR_EVAL_CREATE_CONCURRENCY ?? DEFAULT_CREATE_CONCURRENCY)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_CREATE_CONCURRENCY
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function percentile(values: number[], percentileRank: number) {
  if (values.length === 0) return 0
  const ordered = [...values].sort((left, right) => left - right)
  const clampedRank = clamp(percentileRank, 0, 1)
  const index = Math.ceil((ordered.length - 1) * clampedRank)
  return ordered[index] ?? ordered[ordered.length - 1] ?? 0
}

export function queueRollupStudentKey(simulationRunId: string, studentId: string) {
  return `${simulationRunId}::${studentId}`
}

export function queueRollupSectionKey(simulationRunId: string, sectionCode: string) {
  return `${simulationRunId}::${sectionCode}`
}

export function buildQueueBurdenStageSummaries(observations: QueueBurdenRunObservation[]): QueueBurdenStageSummary[] {
  const grouped = new Map<string, QueueBurdenRunObservation[]>()
  observations.forEach(observation => {
    const key = `${observation.semesterNumber}::${observation.stageKey}`
    grouped.set(key, [...(grouped.get(key) ?? []), observation])
  })
  return Array.from(grouped.values())
    .map(stageObservations => {
      const sample = stageObservations[0]!
      const threshold = proofQueueActionableRateLimitForStage(sample.stageKey)
      const actionableOpenRates = stageObservations.map(observation => (
        observation.uniqueStudentCount > 0
          ? observation.openQueueStudentCount / observation.uniqueStudentCount
          : 0
      ))
      const watchRates = stageObservations.map(observation => (
        observation.uniqueStudentCount > 0
          ? observation.watchStudentCount / observation.uniqueStudentCount
          : 0
      ))
      const sectionMaxRates = stageObservations.map(observation => observation.sectionMaxActionableRate)
      const ppvValues = stageObservations
        .filter(observation => observation.openQueueStudentCount > 0)
        .map(observation => observation.actionableQueuePpvProxy)
      const minPpvProxy = ppvValues.length > 0 ? Math.min(...ppvValues) : PROOF_QUEUE_ACTIONABLE_PPV_PROXY_MINIMUM
      const ppvProxyMinimum = sample.stageKey === 'post-tt1'
        ? 0.40
        : sample.stageKey === 'post-tt2' || sample.stageKey === 'post-assignments' || sample.stageKey === 'post-see'
          ? 0.45
          : PROOF_QUEUE_ACTIONABLE_PPV_PROXY_MINIMUM
      return {
        semesterNumber: sample.semesterNumber,
        stageKey: sample.stageKey,
        stageOrder: sample.stageOrder,
        runCount: stageObservations.length,
        threshold: roundToFour(threshold),
        meanActionableOpenRate: roundToFour(average(actionableOpenRates)),
        medianActionableOpenRate: roundToFour(percentile(actionableOpenRates, 0.5)),
        p95ActionableOpenRate: roundToFour(percentile(actionableOpenRates, 0.95)),
        maxActionableOpenRate: roundToFour(Math.max(0, ...actionableOpenRates)),
        meanWatchRate: roundToFour(average(watchRates)),
        medianWatchRate: roundToFour(percentile(watchRates, 0.5)),
        p95WatchRate: roundToFour(percentile(watchRates, 0.95)),
        maxWatchRate: roundToFour(Math.max(0, ...watchRates)),
        meanSectionMaxActionableRate: roundToFour(average(sectionMaxRates)),
        medianSectionMaxActionableRate: roundToFour(percentile(sectionMaxRates, 0.5)),
        p95SectionMaxActionableRate: roundToFour(percentile(sectionMaxRates, 0.95)),
        maxSectionMaxActionableRate: roundToFour(Math.max(0, ...sectionMaxRates)),
        meanActionableQueuePpvProxy: roundToFour(ppvValues.length > 0 ? average(ppvValues) : 0),
        medianActionableQueuePpvProxy: roundToFour(ppvValues.length > 0 ? percentile(ppvValues, 0.5) : 0),
        p95ActionableQueuePpvProxy: roundToFour(ppvValues.length > 0 ? percentile(ppvValues, 0.95) : 0),
        minActionableQueuePpvProxy: roundToFour(minPpvProxy),
        passesActionableRate: percentile(actionableOpenRates, 0.95) <= threshold,
        passesSectionTolerance: percentile(sectionMaxRates, 0.95) <= (threshold + PROOF_QUEUE_SECTION_EXCESS_TOLERANCE),
        passesWatchRate: sample.stageKey === 'pre-tt1' || percentile(watchRates, 0.95) <= PROOF_QUEUE_WATCH_RATE_LIMIT,
        passesPpvProxy: minPpvProxy >= ppvProxyMinimum,
      }
    })
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
}

function rocAuc(rows: ProbabilityRow[]) {
  const positives = rows.filter(row => row.label === 1)
  const negatives = rows.filter(row => row.label === 0)
  if (!positives.length || !negatives.length) return 0.5
  const ordered = rows
    .map((row, index) => ({ ...row, index }))
    .sort((left, right) => left.prob - right.prob || left.index - right.index)
  let rankSum = 0
  ordered.forEach((row, index) => {
    if (row.label === 1) rankSum += index + 1
  })
  return clamp((rankSum - ((positives.length * (positives.length + 1)) / 2)) / (positives.length * negatives.length), 0, 1)
}

function brierScore(rows: ProbabilityRow[]) {
  return rows.length > 0
    ? rows.reduce((sum, row) => sum + ((row.label - row.prob) ** 2), 0) / rows.length
    : 0
}

function expectedCalibrationError(rows: ProbabilityRow[], binCount = 10) {
  if (!rows.length) return 0
  let total = 0
  for (let index = 0; index < binCount; index += 1) {
    const min = index / binCount
    const max = (index + 1) / binCount
    const inBin = rows.filter(row => row.prob >= min && (index === binCount - 1 ? row.prob <= max : row.prob < max))
    if (!inBin.length) continue
    total += Math.abs(average(inBin.map(row => row.prob)) - average(inBin.map(row => row.label))) * (inBin.length / rows.length)
  }
  return total
}

function summarizeMetrics(rows: ProbabilityRow[]): HeadMetrics {
  return {
    brier: roundToFour(brierScore(rows)),
    rocAuc: roundToFour(rocAuc(rows)),
    expectedCalibrationError: roundToFour(expectedCalibrationError(rows)),
    positiveRate: roundToFour(average(rows.map(row => row.label))),
    support: rows.length,
  }
}

function evaluationPaths(rootDir: string) {
  const outputDir = path.join(rootDir, 'output', 'proof-risk-model')
  return {
    outputDir,
    jsonPath: path.join(outputDir, 'evaluation-report.json'),
    markdownPath: path.join(outputDir, 'evaluation-report.md'),
  }
}

async function reviewPendingCrosswalks(current: Awaited<ReturnType<typeof createTestApp>>, curriculumImportVersionId: string) {
  const crosswalkRows = await current.db.select().from(officialCodeCrosswalks).where(eq(officialCodeCrosswalks.curriculumImportVersionId, curriculumImportVersionId))
  const pending = crosswalkRows.filter(row => row.reviewStatus === 'pending-review')
  if (pending.length === 0) return
  await reviewProofCrosswalks(current.db, {
    curriculumImportVersionId,
    actorFacultyId: null,
    reviews: pending.map(row => ({
      officialCodeCrosswalkId: row.officialCodeCrosswalkId,
      reviewStatus: 'reviewed',
    })),
    now: TEST_NOW,
  })
}

function stageRankKey(simulationRunId: string, studentId: string, semesterNumber: number, courseCode: string) {
  return `${simulationRunId}::${studentId}::${semesterNumber}::${courseCode}`
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>) {
  const headerRow = `| ${headers.join(' | ')} |`
  const dividerRow = `| ${headers.map(() => '---').join(' | ')} |`
  const bodyRows = rows.map(row => `| ${row.map(value => String(value)).join(' | ')} |`)
  return [headerRow, dividerRow, ...bodyRows].join('\n')
}

function logProgress(message: string) {
  console.error(`[proof-eval] ${message}`)
}

function governedRunStatusRank(status: typeof simulationRuns.$inferSelect.status) {
  switch (status) {
    case 'active':
      return 0
    case 'completed':
      return 1
    case 'ready':
      return 2
    case 'draft':
      return 3
    case 'archived':
      return 4
    default:
      return 5
  }
}

function compareGovernedCorpusRuns(
  left: typeof simulationRuns.$inferSelect,
  right: typeof simulationRuns.$inferSelect,
) {
  if (left.activeFlag !== right.activeFlag) return right.activeFlag - left.activeFlag
  const statusDelta = governedRunStatusRank(left.status) - governedRunStatusRank(right.status)
  if (statusDelta !== 0) return statusDelta
  if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt)
  if (left.createdAt !== right.createdAt) return right.createdAt.localeCompare(left.createdAt)
  return left.simulationRunId.localeCompare(right.simulationRunId)
}

function selectGovernedCorpusRuns(
  runRows: Array<typeof simulationRuns.$inferSelect>,
  manifest = PROOF_CORPUS_MANIFEST,
  completeRunIds?: ReadonlySet<string>,
) {
  const manifestBySeed = new Map(manifest.map(entry => [entry.seed, entry]))
  const candidatesBySeed = new Map<number, Array<typeof simulationRuns.$inferSelect>>()
  runRows.forEach(row => {
    if (!manifestBySeed.has(row.seed)) return
    if (completeRunIds && !completeRunIds.has(row.simulationRunId)) return
    candidatesBySeed.set(row.seed, [...(candidatesBySeed.get(row.seed) ?? []), row])
  })
  const selectedRunRows = manifest
    .map(entry => {
      const candidates = candidatesBySeed.get(entry.seed) ?? []
      return candidates.slice().sort(compareGovernedCorpusRuns)[0] ?? null
    })
    .filter((row): row is typeof simulationRuns.$inferSelect => !!row)
  const selectedRunIds = new Set(selectedRunRows.map(row => row.simulationRunId))
  return {
    manifestBySeed,
    selectedRunRows,
    skippedSeeds: manifest.filter(entry => !selectedRunRows.some(row => row.seed === entry.seed)).map(entry => entry.seed),
    skippedNonManifestRunIds: runRows
      .filter(row => !manifestBySeed.has(row.seed))
      .map(row => row.simulationRunId)
      .sort(),
    skippedDuplicateManifestRunIds: runRows
      .filter(row => manifestBySeed.has(row.seed) && !selectedRunIds.has(row.simulationRunId))
      .map(row => row.simulationRunId)
      .sort(),
    skippedIncompleteManifestRunIds: completeRunIds
      ? runRows
        .filter(row => manifestBySeed.has(row.seed) && !completeRunIds.has(row.simulationRunId))
        .map(row => row.simulationRunId)
        .sort()
      : [],
  }
}

function selectCompleteGovernedRunIdsFromCounts(input: {
  runRows: Array<typeof simulationRuns.$inferSelect>
  checkpointCountByRunId: Map<string, number>
  stageEvidenceCountByRunId: Map<string, number>
}) {
  return new Set(
    input.runRows
      .filter(row => (input.checkpointCountByRunId.get(row.simulationRunId) ?? 0) >= 36 && (input.stageEvidenceCountByRunId.get(row.simulationRunId) ?? 0) > 0)
      .map(row => row.simulationRunId),
  )
}

function incrementCount(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1
}

async function mapWithConcurrency<Input, Output>(
  values: Input[],
  concurrency: number,
  worker: (value: Input, index: number) => Promise<Output>,
) {
  if (values.length === 0) return [] as Output[]
  const results = new Array<Output>(values.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= values.length) return
      results[currentIndex] = await worker(values[currentIndex]!, currentIndex)
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  const current = await createTestApp()
  try {
    const startedAt = Date.now()
    const progressEvery = parseProgressEvery()
    const createConcurrency = parseCreateConcurrency()
    logProgress('initialized evaluation app and database')
    const resolvedPolicy = await resolveBatchPolicy({
      db: current.db,
      pool: current.pool,
      config: {} as never,
      now: () => TEST_NOW,
    }, MSRUAS_PROOF_BATCH_ID)
    logProgress('resolved effective batch policy')

    const createdImport = await createProofCurriculumImport(current.db, {
      batchId: MSRUAS_PROOF_BATCH_ID,
      actorFacultyId: null,
      now: TEST_NOW,
    })
    logProgress(`created proof import ${createdImport.curriculumImportVersionId}`)

    await validateProofCurriculumImport(current.db, {
      curriculumImportVersionId: createdImport.curriculumImportVersionId,
      now: TEST_NOW,
    })
    await reviewPendingCrosswalks(current, createdImport.curriculumImportVersionId)
    await approveProofCurriculumImport(current.db, {
      curriculumImportVersionId: createdImport.curriculumImportVersionId,
      actorFacultyId: null,
      now: TEST_NOW,
    })
    logProgress(`approved proof import ${createdImport.curriculumImportVersionId}`)

    const manifestBySeed = new Map(PROOF_CORPUS_MANIFEST.map(entry => [entry.seed, entry]))
    const requestedSeeds = parseSeeds()
    const governedSeeds = requestedSeeds.filter(seed => manifestBySeed.has(seed))
    const skippedRequestedSeeds = requestedSeeds.filter(seed => !manifestBySeed.has(seed))
    if (governedSeeds.length === 0) {
      throw new Error('No governed manifest seeds were requested for evaluation')
    }
    if (skippedRequestedSeeds.length > 0) {
      logProgress(`skipping ${skippedRequestedSeeds.length} non-manifest requested seeds: ${skippedRequestedSeeds.join(', ')}`)
    }

    const [existingBatchRuns, existingCheckpointCountRows, existingEvidenceCountRows] = await Promise.all([
      current.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select({
        simulationRunId: simulationStageCheckpoints.simulationRunId,
        checkpointCount: count(),
      }).from(simulationStageCheckpoints).groupBy(simulationStageCheckpoints.simulationRunId),
      current.db.select({
        simulationRunId: riskEvidenceSnapshots.simulationRunId,
        evidenceCount: count(),
      }).from(riskEvidenceSnapshots).where(and(
        eq(riskEvidenceSnapshots.batchId, MSRUAS_PROOF_BATCH_ID),
        isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
      )).groupBy(riskEvidenceSnapshots.simulationRunId),
    ])
    const existingCompleteRunIds = selectCompleteGovernedRunIdsFromCounts({
      runRows: existingBatchRuns,
      checkpointCountByRunId: new Map(existingCheckpointCountRows.map(row => [row.simulationRunId, Number(row.checkpointCount)])),
      stageEvidenceCountByRunId: new Map(
        existingEvidenceCountRows
          .filter(row => !!row.simulationRunId)
          .map(row => [row.simulationRunId!, Number(row.evidenceCount)]),
      ),
    })
    const existingSelection = selectGovernedCorpusRuns(existingBatchRuns, PROOF_CORPUS_MANIFEST, existingCompleteRunIds)
    const existingSelectedSeedSet = new Set(existingSelection.selectedRunRows.map(row => row.seed))
    const seedsToCreate = governedSeeds.filter(seed => !existingSelectedSeedSet.has(seed))
    const reusedRunIds = existingSelection.selectedRunRows
      .filter(row => governedSeeds.includes(row.seed))
      .map(row => row.simulationRunId)
    logProgress(`governed corpus request: ${governedSeeds.length} seeds (${reusedRunIds.length} reused, ${seedsToCreate.length} to create, concurrency ${createConcurrency})`)

    let completedRunCreates = 0
    const createdRunIds = await mapWithConcurrency(seedsToCreate, createConcurrency, async (seed, index) => {
      const result = await startProofSimulationRun(current.db, {
        batchId: MSRUAS_PROOF_BATCH_ID,
        curriculumImportVersionId: createdImport.curriculumImportVersionId,
        policy: resolvedPolicy.effectivePolicy,
        actorFacultyId: null,
        now: TEST_NOW,
        seed,
        runLabel: `eval-${seed}`,
        activate: false,
        skipArtifactRebuild: true,
        skipActiveRiskRecompute: true,
      })
      completedRunCreates += 1
      if (completedRunCreates % progressEvery === 0 || completedRunCreates === seedsToCreate.length) {
        logProgress(
          `created ${completedRunCreates}/${seedsToCreate.length} governed proof runs `
          + `(latest seed ${seed}, worker index ${index}) in ${roundToTwo((Date.now() - startedAt) / 1000)}s`,
        )
      }
      return result.simulationRunId
    })

    const [postCreateRunRows, postCreateCheckpointCountRows, postCreateEvidenceCountRows] = await Promise.all([
      current.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID)),
      current.db.select({
        simulationRunId: simulationStageCheckpoints.simulationRunId,
        checkpointCount: count(),
      }).from(simulationStageCheckpoints).groupBy(simulationStageCheckpoints.simulationRunId),
      current.db.select({
        simulationRunId: riskEvidenceSnapshots.simulationRunId,
        evidenceCount: count(),
      }).from(riskEvidenceSnapshots).where(and(
        eq(riskEvidenceSnapshots.batchId, MSRUAS_PROOF_BATCH_ID),
        isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
      )).groupBy(riskEvidenceSnapshots.simulationRunId),
    ])
    const postCreateCompleteRunIds = selectCompleteGovernedRunIdsFromCounts({
      runRows: postCreateRunRows,
      checkpointCountByRunId: new Map(postCreateCheckpointCountRows.map(row => [row.simulationRunId, Number(row.checkpointCount)])),
      stageEvidenceCountByRunId: new Map(
        postCreateEvidenceCountRows
          .filter(row => !!row.simulationRunId)
          .map(row => [row.simulationRunId!, Number(row.evidenceCount)]),
      ),
    })
    const governedSelection = selectGovernedCorpusRuns(postCreateRunRows, PROOF_CORPUS_MANIFEST, postCreateCompleteRunIds)
    const selectedGovernedRuns = governedSelection.selectedRunRows.filter(row => governedSeeds.includes(row.seed))
    const selectedGovernedRunIds = new Set(selectedGovernedRuns.map(row => row.simulationRunId))
    const activeRunId = selectedGovernedRuns.at(-1)?.simulationRunId ?? createdRunIds.at(-1) ?? reusedRunIds.at(-1)
    if (!activeRunId) throw new Error('No governed proof runs were available for evaluation')
    logProgress(
      `selected ${selectedGovernedRuns.length}/${governedSeeds.length} governed runs `
      + `(duplicates skipped: ${governedSelection.skippedDuplicateManifestRunIds.length}, incomplete skipped: ${governedSelection.skippedIncompleteManifestRunIds.length}, non-manifest skipped: ${governedSelection.skippedNonManifestRunIds.length})`,
    )

    logProgress(`activating run ${activeRunId}`)
    await activateProofSimulationRun(current.db, {
      simulationRunId: activeRunId,
      actorFacultyId: null,
      now: TEST_NOW,
    })
    logProgress(`recomputing governed risk artifacts for run ${activeRunId}`)
    await recomputeObservedOnlyRisk(current.db, {
      simulationRunId: activeRunId,
      policy: resolvedPolicy.effectivePolicy,
      actorFacultyId: null,
      now: TEST_NOW,
    })
    logProgress(`recompute finished after ${roundToTwo((Date.now() - startedAt) / 1000)}s`)

    const selectedGovernedRunIdList = [...selectedGovernedRunIds].sort()
    const [
      artifactRows,
      modelActiveResponse,
      modelEvaluationResponse,
      modelCorrelationResponse,
    ] = await Promise.all([
      current.db.select().from(riskModelArtifacts).where(eq(riskModelArtifacts.batchId, MSRUAS_PROOF_BATCH_ID)),
      getProofRiskModelActive(current.db, { batchId: MSRUAS_PROOF_BATCH_ID }),
      getProofRiskModelEvaluation(current.db, { batchId: MSRUAS_PROOF_BATCH_ID, simulationRunId: null }),
      getProofRiskModelCorrelations(current.db, { batchId: MSRUAS_PROOF_BATCH_ID }),
    ])
    logProgress('loaded artifacts, checkpoints, and model diagnostics')

    const activeProductionArtifactRow = artifactRows.find(row => row.activeFlag === 1 && row.status === 'active' && row.artifactType === 'production') ?? null
    const activeCorrelationArtifactRow = artifactRows.find(row => row.activeFlag === 1 && row.status === 'active' && row.artifactType === 'correlation') ?? null
    if (!activeProductionArtifactRow || !activeCorrelationArtifactRow) {
      throw new Error('Active production or correlation artifact is missing after evaluation run generation')
    }
    const productionModel = JSON.parse(activeProductionArtifactRow.payloadJson)
    const correlations = JSON.parse(activeCorrelationArtifactRow.payloadJson)
    const selectedRunRows = selectedGovernedRuns
    const splitByRunId = new Map(selectedRunRows.map(row => [row.simulationRunId, manifestBySeed.get(row.seed)?.split ?? 'train']))
    const scenarioFamilyByRunId = new Map(selectedRunRows.map(row => [row.simulationRunId, manifestBySeed.get(row.seed)?.scenarioFamily ?? 'balanced']))
    const headLabels: Array<[RiskHeadKey, keyof ObservableLabelPayload]> = [
      ['attendanceRisk', 'attendanceRiskLabel'],
      ['ceRisk', 'ceShortfallLabel'],
      ['seeRisk', 'seeShortfallLabel'],
      ['overallCourseRisk', 'overallCourseFailLabel'],
      ['downstreamCarryoverRisk', 'downstreamCarryoverLabel'],
    ]

    const modelVsHeuristic = Object.fromEntries(headLabels.map(([headKey]) => [headKey, {
      model: [] as ProbabilityRow[],
      heuristic: [] as ProbabilityRow[],
    }])) as Record<RiskHeadKey, { model: ProbabilityRow[]; heuristic: ProbabilityRow[] }>
    const overallCourseRuntimeVsHeuristic = {
      model: [] as ProbabilityRow[],
      heuristic: [] as ProbabilityRow[],
    }
    const coEvidenceDiagnosticsPages: Array<ReturnType<typeof buildCoEvidenceDiagnosticsFromRows>> = []
    const perRunPolicyDiagnostics: Array<NonNullable<ReturnType<typeof buildPolicyDiagnostics>>> = []

    const actionRollupSeed = new Map<string, {
      cases: number
      immediateBenefits: number[]
      nextCheckpointImprovements: number[]
      recoveryFlags: number[]
    }>()
    const stageRollupSeed = new Map<string, {
      semesterNumber: number
      stageKey: string
      stageOrder: number
      projectionCount: number
      highRiskProjectionCount: number
      mediumRiskProjectionCount: number
      avgRisk: number[]
      avgCounterfactualLift: number[]
      openQueueProjectionCount: number
      uniqueStudents: Set<string>
      highRiskStudents: Set<string>
      openQueueStudents: Set<string>
      watchStudents: Set<string>
      actionableNoActionRiskByStudent: Map<string, number>
      sectionStats: Map<string, {
        uniqueStudents: Set<string>
        openQueueStudents: Set<string>
      }>
    }>()
    const queueStageRunSeed = new Map<string, QueueStageRunRollupSeed>()
    const splitSummary = {
      train: 0,
      validation: 0,
      test: 0,
    }
    const worldSplitSummary = {
      train: selectedRunRows.filter(row => splitByRunId.get(row.simulationRunId) === 'train').length,
      validation: selectedRunRows.filter(row => splitByRunId.get(row.simulationRunId) === 'validation').length,
      test: selectedRunRows.filter(row => splitByRunId.get(row.simulationRunId) === 'test').length,
    }
    const rowsBySemester: Record<string, number> = {}
    const rowsByStage: Record<string, number> = {}
    const rowsByScenarioFamily: Record<string, number> = {}
    const positiveCountsByHeadBySplit = Object.fromEntries(headLabels.map(([headKey]) => [headKey, {
      train: 0,
      validation: 0,
      test: 0,
    }])) as Record<RiskHeadKey, Record<SplitName, number>>
    let totalStageEvidenceRows = 0
    let totalTestRows = 0
    let lastEvidenceSnapshotId: string | null = null
    for (;;) {
      const conditions = [
        eq(riskEvidenceSnapshots.batchId, MSRUAS_PROOF_BATCH_ID),
        isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
        inArray(riskEvidenceSnapshots.simulationRunId, selectedGovernedRunIdList),
      ]
      if (lastEvidenceSnapshotId) conditions.push(gt(riskEvidenceSnapshots.riskEvidenceSnapshotId, lastEvidenceSnapshotId))
      const page = await current.db.select({
        riskEvidenceSnapshotId: riskEvidenceSnapshots.riskEvidenceSnapshotId,
        simulationRunId: riskEvidenceSnapshots.simulationRunId,
        semesterNumber: riskEvidenceSnapshots.semesterNumber,
        featureJson: riskEvidenceSnapshots.featureJson,
        labelJson: riskEvidenceSnapshots.labelJson,
        sourceRefsJson: riskEvidenceSnapshots.sourceRefsJson,
      }).from(riskEvidenceSnapshots).where(and(...conditions)).orderBy(
        asc(riskEvidenceSnapshots.riskEvidenceSnapshotId),
      ).limit(EVAL_PAGE_SIZE)
      if (page.length === 0) break
      for (const row of page) {
        if (!row.simulationRunId) continue
        const split = splitByRunId.get(row.simulationRunId)
        if (!split) continue
        totalStageEvidenceRows += 1
        splitSummary[split] += 1
        incrementCount(rowsBySemester, String(row.semesterNumber))
        const sourceRefs = JSON.parse(row.sourceRefsJson) as ObservableSourceRefs
        const labelPayload = JSON.parse(row.labelJson) as ObservableLabelPayload
        incrementCount(rowsByStage, sourceRefs.stageKey ?? 'active')
        incrementCount(rowsByScenarioFamily, scenarioFamilyByRunId.get(row.simulationRunId) ?? 'balanced')
        headLabels.forEach(([headKey, labelKey]) => {
          positiveCountsByHeadBySplit[headKey][split] += labelPayload[labelKey]
        })
        if (split !== 'test') continue
        totalTestRows += 1
        const featurePayload = JSON.parse(row.featureJson) as ObservableFeaturePayload
        const model = scoreObservableRiskWithModel({
          attendancePct: featurePayload.attendancePct,
          currentCgpa: featurePayload.currentCgpa,
          backlogCount: featurePayload.backlogCount,
          tt1Pct: featurePayload.tt1Pct,
          tt2Pct: featurePayload.tt2Pct,
          quizPct: featurePayload.quizPct,
          assignmentPct: featurePayload.assignmentPct,
          seePct: featurePayload.seePct,
          weakCoCount: featurePayload.weakCoCount,
          attendanceHistoryRiskCount: featurePayload.attendanceHistoryRiskCount,
          questionWeaknessCount: featurePayload.weakQuestionCount,
          interventionResponseScore: featurePayload.interventionResponseScore,
          policy: DEFAULT_POLICY,
          featurePayload,
          sourceRefs,
          productionModel,
          correlations,
        })
        const heuristic = inferObservableRisk({
          attendancePct: featurePayload.attendancePct,
          currentCgpa: featurePayload.currentCgpa,
          backlogCount: featurePayload.backlogCount,
          tt1Pct: featurePayload.tt1Pct,
          tt2Pct: featurePayload.tt2Pct,
          quizPct: featurePayload.quizPct,
          assignmentPct: featurePayload.assignmentPct,
          seePct: featurePayload.seePct,
          weakCoCount: featurePayload.weakCoCount,
          attendanceHistoryRiskCount: featurePayload.attendanceHistoryRiskCount,
          questionWeaknessCount: featurePayload.weakQuestionCount,
          interventionResponseScore: featurePayload.interventionResponseScore,
          policy: DEFAULT_POLICY,
        })
        overallCourseRuntimeVsHeuristic.model.push({
          label: labelPayload.overallCourseFailLabel,
          prob: model.headProbabilities.overallCourseRisk,
        })
        overallCourseRuntimeVsHeuristic.heuristic.push({
          label: labelPayload.overallCourseFailLabel,
          prob: heuristic.riskProb,
        })
        headLabels.forEach(([headKey, labelKey]) => {
          modelVsHeuristic[headKey].model.push({
            label: labelPayload[labelKey],
            prob: model.headProbabilities[headKey],
          })
          modelVsHeuristic[headKey].heuristic.push({
            label: labelPayload[labelKey],
            prob: heuristic.riskProb,
          })
        })
      }
      coEvidenceDiagnosticsPages.push(buildCoEvidenceDiagnosticsFromRows(page.map(row => {
        const sourceRefs = JSON.parse(row.sourceRefsJson) as ObservableSourceRefs
        return {
          semesterNumber: row.semesterNumber,
          courseFamily: sourceRefs.courseFamily ?? null,
          coEvidenceMode: sourceRefs.coEvidenceMode ?? null,
        }
      })))
      lastEvidenceSnapshotId = page[page.length - 1]?.riskEvidenceSnapshotId ?? null
    }

    for (const runRow of selectedRunRows) {
      const [projectionRows, queueRows, checkpointRows] = await Promise.all([
        current.db.select({
          simulationRunId: simulationStageStudentProjections.simulationRunId,
          simulationStageStudentProjectionId: simulationStageStudentProjections.simulationStageStudentProjectionId,
          simulationStageCheckpointId: simulationStageStudentProjections.simulationStageCheckpointId,
          studentId: simulationStageStudentProjections.studentId,
          offeringId: simulationStageStudentProjections.offeringId,
          semesterNumber: simulationStageStudentProjections.semesterNumber,
          courseCode: simulationStageStudentProjections.courseCode,
          sectionCode: simulationStageStudentProjections.sectionCode,
          riskProbScaled: simulationStageStudentProjections.riskProbScaled,
          riskBand: simulationStageStudentProjections.riskBand,
          noActionRiskProbScaled: simulationStageStudentProjections.noActionRiskProbScaled,
          simulatedActionTaken: simulationStageStudentProjections.simulatedActionTaken,
          queueState: simulationStageStudentProjections.queueState,
          projectionJson: simulationStageStudentProjections.projectionJson,
          checkpointSemesterNumber: simulationStageCheckpoints.semesterNumber,
          checkpointStageKey: simulationStageCheckpoints.stageKey,
          checkpointStageOrder: simulationStageCheckpoints.stageOrder,
        }).from(simulationStageStudentProjections)
          .innerJoin(
            simulationStageCheckpoints,
            eq(simulationStageStudentProjections.simulationStageCheckpointId, simulationStageCheckpoints.simulationStageCheckpointId),
          )
          .where(eq(simulationStageStudentProjections.simulationRunId, runRow.simulationRunId))
          .orderBy(
            asc(simulationStageStudentProjections.studentId),
            asc(simulationStageStudentProjections.semesterNumber),
            asc(simulationStageStudentProjections.courseCode),
            asc(simulationStageCheckpoints.semesterNumber),
            asc(simulationStageCheckpoints.stageOrder),
          ),
        current.db.select({
          status: simulationStageQueueProjections.status,
          checkpointSemesterNumber: simulationStageCheckpoints.semesterNumber,
          checkpointStageKey: simulationStageCheckpoints.stageKey,
          checkpointStageOrder: simulationStageCheckpoints.stageOrder,
        }).from(simulationStageQueueProjections)
          .innerJoin(
            simulationStageCheckpoints,
            eq(simulationStageQueueProjections.simulationStageCheckpointId, simulationStageCheckpoints.simulationStageCheckpointId),
          )
          .where(eq(simulationStageQueueProjections.simulationRunId, runRow.simulationRunId)),
        current.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, runRow.simulationRunId)),
      ])

      const runPolicyDiagnostics = buildPolicyDiagnostics({
        checkpointRows,
        studentRows: projectionRows,
      })
      if (runPolicyDiagnostics) perRunPolicyDiagnostics.push(runPolicyDiagnostics)
      const pendingActionByKey = new Map<string, { action: string; riskProbScaled: number; riskBand: string }>()
      projectionRows.forEach(row => {
        const stageKey = `${row.checkpointSemesterNumber}::${row.checkpointStageKey}`
        const stageRollup = stageRollupSeed.get(stageKey) ?? {
          semesterNumber: row.checkpointSemesterNumber,
          stageKey: row.checkpointStageKey,
          stageOrder: row.checkpointStageOrder,
          projectionCount: 0,
          highRiskProjectionCount: 0,
          mediumRiskProjectionCount: 0,
          avgRisk: [],
          avgCounterfactualLift: [],
          openQueueProjectionCount: 0,
          uniqueStudents: new Set<string>(),
          highRiskStudents: new Set<string>(),
          openQueueStudents: new Set<string>(),
          watchStudents: new Set<string>(),
          actionableNoActionRiskByStudent: new Map<string, number>(),
          sectionStats: new Map<string, { uniqueStudents: Set<string>; openQueueStudents: Set<string> }>(),
        }
        const queueStageRunKey = `${row.simulationRunId}::${stageKey}`
        const queueStudentKey = queueRollupStudentKey(row.simulationRunId, row.studentId)
        const queueSectionKey = queueRollupSectionKey(row.simulationRunId, row.sectionCode)
        const queueStageRunRollup = queueStageRunSeed.get(queueStageRunKey) ?? {
          simulationRunId: row.simulationRunId,
          semesterNumber: row.checkpointSemesterNumber,
          stageKey: row.checkpointStageKey,
          stageOrder: row.checkpointStageOrder,
          uniqueStudents: new Set<string>(),
          openQueueStudents: new Set<string>(),
          watchStudents: new Set<string>(),
          actionableNoActionRiskByStudent: new Map<string, number>(),
          sectionStats: new Map<string, { uniqueStudents: Set<string>; openQueueStudents: Set<string> }>(),
        }
        const sectionStats = stageRollup.sectionStats.get(row.sectionCode) ?? {
          uniqueStudents: new Set<string>(),
          openQueueStudents: new Set<string>(),
        }
        const queueSectionStats = queueStageRunRollup.sectionStats.get(queueSectionKey) ?? {
          uniqueStudents: new Set<string>(),
          openQueueStudents: new Set<string>(),
        }
        stageRollup.projectionCount += 1
        stageRollup.uniqueStudents.add(row.studentId)
        sectionStats.uniqueStudents.add(row.studentId)
        queueStageRunRollup.uniqueStudents.add(queueStudentKey)
        queueSectionStats.uniqueStudents.add(queueStudentKey)
        if (row.riskBand === 'High') {
          stageRollup.highRiskProjectionCount += 1
          stageRollup.highRiskStudents.add(row.studentId)
        }
        if (row.riskBand === 'Medium') stageRollup.mediumRiskProjectionCount += 1
        stageRollup.avgRisk.push(row.riskProbScaled)
        stageRollup.avgCounterfactualLift.push(row.noActionRiskProbScaled - row.riskProbScaled)
        if (row.queueState === 'open' || row.queueState === 'opened') {
          stageRollup.openQueueProjectionCount += 1
          stageRollup.openQueueStudents.add(row.studentId)
          sectionStats.openQueueStudents.add(row.studentId)
          queueStageRunRollup.openQueueStudents.add(queueStudentKey)
          queueSectionStats.openQueueStudents.add(queueStudentKey)
          const existingNoActionRisk = stageRollup.actionableNoActionRiskByStudent.get(row.studentId) ?? 0
          stageRollup.actionableNoActionRiskByStudent.set(row.studentId, Math.max(existingNoActionRisk, row.noActionRiskProbScaled))
          const existingQueueNoActionRisk = queueStageRunRollup.actionableNoActionRiskByStudent.get(queueStudentKey) ?? 0
          queueStageRunRollup.actionableNoActionRiskByStudent.set(queueStudentKey, Math.max(existingQueueNoActionRisk, row.noActionRiskProbScaled))
          stageRollup.watchStudents.delete(row.studentId)
          queueStageRunRollup.watchStudents.delete(queueStudentKey)
        } else if (row.queueState === 'watch' && !stageRollup.openQueueStudents.has(row.studentId)) {
          stageRollup.watchStudents.add(row.studentId)
          if (!queueStageRunRollup.openQueueStudents.has(queueStudentKey)) {
            queueStageRunRollup.watchStudents.add(queueStudentKey)
          }
        }
        stageRollup.sectionStats.set(row.sectionCode, sectionStats)
        stageRollupSeed.set(stageKey, stageRollup)
        queueStageRunRollup.sectionStats.set(queueSectionKey, queueSectionStats)
        queueStageRunSeed.set(queueStageRunKey, queueStageRunRollup)

        const rankKey = stageRankKey(row.simulationRunId, row.studentId, row.semesterNumber, row.courseCode)
        const pending = pendingActionByKey.get(rankKey)
        if (pending) {
          const actionRollup = actionRollupSeed.get(pending.action) ?? {
            cases: 0,
            immediateBenefits: [],
            nextCheckpointImprovements: [],
            recoveryFlags: [],
          }
          actionRollup.nextCheckpointImprovements.push(pending.riskProbScaled - row.riskProbScaled)
          const riskDropped = pending.riskProbScaled - row.riskProbScaled >= 10
          const bandRankMap: Record<string, number> = { High: 2, Medium: 1, Low: 0 }
          const bandImproved = (bandRankMap[pending.riskBand] ?? 0) > (bandRankMap[row.riskBand] ?? 0)
          const fullRecovery = row.queueState === 'resolved' || row.riskBand === 'Low'
          actionRollup.recoveryFlags.push(fullRecovery || bandImproved || riskDropped ? 1 : 0)
          actionRollupSeed.set(pending.action, actionRollup)
          pendingActionByKey.delete(rankKey)
        }

        if (!row.simulatedActionTaken) return
        const actionRollup = actionRollupSeed.get(row.simulatedActionTaken) ?? {
          cases: 0,
          immediateBenefits: [],
          nextCheckpointImprovements: [],
          recoveryFlags: [],
        }
        actionRollup.cases += 1
        actionRollup.immediateBenefits.push(row.noActionRiskProbScaled - row.riskProbScaled)
        actionRollupSeed.set(row.simulatedActionTaken, actionRollup)
        pendingActionByKey.set(rankKey, {
          action: row.simulatedActionTaken,
          riskProbScaled: row.riskProbScaled,
          riskBand: row.riskBand,
        })
      })

      queueRows.forEach(row => {
        const stageKey = `${row.checkpointSemesterNumber}::${row.checkpointStageKey}`
        const stageRollup = stageRollupSeed.get(stageKey) ?? {
          semesterNumber: row.checkpointSemesterNumber,
          stageKey: row.checkpointStageKey,
          stageOrder: row.checkpointStageOrder,
          projectionCount: 0,
          highRiskProjectionCount: 0,
          mediumRiskProjectionCount: 0,
          avgRisk: [],
          avgCounterfactualLift: [],
          openQueueProjectionCount: 0,
          uniqueStudents: new Set<string>(),
          highRiskStudents: new Set<string>(),
          openQueueStudents: new Set<string>(),
          watchStudents: new Set<string>(),
          actionableNoActionRiskByStudent: new Map<string, number>(),
          sectionStats: new Map<string, { uniqueStudents: Set<string>; openQueueStudents: Set<string> }>(),
        }
        stageRollupSeed.set(stageKey, stageRollup)
      })
    }

    const actionRollups: ActionRollup[] = Array.from(actionRollupSeed.entries())
      .map(([action, data]) => ({
        action,
        cases: data.cases,
        averageImmediateBenefitScaled: roundToOne(average(data.immediateBenefits)),
        averageNextCheckpointImprovementScaled: data.nextCheckpointImprovements.length > 0 ? roundToOne(average(data.nextCheckpointImprovements)) : null,
        recoveryRate: data.recoveryFlags.length > 0 ? roundToFour(average(data.recoveryFlags)) : null,
      }))
      .sort((left, right) => right.cases - left.cases || right.averageImmediateBenefitScaled - left.averageImmediateBenefitScaled)

    const stageRollups: StageRollup[] = Array.from(stageRollupSeed.entries())
      .map(([_stageKey, data]) => {
        const uniqueStudentCount = data.uniqueStudents.size
        const openQueueStudentCount = data.openQueueStudents.size
        const watchStudentCount = [...data.watchStudents].filter(studentId => !data.openQueueStudents.has(studentId)).length
        return {
          semesterNumber: data.semesterNumber,
          stageKey: data.stageKey,
          stageOrder: data.stageOrder,
          projectionCount: data.projectionCount,
          uniqueStudentCount,
          highRiskProjectionCount: data.highRiskProjectionCount,
          highRiskStudentCount: data.highRiskStudents.size,
          mediumRiskProjectionCount: data.mediumRiskProjectionCount,
          averageRiskProbScaled: roundToOne(average(data.avgRisk)),
          averageCounterfactualLiftScaled: roundToOne(average(data.avgCounterfactualLift)),
          openQueueProjectionCount: data.openQueueProjectionCount,
          openQueueStudentCount,
          watchStudentCount,
          studentCount: data.projectionCount,
          highRiskCount: data.highRiskProjectionCount,
          mediumRiskCount: data.mediumRiskProjectionCount,
          openQueueCount: data.openQueueProjectionCount,
        }
      })
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)

    const modelSummary = Object.fromEntries(headLabels.map(([headKey]) => {
      const modelMetrics = summarizeMetrics(modelVsHeuristic[headKey].model)
      const heuristicMetrics = summarizeMetrics(modelVsHeuristic[headKey].heuristic)
      return [headKey, {
        model: modelMetrics,
        heuristic: heuristicMetrics,
        brierLift: roundToFour(heuristicMetrics.brier - modelMetrics.brier),
        aucLift: roundToFour(modelMetrics.rocAuc - heuristicMetrics.rocAuc),
      }]
    })) as Record<RiskHeadKey, RuntimeSummary>
    const runtimeModelMetrics = summarizeMetrics(overallCourseRuntimeVsHeuristic.model)
    const runtimeHeuristicMetrics = summarizeMetrics(overallCourseRuntimeVsHeuristic.heuristic)
    const overallCourseRuntimeSummary: RuntimeSummary = {
      model: runtimeModelMetrics,
      heuristic: runtimeHeuristicMetrics,
      brierLift: roundToFour(runtimeHeuristicMetrics.brier - runtimeModelMetrics.brier),
      aucLift: roundToFour(runtimeModelMetrics.rocAuc - runtimeHeuristicMetrics.rocAuc),
    }
    const adminProductionDiagnostics = modelEvaluationResponse.production ?? null
    const policyDiagnostics = mergePolicyDiagnostics(perRunPolicyDiagnostics)
    const coEvidenceDiagnostics = mergeCoEvidenceDiagnostics(coEvidenceDiagnosticsPages)
    const uiParityDiagnostics = adminProductionDiagnostics?.uiParityDiagnostics ?? null
    const carryoverHeadArtifact = modelActiveResponse.production?.heads?.downstreamCarryoverRisk ?? null
    const carryoverHeadSummary = {
      modelMetrics: modelSummary.downstreamCarryoverRisk,
      calibrationMethod: carryoverHeadArtifact?.calibration?.method ?? null,
      displayProbabilityAllowed: carryoverHeadArtifact?.calibration?.displayProbabilityAllowed ?? null,
      supportWarning: carryoverHeadArtifact?.calibration?.supportWarning ?? null,
    }
    const queueRunObservations: QueueBurdenRunObservation[] = Array.from(queueStageRunSeed.values())
      .map(seed => {
        const sectionMaxActionableRate = roundToFour(Math.max(0, ...[...seed.sectionStats.values()].map(section => (
          section.uniqueStudents.size > 0 ? section.openQueueStudents.size / section.uniqueStudents.size : 0
        ))))
        const actionableQueuePpvProxy = seed.openQueueStudents.size > 0
          ? roundToFour(
            [...seed.actionableNoActionRiskByStudent.values()].reduce((sum, value) => sum + value, 0)
            / (seed.actionableNoActionRiskByStudent.size * 100),
          )
          : 0
        return {
          simulationRunId: seed.simulationRunId,
          semesterNumber: seed.semesterNumber,
          stageKey: seed.stageKey,
          stageOrder: seed.stageOrder,
          uniqueStudentCount: seed.uniqueStudents.size,
          openQueueStudentCount: seed.openQueueStudents.size,
          watchStudentCount: [...seed.watchStudents].filter(studentId => !seed.openQueueStudents.has(studentId)).length,
          sectionMaxActionableRate,
          actionableQueuePpvProxy,
        }
      })
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder || left.simulationRunId.localeCompare(right.simulationRunId))
    const queueBurdenByStage = buildQueueBurdenStageSummaries(queueRunObservations)
    const diagnosticCrossRunUnionByStage = stageRollups.map(item => {
      const stageKey = `${item.semesterNumber}::${item.stageKey}`
      const seed = stageRollupSeed.get(stageKey)
      const actionableOpenRate = item.uniqueStudentCount > 0 ? roundToFour(item.openQueueStudentCount / item.uniqueStudentCount) : 0
      const watchRate = item.uniqueStudentCount > 0 ? roundToFour(item.watchStudentCount / item.uniqueStudentCount) : 0
      const sectionMaxActionableRate = seed
        ? roundToFour(Math.max(0, ...[...seed.sectionStats.values()].map(section => (
          section.uniqueStudents.size > 0 ? section.openQueueStudents.size / section.uniqueStudents.size : 0
        ))))
        : 0
      const actionableQueuePpvProxy = item.openQueueStudentCount > 0 && seed
        ? roundToFour(
          [...seed.actionableNoActionRiskByStudent.values()].reduce((sum, value) => sum + value, 0)
          / (seed.actionableNoActionRiskByStudent.size * 100),
        )
        : 0
      return {
        semesterNumber: item.semesterNumber,
        stageKey: item.stageKey,
        stageOrder: item.stageOrder,
        uniqueStudentCount: item.uniqueStudentCount,
        openQueueStudentCount: item.openQueueStudentCount,
        watchStudentCount: item.watchStudentCount,
        actionableOpenRate,
        watchRate,
        actionableQueuePpvProxy,
        threshold: roundToFour(proofQueueActionableRateLimitForStage(item.stageKey)),
        sectionMaxActionableRate,
      }
    })
    const queueBurdenSummary = {
      metricNote: 'Queue burden acceptance uses per-run stage statistics. Open queue counts reflect actionable items only; watching rows remain visible but do not block progression. Cross-run union counts are retained only as a diagnostic view.',
      thresholds: PROOF_QUEUE_GOVERNANCE_THRESHOLDS,
      byStage: queueBurdenByStage,
      diagnosticCrossRunUnionByStage,
      acceptanceGates: {
        actionableRatesWithinLimit: queueBurdenByStage.every(item => item.passesActionableRate),
        sectionToleranceWithinLimit: queueBurdenByStage.every(item => item.passesSectionTolerance),
        watchRatesWithinLimit: queueBurdenByStage.every(item => item.passesWatchRate),
        actionableQueuePpvProxyWithinLimit: queueBurdenByStage.every(item => item.passesPpvProxy),
      },
    }
    const acceptanceGateSummary = {
      policy: policyDiagnostics?.acceptanceGates ?? null,
      coEvidence: coEvidenceDiagnostics?.acceptanceGates ?? null,
      queueBurden: queueBurdenSummary.acceptanceGates,
    }

    const output = {
      generatedAt: new Date().toISOString(),
      requestedSeeds,
      governedSeeds,
      skippedRequestedSeeds,
      createdRunIds,
      reusedRunIds,
      corpus: {
        manifestVersion: PROOF_CORPUS_MANIFEST_VERSION,
        totalStageEvidenceRows,
        totalTestRows,
        sourceRunCount: selectedRunRows.length,
        activeRunId,
        splitSummary,
        worldSplitSummary,
        scenarioFamilySummary: Object.fromEntries(
          [...new Set(PROOF_CORPUS_MANIFEST.map(entry => entry.scenarioFamily))].map(family => [
            family,
            selectedRunRows.filter(row => scenarioFamilyByRunId.get(row.simulationRunId) === family).length,
          ]),
        ),
        rowsBySemester,
        rowsByStage,
        rowsByScenarioFamily,
        positiveCountsByHeadBySplit,
        duplicateGovernedRunCount: governedSelection.skippedDuplicateManifestRunIds.length,
        duplicateGovernedRunIds: governedSelection.skippedDuplicateManifestRunIds,
        incompleteGovernedRunCount: governedSelection.skippedIncompleteManifestRunIds.length,
        incompleteGovernedRunIds: governedSelection.skippedIncompleteManifestRunIds,
        skippedNonManifestRunCount: governedSelection.skippedNonManifestRunIds.length,
        skippedNonManifestRunIds: governedSelection.skippedNonManifestRunIds,
        missingManifestSeeds: governedSelection.skippedSeeds,
      },
      artifact: {
        activeProductionArtifactVersion: activeProductionArtifactRow.artifactVersion,
        modelFamily: activeProductionArtifactRow.modelFamily,
        createdAt: activeProductionArtifactRow.createdAt,
        evaluationFromAdminEndpoint: modelEvaluationResponse,
        activeModelFromEndpoint: modelActiveResponse,
        correlationsFromEndpoint: modelCorrelationResponse,
      },
      overallCourseRuntimeSummary,
      runtimeSummary: overallCourseRuntimeSummary,
      modelSummary,
      carryoverHeadSummary,
      policyDiagnostics,
      coEvidenceDiagnostics,
      uiParityDiagnostics,
      acceptanceGateSummary,
      actionRollups,
      stageRollups,
      queueBurdenSummary,
      topPrerequisiteEdges: modelCorrelationResponse.correlations?.prerequisiteEdges ?? [],
    }

    const paths = evaluationPaths(process.cwd())
    await mkdir(paths.outputDir, { recursive: true })
    await writeFile(paths.jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
    logProgress(`wrote JSON report to ${paths.jsonPath}`)

    const markdown = [
      '# Proof Risk Model Evaluation',
      '',
      `Generated at: ${output.generatedAt}`,
      '',
      '## Corpus',
      '',
      `- Requested seeds: ${requestedSeeds.join(', ')}`,
      `- Governed seeds evaluated: ${governedSeeds.join(', ')}`,
      `- Reused existing governed runs: ${reusedRunIds.length}`,
      `- Created governed runs: ${createdRunIds.length}`,
      `- Skipped requested non-manifest seeds: ${skippedRequestedSeeds.length > 0 ? skippedRequestedSeeds.join(', ') : 'none'}`,
      `- Proof runs in corpus: ${output.corpus.sourceRunCount}`,
      `- Total checkpoint evidence rows: ${output.corpus.totalStageEvidenceRows}`,
      `- Held-out test rows: ${output.corpus.totalTestRows}`,
      `- Active run used for UI parity: ${output.corpus.activeRunId}`,
      `- Duplicate governed runs skipped: ${output.corpus.duplicateGovernedRunCount}`,
      `- Non-manifest runs skipped: ${output.corpus.skippedNonManifestRunCount}`,
      '',
      '## Overall Course Runtime Risk',
      '',
      markdownTable(
        ['Scorer', 'Brier', 'ROC-AUC', 'ECE', 'Positive Rate', 'Support'],
        [
          ['model', output.overallCourseRuntimeSummary.model.brier, output.overallCourseRuntimeSummary.model.rocAuc, output.overallCourseRuntimeSummary.model.expectedCalibrationError, output.overallCourseRuntimeSummary.model.positiveRate, output.overallCourseRuntimeSummary.model.support],
          ['heuristic', output.overallCourseRuntimeSummary.heuristic.brier, output.overallCourseRuntimeSummary.heuristic.rocAuc, output.overallCourseRuntimeSummary.heuristic.expectedCalibrationError, output.overallCourseRuntimeSummary.heuristic.positiveRate, output.overallCourseRuntimeSummary.heuristic.support],
        ],
      ),
      '',
      `- Overall-course runtime Brier lift: ${output.overallCourseRuntimeSummary.brierLift}`,
      `- Overall-course runtime AUC lift: ${output.overallCourseRuntimeSummary.aucLift}`,
      '',
      '## Head Metrics',
      '',
      markdownTable(
        ['Head', 'Model Brier', 'Heuristic Brier', 'Brier Lift', 'Model ROC-AUC', 'Heuristic ROC-AUC', 'AUC Lift', 'Model ECE', 'Heuristic ECE'],
        headLabels.map(([headKey]) => {
          const summary = output.modelSummary[headKey]
          return [
            headKey,
            summary.model.brier,
            summary.heuristic.brier,
            summary.brierLift,
            summary.model.rocAuc,
            summary.heuristic.rocAuc,
            summary.aucLift,
            summary.model.expectedCalibrationError,
            summary.heuristic.expectedCalibrationError,
          ]
        }),
      ),
      '',
      '## Action Rollups',
      '',
      markdownTable(
        ['Action', 'Cases', 'Immediate Benefit (scaled points)', 'Next-Checkpoint Lift (Lower is Better)', 'Recovery Rate'],
        actionRollups.map(item => [
          item.action,
          item.cases,
          item.averageImmediateBenefitScaled,
          item.averageNextCheckpointImprovementScaled ?? 'NA',
          item.recoveryRate ?? 'NA',
        ]),
      ),
      '',
      '## Policy Diagnostics',
      '',
      policyDiagnostics
        ? markdownTable(
          ['Phenotype', 'Support', 'Avg Lift', 'Avg Regret', 'Beats No Action', 'Teacher Efficacy Allowed'],
          Object.entries((policyDiagnostics.byPhenotype ?? {}) as Record<string, {
            support?: number
            averageCounterfactualLiftScaled?: number
            averageRegret?: number
            beatsNoActionOnAverage?: boolean
            teacherFacingEfficacyAllowed?: boolean
          }>).map(([phenotype, summary]) => [
            phenotype,
            summary.support ?? 0,
            summary.averageCounterfactualLiftScaled ?? 0,
            summary.averageRegret ?? 0,
            String(summary.beatsNoActionOnAverage ?? false),
            String(summary.teacherFacingEfficacyAllowed ?? false),
          ]),
        )
        : 'Policy diagnostics unavailable.',
      '',
      `- Policy acceptance gates: ${JSON.stringify(acceptanceGateSummary.policy ?? {})}`,
      '',
      '## CO Evidence Diagnostics',
      '',
      coEvidenceDiagnostics
        ? markdownTable(
          ['Metric', 'Value'],
          [
            ['totalRows', coEvidenceDiagnostics.totalRows ?? 0],
            ['fallbackCount', coEvidenceDiagnostics.fallbackCount ?? 0],
            ['theoryFallbackCount', coEvidenceDiagnostics.theoryFallbackCount ?? 0],
            ['labFallbackCount', coEvidenceDiagnostics.labFallbackCount ?? 0],
          ],
        )
        : 'CO evidence diagnostics unavailable.',
      '',
      `- CO evidence acceptance gates: ${JSON.stringify(acceptanceGateSummary.coEvidence ?? {})}`,
      '',
      '## Queue Burden',
      '',
      markdownTable(
        ['Semester', 'Stage', 'Runs', 'Mean Open', 'Median Open', 'P95 Open', 'Max Open', 'Mean Watch', 'P95 Watch', 'P95 Section Max', 'Mean PPV', 'Min PPV', 'Threshold'],
        queueBurdenSummary.byStage.map(item => [
          item.semesterNumber,
          item.stageKey,
          item.runCount,
          item.meanActionableOpenRate,
          item.medianActionableOpenRate,
          item.p95ActionableOpenRate,
          item.maxActionableOpenRate,
          item.meanWatchRate,
          item.p95WatchRate,
          item.p95SectionMaxActionableRate,
          item.meanActionableQueuePpvProxy,
          item.minActionableQueuePpvProxy,
          item.threshold,
        ]),
      ),
      '',
      `- Queue burden acceptance gates: ${JSON.stringify(acceptanceGateSummary.queueBurden ?? {})}`,
      '',
      '### Queue Burden Diagnostic Cross-Run Union',
      '',
      markdownTable(
        ['Semester', 'Stage', 'Unique Students', 'Open Queue Students', 'Watch Students', 'Open Rate', 'Watch Rate', 'PPV Proxy', 'Threshold', 'Section Max Rate'],
        queueBurdenSummary.diagnosticCrossRunUnionByStage.map(item => [
          item.semesterNumber,
          item.stageKey,
          item.uniqueStudentCount,
          item.openQueueStudentCount,
          item.watchStudentCount,
          item.actionableOpenRate,
          item.watchRate,
          item.actionableQueuePpvProxy,
          item.threshold,
          item.sectionMaxActionableRate,
        ]),
      ),
      '',
      '## Carryover Head',
      '',
      markdownTable(
        ['Metric', 'Value'],
        [
          ['Brier lift', carryoverHeadSummary.modelMetrics.brierLift],
          ['AUC lift', carryoverHeadSummary.modelMetrics.aucLift],
          ['Calibration method', carryoverHeadSummary.calibrationMethod ?? 'NA'],
          ['Display probability allowed', String(carryoverHeadSummary.displayProbabilityAllowed ?? 'NA')],
          ['Support warning', carryoverHeadSummary.supportWarning ?? 'NA'],
        ],
      ),
      '',
      '## Stage Rollups',
      '',
      markdownTable(
        ['Semester', 'Stage', 'Projection Rows', 'Unique Students', 'High Risk Rows', 'High Risk Students', 'Medium Risk Rows', 'Avg Risk', 'Avg Lift', 'Open Queue Rows', 'Open Queue Students', 'Watch Students'],
        stageRollups.map(item => [
          item.semesterNumber,
          item.stageKey,
          item.projectionCount,
          item.uniqueStudentCount,
          item.highRiskProjectionCount,
          item.highRiskStudentCount,
          item.mediumRiskProjectionCount,
          item.averageRiskProbScaled,
          item.averageCounterfactualLiftScaled,
          item.openQueueProjectionCount,
          item.openQueueStudentCount,
          item.watchStudentCount,
        ]),
      ),
      '',
    ].join('\n')
    await writeFile(paths.markdownPath, `${markdown}\n`, 'utf8')
    logProgress(`wrote Markdown report to ${paths.markdownPath}`)
    logProgress(`evaluation completed in ${roundToTwo((Date.now() - startedAt) / 1000)}s`)

    console.log(JSON.stringify(output, null, 2))
    console.log(`\nJSON report: ${paths.jsonPath}`)
    console.log(`Markdown report: ${paths.markdownPath}`)
  } finally {
    await current.close()
  }
}

const invokedAsScript = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false

if (invokedAsScript) {
  await main()
}
