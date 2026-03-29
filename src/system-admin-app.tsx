import { useEffect, useMemo } from 'react'
import { SystemAdminLiveApp } from './system-admin-live-app'
import { T, mono, sora } from './data'
import { collectFrontendStartupDiagnostics } from './startup-diagnostics'
import { emitClientOperationalEvent } from './telemetry'
import { Btn, Card } from './ui-primitives'

type SystemAdminAppProps = {
  onExitPortal?: () => void
}

export function SystemAdminApp(props: SystemAdminAppProps = {}) {
  const apiBaseUrl = import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || ''
  const telemetrySinkUrl = import.meta.env.VITE_AIRMENTOR_TELEMETRY_SINK_URL?.trim() || ''
  const startupDiagnostics = useMemo(
    () => collectFrontendStartupDiagnostics({ apiBaseUrl, telemetrySinkUrl }),
    [apiBaseUrl, telemetrySinkUrl],
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
      telemetrySinkConfigured: Boolean(telemetrySinkUrl),
      diagnosticCount: startupDiagnostics.length,
      errorCount: startupDiagnostics.filter(item => item.level === 'error').length,
    })
  }, [apiBaseUrl, startupDiagnostics, telemetrySinkUrl])

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
            `VITE_AIRMENTOR_API_BASE_URL` is not configured, so the sysadmin portal cannot start. Mock admin mode has been removed from the active app path.
          </div>
          {props.onExitPortal ? <div><Btn variant="ghost" onClick={props.onExitPortal}>Back to Portal</Btn></div> : null}
        </Card>
      </div>
    )
  }
  return <SystemAdminLiveApp apiBaseUrl={apiBaseUrl} {...props} />
}
