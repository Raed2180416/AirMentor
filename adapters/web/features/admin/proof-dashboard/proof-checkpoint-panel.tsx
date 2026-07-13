import { motion } from 'framer-motion'
import type { Dispatch, SetStateAction } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiProofRunCheckpointDetail, ApiSimulationStageCheckpointSummary } from '@web/shared/api/types'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { ProofSurfaceTabPanel } from '@web/simulation/proof-surface-shell'
import { ScrollCard } from './proof-dashboard-cards'
import type { CheckpointEvidenceView, ProofDashboardTabId } from './proof-dashboard-types'

type ProofCheckpointPanelProps = {
  activeTab: ProofDashboardTabId
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  selectedProofCheckpointDetail: ApiProofRunCheckpointDetail | null
  activeCheckpointEvidenceView: CheckpointEvidenceView
  setActiveCheckpointEvidenceView: Dispatch<SetStateAction<CheckpointEvidenceView>>
  hasQueuePreview: boolean
  hasOfferingRollups: boolean
}

export function ProofCheckpointPanel({
  activeTab,
  selectedProofCheckpoint,
  selectedProofCheckpointDetail,
  activeCheckpointEvidenceView,
  setActiveCheckpointEvidenceView,
  hasQueuePreview,
  hasOfferingRollups,
}: ProofCheckpointPanelProps) {
  return (
    <ProofSurfaceTabPanel
      idBase="system-admin-proof-dashboard"
      tabId="checkpoint"
      activeTab={activeTab}
      sectionId="proof-dashboard-checkpoint"
      minHeight={320}
      style={{ gap: 12 }}
    >
      {selectedProofCheckpoint ? (
        <Card data-proof-section="checkpoint-playback" style={{ padding: 12, background: T.surface, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Checkpoint Playback</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                Evidence for the selected checkpoint. Use the proof rail above to step playback or switch checkpoints.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn
                size="sm"
                variant={activeCheckpointEvidenceView === 'queue' ? 'primary' : 'ghost'}
                onClick={() => setActiveCheckpointEvidenceView('queue')}
                disabled={!hasQueuePreview}
              >
                Queue Detail
              </Btn>
              <Btn
                size="sm"
                variant={activeCheckpointEvidenceView === 'offerings' ? 'primary' : 'ghost'}
                onClick={() => setActiveCheckpointEvidenceView('offerings')}
                disabled={!hasOfferingRollups}
              >
                Offering Detail
              </Btn>
            </div>
          </div>

          <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Card style={{ padding: 12, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Risk Snapshot</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {selectedProofCheckpoint.highRiskCount ?? 0} high · {selectedProofCheckpoint.mediumRiskCount ?? 0} medium · {selectedProofCheckpoint.lowRiskCount ?? 0} low
              </div>
            </Card>
            <Card style={{ padding: 12, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queue State</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {selectedProofCheckpoint.openQueueCount ?? 0} open · {selectedProofCheckpoint.watchQueueCount ?? 0} watch · {selectedProofCheckpoint.resolvedQueueCount ?? 0} resolved
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0} blocking students · {selectedProofCheckpoint.watchStudentCount ?? 0} watched students
              </div>
              {selectedProofCheckpoint.stageAdvanceBlocked ? (
                <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 4, lineHeight: 1.6 }}>
                  Stage progression blocked{selectedProofCheckpoint.blockedProgressionReason ? ` · ${selectedProofCheckpoint.blockedProgressionReason}` : ''}.
                </div>
              ) : null}
            </Card>
            <Card style={{ padding: 12, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Risk Movement</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {selectedProofCheckpoint.averageRiskChangeFromPreviousCheckpointScaled ?? selectedProofCheckpoint.averageRiskDeltaScaled ?? 0} scaled points
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {selectedProofCheckpoint.noActionHighRiskCount ?? 0} no-action high-risk rows
              </div>
            </Card>
            <Card style={{ padding: 12, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Counterfactual Lift</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                {selectedProofCheckpoint.averageCounterfactualLiftScaled ?? 0} scaled points
              </div>
            </Card>
          </motion.div>

          <ScrollCard
            title={activeCheckpointEvidenceView === 'offerings' ? 'Offering action summary' : 'Stage queue preview'}
            eyebrow="Playback evidence"
            maxHeight={300}
          >
            {activeCheckpointEvidenceView === 'offerings'
              ? selectedProofCheckpointDetail?.offeringRollups.length ? selectedProofCheckpointDetail.offeringRollups.slice(0, 8).map(item => {
                const projection = item.projection
                const averageRisk = typeof projection.averageRiskProbScaled === 'number' ? projection.averageRiskProbScaled : null
                const openQueueCount = typeof projection.openQueueCount === 'number' ? projection.openQueueCount : null
                return (
                  <Card key={item.simulationStageOfferingProjectionId} style={{ padding: 10, background: T.surface }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · Section {item.sectionCode}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                      {item.pendingAction ?? 'No pending action'}{averageRisk != null ? ` · avg risk ${averageRisk}%` : ''}{openQueueCount != null ? ` · open queue ${openQueueCount}` : ''}.
                    </div>
                    {typeof projection.coEvidenceMode === 'string' && projection.coEvidenceMode.length > 0 ? (
                      <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                        CO evidence mode: {projection.coEvidenceMode}.
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {typeof projection.riskChangeFromPreviousCheckpointScaled === 'number' ? <Chip color={projection.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : projection.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${projection.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${projection.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                      {typeof projection.counterfactualLiftScaled === 'number' ? <Chip color={projection.counterfactualLiftScaled > 0 ? T.success : projection.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${projection.counterfactualLiftScaled > 0 ? '+' : ''}${projection.counterfactualLiftScaled}`}</Chip> : null}
                    </div>
                  </Card>
                )
              }) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No offering rollups are available for this checkpoint.</div>
              : selectedProofCheckpointDetail?.queuePreview.length ? selectedProofCheckpointDetail.queuePreview.slice(0, 8).map(item => (
                <Card key={item.simulationStageQueueProjectionId} style={{ padding: 10, background: T.surface }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · {item.assignedToRole} · {item.riskBand} · {item.status}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                    {item.taskType} · action {humanLabelForActionCode(item.simulatedActionTaken ?? item.recommendedAction) ?? 'none'} · risk {item.riskProbScaled}%{item.noActionRiskProbScaled != null ? ` vs no-action ${item.noActionRiskProbScaled}%` : ''}.
                  </div>
                  {item.coEvidenceMode ? (
                    <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                      CO evidence mode: {item.coEvidenceMode}.
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {item.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={item.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : item.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${item.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${item.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                    {item.counterfactualLiftScaled != null ? <Chip color={item.counterfactualLiftScaled > 0 ? T.success : item.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${item.counterfactualLiftScaled > 0 ? '+' : ''}${item.counterfactualLiftScaled}`}</Chip> : null}
                  </div>
                </Card>
              )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No stage queue items exist at this checkpoint.</div>}
          </ScrollCard>
        </Card>
      ) : (
        <InfoBanner message="Select a checkpoint to inspect playback, queue, and offering rollups." />
      )}
    </ProofSurfaceTabPanel>
  )
}
