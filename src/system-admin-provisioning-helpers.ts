import type {
  ApiFacultyRecord,
  ApiMentorAssignmentBulkApplyRequest,
  ApiMentorAssignmentBulkApplyResponse,
  ApiMentorAssignmentBulkApplySelectionMode,
  ApiRoleGrant,
} from './api/types'
import { buildAdminSectionScopeId, normalizeAdminSectionCode } from './admin-section-scope'
import { isCurrentRoleGrant } from './system-admin-overview-helpers'

export type BulkMentorAssignmentFormState = {
  facultyId: string
  effectiveFrom: string
  source: string
  selectionMode: ApiMentorAssignmentBulkApplySelectionMode
}

function matchesMentorGrantScope(
  grant: ApiRoleGrant,
  batchId: string,
  sectionCode: string | null,
) {
  if (!isCurrentRoleGrant(grant) || grant.roleCode !== 'MENTOR') return false
  if (grant.scopeType === 'institution' || grant.scopeType === 'academic-faculty' || grant.scopeType === 'department' || grant.scopeType === 'branch') {
    return true
  }
  if (grant.scopeType === 'batch') return grant.scopeId === batchId
  if (grant.scopeType === 'section') {
    return sectionCode !== null && grant.scopeId === buildAdminSectionScopeId(batchId, normalizeAdminSectionCode(sectionCode))
  }
  return false
}

function formatGrantScopeLabel(grant: ApiRoleGrant) {
  const explicitLabel = grant.scopeLabel?.trim()
  if (explicitLabel) return explicitLabel
  const scopeId = grant.scopeId.trim()
  switch (grant.scopeType) {
    case 'institution':
      return 'Institution'
    case 'academic-faculty':
      return `Faculty ${scopeId}`
    case 'department':
      return `Department ${scopeId}`
    case 'branch':
      return `Branch ${scopeId}`
    case 'batch':
      return `Batch ${scopeId}`
    case 'section': {
      const sectionCode = scopeId.split('::').at(-1) ?? scopeId
      return `Section ${sectionCode}`
    }
    default:
      return `${grant.scopeType} ${scopeId}`
  }
}

export function defaultBulkMentorAssignmentForm(
  effectiveFrom = new Date().toISOString().slice(0, 10),
): BulkMentorAssignmentFormState {
  return {
    facultyId: '',
    effectiveFrom,
    source: 'sysadmin-bulk-mentor-apply',
    selectionMode: 'missing-only',
  }
}

export function buildBulkMentorAssignmentPreviewPayload(
  batchId: string,
  sectionCode: string | null,
  form: BulkMentorAssignmentFormState,
): ApiMentorAssignmentBulkApplyRequest {
  return {
    batchId,
    sectionCode,
    facultyId: form.facultyId.trim(),
    effectiveFrom: form.effectiveFrom.trim(),
    source: form.source.trim(),
    selectionMode: form.selectionMode,
    previewOnly: true,
  }
}

export function buildBulkMentorAssignmentApplyPayload(
  batchId: string,
  sectionCode: string | null,
  form: BulkMentorAssignmentFormState,
  expectedStudentIds: string[],
): ApiMentorAssignmentBulkApplyRequest {
  return {
    ...buildBulkMentorAssignmentPreviewPayload(batchId, sectionCode, form),
    previewOnly: false,
    expectedStudentIds,
  }
}

export function getScopedMentorEligibleFaculty(
  facultyPool: ApiFacultyRecord[],
  batchId: string | null,
  sectionCode: string | null,
) {
  if (!batchId) return []
  return facultyPool
    .filter(member => member.status === 'active')
    .filter(member => member.roleGrants.some(grant => matchesMentorGrantScope(grant, batchId, sectionCode)))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}

export function describeScopedFacultyRoles(member: ApiFacultyRecord) {
  const activeGrants = member.roleGrants.filter(isCurrentRoleGrant)
  const activeRoleCodes = Array.from(new Set(activeGrants.map(grant => grant.roleCode)))
  const mentorScopeLabels = activeGrants
    .filter(grant => grant.roleCode === 'MENTOR')
    .map(formatGrantScopeLabel)
  const roleLabel = activeRoleCodes.length > 0 ? activeRoleCodes.join(', ') : 'No active role grants'
  const mentorLabel = mentorScopeLabels.length > 0 ? `Mentor on ${mentorScopeLabels.join(', ')}` : 'No active mentor grant'
  return `${roleLabel} · ${mentorLabel}`
}

export function describeBulkMentorPreview(preview: ApiMentorAssignmentBulkApplyResponse | null) {
  if (!preview) return 'Preview the scoped cohort before applying mentor changes.'
  if (preview.summary.targetedStudentCount === 0) {
    return `No students matched ${preview.scopeLabel} for ${preview.selectionMode === 'missing-only' ? 'mentor gaps' : 'full-scope replacement'}.`
  }
  if (preview.summary.createdAssignmentCount === 0 && preview.summary.endedAssignmentCount === 0) {
    return `The current preview for ${preview.scopeLabel} is already aligned with the selected mentor.`
  }
  return `${preview.summary.targetedStudentCount} students are in scope for ${preview.scopeLabel}; ${preview.summary.createdAssignmentCount} mentor links will be created and ${preview.summary.endedAssignmentCount} active links will be end-dated.`
}
