import { T, mono, sora } from '@web/simulation/fixtures'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { Btn, Card, PageShell } from '@web/shared/ui/primitives'
import { AcademicAuthPageShell } from './auth-primitives'

export function AcademicRouteLoadingFallback({ label = 'Loading workspace...' }: { label?: string }) {
  return (
    <PageShell size="standard">
      <Card style={{ maxWidth: 420, marginTop: 24 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text, marginBottom: 6 }}>Preparing page</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{label}</div>
      </Card>
    </PageShell>
  )
}

export function AcademicBackendUnavailableState({ onBackToPortal }: { onBackToPortal: () => void }) {
  return (
    <AcademicAuthPageShell>
      <Card style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>Teaching Workspace</div>
        <InfoBanner tone="error" message="VITE_AIRMENTOR_API_BASE_URL is required. Offline fixture mode has been removed from the live app." />
        <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
          Configure the API URL so the teaching workspace runs entirely from system-admin managed backend data.
        </div>
        <div>
          <Btn variant="ghost" onClick={onBackToPortal}>Back to Portal</Btn>
        </div>
      </Card>
    </AcademicAuthPageShell>
  )
}

export function AcademicFacultyContextUnavailableState({
  onBackToPortal,
  onLogout,
}: {
  onBackToPortal: () => void
  onLogout: () => void
}) {
  return (
    <AcademicAuthPageShell>
      <Card style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>Faculty Context Unavailable</div>
        <InfoBanner tone="error" message="The active faculty profile is no longer available, so this teaching session cannot be restored safely." />
        <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
          Sign back in to refresh the faculty context after admin changes or manual cleanup.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn onClick={onLogout}>Return to Login</Btn>
          <Btn variant="ghost" onClick={onBackToPortal}>Back to Portal</Btn>
        </div>
      </Card>
    </AcademicAuthPageShell>
  )
}
