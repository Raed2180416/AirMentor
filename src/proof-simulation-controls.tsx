import type { ApiProofDashboard, ApiSimulationStageCheckpointSummary } from './api/types'
import { Btn } from './ui-primitives'

type ProofActiveRunDetail = NonNullable<ApiProofDashboard['activeRunDetail']>
type ProofRunSnapshot = ProofActiveRunDetail['snapshots'][number]
export type ProofAdvanceControlMode = 'day' | 'stage'

type ProofSimulationControlsProps = {
  activeRunDetail: ProofActiveRunDetail | null
  activeRunCheckpoints: ApiSimulationStageCheckpointSummary[]
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  selectedProofCheckpointCanStepForward: boolean
  selectedProofCheckpointCanPlayToEnd: boolean
  baselineSnapshot?: ProofRunSnapshot | null
  resetStageSnapshot?: ProofRunSnapshot | null
  createDisabled?: boolean
  onCreateProofSimulation: () => void
  onStopProofRun: (simulationRunId: string) => void
  onAdvanceProofRun: (simulationRunId: string, mode: ProofAdvanceControlMode) => void
  onRestoreProofSnapshot: (simulationRunId: string, simulationResetSnapshotId?: string) => void
  onResetProofRunFromScratch: (simulationRunId: string, simulationResetSnapshotId?: string) => void
  onStepProofPlayback: (direction: 'previous' | 'next' | 'start' | 'end') => void
  beforeAction?: () => void
}

export function ProofSimulationControls({
  activeRunDetail,
  activeRunCheckpoints,
  selectedProofCheckpoint,
  selectedProofCheckpointCanStepForward,
  selectedProofCheckpointCanPlayToEnd,
  baselineSnapshot,
  resetStageSnapshot,
  createDisabled = false,
  onCreateProofSimulation,
  onStopProofRun,
  onAdvanceProofRun,
  onRestoreProofSnapshot,
  onResetProofRunFromScratch,
  onStepProofPlayback,
  beforeAction,
}: ProofSimulationControlsProps) {
  const runId = activeRunDetail?.simulationRunId ?? null
  const selectedIsFirst = !!selectedProofCheckpoint && selectedProofCheckpoint.simulationStageCheckpointId === activeRunCheckpoints[0]?.simulationStageCheckpointId
  const runAction = (action: () => void) => {
    beforeAction?.()
    action()
  }

  if (!runId) {
    return (
      <Btn
        size="sm"
        dataProofAction="proof-create-simulation"
        disabled={createDisabled}
        onClick={() => runAction(onCreateProofSimulation)}
      >
        Create Proof Run
      </Btn>
    )
  }

  return (
    <>
      <Btn
        size="sm"
        variant="danger"
        dataProofAction="proof-stop-simulation"
        onClick={() => runAction(() => onStopProofRun(runId))}
      >
        Stop Proof Run
      </Btn>
      <Btn
        size="sm"
        dataProofAction="proof-next-stage"
        onClick={() => runAction(() => onAdvanceProofRun(runId, 'stage'))}
      >
        Next Stage
      </Btn>
      <Btn
        size="sm"
        dataProofAction="proof-next-day"
        onClick={() => runAction(() => onAdvanceProofRun(runId, 'day'))}
      >
        Next Day
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        dataProofAction="proof-previous-day"
        onClick={() => runAction(() => onStepProofPlayback('previous'))}
        disabled={!selectedProofCheckpoint?.previousCheckpointId}
      >
        Previous Day
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        dataProofAction="proof-previous-stage"
        onClick={() => runAction(() => onStepProofPlayback('previous'))}
        disabled={!selectedProofCheckpoint?.previousCheckpointId}
      >
        Previous Stage
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        dataProofAction="proof-reset-stage"
        onClick={() => runAction(() => onRestoreProofSnapshot(runId, resetStageSnapshot?.simulationResetSnapshotId))}
        disabled={!resetStageSnapshot}
      >
        Reset Stage
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        dataProofAction="proof-reset-simulation"
        onClick={() => runAction(() => onResetProofRunFromScratch(runId, baselineSnapshot?.simulationResetSnapshotId))}
        disabled={!baselineSnapshot}
      >
        Reset Proof Run
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        dataProofAction="proof-playback-next"
        onClick={() => runAction(() => onStepProofPlayback('next'))}
        disabled={!selectedProofCheckpointCanStepForward || !selectedProofCheckpoint?.nextCheckpointId}
      >
        Preview Next Checkpoint
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        dataProofAction="proof-playback-end"
        onClick={() => runAction(() => onStepProofPlayback('end'))}
        disabled={!selectedProofCheckpointCanPlayToEnd}
      >
        Jump To Latest Stage
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        dataProofAction="proof-playback-reset"
        onClick={() => runAction(() => onStepProofPlayback('start'))}
        disabled={activeRunCheckpoints.length === 0 || selectedIsFirst}
      >
        Reset Playback
      </Btn>
    </>
  )
}
