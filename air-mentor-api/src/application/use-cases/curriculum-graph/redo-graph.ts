/**
 * POST /api/admin/batches/:batchId/curriculum-graph/redo — re-apply the forward
 * snapshot of the earliest undone history command.
 */
import { parseJson } from '../../../lib/json.js'
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { AuditEmitter, UseCaseResponse } from './shared.js'
import { parseDraftGraphPayload } from './graph-domain.js'

export type RedoGraphDeps = {
  repo: CurriculumGraphRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type RedoGraphInput = {
  batchId: string
  actorRole: string
  actorId: string | null
}

export async function redoGraph(deps: RedoGraphDeps, input: RedoGraphInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId } = input

  const activeDraft = await repo.getActiveDraft(batchId)
  if (!activeDraft) {
    return { status: 400, body: { error: 'NO_DRAFT', message: 'No active draft.' } }
  }

  const historyRows = await repo.getDraftHistoryOrderedAsc(activeDraft.curriculumGraphDraftId)

  const target = historyRows.find(h => h.isUndone)
  if (!target) {
    return { status: 400, body: { error: 'NO_REDO', message: 'Nothing to redo.' } }
  }

  const forwardPayload = parseJson(target.commandPayloadJson, {} as Record<string, unknown>)
  const forwardGraph = parseDraftGraphPayload(forwardPayload)
  if (!forwardGraph) {
    return { status: 400, body: { error: 'INVALID_REDO_PAYLOAD', message: 'Redo payload cannot restore a graph snapshot.' } }
  }

  await repo.updateDraftGraph(activeDraft.curriculumGraphDraftId, forwardGraph.nodes, forwardGraph.edges, deps.now())

  await repo.updateHistoryUndone(target.curriculumGraphHistoryId, 0)

  deps.emitAudit({ entityType: 'curriculum_graph', entityId: activeDraft.curriculumGraphDraftId, action: 'redo', actorRole: input.actorRole, actorId: input.actorId, metadata: { batchId, commandType: target.commandType } })

  return {
    status: 200,
    body: {
      ok: true,
      forwardPayload,
      commandType: target.commandType,
    },
  }
}
