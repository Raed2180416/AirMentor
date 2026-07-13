/**
 * Curriculum Graph Routes — thin controller.
 *
 * Backend-backed graph builder with draft/publish, durable undo/redo,
 * validation, and LLM suggestion approval. Each handler parses the request,
 * builds a repository from context.db, delegates to a use-case, and maps the
 * use-case's { status, body } onto the reply. All domain logic lives under
 * src/application; all DB access lives under src/adapters/persistence.
 *
 * Endpoints:
 *   GET    /api/admin/batches/:batchId/curriculum-graph
 *   POST   /api/admin/batches/:batchId/curriculum-graph/draft
 *   POST   /api/admin/batches/:batchId/curriculum-graph/validate
 *   POST   /api/admin/batches/:batchId/curriculum-graph/publish
 *   POST   /api/admin/batches/:batchId/curriculum-graph/undo
 *   POST   /api/admin/batches/:batchId/curriculum-graph/redo
 *   POST   /api/admin/batches/:batchId/curriculum-graph/suggest
 *   POST   /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/approve
 *   POST   /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/reject
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { emitAuditEvent, requireRole } from './support.js'
import {
  resolveBatchCurriculumFeatures,
  resolveBatchPolicy,
} from './admin-structure.js'
import { enqueueProofSimulationRun } from '../lib/proof-run-queue.js'
import { buildCurriculumLinkageCandidates } from '../lib/curriculum-linkage.js'
import { createCurriculumGraphRepository } from '../adapters/persistence/repositories/curriculum-graph/curriculum-graph-repository.js'
import type { AuditEmitter } from '../application/use-cases/curriculum-graph/shared.js'
import { loadGraph } from '../application/use-cases/curriculum-graph/load-graph.js'
import { saveDraft } from '../application/use-cases/curriculum-graph/save-draft.js'
import { validateGraphUseCase } from '../application/use-cases/curriculum-graph/validate-graph.js'
import { publishGraph } from '../application/use-cases/curriculum-graph/publish-graph.js'
import { undoGraph } from '../application/use-cases/curriculum-graph/undo-graph.js'
import { redoGraph } from '../application/use-cases/curriculum-graph/redo-graph.js'
import { suggestLinks } from '../application/use-cases/curriculum-graph/suggest-links.js'
import { approveSuggestion } from '../application/use-cases/curriculum-graph/approve-suggestion.js'
import { rejectSuggestion } from '../application/use-cases/curriculum-graph/reject-suggestion.js'

const batchParamsSchema = z.object({
  batchId: z.string().min(1),
})

const suggestionParamsSchema = z.object({
  batchId: z.string().min(1),
  suggestionId: z.string().min(1),
})

export async function registerCurriculumGraphRoutes(app: FastifyInstance, context: RouteContext) {
  const repo = createCurriculumGraphRepository(context.db)
  const emitAudit: AuditEmitter = params => emitAuditEvent(context, params)
  const now = context.now

  // Context-bound closures for the injected external services (kept out of the
  // persistence-free application layer).
  const resolveBatchPolicyForBatch = (batchId: string) => resolveBatchPolicy(context, batchId)
  const resolveBatchFeaturesForBatch = (batchId: string) => resolveBatchCurriculumFeatures(context, batchId)
  const enqueueProofRun = (input: Parameters<typeof enqueueProofSimulationRun>[1]) => enqueueProofSimulationRun(context.db, input)

  // -------------------------------------------------------------------------
  // GET /api/admin/batches/:batchId/curriculum-graph
  // -------------------------------------------------------------------------
  app.get('/api/admin/batches/:batchId/curriculum-graph', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId } = batchParamsSchema.parse(request.params)
    const result = await loadGraph(
      { repo, emitAudit },
      { batchId, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/draft
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/draft', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId } = batchParamsSchema.parse(request.params)
    const result = await saveDraft(
      { repo, emitAudit, now },
      { batchId, rawBody: request.body, actorRole: auth.activeRoleGrant.roleCode, actorFacultyId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/validate
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/validate', async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId } = batchParamsSchema.parse(request.params)
    const result = await validateGraphUseCase(
      { repo },
      { batchId, rawBody: request.body },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/publish
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/publish', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId } = batchParamsSchema.parse(request.params)
    const result = await publishGraph(
      {
        repo,
        emitAudit,
        now,
        resolveBatchPolicy: resolveBatchPolicyForBatch,
        resolveBatchCurriculumFeatures: resolveBatchFeaturesForBatch,
        enqueueProofSimulationRun: enqueueProofRun,
      },
      { batchId, actorRole: auth.activeRoleGrant.roleCode, actorFacultyId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/undo
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/undo', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId } = batchParamsSchema.parse(request.params)
    const result = await undoGraph(
      { repo, emitAudit, now },
      { batchId, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/redo
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/redo', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId } = batchParamsSchema.parse(request.params)
    const result = await redoGraph(
      { repo, emitAudit, now },
      { batchId, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/suggest
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/suggest', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId } = batchParamsSchema.parse(request.params)
    const result = await suggestLinks(
      { repo, now, buildCurriculumLinkageCandidates },
      { batchId, rawBody: request.body, actorFacultyId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/approve
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/approve', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId, suggestionId } = suggestionParamsSchema.parse(request.params)
    const result = await approveSuggestion(
      { repo, now },
      { batchId, suggestionId, actorFacultyId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/reject
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/reject', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const { batchId, suggestionId } = suggestionParamsSchema.parse(request.params)
    const result = await rejectSuggestion(
      { repo, now },
      { batchId, suggestionId, actorFacultyId: auth.facultyId },
    )
    return reply.status(result.status).send(result.body)
  })
}
