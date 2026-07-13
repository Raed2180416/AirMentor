import { T, mono, sora } from '@web/simulation/fixtures'
import { Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { ScrollCard } from './proof-dashboard-cards'
import { formatAgeSeconds, formatLeaseState } from './proof-dashboard-helpers'
import type { ProofRunSummary } from './proof-dashboard-types'

type ProofPendingPanelProps = {
  pendingProofRun: ProofRunSummary
  proofRunStatusColor: (status: string) => string
  pendingProofRunProgressLabel: string | null
  pendingProofRunPhase: string
  pendingProofRunPercent: number
  pendingProofRunAge: string | null
}

export function ProofPendingPanel({
  pendingProofRun,
  proofRunStatusColor,
  pendingProofRunProgressLabel,
  pendingProofRunPhase,
  pendingProofRunPercent,
  pendingProofRunAge,
}: ProofPendingPanelProps) {
  return (
    <Card data-proof-section="proof-run-pending" style={{ padding: 14, background: T.surface, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 220, flex: 1 }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queued proof run</div>
          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{pendingProofRun.runLabel}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Waiting for the proof worker to build active details. The dashboard will fill in checkpoints, teacher load, and queue evidence when this run publishes.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip color={proofRunStatusColor(pendingProofRun.status)}>{pendingProofRun.status}</Chip>
          <Chip color={T.dim}>{pendingProofRunProgressLabel ?? `${pendingProofRunPhase} · ${pendingProofRunPercent}%`}</Chip>
          {pendingProofRunAge ? <Chip color={T.dim}>{pendingProofRunAge}</Chip> : null}
        </div>
      </div>
      {pendingProofRun.failureMessage ? (
        <InfoBanner tone="error" message={pendingProofRun.failureMessage} />
      ) : (
        <InfoBanner message="This is not an empty proof panel: the run exists, but worker output is not ready yet. Keep this page open; live polling will refresh the panel." />
      )}
      <ScrollCard title="Runs" eyebrow="Worker state" maxHeight={190}>
        <Card style={{ padding: 10, background: T.surface2 }}>
          <div style={{ ...mono, fontSize: 10, color: T.text }}>{pendingProofRun.runLabel}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
            Seed {pendingProofRun.seed} · {pendingProofRun.status} · {pendingProofRunProgressLabel ?? `${pendingProofRunPhase} · ${pendingProofRunPercent}%`}
          </div>
          {pendingProofRun.queueAgeSeconds != null || pendingProofRun.leaseState || pendingProofRun.retryState ? (
            <div style={{ ...mono, fontSize: 10, color: pendingProofRun.leaseState === 'expired' ? T.warning : T.muted, marginTop: 4, lineHeight: 1.6 }}>
              Queue age {formatAgeSeconds(pendingProofRun.queueAgeSeconds)} · lease {formatLeaseState(pendingProofRun.leaseState)}{pendingProofRun.retryState ? ` · ${pendingProofRun.retryState}` : ''}
            </div>
          ) : null}
        </Card>
      </ScrollCard>
    </Card>
  )
}
