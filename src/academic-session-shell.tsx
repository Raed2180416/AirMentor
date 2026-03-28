import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Shield } from 'lucide-react'
import type { ApiAcademicLoginFaculty } from './api/types'
import { T, mono, sora } from './data'
import { InfoBanner } from './system-admin-ui'
import { Btn, Card, PageShell } from './ui-primitives'

function AcademicFieldLabel({ children }: { children: string }) {
  return <label style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 6 }}>{children}</label>
}

function AcademicInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: '100%', ...mono, fontSize: 11, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

function AcademicNotice({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' | 'success' }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return <div style={{ ...mono, fontSize: 11, color, border: `1px solid ${color}40`, background: `${color}12`, borderRadius: 10, padding: '10px 12px' }}>{message}</div>
}

function AcademicHeroPill({ children, color = T.accent }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, fontSize: 10, color, border: `1px solid ${color}30`, background: `${color}12`, borderRadius: 999, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </span>
  )
}

function AcademicHeroFeature({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: `${color}10`, border: `1px solid ${color}22`, boxShadow: `0 18px 40px ${color}10` }}>
      <div style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
    </div>
  )
}

function AcademicAuthPageShell({ children }: { children: ReactNode }) {
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

type AcademicLoginPageProps = {
  facultyOptions?: ApiAcademicLoginFaculty[]
  helperText?: string
  modeLabel?: string
  heroBody?: string
  busy?: boolean
  externalError?: string
  onBackToPortal?: () => void
  onLogin: (identifier: string, password: string) => Promise<void> | void
}

function AcademicLoginPage({
  facultyOptions = [],
  helperText = '',
  modeLabel = 'Teaching Workspace',
  heroBody = 'Use the academic portal for course delivery, mentor follow-up, grading operations, and timetable-aware teaching workflows.',
  busy = false,
  externalError = '',
  onBackToPortal,
  onLogin,
}: AcademicLoginPageProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const selectedOption = useMemo(() => {
    const key = identifier.trim().toLowerCase()
    if (!key) return null
    return facultyOptions.find(option => option.username.toLowerCase() === key) ?? null
  }, [facultyOptions, identifier])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!identifier.trim()) {
      setErrorMessage('Username is required.')
      return
    }
    try {
      setErrorMessage('')
      await onLogin(identifier.trim(), password)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed')
    }
  }

  return (
    <AcademicAuthPageShell>
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
        <Card
          style={{
            padding: 28,
            background: `radial-gradient(circle at top left, ${T.success}22, transparent 34%), radial-gradient(circle at 82% 86%, ${T.accent}18, transparent 28%), linear-gradient(160deg, ${T.surface}, ${T.surface2})`,
            display: 'grid',
            alignContent: 'space-between',
            minHeight: 520,
          }}
          glow={T.success}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <AcademicHeroPill color={T.success}>
              <BookOpen size={12} />
              {modeLabel}
            </AcademicHeroPill>
            <div>
              <div style={{ ...sora, fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1.02, maxWidth: 560 }}>
                Teach, mentor, and run daily academic operations from one place.
              </div>
              <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.9, maxWidth: 560 }}>
                {heroBody}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <AcademicHeroFeature title="Teaching" body="Course leaders should immediately see classes, offerings, evaluation setup limits, and entry workflows without hunting through role-specific dead ends." color={T.success} />
              <AcademicHeroFeature title="Mentoring" body="Mentors need fast access to student history, intervention queues, and escalation context, with academic records linked back to the right batch and semester." color={T.accent} />
              <AcademicHeroFeature title="Scheduling" body="Faculty should manage weekly execution cleanly while still seeing the default timetable, temporary exceptions, and the permanent-change request path." color={T.orange} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 24 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Need the system-admin workspace instead? Return to the portal selector and switch context there.</div>
            {onBackToPortal ? (
              <Btn variant="ghost" onClick={onBackToPortal} disabled={busy}>
                Portal Selector
              </Btn>
            ) : null}
          </div>
        </Card>

        <Card style={{ padding: 28, display: 'grid', alignContent: 'space-between', minHeight: 520, background: `radial-gradient(circle at top right, ${T.success}12, transparent 28%), radial-gradient(circle at bottom left, ${T.accent}10, transparent 24%), linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
          <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>
            <div style={{ ...mono, fontSize: 10, color: T.success, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Secure Session</div>
            <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>Sign in to enter the teaching workspace.</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>
              Sign in using your username and password. {helperText}
            </div>

            <form onSubmit={event => { void handleSubmit(event) }} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              <div>
                <AcademicFieldLabel>Username</AcademicFieldLabel>
                <AcademicInput
                  id="teacher-username"
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  disabled={busy}
                  placeholder="e.g. kavitha.rao"
                  autoComplete="username"
                />
              </div>

              {selectedOption ? (
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 4 }}>Selected profile</div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{selectedOption.displayName || selectedOption.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {`${selectedOption.departmentCode ?? selectedOption.dept ?? 'Faculty'}${selectedOption.designation ? ` · ${selectedOption.designation}` : selectedOption.roleTitle ? ` · ${selectedOption.roleTitle}` : ''}${selectedOption.allowedRoles?.length ? ` · ${selectedOption.allowedRoles.join(' / ')}` : ` · Faculty ID ${selectedOption.facultyId}`}`}
                  </div>
                </div>
              ) : null}

              <div>
                <AcademicFieldLabel>Password</AcademicFieldLabel>
                <AcademicInput id="teacher-password" type="password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} placeholder="••••••••" autoComplete="current-password" />
              </div>

              {errorMessage ? <AcademicNotice message={errorMessage} tone="error" /> : null}
              {externalError ? <AcademicNotice message={externalError} tone="error" /> : null}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                {onBackToPortal ? (
                  <Btn type="button" variant="ghost" onClick={onBackToPortal} disabled={busy}>
                    Back To Portal
                  </Btn>
                ) : <span />}
                <Btn type="submit" disabled={busy}>
                  <Shield size={14} />
                  {busy ? 'Signing In...' : 'Sign In'}
                </Btn>
              </div>
            </form>
          </div>

          <div style={{ width: '100%', maxWidth: 680, margin: '24px auto 0', borderRadius: 16, border: `1px solid ${T.border}`, background: T.surface2, padding: '14px 16px' }}>
            <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>After Sign-In</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
              The workspace restores your role-aware context, current teaching assignments, and the linked mentoring views that belong to the selected faculty profile.
            </div>
          </div>
        </Card>
      </div>
    </AcademicAuthPageShell>
  )
}

export function AcademicBackendUnavailableState({ onBackToPortal }: { onBackToPortal: () => void }) {
  return (
    <AcademicAuthPageShell>
      <Card style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>Teaching Workspace</div>
        <InfoBanner tone="error" message="VITE_AIRMENTOR_API_BASE_URL is required. Mock mode has been removed." />
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

type AcademicSessionBoundaryProps = {
  backendReady: boolean
  booting: boolean
  sessionReady: boolean
  facultyOptions: ApiAcademicLoginFaculty[]
  authBusy: boolean
  authError: string
  onBackToPortal: () => void
  onLogin: (identifier: string, password: string) => Promise<void> | void
  children: ReactNode
}

export function AcademicSessionBoundary({
  backendReady,
  booting,
  sessionReady,
  facultyOptions,
  authBusy,
  authError,
  onBackToPortal,
  onLogin,
  children,
}: AcademicSessionBoundaryProps) {
  if (!backendReady) {
    return <AcademicBackendUnavailableState onBackToPortal={onBackToPortal} />
  }

  if (booting) {
    return <AcademicRouteLoadingFallback label="Restoring academic session..." />
  }

  if (!sessionReady) {
    return (
      <AcademicLoginPage
        facultyOptions={facultyOptions}
        modeLabel="Teaching Workspace Live Mode"
        heroBody="Sign in against the live backend so course leaders, mentors, and HoDs land in their actual system-admin managed teaching context."
        busy={authBusy}
        externalError={authError}
        onBackToPortal={onBackToPortal}
        onLogin={onLogin}
      />
    )
  }

  return <>{children}</>
}
