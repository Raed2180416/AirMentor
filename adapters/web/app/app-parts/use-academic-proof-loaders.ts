import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import { clearProofPlaybackSelection } from '@web/simulation/proof-playback'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import type { ApiAcademicBootstrap, ApiSessionResponse } from '@web/shared/api/types'
import type { ProofPlaybackNotice } from './types'

export type UseAcademicProofLoadersParams = {
  apiClient: AirMentorApiClient | null
  playbackCheckpointId: string | null
  refreshAcademicProjection: (session?: ApiSessionResponse | null) => Promise<ApiAcademicBootstrap | null>
  setProofPlaybackNotice: Dispatch<SetStateAction<ProofPlaybackNotice | null>>
}

export function useAcademicProofLoaders({
  apiClient,
  playbackCheckpointId,
  refreshAcademicProjection,
  setProofPlaybackNotice,
}: UseAcademicProofLoadersParams) {
  const loadAcademicFacultyProfile = useCallback(async (facultyId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicFacultyProfile(facultyId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.faculty_profile.load_failed', {
        workspace: 'academic',
        facultyId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const loadAcademicHodProofAnalytics = useCallback(async () => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      const bundlePromise = apiClient.getAcademicHodProofBundle(playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('HoD proof analytics request timed out after 90s')), 90_000)
      })
      return await Promise.race([bundlePromise, timeoutPromise])
    } catch (error) {
      emitClientOperationalEvent('proof.analytics.load_failed', {
        workspace: 'academic',
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  // Phase-11 authoritative simulator counterfactual loader. Prompt §C.13 +
  // §G.6 + §L.10 — replaces the diagnostic flag-diff loader as the primary
  // final-analytics path.
  const loadAcademicHodProofCounterfactualSimulator = useCallback(async (input: { runId: string }) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicHodProofCounterfactualSimulator(input)
    } catch (error) {
      emitClientOperationalEvent('proof.counterfactual_simulator.load_failed', {
        workspace: 'academic',
        simulationRunId: input.runId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const loadAcademicStudentAgentCard = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicStudentAgentCard(studentId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.student_shell.load_failed', {
        workspace: 'academic',
        studentId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const loadAcademicStudentAgentTimeline = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicStudentAgentTimeline(studentId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.student_timeline.load_failed', {
        workspace: 'academic',
        studentId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const startAcademicStudentAgentSession = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    return apiClient.startAcademicStudentAgentSession(studentId, playbackCheckpointId ? {
      simulationStageCheckpointId: playbackCheckpointId,
    } : undefined)
  }, [apiClient, playbackCheckpointId])

  const sendAcademicStudentAgentMessage = useCallback((sessionId: string, payload: { prompt: string }) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    return apiClient.sendAcademicStudentAgentMessage(sessionId, payload)
  }, [apiClient])

  const loadAcademicStudentRiskExplorer = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicStudentRiskExplorer(studentId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.risk_explorer.load_failed', {
        workspace: 'academic',
        studentId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const handleAdvanceAcademicProofRun = useCallback(async (simulationRunId: string, mode: 'day' | 'previous-day' | 'stage', options: { refreshWorkspace?: boolean } = {}) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    await apiClient.advanceAcademicProofRun(simulationRunId, { mode })
    if (options.refreshWorkspace !== false) {
      clearProofPlaybackSelection()
      setProofPlaybackNotice(null)
      await refreshAcademicProjection()
    }
  }, [apiClient, refreshAcademicProjection])

  const handleStopAcademicProofRun = useCallback(async (simulationRunId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    await apiClient.stopAcademicProofRun(simulationRunId)
    clearProofPlaybackSelection()
    setProofPlaybackNotice(null)
    await refreshAcademicProjection()
  }, [apiClient, refreshAcademicProjection])

  const handleRecomputeAcademicProofRunRisk = useCallback(async (simulationRunId: string, options: { refreshWorkspace?: boolean } = {}) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    await apiClient.recomputeAcademicProofRunRisk(simulationRunId)
    if (options.refreshWorkspace !== false) {
      await refreshAcademicProjection()
    }
  }, [apiClient, refreshAcademicProjection])

  const handleResolveAcademicProofReassessment = useCallback(async (reassessmentEventId: string, options: { refreshWorkspace?: boolean } = {}) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    const result = await apiClient.resolveAcademicProofReassessment(reassessmentEventId, {
      outcome: 'completed_improving',
      note: 'Guided intervention resolution.',
    })
    if (options.refreshWorkspace !== false) {
      await refreshAcademicProjection()
    }
    return result
  }, [apiClient, refreshAcademicProjection])

  const handleStepAcademicProofPlayback = useCallback(async () => {
    await refreshAcademicProjection()
  }, [refreshAcademicProjection])

  return {
    loadAcademicFacultyProfile,
    loadAcademicHodProofAnalytics,
    loadAcademicHodProofCounterfactualSimulator,
    loadAcademicStudentAgentCard,
    loadAcademicStudentAgentTimeline,
    startAcademicStudentAgentSession,
    sendAcademicStudentAgentMessage,
    loadAcademicStudentRiskExplorer,
    handleAdvanceAcademicProofRun,
    handleStopAcademicProofRun,
    handleRecomputeAcademicProofRunRisk,
    handleResolveAcademicProofReassessment,
    handleStepAcademicProofPlayback,
  }
}
