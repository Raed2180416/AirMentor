import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { facultyOfferingOwnerships, sectionOfferings, simulationRuns } from '../src/db/schema.js'
import {
  ensureProofOfferings,
  readRuntimeCurriculum,
} from '../src/lib/msruas-proof-control-plane.js'
import { MSRUAS_PROOF_BATCH_ID } from '../src/lib/msruas-proof-sandbox.js'
import { createTestApp, TEST_NOW } from './helpers/test-app.js'

/**
 * Regression for the `ensureProofOfferings` race that the evaluator hit when
 * `mapWithConcurrency` fanned out several `startProofSimulationRun` calls at
 * once (`scripts/evaluate-proof-risk-model.ts:1110`). Each caller used to
 * read the empty `section_offerings` table, independently compose the same
 * static row set, then race `db.insert(...)` without an `ON CONFLICT` clause,
 * so the 2nd caller 23505'd on `section_offerings_pkey` (and/or
 * `faculty_offering_ownerships_pkey`). That tore the corpus bootstrap down
 * and blocked ML retrain data generation.
 *
 * We call `ensureProofOfferings` directly (not the full sim pipeline) to keep
 * the test fast and to isolate the race at the actual insert site.
 */
describe('ensureProofOfferings concurrent bootstrap', () => {
  let app: Awaited<ReturnType<typeof createTestApp>> | null = null

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it('N parallel callers insert exactly once per offering key', async () => {
    if (!app) throw new Error('test-app not initialised')
    const db = app.db

    const [baselineRun] = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID))
    expect(baselineRun?.curriculumImportVersionId).toBeTruthy()
    const curriculumImportVersionId = baselineRun!.curriculumImportVersionId!

    const runtime = await readRuntimeCurriculum(db, curriculumImportVersionId)
    expect(runtime.courses.length).toBeGreaterThan(0)

    const proofTermIds = [
      'term_mnc_sem1',
      'term_mnc_sem2',
      'term_mnc_sem3',
      'term_mnc_sem4',
      'term_mnc_sem5',
      'term_mnc_sem6',
    ]

    await ensureProofOfferings(db, runtime, TEST_NOW)
    // Ensure seed state: any offerings already present from sandbox seed are fine;
    // the fix must be idempotent regardless. Snapshot pre-count for later checks.
    const prePopulated = await db
      .select()
      .from(sectionOfferings)
      .where(inArray(sectionOfferings.termId, proofTermIds))
    const semOneOfferingIdsMissingOwners = prePopulated
      .filter(row => row.termId === 'term_mnc_sem1')
      .slice(0, 2)
      .map(row => row.offeringId)
    expect(semOneOfferingIdsMissingOwners.length).toBeGreaterThan(0)
    await db.delete(facultyOfferingOwnerships).where(inArray(facultyOfferingOwnerships.offeringId, semOneOfferingIdsMissingOwners))

    const CALLERS = 4
    const results = await Promise.all(
      Array.from({ length: CALLERS }, () =>
        ensureProofOfferings(db, runtime, TEST_NOW)
          .then(() => 'ok' as const)
          .catch((error: unknown) => {
            if (error instanceof Error) return error.message
            return String(error)
          }),
      ),
    )

    const failures = results.filter(value => value !== 'ok')
    expect(failures, `all ${CALLERS} parallel callers must succeed, got failures: ${JSON.stringify(failures)}`).toHaveLength(0)

    const offeringsAfter = await db
      .select()
      .from(sectionOfferings)
      .where(inArray(sectionOfferings.termId, proofTermIds))
    const offeringIds = offeringsAfter.map(row => row.offeringId)
    expect(new Set(offeringIds).size, 'no duplicate offering_id rows').toBe(offeringIds.length)
    expect(offeringsAfter.length, 'at least as many offerings as pre-populated').toBeGreaterThanOrEqual(prePopulated.length)

    const ownerships = await db
      .select()
      .from(facultyOfferingOwnerships)
    const ownershipIds = ownerships.map(row => row.ownershipId)
    expect(new Set(ownershipIds).size, 'no duplicate ownership_id rows').toBe(ownershipIds.length)
    const activeOwnedOfferingIds = new Set(
      ownerships
        .filter(row => row.status === 'active')
        .map(row => row.offeringId),
    )
    expect(
      offeringsAfter.filter(row => !activeOwnedOfferingIds.has(row.offeringId)).map(row => row.offeringId),
      'every proof offering must have an active course-leader ownership after idempotent ensure',
    ).toEqual([])

    // Composite-key sanity: exactly one row per (term, course, section) triple.
    const compositeKeys = offeringsAfter.map(row => `${row.termId}::${row.courseId}::${row.sectionCode}`)
    expect(new Set(compositeKeys).size, 'unique (term, course, section) per offering').toBe(compositeKeys.length)
  }, 60_000)
})
