import { SystemAdminLiveApp } from './system-admin-live-app'
import { SystemAdminMockApp } from './system-admin-mock-app'

type SystemAdminAppProps = {
  onExitPortal?: () => void
}

export function SystemAdminApp(props: SystemAdminAppProps = {}) {
  const apiBaseUrl = import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || ''
  if (!apiBaseUrl) return <SystemAdminMockApp {...props} />
  return <SystemAdminLiveApp apiBaseUrl={apiBaseUrl} {...props} />
}
