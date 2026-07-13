import { T } from '@web/simulation/fixtures'
import type { RiskBand } from '@kernel/shared/domain'

export type HodTabId = 'overview' | 'courses' | 'faculty' | 'reassessments' | 'counterfactual'

export function toRiskBand(band?: string | null): RiskBand | null {
  const normalized = band?.trim().toLowerCase()
  if (normalized === 'high') return 'High'
  if (normalized === 'medium') return 'Medium'
  if (normalized === 'low') return 'Low'
  return null
}

export function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : 'Not recorded yet'
}

export function formatHours(value: number) {
  return `${value.toFixed(1)} h`
}

export function sectionColor(_sectionCode: string) {
  return T.muted
}

export type GovernedQueueState = 'open' | 'watch' | 'deferred' | 'resolved' | null

export function resolveGovernedQueueState(status?: string | null): GovernedQueueState {
  const normalized = status?.trim().toLowerCase()
  if (normalized === 'open' || normalized === 'opened') return 'open'
  if (normalized === 'watch' || normalized === 'watching') return 'watch'
  if (normalized === 'deferred') return 'deferred'
  if (normalized === 'resolved') return 'resolved'
  return null
}

export function governedQueueLabel(state: Exclude<GovernedQueueState, null>) {
  if (state === 'open') return 'Action Needed'
  if (state === 'watch') return 'Watching'
  if (state === 'deferred') return 'Capacity Deferred'
  return 'Resolved'
}

export function governedQueueColor(state: Exclude<GovernedQueueState, null>) {
  if (state === 'open') return T.danger
  if (state === 'watch') return T.warning
  if (state === 'deferred') return T.accent
  return T.success
}
