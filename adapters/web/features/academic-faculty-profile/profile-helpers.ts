import { T } from '@web/simulation/fixtures'
import { withAlpha } from '@web/shared/ui/primitives'
import type {
  ApiAcademicFacultyProfile,
  ApiAdminCalendarMarker,
  ApiFacultyProofOperations,
  ApiSimulationStageCheckpointSummary,
} from '@web/shared/api/types'

export const subtleDividerStyle = {
  height: 1,
  background: `linear-gradient(90deg, transparent, ${withAlpha(T.border2, '26')} 14%, ${withAlpha(T.border2, '62')} 50%, ${withAlpha(T.border2, '26')} 86%, transparent)`,
  opacity: 0.9,
}

export function formatDateLabel(value?: string | null) {
  if (!value) return 'Not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatEvidencePct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : 'Not recorded yet'
}

export function describeCalendarMarkerType(markerType: ApiAdminCalendarMarker['markerType']) {
  if (markerType === 'semester-start') return 'Semester Start'
  if (markerType === 'semester-end') return 'Semester End'
  if (markerType === 'term-test-start') return 'Term Test Start'
  if (markerType === 'term-test-end') return 'Term Test End'
  if (markerType === 'holiday') return 'Holiday'
  return 'Event'
}

export type FacultyProfile = ApiAcademicFacultyProfile
export type ProofOps = ApiFacultyProofOperations
export type ProofRunContext = ApiFacultyProofOperations['activeRunContexts'][number]
export type ProofMonitoringItem = ApiFacultyProofOperations['monitoringQueue'][number]
export type ProofElectiveFit = ApiFacultyProofOperations['electiveFits'][number]
export type ProofCheckpoint = ApiSimulationStageCheckpointSummary
export type ProofBatchContext = ApiAcademicFacultyProfile['currentBatchContexts'][number]
export type ProofCourseLeaderScopeItem = {
  subjectRunId: string
  courseCode: string
  title: string
  yearLabel: string
  sectionCodes: string[]
}
