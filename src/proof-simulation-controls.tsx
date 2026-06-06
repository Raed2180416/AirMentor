import { useState } from 'react'
import type { ApiSimulationStageCheckpointSummary } from './api/types'
import { Btn } from './ui-primitives'

type ProofActiveRunDetail = {
  simulationRunId: string
}
type ProofRunSnapshot = {
  simulationResetSnapshotId: string
}
export type ProofAdvanceControlMode = 'day' | 'previous-day' | 'stage'
export type ProofPlaybackControlDirection = 'previous' | 'next' | 'start' | 'end'
type ProofControlActionResult = void | Promise<void>

type ProofSimulationControlsProps = {
  activeRunDetail: ProofActiveRunDetail | null
  activeRunCheckpoints: ApiSimulationStageCheckpointSummary[]
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  selectedProofCheckpointCanStepForward: boolean
  selectedProofCheckpointCanPlayToEnd: boolean
  baselineSnapshot?: ProofRunSnapshot | null
  resetStageSnapshot?: ProofRunSnapshot | null
  createDisabled?: boolean
  stopDisabled?: boolean
  showStopControl?: boolean
  showDayControls?: boolean
  showPlaybackControls?: boolean
  showResetControls?: boolean
  onCreateProofSimulation: () => ProofControlActionResult
  onStopProofRun: (simulationRunId: string) => ProofControlActionResult
  onAdvanceProofRun: (simulationRunId: string, mode: ProofAdvanceControlMode) => ProofControlActionResult
  onRestoreProofSnapshot: (simulationRunId: string, simulationResetSnapshotId?: string) => ProofControlActionResult
  onResetProofRunFromScratch: (simulationRunId: string, simulationResetSnapshotId?: string) => ProofControlActionResult
  onStepProofPlayback: (direction: ProofPlaybackControlDirection) => ProofControlActionResult
  onRecomputeProofRunRisk?: () => ProofControlActionResult
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
  stopDisabled = false,
  showStopControl = true,
  showDayControls = true,
  showPlaybackControls = true,
  showResetControls = true,
  onCreateProofSimulation,
  onStopProofRun,
  onAdvanceProofRun,
  onRestoreProofSnapshot,
  onResetProofRunFromScratch,
  onStepProofPlayback,
  onRecomputeProofRunRisk,
  beforeAction,
}: ProofSimulationControlsProps) {
  const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null)
  const runId = activeRunDetail?.simulationRunId ?? null
  const selectedIsFirst = !!selectedProofCheckpoint && selectedProofCheckpoint.simulationStageCheckpointId === activeRunCheckpoints[0]?.simulationStageCheckpointId
  const advanceDisabled = activeRunCheckpoints.length === 0 && !selectedProofCheckpoint
  const actionLocked = pendingActionLabel != null
  const runAction = (label: string, action: () => ProofControlActionResult) => {
    beforeAction?.()
    const result = action()
    if (result && typeof result === 'object' && typeof result.then === 'function') {
      setPendingActionLabel(label)
      void result.catch((err) => {
        console.error('Proof control action failed:', err)
        alert(`Action failed: ${err instanceof Error ? err.message : String(err)}`)
      }).finally(() => setPendingActionLabel(null))
    }
  }
  const renderLabel = (idleLabel: string, pendingLabel: string) => pendingActionLabel === pendingLabel ? `${pendingLabel}...` : idleLabel
  const pendingNotice = pendingActionLabel ? (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        opacity: 0.86,
        animation: 'pulse 1s ease-in-out infinite',
      }}
    >
      Working… {pendingActionLabel}
    </span>
  ) : null

  if (!runId) {
    return (
      <>
        <Btn
          size="sm"
          dataProofAction="proof-create-simulation"
          disabled={createDisabled || actionLocked}
          onClick={() => runAction('Creating Proof Run', onCreateProofSimulation)}
        >
          {renderLabel('Create Proof Run', 'Creating Proof Run')}
        </Btn>
        {pendingNotice}
      </>
    )
  }

  return (
    <>
      {showStopControl ? (
        <Btn
          size="sm"
          variant="danger"
          dataProofAction="proof-stop-simulation"
          onClick={() => runAction('Stopping Proof Run', () => onStopProofRun(runId))}
          disabled={stopDisabled || actionLocked}
        >
          {renderLabel('Stop Proof Run', 'Stopping Proof Run')}
        </Btn>
      ) : null}
      <Btn
        size="sm"
        dataProofAction="proof-next-stage"
        onClick={() => runAction('Advancing Stage', () => onAdvanceProofRun(runId, 'stage'))}
        disabled={advanceDisabled || actionLocked}
      >
        {renderLabel('Next Stage', 'Advancing Stage')}
      </Btn>
      {showDayControls ? (
        <>
          <Btn
            size="sm"
            dataProofAction="proof-next-day"
            onClick={() => runAction('Advancing Day', () => onAdvanceProofRun(runId, 'day'))}
            disabled={advanceDisabled || actionLocked}
          >
            {renderLabel('Next Day', 'Advancing Day')}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            dataProofAction="proof-previous-day"
            onClick={() => runAction('Moving Back One Day', () => onAdvanceProofRun(runId, 'previous-day'))}
            disabled={advanceDisabled || actionLocked}
          >
            {renderLabel('Previous Day', 'Moving Back One Day')}
          </Btn>
        </>
      ) : null}
      {showPlaybackControls ? (
        <>
          <Btn
            size="sm"
            variant="ghost"
            dataProofAction="proof-previous-stage"
            onClick={() => runAction('Opening Previous Stage', () => onStepProofPlayback('previous'))}
            disabled={actionLocked || !selectedProofCheckpoint?.previousCheckpointId}
          >
            {renderLabel('Previous Stage', 'Opening Previous Stage')}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            dataProofAction="proof-playback-next"
            onClick={() => runAction('Opening Next Checkpoint', () => onStepProofPlayback('next'))}
            disabled={actionLocked || !selectedProofCheckpointCanStepForward || !selectedProofCheckpoint?.nextCheckpointId}
          >
            {renderLabel('Preview Next Checkpoint', 'Opening Next Checkpoint')}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            dataProofAction="proof-playback-end"
            onClick={() => runAction('Jumping To Latest Stage', () => onStepProofPlayback('end'))}
            disabled={actionLocked || !selectedProofCheckpointCanPlayToEnd}
          >
            {renderLabel('Jump To Latest Stage', 'Jumping To Latest Stage')}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            dataProofAction="proof-playback-reset"
            onClick={() => runAction('Resetting Playback', () => onStepProofPlayback('start'))}
            disabled={actionLocked || activeRunCheckpoints.length === 0 || selectedIsFirst}
          >
            {renderLabel('Reset Playback', 'Resetting Playback')}
          </Btn>
        </>
      ) : null}
      {showResetControls ? (
        <>
          <Btn
            size="sm"
            variant="ghost"
            dataProofAction="proof-reset-stage"
            onClick={() => runAction('Resetting Stage', () => onRestoreProofSnapshot(runId, resetStageSnapshot?.simulationResetSnapshotId))}
            disabled={actionLocked || !resetStageSnapshot}
          >
            {renderLabel('Reset Stage', 'Resetting Stage')}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            dataProofAction="proof-reset-simulation"
            onClick={() => runAction('Resetting Proof Run', () => onResetProofRunFromScratch(runId, baselineSnapshot?.simulationResetSnapshotId))}
            disabled={actionLocked || !baselineSnapshot}
          >
            {renderLabel('Reset Proof Run', 'Resetting Proof Run')}
          </Btn>
        </>
      ) : null}
      {onRecomputeProofRunRisk ? (
        <Btn
          size="sm"
          variant="ghost"
          dataProofAction="proof-recompute-risk"
          onClick={() => runAction('Recomputing Risk', onRecomputeProofRunRisk)}
          disabled={actionLocked}
        >
          {renderLabel('Recompute Risk', 'Recomputing Risk')}
        </Btn>
      ) : null}
      {pendingNotice}
    </>
  )
}
