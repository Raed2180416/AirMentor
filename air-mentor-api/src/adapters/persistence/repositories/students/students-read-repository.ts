/**
 * Drizzle read paths for the students routes. Every query mirrors the legacy
 * handler exactly (same tables, same order, same lazy single-row lookups); rows
 * are returned as the framework-free domain shapes (structural supersets) so the
 * use-cases stay persistence-free. Read-order matters only for parity, not
 * correctness — the directory/cross datasets keep the original sequential reads,
 * the bulk-apply dataset keeps the original `Promise.all`.
 */
import { eq } from 'drizzle-orm'
import {
  academicTerms,
  batches,
  branches,
  departments,
  facultyAppointments,
  facultyProfiles,
  institutions,
  mentorAssignments,
  roleGrants,
  studentAcademicProfiles,
  studentEnrollments,
  students,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
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
} from '../../../../application/use-cases/students/students-domain.js'

export async function loadStudentDirectoryDataset(db: AppDb): Promise<StudentDirectoryDataset> {
  const studentRows = await db.select().from(students)
  const enrollmentRows = await db.select().from(studentEnrollments)
  const assignmentRows = await db.select().from(mentorAssignments)
  const profileRows = await db.select().from(studentAcademicProfiles)
  const termRows = await db.select().from(academicTerms)
  const branchRows = await db.select().from(branches)
  const departmentRows = await db.select().from(departments)
  const batchRows = await db.select().from(batches)
  return { studentRows, enrollmentRows, assignmentRows, profileRows, termRows, branchRows, departmentRows, batchRows }
}

export async function loadStudentCrossDataset(db: AppDb): Promise<StudentCrossDataset> {
  const enrollmentRows = await db.select().from(studentEnrollments)
  const assignmentRows = await db.select().from(mentorAssignments)
  const profileRows = await db.select().from(studentAcademicProfiles)
  const termRows = await db.select().from(academicTerms)
  const branchRows = await db.select().from(branches)
  const departmentRows = await db.select().from(departments)
  const batchRows = await db.select().from(batches)
  return { enrollmentRows, assignmentRows, profileRows, termRows, branchRows, departmentRows, batchRows }
}

export async function getInstitutionIdForNewStudent(db: AppDb): Promise<string | null> {
  const firstStudentInstitutionId = (await db.select().from(students).limit(1))[0]?.institutionId
  const institutionId = firstStudentInstitutionId
    ?? (await db.select().from(institutions).limit(1))[0]?.institutionId
  return institutionId ?? null
}

export async function getStudentById(db: AppDb, studentId: string): Promise<StudentBaseRow | null> {
  const [current] = await db.select().from(students).where(eq(students.studentId, studentId))
  return current ?? null
}

export async function getEnrollmentById(db: AppDb, enrollmentId: string): Promise<EnrollmentRow | null> {
  const [current] = await db.select().from(studentEnrollments).where(eq(studentEnrollments.enrollmentId, enrollmentId))
  return current ?? null
}

export async function getMentorAssignmentById(db: AppDb, assignmentId: string): Promise<MentorAssignmentRow | null> {
  const [current] = await db.select().from(mentorAssignments).where(eq(mentorAssignments.assignmentId, assignmentId))
  return current ?? null
}

export async function getBulkBatch(db: AppDb, batchId: string): Promise<BatchRow | null> {
  const [batch] = await db.select().from(batches).where(eq(batches.batchId, batchId))
  return batch ?? null
}

export async function getBulkBranch(db: AppDb, branchId: string): Promise<BranchRow | null> {
  const [branch] = await db.select().from(branches).where(eq(branches.branchId, branchId))
  return branch ?? null
}

export async function getBulkDepartment(db: AppDb, departmentId: string): Promise<DepartmentRow | null> {
  const [department] = await db.select().from(departments).where(eq(departments.departmentId, departmentId))
  return department ?? null
}

export async function getBulkFaculty(db: AppDb, facultyId: string): Promise<FacultyRef | null> {
  const [selectedFaculty] = await db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, facultyId))
  return selectedFaculty ?? null
}

export async function loadMentorBulkApplyRows(db: AppDb): Promise<MentorBulkApplyRows> {
  const [studentRows, enrollmentRows, assignmentRows, profileRows, termRows, appointmentRows, grantRows] = await Promise.all([
    db.select().from(students),
    db.select().from(studentEnrollments),
    db.select().from(mentorAssignments),
    db.select().from(studentAcademicProfiles),
    db.select().from(academicTerms),
    db.select().from(facultyAppointments),
    db.select().from(roleGrants),
  ])
  return { studentRows, enrollmentRows, assignmentRows, profileRows, termRows, appointmentRows, grantRows }
}
