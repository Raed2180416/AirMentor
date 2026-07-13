/**
 * Drizzle write path for publishing a curriculum-graph draft into a brand new
 * curriculum import version (+ nodes, edges, topic partitions, bridge modules).
 *
 * Moved verbatim from modules/curriculum-graph-routes.ts; the only change is the
 * data handle (`context.db` -> injected `db`). Write semantics/order preserved.
 */
import { eq } from 'drizzle-orm'
import {
  bridgeModules,
  courseTopicPartitions,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { notFound } from '../../../../lib/http-errors.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import {
  buildCompletenessCertificate,
  buildCurriculumOutputChecksum,
  validateCompiledCurriculum,
  type CompiledCurriculumWorkbook,
} from '../../../../lib/msruas-curriculum-compiler.js'
import type { CreateImportVersionFromDraftInput } from '../../../../application/ports/curriculum-graph-repository.js'

export async function createNewImportVersionFromDraft(
  db: AppDb,
  input: CreateImportVersionFromDraftInput,
) {
  const [baseImport] = await db.select().from(curriculumImportVersions)
    .where(eq(curriculumImportVersions.curriculumImportVersionId, input.baseCurriculumImportVersionId))
  if (!baseImport) throw notFound('Base curriculum import version not found')

  const newImportVersionId = createId('curriculum_import')
  const now = input.now

  // Insert new import version
  await db.insert(curriculumImportVersions).values({
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
  await db.insert(curriculumNodes).values(input.nodes.map(node => ({
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
  await db.insert(curriculumEdges).values(input.edges.map(edge => ({
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
    await db.insert(courseTopicPartitions).values(partitionRows)
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
    await db.insert(bridgeModules).values(bridgeRows)
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

  await db.update(curriculumImportVersions).set({
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
