import { type CSSProperties } from 'react'
import { T } from '@web/simulation/fixtures'

export function getReadOnlyInputStyle(): CSSProperties {
  return {
    background: T.surface2,
    color: T.dim,
    WebkitTextFillColor: T.dim,
    cursor: 'default',
    pointerEvents: 'none' as const,
    boxShadow: `inset 0 1px 0 ${T.surface3}`,
  }
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Pending'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export function getStatusColor(status: string): string {
  const lower = status.toLowerCase()
  if (['active', 'implemented', 'closed', 'applied'].some(k => lower.includes(k))) return T.success
  if (['new', 'pending', 'in progress', 'in review', 'needs info'].some(k => lower.includes(k))) return T.warning
  if (['rejected', 'error', 'failed'].some(k => lower.includes(k))) return T.danger
  return T.muted
}
