import { useMemo } from 'react'
import { Eye } from 'lucide-react'
import { CO_COLORS, T, mono, sora, type CODef, type Offering, type Student } from '@web/simulation/fixtures'
import type { EntryKind, TTKind, TermTestBlueprint, TermTestNode } from '@kernel/shared/domain'
import {
  addBlueprintPart,
  addBlueprintQuestion,
  normalizeBlueprint,
  removeBlueprintPart,
  removeBlueprintQuestion,
} from '@web/shared/state/selectors'
import { clampNumber } from '@web/shared/state/page-utils'
import { Btn, Card, Chip, HScrollArea, RiskBadge, TD, TH } from '@web/shared/ui/primitives'
import { CourseOutcomeControl } from './course-outcome-control'
import { hasRiskEvidence, isProofEvidenceVisible } from './stage-helpers'

export function TTTab({
  offering,
  ttNum,
  cos,
  blueprint,
  isLocked,
  students,
  proofStageKey,
  onChangeBlueprint,
  onOpenEntryHub,
  onOpenStudent,
}: {
  offering: Offering
  ttNum: number
  cos: CODef[]
  blueprint: TermTestBlueprint
  isLocked: boolean
  students: Student[]
  proofStageKey?: string | null
  onChangeBlueprint: (next: TermTestBlueprint) => void
  onOpenEntryHub: (kind: EntryKind) => void
  onOpenStudent: (student: Student) => void
}) {
  const kind: TTKind = ttNum === 1 ? 'tt1' : 'tt2'
  const normalized = useMemo(() => normalizeBlueprint(kind, blueprint), [blueprint, kind])
  const totalMax = normalized.totalMarks
  const scoresVisible = isProofEvidenceVisible(proofStageKey, kind)
  const hasEnteredScores = students.some(student => (ttNum === 1 ? student.tt1Score : student.tt2Score) !== null)
  const canEdit = !isLocked && !hasEnteredScores
  const blueprintReady = totalMax === 25

  const commitBlueprint = (nextBlueprint: TermTestBlueprint) => {
    onChangeBlueprint(normalizeBlueprint(kind, nextBlueprint))
  }

  const updateQuestion = (questionId: string, updater: (question: TermTestNode) => TermTestNode) => {
    commitBlueprint({
      ...normalized,
      nodes: normalized.nodes.map(node => node.id === questionId ? updater(node) : node),
    })
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>TT{ttNum} Blueprint Builder</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>Raw total must equal 25. Question and part numbering auto-renumber after structural edits so the entry grid keeps a deterministic shape.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip color={totalMax === 25 ? T.success : T.danger} size={9}>Total {totalMax}/25</Chip>
          {isLocked && <Chip color={T.warning} size={9}>Locked</Chip>}
          {hasEnteredScores && !isLocked && <Chip color={T.warning} size={9}>Structure Frozen</Chip>}
          {!isLocked && !hasEnteredScores && <Btn size="sm" variant="ghost" onClick={() => onChangeBlueprint(addBlueprintQuestion(kind, normalized, cos[0]?.id))}>Add Question</Btn>}
          <Btn
            size="sm"
            disabled={!blueprintReady}
            title={blueprintReady ? `Proceed to TT${ttNum} entry` : 'Set the TT raw total to exactly 25 before entry.'}
            onClick={() => onOpenEntryHub(kind)}
          >
            Proceed to TT{ttNum} Entry →
          </Btn>
        </div>
      </div>

      <Card glow={totalMax === 25 ? T.success : T.warning} style={{ marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 11, color: totalMax === 25 ? T.success : T.warning }}>
          {totalMax === 25 ? 'Blueprint valid for university raw TT total of 25.' : 'Adjust question parts so the total raw marks equal 25 before entry.'}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>Course Outcomes</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cos.map((co, coIndex) => (
            <CourseOutcomeControl
              key={co.id}
              co={co}
              active
              color={CO_COLORS[coIndex % CO_COLORS.length]}
              disabled={false}
              onClick={() => undefined}
            />
          ))}
        </div>
      </Card>

      {hasEnteredScores && !isLocked && (
        <Card glow={T.warning} style={{ marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>TT{ttNum} scores already exist for this class. Structural blueprint edits are frozen to avoid remapping existing marks onto a different question shape.</div>
        </Card>
      )}
      {!scoresVisible && (
        <Card glow={T.blue} style={{ marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 11, color: T.blue }}>TT{ttNum} marks are intentionally hidden until the proof playback reaches post-TT{ttNum}. The seeded future rows stay available to the simulation, but this checkpoint view does not leak them.</div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {normalized.nodes.map(question => (
          <Card key={question.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input readOnly value={question.label} aria-label={`Canonical question label ${question.label}`} title="Question numbering is generated automatically" style={{ width: 70, ...mono, fontSize: 11, background: T.surface3, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 8px', cursor: 'default' }} />
                <input disabled={!canEdit} value={question.text} onChange={event => updateQuestion(question.id, current => ({ ...current, text: event.target.value }))} style={{ minWidth: 260, flex: 1, ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 8px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip color={T.accent} size={9}>{question.maxMarks} marks</Chip>
                {canEdit && <Btn size="sm" variant="ghost" onClick={() => onChangeBlueprint(addBlueprintPart(kind, normalized, question.id, cos[0]?.id))}>Add Part</Btn>}
                {canEdit && normalized.nodes.length > 1 && <Btn size="sm" variant="danger" onClick={() => onChangeBlueprint(removeBlueprintQuestion(kind, normalized, question.id))}>Remove</Btn>}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {(question.children ?? []).map((leaf, leafIndex) => (
                <div key={leaf.id} style={{ background: T.surface2, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 88px auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input readOnly value={leaf.label} aria-label={`Canonical part label ${leaf.label}`} title="Part numbering is generated automatically" style={{ ...mono, fontSize: 11, background: T.surface3, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 8px', cursor: 'default' }} />
                    <input disabled={!canEdit} value={leaf.text} onChange={event => updateQuestion(question.id, current => ({
                      ...current,
                      children: (current.children ?? []).map((child, childIdx) => childIdx === leafIndex ? { ...child, text: event.target.value } : child),
                    }))} style={{ ...mono, fontSize: 11, background: T.bg, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 8px' }} />
                    <input disabled={!canEdit} type="number" min={1} max={25} value={leaf.maxMarks} onChange={event => updateQuestion(question.id, current => ({
                      ...current,
                      children: (current.children ?? []).map((child, childIdx) => childIdx === leafIndex ? { ...child, maxMarks: clampNumber(Number(event.target.value) || 1, 1, 25) } : child),
                    }))} style={{ ...mono, fontSize: 11, background: T.bg, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 8px' }} />
                    {canEdit && (question.children?.length ?? 0) > 1 && <Btn size="sm" variant="ghost" onClick={() => onChangeBlueprint(removeBlueprintPart(kind, normalized, question.id, leaf.id))}>Remove</Btn>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {cos.map((co, coIndex) => {
                      const active = leaf.cos.includes(co.id)
                      return (
                        <CourseOutcomeControl
                          key={co.id}
                          co={co}
                          active={active}
                          color={CO_COLORS[coIndex % CO_COLORS.length]}
                          disabled={!canEdit}
                          onClick={() => updateQuestion(question.id, current => ({
                            ...current,
                            children: (current.children ?? []).map((child, childIdx) => childIdx === leafIndex ? {
                              ...child,
                              cos: active ? child.cos.filter(id => id !== co.id) : [...child.cos, co.id],
                            } : child),
                          }))}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Current TT{ttNum} Student Snapshot</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Each student can be opened directly from here, and entry uses the deterministic leaf parts defined above.</div>
        </div>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['USN', 'Name', 'Raw Total', 'Scaled /15', 'Risk', ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {students.map(student => {
                const raw = scoresVisible ? (ttNum === 1 ? student.tt1Score : student.tt2Score) : null
                const scaled = raw !== null ? ((raw / Math.max(1, totalMax || 25)) * 15) : null
                return (
                  <tr key={student.id}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 11, color: T.text }}>{student.name}</TD>
                    <TD style={{ ...mono, fontSize: 11, color: raw !== null ? T.text : T.dim }}>{raw !== null ? `${raw}/${Math.max(1, totalMax || 25)}` : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, color: scaled !== null && scaled >= 7.5 ? T.success : T.warning }}>{scaled !== null ? scaled.toFixed(1) : '—'}</TD>
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
