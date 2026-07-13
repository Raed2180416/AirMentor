import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { T, mono, sora, type Offering, type Student } from '@web/simulation/fixtures'
import type { EntryKind, RiskBand } from '@kernel/shared/domain'
import { useAppSelectors } from '@web/shared/state/selectors'
import { inferKindFromPendingAction } from '@web/shared/state/page-utils'
import { Bar, Btn, Card, Chip, FieldInput, FieldSelect, HScrollArea, PageBackButton, PageShell, TD, TH } from '@web/shared/ui/primitives'

export function AllStudentsPage({
  onBack,
  offerings,
  onOpenStudent,
  onOpenHistory,
  onOpenUpload,
  proofStageKey,
}: {
  onBack: () => void
  offerings: Offering[]
  onOpenStudent: (student: Student, offering: Offering) => void
  onOpenHistory: (student: Student, offering: Offering) => void
  onOpenUpload: (offering: Offering, kind: EntryKind) => void
  proofStageKey?: string | null
}) {
  const { getStudentsPatched } = useAppSelectors()
  const [query, setQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [selectedRisk, setSelectedRisk] = useState<'all' | RiskBand>('all')

  const rows = useMemo(() => offerings.flatMap(offering => getStudentsPatched(offering).map(student => {
    const hasAttendance = student.totalClasses > 0
    const attendancePct = hasAttendance ? Math.round((student.present / Math.max(1, student.totalClasses)) * 100) : null
    const riskApplicable = (proofStageKey ? proofStageKey !== 'pre-tt1' : offering.stage >= 2) && student.riskBand != null && student.riskProb != null
    return { offering, student, attendancePct, hasAttendance, riskApplicable }
  })), [getStudentsPatched, offerings, proofStageKey])

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase()
    const riskOrder: Record<RiskBand, number> = { High: 0, Medium: 1, Low: 2 }
    const normalizeRiskBand = (band: Student['riskBand']): RiskBand => band ?? 'Low'
    return rows
      .filter(item => {
        if (selectedYear !== 'all' && item.offering.year !== selectedYear) return false
        if (selectedCourse !== 'all' && item.offering.code !== selectedCourse) return false
        if (selectedRisk !== 'all' && (!item.riskApplicable || normalizeRiskBand(item.student.riskBand) !== selectedRisk)) return false
        if (!search) return true
        return item.student.name.toLowerCase().includes(search) || item.student.usn.toLowerCase().includes(search)
      })
      .sort((left, right) => {
        const byRisk = riskOrder[left.riskApplicable ? normalizeRiskBand(left.student.riskBand) : 'Low'] - riskOrder[right.riskApplicable ? normalizeRiskBand(right.student.riskBand) : 'Low']
        if (byRisk !== 0) return byRisk
        const leftProb = left.riskApplicable ? (left.student.riskProb ?? 0) : 0
        const rightProb = right.riskApplicable ? (right.student.riskProb ?? 0) : 0
        if (leftProb !== rightProb) return rightProb - leftProb
        return left.student.name.localeCompare(right.student.name)
      })
  }, [query, rows, selectedCourse, selectedRisk, selectedYear])

  const yearOptions = useMemo(() => Array.from(new Set(offerings.map(offering => offering.year))), [offerings])
  const courseOptions = useMemo(() => Array.from(new Set(offerings.map(offering => offering.code))), [offerings])

  return (
    <PageShell size="wide">
      <PageBackButton onClick={onBack} />
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>All Students</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 14 }}>Single integrated roster for profile review, transcript history, and direct data-entry continuation.</div>

      <Card style={{ marginBottom: 14, padding: '14px 16px', background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
          <FieldInput aria-label="Search student by name or USN" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name / USN" />
          <FieldSelect aria-label="Filter by year" value={selectedYear} onChange={event => setSelectedYear(event.target.value)}>
            <option value="all">All Years</option>
            {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
          </FieldSelect>
          <FieldSelect aria-label="Filter by course" value={selectedCourse} onChange={event => setSelectedCourse(event.target.value)}>
            <option value="all">All Courses</option>
            {courseOptions.map(code => <option key={code} value={code}>{code}</option>)}
          </FieldSelect>
          <FieldSelect aria-label="Filter by risk" value={selectedRisk} onChange={event => setSelectedRisk(event.target.value as 'all' | RiskBand)}>
            <option value="all">All Risk Bands</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </FieldSelect>
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 8 }}>{filteredRows.length} students shown</div>
      </Card>

      <Card style={{ padding: 0 }}>
        <HScrollArea vertical dataRosterScroll="all-students" style={{ maxHeight: 560 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: T.surface }}>
              <tr>{['Student', 'USN', 'Class', 'Attendance', 'Risk', 'Actions'].map(header => <TH key={header}>{header}</TH>)}</tr>
            </thead>
            <tbody>
              {filteredRows.map(({ offering, student, attendancePct, hasAttendance, riskApplicable }) => {
                const riskColor = student.riskBand === 'High' ? T.danger : student.riskBand === 'Medium' ? T.warning : T.success
                const attendanceColor = !hasAttendance ? T.dim : attendancePct! >= 75 ? T.success : attendancePct! >= 65 ? T.warning : T.danger
                return (
                  <tr key={`${offering.offId}-${student.id}`} data-clickable-row="true" onClick={() => onOpenStudent(student, offering)} style={{ borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <TD><div style={{ ...sora, fontWeight: 600, fontSize: 12, color: T.text }}>{student.name}</div></TD>
                    <TD><span style={{ ...mono, fontSize: 11, color: T.muted }}>{student.usn}</span></TD>
                    <TD><span style={{ ...mono, fontSize: 11, color: T.muted }}>{offering.code} · {offering.year} · Sec {offering.section}</span></TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bar val={attendancePct ?? 0} color={attendanceColor} h={5} />
                        <span style={{ ...mono, fontSize: 10, color: T.muted, minWidth: 34 }}>{hasAttendance ? `${attendancePct}%` : 'Not applicable yet'}</span>
                      </div>
                    </TD>
                    <TD>{riskApplicable ? <Chip color={riskColor} size={9}>{student.riskBand}{student.riskProb !== null ? ` · ${Math.round(student.riskProb * 100)}%` : ''}</Chip> : <Chip color={T.dim} size={9}>Not applicable yet</Chip>}</TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn size="sm" variant="ghost" onClick={() => onOpenStudent(student, offering)}><Eye size={11} /> Profile</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => onOpenHistory(student, offering)}>History</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => onOpenUpload(offering, inferKindFromPendingAction(offering.pendingAction))}>Data Entry</Btn>
                      </div>
                    </TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </HScrollArea>
      </Card>
    </PageShell>
  )
}
