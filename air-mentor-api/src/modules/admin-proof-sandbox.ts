import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { simulationRuns } from '../db/schema.js'
import {
  activateProofOperationalSemester,
  activateProofSimulationRun,
  advanceProofSimulationDay,
  advanceProofSimulationStage,
  approveProofCurriculumImport,
  buildProofBatchDashboard,
  createProofCurriculumImport,
  getProofStudentEvidenceTimeline,
  getProofRunCheckpointDetail,
  getProofRunCheckpointStudentDetail,
  getProofRiskModelActive,
  getProofRiskModelCorrelations,
  getProofRiskModelEvaluation,
  listProofRunCheckpoints,
  recomputeObservedOnlyRisk,
  restoreProofSimulationSnapshot,
  reviewProofCrosswalks,
  stopProofSimulationRun,
  validateProofCurriculumImport,
  archiveProofSimulationRun,
} from '../lib/msruas-proof-control-plane.js'
import {
  enqueueProofSimulationRun,
  retryQueuedProofSimulationRun,
} from '../lib/proof-run-queue.js'
import {
  ensureMsruasProofBatchStructure,
  ensureMsruasProofSandboxSeeded,
  MSRUAS_PROOF_BATCH_ID,
  rehydrateProofFacultyCredentials,
} from '../lib/msruas-proof-sandbox.js'
import { emitAuditEvent, parseOrThrow, requireRole } from './support.js'
import {
  DEFAULT_POLICY,
  resolveBatchCurriculumFeatures,
  resolveBatchPolicy,
} from './admin-structure.js'

const batchParamsSchema = z.object({
  batchId: z.string().min(1),
})

const importParamsSchema = z.object({
  curriculumImportVersionId: z.string().min(1),
})

const runParamsSchema = z.object({
  simulationRunId: z.string().min(1),
})

const evidenceParamsSchema = z.object({
  simulationRunId: z.string().min(1),
  studentId: z.string().min(1),
})

const checkpointParamsSchema = z.object({
  simulationRunId: z.string().min(1),
  checkpointId: z.string().min(1),
})

const checkpointStudentParamsSchema = z.object({
  simulationRunId: z.string().min(1),
  checkpointId: z.string().min(1),
  studentId: z.string().min(1),
})

async function requireProofRunBatchId(context: RouteContext, simulationRunId: string) {
  const [run] = await context.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  return run.batchId
}

async function ensureProofSandboxBatch(context: RouteContext, batchId: string) {
  if (batchId !== MSRUAS_PROOF_BATCH_ID) return
  await ensureMsruasProofBatchStructure(context.db, context.now())
}

const createImportSchema = z.object({
  sourcePath: z.string().min(1).optional(),
})

const crosswalkReviewSchema = z.object({
  reviews: z.array(z.object({
    officialCodeCrosswalkId: z.string().min(1),
    reviewStatus: z.string().min(1),
    overrideReason: z.string().nullable().optional(),
  })).min(1),
})

const startRunSchema = z.object({
  curriculumImportVersionId: z.string().min(1),
  seed: z.number().int().positive().optional(),
  runLabel: z.string().min(1).optional(),
  activate: z.boolean().optional(),
})

const restoreSnapshotSchema = z.object({
  simulationResetSnapshotId: z.string().min(1).optional(),
})

const activateSemesterSchema = z.object({
  semesterNumber: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
})

// Advance mode selector — 'day' = Next Day (§B.9/§L.5); 'stage' = Next Stage
// (§C.15/§L.6). Both route through the same service to guarantee identical
// transition pipeline when Next Day crosses a stage boundary (§L.5 contract).
const advanceBodySchema = z.object({
  mode: z.union([z.literal('day'), z.literal('stage')]),
})

const activateSemesterBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['semesterNumber'],
  properties: {
    semesterNumber: {
      type: 'integer',
      enum: [1, 2, 3, 4, 5, 6],
    },
  },
} as const

const activateSemesterResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'simulationRunId', 'batchId', 'activeOperationalSemester', 'previousOperationalSemester'],
  properties: {
    ok: {
      type: 'boolean',
      enum: [true],
    },
    simulationRunId: {
      type: 'string',
    },
    batchId: {
      type: 'string',
    },
    activeOperationalSemester: {
      type: 'integer',
    },
    previousOperationalSemester: {
      type: 'integer',
      nullable: true,
    },
  },
} as const

const proofModelQuerySchema = z.object({
  batchId: z.string().min(1).optional().default(MSRUAS_PROOF_BATCH_ID),
  simulationRunId: z.string().min(1).optional(),
})

export async function registerAdminProofSandboxRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/batches/:batchId/proof-dashboard', {
    schema: { tags: ['admin-proof'], summary: 'Read the proof sandbox dashboard for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(batchParamsSchema, request.params)
    return buildProofBatchDashboard(context.db, params.batchId)
  })

  app.get('/api/admin/proof-models/active', {
    schema: { tags: ['admin-proof'], summary: 'Read the active local proof risk model artifact for the proof batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(proofModelQuerySchema, request.query)
    await ensureProofSandboxBatch(context, query.batchId)
    return getProofRiskModelActive(context.db, { batchId: query.batchId })
  })

  app.get('/api/admin/proof-models/evaluation', {
    schema: { tags: ['admin-proof'], summary: 'Read local proof risk model diagnostics for the proof batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(proofModelQuerySchema, request.query)
    await ensureProofSandboxBatch(context, query.batchId)
    return getProofRiskModelEvaluation(context.db, {
      batchId: query.batchId,
      simulationRunId: query.simulationRunId ?? null,
    })
  })

  app.get('/api/admin/proof-models/correlations', {
    schema: { tags: ['admin-proof'], summary: 'Read stable local proof correlation summaries for the proof batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(proofModelQuerySchema, request.query)
    await ensureProofSandboxBatch(context, query.batchId)
    return getProofRiskModelCorrelations(context.db, { batchId: query.batchId })
  })

  app.get('/api/admin/proof-runs/:simulationRunId/checkpoints', {
    schema: { tags: ['admin-proof'], summary: 'List immutable playback checkpoints for a proof simulation run' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    return {
      items: await listProofRunCheckpoints(context.db, {
        simulationRunId: params.simulationRunId,
      }),
    }
  })

  app.get('/api/admin/proof-runs/:simulationRunId/checkpoints/:checkpointId', {
    schema: { tags: ['admin-proof'], summary: 'Read one immutable playback checkpoint for a proof simulation run' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(checkpointParamsSchema, request.params)
    return getProofRunCheckpointDetail(context.db, {
      simulationRunId: params.simulationRunId,
      simulationStageCheckpointId: params.checkpointId,
    })
  })

  app.get('/api/admin/proof-runs/:simulationRunId/checkpoints/:checkpointId/students/:studentId', {
    schema: { tags: ['admin-proof'], summary: 'Read one student detail row for a proof playback checkpoint' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(checkpointStudentParamsSchema, request.params)
    return getProofRunCheckpointStudentDetail(context.db, {
      simulationRunId: params.simulationRunId,
      simulationStageCheckpointId: params.checkpointId,
      studentId: params.studentId,
    })
  })

  app.post('/api/admin/batches/:batchId/proof-imports', {
    schema: { tags: ['admin-proof'], summary: 'Create a curriculum import for the proof sandbox' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(batchParamsSchema, request.params)
    const body = parseOrThrow(createImportSchema, request.body)
    if (params.batchId === MSRUAS_PROOF_BATCH_ID) {
      await ensureMsruasProofSandboxSeeded(context.db, {
        now: context.now(),
        policy: DEFAULT_POLICY,
      })
    } else {
      await ensureProofSandboxBatch(context, params.batchId)
    }
    const result = await createProofCurriculumImport(context.db, {
      batchId: params.batchId,
      sourcePath: body.sourcePath,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofCurriculumImport',
      entityId: result.curriculumImportVersionId,
      action: 'Created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: result,
    })
    return result
  })

  app.post('/api/admin/proof-imports/:curriculumImportVersionId/validate', {
    schema: { tags: ['admin-proof'], summary: 'Validate a proof curriculum import again' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(importParamsSchema, request.params)
    const validation = await validateProofCurriculumImport(context.db, {
      curriculumImportVersionId: params.curriculumImportVersionId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofCurriculumImport',
      entityId: params.curriculumImportVersionId,
      action: 'Validated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: validation,
    })
    return validation
  })

  app.post('/api/admin/proof-imports/:curriculumImportVersionId/review-crosswalks', {
    schema: { tags: ['admin-proof'], summary: 'Review unresolved proof curriculum crosswalk entries' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(importParamsSchema, request.params)
    const body = parseOrThrow(crosswalkReviewSchema, request.body)
    await reviewProofCrosswalks(context.db, {
      curriculumImportVersionId: params.curriculumImportVersionId,
      actorFacultyId: auth.facultyId,
      reviews: body.reviews,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofCurriculumImport',
      entityId: params.curriculumImportVersionId,
      action: 'ReviewedCrosswalks',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: body.reviews,
    })
    return { ok: true, count: body.reviews.length }
  })

  app.post('/api/admin/proof-imports/:curriculumImportVersionId/approve', {
    schema: { tags: ['admin-proof'], summary: 'Approve a proof curriculum import after crosswalk review' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(importParamsSchema, request.params)
    await approveProofCurriculumImport(context.db, {
      curriculumImportVersionId: params.curriculumImportVersionId,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofCurriculumImport',
      entityId: params.curriculumImportVersionId,
      action: 'Approved',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
    })
    return { ok: true }
  })

  app.post('/api/admin/batches/:batchId/proof-runs', {
    schema: { tags: ['admin-proof'], summary: 'Start or rerun a proof simulation for a batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(batchParamsSchema, request.params)
    const body = parseOrThrow(startRunSchema, request.body)
    await ensureProofSandboxBatch(context, params.batchId)
    const resolved = await resolveBatchPolicy(context, params.batchId)
    const resolvedFeatures = await resolveBatchCurriculumFeatures(context, params.batchId)
    const result = await enqueueProofSimulationRun(context.db, {
      batchId: params.batchId,
      curriculumImportVersionId: body.curriculumImportVersionId,
      policy: resolved.effectivePolicy,
      curriculumFeatureProfileId: resolvedFeatures.primaryCurriculumFeatureProfileId,
      curriculumFeatureProfileFingerprint: resolvedFeatures.curriculumFeatureProfileFingerprint,
      now: context.now(),
      seed: body.seed,
      runLabel: body.runLabel,
      activate: body.activate,
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: result.simulationRunId,
      action: 'Created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: result,
    })
    return result
  })

  app.post('/api/admin/proof-runs/:simulationRunId/retry', {
    schema: { tags: ['admin-proof'], summary: 'Retry a failed or stale proof simulation run' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    const retried = await retryQueuedProofSimulationRun(context.db, {
      simulationRunId: params.simulationRunId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: 'Retried',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: retried,
    })
    return retried
  })

  app.post('/api/admin/proof-runs/:simulationRunId/activate', {
    schema: { tags: ['admin-proof'], summary: 'Activate a proof simulation run' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    await activateProofSimulationRun(context.db, {
      simulationRunId: params.simulationRunId,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: 'Activated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
    })
    return { ok: true }
  })

  app.post('/api/admin/proof-runs/:simulationRunId/activate-semester', {
    schema: {
      tags: ['admin-proof'],
      summary: 'Activate the operational semester for a proof simulation run',
      body: activateSemesterBodySchema,
      response: {
        200: activateSemesterResponseSchema,
      },
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    const body = parseOrThrow(activateSemesterSchema, request.body)
    const result = await activateProofOperationalSemester(context.db, {
      simulationRunId: params.simulationRunId,
      semesterNumber: body.semesterNumber,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: 'ActivatedSemester',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: result,
    })
    return result
  })

  app.post('/api/admin/proof-runs/:simulationRunId/archive', {
    schema: { tags: ['admin-proof'], summary: 'Archive a proof simulation run' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    await archiveProofSimulationRun(context.db, {
      simulationRunId: params.simulationRunId,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: 'Archived',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
    })
    return { ok: true }
  })

  // POST /api/admin/proof-runs/:runId/advance — Next Day / Next Stage
  // authoritative advance (§B.9, §C.15, §L.4-6). Body picks mode.
  app.post('/api/admin/proof-runs/:simulationRunId/advance', {
    schema: {
      tags: ['admin-proof'],
      summary: 'Advance a proof simulation run by one day or one stage',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    const body = parseOrThrow(advanceBodySchema, request.body)
    const result = body.mode === 'day'
      ? await advanceProofSimulationDay(context.db, {
          simulationRunId: params.simulationRunId,
          actorFacultyId: auth.facultyId,
          now: context.now(),
        })
      : await advanceProofSimulationStage(context.db, {
          simulationRunId: params.simulationRunId,
          actorFacultyId: auth.facultyId,
          now: context.now(),
        })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: body.mode === 'day' ? 'AdvancedDay' : 'AdvancedStage',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: result,
    })
    return result
  })

  // POST /api/admin/proof-sandbox/rehydrate-credentials — re-inserts deleted
  // PROOF_FACULTY password credentials (idempotent). Needed by the Playwright
  // flow-11 stop spec to restore login for subsequent tests without a full
  // re-seed. SYSTEM_ADMIN only.
  app.post('/api/admin/proof-sandbox/rehydrate-credentials', {
    schema: { tags: ['admin-proof'], summary: 'Rehydrate proof faculty password credentials (idempotent)' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const result = await rehydrateProofFacultyCredentials(context.db, context.now())
    await emitAuditEvent(context, {
      entityType: 'ProofSandbox',
      entityId: MSRUAS_PROOF_BATCH_ID,
      action: 'RehydratedFacultyCredentials',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: result,
    })
    return result
  })

  // POST /api/admin/proof-runs/:runId/stop — demo finale (§L.11 + §O.3).
  // Deletes proof credentials, invalidates proof-faculty sessions, marks
  // the run lifecycle `stopped`. SYSTEM_ADMIN session is not affected.
  app.post('/api/admin/proof-runs/:simulationRunId/stop', {
    schema: { tags: ['admin-proof'], summary: 'Stop a proof simulation run (credential + session sweep)' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    const result = await stopProofSimulationRun(context.db, {
      simulationRunId: params.simulationRunId,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: 'Stopped',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: result,
    })
    return result
  })

  app.post('/api/admin/proof-runs/:simulationRunId/recompute-risk', {
    schema: { tags: ['admin-proof'], summary: 'Recompute observable-only risk for a proof simulation run' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    const batchId = await requireProofRunBatchId(context, params.simulationRunId)
    const resolved = await resolveBatchPolicy(context, batchId)
    await recomputeObservedOnlyRisk(context.db, {
      simulationRunId: params.simulationRunId,
      policy: resolved.effectivePolicy,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: 'RecomputedObservedRisk',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
    })
    return { ok: true }
  })

  app.post('/api/admin/proof-runs/:simulationRunId/restore-snapshot', {
    schema: { tags: ['admin-proof'], summary: 'Restore a proof simulation run from a snapshot' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(runParamsSchema, request.params)
    const body = parseOrThrow(restoreSnapshotSchema, request.body)
    const batchId = await requireProofRunBatchId(context, params.simulationRunId)
    const resolved = await resolveBatchPolicy(context, batchId)
    const restored = await restoreProofSimulationSnapshot(context.db, {
      simulationRunId: params.simulationRunId,
      simulationResetSnapshotId: body.simulationResetSnapshotId,
      policy: resolved.effectivePolicy,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    await emitAuditEvent(context, {
      entityType: 'ProofSimulationRun',
      entityId: params.simulationRunId,
      action: 'RestoredSnapshot',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: restored,
    })
    return restored
  })

  app.get('/api/admin/proof-runs/:simulationRunId/students/:studentId/evidence-timeline', {
    schema: { tags: ['admin-proof'], summary: 'Read a student evidence timeline for a proof simulation run' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(evidenceParamsSchema, request.params)
    return {
      items: await getProofStudentEvidenceTimeline(context.db, {
        simulationRunId: params.simulationRunId,
        studentId: params.studentId,
      }),
    }
  })
}
