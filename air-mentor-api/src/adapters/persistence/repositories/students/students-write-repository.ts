/**
 * Drizzle write paths for the students routes. Each create/update builds the row
 * with the same id + clock calls the legacy handlers made (single creates call
 * `now()` twice for createdAt/updatedAt, updates once) and reads the row back
 * after an update. The bulk-apply end/insert take fully-built rows from the
 * use-case so the whole batch shares one caller-captured timestamp.
 */
import { eq } from 'drizzle-orm'
import { mentorAssignments, studentEnrollments, students } from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { createId } from '../../../../lib/ids.js'
import type {
  EnrollmentRow,
  MentorAssignmentRow,
  StudentBaseRow,
} from '../../../../application/use-cases/students/students-domain.js'
import type {
  CreateEnrollmentInput,
  CreateMentorAssignmentInput,
  CreateStudentInput,
  EndMentorAssignmentInput,
  UpdateEnrollmentInput,
  UpdateMentorAssignmentInput,
  UpdateStudentInput,
} from '../../../../application/ports/students-repository.js'

export async function createStudent(db: AppDb, now: () => string, input: CreateStudentInput): Promise<StudentBaseRow> {
  const created = {
    studentId: createId('student'),
    institutionId: input.institutionId,
    usn: input.usn,
    rollNumber: input.rollNumber,
    name: input.name,
    email: input.email,
    phone: input.phone,
    admissionDate: input.admissionDate,
    status: input.status,
    demoWorkspaceId: null,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.insert(students).values(created)
  return created
}

export async function updateStudent(db: AppDb, now: () => string, input: UpdateStudentInput): Promise<StudentBaseRow> {
  await db.update(students).set({
    usn: input.usn,
    rollNumber: input.rollNumber,
    name: input.name,
    email: input.email,
    phone: input.phone,
    admissionDate: input.admissionDate,
    status: input.status,
    version: input.currentVersion + 1,
    updatedAt: now(),
  }).where(eq(students.studentId, input.studentId))
  const [next] = await db.select().from(students).where(eq(students.studentId, input.studentId))
  return next
}

export async function createEnrollment(db: AppDb, now: () => string, input: CreateEnrollmentInput): Promise<EnrollmentRow> {
  const created = {
    enrollmentId: createId('enrollment'),
    studentId: input.studentId,
    branchId: input.branchId,
    termId: input.termId,
    sectionCode: input.sectionCode,
    rosterOrder: input.rosterOrder,
    academicStatus: input.academicStatus,
    startDate: input.startDate,
    endDate: input.endDate,
    demoWorkspaceId: null,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.insert(studentEnrollments).values(created)
  return created
}

export async function updateEnrollment(db: AppDb, now: () => string, input: UpdateEnrollmentInput): Promise<EnrollmentRow> {
  await db.update(studentEnrollments).set({
    studentId: input.studentId,
    branchId: input.branchId,
    termId: input.termId,
    sectionCode: input.sectionCode,
    rosterOrder: input.rosterOrder,
    academicStatus: input.academicStatus,
    startDate: input.startDate,
    endDate: input.endDate,
    version: input.currentVersion + 1,
    updatedAt: now(),
  }).where(eq(studentEnrollments.enrollmentId, input.enrollmentId))
  const [next] = await db.select().from(studentEnrollments).where(eq(studentEnrollments.enrollmentId, input.enrollmentId))
  return next
}

export async function createMentorAssignment(db: AppDb, now: () => string, input: CreateMentorAssignmentInput): Promise<MentorAssignmentRow> {
  const created = {
    assignmentId: createId('mentor_assignment'),
    studentId: input.studentId,
    facultyId: input.facultyId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    source: input.source,
    demoWorkspaceId: null,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.insert(mentorAssignments).values(created)
  return created
}

export async function updateMentorAssignment(db: AppDb, now: () => string, input: UpdateMentorAssignmentInput): Promise<MentorAssignmentRow> {
  await db.update(mentorAssignments).set({
    studentId: input.studentId,
    facultyId: input.facultyId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    source: input.source,
    version: input.currentVersion + 1,
    updatedAt: now(),
  }).where(eq(mentorAssignments.assignmentId, input.assignmentId))
  const [next] = await db.select().from(mentorAssignments).where(eq(mentorAssignments.assignmentId, input.assignmentId))
  return next
}

export async function endMentorAssignment(db: AppDb, input: EndMentorAssignmentInput): Promise<void> {
  await db.update(mentorAssignments).set({
    effectiveTo: input.effectiveTo,
    version: input.version,
    updatedAt: input.updatedAt,
  }).where(eq(mentorAssignments.assignmentId, input.assignmentId))
}

export async function insertMentorAssignment(db: AppDb, row: MentorAssignmentRow): Promise<void> {
  await db.insert(mentorAssignments).values(row)
}
