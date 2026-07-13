import { Eye } from 'lucide-react'
import { T, mono, sora, type Offering, type Student, type StudentHistoryRecord } from '@web/simulation/fixtures'
import type { SchemeState } from '@kernel/shared/domain'
import { useAppSelectors } from '@web/shared/state/selectors'
import { Btn, Card, Chip, HScrollArea, RiskBadge, TD, TH } from '@web/shared/ui/primitives'
import { hasRiskEvidence } from './stage-helpers'

export function GradeBookTab({
  offering,
  students,
  scheme,
  studentHistoryByUsn,
  proofStageKey,
  onOpenStudent,
  onOpenEntryHub,
  onOpenSchemeSetup,
}: {
  offering: Offering
  students: Student[]
  scheme: SchemeState
  studentHistoryByUsn?: Record<string, StudentHistoryRecord>
  proofStageKey?: string | null
  onOpenStudent: (student: Student) => void
  onOpenEntryHub: () => void
  onOpenSchemeSetup: () => void
}) {
  const { deriveAcademicProjection } = useAppSelectors()
  const schemeReady = scheme.status !== 'Needs Setup'
  const ceThresholds = {
    success: scheme.policyContext.ce * 0.5,
    warning: scheme.policyContext.ce * 0.4,
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Grade Book — CE Marks</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={onOpenSchemeSetup}>Open Scheme Setup</Btn>
          <Btn size="sm" onClick={onOpenEntryHub}>Proceed to SEE Entry →</Btn>
        </div>
      </div>
      <Card style={{ marginBottom: 12, padding: '10px 12px' }}>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>CE model follows the sysadmin policy: CE {scheme.policyContext.ce}, SEE {scheme.policyContext.see}. Raw SEE entry still uses the university exam max and is scaled automatically.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color={schemeReady ? T.success : T.warning} size={9}>Scheme: {scheme.status}</Chip>
          <Chip color={T.accent} size={9}>TT1 {scheme.termTestWeights.tt1}</Chip>
          <Chip color={T.accent} size={9}>TT2 {scheme.termTestWeights.tt2}</Chip>
          <Chip color={T.accent} size={9}>Quiz {scheme.quizWeight}</Chip>
          <Chip color={T.accent} size={9}>Assignment {scheme.assignmentWeight}</Chip>
          <Chip color={T.dim} size={9}>Quiz count {scheme.quizComponents.length}</Chip>
          <Chip color={T.dim} size={9}>Assignment count {scheme.assignmentComponents.length}</Chip>
          <Chip color={T.blue} size={9}>SEE {scheme.policyContext.see}</Chip>
          <Chip color={T.blue} size={9}>SEE raw max {scheme.finalsMax}</Chip>
        </div>
      </Card>
      {!schemeReady && <Card glow={T.warning} style={{ marginBottom: 12, padding: '10px 12px' }}><div style={{ ...mono, fontSize: 11, color: T.warning }}>Configure the evaluation scheme before starting marks entry. The current gradebook remains preview-only until then.</div></Card>}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['USN', 'Name', `TT1 /${scheme.termTestWeights.tt1}`, `TT2 /${scheme.termTestWeights.tt2}`, `Quiz /${scheme.quizWeight}`, `Asgn /${scheme.assignmentWeight}`, `CE /${scheme.policyContext.ce}`, `SEE /${scheme.policyContext.see}`, 'Final /100', 'Band', 'Pred CGPA', 'Risk', ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {students.map(student => {
                const projection = deriveAcademicProjection({ offering, student, scheme, history: studentHistoryByUsn?.[student.usn] ?? null, stageKey: proofStageKey })
                return (
                  <tr key={student.id}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 11, color: T.text, whiteSpace: 'nowrap' }}>{student.name}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: student.tt1Score !== null ? T.text : T.dim }}>{student.tt1Score !== null ? projection.tt1Scaled.toFixed(1) : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: student.tt2Score !== null ? T.text : T.dim }}>{student.tt2Score !== null ? projection.tt2Scaled.toFixed(1) : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: scheme.quizWeight === 0 ? T.dim : T.text }}>{scheme.quizWeight === 0 ? '—' : projection.quizScaled.toFixed(1)}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: scheme.assignmentWeight === 0 ? T.dim : T.text }}>{scheme.assignmentWeight === 0 ? '—' : projection.asgnScaled.toFixed(1)}</TD>
                    <TD style={{ ...mono, fontSize: 12, fontWeight: 700, textAlign: 'center', color: projection.ce60 >= ceThresholds.success ? T.success : projection.ce60 >= ceThresholds.warning ? T.warning : T.danger }}>{projection.ce60.toFixed(1)}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: projection.seeRaw !== null ? T.text : T.dim }}>{projection.seeRaw !== null ? projection.seeScaled40?.toFixed(1) ?? '—' : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 12, fontWeight: 700, textAlign: 'center', color: projection.finalScore100 != null ? (projection.finalScore100 >= 60 ? T.success : projection.finalScore100 >= 40 ? T.warning : T.danger) : T.dim }}>{projection.finalScore100?.toFixed(1) ?? '—'}</TD>
                    <TD><Chip color={projection.gradePoint != null ? (projection.gradePoint >= 8 ? T.success : projection.gradePoint >= 4 ? T.warning : T.danger) : T.dim} size={9}>{projection.bandLabel ?? '—'}</Chip></TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: T.blue }}>{projection.predictedCgpa?.toFixed(2) ?? '—'}</TD>
                    <TD>{hasRiskEvidence(offering, student, proofStageKey) ? <RiskBadge band={student.riskBand} prob={student.riskProb} /> : <Chip color={T.dim} size={9}>Not applicable yet</Chip>}</TD>
                    <TD><button aria-label={`Open ${student.name} drawer`} title="Open student" onClick={() => onOpenStudent(student)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Eye size={13} /></button></TD>
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
