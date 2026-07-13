/**
 * Academic route library — dependency-bag assembly + registrar.
 *
 * modules/academic.ts registers ZERO HTTP routes. It is a thin composition root
 * that assembles the ~86-symbol `createAcademicRouteDependencies()` bag consumed
 * by the four academic sub-registrars and wires them via
 * `registerAcademicRoutes`. All Zod contracts, pure computation, row mappers,
 * and DB-orchestration bodies now live under
 * src/application/use-cases/academic and
 * src/adapters/persistence/repositories/academic; this file only imports them,
 * preserves the exact dependency-bag shape, and preserves the module's public
 * exports.
 */
import type { FastifyInstance } from 'fastify'
import type { RouteContext } from '../app.js'
import { resolveBatchPolicy } from './admin-structure.js'
import { registerAcademicAdminOfferingRoutes } from './academic-admin-offerings-routes.js'
import { registerAcademicBootstrapRoutes } from './academic-bootstrap-routes.js'
import { registerAcademicProofRoutes } from './academic-proof-routes.js'
import { registerAcademicRuntimeRoutes } from './academic-runtime-routes.js'

// --- Application layer: framework/persistence-free Zod contracts ---
import {
  FIXED_OWNERSHIP_ROLE,
  academicBootstrapQuerySchema,
  academicRoleCodes,
  adminOfferingParamsSchema,
  assessmentScoreCreateSchema,
  attendanceSnapshotCreateSchema,
  batchProvisioningSchema,
  courseOutcomeOverrideCreateSchema,
  courseOutcomeOverrideListQuerySchema,
  courseOutcomeOverridePatchSchema,
  hodProofCourseQuerySchema,
  hodProofFacultyQuerySchema,
  hodProofReassessmentQuerySchema,
  hodProofStudentQuerySchema,
  hodProofSummaryQuerySchema,
  interventionCreateSchema,
  offeringCreateSchema,
  offeringParamsSchema,
  offeringPatchSchema,
  offeringQuestionPaperUpsertSchema,
  offeringSchemeUpsertSchema,
  ownershipCreateSchema,
  ownershipPatchSchema,
  proofReassessmentAcknowledgeSchema,
  proofReassessmentParamsSchema,
  proofReassessmentResolveSchema,
  questionPaperParamsSchema,
  runtimeSliceSchemas,
  runtimeStateKeySchema,
  schemeStateSchema,
  studentShellMessageSchema,
  studentShellQuerySchema,
  studentShellSessionCreateSchema,
  termTestBlueprintSchema,
  transcriptSubjectResultCreateSchema,
  transcriptTermResultCreateSchema,
} from '../application/use-cases/academic/academic-contracts.js'
import {
  academicMeetingCreateSchema,
  academicMeetingParamsSchema,
  academicMeetingPatchSchema,
  assessmentCommitParamsSchema,
  assessmentCommitSchema,
  attendanceCommitSchema,
  calendarAuditSyncSchema,
  facultyCalendarWorkspaceUpsertSchema,
  proofResolutionCreditByOutcome,
  taskPlacementSyncSchema,
  taskSyncSchema,
} from '../application/use-cases/academic/academic-task-contracts.js'
import {
  millisToIso,
  normalizeAcademicStudentId,
  proofResolutionRecoveryState,
  validateMeetingWindow,
} from '../application/use-cases/academic/academic-utils.js'
import {
  buildDefaultQuestionPaper,
  buildDefaultSchemeFromPolicy,
  canonicalizeSchemeState,
  flattenTermTestLeaves,
  validateQuestionPaperBlueprint,
  validateSchemeAgainstPolicy,
} from '../application/use-cases/academic/academic-scheme.js'
import { mockStudentIdentity } from '../application/use-cases/academic/academic-risk.js'

// --- Persistence layer: db-touching orchestration + row mappers ---
import {
  mapAcademicTaskRow,
  mapCalendarAuditEventRow,
  mapCourseOutcomeOverride,
  mapFacultyCalendarWorkspaceRow,
  mapTaskPlacementRow,
  mapTaskTransitionRow,
} from '../adapters/persistence/repositories/academic/academic-row-mappers.js'
import {
  getAcademicRuntimeState,
  saveAcademicRuntimeState,
} from '../adapters/persistence/repositories/academic/academic-runtime-state.js'
import { resolveCourseOutcomesForOffering } from '../adapters/persistence/repositories/academic/academic-attainment.js'
import {
  buildOfferingStageEligibility,
  getOfferingContext,
} from '../adapters/persistence/repositories/academic/academic-offering-eligibility.js'
import {
  assertCourseLeaderCanManageOffering,
  assertCourseOutcomeScopeExists,
  assertSingleActiveOfferingOwner,
  assertStudentEnrolledInOffering,
  assertViewerCanManageTask,
  assertViewerCanReadOffering,
  assertViewerCanSuperviseStudent,
} from '../adapters/persistence/repositories/academic/academic-scope-resolvers.js'
import {
  assertStudentShellScope,
  resolveAcademicStageCheckpoint,
  resolveStudentShellRun,
} from '../adapters/persistence/repositories/academic/academic-shell-resolvers.js'
import {
  buildAcademicMeetingResponse,
  getEditableCalendarWindowStatus,
  resolveProofReassessmentAccess,
  validateFacultyCalendarTemplate,
} from '../adapters/persistence/repositories/academic/academic-meeting-resolvers.js'
import { buildAcademicBootstrap } from '../adapters/persistence/repositories/academic/build-academic-bootstrap.js'
import { buildPublicFacultyList } from '../adapters/persistence/repositories/academic/build-public-faculty-list.js'

// Preserve the module's historical public exports. External importers rely on
// `resolveAcademicStageCheckpoint` (admin-control-plane.ts and
// admin-control-plane/read-faculty-profile.ts); the proof workflow task-id
// helpers keep their original export surface too.
export { resolveAcademicStageCheckpoint }
export {
  PROOF_WORKFLOW_TASK_ID_PREFIX,
  buildProofWorkflowTaskFromQueueProjection,
  proofPlaybackCurrentDateISO,
  proofWorkflowTaskIdFromQueueCaseId,
  taskDateISOFromTimestamp,
  taskDueLabelFromDate,
} from '../adapters/persistence/repositories/academic/academic-proof-workflow-task.js'

function createAcademicRouteDependencies() {
  return {
    FIXED_OWNERSHIP_ROLE,
    academicBootstrapQuerySchema,
    academicMeetingCreateSchema,
    academicMeetingParamsSchema,
    academicMeetingPatchSchema,
    academicRoleCodes,
    adminOfferingParamsSchema,
    assessmentCommitParamsSchema,
    assessmentCommitSchema,
    assessmentScoreCreateSchema,
    assertCourseLeaderCanManageOffering,
    assertCourseOutcomeScopeExists,
    assertSingleActiveOfferingOwner,
    assertStudentEnrolledInOffering,
    assertStudentShellScope,
    assertViewerCanManageTask,
    assertViewerCanReadOffering,
    assertViewerCanSuperviseStudent,
    attendanceCommitSchema,
    attendanceSnapshotCreateSchema,
    batchProvisioningSchema,
    buildAcademicBootstrap,
    buildAcademicMeetingResponse,
    buildDefaultQuestionPaper,
    buildDefaultSchemeFromPolicy,
    buildOfferingStageEligibility,
    buildPublicFacultyList,
    calendarAuditSyncSchema,
    canonicalizeSchemeState,
    courseOutcomeOverrideCreateSchema,
    courseOutcomeOverrideListQuerySchema,
    courseOutcomeOverridePatchSchema,
    facultyCalendarWorkspaceUpsertSchema,
    flattenTermTestLeaves,
    getAcademicRuntimeState,
    getEditableCalendarWindowStatus,
    getOfferingContext,
    hodProofCourseQuerySchema,
    hodProofFacultyQuerySchema,
    hodProofReassessmentQuerySchema,
    hodProofStudentQuerySchema,
    hodProofSummaryQuerySchema,
    interventionCreateSchema,
    mapAcademicTaskRow,
    mapCalendarAuditEventRow,
    mapCourseOutcomeOverride,
    mapFacultyCalendarWorkspaceRow,
    mapTaskPlacementRow,
    mapTaskTransitionRow,
    millisToIso,
    mockStudentIdentity,
    normalizeAcademicStudentId,
    offeringCreateSchema,
    offeringParamsSchema,
    offeringPatchSchema,
    offeringQuestionPaperUpsertSchema,
    offeringSchemeUpsertSchema,
    ownershipCreateSchema,
    ownershipPatchSchema,
    proofReassessmentAcknowledgeSchema,
    proofReassessmentParamsSchema,
    proofReassessmentResolveSchema,
    proofResolutionCreditByOutcome,
    proofResolutionRecoveryState,
    questionPaperParamsSchema,
    resolveAcademicStageCheckpoint,
    resolveBatchPolicy,
    resolveCourseOutcomesForOffering,
    resolveProofReassessmentAccess,
    resolveStudentShellRun,
    runtimeSliceSchemas,
    runtimeStateKeySchema,
    saveAcademicRuntimeState,
    schemeStateSchema,
    studentShellMessageSchema,
    studentShellQuerySchema,
    studentShellSessionCreateSchema,
    taskPlacementSyncSchema,
    taskSyncSchema,
    termTestBlueprintSchema,
    transcriptSubjectResultCreateSchema,
    transcriptTermResultCreateSchema,
    validateFacultyCalendarTemplate,
    validateMeetingWindow,
    validateQuestionPaperBlueprint,
    validateSchemeAgainstPolicy,
  }
}

export type AcademicRouteDependencies = ReturnType<typeof createAcademicRouteDependencies>

export async function registerAcademicRoutes(app: FastifyInstance, context: RouteContext) {
  const deps = createAcademicRouteDependencies()
  await registerAcademicBootstrapRoutes(app, context, deps)
  await registerAcademicProofRoutes(app, context, deps)
  await registerAcademicRuntimeRoutes(app, context, deps)
  await registerAcademicAdminOfferingRoutes(app, context, deps)
}
