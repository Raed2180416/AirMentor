import { Shield } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { Role } from '@kernel/shared/domain'
import type { ApiStudentAgentCard } from '@web/shared/api/types'
import { describeProofAvailability, describeProofProvenance } from '@web/simulation/proof-provenance'
import { ProofSurfaceHero, ProofSurfaceLauncher } from '@web/simulation/proof-surface-shell'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'

export function StudentShellHeader({ card, role }: { card: ApiStudentAgentCard; role: Role }) {
  return (
    <>
      <ProofSurfaceHero
        surface="student-shell"
        entityId={card.checkpointContext?.simulationStageCheckpointId ?? undefined}
        studentId={card.student.studentId}
        eyebrow="Student Shell"
        title={`${card.student.studentName} · proof snapshot`}
        description={card.disclaimer}
        icon={<Shield size={22} color={T.accent} />}
        badges={(
          <>
            <Chip color={T.accent}>{role}</Chip>
            <Chip color={T.success}>{card.runContext.runLabel}</Chip>
            <Chip color={T.warning}>Seed {card.runContext.seed}</Chip>
            {card.checkpointContext ? <Chip color={T.orange}>{`Sem ${card.checkpointContext.semesterNumber} · ${card.checkpointContext.stageLabel}`}</Chip> : null}
          </>
        )}
        notices={(
          <>
            <InfoBanner message={`Viewing ${card.runContext.runLabel} · ${card.runContext.status} · created ${new Date(card.runContext.createdAt).toLocaleString('en-IN')}${card.checkpointContext ? ` · Semester ${card.checkpointContext.semesterNumber} · ${card.checkpointContext.stageLabel}` : ''}.`} />
            <div data-proof-section="authority-banner">
              <InfoBanner message="This student proof page keeps the summary, timeline, and chat on the same saved snapshot. It cannot edit live records or reveal hidden model state." />
              <InfoBanner tone="neutral" message={describeProofProvenance(card)} />
              <InfoBanner tone="neutral" message={describeProofAvailability(card)} />
            </div>
          </>
        )}
      />

      <ProofSurfaceLauncher
        targetId="student-shell-proof-controls"
        label="Jump to student proof controls"
        dataProofEntityId={card.student.studentId}
        popupTitle="Student proof control surface"
        popupCaption={card.checkpointContext
          ? `Semester ${card.checkpointContext.semesterNumber} · ${card.checkpointContext.stageLabel}`
          : `Run ${card.runContext.runLabel}`}
      popupContent={() => (
        <div style={{ display: 'grid', gap: 12 }}>
            <InfoBanner message="Compare the current status, the no-action view, and the recorded intervention history together. All three come from the same selected proof snapshot." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current status</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{card.overview.currentStatus.riskBand ?? 'Unavailable'}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{card.overview.currentStatus.recommendedAction ?? 'No action'}</div>
              </Card>
              <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>No-action view</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{card.counterfactual?.noActionRiskBand ?? 'Unavailable'}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{card.counterfactual?.counterfactualLiftScaled != null ? `Counterfactual lift ${card.counterfactual.counterfactualLiftScaled > 0 ? '+' : ''}${card.counterfactual.counterfactualLiftScaled} scaled points` : 'No lift reported'}</div>
              </Card>
              <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Intervention history</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{card.interventions.interventionHistory.length}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>Recorded steps on this proof path</div>
              </Card>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={T.accent}>{card.runContext.runLabel}</Chip>
              <Chip color={T.warning}>{card.summaryRail.currentRiskBand ?? 'No watch band'}</Chip>
              {card.checkpointContext ? <Chip color={T.orange}>{`Sem ${card.checkpointContext.semesterNumber}`}</Chip> : null}
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
    </>
  )
}
