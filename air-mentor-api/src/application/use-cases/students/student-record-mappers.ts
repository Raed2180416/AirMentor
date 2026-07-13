/**
 * Pure student-record projections, moved verbatim from the legacy students
 * module. They operate on framework-free row shapes (structural supersets of the
 * Drizzle rows the repository loads) and produce the exact response objects the
 * routes returned before the split.
 */
import type {
  AcademicProfileRow,
  BatchRow,
  BranchRow,
  DepartmentRow,
  EnrollmentRow,
  MappedEnrollment,
  MappedMentorAssignment,
  MentorAssignmentRow,
  StudentBaseRow,
  StudentRecord,
  TermRow,
} from './students-domain.js'

export function mapEnrollment(row: EnrollmentRow): MappedEnrollment {
  return {
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    branchId: row.branchId,
    termId: row.termId,
    sectionCode: row.sectionCode,
    rosterOrder: row.rosterOrder,
    academicStatus: row.academicStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapMentorAssignment(row: MentorAssignmentRow): MappedMentorAssignment {
  return {
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    facultyId: row.facultyId,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    source: row.source,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapStudentRecord(params: {
  student: StudentBaseRow
  enrollmentRows: Array<EnrollmentRow>
  assignmentRows: Array<MentorAssignmentRow>
  profileRows: Array<AcademicProfileRow>
  termRows: Array<TermRow>
  branchRows: Array<BranchRow>
  departmentRows: Array<DepartmentRow>
  batchRows: Array<BatchRow>
}): StudentRecord {
  const termById = Object.fromEntries(params.termRows.map(row => [row.termId, row]))
  const branchById = Object.fromEntries(params.branchRows.map(row => [row.branchId, row]))
  const departmentById = Object.fromEntries(params.departmentRows.map(row => [row.departmentId, row]))
  const batchById = Object.fromEntries(params.batchRows.map(row => [row.batchId, row]))
  return {
    ...params.student,
    currentCgpa: (params.profileRows.find(item => item.studentId === params.student.studentId)?.prevCgpaScaled ?? 0) / 100,
    activeAcademicContext: (() => {
      const currentEnrollment = params.enrollmentRows
        .filter(item => item.studentId === params.student.studentId)
        .sort((left, right) => {
          if (left.endDate === null && right.endDate !== null) return -1
          if (left.endDate !== null && right.endDate === null) return 1
          return right.startDate.localeCompare(left.startDate)
        })[0]
      if (!currentEnrollment) return null
      const term = termById[currentEnrollment.termId]
      const branch = branchById[currentEnrollment.branchId]
      const department = branch ? departmentById[branch.departmentId] : null
      const batch = term?.batchId ? batchById[term.batchId] : null
      return {
        enrollmentId: currentEnrollment.enrollmentId,
        branchId: currentEnrollment.branchId,
        branchName: branch?.name ?? null,
        departmentId: department?.departmentId ?? null,
        departmentName: department?.name ?? null,
        termId: currentEnrollment.termId,
        academicYearLabel: term?.academicYearLabel ?? null,
        semesterNumber: term?.semesterNumber ?? null,
        sectionCode: currentEnrollment.sectionCode,
        batchId: batch?.batchId ?? term?.batchId ?? null,
        batchLabel: batch?.batchLabel ?? null,
        admissionYear: batch?.admissionYear ?? null,
        academicStatus: currentEnrollment.academicStatus,
      }
    })(),
    activeMentorAssignment: (() => {
      const activeAssignment = params.assignmentRows
        .filter(item => item.studentId === params.student.studentId)
        .sort((left, right) => {
          if (left.effectiveTo === null && right.effectiveTo !== null) return -1
          if (left.effectiveTo !== null && right.effectiveTo === null) return 1
          return right.effectiveFrom.localeCompare(left.effectiveFrom)
        })[0]
      return activeAssignment ? mapMentorAssignment(activeAssignment) : null
    })(),
    enrollments: params.enrollmentRows.filter(item => item.studentId === params.student.studentId).map(mapEnrollment),
    mentorAssignments: params.assignmentRows.filter(item => item.studentId === params.student.studentId).map(mapMentorAssignment),
  }
}
