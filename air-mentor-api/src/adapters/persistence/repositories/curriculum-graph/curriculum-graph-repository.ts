/**
 * Drizzle implementation of the CurriculumGraphRepository port.
 *
 * Composition point for the curriculum-graph data access. The larger read/write
 * paths (graph load, publish import version, auto-seed) live in sibling files to
 * respect the 400-line architecture cap; every query here is moved verbatim from
 * modules/curriculum-graph-routes.ts (`context.db` -> injected `db`).
 */
import { and, desc, eq } from 'drizzle-orm'
import {
  batches,
  curriculumGraphDrafts,
  curriculumGraphHistory,
  curriculumGraphSuggestions,
  curriculumImportVersions,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import { extractDraftNodeMetadata } from '../../../../application/use-cases/curriculum-graph/graph-domain.js'
import type { CurriculumGraphRepository } from '../../../../application/ports/curriculum-graph-repository.js'
import { loadGraphFromImportVersion } from './load-graph-from-import.js'
import { ensureGraphFromCurriculumCourses } from './ensure-graph-from-courses.js'
import { createNewImportVersionFromDraft } from './publish-import-version.js'

export function createCurriculumGraphRepository(db: AppDb): CurriculumGraphRepository {
  return {
    async getBatchById(batchId) {
      const [batch] = await db.select().from(batches).where(eq(batches.batchId, batchId))
      return batch ?? null
    },

    getLatestCurriculumImport(batchId) {
      return db.select().from(curriculumImportVersions)
        .where(eq(curriculumImportVersions.batchId, batchId))
        .then(rows => rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt))[0] ?? null)
    },

    async getActiveDraft(batchId) {
      const rows = await db.select().from(curriculumGraphDrafts)
        .where(and(
          eq(curriculumGraphDrafts.batchId, batchId),
          eq(curriculumGraphDrafts.status, 'draft'),
        ))
        .orderBy(desc(curriculumGraphDrafts.updatedAt))
      return rows[0] ?? null
    },

    loadGraphFromImportVersion(curriculumImportVersionId) {
      return loadGraphFromImportVersion(db, curriculumImportVersionId)
    },

    ensureGraphFromCurriculumCourses(batchId) {
      return ensureGraphFromCurriculumCourses(db, batchId)
    },

    getDraftHistory(draftId) {
      return db.select().from(curriculumGraphHistory)
        .where(eq(curriculumGraphHistory.curriculumGraphDraftId, draftId))
    },

    getDraftHistoryOrderedAsc(draftId) {
      return db.select().from(curriculumGraphHistory)
        .where(eq(curriculumGraphHistory.curriculumGraphDraftId, draftId))
        .orderBy(curriculumGraphHistory.sequenceNumber)
    },

    getDraftHistoryOrderedDesc(draftId) {
      return db.select().from(curriculumGraphHistory)
        .where(eq(curriculumGraphHistory.curriculumGraphDraftId, draftId))
        .orderBy(desc(curriculumGraphHistory.sequenceNumber))
    },

    listPendingSuggestions(batchId) {
      return db.select().from(curriculumGraphSuggestions)
        .where(and(
          eq(curriculumGraphSuggestions.batchId, batchId),
          eq(curriculumGraphSuggestions.status, 'pending'),
        ))
    },

    async getSuggestionById(batchId, suggestionId) {
      const [row] = await db.select().from(curriculumGraphSuggestions)
        .where(and(
          eq(curriculumGraphSuggestions.curriculumGraphSuggestionId, suggestionId),
          eq(curriculumGraphSuggestions.batchId, batchId),
        ))
      return row ?? null
    },

    async updateSuggestionStatus(suggestionId, status, actorFacultyId, now) {
      await db.update(curriculumGraphSuggestions).set({
        status,
        actorFacultyId,
        updatedAt: now,
      }).where(eq(curriculumGraphSuggestions.curriculumGraphSuggestionId, suggestionId))
    },

    async insertSuggestion(input) {
      await db.insert(curriculumGraphSuggestions).values({
        curriculumGraphSuggestionId: createId('graph_suggestion'),
        batchId: input.batchId,
        curriculumGraphDraftId: input.curriculumGraphDraftId,
        targetCurriculumNodeId: input.targetCurriculumNodeId,
        sourceCurriculumNodeId: null, // We only store course codes, not node IDs here
        edgeKind: input.edgeKind,
        rationale: input.rationale,
        confidenceScaled: input.confidenceScaled,
        sourcesJson: stringifyJson(input.sources),
        status: 'pending',
        actorFacultyId: input.actorFacultyId,
        createdAt: input.now,
        updatedAt: input.now,
      })
    },

    async insertDraft(input) {
      const { topicPartitions, bridgeModulesMap } = extractDraftNodeMetadata(input.nodes)
      await db.insert(curriculumGraphDrafts).values({
        curriculumGraphDraftId: input.curriculumGraphDraftId,
        batchId: input.batchId,
        baseCurriculumImportVersionId: input.baseCurriculumImportVersionId,
        draftNodesJson: stringifyJson(input.nodes),
        draftEdgesJson: stringifyJson(input.edges),
        draftTopicPartitionsJson: stringifyJson(topicPartitions),
        draftBridgeModulesJson: stringifyJson(bridgeModulesMap),
        status: 'draft',
        createdAt: input.now,
        updatedAt: input.now,
      })
    },

    async updateDraftGraph(draftId, nodes, edges, now) {
      const { topicPartitions, bridgeModulesMap } = extractDraftNodeMetadata(nodes)
      await db.update(curriculumGraphDrafts).set({
        draftNodesJson: stringifyJson(nodes),
        draftEdgesJson: stringifyJson(edges),
        draftTopicPartitionsJson: stringifyJson(topicPartitions),
        draftBridgeModulesJson: stringifyJson(bridgeModulesMap),
        updatedAt: now,
      }).where(eq(curriculumGraphDrafts.curriculumGraphDraftId, draftId))
    },

    async insertHistoryEntry(input) {
      await db.insert(curriculumGraphHistory).values({
        curriculumGraphHistoryId: createId('graph_history'),
        batchId: input.batchId,
        curriculumGraphDraftId: input.curriculumGraphDraftId,
        commandType: input.commandType,
        commandPayloadJson: stringifyJson(input.commandPayload),
        reversePayloadJson: stringifyJson(input.reversePayload),
        sequenceNumber: input.sequenceNumber,
        isUndone: 0,
        actorFacultyId: input.actorFacultyId,
        createdAt: input.now,
      })
    },

    async markDraftPublished(draftId, now) {
      await db.update(curriculumGraphDrafts).set({
        status: 'published',
        updatedAt: now,
      }).where(eq(curriculumGraphDrafts.curriculumGraphDraftId, draftId))
    },

    async updateHistoryUndone(historyId, isUndone) {
      await db.update(curriculumGraphHistory).set({ isUndone })
        .where(eq(curriculumGraphHistory.curriculumGraphHistoryId, historyId))
    },

    createNewImportVersionFromDraft(input) {
      return createNewImportVersionFromDraft(db, input)
    },
  }
}
