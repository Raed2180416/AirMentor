/**
 * Bulk academic-signal ingestion use-cases.
 *
 *   POST /api/admin/attendance-snapshots
 *   POST /api/admin/assessment-scores
 *   POST /api/admin/student-interventions
 *   POST /api/admin/transcript-term-results
 *   POST /api/admin/transcript-subject-results
 *
 * Each generates its id + timestamps, persists through the repository, and emits
 * the same audit event (before: null, after: <parsed body>) as the legacy
 * handler, returning { <idField>, ok: true }.
 */
import { createId } from '../../../lib/ids.js'
import type { AcademicOfferingsRepository } from '../../ports/academic-offerings-repository.js'
import type { AuditEmitter } from './shared.js'

export type BulkIngestionDeps = {
  repo: AcademicOfferingsRepository
  emitAudit: AuditEmitter
  now: () => string
}

type Actor = {
  actorRole: string
  actorId: string | null
}

export type AttendanceSnapshotBody = {
  studentId: string
  offeringId: string
  presentClasses: number
  totalClasses: number
  attendancePercent?: number
  source: string
  capturedAt: string
}

export async function createAttendanceSnapshot(
  deps: BulkIngestionDeps,
  input: { body: AttendanceSnapshotBody } & Actor,
): Promise<unknown> {
  const { body } = input
  const now = deps.now()
  const attendanceSnapshotId = createId('attendance')
  const attendancePercent = body.attendancePercent ?? (body.totalClasses > 0 ? Math.round((body.presentClasses / body.totalClasses) * 100) : 0)
  await deps.repo.insertAttendanceSnapshot({
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
  await deps.emitAudit({
    entityType: 'StudentAttendanceSnapshot',
    entityId: attendanceSnapshotId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: null,
    after: body,
  })
  return { attendanceSnapshotId, ok: true }
}

export type AssessmentScoreBody = {
  studentId: string
  offeringId: string
  termId?: string
  componentType: string
  componentCode?: string
  score: number
  maxScore: number
  evaluatedAt: string
}

export async function createAssessmentScore(
  deps: BulkIngestionDeps,
  input: { body: AssessmentScoreBody } & Actor,
): Promise<unknown> {
  const { body } = input
  const now = deps.now()
  const assessmentScoreId = createId('assessment')
  await deps.repo.insertAssessmentScore({
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
  await deps.emitAudit({
    entityType: 'StudentAssessmentScore',
    entityId: assessmentScoreId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: null,
    after: body,
  })
  return { assessmentScoreId, ok: true }
}

export type InterventionBody = {
  studentId: string
  facultyId?: string
  offeringId?: string
  interventionType: string
  note: string
  occurredAt: string
}

export async function createIntervention(
  deps: BulkIngestionDeps,
  input: { body: InterventionBody } & Actor,
): Promise<unknown> {
  const { body } = input
  const now = deps.now()
  const interventionId = createId('intervention')
  await deps.repo.insertIntervention({
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
  await deps.emitAudit({
    entityType: 'StudentIntervention',
    entityId: interventionId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: null,
    after: body,
  })
  return { interventionId, ok: true }
}

export type TranscriptTermResultBody = {
  studentId: string
  termId: string
  sgpaScaled: number
  registeredCredits: number
  earnedCredits: number
  backlogCount: number
}

export async function createTranscriptTermResult(
  deps: BulkIngestionDeps,
  input: { body: TranscriptTermResultBody } & Actor,
): Promise<unknown> {
  const { body } = input
  const now = deps.now()
  const transcriptTermResultId = createId('transcript-term')
  await deps.repo.insertTranscriptTermResult({
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
  await deps.emitAudit({
    entityType: 'TranscriptTermResult',
    entityId: transcriptTermResultId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: null,
    after: body,
  })
  return { transcriptTermResultId, ok: true }
}

export type TranscriptSubjectResultBody = {
  transcriptTermResultId: string
  courseCode: string
  title: string
  credits: number
  score: number
  gradeLabel: string
  gradePoint: number
  result: string
}

export async function createTranscriptSubjectResult(
  deps: BulkIngestionDeps,
  input: { body: TranscriptSubjectResultBody } & Actor,
): Promise<unknown> {
  const { body } = input
  const now = deps.now()
  const transcriptSubjectResultId = createId('transcript-subject')
  await deps.repo.insertTranscriptSubjectResult({
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
  await deps.emitAudit({
    entityType: 'TranscriptSubjectResult',
    entityId: transcriptSubjectResultId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: null,
    after: body,
  })
  return { transcriptSubjectResultId, ok: true }
}
