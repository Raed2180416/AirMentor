import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicCalendarAuditEvents,
  academicMeetings,
  academicRuntimeState,
  academicTerms,
  academicTaskPlacements,
  academicTaskTransitions,
  academicTasks,
  alertAcknowledgements,
  alertDecisions,
  alertOutcomes,
  batches,
  branches,
  courseOutcomeOverrides,
  courses,
  departments,
  electiveRecommendations,
  facultyAppointments,
  facultyCalendarWorkspaces,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  offeringAssessmentSchemes,
  offeringQuestionPapers,
  reassessmentEvents,
  reassessmentResolutions,
  riskAssessments,
  roleGrants,
  sectionOfferings,
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationRuns,
  studentAssessmentScores,
  studentAcademicProfiles,
  studentAgentSessions,
  studentAttendanceSnapshots,
  studentEnrollments,
  studentInterventions,
  studentObservedSemesterStates,
  students,
  transcriptSubjectResults,
  transcriptTermResults,
  userAccounts,
  institutions,
} from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { badRequest, forbidden, notFound } from '../lib/http-errors.js'
import { inferObservableRisk } from '../lib/inference-engine.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import {
  getProofRiskModelActive,
  buildHodProofAnalytics,
  buildStudentAgentCard,
  buildStudentRiskExplorer,
  listStudentAgentTimeline,
  sendStudentAgentMessage,
  startStudentAgentSession,
} from '../lib/msruas-proof-control-plane.js'
import {
  buildObservableFeaturePayload,
  scoreObservableRiskWithModel,
} from '../lib/proof-risk-model.js'
import {
  emitAuditEvent,
  expectVersion,
  parseOrThrow,
  requireAuth,
  requireRole,
} from './support.js'
import { DEFAULT_POLICY, resolveBatchPolicy, type ResolvedPolicy } from './admin-structure.js'

const academicRoleCodes = ['COURSE_LEADER', 'MENTOR', 'HOD'] as const
const runtimeStateKeys = [
  'studentPatches',
  'schemeByOffering',
  'ttBlueprintsByOffering',
  'drafts',
  'cellValues',
  'lockByOffering',
  'lockAuditByTarget',
  'tasks',
  'resolvedTasks',
  'timetableByFacultyId',
  'adminCalendarByFacultyId',
  'taskPlacements',
  'calendarAudit',
] as const

const runtimeStateKeySchema = z.enum(runtimeStateKeys)
type RuntimeStateKey = z.infer<typeof runtimeStateKeySchema>

const runtimeDefaults = {
  studentPatches: {},
  schemeByOffering: {},
  ttBlueprintsByOffering: {},
  drafts: {},
  cellValues: {},
  lockByOffering: {},
  lockAuditByTarget: {},
  tasks: [],
  resolvedTasks: {},
  timetableByFacultyId: {},
  adminCalendarByFacultyId: {},
  taskPlacements: {},
  calendarAudit: [] as Array<Record<string, unknown>>,
} satisfies Record<RuntimeStateKey, unknown>

const runtimeSliceSchemas = {
  studentPatches: z.record(z.string(), z.record(z.string(), z.unknown())),
  schemeByOffering: z.record(z.string(), z.record(z.string(), z.unknown())),
  ttBlueprintsByOffering: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.unknown()))),
  drafts: z.record(z.string(), z.number().finite()),
  cellValues: z.record(z.string(), z.number().finite()),
  lockByOffering: z.record(z.string(), z.record(z.string(), z.boolean())),
  lockAuditByTarget: z.record(z.string(), z.array(z.object({
    action: z.string(),
    actorRole: z.string(),
    at: z.number().finite().optional(),
  }).passthrough())),
  tasks: z.array(z.object({
    id: z.string(),
    studentId: z.string(),
    offeringId: z.string(),
    title: z.string(),
  }).passthrough()),
  resolvedTasks: z.record(z.string(), z.number().finite()),
  timetableByFacultyId: z.record(z.string(), z.record(z.string(), z.unknown())),
  adminCalendarByFacultyId: z.record(z.string(), z.object({
    publishedAt: z.string().nullable().optional(),
    markers: z.array(z.object({
      markerId: z.string(),
      facultyId: z.string().optional(),
      markerType: z.string(),
      title: z.string(),
      dateISO: z.string(),
    }).passthrough()),
  }).passthrough()),
  taskPlacements: z.record(z.string(), z.object({
    dateISO: z.string(),
    placementMode: z.enum(['untimed', 'timed']),
  }).passthrough()),
  calendarAudit: z.array(z.object({
    eventId: z.string().optional(),
    action: z.string(),
    at: z.number().finite().optional(),
  }).passthrough()),
} satisfies Record<RuntimeStateKey, z.ZodTypeAny>

const hodProofSummaryQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
})

const hodProofCourseQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  riskBand: z.string().min(1).optional(),
  courseCode: z.string().min(1).optional(),
})

const hodProofFacultyQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  facultyId: z.string().min(1).optional(),
})

const hodProofStudentQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  riskBand: z.string().min(1).optional(),
  courseCode: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
})

const hodProofReassessmentQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  riskBand: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  facultyId: z.string().min(1).optional(),
  courseCode: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
})

const studentShellQuerySchema = z.object({
  simulationRunId: z.string().min(1).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
})

const studentShellSessionCreateSchema = z.object({
  simulationRunId: z.string().min(1).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
})

const studentShellMessageSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
})

const proofReassessmentParamsSchema = z.object({
  reassessmentEventId: z.string().min(1),
})

const proofReassessmentAcknowledgeSchema = z.object({
  note: z.string().trim().max(1000).optional(),
})

const proofReassessmentResolutionOutcomeSchema = z.enum([
  'completed_awaiting_evidence',
  'completed_improving',
  'not_completed',
  'no_show',
  'switch_intervention',
  'administratively_closed',
])

const proofReassessmentResolveSchema = z.object({
  outcome: proofReassessmentResolutionOutcomeSchema,
  note: z.string().trim().max(1000).optional(),
})

const academicBootstrapQuerySchema = z.object({
  simulationStageCheckpointId: z.string().min(1).optional(),
})

const offeringCreateSchema = z.object({
  courseId: z.string().min(1),
  termId: z.string().min(1),
  branchId: z.string().min(1),
  sectionCode: z.string().min(1),
  yearLabel: z.string().min(1),
  attendance: z.number().int().min(0).max(100),
  studentCount: z.number().int().min(0),
  stage: z.number().int().min(1).max(3),
  stageLabel: z.string().min(1),
  stageDescription: z.string().min(1),
  stageColor: z.string().min(1),
  tt1Done: z.boolean().default(false),
  tt2Done: z.boolean().default(false),
  tt1Locked: z.boolean().default(false),
  tt2Locked: z.boolean().default(false),
  quizLocked: z.boolean().default(false),
  assignmentLocked: z.boolean().default(false),
  pendingAction: z.string().nullable().optional(),
  status: z.string().min(1),
})

const offeringPatchSchema = offeringCreateSchema.extend({
  version: z.number().int().positive(),
})

const ownershipCreateSchema = z.object({
  offeringId: z.string().min(1),
  facultyId: z.string().min(1),
  ownershipRole: z.string().min(1).optional(),
  status: z.string().min(1),
})

const ownershipPatchSchema = ownershipCreateSchema.extend({
  version: z.number().int().positive(),
})

const attendanceSnapshotCreateSchema = z.object({
  studentId: z.string().min(1),
  offeringId: z.string().min(1),
  presentClasses: z.number().int().min(0),
  totalClasses: z.number().int().min(0),
  attendancePercent: z.number().int().min(0).max(100).optional(),
  source: z.string().min(1).default('manual-entry'),
  capturedAt: z.string().min(1),
})

const assessmentScoreCreateSchema = z.object({
  studentId: z.string().min(1),
  offeringId: z.string().min(1),
  termId: z.string().min(1).optional(),
  componentType: z.enum(['tt1', 'tt2', 'quiz1', 'quiz2', 'asgn1', 'asgn2', 'sem_end', 'lab', 'viva', 'other']),
  componentCode: z.string().min(1).optional(),
  score: z.number().int().min(0),
  maxScore: z.number().int().min(1),
  evaluatedAt: z.string().min(1),
})

const interventionCreateSchema = z.object({
  studentId: z.string().min(1),
  facultyId: z.string().min(1).optional(),
  offeringId: z.string().min(1).optional(),
  interventionType: z.string().min(1),
  note: z.string().min(1),
  occurredAt: z.string().min(1),
})

const transcriptTermResultCreateSchema = z.object({
  studentId: z.string().min(1),
  termId: z.string().min(1),
  sgpaScaled: z.number().int().min(0),
  registeredCredits: z.number().int().min(0),
  earnedCredits: z.number().int().min(0),
  backlogCount: z.number().int().min(0),
})

const transcriptSubjectResultCreateSchema = z.object({
  transcriptTermResultId: z.string().min(1),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().int().min(0),
  score: z.number().int().min(0),
  gradeLabel: z.string().min(1),
  gradePoint: z.number().int().min(0),
  result: z.string().min(1),
})

const courseOutcomeScopeSchema = z.enum(['institution', 'branch', 'batch', 'offering'])

const courseOutcomeSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  bloom: z.string().min(1),
})

const courseOutcomeOverrideCreateSchema = z.object({
  courseId: z.string().min(1),
  scopeType: courseOutcomeScopeSchema,
  scopeId: z.string().min(1),
  outcomes: z.array(courseOutcomeSchema).min(1),
  status: z.string().min(1).default('active'),
})

const courseOutcomeOverridePatchSchema = courseOutcomeOverrideCreateSchema.extend({
  version: z.number().int().positive(),
})

const assessmentComponentSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  rawMax: z.number().int().positive(),
  weightage: z.number().min(0).max(100).optional(),
})

const schemePolicyContextSchema = z.object({
  ce: z.number().int().min(0).max(100),
  see: z.number().int().min(0).max(100),
  maxTermTests: z.number().int().min(0).max(10),
  maxQuizzes: z.number().int().min(0).max(10),
  maxAssignments: z.number().int().min(0).max(10),
})

const termTestWeightsSchema = z.object({
  tt1: z.number().min(0).max(100),
  tt2: z.number().min(0).max(100),
})

const schemeStateSchema = z.object({
  finalsMax: z.union([z.literal(50), z.literal(100)]),
  termTestWeights: termTestWeightsSchema.optional(),
  quizWeight: z.number().min(0).max(100).optional(),
  assignmentWeight: z.number().min(0).max(100).optional(),
  quizCount: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  assignmentCount: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  quizComponents: z.array(assessmentComponentSchema),
  assignmentComponents: z.array(assessmentComponentSchema),
  policyContext: schemePolicyContextSchema.optional(),
  status: z.string().min(1),
  configuredAt: z.number().finite().optional(),
  lockedAt: z.number().finite().optional(),
  lastEditedBy: z.string().optional(),
})

type TermTestNodeShape = {
  id: string
  label: string
  text: string
  maxMarks: number
  cos: string[]
  children?: TermTestNodeShape[]
}

const termTestNodeSchema: z.ZodType<TermTestNodeShape> = z.lazy(() => z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
  maxMarks: z.number().int().positive(),
  cos: z.array(z.string()),
  children: z.array(termTestNodeSchema).optional(),
}))

const termTestBlueprintSchema = z.object({
  kind: z.enum(['tt1', 'tt2']),
  totalMarks: z.number().int().positive(),
  updatedAt: z.number().finite(),
  nodes: z.array(termTestNodeSchema),
})

const offeringSchemeUpsertSchema = z.object({
  scheme: schemeStateSchema,
})

const offeringQuestionPaperUpsertSchema = z.object({
  blueprint: termTestBlueprintSchema,
})

const courseOutcomeOverrideListQuerySchema = z.object({
  courseId: z.string().min(1).optional(),
  scopeType: courseOutcomeScopeSchema.optional(),
  scopeId: z.string().min(1).optional(),
})

const offeringParamsSchema = z.object({
  offeringId: z.string().min(1),
})

const questionPaperParamsSchema = offeringParamsSchema.extend({
  kind: z.enum(['tt1', 'tt2']),
})

const uiRoleSchema = z.enum(['Course Leader', 'Mentor', 'HoD'])

const taskStatusSchema = z.enum(['New', 'In Progress', 'Follow-up', 'Resolved'])

const taskTypeSchema = z.enum(['Follow-up', 'Remedial', 'Attendance', 'Academic'])

const riskBandSchema = z.enum(['High', 'Medium', 'Low'])

const schedulePresetSchema = z.enum(['daily', 'weekly', 'monthly', 'weekdays', 'custom dates'])

const taskDismissalSchema = z.object({
  kind: z.enum(['task', 'series']),
  dismissedAt: z.number().finite(),
  dismissedByFacultyId: z.string().optional(),
  dismissedDateISO: z.string().optional(),
})

const scheduleMetaSchema = z.object({
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

const remedialPlanSchema = z.object({
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

const unlockRequestSchema = z.object({
  offeringId: z.string(),
  kind: z.enum(['tt1', 'tt2', 'quiz', 'assignment', 'attendance', 'finals']),
  status: z.enum(['Pending', 'Approved', 'Rejected', 'Reset Completed']),
  requestedByRole: uiRoleSchema,
  requestedByFacultyId: z.string().optional(),
  requestedAt: z.number().finite(),
  reviewedAt: z.number().finite().optional(),
  requestNote: z.string().optional(),
  reviewNote: z.string().optional(),
  handoffNote: z.string().optional(),
})

const queueTransitionSchema = z.object({
  id: z.string(),
  at: z.number().finite(),
  actorRole: z.union([uiRoleSchema, z.literal('System'), z.literal('Auto')]),
  actorTeacherId: z.string().optional(),
  action: z.string(),
  fromOwner: uiRoleSchema.optional(),
  toOwner: uiRoleSchema,
  note: z.string(),
})

const sharedTaskSchema = z.object({
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
const sharedTaskPayloadSchema = sharedTaskSchema.partial()

const taskSyncSchema = z.object({
  tasks: z.array(sharedTaskSchema),
})

const taskPlacementSchema = z.object({
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

const taskPlacementSyncSchema = z.object({
  placements: z.record(z.string(), taskPlacementSchema),
})

const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

const timetableSlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

const timetableClassBlockSchema = z.object({
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

const facultyCalendarTemplateSchema = z.object({
  facultyId: z.string().min(1),
  slots: z.array(timetableSlotSchema),
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  classBlocks: z.array(timetableClassBlockSchema),
  updatedAt: z.number().finite(),
}).passthrough()

const facultyCalendarWorkspaceUpsertSchema = z.object({
  template: facultyCalendarTemplateSchema,
})

const calendarAuditEventSchema = z.object({
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

const calendarAuditSyncSchema = z.object({
  events: z.array(calendarAuditEventSchema),
})

const coAttainmentRowSchema = z.object({
  coId: z.string(),
  desc: z.string(),
  bloom: z.string(),
  target: z.number().int().min(0).max(100),
  tt1Attainment: z.number().min(0).max(100).nullable(),
  tt2Attainment: z.number().min(0).max(100).nullable(),
  overallAttainment: z.number().min(0).max(100).nullable(),
  studentsCounted: z.number().int().min(0),
})

const meetingStatusSchema = z.enum(['scheduled', 'completed', 'cancelled'])

const academicMeetingSchema = z.object({
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

const academicMeetingCreateSchema = z.object({
  studentId: z.string().min(1),
  offeringId: z.string().min(1).nullable().optional(),
  title: z.string().min(1),
  notes: z.string().trim().nullable().optional(),
  dateISO: z.string().min(1),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  status: meetingStatusSchema.default('scheduled'),
})

const academicMeetingPatchSchema = academicMeetingCreateSchema.extend({
  version: z.number().int().positive(),
})

const academicMeetingParamsSchema = z.object({
  meetingId: z.string().min(1),
})

const attendanceCommitSchema = z.object({
  entries: z.array(z.object({
    studentId: z.string().min(1),
    presentClasses: z.number().int().min(0),
    totalClasses: z.number().int().min(1),
  })),
  capturedAt: z.string().optional(),
  lock: z.boolean().optional(),
})

const assessmentEntryKindSchema = z.enum(['tt1', 'tt2', 'quiz', 'assignment', 'finals'])

const assessmentCommitSchema = z.object({
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

const assessmentCommitParamsSchema = offeringParamsSchema.extend({
  kind: assessmentEntryKindSchema,
})

const publicFacultyResponseSchema = z.object({
  items: z.array(z.object({
    facultyId: z.string(),
    username: z.string(),
    name: z.string(),
    displayName: z.string(),
    designation: z.string(),
    dept: z.string(),
    departmentCode: z.string(),
    roleTitle: z.string(),
    allowedRoles: z.array(z.enum(['Course Leader', 'Mentor', 'HoD'])),
  })),
})

type PublicFacultyResponse = z.infer<typeof publicFacultyResponseSchema>

function toUiRole(roleCode: string) {
  if (roleCode === 'COURSE_LEADER') return 'Course Leader'
  if (roleCode === 'MENTOR') return 'Mentor'
  if (roleCode === 'HOD') return 'HoD'
  return null
}

function sortRoleLabels(left: string, right: string) {
  const order = ['Course Leader', 'Mentor', 'HoD']
  return order.indexOf(left) - order.indexOf(right)
}

function isLeaderLikeOwnershipRole(role: string) {
  const normalized = role.trim().toLowerCase()
  return normalized.includes('course') || normalized.includes('leader') || normalized.includes('owner') || normalized.includes('primary')
}

const FIXED_OWNERSHIP_ROLE = 'owner'

function clampInteger(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value ?? fallback)))
}

function buildSchemePolicyContext(policy: ResolvedPolicy) {
  return {
    ce: policy.ceSeeSplit.ce,
    see: policy.ceSeeSplit.see,
    maxTermTests: policy.ceComponentCaps.maxTermTests,
    maxQuizzes: policy.ceComponentCaps.maxQuizzes,
    maxAssignments: policy.ceComponentCaps.maxAssignments,
  }
}

function distributeWeightage(totalWeight: number, count: number) {
  if (count <= 0) return [] as number[]
  const base = Math.floor(totalWeight / count)
  const remainder = totalWeight - (base * count)
  return Array.from({ length: count }, (_, index) => base + (index === count - 1 ? remainder : 0))
}

function hasExplicitComponentWeightage(components?: Array<z.infer<typeof assessmentComponentSchema>>) {
  return (components ?? []).some(component => typeof component.weightage === 'number' && Number.isFinite(component.weightage))
}

function sumAssessmentComponentWeightage(components: Array<z.infer<typeof assessmentComponentSchema>>) {
  return components.reduce((acc, component) => acc + clampInteger(component.weightage, 0, 100, 0), 0)
}

function sanitizeAssessmentComponentsForScheme(
  kind: 'quiz' | 'assignment',
  count: 0 | 1 | 2,
  components: Array<z.infer<typeof assessmentComponentSchema>> | undefined,
  totalWeight: number,
) {
  const base = components && components.length > 0
    ? components.slice(0, count)
    : []
  const distributedWeightage = distributeWeightage(totalWeight, count)
  const explicitWeightage = hasExplicitComponentWeightage(base)
  return Array.from({ length: count }, (_, index) => ({
    id: base[index]?.id ?? `${kind}-${index + 1}`,
    label: base[index]?.label?.trim() || `${kind === 'quiz' ? 'Quiz' : 'Assignment'} ${index + 1}`,
    rawMax: clampInteger(base[index]?.rawMax, 1, 100, 10),
    weightage: clampInteger(base[index]?.weightage, 0, 100, explicitWeightage ? 0 : (distributedWeightage[index] ?? 0)),
  }))
}

function sanitizeTermTestWeights(
  weights: z.infer<typeof termTestWeightsSchema> | undefined,
  totalWeight: number,
  maxTermTests: number,
) {
  if (maxTermTests <= 0 || totalWeight <= 0) return { tt1: 0, tt2: 0 }
  if (maxTermTests === 1) {
    return { tt1: clampInteger(weights?.tt1, 0, totalWeight, totalWeight), tt2: 0 }
  }
  const fallbackTt1 = Math.round(totalWeight / 2)
  const fallbackTt2 = totalWeight - fallbackTt1
  return {
    tt1: clampInteger(weights?.tt1, 0, totalWeight, fallbackTt1),
    tt2: clampInteger(weights?.tt2, 0, totalWeight, fallbackTt2),
  }
}

function canonicalizeSchemeState(
  input: z.infer<typeof schemeStateSchema>,
  policy: ResolvedPolicy,
) {
  const policyContext = buildSchemePolicyContext(policy)
  const quizCount = clampInteger(input.quizCount ?? input.quizComponents.length, 0, Math.min(2, policyContext.maxQuizzes), 0) as 0 | 1 | 2
  const assignmentCount = clampInteger(input.assignmentCount ?? input.assignmentComponents.length, 0, Math.min(2, policyContext.maxAssignments), 0) as 0 | 1 | 2
  const legacyQuizWeight = clampInteger(input.quizWeight, 0, 100, 0)
  const legacyAssignmentWeight = clampInteger(input.assignmentWeight, 0, 100, 0)
  const explicitQuizWeightage = hasExplicitComponentWeightage(input.quizComponents)
  const explicitAssignmentWeightage = hasExplicitComponentWeightage(input.assignmentComponents)
  const quizComponents = sanitizeAssessmentComponentsForScheme('quiz', quizCount, input.quizComponents, explicitQuizWeightage ? 0 : legacyQuizWeight)
  const assignmentComponents = sanitizeAssessmentComponentsForScheme('assignment', assignmentCount, input.assignmentComponents, explicitAssignmentWeightage ? 0 : legacyAssignmentWeight)
  const quizWeight = explicitQuizWeightage || quizCount === 0 ? sumAssessmentComponentWeightage(quizComponents) : legacyQuizWeight
  const assignmentWeight = explicitAssignmentWeightage || assignmentCount === 0 ? sumAssessmentComponentWeightage(assignmentComponents) : legacyAssignmentWeight
  const termTestTotal = Math.max(0, policyContext.ce - quizWeight - assignmentWeight)
  return {
    finalsMax: (input.finalsMax ?? (policyContext.see > 50 ? 100 : 50)) as 50 | 100,
    termTestWeights: sanitizeTermTestWeights(input.termTestWeights, termTestTotal, policyContext.maxTermTests),
    quizWeight,
    assignmentWeight,
    quizCount,
    assignmentCount,
    quizComponents,
    assignmentComponents,
    policyContext,
    status: input.status,
    configuredAt: input.configuredAt,
    lockedAt: input.lockedAt,
    lastEditedBy: input.lastEditedBy,
  }
}

function normalizeRuntimeSlice<K extends RuntimeStateKey>(stateKey: K, payload: unknown) {
  const parsed = runtimeSliceSchemas[stateKey].safeParse(payload)
  return parsed.success ? parsed.data : runtimeDefaults[stateKey]
}

async function getAcademicRuntimeState(context: RouteContext, stateKey: RuntimeStateKey) {
  const [row] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  const fallback = runtimeDefaults[stateKey]
  const payload = row ? parseJson(row.payloadJson, fallback) : fallback
  return normalizeRuntimeSlice(stateKey, payload)
}

async function saveAcademicRuntimeState<K extends RuntimeStateKey>(
  context: RouteContext,
  stateKey: K,
  payload: unknown,
) {
  const normalized = normalizeRuntimeSlice(stateKey, payload)
  const [current] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  if (current) {
    await context.db.update(academicRuntimeState).set({
      payloadJson: stringifyJson(normalized),
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(academicRuntimeState.stateKey, stateKey))
    return normalized
  }
  await context.db.insert(academicRuntimeState).values({
    stateKey,
    payloadJson: stringifyJson(normalized),
    version: 1,
    updatedAt: context.now(),
  })
  return normalized
}

function dedupeRoles(roleCodes: string[]) {
  return Array.from(new Set(roleCodes.map(toUiRole).filter((value): value is 'Course Leader' | 'Mentor' | 'HoD' => !!value))).sort(sortRoleLabels)
}

function millisToIso(value: number | undefined, fallback: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return new Date(value).toISOString()
}

function isoToMillis(value: string | undefined, fallback = Date.now()) {
  if (!value) return fallback
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeAcademicStudentId(studentId: string) {
  return studentId.includes('::') ? (studentId.split('::').at(-1) ?? studentId) : studentId
}

async function resolveStudentShellRun(
  context: RouteContext,
  auth: ReturnType<typeof requireAuth>,
  requestedRunId?: string,
) {
  if (requestedRunId && auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
    throw forbidden('Only system admin may select a non-active proof run')
  }
  const [run] = requestedRunId
    ? await context.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, requestedRunId))
    : await context.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
  if (!run) throw notFound('Proof run not found')
  if (auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN' && run.activeFlag !== 1) {
    throw forbidden('Academic roles may inspect only the active proof run')
  }
  return run
}

async function resolveAcademicStageCheckpoint(
  context: RouteContext,
  auth: ReturnType<typeof requireAuth>,
  simulationRunId: string,
  simulationStageCheckpointId?: string,
) {
  if (!simulationStageCheckpointId) return null
  const [checkpoint] = await context.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationStageCheckpointId, simulationStageCheckpointId))
  if (!checkpoint) throw notFound('Simulation stage checkpoint not found')
  if (checkpoint.simulationRunId !== simulationRunId) {
    throw forbidden('Simulation stage checkpoint does not belong to the selected proof run')
  }
  if (auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
    const [activeRun] = await context.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    if (!activeRun || activeRun.simulationRunId !== checkpoint.simulationRunId) {
      throw forbidden('Academic roles may inspect only checkpoints from the active proof run')
    }
  }
  return checkpoint
}

async function assertStudentShellScope(
  context: RouteContext,
  auth: ReturnType<typeof requireAuth>,
  simulationRunId: string,
  studentId: string,
) {
  if (auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') return
  if (!auth.facultyId) throw forbidden('Faculty context is required')

  if (auth.activeRoleGrant.roleCode === 'HOD') {
    const analytics = await buildHodProofAnalytics(context.db, {
      facultyId: auth.facultyId,
      now: context.now(),
      filters: { studentId },
    })
    if (!analytics.summary.activeRunContext || analytics.summary.activeRunContext.simulationRunId !== simulationRunId) {
      throw forbidden('Student shell is only available for the active HoD proof scope')
    }
    if (!analytics.students.some(row => row.studentId === studentId)) {
      throw forbidden('Student is outside the supervised HoD proof scope')
    }
    return
  }

  if (auth.activeRoleGrant.roleCode === 'MENTOR') {
    const [assignment] = await context.db.select().from(mentorAssignments).where(and(
      eq(mentorAssignments.facultyId, auth.facultyId),
      eq(mentorAssignments.studentId, studentId),
    ))
    if (!assignment || assignment.effectiveTo) {
      throw forbidden('Student is outside the active mentor proof scope')
    }
    return
  }

  const ownedOfferingIds = new Set(
    (await context.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, auth.facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))).map(row => row.offeringId),
  )
  if (ownedOfferingIds.size === 0) throw forbidden('No owned proof offerings are available for this faculty context')
  const observedRows = await context.db.select().from(studentObservedSemesterStates).where(and(
    eq(studentObservedSemesterStates.simulationRunId, simulationRunId),
    eq(studentObservedSemesterStates.studentId, studentId),
  ))
  const hasOwnedProofEvidence = observedRows.some(row => {
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
    const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
    return !!offeringId && ownedOfferingIds.has(offeringId)
  })
  if (!hasOwnedProofEvidence) {
    throw forbidden('Student is outside the active course-leader proof scope')
  }
}

function buildInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

function mapCourseOutcomeOverride(row: typeof courseOutcomeOverrides.$inferSelect) {
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

async function assertCourseOutcomeScopeExists(
  context: RouteContext,
  scopeType: z.infer<typeof courseOutcomeScopeSchema>,
  scopeId: string,
) {
  if (scopeType === 'institution') {
    const [row] = await context.db.select().from(institutions).where(eq(institutions.institutionId, scopeId))
    if (!row) throw notFound('Institution scope not found')
    return
  }
  if (scopeType === 'branch') {
    const [row] = await context.db.select().from(branches).where(eq(branches.branchId, scopeId))
    if (!row) throw notFound('Branch scope not found')
    return
  }
  if (scopeType === 'batch') {
    const [row] = await context.db.select().from(batches).where(eq(batches.batchId, scopeId))
    if (!row) throw notFound('Batch scope not found')
    return
  }
  const [row] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, scopeId))
  if (!row) throw notFound('Offering scope not found')
}

function buildDefaultCourseOutcomes(courseCode: string, courseTitle: string) {
  return [
    { id: 'CO1', desc: `Explain the core concepts covered in ${courseTitle}.`, bloom: 'Understand' },
    { id: 'CO2', desc: `Apply ${courseCode} techniques to solve structured problems.`, bloom: 'Apply' },
    { id: 'CO3', desc: `Analyse trade-offs and results in ${courseTitle}.`, bloom: 'Analyze' },
    { id: 'CO4', desc: `Evaluate solution quality and academic decisions for ${courseCode}.`, bloom: 'Evaluate' },
  ]
}

function buildDefaultSchemeFromPolicy(policy: ResolvedPolicy) {
  const policyContext = buildSchemePolicyContext(policy)
  const quizCount = Math.min(2, Math.max(0, policyContext.maxQuizzes)) as 0 | 1 | 2
  const assignmentCount = Math.min(2, Math.max(0, policyContext.maxAssignments)) as 0 | 1 | 2
  const defaultTermTestWeight = policyContext.maxTermTests > 0 ? Math.min(policyContext.ce, 30) : 0
  const remainingCe = Math.max(0, policyContext.ce - defaultTermTestWeight)
  const defaultQuizWeight = Math.min(remainingCe, quizCount > 1 ? Math.max(10, Math.floor(remainingCe * 0.5)) : Math.min(remainingCe, 20))
  const defaultAssignmentWeight = Math.max(0, remainingCe - defaultQuizWeight)
  return canonicalizeSchemeState({
    finalsMax: (policyContext.see > 50 ? 100 : 50) as 50 | 100,
    termTestWeights: policyContext.maxTermTests > 1
      ? { tt1: Math.round(defaultTermTestWeight / 2), tt2: defaultTermTestWeight - Math.round(defaultTermTestWeight / 2) }
      : { tt1: defaultTermTestWeight, tt2: 0 },
    quizWeight: defaultQuizWeight,
    assignmentWeight: defaultAssignmentWeight,
    quizCount,
    assignmentCount,
    quizComponents: sanitizeAssessmentComponentsForScheme('quiz', quizCount, undefined, defaultQuizWeight),
    assignmentComponents: sanitizeAssessmentComponentsForScheme('assignment', assignmentCount, undefined, defaultAssignmentWeight),
    policyContext,
    status: 'Needs Setup',
  }, policy)
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeTranscriptCourseKey(courseCode: string) {
  return courseCode.replace(/\(.*repeat.*\)/i, '').replace(/R$/i, '').trim()
}

function scoreToGradeBand(score: number, policy: ResolvedPolicy) {
  const band = [...policy.gradeBands]
    .sort((left, right) => right.minimumMark - left.minimumMark)
    .find(item => score >= item.minimumMark && score <= item.maximumMark)

  if (band) {
    return {
      bandLabel: band.grade as 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F',
      gradePoint: band.gradePoint as 0 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
    }
  }

  if (score > 90) return { bandLabel: 'O' as const, gradePoint: 10 as const }
  if (score > 74) return { bandLabel: 'A+' as const, gradePoint: 9 as const }
  if (score > 60) return { bandLabel: 'A' as const, gradePoint: 8 as const }
  if (score >= 55) return { bandLabel: 'B+' as const, gradePoint: 7 as const }
  if (score >= 50) return { bandLabel: 'B' as const, gradePoint: 6 as const }
  if (score > 44) return { bandLabel: 'C' as const, gradePoint: 5 as const }
  if (score >= 40) return { bandLabel: 'P' as const, gradePoint: 4 as const }
  return { bandLabel: 'F' as const, gradePoint: 0 as const }
}

function projectPredictedCgpa(input: {
  currentCgpa: number
  completedCreditsForCgpa: number
  currentCourseCredits: number
  gradePoint: number
}) {
  const baseCredits = input.completedCreditsForCgpa > 0 ? input.completedCreditsForCgpa : 20
  const baseCgpa = input.currentCgpa > 0 ? input.currentCgpa : 6
  const courseCredits = input.currentCourseCredits > 0 ? input.currentCourseCredits : 4
  return roundToTwo((((baseCgpa * baseCredits) + (input.gradePoint * courseCredits)) / (baseCredits + courseCredits)))
}

function computeTranscriptAnalytics(input: {
  termRows: Array<typeof transcriptTermResults.$inferSelect>
  termById: Record<string, typeof academicTerms.$inferSelect>
  subjectsByTermResultId: Map<string, Array<typeof transcriptSubjectResults.$inferSelect>>
  policy: ResolvedPolicy
  fallbackCgpa: number
}) {
  const orderedTerms = [...input.termRows].sort((left, right) => {
    const leftTerm = input.termById[left.termId]
    const rightTerm = input.termById[right.termId]
    if (!leftTerm || !rightTerm) return left.termId.localeCompare(right.termId)
    return leftTerm.semesterNumber - rightTerm.semesterNumber
  })

  const attemptsByCourseKey = new Map<string, Array<typeof transcriptSubjectResults.$inferSelect & { termOrder: number }>>()
  orderedTerms.forEach((termRow, termOrder) => {
    const subjects = input.subjectsByTermResultId.get(termRow.transcriptTermResultId) ?? []
    subjects.forEach(subject => {
      const courseKey = normalizeTranscriptCourseKey(subject.courseCode)
      attemptsByCourseKey.set(courseKey, [...(attemptsByCourseKey.get(courseKey) ?? []), { ...subject, termOrder }])
    })
  })

  const selectedAttempts = Array.from(attemptsByCourseKey.values()).map(attempts => {
    if (input.policy.sgpaCgpaRules.repeatedCoursePolicy === 'best-attempt') {
      return [...attempts].sort((left, right) => {
        if (right.gradePoint !== left.gradePoint) return right.gradePoint - left.gradePoint
        if (right.score !== left.score) return right.score - left.score
        return right.termOrder - left.termOrder
      })[0]
    }
    return [...attempts].sort((left, right) => right.termOrder - left.termOrder)[0]
  })

  const includedAttempts = selectedAttempts.filter(attempt => {
    if (input.policy.sgpaCgpaRules.includeFailedCredits) return true
    return attempt.gradePoint > 0
  })
  const completedCreditsForCgpa = includedAttempts.reduce((sum, attempt) => sum + attempt.credits, 0)
  const weightedPoints = includedAttempts.reduce((sum, attempt) => sum + (attempt.gradePoint * attempt.credits), 0)
  const currentCgpa = completedCreditsForCgpa > 0
    ? roundToTwo(weightedPoints / completedCreditsForCgpa)
    : input.fallbackCgpa

  const repeatSubjects = Array.from(attemptsByCourseKey.values())
    .filter(attempts => attempts.length > 1 || attempts.some(attempt => attempt.result === 'Repeated'))
    .map(attempts => {
      const latest = [...attempts].sort((left, right) => right.termOrder - left.termOrder)[0]
      return `${latest.courseCode} ${latest.title}`
    })

  const sgpaSeries = orderedTerms.map(termRow => roundToTwo(termRow.sgpaScaled / 100))
  const latestSgpa = sgpaSeries.at(-1) ?? 0
  const previousSgpa = sgpaSeries.length > 1 ? sgpaSeries.at(-2) ?? latestSgpa : latestSgpa
  const trend: 'Improving' | 'Stable' | 'Declining' = latestSgpa - previousSgpa >= 0.25
    ? 'Improving'
    : previousSgpa - latestSgpa >= 0.25
      ? 'Declining'
      : 'Stable'

  const latestBacklogCount = orderedTerms.at(-1)?.backlogCount ?? 0
  const progressionStatus: 'Eligible' | 'Review' | 'Hold' = (
    currentCgpa < input.policy.progressionRules.minimumCgpaForPromotion
    && input.policy.progressionRules.requireNoActiveBacklogs
    && latestBacklogCount > 0
  )
    ? 'Hold'
    : (
      currentCgpa < input.policy.progressionRules.minimumCgpaForPromotion
      || (input.policy.progressionRules.requireNoActiveBacklogs && latestBacklogCount > 0)
    )
      ? 'Review'
      : 'Eligible'

  return {
    currentCgpa,
    completedCreditsForCgpa,
    repeatSubjects,
    trend,
    latestBacklogCount,
    latestSgpa,
    progressionStatus,
  }
}

function buildAdvisoryNotes(input: {
  currentCgpa: number
  latestBacklogCount: number
  repeatSubjects: string[]
  progressionStatus: 'Eligible' | 'Review' | 'Hold'
  trend: 'Improving' | 'Stable' | 'Declining'
}) {
  const notes: string[] = []
  if (input.progressionStatus === 'Hold') {
    notes.push('Progression is currently on hold under the active batch policy.')
  } else if (input.progressionStatus === 'Review') {
    notes.push('Progression needs review against the active sysadmin promotion rules.')
  } else {
    notes.push('Progression remains compliant with the active batch policy.')
  }
  if (input.latestBacklogCount > 0) {
    notes.push(`${input.latestBacklogCount} active backlog${input.latestBacklogCount > 1 ? 's remain' : ' remains'} on the latest transcript.`)
  }
  if (input.repeatSubjects.length > 0) {
    notes.push(`${input.repeatSubjects.length} repeated subject${input.repeatSubjects.length > 1 ? 's appear' : ' appears'} in transcript history.`)
  }
  if (input.trend === 'Declining') {
    notes.push('Latest SGPA trend is declining and should be reviewed with the current term performance.')
  } else if (input.trend === 'Improving') {
    notes.push('Latest SGPA trend is improving compared with the previous term.')
  }
  if (input.currentCgpa === 0) {
    notes.push('Transcript history has not been published yet for this student.')
  }
  return notes
}

function averageNullable(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (filtered.length === 0) return null
  return roundToTwo(filtered.reduce((sum, value) => sum + value, 0) / filtered.length)
}

function buildQuestionLeafScoreMap(input: {
  kind: 'tt1' | 'tt2'
  cells: Array<typeof studentAssessmentScores.$inferSelect>
}) {
  const storageType = `${input.kind}_leaf`
  return Object.fromEntries(
    input.cells
      .filter(cell => cell.componentType === storageType && !!cell.componentCode)
      .map(cell => [cell.componentCode as string, cell.score]),
  ) as Record<string, number>
}

function computeStudentOutcomeAttainment(input: {
  outcomes: Array<z.infer<typeof courseOutcomeSchema>>
  tt1Blueprint: z.infer<typeof termTestBlueprintSchema>
  tt2Blueprint: z.infer<typeof termTestBlueprintSchema>
  assessmentCells: Array<typeof studentAssessmentScores.$inferSelect>
}) {
  const tt1LeafScores = buildQuestionLeafScoreMap({ kind: 'tt1', cells: input.assessmentCells })
  const tt2LeafScores = buildQuestionLeafScoreMap({ kind: 'tt2', cells: input.assessmentCells })
  const tt1Leaves = flattenTermTestLeaves(input.tt1Blueprint.nodes)
  const tt2Leaves = flattenTermTestLeaves(input.tt2Blueprint.nodes)

  return input.outcomes.map(outcome => {
    const computeComponentAttainment = (leaves: ReturnType<typeof flattenTermTestLeaves>, scores: Record<string, number>) => {
      const matchedLeaves = leaves.filter(leaf => leaf.cos.includes(outcome.id))
      if (matchedLeaves.length === 0) return null
      const maxScore = matchedLeaves.reduce((sum, leaf) => sum + leaf.maxMarks, 0)
      const scoredLeaves = matchedLeaves.filter(leaf => typeof scores[leaf.id] === 'number')
      if (scoredLeaves.length === 0 || maxScore <= 0) return null
      const rawScore = scoredLeaves.reduce((sum, leaf) => sum + (scores[leaf.id] ?? 0), 0)
      return roundToTwo((rawScore / maxScore) * 100)
    }

    const tt1Attainment = computeComponentAttainment(tt1Leaves, tt1LeafScores)
    const tt2Attainment = computeComponentAttainment(tt2Leaves, tt2LeafScores)
    return {
      coId: outcome.id,
      tt1Attainment,
      tt2Attainment,
      overallAttainment: averageNullable([tt1Attainment, tt2Attainment]) ?? 0,
    }
  })
}

function buildStudentReasons(input: {
  attendancePct: number
  tt1Raw: number | null
  tt1Max: number
  tt2Raw: number | null
  tt2Max: number
  currentCgpa: number
  quizRawTotal: number
  coScores: Array<{ coId: string; overallAttainment: number }>
}) {
  const reasons: Array<{ label: string; impact: number; feature: string }> = []
  if (input.attendancePct < 65) reasons.push({ label: `Attendance critically low (${input.attendancePct}%)`, impact: 0.34, feature: 'attendance' })
  else if (input.attendancePct < 75) reasons.push({ label: `Attendance below threshold (${input.attendancePct}%)`, impact: 0.22, feature: 'attendance' })

  const termSignals = [
    { label: 'TT1', raw: input.tt1Raw, max: input.tt1Max, feature: 'tt1' },
    { label: 'TT2', raw: input.tt2Raw, max: input.tt2Max, feature: 'tt2' },
  ].filter(signal => signal.raw !== null && signal.max > 0)
  termSignals.forEach(signal => {
    const pct = Math.round(((signal.raw ?? 0) / signal.max) * 100)
    if (pct < 40) reasons.push({ label: `Very low ${signal.label} score (${signal.raw}/${signal.max})`, impact: 0.28, feature: signal.feature })
    else if (pct < 60) reasons.push({ label: `Below-average ${signal.label} (${signal.raw}/${signal.max})`, impact: 0.16, feature: signal.feature })
  })

  if (input.currentCgpa > 0 && input.currentCgpa < 6) reasons.push({ label: `Weak CGPA (${input.currentCgpa.toFixed(2)})`, impact: 0.22, feature: 'cgpa' })
  else if (input.currentCgpa > 0 && input.currentCgpa < 7) reasons.push({ label: `Below-average CGPA (${input.currentCgpa.toFixed(2)})`, impact: 0.12, feature: 'cgpa' })

  const weakestCo = [...input.coScores].sort((left, right) => left.overallAttainment - right.overallAttainment)[0]
  if (weakestCo && weakestCo.overallAttainment > 0 && weakestCo.overallAttainment < 45) {
    reasons.push({ label: `Weak ${weakestCo.coId} attainment (${roundToTwo(weakestCo.overallAttainment)}%)`, impact: 0.18, feature: 'co' })
  }

  if (input.quizRawTotal > 0 && input.quizRawTotal < 4) {
    reasons.push({ label: `Low quiz performance (${input.quizRawTotal})`, impact: 0.09, feature: 'quiz' })
  }

  return reasons.sort((left, right) => right.impact - left.impact).slice(0, 4)
}

function buildStudentWhatIf(input: {
  riskProb: number
  attendancePct: number
  coScores: Array<{ coId: string; overallAttainment: number }>
}) {
  const scenarios: Array<{ label: string; current: string; target: string; currentRisk: number; newRisk: number }> = []
  if (input.attendancePct < 75) {
    scenarios.push({
      label: 'Improve attendance to 75%',
      current: `${input.attendancePct}%`,
      target: '75%',
      currentRisk: input.riskProb,
      newRisk: roundToTwo(Math.max(0.08, input.riskProb - 0.18)),
    })
  }
  const weakestCo = [...input.coScores]
    .filter(score => score.overallAttainment > 0)
    .sort((left, right) => left.overallAttainment - right.overallAttainment)[0]
  if (weakestCo && weakestCo.overallAttainment < 60) {
    scenarios.push({
      label: `${weakestCo.coId} attainment reaches 60%`,
      current: `${roundToTwo(weakestCo.overallAttainment)}%`,
      target: '60%',
      currentRisk: input.riskProb,
      newRisk: roundToTwo(Math.max(0.1, input.riskProb - 0.14)),
    })
  }
  return scenarios
}

function getLatestBacklogCount(termResults: Array<typeof transcriptTermResults.$inferSelect>) {
  const latest = [...termResults].sort((left, right) => left.termId.localeCompare(right.termId)).at(-1)
  return latest?.backlogCount ?? 0
}

function computeRiskFromPolicy(input: {
  attendancePct: number
  currentCgpa: number
  backlogCount: number
  tt1Pct?: number | null
  tt2Pct?: number | null
  weakCoCount?: number
  policy: ResolvedPolicy
}) {
  const {
    attendancePct,
    currentCgpa,
    backlogCount,
    tt1Pct = null,
    tt2Pct = null,
    weakCoCount = 0,
    policy,
  } = input
  const inference = inferObservableRisk({
    attendancePct,
    currentCgpa,
    backlogCount,
    tt1Pct,
    tt2Pct,
    weakCoCount,
    policy,
  })
  return {
    riskProb: inference.riskProb,
    riskBand: inference.riskBand,
  }
}

function computeRiskFromActiveModelOrPolicy(input: {
  attendancePct: number
  currentCgpa: number
  backlogCount: number
  tt1Pct?: number | null
  tt2Pct?: number | null
  quizPct?: number | null
  assignmentPct?: number | null
  seePct?: number | null
  weakCoCount?: number
  policy: ResolvedPolicy
  activeModel?: Awaited<ReturnType<typeof getProofRiskModelActive>>['production'] | null
  semesterProgress?: number
}) {
  const {
    attendancePct,
    currentCgpa,
    backlogCount,
    tt1Pct = null,
    tt2Pct = null,
    quizPct = null,
    assignmentPct = null,
    seePct = null,
    weakCoCount = 0,
    policy,
    activeModel = null,
    semesterProgress = 1,
  } = input
  const featurePayload = buildObservableFeaturePayload({
    attendancePct,
    attendanceHistory: [],
    currentCgpa,
    backlogCount,
    tt1Pct,
    tt2Pct,
    quizPct,
    assignmentPct,
    seePct,
    weakCoCount,
    weakQuestionCount: 0,
    interventionResponseScore: null,
    prerequisiteAveragePct: 0,
    prerequisiteFailureCount: 0,
    prerequisiteCourseCodes: [],
    sectionRiskRate: 0,
    semesterProgress,
  })
  const inference = scoreObservableRiskWithModel({
    attendancePct,
    currentCgpa,
    backlogCount,
    tt1Pct,
    tt2Pct,
    quizPct,
    assignmentPct,
    seePct,
    weakCoCount,
    attendanceHistoryRiskCount: 0,
    questionWeaknessCount: 0,
    interventionResponseScore: null,
    policy,
    featurePayload,
    productionModel: activeModel,
  })
  return {
    riskProb: inference.riskProb,
    riskBand: inference.riskBand,
  }
}

function resolveCourseOutcomesForOffering(input: {
  institutionId: string
  branchId: string
  batchId?: string | null
  offeringId: string
  courseId: string
  courseCode: string
  courseTitle: string
  overrides: Array<typeof courseOutcomeOverrides.$inferSelect>
}) {
  const base = buildDefaultCourseOutcomes(input.courseCode, input.courseTitle)
  const scopeChain = [
    { scopeType: 'institution', scopeId: input.institutionId },
    { scopeType: 'branch', scopeId: input.branchId },
    ...(input.batchId ? [{ scopeType: 'batch' as const, scopeId: input.batchId }] : []),
    { scopeType: 'offering', scopeId: input.offeringId },
  ]

  let resolved = base
  for (const scope of scopeChain) {
    const match = input.overrides
      .filter(row => row.scopeType === scope.scopeType && row.scopeId === scope.scopeId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    if (!match) continue
    const parsed = z.array(courseOutcomeSchema).safeParse(parseJson(match.outcomesJson, []))
    if (parsed.success && parsed.data.length > 0) resolved = parsed.data
  }
  return resolved
}

function buildDefaultQuestionPaper(kind: 'tt1' | 'tt2', outcomes: Array<{ id: string }>) {
  const coIds = outcomes.length > 0 ? outcomes.map(item => item.id) : ['CO1', 'CO2', 'CO3', 'CO4']
  return {
    kind,
    totalMarks: 25,
    updatedAt: Date.now(),
    nodes: Array.from({ length: 5 }, (_, index) => ({
      id: `${kind}-q${index + 1}`,
      label: `Q${index + 1}`,
      text: `Question ${index + 1}`,
      maxMarks: 5,
      cos: [],
      children: [{
        id: `${kind}-q${index + 1}-p1`,
        label: `Q${index + 1}a`,
        text: `Part A`,
        maxMarks: 5,
        cos: [coIds[index % coIds.length]],
      }],
    })),
  }
}

function collectBlueprintOutcomeIds(nodes: z.infer<typeof termTestNodeSchema>[]) {
  const collected = new Set<string>()
  const visit = (entries: z.infer<typeof termTestNodeSchema>[]) => {
    for (const entry of entries) {
      for (const coId of entry.cos) collected.add(coId)
      if (entry.children?.length) visit(entry.children)
    }
  }
  visit(nodes)
  return collected
}

function validateSchemeAgainstPolicy(input: z.infer<typeof schemeStateSchema>, policy: ResolvedPolicy) {
  const scheme = canonicalizeSchemeState(input, policy)
  const policyContext = scheme.policyContext
  if (scheme.quizCount > policy.ceComponentCaps.maxQuizzes) {
    throw badRequest('Quiz count exceeds the sysadmin policy cap')
  }
  if (scheme.assignmentCount > policy.ceComponentCaps.maxAssignments) {
    throw badRequest('Assignment count exceeds the sysadmin policy cap')
  }
  if (scheme.quizComponents.length !== scheme.quizCount) {
    throw badRequest('Quiz components must match the configured quiz count')
  }
  if (scheme.assignmentComponents.length !== scheme.assignmentCount) {
    throw badRequest('Assignment components must match the configured assignment count')
  }
  if (scheme.policyContext.ce !== policyContext.ce || scheme.policyContext.see !== policyContext.see) {
    throw badRequest('Scheme CE/SEE context must match the sysadmin policy')
  }
  if (scheme.policyContext.maxTermTests !== policyContext.maxTermTests || scheme.policyContext.maxQuizzes !== policyContext.maxQuizzes || scheme.policyContext.maxAssignments !== policyContext.maxAssignments) {
    throw badRequest('Scheme component limits must match the sysadmin policy')
  }
  if (scheme.quizWeight !== sumAssessmentComponentWeightage(scheme.quizComponents)) {
    throw badRequest('Quiz weight must equal the total of configured quiz component weightages')
  }
  if (scheme.assignmentWeight !== sumAssessmentComponentWeightage(scheme.assignmentComponents)) {
    throw badRequest('Assignment weight must equal the total of configured assignment component weightages')
  }
  const activeTermTestCount = [scheme.termTestWeights.tt1, scheme.termTestWeights.tt2].filter(weight => weight > 0).length
  if (activeTermTestCount > policyContext.maxTermTests) {
    throw badRequest('Term-test count exceeds the sysadmin policy cap')
  }
  const configuredCeWeight = scheme.termTestWeights.tt1
    + scheme.termTestWeights.tt2
    + scheme.quizWeight
    + scheme.assignmentWeight
  if (configuredCeWeight !== policyContext.ce) {
    throw badRequest('Configured internal CE weightages must exactly match the sysadmin CE total')
  }
}

function validateQuestionPaperBlueprint(
  kind: 'tt1' | 'tt2',
  blueprint: z.infer<typeof termTestBlueprintSchema>,
  allowedOutcomeIds: Set<string>,
) {
  if (blueprint.kind !== kind) {
    throw badRequest('Question paper kind does not match the selected route')
  }
  const referencedOutcomeIds = collectBlueprintOutcomeIds(blueprint.nodes)
  const invalidOutcomeIds = Array.from(referencedOutcomeIds).filter(outcomeId => !allowedOutcomeIds.has(outcomeId))
  if (invalidOutcomeIds.length > 0) {
    throw badRequest('Question paper references course outcomes outside the resolved offering scope', { invalidOutcomeIds })
  }
}

async function getOfferingContext(context: RouteContext, offeringId: string) {
  const [offering] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, offeringId))
  if (!offering) throw notFound('Offering not found')
  const [course, term, branch] = await Promise.all([
    context.db.select().from(courses).where(eq(courses.courseId, offering.courseId)).then(rows => rows[0] ?? null),
    context.db.select().from(academicTerms).where(eq(academicTerms.termId, offering.termId)).then(rows => rows[0] ?? null),
    context.db.select().from(branches).where(eq(branches.branchId, offering.branchId)).then(rows => rows[0] ?? null),
  ])
  if (!course) throw notFound('Course not found for offering')
  if (!term) throw notFound('Academic term not found for offering')
  if (!branch) throw notFound('Branch not found for offering')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found for offering')
  return { offering, course, term, branch, department }
}

async function assertSingleActiveOfferingOwner(
  context: RouteContext,
  offeringId: string,
  facultyId: string,
  excludeOwnershipId?: string,
) {
  const activeOwnerships = await context.db
    .select()
    .from(facultyOfferingOwnerships)
    .where(and(
      eq(facultyOfferingOwnerships.offeringId, offeringId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))

  const conflicting = activeOwnerships.filter(item => item.ownershipId !== excludeOwnershipId)
  if (conflicting.length === 0) return
  if (conflicting.some(item => item.facultyId === facultyId)) {
    throw badRequest('This class is already assigned to the selected faculty member.')
  }
  throw badRequest('This class already has an active faculty owner. Remove the existing assignment before reassigning it.')
}

async function assertStudentEnrolledInOffering(
  context: RouteContext,
  offering: typeof sectionOfferings.$inferSelect,
  studentId: string,
) {
  const normalizedStudentId = normalizeAcademicStudentId(studentId)
  const [enrollment] = await context.db
    .select()
    .from(studentEnrollments)
    .where(and(
      eq(studentEnrollments.studentId, normalizedStudentId),
      eq(studentEnrollments.termId, offering.termId),
      eq(studentEnrollments.sectionCode, offering.sectionCode),
      eq(studentEnrollments.academicStatus, 'active'),
    ))
  if (!enrollment) {
    throw badRequest('The selected student is not actively enrolled in this offering', {
      offeringId: offering.offeringId,
      studentId: normalizedStudentId,
    })
  }
  return enrollment
}

function flattenTermTestLeaves(nodes: z.infer<typeof termTestNodeSchema>[]) {
  return nodes.flatMap(node => {
    const children = node.children && node.children.length > 0 ? node.children : [node]
    return children.map(child => ({
      id: child.id,
      label: child.label,
      text: child.text,
      maxMarks: child.maxMarks,
      cos: child.cos,
    }))
  })
}

async function assertCourseLeaderCanManageOffering(context: RouteContext, facultyId: string, offeringId: string) {
  const [ownership] = await context.db
    .select()
    .from(facultyOfferingOwnerships)
    .where(and(
      eq(facultyOfferingOwnerships.facultyId, facultyId),
      eq(facultyOfferingOwnerships.offeringId, offeringId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
  if (!ownership || !isLeaderLikeOwnershipRole(ownership.ownershipRole)) {
    throw forbidden('You do not oversee this offering as a course leader')
  }
  return ownership
}

async function assertViewerCanReadOffering(context: RouteContext, auth: ReturnType<typeof requireAuth>, offeringId: string) {
  if (auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') return
  if (!auth.facultyId) throw forbidden('Faculty context is required')
  if (auth.activeRoleGrant.roleCode === 'COURSE_LEADER') {
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, offeringId)
    return
  }
  if (auth.activeRoleGrant.roleCode !== 'HOD') {
    throw forbidden('This role cannot read offering-owned academic configuration')
  }

  const { offering, branch } = await getOfferingContext(context, offeringId)
  const appointments = await context.db
    .select()
    .from(facultyAppointments)
    .where(and(
      eq(facultyAppointments.facultyId, auth.facultyId),
      eq(facultyAppointments.status, 'active'),
    ))
  const scopedDepartmentIds = new Set(appointments.map(row => row.departmentId))
  const explicitBranchIds = new Set(appointments.map(row => row.branchId).filter((value): value is string => !!value))
  const termInScope = appointments.some(row => row.branchId === offering.branchId || row.departmentId === branch.departmentId)
  if (!termInScope && !scopedDepartmentIds.has(branch.departmentId) && !explicitBranchIds.has(offering.branchId)) {
    throw forbidden('This HoD does not supervise the selected offering')
  }
}

async function assertViewerCanManageTask(context: RouteContext, auth: ReturnType<typeof requireAuth>, task: z.infer<typeof sharedTaskSchema>) {
  if (!auth.facultyId) throw forbidden('Faculty context is required')
  const normalizedStudentId = normalizeAcademicStudentId(task.studentId)
  if (auth.activeRoleGrant.roleCode === 'COURSE_LEADER') {
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, task.offeringId)
    return
  }
  if (auth.activeRoleGrant.roleCode === 'MENTOR') {
    const [assignment] = await context.db
      .select()
      .from(mentorAssignments)
      .where(and(
        eq(mentorAssignments.facultyId, auth.facultyId),
        eq(mentorAssignments.studentId, normalizedStudentId),
      ))
    if (!assignment) throw forbidden('This mentor does not supervise the selected student')
    return
  }
  await assertViewerCanReadOffering(context, auth, task.offeringId)
}

function validateMeetingWindow(startMinutes: number, endMinutes: number) {
  if (startMinutes >= endMinutes) {
    throw badRequest('Meeting duration must be positive')
  }
}

async function assertViewerCanSuperviseStudent(input: {
  context: RouteContext
  auth: ReturnType<typeof requireAuth>
  studentId: string
  offeringId?: string | null
}) {
  const normalizedStudentId = normalizeAcademicStudentId(input.studentId)
  if (!input.auth.facultyId) throw forbidden('Faculty context is required')
  const [student] = await input.context.db
    .select()
    .from(students)
    .where(eq(students.studentId, normalizedStudentId))
  if (!student) throw notFound('Student not found')

  if (input.auth.activeRoleGrant.roleCode === 'MENTOR') {
    const [assignment] = await input.context.db
      .select()
      .from(mentorAssignments)
      .where(and(
        eq(mentorAssignments.facultyId, input.auth.facultyId),
        eq(mentorAssignments.studentId, normalizedStudentId),
      ))
    if (!assignment) throw forbidden('This mentor does not supervise the selected student')
    return { student, studentId: normalizedStudentId }
  }

  if (input.auth.activeRoleGrant.roleCode === 'COURSE_LEADER') {
    if (input.offeringId) {
      await assertCourseLeaderCanManageOffering(input.context, input.auth.facultyId, input.offeringId)
      const { offering } = await getOfferingContext(input.context, input.offeringId)
      await assertStudentEnrolledInOffering(input.context, offering, normalizedStudentId)
      return { student, studentId: normalizedStudentId }
    }

    const activeEnrollments = await input.context.db
      .select()
      .from(studentEnrollments)
      .where(and(
        eq(studentEnrollments.studentId, normalizedStudentId),
        eq(studentEnrollments.academicStatus, 'active'),
      ))
    const ownedOfferingRows = await input.context.db
      .select()
      .from(facultyOfferingOwnerships)
      .where(and(
        eq(facultyOfferingOwnerships.facultyId, input.auth.facultyId),
        eq(facultyOfferingOwnerships.status, 'active'),
      ))
    const ownedOfferingIds = new Set(
      ownedOfferingRows
        .filter(row => isLeaderLikeOwnershipRole(row.ownershipRole))
        .map(row => row.offeringId),
    )
    const matchingOffering = await input.context.db
      .select()
      .from(sectionOfferings)
      .where(eq(sectionOfferings.status, 'active'))
      .then(rows => rows.find(row => ownedOfferingIds.has(row.offeringId) && activeEnrollments.some(enrollment => enrollment.termId === row.termId && enrollment.sectionCode === row.sectionCode)))
    if (!matchingOffering) {
      throw forbidden('This course leader does not supervise the selected student')
    }
    return { student, studentId: normalizedStudentId }
  }

  if (input.auth.activeRoleGrant.roleCode === 'HOD') {
    const activeEnrollments = await input.context.db
      .select()
      .from(studentEnrollments)
      .where(and(
        eq(studentEnrollments.studentId, normalizedStudentId),
        eq(studentEnrollments.academicStatus, 'active'),
      ))
    const appointments = await input.context.db
      .select()
      .from(facultyAppointments)
      .where(and(
        eq(facultyAppointments.facultyId, input.auth.facultyId),
        eq(facultyAppointments.status, 'active'),
      ))
    const scopedDepartmentIds = new Set(appointments.map(row => row.departmentId))
    const scopedBranchIds = new Set(appointments.map(row => row.branchId).filter((value): value is string => !!value))
    const [branchRows, termRows] = await Promise.all([
      input.context.db.select().from(branches),
      input.context.db.select().from(academicTerms),
    ])
    const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))
    const termById = Object.fromEntries(termRows.map(row => [row.termId, row]))
    const inScope = activeEnrollments.some(enrollment => {
      const branch = branchById[enrollment.branchId]
      const term = termById[enrollment.termId]
      return !!branch && (scopedBranchIds.has(branch.branchId) || scopedDepartmentIds.has(branch.departmentId) || (term?.branchId ? scopedBranchIds.has(term.branchId) : false))
    })
    if (!inScope) throw forbidden('This HoD does not supervise the selected student')
    return { student, studentId: normalizedStudentId }
  }

  throw forbidden('This role cannot manage meetings')
}

const proofResolutionCreditByOutcome = {
  completed_awaiting_evidence: 0.02,
  completed_improving: 0.05,
  not_completed: -0.05,
  no_show: -0.08,
  switch_intervention: -0.01,
  administratively_closed: 0,
} satisfies Record<z.infer<typeof proofReassessmentResolutionOutcomeSchema>, number>

function proofResolutionRecoveryState(outcome: z.infer<typeof proofReassessmentResolutionOutcomeSchema>) {
  return outcome === 'completed_improving' ? 'confirmed_improvement' : 'under_watch'
}

async function resolveProofReassessmentAccess(input: {
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

  if (input.auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
    const [activeRun] = await input.context.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
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

function mapAcademicTaskRow(
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

function mapTaskTransitionRow(row: typeof academicTaskTransitions.$inferSelect) {
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

function mapTaskPlacementRow(row: typeof academicTaskPlacements.$inferSelect) {
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

function mapFacultyCalendarWorkspaceRow(row: typeof facultyCalendarWorkspaces.$inferSelect) {
  const parsed = facultyCalendarTemplateSchema.safeParse(parseJson(row.templateJson, {}))
  if (!parsed.success) return null
  return parsed.data
}

function mapCalendarAuditEventRow(row: typeof academicCalendarAuditEvents.$inferSelect) {
  const parsed = calendarAuditEventSchema.safeParse(parseJson(row.payloadJson, {}))
  return parsed.success ? parsed.data : null
}

function mapAcademicMeetingRow(input: {
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

async function buildAcademicMeetingResponse(
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

function weekdayFromDateIso(dateISO: string) {
  const value = new Date(`${dateISO}T00:00:00Z`)
  if (Number.isNaN(value.getTime())) return null
  const weekday = value.getUTCDay()
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday] ?? null) as z.infer<typeof weekdaySchema> | null
}

function classBlocksCanOverlap(
  left: z.infer<typeof timetableClassBlockSchema>,
  right: z.infer<typeof timetableClassBlockSchema>,
) {
  if (left.kind === 'extra' && left.dateISO && right.kind === 'extra' && right.dateISO) {
    return left.dateISO === right.dateISO
  }
  if (left.kind === 'extra' && left.dateISO && right.kind !== 'extra') {
    return weekdayFromDateIso(left.dateISO) === right.day
  }
  if (right.kind === 'extra' && right.dateISO && left.kind !== 'extra') {
    return weekdayFromDateIso(right.dateISO) === left.day
  }
  return left.day === right.day
}

function rangesOverlap(
  left: { startMinutes: number; endMinutes: number },
  right: { startMinutes: number; endMinutes: number },
) {
  return left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes
}

async function validateFacultyCalendarTemplate(
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

async function getEditableCalendarWindowStatus(context: RouteContext, facultyId: string) {
  const workspacePayload = await getAcademicRuntimeState(context, 'adminCalendarByFacultyId')
  const rawWorkspace = (workspacePayload as Record<string, unknown>)?.[facultyId]
  const parsed = z.object({
    publishedAt: z.string().nullable().optional(),
    markers: z.array(z.unknown()).optional(),
  }).passthrough().safeParse(rawWorkspace)
  const publishedAt = parsed.success ? (parsed.data.publishedAt ?? null) : null
  const directEditWindowEndsAt = publishedAt
    ? new Date(new Date(publishedAt).getTime() + (14 * 24 * 60 * 60 * 1000)).toISOString()
    : null
  const classEditingLocked = !!directEditWindowEndsAt && new Date(directEditWindowEndsAt).getTime() < new Date(context.now()).getTime()
  return { publishedAt, directEditWindowEndsAt, classEditingLocked }
}

function inferMenteeFallback(input: {
  student: typeof students.$inferSelect
  enrollment?: typeof studentEnrollments.$inferSelect
  deptCode: string
  yearLabel: string
  prevCgpa: number
  avs?: number
  courseRisks?: Array<{
    code: string
    title: string
    risk: number
    band: 'Low' | 'Medium' | 'High'
    stage: 1 | 2 | 3
  }>
  interventions?: Array<{ date: string; type: string; note: string }>
}) {
  return {
    id: `mentee-${input.student.studentId}`,
    usn: input.student.usn,
    name: input.student.name,
    phone: input.student.phone ?? '',
    year: input.yearLabel,
    section: input.enrollment?.sectionCode ?? 'A',
    dept: input.deptCode,
    courseRisks: input.courseRisks ?? [],
    avs: input.avs ?? -1,
    prevCgpa: input.prevCgpa,
    interventions: input.interventions ?? [],
  }
}

function inferStudentFallback(input: {
  offering: {
    offId: string
    attendance: number
    tt1Done: boolean
    tt2Done: boolean
    stage: number
  }
  student: typeof students.$inferSelect
  prevCgpa: number
  currentCgpa?: number
  attendanceSnapshot?: {
    presentClasses: number
    totalClasses: number
  }
  assessments?: Record<string, { score: number; maxScore: number; evaluatedAt: string }>
  interventions?: Array<{ date: string; type: string; note: string }>
  risk?: { riskProb: number; riskBand: 'Low' | 'Medium' | 'High' }
  reasons?: Array<{ label: string; impact: number; feature: string }>
  coScores?: Array<{ coId: string; attainment: number }>
  whatIf?: Array<{ label: string; current: string; target: string; currentRisk: number; newRisk: number }>
  flags?: { backlog: boolean; lowAttendance: boolean; declining: boolean }
}) {
  const tt1 = input.assessments?.tt1
  const tt2 = input.assessments?.tt2
  const quiz1 = input.assessments?.quiz1
  const quiz2 = input.assessments?.quiz2
  const asgn1 = input.assessments?.asgn1
  const asgn2 = input.assessments?.asgn2
  const totalClasses = input.attendanceSnapshot?.totalClasses ?? 45
  const presentClasses = input.attendanceSnapshot?.presentClasses ?? Math.round((input.offering.attendance / 100) * totalClasses)
  return {
    id: `${input.offering.offId}::${input.student.studentId}`,
    usn: input.student.usn,
    name: input.student.name,
    phone: input.student.phone ?? '',
    present: presentClasses,
    totalClasses,
    tt1Score: tt1?.score ?? null,
    tt1Max: tt1?.maxScore ?? 25,
    tt2Score: tt2?.score ?? null,
    tt2Max: tt2?.maxScore ?? 25,
    quiz1: quiz1?.score ?? null,
    quiz2: quiz2?.score ?? null,
    asgn1: asgn1?.score ?? null,
    asgn2: asgn2?.score ?? null,
    prevCgpa: input.prevCgpa,
    currentCgpa: input.currentCgpa ?? input.prevCgpa,
    riskProb: input.risk?.riskProb ?? null,
    riskBand: input.risk?.riskBand ?? null,
    reasons: input.reasons ?? [],
    coScores: input.coScores ?? [],
    whatIf: input.whatIf ?? [],
    interventions: input.interventions ?? [],
    flags: input.flags ?? {
      backlog: input.prevCgpa > 0 && input.prevCgpa < 5.5,
      lowAttendance: input.offering.attendance > 0 && input.offering.attendance < 75,
      declining: false,
    },
  }
}

function buildStudentHistoryRecord(input: {
  student: typeof students.$inferSelect
  enrollment?: typeof studentEnrollments.$inferSelect
  term?: typeof academicTerms.$inferSelect
  branch?: typeof branches.$inferSelect
  department?: typeof departments.$inferSelect
  prevCgpa: number
  currentCgpa: number
  completedCreditsForCgpa: number
  repeatSubjects: string[]
  progressionStatus: 'Eligible' | 'Review' | 'Hold'
  trend: 'Improving' | 'Stable' | 'Declining'
  latestBacklogCount: number
  electiveRecommendation?: {
    recommendedCode: string
    recommendedTitle: string
    stream: string
    rationale: string
    alternatives: Array<{ code: string; title: string; stream: string }>
  } | null
  transcriptTerms?: Array<{
    termId: string
    label: string
    semesterNumber: number
    academicYear: string
    sgpa: number
    registeredCredits: number
    earnedCredits: number
    backlogCount: number
    subjects: Array<{
      code: string
      title: string
      credits: number
      score: number
      gradeLabel: string
      gradePoint: number
      result: string
    }>
  }>
}) {
  const departmentCode = input.department?.code ?? input.branch?.code ?? 'GEN'
  const programLabel = input.branch?.name ?? input.department?.name ?? departmentCode
  const notes = input.transcriptTerms && input.transcriptTerms.length > 0
    ? buildAdvisoryNotes({
        currentCgpa: input.currentCgpa,
        latestBacklogCount: input.latestBacklogCount,
        repeatSubjects: input.repeatSubjects,
        progressionStatus: input.progressionStatus,
        trend: input.trend,
      })
    : (input.prevCgpa > 0
        ? ['Transcript history has not been published yet. Current CGPA reflects the latest recorded student profile.']
        : ['Transcript history has not been published yet for this student.'])

  return {
    usn: input.student.usn,
    studentName: input.student.name,
    program: programLabel,
    dept: departmentCode,
    trend: input.trend,
    currentCgpa: input.currentCgpa,
    completedCreditsForCgpa: input.completedCreditsForCgpa,
    progressionStatus: input.progressionStatus,
    advisoryNotes: notes,
    repeatSubjects: input.repeatSubjects,
    electiveRecommendation: input.electiveRecommendation ?? null,
    terms: input.transcriptTerms && input.transcriptTerms.length > 0
      ? input.transcriptTerms
      : input.term
      ? [
          {
            termId: input.term.termId,
            label: `Semester ${input.term.semesterNumber}`,
            semesterNumber: input.term.semesterNumber,
            academicYear: input.term.academicYearLabel,
            sgpa: 0,
            registeredCredits: 0,
            earnedCredits: 0,
            backlogCount: 0,
            subjects: [],
          },
        ]
      : [],
  }
}

type AcademicStudentProjection = ReturnType<typeof inferStudentFallback> & Record<string, unknown>
type AcademicMenteeProjection = ReturnType<typeof inferMenteeFallback> & Record<string, unknown>
type AcademicOfferingProjection = Omit<ReturnType<typeof mapOfferingRow>, 'termId' | 'branchId' | 'tt1Locked' | 'tt2Locked' | 'quizLocked' | 'asgnLocked'> & {
  termId?: string
  branchId?: string
  tt1Locked?: boolean
  tt2Locked?: boolean
  quizLocked?: boolean
  asgnLocked?: boolean
} & Record<string, unknown>

function mapOfferingRow(input: {
  offering: typeof sectionOfferings.$inferSelect
  course: typeof courses.$inferSelect
  term: typeof academicTerms.$inferSelect
  department: typeof departments.$inferSelect | undefined
  computedCount?: number
}) {
  const count = input.computedCount ?? input.offering.studentCount
  return {
    id: input.course.courseId,
    offId: input.offering.offeringId,
    termId: input.offering.termId,
    branchId: input.offering.branchId,
    code: input.course.courseCode,
    title: input.course.title,
    year: input.offering.yearLabel,
    dept: input.department?.code ?? 'CSE',
    sem: input.term.semesterNumber,
    section: input.offering.sectionCode,
    count,
    attendance: input.offering.attendance,
    stage: input.offering.stage,
    stageInfo: {
      stage: input.offering.stage,
      label: input.offering.stageLabel,
      desc: input.offering.stageDescription,
      color: input.offering.stageColor,
    },
    tt1Done: !!input.offering.tt1Done,
    tt2Done: !!input.offering.tt2Done,
    tt1Locked: !!input.offering.tt1Locked,
    tt2Locked: !!input.offering.tt2Locked,
    quizLocked: !!input.offering.quizLocked,
    asgnLocked: !!input.offering.assignmentLocked,
    pendingAction: input.offering.pendingAction,
    sections: [input.offering.sectionCode],
    enrolled: [count],
    att: [input.offering.attendance],
  }
}

function buildProfessorProjection(input: {
  faculty: Array<{
    facultyId: string
    name: string
    initials: string
    email: string
    dept: string
    roleTitle: string
  }>
  facultyId?: string | null
  roleCode?: string | null
}) {
  const current = input.facultyId
    ? (input.faculty.find(account => account.facultyId === input.facultyId) ?? null)
    : null
  const fallback = current ?? input.faculty[0] ?? {
    facultyId: 'faculty-unassigned',
    name: 'Teaching Workspace',
    initials: 'TW',
    email: '',
    dept: 'Unassigned',
    roleTitle: 'Faculty',
  }

  return {
    name: fallback.name,
    id: fallback.facultyId,
    dept: fallback.dept,
    role: input.roleCode ? (toUiRole(input.roleCode) ?? fallback.roleTitle) : fallback.roleTitle,
    initials: fallback.initials,
    email: fallback.email,
  }
}

async function buildAcademicBootstrap(
  context: RouteContext,
  viewer: {
    facultyId?: string | null
    roleCode?: string | null
    simulationStageCheckpointId?: string | null
  } = {},
) {
  const runtimeEntries = await Promise.all(runtimeStateKeys.map(async stateKey => {
    return [stateKey, await getAcademicRuntimeState(context, stateKey)] as const
  }))
  const runtime = Object.fromEntries(runtimeEntries)

  const [
    courseRows,
    termRows,
    branchRows,
    departmentRows,
    offeringRows,
    ownershipRows,
    facultyRows,
    appointmentRows,
    userRows,
    roleGrantRows,
    studentRows,
    profileRows,
    enrollmentRows,
    mentorRows,
    attendanceRows,
    assessmentRows,
    interventionRows,
    transcriptTermRows,
    transcriptSubjectRows,
    courseOutcomeOverrideRows,
    schemeRows,
    questionPaperRows,
    riskAssessmentRows,
    electiveRecommendationRows,
    academicTaskRows,
    academicTaskTransitionRows,
    academicTaskPlacementRows,
    facultyCalendarWorkspaceRows,
    academicCalendarAuditRows,
    academicMeetingRows,
    stageCheckpointRow,
    stageOfferingProjectionRows,
  ] = await Promise.all([
    context.db.select().from(courses).orderBy(asc(courses.courseCode)),
    context.db.select().from(academicTerms),
    context.db.select().from(branches),
    context.db.select().from(departments),
    context.db.select().from(sectionOfferings).where(eq(sectionOfferings.status, 'active')).orderBy(asc(sectionOfferings.offeringId)),
    context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    context.db.select().from(facultyProfiles).where(eq(facultyProfiles.status, 'active')).orderBy(asc(facultyProfiles.facultyId)),
    context.db.select().from(facultyAppointments).where(eq(facultyAppointments.status, 'active')).orderBy(asc(facultyAppointments.facultyId)),
    context.db.select().from(userAccounts),
    context.db.select().from(roleGrants).where(eq(roleGrants.status, 'active')),
    context.db.select().from(students).where(eq(students.status, 'active')).orderBy(asc(students.usn)),
    context.db.select().from(studentAcademicProfiles),
    context.db.select().from(studentEnrollments).where(eq(studentEnrollments.academicStatus, 'active')).orderBy(asc(studentEnrollments.termId), asc(studentEnrollments.sectionCode), asc(studentEnrollments.rosterOrder), asc(studentEnrollments.studentId)),
    context.db.select().from(mentorAssignments),
    context.db.select().from(studentAttendanceSnapshots),
    context.db.select().from(studentAssessmentScores),
    context.db.select().from(studentInterventions),
    context.db.select().from(transcriptTermResults),
    context.db.select().from(transcriptSubjectResults),
    context.db.select().from(courseOutcomeOverrides).where(eq(courseOutcomeOverrides.status, 'active')),
    context.db.select().from(offeringAssessmentSchemes).where(eq(offeringAssessmentSchemes.status, 'active')),
    context.db.select().from(offeringQuestionPapers),
    context.db.select().from(riskAssessments),
    context.db.select().from(electiveRecommendations),
    context.db.select().from(academicTasks).orderBy(asc(academicTasks.createdAt)),
    context.db.select().from(academicTaskTransitions).orderBy(asc(academicTaskTransitions.occurredAt)),
    context.db.select().from(academicTaskPlacements),
    context.db.select().from(facultyCalendarWorkspaces),
    context.db.select().from(academicCalendarAuditEvents).orderBy(asc(academicCalendarAuditEvents.createdAt)),
    context.db.select().from(academicMeetings).orderBy(asc(academicMeetings.dateIso), asc(academicMeetings.startMinutes)),
    viewer.simulationStageCheckpointId
      ? context.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationStageCheckpointId, viewer.simulationStageCheckpointId)).then(rows => rows[0] ?? null)
      : Promise.resolve(null),
    viewer.simulationStageCheckpointId
      ? context.db.select().from(simulationStageOfferingProjections).where(eq(simulationStageOfferingProjections.simulationStageCheckpointId, viewer.simulationStageCheckpointId))
      : Promise.resolve([]),
  ])

  const courseById = Object.fromEntries(courseRows.map(row => [row.courseId, row]))
  const termById = Object.fromEntries(termRows.map(row => [row.termId, row]))
  const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))
  const departmentById = Object.fromEntries(departmentRows.map(row => [row.departmentId, row]))
  const offeringRowById = Object.fromEntries(offeringRows.map(row => [row.offeringId, row]))
  const userById = Object.fromEntries(userRows.map(row => [row.userId, row]))
  const studentById = Object.fromEntries(studentRows.map(row => [row.studentId, row]))
  const studentAcademicProfileById = Object.fromEntries(profileRows.map(row => [row.studentId, row]))
  const activeEnrollmentByStudentId = new Map<string, typeof studentEnrollments.$inferSelect>()
  const primaryAppointmentByFacultyId = new Map<string, typeof facultyAppointments.$inferSelect>()
  for (const appointment of appointmentRows) {
    const current = primaryAppointmentByFacultyId.get(appointment.facultyId)
    if (!current || appointment.isPrimary === 1) {
      primaryAppointmentByFacultyId.set(appointment.facultyId, appointment)
    }
  }

  const enrollmentsByGroup = new Map<string, Array<typeof studentEnrollments.$inferSelect>>()
  for (const enrollment of enrollmentRows) {
    const key = `${enrollment.termId}::${enrollment.sectionCode}`
    enrollmentsByGroup.set(key, [...(enrollmentsByGroup.get(key) ?? []), enrollment])
    const current = activeEnrollmentByStudentId.get(enrollment.studentId)
    if (!current || enrollment.startDate > current.startDate) {
      activeEnrollmentByStudentId.set(enrollment.studentId, enrollment)
    }
  }

  const activeMentorAssignmentByStudentId = new Map<string, typeof mentorAssignments.$inferSelect>()
  for (const assignment of mentorRows) {
    if (assignment.effectiveTo) continue
    const existing = activeMentorAssignmentByStudentId.get(assignment.studentId)
    if (!existing || assignment.effectiveFrom > existing.effectiveFrom) {
      activeMentorAssignmentByStudentId.set(assignment.studentId, assignment)
    }
  }

  const latestAttendanceByStudentOffering = new Map<string, typeof studentAttendanceSnapshots.$inferSelect>()
  for (const row of attendanceRows) {
    const key = `${row.studentId}::${row.offeringId}`
    const current = latestAttendanceByStudentOffering.get(key)
    if (!current || row.capturedAt > current.capturedAt) {
      latestAttendanceByStudentOffering.set(key, row)
    }
  }

  const latestAssessmentsByStudentOffering = new Map<string, Record<string, { score: number; maxScore: number; evaluatedAt: string }>>()
  const latestAssessmentCellsByStudentOffering = new Map<string, typeof studentAssessmentScores.$inferSelect[]>()
  const latestAssessmentCellByCompositeKey = new Map<string, typeof studentAssessmentScores.$inferSelect>()
  for (const row of assessmentRows) {
    const key = `${row.studentId}::${row.offeringId}`
    const current = latestAssessmentsByStudentOffering.get(key) ?? {}
    const existing = current[row.componentType]
    if (!existing || row.evaluatedAt > existing.evaluatedAt) {
      current[row.componentType] = {
        score: row.score,
        maxScore: row.maxScore,
        evaluatedAt: row.evaluatedAt,
      }
      latestAssessmentsByStudentOffering.set(key, current)
    }
    const compositeKey = `${row.studentId}::${row.offeringId}::${row.componentType}::${row.componentCode ?? ''}`
    const existingCell = latestAssessmentCellByCompositeKey.get(compositeKey)
    if (!existingCell || row.evaluatedAt > existingCell.evaluatedAt) {
      latestAssessmentCellByCompositeKey.set(compositeKey, row)
    }
  }

  for (const row of latestAssessmentCellByCompositeKey.values()) {
    const key = `${row.studentId}::${row.offeringId}`
    latestAssessmentCellsByStudentOffering.set(key, [...(latestAssessmentCellsByStudentOffering.get(key) ?? []), row])
  }

  const interventionsByStudentId = new Map<string, Array<{ date: string; type: string; note: string }>>()
  for (const row of interventionRows) {
    const current = interventionsByStudentId.get(row.studentId) ?? []
    current.push({
      date: row.occurredAt,
      type: row.interventionType,
      note: row.note,
    })
    interventionsByStudentId.set(row.studentId, current)
  }
  for (const [studentId, entries] of interventionsByStudentId.entries()) {
    entries.sort((left, right) => right.date.localeCompare(left.date))
    interventionsByStudentId.set(studentId, entries)
  }

  const latestRiskAssessmentByStudentOffering = new Map<string, typeof riskAssessments.$inferSelect>()
  for (const row of riskAssessmentRows) {
    const key = `${row.studentId}::${row.offeringId}`
    const current = latestRiskAssessmentByStudentOffering.get(key)
    if (!current || row.assessedAt > current.assessedAt) {
      latestRiskAssessmentByStudentOffering.set(key, row)
    }
  }

  const latestElectiveRecommendationByStudentId = new Map<string, typeof electiveRecommendations.$inferSelect>()
  for (const row of electiveRecommendationRows) {
    const current = latestElectiveRecommendationByStudentId.get(row.studentId)
    if (!current || row.updatedAt > current.updatedAt) {
      latestElectiveRecommendationByStudentId.set(row.studentId, row)
    }
  }

  const latestTranscriptTermByStudentAndTerm = new Map<string, typeof transcriptTermResults.$inferSelect>()
  for (const row of transcriptTermRows) {
    const key = `${row.studentId}::${row.termId}`
    const current = latestTranscriptTermByStudentAndTerm.get(key)
    if (!current || row.updatedAt > current.updatedAt) {
      latestTranscriptTermByStudentAndTerm.set(key, row)
    }
  }
  const transcriptTermsByStudentId = new Map<string, Array<typeof transcriptTermResults.$inferSelect>>()
  for (const row of latestTranscriptTermByStudentAndTerm.values()) {
    transcriptTermsByStudentId.set(row.studentId, [...(transcriptTermsByStudentId.get(row.studentId) ?? []), row])
  }
  const transcriptSubjectsByTermResultId = new Map<string, Array<typeof transcriptSubjectResults.$inferSelect>>()
  for (const row of transcriptSubjectRows) {
    transcriptSubjectsByTermResultId.set(row.transcriptTermResultId, [...(transcriptSubjectsByTermResultId.get(row.transcriptTermResultId) ?? []), row])
  }

  const resolvedPolicyByBatchId = new Map<string, ResolvedPolicy>()
  const batchIds = Array.from(new Set(termRows.map(row => row.batchId).filter((value): value is string => !!value)))
  const resolvedPolicies = await Promise.all(batchIds.map(async batchId => {
    const resolved = await resolveBatchPolicy(context, batchId)
    return [batchId, resolved.effectivePolicy] as const
  }))
  for (const [batchId, policy] of resolvedPolicies) {
    resolvedPolicyByBatchId.set(batchId, policy)
  }
  const activeRiskModelByBatchId = new Map<string, Awaited<ReturnType<typeof getProofRiskModelActive>>['production'] | null>()
  const activeModelRows = await Promise.all(batchIds.map(async batchId => {
    const activeModel = await getProofRiskModelActive(context.db, { batchId })
    return [batchId, activeModel.production ?? null] as const
  }))
  for (const [batchId, activeModel] of activeModelRows) {
    activeRiskModelByBatchId.set(batchId, activeModel)
  }

  const studentTranscriptAnalyticsByStudentId = new Map<string, ReturnType<typeof computeTranscriptAnalytics>>()
  for (const student of studentRows) {
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const term = enrollment ? termById[enrollment.termId] : undefined
    const profile = studentAcademicProfileById[student.studentId]
    const fallbackCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    const policy = (term?.batchId ? resolvedPolicyByBatchId.get(term.batchId) : null) ?? DEFAULT_POLICY
    studentTranscriptAnalyticsByStudentId.set(student.studentId, computeTranscriptAnalytics({
      termRows: transcriptTermsByStudentId.get(student.studentId) ?? [],
      termById,
      subjectsByTermResultId: transcriptSubjectsByTermResultId,
      policy,
      fallbackCgpa,
    }))
  }

  const courseOutcomeOverridesByCourseId = new Map<string, Array<typeof courseOutcomeOverrides.$inferSelect>>()
  for (const row of courseOutcomeOverrideRows) {
    courseOutcomeOverridesByCourseId.set(row.courseId, [...(courseOutcomeOverridesByCourseId.get(row.courseId) ?? []), row])
  }

  const rawSchemeByOfferingId = new Map<string, z.infer<typeof schemeStateSchema>>()
  for (const row of schemeRows) {
    const parsed = schemeStateSchema.safeParse(parseJson(row.schemeJson, {}))
    if (parsed.success) rawSchemeByOfferingId.set(row.offeringId, parsed.data)
  }

  const questionPapersByOfferingId = new Map<string, Partial<Record<'tt1' | 'tt2', z.infer<typeof termTestBlueprintSchema>>>>()
  for (const row of questionPaperRows) {
    if (row.kind !== 'tt1' && row.kind !== 'tt2') continue
    const parsed = termTestBlueprintSchema.safeParse(parseJson(row.blueprintJson, {}))
    if (!parsed.success) continue
    questionPapersByOfferingId.set(row.offeringId, {
      ...(questionPapersByOfferingId.get(row.offeringId) ?? {}),
      [row.kind]: parsed.data,
    })
  }

  const taskTransitionsByTaskId = new Map<string, z.infer<typeof queueTransitionSchema>[]>()
  for (const row of academicTaskTransitionRows) {
    taskTransitionsByTaskId.set(row.taskId, [...(taskTransitionsByTaskId.get(row.taskId) ?? []), mapTaskTransitionRow(row)])
  }

  const authoritativeTasks = academicTaskRows.map(row => mapAcademicTaskRow(row, taskTransitionsByTaskId.get(row.taskId) ?? []))
  const authoritativeTaskById = new Map(authoritativeTasks.map(task => [task.id, task]))

  const authoritativePlacementsByTaskId = new Map<string, z.infer<typeof taskPlacementSchema>>()
  for (const row of academicTaskPlacementRows) {
    authoritativePlacementsByTaskId.set(row.taskId, mapTaskPlacementRow(row))
  }

  const facultyCalendarTemplateByFacultyId = new Map<string, z.infer<typeof facultyCalendarTemplateSchema>>()
  for (const row of facultyCalendarWorkspaceRows) {
    const parsed = mapFacultyCalendarWorkspaceRow(row)
    if (parsed) facultyCalendarTemplateByFacultyId.set(row.facultyId, parsed)
  }

  const calendarAuditByFacultyId = new Map<string, z.infer<typeof calendarAuditEventSchema>[]>()
  for (const row of academicCalendarAuditRows) {
    const parsed = mapCalendarAuditEventRow(row)
    if (!parsed) continue
    calendarAuditByFacultyId.set(row.facultyId, [...(calendarAuditByFacultyId.get(row.facultyId) ?? []), parsed])
  }

  const academicOfferings: AcademicOfferingProjection[] = offeringRows.map(offeringRow => {
    const course = courseById[offeringRow.courseId]
    const term = termById[offeringRow.termId]
    const branch = branchById[offeringRow.branchId]
    const department = branch ? departmentById[branch.departmentId] : undefined
    const enrollmentKey = `${offeringRow.termId}::${offeringRow.sectionCode}`
    const sectionEnrollments = enrollmentsByGroup.get(enrollmentKey) ?? []
    return mapOfferingRow({
      offering: offeringRow,
      course,
      term,
      department,
      computedCount: sectionEnrollments.length,
    })
  })

  const resolvedPolicyByOfferingId = new Map<string, ResolvedPolicy>()
  const resolvedCourseOutcomesByOfferingId = new Map<string, Array<z.infer<typeof courseOutcomeSchema>>>()
  const resolvedSchemesByOfferingId = new Map<string, z.infer<typeof schemeStateSchema>>()
  const resolvedQuestionPapersByOfferingId = new Map<string, Record<'tt1' | 'tt2', z.infer<typeof termTestBlueprintSchema>>>()

  for (const offeringRow of offeringRows) {
    const term = termById[offeringRow.termId]
    const branch = branchById[offeringRow.branchId]
    const department = branch ? departmentById[branch.departmentId] : null
    const course = courseById[offeringRow.courseId]
    const policy = (term?.batchId ? resolvedPolicyByBatchId.get(term.batchId) : null) ?? DEFAULT_POLICY
    resolvedPolicyByOfferingId.set(offeringRow.offeringId, policy)
    const outcomes = resolveCourseOutcomesForOffering({
      institutionId: department?.institutionId ?? 'institution',
      branchId: offeringRow.branchId,
      batchId: term?.batchId ?? null,
      offeringId: offeringRow.offeringId,
      courseId: offeringRow.courseId,
      courseCode: course?.courseCode ?? 'COURSE',
      courseTitle: course?.title ?? 'Course',
      overrides: courseOutcomeOverridesByCourseId.get(offeringRow.courseId) ?? [],
    })
    resolvedCourseOutcomesByOfferingId.set(offeringRow.offeringId, outcomes)
    resolvedSchemesByOfferingId.set(
      offeringRow.offeringId,
      rawSchemeByOfferingId.has(offeringRow.offeringId)
        ? canonicalizeSchemeState(rawSchemeByOfferingId.get(offeringRow.offeringId)!, policy)
        : buildDefaultSchemeFromPolicy(policy),
    )
    resolvedQuestionPapersByOfferingId.set(
      offeringRow.offeringId,
      {
        tt1: questionPapersByOfferingId.get(offeringRow.offeringId)?.tt1 ?? buildDefaultQuestionPaper('tt1', outcomes),
        tt2: questionPapersByOfferingId.get(offeringRow.offeringId)?.tt2 ?? buildDefaultQuestionPaper('tt2', outcomes),
      },
    )
  }

  const authoritativeMeetings = academicMeetingRows.map(row => {
    const offering = row.offeringId ? (offeringRowById[row.offeringId] ?? null) : null
    const course = offering ? (courseById[offering.courseId] ?? null) : null
    return mapAcademicMeetingRow({
      row,
      student: studentById[row.studentId] ?? null,
      offering,
      course,
    })
  })
  const meetingEntriesByStudentId = new Map<string, Array<{ date: string; type: string; note: string }>>()
  for (const meeting of authoritativeMeetings) {
    const label = meeting.status === 'cancelled'
      ? 'Meeting Cancelled'
      : meeting.status === 'completed'
        ? 'Meeting'
        : 'Scheduled Meeting'
    const note = meeting.courseCode
      ? `${meeting.title} · ${meeting.courseCode}${meeting.notes ? ` · ${meeting.notes}` : ''}`
      : `${meeting.title}${meeting.notes ? ` · ${meeting.notes}` : ''}`
    meetingEntriesByStudentId.set(meeting.studentId, [
      ...(meetingEntriesByStudentId.get(meeting.studentId) ?? []),
      {
        date: meeting.dateISO,
        type: label,
        note,
      },
    ])
  }

  const studentsByOffering = Object.fromEntries(academicOfferings.map(offering => {
    const offeringRow = offeringRowById[offering.offId]
    const sectionEnrollments = offeringRow
      ? (enrollmentsByGroup.get(`${offeringRow.termId}::${offering.section}`) ?? [])
      : []
    const nextStudents = sectionEnrollments.map(enrollment => {
      const student = studentById[enrollment.studentId]
      if (!student) return null
      const profile = studentAcademicProfileById[enrollment.studentId]
      const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
      const runtimeKey = `${student.studentId}::${offering.offId}`
      const attendanceSnapshot = latestAttendanceByStudentOffering.get(runtimeKey)
      const attendancePct = attendanceSnapshot && attendanceSnapshot.totalClasses > 0
        ? Math.round((attendanceSnapshot.presentClasses / attendanceSnapshot.totalClasses) * 100)
        : offering.attendance
      const transcriptAnalytics = studentTranscriptAnalyticsByStudentId.get(student.studentId) ?? computeTranscriptAnalytics({
        termRows: transcriptTermsByStudentId.get(student.studentId) ?? [],
        termById,
        subjectsByTermResultId: transcriptSubjectsByTermResultId,
        policy: resolvedPolicyByOfferingId.get(offering.offId) ?? DEFAULT_POLICY,
        fallbackCgpa: prevCgpa,
      })
      const policy = resolvedPolicyByOfferingId.get(offering.offId) ?? DEFAULT_POLICY
      const scheme = resolvedSchemesByOfferingId.get(offering.offId) ?? buildDefaultSchemeFromPolicy(policy)
      const questionPapers = resolvedQuestionPapersByOfferingId.get(offering.offId) ?? {
        tt1: buildDefaultQuestionPaper('tt1', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []),
        tt2: buildDefaultQuestionPaper('tt2', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []),
      }
      const assessmentMap = latestAssessmentsByStudentOffering.get(runtimeKey) ?? {}
      const assessmentCells = latestAssessmentCellsByStudentOffering.get(runtimeKey) ?? []
      const tt1Raw = assessmentMap.tt1?.score ?? null
      const tt2Raw = assessmentMap.tt2?.score ?? null
      const tt1Max = Math.max(1, assessmentMap.tt1?.maxScore ?? questionPapers.tt1.totalMarks)
      const tt2Max = Math.max(1, assessmentMap.tt2?.maxScore ?? questionPapers.tt2.totalMarks)
      const tt1Pct = tt1Raw !== null ? roundToTwo((tt1Raw / tt1Max) * 100) : null
      const tt2Pct = tt2Raw !== null ? roundToTwo((tt2Raw / tt2Max) * 100) : null
      const quizPcts = ['quiz1', 'quiz2']
        .map(key => {
          const score = assessmentMap[key]?.score ?? null
          const maxScore = assessmentMap[key]?.maxScore ?? null
          if (score === null || !maxScore || maxScore <= 0) return null
          return roundToTwo((score / maxScore) * 100)
        })
        .filter((value): value is number => value !== null)
      const assignmentPcts = ['asgn1', 'asgn2']
        .map(key => {
          const score = assessmentMap[key]?.score ?? null
          const maxScore = assessmentMap[key]?.maxScore ?? null
          if (score === null || !maxScore || maxScore <= 0) return null
          return roundToTwo((score / maxScore) * 100)
        })
        .filter((value): value is number => value !== null)
      const quizPct = quizPcts.length > 0 ? roundToTwo(quizPcts.reduce((sum, value) => sum + value, 0) / quizPcts.length) : null
      const assignmentPct = assignmentPcts.length > 0 ? roundToTwo(assignmentPcts.reduce((sum, value) => sum + value, 0) / assignmentPcts.length) : null
      const seeRaw = assessmentMap.see?.score ?? null
      const seeMax = assessmentMap.see?.maxScore ?? null
      const seePct = seeRaw !== null && seeMax && seeMax > 0 ? roundToTwo((seeRaw / seeMax) * 100) : null
      const outcomeBreakdown = computeStudentOutcomeAttainment({
        outcomes: resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? [],
        tt1Blueprint: questionPapers.tt1,
        tt2Blueprint: questionPapers.tt2,
        assessmentCells,
      })
      const persistedRisk = latestRiskAssessmentByStudentOffering.get(runtimeKey)
      const batchIdForOffering = offeringRow ? (termById[offeringRow.termId]?.batchId ?? null) : null
      const risk = persistedRisk
        ? {
            riskProb: persistedRisk.riskProbScaled / 100,
            riskBand: persistedRisk.riskBand as 'Low' | 'Medium' | 'High',
          }
        : computeRiskFromActiveModelOrPolicy({
            attendancePct,
            currentCgpa: transcriptAnalytics.currentCgpa,
            backlogCount: transcriptAnalytics.latestBacklogCount,
            tt1Pct,
            tt2Pct,
            quizPct,
            assignmentPct,
            seePct,
            weakCoCount: outcomeBreakdown.filter(item => item.overallAttainment > 0 && item.overallAttainment < 45).length,
            policy,
            activeModel: batchIdForOffering ? (activeRiskModelByBatchId.get(batchIdForOffering) ?? null) : null,
            semesterProgress: Math.max(0.25, Math.min(1, offering.stage / 3)),
          })
      const quizRawTotal = ['quiz1', 'quiz2'].reduce((sum, key) => sum + (assessmentMap[key]?.score ?? 0), 0)
      const assignmentRawTotal = ['asgn1', 'asgn2'].reduce((sum, key) => sum + (assessmentMap[key]?.score ?? 0), 0)
      const reasons = persistedRisk
        ? z.array(z.object({
            label: z.string(),
            impact: z.number(),
            feature: z.string(),
          })).catch([]).parse(parseJson(persistedRisk.driversJson, []))
        : risk.riskProb >= 0.35
          ? buildStudentReasons({
              attendancePct,
              tt1Raw,
              tt1Max,
              tt2Raw,
              tt2Max,
              currentCgpa: transcriptAnalytics.currentCgpa,
              quizRawTotal,
              coScores: outcomeBreakdown.map(item => ({ coId: item.coId, overallAttainment: item.overallAttainment })),
            })
          : []
      const whatIf = persistedRisk
        ? []
        : risk.riskProb >= 0.35
          ? buildStudentWhatIf({
              riskProb: risk.riskProb,
              attendancePct,
              coScores: outcomeBreakdown.map(item => ({ coId: item.coId, overallAttainment: item.overallAttainment })),
            })
          : []
      const mergedInterventions = [
        ...(interventionsByStudentId.get(student.studentId) ?? []),
        ...(meetingEntriesByStudentId.get(student.studentId) ?? []),
      ].sort((left, right) => right.date.localeCompare(left.date))
      return inferStudentFallback({
        offering,
        student,
        prevCgpa,
        currentCgpa: transcriptAnalytics.currentCgpa,
        attendanceSnapshot: attendanceSnapshot
          ? {
              presentClasses: attendanceSnapshot.presentClasses,
              totalClasses: attendanceSnapshot.totalClasses,
            }
          : undefined,
        assessments: assessmentMap,
        interventions: mergedInterventions,
        risk,
        reasons,
        coScores: outcomeBreakdown.map(item => ({ coId: item.coId, attainment: item.overallAttainment })),
        whatIf,
        flags: {
          backlog: transcriptAnalytics.latestBacklogCount > 0,
          lowAttendance: attendancePct < 75,
          declining: transcriptAnalytics.trend === 'Declining',
        },
      })
    }).filter((student): student is AcademicStudentProjection => !!student)
    return [offering.offId, nextStudents]
  })) as Record<string, AcademicStudentProjection[]>

  const coAttainmentByOffering = Object.fromEntries(academicOfferings.map(offering => {
    const students = studentsByOffering[offering.offId] ?? []
    const outcomes = resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []
    const questionPapers = resolvedQuestionPapersByOfferingId.get(offering.offId) ?? {
      tt1: buildDefaultQuestionPaper('tt1', outcomes),
      tt2: buildDefaultQuestionPaper('tt2', outcomes),
    }
    const rows = outcomes.map(outcome => {
      const studentBreakdowns = students.map(student => {
        const studentId = normalizeAcademicStudentId(student.id)
        const assessmentCells = latestAssessmentCellsByStudentOffering.get(`${studentId}::${offering.offId}`) ?? []
        return computeStudentOutcomeAttainment({
          outcomes: [outcome],
          tt1Blueprint: questionPapers.tt1,
          tt2Blueprint: questionPapers.tt2,
          assessmentCells,
        })[0]
      })
      return coAttainmentRowSchema.parse({
        coId: outcome.id,
        desc: outcome.desc,
        bloom: outcome.bloom,
        target: 60,
        tt1Attainment: averageNullable(studentBreakdowns.map(item => item.tt1Attainment)),
        tt2Attainment: averageNullable(studentBreakdowns.map(item => item.tt2Attainment)),
        overallAttainment: averageNullable(studentBreakdowns.map(item => item.overallAttainment)),
        studentsCounted: studentBreakdowns.filter(item => item.overallAttainment > 0).length,
      })
    })
    return [offering.offId, rows]
  })) as Record<string, Array<z.infer<typeof coAttainmentRowSchema>>>

  const studentHistoryByUsn = Object.fromEntries(studentRows.map(student => {
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const term = enrollment ? termById[enrollment.termId] : undefined
    const branch = enrollment ? branchById[enrollment.branchId] : undefined
    const department = branch ? departmentById[branch.departmentId] : undefined
    const profile = studentAcademicProfileById[student.studentId]
    const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    const transcriptAnalytics = studentTranscriptAnalyticsByStudentId.get(student.studentId) ?? computeTranscriptAnalytics({
      termRows: transcriptTermsByStudentId.get(student.studentId) ?? [],
      termById,
      subjectsByTermResultId: transcriptSubjectsByTermResultId,
      policy: (term?.batchId ? resolvedPolicyByBatchId.get(term.batchId) : null) ?? DEFAULT_POLICY,
      fallbackCgpa: prevCgpa,
    })
    const transcriptTerms = (transcriptTermsByStudentId.get(student.studentId) ?? [])
      .sort((left, right) => {
        const leftTerm = termById[left.termId]
        const rightTerm = termById[right.termId]
        if (!leftTerm || !rightTerm) return left.termId.localeCompare(right.termId)
        return leftTerm.semesterNumber - rightTerm.semesterNumber
      })
      .map(termResult => {
        const termInfo = termById[termResult.termId]
        const subjects = (transcriptSubjectsByTermResultId.get(termResult.transcriptTermResultId) ?? []).map(subject => ({
          code: subject.courseCode,
          title: subject.title,
          credits: subject.credits,
          score: subject.score,
          gradeLabel: subject.gradeLabel,
          gradePoint: subject.gradePoint,
          result: subject.result,
        }))
        return {
          termId: termResult.termId,
          label: termInfo ? `Semester ${termInfo.semesterNumber}` : termResult.termId,
          semesterNumber: termInfo?.semesterNumber ?? 0,
          academicYear: termInfo?.academicYearLabel ?? '',
          sgpa: termResult.sgpaScaled / 100,
          registeredCredits: termResult.registeredCredits,
          earnedCredits: termResult.earnedCredits,
          backlogCount: termResult.backlogCount,
          subjects,
        }
      })
    return [student.usn, buildStudentHistoryRecord({
      student,
      enrollment,
      term,
      branch,
      department,
      prevCgpa,
      currentCgpa: transcriptAnalytics.currentCgpa,
      completedCreditsForCgpa: transcriptAnalytics.completedCreditsForCgpa,
      repeatSubjects: transcriptAnalytics.repeatSubjects,
      progressionStatus: transcriptAnalytics.progressionStatus,
      trend: transcriptAnalytics.trend,
      latestBacklogCount: transcriptAnalytics.latestBacklogCount,
      electiveRecommendation: (() => {
        const recommendation = latestElectiveRecommendationByStudentId.get(student.studentId)
        if (!recommendation) return null
        const rationale = parseJson(recommendation.rationaleJson, { summary: '' as string })
        const alternatives = parseJson(recommendation.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>)
        return {
          recommendedCode: recommendation.recommendedCode,
          recommendedTitle: recommendation.recommendedTitle,
          stream: recommendation.stream,
          rationale: rationale.summary ?? '',
          alternatives,
        }
      })(),
      transcriptTerms,
    })]
  }))

  const mentees = studentRows.flatMap(student => {
    const mentorAssignment = activeMentorAssignmentByStudentId.get(student.studentId)
    if (!mentorAssignment) return []
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const branch = enrollment ? branchById[enrollment.branchId] : undefined
    const department = branch ? departmentById[branch.departmentId] : undefined
    const term = enrollment ? termById[enrollment.termId] : undefined
    const offering = academicOfferings.find(item => item.section === (enrollment?.sectionCode ?? '') && item.sem === term?.semesterNumber)
    const profile = studentAcademicProfileById[student.studentId]
    const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    const interventions = [
      ...(interventionsByStudentId.get(student.studentId) ?? []),
      ...(meetingEntriesByStudentId.get(student.studentId) ?? []),
    ].sort((left, right) => right.date.localeCompare(left.date))
    const courseRisks = enrollment
      ? academicOfferings
          .filter(item => item.termId === enrollment.termId && item.section === enrollment.sectionCode)
          .map(item => {
            const matchingProjection = studentsByOffering[item.offId]
              ?.find(candidate => normalizeAcademicStudentId(candidate.id) === student.studentId || candidate.usn === student.usn)
            return {
              code: item.code,
              title: item.title,
              risk: matchingProjection?.riskProb ?? -1,
              band: matchingProjection?.riskBand ?? 'Low' as const,
              stage: item.stage as 1 | 2 | 3,
            }
          })
      : []
    const activeCourseRisks = courseRisks.filter(item => item.risk >= 0)
    const avs = activeCourseRisks.length > 0
      ? roundToTwo(activeCourseRisks.reduce((sum, item) => sum + item.risk, 0) / activeCourseRisks.length)
      : -1
    return [inferMenteeFallback({
      student,
      enrollment,
      deptCode: department?.code ?? 'GEN',
      yearLabel: offering?.year ?? `Semester ${term?.semesterNumber ?? 1}`,
      prevCgpa,
      avs,
      courseRisks,
      interventions,
    })]
  }) as AcademicMenteeProjection[]
  mentees.sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name)
    if (nameOrder !== 0) return nameOrder
    return left.usn.localeCompare(right.usn)
  })

  const menteeByStudentId = new Map<string, string>()
  for (const mentee of mentees) {
    const matchingStudents = studentRows.filter(student => student.usn === mentee.usn)
    for (const student of matchingStudents) {
      menteeByStudentId.set(student.studentId, mentee.id)
    }
  }

  const offeringCodeById = Object.fromEntries(academicOfferings.map(offering => [offering.offId, offering.code]))
  const offeringIdsByFacultyId = new Map<string, string[]>()
  for (const ownership of ownershipRows) {
    offeringIdsByFacultyId.set(ownership.facultyId, [...(offeringIdsByFacultyId.get(ownership.facultyId) ?? []), ownership.offeringId])
  }
  const menteeIdsByFacultyId = new Map<string, string[]>()
  for (const assignment of activeMentorAssignmentByStudentId.values()) {
    const menteeId = menteeByStudentId.get(assignment.studentId)
    if (!menteeId) continue
    menteeIdsByFacultyId.set(assignment.facultyId, [...(menteeIdsByFacultyId.get(assignment.facultyId) ?? []), menteeId])
  }

  const faculty = facultyRows
    .map(row => {
      const user = userById[row.userId]
      const grants = roleGrantRows.filter(grant => grant.facultyId === row.facultyId)
      const allowedRoles = dedupeRoles(grants.map(grant => grant.roleCode))
      if (allowedRoles.length === 0) return null
      const primaryAppointment = primaryAppointmentByFacultyId.get(row.facultyId)
      const appointmentDepartment = primaryAppointment ? departmentById[primaryAppointment.departmentId] : undefined
      const offeringIds = Array.from(new Set(offeringIdsByFacultyId.get(row.facultyId) ?? []))
      const courseCodes = Array.from(new Set(offeringIds.map(offeringId => offeringCodeById[offeringId]).filter((value): value is string => !!value)))
      const nextMenteeIds = Array.from(new Set(menteeIdsByFacultyId.get(row.facultyId) ?? []))
      nextMenteeIds.sort((left, right) => {
        return left.localeCompare(right)
      })
      return {
        facultyId: row.facultyId,
        username: String(user?.username ?? row.facultyId),
        name: String(row.displayName || row.facultyId),
        initials: buildInitials(row.displayName),
        email: String(user?.email ?? `${row.facultyId}@airmentor.local`),
        dept: String(appointmentDepartment?.code ?? 'GEN'),
        roleTitle: String(row.designation || 'Faculty'),
        allowedRoles,
        courseCodes,
        offeringIds,
        menteeIds: nextMenteeIds,
      }
    })
    .filter((value): value is NonNullable<typeof value> => !!value)

  const yearGroups = ['1st Year', '2nd Year', '3rd Year', '4th Year']
    .map(year => ({
      year,
      color: ({ '1st Year': '#f59e0b', '2nd Year': '#6366f1', '3rd Year': '#10b981', '4th Year': '#ec4899' } as Record<string, string>)[year] ?? '#8892a4',
      stageInfo: academicOfferings.find(offering => offering.year === year)?.stageInfo ?? { stage: 1, label: 'Stage 1', desc: 'Term Start → TT1', color: '#f97316' },
      offerings: academicOfferings.filter(offering => offering.year === year),
    }))
    .filter(group => group.offerings.length > 0)

  const teachers = faculty.map(account => {
    const offerings = academicOfferings.filter(offering => account.offeringIds.includes(offering.offId))
    const studentsCount = offerings.reduce((sum, offering) => sum + (studentsByOffering[offering.offId]?.length ?? 0), 0)
    const highRisk = offerings.reduce((sum, offering) => sum + (studentsByOffering[offering.offId] ?? []).filter(student => student.riskBand === 'High').length, 0)
    const avgAtt = offerings.length > 0
      ? Math.round(offerings.reduce((sum, offering) => sum + offering.attendance, 0) / offerings.length)
      : 0
    const completenessChecks = offerings.flatMap(offering => [offering.tt1Locked ? 1 : 0, offering.tt2Locked ? 1 : 0, offering.quizLocked ? 1 : 0, offering.asgnLocked ? 1 : 0])
    const completeness = completenessChecks.length > 0
      ? Math.round((completenessChecks.reduce((sum, value) => sum + value, 0) / completenessChecks.length) * 100)
      : 0
    return {
      id: account.facultyId,
      name: account.name,
      initials: account.initials,
      dept: account.dept,
      role: account.roleTitle,
      roles: account.allowedRoles,
      offerings: offerings.length,
      students: studentsCount,
      highRisk,
      avgAtt,
      completeness,
      pendingTasks: offerings.filter(offering => !!offering.pendingAction).length,
    }
  })

  const subjectRuns = Object.values(academicOfferings.reduce<Record<string, typeof academicOfferings>>((acc, offering) => {
    const key = `${offering.code}::${offering.year}::${offering.sem}`
    acc[key] = [...(acc[key] ?? []), offering]
    return acc
  }, {})).map((grouped, index) => {
    const sample = grouped[0]
    const sectionOfferingIds = grouped.map(item => item.offId)
    const courseLeaderFacultyIds = faculty
      .filter(account => account.allowedRoles.includes('Course Leader') && account.courseCodes.includes(sample.code))
      .map(account => account.facultyId)
    const scheme = resolvedSchemesByOfferingId.get(sample.offId) ?? buildDefaultSchemeFromPolicy(resolvedPolicyByOfferingId.get(sample.offId) ?? DEFAULT_POLICY)
    return {
      subjectRunId: `run-${sample.code}-${sample.year.replace(/\s+/g, '').toLowerCase()}-s${sample.sem}-${index + 1}`,
      code: sample.code,
      title: sample.title,
      year: sample.year,
      dept: sample.dept,
      sem: sample.sem,
      sectionOfferingIds,
      courseLeaderFacultyIds,
      scheme: {
        subjectRunId: `run-${sample.code}-${sample.year.replace(/\s+/g, '').toLowerCase()}-s${sample.sem}-${index + 1}`,
        status: scheme.status,
        finalsMax: scheme.finalsMax,
        quizWeight: scheme.quizWeight,
        assignmentWeight: scheme.assignmentWeight,
        quizCount: scheme.quizCount,
        assignmentCount: scheme.assignmentCount,
      },
    }
  })

  const viewerAccount = viewer.facultyId ? faculty.find(account => account.facultyId === viewer.facultyId) ?? null : null
  const viewerRole = viewer.roleCode ? toUiRole(viewer.roleCode) : null
  let visibleOfferingIds = new Set(academicOfferings.map(offering => offering.offId))
  let visibleFacultyIds = new Set(faculty.map(account => account.facultyId))
  let visibleStudentIds = new Set(studentRows.map(student => student.studentId))

  if (viewerAccount && viewerRole === 'Course Leader') {
    visibleOfferingIds = new Set(viewerAccount.offeringIds)
    visibleFacultyIds = new Set([viewerAccount.facultyId])
    visibleStudentIds = new Set(
      Array.from(visibleOfferingIds).flatMap(offeringId => {
        const studentsForOffering = studentsByOffering[offeringId] ?? []
        return studentsForOffering.map(student => student.id.split('::')[1] ?? student.id)
      }),
    )
  } else if (viewerAccount && viewerRole === 'Mentor') {
    const mentorAssignmentsForViewer = Array.from(activeMentorAssignmentByStudentId.values())
      .filter(assignment => assignment.facultyId === viewerAccount.facultyId)
    visibleOfferingIds = new Set(viewerAccount.offeringIds)
    visibleFacultyIds = new Set([viewerAccount.facultyId])
    visibleStudentIds = new Set(mentorAssignmentsForViewer.map(assignment => assignment.studentId))
  } else if (viewerAccount && viewerRole === 'HoD') {
    const hodAppointments = appointmentRows.filter(row => row.facultyId === viewerAccount.facultyId)
    const scopedDepartmentIds = new Set(hodAppointments.map(row => row.departmentId))
    const explicitBranchIds = new Set(hodAppointments.map(row => row.branchId).filter((value): value is string => !!value))
    const scopedBranchIds = new Set(
      branchRows
        .filter(row => scopedDepartmentIds.has(row.departmentId) || explicitBranchIds.has(row.branchId))
        .map(row => row.branchId),
    )
    const scopedTermIds = new Set(termRows.filter(row => scopedBranchIds.has(row.branchId)).map(row => row.termId))
    visibleOfferingIds = new Set(offeringRows.filter(row => scopedBranchIds.has(row.branchId) || scopedTermIds.has(row.termId)).map(row => row.offeringId))
    visibleStudentIds = new Set(
      enrollmentRows
        .filter(row => scopedBranchIds.has(row.branchId) || scopedTermIds.has(row.termId))
        .map(row => row.studentId),
    )
    visibleFacultyIds = new Set(
      appointmentRows
        .filter(row => scopedDepartmentIds.has(row.departmentId) || (row.branchId ? scopedBranchIds.has(row.branchId) : false))
        .map(row => row.facultyId),
    )
    visibleFacultyIds.add(viewerAccount.facultyId)
  }

  const playbackOfferingOverlayByOfferingId = new Map(
    stageOfferingProjectionRows.map(row => [row.offeringId, row] as const).filter((entry): entry is [string, typeof simulationStageOfferingProjections.$inferSelect] => !!entry[0]),
  )
  const filteredOfferings = academicOfferings
    .filter(offering => visibleOfferingIds.has(offering.offId))
    .map(offering => {
      const playback = playbackOfferingOverlayByOfferingId.get(offering.offId)
      if (!playback) return offering
      return {
        ...offering,
        stage: playback.stage,
        stageInfo: {
          ...offering.stageInfo,
          stage: playback.stage,
          label: playback.stageLabel,
          desc: playback.stageDescription,
        },
        pendingAction: playback.pendingAction,
      }
    })
  const filteredStudentsByOffering = Object.fromEntries(
    Object.entries(studentsByOffering)
      .filter(([offeringId]) => visibleOfferingIds.has(offeringId))
      .map(([offeringId, items]) => [
        offeringId,
        items.filter(student => visibleStudentIds.has(student.id.split('::')[1] ?? student.id)),
      ]),
  )
  const visibleUsns = new Set(studentRows.filter(student => visibleStudentIds.has(student.studentId)).map(student => student.usn))
  const filteredStudentHistoryByUsn = Object.fromEntries(
    Object.entries(studentHistoryByUsn).filter(([usn]) => visibleUsns.has(usn)),
  )
  const filteredFaculty = faculty.filter(account => visibleFacultyIds.has(account.facultyId))
  const filteredTeachers = teachers.filter(teacher => visibleFacultyIds.has(teacher.id))
  const filteredMentees = mentees.filter(mentee => visibleUsns.has(mentee.usn))
  const filteredYearGroups = yearGroups
    .map(group => ({
      ...group,
      offerings: group.offerings.filter(offering => visibleOfferingIds.has(offering.offId)),
    }))
    .filter(group => group.offerings.length > 0)
  const filteredSubjectRuns = subjectRuns.filter(subjectRun => subjectRun.sectionOfferingIds.some(offeringId => visibleOfferingIds.has(offeringId)))
  const filteredCoAttainmentByOffering = Object.fromEntries(
    Object.entries(coAttainmentByOffering).filter(([offeringId]) => visibleOfferingIds.has(offeringId)),
  )
  const filteredMeetings = authoritativeMeetings.filter(meeting => visibleStudentIds.has(meeting.studentId))

  const authoritativeStudentPatches = Object.fromEntries(
    Array.from(new Set([
      ...Array.from(latestAttendanceByStudentOffering.keys()),
      ...Array.from(latestAssessmentCellsByStudentOffering.keys()),
    ])).map(key => {
      const [studentId, offeringId] = key.split('::')
      const attendance = latestAttendanceByStudentOffering.get(key)
      const assessmentCells = latestAssessmentCellsByStudentOffering.get(key) ?? []
      const patch: Record<string, unknown> = {}
      if (attendance) {
        patch.present = attendance.presentClasses
        patch.totalClasses = attendance.totalClasses
      }
      for (const row of assessmentCells) {
        if (row.componentType === 'tt1_leaf' && row.componentCode) {
          const current = (patch.tt1LeafScores as Record<string, number> | undefined) ?? {}
          patch.tt1LeafScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if (row.componentType === 'tt2_leaf' && row.componentCode) {
          const current = (patch.tt2LeafScores as Record<string, number> | undefined) ?? {}
          patch.tt2LeafScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if ((row.componentType === 'quiz1' || row.componentType === 'quiz2') && row.componentCode) {
          const current = (patch.quizScores as Record<string, number> | undefined) ?? {}
          patch.quizScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if ((row.componentType === 'asgn1' || row.componentType === 'asgn2') && row.componentCode) {
          const current = (patch.assignmentScores as Record<string, number> | undefined) ?? {}
          patch.assignmentScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if (row.componentType === 'sem_end') {
          patch.seeScore = row.score
        }
      }
      return [`${offeringId}::${studentId}`, patch]
    }),
  )

  const authoritativeLockByOffering = Object.fromEntries(
    filteredOfferings.map(offering => {
      const runtimeLock = ((runtime.lockByOffering as Record<string, Record<string, boolean>>) ?? {})[offering.offId] ?? {}
      return [offering.offId, {
        tt1: !!offering.tt1Locked,
        tt2: !!offering.tt2Locked,
        quiz: !!offering.quizLocked,
        assignment: !!offering.asgnLocked,
        attendance: !!runtimeLock.attendance,
        finals: !!runtimeLock.finals,
      }]
    }),
  )

  const runtimeTasks = ((runtime.tasks as Array<Record<string, unknown>>) ?? [])
    .map(task => sharedTaskSchema.safeParse(task))
    .filter((result): result is { success: true; data: z.infer<typeof sharedTaskSchema> } => result.success)
    .map(result => result.data)

  const sourceTasks = authoritativeTasks.length > 0
    ? [
        ...authoritativeTasks,
        ...runtimeTasks.filter(task => !authoritativeTaskById.has(task.id)),
      ]
    : runtimeTasks

  const visibleTasks = sourceTasks.filter(task => {
    if (viewerRole && task.assignedTo !== viewerRole) return false
    if (visibleStudentIds.size > 0 && !visibleStudentIds.has(task.studentId)) return false
    if (visibleOfferingIds.size > 0 && !visibleOfferingIds.has(task.offeringId)) return false
    return true
  })
  const visibleTaskIds = new Set(visibleTasks.map(task => task.id))

  const runtimeTaskPlacements = Object.fromEntries(
    Object.entries((runtime.taskPlacements as Record<string, unknown>) ?? {})
      .flatMap(([taskId, placement]) => {
        const parsed = taskPlacementSchema.safeParse(placement)
        return parsed.success ? [[taskId, parsed.data]] : []
      }),
  )

  const resolvedTasksFromAuthoritativeRows = Object.fromEntries(
    visibleTasks
      .filter(task => task.status === 'Resolved')
      .map(task => [task.id, task.updatedAt ?? task.createdAt]),
  )

  const filteredTaskPlacements = Object.fromEntries(
    Array.from(visibleTaskIds).flatMap(taskId => {
      const nextPlacement = authoritativePlacementsByTaskId.get(taskId) ?? runtimeTaskPlacements[taskId]
      return nextPlacement ? [[taskId, nextPlacement]] : []
    }),
  )

  const runtimeCalendarAuditEvents = ((runtime.calendarAudit as Array<Record<string, unknown>>) ?? [])
    .map(event => calendarAuditEventSchema.safeParse(event))
    .filter((result): result is { success: true; data: z.infer<typeof calendarAuditEventSchema> } => result.success)
    .map(result => result.data)

  const currentFacultyTemplate = viewerAccount
    ? facultyCalendarTemplateByFacultyId.get(viewerAccount.facultyId)
      ?? facultyCalendarTemplateSchema.safeParse((runtime.timetableByFacultyId as Record<string, unknown>)?.[viewerAccount.facultyId]).data
    : null
  const currentFacultyAuditEvents = viewerAccount
    ? (calendarAuditByFacultyId.get(viewerAccount.facultyId) ?? [])
    : []
  const authoritativeAuditIds = new Set(currentFacultyAuditEvents.map(event => event.id))
  const mergedCalendarAuditEvents = viewerAccount
    ? [
        ...currentFacultyAuditEvents,
        ...runtimeCalendarAuditEvents.filter(event => event.facultyId === viewerAccount.facultyId && !authoritativeAuditIds.has(event.id)),
      ]
    : []

  const filteredRuntime = {
    ...runtime,
    studentPatches: Object.keys(authoritativeStudentPatches).length > 0
      ? Object.fromEntries(
          Object.entries(authoritativeStudentPatches).filter(([key]) => {
            const [, studentId] = key.split('::')
            return visibleStudentIds.has(studentId)
          }),
        )
      : runtime.studentPatches,
    tasks: visibleTasks,
    resolvedTasks: authoritativeTasks.length > 0
      ? resolvedTasksFromAuthoritativeRows
      : Object.fromEntries(Object.entries(runtime.resolvedTasks as Record<string, number>).filter(([taskId]) => visibleTaskIds.has(taskId))),
    lockByOffering: authoritativeLockByOffering,
    timetableByFacultyId: viewerAccount && currentFacultyTemplate
      ? { [viewerAccount.facultyId]: currentFacultyTemplate }
      : {},
    adminCalendarByFacultyId: viewerAccount ? Object.fromEntries(Object.entries(runtime.adminCalendarByFacultyId as Record<string, unknown>).filter(([facultyId]) => facultyId === viewerAccount.facultyId)) : {},
    taskPlacements: filteredTaskPlacements,
    calendarAudit: mergedCalendarAuditEvents,
  }

  const professor = buildProfessorProjection({
    faculty: filteredFaculty.length > 0 ? filteredFaculty : faculty,
    facultyId: viewer.facultyId,
    roleCode: viewer.roleCode,
  })

  return {
    professor,
    faculty: filteredFaculty,
    offerings: filteredOfferings,
    yearGroups: filteredYearGroups,
    mentees: filteredMentees,
    teachers: filteredTeachers,
    subjectRuns: filteredSubjectRuns,
    studentsByOffering: filteredStudentsByOffering,
    studentHistoryByUsn: filteredStudentHistoryByUsn,
    runtime: filteredRuntime,
    courseOutcomesByOffering: Object.fromEntries(filteredOfferings.map(offering => [offering.offId, resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []])),
    assessmentSchemesByOffering: Object.fromEntries(filteredOfferings.map(offering => [offering.offId, resolvedSchemesByOfferingId.get(offering.offId) ?? buildDefaultSchemeFromPolicy(resolvedPolicyByOfferingId.get(offering.offId) ?? DEFAULT_POLICY)])),
    questionPapersByOffering: Object.fromEntries(filteredOfferings.map(offering => [offering.offId, resolvedQuestionPapersByOfferingId.get(offering.offId) ?? { tt1: buildDefaultQuestionPaper('tt1', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []), tt2: buildDefaultQuestionPaper('tt2', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []) }])),
    coAttainmentByOffering: filteredCoAttainmentByOffering,
    meetings: filteredMeetings,
    proofPlayback: stageCheckpointRow ? {
      simulationStageCheckpointId: stageCheckpointRow.simulationStageCheckpointId,
      simulationRunId: stageCheckpointRow.simulationRunId,
      semesterNumber: stageCheckpointRow.semesterNumber,
      stageKey: stageCheckpointRow.stageKey,
      stageLabel: stageCheckpointRow.stageLabel,
      stageDescription: stageCheckpointRow.stageDescription,
      stageOrder: stageCheckpointRow.stageOrder,
      previousCheckpointId: stageCheckpointRow.previousCheckpointId,
      nextCheckpointId: stageCheckpointRow.nextCheckpointId,
    } : null,
  }
}

async function buildPublicFacultyList(context: RouteContext): Promise<PublicFacultyResponse> {
  const snapshot = await buildAcademicBootstrap(context)
  return publicFacultyResponseSchema.parse({
    items: snapshot.faculty.map(account => ({
      facultyId: account.facultyId,
      username: account.username,
      name: account.name,
      displayName: account.name,
      designation: account.roleTitle,
      dept: account.dept,
      departmentCode: account.dept,
      roleTitle: account.roleTitle,
      allowedRoles: account.allowedRoles,
    })),
  })
}

export async function registerAcademicRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/academic/public/faculty', {
    schema: {
      tags: ['academic'],
      summary: 'List academic faculty accounts for the teaching portal login selector',
    },
  }, async () => buildPublicFacultyList(context))

  app.get('/api/academic/bootstrap', {
    schema: {
      tags: ['academic'],
      summary: 'Return the full academic portal parity snapshot',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const query = parseOrThrow(academicBootstrapQuerySchema, request.query)
    if (query.simulationStageCheckpointId) {
      const [activeRun] = await context.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
      if (!activeRun) throw notFound('Active proof run not found')
      await resolveAcademicStageCheckpoint(context, auth, activeRun.simulationRunId, query.simulationStageCheckpointId)
    }
    return buildAcademicBootstrap(context, {
      facultyId: auth.facultyId ?? null,
      roleCode: auth.activeRoleGrant.roleCode ?? null,
      simulationStageCheckpointId: query.simulationStageCheckpointId,
    })
  })

  app.get('/api/academic/hod/proof-summary', {
    schema: {
      tags: ['academic'],
      summary: 'Return the live HoD proof summary sourced from the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const query = parseOrThrow(hodProofSummaryQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId: auth.facultyId,
      now: context.now(),
      filters: query,
    })
    return result.summary
  })

  app.get('/api/academic/hod/proof-bundle', {
    schema: {
      tags: ['academic'],
      summary: 'Return the full live HoD proof analytics bundle sourced from the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const query = parseOrThrow(hodProofReassessmentQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId: auth.facultyId,
      now: context.now(),
      filters: query,
    })
    return {
      summary: result.summary,
      courses: result.courses,
      faculty: result.faculty,
      students: result.students,
      reassessments: result.reassessments,
    }
  })

  app.get('/api/academic/hod/proof-courses', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD course hotspot rollups for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const query = parseOrThrow(hodProofCourseQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId: auth.facultyId,
      now: context.now(),
      filters: query,
    })
    return { items: result.courses }
  })

  app.get('/api/academic/hod/proof-faculty', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD faculty operations rollups for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const query = parseOrThrow(hodProofFacultyQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId: auth.facultyId,
      now: context.now(),
      filters: query,
    })
    return { items: result.faculty }
  })

  app.get('/api/academic/hod/proof-students', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD student watch rows for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const query = parseOrThrow(hodProofStudentQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId: auth.facultyId,
      now: context.now(),
      filters: query,
    })
    return { items: result.students }
  })

  app.get('/api/academic/hod/proof-reassessments', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD reassessment audit rows for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const query = parseOrThrow(hodProofReassessmentQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId: auth.facultyId,
      now: context.now(),
      filters: query,
    })
    return { items: result.reassessments }
  })

  app.post('/api/academic/proof-reassessments/:reassessmentEventId/acknowledge', {
    schema: {
      tags: ['academic'],
      summary: 'Acknowledge one proof reassessment without resolving it',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(proofReassessmentParamsSchema, request.params)
    const body = parseOrThrow(proofReassessmentAcknowledgeSchema, request.body ?? {})
    const { event, run, alert } = await resolveProofReassessmentAccess({
      context,
      auth,
      reassessmentEventId: params.reassessmentEventId,
    })
    if (!alert) throw badRequest('Proof reassessment has no matching alert decision to acknowledge')

    const now = context.now()
    const acknowledgementId = createId('alert_ack')
    await context.db.insert(alertAcknowledgements).values({
      alertAcknowledgementId: acknowledgementId,
      alertDecisionId: alert.alertDecisionId,
      batchId: run.batchId,
      acknowledgedByFacultyId: auth.facultyId ?? null,
      status: 'Acknowledged',
      note: body.note ?? null,
      createdAt: now,
      updatedAt: now,
    })
    await context.db.update(alertOutcomes).set({
      outcomeStatus: 'Acknowledged',
      acknowledgedByFacultyId: auth.facultyId ?? null,
      acknowledgedAt: now,
      outcomeNote: body.note ?? null,
      updatedAt: now,
    }).where(eq(alertOutcomes.alertDecisionId, alert.alertDecisionId))

    const response = {
      reassessmentEventId: event.reassessmentEventId,
      acknowledgement: {
        acknowledgementId,
        alertDecisionId: alert.alertDecisionId,
        acknowledgedByFacultyId: auth.facultyId ?? null,
        status: 'Acknowledged',
        note: body.note ?? null,
        createdAt: now,
      },
    }
    await emitAuditEvent(context, {
      entityType: 'proof_reassessment',
      entityId: event.reassessmentEventId,
      action: 'ACKNOWLEDGE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      metadata: response,
    })
    return response
  })

  app.post('/api/academic/proof-reassessments/:reassessmentEventId/resolve', {
    schema: {
      tags: ['academic'],
      summary: 'Resolve one proof reassessment with a bounded outcome classification',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(proofReassessmentParamsSchema, request.params)
    const body = parseOrThrow(proofReassessmentResolveSchema, request.body ?? {})
    const { event, run, alert } = await resolveProofReassessmentAccess({
      context,
      auth,
      reassessmentEventId: params.reassessmentEventId,
    })

    const outcome = body.outcome
    const now = context.now()
    const resolutionJson = {
      outcome,
      temporaryResponseCredit: proofResolutionCreditByOutcome[outcome],
      recoveryState: proofResolutionRecoveryState(outcome),
      queueCaseId: String(parseJson(event.payloadJson, {} as Record<string, unknown>).queueCaseId ?? ''),
      actorRole: auth.activeRoleGrant.roleCode,
      resolvedAt: now,
      version: 1,
    }
    const resolutionId = createId('reassessment_resolution')
    await context.db.insert(reassessmentResolutions).values({
      reassessmentResolutionId: resolutionId,
      reassessmentEventId: event.reassessmentEventId,
      batchId: run.batchId,
      resolvedByFacultyId: auth.facultyId ?? null,
      resolutionStatus: 'Resolved',
      note: body.note ?? null,
      resolutionJson: stringifyJson(resolutionJson),
      createdAt: now,
      updatedAt: now,
    })
    await context.db.update(reassessmentEvents).set({
      status: 'Resolved',
      payloadJson: stringifyJson({
        ...parseJson(event.payloadJson, {} as Record<string, unknown>),
        recoveryState: resolutionJson.recoveryState,
        lastResolutionOutcome: outcome,
        temporaryResponseCredit: resolutionJson.temporaryResponseCredit,
        resolvedAt: now,
      }),
      updatedAt: now,
    }).where(eq(reassessmentEvents.reassessmentEventId, event.reassessmentEventId))
    if (alert) {
      await context.db.update(alertOutcomes).set({
        outcomeStatus: 'Resolved',
        outcomeNote: body.note ?? null,
        updatedAt: now,
      }).where(eq(alertOutcomes.alertDecisionId, alert.alertDecisionId))
    }

    const response = {
      reassessmentEventId: event.reassessmentEventId,
      resolution: {
        reassessmentResolutionId: resolutionId,
        resolutionStatus: 'Resolved',
        note: body.note ?? null,
        resolutionJson,
        createdAt: now,
      },
    }
    await emitAuditEvent(context, {
      entityType: 'proof_reassessment',
      entityId: event.reassessmentEventId,
      action: 'RESOLVE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      metadata: response,
    })
    return response
  })

  app.get('/api/academic/student-shell/students/:studentId/card', {
    schema: {
      tags: ['academic'],
      summary: 'Return the deterministic student-agent card for one proof-scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const query = parseOrThrow(studentShellQuerySchema, request.query)
    const run = await resolveStudentShellRun(context, auth, query.simulationRunId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, query.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId)
    return buildStudentAgentCard(context.db, {
      simulationRunId: run.simulationRunId,
      studentId: params.studentId,
      simulationStageCheckpointId: query.simulationStageCheckpointId,
    })
  })

  app.get('/api/academic/students/:studentId/risk-explorer', {
    schema: {
      tags: ['academic'],
      summary: 'Return the proof-backed student risk explorer payload for one scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const query = parseOrThrow(studentShellQuerySchema, request.query)
    const run = await resolveStudentShellRun(context, auth, query.simulationRunId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, query.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId)
    return buildStudentRiskExplorer(context.db, {
      simulationRunId: run.simulationRunId,
      studentId: params.studentId,
      simulationStageCheckpointId: query.simulationStageCheckpointId,
    })
  })

  app.get('/api/academic/student-shell/students/:studentId/timeline', {
    schema: {
      tags: ['academic'],
      summary: 'Return the deterministic student-agent timeline for one proof-scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const query = parseOrThrow(studentShellQuerySchema, request.query)
    const run = await resolveStudentShellRun(context, auth, query.simulationRunId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, query.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId)
    return {
      items: await listStudentAgentTimeline(context.db, {
        simulationRunId: run.simulationRunId,
        studentId: params.studentId,
        simulationStageCheckpointId: query.simulationStageCheckpointId,
      }),
    }
  })

  app.post('/api/academic/student-shell/students/:studentId/sessions', {
    schema: {
      tags: ['academic'],
      summary: 'Start a deterministic student-agent session for one proof-scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(studentShellSessionCreateSchema, request.body ?? {})
    const run = await resolveStudentShellRun(context, auth, body.simulationRunId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, body.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId)
    return startStudentAgentSession(context.db, {
      simulationRunId: run.simulationRunId,
      simulationStageCheckpointId: body.simulationStageCheckpointId,
      studentId: params.studentId,
      viewerFacultyId: auth.facultyId,
      viewerRole: auth.activeRoleGrant.roleCode,
    })
  })

  app.post('/api/academic/student-shell/sessions/:sessionId/messages', {
    schema: {
      tags: ['academic'],
      summary: 'Send a bounded deterministic message to the student-agent shell',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ sessionId: z.string().min(1) }), request.params)
    const body = parseOrThrow(studentShellMessageSchema, request.body)
    const [session] = await context.db.select().from(studentAgentSessions).where(eq(studentAgentSessions.studentAgentSessionId, params.sessionId))
    if (!session) throw notFound('Student shell session not found')
    if (auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      if (!auth.facultyId || session.viewerFacultyId !== auth.facultyId || session.viewerRole !== auth.activeRoleGrant.roleCode) {
        throw forbidden('Student shell session is outside the current faculty scope')
      }
      const [activeRun] = await context.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
      if (!activeRun || activeRun.simulationRunId !== session.simulationRunId) {
        throw forbidden('Academic roles may send shell messages only for the active proof run')
      }
    }
    return {
      items: await sendStudentAgentMessage(context.db, {
        studentAgentSessionId: params.sessionId,
        prompt: body.prompt,
      }),
    }
  })

  app.put('/api/academic/runtime/:stateKey', {
    schema: {
      tags: ['academic'],
      summary: 'Persist a single academic runtime slice',
    },
  }, async request => {
    requireRole(request, [...academicRoleCodes])
    const auth = requireAuth(request)
    const params = parseOrThrow(z.object({ stateKey: runtimeStateKeySchema }), request.params)
    const body = parseOrThrow(runtimeSliceSchemas[params.stateKey] as z.ZodTypeAny, request.body)
    const [current] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, params.stateKey))
    if (current) {
      await context.db.update(academicRuntimeState).set({
        payloadJson: stringifyJson(body),
        version: current.version + 1,
        updatedAt: context.now(),
      }).where(eq(academicRuntimeState.stateKey, params.stateKey))
    } else {
      await context.db.insert(academicRuntimeState).values({
        stateKey: params.stateKey,
        payloadJson: stringifyJson(body),
        version: 1,
        updatedAt: context.now(),
      })
    }
    await emitAuditEvent(context, {
      entityType: 'academic_runtime_state',
      entityId: params.stateKey,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      metadata: { stateKey: params.stateKey },
    })
    return { ok: true, stateKey: params.stateKey }
  })

  app.put('/api/academic/tasks/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the authoritative academic action queue projection for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(taskSyncSchema, request.body)
    const now = context.now()

    for (const task of body.tasks) {
      const normalizedTask = {
        ...task,
        studentId: normalizeAcademicStudentId(task.studentId),
      }
      await assertViewerCanManageTask(context, auth, normalizedTask)
      const [current] = await context.db.select().from(academicTasks).where(eq(academicTasks.taskId, task.id))
      if (current) {
        const currentTransitions = await context.db
          .select()
          .from(academicTaskTransitions)
          .where(eq(academicTaskTransitions.taskId, task.id))
          .orderBy(asc(academicTaskTransitions.occurredAt))
        const currentTask = mapAcademicTaskRow(current, currentTransitions.map(mapTaskTransitionRow))
        if (currentTask.dismissal && !task.dismissal) {
          const restoreWindowEndsAt = currentTask.dismissal.dismissedAt + (60 * 24 * 60 * 60 * 1000)
          if (restoreWindowEndsAt < Date.now()) {
            throw forbidden('The restore window for this queue item has expired')
          }
        }
        await context.db.update(academicTasks).set({
          studentId: normalizedTask.studentId,
          offeringId: normalizedTask.offeringId,
          assignedToRole: normalizedTask.assignedTo,
          taskType: normalizedTask.taskType ?? 'Follow-up',
          status: normalizedTask.status,
          title: normalizedTask.title,
          dueLabel: normalizedTask.due,
          dueDateIso: normalizedTask.dueDateISO ?? null,
          riskProbScaled: Math.round(normalizedTask.riskProb * 100),
          riskBand: normalizedTask.riskBand,
          priority: normalizedTask.priority,
          payloadJson: stringifyJson(normalizedTask),
          updatedByFacultyId: auth.facultyId,
          version: current.version + 1,
          updatedAt: now,
        }).where(eq(academicTasks.taskId, task.id))
      } else {
        await context.db.insert(academicTasks).values({
          taskId: task.id,
          studentId: normalizedTask.studentId,
          offeringId: normalizedTask.offeringId,
          assignedToRole: normalizedTask.assignedTo,
          taskType: normalizedTask.taskType ?? 'Follow-up',
          status: normalizedTask.status,
          title: normalizedTask.title,
          dueLabel: normalizedTask.due,
          dueDateIso: normalizedTask.dueDateISO ?? null,
          riskProbScaled: Math.round(normalizedTask.riskProb * 100),
          riskBand: normalizedTask.riskBand,
          priority: normalizedTask.priority,
          payloadJson: stringifyJson(normalizedTask),
          createdByFacultyId: auth.facultyId,
          updatedByFacultyId: auth.facultyId,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
      }

      const existingTransitions = await context.db
        .select()
        .from(academicTaskTransitions)
        .where(eq(academicTaskTransitions.taskId, task.id))
      const existingTransitionIds = new Set(existingTransitions.map(row => row.transitionId))
      const missingTransitions = (task.transitionHistory ?? []).filter(transition => !existingTransitionIds.has(transition.id))
      for (const transition of missingTransitions) {
        await context.db.insert(academicTaskTransitions).values({
          transitionId: transition.id,
          taskId: task.id,
          actorRole: transition.actorRole,
          actorFacultyId: transition.actorTeacherId ?? null,
          action: transition.action,
          fromOwner: transition.fromOwner ?? null,
          toOwner: transition.toOwner,
          note: transition.note,
          occurredAt: millisToIso(transition.at, now),
        })
      }
    }

    await emitAuditEvent(context, {
      entityType: 'academic_task_sync',
      entityId: auth.facultyId,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: { taskCount: body.tasks.length },
    })
    return { ok: true, count: body.tasks.length }
  })

  app.put('/api/academic/task-placements/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist task placements for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(taskPlacementSyncSchema, request.body)
    const now = context.now()

    for (const [taskId, placement] of Object.entries(body.placements)) {
      if (placement.taskId !== taskId) {
        throw badRequest('Task placement payload does not match its record key')
      }
      const [taskRow] = await context.db.select().from(academicTasks).where(eq(academicTasks.taskId, taskId))
      if (!taskRow) throw notFound('Task not found for placement')
      const task = mapAcademicTaskRow(taskRow, [])
      await assertViewerCanManageTask(context, auth, task)
      if (placement.placementMode === 'timed') {
        if (
          typeof placement.startMinutes !== 'number'
          || typeof placement.endMinutes !== 'number'
          || placement.startMinutes >= placement.endMinutes
        ) {
          throw badRequest('Timed task placements must include a valid start and end range')
        }
      }
      const [current] = await context.db
        .select()
        .from(academicTaskPlacements)
        .where(eq(academicTaskPlacements.taskId, taskId))
      if (current) {
        await context.db.update(academicTaskPlacements).set({
          facultyId: auth.facultyId,
          dateIso: placement.dateISO,
          placementMode: placement.placementMode,
          startMinutes: placement.startMinutes ?? null,
          endMinutes: placement.endMinutes ?? null,
          slotId: placement.slotId ?? null,
          startTime: placement.startTime ?? null,
          endTime: placement.endTime ?? null,
          updatedAt: now,
        }).where(eq(academicTaskPlacements.taskId, taskId))
      } else {
        await context.db.insert(academicTaskPlacements).values({
          taskId,
          facultyId: auth.facultyId,
          dateIso: placement.dateISO,
          placementMode: placement.placementMode,
          startMinutes: placement.startMinutes ?? null,
          endMinutes: placement.endMinutes ?? null,
          slotId: placement.slotId ?? null,
          startTime: placement.startTime ?? null,
          endTime: placement.endTime ?? null,
          updatedAt: now,
        })
      }
    }

    await emitAuditEvent(context, {
      entityType: 'academic_task_placement_sync',
      entityId: auth.facultyId,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: { placementCount: Object.keys(body.placements).length },
    })
    return { ok: true, count: Object.keys(body.placements).length }
  })

  app.put('/api/academic/calendar-audit/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist faculty calendar audit events',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(calendarAuditSyncSchema, request.body)
    for (const event of body.events) {
      if (event.facultyId !== auth.facultyId) {
        throw forbidden('Calendar audit events can only be persisted for the active faculty')
      }
      const [current] = await context.db
        .select()
        .from(academicCalendarAuditEvents)
        .where(eq(academicCalendarAuditEvents.auditEventId, event.id))
      if (current) continue
      await context.db.insert(academicCalendarAuditEvents).values({
        auditEventId: event.id,
        facultyId: auth.facultyId,
        payloadJson: stringifyJson(event),
        createdAt: millisToIso(event.timestamp, context.now()),
      })
    }
    return { ok: true, count: body.events.length }
  })

  app.put('/api/academic/faculty-calendar-workspace/:facultyId', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the faculty-owned timetable workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(facultyCalendarWorkspaceUpsertSchema, request.body)
    if (auth.facultyId !== params.facultyId) {
      throw forbidden('You can only edit your own timetable workspace')
    }
    await validateFacultyCalendarTemplate(context, params.facultyId, body.template)
    const { directEditWindowEndsAt, classEditingLocked } = await getEditableCalendarWindowStatus(context, params.facultyId)
    const [current] = await context.db
      .select()
      .from(facultyCalendarWorkspaces)
      .where(eq(facultyCalendarWorkspaces.facultyId, params.facultyId))
    const currentTemplate = current ? mapFacultyCalendarWorkspaceRow(current) : null
    if (classEditingLocked && stringifyJson(currentTemplate) !== stringifyJson(body.template)) {
      throw forbidden('The direct class editing window has ended for this faculty timetable')
    }

    const now = context.now()
    if (current) {
      await context.db.update(facultyCalendarWorkspaces).set({
        templateJson: stringifyJson(body.template),
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(facultyCalendarWorkspaces.facultyId, params.facultyId))
    } else {
      await context.db.insert(facultyCalendarWorkspaces).values({
        facultyId: params.facultyId,
        templateJson: stringifyJson(body.template),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const timetablePayload = await getAcademicRuntimeState(context, 'timetableByFacultyId') as Record<string, unknown>
    await saveAcademicRuntimeState(context, 'timetableByFacultyId', {
      ...timetablePayload,
      [params.facultyId]: body.template,
    })

    const [saved] = await context.db
      .select()
      .from(facultyCalendarWorkspaces)
      .where(eq(facultyCalendarWorkspaces.facultyId, params.facultyId))
    await emitAuditEvent(context, {
      entityType: 'faculty_calendar_workspace',
      entityId: params.facultyId,
      action: current ? 'UPDATE' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: currentTemplate,
      after: body.template,
      metadata: { directEditWindowEndsAt, classEditingLocked },
    })
    return {
      facultyId: params.facultyId,
      template: body.template,
      version: saved?.version ?? 1,
      directEditWindowEndsAt,
      classEditingLocked,
    }
  })

  app.post('/api/academic/meetings', {
    schema: {
      tags: ['academic'],
      summary: 'Create a faculty meeting with a supervised student',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(academicMeetingCreateSchema, request.body)
    validateMeetingWindow(body.startMinutes, body.endMinutes)
    const { studentId } = await assertViewerCanSuperviseStudent({
      context,
      auth,
      studentId: body.studentId,
      offeringId: body.offeringId ?? null,
    })

    if (body.offeringId) {
      const { offering } = await getOfferingContext(context, body.offeringId)
      await assertStudentEnrolledInOffering(context, offering, studentId)
    }

    const now = context.now()
    const meetingId = createId('meeting')
    await context.db.insert(academicMeetings).values({
      meetingId,
      facultyId: auth.facultyId,
      studentId,
      offeringId: body.offeringId ?? null,
      title: body.title,
      notes: body.notes ?? null,
      dateIso: body.dateISO,
      startMinutes: body.startMinutes,
      endMinutes: body.endMinutes,
      status: body.status,
      createdByFacultyId: auth.facultyId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    const [saved] = await context.db
      .select()
      .from(academicMeetings)
      .where(eq(academicMeetings.meetingId, meetingId))
    if (!saved) throw notFound('Meeting could not be created')
    const response = await buildAcademicMeetingResponse(context, saved)
    await emitAuditEvent(context, {
      entityType: 'academic_meeting',
      entityId: meetingId,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: response,
    })
    return response
  })

  app.patch('/api/academic/meetings/:meetingId', {
    schema: {
      tags: ['academic'],
      summary: 'Update a faculty meeting with a supervised student',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(academicMeetingParamsSchema, request.params)
    const body = parseOrThrow(academicMeetingPatchSchema, request.body)
    validateMeetingWindow(body.startMinutes, body.endMinutes)
    const [current] = await context.db
      .select()
      .from(academicMeetings)
      .where(eq(academicMeetings.meetingId, params.meetingId))
    if (!current) throw notFound('Meeting not found')
    if (current.facultyId !== auth.facultyId) {
      throw forbidden('You can only update meetings owned by the active faculty')
    }
    expectVersion(current.version, body.version, 'meeting', current)
    const { studentId } = await assertViewerCanSuperviseStudent({
      context,
      auth,
      studentId: body.studentId,
      offeringId: body.offeringId ?? current.offeringId ?? null,
    })
    if (body.offeringId) {
      const { offering } = await getOfferingContext(context, body.offeringId)
      await assertStudentEnrolledInOffering(context, offering, studentId)
    }

    await context.db.update(academicMeetings).set({
      studentId,
      offeringId: body.offeringId ?? null,
      title: body.title,
      notes: body.notes ?? null,
      dateIso: body.dateISO,
      startMinutes: body.startMinutes,
      endMinutes: body.endMinutes,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(academicMeetings.meetingId, params.meetingId))
    const [saved] = await context.db
      .select()
      .from(academicMeetings)
      .where(eq(academicMeetings.meetingId, params.meetingId))
    if (!saved) throw notFound('Meeting not found after update')
    const beforeResponse = await buildAcademicMeetingResponse(context, current)
    const response = await buildAcademicMeetingResponse(context, saved)
    await emitAuditEvent(context, {
      entityType: 'academic_meeting',
      entityId: params.meetingId,
      action: 'UPDATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: beforeResponse,
      after: response,
    })
    return response
  })

  app.put('/api/academic/offerings/:offeringId/attendance', {
    schema: {
      tags: ['academic'],
      summary: 'Persist offering attendance entries from the teaching workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(offeringParamsSchema, request.params)
    const body = parseOrThrow(attendanceCommitSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering } = await getOfferingContext(context, params.offeringId)
    const capturedAt = body.capturedAt ?? context.now()
    const now = context.now()

    for (const entry of body.entries) {
      if (entry.presentClasses > entry.totalClasses) {
        throw badRequest('Present classes cannot exceed total classes')
      }
      const enrollment = await assertStudentEnrolledInOffering(context, offering, entry.studentId)
      await context.db.insert(studentAttendanceSnapshots).values({
        attendanceSnapshotId: createId('attendance'),
        studentId: enrollment.studentId,
        offeringId: params.offeringId,
        presentClasses: entry.presentClasses,
        totalClasses: entry.totalClasses,
        attendancePercent: Math.round((entry.presentClasses / Math.max(1, entry.totalClasses)) * 100),
        source: 'teacher-workspace',
        capturedAt,
        createdAt: now,
        updatedAt: now,
      })
    }

    const averageAttendance = body.entries.length > 0
      ? Math.round(body.entries.reduce((sum, entry) => sum + ((entry.presentClasses / Math.max(1, entry.totalClasses)) * 100), 0) / body.entries.length)
      : offering.attendance

    await context.db.update(sectionOfferings).set({
      attendance: averageAttendance,
      version: offering.version + 1,
      updatedAt: now,
    }).where(eq(sectionOfferings.offeringId, params.offeringId))

    if (body.lock) {
      const currentLockPayload = await getAcademicRuntimeState(context, 'lockByOffering') as Record<string, Record<string, boolean>>
      await saveAcademicRuntimeState(context, 'lockByOffering', {
        ...currentLockPayload,
        [params.offeringId]: {
          ...(currentLockPayload[params.offeringId] ?? {}),
          attendance: true,
        },
      })
    }

    await emitAuditEvent(context, {
      entityType: 'offering_attendance_commit',
      entityId: params.offeringId,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: {
        entryCount: body.entries.length,
        capturedAt,
        locked: !!body.lock,
      },
    })
    return {
      ok: true,
      offeringId: params.offeringId,
      capturedAt,
      averageAttendance,
      locked: !!body.lock,
    }
  })

  app.put('/api/academic/offerings/:offeringId/assessment-entries/:kind', {
    schema: {
      tags: ['academic'],
      summary: 'Persist offering assessment entry rows from the teaching workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(assessmentCommitParamsSchema, request.params)
    const body = parseOrThrow(assessmentCommitSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering, term, course, department } = await getOfferingContext(context, params.offeringId)
    const policy = term.batchId ? (await resolveBatchPolicy(context, term.batchId)).effectivePolicy : DEFAULT_POLICY
    const schemeRow = await context.db
      .select()
      .from(offeringAssessmentSchemes)
      .where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))
      .then(rows => rows[0] ?? null)
    const scheme = schemeRow
      ? canonicalizeSchemeState(schemeStateSchema.parse(parseJson(schemeRow.schemeJson, {})), policy)
      : buildDefaultSchemeFromPolicy(policy)
    const evaluatedAt = body.evaluatedAt ?? context.now()
    const now = context.now()

    const lockField = params.kind === 'tt1'
      ? 'tt1Locked'
      : params.kind === 'tt2'
        ? 'tt2Locked'
        : params.kind === 'quiz'
          ? 'quizLocked'
          : params.kind === 'assignment'
            ? 'assignmentLocked'
            : null
    if (lockField && offering[lockField] === 1) {
      throw forbidden('This assessment dataset is locked')
    }

    let allowedComponents = new Map<string, { maxScore: number; storageType: string }>()
    if (params.kind === 'tt1' || params.kind === 'tt2') {
      const courseOutcomeRows = await context.db
        .select()
        .from(courseOutcomeOverrides)
        .where(and(
          eq(courseOutcomeOverrides.courseId, offering.courseId),
          eq(courseOutcomeOverrides.status, 'active'),
        ))
      const resolvedOutcomes = resolveCourseOutcomesForOffering({
        institutionId: department.institutionId,
        branchId: offering.branchId,
        batchId: term.batchId,
        offeringId: offering.offeringId,
        courseId: offering.courseId,
        courseCode: course.courseCode,
        courseTitle: course.title,
        overrides: courseOutcomeRows,
      })
      const [paperRow] = await context.db
        .select()
        .from(offeringQuestionPapers)
        .where(and(
          eq(offeringQuestionPapers.offeringId, params.offeringId),
          eq(offeringQuestionPapers.kind, params.kind),
        ))
      const blueprint = paperRow
        ? termTestBlueprintSchema.parse(parseJson(paperRow.blueprintJson, {}))
        : buildDefaultQuestionPaper(params.kind, resolvedOutcomes)
      for (const leaf of flattenTermTestLeaves(blueprint.nodes)) {
        allowedComponents.set(leaf.id, { maxScore: leaf.maxMarks, storageType: `${params.kind}_leaf` })
      }
    } else if (params.kind === 'quiz') {
      scheme.quizComponents.forEach((component, index) => {
        allowedComponents.set(component.id, { maxScore: component.rawMax, storageType: `quiz${index + 1}` })
      })
    } else if (params.kind === 'assignment') {
      scheme.assignmentComponents.forEach((component, index) => {
        allowedComponents.set(component.id, { maxScore: component.rawMax, storageType: `asgn${index + 1}` })
      })
    } else {
      allowedComponents.set('see', { maxScore: scheme.finalsMax, storageType: 'sem_end' })
    }

    for (const entry of body.entries) {
      const enrollment = await assertStudentEnrolledInOffering(context, offering, entry.studentId)
      let aggregateScore = 0
      let aggregateMax = 0
      for (const component of entry.components) {
        const allowed = allowedComponents.get(component.componentCode)
        if (!allowed) {
          throw badRequest('Assessment entry references a component outside the configured scheme', {
            componentCode: component.componentCode,
            kind: params.kind,
          })
        }
        if (component.maxScore > allowed.maxScore || component.score > component.maxScore) {
          throw badRequest('Assessment entry exceeds the configured component max score', {
            componentCode: component.componentCode,
            allowedMax: allowed.maxScore,
          })
        }
        aggregateScore += component.score
        aggregateMax += component.maxScore
        await context.db.insert(studentAssessmentScores).values({
          assessmentScoreId: createId('assessment'),
          studentId: enrollment.studentId,
          offeringId: params.offeringId,
          termId: term.termId,
          componentType: allowed.storageType,
          componentCode: component.componentCode,
          score: component.score,
          maxScore: component.maxScore,
          evaluatedAt,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (params.kind === 'tt1' || params.kind === 'tt2') {
        await context.db.insert(studentAssessmentScores).values({
          assessmentScoreId: createId('assessment'),
          studentId: enrollment.studentId,
          offeringId: params.offeringId,
          termId: term.termId,
          componentType: params.kind,
          componentCode: null,
          score: aggregateScore,
          maxScore: aggregateMax,
          evaluatedAt,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    if (params.kind === 'tt1' || params.kind === 'tt2' || body.lock) {
      const nextOfferingPatch: Partial<typeof sectionOfferings.$inferInsert> = {
        ...(params.kind === 'tt1' ? { tt1Done: 1 } : {}),
        ...(params.kind === 'tt2' ? { tt2Done: 1 } : {}),
        version: offering.version + 1,
        updatedAt: now,
      }
      if (body.lock && lockField) nextOfferingPatch[lockField] = 1
      if (Object.keys(nextOfferingPatch).length > 0) {
        await context.db.update(sectionOfferings).set(nextOfferingPatch).where(eq(sectionOfferings.offeringId, params.offeringId))
      }
    }

    if (body.lock && !lockField) {
      const currentLockPayload = await getAcademicRuntimeState(context, 'lockByOffering') as Record<string, Record<string, boolean>>
      await saveAcademicRuntimeState(context, 'lockByOffering', {
        ...currentLockPayload,
        [params.offeringId]: {
          ...(currentLockPayload[params.offeringId] ?? {}),
          finals: true,
        },
      })
    }

    await emitAuditEvent(context, {
      entityType: 'offering_assessment_commit',
      entityId: `${params.offeringId}:${params.kind}`,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: {
        kind: params.kind,
        offeringId: params.offeringId,
        entryCount: body.entries.length,
        evaluatedAt,
        locked: !!body.lock,
      },
    })
    return {
      ok: true,
      offeringId: params.offeringId,
      kind: params.kind,
      evaluatedAt,
      locked: !!body.lock,
    }
  })

  app.get('/api/admin/course-outcomes', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List scoped course outcome overrides',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(courseOutcomeOverrideListQuerySchema, request.query)
    const rows = await context.db.select().from(courseOutcomeOverrides).orderBy(asc(courseOutcomeOverrides.createdAt))
    const items = rows
      .filter(row => !query.courseId || row.courseId === query.courseId)
      .filter(row => !query.scopeType || row.scopeType === query.scopeType)
      .filter(row => !query.scopeId || row.scopeId === query.scopeId)
      .map(mapCourseOutcomeOverride)
    return { items }
  })

  app.post('/api/admin/course-outcomes', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a scoped course outcome override',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(courseOutcomeOverrideCreateSchema, request.body)
    const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
    if (!course) throw notFound('Course not found')
    await assertCourseOutcomeScopeExists(context, body.scopeType, body.scopeId)
    const now = context.now()
    const created = {
      courseOutcomeOverrideId: createId('course_outcome_override'),
      courseId: body.courseId,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      outcomesJson: stringifyJson(body.outcomes),
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    await context.db.insert(courseOutcomeOverrides).values(created)
    await emitAuditEvent(context, {
      entityType: 'course_outcome_override',
      entityId: created.courseOutcomeOverrideId,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      after: mapCourseOutcomeOverride(created),
    })
    return mapCourseOutcomeOverride(created)
  })

  app.patch('/api/admin/course-outcomes/:courseOutcomeOverrideId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update a scoped course outcome override',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ courseOutcomeOverrideId: z.string().min(1) }), request.params)
    const body = parseOrThrow(courseOutcomeOverridePatchSchema, request.body)
    const [current] = await context.db
      .select()
      .from(courseOutcomeOverrides)
      .where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, params.courseOutcomeOverrideId))
    if (!current) throw notFound('Course outcome override not found')
    expectVersion(current.version, body.version, 'course outcome override', current)
    const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
    if (!course) throw notFound('Course not found')
    await assertCourseOutcomeScopeExists(context, body.scopeType, body.scopeId)
    await context.db.update(courseOutcomeOverrides).set({
      courseId: body.courseId,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      outcomesJson: stringifyJson(body.outcomes),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, params.courseOutcomeOverrideId))
    const [updated] = await context.db
      .select()
      .from(courseOutcomeOverrides)
      .where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, params.courseOutcomeOverrideId))
    await emitAuditEvent(context, {
      entityType: 'course_outcome_override',
      entityId: params.courseOutcomeOverrideId,
      action: 'UPDATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: mapCourseOutcomeOverride(current),
      after: mapCourseOutcomeOverride(updated),
    })
    return mapCourseOutcomeOverride(updated)
  })

  app.get('/api/admin/offerings/:offeringId/resolved-course-outcomes', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Resolve the active course outcomes for an offering',
    },
  }, async request => {
    const auth = requireAuth(request)
    const params = parseOrThrow(offeringParamsSchema, request.params)
    await assertViewerCanReadOffering(context, auth, params.offeringId)
    const { offering, course, term, department } = await getOfferingContext(context, params.offeringId)
    const rows = await context.db
      .select()
      .from(courseOutcomeOverrides)
      .where(and(
        eq(courseOutcomeOverrides.courseId, offering.courseId),
        eq(courseOutcomeOverrides.status, 'active'),
      ))
    const outcomes = resolveCourseOutcomesForOffering({
      institutionId: department.institutionId,
      branchId: offering.branchId,
      batchId: term.batchId,
      offeringId: offering.offeringId,
      courseId: offering.courseId,
      courseCode: course.courseCode,
      courseTitle: course.title,
      overrides: rows,
    })
    return {
      offeringId: offering.offeringId,
      courseId: offering.courseId,
      outcomes,
    }
  })

  app.put('/api/academic/offerings/:offeringId/scheme', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the authoritative assessment scheme for an offering',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(offeringParamsSchema, request.params)
    const body = parseOrThrow(offeringSchemeUpsertSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering, term } = await getOfferingContext(context, params.offeringId)
    const policy = term.batchId ? (await resolveBatchPolicy(context, term.batchId)).effectivePolicy : DEFAULT_POLICY
    const canonicalScheme = canonicalizeSchemeState(body.scheme, policy)
    validateSchemeAgainstPolicy(canonicalScheme, policy)
    const now = context.now()
    const [current] = await context.db
      .select()
      .from(offeringAssessmentSchemes)
      .where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))

    if (current) {
      await context.db.update(offeringAssessmentSchemes).set({
        configuredByFacultyId: auth.facultyId,
        schemeJson: stringifyJson(canonicalScheme),
        policySnapshotJson: stringifyJson(policy),
        status: current.status,
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))
    } else {
      await context.db.insert(offeringAssessmentSchemes).values({
        offeringId: offering.offeringId,
        configuredByFacultyId: auth.facultyId,
        schemeJson: stringifyJson(canonicalScheme),
        policySnapshotJson: stringifyJson(policy),
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const [saved] = await context.db
      .select()
      .from(offeringAssessmentSchemes)
      .where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))

    const previousScheme = current
      ? schemeStateSchema.safeParse(parseJson(current.schemeJson, {}))
      : null
    await emitAuditEvent(context, {
      entityType: 'offering_assessment_scheme',
      entityId: params.offeringId,
      action: current ? 'UPDATE' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: previousScheme?.success ? canonicalizeSchemeState(previousScheme.data, policy) : null,
      after: canonicalScheme,
      metadata: { offeringId: params.offeringId },
    })

    return {
      offeringId: saved.offeringId,
      scheme: canonicalizeSchemeState(schemeStateSchema.parse(parseJson(saved.schemeJson, {})), policy),
      version: saved.version,
      policySnapshot: parseJson(saved.policySnapshotJson, {}),
    }
  })

  app.put('/api/academic/offerings/:offeringId/question-papers/:kind', {
    schema: {
      tags: ['academic'],
      summary: 'Persist an offering-owned question paper blueprint',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(questionPaperParamsSchema, request.params)
    const body = parseOrThrow(offeringQuestionPaperUpsertSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering, course, term, department } = await getOfferingContext(context, params.offeringId)
    const rows = await context.db
      .select()
      .from(courseOutcomeOverrides)
      .where(and(
        eq(courseOutcomeOverrides.courseId, offering.courseId),
        eq(courseOutcomeOverrides.status, 'active'),
      ))
    const resolvedOutcomes = resolveCourseOutcomesForOffering({
      institutionId: department.institutionId,
      branchId: offering.branchId,
      batchId: term.batchId,
      offeringId: offering.offeringId,
      courseId: offering.courseId,
      courseCode: course.courseCode,
      courseTitle: course.title,
      overrides: rows,
    })
    validateQuestionPaperBlueprint(params.kind, body.blueprint, new Set(resolvedOutcomes.map(item => item.id)))
    const now = context.now()
    const [current] = await context.db
      .select()
      .from(offeringQuestionPapers)
      .where(and(
        eq(offeringQuestionPapers.offeringId, params.offeringId),
        eq(offeringQuestionPapers.kind, params.kind),
      ))

    if (current) {
      await context.db.update(offeringQuestionPapers).set({
        blueprintJson: stringifyJson(body.blueprint),
        updatedByFacultyId: auth.facultyId,
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(offeringQuestionPapers.paperId, current.paperId))
    } else {
      await context.db.insert(offeringQuestionPapers).values({
        paperId: createId('question_paper'),
        offeringId: params.offeringId,
        kind: params.kind,
        blueprintJson: stringifyJson(body.blueprint),
        updatedByFacultyId: auth.facultyId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const [saved] = await context.db
      .select()
      .from(offeringQuestionPapers)
      .where(and(
        eq(offeringQuestionPapers.offeringId, params.offeringId),
        eq(offeringQuestionPapers.kind, params.kind),
      ))

    const previousBlueprint = current
      ? termTestBlueprintSchema.safeParse(parseJson(current.blueprintJson, {}))
      : null
    await emitAuditEvent(context, {
      entityType: 'offering_question_paper',
      entityId: saved.paperId,
      action: current ? 'UPDATE' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: previousBlueprint?.success ? previousBlueprint.data : null,
      after: body.blueprint,
      metadata: { offeringId: params.offeringId, kind: params.kind },
    })

    return {
      paperId: saved.paperId,
      offeringId: saved.offeringId,
      kind: saved.kind,
      blueprint: termTestBlueprintSchema.parse(parseJson(saved.blueprintJson, {})),
      version: saved.version,
    }
  })

  app.get('/api/admin/offerings', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List section offerings',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const snapshot = await buildAcademicBootstrap(context, {
      facultyId: request.auth?.facultyId ?? null,
      roleCode: request.auth?.activeRoleGrant.roleCode ?? null,
    })
    return { items: snapshot.offerings }
  })

  app.post('/api/admin/attendance-snapshots', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a student attendance snapshot',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(attendanceSnapshotCreateSchema, request.body)
    const now = context.now()
    const attendanceSnapshotId = createId('attendance')
    const attendancePercent = body.attendancePercent ?? (body.totalClasses > 0 ? Math.round((body.presentClasses / body.totalClasses) * 100) : 0)
    await context.db.insert(studentAttendanceSnapshots).values({
      attendanceSnapshotId,
      studentId: body.studentId,
      offeringId: body.offeringId,
      presentClasses: body.presentClasses,
      totalClasses: body.totalClasses,
      attendancePercent,
      source: body.source,
      capturedAt: body.capturedAt,
      createdAt: now,
      updatedAt: now,
    })
    await emitAuditEvent(context, {
      entityType: 'StudentAttendanceSnapshot',
      entityId: attendanceSnapshotId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: null,
      after: body,
    })
    return { attendanceSnapshotId, ok: true }
  })

  app.post('/api/admin/assessment-scores', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a student assessment score',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(assessmentScoreCreateSchema, request.body)
    const now = context.now()
    const assessmentScoreId = createId('assessment')
    await context.db.insert(studentAssessmentScores).values({
      assessmentScoreId,
      studentId: body.studentId,
      offeringId: body.offeringId,
      termId: body.termId ?? null,
      componentType: body.componentType,
      componentCode: body.componentCode ?? null,
      score: body.score,
      maxScore: body.maxScore,
      evaluatedAt: body.evaluatedAt,
      createdAt: now,
      updatedAt: now,
    })
    await emitAuditEvent(context, {
      entityType: 'StudentAssessmentScore',
      entityId: assessmentScoreId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: null,
      after: body,
    })
    return { assessmentScoreId, ok: true }
  })

  app.post('/api/admin/student-interventions', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a student intervention history entry',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(interventionCreateSchema, request.body)
    const now = context.now()
    const interventionId = createId('intervention')
    await context.db.insert(studentInterventions).values({
      interventionId,
      studentId: body.studentId,
      facultyId: body.facultyId ?? null,
      offeringId: body.offeringId ?? null,
      interventionType: body.interventionType,
      note: body.note,
      occurredAt: body.occurredAt,
      createdAt: now,
      updatedAt: now,
    })
    await emitAuditEvent(context, {
      entityType: 'StudentIntervention',
      entityId: interventionId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: null,
      after: body,
    })
    return { interventionId, ok: true }
  })

  app.post('/api/admin/transcript-term-results', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a transcript term result',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(transcriptTermResultCreateSchema, request.body)
    const now = context.now()
    const transcriptTermResultId = createId('transcript-term')
    await context.db.insert(transcriptTermResults).values({
      transcriptTermResultId,
      studentId: body.studentId,
      termId: body.termId,
      sgpaScaled: body.sgpaScaled,
      registeredCredits: body.registeredCredits,
      earnedCredits: body.earnedCredits,
      backlogCount: body.backlogCount,
      createdAt: now,
      updatedAt: now,
    })
    await emitAuditEvent(context, {
      entityType: 'TranscriptTermResult',
      entityId: transcriptTermResultId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: null,
      after: body,
    })
    return { transcriptTermResultId, ok: true }
  })

  app.post('/api/admin/transcript-subject-results', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a transcript subject result row',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(transcriptSubjectResultCreateSchema, request.body)
    const now = context.now()
    const transcriptSubjectResultId = createId('transcript-subject')
    await context.db.insert(transcriptSubjectResults).values({
      transcriptSubjectResultId,
      transcriptTermResultId: body.transcriptTermResultId,
      courseCode: body.courseCode,
      title: body.title,
      credits: body.credits,
      score: body.score,
      gradeLabel: body.gradeLabel,
      gradePoint: body.gradePoint,
      result: body.result,
      createdAt: now,
      updatedAt: now,
    })
    await emitAuditEvent(context, {
      entityType: 'TranscriptSubjectResult',
      entityId: transcriptSubjectResultId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: null,
      after: body,
    })
    return { transcriptSubjectResultId, ok: true }
  })

  app.post('/api/admin/offerings', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a section offering',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(offeringCreateSchema, request.body)
    const offeringId = createId('offering')
    const now = context.now()
    await context.db.insert(sectionOfferings).values({
      offeringId,
      courseId: body.courseId,
      termId: body.termId,
      branchId: body.branchId,
      sectionCode: body.sectionCode,
      yearLabel: body.yearLabel,
      attendance: body.attendance,
      studentCount: body.studentCount,
      stage: body.stage,
      stageLabel: body.stageLabel,
      stageDescription: body.stageDescription,
      stageColor: body.stageColor,
      tt1Done: body.tt1Done ? 1 : 0,
      tt2Done: body.tt2Done ? 1 : 0,
      tt1Locked: body.tt1Locked ? 1 : 0,
      tt2Locked: body.tt2Locked ? 1 : 0,
      quizLocked: body.quizLocked ? 1 : 0,
      assignmentLocked: body.assignmentLocked ? 1 : 0,
      pendingAction: body.pendingAction ?? null,
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    const [created] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, offeringId))
    await emitAuditEvent(context, {
      entityType: 'section_offering',
      entityId: offeringId,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      after: created,
    })
    return created
  })

  app.patch('/api/admin/offerings/:offeringId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update a section offering',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ offeringId: z.string().min(1) }), request.params)
    const body = parseOrThrow(offeringPatchSchema, request.body)
    const [current] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, params.offeringId))
    if (!current) throw notFound('Section offering not found')
    expectVersion(current.version, body.version, 'section offering', current)
    await context.db.update(sectionOfferings).set({
      courseId: body.courseId,
      termId: body.termId,
      branchId: body.branchId,
      sectionCode: body.sectionCode,
      yearLabel: body.yearLabel,
      attendance: body.attendance,
      studentCount: body.studentCount,
      stage: body.stage,
      stageLabel: body.stageLabel,
      stageDescription: body.stageDescription,
      stageColor: body.stageColor,
      tt1Done: body.tt1Done ? 1 : 0,
      tt2Done: body.tt2Done ? 1 : 0,
      tt1Locked: body.tt1Locked ? 1 : 0,
      tt2Locked: body.tt2Locked ? 1 : 0,
      quizLocked: body.quizLocked ? 1 : 0,
      assignmentLocked: body.assignmentLocked ? 1 : 0,
      pendingAction: body.pendingAction ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(sectionOfferings.offeringId, params.offeringId))
    const [updated] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, params.offeringId))
    await emitAuditEvent(context, {
      entityType: 'section_offering',
      entityId: params.offeringId,
      action: 'UPDATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: current,
      after: updated,
    })
    return updated
  })

  app.get('/api/admin/offering-ownership', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List offering ownership records',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const items = await context.db.select().from(facultyOfferingOwnerships).orderBy(asc(facultyOfferingOwnerships.ownershipId))
    return { items }
  })

  app.post('/api/admin/offering-ownership', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create offering ownership',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(ownershipCreateSchema, request.body)
    if (body.status === 'active') {
      await assertSingleActiveOfferingOwner(context, body.offeringId, body.facultyId)
    }
    const ownershipId = createId('ownership')
    const now = context.now()
    await context.db.insert(facultyOfferingOwnerships).values({
      ownershipId,
      offeringId: body.offeringId,
      facultyId: body.facultyId,
      ownershipRole: FIXED_OWNERSHIP_ROLE,
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    const [created] = await context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, ownershipId))
    await emitAuditEvent(context, {
      entityType: 'faculty_offering_ownership',
      entityId: ownershipId,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      after: created,
    })
    return created
  })

  app.patch('/api/admin/offering-ownership/:ownershipId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update offering ownership',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ ownershipId: z.string().min(1) }), request.params)
    const body = parseOrThrow(ownershipPatchSchema, request.body)
    const [current] = await context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, params.ownershipId))
    if (!current) throw notFound('Offering ownership not found')
    expectVersion(current.version, body.version, 'offering ownership', current)
    if (body.status === 'active') {
      await assertSingleActiveOfferingOwner(context, body.offeringId, body.facultyId, current.ownershipId)
    }
    await context.db.update(facultyOfferingOwnerships).set({
      offeringId: body.offeringId,
      facultyId: body.facultyId,
      ownershipRole: FIXED_OWNERSHIP_ROLE,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(facultyOfferingOwnerships.ownershipId, params.ownershipId))
    const [updated] = await context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, params.ownershipId))
    await emitAuditEvent(context, {
      entityType: 'faculty_offering_ownership',
      entityId: params.ownershipId,
      action: 'UPDATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: current,
      after: updated,
    })
    return updated
  })
}
