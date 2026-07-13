import { eq } from 'drizzle-orm'
import type { AppDb } from '../../db/client.js'
import {
  academicTerms,
  courses,
  curriculumEdges,
  curriculumNodes,
  electiveRecommendations,
  facultyOfferingOwnerships,
  mentorAssignments,
  roleGrants,
  sectionOfferings,
  simulationRuns,
  simulationQuestionTemplates,
  simulationStageCheckpoints,
  studentAttendanceSnapshots,
  studentCoStates,
  studentObservedSemesterStates,
  studentQuestionResults,
  students,
  teacherAllocations,
  teacherLoadProfiles,
} from '../../db/schema.js'
import { nullablePct } from '../../lib/proof-evidence-normalization.js'
import { parseObservedStateRow } from '../../lib/proof-observed-state.js'
import type { StageCourseProjectionSource } from './msruas-proof-control-plane.js'

type AttendanceHistoryEntry = {
  checkpoint: string
  checkpointLabel: string
  presentClasses: number
  totalClasses: number
  attendancePct: number
}

type PlaybackStageDef = {
  key: string
  label: string
  description: string
  order: number
}

export type ProofControlPlaneRebuildContextServiceDeps = {
  PLAYBACK_STAGE_DEFS: PlaybackStageDef[]
  MSRUAS_PROOF_BRANCH_ID: string
  MSRUAS_PROOF_DEPARTMENT_ID: string
  average: (values: number[]) => number
  buildDeterministicId: (prefix: string, parts: Array<string | number>) => string
  clamp: (value: number, min: number, max: number) => number
  parseJson: <T>(value: string | null | undefined, fallback: T) => T
  toInterventionResponse: (value: unknown) => StageCourseProjectionSource['interventionResponse']
}

export type PreparePlaybackRebuildContextInput = {
  simulationRunId: string
  now: string
  run: typeof simulationRuns.$inferSelect
}

export type PreparedPlaybackRebuildContext = {
  checkpointBySemesterStage: Map<string, typeof simulationStageCheckpoints.$inferInsert>
  courseLeaderFacultyIdByCurriculumNodeSectionSemester: Map<string, string>
  courseLeaderFacultyIdByOfferingId: Map<string, string>
  downstreamNodeIdsBySourceNodeId: Map<string, string[]>
  electiveRows: Array<typeof electiveRecommendations.$inferSelect>
  facultyBudgetByKey: Map<string, number>
  hodFacultyId: string | null
  mentorFacultyIdByStudentId: Map<string, string>
  orderedCheckpointRows: Array<typeof simulationStageCheckpoints.$inferInsert>
  prerequisiteNodeIdsByTargetNodeId: Map<string, string[]>
  sectionStudentCountBySemesterSection: Map<string, number>
  semesterNumbers: number[]
  sourceByStudentNodeId: Map<string, StageCourseProjectionSource>
  sources: StageCourseProjectionSource[]
  teacherAllocationRows: Array<typeof teacherAllocations.$inferSelect>
  templateById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
}

type ProofRunStageBoundaryCheckpointLike = {
  simulationStageCheckpointId: string
  semesterNumber: number
  stageKey: string
  stageOrder: number
}

export type ProofRunStageBoundarySnapshot = {
  strictlyMonotonic: boolean
  availableSemesters: number[]
  semesters: Array<{
    semesterNumber: number
    stageCount: number
    entryCheckpointId: string | null
    entryStageKey: string | null
    exitCheckpointId: string | null
    exitStageKey: string | null
    stageKeys: string[]
    stageOrders: number[]
  }>
}

export function buildProofRunStageBoundarySnapshot(
  checkpointRows: ProofRunStageBoundaryCheckpointLike[],
): ProofRunStageBoundarySnapshot {
  const sortedRows = checkpointRows
    .slice()
    .sort((left, right) => (
      left.semesterNumber - right.semesterNumber
      || left.stageOrder - right.stageOrder
      || left.simulationStageCheckpointId.localeCompare(right.simulationStageCheckpointId)
    ))

  let strictlyMonotonic = true
  const bySemester = new Map<number, {
    semesterNumber: number
    stageCount: number
    entryCheckpointId: string | null
    entryStageKey: string | null
    exitCheckpointId: string | null
    exitStageKey: string | null
    stageKeys: string[]
    stageOrders: number[]
    seenStageKeys: Set<string>
    previousStageOrder: number | null
  }>()

  sortedRows.forEach(row => {
    const current = bySemester.get(row.semesterNumber) ?? {
      semesterNumber: row.semesterNumber,
      stageCount: 0,
      entryCheckpointId: null,
      entryStageKey: null,
      exitCheckpointId: null,
      exitStageKey: null,
      stageKeys: [],
      stageOrders: [],
      seenStageKeys: new Set<string>(),
      previousStageOrder: null,
    }
    if (current.previousStageOrder != null && row.stageOrder <= current.previousStageOrder) {
      strictlyMonotonic = false
    }
    if (current.seenStageKeys.has(row.stageKey)) {
      strictlyMonotonic = false
    }
    if (current.entryCheckpointId == null) current.entryCheckpointId = row.simulationStageCheckpointId
    if (current.entryStageKey == null) current.entryStageKey = row.stageKey
    current.exitCheckpointId = row.simulationStageCheckpointId
    current.exitStageKey = row.stageKey
    current.stageCount += 1
    current.stageKeys.push(row.stageKey)
    current.stageOrders.push(row.stageOrder)
    current.seenStageKeys.add(row.stageKey)
    current.previousStageOrder = row.stageOrder
    bySemester.set(row.semesterNumber, current)
  })

  return {
    strictlyMonotonic,
    availableSemesters: [...bySemester.keys()].sort((left, right) => left - right),
    semesters: [...bySemester.values()]
      .sort((left, right) => left.semesterNumber - right.semesterNumber)
      .map(({ seenStageKeys: _seenStageKeys, previousStageOrder: _previousStageOrder, ...semester }) => semester),
  }
}

export async function preparePlaybackRebuildContext(
  db: AppDb,
  input: PreparePlaybackRebuildContextInput,
  deps: ProofControlPlaneRebuildContextServiceDeps,
): Promise<PreparedPlaybackRebuildContext> {
  const [
    studentRows,
    observedRows,
    curriculumNodeRows,
    coRows,
    questionRows,
    questionTemplateRows,
    electiveRows,
    edgeRows,
    teacherAllocationRows,
    teacherLoadRows,
    ownershipRows,
    mentorRows,
    grantRows,
    termRows,
    offeringRows,
    courseRows,
    attendanceRows,
  ] = await Promise.all([
    db.select().from(students),
    db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId)),
    db.select().from(curriculumNodes).where(eq(curriculumNodes.batchId, input.run.batchId)),
    db.select().from(studentCoStates).where(eq(studentCoStates.simulationRunId, input.simulationRunId)),
    db.select().from(studentQuestionResults).where(eq(studentQuestionResults.simulationRunId, input.simulationRunId)),
    db.select().from(simulationQuestionTemplates).where(eq(simulationQuestionTemplates.simulationRunId, input.simulationRunId)),
    db.select().from(electiveRecommendations).where(eq(electiveRecommendations.simulationRunId, input.simulationRunId)),
    db.select().from(curriculumEdges).where(eq(curriculumEdges.batchId, input.run.batchId)),
    db.select().from(teacherAllocations).where(eq(teacherAllocations.simulationRunId, input.simulationRunId)),
    db.select().from(teacherLoadProfiles).where(eq(teacherLoadProfiles.simulationRunId, input.simulationRunId)),
    db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    db.select().from(mentorAssignments),
    db.select().from(roleGrants).where(eq(roleGrants.status, 'active')),
    db.select().from(academicTerms).where(eq(academicTerms.batchId, input.run.batchId)),
    db.select().from(sectionOfferings),
    db.select().from(courses),
    db.select().from(studentAttendanceSnapshots),
  ])

  const studentById = new Map(studentRows.map(row => [row.studentId, row]))
  const curriculumNodeBySemesterCode = new Map(
    curriculumNodeRows.map(row => [`${row.semesterNumber}::${row.courseCode}`, row] as const),
  )
  const templateById = new Map(questionTemplateRows.map(row => [row.simulationQuestionTemplateId, row] as const))
  const courseById = new Map(courseRows.map(row => [row.courseId, row] as const))
  const termById = new Map(termRows.map(row => [row.termId, row] as const))
  const offeringBySemesterCourseSection = new Map<string, typeof sectionOfferings.$inferSelect>()
  offeringRows.forEach(offering => {
    const term = termById.get(offering.termId)
    const course = courseById.get(offering.courseId)
    if (!term || !course) return
    offeringBySemesterCourseSection.set(`${term.semesterNumber}::${course.courseCode}::${offering.sectionCode}`, offering)
    offeringBySemesterCourseSection.set(`${term.semesterNumber}::${course.title}::${offering.sectionCode}`, offering)
  })
  const latestTeacherAttendanceByStudentOffering = new Map<string, typeof studentAttendanceSnapshots.$inferSelect>()
  attendanceRows
    .filter(row => row.source === 'teacher-workspace')
    .forEach(row => {
      const key = `${row.studentId}::${row.offeringId}`
      const current = latestTeacherAttendanceByStudentOffering.get(key)
      if (!current || row.capturedAt > current.capturedAt || (row.capturedAt === current.capturedAt && row.updatedAt > current.updatedAt)) {
        latestTeacherAttendanceByStudentOffering.set(key, row)
      }
    })
  const applyTeacherAttendanceOverride = (source: StageCourseProjectionSource): StageCourseProjectionSource => {
    if (!source.offeringId) return source
    const attendance = latestTeacherAttendanceByStudentOffering.get(`${source.studentId}::${source.offeringId}`)
    if (!attendance) return source
    const historyEntry: AttendanceHistoryEntry = {
      checkpoint: 'teacher-workspace',
      checkpointLabel: 'Teacher Workspace',
      presentClasses: attendance.presentClasses,
      totalClasses: attendance.totalClasses,
      attendancePct: attendance.attendancePercent,
    }
    return {
      ...source,
      attendancePct: attendance.attendancePercent,
      attendanceHistory: [historyEntry, historyEntry, historyEntry, historyEntry],
    }
  }

  const checkpointBySemesterStage = new Map<string, typeof simulationStageCheckpoints.$inferInsert>()
  const semesterNumbers = Array.from(
    { length: Math.max(1, input.run.semesterEnd - input.run.semesterStart + 1) },
    (_, semesterIndex) => input.run.semesterStart + semesterIndex,
  )
  const orderedCheckpointRows = semesterNumbers
    .flatMap(semesterNumber => deps.PLAYBACK_STAGE_DEFS.map(stage => ({
      simulationStageCheckpointId: deps.buildDeterministicId('stage_checkpoint', [input.simulationRunId, semesterNumber, stage.key]),
      simulationRunId: input.simulationRunId,
      semesterNumber,
      stageKey: stage.key,
      stageLabel: stage.label,
      stageDescription: stage.description,
      stageOrder: stage.order,
      previousCheckpointId: null as string | null,
      nextCheckpointId: null as string | null,
      summaryJson: '{}',
      createdAt: input.now,
      updatedAt: input.now,
    })))
  orderedCheckpointRows.forEach((row, index) => {
    row.previousCheckpointId = orderedCheckpointRows[index - 1]?.simulationStageCheckpointId ?? null
    row.nextCheckpointId = orderedCheckpointRows[index + 1]?.simulationStageCheckpointId ?? null
    checkpointBySemesterStage.set(`${row.semesterNumber}::${row.stageKey}`, row)
  })

  const toNonNegativeNumber = (value: unknown, fallback = 0) => {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback
  }
  const previousSemesterSummaryByStudentSemester = new Map<string, {
    cgpa: number
    backlogCount: number
    activeBacklogCredits: number
    historicalBacklogCredits: number
    lowerYearBlockerCredits: number
  }>()
  observedRows
    .filter(row => row.semesterNumber <= 5)
    .forEach(row => {
      const payload = parseObservedStateRow(row)
      const activeBacklogCredits = toNonNegativeNumber(payload.activeBacklogCredits)
      previousSemesterSummaryByStudentSemester.set(`${row.studentId}::${row.semesterNumber}`, {
        cgpa: toNonNegativeNumber(payload.cgpaAfterSemester),
        backlogCount: toNonNegativeNumber(payload.backlogCount),
        activeBacklogCredits,
        historicalBacklogCredits: toNonNegativeNumber(payload.historicalBacklogCredits, activeBacklogCredits),
        lowerYearBlockerCredits: toNonNegativeNumber(
          payload.lowerYearBlockerCredits,
          activeBacklogCredits > 15 ? activeBacklogCredits : 0,
        ),
      })
    })

  const curriculumNodeById = new Map(curriculumNodeRows.map(row => [row.curriculumNodeId, row] as const))
  const coRowsBySourceKey = new Map<string, Array<typeof studentCoStates.$inferSelect>>()
  coRows.forEach(row => {
    const node = row.curriculumNodeId ? curriculumNodeById.get(row.curriculumNodeId) ?? null : null
    const key = `${row.studentId}::${row.semesterNumber}::${row.offeringId ?? ''}::${node?.courseCode ?? row.coCode}`
    coRowsBySourceKey.set(key, [...(coRowsBySourceKey.get(key) ?? []), row])
  })

  const questionRowsBySourceKey = new Map<string, Array<typeof studentQuestionResults.$inferSelect>>()
  questionRows.forEach(row => {
    const node = row.curriculumNodeId ? curriculumNodeById.get(row.curriculumNodeId) ?? null : null
    const courseCode = node?.courseCode ?? ''
    const key = `${row.studentId}::${row.semesterNumber}::${row.offeringId ?? ''}::${courseCode}`
    questionRowsBySourceKey.set(key, [...(questionRowsBySourceKey.get(key) ?? []), row])
  })

  const sources: StageCourseProjectionSource[] = []
  observedRows
    .slice()
    .sort((left, right) => left.studentId.localeCompare(right.studentId) || left.semesterNumber - right.semesterNumber || left.createdAt.localeCompare(right.createdAt))
    .forEach(row => {
      const student = studentById.get(row.studentId)
      const payload = parseObservedStateRow(row)
      const previousSummary = previousSemesterSummaryByStudentSemester.get(`${row.studentId}::${row.semesterNumber - 1}`) ?? {
        cgpa: 0,
        backlogCount: 0,
        activeBacklogCredits: 0,
        historicalBacklogCredits: 0,
        lowerYearBlockerCredits: 0,
      }
      const closingActiveBacklogCredits = toNonNegativeNumber(payload.activeBacklogCredits, previousSummary.activeBacklogCredits)
      const historicalBacklogCredits = toNonNegativeNumber(payload.historicalBacklogCredits, previousSummary.historicalBacklogCredits)
      const lowerYearBlockerCredits = toNonNegativeNumber(
        payload.lowerYearBlockerCredits,
        closingActiveBacklogCredits > 15 ? closingActiveBacklogCredits : previousSummary.lowerYearBlockerCredits,
      )
      const backlogSensitivityScore = typeof payload.backlogSensitivityScore === 'number' && Number.isFinite(payload.backlogSensitivityScore)
        ? payload.backlogSensitivityScore
        : undefined
      if (row.semesterNumber <= 5 && typeof payload.offeringId !== 'string') {
        const subjectScores = Array.isArray(payload.subjectScores) ? payload.subjectScores : []
        subjectScores.forEach(subject => {
          const record = subject as Record<string, unknown>
          const courseCode = String(record.courseCode ?? 'NA')
          const courseTitle = String(record.title ?? courseCode)
          const curriculumNode = curriculumNodeBySemesterCode.get(`${row.semesterNumber}::${courseCode}`) ?? null
          const offeringId = typeof record.offeringId === 'string'
            ? record.offeringId
            : (offeringBySemesterCourseSection.get(`${row.semesterNumber}::${courseCode}::${row.sectionCode}`)
              ?? offeringBySemesterCourseSection.get(`${row.semesterNumber}::${courseTitle}::${row.sectionCode}`))?.offeringId ?? null
          const sourceKey = `${row.studentId}::${row.semesterNumber}::${offeringId ?? ''}::${courseCode}`
          const legacySourceKey = `${row.studentId}::${row.semesterNumber}::::${courseCode}`
          const coSourceRows = coRowsBySourceKey.get(sourceKey) ?? coRowsBySourceKey.get(legacySourceKey) ?? []
          const questionSourceRows = questionRowsBySourceKey.get(sourceKey) ?? questionRowsBySourceKey.get(legacySourceKey) ?? []
          sources.push(applyTeacherAttendanceOverride({
            studentId: row.studentId,
            studentName: student?.name ?? row.studentId,
            usn: student?.usn ?? '',
            semesterNumber: row.semesterNumber,
            sectionCode: row.sectionCode,
            termId: row.termId,
            offeringId,
            curriculumNodeId: curriculumNode?.curriculumNodeId ?? null,
            courseCode,
            courseTitle,
            courseFamily: curriculumNode?.assessmentProfile ?? 'general',
            attendanceHistory: deps.parseJson(JSON.stringify(record.attendanceHistory ?? []), [] as AttendanceHistoryEntry[]),
            attendancePct: Number(record.attendancePct ?? 0),
            tt1Pct: nullablePct(record.tt1Pct),
            tt2Pct: nullablePct(record.tt2Pct),
            quizPct: nullablePct(record.quizPct),
            assignmentPct: nullablePct(record.assignmentPct),
            cePct: Number(record.cePct ?? 0),
            seePct: nullablePct(record.seePct),
            finalMark: Number(record.score ?? 0),
            result: String(record.result ?? 'Unknown'),
            previousCgpa: previousSummary.cgpa,
            previousBacklogCount: previousSummary.backlogCount,
            closingCgpa: toNonNegativeNumber(payload.cgpaAfterSemester, previousSummary.cgpa),
            closingBacklogCount: toNonNegativeNumber(payload.backlogCount, previousSummary.backlogCount),
            previousBacklogCredits: previousSummary.activeBacklogCredits,
            closingBacklogCredits: closingActiveBacklogCredits,
            activeBacklogCredits: closingActiveBacklogCredits,
            historicalBacklogCredits,
            lowerYearBlockerCredits,
            backlogSensitivityScore,
            questionRows: questionSourceRows,
            coRows: coSourceRows,
            interventionResponse: deps.toInterventionResponse(record.interventionResponse),
          }))
        })
        return
      }

      const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
      const courseCode = String(payload.courseCode ?? 'NA')
      const curriculumNode = curriculumNodeBySemesterCode.get(`${row.semesterNumber}::${courseCode}`) ?? null
      const sourceKey = `${row.studentId}::${row.semesterNumber}::${offeringId ?? ''}::${courseCode}`
      sources.push(applyTeacherAttendanceOverride({
        studentId: row.studentId,
        studentName: student?.name ?? row.studentId,
        usn: student?.usn ?? '',
        semesterNumber: row.semesterNumber,
        sectionCode: row.sectionCode,
        termId: row.termId,
        offeringId,
        curriculumNodeId: curriculumNode?.curriculumNodeId ?? null,
        courseCode,
        courseTitle: String(payload.courseTitle ?? courseCode),
        courseFamily: curriculumNode?.assessmentProfile ?? 'general',
        attendanceHistory: deps.parseJson(JSON.stringify(payload.attendanceHistory ?? []), [] as AttendanceHistoryEntry[]),
        attendancePct: Number(payload.attendancePct ?? 0),
        tt1Pct: nullablePct(payload.tt1Pct),
        tt2Pct: nullablePct(payload.tt2Pct),
        quizPct: nullablePct(payload.quizPct),
        assignmentPct: nullablePct(payload.assignmentPct),
        cePct: Number(payload.cePct ?? 0),
        seePct: nullablePct(payload.seePct),
        finalMark: Number(payload.finalMark ?? 0),
        result: String(payload.result ?? 'Unknown'),
        previousCgpa: previousSummary.cgpa,
        previousBacklogCount: previousSummary.backlogCount,
        closingCgpa: toNonNegativeNumber(payload.cgpa, previousSummary.cgpa),
        closingBacklogCount: toNonNegativeNumber(payload.backlogCount, previousSummary.backlogCount),
        previousBacklogCredits: previousSummary.activeBacklogCredits,
        closingBacklogCredits: closingActiveBacklogCredits,
        activeBacklogCredits: closingActiveBacklogCredits,
        historicalBacklogCredits,
        lowerYearBlockerCredits,
        backlogSensitivityScore,
        questionRows: questionRowsBySourceKey.get(sourceKey) ?? [],
        coRows: coRowsBySourceKey.get(sourceKey) ?? [],
        interventionResponse: deps.toInterventionResponse(payload.interventionResponse),
      }))
    })

  const sourceByStudentNodeId = new Map<string, StageCourseProjectionSource>()
  sources.forEach(source => {
    if (!source.curriculumNodeId) return
    sourceByStudentNodeId.set(`${source.studentId}::${source.curriculumNodeId}`, source)
  })

  const prerequisiteNodeIdsByTargetNodeId = new Map<string, string[]>()
  const downstreamNodeIdsBySourceNodeId = new Map<string, string[]>()
  edgeRows
    .filter(row => row.status === 'active')
    .forEach(row => {
      prerequisiteNodeIdsByTargetNodeId.set(row.targetCurriculumNodeId, [...(prerequisiteNodeIdsByTargetNodeId.get(row.targetCurriculumNodeId) ?? []), row.sourceCurriculumNodeId])
      downstreamNodeIdsBySourceNodeId.set(row.sourceCurriculumNodeId, [...(downstreamNodeIdsBySourceNodeId.get(row.sourceCurriculumNodeId) ?? []), row.targetCurriculumNodeId])
    })

  const sectionStudentCountBySemesterSection = new Map<string, number>()
  Array.from(new Set(sources.map(source => `${source.semesterNumber}::${source.sectionCode}::${source.studentId}`)))
    .forEach(key => {
      const [semesterNumber, sectionCode] = key.split('::')
      const sectionKey = `${semesterNumber}::${sectionCode}`
      sectionStudentCountBySemesterSection.set(sectionKey, (sectionStudentCountBySemesterSection.get(sectionKey) ?? 0) + 1)
    })

  const courseLeaderFacultyIdByOfferingId = new Map<string, string>()
  ownershipRows
    .filter(row => row.offeringId != null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      if (!row.offeringId || courseLeaderFacultyIdByOfferingId.has(row.offeringId)) return
      courseLeaderFacultyIdByOfferingId.set(row.offeringId, row.facultyId)
    })
  const courseLeaderFacultyIdByCurriculumNodeSectionSemester = new Map<string, string>()
  teacherAllocationRows
    .filter(row => row.allocationRole === 'course-leader' && row.curriculumNodeId != null && row.sectionCode != null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      const allocationKey = `${row.semesterNumber}::${row.sectionCode}::${row.curriculumNodeId}`
      if (courseLeaderFacultyIdByCurriculumNodeSectionSemester.has(allocationKey)) return
      courseLeaderFacultyIdByCurriculumNodeSectionSemester.set(allocationKey, row.facultyId)
    })
  const mentorFacultyIdByStudentId = new Map<string, string>()
  mentorRows
    .filter(row => row.effectiveTo === null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      if (mentorFacultyIdByStudentId.has(row.studentId)) return
      mentorFacultyIdByStudentId.set(row.studentId, row.facultyId)
    })
  const hodFacultyId = grantRows
    .filter(row => row.roleCode === 'HOD' && [input.run.batchId, deps.MSRUAS_PROOF_BRANCH_ID, deps.MSRUAS_PROOF_DEPARTMENT_ID].includes(row.scopeId))
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))[0]?.facultyId ?? null
  const overloadPenaltyBySemesterFaculty = new Map<string, number>()
  for (const semesterNumber of semesterNumbers) {
    const semesterLoads = teacherLoadRows.filter(row => row.semesterNumber === semesterNumber)
    const currentLoadAverage = deps.average(semesterLoads.map(row => row.weeklyContactHours))
    const overloadThreshold = Math.max(8, Math.ceil(currentLoadAverage * 1.25))
    semesterLoads.forEach(row => {
      overloadPenaltyBySemesterFaculty.set(
        `${semesterNumber}::${row.facultyId}`,
        row.weeklyContactHours > overloadThreshold ? 2 : 0,
      )
    })
  }
  const mentorAssignmentCountByFacultyId = new Map<string, number>()
  mentorRows
    .filter(row => row.effectiveTo === null)
    .forEach(row => {
      mentorAssignmentCountByFacultyId.set(row.facultyId, (mentorAssignmentCountByFacultyId.get(row.facultyId) ?? 0) + 1)
    })
  const supervisedSectionCount = new Set(
    teacherAllocationRows
      .filter(row => row.sectionCode != null)
      .map(row => `${row.semesterNumber}::${row.sectionCode}`),
  ).size
  const facultyBudgetByKey = new Map<string, number>()
  teacherLoadRows.forEach(row => {
    const overloadPenalty = overloadPenaltyBySemesterFaculty.get(`${row.semesterNumber}::${row.facultyId}`) ?? 0
    const ownedOfferingCount = teacherAllocationRows.filter(allocation =>
      allocation.semesterNumber === row.semesterNumber
      && allocation.facultyId === row.facultyId
      && allocation.allocationRole === 'course-leader').length
    facultyBudgetByKey.set(
      `Course Leader::${row.facultyId}::${row.semesterNumber}`,
      deps.clamp(4 + ownedOfferingCount - overloadPenalty, 2, 12),
    )
    facultyBudgetByKey.set(
      `Mentor::${row.facultyId}::${row.semesterNumber}`,
      deps.clamp(6 + Math.ceil((mentorAssignmentCountByFacultyId.get(row.facultyId) ?? 0) / 15) - overloadPenalty, 4, 18),
    )
    facultyBudgetByKey.set(
      `HoD::${row.facultyId}::${row.semesterNumber}`,
      deps.clamp(8 + supervisedSectionCount - overloadPenalty, 6, 24),
    )
  })

  return {
    checkpointBySemesterStage,
    courseLeaderFacultyIdByCurriculumNodeSectionSemester,
    courseLeaderFacultyIdByOfferingId,
    downstreamNodeIdsBySourceNodeId,
    electiveRows,
    facultyBudgetByKey,
    hodFacultyId,
    mentorFacultyIdByStudentId,
    orderedCheckpointRows,
    prerequisiteNodeIdsByTargetNodeId,
    sectionStudentCountBySemesterSection,
    semesterNumbers,
    sourceByStudentNodeId,
    sources,
    teacherAllocationRows,
    templateById,
  }
}
