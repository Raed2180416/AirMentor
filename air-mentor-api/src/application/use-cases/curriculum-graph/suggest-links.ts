/**
 * POST /api/admin/batches/:batchId/curriculum-graph/suggest — build LLM/NLP
 * linkage candidates for the current graph and persist them as pending
 * suggestions. The candidate builder is injected (kept persistence-free); the
 * rows are inserted after candidates are built, preserving the legacy order.
 */
import { z } from 'zod'
import type { buildCurriculumLinkageCandidates } from '../../../lib/curriculum-linkage.js'
import { parseJson } from '../../../lib/json.js'
import type { CurriculumGraphRepository } from '../../ports/curriculum-graph-repository.js'
import type { UseCaseResponse } from './shared.js'
import type { DraftNode } from './graph-domain.js'

const suggestBodySchema = z.object({
  targetCurriculumNodeIds: z.array(z.string()).optional(),
})

export type SuggestLinksDeps = {
  repo: CurriculumGraphRepository
  now: () => string
  buildCurriculumLinkageCandidates: (input: Parameters<typeof buildCurriculumLinkageCandidates>[0]) => ReturnType<typeof buildCurriculumLinkageCandidates>
}

export type SuggestLinksInput = {
  batchId: string
  rawBody: unknown
  actorFacultyId: string | null
}

export async function suggestLinks(deps: SuggestLinksDeps, input: SuggestLinksInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const { batchId } = input

  const body = suggestBodySchema.safeParse(input.rawBody)
  if (!body.success) {
    return { status: 400, body: { error: 'VALIDATION_ERROR', message: 'Invalid suggest payload.', details: body.error.format() } }
  }

  const activeDraft = await repo.getActiveDraft(batchId)
  const latestImport = await repo.getLatestCurriculumImport(batchId)
  if (!latestImport) {
    return { status: 400, body: { error: 'NO_IMPORT', message: 'No curriculum import to suggest from.' } }
  }

  // Load current nodes as ResolvedFeatureLike for the linkage builder
  const { nodes } = activeDraft
    ? {
        nodes: parseJson(activeDraft.draftNodesJson, [] as DraftNode[]),
      }
    : await repo.loadGraphFromImportVersion(latestImport.curriculumImportVersionId)

  const items = nodes.map(node => ({
    curriculumCourseId: node.draftNodeId,
    semesterNumber: node.semesterNumber,
    courseCode: node.courseCode,
    title: node.title,
    outcomes: node.outcomes,
    prerequisites: [], // Current edges are loaded separately; linkage builder will infer
    bridgeModules: node.bridgeModules,
    topicPartitions: node.topicPartitions,
  }))

  const candidateResult = await deps.buildCurriculumLinkageCandidates({
    manifestKey: 'msruas-mnc-seed',
    items,
    targetCurriculumCourseIds: body.data.targetCurriculumNodeIds?.length ? body.data.targetCurriculumNodeIds : null,
  })

  const now = deps.now()
  const draftId = activeDraft?.curriculumGraphDraftId ?? null

  // Store suggestions in DB
  for (const candidate of candidateResult.items) {
    await repo.insertSuggestion({
      batchId,
      curriculumGraphDraftId: draftId,
      targetCurriculumNodeId: candidate.curriculumCourseId,
      edgeKind: candidate.edgeKind,
      rationale: candidate.rationale,
      confidenceScaled: candidate.confidenceScaled,
      sources: candidate.sources,
      actorFacultyId: input.actorFacultyId,
      now,
    })
  }

  return {
    status: 200,
    body: {
      ok: true,
      candidateCount: candidateResult.items.length,
      candidateGenerationStatus: candidateResult.candidateGenerationStatus,
    },
  }
}
