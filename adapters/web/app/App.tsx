import { useState, useMemo, useCallback, useEffect} from 'react'
import {
  AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories} from '@persistence/repositories/air-mentor-repositories'
import { PortalEntryScreen } from './portal-entry'
import { clearPortalWorkspaceHints, getPortalHash, hashBelongsToPortalRoute, navigateToPortal, resolvePortalRoute, type PortalRoute } from './portal-routing'
import { SystemAdminApp } from '@web/features/admin/system-admin-app'
import {
  AcademicRouteLoadingFallback,
  AcademicSessionBoundary,
} from '@web/features/academic-session-shell'
import { AirMentorApiClient } from '@web/shared/api/client'
import { readActiveDemoWorkspacePointer } from '@web/simulation/demo-workspace-pointer'
import { useApiConnectionTarget } from '@web/shared/api/api-connection'
import type {
  ApiAcademicLoginFaculty,
  ApiPasswordSetupInspectResponse,
  ApiPasswordSetupRequestResponse,
  ApiSessionResponse,
} from '@web/shared/api/types'
import { ApiFallbackIndicator, BackendOfflineIndicator, useBackendHealthMonitor } from '@web/shared/components/backend-health-indicator'
import { readSharedProofPlaybackSelection } from '@web/simulation/proof-playback'
import { collectFrontendStartupDiagnostics } from '@web/shared/state/startup-diagnostics'
import { emitClientOperationalEvent } from '@web/shared/state/telemetry'
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
} from './session-helpers'
import { useAcademicProjection } from './app-parts/use-academic-projection'
import { useAcademicSession } from './app-parts/use-academic-session'
import { useAcademicProofLoaders } from './app-parts/use-academic-proof-loaders'

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

  const {
    commitAcademicProjection,
    fetchAcademicBootstrap,
    refreshAcademicProjection,
    handleResetProofPlaybackSelection,
  } = useAcademicProjection({
    apiClient,
    remoteSession,
    setRemoteSession,
    setWorkspaceProjection,
    setLoginFaculty,
    setPlaybackCheckpointId,
    setProofPlaybackNotice,
  })

  const {
    remoteRepositories,
    handleRemoteLogin,
    handleRequestPasswordSetup,
    handleRedeemPasswordSetup,
    handleRemoteLogout,
    handleRemoteRoleChange,
  } = useAcademicSession({
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
  })

  const {
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
  } = useAcademicProofLoaders({
    apiClient,
    playbackCheckpointId,
    refreshAcademicProjection,
    setProofPlaybackNotice,
  })

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
