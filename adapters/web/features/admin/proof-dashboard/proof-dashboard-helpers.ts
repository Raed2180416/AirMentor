import type { DiagnosticsRecord, ProofDashboardTabId } from './proof-dashboard-types'

export const proofDashboardTabStorageKey = 'airmentor-system-admin-proof-dashboard-tab'

export function readStoredProofDashboardTab(): ProofDashboardTabId | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(proofDashboardTabStorageKey)
  return value === 'summary' || value === 'checkpoint' || value === 'diagnostics' || value === 'operations'
    ? value
    : null
}

export function formatAgeSeconds(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'n/a'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h`
}

function formatEtaSeconds(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null
  const normalized = Math.max(0, Math.round(seconds))
  if (normalized < 60) return `${normalized}s`
  const minutes = Math.floor(normalized / 60)
  const remainingSeconds = normalized % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

function readProgressNumber(progress: Record<string, unknown> | null | undefined, key: string) {
  const value = progress?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function readProgressPhase(progress: Record<string, unknown> | null | undefined, fallback: string) {
  const phase = progress?.phase
  return typeof phase === 'string' && phase.trim() ? phase : fallback
}

export function formatProofProgress(progress: Record<string, unknown> | null | undefined, fallbackPhase: string) {
  const phase = readProgressPhase(progress, fallbackPhase)
  const percent = readProgressNumber(progress, 'percent')
  const eta = formatEtaSeconds(readProgressNumber(progress, 'etaSeconds'))
  return [
    phase,
    percent != null ? `${Math.max(0, Math.min(100, Math.round(percent)))}%` : null,
    eta ? `ETA ~${eta}` : null,
  ].filter((value): value is string => Boolean(value)).join(' · ')
}

export function formatLeaseState(leaseState: 'leased' | 'expired' | 'released' | null | undefined) {
  if (!leaseState) return 'unleased'
  return leaseState
}

export function formatOperationalEventDetails(details: Record<string, unknown>) {
  const summaryEntries = Object.entries(details).slice(0, 3).map(([key, value]) => {
    if (value == null) return `${key}: null`
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return `${key}: ${String(value)}`
    }
    return `${key}: ${JSON.stringify(value)}`
  })
  return summaryEntries.length > 0 ? summaryEntries.join(' · ') : 'No additional details.'
}

export function readDiagnosticNumber(record: DiagnosticsRecord, key: string) {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>)[key]
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function readDiagnosticRecord(record: DiagnosticsRecord, key: string) {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>)[key]
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function formatDiagnosticModeLabel(value: string) {
  return value.replaceAll('-', ' ')
}

export function summarizeCoEvidenceMix(summary: DiagnosticsRecord) {
  const byMode = readDiagnosticRecord(summary, 'byMode')
  if (!byMode) return null
  const entries = Object.entries(byMode)
    .map(([mode, count]) => [mode, Number(count)] as const)
    .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]) && entry[1] > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  if (entries.length === 0) return null
  return entries
    .slice(0, 3)
    .map(([mode, count]) => `${formatDiagnosticModeLabel(mode)} ${count}`)
    .join(' · ')
}
