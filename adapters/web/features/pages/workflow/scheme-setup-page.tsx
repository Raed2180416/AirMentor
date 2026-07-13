import { useEffect, useState } from 'react'
import { T, mono, sora, type Offering } from '@web/simulation/fixtures'
import type { AssessmentComponentDefinition, Role, SchemeState } from '@kernel/shared/domain'
import { sanitizeAssessmentComponents, sumComponentWeightage } from '@web/shared/state/selectors'
import { clampNumber } from '@web/shared/state/page-utils'
import { Btn, Card, Chip, PageBackButton, PageShell } from '@web/shared/ui/primitives'

const COURSEWORK_COMPONENT_POOL_LIMIT = 5

function componentCountOptions(policyMax: number) {
  const safeMax = Math.max(0, Math.min(COURSEWORK_COMPONENT_POOL_LIMIT, Math.round(policyMax)))
  return Array.from({ length: safeMax + 1 }, (_, index) => index)
}

export function SchemeSetupPage({
  role,
  offering,
  scheme,
  hasEntryStarted,
  onSave,
  onBack,
}: {
  role: Role
  offering: Offering
  scheme: SchemeState
  hasEntryStarted: boolean
  onSave: (next: SchemeState) => void
  onBack: () => void
}) {
  const [termTestWeights, setTermTestWeights] = useState(scheme.termTestWeights)
  const [quizCount, setQuizCount] = useState<number>(scheme.quizCount)
  const [assignmentCount, setAssignmentCount] = useState<number>(scheme.assignmentCount)
  const [quizComponents, setQuizComponents] = useState<AssessmentComponentDefinition[]>(scheme.quizComponents)
  const [assignmentComponents, setAssignmentComponents] = useState<AssessmentComponentDefinition[]>(scheme.assignmentComponents)
  const canEdit = role === 'Course Leader' && !hasEntryStarted && scheme.status !== 'Locked'
  const maxQuizCount = Math.min(COURSEWORK_COMPONENT_POOL_LIMIT, Math.max(0, scheme.policyContext.maxQuizzes))
  const maxAssignmentCount = Math.min(COURSEWORK_COMPONENT_POOL_LIMIT, Math.max(0, scheme.policyContext.maxAssignments))
  const quizCountOptions = componentCountOptions(maxQuizCount)
  const assignmentCountOptions = componentCountOptions(maxAssignmentCount)
  const quizWeightTotal = sumComponentWeightage(quizComponents)
  const assignmentWeightTotal = sumComponentWeightage(assignmentComponents)
  const configuredCeWeight = termTestWeights.tt1 + termTestWeights.tt2 + quizWeightTotal + assignmentWeightTotal
  const remainingCeWeight = scheme.policyContext.ce - configuredCeWeight

  useEffect(() => {
    setTermTestWeights(scheme.termTestWeights)
    setQuizCount(scheme.quizCount)
    setAssignmentCount(scheme.assignmentCount)
    setQuizComponents(scheme.quizComponents)
    setAssignmentComponents(scheme.assignmentComponents)
  }, [scheme])

  useEffect(() => {
    const nextCount = Math.min(quizCount, maxQuizCount)
    if (nextCount !== quizCount) {
      setQuizCount(nextCount)
      return
    }
    setQuizComponents(prev => sanitizeAssessmentComponents('quiz', nextCount, prev, sumComponentWeightage(prev)))
  }, [maxQuizCount, quizCount])

  useEffect(() => {
    const nextCount = Math.min(assignmentCount, maxAssignmentCount)
    if (nextCount !== assignmentCount) {
      setAssignmentCount(nextCount)
      return
    }
    setAssignmentComponents(prev => sanitizeAssessmentComponents('assignment', nextCount, prev, sumComponentWeightage(prev)))
  }, [assignmentCount, maxAssignmentCount])

  return (
    <PageShell size="narrow">
      <PageBackButton onClick={onBack} />
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Evaluation Scheme Setup</div>
        <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 4 }}>{offering.code} · {offering.title} · Sec {offering.section}</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Sysadmin owns the CE / SEE policy. Course leaders only configure the internal CE weightage breakdown before entry begins.</div>
      </div>

      <Card glow={canEdit ? T.accent : T.warning} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Chip color={scheme.status === 'Locked' ? T.danger : scheme.status === 'Configured' ? T.success : T.warning} size={9}>Status: {scheme.status}</Chip>
          <Chip color={T.accent} size={9}>Role: {role}</Chip>
          <Chip color={hasEntryStarted ? T.danger : T.success} size={9}>{hasEntryStarted ? 'Entry already started' : 'No entry started yet'}</Chip>
        </div>
        {!canEdit && <div style={{ ...mono, fontSize: 11, color: T.warning }}>{role !== 'Course Leader' ? 'This screen is inspect-only outside the course-leader workflow.' : 'Scheme changes are blocked after entry begins. Use HoD unlock/reset flow if a reset is required.'}</div>}
      </Card>

      <div style={{ display: 'grid', gap: 12 }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 12 }}>Sysadmin Policy Context</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>CE Weight</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{scheme.policyContext.ce}</div></Card>
            <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>SEE Weight</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{scheme.policyContext.see}</div></Card>
            <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Max Term Tests</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{scheme.policyContext.maxTermTests}</div></Card>
            <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Max Quizzes</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{scheme.policyContext.maxQuizzes}</div></Card>
            <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Max Assignments</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{scheme.policyContext.maxAssignments}</div></Card>
            <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>SEE Raw Max</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{scheme.finalsMax}</div></Card>
          </div>
        </Card>

        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 12 }}>Internal CE Breakdown</div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>TT1 Weight</div>
                <input aria-label="TT1 contribution weight" disabled={!canEdit || scheme.policyContext.maxTermTests === 0} type="number" min={0} max={scheme.policyContext.ce} value={termTestWeights.tt1} onChange={event => setTermTestWeights(prev => ({ ...prev, tt1: clampNumber(Number(event.target.value) || 0, 0, scheme.policyContext.ce) }))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px', width: '100%' }} />
              </div>
              <div>
                <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>TT2 Weight</div>
                <input aria-label="TT2 contribution weight" disabled={!canEdit || scheme.policyContext.maxTermTests < 2} type="number" min={0} max={scheme.policyContext.ce} value={scheme.policyContext.maxTermTests < 2 ? 0 : termTestWeights.tt2} onChange={event => setTermTestWeights(prev => ({ ...prev, tt2: clampNumber(Number(event.target.value) || 0, 0, scheme.policyContext.ce) }))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px', width: '100%' }} />
              </div>
            </div>
            <Card glow={remainingCeWeight === 0 ? T.success : T.warning} style={{ padding: 12, background: T.surface2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Configured CE Weight</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>TT1 {termTestWeights.tt1} + TT2 {scheme.policyContext.maxTermTests < 2 ? 0 : termTestWeights.tt2} + Quiz {quizWeightTotal} + Assignment {assignmentWeightTotal}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: remainingCeWeight === 0 ? T.success : T.warning }}>{configuredCeWeight}/{scheme.policyContext.ce}</div>
                  <div style={{ ...mono, fontSize: 10, color: remainingCeWeight === 0 ? T.success : T.warning }}>Remaining CE pool: {remainingCeWeight}</div>
                </div>
              </div>
            </Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
            <select aria-label="Quiz count" value={quizCount} disabled={!canEdit} onChange={event => setQuizCount(Number(event.target.value))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
              {quizCountOptions.map(count => <option key={count} value={count}>Quiz count {count}</option>)}
            </select>
            <select aria-label="Assignment count" value={assignmentCount} disabled={!canEdit} onChange={event => setAssignmentCount(Number(event.target.value))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
              {assignmentCountOptions.map(count => <option key={count} value={count}>Assignment count {count}</option>)}
            </select>
            <div style={{ ...mono, fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center' }}>
              Components scale against their raw maxima and CE weightage. Course leaders can use the configured pool before entry starts.
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>Quiz Components</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {quizComponents.length === 0 && <div style={{ ...mono, fontSize: 11, color: T.dim }}>No quiz components in this scheme.</div>}
                {quizComponents.map((component, index) => (
                  <div key={component.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 0.7fr', gap: 8 }}>
                    <input aria-label={`Quiz component ${index + 1} label`} disabled={!canEdit} value={component.label} onChange={event => setQuizComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                    <input aria-label={`Quiz component ${index + 1} raw max`} disabled={!canEdit} type="number" min={1} max={100} value={component.rawMax} onChange={event => setQuizComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, rawMax: clampNumber(Number(event.target.value) || 1, 1, 100) } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                    <input aria-label={`Quiz component ${index + 1} weightage`} disabled={!canEdit} type="number" min={0} max={scheme.policyContext.ce} value={component.weightage} onChange={event => setQuizComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, weightage: clampNumber(Number(event.target.value) || 0, 0, scheme.policyContext.ce) } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>Assignment Components</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {assignmentComponents.length === 0 && <div style={{ ...mono, fontSize: 11, color: T.dim }}>No assignment components in this scheme.</div>}
                {assignmentComponents.map((component, index) => (
                  <div key={component.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 0.7fr', gap: 8 }}>
                    <input aria-label={`Assignment component ${index + 1} label`} disabled={!canEdit} value={component.label} onChange={event => setAssignmentComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                    <input aria-label={`Assignment component ${index + 1} raw max`} disabled={!canEdit} type="number" min={1} max={100} value={component.rawMax} onChange={event => setAssignmentComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, rawMax: clampNumber(Number(event.target.value) || 1, 1, 100) } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                    <input aria-label={`Assignment component ${index + 1} weightage`} disabled={!canEdit} type="number" min={0} max={scheme.policyContext.ce} value={component.weightage} onChange={event => setAssignmentComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, weightage: clampNumber(Number(event.target.value) || 0, 0, scheme.policyContext.ce) } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Btn size="sm" variant="ghost" onClick={onBack}>Cancel</Btn>
          <Btn size="sm" disabled={!canEdit || remainingCeWeight !== 0} onClick={() => {
            if (remainingCeWeight !== 0) return
            onSave({
              finalsMax: scheme.finalsMax,
              termTestWeights: {
                tt1: scheme.policyContext.maxTermTests === 0 ? 0 : termTestWeights.tt1,
                tt2: scheme.policyContext.maxTermTests < 2 ? 0 : termTestWeights.tt2,
              },
              quizWeight: sumComponentWeightage(sanitizeAssessmentComponents('quiz', quizCount, quizComponents)),
              assignmentWeight: sumComponentWeightage(sanitizeAssessmentComponents('assignment', assignmentCount, assignmentComponents)),
              quizCount,
              assignmentCount,
              quizComponents: sanitizeAssessmentComponents('quiz', quizCount, quizComponents),
              assignmentComponents: sanitizeAssessmentComponents('assignment', assignmentCount, assignmentComponents),
              policyContext: scheme.policyContext,
              status: 'Configured',
              configuredAt: Date.now(),
              lastEditedBy: role,
            })
          }}>Save Scheme</Btn>
        </div>
      </div>
    </PageShell>
  )
}
