import type { Dispatch, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiOfferingStageEligibility,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiStagePolicyOverride,
} from '@web/shared/api/types'
import type { LiveAdminDataset } from '../../system-admin-live-data'
import {
  buildStagePolicyPayload,
  buildValidatedPolicyPayload,
  hydratePolicyForm,
  hydrateStagePolicyForm,
  type ActiveAdminScope,
  type PolicyFormState,
  type StagePolicyFormState,
} from '../../live-app-model'
import { describeGovernanceRollbackMessage } from '../../system-admin-faculties-workspace'

type PolicyOverrideRecord = LiveAdminDataset['policyOverrides'][number]
type OfferingRecord = LiveAdminDataset['offerings'][number]

export interface ScopePolicyHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  loadAdminData: () => Promise<void>
  activeGovernanceScope: ActiveAdminScope | null
  activeScopeChain: ActiveAdminScope[]
  activeScopePolicyOverride: PolicyOverrideRecord | null
  activeScopeStageOverride: ApiStagePolicyOverride | null
  policyForm: PolicyFormState
  stagePolicyForm: StagePolicyFormState
  preferredGovernanceBatchId: string | undefined
  selectedSectionCode: string | null
  activeGovernanceProofRefreshBatchIds: string[]
  resolvedBatchPolicy: ApiResolvedBatchPolicy | null
  resolvedStagePolicy: ApiResolvedBatchStagePolicy | null
  selectedStageOffering: OfferingRecord | null
  queueProofRefreshBatches: (batchIds: string[], reason: string, overrideImportVersionId?: string | null) => Promise<string[]>
  setResolvedBatchPolicy: Dispatch<SetStateAction<ApiResolvedBatchPolicy | null>>
  setResolvedStagePolicy: Dispatch<SetStateAction<ApiResolvedBatchStagePolicy | null>>
  setPolicyForm: Dispatch<SetStateAction<PolicyFormState>>
  setStagePolicyForm: Dispatch<SetStateAction<StagePolicyFormState>>
  setSelectedStageEligibility: Dispatch<SetStateAction<ApiOfferingStageEligibility | null>>
  setFlashMessage: Dispatch<SetStateAction<string>>
}

export function createScopePolicyHandlers(deps: ScopePolicyHandlerDeps) {
  const {
    apiClient,
    runAction,
    loadAdminData,
    activeGovernanceScope,
    activeScopeChain,
    activeScopePolicyOverride,
    activeScopeStageOverride,
    policyForm,
    stagePolicyForm,
    preferredGovernanceBatchId,
    selectedSectionCode,
    activeGovernanceProofRefreshBatchIds,
    resolvedBatchPolicy,
    resolvedStagePolicy,
    selectedStageOffering,
    queueProofRefreshBatches,
    setResolvedBatchPolicy,
    setResolvedStagePolicy,
    setPolicyForm,
    setStagePolicyForm,
    setSelectedStageEligibility,
    setFlashMessage,
  } = deps

  const handleSaveScopePolicy = async () => {
    if (!activeGovernanceScope) return
    await runAction(async () => {
      const existing = activeScopePolicyOverride
      const payload = {
        scopeType: activeGovernanceScope.scopeType,
        scopeId: activeGovernanceScope.scopeId,
        policy: buildValidatedPolicyPayload(policyForm),
        status: 'active',
      }
      if (existing) await apiClient.updatePolicyOverride(existing.policyOverrideId, { ...payload, version: existing.version })
      else await apiClient.createPolicyOverride(payload)
      await loadAdminData()
      if (preferredGovernanceBatchId) {
        const nextResolved = await apiClient.getResolvedBatchPolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedBatchPolicy(nextResolved)
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'policy refresh')
        : []
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy saved and proof batch refreshed.`
        : `${activeGovernanceScope.label} policy saved.`)
    })
  }

  const handleResetScopePolicy = async () => {
    if (!activeGovernanceScope) {
      setFlashMessage('Select a hierarchy scope before resetting governance.')
      return
    }
    if (!activeScopePolicyOverride) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      }))
      return
    }
    const existing = activeScopePolicyOverride
    if (!existing) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      }))
      return
    }
    await runAction(async () => {
      await apiClient.updatePolicyOverride(existing.policyOverrideId, {
        scopeType: existing.scopeType,
        scopeId: existing.scopeId,
        policy: existing.policy,
        status: 'archived',
        version: existing.version,
      })
      await loadAdminData()
      let nextResolved: ApiResolvedBatchPolicy | null = null
      if (preferredGovernanceBatchId) {
        nextResolved = await apiClient.getResolvedBatchPolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedBatchPolicy(nextResolved)
        setPolicyForm(hydratePolicyForm(nextResolved.effectivePolicy))
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'policy reset')
        : []
      const rollbackMessage = describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: nextResolved ?? resolvedBatchPolicy,
        subject: 'policy',
      })
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy override reset and proof batch refreshed. ${rollbackMessage}`
        : `${activeGovernanceScope.label} policy override reset. ${rollbackMessage}`)
    })
  }

  const handleSaveScopeStagePolicy = async () => {
    if (!activeGovernanceScope) return
    await runAction(async () => {
      const payload = {
        scopeType: activeGovernanceScope.scopeType,
        scopeId: activeGovernanceScope.scopeId,
        policy: buildStagePolicyPayload(stagePolicyForm),
        status: 'active',
      }
      if (activeScopeStageOverride) await apiClient.updateStagePolicyOverride(activeScopeStageOverride.stagePolicyOverrideId, { ...payload, version: activeScopeStageOverride.version })
      else await apiClient.createStagePolicyOverride(payload)
      await loadAdminData()
      if (preferredGovernanceBatchId) {
        const nextResolved = await apiClient.getResolvedStagePolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedStagePolicy(nextResolved)
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'stage policy refresh')
        : []
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} stage policy saved and proof batch refreshed.`
        : `${activeGovernanceScope.label} stage policy saved.`)
    })
  }

  const handleResetScopeStagePolicy = async () => {
    if (!activeGovernanceScope) {
      setFlashMessage('Select a hierarchy scope before resetting stage policy.')
      return
    }
    if (!activeScopeStageOverride) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedStagePolicy,
        subject: 'stage policy',
      }))
      return
    }
    await runAction(async () => {
      await apiClient.updateStagePolicyOverride(activeScopeStageOverride.stagePolicyOverrideId, {
        scopeType: activeScopeStageOverride.scopeType,
        scopeId: activeScopeStageOverride.scopeId,
        policy: activeScopeStageOverride.policy,
        status: 'archived',
        version: activeScopeStageOverride.version,
      })
      await loadAdminData()
      let nextResolved: ApiResolvedBatchStagePolicy | null = null
      if (preferredGovernanceBatchId) {
        nextResolved = await apiClient.getResolvedStagePolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedStagePolicy(nextResolved)
        setStagePolicyForm(hydrateStagePolicyForm(nextResolved.effectivePolicy))
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'stage policy reset')
        : []
      const rollbackMessage = describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: nextResolved ?? resolvedStagePolicy,
        subject: 'stage policy',
      })
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} stage policy override reset and proof batch refreshed. ${rollbackMessage}`
        : `${activeGovernanceScope.label} stage policy override reset. ${rollbackMessage}`)
    })
  }

  const handleAdvanceOfferingStage = async () => {
    if (!selectedStageOffering) return
    await runAction(async () => {
      const nextEligibility = await apiClient.advanceOfferingStage(selectedStageOffering.offId)
      setSelectedStageEligibility(nextEligibility)
      await loadAdminData()
      setFlashMessage(`${selectedStageOffering.code} · Section ${selectedStageOffering.section} advanced to ${nextEligibility.currentStage.label}.`)
    })
  }

  return {
    handleSaveScopePolicy,
    handleResetScopePolicy,
    handleSaveScopeStagePolicy,
    handleResetScopeStagePolicy,
    handleAdvanceOfferingStage,
  }
}
