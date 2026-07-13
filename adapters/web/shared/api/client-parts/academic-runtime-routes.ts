// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiAcademicCalendarAuditListResponse,
  ApiAcademicMeeting,
  ApiAcademicRuntimeKey,
  ApiAcademicTaskListResponse,
  ApiAcademicTaskPlacementListResponse,
  ApiAppendAcademicCalendarAuditRequest,
  ApiAppendAcademicCalendarAuditResponse,
  ApiDeleteAcademicTaskPlacementResponse,
  ApiUpsertAcademicTaskPlacementRequest,
  ApiUpsertAcademicTaskPlacementResponse,
  ApiUpsertAcademicTaskRequest,
  ApiUpsertAcademicTaskResponse
} from '@web/shared/api/types'
import type { EntryKind, FacultyTimetableTemplate, MeetingStatus } from '@kernel/shared/domain'
import { AirMentorAcademicProofRoutes } from './academic-proof-routes'

export class AirMentorAcademicRuntimeRoutes extends AirMentorAcademicProofRoutes {
  async saveAcademicDrafts(payload: Record<string, number>) {
    return this.request<{ ok: true; stateKey: ApiAcademicRuntimeKey }>('/api/academic/runtime/drafts', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveAcademicCellValues(payload: Record<string, number>) {
    return this.request<{ ok: true; stateKey: ApiAcademicRuntimeKey }>('/api/academic/runtime/cell-values', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveAcademicLockByOffering(payload: Record<string, Record<string, boolean>>) {
    return this.request<{ ok: true; stateKey: ApiAcademicRuntimeKey }>('/api/academic/runtime/lock-by-offering', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveAcademicLockAuditByTarget(payload: Record<string, Array<{ action: string; actorRole: string; at?: number }>>) {
    return this.request<{ ok: true; stateKey: ApiAcademicRuntimeKey }>('/api/academic/runtime/lock-audit-by-target', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveAcademicResolvedTasks(payload: Record<string, number>) {
    return this.request<{ ok: true; stateKey: ApiAcademicRuntimeKey }>('/api/academic/runtime/resolvedTasks', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async listAcademicTasks() {
    return this.request<ApiAcademicTaskListResponse>('/api/academic/tasks')
  }

  async saveAcademicTask(taskId: string, payload: ApiUpsertAcademicTaskRequest) {
    return this.request<ApiUpsertAcademicTaskResponse>(`/api/academic/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async listAcademicTaskPlacements() {
    return this.request<ApiAcademicTaskPlacementListResponse>('/api/academic/task-placements')
  }

  async saveAcademicTaskPlacement(taskId: string, payload: ApiUpsertAcademicTaskPlacementRequest) {
    return this.request<ApiUpsertAcademicTaskPlacementResponse>(`/api/academic/task-placements/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async deleteAcademicTaskPlacement(taskId: string, expectedUpdatedAt?: number) {
    const searchParams = new URLSearchParams()
    if (typeof expectedUpdatedAt === 'number') searchParams.set('expectedUpdatedAt', String(expectedUpdatedAt))
    const query = searchParams.toString()
    return this.request<ApiDeleteAcademicTaskPlacementResponse>(`/api/academic/task-placements/${encodeURIComponent(taskId)}${query ? `?${query}` : ''}`, {
      method: 'DELETE',
    })
  }

  async listAcademicCalendarAuditEvents() {
    return this.request<ApiAcademicCalendarAuditListResponse>('/api/academic/calendar-audit')
  }

  async appendAcademicCalendarAuditEvent(payload: ApiAppendAcademicCalendarAuditRequest) {
    return this.request<ApiAppendAcademicCalendarAuditResponse>('/api/academic/calendar-audit', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async saveFacultyCalendarWorkspace(facultyId: string, payload: { template: FacultyTimetableTemplate }) {
    return this.request<{ facultyId: string; template: FacultyTimetableTemplate; version: number; directEditWindowEndsAt: string | null; classEditingLocked: boolean }>(`/api/academic/faculty-calendar-workspace/${facultyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async createAcademicMeeting(payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status?: MeetingStatus }) {
    return this.request<ApiAcademicMeeting>('/api/academic/meetings', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAcademicMeeting(meetingId: string, payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status: MeetingStatus; version: number }) {
    return this.request<ApiAcademicMeeting>(`/api/academic/meetings/${meetingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async commitOfferingAttendance(offeringId: string, payload: { entries: Array<{ studentId: string; presentClasses: number; totalClasses: number }>; capturedAt?: string; lock?: boolean }) {
    return this.request<{ ok: true; offeringId: string; capturedAt: string; averageAttendance: number; locked: boolean }>(`/api/academic/offerings/${offeringId}/attendance`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async commitOfferingAssessmentEntries(offeringId: string, kind: Exclude<EntryKind, 'attendance'>, payload: { entries: Array<{ studentId: string; components: Array<{ componentCode: string; score: number; maxScore: number }> }>; evaluatedAt?: string; lock?: boolean }) {
    return this.request<{ ok: true; offeringId: string; kind: Exclude<EntryKind, 'attendance'>; evaluatedAt: string; locked: boolean }>(`/api/academic/offerings/${offeringId}/assessment-entries/${kind}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async clearOfferingAssessmentLock(offeringId: string, kind: EntryKind) {
    return this.request<{ ok: true; offeringId: string; kind: EntryKind; cleared: boolean; reason?: string }>(
      `/api/academic/offerings/${encodeURIComponent(offeringId)}/assessment-entries/${encodeURIComponent(kind)}/clear-lock`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  }
}
