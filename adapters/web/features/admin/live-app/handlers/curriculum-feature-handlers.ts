import type { Dispatch, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigHistoryEvent,
  ApiCurriculumFeatureConfigPreview,
  ApiCurriculumLinkageCandidate,
  ApiProofDashboard,
  ApiScopeType,
} from '@web/shared/api/types'
import { resolveBatch } from '../../system-admin-live-data'
import {
  buildCurriculumFeaturePayload,
  hydrateCurriculumFeatureForm,
  validateCurriculumFeaturePrerequisites,
  type CurriculumFeatureFormState,
} from '../../live-app-model'

type CurriculumFeatureItem = ApiCurriculumFeatureConfigBundle['items'][number]
type CurriculumProofRefreshRetry = { batchIds: string[]; curriculumImportVersionId: string | null; message: string } | null

export interface CurriculumFeatureHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  selectedBatch: ReturnType<typeof resolveBatch>
  selectedCurriculumFeatureItem: CurriculumFeatureItem | null
  curriculumFeatureForm: CurriculumFeatureFormState
  curriculumFeatureItems: ApiCurriculumFeatureConfigBundle['items']
  curriculumFeatureTargetScopeKey: string
  curriculumFeatureTargetMode: 'batch-local-override' | 'scope-profile'
  curriculumFeatureBindingMode: 'inherit-scope-profile' | 'pin-profile' | 'local-only'
  curriculumFeaturePinnedProfileId: string
  curriculumFeatureConfig: ApiCurriculumFeatureConfigBundle | null
  refreshCurriculumFeatureConfig: (batchId: string) => Promise<ApiCurriculumFeatureConfigBundle>
  refreshCurriculumLinkageCandidates: (batchId: string) => Promise<ApiCurriculumLinkageCandidate[]>
  refreshProofDashboard: (batchId: string) => Promise<ApiProofDashboard>
  getQueuedProofRefreshCount: (value: unknown) => number
  setCurriculumFeatureForm: Dispatch<SetStateAction<CurriculumFeatureFormState>>
  setCurriculumFeatureHistory: Dispatch<SetStateAction<ApiCurriculumFeatureConfigHistoryEvent[] | null>>
  setCurriculumFeaturePreview: Dispatch<SetStateAction<ApiCurriculumFeatureConfigPreview | null>>
  setCurriculumProofRefreshRetry: Dispatch<SetStateAction<CurriculumProofRefreshRetry>>
  setFlashMessage: Dispatch<SetStateAction<string>>
}

export function createCurriculumFeatureHandlers(deps: CurriculumFeatureHandlerDeps) {
  const {
    apiClient,
    runAction,
    selectedBatch,
    selectedCurriculumFeatureItem,
    curriculumFeatureForm,
    curriculumFeatureItems,
    curriculumFeatureTargetScopeKey,
    curriculumFeatureTargetMode,
    curriculumFeatureBindingMode,
    curriculumFeaturePinnedProfileId,
    curriculumFeatureConfig,
    refreshCurriculumFeatureConfig,
    refreshCurriculumLinkageCandidates,
    refreshProofDashboard,
    getQueuedProofRefreshCount,
    setCurriculumFeatureForm,
    setCurriculumFeatureHistory,
    setCurriculumFeaturePreview,
    setCurriculumProofRefreshRetry,
    setFlashMessage,
  } = deps

  const handleSaveCurriculumFeatureConfig = async () => {
    if (!selectedBatch || !selectedCurriculumFeatureItem) return
    await runAction(async () => {
      const payload = buildCurriculumFeaturePayload(curriculumFeatureForm)
      validateCurriculumFeaturePrerequisites(selectedCurriculumFeatureItem, payload.prerequisites, curriculumFeatureItems)
      const [targetScopeType, targetScopeId] = curriculumFeatureTargetScopeKey.split('::')
      const saved = await apiClient.saveCurriculumFeatureConfig(selectedBatch.batchId, selectedCurriculumFeatureItem.curriculumCourseId, {
        ...payload,
        targetMode: curriculumFeatureTargetMode,
        targetScopeType: curriculumFeatureTargetMode === 'scope-profile' ? targetScopeType as ApiScopeType : undefined,
        targetScopeId: curriculumFeatureTargetMode === 'scope-profile' ? targetScopeId : undefined,
      })
      const nextBundle = await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      const nextSelected = nextBundle.items.find(item => item.curriculumCourseId === selectedCurriculumFeatureItem.curriculumCourseId) ?? null
      setCurriculumFeatureForm(hydrateCurriculumFeatureForm(nextSelected))
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(saved)
      if (saved.proofRefresh?.status === 'degraded' && saved.affectedBatchIds?.length) {
        setCurriculumProofRefreshRetry({
          batchIds: saved.affectedBatchIds,
          curriculumImportVersionId: saved.curriculumImportVersionId,
          message: saved.proofRefresh.warning
            ?? `Curriculum model inputs were saved for ${selectedCurriculumFeatureItem.courseCode}, but proof refresh queueing failed for one or more affected batches.`,
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(saved.proofRefresh?.status === 'degraded'
        ? `Curriculum model inputs saved for ${selectedCurriculumFeatureItem.courseCode}, but proof refresh queueing failed. ${saved.proofRefresh.warning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
        : queuedCount > 0
          ? `Curriculum model inputs saved and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued for ${selectedCurriculumFeatureItem.courseCode}.`
          : `Curriculum model inputs saved for ${selectedCurriculumFeatureItem.courseCode}.`)
    })
  }

  const handleLoadCurriculumFeatureHistory = async () => {
    if (!selectedBatch || !selectedCurriculumFeatureItem) return
    await runAction(async () => {
      const result = await apiClient.getCurriculumFeatureConfigHistory(
        selectedBatch.batchId,
        selectedCurriculumFeatureItem.curriculumCourseId,
      )
      setCurriculumFeatureHistory(result.events)
    })
  }

  const handlePreviewCurriculumFeatureConfig = async () => {
    if (!selectedBatch || !selectedCurriculumFeatureItem) return
    await runAction(async () => {
      const payload = buildCurriculumFeaturePayload(curriculumFeatureForm)
      const result = await apiClient.previewCurriculumFeatureConfig(
        selectedBatch.batchId,
        selectedCurriculumFeatureItem.curriculumCourseId,
        payload.outcomes.map(o => ({ id: o.id, bloom: o.bloom })),
      )
      setCurriculumFeaturePreview(result)
    })
  }

  const handleSaveCurriculumFeatureBinding = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const saved = await apiClient.saveCurriculumFeatureBinding(selectedBatch.batchId, {
        bindingMode: curriculumFeatureBindingMode,
        curriculumFeatureProfileId: curriculumFeatureBindingMode === 'pin-profile' ? (curriculumFeaturePinnedProfileId || null) : null,
        status: 'active',
        version: curriculumFeatureConfig?.binding?.version ?? 1,
      })
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(saved)
      if (saved.proofRefresh?.status === 'degraded' && saved.affectedBatchIds.length > 0) {
        setCurriculumProofRefreshRetry({
          batchIds: saved.affectedBatchIds,
          curriculumImportVersionId: saved.curriculumImportVersionId,
          message: saved.proofRefresh.warning
            ?? 'Curriculum feature binding was saved, but proof refresh queueing failed for one or more affected batches.',
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(saved.proofRefresh?.status === 'degraded'
        ? `Curriculum feature binding saved, but proof refresh queueing failed. ${saved.proofRefresh.warning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
        : queuedCount > 0
          ? `Curriculum feature binding saved and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued.`
          : 'Curriculum feature binding saved.')
    })
  }

  return {
    handleSaveCurriculumFeatureConfig,
    handleLoadCurriculumFeatureHistory,
    handlePreviewCurriculumFeatureConfig,
    handleSaveCurriculumFeatureBinding,
  }
}
