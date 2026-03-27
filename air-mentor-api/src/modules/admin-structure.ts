import { createHash } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicFaculties,
  academicTerms,
  batches,
  batchCurriculumFeatureBindings,
  batchCurriculumFeatureOverrides,
  bridgeModules,
  branches,
  courseOutcomeOverrides,
  courseTopicPartitions,
  courses,
  curriculumFeatureProfileCourses,
  curriculumFeatureProfiles,
  curriculumLinkageCandidates,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  curriculumCourses,
  departments,
  electiveBaskets,
  electiveOptions,
  facultyAppointments,
  facultyOfferingOwnerships,
  institutions,
  policyOverrides,
  reassessmentEvents,
  roleGrants,
  riskAssessments,
  riskModelArtifacts,
  sectionOfferings,
  simulationRuns,
  stagePolicyOverrides,
} from '../db/schema.js'
import { badRequest, conflict, notFound } from '../lib/http-errors.js'
import { createId } from '../lib/ids.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import {
  buildCurriculumLinkageCandidates,
  buildManifestPayloadItems,
  supportedCurriculumManifestKeySchema,
} from '../lib/curriculum-linkage.js'
import { enqueueProofSimulationRun } from '../lib/proof-run-queue.js'
import {
  canonicalizeStagePolicy,
  DEFAULT_STAGE_POLICY,
  scopeTypeValues,
  stagePolicyPayloadSchema,
  type ScopeTypeValue,
  type StagePolicyPayload,
} from '../lib/stage-policy.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
export const scopeTypeSchema = z.enum(['institution', 'academic-faculty', 'department', 'branch', 'batch'])

const gradeBandSchema = z.object({
  grade: z.string().min(1),
  minimumMark: z.number().min(0).max(100),
  maximumMark: z.number().min(0).max(100),
  gradePoint: z.number().min(0).max(10),
})

const ceSeeSplitSchema = z.object({
  ce: z.number().int().min(0).max(100),
  see: z.number().int().min(0).max(100),
}).refine(value => value.ce + value.see === 100, {
  message: 'CE and SEE must total 100',
})

const ceComponentCapsSchema = z.object({
  termTestsWeight: z.number().int().min(0).max(100),
  quizWeight: z.number().int().min(0).max(100),
  assignmentWeight: z.number().int().min(0).max(100),
  maxTermTests: z.number().int().min(0).max(10),
  maxQuizzes: z.number().int().min(0).max(10),
  maxAssignments: z.number().int().min(0).max(10),
})

const workingCalendarSchema = z.object({
  days: z.array(weekdaySchema).min(1),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/),
  courseworkWeeks: z.number().int().min(1).max(52).default(16),
  examPreparationWeeks: z.number().int().min(0).max(52).default(1),
  seeWeeks: z.number().int().min(0).max(52).default(3),
  totalWeeks: z.number().int().min(1).max(52).default(20),
})

const attendanceRulesSchema = z.object({
  minimumRequiredPercent: z.number().min(0).max(100),
  condonationFloorPercent: z.number().min(0).max(100),
})

const condonationRulesSchema = z.object({
  maximumShortagePercent: z.number().min(0).max(100),
  requiresApproval: z.boolean(),
})

const eligibilityRulesSchema = z.object({
  minimumCeForSeeEligibility: z.number().min(0).max(100),
  allowCondonationForSeeEligibility: z.boolean(),
})

const passRulesSchema = z.object({
  minimumCeMark: z.number().min(0).max(100),
  minimumSeeMark: z.number().min(0).max(100),
  minimumOverallMark: z.number().min(0).max(100),
  ceMaximum: z.number().min(1).max(100),
  seeMaximum: z.number().min(1).max(100),
  overallMaximum: z.number().min(1).max(100),
})

const roundingRulesSchema = z.object({
  statusMarkRounding: z.enum(['nearest-integer']),
  applyBeforeStatusDetermination: z.boolean(),
  sgpaCgpaDecimals: z.number().int().min(0).max(4),
})

const sgpaCgpaRulesSchema = z.object({
  sgpaModel: z.enum(['credit-weighted']),
  cgpaModel: z.enum(['credit-weighted-cumulative']),
  rounding: z.enum(['2-decimal']),
  includeFailedCredits: z.boolean(),
  repeatedCoursePolicy: z.enum(['latest-attempt', 'best-attempt']),
})

const progressionRulesSchema = z.object({
  passMarkPercent: z.number().min(0).max(100),
  minimumCgpaForPromotion: z.number().min(0).max(10),
  requireNoActiveBacklogs: z.boolean(),
})

const riskRulesSchema = z.object({
  highRiskAttendancePercentBelow: z.number().min(0).max(100),
  mediumRiskAttendancePercentBelow: z.number().min(0).max(100),
  highRiskCgpaBelow: z.number().min(0).max(10),
  mediumRiskCgpaBelow: z.number().min(0).max(10),
  highRiskBacklogCount: z.number().int().min(0).max(50),
  mediumRiskBacklogCount: z.number().int().min(0).max(50),
}).refine(value => value.highRiskAttendancePercentBelow <= value.mediumRiskAttendancePercentBelow, {
  message: 'High risk attendance threshold must be less than or equal to medium risk attendance threshold',
}).refine(value => value.highRiskCgpaBelow <= value.mediumRiskCgpaBelow, {
  message: 'High risk CGPA threshold must be less than or equal to medium risk CGPA threshold',
}).refine(value => value.highRiskBacklogCount >= value.mediumRiskBacklogCount, {
  message: 'High risk backlog threshold must be greater than or equal to medium risk backlog threshold',
})

const policyPayloadSchema = z.object({
  gradeBands: z.array(gradeBandSchema).min(1).optional(),
  ceSeeSplit: ceSeeSplitSchema.optional(),
  ceComponentCaps: ceComponentCapsSchema.optional(),
  workingCalendar: workingCalendarSchema.optional(),
  attendanceRules: attendanceRulesSchema.optional(),
  condonationRules: condonationRulesSchema.optional(),
  eligibilityRules: eligibilityRulesSchema.optional(),
  passRules: passRulesSchema.optional(),
  roundingRules: roundingRulesSchema.optional(),
  sgpaCgpaRules: sgpaCgpaRulesSchema.optional(),
  progressionRules: progressionRulesSchema.optional(),
  riskRules: riskRulesSchema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one policy segment must be provided.',
})

const academicFacultyCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  overview: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const academicFacultyPatchSchema = academicFacultyCreateSchema.extend({
  version: z.number().int().positive(),
})

const batchCreateSchema = z.object({
  branchId: z.string().min(1),
  admissionYear: z.number().int().min(2000).max(2100),
  batchLabel: z.string().min(1),
  currentSemester: z.number().int().positive(),
  sectionLabels: z.array(z.string().min(1)).default([]),
  status: z.string().min(1).default('active'),
})

const batchPatchSchema = batchCreateSchema.extend({
  version: z.number().int().positive(),
})

const curriculumCourseCreateSchema = z.object({
  batchId: z.string().min(1),
  semesterNumber: z.number().int().positive(),
  courseId: z.string().min(1).optional().nullable(),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().int().positive(),
  status: z.string().min(1).default('active'),
})

const curriculumCoursePatchSchema = curriculumCourseCreateSchema.extend({
  version: z.number().int().positive(),
})

const curriculumFeatureOutcomeSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  bloom: z.string().min(1),
})

const curriculumFeatureEdgeSchema = z.object({
  sourceCourseCode: z.string().min(1),
  edgeKind: z.enum(['explicit', 'added']).default('explicit'),
  rationale: z.string().min(1),
})

const curriculumFeatureTopicSchema = z.object({
  tt1: z.array(z.string().min(1)).default([]),
  tt2: z.array(z.string().min(1)).default([]),
  see: z.array(z.string().min(1)).default([]),
  workbook: z.array(z.string().min(1)).default([]),
})

const curriculumFeatureConfigPatchSchema = z.object({
  assessmentProfile: z.string().min(1).default('admin-authored'),
  outcomes: z.array(curriculumFeatureOutcomeSchema).min(1),
  prerequisites: z.array(curriculumFeatureEdgeSchema).default([]),
  bridgeModules: z.array(z.string().min(1)).default([]),
  topicPartitions: curriculumFeatureTopicSchema,
})

const policyOverrideCreateSchema = z.object({
  scopeType: scopeTypeSchema,
  scopeId: z.string().min(1),
  policy: policyPayloadSchema,
  status: z.string().min(1).default('active'),
})

const policyOverridePatchSchema = policyOverrideCreateSchema.extend({
  version: z.number().int().positive(),
})

const policyFilterSchema = z.object({
  scopeType: scopeTypeSchema.optional(),
  scopeId: z.string().min(1).optional(),
})

const stagePolicyOverrideCreateSchema = z.object({
  scopeType: z.enum(scopeTypeValues),
  scopeId: z.string().min(1),
  policy: stagePolicyPayloadSchema,
  status: z.string().min(1).default('active'),
})

const stagePolicyOverridePatchSchema = stagePolicyOverrideCreateSchema.extend({
  version: z.number().int().positive(),
})

const stagePolicyFilterSchema = z.object({
  scopeType: z.enum(scopeTypeValues).optional(),
  scopeId: z.string().min(1).optional(),
})

const curriculumFeatureProfileCreateSchema = z.object({
  name: z.string().min(1),
  scopeType: z.enum(scopeTypeValues),
  scopeId: z.string().min(1),
  status: z.string().min(1).default('active'),
})

const curriculumFeatureProfilePatchSchema = curriculumFeatureProfileCreateSchema.extend({
  version: z.number().int().positive(),
})

const curriculumFeatureProfileFilterSchema = z.object({
  scopeType: z.enum(scopeTypeValues).optional(),
  scopeId: z.string().min(1).optional(),
})

const curriculumFeatureBindingModeSchema = z.enum(['inherit-scope-profile', 'pin-profile', 'local-only'])

const curriculumFeatureBindingSaveSchema = z.object({
  bindingMode: curriculumFeatureBindingModeSchema,
  curriculumFeatureProfileId: z.string().min(1).nullable().optional(),
  status: z.string().min(1).default('active'),
  version: z.number().int().positive().optional(),
})

const curriculumFeatureConfigTargetSchema = z.object({
  targetMode: z.enum(['batch-local-override', 'scope-profile']).default('batch-local-override'),
  targetScopeType: z.enum(scopeTypeValues).optional(),
  targetScopeId: z.string().min(1).optional(),
  curriculumFeatureProfileId: z.string().min(1).optional(),
})

const curriculumFeatureConfigSaveSchema = curriculumFeatureConfigPatchSchema.merge(curriculumFeatureConfigTargetSchema)

const curriculumBootstrapSchema = z.object({
  manifestKey: supportedCurriculumManifestKeySchema.default('msruas-mnc-seed'),
})

const curriculumLinkageCandidateRegenerateSchema = z.object({
  curriculumCourseId: z.string().min(1).optional(),
})

const curriculumLinkageCandidateReviewSchema = z.object({
  reviewNote: z.string().trim().max(2000).optional().nullable(),
})

export type PolicyPayload = z.infer<typeof policyPayloadSchema>
export type ResolvedPolicy = {
  gradeBands: z.infer<typeof gradeBandSchema>[]
  ceSeeSplit: z.infer<typeof ceSeeSplitSchema>
  ceComponentCaps: z.infer<typeof ceComponentCapsSchema>
  workingCalendar: z.infer<typeof workingCalendarSchema>
  attendanceRules: z.infer<typeof attendanceRulesSchema>
  condonationRules: z.infer<typeof condonationRulesSchema>
  eligibilityRules: z.infer<typeof eligibilityRulesSchema>
  passRules: z.infer<typeof passRulesSchema>
  roundingRules: z.infer<typeof roundingRulesSchema>
  sgpaCgpaRules: z.infer<typeof sgpaCgpaRulesSchema>
  progressionRules: z.infer<typeof progressionRulesSchema>
  riskRules: z.infer<typeof riskRulesSchema>
}

export const DEFAULT_POLICY: ResolvedPolicy = {
  gradeBands: [
    { grade: 'O', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
    { grade: 'A+', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
    { grade: 'A', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
    { grade: 'B+', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
    { grade: 'B', minimumMark: 55, maximumMark: 59, gradePoint: 6 },
    { grade: 'C', minimumMark: 50, maximumMark: 54, gradePoint: 5 },
    { grade: 'P', minimumMark: 40, maximumMark: 49, gradePoint: 4 },
    { grade: 'F', minimumMark: 0, maximumMark: 39, gradePoint: 0 },
  ],
  ceSeeSplit: {
    ce: 60,
    see: 40,
  },
  ceComponentCaps: {
    termTestsWeight: 30,
    quizWeight: 10,
    assignmentWeight: 20,
    maxTermTests: 2,
    maxQuizzes: 2,
    maxAssignments: 2,
  },
  workingCalendar: {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    dayStart: '08:30',
    dayEnd: '16:30',
    courseworkWeeks: 16,
    examPreparationWeeks: 1,
    seeWeeks: 3,
    totalWeeks: 20,
  },
  attendanceRules: {
    minimumRequiredPercent: 75,
    condonationFloorPercent: 65,
  },
  condonationRules: {
    maximumShortagePercent: 10,
    requiresApproval: true,
  },
  eligibilityRules: {
    minimumCeForSeeEligibility: 24,
    allowCondonationForSeeEligibility: true,
  },
  passRules: {
    minimumCeMark: 24,
    minimumSeeMark: 16,
    minimumOverallMark: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  },
  roundingRules: {
    statusMarkRounding: 'nearest-integer',
    applyBeforeStatusDetermination: true,
    sgpaCgpaDecimals: 2,
  },
  sgpaCgpaRules: {
    sgpaModel: 'credit-weighted',
    cgpaModel: 'credit-weighted-cumulative',
    rounding: '2-decimal',
    includeFailedCredits: false,
    repeatedCoursePolicy: 'latest-attempt',
  },
  progressionRules: {
    passMarkPercent: 40,
    minimumCgpaForPromotion: 5,
    requireNoActiveBacklogs: true,
  },
  riskRules: {
    highRiskAttendancePercentBelow: 65,
    mediumRiskAttendancePercentBelow: 75,
    highRiskCgpaBelow: 6,
    mediumRiskCgpaBelow: 7,
    highRiskBacklogCount: 2,
    mediumRiskBacklogCount: 1,
  },
}

function mapAcademicFaculty(row: typeof academicFaculties.$inferSelect) {
  return {
    academicFacultyId: row.academicFacultyId,
    institutionId: row.institutionId,
    code: row.code,
    name: row.name,
    overview: row.overview,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapBatch(row: typeof batches.$inferSelect) {
  return {
    batchId: row.batchId,
    branchId: row.branchId,
    admissionYear: row.admissionYear,
    batchLabel: row.batchLabel,
    currentSemester: row.currentSemester,
    sectionLabels: parseJson(row.sectionLabelsJson, [] as string[]),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCurriculumCourse(row: typeof curriculumCourses.$inferSelect) {
  return {
    curriculumCourseId: row.curriculumCourseId,
    batchId: row.batchId,
    semesterNumber: row.semesterNumber,
    courseId: row.courseId,
    courseCode: row.courseCode,
    title: row.title,
    credits: row.credits,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPolicyOverride(row: typeof policyOverrides.$inferSelect) {
  return {
    policyOverrideId: row.policyOverrideId,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    policy: parseJson(row.policyJson, {} as PolicyPayload),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapStagePolicyOverride(row: typeof stagePolicyOverrides.$inferSelect) {
  return {
    stagePolicyOverrideId: row.stagePolicyOverrideId,
    scopeType: row.scopeType as ScopeTypeValue,
    scopeId: row.scopeId,
    policy: canonicalizeStagePolicy(parseJson(row.policyJson, DEFAULT_STAGE_POLICY)),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCurriculumFeatureProfile(row: typeof curriculumFeatureProfiles.$inferSelect) {
  return {
    curriculumFeatureProfileId: row.curriculumFeatureProfileId,
    name: row.name,
    scopeType: row.scopeType as ScopeTypeValue,
    scopeId: row.scopeId,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapBatchCurriculumFeatureBinding(row: typeof batchCurriculumFeatureBindings.$inferSelect | null) {
  if (!row) return null
  return {
    batchId: row.batchId,
    curriculumFeatureProfileId: row.curriculumFeatureProfileId,
    bindingMode: row.bindingMode as 'inherit-scope-profile' | 'pin-profile' | 'local-only',
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

type CurriculumFeatureProfileCoursePayload = z.infer<typeof curriculumFeatureConfigPatchSchema>

function mapCurriculumFeatureProfileCourse(row: typeof curriculumFeatureProfileCourses.$inferSelect) {
  return {
    curriculumFeatureProfileCourseId: row.curriculumFeatureProfileCourseId,
    curriculumFeatureProfileId: row.curriculumFeatureProfileId,
    courseId: row.courseId,
    courseCode: row.courseCode,
    title: row.title,
    config: {
      assessmentProfile: row.assessmentProfile,
      outcomes: parseOrThrow(z.array(curriculumFeatureOutcomeSchema), parseJson(row.outcomesJson, [])),
      prerequisites: parseOrThrow(z.array(curriculumFeatureEdgeSchema), parseJson(row.prerequisitesJson, [])),
      bridgeModules: parseOrThrow(z.array(z.string()), parseJson(row.bridgeModulesJson, [])),
      topicPartitions: parseOrThrow(curriculumFeatureTopicSchema, parseJson(row.topicPartitionsJson, {})),
    } satisfies CurriculumFeatureProfileCoursePayload,
    featureFingerprint: row.featureFingerprint,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapBatchCurriculumFeatureOverride(row: typeof batchCurriculumFeatureOverrides.$inferSelect) {
  return {
    batchCurriculumFeatureOverrideId: row.batchCurriculumFeatureOverrideId,
    batchId: row.batchId,
    curriculumCourseId: row.curriculumCourseId,
    courseId: row.courseId,
    courseCode: row.courseCode,
    title: row.title,
    override: parseOrThrow(curriculumFeatureConfigPatchSchema, parseJson(row.overrideJson, {})),
    featureFingerprint: row.featureFingerprint,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCurriculumLinkageCandidate(row: typeof curriculumLinkageCandidates.$inferSelect) {
  return {
    curriculumLinkageCandidateId: row.curriculumLinkageCandidateId,
    batchId: row.batchId,
    curriculumCourseId: row.curriculumCourseId,
    sourceCurriculumCourseId: row.sourceCurriculumCourseId,
    sourceCourseId: row.sourceCourseId,
    sourceCourseCode: row.sourceCourseCode,
    sourceTitle: row.sourceTitle,
    targetCourseCode: row.targetCourseCode,
    targetTitle: row.targetTitle,
    edgeKind: row.edgeKind as 'explicit' | 'added',
    rationale: row.rationale,
    confidenceScaled: row.confidenceScaled,
    sources: parseOrThrow(z.array(z.string()), parseJson(row.sourcesJson, [])),
    signalSummary: parseJson(row.signalSummaryJson, {} as Record<string, unknown>),
    status: row.status,
    reviewNote: row.reviewNote,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCourseOutcomeOverride(row: typeof courseOutcomeOverrides.$inferSelect) {
  const parsed = z.array(curriculumFeatureOutcomeSchema).safeParse(parseJson(row.outcomesJson, []))
  return {
    courseOutcomeOverrideId: row.courseOutcomeOverrideId,
    courseId: row.courseId,
    scopeType: row.scopeType as 'institution' | 'branch' | 'batch' | 'offering',
    scopeId: row.scopeId,
    outcomes: parsed.success ? parsed.data : [],
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function buildDefaultCourseOutcomes(courseCode: string, courseTitle: string) {
  return [
    { id: 'CO1', desc: `Explain the core concepts covered in ${courseTitle}.`, bloom: 'Understand' },
    { id: 'CO2', desc: `Apply ${courseCode} methods to solve structured academic problems.`, bloom: 'Apply' },
    { id: 'CO3', desc: `Analyse common failure patterns, tradeoffs, and edge cases in ${courseTitle}.`, bloom: 'Analyse' },
    { id: 'CO4', desc: `Evaluate solution quality and justify implementation choices in ${courseTitle}.`, bloom: 'Evaluate' },
  ]
}

function normalizeFeatureStringList(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
}

function normalizeCurriculumFeaturePayload(payload: CurriculumFeatureProfileCoursePayload): CurriculumFeatureProfileCoursePayload {
  return {
    assessmentProfile: payload.assessmentProfile.trim(),
    outcomes: payload.outcomes
      .map(item => ({
        id: item.id.trim(),
        desc: item.desc.trim(),
        bloom: item.bloom.trim(),
      }))
      .filter(item => item.id && item.desc && item.bloom)
      .sort((left, right) => left.id.localeCompare(right.id)),
    prerequisites: payload.prerequisites
      .map(item => ({
        sourceCourseCode: item.sourceCourseCode.trim(),
        edgeKind: item.edgeKind,
        rationale: item.rationale.trim(),
      }))
      .filter(item => item.sourceCourseCode && item.rationale)
      .sort((left, right) => left.sourceCourseCode.localeCompare(right.sourceCourseCode) || left.rationale.localeCompare(right.rationale)),
    bridgeModules: normalizeFeatureStringList(payload.bridgeModules).sort((left, right) => left.localeCompare(right)),
    topicPartitions: {
      tt1: normalizeFeatureStringList(payload.topicPartitions.tt1).sort((left, right) => left.localeCompare(right)),
      tt2: normalizeFeatureStringList(payload.topicPartitions.tt2).sort((left, right) => left.localeCompare(right)),
      see: normalizeFeatureStringList(payload.topicPartitions.see).sort((left, right) => left.localeCompare(right)),
      workbook: normalizeFeatureStringList(payload.topicPartitions.workbook).sort((left, right) => left.localeCompare(right)),
    },
  }
}

type CurriculumEdgeValidationError = {
  targetCourseCode: string
  sourceCourseCode: string
  message: string
}

type ProofRefreshSummary = {
  affectedBatchIds: string[]
  queuedSimulationRunIds: string[]
  curriculumImportVersionId: string | null
}

function createEmptyProofRefresh(curriculumImportVersionId: string | null = null): ProofRefreshSummary {
  return {
    affectedBatchIds: [],
    queuedSimulationRunIds: [],
    curriculumImportVersionId,
  }
}

function formatCurriculumEdgeValidationMessage(errors: CurriculumEdgeValidationError[]) {
  const preview = errors
    .slice(0, 6)
    .map(error => `${error.targetCourseCode} <- ${error.sourceCourseCode}: ${error.message}`)
    .join('; ')
  const remainder = errors.length > 6 ? ` (+${errors.length - 6} more)` : ''
  return `Invalid curriculum prerequisite configuration. ${preview}${remainder}`
}

function curriculumFeatureFingerprint(payload: CurriculumFeatureProfileCoursePayload) {
  return buildSnapshotChecksum(normalizeCurriculumFeaturePayload(payload))
}

function sanitizeInternalCompilerId(courseCode: string, title: string) {
  const seed = courseCode.trim() || title.trim()
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || createId('course_seed')
}

function buildSnapshotChecksum(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

async function getLatestCurriculumImport(context: RouteContext, batchId: string) {
  const rows = await context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId))
  return rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))[0] ?? null
}

function findCurriculumNodeForCourse(
  nodeRows: Array<typeof curriculumNodes.$inferSelect>,
  course: {
    courseId?: string | null
    courseCode: string
    title: string
    semesterNumber: number
  },
) {
  return nodeRows.find(row =>
    (course.courseId && row.courseId === course.courseId)
    || (row.semesterNumber === course.semesterNumber && row.courseCode.toLowerCase() === course.courseCode.toLowerCase())
    || (row.semesterNumber === course.semesterNumber && row.title.toLowerCase() === course.title.toLowerCase())
  ) ?? null
}

async function ensureCourseRecordForCurriculumCourse(context: RouteContext, curriculumCourse: typeof curriculumCourses.$inferSelect) {
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, curriculumCourse.batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found')

  let course = curriculumCourse.courseId
    ? (await context.db.select().from(courses).where(eq(courses.courseId, curriculumCourse.courseId)))[0] ?? null
    : null

  if (!course) {
    const departmentCourses = await context.db.select().from(courses).where(eq(courses.departmentId, department.departmentId))
    course = departmentCourses.find(row => row.courseCode.toLowerCase() === curriculumCourse.courseCode.toLowerCase()) ?? null
  }

  if (!course) {
    const createdCourse = {
      courseId: createId('course'),
      institutionId: department.institutionId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(courses).values(createdCourse)
    course = createdCourse
  } else if (
    course.courseCode !== curriculumCourse.courseCode
    || course.title !== curriculumCourse.title
    || course.defaultCredits !== curriculumCourse.credits
    || course.departmentId !== department.departmentId
    || course.status !== 'active'
  ) {
    await context.db.update(courses).set({
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: course.version + 1,
      updatedAt: context.now(),
    }).where(eq(courses.courseId, course.courseId))
    course = {
      ...course,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: course.version + 1,
      updatedAt: context.now(),
    }
  }

  if (curriculumCourse.courseId !== course.courseId) {
    await context.db.update(curriculumCourses).set({
      courseId: course.courseId,
      updatedAt: context.now(),
      version: curriculumCourse.version + 1,
    }).where(eq(curriculumCourses.curriculumCourseId, curriculumCourse.curriculumCourseId))
  }

  return course
}

async function ensureEditableCurriculumImport(context: RouteContext, input: {
  batchId: string
  actorFacultyId?: string | null
  now: string
}) {
  const existing = await getLatestCurriculumImport(context, input.batchId)
  if (existing) return existing

  const curriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))

  const checksum = buildSnapshotChecksum(curriculumRows.map(row => ({
    semesterNumber: row.semesterNumber,
    courseCode: row.courseCode,
    title: row.title,
    credits: row.credits,
    status: row.status,
  })))
  const firstSemester = curriculumRows[0]?.semesterNumber ?? 1
  const lastSemester = curriculumRows.at(-1)?.semesterNumber ?? firstSemester
  const importRow = {
    curriculumImportVersionId: createId('curriculum_import'),
    batchId: input.batchId,
    sourceLabel: 'system-admin-live',
    sourceChecksum: checksum,
    sourcePath: null,
    sourceType: 'admin',
    compilerVersion: 'system-admin-live-v1',
    outputChecksum: checksum,
    firstSemester,
    lastSemester,
    courseCount: curriculumRows.length,
    totalCredits: curriculumRows.reduce((sum, row) => sum + row.credits, 0),
    explicitEdgeCount: 0,
    addedEdgeCount: 0,
    bridgeModuleCount: 0,
    electiveOptionCount: 0,
    unresolvedMappingCount: 0,
    validationStatus: 'admin-managed',
    completenessCertificateJson: stringifyJson({
      sourceLabel: 'system-admin-live',
      managedBy: 'sysadmin',
      courseCount: curriculumRows.length,
      totalCredits: curriculumRows.reduce((sum, row) => sum + row.credits, 0),
    }),
    approvedByFacultyId: input.actorFacultyId ?? null,
    approvedAt: input.now,
    status: 'approved',
    createdAt: input.now,
    updatedAt: input.now,
  }
  await context.db.insert(curriculumImportVersions).values(importRow)

  for (const curriculumCourse of curriculumRows) {
    const course = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    await context.db.insert(curriculumNodes).values({
      curriculumNodeId: createId('curriculum_node'),
      curriculumImportVersionId: importRow.curriculumImportVersionId,
      batchId: input.batchId,
      semesterNumber: curriculumCourse.semesterNumber,
      courseId: course.courseId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      credits: curriculumCourse.credits,
      internalCompilerId: sanitizeInternalCompilerId(curriculumCourse.courseCode, curriculumCourse.title),
      officialWebCode: curriculumCourse.courseCode,
      officialWebTitle: curriculumCourse.title,
      matchStatus: 'admin-authored',
      mappingNote: 'System-admin managed curriculum snapshot.',
      assessmentProfile: 'admin-authored',
      status: 'active',
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  return importRow
}

async function upsertCurriculumNodeForCourse(context: RouteContext, input: {
  batchId: string
  curriculumImportVersionId: string
  curriculumCourse: typeof curriculumCourses.$inferSelect
  courseId: string
  assessmentProfile?: string | null
  now: string
}) {
  const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, input.curriculumImportVersionId))
  const current = findCurriculumNodeForCourse(nodeRows, {
    courseId: input.courseId,
    courseCode: input.curriculumCourse.courseCode,
    title: input.curriculumCourse.title,
    semesterNumber: input.curriculumCourse.semesterNumber,
  })

  if (current) {
    await context.db.update(curriculumNodes).set({
      semesterNumber: input.curriculumCourse.semesterNumber,
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      credits: input.curriculumCourse.credits,
      internalCompilerId: current.internalCompilerId || sanitizeInternalCompilerId(input.curriculumCourse.courseCode, input.curriculumCourse.title),
      officialWebCode: input.curriculumCourse.courseCode,
      officialWebTitle: input.curriculumCourse.title,
      matchStatus: current.matchStatus || 'admin-authored',
      mappingNote: current.mappingNote ?? 'System-admin managed curriculum snapshot.',
      assessmentProfile: input.assessmentProfile ?? current.assessmentProfile ?? 'admin-authored',
      status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
      updatedAt: input.now,
    }).where(eq(curriculumNodes.curriculumNodeId, current.curriculumNodeId))
    return {
      ...current,
      semesterNumber: input.curriculumCourse.semesterNumber,
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      credits: input.curriculumCourse.credits,
      officialWebCode: input.curriculumCourse.courseCode,
      officialWebTitle: input.curriculumCourse.title,
      assessmentProfile: input.assessmentProfile ?? current.assessmentProfile ?? 'admin-authored',
      status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
      updatedAt: input.now,
    }
  }

  const created = {
    curriculumNodeId: createId('curriculum_node'),
    curriculumImportVersionId: input.curriculumImportVersionId,
    batchId: input.batchId,
    semesterNumber: input.curriculumCourse.semesterNumber,
    courseId: input.courseId,
    courseCode: input.curriculumCourse.courseCode,
    title: input.curriculumCourse.title,
    credits: input.curriculumCourse.credits,
    internalCompilerId: sanitizeInternalCompilerId(input.curriculumCourse.courseCode, input.curriculumCourse.title),
    officialWebCode: input.curriculumCourse.courseCode,
    officialWebTitle: input.curriculumCourse.title,
    matchStatus: 'admin-authored',
    mappingNote: 'System-admin managed curriculum snapshot.',
    assessmentProfile: input.assessmentProfile ?? 'admin-authored',
    status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
    createdAt: input.now,
    updatedAt: input.now,
  }
  await context.db.insert(curriculumNodes).values(created)
  return created
}

async function refreshCurriculumImportSummary(context: RouteContext, input: {
  batchId: string
  curriculumImportVersionId: string
  now: string
}) {
  const [importRow] = await context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
  if (!importRow) return

  const [nodeRows, edgeRows, bridgeRows, basketRows, optionRows] = await Promise.all([
    context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(electiveBaskets).where(eq(electiveBaskets.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(electiveOptions),
  ])

  const activeNodes = nodeRows.filter(row => row.status === 'active').sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
  const basketIds = new Set(basketRows.map(row => row.electiveBasketId))
  const scopedOptions = optionRows.filter(row => basketIds.has(row.electiveBasketId))
  const snapshotPayload = {
    nodes: activeNodes.map(row => ({
      semesterNumber: row.semesterNumber,
      courseCode: row.courseCode,
      title: row.title,
      credits: row.credits,
      status: row.status,
      assessmentProfile: row.assessmentProfile,
    })),
    edges: edgeRows.filter(row => row.status === 'active').map(row => ({
      sourceCurriculumNodeId: row.sourceCurriculumNodeId,
      targetCurriculumNodeId: row.targetCurriculumNodeId,
      edgeKind: row.edgeKind,
      rationale: row.rationale,
      status: row.status,
    })),
    bridges: bridgeRows.filter(row => row.status === 'active').map(row => ({
      curriculumNodeId: row.curriculumNodeId,
      moduleTitlesJson: row.moduleTitlesJson,
      status: row.status,
    })),
    electiveOptions: scopedOptions.map(row => ({
      electiveBasketId: row.electiveBasketId,
      code: row.code,
      title: row.title,
      stream: row.stream,
      semesterSlot: row.semesterSlot,
    })),
  }
  const checksum = buildSnapshotChecksum(snapshotPayload)
  await context.db.update(curriculumImportVersions).set({
    sourceChecksum: importRow.sourceType === 'admin' ? checksum : importRow.sourceChecksum,
    outputChecksum: checksum,
    firstSemester: activeNodes[0]?.semesterNumber ?? importRow.firstSemester,
    lastSemester: activeNodes.at(-1)?.semesterNumber ?? importRow.lastSemester,
    courseCount: activeNodes.length,
    totalCredits: activeNodes.reduce((sum, row) => sum + row.credits, 0),
    explicitEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'explicit').length,
    addedEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'added').length,
    bridgeModuleCount: bridgeRows.filter(row => row.status === 'active').length,
    electiveOptionCount: scopedOptions.length,
    validationStatus: importRow.sourceType === 'admin' ? 'admin-managed' : importRow.validationStatus,
    completenessCertificateJson: stringifyJson({
      sourceLabel: importRow.sourceLabel,
      managedBy: importRow.sourceType === 'admin' ? 'sysadmin' : 'import',
      courseCount: activeNodes.length,
      totalCredits: activeNodes.reduce((sum, row) => sum + row.credits, 0),
      explicitEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'explicit').length,
      addedEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'added').length,
      bridgeModuleCount: bridgeRows.filter(row => row.status === 'active').length,
      electiveOptionCount: scopedOptions.length,
    }),
    updatedAt: input.now,
  }).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
}

async function syncCurriculumCourseIntoImport(context: RouteContext, input: {
  curriculumCourse: typeof curriculumCourses.$inferSelect
  actorFacultyId?: string | null
  now: string
}) {
  const latestImport = await getLatestCurriculumImport(context, input.curriculumCourse.batchId)
  if ((input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived') && !latestImport) return null
  const editableImport = latestImport ?? await ensureEditableCurriculumImport(context, {
    batchId: input.curriculumCourse.batchId,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
  })
  if (input.curriculumCourse.status !== 'deleted' && input.curriculumCourse.status !== 'archived') {
    const course = await ensureCourseRecordForCurriculumCourse(context, input.curriculumCourse)
    await upsertCurriculumNodeForCourse(context, {
      batchId: input.curriculumCourse.batchId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumCourse: input.curriculumCourse,
      courseId: course.courseId,
      now: input.now,
    })
  } else {
    const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, editableImport.curriculumImportVersionId))
    const existingNode = findCurriculumNodeForCourse(nodeRows, {
      courseId: input.curriculumCourse.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      semesterNumber: input.curriculumCourse.semesterNumber,
    })
    if (existingNode) {
      await context.db.update(curriculumNodes).set({
        status: 'deleted',
        updatedAt: input.now,
      }).where(eq(curriculumNodes.curriculumNodeId, existingNode.curriculumNodeId))
    }
  }
  await refreshCurriculumImportSummary(context, {
    batchId: input.curriculumCourse.batchId,
    curriculumImportVersionId: editableImport.curriculumImportVersionId,
    now: input.now,
  })
  return editableImport
}

function mergePolicy(base: ResolvedPolicy, override: PolicyPayload): ResolvedPolicy {
  return {
    gradeBands: override.gradeBands ?? base.gradeBands,
    ceSeeSplit: override.ceSeeSplit ?? base.ceSeeSplit,
    ceComponentCaps: override.ceComponentCaps ?? base.ceComponentCaps,
    workingCalendar: override.workingCalendar ?? base.workingCalendar,
    attendanceRules: override.attendanceRules ?? base.attendanceRules,
    condonationRules: override.condonationRules ?? base.condonationRules,
    eligibilityRules: override.eligibilityRules ?? base.eligibilityRules,
    passRules: override.passRules ?? base.passRules,
    roundingRules: override.roundingRules ?? base.roundingRules,
    sgpaCgpaRules: override.sgpaCgpaRules ?? base.sgpaCgpaRules,
    progressionRules: override.progressionRules ?? base.progressionRules,
    riskRules: override.riskRules ?? base.riskRules,
  }
}

type ScopeChainEntry = {
  scopeType: ScopeTypeValue
  scopeId: string
}

type BatchScopeContext = {
  institution: typeof institutions.$inferSelect
  batch: typeof batches.$inferSelect
  branch: typeof branches.$inferSelect
  department: typeof departments.$inferSelect
  scopeChain: ScopeChainEntry[]
}

type MaterializedCurriculumFeatureItem = {
  curriculumCourseId: string
  curriculumImportVersionId: string | null
  curriculumNodeId: string | null
  courseId: string | null
  semesterNumber: number
  courseCode: string
  title: string
  credits: number
  assessmentProfile: string
  outcomes: z.infer<typeof curriculumFeatureOutcomeSchema>[]
  outcomeOverride: ReturnType<typeof mapCourseOutcomeOverride> | null
  prerequisites: Array<{
    curriculumEdgeId: string
    sourceCurriculumNodeId: string
    sourceCourseCode: string
    sourceTitle: string
    edgeKind: string
    rationale: string
    status: string
  }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
}

type ResolvedCurriculumFeatureItem = MaterializedCurriculumFeatureItem & {
  resolvedConfig: CurriculumFeatureProfileCoursePayload
  featureFingerprint: string
  resolvedSource: {
    mode: 'materialized' | 'scope-profile' | 'pinned-profile' | 'batch-local-override'
    label: string
    scopeType?: ScopeTypeValue
    scopeId?: string
    curriculumFeatureProfileId?: string | null
  }
  appliedProfiles: Array<ReturnType<typeof mapCurriculumFeatureProfile>>
  localOverride: ReturnType<typeof mapBatchCurriculumFeatureOverride> | null
}

async function getBatchScopeContext(context: RouteContext, batchId: string): Promise<BatchScopeContext> {
  const [institution] = await context.db.select().from(institutions)
  if (!institution) throw notFound('Institution is not configured')

  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found')

  return {
    institution,
    batch,
    branch,
    department,
    scopeChain: [
      { scopeType: 'institution', scopeId: institution.institutionId },
      ...(department.academicFacultyId ? [{ scopeType: 'academic-faculty' as const, scopeId: department.academicFacultyId }] : []),
      { scopeType: 'department', scopeId: department.departmentId },
      { scopeType: 'branch', scopeId: branch.branchId },
      { scopeType: 'batch', scopeId: batch.batchId },
    ],
  }
}

function formatScopeLabel(scope: ScopeChainEntry) {
  return `${scope.scopeType}:${scope.scopeId}`
}

function matchesCourseReference(input: {
  courseId?: string | null
  courseCode: string
  title: string
}, candidate: {
  courseId?: string | null
  courseCode: string
  title: string
}) {
  return (
    (!!input.courseId && !!candidate.courseId && input.courseId === candidate.courseId)
    || input.courseCode.toLowerCase() === candidate.courseCode.toLowerCase()
    || input.title.toLowerCase() === candidate.title.toLowerCase()
  )
}

async function loadMaterializedCurriculumFeatureBundle(context: RouteContext, batchId: string) {
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
  if (!batch) throw notFound('Batch not found')

  const latestImport = await getLatestCurriculumImport(context, batchId)
  const [curriculumRows, nodeRows, edgeRows, bridgeRows, topicRows, outcomeRows] = await Promise.all([
    context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, batchId)),
    latestImport ? context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    latestImport ? context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    latestImport ? context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    latestImport ? context.db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    context.db.select().from(courseOutcomeOverrides),
  ])

  const visibleCurriculumRows = curriculumRows
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
  const nodeById = new Map(nodeRows.map(row => [row.curriculumNodeId, row]))
  const nodeKeySet = new Set(visibleCurriculumRows.map(row => `${row.semesterNumber}::${row.courseCode.toLowerCase()}`))
  const nodeOnlyRows = nodeRows
    .filter(row => row.status === 'active')
    .filter(row => !nodeKeySet.has(`${row.semesterNumber}::${row.courseCode.toLowerCase()}`))
    .map(row => ({
      curriculumCourseId: `import:${row.curriculumNodeId}`,
      batchId,
      semesterNumber: row.semesterNumber,
      courseId: row.courseId,
      courseCode: row.courseCode,
      title: row.title,
      credits: row.credits,
      status: 'active',
      version: 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

  const items = [...visibleCurriculumRows, ...nodeOnlyRows].map(curriculumCourse => {
    const node = findCurriculumNodeForCourse(nodeRows, curriculumCourse)
    const activeOutcomeOverride = curriculumCourse.courseId
      ? outcomeRows
        .filter(row => row.courseId === curriculumCourse.courseId && row.scopeType === 'batch' && row.scopeId === batchId && row.status === 'active')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      : null
    const prerequisiteRows = node
      ? edgeRows
        .filter(row => row.targetCurriculumNodeId === node.curriculumNodeId && row.status === 'active')
        .map(row => {
          const sourceNode = nodeById.get(row.sourceCurriculumNodeId) ?? null
          return {
            curriculumEdgeId: row.curriculumEdgeId,
            sourceCurriculumNodeId: row.sourceCurriculumNodeId,
            sourceCourseCode: sourceNode?.courseCode ?? row.sourceCurriculumNodeId,
            sourceTitle: sourceNode?.title ?? row.sourceCurriculumNodeId,
            edgeKind: row.edgeKind,
            rationale: row.rationale,
            status: row.status,
          }
        })
      : []
    const bridgeRow = node
      ? bridgeRows
        .filter(row => row.curriculumNodeId === node.curriculumNodeId && row.status === 'active')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      : null
    const topicByKind = new Map(
      (node ? topicRows.filter(row => row.curriculumNodeId === node.curriculumNodeId) : []).map(row => [
        row.partitionKind,
        normalizeFeatureStringList(parseJson(row.topicsJson, [] as string[])),
      ]),
    )
    return {
      curriculumCourseId: curriculumCourse.curriculumCourseId,
      curriculumImportVersionId: latestImport?.curriculumImportVersionId ?? null,
      curriculumNodeId: node?.curriculumNodeId ?? null,
      courseId: curriculumCourse.courseId ?? node?.courseId ?? null,
      semesterNumber: curriculumCourse.semesterNumber,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      credits: curriculumCourse.credits,
      assessmentProfile: node?.assessmentProfile ?? 'admin-authored',
      outcomes: activeOutcomeOverride ? mapCourseOutcomeOverride(activeOutcomeOverride).outcomes : buildDefaultCourseOutcomes(curriculumCourse.courseCode, curriculumCourse.title),
      outcomeOverride: activeOutcomeOverride ? mapCourseOutcomeOverride(activeOutcomeOverride) : null,
      prerequisites: prerequisiteRows,
      bridgeModules: bridgeRow ? normalizeFeatureStringList(parseJson(bridgeRow.moduleTitlesJson, [] as string[])) : [],
      topicPartitions: {
        tt1: topicByKind.get('tt1') ?? [],
        tt2: topicByKind.get('tt2') ?? [],
        see: topicByKind.get('see') ?? [],
        workbook: topicByKind.get('workbook') ?? [],
      },
    } satisfies MaterializedCurriculumFeatureItem
  })

  return {
    batchId,
    curriculumImportVersion: latestImport
      ? {
          curriculumImportVersionId: latestImport.curriculumImportVersionId,
          sourceLabel: latestImport.sourceLabel,
          sourceType: latestImport.sourceType,
          status: latestImport.status,
          validationStatus: latestImport.validationStatus,
          updatedAt: latestImport.updatedAt,
        }
      : null,
    items,
  }
}

function toCurriculumFeaturePayload(item: Pick<MaterializedCurriculumFeatureItem, 'assessmentProfile' | 'outcomes' | 'prerequisites' | 'bridgeModules' | 'topicPartitions'>): CurriculumFeatureProfileCoursePayload {
  return normalizeCurriculumFeaturePayload({
    assessmentProfile: item.assessmentProfile,
    outcomes: item.outcomes,
    prerequisites: item.prerequisites.map(prerequisite => ({
      sourceCourseCode: prerequisite.sourceCourseCode,
      edgeKind: prerequisite.edgeKind as 'explicit' | 'added',
      rationale: prerequisite.rationale,
    })),
    bridgeModules: item.bridgeModules,
    topicPartitions: item.topicPartitions,
  })
}

function fromResolvedCurriculumFeaturePayload(
  payload: CurriculumFeatureProfileCoursePayload,
  item: Pick<MaterializedCurriculumFeatureItem, 'courseCode' | 'title'>,
  batchItems: MaterializedCurriculumFeatureItem[],
) {
  return {
    assessmentProfile: payload.assessmentProfile,
    outcomes: payload.outcomes,
    prerequisites: payload.prerequisites.map(prerequisite => {
      const source = batchItems.find(candidate => candidate.courseCode.toLowerCase() === prerequisite.sourceCourseCode.toLowerCase())
      return {
        curriculumEdgeId: source?.curriculumNodeId ?? `${item.courseCode}:${prerequisite.sourceCourseCode}`,
        sourceCurriculumNodeId: source?.curriculumNodeId ?? prerequisite.sourceCourseCode,
        sourceCourseCode: prerequisite.sourceCourseCode,
        sourceTitle: source?.title ?? prerequisite.sourceCourseCode,
        edgeKind: prerequisite.edgeKind,
        rationale: prerequisite.rationale,
        status: 'active',
      }
    }),
    bridgeModules: payload.bridgeModules,
    topicPartitions: payload.topicPartitions,
  }
}

function batchFeatureFingerprint(items: Array<{
  curriculumCourseId: string
  courseCode: string
  title: string
  semesterNumber: number
  credits: number
  featureFingerprint: string
}>) {
  return buildSnapshotChecksum(items
    .map(item => ({
      curriculumCourseId: item.curriculumCourseId,
      courseCode: item.courseCode,
      title: item.title,
      semesterNumber: item.semesterNumber,
      credits: item.credits,
      featureFingerprint: item.featureFingerprint,
    }))
    .sort((left, right) => left.curriculumCourseId.localeCompare(right.curriculumCourseId)))
}

export async function resolveBatchStagePolicy(context: RouteContext, batchId: string) {
  const scopeContext = await getBatchScopeContext(context, batchId)
  const allOverrides = await context.db.select().from(stagePolicyOverrides)
  let effectivePolicy: StagePolicyPayload = DEFAULT_STAGE_POLICY
  const appliedOverrides: Array<ReturnType<typeof mapStagePolicyOverride> & { appliedAtScope: string }> = []

  for (const scope of scopeContext.scopeChain) {
    const override = allOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && item.status === 'active')
    if (!override) continue
    const mapped = mapStagePolicyOverride(override)
    effectivePolicy = mapped.policy
    appliedOverrides.push({
      ...mapped,
      appliedAtScope: formatScopeLabel(scope),
    })
  }

  return {
    batch: mapBatch(scopeContext.batch),
    scopeChain: scopeContext.scopeChain,
    appliedOverrides,
    effectivePolicy,
  }
}

export async function resolveBatchCurriculumFeatures(context: RouteContext, batchId: string) {
  const scopeContext = await getBatchScopeContext(context, batchId)
  const materializedBundle = await loadMaterializedCurriculumFeatureBundle(context, batchId)
  const [profileRows, profileCourseRows, bindingRowRaw, overrideRowsRaw] = await Promise.all([
    context.db.select().from(curriculumFeatureProfiles),
    context.db.select().from(curriculumFeatureProfileCourses),
    context.db.select().from(batchCurriculumFeatureBindings).where(eq(batchCurriculumFeatureBindings.batchId, batchId)).then(rows => rows[0] ?? null),
    context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, batchId)),
  ])

  const binding = mapBatchCurriculumFeatureBinding(bindingRowRaw) ?? {
    batchId,
    curriculumFeatureProfileId: null,
    bindingMode: 'inherit-scope-profile' as const,
    status: 'active',
    version: 1,
    createdAt: '',
    updatedAt: '',
  }
  const availableProfiles = profileRows
    .filter(row => row.status === 'active')
    .map(mapCurriculumFeatureProfile)
    .filter(profile => scopeContext.scopeChain.some(scope => scope.scopeType === profile.scopeType && scope.scopeId === profile.scopeId))
    .sort((left, right) => {
      const leftIndex = scopeContext.scopeChain.findIndex(scope => scope.scopeType === left.scopeType && scope.scopeId === left.scopeId)
      const rightIndex = scopeContext.scopeChain.findIndex(scope => scope.scopeType === right.scopeType && scope.scopeId === right.scopeId)
      return leftIndex - rightIndex || left.updatedAt.localeCompare(right.updatedAt)
    })
  const profileCourses = profileCourseRows
    .filter(row => row.status === 'active')
    .map(mapCurriculumFeatureProfileCourse)
  const localOverrides = overrideRowsRaw
    .filter(row => row.status === 'active')
    .map(mapBatchCurriculumFeatureOverride)

  const items = materializedBundle.items.map(item => {
    let resolvedPayload = toCurriculumFeaturePayload(item)
    let resolvedSource: ResolvedCurriculumFeatureItem['resolvedSource'] = {
      mode: 'materialized',
      label: 'Batch materialized config',
    }
    const appliedProfiles: Array<ReturnType<typeof mapCurriculumFeatureProfile>> = []
    if (binding.bindingMode !== 'local-only') {
      for (const profile of availableProfiles) {
        const profileCourse = profileCourses.find(row => (
          row.curriculumFeatureProfileId === profile.curriculumFeatureProfileId
          && matchesCourseReference({
            courseId: item.courseId,
            courseCode: item.courseCode,
            title: item.title,
          }, {
            courseId: row.courseId,
            courseCode: row.courseCode,
            title: row.title,
          })
        ))
        if (!profileCourse) continue
        resolvedPayload = normalizeCurriculumFeaturePayload(profileCourse.config)
        resolvedSource = {
          mode: 'scope-profile',
          label: profile.name,
          scopeType: profile.scopeType,
          scopeId: profile.scopeId,
          curriculumFeatureProfileId: profile.curriculumFeatureProfileId,
        }
        appliedProfiles.push(profile)
      }
    }
    if (binding.bindingMode === 'pin-profile' && binding.curriculumFeatureProfileId) {
      const pinnedProfile = availableProfiles.find(profile => profile.curriculumFeatureProfileId === binding.curriculumFeatureProfileId)
        ?? profileRows.filter(row => row.curriculumFeatureProfileId === binding.curriculumFeatureProfileId && row.status === 'active').map(mapCurriculumFeatureProfile)[0]
        ?? null
      const pinnedCourse = profileCourses.find(row => (
        row.curriculumFeatureProfileId === binding.curriculumFeatureProfileId
        && matchesCourseReference({
          courseId: item.courseId,
          courseCode: item.courseCode,
          title: item.title,
        }, {
          courseId: row.courseId,
          courseCode: row.courseCode,
          title: row.title,
        })
      ))
      if (pinnedProfile && pinnedCourse) {
        resolvedPayload = normalizeCurriculumFeaturePayload(pinnedCourse.config)
        resolvedSource = {
          mode: 'pinned-profile',
          label: pinnedProfile.name,
          scopeType: pinnedProfile.scopeType,
          scopeId: pinnedProfile.scopeId,
          curriculumFeatureProfileId: pinnedProfile.curriculumFeatureProfileId,
        }
        if (!appliedProfiles.some(profile => profile.curriculumFeatureProfileId === pinnedProfile.curriculumFeatureProfileId)) {
          appliedProfiles.push(pinnedProfile)
        }
      }
    }
    const localOverride = localOverrides.find(override => override.curriculumCourseId === item.curriculumCourseId) ?? null
    if (localOverride) {
      resolvedPayload = normalizeCurriculumFeaturePayload(localOverride.override)
      resolvedSource = {
        mode: 'batch-local-override',
        label: 'Batch-local override',
        scopeType: 'batch',
        scopeId: batchId,
        curriculumFeatureProfileId: null,
      }
    }

    return {
      ...item,
      ...fromResolvedCurriculumFeaturePayload(resolvedPayload, item, materializedBundle.items),
      resolvedConfig: resolvedPayload,
      featureFingerprint: curriculumFeatureFingerprint(resolvedPayload),
      resolvedSource,
      appliedProfiles,
      localOverride,
    } satisfies ResolvedCurriculumFeatureItem
  })

  const activeProfileIds = Array.from(new Set(items
    .map(item => item.resolvedSource.curriculumFeatureProfileId)
    .filter((value): value is string => !!value)))
  const primaryCurriculumFeatureProfileId = binding.curriculumFeatureProfileId
    ?? activeProfileIds.at(-1)
    ?? null

  return {
    batchId,
    curriculumImportVersion: materializedBundle.curriculumImportVersion,
    binding,
    availableProfiles,
    primaryCurriculumFeatureProfileId,
    curriculumFeatureProfileFingerprint: batchFeatureFingerprint(items),
    items,
  }
}

async function materializeResolvedCurriculumFeatureItems(context: RouteContext, input: {
  batchId: string
  actorFacultyId?: string | null
  now: string
  items: Array<{
    curriculumCourseId: string
    resolvedConfig: CurriculumFeatureProfileCoursePayload
  }>
}) {
  const editableImport = await ensureEditableCurriculumImport(context, {
    batchId: input.batchId,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
  })
  const batchCurriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
  validateResolvedCurriculumFeatureItems({
    batchId: input.batchId,
    batchCurriculumRows,
    items: input.items,
  })
  const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, editableImport.curriculumImportVersionId))
  const nodeById = new Map(nodeRows.map(row => [row.curriculumNodeId, row]))

  for (const item of input.items) {
    const curriculumCourse = batchCurriculumRows.find(row => row.curriculumCourseId === item.curriculumCourseId)
    if (!curriculumCourse) continue
    const course = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    const node = await upsertCurriculumNodeForCourse(context, {
      batchId: input.batchId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumCourse,
      courseId: course.courseId,
      assessmentProfile: item.resolvedConfig.assessmentProfile,
      now: input.now,
    })
    nodeById.set(node.curriculumNodeId, node)

    const existingTargetEdgeRows = (await context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.targetCurriculumNodeId === node.curriculumNodeId)
    if (existingTargetEdgeRows.length > 0) {
      await context.db.delete(curriculumEdges).where(inArray(curriculumEdges.curriculumEdgeId, existingTargetEdgeRows.map(row => row.curriculumEdgeId)))
    }

    const prerequisiteRows: Array<typeof curriculumEdges.$inferInsert> = []
    for (const prerequisite of item.resolvedConfig.prerequisites) {
      const sourceCourse = batchCurriculumRows.find(row => row.courseCode.toLowerCase() === prerequisite.sourceCourseCode.toLowerCase())
      if (!sourceCourse) continue
      const sourceCourseRecord = await ensureCourseRecordForCurriculumCourse(context, sourceCourse)
      const sourceNode = findCurriculumNodeForCourse(Array.from(nodeById.values()), {
        courseId: sourceCourseRecord.courseId,
        courseCode: sourceCourse.courseCode,
        title: sourceCourse.title,
        semesterNumber: sourceCourse.semesterNumber,
      }) ?? await upsertCurriculumNodeForCourse(context, {
        batchId: input.batchId,
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        curriculumCourse: sourceCourse,
        courseId: sourceCourseRecord.courseId,
        now: input.now,
      })
      nodeById.set(sourceNode.curriculumNodeId, sourceNode)
      if (sourceNode.curriculumNodeId === node.curriculumNodeId) continue
      prerequisiteRows.push({
        curriculumEdgeId: createId('curriculum_edge'),
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        batchId: input.batchId,
        sourceCurriculumNodeId: sourceNode.curriculumNodeId,
        targetCurriculumNodeId: node.curriculumNodeId,
        edgeKind: prerequisite.edgeKind,
        rationale: prerequisite.rationale,
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
    if (prerequisiteRows.length > 0) {
      await context.db.insert(curriculumEdges).values(prerequisiteRows)
    }

    const existingBridgeRows = (await context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.curriculumNodeId === node.curriculumNodeId)
    if (existingBridgeRows.length > 0) {
      await context.db.delete(bridgeModules).where(inArray(bridgeModules.bridgeModuleId, existingBridgeRows.map(row => row.bridgeModuleId)))
    }
    if (item.resolvedConfig.bridgeModules.length > 0) {
      await context.db.insert(bridgeModules).values({
        bridgeModuleId: createId('bridge_module'),
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        curriculumNodeId: node.curriculumNodeId,
        batchId: input.batchId,
        moduleTitlesJson: stringifyJson(item.resolvedConfig.bridgeModules),
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
      })
    }

    const existingTopicRows = (await context.db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.curriculumNodeId === node.curriculumNodeId)
    if (existingTopicRows.length > 0) {
      await context.db.delete(courseTopicPartitions).where(inArray(courseTopicPartitions.courseTopicPartitionId, existingTopicRows.map(row => row.courseTopicPartitionId)))
    }
    await context.db.insert(courseTopicPartitions).values(([
      ['tt1', item.resolvedConfig.topicPartitions.tt1],
      ['tt2', item.resolvedConfig.topicPartitions.tt2],
      ['see', item.resolvedConfig.topicPartitions.see],
      ['workbook', item.resolvedConfig.topicPartitions.workbook],
    ] as const).map(([partitionKind, topics]) => ({
      courseTopicPartitionId: createId('course_topic_partition'),
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumNodeId: node.curriculumNodeId,
      partitionKind,
      topicsJson: stringifyJson(topics),
      createdAt: input.now,
      updatedAt: input.now,
    })))

    const batchOutcomeRows = (await context.db.select().from(courseOutcomeOverrides))
      .filter(row => row.courseId === course.courseId && row.scopeType === 'batch' && row.scopeId === input.batchId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const currentOutcomeOverride = batchOutcomeRows[0] ?? null
    if (currentOutcomeOverride) {
      await context.db.update(courseOutcomeOverrides).set({
        courseId: course.courseId,
        scopeType: 'batch',
        scopeId: input.batchId,
        outcomesJson: stringifyJson(item.resolvedConfig.outcomes),
        status: 'active',
        version: currentOutcomeOverride.version + 1,
        updatedAt: input.now,
      }).where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, currentOutcomeOverride.courseOutcomeOverrideId))
    } else {
      await context.db.insert(courseOutcomeOverrides).values({
        courseOutcomeOverrideId: createId('course_outcome_override'),
        courseId: course.courseId,
        scopeType: 'batch',
        scopeId: input.batchId,
        outcomesJson: stringifyJson(item.resolvedConfig.outcomes),
        status: 'active',
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
  }

  await refreshCurriculumImportSummary(context, {
    batchId: input.batchId,
    curriculumImportVersionId: editableImport.curriculumImportVersionId,
    now: input.now,
  })

  return editableImport.curriculumImportVersionId
}

function validateResolvedCurriculumFeatureItems(input: {
  batchId: string
  batchCurriculumRows: Array<typeof curriculumCourses.$inferSelect>
  items: Array<{
    curriculumCourseId: string
    resolvedConfig: CurriculumFeatureProfileCoursePayload
  }>
}) {
  const rowByCourseId = new Map(input.batchCurriculumRows.map(row => [row.curriculumCourseId, row]))
  const rowByCourseCode = new Map(input.batchCurriculumRows.map(row => [row.courseCode.trim().toLowerCase(), row]))
  const errors: CurriculumEdgeValidationError[] = []

  for (const item of input.items) {
    const targetRow = rowByCourseId.get(item.curriculumCourseId)
    if (!targetRow) {
      errors.push({
        targetCourseCode: item.curriculumCourseId,
        sourceCourseCode: '?',
        message: `Target course is not an authored active curriculum row in batch ${input.batchId}.`,
      })
      continue
    }
    const seenEdges = new Set<string>()
    for (const prerequisite of item.resolvedConfig.prerequisites) {
      const normalizedSourceCourseCode = prerequisite.sourceCourseCode.trim().toLowerCase()
      const sourceRow = rowByCourseCode.get(normalizedSourceCourseCode) ?? null
      const edgeKey = `${normalizedSourceCourseCode}::${targetRow.curriculumCourseId}::${prerequisite.edgeKind}`
      if (seenEdges.has(edgeKey)) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: prerequisite.sourceCourseCode,
          message: `Duplicate ${prerequisite.edgeKind} prerequisite edge.`,
        })
        continue
      }
      seenEdges.add(edgeKey)
      if (!sourceRow) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: prerequisite.sourceCourseCode,
          message: 'Source course is not present in authored active curriculum rows.',
        })
        continue
      }
      if (
        sourceRow.curriculumCourseId === targetRow.curriculumCourseId
        || sourceRow.courseCode.trim().toLowerCase() === targetRow.courseCode.trim().toLowerCase()
      ) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: sourceRow.courseCode,
          message: 'Self-referential prerequisite edges are not allowed.',
        })
        continue
      }
      if ((prerequisite.edgeKind === 'explicit' || prerequisite.edgeKind === 'added') && sourceRow.semesterNumber >= targetRow.semesterNumber) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: sourceRow.courseCode,
          message: `Prerequisite edges require an earlier semester. Found semester ${sourceRow.semesterNumber} -> ${targetRow.semesterNumber}.`,
        })
      }
    }
  }

  if (errors.length > 0) {
    throw badRequest(formatCurriculumEdgeValidationMessage(errors))
  }
}

function validateCurriculumFeaturePayloadForCourse(input: {
  batchId: string
  batchCurriculumRows: Array<typeof curriculumCourses.$inferSelect>
  curriculumCourseId: string
  payload: CurriculumFeatureProfileCoursePayload
}) {
  validateResolvedCurriculumFeatureItems({
    batchId: input.batchId,
    batchCurriculumRows: input.batchCurriculumRows,
    items: [{
      curriculumCourseId: input.curriculumCourseId,
      resolvedConfig: input.payload,
    }],
  })
}

async function rematerializeResolvedBatchCurriculum(context: RouteContext, input: {
  batchId: string
  actorFacultyId?: string | null
  now: string
}) {
  const resolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  const curriculumImportVersionId = resolved.items.length > 0
    ? await materializeResolvedCurriculumFeatureItems(context, {
        batchId: input.batchId,
        actorFacultyId: input.actorFacultyId,
        now: input.now,
        items: resolved.items.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
    : null
  return {
    resolved,
    curriculumImportVersionId,
  }
}

function expandCurriculumLinkageNeighborhood(input: {
  items: Array<{
    curriculumCourseId: string
    prerequisites: Array<{ sourceCourseCode: string }>
    courseCode: string
  }>
  targetCurriculumCourseIds: string[]
}) {
  const itemsById = new Map(input.items.map(item => [item.curriculumCourseId, item]))
  const itemByCourseCode = new Map(input.items.map(item => [item.courseCode.trim().toLowerCase(), item]))
  const expandedIds = new Set(input.targetCurriculumCourseIds)
  for (const targetId of input.targetCurriculumCourseIds) {
    const targetItem = itemsById.get(targetId)
    if (!targetItem) continue
    targetItem.prerequisites.forEach(prerequisite => {
      const sourceItem = itemByCourseCode.get(prerequisite.sourceCourseCode.trim().toLowerCase())
      if (sourceItem) expandedIds.add(sourceItem.curriculumCourseId)
    })
    input.items.forEach(candidate => {
      if (candidate.prerequisites.some(prerequisite => prerequisite.sourceCourseCode.trim().toLowerCase() === targetItem.courseCode.trim().toLowerCase())) {
        expandedIds.add(candidate.curriculumCourseId)
      }
    })
  }
  return Array.from(expandedIds)
}

export async function enqueueProofRefreshForBatches(context: RouteContext, input: {
  batchIds: string[]
  actorFacultyId?: string | null
  now: string
  curriculumImportVersionId?: string | null
}) {
  const uniqueBatchIds = Array.from(new Set(input.batchIds.filter(Boolean)))
  if (uniqueBatchIds.length === 0) {
    return createEmptyProofRefresh(input.curriculumImportVersionId ?? null)
  }

  const queuedSimulationRunIds: string[] = []
  let lastCurriculumImportVersionId = input.curriculumImportVersionId ?? null

  for (const batchId of uniqueBatchIds) {
    const [resolvedPolicy, resolvedFeatures] = await Promise.all([
      resolveBatchPolicy(context, batchId),
      resolveBatchCurriculumFeatures(context, batchId),
    ])
    const curriculumImportVersionId = resolvedFeatures.curriculumImportVersion?.curriculumImportVersionId
      ?? input.curriculumImportVersionId
      ?? null
    if (!curriculumImportVersionId) continue
    lastCurriculumImportVersionId = curriculumImportVersionId
    const runRows = await context.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, batchId))
    const existingQueuedRun = runRows
      .filter(row =>
        (row.status === 'queued' || row.status === 'running')
        && row.curriculumImportVersionId === curriculumImportVersionId
        && (row.curriculumFeatureProfileFingerprint ?? '') === resolvedFeatures.curriculumFeatureProfileFingerprint
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))[0] ?? null
    if (existingQueuedRun) {
      queuedSimulationRunIds.push(existingQueuedRun.simulationRunId)
      continue
    }
    const queued = await enqueueProofSimulationRun(context.db, {
      batchId,
      curriculumImportVersionId,
      policy: resolvedPolicy.effectivePolicy,
      curriculumFeatureProfileId: resolvedFeatures.primaryCurriculumFeatureProfileId ?? null,
      curriculumFeatureProfileFingerprint: resolvedFeatures.curriculumFeatureProfileFingerprint,
      now: input.now,
      activate: true,
    })
    queuedSimulationRunIds.push(queued.simulationRunId)
  }

  return {
    affectedBatchIds: uniqueBatchIds,
    queuedSimulationRunIds,
    curriculumImportVersionId: lastCurriculumImportVersionId,
  } satisfies ProofRefreshSummary
}

async function listBatchesInScope(context: RouteContext, scopeType: ScopeTypeValue, scopeId: string) {
  const [allBatches, allBranches, allDepartments] = await Promise.all([
    context.db.select().from(batches),
    context.db.select().from(branches),
    context.db.select().from(departments),
  ])
  const branchById = new Map(allBranches.map(row => [row.branchId, row]))
  const departmentById = new Map(allDepartments.map(row => [row.departmentId, row]))

  return allBatches.filter(batch => {
    const branch = branchById.get(batch.branchId)
    const department = branch ? departmentById.get(branch.departmentId) : null
    if (!branch || !department) return false
    if (scopeType === 'institution') return true
    if (scopeType === 'academic-faculty') return department.academicFacultyId === scopeId
    if (scopeType === 'department') return department.departmentId === scopeId
    if (scopeType === 'branch') return branch.branchId === scopeId
    return batch.batchId === scopeId
  })
}

type AcademicFacultyCascadeSummary = {
  departmentsDeleted: number
  branchesDeleted: number
  batchesDeleted: number
  termsDeleted: number
  coursesDeleted: number
  curriculumCoursesDeleted: number
  policyOverridesDeleted: number
  offeringsDeleted: number
  ownershipsDeleted: number
  appointmentsDeleted: number
  roleGrantsDeleted: number
}

function createAcademicFacultyCascadeSummary(): AcademicFacultyCascadeSummary {
  return {
    departmentsDeleted: 0,
    branchesDeleted: 0,
    batchesDeleted: 0,
    termsDeleted: 0,
    coursesDeleted: 0,
    curriculumCoursesDeleted: 0,
    policyOverridesDeleted: 0,
    offeringsDeleted: 0,
    ownershipsDeleted: 0,
    appointmentsDeleted: 0,
    roleGrantsDeleted: 0,
  }
}

async function assertScopeExists(context: RouteContext, scopeType: z.infer<typeof scopeTypeSchema>, scopeId: string) {
  if (scopeType === 'institution') {
    const [row] = await context.db.select().from(institutions).where(eq(institutions.institutionId, scopeId))
    if (!row) throw notFound('Institution scope not found')
    return row
  }
  if (scopeType === 'academic-faculty') {
    const [row] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, scopeId))
    if (!row) throw notFound('Academic faculty scope not found')
    return row
  }
  if (scopeType === 'department') {
    const [row] = await context.db.select().from(departments).where(eq(departments.departmentId, scopeId))
    if (!row) throw notFound('Department scope not found')
    return row
  }
  if (scopeType === 'branch') {
    const [row] = await context.db.select().from(branches).where(eq(branches.branchId, scopeId))
    if (!row) throw notFound('Branch scope not found')
    return row
  }
  const [row] = await context.db.select().from(batches).where(eq(batches.batchId, scopeId))
  if (!row) throw notFound('Batch scope not found')
  return row
}

async function upsertCurriculumFeatureProfileCourseRecord(context: RouteContext, input: {
  curriculumFeatureProfileId: string
  curriculumCourse: typeof curriculumCourses.$inferSelect
  courseId: string
  payload: CurriculumFeatureProfileCoursePayload
  now: string
}) {
  const existingRows = await context.db.select().from(curriculumFeatureProfileCourses)
  const existing = existingRows.find(row => (
    row.curriculumFeatureProfileId === input.curriculumFeatureProfileId
    && matchesCourseReference({
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
    }, {
      courseId: row.courseId,
      courseCode: row.courseCode,
      title: row.title,
    })
  )) ?? null
  const featureFingerprint = curriculumFeatureFingerprint(input.payload)
  if (existing) {
    await context.db.update(curriculumFeatureProfileCourses).set({
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      assessmentProfile: input.payload.assessmentProfile,
      outcomesJson: stringifyJson(input.payload.outcomes),
      prerequisitesJson: stringifyJson(input.payload.prerequisites),
      bridgeModulesJson: stringifyJson(input.payload.bridgeModules),
      topicPartitionsJson: stringifyJson(input.payload.topicPartitions),
      featureFingerprint,
      status: 'active',
      version: existing.version + 1,
      updatedAt: input.now,
    }).where(eq(curriculumFeatureProfileCourses.curriculumFeatureProfileCourseId, existing.curriculumFeatureProfileCourseId))
    return existing.curriculumFeatureProfileCourseId
  }

  const profileCourseId = createId('curriculum_feature_profile_course')
  await context.db.insert(curriculumFeatureProfileCourses).values({
    curriculumFeatureProfileCourseId: profileCourseId,
    curriculumFeatureProfileId: input.curriculumFeatureProfileId,
    courseId: input.courseId,
    courseCode: input.curriculumCourse.courseCode,
    title: input.curriculumCourse.title,
    assessmentProfile: input.payload.assessmentProfile,
    outcomesJson: stringifyJson(input.payload.outcomes),
    prerequisitesJson: stringifyJson(input.payload.prerequisites),
    bridgeModulesJson: stringifyJson(input.payload.bridgeModules),
    topicPartitionsJson: stringifyJson(input.payload.topicPartitions),
    featureFingerprint,
    status: 'active',
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
  })
  return profileCourseId
}

async function regenerateCurriculumLinkageCandidatesForBatch(context: RouteContext, input: {
  batchId: string
  targetCurriculumCourseIds?: string[] | null
  now: string
}) {
  const resolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  const expandedTargetIds = input.targetCurriculumCourseIds?.length
    ? expandCurriculumLinkageNeighborhood({
        items: resolved.items.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          courseCode: item.courseCode,
          prerequisites: item.prerequisites,
        })),
        targetCurriculumCourseIds: input.targetCurriculumCourseIds,
      })
    : null
  const targetSet = expandedTargetIds?.length ? new Set(expandedTargetIds) : null
  const nextCandidateResult = await buildCurriculumLinkageCandidates({
    manifestKey: 'msruas-mnc-seed',
    items: resolved.items.map(item => ({
      curriculumCourseId: item.curriculumCourseId,
      semesterNumber: item.semesterNumber,
      courseCode: item.courseCode,
      title: item.title,
      outcomes: item.outcomes,
      prerequisites: item.prerequisites,
      bridgeModules: item.bridgeModules,
      topicPartitions: item.topicPartitions,
    })),
    targetCurriculumCourseIds: expandedTargetIds ?? null,
  })
  const nextCandidates = nextCandidateResult.items

  const existingRows = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.batchId, input.batchId))
  const rowsToSupersede = existingRows.filter(row => (
    row.status === 'pending'
    && (!targetSet || targetSet.has(row.curriculumCourseId))
  ))
  if (rowsToSupersede.length > 0) {
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'superseded',
      updatedAt: input.now,
    }).where(inArray(curriculumLinkageCandidates.curriculumLinkageCandidateId, rowsToSupersede.map(row => row.curriculumLinkageCandidateId)))
  }

  const curriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
  const curriculumRowById = new Map(curriculumRows.map(row => [row.curriculumCourseId, row]))
  const curriculumRowByCourseCode = new Map(curriculumRows.map(row => [row.courseCode.toLowerCase(), row]))

  const inserted: Array<ReturnType<typeof mapCurriculumLinkageCandidate>> = []
  for (const candidate of nextCandidates) {
    const targetCourse = curriculumRowById.get(candidate.curriculumCourseId)
    if (!targetCourse) continue
    const sourceCourse = curriculumRowByCourseCode.get(candidate.sourceCourseCode.toLowerCase()) ?? null
    const candidateId = createId('curriculum_linkage_candidate')
    const row = {
      curriculumLinkageCandidateId: candidateId,
      batchId: input.batchId,
      curriculumCourseId: candidate.curriculumCourseId,
      sourceCurriculumCourseId: sourceCourse?.curriculumCourseId ?? null,
      sourceCourseId: sourceCourse?.courseId ?? null,
      sourceCourseCode: candidate.sourceCourseCode,
      sourceTitle: candidate.sourceTitle,
      targetCourseCode: candidate.targetCourseCode,
      targetTitle: candidate.targetTitle,
      edgeKind: candidate.edgeKind,
      rationale: candidate.rationale,
      confidenceScaled: candidate.confidenceScaled,
      sourcesJson: stringifyJson(candidate.sources),
      signalSummaryJson: stringifyJson(candidate.signalSummary),
      status: 'pending',
      reviewNote: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    }
    await context.db.insert(curriculumLinkageCandidates).values(row)
    inserted.push(mapCurriculumLinkageCandidate(row))
  }

  return {
    items: inserted,
    candidateGenerationStatus: nextCandidateResult.candidateGenerationStatus,
  }
}

async function bootstrapCurriculumManifestForBatch(context: RouteContext, input: {
  batchId: string
  manifestKey: z.infer<typeof supportedCurriculumManifestKeySchema>
  actorFacultyId?: string | null
  now: string
}) {
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, input.batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const manifestItems = buildManifestPayloadItems(input.manifestKey)
  const profileRows = await context.db.select().from(curriculumFeatureProfiles)
  const activeBranchProfile = profileRows.find(row => row.scopeType === 'branch' && row.scopeId === branch.branchId && row.status === 'active') ?? null
  const profile = activeBranchProfile ?? {
    curriculumFeatureProfileId: createId('curriculum_feature_profile'),
    name: `${branch.name} feature profile`,
    scopeType: 'branch',
    scopeId: branch.branchId,
    status: 'active',
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
  }
  if (!activeBranchProfile) {
    await context.db.insert(curriculumFeatureProfiles).values(profile)
  }

  const existingCurriculumRows = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId))
  const existingBySemesterAndCode = new Map(existingCurriculumRows.map(row => [`${row.semesterNumber}::${row.courseCode.toLowerCase()}`, row] as const))
  let createdCourseCount = 0
  let upsertedProfileCourseCount = 0

  for (const manifestCourse of manifestItems) {
    const key: `${number}::${string}` = `${manifestCourse.semesterNumber}::${manifestCourse.courseCode.toLowerCase()}`
    const existingCourse = existingBySemesterAndCode.get(key) ?? null
    let curriculumCourse = existingCourse
    if (!curriculumCourse) {
      const created = {
        curriculumCourseId: createId('curriculum_course'),
        batchId: input.batchId,
        semesterNumber: manifestCourse.semesterNumber,
        courseId: null,
        courseCode: manifestCourse.courseCode,
        title: manifestCourse.title,
        credits: manifestCourse.credits,
        status: 'active',
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      }
      await context.db.insert(curriculumCourses).values(created)
      existingBySemesterAndCode.set(key, created)
      curriculumCourse = created
      createdCourseCount += 1
    } else {
      await context.db.update(curriculumCourses).set({
        courseCode: manifestCourse.courseCode,
        title: manifestCourse.title,
        credits: manifestCourse.credits,
        status: 'active',
        version: curriculumCourse.version + 1,
        updatedAt: input.now,
      }).where(eq(curriculumCourses.curriculumCourseId, curriculumCourse.curriculumCourseId))
      curriculumCourse = {
        ...curriculumCourse,
        courseCode: manifestCourse.courseCode,
        title: manifestCourse.title,
        credits: manifestCourse.credits,
        status: 'active',
        version: curriculumCourse.version + 1,
        updatedAt: input.now,
      }
    }
    const courseRecord = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    await upsertCurriculumFeatureProfileCourseRecord(context, {
      curriculumFeatureProfileId: profile.curriculumFeatureProfileId,
      curriculumCourse,
      courseId: courseRecord.courseId,
      payload: normalizeCurriculumFeaturePayload({
        assessmentProfile: manifestCourse.assessmentProfile,
        outcomes: manifestCourse.outcomes,
        prerequisites: manifestCourse.prerequisites,
        bridgeModules: manifestCourse.bridgeModules,
        topicPartitions: manifestCourse.topicPartitions,
      }),
      now: input.now,
    })
    upsertedProfileCourseCount += 1
  }

  const resolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  const curriculumImportVersionId = resolved.items.length > 0
    ? await materializeResolvedCurriculumFeatureItems(context, {
        batchId: input.batchId,
        actorFacultyId: input.actorFacultyId,
        now: input.now,
        items: resolved.items.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
    : null

  const candidateResult = await regenerateCurriculumLinkageCandidatesForBatch(context, {
    batchId: input.batchId,
    now: input.now,
  })

  return {
    curriculumImportVersionId,
    curriculumFeatureProfileId: profile.curriculumFeatureProfileId,
    curriculumFeatureProfileFingerprint: resolved.curriculumFeatureProfileFingerprint,
    createdCourseCount,
    upsertedProfileCourseCount,
    generatedCandidateCount: candidateResult.items.length,
    candidateGenerationStatus: candidateResult.candidateGenerationStatus,
  }
}

async function approveCurriculumLinkageCandidate(context: RouteContext, input: {
  batchId: string
  curriculumLinkageCandidateId: string
  actorFacultyId?: string | null
  reviewNote?: string | null
  now: string
}) {
  const [candidateRow] = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, input.curriculumLinkageCandidateId))
  if (!candidateRow || candidateRow.batchId !== input.batchId) throw notFound('Curriculum linkage candidate not found')
  if (candidateRow.status !== 'pending') throw badRequest('Only pending linkage candidates can be approved')

  const resolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  const targetItem = resolved.items.find(item => item.curriculumCourseId === candidateRow.curriculumCourseId)
  if (!targetItem) throw notFound('Resolved curriculum feature item not found')
  if (targetItem.prerequisites.some(item => item.sourceCourseCode.toLowerCase() === candidateRow.sourceCourseCode.toLowerCase() && item.edgeKind === candidateRow.edgeKind)) {
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'approved',
      reviewNote: input.reviewNote ?? 'Already present in resolved prerequisites.',
      version: candidateRow.version + 1,
      updatedAt: input.now,
    }).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, candidateRow.curriculumLinkageCandidateId))
    return {
      curriculumImportVersionId: resolved.curriculumImportVersion?.curriculumImportVersionId ?? null,
      affectedBatchIds: [] as string[],
      proofRefresh: createEmptyProofRefresh(resolved.curriculumImportVersion?.curriculumImportVersionId ?? null),
    }
  }

  const nextPayload = normalizeCurriculumFeaturePayload({
    assessmentProfile: targetItem.resolvedConfig.assessmentProfile,
    outcomes: targetItem.resolvedConfig.outcomes,
    prerequisites: [
      ...targetItem.resolvedConfig.prerequisites,
      {
        sourceCourseCode: candidateRow.sourceCourseCode,
        edgeKind: candidateRow.edgeKind as 'explicit' | 'added',
        rationale: candidateRow.rationale,
      },
    ],
    bridgeModules: targetItem.resolvedConfig.bridgeModules,
    topicPartitions: targetItem.resolvedConfig.topicPartitions,
  })

  const currentProfileId = targetItem.resolvedSource.curriculumFeatureProfileId ?? null
  const targetScopeType = targetItem.resolvedSource.scopeType ?? 'batch'
  const targetScopeId = targetItem.resolvedSource.scopeId ?? input.batchId
  const [curriculumCourse] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, candidateRow.curriculumCourseId))
  if (!curriculumCourse) throw notFound('Curriculum course not found')
  const courseRecord = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
  const beforeResolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  let curriculumImportVersionId: string | null = null
  let affectedBatchIds: string[] = []

  if (currentProfileId && targetItem.resolvedSource.mode !== 'batch-local-override') {
    const targetBatches = await listBatchesInScope(context, targetScopeType, targetScopeId)
    const beforeFingerprints = new Map<string, string>()
    for (const batch of targetBatches) {
      const resolvedBatch = await resolveBatchCurriculumFeatures(context, batch.batchId)
      beforeFingerprints.set(batch.batchId, resolvedBatch.curriculumFeatureProfileFingerprint)
    }
    for (const batch of targetBatches) {
      const batchCurriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, batch.batchId)))
        .filter(row => row.status !== 'deleted' && row.status !== 'archived')
      const targetCurriculumCourse = batchCurriculumRows.find(row => matchesCourseReference({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
      }, row)) ?? null
      if (!targetCurriculumCourse) continue
      validateCurriculumFeaturePayloadForCourse({
        batchId: batch.batchId,
        batchCurriculumRows,
        curriculumCourseId: targetCurriculumCourse.curriculumCourseId,
        payload: nextPayload,
      })
    }
    await upsertCurriculumFeatureProfileCourseRecord(context, {
      curriculumFeatureProfileId: currentProfileId,
      curriculumCourse,
      courseId: courseRecord.courseId,
      payload: nextPayload,
      now: input.now,
    })
    for (const batch of targetBatches) {
      const afterResolved = await resolveBatchCurriculumFeatures(context, batch.batchId)
      const matchingItems = afterResolved.items.filter(item => matchesCourseReference({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
      }, item))
      if (matchingItems.length === 0) continue
      validateResolvedCurriculumFeatureItems({
        batchId: batch.batchId,
        batchCurriculumRows: (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, batch.batchId)))
          .filter(row => row.status !== 'deleted' && row.status !== 'archived'),
        items: matchingItems.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
      curriculumImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
        batchId: batch.batchId,
        actorFacultyId: input.actorFacultyId,
        now: input.now,
        items: matchingItems.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
      if ((beforeFingerprints.get(batch.batchId) ?? '') !== afterResolved.curriculumFeatureProfileFingerprint) {
        affectedBatchIds.push(batch.batchId)
      }
    }
  } else {
    validateCurriculumFeaturePayloadForCourse({
      batchId: input.batchId,
      batchCurriculumRows: (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
        .filter(row => row.status !== 'deleted' && row.status !== 'archived'),
      curriculumCourseId: curriculumCourse.curriculumCourseId,
      payload: nextPayload,
    })
    const existingOverride = (await context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, input.batchId)))
      .find(row => row.curriculumCourseId === curriculumCourse.curriculumCourseId) ?? null
    const fingerprint = curriculumFeatureFingerprint(nextPayload)
    if (existingOverride) {
      await context.db.update(batchCurriculumFeatureOverrides).set({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        overrideJson: stringifyJson(nextPayload),
        featureFingerprint: fingerprint,
        status: 'active',
        version: existingOverride.version + 1,
        updatedAt: input.now,
      }).where(eq(batchCurriculumFeatureOverrides.batchCurriculumFeatureOverrideId, existingOverride.batchCurriculumFeatureOverrideId))
    } else {
      await context.db.insert(batchCurriculumFeatureOverrides).values({
        batchCurriculumFeatureOverrideId: createId('batch_curriculum_feature_override'),
        batchId: input.batchId,
        curriculumCourseId: curriculumCourse.curriculumCourseId,
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        overrideJson: stringifyJson(nextPayload),
        featureFingerprint: fingerprint,
        status: 'active',
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
    const afterResolved = await resolveBatchCurriculumFeatures(context, input.batchId)
    const matchingItem = afterResolved.items.find(item => item.curriculumCourseId === curriculumCourse.curriculumCourseId)
    if (matchingItem) {
      validateResolvedCurriculumFeatureItems({
        batchId: input.batchId,
        batchCurriculumRows: (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
          .filter(row => row.status !== 'deleted' && row.status !== 'archived'),
        items: [{
          curriculumCourseId: curriculumCourse.curriculumCourseId,
          resolvedConfig: matchingItem.resolvedConfig,
        }],
      })
      curriculumImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
        batchId: input.batchId,
        actorFacultyId: input.actorFacultyId,
        now: input.now,
        items: [{
          curriculumCourseId: curriculumCourse.curriculumCourseId,
          resolvedConfig: matchingItem.resolvedConfig,
        }],
      })
      affectedBatchIds = beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint
        ? [input.batchId]
        : []
    }
  }

  const proofRefresh = await enqueueProofRefreshForBatches(context, {
    batchIds: affectedBatchIds,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
    curriculumImportVersionId,
  })

  await context.db.update(curriculumLinkageCandidates).set({
    status: 'approved',
    reviewNote: input.reviewNote ?? null,
    version: candidateRow.version + 1,
    updatedAt: input.now,
  }).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, candidateRow.curriculumLinkageCandidateId))

  const sameTargetPending = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.batchId, input.batchId))
  const rowsToSupersede = sameTargetPending.filter(row => (
    row.status === 'pending'
    && row.curriculumCourseId === candidateRow.curriculumCourseId
    && row.sourceCourseCode.toLowerCase() === candidateRow.sourceCourseCode.toLowerCase()
  ))
  if (rowsToSupersede.length > 0) {
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'superseded',
      updatedAt: input.now,
    }).where(inArray(curriculumLinkageCandidates.curriculumLinkageCandidateId, rowsToSupersede.map(row => row.curriculumLinkageCandidateId)))
  }

  return {
    curriculumImportVersionId,
    affectedBatchIds,
    proofRefresh,
  }
}

async function buildProofSandboxSummary(context: RouteContext, batchId: string) {
  const [
    importRows,
    nodeRows,
    edgeRows,
    bridgeRows,
    simulationRows,
    assessmentRows,
    reassessmentRows,
  ] = await Promise.all([
    context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId)),
    context.db.select().from(curriculumNodes).where(eq(curriculumNodes.batchId, batchId)),
    context.db.select().from(curriculumEdges).where(eq(curriculumEdges.batchId, batchId)),
    context.db.select().from(bridgeModules).where(eq(bridgeModules.batchId, batchId)),
    context.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, batchId)),
    context.db.select().from(riskAssessments),
    context.db.select().from(reassessmentEvents),
  ])

  const latestImport = importRows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  const latestRun = simulationRows.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const latestRunMetrics = latestRun ? parseJson(latestRun.metricsJson, {} as Record<string, unknown>) : {}
  const scopedAssessments = latestRun
    ? assessmentRows.filter(row => row.simulationRunId === latestRun.simulationRunId)
    : []
  const scopedAssessmentIds = new Set(scopedAssessments.map(row => row.riskAssessmentId))
  const activeReassessmentCount = reassessmentRows.filter(row => scopedAssessmentIds.has(row.riskAssessmentId) && row.status !== 'completed').length

  return {
    hasProofData: !!latestImport || !!latestRun,
    curriculumImport: latestImport
      ? {
          curriculumImportVersionId: latestImport.curriculumImportVersionId,
          sourceLabel: latestImport.sourceLabel,
          sourceChecksum: latestImport.sourceChecksum,
          semesterRange: [latestImport.firstSemester, latestImport.lastSemester] as [number, number],
          courseCount: latestImport.courseCount,
          totalCredits: latestImport.totalCredits,
          explicitEdgeCount: latestImport.explicitEdgeCount,
          addedEdgeCount: latestImport.addedEdgeCount,
          bridgeModuleCount: latestImport.bridgeModuleCount,
          electiveOptionCount: latestImport.electiveOptionCount,
          importedAt: latestImport.createdAt,
          status: latestImport.status,
        }
      : null,
    structureSummary: {
      nodeCount: nodeRows.length,
      explicitEdgeCount: edgeRows.filter(row => row.edgeKind === 'explicit').length,
      addedEdgeCount: edgeRows.filter(row => row.edgeKind === 'added').length,
      bridgeModuleCount: bridgeRows.length,
    },
    latestSimulationRun: latestRun
      ? {
          simulationRunId: latestRun.simulationRunId,
          runLabel: latestRun.runLabel,
          status: latestRun.status,
          seed: latestRun.seed,
          sectionCount: latestRun.sectionCount,
          studentCount: latestRun.studentCount,
          facultyCount: latestRun.facultyCount,
          semesterRange: [latestRun.semesterStart, latestRun.semesterEnd] as [number, number],
          createdAt: latestRun.createdAt,
          metrics: latestRunMetrics,
        }
      : null,
    monitoringSummary: {
      riskAssessmentCount: scopedAssessments.length,
      activeReassessmentCount,
    },
  }
}

export async function resolveBatchPolicy(context: RouteContext, batchId: string) {
  const scopeContext = await getBatchScopeContext(context, batchId)

  const allOverrides = await context.db.select().from(policyOverrides)
  let effectivePolicy: ResolvedPolicy = DEFAULT_POLICY
  const appliedOverrides: Array<ReturnType<typeof mapPolicyOverride> & { appliedAtScope: string }> = []

  for (const scope of scopeContext.scopeChain) {
    const override = allOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && item.status === 'active')
    if (!override) continue
    const mapped = mapPolicyOverride(override)
    effectivePolicy = mergePolicy(effectivePolicy, mapped.policy)
    appliedOverrides.push({
      ...mapped,
      appliedAtScope: formatScopeLabel(scope),
    })
  }

  const proofSandbox = await buildProofSandboxSummary(context, scopeContext.batch.batchId)

  return {
    batch: mapBatch(scopeContext.batch),
    scopeChain: scopeContext.scopeChain,
    appliedOverrides,
    effectivePolicy,
    proofSandbox,
  }
}

export async function registerAdminStructureRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/academic-faculties', {
    schema: { tags: ['admin-structure'], summary: 'List academic faculties' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(academicFaculties)
    return { items: rows.map(mapAcademicFaculty) }
  })

  app.post('/api/admin/academic-faculties', {
    schema: { tags: ['admin-structure'], summary: 'Create academic faculty' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(academicFacultyCreateSchema, request.body)
    const [institution] = await context.db.select().from(institutions)
    if (!institution) throw notFound('Institution is not configured')
    const created = {
      academicFacultyId: createId('academic_faculty'),
      institutionId: institution.institutionId,
      code: body.code,
      name: body.name,
      overview: body.overview ?? null,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(academicFaculties).values(created)
    await emitAuditEvent(context, {
      entityType: 'AcademicFaculty',
      entityId: created.academicFacultyId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapAcademicFaculty(created),
    })
    return mapAcademicFaculty(created)
  })

  app.patch('/api/admin/academic-faculties/:academicFacultyId', {
    schema: { tags: ['admin-structure'], summary: 'Update academic faculty' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ academicFacultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(academicFacultyPatchSchema, request.body)
    const [current] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    if (!current) throw notFound('Academic faculty not found')
    expectVersion(current.version, body.version, 'AcademicFaculty', mapAcademicFaculty(current))
    const now = context.now()
    const cascadeSummary = createAcademicFacultyCascadeSummary()

    if (body.status === 'deleted' && current.status !== 'deleted') {
      const [
        departmentRows,
        branchRows,
        batchRows,
        termRows,
        courseRows,
        curriculumRows,
        policyRows,
        offeringRows,
        ownershipRows,
        appointmentRows,
        roleGrantRows,
      ] = await Promise.all([
        context.db.select().from(departments),
        context.db.select().from(branches),
        context.db.select().from(batches),
        context.db.select().from(academicTerms),
        context.db.select().from(courses),
        context.db.select().from(curriculumCourses),
        context.db.select().from(policyOverrides),
        context.db.select().from(sectionOfferings),
        context.db.select().from(facultyOfferingOwnerships),
        context.db.select().from(facultyAppointments),
        context.db.select().from(roleGrants),
      ])

      const departmentIds = new Set(
        departmentRows
          .filter(row => row.academicFacultyId === params.academicFacultyId)
          .map(row => row.departmentId),
      )
      const branchIds = new Set(
        branchRows
          .filter(row => departmentIds.has(row.departmentId))
          .map(row => row.branchId),
      )
      const batchIds = new Set(
        batchRows
          .filter(row => branchIds.has(row.branchId))
          .map(row => row.batchId),
      )
      const termIds = new Set(
        termRows
          .filter(row => branchIds.has(row.branchId) || (row.batchId ? batchIds.has(row.batchId) : false))
          .map(row => row.termId),
      )
      const courseIds = new Set(
        courseRows
          .filter(row => departmentIds.has(row.departmentId))
          .map(row => row.courseId),
      )
      const offeringIds = new Set(
        offeringRows
          .filter(row => branchIds.has(row.branchId) || termIds.has(row.termId) || courseIds.has(row.courseId))
          .map(row => row.offeringId),
      )

      for (const row of curriculumRows.filter(item => batchIds.has(item.batchId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(curriculumCourses).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(curriculumCourses.curriculumCourseId, row.curriculumCourseId))
        await emitAuditEvent(context, {
          entityType: 'CurriculumCourse',
          entityId: row.curriculumCourseId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapCurriculumCourse(row),
          after: mapCurriculumCourse(next),
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.curriculumCoursesDeleted += 1
      }

      for (const row of offeringRows.filter(item => offeringIds.has(item.offeringId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(sectionOfferings).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(sectionOfferings.offeringId, row.offeringId))
        await emitAuditEvent(context, {
          entityType: 'section_offering',
          entityId: row.offeringId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.offeringsDeleted += 1
      }

      for (const row of ownershipRows.filter(item => offeringIds.has(item.offeringId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(facultyOfferingOwnerships).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(facultyOfferingOwnerships.ownershipId, row.ownershipId))
        await emitAuditEvent(context, {
          entityType: 'faculty_offering_ownership',
          entityId: row.ownershipId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.ownershipsDeleted += 1
      }

      for (const row of courseRows.filter(item => courseIds.has(item.courseId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(courses).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(courses.courseId, row.courseId))
        await emitAuditEvent(context, {
          entityType: 'Course',
          entityId: row.courseId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.coursesDeleted += 1
      }

      for (const row of termRows.filter(item => termIds.has(item.termId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(academicTerms).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(academicTerms.termId, row.termId))
        await emitAuditEvent(context, {
          entityType: 'AcademicTerm',
          entityId: row.termId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.termsDeleted += 1
      }

      for (const row of batchRows.filter(item => batchIds.has(item.batchId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(batches).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(batches.batchId, row.batchId))
        await emitAuditEvent(context, {
          entityType: 'Batch',
          entityId: row.batchId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapBatch(row),
          after: mapBatch(next),
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.batchesDeleted += 1
      }

      for (const row of branchRows.filter(item => branchIds.has(item.branchId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(branches).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(branches.branchId, row.branchId))
        await emitAuditEvent(context, {
          entityType: 'Branch',
          entityId: row.branchId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.branchesDeleted += 1
      }

      for (const row of departmentRows.filter(item => departmentIds.has(item.departmentId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(departments).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(departments.departmentId, row.departmentId))
        await emitAuditEvent(context, {
          entityType: 'Department',
          entityId: row.departmentId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.departmentsDeleted += 1
      }

      for (const row of policyRows.filter(item => (
        (item.scopeType === 'academic-faculty' && item.scopeId === params.academicFacultyId)
        || (item.scopeType === 'department' && departmentIds.has(item.scopeId))
        || (item.scopeType === 'branch' && branchIds.has(item.scopeId))
        || (item.scopeType === 'batch' && batchIds.has(item.scopeId))
      ) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(policyOverrides).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(policyOverrides.policyOverrideId, row.policyOverrideId))
        await emitAuditEvent(context, {
          entityType: 'PolicyOverride',
          entityId: row.policyOverrideId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapPolicyOverride(row),
          after: mapPolicyOverride(next),
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.policyOverridesDeleted += 1
      }

      for (const row of appointmentRows.filter(item => (
        departmentIds.has(item.departmentId)
        || (item.branchId ? branchIds.has(item.branchId) : false)
      ) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(facultyAppointments).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(facultyAppointments.appointmentId, row.appointmentId))
        await emitAuditEvent(context, {
          entityType: 'FacultyAppointment',
          entityId: row.appointmentId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.appointmentsDeleted += 1
      }

      for (const row of roleGrantRows.filter(item => (
        (item.scopeType === 'academic-faculty' && item.scopeId === params.academicFacultyId)
        || (item.scopeType === 'department' && departmentIds.has(item.scopeId))
        || (item.scopeType === 'branch' && branchIds.has(item.scopeId))
        || (item.scopeType === 'batch' && batchIds.has(item.scopeId))
      ) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(roleGrants).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(roleGrants.grantId, row.grantId))
        await emitAuditEvent(context, {
          entityType: 'RoleGrant',
          entityId: row.grantId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.roleGrantsDeleted += 1
      }
    }

    await context.db.update(academicFaculties).set({
      code: body.code,
      name: body.name,
      overview: body.overview ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    const [next] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    await emitAuditEvent(context, {
      entityType: 'AcademicFaculty',
      entityId: params.academicFacultyId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapAcademicFaculty(current),
      after: mapAcademicFaculty(next),
      metadata: body.status === 'deleted' && current.status !== 'deleted'
        ? {
            reason: 'academic_faculty_deleted',
            cascade: cascadeSummary,
          }
        : undefined,
    })
    return mapAcademicFaculty(next)
  })

  app.get('/api/admin/batches', {
    schema: { tags: ['admin-structure'], summary: 'List batches' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(batches)
    return { items: rows.map(mapBatch) }
  })

  app.post('/api/admin/batches', {
    schema: { tags: ['admin-structure'], summary: 'Create batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(batchCreateSchema, request.body)
    const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, body.branchId))
    if (!branch) throw notFound('Branch not found')
    const created = {
      batchId: createId('batch'),
      branchId: body.branchId,
      admissionYear: body.admissionYear,
      batchLabel: body.batchLabel,
      currentSemester: body.currentSemester,
      sectionLabelsJson: stringifyJson(body.sectionLabels),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(batches).values(created)
    await emitAuditEvent(context, {
      entityType: 'Batch',
      entityId: created.batchId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapBatch(created),
    })
    return mapBatch(created)
  })

  app.patch('/api/admin/batches/:batchId', {
    schema: { tags: ['admin-structure'], summary: 'Update batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(batchPatchSchema, request.body)
    const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, body.branchId))
    if (!branch) throw notFound('Branch not found')
    const [current] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    if (!current) throw notFound('Batch not found')
    expectVersion(current.version, body.version, 'Batch', mapBatch(current))
    await context.db.update(batches).set({
      branchId: body.branchId,
      admissionYear: body.admissionYear,
      batchLabel: body.batchLabel,
      currentSemester: body.currentSemester,
      sectionLabelsJson: stringifyJson(body.sectionLabels),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(batches.batchId, params.batchId))
    const [next] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    await emitAuditEvent(context, {
      entityType: 'Batch',
      entityId: params.batchId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapBatch(current),
      after: mapBatch(next),
    })
    return mapBatch(next)
  })

  app.get('/api/admin/curriculum-courses', {
    schema: { tags: ['admin-structure'], summary: 'List curriculum courses' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(z.object({ batchId: z.string().min(1).optional() }), request.query)
    const rows = await context.db.select().from(curriculumCourses)
    return {
      items: rows
        .filter(item => !query.batchId || item.batchId === query.batchId)
        .map(mapCurriculumCourse),
    }
  })

  app.post('/api/admin/curriculum-courses', {
    schema: { tags: ['admin-structure'], summary: 'Create curriculum course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(curriculumCourseCreateSchema, request.body)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
    if (!batch) throw notFound('Batch not found')
    if (body.courseId) {
      const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
      if (!course) throw notFound('Course not found')
    }
    const now = context.now()
    const beforeResolved = await resolveBatchCurriculumFeatures(context, body.batchId)
    const created = {
      curriculumCourseId: createId('curriculum_course'),
      batchId: body.batchId,
      semesterNumber: body.semesterNumber,
      courseId: body.courseId ?? null,
      courseCode: body.courseCode,
      title: body.title,
      credits: body.credits,
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    await context.db.insert(curriculumCourses).values(created)
    await syncCurriculumCourseIntoImport(context, {
      curriculumCourse: created,
      actorFacultyId: auth.facultyId,
      now,
    })
    const { resolved: afterResolved, curriculumImportVersionId } = await rematerializeResolvedBatchCurriculum(context, {
      batchId: created.batchId,
      actorFacultyId: auth.facultyId,
      now,
    })
    await regenerateCurriculumLinkageCandidatesForBatch(context, {
      batchId: created.batchId,
      targetCurriculumCourseIds: [created.curriculumCourseId],
      now,
    })
    const affectedBatchIds = beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint
      ? [created.batchId]
      : []
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: affectedBatchIds,
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId,
    })
    const [persisted] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, created.curriculumCourseId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumCourse',
      entityId: created.curriculumCourseId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapCurriculumCourse(persisted ?? created),
    })
    return {
      ...mapCurriculumCourse(persisted ?? created),
      proofRefresh,
    }
  })

  app.patch('/api/admin/curriculum-courses/:curriculumCourseId', {
    schema: { tags: ['admin-structure'], summary: 'Update curriculum course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ curriculumCourseId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumCoursePatchSchema, request.body)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
    if (!batch) throw notFound('Batch not found')
    if (body.courseId) {
      const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
      if (!course) throw notFound('Course not found')
    }
    const [current] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    if (!current) throw notFound('Curriculum course not found')
    expectVersion(current.version, body.version, 'CurriculumCourse', mapCurriculumCourse(current))
    const now = context.now()
    const beforeResolvedByBatchId = new Map<string, string>([
      [current.batchId, (await resolveBatchCurriculumFeatures(context, current.batchId)).curriculumFeatureProfileFingerprint],
    ])
    if (body.batchId !== current.batchId) {
      beforeResolvedByBatchId.set(body.batchId, (await resolveBatchCurriculumFeatures(context, body.batchId)).curriculumFeatureProfileFingerprint)
    }
    await context.db.update(curriculumCourses).set({
      batchId: body.batchId,
      semesterNumber: body.semesterNumber,
      courseId: body.courseId ?? null,
      courseCode: body.courseCode,
      title: body.title,
      credits: body.credits,
      status: body.status,
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    const [next] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    if (!next) throw notFound('Curriculum course not found after update')
    await syncCurriculumCourseIntoImport(context, {
      curriculumCourse: next,
      actorFacultyId: auth.facultyId,
      now,
    })
    const { resolved: afterResolved, curriculumImportVersionId } = await rematerializeResolvedBatchCurriculum(context, {
      batchId: next.batchId,
      actorFacultyId: auth.facultyId,
      now,
    })
    let previousBatchImportVersionId: string | null = null
    if (current.batchId !== next.batchId) {
      const previousBatchRematerialized = await rematerializeResolvedBatchCurriculum(context, {
        batchId: current.batchId,
        actorFacultyId: auth.facultyId,
        now,
      })
      previousBatchImportVersionId = previousBatchRematerialized.curriculumImportVersionId
      await regenerateCurriculumLinkageCandidatesForBatch(context, {
        batchId: current.batchId,
        now,
      })
    }
    await regenerateCurriculumLinkageCandidatesForBatch(context, {
      batchId: next.batchId,
      targetCurriculumCourseIds: [next.curriculumCourseId],
      now,
    })
    const affectedBatchIds = Array.from(new Set([
      ...((beforeResolvedByBatchId.get(next.batchId) ?? '') !== afterResolved.curriculumFeatureProfileFingerprint ? [next.batchId] : []),
      ...(current.batchId !== next.batchId && previousBatchImportVersionId !== null ? [current.batchId] : []),
    ]))
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: affectedBatchIds,
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId: curriculumImportVersionId ?? previousBatchImportVersionId,
    })
    const [persisted] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumCourse',
      entityId: params.curriculumCourseId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumCourse(current),
      after: mapCurriculumCourse(persisted ?? next),
    })
    return {
      ...mapCurriculumCourse(persisted ?? next),
      proofRefresh,
    }
  })

  app.get('/api/admin/batches/:batchId/curriculum-feature-config', {
    schema: { tags: ['admin-structure'], summary: 'List sysadmin-owned model feature inputs for a batch curriculum' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    return resolveBatchCurriculumFeatures(context, params.batchId)
  })

  app.post('/api/admin/batches/:batchId/curriculum/bootstrap', {
    schema: { tags: ['admin-structure'], summary: 'Bootstrap a supported curriculum manifest into the selected batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumBootstrapSchema, request.body ?? {})
    const now = context.now()
    const result = await bootstrapCurriculumManifestForBatch(context, {
      batchId: params.batchId,
      manifestKey: body.manifestKey,
      actorFacultyId: auth.facultyId,
      now,
    })
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: [params.batchId],
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId: result.curriculumImportVersionId,
    })
    await emitAuditEvent(context, {
      entityType: 'CurriculumBootstrap',
      entityId: `${params.batchId}:${body.manifestKey}`,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        batchId: params.batchId,
        manifestKey: body.manifestKey,
        ...result,
      },
    })
    return {
      ok: true,
      batchId: params.batchId,
      manifestKey: body.manifestKey,
      affectedBatchIds: [params.batchId],
      proofRefresh,
      ...result,
    }
  })

  app.get('/api/admin/batches/:batchId/curriculum/linkage-candidates', {
    schema: { tags: ['admin-structure'], summary: 'List persisted curriculum linkage candidates for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const query = parseOrThrow(z.object({ curriculumCourseId: z.string().min(1).optional() }), request.query)
    const rows = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.batchId, params.batchId))
    return {
      items: rows
        .filter(row => row.status !== 'superseded')
        .filter(row => !query.curriculumCourseId || row.curriculumCourseId === query.curriculumCourseId)
        .map(mapCurriculumLinkageCandidate)
        .sort((left, right) => right.confidenceScaled - left.confidenceScaled || left.targetCourseCode.localeCompare(right.targetCourseCode)),
    }
  })

  app.post('/api/admin/batches/:batchId/curriculum/linkage-candidates/regenerate', {
    schema: { tags: ['admin-structure'], summary: 'Regenerate curriculum linkage candidates for a batch or one course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumLinkageCandidateRegenerateSchema, request.body ?? {})
    const result = await regenerateCurriculumLinkageCandidatesForBatch(context, {
      batchId: params.batchId,
      targetCurriculumCourseIds: body.curriculumCourseId ? [body.curriculumCourseId] : null,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'CurriculumLinkageCandidate',
      entityId: `${params.batchId}:${body.curriculumCourseId ?? 'all'}`,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        batchId: params.batchId,
        curriculumCourseId: body.curriculumCourseId ?? null,
        generatedCount: result.items.length,
        candidateGenerationStatus: result.candidateGenerationStatus,
      },
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumCourseId: body.curriculumCourseId ?? null,
      items: result.items,
      candidateGenerationStatus: result.candidateGenerationStatus,
    }
  })

  app.post('/api/admin/batches/:batchId/curriculum/linkage-candidates/:curriculumLinkageCandidateId/approve', {
    schema: { tags: ['admin-structure'], summary: 'Approve a curriculum linkage candidate' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({
      batchId: z.string().min(1),
      curriculumLinkageCandidateId: z.string().min(1),
    }), request.params)
    const body = parseOrThrow(curriculumLinkageCandidateReviewSchema, request.body ?? {})
    const result = await approveCurriculumLinkageCandidate(context, {
      batchId: params.batchId,
      curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
      actorFacultyId: auth.facultyId,
      reviewNote: body.reviewNote ?? null,
      now: context.now(),
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
      ...result,
    }
  })

  app.post('/api/admin/batches/:batchId/curriculum/linkage-candidates/:curriculumLinkageCandidateId/reject', {
    schema: { tags: ['admin-structure'], summary: 'Reject a curriculum linkage candidate' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({
      batchId: z.string().min(1),
      curriculumLinkageCandidateId: z.string().min(1),
    }), request.params)
    const body = parseOrThrow(curriculumLinkageCandidateReviewSchema, request.body ?? {})
    const [current] = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, params.curriculumLinkageCandidateId))
    if (!current || current.batchId !== params.batchId) throw notFound('Curriculum linkage candidate not found')
    const now = context.now()
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'rejected',
      reviewNote: body.reviewNote ?? null,
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, params.curriculumLinkageCandidateId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumLinkageCandidate',
      entityId: params.curriculumLinkageCandidateId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumLinkageCandidate(current),
      after: mapCurriculumLinkageCandidate({
        ...current,
        status: 'rejected',
        reviewNote: body.reviewNote ?? null,
        version: current.version + 1,
        updatedAt: now,
      }),
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
    }
  })

  app.put('/api/admin/batches/:batchId/curriculum-feature-config/:curriculumCourseId', {
    schema: { tags: ['admin-structure'], summary: 'Save sysadmin-owned model feature inputs for one curriculum course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({
      batchId: z.string().min(1),
      curriculumCourseId: z.string().min(1),
    }), request.params)
    const body = parseOrThrow(curriculumFeatureConfigSaveSchema, request.body)
    const [curriculumCourse] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    if (!curriculumCourse || curriculumCourse.batchId !== params.batchId) throw notFound('Curriculum course not found')
    const normalizedPayload = normalizeCurriculumFeaturePayload(body)
    const beforeBatchFingerprints = new Map<string, string>()
    const now = context.now()
    const courseRecord = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    const activeBatchCurriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, params.batchId)))
      .filter(row => row.status !== 'deleted' && row.status !== 'archived')

    if (body.targetMode === 'scope-profile') {
      const targetScopeType = body.targetScopeType ?? 'branch'
      const targetScopeId = body.targetScopeId
        ?? (targetScopeType === 'batch' ? params.batchId : null)
      if (!targetScopeId) throw badRequest('Scope profile save requires a target scope id')
      await assertScopeExists(context, targetScopeType, targetScopeId)
      const affectedCandidateBatches = await listBatchesInScope(context, targetScopeType, targetScopeId)
      for (const candidate of affectedCandidateBatches) {
        const resolved = await resolveBatchCurriculumFeatures(context, candidate.batchId)
        beforeBatchFingerprints.set(candidate.batchId, resolved.curriculumFeatureProfileFingerprint)
      }
      for (const candidate of affectedCandidateBatches) {
        const candidateCurriculumRows = candidate.batchId === params.batchId
          ? activeBatchCurriculumRows
          : (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, candidate.batchId)))
            .filter(row => row.status !== 'deleted' && row.status !== 'archived')
        const targetCurriculumCourse = candidateCurriculumRows.find(row => matchesCourseReference({
          courseId: courseRecord.courseId,
          courseCode: curriculumCourse.courseCode,
          title: curriculumCourse.title,
        }, row)) ?? null
        if (!targetCurriculumCourse) continue
        validateCurriculumFeaturePayloadForCourse({
          batchId: candidate.batchId,
          batchCurriculumRows: candidateCurriculumRows,
          curriculumCourseId: targetCurriculumCourse.curriculumCourseId,
          payload: normalizedPayload,
        })
      }

      const profileRow = body.curriculumFeatureProfileId
        ? (await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, body.curriculumFeatureProfileId)))[0] ?? null
        : (await context.db.select().from(curriculumFeatureProfiles)).find(row => row.scopeType === targetScopeType && row.scopeId === targetScopeId && row.status === 'active') ?? null
      const ensuredProfile = profileRow ?? {
        curriculumFeatureProfileId: createId('curriculum_feature_profile'),
        name: `${targetScopeType.replace(/-/g, ' ')} feature profile`,
        scopeType: targetScopeType,
        scopeId: targetScopeId,
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      if (!profileRow) {
        await context.db.insert(curriculumFeatureProfiles).values(ensuredProfile)
      }
      const existingProfileCourse = (await context.db.select().from(curriculumFeatureProfileCourses))
        .find(row => row.curriculumFeatureProfileId === ensuredProfile.curriculumFeatureProfileId && matchesCourseReference({
          courseId: courseRecord.courseId,
          courseCode: curriculumCourse.courseCode,
          title: curriculumCourse.title,
        }, {
          courseId: row.courseId,
          courseCode: row.courseCode,
          title: row.title,
        })) ?? null
      const fingerprint = curriculumFeatureFingerprint(normalizedPayload)
      if (existingProfileCourse) {
        await context.db.update(curriculumFeatureProfileCourses).set({
          courseId: courseRecord.courseId,
          courseCode: curriculumCourse.courseCode,
          title: curriculumCourse.title,
          assessmentProfile: normalizedPayload.assessmentProfile,
          outcomesJson: stringifyJson(normalizedPayload.outcomes),
          prerequisitesJson: stringifyJson(normalizedPayload.prerequisites),
          bridgeModulesJson: stringifyJson(normalizedPayload.bridgeModules),
          topicPartitionsJson: stringifyJson(normalizedPayload.topicPartitions),
          featureFingerprint: fingerprint,
          status: 'active',
          version: existingProfileCourse.version + 1,
          updatedAt: now,
        }).where(eq(curriculumFeatureProfileCourses.curriculumFeatureProfileCourseId, existingProfileCourse.curriculumFeatureProfileCourseId))
      } else {
        await context.db.insert(curriculumFeatureProfileCourses).values({
          curriculumFeatureProfileCourseId: createId('curriculum_feature_profile_course'),
          curriculumFeatureProfileId: ensuredProfile.curriculumFeatureProfileId,
          courseId: courseRecord.courseId,
          courseCode: curriculumCourse.courseCode,
          title: curriculumCourse.title,
          assessmentProfile: normalizedPayload.assessmentProfile,
          outcomesJson: stringifyJson(normalizedPayload.outcomes),
          prerequisitesJson: stringifyJson(normalizedPayload.prerequisites),
          bridgeModulesJson: stringifyJson(normalizedPayload.bridgeModules),
          topicPartitionsJson: stringifyJson(normalizedPayload.topicPartitions),
          featureFingerprint: fingerprint,
          status: 'active',
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
      }

      const affectedBatchIds: string[] = []
      let lastImportVersionId: string | null = null
      for (const candidate of affectedCandidateBatches) {
        const binding = await context.db.select().from(batchCurriculumFeatureBindings).where(eq(batchCurriculumFeatureBindings.batchId, candidate.batchId)).then(rows => rows[0] ?? null)
        if (binding?.bindingMode === 'local-only' || binding?.status === 'archived') continue
        const localOverride = await context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, candidate.batchId)).then(rows => rows.find(row => (
          row.curriculumCourseId === params.curriculumCourseId
          || row.courseId === courseRecord.courseId
          || row.courseCode.toLowerCase() === curriculumCourse.courseCode.toLowerCase()
        )) ?? null)
        if (localOverride?.status === 'active') continue
        const afterResolved = await resolveBatchCurriculumFeatures(context, candidate.batchId)
        const matchingItems = afterResolved.items.filter(item => matchesCourseReference({
          courseId: courseRecord.courseId,
          courseCode: curriculumCourse.courseCode,
          title: curriculumCourse.title,
        }, item))
        if (matchingItems.length === 0) continue
        lastImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
          batchId: candidate.batchId,
          actorFacultyId: auth.facultyId,
          now,
          items: matchingItems.map(item => ({
            curriculumCourseId: item.curriculumCourseId,
            resolvedConfig: item.resolvedConfig,
          })),
        })
        await regenerateCurriculumLinkageCandidatesForBatch(context, {
          batchId: candidate.batchId,
          targetCurriculumCourseIds: matchingItems.map(item => item.curriculumCourseId),
          now,
        })
        if ((beforeBatchFingerprints.get(candidate.batchId) ?? '') !== afterResolved.curriculumFeatureProfileFingerprint) {
          affectedBatchIds.push(candidate.batchId)
        }
      }
      const proofRefresh = await enqueueProofRefreshForBatches(context, {
        batchIds: affectedBatchIds,
        actorFacultyId: auth.facultyId,
        now,
        curriculumImportVersionId: lastImportVersionId,
      })

      await emitAuditEvent(context, {
        entityType: 'CurriculumFeatureProfileCourse',
        entityId: `${ensuredProfile.curriculumFeatureProfileId}:${params.curriculumCourseId}`,
        action: 'updated',
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        after: {
          curriculumFeatureProfileId: ensuredProfile.curriculumFeatureProfileId,
          scopeType: ensuredProfile.scopeType,
          scopeId: ensuredProfile.scopeId,
          courseCode: curriculumCourse.courseCode,
          config: normalizedPayload,
          affectedBatchIds,
        },
      })

      return {
        ok: true,
        batchId: params.batchId,
        curriculumCourseId: params.curriculumCourseId,
        curriculumImportVersionId: lastImportVersionId,
        affectedBatchIds,
        proofRefresh,
        targetMode: body.targetMode,
        curriculumFeatureProfileId: ensuredProfile.curriculumFeatureProfileId,
      }
    }

    const beforeResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
    validateCurriculumFeaturePayloadForCourse({
      batchId: params.batchId,
      batchCurriculumRows: activeBatchCurriculumRows,
      curriculumCourseId: params.curriculumCourseId,
      payload: normalizedPayload,
    })
    const existingOverride = (await context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, params.batchId)))
      .find(row => row.curriculumCourseId === params.curriculumCourseId) ?? null
    const fingerprint = curriculumFeatureFingerprint(normalizedPayload)
    if (existingOverride) {
      await context.db.update(batchCurriculumFeatureOverrides).set({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        overrideJson: stringifyJson(normalizedPayload),
        featureFingerprint: fingerprint,
        status: 'active',
        version: existingOverride.version + 1,
        updatedAt: now,
      }).where(eq(batchCurriculumFeatureOverrides.batchCurriculumFeatureOverrideId, existingOverride.batchCurriculumFeatureOverrideId))
    } else {
      await context.db.insert(batchCurriculumFeatureOverrides).values({
        batchCurriculumFeatureOverrideId: createId('batch_curriculum_feature_override'),
        batchId: params.batchId,
        curriculumCourseId: params.curriculumCourseId,
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        overrideJson: stringifyJson(normalizedPayload),
        featureFingerprint: fingerprint,
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const afterResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
    const matchingItem = afterResolved.items.find(item => item.curriculumCourseId === params.curriculumCourseId)
    if (!matchingItem) throw notFound('Resolved curriculum feature item not found after save')
    const curriculumImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
      batchId: params.batchId,
      actorFacultyId: auth.facultyId,
      now,
      items: [{
        curriculumCourseId: params.curriculumCourseId,
        resolvedConfig: matchingItem.resolvedConfig,
      }],
    })
    await regenerateCurriculumLinkageCandidatesForBatch(context, {
      batchId: params.batchId,
      targetCurriculumCourseIds: [params.curriculumCourseId],
      now,
    })
    const affectedBatchIds = (beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint)
      ? [params.batchId]
      : []
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: affectedBatchIds,
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId,
    })

    await emitAuditEvent(context, {
      entityType: 'CurriculumFeatureConfig',
      entityId: `${params.batchId}:${params.curriculumCourseId}`,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        curriculumCourseId: params.curriculumCourseId,
        curriculumImportVersionId,
        assessmentProfile: normalizedPayload.assessmentProfile,
        outcomes: normalizedPayload.outcomes,
        prerequisites: normalizedPayload.prerequisites,
        bridgeModules: normalizedPayload.bridgeModules,
        topicPartitions: normalizedPayload.topicPartitions,
      },
    })

    return {
      ok: true,
      batchId: params.batchId,
      curriculumCourseId: params.curriculumCourseId,
      curriculumImportVersionId,
      affectedBatchIds,
      proofRefresh,
      targetMode: body.targetMode,
      curriculumFeatureProfileId: null,
    }
  })

  app.get('/api/admin/curriculum-feature-profiles', {
    schema: { tags: ['admin-structure'], summary: 'List curriculum feature profiles' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(curriculumFeatureProfileFilterSchema, request.query)
    const rows = await context.db.select().from(curriculumFeatureProfiles)
    return {
      items: rows
        .filter(item => (!query.scopeType || item.scopeType === query.scopeType) && (!query.scopeId || item.scopeId === query.scopeId))
        .map(mapCurriculumFeatureProfile),
    }
  })

  app.post('/api/admin/curriculum-feature-profiles', {
    schema: { tags: ['admin-structure'], summary: 'Create a curriculum feature profile' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(curriculumFeatureProfileCreateSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const existing = await context.db.select().from(curriculumFeatureProfiles)
    if (existing.some(item => item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')) {
      throw conflict('An active curriculum feature profile already exists for this scope')
    }
    const created = {
      curriculumFeatureProfileId: createId('curriculum_feature_profile'),
      name: body.name,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(curriculumFeatureProfiles).values(created)
    await emitAuditEvent(context, {
      entityType: 'CurriculumFeatureProfile',
      entityId: created.curriculumFeatureProfileId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapCurriculumFeatureProfile(created),
    })
    return mapCurriculumFeatureProfile(created)
  })

  app.patch('/api/admin/curriculum-feature-profiles/:curriculumFeatureProfileId', {
    schema: { tags: ['admin-structure'], summary: 'Update a curriculum feature profile' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ curriculumFeatureProfileId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumFeatureProfilePatchSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const [current] = await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, params.curriculumFeatureProfileId))
    if (!current) throw notFound('Curriculum feature profile not found')
    expectVersion(current.version, body.version, 'CurriculumFeatureProfile', mapCurriculumFeatureProfile(current))
    const rows = await context.db.select().from(curriculumFeatureProfiles)
    const duplicate = rows.find(item => item.curriculumFeatureProfileId !== params.curriculumFeatureProfileId && item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')
    if (duplicate) throw conflict('An active curriculum feature profile already exists for this scope')
    await context.db.update(curriculumFeatureProfiles).set({
      name: body.name,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, params.curriculumFeatureProfileId))
    const [next] = await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, params.curriculumFeatureProfileId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumFeatureProfile',
      entityId: params.curriculumFeatureProfileId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumFeatureProfile(current),
      after: mapCurriculumFeatureProfile(next),
    })
    return mapCurriculumFeatureProfile(next)
  })

  app.put('/api/admin/batches/:batchId/curriculum-feature-binding', {
    schema: { tags: ['admin-structure'], summary: 'Save a batch curriculum feature binding' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumFeatureBindingSaveSchema, request.body)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    if (!batch) throw notFound('Batch not found')
    if (body.bindingMode === 'pin-profile' && !body.curriculumFeatureProfileId) {
      throw badRequest('Pinned profile binding requires a curriculum feature profile id')
    }
    if (body.curriculumFeatureProfileId) {
      const [profile] = await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, body.curriculumFeatureProfileId))
      if (!profile || profile.status !== 'active') throw notFound('Pinned curriculum feature profile not found')
    }
    const beforeResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
    const [current] = await context.db.select().from(batchCurriculumFeatureBindings).where(eq(batchCurriculumFeatureBindings.batchId, params.batchId))
    const now = context.now()
    if (current) {
      if (body.version != null) expectVersion(current.version, body.version, 'BatchCurriculumFeatureBinding', mapBatchCurriculumFeatureBinding(current))
      await context.db.update(batchCurriculumFeatureBindings).set({
        curriculumFeatureProfileId: body.bindingMode === 'pin-profile' ? (body.curriculumFeatureProfileId ?? null) : null,
        bindingMode: body.bindingMode,
        status: body.status,
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(batchCurriculumFeatureBindings.batchId, params.batchId))
    } else {
      await context.db.insert(batchCurriculumFeatureBindings).values({
        batchId: params.batchId,
        curriculumFeatureProfileId: body.bindingMode === 'pin-profile' ? (body.curriculumFeatureProfileId ?? null) : null,
        bindingMode: body.bindingMode,
        status: body.status,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }
    const afterResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
    const curriculumImportVersionId = afterResolved.items.length > 0
      ? await materializeResolvedCurriculumFeatureItems(context, {
          batchId: params.batchId,
          actorFacultyId: auth.facultyId,
          now,
          items: afterResolved.items.map(item => ({
            curriculumCourseId: item.curriculumCourseId,
            resolvedConfig: item.resolvedConfig,
          })),
        })
      : null
    const affectedBatchIds = beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint ? [params.batchId] : []
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: affectedBatchIds,
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId,
    })
    await emitAuditEvent(context, {
      entityType: 'BatchCurriculumFeatureBinding',
      entityId: params.batchId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        batchId: params.batchId,
        bindingMode: body.bindingMode,
        curriculumFeatureProfileId: body.curriculumFeatureProfileId ?? null,
      },
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumImportVersionId,
      affectedBatchIds,
      proofRefresh,
      binding: afterResolved.binding,
    }
  })

  app.get('/api/admin/stage-policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'List stage policy overrides' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(stagePolicyFilterSchema, request.query)
    const rows = await context.db.select().from(stagePolicyOverrides)
    return {
      items: rows
        .filter(item => (!query.scopeType || item.scopeType === query.scopeType) && (!query.scopeId || item.scopeId === query.scopeId))
        .map(mapStagePolicyOverride),
    }
  })

  app.post('/api/admin/stage-policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'Create stage policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(stagePolicyOverrideCreateSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const existing = await context.db.select().from(stagePolicyOverrides)
    if (existing.some(item => item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')) {
      throw conflict('A stage policy override already exists for this scope')
    }
    const created = {
      stagePolicyOverrideId: createId('stage_policy_override'),
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(stagePolicyOverrides).values(created)
    await emitAuditEvent(context, {
      entityType: 'StagePolicyOverride',
      entityId: created.stagePolicyOverrideId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapStagePolicyOverride(created),
    })
    return mapStagePolicyOverride(created)
  })

  app.patch('/api/admin/stage-policy-overrides/:stagePolicyOverrideId', {
    schema: { tags: ['admin-structure'], summary: 'Update a stage policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ stagePolicyOverrideId: z.string().min(1) }), request.params)
    const body = parseOrThrow(stagePolicyOverridePatchSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const [current] = await context.db.select().from(stagePolicyOverrides).where(eq(stagePolicyOverrides.stagePolicyOverrideId, params.stagePolicyOverrideId))
    if (!current) throw notFound('Stage policy override not found')
    expectVersion(current.version, body.version, 'StagePolicyOverride', mapStagePolicyOverride(current))
    const rows = await context.db.select().from(stagePolicyOverrides)
    const duplicate = rows.find(item => item.stagePolicyOverrideId !== params.stagePolicyOverrideId && item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')
    if (duplicate) throw conflict('A stage policy override already exists for this scope')
    await context.db.update(stagePolicyOverrides).set({
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(stagePolicyOverrides.stagePolicyOverrideId, params.stagePolicyOverrideId))
    const [next] = await context.db.select().from(stagePolicyOverrides).where(eq(stagePolicyOverrides.stagePolicyOverrideId, params.stagePolicyOverrideId))
    await emitAuditEvent(context, {
      entityType: 'StagePolicyOverride',
      entityId: params.stagePolicyOverrideId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapStagePolicyOverride(current),
      after: mapStagePolicyOverride(next),
    })
    return mapStagePolicyOverride(next)
  })

  app.get('/api/admin/policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'List policy overrides' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(policyFilterSchema, request.query)
    const rows = await context.db.select().from(policyOverrides)
    return {
      items: rows
        .filter(item => (!query.scopeType || item.scopeType === query.scopeType) && (!query.scopeId || item.scopeId === query.scopeId))
        .map(mapPolicyOverride),
    }
  })

  app.post('/api/admin/policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'Create policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(policyOverrideCreateSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const existing = await context.db.select().from(policyOverrides)
    if (existing.some(item => item.scopeType === body.scopeType && item.scopeId === body.scopeId)) {
      throw conflict('A policy override already exists for this scope')
    }
    const created = {
      policyOverrideId: createId('policy'),
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(policyOverrides).values(created)
    await emitAuditEvent(context, {
      entityType: 'PolicyOverride',
      entityId: created.policyOverrideId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapPolicyOverride(created),
    })
    return mapPolicyOverride(created)
  })

  app.patch('/api/admin/policy-overrides/:policyOverrideId', {
    schema: { tags: ['admin-structure'], summary: 'Update policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ policyOverrideId: z.string().min(1) }), request.params)
    const body = parseOrThrow(policyOverridePatchSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const [current] = await context.db.select().from(policyOverrides).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    if (!current) throw notFound('Policy override not found')
    expectVersion(current.version, body.version, 'PolicyOverride', mapPolicyOverride(current))
    const rows = await context.db.select().from(policyOverrides)
    const duplicate = rows.find(item => item.policyOverrideId !== params.policyOverrideId && item.scopeType === body.scopeType && item.scopeId === body.scopeId)
    if (duplicate) throw conflict('A policy override already exists for this scope')
    await context.db.update(policyOverrides).set({
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    const [next] = await context.db.select().from(policyOverrides).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    await emitAuditEvent(context, {
      entityType: 'PolicyOverride',
      entityId: params.policyOverrideId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapPolicyOverride(current),
      after: mapPolicyOverride(next),
    })
    return mapPolicyOverride(next)
  })

  app.get('/api/admin/batches/:batchId/resolved-policy', {
    schema: { tags: ['admin-structure'], summary: 'Resolve the effective policy for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    return resolveBatchPolicy(context, params.batchId)
  })

  app.get('/api/admin/batches/:batchId/resolved-stage-policy', {
    schema: { tags: ['admin-structure'], summary: 'Resolve the effective stage policy for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    return resolveBatchStagePolicy(context, params.batchId)
  })

  app.post('/api/admin/batches/:batchId/resolved-policy', {
    schema: { tags: ['admin-structure'], summary: 'Prevent unsupported writes to resolved policy endpoint' },
  }, async () => {
    throw badRequest('Resolved policy is derived. Update the relevant policy override scope instead.')
  })
}
