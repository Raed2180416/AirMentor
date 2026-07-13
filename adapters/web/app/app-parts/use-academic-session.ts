import { useCallback, useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Role } from '@kernel/shared/domain'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories } from '@persistence/repositories/air-mentor-repositories'
import { AirMentorApiError } from '@web/shared/api/client'
import type { AirMentorApiClient } from '@web/shared/api/client'
import { useApiConnectionTarget } from '@web/shared/api/api-connection'
import { clearProofPlaybackSelection } from '@web/simulation/proof-playback'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import type {
  ApiAcademicBootstrap,
  ApiAcademicLoginFaculty,
  ApiPasswordSetupInspectResponse,
  ApiPasswordSetupRequestResponse,
  ApiSessionResponse,
} from '@web/shared/api/types'
import {
  clearPasswordSetupTokenFromUrl,
  mapApiRoleToRole,
  restrictVisibleFacultyOptions,
} from '../session-helpers'
import type { AcademicWorkspaceProjection } from '../workspace-types'
import type { ProofPlaybackNotice } from './types'

export type UseAcademicSessionParams = {
  apiConnection: ReturnType<typeof useApiConnectionTarget>
  apiClient: AirMentorApiClient | null
  remoteSessionRepositories: ReturnType<typeof createAirMentorRepositories> | null
  remoteSession: ApiSessionResponse | null
  passwordSetupToken: string | null
  workspaceProjection: AcademicWorkspaceProjection | null
  fetchAcademicBootstrap: () => Promise<ApiAcademicBootstrap | null>
  commitAcademicProjection: (session: ApiSessionResponse, snapshot: ApiAcademicBootstrap) => void
  handleReturnToPortal: () => void
  setBooting: Dispatch<SetStateAction<boolean>>
  setAuthBusy: Dispatch<SetStateAction<boolean>>
  setAuthError: Dispatch<SetStateAction<string>>
  setLoginFaculty: Dispatch<SetStateAction<ApiAcademicLoginFaculty[]>>
  setRemoteSession: Dispatch<SetStateAction<ApiSessionResponse | null>>
  setWorkspaceProjection: Dispatch<SetStateAction<AcademicWorkspaceProjection | null>>
  setWorkspaceLoadingLabel: Dispatch<SetStateAction<string>>
  setPasswordSetupInspect: Dispatch<SetStateAction<ApiPasswordSetupInspectResponse | null>>
  setPasswordSetupBusy: Dispatch<SetStateAction<boolean>>
  setPasswordSetupError: Dispatch<SetStateAction<string>>
  setPasswordSetupMessage: Dispatch<SetStateAction<string>>
  setPasswordSetupRequestResult: Dispatch<SetStateAction<ApiPasswordSetupRequestResponse | null>>
  setPasswordSetupToken: Dispatch<SetStateAction<string | null>>
  setProofPlaybackNotice: Dispatch<SetStateAction<ProofPlaybackNotice | null>>
  setPlaybackCheckpointId: Dispatch<SetStateAction<string | null>>
}

export function useAcademicSession({
  apiConnection,
  apiClient,
  remoteSessionRepositories,
  remoteSession,
  passwordSetupToken,
  workspaceProjection,
  fetchAcademicBootstrap,
  commitAcademicProjection,
  handleReturnToPortal,
  setBooting,
  setAuthBusy,
  setAuthError,
  setLoginFaculty,
  setRemoteSession,
  setWorkspaceProjection,
  setWorkspaceLoadingLabel,
  setPasswordSetupInspect,
  setPasswordSetupBusy,
  setPasswordSetupError,
  setPasswordSetupMessage,
  setPasswordSetupRequestResult,
  setPasswordSetupToken,
  setProofPlaybackNotice,
  setPlaybackCheckpointId,
}: UseAcademicSessionParams) {
  useEffect(() => {
    if (!apiConnection.initialCheckComplete || !apiClient || !passwordSetupToken) {
      if (!passwordSetupToken) setPasswordSetupInspect(null)
      return
    }
    let cancelled = false
    setPasswordSetupBusy(true)
    setPasswordSetupError('')
    void (async () => {
      try {
        const inspected = await apiClient.inspectPasswordSetup(passwordSetupToken)
        if (!cancelled) setPasswordSetupInspect(inspected)
      } catch (error) {
        if (!cancelled) {
          setPasswordSetupInspect(null)
          setPasswordSetupError(error instanceof Error ? error.message : 'Could not validate the password setup link.')
        }
      } finally {
        if (!cancelled) setPasswordSetupBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiClient, apiConnection.initialCheckComplete, passwordSetupToken])

  useEffect(() => {
    if (!apiConnection.initialCheckComplete) {
      setBooting(true)
      return
    }
    if (!apiClient || !remoteSessionRepositories) {
      setAuthError('No API connection target is configured. Set VITE_AIRMENTOR_API_BASE_URL (and optionally VITE_AIRMENTOR_API_FALLBACK_BASE_URLS).')
      setBooting(false)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        void apiClient.listAcademicLoginFaculty()
          .then(publicFaculty => {
            if (!cancelled && publicFaculty?.items?.length) {
              setLoginFaculty(restrictVisibleFacultyOptions(publicFaculty.items))
            }
          })
          .catch(() => undefined)
        const restoredSession = await remoteSessionRepositories.sessionPreferences.restoreRemoteSession()
        if (cancelled) return
        const restoredRole = restoredSession ? mapApiRoleToRole(restoredSession.activeRoleGrant.roleCode) : null
        if (restoredSession?.faculty?.facultyId && restoredRole) {
          emitClientOperationalEvent('auth.session.restored', {
            workspace: 'academic',
            sessionId: restoredSession.sessionId,
            facultyId: restoredSession.faculty.facultyId,
            activeRole: restoredSession.activeRoleGrant.roleCode,
          })
          setRemoteSession(restoredSession)
          setWorkspaceProjection(null)
          setWorkspaceLoadingLabel('Restoring teaching workspace...')
          setBooting(false)
          const snapshot = await fetchAcademicBootstrap()
          if (cancelled) return
          if (!snapshot) {
            setWorkspaceLoadingLabel('')
            return
          }
          commitAcademicProjection(restoredSession, snapshot)
          setWorkspaceLoadingLabel('')
        } else {
          setRemoteSession(null)
          setWorkspaceProjection(null)
          setWorkspaceLoadingLabel('')
        }
      } catch (error) {
        if (cancelled) return
        emitClientOperationalEvent('auth.session.restore_failed', {
          workspace: 'academic',
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        setAuthError(error instanceof Error ? error.message : 'Could not restore the academic portal session.')
        setRemoteSession(null)
        setWorkspaceProjection(null)
        setWorkspaceLoadingLabel('')
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [apiClient, apiConnection.initialCheckComplete, commitAcademicProjection, fetchAcademicBootstrap, remoteSessionRepositories])

  const remoteRepositories = useMemo(() => (
    apiClient && workspaceProjection?.bootstrap
      ? createAirMentorRepositories({
          repositoryMode: 'http',
          apiClient,
          academicBootstrap: workspaceProjection.bootstrap,
          remoteFacultyStorageKey: AIRMENTOR_STORAGE_KEYS.currentFacultyId,
        })
      : null
  ), [apiClient, workspaceProjection?.bootstrap])

  const handleRemoteLogin = useCallback(async (identifier: string, password: string) => {
    if (!remoteSessionRepositories) throw new Error('Academic backend is unavailable.')
    setAuthBusy(true)
    setAuthError('')
    try {
      const session = await remoteSessionRepositories.sessionPreferences.loginRemoteSession({
        identifier,
        password,
      })
      const role = mapApiRoleToRole(session.activeRoleGrant.roleCode)
      if (!session.faculty?.facultyId || !role) {
        throw new Error('This account does not have an academic portal role.')
      }
      setRemoteSession(session)
      setWorkspaceProjection(null)
      setWorkspaceLoadingLabel('Opening teaching workspace...')
      const snapshot = await fetchAcademicBootstrap()
      if (!snapshot) throw new Error('Academic bootstrap did not return a session projection.')
      commitAcademicProjection(session, snapshot)
      setWorkspaceLoadingLabel('')
    } catch (error) {
      const isNoActiveRun = error instanceof AirMentorApiError
        && error.status === 403
        && typeof error.details === 'object'
        && error.details !== null
        && (error.details as Record<string, unknown>).error === 'NO_ACTIVE_PROOF_RUN'
      const message = isNoActiveRun
        ? 'No simulation is currently active. Ask your administrator to start a proof run before logging in.'
        : error instanceof AirMentorApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Academic login failed.'
      setRemoteSession(null)
      setWorkspaceProjection(null)
      setAuthError(message)
      setWorkspaceLoadingLabel('')
      throw new Error(message)
    } finally {
      setAuthBusy(false)
    }
  }, [commitAcademicProjection, fetchAcademicBootstrap, remoteSessionRepositories])

  const handleRequestPasswordSetup = useCallback(async (identifier: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    setPasswordSetupBusy(true)
    setPasswordSetupError('')
    setPasswordSetupMessage('')
    try {
      const result = await apiClient.requestPasswordSetup({ identifier })
      setPasswordSetupRequestResult(result)
      setPasswordSetupMessage(result.message)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare the password setup link.'
      setPasswordSetupError(message)
      throw new Error(message)
    } finally {
      setPasswordSetupBusy(false)
    }
  }, [apiClient])

  const handleRedeemPasswordSetup = useCallback(async (password: string) => {
    if (!apiClient || !passwordSetupToken) throw new Error('Password setup link is unavailable.')
    setPasswordSetupBusy(true)
    setPasswordSetupError('')
    try {
      const result = await apiClient.redeemPasswordSetup({ token: passwordSetupToken, password })
      clearPasswordSetupTokenFromUrl()
      setPasswordSetupToken(null)
      setPasswordSetupInspect(null)
      setPasswordSetupRequestResult(null)
      setPasswordSetupMessage(`Password saved for ${result.displayName}. Sign in with your username or email now.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the new password.'
      setPasswordSetupError(message)
      throw new Error(message)
    } finally {
      setPasswordSetupBusy(false)
    }
  }, [apiClient, passwordSetupToken])

  const handleRemoteLogout = useCallback(async () => {
    if (!remoteSessionRepositories) return
    clearProofPlaybackSelection()
    setProofPlaybackNotice(null)
    setPlaybackCheckpointId(null)
    setRemoteSession(null)
    setWorkspaceProjection(null)
    setWorkspaceLoadingLabel('')
    handleReturnToPortal()
    void remoteSessionRepositories.sessionPreferences.logoutRemoteSession().catch(() => undefined)
  }, [handleReturnToPortal, remoteSessionRepositories])

  const handleRemoteRoleChange = useCallback(async (role: Role) => {
    if (!remoteSession || !remoteSessionRepositories) return
    const match = remoteSession.availableRoleGrants.find(grant => mapApiRoleToRole(grant.roleCode) === role)
    if (!match) return
    setWorkspaceLoadingLabel(`Switching to ${role}...`)
    try {
      const nextSession = await remoteSessionRepositories.sessionPreferences.switchRemoteRoleContext(match.grantId)
      setRemoteSession(nextSession)
      setWorkspaceProjection(null)
      const snapshot = await fetchAcademicBootstrap()
      if (!snapshot) throw new Error('Academic bootstrap did not return a session projection.')
      commitAcademicProjection(nextSession, snapshot)
    } finally {
      setWorkspaceLoadingLabel('')
    }
  }, [commitAcademicProjection, fetchAcademicBootstrap, remoteSession, remoteSessionRepositories])

  return {
    remoteRepositories,
    handleRemoteLogin,
    handleRequestPasswordSetup,
    handleRedeemPasswordSetup,
    handleRemoteLogout,
    handleRemoteRoleChange,
  }
}
