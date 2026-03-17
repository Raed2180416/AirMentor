import {
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import {
  Building2,
  ChevronRight,
  GraduationCap,
  Layers3,
  Search,
  Shield,
  UserCog,
  X,
} from 'lucide-react'
import { T, mono, sora } from './data'
import { isLightTheme } from './theme'
import { Card, Chip } from './ui-primitives'
import type { ThemeMode } from './domain'

export type AdminSectionId = 'overview' | 'faculties' | 'students' | 'faculty-members' | 'requests'

export function getReadOnlyInputStyle(): CSSProperties {
  return {
    background: T.surface2,
    color: T.dim,
    cursor: 'default',
    pointerEvents: 'none' as const,
    boxShadow: `inset 0 1px 0 ${T.surface3}`,
  }
}

export const TOP_TABS: Array<{ id: AdminSectionId; label: string; icon: typeof Building2 }> = [
  { id: 'overview', label: 'Overview', icon: Layers3 },
  { id: 'faculties', label: 'Faculties', icon: Building2 },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'faculty-members', label: 'Faculty Members', icon: UserCog },
  { id: 'requests', label: 'Requests', icon: Shield },
]

export const WEEKDAYS_6 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAYS_7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Pending'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export function getStatusColor(status: string): string {
  const lower = status.toLowerCase()
  if (['active', 'implemented', 'closed', 'applied'].some(k => lower.includes(k))) return T.success
  if (['new', 'pending', 'in progress', 'in review', 'needs info'].some(k => lower.includes(k))) return T.warning
  if (['rejected', 'error', 'failed'].some(k => lower.includes(k))) return T.danger
  return T.muted
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label style={{ ...mono, fontSize: 10, color: T.dim, display: 'block', marginBottom: 6 }}>{children}</label>
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        ...mono,
        fontSize: 11,
        minHeight: 42,
        borderRadius: 12,
        border: `1px solid ${T.border2}`,
        background: T.surface,
        color: T.text,
        padding: '10px 12px',
        boxShadow: `inset 0 1px 0 ${T.surface3}`,
        ...(props.style ?? {}),
      }}
    />
  )
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        ...mono,
        fontSize: 11,
        minHeight: 42,
        borderRadius: 12,
        border: `1px solid ${T.border2}`,
        background: T.surface,
        color: T.text,
        padding: '10px 12px',
        boxShadow: `inset 0 1px 0 ${T.surface3}`,
        ...(props.style ?? {}),
      }}
    />
  )
}

export function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        resize: 'vertical',
        ...mono,
        fontSize: 11,
        minHeight: 42,
        borderRadius: 12,
        border: `1px solid ${T.border2}`,
        background: T.surface,
        color: T.text,
        padding: '10px 12px',
        boxShadow: `inset 0 1px 0 ${T.surface3}`,
        ...(props.style ?? {}),
      }}
    />
  )
}

export function InfoBanner({ tone = 'neutral', message }: { tone?: 'neutral' | 'error' | 'success'; message: string }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return (
    <div style={{ ...mono, fontSize: 11, color, border: `1px solid ${color}40`, background: `${color}14`, borderRadius: 12, padding: '10px 12px' }}>
      {message}
    </div>
  )
}

export function MetricCard({ label, value, helper, onClick }: { label: string; value: string; helper: string; onClick?: () => void }) {
  return (
    <Card style={{ padding: 18, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>{value}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>{helper}</div>
    </Card>
  )
}

export function SectionHeading({
  title,
  caption,
  eyebrow,
  actions,
  toneColor = T.accent,
}: {
  title: string
  caption: string
  eyebrow?: string
  actions?: ReactNode
  toneColor?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: 4 }}>
        {eyebrow ? <div style={{ ...mono, fontSize: 10, color: toneColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div> : null}
        <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{caption}</div>
      </div>
      {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ padding: 26, textAlign: 'center' }}>
      <div style={{ ...sora, fontSize: 17, fontWeight: 800, color: T.text }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>{body}</div>
    </Card>
  )
}

export type BreadcrumbSegment = { label: string; onClick?: () => void }

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
    <div style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(12px)', background: isLightTheme(themeMode) ? 'rgba(247,251,255,0.88)' : 'rgba(10,16,24,0.88)', borderBottom: `1px solid ${T.border}`, ...style }}>
      <div style={{ padding: '14px 20px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={onGoHome}
              aria-label="Go to dashboard"
              title="Go to dashboard"
              style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', ...sora, fontWeight: 800, fontSize: 13, border: 'none', cursor: onGoHome ? 'pointer' : 'default', padding: 0 }}
            >
              AM
            </button>
            <div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 17, color: T.text }}>{institutionName}</div>
              <AdminBreadcrumbs segments={breadcrumbs} />
            </div>
            <Chip color={modeColor}>{modeLabel}</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {canNavigateBack && onNavigateBack ? (
              <button
                type="button"
                onClick={onNavigateBack}
                style={{ ...mono, fontSize: 10, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={onThemeToggle}
              title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'}
              style={{ ...mono, fontSize: 14, lineHeight: 1, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
            >
              {isLightTheme(themeMode) ? '🌙' : '☀️'}
            </button>
            {extraActions}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, border: `1px solid ${T.border2}`, background: T.surface, padding: '10px 14px' }}>
            <Search size={15} color={T.muted} />
            <input
              aria-label="Global admin search"
              value={searchQuery}
              onChange={event => onSearchChange(event.target.value)}
              placeholder="Search faculty, department, batch, student, faculty member, course..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.text, ...mono, fontSize: 12 }}
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TOP_TABS.map(item => {
            const Icon = item.icon
            const active = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  borderRadius: 999,
                  border: `1px solid ${active ? T.accent : T.border}`,
                  background: active ? `${T.accent}18` : 'transparent',
                  color: active ? T.text : T.muted,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  ...mono,
                  fontSize: 11,
                }}
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

export function DayToggle({ days, selected, onChange }: { days: readonly string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {days.map(day => {
        const active = selected.includes(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(active ? selected.filter(item => item !== day) : [...selected, day])}
            style={{
              borderRadius: 999,
              border: `1px solid ${active ? T.accent : T.border}`,
              background: active ? `${T.accent}18` : 'transparent',
              color: active ? T.text : T.muted,
              padding: '8px 12px',
              cursor: 'pointer',
              ...mono,
              fontSize: 11,
            }}
          >
            {day}
          </button>
        )
      })}
    </div>
  )
}

export function EntityButton({ selected, onClick, children, style: extraStyle }: { selected?: boolean; onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <button
      type="button"
      data-nav-item="true"
      data-active={selected ? 'true' : 'false'}
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 14,
        border: `1px solid ${selected ? T.accent : T.border}`,
        background: selected ? `linear-gradient(180deg, ${T.accent}16, ${T.surface})` : `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
        padding: '14px 15px',
        minHeight: 74,
        display: 'grid',
        alignContent: 'start',
        gap: 6,
        cursor: 'pointer',
        width: '100%',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  )
}

export function HeroBadge({ children, color = T.accent }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, fontSize: 10, color, border: `1px solid ${color}30`, background: `${color}12`, borderRadius: 999, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </span>
  )
}

export function AuthFeature({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: `${color}10`, border: `1px solid ${color}22`, boxShadow: `0 18px 40px ${color}10` }}>
      <div style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
    </div>
  )
}

export function ModalFrame({
  eyebrow,
  title,
  caption,
  onClose,
  actions,
  children,
  width = 680,
}: {
  eyebrow?: string
  title: string
  caption?: string
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
  width?: number
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(6, 12, 20, 0.52)',
        backdropFilter: 'blur(14px)',
        padding: '32px 18px',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div onClick={event => event.stopPropagation()}>
      <Card
        style={{
          width: 'min(100%, 680px)',
          maxWidth: width,
          maxHeight: 'min(88vh, 920px)',
          overflowY: 'auto',
          padding: 22,
          borderRadius: 22,
          background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
          boxShadow: `0 28px 64px rgba(2, 6, 23, 0.28)`,
        }}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              {eyebrow ? <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div> : null}
              <div style={{ ...sora, fontSize: 24, fontWeight: 800, color: T.text }}>{title}</div>
              {caption ? <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>{caption}</div> : null}
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              title="Close"
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.muted,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
          {children}
          {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div> : null}
        </div>
      </Card>
      </div>
    </div>
  )
}
