/**
 * GET /api/admin/batches/:batchId/curriculum-graph — load the graph bundle
 * (active draft if present, otherwise the latest published import version),
 * plus undo/redo state, pending suggestions, and structural validation.
 */
import { parseJson } from '../../../lib/json.js'
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { AuditEmitter, UseCaseResponse } from './shared.js'
import { validateGraph, type DraftEdge, type DraftNode } from './graph-domain.js'

export type LoadGraphDeps = {
  repo: CurriculumGraphRepository
  emitAudit: AuditEmitter
}

export type LoadGraphInput = {
  batchId: string
  actorRole: string
  actorId: string | null
}

export async function loadGraph(deps: LoadGraphDeps, input: LoadGraphInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId } = input

  const batch = await repo.getBatchById(batchId)
  if (!batch) return { status: 404, body: { error: 'NOT_FOUND', message: 'Batch not found' } }

  let latestImport = await repo.getLatestCurriculumImport(batchId)
  if (!latestImport) {
    const ensured = await repo.ensureGraphFromCurriculumCourses(batchId)
    if (!ensured) {
      return { status: 404, body: { error: 'NO_IMPORT', message: 'No curriculum import version found for this batch.' } }
    }
    latestImport = await repo.getLatestCurriculumImport(batchId)
  }

  const activeDraft = await repo.getActiveDraft(batchId)

  let nodes: DraftNode[]
  let edges: DraftEdge[]
  let topicPartitions: Record<string, DraftNode['topicPartitions']>
  let bridgeModulesMap: Record<string, string[]>

  if (activeDraft) {
    nodes = parseJson(activeDraft.draftNodesJson, [] as DraftNode[])
    edges = parseJson(activeDraft.draftEdgesJson, [] as DraftEdge[])
    topicPartitions = parseJson(activeDraft.draftTopicPartitionsJson, {} as Record<string, DraftNode['topicPartitions']>)
    bridgeModulesMap = parseJson(activeDraft.draftBridgeModulesJson, {} as Record<string, string[]>)
    // Merge topic partitions and bridge modules back into nodes
    for (const node of nodes) {
      node.topicPartitions = topicPartitions[node.draftNodeId] ?? node.topicPartitions
      node.bridgeModules = bridgeModulesMap[node.draftNodeId] ?? node.bridgeModules
    }
  } else {
    const loaded = await repo.loadGraphFromImportVersion(latestImport!.curriculumImportVersionId)
    nodes = loaded.nodes
    edges = loaded.edges
    topicPartitions = loaded.topicPartitions
    bridgeModulesMap = loaded.bridgeModules
  }

  // Load history for undo/redo state
  const historyRows = activeDraft
    ? await repo.getDraftHistoryOrderedAsc(activeDraft.curriculumGraphDraftId)
    : []

  const canUndo = historyRows.some(h => !h.isUndone)
  const canRedo = historyRows.some(h => h.isUndone)

  // Load pending suggestions
  const suggestionRows = await repo.listPendingSuggestions(batchId)

  const validation = validateGraph(nodes, edges)

  deps.emitAudit({ entityType: 'curriculum_graph', entityId: batchId, action: 'read', actorRole: input.actorRole, actorId: input.actorId, metadata: { batchId } })

  return {
    status: 200,
    body: {
      batchId,
      baseCurriculumImportVersionId: latestImport!.curriculumImportVersionId,
      draftStatus: activeDraft ? 'draft' : 'none',
      draftId: activeDraft?.curriculumGraphDraftId ?? null,
      nodes,
      edges,
      history: {
        canUndo,
        canRedo,
        eventCount: historyRows.length,
      },
      suggestions: suggestionRows.map(s => ({
        suggestionId: s.curriculumGraphSuggestionId,
        targetDraftNodeId: s.targetCurriculumNodeId,
        sourceDraftNodeId: s.sourceCurriculumNodeId,
        edgeKind: s.edgeKind,
        rationale: s.rationale,
        confidenceScaled: s.confidenceScaled,
        sources: parseJson(s.sourcesJson, [] as string[]),
        status: s.status,
      })),
      validation,
    },
  }
}
