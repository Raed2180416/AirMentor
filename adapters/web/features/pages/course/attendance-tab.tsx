import { T, mono, sora, type Offering, type Student } from '@web/simulation/fixtures'
import { Bar, Btn, Card, Chip, HScrollArea, RiskBadge, TD, TH } from '@web/shared/ui/primitives'
import { getAttendancePct, hasRiskEvidence } from './stage-helpers'

export function AttendanceTab({ offering, students, proofStageKey, onOpenStudent, onOpenEntryHub }: { offering: Offering; students: Student[]; proofStageKey?: string | null; onOpenStudent: (student: Student) => void; onOpenEntryHub: () => void }) {
  const sorted = [...students].sort((left, right) => (getAttendancePct(left) ?? Number.POSITIVE_INFINITY) - (getAttendancePct(right) ?? Number.POSITIVE_INFINITY))
  const studentsWithAttendance = students.filter(student => getAttendancePct(student) != null)
  const hasAttendance = studentsWithAttendance.length > 0
  const stats = {
    good: studentsWithAttendance.filter(student => (getAttendancePct(student) ?? 0) >= 75).length,
    atRisk: studentsWithAttendance.filter(student => {
      const pct = getAttendancePct(student) ?? 0
      return pct >= 65 && pct < 75
    }).length,
    detained: studentsWithAttendance.filter(student => (getAttendancePct(student) ?? 0) < 65).length,
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Attendance Register — {students.length} students</div>
        <Btn size="sm" onClick={onOpenEntryHub}>Enter Attendance via Data Entry Hub →</Btn>
      </div>
      {hasAttendance ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {[{ label: 'Good ≥75%', value: stats.good, color: T.success }, { label: 'At Risk', value: stats.atRisk, color: T.warning }, { label: 'Detained <65%', value: stats.detained, color: T.danger }].map(metric => (
            <Card key={metric.label} style={{ flex: 1, padding: '12px 16px' }}>
              <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: metric.color }}>{metric.value}</div>
              <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ ...mono, fontSize: 11, color: T.dim }}>Attendance and risk are Not applicable yet for this opening stage. Capture classes or advance to an evidence-bearing checkpoint before bands appear.</div>
        </Card>
      )}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', 'Present / 45', 'Attendance', 'Risk', 'Status'].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {sorted.map((student, index) => {
                const pct = getAttendancePct(student)
                const color = pct == null ? T.dim : pct >= 75 ? T.success : pct >= 65 ? T.warning : T.danger
                const riskApplicable = hasRiskEvidence(offering, student, proofStageKey)
                return (
                  <tr key={student.id} data-clickable-row="true" onClick={() => onOpenStudent(student)} style={{ cursor: 'pointer' }}>
                    <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{index + 1}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 12, color: T.text, whiteSpace: 'nowrap' }}>{student.name}</TD>
                    <TD style={{ ...mono, fontSize: 12, color: T.text }}>{student.present} / {student.totalClasses}</TD>
                    <TD><div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}><Bar val={pct ?? 0} color={color} h={4} /><span style={{ ...mono, fontSize: 10, color }}>{pct == null ? 'Not applicable yet' : `${pct}%`}</span></div></TD>
                    <TD>{riskApplicable ? <RiskBadge band={student.riskBand} prob={student.riskProb} /> : <Chip color={T.dim} size={9}>Not applicable yet</Chip>}</TD>
                    <TD><Chip color={color} size={9}>{pct == null ? 'Not applicable yet' : pct >= 75 ? 'Good' : pct >= 65 ? 'At Risk' : 'Detained'}</Chip></TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </HScrollArea>
      </Card>
    </div>
  )
}
