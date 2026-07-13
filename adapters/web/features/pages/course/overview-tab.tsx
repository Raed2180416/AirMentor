import { AlertTriangle } from 'lucide-react'
import { CO_COLORS, T, mono, sora, type CODef, type Offering, type Student } from '@web/simulation/fixtures'
import type { SchemeState } from '@kernel/shared/domain'
import { getAssessmentComponentScore } from '@web/shared/state/selectors'
import { Bar, Btn, Card, Chip } from '@web/shared/ui/primitives'
import { hasRiskEvidence, isProofEvidenceVisible } from './stage-helpers'

export function OverviewTab({ offering, cos, students, scheme, proofStageKey, setTab }: { offering: Offering; cos: CODef[]; students: Student[]; scheme: SchemeState; proofStageKey?: string | null; setTab: (tab: string) => void }) {
  const studentsWithAttendance = students.filter(student => student.totalClasses > 0)
  const detained = studentsWithAttendance.filter(student => student.present / student.totalClasses < 0.65).length
  const atRisk = studentsWithAttendance.filter(student => {
    const pct = student.present / student.totalClasses
    return pct >= 0.65 && pct < 0.75
  }).length
  const good = studentsWithAttendance.filter(student => student.present / student.totalClasses >= 0.75).length
  const studentsWithRisk = students.filter(student => hasRiskEvidence(offering, student, proofStageKey))
  const highRisk = studentsWithRisk.filter(student => student.riskBand === 'High').length
  const hasAttendance = studentsWithAttendance.length > 0
  const hasTt1Scores = isProofEvidenceVisible(proofStageKey, 'tt1') && students.some(student => student.tt1Score !== null)
  const hasTt2Scores = isProofEvidenceVisible(proofStageKey, 'tt2') && students.some(student => student.tt2Score !== null)
  const hasQuizScores = isProofEvidenceVisible(proofStageKey, 'coursework') && students.some(student =>
    scheme.quizComponents.some((component, index) => getAssessmentComponentScore(student, 'quiz', component, index) !== null),
  )
  const hasAssignmentScores = isProofEvidenceVisible(proofStageKey, 'coursework') && students.some(student =>
    scheme.assignmentComponents.some((component, index) => getAssessmentComponentScore(student, 'assignment', component, index) !== null),
  )
  const checks = [
    { label: 'Scheme configured', done: scheme.status !== 'Needs Setup', tab: 'gradebook' },
    { label: 'Attendance captured', done: hasAttendance, tab: 'attendance' },
    { label: 'TT1 marks entered', done: hasTt1Scores || offering.tt1Done, tab: 'tt1' },
    { label: 'Quiz marks entered', done: hasQuizScores, tab: 'quizzes' },
    { label: 'Assignment marks entered', done: hasAssignmentScores, tab: 'assignments' },
    { label: 'TT2 marks entered', done: hasTt2Scores || offering.tt2Done, tab: 'tt2' },
  ]
  const doneCount = checks.filter(check => check.done).length

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>Semester Checklist</div>
            <div style={{ ...mono, fontSize: 11, color: T.success }}>{doneCount}/{checks.length}</div>
          </div>
          <Bar val={doneCount} max={checks.length} color={T.success} h={6} />
          <div style={{ height: 12 }} />
          {checks.map((check, index) => (
            <div key={check.label} data-pressable="true" onClick={() => setTab(check.tab)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: index < checks.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}>
              <div style={{ width: 17, height: 17, borderRadius: '50%', flexShrink: 0, background: check.done ? '#10b98120' : T.surface3, border: `2px solid ${check.done ? T.success : T.dim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: T.success }}>{check.done ? '✓' : ''}</div>
              <span style={{ ...mono, fontSize: 11, color: check.done ? T.muted : T.text, flex: 1, textDecoration: check.done ? 'line-through' : 'none' }}>{check.label}</span>
              {!check.done && <span style={{ ...mono, fontSize: 10, color: T.accent }}>→</span>}
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 12 }}>Class Health</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ label: 'Enrolled', value: students.length, color: T.accent }, { label: 'Good (≥75%)', value: good, color: T.success }, { label: 'At Risk (<75%)', value: atRisk, color: T.warning }, { label: 'Detained (<65%)', value: detained, color: T.danger }].map(metric => (
                <div key={metric.label} style={{ background: T.surface2, borderRadius: 7, padding: '10px 12px', border: `1px solid ${metric.color}18` }}>
                  <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: metric.color }}>{metric.value}</div>
                  <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
                </div>
              ))}
            </div>
            {!hasAttendance && <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 10 }}>Attendance has not been captured yet for this class.</div>}
            <div style={{ display: 'flex', gap: 0, height: 7, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
              {[{ value: good, color: T.success }, { value: atRisk, color: T.warning }, { value: detained, color: T.danger }].map(metric => (
                <div key={metric.color} style={{ flex: metric.value || 0.1, background: metric.color, minWidth: metric.value > 0 ? 2 : 0 }} />
              ))}
            </div>
          </Card>

          {highRisk > 0 && (
            <Card glow={T.danger}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={14} color={T.danger} />
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.danger }}>Adaptive Reassessment</div>
              </div>
              <div style={{ ...mono, fontSize: 11, color: T.muted }}>{highRisk} students are in the high-watch band on the current evidence window</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 8 }}>{studentsWithRisk.filter(student => student.riskBand === 'Medium').length} remain on watch</div>
              <Btn size="sm" onClick={() => setTab('risk')} variant="ghost">Open Watchlist →</Btn>
            </Card>
          )}

          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Course Outcomes</div>
            {cos.slice(0, 4).map((co, index) => (
              <div key={co.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: index < Math.min(cos.length, 4) - 1 ? `1px solid ${T.border}` : 'none' }}>
                <Chip color={CO_COLORS[index % CO_COLORS.length]} size={9}>{co.id}</Chip>
                <div style={{ ...mono, fontSize: 10, color: T.muted, flex: 1, lineHeight: 1.4 }}>{co.desc.slice(0, 55)}…</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
