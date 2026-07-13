import type { CalibrationMethod, RiskHeadKey, SplitName } from './feature-schema.js'
import type {
  ChallengerModelFamily,
  ProofRiskTrainingVariantId,
  ScenarioFamily,
} from './scenario.js'
import type { ObservableLabelPayload } from './feature-contract.js'

export const RISK_PRODUCTION_MODEL_VERSION = 'observable-risk-logit-v9'
export const RISK_CHALLENGER_MODEL_VERSION = 'observable-risk-catboost-challenger-v9'
export const RISK_CORRELATION_ARTIFACT_VERSION = 'observable-risk-correlations-v4'
export const RISK_CALIBRATION_VERSION = 'post-hoc-calibration-v2'
export const PROOF_CORPUS_MANIFEST_VERSION = 'proof-corpus-v1'
export const PRODUCTION_RISK_THRESHOLDS = {
  medium: 0.4,
  high: 0.65,
} as const

export type ProofRiskTrainingConfig = {
  variantId: ProofRiskTrainingVariantId
  productionModelVersion: string
  challengerModelVersion: string
  calibrationVersion: string
  includeStageIndicators: boolean
  includeInteractionFeatures: boolean
  calibrationMethods: CalibrationMethod[]
  challengerModelFamily: ChallengerModelFamily
}

export const DEFAULT_PROOF_RISK_TRAINING_CONFIG: ProofRiskTrainingConfig = {
  variantId: 'production-v8',
  productionModelVersion: RISK_PRODUCTION_MODEL_VERSION,
  challengerModelVersion: RISK_CHALLENGER_MODEL_VERSION,
  calibrationVersion: RISK_CALIBRATION_VERSION,
  includeStageIndicators: true,
  includeInteractionFeatures: true,
  calibrationMethods: ['identity', 'sigmoid', 'beta', 'isotonic', 'venn-abers'],
  challengerModelFamily: 'depth-2-tree',
}

// v8: adds cgpaMissingScaled + backlogMissingScaled to feature vector (43 features total)
// Fixes v7 overload=1.1127 by restoring missingness signal suppressed by 0.5 imputation
export const CORRECTED_V8_PROOF_RISK_TRAINING_CONFIG: ProofRiskTrainingConfig = {
  variantId: 'production-v8',
  productionModelVersion: 'observable-risk-logit-v8',
  challengerModelVersion: 'observable-risk-catboost-challenger-v8',
  calibrationVersion: 'post-hoc-calibration-v2',
  includeStageIndicators: true,
  includeInteractionFeatures: true,
  calibrationMethods: ['identity', 'sigmoid', 'beta', 'isotonic', 'venn-abers'],
  challengerModelFamily: 'depth-2-tree',
}

export const BASELINE_V5_LIKE_PROOF_RISK_TRAINING_CONFIG: ProofRiskTrainingConfig = {
  variantId: 'baseline-v5-like',
  productionModelVersion: 'observable-risk-logit-v5-like',
  challengerModelVersion: 'observable-risk-depth2-tree-v5-like',
  calibrationVersion: 'post-hoc-calibration-v1-like',
  includeStageIndicators: false,
  includeInteractionFeatures: false,
  calibrationMethods: ['identity', 'sigmoid', 'isotonic'],
  challengerModelFamily: 'depth-2-tree',
}

export type ProofRunModelMetadata = {
  simulationRunId: string
  seed: number
  scenarioFamily?: ScenarioFamily | null
  split?: SplitName | null
}

export const HEAD_LABEL_KEYS: Record<RiskHeadKey, keyof ObservableLabelPayload> = {
  attendanceRisk: 'attendanceRiskLabel',
  ceRisk: 'ceShortfallLabel',
  seeRisk: 'seeShortfallLabel',
  overallCourseRisk: 'overallCourseFailLabel',
  downstreamCarryoverRisk: 'downstreamCarryoverLabel',
}

export const HEAD_DISPLAY_ECE_LIMITS: Partial<Record<RiskHeadKey, number>> = {
  attendanceRisk: 0.08,
  seeRisk: 0.08,
  overallCourseRisk: 0.08,
  downstreamCarryoverRisk: 0.1,
}

export const HEAD_SUPPORT_POSITIVE_MINIMUMS: Partial<Record<RiskHeadKey, number>> = {
  attendanceRisk: 100,
  seeRisk: 100,
  overallCourseRisk: 100,
  downstreamCarryoverRisk: 100,
}
