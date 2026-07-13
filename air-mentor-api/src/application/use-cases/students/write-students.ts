/**
 * POST/PATCH /api/admin/students — create + update a student, then return the
 * enriched student record. Error paths throw the same AppErrors as the legacy
 * handlers (notFound / conflict) and the version guard mirrors `expectVersion`
 * verbatim (conflict with the raw current row as payload).
 */
import { conflict, notFound } from '../../../lib/http-errors.js'
import type { StudentsRepository } from '../../ports/students-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapStudentRecord } from './student-record-mappers.js'
import { enrichStudentRecordWithProvenance } from './student-scope.js'
import type { ResolveBatchPolicyForStudents } from './students-domain.js'

export type StudentWriteDeps = {
  repo: StudentsRepository
  emitAudit: AuditEmitter
  resolveBatchPolicy: ResolveBatchPolicyForStudents
}

export type CreateStudentUseCaseInput = {
  actorRole: string
  actorId: string | null
  usn: string
  rollNumber?: string | null
  name: string
  email?: string | null
  phone?: string | null
  admissionDate: string
  status: string
}

export async function createStudent(
  deps: StudentWriteDeps,
  input: CreateStudentUseCaseInput,
): Promise<UseCaseResponse> {
  const institutionId = await deps.repo.getInstitutionIdForNewStudent()
  if (!institutionId) throw notFound('Institution is not configured')
  const created = await deps.repo.createStudent({
    institutionId,
    usn: input.usn,
    rollNumber: input.rollNumber ?? null,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    admissionDate: input.admissionDate,
    status: input.status,
  })
  await deps.emitAudit({
    entityType: 'Student',
    entityId: created.studentId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    after: created,
  })
  const cross = await deps.repo.loadStudentCrossDataset()
  const record = mapStudentRecord({ student: created, ...cross })
  return { status: 200, body: await enrichStudentRecordWithProvenance(deps.resolveBatchPolicy, record, new Map()) }
}

export type UpdateStudentUseCaseInput = {
  actorRole: string
  actorId: string | null
  studentId: string
  usn: string
  rollNumber?: string | null
  name: string
  email?: string | null
  phone?: string | null
  admissionDate: string
  status: string
  version: number
}

export async function updateStudent(
  deps: StudentWriteDeps,
  input: UpdateStudentUseCaseInput,
): Promise<UseCaseResponse> {
  const current = await deps.repo.getStudentById(input.studentId)
  if (!current) throw notFound('Student not found')
  if (current.version !== input.version) throw conflict('Stale version for Student', current)
  const next = await deps.repo.updateStudent({
    studentId: input.studentId,
    usn: input.usn,
    rollNumber: input.rollNumber ?? null,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    admissionDate: input.admissionDate,
    status: input.status,
    currentVersion: current.version,
  })
  await deps.emitAudit({
    entityType: 'Student',
    entityId: input.studentId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: current,
    after: next,
  })
  const cross = await deps.repo.loadStudentCrossDataset()
  const record = mapStudentRecord({ student: next, ...cross })
  return { status: 200, body: await enrichStudentRecordWithProvenance(deps.resolveBatchPolicy, record, new Map()) }
}
