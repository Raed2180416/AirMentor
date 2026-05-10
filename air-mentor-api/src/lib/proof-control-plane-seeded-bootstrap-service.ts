import { eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import { courses, sectionOfferings, simulationRuns } from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import type { MsruasDeterministicPolicy } from './msruas-rules.js'
import type {
  RuntimeCourse,
  RuntimeCurriculum,
  ScenarioProfile,
} from './msruas-proof-control-plane.js'

export type ProofControlPlaneSeededBootstrapServiceDeps = {
  INFERENCE_MODEL_VERSION: string
  MONITORING_POLICY_VERSION: string
  MSRUAS_PROOF_DEPARTMENT_ID: string
  MSRUAS_PROOF_VALIDATOR_VERSION: string
  PROOF_FACULTY: Array<{ facultyId: string; permissions: string[] }>
  WORLD_ENGINE_VERSION: string
  createId: (prefix: string) => string
  deterministicPolicyFromResolved: (policy: ResolvedPolicy) => MsruasDeterministicPolicy
  /**
   * Legacy sem6-only offering ensurer. Optional so callers migrating to the
   * general-curriculum `ensureProofOfferings` path don't have to supply it.
   * If both are provided, `ensureProofOfferings` wins and sem6 offerings are
   * filtered from the full DB result. If only this is provided, the bootstrap
   * treats its return as the canonical offering list.
   */
  ensureSem6Offerings?: (
    db: AppDb,
    runtimeCourses: RuntimeCourse[],
    now: string,
  ) => Promise<{ offerings: Array<typeof sectionOfferings.$inferSelect> }>
  /**
   * General-curriculum offering ensurer introduced by t50 overnight-impl-phase1-
   * run-authority. When supplied, the bootstrap calls it once, then reloads the
   * full set of offerings for every course the runtime knows about (every
   * semester, not just sem6).
   */
  ensureProofOfferings?: (
    db: AppDb,
    runtime: RuntimeCurriculum,
    now: string,
  ) => Promise<unknown>
  readRuntimeCurriculum: (db: AppDb, curriculumImportVersionId: string) => Promise<RuntimeCurriculum>
  scenarioProfileForSeed: (seed: number) => ScenarioProfile
}

export type PrepareSeededProofRunBootstrapInput = {
  batchId: string
  curriculumImportVersionId: string
  curriculumFeatureProfileId?: string | null
  curriculumFeatureProfileFingerprint?: string | null
  policy: ResolvedPolicy
  now: string
  seed?: number
  runLabel?: string
  parentSimulationRunId?: string | null
  simulationRunId?: string
  activate?: boolean
  sectionOverridesJson?: string | null
  demoWorkspaceId?: string | null
}

export type PreparedSeededProofRunBootstrap = {
  activate: boolean
  deterministicPolicy: MsruasDeterministicPolicy
  offerings: Array<typeof sectionOfferings.$inferSelect>
  /**
   * All known offerings keyed by `"{semesterNumber}::{courseTitle}::{sectionCode}"`.
   * Added for t50 overnight-impl-phase1-run-authority which needs to look up
   * offerings across every semester (historical playback), not only sem6.
   * The bootstrap always populates this. Callers that only care about sem6
   * should keep using `sem6OfferingByCourseTitleSection`.
   */
  offeringBySemesterCourseTitleSection: Map<string, typeof sectionOfferings.$inferSelect>
  runSeed: number
  runtime: RuntimeCurriculum
  scenarioProfile: ScenarioProfile
  sem6: RuntimeCourse[]
  sem6OfferingByCourseTitleSection: Map<string, typeof sectionOfferings.$inferSelect>
  simulationRunId: string
}

export async function prepareSeededProofRunBootstrap(
  db: AppDb,
  input: PrepareSeededProofRunBootstrapInput,
  deps: ProofControlPlaneSeededBootstrapServiceDeps,
): Promise<PreparedSeededProofRunBootstrap> {
  const runtime = await deps.readRuntimeCurriculum(db, input.curriculumImportVersionId)
  const sem6 = runtime.courses.filter(course => course.semesterNumber === 6)
  if (runtime.courses.length === 0 || sem6.length === 0) {
    throw new Error('Approved curriculum import is incomplete')
  }

  const runSeed = input.seed ?? Math.floor(Date.now() % 100000)
  const scenarioProfile = deps.scenarioProfileForSeed(runSeed)
  const deterministicPolicy = deps.deterministicPolicyFromResolved(input.policy)
  const simulationRunId = input.simulationRunId ?? deps.createId('simulation_run')
  const activate = input.activate ?? true

  // Two offering-ensurer pathways:
  //   1. `ensureProofOfferings` (preferred, added by t50): ensures offerings for
  //      every semester; bootstrap then reloads the full row set from DB.
  //   2. `ensureSem6Offerings` (legacy): ensures only sem6 offerings; bootstrap
  //      uses its return directly.
  // Both optional in type so callers can migrate gradually. At runtime exactly
  // one must be supplied.
  let offerings: Array<typeof sectionOfferings.$inferSelect>
  if (deps.ensureProofOfferings) {
    await deps.ensureProofOfferings(db, runtime, input.now)
    // RuntimeCourse.courseId is `string | null` (may be unmapped); filter before
    // the inArray clause so drizzle's parameter type (string[]) is satisfied.
    const courseIds = runtime.courses
      .map(c => c.courseId)
      .filter((id): id is string => id !== null)
    offerings = courseIds.length > 0
      ? await db.select().from(sectionOfferings).where(inArray(sectionOfferings.courseId, courseIds))
      : []
  } else if (deps.ensureSem6Offerings) {
    ({ offerings } = await deps.ensureSem6Offerings(db, runtime.courses, input.now))
  } else {
    throw new Error('prepareSeededProofRunBootstrap: deps must supply either ensureProofOfferings or ensureSem6Offerings')
  }
  const courseRows = await db.select().from(courses).where(eq(courses.departmentId, deps.MSRUAS_PROOF_DEPARTMENT_ID))
  const courseById = new Map(courseRows.map(row => [row.courseId, row] as const))
  // courses table has no semesterNumber column; runtime.courses does, so key
  // the all-semester map via the runtime course lookup.
  const runtimeCourseById = new Map(runtime.courses.map(c => [c.courseId, c] as const))
  const sem6OfferingByCourseTitleSection = new Map<string, typeof sectionOfferings.$inferSelect>()
  const offeringBySemesterCourseTitleSection = new Map<string, typeof sectionOfferings.$inferSelect>()
  for (const offering of offerings) {
    const course = courseById.get(offering.courseId)
    if (!course) continue
    const runtimeCourse = runtimeCourseById.get(offering.courseId)
    const semesterNumber = runtimeCourse?.semesterNumber ?? 6
    if (semesterNumber === 6) {
      sem6OfferingByCourseTitleSection.set(`${course.title}::${offering.sectionCode}`, offering)
    }
    offeringBySemesterCourseTitleSection.set(
      `${semesterNumber}::${course.title}::${offering.sectionCode}`,
      offering,
    )
  }

  const runBaseValues = {
    batchId: input.batchId,
    curriculumImportVersionId: input.curriculumImportVersionId,
    curriculumFeatureProfileId: input.curriculumFeatureProfileId ?? null,
    curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    parentSimulationRunId: input.parentSimulationRunId ?? null,
    runLabel: input.runLabel ?? `MSRUAS proof rerun ${runSeed}`,
    seed: runSeed,
    sectionCount: 2,
    studentCount: 120,
    facultyCount: deps.PROOF_FACULTY.length,
    semesterStart: 1,
    semesterEnd: 6,
    activeOperationalSemester: 1,
    sourceType: 'simulation' as const,
    demoWorkspaceId: input.demoWorkspaceId ?? null,
    sectionOverridesJson: input.sectionOverridesJson ?? null,
    policySnapshotJson: JSON.stringify(input.policy),
    engineVersionsJson: JSON.stringify({
      compilerVersion: deps.MSRUAS_PROOF_VALIDATOR_VERSION,
      worldEngineVersion: deps.WORLD_ENGINE_VERSION,
      inferenceModelVersion: deps.INFERENCE_MODEL_VERSION,
      monitoringPolicyVersion: deps.MONITORING_POLICY_VERSION,
    }),
    metricsJson: JSON.stringify({
      proofGoal: 'adaptation-readiness',
      sectionDistribution: { A: 60, B: 60 },
      scenarioFamily: scenarioProfile.family,
    }),
    updatedAt: input.now,
  }

  if (input.simulationRunId) {
    await db.update(simulationRuns).set(runBaseValues).where(eq(simulationRuns.simulationRunId, simulationRunId))
  } else {
    await db.insert(simulationRuns).values({
      simulationRunId,
      ...runBaseValues,
      status: 'running',
      activeFlag: 0,
      createdAt: input.now,
    })
  }

  return {
    activate,
    deterministicPolicy,
    offerings,
    offeringBySemesterCourseTitleSection,
    runSeed,
    runtime,
    scenarioProfile,
    sem6,
    sem6OfferingByCourseTitleSection,
    simulationRunId,
  }
}
