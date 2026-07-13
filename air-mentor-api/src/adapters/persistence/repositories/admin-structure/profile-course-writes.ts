/**
 * upsertCurriculumFeatureProfileCourseRecord — insert/update one course's
 * feature config within a curriculum feature profile.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { eq } from 'drizzle-orm'
import {
  curriculumCourses,
  curriculumFeatureProfileCourses,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import type { CurriculumFeatureProfileCoursePayload } from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import {
  curriculumFeatureFingerprint,
  matchesCourseReference,
} from '../../../../application/use-cases/admin-structure/feature-domain.js'

export async function upsertCurriculumFeatureProfileCourseRecord(context: RouteContext, input: {
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
