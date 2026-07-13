/**
 * PATCH /api/admin/faculty/:facultyId — update the faculty profile + user
 * account, and (when the profile transitions to `deleted`) cascade-soft-delete
 * appointments, role grants, and offering ownerships and end active mentor
 * assignments, emitting one audit event per affected row. The version guard,
 * cascade loops, audit payloads, and final re-read/enrich are moved verbatim;
 * DB access goes through the repository and the batch-policy resolver is injected.
 */
import { deriveFacultyCredentialStatus } from '../../../lib/password-setup.js'
import { conflict, notFound } from '../../../lib/http-errors.js'
import type { PeopleRepository } from '../../ports/people-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapAppointment, mapFacultyRecord, mapMentorAssignment, mapRoleGrant } from './people-domain.js'
import { enrichFacultyRecordWithProvenance, type ResolveBatchPolicyFn } from './faculty-provenance.js'
import type { FacultyPatchBody } from './people-schemas.js'

export type UpdateFacultyDeps = {
  repo: PeopleRepository
  emitAudit: AuditEmitter
  resolveBatchPolicy: ResolveBatchPolicyFn
  now: () => string
}

export type UpdateFacultyInput = {
  facultyId: string
  actorRole: string
  actorFacultyId: string | null
  body: FacultyPatchBody
}

export async function updateFaculty(deps: UpdateFacultyDeps, input: UpdateFacultyInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const body = input.body
  const current = await repo.getFacultyProfileById(input.facultyId)
  if (!current) throw notFound('Faculty not found')
  if (current.version !== body.version) throw conflict('Stale version for FacultyProfile', current)
  const currentUser = (await repo.getUserAccountById(current.userId))!
  const now = deps.now()
  await repo.updateUserAccount(current.userId, {
    username: body.username,
    email: body.email,
    phone: body.phone ?? null,
    status: body.status,
    version: currentUser.version + 1,
    updatedAt: now,
  })
  await repo.updateFacultyProfile(input.facultyId, {
    employeeCode: body.employeeCode,
    displayName: body.displayName,
    designation: body.designation,
    joinedOn: body.joinedOn ?? null,
    status: body.status,
    version: current.version + 1,
    updatedAt: now,
  })

  const cascadeMetadata = {
    appointmentsDeleted: 0,
    roleGrantsDeleted: 0,
    ownershipsDeleted: 0,
    mentorAssignmentsEnded: 0,
  }
  if (body.status === 'deleted' && current.status !== 'deleted') {
    const effectiveTo = now.slice(0, 10)
    const [appointments, grants, ownerships, assignments] = await Promise.all([
      repo.listAppointmentsByFaculty(input.facultyId),
      repo.listRoleGrantsByFaculty(input.facultyId),
      repo.listOwnershipsByFaculty(input.facultyId),
      repo.listMentorAssignmentsByFaculty(input.facultyId),
    ])

    for (const appointment of appointments.filter(item => item.status !== 'deleted')) {
      const next = {
        ...appointment,
        status: 'deleted',
        version: appointment.version + 1,
        updatedAt: now,
      }
      await repo.updateAppointmentStatus(appointment.appointmentId, {
        status: next.status,
        version: next.version,
        updatedAt: next.updatedAt,
      })
      await deps.emitAudit({
        entityType: 'FacultyAppointment',
        entityId: appointment.appointmentId,
        action: 'cascade_deleted',
        actorRole: input.actorRole,
        actorId: input.actorFacultyId,
        before: mapAppointment(appointment),
        after: mapAppointment(next),
        metadata: { reason: 'faculty_profile_deleted', facultyId: input.facultyId },
      })
      cascadeMetadata.appointmentsDeleted += 1
    }

    for (const grant of grants.filter(item => item.status !== 'deleted')) {
      const next = {
        ...grant,
        status: 'deleted',
        version: grant.version + 1,
        updatedAt: now,
      }
      await repo.updateRoleGrantStatus(grant.grantId, {
        status: next.status,
        version: next.version,
        updatedAt: next.updatedAt,
      })
      await deps.emitAudit({
        entityType: 'RoleGrant',
        entityId: grant.grantId,
        action: 'cascade_deleted',
        actorRole: input.actorRole,
        actorId: input.actorFacultyId,
        before: mapRoleGrant(grant),
        after: mapRoleGrant(next),
        metadata: { reason: 'faculty_profile_deleted', facultyId: input.facultyId },
      })
      cascadeMetadata.roleGrantsDeleted += 1
    }

    for (const ownership of ownerships.filter(item => item.status !== 'deleted')) {
      const next = {
        ...ownership,
        status: 'deleted',
        version: ownership.version + 1,
        updatedAt: now,
      }
      await repo.updateOwnershipStatus(ownership.ownershipId, {
        status: next.status,
        version: next.version,
        updatedAt: next.updatedAt,
      })
      await deps.emitAudit({
        entityType: 'faculty_offering_ownership',
        entityId: ownership.ownershipId,
        action: 'cascade_deleted',
        actorRole: input.actorRole,
        actorId: input.actorFacultyId,
        before: ownership,
        after: next,
        metadata: { reason: 'faculty_profile_deleted', facultyId: input.facultyId },
      })
      cascadeMetadata.ownershipsDeleted += 1
    }

    for (const assignment of assignments.filter(item => !item.effectiveTo || item.effectiveTo > effectiveTo)) {
      const next = {
        ...assignment,
        effectiveTo,
        version: assignment.version + 1,
        updatedAt: now,
      }
      await repo.updateMentorAssignmentEffectiveTo(assignment.assignmentId, {
        effectiveTo: next.effectiveTo,
        version: next.version,
        updatedAt: next.updatedAt,
      })
      await deps.emitAudit({
        entityType: 'MentorAssignment',
        entityId: assignment.assignmentId,
        action: 'cascade_ended',
        actorRole: input.actorRole,
        actorId: input.actorFacultyId,
        before: mapMentorAssignment(assignment),
        after: mapMentorAssignment(next),
        metadata: { reason: 'faculty_profile_deleted', facultyId: input.facultyId },
      })
      cascadeMetadata.mentorAssignmentsEnded += 1
    }
  }

  const next = (await repo.getFacultyProfileById(input.facultyId))!
  const nextUser = await repo.getUserAccountById(current.userId)
  const nextCredentialRows = await repo.listPasswordCredentialsByUser(current.userId)
  const nextSetupTokenRows = await repo.listPasswordSetupTokensByUser(current.userId)
  const appointments = await repo.listAppointmentsByFaculty(input.facultyId)
  const grants = await repo.listRoleGrantsByFaculty(input.facultyId)
  const references = await repo.loadReferenceData()
  const payload = mapFacultyRecord({
    profile: next,
    user: nextUser,
    credentialStatus: deriveFacultyCredentialStatus({
      now,
      passwordConfigured: nextCredentialRows.length > 0,
      tokens: nextSetupTokenRows,
    }),
    appointments,
    grants,
    references,
  })
  await deps.emitAudit({
    entityType: 'FacultyProfile',
    entityId: input.facultyId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId,
    before: {
      ...current,
      username: currentUser.username,
      email: currentUser.email,
      phone: currentUser.phone,
    },
    after: payload,
    metadata: body.status === 'deleted' && current.status !== 'deleted'
      ? {
          reason: 'faculty_profile_deleted',
          cascade: cascadeMetadata,
        }
      : undefined,
  })
  return { status: 200, body: await enrichFacultyRecordWithProvenance(deps.resolveBatchPolicy, payload, references, new Map()) }
}
