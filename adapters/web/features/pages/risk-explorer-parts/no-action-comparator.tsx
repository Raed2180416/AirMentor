import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentRiskExplorer } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'

export function NoActionComparatorCard({ explorer }: { explorer: ApiStudentRiskExplorer }) {
  const counterfactual = explorer.counterfactual
  return (
    <Card data-proof-section="no-action-comparator" style={{ padding: 16, display: 'grid', gap: 10, marginTop: 14 }}>
      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>No-Action Comparator</div>
      {counterfactual ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {counterfactual.noActionRiskBand ? <Chip color={T.warning}>{counterfactual.noActionRiskBand}</Chip> : null}
            {counterfactual.noActionRiskProbScaled != null ? <Chip color={T.dim}>{`${counterfactual.noActionRiskProbScaled}% no action`}</Chip> : null}
            {counterfactual.counterfactualLiftScaled != null ? <Chip color={counterfactual.counterfactualLiftScaled > 0 ? T.success : counterfactual.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`${counterfactual.counterfactualLiftScaled > 0 ? '+' : ''}${counterfactual.counterfactualLiftScaled} pts`}</Chip> : null}
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{counterfactual.note}</div>
        </>
      ) : (
        <div style={{ ...mono, fontSize: 10, color: T.muted }}>No checkpoint-bound no-action comparator is available on the active-risk view.</div>
      )}
    </Card>
  )
}
