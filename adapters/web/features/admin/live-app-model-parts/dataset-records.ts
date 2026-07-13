import type {
  ApiAcademicFaculty,
  ApiBatch,
  ApiBranch,
  ApiDepartment,
  ApiFacultyRecord,
  ApiScopeType,
} from '@web/shared/api/types'
import {
  resolveBranch,
  resolveDepartment,
  type LiveAdminDataset,
} from '../system-admin-live-data'
import { parseAdminSectionScopeId } from '../live-app-routes-and-scopes'

export const EMPTY_FACULTY_RECORDS: ApiFacultyRecord[] = []

export const EMPTY_DATA: LiveAdminDataset = {
  institution: null, academicFaculties: [], departments: [], branches: [], batches: [], terms: [],
  facultyMembers: [], students: [], courses: [], curriculumCourses: [], policyOverrides: [],
  offerings: [], ownerships: [], requests: [], reminders: [],
}

export function upsertLiveAdminItem<T>(items: T[], nextItem: T, matches: (item: T) => boolean) {
  return items.some(matches)
    ? items.map(item => matches(item) ? nextItem : item)
    : [nextItem, ...items]
}

export function upsertAcademicFacultyRecord(data: LiveAdminDataset, nextFaculty: ApiAcademicFaculty): LiveAdminDataset {
  return {
    ...data,
    academicFaculties: upsertLiveAdminItem(
      data.academicFaculties,
      nextFaculty,
      item => item.academicFacultyId === nextFaculty.academicFacultyId,
    ),
  }
}

export function upsertDepartmentRecord(data: LiveAdminDataset, nextDepartment: ApiDepartment): LiveAdminDataset {
  return {
    ...data,
    departments: upsertLiveAdminItem(
      data.departments,
      nextDepartment,
      item => item.departmentId === nextDepartment.departmentId,
    ),
  }
}

export function upsertBranchRecord(data: LiveAdminDataset, nextBranch: ApiBranch): LiveAdminDataset {
  return {
    ...data,
    branches: upsertLiveAdminItem(
      data.branches,
      nextBranch,
      item => item.branchId === nextBranch.branchId,
    ),
  }
}

export function upsertBatchRecord(data: LiveAdminDataset, nextBatch: ApiBatch): LiveAdminDataset {
  return {
    ...data,
    batches: upsertLiveAdminItem(
      data.batches,
      nextBatch,
      item => item.batchId === nextBatch.batchId,
    ),
  }
}

export function applyFacultyVisibilityRules(facultyMembers: ApiFacultyRecord[]) {
  return [...facultyMembers].sort((left, right) => {
    const leftLabel = left.displayName.toLowerCase()
    const rightLabel = right.displayName.toLowerCase()
    return leftLabel.localeCompare(rightLabel) || left.facultyId.localeCompare(right.facultyId)
  })
}

export function matchesBatchScope(batch: LiveAdminDataset['batches'][number], data: LiveAdminDataset, scopeType: ApiScopeType, scopeId: string) {
  if (scopeType === 'institution') return true
  if (scopeType === 'batch') return batch.batchId === scopeId
  if (scopeType === 'section') return parseAdminSectionScopeId(scopeId)?.batchId === batch.batchId
  if (scopeType === 'branch') return batch.branchId === scopeId
  const branch = resolveBranch(data, batch.branchId)
  if (!branch) return false
  if (scopeType === 'department') return branch.departmentId === scopeId
  if (scopeType === 'academic-faculty') {
    const department = resolveDepartment(data, branch.departmentId)
    return department?.academicFacultyId === scopeId
  }
  return false
}

export function toOptionalScopeValue(value?: string | null) {
  return value ?? undefined
}
