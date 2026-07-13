/**
 * Academic runtime-state persistence — read/normalize/write of the shadow
 * runtime-state slices (studentPatches, schemeByOffering, tasks, calendarAudit,
 * ...). Reads/writes the academic_runtime_state table directly, so it lives in
 * the persistence layer and keeps the legacy `context: RouteContext` signature
 * consumed by the academic dependency bag. Bodies moved verbatim from
 * modules/academic.ts (`context.db`/`context.now` unchanged).
 */
import { eq } from 'drizzle-orm'
import type { RouteContext } from '../../../../app.js'
import { academicRuntimeState } from '../../../../db/schema.js'
import { parseJson, stringifyJson } from '../../../../lib/json.js'
import {
  runtimeDefaults,
  runtimeSliceSchemas,
  type RuntimeStateKey,
} from '../../../../application/use-cases/academic/academic-contracts.js'

export function normalizeRuntimeSlice<K extends RuntimeStateKey>(stateKey: K, payload: unknown) {
  const parsed = runtimeSliceSchemas[stateKey].safeParse(payload)
  return parsed.success ? parsed.data : runtimeDefaults[stateKey]
}

export async function getAcademicRuntimeState(context: RouteContext, stateKey: RuntimeStateKey) {
  const [row] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  const fallback = runtimeDefaults[stateKey]
  const payload = row ? parseJson(row.payloadJson, fallback) : fallback
  return normalizeRuntimeSlice(stateKey, payload)
}

export async function saveAcademicRuntimeState<K extends RuntimeStateKey>(
  context: RouteContext,
  stateKey: K,
  payload: unknown,
) {
  const normalized = normalizeRuntimeSlice(stateKey, payload)
  const [current] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  if (current) {
    await context.db.update(academicRuntimeState).set({
      payloadJson: stringifyJson(normalized),
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(academicRuntimeState.stateKey, stateKey))
    return normalized
  }
  await context.db.insert(academicRuntimeState).values({
    stateKey,
    payloadJson: stringifyJson(normalized),
    version: 1,
    updatedAt: context.now(),
  })
  return normalized
}
