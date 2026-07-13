import type {
  CalibrationMethod,
  ObservableFeatureKey,
  RiskHeadKey,
  SplitName,
} from './feature-schema.js'
import type { ChallengerModelFamily, ScenarioFamily } from './scenario.js'

export type EbmTerm = {
  name: string
  features: string[]
  feature_indices: number[]
  scores: number[] | number[][]
}

export type EbmModelArtifact = {
  intercept: number
  bins: number[][]
  terms: EbmTerm[]
}

export type ReliabilityBin = {
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
  logLoss: number
  rocAuc: number
  averagePrecision: number
  expectedCalibrationError: number
  calibrationSlope: number
  calibrationIntercept: number
}

export type HeadSupportSummary = {
  trainSupport: number
  validationSupport: number
  testSupport: number
  trainPositives: number
  validationPositives: number
  testPositives: number
}

export type ProbabilityCalibrationArtifact = {
  method: CalibrationMethod
  intercept: number | null
  slope: number | null
  logProbWeight: number | null
  logInverseProbWeight: number | null
  thresholds: number[]
  values: number[]
  validationMetrics: RiskMetricSummary
  testMetrics: RiskMetricSummary
  displayProbabilityAllowed: boolean
  supportWarning: string | null
  reliabilityBins: ReliabilityBin[]
}

export type LogisticHeadArtifact = {
  headKey: RiskHeadKey
  intercept: number
  weights: Record<ObservableFeatureKey, number>
  threshold: number
  metrics: RiskMetricSummary
  support: HeadSupportSummary
  calibration: ProbabilityCalibrationArtifact
}

export type DepthTwoTreeNodeArtifact = {
  featureKey: ObservableFeatureKey
  threshold: number
  leftValue: number
  rightValue: number
  leftChild: DepthTwoTreeNodeArtifact | null
  rightChild: DepthTwoTreeNodeArtifact | null
}

export type ChallengerHeadArtifact = {
  headKey: RiskHeadKey
  modelFamily: ChallengerModelFamily
  baseIntercept: number
  root: DepthTwoTreeNodeArtifact
  threshold: number
  metrics: RiskMetricSummary
  support: HeadSupportSummary
  calibration: ProbabilityCalibrationArtifact
}

export type ProductionRiskModelArtifact = {
  modelVersion: string
  modelFamily?: string
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
  modelFamily: ChallengerModelFamily
  featureSchemaVersion: string
  trainedAt: string
  trainingManifestVersion: string
  splitSummary: Record<SplitName, number>
  worldSplitSummary: Record<SplitName, number>
  scenarioFamilySummary: Record<ScenarioFamily, number>
  headSupportSummary: Record<RiskHeadKey, HeadSupportSummary>
  calibrationVersion: string
  heads: Record<RiskHeadKey, ChallengerHeadArtifact>
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
