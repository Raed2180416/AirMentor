import { Eye } from 'lucide-react'
import { T, mono, sora, type StudentHistoryRecord, type TranscriptTerm } from '@web/simulation/fixtures'
import type { Role } from '@kernel/shared/domain'
import { Btn, Card, Chip, HScrollArea, PageBackButton, PageShell, TD, TH } from '@web/shared/ui/primitives'

export function StudentHistoryPage({
  role,
  history,
  studentId,
  onBack,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: {
  role: Role
  history: StudentHistoryRecord
  studentId?: string | null
  onBack: () => void
  onOpenStudentShell?: (studentId: string) => void
  onOpenRiskExplorer?: (studentId: string) => void
}) {
  const latestTerm = history.terms[history.terms.length - 1]
  const totalBacklogs = history.terms.reduce((acc, term) => acc + term.backlogCount, 0)

  return (
    <PageShell size="standard">
      <PageBackButton onClick={onBack} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 22, color: T.text }}>Student History</div>
          <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 3 }}>{history.studentName} · {history.usn} · {history.program}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Semester-wise history for mentor review, academic follow-up, and later adaptive monitoring inputs.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color={history.trend === 'Improving' ? T.success : history.trend === 'Declining' ? T.danger : T.warning} size={10}>{history.trend} trend</Chip>
          {studentId && onOpenRiskExplorer ? <Btn size="sm" variant="ghost" onClick={() => onOpenRiskExplorer(studentId)}><Eye size={12} /> Risk Explorer</Btn> : null}
          {studentId && onOpenStudentShell ? <Btn size="sm" variant="ghost" onClick={() => onOpenStudentShell(studentId)}><Eye size={12} /> Student Shell</Btn> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Current CGPA', value: history.currentCgpa.toFixed(2), color: history.currentCgpa >= 7 ? T.success : history.currentCgpa >= 6 ? T.warning : T.danger },
          { label: 'Latest SGPA', value: latestTerm?.sgpa.toFixed(2) ?? '—', color: (latestTerm?.sgpa ?? 0) >= 7 ? T.success : (latestTerm?.sgpa ?? 0) >= 6 ? T.warning : T.danger },
          { label: 'Backlog Count', value: totalBacklogs, color: totalBacklogs > 0 ? T.danger : T.success },
          { label: 'Repeated Subjects', value: history.repeatSubjects.length, color: history.repeatSubjects.length > 0 ? T.warning : T.success },
        ].map(metric => (
          <Card key={metric.label} glow={metric.color} style={{ padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: metric.color }}>{metric.value}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>History Notes</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {history.advisoryNotes.map(note => <Chip key={note} color={T.blue} size={9}>{note}</Chip>)}
          {history.repeatSubjects.map(note => <Chip key={note} color={T.warning} size={9}>Repeat: {note}</Chip>)}
          {history.repeatSubjects.length === 0 && <Chip color={T.success} size={9}>No repeated subjects in transcript history</Chip>}
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 14 }}>
        {history.terms.map((term: TranscriptTerm) => (
          <Card key={term.termId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>{term.label}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{term.academicYear} · Registered credits: {term.registeredCredits} · Earned credits: {term.earnedCredits}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip color={term.sgpa >= 7 ? T.success : term.sgpa >= 6 ? T.warning : T.danger} size={9}>SGPA {term.sgpa.toFixed(2)}</Chip>
                <Chip color={term.backlogCount > 0 ? T.danger : T.success} size={9}>{term.backlogCount} backlogs</Chip>
              </div>
            </div>
            <HScrollArea>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Code', 'Subject', 'Credits', role === 'Mentor' ? 'Grade' : 'Score', 'Grade Point', 'Result'].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
                <tbody>
                  {term.subjects.map(subject => (
                    <tr key={`${term.termId}-${subject.code}`}>
                      <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{subject.code}</TD>
                      <TD style={{ ...sora, fontSize: 11, color: T.text }}>{subject.title}</TD>
                      <TD style={{ ...mono, fontSize: 11, color: T.text }}>{subject.credits}</TD>
                      <TD style={{ ...mono, fontSize: 11, color: subject.gradePoint >= 7 ? T.success : subject.gradePoint >= 4 ? T.warning : T.danger }}>{role === 'Mentor' ? subject.gradeLabel : `${subject.score}`}</TD>
                      <TD style={{ ...mono, fontSize: 11, color: subject.gradePoint >= 7 ? T.success : subject.gradePoint >= 4 ? T.warning : T.danger }}>{subject.gradePoint}</TD>
                      <TD><Chip color={subject.result === 'Failed' ? T.danger : subject.result === 'Repeated' ? T.warning : T.success} size={9}>{subject.result}</Chip></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HScrollArea>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}
