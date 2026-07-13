/**
 * Course-outcome override use-cases.
 *
 *   GET   /api/admin/course-outcomes
 *   POST  /api/admin/course-outcomes
 *   PATCH /api/admin/course-outcomes/:courseOutcomeOverrideId
 *   GET   /api/admin/offerings/:offeringId/resolved-course-outcomes
 *
 * Every success path returns the raw body the legacy handler returned (Fastify
 * auto-200); every error path throws the same AppError (notFound / conflict via
 * the injected expectVersion) so the global error handler emits identical
 * responses. All DB access goes through the repository; the outcome mapper,
 * scope-existence check, offering-context load, viewer-read guard, and outcome
 * resolver stay injected as context-bound closures.
 */
import { createId } from '../../../lib/ids.js'
import { stringifyJson } from '../../../lib/json.js'
import { notFound } from '../../../lib/http-errors.js'
import type { AcademicOfferingsRepository } from '../../ports/academic-offerings-repository.js'
import type {
  AuditEmitter,
  CourseOutcomeItem,
  CourseOutcomeOverrideRow,
  CourseOutcomeScope,
  OfferingContextResult,
  ResolveCourseOutcomesInput,
} from './shared.js'

type MapCourseOutcomeOverride = (row: CourseOutcomeOverrideRow) => unknown
type AssertCourseOutcomeScopeExists = (scopeType: CourseOutcomeScope, scopeId: string) => Promise<void>
type ExpectVersion = (currentVersion: number, nextVersion: number, entityLabel: string, current: unknown) => void

export type ListCourseOutcomeOverridesDeps = {
  repo: AcademicOfferingsRepository
  mapCourseOutcomeOverride: MapCourseOutcomeOverride
}

export type ListCourseOutcomeOverridesInput = {
  courseId?: string
  scopeType?: CourseOutcomeScope
  scopeId?: string
}

export async function listCourseOutcomeOverrides(
  deps: ListCourseOutcomeOverridesDeps,
  input: ListCourseOutcomeOverridesInput,
): Promise<unknown> {
  const rows = await deps.repo.listCourseOutcomeOverrides()
  const items = rows
    .filter(row => !input.courseId || row.courseId === input.courseId)
    .filter(row => !input.scopeType || row.scopeType === input.scopeType)
    .filter(row => !input.scopeId || row.scopeId === input.scopeId)
    .map(deps.mapCourseOutcomeOverride)
  return { items }
}

export type CreateCourseOutcomeOverrideDeps = {
  repo: AcademicOfferingsRepository
  mapCourseOutcomeOverride: MapCourseOutcomeOverride
  assertCourseOutcomeScopeExists: AssertCourseOutcomeScopeExists
  emitAudit: AuditEmitter
  now: () => string
}

export type CreateCourseOutcomeOverrideInput = {
  courseId: string
  scopeType: CourseOutcomeScope
  scopeId: string
  outcomes: CourseOutcomeItem[]
  status: string
  actorRole: string
  actorId: string | null
}

export async function createCourseOutcomeOverride(
  deps: CreateCourseOutcomeOverrideDeps,
  input: CreateCourseOutcomeOverrideInput,
): Promise<unknown> {
  const course = await deps.repo.getCourseById(input.courseId)
  if (!course) throw notFound('Course not found')
  await deps.assertCourseOutcomeScopeExists(input.scopeType, input.scopeId)
  const now = deps.now()
  const created: CourseOutcomeOverrideRow = {
    courseOutcomeOverrideId: createId('course_outcome_override'),
    courseId: input.courseId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    outcomesJson: stringifyJson(input.outcomes),
    status: input.status,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  await deps.repo.insertCourseOutcomeOverride(created)
  await deps.emitAudit({
    entityType: 'course_outcome_override',
    entityId: created.courseOutcomeOverrideId,
    action: 'CREATE',
    actorRole: input.actorRole,
    actorId: input.actorId,
    after: deps.mapCourseOutcomeOverride(created),
  })
  return deps.mapCourseOutcomeOverride(created)
}

export type UpdateCourseOutcomeOverrideDeps = {
  repo: AcademicOfferingsRepository
  mapCourseOutcomeOverride: MapCourseOutcomeOverride
  assertCourseOutcomeScopeExists: AssertCourseOutcomeScopeExists
  expectVersion: ExpectVersion
  emitAudit: AuditEmitter
  now: () => string
}

export type UpdateCourseOutcomeOverrideInput = {
  courseOutcomeOverrideId: string
  courseId: string
  scopeType: CourseOutcomeScope
  scopeId: string
  outcomes: CourseOutcomeItem[]
  status: string
  version: number
  actorRole: string
  actorId: string | null
}

export async function updateCourseOutcomeOverride(
  deps: UpdateCourseOutcomeOverrideDeps,
  input: UpdateCourseOutcomeOverrideInput,
): Promise<unknown> {
  const current = await deps.repo.getCourseOutcomeOverrideById(input.courseOutcomeOverrideId)
  if (!current) throw notFound('Course outcome override not found')
  deps.expectVersion(current.version, input.version, 'course outcome override', current)
  const course = await deps.repo.getCourseById(input.courseId)
  if (!course) throw notFound('Course not found')
  await deps.assertCourseOutcomeScopeExists(input.scopeType, input.scopeId)
  await deps.repo.updateCourseOutcomeOverride(input.courseOutcomeOverrideId, {
    courseId: input.courseId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    outcomesJson: stringifyJson(input.outcomes),
    status: input.status,
    version: current.version + 1,
    updatedAt: deps.now(),
  })
  const updated = await deps.repo.getCourseOutcomeOverrideById(input.courseOutcomeOverrideId)
  await deps.emitAudit({
    entityType: 'course_outcome_override',
    entityId: input.courseOutcomeOverrideId,
    action: 'UPDATE',
    actorRole: input.actorRole,
    actorId: input.actorId,
    before: deps.mapCourseOutcomeOverride(current),
    after: deps.mapCourseOutcomeOverride(updated as CourseOutcomeOverrideRow),
  })
  return deps.mapCourseOutcomeOverride(updated as CourseOutcomeOverrideRow)
}

export type ResolveOfferingCourseOutcomesDeps = {
  repo: AcademicOfferingsRepository
  assertViewerCanReadOffering: (offeringId: string) => Promise<void>
  getOfferingContext: (offeringId: string) => Promise<OfferingContextResult>
  resolveCourseOutcomesForOffering: (input: ResolveCourseOutcomesInput) => unknown
}

export type ResolveOfferingCourseOutcomesInput = {
  offeringId: string
}

export async function resolveOfferingCourseOutcomes(
  deps: ResolveOfferingCourseOutcomesDeps,
  input: ResolveOfferingCourseOutcomesInput,
): Promise<unknown> {
  await deps.assertViewerCanReadOffering(input.offeringId)
  const { offering, course, term, department } = await deps.getOfferingContext(input.offeringId)
  const rows = await deps.repo.listActiveCourseOutcomeOverridesForCourse(offering.courseId)
  const outcomes = deps.resolveCourseOutcomesForOffering({
    institutionId: department.institutionId,
    branchId: offering.branchId,
    batchId: term.batchId,
    offeringId: offering.offeringId,
    courseId: offering.courseId,
    courseCode: course.courseCode,
    courseTitle: course.title,
    overrides: rows,
  })
  return {
    offeringId: offering.offeringId,
    courseId: offering.courseId,
    outcomes,
  }
}
