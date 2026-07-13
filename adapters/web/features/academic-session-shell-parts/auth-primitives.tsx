import { type ReactNode } from 'react'
import { T, mono } from '@web/simulation/fixtures'
import { PageShell } from '@web/shared/ui/primitives'

export function AcademicFieldLabel({ children }: { children: string }) {
  return <label style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 6 }}>{children}</label>
}

export function AcademicInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: '100%', ...mono, fontSize: 11, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

export function AcademicNotice({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' | 'success' }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return <div style={{ ...mono, fontSize: 11, color, border: `1px solid ${color}40`, background: `${color}12`, borderRadius: 10, padding: '10px 12px' }}>{message}</div>
}

export function AcademicHeroPill({ children, color = T.accent }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, fontSize: 10, color, border: `1px solid ${color}30`, background: `${color}12`, borderRadius: 999, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </span>
  )
}

export function AcademicHeroFeature({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: `${color}10`, border: `1px solid ${color}22`, boxShadow: `0 18px 40px ${color}10` }}>
      <div style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
    </div>
  )
}

export function AcademicAuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top left, ${T.accent}16, transparent 28%), radial-gradient(circle at bottom right, ${T.success}14, transparent 30%), linear-gradient(180deg, ${T.bg}, ${T.surface2})`,
        padding: 'clamp(18px, 3vw, 30px)',
      }}
    >
      <PageShell size="wide" style={{ paddingTop: 12 }}>
        {children}
      </PageShell>
    </div>
  )
}
