import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { T, mono } from '@web/simulation/fixtures'
import type { ApiSimulationStageCheckpointSummary } from '@web/shared/api/types'
import { Btn, Card } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import type { ProofActiveRunDetail, ProofQueueDiagnostics } from './proof-dashboard-types'

type ProofLauncherPopupContentProps = {
  activeRunDetail: ProofActiveRunDetail | null
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  activeOperationalSemester: number | null
  activeQueueDiagnostics: ProofQueueDiagnostics
  renderSimulationControls: () => ReactNode
}

export function ProofLauncherPopupContent({
  activeRunDetail,
  selectedProofCheckpoint,
  activeOperationalSemester,
  activeQueueDiagnostics,
  renderSimulationControls,
}: ProofLauncherPopupContentProps) {
  return activeRunDetail ? (
    <div style={{ display: 'grid', gap: 12 }}>
      <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
        <div style={{ ...mono, fontSize: 10, color: T.dim }}>Current stage</div>
        <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.7 }}>
          {selectedProofCheckpoint
            ? `Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}`
            : 'No checkpoint selected'}
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
          {selectedProofCheckpoint
            ? selectedProofCheckpoint.stageDescription
            : 'Select a checkpoint from the shared dashboard rail to inspect playback evidence.'}
        </div>
      </Card>

      <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <Card style={{ padding: 10, background: T.surface }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Live semester</div>
          <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
            {activeOperationalSemester != null ? `Semester ${activeOperationalSemester}` : 'Unavailable'}
          </div>
        </Card>
        <Card style={{ padding: 10, background: T.surface }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queue</div>
          <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
            {activeQueueDiagnostics?.queuedRunCount ?? 0} queued · {activeQueueDiagnostics?.runningRunCount ?? 0} running
          </div>
        </Card>
        <Card style={{ padding: 10, background: T.surface }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Verifications</div>
          <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
            {activeRunDetail.monitoringSummary.acknowledgementCount} acknowledgements · {activeRunDetail.monitoringSummary.resolutionCount} resolutions
          </div>
        </Card>
      </motion.div>

      <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
        <div style={{ ...mono, fontSize: 10, color: T.dim }}>Progress actions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {renderSimulationControls()}
        </div>
        <InfoBanner
          tone="neutral"
          message="Use the simulation controls to advance the proof run, inspect playback, reset the current stage, or reset the full simulation."
        />
      </Card>
    </div>
  ) : (
    <div style={{ display: 'grid', gap: 12 }}>
      <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
        <div style={{ ...mono, fontSize: 10, color: T.dim }}>No simulation yet</div>
        <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.7 }}>
          Create Proof Run will bootstrap the proof sandbox and start the first run.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {renderSimulationControls()}
        </div>
      </Card>
    </div>
  )
}

export const launcherPopupFooter = ({ closePopup, jumpToTarget }: { closePopup: () => void; jumpToTarget: () => void }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
    <Btn size="sm" variant="ghost" onClick={jumpToTarget}>Open full dashboard</Btn>
    <Btn size="sm" variant="ghost" onClick={closePopup}>Close</Btn>
  </div>
)
