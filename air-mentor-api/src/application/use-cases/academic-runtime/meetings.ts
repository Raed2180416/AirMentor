/**
 * Academic meeting use-cases (create / patch). Moved verbatim from
 * modules/academic-runtime-routes.ts; DB access goes through the repository and
 * the shared academic functions (meeting-window validation, supervision +
 * enrolment guards, response builder, audit emit) arrive via the deps bundle.
 * `facultyId` is passed in already-guarded by the controller so its null-check
 * keeps firing before request-body parsing, exactly as before.
 */
import type { z } from 'zod'
import { forbidden, notFound } from '../../../lib/http-errors.js'
import { createId } from '../../../lib/ids.js'
import { expectVersion } from '../../../modules/support.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'

export async function createMeeting(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  body: z.infer<AcademicRuntimeUseCaseDeps['academicMeetingCreateSchema']>,
) {
  deps.validateMeetingWindow(body.startMinutes, body.endMinutes)
  const { studentId } = await deps.assertViewerCanSuperviseStudent({
    auth,
    studentId: body.studentId,
    offeringId: body.offeringId ?? null,
  })

  if (body.offeringId) {
    const { offering } = await deps.getOfferingContext(body.offeringId)
    await deps.assertStudentEnrolledInOffering(offering, studentId)
  }

  const now = deps.now()
  const meetingId = createId('meeting')
  await deps.repo.insertMeeting({
    meetingId,
    facultyId,
    studentId,
    offeringId: body.offeringId ?? null,
    title: body.title,
    notes: body.notes ?? null,
    dateIso: body.dateISO,
    startMinutes: body.startMinutes,
    endMinutes: body.endMinutes,
    status: body.status,
    createdByFacultyId: facultyId,
  }, now, now)
  const saved = await deps.repo.getMeetingById(meetingId)
  if (!saved) throw notFound('Meeting could not be created')
  const response = await deps.buildAcademicMeetingResponse(saved)
  await deps.emitAudit({
    entityType: 'academic_meeting',
    entityId: meetingId,
    action: 'CREATE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    after: response,
  })
  return response
}

export async function updateMeeting(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  meetingId: string,
  body: z.infer<AcademicRuntimeUseCaseDeps['academicMeetingPatchSchema']>,
) {
  deps.validateMeetingWindow(body.startMinutes, body.endMinutes)
  const current = await deps.repo.getMeetingById(meetingId)
  if (!current) throw notFound('Meeting not found')
  if (current.facultyId !== facultyId) {
    throw forbidden('You can only update meetings owned by the active faculty')
  }
  expectVersion(current.version, body.version, 'meeting', current)
  const { studentId } = await deps.assertViewerCanSuperviseStudent({
    auth,
    studentId: body.studentId,
    offeringId: body.offeringId ?? current.offeringId ?? null,
  })
  if (body.offeringId) {
    const { offering } = await deps.getOfferingContext(body.offeringId)
    await deps.assertStudentEnrolledInOffering(offering, studentId)
  }

  await deps.repo.updateMeeting(meetingId, {
    studentId,
    offeringId: body.offeringId ?? null,
    title: body.title,
    notes: body.notes ?? null,
    dateIso: body.dateISO,
    startMinutes: body.startMinutes,
    endMinutes: body.endMinutes,
    status: body.status,
  }, current.version + 1, deps.now())
  const saved = await deps.repo.getMeetingById(meetingId)
  if (!saved) throw notFound('Meeting not found after update')
  const beforeResponse = await deps.buildAcademicMeetingResponse(current)
  const response = await deps.buildAcademicMeetingResponse(saved)
  await deps.emitAudit({
    entityType: 'academic_meeting',
    entityId: meetingId,
    action: 'UPDATE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    before: beforeResponse,
    after: response,
  })
  return response
}
