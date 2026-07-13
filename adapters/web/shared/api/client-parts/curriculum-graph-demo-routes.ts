// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiBatchProvisioningRequest,
  ApiBatchProvisioningResponse,
  ApiCurriculumGraphBundle,
  ApiDemoProvisioningPreview,
  ApiDemoProvisioningResult,
  ApiDemoWorkspace,
  ApiGraphEdge,
  ApiGraphNode
} from '@web/shared/api/types'
import { AirMentorCurriculumOfferingRoutes } from './curriculum-offering-routes'

export class AirMentorCurriculumGraphDemoRoutes extends AirMentorCurriculumOfferingRoutes {
  async getCurriculumGraph(batchId: string) {
    return this.request<ApiCurriculumGraphBundle>(`/api/admin/batches/${batchId}/curriculum-graph`)
  }

  async saveCurriculumGraphDraft(batchId: string, payload: { nodes: ApiGraphNode[]; edges: ApiGraphEdge[]; command?: unknown }) {
    return this.request<{ ok: boolean; draftId: string; savedAt: string }>(`/api/admin/batches/${batchId}/curriculum-graph/draft`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async validateCurriculumGraph(batchId: string, payload?: { nodes?: ApiGraphNode[]; edges?: ApiGraphEdge[] }) {
    return this.request<{ valid: boolean; errors: string[]; warnings: string[] }>(`/api/admin/batches/${batchId}/curriculum-graph/validate`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async publishCurriculumGraph(batchId: string) {
    return this.request<{ ok: boolean; newImportVersionId: string; validation: { valid: boolean; errors: string[]; warnings: string[] }; publishedAt: string }>(`/api/admin/batches/${batchId}/curriculum-graph/publish`, {
      method: 'POST',
    })
  }

  async undoCurriculumGraph(batchId: string) {
    return this.request<{ ok: boolean; reversePayload: unknown; commandType: string }>(`/api/admin/batches/${batchId}/curriculum-graph/undo`, {
      method: 'POST',
    })
  }

  async redoCurriculumGraph(batchId: string) {
    return this.request<{ ok: boolean; forwardPayload: unknown; commandType: string }>(`/api/admin/batches/${batchId}/curriculum-graph/redo`, {
      method: 'POST',
    })
  }

  async suggestCurriculumGraph(batchId: string, payload?: { targetCurriculumNodeIds?: string[] }) {
    return this.request<{ ok: boolean; candidateCount: number; candidateGenerationStatus: string }>(`/api/admin/batches/${batchId}/curriculum-graph/suggest`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async approveCurriculumGraphSuggestion(batchId: string, suggestionId: string) {
    return this.request<{ ok: boolean; suggestionId: string; status: string }>(`/api/admin/batches/${batchId}/curriculum-graph/suggestions/${suggestionId}/approve`, {
      method: 'POST',
    })
  }

  async rejectCurriculumGraphSuggestion(batchId: string, suggestionId: string) {
    return this.request<{ ok: boolean; suggestionId: string; status: string }>(`/api/admin/batches/${batchId}/curriculum-graph/suggestions/${suggestionId}/reject`, {
      method: 'POST',
    })
  }

  async provisionBatch(batchId: string, payload: ApiBatchProvisioningRequest) {
    return this.request<ApiBatchProvisioningResponse>(`/api/admin/batches/${batchId}/provision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async listDemoWorkspaces() {
    return this.request<ApiDemoWorkspace[]>('/api/admin/demo-workspaces')
  }

  async createDemoWorkspace(payload: { name: string; ownerFacultyId?: string; batchId?: string }) {
    return this.request<ApiDemoWorkspace>('/api/admin/demo-workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async previewDemoProvisioning(
    demoWorkspaceId: string,
    payload: { batchId: string; termId: string; sectionLabels: string[]; studentsPerSection: number },
  ) {
    return this.request<ApiDemoProvisioningPreview>(
      `/api/admin/demo-workspaces/${demoWorkspaceId}/provision/preview`,
      { method: 'POST', body: JSON.stringify(payload) },
    )
  }

  async provisionDemoWorkspace(demoWorkspaceId: string) {
    return this.request<ApiDemoProvisioningResult>(
      `/api/admin/demo-workspaces/${demoWorkspaceId}/provision`,
      { method: 'POST' },
    )
  }

  async resetDemoWorkspace(demoWorkspaceId: string) {
    return this.request<{ deletedStudents: number; deletedOfferings: number; deletedRuns: number; deletedSchema?: boolean; scopeName?: string | null }>(
      `/api/admin/demo-workspaces/${demoWorkspaceId}`,
      { method: 'DELETE' },
    )
  }
}
