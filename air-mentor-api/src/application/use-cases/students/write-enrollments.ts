/**
 * POST /api/admin/students/:studentId/enrollments and
 * PATCH /api/admin/enrollments/:enrollmentId — create + update a student
 * enrollment. The version guard mirrors `expectVersion` verbatim (conflict with
 * the mapped current enrollment as payload); responses are the mapped
 * enrollment shape.
 */
import { conflict, notFound } from '../../../lib/http-errors.js'
import type { StudentsRepository } from '../../ports/students-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapEnrollment } from './student-record-mappers.js'

export type EnrollmentWriteDeps = {
  repo: StudentsRepository
  emitAudit: AuditEmitter
}

export type CreateEnrollmentUseCaseInput = {
  actorRole: string
  actorId: string | null
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder?: number
  academicStatus: string
  startDate: string
  endDate?: string | null
}

export async function createEnrollment(
  deps: EnrollmentWriteDeps,
  input: CreateEnrollmentUseCaseInput,
): Promise<UseCaseResponse> {
  const created = await deps.repo.createEnrollment({
    studentId: input.studentId,
    branchId: input.branchId,
    termId: input.termId,
    sectionCode: input.sectionCode,
    rosterOrder: input.rosterOrder ?? 0,
    academicStatus: input.academicStatus,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
  })
  const mapped = mapEnrollment(created)
  await deps.emitAudit({
    entityType: 'StudentEnrollment',
    entityId: created.enrollmentId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    after: mapped,
  })
  return { status: 200, body: mapped }
}

export type UpdateEnrollmentUseCaseInput = {
  actorRole: string
  actorId: string | null
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder?: number
  academicStatus: string
  startDate: string
  endDate?: string | null
  version: number
}

export async function updateEnrollment(
  deps: EnrollmentWriteDeps,
  input: UpdateEnrollmentUseCaseInput,
): Promise<UseCaseResponse> {
  const current = await deps.repo.getEnrollmentById(input.enrollmentId)
  if (!current) throw notFound('Enrollment not found')
  const mappedCurrent = mapEnrollment(current)
  if (current.version !== input.version) throw conflict('Stale version for StudentEnrollment', mappedCurrent)
  const next = await deps.repo.updateEnrollment({
    enrollmentId: input.enrollmentId,
    studentId: input.studentId,
    branchId: input.branchId,
    termId: input.termId,
    sectionCode: input.sectionCode,
    rosterOrder: input.rosterOrder ?? current.rosterOrder,
    academicStatus: input.academicStatus,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    currentVersion: current.version,
  })
  const mappedNext = mapEnrollment(next)
  await deps.emitAudit({
    entityType: 'StudentEnrollment',
    entityId: input.enrollmentId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: mappedCurrent,
    after: mappedNext,
  })
  return { status: 200, body: mappedNext }
}
