/**
 * Pure curriculum-feature domain helpers.
 *
 * Persistence-free logic moved verbatim from modules/admin-structure.ts:
 * payload normalisation, snapshot/feature fingerprints, default outcomes,
 * course-reference matching, prerequisite-error formatting, proof-refresh
 * summary shaping, and linkage-neighborhood expansion.
 */
import { createHash } from 'node:crypto'
import { createId } from '../../../lib/ids.js'
import type { CurriculumFeatureProfileCoursePayload } from './admin-structure-schemas.js'

export function buildDefaultCourseOutcomes(courseCode: string, courseTitle: string) {
  return [
    { id: 'CO1', desc: `Explain the core concepts covered in ${courseTitle}.`, bloom: 'Understand' },
    { id: 'CO2', desc: `Apply ${courseCode} methods to solve structured academic problems.`, bloom: 'Apply' },
    { id: 'CO3', desc: `Analyse common failure patterns, tradeoffs, and edge cases in ${courseTitle}.`, bloom: 'Analyse' },
    { id: 'CO4', desc: `Evaluate solution quality and justify implementation choices in ${courseTitle}.`, bloom: 'Evaluate' },
  ]
}

export function normalizeFeatureStringList(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
}

export function normalizeCurriculumFeaturePayload(payload: CurriculumFeatureProfileCoursePayload): CurriculumFeatureProfileCoursePayload {
  return {
    assessmentProfile: payload.assessmentProfile.trim(),
    outcomes: payload.outcomes
      .map(item => ({
        id: item.id.trim(),
        desc: item.desc.trim(),
        bloom: item.bloom.trim(),
      }))
      .filter(item => item.id && item.desc && item.bloom)
      .sort((left, right) => left.id.localeCompare(right.id)),
    prerequisites: payload.prerequisites
      .map(item => ({
        sourceCourseCode: item.sourceCourseCode.trim(),
        edgeKind: item.edgeKind,
        rationale: item.rationale.trim(),
      }))
      .filter(item => item.sourceCourseCode && item.rationale)
      .sort((left, right) => left.sourceCourseCode.localeCompare(right.sourceCourseCode) || left.rationale.localeCompare(right.rationale)),
    bridgeModules: normalizeFeatureStringList(payload.bridgeModules).sort((left, right) => left.localeCompare(right)),
    topicPartitions: {
      tt1: normalizeFeatureStringList(payload.topicPartitions.tt1).sort((left, right) => left.localeCompare(right)),
      tt2: normalizeFeatureStringList(payload.topicPartitions.tt2).sort((left, right) => left.localeCompare(right)),
      see: normalizeFeatureStringList(payload.topicPartitions.see).sort((left, right) => left.localeCompare(right)),
      workbook: normalizeFeatureStringList(payload.topicPartitions.workbook).sort((left, right) => left.localeCompare(right)),
    },
  }
}

export type CurriculumEdgeValidationError = {
  targetCourseCode: string
  sourceCourseCode: string
  message: string
}

export type ProofRefreshSummary = {
  affectedBatchIds: string[]
  queuedSimulationRunIds: string[]
  curriculumImportVersionId: string | null
  failedBatchIds: string[]
  status: 'not-needed' | 'queued' | 'degraded'
  warning: string | null
}

export function createEmptyProofRefresh(curriculumImportVersionId: string | null = null): ProofRefreshSummary {
  return {
    affectedBatchIds: [],
    queuedSimulationRunIds: [],
    curriculumImportVersionId,
    failedBatchIds: [],
    status: 'not-needed',
    warning: null,
  }
}

export function formatCurriculumEdgeValidationMessage(errors: CurriculumEdgeValidationError[]) {
  const preview = errors
    .slice(0, 6)
    .map(error => `${error.targetCourseCode} <- ${error.sourceCourseCode}: ${error.message}`)
    .join('; ')
  const remainder = errors.length > 6 ? ` (+${errors.length - 6} more)` : ''
  return `Invalid curriculum prerequisite configuration. ${preview}${remainder}`
}

export function curriculumFeatureFingerprint(payload: CurriculumFeatureProfileCoursePayload) {
  return buildSnapshotChecksum(normalizeCurriculumFeaturePayload(payload))
}

export function sanitizeInternalCompilerId(courseCode: string, title: string) {
  const seed = courseCode.trim() || title.trim()
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || createId('course_seed')
}

export function buildSnapshotChecksum(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function matchesCourseReference(input: {
  courseId?: string | null
  courseCode: string
  title: string
}, candidate: {
  courseId?: string | null
  courseCode: string
  title: string
}) {
  return (
    (!!input.courseId && !!candidate.courseId && input.courseId === candidate.courseId)
    || input.courseCode.toLowerCase() === candidate.courseCode.toLowerCase()
    || input.title.toLowerCase() === candidate.title.toLowerCase()
  )
}

export function batchFeatureFingerprint(items: Array<{
  curriculumCourseId: string
  courseCode: string
  title: string
  semesterNumber: number
  credits: number
  featureFingerprint: string
}>) {
  return buildSnapshotChecksum(items
    .map(item => ({
      curriculumCourseId: item.curriculumCourseId,
      courseCode: item.courseCode,
      title: item.title,
      semesterNumber: item.semesterNumber,
      credits: item.credits,
      featureFingerprint: item.featureFingerprint,
    }))
    .sort((left, right) => left.curriculumCourseId.localeCompare(right.curriculumCourseId)))
}

export function expandCurriculumLinkageNeighborhood(input: {
  items: Array<{
    curriculumCourseId: string
    prerequisites: Array<{ sourceCourseCode: string }>
    courseCode: string
  }>
  targetCurriculumCourseIds: string[]
}) {
  const itemsById = new Map(input.items.map(item => [item.curriculumCourseId, item]))
  const itemByCourseCode = new Map(input.items.map(item => [item.courseCode.trim().toLowerCase(), item]))
  const expandedIds = new Set(input.targetCurriculumCourseIds)
  for (const targetId of input.targetCurriculumCourseIds) {
    const targetItem = itemsById.get(targetId)
    if (!targetItem) continue
    targetItem.prerequisites.forEach(prerequisite => {
      const sourceItem = itemByCourseCode.get(prerequisite.sourceCourseCode.trim().toLowerCase())
      if (sourceItem) expandedIds.add(sourceItem.curriculumCourseId)
    })
    input.items.forEach(candidate => {
      if (candidate.prerequisites.some(prerequisite => prerequisite.sourceCourseCode.trim().toLowerCase() === targetItem.courseCode.trim().toLowerCase())) {
        expandedIds.add(candidate.curriculumCourseId)
      }
    })
  }
  return Array.from(expandedIds)
}
