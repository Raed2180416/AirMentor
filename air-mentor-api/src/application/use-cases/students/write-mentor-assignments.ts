/**
 * POST /api/admin/mentor-assignments and
 * PATCH /api/admin/mentor-assignments/:assignmentId — create + update a single
 * mentor assignment. The version guard mirrors `expectVersion` verbatim
 * (conflict with the mapped current assignment as payload); responses are the
 * mapped mentor-assignment shape.
 */
import { conflict, notFound } from '../../../lib/http-errors.js'
import type { StudentsRepository } from '../../ports/students-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapMentorAssignment } from './student-record-mappers.js'

export type MentorAssignmentWriteDeps = {
  repo: StudentsRepository
  emitAudit: AuditEmitter
}

export type CreateMentorAssignmentUseCaseInput = {
  actorRole: string
  actorId: string | null
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo?: string | null
  source: string
}

export async function createMentorAssignment(
  deps: MentorAssignmentWriteDeps,
  input: CreateMentorAssignmentUseCaseInput,
): Promise<UseCaseResponse> {
  const created = await deps.repo.createMentorAssignment({
    studentId: input.studentId,
    facultyId: input.facultyId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    source: input.source,
  })
  const mapped = mapMentorAssignment(created)
  await deps.emitAudit({
    entityType: 'MentorAssignment',
    entityId: created.assignmentId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    after: mapped,
  })
  return { status: 200, body: mapped }
}

export type UpdateMentorAssignmentUseCaseInput = {
  actorRole: string
  actorId: string | null
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo?: string | null
  source: string
  version: number
}

export async function updateMentorAssignment(
  deps: MentorAssignmentWriteDeps,
  input: UpdateMentorAssignmentUseCaseInput,
): Promise<UseCaseResponse> {
  const current = await deps.repo.getMentorAssignmentById(input.assignmentId)
  if (!current) throw notFound('Mentor assignment not found')
  const mappedCurrent = mapMentorAssignment(current)
  if (current.version !== input.version) throw conflict('Stale version for MentorAssignment', mappedCurrent)
  const next = await deps.repo.updateMentorAssignment({
    assignmentId: input.assignmentId,
    studentId: input.studentId,
    facultyId: input.facultyId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    source: input.source,
    currentVersion: current.version,
  })
  const mappedNext = mapMentorAssignment(next)
  await deps.emitAudit({
    entityType: 'MentorAssignment',
    entityId: input.assignmentId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: mappedCurrent,
    after: mappedNext,
  })
  return { status: 200, body: mappedNext }
}
