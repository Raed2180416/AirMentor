/**
 * Auto-seed helper — creates a minimal curriculum graph from curriculumCourses
 * when no import version exists (e.g. after generic seed.ts wiped graph tables).
 *
 * Moved verbatim from modules/curriculum-graph-routes.ts (`context.db` -> `db`).
 * Note: this path uses `new Date().toISOString()` for its clock, exactly as the
 * legacy helper did — it does NOT use the injected `now`.
 */
import { eq } from 'drizzle-orm'
import {
  courseTopicPartitions,
  curriculumCourses,
  curriculumImportVersions,
  curriculumNodes,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'

export async function ensureGraphFromCurriculumCourses(db: AppDb, batchId: string) {
  const courses = await db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, batchId))
  if (courses.length === 0) return null

  const now = new Date().toISOString()
  const importVersionId = createId('curriculum_import')

  const firstSem = Math.min(...courses.map(c => c.semesterNumber))
  const lastSem = Math.max(...courses.map(c => c.semesterNumber))
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0)

  await db.insert(curriculumImportVersions).values({
    curriculumImportVersionId: importVersionId,
    batchId,
    sourceLabel: 'Auto-generated from batch curriculum courses',
    sourceChecksum: '',
    sourceType: 'auto_seed',
    compilerVersion: 'seed_v1',
    outputChecksum: '',
    firstSemester: firstSem,
    lastSemester: lastSem,
    courseCount: courses.length,
    totalCredits,
    explicitEdgeCount: 0,
    addedEdgeCount: 0,
    bridgeModuleCount: 0,
    electiveOptionCount: 0,
    unresolvedMappingCount: 0,
    validationStatus: 'seeded',
    completenessCertificateJson: stringifyJson({ seeded: true, source: 'auto_seed' }),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  const nodeRows = courses.map(c => ({
    curriculumNodeId: createId('curriculum_node'),
    curriculumImportVersionId: importVersionId,
    batchId,
    semesterNumber: c.semesterNumber,
    courseId: c.courseId,
    courseCode: c.courseCode,
    title: c.title,
    credits: c.credits,
    internalCompilerId: c.courseCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    officialWebCode: null,
    officialWebTitle: null,
    matchStatus: 'auto_seeded',
    mappingNote: 'Auto-generated from batch curriculum courses',
    assessmentProfile: 'theory_heavy',
    outcomeBloomLevel: null,
    outcomeMasteryTarget: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }))

  await db.insert(curriculumNodes).values(nodeRows)

  const partitionRows = nodeRows.flatMap(node => [
    { courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: importVersionId, curriculumNodeId: node.curriculumNodeId, partitionKind: 'tt1' as const, topicsJson: stringifyJson([]), createdAt: now, updatedAt: now },
    { courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: importVersionId, curriculumNodeId: node.curriculumNodeId, partitionKind: 'tt2' as const, topicsJson: stringifyJson([]), createdAt: now, updatedAt: now },
    { courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: importVersionId, curriculumNodeId: node.curriculumNodeId, partitionKind: 'see' as const, topicsJson: stringifyJson([]), createdAt: now, updatedAt: now },
    { courseTopicPartitionId: createId('course_topic_partition'), curriculumImportVersionId: importVersionId, curriculumNodeId: node.curriculumNodeId, partitionKind: 'workbook' as const, topicsJson: stringifyJson([]), createdAt: now, updatedAt: now },
  ])

  await db.insert(courseTopicPartitions).values(partitionRows)

  return { curriculumImportVersionId: importVersionId, nodeRows }
}
