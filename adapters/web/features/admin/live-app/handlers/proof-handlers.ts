import type { Dispatch, SetStateAction } from 'react'
import { AirMentorApiError, type AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
} from '@web/shared/api/types'
import { clearProofPlaybackSelection } from '@web/simulation/proof-playback'
import type { ProofAdvanceControlMode } from '@web/simulation/proof-simulation-controls'
import type { LiveAdminDataset } from '../../system-admin-live-data'

export interface ProofHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  proofControlBatchId: string
  proofDashboard: ApiProofDashboard | null
  queueSelectedProofRefresh: (reason: string, curriculumImportVersionId?: string | null) => Promise<string[]>
  refreshCurriculumFeatureConfig: (batchId: string) => Promise<unknown>
  refreshProofDashboard: (batchId: string) => Promise<ApiProofDashboard>
  setData: Dispatch<SetStateAction<LiveAdminDataset>>
  setFlashMessage: Dispatch<SetStateAction<string>>
  setSelectedProofCheckpointSource: Dispatch<SetStateAction<'auto' | 'restored' | 'manual'>>
  setProofPlaybackRestoreNotice: Dispatch<SetStateAction<{ tone: 'neutral' | 'error'; message: string } | null>>
  setSelectedProofCheckpointDetail: Dispatch<SetStateAction<ApiProofRunCheckpointDetail | null>>
  setSelectedProofCheckpointId: Dispatch<SetStateAction<string | null>>
}

export function createProofHandlers(deps: ProofHandlerDeps) {
  const {
    apiClient,
    runAction,
    proofControlBatchId,
    proofDashboard,
    queueSelectedProofRefresh,
    refreshCurriculumFeatureConfig,
    refreshProofDashboard,
    setData,
    setFlashMessage,
    setSelectedProofCheckpointSource,
    setProofPlaybackRestoreNotice,
    setSelectedProofCheckpointDetail,
    setSelectedProofCheckpointId,
  } = deps

  const handleCreateProofImport = async () => {
    await runAction(async () => {
      await apiClient.createProofImport(proofControlBatchId)
      await refreshCurriculumFeatureConfig(proofControlBatchId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof curriculum import created from the reconciled workbook.')
    })
  }

  const handleValidateLatestProofImport = async () => {
    const latestImport = proofDashboard?.imports[0]
    if (!latestImport) return
    await runAction(async () => {
      await apiClient.validateProofImport(latestImport.curriculumImportVersionId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Latest proof import validated.')
    })
  }

  const handleReviewPendingCrosswalks = async () => {
    if (!proofDashboard?.crosswalkReviewQueue.length || !proofDashboard.imports[0]) return
    await runAction(async () => {
      await apiClient.reviewProofCrosswalks(proofDashboard.imports[0].curriculumImportVersionId, {
        reviews: proofDashboard.crosswalkReviewQueue.map(item => ({
          officialCodeCrosswalkId: item.officialCodeCrosswalkId,
          reviewStatus: 'accepted-with-note',
          overrideReason: 'Reviewed in the sysadmin proof shell for the first-6-semester proof batch.',
        })),
      })
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Pending proof crosswalk entries marked as reviewed.')
    })
  }

  const handleApproveLatestProofImport = async () => {
    const latestImport = proofDashboard?.imports[0]
    if (!latestImport) return
    await runAction(async () => {
      await apiClient.approveProofImport(latestImport.curriculumImportVersionId)
      const rerun = await queueSelectedProofRefresh('proof import approval', latestImport.curriculumImportVersionId)
      await refreshCurriculumFeatureConfig(proofControlBatchId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(
        rerun.length > 0
          ? 'Latest proof import approved, synced into the batch curriculum snapshot, and republished as the active proof run.'
          : 'Latest proof import approved and synced into the batch curriculum snapshot.',
      )
    })
  }

  const handleCreateProofRun = async () => {
    const preferredImport = proofDashboard?.imports.find(item => item.status === 'approved') ?? proofDashboard?.imports[0]
    if (!preferredImport) return
    await runAction(async () => {
      const queuedRun = await apiClient.createProofRun(proofControlBatchId, {
        curriculumImportVersionId: preferredImport.curriculumImportVersionId,
        activate: true,
      })
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(`Proof simulation rerun queued as ${queuedRun.simulationRunId}. It will publish automatically when background execution completes.`)
    })
  }

  const handleCreateProofSimulation = async () => {
    await runAction(async () => {
      const createdImport = await apiClient.createProofImport(proofControlBatchId)
      await refreshCurriculumFeatureConfig(proofControlBatchId)
      const queuedRun = await apiClient.createProofRun(proofControlBatchId, {
        curriculumImportVersionId: createdImport.curriculumImportVersionId,
        activate: true,
      })
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(`Proof simulation created as ${queuedRun.simulationRunId}. It will publish automatically when background execution completes.`)
    })
  }

  const handleRetryProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.retryProofRun(simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Failed proof run re-queued for background execution.')
    })
  }

  const handleActivateProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.activateProofRun(simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Selected proof run is now active.')
    })
  }

  const handleActivateProofSemester = async (simulationRunId: string, semesterNumber: number) => {
    await runAction(async () => {
      const activation = await apiClient.activateProofSemester(simulationRunId, {
        semesterNumber: semesterNumber as 1 | 2 | 3 | 4 | 5 | 6,
      })
      setData(prev => ({
        ...prev,
        batches: prev.batches.map(batch => (
          batch.batchId === activation.batchId
            ? {
                ...batch,
                currentSemester: activation.activeOperationalSemester,
                updatedAt: new Date().toISOString(),
              }
            : batch
        )),
      }))
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(`Proof operational semester switched to Semester ${semesterNumber}.`)
    })
  }

  const handleAdvanceProofRun = async (simulationRunId: string, mode: ProofAdvanceControlMode) => {
    await runAction(async () => {
      try {
        await apiClient.advanceProofRun(simulationRunId, { mode })
      } catch (error) {
        if (error instanceof AirMentorApiError && error.status === 409) {
          await refreshProofDashboard(proofControlBatchId)
          setFlashMessage('Proof run is still preparing checkpoints. Refreshed status; retry when progress finishes.')
          return
        }
        throw error
      }
      clearProofPlaybackSelection()
      setSelectedProofCheckpointSource('auto')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(null)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(mode === 'day' ? 'Proof simulation advanced by one day.' : 'Proof simulation advanced to the next stage.')
    })
  }

  const handleStopProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.stopProofRun(simulationRunId)
      clearProofPlaybackSelection()
      setSelectedProofCheckpointSource('auto')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(null)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof simulation stopped.')
    })
  }

  const handleArchiveProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.archiveProofRun(simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Selected proof run archived.')
    })
  }

  const handleRecomputeProofRunRisk = async () => {
    if (!proofDashboard?.activeRunDetail) return
    const activeRunDetail = proofDashboard.activeRunDetail
    await runAction(async () => {
      await apiClient.recomputeProofRunRisk(activeRunDetail.simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Observable-only risk recomputed for the active proof run.')
    })
  }

  const handleRestoreProofSnapshot = async (simulationRunId: string, simulationResetSnapshotId?: string) => {
    await runAction(async () => {
      await apiClient.restoreProofRunSnapshot(simulationRunId, simulationResetSnapshotId ? { simulationResetSnapshotId } : undefined)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof run restored from the selected snapshot.')
    })
  }

  const handleResetProofRunFromScratch = async (simulationRunId: string, simulationResetSnapshotId?: string) => {
    if (!simulationResetSnapshotId) return
    if (!window.confirm('Reset the active proof branch from the baseline snapshot and pin it back to Semester 1? This creates a fresh run and replaces the current active proof run.')) return
    await runAction(async () => {
      const restored = await apiClient.restoreProofRunSnapshot(simulationRunId, { simulationResetSnapshotId })
      const activation = await apiClient.activateProofSemester(restored.simulationRunId, { semesterNumber: 1 })
      clearProofPlaybackSelection()
      setSelectedProofCheckpointSource('auto')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(null)
      setData(prev => ({
        ...prev,
        batches: prev.batches.map(batch => (
          batch.batchId === activation.batchId
            ? {
                ...batch,
                currentSemester: activation.activeOperationalSemester,
                updatedAt: new Date().toISOString(),
              }
            : batch
        )),
      }))
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof branch reset from the baseline snapshot and pinned to Semester 1.')
    })
  }

  return {
    handleCreateProofImport,
    handleValidateLatestProofImport,
    handleReviewPendingCrosswalks,
    handleApproveLatestProofImport,
    handleCreateProofRun,
    handleCreateProofSimulation,
    handleRetryProofRun,
    handleActivateProofRun,
    handleActivateProofSemester,
    handleAdvanceProofRun,
    handleStopProofRun,
    handleArchiveProofRun,
    handleRecomputeProofRunRisk,
    handleRestoreProofSnapshot,
    handleResetProofRunFromScratch,
  }
}
