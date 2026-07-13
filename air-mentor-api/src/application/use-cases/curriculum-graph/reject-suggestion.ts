/**
 * POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/reject
 * — mark a pending linkage suggestion as rejected.
 */
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { UseCaseResponse } from './shared.js'

export type RejectSuggestionDeps = {
  repo: CurriculumGraphRepository
  now: () => string
}

export type RejectSuggestionInput = {
  batchId: string
  suggestionId: string
  actorFacultyId: string | null
}

export async function rejectSuggestion(deps: RejectSuggestionDeps, input: RejectSuggestionInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId, suggestionId } = input

  const row = await repo.getSuggestionById(batchId, suggestionId)
  if (!row) return { status: 404, body: { error: 'NOT_FOUND', message: 'Suggestion not found' } }

  const now = deps.now()
  await repo.updateSuggestionStatus(suggestionId, 'rejected', input.actorFacultyId, now)

  return { status: 200, body: { ok: true, suggestionId, status: 'rejected' } }
}
