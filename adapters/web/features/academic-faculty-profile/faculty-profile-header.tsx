import { T, mono, sora } from '@web/simulation/fixtures'
import type { Role } from '@kernel/shared/domain'
import { MetricCard } from '@web/features/admin/system-admin-ui'
import { Card, Chip } from '@web/shared/ui/primitives'
import type { ProofOps } from './profile-helpers'

type FacultyProfileHeaderProps = {
  displayName: string
  activeRole: Role
  effectivePermissions: string[]
  effectiveDepartment: string
  effectiveDesignation: string
  employeeCode: string
  effectiveEmail: string
  effectivePhone: string
  proofQueueMetricLabel: string
  proofQueueMetricValue: string
  proofQueueMetricHelper: string
  scopeMetricLabel: string
  scopeMetricValue: string
  scopeMetricHelper: string
  displayNextReassessmentValue: string
  displayNextReassessmentHelper: string
  proofOps: ProofOps | null
}

export function FacultyProfileHeader({
  displayName,
  activeRole,
  effectivePermissions,
  effectiveDepartment,
  effectiveDesignation,
  employeeCode,
  effectiveEmail,
  effectivePhone,
  proofQueueMetricLabel,
  proofQueueMetricValue,
  proofQueueMetricHelper,
  scopeMetricLabel,
  scopeMetricValue,
  scopeMetricHelper,
  displayNextReassessmentValue,
  displayNextReassessmentHelper,
  proofOps,
}: FacultyProfileHeaderProps) {
  return (
    <Card style={{ padding: 20, display: 'grid', gap: 14, background: `linear-gradient(160deg, ${T.surface}, ${T.surface2})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Teaching Profile</div>
          <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 8 }}>{displayName}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
            Inspect-first faculty profile powered by the system-admin master record when available. Operational edits still happen in their existing teaching or admin workflows.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={T.accent}>{activeRole}</Chip>
          {effectivePermissions.map(permission => <Chip key={permission} color={T.success}>{permission}</Chip>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <MetricCard label="Primary Department" value={effectiveDepartment} helper="Current teaching-side home context." />
        <MetricCard label="Designation" value={effectiveDesignation} helper="Admin-managed teaching title and academic responsibility label." />
        <MetricCard label="Employee Code" value={employeeCode} helper="Read-only faculty identity key from the admin master record." />
        <MetricCard label="Email" value={effectiveEmail} helper="Read-only identity field from the faculty record." />
        <MetricCard label="Phone" value={effectivePhone} helper="Shown here so faculty can verify admin-owned contact data." />
        <MetricCard label={proofQueueMetricLabel} value={proofQueueMetricValue} helper={proofQueueMetricHelper} />
        <MetricCard label={scopeMetricLabel} value={scopeMetricValue} helper={scopeMetricHelper} />
        <MetricCard label="Next Reassessment" value={displayNextReassessmentValue} helper={displayNextReassessmentHelper} />
        <MetricCard label="Active Proof Runs" value={String(proofOps?.activeRunContexts.length ?? 0)} helper="Simulation runs currently linked to this faculty context." />
        <MetricCard label="Proof Queue" value={String(proofOps?.monitoringQueue.length ?? 0)} helper="Observed-only risk items available for review and follow-up." />
        <MetricCard label="Elective Fits" value={String(proofOps?.electiveFits.length ?? 0)} helper="Semester-6 elective recommendations derived from observed performance." />
      </div>
    </Card>
  )
}
