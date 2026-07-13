/**
 * Dependency bundle for the academic-runtime use-cases.
 *
 * The use-cases stay persistence-free: they receive a repository port plus the
 * shared academic functions from modules/academic.ts (the `deps` bag) as
 * context-bound closures, and the injected external services (audit emit, proof
 * recompute, batch-policy resolution). Types are derived from
 * `AcademicRouteDependencies` so the closures the controller binds are exactly
 * type-compatible with the originals — no behavioural drift.
 */
import type { AcademicRouteDependencies } from '../../../modules/academic.js'
import type { RequestAuth } from '../../../types/fastify.js'
import type { AcademicRuntimeRepository } from '../../ports/academic-runtime-repository.js'
import type { AuditEmitter } from '../curriculum-graph/shared.js'

/** Drops the leading `context` parameter from a shared academic function type. */
export type OmitContext<F> = F extends (context: infer _Ctx, ...rest: infer A) => infer R
  ? (...rest: A) => R
  : never

type D = AcademicRouteDependencies

export type RuntimeAuth = RequestAuth

export type AcademicRuntimeUseCaseDeps = {
  repo: AcademicRuntimeRepository
  now: () => string
  emitAudit: AuditEmitter
  triggerActiveRunRecompute: (facultyId: string) => Promise<unknown>
  resolveBatchPolicy: OmitContext<D['resolveBatchPolicy']>
  DEFAULT_POLICY: Parameters<D['validateSchemeAgainstPolicy']>[1]

  // context-bound shared academic functions. The two runtime-state accessors
  // are typed with an `unknown` payload/return (the legacy handlers always cast
  // the slice at each call site) so callers keep the exact `as ...` casts.
  getAcademicRuntimeState: (stateKey: Parameters<D['getAcademicRuntimeState']>[1]) => Promise<unknown>
  saveAcademicRuntimeState: (stateKey: Parameters<D['saveAcademicRuntimeState']>[1], payload: unknown) => Promise<unknown>
  assertViewerCanManageTask: OmitContext<D['assertViewerCanManageTask']>
  assertStudentEnrolledInOffering: OmitContext<D['assertStudentEnrolledInOffering']>
  getOfferingContext: OmitContext<D['getOfferingContext']>
  assertCourseLeaderCanManageOffering: OmitContext<D['assertCourseLeaderCanManageOffering']>
  buildAcademicMeetingResponse: OmitContext<D['buildAcademicMeetingResponse']>
  validateFacultyCalendarTemplate: OmitContext<D['validateFacultyCalendarTemplate']>
  getEditableCalendarWindowStatus: OmitContext<D['getEditableCalendarWindowStatus']>
  assertViewerCanSuperviseStudent: (
    input: Omit<Parameters<D['assertViewerCanSuperviseStudent']>[0], 'context'>,
  ) => ReturnType<D['assertViewerCanSuperviseStudent']>

  // pure shared academic functions
  mapAcademicTaskRow: D['mapAcademicTaskRow']
  mapTaskTransitionRow: D['mapTaskTransitionRow']
  mapTaskPlacementRow: D['mapTaskPlacementRow']
  mapCalendarAuditEventRow: D['mapCalendarAuditEventRow']
  mapFacultyCalendarWorkspaceRow: D['mapFacultyCalendarWorkspaceRow']
  normalizeAcademicStudentId: D['normalizeAcademicStudentId']
  millisToIso: D['millisToIso']
  validateMeetingWindow: D['validateMeetingWindow']
  validateSchemeAgainstPolicy: D['validateSchemeAgainstPolicy']
  canonicalizeSchemeState: D['canonicalizeSchemeState']
  buildDefaultSchemeFromPolicy: D['buildDefaultSchemeFromPolicy']
  buildDefaultQuestionPaper: D['buildDefaultQuestionPaper']
  validateQuestionPaperBlueprint: D['validateQuestionPaperBlueprint']
  flattenTermTestLeaves: D['flattenTermTestLeaves']
  resolveCourseOutcomesForOffering: D['resolveCourseOutcomesForOffering']

  // schemas re-parsed inside the use-cases / used only for their inferred types
  taskSyncSchema: D['taskSyncSchema']
  taskPlacementSyncSchema: D['taskPlacementSyncSchema']
  calendarAuditSyncSchema: D['calendarAuditSyncSchema']
  schemeStateSchema: D['schemeStateSchema']
  termTestBlueprintSchema: D['termTestBlueprintSchema']
  academicMeetingCreateSchema: D['academicMeetingCreateSchema']
  academicMeetingPatchSchema: D['academicMeetingPatchSchema']
  attendanceCommitSchema: D['attendanceCommitSchema']
  assessmentCommitSchema: D['assessmentCommitSchema']
  assessmentCommitParamsSchema: D['assessmentCommitParamsSchema']
  questionPaperParamsSchema: D['questionPaperParamsSchema']
  offeringSchemeUpsertSchema: D['offeringSchemeUpsertSchema']
  offeringQuestionPaperUpsertSchema: D['offeringQuestionPaperUpsertSchema']
}
