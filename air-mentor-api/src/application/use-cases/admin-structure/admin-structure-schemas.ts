/**
 * Admin-structure request/entity Zod schemas + policy value types.
 *
 * Persistence-free: pure zod schemas and derived types shared by the
 * admin-structure controller, use-cases, and Drizzle repositories. Moved
 * verbatim from modules/admin-structure.ts — no schema/refinement changes.
 */
import { z } from 'zod'
import {
  scopeTypeValues,
  stagePolicyPayloadSchema,
} from '../../../lib/stage-policy.js'
import { supportedCurriculumManifestKeySchema } from '../../../lib/curriculum-linkage.js'

const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
export const scopeTypeSchema = z.enum(scopeTypeValues)

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

const remediationRulesSchema = z.object({
  allowReSit: z.boolean(),
  maxReSitAttempts: z.number().int().min(0).max(10),
  reSitEligibilityMinAttendance: z.number().min(0).max(100),
  reSitEligibilityMinCe: z.number().min(0).max(100),
  allowReRegister: z.boolean(),
  maxReRegisterAttempts: z.number().int().min(0).max(10),
})

const yearBackRulesSchema = z.object({
  enableYearBack: z.boolean(),
  detentionAfterConsecutiveFailures: z.number().int().min(0).max(10),
  yearBackMinimumSemester: z.number().int().min(1).max(12),
  allowPromotionWithBacklogs: z.boolean(),
  promotionBacklogCreditLimit: z.number().int().min(0).max(100),
  yearBackTriggerCredits: z.number().int().min(0).max(100),
  yearBackTriggerFailedCourses: z.number().int().min(0).max(50),
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
  remediationRules: remediationRulesSchema.optional(),
  yearBackRules: yearBackRulesSchema.optional(),
  riskRules: riskRulesSchema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one policy segment must be provided.',
})

export const academicFacultyCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  overview: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

export const academicFacultyPatchSchema = academicFacultyCreateSchema.extend({
  version: z.number().int().positive(),
})

export const batchCreateSchema = z.object({
  branchId: z.string().min(1),
  admissionYear: z.number().int().min(2000).max(2100),
  batchLabel: z.string().min(1),
  currentSemester: z.number().int().positive(),
  sectionLabels: z.array(z.string().min(1)).default([]),
  status: z.string().min(1).default('active'),
})

export const batchPatchSchema = batchCreateSchema.extend({
  version: z.number().int().positive(),
})

export const curriculumCourseCreateSchema = z.object({
  batchId: z.string().min(1),
  semesterNumber: z.number().int().positive(),
  courseId: z.string().min(1).optional().nullable(),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().int().positive(),
  status: z.string().min(1).default('active'),
})

export const curriculumCoursePatchSchema = curriculumCourseCreateSchema.extend({
  version: z.number().int().positive(),
})

export const curriculumFeatureOutcomeSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  bloom: z.string().min(1),
})

export const curriculumFeatureEdgeSchema = z.object({
  sourceCourseCode: z.string().min(1),
  edgeKind: z.enum(['explicit', 'added']),
  rationale: z.string().min(1),
})

export const curriculumFeatureTopicSchema = z.object({
  tt1: z.array(z.string().min(1)).default([]),
  tt2: z.array(z.string().min(1)).default([]),
  see: z.array(z.string().min(1)).default([]),
  workbook: z.array(z.string().min(1)).default([]),
})

export const curriculumFeatureConfigPatchSchema = z.object({
  assessmentProfile: z.string().min(1).default('admin-authored'),
  outcomes: z.array(curriculumFeatureOutcomeSchema).min(1),
  prerequisites: z.array(curriculumFeatureEdgeSchema).default([]),
  bridgeModules: z.array(z.string().min(1)).default([]),
  topicPartitions: curriculumFeatureTopicSchema,
})

export const policyOverrideCreateSchema = z.object({
  scopeType: scopeTypeSchema,
  scopeId: z.string().min(1),
  policy: policyPayloadSchema,
  status: z.string().min(1).default('active'),
})

export const policyOverridePatchSchema = policyOverrideCreateSchema.extend({
  version: z.number().int().positive(),
})

export const policyFilterSchema = z.object({
  scopeType: scopeTypeSchema.optional(),
  scopeId: z.string().min(1).optional(),
})

export const resolvedPolicyQuerySchema = z.object({
  sectionCode: z.string().trim().min(1).optional(),
})

export const stagePolicyOverrideCreateSchema = z.object({
  scopeType: z.enum(scopeTypeValues),
  scopeId: z.string().min(1),
  policy: stagePolicyPayloadSchema,
  status: z.string().min(1).default('active'),
})

export const stagePolicyOverridePatchSchema = stagePolicyOverrideCreateSchema.extend({
  version: z.number().int().positive(),
})

export const stagePolicyFilterSchema = z.object({
  scopeType: z.enum(scopeTypeValues).optional(),
  scopeId: z.string().min(1).optional(),
})

export const curriculumFeatureProfileCreateSchema = z.object({
  name: z.string().min(1),
  scopeType: z.enum(scopeTypeValues),
  scopeId: z.string().min(1),
  status: z.string().min(1).default('active'),
})

export const curriculumFeatureProfilePatchSchema = curriculumFeatureProfileCreateSchema.extend({
  version: z.number().int().positive(),
})

export const curriculumFeatureProfileFilterSchema = z.object({
  scopeType: z.enum(scopeTypeValues).optional(),
  scopeId: z.string().min(1).optional(),
})

const curriculumFeatureBindingModeSchema = z.enum(['inherit-scope-profile', 'pin-profile', 'local-only'])

export const curriculumFeatureBindingSaveSchema = z.object({
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

export const curriculumFeatureConfigSaveSchema = curriculumFeatureConfigPatchSchema.merge(curriculumFeatureConfigTargetSchema)

export const curriculumBootstrapSchema = z.object({
  manifestKey: supportedCurriculumManifestKeySchema.default('msruas-mnc-seed'),
})

export const curriculumLinkageCandidateRegenerateSchema = z.object({
  curriculumCourseId: z.string().min(1).optional(),
})

export const curriculumLinkageCandidateReviewSchema = z.object({
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
  remediationRules: z.infer<typeof remediationRulesSchema>
  yearBackRules: z.infer<typeof yearBackRulesSchema>
  riskRules: z.infer<typeof riskRulesSchema>
}

export type CurriculumFeatureProfileCoursePayload = z.infer<typeof curriculumFeatureConfigPatchSchema>
