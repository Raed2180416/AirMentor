import type { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T, mono, sora } from './data'
import { Btn, Card } from './ui-primitives'

type ProofSurfaceHeroProps = {
  surface: string
  entityId?: string
  studentId?: string
  courseId?: string
  surfaceId?: string
  eyebrow: string
  title: ReactNode
  description: ReactNode
  icon?: ReactNode
  headerActions?: ReactNode
  badges?: ReactNode
  notices?: ReactNode
  children?: ReactNode
  style?: CSSProperties
}

type ProofSurfaceLauncherProps = {
  targetId: string
  label?: string
  disabled?: boolean
  dataProofEntityId?: string
  style?: CSSProperties
}

type ProofSurfaceTab = {
  id: string
  label: string
  disabled?: boolean
  dataProofAction?: string
  dataProofEntityId?: string
}

type ProofSurfaceTabsProps = {
  idBase: string
  tabs: ProofSurfaceTab[]
  activeTab: string
  onChange: (tabId: string) => void
  ariaLabel: string
  controlId?: string
  actionName?: string
  style?: CSSProperties
}

type ProofSurfaceTabPanelProps = {
  idBase: string
  tabId: string
  activeTab: string
  sectionId?: string
  children: ReactNode
  minHeight?: number
  gap?: number
  style?: CSSProperties
}

function focusProofTarget(targetId: string, smooth: boolean) {
  if (typeof document === 'undefined') return
  const target = document.getElementById(targetId)
  if (!(target instanceof HTMLElement)) return
  target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  const removeTabIndex = !target.hasAttribute('tabindex')
  if (removeTabIndex) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  if (removeTabIndex) {
    window.setTimeout(() => {
      if (target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex')
    }, 1200)
  }
}

export function ProofSurfaceHero({
  surface,
  entityId,
  studentId,
  courseId,
  surfaceId,
  eyebrow,
  title,
  description,
  icon,
  headerActions,
  badges,
  notices,
  children,
  style = {},
}: ProofSurfaceHeroProps) {
  return (
    <Card
      id={surfaceId ?? `${surface}-surface`}
      data-proof-surface={surface}
      data-proof-shell="shared"
      data-proof-entity-id={entityId ?? undefined}
      data-proof-student-id={studentId ?? undefined}
      data-proof-course-id={courseId ?? undefined}
      style={{
        padding: 20,
        display: 'grid',
        gap: 16,
        background: `linear-gradient(160deg, ${T.surface}, ${T.surface2})`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        {icon ? icon : null}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div>
          <div style={{ ...sora, fontWeight: 800, fontSize: 24, color: T.text, marginTop: 8 }}>{title}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{description}</div>
        </div>
        {headerActions ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {headerActions}
          </div>
        ) : null}
      </div>
      {badges ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{badges}</div> : null}
      {notices ? <div style={{ display: 'grid', gap: 10 }}>{notices}</div> : null}
      {children}
    </Card>
  )
}

export function ProofSurfaceLauncher({
  targetId,
  label = 'Jump to proof controls',
  disabled = false,
  dataProofEntityId,
  style = {},
}: ProofSurfaceLauncherProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div
      data-proof-launcher="floating"
      style={{
        position: 'sticky',
        bottom: 16,
        zIndex: 2,
        justifySelf: 'end',
        display: 'flex',
        justifyContent: 'flex-end',
        ...style,
      }}
    >
      <Btn
        size="sm"
        variant="ghost"
        disabled={disabled}
        ariaLabel={label}
        ariaControls={targetId}
        title={label}
        dataProofAction="proof-shell-launcher"
        dataProofEntityId={dataProofEntityId ?? targetId}
        onClick={() => focusProofTarget(targetId, !shouldReduceMotion)}
      >
        {label}
      </Btn>
    </div>
  )
}

export function ProofSurfaceTabs({
  idBase,
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  controlId,
  actionName = 'proof-shell-tab',
  style = {},
}: ProofSurfaceTabsProps) {
  return (
    <div
      id={controlId}
      role="tablist"
      aria-label={ariaLabel}
      data-proof-shell-tabs="shared"
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        borderBottom: `1px solid ${T.surface2}`,
        paddingBottom: 12,
        ...style,
      }}
    >
      {tabs.map(tab => (
        <Btn
          key={tab.id}
          id={`${idBase}-tab-${tab.id}`}
          size="sm"
          variant={activeTab === tab.id ? 'primary' : 'ghost'}
          role="tab"
          ariaControls={`${idBase}-panel-${tab.id}`}
          ariaSelected={activeTab === tab.id}
          disabled={tab.disabled}
          dataProofAction={tab.dataProofAction ?? actionName}
          dataProofEntityId={tab.dataProofEntityId ?? tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Btn>
      ))}
    </div>
  )
}

export function ProofSurfaceTabPanel({
  idBase,
  tabId,
  activeTab,
  sectionId,
  children,
  minHeight = 360,
  gap = 14,
  style = {},
}: ProofSurfaceTabPanelProps) {
  const shouldReduceMotion = useReducedMotion()

  if (activeTab !== tabId) return null

  return (
    <motion.div
      key={`${idBase}-${tabId}`}
      id={`${idBase}-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`${idBase}-tab-${tabId}`}
      data-proof-shell-panel="shared"
      data-proof-section={sectionId}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
      style={{
        display: 'grid',
        gap,
        minHeight,
        alignContent: 'start',
        ...style,
      }}
    >
      {children}
    </motion.div>
  )
}
