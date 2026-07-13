/**
 * GET /api/admin/students — list students with enrollment + mentor-assignment
 * context and per-batch proof provenance. The repository loads the full
 * directory dataset; the projection, scope filter, and provenance enrichment run
 * exactly as the legacy handler did (one cache shared across the response).
 */
import type { StudentsRepository } from '../../ports/students-repository.js'
import type { UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapStudentRecord } from './student-record-mappers.js'
import { enrichStudentRecordWithProvenance, matchesStudentDirectoryScope } from './student-scope.js'
import type {
  ResolveBatchPolicyForStudents,
  ResolvedBatchPolicySnapshot,
  StudentDirectoryScopeFilter,
} from './students-domain.js'

export type ListStudentsDeps = {
  repo: StudentsRepository
  resolveBatchPolicy: ResolveBatchPolicyForStudents
}

export type ListStudentsInput = {
  filter: StudentDirectoryScopeFilter
}

export async function listStudents(
  deps: ListStudentsDeps,
  input: ListStudentsInput,
): Promise<UseCaseResponse> {
  const dataset = await deps.repo.loadStudentDirectoryDataset()
  const academicFacultyByDepartmentId = new Map(
    dataset.departmentRows.map(row => [row.departmentId, row.academicFacultyId ?? null]),
  )
  const provenanceCache = new Map<string, ResolvedBatchPolicySnapshot>()
  const mappedStudents = dataset.studentRows
    .map(student => mapStudentRecord({
      student,
      enrollmentRows: dataset.enrollmentRows,
      assignmentRows: dataset.assignmentRows,
      profileRows: dataset.profileRows,
      termRows: dataset.termRows,
      branchRows: dataset.branchRows,
      departmentRows: dataset.departmentRows,
      batchRows: dataset.batchRows,
    }))
    .filter(student => matchesStudentDirectoryScope(student, academicFacultyByDepartmentId, input.filter))
  return {
    status: 200,
    body: {
      items: await Promise.all(mappedStudents.map(student => enrichStudentRecordWithProvenance(
        deps.resolveBatchPolicy,
        student,
        provenanceCache,
      ))),
    },
  }
}
