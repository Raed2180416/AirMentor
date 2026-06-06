import net from 'node:net'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { type AppDb, createDb, createPool } from '../src/db/client.js'
import { runSqlMigrations } from '../src/db/migrate.js'
import {
  academicFaculties,
  batches,
  branches,
  curriculumImportVersions,
  departments,
  institutions,
  mentorAssignments,
  simulationRuns,
  simulationStageCheckpoints,
  students,
} from '../src/db/schema.js'
import {
  EMBEDDED_CURRICULUM_SOURCE_PATH,
} from '../src/lib/msruas-curriculum-compiler.js'
import {
  ensureMsruasProofSandboxSeeded,
  MSRUAS_PROOF_BATCH_ID,
  MSRUAS_PROOF_BRANCH_ID,
  MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
  MSRUAS_PROOF_SIMULATION_RUN_ID,
} from '../src/lib/msruas-proof-sandbox.js'
import {
  createProofCurriculumImport,
  validateProofCurriculumImport,
} from '../src/lib/msruas-proof-control-plane.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'

const TEST_NOW = '2026-03-31T00:00:00.000Z'

type ProofSeedTestDb = {
  db: AppDb
  pool: ReturnType<typeof createPool>
  embeddedPostgres: EmbeddedPostgres
  databaseDir: string
}

let current: ProofSeedTestDb | null = null

function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a test port')))
        return
      }
      const port = address.port
      server.close(error => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

async function createProofSeedTestDb() {
  const port = await findFreePort()
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-proof-seed-test-'))
  const embeddedPostgres = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: message => {
      if (message) console.error(message)
    },
  })

  await embeddedPostgres.initialise()
  await embeddedPostgres.start()

  const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`
  const pool = createPool(connectionString)
  const db = createDb(pool) as AppDb

  const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')
  await runSqlMigrations(pool, migrationsDir)

  await db.insert(institutions).values({
    institutionId: 'inst_airmentor',
    name: 'AirMentor Institute',
    timezone: 'Asia/Kolkata',
    academicYearStartMonth: 8,
    status: 'active',
    version: 1,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
  })
  await db.insert(academicFaculties).values({
    academicFacultyId: 'academic_faculty_engineering_and_technology',
    institutionId: 'inst_airmentor',
    code: 'ENG',
    name: 'Engineering and Technology',
    overview: 'Seeded faculty for proof sandbox bootstrap tests.',
    status: 'active',
    version: 1,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
  })

  return {
    db,
    pool,
    embeddedPostgres,
    databaseDir,
  }
}

afterEach(async () => {
  if (!current) return
  await current.pool.end()
  await current.embeddedPostgres.stop()
  await rm(current.databaseDir, { recursive: true, force: true })
  current = null
})

describe('msruas proof sandbox seed recovery', () => {
  it('bootstraps the proof branch, batch, import, and run when the proof sandbox is missing', async () => {
    current = await createProofSeedTestDb()

    const result = await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })

    expect(result).toEqual({
      seeded: true,
      batchId: MSRUAS_PROOF_BATCH_ID,
    })

    const [branch] = await current.db.select().from(branches).where(eq(branches.branchId, MSRUAS_PROOF_BRANCH_ID))
    const [batch] = await current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID))
    const [importRow] = await current.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, MSRUAS_PROOF_CURRICULUM_IMPORT_ID))
    const [run] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, MSRUAS_PROOF_SIMULATION_RUN_ID))

    expect(branch).toMatchObject({
      branchId: MSRUAS_PROOF_BRANCH_ID,
      departmentId: 'dept_cse',
    })
    expect(batch).toMatchObject({
      batchId: MSRUAS_PROOF_BATCH_ID,
      branchId: MSRUAS_PROOF_BRANCH_ID,
      currentSemester: 6,
    })
    expect(importRow).toMatchObject({
      curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
      batchId: MSRUAS_PROOF_BATCH_ID,
      sourcePath: EMBEDDED_CURRICULUM_SOURCE_PATH,
      sourceType: 'bundled-json',
      firstSemester: 1,
      lastSemester: 6,
      status: 'validated',
    })
    expect(run).toMatchObject({
      simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
      batchId: MSRUAS_PROOF_BATCH_ID,
      curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
      activeFlag: 1,
      activeOperationalSemester: 1,
    })

    const validation = await validateProofCurriculumImport(current.db, {
      curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
      now: TEST_NOW,
    })
    expect(validation).toMatchObject({
      status: 'review-required',
      semesterCoverage: [1, 6],
      courseCount: 36,
      totalCredits: 118,
      explicitEdgeCount: 24,
      addedEdgeCount: 20,
      bridgeModuleCount: 10,
      electiveOptionCount: 18,
    })
  })

  it('does not duplicate proof seed records when recovery runs twice', async () => {
    current = await createProofSeedTestDb()

    await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })
    const second = await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })

    expect(second).toEqual({
      seeded: false,
      batchId: MSRUAS_PROOF_BATCH_ID,
    })

    const branchRows = await current.db.select().from(branches).where(eq(branches.branchId, MSRUAS_PROOF_BRANCH_ID))
    const batchRows = await current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID))
    const importRows = await current.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, MSRUAS_PROOF_CURRICULUM_IMPORT_ID))
    const runRows = await current.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, MSRUAS_PROOF_SIMULATION_RUN_ID))

    expect(branchRows).toHaveLength(1)
    expect(batchRows).toHaveLength(1)
    expect(importRows).toHaveLength(1)
    expect(runRows).toHaveLength(1)
  })

  it('repairs an empty import marker instead of treating it as a complete proof sandbox', async () => {
    current = await createProofSeedTestDb()

    await current.db.insert(departments).values({
      departmentId: 'dept_cse',
      institutionId: 'inst_airmentor',
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      code: 'CSE',
      name: 'Computer Science and Engineering',
      status: 'active',
      version: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })
    await current.db.insert(branches).values({
      branchId: MSRUAS_PROOF_BRANCH_ID,
      departmentId: 'dept_cse',
      code: 'BTECH-MNC',
      name: 'B.Tech Mathematics and Computing',
      programLevel: 'undergraduate',
      semesterCount: 8,
      status: 'active',
      version: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })
    await current.db.insert(batches).values({
      batchId: MSRUAS_PROOF_BATCH_ID,
      branchId: MSRUAS_PROOF_BRANCH_ID,
      admissionYear: 2023,
      batchLabel: 'B.Tech MNC 2023',
      currentSemester: 6,
      sectionLabelsJson: JSON.stringify(['A', 'B']),
      status: 'active',
      version: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })
    await current.db.insert(curriculumImportVersions).values({
      curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
      batchId: MSRUAS_PROOF_BATCH_ID,
      sourceLabel: 'partial-import-marker',
      sourceChecksum: 'partial-import-marker',
      sourcePath: null,
      sourceType: 'bundled-json',
      compilerVersion: 'partial-import-marker',
      outputChecksum: 'partial-import-marker',
      firstSemester: 1,
      lastSemester: 6,
      courseCount: 0,
      totalCredits: 0,
      explicitEdgeCount: 0,
      addedEdgeCount: 0,
      bridgeModuleCount: 0,
      electiveOptionCount: 0,
      unresolvedMappingCount: 0,
      validationStatus: 'partial',
      completenessCertificateJson: '{}',
      approvedByFacultyId: null,
      approvedAt: null,
      status: 'validated',
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    const result = await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })

    expect(result).toEqual({
      seeded: true,
      batchId: MSRUAS_PROOF_BATCH_ID,
    })
    expect(await current.db.select().from(students)).toHaveLength(120)
    expect(await current.db.select().from(mentorAssignments)).toHaveLength(120)
  })

  it('fails closed when a proof import exists with an incomplete cohort', async () => {
    current = await createProofSeedTestDb()

    await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })
    await current.db.delete(mentorAssignments)

    await expect(ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })).rejects.toThrow(/cohort is incomplete/)
  })

  it('fails closed when a proof import exists without its rich curriculum graph', async () => {
    current = await createProofSeedTestDb()

    await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })
    await current.pool.query('TRUNCATE TABLE curriculum_nodes CASCADE')

    await expect(ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })).rejects.toThrow(/curriculumNodes=0\/36/)
  })

  it('fails closed when a proof import exists with an incomplete projection ledger', async () => {
    current = await createProofSeedTestDb()

    await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })
    await current.db.insert(simulationStageCheckpoints).values({
      simulationStageCheckpointId: 'partial_checkpoint_sem1_pre_tt1',
      simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
      semesterNumber: 1,
      stageKey: 'pre-tt1',
      stageLabel: 'Pre TT1',
      stageDescription: 'Partial playback payload used to prove fail-closed recovery.',
      stageOrder: 0,
      previousCheckpointId: null,
      nextCheckpointId: null,
      summaryJson: '{}',
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    await expect(ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })).rejects.toThrow(/checkpoints=1\/30, projectionRows=0\/21600/)
  })

  it('rebuilds the canonical proof batch shell when the proof cohort already exists', async () => {
    current = await createProofSeedTestDb()

    await ensureMsruasProofSandboxSeeded(current.db, {
      now: TEST_NOW,
      policy: DEFAULT_POLICY,
    })
    await current.pool.query('TRUNCATE TABLE batches CASCADE')

    const result = await createProofCurriculumImport(current.db, {
      batchId: MSRUAS_PROOF_BATCH_ID,
      now: TEST_NOW,
    })

    expect(result.curriculumImportVersionId).toBeTruthy()
    expect(result.validation).toMatchObject({
      semesterCoverage: [1, 6],
      courseCount: 36,
      totalCredits: 118,
    })

    const [batch] = await current.db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID))
    const importRows = await current.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, MSRUAS_PROOF_BATCH_ID))

    expect(batch).toMatchObject({
      batchId: MSRUAS_PROOF_BATCH_ID,
      branchId: MSRUAS_PROOF_BRANCH_ID,
      currentSemester: 6,
      status: 'active',
    })
    expect(importRows).toHaveLength(1)
    expect(importRows[0]).toMatchObject({
      curriculumImportVersionId: result.curriculumImportVersionId,
      batchId: MSRUAS_PROOF_BATCH_ID,
      status: 'validated',
    })
    expect(importRows[0]?.sourcePath).toBeTruthy()
    expect(importRows[0]?.sourceType === 'workbook' || importRows[0]?.sourceType === 'bundled-json').toBe(true)
  })
})
