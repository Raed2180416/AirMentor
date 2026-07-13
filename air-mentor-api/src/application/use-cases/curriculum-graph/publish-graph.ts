/**
 * POST /api/admin/batches/:batchId/curriculum-graph/publish — validate the
 * active draft, materialise it as a new curriculum import version, mark the
 * draft published, then enqueue the proof simulation run.
 *
 * The external services (policy/feature resolution, proof-run enqueue) are
 * injected so this use-case stays persistence-free; the `import type`s below
 * are erased at build time and only pin the injected signatures.
 */
import type { resolveBatchCurriculumFeatures, resolveBatchPolicy } from '../../../modules/admin-structure.js'
import type { enqueueProofSimulationRun } from '../../../lib/proof-run-queue.js'
import { parseJson } from '../../../lib/json.js'
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { AuditEmitter, UseCaseResponse } from './shared.js'
import { readErrorMessage, validateGraph, type DraftEdge, type DraftNode } from './graph-domain.js'

export type PublishGraphDeps = {
  repo: CurriculumGraphRepository
  emitAudit: AuditEmitter
  now: () => string
  resolveBatchPolicy: (batchId: string) => ReturnType<typeof resolveBatchPolicy>
  resolveBatchCurriculumFeatures: (batchId: string) => ReturnType<typeof resolveBatchCurriculumFeatures>
  enqueueProofSimulationRun: (input: Parameters<typeof enqueueProofSimulationRun>[1]) => ReturnType<typeof enqueueProofSimulationRun>
}

export type PublishGraphInput = {
  batchId: string
  actorRole: string
  actorFacultyId: string | null
}

export async function publishGraph(deps: PublishGraphDeps, input: PublishGraphInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId, actorFacultyId } = input

  const batch = await repo.getBatchById(batchId)
  if (!batch) return { status: 404, body: { error: 'NOT_FOUND', message: 'Batch not found' } }

  const activeDraft = await repo.getActiveDraft(batchId)
  if (!activeDraft) {
    return { status: 400, body: { error: 'NO_DRAFT', message: 'No active draft to publish.' } }
  }

  const nodes = parseJson(activeDraft.draftNodesJson, [] as DraftNode[])
  const edges = parseJson(activeDraft.draftEdgesJson, [] as DraftEdge[])

  const validation = validateGraph(nodes, edges)
  if (!validation.valid) {
    return {
      status: 400,
      body: {
        error: 'VALIDATION_FAILED',
        message: 'Cannot publish a graph with validation errors.',
        validation,
      },
    }
  }

  const now = deps.now()

  try {
    const { newImportVersionId } = await repo.createNewImportVersionFromDraft({
      batchId,
      baseCurriculumImportVersionId: activeDraft.baseCurriculumImportVersionId,
      nodes,
      edges,
      actorFacultyId,
      now,
    })

    // Mark draft as published
    await repo.markDraftPublished(activeDraft.curriculumGraphDraftId, now)

    // Queue the ML validation simulation directly on publish
    const resolved = await deps.resolveBatchPolicy(batchId)
    const resolvedFeatures = await deps.resolveBatchCurriculumFeatures(batchId)

    const simulationRun = await deps.enqueueProofSimulationRun({
      batchId,
      curriculumImportVersionId: newImportVersionId,
      policy: resolved.effectivePolicy,
      curriculumFeatureProfileId: resolvedFeatures.primaryCurriculumFeatureProfileId,
      curriculumFeatureProfileFingerprint: resolvedFeatures.curriculumFeatureProfileFingerprint,
      now,
      runLabel: `Curriculum Adaptation Check (auto-publish)`,
    })

    deps.emitAudit({ entityType: 'curriculum_graph', entityId: activeDraft.curriculumGraphDraftId, action: 'publish', actorRole: input.actorRole, actorId: actorFacultyId, metadata: { batchId, newImportVersionId, simulationRunId: simulationRun.simulationRunId } })

    return {
      status: 200,
      body: {
        ok: true,
        newImportVersionId,
        validation,
        publishedAt: now,
      },
    }
  } catch (err: unknown) {
    return {
      status: 500,
      body: {
        error: 'PUBLISH_FAILED',
        message: readErrorMessage(err),
      },
    }
  }
}
