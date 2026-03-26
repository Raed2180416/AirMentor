import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { simulationRuns } from '../db/schema.js'
import {
  activateProofSimulationRun,
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
  startProofSimulationRun,
  validateProofCurriculumImport,
  archiveProofSimulationRun,
} from '../lib/msruas-proof-control-plane.js'
import { MSRUAS_PROOF_BATCH_ID } from '../lib/msruas-proof-sandbox.js'
import { emitAuditEvent, parseOrThrow, requireRole } from './support.js'
import { resolveBatchPolicy } from './admin-structure.js'

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
    return getProofRiskModelActive(context.db, { batchId: query.batchId })
  })

  app.get('/api/admin/proof-models/evaluation', {
    schema: { tags: ['admin-proof'], summary: 'Read local proof risk model diagnostics for the proof batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(proofModelQuerySchema, request.query)
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
    const resolved = await resolveBatchPolicy(context, params.batchId)
    const result = await startProofSimulationRun(context.db, {
      batchId: params.batchId,
      curriculumImportVersionId: body.curriculumImportVersionId,
      policy: resolved.effectivePolicy,
      actorFacultyId: auth.facultyId,
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
