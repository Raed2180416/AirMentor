import type { Dispatch, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiMentorAssignmentBulkApplyResponse,
  ApiProofDashboard,
  ApiSessionResponse,
  ApiStagePolicyOverride,
} from '@web/shared/api/types'
import { writeActiveDemoWorkspacePointer } from '@web/simulation/demo-workspace-pointer'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import {
  resolveBatch,
  type LiveAdminDataset,
  type LiveAdminRoute,
} from '../../system-admin-live-data'
import {
  buildBulkMentorAssignmentApplyPayload,
  buildBulkMentorAssignmentPreviewPayload,
  describeBulkMentorPreview,
  type BulkMentorAssignmentFormState,
} from '../../system-admin-provisioning-helpers'
import {
  EMPTY_DATA,
  buildBatchProvisioningPayload,
  toErrorMessage,
  type BatchProvisioningFormState,
} from '../../live-app-model'

export interface ProvisioningHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  loadAdminData: () => Promise<void>
  selectedBatch: ReturnType<typeof resolveBatch>
  route: LiveAdminRoute
  session: ApiSessionResponse | null
  selectedSectionCode: string | null
  batchProvisioningForm: BatchProvisioningFormState
  bulkMentorAssignmentForm: BulkMentorAssignmentFormState
  bulkMentorAssignmentPreview: ApiMentorAssignmentBulkApplyResponse | null
  refreshCurriculumFeatureConfig: (batchId: string) => Promise<unknown>
  refreshProofDashboard: (batchId: string) => Promise<ApiProofDashboard>
  getQueuedProofRefreshCount: (value: unknown) => number
  clearRegistryScope: () => void
  setBulkMentorAssignmentPreview: Dispatch<SetStateAction<ApiMentorAssignmentBulkApplyResponse | null>>
  setSession: Dispatch<SetStateAction<ApiSessionResponse | null>>
  setData: Dispatch<SetStateAction<LiveAdminDataset>>
  setStagePolicyOverrides: Dispatch<SetStateAction<ApiStagePolicyOverride[]>>
  setDismissedQueueItemKeys: Dispatch<SetStateAction<string[]>>
  setDataError: Dispatch<SetStateAction<string>>
  setPassword: Dispatch<SetStateAction<string>>
  setFlashMessage: Dispatch<SetStateAction<string>>
  setActionError: Dispatch<SetStateAction<string>>
}

export function createProvisioningHandlers(deps: ProvisioningHandlerDeps) {
  const {
    apiClient,
    runAction,
    loadAdminData,
    selectedBatch,
    route,
    session,
    selectedSectionCode,
    batchProvisioningForm,
    bulkMentorAssignmentForm,
    bulkMentorAssignmentPreview,
    refreshCurriculumFeatureConfig,
    refreshProofDashboard,
    getQueuedProofRefreshCount,
    clearRegistryScope,
    setBulkMentorAssignmentPreview,
    setSession,
    setData,
    setStagePolicyOverrides,
    setDismissedQueueItemKeys,
    setDataError,
    setPassword,
    setFlashMessage,
    setActionError,
  } = deps

  const handleProvisionBatch = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const payload = buildBatchProvisioningPayload(batchProvisioningForm)
      const result = await apiClient.provisionBatch(selectedBatch.batchId, payload)
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      if (selectedBatch.batchId === route.batchId) {
        await refreshProofDashboard(selectedBatch.batchId)
      }
      const queuedCount = getQueuedProofRefreshCount(result)
      setFlashMessage(
        queuedCount > 0
          ? `Provisioned ${result.summary.createdStudentCount} students, ${result.summary.createdOfferingCount} offerings, ${result.summary.createdMentorCount} mentor links, and ${queuedCount} proof refresh${queuedCount === 1 ? '' : 'es'} for ${selectedBatch.batchLabel}.`
          : `Provisioned ${result.summary.createdStudentCount} students, ${result.summary.createdOfferingCount} offerings, and ${result.summary.createdMentorCount} mentor links for ${selectedBatch.batchLabel}.`,
      )
    })
  }

  const handleProvisionSeededDemoWorkspace = async () => {
    if (!selectedBatch) return
    if (!window.confirm(`Provision a disposable seeded demo workspace for ${selectedBatch.batchLabel}?`)) return
    const activeSessionId = session?.sessionId ?? null
    setActionError('')
    try {
      const workspace = await apiClient.createDemoWorkspace({
        name: `MSRUAS seeded demo · ${selectedBatch.batchLabel}`,
        ownerFacultyId: session?.faculty?.facultyId ?? undefined,
        batchId: selectedBatch.batchId,
      })
      const provisioned = await apiClient.provisionDemoWorkspace(workspace.demoWorkspaceId)
      await apiClient.logout().catch(error => {
        emitClientOperationalEvent('auth.session.logout_failed', {
          workspace: 'system-admin',
          sessionId: activeSessionId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
      })
      writeActiveDemoWorkspacePointer({ demoWorkspaceId: workspace.demoWorkspaceId })
      clearRegistryScope()
      setDismissedQueueItemKeys([])
      setSession(null)
      setData(EMPTY_DATA)
      setStagePolicyOverrides([])
      setDataError('')
      setPassword('')
      setFlashMessage('')
      if (typeof window !== 'undefined') {
        window.alert(`Seeded demo workspace ready with ${provisioned.provisionedCounts.checkpoints} checkpoints, ${provisioned.provisionedCounts.observedStates} observed states, and ${provisioned.provisionedCounts.riskAssessments} risk assessments. Sign in again to enter the demo workspace.`)
      }
    } catch (error) {
      setActionError(toErrorMessage(error))
    }
  }

  const handlePreviewBulkMentorAssignment = async () => {
    if (!selectedBatch) return
    const result = await runAction(async () => apiClient.bulkApplyMentorAssignments(
      buildBulkMentorAssignmentPreviewPayload(selectedBatch.batchId, selectedSectionCode, bulkMentorAssignmentForm),
    ))
    if (!result) return
    setBulkMentorAssignmentPreview(result)
    setFlashMessage(describeBulkMentorPreview(result))
  }

  const handleApplyBulkMentorAssignment = async () => {
    if (!selectedBatch || !bulkMentorAssignmentPreview) return
    if (
      bulkMentorAssignmentPreview.summary.createdAssignmentCount === 0
      && bulkMentorAssignmentPreview.summary.endedAssignmentCount === 0
    ) {
      setFlashMessage('The current preview does not contain any mentor changes to apply.')
      return
    }
    if (!window.confirm(`Apply mentor changes for ${bulkMentorAssignmentPreview.scopeLabel}?`)) return
    const result = await runAction(async () => apiClient.bulkApplyMentorAssignments(
      buildBulkMentorAssignmentApplyPayload(
        selectedBatch.batchId,
        selectedSectionCode,
        bulkMentorAssignmentForm,
        bulkMentorAssignmentPreview.studentIds,
      ),
    ))
    if (!result) return
    await loadAdminData()
    setBulkMentorAssignmentPreview(null)
    setFlashMessage(
      `${result.summary.createdAssignmentCount} mentor links applied and ${result.summary.endedAssignmentCount} active links end-dated for ${result.scopeLabel}.`,
    )
  }

  return {
    handleProvisionBatch,
    handleProvisionSeededDemoWorkspace,
    handlePreviewBulkMentorAssignment,
    handleApplyBulkMentorAssignment,
  }
}
