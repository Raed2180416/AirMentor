import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { T, mono, sora, type YearGroup } from './data'
import type { FacultyAccount, Role } from './domain'
import { Bar, withAlpha } from './ui-primitives'

type SidebarPageId =
  | 'dashboard'
  | 'students'
  | 'course'
  | 'calendar'
  | 'upload'
  | 'entry-workspace'
  | 'mentees'
  | 'department'
  | 'mentee-detail'
  | 'student-history'
  | 'student-shell'
  | 'risk-explorer'
  | 'unlock-review'
  | 'scheme-setup'
  | 'queue-history'
  | 'faculty-profile'

type SidebarNavItem = {
  id: SidebarPageId
  icon: LucideIcon
  label: string
}

type SidebarCompletenessRow = {
  lbl: string
  pct: number
}

type AcademicWorkspaceSidebarProps = {
  currentTeacher: FacultyAccount
  role: Role
  page: SidebarPageId
  historyBackPage: SidebarPageId | null
  navItems: SidebarNavItem[]
  sidebarYearGroups: YearGroup[]
  sidebarCompletenessRows: SidebarCompletenessRow[]
  sidebarCollapsed: boolean
  sidebarToggleLabel: string
  isCompactTopbar: boolean
  onOpenFacultyProfile: () => void
  onSelectNavItem: (pageId: SidebarPageId) => void
  onExpandSidebar: () => void
  onCollapseSidebar: () => void
}

const subtleDividerStyle = {
  height: 1,
  background: `linear-gradient(90deg, transparent, ${withAlpha(T.border2, '26')} 14%, ${withAlpha(T.border2, '62')} 50%, ${withAlpha(T.border2, '26')} 86%, transparent)`,
  opacity: 0.9,
}

function getHomeNavItemId(role: Role): SidebarPageId {
  return role === 'Course Leader' ? 'dashboard' : role === 'Mentor' ? 'mentees' : 'department'
}

function getHistoryAnchorPage(role: Role, historyBackPage: SidebarPageId | null): SidebarPageId {
  if (historyBackPage === 'students') return 'students'
  return getHomeNavItemId(role)
}

function isNavItemActive(input: {
  currentPage: SidebarPageId
  itemId: SidebarPageId
  role: Role
  historyBackPage: SidebarPageId | null
}) {
  const { currentPage, itemId, role, historyBackPage } = input
  if (currentPage === itemId) return true
  if (currentPage === 'course') return itemId === getHomeNavItemId(role)
  if (currentPage === 'student-history' || currentPage === 'student-shell' || currentPage === 'risk-explorer') {
    return itemId === getHistoryAnchorPage(role, historyBackPage)
  }
  if (currentPage === 'upload' || currentPage === 'entry-workspace' || currentPage === 'scheme-setup') {
    return itemId === 'upload'
  }
  if (currentPage === 'queue-history' || currentPage === 'unlock-review') {
    return itemId === 'queue-history'
  }
  if (currentPage === 'mentee-detail') return itemId === 'mentees'
  return false
}

export function AcademicWorkspaceSidebar({
  currentTeacher,
  role,
  page,
  historyBackPage,
  navItems,
  sidebarYearGroups,
  sidebarCompletenessRows,
  sidebarCollapsed,
  sidebarToggleLabel,
  isCompactTopbar,
  onOpenFacultyProfile,
  onSelectNavItem,
  onExpandSidebar,
  onCollapseSidebar,
}: AcademicWorkspaceSidebarProps) {
  if (isCompactTopbar) return null

  return (
    <>
      {sidebarCollapsed && (
        <motion.button
          type="button"
          aria-label={sidebarToggleLabel}
          title={sidebarToggleLabel}
          onClick={onExpandSidebar}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: 18,
            bottom: 18,
            zIndex: 30,
            width: 42,
            height: 42,
            borderRadius: 999,
            background: T.surface,
            border: `1px solid ${T.border2}`,
            color: T.muted,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 14px 30px rgba(2,6,23,0.18)',
          }}
        >
          <ChevronRight size={16} />
        </motion.button>
      )}

      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 210, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: T.surface,
              borderRight: `1px solid ${T.border}`,
              display: 'flex',
              flexDirection: 'column',
              position: 'sticky',
              top: 54,
              height: 'calc(100vh - 54px)',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '10px 12px', minWidth: 210, flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', marginBottom: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: T.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...sora,
                    fontWeight: 800,
                    fontSize: 10,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {currentTeacher.initials}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      ...sora,
                      fontWeight: 600,
                      fontSize: 11,
                      color: T.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentTeacher.name}
                  </div>
                  <div style={{ ...mono, fontSize: 9, color: T.dim }}>{role}</div>
                </div>
              </div>

              <button
                type="button"
                data-proof-action="open-faculty-profile"
                onClick={onOpenFacultyProfile}
                style={{
                  width: '100%',
                  marginBottom: 12,
                  borderRadius: 8,
                  border: `1px solid ${page === 'faculty-profile' ? T.accent : T.border}`,
                  background: page === 'faculty-profile' ? `${T.accent}14` : T.surface2,
                  color: page === 'faculty-profile' ? T.accentLight : T.muted,
                  cursor: 'pointer',
                  padding: '8px 10px',
                  textAlign: 'left',
                  ...mono,
                  fontSize: 10,
                }}
              >
                Faculty Profile
              </button>

              <nav>
                {navItems.map(item => {
                  const Icon = item.icon
                  const active = isNavItemActive({
                    currentPage: page,
                    itemId: item.id,
                    role,
                    historyBackPage,
                  })

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectNavItem(item.id)}
                      data-nav-item="true"
                      data-active={active ? 'true' : 'false'}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 10px',
                        borderRadius: 7,
                        border: 'none',
                        cursor: 'pointer',
                        background: active ? `${T.accent}18` : 'transparent',
                        color: active ? T.accentLight : T.muted,
                        ...sora,
                        fontWeight: 500,
                        fontSize: 12,
                        marginBottom: 2,
                        transition: 'background-color 0.15s ease, color 0.15s ease',
                        textAlign: 'left',
                      }}
                    >
                      <Icon size={15} /> {item.label}
                    </button>
                  )
                })}
              </nav>

              {role === 'Course Leader' && (
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  <div style={subtleDividerStyle} aria-hidden="true" />
                  <div style={{ ...mono, fontSize: 8, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Year Stages</div>
                  {sidebarYearGroups.map(group => (
                    <div key={group.year} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: group.color, flexShrink: 0 }} />
                      <span style={{ ...mono, fontSize: 9, color: T.muted, flex: 1 }}>{group.year}</span>
                      <span style={{ ...mono, fontSize: 8, color: group.stageInfo.color }}>{group.stageInfo.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {role === 'Course Leader' && (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  <div style={subtleDividerStyle} aria-hidden="true" />
                  <div style={{ ...mono, fontSize: 8, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Data Completeness</div>
                  {sidebarCompletenessRows.length > 0 ? (
                    sidebarCompletenessRows.map(row => (
                      <div key={row.lbl} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ ...mono, fontSize: 9, color: T.muted }}>{row.lbl}</span>
                          <span style={{ ...mono, fontSize: 9, color: row.pct >= 80 ? T.success : row.pct >= 50 ? T.warning : T.danger }}>{row.pct}%</span>
                        </div>
                        <Bar val={row.pct} color={row.pct >= 80 ? T.success : row.pct >= 50 ? T.warning : T.danger} h={3} />
                      </div>
                    ))
                  ) : (
                    <div style={{ ...mono, fontSize: 9, color: T.dim, lineHeight: 1.7 }}>
                      No live student data is available in this scope yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '12px' }}>
              <div style={subtleDividerStyle} aria-hidden="true" />
              <button
                type="button"
                aria-label={sidebarToggleLabel}
                title={sidebarToggleLabel}
                onClick={onCollapseSidebar}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: `1px solid ${T.border2}`,
                  background: T.surface2,
                  color: T.muted,
                  cursor: 'pointer',
                  padding: '10px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  ...mono,
                  fontSize: 11,
                }}
              >
                <span>Collapse sidebar</span>
                <motion.span animate={{ rotate: 180 }} transition={{ duration: 0.18 }} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <ChevronRight size={14} />
                </motion.span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
