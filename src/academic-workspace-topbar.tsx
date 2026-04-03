import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react'
import { T, mono, sora } from './data'
import type { Role, ThemeMode } from './domain'
import { isLightTheme } from './theme'
import {
  NotificationCountBadge,
  BrandMark,
  UI_FONT_SIZES,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  getShellBarStyle,
} from './ui-primitives'

type AcademicWorkspaceTopbarProps = {
  themeMode: ThemeMode
  isCompactTopbar: boolean
  sidebarCollapsed: boolean
  sidebarToggleLabel: string
  allowedRoles: Role[]
  role: Role
  roleChangeBusy: boolean
  canNavigateBack: boolean
  formattedCurrentTime: string
  showActionQueue: boolean
  pendingActionCount: number
  onGoHome: () => void
  onToggleSidebar: () => void
  onRoleChange: (role: Role) => void
  onNavigateBack: () => void
  onToggleTheme: () => void
  onToggleActionQueue: () => void
  onLogout: () => void
}

export function AcademicWorkspaceTopbar({
  themeMode,
  isCompactTopbar,
  sidebarCollapsed,
  sidebarToggleLabel,
  allowedRoles,
  role,
  roleChangeBusy,
  canNavigateBack,
  formattedCurrentTime,
  showActionQueue,
  pendingActionCount,
  onGoHome,
  onToggleSidebar,
  onRoleChange,
  onNavigateBack,
  onToggleTheme,
  onToggleActionQueue,
  onLogout,
}: AcademicWorkspaceTopbarProps) {
  const [showTopbarMenu, setShowTopbarMenu] = useState(false)

  const handleLogout = () => {
    setShowTopbarMenu(false)
    onLogout()
  }

  return (
    <div className={`top-bar-shell ${isCompactTopbar ? 'top-bar-shell--compact' : ''}`} style={{ ...getShellBarStyle(themeMode), display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px' }}>
      <button aria-label="Go to dashboard" title="Go to dashboard" onClick={onGoHome} className="top-bar-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        <BrandMark size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 15, color: T.text }}>AirMentor</div>
          <div className="top-bar-greeting" style={{ ...mono, fontSize: UI_FONT_SIZES.micro, color: T.dim }}>AI Mentor Intelligence</div>
        </div>
      </button>

      {isCompactTopbar && (
        <button className="top-control-btn" aria-label={sidebarToggleLabel} title={sidebarToggleLabel} onClick={onToggleSidebar} style={{ ...getIconButtonStyle({ subtle: false }), width: 'auto', padding: '0 10px', color: T.muted }}>
          <motion.span animate={{ rotate: sidebarCollapsed ? 0 : 180 }} transition={{ duration: 0.18 }} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <ChevronRight size={14} />
          </motion.span>
        </button>
      )}

      <div className="top-bar-role-switcher" style={{ ...getSegmentedGroupStyle(), marginLeft: 16 }}>
        {allowedRoles.map(candidateRole => (
          <button
            key={candidateRole}
            onClick={() => onRoleChange(candidateRole)}
            disabled={roleChangeBusy}
            data-tab="true"
            data-proof-action="switch-role"
            data-proof-entity-id={candidateRole}
            style={getSegmentedButtonStyle({ active: role === candidateRole, compact: isCompactTopbar })}
          >
            {roleChangeBusy && role !== candidateRole ? `${candidateRole}` : candidateRole}
          </button>
        ))}
      </div>

      <div className="top-bar-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        {canNavigateBack ? (
          <button
            className="top-control-btn"
            aria-label="Go back"
            title="Go back"
            onClick={onNavigateBack}
            style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, display: 'inline-flex', alignItems: 'center', gap: 6, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}
          >
            <ChevronLeft size={14} />
            Back
          </button>
        ) : null}

        <div className="top-bar-clock" style={{ ...getIconButtonStyle({ subtle: false }), width: 'auto', padding: '0 10px', ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, display: 'flex', alignItems: 'center', background: T.surface2 }}>
          {formattedCurrentTime}
        </div>

        <button className="top-control-btn" aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'} title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'} onClick={onToggleTheme} style={{ ...getIconButtonStyle({ subtle: false }), color: T.muted }}>
          {isLightTheme(themeMode) ? '🌙' : '☀️'}
        </button>

        <button className="top-control-btn" aria-label={showActionQueue ? 'Hide action queue' : 'Show action queue'} title={showActionQueue ? 'Hide action queue' : 'Show action queue'} onClick={onToggleActionQueue} style={{ ...getIconButtonStyle({ active: showActionQueue }), color: showActionQueue ? T.accent : T.muted, position: 'relative' }}>
          <Bell size={14} />
          {pendingActionCount > 0 ? <NotificationCountBadge count={pendingActionCount} /> : null}
        </button>

        {isCompactTopbar ? (
          <>
            <button className="top-control-btn" aria-label={showTopbarMenu ? 'Close more controls' : 'Open more controls'} title="More" onClick={() => setShowTopbarMenu(value => !value)} style={{ ...getIconButtonStyle({ active: showTopbarMenu, subtle: false }), width: 'auto', padding: '0 10px', color: showTopbarMenu ? T.accent : T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>
              More
            </button>
            <AnimatePresence>
              {showTopbarMenu ? (
                <motion.div
                  className="top-bar-more-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 38, minWidth: 200, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`, boxShadow: '0 18px 42px rgba(2,6,23,0.26)', display: 'grid', gap: 8, zIndex: 70 }}
                >
                  <button onClick={handleLogout} style={{ ...getIconButtonStyle({ subtle: true }), width: '100%', padding: '0 10px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow, textAlign: 'left', justifyContent: 'flex-start' }}>
                    Logout
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <button className="top-control-btn" aria-label="Logout" title="Logout" data-proof-action="logout" onClick={handleLogout} style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>
            Logout
          </button>
        )}
      </div>
    </div>
  )
}

