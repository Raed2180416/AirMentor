/**
 * POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/approve
 * — mark a pending linkage suggestion as approved.
 */
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { UseCaseResponse } from './shared.js'

export type ApproveSuggestionDeps = {
  repo: CurriculumGraphRepository
  now: () => string
}

export type ApproveSuggestionInput = {
  batchId: string
  suggestionId: string
  actorFacultyId: string | null
}

export async function approveSuggestion(deps: ApproveSuggestionDeps, input: ApproveSuggestionInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId, suggestionId } = input

  const row = await repo.getSuggestionById(batchId, suggestionId)
  if (!row) return { status: 404, body: { error: 'NOT_FOUND', message: 'Suggestion not found' } }

  const now = deps.now()
  await repo.updateSuggestionStatus(suggestionId, 'approved', input.actorFacultyId, now)

  return { status: 200, body: { ok: true, suggestionId, status: 'approved' } }
}
