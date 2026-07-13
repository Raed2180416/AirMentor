/**
 * Drizzle implementation of the StudentsRepository port — composition point for
 * the students / enrollments / mentor-assignment data access. Reads and writes
 * live in sibling files to respect the 400-line cap; `now` is injected so the
 * writes keep the legacy clock calls.
 */
import type { AppDb } from '../../../../db/client.js'
import type { StudentsRepository } from '../../../../application/ports/students-repository.js'
import {
  getBulkBatch,
  getBulkBranch,
  getBulkDepartment,
  getBulkFaculty,
  getEnrollmentById,
  getInstitutionIdForNewStudent,
  getMentorAssignmentById,
  getStudentById,
  loadMentorBulkApplyRows,
  loadStudentCrossDataset,
  loadStudentDirectoryDataset,
} from './students-read-repository.js'
import {
  createEnrollment,
  createMentorAssignment,
  createStudent,
  endMentorAssignment,
  insertMentorAssignment,
  updateEnrollment,
  updateMentorAssignment,
  updateStudent,
} from './students-write-repository.js'

export function createStudentsRepository(db: AppDb, now: () => string): StudentsRepository {
  return {
    loadStudentDirectoryDataset: () => loadStudentDirectoryDataset(db),

    getInstitutionIdForNewStudent: () => getInstitutionIdForNewStudent(db),
    createStudent: input => createStudent(db, now, input),

    getStudentById: studentId => getStudentById(db, studentId),
    updateStudent: input => updateStudent(db, now, input),

    loadStudentCrossDataset: () => loadStudentCrossDataset(db),

    createEnrollment: input => createEnrollment(db, now, input),
    getEnrollmentById: enrollmentId => getEnrollmentById(db, enrollmentId),
    updateEnrollment: input => updateEnrollment(db, now, input),

    createMentorAssignment: input => createMentorAssignment(db, now, input),
    getMentorAssignmentById: assignmentId => getMentorAssignmentById(db, assignmentId),
    updateMentorAssignment: input => updateMentorAssignment(db, now, input),

    getBulkBatch: batchId => getBulkBatch(db, batchId),
    getBulkBranch: branchId => getBulkBranch(db, branchId),
    getBulkDepartment: departmentId => getBulkDepartment(db, departmentId),
    getBulkFaculty: facultyId => getBulkFaculty(db, facultyId),
    loadMentorBulkApplyRows: () => loadMentorBulkApplyRows(db),
    endMentorAssignment: input => endMentorAssignment(db, input),
    insertMentorAssignment: row => insertMentorAssignment(db, row),
  }
}
