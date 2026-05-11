import type { ApiStudentAgentCard, ApiStudentRiskExplorer } from './api/types'

export type DemoRealityLoopSnapshot = {
  attendancePct: number | null
  riskBand: string | null
  riskProbScaled: number | null
  queueState: string | null
  reassessmentStatus: string | null
}

function valueLabel(value: number | null, unit: string) {
  return value == null ? 'Not recorded' : `${value}${unit}`
}

export function formatDemoDelta(before: number | null, after: number | null, unit = '') {
  const prefix = `${valueLabel(before, unit)} -> ${valueLabel(after, unit)}`
  if (before == null || after == null) return prefix
  const delta = after - before
  if (delta === 0) return `${prefix} (no change)`
  return `${prefix} (${delta > 0 ? '+' : ''}${delta}${unit})`
}

export function buildDemoRealityLoopSnapshot(input: ApiStudentRiskExplorer | ApiStudentAgentCard | null): DemoRealityLoopSnapshot | null {
  if (!input) return null
  const riskLike = input as ApiStudentRiskExplorer
  const cardLike = input as ApiStudentAgentCard
  const currentEvidence = riskLike.currentEvidence ?? cardLike.overview?.currentEvidence ?? null
  const currentStatus = riskLike.currentStatus ?? cardLike.overview?.currentStatus ?? null
  if (!currentEvidence || !currentStatus) return null
  return {
    attendancePct: typeof currentEvidence.attendancePct === 'number' ? currentEvidence.attendancePct : null,
    riskBand: currentStatus.riskBand ?? null,
    riskProbScaled: typeof currentStatus.riskProbScaled === 'number' ? currentStatus.riskProbScaled : null,
    queueState: currentStatus.queueState ?? null,
    reassessmentStatus: currentStatus.reassessmentStatus ?? null,
  }
}
