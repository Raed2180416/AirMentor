/**
 * Proof student-shell resolvers — active proof-run selection, stage-checkpoint
 * resolution, and per-role (HOD/mentor/course-leader) student-shell scope
 * authorization.
 *
 * DB-touching orchestration that keeps the legacy `context: RouteContext`
 * signature consumed by the academic dependency bag (and re-exported
 * `resolveAcademicStageCheckpoint`). Moved verbatim from modules/academic.ts.
 */
import { and, eq } from 'drizzle-orm'
import type { RouteContext } from '../../../../app.js'
import {
  academicTerms,
  facultyOfferingOwnerships,
  mentorAssignments,
  simulationRuns,
  simulationStageCheckpoints,
  studentEnrollments,
  studentObservedSemesterStates,
} from '../../../../db/schema.js'
import { AppError, forbidden, notFound } from '../../../../lib/http-errors.js'
import { parseObservedStateRow } from '../../../../lib/proof-observed-state.js'
import {
  isTeacherVisibleActiveProofRunCandidate,
  pickMostRecentActiveRun,
} from '../../../../lib/proof-active-run.js'
import { buildHodProofAnalytics } from '../../../../adapters/simulation/msruas-proof-control-plane.js'
import { requireAuth } from '../../../../modules/support.js'
import {
  assertAcademicAccess,
  evaluateActiveProofRunAccess,
  evaluateCourseLeaderOfferingManagementAccess,
  evaluateFacultyContextAccess,
  evaluateHodStudentScopeAccess,
  evaluateMentorStudentScopeAccess,
  evaluateProofRunSelectionAccess,
} from '../../../../modules/academic-access.js'

export async function resolveStudentShellRun(
  context: RouteContext,
  auth: ReturnType<typeof requireAuth>,
  requestedRunId?: string,
  simulationStageCheckpointId?: string,
) {
  assertAcademicAccess(evaluateProofRunSelectionAccess(auth, requestedRunId))
  const runRows = requestedRunId
    ? await context.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, requestedRunId))
    : simulationStageCheckpointId
      ? await context.db
        .select({
          simulationRunId: simulationRuns.simulationRunId,
          batchId: simulationRuns.batchId,
          runLabel: simulationRuns.runLabel,
          status: simulationRuns.status,
          activeFlag: simulationRuns.activeFlag,
          lifecycleState: simulationRuns.lifecycleState,
          activeOperationalSemester: simulationRuns.activeOperationalSemester,
          seed: simulationRuns.seed,
          demoWorkspaceId: simulationRuns.demoWorkspaceId,
          createdAt: simulationRuns.createdAt,
          updatedAt: simulationRuns.updatedAt,
        })
        .from(simulationStageCheckpoints)
        .innerJoin(simulationRuns, eq(simulationRuns.simulationRunId, simulationStageCheckpoints.simulationRunId))
        .where(eq(simulationStageCheckpoints.simulationStageCheckpointId, simulationStageCheckpointId))
      : await context.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
  const scopedRunRows = runRows.filter(row => (row.demoWorkspaceId ?? null) === (auth.demoWorkspaceId ?? null))
  const teacherVisibleScopedRunRows = scopedRunRows.filter(isTeacherVisibleActiveProofRunCandidate)
  const [run] = requestedRunId || simulationStageCheckpointId
    ? runRows
    : [pickMostRecentActiveRun(teacherVisibleScopedRunRows)]
  if (!run) throw notFound('Proof run not found')
  if ((run.demoWorkspaceId ?? null) !== (auth.demoWorkspaceId ?? null)) {
    throw new AppError(403, 'PROOF_RUN_SCOPE_MISMATCH', 'Proof run is not available in this workspace scope.')
  }
  assertAcademicAccess(evaluateActiveProofRunAccess(auth, isTeacherVisibleActiveProofRunCandidate(run)))
  return run
}

export async function resolveAcademicStageCheckpoint(
  context: RouteContext,
  auth: ReturnType<typeof requireAuth>,
  simulationRunId: string,
  simulationStageCheckpointId?: string,
) {
  if (!simulationStageCheckpointId) return null
  const [checkpoint] = await context.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationStageCheckpointId, simulationStageCheckpointId))
  if (!checkpoint) throw notFound('Simulation stage checkpoint not found')
  if (checkpoint.simulationRunId !== simulationRunId) {
    throw forbidden('Simulation stage checkpoint does not belong to the selected proof run')
  }
  const [run] = await context.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, checkpoint.simulationRunId))
  if (!run) throw notFound('Simulation run not found')
  if ((run.demoWorkspaceId ?? null) !== (auth.demoWorkspaceId ?? null)) {
    throw new AppError(403, 'PROOF_RUN_SCOPE_MISMATCH', 'Proof run is not available in this workspace scope.')
  }
  if (auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
    assertAcademicAccess(evaluateActiveProofRunAccess(
      auth,
      isTeacherVisibleActiveProofRunCandidate(run),
      'Academic roles may inspect only checkpoints from the active proof run',
    ))
  }
  return checkpoint
}

export async function assertStudentShellScope(
  context: RouteContext,
  auth: ReturnType<typeof requireAuth>,
  simulationRunId: string,
  studentId: string,
  simulationStageCheckpointId?: string,
) {
  if (auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') return
  assertAcademicAccess(evaluateFacultyContextAccess(auth))
  const facultyId = auth.facultyId as string

  if (auth.activeRoleGrant.roleCode === 'HOD') {
    const analytics = await buildHodProofAnalytics(context.db, {
      facultyId,
      roleScopeType: auth.activeRoleGrant.scopeType,
      roleScopeId: auth.activeRoleGrant.scopeId,
      now: context.now(),
      filters: {
        studentId,
        simulationStageCheckpointId,
      },
    })
    assertAcademicAccess(evaluateHodStudentScopeAccess(
      !!analytics.summary.activeRunContext && analytics.summary.activeRunContext.simulationRunId === simulationRunId,
      'Student shell is only available for the active HoD proof scope',
    ))
    assertAcademicAccess(evaluateHodStudentScopeAccess(
      analytics.students.some(row => row.studentId === studentId),
      'Student is outside the supervised HoD proof scope',
    ))
    return
  }

  if (auth.activeRoleGrant.roleCode === 'MENTOR') {
    const [run] = await context.db.select({
      simulationRunId: simulationRuns.simulationRunId,
      batchId: simulationRuns.batchId,
      activeOperationalSemester: simulationRuns.activeOperationalSemester,
      demoWorkspaceId: simulationRuns.demoWorkspaceId,
    }).from(simulationRuns).where(eq(simulationRuns.simulationRunId, simulationRunId))
    if (!run) throw notFound('Proof run not found')
    if ((run.demoWorkspaceId ?? null) !== (auth.demoWorkspaceId ?? null)) {
      throw new AppError(403, 'PROOF_RUN_SCOPE_MISMATCH', 'Proof run is not available in this workspace scope.')
    }
    const [checkpoint] = simulationStageCheckpointId
      ? await context.db.select({
        simulationStageCheckpointId: simulationStageCheckpoints.simulationStageCheckpointId,
        semesterNumber: simulationStageCheckpoints.semesterNumber,
        simulationRunId: simulationStageCheckpoints.simulationRunId,
      }).from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationStageCheckpointId, simulationStageCheckpointId))
      : [null]
    if (simulationStageCheckpointId && !checkpoint) {
      throw notFound('Simulation stage checkpoint not found')
    }
    if (checkpoint && checkpoint.simulationRunId !== simulationRunId) {
      throw forbidden('Simulation stage checkpoint does not belong to the selected proof run')
    }
    const proofSemesterNumber = checkpoint?.semesterNumber ?? run.activeOperationalSemester ?? null
    const [assignment] = await context.db.select().from(mentorAssignments).where(and(
      eq(mentorAssignments.facultyId, facultyId),
      eq(mentorAssignments.studentId, studentId),
    ))
    const enrollmentRows = await context.db.select({
      demoWorkspaceId: studentEnrollments.demoWorkspaceId,
      batchId: academicTerms.batchId,
      semesterNumber: academicTerms.semesterNumber,
    }).from(studentEnrollments).innerJoin(
      academicTerms,
      eq(studentEnrollments.termId, academicTerms.termId),
    ).where(and(
      eq(studentEnrollments.studentId, studentId),
      eq(studentEnrollments.academicStatus, 'active'),
    ))
    const enrollmentVisibleInProofScope = proofSemesterNumber != null && enrollmentRows.some(row => (
      (row.demoWorkspaceId ?? null) === (auth.demoWorkspaceId ?? null)
      && row.batchId === run.batchId
      && row.semesterNumber === proofSemesterNumber
    ))
    assertAcademicAccess(evaluateMentorStudentScopeAccess(
      !!assignment && !assignment.effectiveTo && enrollmentVisibleInProofScope,
      'Student is outside the active mentor proof scope',
    ))
    return
  }

  const ownedOfferingIds = new Set(
    (await context.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))).map(row => row.offeringId),
  )
  if (ownedOfferingIds.size === 0) throw forbidden('No owned proof offerings are available for this faculty context')
  const observedRows = await context.db.select().from(studentObservedSemesterStates).where(and(
    eq(studentObservedSemesterStates.simulationRunId, simulationRunId),
    eq(studentObservedSemesterStates.studentId, studentId),
  ))
  const hasOwnedProofEvidence = observedRows.some(row => {
    const payload = parseObservedStateRow(row)
    const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
    return !!offeringId && ownedOfferingIds.has(offeringId)
  })
  assertAcademicAccess(evaluateCourseLeaderOfferingManagementAccess(
    hasOwnedProofEvidence,
    'Student is outside the active course-leader proof scope',
  ))
}
