import { Eye } from 'lucide-react'
import { T, mono, sora, type Student } from '@web/simulation/fixtures'
import type { SchemeState } from '@kernel/shared/domain'
import { computeStageAwareEvaluation, getAssessmentComponentScore, sumComponentWeightage } from '@web/shared/state/selectors'
import { Btn, Card, Chip, HScrollArea, TD, TH } from '@web/shared/ui/primitives'
import { isProofEvidenceVisible } from './stage-helpers'

export function QuizzesTab({ students, scheme, proofStageKey, onOpenStudent, onOpenEntryHub }: { students: Student[]; scheme: SchemeState; proofStageKey?: string | null; onOpenStudent: (student: Student) => void; onOpenEntryHub: () => void }) {
  const totalQuizWeight = sumComponentWeightage(scheme.quizComponents)
  const scoresVisible = isProofEvidenceVisible(proofStageKey, 'coursework')
  const quizzes = scheme.quizComponents.map((component, index) => ({
    component,
    id: component.id,
    name: component.label,
    rawMax: component.rawMax,
    weightage: component.weightage,
    entered: scoresVisible && students.some(student => getAssessmentComponentScore(student, 'quiz', component, index) !== null),
  }))

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Quizzes <span style={{ ...mono, fontSize: 11, color: T.muted }}>— Dynamic scheme-aware components</span></div>
        <Btn size="sm" disabled={!scoresVisible && Boolean(proofStageKey)} title={scoresVisible ? 'Proceed to quiz entry' : 'Quiz evidence is hidden until post-assignments playback.'} onClick={onOpenEntryHub}>Proceed to Quiz Entry →</Btn>
      </div>
      {!scoresVisible && <Card glow={T.blue} style={{ marginBottom: 14 }}><div style={{ ...mono, fontSize: 11, color: T.blue }}>Quiz evidence is intentionally hidden until the proof playback reaches post-assignments.</div></Card>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {quizzes.length === 0 && <Card style={{ flex: 1, padding: '14px 16px' }}><div style={{ ...mono, fontSize: 11, color: T.dim }}>No quiz components configured for this offering.</div></Card>}
        {quizzes.map(quiz => (
          <Card key={quiz.id} style={{ flex: 1, padding: '14px 16px' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{quiz.name}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Raw max: {quiz.rawMax} · Weightage: {quiz.weightage}</div>
            <div style={{ marginTop: 8 }}><Chip color={quiz.entered ? T.success : T.warning}>{quiz.entered ? 'Entered' : 'Pending'}</Chip></div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', ...quizzes.map(quiz => `${quiz.name} /${quiz.rawMax} · W${quiz.weightage}`), `Weighted /${totalQuizWeight}`, ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student.id}>
                  <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{index + 1}</TD>
                  <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{student.name}</TD>
                  {quizzes.map((quiz, quizIndex) => {
                    const score = scoresVisible ? getAssessmentComponentScore(student, 'quiz', quiz.component, quizIndex) : null
                    return <TD key={quiz.id} style={{ ...mono, fontSize: 12, color: score !== null ? T.text : T.dim }}>{score ?? '—'}</TD>
                  })}
                  <TD style={{ ...mono, fontSize: 12, color: scoresVisible ? T.muted : T.dim }}>{scoresVisible ? computeStageAwareEvaluation(student, scheme, proofStageKey).quizScaled.toFixed(1) : '—'}</TD>
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
