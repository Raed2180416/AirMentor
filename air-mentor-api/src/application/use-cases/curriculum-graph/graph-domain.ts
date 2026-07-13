/**
 * Curriculum graph — pure domain layer.
 *
 * Persistence-free: request/graph zod schemas, the DraftNode/DraftEdge types,
 * the DB-row → draft mappers, draft metadata extraction, snapshot parsing, and
 * the structural graph validator. No Drizzle, no db/schema (ESLint enforces).
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const draftNodeSchema = z.object({
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

export const draftEdgeSchema = z.object({
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

export const graphCommandSchema = z.object({
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

export const saveDraftBodySchema = z.object({
  nodes: z.array(draftNodeSchema).min(1),
  edges: z.array(draftEdgeSchema),
  command: graphCommandSchema.optional(),
})

export const draftGraphPayloadSchema = z.object({
  nodes: z.array(draftNodeSchema).min(1),
  edges: z.array(draftEdgeSchema),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DraftNode = z.infer<typeof draftNodeSchema>
export type DraftEdge = z.infer<typeof draftEdgeSchema>
export type TopicPartitions = DraftNode['topicPartitions']

// Minimal DB-row shapes the mappers consume (kept persistence-free).
export type DbCurriculumNode = {
  curriculumNodeId: string
  courseCode: string
  title: string
  semesterNumber: number
  credits: number
  assessmentProfile: string
}

export type DbCurriculumEdge = {
  curriculumEdgeId: string
  sourceCurriculumNodeId: string
  targetCurriculumNodeId: string
  edgeKind: string
  rationale: string
  weight: number
  sourceOutcomeId: string | null
  targetOutcomeId: string | null
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapDbNodeToDraft(node: DbCurriculumNode): DraftNode {
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

export function mapDbEdgeToDraft(edge: DbCurriculumEdge): DraftEdge {
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

export function extractDraftNodeMetadata(nodes: DraftNode[]) {
  const topicPartitions: Record<string, DraftNode['topicPartitions']> = {}
  const bridgeModulesMap: Record<string, string[]> = {}
  for (const node of nodes) {
    topicPartitions[node.draftNodeId] = node.topicPartitions
    bridgeModulesMap[node.draftNodeId] = node.bridgeModules
  }
  return { topicPartitions, bridgeModulesMap }
}

export function parseDraftGraphPayload(payload: Record<string, unknown>) {
  const parsed = draftGraphPayloadSchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}

export function readErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Failed to publish curriculum graph.'
}

// ---------------------------------------------------------------------------
// Structural validator
// ---------------------------------------------------------------------------

export function validateGraph(nodes: DraftNode[], edges: DraftEdge[]) {
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
    if (source.semesterNumber > target.semesterNumber) {
      errors.push(`Prerequisite edge ${edge.draftEdgeId} violates semester order: ${source.courseCode} (sem ${source.semesterNumber}) cannot precede ${target.courseCode} (sem ${target.semesterNumber}).`)
    } else if (source.semesterNumber === target.semesterNumber) {
      warnings.push(`Prerequisite edge ${edge.draftEdgeId} is within the same semester (${source.courseCode} -> ${target.courseCode}, sem ${source.semesterNumber}). Consider marking as corequisite.`)
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
