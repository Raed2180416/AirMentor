import {
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { isLightTheme } from '@web/shared/ui/theme'
import {
  BrandMark,
  Card,
  Chip,
  UI_FONT_SIZES,
  getFieldChromeStyle,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  getShellBarStyle,
} from '@web/shared/ui/primitives'
import type { ThemeMode } from '@kernel/shared/domain'
import { TOP_TABS } from './constants'
import type { AdminSectionId, BreadcrumbSegment } from './types'

export function AdminBreadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  if (segments.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {segments.map((segment, index) => (
        <span key={index} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {index > 0 && <ChevronRight size={10} color={T.dim} />}
          {segment.onClick ? (
            <button
              type="button"
              onClick={segment.onClick}
              style={{ ...mono, fontSize: 10, color: index === segments.length - 1 ? T.text : T.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {segment.label}
            </button>
          ) : (
            <span style={{ ...mono, fontSize: 10, color: T.text }}>{segment.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}

export function AdminTopBar({
  institutionName,
  modeLabel,
  modeColor = T.warning,
  breadcrumbs,
  searchQuery,
  onSearchChange,
  searchResults,
  onSearchSelect,
  activeSection,
  onSectionChange,
  themeMode,
  onThemeToggle,
  onGoHome,
  canNavigateBack = false,
  onNavigateBack,
  extraActions,
  style,
}: {
  institutionName: string
  modeLabel: string
  modeColor?: string
  breadcrumbs: BreadcrumbSegment[]
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResults: Array<{ key: string; title: string; subtitle: string; onSelect: () => void }>
  onSearchSelect?: () => void
  activeSection: AdminSectionId
  onSectionChange: (section: AdminSectionId) => void
  themeMode: ThemeMode
  onThemeToggle: () => void
  onGoHome?: () => void
  canNavigateBack?: boolean
  onNavigateBack?: () => void
  extraActions?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ ...getShellBarStyle(themeMode), zIndex: 20, ...style }}>
      <div style={{ padding: '14px 20px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={onGoHome}
              aria-label="Go to dashboard"
              title="Go to dashboard"
              style={{ background: 'none', border: 'none', padding: 0, cursor: onGoHome ? 'pointer' : 'default', display: 'inline-flex' }}
            >
              <BrandMark size={38} />
            </button>
            <div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 18, color: T.text }}>{institutionName}</div>
              <AdminBreadcrumbs segments={breadcrumbs} />
            </div>
            <Chip color={modeColor}>{modeLabel}</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {canNavigateBack && onNavigateBack ? (
              <button
                type="button"
                onClick={onNavigateBack}
                style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', ...mono, fontSize: UI_FONT_SIZES.eyebrow, gap: 6 }}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={onThemeToggle}
              title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'}
              style={{ ...getIconButtonStyle({ subtle: false }), ...mono, fontSize: 14, lineHeight: 1 }}
            >
              {isLightTheme(themeMode) ? '🌙' : '☀️'}
            </button>
            {extraActions}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...getFieldChromeStyle(), padding: '10px 14px' }}>
            <Search size={15} color={T.muted} />
            <input
              aria-label="Admin search"
              value={searchQuery}
              onChange={event => onSearchChange(event.target.value)}
              placeholder="Search faculty, department, batch, student, faculty member, course..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.text, ...mono, fontSize: UI_FONT_SIZES.body }}
            />
          </div>
          {searchResults.length > 0 ? (
            <Card style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, padding: 0, overflow: 'hidden', zIndex: 30 }}>
              {searchResults.map(result => (
                <button
                  key={result.key}
                  type="button"
                  onClick={() => {
                    result.onSelect()
                    onSearchSelect?.()
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${T.border}`,
                    padding: '11px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{result.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{result.subtitle}</div>
                </button>
              ))}
            </Card>
          ) : null}
        </div>

        <div style={{ ...getSegmentedGroupStyle(), flexWrap: 'wrap' }}>
          {TOP_TABS.map(item => {
            const Icon = item.icon
            const active = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, ...getSegmentedButtonStyle({ active, compact: true }) }}
              >
                <Icon size={14} />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
