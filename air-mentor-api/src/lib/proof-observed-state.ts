import { parseJson } from './json.js'

export type ObservedStatePayload = Record<string, unknown>

export function parseObservedStatePayload(value: string | null | undefined): ObservedStatePayload {
  return parseJson(value, {} as Record<string, unknown>)
}

export function parseObservedStateRow<T extends { observedStateJson: string | null | undefined }>(row: T): ObservedStatePayload {
  return parseObservedStatePayload(row.observedStateJson)
}
