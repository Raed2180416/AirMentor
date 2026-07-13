/**
 * Students domain — framework-free row shapes, mapped record contracts, and the
 * repository dataset shapes for the student directory / enrollment / mentor
 * assignment routes.
 *
 * Each row type lists exactly the columns the projections read (matched to
 * db/schema nullability). The repository loads Drizzle rows (structural
 * supersets) and returns them as these shapes; the pure mappers under
 * student-record-mappers.ts project them. MUST NOT import db/schema or
 * drizzle-orm (ESLint enforces): the only schema-derived reference here is the
 * type of `resolveBatchPolicy`, imported type-only from its module so the
 * enrichment snapshot stays identical to the legacy handler.
 */
import type { resolveBatchPolicy as resolveBatchPolicyImpl } from '../../../modules/admin-structure.js'

export type StudentBaseRow = {
  studentId: string
  institutionId: string
  usn: string
  rollNumber: string | null
  name: string
  email: string | null
  phone: string | null
  admissionDate: string
  status: string
  demoWorkspaceId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type EnrollmentRow = {
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder: number
  academicStatus: string
  startDate: string
  endDate: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type MentorAssignmentRow = {
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
  demoWorkspaceId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type AcademicProfileRow = {
  studentId: string
  prevCgpaScaled: number
}

export type TermRow = {
  termId: string
  batchId: string | null
  academicYearLabel: string
  semesterNumber: number
}

export type BranchRow = {
  branchId: string
  departmentId: string
  name: string
}

export type DepartmentRow = {
  departmentId: string
  name: string
  academicFacultyId: string | null
}

export type BatchRow = {
  batchId: string
  batchLabel: string
  admissionYear: number
  branchId: string
  sectionLabelsJson: string
}

export type FacultyRef = {
  facultyId: string
  status: string
  displayName: string
}

export type MentorEligibilityAppointmentRow = {
  facultyId: string
  departmentId: string
  branchId: string | null
  status: string
  startDate: string
  endDate: string | null
}

export type MentorEligibilityGrantRow = {
  facultyId: string
  roleCode: string
  scopeType: string
  scopeId: string
  status: string
  startDate: string
  endDate: string | null
}

export type MappedEnrollment = {
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder: number
  academicStatus: string
  startDate: string
  endDate: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type MappedMentorAssignment = {
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ActiveAcademicContext = {
  enrollmentId: string
  branchId: string
  branchName: string | null
  departmentId: string | null
  departmentName: string | null
  termId: string
  academicYearLabel: string | null
  semesterNumber: number | null
  sectionCode: string
  batchId: string | null
  batchLabel: string | null
  admissionYear: number | null
  academicStatus: string
}

export type StudentRecord = StudentBaseRow & {
  currentCgpa: number
  activeAcademicContext: ActiveAcademicContext | null
  activeMentorAssignment: MappedMentorAssignment | null
  enrollments: MappedEnrollment[]
  mentorAssignments: MappedMentorAssignment[]
}

export type RecordProofProvenance = {
  scopeDescriptor: {
    scopeType: string
    scopeId: string
    label: string
    batchId: string | null
    sectionCode: string | null
    branchName: string | null
    simulationRunId: string | null
    simulationStageCheckpointId: string | null
    studentId: string | null
  } | null
  resolvedFrom: {
    kind: string
    scopeType: string | null
    scopeId: string | null
    label: string
  } | null
  scopeMode: string | null
  countSource: 'operational-semester' | 'proof-run' | 'proof-checkpoint' | 'unavailable' | null
  activeOperationalSemester: number | null
}

export type StudentRecordWithProvenance = StudentRecord & Partial<RecordProofProvenance>

export type ResolvedBatchPolicySnapshot = Awaited<ReturnType<typeof resolveBatchPolicyImpl>>

export type ResolveBatchPolicyForStudents = (
  batchId: string,
  options: { sectionCode: string | null },
) => Promise<ResolvedBatchPolicySnapshot>

export type StudentDirectoryScopeFilter = {
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  sectionCode?: string
}

export type MentorAssignmentBulkApplyPreviewStudent = {
  studentId: string
  studentName: string
  usn: string
  sectionCode: string | null
  currentMentorFacultyId: string | null
  currentMentorAssignmentId: string | null
  action: 'assign' | 'reassign' | 'keep'
  actionReason: string
}

export type StudentDirectoryDataset = {
  studentRows: StudentBaseRow[]
  enrollmentRows: EnrollmentRow[]
  assignmentRows: MentorAssignmentRow[]
  profileRows: AcademicProfileRow[]
  termRows: TermRow[]
  branchRows: BranchRow[]
  departmentRows: DepartmentRow[]
  batchRows: BatchRow[]
}

export type StudentCrossDataset = {
  enrollmentRows: EnrollmentRow[]
  assignmentRows: MentorAssignmentRow[]
  profileRows: AcademicProfileRow[]
  termRows: TermRow[]
  branchRows: BranchRow[]
  departmentRows: DepartmentRow[]
  batchRows: BatchRow[]
}

export type MentorBulkApplyRows = {
  studentRows: StudentBaseRow[]
  enrollmentRows: EnrollmentRow[]
  assignmentRows: MentorAssignmentRow[]
  profileRows: AcademicProfileRow[]
  termRows: TermRow[]
  appointmentRows: MentorEligibilityAppointmentRow[]
  grantRows: MentorEligibilityGrantRow[]
}
