/**
 * GET /api/admin/audit-events (+ /recent).
 *
 * Entity audit history reuses the injected `getAuditEventsForEntity` (its DB
 * read + mapping stays in modules/support). Recent audit reads through the
 * repository and maps rows with the injected `mapAuditEvent` closure, keeping
 * db/schema out of the application layer.
 */
import type { AdminControlPlaneRepository } from '../../ports/admin-control-plane-repository.js'
import type { UseCaseResponse } from '../curriculum-graph/shared.js'
import type { AuditEventRow } from './reminder-audit-domain.js'

export type ReadEntityAuditEventsDeps = {
  getAuditEventsForEntity: (entityType: string, entityId: string) => Promise<unknown>
}

export type ReadEntityAuditEventsInput = {
  entityType: string
  entityId: string
}

export async function readEntityAuditEvents(
  deps: ReadEntityAuditEventsDeps,
  input: ReadEntityAuditEventsInput,
): Promise<UseCaseResponse> {
  return {
    status: 200,
    body: {
      items: await deps.getAuditEventsForEntity(input.entityType, input.entityId),
    },
  }
}

export type ReadRecentAuditEventsDeps = {
  repo: AdminControlPlaneRepository
  mapAuditEvent: (row: AuditEventRow) => unknown
}

export type ReadRecentAuditEventsInput = {
  limit: number
}

export async function readRecentAuditEvents(
  deps: ReadRecentAuditEventsDeps,
  input: ReadRecentAuditEventsInput,
): Promise<UseCaseResponse> {
  const rows = await deps.repo.listRecentAuditEvents(input.limit)
  return {
    status: 200,
    body: {
      items: rows.map(deps.mapAuditEvent),
    },
  }
}
