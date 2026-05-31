// @ts-nocheck
/**
 * Curriculum Graph Routes — backend-backed graph builder with draft/publish,
 * durable undo/redo, validation, and LLM suggestion approval.
 *
 * Endpoints:
 *   GET    /api/admin/batches/:batchId/curriculum-graph
 *   POST   /api/admin/batches/:batchId/curriculum-graph/draft
 *   POST   /api/admin/batches/:batchId/curriculum-graph/validate
 *   POST   /api/admin/batches/:batchId/curriculum-graph/publish
 *   POST   /api/admin/batches/:batchId/curriculum-graph/undo
 *   POST   /api/admin/batches/:batchId/curriculum-graph/redo
 *   POST   /api/admin/batches/:batchId/curriculum-graph/suggest
 */
import { and, desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  batches,
  bridgeModules,
  courseTopicPartitions,
  curriculumEdges,
  curriculumGraphDrafts,
  curriculumGraphHistory,
  curriculumGraphSuggestions,
  curriculumImportVersions,
  curriculumNodes,
} from '../db/schema.js'
import { notFound } from '../lib/http-errors.js'
import { createId } from '../lib/ids.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import { emitAuditEvent, requireRole } from './support.js'
import {
  resolveBatchCurriculumFeatures,
  resolveBatchPolicy,
} from './admin-structure.js'
import { enqueueProofSimulationRun } from '../lib/proof-run-queue.js'
import {
  buildCompletenessCertificate,
  buildCurriculumOutputChecksum,
  validateCompiledCurriculum,
  type CompiledCurriculumWorkbook,
} from '../lib/msruas-curriculum-compiler.js'
import { buildCurriculumLinkageCandidates } from '../lib/curriculum-linkage.js'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const draftNodeSchema = z.object({
  draftNodeId: z.string().min(1),
  baseCurriculumNodeId: z.string().nullable().optional(),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  semesterNumber: z.number().int().min(1).max(20),
  credits: z.number().int().min(1).max(30),
  positionX: z.number(),
  positionY: z.number(),
  assessmentProfile: z.string().min(1).default('theory_heavy'),
  outcomes: z.array(z.object({
    id: z.string().min(1),
    desc: z.string().min(1),
    bloom: z.string().min(1),
  })).default([]),
  bridgeModules: z.array(z.string()).default([]),
  topicPartitions: z.object({
    tt1: z.array(z.string()).default([]),
    tt2: z.array(z.string()).default([]),
    see: z.array(z.string()).default([]),
    workbook: z.array(z.string()).default([]),
  }).default({ tt1: [], tt2: [], see: [], workbook: [] }),
})

const draftEdgeSchema = z.object({
  draftEdgeId: z.string().min(1),
  baseCurriculumEdgeId: z.string().nullable().optional(),
  sourceDraftNodeId: z.string().min(1),
  targetDraftNodeId: z.string().min(1),
  edgeKind: z.enum(['explicit', 'added', 'corequisite', 'cross_semester']),
  rationale: z.string().min(1),
  weight: z.number().min(0).max(10).default(1),
  sourceOutcomeId: z.string().nullable().optional(),
  targetOutcomeId: z.string().nullable().optional(),
})

const graphCommandSchema = z.object({
  commandType: z.enum([
    'add_node',
    'remove_node',
    'move_node',
    'edit_node',
    'add_edge',
    'remove_edge',
    'edit_edge',
    'replace_graph',
  ]),
  payload: z.record(z.string(), z.unknown()),
  reversePayload: z.record(z.string(), z.unknown()),
})

const saveDraftBodySchema = z.object({
  nodes: z.array(draftNodeSchema).min(1),
  edges: z.array(draftEdgeSchema),
  command: graphCommandSchema.optional(),
})

const batchParamsSchema = z.object({
  batchId: z.string().min(1),
})

const suggestionParamsSchema = z.object({
  batchId: z.string().min(1),
  suggestionId: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DraftNode = z.infer<typeof draftNodeSchema>
type DraftEdge = z.infer<typeof draftEdgeSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLatestCurriculumImport(context: RouteContext, batchId: string) {
  return context.db.select().from(curriculumImportVersions)
    .where(eq(curriculumImportVersions.batchId, batchId))
    .then(rows => rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt))[0] ?? null)
}

async function getActiveDraft(context: RouteContext, batchId: string) {
  const rows = await context.db.select().from(curriculumGraphDrafts)
    .where(and(
      eq(curriculumGraphDrafts.batchId, batchId),
      eq(curriculumGraphDrafts.status, 'draft'),
    ))
    .orderBy(desc(curriculumGraphDrafts.updatedAt))
  return rows[0] ?? null
}

function mapDbNodeToDraft(node: typeof curriculumNodes.$inferSelect): DraftNode {
  return {
    draftNodeId: node.curriculumNodeId,
    baseCurriculumNodeId: node.curriculumNodeId,
    courseCode: node.courseCode,
    title: node.title,
    semesterNumber: node.semesterNumber,
    credits: node.credits,
    positionX: 0,
    positionY: 0,
    assessmentProfile: node.assessmentProfile,
    outcomes: [],
    bridgeModules: [],
    topicPartitions: { tt1: [], tt2: [], see: [], workbook: [] },
  }
}

function mapDbEdgeToDraft(edge: typeof curriculumEdges.$inferSelect): DraftEdge {
  return {
    draftEdgeId: edge.curriculumEdgeId,
    baseCurriculumEdgeId: edge.curriculumEdgeId,
    sourceDraftNodeId: edge.sourceCurriculumNodeId,
    targetDraftNodeId: edge.targetCurriculumNodeId,
    edgeKind: edge.edgeKind as DraftEdge['edgeKind'],
    rationale: edge.rationale,
    weight: edge.weight,
    sourceOutcomeId: edge.sourceOutcomeId,
    targetOutcomeId: edge.targetOutcomeId,
  }
}

async function loadGraphFromImportVersion(
  context: RouteContext,
  curriculumImportVersionId: string,
): Promise<{ nodes: DraftNode[]; edges: DraftEdge[]; topicPartitions: Record<string, { tt1: string[]; tt2: string[]; see: string[]; workbook: string[] }>; bridgeModules: Record<string, string[]> }> {
  const [nodeRows, edgeRows, partitionRows, bridgeRows] = await Promise.all([
    context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, curriculumImportVersionId)),
    context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, curriculumImportVersionId)),
    context.db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, curriculumImportVersionId)),
    context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, curriculumImportVersionId)),
  ])

  const activeNodes = nodeRows.filter(n => n.status === 'active')
  const activeEdges = edgeRows.filter(e => e.status === 'active')

  const nodeMap = new Map(activeNodes.map(n => [n.curriculumNodeId, mapDbNodeToDraft(n)]))

  // Attach topic partitions
  const topicPartitions: Record<string, { tt1: string[]; tt2: string[]; see: string[]; workbook: string[] }> = {}
  for (const pr of partitionRows) {
    if (!nodeMap.has(pr.curriculumNodeId)) continue
    const entry = topicPartitions[pr.curriculumNodeId] ?? { tt1: [], tt2: [], see: [], workbook: [] }
    const topics = parseJson(pr.topicsJson, [] as string[])
    if (pr.partitionKind === 'tt1') entry.tt1 = topics
    else if (pr.partitionKind === 'tt2') entry.tt2 = topics
    else if (pr.partitionKind === 'see') entry.see = topics
    else if (pr.partitionKind === 'workbook') entry.workbook = topics
    topicPartitions[pr.curriculumNodeId] = entry
  }

  // Attach bridge modules
  const bridgeModuleMap: Record<string, string[]> = {}
  for (const br of bridgeRows) {
    if (!nodeMap.has(br.curriculumNodeId)) continue
    bridgeModuleMap[br.curriculumNodeId] = parseJson(br.moduleTitlesJson, [] as string[])
  }

  // Attach outcomes (from course_outcome_overrides is too complex here; keep empty for now)
  for (const n of activeNodes) {
    const draftNode = nodeMap.get(n.curriculumNodeId)
    if (!draftNode) continue
    draftNode.topicPartitions = topicPartitions[n.curriculumNodeId] ?? { tt1: [], tt2: [], see: [], workbook: [] }
    draftNode.bridgeModules = bridgeModuleMap[n.curriculumNodeId] ?? []
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: activeEdges.map(mapDbEdgeToDraft),
    topicPartitions,
    bridgeModules: bridgeModuleMap,
  }
}

function validateGraph(nodes: DraftNode[], edges: DraftEdge[]) {
  const errors: string[] = []
  const warnings: string[] = []

  const nodeIdSet = new Set(nodes.map(n => n.draftNodeId))
  const nodeById = new Map(nodes.map(n => [n.draftNodeId, n]))

  // Self-edge check
  for (const edge of edges) {
    if (edge.sourceDraftNodeId === edge.targetDraftNodeId) {
      errors.push(`Self-referential edge detected: ${edge.draftEdgeId} connects ${edge.sourceDraftNodeId} to itself.`)
    }
    if (!nodeIdSet.has(edge.sourceDraftNodeId)) {
      errors.push(`Edge ${edge.draftEdgeId} references missing source node ${edge.sourceDraftNodeId}.`)
    }
    if (!nodeIdSet.has(edge.targetDraftNodeId)) {
      errors.push(`Edge ${edge.draftEdgeId} references missing target node ${edge.targetDraftNodeId}.`)
    }
  }

  // Duplicate edge check
  const edgeKeySet = new Set<string>()
  for (const edge of edges) {
    const key = `${edge.sourceDraftNodeId}::${edge.targetDraftNodeId}::${edge.edgeKind}`
    if (edgeKeySet.has(key)) {
      errors.push(`Duplicate ${edge.edgeKind} edge from ${edge.sourceDraftNodeId} to ${edge.targetDraftNodeId}.`)
    }
    edgeKeySet.add(key)
  }

  // Semester order check for prerequisites
  for (const edge of edges) {
    if (edge.edgeKind !== 'explicit' && edge.edgeKind !== 'added') continue
    const source = nodeById.get(edge.sourceDraftNodeId)
    const target = nodeById.get(edge.targetDraftNodeId)
    if (!source || !target) continue
    if (source.semesterNumber >= target.semesterNumber) {
      errors.push(`Prerequisite edge ${edge.draftEdgeId} violates semester order: ${source.courseCode} (sem ${source.semesterNumber}) cannot precede ${target.courseCode} (sem ${target.semesterNumber}).`)
    }
  }

  // Cycle detection
  const prerequisiteAdj = new Map<string, string[]>()
  for (const node of nodes) {
    prerequisiteAdj.set(node.draftNodeId, [])
  }
  for (const edge of edges) {
    if (edge.edgeKind !== 'explicit' && edge.edgeKind !== 'added') continue
    const list = prerequisiteAdj.get(edge.targetDraftNodeId) ?? []
    list.push(edge.sourceDraftNodeId)
    prerequisiteAdj.set(edge.targetDraftNodeId, list)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      const startIndex = stack.indexOf(nodeId)
      const cyclePath = startIndex >= 0 ? [...stack.slice(startIndex), nodeId] : [nodeId]
      errors.push(`Prerequisite cycle detected: ${cyclePath.map(id => nodeById.get(id)?.courseCode ?? id).join(' -> ')}.`)
      return true
    }
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)
    stack.push(nodeId)
    for (const prereq of prerequisiteAdj.get(nodeId) ?? []) {
      if (visit(prereq)) return true
    }
    stack.pop()
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  for (const node of nodes) {
    visit(node.draftNodeId)
  }

  // Orphan / disconnected nodes warning
  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    connectedNodeIds.add(edge.sourceDraftNodeId)
    connectedNodeIds.add(edge.targetDraftNodeId)
  }
  for (const node of nodes) {
    if (!connectedNodeIds.has(node.draftNodeId) && nodes.length > 1) {
      warnings.push(`Node ${node.courseCode} is disconnected from the graph. Consider adding prerequisite or downstream links.`)
    }
  }

  // Missing topic partitions warning
  for (const node of nodes) {
    const tp = node.topicPartitions
    if (tp.tt1.length === 0 || tp.tt2.length === 0 || tp.see.length === 0) {
      warnings.push(`Node ${node.courseCode} is missing one or more topic partitions (tt1/tt2/see).`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

const draftGraphPayloadSchema = z.object({
  nodes: z.array(draftNodeSchema).min(1),
  edges: z.array(draftEdgeSchema),
})

function extractDraftNodeMetadata(nodes: DraftNode[]) {
  const topicPartitions: Record<string, DraftNode['topicPartitions']> = {}
  const bridgeModulesMap: Record<string, string[]> = {}
  for (const node of nodes) {
    topicPartitions[node.draftNodeId] = node.topicPartitions
    bridgeModulesMap[node.draftNodeId] = node.bridgeModules
  }
  return { topicPartitions, bridgeModulesMap }
}

async function updateDraftGraph(context: RouteContext, draftId: string, nodes: DraftNode[], edges: DraftEdge[], now: string) {
  const { topicPartitions, bridgeModulesMap } = extractDraftNodeMetadata(nodes)
  await context.db.update(curriculumGraphDrafts).set({
    draftNodesJson: stringifyJson(nodes),
    draftEdgesJson: stringifyJson(edges),
    draftTopicPartitionsJson: stringifyJson(topicPartitions),
    draftBridgeModulesJson: stringifyJson(bridgeModulesMap),
    updatedAt: now,
  }).where(eq(curriculumGraphDrafts.curriculumGraphDraftId, draftId))
}

function parseDraftGraphPayload(payload: Record<string, unknown>) {
  const parsed = draftGraphPayloadSchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}

function readErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Failed to publish curriculum graph.'
}

async function createNewImportVersionFromDraft(
  context: RouteContext,
  input: {
    batchId: string
    baseCurriculumImportVersionId: string
    nodes: DraftNode[]
    edges: DraftEdge[]
    actorFacultyId?: string | null
    now: string
  },
) {
  const [baseImport] = await context.db.select().from(curriculumImportVersions)
    .where(eq(curriculumImportVersions.curriculumImportVersionId, input.baseCurriculumImportVersionId))
  if (!baseImport) throw notFound('Base curriculum import version not found')

  const newImportVersionId = createId('curriculum_import')
  const now = input.now

  // Insert new import version
  await context.db.insert(curriculumImportVersions).values({
    curriculumImportVersionId: newImportVersionId,
    batchId: input.batchId,
    sourceLabel: `${baseImport.sourceLabel} (graph-publish)`,
    sourceChecksum: '',
    sourcePath: null,
    sourceType: 'graph-publish',
    compilerVersion: 'curriculum-graph-routes-v1',
    outputChecksum: '',
    firstSemester: baseImport.firstSemester,
    lastSemester: baseImport.lastSemester,
    courseCount: input.nodes.length,
    totalCredits: input.nodes.reduce((sum, n) => sum + n.credits, 0),
    explicitEdgeCount: input.edges.filter(e => e.edgeKind === 'explicit').length,
    addedEdgeCount: input.edges.filter(e => e.edgeKind === 'added').length,
    bridgeModuleCount: input.nodes.filter(n => n.bridgeModules.length > 0).length,
    electiveOptionCount: baseImport.electiveOptionCount,
    unresolvedMappingCount: baseImport.unresolvedMappingCount,
    validationStatus: 'pass',
    completenessCertificateJson: '{}',
    approvedByFacultyId: input.actorFacultyId ?? null,
    approvedAt: now,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  // Map draft node IDs to new curriculum node IDs
  const draftNodeIdToNewNodeId = new Map<string, string>()
  for (const node of input.nodes) {
    const newNodeId = createId('curriculum_node')
    draftNodeIdToNewNodeId.set(node.draftNodeId, newNodeId)
  }

  // Insert curriculum nodes
  await context.db.insert(curriculumNodes).values(input.nodes.map(node => ({
    curriculumNodeId: draftNodeIdToNewNodeId.get(node.draftNodeId)!,
    curriculumImportVersionId: newImportVersionId,
    batchId: input.batchId,
    semesterNumber: node.semesterNumber,
    courseId: null, // Graph publish does not auto-link to course records; admin can link later
    courseCode: node.courseCode,
    title: node.title,
    credits: node.credits,
    internalCompilerId: node.courseCode.toUpperCase().replace(/\s+/g, '_'),
    officialWebCode: node.courseCode,
    officialWebTitle: node.title,
    matchStatus: 'graph-authored',
    mappingNote: 'Created via Curriculum Graph Builder.',
    assessmentProfile: node.assessmentProfile,
    outcomeBloomLevel: null,
    outcomeMasteryTarget: null,
    positionX: node.positionX,
    positionY: node.positionY,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })))

  // Build a map of draft node IDs to semester numbers for semesterDelta computation
  const draftNodeSemester = new Map(input.nodes.map(n => [n.draftNodeId, n.semesterNumber]))

  // Insert curriculum edges
  await context.db.insert(curriculumEdges).values(input.edges.map(edge => ({
    curriculumEdgeId: createId('curriculum_edge'),
    curriculumImportVersionId: newImportVersionId,
    batchId: input.batchId,
    sourceCurriculumNodeId: draftNodeIdToNewNodeId.get(edge.sourceDraftNodeId)!,
    targetCurriculumNodeId: draftNodeIdToNewNodeId.get(edge.targetDraftNodeId)!,
    edgeKind: edge.edgeKind,
    rationale: edge.rationale,
    weight: edge.weight,
    weightOverride: null,
    sourceOutcomeId: edge.sourceOutcomeId ?? null,
    targetOutcomeId: edge.targetOutcomeId ?? null,
    semesterDelta: (draftNodeSemester.get(edge.targetDraftNodeId) ?? 0) - (draftNodeSemester.get(edge.sourceDraftNodeId) ?? 0),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })))

  // Insert topic partitions
  const partitionRows: typeof courseTopicPartitions.$inferInsert[] = []
  for (const node of input.nodes) {
    const nodeId = draftNodeIdToNewNodeId.get(node.draftNodeId)!
    const tp = node.topicPartitions
    if (tp.tt1.length > 0) partitionRows.push({ courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: newImportVersionId, curriculumNodeId: nodeId, partitionKind: 'tt1', topicsJson: stringifyJson(tp.tt1), createdAt: now, updatedAt: now })
    if (tp.tt2.length > 0) partitionRows.push({ courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: newImportVersionId, curriculumNodeId: nodeId, partitionKind: 'tt2', topicsJson: stringifyJson(tp.tt2), createdAt: now, updatedAt: now })
    if (tp.see.length > 0) partitionRows.push({ courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: newImportVersionId, curriculumNodeId: nodeId, partitionKind: 'see', topicsJson: stringifyJson(tp.see), createdAt: now, updatedAt: now })
    if (tp.workbook.length > 0) partitionRows.push({ courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: newImportVersionId, curriculumNodeId: nodeId, partitionKind: 'workbook', topicsJson: stringifyJson(tp.workbook), createdAt: now, updatedAt: now })
  }
  if (partitionRows.length > 0) {
    await context.db.insert(courseTopicPartitions).values(partitionRows)
  }

  // Insert bridge modules
  const bridgeRows: typeof bridgeModules.$inferInsert[] = []
  for (const node of input.nodes) {
    if (node.bridgeModules.length === 0) continue
    const nodeId = draftNodeIdToNewNodeId.get(node.draftNodeId)!
    bridgeRows.push({
      bridgeModuleId: createId('bridge_module'),
      curriculumImportVersionId: newImportVersionId,
      curriculumNodeId: nodeId,
      batchId: input.batchId,
      moduleTitlesJson: stringifyJson(node.bridgeModules),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
  }
  if (bridgeRows.length > 0) {
    await context.db.insert(bridgeModules).values(bridgeRows)
  }

  // Update import version summary with computed checksum and certificate
  const compiledWorkbook: CompiledCurriculumWorkbook = {
    sourcePath: baseImport.sourcePath ?? `curriculum-graph:${input.batchId}`,
    sourceLabel: `${baseImport.sourceLabel} (graph-publish)`,
    sourceChecksum: '',
    sourceType: 'bundled-json',
    compilerVersion: 'curriculum-graph-routes-v1',
    courses: input.nodes.map(n => ({
      title: n.title,
      semester: n.semesterNumber,
      credits: n.credits,
      assessmentProfile: n.assessmentProfile,
      explicitPrerequisites: input.edges.filter(e => e.edgeKind === 'explicit' && e.targetDraftNodeId === n.draftNodeId).map(e => input.nodes.find(n2 => n2.draftNodeId === e.sourceDraftNodeId)?.courseCode ?? e.sourceDraftNodeId),
      addedPrerequisites: input.edges.filter(e => e.edgeKind === 'added' && e.targetDraftNodeId === n.draftNodeId).map(e => input.nodes.find(n2 => n2.draftNodeId === e.sourceDraftNodeId)?.courseCode ?? e.sourceDraftNodeId),
      bridgeModules: n.bridgeModules,
      tt1Topics: n.topicPartitions.tt1,
      tt2Topics: n.topicPartitions.tt2,
      seeTopics: n.topicPartitions.see,
      workbookTopics: n.topicPartitions.workbook,
      internalCompilerId: n.courseCode.toUpperCase().replace(/\s+/g, '_'),
      officialWebCode: n.courseCode,
      officialWebTitle: n.title,
      matchStatus: 'graph-authored',
      mappingNote: '',
    })),
    explicitEdges: input.edges.filter(e => e.edgeKind === 'explicit').map(e => ({
      targetCourse: input.nodes.find(n => n.draftNodeId === e.targetDraftNodeId)?.courseCode ?? e.targetDraftNodeId,
      sourceCourse: input.nodes.find(n => n.draftNodeId === e.sourceDraftNodeId)?.courseCode ?? e.sourceDraftNodeId,
      edgeType: e.edgeKind,
      whyAdded: undefined,
    })),
    addedEdges: input.edges.filter(e => e.edgeKind === 'added').map(e => ({
      targetCourse: input.nodes.find(n => n.draftNodeId === e.targetDraftNodeId)?.courseCode ?? e.targetDraftNodeId,
      sourceCourse: input.nodes.find(n => n.draftNodeId === e.sourceDraftNodeId)?.courseCode ?? e.sourceDraftNodeId,
      edgeType: e.edgeKind,
      whyAdded: e.rationale,
    })),
    electives: [],
    sourceNotes: [{ sourceType: 'graph-publish', reference: input.batchId, use: 'System-admin curriculum graph draft publish' }],
    mappingNotes: [{ field: 'compilerVersion', value: 'curriculum-graph-routes-v1' }],
  }
  const validation = validateCompiledCurriculum(compiledWorkbook)
  const certificate = buildCompletenessCertificate(compiledWorkbook, validation)

  await context.db.update(curriculumImportVersions).set({
    outputChecksum: buildCurriculumOutputChecksum(compiledWorkbook),
    courseCount: input.nodes.length,
    totalCredits: input.nodes.reduce((sum, n) => sum + n.credits, 0),
    explicitEdgeCount: input.edges.filter(e => e.edgeKind === 'explicit').length,
    addedEdgeCount: input.edges.filter(e => e.edgeKind === 'added').length,
    bridgeModuleCount: input.nodes.filter(n => n.bridgeModules.length > 0).length,
    validationStatus: validation.errors.length > 0 ? 'review-required' : 'pass',
    completenessCertificateJson: stringifyJson(certificate),
    updatedAt: now,
  }).where(eq(curriculumImportVersions.curriculumImportVersionId, newImportVersionId))

  return { newImportVersionId }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function registerCurriculumGraphRoutes(app: FastifyInstance, context: RouteContext) {
  // -------------------------------------------------------------------------
  // GET /api/admin/batches/:batchId/curriculum-graph
  // -------------------------------------------------------------------------
  app.get('/api/admin/batches/:batchId/curriculum-graph', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId } = batchParamsSchema.parse(request.params)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
    if (!batch) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Batch not found' })

    const latestImport = await getLatestCurriculumImport(context, batchId)
    if (!latestImport) {
      return reply.status(404).send({ error: 'NO_IMPORT', message: 'No curriculum import version found for this batch.' })
    }

    const activeDraft = await getActiveDraft(context, batchId)

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
      const loaded = await loadGraphFromImportVersion(context, latestImport.curriculumImportVersionId)
      nodes = loaded.nodes
      edges = loaded.edges
      topicPartitions = loaded.topicPartitions
      bridgeModulesMap = loaded.bridgeModules
    }

    // Load history for undo/redo state
    const historyRows = activeDraft
      ? await context.db.select().from(curriculumGraphHistory)
          .where(eq(curriculumGraphHistory.curriculumGraphDraftId, activeDraft.curriculumGraphDraftId))
          .orderBy(curriculumGraphHistory.sequenceNumber)
      : []

    const canUndo = historyRows.some(h => !h.isUndone)
    const canRedo = historyRows.some(h => h.isUndone)

    // Load pending suggestions
    const suggestionRows = await context.db.select().from(curriculumGraphSuggestions)
      .where(and(
        eq(curriculumGraphSuggestions.batchId, batchId),
        eq(curriculumGraphSuggestions.status, 'pending'),
      ))

    const validation = validateGraph(nodes, edges)

    emitAuditEvent(context, { entityType: 'curriculum_graph', entityId: batchId, action: 'read', actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId, metadata: { batchId } })

    return reply.send({
      batchId,
      baseCurriculumImportVersionId: latestImport.curriculumImportVersionId,
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
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/draft
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/draft', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId } = batchParamsSchema.parse(request.params)
    const body = saveDraftBodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid draft payload.', details: body.error.format() })
    }

    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
    if (!batch) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Batch not found' })

    const latestImport = await getLatestCurriculumImport(context, batchId)
    if (!latestImport) {
      return reply.status(400).send({ error: 'NO_IMPORT', message: 'No curriculum import version to base draft on.' })
    }

    const now = context.now()
    const actorFacultyId = auth?.facultyId ?? null
    const { nodes, edges, command } = body.data

    // Extract topic partitions and bridge modules for separate JSON columns
    const { topicPartitions, bridgeModulesMap } = extractDraftNodeMetadata(nodes)

    // Upsert draft
    const existingDraft = await getActiveDraft(context, batchId)
    let draftId: string
    let nextSequence = 1

    if (existingDraft) {
      draftId = existingDraft.curriculumGraphDraftId
      const historyRows = await context.db.select().from(curriculumGraphHistory)
        .where(eq(curriculumGraphHistory.curriculumGraphDraftId, draftId))
      nextSequence = historyRows.length > 0 ? Math.max(...historyRows.map(h => h.sequenceNumber)) + 1 : 1

      await updateDraftGraph(context, draftId, nodes, edges, now)
    } else {
      draftId = createId('graph_draft')
      await context.db.insert(curriculumGraphDrafts).values({
        curriculumGraphDraftId: draftId,
        batchId,
        baseCurriculumImportVersionId: latestImport.curriculumImportVersionId,
        draftNodesJson: stringifyJson(nodes),
        draftEdgesJson: stringifyJson(edges),
        draftTopicPartitionsJson: stringifyJson(topicPartitions),
        draftBridgeModulesJson: stringifyJson(bridgeModulesMap),
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
    }

    // Record command in history if provided
    if (command) {
      await context.db.insert(curriculumGraphHistory).values({
        curriculumGraphHistoryId: createId('graph_history'),
        batchId,
        curriculumGraphDraftId: draftId,
        commandType: command.commandType,
        commandPayloadJson: stringifyJson(command.payload),
        reversePayloadJson: stringifyJson(command.reversePayload),
        sequenceNumber: nextSequence,
        isUndone: 0,
        actorFacultyId,
        createdAt: now,
      })
    }

    emitAuditEvent(context, { entityType: 'curriculum_graph', entityId: draftId, action: 'draft.saved', actorRole: auth.activeRoleGrant.roleCode, actorId: actorFacultyId, metadata: { batchId } })

    return reply.send({ ok: true, draftId, savedAt: now })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/validate
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/validate', async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId } = batchParamsSchema.parse(request.params)
    const body = saveDraftBodySchema.partial().safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid validate payload.', details: body.error.format() })
    }

    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
    if (!batch) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Batch not found' })

    let nodes: DraftNode[]
    let edges: DraftEdge[]

    if (body.data.nodes && body.data.edges) {
      nodes = body.data.nodes
      edges = body.data.edges
    } else {
      const activeDraft = await getActiveDraft(context, batchId)
      if (!activeDraft) {
        return reply.status(400).send({ error: 'NO_DRAFT', message: 'No draft to validate. Save a draft first or provide nodes/edges in body.' })
      }
      nodes = parseJson(activeDraft.draftNodesJson, [] as DraftNode[])
      edges = parseJson(activeDraft.draftEdgesJson, [] as DraftEdge[])
    }

    const validation = validateGraph(nodes, edges)
    return reply.send(validation)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/publish
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/publish', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId } = batchParamsSchema.parse(request.params)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
    if (!batch) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Batch not found' })

    const activeDraft = await getActiveDraft(context, batchId)
    if (!activeDraft) {
      return reply.status(400).send({ error: 'NO_DRAFT', message: 'No active draft to publish.' })
    }

    const nodes = parseJson(activeDraft.draftNodesJson, [] as DraftNode[])
    const edges = parseJson(activeDraft.draftEdgesJson, [] as DraftEdge[])

    const validation = validateGraph(nodes, edges)
    if (!validation.valid) {
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message: 'Cannot publish a graph with validation errors.',
        validation,
      })
    }

    const now = context.now()
    const actorFacultyId = auth?.facultyId ?? null

    try {
      const { newImportVersionId } = await createNewImportVersionFromDraft(context, {
        batchId,
        baseCurriculumImportVersionId: activeDraft.baseCurriculumImportVersionId,
        nodes,
        edges,
        actorFacultyId,
        now,
      })

      // Mark draft as published
      await context.db.update(curriculumGraphDrafts).set({
        status: 'published',
        updatedAt: now,
      }).where(eq(curriculumGraphDrafts.curriculumGraphDraftId, activeDraft.curriculumGraphDraftId))

      // Queue the ML validation simulation directly on publish
      const resolved = await resolveBatchPolicy(context, batchId)
      const resolvedFeatures = await resolveBatchCurriculumFeatures(context, batchId)
      
      const simulationRun = await enqueueProofSimulationRun(context.db, {
        batchId,
        curriculumImportVersionId: newImportVersionId,
        policy: resolved.effectivePolicy,
        curriculumFeatureProfileId: resolvedFeatures.primaryCurriculumFeatureProfileId,
        curriculumFeatureProfileFingerprint: resolvedFeatures.curriculumFeatureProfileFingerprint,
        now,
        runLabel: `Curriculum Adaptation Check (auto-publish)`,
      })
      
      emitAuditEvent(context, { entityType: 'curriculum_graph', entityId: activeDraft.curriculumGraphDraftId, action: 'publish', actorRole: auth.activeRoleGrant.roleCode, actorId: actorFacultyId, metadata: { batchId, newImportVersionId, simulationRunId: simulationRun.simulationRunId } })

      return reply.send({
        ok: true,
        newImportVersionId,
        validation,
        publishedAt: now,
      })
    } catch (err: unknown) {
      return reply.status(500).send({
        error: 'PUBLISH_FAILED',
        message: readErrorMessage(err),
      })
    }
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/undo
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/undo', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId } = batchParamsSchema.parse(request.params)
    const activeDraft = await getActiveDraft(context, batchId)
    if (!activeDraft) {
      return reply.status(400).send({ error: 'NO_DRAFT', message: 'No active draft.' })
    }

    const historyRows = await context.db.select().from(curriculumGraphHistory)
      .where(eq(curriculumGraphHistory.curriculumGraphDraftId, activeDraft.curriculumGraphDraftId))
      .orderBy(desc(curriculumGraphHistory.sequenceNumber))

    const target = historyRows.find(h => !h.isUndone)
    if (!target) {
      return reply.status(400).send({ error: 'NO_UNDO', message: 'Nothing to undo.' })
    }

    const reversePayload = parseJson(target.reversePayloadJson, {} as Record<string, unknown>)
    const reverseGraph = parseDraftGraphPayload(reversePayload)
    if (!reverseGraph) {
      return reply.status(400).send({ error: 'INVALID_UNDO_PAYLOAD', message: 'Undo payload cannot restore a graph snapshot.' })
    }

    await updateDraftGraph(context, activeDraft.curriculumGraphDraftId, reverseGraph.nodes, reverseGraph.edges, context.now())

    await context.db.update(curriculumGraphHistory).set({ isUndone: 1 })
      .where(eq(curriculumGraphHistory.curriculumGraphHistoryId, target.curriculumGraphHistoryId))

    emitAuditEvent(context, { entityType: 'curriculum_graph', entityId: activeDraft.curriculumGraphDraftId, action: 'undo', actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId, metadata: { batchId, commandType: target.commandType } })

    return reply.send({
      ok: true,
      reversePayload,
      commandType: target.commandType,
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/redo
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/redo', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId } = batchParamsSchema.parse(request.params)
    const activeDraft = await getActiveDraft(context, batchId)
    if (!activeDraft) {
      return reply.status(400).send({ error: 'NO_DRAFT', message: 'No active draft.' })
    }

    const historyRows = await context.db.select().from(curriculumGraphHistory)
      .where(eq(curriculumGraphHistory.curriculumGraphDraftId, activeDraft.curriculumGraphDraftId))
      .orderBy(curriculumGraphHistory.sequenceNumber)

    const target = historyRows.find(h => h.isUndone)
    if (!target) {
      return reply.status(400).send({ error: 'NO_REDO', message: 'Nothing to redo.' })
    }

    const forwardPayload = parseJson(target.commandPayloadJson, {} as Record<string, unknown>)
    const forwardGraph = parseDraftGraphPayload(forwardPayload)
    if (!forwardGraph) {
      return reply.status(400).send({ error: 'INVALID_REDO_PAYLOAD', message: 'Redo payload cannot restore a graph snapshot.' })
    }

    await updateDraftGraph(context, activeDraft.curriculumGraphDraftId, forwardGraph.nodes, forwardGraph.edges, context.now())

    await context.db.update(curriculumGraphHistory).set({ isUndone: 0 })
      .where(eq(curriculumGraphHistory.curriculumGraphHistoryId, target.curriculumGraphHistoryId))

    emitAuditEvent(context, { entityType: 'curriculum_graph', entityId: activeDraft.curriculumGraphDraftId, action: 'redo', actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId, metadata: { batchId, commandType: target.commandType } })

    return reply.send({
      ok: true,
      forwardPayload,
      commandType: target.commandType,
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/suggest
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/suggest', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId } = batchParamsSchema.parse(request.params)
    const body = z.object({
      targetCurriculumNodeIds: z.array(z.string()).optional(),
    }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid suggest payload.', details: body.error.format() })
    }

    const activeDraft = await getActiveDraft(context, batchId)
    const latestImport = await getLatestCurriculumImport(context, batchId)
    if (!latestImport) {
      return reply.status(400).send({ error: 'NO_IMPORT', message: 'No curriculum import to suggest from.' })
    }

    // Load current nodes as ResolvedFeatureLike for the linkage builder
    const { nodes } = activeDraft
      ? {
          nodes: parseJson(activeDraft.draftNodesJson, [] as DraftNode[]),
        }
      : await loadGraphFromImportVersion(context, latestImport.curriculumImportVersionId)

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

    const candidateResult = await buildCurriculumLinkageCandidates({
      manifestKey: 'msruas-mnc-seed',
      items,
      targetCurriculumCourseIds: body.data.targetCurriculumNodeIds?.length ? body.data.targetCurriculumNodeIds : null,
    })

    const now = context.now()
    const actorFacultyId = auth?.facultyId ?? null
    const draftId = activeDraft?.curriculumGraphDraftId ?? null

    // Store suggestions in DB
    for (const candidate of candidateResult.items) {
      await context.db.insert(curriculumGraphSuggestions).values({
        curriculumGraphSuggestionId: createId('graph_suggestion'),
        batchId,
        curriculumGraphDraftId: draftId,
        targetCurriculumNodeId: candidate.curriculumCourseId,
        sourceCurriculumNodeId: null, // We only store course codes, not node IDs here
        edgeKind: candidate.edgeKind,
        rationale: candidate.rationale,
        confidenceScaled: candidate.confidenceScaled,
        sourcesJson: stringifyJson(candidate.sources),
        status: 'pending',
        actorFacultyId,
        createdAt: now,
        updatedAt: now,
      })
    }

    return reply.send({
      ok: true,
      candidateCount: candidateResult.items.length,
      candidateGenerationStatus: candidateResult.candidateGenerationStatus,
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/approve
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/approve', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId, suggestionId } = suggestionParamsSchema.parse(request.params)

    const [row] = await context.db.select().from(curriculumGraphSuggestions)
      .where(and(
        eq(curriculumGraphSuggestions.curriculumGraphSuggestionId, suggestionId),
        eq(curriculumGraphSuggestions.batchId, batchId),
      ))
    if (!row) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Suggestion not found' })

    const now = context.now()
    await context.db.update(curriculumGraphSuggestions).set({
      status: 'approved',
      actorFacultyId: auth?.facultyId ?? null,
      updatedAt: now,
    }).where(eq(curriculumGraphSuggestions.curriculumGraphSuggestionId, suggestionId))

    return reply.send({ ok: true, suggestionId, status: 'approved' })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/reject
  // -------------------------------------------------------------------------
  app.post('/api/admin/batches/:batchId/curriculum-graph/suggestions/:suggestionId/reject', async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])

    const { batchId, suggestionId } = suggestionParamsSchema.parse(request.params)

    const [row] = await context.db.select().from(curriculumGraphSuggestions)
      .where(and(
        eq(curriculumGraphSuggestions.curriculumGraphSuggestionId, suggestionId),
        eq(curriculumGraphSuggestions.batchId, batchId),
      ))
    if (!row) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Suggestion not found' })

    const now = context.now()
    await context.db.update(curriculumGraphSuggestions).set({
      status: 'rejected',
      actorFacultyId: auth?.facultyId ?? null,
      updatedAt: now,
    }).where(eq(curriculumGraphSuggestions.curriculumGraphSuggestionId, suggestionId))

    return reply.send({ ok: true, suggestionId, status: 'rejected' })
  })
}
