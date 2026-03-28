import { Suspense, type ReactNode } from 'react'
import { type LayoutMode } from './domain'
import { AcademicRouteLoadingFallback } from './academic-session-shell'
import { InfoBanner, RestoreBanner } from './system-admin-ui'

type ProofPlaybackNotice = { tone: 'neutral' | 'error'; message: string } | null | undefined

type AcademicWorkspaceContentShellProps = {
  layoutMode: LayoutMode
  proofPlaybackNotice: ProofPlaybackNotice
  routeError: string
  routeLoadingLabel: string
  onResetProofPlaybackSelection: () => Promise<void> | void
  children: ReactNode
}

export function AcademicWorkspaceContentShell({
  layoutMode,
  proofPlaybackNotice,
  routeError,
  routeLoadingLabel,
  onResetProofPlaybackSelection,
  children,
}: AcademicWorkspaceContentShellProps) {
  return (
    <div className={`scroll-pane app-content app-content--${layoutMode}`} style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
      {proofPlaybackNotice ? (
        <div style={{ padding: '16px 20px 0' }}>
          <div data-proof-section="proof-playback-notice">
            <RestoreBanner
              tone={proofPlaybackNotice.tone}
              title={proofPlaybackNotice.tone === 'error' ? 'Proof playback reset required' : 'Proof playback restored'}
              message={proofPlaybackNotice.message}
              actionLabel="Reset playback"
              onAction={onResetProofPlaybackSelection}
            />
          </div>
        </div>
      ) : null}
      {routeError ? (
        <div style={{ padding: '16px 20px 0' }}>
          <InfoBanner tone="error" message={routeError} />
        </div>
      ) : null}
      <Suspense fallback={<AcademicRouteLoadingFallback label={routeLoadingLabel} />}>
        {children}
      </Suspense>
    </div>
  )
}
