import { T, mono, sora } from '@web/simulation/fixtures'
import { describeProofAvailability, describeProofProvenance, type ProofProvenanceLike } from '@web/simulation/proof-provenance'
import type { ApiSimulationStageCheckpointSummary } from '@web/shared/api/types'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { Btn, Card, Chip, getAccessiblePrimaryAccent } from '@web/shared/ui/primitives'
import type {
  PlaybackDirection,
  ProofActiveRunDetail,
  ProofQueueDiagnostics,
  ProofResetSnapshot,
} from './proof-dashboard-types'

type ProofDashboardRailProps = {
  activeRunDetail: ProofActiveRunDetail
  activeOperationalSemester: number | null
  activeQueueDiagnostics: ProofQueueDiagnostics
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  selectedProofCheckpointBlocked: boolean
  selectedProofCheckpointHasBlockedProgression: boolean
  selectedProofCheckpointCanStepForward: boolean
  selectedProofCheckpointCanPlayToEnd: boolean
  activeRunCheckpoints: ApiSimulationStageCheckpointSummary[]
  activeRunBaselineSnapshot: ProofResetSnapshot | undefined
  playbackOverridesActiveSemester: boolean
  onActivateProofSemester: (simulationRunId: string, semesterNumber: number) => void
  onStepProofPlayback: (direction: PlaybackDirection) => void
  onResetProofRunFromScratch: (simulationRunId: string, simulationResetSnapshotId?: string) => void
  onSelectProofCheckpoint: (checkpointId: string) => void
}

export function ProofDashboardRail({
  activeRunDetail,
  activeOperationalSemester,
  activeQueueDiagnostics,
  selectedProofCheckpoint,
  selectedProofCheckpointBlocked,
  selectedProofCheckpointHasBlockedProgression,
  selectedProofCheckpointCanStepForward,
  selectedProofCheckpointCanPlayToEnd,
  activeRunCheckpoints,
  activeRunBaselineSnapshot,
  playbackOverridesActiveSemester,
  onActivateProofSemester,
  onStepProofPlayback,
  onResetProofRunFromScratch,
  onSelectProofCheckpoint,
}: ProofDashboardRailProps) {
  const accessibleRailEyebrowColor = getAccessiblePrimaryAccent()
  const availableOperationalSemesters = Array.from(new Set(
    activeRunCheckpoints
      .map(item => item.semesterNumber)
      .filter((value): value is number => Number.isFinite(value)),
  )).sort((left, right) => left - right)
  const dashboardProvenance: ProofProvenanceLike | null = activeRunDetail
    ? {
        scopeDescriptor: {
          scopeType: 'proof',
          scopeId: selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail.simulationRunId,
          label: selectedProofCheckpoint ? `System admin proof route · ${selectedProofCheckpoint.stageLabel}` : 'System admin proof route',
          batchId: null,
          sectionCode: null,
          branchName: null,
          simulationRunId: activeRunDetail.simulationRunId,
          simulationStageCheckpointId: selectedProofCheckpoint?.simulationStageCheckpointId ?? null,
          studentId: null,
        },
        resolvedFrom: {
          kind: selectedProofCheckpoint ? 'proof-checkpoint' : 'proof-run',
          scopeType: 'proof',
          scopeId: selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail.simulationRunId,
          label: selectedProofCheckpoint ? `${selectedProofCheckpoint.stageLabel} · ${activeRunDetail.runLabel}` : activeRunDetail.runLabel,
        },
        scopeMode: 'proof',
        countSource: selectedProofCheckpoint ? 'proof-checkpoint' : 'proof-run',
        activeOperationalSemester,
      }
    : null
  const selectedCheckpointBlockingQueueItemCount = selectedProofCheckpoint
    ? Number(selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0)
    : 0
  const selectedCheckpointLocallyBlocked = !!selectedProofCheckpoint && (
    selectedProofCheckpoint.stageAdvanceBlocked === true
    || selectedCheckpointBlockingQueueItemCount > 0
  )
  const selectedCheckpointBlockedByEarlierCheckpoint = !!selectedProofCheckpoint && (
    selectedProofCheckpoint.playbackAccessible === false
    && !selectedCheckpointLocallyBlocked
    && !!selectedProofCheckpoint.blockedByCheckpointId
  )
  const selectedCheckpointBannerBlocked = !!selectedProofCheckpoint && (
    selectedProofCheckpointBlocked
    || selectedProofCheckpointHasBlockedProgression
    || selectedCheckpointLocallyBlocked
    || selectedCheckpointBlockedByEarlierCheckpoint
  )
  const selectedCheckpointBannerMessage = selectedProofCheckpoint
    ? `Viewing Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}. ${
      selectedCheckpointLocallyBlocked
        ? 'Resolve every task at this stage before moving forward.'
        : selectedCheckpointBlockedByEarlierCheckpoint
          ? `Earlier checkpoint is blocking playback progression: ${selectedProofCheckpoint.blockedByCheckpointId}.${selectedProofCheckpoint.blockedProgressionReason ? ` ${selectedProofCheckpoint.blockedProgressionReason}` : ''}`
          : selectedProofCheckpointHasBlockedProgression
            ? 'Earlier checkpoint is blocking playback progression. Resolve prior queue items before moving forward.'
            : 'This preview is synced to the faculty and HoD proof pages.'
    }`
    : ''

  return (
    <Card data-proof-section="proof-dashboard-rail" style={{ padding: 12, background: T.surface, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 220, flex: 1 }}>
          <div style={{ ...mono, fontSize: 10, color: accessibleRailEyebrowColor }}>Stage controls</div>
          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Keep the live semester and selected stage in view.</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
            Use these controls to choose the live semester, step through the preview, and inspect the selected stage without switching tabs.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip color={T.success}>Run {activeRunDetail.runLabel}</Chip>
          <Chip color={activeOperationalSemester != null ? T.accent : T.dim}>
            {activeOperationalSemester != null ? `Semester ${activeOperationalSemester}` : 'Semester unavailable'}
          </Chip>
          <Chip color={selectedProofCheckpoint ? T.warning : T.dim}>
            {selectedProofCheckpoint ? `${selectedProofCheckpoint.stageLabel} · S${selectedProofCheckpoint.semesterNumber}` : 'No checkpoint selected'}
          </Chip>
          <Chip color={T.dim}>{`${activeQueueDiagnostics?.queuedRunCount ?? 0} queued`}</Chip>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ ...mono, fontSize: 10, color: T.dim }}>Live semester</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2, scrollbarGutter: 'stable' }}>
          {availableOperationalSemesters.map(semesterNumber => (
            <Btn
              key={semesterNumber}
              size="sm"
              variant={semesterNumber === activeOperationalSemester ? 'solid' : 'ghost'}
              dataProofAction={`proof-activate-semester-${semesterNumber}`}
              disabled={semesterNumber === activeOperationalSemester}
              onClick={() => onActivateProofSemester(activeRunDetail.simulationRunId, semesterNumber)}
            >
              Sem {semesterNumber}
            </Btn>
          ))}
        </div>
      </div>

      {selectedProofCheckpoint ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 4, minWidth: 220, flex: 1 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Selected checkpoint</div>
              <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.7 }}>
                Semester {selectedProofCheckpoint.semesterNumber} · {selectedProofCheckpoint.stageLabel} · {selectedProofCheckpoint.stageDescription}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn
                size="sm"
                variant="ghost"
                dataProofAction="proof-playback-reset"
                onClick={() => onStepProofPlayback('start')}
                disabled={activeRunCheckpoints.length === 0 || selectedProofCheckpoint.simulationStageCheckpointId === activeRunCheckpoints[0]?.simulationStageCheckpointId}
              >
                Reset Preview To Start
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                dataProofAction="proof-run-reset-from-scratch"
                onClick={() => onResetProofRunFromScratch(activeRunDetail.simulationRunId, activeRunBaselineSnapshot?.simulationResetSnapshotId)}
                disabled={!activeRunBaselineSnapshot}
              >
                Reset Full Preview
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                dataProofAction="proof-playback-previous"
                onClick={() => onStepProofPlayback('previous')}
                disabled={!selectedProofCheckpoint.previousCheckpointId}
              >
                Preview Previous Checkpoint
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                dataProofAction="proof-playback-next"
                onClick={() => onStepProofPlayback('next')}
                disabled={!selectedProofCheckpointCanStepForward || !selectedProofCheckpoint.nextCheckpointId}
              >
                Preview Next Checkpoint
              </Btn>
              <Btn
                size="sm"
                dataProofAction="proof-playback-end"
                onClick={() => onStepProofPlayback('end')}
                disabled={!selectedProofCheckpointCanPlayToEnd}
              >
                Jump To Latest Stage
              </Btn>
            </div>
          </div>

          <div data-proof-section="selected-checkpoint-banner">
            <InfoBanner
              tone={selectedCheckpointBannerBlocked ? 'error' : 'neutral'}
              message={selectedCheckpointBannerMessage}
            />
          </div>

          <div data-proof-section="checkpoint-buttons" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2, scrollbarGutter: 'stable' }}>
            {activeRunCheckpoints.map(item => (
              <Btn
                key={item.simulationStageCheckpointId}
                size="sm"
                dataProofAction="proof-select-checkpoint"
                dataProofEntityId={item.simulationStageCheckpointId}
                variant={item.simulationStageCheckpointId === selectedProofCheckpoint.simulationStageCheckpointId ? 'primary' : 'ghost'}
                onClick={() => onSelectProofCheckpoint(item.simulationStageCheckpointId)}
              >
                {`S${item.semesterNumber} · ${item.stageLabel}${item.playbackAccessible === false ? ' · blocked' : ''}`}
              </Btn>
            ))}
          </div>
        </>
      ) : null}

      {dashboardProvenance ? (
        <details data-proof-section="proof-dashboard-scope-details">
          <summary style={{ ...mono, fontSize: 10, color: T.dim, cursor: 'pointer' }}>Why these numbers match</summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{describeProofProvenance(dashboardProvenance)}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>{describeProofAvailability(dashboardProvenance)}</div>
            {playbackOverridesActiveSemester ? (
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                You are viewing Semester {selectedProofCheckpoint?.semesterNumber} · {selectedProofCheckpoint?.stageLabel}. Live operations stay on Semester {activeOperationalSemester}.
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </Card>
  )
}
