// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiAcademicFacultyProfile,
  ApiAdminFacultyCalendar,
  ApiAdminReminder,
  ApiAdminRequestDetail,
  ApiAdminRequestNote,
  ApiAdminRequestSummary,
  ApiAdminSearchResult,
  ApiAssessmentScore,
  ApiAttendanceSnapshot,
  ApiAuditEvent,
  ApiStudentIntervention,
  ApiTranscriptSubjectResult,
  ApiTranscriptTermResult
} from '@web/shared/api/types'
import type { SchemeState, TTKind, TermTestBlueprint } from '@kernel/shared/domain'
import { AirMentorCurriculumGraphDemoRoutes } from './curriculum-graph-demo-routes'

export class AirMentorAdminRequestRoutes extends AirMentorCurriculumGraphDemoRoutes {
  async saveOfferingAssessmentScheme(offeringId: string, payload: { scheme: SchemeState }) {
    return this.request<{ offeringId: string; scheme: SchemeState; version: number; policySnapshot: unknown }>(`/api/academic/offerings/${offeringId}/scheme`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveOfferingQuestionPaper(offeringId: string, kind: TTKind, payload: { blueprint: TermTestBlueprint }) {
    return this.request<{ paperId: string; offeringId: string; kind: TTKind; blueprint: TermTestBlueprint; version: number }>(`/api/academic/offerings/${offeringId}/question-papers/${kind}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async createAttendanceSnapshot(payload: Omit<ApiAttendanceSnapshot, 'attendanceSnapshotId'>) {
    return this.request<{ attendanceSnapshotId: string; ok: true }>('/api/admin/attendance-snapshots', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createAssessmentScore(payload: Omit<ApiAssessmentScore, 'assessmentScoreId'>) {
    return this.request<{ assessmentScoreId: string; ok: true }>('/api/admin/assessment-scores', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createStudentIntervention(payload: Omit<ApiStudentIntervention, 'interventionId'>) {
    return this.request<{ interventionId: string; ok: true }>('/api/admin/student-interventions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createTranscriptTermResult(payload: Omit<ApiTranscriptTermResult, 'transcriptTermResultId'>) {
    return this.request<{ transcriptTermResultId: string; ok: true }>('/api/admin/transcript-term-results', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createTranscriptSubjectResult(payload: Omit<ApiTranscriptSubjectResult, 'transcriptSubjectResultId'>) {
    return this.request<{ transcriptSubjectResultId: string; ok: true }>('/api/admin/transcript-subject-results', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async listAdminRequests() {
    return this.request<{ items: ApiAdminRequestSummary[] }>('/api/admin/requests')
  }

  async searchAdminWorkspace(query: string, scope?: {
    academicFacultyId?: string
    departmentId?: string
    branchId?: string
    batchId?: string
    sectionCode?: string
  }) {
    const searchParams = new URLSearchParams()
    if (query.trim()) searchParams.set('q', query.trim())
    if (scope?.academicFacultyId) searchParams.set('academicFacultyId', scope.academicFacultyId)
    if (scope?.departmentId) searchParams.set('departmentId', scope.departmentId)
    if (scope?.branchId) searchParams.set('branchId', scope.branchId)
    if (scope?.batchId) searchParams.set('batchId', scope.batchId)
    if (scope?.sectionCode) searchParams.set('sectionCode', scope.sectionCode)
    const qs = searchParams.toString()
    return this.request<{ items: ApiAdminSearchResult[] }>(`/api/admin/search${qs ? `?${qs}` : ''}`)
  }

  async listAuditEvents(filter: { entityType: string; entityId: string }) {
    const searchParams = new URLSearchParams({
      entityType: filter.entityType,
      entityId: filter.entityId,
    })
    return this.request<{ items: ApiAuditEvent[] }>(`/api/admin/audit-events?${searchParams.toString()}`)
  }

  async listRecentAdminAuditEvents(limit = 80) {
    const searchParams = new URLSearchParams({ limit: String(limit) })
    return this.request<{ items: ApiAuditEvent[] }>(`/api/admin/audit-events/recent?${searchParams.toString()}`)
  }

  async listAdminReminders() {
    return this.request<{ items: ApiAdminReminder[] }>('/api/admin/reminders')
  }

  async createAdminReminder(payload: Pick<ApiAdminReminder, 'title' | 'body' | 'dueAt' | 'status'>) {
    return this.request<ApiAdminReminder>('/api/admin/reminders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAdminReminder(reminderId: string, payload: Pick<ApiAdminReminder, 'title' | 'body' | 'dueAt' | 'status' | 'version'>) {
    return this.request<ApiAdminReminder>(`/api/admin/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getAdminFacultyCalendar(facultyId: string) {
    return this.request<ApiAdminFacultyCalendar>(`/api/admin/faculty-calendar/${facultyId}`)
  }

  async saveAdminFacultyCalendar(facultyId: string, payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) {
    return this.request<ApiAdminFacultyCalendar>(`/api/admin/faculty-calendar/${facultyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async getAcademicFacultyProfile(facultyId: string, filter?: { simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicFacultyProfile>(`/api/academic/faculty-profile/${facultyId}${query ? `?${query}` : ''}`)
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
}
