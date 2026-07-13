/**
 * Drizzle-row -> domain mappers for the academic tables (course-outcome
 * overrides, action-queue tasks/transitions/placements, faculty-calendar
 * templates/workspaces, calendar-audit events, and faculty meetings).
 *
 * Kept in the persistence layer because they reference db/schema row types; the
 * parse/shape logic is moved verbatim from modules/academic.ts. Zod contracts
 * and the pure `isoToMillis` helper are imported from the application layer.
 */
import { z } from 'zod'
import {
  academicCalendarAuditEvents,
  academicMeetings,
  academicTaskPlacements,
  academicTaskTransitions,
  academicTasks,
  courseOutcomeOverrides,
  courses,
  facultyCalendarAdminWorkspaces,
  facultyCalendarCanonicalTemplates,
  facultyCalendarWorkspaces,
  sectionOfferings,
  students,
} from '../../../../db/schema.js'
import { parseJson } from '../../../../lib/json.js'
import { isoToMillis } from '../../../../application/use-cases/academic/academic-utils.js'
import {
  courseOutcomeSchema,
  courseOutcomeScopeSchema,
  facultyCalendarAdminWorkspaceSchema,
} from '../../../../application/use-cases/academic/academic-contracts.js'
import {
  academicMeetingSchema,
  calendarAuditEventSchema,
  facultyCalendarTemplateSchema,
  queueTransitionSchema,
  sharedTaskPayloadSchema,
  sharedTaskSchema,
  taskPlacementSchema,
} from '../../../../application/use-cases/academic/academic-task-contracts.js'

export function mapCourseOutcomeOverride(row: typeof courseOutcomeOverrides.$inferSelect) {
  const parsed = z.array(courseOutcomeSchema).safeParse(parseJson(row.outcomesJson, []))
  return {
    courseOutcomeOverrideId: row.courseOutcomeOverrideId,
    courseId: row.courseId,
    scopeType: row.scopeType as z.infer<typeof courseOutcomeScopeSchema>,
    scopeId: row.scopeId,
    outcomes: parsed.success ? parsed.data : [],
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapAcademicTaskRow(
  row: typeof academicTasks.$inferSelect,
  transitions: z.infer<typeof queueTransitionSchema>[],
) {
  const parsed = sharedTaskPayloadSchema.safeParse(parseJson(row.payloadJson, {}))
  const payload = parsed.success ? parsed.data : {}
  return sharedTaskSchema.parse({
    id: row.taskId,
    studentId: row.studentId,
    studentName: payload.studentName ?? row.studentId,
    studentUsn: payload.studentUsn ?? row.studentId,
    offeringId: payload.offeringId ?? row.offeringId,
    courseCode: payload.courseCode ?? 'NA',
    courseName: payload.courseName ?? row.title,
    year: payload.year ?? 'Unmapped',
    assignedTo: row.assignedToRole,
    taskType: row.taskType,
    status: row.status,
    title: row.title,
    due: row.dueLabel,
    dueDateISO: row.dueDateIso ?? payload.dueDateISO,
    riskProb: row.riskProbScaled / 100,
    riskBand: row.riskBand,
    actionHint: payload.actionHint ?? row.title,
    priority: row.priority,
    createdAt: payload.createdAt ?? isoToMillis(row.createdAt),
    updatedAt: payload.updatedAt ?? isoToMillis(row.updatedAt),
    remedialPlan: payload.remedialPlan,
    escalated: payload.escalated,
    sourceRole: payload.sourceRole,
    manual: payload.manual,
    transitionHistory: transitions.length > 0 ? transitions : (payload.transitionHistory ?? []),
    unlockRequest: payload.unlockRequest,
    requestNote: payload.requestNote,
    handoffNote: payload.handoffNote,
    resolvedByFacultyId: payload.resolvedByFacultyId,
    scheduleMeta: payload.scheduleMeta,
    dismissal: payload.dismissal,
  })
}

export function mapTaskTransitionRow(row: typeof academicTaskTransitions.$inferSelect) {
  return queueTransitionSchema.parse({
    id: row.transitionId,
    at: isoToMillis(row.occurredAt),
    actorRole: row.actorRole,
    actorTeacherId: row.actorFacultyId ?? undefined,
    action: row.action,
    fromOwner: row.fromOwner ?? undefined,
    toOwner: row.toOwner,
    note: row.note,
  })
}

export function mapTaskPlacementRow(row: typeof academicTaskPlacements.$inferSelect) {
  return taskPlacementSchema.parse({
    taskId: row.taskId,
    dateISO: row.dateIso,
    placementMode: row.placementMode,
    startMinutes: row.startMinutes ?? undefined,
    endMinutes: row.endMinutes ?? undefined,
    slotId: row.slotId ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    updatedAt: isoToMillis(row.updatedAt),
  })
}

export function mapFacultyCalendarWorkspaceRow(row: typeof facultyCalendarWorkspaces.$inferSelect) {
  const parsed = facultyCalendarTemplateSchema.safeParse(parseJson(row.templateJson, {}))
  if (!parsed.success) return null
  return parsed.data
}

export function mapFacultyCalendarCanonicalTemplateRow(row: typeof facultyCalendarCanonicalTemplates.$inferSelect) {
  const parsed = facultyCalendarTemplateSchema.safeParse(parseJson(row.templateJson, {}))
  if (!parsed.success) return null
  return parsed.data
}

export function mapFacultyCalendarAdminWorkspaceRow(row: typeof facultyCalendarAdminWorkspaces.$inferSelect) {
  const parsed = facultyCalendarAdminWorkspaceSchema.safeParse(parseJson(row.workspaceJson, {}))
  if (!parsed.success) return null
  return {
    publishedAt: parsed.data.publishedAt ?? null,
    markers: parsed.data.markers ?? [],
  }
}

export function mapCalendarAuditEventRow(row: typeof academicCalendarAuditEvents.$inferSelect) {
  const parsed = calendarAuditEventSchema.safeParse(parseJson(row.payloadJson, {}))
  return parsed.success ? parsed.data : null
}

export function mapAcademicMeetingRow(input: {
  row: typeof academicMeetings.$inferSelect
  student?: typeof students.$inferSelect | null
  offering?: typeof sectionOfferings.$inferSelect | null
  course?: typeof courses.$inferSelect | null
}) {
  return academicMeetingSchema.parse({
    meetingId: input.row.meetingId,
    version: input.row.version,
    facultyId: input.row.facultyId,
    studentId: input.row.studentId,
    studentName: input.student?.name ?? input.row.studentId,
    studentUsn: input.student?.usn ?? input.row.studentId,
    offeringId: input.row.offeringId ?? null,
    courseCode: input.course?.courseCode ?? null,
    courseName: input.course?.title ?? null,
    title: input.row.title,
    notes: input.row.notes ?? null,
    dateISO: input.row.dateIso,
    startMinutes: input.row.startMinutes,
    endMinutes: input.row.endMinutes,
    status: input.row.status,
    createdByFacultyId: input.row.createdByFacultyId ?? null,
    createdAt: isoToMillis(input.row.createdAt),
    updatedAt: isoToMillis(input.row.updatedAt),
  })
}
