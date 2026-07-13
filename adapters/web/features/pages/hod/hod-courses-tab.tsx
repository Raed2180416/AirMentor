import { T, mono } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofCourseRollup } from '@web/shared/api/types'
import { Btn, Chip, TH, TD } from '@web/shared/ui/primitives'
import { TableCard } from './hod-shared-components'
import { formatPercent } from './hod-helpers'

export function HodCoursesTab({
  courseRollups,
  setSelectedCourseCode,
}: {
  courseRollups: ApiAcademicHodProofCourseRollup[]
  setSelectedCourseCode: React.Dispatch<React.SetStateAction<string | null>>
}) {
  return (
    <TableCard title="Course Hotspots" caption="Course-level view of risk concentration, attendance pressure, TT1/TT2 weakness, question weakness, and reassessment burden.">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <TH>Course</TH>
            <TH>Sections</TH>
            <TH>Risk</TH>
            <TH>Attendance</TH>
            <TH>Assessment Weakness</TH>
            <TH>Backlog Carryover</TH>
            <TH>Reassessments</TH>
            <TH>Open</TH>
          </tr>
        </thead>
        <tbody>
          {courseRollups.map(row => (
            <tr key={row.courseCode}>
              <TD>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.courseCode}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.title}</div>
              </TD>
              <TD>{row.sectionCodes.join(', ') || 'NA'}</TD>
              <TD>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Chip color={T.danger}>{`High ${row.riskCountHigh}`}</Chip>
                  <Chip color={T.warning}>{`Medium ${row.riskCountMedium}`}</Chip>
                </div>
              </TD>
              <TD>{formatPercent(row.averageAttendancePct)}</TD>
              <TD>{`TT1 ${row.tt1WeakCount} · TT2 ${row.tt2WeakCount} · SEE ${row.seeWeakCount} · Q ${row.weakQuestionSignalCount}`}</TD>
              <TD>{row.backlogCarryoverCount}</TD>
              <TD>{`${row.openReassessmentCount} open · ${row.resolvedReassessmentCount} resolved`}</TD>
              <TD><Btn size="sm" variant="ghost" onClick={() => setSelectedCourseCode(row.courseCode)}>Inspect</Btn></TD>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  )
}
