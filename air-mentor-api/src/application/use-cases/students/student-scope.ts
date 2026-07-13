/**
 * Pure scope helpers for the student directory + mentor bulk-apply routes, moved
 * verbatim from the legacy module. `enrichStudentRecordWithProvenance` keeps the
 * same cache-per-batch behavior but takes an injected `resolveBatchPolicy`
 * closure (bound to the RouteContext by the controller) instead of importing the
 * persistence-bound resolver directly.
 */
import { normalizeSectionCode } from '../../../lib/stage-policy.js'
import type {
  ResolveBatchPolicyForStudents,
  ResolvedBatchPolicySnapshot,
  StudentDirectoryScopeFilter,
  StudentRecord,
  StudentRecordWithProvenance,
} from './students-domain.js'

export function buildStudentScopeCacheKey(batchId: string, sectionCode?: string | null) {
  return `${batchId}::${(sectionCode ?? '').trim().toUpperCase()}`
}

export async function enrichStudentRecordWithProvenance(
  resolveBatchPolicy: ResolveBatchPolicyForStudents,
  student: StudentRecord,
  cache: Map<string, ResolvedBatchPolicySnapshot>,
): Promise<StudentRecordWithProvenance> {
  const batchId = student.activeAcademicContext?.batchId
  if (!batchId) return student
  const sectionCode = student.activeAcademicContext?.sectionCode ?? null
  const cacheKey = buildStudentScopeCacheKey(batchId, sectionCode)
  let resolvedPolicy = cache.get(cacheKey)
  if (!resolvedPolicy) {
    resolvedPolicy = await resolveBatchPolicy(batchId, { sectionCode })
    cache.set(cacheKey, resolvedPolicy)
  }
  return {
    ...student,
    scopeDescriptor: {
      ...resolvedPolicy.scopeDescriptor,
      studentId: student.studentId,
    },
    resolvedFrom: resolvedPolicy.resolvedFrom,
    scopeMode: resolvedPolicy.scopeMode,
    countSource: resolvedPolicy.countSource,
    activeOperationalSemester: resolvedPolicy.activeOperationalSemester,
  }
}

export function normalizeStudentIdSet(studentIds: string[] | undefined) {
  return Array.from(new Set((studentIds ?? []).map(item => item.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function isVisibleStudentStatus(status: string | null | undefined) {
  const normalizedStatus = (status ?? 'active').toLowerCase()
  return normalizedStatus !== 'deleted' && normalizedStatus !== 'archived' && normalizedStatus !== 'hidden'
}

export function hasStudentDirectoryScopeFilter(filter: StudentDirectoryScopeFilter) {
  return Boolean(filter.academicFacultyId || filter.departmentId || filter.branchId || filter.batchId || filter.sectionCode)
}

export function matchesStudentDirectoryScope(
  student: StudentRecord,
  academicFacultyByDepartmentId: Map<string, string | null>,
  filter: StudentDirectoryScopeFilter,
) {
  if (!hasStudentDirectoryScopeFilter(filter)) return true
  const context = student.activeAcademicContext
  if (!context) return false
  if (filter.academicFacultyId) {
    const academicFacultyId = context.departmentId ? academicFacultyByDepartmentId.get(context.departmentId) ?? null : null
    if (academicFacultyId !== filter.academicFacultyId) return false
  }
  if (filter.departmentId && context.departmentId !== filter.departmentId) return false
  if (filter.branchId && context.branchId !== filter.branchId) return false
  if (filter.batchId && context.batchId !== filter.batchId) return false
  if (filter.sectionCode && normalizeSectionCode(context.sectionCode) !== normalizeSectionCode(filter.sectionCode)) return false
  return true
}

export function buildBulkMentorScopeLabel(batchLabel: string, sectionCode: string | null) {
  return sectionCode ? `Batch ${batchLabel} · Section ${sectionCode}` : `Batch ${batchLabel}`
}
