/**
 * Pure curriculum prerequisite-edge validation.
 *
 * Persistence-free; moved verbatim from modules/admin-structure.ts. The only
 * change from the original is the parameter type of `batchCurriculumRows`,
 * narrowed from `typeof curriculumCourses.$inferSelect[]` to the structural
 * shape actually read (`curriculumCourseId`/`courseCode`/`semesterNumber`) so
 * the application layer stays free of db/schema imports. Runtime behavior is
 * identical — callers pass full curriculum rows, which remain assignable.
 */
import { badRequest } from '../../../lib/http-errors.js'
import type { CurriculumFeatureProfileCoursePayload } from './admin-structure-schemas.js'
import { formatCurriculumEdgeValidationMessage, type CurriculumEdgeValidationError } from './feature-domain.js'

type AuthoredCurriculumRow = {
  curriculumCourseId: string
  courseCode: string
  semesterNumber: number
}

export function validateResolvedCurriculumFeatureItems(input: {
  batchId: string
  batchCurriculumRows: Array<AuthoredCurriculumRow>
  items: Array<{
    curriculumCourseId: string
    resolvedConfig: CurriculumFeatureProfileCoursePayload
  }>
}) {
  const rowByCourseId = new Map(input.batchCurriculumRows.map(row => [row.curriculumCourseId, row]))
  const rowByCourseCode = new Map(input.batchCurriculumRows.map(row => [row.courseCode.trim().toLowerCase(), row]))
  const errors: CurriculumEdgeValidationError[] = []

  for (const item of input.items) {
    const targetRow = rowByCourseId.get(item.curriculumCourseId)
    if (!targetRow) {
      errors.push({
        targetCourseCode: item.curriculumCourseId,
        sourceCourseCode: '?',
        message: `Target course is not an authored active curriculum row in batch ${input.batchId}.`,
      })
      continue
    }
    const seenEdges = new Set<string>()
    for (const prerequisite of item.resolvedConfig.prerequisites) {
      const normalizedSourceCourseCode = prerequisite.sourceCourseCode.trim().toLowerCase()
      const sourceRow = rowByCourseCode.get(normalizedSourceCourseCode) ?? null
      const edgeKey = `${normalizedSourceCourseCode}::${targetRow.curriculumCourseId}::${prerequisite.edgeKind}`
      if (seenEdges.has(edgeKey)) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: prerequisite.sourceCourseCode,
          message: `Duplicate ${prerequisite.edgeKind} prerequisite edge.`,
        })
        continue
      }
      seenEdges.add(edgeKey)
      if (!sourceRow) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: prerequisite.sourceCourseCode,
          message: 'Source course is not present in authored active curriculum rows.',
        })
        continue
      }
      if (
        sourceRow.curriculumCourseId === targetRow.curriculumCourseId
        || sourceRow.courseCode.trim().toLowerCase() === targetRow.courseCode.trim().toLowerCase()
      ) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: sourceRow.courseCode,
          message: 'Self-referential prerequisite edges are not allowed.',
        })
        continue
      }
      if (prerequisite.edgeKind === 'explicit' && sourceRow.semesterNumber >= targetRow.semesterNumber) {
        errors.push({
          targetCourseCode: targetRow.courseCode,
          sourceCourseCode: sourceRow.courseCode,
          message: `Prerequisite edges require an earlier semester. Found semester ${sourceRow.semesterNumber} -> ${targetRow.semesterNumber}.`,
        })
      }
    }
  }

  if (errors.length > 0) {
    throw badRequest(formatCurriculumEdgeValidationMessage(errors))
  }
}

export function validateCurriculumFeaturePayloadForCourse(input: {
  batchId: string
  batchCurriculumRows: Array<AuthoredCurriculumRow>
  curriculumCourseId: string
  payload: CurriculumFeatureProfileCoursePayload
}) {
  validateResolvedCurriculumFeatureItems({
    batchId: input.batchId,
    batchCurriculumRows: input.batchCurriculumRows,
    items: [{
      curriculumCourseId: input.curriculumCourseId,
      resolvedConfig: input.payload,
    }],
  })
}
