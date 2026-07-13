/**
 * POST /api/admin/batches/:batchId/curriculum-graph/draft — upsert the active
 * draft graph and, when a command is supplied, append it to durable history.
 */
import { createId } from '../../../lib/ids.js'
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { AuditEmitter, UseCaseResponse } from './shared.js'
import { saveDraftBodySchema } from './graph-domain.js'

export type SaveDraftDeps = {
  repo: CurriculumGraphRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type SaveDraftInput = {
  batchId: string
  rawBody: unknown
  actorRole: string
  actorFacultyId: string | null
}

export async function saveDraft(deps: SaveDraftDeps, input: SaveDraftInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId, actorFacultyId } = input

  const body = saveDraftBodySchema.safeParse(input.rawBody)
  if (!body.success) {
    return { status: 400, body: { error: 'VALIDATION_ERROR', message: 'Invalid draft payload.', details: body.error.format() } }
  }

  const batch = await repo.getBatchById(batchId)
  if (!batch) return { status: 404, body: { error: 'NOT_FOUND', message: 'Batch not found' } }

  const latestImport = await repo.getLatestCurriculumImport(batchId)
  if (!latestImport) {
    return { status: 400, body: { error: 'NO_IMPORT', message: 'No curriculum import version to base draft on.' } }
  }

  const now = deps.now()
  const { nodes, edges, command } = body.data

  // Upsert draft
  const existingDraft = await repo.getActiveDraft(batchId)
  let draftId: string
  let nextSequence = 1

  if (existingDraft) {
    draftId = existingDraft.curriculumGraphDraftId
    const historyRows = await repo.getDraftHistory(draftId)
    nextSequence = historyRows.length > 0 ? Math.max(...historyRows.map(h => h.sequenceNumber)) + 1 : 1

    await repo.updateDraftGraph(draftId, nodes, edges, now)
  } else {
    draftId = createId('graph_draft')
    await repo.insertDraft({
      curriculumGraphDraftId: draftId,
      batchId,
      baseCurriculumImportVersionId: latestImport.curriculumImportVersionId,
      nodes,
      edges,
      now,
    })
  }

  // Record command in history if provided
  if (command) {
    await repo.insertHistoryEntry({
      batchId,
      curriculumGraphDraftId: draftId,
      commandType: command.commandType,
      commandPayload: command.payload,
      reversePayload: command.reversePayload,
      sequenceNumber: nextSequence,
      actorFacultyId,
      now,
    })
  }

  deps.emitAudit({ entityType: 'curriculum_graph', entityId: draftId, action: 'draft.saved', actorRole: input.actorRole, actorId: actorFacultyId, metadata: { batchId } })

  return { status: 200, body: { ok: true, draftId, savedAt: now } }
}
