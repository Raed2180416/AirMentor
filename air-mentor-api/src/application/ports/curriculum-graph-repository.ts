/**
 * Curriculum graph repository port.
 *
 * Framework-free interface for every DB access the curriculum-graph use-cases
 * need (batches, import versions, drafts, history, suggestions, node/edge
 * graph load + publish). MUST NOT import db/schema or drizzle-orm — the Drizzle
 * implementation lives under adapters/persistence (ESLint enforces this).
 */
import type { DraftEdge, DraftNode, TopicPartitions } from '../use-cases/curriculum-graph/graph-domain.js'

export type BatchRef = { batchId: string }

export type CurriculumImportRef = { curriculumImportVersionId: string }

export type GraphDraftRecord = {
  curriculumGraphDraftId: string
  baseCurriculumImportVersionId: string
  draftNodesJson: string
  draftEdgesJson: string
  draftTopicPartitionsJson: string
  draftBridgeModulesJson: string
  status: string
}

export type GraphHistoryRecord = {
  curriculumGraphHistoryId: string
  sequenceNumber: number
  isUndone: number
  commandType: string
  commandPayloadJson: string
  reversePayloadJson: string
}

export type GraphSuggestionRecord = {
  curriculumGraphSuggestionId: string
  targetCurriculumNodeId: string | null
  sourceCurriculumNodeId: string | null
  edgeKind: string
  rationale: string
  confidenceScaled: number
  sourcesJson: string
  status: string
}

export type LoadedGraph = {
  nodes: DraftNode[]
  edges: DraftEdge[]
  topicPartitions: Record<string, TopicPartitions>
  bridgeModules: Record<string, string[]>
}

export type InsertGraphDraftInput = {
  curriculumGraphDraftId: string
  batchId: string
  baseCurriculumImportVersionId: string
  nodes: DraftNode[]
  edges: DraftEdge[]
  now: string
}

export type InsertGraphHistoryInput = {
  batchId: string
  curriculumGraphDraftId: string
  commandType: string
  commandPayload: Record<string, unknown>
  reversePayload: Record<string, unknown>
  sequenceNumber: number
  actorFacultyId: string | null
  now: string
}

export type InsertGraphSuggestionInput = {
  batchId: string
  curriculumGraphDraftId: string | null
  targetCurriculumNodeId: string
  edgeKind: string
  rationale: string
  confidenceScaled: number
  sources: string[]
  actorFacultyId: string | null
  now: string
}

export type CreateImportVersionFromDraftInput = {
  batchId: string
  baseCurriculumImportVersionId: string
  nodes: DraftNode[]
  edges: DraftEdge[]
  actorFacultyId?: string | null
  now: string
}

export interface CurriculumGraphRepository {
  getBatchById(batchId: string): Promise<BatchRef | null>
  getLatestCurriculumImport(batchId: string): Promise<CurriculumImportRef | null>
  getActiveDraft(batchId: string): Promise<GraphDraftRecord | null>
  loadGraphFromImportVersion(curriculumImportVersionId: string): Promise<LoadedGraph>
  ensureGraphFromCurriculumCourses(batchId: string): Promise<CurriculumImportRef | null>

  getDraftHistory(draftId: string): Promise<GraphHistoryRecord[]>
  getDraftHistoryOrderedAsc(draftId: string): Promise<GraphHistoryRecord[]>
  getDraftHistoryOrderedDesc(draftId: string): Promise<GraphHistoryRecord[]>

  listPendingSuggestions(batchId: string): Promise<GraphSuggestionRecord[]>
  getSuggestionById(batchId: string, suggestionId: string): Promise<{ curriculumGraphSuggestionId: string } | null>
  updateSuggestionStatus(suggestionId: string, status: string, actorFacultyId: string | null, now: string): Promise<void>
  insertSuggestion(input: InsertGraphSuggestionInput): Promise<void>

  insertDraft(input: InsertGraphDraftInput): Promise<void>
  updateDraftGraph(draftId: string, nodes: DraftNode[], edges: DraftEdge[], now: string): Promise<void>
  insertHistoryEntry(input: InsertGraphHistoryInput): Promise<void>
  markDraftPublished(draftId: string, now: string): Promise<void>
  updateHistoryUndone(historyId: string, isUndone: number): Promise<void>

  createNewImportVersionFromDraft(input: CreateImportVersionFromDraftInput): Promise<{ newImportVersionId: string }>
}
