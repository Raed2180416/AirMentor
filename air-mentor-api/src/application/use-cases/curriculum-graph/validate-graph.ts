/**
 * POST /api/admin/batches/:batchId/curriculum-graph/validate — structurally
 * validate a supplied graph, or the active draft when none is supplied.
 */
import { parseJson } from '../../../lib/json.js'
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { UseCaseResponse } from './shared.js'
import { saveDraftBodySchema, validateGraph, type DraftEdge, type DraftNode } from './graph-domain.js'

export type ValidateGraphDeps = {
  repo: CurriculumGraphRepository
}

export type ValidateGraphInput = {
  batchId: string
  rawBody: unknown
}

export async function validateGraphUseCase(deps: ValidateGraphDeps, input: ValidateGraphInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId } = input

  const body = saveDraftBodySchema.partial().safeParse(input.rawBody)
  if (!body.success) {
    return { status: 400, body: { error: 'VALIDATION_ERROR', message: 'Invalid validate payload.', details: body.error.format() } }
  }

  const batch = await repo.getBatchById(batchId)
  if (!batch) return { status: 404, body: { error: 'NOT_FOUND', message: 'Batch not found' } }

  let nodes: DraftNode[]
  let edges: DraftEdge[]

  if (body.data.nodes && body.data.edges) {
    nodes = body.data.nodes
    edges = body.data.edges
  } else {
    const activeDraft = await repo.getActiveDraft(batchId)
    if (!activeDraft) {
      return { status: 400, body: { error: 'NO_DRAFT', message: 'No draft to validate. Save a draft first or provide nodes/edges in body.' } }
    }
    nodes = parseJson(activeDraft.draftNodesJson, [] as DraftNode[])
    edges = parseJson(activeDraft.draftEdgesJson, [] as DraftEdge[])
  }

  const validation = validateGraph(nodes, edges)
  return { status: 200, body: validation }
}
