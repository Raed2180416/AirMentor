import { parseJson } from './json.js'

export type ObservedStatePayload = Record<string, unknown>

export function parseObservedStatePayload(value: string | null | undefined): ObservedStatePayload {
  return parseJson(value, {} as Record<string, unknown>)
}

export function parseObservedStateRow<T extends { observedStateJson: string | null | undefined }>(row: T): ObservedStatePayload {
  return parseObservedStatePayload(row.observedStateJson)
}

export function readObservedNullableNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function readObservedStateNumber(payload: ObservedStatePayload, ...keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in payload)) continue
    const value = readObservedNullableNumber(payload[key])
    if (value != null) return value
    if (payload[key] === null) return null
  }
  return null
}

export function observedStateRowOccurredAt<T extends { createdAt?: string | null; updatedAt?: string | null }>(row: T): string {
  return row.updatedAt ?? row.createdAt ?? ''
}

export function selectObservedRowsThroughCheckpoint<
  T extends { semesterNumber: number; createdAt?: string | null; updatedAt?: string | null },
>(
  rows: T[],
  checkpoint: { semesterNumber: number; createdAt: string },
): T[] {
  return rows.filter(row => (
    row.semesterNumber <= checkpoint.semesterNumber
    && observedStateRowOccurredAt(row) <= checkpoint.createdAt
  ))
}
