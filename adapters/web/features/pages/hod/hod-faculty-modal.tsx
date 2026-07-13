import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofFacultyRollup, ApiAcademicHodProofReassessment } from '@web/shared/api/types'
import { Card, Chip, ModalWorkspace, TH, TD } from '@web/shared/ui/primitives'
import { MetricCard, formatDateTime } from '@web/features/admin/system-admin-ui'
import { PanelLabel, TableCard } from './hod-shared-components'
import { formatHours, sectionColor } from './hod-helpers'

export function HodFacultyModal({
  selectedFaculty,
  selectedFacultyReassessments,
  setSelectedFacultyId,
}: {
  selectedFaculty: ApiAcademicHodProofFacultyRollup
  selectedFacultyReassessments: ApiAcademicHodProofReassessment[]
  setSelectedFacultyId: React.Dispatch<React.SetStateAction<string | null>>
}) {
  return (
    <ModalWorkspace
      eyebrow="Faculty Rollup"
      title={selectedFaculty.facultyName}
      caption="Faculty-level load and monitoring metrics visible in the current HoD proof scope."
      onClose={() => setSelectedFacultyId(null)}
      size="lg"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <MetricCard label="Designation" value={selectedFaculty.designation} helper="Current faculty title from the proof-linked profile." />
          <MetricCard label="Weekly Load" value={formatHours(selectedFaculty.weeklyContactHours)} helper="Current semester contact-hour load projection." />
          <MetricCard label="Queue Load" value={String(selectedFaculty.queueLoad)} helper="In-scope queue burden derived from current proof records." />
          <MetricCard label="Closure Rate" value={`${selectedFaculty.reassessmentClosureRate}%`} helper="Resolved reassessments divided by relevant reassessment rows." />
        </div>
        <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
          <PanelLabel color={T.accent}>Observed</PanelLabel>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Faculty scope</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedFaculty.permissions.map(permission => <Chip key={permission} color={permission === 'HOD' ? T.warning : permission === 'MENTOR' ? T.success : T.accent}>{permission}</Chip>)}
            {selectedFaculty.assignedSections.map(section => <Chip key={section} color={sectionColor(section)}>{`Section ${section}`}</Chip>)}
            {selectedFaculty.overloadFlag ? <Chip color={T.danger}>Load threshold exceeded</Chip> : <Chip color={T.success}>Within load threshold</Chip>}
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Average acknowledgement lag is {formatHours(selectedFaculty.avgAcknowledgementLagHours)} and the current intervention count is {selectedFaculty.interventionCount}.
          </div>
        </Card>
        <TableCard title="Relevant reassessment sample" caption="Run-scoped reassessment rows aligned to the visible faculty permissions.">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Student</TH>
                <TH>Course</TH>
                <TH>Assigned Role</TH>
                <TH>Status</TH>
                <TH>Due</TH>
              </tr>
            </thead>
            <tbody>
              {selectedFacultyReassessments.slice(0, 10).map(row => (
                <tr key={row.reassessmentEventId}>
                  <TD>{row.studentName}</TD>
                  <TD>{row.courseCode}</TD>
                  <TD>{row.assignedToRole}</TD>
                  <TD>{row.status}</TD>
                  <TD>{formatDateTime(row.dueAt)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>
    </ModalWorkspace>
  )
}
