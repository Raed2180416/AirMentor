import type { ReactNode } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Chip, withAlpha } from '@web/shared/ui/primitives'
import type { ApiBatch, ApiBranch, ApiPolicyOverride } from '@web/shared/api/types'
import type { HierarchyWorkspaceTabOption, SelectionItem } from './types'

type AdminMiniStatProps = {
  label: string
  value: string
  tone?: string
}

export function AdminMiniStat({ label, value, tone = T.accent }: AdminMiniStatProps) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${withAlpha(tone, '1c')}`, background: `linear-gradient(180deg, ${withAlpha(tone, '0a')}, ${T.surface})`, padding: '12px 14px', minWidth: 0, maxWidth: 240, boxShadow: `0 8px 18px ${withAlpha(tone, '0a')}` }}>
      <div style={{ ...mono, fontSize: 9, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 'clamp(16px, 1.8vw, 20px)', fontWeight: 800, color: T.text, marginTop: 6, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

export function LabeledField({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      {children}
      {hint ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>{hint}</div> : null}
    </div>
  )
}

export function ToggleField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? T.muted : T.text, opacity: disabled ? 0.6 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <span style={{ ...mono, fontSize: 10 }}>{label}</span>
    </label>
  )
}

export function SystemAdminHierarchyWorkspaceTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: HierarchyWorkspaceTabOption[]
  activeTab: string
  onChange: (tabId: string) => void
}) {
  return (
    <div role="tablist" aria-label="Hierarchy workspace sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          id={`university-tab-${tab.id}`}
          role="tab"
          aria-controls={`university-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          data-tab="true"
          onClick={() => onChange(tab.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 8,
            border: `1px solid ${activeTab === tab.id ? T.accent : T.border}`,
            background: activeTab === tab.id ? `${T.accent}16` : 'transparent',
            color: activeTab === tab.id ? T.accentLight : T.muted,
            cursor: 'pointer',
            padding: '8px 12px',
            ...mono,
            fontSize: 10,
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function WorkspaceEntityRailItems({ universityLeftItems }: { universityLeftItems: SelectionItem[] }) {
  return (
    <>
      {universityLeftItems.map(item => (
        <button key={item.key} type="button" onClick={item.onSelect} data-pressable="true" style={{ textAlign: 'left', justifyContent: 'flex-start', display: 'grid', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.title}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>{item.subtitle}</div>
        </button>
      ))}
    </>
  )
}

export function WorkspaceMeta({
  selectedBranch,
  selectedBatch,
  activeBatchPolicyOverride,
}: {
  selectedBranch: ApiBranch | null
  selectedBatch: ApiBatch | null
  activeBatchPolicyOverride: ApiPolicyOverride | null
}) {
  return (
    <>
      {selectedBranch ? <Chip color={T.success}>{selectedBranch.programLevel}</Chip> : null}
      {selectedBatch ? <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Override active' : 'Inherited policy'}</Chip> : null}
    </>
  )
}
