import { eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  academicTerms,
  alertAcknowledgements,
  alertDecisions,
  batches,
  branches,
  courses,
  departments,
  electiveRecommendations,
  facultyAppointments,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  reassessmentEvents,
  reassessmentResolutions,
  riskAssessments,
  riskOverrides,
  roleGrants,
  sectionOfferings,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  students,
  studentInterventions,
  studentObservedSemesterStates,
  teacherAllocations,
  teacherLoadProfiles,
  transcriptTermResults,
} from '../db/schema.js'
import { parseJson } from './json.js'
import { parseObservedStateRow } from './proof-observed-state.js'
import {
  buildProofCountProvenance,
  buildUnavailableCountProvenance,
} from './proof-provenance.js'
import { queueDecisionTypeFromStatus } from './proof-control-plane-access.js'

type ProofCheckpointSummaryLike = {
  simulationStageCheckpointId: string
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageLabel: string
  stageDescription: string
  stageOrder: number
  previousCheckpointId: string | null
  nextCheckpointId: string | null
  openQueueCount?: number
  blockingQueueItemCount?: number
  stageAdvanceBlocked?: boolean
  playbackAccessible?: boolean
  blockedByCheckpointId?: string | null
  blockedProgressionReason?: string | null
}

type HodProofAnalyticsResult = {
  summary: {
    activeRunContext: Record<string, unknown> | null
    [key: string]: unknown
  }
  courses: Array<Record<string, unknown>>
  faculty: Array<Record<string, unknown>>
  students: Array<Record<string, unknown> & {
    studentId?: string
  }>
  reassessments: Array<Record<string, unknown>>
}

function resolveOperationalCheckpointSummary(
  checkpointRows: Array<typeof simulationStageCheckpoints.$inferSelect>,
  semesterNumber: number,
  deps: Pick<ProofControlPlaneHodServiceDeps, 'parseProofCheckpointSummary' | 'withProofPlaybackGate'>,
) {
  const summaries = deps.withProofPlaybackGate(
    checkpointRows
      .slice()
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
      .map(deps.parseProofCheckpointSummary),
  )
  const semesterSummaries = summaries.filter(item => item.semesterNumber === semesterNumber)
  return semesterSummaries
    .slice()
    .reverse()
    .find(item => item.playbackAccessible !== false)
    ?? semesterSummaries.at(-1)
    ?? null
}

export type ProofControlPlaneHodServiceDeps = {
  average: (values: number[]) => number
  buildEvidenceTimelineFromRows: (rows: Array<typeof studentObservedSemesterStates.$inferSelect>) => Array<Record<string, unknown>>
  bucketBacklogCount: (count: number) => string
  hoursBetween: (fromIso: string, toIso: string) => number
  isOpenReassessmentStatus: (status: string | null | undefined) => boolean
  matchesTextFilter: (value: string | null | undefined, filter: string | undefined) => boolean
  normalizeFilterValue: (value: string | null | undefined) => string | null
  parseProofCheckpointSummary: (row: typeof simulationStageCheckpoints.$inferSelect) => ProofCheckpointSummaryLike
  proofRecoveryStateFromResolutionRow: (row: typeof reassessmentResolutions.$inferSelect | null | undefined) => unknown
  proofResolutionPayloadFromRow: (row: typeof reassessmentResolutions.$inferSelect | null | undefined) => { observedResidual?: number | null }
  queueProjectionAssignedFacultyId: (row: typeof simulationStageQueueProjections.$inferSelect) => string | null
  roundToOne: (value: number) => number
  uniqueSorted: (values: Iterable<string>) => string[]
  withProofPlaybackGate: (summaries: ProofCheckpointSummaryLike[]) => ProofCheckpointSummaryLike[]
}

export async function buildHodProofAnalytics(db: AppDb, input: {
  facultyId: string
  roleScopeType?: string | null
  roleScopeId?: string | null
  now?: string
  filters?: {
    section?: string
    semester?: number
    simulationStageCheckpointId?: string
    riskBand?: string
    status?: string
    facultyId?: string
    courseCode?: string
    studentId?: string
  }
}, deps: ProofControlPlaneHodServiceDeps): Promise<HodProofAnalyticsResult> {
  const {
    average,
    buildEvidenceTimelineFromRows,
    bucketBacklogCount,
    hoursBetween,
    isOpenReassessmentStatus,
    matchesTextFilter,
    normalizeFilterValue,
    parseProofCheckpointSummary,
    proofRecoveryStateFromResolutionRow,
    proofResolutionPayloadFromRow,
    queueProjectionAssignedFacultyId,
    roundToOne,
    uniqueSorted,
    withProofPlaybackGate,
  } = deps
  const [
    allAppointmentRows,
    runRows,
    batchRows,
    branchRows,
    departmentRows,
    termRows,
    facultyRows,
    grantRows,
    ownershipRows,
    mentorRows,
    studentProfileRows,
    courseRows,
    sectionOfferingRows,
    observedRows,
    riskAssessmentRows,
    reassessmentRows,
    alertRows,
    acknowledgementRows,
    resolutionRows,
    overrideRows,
    loadRows,
    allocationRows,
    interventionRows,
    electiveRows,
    transcriptRows,
    stageCheckpointRows,
    stageStudentRows,
    stageQueueRows,
  ] = await Promise.all([
    db.select().from(facultyAppointments),
    db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1)),
    db.select().from(batches),
    db.select().from(branches),
    db.select().from(departments),
    db.select().from(academicTerms),
    db.select().from(facultyProfiles),
    db.select().from(roleGrants),
    db.select().from(facultyOfferingOwnerships),
    db.select().from(mentorAssignments),
    db.select().from(students),
    db.select().from(courses),
    db.select().from(sectionOfferings),
    db.select().from(studentObservedSemesterStates),
    db.select().from(riskAssessments),
    db.select().from(reassessmentEvents),
    db.select().from(alertDecisions),
    db.select().from(alertAcknowledgements),
    db.select().from(reassessmentResolutions),
    db.select().from(riskOverrides),
    db.select().from(teacherLoadProfiles),
    db.select().from(teacherAllocations),
    db.select().from(studentInterventions),
    db.select().from(electiveRecommendations),
    db.select().from(transcriptTermResults),
    db.select().from(simulationStageCheckpoints),
    db.select().from(simulationStageStudentProjections),
    db.select().from(simulationStageQueueProjections),
  ])

  const activeAppointments = allAppointmentRows.filter(row => row.facultyId === input.facultyId && row.status === 'active')
  const batchById = new Map(batchRows.map(row => [row.batchId, row]))
  const branchById = new Map(branchRows.map(row => [row.branchId, row]))
  const departmentById = new Map(departmentRows.map(row => [row.departmentId, row]))
  const termById = new Map(termRows.map(row => [row.termId, row]))
  const facultyById = new Map(facultyRows.map(row => [row.facultyId, row]))
  const studentById = new Map(studentProfileRows.map(row => [row.studentId, row]))
  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const scopeDepartmentIds = new Set(activeAppointments.map(row => row.departmentId))
  const scopeBranchIds = new Set(activeAppointments.map(row => row.branchId).filter((value): value is string => !!value))
  grantRows
    .filter(row => row.facultyId === input.facultyId && row.roleCode === 'HOD' && row.status === 'active')
    .forEach(row => {
      if (row.scopeType === 'department' && row.scopeId) {
        scopeDepartmentIds.add(row.scopeId)
      }
      if (row.scopeType === 'branch' && row.scopeId) {
        scopeBranchIds.add(row.scopeId)
      }
    })
  if (input.roleScopeType === 'department' && input.roleScopeId) {
    scopeDepartmentIds.add(input.roleScopeId)
  }
  if (input.roleScopeType === 'branch' && input.roleScopeId) {
    scopeBranchIds.add(input.roleScopeId)
  }
  const requestedCheckpoint = input.filters?.simulationStageCheckpointId
    ? stageCheckpointRows.find(row => row.simulationStageCheckpointId === input.filters?.simulationStageCheckpointId) ?? null
    : null
  const activeRunCandidates = runRows.filter(row => row.activeFlag === 1)
  const activeRun = requestedCheckpoint
    ? activeRunCandidates.find(row => row.simulationRunId === requestedCheckpoint.simulationRunId) ?? null
    : activeRunCandidates[0] ?? null
  const activeBatch = activeRun ? (batchById.get(activeRun.batchId) ?? null) : null
  const activeBranch = activeBatch ? (branchById.get(activeBatch.branchId) ?? null) : null
  const activeDepartmentId = activeBranch?.departmentId ?? null
  const departmentScopeKey = (departmentId: string | null | undefined) => {
    if (!departmentId) return null
    const department = departmentById.get(departmentId)
    if (!department) return null
    return `${normalizeFilterValue(department.code) ?? ''}::${normalizeFilterValue(department.name) ?? ''}`
  }
  const branchScopeKey = (branchId: string | null | undefined) => {
    if (!branchId) return null
    const branch = branchById.get(branchId)
    if (!branch) return null
    return `${normalizeFilterValue(branch.code) ?? ''}::${normalizeFilterValue(branch.name) ?? ''}`
  }
  const scopeDepartmentKeys = new Set(Array.from(scopeDepartmentIds).map(departmentScopeKey).filter((value): value is string => !!value))
  const scopeBranchKeys = new Set(Array.from(scopeBranchIds).map(branchScopeKey).filter((value): value is string => !!value))
  const matchesScopedDepartment = (departmentId: string | null | undefined) => {
    if (!departmentId) return false
    if (scopeDepartmentIds.has(departmentId)) return true
    const key = departmentScopeKey(departmentId)
    return !!key && scopeDepartmentKeys.has(key)
  }
  const matchesScopedBranch = (branchId: string | null | undefined) => {
    if (!branchId) return false
    if (scopeBranchIds.has(branchId)) return true
    const key = branchScopeKey(branchId)
    return !!key && scopeBranchKeys.has(key)
  }
  const matchesScopedAppointment = (departmentId: string | null | undefined, branchId: string | null | undefined) =>
    matchesScopedDepartment(departmentId) || matchesScopedBranch(branchId)
  const scopeMatchesActiveBatch = !!(activeBranch && matchesScopedAppointment(activeDepartmentId, activeBranch.branchId))
  const activeRunId = activeRun?.simulationRunId ?? null
  const currentSemester = input.filters?.semester ?? activeRun?.activeOperationalSemester ?? activeBatch?.currentSemester ?? 6
  const operationalCheckpointSummary = activeRunId
    ? resolveOperationalCheckpointSummary(
      stageCheckpointRows.filter(row => row.simulationRunId === activeRunId),
      currentSemester,
      { parseProofCheckpointSummary, withProofPlaybackGate },
    )
    : null
  const activeTermIds = new Set(
    termRows
      .filter(row => row.batchId === activeBatch?.batchId)
      .filter(row => row.semesterNumber === currentSemester)
      .map(row => row.termId),
  )

  const emptyResponse = {
    summary: {
      activeRunContext: null,
      ...buildUnavailableCountProvenance(),
      scope: {
        departmentNames: uniqueSorted(Array.from(scopeDepartmentIds).map(departmentId => departmentById.get(departmentId)?.name ?? departmentId)),
        branchNames: uniqueSorted(Array.from(scopeBranchIds).map(branchId => branchById.get(branchId)?.name ?? branchId)),
      },
      monitoringSummary: {
        riskAssessmentCount: 0,
        activeReassessmentCount: 0,
        alertDecisionCount: 0,
        acknowledgementCount: 0,
        resolutionCount: 0,
      },
      totals: {
        studentsCovered: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        averageQueueAgeHours: 0,
        manualOverrideCount: 0,
        unresolvedAlertCount: 0,
        resolvedAlertCount: 0,
      },
      sectionComparison: [] as Array<{
        sectionCode: string
        studentCount: number
        highRiskCount: number
        mediumRiskCount: number
        averageAttendancePct: number
        openReassessmentCount: number
      }>,
      semesterRiskDistribution: [] as Array<{
        semesterNumber: number
        highPressureCount: number
        reviewCount: number
        stableCount: number
        basis: string
      }>,
      backlogDistribution: [] as Array<{
        bucket: string
        studentCount: number
      }>,
      electiveDistribution: [] as Array<{
        stream: string
        recommendationCount: number
      }>,
      facultyLoadSummary: {
        facultyCount: 0,
        overloadedFacultyCount: 0,
        averageWeeklyContactHours: 0,
      },
    },
    courses: [] as Array<Record<string, unknown>>,
    faculty: [] as Array<Record<string, unknown>>,
    students: [] as Array<Record<string, unknown>>,
    reassessments: [] as Array<Record<string, unknown>>,
  }

  if (input.filters?.simulationStageCheckpointId) {
    if (!activeRun || !activeBatch || !activeBranch || !activeRunId || !scopeMatchesActiveBatch) return emptyResponse
    const checkpoint = requestedCheckpoint
    if (!checkpoint || checkpoint.simulationRunId !== activeRunId) return emptyResponse
    const checkpointSummary = withProofPlaybackGate(
      stageCheckpointRows
        .filter(row => row.simulationRunId === activeRunId)
        .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
        .map(parseProofCheckpointSummary),
    ).find(item => item.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      ?? parseProofCheckpointSummary(checkpoint)
    const checkpointStudentRows = stageStudentRows
      .filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
      .filter(row => matchesTextFilter(row.riskBand, input.filters?.riskBand))
      .filter(row => matchesTextFilter(row.courseCode, input.filters?.courseCode))
      .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    const checkpointQueueRows = stageQueueRows
      .filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
      .filter(row => matchesTextFilter(row.riskBand, input.filters?.riskBand))
      .filter(row => matchesTextFilter(row.courseCode, input.filters?.courseCode))
      .filter(row => matchesTextFilter(row.status, input.filters?.status))
      .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    const checkpointQueueGovernance = (row: typeof checkpointQueueRows[number]) => {
      const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
      return {
        detail,
        primaryCase: detail.primaryCase === true,
        countsTowardCapacity: detail.countsTowardCapacity === true,
        priorityRank: Number.isFinite(Number(detail.priorityRank)) ? Number(detail.priorityRank) : Number.MAX_SAFE_INTEGER,
        queueCaseId: typeof detail.queueCaseId === 'string' ? detail.queueCaseId : row.simulationStageQueueCaseId ?? null,
      }
    }
    const checkpointOpenCaseRows = checkpointQueueRows.filter(row => {
      const governance = checkpointQueueGovernance(row)
      return row.status === 'Open' && governance.primaryCase && governance.countsTowardCapacity
    })
    const scopedStudentIds = new Set(checkpointStudentRows.map(row => row.studentId))
    const latestCheckpointTranscriptByStudent = new Map<string, typeof transcriptRows[number]>()
    transcriptRows
      .filter(row => scopedStudentIds.has(row.studentId))
      .sort((left, right) => {
        const leftSemester = termById.get(left.termId)?.semesterNumber ?? 0
        const rightSemester = termById.get(right.termId)?.semesterNumber ?? 0
        return leftSemester - rightSemester || left.updatedAt.localeCompare(right.updatedAt)
      })
      .forEach(row => {
        latestCheckpointTranscriptByStudent.set(row.studentId, row)
      })
    const latestCheckpointBacklogRows = Array.from(latestCheckpointTranscriptByStudent.values())
    const currentSemesterLoadRows = loadRows
      .filter(row => row.simulationRunId === activeRunId)
      .filter(row => row.semesterNumber === checkpoint.semesterNumber)

    const facultyPermissionMap = new Map<string, string[]>()
    grantRows.filter(row => row.status === 'active').forEach(row => {
      facultyPermissionMap.set(row.facultyId, uniqueSorted([...(facultyPermissionMap.get(row.facultyId) ?? []), row.roleCode]))
    })

    const activeMentorAssignments = mentorRows.filter(row => row.effectiveTo === null)
    const activeOwnershipRows = ownershipRows.filter(row => row.status === 'active')
    const currentLoadAverage = average(currentSemesterLoadRows.map(row => row.weeklyContactHours))
    const overloadThreshold = Math.max(8, Math.ceil(currentLoadAverage * 1.25))
    const facultyIdsInScope = uniqueSorted([
      ...currentSemesterLoadRows.map(row => row.facultyId),
      ...activeMentorAssignments.map(row => row.facultyId),
      ...activeOwnershipRows.map(row => row.facultyId),
    ]).filter(facultyId => {
      const facultyAppointments = allAppointmentRows.filter(row => row.facultyId === facultyId && row.status === 'active')
      if (facultyAppointments.length === 0) return false
      return facultyAppointments.some(row => matchesScopedAppointment(row.departmentId, row.branchId))
    })

    const countProvenance = buildProofCountProvenance({
      activeOperationalSemester: activeRun.activeOperationalSemester ?? activeBatch.currentSemester,
      batchId: activeBatch.batchId,
      batchLabel: activeBatch.batchLabel,
      branchName: activeBranch.name,
      sectionCode: input.filters?.section ?? null,
      simulationRunId: activeRun.simulationRunId,
      runLabel: activeRun.runLabel,
      simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
      checkpointLabel: checkpointSummary.stageLabel,
    })
    const facultyRowsForHod = facultyIdsInScope
      .filter(facultyId => matchesTextFilter(facultyId, input.filters?.facultyId))
      .map(facultyId => {
        const profile = facultyById.get(facultyId)
        const load = currentSemesterLoadRows.find(row => row.facultyId === facultyId) ?? null
        const allocations = allocationRows
          .filter(row => row.simulationRunId === activeRunId && row.semesterNumber === checkpoint.semesterNumber && row.facultyId === facultyId)
          .filter(row => !input.filters?.section || matchesTextFilter(row.sectionCode ?? null, input.filters.section))
        const relevantOfferingIds = new Set(activeOwnershipRows.filter(row => row.facultyId === facultyId).map(row => row.offeringId))
        const relevantStudentIds = new Set(activeMentorAssignments.filter(row => row.facultyId === facultyId).map(row => row.studentId))
        const relevantQueueRows = checkpointQueueRows.filter(row => {
          const assignedFacultyId = queueProjectionAssignedFacultyId(row)
          return assignedFacultyId === facultyId || relevantStudentIds.has(row.studentId) || (!!row.offeringId && relevantOfferingIds.has(row.offeringId))
        })
        const relevantInterventions = interventionRows.filter(row => row.facultyId === facultyId)
        return {
          facultyId,
          facultyName: profile?.displayName ?? facultyId,
          designation: profile?.designation ?? 'Faculty',
          permissions: facultyPermissionMap.get(facultyId) ?? [],
          weeklyContactHours: load?.weeklyContactHours ?? 0,
          sectionLoadCount: load?.sectionLoadCount ?? 0,
          assignedSections: uniqueSorted(allocations.map(row => row.sectionCode ?? '').filter(Boolean)),
          queueLoad: relevantQueueRows.filter(row => {
            const governance = checkpointQueueGovernance(row)
            return row.status === 'Open' && governance.primaryCase && governance.countsTowardCapacity
          }).length,
          avgAcknowledgementLagHours: 0,
          reassessmentClosureRate: relevantQueueRows.length > 0
            ? roundToOne((relevantQueueRows.filter(row => row.status === 'Resolved').length / relevantQueueRows.length) * 100)
            : 0,
          interventionCount: relevantInterventions.length,
          overloadFlag: (load?.weeklyContactHours ?? 0) >= overloadThreshold,
        }
      })
      .sort((left, right) => (right.queueLoad - left.queueLoad) || (right.weeklyContactHours - left.weeklyContactHours) || left.facultyName.localeCompare(right.facultyName))

    const courseRollups = Array.from(new Map(
      checkpointStudentRows.map(row => {
        const queueCount = checkpointOpenCaseRows.filter(item => item.courseCode === row.courseCode && item.sectionCode === row.sectionCode).length
        return [`${row.courseCode}::${row.sectionCode}`, {
          courseCode: row.courseCode,
          title: row.courseTitle,
          sectionCodes: uniqueSorted(checkpointStudentRows.filter(item => item.courseCode === row.courseCode).map(item => item.sectionCode)),
          riskCountHigh: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && item.riskBand === 'High').length,
          riskCountMedium: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && item.riskBand === 'Medium').length,
          averageAttendancePct: roundToOne(average(checkpointStudentRows.filter(item => item.courseCode === row.courseCode).map(item => {
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.attendancePct ?? 0)
          }))),
          tt1WeakCount: checkpointStudentRows.filter(item => {
            if (item.courseCode !== row.courseCode) return false
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.tt1Pct ?? 0) > 0 && Number(evidence.tt1Pct ?? 0) < 45
          }).length,
          tt2WeakCount: checkpointStudentRows.filter(item => {
            if (item.courseCode !== row.courseCode) return false
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.tt2Pct ?? 0) > 0 && Number(evidence.tt2Pct ?? 0) < 45
          }).length,
          seeWeakCount: checkpointStudentRows.filter(item => {
            if (item.courseCode !== row.courseCode) return false
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.seePct ?? 0) > 0 && Number(evidence.seePct ?? 0) < 45
          }).length,
          weakQuestionSignalCount: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && Number(((parseJson(item.projectionJson, {} as Record<string, unknown>).currentEvidence ?? {}) as Record<string, unknown>).weakQuestionCount ?? 0) >= 4).length,
          backlogCarryoverCount: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && Number(((parseJson(item.projectionJson, {} as Record<string, unknown>).currentStatus ?? {}) as Record<string, unknown>).backlogCount ?? 0) > 0).length,
          openReassessmentCount: queueCount,
          resolvedReassessmentCount: checkpointQueueRows.filter(item => item.courseCode === row.courseCode && item.status === 'Resolved').length,
          studentCount: checkpointStudentRows.filter(item => item.courseCode === row.courseCode).length,
        }]
      }),
    ).values())
      .sort((left, right) => ((right.riskCountHigh + right.riskCountMedium) - (left.riskCountHigh + left.riskCountMedium)) || left.courseCode.localeCompare(right.courseCode))

    const studentWatchRows = Array.from(new Set(checkpointStudentRows.map(row => row.studentId)))
      .map(studentId => {
        const student = studentById.get(studentId)
        const rowsForStudent = checkpointStudentRows
          .filter(row => row.studentId === studentId)
          .sort((left, right) => {
            const leftPayload = parseJson(left.projectionJson, {} as Record<string, unknown>)
            const rightPayload = parseJson(right.projectionJson, {} as Record<string, unknown>)
            const leftGovernance = (leftPayload.governance ?? {}) as Record<string, unknown>
            const rightGovernance = (rightPayload.governance ?? {}) as Record<string, unknown>
            const leftPrimary = leftGovernance.primaryCase === true
            const rightPrimary = rightGovernance.primaryCase === true
            if (leftPrimary !== rightPrimary) return Number(rightPrimary) - Number(leftPrimary)
            const leftCounts = leftGovernance.countsTowardCapacity === true
            const rightCounts = rightGovernance.countsTowardCapacity === true
            if (leftCounts !== rightCounts) return Number(rightCounts) - Number(leftCounts)
            const leftRank = Number.isFinite(Number(leftGovernance.priorityRank)) ? Number(leftGovernance.priorityRank) : Number.MAX_SAFE_INTEGER
            const rightRank = Number.isFinite(Number(rightGovernance.priorityRank)) ? Number(rightGovernance.priorityRank) : Number.MAX_SAFE_INTEGER
            if (leftRank !== rightRank) return leftRank - rightRank
            return right.riskProbScaled - left.riskProbScaled || left.courseCode.localeCompare(right.courseCode)
          })
        const primary = rowsForStudent[0]
        if (!primary) return null
        const primaryPayload = parseJson(primary.projectionJson, {} as Record<string, unknown>)
        const primaryEvidence = (primaryPayload.currentEvidence ?? {}) as Record<string, unknown>
        const currentStatus = (primaryPayload.currentStatus ?? {}) as Record<string, unknown>
        const governance = (primaryPayload.governance ?? {}) as Record<string, unknown>
        const counterfactualPolicy = (primaryPayload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>
        const evidenceTimeline = buildEvidenceTimelineFromRows(observedRows
          .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
          .sort((left, right) => left.semesterNumber - right.semesterNumber || left.createdAt.localeCompare(right.createdAt)))
        const electiveFit = checkpoint.stageKey === 'post-see'
          ? electiveRows
            .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
          : null
        return {
          studentId,
          studentName: student?.name ?? studentId,
          usn: student?.usn ?? '',
          sectionCode: primary.sectionCode,
          currentSemester: checkpoint.semesterNumber,
          currentRiskBand: primary.riskBand,
          currentRiskProbScaled: primary.riskProbScaled,
          currentQueueState: typeof currentStatus.queueState === 'string' ? currentStatus.queueState : null,
          queueCaseId: typeof governance.queueCaseId === 'string' ? governance.queueCaseId : null,
          countsTowardCapacity: governance.countsTowardCapacity === true,
          governanceReason: typeof governance.governanceReason === 'string' ? governance.governanceReason : null,
          supportingCourseCount: Number.isFinite(Number(governance.supportingCourseCount)) ? Number(governance.supportingCourseCount) : 0,
          assignedFacultyId: typeof governance.assignedFacultyId === 'string' ? governance.assignedFacultyId : null,
          riskChangeFromPreviousCheckpointScaled: Number(primaryPayload.riskChangeFromPreviousCheckpointScaled ?? 0),
          counterfactualLiftScaled: Number(
            counterfactualPolicy.counterfactualLiftScaled
            ?? primaryPayload.counterfactualLiftScaled
            ?? (primary.noActionRiskProbScaled ?? primary.riskProbScaled) - primary.riskProbScaled,
          ),
          primaryCourseCode: primary.courseCode,
          primaryCourseTitle: primary.courseTitle,
          currentReassessmentStatus: primary.reassessmentState,
          nextDueAt: typeof currentStatus.dueAt === 'string' ? currentStatus.dueAt : null,
          observedEvidence: {
            attendancePct: Number(primaryEvidence.attendancePct ?? 0),
            tt1Pct: Number(primaryEvidence.tt1Pct ?? 0),
            tt2Pct: Number(primaryEvidence.tt2Pct ?? 0),
            quizPct: Number(primaryEvidence.quizPct ?? 0),
            assignmentPct: Number(primaryEvidence.assignmentPct ?? 0),
            seePct: Number(primaryEvidence.seePct ?? 0),
            cgpa: 0,
            backlogCount: 0,
            weakCoCount: Number(primaryEvidence.weakCoCount ?? 0),
            weakQuestionCount: Number(primaryEvidence.weakQuestionCount ?? 0),
            coEvidenceMode: typeof primaryEvidence.coEvidenceMode === 'string' ? primaryEvidence.coEvidenceMode : null,
            interventionRecoveryStatus: typeof primaryEvidence.interventionRecoveryStatus === 'string'
              ? primaryEvidence.interventionRecoveryStatus
              : null,
          },
          electiveFit: electiveFit ? {
            recommendedCode: electiveFit.recommendedCode,
            recommendedTitle: electiveFit.recommendedTitle,
            stream: electiveFit.stream,
            rationale: parseJson(electiveFit.rationaleJson, [] as string[]),
            alternatives: parseJson(electiveFit.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
          } : null,
          courseSnapshots: rowsForStudent.map(row => {
            const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
            const evidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
            return {
              riskAssessmentId: `checkpoint:${checkpoint.simulationStageCheckpointId}:${row.studentId}:${row.courseCode}`,
              offeringId: row.offeringId ?? `${checkpoint.simulationStageCheckpointId}:${row.courseCode}`,
              courseCode: row.courseCode,
              courseTitle: row.courseTitle,
              sectionCode: row.sectionCode,
              riskBand: row.riskBand,
              riskProbScaled: row.riskProbScaled,
              queueState: typeof ((payload.currentStatus ?? {}) as Record<string, unknown>).queueState === 'string'
                ? String(((payload.currentStatus ?? {}) as Record<string, unknown>).queueState)
                : null,
              queueCaseId: typeof (((payload.governance ?? {}) as Record<string, unknown>).queueCaseId) === 'string'
                ? String((((payload.governance ?? {}) as Record<string, unknown>).queueCaseId))
                : null,
              primaryCase: ((payload.governance ?? {}) as Record<string, unknown>).primaryCase === true,
              countsTowardCapacity: ((payload.governance ?? {}) as Record<string, unknown>).countsTowardCapacity === true,
              governanceReason: typeof (((payload.governance ?? {}) as Record<string, unknown>).governanceReason) === 'string'
                ? String((((payload.governance ?? {}) as Record<string, unknown>).governanceReason))
                : null,
              supportingCourseCount: Number.isFinite(Number((((payload.governance ?? {}) as Record<string, unknown>).supportingCourseCount)))
                ? Number((((payload.governance ?? {}) as Record<string, unknown>).supportingCourseCount))
                : 0,
              assignedFacultyId: typeof (((payload.governance ?? {}) as Record<string, unknown>).assignedFacultyId) === 'string'
                ? String((((payload.governance ?? {}) as Record<string, unknown>).assignedFacultyId))
                : null,
              riskChangeFromPreviousCheckpointScaled: Number(payload.riskChangeFromPreviousCheckpointScaled ?? 0),
              counterfactualLiftScaled: Number(
                payload.counterfactualLiftScaled
                ?? (((payload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>).counterfactualLiftScaled)
                ?? (row.noActionRiskProbScaled ?? row.riskProbScaled) - row.riskProbScaled,
              ),
              recommendedAction: row.recommendedAction ?? 'Continue routine monitoring on the current evidence window.',
              observedEvidence: {
                attendancePct: Number(evidence.attendancePct ?? 0),
                tt1Pct: Number(evidence.tt1Pct ?? 0),
                tt2Pct: Number(evidence.tt2Pct ?? 0),
                quizPct: Number(evidence.quizPct ?? 0),
                assignmentPct: Number(evidence.assignmentPct ?? 0),
                seePct: Number(evidence.seePct ?? 0),
                cgpa: 0,
                backlogCount: 0,
                weakCoCount: Number(evidence.weakCoCount ?? 0),
                weakQuestionCount: Number(evidence.weakQuestionCount ?? 0),
                coEvidenceMode: typeof evidence.coEvidenceMode === 'string' ? evidence.coEvidenceMode : null,
                interventionRecoveryStatus: typeof evidence.interventionRecoveryStatus === 'string' ? evidence.interventionRecoveryStatus : null,
              },
              drivers: [],
            }
          }),
          evidenceTimeline,
        }
      })
      .filter((row): row is NonNullable<typeof row> => !!row)
      .sort((left, right) => (right.currentRiskProbScaled - left.currentRiskProbScaled) || left.studentName.localeCompare(right.studentName))

    const reassessments = checkpointQueueRows
      .map(row => {
        const student = studentById.get(row.studentId)
        const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
        return {
          reassessmentEventId: row.simulationStageQueueProjectionId,
          simulationRunId: checkpoint.simulationRunId,
          runLabel: activeRun.runLabel,
          studentId: row.studentId,
          studentName: student?.name ?? row.studentId,
          usn: student?.usn ?? '',
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          sectionCode: row.sectionCode,
          assignedToRole: row.assignedToRole ?? 'Course Leader',
          assignedFacultyId: row.assignedFacultyId ?? (typeof detail.assignedFacultyId === 'string' ? detail.assignedFacultyId : null),
          dueAt: typeof detail.dueAt === 'string' ? detail.dueAt : checkpoint.updatedAt,
          status: row.status,
          riskBand: row.riskBand,
          riskProbScaled: row.riskProbScaled,
          decisionType: queueDecisionTypeFromStatus(row.status),
          decisionNote: typeof detail.note === 'string' ? detail.note : null,
          queueCaseId: typeof detail.queueCaseId === 'string' ? detail.queueCaseId : row.simulationStageQueueCaseId ?? null,
          primaryCase: detail.primaryCase === true,
          countsTowardCapacity: detail.countsTowardCapacity === true,
          priorityRank: Number.isFinite(Number(detail.priorityRank)) ? Number(detail.priorityRank) : null,
          governanceReason: typeof detail.governanceReason === 'string' ? detail.governanceReason : null,
          supportingCourseCount: Number.isFinite(Number(detail.supportingCourseCount)) ? Number(detail.supportingCourseCount) : 0,
          recoveryState: row.status === 'Resolved' ? 'under_watch' : null,
          observedResidual: null,
          acknowledgement: null,
          resolution: row.status === 'Resolved'
            ? {
                resolvedByFacultyId: null,
                resolutionStatus: 'Resolved',
                note: typeof detail.note === 'string' ? detail.note : null,
                createdAt: checkpoint.updatedAt,
              }
            : null,
        }
      })
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || right.riskProbScaled - left.riskProbScaled)

    return {
      summary: {
        activeRunContext: {
          simulationRunId: activeRun.simulationRunId,
          batchId: activeBatch.batchId,
          batchLabel: activeBatch.batchLabel,
          branchName: activeBranch.name,
          runLabel: activeRun.runLabel,
          status: activeRun.status,
          seed: activeRun.seed,
          createdAt: activeRun.createdAt,
          sourceLabel: 'Live proof records',
          checkpointContext: checkpointSummary,
        },
        ...countProvenance,
        scope: {
          departmentNames: uniqueSorted(Array.from(scopeDepartmentIds).map(departmentId => departmentById.get(departmentId)?.name ?? departmentId)),
          branchNames: uniqueSorted(Array.from(scopeBranchIds).map(branchId => branchById.get(branchId)?.name ?? branchId)),
        },
        monitoringSummary: {
          riskAssessmentCount: checkpointStudentRows.length,
          activeReassessmentCount: checkpointOpenCaseRows.length,
          alertDecisionCount: checkpointQueueRows.length,
          acknowledgementCount: 0,
          resolutionCount: checkpointQueueRows.filter(row => row.status === 'Resolved' && checkpointQueueGovernance(row).primaryCase).length,
        },
        totals: {
          studentsCovered: scopedStudentIds.size,
          highRiskCount: checkpointStudentRows.filter(row => row.riskBand === 'High').length,
          mediumRiskCount: checkpointStudentRows.filter(row => row.riskBand === 'Medium').length,
          averageQueueAgeHours: 0,
          manualOverrideCount: 0,
          unresolvedAlertCount: checkpointOpenCaseRows.length,
          resolvedAlertCount: checkpointQueueRows.filter(row => row.status === 'Resolved' && checkpointQueueGovernance(row).primaryCase).length,
        },
        sectionComparison: uniqueSorted(checkpointStudentRows.map(row => row.sectionCode)).map(sectionCode => ({
          sectionCode,
          studentCount: new Set(checkpointStudentRows.filter(row => row.sectionCode === sectionCode).map(row => row.studentId)).size,
          highRiskCount: checkpointStudentRows.filter(row => row.sectionCode === sectionCode && row.riskBand === 'High').length,
          mediumRiskCount: checkpointStudentRows.filter(row => row.sectionCode === sectionCode && row.riskBand === 'Medium').length,
          averageAttendancePct: roundToOne(average(checkpointStudentRows.filter(row => row.sectionCode === sectionCode).map(row => {
            const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
            const evidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.attendancePct ?? 0)
          }))),
          openReassessmentCount: checkpointOpenCaseRows.filter(row => row.sectionCode === sectionCode).length,
        })),
        semesterRiskDistribution: termRows
          .filter(row => row.batchId === activeBatch.batchId && row.semesterNumber <= checkpoint.semesterNumber)
          .sort((left, right) => left.semesterNumber - right.semesterNumber)
          .map(term => {
            const termTranscripts = transcriptRows
              .filter(row => row.termId === term.termId)
              .filter(row => scopedStudentIds.has(row.studentId))
            const highPressureCount = termTranscripts.filter(row => row.backlogCount >= 2).length
            const reviewCount = termTranscripts.filter(row => row.backlogCount === 1).length
            const stableCount = termTranscripts.filter(row => row.backlogCount === 0).length
            return {
              semesterNumber: term.semesterNumber,
              highPressureCount,
              reviewCount,
              stableCount,
              basis: 'transcript-backlog',
            }
          }),
        backlogDistribution: ['0', '1', '2', '3+'].map(bucket => ({
          bucket,
          studentCount: latestCheckpointBacklogRows.filter(row => bucketBacklogCount(row.backlogCount) === bucket).length,
        })),
        electiveDistribution: checkpoint.stageKey === 'post-see'
          ? Array.from(new Map(electiveRows.filter(row => row.simulationRunId === activeRunId).map(row => [row.stream, {
              stream: row.stream,
              recommendationCount: electiveRows.filter(item => item.simulationRunId === activeRunId && item.stream === row.stream).length,
            }])).values()).sort((left, right) => right.recommendationCount - left.recommendationCount || left.stream.localeCompare(right.stream))
          : [],
        facultyLoadSummary: {
          facultyCount: facultyRowsForHod.length,
          overloadedFacultyCount: facultyRowsForHod.filter(row => row.overloadFlag).length,
          averageWeeklyContactHours: roundToOne(average(facultyRowsForHod.map(row => row.weeklyContactHours))),
        },
      },
      courses: courseRollups,
      faculty: facultyRowsForHod,
      students: studentWatchRows,
      reassessments,
    }
  }

  if (!activeRun || !activeBatch || !activeBranch || !activeRunId || !scopeMatchesActiveBatch) return emptyResponse

  if (
    !input.filters?.simulationStageCheckpointId
    && activeRun.activeOperationalSemester != null
    && activeRun.activeOperationalSemester !== activeBatch.currentSemester
    && operationalCheckpointSummary
  ) {
    const checkpointResult = await buildHodProofAnalytics(db, {
      facultyId: input.facultyId,
      roleScopeType: input.roleScopeType,
      roleScopeId: input.roleScopeId,
      now: input.now,
      filters: {
        ...input.filters,
        simulationStageCheckpointId: operationalCheckpointSummary.simulationStageCheckpointId,
      },
    }, deps)
    const countProvenance = buildProofCountProvenance({
      activeOperationalSemester: activeRun.activeOperationalSemester ?? activeBatch.currentSemester,
      batchId: activeBatch.batchId,
      batchLabel: activeBatch.batchLabel,
      branchName: activeBranch.name,
      sectionCode: input.filters?.section ?? null,
      simulationRunId: activeRun.simulationRunId,
      runLabel: activeRun.runLabel,
    })
    const checkpointActiveRunContext = checkpointResult.summary.activeRunContext
    const { checkpointContext: _checkpointContext, ...activeRunContext } = checkpointActiveRunContext ?? {}
    return {
      ...checkpointResult,
      summary: {
        ...checkpointResult.summary,
        ...countProvenance,
        activeRunContext: checkpointActiveRunContext ? activeRunContext : null,
      },
    }
  }

  const activeOfferings = sectionOfferingRows
    .filter(row => activeTermIds.has(row.termId))
    .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
    .filter(row => {
      const course = courseById.get(row.courseId)
      return matchesTextFilter(course?.courseCode ?? null, input.filters?.courseCode)
    })
  const activeOfferingIds = new Set(activeOfferings.map(row => row.offeringId))
  const filteredObservedRows = observedRows
    .filter(row => row.simulationRunId === activeRunId)
    .filter(row => row.semesterNumber === currentSemester)
    .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
    .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    .filter(row => {
      const payload = parseObservedStateRow(row)
      const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
      if (activeOfferingIds.size === 0) return !offeringId
      return !!offeringId && activeOfferingIds.has(offeringId)
    })

  const observedByStudentOffering = new Map<string, Record<string, unknown>>()
  filteredObservedRows.forEach(row => {
    const payload = parseObservedStateRow(row)
    const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
    if (!offeringId) return
    observedByStudentOffering.set(`${row.studentId}::${offeringId}`, payload)
  })

  const activeRiskRows = riskAssessmentRows
    .filter(row => row.simulationRunId === activeRunId)
    .filter(row => activeOfferingIds.has(row.offeringId))
    .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    .filter(row => matchesTextFilter(row.riskBand, input.filters?.riskBand))

  const activeRiskIds = new Set(activeRiskRows.map(row => row.riskAssessmentId))
  const activeAlerts = alertRows.filter(row => activeRiskIds.has(row.riskAssessmentId))
  const activeReassessments = reassessmentRows
    .filter(row => activeRiskIds.has(row.riskAssessmentId))
    .filter(row => matchesTextFilter(row.status, input.filters?.status))
  const activeAlertIds = new Set(activeAlerts.map(row => row.alertDecisionId))
  const activeAcknowledgements = acknowledgementRows.filter(row => activeAlertIds.has(row.alertDecisionId))
  const activeReassessmentIds = new Set(activeReassessments.map(row => row.reassessmentEventId))
  const activeResolutions = resolutionRows.filter(row => activeReassessmentIds.has(row.reassessmentEventId))
  const activeOverrides = overrideRows.filter(row => activeRiskIds.has(row.riskAssessmentId))

  const distinctStudentIds = new Set(filteredObservedRows.map(row => row.studentId))
  if (input.filters?.studentId) distinctStudentIds.add(input.filters.studentId)
  const distinctStudentSectionById = new Map<string, string>()
  observedRows
    .filter(row => row.simulationRunId === activeRunId)
    .forEach(row => {
      if (!distinctStudentSectionById.has(row.studentId)) distinctStudentSectionById.set(row.studentId, row.sectionCode)
    })

  const activeRunContext = {
    simulationRunId: activeRun.simulationRunId,
    batchId: activeBatch.batchId,
    batchLabel: activeBatch.batchLabel,
    branchName: activeBranch.name,
    runLabel: activeRun.runLabel,
    status: activeRun.status,
    seed: activeRun.seed,
    createdAt: activeRun.createdAt,
    sourceLabel: 'Live proof records',
  }

  const currentSemesterLoadRows = loadRows
    .filter(row => row.simulationRunId === activeRunId)
    .filter(row => row.semesterNumber === currentSemester)

  const facultyPermissionMap = new Map<string, string[]>()
  grantRows
    .filter(row => row.status === 'active')
    .forEach(row => {
      facultyPermissionMap.set(row.facultyId, uniqueSorted([...(facultyPermissionMap.get(row.facultyId) ?? []), row.roleCode]))
    })

  const activeMentorAssignments = mentorRows.filter(row => row.effectiveTo === null)
  const activeOwnershipRows = ownershipRows.filter(row => row.status === 'active')
  const currentLoadAverage = average(currentSemesterLoadRows.map(row => row.weeklyContactHours))
  const overloadThreshold = Math.max(8, Math.ceil(currentLoadAverage * 1.25))
  const facultyIdsInScope = uniqueSorted([
    ...currentSemesterLoadRows.map(row => row.facultyId),
    ...activeMentorAssignments.map(row => row.facultyId),
    ...activeOwnershipRows.map(row => row.facultyId),
  ]).filter(facultyId => {
    const facultyAppointments = allAppointmentRows.filter(row => row.facultyId === facultyId && row.status === 'active')
    if (facultyAppointments.length === 0) return false
    return facultyAppointments.some(row => matchesScopedAppointment(row.departmentId, row.branchId))
  })

  const facultyRowsForHod = facultyIdsInScope
    .filter(facultyId => matchesTextFilter(facultyId, input.filters?.facultyId))
    .map(facultyId => {
      const profile = facultyById.get(facultyId)
      const load = currentSemesterLoadRows.find(row => row.facultyId === facultyId) ?? null
      const allocations = allocationRows
        .filter(row => row.simulationRunId === activeRunId && row.semesterNumber === currentSemester && row.facultyId === facultyId)
        .filter(row => !input.filters?.section || matchesTextFilter(row.sectionCode ?? null, input.filters.section))
      const relevantOfferingIds = new Set(activeOwnershipRows.filter(row => row.facultyId === facultyId).map(row => row.offeringId))
      const relevantStudentIds = new Set(activeMentorAssignments.filter(row => row.facultyId === facultyId).map(row => row.studentId))
      const relevantRiskRows = activeRiskRows.filter(row => relevantStudentIds.has(row.studentId) || relevantOfferingIds.has(row.offeringId))
      const relevantRiskIds = new Set(relevantRiskRows.map(row => row.riskAssessmentId))
      const relevantReassessments = activeReassessments.filter(row =>
        (row.assignedFacultyId != null && row.assignedFacultyId === facultyId) || relevantRiskIds.has(row.riskAssessmentId),
      )
      const relevantAlerts = activeAlerts.filter(row => relevantRiskIds.has(row.riskAssessmentId))
      const relevantAcks = activeAcknowledgements.filter(row => relevantAlerts.some(alert => alert.alertDecisionId === row.alertDecisionId))
      const relevantInterventions = interventionRows.filter(row => row.facultyId === facultyId && (!row.offeringId || activeOfferingIds.has(row.offeringId)))
      const avgAcknowledgementLagHours = relevantAcks.length > 0
        ? roundToOne(average(relevantAcks.map(ack => {
            const alert = relevantAlerts.find(item => item.alertDecisionId === ack.alertDecisionId)
            return alert ? hoursBetween(alert.createdAt, ack.createdAt) : 0
          })))
        : 0
      const resolvedCount = relevantReassessments.filter(row => activeResolutions.some(resolution => resolution.reassessmentEventId === row.reassessmentEventId)).length
      const closureRate = relevantReassessments.length > 0 ? roundToOne((resolvedCount / relevantReassessments.length) * 100) : 0
      return {
        facultyId,
        facultyName: profile?.displayName ?? facultyId,
        designation: profile?.designation ?? 'Faculty',
        permissions: facultyPermissionMap.get(facultyId) ?? [],
        weeklyContactHours: load?.weeklyContactHours ?? 0,
        sectionLoadCount: load?.sectionLoadCount ?? 0,
        assignedSections: uniqueSorted(allocations.map(row => row.sectionCode ?? '').filter(Boolean)),
        queueLoad: relevantReassessments.filter(row => isOpenReassessmentStatus(row.status)).length,
        avgAcknowledgementLagHours,
        reassessmentClosureRate: closureRate,
        interventionCount: relevantInterventions.length,
        overloadFlag: (load?.weeklyContactHours ?? 0) >= overloadThreshold,
      }
    })
    .sort((left, right) => (right.queueLoad - left.queueLoad) || (right.weeklyContactHours - left.weeklyContactHours) || left.facultyName.localeCompare(right.facultyName))

  const courseRollups = Array.from(new Map(
    uniqueSorted(activeOfferings.map(row => row.courseId)).map(courseId => {
      const course = courseById.get(courseId)
      const offeringIdsForCourse = new Set(activeOfferings.filter(row => row.courseId === courseId).map(row => row.offeringId))
      const riskForCourse = activeRiskRows.filter(row => offeringIdsForCourse.has(row.offeringId))
      const riskIds = new Set(riskForCourse.map(row => row.riskAssessmentId))
      const courseObserved = filteredObservedRows.filter(row => {
        const payload = parseObservedStateRow(row)
        return typeof payload.offeringId === 'string' && offeringIdsForCourse.has(payload.offeringId)
      })
      const attendanceValues = courseObserved.map(row => Number(parseObservedStateRow(row).attendancePct ?? 0)).filter(Number.isFinite)
      const tt1Values = courseObserved.map(row => Number(parseObservedStateRow(row).tt1Pct ?? 0)).filter(Number.isFinite)
      const tt2Values = courseObserved.map(row => Number(parseObservedStateRow(row).tt2Pct ?? 0)).filter(Number.isFinite)
      const seeValues = courseObserved.map(row => Number(parseObservedStateRow(row).seePct ?? 0)).filter(Number.isFinite)
      const weakQuestionValues = courseObserved.map(row => Number((parseObservedStateRow(row).questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0)).filter(Number.isFinite)
      const backlogValues = courseObserved.map(row => Number(parseObservedStateRow(row).backlogCount ?? 0)).filter(Number.isFinite)
      const relevantReassessments = activeReassessments.filter(row => riskIds.has(row.riskAssessmentId))
      const key = course?.courseCode ?? courseId
      return [key, {
        courseCode: course?.courseCode ?? 'NA',
        title: course?.title ?? 'Untitled course',
        sectionCodes: uniqueSorted(activeOfferings.filter(row => row.courseId === courseId).map(row => row.sectionCode)),
        riskCountHigh: riskForCourse.filter(row => normalizeFilterValue(row.riskBand) === 'high').length,
        riskCountMedium: riskForCourse.filter(row => normalizeFilterValue(row.riskBand) === 'medium').length,
        averageAttendancePct: roundToOne(average(attendanceValues)),
        tt1WeakCount: tt1Values.filter(value => value < 45).length,
        tt2WeakCount: tt2Values.filter(value => value < 45).length,
        seeWeakCount: seeValues.filter(value => value < 45).length,
        weakQuestionSignalCount: weakQuestionValues.filter(value => value >= 4).length,
        backlogCarryoverCount: backlogValues.filter(value => value > 0).length,
        openReassessmentCount: relevantReassessments.filter(row => isOpenReassessmentStatus(row.status)).length,
        resolvedReassessmentCount: relevantReassessments.filter(row => activeResolutions.some(resolution => resolution.reassessmentEventId === row.reassessmentEventId)).length,
        studentCount: new Set(courseObserved.map(row => row.studentId)).size,
      }]
    }),
  ).values())
    .sort((left, right) => ((right.riskCountHigh + right.riskCountMedium) - (left.riskCountHigh + left.riskCountMedium)) || left.courseCode.localeCompare(right.courseCode))

  const latestTranscriptByStudent = new Map<string, typeof transcriptTermResults.$inferSelect>()
  transcriptRows
    .filter(row => {
      const term = termById.get(row.termId)
      return term?.batchId === activeBatch.batchId
    })
    .sort((left, right) => right.termId.localeCompare(left.termId) || right.updatedAt.localeCompare(left.updatedAt))
    .forEach(row => {
      if (!latestTranscriptByStudent.has(row.studentId)) latestTranscriptByStudent.set(row.studentId, row)
    })
  const latestResolutionByEventId = new Map<string, typeof reassessmentResolutions.$inferSelect>()
  activeResolutions
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach(row => {
      if (!latestResolutionByEventId.has(row.reassessmentEventId)) {
        latestResolutionByEventId.set(row.reassessmentEventId, row)
      }
    })
  const latestReassessmentByRiskId = new Map<string, typeof activeReassessments[number]>()
  activeReassessments
    .slice()
    .sort((left, right) => {
      const leftRank = isOpenReassessmentStatus(left.status) ? 1 : 0
      const rightRank = isOpenReassessmentStatus(right.status) ? 1 : 0
      if (leftRank !== rightRank) return rightRank - leftRank
      return right.updatedAt.localeCompare(left.updatedAt)
    })
    .forEach(row => {
      if (!latestReassessmentByRiskId.has(row.riskAssessmentId)) {
        latestReassessmentByRiskId.set(row.riskAssessmentId, row)
      }
    })

  const studentWatchRows = Array.from(new Set(activeRiskRows.map(row => row.studentId)))
    .map(studentId => {
      const student = studentById.get(studentId)
      const riskForStudent = activeRiskRows
        .filter(row => row.studentId === studentId)
        .sort((left, right) => {
          const leftReassessment = latestReassessmentByRiskId.get(left.riskAssessmentId) ?? null
          const rightReassessment = latestReassessmentByRiskId.get(right.riskAssessmentId) ?? null
          const leftRank = leftReassessment && isOpenReassessmentStatus(leftReassessment.status) ? 2 : leftReassessment ? 1 : 0
          const rightRank = rightReassessment && isOpenReassessmentStatus(rightReassessment.status) ? 2 : rightReassessment ? 1 : 0
          if (leftRank !== rightRank) return rightRank - leftRank
          return (right.riskProbScaled - left.riskProbScaled) || left.offeringId.localeCompare(right.offeringId)
        })
      const primaryRisk = riskForStudent[0]
      if (!primaryRisk) return null
      const offering = sectionOfferingRows.find(row => row.offeringId === primaryRisk.offeringId) ?? null
      const course = offering ? courseById.get(offering.courseId) : null
      const primaryEvidence = observedByStudentOffering.get(`${studentId}::${primaryRisk.offeringId}`) ?? {}
      const primaryReassessment = latestReassessmentByRiskId.get(primaryRisk.riskAssessmentId) ?? null
      const primaryReassessmentPayload = primaryReassessment ? parseJson(primaryReassessment.payloadJson, {} as Record<string, unknown>) : {}
      const primaryResolution = primaryReassessment ? (latestResolutionByEventId.get(primaryReassessment.reassessmentEventId) ?? null) : null
      const studentObservedRows = observedRows
        .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
        .sort((left, right) => left.semesterNumber - right.semesterNumber || left.createdAt.localeCompare(right.createdAt))
      const evidenceTimeline = buildEvidenceTimelineFromRows(studentObservedRows)
      const electiveFit = electiveRows
        .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      const relevantReassessments = activeReassessments.filter(row => row.studentId === studentId)
      const nextDueAt = relevantReassessments.filter(row => isOpenReassessmentStatus(row.status)).map(row => row.dueAt).sort()[0] ?? null
      const courseSnapshots = riskForStudent.map(row => {
        const rowOffering = sectionOfferingRows.find(item => item.offeringId === row.offeringId) ?? null
        const rowCourse = rowOffering ? courseById.get(rowOffering.courseId) : null
        const rowEvidence = observedByStudentOffering.get(`${studentId}::${row.offeringId}`) ?? {}
        const rowReassessment = latestReassessmentByRiskId.get(row.riskAssessmentId) ?? null
        const rowPayload = rowReassessment ? parseJson(rowReassessment.payloadJson, {} as Record<string, unknown>) : {}
        return {
          riskAssessmentId: row.riskAssessmentId,
          offeringId: row.offeringId,
          courseCode: rowCourse?.courseCode ?? 'NA',
          courseTitle: rowCourse?.title ?? 'Untitled course',
          sectionCode: rowOffering?.sectionCode ?? null,
          riskBand: row.riskBand,
          riskProbScaled: row.riskProbScaled,
          queueState: rowReassessment
            ? (isOpenReassessmentStatus(rowReassessment.status) ? 'open' : normalizeFilterValue(rowReassessment.status) === 'resolved' ? 'resolved' : 'watch')
            : null,
          queueCaseId: typeof rowPayload.queueCaseId === 'string' ? rowPayload.queueCaseId : null,
          primaryCase: typeof rowPayload.primaryCase === 'boolean' ? rowPayload.primaryCase : null,
          countsTowardCapacity: typeof rowPayload.countsTowardCapacity === 'boolean' ? rowPayload.countsTowardCapacity : null,
          recommendedAction: row.recommendedAction,
          observedEvidence: {
            attendancePct: Number(rowEvidence.attendancePct ?? 0),
            tt1Pct: Number(rowEvidence.tt1Pct ?? 0),
            tt2Pct: Number(rowEvidence.tt2Pct ?? 0),
            quizPct: Number(rowEvidence.quizPct ?? 0),
            assignmentPct: Number(rowEvidence.assignmentPct ?? 0),
            seePct: Number(rowEvidence.seePct ?? 0),
            cgpa: Number(rowEvidence.cgpa ?? 0),
            backlogCount: Number(rowEvidence.backlogCount ?? 0),
            weakCoCount: Number(rowEvidence.weakCoCount ?? 0),
            weakQuestionCount: Number((rowEvidence.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
            coEvidenceMode: typeof rowEvidence.coEvidenceMode === 'string' ? rowEvidence.coEvidenceMode : null,
            interventionRecoveryStatus: rowEvidence.interventionResponse && typeof rowEvidence.interventionResponse === 'object'
              ? String((rowEvidence.interventionResponse as Record<string, unknown>).recoveryConfirmed ? 'confirmed' : 'watch')
              : null,
          },
          drivers: parseJson(row.driversJson, [] as unknown[]),
        }
      })
      return {
        studentId,
        studentName: student?.name ?? studentId,
        usn: student?.usn ?? '',
        sectionCode: offering?.sectionCode ?? distinctStudentSectionById.get(studentId) ?? 'NA',
        currentSemester,
        currentRiskBand: primaryRisk.riskBand,
        currentRiskProbScaled: primaryRisk.riskProbScaled,
        currentQueueState: primaryReassessment
          ? (isOpenReassessmentStatus(primaryReassessment.status) ? 'open' : normalizeFilterValue(primaryReassessment.status) === 'resolved' ? 'resolved' : 'watch')
          : null,
        currentRecoveryState: proofRecoveryStateFromResolutionRow(primaryResolution),
        queueCaseId: typeof primaryReassessmentPayload.queueCaseId === 'string' ? primaryReassessmentPayload.queueCaseId : null,
        countsTowardCapacity: typeof primaryReassessmentPayload.countsTowardCapacity === 'boolean' ? primaryReassessmentPayload.countsTowardCapacity : null,
        governanceReason: typeof primaryReassessmentPayload.governanceReason === 'string' ? primaryReassessmentPayload.governanceReason : null,
        supportingCourseCount: Number.isFinite(Number(primaryReassessmentPayload.supportingCourseCount)) ? Number(primaryReassessmentPayload.supportingCourseCount) : 0,
        assignedFacultyId: primaryReassessment?.assignedFacultyId ?? (typeof primaryReassessmentPayload.assignedFacultyId === 'string' ? primaryReassessmentPayload.assignedFacultyId : null),
        primaryCourseCode: course?.courseCode ?? 'NA',
        primaryCourseTitle: course?.title ?? 'Untitled course',
        currentReassessmentStatus: primaryReassessment?.status ?? relevantReassessments.find(row => isOpenReassessmentStatus(row.status))?.status ?? relevantReassessments[0]?.status ?? null,
        nextDueAt,
        observedEvidence: {
          attendancePct: Number(primaryEvidence.attendancePct ?? 0),
          tt1Pct: Number(primaryEvidence.tt1Pct ?? 0),
          tt2Pct: Number(primaryEvidence.tt2Pct ?? 0),
          quizPct: Number(primaryEvidence.quizPct ?? 0),
          assignmentPct: Number(primaryEvidence.assignmentPct ?? 0),
          seePct: Number(primaryEvidence.seePct ?? 0),
          cgpa: Number(primaryEvidence.cgpa ?? 0),
          backlogCount: Number(primaryEvidence.backlogCount ?? latestTranscriptByStudent.get(studentId)?.backlogCount ?? 0),
          weakCoCount: Number(primaryEvidence.weakCoCount ?? 0),
          weakQuestionCount: Number((primaryEvidence.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
          coEvidenceMode: typeof primaryEvidence.coEvidenceMode === 'string' ? primaryEvidence.coEvidenceMode : null,
          interventionRecoveryStatus: primaryEvidence.interventionResponse && typeof primaryEvidence.interventionResponse === 'object'
            ? String((primaryEvidence.interventionResponse as Record<string, unknown>).recoveryConfirmed ? 'confirmed' : 'watch')
            : null,
        },
        electiveFit: electiveFit ? {
          recommendedCode: electiveFit.recommendedCode,
          recommendedTitle: electiveFit.recommendedTitle,
          stream: electiveFit.stream,
          rationale: parseJson(electiveFit.rationaleJson, [] as string[]),
          alternatives: parseJson(electiveFit.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
        } : null,
        courseSnapshots,
        evidenceTimeline,
      }
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((left, right) => (right.currentRiskProbScaled - left.currentRiskProbScaled) || left.studentName.localeCompare(right.studentName))

  const facultyFilterIds = input.filters?.facultyId ? new Set([input.filters.facultyId]) : null
  const reassessments = activeReassessments
    .map(row => {
      const risk = activeRiskRows.find(item => item.riskAssessmentId === row.riskAssessmentId)
      if (!risk) return null
      const offering = sectionOfferingRows.find(item => item.offeringId === risk.offeringId) ?? null
      const course = offering ? courseById.get(offering.courseId) : null
      const student = studentById.get(row.studentId)
      const alert = activeAlerts.find(item => item.riskAssessmentId === row.riskAssessmentId) ?? null
      const acknowledgement = alert ? activeAcknowledgements.filter(item => item.alertDecisionId === alert.alertDecisionId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null : null
      const resolution = activeResolutions.filter(item => item.reassessmentEventId === row.reassessmentEventId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      if (!matchesTextFilter(risk.riskBand, input.filters?.riskBand)) return null
      if (!matchesTextFilter(student?.studentId ?? null, input.filters?.studentId)) return null
      if (!matchesTextFilter(course?.courseCode ?? null, input.filters?.courseCode)) return null
      if (!matchesTextFilter(offering?.sectionCode ?? null, input.filters?.section)) return null
      if (facultyFilterIds && facultyFilterIds.size > 0) {
        const facultyId = [...facultyFilterIds][0]
        const relevantOfferingIds = new Set(activeOwnershipRows.filter(item => item.facultyId === facultyId).map(item => item.offeringId))
        const relevantStudentIds = new Set(activeMentorAssignments.filter(item => item.facultyId === facultyId).map(item => item.studentId))
        if (!relevantOfferingIds.has(risk.offeringId) && !relevantStudentIds.has(row.studentId)) return null
      }
      const payload = parseJson(row.payloadJson, {} as Record<string, unknown>)
      return {
        reassessmentEventId: row.reassessmentEventId,
        simulationRunId: activeRun.simulationRunId,
        runLabel: activeRun.runLabel,
        studentId: row.studentId,
        studentName: student?.name ?? row.studentId,
        usn: student?.usn ?? '',
        courseCode: course?.courseCode ?? 'NA',
        courseTitle: course?.title ?? 'Untitled course',
        sectionCode: offering?.sectionCode ?? null,
        assignedToRole: row.assignedToRole,
        assignedFacultyId: row.assignedFacultyId ?? (typeof payload.assignedFacultyId === 'string' ? payload.assignedFacultyId : null),
        dueAt: row.dueAt,
        status: row.status,
        riskBand: risk.riskBand,
        riskProbScaled: risk.riskProbScaled,
        decisionType: alert?.decisionType ?? null,
        decisionNote: alert?.note ?? null,
        queueCaseId: typeof payload.queueCaseId === 'string' ? payload.queueCaseId : null,
        primaryCase: typeof payload.primaryCase === 'boolean' ? payload.primaryCase : true,
        countsTowardCapacity: typeof payload.countsTowardCapacity === 'boolean' ? payload.countsTowardCapacity : true,
        priorityRank: Number.isFinite(Number(payload.priorityRank)) ? Number(payload.priorityRank) : null,
        governanceReason: typeof payload.governanceReason === 'string' ? payload.governanceReason : null,
        supportingCourseCount: Number.isFinite(Number(payload.supportingCourseCount))
          ? Number(payload.supportingCourseCount)
          : Array.isArray(payload.supportingRiskAssessmentIds)
            ? payload.supportingRiskAssessmentIds.length
            : 0,
        recoveryState: proofRecoveryStateFromResolutionRow(resolution),
        observedResidual: Number.isFinite(Number(proofResolutionPayloadFromRow(resolution).observedResidual))
          ? Number(proofResolutionPayloadFromRow(resolution).observedResidual)
          : null,
        acknowledgement: acknowledgement ? {
          acknowledgedByFacultyId: acknowledgement.acknowledgedByFacultyId,
          status: acknowledgement.status,
          note: acknowledgement.note,
          createdAt: acknowledgement.createdAt,
        } : null,
        resolution: resolution ? {
          resolvedByFacultyId: resolution.resolvedByFacultyId,
          resolutionStatus: resolution.resolutionStatus,
          note: resolution.note,
          createdAt: resolution.createdAt,
        } : null,
      }
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || right.riskProbScaled - left.riskProbScaled)

  const sectionComparison = uniqueSorted(filteredObservedRows.map(row => row.sectionCode))
    .map(sectionCode => {
      const sectionRiskRows = activeRiskRows.filter(row => {
        const offering = sectionOfferingRows.find(item => item.offeringId === row.offeringId)
        return offering?.sectionCode === sectionCode
      })
      const sectionObserved = filteredObservedRows.filter(row => row.sectionCode === sectionCode)
      const sectionRiskIds = new Set(sectionRiskRows.map(row => row.riskAssessmentId))
      return {
        sectionCode,
        studentCount: new Set(sectionObserved.map(row => row.studentId)).size,
        highRiskCount: sectionRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'high').length,
        mediumRiskCount: sectionRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'medium').length,
        averageAttendancePct: roundToOne(average(sectionObserved.map(row => Number(parseObservedStateRow(row).attendancePct ?? 0)).filter(Number.isFinite))),
        openReassessmentCount: activeReassessments.filter(row => sectionRiskIds.has(row.riskAssessmentId) && isOpenReassessmentStatus(row.status)).length,
      }
    })

  const scopedStudentIds = studentWatchRows.length > 0
    ? new Set(studentWatchRows.map(row => row.studentId))
    : distinctStudentIds
  const semesterRiskDistribution = termRows
    .filter(row => row.batchId === activeBatch.batchId && row.semesterNumber <= currentSemester)
    .sort((left, right) => left.semesterNumber - right.semesterNumber)
    .map(term => {
      const termTranscripts = transcriptRows
        .filter(row => row.termId === term.termId)
        .filter(row => scopedStudentIds.has(row.studentId))
      const highPressureCount = termTranscripts.filter(row => row.backlogCount >= 2).length
      const reviewCount = termTranscripts.filter(row => row.backlogCount === 1).length
      const stableCount = termTranscripts.filter(row => row.backlogCount === 0).length
      return {
        semesterNumber: term.semesterNumber,
        highPressureCount,
        reviewCount,
        stableCount,
        basis: 'transcript-backlog',
      }
    })

  const latestBacklogRows = Array.from(latestTranscriptByStudent.values()).filter(row => scopedStudentIds.has(row.studentId))
  const backlogDistribution = ['0', '1', '2', '3+'].map(bucket => ({
    bucket,
    studentCount: latestBacklogRows.filter(row => bucketBacklogCount(row.backlogCount) === bucket).length,
  }))

  const electiveDistribution = Array.from(new Map(
    electiveRows
      .filter(row => row.simulationRunId === activeRunId)
      .filter(row => scopedStudentIds.has(row.studentId))
      .map(row => [row.stream, {
        stream: row.stream,
        recommendationCount: electiveRows.filter(item => item.simulationRunId === activeRunId && item.stream === row.stream && scopedStudentIds.has(item.studentId)).length,
      }]),
  ).values()).sort((left, right) => right.recommendationCount - left.recommendationCount || left.stream.localeCompare(right.stream))

  const monitoringSummary = {
    riskAssessmentCount: activeRiskRows.length,
    activeReassessmentCount: activeReassessments.filter(row => isOpenReassessmentStatus(row.status)).length,
    alertDecisionCount: activeAlerts.length,
    acknowledgementCount: activeAcknowledgements.length,
    resolutionCount: activeResolutions.length,
  }
  const countProvenance = buildProofCountProvenance({
    activeOperationalSemester: activeRun.activeOperationalSemester ?? activeBatch.currentSemester,
    batchId: activeBatch.batchId,
    batchLabel: activeBatch.batchLabel,
    branchName: activeBranch.name,
    sectionCode: input.filters?.section ?? null,
    simulationRunId: activeRun.simulationRunId,
    runLabel: activeRun.runLabel,
  })

  return {
    summary: {
      activeRunContext,
      ...countProvenance,
      scope: {
        departmentNames: uniqueSorted(Array.from(scopeDepartmentIds).map(departmentId => departmentById.get(departmentId)?.name ?? departmentId)),
        branchNames: uniqueSorted(Array.from(scopeBranchIds).map(branchId => branchById.get(branchId)?.name ?? branchId)),
      },
      monitoringSummary,
      totals: {
        studentsCovered: scopedStudentIds.size,
        highRiskCount: activeRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'high').length,
        mediumRiskCount: activeRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'medium').length,
        averageQueueAgeHours: roundToOne(average(activeReassessments.filter(row => isOpenReassessmentStatus(row.status)).map(row => hoursBetween(row.createdAt, input.now ?? new Date().toISOString())))),
        manualOverrideCount: activeOverrides.length,
        unresolvedAlertCount: activeAlerts.filter(row => !activeAcknowledgements.some(ack => ack.alertDecisionId === row.alertDecisionId)).length,
        resolvedAlertCount: activeResolutions.length,
      },
      sectionComparison,
      semesterRiskDistribution,
      backlogDistribution,
      electiveDistribution,
      facultyLoadSummary: {
        facultyCount: facultyRowsForHod.length,
        overloadedFacultyCount: facultyRowsForHod.filter(row => row.overloadFlag).length,
        averageWeeklyContactHours: roundToOne(average(facultyRowsForHod.map(row => row.weeklyContactHours))),
      },
    },
    courses: courseRollups,
    faculty: facultyRowsForHod,
    students: studentWatchRows,
    reassessments,
  }
}
