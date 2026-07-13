import type {
  ApiAdminRequestSummary,
  ApiFacultyRecord,
} from '@web/shared/api/types'
import type {
  LiveAdminDataset,
  LiveAdminSearchOptions,
  LiveAdminSearchResult,
  LiveAdminSearchScope,
  LiveAdminSectionId,
} from './types'
import {
  deriveCurrentYearLabel,
  hasHierarchyScopeSelection,
  isVisibleAdminRecord,
} from './helpers'
import { resolveBatch, resolveBranch, resolveDepartment } from './resolvers'
import {
  isAcademicFacultyVisible,
  isBatchVisible,
  isBranchVisible,
  isCourseVisible,
  isDepartmentVisible,
  isFacultyMemberVisible,
  isStudentVisible,
} from './visibility'
import { getPrimaryAppointmentDepartmentId } from './listings'

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function matchesSearchSection(candidateSection: LiveAdminSectionId, activeSection?: LiveAdminSectionId) {
  if (!activeSection || activeSection === 'overview' || activeSection === 'proof-dashboard') return true
  if (activeSection === 'history') return candidateSection === 'requests'
  return candidateSection === activeSection
}

function scoreHierarchyScope(candidate: LiveAdminSearchScope, activeScope?: LiveAdminSearchScope | null) {
  if (!activeScope) return 0
  let score = 0
  if (activeScope.academicFacultyId) {
    if (candidate.academicFacultyId !== activeScope.academicFacultyId) return -1
    score += 1
  }
  if (activeScope.departmentId) {
    if (candidate.departmentId !== activeScope.departmentId) return -1
    score += 1
  }
  if (activeScope.branchId) {
    if (candidate.branchId !== activeScope.branchId) return -1
    score += 1
  }
  if (activeScope.batchId) {
    if (candidate.batchId !== activeScope.batchId) return -1
    score += 1
  }
  if (activeScope.sectionCode) {
    if (candidate.sectionCode !== activeScope.sectionCode) return -1
    score += 1
  }
  return score
}

function buildDepartmentScope(data: LiveAdminDataset, departmentId?: string | null): LiveAdminSearchScope {
  const department = resolveDepartment(data, departmentId)
  return {
    academicFacultyId: department?.academicFacultyId ?? undefined,
    departmentId: department?.departmentId ?? undefined,
  }
}

function buildBranchScope(data: LiveAdminDataset, branchId?: string | null): LiveAdminSearchScope {
  const branch = resolveBranch(data, branchId)
  const department = branch ? resolveDepartment(data, branch.departmentId) : null
  return {
    academicFacultyId: department?.academicFacultyId ?? undefined,
    departmentId: department?.departmentId ?? undefined,
    branchId: branch?.branchId ?? undefined,
  }
}

function buildBatchScope(data: LiveAdminDataset, batchId?: string | null): LiveAdminSearchScope {
  const batch = resolveBatch(data, batchId)
  const branch = batch ? resolveBranch(data, batch.branchId) : null
  const department = branch ? resolveDepartment(data, branch.departmentId) : null
  return {
    academicFacultyId: department?.academicFacultyId ?? undefined,
    departmentId: department?.departmentId ?? undefined,
    branchId: branch?.branchId ?? undefined,
    batchId: batch?.batchId ?? undefined,
  }
}

function buildOfferingScope(data: LiveAdminDataset, offeringId?: string | null): LiveAdminSearchScope {
  const offering = offeringId ? data.offerings.find(item => item.offId === offeringId) ?? null : null
  const term = offering?.termId ? data.terms.find(item => item.termId === offering.termId) ?? null : null
  const branch = resolveBranch(data, offering?.branchId ?? term?.branchId ?? null)
  const department = branch ? resolveDepartment(data, branch.departmentId) : null
  return {
    academicFacultyId: department?.academicFacultyId ?? undefined,
    departmentId: department?.departmentId ?? undefined,
    branchId: branch?.branchId ?? undefined,
    batchId: term?.batchId ?? undefined,
    sectionCode: offering?.section ?? undefined,
  }
}

function getFacultyScopeScore(data: LiveAdminDataset, facultyMember: ApiFacultyRecord, activeScope?: LiveAdminSearchScope | null) {
  if (!activeScope) return 0
  const appointmentScores = facultyMember.appointments
    .filter(item => isVisibleAdminRecord(item.status))
    .map(appointment => scoreHierarchyScope({
      ...buildBranchScope(data, appointment.branchId ?? null),
      departmentId: appointment.departmentId,
    }, activeScope))

  const ownershipScores = data.ownerships
    .filter(item => item.facultyId === facultyMember.facultyId && item.status === 'active')
    .map(item => scoreHierarchyScope(buildOfferingScope(data, item.offeringId), activeScope))

  const scores = [...appointmentScores, ...ownershipScores]
  return scores.length > 0 ? Math.max(...scores) : -1
}

function getRequestScopeScore(data: LiveAdminDataset, request: ApiAdminRequestSummary, activeScope?: LiveAdminSearchScope | null) {
  if (!activeScope) return 0
  if (request.scopeType === 'academic-faculty') return scoreHierarchyScope({ academicFacultyId: request.scopeId }, activeScope)
  if (request.scopeType === 'department') return scoreHierarchyScope(buildDepartmentScope(data, request.scopeId), activeScope)
  if (request.scopeType === 'branch') return scoreHierarchyScope(buildBranchScope(data, request.scopeId), activeScope)
  if (request.scopeType === 'batch') return scoreHierarchyScope(buildBatchScope(data, request.scopeId), activeScope)
  return 0
}

export function searchLiveAdminWorkspace(data: LiveAdminDataset, rawQuery: string, options: LiveAdminSearchOptions = {}): LiveAdminSearchResult[] {
  const query = normalizeSearch(rawQuery)
  if (!query) return []
  if (options.section === 'students' && !hasHierarchyScopeSelection(options.scope)) return []

  const results: Array<{ result: LiveAdminSearchResult; scopeScore: number }> = []
  const pushResult = (result: LiveAdminSearchResult, candidateSection: LiveAdminSectionId, scopeScore: number) => {
    if (!matchesSearchSection(candidateSection, options.section)) return
    if (scopeScore < 0 && options.section && options.section !== 'overview') return
    results.push({ result, scopeScore })
  }

  for (const academicFaculty of data.academicFaculties) {
    if (!isAcademicFacultyVisible(data, academicFaculty)) continue
    if (![academicFaculty.name, academicFaculty.code, academicFaculty.overview ?? ''].some(value => value.toLowerCase().includes(query))) continue
    pushResult({
      key: `academic-faculty:${academicFaculty.academicFacultyId}`,
      label: academicFaculty.name,
      meta: `Academic faculty · ${academicFaculty.code}`,
      route: { section: 'faculties', academicFacultyId: academicFaculty.academicFacultyId },
    }, 'faculties', scoreHierarchyScope({ academicFacultyId: academicFaculty.academicFacultyId }, options.scope))
  }

  for (const department of data.departments) {
    if (!isDepartmentVisible(data, department)) continue
    if (![department.name, department.code].some(value => value.toLowerCase().includes(query))) continue
    pushResult({
      key: `department:${department.departmentId}`,
      label: department.name,
      meta: `Department · ${department.code}`,
      route: {
        section: 'faculties',
        academicFacultyId: department.academicFacultyId ?? undefined,
        departmentId: department.departmentId,
      },
    }, 'faculties', scoreHierarchyScope(buildDepartmentScope(data, department.departmentId), options.scope))
  }

  for (const branch of data.branches) {
    if (!isBranchVisible(data, branch)) continue
    if (![branch.name, branch.code, branch.programLevel].some(value => value.toLowerCase().includes(query))) continue
    const department = resolveDepartment(data, branch.departmentId)
    pushResult({
      key: `branch:${branch.branchId}`,
      label: branch.name,
      meta: `Branch · ${department?.code ?? 'NA'} · ${branch.programLevel}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? undefined,
        departmentId: branch.departmentId,
        branchId: branch.branchId,
      },
    }, 'faculties', scoreHierarchyScope(buildBranchScope(data, branch.branchId), options.scope))
  }

  for (const batch of data.batches) {
    if (!isBatchVisible(data, batch)) continue
    const branch = resolveBranch(data, batch.branchId)
    if (![batch.batchLabel, String(batch.admissionYear), branch?.name ?? ''].some(value => value.toLowerCase().includes(query))) continue
    const department = branch ? resolveDepartment(data, branch.departmentId) : null
    pushResult({
      key: `batch:${batch.batchId}`,
      label: `Batch ${batch.batchLabel}`,
      meta: `${branch?.code ?? 'NA'} · ${deriveCurrentYearLabel(batch.currentSemester)}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? undefined,
        departmentId: department?.departmentId,
        branchId: branch?.branchId,
        batchId: batch.batchId,
      },
    }, 'faculties', scoreHierarchyScope(buildBatchScope(data, batch.batchId), options.scope))
  }

  for (const student of data.students) {
    if (!isStudentVisible(data, student)) continue
    const activeContext = student.activeAcademicContext
    if (![student.name, student.usn, student.email ?? '', activeContext?.branchName ?? '', activeContext?.departmentName ?? ''].some(value => value.toLowerCase().includes(query))) continue
    pushResult({
      key: `student:${student.studentId}`,
      label: student.name,
      meta: `${student.usn} · ${activeContext?.departmentName ?? 'No department'}`,
      route: { section: 'students', studentId: student.studentId },
    }, 'students', scoreHierarchyScope({
      academicFacultyId: activeContext?.departmentId ? resolveDepartment(data, activeContext.departmentId)?.academicFacultyId ?? undefined : undefined,
      departmentId: activeContext?.departmentId ?? undefined,
      branchId: activeContext?.branchId ?? undefined,
      batchId: activeContext?.batchId ?? undefined,
      sectionCode: activeContext?.sectionCode ?? undefined,
    }, options.scope))
  }

  for (const facultyMember of data.facultyMembers) {
    if (!isFacultyMemberVisible(data, facultyMember)) continue
    if (![facultyMember.displayName, facultyMember.employeeCode, facultyMember.email, facultyMember.username].some(value => value.toLowerCase().includes(query))) continue
    const primaryDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(facultyMember))
    pushResult({
      key: `faculty-member:${facultyMember.facultyId}`,
      label: facultyMember.displayName,
      meta: `${facultyMember.employeeCode} · ${primaryDepartment?.name ?? 'No primary department'}`,
      route: { section: 'faculty-members', facultyMemberId: facultyMember.facultyId },
    }, 'faculty-members', getFacultyScopeScore(data, facultyMember, options.scope))
  }

  for (const course of data.courses) {
    if (!isCourseVisible(data, course)) continue
    if (![course.courseCode, course.title].some(value => value.toLowerCase().includes(query))) continue
    const department = resolveDepartment(data, course.departmentId)
    pushResult({
      key: `course:${course.courseId}`,
      label: `${course.courseCode} · ${course.title}`,
      meta: `Course catalog · ${department?.code ?? 'NA'}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? undefined,
        departmentId: department?.departmentId,
      },
    }, 'faculties', scoreHierarchyScope(buildDepartmentScope(data, course.departmentId), options.scope))
  }

  for (const request of data.requests) {
    if (![request.summary, request.details, request.requestType, request.requesterName ?? '', request.ownerName ?? '', request.priority, request.status].some(value => value.toLowerCase().includes(query))) continue
    pushResult({
      key: `request:${request.adminRequestId}`,
      label: request.summary,
      meta: `${request.requestType} · ${request.priority} · ${request.status}`,
      route: { section: 'requests', requestId: request.adminRequestId },
    }, 'requests', getRequestScopeScore(data, request, options.scope))
  }

  return results
    .sort((left, right) => right.scopeScore - left.scopeScore || left.result.label.localeCompare(right.result.label))
    .map(entry => entry.result)
    .slice(0, 16)
}
