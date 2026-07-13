/**
 * GET /api/admin/search — scan the admin workspace with optional scope
 * narrowing. The multi-table read is loaded through the repository; the scan /
 * ranking below is moved verbatim from the legacy handler.
 */
import type { AdminControlPlaneRepository } from '../../ports/admin-control-plane-repository.js'
import type { UseCaseResponse } from '../curriculum-graph/shared.js'
import {
  deriveCurrentYearLabel,
  isVisibleStatus,
  normalizeSearch,
  type SearchInput,
  type SearchResultItem,
} from './search-domain.js'

export type SearchAdminWorkspaceDeps = {
  repo: AdminControlPlaneRepository
}

export type SearchAdminWorkspaceInput = {
  query: SearchInput
}

export async function searchAdminWorkspace(
  deps: SearchAdminWorkspaceDeps,
  input: SearchAdminWorkspaceInput,
): Promise<UseCaseResponse> {
  const { repo } = deps
  const query = input.query
  const needle = normalizeSearch(query.q)
  if (!needle) return { status: 200, body: { items: [] } }

  const {
    academicFacultyRows,
    departmentRows,
    branchRows,
    batchRows,
    studentRows,
    facultyRows,
    userRows,
    courseRows,
    requestRows,
  } = await repo.loadSearchDataset()

  const userById = Object.fromEntries(userRows.map(row => [row.userId, row]))
  const departmentById = Object.fromEntries(departmentRows.map(row => [row.departmentId, row]))
  const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))

  const scopedDepartments = departmentRows.filter(row => {
    if (!isVisibleStatus(row.status)) return false
    if (query.academicFacultyId && row.academicFacultyId !== query.academicFacultyId) return false
    if (query.departmentId && row.departmentId !== query.departmentId) return false
    return true
  })
  const scopedDepartmentIds = new Set(scopedDepartments.map(row => row.departmentId))

  const scopedBranches = branchRows.filter(row => {
    if (!isVisibleStatus(row.status)) return false
    if (query.departmentId && row.departmentId !== query.departmentId) return false
    if (query.branchId && row.branchId !== query.branchId) return false
    if (query.academicFacultyId && !scopedDepartmentIds.has(row.departmentId)) return false
    return true
  })
  const scopedBranchIds = new Set(scopedBranches.map(row => row.branchId))

  const scopedBatches = batchRows.filter(row => {
    if (!isVisibleStatus(row.status)) return false
    if (query.branchId && row.branchId !== query.branchId) return false
    if (query.batchId && row.batchId !== query.batchId) return false
    if ((query.departmentId || query.academicFacultyId) && !scopedBranchIds.has(row.branchId)) return false
    return true
  })
  const results: SearchResultItem[] = []

  for (const row of academicFacultyRows) {
    if (!isVisibleStatus(row.status)) continue
    if (query.academicFacultyId && row.academicFacultyId !== query.academicFacultyId) continue
    if (![row.name, row.code, row.overview ?? ''].some(value => value.toLowerCase().includes(needle))) continue
    results.push({
      key: `academic-faculty:${row.academicFacultyId}`,
      entityType: 'academic-faculty',
      entityId: row.academicFacultyId,
      label: row.name,
      meta: `Academic faculty · ${row.code}`,
      route: { section: 'faculties', academicFacultyId: row.academicFacultyId },
    })
  }

  for (const row of scopedDepartments) {
    if (![row.name, row.code].some(value => value.toLowerCase().includes(needle))) continue
    results.push({
      key: `department:${row.departmentId}`,
      entityType: 'department',
      entityId: row.departmentId,
      label: row.name,
      meta: `Department · ${row.code}`,
      route: {
        section: 'faculties',
        academicFacultyId: row.academicFacultyId ?? '',
        departmentId: row.departmentId,
      },
    })
  }

  for (const row of scopedBranches) {
    if (![row.name, row.code, row.programLevel].some(value => value.toLowerCase().includes(needle))) continue
    const department = departmentById[row.departmentId]
    results.push({
      key: `branch:${row.branchId}`,
      entityType: 'branch',
      entityId: row.branchId,
      label: row.name,
      meta: `Branch · ${department?.code ?? 'NA'} · ${row.programLevel}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? '',
        departmentId: row.departmentId,
        branchId: row.branchId,
      },
    })
  }

  for (const row of scopedBatches) {
    const branch = branchById[row.branchId]
    if (![row.batchLabel, String(row.admissionYear), branch?.name ?? ''].some(value => value.toLowerCase().includes(needle))) continue
    const department = branch ? departmentById[branch.departmentId] : null
    results.push({
      key: `batch:${row.batchId}`,
      entityType: 'batch',
      entityId: row.batchId,
      label: `Batch ${row.batchLabel}`,
      meta: `${branch?.code ?? 'NA'} · ${deriveCurrentYearLabel(row.currentSemester)}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? '',
        departmentId: department?.departmentId ?? '',
        branchId: branch?.branchId ?? '',
        batchId: row.batchId,
      },
    })
  }

  for (const row of studentRows) {
    if (!isVisibleStatus(row.status)) continue
    if (![row.name, row.usn, row.email ?? ''].some(value => value.toLowerCase().includes(needle))) continue
    results.push({
      key: `student:${row.studentId}`,
      entityType: 'student',
      entityId: row.studentId,
      label: row.name,
      meta: `Student · ${row.usn}`,
      route: {
        section: 'students',
        studentId: row.studentId,
      },
    })
  }

  for (const row of facultyRows) {
    if (!isVisibleStatus(row.status)) continue
    const user = userById[row.userId]
    if (![row.displayName, row.employeeCode, user?.email ?? '', user?.username ?? ''].some(value => value.toLowerCase().includes(needle))) continue
    results.push({
      key: `faculty-member:${row.facultyId}`,
      entityType: 'faculty-member',
      entityId: row.facultyId,
      label: row.displayName,
      meta: `${row.employeeCode} · ${row.designation}`,
      route: {
        section: 'faculty-members',
        facultyMemberId: row.facultyId,
      },
    })
  }

  for (const row of courseRows) {
    if (!isVisibleStatus(row.status)) continue
    const department = departmentById[row.departmentId]
    if (query.departmentId && row.departmentId !== query.departmentId) continue
    if (query.academicFacultyId && department?.academicFacultyId !== query.academicFacultyId) continue
    if (![row.courseCode, row.title].some(value => value.toLowerCase().includes(needle))) continue
    results.push({
      key: `course:${row.courseId}`,
      entityType: 'course',
      entityId: row.courseId,
      label: `${row.courseCode} · ${row.title}`,
      meta: `Course catalog · ${department?.code ?? 'NA'}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? '',
        departmentId: department?.departmentId ?? '',
      },
    })
  }

  for (const row of requestRows) {
    if (![row.summary, row.details, row.requestType, row.scopeType, row.scopeId].some(value => value.toLowerCase().includes(needle))) continue
    results.push({
      key: `request:${row.adminRequestId}`,
      entityType: 'request',
      entityId: row.adminRequestId,
      label: row.summary,
      meta: `Request · ${row.status} · ${row.requestType}`,
      route: {
        section: 'requests',
        requestId: row.adminRequestId,
      },
    })
  }

  return { status: 200, body: { items: results.slice(0, 20) } }
}
