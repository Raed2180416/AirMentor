import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Bell, ChevronLeft, Clock3, RefreshCw } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ThemeMode } from '@kernel/shared/domain'
import type { LiveAdminSectionId } from './system-admin-live-data'
import {
  AdminBreadcrumbs,
  InfoBanner,
  SearchField,
  TOP_TABS,
  type BreadcrumbSegment,
} from './system-admin-ui'
import { isLightTheme } from '@web/shared/ui/theme'
import {
  BrandMark,
  Card,
  Chip,
  NotificationCountBadge,
  UI_FONT_SIZES,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  getShellBarStyle,
  withAlpha,
} from '@web/shared/ui/primitives'
import { formatClockLabel } from './live-app-model'

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

export function OperationsRail({
  collapsed,
  contextLabel,
  scopeLabel,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  searchResults,
  activeSection,
  onSectionChange,
  breadcrumbs,
  onToggleCollapsed,
}: {
  collapsed: boolean
  contextLabel: string
  scopeLabel?: string
  searchQuery: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchResults: Array<{ key: string; title: string; subtitle: string; onSelect: () => void }>
  activeSection: LiveAdminSectionId
  onSectionChange: (section: LiveAdminSectionId) => void
  breadcrumbs: BreadcrumbSegment[]
  onToggleCollapsed: () => void
}) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 0 : 232, opacity: collapsed ? 0 : 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      aria-hidden={collapsed}
      style={{
        position: 'sticky',
        top: 0,
        height: 'calc(100vh - 84px)',
        alignSelf: 'start',
        background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
        borderRight: collapsed ? 'none' : `1px solid ${T.border}`,
        overflow: 'hidden',
        flexShrink: 0,
        pointerEvents: collapsed ? 'none' : 'auto',
        transition: 'background-color 220ms ease, border-color 220ms ease',
      }}
    >
      <div className="scroll-pane scroll-pane--dense" style={{ height: '100%', overflowY: 'auto', padding: '16px 12px', display: 'grid', gridTemplateRows: 'auto auto 1fr auto auto', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Operations Rail</div>
            <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text, marginTop: 6 }}>{contextLabel}</div>
            {scopeLabel ? <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 6 }}>{scopeLabel}</div> : null}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <SearchField
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            ariaLabel="Admin search"
          />
          {searchResults.length > 0 ? (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {searchResults.map((result, index) => (
                <button
                  key={result.key}
                  type="button"
                  onClick={result.onSelect}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: index < searchResults.length - 1 ? `1px solid ${T.border}` : 'none',
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{result.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{result.subtitle}</div>
                </button>
              ))}
            </Card>
          ) : searchQuery.trim() ? (
            <InfoBanner message="No matching records in the active admin scope." />
          ) : null}
        </div>

        <nav style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          {TOP_TABS.map(tab => {
            const Icon = tab.icon
            const active = activeSection === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                data-nav-item="true"
                data-active={active ? 'true' : 'false'}
                onClick={() => onSectionChange(tab.id as LiveAdminSectionId)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 12,
                  border: `1px solid ${active ? withAlpha(T.accent, '44') : 'transparent'}`,
                  background: active ? withAlpha(T.accent, '18') : 'transparent',
                  color: active ? T.accentLight : T.muted,
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: 44,
                }}
              >
                <Icon size={15} />
                <span style={{ ...sora, fontSize: 12, fontWeight: 700 }}>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        <Card style={{ padding: 12, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})` }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Path</div>
          {breadcrumbs.length > 0 ? <AdminBreadcrumbs segments={breadcrumbs} /> : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No deeper scope selected yet.</div>}
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            aria-label="Collapse operations rail"
            title="Collapse operations rail"
            onClick={onToggleCollapsed}
            style={{ ...getIconButtonStyle({ subtle: false }), width: 'auto', padding: '0 10px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ChevronLeft size={14} />
            Collapse
          </button>
        </div>
      </div>
    </motion.aside>
  )
}

export function SectionLaunchCard({
  title,
  caption,
  helper,
  icon,
  tone = T.accent,
  active,
  onClick,
}: {
  title: string
  caption: string
  helper: string
  icon: ReactNode
  tone?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <Card
      surface={active ? 'selected' : 'launch'}
      glow={active ? tone : undefined}
      onClick={onClick}
      style={{
        padding: 22,
        minHeight: 196,
        background: active
          ? `linear-gradient(160deg, ${withAlpha(tone, '0a')} 0%, ${withAlpha(tone, '06')} 18%, ${T.surface} 100%)`
          : `linear-gradient(160deg, ${withAlpha(tone, '08')} 0%, ${T.surface} 20%, ${T.surface2} 100%)`,
        display: 'grid',
        alignContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tone}16`, color: tone }}>
          {icon}
        </div>
        <div>
          <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
          <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: tone }}>{caption}</div>
        </div>
      </div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

export function OverviewSupportCard({
  title,
  value,
  helper,
  tone = T.accent,
  onClick,
}: {
  title: string
  value: string
  helper: string
  tone?: string
  onClick?: () => void
}) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 18,
        borderRadius: 18,
        border: `1px solid ${withAlpha(tone, '14')}`,
        background: `linear-gradient(180deg, ${withAlpha(tone, '08')}, ${T.surface})`,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      <div style={{ ...sora, fontSize: 30, fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.muted, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

export function ActionQueueCard({
  title,
  subtitle,
  chips,
  trailing,
  tone = T.warning,
  onClick,
}: {
  title: string
  subtitle: string
  chips: string[]
  trailing?: ReactNode
  tone?: string
  onClick?: () => void
}) {
  const primaryContent = (
    <>
      <span style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text, display: 'block' }}>{title}</span>
      <span style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.muted, marginTop: 4, lineHeight: 1.7, display: 'block' }}>{subtitle}</span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {chips.map(chip => <Chip key={chip} color={tone} size={9}>{chip}</Chip>)}
      </span>
    </>
  )

  return (
    <Card data-action-queue-card="true" style={{ padding: 12, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        {onClick
          ? (
            <button
              type="button"
              data-action-queue-primary="true"
              onClick={onClick}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              {primaryContent}
            </button>
          )
          : <div style={{ flex: 1, minWidth: 0 }}>{primaryContent}</div>}
        {trailing ? <div style={{ flexShrink: 0 }}>{trailing}</div> : null}
      </div>
    </Card>
  )
}

export function AdminDetailTabs({
  tabs,
  activeTab,
  onChange,
  ariaLabel = 'Admin detail sections',
  idBase = 'admin-detail',
}: {
  tabs: Array<{ id: string; label: string; count?: string | number; disabled?: boolean }>
  activeTab: string
  onChange: (tabId: string) => void
  ariaLabel?: string
  idBase?: string
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabElements = Array.from(e.currentTarget.querySelectorAll('[role="tab"]:not([disabled])')) as HTMLElement[]
    const currentIndex = tabElements.indexOf(document.activeElement as HTMLElement)
    if (currentIndex === -1) return

    let nextIndex = currentIndex
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % tabElements.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + tabElements.length) % tabElements.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = tabElements.length - 1
    }

    if (nextIndex !== currentIndex) {
      tabElements[nextIndex].focus()
    }
  }

  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown} style={{ ...getSegmentedGroupStyle(), flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', alignItems: 'center', justifyContent: 'flex-start', rowGap: 6 }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          id={`${idBase}-tab-${tab.id}`}
          role="tab"
          aria-controls={`${idBase}-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          data-tab="true"
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
            minWidth: 0,
            maxWidth: '100%',
            flex: '0 0 auto',
            textAlign: 'left',
            alignSelf: 'flex-start',
            ...getSegmentedButtonStyle({ active: activeTab === tab.id, disabled: tab.disabled, compact: true }),
          }}
        >
          <span style={{ ...sora, fontSize: 12, fontWeight: 700 }}>{tab.label}</span>
          {tab.count != null ? <Chip color={activeTab === tab.id ? T.accent : T.dim} size={8}>{String(tab.count)}</Chip> : null}
          {tab.disabled && tab.count == null ? <span style={{ ...mono, fontSize: 9, color: T.dim }}>Locked</span> : null}
        </button>
      ))}
    </div>
  )
}

export function AdminDetailTabPanel({
  idBase,
  tabId,
  children,
}: {
  idBase: string
  tabId: string
  children: ReactNode
}) {
  return (
    <div
      id={`${idBase}-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`${idBase}-tab-${tabId}`}
      style={{ minHeight: 360 }}
    >
      {children}
    </div>
  )
}

export function AdminMiniStat({
  label,
  value,
  tone = T.accent,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${withAlpha(tone, '1c')}`, background: `linear-gradient(180deg, ${withAlpha(tone, '0a')}, ${T.surface})`, padding: '12px 14px', minWidth: 0, maxWidth: 240, boxShadow: `0 8px 18px ${withAlpha(tone, '0a')}` }}>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.micro, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 'clamp(16px, 1.8vw, 20px)', fontWeight: 800, color: T.text, marginTop: 6, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
