/**
 * Students repository port.
 *
 * Framework-free interface for every DB access the students / enrollments /
 * mentor-assignment use-cases need. MUST NOT import db/schema or drizzle-orm —
 * the Drizzle implementation lives under adapters/persistence (ESLint enforces).
 * Read methods return the domain row shapes (structural subsets of the Drizzle
 * rows); write methods own id + clock generation exactly as the legacy handlers
 * did, except the bulk-apply inserts which receive a caller-built row so the
 * whole batch shares one timestamp.
 */
import type {
  BatchRow,
  BranchRow,
  DepartmentRow,
  EnrollmentRow,
  FacultyRef,
  MentorAssignmentRow,
  MentorBulkApplyRows,
  StudentBaseRow,
  StudentCrossDataset,
  StudentDirectoryDataset,
} from '../use-cases/students/students-domain.js'

export type CreateStudentInput = {
  institutionId: string
  usn: string
  rollNumber: string | null
  name: string
  email: string | null
  phone: string | null
  admissionDate: string
  status: string
}

export type UpdateStudentInput = {
  studentId: string
  usn: string
  rollNumber: string | null
  name: string
  email: string | null
  phone: string | null
  admissionDate: string
  status: string
  currentVersion: number
}

export type CreateEnrollmentInput = {
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder: number
  academicStatus: string
  startDate: string
  endDate: string | null
}

export type UpdateEnrollmentInput = {
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder: number
  academicStatus: string
  startDate: string
  endDate: string | null
  currentVersion: number
}

export type CreateMentorAssignmentInput = {
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
}

export type UpdateMentorAssignmentInput = {
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
  currentVersion: number
}

export type EndMentorAssignmentInput = {
  assignmentId: string
  effectiveTo: string
  version: number
  updatedAt: string
}

export interface StudentsRepository {
  // GET /api/admin/students
  loadStudentDirectoryDataset(): Promise<StudentDirectoryDataset>

  // POST /api/admin/students
  getInstitutionIdForNewStudent(): Promise<string | null>
  createStudent(input: CreateStudentInput): Promise<StudentBaseRow>

  // PATCH /api/admin/students/:studentId
  getStudentById(studentId: string): Promise<StudentBaseRow | null>
  updateStudent(input: UpdateStudentInput): Promise<StudentBaseRow>

  // POST /api/admin/students + PATCH /api/admin/students/:studentId (record projection)
  loadStudentCrossDataset(): Promise<StudentCrossDataset>

  // POST /api/admin/students/:studentId/enrollments
  createEnrollment(input: CreateEnrollmentInput): Promise<EnrollmentRow>

  // PATCH /api/admin/enrollments/:enrollmentId
  getEnrollmentById(enrollmentId: string): Promise<EnrollmentRow | null>
  updateEnrollment(input: UpdateEnrollmentInput): Promise<EnrollmentRow>

  // POST /api/admin/mentor-assignments
  createMentorAssignment(input: CreateMentorAssignmentInput): Promise<MentorAssignmentRow>

  // PATCH /api/admin/mentor-assignments/:assignmentId
  getMentorAssignmentById(assignmentId: string): Promise<MentorAssignmentRow | null>
  updateMentorAssignment(input: UpdateMentorAssignmentInput): Promise<MentorAssignmentRow>

  // POST /api/admin/mentor-assignments/bulk-apply
  getBulkBatch(batchId: string): Promise<BatchRow | null>
  getBulkBranch(branchId: string): Promise<BranchRow | null>
  getBulkDepartment(departmentId: string): Promise<DepartmentRow | null>
  getBulkFaculty(facultyId: string): Promise<FacultyRef | null>
  loadMentorBulkApplyRows(): Promise<MentorBulkApplyRows>
  endMentorAssignment(input: EndMentorAssignmentInput): Promise<void>
  insertMentorAssignment(row: MentorAssignmentRow): Promise<void>
}
