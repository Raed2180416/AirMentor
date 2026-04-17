import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { T, mono, sora } from './data'
import { Btn, Card, ModalWorkspace, withAlpha } from './ui-primitives'

type ProofSurfaceHeroProps = {
  surface: string
  entityId?: string
  studentId?: string
  courseId?: string
  surfaceId?: string
  dataProofDashboardLayout?: 'embedded' | 'page'
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
  targetId?: string
  label?: string
  disabled?: boolean
  dataProofEntityId?: string
  popupTitle?: ReactNode
  popupCaption?: ReactNode
  popupContent?: ReactNode | ((helpers: { closePopup: () => void; jumpToTarget: () => void }) => ReactNode)
  popupFooter?: ReactNode | ((helpers: { closePopup: () => void; jumpToTarget: () => void }) => ReactNode)
  popupSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
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

function getAccessibleProofEyebrowColor() {
  return (T.accent === '#3b82f6' || T.accent === '#5ea0ff') ? '#1d4ed8' : T.accent
}

function getLauncherPalette() {
  const isLightTheme = T.bg === '#f6f8fb'
  return {
    border: withAlpha(T.border2, isLightTheme ? 'c8' : 'de'),
    background: isLightTheme
      ? `linear-gradient(180deg, ${withAlpha(T.surface, 'f2')}, ${withAlpha(T.surface2, 'f7')})`
      : `linear-gradient(180deg, ${withAlpha(T.surface, 'f7')}, ${withAlpha(T.surface2, 'fb')})`,
    shadow: isLightTheme
      ? '0 20px 44px rgba(15, 23, 42, 0.14)'
      : '0 26px 56px rgba(2, 6, 23, 0.58)',
  }
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
  dataProofDashboardLayout,
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
  const eyebrowColor = getAccessibleProofEyebrowColor()

  return (
    <Card
      id={surfaceId ?? `${surface}-surface`}
      data-proof-surface={surface}
      data-proof-shell="shared"
      data-proof-entity-id={entityId ?? undefined}
      data-proof-student-id={studentId ?? undefined}
      data-proof-course-id={courseId ?? undefined}
      data-proof-dashboard-layout={dataProofDashboardLayout ?? undefined}
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
          <div style={{ ...mono, fontSize: 10, color: eyebrowColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div>
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
  popupTitle,
  popupCaption,
  popupContent,
  popupFooter,
  popupSize = 'lg',
  style = {},
}: ProofSurfaceLauncherProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const resolvedTargetId = targetId?.trim() || undefined
  const popupAvailable = popupContent != null || popupFooter != null || popupTitle != null || popupCaption != null
  const launcherPalette = getLauncherPalette()
  const closePopup = () => setIsPopupOpen(false)
  const jumpToTarget = () => {
    if (resolvedTargetId) focusProofTarget(resolvedTargetId, !shouldReduceMotion)
    closePopup()
  }
  const renderPopupNode = (node: ReactNode | ((helpers: { closePopup: () => void; jumpToTarget: () => void }) => ReactNode) | undefined) => {
    if (typeof node === 'function') {
      return node({ closePopup, jumpToTarget })
    }
    return node
  }

  return (
    <>
      <div
        data-proof-launcher="floating"
        data-proof-launcher-mode={popupAvailable ? 'popup-capable' : 'anchor'}
        data-proof-launcher-state={isPopupOpen ? 'open' : 'closed'}
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 1200,
          display: 'flex',
          justifyContent: 'flex-end',
          pointerEvents: 'auto',
          isolation: 'isolate',
          touchAction: 'manipulation',
          ...style,
        }}
      >
        <div style={{
          display: 'grid',
          gap: 8,
          minWidth: 220,
          maxWidth: 280,
          padding: 12,
          borderRadius: 20,
          border: `1px solid ${launcherPalette.border}`,
          background: launcherPalette.background,
          backdropFilter: 'blur(20px) saturate(120%)',
          boxShadow: launcherPalette.shadow,
        }}>
          <Btn
            size="sm"
            variant={popupAvailable ? 'primary' : 'ghost'}
            disabled={disabled}
            ariaLabel={popupAvailable ? `${label} · open dialog` : label}
            ariaControls={resolvedTargetId}
            title={label}
            dataProofAction="proof-shell-launcher"
            dataProofEntityId={dataProofEntityId ?? resolvedTargetId ?? 'proof-controls'}
            onClick={() => {
              if (popupAvailable) {
                setIsPopupOpen(current => !current)
                return
              }
              if (resolvedTargetId) focusProofTarget(resolvedTargetId, !shouldReduceMotion)
            }}
          >
            {label}
          </Btn>
          {popupAvailable ? (
            <div style={{ ...mono, fontSize: 10, color: T.muted, paddingInline: 2 }}>
              Opens the shared proof control surface.
            </div>
          ) : null}
        </div>
      </div>

      {popupAvailable && isPopupOpen ? (
        <ModalWorkspace
          title={typeof popupTitle === 'string' ? popupTitle : 'Proof control surface'}
          eyebrow="Proof Launcher"
          caption={typeof popupCaption === 'string' ? popupCaption : undefined}
          onClose={closePopup}
          size={popupSize}
          footer={renderPopupNode(popupFooter)}
          bodyStyle={{ display: 'grid', gap: 14 }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>
                {popupTitle ?? 'Proof control surface'}
              </div>
              {popupCaption ? (
                <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.7 }}>
                  {popupCaption}
                </div>
              ) : null}
            </div>
            {popupContent ? renderPopupNode(popupContent) : null}
            {!popupFooter && popupAvailable ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn size="sm" variant="ghost" onClick={jumpToTarget}>
                  Open full dashboard
                </Btn>
                <Btn size="sm" variant="ghost" onClick={closePopup}>
                  Close
                </Btn>
              </div>
            ) : null}
          </div>
        </ModalWorkspace>
      ) : null}
    </>
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
        flexWrap: 'nowrap',
        overflowX: 'auto',
        scrollbarGutter: 'stable',
        borderBottom: `1px solid ${T.surface2}`,
        paddingBottom: 8,
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
