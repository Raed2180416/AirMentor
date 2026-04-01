import { electiveRecommendations } from '../db/schema.js'
import { parseJson } from './json.js'

type ElectiveRecommendationRow =
  | typeof electiveRecommendations.$inferInsert
  | typeof electiveRecommendations.$inferSelect

type SemesterScopedElectiveFilter = {
  simulationRunId?: string | null
  semesterNumber?: number | null
}

type StudentScopedElectiveFilter = SemesterScopedElectiveFilter & {
  studentId: string
}

function matchesSemesterScopedElectiveFilter(
  row: ElectiveRecommendationRow,
  filter: SemesterScopedElectiveFilter,
) {
  if (filter.simulationRunId != null && row.simulationRunId !== filter.simulationRunId) return false
  if (filter.semesterNumber != null && row.semesterNumber !== filter.semesterNumber) return false
  return true
}

export function filterElectiveRecommendationsForSemester<T extends ElectiveRecommendationRow>(
  rows: T[],
  filter: SemesterScopedElectiveFilter,
) {
  return rows.filter(row => matchesSemesterScopedElectiveFilter(row, filter))
}

export function latestElectiveRecommendationForSemester<T extends ElectiveRecommendationRow>(
  rows: T[],
  filter: StudentScopedElectiveFilter,
) {
  return rows
    .filter(row => row.studentId === filter.studentId)
    .filter(row => matchesSemesterScopedElectiveFilter(row, filter))
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}

export function toElectiveFitPayload(row: ElectiveRecommendationRow | null | undefined) {
  if (!row) return null
  return {
    recommendedCode: row.recommendedCode,
    recommendedTitle: row.recommendedTitle,
    stream: row.stream,
    rationale: parseJson(row.rationaleJson, [] as string[]),
    alternatives: parseJson(row.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
  }
}
