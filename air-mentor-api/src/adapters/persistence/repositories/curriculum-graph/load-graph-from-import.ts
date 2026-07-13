/**
 * Drizzle read path that assembles a draft-shaped graph (nodes, edges, topic
 * partitions, bridge modules, outcomes) from a published curriculum import
 * version.
 *
 * Moved verbatim from modules/curriculum-graph-routes.ts (`context.db` -> `db`).
 * The one legacy `(o: any)` annotation is replaced with a widened fallback type
 * so the map body is unchanged and the runtime result is identical.
 */
import { eq } from 'drizzle-orm'
import {
  bridgeModules,
  courseOutcomeOverrides,
  courseTopicPartitions,
  curriculumEdges,
  curriculumNodes,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { parseJson } from '../../../../lib/json.js'
import type { LoadedGraph } from '../../../../application/ports/curriculum-graph-repository.js'
import { mapDbEdgeToDraft, mapDbNodeToDraft } from '../../../../application/use-cases/curriculum-graph/graph-domain.js'

export async function loadGraphFromImportVersion(
  db: AppDb,
  curriculumImportVersionId: string,
): Promise<LoadedGraph> {
  const [nodeRows, edgeRows, partitionRows, bridgeRows] = await Promise.all([
    db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, curriculumImportVersionId)),
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

  // Attach outcomes from course_outcome_overrides (batch-scoped or institution-scoped)
  const courseIdToOutcomes = new Map<string, Array<{ id: string; desc: string; bloom: string; masteryTarget: number }>>()
  const outcomeRows = await db.select().from(courseOutcomeOverrides)
    .where(eq(courseOutcomeOverrides.status, 'active'))
  for (const or of outcomeRows) {
    const parsed = parseJson(or.outcomesJson, [] as Array<{
      id?: string; desc?: string; description?: string
      bloom?: string; bloomLevel?: string
      masteryTarget?: number; mastery_target?: number
    }>)
    const normalized = parsed.map((o, idx: number) => ({
      id: o.id ?? `co_${idx}`,
      desc: o.desc ?? o.description ?? 'Course outcome',
      bloom: o.bloom ?? o.bloomLevel ?? 'understand',
      masteryTarget: o.masteryTarget ?? o.mastery_target ?? 0.6,
    }))
    courseIdToOutcomes.set(or.courseId, normalized)
  }

  for (const n of activeNodes) {
    const draftNode = nodeMap.get(n.curriculumNodeId)
    if (!draftNode) continue
    draftNode.topicPartitions = topicPartitions[n.curriculumNodeId] ?? { tt1: [], tt2: [], see: [], workbook: [] }
    draftNode.bridgeModules = bridgeModuleMap[n.curriculumNodeId] ?? []
    if (n.courseId && courseIdToOutcomes.has(n.courseId)) {
      draftNode.outcomes = courseIdToOutcomes.get(n.courseId)!
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: activeEdges.map(mapDbEdgeToDraft),
    topicPartitions,
    bridgeModules: bridgeModuleMap,
  }
}
