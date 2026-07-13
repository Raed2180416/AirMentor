import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { LiveAdminSectionId } from '../system-admin-live-data'
import {
  AdminBreadcrumbs,
  InfoBanner,
  SearchField,
  TOP_TABS,
  type BreadcrumbSegment,
} from '../system-admin-ui'
import {
  Card,
  UI_FONT_SIZES,
  getIconButtonStyle,
  withAlpha,
} from '@web/shared/ui/primitives'

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
