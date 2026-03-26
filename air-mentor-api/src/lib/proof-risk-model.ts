import { createHash } from 'node:crypto'
import { inferObservableDrivers, inferObservableRisk, type ObservableInferenceInput, type ObservableInferenceOutput } from './inference-engine.js'
import { parseJson } from './json.js'

export const RISK_FEATURE_SCHEMA_VERSION = 'observable-risk-features-v3'
export const RISK_PRODUCTION_MODEL_VERSION = 'observable-risk-logit-v5'
export const RISK_CHALLENGER_MODEL_VERSION = 'observable-risk-stump-v4'
export const RISK_CORRELATION_ARTIFACT_VERSION = 'observable-risk-correlations-v4'
export const RISK_CALIBRATION_VERSION = 'post-hoc-calibration-v1'
export const PROOF_CORPUS_MANIFEST_VERSION = 'proof-corpus-v1'
export const PRODUCTION_RISK_THRESHOLDS = {
  medium: 0.4,
  high: 0.85,
} as const

export const OBSERVABLE_FEATURE_KEYS = [
  'attendancePctScaled',
  'attendanceTrendScaled',
  'attendanceHistoryRiskScaled',
  'currentCgpaScaled',
  'backlogPressureScaled',
  'tt1RiskScaled',
  'tt2RiskScaled',
  'seeRiskScaled',
  'quizRiskScaled',
  'assignmentRiskScaled',
  'weakCoPressureScaled',
  'weakQuestionPressureScaled',
  'courseworkTtMismatchScaled',
  'ttMomentumRiskScaled',
  'interventionResidualRiskScaled',
  'prerequisitePressureScaled',
  'prerequisiteAverageRiskScaled',
  'prerequisiteFailurePressureScaled',
  'prerequisiteChainDepthScaled',
  'prerequisiteWeakCourseRateScaled',
  'prerequisiteCarryoverLoadScaled',
  'prerequisiteRecencyWeightedFailureScaled',
  'downstreamDependencyLoadScaled',
  'weakPrerequisiteChainCountScaled',
  'repeatedWeakPrerequisiteFamilyCountScaled',
  'semesterProgressScaled',
  'sectionPressureScaled',
] as const

export const PROOF_SCENARIO_FAMILIES = [
  'balanced',
  'weak-foundation',
  'low-attendance',
  'high-forgetting',
  'coursework-inflation',
  'exam-fragility',
  'carryover-heavy',
  'intervention-resistant',
] as const

export type ObservableFeatureKey = (typeof OBSERVABLE_FEATURE_KEYS)[number]
export type RiskHeadKey =
  | 'attendanceRisk'
  | 'ceRisk'
  | 'seeRisk'
  | 'overallCourseRisk'
  | 'downstreamCarryoverRisk'
export type SplitName = 'train' | 'validation' | 'test'
export type CalibrationMethod = 'identity' | 'sigmoid' | 'isotonic'
export type ScenarioFamily = (typeof PROOF_SCENARIO_FAMILIES)[number]

export type ProofCorpusManifestEntry = {
  seed: number
  split: SplitName
  scenarioFamily: ScenarioFamily
}

export const PROOF_CORPUS_MANIFEST: ProofCorpusManifestEntry[] = (() => {
  const entries: ProofCorpusManifestEntry[] = []
  for (let index = 0; index < 64; index += 1) {
    entries.push({
      seed: 101 + (index * 101),
      split: index < 40 ? 'train' : index < 52 ? 'validation' : 'test',
      scenarioFamily: PROOF_SCENARIO_FAMILIES[index % PROOF_SCENARIO_FAMILIES.length]!,
    })
  }
  return entries
})()

export type ObservableFeaturePayload = {
  attendancePct: number
  attendanceTrend: number
  attendanceHistoryRiskCount: number
  currentCgpa: number
  backlogCount: number
  tt1Pct: number | null
  tt2Pct: number | null
  seePct: number | null
  quizPct: number | null
  assignmentPct: number | null
  weakCoCount: number
  weakQuestionCount: number
  courseworkToTtGap: number
  ttMomentum: number
  interventionResponseScore: number | null
  prerequisitePressure: number
  prerequisiteAveragePct: number
  prerequisiteFailureCount: number
  prerequisiteChainDepth: number
  prerequisiteWeakCourseRate: number
  prerequisiteCarryoverLoad: number
  prerequisiteRecencyWeightedFailure: number
  downstreamDependencyLoad: number
  weakPrerequisiteChainCount: number
  repeatedWeakPrerequisiteFamilyCount: number
  semesterProgress: number
  sectionRiskRate: number
}

export type ObservableLabelPayload = {
  attendanceRiskLabel: 0 | 1
  ceShortfallLabel: 0 | 1
  seeShortfallLabel: 0 | 1
  overallCourseFailLabel: 0 | 1
  downstreamCarryoverLabel: 0 | 1
}

export type ObservableSourceRefs = {
  simulationRunId: string
  simulationStageCheckpointId: string | null
  studentId: string
  offeringId: string | null
  semesterNumber: number
  sectionCode: string
  courseCode: string
  courseTitle: string
  courseFamily?: string | null
  coEvidenceMode?: string | null
  stageKey: string | null
  prerequisiteCourseCodes: string[]
  prerequisiteWeakCourseCodes: string[]
  weakCourseOutcomeCodes: string[]
  dominantQuestionTopics: string[]
}

export type ObservableRiskEvidenceRow = {
  riskEvidenceSnapshotId: string
  batchId: string
  featurePayload: ObservableFeaturePayload
  labelPayload: ObservableLabelPayload
  sourceRefs: ObservableSourceRefs
}

type FeatureVector = Record<ObservableFeatureKey, number>

type ReliabilityBin = {
  lowerBound: number
  upperBound: number
  meanPredicted: number
  meanObserved: number
  count: number
}

export type RiskMetricSummary = {
  support: number
  positiveRate: number
  brierScore: number
  rocAuc: number
  expectedCalibrationError: number
}

type HeadSupportSummary = {
  trainSupport: number
  validationSupport: number
  testSupport: number
  trainPositives: number
  validationPositives: number
  testPositives: number
}

type ProbabilityCalibrationArtifact = {
  method: CalibrationMethod
  intercept: number | null
  slope: number | null
  thresholds: number[]
  values: number[]
  validationMetrics: RiskMetricSummary
  testMetrics: RiskMetricSummary
  displayProbabilityAllowed: boolean
  supportWarning: string | null
  reliabilityBins: ReliabilityBin[]
}

type LogisticHeadArtifact = {
  headKey: RiskHeadKey
  intercept: number
  weights: Record<ObservableFeatureKey, number>
  threshold: number
  metrics: RiskMetricSummary
  support: HeadSupportSummary
  calibration: ProbabilityCalibrationArtifact
}

type StumpHeadArtifact = {
  headKey: RiskHeadKey
  featureKey: ObservableFeatureKey
  threshold: number
  leftProb: number
  rightProb: number
  metrics: RiskMetricSummary
}

export type ProductionRiskModelArtifact = {
  modelVersion: string
  featureSchemaVersion: string
  trainedAt: string
  trainingManifestVersion: string
  splitSummary: Record<SplitName, number>
  worldSplitSummary: Record<SplitName, number>
  scenarioFamilySummary: Record<ScenarioFamily, number>
  headSupportSummary: Record<RiskHeadKey, HeadSupportSummary>
  thresholds: {
    medium: number
    high: number
  }
  calibrationVersion: string
  heads: Record<RiskHeadKey, LogisticHeadArtifact>
}

export type ChallengerRiskModelArtifact = {
  modelVersion: string
  featureSchemaVersion: string
  trainedAt: string
  trainingManifestVersion: string
  splitSummary: Record<SplitName, number>
  worldSplitSummary: Record<SplitName, number>
  scenarioFamilySummary: Record<ScenarioFamily, number>
  heads: Record<RiskHeadKey, StumpHeadArtifact>
}

export type PrerequisiteCorrelationEdge = {
  sourceCourseCode: string
  targetCourseCode: string
  support: number
  adverseRateWithPrereqWeak: number
  adverseRateWithoutPrereqWeak: number
  oddsLift: number
}

export type CorrelationArtifact = {
  artifactVersion: string
  featureSchemaVersion: string
  builtAt: string
  splitName: SplitName
  support: number
  scenarioFamilySummary: Record<ScenarioFamily, number>
  weakCoAssociation: {
    support: number
    adverseRateWithWeakCo: number
    adverseRateWithoutWeakCo: number
    riskLift: number
  }
  weakQuestionAssociation: {
    support: number
    adverseRateWithWeakQuestions: number
    adverseRateWithoutWeakQuestions: number
    riskLift: number
  }
  prerequisiteEdges: PrerequisiteCorrelationEdge[]
}

export type ProofRiskModelBundle = {
  production: ProductionRiskModelArtifact
  challenger: ChallengerRiskModelArtifact
  correlations: CorrelationArtifact
}

export type ProofRunModelMetadata = {
  simulationRunId: string
  seed: number
  scenarioFamily?: ScenarioFamily | null
  split?: SplitName | null
}

export type ModelBackedRiskOutput = ObservableInferenceOutput & {
  modelVersion: string
  calibrationVersion: string | null
  headProbabilities: Record<RiskHeadKey, number>
  queuePriorityScore: number
  crossCourseDrivers: string[]
  headDisplay: Record<RiskHeadKey, {
    displayProbabilityAllowed: boolean
    supportWarning: string | null
    calibrationMethod: CalibrationMethod
  }>
}

const HEAD_LABEL_KEYS: Record<RiskHeadKey, keyof ObservableLabelPayload> = {
  attendanceRisk: 'attendanceRiskLabel',
  ceRisk: 'ceShortfallLabel',
  seeRisk: 'seeShortfallLabel',
  overallCourseRisk: 'overallCourseFailLabel',
  downstreamCarryoverRisk: 'downstreamCarryoverLabel',
}

const HEAD_DISPLAY_ECE_LIMITS: Partial<Record<RiskHeadKey, number>> = {
  attendanceRisk: 0.08,
  seeRisk: 0.08,
  overallCourseRisk: 0.08,
  downstreamCarryoverRisk: 0.1,
}

const HEAD_SUPPORT_POSITIVE_MINIMUMS: Partial<Record<RiskHeadKey, number>> = {
  attendanceRisk: 100,
  seeRisk: 100,
  overallCourseRisk: 100,
  downstreamCarryoverRisk: 100,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function sigmoid(value: number) {
  if (value >= 0) {
    const exponent = Math.exp(-value)
    return 1 / (1 + exponent)
  }
  const exponent = Math.exp(value)
  return exponent / (1 + exponent)
}

function safePctToRisk(pct: number | null | undefined) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 0.5
  return clamp((100 - pct) / 100, 0, 1)
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function safeRatio(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (typeof numerator !== 'number' || !Number.isFinite(numerator)) return 0
  if (typeof denominator !== 'number' || !Number.isFinite(denominator) || denominator <= 0) return 0
  return clamp(numerator / denominator, 0, 1)
}

function average(values: number[]) {
  const filtered = values.filter(value => Number.isFinite(value))
  if (!filtered.length) return 0
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function hashBucket(input: string) {
  const digest = createHash('sha256').update(input).digest('hex').slice(0, 8)
  return Number.parseInt(digest, 16) % 100
}

function hashNumber(input: string) {
  const digest = createHash('sha256').update(input).digest('hex').slice(0, 12)
  return Number.parseInt(digest, 16)
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0.5
  const sorted = values.slice().sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))
  return sorted[index] ?? 0.5
}

function rocAuc(rows: Array<{ label: number; prob: number }>) {
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

function brierScore(rows: Array<{ label: number; prob: number }>) {
  if (!rows.length) return 0
  return rows.reduce((sum, row) => sum + ((row.label - row.prob) ** 2), 0) / rows.length
}

function expectedCalibrationError(rows: Array<{ label: number; prob: number }>, binCount = 10) {
  if (!rows.length) return 0
  let total = 0
  for (let index = 0; index < binCount; index += 1) {
    const min = index / binCount
    const max = (index + 1) / binCount
    const inBin = rows.filter(row => row.prob >= min && (index === binCount - 1 ? row.prob <= max : row.prob < max))
    if (!inBin.length) continue
    const avgProb = average(inBin.map(row => row.prob))
    const avgLabel = average(inBin.map(row => row.label))
    total += Math.abs(avgProb - avgLabel) * (inBin.length / rows.length)
  }
  return total
}

function buildMetricSummary(rows: Array<{ label: number; prob: number }>): RiskMetricSummary {
  return {
    support: rows.length,
    positiveRate: roundToFour(average(rows.map(row => row.label))),
    brierScore: roundToFour(brierScore(rows)),
    rocAuc: roundToFour(rocAuc(rows)),
    expectedCalibrationError: roundToFour(expectedCalibrationError(rows)),
  }
}

function buildReliabilityBins(rows: Array<{ label: number; prob: number }>, binCount = 10): ReliabilityBin[] {
  const bins: ReliabilityBin[] = []
  for (let index = 0; index < binCount; index += 1) {
    const lowerBound = index / binCount
    const upperBound = (index + 1) / binCount
    const inBin = rows.filter(row => row.prob >= lowerBound && (index === binCount - 1 ? row.prob <= upperBound : row.prob < upperBound))
    if (!inBin.length) continue
    bins.push({
      lowerBound: roundToFour(lowerBound),
      upperBound: roundToFour(upperBound),
      meanPredicted: roundToFour(average(inBin.map(row => row.prob))),
      meanObserved: roundToFour(average(inBin.map(row => row.label))),
      count: inBin.length,
    })
  }
  return bins
}

export function scenarioFamilyForSeed(seed: number): ScenarioFamily {
  return PROOF_SCENARIO_FAMILIES[Math.abs(seed) % PROOF_SCENARIO_FAMILIES.length]!
}

function proofManifestEntryForSeed(seed: number, manifest: ProofCorpusManifestEntry[]) {
  return manifest.find(entry => entry.seed === seed) ?? null
}

function inferWorldSplit(seed: number, manifest: ProofCorpusManifestEntry[]) {
  return proofManifestEntryForSeed(seed, manifest)?.split ?? null
}

function featureVectorFromPayload(payload: ObservableFeaturePayload): FeatureVector {
  const prerequisiteDepth = Math.max(0, safeNumber(payload.prerequisiteChainDepth))
  return {
    attendancePctScaled: clamp(payload.attendancePct / 100, 0, 1),
    attendanceTrendScaled: clamp((payload.attendanceTrend + 25) / 50, 0, 1),
    attendanceHistoryRiskScaled: clamp(payload.attendanceHistoryRiskCount / 4, 0, 1),
    currentCgpaScaled: clamp(payload.currentCgpa / 10, 0, 1),
    backlogPressureScaled: clamp(payload.backlogCount / 4, 0, 1),
    tt1RiskScaled: safePctToRisk(payload.tt1Pct),
    tt2RiskScaled: safePctToRisk(payload.tt2Pct),
    seeRiskScaled: safePctToRisk(payload.seePct),
    quizRiskScaled: safePctToRisk(payload.quizPct),
    assignmentRiskScaled: safePctToRisk(payload.assignmentPct),
    weakCoPressureScaled: clamp(payload.weakCoCount / 4, 0, 1),
    weakQuestionPressureScaled: clamp(payload.weakQuestionCount / 6, 0, 1),
    courseworkTtMismatchScaled: clamp((payload.courseworkToTtGap + 40) / 80, 0, 1),
    ttMomentumRiskScaled: clamp((-payload.ttMomentum + 30) / 60, 0, 1),
    interventionResidualRiskScaled: clamp(((payload.interventionResponseScore ?? 0) * -1 + 0.4) / 0.8, 0, 1),
    prerequisitePressureScaled: clamp(payload.prerequisitePressure, 0, 1),
    prerequisiteAverageRiskScaled: safePctToRisk(payload.prerequisiteAveragePct),
    prerequisiteFailurePressureScaled: clamp(payload.prerequisiteFailureCount / 3, 0, 1),
    prerequisiteChainDepthScaled: clamp(prerequisiteDepth / 6, 0, 1),
    prerequisiteWeakCourseRateScaled: safeRatio(payload.prerequisiteFailureCount, prerequisiteDepth),
    prerequisiteCarryoverLoadScaled: clamp(safeNumber(payload.prerequisiteCarryoverLoad), 0, 1),
    prerequisiteRecencyWeightedFailureScaled: clamp(safeNumber(payload.prerequisiteRecencyWeightedFailure), 0, 1),
    downstreamDependencyLoadScaled: clamp(safeNumber(payload.downstreamDependencyLoad), 0, 1),
    weakPrerequisiteChainCountScaled: clamp(safeNumber(payload.weakPrerequisiteChainCount) / 6, 0, 1),
    repeatedWeakPrerequisiteFamilyCountScaled: clamp(safeNumber(payload.repeatedWeakPrerequisiteFamilyCount) / 3, 0, 1),
    semesterProgressScaled: clamp(payload.semesterProgress, 0, 1),
    sectionPressureScaled: clamp(payload.sectionRiskRate, 0, 1),
  }
}

type PreparedRow = {
  key: string
  split: SplitName
  scenarioFamily: ScenarioFamily
  courseFamily: string
  featureVector: FeatureVector
  weakCoCount: number
  weakQuestionCount: number
  labelPayload: ObservableLabelPayload
  sourceRefs: ObservableSourceRefs
}

type CalibrationResult = {
  calibration: ProbabilityCalibrationArtifact
  validationPredictions: Array<{ label: number; prob: number }>
  testPredictions: Array<{ label: number; prob: number }>
}

function normalizeMetadataMap(metadata?: Map<string, ProofRunModelMetadata> | Record<string, ProofRunModelMetadata>) {
  if (!metadata) return new Map<string, ProofRunModelMetadata>()
  if (metadata instanceof Map) return metadata
  return new Map(Object.entries(metadata))
}

function toPreparedRow(
  row: ObservableRiskEvidenceRow,
  runMetadataById: Map<string, ProofRunModelMetadata>,
  manifest: ProofCorpusManifestEntry[],
): PreparedRow | null {
  const key = `${row.sourceRefs.simulationRunId}::${row.sourceRefs.studentId}::${row.sourceRefs.courseCode}::${row.sourceRefs.stageKey ?? 'active'}`
  const runMeta = runMetadataById.get(row.sourceRefs.simulationRunId)
  const seed = runMeta?.seed ?? hashBucket(row.sourceRefs.simulationRunId)
  const manifestEntry = proofManifestEntryForSeed(seed, manifest)
  const split = runMeta?.split ?? inferWorldSplit(seed, manifest)
  const scenarioFamily = runMeta?.scenarioFamily ?? manifestEntry?.scenarioFamily ?? null
  if (!split || !scenarioFamily) return null
  return {
    key,
    split,
    scenarioFamily,
    courseFamily: row.sourceRefs.courseFamily ?? 'general',
    featureVector: featureVectorFromPayload(row.featurePayload),
    weakCoCount: row.featurePayload.weakCoCount,
    weakQuestionCount: row.featurePayload.weakQuestionCount,
    labelPayload: row.labelPayload,
    sourceRefs: row.sourceRefs,
  }
}

function scoreWithLogisticRaw(head: Pick<LogisticHeadArtifact, 'intercept' | 'weights'>, vector: FeatureVector) {
  let logit = head.intercept
  for (const key of OBSERVABLE_FEATURE_KEYS) {
    logit += (head.weights[key] ?? 0) * vector[key]
  }
  return clamp(sigmoid(logit), 0.0001, 0.9999)
}

function applyCalibration(calibration: ProbabilityCalibrationArtifact, rawProb: number) {
  const clamped = clamp(rawProb, 0.0001, 0.9999)
  if (calibration.method === 'identity') return clamped
  if (calibration.method === 'sigmoid') {
    const logit = Math.log(clamped / (1 - clamped))
    return clamp(sigmoid(((calibration.slope ?? 1) * logit) + (calibration.intercept ?? 0)), 0.0001, 0.9999)
  }
  if (calibration.thresholds.length === 0 || calibration.values.length === 0) return clamped
  const index = calibration.thresholds.findIndex(threshold => clamped <= threshold)
  if (index === -1) return clamp(calibration.values[calibration.values.length - 1] ?? clamped, 0.0001, 0.9999)
  return clamp(calibration.values[index] ?? clamped, 0.0001, 0.9999)
}

function scoreWithLogistic(head: LogisticHeadArtifact, vector: FeatureVector) {
  return applyCalibration(head.calibration, scoreWithLogisticRaw(head, vector))
}

function scoreWithStump(head: StumpHeadArtifact, vector: FeatureVector) {
  return vector[head.featureKey] <= head.threshold ? head.leftProb : head.rightProb
}

function positiveCount(rows: PreparedRow[], labelKey: keyof ObservableLabelPayload) {
  return rows.filter(row => row.labelPayload[labelKey] === 1).length
}

function buildHeadSupport(rows: PreparedRow[], labelKey: keyof ObservableLabelPayload): HeadSupportSummary {
  const trainRows = rows.filter(row => row.split === 'train')
  const validationRows = rows.filter(row => row.split === 'validation')
  const testRows = rows.filter(row => row.split === 'test')
  return {
    trainSupport: trainRows.length,
    validationSupport: validationRows.length,
    testSupport: testRows.length,
    trainPositives: positiveCount(trainRows, labelKey),
    validationPositives: positiveCount(validationRows, labelKey),
    testPositives: positiveCount(testRows, labelKey),
  }
}

function supportWarningForHead(headKey: RiskHeadKey, support: HeadSupportSummary, metrics: RiskMetricSummary) {
  if (headKey === 'ceRisk') {
    return support.testPositives < 100
      ? 'CE shortfall remains sparse in the current proof corpus; expose as band and drivers only.'
      : null
  }
  const limit = HEAD_DISPLAY_ECE_LIMITS[headKey]
  const minimumPositives = HEAD_SUPPORT_POSITIVE_MINIMUMS[headKey]
  if (limit == null || minimumPositives == null) return null
  if (support.testSupport < 1000) return 'Held-out support is below the probability display threshold.'
  if (support.testPositives < minimumPositives) return 'Held-out positive support is below the probability display threshold.'
  if (metrics.expectedCalibrationError > limit) return 'Calibration remains above the probability display threshold.'
  return null
}

function displayProbabilityAllowedForHead(headKey: RiskHeadKey, support: HeadSupportSummary, metrics: RiskMetricSummary) {
  if (headKey === 'ceRisk') return false
  const limit = HEAD_DISPLAY_ECE_LIMITS[headKey]
  const minimumPositives = HEAD_SUPPORT_POSITIVE_MINIMUMS[headKey]
  if (limit == null || minimumPositives == null) return false
  return support.testSupport >= 1000
    && support.testPositives >= minimumPositives
    && metrics.expectedCalibrationError <= limit
}

function trainLogisticBase(rows: PreparedRow[], headKey: RiskHeadKey) {
  const labelKey = HEAD_LABEL_KEYS[headKey]
  const positives = rows.filter(row => row.labelPayload[labelKey] === 1).length
  const negatives = Math.max(1, rows.length - positives)
  const positiveWeight = positives > 0 ? rows.length / (2 * positives) : 1
  const negativeWeight = rows.length / (2 * negatives)
  const weights = Object.fromEntries(OBSERVABLE_FEATURE_KEYS.map(key => [key, 0])) as Record<ObservableFeatureKey, number>
  const baseRate = clamp(average(rows.map(row => row.labelPayload[labelKey])), 0.01, 0.99)
  let intercept = Math.log(baseRate / (1 - baseRate))
  const l2 = 0.015

  for (let iteration = 0; iteration < 160; iteration += 1) {
    const gradient = Object.fromEntries(OBSERVABLE_FEATURE_KEYS.map(key => [key, 0])) as Record<ObservableFeatureKey, number>
    let interceptGradient = 0
    for (const row of rows) {
      let logit = intercept
      for (const key of OBSERVABLE_FEATURE_KEYS) logit += weights[key] * row.featureVector[key]
      const prediction = sigmoid(logit)
      const label = row.labelPayload[labelKey]
      const rowWeight = label === 1 ? positiveWeight : negativeWeight
      const error = (prediction - label) * rowWeight
      interceptGradient += error
      for (const key of OBSERVABLE_FEATURE_KEYS) gradient[key] += error * row.featureVector[key]
    }
    const learningRate = 0.22 / (1 + (iteration / 70))
    intercept -= learningRate * (interceptGradient / Math.max(1, rows.length))
    for (const key of OBSERVABLE_FEATURE_KEYS) {
      const reg = l2 * weights[key]
      weights[key] -= learningRate * ((gradient[key] / Math.max(1, rows.length)) + reg)
    }
  }

  return {
    intercept: roundToFour(intercept),
    weights: Object.fromEntries(OBSERVABLE_FEATURE_KEYS.map(key => [key, roundToFour(weights[key])])) as Record<ObservableFeatureKey, number>,
  }
}

function fitSigmoidCalibration(rows: Array<{ label: number; rawProb: number }>) {
  if (!rows.length) {
    return { slope: 1, intercept: 0 }
  }
  let slope = 1
  let intercept = 0
  for (let iteration = 0; iteration < 120; iteration += 1) {
    let slopeGradient = 0
    let interceptGradient = 0
    for (const row of rows) {
      const clamped = clamp(row.rawProb, 0.0001, 0.9999)
      const rawLogit = Math.log(clamped / (1 - clamped))
      const prediction = sigmoid((slope * rawLogit) + intercept)
      const error = prediction - row.label
      slopeGradient += error * rawLogit
      interceptGradient += error
    }
    const learningRate = 0.08 / (1 + (iteration / 40))
    slope -= learningRate * (slopeGradient / Math.max(1, rows.length))
    intercept -= learningRate * (interceptGradient / Math.max(1, rows.length))
  }
  return {
    slope: roundToFour(slope),
    intercept: roundToFour(intercept),
  }
}

function fitIsotonicCalibration(rows: Array<{ label: number; rawProb: number }>) {
  const ordered = rows
    .map((row, index) => ({
      ...row,
      rawProb: clamp(row.rawProb, 0.0001, 0.9999),
      index,
    }))
    .sort((left, right) => left.rawProb - right.rawProb || left.index - right.index)
  const blocks = ordered.map(row => ({
    lower: row.rawProb,
    upper: row.rawProb,
    weight: 1,
    total: row.label,
    value: row.label,
  }))
  for (let index = 0; index < blocks.length - 1;) {
    if (blocks[index]!.value <= blocks[index + 1]!.value) {
      index += 1
      continue
    }
    const merged = {
      lower: blocks[index]!.lower,
      upper: blocks[index + 1]!.upper,
      weight: blocks[index]!.weight + blocks[index + 1]!.weight,
      total: blocks[index]!.total + blocks[index + 1]!.total,
      value: 0,
    }
    merged.value = merged.total / merged.weight
    blocks.splice(index, 2, merged)
    if (index > 0) index -= 1
  }
  return {
    thresholds: blocks.map(block => roundToFour(block.upper)),
    values: blocks.map(block => roundToFour(clamp(block.value, 0.0001, 0.9999))),
  }
}

function chooseCalibration(
  headKey: RiskHeadKey,
  validationRows: Array<{ label: number; rawProb: number }>,
  testRows: Array<{ label: number; rawProb: number }>,
  support: HeadSupportSummary,
): CalibrationResult {
  const candidates: ProbabilityCalibrationArtifact[] = []

  const buildCandidate = (method: CalibrationMethod, input: {
    intercept?: number | null
    slope?: number | null
    thresholds?: number[]
    values?: number[]
  }) => {
    const base: ProbabilityCalibrationArtifact = {
      method,
      intercept: input.intercept ?? null,
      slope: input.slope ?? null,
      thresholds: input.thresholds ?? [],
      values: input.values ?? [],
      validationMetrics: buildMetricSummary(validationRows.map(row => ({
        label: row.label,
        prob: applyCalibration({
          method,
          intercept: input.intercept ?? null,
          slope: input.slope ?? null,
          thresholds: input.thresholds ?? [],
          values: input.values ?? [],
          validationMetrics: buildMetricSummary([]),
          testMetrics: buildMetricSummary([]),
          displayProbabilityAllowed: false,
          supportWarning: null,
          reliabilityBins: [],
        }, row.rawProb),
      }))),
      testMetrics: buildMetricSummary(testRows.map(row => ({
        label: row.label,
        prob: applyCalibration({
          method,
          intercept: input.intercept ?? null,
          slope: input.slope ?? null,
          thresholds: input.thresholds ?? [],
          values: input.values ?? [],
          validationMetrics: buildMetricSummary([]),
          testMetrics: buildMetricSummary([]),
          displayProbabilityAllowed: false,
          supportWarning: null,
          reliabilityBins: [],
        }, row.rawProb),
      }))),
      displayProbabilityAllowed: false,
      supportWarning: null,
      reliabilityBins: [],
    }
    const metrics = testRows.length > 0 ? base.testMetrics : base.validationMetrics
    return {
      ...base,
      displayProbabilityAllowed: displayProbabilityAllowedForHead(headKey, support, metrics),
      supportWarning: supportWarningForHead(headKey, support, metrics),
      reliabilityBins: buildReliabilityBins((testRows.length > 0 ? testRows : validationRows).map(row => ({
        label: row.label,
        prob: applyCalibration(base, row.rawProb),
      }))),
    } satisfies ProbabilityCalibrationArtifact
  }

  candidates.push(buildCandidate('identity', {}))
  if (validationRows.length > 0) {
    const sigmoidCalibration = fitSigmoidCalibration(validationRows)
    candidates.push(buildCandidate('sigmoid', sigmoidCalibration))
    if (support.validationSupport >= 1000 && support.validationPositives >= 250) {
      const isotonicCalibration = fitIsotonicCalibration(validationRows)
      candidates.push(buildCandidate('isotonic', isotonicCalibration))
    }
  }

  const baseline = candidates[0]!
  const best = candidates.slice(1).reduce((currentBest, candidate) => {
    if (candidate.validationMetrics.brierScore < currentBest.validationMetrics.brierScore) return candidate
    if (candidate.validationMetrics.brierScore === currentBest.validationMetrics.brierScore
      && candidate.validationMetrics.expectedCalibrationError < currentBest.validationMetrics.expectedCalibrationError) {
      return candidate
    }
    return currentBest
  }, baseline)

  const selected = (
    best.validationMetrics.brierScore <= baseline.validationMetrics.brierScore
    || best.validationMetrics.expectedCalibrationError <= baseline.validationMetrics.expectedCalibrationError
  ) ? best : baseline

  return {
    calibration: selected,
    validationPredictions: validationRows.map(row => ({
      label: row.label,
      prob: applyCalibration(selected, row.rawProb),
    })),
    testPredictions: testRows.map(row => ({
      label: row.label,
      prob: applyCalibration(selected, row.rawProb),
    })),
  }
}

function sampleTrainingRows(rows: PreparedRow[], headKey: RiskHeadKey) {
  const labelKey = HEAD_LABEL_KEYS[headKey]
  const positives = rows.filter(row => row.labelPayload[labelKey] === 1)
  const negatives = rows.filter(row => row.labelPayload[labelKey] === 0)
  if (!negatives.length) return positives
  const targetNegativeCount = Math.min(
    negatives.length,
    Math.max(positives.length * 5, positives.length > 0 ? 0 : 20000, positives.length < 400 ? 20000 : 0),
  )
  if (targetNegativeCount >= negatives.length) {
    return [...positives, ...negatives].sort((left, right) => hashNumber(left.key) - hashNumber(right.key))
  }

  const byStratum = new Map<string, PreparedRow[]>()
  negatives.forEach(row => {
    const stratum = [
      row.scenarioFamily,
      row.sourceRefs.semesterNumber,
      row.sourceRefs.stageKey ?? 'active',
      row.sourceRefs.sectionCode,
      row.courseFamily,
    ].join('::')
    const group = byStratum.get(stratum)
    if (group) group.push(row)
    else byStratum.set(stratum, [row])
  })
  const orderedStrata = [...byStratum.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
  orderedStrata.forEach(([, group]) => {
    group.sort((left, right) => hashNumber(left.key) - hashNumber(right.key))
  })

  const selected = new Set<string>()
  let selectedCount = 0
  for (const [, group] of orderedStrata) {
    if (selectedCount >= targetNegativeCount) break
    const proportionalTake = Math.max(1, Math.floor((group.length / negatives.length) * targetNegativeCount))
    const take = Math.min(group.length, proportionalTake, targetNegativeCount - selectedCount)
    group.slice(0, take).forEach(row => selected.add(row.key))
    selectedCount += take
  }
  if (selectedCount < targetNegativeCount) {
    for (const [, group] of orderedStrata) {
      for (const row of group) {
        if (selectedCount >= targetNegativeCount) break
        if (selected.has(row.key)) continue
        selected.add(row.key)
        selectedCount += 1
      }
      if (selectedCount >= targetNegativeCount) break
    }
  }

  return [...positives, ...negatives.filter(row => selected.has(row.key))]
    .sort((left, right) => hashNumber(left.key) - hashNumber(right.key))
}

function fitLogisticHead(rows: PreparedRow[], headKey: RiskHeadKey) {
  const labelKey = HEAD_LABEL_KEYS[headKey]
  const trainRows = rows.filter(row => row.split === 'train')
  const validationRows = rows.filter(row => row.split === 'validation')
  const testRows = rows.filter(row => row.split === 'test')
  const sampledTrainRows = sampleTrainingRows(trainRows, headKey)
  const support = buildHeadSupport(rows, labelKey)
  const base = trainLogisticBase(sampledTrainRows, headKey)

  const rawValidation = validationRows.map(row => ({
    label: row.labelPayload[labelKey],
    rawProb: scoreWithLogisticRaw(base, row.featureVector),
  }))
  const rawTest = testRows.map(row => ({
    label: row.labelPayload[labelKey],
    rawProb: scoreWithLogisticRaw(base, row.featureVector),
  }))
  const calibrated = chooseCalibration(headKey, rawValidation, rawTest, support)
  const threshold = 0.75
  const metrics = calibrated.testPredictions.length > 0
    ? buildMetricSummary(calibrated.testPredictions)
    : buildMetricSummary(calibrated.validationPredictions)

  return {
    headKey,
    intercept: base.intercept,
    weights: base.weights,
    threshold: roundToFour(clamp(threshold, 0.35, 0.8)),
    metrics,
    support,
    calibration: calibrated.calibration,
  } satisfies LogisticHeadArtifact
}

function fitStumpHead(rows: PreparedRow[], headKey: RiskHeadKey) {
  const labelKey = HEAD_LABEL_KEYS[headKey]
  const trainRows = rows.filter(row => row.split === 'train')
  const validationRows = rows.filter(row => row.split === 'validation')
  const testRows = rows.filter(row => row.split === 'test')
  const sampledTrainRows = sampleTrainingRows(trainRows, headKey)
  let bestFeature: ObservableFeatureKey = OBSERVABLE_FEATURE_KEYS[0]
  let bestThreshold = 0.5
  let bestLeftProb = 0.5
  let bestRightProb = 0.5
  let bestScore = Number.POSITIVE_INFINITY

  for (const featureKey of OBSERVABLE_FEATURE_KEYS) {
    const values = sampledTrainRows.map(row => row.featureVector[featureKey]).filter(Number.isFinite)
    const thresholds = [...new Set([0.2, 0.35, 0.5, 0.65, 0.8].map(q => roundToFour(quantile(values, q))))]
    for (const threshold of thresholds) {
      const leftRows = sampledTrainRows.filter(row => row.featureVector[featureKey] <= threshold)
      const rightRows = sampledTrainRows.filter(row => row.featureVector[featureKey] > threshold)
      const leftProb = clamp(average(leftRows.map(row => row.labelPayload[labelKey])), 0.01, 0.99)
      const rightProb = clamp(average(rightRows.map(row => row.labelPayload[labelKey])), 0.01, 0.99)
      const scoreRows = (validationRows.length > 0 ? validationRows : sampledTrainRows).map(row => ({
        label: row.labelPayload[labelKey],
        prob: row.featureVector[featureKey] <= threshold ? leftProb : rightProb,
      }))
      const score = brierScore(scoreRows)
      if (score < bestScore) {
        bestFeature = featureKey
        bestThreshold = threshold
        bestLeftProb = leftProb
        bestRightProb = rightProb
        bestScore = score
      }
    }
  }

  const metrics = buildMetricSummary((testRows.length > 0 ? testRows : validationRows).map(row => ({
    label: row.labelPayload[labelKey],
    prob: row.featureVector[bestFeature] <= bestThreshold ? bestLeftProb : bestRightProb,
  })))

  return {
    headKey,
    featureKey: bestFeature,
    threshold: roundToFour(bestThreshold),
    leftProb: roundToFour(bestLeftProb),
    rightProb: roundToFour(bestRightProb),
    metrics,
  } satisfies StumpHeadArtifact
}

function aggregateRiskLift(rows: PreparedRow[], predicate: (row: PreparedRow) => boolean) {
  const withPredicate = rows.filter(predicate)
  const withoutPredicate = rows.filter(row => !predicate(row))
  const withRate = average(withPredicate.map(row => row.labelPayload.overallCourseFailLabel))
  const withoutRate = average(withoutPredicate.map(row => row.labelPayload.overallCourseFailLabel))
  return {
    support: rows.length,
    adverseRateWith: roundToFour(withRate),
    adverseRateWithout: roundToFour(withoutRate),
    riskLift: roundToFour(withRate - withoutRate),
  }
}

function buildScenarioFamilySummary(rows: PreparedRow[]) {
  return PROOF_SCENARIO_FAMILIES.reduce((summary, family) => ({
    ...summary,
    [family]: rows.filter(row => row.scenarioFamily === family).length,
  }), {} as Record<ScenarioFamily, number>)
}

function buildCorrelationArtifact(rows: PreparedRow[], now: string): CorrelationArtifact {
  const trainRows = rows.filter(row => row.split === 'train')
  const weakCoAssociation = aggregateRiskLift(trainRows, row => row.weakCoCount >= 2)
  const weakQuestionAssociation = aggregateRiskLift(trainRows, row => row.weakQuestionCount >= 3)

  const prereqEdgeAgg = new Map<string, {
    sourceCourseCode: string
    targetCourseCode: string
    support: number
    withWeakCount: number
    withWeakAdverseCount: number
    withoutWeakCount: number
    withoutWeakAdverseCount: number
  }>()
  trainRows
    .filter(row => row.sourceRefs.stageKey === 'post-see')
    .forEach(row => {
      const weakSet = new Set(row.sourceRefs.prerequisiteWeakCourseCodes)
      row.sourceRefs.prerequisiteCourseCodes.forEach(sourceCourseCode => {
        const key = `${sourceCourseCode}::${row.sourceRefs.courseCode}`
        const current = prereqEdgeAgg.get(key) ?? {
          sourceCourseCode,
          targetCourseCode: row.sourceRefs.courseCode,
          support: 0,
          withWeakCount: 0,
          withWeakAdverseCount: 0,
          withoutWeakCount: 0,
          withoutWeakAdverseCount: 0,
        }
        current.support += 1
        const adverse = row.labelPayload.overallCourseFailLabel === 1
        if (weakSet.has(sourceCourseCode)) {
          current.withWeakCount += 1
          if (adverse) current.withWeakAdverseCount += 1
        } else {
          current.withoutWeakCount += 1
          if (adverse) current.withoutWeakAdverseCount += 1
        }
        prereqEdgeAgg.set(key, current)
      })
    })

  const prerequisiteEdges = Array.from(prereqEdgeAgg.values())
    .filter(edge => edge.support >= 25 && edge.withWeakCount > 0 && edge.withoutWeakCount > 0)
    .map(edge => {
      const withRate = edge.withWeakAdverseCount / edge.withWeakCount
      const withoutRate = edge.withoutWeakAdverseCount / edge.withoutWeakCount
      return {
        sourceCourseCode: edge.sourceCourseCode,
        targetCourseCode: edge.targetCourseCode,
        support: edge.support,
        adverseRateWithPrereqWeak: roundToFour(withRate),
        adverseRateWithoutPrereqWeak: roundToFour(withoutRate),
        oddsLift: roundToFour(withRate - withoutRate),
      } satisfies PrerequisiteCorrelationEdge
    })
    .sort((left, right) => right.oddsLift - left.oddsLift || right.support - left.support)
    .slice(0, 16)

  return {
    artifactVersion: RISK_CORRELATION_ARTIFACT_VERSION,
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    builtAt: now,
    splitName: 'train',
    support: trainRows.length,
    scenarioFamilySummary: buildScenarioFamilySummary(trainRows),
    weakCoAssociation: {
      support: weakCoAssociation.support,
      adverseRateWithWeakCo: weakCoAssociation.adverseRateWith,
      adverseRateWithoutWeakCo: weakCoAssociation.adverseRateWithout,
      riskLift: weakCoAssociation.riskLift,
    },
    weakQuestionAssociation: {
      support: weakQuestionAssociation.support,
      adverseRateWithWeakQuestions: weakQuestionAssociation.adverseRateWith,
      adverseRateWithoutWeakQuestions: weakQuestionAssociation.adverseRateWithout,
      riskLift: weakQuestionAssociation.riskLift,
    },
    prerequisiteEdges,
  }
}

function trainPreparedProofRiskModel(
  preparedRows: PreparedRow[],
  now: string,
) {
  if (preparedRows.length < 40) return null

  const splitSummary = {
    train: preparedRows.filter(row => row.split === 'train').length,
    validation: preparedRows.filter(row => row.split === 'validation').length,
    test: preparedRows.filter(row => row.split === 'test').length,
  }
  const worldSplitSummary = preparedRows.reduce((summary, row) => {
    summary[row.split].add(row.sourceRefs.simulationRunId)
    return summary
  }, {
    train: new Set<string>(),
    validation: new Set<string>(),
    test: new Set<string>(),
  })
  const scenarioFamilySummary = buildScenarioFamilySummary(preparedRows)
  const productionHeads = {
    attendanceRisk: fitLogisticHead(preparedRows, 'attendanceRisk'),
    ceRisk: fitLogisticHead(preparedRows, 'ceRisk'),
    seeRisk: fitLogisticHead(preparedRows, 'seeRisk'),
    overallCourseRisk: fitLogisticHead(preparedRows, 'overallCourseRisk'),
    downstreamCarryoverRisk: fitLogisticHead(preparedRows, 'downstreamCarryoverRisk'),
  } satisfies Record<RiskHeadKey, LogisticHeadArtifact>

  const production: ProductionRiskModelArtifact = {
    modelVersion: RISK_PRODUCTION_MODEL_VERSION,
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    trainedAt: now,
    trainingManifestVersion: PROOF_CORPUS_MANIFEST_VERSION,
    splitSummary,
    worldSplitSummary: {
      train: worldSplitSummary.train.size,
      validation: worldSplitSummary.validation.size,
      test: worldSplitSummary.test.size,
    },
    scenarioFamilySummary,
    headSupportSummary: Object.fromEntries(
      (Object.entries(productionHeads) as Array<[RiskHeadKey, LogisticHeadArtifact]>).map(([headKey, head]) => [headKey, head.support]),
    ) as Record<RiskHeadKey, HeadSupportSummary>,
    thresholds: PRODUCTION_RISK_THRESHOLDS,
    calibrationVersion: RISK_CALIBRATION_VERSION,
    heads: productionHeads,
  }

  const challenger: ChallengerRiskModelArtifact = {
    modelVersion: RISK_CHALLENGER_MODEL_VERSION,
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    trainedAt: now,
    trainingManifestVersion: PROOF_CORPUS_MANIFEST_VERSION,
    splitSummary,
    worldSplitSummary: {
      train: worldSplitSummary.train.size,
      validation: worldSplitSummary.validation.size,
      test: worldSplitSummary.test.size,
    },
    scenarioFamilySummary,
    heads: {
      attendanceRisk: fitStumpHead(preparedRows, 'attendanceRisk'),
      ceRisk: fitStumpHead(preparedRows, 'ceRisk'),
      seeRisk: fitStumpHead(preparedRows, 'seeRisk'),
      overallCourseRisk: fitStumpHead(preparedRows, 'overallCourseRisk'),
      downstreamCarryoverRisk: fitStumpHead(preparedRows, 'downstreamCarryoverRisk'),
    },
  }
  const correlations = buildCorrelationArtifact(preparedRows, now)
  return { production, challenger, correlations }
}

const FEATURE_COUNT = OBSERVABLE_FEATURE_KEYS.length
const DATASET_BLOCK_SIZE = 16_384

const SPLIT_CODE_BY_NAME: Record<SplitName, 0 | 1 | 2> = {
  train: 0,
  validation: 1,
  test: 2,
}

const SPLIT_NAME_BY_CODE: Record<0 | 1 | 2, SplitName> = {
  0: 'train',
  1: 'validation',
  2: 'test',
}

const SCENARIO_FAMILY_CODE_BY_NAME: Record<ScenarioFamily, number> = Object.fromEntries(
  PROOF_SCENARIO_FAMILIES.map((family, index) => [family, index]),
) as Record<ScenarioFamily, number>

const HEAD_LABEL_MASKS: Record<RiskHeadKey, number> = {
  attendanceRisk: 1 << 0,
  ceRisk: 1 << 1,
  seeRisk: 1 << 2,
  overallCourseRisk: 1 << 3,
  downstreamCarryoverRisk: 1 << 4,
}

type DatasetBlock = {
  count: number
  stableOrderHashes: Uint32Array
  scenarioCodes: Uint8Array
  courseFamilyIds: Uint16Array
  semesterNumbers: Uint8Array
  stageIds: Uint8Array
  sectionIds: Uint8Array
  labelMasks: Uint8Array
  features: Float32Array
}

type CompactRiskDataset = {
  rowCount: number
  blocks: DatasetBlock[]
  trainIndices: number[]
  validationIndices: number[]
  testIndices: number[]
  splitSummary: Record<SplitName, number>
  worldSplitSummary: Record<SplitName, number>
  scenarioFamilySummary: Record<ScenarioFamily, number>
  headSupportSummary: Record<RiskHeadKey, HeadSupportSummary>
}

type CorrelationAccumulator = {
  trainSupport: number
  trainScenarioFamilySummary: Record<ScenarioFamily, number>
  weakCoWithCount: number
  weakCoWithAdverseCount: number
  weakCoWithoutCount: number
  weakCoWithoutAdverseCount: number
  weakQuestionWithCount: number
  weakQuestionWithAdverseCount: number
  weakQuestionWithoutCount: number
  weakQuestionWithoutAdverseCount: number
  prereqEdgeAgg: Map<string, {
    sourceCourseCode: string
    targetCourseCode: string
    support: number
    withWeakCount: number
    withWeakAdverseCount: number
    withoutWeakCount: number
    withoutWeakAdverseCount: number
  }>
}

function createDatasetBlock(): DatasetBlock {
  return {
    count: 0,
    stableOrderHashes: new Uint32Array(DATASET_BLOCK_SIZE),
    scenarioCodes: new Uint8Array(DATASET_BLOCK_SIZE),
    courseFamilyIds: new Uint16Array(DATASET_BLOCK_SIZE),
    semesterNumbers: new Uint8Array(DATASET_BLOCK_SIZE),
    stageIds: new Uint8Array(DATASET_BLOCK_SIZE),
    sectionIds: new Uint8Array(DATASET_BLOCK_SIZE),
    labelMasks: new Uint8Array(DATASET_BLOCK_SIZE),
    features: new Float32Array(DATASET_BLOCK_SIZE * FEATURE_COUNT),
  }
}

function createEmptyScenarioFamilySummary() {
  return PROOF_SCENARIO_FAMILIES.reduce((summary, family) => ({
    ...summary,
    [family]: 0,
  }), {} as Record<ScenarioFamily, number>)
}

function createEmptyHeadPositiveCounts() {
  return Object.fromEntries(
    (Object.keys(HEAD_LABEL_KEYS) as RiskHeadKey[]).map(headKey => [headKey, {
      train: 0,
      validation: 0,
      test: 0,
    }]),
  ) as Record<RiskHeadKey, Record<SplitName, number>>
}

function createEmptyCorrelationAccumulator(): CorrelationAccumulator {
  return {
    trainSupport: 0,
    trainScenarioFamilySummary: createEmptyScenarioFamilySummary(),
    weakCoWithCount: 0,
    weakCoWithAdverseCount: 0,
    weakCoWithoutCount: 0,
    weakCoWithoutAdverseCount: 0,
    weakQuestionWithCount: 0,
    weakQuestionWithAdverseCount: 0,
    weakQuestionWithoutCount: 0,
    weakQuestionWithoutAdverseCount: 0,
    prereqEdgeAgg: new Map(),
  }
}

function buildLabelMask(labelPayload: ObservableLabelPayload) {
  let mask = 0
  if (labelPayload.attendanceRiskLabel === 1) mask |= HEAD_LABEL_MASKS.attendanceRisk
  if (labelPayload.ceShortfallLabel === 1) mask |= HEAD_LABEL_MASKS.ceRisk
  if (labelPayload.seeShortfallLabel === 1) mask |= HEAD_LABEL_MASKS.seeRisk
  if (labelPayload.overallCourseFailLabel === 1) mask |= HEAD_LABEL_MASKS.overallCourseRisk
  if (labelPayload.downstreamCarryoverLabel === 1) mask |= HEAD_LABEL_MASKS.downstreamCarryoverRisk
  return mask
}

function stableOrderHash(input: string) {
  return Number.parseInt(createHash('sha256').update(input).digest('hex').slice(0, 8), 16)
}

function internId(target: Map<string, number>, value: string) {
  const existing = target.get(value)
  if (existing != null) return existing
  const next = target.size
  target.set(value, next)
  return next
}

function writeFeatureVectorToBuffer(payload: ObservableFeaturePayload, buffer: Float32Array, offset: number) {
  const prerequisiteDepth = Math.max(0, safeNumber(payload.prerequisiteChainDepth))
  buffer[offset + 0] = clamp(payload.attendancePct / 100, 0, 1)
  buffer[offset + 1] = clamp((payload.attendanceTrend + 25) / 50, 0, 1)
  buffer[offset + 2] = clamp(payload.attendanceHistoryRiskCount / 4, 0, 1)
  buffer[offset + 3] = clamp(payload.currentCgpa / 10, 0, 1)
  buffer[offset + 4] = clamp(payload.backlogCount / 4, 0, 1)
  buffer[offset + 5] = safePctToRisk(payload.tt1Pct)
  buffer[offset + 6] = safePctToRisk(payload.tt2Pct)
  buffer[offset + 7] = safePctToRisk(payload.seePct)
  buffer[offset + 8] = safePctToRisk(payload.quizPct)
  buffer[offset + 9] = safePctToRisk(payload.assignmentPct)
  buffer[offset + 10] = clamp(payload.weakCoCount / 4, 0, 1)
  buffer[offset + 11] = clamp(payload.weakQuestionCount / 6, 0, 1)
  buffer[offset + 12] = clamp((payload.courseworkToTtGap + 40) / 80, 0, 1)
  buffer[offset + 13] = clamp((-payload.ttMomentum + 30) / 60, 0, 1)
  buffer[offset + 14] = clamp(((payload.interventionResponseScore ?? 0) * -1 + 0.4) / 0.8, 0, 1)
  buffer[offset + 15] = clamp(payload.prerequisitePressure, 0, 1)
  buffer[offset + 16] = safePctToRisk(payload.prerequisiteAveragePct)
  buffer[offset + 17] = clamp(payload.prerequisiteFailureCount / 3, 0, 1)
  buffer[offset + 18] = clamp(prerequisiteDepth / 6, 0, 1)
  buffer[offset + 19] = safeRatio(payload.prerequisiteFailureCount, prerequisiteDepth)
  buffer[offset + 20] = clamp(safeNumber(payload.prerequisiteCarryoverLoad), 0, 1)
  buffer[offset + 21] = clamp(safeNumber(payload.prerequisiteRecencyWeightedFailure), 0, 1)
  buffer[offset + 22] = clamp(safeNumber(payload.downstreamDependencyLoad), 0, 1)
  buffer[offset + 23] = clamp(safeNumber(payload.weakPrerequisiteChainCount) / 6, 0, 1)
  buffer[offset + 24] = clamp(safeNumber(payload.repeatedWeakPrerequisiteFamilyCount) / 3, 0, 1)
  buffer[offset + 25] = clamp(payload.semesterProgress, 0, 1)
  buffer[offset + 26] = clamp(payload.sectionRiskRate, 0, 1)
}

function datasetBlockForIndex(dataset: CompactRiskDataset, rowIndex: number) {
  const blockIndex = Math.floor(rowIndex / DATASET_BLOCK_SIZE)
  const slot = rowIndex % DATASET_BLOCK_SIZE
  const block = dataset.blocks[blockIndex]
  if (!block) throw new Error(`Dataset block missing for row ${rowIndex}`)
  return { block, slot, featureOffset: slot * FEATURE_COUNT }
}

function labelAt(dataset: CompactRiskDataset, rowIndex: number, headKey: RiskHeadKey) {
  const { block, slot } = datasetBlockForIndex(dataset, rowIndex)
  return (block.labelMasks[slot]! & HEAD_LABEL_MASKS[headKey]) !== 0 ? 1 : 0
}

function stableOrderAt(dataset: CompactRiskDataset, rowIndex: number) {
  const { block, slot } = datasetBlockForIndex(dataset, rowIndex)
  return block.stableOrderHashes[slot] ?? 0
}

function scoreRawAt(dataset: CompactRiskDataset, rowIndex: number, intercept: number, weights: number[]) {
  const { block, featureOffset } = datasetBlockForIndex(dataset, rowIndex)
  let logit = intercept
  for (let featureIndex = 0; featureIndex < FEATURE_COUNT; featureIndex += 1) {
    logit += weights[featureIndex]! * (block.features[featureOffset + featureIndex] ?? 0)
  }
  return clamp(sigmoid(logit), 0.0001, 0.9999)
}

function compareStableOrder(dataset: CompactRiskDataset, left: number, right: number) {
  return stableOrderAt(dataset, left) - stableOrderAt(dataset, right) || left - right
}

class ProofRiskDatasetBuilder {
  private readonly blocks: DatasetBlock[] = [createDatasetBlock()]
  private rowCount = 0
  private readonly trainIndices: number[] = []
  private readonly validationIndices: number[] = []
  private readonly testIndices: number[] = []
  private readonly splitSummary: Record<SplitName, number> = { train: 0, validation: 0, test: 0 }
  private readonly worldSplitSets: Record<SplitName, Set<string>> = {
    train: new Set<string>(),
    validation: new Set<string>(),
    test: new Set<string>(),
  }
  private readonly scenarioFamilySummary = createEmptyScenarioFamilySummary()
  private readonly headPositiveCounts = createEmptyHeadPositiveCounts()
  private readonly courseFamilyIds = new Map<string, number>()
  private readonly stageIds = new Map<string, number>()
  private readonly sectionIds = new Map<string, number>()
  private readonly correlations = createEmptyCorrelationAccumulator()

  constructor(
    private readonly runMetadataById: Map<string, ProofRunModelMetadata>,
    private readonly manifest: ProofCorpusManifestEntry[],
  ) {}

  addEvidenceRows(rows: ObservableRiskEvidenceRow[]) {
    rows.forEach(row => this.appendRow(row.featurePayload, row.labelPayload, row.sourceRefs))
  }

  addSerializedRows(rows: Array<{
    featureJson: string
    labelJson: string
    sourceRefsJson: string
  }>) {
    rows.forEach(row => {
      const featurePayload = parseJson(row.featureJson, null as ObservableFeaturePayload | null)
      const labelPayload = parseJson(row.labelJson, null as ObservableLabelPayload | null)
      const sourceRefs = parseJson(row.sourceRefsJson, null as ObservableSourceRefs | null)
      if (!featurePayload || !labelPayload || !sourceRefs) return
      this.appendRow(featurePayload, labelPayload, sourceRefs)
    })
  }

  build(now: string): ProofRiskModelBundle | null {
    if (this.rowCount < 40) return null
    const headSupportSummary = Object.fromEntries(
      (Object.keys(HEAD_LABEL_KEYS) as RiskHeadKey[]).map(headKey => [headKey, {
        trainSupport: this.splitSummary.train,
        validationSupport: this.splitSummary.validation,
        testSupport: this.splitSummary.test,
        trainPositives: this.headPositiveCounts[headKey].train,
        validationPositives: this.headPositiveCounts[headKey].validation,
        testPositives: this.headPositiveCounts[headKey].test,
      }]),
    ) as Record<RiskHeadKey, HeadSupportSummary>

    const dataset: CompactRiskDataset = {
      rowCount: this.rowCount,
      blocks: this.blocks,
      trainIndices: this.trainIndices,
      validationIndices: this.validationIndices,
      testIndices: this.testIndices,
      splitSummary: this.splitSummary,
      worldSplitSummary: {
        train: this.worldSplitSets.train.size,
        validation: this.worldSplitSets.validation.size,
        test: this.worldSplitSets.test.size,
      },
      scenarioFamilySummary: this.scenarioFamilySummary,
      headSupportSummary,
    }

    return trainCompactProofRiskModel(dataset, now, this.correlations)
  }

  private appendRow(
    featurePayload: ObservableFeaturePayload,
    labelPayload: ObservableLabelPayload,
    sourceRefs: ObservableSourceRefs,
  ) {
    const runMeta = this.runMetadataById.get(sourceRefs.simulationRunId)
    const seed = runMeta?.seed ?? hashBucket(sourceRefs.simulationRunId)
    const manifestEntry = proofManifestEntryForSeed(seed, this.manifest)
    const split = runMeta?.split ?? inferWorldSplit(seed, this.manifest)
    const scenarioFamily = runMeta?.scenarioFamily ?? manifestEntry?.scenarioFamily ?? null
    if (!split || !scenarioFamily) return

    let block = this.blocks[this.blocks.length - 1]
    if (!block || block.count >= DATASET_BLOCK_SIZE) {
      block = createDatasetBlock()
      this.blocks.push(block)
    }

    const slot = block.count
    const rowIndex = this.rowCount
    const splitCode = SPLIT_CODE_BY_NAME[split]
    const mask = buildLabelMask(labelPayload)
    const key = `${sourceRefs.simulationRunId}::${sourceRefs.studentId}::${sourceRefs.courseCode}::${sourceRefs.stageKey ?? 'active'}`

    block.stableOrderHashes[slot] = stableOrderHash(key)
    block.scenarioCodes[slot] = SCENARIO_FAMILY_CODE_BY_NAME[scenarioFamily]
    block.courseFamilyIds[slot] = internId(this.courseFamilyIds, sourceRefs.courseFamily ?? 'general')
    block.semesterNumbers[slot] = clamp(Number(sourceRefs.semesterNumber ?? 0), 0, 255)
    block.stageIds[slot] = internId(this.stageIds, sourceRefs.stageKey ?? 'active')
    block.sectionIds[slot] = internId(this.sectionIds, sourceRefs.sectionCode ?? '')
    block.labelMasks[slot] = mask
    writeFeatureVectorToBuffer(featurePayload, block.features, slot * FEATURE_COUNT)
    block.count += 1

    this.rowCount += 1
    this.splitSummary[split] += 1
    this.worldSplitSets[split].add(sourceRefs.simulationRunId)
    this.scenarioFamilySummary[scenarioFamily] += 1
    if (split === 'train') this.trainIndices.push(rowIndex)
    else if (split === 'validation') this.validationIndices.push(rowIndex)
    else this.testIndices.push(rowIndex)

    for (const headKey of Object.keys(HEAD_LABEL_KEYS) as RiskHeadKey[]) {
      if ((mask & HEAD_LABEL_MASKS[headKey]) !== 0) {
        this.headPositiveCounts[headKey][split] += 1
      }
    }

    if (split === 'train') {
      this.correlations.trainSupport += 1
      this.correlations.trainScenarioFamilySummary[scenarioFamily] += 1
      const adverse = labelPayload.overallCourseFailLabel === 1
      if (featurePayload.weakCoCount >= 2) {
        this.correlations.weakCoWithCount += 1
        if (adverse) this.correlations.weakCoWithAdverseCount += 1
      } else {
        this.correlations.weakCoWithoutCount += 1
        if (adverse) this.correlations.weakCoWithoutAdverseCount += 1
      }
      if (featurePayload.weakQuestionCount >= 3) {
        this.correlations.weakQuestionWithCount += 1
        if (adverse) this.correlations.weakQuestionWithAdverseCount += 1
      } else {
        this.correlations.weakQuestionWithoutCount += 1
        if (adverse) this.correlations.weakQuestionWithoutAdverseCount += 1
      }
      if (sourceRefs.stageKey === 'post-see') {
        const weakSet = new Set(sourceRefs.prerequisiteWeakCourseCodes)
        sourceRefs.prerequisiteCourseCodes.forEach(sourceCourseCode => {
          const edgeKey = `${sourceCourseCode}::${sourceRefs.courseCode}`
          const current = this.correlations.prereqEdgeAgg.get(edgeKey) ?? {
            sourceCourseCode,
            targetCourseCode: sourceRefs.courseCode,
            support: 0,
            withWeakCount: 0,
            withWeakAdverseCount: 0,
            withoutWeakCount: 0,
            withoutWeakAdverseCount: 0,
          }
          current.support += 1
          if (weakSet.has(sourceCourseCode)) {
            current.withWeakCount += 1
            if (adverse) current.withWeakAdverseCount += 1
          } else {
            current.withoutWeakCount += 1
            if (adverse) current.withoutWeakAdverseCount += 1
          }
          this.correlations.prereqEdgeAgg.set(edgeKey, current)
        })
      }
    }
  }
}

export function createProofRiskModelTrainingBuilder(options?: {
  runMetadataById?: Map<string, ProofRunModelMetadata> | Record<string, ProofRunModelMetadata>
  manifest?: ProofCorpusManifestEntry[]
}) {
  return new ProofRiskDatasetBuilder(
    normalizeMetadataMap(options?.runMetadataById),
    options?.manifest ?? PROOF_CORPUS_MANIFEST,
  )
}

function sampleTrainingIndices(dataset: CompactRiskDataset, headKey: RiskHeadKey) {
  const positives: number[] = []
  const negatives: number[] = []
  dataset.trainIndices.forEach(rowIndex => {
    if (labelAt(dataset, rowIndex, headKey) === 1) positives.push(rowIndex)
    else negatives.push(rowIndex)
  })
  if (!negatives.length) return positives

  const targetNegativeCount = Math.min(
    negatives.length,
    Math.max(positives.length * 5, positives.length > 0 ? 0 : 20000, positives.length < 400 ? 20000 : 0),
  )
  if (targetNegativeCount >= negatives.length) {
    return [...positives, ...negatives].sort((left, right) => compareStableOrder(dataset, left, right))
  }

  const byStratum = new Map<string, number[]>()
  negatives.forEach(rowIndex => {
    const { block, slot } = datasetBlockForIndex(dataset, rowIndex)
    const stratum = [
      block.scenarioCodes[slot] ?? 0,
      block.semesterNumbers[slot] ?? 0,
      block.stageIds[slot] ?? 0,
      block.sectionIds[slot] ?? 0,
      block.courseFamilyIds[slot] ?? 0,
    ].join('::')
    const group = byStratum.get(stratum)
    if (group) group.push(rowIndex)
    else byStratum.set(stratum, [rowIndex])
  })

  const orderedStrata = [...byStratum.entries()].sort(([left], [right]) => left.localeCompare(right))
  orderedStrata.forEach(([, group]) => {
    group.sort((left, right) => compareStableOrder(dataset, left, right))
  })

  const selected = new Set<number>()
  let selectedCount = 0
  for (const [, group] of orderedStrata) {
    if (selectedCount >= targetNegativeCount) break
    const proportionalTake = Math.max(1, Math.floor((group.length / negatives.length) * targetNegativeCount))
    const take = Math.min(group.length, proportionalTake, targetNegativeCount - selectedCount)
    group.slice(0, take).forEach(rowIndex => selected.add(rowIndex))
    selectedCount += take
  }
  if (selectedCount < targetNegativeCount) {
    for (const [, group] of orderedStrata) {
      for (const rowIndex of group) {
        if (selectedCount >= targetNegativeCount) break
        if (selected.has(rowIndex)) continue
        selected.add(rowIndex)
        selectedCount += 1
      }
      if (selectedCount >= targetNegativeCount) break
    }
  }

  return [...positives, ...negatives.filter(rowIndex => selected.has(rowIndex))]
    .sort((left, right) => compareStableOrder(dataset, left, right))
}

function trainLogisticBaseCompact(dataset: CompactRiskDataset, rowIndices: number[], headKey: RiskHeadKey) {
  const positives = rowIndices.reduce((count, rowIndex) => count + labelAt(dataset, rowIndex, headKey), 0)
  const negatives = Math.max(1, rowIndices.length - positives)
  const positiveWeight = positives > 0 ? rowIndices.length / (2 * positives) : 1
  const negativeWeight = rowIndices.length / (2 * negatives)
  const weights = Array.from({ length: FEATURE_COUNT }, () => 0)
  const baseRate = clamp(
    rowIndices.reduce((sum, rowIndex) => sum + labelAt(dataset, rowIndex, headKey), 0) / Math.max(1, rowIndices.length),
    0.01,
    0.99,
  )
  let intercept = Math.log(baseRate / (1 - baseRate))
  const l2 = 0.015

  for (let iteration = 0; iteration < 160; iteration += 1) {
    const gradient = Array.from({ length: FEATURE_COUNT }, () => 0)
    let interceptGradient = 0
    for (const rowIndex of rowIndices) {
      const { block, featureOffset } = datasetBlockForIndex(dataset, rowIndex)
      let logit = intercept
      for (let featureIndex = 0; featureIndex < FEATURE_COUNT; featureIndex += 1) {
        logit += weights[featureIndex]! * (block.features[featureOffset + featureIndex] ?? 0)
      }
      const prediction = sigmoid(logit)
      const label = labelAt(dataset, rowIndex, headKey)
      const rowWeight = label === 1 ? positiveWeight : negativeWeight
      const error = (prediction - label) * rowWeight
      interceptGradient += error
      for (let featureIndex = 0; featureIndex < FEATURE_COUNT; featureIndex += 1) {
        gradient[featureIndex]! += error * (block.features[featureOffset + featureIndex] ?? 0)
      }
    }
    const learningRate = 0.22 / (1 + (iteration / 70))
    intercept -= learningRate * (interceptGradient / Math.max(1, rowIndices.length))
    for (let featureIndex = 0; featureIndex < FEATURE_COUNT; featureIndex += 1) {
      const reg = l2 * weights[featureIndex]!
      weights[featureIndex]! -= learningRate * ((gradient[featureIndex]! / Math.max(1, rowIndices.length)) + reg)
    }
  }

  return {
    intercept: roundToFour(intercept),
    weights,
  }
}

function fitLogisticHeadCompact(dataset: CompactRiskDataset, headKey: RiskHeadKey) {
  const sampledTrainRows = sampleTrainingIndices(dataset, headKey)
  const support = dataset.headSupportSummary[headKey]
  const base = trainLogisticBaseCompact(dataset, sampledTrainRows, headKey)

  const rawValidation = dataset.validationIndices.map(rowIndex => ({
    label: labelAt(dataset, rowIndex, headKey),
    rawProb: scoreRawAt(dataset, rowIndex, base.intercept, base.weights),
  }))
  const rawTest = dataset.testIndices.map(rowIndex => ({
    label: labelAt(dataset, rowIndex, headKey),
    rawProb: scoreRawAt(dataset, rowIndex, base.intercept, base.weights),
  }))
  const calibrated = chooseCalibration(headKey, rawValidation, rawTest, support)
  const threshold = 0.75
  const metrics = calibrated.testPredictions.length > 0
    ? buildMetricSummary(calibrated.testPredictions)
    : buildMetricSummary(calibrated.validationPredictions)

  return {
    headKey,
    intercept: base.intercept,
    weights: Object.fromEntries(
      OBSERVABLE_FEATURE_KEYS.map((key, featureIndex) => [key, roundToFour(base.weights[featureIndex] ?? 0)]),
    ) as Record<ObservableFeatureKey, number>,
    threshold: roundToFour(clamp(threshold, 0.35, 0.8)),
    metrics,
    support,
    calibration: calibrated.calibration,
  } satisfies LogisticHeadArtifact
}

function fitStumpHeadCompact(dataset: CompactRiskDataset, headKey: RiskHeadKey) {
  const sampledTrainRows = sampleTrainingIndices(dataset, headKey)
  let bestFeatureIndex = 0
  let bestThreshold = 0.5
  let bestLeftProb = 0.5
  let bestRightProb = 0.5
  let bestScore = Number.POSITIVE_INFINITY

  for (let featureIndex = 0; featureIndex < FEATURE_COUNT; featureIndex += 1) {
    const values = sampledTrainRows
      .map(rowIndex => {
        const { block, featureOffset } = datasetBlockForIndex(dataset, rowIndex)
        return block.features[featureOffset + featureIndex] ?? 0
      })
      .filter(Number.isFinite)
    const thresholds = [...new Set([0.2, 0.35, 0.5, 0.65, 0.8].map(q => roundToFour(quantile(values, q))))]
    for (const threshold of thresholds) {
      let leftTotal = 0
      let leftPositives = 0
      let rightTotal = 0
      let rightPositives = 0
      sampledTrainRows.forEach(rowIndex => {
        const { block, featureOffset } = datasetBlockForIndex(dataset, rowIndex)
        const value = block.features[featureOffset + featureIndex] ?? 0
        if (value <= threshold) {
          leftTotal += 1
          leftPositives += labelAt(dataset, rowIndex, headKey)
        } else {
          rightTotal += 1
          rightPositives += labelAt(dataset, rowIndex, headKey)
        }
      })
      const leftProb = clamp(leftTotal > 0 ? leftPositives / leftTotal : 0.5, 0.01, 0.99)
      const rightProb = clamp(rightTotal > 0 ? rightPositives / rightTotal : 0.5, 0.01, 0.99)
      const scoreRows = (dataset.validationIndices.length > 0 ? dataset.validationIndices : sampledTrainRows).map(rowIndex => {
        const { block, featureOffset } = datasetBlockForIndex(dataset, rowIndex)
        return {
          label: labelAt(dataset, rowIndex, headKey),
          prob: (block.features[featureOffset + featureIndex] ?? 0) <= threshold ? leftProb : rightProb,
        }
      })
      const score = brierScore(scoreRows)
      if (score < bestScore) {
        bestFeatureIndex = featureIndex
        bestThreshold = threshold
        bestLeftProb = leftProb
        bestRightProb = rightProb
        bestScore = score
      }
    }
  }

  const metrics = buildMetricSummary((dataset.testIndices.length > 0 ? dataset.testIndices : dataset.validationIndices).map(rowIndex => {
    const { block, featureOffset } = datasetBlockForIndex(dataset, rowIndex)
    return {
      label: labelAt(dataset, rowIndex, headKey),
      prob: (block.features[featureOffset + bestFeatureIndex] ?? 0) <= bestThreshold ? bestLeftProb : bestRightProb,
    }
  }))

  return {
    headKey,
    featureKey: OBSERVABLE_FEATURE_KEYS[bestFeatureIndex]!,
    threshold: roundToFour(bestThreshold),
    leftProb: roundToFour(bestLeftProb),
    rightProb: roundToFour(bestRightProb),
    metrics,
  } satisfies StumpHeadArtifact
}

function buildCorrelationArtifactFromAccumulator(accumulator: CorrelationAccumulator, now: string): CorrelationArtifact {
  const adverseRateWithWeakCo = accumulator.weakCoWithCount > 0
    ? accumulator.weakCoWithAdverseCount / accumulator.weakCoWithCount
    : 0
  const adverseRateWithoutWeakCo = accumulator.weakCoWithoutCount > 0
    ? accumulator.weakCoWithoutAdverseCount / accumulator.weakCoWithoutCount
    : 0
  const adverseRateWithWeakQuestions = accumulator.weakQuestionWithCount > 0
    ? accumulator.weakQuestionWithAdverseCount / accumulator.weakQuestionWithCount
    : 0
  const adverseRateWithoutWeakQuestions = accumulator.weakQuestionWithoutCount > 0
    ? accumulator.weakQuestionWithoutAdverseCount / accumulator.weakQuestionWithoutCount
    : 0

  const prerequisiteEdges = Array.from(accumulator.prereqEdgeAgg.values())
    .filter(edge => edge.support >= 25 && edge.withWeakCount > 0 && edge.withoutWeakCount > 0)
    .map(edge => {
      const withRate = edge.withWeakAdverseCount / edge.withWeakCount
      const withoutRate = edge.withoutWeakAdverseCount / edge.withoutWeakCount
      return {
        sourceCourseCode: edge.sourceCourseCode,
        targetCourseCode: edge.targetCourseCode,
        support: edge.support,
        adverseRateWithPrereqWeak: roundToFour(withRate),
        adverseRateWithoutPrereqWeak: roundToFour(withoutRate),
        oddsLift: roundToFour(withRate - withoutRate),
      } satisfies PrerequisiteCorrelationEdge
    })
    .sort((left, right) => right.oddsLift - left.oddsLift || right.support - left.support)
    .slice(0, 16)

  return {
    artifactVersion: RISK_CORRELATION_ARTIFACT_VERSION,
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    builtAt: now,
    splitName: 'train',
    support: accumulator.trainSupport,
    scenarioFamilySummary: accumulator.trainScenarioFamilySummary,
    weakCoAssociation: {
      support: accumulator.trainSupport,
      adverseRateWithWeakCo: roundToFour(adverseRateWithWeakCo),
      adverseRateWithoutWeakCo: roundToFour(adverseRateWithoutWeakCo),
      riskLift: roundToFour(adverseRateWithWeakCo - adverseRateWithoutWeakCo),
    },
    weakQuestionAssociation: {
      support: accumulator.trainSupport,
      adverseRateWithWeakQuestions: roundToFour(adverseRateWithWeakQuestions),
      adverseRateWithoutWeakQuestions: roundToFour(adverseRateWithoutWeakQuestions),
      riskLift: roundToFour(adverseRateWithWeakQuestions - adverseRateWithoutWeakQuestions),
    },
    prerequisiteEdges,
  }
}

function trainCompactProofRiskModel(
  dataset: CompactRiskDataset,
  now: string,
  correlationsAccumulator: CorrelationAccumulator,
) {
  const productionHeads = {
    attendanceRisk: fitLogisticHeadCompact(dataset, 'attendanceRisk'),
    ceRisk: fitLogisticHeadCompact(dataset, 'ceRisk'),
    seeRisk: fitLogisticHeadCompact(dataset, 'seeRisk'),
    overallCourseRisk: fitLogisticHeadCompact(dataset, 'overallCourseRisk'),
    downstreamCarryoverRisk: fitLogisticHeadCompact(dataset, 'downstreamCarryoverRisk'),
  } satisfies Record<RiskHeadKey, LogisticHeadArtifact>

  const production: ProductionRiskModelArtifact = {
    modelVersion: RISK_PRODUCTION_MODEL_VERSION,
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    trainedAt: now,
    trainingManifestVersion: PROOF_CORPUS_MANIFEST_VERSION,
    splitSummary: dataset.splitSummary,
    worldSplitSummary: dataset.worldSplitSummary,
    scenarioFamilySummary: dataset.scenarioFamilySummary,
    headSupportSummary: dataset.headSupportSummary,
    thresholds: PRODUCTION_RISK_THRESHOLDS,
    calibrationVersion: RISK_CALIBRATION_VERSION,
    heads: productionHeads,
  }

  const challenger: ChallengerRiskModelArtifact = {
    modelVersion: RISK_CHALLENGER_MODEL_VERSION,
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    trainedAt: now,
    trainingManifestVersion: PROOF_CORPUS_MANIFEST_VERSION,
    splitSummary: dataset.splitSummary,
    worldSplitSummary: dataset.worldSplitSummary,
    scenarioFamilySummary: dataset.scenarioFamilySummary,
    heads: {
      attendanceRisk: fitStumpHeadCompact(dataset, 'attendanceRisk'),
      ceRisk: fitStumpHeadCompact(dataset, 'ceRisk'),
      seeRisk: fitStumpHeadCompact(dataset, 'seeRisk'),
      overallCourseRisk: fitStumpHeadCompact(dataset, 'overallCourseRisk'),
      downstreamCarryoverRisk: fitStumpHeadCompact(dataset, 'downstreamCarryoverRisk'),
    },
  }

  return {
    production,
    challenger,
    correlations: buildCorrelationArtifactFromAccumulator(correlationsAccumulator, now),
  } satisfies ProofRiskModelBundle
}

export function trainProofRiskModel(
  rows: ObservableRiskEvidenceRow[],
  now: string,
  options?: {
    runMetadataById?: Map<string, ProofRunModelMetadata> | Record<string, ProofRunModelMetadata>
    manifest?: ProofCorpusManifestEntry[]
  },
): ProofRiskModelBundle | null {
  const runMetadataById = normalizeMetadataMap(options?.runMetadataById)
  const manifest = options?.manifest ?? PROOF_CORPUS_MANIFEST
  const builder = new ProofRiskDatasetBuilder(runMetadataById, manifest)
  builder.addEvidenceRows(rows)
  return builder.build(now)
}

export function trainProofRiskModelFromSerializedRows(
  rows: Array<{
    featureJson: string
    labelJson: string
    sourceRefsJson: string
  }>,
  now: string,
  options?: {
    runMetadataById?: Map<string, ProofRunModelMetadata> | Record<string, ProofRunModelMetadata>
    manifest?: ProofCorpusManifestEntry[]
  },
): ProofRiskModelBundle | null {
  const runMetadataById = normalizeMetadataMap(options?.runMetadataById)
  const manifest = options?.manifest ?? PROOF_CORPUS_MANIFEST
  const builder = new ProofRiskDatasetBuilder(runMetadataById, manifest)
  builder.addSerializedRows(rows)
  return builder.build(now)
}

function crossCourseDriversFromCorrelations(correlations: CorrelationArtifact | null, refs: ObservableSourceRefs) {
  if (!correlations) return []
  const weakSet = new Set(refs.prerequisiteWeakCourseCodes)
  return correlations.prerequisiteEdges
    .filter(edge => edge.targetCourseCode === refs.courseCode && weakSet.has(edge.sourceCourseCode))
    .slice(0, 3)
    .map(edge => `${edge.sourceCourseCode} weakness historically lifts ${refs.courseCode} adverse outcomes by ${roundToTwo(edge.oddsLift * 100)} scaled points in the current proof corpus.`)
}

export function scoreObservableRiskWithModel(input: ObservableInferenceInput & {
  featurePayload: ObservableFeaturePayload
  sourceRefs?: ObservableSourceRefs | null
  productionModel?: ProductionRiskModelArtifact | null
  correlations?: CorrelationArtifact | null
}): ModelBackedRiskOutput {
  const fallback = inferObservableRisk(input)
  if (!input.productionModel || input.productionModel.featureSchemaVersion !== RISK_FEATURE_SCHEMA_VERSION) {
    return {
      ...fallback,
      modelVersion: 'observable-inference-v2',
      calibrationVersion: null,
      headProbabilities: {
        attendanceRisk: fallback.riskProb,
        ceRisk: fallback.riskProb,
        seeRisk: fallback.riskProb,
        overallCourseRisk: fallback.riskProb,
        downstreamCarryoverRisk: fallback.riskProb,
      },
      queuePriorityScore: fallback.riskProb,
      crossCourseDrivers: [],
      headDisplay: Object.fromEntries(
        (Object.keys(HEAD_LABEL_KEYS) as RiskHeadKey[]).map(headKey => [headKey, {
          displayProbabilityAllowed: false,
          supportWarning: 'No active trained artifact is available for this batch.',
          calibrationMethod: 'identity' as CalibrationMethod,
        }]),
      ) as ModelBackedRiskOutput['headDisplay'],
    }
  }

  const vector = featureVectorFromPayload(input.featurePayload)
  const headProbabilities = {
    attendanceRisk: scoreWithLogistic(input.productionModel.heads.attendanceRisk, vector),
    ceRisk: scoreWithLogistic(input.productionModel.heads.ceRisk, vector),
    seeRisk: scoreWithLogistic(input.productionModel.heads.seeRisk, vector),
    overallCourseRisk: scoreWithLogistic(input.productionModel.heads.overallCourseRisk, vector),
    downstreamCarryoverRisk: scoreWithLogistic(input.productionModel.heads.downstreamCarryoverRisk, vector),
  } satisfies Record<RiskHeadKey, number>
  const combinedOverall = clamp(Math.max(
    headProbabilities.overallCourseRisk,
    headProbabilities.attendanceRisk * 0.75,
    headProbabilities.ceRisk * 0.85,
    headProbabilities.seeRisk * 0.9,
    headProbabilities.downstreamCarryoverRisk * 0.65,
  ), 0.05, 0.95)
  const officialOverall = headProbabilities.overallCourseRisk
  const riskBand: 'High' | 'Medium' | 'Low' = officialOverall >= input.productionModel.thresholds.high
    ? 'High'
    : officialOverall >= input.productionModel.thresholds.medium
      ? 'Medium'
      : 'Low'
  const observableDrivers = inferObservableDrivers(input)
  const recommendedAction = riskBand === 'High'
    ? 'Immediate mentor follow-up and reassessment before the next evaluation checkpoint.'
    : riskBand === 'Medium'
      ? 'Schedule a monitored reassessment and review the current intervention plan.'
      : 'Continue routine monitoring on the current evidence window.'

  return {
    riskProb: roundToFour(officialOverall),
    riskBand,
    recommendedAction,
    observableDrivers,
    modelVersion: input.productionModel.modelVersion,
    calibrationVersion: input.productionModel.calibrationVersion,
    headProbabilities: Object.fromEntries(
      Object.entries(headProbabilities).map(([key, value]) => [key, roundToFour(value)]),
    ) as Record<RiskHeadKey, number>,
    queuePriorityScore: roundToFour(combinedOverall),
    crossCourseDrivers: input.sourceRefs ? crossCourseDriversFromCorrelations(input.correlations ?? null, input.sourceRefs) : [],
    headDisplay: Object.fromEntries(
      (Object.entries(input.productionModel.heads) as Array<[RiskHeadKey, LogisticHeadArtifact]>)
        .map(([headKey, head]) => [headKey, {
          displayProbabilityAllowed: head.calibration.displayProbabilityAllowed,
          supportWarning: head.calibration.supportWarning,
          calibrationMethod: head.calibration.method,
        }]),
    ) as ModelBackedRiskOutput['headDisplay'],
  }
}

export function summarizeProofRiskModelEvaluation(bundle: ProofRiskModelBundle) {
  return {
    trainingManifestVersion: PROOF_CORPUS_MANIFEST_VERSION,
    production: {
      modelVersion: bundle.production.modelVersion,
      trainedAt: bundle.production.trainedAt,
      calibrationVersion: bundle.production.calibrationVersion,
      thresholds: bundle.production.thresholds,
      splitSummary: bundle.production.splitSummary,
      worldSplitSummary: bundle.production.worldSplitSummary,
      scenarioFamilySummary: bundle.production.scenarioFamilySummary,
      headSupportSummary: bundle.production.headSupportSummary,
      heads: Object.fromEntries(
        (Object.entries(bundle.production.heads) as Array<[RiskHeadKey, LogisticHeadArtifact]>)
          .map(([headKey, head]) => [headKey, {
            metrics: head.metrics,
            support: head.support,
            calibrationMethod: head.calibration.method,
            validationMetrics: head.calibration.validationMetrics,
            testMetrics: head.calibration.testMetrics,
            displayProbabilityAllowed: head.calibration.displayProbabilityAllowed,
            supportWarning: head.calibration.supportWarning,
            reliabilityBins: head.calibration.reliabilityBins,
          }]),
      ),
    },
    challenger: {
      modelVersion: bundle.challenger.modelVersion,
      trainedAt: bundle.challenger.trainedAt,
      splitSummary: bundle.challenger.splitSummary,
      worldSplitSummary: bundle.challenger.worldSplitSummary,
      scenarioFamilySummary: bundle.challenger.scenarioFamilySummary,
      heads: Object.fromEntries(
        (Object.entries(bundle.challenger.heads) as Array<[RiskHeadKey, StumpHeadArtifact]>)
          .map(([headKey, head]) => [headKey, head.metrics]),
      ),
    },
    correlations: bundle.correlations,
  }
}

export function featureHash(payload: ObservableFeaturePayload, labels: ObservableLabelPayload, refs: ObservableSourceRefs) {
  return createHash('sha256').update(JSON.stringify({
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    payload,
    labels,
    refs,
  })).digest('hex')
}

export function buildObservableFeaturePayload(input: {
  attendancePct: number
  attendanceHistory?: Array<{ attendancePct: number }>
  currentCgpa: number
  backlogCount: number
  tt1Pct: number | null
  tt2Pct: number | null
  quizPct: number | null
  assignmentPct: number | null
  seePct: number | null
  weakCoCount: number
  weakQuestionCount: number
  interventionResponseScore: number | null
  prerequisiteAveragePct: number
  prerequisiteFailureCount: number
  prerequisiteCourseCodes: string[]
  downstreamDependencyLoad?: number
  weakPrerequisiteChainCount?: number
  repeatedWeakPrerequisiteFamilyCount?: number
  sectionRiskRate: number
  semesterProgress: number
}): ObservableFeaturePayload {
  const attendanceHistory = (input.attendanceHistory ?? []).filter(item => Number.isFinite(item.attendancePct))
  const attendanceTrend = attendanceHistory.length >= 2
    ? Number(attendanceHistory[attendanceHistory.length - 1]?.attendancePct ?? input.attendancePct) - Number(attendanceHistory[0]?.attendancePct ?? input.attendancePct)
    : 0
  const courseworkAverage = average([input.quizPct ?? 0, input.assignmentPct ?? 0].filter(value => value > 0))
  const termAverage = average([input.tt1Pct ?? 0, input.tt2Pct ?? 0].filter(value => value > 0))
  const prerequisiteChainDepth = input.prerequisiteCourseCodes.length
  const prerequisiteWeakCourseRate = safeRatio(input.prerequisiteFailureCount, prerequisiteChainDepth)
  const normalizedSemesterProgress = clamp(input.semesterProgress, 0, 1)
  const prerequisiteRecencyWeightedFailure = clamp(prerequisiteWeakCourseRate * (0.45 + (0.55 * normalizedSemesterProgress)), 0, 1)
  const prerequisiteCarryoverLoad = prerequisiteChainDepth === 0
    ? 0
    : clamp(
      prerequisiteWeakCourseRate
      + Math.max(0, (55 - input.prerequisiteAveragePct) / 120)
      + (clamp(input.sectionRiskRate, 0, 1) * 0.15),
      0,
      1,
    )
  const downstreamDependencyLoad = clamp(safeNumber(input.downstreamDependencyLoad), 0, 1)
  const weakPrerequisiteChainCount = Math.max(0, Math.round(safeNumber(input.weakPrerequisiteChainCount)))
  const repeatedWeakPrerequisiteFamilyCount = Math.max(0, Math.round(safeNumber(input.repeatedWeakPrerequisiteFamilyCount)))
  return {
    attendancePct: roundToTwo(input.attendancePct),
    attendanceTrend: roundToTwo(attendanceTrend),
    attendanceHistoryRiskCount: attendanceHistory.filter(item => item.attendancePct < 75).length,
    currentCgpa: roundToTwo(input.currentCgpa),
    backlogCount: input.backlogCount,
    tt1Pct: input.tt1Pct == null ? null : roundToTwo(input.tt1Pct),
    tt2Pct: input.tt2Pct == null ? null : roundToTwo(input.tt2Pct),
    seePct: input.seePct == null ? null : roundToTwo(input.seePct),
    quizPct: input.quizPct == null ? null : roundToTwo(input.quizPct),
    assignmentPct: input.assignmentPct == null ? null : roundToTwo(input.assignmentPct),
    weakCoCount: input.weakCoCount,
    weakQuestionCount: input.weakQuestionCount,
    courseworkToTtGap: roundToTwo(courseworkAverage - termAverage),
    ttMomentum: roundToTwo((input.tt2Pct ?? input.tt1Pct ?? 0) - (input.tt1Pct ?? 0)),
    interventionResponseScore: input.interventionResponseScore == null ? null : roundToFour(input.interventionResponseScore),
    prerequisitePressure: input.prerequisiteCourseCodes.length === 0 ? 0 : roundToFour((input.prerequisiteFailureCount + Math.max(0, (55 - input.prerequisiteAveragePct) / 20)) / Math.max(1, input.prerequisiteCourseCodes.length)),
    prerequisiteAveragePct: roundToTwo(input.prerequisiteAveragePct),
    prerequisiteFailureCount: input.prerequisiteFailureCount,
    prerequisiteChainDepth,
    prerequisiteWeakCourseRate: roundToFour(prerequisiteWeakCourseRate),
    prerequisiteCarryoverLoad: roundToFour(prerequisiteCarryoverLoad),
    prerequisiteRecencyWeightedFailure: roundToFour(prerequisiteRecencyWeightedFailure),
    downstreamDependencyLoad: roundToFour(downstreamDependencyLoad),
    weakPrerequisiteChainCount,
    repeatedWeakPrerequisiteFamilyCount,
    semesterProgress: roundToFour(normalizedSemesterProgress),
    sectionRiskRate: roundToFour(clamp(input.sectionRiskRate, 0, 1)),
  }
}
