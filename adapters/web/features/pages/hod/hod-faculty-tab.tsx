import { T, mono } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofFacultyRollup } from '@web/shared/api/types'
import { Btn, Chip, TH, TD } from '@web/shared/ui/primitives'
import { EmptyState } from '@web/features/admin/system-admin-ui'
import { TableCard } from './hod-shared-components'
import { formatHours } from './hod-helpers'

export function HodFacultyTab({
  facultyFilter,
  setFacultyFilter,
  visibleFacultyRollups,
  setSelectedFacultyId,
}: {
  facultyFilter: 'all' | 'overloaded'
  setFacultyFilter: React.Dispatch<React.SetStateAction<'all' | 'overloaded'>>
  visibleFacultyRollups: ApiAcademicHodProofFacultyRollup[]
  setSelectedFacultyId: React.Dispatch<React.SetStateAction<string | null>>
}) {
  return (
    <TableCard title="Faculty Operations" caption="Proof-scope load and monitoring metrics for faculty inside the supervised department or branch.">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Btn
          size="sm"
          variant={facultyFilter === 'all' ? 'primary' : 'ghost'}
          onClick={() => setFacultyFilter('all')}
        >
          All Faculty
        </Btn>
        <Btn
          size="sm"
          variant={facultyFilter === 'overloaded' ? 'primary' : 'ghost'}
          onClick={() => setFacultyFilter('overloaded')}
        >
          Overload Only
        </Btn>
      </div>
      {visibleFacultyRollups.length === 0 ? (
        <EmptyState title="No faculty rows for this filter" body="Try switching to All Faculty or changing the current scope." />
      ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <TH>Faculty</TH>
            <TH>Permissions</TH>
            <TH>Weekly Load</TH>
            <TH>Sections</TH>
            <TH>Queue</TH>
            <TH>Ack Lag</TH>
            <TH>Closure Rate</TH>
            <TH>Open</TH>
          </tr>
        </thead>
        <tbody>
          {visibleFacultyRollups.map(row => (
            <tr key={row.facultyId}>
              <TD>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.facultyName}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.designation}</div>
              </TD>
              <TD>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {row.permissions.map(permission => <Chip key={`${row.facultyId}-${permission}`} color={permission === 'HOD' ? T.warning : permission === 'MENTOR' ? T.success : T.accent}>{permission}</Chip>)}
                </div>
              </TD>
              <TD>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{formatHours(row.weeklyContactHours)}</div>
                {row.overloadFlag ? <div style={{ ...mono, fontSize: 10, color: T.danger, marginTop: 2 }}>Over threshold</div> : null}
              </TD>
              <TD>{row.assignedSections.join(', ') || 'None'}</TD>
              <TD>{row.queueLoad}</TD>
              <TD>{formatHours(row.avgAcknowledgementLagHours)}</TD>
              <TD>{`${row.reassessmentClosureRate}%`}</TD>
              <TD><Btn size="sm" variant="ghost" onClick={() => setSelectedFacultyId(row.facultyId)}>Inspect</Btn></TD>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </TableCard>
  )
}
