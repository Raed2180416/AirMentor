// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiAcademicFaculty,
  ApiAcademicTerm,
  ApiAdminFacultyPasswordSetupResponse,
  ApiBatch,
  ApiBranch,
  ApiCourse,
  ApiCurriculumCourse,
  ApiDepartment,
  ApiFacultyAppointment,
  ApiFacultyRecord,
  ApiInstitution,
  ApiMentorAssignment,
  ApiMentorAssignmentBulkApplyRequest,
  ApiMentorAssignmentBulkApplyResponse,
  ApiRoleGrant,
  ApiStudentEnrollment,
  ApiStudentRecord,
  ApiUiPreferences
} from '@web/shared/api/types'
import { buildAdminDirectoryScopeQuery, type ApiAdminDirectoryScopeFilter } from './transport'
import { AirMentorAcademicRuntimeRoutes } from './academic-runtime-routes'

export class AirMentorAdminDirectoryRoutes extends AirMentorAcademicRuntimeRoutes {
  async getUiPreferences() {
    return this.request<ApiUiPreferences>('/api/preferences/ui')
  }

  async saveUiPreferences(payload: Pick<ApiUiPreferences, 'themeMode' | 'version'>) {
    return this.request<ApiUiPreferences>('/api/preferences/ui', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getInstitution() {
    return this.request<ApiInstitution>('/api/admin/institution')
  }

  async updateInstitution(payload: Pick<ApiInstitution, 'name' | 'timezone' | 'academicYearStartMonth' | 'status' | 'version'>) {
    return this.request<ApiInstitution>('/api/admin/institution', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listAcademicFaculties() {
    return this.request<{ items: ApiAcademicFaculty[] }>('/api/admin/academic-faculties')
  }

  async createAcademicFaculty(payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status'>) {
    return this.request<ApiAcademicFaculty>('/api/admin/academic-faculties', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAcademicFaculty(academicFacultyId: string, payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status' | 'version'>) {
    return this.request<ApiAcademicFaculty>(`/api/admin/academic-faculties/${academicFacultyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listDepartments() {
    return this.request<{ items: ApiDepartment[] }>('/api/admin/departments')
  }

  async createDepartment(payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status'>) {
    return this.request<ApiDepartment>('/api/admin/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateDepartment(departmentId: string, payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status' | 'version'>) {
    return this.request<ApiDepartment>(`/api/admin/departments/${departmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listBranches() {
    return this.request<{ items: ApiBranch[] }>('/api/admin/branches')
  }

  async createBranch(payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status'>) {
    return this.request<ApiBranch>('/api/admin/branches', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateBranch(branchId: string, payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status' | 'version'>) {
    return this.request<ApiBranch>(`/api/admin/branches/${branchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listBatches() {
    return this.request<{ items: ApiBatch[] }>('/api/admin/batches')
  }

  async createBatch(payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status'>) {
    return this.request<ApiBatch>('/api/admin/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateBatch(batchId: string, payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status' | 'version'>) {
    return this.request<ApiBatch>(`/api/admin/batches/${batchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listTerms() {
    return this.request<{ items: ApiAcademicTerm[] }>('/api/admin/terms')
  }

  async createTerm(payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status'>) {
    return this.request<ApiAcademicTerm>('/api/admin/terms', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateTerm(termId: string, payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status' | 'version'>) {
    return this.request<ApiAcademicTerm>(`/api/admin/terms/${termId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listFaculty(filter?: ApiAdminDirectoryScopeFilter) {
    return this.request<{ items: ApiFacultyRecord[] }>(`/api/admin/faculty${buildAdminDirectoryScopeQuery(filter)}`)
  }

  async createFaculty(payload: {
    username: string
    email: string
    phone?: string | null
    password?: string | null
    employeeCode: string
    displayName: string
    designation: string
    joinedOn?: string | null
    status: string
  }) {
    return this.request<ApiFacultyRecord>('/api/admin/faculty', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async issueFacultyPasswordSetup(facultyId: string) {
    return this.request<ApiAdminFacultyPasswordSetupResponse>(`/api/admin/faculty/${facultyId}/password-setup`, {
      method: 'POST',
    })
  }

  async updateFaculty(facultyId: string, payload: {
    username: string
    email: string
    phone?: string | null
    employeeCode: string
    displayName: string
    designation: string
    joinedOn?: string | null
    status: string
    version: number
  }) {
    return this.request<ApiFacultyRecord>(`/api/admin/faculty/${facultyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createFacultyAppointment(facultyId: string, payload: Pick<ApiFacultyAppointment, 'departmentId' | 'branchId' | 'isPrimary' | 'startDate' | 'endDate' | 'status'>) {
    return this.request<ApiFacultyAppointment>(`/api/admin/faculty/${facultyId}/appointments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateFacultyAppointment(appointmentId: string, payload: Pick<ApiFacultyAppointment, 'facultyId' | 'departmentId' | 'branchId' | 'isPrimary' | 'startDate' | 'endDate' | 'status' | 'version'>) {
    return this.request<ApiFacultyAppointment>(`/api/admin/appointments/${appointmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createRoleGrant(facultyId: string, payload: Pick<ApiRoleGrant, 'roleCode' | 'scopeType' | 'scopeId' | 'startDate' | 'endDate' | 'status'>) {
    return this.request<ApiRoleGrant>(`/api/admin/faculty/${facultyId}/role-grants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateRoleGrant(grantId: string, payload: Pick<ApiRoleGrant, 'facultyId' | 'roleCode' | 'scopeType' | 'scopeId' | 'startDate' | 'endDate' | 'status' | 'version'>) {
    return this.request<ApiRoleGrant>(`/api/admin/role-grants/${grantId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listStudents(filter?: ApiAdminDirectoryScopeFilter) {
    return this.request<{ items: ApiStudentRecord[] }>(`/api/admin/students${buildAdminDirectoryScopeQuery(filter)}`)
  }

  async createStudent(payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status'>) {
    return this.request<ApiStudentRecord>('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateStudent(studentId: string, payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status' | 'version'>) {
    return this.request<ApiStudentRecord>(`/api/admin/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createEnrollment(studentId: string, payload: Pick<ApiStudentEnrollment, 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate'> & { rosterOrder?: number }) {
    return this.request<ApiStudentEnrollment>(`/api/admin/students/${studentId}/enrollments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateEnrollment(enrollmentId: string, payload: Pick<ApiStudentEnrollment, 'studentId' | 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate' | 'version'> & { rosterOrder?: number }) {
    return this.request<ApiStudentEnrollment>(`/api/admin/enrollments/${enrollmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createMentorAssignment(payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source'>) {
    return this.request<ApiMentorAssignment>('/api/admin/mentor-assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateMentorAssignment(assignmentId: string, payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source' | 'version'>) {
    return this.request<ApiMentorAssignment>(`/api/admin/mentor-assignments/${assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async bulkApplyMentorAssignments(payload: ApiMentorAssignmentBulkApplyRequest) {
    return this.request<ApiMentorAssignmentBulkApplyResponse>('/api/admin/mentor-assignments/bulk-apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async listCourses() {
    return this.request<{ items: ApiCourse[] }>('/api/admin/courses')
  }

  async createCourse(payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status'>) {
    return this.request<ApiCourse>('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCourse(courseId: string, payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status' | 'version'>) {
    return this.request<ApiCourse>(`/api/admin/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listCurriculumCourses(batchId?: string) {
    const searchParams = new URLSearchParams()
    if (batchId) searchParams.set('batchId', batchId)
    const query = searchParams.toString()
    return this.request<{ items: ApiCurriculumCourse[] }>(`/api/admin/curriculum-courses${query ? `?${query}` : ''}`)
  }

  async createCurriculumCourse(payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status'>) {
    return this.request<ApiCurriculumCourse>('/api/admin/curriculum-courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCurriculumCourse(curriculumCourseId: string, payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status' | 'version'>) {
    return this.request<ApiCurriculumCourse>(`/api/admin/curriculum-courses/${curriculumCourseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }
}
