import type { ApiAuditEvent } from '@web/shared/api/types'

export function formatClockLabel(now: Date) {
  return now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function readStringField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'string' ? value : null
}

export function readNumberField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function readBooleanField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'boolean' ? value : null
}

export function readRecordField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function formatSplitSummary(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const train = readNumberField(summary, 'train')
  const validation = readNumberField(summary, 'validation')
  const test = readNumberField(summary, 'test')
  return [
    train != null ? `train ${train}` : null,
    validation != null ? `validation ${validation}` : null,
    test != null ? `test ${test}` : null,
  ].filter((value): value is string => !!value).join(' · ') || 'Unavailable'
}

export function formatKeyedCounts(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const entries = Object.entries(summary)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} ${value}`)
  return entries.length > 0 ? entries.join(' · ') : 'Unavailable'
}

export function formatHeadSupportSummary(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const entries = Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([headKey, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return headKey
      const record = value as Record<string, unknown>
      const counts = [
        readNumberField(record, 'trainSupport') ?? readNumberField(record, 'train'),
        readNumberField(record, 'validationSupport') ?? readNumberField(record, 'validation'),
        readNumberField(record, 'testSupport') ?? readNumberField(record, 'test'),
      ].filter((item): item is number => typeof item === 'number')
      if (counts.length === 0) return headKey
      return `${headKey} ${counts.join('/')}`
    })
  return entries.length > 0 ? entries.join(' · ') : 'Unavailable'
}

export function formatDiagnosticSummary(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const entries = Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      if (value == null) return null
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return `${key} ${String(value)}`
      if (Array.isArray(value)) return `${key} ${value.length} items`
      if (typeof value === 'object') {
        const nestedKeys = Object.keys(value as Record<string, unknown>).slice(0, 3)
        return `${key} ${nestedKeys.join('/') || 'object'}`
      }
      return null
    })
    .filter((value): value is string => !!value)
  return entries.length > 0 ? entries.join(' · ') : 'Unavailable'
}

export function summarizeAuditEvent(event: ApiAuditEvent) {
  const action = event.action.replace(/[_-]+/g, ' ')
  return action.charAt(0).toUpperCase() + action.slice(1)
}
