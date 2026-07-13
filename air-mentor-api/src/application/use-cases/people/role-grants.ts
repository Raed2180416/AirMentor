/**
 * POST /api/admin/faculty/:facultyId/role-grants and
 * PATCH /api/admin/role-grants/:grantId — create/update a faculty role grant.
 * Row construction, the version guard, audit payloads, and the reference-data-
 * enriched response mapping are moved verbatim; DB access goes through the
 * repository and the id/clock are injected.
 */
import { createId } from '../../../lib/ids.js'
import { conflict, notFound } from '../../../lib/http-errors.js'
import type { PeopleRepository } from '../../ports/people-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapRoleGrant } from './people-domain.js'
import type { RoleGrantCreateBody, RoleGrantPatchBody } from './people-schemas.js'

export type RoleGrantDeps = {
  repo: PeopleRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type CreateRoleGrantInput = {
  actorRole: string
  actorFacultyId: string | null
  body: RoleGrantCreateBody
}

export async function createRoleGrant(deps: RoleGrantDeps, input: CreateRoleGrantInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const body = input.body
  const created = {
    grantId: createId('grant'),
    facultyId: body.facultyId,
    roleCode: body.roleCode,
    scopeType: body.scopeType,
    scopeId: body.scopeId,
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    status: body.status,
    version: 1,
    createdAt: deps.now(),
    updatedAt: deps.now(),
  }
  await repo.insertRoleGrant(created)
  await deps.emitAudit({
    entityType: 'RoleGrant',
    entityId: created.grantId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId,
    after: mapRoleGrant(created),
  })
  return { status: 200, body: mapRoleGrant(created, await repo.loadReferenceData()) }
}

export type UpdateRoleGrantInput = {
  grantId: string
  actorRole: string
  actorFacultyId: string | null
  body: RoleGrantPatchBody
}

export async function updateRoleGrant(deps: RoleGrantDeps, input: UpdateRoleGrantInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const body = input.body
  const current = await repo.getRoleGrantById(input.grantId)
  if (!current) throw notFound('Role grant not found')
  if (current.version !== body.version) throw conflict('Stale version for RoleGrant', mapRoleGrant(current))
  await repo.updateRoleGrant(input.grantId, {
    facultyId: body.facultyId,
    roleCode: body.roleCode,
    scopeType: body.scopeType,
    scopeId: body.scopeId,
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    status: body.status,
    version: current.version + 1,
    updatedAt: deps.now(),
  })
  const next = (await repo.getRoleGrantById(input.grantId))!
  await deps.emitAudit({
    entityType: 'RoleGrant',
    entityId: input.grantId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId,
    before: mapRoleGrant(current),
    after: mapRoleGrant(next),
  })
  return { status: 200, body: mapRoleGrant(next, await repo.loadReferenceData()) }
}
