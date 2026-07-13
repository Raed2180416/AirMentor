import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { hydrateAcademicData } from '@web/simulation/fixtures'
import { AirMentorApiError } from '@web/shared/api/client'
import type { AirMentorApiClient } from '@web/shared/api/client'
import {
  clearProofPlaybackSelection,
  PROOF_PLAYBACK_SELECTION_STORAGE_KEY,
  readSharedProofPlaybackSelection,
} from '@web/simulation/proof-playback'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import type {
  ApiAcademicBootstrap,
  ApiAcademicLoginFaculty,
  ApiSessionResponse,
} from '@web/shared/api/types'
import { restrictAcademicBootstrap, restrictVisibleFacultyOptions } from '../session-helpers'
import type { AcademicWorkspaceProjection } from '../workspace-types'
import type { ProofPlaybackNotice } from './types'

export type UseAcademicProjectionParams = {
  apiClient: AirMentorApiClient | null
  remoteSession: ApiSessionResponse | null
  setRemoteSession: Dispatch<SetStateAction<ApiSessionResponse | null>>
  setWorkspaceProjection: Dispatch<SetStateAction<AcademicWorkspaceProjection | null>>
  setLoginFaculty: Dispatch<SetStateAction<ApiAcademicLoginFaculty[]>>
  setPlaybackCheckpointId: Dispatch<SetStateAction<string | null>>
  setProofPlaybackNotice: Dispatch<SetStateAction<ProofPlaybackNotice | null>>
}

export function useAcademicProjection({
  apiClient,
  remoteSession,
  setRemoteSession,
  setWorkspaceProjection,
  setLoginFaculty,
  setPlaybackCheckpointId,
  setProofPlaybackNotice,
}: UseAcademicProjectionParams) {
  const commitAcademicProjection = useCallback((session: ApiSessionResponse, snapshot: ApiAcademicBootstrap) => {
    setRemoteSession(session)
    setWorkspaceProjection(current => ({
      session,
      bootstrap: snapshot,
      revision: (current?.revision ?? 0) + 1,
    }))
  }, [])

  const fetchAcademicBootstrap = useCallback(async () => {
    if (!apiClient) return null
    const syncSnapshot = (snapshot: ApiAcademicBootstrap) => {
      hydrateAcademicData(snapshot)
      setPlaybackCheckpointId(snapshot.proofPlayback?.simulationStageCheckpointId ?? null)
      setLoginFaculty(restrictVisibleFacultyOptions(snapshot.faculty.map(account => {
        const accountUsername = (account as { username?: string }).username ?? account.facultyId
        return {
          facultyId: account.facultyId,
          username: accountUsername,
          email: account.email,
          name: account.name,
          displayName: account.name,
          designation: account.roleTitle,
          dept: account.dept,
          departmentCode: account.dept,
          roleTitle: account.roleTitle,
          allowedRoles: account.allowedRoles,
          courseCodes: account.courseCodes,
          offeringIds: account.offeringIds,
          menteeIds: account.menteeIds,
        }
      })))
      return snapshot
    }
    const selection = readSharedProofPlaybackSelection('academic')
    try {
      const requestedCheckpointId = selection?.simulationStageCheckpointId ?? null
      const snapshot = restrictAcademicBootstrap(await apiClient.getAcademicBootstrap(requestedCheckpointId ? {
        simulationStageCheckpointId: requestedCheckpointId,
      } : undefined))
      const restoredCheckpointId = snapshot.proofPlayback?.simulationStageCheckpointId ?? null
      if (requestedCheckpointId && restoredCheckpointId === requestedCheckpointId) {
        const restoredCheckpointLabel = snapshot.proofPlayback?.stageLabel ?? 'selected checkpoint'
        const semesterLabel = snapshot.proofPlayback?.semesterNumber != null
          ? `Semester ${snapshot.proofPlayback.semesterNumber}`
          : 'the selected semester'
        setProofPlaybackNotice({
          tone: 'neutral',
          message: `Proof playback restored to ${semesterLabel} · ${restoredCheckpointLabel}. Use Reset playback to return to the active proof-run view.`,
        })
        emitClientOperationalEvent('proof.playback.restored', {
          workspace: 'academic',
          simulationStageCheckpointId: restoredCheckpointId,
          semesterLabel,
          stageLabel: restoredCheckpointLabel,
        })
      } else if (requestedCheckpointId) {
        clearProofPlaybackSelection()
        setProofPlaybackNotice({
          tone: 'error',
          message: 'Saved proof playback checkpoint is no longer available in this academic scope. Reset playback to return to the active proof-run view.',
        })
        emitClientOperationalEvent('proof.playback.invalidated', {
          workspace: 'academic',
          requestedCheckpointId,
        }, { level: 'warn' })
      } else {
        setProofPlaybackNotice(null)
      }
      return syncSnapshot(snapshot)
    } catch (error) {
      // GAP-5: No active proof run — teacher must wait for sysadmin to start a simulation.
      // Surface this as a clear gate rather than a generic error or blank workspace.
      const isNoActiveRun = error instanceof AirMentorApiError
        && error.status === 403
        && typeof error.details === 'object'
        && error.details !== null
        && (error.details as Record<string, unknown>).error === 'NO_ACTIVE_PROOF_RUN'
      if (isNoActiveRun) {
        emitClientOperationalEvent('academic.bootstrap.no_active_proof_run', {
          workspace: 'academic',
        }, { level: 'warn' })
        throw error
      }
      const invalidSelection = selection?.simulationStageCheckpointId
        && error instanceof AirMentorApiError
        && (error.status === 403 || error.status === 404)
      if (!invalidSelection) {
        emitClientOperationalEvent('academic.bootstrap.load_failed', {
          workspace: 'academic',
          requestedCheckpointId: selection?.simulationStageCheckpointId ?? null,
          error: normalizeClientTelemetryError(error),
        }, { level: 'error' })
        throw error
      }
      clearProofPlaybackSelection()
      setProofPlaybackNotice({
        tone: 'error',
        message: 'The selected proof playback checkpoint is no longer accessible in this academic scope. Reset playback to return to the active proof-run view.',
      })
      emitClientOperationalEvent('proof.playback.inaccessible', {
        workspace: 'academic',
        requestedCheckpointId: selection?.simulationStageCheckpointId ?? null,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      const snapshot = restrictAcademicBootstrap(await apiClient.getAcademicBootstrap())
      return syncSnapshot(snapshot)
    }
  }, [apiClient])

  const refreshAcademicProjection = useCallback(async (session: ApiSessionResponse | null = remoteSession) => {
    if (!session) return null
    const snapshot = await fetchAcademicBootstrap()
    if (!snapshot) return null
    commitAcademicProjection(session, snapshot)
    return snapshot
  }, [commitAcademicProjection, fetchAcademicBootstrap, remoteSession])

  const handleResetProofPlaybackSelection = useCallback(async () => {
    clearProofPlaybackSelection()
    setProofPlaybackNotice(null)
    await refreshAcademicProjection().catch(() => undefined)
  }, [refreshAcademicProjection])

  useEffect(() => {
    if (typeof window === 'undefined' || !remoteSession?.faculty?.facultyId) return undefined
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PROOF_PLAYBACK_SELECTION_STORAGE_KEY) return
      void refreshAcademicProjection().catch(() => undefined)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refreshAcademicProjection, remoteSession?.faculty?.facultyId])

  return {
    commitAcademicProjection,
    fetchAcademicBootstrap,
    refreshAcademicProjection,
    handleResetProofPlaybackSelection,
  }
}
