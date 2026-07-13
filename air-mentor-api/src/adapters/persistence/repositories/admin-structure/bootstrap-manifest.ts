/**
 * bootstrapCurriculumManifestForBatch — seed a supported curriculum manifest
 * into a batch (feature profile + curriculum rows + materialise + candidates).
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import {
  batches,
  branches,
  curriculumCourses,
  curriculumFeatureProfiles,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { notFound } from '../../../../lib/http-errors.js'
import { createId } from '../../../../lib/ids.js'
import {
  buildManifestPayloadItems,
  supportedCurriculumManifestKeySchema,
} from '../../../../lib/curriculum-linkage.js'
import { normalizeCurriculumFeaturePayload } from '../../../../application/use-cases/admin-structure/feature-domain.js'
import { ensureCourseRecordForCurriculumCourse } from './curriculum-import-core.js'
import { upsertCurriculumFeatureProfileCourseRecord } from './profile-course-writes.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'
import { materializeResolvedCurriculumFeatureItems } from './materialize-resolved.js'
import { regenerateCurriculumLinkageCandidatesForBatch } from './regenerate-linkage-candidates.js'

export async function bootstrapCurriculumManifestForBatch(context: RouteContext, input: {
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
