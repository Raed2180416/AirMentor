import { Eye } from 'lucide-react'
import { T, mono, sora, type Student } from '@web/simulation/fixtures'
import type { SchemeState } from '@kernel/shared/domain'
import { computeStageAwareEvaluation, getAssessmentComponentScore, sumComponentWeightage } from '@web/shared/state/selectors'
import { Btn, Card, Chip, HScrollArea, TD, TH } from '@web/shared/ui/primitives'
import { isProofEvidenceVisible } from './stage-helpers'

export function AssignmentsTab({ students, scheme, proofStageKey, onOpenStudent, onOpenEntryHub }: { students: Student[]; scheme: SchemeState; proofStageKey?: string | null; onOpenStudent: (student: Student) => void; onOpenEntryHub: () => void }) {
  const totalAssignmentWeight = sumComponentWeightage(scheme.assignmentComponents)
  const scoresVisible = isProofEvidenceVisible(proofStageKey, 'coursework')
  const assignments = scheme.assignmentComponents.map((component, index) => ({
    component,
    id: component.id,
    label: component.label,
    rawMax: component.rawMax,
    weightage: component.weightage,
    entered: scoresVisible && students.some(student => getAssessmentComponentScore(student, 'assignment', component, index) !== null),
  }))

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Assignments</div>
        <Btn size="sm" disabled={!scoresVisible && Boolean(proofStageKey)} title={scoresVisible ? 'Proceed to assignment entry' : 'Assignment evidence is hidden until post-assignments playback.'} onClick={onOpenEntryHub}>Proceed to Assignment Entry →</Btn>
      </div>
      {!scoresVisible && <Card glow={T.blue} style={{ marginBottom: 14 }}><div style={{ ...mono, fontSize: 11, color: T.blue }}>Assignment evidence is intentionally hidden until the proof playback reaches post-assignments.</div></Card>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {assignments.length === 0 && <Card style={{ flex: 1, padding: '14px 16px' }}><div style={{ ...mono, fontSize: 11, color: T.dim }}>No assignment components configured for this offering.</div></Card>}
        {assignments.map(assignment => (
          <Card key={assignment.id} style={{ flex: 1, padding: '14px 16px' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{assignment.label}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>Raw max: {assignment.rawMax} · Weightage: {assignment.weightage}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}><Chip color={assignment.entered ? T.success : T.warning}>{assignment.entered ? 'Entered' : 'Pending'}</Chip></div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', ...assignments.map(item => `${item.label} /${item.rawMax} · W${item.weightage}`), `Weighted /${totalAssignmentWeight}`, ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student.id}>
                  <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{index + 1}</TD>
                  <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{student.name}</TD>
                  {assignments.map((assignment, assignmentIndex) => {
                    const score = scoresVisible ? getAssessmentComponentScore(student, 'assignment', assignment.component, assignmentIndex) : null
                    return <TD key={assignment.id} style={{ ...mono, fontSize: 12, color: score !== null ? T.text : T.dim }}>{score ?? '—'}</TD>
                  })}
                  <TD style={{ ...mono, fontSize: 12, color: scoresVisible ? T.muted : T.dim }}>{scoresVisible ? computeStageAwareEvaluation(student, scheme, proofStageKey).asgnScaled.toFixed(1) : '—'}</TD>
                  <TD><button aria-label={`Open ${student.name} drawer`} title="Open student" onClick={() => onOpenStudent(student)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Eye size={13} /></button></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </HScrollArea>
      </Card>
    </div>
  )
}
