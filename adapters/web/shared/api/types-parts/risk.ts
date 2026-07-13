// Risk calibration, metric-summary, calibration-artifact, and risk-head-display
// contracts. Extracted verbatim from '../types'.

export type ApiRiskCalibrationMethod = 'identity' | 'sigmoid' | 'isotonic'

export type ApiRiskMetricSummary = {
  support: number
  positiveRate: number
  brierScore: number
  rocAuc: number
  expectedCalibrationError: number
}

export type ApiRiskCalibrationArtifact = {
  method: ApiRiskCalibrationMethod
  intercept: number | null
  slope: number | null
  thresholds: number[]
  values: number[]
  validationMetrics: ApiRiskMetricSummary
  testMetrics: ApiRiskMetricSummary
  displayProbabilityAllowed: boolean
  supportWarning: string | null
  reliabilityBins: Array<{
    lowerBound: number
    upperBound: number
    meanPredicted: number
    meanObserved: number
    count: number
  }>
}

export type ApiRiskHeadDisplay = {
  displayProbabilityAllowed: boolean
  supportWarning: string | null
  calibrationMethod: ApiRiskCalibrationMethod
  calibrationStatus?: string | null
  riskBand?: string | null
  probabilityScaled?: number | null
}
