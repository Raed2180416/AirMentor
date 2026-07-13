/**
 * Proof reassessment access + meeting/calendar resolvers — proof reassessment
 * authorization, faculty-meeting response hydration, faculty calendar template
 * validation, and the editable-calendar-window status.
 *
 * DB-touching orchestration keeping the `context: RouteContext` signature.
 * Moved verbatim from modules/academic.ts.
 */
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { RouteContext } from '../../../../app.js'
import {
  academicMeetings,
  alertDecisions,
  courses,
  facultyCalendarAdminWorkspaces,
  facultyOfferingOwnerships,
  reassessmentEvents,
  riskAssessments,
  sectionOfferings,
  simulationRuns,
  students,
} from '../../../../db/schema.js'
import { AppError, badRequest, forbidden, notFound } from '../../../../lib/http-errors.js'
import {
  isTeacherVisibleActiveProofRunCandidate,
  pickMostRecentActiveRun,
} from '../../../../lib/proof-active-run.js'
import { requireAuth } from '../../../../modules/support.js'
import { facultyCalendarAdminWorkspaceSchema } from '../../../../application/use-cases/academic/academic-contracts.js'
import { facultyCalendarTemplateSchema } from '../../../../application/use-cases/academic/academic-task-contracts.js'
import {
  classBlocksCanOverlap,
  isLeaderLikeOwnershipRole,
  rangesOverlap,
  weekdayFromDateIso,
} from '../../../../application/use-cases/academic/academic-utils.js'
import {
  mapAcademicMeetingRow,
  mapFacultyCalendarAdminWorkspaceRow,
} from './academic-row-mappers.js'
import { getAcademicRuntimeState } from './academic-runtime-state.js'
import { assertViewerCanSuperviseStudent } from './academic-scope-resolvers.js'

export async function resolveProofReassessmentAccess(input: {
  context: RouteContext
  auth: ReturnType<typeof requireAuth>
  reassessmentEventId: string
}) {
  const [event] = await input.context.db
    .select()
    .from(reassessmentEvents)
    .where(eq(reassessmentEvents.reassessmentEventId, input.reassessmentEventId))
  if (!event) throw notFound('Proof reassessment not found')

  const [risk] = await input.context.db
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.riskAssessmentId, event.riskAssessmentId))
  if (!risk) throw notFound('Proof reassessment risk context not found')

  const [run] = risk.simulationRunId
    ? await input.context.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, risk.simulationRunId))
    : []
  if (!run) throw notFound('Proof reassessment run context not found')
  if ((run.demoWorkspaceId ?? null) !== (input.auth.demoWorkspaceId ?? null)) {
    throw new AppError(403, 'PROOF_RUN_SCOPE_MISMATCH', 'Proof run is not available in this workspace scope.')
  }

  if (input.auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
    const activeRunRows = await input.context.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    const scopedActiveRunRows = activeRunRows
      .filter(row => (row.demoWorkspaceId ?? null) === (input.auth.demoWorkspaceId ?? null))
      .filter(isTeacherVisibleActiveProofRunCandidate)
    const activeRun = pickMostRecentActiveRun(scopedActiveRunRows)
    if (!activeRun || activeRun.simulationRunId !== run.simulationRunId) {
      throw forbidden('Academic roles may modify proof reassessments only for the active proof run')
    }
    await assertViewerCanSuperviseStudent({
      context: input.context,
      auth: input.auth,
      studentId: event.studentId,
      offeringId: event.offeringId ?? risk.offeringId ?? null,
    })
    if (
      input.auth.facultyId
      && event.assignedFacultyId
      && event.assignedFacultyId !== input.auth.facultyId
      && input.auth.activeRoleGrant.roleCode !== 'HOD'
    ) {
      throw forbidden('This proof reassessment is assigned to a different faculty member')
    }
  }

  const [alert] = await input.context.db
    .select()
    .from(alertDecisions)
    .where(eq(alertDecisions.riskAssessmentId, event.riskAssessmentId))

  return { event, risk, run, alert: alert ?? null }
}

export async function buildAcademicMeetingResponse(
  context: RouteContext,
  row: typeof academicMeetings.$inferSelect,
) {
  const [student, offering] = await Promise.all([
    context.db.select().from(students).where(eq(students.studentId, row.studentId)).then(rows => rows[0] ?? null),
    row.offeringId
      ? context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, row.offeringId)).then(rows => rows[0] ?? null)
      : Promise.resolve(null),
  ])
  const course = offering
    ? await context.db.select().from(courses).where(eq(courses.courseId, offering.courseId)).then(rows => rows[0] ?? null)
    : null
  return mapAcademicMeetingRow({
    row,
    student,
    offering,
    course,
  })
}

export async function validateFacultyCalendarTemplate(
  context: RouteContext,
  facultyId: string,
  template: z.infer<typeof facultyCalendarTemplateSchema>,
) {
  if (template.facultyId !== facultyId) {
    throw badRequest('Faculty calendar template does not match the active faculty')
  }

  const ownershipRows = await context.db
    .select()
    .from(facultyOfferingOwnerships)
    .where(and(
      eq(facultyOfferingOwnerships.facultyId, facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
  const ownedOfferingIds = new Set(
    ownershipRows
      .filter(row => isLeaderLikeOwnershipRole(row.ownershipRole))
      .map(row => row.offeringId),
  )

  if (template.dayStartMinutes >= template.dayEndMinutes) {
    throw badRequest('Calendar day bounds are invalid')
  }

  for (const block of template.classBlocks) {
    if (block.facultyId !== facultyId) {
      throw badRequest('Class blocks must belong to the active faculty')
    }
    if (!ownedOfferingIds.has(block.offeringId)) {
      throw badRequest('Class blocks can only reference actively owned offerings')
    }
    if (block.startMinutes >= block.endMinutes) {
      throw badRequest('Class blocks must have a positive duration')
    }
    if (block.startMinutes < template.dayStartMinutes || block.endMinutes > template.dayEndMinutes) {
      throw badRequest('Class blocks must stay within the configured timetable bounds')
    }
    if (block.kind === 'extra' && (!block.dateISO || weekdayFromDateIso(block.dateISO) !== block.day)) {
      throw badRequest('Extra class blocks must carry a valid date that matches the selected weekday')
    }
  }

  for (let index = 0; index < template.classBlocks.length; index += 1) {
    const left = template.classBlocks[index]
    for (let compareIndex = index + 1; compareIndex < template.classBlocks.length; compareIndex += 1) {
      const right = template.classBlocks[compareIndex]
      if (!classBlocksCanOverlap(left, right)) continue
      if (!rangesOverlap(left, right)) continue
      throw badRequest('Faculty timetable contains overlapping class blocks', {
        leftBlockId: left.id,
        rightBlockId: right.id,
      })
    }
  }
}

export async function getEditableCalendarWindowStatus(context: RouteContext, facultyId: string) {
  const [workspaceRow] = await context.db
    .select()
    .from(facultyCalendarAdminWorkspaces)
    .where(eq(facultyCalendarAdminWorkspaces.facultyId, facultyId))
  const workspaceFromTable = workspaceRow ? mapFacultyCalendarAdminWorkspaceRow(workspaceRow) : null
  const runtimeWorkspace = workspaceFromTable
    ? null
    : await getAcademicRuntimeState(context, 'adminCalendarByFacultyId') as Record<string, unknown>
  const runtimeParsed = workspaceFromTable
    ? null
    : facultyCalendarAdminWorkspaceSchema.safeParse(runtimeWorkspace?.[facultyId])
  const publishedAt = workspaceFromTable?.publishedAt
    ?? (runtimeParsed?.success ? (runtimeParsed.data.publishedAt ?? null) : null)
  const directEditWindowEndsAt = publishedAt
    ? new Date(new Date(publishedAt).getTime() + (14 * 24 * 60 * 60 * 1000)).toISOString()
    : null
  const classEditingLocked = !!directEditWindowEndsAt && new Date(directEditWindowEndsAt).getTime() < new Date(context.now()).getTime()
  return { publishedAt, directEditWindowEndsAt, classEditingLocked }
}
