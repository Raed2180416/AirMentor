/**
 * Academic runtime-state slice writes: the deprecated per-key upsert and the
 * named-slice upserts (drafts / cell-values / locks). Moved verbatim from
 * modules/academic-runtime-routes.ts; the `:stateKey` path uses the repository
 * for its direct table upsert while the named-slice path delegates to the shared
 * saveAcademicRuntimeState accessor (via the deps bundle), exactly as before.
 */
import { stringifyJson } from '../../../lib/json.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'

export async function upsertRuntimeStateSlice(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  stateKey: string,
  body: unknown,
) {
  const current = await deps.repo.getRuntimeStateRow(stateKey)
  if (current) {
    await deps.repo.updateRuntimeStateRow(stateKey, stringifyJson(body), current.version)
  } else {
    await deps.repo.insertRuntimeStateRow(stateKey, stringifyJson(body))
  }
  await deps.emitAudit({
    entityType: 'academic_runtime_state',
    entityId: stateKey,
    action: 'UPSERT',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId ?? auth.userId,
    metadata: { stateKey },
  })
  return { ok: true, stateKey }
}

export async function upsertNamedRuntimeSlice(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  route: string,
  stateKey: 'drafts' | 'cellValues' | 'lockByOffering' | 'lockAuditByTarget',
  body: unknown,
) {
  await deps.saveAcademicRuntimeState(stateKey, body)
  await deps.emitAudit({
    entityType: 'academic_runtime_state',
    entityId: stateKey,
    action: 'UPSERT',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId ?? auth.userId,
    metadata: {
      route,
      stateKey,
    },
  })
  return { ok: true, stateKey }
}
