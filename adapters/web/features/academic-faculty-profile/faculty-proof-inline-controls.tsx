import { T, mono, sora } from '@web/simulation/fixtures'
import { ProofSimulationControls, type ProofPlaybackControlDirection } from '@web/simulation/proof-simulation-controls'
import { Btn, Card } from '@web/shared/ui/primitives'
import type { ProofCheckpoint, ProofOps, ProofRunContext } from './profile-helpers'

type FacultyProofInlineControlsProps = {
  proofOps: ProofOps
  activeProofRun: ProofRunContext
  activeRunCheckpoints: ProofCheckpoint[]
  selectedProofCheckpoint: ProofCheckpoint | null
  onAdvanceProofRun: (simulationRunId: string, mode: 'day' | 'previous-day' | 'stage') => void
  onStopProofRun?: (simulationRunId: string) => void
  onStepProofPlayback: (direction: ProofPlaybackControlDirection) => void
}

export function FacultyProofInlineControls({
  proofOps,
  activeProofRun,
  activeRunCheckpoints,
  selectedProofCheckpoint,
  onAdvanceProofRun,
  onStopProofRun,
  onStepProofPlayback,
}: FacultyProofInlineControlsProps) {
  return (
    <Card data-proof-section="teacher-proof-inline-controls" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Shared Proof Controls
          </div>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 6 }}>
            Semester {selectedProofCheckpoint?.semesterNumber ?? proofOps.activeOperationalSemester ?? 'NA'} · {selectedProofCheckpoint?.stageLabel ?? 'Current checkpoint'}
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.7 }}>
            Advance stages, step playback, or stop the active proof run here before diving into the detailed teacher proof evidence below.
          </div>
        </div>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => {
            if (typeof document === 'undefined') return
            document.getElementById('teacher-proof-panel-surface')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          Open Detailed Proof Panel
        </Btn>
      </div>
      <ProofSimulationControls
        activeRunDetail={activeProofRun}
        activeRunCheckpoints={activeRunCheckpoints}
        selectedProofCheckpoint={selectedProofCheckpoint}
        selectedProofCheckpointCanStepForward={Boolean(selectedProofCheckpoint?.nextCheckpointId)}
        selectedProofCheckpointCanPlayToEnd={Boolean(selectedProofCheckpoint?.nextCheckpointId)}
        baselineSnapshot={null}
        resetStageSnapshot={null}
        createDisabled
        stopDisabled={!onStopProofRun}
        onCreateProofSimulation={() => undefined}
        onStopProofRun={onStopProofRun ?? (() => undefined)}
        onAdvanceProofRun={onAdvanceProofRun}
        onRestoreProofSnapshot={() => undefined}
        onResetProofRunFromScratch={() => undefined}
        onStepProofPlayback={onStepProofPlayback}
      />
    </Card>
  )
}
