import { motion } from 'framer-motion'
import { T, mono } from '@web/simulation/fixtures'
import type { ApiProofDashboard } from '@web/shared/api/types'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { ProofSurfaceTabPanel } from '@web/simulation/proof-surface-shell'
import { ScrollCard } from './proof-dashboard-cards'
import { formatAgeSeconds, formatLeaseState, formatOperationalEventDetails } from './proof-dashboard-helpers'
import type { ProofActiveRunDetail, ProofDashboardTabId, ProofResetSnapshot } from './proof-dashboard-types'

type ProofOperationsPanelProps = {
  activeTab: ProofDashboardTabId
  proofDashboard: ApiProofDashboard | null
  activeRunDetail: ProofActiveRunDetail
  activeRunBaselineSnapshot: ProofResetSnapshot | undefined
  activeRunSnapshots: ProofResetSnapshot[]
  importsCount: number
  proofRunStatusColor: (status: string) => string
  onValidateLatestProofImport: () => void
  onReviewPendingCrosswalks: () => void
  onApproveLatestProofImport: () => void
  onActivateProofRun: (simulationRunId: string) => void
  onRetryProofRun: (simulationRunId: string) => void
  onArchiveProofRun: (simulationRunId: string) => void
  onResetProofRunFromScratch: (simulationRunId: string, simulationResetSnapshotId?: string) => void
  onRestoreProofSnapshot: (simulationRunId: string, simulationResetSnapshotId?: string) => void
}

export function ProofOperationsPanel({
  activeTab,
  proofDashboard,
  activeRunDetail,
  activeRunBaselineSnapshot,
  activeRunSnapshots,
  importsCount,
  proofRunStatusColor,
  onValidateLatestProofImport,
  onReviewPendingCrosswalks,
  onApproveLatestProofImport,
  onActivateProofRun,
  onRetryProofRun,
  onArchiveProofRun,
  onResetProofRunFromScratch,
  onRestoreProofSnapshot,
}: ProofOperationsPanelProps) {
  const lifecycleAudit = proofDashboard?.lifecycleAudit ?? []
  const recentOperationalEvents = proofDashboard?.recentOperationalEvents ?? []
  const crosswalkReviewCount = proofDashboard?.crosswalkReviewQueue.length ?? 0
  const proofRunCount = proofDashboard?.proofRuns.length ?? 0
  const teacherLoadCount = activeRunDetail?.teacherAllocationLoad.length ?? 0
  const queuePreviewCount = activeRunDetail?.queuePreview.length ?? 0

  return (
    <ProofSurfaceTabPanel
      idBase="system-admin-proof-dashboard"
      tabId="operations"
      activeTab={activeTab}
      sectionId="proof-dashboard-operations"
      minHeight={320}
      style={{ gap: 12 }}
    >
      <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <ScrollCard title="Administrative Actions" eyebrow="Operations" maxHeight={220}>
          <div style={{ display: 'grid', gap: 8 }}>
            <Btn size="sm" variant="ghost" dataProofAction="proof-validate-import" onClick={onValidateLatestProofImport} disabled={!importsCount}>Check Mapping</Btn>
            <Btn size="sm" variant="ghost" dataProofAction="proof-review-crosswalks" onClick={onReviewPendingCrosswalks} disabled={!crosswalkReviewCount}>Review Mappings</Btn>
            <Btn size="sm" variant="ghost" dataProofAction="proof-approve-import" onClick={onApproveLatestProofImport} disabled={!importsCount}>Approve Import</Btn>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
              Imports {importsCount} · Crosswalk review {crosswalkReviewCount} · Runs {proofRunCount} · Teacher load {teacherLoadCount} · Queue preview {queuePreviewCount}
            </div>
          </div>
        </ScrollCard>

        <ScrollCard title="Imports" eyebrow="Operations" maxHeight={190}>
          {proofDashboard?.imports.length ? proofDashboard.imports.slice(0, 3).map(item => (
            <Card key={item.curriculumImportVersionId} style={{ padding: 10, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.sourceLabel}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {item.status} · {item.validationStatus} · {item.unresolvedMappingCount} unresolved mappings
              </div>
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof imports yet.</div>}
        </ScrollCard>

        <ScrollCard title="Crosswalk Review" eyebrow="Operations" maxHeight={190}>
          {proofDashboard?.crosswalkReviewQueue.length ? proofDashboard.crosswalkReviewQueue.slice(0, 5).map(item => (
            <Card key={item.officialCodeCrosswalkId} style={{ padding: 10, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.internalCompilerId}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {item.officialWebCode ?? 'No public code'} · {item.confidence}
              </div>
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No pending crosswalk reviews.</div>}
        </ScrollCard>

        <ScrollCard title="Runs" eyebrow="Operations" maxHeight={190}>
          {proofDashboard?.proofRuns.length ? proofDashboard.proofRuns.slice(0, 4).map(item => (
            <Card key={item.simulationRunId} style={{ padding: 10, background: T.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.runLabel}</div>
                <Chip color={item.activeFlag ? T.success : proofRunStatusColor(item.status)}>{item.activeFlag ? 'Active' : item.status}</Chip>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Seed {item.seed} · {new Date(item.createdAt).toLocaleString('en-IN')}</div>
              {item.progress ? <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{String(item.progress.phase ?? item.status)} · {String(item.progress.percent ?? 0)}%</div> : null}
              {item.queueAgeSeconds != null || item.leaseState || item.retryState ? (
                <div style={{ ...mono, fontSize: 10, color: item.leaseState === 'expired' ? T.warning : T.muted, marginTop: 4, lineHeight: 1.6 }}>
                  Queue age {formatAgeSeconds(item.queueAgeSeconds)} · lease {formatLeaseState(item.leaseState)}{item.retryState ? ` · ${item.retryState}` : ''}
                </div>
              ) : null}
              {item.failureMessage ? <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 4, lineHeight: 1.6 }}>{item.failureMessage}</div> : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {!item.activeFlag && item.status === 'completed' ? <Btn size="sm" variant="ghost" onClick={() => onActivateProofRun(item.simulationRunId)}>Set Active</Btn> : null}
                {item.status === 'failed' ? <Btn size="sm" variant="ghost" onClick={() => onRetryProofRun(item.simulationRunId)}>Retry</Btn> : null}
                <Btn size="sm" variant="ghost" onClick={() => onArchiveProofRun(item.simulationRunId)}>Archive</Btn>
                {item.simulationRunId === activeRunDetail?.simulationRunId && activeRunBaselineSnapshot ? (
                  <Btn size="sm" variant="ghost" onClick={() => onResetProofRunFromScratch(item.simulationRunId, activeRunBaselineSnapshot.simulationResetSnapshotId)}>
                    Reset Preview To Start
                  </Btn>
                ) : null}
                {item.simulationRunId === activeRunDetail?.simulationRunId && activeRunSnapshots[0] ? (
                  <Btn size="sm" variant="ghost" onClick={() => onRestoreProofSnapshot(item.simulationRunId, activeRunSnapshots[0]?.simulationResetSnapshotId)}>Restore Snapshot</Btn>
                ) : null}
              </div>
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof simulation runs yet.</div>}
        </ScrollCard>

        <ScrollCard title="Teacher Load" eyebrow="Operations" maxHeight={190}>
          {activeRunDetail.teacherAllocationLoad.length ? activeRunDetail.teacherAllocationLoad.slice(0, 6).map(load => (
            <Card key={load.teacherLoadProfileId} style={{ padding: 10, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>{load.facultyName}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                Sem {load.semesterNumber} · {load.weeklyContactHours} contact hrs · {load.assignedCredits} credits
              </div>
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No teacher-load rows yet.</div>}
        </ScrollCard>

        <ScrollCard title="Queue Preview" eyebrow="Operations" maxHeight={190}>
          {activeRunDetail.queuePreview.length ? activeRunDetail.queuePreview.slice(0, 6).map(item => (
            <Card key={item.reassessmentEventId} style={{ padding: 10, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.studentName} · {item.courseCode}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {item.assignedToRole} · {item.status} · due {new Date(item.dueAt).toLocaleString('en-IN')}
              </div>
              {item.sourceKind === 'checkpoint-playback' ? <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Playback fallback · {item.stageLabel ?? 'checkpoint-sourced'}</div> : null}
              {item.coEvidenceMode ? <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>CO evidence mode: {item.coEvidenceMode}.</div> : null}
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No active reassessment queue items.</div>}
        </ScrollCard>

        <ScrollCard title="Lifecycle Audit" eyebrow="Operations" maxHeight={190}>
          {lifecycleAudit.length ? lifecycleAudit.slice(0, 6).map(item => (
            <Card key={item.simulationLifecycleAuditId} style={{ padding: 10, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.actionType}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {item.createdByFacultyName ?? 'System'} · {new Date(item.createdAt).toLocaleString('en-IN')}
              </div>
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof lifecycle audit entries yet.</div>}
        </ScrollCard>

        <ScrollCard title="Recent Operational Events" eyebrow="Operations" maxHeight={190}>
          {recentOperationalEvents.length ? recentOperationalEvents.slice(0, 8).map(item => (
            <Card key={item.operationalTelemetryEventId} style={{ padding: 10, background: T.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>
                    {formatOperationalEventDetails(item.details)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Chip color={item.level === 'error' ? T.danger : item.level === 'warn' ? T.warning : T.accent} size={9}>{item.level}</Chip>
                  <Chip color={item.source === 'client' ? T.success : T.dim} size={9}>{item.source}</Chip>
                </div>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                {new Date(item.timestamp).toLocaleString('en-IN')}
              </div>
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No recent operational events retained yet.</div>}
        </ScrollCard>
      </motion.div>
    </ProofSurfaceTabPanel>
  )
}
