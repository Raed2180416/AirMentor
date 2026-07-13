/**
 * Drizzle implementation of the AcademicOfferingsRepository port.
 *
 * Composition point for academic-offerings data access. Every query here is
 * moved verbatim from modules/academic-admin-offerings-routes.ts
 * (`context.db` -> injected `db`); ordering, filters and column sets are
 * unchanged. The retired batch-provision cascade is NOT part of this repo — it
 * stays as one cohesive transactional adapter file (provision-batch.ts).
 */
import { and, asc, eq } from 'drizzle-orm'
import {
  courseOutcomeOverrides,
  courses,
  facultyOfferingOwnerships,
  offeringStageAdvancementAudits,
  sectionOfferings,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentInterventions,
  transcriptSubjectResults,
  transcriptTermResults,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type { AcademicOfferingsRepository } from '../../../../application/ports/academic-offerings-repository.js'

export function createAcademicOfferingsRepository(db: AppDb): AcademicOfferingsRepository {
  return {
    // -- Course-outcome overrides ------------------------------------------
    listCourseOutcomeOverrides() {
      return db.select().from(courseOutcomeOverrides).orderBy(asc(courseOutcomeOverrides.createdAt))
    },

    listActiveCourseOutcomeOverridesForCourse(courseId) {
      return db
        .select()
        .from(courseOutcomeOverrides)
        .where(and(
          eq(courseOutcomeOverrides.courseId, courseId),
          eq(courseOutcomeOverrides.status, 'active'),
        ))
    },

    async getCourseOutcomeOverrideById(courseOutcomeOverrideId) {
      const [row] = await db
        .select()
        .from(courseOutcomeOverrides)
        .where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, courseOutcomeOverrideId))
      return row ?? null
    },

    async getCourseById(courseId) {
      const [row] = await db.select().from(courses).where(eq(courses.courseId, courseId))
      return row ?? null
    },

    async insertCourseOutcomeOverride(row) {
      await db.insert(courseOutcomeOverrides).values(row)
    },

    async updateCourseOutcomeOverride(courseOutcomeOverrideId, patch) {
      await db
        .update(courseOutcomeOverrides)
        .set(patch)
        .where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, courseOutcomeOverrideId))
    },

    // -- Section offerings --------------------------------------------------
    async getOfferingById(offeringId) {
      const [row] = await db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, offeringId))
      return row ?? null
    },

    async insertOffering(input) {
      await db.insert(sectionOfferings).values(input)
    },

    async updateOffering(offeringId, patch) {
      await db.update(sectionOfferings).set(patch).where(eq(sectionOfferings.offeringId, offeringId))
    },

    async updateOfferingStage(offeringId, patch) {
      await db.update(sectionOfferings).set(patch).where(eq(sectionOfferings.offeringId, offeringId))
    },

    async insertStageAdvancementAudit(input) {
      await db.insert(offeringStageAdvancementAudits).values(input)
    },

    // -- Bulk academic-signal ingestion ------------------------------------
    async insertAttendanceSnapshot(input) {
      await db.insert(studentAttendanceSnapshots).values(input)
    },

    async insertAssessmentScore(input) {
      await db.insert(studentAssessmentScores).values(input)
    },

    async insertIntervention(input) {
      await db.insert(studentInterventions).values(input)
    },

    async insertTranscriptTermResult(input) {
      await db.insert(transcriptTermResults).values(input)
    },

    async insertTranscriptSubjectResult(input) {
      await db.insert(transcriptSubjectResults).values(input)
    },

    // -- Offering ownership -------------------------------------------------
    listOfferingOwnerships() {
      return db.select().from(facultyOfferingOwnerships).orderBy(asc(facultyOfferingOwnerships.ownershipId))
    },

    async getOwnershipById(ownershipId) {
      const [row] = await db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, ownershipId))
      return row ?? null
    },

    async insertOwnership(input) {
      await db.insert(facultyOfferingOwnerships).values(input)
    },

    async updateOwnership(ownershipId, patch) {
      await db.update(facultyOfferingOwnerships).set(patch).where(eq(facultyOfferingOwnerships.ownershipId, ownershipId))
    },
  }
}
