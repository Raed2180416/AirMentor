import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiFeatureCompleteness, ApiStudentRiskExplorer } from '@web/shared/api/types'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { ProofSurfaceLauncher } from '@web/simulation/proof-surface-shell'
import { Btn, Card } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { renderFeatureCompletenessLabel } from './helpers'

export function RiskExplorerLauncher({
  explorer,
  featureCompleteness,
}: {
  explorer: ApiStudentRiskExplorer
  featureCompleteness: ApiFeatureCompleteness | null
}) {
  return (
    <ProofSurfaceLauncher
      targetId="risk-explorer-proof-controls"
      label="Jump to risk proof controls"
      dataProofEntityId={explorer.student.studentId}
      popupTitle="Risk proof control surface"
      popupCaption={explorer.checkpointContext
        ? `Semester ${explorer.checkpointContext.semesterNumber} · ${explorer.checkpointContext.stageLabel}`
        : explorer.runContext.runLabel}
      popupContent={() => (
        <div style={{ display: 'grid', gap: 12 }}>
          <InfoBanner message="Read the current risk view, no-action view, and intervention path together. This popup stays locked to the selected proof run and stage." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current status</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{explorer.currentStatus.riskBand ?? 'Unavailable'}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{humanLabelForActionCode(explorer.currentStatus.recommendedAction) ?? 'No simulated intervention'}</div>
            </Card>
            <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>No-action comparator</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{explorer.counterfactual?.noActionRiskBand ?? 'Unavailable'}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{explorer.counterfactual?.counterfactualLiftScaled != null ? `${explorer.counterfactual.counterfactualLiftScaled > 0 ? '+' : ''}${explorer.counterfactual.counterfactualLiftScaled} scaled points` : 'No lift reported'}</div>
            </Card>
            <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feature completeness</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{renderFeatureCompletenessLabel(featureCompleteness)}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{featureCompleteness?.missing.join(' · ') || 'No missing dimensions'}</div>
            </Card>
          </div>
        </div>
      )}
      popupFooter={({ closePopup, jumpToTarget }) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn size="sm" variant="ghost" onClick={jumpToTarget}>Open proof controls</Btn>
          <Btn size="sm" variant="ghost" onClick={closePopup}>Close</Btn>
        </div>
      )}
    />
  )
}
