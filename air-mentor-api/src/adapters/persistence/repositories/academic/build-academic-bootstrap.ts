/**
 * buildAcademicBootstrap — the academic workspace bootstrap read model.
 *
 * This is intentionally a SINGLE large function moved VERBATIM from
 * modules/academic.ts. It reads ~30 tables into in-memory join maps and projects
 * the faculty/student/offering/task/calendar/proof state consumed by the
 * academic UI. It resists decomposition: splitting its body risks changing
 * N+1/join semantics that academic-parity.test.ts locks, so it is relocated
 * whole. Its line count exceeds the 400-line architecture cap by design — a
 * ratchet exception is expected for this file only.
 *
 * Pure computation/projection helpers are imported from the application layer;
 * db-row mappers, runtime-state, and the proof-workflow task builder are
 * imported from sibling persistence modules. Only the import header and the
 * `export` keyword differ from the original.
 */
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { RouteContext } from '../../../../app.js'
import {
  academicCalendarAuditEvents,
  academicMeetings,
  academicTaskPlacements,
  academicTaskTransitions,
  academicTasks,
  academicTerms,
  branches,
  courseOutcomeOverrides,
  courses,
  departments,
  electiveRecommendations,
  facultyAppointments,
  facultyCalendarAdminWorkspaces,
  facultyCalendarCanonicalTemplates,
  facultyCalendarWorkspaces,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  offeringAssessmentSchemes,
  offeringQuestionPapers,
  riskAssessments,
  roleGrants,
  sectionOfferings,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  studentAcademicProfiles,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentEnrollments,
  studentInterventions,
  studentObservedSemesterStates,
  students,
  transcriptSubjectResults,
  transcriptTermResults,
  userAccounts,
} from '../../../../db/schema.js'
import { parseJson } from '../../../../lib/json.js'
import {
  parseObservedStateRow,
  readObservedNullableNumber,
  readObservedStateNumber,
  selectObservedRowsThroughCheckpoint,
} from '../../../../lib/proof-observed-state.js'
import {
  isTeacherVisibleActiveProofRunCandidate,
  pickMostRecentActiveRun,
} from '../../../../lib/proof-active-run.js'
import { getProofRiskModelActive } from '../../../../adapters/simulation/msruas-proof-control-plane.js'
import {
  buildGraphAwarePrerequisiteSummary,
  buildMissingGraphAwarePrerequisiteSummary,
} from '../../../../lib/graph-summary.js'
import { DEFAULT_STAGE_POLICY, type StagePolicyPayload } from '../../../../lib/stage-policy.js'
import {
  pickAuthoritativeFirstList,
  pickAuthoritativeFirstRecord,
} from '../../../../modules/academic-authoritative-first.js'
import {
  DEFAULT_POLICY,
  resolveBatchCurriculumFeatures,
  resolveBatchPolicy,
  resolveBatchStagePolicy,
  type ResolvedPolicy,
} from '../../../../modules/admin-structure.js'
import {
  courseOutcomeSchema,
  facultyCalendarAdminWorkspaceSchema,
  runtimeStateKeys,
  schemeStateSchema,
  termTestBlueprintSchema,
  type AcademicInterventionEntry,
} from '../../../../application/use-cases/academic/academic-contracts.js'
import {
  coAttainmentRowSchema,
  calendarAuditEventSchema,
  facultyCalendarTemplateSchema,
  queueTransitionSchema,
  sharedTaskSchema,
  taskPlacementSchema,
  type CourseHistoryRecord,
} from '../../../../application/use-cases/academic/academic-task-contracts.js'
import {
  averageNullable,
  buildInitials,
  courseFamilyForCode,
  dedupeRoles,
  isoDatePart,
  normalizeAcademicStudentId,
  normalizeCourseCode,
  resolveAuthoritativeStageOrder,
  roundToTwo,
  toUiRole,
} from '../../../../application/use-cases/academic/academic-utils.js'
import {
  buildDefaultQuestionPaper,
  buildDefaultSchemeFromPolicy,
  canonicalizeSchemeState,
} from '../../../../application/use-cases/academic/academic-scheme.js'
import {
  buildAcademicObservableSourceRefs,
  buildProfessorProjection,
  buildStudentReasons,
  buildStudentWhatIf,
  computeRiskFromActiveModelOrPolicy,
  filterAssessmentMapForStage,
  normalizePlaybackDriverRows,
  normalizePlaybackRiskBand,
  toPlaybackReasonRows,
} from '../../../../application/use-cases/academic/academic-risk.js'
import {
  computeStudentOutcomeAttainment,
  computeTranscriptAnalytics,
  filterAssessmentCellsForStage,
  pctsFromAssessmentCells,
  rawTotalFromAssessmentCells,
  resolveCourseOutcomesForOffering,
} from './academic-attainment.js'
import {
  buildStudentHistoryRecord,
  inferMenteeFallback,
  inferStudentFallback,
  mapOfferingRow,
  type AcademicMenteeProjection,
  type AcademicOfferingProjection,
  type AcademicStudentProjection,
  type PlaybackObservedStudentSummary,
  type PlaybackStudentCheckpointOverlay,
} from './academic-projections.js'
import {
  buildProofWorkflowTaskFromQueueProjection,
  proofPlaybackCurrentDateISO,
} from './academic-proof-workflow-task.js'
import { getAcademicRuntimeState } from './academic-runtime-state.js'
import {
  mapAcademicMeetingRow,
  mapAcademicTaskRow,
  mapCalendarAuditEventRow,
  mapFacultyCalendarAdminWorkspaceRow,
  mapFacultyCalendarCanonicalTemplateRow,
  mapFacultyCalendarWorkspaceRow,
  mapTaskPlacementRow,
  mapTaskTransitionRow,
} from './academic-row-mappers.js'

export async function buildAcademicBootstrap(
  context: RouteContext,
  viewer: {
    facultyId?: string | null
    roleCode?: string | null
    simulationStageCheckpointId?: string | null
    demoWorkspaceId?: string | null
  } = {},
) {
  const runtimeEntries = await Promise.all(runtimeStateKeys.map(async stateKey => {
    return [stateKey, await getAcademicRuntimeState(context, stateKey)] as const
  }))
  const runtime = Object.fromEntries(runtimeEntries)

  const [
    courseRows,
    termRows,
    branchRows,
    departmentRows,
    offeringRows,
    ownershipRows,
    facultyRows,
    appointmentRows,
    userRows,
    roleGrantRows,
    studentRows,
    profileRows,
    enrollmentRows,
    mentorRows,
    attendanceRows,
    assessmentRows,
    interventionRows,
    transcriptTermRows,
    transcriptSubjectRows,
    courseOutcomeOverrideRows,
    schemeRows,
    questionPaperRows,
    _riskAssessmentRows,
    electiveRecommendationRows,
    academicTaskRows,
    academicTaskTransitionRows,
    academicTaskPlacementRows,
    facultyCalendarWorkspaceRows,
    facultyCalendarCanonicalTemplateRows,
    facultyCalendarAdminWorkspaceRows,
    academicCalendarAuditRows,
    academicMeetingRows,
    runRows,
    stageCheckpointRow,
    stageOfferingProjectionRows,
    stageQueueProjectionRows,
    stageStudentProjectionRows,
  ] = await Promise.all([
    context.db.select().from(courses).orderBy(asc(courses.courseCode)),
    context.db.select().from(academicTerms),
    context.db.select().from(branches),
    context.db.select().from(departments),
    context.db.select().from(sectionOfferings).where(eq(sectionOfferings.status, 'active')).orderBy(asc(sectionOfferings.offeringId)),
    context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    context.db.select().from(facultyProfiles).where(eq(facultyProfiles.status, 'active')).orderBy(asc(facultyProfiles.facultyId)),
    context.db.select().from(facultyAppointments).where(eq(facultyAppointments.status, 'active')).orderBy(asc(facultyAppointments.facultyId)),
    context.db.select().from(userAccounts),
    context.db.select().from(roleGrants).where(eq(roleGrants.status, 'active')),
    context.db.select().from(students).where(eq(students.status, 'active')).orderBy(asc(students.usn)),
    context.db.select().from(studentAcademicProfiles),
    context.db.select().from(studentEnrollments).where(eq(studentEnrollments.academicStatus, 'active')).orderBy(asc(studentEnrollments.termId), asc(studentEnrollments.sectionCode), asc(studentEnrollments.rosterOrder), asc(studentEnrollments.studentId)),
    context.db.select().from(mentorAssignments),
    context.db.select().from(studentAttendanceSnapshots),
    context.db.select().from(studentAssessmentScores),
    context.db.select().from(studentInterventions),
    context.db.select().from(transcriptTermResults),
    context.db.select().from(transcriptSubjectResults),
    context.db.select().from(courseOutcomeOverrides).where(eq(courseOutcomeOverrides.status, 'active')),
    context.db.select().from(offeringAssessmentSchemes).where(eq(offeringAssessmentSchemes.status, 'active')),
    context.db.select().from(offeringQuestionPapers),
    context.db.select().from(riskAssessments),
    context.db.select().from(electiveRecommendations),
    context.db.select().from(academicTasks).orderBy(asc(academicTasks.createdAt)),
    context.db.select().from(academicTaskTransitions).orderBy(asc(academicTaskTransitions.occurredAt)),
    context.db.select().from(academicTaskPlacements),
    context.db.select().from(facultyCalendarWorkspaces),
    context.db.select().from(facultyCalendarCanonicalTemplates),
    context.db.select().from(facultyCalendarAdminWorkspaces),
    context.db.select().from(academicCalendarAuditEvents).orderBy(asc(academicCalendarAuditEvents.createdAt)),
    context.db.select().from(academicMeetings).orderBy(asc(academicMeetings.dateIso), asc(academicMeetings.startMinutes)),
    context.db.select().from(simulationRuns),
    viewer.simulationStageCheckpointId
      ? context.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationStageCheckpointId, viewer.simulationStageCheckpointId)).then(rows => rows[0] ?? null)
      : Promise.resolve(null),
    viewer.simulationStageCheckpointId
      ? context.db.select().from(simulationStageOfferingProjections).where(eq(simulationStageOfferingProjections.simulationStageCheckpointId, viewer.simulationStageCheckpointId))
      : Promise.resolve([]),
    viewer.simulationStageCheckpointId
      ? context.db.select().from(simulationStageQueueProjections).where(eq(simulationStageQueueProjections.simulationStageCheckpointId, viewer.simulationStageCheckpointId))
      : Promise.resolve([]),
    viewer.simulationStageCheckpointId
      ? context.db.select().from(simulationStageStudentProjections).where(eq(simulationStageStudentProjections.simulationStageCheckpointId, viewer.simulationStageCheckpointId))
      : Promise.resolve([]),
  ])

  const demoWorkspaceId = viewer.demoWorkspaceId ?? null
  const matchesDemoWorkspace = (row: { demoWorkspaceId?: string | null }) => (row.demoWorkspaceId ?? null) === demoWorkspaceId
  const workspaceRunRows = runRows.filter(matchesDemoWorkspace)
  const workspaceOfferingRows = offeringRows.filter(matchesDemoWorkspace)
  const workspaceOwnershipRows = ownershipRows.filter(matchesDemoWorkspace)
  const workspaceStudentRows = studentRows.filter(matchesDemoWorkspace)
  const workspaceEnrollmentRows = enrollmentRows.filter(matchesDemoWorkspace)
  const workspaceMentorRows = mentorRows.filter(matchesDemoWorkspace)

  const courseById = Object.fromEntries(courseRows.map(row => [row.courseId, row]))
  const termById = Object.fromEntries(termRows.map(row => [row.termId, row]))
  const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))
  const departmentById = Object.fromEntries(departmentRows.map(row => [row.departmentId, row]))
  const offeringRowById = Object.fromEntries(offeringRows.map(row => [row.offeringId, row]))
  const userById = Object.fromEntries(userRows.map(row => [row.userId, row]))
  const activeRunRows = workspaceRunRows.filter(isTeacherVisibleActiveProofRunCandidate)
  const selectedActiveRun = pickMostRecentActiveRun(activeRunRows)
  const proofScopeRun = stageCheckpointRow
    ? (workspaceRunRows.find(row => row.simulationRunId === stageCheckpointRow.simulationRunId) ?? null)
    : selectedActiveRun
  const proofCurrentDateISO = proofPlaybackCurrentDateISO({
    checkpoint: stageCheckpointRow,
    run: proofScopeRun,
  })
  const proofBatchIds = Array.from(new Set([proofScopeRun?.batchId ?? null].filter((value): value is string => !!value)))
  const proofSemesterNumber = stageCheckpointRow?.semesterNumber ?? proofScopeRun?.activeOperationalSemester ?? null
  const proofScopeActive = proofBatchIds.length > 0
  const proofCurrentDateOnly = isoDatePart(proofCurrentDateISO)
  const termVisibleInProofScope = (termId: string | null) => {
    if (!termId) return false
    if (!proofScopeActive || proofSemesterNumber == null) return true
    const term = termById[termId]
    const batchId = term?.batchId ?? null
    if (!term || !batchId || !proofBatchIds.includes(batchId)) return false
    return term.semesterNumber <= proofSemesterNumber
  }
  const eventVisibleInProofScope = (input: {
    studentId: string
    offeringId?: string | null
    occurredAt: string
  }) => {
    if (!proofScopeActive) return true
    if (!scopedStudentIds.has(input.studentId)) return false
    if (input.offeringId && !scopedOfferingIds.has(input.offeringId)) return false
    const occurredDate = isoDatePart(input.occurredAt)
    if (proofCurrentDateOnly && occurredDate && occurredDate > proofCurrentDateOnly) return false
    return true
  }
  const scopedTermIds = new Set(
    termRows
      .filter(row => !proofScopeActive || (!!row.batchId && proofBatchIds.includes(row.batchId)))
      .filter(row => proofSemesterNumber == null || row.semesterNumber === proofSemesterNumber)
      .map(row => row.termId),
  )
  const scopedOfferingRows = proofScopeActive
    ? workspaceOfferingRows.filter(row => scopedTermIds.has(row.termId))
    : workspaceOfferingRows
  const scopedOfferingIds = new Set(scopedOfferingRows.map(row => row.offeringId))
  const scopedEnrollmentRows = proofScopeActive
    ? workspaceEnrollmentRows.filter(row => scopedTermIds.has(row.termId))
    : workspaceEnrollmentRows
  const scopedStudentIds = new Set(scopedEnrollmentRows.map(row => row.studentId))
  const scopedStudentRows = proofScopeActive
    ? workspaceStudentRows.filter(row => scopedStudentIds.has(row.studentId))
    : workspaceStudentRows
  const scopedOwnershipRows = proofScopeActive
    ? workspaceOwnershipRows.filter(row => scopedOfferingIds.has(row.offeringId))
    : workspaceOwnershipRows
  const scopedMentorRows = proofScopeActive
    ? workspaceMentorRows.filter(row => scopedStudentIds.has(row.studentId))
    : workspaceMentorRows
  const scopedBranchIds = new Set(scopedOfferingRows.map(row => row.branchId))
  const scopedDepartmentIds = new Set(
    Array.from(scopedBranchIds)
      .map(branchId => branchById[branchId]?.departmentId ?? null)
      .filter((value): value is string => !!value),
  )
  const studentById = Object.fromEntries(scopedStudentRows.map(row => [row.studentId, row]))
  const studentAcademicProfileById = Object.fromEntries(profileRows.map(row => [row.studentId, row]))
  const playbackObservedStateRows = stageCheckpointRow
    ? await context.db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, stageCheckpointRow.simulationRunId))
    : []
  const playbackObservedSummaryByStudentId = new Map<string, PlaybackObservedStudentSummary>()
  if (stageCheckpointRow) {
    selectObservedRowsThroughCheckpoint(playbackObservedStateRows, stageCheckpointRow)
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.createdAt.localeCompare(right.createdAt))
      .forEach(row => {
        const payload = parseObservedStateRow(row)
        const existing = playbackObservedSummaryByStudentId.get(row.studentId) ?? { currentCgpa: null, backlogCount: null }
        playbackObservedSummaryByStudentId.set(row.studentId, {
          currentCgpa: readObservedStateNumber(payload, 'cgpa', 'cgpaAfterSemester') ?? existing.currentCgpa,
          backlogCount: readObservedStateNumber(payload, 'backlogCount') ?? existing.backlogCount,
        })
      })
  }
  const playbackStudentOverlayByOfferingStudent = new Map<string, PlaybackStudentCheckpointOverlay>()
  for (const row of stageStudentProjectionRows) {
    if (!row.offeringId) continue
    const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
    const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
    const currentStatus = (payload.currentStatus ?? {}) as Record<string, unknown>
    const governance = (payload.governance ?? {}) as Record<string, unknown>
    const riskChangeFromPreviousCheckpointScaled = readObservedNullableNumber(currentStatus.riskChangeFromPreviousCheckpointScaled)
      ?? readObservedNullableNumber(payload.riskChangeFromPreviousCheckpointScaled)
    const counterfactualLiftScaled = readObservedNullableNumber(currentStatus.counterfactualLiftScaled)
      ?? readObservedNullableNumber(payload.counterfactualLiftScaled)
    playbackStudentOverlayByOfferingStudent.set(`${row.offeringId}::${row.studentId}`, {
      simulationStageCheckpointId: row.simulationStageCheckpointId,
      riskProbScaled: row.riskProbScaled,
      riskBand: normalizePlaybackRiskBand(row.riskBand),
      queueState: row.queueState ?? (typeof currentStatus.queueState === 'string' ? currentStatus.queueState : null),
      reassessmentState: row.reassessmentState ?? (typeof currentStatus.reassessmentState === 'string' ? currentStatus.reassessmentState : null),
      recommendedAction: row.recommendedAction ?? (typeof currentStatus.recommendedAction === 'string' ? currentStatus.recommendedAction : null),
      primaryCase: governance.primaryCase === true,
      countsTowardCapacity: governance.countsTowardCapacity === true,
      priorityRank: Number.isFinite(Number(governance.priorityRank)) ? Number(governance.priorityRank) : null,
      riskChangeFromPreviousCheckpointScaled,
      counterfactualLiftScaled,
      attentionAreas: Array.isArray(currentStatus.attentionAreas)
        ? currentStatus.attentionAreas.filter((value): value is string => typeof value === 'string').slice(0, 4)
        : [],
      observableDrivers: normalizePlaybackDriverRows(currentStatus.observableDrivers),
      attendancePct: readObservedNullableNumber(currentEvidence.attendancePct),
      tt1Pct: readObservedNullableNumber(currentEvidence.tt1Pct),
      tt2Pct: readObservedNullableNumber(currentEvidence.tt2Pct),
      quizPct: readObservedNullableNumber(currentEvidence.quizPct),
      assignmentPct: readObservedNullableNumber(currentEvidence.assignmentPct),
      seePct: readObservedNullableNumber(currentEvidence.seePct),
    })
  }
  const activeEnrollmentByStudentId = new Map<string, typeof studentEnrollments.$inferSelect>()
  const primaryAppointmentByFacultyId = new Map<string, typeof facultyAppointments.$inferSelect>()
  for (const appointment of appointmentRows) {
    const current = primaryAppointmentByFacultyId.get(appointment.facultyId)
    if (!current || appointment.isPrimary === 1) {
      primaryAppointmentByFacultyId.set(appointment.facultyId, appointment)
    }
  }

  const enrollmentsByGroup = new Map<string, Array<typeof studentEnrollments.$inferSelect>>()
  for (const enrollment of scopedEnrollmentRows) {
    const key = `${enrollment.termId}::${enrollment.sectionCode}`
    enrollmentsByGroup.set(key, [...(enrollmentsByGroup.get(key) ?? []), enrollment])
    const current = activeEnrollmentByStudentId.get(enrollment.studentId)
    if (!current || enrollment.startDate > current.startDate) {
      activeEnrollmentByStudentId.set(enrollment.studentId, enrollment)
    }
  }

  const activeMentorAssignmentByStudentId = new Map<string, typeof mentorAssignments.$inferSelect>()
  for (const assignment of scopedMentorRows) {
    if (assignment.effectiveTo) continue
    const existing = activeMentorAssignmentByStudentId.get(assignment.studentId)
    if (!existing || assignment.effectiveFrom > existing.effectiveFrom) {
      activeMentorAssignmentByStudentId.set(assignment.studentId, assignment)
    }
  }

  const latestAttendanceByStudentOffering = new Map<string, typeof studentAttendanceSnapshots.$inferSelect>()
  const attendanceSourcePriority = (source: string) => {
    if (source === 'teacher-workspace') return 2
    if (source.startsWith('proof-run:')) return 1
    return 0
  }
  for (const row of attendanceRows) {
    const key = `${row.studentId}::${row.offeringId}`
    const current = latestAttendanceByStudentOffering.get(key)
    if (
      !current
      || attendanceSourcePriority(row.source) > attendanceSourcePriority(current.source)
      || (
        attendanceSourcePriority(row.source) === attendanceSourcePriority(current.source)
        && (
          row.capturedAt > current.capturedAt
          || (row.capturedAt === current.capturedAt && row.updatedAt > current.updatedAt)
        )
      )
    ) {
      latestAttendanceByStudentOffering.set(key, row)
    }
  }

  const latestAssessmentsByStudentOffering = new Map<string, Record<string, { score: number; maxScore: number; evaluatedAt: string; updatedAt: string }>>()
  const latestAssessmentCellsByStudentOffering = new Map<string, typeof studentAssessmentScores.$inferSelect[]>()
  const latestAssessmentCellByCompositeKey = new Map<string, typeof studentAssessmentScores.$inferSelect>()
  for (const row of assessmentRows) {
    const key = `${row.studentId}::${row.offeringId}`
    const current = latestAssessmentsByStudentOffering.get(key) ?? {}
    const existing = current[row.componentType]
    if (
      !existing
      || row.updatedAt > existing.updatedAt
      || (row.updatedAt === existing.updatedAt && row.evaluatedAt > existing.evaluatedAt)
    ) {
      current[row.componentType] = {
        score: row.score,
        maxScore: row.maxScore,
        evaluatedAt: row.evaluatedAt,
        updatedAt: row.updatedAt,
      }
      latestAssessmentsByStudentOffering.set(key, current)
    }
    const compositeKey = `${row.studentId}::${row.offeringId}::${row.componentType}::${row.componentCode ?? ''}`
    const existingCell = latestAssessmentCellByCompositeKey.get(compositeKey)
    if (
      !existingCell
      || row.updatedAt > existingCell.updatedAt
      || (row.updatedAt === existingCell.updatedAt && row.evaluatedAt > existingCell.evaluatedAt)
    ) {
      latestAssessmentCellByCompositeKey.set(compositeKey, row)
    }
  }

  for (const row of latestAssessmentCellByCompositeKey.values()) {
    const key = `${row.studentId}::${row.offeringId}`
    latestAssessmentCellsByStudentOffering.set(key, [...(latestAssessmentCellsByStudentOffering.get(key) ?? []), row])
  }

  const interventionsByStudentId = new Map<string, AcademicInterventionEntry[]>()
  const interventionsByStudentOffering = new Map<string, AcademicInterventionEntry[]>()
  for (const row of interventionRows) {
    if (!eventVisibleInProofScope({
      studentId: row.studentId,
      offeringId: row.offeringId,
      occurredAt: row.occurredAt,
    })) continue
    const entry = {
      date: row.occurredAt,
      type: row.interventionType,
      note: row.note,
      offeringId: row.offeringId ?? null,
    }
    const current = interventionsByStudentId.get(row.studentId) ?? []
    current.push(entry)
    interventionsByStudentId.set(row.studentId, current)
    if (row.offeringId) {
      const offeringKey = `${row.studentId}::${row.offeringId}`
      interventionsByStudentOffering.set(offeringKey, [
        ...(interventionsByStudentOffering.get(offeringKey) ?? []),
        entry,
      ])
    }
  }
  for (const [studentId, entries] of interventionsByStudentId.entries()) {
    entries.sort((left, right) => right.date.localeCompare(left.date))
    interventionsByStudentId.set(studentId, entries)
  }
  for (const [key, entries] of interventionsByStudentOffering.entries()) {
    entries.sort((left, right) => right.date.localeCompare(left.date))
    interventionsByStudentOffering.set(key, entries)
  }

  const latestElectiveRecommendationByStudentId = new Map<string, typeof electiveRecommendations.$inferSelect>()
  if (!proofScopeActive || (proofSemesterNumber ?? 0) >= 6) {
    for (const row of electiveRecommendationRows) {
      const current = latestElectiveRecommendationByStudentId.get(row.studentId)
      if (!current || row.updatedAt > current.updatedAt) {
        latestElectiveRecommendationByStudentId.set(row.studentId, row)
      }
    }
  }

  const latestTranscriptTermByStudentAndTerm = new Map<string, typeof transcriptTermResults.$inferSelect>()
  for (const row of transcriptTermRows) {
    if (!termVisibleInProofScope(row.termId)) continue
    const key = `${row.studentId}::${row.termId}`
    const current = latestTranscriptTermByStudentAndTerm.get(key)
    if (!current || row.updatedAt > current.updatedAt) {
      latestTranscriptTermByStudentAndTerm.set(key, row)
    }
  }
  const transcriptTermsByStudentId = new Map<string, Array<typeof transcriptTermResults.$inferSelect>>()
  for (const row of latestTranscriptTermByStudentAndTerm.values()) {
    transcriptTermsByStudentId.set(row.studentId, [...(transcriptTermsByStudentId.get(row.studentId) ?? []), row])
  }
  const transcriptSubjectsByTermResultId = new Map<string, Array<typeof transcriptSubjectResults.$inferSelect>>()
  for (const row of transcriptSubjectRows) {
    transcriptSubjectsByTermResultId.set(row.transcriptTermResultId, [...(transcriptSubjectsByTermResultId.get(row.transcriptTermResultId) ?? []), row])
  }
  const visibleTranscriptTermResultById = new Map(
    Array.from(latestTranscriptTermByStudentAndTerm.values()).map(row => [row.transcriptTermResultId, row] as const),
  )
  const latestVisibleTranscriptSubjectByStudentCourseCode = new Map<string, (typeof transcriptSubjectRows)[number]>()
  for (const row of transcriptSubjectRows) {
    const termResult = visibleTranscriptTermResultById.get(row.transcriptTermResultId)
    if (!termResult) continue
    const key = `${termResult.studentId}::${normalizeCourseCode(row.courseCode)}`
    const current = latestVisibleTranscriptSubjectByStudentCourseCode.get(key)
    if (!current || row.updatedAt > current.updatedAt) {
      latestVisibleTranscriptSubjectByStudentCourseCode.set(key, row)
    }
  }
  const transcriptSubjectHistoryByStudentCourseCode = new Map<string, CourseHistoryRecord>()
  for (const row of latestVisibleTranscriptSubjectByStudentCourseCode.values()) {
    const termResult = visibleTranscriptTermResultById.get(row.transcriptTermResultId)
    if (!termResult) continue
    const term = termById[termResult.termId]
    transcriptSubjectHistoryByStudentCourseCode.set(`${termResult.studentId}::${normalizeCourseCode(row.courseCode)}`, {
      courseCode: normalizeCourseCode(row.courseCode),
      semesterNumber: term?.semesterNumber ?? 0,
      score: row.score,
      result: row.result === 'PASS' ? 'Passed' : row.result === 'FAIL' ? 'Failed' : row.result,
    })
  }

  const resolvedPolicyByBatchId = new Map<string, ResolvedPolicy>()
  const resolvedStagePolicyByBatchId = new Map<string, StagePolicyPayload>()
  const batchIds = Array.from(new Set(termRows.map(row => row.batchId).filter((value): value is string => !!value)))
  const [resolvedPolicies, resolvedStagePolicies] = await Promise.all([
    Promise.all(batchIds.map(async batchId => {
      const resolved = await resolveBatchPolicy(context, batchId)
      return [batchId, resolved.effectivePolicy] as const
    })),
    Promise.all(batchIds.map(async batchId => {
      const resolved = await resolveBatchStagePolicy(context, batchId)
      return [batchId, resolved.effectivePolicy] as const
    })),
  ])
  for (const [batchId, policy] of resolvedPolicies) {
    resolvedPolicyByBatchId.set(batchId, policy)
  }
  for (const [batchId, policy] of resolvedStagePolicies) {
    resolvedStagePolicyByBatchId.set(batchId, policy)
  }
  const activeRiskModelByBatchId = new Map<string, Awaited<ReturnType<typeof getProofRiskModelActive>>['production'] | null>()
  const activeModelRows = await Promise.all(batchIds.map(async batchId => {
    const activeModel = await getProofRiskModelActive(context.db, { batchId })
    return [batchId, activeModel.production ?? null] as const
  }))
  for (const [batchId, activeModel] of activeModelRows) {
    activeRiskModelByBatchId.set(batchId, activeModel)
  }

  const resolvedCurriculumFeaturesByBatchId = new Map<string, Awaited<ReturnType<typeof resolveBatchCurriculumFeatures>>>()
  const resolvedCurriculumFeatureRows = await Promise.all(batchIds.map(async batchId => {
    const resolved = await resolveBatchCurriculumFeatures(context, batchId)
    return [batchId, resolved] as const
  }))
  for (const [batchId, resolved] of resolvedCurriculumFeatureRows) {
    resolvedCurriculumFeaturesByBatchId.set(batchId, resolved)
  }

  const curriculumGraphByBatchId = new Map<string, {
    prerequisiteGraphByGraphKey: Map<string, string[]>
    downstreamGraphByGraphKey: Map<string, string[]>
  }>()
  for (const [batchId, resolved] of resolvedCurriculumFeaturesByBatchId.entries()) {
    const prerequisiteGraphByGraphKey = new Map<string, string[]>()
    const downstreamGraphByGraphKey = new Map<string, string[]>()
    for (const item of resolved.items) {
      const graphKey = normalizeCourseCode(item.courseCode)
      const prerequisiteCodes = Array.from(new Set(item.resolvedConfig.prerequisites
        .map(prerequisite => normalizeCourseCode(prerequisite.sourceCourseCode))
        .filter(code => code.length > 0)))
      prerequisiteGraphByGraphKey.set(graphKey, prerequisiteCodes)
      for (const prerequisiteCode of prerequisiteCodes) {
        downstreamGraphByGraphKey.set(prerequisiteCode, Array.from(new Set([
          ...(downstreamGraphByGraphKey.get(prerequisiteCode) ?? []),
          graphKey,
        ])))
      }
    }
    curriculumGraphByBatchId.set(batchId, {
      prerequisiteGraphByGraphKey,
      downstreamGraphByGraphKey,
    })
  }

  const studentTranscriptAnalyticsByStudentId = new Map<string, ReturnType<typeof computeTranscriptAnalytics>>()
  for (const student of scopedStudentRows) {
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const term = enrollment ? termById[enrollment.termId] : undefined
    const profile = studentAcademicProfileById[student.studentId]
    const fallbackCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    const policy = (term?.batchId ? resolvedPolicyByBatchId.get(term.batchId) : null) ?? DEFAULT_POLICY
    studentTranscriptAnalyticsByStudentId.set(student.studentId, computeTranscriptAnalytics({
      termRows: transcriptTermsByStudentId.get(student.studentId) ?? [],
      termById,
      subjectsByTermResultId: transcriptSubjectsByTermResultId,
      policy,
      fallbackCgpa,
    }))
  }

  const courseOutcomeOverridesByCourseId = new Map<string, Array<typeof courseOutcomeOverrides.$inferSelect>>()
  for (const row of courseOutcomeOverrideRows) {
    courseOutcomeOverridesByCourseId.set(row.courseId, [...(courseOutcomeOverridesByCourseId.get(row.courseId) ?? []), row])
  }

  const rawSchemeByOfferingId = new Map<string, z.infer<typeof schemeStateSchema>>()
  for (const row of schemeRows) {
    const parsed = schemeStateSchema.safeParse(parseJson(row.schemeJson, {}))
    if (parsed.success) rawSchemeByOfferingId.set(row.offeringId, parsed.data)
  }

  const questionPapersByOfferingId = new Map<string, Partial<Record<'tt1' | 'tt2', z.infer<typeof termTestBlueprintSchema>>>>()
  for (const row of questionPaperRows) {
    if (row.kind !== 'tt1' && row.kind !== 'tt2') continue
    const parsed = termTestBlueprintSchema.safeParse(parseJson(row.blueprintJson, {}))
    if (!parsed.success) continue
    questionPapersByOfferingId.set(row.offeringId, {
      ...(questionPapersByOfferingId.get(row.offeringId) ?? {}),
      [row.kind]: parsed.data,
    })
  }

  const taskTransitionsByTaskId = new Map<string, z.infer<typeof queueTransitionSchema>[]>()
  for (const row of academicTaskTransitionRows) {
    taskTransitionsByTaskId.set(row.taskId, [...(taskTransitionsByTaskId.get(row.taskId) ?? []), mapTaskTransitionRow(row)])
  }

  const proofWorkflowTasks = stageQueueProjectionRows
    .map(row => buildProofWorkflowTaskFromQueueProjection({
      queueProjection: row,
      studentById,
      offeringById: offeringRowById,
      anchorDateISO: proofCurrentDateISO,
    }))
    .filter((task): task is z.infer<typeof sharedTaskSchema> => !!task)
  const authoritativeTasksById = new Map(
    academicTaskRows.map(row => {
      const task = mapAcademicTaskRow(row, taskTransitionsByTaskId.get(row.taskId) ?? [])
      return [task.id, task] as const
    }),
  )
  proofWorkflowTasks.forEach(task => {
    if (!authoritativeTasksById.has(task.id)) {
      authoritativeTasksById.set(task.id, task)
    }
  })
  const authoritativeTasks = Array.from(authoritativeTasksById.values())

  const authoritativePlacementsByTaskId = new Map<string, z.infer<typeof taskPlacementSchema>>()
  for (const row of academicTaskPlacementRows) {
    authoritativePlacementsByTaskId.set(row.taskId, mapTaskPlacementRow(row))
  }

  const facultyCalendarTemplateByFacultyId = new Map<string, z.infer<typeof facultyCalendarTemplateSchema>>()
  for (const row of facultyCalendarWorkspaceRows) {
    const parsed = mapFacultyCalendarWorkspaceRow(row)
    if (parsed) facultyCalendarTemplateByFacultyId.set(row.facultyId, parsed)
  }
  for (const row of facultyCalendarCanonicalTemplateRows) {
    if (facultyCalendarTemplateByFacultyId.has(row.facultyId)) continue
    const parsed = mapFacultyCalendarCanonicalTemplateRow(row)
    if (parsed) facultyCalendarTemplateByFacultyId.set(row.facultyId, parsed)
  }

  const facultyCalendarAdminWorkspaceByFacultyId = new Map<string, z.infer<typeof facultyCalendarAdminWorkspaceSchema>>()
  for (const row of facultyCalendarAdminWorkspaceRows) {
    const parsed = mapFacultyCalendarAdminWorkspaceRow(row)
    if (parsed) facultyCalendarAdminWorkspaceByFacultyId.set(row.facultyId, parsed)
  }

  const calendarAuditByFacultyId = new Map<string, z.infer<typeof calendarAuditEventSchema>[]>()
  for (const row of academicCalendarAuditRows) {
    const parsed = mapCalendarAuditEventRow(row)
    if (!parsed) continue
    calendarAuditByFacultyId.set(row.facultyId, [...(calendarAuditByFacultyId.get(row.facultyId) ?? []), parsed])
  }

  const academicOfferings: AcademicOfferingProjection[] = scopedOfferingRows.map(offeringRow => {
    const course = courseById[offeringRow.courseId]
    const term = termById[offeringRow.termId]
    const branch = branchById[offeringRow.branchId]
    const department = branch ? departmentById[branch.departmentId] : undefined
    const stagePolicy = term.batchId ? resolvedStagePolicyByBatchId.get(term.batchId) : undefined
    const enrollmentKey = `${offeringRow.termId}::${offeringRow.sectionCode}`
    const sectionEnrollments = enrollmentsByGroup.get(enrollmentKey) ?? []
    return mapOfferingRow({
      offering: offeringRow,
      course,
      term,
      department,
      stagePolicy,
      computedCount: sectionEnrollments.length,
    })
  })

  const resolvedPolicyByOfferingId = new Map<string, ResolvedPolicy>()
  const resolvedCourseOutcomesByOfferingId = new Map<string, Array<z.infer<typeof courseOutcomeSchema>>>()
  const resolvedSchemesByOfferingId = new Map<string, z.infer<typeof schemeStateSchema>>()
  const resolvedQuestionPapersByOfferingId = new Map<string, Record<'tt1' | 'tt2', z.infer<typeof termTestBlueprintSchema>>>()

  for (const offeringRow of scopedOfferingRows) {
    const term = termById[offeringRow.termId]
    const branch = branchById[offeringRow.branchId]
    const department = branch ? departmentById[branch.departmentId] : null
    const course = courseById[offeringRow.courseId]
    const policy = (term?.batchId ? resolvedPolicyByBatchId.get(term.batchId) : null) ?? DEFAULT_POLICY
    resolvedPolicyByOfferingId.set(offeringRow.offeringId, policy)
    const outcomes = resolveCourseOutcomesForOffering({
      institutionId: department?.institutionId ?? 'institution',
      branchId: offeringRow.branchId,
      batchId: term?.batchId ?? null,
      offeringId: offeringRow.offeringId,
      courseId: offeringRow.courseId,
      courseCode: course?.courseCode ?? 'COURSE',
      courseTitle: course?.title ?? 'Course',
      overrides: courseOutcomeOverridesByCourseId.get(offeringRow.courseId) ?? [],
    })
    resolvedCourseOutcomesByOfferingId.set(offeringRow.offeringId, outcomes)
    resolvedSchemesByOfferingId.set(
      offeringRow.offeringId,
      rawSchemeByOfferingId.has(offeringRow.offeringId)
        ? canonicalizeSchemeState(rawSchemeByOfferingId.get(offeringRow.offeringId)!, policy)
        : buildDefaultSchemeFromPolicy(policy),
    )
    resolvedQuestionPapersByOfferingId.set(
      offeringRow.offeringId,
      {
        tt1: questionPapersByOfferingId.get(offeringRow.offeringId)?.tt1 ?? buildDefaultQuestionPaper('tt1', outcomes),
        tt2: questionPapersByOfferingId.get(offeringRow.offeringId)?.tt2 ?? buildDefaultQuestionPaper('tt2', outcomes),
      },
    )
  }

  const authoritativeMeetings = academicMeetingRows.map(row => {
    const offering = row.offeringId ? (offeringRowById[row.offeringId] ?? null) : null
    const course = offering ? (courseById[offering.courseId] ?? null) : null
    return mapAcademicMeetingRow({
      row,
      student: studentById[row.studentId] ?? null,
      offering,
      course,
    })
  })
  const meetingEntriesByStudentId = new Map<string, AcademicInterventionEntry[]>()
  const meetingEntriesByStudentOffering = new Map<string, AcademicInterventionEntry[]>()
  for (const meeting of authoritativeMeetings) {
    if (!eventVisibleInProofScope({
      studentId: meeting.studentId,
      offeringId: meeting.offeringId ?? null,
      occurredAt: meeting.dateISO,
    })) continue
    const label = meeting.status === 'cancelled'
      ? 'Meeting Cancelled'
      : meeting.status === 'completed'
        ? 'Meeting'
        : 'Scheduled Meeting'
    const note = meeting.courseCode
      ? `${meeting.title} · ${meeting.courseCode}${meeting.notes ? ` · ${meeting.notes}` : ''}`
      : `${meeting.title}${meeting.notes ? ` · ${meeting.notes}` : ''}`
    const entry = {
      date: meeting.dateISO,
      type: label,
      note,
      offeringId: meeting.offeringId ?? null,
    }
    meetingEntriesByStudentId.set(meeting.studentId, [
      ...(meetingEntriesByStudentId.get(meeting.studentId) ?? []),
      entry,
    ])
    if (meeting.offeringId) {
      const offeringKey = `${meeting.studentId}::${meeting.offeringId}`
      meetingEntriesByStudentOffering.set(offeringKey, [
        ...(meetingEntriesByStudentOffering.get(offeringKey) ?? []),
        entry,
      ])
    }
  }

  const studentsByOffering = Object.fromEntries(academicOfferings.map(offering => {
    const offeringRow = offeringRowById[offering.offId]
    const sectionEnrollments = offeringRow
      ? (enrollmentsByGroup.get(`${offeringRow.termId}::${offering.section}`) ?? [])
      : []
    const nextStudents = sectionEnrollments.map(enrollment => {
      const student = studentById[enrollment.studentId]
      if (!student) return null
      const profile = studentAcademicProfileById[enrollment.studentId]
      const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
      const runtimeKey = `${student.studentId}::${offering.offId}`
      const attendanceSnapshot = latestAttendanceByStudentOffering.get(runtimeKey)
      const attendancePct = attendanceSnapshot && attendanceSnapshot.totalClasses > 0
        ? Math.round((attendanceSnapshot.presentClasses / attendanceSnapshot.totalClasses) * 100)
        : offering.attendance
      const transcriptAnalytics = studentTranscriptAnalyticsByStudentId.get(student.studentId) ?? computeTranscriptAnalytics({
        termRows: transcriptTermsByStudentId.get(student.studentId) ?? [],
        termById,
        subjectsByTermResultId: transcriptSubjectsByTermResultId,
        policy: resolvedPolicyByOfferingId.get(offering.offId) ?? DEFAULT_POLICY,
        fallbackCgpa: prevCgpa,
      })
      const policy = resolvedPolicyByOfferingId.get(offering.offId) ?? DEFAULT_POLICY
      const questionPapers = resolvedQuestionPapersByOfferingId.get(offering.offId) ?? {
        tt1: buildDefaultQuestionPaper('tt1', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []),
        tt2: buildDefaultQuestionPaper('tt2', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []),
      }
      const batchIdForOffering = offeringRow ? (termById[offeringRow.termId]?.batchId ?? null) : null
      const stagePolicy = batchIdForOffering ? resolvedStagePolicyByBatchId.get(batchIdForOffering) : undefined
      const authoritativeStageKey = stageCheckpointRow?.stageKey ?? proofScopeRun?.activeStageKey ?? null
      const authoritativeStageOrder = stageCheckpointRow?.stageOrder
        ?? resolveAuthoritativeStageOrder(stagePolicy, authoritativeStageKey)
        ?? offering.stage
      const authoritativeSemesterProgress = Math.max(
        0.25,
        Math.min(1, authoritativeStageOrder / (stagePolicy?.stages.length ?? DEFAULT_STAGE_POLICY.stages.length)),
      )
      const assessmentStageKey = proofScopeActive ? authoritativeStageKey : null
      const assessmentMap = filterAssessmentMapForStage(
        latestAssessmentsByStudentOffering.get(runtimeKey) ?? {},
        assessmentStageKey,
      )
      const assessmentCells = filterAssessmentCellsForStage(
        latestAssessmentCellsByStudentOffering.get(runtimeKey) ?? [],
        assessmentStageKey,
      )
      const tt1Raw = assessmentMap.tt1?.score ?? null
      const tt2Raw = assessmentMap.tt2?.score ?? null
      const tt1Max = Math.max(1, assessmentMap.tt1?.maxScore ?? questionPapers.tt1.totalMarks)
      const tt2Max = Math.max(1, assessmentMap.tt2?.maxScore ?? questionPapers.tt2.totalMarks)
      const tt1Pct = tt1Raw !== null ? roundToTwo((tt1Raw / tt1Max) * 100) : null
      const tt2Pct = tt2Raw !== null ? roundToTwo((tt2Raw / tt2Max) * 100) : null
      const quizPcts = pctsFromAssessmentCells(assessmentCells, ['quiz*'])
      const assignmentPcts = pctsFromAssessmentCells(assessmentCells, ['asgn*'])
      const quizPct = quizPcts.length > 0 ? roundToTwo(quizPcts.reduce((sum, value) => sum + value, 0) / quizPcts.length) : null
      const assignmentPct = assignmentPcts.length > 0 ? roundToTwo(assignmentPcts.reduce((sum, value) => sum + value, 0) / assignmentPcts.length) : null
      const seeRaw = assessmentMap.see?.score ?? null
      const seeMax = assessmentMap.see?.maxScore ?? null
      const seePct = seeRaw !== null && seeMax && seeMax > 0 ? roundToTwo((seeRaw / seeMax) * 100) : null
      const cePctValues = [tt1Pct, tt2Pct, quizPct, assignmentPct]
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      const cePct = cePctValues.length > 0
        ? roundToTwo(cePctValues.reduce((sum, value) => sum + value, 0) / cePctValues.length)
        : null
      const playbackOverlay = playbackStudentOverlayByOfferingStudent.get(`${offering.offId}::${student.studentId}`)
      const outcomeBreakdown = computeStudentOutcomeAttainment({
        outcomes: resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? [],
        tt1Blueprint: questionPapers.tt1,
        tt2Blueprint: questionPapers.tt2,
        assessmentCells,
        scheme: resolvedSchemesByOfferingId.get(offering.offId) ?? buildDefaultSchemeFromPolicy(policy),
        proofEvidence: {
          tt1Pct: playbackOverlay?.tt1Pct ?? null,
          tt2Pct: playbackOverlay?.tt2Pct ?? null,
          quizPct: playbackOverlay?.quizPct ?? null,
          assignmentPct: playbackOverlay?.assignmentPct ?? null,
        },
      })
      const evidencedOutcomeBreakdown = outcomeBreakdown.filter(item => item.hasEvidence)
      const transcriptRows = transcriptTermsByStudentId.get(student.studentId) ?? []
      const hasTranscriptHistory = transcriptRows.length > 0
      const cgpaMissing = !hasTranscriptHistory && prevCgpa <= 0
      const backlogMissing = !hasTranscriptHistory
      const authoritativeCurrentCgpa = hasTranscriptHistory
        ? transcriptAnalytics.currentCgpa
        : prevCgpa > 0
          ? prevCgpa
          : 0
      const authoritativeBacklogCount = hasTranscriptHistory ? transcriptAnalytics.latestBacklogCount : 0
      const overallPct = cePct !== null && seePct !== null
        ? roundToTwo(((cePct / 100) * policy.passRules.ceMaximum) + ((seePct / 100) * policy.passRules.seeMaximum))
        : null
      const batchGraph = batchIdForOffering ? curriculumGraphByBatchId.get(batchIdForOffering) ?? null : null
      const resolvedCurriculumFeatureBundle = batchIdForOffering ? (resolvedCurriculumFeaturesByBatchId.get(batchIdForOffering) ?? null) : null
      const weakCourseOutcomeCodes = outcomeBreakdown
        .filter(item => item.hasEvidence && item.overallAttainment < 45)
        .map(item => item.coId)
      const prerequisiteSource = {
        courseCode: normalizeCourseCode(offering.code),
        semesterNumber: offering.sem,
        score: averageNullable(outcomeBreakdown.map(item => item.overallAttainment)) ?? 0,
        result: 'Ongoing',
      }
      const prerequisiteSummary = batchGraph
        ? buildGraphAwarePrerequisiteSummary({
            source: prerequisiteSource,
            sourceGraphKey: prerequisiteSource.courseCode,
            historicalSourceKeyForGraphKey: graphKey => `${student.studentId}::${normalizeCourseCode(graphKey)}`,
            sourceByHistoricalKey: transcriptSubjectHistoryByStudentCourseCode,
            prerequisiteGraphByGraphKey: batchGraph.prerequisiteGraphByGraphKey,
            downstreamGraphByGraphKey: batchGraph.downstreamGraphByGraphKey,
            graphAvailable: true,
            curriculumImportVersionId: resolvedCurriculumFeatureBundle?.curriculumImportVersion?.curriculumImportVersionId ?? null,
            curriculumFeatureProfileFingerprint: resolvedCurriculumFeatureBundle?.curriculumFeatureProfileFingerprint ?? null,
            getSemesterNumber: source => source.semesterNumber,
            getFinalMark: source => source.score,
            getResult: source => source.result,
            getCourseCode: source => source.courseCode,
            getCourseFamily: courseFamilyForCode,
          })
        : buildMissingGraphAwarePrerequisiteSummary({
            graphAvailable: false,
            historyAvailable: false,
            curriculumImportVersionId: resolvedCurriculumFeatureBundle?.curriculumImportVersion?.curriculumImportVersionId ?? null,
            curriculumFeatureProfileFingerprint: resolvedCurriculumFeatureBundle?.curriculumFeatureProfileFingerprint ?? null,
          })
      const liveSourceRefs = buildAcademicObservableSourceRefs({
        simulationRunId: proofScopeRun?.simulationRunId ?? null,
        simulationStageCheckpointId: stageCheckpointRow?.simulationStageCheckpointId ?? null,
        studentId: student.studentId,
        offeringId: offering.offId,
        semesterNumber: offering.sem,
        sectionCode: offering.section,
        courseCode: offering.code,
        courseTitle: offering.title,
        stageKey: authoritativeStageKey,
        prerequisiteSummary,
        weakCourseOutcomeCodes,
      })
      const risk = computeRiskFromActiveModelOrPolicy({
        attendancePct,
        currentCgpa: authoritativeCurrentCgpa,
        cgpaMissing,
        backlogCount: authoritativeBacklogCount,
        backlogMissing,
        tt1Pct,
        tt2Pct,
        quizPct,
        assignmentPct,
        cePct,
        seePct,
        overallPct,
        weakCoCount: weakCourseOutcomeCodes.length,
        policy,
        activeModel: batchIdForOffering ? (activeRiskModelByBatchId.get(batchIdForOffering) ?? null) : null,
        semesterProgress: authoritativeSemesterProgress,
        prerequisiteSummary,
        sourceRefs: liveSourceRefs,
        // Gate the operational urgency overlay behind the proof-scope
        // signal. Real institutional offerings (no proof run owning the
        // batch) keep calibrated banding semantics.
        applyDemoOperationalBanding: proofScopeActive,
      })
      const quizRawTotal = rawTotalFromAssessmentCells(assessmentCells, ['quiz*'])
      const reasons = risk.riskProb >= 0.35
        ? buildStudentReasons({
            attendancePct,
            tt1Raw,
            tt1Max,
            tt2Raw,
            tt2Max,
            currentCgpa: authoritativeCurrentCgpa,
            quizRawTotal,
            coScores: evidencedOutcomeBreakdown.map(item => ({ coId: item.coId, overallAttainment: item.overallAttainment })),
          })
        : []
      const whatIf = risk.riskProb >= 0.35
        ? buildStudentWhatIf({
            riskProb: risk.riskProb,
            attendancePct,
            coScores: evidencedOutcomeBreakdown.map(item => ({ coId: item.coId, overallAttainment: item.overallAttainment })),
          })
        : []
      const mergedInterventions = [
        ...(interventionsByStudentOffering.get(`${student.studentId}::${offering.offId}`) ?? []),
        ...(meetingEntriesByStudentOffering.get(`${student.studentId}::${offering.offId}`) ?? []),
      ].sort((left, right) => right.date.localeCompare(left.date))
      const baseProjection = inferStudentFallback({
        offering,
        student,
        prevCgpa,
        currentCgpa: authoritativeCurrentCgpa,
        attendanceSnapshot: attendanceSnapshot
          ? {
              presentClasses: attendanceSnapshot.presentClasses,
              totalClasses: attendanceSnapshot.totalClasses,
            }
          : undefined,
        assessments: assessmentMap,
        assessmentCells,
        interventions: mergedInterventions,
        risk,
        reasons,
        coScores: evidencedOutcomeBreakdown.map(item => ({ coId: item.coId, attainment: item.overallAttainment })),
        whatIf,
        flags: {
          backlog: authoritativeBacklogCount > 0,
          lowAttendance: attendancePct < 75,
          declining: transcriptAnalytics.trend === 'Declining',
        },
      })
      if (!playbackOverlay) return baseProjection
      const observedSummary = playbackObservedSummaryByStudentId.get(student.studentId)
      return {
        ...baseProjection,
        currentCgpa: observedSummary?.currentCgpa ?? baseProjection.currentCgpa,
        riskProb: playbackOverlay.riskProbScaled / 100,
        riskBand: playbackOverlay.riskBand,
        riskCompleteness: null,
        featureCompleteness: null,
        featureProvenance: null,
        reasons: toPlaybackReasonRows(
          playbackOverlay.attentionAreas,
          playbackOverlay.recommendedAction,
          playbackOverlay.observableDrivers,
        ),
        whatIf: [],
        flags: {
          ...baseProjection.flags,
          backlog: observedSummary?.backlogCount != null
            ? observedSummary.backlogCount > 0
            : baseProjection.flags.backlog,
          lowAttendance: playbackOverlay.attendancePct != null
            ? playbackOverlay.attendancePct < 75
            : baseProjection.flags.lowAttendance,
        },
        proofSource: 'stage-checkpoint',
        proofSimulationStageCheckpointId: playbackOverlay.simulationStageCheckpointId,
        proofRecommendedAction: playbackOverlay.recommendedAction,
        proofQueueState: playbackOverlay.queueState,
        proofReassessmentState: playbackOverlay.reassessmentState,
        proofRiskProbScaled: playbackOverlay.riskProbScaled,
        proofRiskChangeFromPreviousCheckpointScaled: playbackOverlay.riskChangeFromPreviousCheckpointScaled,
        proofCounterfactualLiftScaled: playbackOverlay.counterfactualLiftScaled,
        proofAttentionAreas: playbackOverlay.attentionAreas,
        proofObservedAttendancePct: playbackOverlay.attendancePct,
        proofObservedTt1Pct: playbackOverlay.tt1Pct,
        proofObservedTt2Pct: playbackOverlay.tt2Pct,
        proofObservedQuizPct: playbackOverlay.quizPct,
        proofObservedAssignmentPct: playbackOverlay.assignmentPct,
        proofObservedSeePct: playbackOverlay.seePct,
      } satisfies AcademicStudentProjection
    }).filter((student): student is AcademicStudentProjection => !!student)
    return [offering.offId, nextStudents]
  })) as Record<string, AcademicStudentProjection[]>

  const coAttainmentByOffering = Object.fromEntries(academicOfferings.map(offering => {
    const students = studentsByOffering[offering.offId] ?? []
    const outcomes = resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []
    const questionPapers = resolvedQuestionPapersByOfferingId.get(offering.offId) ?? {
      tt1: buildDefaultQuestionPaper('tt1', outcomes),
      tt2: buildDefaultQuestionPaper('tt2', outcomes),
    }
    const rows = outcomes.map(outcome => {
      const studentBreakdowns = students.map(student => {
        const studentId = normalizeAcademicStudentId(student.id)
        const assessmentCells = latestAssessmentCellsByStudentOffering.get(`${studentId}::${offering.offId}`) ?? []
        return computeStudentOutcomeAttainment({
          outcomes: [outcome],
          tt1Blueprint: questionPapers.tt1,
          tt2Blueprint: questionPapers.tt2,
          assessmentCells,
          scheme: resolvedSchemesByOfferingId.get(offering.offId) ?? buildDefaultSchemeFromPolicy(resolvedPolicyByOfferingId.get(offering.offId) ?? DEFAULT_POLICY),
          proofEvidence: {
            tt1Pct: readObservedNullableNumber(student.proofObservedTt1Pct),
            tt2Pct: readObservedNullableNumber(student.proofObservedTt2Pct),
            quizPct: readObservedNullableNumber(student.proofObservedQuizPct),
            assignmentPct: readObservedNullableNumber(student.proofObservedAssignmentPct),
          },
        })[0]
      })
      return coAttainmentRowSchema.parse({
        coId: outcome.id,
        desc: outcome.desc,
        bloom: outcome.bloom,
        target: 60,
        tt1Attainment: averageNullable(studentBreakdowns.map(item => item.tt1Attainment)),
        tt2Attainment: averageNullable(studentBreakdowns.map(item => item.tt2Attainment)),
        overallAttainment: averageNullable(studentBreakdowns.map(item => item.overallAttainment)),
        studentsCounted: studentBreakdowns.filter(item => item.hasEvidence).length,
      })
    })
    return [offering.offId, rows]
  })) as Record<string, Array<z.infer<typeof coAttainmentRowSchema>>>

  const studentHistoryByUsn = Object.fromEntries(scopedStudentRows.map(student => {
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const term = enrollment ? termById[enrollment.termId] : undefined
    const branch = enrollment ? branchById[enrollment.branchId] : undefined
    const department = branch ? departmentById[branch.departmentId] : undefined
    const profile = studentAcademicProfileById[student.studentId]
    const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    const transcriptAnalytics = studentTranscriptAnalyticsByStudentId.get(student.studentId) ?? computeTranscriptAnalytics({
      termRows: transcriptTermsByStudentId.get(student.studentId) ?? [],
      termById,
      subjectsByTermResultId: transcriptSubjectsByTermResultId,
      policy: (term?.batchId ? resolvedPolicyByBatchId.get(term.batchId) : null) ?? DEFAULT_POLICY,
      fallbackCgpa: prevCgpa,
    })
    const transcriptTerms = (transcriptTermsByStudentId.get(student.studentId) ?? [])
      .sort((left, right) => {
        const leftTerm = termById[left.termId]
        const rightTerm = termById[right.termId]
        if (!leftTerm || !rightTerm) return left.termId.localeCompare(right.termId)
        return leftTerm.semesterNumber - rightTerm.semesterNumber
      })
      .map(termResult => {
        const termInfo = termById[termResult.termId]
        const subjects = (transcriptSubjectsByTermResultId.get(termResult.transcriptTermResultId) ?? []).map(subject => ({
          code: subject.courseCode,
          title: subject.title,
          credits: subject.credits,
          score: subject.score,
          gradeLabel: subject.gradeLabel,
          gradePoint: subject.gradePoint,
          result: subject.result,
        }))
        return {
          termId: termResult.termId,
          label: termInfo ? `Semester ${termInfo.semesterNumber}` : termResult.termId,
          semesterNumber: termInfo?.semesterNumber ?? 0,
          academicYear: termInfo?.academicYearLabel ?? '',
          sgpa: termResult.sgpaScaled / 100,
          registeredCredits: termResult.registeredCredits,
          earnedCredits: termResult.earnedCredits,
          backlogCount: termResult.backlogCount,
          subjects,
        }
      })
    return [student.usn, buildStudentHistoryRecord({
      student,
      enrollment,
      term,
      branch,
      department,
      prevCgpa,
      currentCgpa: transcriptAnalytics.currentCgpa,
      completedCreditsForCgpa: transcriptAnalytics.completedCreditsForCgpa,
      activeBacklogCredits: transcriptAnalytics.activeBacklogCredits,
      repeatSubjects: transcriptAnalytics.repeatSubjects,
      progressionStatus: transcriptAnalytics.progressionStatus,
      trend: transcriptAnalytics.trend,
      latestBacklogCount: transcriptAnalytics.latestBacklogCount,
      electiveRecommendation: (() => {
        const recommendation = latestElectiveRecommendationByStudentId.get(student.studentId)
        if (!recommendation) return null
        const rationale = parseJson(recommendation.rationaleJson, { summary: '' as string })
        const alternatives = parseJson(recommendation.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>)
        return {
          recommendedCode: recommendation.recommendedCode,
          recommendedTitle: recommendation.recommendedTitle,
          stream: recommendation.stream,
          rationale: rationale.summary ?? '',
          alternatives,
        }
      })(),
      transcriptTerms,
    })]
  }))

  const mentees = scopedStudentRows.flatMap(student => {
    const mentorAssignment = activeMentorAssignmentByStudentId.get(student.studentId)
    if (!mentorAssignment) return []
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const branch = enrollment ? branchById[enrollment.branchId] : undefined
    const department = branch ? departmentById[branch.departmentId] : undefined
    const term = enrollment ? termById[enrollment.termId] : undefined
    const offering = academicOfferings.find(item => item.section === (enrollment?.sectionCode ?? '') && item.sem === term?.semesterNumber)
    const profile = studentAcademicProfileById[student.studentId]
    const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    const interventions = [
      ...(interventionsByStudentId.get(student.studentId) ?? []),
      ...(meetingEntriesByStudentId.get(student.studentId) ?? []),
    ].sort((left, right) => right.date.localeCompare(left.date))
    const courseRisks = enrollment
      ? academicOfferings
          .filter(item => item.termId === enrollment.termId && item.section === enrollment.sectionCode)
          .map(item => {
            const matchingProjection = studentsByOffering[item.offId]
              ?.find(candidate => normalizeAcademicStudentId(candidate.id) === student.studentId || candidate.usn === student.usn)
            const playbackOverlay = playbackStudentOverlayByOfferingStudent.get(`${item.offId}::${student.studentId}`)
            return {
              code: item.code,
              title: item.title,
              risk: matchingProjection?.riskProb ?? -1,
              band: matchingProjection?.riskBand ?? 'Low' as const,
              stage: item.stage,
              queueState: playbackOverlay?.queueState ?? null,
              recommendedAction: playbackOverlay?.recommendedAction ?? null,
              primaryCase: playbackOverlay?.primaryCase ?? false,
              countsTowardCapacity: playbackOverlay?.countsTowardCapacity ?? false,
              priorityRank: playbackOverlay?.priorityRank ?? null,
            }
          })
      : []
    const activeCourseRisks = courseRisks.filter(item => item.risk >= 0)
    const avs = activeCourseRisks.length > 0
      ? roundToTwo(activeCourseRisks.reduce((sum, item) => sum + item.risk, 0) / activeCourseRisks.length)
      : -1
    const primaryCourseRisk = activeCourseRisks
      .slice()
      .sort((left, right) => {
        if ((left.primaryCase ?? false) !== (right.primaryCase ?? false)) return Number(right.primaryCase === true) - Number(left.primaryCase === true)
        if ((left.countsTowardCapacity ?? false) !== (right.countsTowardCapacity ?? false)) return Number(right.countsTowardCapacity === true) - Number(left.countsTowardCapacity === true)
        const leftRank = left.priorityRank ?? Number.MAX_SAFE_INTEGER
        const rightRank = right.priorityRank ?? Number.MAX_SAFE_INTEGER
        if (leftRank !== rightRank) return leftRank - rightRank
        return right.risk - left.risk || left.code.localeCompare(right.code)
      })[0] ?? null
    return [inferMenteeFallback({
      student,
      enrollment,
      deptCode: department?.code ?? 'GEN',
      yearLabel: offering?.year ?? `Semester ${term?.semesterNumber ?? 1}`,
      prevCgpa,
      avs,
      primaryRiskProb: primaryCourseRisk?.risk ?? null,
      primaryRiskBand: primaryCourseRisk?.band ?? null,
      primaryCourseCode: primaryCourseRisk?.code ?? null,
      primaryQueueState: primaryCourseRisk?.queueState ?? null,
      courseRisks,
      interventions,
    })]
  }) as AcademicMenteeProjection[]
  mentees.sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name)
    if (nameOrder !== 0) return nameOrder
    return left.usn.localeCompare(right.usn)
  })

  const menteeByStudentId = new Map<string, string>()
  for (const mentee of mentees) {
    const matchingStudents = scopedStudentRows.filter(student => student.usn === mentee.usn)
    for (const student of matchingStudents) {
      menteeByStudentId.set(student.studentId, mentee.id)
    }
  }

  const offeringCodeById = Object.fromEntries(academicOfferings.map(offering => [offering.offId, offering.code]))
  const offeringIdsByFacultyId = new Map<string, string[]>()
  for (const ownership of scopedOwnershipRows) {
    offeringIdsByFacultyId.set(ownership.facultyId, [...(offeringIdsByFacultyId.get(ownership.facultyId) ?? []), ownership.offeringId])
  }
  const menteeIdsByFacultyId = new Map<string, string[]>()
  for (const assignment of activeMentorAssignmentByStudentId.values()) {
    const menteeId = menteeByStudentId.get(assignment.studentId)
    if (!menteeId) continue
    menteeIdsByFacultyId.set(assignment.facultyId, [...(menteeIdsByFacultyId.get(assignment.facultyId) ?? []), menteeId])
  }
  const grantIntersectsProofScope = (grant: typeof roleGrants.$inferSelect) => {
    if (!proofScopeActive) return true
    if (grant.scopeType === 'institution') return true
    if (grant.scopeType === 'academic-faculty') return grant.scopeId === grant.facultyId
    if (grant.scopeType === 'department') return scopedDepartmentIds.has(grant.scopeId)
    if (grant.scopeType === 'branch') return scopedBranchIds.has(grant.scopeId)
    if (grant.scopeType === 'batch') return proofBatchIds.includes(grant.scopeId)
    if (grant.scopeType === 'offering') return scopedOfferingIds.has(grant.scopeId)
    return true
  }

  const faculty = facultyRows
    .map(row => {
      const user = userById[row.userId]
      const grants = roleGrantRows.filter(grant => grant.facultyId === row.facultyId)
      if (grants.some(grant => grant.roleCode === 'SYSTEM_ADMIN')) return null
      const proofScopedGrants = grants.filter(grantIntersectsProofScope)
      const primaryAppointment = primaryAppointmentByFacultyId.get(row.facultyId)
      const appointmentDepartment = primaryAppointment ? departmentById[primaryAppointment.departmentId] : undefined
      const offeringIds = Array.from(new Set(offeringIdsByFacultyId.get(row.facultyId) ?? []))
      const courseCodes = Array.from(new Set(offeringIds.map(offeringId => offeringCodeById[offeringId]).filter((value): value is string => !!value)))
      const nextMenteeIds = Array.from(new Set(menteeIdsByFacultyId.get(row.facultyId) ?? []))
      nextMenteeIds.sort((left, right) => {
        return left.localeCompare(right)
      })
      const allowedRoles = dedupeRoles(proofScopedGrants.map(grant => grant.roleCode)).filter(roleLabel => {
        if (roleLabel === 'Course Leader') return offeringIds.length > 0
        if (roleLabel === 'Mentor') return nextMenteeIds.length > 0
        if (roleLabel === 'HoD') return proofScopedGrants.some(grant => toUiRole(grant.roleCode) === 'HoD')
        return true
      })
      if (allowedRoles.length === 0) return null
      return {
        facultyId: row.facultyId,
        username: String(user?.username ?? row.facultyId),
        name: String(row.displayName || row.facultyId),
        initials: buildInitials(row.displayName),
        email: String(user?.email ?? `${row.facultyId}@airmentor.local`),
        dept: String(appointmentDepartment?.code ?? 'GEN'),
        roleTitle: String(row.designation || 'Faculty'),
        allowedRoles,
        courseCodes,
        offeringIds,
        menteeIds: nextMenteeIds,
      }
    })
    .filter((value): value is NonNullable<typeof value> => !!value)

  const yearGroups = ['1st Year', '2nd Year', '3rd Year', '4th Year']
    .map(year => ({
      year,
      color: ({ '1st Year': '#f59e0b', '2nd Year': '#6366f1', '3rd Year': '#10b981', '4th Year': '#ec4899' } as Record<string, string>)[year] ?? '#8892a4',
      stageInfo: academicOfferings.find(offering => offering.year === year)?.stageInfo ?? {
        stage: DEFAULT_STAGE_POLICY.stages[0].order,
        label: DEFAULT_STAGE_POLICY.stages[0].label,
        desc: DEFAULT_STAGE_POLICY.stages[0].description,
        color: DEFAULT_STAGE_POLICY.stages[0].color,
      },
      offerings: academicOfferings.filter(offering => offering.year === year),
    }))
    .filter(group => group.offerings.length > 0)

  const teachers = faculty.map(account => {
    const offerings = academicOfferings.filter(offering => account.offeringIds.includes(offering.offId))
    const studentsCount = offerings.reduce((sum, offering) => sum + (studentsByOffering[offering.offId]?.length ?? 0), 0)
    const highRisk = offerings.reduce((sum, offering) => sum + (studentsByOffering[offering.offId] ?? []).filter(student => student.riskBand === 'High').length, 0)
    const avgAtt = offerings.length > 0
      ? Math.round(offerings.reduce((sum, offering) => sum + offering.attendance, 0) / offerings.length)
      : 0
    const completenessChecks = offerings.flatMap(offering => [offering.tt1Locked ? 1 : 0, offering.tt2Locked ? 1 : 0, offering.quizLocked ? 1 : 0, offering.asgnLocked ? 1 : 0, offering.finalsLocked ? 1 : 0])
    const completeness = completenessChecks.length > 0
      ? Math.round((completenessChecks.reduce((sum, value) => sum + value, 0) / completenessChecks.length) * 100)
      : 0
    return {
      id: account.facultyId,
      name: account.name,
      initials: account.initials,
      dept: account.dept,
      role: account.roleTitle,
      roles: account.allowedRoles,
      offerings: offerings.length,
      students: studentsCount,
      highRisk,
      avgAtt,
      completeness,
      pendingTasks: offerings.filter(offering => !!offering.pendingAction).length,
    }
  })

  const subjectRuns = Object.values(academicOfferings.reduce<Record<string, typeof academicOfferings>>((acc, offering) => {
    const key = `${offering.code}::${offering.year}::${offering.sem}`
    acc[key] = [...(acc[key] ?? []), offering]
    return acc
  }, {})).map((grouped, index) => {
    const sample = grouped[0]
    const sectionOfferingIds = grouped.map(item => item.offId)
    const courseLeaderFacultyIds = faculty
      .filter(account => account.allowedRoles.includes('Course Leader') && account.courseCodes.includes(sample.code))
      .map(account => account.facultyId)
    const scheme = resolvedSchemesByOfferingId.get(sample.offId) ?? buildDefaultSchemeFromPolicy(resolvedPolicyByOfferingId.get(sample.offId) ?? DEFAULT_POLICY)
    return {
      subjectRunId: `run-${sample.code}-${sample.year.replace(/\s+/g, '').toLowerCase()}-s${sample.sem}-${index + 1}`,
      code: sample.code,
      title: sample.title,
      year: sample.year,
      dept: sample.dept,
      sem: sample.sem,
      sectionOfferingIds,
      courseLeaderFacultyIds,
      scheme: {
        subjectRunId: `run-${sample.code}-${sample.year.replace(/\s+/g, '').toLowerCase()}-s${sample.sem}-${index + 1}`,
        status: scheme.status,
        finalsMax: scheme.finalsMax,
        quizWeight: scheme.quizWeight,
        assignmentWeight: scheme.assignmentWeight,
        quizCount: scheme.quizCount,
        assignmentCount: scheme.assignmentCount,
      },
    }
  })

  const viewerAccount = viewer.facultyId ? faculty.find(account => account.facultyId === viewer.facultyId) ?? null : null
  const viewerRole = viewer.roleCode ? toUiRole(viewer.roleCode) : null
  let visibleOfferingIds = new Set(academicOfferings.map(offering => offering.offId))
  let visibleFacultyIds = new Set(faculty.map(account => account.facultyId))
  let visibleStudentIds = new Set(scopedStudentRows.map(student => student.studentId))
  const scopedAcademicViewer = viewerRole === 'Course Leader' || viewerRole === 'Mentor' || viewerRole === 'HoD'
  let denyAllScopedRecords = false

  if (scopedAcademicViewer && !viewerAccount) {
    denyAllScopedRecords = true
    visibleOfferingIds = new Set()
    visibleFacultyIds = viewer.facultyId ? new Set([viewer.facultyId]) : new Set()
    visibleStudentIds = new Set()
  } else if (viewerAccount && viewerRole === 'Course Leader') {
    visibleOfferingIds = new Set(viewerAccount.offeringIds)
    visibleFacultyIds = new Set([viewerAccount.facultyId])
    visibleStudentIds = new Set(
      Array.from(visibleOfferingIds).flatMap(offeringId => {
        const studentsForOffering = studentsByOffering[offeringId] ?? []
        return studentsForOffering.map(student => student.id.split('::')[1] ?? student.id)
      }),
    )
  } else if (viewerAccount && viewerRole === 'Mentor') {
    const mentorAssignmentsForViewer = Array.from(activeMentorAssignmentByStudentId.values())
      .filter(assignment => assignment.facultyId === viewerAccount.facultyId)
    visibleOfferingIds = new Set(viewerAccount.offeringIds)
    visibleFacultyIds = new Set([viewerAccount.facultyId])
    visibleStudentIds = new Set(mentorAssignmentsForViewer.map(assignment => assignment.studentId))
  } else if (viewerAccount && viewerRole === 'HoD') {
    const hodAppointments = appointmentRows.filter(row => row.facultyId === viewerAccount.facultyId)
    const hodDepartmentIds = new Set(hodAppointments.map(row => row.departmentId))
    const explicitBranchIds = new Set(hodAppointments.map(row => row.branchId).filter((value): value is string => !!value))
    const hodBranchIds = new Set(
      branchRows
        .filter(row => hodDepartmentIds.has(row.departmentId) || explicitBranchIds.has(row.branchId))
        .map(row => row.branchId),
    )
    const hodTermIds = new Set(termRows.filter(row => hodBranchIds.has(row.branchId)).map(row => row.termId))
    visibleOfferingIds = new Set(scopedOfferingRows.filter(row => hodBranchIds.has(row.branchId) || hodTermIds.has(row.termId)).map(row => row.offeringId))
    visibleStudentIds = new Set(
      scopedEnrollmentRows
        .filter(row => hodBranchIds.has(row.branchId) || hodTermIds.has(row.termId))
        .map(row => row.studentId),
    )
    visibleFacultyIds = new Set(
      appointmentRows
        .filter(row => hodDepartmentIds.has(row.departmentId) || (row.branchId ? hodBranchIds.has(row.branchId) : false))
        .map(row => row.facultyId),
    )
    visibleFacultyIds.add(viewerAccount.facultyId)
  }

  const playbackOfferingOverlayByOfferingId = new Map(
    stageOfferingProjectionRows.map(row => [row.offeringId, row] as const).filter((entry): entry is [string, typeof simulationStageOfferingProjections.$inferSelect] => !!entry[0]),
  )
  const filteredOfferings = academicOfferings
    .filter(offering => visibleOfferingIds.has(offering.offId))
    .map(offering => {
      const playback = playbackOfferingOverlayByOfferingId.get(offering.offId)
      if (!playback) return offering
      return {
        ...offering,
        stage: playback.stage,
        stageInfo: {
          ...offering.stageInfo,
          stage: playback.stage,
          label: playback.stageLabel,
          desc: playback.stageDescription,
        },
        pendingAction: playback.pendingAction,
      }
    })
  const filteredStudentsByOffering = Object.fromEntries(
    Object.entries(studentsByOffering)
      .filter(([offeringId]) => visibleOfferingIds.has(offeringId))
      .map(([offeringId, items]) => [
        offeringId,
        items.filter(student => visibleStudentIds.has(student.id.split('::')[1] ?? student.id)),
      ]),
  )
  const visibleUsns = new Set(scopedStudentRows.filter(student => visibleStudentIds.has(student.studentId)).map(student => student.usn))
  const filteredStudentHistoryByUsn = Object.fromEntries(
    Object.entries(studentHistoryByUsn).filter(([usn]) => visibleUsns.has(usn)),
  )
  const filteredFaculty = faculty.filter(account => visibleFacultyIds.has(account.facultyId))
  const filteredTeachers = teachers.filter(teacher => visibleFacultyIds.has(teacher.id))
  const filteredMentees = mentees.filter(mentee => visibleUsns.has(mentee.usn))
  const filteredYearGroups = yearGroups
    .map(group => ({
      ...group,
      offerings: group.offerings.filter(offering => visibleOfferingIds.has(offering.offId)),
    }))
    .filter(group => group.offerings.length > 0)
  const filteredSubjectRuns = subjectRuns.filter(subjectRun => subjectRun.sectionOfferingIds.some(offeringId => visibleOfferingIds.has(offeringId)))
  const filteredCoAttainmentByOffering = Object.fromEntries(
    Object.entries(coAttainmentByOffering).filter(([offeringId]) => visibleOfferingIds.has(offeringId)),
  )
  const filteredMeetings = authoritativeMeetings.filter(meeting => visibleStudentIds.has(meeting.studentId))

  const authoritativeStudentPatches = Object.fromEntries(
    Array.from(new Set([
      ...Array.from(latestAttendanceByStudentOffering.keys()),
      ...Array.from(latestAssessmentCellsByStudentOffering.keys()),
    ])).map(key => {
      const [studentId, offeringId] = key.split('::')
      const attendance = latestAttendanceByStudentOffering.get(key)
      const assessmentCells = latestAssessmentCellsByStudentOffering.get(key) ?? []
      const patch: Record<string, unknown> = {}
      if (attendance) {
        patch.present = attendance.presentClasses
        patch.totalClasses = attendance.totalClasses
      }
      for (const row of assessmentCells) {
        if (row.componentType === 'tt1_leaf' && row.componentCode) {
          const current = (patch.tt1LeafScores as Record<string, number> | undefined) ?? {}
          patch.tt1LeafScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if (row.componentType === 'tt2_leaf' && row.componentCode) {
          const current = (patch.tt2LeafScores as Record<string, number> | undefined) ?? {}
          patch.tt2LeafScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if (/^quiz\d+$/.test(row.componentType) && row.componentCode) {
          const current = (patch.quizScores as Record<string, number> | undefined) ?? {}
          patch.quizScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if (/^asgn\d+$/.test(row.componentType) && row.componentCode) {
          const current = (patch.assignmentScores as Record<string, number> | undefined) ?? {}
          patch.assignmentScores = { ...current, [row.componentCode]: row.score }
          continue
        }
        if (row.componentType === 'sem_end') {
          patch.seeScore = row.score
        }
      }
      return [`${offeringId}::${studentId}`, patch]
    }),
  )

  const authoritativeLockByOffering = Object.fromEntries(
    filteredOfferings.map(offering => {
      const runtimeLock = ((runtime.lockByOffering as Record<string, Record<string, boolean>>) ?? {})[offering.offId] ?? {}
      return [offering.offId, {
        tt1: !!offering.tt1Locked,
        tt2: !!offering.tt2Locked,
        quiz: !!offering.quizLocked,
        assignment: !!offering.asgnLocked,
        finals: !!offering.finalsLocked,
        attendance: !!runtimeLock.attendance,
      }]
    }),
  )

  const runtimeTasks = ((runtime.tasks as Array<Record<string, unknown>>) ?? [])
    .map(task => sharedTaskSchema.safeParse(task))
    .filter((result): result is { success: true; data: z.infer<typeof sharedTaskSchema> } => result.success)
    .map(result => result.data)

  const sourceTasks = pickAuthoritativeFirstList(authoritativeTasks, runtimeTasks)

  const visibleTasks = sourceTasks.filter(task => {
    if (denyAllScopedRecords) return false
    if (viewerRole && task.assignedTo !== viewerRole) return false
    if (visibleStudentIds.size > 0 && !visibleStudentIds.has(task.studentId)) return false
    if (visibleOfferingIds.size > 0 && !visibleOfferingIds.has(task.offeringId)) return false
    return true
  })
  const visibleTaskIds = new Set(visibleTasks.map(task => task.id))

  const runtimeTaskPlacements = Object.fromEntries(
    Object.entries((runtime.taskPlacements as Record<string, unknown>) ?? {})
      .flatMap(([taskId, placement]) => {
        const parsed = taskPlacementSchema.safeParse(placement)
        return parsed.success ? [[taskId, parsed.data]] : []
      }),
  )

  const resolvedTasksFromAuthoritativeRows = Object.fromEntries(
    visibleTasks
      .filter(task => task.status === 'Resolved')
      .map(task => [task.id, task.updatedAt ?? task.createdAt]),
  )

  const filteredTaskPlacements = pickAuthoritativeFirstRecord({
    authoritativeById: authoritativePlacementsByTaskId,
    runtimeById: runtimeTaskPlacements,
    visibleIds: visibleTaskIds,
    parseRuntimeValue: value => {
      const parsed = taskPlacementSchema.safeParse(value)
      return parsed.success ? parsed.data : null
    },
  })

  const runtimeCalendarAuditEvents = ((runtime.calendarAudit as Array<Record<string, unknown>>) ?? [])
    .map(event => calendarAuditEventSchema.safeParse(event))
    .filter((result): result is { success: true; data: z.infer<typeof calendarAuditEventSchema> } => result.success)
    .map(result => result.data)

  const currentFacultyTemplate = viewerAccount
    ? facultyCalendarTemplateByFacultyId.get(viewerAccount.facultyId)
      ?? facultyCalendarTemplateSchema.safeParse((runtime.timetableByFacultyId as Record<string, unknown>)?.[viewerAccount.facultyId]).data
    : null
  const currentFacultyAuditEvents = viewerAccount
    ? (calendarAuditByFacultyId.get(viewerAccount.facultyId) ?? [])
    : []
  const mergedCalendarAuditEvents = viewerAccount
    ? pickAuthoritativeFirstList(
        currentFacultyAuditEvents,
        runtimeCalendarAuditEvents.filter(event => event.facultyId === viewerAccount.facultyId),
      )
    : []

  const filteredRuntime = {
    ...runtime,
    studentPatches: Object.keys(authoritativeStudentPatches).length > 0
      ? Object.fromEntries(
          Object.entries(authoritativeStudentPatches).filter(([key]) => {
            const [, studentId] = key.split('::')
            return visibleStudentIds.has(studentId)
          }),
        )
      : runtime.studentPatches,
    tasks: visibleTasks,
    resolvedTasks: authoritativeTasks.length > 0
      ? resolvedTasksFromAuthoritativeRows
      : Object.fromEntries(Object.entries(runtime.resolvedTasks as Record<string, number>).filter(([taskId]) => visibleTaskIds.has(taskId))),
    lockByOffering: authoritativeLockByOffering,
    timetableByFacultyId: viewerAccount && currentFacultyTemplate
      ? { [viewerAccount.facultyId]: currentFacultyTemplate }
      : {},
    adminCalendarByFacultyId: viewerAccount
      ? (() => {
          const workspace = facultyCalendarAdminWorkspaceByFacultyId.get(viewerAccount.facultyId)
          if (workspace) return { [viewerAccount.facultyId]: workspace }
          return Object.fromEntries(
            Object.entries(runtime.adminCalendarByFacultyId as Record<string, unknown>).filter(([facultyId]) => facultyId === viewerAccount.facultyId),
          )
        })()
      : {},
    taskPlacements: filteredTaskPlacements,
    calendarAudit: mergedCalendarAuditEvents,
  }

  const professor = buildProfessorProjection({
    faculty: filteredFaculty.length > 0 ? filteredFaculty : faculty,
    facultyId: viewer.facultyId,
    roleCode: viewer.roleCode,
  })

  return {
    professor,
    faculty: filteredFaculty,
    offerings: filteredOfferings,
    yearGroups: filteredYearGroups,
    mentees: filteredMentees,
    teachers: filteredTeachers,
    subjectRuns: filteredSubjectRuns,
    studentsByOffering: filteredStudentsByOffering,
    studentHistoryByUsn: filteredStudentHistoryByUsn,
    runtime: filteredRuntime,
    courseOutcomesByOffering: Object.fromEntries(filteredOfferings.map(offering => [offering.offId, resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []])),
    assessmentSchemesByOffering: Object.fromEntries(filteredOfferings.map(offering => [offering.offId, resolvedSchemesByOfferingId.get(offering.offId) ?? buildDefaultSchemeFromPolicy(resolvedPolicyByOfferingId.get(offering.offId) ?? DEFAULT_POLICY)])),
    questionPapersByOffering: Object.fromEntries(filteredOfferings.map(offering => [offering.offId, resolvedQuestionPapersByOfferingId.get(offering.offId) ?? { tt1: buildDefaultQuestionPaper('tt1', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []), tt2: buildDefaultQuestionPaper('tt2', resolvedCourseOutcomesByOfferingId.get(offering.offId) ?? []) }])),
    coAttainmentByOffering: filteredCoAttainmentByOffering,
    meetings: filteredMeetings,
    proofPlayback: stageCheckpointRow ? {
      simulationStageCheckpointId: stageCheckpointRow.simulationStageCheckpointId,
      simulationRunId: stageCheckpointRow.simulationRunId,
      semesterNumber: stageCheckpointRow.semesterNumber,
      stageKey: stageCheckpointRow.stageKey,
      stageLabel: stageCheckpointRow.stageLabel,
      stageDescription: stageCheckpointRow.stageDescription,
      stageOrder: stageCheckpointRow.stageOrder,
      previousCheckpointId: stageCheckpointRow.previousCheckpointId,
      nextCheckpointId: stageCheckpointRow.nextCheckpointId,
      currentDateISO: proofCurrentDateISO ?? stageCheckpointRow.createdAt.slice(0, 10),
    } : null,
  }
}
