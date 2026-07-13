import type { ApiFeatureCompleteness, ApiFeatureProvenance, ApiRiskHeadDisplay, ApiStudentRiskExplorer } from '@web/shared/api/types'

function deriveBandLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null
  if (value >= 70) return 'High'
  if (value >= 35) return 'Medium'
  return 'Low'
}

export function renderHeadValue(display: ApiRiskHeadDisplay | undefined, value: number | null) {
  if (display?.displayProbabilityAllowed !== false && value != null) return `${value}%`
  const band = display?.riskBand ?? deriveBandLabel(value)
  return band ? `${band} band` : 'Band only'
}

export function renderHeadHelper(display: ApiRiskHeadDisplay | undefined, baseHelper: string) {
  const pieces = [baseHelper]
  if (display?.calibrationMethod) pieces.push(`Calibration ${display.calibrationMethod}`)
  if (display?.supportWarning) pieces.push(display.supportWarning)
  return pieces.join(' · ')
}

export function formatEvidencePct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : 'Not recorded yet'
}

export function formatSignedPoints(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'NA'
  return `${value > 0 ? '+' : ''}${Math.round(value * 100) / 100} pts`
}

export function renderFeatureCompletenessLabel(featureCompleteness: ApiFeatureCompleteness | null) {
  if (!featureCompleteness) return 'Unavailable'
  return featureCompleteness.fallbackMode === 'graph-aware' ? 'Graph aware' : 'Policy only'
}

export function renderFeatureProvenanceValue(featureProvenance: ApiFeatureProvenance | null) {
  if (!featureProvenance) return 'No provenance available'
  const fingerprint = featureProvenance.curriculumFeatureProfileFingerprint
    ? featureProvenance.curriculumFeatureProfileFingerprint.slice(0, 8)
    : 'none'
  const importVersion = featureProvenance.curriculumImportVersionId ?? 'none'
  return `Provenance · import ${importVersion} · fingerprint ${fingerprint} · nodes ${featureProvenance.graphNodeCount} · edges ${featureProvenance.graphEdgeCount} · history ${featureProvenance.historyCourseCount}`
}

export function renderAuthorityBannerMessage(explorer: ApiStudentRiskExplorer) {
  const advisoryNote = 'Predicted scenarios stay advisory.'
  if (explorer.countSource === 'proof-checkpoint') {
    const checkpointLabel = explorer.checkpointContext?.stageLabel
      ? ` at ${explorer.checkpointContext.stageLabel}`
      : ''
    return `Viewing the saved checkpoint${checkpointLabel}. Risk heads on this page come from the selected proof window; ${advisoryNote}`
  }
  if (explorer.countSource === 'proof-run') {
    return `Viewing the active proof run. Risk heads on this page follow the current proof semester; ${advisoryNote}`
  }
  if (explorer.countSource === 'operational-semester') {
    return `Viewing live semester data. Risk heads on this page are anchored to operational evidence; ${advisoryNote}`
  }
  return 'Risk provenance is limited for this payload. Treat the derived outputs as advisory only.'
}
