import { useEffect, useState } from 'react'
import type { Role } from '@kernel/shared/domain'
import { ReevaluatingRiskLoader } from '@web/shared/components/reevaluating-risk-loader'
import type { ApiStudentRiskExplorer } from '@web/shared/api/types'
import { ProofSurfaceTabPanel, ProofSurfaceTabs } from '@web/simulation/proof-surface-shell'
import { Btn, PageBackButton, PageShell } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner } from '@web/features/admin/system-admin-ui'
import { RiskExplorerHero } from './risk-explorer-parts/hero'
import { RiskExplorerLauncher } from './risk-explorer-parts/launcher'
import { AdvancedRiskHeads } from './risk-explorer-parts/advanced-risk-heads'
import { RiskExplorerLeftColumn } from './risk-explorer-parts/left-column'
import { RiskExplorerRightColumn } from './risk-explorer-parts/right-column'
import { NoActionComparatorCard } from './risk-explorer-parts/no-action-comparator'
import { ComponentEvidenceGrid } from './risk-explorer-parts/component-evidence-grid'

export function RiskExplorerPage({
  role,
  studentId,
  onBack,
  loadExplorer,
  initialExplorer,
  initialError = '',
  initialTab,
}: {
  role: Role
  studentId: string
  onBack: () => void
  loadExplorer?: (studentId: string) => Promise<ApiStudentRiskExplorer>
  initialExplorer?: ApiStudentRiskExplorer | null
  initialError?: string
  initialTab?: 'overview' | 'details' | 'advanced'
}) {
  const [explorer, setExplorer] = useState<ApiStudentRiskExplorer | null>(initialExplorer ?? null)
  const [loading, setLoading] = useState(!!loadExplorer && !initialExplorer)
  const [error, setError] = useState(initialError)
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'advanced'>(initialTab ?? 'overview')

  useEffect(() => {
    if (!loadExplorer) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const result = await loadExplorer(studentId)
        if (!cancelled) setExplorer(result)
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load the risk explorer.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadExplorer, studentId])

  if (loading) {
    return (
      <PageShell size="wide">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20vh' }}>
          <ReevaluatingRiskLoader />
        </div>
      </PageShell>
    )
  }

  if (!explorer) {
    return (
      <PageShell size="wide">
        <div data-proof-surface="risk-explorer" data-proof-state={error ? 'load-error' : 'empty'} style={{ display: 'grid', gap: 12 }}>
          {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}
          <EmptyState title="Risk explorer unavailable" body={error ? 'The proof-backed risk-analysis payload failed to load for this student.' : 'A proof-backed risk-analysis payload could not be built for this student.'} />
        </div>
      </PageShell>
    )
  }

  const featureCompleteness = explorer.featureCompleteness ?? explorer.riskCompleteness ?? explorer.prerequisiteMap.completeness ?? null

  return (
    <PageShell size="wide">
      <div style={{ display: 'grid', gap: 18, paddingBottom: 28 }}>
        <PageBackButton onClick={onBack} dataProofAction="risk-explorer-back" />

        <RiskExplorerHero role={role} explorer={explorer} featureCompleteness={featureCompleteness} />

        <RiskExplorerLauncher explorer={explorer} featureCompleteness={featureCompleteness} />

        {error ? <div data-proof-section="load-error"><InfoBanner tone="error" message={error} /></div> : null}

        <ProofSurfaceTabs
          controlId="risk-explorer-proof-controls"
          idBase="risk-explorer"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'details', label: 'Assessment Details' },
            { id: 'advanced', label: 'Advanced Diagnostics' },
          ]}
          activeTab={activeTab}
          onChange={tabId => setActiveTab(tabId as 'overview' | 'details' | 'advanced')}
          ariaLabel="Risk explorer sections"
          actionName="risk-explorer-tab"
        />

        <ProofSurfaceTabPanel
          idBase="risk-explorer"
          tabId={activeTab}
          activeTab={activeTab}
          sectionId={`risk-explorer-panel-${activeTab}`}
          minHeight={420}
        >
          {activeTab === 'advanced' && (
            <AdvancedRiskHeads explorer={explorer} />
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <RiskExplorerLeftColumn explorer={explorer} activeTab={activeTab} />

            <RiskExplorerRightColumn explorer={explorer} activeTab={activeTab} />
          </div>
          {activeTab === 'advanced' && (
            <NoActionComparatorCard explorer={explorer} />
          )}
        {activeTab === 'details' && (
          <ComponentEvidenceGrid explorer={explorer} />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" dataProofAction="risk-explorer-back-bottom" onClick={onBack}>Back</Btn>
        </div>
        </ProofSurfaceTabPanel>
      </div>
      </PageShell>
  )
}
