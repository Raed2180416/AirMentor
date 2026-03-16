import type {
  ApiAcademicBootstrap,
  ApiAcademicFaculty,
  ApiAcademicLoginFaculty,
  ApiAcademicTerm,
  ApiAcademicRuntimeKey,
  ApiAdminRequestDetail,
  ApiAdminRequestNote,
  ApiAdminRequestSummary,
  ApiAdminOffering,
  ApiAuditEvent,
  ApiBatch,
  ApiBranch,
  ApiCourse,
  ApiCurriculumCourse,
  ApiDepartment,
  ApiFacultyRecord,
  ApiInstitution,
  ApiLoginRequest,
  ApiOfferingOwnership,
  ApiPolicyOverride,
  ApiResolvedBatchPolicy,
  ApiSessionResponse,
  ApiStudentRecord,
  ApiUiPreferences,
} from './types.js'

export class AirMentorApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export interface AirMentorApiClientLike {
  restoreSession(): Promise<ApiSessionResponse>
  login(payload: ApiLoginRequest): Promise<ApiSessionResponse>
  logout(): Promise<void>
  switchRoleContext(roleGrantId: string): Promise<ApiSessionResponse>
  listAcademicLoginFaculty(): Promise<{ items: ApiAcademicLoginFaculty[] }>
  getAcademicBootstrap(): Promise<ApiAcademicBootstrap>
  saveAcademicRuntimeSlice<T>(stateKey: ApiAcademicRuntimeKey, payload: T): Promise<{ ok: true; stateKey: ApiAcademicRuntimeKey }>
  getUiPreferences(): Promise<ApiUiPreferences>
  saveUiPreferences(payload: Pick<ApiUiPreferences, 'themeMode' | 'version'>): Promise<ApiUiPreferences>
  getInstitution(): Promise<ApiInstitution>
  updateInstitution(payload: Pick<ApiInstitution, 'name' | 'timezone' | 'academicYearStartMonth' | 'status' | 'version'>): Promise<ApiInstitution>
  listAcademicFaculties(): Promise<{ items: ApiAcademicFaculty[] }>
  createAcademicFaculty(payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status'>): Promise<ApiAcademicFaculty>
  updateAcademicFaculty(academicFacultyId: string, payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status' | 'version'>): Promise<ApiAcademicFaculty>
  listDepartments(): Promise<{ items: ApiDepartment[] }>
  createDepartment(payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status'>): Promise<ApiDepartment>
  updateDepartment(departmentId: string, payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status' | 'version'>): Promise<ApiDepartment>
  listBranches(): Promise<{ items: ApiBranch[] }>
  createBranch(payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status'>): Promise<ApiBranch>
  updateBranch(branchId: string, payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status' | 'version'>): Promise<ApiBranch>
  listBatches(): Promise<{ items: ApiBatch[] }>
  createBatch(payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status'>): Promise<ApiBatch>
  updateBatch(batchId: string, payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status' | 'version'>): Promise<ApiBatch>
  listTerms(): Promise<{ items: ApiAcademicTerm[] }>
  createTerm(payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status'>): Promise<ApiAcademicTerm>
  updateTerm(termId: string, payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status' | 'version'>): Promise<ApiAcademicTerm>
  listFaculty(): Promise<{ items: ApiFacultyRecord[] }>
  listStudents(): Promise<{ items: ApiStudentRecord[] }>
  listCourses(): Promise<{ items: ApiCourse[] }>
  createCourse(payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status'>): Promise<ApiCourse>
  updateCourse(courseId: string, payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status' | 'version'>): Promise<ApiCourse>
  listCurriculumCourses(batchId?: string): Promise<{ items: ApiCurriculumCourse[] }>
  createCurriculumCourse(payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status'>): Promise<ApiCurriculumCourse>
  updateCurriculumCourse(curriculumCourseId: string, payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status' | 'version'>): Promise<ApiCurriculumCourse>
  listPolicyOverrides(filter?: { scopeType?: ApiPolicyOverride['scopeType']; scopeId?: string }): Promise<{ items: ApiPolicyOverride[] }>
  createPolicyOverride(payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>): Promise<ApiPolicyOverride>
  updatePolicyOverride(policyOverrideId: string, payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>): Promise<ApiPolicyOverride>
  getResolvedBatchPolicy(batchId: string): Promise<ApiResolvedBatchPolicy>
  listOfferings(): Promise<{ items: ApiAdminOffering[] }>
  createOffering(payload: {
    courseId: string
    termId: string
    branchId: string
    sectionCode: string
    yearLabel: string
    attendance: number
    studentCount: number
    stage: number
    stageLabel: string
    stageDescription: string
    stageColor: string
    tt1Done?: boolean
    tt2Done?: boolean
    tt1Locked?: boolean
    tt2Locked?: boolean
    quizLocked?: boolean
    assignmentLocked?: boolean
    pendingAction?: string | null
    status: string
  }): Promise<ApiAdminOffering>
  updateOffering(offeringId: string, payload: {
    courseId: string
    termId: string
    branchId: string
    sectionCode: string
    yearLabel: string
    attendance: number
    studentCount: number
    stage: number
    stageLabel: string
    stageDescription: string
    stageColor: string
    tt1Done?: boolean
    tt2Done?: boolean
    tt1Locked?: boolean
    tt2Locked?: boolean
    quizLocked?: boolean
    assignmentLocked?: boolean
    pendingAction?: string | null
    status: string
    version: number
  }): Promise<ApiAdminOffering>
  listOfferingOwnership(): Promise<{ items: ApiOfferingOwnership[] }>
  createOfferingOwnership(payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status'>): Promise<ApiOfferingOwnership>
  updateOfferingOwnership(ownershipId: string, payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status' | 'version'>): Promise<ApiOfferingOwnership>
  listAdminRequests(): Promise<{ items: ApiAdminRequestSummary[] }>
  getAdminRequest(requestId: string): Promise<ApiAdminRequestDetail>
  assignAdminRequest(requestId: string, payload: { version: number; ownedByFacultyId?: string | null; noteBody?: string }): Promise<ApiAdminRequestSummary>
  requestAdminRequestInfo(requestId: string, payload: { version: number; noteBody: string }): Promise<ApiAdminRequestSummary>
  approveAdminRequest(requestId: string, payload: { version: number; noteBody?: string }): Promise<ApiAdminRequestSummary>
  rejectAdminRequest(requestId: string, payload: { version: number; noteBody: string }): Promise<ApiAdminRequestSummary>
  markAdminRequestImplemented(requestId: string, payload: { version: number; noteBody?: string }): Promise<ApiAdminRequestSummary>
  closeAdminRequest(requestId: string, payload: { version: number; noteBody?: string }): Promise<ApiAdminRequestSummary>
  addAdminRequestNote(requestId: string, payload: { visibility?: string; noteType: string; body: string }): Promise<ApiAdminRequestNote>
  getAdminRequestAudit(requestId: string): Promise<{ transitions: ApiAdminRequestDetail['transitions']; auditEvents: ApiAuditEvent[] }>
}

type FetchLike = typeof fetch

function getDefaultFetch(): FetchLike {
  return globalThis.fetch.bind(globalThis) as FetchLike
}

export class AirMentorApiClient implements AirMentorApiClientLike {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(baseUrl: string, fetchImpl?: FetchLike) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetchImpl = fetchImpl ?? getDefaultFetch()
  }

  async restoreSession() {
    return this.request<ApiSessionResponse>('/api/session')
  }

  async login(payload: ApiLoginRequest) {
    return this.request<ApiSessionResponse>('/api/session/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async logout() {
    await this.request('/api/session', { method: 'DELETE' })
  }

  async switchRoleContext(roleGrantId: string) {
    return this.request<ApiSessionResponse>('/api/session/role-context', {
      method: 'POST',
      body: JSON.stringify({ roleGrantId }),
    })
  }

  async listAcademicLoginFaculty() {
    return this.request<{ items: ApiAcademicLoginFaculty[] }>('/api/academic/public/faculty')
  }

  async getAcademicBootstrap() {
    return this.request<ApiAcademicBootstrap>('/api/academic/bootstrap')
  }

  async saveAcademicRuntimeSlice<T>(stateKey: ApiAcademicRuntimeKey, payload: T) {
    return this.request<{ ok: true; stateKey: ApiAcademicRuntimeKey }>(`/api/academic/runtime/${stateKey}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

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

  async listFaculty() {
    return this.request<{ items: ApiFacultyRecord[] }>('/api/admin/faculty')
  }

  async listStudents() {
    return this.request<{ items: ApiStudentRecord[] }>('/api/admin/students')
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

  async listPolicyOverrides(filter?: { scopeType?: ApiPolicyOverride['scopeType']; scopeId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.scopeType) searchParams.set('scopeType', filter.scopeType)
    if (filter?.scopeId) searchParams.set('scopeId', filter.scopeId)
    const query = searchParams.toString()
    return this.request<{ items: ApiPolicyOverride[] }>(`/api/admin/policy-overrides${query ? `?${query}` : ''}`)
  }

  async createPolicyOverride(payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>) {
    return this.request<ApiPolicyOverride>('/api/admin/policy-overrides', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updatePolicyOverride(policyOverrideId: string, payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>) {
    return this.request<ApiPolicyOverride>(`/api/admin/policy-overrides/${policyOverrideId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getResolvedBatchPolicy(batchId: string) {
    return this.request<ApiResolvedBatchPolicy>(`/api/admin/batches/${batchId}/resolved-policy`)
  }

  async listOfferings() {
    return this.request<{ items: ApiAdminOffering[] }>('/api/admin/offerings')
  }

  async createOffering(payload: {
    courseId: string
    termId: string
    branchId: string
    sectionCode: string
    yearLabel: string
    attendance: number
    studentCount: number
    stage: number
    stageLabel: string
    stageDescription: string
    stageColor: string
    tt1Done?: boolean
    tt2Done?: boolean
    tt1Locked?: boolean
    tt2Locked?: boolean
    quizLocked?: boolean
    assignmentLocked?: boolean
    pendingAction?: string | null
    status: string
  }) {
    return this.request<ApiAdminOffering>('/api/admin/offerings', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateOffering(offeringId: string, payload: {
    courseId: string
    termId: string
    branchId: string
    sectionCode: string
    yearLabel: string
    attendance: number
    studentCount: number
    stage: number
    stageLabel: string
    stageDescription: string
    stageColor: string
    tt1Done?: boolean
    tt2Done?: boolean
    tt1Locked?: boolean
    tt2Locked?: boolean
    quizLocked?: boolean
    assignmentLocked?: boolean
    pendingAction?: string | null
    status: string
    version: number
  }) {
    return this.request<ApiAdminOffering>(`/api/admin/offerings/${offeringId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listOfferingOwnership() {
    return this.request<{ items: ApiOfferingOwnership[] }>('/api/admin/offering-ownership')
  }

  async createOfferingOwnership(payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status'>) {
    return this.request<ApiOfferingOwnership>('/api/admin/offering-ownership', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateOfferingOwnership(ownershipId: string, payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status' | 'version'>) {
    return this.request<ApiOfferingOwnership>(`/api/admin/offering-ownership/${ownershipId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listAdminRequests() {
    return this.request<{ items: ApiAdminRequestSummary[] }>('/api/admin/requests')
  }

  async getAdminRequest(requestId: string) {
    return this.request<ApiAdminRequestDetail>(`/api/admin/requests/${requestId}`)
  }

  async assignAdminRequest(requestId: string, payload: { version: number; ownedByFacultyId?: string | null; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async requestAdminRequestInfo(requestId: string, payload: { version: number; noteBody: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/request-info`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async approveAdminRequest(requestId: string, payload: { version: number; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async rejectAdminRequest(requestId: string, payload: { version: number; noteBody: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async markAdminRequestImplemented(requestId: string, payload: { version: number; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/mark-implemented`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async closeAdminRequest(requestId: string, payload: { version: number; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async addAdminRequestNote(requestId: string, payload: { visibility?: string; noteType: string; body: string }) {
    return this.request<ApiAdminRequestNote>(`/api/admin/requests/${requestId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getAdminRequestAudit(requestId: string) {
    return this.request<{ transitions: ApiAdminRequestDetail['transitions']; auditEvents: ApiAuditEvent[] }>(`/api/admin/requests/${requestId}/audit`)
  }

  private async request<T>(path: string, init?: RequestInit) {
    const hasBody = init?.body !== undefined
    const resolvedHeaders = {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers: resolvedHeaders,
      ...init,
    })

    if (response.status === 204) {
      return undefined as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : response.statusText || 'API request failed'
      throw new AirMentorApiError(response.status, message, payload)
    }

    return payload as T
  }
}
