// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiActivateProofSemesterRequest,
  ApiActivateProofSemesterResponse,
  ApiBatchSetupReadiness,
  ApiPolicyOverride,
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiProofRunCheckpointStudentDetail,
  ApiProofRunCheckpointStudentSummary,
  ApiProofStudentEvidenceTimelineItem,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiSimulationStageCheckpointSummary,
  ApiStagePolicyOverride
} from '@web/shared/api/types'
import { AirMentorAdminDirectoryRoutes } from './admin-directory-routes'

export class AirMentorAdminPolicyProofRoutes extends AirMentorAdminDirectoryRoutes {
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

  async getBatchSetupReadiness(batchId: string, options?: { sectionCode?: string | null }) {
    const searchParams = new URLSearchParams()
    if (options?.sectionCode) searchParams.set('sectionCode', options.sectionCode)
    const query = searchParams.toString()
    return this.request<ApiBatchSetupReadiness>(`/api/admin/batches/${batchId}/setup-readiness${query ? `?${query}` : ''}`)
  }

  async getResolvedBatchPolicy(batchId: string, filter?: { sectionCode?: string | null }) {
    const searchParams = new URLSearchParams()
    if (filter?.sectionCode) searchParams.set('sectionCode', filter.sectionCode)
    const query = searchParams.toString()
    return this.request<ApiResolvedBatchPolicy>(`/api/admin/batches/${batchId}/resolved-policy${query ? `?${query}` : ''}`)
  }

  async listStagePolicyOverrides(filter?: { scopeType?: ApiStagePolicyOverride['scopeType']; scopeId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.scopeType) searchParams.set('scopeType', filter.scopeType)
    if (filter?.scopeId) searchParams.set('scopeId', filter.scopeId)
    const query = searchParams.toString()
    return this.request<{ items: ApiStagePolicyOverride[] }>(`/api/admin/stage-policy-overrides${query ? `?${query}` : ''}`)
  }

  async createStagePolicyOverride(payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>) {
    return this.request<ApiStagePolicyOverride>('/api/admin/stage-policy-overrides', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateStagePolicyOverride(stagePolicyOverrideId: string, payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>) {
    return this.request<ApiStagePolicyOverride>(`/api/admin/stage-policy-overrides/${stagePolicyOverrideId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getResolvedStagePolicy(batchId: string, filter?: { sectionCode?: string | null }) {
    const searchParams = new URLSearchParams()
    if (filter?.sectionCode) searchParams.set('sectionCode', filter.sectionCode)
    const query = searchParams.toString()
    return this.request<ApiResolvedBatchStagePolicy>(`/api/admin/batches/${batchId}/resolved-stage-policy${query ? `?${query}` : ''}`)
  }

  async getProofDashboard(batchId: string) {
    return this.request<ApiProofDashboard>(`/api/admin/batches/${batchId}/proof-dashboard`)
  }

  async createProofImport(batchId: string, payload?: { sourcePath?: string }) {
    return this.request<{ curriculumImportVersionId: string; validation: Record<string, unknown>; completenessCertificate: Record<string, unknown> }>(`/api/admin/batches/${batchId}/proof-imports`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async validateProofImport(curriculumImportVersionId: string) {
    return this.request<Record<string, unknown>>(`/api/admin/proof-imports/${curriculumImportVersionId}/validate`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async reviewProofCrosswalks(curriculumImportVersionId: string, payload: { reviews: Array<{ officialCodeCrosswalkId: string; reviewStatus: string; overrideReason?: string | null }> }) {
    return this.request<{ ok: true; count: number }>(`/api/admin/proof-imports/${curriculumImportVersionId}/review-crosswalks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async approveProofImport(curriculumImportVersionId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-imports/${curriculumImportVersionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async createProofRun(batchId: string, payload: { curriculumImportVersionId: string; seed?: number; runLabel?: string; activate?: boolean }) {
    return this.request<{ simulationRunId: string; status: string; activeFlag: boolean; createdAt: string; startedAt: string | null; completedAt: string | null; failureCode: string | null; failureMessage: string | null; progress: Record<string, unknown> | null }>(`/api/admin/batches/${batchId}/proof-runs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async retryProofRun(simulationRunId: string) {
    return this.request<{ simulationRunId: string; status: string; activeFlag: boolean; createdAt: string; startedAt: string | null; completedAt: string | null; failureCode: string | null; failureMessage: string | null; progress: Record<string, unknown> | null }>(`/api/admin/proof-runs/${simulationRunId}/retry`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async activateProofRun(simulationRunId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-runs/${simulationRunId}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async activateProofSemester(simulationRunId: string, payload: ApiActivateProofSemesterRequest) {
    return this.request<ApiActivateProofSemesterResponse>(`/api/admin/proof-runs/${simulationRunId}/activate-semester`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async advanceProofRun(simulationRunId: string, payload: { mode: 'day' | 'previous-day' | 'stage' }) {
    return this.request<Record<string, unknown>>(`/api/admin/proof-runs/${simulationRunId}/advance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async stopProofRun(simulationRunId: string) {
    return this.request<Record<string, unknown>>(`/api/admin/proof-runs/${simulationRunId}/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async archiveProofRun(simulationRunId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-runs/${simulationRunId}/archive`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async recomputeProofRunRisk(simulationRunId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-runs/${simulationRunId}/recompute-risk`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async restoreProofRunSnapshot(simulationRunId: string, payload?: { simulationResetSnapshotId?: string }) {
    return this.request<{ simulationRunId: string; activeFlag: boolean }>(`/api/admin/proof-runs/${simulationRunId}/restore-snapshot`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async getProofRunCheckpoints(simulationRunId: string) {
    return this.request<{ items: ApiSimulationStageCheckpointSummary[] }>(`/api/admin/proof-runs/${simulationRunId}/checkpoints`)
  }

  async getProofRunCheckpointDetail(simulationRunId: string, simulationStageCheckpointId: string) {
    return this.request<ApiProofRunCheckpointDetail>(`/api/admin/proof-runs/${simulationRunId}/checkpoints/${encodeURIComponent(simulationStageCheckpointId)}`)
  }

  async listProofRunCheckpointStudents(simulationRunId: string, simulationStageCheckpointId: string) {
    return this.request<{ items: ApiProofRunCheckpointStudentSummary[] }>(`/api/admin/proof-runs/${simulationRunId}/checkpoints/${encodeURIComponent(simulationStageCheckpointId)}/students`)
  }

  async getProofRunCheckpointStudentDetail(simulationRunId: string, simulationStageCheckpointId: string, studentId: string) {
    return this.request<ApiProofRunCheckpointStudentDetail>(`/api/admin/proof-runs/${simulationRunId}/checkpoints/${encodeURIComponent(simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`)
  }

  async getProofStudentEvidenceTimeline(simulationRunId: string, studentId: string) {
    return this.request<{ items: ApiProofStudentEvidenceTimelineItem[] }>(`/api/admin/proof-runs/${simulationRunId}/students/${studentId}/evidence-timeline`)
  }
}
