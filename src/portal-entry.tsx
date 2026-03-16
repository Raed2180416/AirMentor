import { GraduationCap, Shield, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { T, mono, sora } from './data'
import { normalizeThemeMode, type ThemeMode } from './domain'
import { AIRMENTOR_STORAGE_KEYS } from './repositories'
import { applyThemePreset, isLightTheme } from './theme'
import { Btn, Card } from './ui-primitives'

type PortalCardProps = {
  eyebrow: string
  title: string
  body: string
  actionLabel: string
  accentColor: string
  icon: typeof GraduationCap
  onSelect: () => void
}

function PortalCard({ eyebrow, title, body, actionLabel, accentColor, icon: Icon, onSelect }: PortalCardProps) {
  return (
    <Card style={{ padding: 22, height: '100%' }} glow={accentColor}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${accentColor}1f`, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} />
        </div>
        <div style={{ ...mono, fontSize: 10, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {eyebrow}
        </div>
      </div>
      <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text, marginTop: 18 }}>
        {title}
      </div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.7, marginTop: 10 }}>
        {body}
      </div>
      <div style={{ marginTop: 22 }}>
        <Btn onClick={onSelect}>
          {actionLabel}
          <ArrowRight size={14} />
        </Btn>
      </div>
    </Card>
  )
}

function persistTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AIRMENTOR_STORAGE_KEYS.themeMode, mode)
}

export function PortalEntryScreen({
  onSelectAcademic,
  onSelectAdmin,
}: {
  onSelectAcademic: () => void
  onSelectAdmin: () => void
}) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return normalizeThemeMode(null)
    return normalizeThemeMode(window.localStorage.getItem(AIRMENTOR_STORAGE_KEYS.themeMode))
  })

  applyThemePreset(themeMode)

  function handleThemeToggle() {
    const nextMode = isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light'
    setThemeMode(nextMode)
    persistTheme(nextMode)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top left, ${T.accent}20, transparent 26%), radial-gradient(circle at bottom right, ${T.success}14, transparent 30%), ${T.bg}`,
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              AirMentor Portal
            </div>
            <div style={{ ...sora, fontSize: 44, fontWeight: 800, color: T.text, marginTop: 10, maxWidth: 780, lineHeight: 1.05 }}>
              One live site. Two runtime workspaces.
            </div>
            <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 14, maxWidth: 700, lineHeight: 1.8 }}>
              Choose the portal that matches your role. Academic users stay in the existing teaching workspace. System admins sign in to the backend-backed control plane.
            </div>
          </div>

          <button
            type="button"
            onClick={handleThemeToggle}
            style={{
              ...mono,
              fontSize: 11,
              color: T.muted,
              background: 'transparent',
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {isLightTheme(themeMode) ? 'Dark' : 'Light'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginTop: 26 }}>
          <PortalCard
            eyebrow="Academic"
            title="Teaching Workspace"
            body="Use the current mock academic flow for Course Leaders, Mentors, and HoDs. This keeps the existing role selector, task queues, grading views, and operational walkthroughs."
            actionLabel="Open Academic Portal"
            accentColor={T.success}
            icon={GraduationCap}
            onSelect={onSelectAcademic}
          />
          <PortalCard
            eyebrow="Admin"
            title="System Admin Control Plane"
            body="Use the system-admin experience for institution setup, faculty and student records, course governance, and request workflow management. It runs in mock mode when no admin backend is configured and switches to live backend mode when available."
            actionLabel="Open System Admin"
            accentColor={T.accent}
            icon={Shield}
            onSelect={onSelectAdmin}
          />
        </div>
      </div>
    </div>
  )
}
