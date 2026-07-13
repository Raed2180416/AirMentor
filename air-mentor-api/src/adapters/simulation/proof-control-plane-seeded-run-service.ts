import { and, eq, ne } from 'drizzle-orm'
import type { AppDb } from '../../db/client.js'
import {
  alertDecisions,
  alertOutcomes,
  electiveRecommendations,
  reassessmentEvents,
  riskAssessments,
  semesterTransitionLogs,
  simulationQuestionTemplates,
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentBehaviorProfiles,
  studentCoStates,
  studentInterventionResponseStates,
  studentInterventions,
  studentLatentStates,
  studentObservedSemesterStates,
  studentQuestionResults,
  studentTopicStates,
  teacherAllocations,
  teacherLoadProfiles,
  transcriptSubjectResults,
  transcriptTermResults,
  worldContextSnapshots,
} from '../../db/schema.js'
import type { ResolvedPolicy } from '../../modules/admin-structure.js'
import { parseObservedStateRow } from '../../lib/proof-observed-state.js'
import { buildProofRunStageBoundarySnapshot } from './proof-control-plane-rebuild-context-service.js'

type FacultyLoadAssignment = {
  offeringId: string
  courseCode: string
  courseName: string
  sectionCode: string
  semesterNumber: number
  weeklyHours: number
}

type ProofFacultyRecord = {
  facultyId: string
  permissions: string[]
}

export type FinalizeSeededProofRunInput = {
  simulationRunId: string
  batchId: string
  curriculumImportVersionId: string
  policy: ResolvedPolicy
  actorFacultyId?: string | null
  now: string
  runSeed: number
  activate: boolean
  scenarioFamily: string
  parentSimulationRunId?: string | null
  skipArtifactRebuild?: boolean
  skipActiveRiskRecompute?: boolean
  trajectories: Array<{ studentId: string }>
  loadsByFacultyId: Map<string, FacultyLoadAssignment[]>
  teacherAllocationRows: Array<typeof teacherAllocations.$inferInsert>
  latentRows: Array<typeof studentLatentStates.$inferInsert>
  behaviorRows: Array<typeof studentBehaviorProfiles.$inferInsert>
  topicStateRows: Array<typeof studentTopicStates.$inferInsert>
  coStateRows: Array<typeof studentCoStates.$inferInsert>
  worldContextRows: Array<typeof worldContextSnapshots.$inferInsert>
  questionTemplateRows: Array<typeof simulationQuestionTemplates.$inferInsert>
  questionResultRows: Array<typeof studentQuestionResults.$inferInsert>
  interventionResponseRows: Array<typeof studentInterventionResponseStates.$inferInsert>
  observedRows: Array<typeof studentObservedSemesterStates.$inferInsert>
  transitionRows: Array<typeof semesterTransitionLogs.$inferInsert>
  attendanceRows: Array<typeof studentAttendanceSnapshots.$inferInsert>
  assessmentRows: Array<typeof studentAssessmentScores.$inferInsert>
  riskRows: Array<typeof riskAssessments.$inferInsert>
  reassessmentRows: Array<typeof reassessmentEvents.$inferInsert>
  alertRows: Array<typeof alertDecisions.$inferInsert>
  alertOutcomeRows: Array<typeof alertOutcomes.$inferInsert>
  electiveRows: Array<typeof electiveRecommendations.$inferInsert>
  interventionRows: Array<typeof studentInterventions.$inferInsert>
  transcriptTermRowsInsert: Array<typeof transcriptTermResults.$inferInsert>
  transcriptSubjectRowsInsert: Array<typeof transcriptSubjectResults.$inferInsert>
}

export type ProofControlPlaneSeededRunServiceDeps = {
  PROOF_FACULTY: ProofFacultyRecord[]
  buildTimetablePayload: (loadsByFacultyId: Map<string, FacultyLoadAssignment[]>) => Record<string, unknown>
  createId: (prefix: string) => string
  emitSimulationAudit: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    actionType: string
    payload: Record<string, unknown>
    createdByFacultyId?: string | null
    now: string
  }) => Promise<void>
  insertRowsInChunks: <T>(db: AppDb, table: unknown, rows: T[], chunkSize?: number) => Promise<void>
  parseJson: <T>(raw: string | null | undefined, fallback: T) => T
  rebuildProofRiskArtifacts: (db: AppDb, input: {
    batchId: string
    simulationRunId: string
    actorFacultyId?: string | null
    now: string
  }) => Promise<unknown>
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
  upsertRuntimeSlice: (db: AppDb, stateKey: string, payload: unknown, now: string) => Promise<void>
}

export async function finalizeSeededProofRun(
  db: AppDb,
  input: FinalizeSeededProofRunInput,
  deps: ProofControlPlaneSeededRunServiceDeps,
) {
  const teacherLoadRows: Array<typeof teacherLoadProfiles.$inferInsert> = []
  const perFacultySemester = new Map<string, Array<typeof teacherAllocations.$inferInsert>>()
  input.teacherAllocationRows.forEach(row => {
    const key = `${row.facultyId}::${row.semesterNumber}`
    perFacultySemester.set(key, [...(perFacultySemester.get(key) ?? []), row])
  })
  for (const faculty of deps.PROOF_FACULTY) {
    for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
      const allocations = perFacultySemester.get(`${faculty.facultyId}::${semesterNumber}`) ?? []
      teacherLoadRows.push({
        teacherLoadProfileId: deps.createId('teacher_load'),
        simulationRunId: input.simulationRunId,
        facultyId: faculty.facultyId,
        semesterNumber,
        sectionLoadCount: allocations.length,
        weeklyContactHours: allocations.reduce((sum, row) => sum + row.plannedContactHours, 0),
        assignedCredits: allocations.reduce((sum, row) => sum + (row.plannedContactHours > 0 ? 1 : 0), 0),
        permissionsJson: JSON.stringify(faculty.permissions),
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
  }

  if (input.teacherAllocationRows.length > 0) await deps.insertRowsInChunks(db, teacherAllocations, input.teacherAllocationRows)
  if (teacherLoadRows.length > 0) await deps.insertRowsInChunks(db, teacherLoadProfiles, teacherLoadRows)
  if (input.latentRows.length > 0) await deps.insertRowsInChunks(db, studentLatentStates, input.latentRows)
  if (input.behaviorRows.length > 0) await deps.insertRowsInChunks(db, studentBehaviorProfiles, input.behaviorRows)
  if (input.topicStateRows.length > 0) await deps.insertRowsInChunks(db, studentTopicStates, input.topicStateRows)
  if (input.coStateRows.length > 0) await deps.insertRowsInChunks(db, studentCoStates, input.coStateRows)
  if (input.worldContextRows.length > 0) await deps.insertRowsInChunks(db, worldContextSnapshots, input.worldContextRows)
  if (input.questionTemplateRows.length > 0) await deps.insertRowsInChunks(db, simulationQuestionTemplates, input.questionTemplateRows)
  if (input.questionResultRows.length > 0) await deps.insertRowsInChunks(db, studentQuestionResults, input.questionResultRows)
  if (input.observedRows.length > 0) await deps.insertRowsInChunks(db, studentObservedSemesterStates, input.observedRows)
  if (input.transitionRows.length > 0) await deps.insertRowsInChunks(db, semesterTransitionLogs, input.transitionRows)
  if (input.attendanceRows.length > 0) await deps.insertRowsInChunks(db, studentAttendanceSnapshots, input.attendanceRows)
  if (input.assessmentRows.length > 0) await deps.insertRowsInChunks(db, studentAssessmentScores, input.assessmentRows)
  if (input.transcriptTermRowsInsert.length > 0) await deps.insertRowsInChunks(db, transcriptTermResults, input.transcriptTermRowsInsert)
  if (input.transcriptSubjectRowsInsert.length > 0) await deps.insertRowsInChunks(db, transcriptSubjectResults, input.transcriptSubjectRowsInsert)
  if (input.riskRows.length > 0) await deps.insertRowsInChunks(db, riskAssessments, input.riskRows)
  if (input.reassessmentRows.length > 0) await deps.insertRowsInChunks(db, reassessmentEvents, input.reassessmentRows)
  if (input.alertRows.length > 0) await deps.insertRowsInChunks(db, alertDecisions, input.alertRows)
  if (input.alertOutcomeRows.length > 0) await deps.insertRowsInChunks(db, alertOutcomes, input.alertOutcomeRows)
  if (input.electiveRows.length > 0) await deps.insertRowsInChunks(db, electiveRecommendations, input.electiveRows)
  if (input.interventionRows.length > 0) await deps.insertRowsInChunks(db, studentInterventions, input.interventionRows)
  if (input.interventionResponseRows.length > 0) await deps.insertRowsInChunks(db, studentInterventionResponseStates, input.interventionResponseRows)

  await deps.rebuildSimulationStagePlayback(db, {
    simulationRunId: input.simulationRunId,
    policy: input.policy,
    now: input.now,
  })
  if (!input.skipArtifactRebuild) {
    await deps.rebuildProofRiskArtifacts(db, {
      batchId: input.batchId,
      simulationRunId: input.simulationRunId,
      actorFacultyId: input.actorFacultyId ?? null,
      now: input.now,
    })
  }
  if (!input.skipActiveRiskRecompute) {
    await deps.recomputeObservedOnlyRisk(db, {
      simulationRunId: input.simulationRunId,
      policy: input.policy,
      actorFacultyId: input.actorFacultyId ?? null,
      now: input.now,
      rebuildModelArtifacts: false,
    })
  }
  const [currentRun, checkpointRows] = await Promise.all([
    db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId)).then(rows => rows[0] ?? null),
    db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)),
  ])
  const stageBoundary = buildProofRunStageBoundarySnapshot(checkpointRows)
  const entrySemester = stageBoundary.semesters[0] ?? null
  const currentRunStartSemester = typeof currentRun?.semesterStart === 'number' ? currentRun.semesterStart : null
  const preserveExplicitStartAuthority = currentRunStartSemester != null
    && entrySemester?.semesterNumber !== currentRunStartSemester
    && (entrySemester?.semesterNumber == null || entrySemester.semesterNumber > currentRunStartSemester)
  const activeOperationalSemester = preserveExplicitStartAuthority
    ? currentRunStartSemester
    : entrySemester?.semesterNumber ?? currentRun?.activeOperationalSemester ?? currentRunStartSemester ?? 1
  const activeStageKey = preserveExplicitStartAuthority
    ? currentRun?.activeStageKey ?? 'pre-tt1'
    : entrySemester?.entryStageKey ?? currentRun?.activeStageKey ?? 'pre-tt1'

  console.log('--- DEBUG finalizeSeededProofRunService ---')
  console.log('stageBoundary.semesters length:', stageBoundary.semesters.length)
  console.log('entrySemester:', entrySemester)
  console.log('currentRunStartSemester:', currentRunStartSemester)
  console.log('preserveExplicitStartAuthority:', preserveExplicitStartAuthority)
  console.log('currentRun.activeStageKey:', currentRun?.activeStageKey)
  console.log('activeOperationalSemester:', activeOperationalSemester)
  console.log('activeStageKey:', activeStageKey)
  console.log('-------------------------------------------')

  const lifecycleState = input.activate ? 'completed-inspectable' : 'completed'
  const setupConfig = {
    activate: input.activate,
    skipArtifactRebuild: Boolean(input.skipArtifactRebuild),
    skipActiveRiskRecompute: Boolean(input.skipActiveRiskRecompute),
    trajectoryCount: input.trajectories.length,
  }
  const scenarioConfig = {
    scenarioFamily: input.scenarioFamily,
    parentSimulationRunId: input.parentSimulationRunId ?? null,
    runSeed: input.runSeed,
  }

  const snapshot = {
    curriculumImportVersionId: input.curriculumImportVersionId,
    seed: input.runSeed,
    policySnapshot: input.policy,
    sectionCount: 2,
    studentCount: 120,
    facultyCount: deps.PROOF_FACULTY.length,
    runAuthority: {
      activeOperationalSemester,
      activeStageKey,
      lifecycleState,
      runMode: 'seeded-proof',
      simulatedDateIso: currentRun?.simulatedDateIso ?? input.now,
      stageBoundary,
    },
    setupConfig,
    scenarioConfig,
  }
  await db.insert(simulationResetSnapshots).values({
    simulationResetSnapshotId: deps.createId('simulation_reset'),
    simulationRunId: input.simulationRunId,
    batchId: input.batchId,
    snapshotLabel: 'Baseline snapshot',
    snapshotJson: JSON.stringify(snapshot),
    createdAt: input.now,
  })

  const timetablePayload = deps.buildTimetablePayload(input.loadsByFacultyId)
  await deps.upsertRuntimeSlice(db, 'timetableByFacultyId', timetablePayload, input.now)

  await deps.emitSimulationAudit(db, {
    simulationRunId: input.simulationRunId,
    batchId: input.batchId,
    actionType: input.parentSimulationRunId ? 'restored-run-created' : 'run-created',
    payload: {
      seed: input.runSeed,
      curriculumImportVersionId: input.curriculumImportVersionId,
      activate: input.activate,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })

  await db.update(simulationRuns).set({
    status: 'completed',
    activeFlag: input.activate ? 1 : 0,
    activeOperationalSemester,
    activeStageKey: activeStageKey ?? null,
    completedAt: input.now,
    simulatedDateIso: currentRun?.simulatedDateIso ?? input.now,
    setupConfigJson: JSON.stringify(setupConfig),
    scenarioConfigJson: JSON.stringify(scenarioConfig),
    lifecycleState,
    runMode: 'seeded-proof',
    stageBoundaryJson: JSON.stringify(stageBoundary),
    progressJson: JSON.stringify({
      phase: 'completed',
      percent: 100,
      mode: 'seeded-proof',
      scenarioFamily: input.scenarioFamily,
    }),
    metricsJson: JSON.stringify({
      proofGoal: 'adaptation-readiness',
      sectionDistribution: { A: 60, B: 60 },
      coverage: {
        behaviorProfileCount: input.behaviorRows.length,
        topicStateCount: input.topicStateRows.length,
        coStateCount: input.coStateRows.length,
        worldContextCount: input.worldContextRows.length,
        questionTemplateCount: input.questionTemplateRows.length,
        questionResultCount: input.questionResultRows.length,
        attendanceHistoryCoverageCount: input.observedRows.filter(row => {
          const payload = parseObservedStateRow(row)
          return Array.isArray(payload.attendanceHistory) || (Array.isArray(payload.subjectScores) && payload.subjectScores.some(item => Array.isArray((item as Record<string, unknown>).attendanceHistory)))
        }).length,
        interventionResponseCount: input.interventionResponseRows.length,
      },
    }),
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, input.simulationRunId))

  if (input.activate) {
    await db.update(simulationRuns).set({
      status: 'completed',
      activeFlag: 0,
      updatedAt: input.now,
    }).where(and(
      eq(simulationRuns.batchId, input.batchId),
      ne(simulationRuns.simulationRunId, input.simulationRunId),
      eq(simulationRuns.activeFlag, 1),
    ))
  }

  return {
    simulationRunId: input.simulationRunId,
    activeFlag: input.activate,
  }
}
