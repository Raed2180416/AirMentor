import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Eye, Shield } from 'lucide-react'
import { CO_COLORS, CO_MAP, T, mono, sora, yearColor, type CODef, type Offering, type Student } from '../data'
import type {
  EntryKind,
  EntryLockMap,
  RiskBand,
  SchemeState,
  TTKind,
  TermTestBlueprint,
  TermTestNode,
} from '../domain'
import {
  addBlueprintPart,
  addBlueprintQuestion,
  computeEvaluation,
  normalizeBlueprint,
  removeBlueprintPart,
  removeBlueprintQuestion,
  useAppSelectors,
} from '../selectors'
import { TAB_DEFS, clampNumber } from '../page-utils'
import { Bar, Btn, Card, Chip, HScrollArea, PageShell, RiskBadge, TD, TH } from '../ui-primitives'

export function CourseDetail({
  offering: offering,
  onBack,
  onOpenStudent,
  onOpenEntryHub,
  onOpenSchemeSetup,
  initialTab,
  scheme,
  lockMap,
  blueprints,
  onUpdateBlueprint,
}: {
  offering: Offering
  onBack: () => void
  onOpenStudent: (student: Student) => void
  onOpenEntryHub: (kind: EntryKind) => void
  onOpenSchemeSetup: () => void
  initialTab?: string
  scheme: SchemeState
  lockMap: EntryLockMap
  blueprints: Record<TTKind, TermTestBlueprint>
  onUpdateBlueprint: (kind: TTKind, next: TermTestBlueprint) => void
}) {
  const { getStudentsPatched } = useAppSelectors()
  const [tab, setTab] = useState(initialTab ?? 'overview')
  const yearTint = yearColor(offering.year)
  const students = useMemo(() => getStudentsPatched(offering), [getStudentsPatched, offering])
  const cos = CO_MAP[offering.code] || CO_MAP.default
  const tabLocked = (tabId: string) => (tabId === 'tt2' && offering.stageInfo.stage < 2) || (tabId === 'risk' && offering.stage < 2)

  return (
    <PageShell size="wide" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: 0 }}>
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '16px 32px' }}>
        <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>← Back to Dashboard</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
              <Chip color={yearTint}>{offering.year}</Chip><Chip color={T.muted}>{offering.dept}</Chip>
              <Chip color={T.muted}>Sem {offering.sem}</Chip><Chip color={T.muted}>Sec {offering.section}</Chip>
              <Chip color={offering.stageInfo.color}>{offering.stageInfo.label} · {offering.stageInfo.desc}</Chip>
            </div>
            <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: T.text }}>
              <span style={{ color: yearTint }}>{offering.code}</span> — {offering.title}
            </div>
          </div>
          <Btn variant="ghost" size="sm">📥 Export</Btn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 14, maxWidth: 420 }}>
          {['Term Start', 'TT1', 'TT2', 'Finals'].map((label, index) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: index < 3 ? 1 : 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 10, fontWeight: 700, background: index < offering.stageInfo.stage ? offering.stageInfo.color : T.border2, border: `2px solid ${index < offering.stageInfo.stage ? offering.stageInfo.color : T.dim}`, color: index < offering.stageInfo.stage ? '#fff' : T.dim }}>
                {index < offering.stageInfo.stage ? '✓' : index + 1}
              </div>
              <span style={{ ...mono, fontSize: 8, color: T.dim, marginLeft: 4, whiteSpace: 'nowrap' }}>{label}</span>
              {index < 3 && <div style={{ flex: 1, height: 2, background: index < offering.stageInfo.stage - 1 ? offering.stageInfo.color : T.border, margin: '0 6px' }} />}
            </div>
          ))}
        </div>
        <HScrollArea style={{ display: 'flex', gap: 0, marginTop: 14, borderBottom: `1px solid ${T.border}`, marginBottom: -17, marginLeft: -32, marginRight: -32, paddingLeft: 32 }}>
          {TAB_DEFS.map(def => {
            const locked = tabLocked(def.id)
            return (
              <button
                key={def.id}
                onClick={() => !locked && setTab(def.id)}
                style={{ ...mono, fontSize: 11, padding: '9px 13px', background: 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', color: tab === def.id ? T.accentLight : locked ? T.dim : T.muted, borderBottom: `2px solid ${tab === def.id ? T.accent : 'transparent'}`, opacity: locked ? 0.35 : 1, whiteSpace: 'nowrap', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {def.icon} {def.label}{locked ? ' 🔒' : ''}
              </button>
            )
          })}
        </HScrollArea>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
        {tab === 'overview' && <OverviewTab offering={offering} cos={cos} students={students} setTab={setTab} />}
        {tab === 'risk' && <RiskTab offering={offering} students={students} onOpenStudent={onOpenStudent} />}
        {tab === 'attendance' && <AttendanceTab offering={offering} students={students} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('attendance')} />}
        {tab === 'tt1' && <TTTab ttNum={1} cos={cos} blueprint={blueprints.tt1} isLocked={lockMap.tt1} students={students} onChangeBlueprint={next => onUpdateBlueprint('tt1', next)} onOpenEntryHub={onOpenEntryHub} onOpenStudent={onOpenStudent} />}
        {tab === 'tt2' && <TTTab ttNum={2} cos={cos} blueprint={blueprints.tt2} isLocked={lockMap.tt2} students={students} onChangeBlueprint={next => onUpdateBlueprint('tt2', next)} onOpenEntryHub={onOpenEntryHub} onOpenStudent={onOpenStudent} />}
        {tab === 'quizzes' && <QuizzesTab students={students} scheme={scheme} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('quiz')} />}
        {tab === 'assignments' && <AssignmentsTab students={students} scheme={scheme} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('assignment')} />}
        {tab === 'co' && <COTab cos={cos} />}
        {tab === 'gradebook' && <GradeBookTab offering={offering} students={students} scheme={scheme} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('finals')} onOpenSchemeSetup={onOpenSchemeSetup} />}
      </div>
    </PageShell>
  )
}

function OverviewTab({ offering, cos, students, setTab }: { offering: Offering; cos: CODef[]; students: Student[]; setTab: (tab: string) => void }) {
  const detained = students.filter(student => student.present / student.totalClasses < 0.65).length
  const atRisk = students.filter(student => {
    const pct = student.present / student.totalClasses
    return pct >= 0.65 && pct < 0.75
  }).length
  const good = students.length - detained - atRisk
  const highRisk = students.filter(student => student.riskBand === 'High').length
  const checks = [
    { label: 'Attendance tracked', done: true, tab: 'attendance' },
    { label: 'TT1 paper CO mapped', done: offering.tt1Done, tab: 'tt1' },
    { label: 'TT1 marks entered', done: offering.tt1Done, tab: 'tt1' },
    { label: 'Quiz 1 marks entered', done: offering.tt1Done, tab: 'quizzes' },
    { label: 'Assignment 1 entered', done: false, tab: 'assignments' },
    { label: 'TT2 paper CO mapped', done: offering.stageInfo.stage > 2, tab: 'tt2' },
    { label: 'TT2 marks entered', done: offering.tt2Done, tab: 'tt2' },
    { label: 'Attendance finalised', done: offering.stageInfo.stage >= 3, tab: 'attendance' },
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
            <div key={check.label} onClick={() => setTab(check.tab)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: index < checks.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}>
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
              {[{ label: 'Enrolled', value: offering.count, color: T.accent }, { label: 'Good (≥75%)', value: good, color: T.success }, { label: 'At Risk (<75%)', value: atRisk, color: T.warning }, { label: 'Detained (<65%)', value: detained, color: T.danger }].map(metric => (
                <div key={metric.label} style={{ background: T.surface2, borderRadius: 7, padding: '10px 12px', border: `1px solid ${metric.color}18` }}>
                  <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: metric.color }}>{metric.value}</div>
                  <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
                </div>
              ))}
            </div>
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
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.danger }}>ML Risk Analysis</div>
              </div>
              <div style={{ ...mono, fontSize: 11, color: T.muted }}>{highRisk} students flagged as high risk</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 8 }}>{students.filter(student => student.riskBand === 'Medium').length} at medium risk</div>
              <Btn size="sm" onClick={() => setTab('risk')} variant="ghost">View Risk Analysis →</Btn>
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

function RiskTab({ offering, students, onOpenStudent }: { offering: Offering; students: Student[]; onOpenStudent: (student: Student) => void }) {
  const [filter, setFilter] = useState<'all' | RiskBand>('all')
  const atRisk = students.filter(student => student.riskProb !== null)
  const filtered = filter === 'all' ? atRisk : atRisk.filter(student => student.riskBand === filter)
  const sorted = [...filtered].sort((left, right) => (right.riskProb ?? 0) - (left.riskProb ?? 0))
  const high = atRisk.filter(student => student.riskBand === 'High').length
  const medium = atRisk.filter(student => student.riskBand === 'Medium').length
  const low = atRisk.filter(student => student.riskBand === 'Low').length
  const averageRisk = atRisk.length ? Math.round(atRisk.reduce((acc, student) => acc + (student.riskProb ?? 0), 0) / atRisk.length * 100) : 0

  return (
    <div style={{ padding: '24px 32px', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color={T.accent} /> Risk Analysis — {offering.code} Sec {offering.section}
          </div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>XGBoost prediction after TT1 · TreeSHAP explanations · {atRisk.length} students scored</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Average Risk', value: `${averageRisk}%`, color: averageRisk > 50 ? T.danger : averageRisk > 30 ? T.warning : T.success, filterValue: 'all' as const },
          { label: 'High Risk (≥70%)', value: String(high), color: T.danger, filterValue: 'High' as const },
          { label: 'Medium (35-70%)', value: String(medium), color: T.warning, filterValue: 'Medium' as const },
          { label: 'Low (<35%)', value: String(low), color: T.success, filterValue: 'Low' as const },
        ].map(metric => (
          <Card key={metric.label} glow={metric.color} style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => setFilter(metric.filterValue)}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: metric.color }}>{metric.value}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>Risk Distribution</div>
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
          <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Students by Risk ({filter === 'all' ? 'All' : filter})</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'High', 'Medium', 'Low'] as const).map(option => (
              <button key={option} onClick={() => setFilter(option)} style={{ ...mono, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${filter === option ? T.accent : T.border}`, background: filter === option ? `${T.accent}18` : 'transparent', color: filter === option ? T.accentLight : T.muted, cursor: 'pointer' }}>
                {option === 'all' ? 'All' : option}
              </button>
            ))}
          </div>
        </div>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['USN', 'Student', 'Risk', 'Attendance', 'TT1', 'Top Driver', 'What-If', ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {sorted.map(student => {
                const attendancePct = Math.round((student.present / student.totalClasses) * 100)
                return (
                  <tr key={student.id} onClick={() => onOpenStudent(student)} style={{ cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={event => (event.currentTarget.style.background = T.surface2)} onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 12, color: T.text, whiteSpace: 'nowrap' }}>{student.name}</TD>
                    <TD><RiskBadge band={student.riskBand} prob={student.riskProb} /></TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                        <Bar val={attendancePct} color={attendancePct >= 75 ? T.success : attendancePct >= 65 ? T.warning : T.danger} h={4} />
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>{attendancePct}%</span>
                      </div>
                    </TD>
                    <TD style={{ ...mono, fontSize: 11, color: student.tt1Score !== null ? (student.tt1Score / student.tt1Max >= 0.5 ? T.success : T.danger) : T.dim }}>{student.tt1Score !== null ? `${student.tt1Score}/${student.tt1Max}` : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.muted, maxWidth: 180 }}>{student.reasons[0]?.label || '—'}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.blue }}>{student.whatIf[0] ? `→ ${Math.round(student.whatIf[0].newRisk * 100)}%` : '—'}</TD>
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

function AttendanceTab({ offering, students, onOpenStudent, onOpenEntryHub }: { offering: Offering; students: Student[]; onOpenStudent: (student: Student) => void; onOpenEntryHub: () => void }) {
  const sorted = [...students].sort((left, right) => left.present / left.totalClasses - right.present / right.totalClasses)
  const stats = {
    good: students.filter(student => student.present / student.totalClasses >= 0.75).length,
    atRisk: students.filter(student => {
      const pct = student.present / student.totalClasses
      return pct >= 0.65 && pct < 0.75
    }).length,
    detained: students.filter(student => student.present / student.totalClasses < 0.65).length,
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Attendance Register — {offering.count} students</div>
        <Btn size="sm" onClick={onOpenEntryHub}>Enter Attendance via Data Entry Hub →</Btn>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {[{ label: 'Good ≥75%', value: stats.good, color: T.success }, { label: 'At Risk', value: stats.atRisk, color: T.warning }, { label: 'Detained <65%', value: stats.detained, color: T.danger }].map(metric => (
          <Card key={metric.label} style={{ flex: 1, padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: metric.color }}>{metric.value}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', 'Present / 45', 'Attendance', 'Risk', 'Status'].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {sorted.map((student, index) => {
                const pct = Math.round((student.present / student.totalClasses) * 100)
                const color = pct >= 75 ? T.success : pct >= 65 ? T.warning : T.danger
                return (
                  <tr key={student.id} onClick={() => onOpenStudent(student)} style={{ cursor: 'pointer' }} onMouseEnter={event => (event.currentTarget.style.background = T.surface2)} onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}>
                    <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{index + 1}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 12, color: T.text, whiteSpace: 'nowrap' }}>{student.name}</TD>
                    <TD style={{ ...mono, fontSize: 12, color: T.text }}>{student.present} / {student.totalClasses}</TD>
                    <TD><div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}><Bar val={pct} color={color} h={4} /><span style={{ ...mono, fontSize: 10, color }}>{pct}%</span></div></TD>
                    <TD><RiskBadge band={student.riskBand} prob={student.riskProb} /></TD>
                    <TD><Chip color={color} size={9}>{pct >= 75 ? 'Good' : pct >= 65 ? 'At Risk' : 'Detained'}</Chip></TD>
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

function TTTab({
  ttNum,
  cos,
  blueprint,
  isLocked,
  students,
  onChangeBlueprint,
  onOpenEntryHub,
  onOpenStudent,
}: {
  ttNum: number
  cos: CODef[]
  blueprint: TermTestBlueprint
  isLocked: boolean
  students: Student[]
  onChangeBlueprint: (next: TermTestBlueprint) => void
  onOpenEntryHub: (kind: EntryKind) => void
  onOpenStudent: (student: Student) => void
}) {
  const kind: TTKind = ttNum === 1 ? 'tt1' : 'tt2'
  const normalized = useMemo(() => normalizeBlueprint(kind, blueprint), [blueprint, kind])
  const totalMax = normalized.totalMarks
  const hasEnteredScores = students.some(student => (ttNum === 1 ? student.tt1Score : student.tt2Score) !== null)
  const canEdit = !isLocked && !hasEnteredScores

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
          <Btn size="sm" onClick={() => onOpenEntryHub(kind)}>Proceed to TT{ttNum} Entry →</Btn>
        </div>
      </div>

      <Card glow={totalMax === 25 ? T.success : T.warning} style={{ marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 11, color: totalMax === 25 ? T.success : T.warning }}>
          {totalMax === 25 ? 'Blueprint valid for university raw TT total of 25.' : 'Adjust question parts so the total raw marks equal 25 before entry.'}
        </div>
      </Card>

      {hasEnteredScores && !isLocked && (
        <Card glow={T.warning} style={{ marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>TT{ttNum} scores already exist for this class. Structural blueprint edits are frozen to avoid remapping existing marks onto a different question shape.</div>
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
                        <button
                          key={co.id}
                          disabled={!canEdit}
                          onClick={() => updateQuestion(question.id, current => ({
                            ...current,
                            children: (current.children ?? []).map((child, childIdx) => childIdx === leafIndex ? {
                              ...child,
                              cos: active ? child.cos.filter(id => id !== co.id) : [...child.cos, co.id],
                            } : child),
                          }))}
                          style={{ ...mono, fontSize: 9, padding: '4px 8px', borderRadius: 999, border: `1px solid ${active ? CO_COLORS[coIndex % CO_COLORS.length] : T.border}`, background: active ? `${CO_COLORS[coIndex % CO_COLORS.length]}18` : 'transparent', color: active ? CO_COLORS[coIndex % CO_COLORS.length] : T.muted, cursor: canEdit ? 'pointer' : 'default' }}
                        >
                          {co.id}
                        </button>
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
              {students.slice(0, 12).map(student => {
                const raw = ttNum === 1 ? student.tt1Score : student.tt2Score
                const scaled = raw !== null ? ((raw / Math.max(1, totalMax || 25)) * 15) : null
                return (
                  <tr key={student.id}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 11, color: T.text }}>{student.name}</TD>
                    <TD style={{ ...mono, fontSize: 11, color: raw !== null ? T.text : T.dim }}>{raw !== null ? `${raw}/${Math.max(1, totalMax || 25)}` : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, color: scaled !== null && scaled >= 7.5 ? T.success : T.warning }}>{scaled !== null ? scaled.toFixed(1) : '—'}</TD>
                    <TD><RiskBadge band={student.riskBand} prob={student.riskProb} /></TD>
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

function QuizzesTab({ students, scheme, onOpenStudent, onOpenEntryHub }: { students: Student[]; scheme: SchemeState; onOpenStudent: (student: Student) => void; onOpenEntryHub: () => void }) {
  const quizzes = scheme.quizComponents.map((component, index) => ({
    id: component.id,
    name: component.label,
    rawMax: component.rawMax,
    entered: students.some(student => (index === 0 ? student.quiz1 : student.quiz2) !== null),
  }))

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Quizzes <span style={{ ...mono, fontSize: 11, color: T.muted }}>— Dynamic scheme-aware components</span></div>
        <Btn size="sm" onClick={onOpenEntryHub}>Proceed to Quiz Entry →</Btn>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {quizzes.length === 0 && <Card style={{ flex: 1, padding: '14px 16px' }}><div style={{ ...mono, fontSize: 11, color: T.dim }}>No quiz components configured for this offering.</div></Card>}
        {quizzes.map(quiz => (
          <Card key={quiz.id} style={{ flex: 1, padding: '14px 16px' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{quiz.name}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Raw max: {quiz.rawMax}</div>
            <div style={{ marginTop: 8 }}><Chip color={quiz.entered ? T.success : T.warning}>{quiz.entered ? 'Entered' : 'Pending'}</Chip></div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', ...quizzes.map(quiz => `${quiz.name} /${quiz.rawMax}`), `Normalized /${scheme.quizWeight}`, ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {students.slice(0, 15).map((student, index) => (
                <tr key={student.id}>
                  <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{index + 1}</TD>
                  <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{student.name}</TD>
                  {quizzes.map((quiz, quizIndex) => {
                    const score = quizIndex === 0 ? student.quiz1 : student.quiz2
                    return <TD key={quiz.id} style={{ ...mono, fontSize: 12, color: score !== null ? T.text : T.dim }}>{score ?? '—'}</TD>
                  })}
                  <TD style={{ ...mono, fontSize: 12, color: T.muted }}>{computeEvaluation(student, scheme).quizScaled.toFixed(1)}</TD>
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

function AssignmentsTab({ students, scheme, onOpenStudent, onOpenEntryHub }: { students: Student[]; scheme: SchemeState; onOpenStudent: (student: Student) => void; onOpenEntryHub: () => void }) {
  const assignments = scheme.assignmentComponents.map((component, index) => ({
    id: component.id,
    label: component.label,
    rawMax: component.rawMax,
    entered: students.some(student => (index === 0 ? student.asgn1 : student.asgn2) !== null),
  }))

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Assignments</div>
        <Btn size="sm" onClick={onOpenEntryHub}>Proceed to Assignment Entry →</Btn>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {assignments.length === 0 && <Card style={{ flex: 1, padding: '14px 16px' }}><div style={{ ...mono, fontSize: 11, color: T.dim }}>No assignment components configured for this offering.</div></Card>}
        {assignments.map(assignment => (
          <Card key={assignment.id} style={{ flex: 1, padding: '14px 16px' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{assignment.label}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>Raw max: {assignment.rawMax}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}><Chip color={assignment.entered ? T.success : T.warning}>{assignment.entered ? 'Entered' : 'Pending'}</Chip></div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', ...assignments.map(item => `${item.label} /${item.rawMax}`), `Normalized /${scheme.assignmentWeight}`, ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {students.slice(0, 15).map((student, index) => (
                <tr key={student.id}>
                  <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{index + 1}</TD>
                  <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{student.name}</TD>
                  {assignments.map((assignment, assignmentIndex) => {
                    const score = assignmentIndex === 0 ? student.asgn1 : student.asgn2
                    return <TD key={assignment.id} style={{ ...mono, fontSize: 12, color: score !== null ? T.text : T.dim }}>{score ?? '—'}</TD>
                  })}
                  <TD style={{ ...mono, fontSize: 12, color: T.muted }}>{computeEvaluation(student, scheme).asgnScaled.toFixed(1)}</TD>
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

function COTab({ cos }: { cos: CODef[] }) {
  const target = 60
  const mockAttainments: Record<string, { tt1: number | null; asgn: number | null }> = {
    CO1: { tt1: 72, asgn: 78 },
    CO2: { tt1: 58, asgn: 65 },
    CO3: { tt1: 48, asgn: null },
    CO4: { tt1: null, asgn: null },
    CO5: { tt1: null, asgn: null },
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text, marginBottom: 16 }}>CO Attainment Report</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {cos.map((co, index) => {
          const attainment = mockAttainments[co.id]
          const value = attainment?.tt1
          const color = CO_COLORS[index % CO_COLORS.length]
          return (
            <Card key={co.id} glow={color} style={{ textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ ...mono, fontSize: 10, color, marginBottom: 4 }}>{co.id}</div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 28, color: value == null ? T.dim : value >= target ? T.success : T.danger }}>{value != null ? `${value}%` : '—'}</div>
              <div style={{ ...mono, fontSize: 9, color: T.dim, marginBottom: 6 }}>{value != null ? (value >= target ? '✓ Met' : '✗ Below') : 'No data'}</div>
              <div style={{ position: 'relative' }}>
                <Bar val={value ?? 0} color={value == null ? T.border : value >= target ? T.success : T.danger} h={6} />
                <div style={{ position: 'absolute', top: -1, left: `${target}%`, width: 1.5, height: 8, background: T.warning }} />
              </div>
            </Card>
          )
        })}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['CO', 'Description', 'Bloom', 'TT1', 'Assignment', 'Status'].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
          <tbody>
            {cos.map((co, index) => {
              const attainment = mockAttainments[co.id]
              const color = CO_COLORS[index % CO_COLORS.length]
              return (
                <tr key={co.id}>
                  <TD><Chip color={color} size={9}>{co.id}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 11, color: T.text, maxWidth: 200 }}>{co.desc}</TD>
                  <TD><Chip color={T.dim} size={9}>{co.bloom}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 700, color: attainment?.tt1 != null ? (attainment.tt1 >= target ? T.success : T.danger) : T.dim }}>{attainment?.tt1 != null ? `${attainment.tt1}%` : '—'}</TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 700, color: attainment?.asgn != null ? (attainment.asgn >= target ? T.success : T.danger) : T.dim }}>{attainment?.asgn != null ? `${attainment.asgn}%` : '—'}</TD>
                  <TD>{attainment?.tt1 != null ? (attainment.tt1 >= target ? <Chip color={T.success} size={9}>✓ Met</Chip> : <Chip color={T.danger} size={9}>✗ Below</Chip>) : <Chip color={T.dim} size={9}>Pending</Chip>}</TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function GradeBookTab({
  offering,
  students,
  scheme,
  onOpenStudent,
  onOpenEntryHub,
  onOpenSchemeSetup,
}: {
  offering: Offering
  students: Student[]
  scheme: SchemeState
  onOpenStudent: (student: Student) => void
  onOpenEntryHub: () => void
  onOpenSchemeSetup: () => void
}) {
  const { deriveAcademicProjection } = useAppSelectors()
  const schemeReady = scheme.status !== 'Needs Setup'

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
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>CE model: TT1+TT2 = 30/60 fixed. Quiz+Assignment = 30/60 variable. Final subject score uses exact score out of 100 before band mapping.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color={schemeReady ? T.success : T.warning} size={9}>Scheme: {scheme.status}</Chip>
          <Chip color={T.accent} size={9}>Quiz {scheme.quizWeight}</Chip>
          <Chip color={T.accent} size={9}>Assignment {scheme.assignmentWeight}</Chip>
          <Chip color={T.dim} size={9}>Quiz count {scheme.quizComponents.length}</Chip>
          <Chip color={T.dim} size={9}>Assignment count {scheme.assignmentComponents.length}</Chip>
          <Chip color={T.blue} size={9}>SEE raw max {scheme.finalsMax}</Chip>
        </div>
      </Card>
      {!schemeReady && <Card glow={T.warning} style={{ marginBottom: 12, padding: '10px 12px' }}><div style={{ ...mono, fontSize: 11, color: T.warning }}>Configure the evaluation scheme before starting marks entry. The current gradebook remains preview-only until then.</div></Card>}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <HScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['USN', 'Name', 'TT1 /15', 'TT2 /15', `Quiz /${scheme.quizWeight}`, `Asgn /${scheme.assignmentWeight}`, 'CE /60', `SEE /${scheme.finalsMax}`, 'Final /100', 'Band', 'Pred CGPA', 'Risk', ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
            <tbody>
              {students.slice(0, 20).map(student => {
                const projection = deriveAcademicProjection({ offering, student, scheme })
                return (
                  <tr key={student.id}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                    <TD style={{ ...sora, fontSize: 11, color: T.text, whiteSpace: 'nowrap' }}>{student.name}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: student.tt1Score !== null ? T.text : T.dim }}>{student.tt1Score !== null ? projection.tt1Scaled.toFixed(1) : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: student.tt2Score !== null ? T.text : T.dim }}>{student.tt2Score !== null ? projection.tt2Scaled.toFixed(1) : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: scheme.quizWeight === 0 ? T.dim : T.text }}>{scheme.quizWeight === 0 ? '—' : projection.quizScaled.toFixed(1)}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: scheme.assignmentWeight === 0 ? T.dim : T.text }}>{scheme.assignmentWeight === 0 ? '—' : projection.asgnScaled.toFixed(1)}</TD>
                    <TD style={{ ...mono, fontSize: 12, fontWeight: 700, textAlign: 'center', color: projection.ce60 >= 30 ? T.success : projection.ce60 >= 24 ? T.warning : T.danger }}>{projection.ce60.toFixed(1)}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: projection.seeRaw !== null ? T.text : T.dim }}>{projection.seeRaw !== null ? projection.seeRaw.toFixed(1) : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 12, fontWeight: 700, textAlign: 'center', color: projection.finalScore100 >= 60 ? T.success : projection.finalScore100 >= 40 ? T.warning : T.danger }}>{projection.finalScore100.toFixed(1)}</TD>
                    <TD><Chip color={projection.gradePoint >= 8 ? T.success : projection.gradePoint >= 4 ? T.warning : T.danger} size={9}>{projection.bandLabel}</Chip></TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: T.blue }}>{projection.predictedCgpa.toFixed(2)}</TD>
                    <TD><RiskBadge band={student.riskBand} prob={student.riskProb} /></TD>
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
