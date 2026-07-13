// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiAcademicBootstrap,
  ApiAcademicHodProofBundle,
  ApiAcademicHodProofCounterfactualReport,
  ApiAcademicHodProofCounterfactualSimulatorReport,
  ApiAcademicHodProofCourseRollup,
  ApiAcademicHodProofFacultyRollup,
  ApiAcademicHodProofReassessment,
  ApiAcademicHodProofStudentWatch,
  ApiAcademicHodProofSummary,
  ApiProofReassessmentAcknowledgeRequest,
  ApiProofReassessmentAcknowledgeResponse,
  ApiProofReassessmentResolveRequest,
  ApiProofReassessmentResolveResponse,
  ApiStudentAgentCard,
  ApiStudentAgentMessage,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
  ApiStudentRiskExplorer
} from '@web/shared/api/types'
import { AirMentorSessionRoutes } from './session-routes'

export class AirMentorAcademicProofRoutes extends AirMentorSessionRoutes {
  async getAcademicBootstrap(filter?: { simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicBootstrap>(`/api/academic/bootstrap${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofBundle(filter?: { section?: string; semester?: number; riskBand?: string; status?: string; facultyId?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.status) searchParams.set('status', filter.status)
    if (filter?.facultyId) searchParams.set('facultyId', filter.facultyId)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.studentId) searchParams.set('studentId', filter.studentId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicHodProofBundle>(`/api/academic/hod/proof-bundle${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofSummary(filter?: { section?: string; semester?: number; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicHodProofSummary>(`/api/academic/hod/proof-summary${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofCourses(filter?: { section?: string; semester?: number; riskBand?: string; courseCode?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofCourseRollup[] }>(`/api/academic/hod/proof-courses${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofFaculty(filter?: { section?: string; semester?: number; facultyId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.facultyId) searchParams.set('facultyId', filter.facultyId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofFacultyRollup[] }>(`/api/academic/hod/proof-faculty${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofStudents(filter?: { section?: string; semester?: number; riskBand?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.studentId) searchParams.set('studentId', filter.studentId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofStudentWatch[] }>(`/api/academic/hod/proof-students${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofReassessments(filter?: { section?: string; semester?: number; riskBand?: string; status?: string; facultyId?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.status) searchParams.set('status', filter.status)
    if (filter?.facultyId) searchParams.set('facultyId', filter.facultyId)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.studentId) searchParams.set('studentId', filter.studentId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofReassessment[] }>(`/api/academic/hod/proof-reassessments${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofCounterfactual(input: { runIdBaseline: string; runIdRealized: string }) {
    // Legacy diagnostic-only route. Prompt §G.6 marks this as "temporary
    // diagnostic"; final Sem-6 analytics must use
    // getAcademicHodProofCounterfactualSimulator below.
    const searchParams = new URLSearchParams()
    searchParams.set('runIdBaseline', input.runIdBaseline)
    searchParams.set('runIdRealized', input.runIdRealized)
    return this.request<ApiAcademicHodProofCounterfactualReport>(
      `/api/academic/hod/proof-counterfactual?${searchParams.toString()}`,
    )
  }

  async getAcademicHodProofCounterfactualSimulator(input: { runId: string }) {
    // Phase-11 authoritative path (prompt §C.13 + §G.6 + §L.10). Returns the
    // projected with-vs-without-intervention report for ONE run.
    const searchParams = new URLSearchParams()
    searchParams.set('runId', input.runId)
    return this.request<ApiAcademicHodProofCounterfactualSimulatorReport>(
      `/api/academic/hod/proof-counterfactual-simulator?${searchParams.toString()}`,
    )
  }

  async acknowledgeAcademicProofReassessment(reassessmentEventId: string, payload: ApiProofReassessmentAcknowledgeRequest = {}) {
    return this.request<ApiProofReassessmentAcknowledgeResponse>(`/api/academic/proof-reassessments/${encodeURIComponent(reassessmentEventId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async resolveAcademicProofReassessment(reassessmentEventId: string, payload: ApiProofReassessmentResolveRequest) {
    return this.request<ApiProofReassessmentResolveResponse>(`/api/academic/proof-reassessments/${encodeURIComponent(reassessmentEventId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async advanceAcademicProofRun(simulationRunId: string, payload: { mode: 'day' | 'previous-day' | 'stage' }) {
    return this.request<Record<string, unknown>>(`/api/academic/proof-runs/${encodeURIComponent(simulationRunId)}/advance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async stopAcademicProofRun(simulationRunId: string) {
    return this.request<Record<string, unknown>>(`/api/academic/proof-runs/${encodeURIComponent(simulationRunId)}/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async recomputeAcademicProofRunRisk(simulationRunId: string) {
    return this.request<{ ok: true }>(`/api/academic/proof-runs/${encodeURIComponent(simulationRunId)}/recompute-risk`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async getAcademicStudentAgentCard(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationRunId) searchParams.set('simulationRunId', filter.simulationRunId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiStudentAgentCard>(`/api/academic/student-shell/students/${encodeURIComponent(studentId)}/card${query ? `?${query}` : ''}`)
  }

  async getAcademicStudentRiskExplorer(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationRunId) searchParams.set('simulationRunId', filter.simulationRunId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiStudentRiskExplorer>(`/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer${query ? `?${query}` : ''}`)
  }

  async getAcademicStudentAgentTimeline(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationRunId) searchParams.set('simulationRunId', filter.simulationRunId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiStudentAgentTimelineItem[] }>(`/api/academic/student-shell/students/${encodeURIComponent(studentId)}/timeline${query ? `?${query}` : ''}`)
  }

  async startAcademicStudentAgentSession(studentId: string, payload?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    return this.request<ApiStudentAgentSession>(`/api/academic/student-shell/students/${encodeURIComponent(studentId)}/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async sendAcademicStudentAgentMessage(sessionId: string, payload: { prompt: string }) {
    return this.request<{ items: ApiStudentAgentMessage[] }>(`/api/academic/student-shell/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
}
