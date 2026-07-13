import { useMemo, useState } from 'react'
import { BookOpen, Shield } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card } from '@web/shared/ui/primitives'
import { AcademicAuthPageShell, AcademicFieldLabel, AcademicHeroFeature, AcademicHeroPill, AcademicInput, AcademicNotice } from './auth-primitives'
import type { AcademicLoginPageProps } from './types'

export function AcademicLoginPage({
  facultyOptions = [],
  helperText = '',
  modeLabel = 'Teaching Workspace',
  heroBody = 'Use the academic portal for course delivery, mentor follow-up, grading operations, and timetable-aware teaching workflows.',
  busy = false,
  externalError = '',
  passwordSetupToken = null,
  passwordSetupInspect = null,
  passwordSetupMessage = '',
  passwordSetupRequestResult = null,
  onBackToPortal,
  onRequestPasswordSetup,
  onRedeemPasswordSetup,
  onClearPasswordSetupToken,
  onLogin,
}: AcademicLoginPageProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordHelpIdentifier, setPasswordHelpIdentifier] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const selectedOption = useMemo(() => {
    const key = identifier.trim().toLowerCase()
    if (!key) return null
    return facultyOptions.find(option => option.username.toLowerCase() === key || option.email.toLowerCase() === key) ?? null
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

  const handlePasswordSetupRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordHelpIdentifier.trim()) {
      setErrorMessage('Enter your username or email first.')
      return
    }
    try {
      setErrorMessage('')
      await onRequestPasswordSetup(passwordHelpIdentifier.trim())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not prepare the password setup link.')
    }
  }

  const handlePasswordRedeem = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newPassword.trim()) {
      setErrorMessage('Enter a new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }
    try {
      setErrorMessage('')
      await onRedeemPasswordSetup(newPassword)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the new password.')
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
              {passwordSetupToken
                ? 'Create a new password to finish the invite or reset flow, then return here to sign in.'
                : `Sign in using your username or email and password. ${helperText}`}
            </div>

            {passwordSetupToken ? (
              <form onSubmit={event => { void handlePasswordRedeem(event) }} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 4 }}>Password setup</div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{passwordSetupInspect?.displayName ?? 'Preparing account...'}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {passwordSetupInspect
                      ? `${passwordSetupInspect.username} · ${passwordSetupInspect.email} · expires ${new Date(passwordSetupInspect.expiresAt).toLocaleString('en-IN')}`
                      : 'Checking the link...'}
                  </div>
                </div>
                <div>
                  <AcademicFieldLabel>New Password</AcademicFieldLabel>
                  <AcademicInput id="teacher-new-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy || !passwordSetupInspect} placeholder="Minimum 8 characters" autoComplete="new-password" />
                </div>
                <div>
                  <AcademicFieldLabel>Confirm Password</AcademicFieldLabel>
                  <AcademicInput id="teacher-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={busy || !passwordSetupInspect} placeholder="Repeat password" autoComplete="new-password" />
                </div>
                {errorMessage ? <AcademicNotice message={errorMessage} tone="error" /> : null}
                {externalError ? <AcademicNotice message={externalError} tone="error" /> : null}
                {passwordSetupMessage ? <AcademicNotice message={passwordSetupMessage} tone="success" /> : null}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Btn type="button" variant="ghost" onClick={onClearPasswordSetupToken} disabled={busy}>
                    Back To Login
                  </Btn>
                  <Btn type="submit" disabled={busy || !passwordSetupInspect}>
                    <Shield size={14} />
                    {busy ? 'Saving Password...' : 'Save Password'}
                  </Btn>
                </div>
              </form>
            ) : (
              <form onSubmit={event => { void handleSubmit(event) }} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
                {facultyOptions.length > 0 && !selectedOption ? (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 8 }}>Demo — select a profile to autofill · password: <span style={{ color: T.success, fontWeight: 700 }}>faculty1234</span></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {facultyOptions.slice(0, 6).map(option => (
                        <button
                          key={option.facultyId}
                          type="button"
                          disabled={busy}
                          onClick={() => setIdentifier(option.username)}
                          style={{ ...mono, fontSize: 10, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accent}30`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
                        >
                          {option.username}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <AcademicFieldLabel>Username Or Email</AcademicFieldLabel>
                  <AcademicInput
                    id="teacher-username"
                    value={identifier}
                    onChange={event => setIdentifier(event.target.value)}
                    disabled={busy}
                    placeholder={facultyOptions.length > 0 ? `e.g. ${facultyOptions[0]?.username ?? 'devika.shetty'}` : 'e.g. faculty.username'}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <AcademicFieldLabel>Password</AcademicFieldLabel>
                    <Btn variant="ghost" size="sm" type="button" onClick={() => setShowPassword(value => !value)}>
                      {showPassword ? 'Hide Password' : 'Show Password'}
                    </Btn>
                  </div>
                  <AcademicInput id="teacher-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} placeholder="••••••••" autoComplete="current-password" />
                </div>

                {errorMessage ? <AcademicNotice message={errorMessage} tone="error" /> : null}
                {externalError ? <AcademicNotice message={externalError} tone="error" /> : null}
                {passwordSetupMessage ? <AcademicNotice message={passwordSetupMessage} tone="success" /> : null}

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
            )}
          </div>

          {!passwordSetupToken ? (
            <div style={{ width: '100%', maxWidth: 680, margin: '24px auto 0', borderRadius: 16, border: `1px solid ${T.border}`, background: T.surface2, padding: '14px 16px', display: 'grid', gap: 12 }}>
              <div>
                <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>After Sign-In</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
                  The workspace restores your role-aware context, current teaching assignments, and the linked mentoring views that belong to the selected faculty profile.
                </div>
              </div>
              <form onSubmit={event => { void handlePasswordSetupRequest(event) }} style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>First Sign-In Or Forgot Password</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                    Enter your username or email to request a single-use password setup link.
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10 }}>
                  <AcademicInput value={passwordHelpIdentifier} onChange={event => setPasswordHelpIdentifier(event.target.value)} disabled={busy} placeholder="Username or email" />
                  <Btn type="submit" variant="ghost" disabled={busy}>Send Link</Btn>
                </div>
                {passwordSetupRequestResult ? <AcademicNotice message={passwordSetupRequestResult.message} tone="success" /> : null}
                {passwordSetupRequestResult?.setupUrl ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => window.open(passwordSetupRequestResult.setupUrl ?? '', '_blank', 'noopener,noreferrer')}>Open Preview Link</Btn>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(passwordSetupRequestResult.setupUrl ?? '')}>Copy Preview Link</Btn>
                  </div>
                ) : null}
              </form>
            </div>
          ) : null}
        </Card>
      </div>
    </AcademicAuthPageShell>
  )
}
