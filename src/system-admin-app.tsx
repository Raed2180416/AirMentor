import { useEffect, useMemo } from 'react'
import { SystemAdminLiveApp } from './system-admin-live-app'
import { useApiConnectionTarget } from './api-connection'
import { T, mono, sora } from './data'
import { ApiFallbackIndicator, BackendOfflineIndicator, useBackendHealthMonitor } from './backend-health-indicator'
import { collectFrontendStartupDiagnostics } from './startup-diagnostics'
import { emitClientOperationalEvent } from './telemetry'
import { Btn, Card } from './ui-primitives'

type SystemAdminAppProps = {
  onExitPortal?: () => void
}

export function SystemAdminApp(props: SystemAdminAppProps = {}) {
  const configuredApiBaseUrl = import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || ''
  const apiConnection = useApiConnectionTarget(configuredApiBaseUrl)
  const apiBaseUrl = apiConnection.activeBaseUrl
  const hasConfiguredCandidates = apiConnection.candidateBaseUrls.length > 0
  const backendHealthMonitor = useBackendHealthMonitor(apiBaseUrl, { enabled: hasConfiguredCandidates })
  const telemetrySinkUrl = import.meta.env.VITE_AIRMENTOR_TELEMETRY_SINK_URL?.trim() || ''
  const startupDiagnostics = useMemo(
    () => collectFrontendStartupDiagnostics({ apiBaseUrl: configuredApiBaseUrl || apiBaseUrl, telemetrySinkUrl }),
    [apiBaseUrl, configuredApiBaseUrl, telemetrySinkUrl],
  )

  useEffect(() => {
    startupDiagnostics.forEach(diagnostic => {
      emitClientOperationalEvent('startup.diagnostic', {
        workspace: 'system-admin',
        ...diagnostic,
      }, {
        level: diagnostic.level === 'error' ? 'error' : diagnostic.level === 'warning' ? 'warn' : 'info',
      })
    })
    emitClientOperationalEvent('startup.ready', {
      workspace: 'system-admin',
      apiBaseUrl: apiBaseUrl || null,
      configuredPrimaryApiBaseUrl: configuredApiBaseUrl || null,
      activeApiSource: apiConnection.activeSource,
      usingApiFallback: apiConnection.usingFallback,
      telemetrySinkConfigured: Boolean(telemetrySinkUrl),
      diagnosticCount: startupDiagnostics.length,
      errorCount: startupDiagnostics.filter(item => item.level === 'error').length,
    })
  }, [apiBaseUrl, apiConnection.activeSource, apiConnection.usingFallback, configuredApiBaseUrl, startupDiagnostics, telemetrySinkUrl])

  if (!apiBaseUrl && hasConfiguredCandidates && !apiConnection.initialCheckComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: T.bg,
        }}
      >
        <Card style={{ maxWidth: 720, display: 'grid', gap: 12, padding: 22 }}>
          <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>Checking System Admin Backend</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
            Waiting for the first backend health check so the portal opens against the correct server.
          </div>
          {props.onExitPortal ? <div><Btn variant="ghost" onClick={props.onExitPortal}>Back to Portal</Btn></div> : null}
        </Card>
      </div>
    )
  }

  if (!apiBaseUrl) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: T.bg,
        }}
      >
        <Card style={{ maxWidth: 720, display: 'grid', gap: 12, padding: 22 }}>
          <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>System Admin Backend Required</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
            No API connection target is configured, so the sysadmin portal cannot start. Set VITE_AIRMENTOR_API_BASE_URL (and optionally VITE_AIRMENTOR_API_FALLBACK_BASE_URLS).
          </div>
          {props.onExitPortal ? <div><Btn variant="ghost" onClick={props.onExitPortal}>Back to Portal</Btn></div> : null}
        </Card>
      </div>
    )
  }
  return (
    <>
      <ApiFallbackIndicator
        usingFallback={apiConnection.usingFallback}
        activeBaseUrl={apiBaseUrl}
        workspaceLabel="system-admin workspace"
      />
      <BackendOfflineIndicator monitor={backendHealthMonitor} workspaceLabel="system-admin workspace" />
      <SystemAdminLiveApp apiBaseUrl={apiBaseUrl} {...props} />
    </>
  )
}
