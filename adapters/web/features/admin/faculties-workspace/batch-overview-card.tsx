import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip, withAlpha } from '@web/shared/ui/primitives'
import { InfoBanner, SectionHeading } from '../system-admin-ui'
import type { ApiBatch, ApiPolicyOverride, ApiResolvedBatchPolicy } from '@web/shared/api/types'
import type { BatchSetupReadiness } from '../batch-setup-readiness'
import { deriveCurrentYearLabel } from '../system-admin-live-data'
import { SystemAdminProofDashboardWorkspace } from '../system-admin-proof-dashboard-workspace'
import type { WorkspaceMetaScope } from './types'
import { describeGovernanceResolutionMessage } from './workspace-helpers'

type EditingEntitySetter = Dispatch<SetStateAction<'academic-faculty' | 'department' | 'branch' | 'batch' | null>>

export function BatchSetupChecklist({
  selectedBatch,
  batchSetupReadiness,
}: {
  selectedBatch: ApiBatch | null
  batchSetupReadiness: BatchSetupReadiness | null
}) {
  return selectedBatch && batchSetupReadiness && !batchSetupReadiness.ready ? (
    <Card style={{ padding: 16, display: 'grid', gap: 10, background: `linear-gradient(180deg, ${withAlpha(T.danger, '10')}, ${T.surface})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ ...mono, fontSize: 9, color: T.danger, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Setup Checklist</div>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 6 }}>Finish setup before stage progression or proof preview</div>
        </div>
        <Chip color={T.danger}>{`${batchSetupReadiness.blockers.length} blocker${batchSetupReadiness.blockers.length === 1 ? '' : 's'}`}</Chip>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {batchSetupReadiness.blockers.map(blocker => (
          <div key={blocker} style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{`• ${blocker}`}</div>
        ))}
      </div>
      <InfoBanner tone="error" message="Proof preview buttons stay locked until every blocker above is cleared." />
    </Card>
  ) : null
}

export function BatchOverviewCard({
  selectedBatch,
  authoritativeOperationalSemester,
  authoritativeOperationalSemesterSource,
  activeBatchPolicyOverride,
  activeGovernanceScope,
  activeScopeChain,
  resolvedBatchPolicy,
  setEditingEntity,
  proofDashboardProps,
  batchSetupReadiness,
  onOpenProofDashboard,
}: {
  selectedBatch: ApiBatch
  authoritativeOperationalSemester: number | null
  authoritativeOperationalSemesterSource: 'proof-run' | 'batch' | 'unavailable'
  activeBatchPolicyOverride: ApiPolicyOverride | null
  activeGovernanceScope: WorkspaceMetaScope | null
  activeScopeChain: WorkspaceMetaScope[]
  resolvedBatchPolicy: ApiResolvedBatchPolicy | null
  setEditingEntity: EditingEntitySetter
  proofDashboardProps: ComponentProps<typeof SystemAdminProofDashboardWorkspace>
  batchSetupReadiness: BatchSetupReadiness | null
  onOpenProofDashboard: () => void
}) {
  const authoritativeSemesterValue = authoritativeOperationalSemester ?? selectedBatch?.currentSemester ?? null
  const authoritativeSemesterChipColor = authoritativeOperationalSemesterSource === 'proof-run' ? T.warning : T.accent
  const authoritativeSemesterLabel = authoritativeSemesterValue != null ? `Sem ${authoritativeSemesterValue}` : 'Sem unavailable'
  const authoritativeSemesterSourceLabel = authoritativeOperationalSemesterSource === 'proof-run'
    ? 'Proof operational semester'
    : authoritativeOperationalSemesterSource === 'batch'
      ? 'Batch semester'
      : 'Semester unavailable'

  return (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip color={T.success}>Batch {selectedBatch.batchLabel}</Chip>
        <Chip color={authoritativeSemesterChipColor}>{`${authoritativeSemesterSourceLabel} · ${authoritativeSemesterLabel}`}</Chip>
        <Chip color={T.warning}>{deriveCurrentYearLabel(selectedBatch.currentSemester)}</Chip>
        <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Local Policy Override' : 'Inherited Policy'}</Chip>
      </div>

      <SectionHeading title="Batch Configuration" eyebrow="Settings" caption="Edit the batch identity, active semester, and sections before adjusting policy, terms, or curriculum." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Card style={{ padding: 14, background: T.surface2 }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admission Year</div>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedBatch.admissionYear}</div>
        </Card>
        <Card style={{ padding: 14, background: T.surface2 }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Authoritative Semester</div>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 8 }}>{authoritativeSemesterValue ?? '—'}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{authoritativeSemesterSourceLabel}</div>
        </Card>
        <Card style={{ padding: 14, background: T.surface2 }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sections</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {selectedBatch.sectionLabels.map(sectionCode => <Chip key={sectionCode} color={T.accent}>{sectionCode}</Chip>)}
          </div>
        </Card>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn type="button" size="sm" onClick={() => setEditingEntity('batch' as never)}>Edit Batch</Btn>
      </div>

      <InfoBanner message={describeGovernanceResolutionMessage({
        activeGovernanceScope,
        activeScopeChain,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      })}
      />

      <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 12 }}>
        <SectionHeading
          title="Proof Control Plane"
          eyebrow="Dedicated Page"
          caption="Queue verification, requests, reminders, run progression, and model diagnostics now live on a dedicated proof dashboard instead of inside the curriculum workspace."
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={T.success}>{`${proofDashboardProps.proofDashboard?.activeRunDetail?.runLabel ?? 'No active run'} · ${proofDashboardProps.proofDashboard?.activeRunDetail?.status ?? 'idle'}`}</Chip>
          <Chip color={T.accent}>{`Live semester ${proofDashboardProps.proofDashboard?.activeRunDetail?.activeOperationalSemester ?? '—'}`}</Chip>
          <Chip color={T.warning}>{`${proofDashboardProps.proofDashboard?.activeRunDetail?.monitoringSummary.activeReassessmentCount ?? 0} open queue`}</Chip>
          <Chip color={T.orange}>{`${proofDashboardProps.proofDashboard?.activeRunDetail?.monitoringSummary.acknowledgementCount ?? 0} acknowledgements`}</Chip>
          {batchSetupReadiness ? (
            <Chip color={batchSetupReadiness.ready ? T.success : T.danger}>
              {batchSetupReadiness.ready ? 'Setup complete' : 'Setup incomplete'}
            </Chip>
          ) : null}
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          Curriculum import manages governed course rows and linkage candidates. Provisioning materializes live offerings, owners, timetables, and optional synthetic test data. Queue pressure, proof-stage progression, and backend acknowledgement state are reviewed from the proof dashboard so this workspace stays focused on structure and ownership semantics.
        </div>
        {batchSetupReadiness && !batchSetupReadiness.ready ? (
          <InfoBanner tone="error" message={`Complete setup first: ${batchSetupReadiness.blockers.join(' ')}`} />
        ) : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn type="button" size="sm" onClick={onOpenProofDashboard}>Open Proof Dashboard</Btn>
          <Chip color={proofDashboardProps.proofDashboardLoading ? T.dim : T.success}>
            {proofDashboardProps.proofDashboardLoading ? 'Dashboard loading…' : 'Dashboard ready'}
          </Chip>
        </div>
      </Card>

    </Card>
  )
}
