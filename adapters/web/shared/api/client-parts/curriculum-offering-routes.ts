// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiAdminOffering,
  ApiBatchCurriculumFeatureBinding,
  ApiCourseOutcomeOverride,
  ApiCourseOutcomeScopeType,
  ApiCurriculumBootstrapResult,
  ApiCurriculumFeatureBindingSaveResult,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigHistoryEvent,
  ApiCurriculumFeatureConfigPayload,
  ApiCurriculumFeatureConfigPreview,
  ApiCurriculumFeatureConfigSaveResult,
  ApiCurriculumFeatureProfile,
  ApiCurriculumLinkageApprovalResult,
  ApiCurriculumLinkageCandidate,
  ApiCurriculumLinkageCandidateRegenerateResult,
  ApiOfferingOwnership,
  ApiOfferingStageEligibility,
  ApiResolvedCourseOutcomeSet
} from '@web/shared/api/types'
import { AirMentorAdminPolicyProofRoutes } from './admin-policy-proof-routes'

export class AirMentorCurriculumOfferingRoutes extends AirMentorAdminPolicyProofRoutes {
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
    finalsLocked?: boolean
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
    finalsLocked?: boolean
    pendingAction?: string | null
    status: string
    version: number
  }) {
    return this.request<ApiAdminOffering>(`/api/admin/offerings/${offeringId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getOfferingStageEligibility(offeringId: string) {
    return this.request<ApiOfferingStageEligibility>(`/api/admin/offerings/${offeringId}/stage-eligibility`)
  }

  async advanceOfferingStage(offeringId: string) {
    return this.request<ApiOfferingStageEligibility>(`/api/admin/offerings/${offeringId}/advance-stage`, {
      method: 'POST',
      body: JSON.stringify({}),
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

  async listCourseOutcomeOverrides(filter?: { courseId?: string; scopeType?: ApiCourseOutcomeScopeType; scopeId?: string }) {
    const search = new URLSearchParams()
    if (filter?.courseId) search.set('courseId', filter.courseId)
    if (filter?.scopeType) search.set('scopeType', filter.scopeType)
    if (filter?.scopeId) search.set('scopeId', filter.scopeId)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return this.request<{ items: ApiCourseOutcomeOverride[] }>(`/api/admin/course-outcomes${suffix}`)
  }

  async createCourseOutcomeOverride(payload: Pick<ApiCourseOutcomeOverride, 'courseId' | 'scopeType' | 'scopeId' | 'outcomes' | 'status'>) {
    return this.request<ApiCourseOutcomeOverride>('/api/admin/course-outcomes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCourseOutcomeOverride(courseOutcomeOverrideId: string, payload: Pick<ApiCourseOutcomeOverride, 'courseId' | 'scopeType' | 'scopeId' | 'outcomes' | 'status' | 'version'>) {
    return this.request<ApiCourseOutcomeOverride>(`/api/admin/course-outcomes/${courseOutcomeOverrideId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getResolvedCourseOutcomes(offeringId: string) {
    return this.request<ApiResolvedCourseOutcomeSet>(`/api/admin/offerings/${offeringId}/resolved-course-outcomes`)
  }

  async getCurriculumFeatureConfig(batchId: string) {
    return this.request<ApiCurriculumFeatureConfigBundle>(`/api/admin/batches/${batchId}/curriculum-feature-config`)
  }

  async bootstrapCurriculum(batchId: string, payload?: { manifestKey?: ApiCurriculumBootstrapResult['manifestKey'] }) {
    return this.request<ApiCurriculumBootstrapResult>(`/api/admin/batches/${batchId}/curriculum/bootstrap`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async listCurriculumLinkageCandidates(batchId: string, filter?: { curriculumCourseId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.curriculumCourseId) searchParams.set('curriculumCourseId', filter.curriculumCourseId)
    const query = searchParams.toString()
    return this.request<{ items: ApiCurriculumLinkageCandidate[] }>(`/api/admin/batches/${batchId}/curriculum/linkage-candidates${query ? `?${query}` : ''}`)
  }

  async regenerateCurriculumLinkageCandidates(batchId: string, payload?: { curriculumCourseId?: string }) {
    return this.request<ApiCurriculumLinkageCandidateRegenerateResult>(`/api/admin/batches/${batchId}/curriculum/linkage-candidates/regenerate`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async approveCurriculumLinkageCandidate(batchId: string, curriculumLinkageCandidateId: string, payload?: { reviewNote?: string }) {
    return this.request<ApiCurriculumLinkageApprovalResult>(
      `/api/admin/batches/${batchId}/curriculum/linkage-candidates/${curriculumLinkageCandidateId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      },
    )
  }

  async rejectCurriculumLinkageCandidate(batchId: string, curriculumLinkageCandidateId: string, payload?: { reviewNote?: string }) {
    return this.request<{ ok: true; batchId: string; curriculumLinkageCandidateId: string }>(
      `/api/admin/batches/${batchId}/curriculum/linkage-candidates/${curriculumLinkageCandidateId}/reject`,
      {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      },
    )
  }

  async listCurriculumFeatureProfiles(filter?: { scopeType?: ApiCurriculumFeatureProfile['scopeType']; scopeId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.scopeType) searchParams.set('scopeType', filter.scopeType)
    if (filter?.scopeId) searchParams.set('scopeId', filter.scopeId)
    const query = searchParams.toString()
    return this.request<{ items: ApiCurriculumFeatureProfile[] }>(`/api/admin/curriculum-feature-profiles${query ? `?${query}` : ''}`)
  }

  async createCurriculumFeatureProfile(payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status'>) {
    return this.request<ApiCurriculumFeatureProfile>('/api/admin/curriculum-feature-profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCurriculumFeatureProfile(curriculumFeatureProfileId: string, payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status' | 'version'>) {
    return this.request<ApiCurriculumFeatureProfile>(`/api/admin/curriculum-feature-profiles/${curriculumFeatureProfileId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async saveCurriculumFeatureBinding(batchId: string, payload: Pick<ApiBatchCurriculumFeatureBinding, 'bindingMode' | 'curriculumFeatureProfileId' | 'status' | 'version'>) {
    return this.request<ApiCurriculumFeatureBindingSaveResult>(`/api/admin/batches/${batchId}/curriculum-feature-binding`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveCurriculumFeatureConfig(batchId: string, curriculumCourseId: string, payload: ApiCurriculumFeatureConfigPayload) {
    return this.request<ApiCurriculumFeatureConfigSaveResult>(
      `/api/admin/batches/${batchId}/curriculum-feature-config/${curriculumCourseId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    )
  }

  async previewCurriculumFeatureConfig(batchId: string, curriculumCourseId: string, proposedOutcomes: Array<{ id: string; bloom: string }>) {
    return this.request<ApiCurriculumFeatureConfigPreview>(
      `/api/admin/batches/${batchId}/curriculum-feature-config/preview`,
      {
        method: 'POST',
        body: JSON.stringify({ curriculumCourseId, proposedOutcomes }),
      },
    )
  }

  async getCurriculumFeatureConfigHistory(batchId: string, curriculumCourseId: string) {
    return this.request<{ events: ApiCurriculumFeatureConfigHistoryEvent[] }>(
      `/api/admin/batches/${batchId}/curriculum-feature-config/${curriculumCourseId}/history`,
    )
  }
}
