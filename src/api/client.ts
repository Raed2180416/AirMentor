import type {
  ApiAdminRequestDetail,
  ApiAdminRequestNote,
  ApiAdminRequestSummary,
  ApiAuditEvent,
  ApiBranch,
  ApiCourse,
  ApiDepartment,
  ApiFacultyRecord,
  ApiInstitution,
  ApiLoginRequest,
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
  getUiPreferences(): Promise<ApiUiPreferences>
  saveUiPreferences(payload: Pick<ApiUiPreferences, 'themeMode' | 'version'>): Promise<ApiUiPreferences>
  getInstitution(): Promise<ApiInstitution>
  updateInstitution(payload: Pick<ApiInstitution, 'name' | 'timezone' | 'academicYearStartMonth' | 'status' | 'version'>): Promise<ApiInstitution>
  listDepartments(): Promise<{ items: ApiDepartment[] }>
  createDepartment(payload: Pick<ApiDepartment, 'code' | 'name' | 'status'>): Promise<ApiDepartment>
  updateDepartment(departmentId: string, payload: Pick<ApiDepartment, 'code' | 'name' | 'status' | 'version'>): Promise<ApiDepartment>
  listBranches(): Promise<{ items: ApiBranch[] }>
  createBranch(payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status'>): Promise<ApiBranch>
  updateBranch(branchId: string, payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status' | 'version'>): Promise<ApiBranch>
  listFaculty(): Promise<{ items: ApiFacultyRecord[] }>
  listStudents(): Promise<{ items: ApiStudentRecord[] }>
  listCourses(): Promise<{ items: ApiCourse[] }>
  createCourse(payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status'>): Promise<ApiCourse>
  updateCourse(courseId: string, payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status' | 'version'>): Promise<ApiCourse>
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

export class AirMentorApiClient implements AirMentorApiClientLike {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(baseUrl: string, fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetchImpl = fetchImpl
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

  async listDepartments() {
    return this.request<{ items: ApiDepartment[] }>('/api/admin/departments')
  }

  async createDepartment(payload: Pick<ApiDepartment, 'code' | 'name' | 'status'>) {
    return this.request<ApiDepartment>('/api/admin/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateDepartment(departmentId: string, payload: Pick<ApiDepartment, 'code' | 'name' | 'status' | 'version'>) {
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
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
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
