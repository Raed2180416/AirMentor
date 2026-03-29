import { eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  academicTerms,
  batches,
  courses,
  curriculumCourses,
  facultyOfferingOwnerships,
  sectionOfferings,
  simulationResetSnapshots,
  simulationRuns,
  studentAcademicProfiles,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentEnrollments,
  studentObservedSemesterStates,
  students,
  teacherAllocations,
  teacherLoadProfiles,
  transcriptSubjectResults,
  transcriptTermResults,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import type { MsruasDeterministicPolicy } from './msruas-rules.js'

export type StartLiveBatchProofSimulationRunInput = {
  simulationRunId?: string
  batchId: string
  curriculumImportVersionId: string
  policy: ResolvedPolicy
  curriculumFeatureProfileId?: string | null
  curriculumFeatureProfileFingerprint?: string | null
  actorFacultyId?: string | null
  now: string
  seed?: number
  runLabel?: string
  parentSimulationRunId?: string | null
  activate?: boolean
}

export type ProofControlPlaneLiveRunServiceDeps = {
  INFERENCE_MODEL_VERSION: string
  MONITORING_POLICY_VERSION: string
  MSRUAS_PROOF_VALIDATOR_VERSION: string
  WORLD_ENGINE_VERSION: string
  average: (values: number[]) => number
  createId: (prefix: string) => string
  deterministicPolicyFromResolved: (policy: ResolvedPolicy) => MsruasDeterministicPolicy
  emitSimulationAudit: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    actionType: string
    payload: Record<string, unknown>
    createdByFacultyId?: string | null
    now: string
  }) => Promise<void>
  evaluateCourseStatus: (input: {
    attendancePercent: number
    ceMark: number
    seeMark: number
    policy: MsruasDeterministicPolicy
  }) => {
    overallRounded: number
    gradePoint: number
    gradeLabel: string
    result: string
  }
  insertRowsInChunks: <T>(db: AppDb, table: unknown, rows: T[], chunkSize?: number) => Promise<void>
  rebuildSimulationStagePlayback: (db: AppDb, input: {
    simulationRunId: string
    policy: ResolvedPolicy
    now: string
  }) => Promise<unknown>
  recomputeObservedOnlyRisk: (db: AppDb, input: {
    simulationRunId: string
    policy: ResolvedPolicy
    actorFacultyId?: string | null
    now: string
    rebuildModelArtifacts?: boolean
  }) => Promise<unknown>
  roundToTwo: (value: number) => number
  weeklyContactHoursForCourse: (course: {
    title: string
    assessmentProfile: string
    credits: number
  }) => number
}

function buildLiveAttendanceHistory(
  input: {
    attendancePct: number
    presentClasses: number
    totalClasses: number
  },
) {
  const checkpoints = [
    { checkpoint: 'wk4', checkpointLabel: 'Week 4', totalClasses: 8 },
    { checkpoint: 'wk8', checkpointLabel: 'Week 8', totalClasses: 16 },
    { checkpoint: 'wk12', checkpointLabel: 'Week 12', totalClasses: 24 },
    { checkpoint: 'wk16', checkpointLabel: 'Week 16', totalClasses: 32 },
  ]
  const safeTotalClasses = Math.max(0, input.totalClasses)
  const safePresentClasses = Math.max(0, input.presentClasses)
  const effectivePct = safeTotalClasses > 0
    ? Math.max(0, Math.min(100, Math.round((safePresentClasses / safeTotalClasses) * 100)))
    : Math.max(0, Math.min(100, Math.round(input.attendancePct)))
  return checkpoints.map(checkpoint => {
    const scaledTotal = safeTotalClasses > 0 ? Math.min(checkpoint.totalClasses, safeTotalClasses) : checkpoint.totalClasses
    const scaledPresent = Math.min(
      scaledTotal,
      safeTotalClasses > 0
        ? Math.round((safePresentClasses / Math.max(1, safeTotalClasses)) * scaledTotal)
        : Math.round((effectivePct / 100) * scaledTotal),
    )
    return {
      checkpoint: checkpoint.checkpoint,
      checkpointLabel: checkpoint.checkpointLabel,
      presentClasses: scaledPresent,
      totalClasses: scaledTotal,
      attendancePct: scaledTotal > 0 ? Math.round((scaledPresent / scaledTotal) * 100) : effectivePct,
    }
  })
}

function pctFromScoredComponents(rows: Array<typeof studentAssessmentScores.$inferSelect>, componentTypes: string[], deps: Pick<ProofControlPlaneLiveRunServiceDeps, 'roundToTwo'>) {
  const relevantRows = rows.filter(row => componentTypes.includes(row.componentType))
  if (relevantRows.length === 0) return null
  const totalScore = relevantRows.reduce((sum, row) => sum + row.score, 0)
  const totalMax = relevantRows.reduce((sum, row) => sum + row.maxScore, 0)
  if (totalMax <= 0) return null
  return deps.roundToTwo((totalScore / totalMax) * 100)
}

function latestRowByKey<T extends { updatedAt: string; createdAt: string }>(rows: T[], keyOf: (row: T) => string) {
  const latest = new Map<string, T>()
  rows.forEach(row => {
    const key = keyOf(row)
    const current = latest.get(key)
    if (!current || row.updatedAt > current.updatedAt || (row.updatedAt === current.updatedAt && row.createdAt > current.createdAt)) {
      latest.set(key, row)
    }
  })
  return latest
}

export async function startLiveBatchProofSimulationRun(
  db: AppDb,
  input: StartLiveBatchProofSimulationRunInput,
  deps: ProofControlPlaneLiveRunServiceDeps,
) {
  const runSeed = input.seed ?? Math.floor(Date.now() % 100000)
  const simulationRunId = input.simulationRunId ?? deps.createId('simulation_run')
  const activate = input.activate ?? true

  const [batch] = await db.select().from(batches).where(eq(batches.batchId, input.batchId))
  if (!batch) throw new Error('Batch not found')

  const [
    termRows,
    curriculumRows,
    courseRows,
    offeringRows,
    enrollmentRows,
    studentRows,
    profileRows,
    attendanceRows,
    assessmentRows,
    ownershipRows,
    termResultRows,
    subjectResultRows,
  ] = await Promise.all([
    db.select().from(academicTerms).where(eq(academicTerms.batchId, input.batchId)),
    db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)),
    db.select().from(courses),
    db.select().from(sectionOfferings).where(eq(sectionOfferings.branchId, batch.branchId)),
    db.select().from(studentEnrollments),
    db.select().from(students),
    db.select().from(studentAcademicProfiles),
    db.select().from(studentAttendanceSnapshots),
    db.select().from(studentAssessmentScores),
    db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    db.select().from(transcriptTermResults),
    db.select().from(transcriptSubjectResults),
  ])

  const activeTerm = termRows
    .filter(row => row.status === 'active')
    .slice()
    .sort((left, right) => right.semesterNumber - left.semesterNumber || right.updatedAt.localeCompare(left.updatedAt))[0]
    ?? termRows
      .slice()
      .sort((left, right) => right.semesterNumber - left.semesterNumber || right.updatedAt.localeCompare(left.updatedAt))[0]
    ?? null
  if (!activeTerm) throw new Error('No academic term is configured for this batch')

  const termOfferings = offeringRows.filter(row => row.termId === activeTerm.termId && row.status === 'active')
  if (termOfferings.length === 0) throw new Error('No active offerings exist for the selected batch term')

  const relevantOfferingIds = new Set(termOfferings.map(row => row.offeringId))
  const activeEnrollments = enrollmentRows.filter(row => row.termId === activeTerm.termId && row.academicStatus === 'active')
  const relevantStudentIds = new Set(activeEnrollments.map(row => row.studentId))
  const studentById = new Map(studentRows.filter(row => relevantStudentIds.has(row.studentId)).map(row => [row.studentId, row]))
  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const curriculumByCourseId = new Map(curriculumRows.map(row => [row.courseId ?? `code:${row.courseCode}`, row]))
  const profileByStudentId = new Map(profileRows.map(row => [row.studentId, row]))
  const latestAttendanceByStudentOffering = latestRowByKey(
    attendanceRows.filter(row => relevantOfferingIds.has(row.offeringId)),
    row => `${row.studentId}::${row.offeringId}`,
  )
  const latestTermResultByStudentId = latestRowByKey(
    termResultRows.filter(row => relevantStudentIds.has(row.studentId)),
    row => row.studentId,
  )
  const subjectRowsByTranscriptId = new Map<string, Array<typeof transcriptSubjectResults.$inferSelect>>()
  subjectResultRows.forEach(row => {
    subjectRowsByTranscriptId.set(row.transcriptTermResultId, [...(subjectRowsByTranscriptId.get(row.transcriptTermResultId) ?? []), row])
  })

  if (activate) {
    await db.update(simulationRuns).set({
      activeFlag: 0,
      status: 'completed',
      updatedAt: input.now,
    }).where(eq(simulationRuns.batchId, input.batchId))
  }

  const baseRunValues = {
    batchId: input.batchId,
    curriculumImportVersionId: input.curriculumImportVersionId,
    curriculumFeatureProfileId: input.curriculumFeatureProfileId ?? null,
    curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    parentSimulationRunId: input.parentSimulationRunId ?? null,
    runLabel: input.runLabel ?? `Live batch proof run ${runSeed}`,
    seed: runSeed,
    sectionCount: new Set(termOfferings.map(row => row.sectionCode)).size,
    studentCount: activeEnrollments.length,
    facultyCount: new Set(ownershipRows.filter(row => relevantOfferingIds.has(row.offeringId ?? '')).map(row => row.facultyId)).size,
    semesterStart: activeTerm.semesterNumber,
    semesterEnd: activeTerm.semesterNumber,
    activeOperationalSemester: activeTerm.semesterNumber,
    sourceType: 'live-runtime' as const,
    policySnapshotJson: JSON.stringify(input.policy),
    engineVersionsJson: JSON.stringify({
      compilerVersion: deps.MSRUAS_PROOF_VALIDATOR_VERSION,
      worldEngineVersion: deps.WORLD_ENGINE_VERSION,
      inferenceModelVersion: deps.INFERENCE_MODEL_VERSION,
      monitoringPolicyVersion: deps.MONITORING_POLICY_VERSION,
    }),
    metricsJson: JSON.stringify({
      proofGoal: 'live-runtime-playback',
      termId: activeTerm.termId,
      sectionDistribution: Object.fromEntries(
        Array.from(new Set(termOfferings.map(row => row.sectionCode))).map(sectionCode => [
          sectionCode,
          activeEnrollments.filter(row => row.sectionCode === sectionCode).length,
        ]),
      ),
    }),
    updatedAt: input.now,
  }

  if (input.simulationRunId) {
    await db.update(simulationRuns).set(baseRunValues).where(eq(simulationRuns.simulationRunId, simulationRunId))
  } else {
    await db.insert(simulationRuns).values({
      simulationRunId,
      ...baseRunValues,
      status: 'running',
      activeFlag: 0,
      createdAt: input.now,
    })
  }

  const ownershipByOfferingId = new Map(
    ownershipRows
      .filter(row => row.offeringId != null && relevantOfferingIds.has(row.offeringId))
      .map(row => [row.offeringId!, row]),
  )
  const loadsByFacultySemester = new Map<string, Array<{ offeringId: string; weeklyHours: number }>>()
  const teacherAllocationRows: Array<typeof teacherAllocations.$inferInsert> = []
  for (const offering of termOfferings) {
    const owner = ownershipByOfferingId.get(offering.offeringId) ?? null
    if (!owner) continue
    const course = courseById.get(offering.courseId)
    const curriculumCourse = curriculumByCourseId.get(offering.courseId) ?? curriculumByCourseId.get(`code:${course?.courseCode ?? ''}`) ?? null
    const weeklyHours = deps.weeklyContactHoursForCourse({
      title: course?.title ?? course?.courseCode ?? 'Course',
      assessmentProfile: 'admin-authored',
      credits: curriculumCourse?.credits ?? course?.defaultCredits ?? 0,
    })
    teacherAllocationRows.push({
      teacherAllocationId: deps.createId('teacher_allocation'),
      simulationRunId,
      facultyId: owner.facultyId,
      offeringId: offering.offeringId,
      curriculumNodeId: null,
      semesterNumber: activeTerm.semesterNumber,
      sectionCode: offering.sectionCode,
      allocationRole: 'course-leader',
      plannedContactHours: weeklyHours,
      createdAt: input.now,
      updatedAt: input.now,
    })
    const loadKey = `${owner.facultyId}::${activeTerm.semesterNumber}`
    loadsByFacultySemester.set(loadKey, [...(loadsByFacultySemester.get(loadKey) ?? []), {
      offeringId: offering.offeringId,
      weeklyHours,
    }])
  }
  if (teacherAllocationRows.length > 0) {
    await deps.insertRowsInChunks(db, teacherAllocations, teacherAllocationRows)
  }

  const teacherLoadRows: Array<typeof teacherLoadProfiles.$inferInsert> = Array.from(loadsByFacultySemester.entries()).map(([key, rows]) => {
    const [facultyId, semesterNumberRaw] = key.split('::')
    return {
      teacherLoadProfileId: deps.createId('teacher_load'),
      simulationRunId,
      facultyId,
      semesterNumber: Number(semesterNumberRaw),
      sectionLoadCount: rows.length,
      weeklyContactHours: rows.reduce((sum, row) => sum + row.weeklyHours, 0),
      assignedCredits: rows.length,
      permissionsJson: JSON.stringify(['COURSE_LEADER']),
      createdAt: input.now,
      updatedAt: input.now,
    }
  })
  if (teacherLoadRows.length > 0) {
    await deps.insertRowsInChunks(db, teacherLoadProfiles, teacherLoadRows)
  }

  const assessmentRowsByStudentOffering = new Map<string, Array<typeof studentAssessmentScores.$inferSelect>>()
  assessmentRows
    .filter(row => relevantOfferingIds.has(row.offeringId))
    .forEach(row => {
      const key = `${row.studentId}::${row.offeringId}`
      assessmentRowsByStudentOffering.set(key, [...(assessmentRowsByStudentOffering.get(key) ?? []), row])
    })

  const observedRows: Array<typeof studentObservedSemesterStates.$inferInsert> = []
  for (const offering of termOfferings) {
    const course = courseById.get(offering.courseId)
    if (!course) continue
    const sectionEnrollments = activeEnrollments.filter(row => row.sectionCode === offering.sectionCode)
    for (const enrollment of sectionEnrollments) {
      const student = studentById.get(enrollment.studentId)
      if (!student) continue
      const attendance = latestAttendanceByStudentOffering.get(`${enrollment.studentId}::${offering.offeringId}`) ?? null
      const assessmentCells = assessmentRowsByStudentOffering.get(`${enrollment.studentId}::${offering.offeringId}`) ?? []
      const latestTranscript = latestTermResultByStudentId.get(enrollment.studentId) ?? null
      const latestSubject = latestTranscript ? subjectRowsByTranscriptId.get(latestTranscript.transcriptTermResultId) ?? [] : []
      const prevCgpa = (profileByStudentId.get(enrollment.studentId)?.prevCgpaScaled ?? 0) / 100
      const backlogCount = latestTranscript?.backlogCount ?? 0
      const tt1Pct = pctFromScoredComponents(assessmentCells, ['tt1', 'tt1_leaf'], deps)
      const tt2Pct = pctFromScoredComponents(assessmentCells, ['tt2', 'tt2_leaf'], deps)
      const quizPct = pctFromScoredComponents(assessmentCells, ['quiz1', 'quiz2'], deps)
      const assignmentPct = pctFromScoredComponents(assessmentCells, ['asgn1', 'asgn2'], deps)
      const seePct = pctFromScoredComponents(assessmentCells, ['sem_end', 'see'], deps)
      const ceContributions = [tt1Pct, tt2Pct, quizPct, assignmentPct].filter((value): value is number => value != null)
      const cePct = ceContributions.length > 0 ? deps.roundToTwo(deps.average(ceContributions)) : 0
      const deterministicPolicy = deps.deterministicPolicyFromResolved(input.policy)
      const ceMark = deps.roundToTwo((cePct / 100) * deterministicPolicy.passRules.ceMaximum)
      const seeMark = deps.roundToTwo(((seePct ?? 0) / 100) * deterministicPolicy.passRules.seeMaximum)
      const courseStatus = deps.evaluateCourseStatus({
        attendancePercent: attendance?.attendancePercent ?? 0,
        ceMark,
        seeMark,
        policy: deterministicPolicy,
      })
      const finalMark = courseStatus.overallRounded
      const gradePoint = (seePct == null && tt2Pct == null && tt1Pct == null) ? 0 : courseStatus.gradePoint
      const gradeLabel = (seePct == null && tt2Pct == null && tt1Pct == null) ? 'IP' : courseStatus.gradeLabel
      const result = (seePct == null && tt2Pct == null && tt1Pct == null)
        ? 'In Progress'
        : courseStatus.result
      observedRows.push({
        studentObservedSemesterStateId: deps.createId('observed_state'),
        simulationRunId,
        studentId: enrollment.studentId,
        termId: activeTerm.termId,
        semesterNumber: activeTerm.semesterNumber,
        sectionCode: offering.sectionCode,
        observedStateJson: JSON.stringify({
          offeringId: offering.offeringId,
          courseTitle: course.title,
          courseCode: course.courseCode,
          attendancePct: attendance?.attendancePercent ?? 0,
          attendanceHistory: buildLiveAttendanceHistory({
            attendancePct: attendance?.attendancePercent ?? 0,
            presentClasses: attendance?.presentClasses ?? 0,
            totalClasses: attendance?.totalClasses ?? 0,
          }),
          tt1Pct,
          tt2Pct,
          quizPct,
          assignmentPct,
          seePct,
          cePct,
          finalMark,
          gradeLabel,
          gradePoint,
          result,
          weakCoCount: 0,
          coSummary: [],
          questionEvidenceSummary: {
            weakQuestionCount: 0,
            coverageCount: 0,
            commonWeakTopics: [],
          },
          cgpa: prevCgpa,
          backlogCount,
          priorTranscriptCourses: latestSubject.map(row => row.courseCode),
        }),
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
  }
  if (observedRows.length > 0) {
    await deps.insertRowsInChunks(db, studentObservedSemesterStates, observedRows)
  }

  await deps.rebuildSimulationStagePlayback(db, {
    simulationRunId,
    policy: input.policy,
    now: input.now,
  })
  await deps.recomputeObservedOnlyRisk(db, {
    simulationRunId,
    policy: input.policy,
    actorFacultyId: input.actorFacultyId ?? null,
    now: input.now,
    rebuildModelArtifacts: false,
  })

  await db.insert(simulationResetSnapshots).values({
    simulationResetSnapshotId: deps.createId('simulation_reset'),
    simulationRunId,
    batchId: input.batchId,
    snapshotLabel: 'Live baseline snapshot',
    snapshotJson: JSON.stringify({
      curriculumImportVersionId: input.curriculumImportVersionId,
      seed: runSeed,
      termId: activeTerm.termId,
      semesterNumber: activeTerm.semesterNumber,
      policySnapshot: input.policy,
      studentCount: activeEnrollments.length,
      sectionCount: new Set(termOfferings.map(row => row.sectionCode)).size,
    }),
    createdAt: input.now,
  })

  await db.update(simulationRuns).set({
    status: 'completed',
    activeFlag: activate ? 1 : 0,
    completedAt: input.now,
    progressJson: JSON.stringify({
      phase: 'completed',
      percent: 100,
      mode: 'live-runtime',
      termId: activeTerm.termId,
      semesterNumber: activeTerm.semesterNumber,
      observedRowCount: observedRows.length,
    }),
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, simulationRunId))

  await deps.emitSimulationAudit(db, {
    simulationRunId,
    batchId: input.batchId,
    actionType: input.parentSimulationRunId ? 'restored-run-created' : 'run-created',
    payload: {
      seed: runSeed,
      curriculumImportVersionId: input.curriculumImportVersionId,
      activate,
      mode: 'live-runtime',
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })

  return {
    simulationRunId,
    activeFlag: activate,
  }
}
