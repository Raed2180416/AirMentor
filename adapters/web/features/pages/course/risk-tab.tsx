import { useState } from 'react'
import { ArrowUpRight, Shield } from 'lucide-react'
import { T, mono, sora, type Offering, type Student } from '@web/simulation/fixtures'
import type { RiskBand } from '@kernel/shared/domain'
import { Bar, Card, HScrollArea, RiskBadge, TD, TH } from '@web/shared/ui/primitives'
import { getAttendancePct, hasRiskEvidence } from './stage-helpers'

export function RiskTab({ offering, students, proofStageKey, onOpenStudent }: { offering: Offering; students: Student[]; proofStageKey?: string | null; onOpenStudent: (student: Student) => void }) {
  const [filter, setFilter] = useState<'all' | RiskBand>('all')
  const atRisk = students.filter(student => hasRiskEvidence(offering, student, proofStageKey))
  const filtered = filter === 'all' ? atRisk : atRisk.filter(student => student.riskBand === filter)
  const sorted = [...filtered].sort((left, right) => (right.riskProb ?? 0) - (left.riskProb ?? 0))
  const high = atRisk.filter(student => student.riskBand === 'High').length
  const medium = atRisk.filter(student => student.riskBand === 'Medium').length
  const low = atRisk.filter(student => student.riskBand === 'Low').length
  const averageRisk = atRisk.length ? Math.round(atRisk.reduce((acc, student) => acc + (student.riskProb ?? 0), 0) / atRisk.length * 100) : 0

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color={T.accent} /> Risk Watch — {offering.code} Sec {offering.section}
          </div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>Observable-only watch score from attendance, TT evidence, transcript history, and outcome attainment · {atRisk.length} students scored</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Average Watch Score', value: `${averageRisk}%`, color: averageRisk > 50 ? T.danger : averageRisk > 30 ? T.warning : T.success, filterValue: 'all' as const },
          { label: 'High Watch (≥70%)', value: String(high), color: T.danger, filterValue: 'High' as const },
          { label: 'Medium Watch (35-70%)', value: String(medium), color: T.warning, filterValue: 'Medium' as const },
          { label: 'Low Watch (<35%)', value: String(low), color: T.success, filterValue: 'Low' as const },
        ].map(metric => (
          <Card key={metric.label} glow={metric.color} style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => setFilter(metric.filterValue)}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: metric.color }}>{metric.value}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>Watch Distribution</div>
        <div style={{ display: 'flex', gap: 0, height: 20, borderRadius: 6, overflow: 'hidden' }}>
          {[{ value: high, color: T.danger }, { value: medium, color: T.warning }, { value: low, color: T.success }].map(metric => (
            <div key={metric.color} style={{ flex: metric.value || 0.1, background: metric.color, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: metric.value > 0 ? 30 : 0 }}>
              {metric.value > 0 && <span style={{ ...mono, fontSize: 9, color: '#fff', fontWeight: 700 }}>{metric.value}</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Students by Watch Band ({filter === 'all' ? 'All' : filter})</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'High', 'Medium', 'Low'] as const).map(option => (
              <button key={option} data-tab="true" onClick={() => setFilter(option)} style={{ ...mono, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${filter === option ? T.accent : T.border}`, background: filter === option ? `${T.accent}18` : 'transparent', color: filter === option ? T.accentLight : T.muted, cursor: 'pointer' }}>
                {option === 'all' ? 'All' : option}
              </button>
            ))}
          </div>
        </div>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['USN', 'Student', 'Watch', 'Attendance', 'TT1', 'Top Driver', ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {sorted.map(student => {
                const attendancePct = getAttendancePct(student)
                return (
                  <tr key={student.id} data-clickable-row="true" onClick={() => onOpenStudent(student)} style={{ cursor: 'pointer', transition: 'background 0.15s' }}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 12, color: T.text, whiteSpace: 'nowrap' }}>{student.name}</TD>
                    <TD><RiskBadge band={student.riskBand} prob={student.riskProb} /></TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                        <Bar val={attendancePct ?? 0} color={attendancePct == null ? T.dim : attendancePct >= 75 ? T.success : attendancePct >= 65 ? T.warning : T.danger} h={4} />
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>{attendancePct == null ? 'Not applicable yet' : `${attendancePct}%`}</span>
                      </div>
                    </TD>
                    <TD style={{ ...mono, fontSize: 11, color: student.tt1Score !== null ? (student.tt1Score / student.tt1Max >= 0.5 ? T.success : T.danger) : T.dim }}>{student.tt1Score !== null ? `${student.tt1Score}/${student.tt1Max}` : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.muted, maxWidth: 180 }}>{student.reasons[0]?.label || '—'}</TD>
                    <TD><button aria-label={`Open ${student.name} details`} title="Open student" onClick={event => { event.stopPropagation(); onOpenStudent(student) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><ArrowUpRight size={13} /></button></TD>
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
