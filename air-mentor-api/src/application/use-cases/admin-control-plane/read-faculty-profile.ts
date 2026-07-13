/**
 * GET /api/academic/faculty-profile/:facultyId — the teaching-side faculty
 * profile projection.
 *
 * Data loads through the repository; the checkpoint guard, proof view, and
 * role-grant mapper are injected closures (kept out of the persistence-free
 * application layer). The projection is moved verbatim from the legacy handler,
 * with the current/proof scope derivations extracted to sibling files to
 * respect the 400-line cap.
 */
import { forbidden, notFound } from '../../../lib/http-errors.js'
import type { ScopeDescriptorValue } from '../../../lib/proof-provenance.js'
import type { buildFacultyProofView } from '../../../lib/msruas-proof-control-plane.js'
import type { resolveAcademicStageCheckpoint } from '../../../modules/academic.js'
import type { AdminControlPlaneRepository } from '../../ports/admin-control-plane-repository.js'
import type { UseCaseResponse } from '../curriculum-graph/shared.js'
import { addDays } from './faculty-calendar-domain.js'
import type { FacultyProfileRoleGrantRow } from './faculty-profile-domain.js'
import { buildCurrentScope } from './faculty-profile-current-scope.js'
import { buildProofScope } from './faculty-profile-proof-scope.js'

export type ReadFacultyProfileDeps = {
  repo: AdminControlPlaneRepository
  resolveAcademicStageCheckpoint: (
    simulationRunId: string,
    simulationStageCheckpointId: string,
  ) => ReturnType<typeof resolveAcademicStageCheckpoint>
  buildFacultyProofView: (input: Parameters<typeof buildFacultyProofView>[1]) => ReturnType<typeof buildFacultyProofView>
  mapRoleGrant: (row: FacultyProfileRoleGrantRow) => Record<string, unknown>
}

export type ReadFacultyProfileInput = {
  facultyId: string
  simulationStageCheckpointId?: string
  viewerRoleCode: string
  viewerFacultyId: string | null
  demoWorkspaceId: string | null
}

export async function readFacultyProfile(
  deps: ReadFacultyProfileDeps,
  input: ReadFacultyProfileInput,
): Promise<UseCaseResponse> {
  const { repo } = deps
  const { facultyId, viewerRoleCode, viewerFacultyId } = input
  const simulationStageCheckpointId = input.simulationStageCheckpointId

  if (
    viewerFacultyId !== facultyId
    && viewerRoleCode !== 'HOD'
    && viewerRoleCode !== 'SYSTEM_ADMIN'
  ) {
    throw forbidden()
  }
  if (simulationStageCheckpointId) {
    const requestedCheckpoint = await repo.getCheckpointRunId(simulationStageCheckpointId)
    if (!requestedCheckpoint) throw notFound('Simulation stage checkpoint not found')
    await deps.resolveAcademicStageCheckpoint(requestedCheckpoint.simulationRunId, simulationStageCheckpointId)
  }

  const {
    profileRows,
    userRows,
    appointmentRows,
    academicFacultyRows,
    departmentRows,
    batchRows,
    roleGrantRows,
    assignmentRows,
    ownershipRows,
    offeringRows,
    courseRows,
    branchRows,
    termRows,
    requestRows,
    reassessmentRows,
    alertDecisionRows,
    enrollmentRows,
    viewerAppointmentRows,
    teacherLocalTemplate,
    canonicalTemplate,
    calendarWorkspace,
    timetableUpdatedAt,
  } = await repo.loadFacultyProfileDataset({ facultyId, viewerRoleCode, viewerFacultyId })

  const profile = profileRows[0]
  if (!profile) throw notFound('Faculty profile not found')
  if (viewerRoleCode === 'HOD' && viewerFacultyId !== facultyId) {
    const viewerDepartmentIds = new Set(viewerAppointmentRows.map(row => row.departmentId))
    const viewerBranchIds = new Set(viewerAppointmentRows.map(row => row.branchId).filter((value): value is string => !!value))
    const targetDepartmentIds = new Set(appointmentRows.map(row => row.departmentId))
    const targetBranchIds = new Set(appointmentRows.map(row => row.branchId).filter((value): value is string => !!value))
    const overlapsDepartment = Array.from(targetDepartmentIds).some(departmentId => viewerDepartmentIds.has(departmentId))
    const overlapsBranch = Array.from(targetBranchIds).some(branchId => viewerBranchIds.has(branchId))
    if (!overlapsDepartment && !overlapsBranch) {
      throw forbidden('This HoD does not supervise the requested faculty profile')
    }
  }
  const user = userRows.find(row => row.userId === profile.userId)
  const academicFacultyById = Object.fromEntries(academicFacultyRows.map(row => [row.academicFacultyId, row]))
  const departmentById = Object.fromEntries(departmentRows.map(row => [row.departmentId, row]))
  const batchById = Object.fromEntries(batchRows.map(row => [row.batchId, row]))
  const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))
  const termById = Object.fromEntries(termRows.map(row => [row.termId, row]))
  const courseById = Object.fromEntries(courseRows.map(row => [row.courseId, row]))
  const primaryAppointment = appointmentRows.find(row => row.isPrimary === 1) ?? appointmentRows[0] ?? null
  const timetableTemplate = teacherLocalTemplate ?? canonicalTemplate ?? null

  const {
    activeOwnerships,
    activeMentorAssignments,
    currentOwnedClasses,
    currentBatchContextsMap,
    subjectRunMap,
    relatedRequests,
  } = buildCurrentScope({
    facultyId,
    ownershipRows,
    assignmentRows,
    offeringRows,
    enrollmentRows,
    requestRows,
    courseById,
    branchById,
    departmentById,
    termById,
    batchById,
  })

  const proofView = await deps.buildFacultyProofView({
    facultyId,
    viewerRoleCode,
    simulationStageCheckpointId,
    demoWorkspaceId: input.demoWorkspaceId ?? null,
  })
  const proofScopeDescriptor = (
    proofView.scopeDescriptor && typeof proofView.scopeDescriptor === 'object'
      ? proofView.scopeDescriptor
      : null
  ) as ScopeDescriptorValue | null
  const proofModeActive = proofView.scopeMode === 'proof'
  const proofScopedProfileActive = proofModeActive
  const proofBatchIds = Array.from(new Set([
    proofScopeDescriptor?.batchId ?? null,
    ...proofView.activeRunContexts.map(item => item.batchId),
  ].filter((value): value is string => !!value)))
  const proofSemesterNumber = proofView.activeOperationalSemester
    ?? proofView.selectedCheckpoint?.semesterNumber
    ?? null

  const {
    proofOwnedClasses,
    proofMentorStudentIds,
    proofCurrentBatchContexts,
  } = buildProofScope({
    proofView,
    proofBatchIds,
    proofSemesterNumber,
    viewerRoleCode,
    offeringRows,
    activeOwnerships,
    activeMentorAssignments,
    enrollmentRows,
    courseById,
    branchById,
    departmentById,
    termById,
    batchById,
  })

  const effectiveOwnedClasses = proofScopedProfileActive ? proofOwnedClasses : currentOwnedClasses
  const effectiveMentorStudentIds = proofScopedProfileActive
    ? proofMentorStudentIds
    : activeMentorAssignments.map(row => row.studentId)
  const effectiveBatchContexts = proofScopedProfileActive
    ? proofCurrentBatchContexts
    : Array.from(currentBatchContextsMap.values()).map(entry => ({
        batchId: entry.batchId,
        batchLabel: entry.batchLabel,
        branchName: entry.branchName,
        currentSemester: entry.currentSemester,
        sectionCodes: Array.from(entry.sectionCodes).sort(),
        roleCoverage: Array.from(entry.roleCoverage).sort(),
      }))
  const relevantOfferingIds = new Set(effectiveOwnedClasses.map(item => item.offeringId))
  const relevantStudentIds = new Set(effectiveMentorStudentIds)
  const relevantReassessments = reassessmentRows.filter(row => (
    relevantStudentIds.has(row.studentId)
    || (row.offeringId ? relevantOfferingIds.has(row.offeringId) : false)
  ))
  const relevantRiskDecisionIds = new Set(relevantReassessments.map(row => row.riskAssessmentId))
  const recentAlertDecisions = alertDecisionRows
    .filter(row => relevantRiskDecisionIds.has(row.riskAssessmentId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5)
  const nextReassessmentDueAt = relevantReassessments
    .filter(row => row.status !== 'completed' && row.status !== 'monitoring-only')
    .map(row => row.dueAt)
    .sort()[0] ?? null

  const describeGrantScope = (scopeType: string, scopeId: string) => {
    if (scopeType === 'institution') return 'Institution'
    if (scopeType === 'academic-faculty') return academicFacultyById[scopeId]?.name ?? scopeId
    if (scopeType === 'department') return departmentById[scopeId]?.name ?? scopeId
    if (scopeType === 'branch') return branchById[scopeId]?.name ?? scopeId
    if (scopeType === 'batch') return batchById[scopeId]?.batchLabel ?? scopeId
    if (scopeType === 'offering') {
      const offering = offeringRows.find(item => item.offeringId === scopeId)
      const course = offering ? courseById[offering.courseId] : null
      return offering
        ? `${course?.courseCode ?? 'NA'} · ${offering.yearLabel} · Section ${offering.sectionCode}`
        : scopeId
    }
    return scopeId
  }

  return {
    status: 200,
    body: {
      facultyId: profile.facultyId,
      displayName: profile.displayName,
      designation: profile.designation,
      employeeCode: profile.employeeCode,
      joinedOn: profile.joinedOn,
      email: user?.email ?? '',
      phone: user?.phone ?? null,
      primaryDepartment: primaryAppointment
        ? {
            departmentId: primaryAppointment.departmentId,
            name: departmentById[primaryAppointment.departmentId]?.name ?? 'Unknown department',
            code: departmentById[primaryAppointment.departmentId]?.code ?? 'NA',
          }
        : null,
      appointments: appointmentRows.map(row => ({
        appointmentId: row.appointmentId,
        facultyId: row.facultyId,
        departmentId: row.departmentId,
        departmentName: departmentById[row.departmentId]?.name ?? null,
        departmentCode: departmentById[row.departmentId]?.code ?? null,
        branchId: row.branchId,
        branchName: row.branchId ? (branchById[row.branchId]?.name ?? null) : null,
        branchCode: row.branchId ? (branchById[row.branchId]?.code ?? null) : null,
        isPrimary: row.isPrimary === 1,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      permissions: roleGrantRows.map(row => ({
        ...deps.mapRoleGrant(row),
        scopeLabel: describeGrantScope(row.scopeType, row.scopeId),
      })),
      subjectRunCourseLeaderScope: (proofScopedProfileActive
        ? Array.from(new Map(
            effectiveOwnedClasses.map(item => {
              const matchingOffering = offeringRows.find(row => row.offeringId === item.offeringId)
              const subjectRunId = matchingOffering
                ? `subject_run_${matchingOffering.termId}_${matchingOffering.courseId}_${matchingOffering.yearLabel}`
                : `proof_subject_run_${item.courseCode}_${item.yearLabel}`
              const existing = subjectRunMap.get(subjectRunId)
              return [subjectRunId, {
                subjectRunId,
                courseCode: item.courseCode,
                title: item.title,
                termId: matchingOffering?.termId ?? existing?.termId ?? '',
                yearLabel: item.yearLabel,
                sectionCodes: Array.from(new Set([...(existing?.sectionCodes ?? new Set<string>()), item.sectionCode])),
              }] as const
            }),
          ).values())
        : Array.from(subjectRunMap.values()).map(entry => ({
            ...entry,
            sectionCodes: Array.from(entry.sectionCodes).sort(),
          }))),
      mentorScope: {
        activeStudentCount: effectiveMentorStudentIds.length,
        studentIds: effectiveMentorStudentIds,
      },
      currentOwnedClasses: effectiveOwnedClasses,
      currentBatchContexts: effectiveBatchContexts,
      timetableStatus: {
        hasTemplate: !!timetableTemplate,
        publishedAt: timetableTemplate ? (calendarWorkspace?.publishedAt ?? timetableUpdatedAt ?? null) : null,
        directEditWindowEndsAt: timetableTemplate
          ? (calendarWorkspace?.publishedAt ? addDays(calendarWorkspace.publishedAt, 14) : (timetableUpdatedAt ? addDays(timetableUpdatedAt, 14) : null))
          : null,
      },
      timetableTemplate,
      calendarWorkspace,
      requestSummary: {
        openCount: relatedRequests.filter(row => row.status !== 'Closed').length,
        recent: relatedRequests.slice(0, 5).map(row => ({
          adminRequestId: row.adminRequestId,
          summary: row.summary,
          status: row.status,
          updatedAt: row.updatedAt,
        })),
      },
      reassessmentSummary: {
        openCount: proofScopedProfileActive
          ? proofView.monitoringQueue.filter(item => item.reassessmentStatus !== 'Resolved').length
          : relevantReassessments.filter(row => row.status !== 'completed' && row.status !== 'monitoring-only').length,
        nextDueAt: proofScopedProfileActive
          ? (proofView.monitoringQueue.map(item => item.dueAt).filter((value): value is string => !!value).sort()[0] ?? null)
          : nextReassessmentDueAt,
        recentDecisionTypes: proofScopedProfileActive
          ? Array.from(new Set(proofView.monitoringQueue.map(item => item.decisionType).filter((value): value is string => !!value))).slice(0, 5)
          : recentAlertDecisions.map(row => row.decisionType),
      },
      proofOperations: proofView,
    },
  }
}
