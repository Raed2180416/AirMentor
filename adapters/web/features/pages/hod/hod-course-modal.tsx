import { T, mono } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofCourseRollup, ApiAcademicHodProofStudentWatch } from '@web/shared/api/types'
import { Btn, Chip, ModalWorkspace, RiskBadge, TH, TD } from '@web/shared/ui/primitives'
import { MetricCard } from '@web/features/admin/system-admin-ui'
import { TableCard } from './hod-shared-components'
import { formatPercent, toRiskBand } from './hod-helpers'

export function HodCourseModal({
  selectedCourse,
  selectedCourseStudents,
  setSelectedCourseCode,
  setSelectedStudentId,
  onOpenRiskExplorer,
  onOpenStudentShell,
}: {
  selectedCourse: ApiAcademicHodProofCourseRollup
  selectedCourseStudents: ApiAcademicHodProofStudentWatch[]
  setSelectedCourseCode: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string | null>>
  onOpenRiskExplorer: (studentId: string) => void
  onOpenStudentShell: (studentId: string) => void
}) {
  return (
    <ModalWorkspace
      eyebrow="Course Hotspot"
      title={`${selectedCourse.courseCode} · ${selectedCourse.title}`}
      caption="Read-only course rollup derived from live proof records for the active run."
      onClose={() => setSelectedCourseCode(null)}
      size="lg"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <MetricCard label="Sections" value={selectedCourse.sectionCodes.join(', ') || 'NA'} helper="Sections carrying this course in the active semester." />
          <MetricCard label="Students" value={String(selectedCourse.studentCount)} helper="Distinct students represented in the current evidence slice." />
          <MetricCard label="Attendance" value={formatPercent(selectedCourse.averageAttendancePct)} helper="Average observed attendance across current evidence rows." />
          <MetricCard label="Reassessments" value={`${selectedCourse.openReassessmentCount} open`} helper={`${selectedCourse.resolvedReassessmentCount} resolved in the active run`} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={T.danger}>{`High watch ${selectedCourse.riskCountHigh}`}</Chip>
          <Chip color={T.warning}>{`Medium watch ${selectedCourse.riskCountMedium}`}</Chip>
          <Chip color={T.accent}>{`TT1 weak ${selectedCourse.tt1WeakCount}`}</Chip>
          <Chip color={T.accent}>{`TT2 weak ${selectedCourse.tt2WeakCount}`}</Chip>
          <Chip color={T.warning}>{`SEE weak ${selectedCourse.seeWeakCount}`}</Chip>
          <Chip color={T.warning}>{`Weak questions ${selectedCourse.weakQuestionSignalCount}`}</Chip>
          <Chip color={T.muted}>{`Backlog carryover ${selectedCourse.backlogCarryoverCount}`}</Chip>
        </div>
        <TableCard title="Linked student rows" caption="Students in the current HoD watchlist who carry this course as a risk-bearing snapshot.">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Student</TH>
                <TH>Section</TH>
                <TH>Risk</TH>
                <TH>Attendance</TH>
                <TH>TT Window</TH>
                <TH>Open</TH>
              </tr>
            </thead>
            <tbody>
              {selectedCourseStudents.map(row => (
                <tr key={row.studentId}>
                  <TD>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.studentName}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.usn}</div>
                  </TD>
                  <TD>{row.sectionCode}</TD>
                  <TD><RiskBadge band={toRiskBand(row.currentRiskBand)} prob={row.currentRiskProbScaled / 100} /></TD>
                  <TD>{formatPercent(row.observedEvidence.attendancePct)}</TD>
                  <TD>{`${formatPercent(row.observedEvidence.tt1Pct)} / ${formatPercent(row.observedEvidence.tt2Pct)}`}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Btn size="sm" variant="ghost" onClick={() => setSelectedStudentId(row.studentId)}>Inspect Student</Btn>
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
      </div>
    </ModalWorkspace>
  )
}
