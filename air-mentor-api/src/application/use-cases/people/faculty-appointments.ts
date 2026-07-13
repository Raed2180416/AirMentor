/**
 * POST /api/admin/faculty/:facultyId/appointments and
 * PATCH /api/admin/appointments/:appointmentId — create/update a faculty
 * appointment. Row construction, the version guard, audit payloads, and the
 * reference-data-enriched response mapping are moved verbatim; DB access goes
 * through the repository and the id/clock are injected.
 */
import { createId } from '../../../lib/ids.js'
import { conflict, notFound } from '../../../lib/http-errors.js'
import type { PeopleRepository } from '../../ports/people-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapAppointment } from './people-domain.js'
import type { AppointmentCreateBody, AppointmentPatchBody } from './people-schemas.js'

export type AppointmentDeps = {
  repo: PeopleRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type CreateAppointmentInput = {
  actorRole: string
  actorFacultyId: string | null
  body: AppointmentCreateBody
}

export async function createAppointment(deps: AppointmentDeps, input: CreateAppointmentInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const body = input.body
  const created = {
    appointmentId: createId('appointment'),
    facultyId: body.facultyId,
    departmentId: body.departmentId,
    branchId: body.branchId ?? null,
    isPrimary: body.isPrimary ? 1 : 0,
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    status: body.status,
    version: 1,
    createdAt: deps.now(),
    updatedAt: deps.now(),
  }
  await repo.insertAppointment(created)
  await deps.emitAudit({
    entityType: 'FacultyAppointment',
    entityId: created.appointmentId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId,
    after: mapAppointment(created),
  })
  return { status: 200, body: mapAppointment(created, await repo.loadReferenceData()) }
}

export type UpdateAppointmentInput = {
  appointmentId: string
  actorRole: string
  actorFacultyId: string | null
  body: AppointmentPatchBody
}

export async function updateAppointment(deps: AppointmentDeps, input: UpdateAppointmentInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const body = input.body
  const current = await repo.getAppointmentById(input.appointmentId)
  if (!current) throw notFound('Faculty appointment not found')
  if (current.version !== body.version) throw conflict('Stale version for FacultyAppointment', mapAppointment(current))
  await repo.updateAppointment(input.appointmentId, {
    facultyId: body.facultyId,
    departmentId: body.departmentId,
    branchId: body.branchId ?? null,
    isPrimary: body.isPrimary ? 1 : 0,
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    status: body.status,
    version: current.version + 1,
    updatedAt: deps.now(),
  })
  const next = (await repo.getAppointmentById(input.appointmentId))!
  await deps.emitAudit({
    entityType: 'FacultyAppointment',
    entityId: input.appointmentId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId,
    before: mapAppointment(current),
    after: mapAppointment(next),
  })
  return { status: 200, body: mapAppointment(next, await repo.loadReferenceData()) }
}
