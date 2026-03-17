import type {
  ApiAcademicFaculty,
  ApiAcademicTerm,
  ApiAdminOffering,
  ApiAdminRequestSummary,
  ApiAdminReminder,
  ApiBatch,
  ApiBranch,
  ApiCourse,
  ApiCurriculumCourse,
  ApiDepartment,
  ApiFacultyRecord,
  ApiInstitution,
  ApiOfferingOwnership,
  ApiPolicyOverride,
  ApiStudentRecord,
} from './api/types'

export type LiveAdminSectionId = 'overview' | 'faculties' | 'students' | 'faculty-members' | 'requests' | 'history'

export type LiveAdminDataset = {
  institution: ApiInstitution | null
  academicFaculties: ApiAcademicFaculty[]
  departments: ApiDepartment[]
  branches: ApiBranch[]
  batches: ApiBatch[]
  terms: ApiAcademicTerm[]
  facultyMembers: ApiFacultyRecord[]
  students: ApiStudentRecord[]
  courses: ApiCourse[]
  curriculumCourses: ApiCurriculumCourse[]
  policyOverrides: ApiPolicyOverride[]
  offerings: ApiAdminOffering[]
  ownerships: ApiOfferingOwnership[]
  requests: ApiAdminRequestSummary[]
  reminders: ApiAdminReminder[]
}

export type LiveAdminRoute = {
  section: LiveAdminSectionId
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  studentId?: string
  facultyMemberId?: string
  requestId?: string
}

export type LiveAdminSearchResult = {
  key: string
  label: string
  meta: string
  route: LiveAdminRoute
}

export function deriveCurrentYearLabel(currentSemester: number) {
  const year = Math.max(1, Math.ceil(currentSemester / 2))
  if (year === 1) return '1st Year'
  if (year === 2) return '2nd Year'
  if (year === 3) return '3rd Year'
  return `${year}th Year`
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export function isVisibleAdminRecord(status?: string | null) {
  const normalized = (status ?? 'active').toLowerCase()
  return normalized !== 'archived' && normalized !== 'deleted'
}

function toAcademicFaculty(data: LiveAdminDataset, candidate?: ApiAcademicFaculty | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveAcademicFaculty(data, candidate) : candidate
}

function toDepartment(data: LiveAdminDataset, candidate?: ApiDepartment | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveDepartment(data, candidate) : candidate
}

function toBranch(data: LiveAdminDataset, candidate?: ApiBranch | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveBranch(data, candidate) : candidate
}

function toBatch(data: LiveAdminDataset, candidate?: ApiBatch | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveBatch(data, candidate) : candidate
}

function toTerm(data: LiveAdminDataset, candidate?: ApiAcademicTerm | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? data.terms.find(item => item.termId === candidate) ?? null : candidate
}

function toCourse(data: LiveAdminDataset, candidate?: ApiCourse | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? data.courses.find(item => item.courseId === candidate) ?? null : candidate
}

function toStudent(data: LiveAdminDataset, candidate?: ApiStudentRecord | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveStudent(data, candidate) : candidate
}

function toFacultyMember(data: LiveAdminDataset, candidate?: ApiFacultyRecord | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveFacultyMember(data, candidate) : candidate
}

export function isAcademicFacultyVisible(data: LiveAdminDataset, candidate?: ApiAcademicFaculty | string | null) {
  const academicFaculty = toAcademicFaculty(data, candidate)
  return academicFaculty ? isVisibleAdminRecord(academicFaculty.status) : false
}

export function isDepartmentVisible(data: LiveAdminDataset, candidate?: ApiDepartment | string | null) {
  const department = toDepartment(data, candidate)
  if (!department || !isVisibleAdminRecord(department.status)) return false
  return !department.academicFacultyId || isAcademicFacultyVisible(data, department.academicFacultyId)
}

export function isBranchVisible(data: LiveAdminDataset, candidate?: ApiBranch | string | null) {
  const branch = toBranch(data, candidate)
  if (!branch || !isVisibleAdminRecord(branch.status)) return false
  return isDepartmentVisible(data, branch.departmentId)
}

export function isBatchVisible(data: LiveAdminDataset, candidate?: ApiBatch | string | null) {
  const batch = toBatch(data, candidate)
  if (!batch || !isVisibleAdminRecord(batch.status)) return false
  return isBranchVisible(data, batch.branchId)
}

export function isTermVisible(data: LiveAdminDataset, candidate?: ApiAcademicTerm | string | null) {
  const term = toTerm(data, candidate)
  if (!term || !isVisibleAdminRecord(term.status)) return false
  if (!isBranchVisible(data, term.branchId)) return false
  return !term.batchId || isBatchVisible(data, term.batchId)
}

export function isCourseVisible(data: LiveAdminDataset, candidate?: ApiCourse | string | null) {
  const course = toCourse(data, candidate)
  if (!course || !isVisibleAdminRecord(course.status)) return false
  return isDepartmentVisible(data, course.departmentId)
}

export function isStudentVisible(data: LiveAdminDataset, candidate?: ApiStudentRecord | string | null) {
  const student = toStudent(data, candidate)
  if (!student || !isVisibleAdminRecord(student.status)) return false
  const context = student.activeAcademicContext
  if (!context) return true
  if (context.batchId && !isBatchVisible(data, context.batchId)) return false
  if (context.branchId && !isBranchVisible(data, context.branchId)) return false
  if (context.departmentId && !isDepartmentVisible(data, context.departmentId)) return false
  return true
}

export function isFacultyMemberVisible(data: LiveAdminDataset, candidate?: ApiFacultyRecord | string | null) {
  const facultyMember = toFacultyMember(data, candidate)
  if (!facultyMember || !isVisibleAdminRecord(facultyMember.status)) return false
  const visibleAppointments = facultyMember.appointments.filter(item => isVisibleAdminRecord(item.status))
  if (visibleAppointments.length === 0) return true
  return visibleAppointments.some(appointment => {
    if (!isDepartmentVisible(data, appointment.departmentId)) return false
    return !appointment.branchId || isBranchVisible(data, appointment.branchId)
  })
}

export function resolveAcademicFaculty(data: LiveAdminDataset, academicFacultyId?: string | null) {
  return academicFacultyId ? data.academicFaculties.find(item => item.academicFacultyId === academicFacultyId) ?? null : null
}

export function resolveDepartment(data: LiveAdminDataset, departmentId?: string | null) {
  return departmentId ? data.departments.find(item => item.departmentId === departmentId) ?? null : null
}

export function resolveBranch(data: LiveAdminDataset, branchId?: string | null) {
  return branchId ? data.branches.find(item => item.branchId === branchId) ?? null : null
}

export function resolveBatch(data: LiveAdminDataset, batchId?: string | null) {
  return batchId ? data.batches.find(item => item.batchId === batchId) ?? null : null
}

export function resolveStudent(data: LiveAdminDataset, studentId?: string | null) {
  return studentId ? data.students.find(item => item.studentId === studentId) ?? null : null
}

export function resolveFacultyMember(data: LiveAdminDataset, facultyMemberId?: string | null) {
  return facultyMemberId ? data.facultyMembers.find(item => item.facultyId === facultyMemberId) ?? null : null
}

export function listDepartmentsForAcademicFaculty(data: LiveAdminDataset, academicFacultyId?: string | null) {
  if (academicFacultyId && !isAcademicFacultyVisible(data, academicFacultyId)) return []
  return data.departments.filter(item => item.academicFacultyId === (academicFacultyId ?? null) && isDepartmentVisible(data, item))
}

export function listBranchesForDepartment(data: LiveAdminDataset, departmentId?: string | null) {
  if (departmentId && !isDepartmentVisible(data, departmentId)) return []
  return data.branches.filter(item => item.departmentId === departmentId && isBranchVisible(data, item))
}

export function listBatchesForBranch(data: LiveAdminDataset, branchId?: string | null) {
  if (branchId && !isBranchVisible(data, branchId)) return []
  return data.batches
    .filter(item => item.branchId === branchId && isBatchVisible(data, item))
    .sort((left, right) => right.admissionYear - left.admissionYear)
}

export function listTermsForBatch(data: LiveAdminDataset, batchId?: string | null) {
  if (batchId && !isBatchVisible(data, batchId)) return []
  return data.terms
    .filter(item => item.batchId === batchId && isTermVisible(data, item))
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.startDate.localeCompare(right.startDate))
}

export function listCurriculumBySemester(data: LiveAdminDataset, batchId?: string | null) {
  if (batchId && !isBatchVisible(data, batchId)) return []
  const semesters = new Map<number, ApiCurriculumCourse[]>()
  for (const item of data.curriculumCourses.filter(course => course.batchId === batchId && isVisibleAdminRecord(course.status))) {
    const bucket = semesters.get(item.semesterNumber) ?? []
    bucket.push(item)
    semesters.set(item.semesterNumber, bucket)
  }
  return Array.from(semesters.entries())
    .sort(([left], [right]) => left - right)
    .map(([semesterNumber, courses]) => ({
      semesterNumber,
      courses: courses.sort((left, right) => left.courseCode.localeCompare(right.courseCode)),
    }))
}

export function getPrimaryAppointmentDepartmentId(facultyMember: ApiFacultyRecord) {
  return facultyMember.appointments.find(item => item.isPrimary)?.departmentId ?? facultyMember.appointments[0]?.departmentId ?? null
}

export function listFacultyAssignments(data: LiveAdminDataset, facultyId: string) {
  return data.ownerships
    .filter(item => item.facultyId === facultyId && item.status === 'active')
    .map(item => {
      const offering = data.offerings.find(candidate => candidate.offId === item.offeringId) ?? null
      return {
        ownership: item,
        offering,
      }
    })
    .filter(item => item.offering && (!item.offering?.branchId || isBranchVisible(data, item.offering.branchId)))
}

export function searchLiveAdminWorkspace(data: LiveAdminDataset, rawQuery: string): LiveAdminSearchResult[] {
  const query = normalizeSearch(rawQuery)
  if (!query) return []

  const results: LiveAdminSearchResult[] = []

  for (const academicFaculty of data.academicFaculties) {
    if (!isAcademicFacultyVisible(data, academicFaculty)) continue
    if (![academicFaculty.name, academicFaculty.code, academicFaculty.overview ?? ''].some(value => value.toLowerCase().includes(query))) continue
    results.push({
      key: `academic-faculty:${academicFaculty.academicFacultyId}`,
      label: academicFaculty.name,
      meta: `Academic faculty · ${academicFaculty.code}`,
      route: { section: 'faculties', academicFacultyId: academicFaculty.academicFacultyId },
    })
  }

  for (const department of data.departments) {
    if (!isDepartmentVisible(data, department)) continue
    if (![department.name, department.code].some(value => value.toLowerCase().includes(query))) continue
    results.push({
      key: `department:${department.departmentId}`,
      label: department.name,
      meta: `Department · ${department.code}`,
      route: {
        section: 'faculties',
        academicFacultyId: department.academicFacultyId ?? undefined,
        departmentId: department.departmentId,
      },
    })
  }

  for (const branch of data.branches) {
    if (!isBranchVisible(data, branch)) continue
    if (![branch.name, branch.code, branch.programLevel].some(value => value.toLowerCase().includes(query))) continue
    const department = resolveDepartment(data, branch.departmentId)
    results.push({
      key: `branch:${branch.branchId}`,
      label: branch.name,
      meta: `Branch · ${department?.code ?? 'NA'} · ${branch.programLevel}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? undefined,
        departmentId: branch.departmentId,
        branchId: branch.branchId,
      },
    })
  }

  for (const batch of data.batches) {
    if (!isBatchVisible(data, batch)) continue
    const branch = resolveBranch(data, batch.branchId)
    if (![batch.batchLabel, String(batch.admissionYear), branch?.name ?? ''].some(value => value.toLowerCase().includes(query))) continue
    const department = branch ? resolveDepartment(data, branch.departmentId) : null
    results.push({
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
    })
  }

  for (const student of data.students) {
    if (!isStudentVisible(data, student)) continue
    const activeContext = student.activeAcademicContext
    if (![student.name, student.usn, student.email ?? '', activeContext?.branchName ?? '', activeContext?.departmentName ?? ''].some(value => value.toLowerCase().includes(query))) continue
    results.push({
      key: `student:${student.studentId}`,
      label: student.name,
      meta: `${student.usn} · ${activeContext?.departmentName ?? 'No department'}`,
      route: { section: 'students', studentId: student.studentId },
    })
  }

  for (const facultyMember of data.facultyMembers) {
    if (!isFacultyMemberVisible(data, facultyMember)) continue
    if (![facultyMember.displayName, facultyMember.employeeCode, facultyMember.email, facultyMember.username].some(value => value.toLowerCase().includes(query))) continue
    const primaryDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(facultyMember))
    results.push({
      key: `faculty-member:${facultyMember.facultyId}`,
      label: facultyMember.displayName,
      meta: `${facultyMember.employeeCode} · ${primaryDepartment?.name ?? 'No primary department'}`,
      route: { section: 'faculty-members', facultyMemberId: facultyMember.facultyId },
    })
  }

  for (const course of data.courses) {
    if (!isCourseVisible(data, course)) continue
    if (![course.courseCode, course.title].some(value => value.toLowerCase().includes(query))) continue
    const department = resolveDepartment(data, course.departmentId)
    results.push({
      key: `course:${course.courseId}`,
      label: `${course.courseCode} · ${course.title}`,
      meta: `Course catalog · ${department?.code ?? 'NA'}`,
      route: {
        section: 'faculties',
        academicFacultyId: department?.academicFacultyId ?? undefined,
        departmentId: department?.departmentId,
      },
    })
  }

  return results.slice(0, 16)
}
