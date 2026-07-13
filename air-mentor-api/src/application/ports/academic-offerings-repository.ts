/**
 * Academic-offerings repository port.
 *
 * Framework-free interface for every DB access the academic-offerings
 * use-cases need (course-outcome overrides, section offerings, stage
 * advancement audits, bulk academic-signal ingestion, and offering ownership).
 * MUST NOT import db/schema or drizzle-orm — the Drizzle implementation lives
 * under adapters/persistence (ESLint enforces this).
 *
 * The retired batch-provision cascade is intentionally NOT part of this port:
 * it stays as one cohesive transactional adapter file (provision-batch.ts) that
 * the controller calls directly, per the R9 no-split rule.
 */
import type {
  CourseOutcomeOverrideRow,
  CourseRef,
  OwnershipRow,
  SectionOfferingRow,
} from '../use-cases/academic-offerings/shared.js'

export type UpdateCourseOutcomeOverridePatch = {
  courseId: string
  scopeType: string
  scopeId: string
  outcomesJson: string
  status: string
  version: number
  updatedAt: string
}

export type InsertOfferingInput = {
  offeringId: string
  courseId: string
  termId: string
  branchId: string
  sectionCode: string
  yearLabel: string
  attendance: number
  studentCount: number
  stage: number
  stageLabel: string
  stageDescription: string
  stageColor: string
  tt1Done: number
  tt2Done: number
  tt1Locked: number
  tt2Locked: number
  quizLocked: number
  assignmentLocked: number
  finalsLocked: number
  pendingAction: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type UpdateOfferingPatch = {
  courseId: string
  termId: string
  branchId: string
  sectionCode: string
  yearLabel: string
  attendance: number
  studentCount: number
  stage: number
  stageLabel: string
  stageDescription: string
  stageColor: string
  tt1Done: number
  tt2Done: number
  tt1Locked: number
  tt2Locked: number
  quizLocked: number
  assignmentLocked: number
  finalsLocked: number
  pendingAction: string | null
  status: string
  version: number
  updatedAt: string
}

export type UpdateOfferingStagePatch = {
  stage: number
  stageLabel: string
  stageDescription: string
  stageColor: string
  version: number
  updatedAt: string
}

export type InsertStageAdvancementAuditInput = {
  offeringStageAdvancementAuditId: string
  offeringId: string
  batchId: string | null
  termId: string
  advancedByFacultyId: string | null
  fromStageKey: string
  toStageKey: string
  auditJson: string
  createdAt: string
  updatedAt: string
}

export type InsertAttendanceSnapshotInput = {
  attendanceSnapshotId: string
  studentId: string
  offeringId: string
  presentClasses: number
  totalClasses: number
  attendancePercent: number
  source: string
  capturedAt: string
  createdAt: string
  updatedAt: string
}

export type InsertAssessmentScoreInput = {
  assessmentScoreId: string
  studentId: string
  offeringId: string
  termId: string | null
  componentType: string
  componentCode: string | null
  score: number
  maxScore: number
  evaluatedAt: string
  createdAt: string
  updatedAt: string
}

export type InsertInterventionInput = {
  interventionId: string
  studentId: string
  facultyId: string | null
  offeringId: string | null
  interventionType: string
  note: string
  occurredAt: string
  createdAt: string
  updatedAt: string
}

export type InsertTranscriptTermResultInput = {
  transcriptTermResultId: string
  studentId: string
  termId: string
  sgpaScaled: number
  registeredCredits: number
  earnedCredits: number
  backlogCount: number
  createdAt: string
  updatedAt: string
}

export type InsertTranscriptSubjectResultInput = {
  transcriptSubjectResultId: string
  transcriptTermResultId: string
  courseCode: string
  title: string
  credits: number
  score: number
  gradeLabel: string
  gradePoint: number
  result: string
  createdAt: string
  updatedAt: string
}

export type InsertOwnershipInput = {
  ownershipId: string
  offeringId: string
  facultyId: string
  ownershipRole: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type UpdateOwnershipPatch = {
  offeringId: string
  facultyId: string
  ownershipRole: string
  status: string
  version: number
  updatedAt: string
}

export interface AcademicOfferingsRepository {
  // Course-outcome overrides
  listCourseOutcomeOverrides(): Promise<CourseOutcomeOverrideRow[]>
  listActiveCourseOutcomeOverridesForCourse(courseId: string): Promise<CourseOutcomeOverrideRow[]>
  getCourseOutcomeOverrideById(courseOutcomeOverrideId: string): Promise<CourseOutcomeOverrideRow | null>
  getCourseById(courseId: string): Promise<CourseRef | null>
  insertCourseOutcomeOverride(row: CourseOutcomeOverrideRow): Promise<void>
  updateCourseOutcomeOverride(courseOutcomeOverrideId: string, patch: UpdateCourseOutcomeOverridePatch): Promise<void>

  // Section offerings
  getOfferingById(offeringId: string): Promise<SectionOfferingRow | null>
  insertOffering(input: InsertOfferingInput): Promise<void>
  updateOffering(offeringId: string, patch: UpdateOfferingPatch): Promise<void>
  updateOfferingStage(offeringId: string, patch: UpdateOfferingStagePatch): Promise<void>
  insertStageAdvancementAudit(input: InsertStageAdvancementAuditInput): Promise<void>

  // Bulk academic-signal ingestion
  insertAttendanceSnapshot(input: InsertAttendanceSnapshotInput): Promise<void>
  insertAssessmentScore(input: InsertAssessmentScoreInput): Promise<void>
  insertIntervention(input: InsertInterventionInput): Promise<void>
  insertTranscriptTermResult(input: InsertTranscriptTermResultInput): Promise<void>
  insertTranscriptSubjectResult(input: InsertTranscriptSubjectResultInput): Promise<void>

  // Offering ownership
  listOfferingOwnerships(): Promise<OwnershipRow[]>
  getOwnershipById(ownershipId: string): Promise<OwnershipRow | null>
  insertOwnership(input: InsertOwnershipInput): Promise<void>
  updateOwnership(ownershipId: string, patch: UpdateOwnershipPatch): Promise<void>
}
