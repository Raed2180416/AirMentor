/**
 * POST /api/admin/batches/:batchId/curriculum-graph/undo — restore the draft to
 * the reverse snapshot of the most recent not-yet-undone history command.
 */
import { parseJson } from '../../../lib/json.js'
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { AuditEmitter, UseCaseResponse } from './shared.js'
import { parseDraftGraphPayload } from './graph-domain.js'

export type UndoGraphDeps = {
  repo: CurriculumGraphRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type UndoGraphInput = {
  batchId: string
  actorRole: string
  actorId: string | null
}

export async function undoGraph(deps: UndoGraphDeps, input: UndoGraphInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId } = input

  const activeDraft = await repo.getActiveDraft(batchId)
  if (!activeDraft) {
    return { status: 400, body: { error: 'NO_DRAFT', message: 'No active draft.' } }
  }

  const historyRows = await repo.getDraftHistoryOrderedDesc(activeDraft.curriculumGraphDraftId)

  const target = historyRows.find(h => !h.isUndone)
  if (!target) {
    return { status: 400, body: { error: 'NO_UNDO', message: 'Nothing to undo.' } }
  }

  const reversePayload = parseJson(target.reversePayloadJson, {} as Record<string, unknown>)
  const reverseGraph = parseDraftGraphPayload(reversePayload)
  if (!reverseGraph) {
    return { status: 400, body: { error: 'INVALID_UNDO_PAYLOAD', message: 'Undo payload cannot restore a graph snapshot.' } }
  }

  await repo.updateDraftGraph(activeDraft.curriculumGraphDraftId, reverseGraph.nodes, reverseGraph.edges, deps.now())

  await repo.updateHistoryUndone(target.curriculumGraphHistoryId, 1)

  deps.emitAudit({ entityType: 'curriculum_graph', entityId: activeDraft.curriculumGraphDraftId, action: 'undo', actorRole: input.actorRole, actorId: input.actorId, metadata: { batchId, commandType: target.commandType } })

  return {
    status: 200,
    body: {
      ok: true,
      reversePayload,
      commandType: target.commandType,
    },
  }
}
