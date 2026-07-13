/**
 * Academic Zod contracts (part 2) — action-queue task, calendar/timetable,
 * faculty-meeting, attendance/assessment-commit, and public-faculty schemas,
 * plus the proof reassessment resolution credit table and small shared row
 * types.
 *
 * Framework/persistence-free companion to academic-contracts.ts. Moved verbatim
 * from modules/academic.ts (structural relocation only); the sole added tokens
 * are the `export` keyword on each top-level declaration.
 */
import { z } from 'zod'
import {
  offeringParamsSchema,
  proofReassessmentResolutionOutcomeSchema,
} from './academic-contracts.js'

export const uiRoleSchema = z.enum(['Course Leader', 'Mentor', 'HoD'])

export const taskStatusSchema = z.enum(['New', 'In Progress', 'Follow-up', 'Resolved'])

export const taskTypeSchema = z.enum(['Follow-up', 'Remedial', 'Attendance', 'Academic'])

export const riskBandSchema = z.enum(['High', 'Medium', 'Low'])

export const schedulePresetSchema = z.enum(['daily', 'weekly', 'monthly', 'weekdays', 'custom dates'])

export const taskDismissalSchema = z.object({
  kind: z.enum(['task', 'series']),
  dismissedAt: z.number().finite(),
  dismissedByFacultyId: z.string().optional(),
  dismissedDateISO: z.string().optional(),
})

export const scheduleMetaSchema = z.object({
  mode: z.enum(['one-time', 'scheduled']),
  preset: schedulePresetSchema.optional(),
  time: z.string().optional(),
  customDates: z.array(z.object({
    dateISO: z.string(),
    time: z.string().optional(),
  })).optional(),
  completedDatesISO: z.array(z.string()).optional(),
  skippedDatesISO: z.array(z.string()).optional(),
  status: z.enum(['active', 'paused', 'ended']).optional(),
  nextDueDateISO: z.string().optional(),
})

export const remedialPlanSchema = z.object({
  planId: z.string(),
  title: z.string(),
  createdAt: z.number().finite(),
  ownerRole: uiRoleSchema,
  dueDateISO: z.string(),
  checkInDatesISO: z.array(z.string()),
  steps: z.array(z.object({
    id: z.string(),
    label: z.string(),
    completedAt: z.number().finite().optional(),
  })),
})

export const unlockRequestSchema = z.object({
  offeringId: z.string(),
  kind: z.enum(['tt1', 'tt2', 'quiz', 'assignment', 'attendance', 'finals', 'scheme', 'blueprint']),
  status: z.enum(['Pending', 'Approved', 'Rejected', 'Reset Completed', 'Relocked']),
  requestedByRole: uiRoleSchema,
  requestedByFacultyId: z.string().optional(),
  requestedAt: z.number().finite(),
  reviewedAt: z.number().finite().optional(),
  requestNote: z.string().optional(),
  reviewNote: z.string().optional(),
  handoffNote: z.string().optional(),
})

export const queueTransitionSchema = z.object({
  id: z.string(),
  at: z.number().finite(),
  actorRole: z.union([uiRoleSchema, z.literal('System'), z.literal('Auto')]),
  actorTeacherId: z.string().optional(),
  action: z.string(),
  fromOwner: uiRoleSchema.optional(),
  toOwner: uiRoleSchema,
  note: z.string(),
})

export const sharedTaskSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  studentUsn: z.string(),
  offeringId: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  year: z.string(),
  riskProb: z.number().finite(),
  riskBand: riskBandSchema,
  title: z.string(),
  due: z.string(),
  status: taskStatusSchema,
  actionHint: z.string(),
  priority: z.number().int(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite().optional(),
  assignedTo: uiRoleSchema,
  taskType: taskTypeSchema.optional(),
  dueDateISO: z.string().optional(),
  remedialPlan: remedialPlanSchema.optional(),
  escalated: z.boolean().optional(),
  sourceRole: z.union([uiRoleSchema, z.literal('Auto'), z.literal('System')]).optional(),
  manual: z.boolean().optional(),
  transitionHistory: z.array(queueTransitionSchema).optional(),
  unlockRequest: unlockRequestSchema.optional(),
  requestNote: z.string().optional(),
  handoffNote: z.string().optional(),
  resolvedByFacultyId: z.string().optional(),
  scheduleMeta: scheduleMetaSchema.optional(),
  dismissal: taskDismissalSchema.optional(),
})
export const sharedTaskPayloadSchema = sharedTaskSchema.partial()

export const taskSyncSchema = z.object({
  tasks: z.array(sharedTaskSchema),
})

export const taskPlacementSchema = z.object({
  taskId: z.string(),
  dateISO: z.string(),
  placementMode: z.enum(['timed', 'untimed']),
  startMinutes: z.number().int().optional(),
  endMinutes: z.number().int().optional(),
  slotId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  updatedAt: z.number().finite(),
})

export const taskPlacementSyncSchema = z.object({
  placements: z.record(z.string(), taskPlacementSchema),
})

export const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

export const timetableSlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

export const timetableClassBlockSchema = z.object({
  id: z.string().min(1),
  facultyId: z.string().min(1),
  offeringId: z.string().min(1),
  courseCode: z.string().min(1),
  courseName: z.string().min(1),
  section: z.string().min(1),
  year: z.string().min(1),
  day: weekdaySchema,
  dateISO: z.string().optional(),
  kind: z.enum(['regular', 'extra']).optional(),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  slotId: z.string().optional(),
  slotSpan: z.number().int().positive().optional(),
}).passthrough()

export const facultyCalendarTemplateSchema = z.object({
  facultyId: z.string().min(1),
  slots: z.array(timetableSlotSchema),
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  classBlocks: z.array(timetableClassBlockSchema),
  updatedAt: z.number().finite(),
}).passthrough()

export const facultyCalendarWorkspaceUpsertSchema = z.object({
  template: facultyCalendarTemplateSchema,
})

export const calendarAuditEventSchema = z.object({
  id: z.string(),
  facultyId: z.string(),
  actorRole: uiRoleSchema,
  actorFacultyId: z.string().optional(),
  timestamp: z.number().finite(),
  actionKind: z.enum([
    'class-created',
    'class-moved',
    'class-resized',
    'task-scheduled',
    'task-rescheduled',
    'task-unscheduled',
    'task-created-and-scheduled',
  ]),
  targetType: z.enum(['class', 'task']),
  targetId: z.string(),
  note: z.string(),
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional(),
})

export const calendarAuditSyncSchema = z.object({
  events: z.array(calendarAuditEventSchema),
})

export const coAttainmentRowSchema = z.object({
  coId: z.string(),
  desc: z.string(),
  bloom: z.string(),
  target: z.number().int().min(0).max(100),
  tt1Attainment: z.number().min(0).max(100).nullable(),
  tt2Attainment: z.number().min(0).max(100).nullable(),
  overallAttainment: z.number().min(0).max(100).nullable(),
  studentsCounted: z.number().int().min(0),
})

export const meetingStatusSchema = z.enum(['scheduled', 'completed', 'cancelled'])

export const academicMeetingSchema = z.object({
  meetingId: z.string(),
  version: z.number().int().positive(),
  facultyId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  studentUsn: z.string(),
  offeringId: z.string().nullable().optional(),
  courseCode: z.string().nullable().optional(),
  courseName: z.string().nullable().optional(),
  title: z.string(),
  notes: z.string().nullable().optional(),
  dateISO: z.string(),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  status: meetingStatusSchema,
  createdByFacultyId: z.string().nullable().optional(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
})

export const academicMeetingCreateSchema = z.object({
  studentId: z.string().min(1),
  offeringId: z.string().min(1).nullable().optional(),
  title: z.string().min(1),
  notes: z.string().trim().nullable().optional(),
  dateISO: z.string().min(1),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  status: meetingStatusSchema.default('scheduled'),
})

export const academicMeetingPatchSchema = academicMeetingCreateSchema.extend({
  version: z.number().int().positive(),
})

export const academicMeetingParamsSchema = z.object({
  meetingId: z.string().min(1),
})

export const attendanceCommitSchema = z.object({
  entries: z.array(z.object({
    studentId: z.string().min(1),
    presentClasses: z.number().int().min(0),
    totalClasses: z.number().int().min(1),
  })),
  capturedAt: z.string().optional(),
  lock: z.boolean().optional(),
})

export const assessmentEntryKindSchema = z.enum(['tt1', 'tt2', 'quiz', 'assignment', 'finals'])

export const assessmentCommitSchema = z.object({
  entries: z.array(z.object({
    studentId: z.string().min(1),
    components: z.array(z.object({
      componentCode: z.string().min(1),
      score: z.number().int().min(0),
      maxScore: z.number().int().min(1),
    })).min(1),
  })),
  evaluatedAt: z.string().optional(),
  lock: z.boolean().optional(),
})

export const assessmentCommitParamsSchema = offeringParamsSchema.extend({
  kind: assessmentEntryKindSchema,
})

export const publicFacultyResponseSchema = z.object({
  items: z.array(z.object({
    facultyId: z.string(),
    username: z.string(),
    email: z.string(),
    name: z.string(),
    displayName: z.string(),
    designation: z.string(),
    dept: z.string(),
    departmentCode: z.string(),
    roleTitle: z.string(),
    allowedRoles: z.array(z.enum(['Course Leader', 'Mentor', 'HoD'])),
  })),
})

export type PublicFacultyResponse = z.infer<typeof publicFacultyResponseSchema>

export type CourseHistoryRecord = {
  courseCode: string
  semesterNumber: number
  score: number
  result: string
}

export const proofResolutionCreditByOutcome = {
  completed_awaiting_evidence: 0.02,
  completed_improving: 0.05,
  not_completed: -0.05,
  no_show: -0.08,
  switch_intervention: -0.01,
  administratively_closed: 0,
} satisfies Record<z.infer<typeof proofReassessmentResolutionOutcomeSchema>, number>
