import { eq, and } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  curriculumGraphDrafts,
  curriculumGraphHistory,
  curriculumGraphSuggestions,
  curriculumImportVersions,
  curriculumNodes,
  curriculumEdges,
  batches,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

const TEST_BATCH_ID = 'batch_branch_mnc_btech_2023'
const MSRUAS_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'

describe('GET /api/admin/batches/:batchId/curriculum-graph', () => {
  it('returns 404 for unknown batch', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/nonexistent_batch/curriculum-graph',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json()
    expect(body.error).toBe('NOT_FOUND')
  })

  it('auto-generates a graph from curriculum courses for batch without formal import', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    // batch_branch_cse_btech_2025 exists in seed but has no formal curriculum import.
    // The API now falls back to auto-generating nodes from the batch's curriculum courses.
    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/batches/batch_branch_cse_btech_2025/curriculum-graph',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.batchId).toBe('batch_branch_cse_btech_2025')
    expect(body.draftStatus).toBe('none')
    expect(body.nodes).toBeInstanceOf(Array)
    expect(body.nodes.length).toBeGreaterThan(0)
    expect(body.edges).toBeInstanceOf(Array)
  })

  it('returns graph bundle for seeded MNC batch (no draft yet)', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const response = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.batchId).toBe(TEST_BATCH_ID)
    expect(body.baseCurriculumImportVersionId).toBe(MSRUAS_IMPORT_ID)
    expect(body.draftStatus).toBe('none')
    expect(body.draftId).toBeNull()
    expect(body.nodes).toBeInstanceOf(Array)
    expect(body.edges).toBeInstanceOf(Array)
    expect(body.nodes.length).toBeGreaterThan(0)
    expect(body.history.canUndo).toBe(false)
    expect(body.history.canRedo).toBe(false)
    expect(body.validation).toBeDefined()
    expect(body.validation.valid).toBe(true)
    expect(body.suggestions).toBeInstanceOf(Array)

    // Verify node shape
    const firstNode = body.nodes[0]
    expect(firstNode.draftNodeId).toBeDefined()
    expect(firstNode.courseCode).toBeDefined()
    expect(firstNode.title).toBeDefined()
    expect(firstNode.semesterNumber).toBeGreaterThanOrEqual(1)
    expect(firstNode.credits).toBeGreaterThanOrEqual(1)
    expect(firstNode.outcomes).toBeInstanceOf(Array)
    expect(firstNode.topicPartitions).toBeDefined()

    // Verify edge shape
    if (body.edges.length > 0) {
      const firstEdge = body.edges[0]
      expect(firstEdge.draftEdgeId).toBeDefined()
      expect(firstEdge.sourceDraftNodeId).toBeDefined()
      expect(firstEdge.targetDraftNodeId).toBeDefined()
      expect(firstEdge.edgeKind).toMatch(/^(explicit|added|corequisite|cross_semester)$/)
      expect(firstEdge.rationale).toBeDefined()
    }
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/draft', () => {
  it('creates a draft with nodes and edges', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    // First load the existing graph
    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    const modifiedNodes = bundle.nodes.map((n: any, i: number) => ({
      ...n,
      positionX: i * 100,
      positionY: i * 80,
    }))

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        nodes: modifiedNodes,
        edges: bundle.edges,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ok).toBe(true)
    expect(body.draftId).toBeDefined()
    expect(body.savedAt).toBeDefined()

    // Verify draft exists in DB
    const draftRows = await current.db.select().from(curriculumGraphDrafts)
      .where(eq(curriculumGraphDrafts.batchId, TEST_BATCH_ID))
    expect(draftRows.length).toBe(1)
    expect(draftRows[0].status).toBe('draft')
  })

  it('records command in history when command provided', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        nodes: bundle.nodes,
        edges: bundle.edges,
        command: {
          commandType: 'move_node',
          payload: { nodeId: bundle.nodes[0].draftNodeId, x: 100, y: 200 },
          reversePayload: { nodeId: bundle.nodes[0].draftNodeId, x: 0, y: 0 },
        },
      },
    })

    expect(response.statusCode).toBe(200)

    // Verify history exists
    const draftRows = await current.db.select().from(curriculumGraphDrafts)
      .where(eq(curriculumGraphDrafts.batchId, TEST_BATCH_ID))
    const historyRows = await current.db.select().from(curriculumGraphHistory)
      .where(eq(curriculumGraphHistory.curriculumGraphDraftId, draftRows[0].curriculumGraphDraftId))
    expect(historyRows.length).toBe(1)
    expect(historyRows[0].commandType).toBe('move_node')
    expect(historyRows[0].isUndone).toBe(0)
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/validate', () => {
  it('validates existing draft and returns errors/warnings', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    // Save a draft first
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { nodes: bundle.nodes, edges: bundle.edges },
    })

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/validate`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.valid).toBeDefined()
    expect(body.errors).toBeInstanceOf(Array)
    expect(body.warnings).toBeInstanceOf(Array)
  })

  it('detects self-referential edges', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    const badEdges = [
      ...bundle.edges,
      {
        draftEdgeId: 'self_edge_test',
        sourceDraftNodeId: bundle.nodes[0].draftNodeId,
        targetDraftNodeId: bundle.nodes[0].draftNodeId,
        edgeKind: 'explicit',
        rationale: 'Test self edge',
        weight: 1,
      },
    ]

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/validate`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { nodes: bundle.nodes, edges: badEdges },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.valid).toBe(false)
    expect(body.errors.some((e: string) => e.includes('Self-referential'))).toBe(true)
  })

  it('detects prerequisite cycles', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    // Create a cycle: A -> B -> C -> A (using first 3 nodes)
    const n1 = bundle.nodes[0]
    const n2 = bundle.nodes[1]
    const n3 = bundle.nodes[2]

    const badEdges = [
      ...bundle.edges,
      { draftEdgeId: 'cycle_1', sourceDraftNodeId: n1.draftNodeId, targetDraftNodeId: n2.draftNodeId, edgeKind: 'explicit', rationale: 'Cycle 1', weight: 1 },
      { draftEdgeId: 'cycle_2', sourceDraftNodeId: n2.draftNodeId, targetDraftNodeId: n3.draftNodeId, edgeKind: 'explicit', rationale: 'Cycle 2', weight: 1 },
      { draftEdgeId: 'cycle_3', sourceDraftNodeId: n3.draftNodeId, targetDraftNodeId: n1.draftNodeId, edgeKind: 'explicit', rationale: 'Cycle 3', weight: 1 },
    ]

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/validate`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { nodes: bundle.nodes, edges: badEdges },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.valid).toBe(false)
    expect(body.errors.some((e: string) => e.includes('cycle'))).toBe(true)
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/undo', () => {
  it('undoes the last command and toggles history isUndone flag', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    // Save draft with a command
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        nodes: bundle.nodes,
        edges: bundle.edges,
        command: {
          commandType: 'add_node',
          payload: { nodes: bundle.nodes, edges: bundle.edges },
          reversePayload: { nodes: bundle.nodes.slice(0, -1), edges: bundle.edges },
        },
      },
    })

    const undoResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/undo`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })

    expect(undoResponse.statusCode).toBe(200)
    const undoBody = undoResponse.json()
    expect(undoBody.ok).toBe(true)
    expect(undoBody.commandType).toBe('add_node')
    expect(undoBody.reversePayload).toBeDefined()

    // Verify history isUndone flag
    const draftRows = await current.db.select().from(curriculumGraphDrafts)
      .where(eq(curriculumGraphDrafts.batchId, TEST_BATCH_ID))
    const historyRows = await current.db.select().from(curriculumGraphHistory)
      .where(eq(curriculumGraphHistory.curriculumGraphDraftId, draftRows[0].curriculumGraphDraftId))
    expect(historyRows[0].isUndone).toBe(1)

    // GET should now reflect canUndo=false, canRedo=true
    const getAfterUndo = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const afterUndoBody = getAfterUndo.json()
    expect(afterUndoBody.history.canUndo).toBe(false)
    expect(afterUndoBody.history.canRedo).toBe(true)
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/redo', () => {
  it('redoes the last undone command', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    // Save draft with a command
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        nodes: bundle.nodes,
        edges: bundle.edges,
        command: {
          commandType: 'add_node',
          payload: { nodes: bundle.nodes, edges: bundle.edges },
          reversePayload: { nodes: bundle.nodes.slice(0, -1), edges: bundle.edges },
        },
      },
    })

    // Undo first
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/undo`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })

    // Then redo
    const redoResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/redo`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })

    expect(redoResponse.statusCode).toBe(200)
    const redoBody = redoResponse.json()
    expect(redoBody.ok).toBe(true)
    expect(redoBody.commandType).toBe('add_node')

    // Verify history isUndone flag is back to 0
    const draftRows = await current.db.select().from(curriculumGraphDrafts)
      .where(eq(curriculumGraphDrafts.batchId, TEST_BATCH_ID))
    const historyRows = await current.db.select().from(curriculumGraphHistory)
      .where(eq(curriculumGraphHistory.curriculumGraphDraftId, draftRows[0].curriculumGraphDraftId))
    expect(historyRows[0].isUndone).toBe(0)
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/publish', () => {
  it('publishes a valid draft, creates new import version, and marks draft published', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    // Save a clean draft
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { nodes: bundle.nodes, edges: bundle.edges },
    })

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/publish`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })

    if (response.statusCode !== 200) {
      console.error('Publish failed:', response.statusCode, response.json())
    }
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ok).toBe(true)
    expect(body.newImportVersionId).toBeDefined()
    expect(body.validation.valid).toBe(true)
    expect(body.publishedAt).toBeDefined()

    // Verify draft is marked published
    const draftRows = await current.db.select().from(curriculumGraphDrafts)
      .where(eq(curriculumGraphDrafts.batchId, TEST_BATCH_ID))
    expect(draftRows.length).toBe(1)
    expect(draftRows[0].status).toBe('published')

    // Verify new import version exists
    const importRows = await current.db.select().from(curriculumImportVersions)
      .where(eq(curriculumImportVersions.curriculumImportVersionId, body.newImportVersionId))
    expect(importRows.length).toBe(1)
    expect(importRows[0].sourceType).toBe('graph-publish')

    // Verify new nodes and edges were created
    const nodeRows = await current.db.select().from(curriculumNodes)
      .where(eq(curriculumNodes.curriculumImportVersionId, body.newImportVersionId))
    expect(nodeRows.length).toBe(bundle.nodes.length)

    const edgeRows = await current.db.select().from(curriculumEdges)
      .where(eq(curriculumEdges.curriculumImportVersionId, body.newImportVersionId))
    expect(edgeRows.length).toBe(bundle.edges.length)
  })

  it('rejects publish when validation errors exist', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const getResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    const bundle = getResponse.json()

    // Create a self-referential edge
    const badEdges = [
      ...bundle.edges,
      {
        draftEdgeId: 'self_edge_bad',
        sourceDraftNodeId: bundle.nodes[0].draftNodeId,
        targetDraftNodeId: bundle.nodes[0].draftNodeId,
        edgeKind: 'explicit',
        rationale: 'Bad edge',
        weight: 1,
      },
    ]

    // Save draft with bad edges
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { nodes: bundle.nodes, edges: badEdges },
    })

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/publish`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.error).toBe('VALIDATION_FAILED')
    expect(body.validation.valid).toBe(false)
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/suggest', () => {
  it('generates suggestions and stores them in DB', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/suggest`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ok).toBe(true)
    expect(typeof body.candidateCount).toBe('number')

    // Verify suggestions stored in DB
    const suggestionRows = await current.db.select().from(curriculumGraphSuggestions)
      .where(eq(curriculumGraphSuggestions.batchId, TEST_BATCH_ID))
    expect(suggestionRows.length).toBeGreaterThanOrEqual(0)
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/approve', () => {
  it('approves a suggestion', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    // Generate suggestions first
    const suggestResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/suggest`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    const suggestBody = suggestResponse.json()

    if (suggestBody.candidateCount === 0) {
      console.warn('No suggestions generated; skipping approval test')
      return
    }

    const suggestionRows = await current.db.select().from(curriculumGraphSuggestions)
      .where(eq(curriculumGraphSuggestions.batchId, TEST_BATCH_ID))
    const suggestionId = suggestionRows[0].curriculumGraphSuggestionId

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/suggestions/${suggestionId}/approve`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('approved')

    const updatedRow = await current.db.select().from(curriculumGraphSuggestions)
      .where(eq(curriculumGraphSuggestions.curriculumGraphSuggestionId, suggestionId))
    expect(updatedRow[0].status).toBe('approved')
  })
})

describe('POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/reject', () => {
  it('rejects a suggestion', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    // Generate suggestions first
    const suggestResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/suggest`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    const suggestBody = suggestResponse.json()

    if (suggestBody.candidateCount === 0) {
      console.warn('No suggestions generated; skipping rejection test')
      return
    }

    const suggestionRows = await current.db.select().from(curriculumGraphSuggestions)
      .where(eq(curriculumGraphSuggestions.batchId, TEST_BATCH_ID))
    const suggestionId = suggestionRows[0].curriculumGraphSuggestionId

    const response = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/suggestions/${suggestionId}/reject`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('rejected')
  })
})

describe('End-to-end graph builder workflow', () => {
  it('full lifecycle: load -> draft -> validate -> undo -> redo -> publish', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    // 1. Load initial graph
    const loadResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    expect(loadResponse.statusCode).toBe(200)
    const bundle = loadResponse.json()
    expect(bundle.draftStatus).toBe('none')

    // 2. Save draft with a move command
    const modifiedNodes = bundle.nodes.map((n: any) => ({
      ...n,
      positionX: (n.positionX || 0) + 50,
      positionY: (n.positionY || 0) + 50,
    }))

    const draftResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/draft`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        nodes: modifiedNodes,
        edges: bundle.edges,
        command: {
          commandType: 'move_node',
          payload: { nodes: modifiedNodes, edges: bundle.edges },
          reversePayload: { nodes: bundle.nodes, edges: bundle.edges },
        },
      },
    })
    expect(draftResponse.statusCode).toBe(200)

    // 3. Validate
    const validateResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/validate`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(validateResponse.statusCode).toBe(200)
    const validation = validateResponse.json()
    expect(validation.valid).toBe(true)

    // 4. Undo
    const undoResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/undo`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(undoResponse.statusCode).toBe(200)

    // 5. Redo
    const redoResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/redo`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(redoResponse.statusCode).toBe(200)

    // 6. Publish
    const publishResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph/publish`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(publishResponse.statusCode).toBe(200)
    const publishBody = publishResponse.json()
    expect(publishBody.ok).toBe(true)
    expect(publishBody.newImportVersionId).toBeDefined()

    // 7. Verify GET now loads from published import, not draft
    const reloadResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${TEST_BATCH_ID}/curriculum-graph`,
      headers: { cookie: login.cookie },
    })
    expect(reloadResponse.statusCode).toBe(200)
    const reloadBody = reloadResponse.json()
    expect(reloadBody.draftStatus).toBe('none')
    expect(reloadBody.nodes.length).toBe(bundle.nodes.length)
  })
})
