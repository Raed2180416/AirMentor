import type { ReactNode } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import {
  Chip,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
} from '@web/shared/ui/primitives'

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
