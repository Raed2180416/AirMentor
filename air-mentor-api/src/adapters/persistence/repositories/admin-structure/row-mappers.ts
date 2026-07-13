/**
 * Drizzle row -> API DTO mappers for the admin-structure hierarchy entities.
 *
 * Schema-coupled (uses `typeof <table>.$inferSelect`), so it lives in the
 * persistence adapter layer. Every mapper is moved verbatim from
 * modules/admin-structure.ts.
 */
import { z } from 'zod'
import {
  academicFaculties,
  batches,
  batchCurriculumFeatureBindings,
  batchCurriculumFeatureOverrides,
  courseOutcomeOverrides,
  curriculumCourses,
  curriculumFeatureProfileCourses,
  curriculumFeatureProfiles,
  curriculumLinkageCandidates,
  policyOverrides,
  stagePolicyOverrides,
} from '../../../../db/schema.js'
import { parseJson } from '../../../../lib/json.js'
import {
  canonicalizeStagePolicy,
  DEFAULT_STAGE_POLICY,
  type ScopeTypeValue,
} from '../../../../lib/stage-policy.js'
import { parseOrThrow } from '../../../../modules/support.js'
import {
  curriculumFeatureConfigPatchSchema,
  curriculumFeatureEdgeSchema,
  curriculumFeatureOutcomeSchema,
  curriculumFeatureTopicSchema,
  type CurriculumFeatureProfileCoursePayload,
  type PolicyPayload,
} from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'

export function mapAcademicFaculty(row: typeof academicFaculties.$inferSelect) {
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

export function mapBatch(row: typeof batches.$inferSelect) {
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

export function mapCurriculumCourse(row: typeof curriculumCourses.$inferSelect) {
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

export function mapPolicyOverride(row: typeof policyOverrides.$inferSelect) {
  return {
    policyOverrideId: row.policyOverrideId,
    scopeType: row.scopeType as ScopeTypeValue,
    scopeId: row.scopeId,
    policy: parseJson(row.policyJson, {} as PolicyPayload),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapStagePolicyOverride(row: typeof stagePolicyOverrides.$inferSelect) {
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

export function mapCurriculumFeatureProfile(row: typeof curriculumFeatureProfiles.$inferSelect) {
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

export function mapBatchCurriculumFeatureBinding(row: typeof batchCurriculumFeatureBindings.$inferSelect | null) {
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

export function mapCurriculumFeatureProfileCourse(row: typeof curriculumFeatureProfileCourses.$inferSelect) {
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

export function mapBatchCurriculumFeatureOverride(row: typeof batchCurriculumFeatureOverrides.$inferSelect) {
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

export function mapCurriculumLinkageCandidate(row: typeof curriculumLinkageCandidates.$inferSelect) {
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

export function mapCourseOutcomeOverride(row: typeof courseOutcomeOverrides.$inferSelect) {
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
