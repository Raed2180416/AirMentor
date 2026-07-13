import { Shield } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofRunContext, ApiAcademicHodProofSummary } from '@web/shared/api/types'
import { describeProofProvenance } from '@web/simulation/proof-provenance'
import { ProofSurfaceHero, ProofSurfaceLauncher } from '@web/simulation/proof-surface-shell'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner, formatDateTime } from '@web/features/admin/system-admin-ui'

export function HodProofHeader({
  summary,
  activeRunContext,
  checkpointContext,
  proofProvenanceSummary,
  onOpenQueueHistory,
  onRecomputeProofRunRisk,
}: {
  summary: ApiAcademicHodProofSummary
  activeRunContext: ApiAcademicHodProofRunContext
  checkpointContext: ApiAcademicHodProofRunContext['checkpointContext']
  proofProvenanceSummary: ApiAcademicHodProofSummary
  onOpenQueueHistory: () => void
  onRecomputeProofRunRisk?: (runId: string, opts?: { refreshWorkspace?: boolean }) => Promise<void> | void
}) {
  return (
    <>
      <ProofSurfaceHero
        surface="hod-proof-analytics"
        entityId={checkpointContext?.simulationStageCheckpointId ?? undefined}
        eyebrow="Live HoD Analytics"
        title="Department proof records for the active simulation run"
        description="Read-only oversight view using the same proof snapshot as sysadmin and faculty pages. This page explains the current watchlist without exposing hidden model internals."
        icon={<Shield size={22} color={T.accent} />}
        headerActions={(
          <>
            {onRecomputeProofRunRisk && activeRunContext ? (
              <Btn size="sm" variant="ghost" onClick={() => onRecomputeProofRunRisk(activeRunContext.simulationRunId, { refreshWorkspace: true })}>Recompute Risk</Btn>
            ) : null}
            <Btn size="sm" variant="ghost" onClick={onOpenQueueHistory}>Queue History</Btn>
          </>
        )}
        badges={(
          <>
            <Chip color={T.accent}>{activeRunContext.batchLabel}</Chip>
            <Chip color={T.success}>{activeRunContext.branchName ?? 'Branch scope pending'}</Chip>
            <Chip color={T.warning}>{activeRunContext.status}</Chip>
            {checkpointContext ? <Chip color={T.orange}>{`Sem ${checkpointContext.semesterNumber} · ${checkpointContext.stageLabel}`}</Chip> : null}
            {summary.scope.departmentNames.map(name => <Chip key={name} color={T.muted}>{name}</Chip>)}
            {summary.scope.branchNames.map(name => <Chip key={name} color={T.dim}>{name}</Chip>)}
          </>
        )}
        notices={(
          <>
            <InfoBanner message={`Simulation run started ${formatDateTime(activeRunContext.createdAt)}${checkpointContext ? ` — pinned to Semester ${checkpointContext.semesterNumber} · ${checkpointContext.stageLabel}` : ''}.`} />
            <InfoBanner tone="neutral" message={describeProofProvenance(proofProvenanceSummary)} />
          </>
        )}
      >
        {checkpointContext ? (
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Read-only checkpoint overlay active: {checkpointContext.stageDescription}. This HoD surface shows the same selected playback checkpoint as the teaching proof overlay{checkpointContext.stageAdvanceBlocked ? ' and respects the blocked progression state.' : ''}.
          </div>
        ) : null}
      </ProofSurfaceHero>

      <ProofSurfaceLauncher
        targetId="hod-proof-controls"
        label="Jump to HoD proof controls"
        popupTitle="HoD proof control surface"
        popupCaption={checkpointContext
          ? `${activeRunContext.batchLabel} · Sem ${checkpointContext.semesterNumber} · ${checkpointContext.stageLabel}`
          : activeRunContext.batchLabel}
        popupContent={() => (
          <div style={{ display: 'grid', gap: 12 }}>
            <InfoBanner message="Review open reassessments, acknowledgements, and unresolved alerts from the same selected proof snapshot before acting on the watchlist." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open reassessments</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{summary.monitoringSummary.activeReassessmentCount}</div>
              </Card>
              <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acknowledgements</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{summary.monitoringSummary.acknowledgementCount}</div>
              </Card>
              <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unresolved alerts</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{summary.totals.unresolvedAlertCount}</div>
              </Card>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={T.accent}>{activeRunContext.runLabel}</Chip>
              <Chip color={T.warning}>{`High ${summary.totals.highRiskCount}`}</Chip>
              <Chip color={T.success}>{`Resolved ${summary.totals.resolvedAlertCount}`}</Chip>
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
