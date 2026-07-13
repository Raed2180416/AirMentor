/**
 * Academic Zod contracts (part 1) — runtime-state keys/defaults plus the core
 * academic entity, scheme, and question-paper blueprint request/response
 * schemas.
 *
 * Framework/persistence-free: these are the contracts assembled into the
 * academic route dependency bag. Moved verbatim from modules/academic.ts — a
 * pure structural relocation with no schema, refinement, or default change. The
 * only added tokens are the `export` keyword on each top-level declaration.
 */
import { z } from 'zod'
import { DEFAULT_STAGE_POLICY } from '../../../lib/stage-policy.js'

export const academicRoleCodes = ['COURSE_LEADER', 'MENTOR', 'HOD'] as const
export const runtimeStateKeys = [
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

export const runtimeStateKeySchema = z.enum(runtimeStateKeys)
export type RuntimeStateKey = z.infer<typeof runtimeStateKeySchema>
export type AssessmentScoreSnapshot = { score: number; maxScore: number; evaluatedAt: string; updatedAt: string }

export const runtimeDefaults = {
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

export type AcademicInterventionEntry = {
  date: string
  type: string
  note: string
  offeringId: string | null
}

export const facultyCalendarAdminWorkspaceSchema = z.object({
  publishedAt: z.string().nullable().optional(),
  markers: z.array(z.object({
    markerId: z.string(),
    facultyId: z.string().optional(),
    markerType: z.string(),
    title: z.string(),
    dateISO: z.string(),
  }).passthrough()),
}).passthrough()

export const runtimeSliceSchemas = {
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
  adminCalendarByFacultyId: z.record(z.string(), facultyCalendarAdminWorkspaceSchema),
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

export const hodProofSummaryQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
})

export const hodProofCourseQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  riskBand: z.string().min(1).optional(),
  courseCode: z.string().min(1).optional(),
})

export const hodProofFacultyQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  facultyId: z.string().min(1).optional(),
})

export const hodProofStudentQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  riskBand: z.string().min(1).optional(),
  courseCode: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
})

export const hodProofReassessmentQuerySchema = z.object({
  section: z.string().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
  riskBand: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  facultyId: z.string().min(1).optional(),
  courseCode: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
})

export const studentShellQuerySchema = z.object({
  simulationRunId: z.string().min(1).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
})

export const studentShellSessionCreateSchema = z.object({
  simulationRunId: z.string().min(1).optional(),
  simulationStageCheckpointId: z.string().min(1).optional(),
})

export const studentShellMessageSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
})

export const proofReassessmentParamsSchema = z.object({
  reassessmentEventId: z.string().min(1),
})

export const proofReassessmentAcknowledgeSchema = z.object({
  note: z.string().trim().max(1000).optional(),
})

export const proofReassessmentResolutionOutcomeSchema = z.enum([
  'completed_awaiting_evidence',
  'completed_improving',
  'not_completed',
  'no_show',
  'switch_intervention',
  'administratively_closed',
])

export const proofReassessmentResolveSchema = z.object({
  outcome: proofReassessmentResolutionOutcomeSchema,
  note: z.string().trim().max(1000).optional(),
})

export const academicBootstrapQuerySchema = z.object({
  simulationStageCheckpointId: z.string().min(1).optional(),
})

export const offeringCreateSchema = z.object({
  courseId: z.string().min(1),
  termId: z.string().min(1),
  branchId: z.string().min(1),
  sectionCode: z.string().min(1),
  yearLabel: z.string().min(1),
  attendance: z.number().int().min(0).max(100),
  studentCount: z.number().int().min(0),
  stage: z.number().int().min(1).max(DEFAULT_STAGE_POLICY.stages.length),
  stageLabel: z.string().min(1),
  stageDescription: z.string().min(1),
  stageColor: z.string().min(1),
  tt1Done: z.boolean().default(false),
  tt2Done: z.boolean().default(false),
  tt1Locked: z.boolean().default(false),
  tt2Locked: z.boolean().default(false),
  quizLocked: z.boolean().default(false),
  assignmentLocked: z.boolean().default(false),
  finalsLocked: z.boolean().default(false),
  pendingAction: z.string().nullable().optional(),
  status: z.string().min(1),
})

export const offeringPatchSchema = offeringCreateSchema.extend({
  version: z.number().int().positive(),
})

export const adminOfferingParamsSchema = z.object({
  offeringId: z.string().min(1),
})

export const batchProvisioningSchema = z.object({
  termId: z.string().min(1),
  sectionLabels: z.array(z.string().min(1)).default([]),
  mode: z.enum(['live-empty', 'mock', 'manual']).default('live-empty'),
  studentsPerSection: z.number().int().min(1).max(200).default(60),
  facultyPoolIds: z.array(z.string().min(1)).optional(),
  createStudents: z.boolean().default(false),
  createMentors: z.boolean().default(true),
  createAttendanceScaffolding: z.boolean().default(true),
  createAssessmentScaffolding: z.boolean().default(false),
  createTranscriptScaffolding: z.boolean().default(true),
})

export const ownershipCreateSchema = z.object({
  offeringId: z.string().min(1),
  facultyId: z.string().min(1),
  ownershipRole: z.string().min(1).optional(),
  status: z.string().min(1),
})

export const ownershipPatchSchema = ownershipCreateSchema.extend({
  version: z.number().int().positive(),
})

export const attendanceSnapshotCreateSchema = z.object({
  studentId: z.string().min(1),
  offeringId: z.string().min(1),
  presentClasses: z.number().int().min(0),
  totalClasses: z.number().int().min(0),
  attendancePercent: z.number().int().min(0).max(100).optional(),
  source: z.string().min(1).default('manual-entry'),
  capturedAt: z.string().min(1),
})

export const assessmentScoreCreateSchema = z.object({
  studentId: z.string().min(1),
  offeringId: z.string().min(1),
  termId: z.string().min(1).optional(),
  componentType: z.string().min(1).max(32).refine(value => /^(tt1|tt2|tt1_leaf|tt2_leaf|quiz\d+|asgn\d+|sem_end|see|lab|viva|other)$/.test(value), {
    message: 'Unsupported assessment component type',
  }),
  componentCode: z.string().min(1).optional(),
  score: z.number().int().min(0),
  maxScore: z.number().int().min(1),
  evaluatedAt: z.string().min(1),
})

export const interventionCreateSchema = z.object({
  studentId: z.string().min(1),
  facultyId: z.string().min(1).optional(),
  offeringId: z.string().min(1).optional(),
  interventionType: z.string().min(1),
  note: z.string().min(1),
  occurredAt: z.string().min(1),
})

export const transcriptTermResultCreateSchema = z.object({
  studentId: z.string().min(1),
  termId: z.string().min(1),
  sgpaScaled: z.number().int().min(0),
  registeredCredits: z.number().int().min(0),
  earnedCredits: z.number().int().min(0),
  backlogCount: z.number().int().min(0),
})

export const transcriptSubjectResultCreateSchema = z.object({
  transcriptTermResultId: z.string().min(1),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().int().min(0),
  score: z.number().int().min(0),
  gradeLabel: z.string().min(1),
  gradePoint: z.number().int().min(0),
  result: z.string().min(1),
})

export const courseOutcomeScopeSchema = z.enum(['institution', 'branch', 'batch', 'offering'])

export const courseOutcomeSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  bloom: z.string().min(1),
})

export const courseOutcomeOverrideCreateSchema = z.object({
  courseId: z.string().min(1),
  scopeType: courseOutcomeScopeSchema,
  scopeId: z.string().min(1),
  outcomes: z.array(courseOutcomeSchema).min(1),
  status: z.string().min(1).default('active'),
})

export const courseOutcomeOverridePatchSchema = courseOutcomeOverrideCreateSchema.extend({
  version: z.number().int().positive(),
})

export const assessmentComponentSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  rawMax: z.number().int().positive(),
  weightage: z.number().min(0).max(100).optional(),
  cos: z.array(z.string()).default([]),
})

export const schemePolicyContextSchema = z.object({
  ce: z.number().int().min(0).max(100),
  see: z.number().int().min(0).max(100),
  maxTermTests: z.number().int().min(0).max(10),
  maxQuizzes: z.number().int().min(0).max(10),
  maxAssignments: z.number().int().min(0).max(10),
})

export const termTestWeightsSchema = z.object({
  tt1: z.number().min(0).max(100),
  tt2: z.number().min(0).max(100),
})

export const schemeStateSchema = z.object({
  finalsMax: z.union([z.literal(50), z.literal(100)]),
  termTestWeights: termTestWeightsSchema.optional(),
  quizWeight: z.number().min(0).max(100).optional(),
  assignmentWeight: z.number().min(0).max(100).optional(),
  quizCount: z.number().int().min(0).max(10),
  assignmentCount: z.number().int().min(0).max(10),
  quizComponents: z.array(assessmentComponentSchema),
  assignmentComponents: z.array(assessmentComponentSchema),
  policyContext: schemePolicyContextSchema.optional(),
  status: z.string().min(1),
  configuredAt: z.number().finite().optional(),
  lockedAt: z.number().finite().optional(),
  lastEditedBy: z.string().optional(),
})

export type TermTestNodeShape = {
  id: string
  label: string
  text: string
  maxMarks: number
  cos: string[]
  children?: TermTestNodeShape[]
}

export const termTestNodeSchema: z.ZodType<TermTestNodeShape> = z.lazy(() => z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
  maxMarks: z.number().int().positive(),
  cos: z.array(z.string()),
  children: z.array(termTestNodeSchema).optional(),
}))

export const termTestBlueprintSchema = z.object({
  kind: z.enum(['tt1', 'tt2']),
  totalMarks: z.number().int().positive(),
  updatedAt: z.number().finite(),
  nodes: z.array(termTestNodeSchema),
})

export const offeringSchemeUpsertSchema = z.object({
  scheme: schemeStateSchema,
})

export const offeringQuestionPaperUpsertSchema = z.object({
  blueprint: termTestBlueprintSchema,
})

export const courseOutcomeOverrideListQuerySchema = z.object({
  courseId: z.string().min(1).optional(),
  scopeType: courseOutcomeScopeSchema.optional(),
  scopeId: z.string().min(1).optional(),
})

export const offeringParamsSchema = z.object({
  offeringId: z.string().min(1),
})

export const questionPaperParamsSchema = offeringParamsSchema.extend({
  kind: z.enum(['tt1', 'tt2']),
})

export const FIXED_OWNERSHIP_ROLE = 'owner'
