/**
 * Pure task-payload helper shared by the placements use-case and re-exported by
 * modules/academic-runtime-routes.ts (a unit test imports it from there).
 *
 * Moved verbatim from the legacy module.
 */
import { parseJson, stringifyJson } from '../../../lib/json.js'

export function taskPayloadWithPlacementDate(
  payloadJson: string,
  dueDateISO: string,
  updatedAt: number,
) {
  const currentPayload = parseJson(payloadJson, {} as Record<string, unknown>)
  const nextPayload: Record<string, unknown> = {
    ...currentPayload,
    dueDateISO,
    updatedAt,
  }
  const scheduleMeta = currentPayload.scheduleMeta
  if (scheduleMeta && typeof scheduleMeta === 'object' && !Array.isArray(scheduleMeta)) {
    nextPayload.scheduleMeta = {
      ...(scheduleMeta as Record<string, unknown>),
      nextDueDateISO: dueDateISO,
    }
  }
  return stringifyJson(nextPayload)
}
