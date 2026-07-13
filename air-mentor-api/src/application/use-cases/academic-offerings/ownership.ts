/**
 * Offering-ownership use-cases.
 *
 *   GET   /api/admin/offering-ownership
 *   POST  /api/admin/offering-ownership
 *   PATCH /api/admin/offering-ownership/:ownershipId
 *
 * ownershipRole is always pinned to the fixed role (as the legacy handler did,
 * ignoring any body value). Active assignments run the single-active-owner guard
 * (injected) before the write; optimistic concurrency reuses expectVersion.
 */
import { createId } from '../../../lib/ids.js'
import { notFound } from '../../../lib/http-errors.js'
import type { AcademicOfferingsRepository } from '../../ports/academic-offerings-repository.js'
import type { AuditEmitter, OwnershipRow } from './shared.js'

type AssertSingleActiveOfferingOwner = (
  offeringId: string,
  facultyId: string,
  excludeOwnershipId?: string,
) => Promise<void>

type ExpectVersion = (currentVersion: number, nextVersion: number, entityLabel: string, current: unknown) => void

export async function listOfferingOwnerships(
  deps: { repo: AcademicOfferingsRepository },
): Promise<unknown> {
  const items = await deps.repo.listOfferingOwnerships()
  return { items }
}

export type CreateOwnershipDeps = {
  repo: AcademicOfferingsRepository
  assertSingleActiveOfferingOwner: AssertSingleActiveOfferingOwner
  emitAudit: AuditEmitter
  now: () => string
}

export type CreateOwnershipInput = {
  offeringId: string
  facultyId: string
  status: string
  fixedOwnershipRole: string
  actorRole: string
  actorId: string | null
}

export async function createOwnership(deps: CreateOwnershipDeps, input: CreateOwnershipInput): Promise<unknown> {
  if (input.status === 'active') {
    await deps.assertSingleActiveOfferingOwner(input.offeringId, input.facultyId)
  }
  const ownershipId = createId('ownership')
  const now = deps.now()
  await deps.repo.insertOwnership({
    ownershipId,
    offeringId: input.offeringId,
    facultyId: input.facultyId,
    ownershipRole: input.fixedOwnershipRole,
    status: input.status,
    version: 1,
    createdAt: now,
    updatedAt: now,
  })
  const created = await deps.repo.getOwnershipById(ownershipId)
  await deps.emitAudit({
    entityType: 'faculty_offering_ownership',
    entityId: ownershipId,
    action: 'CREATE',
    actorRole: input.actorRole,
    actorId: input.actorId,
    after: created,
  })
  return created
}

export type UpdateOwnershipDeps = {
  repo: AcademicOfferingsRepository
  assertSingleActiveOfferingOwner: AssertSingleActiveOfferingOwner
  expectVersion: ExpectVersion
  emitAudit: AuditEmitter
  now: () => string
}

export type UpdateOwnershipInput = {
  ownershipId: string
  offeringId: string
  facultyId: string
  status: string
  version: number
  fixedOwnershipRole: string
  actorRole: string
  actorId: string | null
}

export async function updateOwnership(deps: UpdateOwnershipDeps, input: UpdateOwnershipInput): Promise<unknown> {
  const current = await deps.repo.getOwnershipById(input.ownershipId)
  if (!current) throw notFound('Offering ownership not found')
  deps.expectVersion(current.version, input.version, 'offering ownership', current)
  if (input.status === 'active') {
    await deps.assertSingleActiveOfferingOwner(input.offeringId, input.facultyId, current.ownershipId)
  }
  await deps.repo.updateOwnership(input.ownershipId, {
    offeringId: input.offeringId,
    facultyId: input.facultyId,
    ownershipRole: input.fixedOwnershipRole,
    status: input.status,
    version: current.version + 1,
    updatedAt: deps.now(),
  })
  const updated = await deps.repo.getOwnershipById(input.ownershipId)
  await deps.emitAudit({
    entityType: 'faculty_offering_ownership',
    entityId: input.ownershipId,
    action: 'UPDATE',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: current,
    after: updated,
  })
  return updated as OwnershipRow
}
