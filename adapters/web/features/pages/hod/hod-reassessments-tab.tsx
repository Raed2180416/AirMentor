import { T, mono } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofReassessment } from '@web/shared/api/types'
import { Btn, Chip, RiskBadge, TH, TD } from '@web/shared/ui/primitives'
import { formatDateTime, getStatusColor } from '@web/features/admin/system-admin-ui'
import { TableCard } from './hod-shared-components'
import { toRiskBand } from './hod-helpers'

export function HodReassessmentsTab({
  reassessmentRows,
  setSelectedStudentId,
  onOpenRiskExplorer,
  onOpenStudentShell,
}: {
  reassessmentRows: ApiAcademicHodProofReassessment[]
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string | null>>
  onOpenRiskExplorer: (studentId: string) => void
  onOpenStudentShell: (studentId: string) => void
}) {
  return (
    <TableCard title="Reassessment Audit" caption="Run-scoped reassessment records with current status, acknowledgement, and resolution visibility.">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <TH>Student</TH>
            <TH>Course</TH>
            <TH>Assigned Role</TH>
            <TH>Risk</TH>
            <TH>Due</TH>
            <TH>Status</TH>
            <TH>Acknowledgement</TH>
            <TH>Resolution</TH>
            <TH>Open</TH>
          </tr>
        </thead>
        <tbody>
          {reassessmentRows.map(row => (
            <tr key={row.reassessmentEventId}>
              <TD>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.studentName}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.usn}</div>
              </TD>
              <TD>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.courseCode}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.sectionCode ?? 'NA'}</div>
              </TD>
              <TD><Chip color={row.assignedToRole === 'HOD' ? T.warning : T.accent}>{row.assignedToRole}</Chip></TD>
              <TD><RiskBadge band={toRiskBand(row.riskBand)} prob={row.riskProbScaled / 100} /></TD>
              <TD>{formatDateTime(row.dueAt)}</TD>
              <TD><Chip color={getStatusColor(row.status)}>{row.status}</Chip></TD>
              <TD>{row.acknowledgement ? <Chip color={getStatusColor(row.acknowledgement.status)}>{row.acknowledgement.status}</Chip> : <Chip color={T.dim}>Pending</Chip>}</TD>
              <TD>{row.resolution ? <Chip color={getStatusColor(row.resolution.resolutionStatus)}>{row.resolution.resolutionStatus}</Chip> : <Chip color={T.dim}>Open</Chip>}</TD>
              <TD>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn size="sm" variant="ghost" onClick={() => setSelectedStudentId(row.studentId)}>Inspect</Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    dataProofAction="hod-open-risk-explorer"
                    dataProofEntityId={row.studentId}
                    onClick={() => onOpenRiskExplorer(row.studentId)}
                  >
                    Risk Explorer
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    dataProofAction="hod-open-student-shell"
                    dataProofEntityId={row.studentId}
                    onClick={() => onOpenStudentShell(row.studentId)}
                  >
                    Student Shell
                  </Btn>
                </div>
              </TD>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  )
}
