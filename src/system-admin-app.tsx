import { SystemAdminLiveApp } from './system-admin-live-app'
import { T, mono, sora } from './data'
import { Btn, Card } from './ui-primitives'

type SystemAdminAppProps = {
  onExitPortal?: () => void
}

export function SystemAdminApp(props: SystemAdminAppProps = {}) {
  const apiBaseUrl = import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || ''
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
