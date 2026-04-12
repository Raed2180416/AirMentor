import type { FormEventHandler, ReactNode } from 'react'
import { ChevronLeft, Compass } from 'lucide-react'
import { T, mono, sora } from './data'
import {
  AuthFeature,
  FieldLabel,
  HeroBadge,
  InfoBanner,
  TextInput,
} from './system-admin-ui'
import { Btn, Card, PageShell } from './ui-primitives'

function SystemAdminAuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top left, ${T.accent}16, transparent 28%), radial-gradient(circle at bottom right, ${T.success}14, transparent 30%), linear-gradient(180deg, ${T.bg}, ${T.surface2})`,
        padding: 'clamp(18px, 3vw, 30px)',
      }}
    >
      <PageShell size="wide" style={{ paddingTop: 12 }}>
        {children}
      </PageShell>
    </div>
  )
}

function SystemAdminLoginScreen({
  apiBaseUrl,
  authBusy,
  authError,
  identifier,
  password,
  onIdentifierChange,
  onPasswordChange,
  onLogin,
  onExitPortal,
}: {
  apiBaseUrl: string
  authBusy: boolean
  authError: string
  identifier: string
  password: string
  onIdentifierChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onLogin: FormEventHandler<HTMLFormElement>
  onExitPortal?: () => void
}) {
  return (
    <SystemAdminAuthPageShell>
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
        <Card style={{ padding: 28, background: `radial-gradient(circle at top left, ${T.accent}24, transparent 36%), radial-gradient(circle at bottom right, ${T.success}16, transparent 28%), linear-gradient(160deg, ${T.surface}, ${T.surface2})`, display: 'grid', alignContent: 'space-between', minHeight: 520 }} glow={T.accent}>
          <div style={{ display: 'grid', gap: 18 }}>
            <HeroBadge><Compass size={12} /> System Admin Live Mode</HeroBadge>
            <div>
              <div style={{ ...sora, fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1.02, maxWidth: 560 }}>Govern curriculum, policy, and year-specific control from one place.</div>
              <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.9, maxWidth: 560 }}>This workspace is connected to the live backend at `{apiBaseUrl}`. Use it for academic faculties, branches, batches, policy overrides, requests, and the student or faculty records that depend on them.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <AuthFeature title="Hierarchy" body="Academic faculty, department, branch, and batch stay aligned so year-wise policy divergence is explicit instead of buried." color={T.accent} />
              <AuthFeature title="Governance" body="CE/SEE limits, grade bands, working calendar, and SGPA or CGPA rules remain centrally controlled but overrideable at the right level." color={T.success} />
              <AuthFeature title="Operations" body="Search, requests, and teaching ownership stay visible together so the sysadmin flow feels like one control plane instead of a setup dead-end." color={T.orange} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 24 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Need the teaching workspace instead? Return to the portal selector and sign in as faculty.</div>
            {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}><ChevronLeft size={14} /> Portal Selector</Btn> : null}
          </div>
        </Card>
        <Card style={{ padding: 28, display: 'grid', alignContent: 'center', background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
          <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Secure Session</div>
          <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>Sign in to manage the live hierarchy.</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>Use your assigned system-admin credentials. Session state and theme preferences are restored automatically after sign-in.</div>
          <form onSubmit={onLogin} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
            <div><FieldLabel>Username Or Email</FieldLabel><TextInput value={identifier} onChange={event => onIdentifierChange(event.target.value)} placeholder="sysadmin" /></div>
            <div><FieldLabel>Password</FieldLabel><TextInput type="password" value={password} onChange={event => onPasswordChange(event.target.value)} placeholder="••••••••" /></div>
            {authError ? <InfoBanner tone="error" message={authError} /> : null}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}>Back To Portal</Btn> : <span />}
              <Btn type="submit" disabled={authBusy}>{authBusy ? 'Signing In…' : 'Sign In'}</Btn>
            </div>
          </form>
        </Card>
      </div>
    </SystemAdminAuthPageShell>
  )
}

function SystemAdminRoleRequiredScreen({
  activeRoleCode,
  authBusy,
  canSwitchToSystemAdmin,
  onSwitchToSystemAdmin,
  onLogout,
}: {
  activeRoleCode: string
  authBusy: boolean
  canSwitchToSystemAdmin: boolean
  onSwitchToSystemAdmin: () => void
  onLogout: () => void
}) {
  return (
    <PageShell size="narrow" style={{ paddingTop: 48 }}>
      <Card style={{ padding: 28 }}>
        <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>System admin role required</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>You are currently in `{activeRoleCode}` context. Switch to your system-admin grant to use the configuration workspace.</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          {canSwitchToSystemAdmin ? <Btn onClick={onSwitchToSystemAdmin} disabled={authBusy}>Switch To System Admin</Btn> : null}
          <Btn variant="ghost" onClick={onLogout}>Log Out</Btn>
        </div>
      </Card>
    </PageShell>
  )
}

type SystemAdminSessionBoundaryProps = {
  booting: boolean
  activeRoleCode: string | null
  canSwitchToSystemAdmin: boolean
  authBusy: boolean
  authError: string
  identifier: string
  password: string
  apiBaseUrl: string
  onIdentifierChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onLogin: FormEventHandler<HTMLFormElement>
  onExitPortal?: () => void
  onSwitchToSystemAdmin: () => void
  onLogout: () => void
  children: ReactNode
}

export function SystemAdminSessionBoundary({
  booting,
  activeRoleCode,
  canSwitchToSystemAdmin,
  authBusy,
  authError,
  identifier,
  password,
  apiBaseUrl,
  onIdentifierChange,
  onPasswordChange,
  onLogin,
  onExitPortal,
  onSwitchToSystemAdmin,
  onLogout,
  children,
}: SystemAdminSessionBoundaryProps) {
  if (booting) {
    return <PageShell size="narrow" style={{ paddingTop: 48 }}><Card><div style={{ ...mono, fontSize: 11, color: T.muted }}>Restoring system admin session…</div></Card></PageShell>
  }

  if (!activeRoleCode) {
    return (
      <SystemAdminLoginScreen
        apiBaseUrl={apiBaseUrl}
        authBusy={authBusy}
        authError={authError}
        identifier={identifier}
        password={password}
        onIdentifierChange={onIdentifierChange}
        onPasswordChange={onPasswordChange}
        onLogin={onLogin}
        onExitPortal={onExitPortal}
      />
    )
  }

  if (activeRoleCode !== 'SYSTEM_ADMIN') {
    return (
      <SystemAdminRoleRequiredScreen
        activeRoleCode={activeRoleCode}
        authBusy={authBusy}
        canSwitchToSystemAdmin={canSwitchToSystemAdmin}
        onSwitchToSystemAdmin={onSwitchToSystemAdmin}
        onLogout={onLogout}
      />
    )
  }

  return <>{children}</>
}
