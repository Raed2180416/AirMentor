import { AcademicBackendUnavailableState, AcademicRouteLoadingFallback } from './route-states'
import { AcademicLoginPage } from './login-page'
import type { AcademicSessionBoundaryProps } from './types'

export function AcademicSessionBoundary({
  backendReady,
  booting,
  loadingLabel,
  sessionReady,
  facultyOptions,
  authBusy,
  authError,
  passwordSetupToken = null,
  passwordSetupInspect = null,
  passwordSetupMessage = '',
  passwordSetupRequestResult = null,
  onBackToPortal,
  onRequestPasswordSetup,
  onRedeemPasswordSetup,
  onClearPasswordSetupToken,
  onLogin,
  children,
}: AcademicSessionBoundaryProps) {
  if (!backendReady) {
    return <AcademicBackendUnavailableState onBackToPortal={onBackToPortal} />
  }

  if (booting) {
    return <AcademicRouteLoadingFallback label="Restoring academic session..." />
  }

  if (loadingLabel) {
    return <AcademicRouteLoadingFallback label={loadingLabel} />
  }

  if (!sessionReady) {
    return (
      <AcademicLoginPage
        facultyOptions={facultyOptions}
        modeLabel="Teaching Workspace Live Mode"
        heroBody="Sign in against the live backend so course leaders, mentors, and HoDs land in their actual system-admin managed teaching context."
        busy={authBusy}
        externalError={authError}
        passwordSetupToken={passwordSetupToken}
        passwordSetupInspect={passwordSetupInspect}
        passwordSetupMessage={passwordSetupMessage}
        passwordSetupRequestResult={passwordSetupRequestResult}
        onBackToPortal={onBackToPortal}
        onRequestPasswordSetup={onRequestPasswordSetup}
        onRedeemPasswordSetup={onRedeemPasswordSetup}
        onClearPasswordSetupToken={onClearPasswordSetupToken}
        onLogin={onLogin}
      />
    )
  }

  return <>{children}</>
}
