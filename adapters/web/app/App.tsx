import { useState, useMemo, useCallback, useEffect} from 'react'
import { hydrateAcademicData,
} from '@web/simulation/fixtures'
import {
  type Role,
} from '@kernel/shared/domain'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories} from '@persistence/repositories/air-mentor-repositories'
import { PortalEntryScreen } from './portal-entry'
import { clearPortalWorkspaceHints, getPortalHash, hashBelongsToPortalRoute, navigateToPortal, resolvePortalRoute, type PortalRoute } from './portal-routing'
import { SystemAdminApp } from '@web/features/admin/system-admin-app'
import {
  AcademicRouteLoadingFallback,
  AcademicSessionBoundary,
} from '@web/features/academic-session-shell'
import { AirMentorApiClient, AirMentorApiError } from '@web/shared/api/client'
import { readActiveDemoWorkspacePointer } from '@web/simulation/demo-workspace-pointer'
import { useApiConnectionTarget } from '@web/shared/api/api-connection'
import type {
  ApiAcademicBootstrap,
  ApiAcademicLoginFaculty,
  ApiPasswordSetupInspectResponse,
  ApiPasswordSetupRequestResponse,
  ApiSessionResponse,
} from '@web/shared/api/types'
import { ApiFallbackIndicator, BackendOfflineIndicator, useBackendHealthMonitor } from '@web/shared/components/backend-health-indicator'
import { clearProofPlaybackSelection, PROOF_PLAYBACK_SELECTION_STORAGE_KEY, readSharedProofPlaybackSelection } from '@web/simulation/proof-playback'
import { collectFrontendStartupDiagnostics } from '@web/shared/state/startup-diagnostics'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import './App.css'

export { FacultyProfilePage } from '@web/features/academic-faculty-profile-page'

export { RequiredNoteModal } from './required-note-modal'
export { TaskComposerModal } from './task-composer-modal'
export { StudentDrawer } from './student-drawer'
export { ActionQueue } from './action-queue'
import { OperationalWorkspace } from './operational-workspace'
import type { AcademicWorkspaceProjection } from './workspace-types'
import {
  clearPasswordSetupTokenFromUrl,
  getAcademicApiBaseUrl,
  mapApiRoleToRole,
  readPasswordSetupTokenFromUrl,
  restrictAcademicBootstrap,
  restrictVisibleFacultyOptions,
} from './session-helpers'

export function OperationalApp() {
  const configuredApiBaseUrl = getAcademicApiBaseUrl()
  const apiConnection = useApiConnectionTarget(configuredApiBaseUrl)
  const apiBaseUrl = apiConnection.activeBaseUrl
  const liveAcademicMode = apiConnection.candidateBaseUrls.length > 0
  const telemetrySinkUrl = import.meta.env.VITE_AIRMENTOR_TELEMETRY_SINK_URL?.trim() || ''
  const apiClient = useMemo(() => (apiBaseUrl ? new AirMentorApiClient(apiBaseUrl, undefined, readActiveDemoWorkspacePointer) : null), [apiBaseUrl])
  const backendHealthMonitor = useBackendHealthMonitor(apiBaseUrl, { enabled: liveAcademicMode })
  const startupDiagnostics = useMemo(
    () => collectFrontendStartupDiagnostics({ apiBaseUrl: configuredApiBaseUrl || apiBaseUrl, telemetrySinkUrl }),
    [apiBaseUrl, configuredApiBaseUrl, telemetrySinkUrl],
  )
  const remoteSessionRepositories = useMemo(() => (
    apiClient
      ? createAirMentorRepositories({
          repositoryMode: 'http',
          apiClient,
          remoteFacultyStorageKey: AIRMENTOR_STORAGE_KEYS.currentFacultyId,
        })
      : null
  ), [apiClient])
  const [booting, setBooting] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [workspaceLoadingLabel, setWorkspaceLoadingLabel] = useState('')
  const [passwordSetupToken, setPasswordSetupToken] = useState<string | null>(() => readPasswordSetupTokenFromUrl())
  const [passwordSetupInspect, setPasswordSetupInspect] = useState<ApiPasswordSetupInspectResponse | null>(null)
  const [passwordSetupRequestResult, setPasswordSetupRequestResult] = useState<ApiPasswordSetupRequestResponse | null>(null)
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false)
  const [passwordSetupError, setPasswordSetupError] = useState('')
  const [passwordSetupMessage, setPasswordSetupMessage] = useState('')
  const [remoteSession, setRemoteSession] = useState<ApiSessionResponse | null>(null)
  const [workspaceProjection, setWorkspaceProjection] = useState<AcademicWorkspaceProjection | null>(null)
  const [loginFaculty, setLoginFaculty] = useState<ApiAcademicLoginFaculty[]>([])
  const [playbackCheckpointId, setPlaybackCheckpointId] = useState<string | null>(() => readSharedProofPlaybackSelection('academic')?.simulationStageCheckpointId ?? null)
  const [proofPlaybackNotice, setProofPlaybackNotice] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null)
  const handleReturnToPortal = useCallback(() => {
    if (typeof window !== 'undefined') clearPortalWorkspaceHints(window.localStorage)
    navigateToPortal('home')
  }, [])

  const handleClearPasswordSetupToken = useCallback(() => {
    clearPasswordSetupTokenFromUrl()
    setPasswordSetupToken(null)
    setPasswordSetupInspect(null)
    setPasswordSetupError('')
  }, [])

  useEffect(() => {
    startupDiagnostics.forEach(diagnostic => {
      emitClientOperationalEvent('startup.diagnostic', {
        workspace: 'academic',
        ...diagnostic,
      }, {
        level: diagnostic.level === 'error' ? 'error' : diagnostic.level === 'warning' ? 'warn' : 'info',
      })
    })
    emitClientOperationalEvent('startup.ready', {
      workspace: 'academic',
      apiBaseUrl: apiBaseUrl || null,
      configuredPrimaryApiBaseUrl: configuredApiBaseUrl || null,
      activeApiSource: apiConnection.activeSource,
      usingApiFallback: apiConnection.usingFallback,
      telemetrySinkConfigured: Boolean(telemetrySinkUrl),
      diagnosticCount: startupDiagnostics.length,
      errorCount: startupDiagnostics.filter(item => item.level === 'error').length,
    })
  }, [apiBaseUrl, apiConnection.activeSource, apiConnection.usingFallback, configuredApiBaseUrl, startupDiagnostics, telemetrySinkUrl])

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

  const workspaceSession = workspaceProjection?.session ?? null
  const workspaceRole = workspaceSession ? mapApiRoleToRole(workspaceSession.activeRoleGrant.roleCode) : null
  const workspaceBootstrap = workspaceProjection?.bootstrap ?? null
  const workspaceRepositories = remoteRepositories
  const workspaceReady = Boolean(workspaceSession?.faculty?.facultyId && workspaceRole && workspaceBootstrap && remoteRepositories)
  const connectionPending = !apiConnection.initialCheckComplete && apiConnection.candidateBaseUrls.length > 0 && !apiBaseUrl

  if (connectionPending) {
    return <AcademicRouteLoadingFallback label="Checking backend connection..." />
  }

  return (
    <>
      <ApiFallbackIndicator
        usingFallback={apiConnection.usingFallback}
        activeBaseUrl={apiBaseUrl}
        workspaceLabel="teaching workspace"
      />
      <BackendOfflineIndicator monitor={backendHealthMonitor} workspaceLabel="teaching workspace" />
      <AcademicSessionBoundary
        backendReady={Boolean(apiClient && remoteSessionRepositories)}
        booting={booting}
        loadingLabel={workspaceLoadingLabel || undefined}
        sessionReady={workspaceReady}
        facultyOptions={loginFaculty}
        authBusy={authBusy || passwordSetupBusy}
        authError={passwordSetupToken ? passwordSetupError : authError}
        passwordSetupToken={passwordSetupToken}
        passwordSetupInspect={passwordSetupInspect}
        passwordSetupMessage={passwordSetupMessage}
        passwordSetupRequestResult={passwordSetupRequestResult}
        onBackToPortal={handleReturnToPortal}
        onRequestPasswordSetup={handleRequestPasswordSetup}
        onRedeemPasswordSetup={handleRedeemPasswordSetup}
        onClearPasswordSetupToken={handleClearPasswordSetupToken}
        onLogin={handleRemoteLogin}
      >
        {workspaceReady ? (
          <OperationalWorkspace
            key={`${workspaceSession!.activeRoleGrant.grantId}:${workspaceBootstrap!.proofPlayback?.simulationStageCheckpointId ?? 'active'}`}
            repositories={workspaceRepositories!}
            liveAcademicMode={liveAcademicMode}
            initialTeacherId={workspaceSession!.faculty!.facultyId}
            initialRole={workspaceRole!}
            onLogout={handleRemoteLogout}
            onRoleChange={handleRemoteRoleChange}
            loadFacultyProfile={loadAcademicFacultyProfile}
            loadHodProofAnalytics={loadAcademicHodProofAnalytics}
            loadHodProofCounterfactualSimulator={loadAcademicHodProofCounterfactualSimulator}
            loadStudentAgentCard={loadAcademicStudentAgentCard}
            loadStudentAgentTimeline={loadAcademicStudentAgentTimeline}
            startStudentAgentSession={startAcademicStudentAgentSession}
            sendStudentAgentMessage={sendAcademicStudentAgentMessage}
            loadStudentRiskExplorer={loadAcademicStudentRiskExplorer}
            onRecomputeProofRunRisk={handleRecomputeAcademicProofRunRisk}
            onResolveProofReassessment={handleResolveAcademicProofReassessment}
            onAdvanceProofRun={handleAdvanceAcademicProofRun}
            onStopProofRun={handleStopAcademicProofRun}
            onStepProofPlayback={handleStepAcademicProofPlayback}
            academicBootstrap={workspaceBootstrap!}
            proofPlaybackNotice={proofPlaybackNotice}
            onResetProofPlaybackSelection={handleResetProofPlaybackSelection}
          />
        ) : null}
      </AcademicSessionBoundary>
    </>
  )
}

function PortalRouterApp() {
  const [route, setRoute] = useState<PortalRoute>(() => {
    if (typeof window === 'undefined') return 'home'
    return resolvePortalRoute(window.location.hash)
  })

  const handleSelectAcademic = useCallback(() => {
    setRoute('app')
    navigateToPortal('app')
  }, [])

  const handleSelectAdmin = useCallback(() => {
    setRoute('admin')
    navigateToPortal('admin')
  }, [])

  const handleExitAdminToPortal = useCallback(() => {
    if (typeof window !== 'undefined') {
      clearPortalWorkspaceHints(window.localStorage)
    }
    setRoute('home')
    navigateToPortal('home')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncRoute = () => setRoute(resolvePortalRoute(window.location.hash))
    syncRoute()
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextHash = getPortalHash(route)
    if (!hashBelongsToPortalRoute(window.location.hash, route)) window.location.hash = nextHash
  }, [route])

  if (route === 'app') return <OperationalApp />
  if (route === 'admin') return <SystemAdminApp onExitPortal={handleExitAdminToPortal} />

  return (
    <PortalEntryScreen
      onSelectAcademic={handleSelectAcademic}
      onSelectAdmin={handleSelectAdmin}
    />
  )
}

export default function App() {
  return <PortalRouterApp />
}
