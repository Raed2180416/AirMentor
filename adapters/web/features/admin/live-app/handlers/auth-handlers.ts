import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type { ApiRoleGrant, ApiSessionResponse, ApiStagePolicyOverride } from '@web/shared/api/types'
import { areSessionResponsesEquivalent } from '@web/shared/api/session-response-helpers'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import type { LiveAdminDataset } from '../../system-admin-live-data'
import { EMPTY_DATA, toErrorMessage } from '../../live-app-model'

export interface AuthHandlerDeps {
  apiClient: AirMentorApiClient
  identifier: string
  password: string
  session: ApiSessionResponse | null
  systemAdminGrant: ApiRoleGrant | null
  settleCookieBackedSession: (stage: 'login' | 'role-switch', optimisticSession?: ApiSessionResponse | null) => Promise<ApiSessionResponse>
  clearRegistryScope: () => void
  onExitPortal?: () => void
  setAuthBusy: Dispatch<SetStateAction<boolean>>
  setAuthError: Dispatch<SetStateAction<string>>
  setSession: Dispatch<SetStateAction<ApiSessionResponse | null>>
  setIdentifier: Dispatch<SetStateAction<string>>
  setPassword: Dispatch<SetStateAction<string>>
  setDismissedQueueItemKeys: Dispatch<SetStateAction<string[]>>
  setData: Dispatch<SetStateAction<LiveAdminDataset>>
  setStagePolicyOverrides: Dispatch<SetStateAction<ApiStagePolicyOverride[]>>
  setDataError: Dispatch<SetStateAction<string>>
}

export function createAuthHandlers(deps: AuthHandlerDeps) {
  const {
    apiClient,
    identifier,
    password,
    session,
    systemAdminGrant,
    settleCookieBackedSession,
    clearRegistryScope,
    onExitPortal,
    setAuthBusy,
    setAuthError,
    setSession,
    setIdentifier,
    setPassword,
    setDismissedQueueItemKeys,
    setData,
    setStagePolicyOverrides,
    setDataError,
  } = deps

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthBusy(true); setAuthError('')
    try {
      const loginSession = await apiClient.login({ identifier, password })
      setSession(loginSession); setIdentifier(''); setPassword('')
      void settleCookieBackedSession('login', loginSession)
        .then(settledSession => {
          setSession(current => {
            if (!current) return current
            if (current.sessionId !== loginSession.sessionId) return current
            if (current.activeRoleGrant.grantId !== loginSession.activeRoleGrant.grantId) return current
            if (areSessionResponsesEquivalent(current, settledSession)) return current
            return settledSession
          })
        })
        .catch(error => {
          setAuthError(toErrorMessage(error))
        })
    } catch (error) {
      setAuthError(toErrorMessage(error))
    }
    finally { setAuthBusy(false) }
  }

  const handleLogout = async () => {
    const activeSessionId = session?.sessionId ?? null
    clearRegistryScope()
    setDismissedQueueItemKeys([])
    setSession(null)
    setData(EMPTY_DATA)
    setStagePolicyOverrides([])
    setDataError('')
    onExitPortal?.()
    void apiClient.logout().catch(error => {
      emitClientOperationalEvent('auth.session.logout_failed', {
        workspace: 'system-admin',
        sessionId: activeSessionId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
    })
  }

  const handleSwitchToSystemAdmin = async () => {
    if (!systemAdminGrant) return
    setAuthBusy(true); setAuthError('')
    try {
      const switchedSession = await apiClient.switchRoleContext(systemAdminGrant.grantId)
      setSession(switchedSession)
      void settleCookieBackedSession('role-switch', switchedSession)
        .then(settledSession => {
          setSession(current => {
            if (!current) return current
            if (current.sessionId !== switchedSession.sessionId) return current
            if (current.activeRoleGrant.grantId !== switchedSession.activeRoleGrant.grantId) return current
            if (areSessionResponsesEquivalent(current, settledSession)) return current
            return settledSession
          })
        })
        .catch(error => {
          setAuthError(toErrorMessage(error))
        })
    }
    catch (error) {
      setAuthError(toErrorMessage(error))
    }
    finally { setAuthBusy(false) }
  }

  return { handleLogin, handleLogout, handleSwitchToSystemAdmin }
}
