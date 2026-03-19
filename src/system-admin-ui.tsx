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
import {
  BrandMark,
  Card,
  Chip,
  FieldInput,
  FieldSelect,
  FieldTextarea,
  ModalWorkspace,
  UI_FONT_SIZES,
  getFieldChromeStyle,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  getShellBarStyle,
  withAlpha,
} from './ui-primitives'
import type { ThemeMode } from './domain'

export type AdminSectionId = 'overview' | 'faculties' | 'students' | 'faculty-members' | 'requests'

export function getReadOnlyInputStyle(): CSSProperties {
  return {
    background: T.surface2,
    color: T.dim,
    WebkitTextFillColor: T.dim,
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
  return <label style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</label>
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <FieldInput {...props} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <FieldSelect {...props} />
}

export function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <FieldTextarea {...props} />
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...getFieldChromeStyle(), padding: '0 12px' }}>
        <Search size={14} color={T.muted} />
        <input
          aria-label={ariaLabel}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: T.text, colorScheme: 'inherit', ...mono, fontSize: UI_FONT_SIZES.body }}
        />
        {value ? (
          <button
            type="button"
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
            title="Clear"
            onClick={() => onChange('')}
            style={{ width: 24, height: 24, borderRadius: 8, border: 'none', background: 'transparent', color: T.dim, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <X size={13} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function InfoBanner({ tone = 'neutral', message }: { tone?: 'neutral' | 'error' | 'success'; message: string }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return (
    <div style={{ ...mono, fontSize: UI_FONT_SIZES.body, color, border: `1px solid ${color}40`, background: `${color}12`, borderRadius: 14, padding: '11px 13px', lineHeight: 1.7 }}>
      {message}
    </div>
  )
}

export function MetricCard({ label, value, helper, onClick }: { label: string; value: string; helper: string; onClick?: () => void }) {
  return (
    <Card style={{ padding: 18, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 30, fontWeight: 800, color: T.text, marginTop: 10, lineHeight: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{helper}</div>
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
        {eyebrow ? <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: toneColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div> : null}
        <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1.1 }}>{title}</div>
        <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, lineHeight: 1.8 }}>{caption}</div>
      </div>
      {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ padding: 28, textAlign: 'center' }}>
      <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
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

export function DayToggle({ days, selected, onChange }: { days: readonly string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div style={{ ...getSegmentedGroupStyle(), flexWrap: 'wrap' }}>
      {days.map(day => {
        const active = selected.includes(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(active ? selected.filter(item => item !== day) : [...selected, day])}
            style={getSegmentedButtonStyle({ active, compact: true })}
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
        borderRadius: 16,
        border: `1px solid ${selected ? withAlpha(T.accent, '50') : T.border}`,
        background: selected ? `linear-gradient(180deg, ${withAlpha(T.accent, '18')}, ${T.surface})` : `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
        padding: '14px 15px',
        minHeight: 84,
        display: 'grid',
        alignContent: 'start',
        gap: 6,
        cursor: 'pointer',
        width: '100%',
        boxShadow: selected ? `0 14px 28px ${withAlpha(T.accent, '14')}` : undefined,
        transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
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
    <ModalWorkspace
      eyebrow={eyebrow}
      title={title}
      caption={caption}
      onClose={onClose}
      width={width}
      footer={actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div> : undefined}
      zIndex={120}
    >
      {children}
    </ModalWorkspace>
  )
}
