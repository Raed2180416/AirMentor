import { T, mono, sora } from '@web/simulation/fixtures'
import { ProofSurfaceLauncher } from '@web/simulation/proof-surface-shell'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { Btn, Card } from '@web/shared/ui/primitives'
import {
  formatDateLabel,
  type FacultyProfile,
  type ProofCheckpoint,
  type ProofMonitoringItem,
  type ProofOps,
} from './profile-helpers'

type FacultyProofLauncherProps = {
  profile: FacultyProfile | null
  proofModeActive: boolean
  selectedProofCheckpoint: ProofCheckpoint | null
  proofOps: ProofOps | null
  leadingProofQueueItem: ProofMonitoringItem | null
}

export function FacultyProofLauncher({
  profile,
  proofModeActive,
  selectedProofCheckpoint,
  proofOps,
  leadingProofQueueItem,
}: FacultyProofLauncherProps) {
  return (
    <ProofSurfaceLauncher
      targetId="teacher-proof-panel-surface"
      label="Jump to teacher proof controls"
      dataProofEntityId={profile?.facultyId}
      popupTitle="Teacher proof control surface"
      popupCaption={proofModeActive
        ? `Checkpoint ${selectedProofCheckpoint?.stageLabel ?? 'unavailable'} · semester ${selectedProofCheckpoint?.semesterNumber ?? proofOps?.activeOperationalSemester ?? 'NA'}`
        : 'Teaching-side proof summary for the current faculty scope.'}
      popupContent={() => (
        <div style={{ display: 'grid', gap: 12 }}>
          <InfoBanner message="Use this popup to confirm the selected stage, queue size, and elective-fit count before opening the full proof panel." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Proof semester</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{selectedProofCheckpoint ? `Semester ${selectedProofCheckpoint.semesterNumber}` : `Semester ${proofOps?.activeOperationalSemester ?? 'NA'}`}</div>
            </Card>
            <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Proof queue</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{proofOps?.monitoringQueue.length ?? 0}</div>
            </Card>
            <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Elective fits</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{proofOps?.electiveFits.length ?? 0}</div>
            </Card>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Latest queue item</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              {leadingProofQueueItem
                ? `${leadingProofQueueItem.studentName} · ${leadingProofQueueItem.courseCode} · ${leadingProofQueueItem.riskBand} · due ${leadingProofQueueItem.dueAt ? formatDateLabel(leadingProofQueueItem.dueAt) : 'unspecified'}`
                : 'No governed queue items are currently linked to this faculty scope.'}
            </div>
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
  )
}
