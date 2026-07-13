import { Bell, ChevronLeft, Clock3, RefreshCw } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ThemeMode } from '@kernel/shared/domain'
import { isLightTheme } from '@web/shared/ui/theme'
import {
  BrandMark,
  NotificationCountBadge,
  UI_FONT_SIZES,
  getIconButtonStyle,
  getShellBarStyle,
} from '@web/shared/ui/primitives'
import { formatClockLabel } from '../live-app-model'

export function TeachingShellAdminTopBar({
  institutionName,
  adminName,
  contextLabel,
  now,
  themeMode,
  actionCount,
  showActionQueue,
  canNavigateBack,
  onNavigateBack,
  onToggleTheme,
  onGoHome,
  onToggleQueue,
  onRefresh,
  onLogout,
}: {
  institutionName: string
  adminName: string
  contextLabel: string
  now: Date
  themeMode: ThemeMode
  actionCount: number
  showActionQueue: boolean
  canNavigateBack: boolean
  onNavigateBack: () => void
  onToggleTheme: () => void
  onGoHome: () => void
  onToggleQueue: () => void
  onRefresh: () => void
  onLogout: () => void
  onExitPortal?: () => void
}) {
  return (
    <div style={{ ...getShellBarStyle(themeMode), zIndex: 40, gap: 14, transition: 'background-color 220ms ease, border-color 220ms ease, color 220ms ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            aria-label="Go to dashboard"
            title="Go to dashboard"
            onClick={onGoHome}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
          >
            <BrandMark size={36} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 15, color: T.text }}>{institutionName}</div>
            <div style={{ ...mono, fontSize: UI_FONT_SIZES.micro, color: T.dim }}>Welcome {adminName} · {contextLabel}</div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {canNavigateBack ? (
            <button type="button" aria-label="Go back" title="Go back" onClick={onNavigateBack} style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ChevronLeft size={14} />
              Back
            </button>
          ) : null}
          <div style={{ ...getIconButtonStyle({ subtle: false }), width: 'auto', padding: '0 12px', ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock3 size={12} />
            {formatClockLabel(now)}
          </div>
          <button type="button" aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'} title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'} onClick={onToggleTheme} style={{ ...getIconButtonStyle({ subtle: false }), color: T.muted, ...mono, fontSize: 14, lineHeight: 1, transition: 'background-color 220ms ease, color 220ms ease, transform 180ms ease' }}>
            {isLightTheme(themeMode) ? '🌙' : '☀️'}
          </button>
          <button
            type="button"
            aria-label={showActionQueue ? 'Hide action queue' : 'Show action queue'}
            title={showActionQueue ? 'Hide action queue' : 'Show action queue'}
            onClick={onToggleQueue}
            style={{ ...getIconButtonStyle({ active: showActionQueue }), color: showActionQueue ? T.accent : T.muted, position: 'relative' }}
          >
            <Bell size={14} />
            {actionCount > 0 ? <NotificationCountBadge count={actionCount} /> : null}
          </button>
          <button type="button" aria-label="Refresh admin data" onClick={onRefresh} style={{ ...getIconButtonStyle({ subtle: false }), color: T.muted }}>
            <RefreshCw size={14} />
          </button>
          <button type="button" onClick={onLogout} style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
