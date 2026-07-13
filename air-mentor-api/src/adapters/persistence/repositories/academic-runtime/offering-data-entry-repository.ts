/**
 * Drizzle data access for the offering data-entry writes: attendance snapshots,
 * assessment scores, offering column patches, assessment schemes, and question
 * papers. Queries are moved verbatim from modules/academic-runtime-routes.ts
 * (`context.db` -> injected `db`); PK-only ids are generated here with
 * `createId`, exactly as the legacy inline inserts did.
 */
import { and, eq, inArray, not } from 'drizzle-orm'
import {
  courseOutcomeOverrides,
  offeringAssessmentSchemes,
  offeringQuestionPapers,
  sectionOfferings,
  studentAssessmentScores,
  studentAttendanceSnapshots,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { createId } from '../../../../lib/ids.js'
import type {
  CourseOutcomeOverrideRow,
  InsertAssessmentScoreInput,
  InsertAttendanceSnapshotInput,
  OfferingAssessmentSchemeRow,
  OfferingQuestionPaperRow,
  OfferingWritePatch,
  UpsertQuestionPaperFields,
  UpsertSchemeFields,
} from '../../../../application/ports/academic-runtime-repository.js'

export async function insertAttendanceSnapshot(
  db: AppDb,
  input: InsertAttendanceSnapshotInput,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  await db.insert(studentAttendanceSnapshots).values({
    attendanceSnapshotId: createId('attendance'),
    studentId: input.studentId,
    offeringId: input.offeringId,
    presentClasses: input.presentClasses,
    totalClasses: input.totalClasses,
    attendancePercent: input.attendancePercent,
    source: input.source,
    capturedAt: input.capturedAt,
    createdAt,
    updatedAt,
  })
}

export async function updateOfferingFields(db: AppDb, offeringId: string, patch: OfferingWritePatch): Promise<void> {
  await db.update(sectionOfferings).set(patch).where(eq(sectionOfferings.offeringId, offeringId))
}

export async function getSchemeByOffering(db: AppDb, offeringId: string): Promise<OfferingAssessmentSchemeRow | undefined> {
  const [row] = await db
    .select()
    .from(offeringAssessmentSchemes)
    .where(eq(offeringAssessmentSchemes.offeringId, offeringId))
  return row
}

export function listActiveCourseOutcomeOverrides(db: AppDb, courseId: string): Promise<CourseOutcomeOverrideRow[]> {
  return db
    .select()
    .from(courseOutcomeOverrides)
    .where(and(
      eq(courseOutcomeOverrides.courseId, courseId),
      eq(courseOutcomeOverrides.status, 'active'),
    ))
}

export async function getQuestionPaperByOfferingKind(
  db: AppDb,
  offeringId: string,
  kind: string,
): Promise<OfferingQuestionPaperRow | undefined> {
  const [row] = await db
    .select()
    .from(offeringQuestionPapers)
    .where(and(
      eq(offeringQuestionPapers.offeringId, offeringId),
      eq(offeringQuestionPapers.kind, kind),
    ))
  return row
}

export function listScoreComponentTypes(db: AppDb, offeringId: string): Promise<Array<{ componentType: string }>> {
  return db
    .select({ componentType: studentAssessmentScores.componentType })
    .from(studentAssessmentScores)
    .where(eq(studentAssessmentScores.offeringId, offeringId))
}

export async function deleteStaleScores(
  db: AppDb,
  offeringId: string,
  componentTypes: string[],
  submittedStudentIds: string[],
): Promise<void> {
  const staleScoreWhere = and(
    eq(studentAssessmentScores.offeringId, offeringId),
    inArray(studentAssessmentScores.componentType, componentTypes),
    submittedStudentIds.length > 0 ? not(inArray(studentAssessmentScores.studentId, submittedStudentIds)) : undefined,
  )
  await db.delete(studentAssessmentScores).where(staleScoreWhere)
}

export async function deleteStudentScores(
  db: AppDb,
  studentId: string,
  offeringId: string,
  componentTypes: string[],
): Promise<void> {
  await db.delete(studentAssessmentScores).where(and(
    eq(studentAssessmentScores.studentId, studentId),
    eq(studentAssessmentScores.offeringId, offeringId),
    inArray(studentAssessmentScores.componentType, componentTypes),
  ))
}

export async function insertAssessmentScore(
  db: AppDb,
  input: InsertAssessmentScoreInput,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  await db.insert(studentAssessmentScores).values({
    assessmentScoreId: createId('assessment'),
    studentId: input.studentId,
    offeringId: input.offeringId,
    termId: input.termId,
    componentType: input.componentType,
    componentCode: input.componentCode,
    score: input.score,
    maxScore: input.maxScore,
    evaluatedAt: input.evaluatedAt,
    createdAt,
    updatedAt,
  })
}

export async function updateScheme(
  db: AppDb,
  offeringId: string,
  fields: UpsertSchemeFields,
  nextVersion: number,
  updatedAt: string,
): Promise<void> {
  await db.update(offeringAssessmentSchemes).set({
    configuredByFacultyId: fields.configuredByFacultyId,
    schemeJson: fields.schemeJson,
    policySnapshotJson: fields.policySnapshotJson,
    status: fields.status,
    version: nextVersion,
    updatedAt,
  }).where(eq(offeringAssessmentSchemes.offeringId, offeringId))
}

export async function insertScheme(
  db: AppDb,
  offeringId: string,
  fields: UpsertSchemeFields,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  await db.insert(offeringAssessmentSchemes).values({
    offeringId,
    configuredByFacultyId: fields.configuredByFacultyId,
    schemeJson: fields.schemeJson,
    policySnapshotJson: fields.policySnapshotJson,
    status: fields.status,
    version: 1,
    createdAt,
    updatedAt,
  })
}

export async function updateQuestionPaper(
  db: AppDb,
  paperId: string,
  blueprintJson: string,
  updatedByFacultyId: string | null,
  nextVersion: number,
  updatedAt: string,
): Promise<void> {
  await db.update(offeringQuestionPapers).set({
    blueprintJson,
    updatedByFacultyId,
    version: nextVersion,
    updatedAt,
  }).where(eq(offeringQuestionPapers.paperId, paperId))
}

export async function insertQuestionPaper(
  db: AppDb,
  fields: UpsertQuestionPaperFields,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  await db.insert(offeringQuestionPapers).values({
    paperId: createId('question_paper'),
    offeringId: fields.offeringId,
    kind: fields.kind,
    blueprintJson: fields.blueprintJson,
    updatedByFacultyId: fields.updatedByFacultyId,
    version: 1,
    createdAt,
    updatedAt,
  })
}
