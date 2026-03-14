import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import {
  OFFERINGS,
  PAPER_MAP,
  T,
  mono,
  sora,
  type Offering,
  type Student,
  type StudentHistoryRecord,
  type TranscriptTerm,
} from '../data'
import type {
  AssessmentComponentDefinition,
  EntryKind,
  EntryLockMap,
  FacultyCapabilitySet,
  QueueTransition,
  Role,
  RiskBand,
  SchemeState,
  StudentRuntimePatch,
  TaskType,
  TTKind,
  TermTestBlueprint,
} from '../domain'
import {
  defaultSchemeForOffering,
  flattenBlueprintLeaves,
  getEntryLockMap,
  sanitizeAssessmentComponents,
  seedBlueprintFromPaper,
  useAppSelectors,
} from '../selectors'
import {
  ENTRY_CATALOG,
  clampNumber,
  getEntryAccessState,
  inferKindFromPendingAction,
  parseInputValue,
  shouldBlockNumericKey,
  toCellKey,
} from '../page-utils'
import { Bar, Btn, Card, Chip, HScrollArea, PageShell, TD, TH } from '../ui-primitives'

export function AllStudentsPage({
  offerings,
  onOpenStudent,
  onOpenHistory,
  onOpenUpload,
}: {
  offerings: Offering[]
  onOpenStudent: (student: Student, offering: Offering) => void
  onOpenHistory: (student: Student, offering: Offering) => void
  onOpenUpload: (offering: Offering, kind: EntryKind) => void
}) {
  const { getStudentsPatched } = useAppSelectors()
  const [query, setQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [selectedRisk, setSelectedRisk] = useState<'all' | RiskBand>('all')

  const rows = useMemo(() => offerings.flatMap(offering => getStudentsPatched(offering).map(student => {
    const attendancePct = Math.round((student.present / Math.max(1, student.totalClasses)) * 100)
    return { offering, student, attendancePct }
  })), [getStudentsPatched, offerings])

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase()
    const riskOrder: Record<RiskBand, number> = { High: 0, Medium: 1, Low: 2 }
    const normalizeRiskBand = (band: Student['riskBand']): RiskBand => band ?? 'Low'
    return rows
      .filter(item => {
        if (selectedYear !== 'all' && item.offering.year !== selectedYear) return false
        if (selectedCourse !== 'all' && item.offering.code !== selectedCourse) return false
        if (selectedRisk !== 'all' && normalizeRiskBand(item.student.riskBand) !== selectedRisk) return false
        if (!search) return true
        return item.student.name.toLowerCase().includes(search) || item.student.usn.toLowerCase().includes(search)
      })
      .sort((left, right) => {
        const byRisk = riskOrder[normalizeRiskBand(left.student.riskBand)] - riskOrder[normalizeRiskBand(right.student.riskBand)]
        if (byRisk !== 0) return byRisk
        const leftProb = left.student.riskProb ?? 0
        const rightProb = right.student.riskProb ?? 0
        if (leftProb !== rightProb) return rightProb - leftProb
        return left.student.name.localeCompare(right.student.name)
      })
  }, [query, rows, selectedCourse, selectedRisk, selectedYear])

  const yearOptions = useMemo(() => Array.from(new Set(offerings.map(offering => offering.year))), [offerings])
  const courseOptions = useMemo(() => Array.from(new Set(offerings.map(offering => offering.code))), [offerings])

  return (
    <PageShell size="wide">
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>All Students</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 14 }}>Single integrated roster for profile review, transcript history, and direct data-entry continuation.</div>

      <Card style={{ marginBottom: 14, padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
          <input aria-label="Search student by name or USN" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name / USN" style={{ ...mono, fontSize: 11, borderRadius: 6, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '8px 10px' }} />
          <select aria-label="Filter by year" value={selectedYear} onChange={event => setSelectedYear(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 6, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '8px 10px' }}>
            <option value="all">All Years</option>
            {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <select aria-label="Filter by course" value={selectedCourse} onChange={event => setSelectedCourse(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 6, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '8px 10px' }}>
            <option value="all">All Courses</option>
            {courseOptions.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
          <select aria-label="Filter by risk" value={selectedRisk} onChange={event => setSelectedRisk(event.target.value as 'all' | RiskBand)} style={{ ...mono, fontSize: 11, borderRadius: 6, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '8px 10px' }}>
            <option value="all">All Risk Bands</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 8 }}>{filteredRows.length} students shown</div>
      </Card>

      <Card style={{ padding: 0 }}>
        <HScrollArea style={{ maxHeight: 560 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: T.surface }}>
              <tr>{['Student', 'USN', 'Class', 'Attendance', 'Risk', 'Actions'].map(header => <TH key={header}>{header}</TH>)}</tr>
            </thead>
            <tbody>
              {filteredRows.map(({ offering, student, attendancePct }) => {
                const riskColor = student.riskBand === 'High' ? T.danger : student.riskBand === 'Medium' ? T.warning : T.success
                return (
                  <tr key={`${offering.offId}-${student.id}`} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <TD><div style={{ ...sora, fontWeight: 600, fontSize: 12, color: T.text }}>{student.name}</div></TD>
                    <TD><span style={{ ...mono, fontSize: 11, color: T.muted }}>{student.usn}</span></TD>
                    <TD><span style={{ ...mono, fontSize: 11, color: T.muted }}>{offering.code} · {offering.year} · Sec {offering.section}</span></TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bar val={attendancePct} color={attendancePct >= 75 ? T.success : attendancePct >= 65 ? T.warning : T.danger} h={5} />
                        <span style={{ ...mono, fontSize: 10, color: T.muted, minWidth: 34 }}>{attendancePct}%</span>
                      </div>
                    </TD>
                    <TD><Chip color={riskColor} size={9}>{student.riskBand}{student.riskProb !== null ? ` · ${Math.round(student.riskProb * 100)}%` : ''}</Chip></TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn size="sm" variant="ghost" onClick={() => onOpenStudent(student, offering)}><Eye size={11} /> Profile</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => onOpenHistory(student, offering)}>History</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => onOpenUpload(offering, inferKindFromPendingAction(offering.pendingAction))}>Data Entry</Btn>
                      </div>
                    </TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </HScrollArea>
      </Card>
    </PageShell>
  )
}

export function StudentHistoryPage({ role, history, onBack }: { role: Role; history: StudentHistoryRecord; onBack: () => void }) {
  const latestTerm = history.terms[history.terms.length - 1]
  const totalBacklogs = history.terms.reduce((acc, term) => acc + term.backlogCount, 0)

  return (
    <PageShell size="standard">
      <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 22, color: T.text }}>Student History</div>
          <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 3 }}>{history.studentName} · {history.usn} · {history.program}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Semester-wise history for mentor review, academic follow-up, and later risk-model inputs.</div>
        </div>
        <Chip color={history.trend === 'Improving' ? T.success : history.trend === 'Declining' ? T.danger : T.warning} size={10}>{history.trend} trend</Chip>
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
  const [quizWeight, setQuizWeight] = useState(scheme.quizWeight)
  const [assignmentWeight, setAssignmentWeight] = useState(scheme.assignmentWeight)
  const [quizCount, setQuizCount] = useState<0 | 1 | 2>(scheme.quizCount)
  const [assignmentCount, setAssignmentCount] = useState<0 | 1 | 2>(scheme.assignmentCount)
  const [finalsMax, setFinalsMax] = useState<50 | 100>(scheme.finalsMax)
  const [quizComponents, setQuizComponents] = useState<AssessmentComponentDefinition[]>(scheme.quizComponents)
  const [assignmentComponents, setAssignmentComponents] = useState<AssessmentComponentDefinition[]>(scheme.assignmentComponents)
  const canEdit = !hasEntryStarted && scheme.status !== 'Locked'

  useEffect(() => {
    setQuizWeight(scheme.quizWeight)
    setAssignmentWeight(scheme.assignmentWeight)
    setQuizCount(scheme.quizCount)
    setAssignmentCount(scheme.assignmentCount)
    setFinalsMax(scheme.finalsMax)
    setQuizComponents(scheme.quizComponents)
    setAssignmentComponents(scheme.assignmentComponents)
  }, [scheme])

  useEffect(() => {
    setQuizComponents(prev => sanitizeAssessmentComponents('quiz', quizCount, prev))
  }, [quizCount])

  useEffect(() => {
    setAssignmentComponents(prev => sanitizeAssessmentComponents('assignment', assignmentCount, prev))
  }, [assignmentCount])

  return (
    <PageShell size="narrow">
      <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back</button>
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Evaluation Scheme Setup</div>
        <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 4 }}>{offering.code} · {offering.title} · Sec {offering.section}</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>TT1 and TT2 stay fixed at raw 25 + 25 normalised to 30. Configure the remaining CE split and SEE raw max before entry begins.</div>
      </div>

      <Card glow={canEdit ? T.accent : T.warning} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Chip color={scheme.status === 'Locked' ? T.danger : scheme.status === 'Configured' ? T.success : T.warning} size={9}>Status: {scheme.status}</Chip>
          <Chip color={T.accent} size={9}>Role: {role}</Chip>
          <Chip color={hasEntryStarted ? T.danger : T.success} size={9}>{hasEntryStarted ? 'Entry already started' : 'No entry started yet'}</Chip>
        </div>
        {!canEdit && <div style={{ ...mono, fontSize: 11, color: T.warning }}>Scheme changes are blocked after entry begins. Use HoD unlock/reset flow if a reset is required.</div>}
      </Card>

      <div style={{ display: 'grid', gap: 12 }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 12 }}>Fixed University Rules</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>TT1 raw max: 25</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>TT2 raw max: 25</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>TT1 + TT2 contribution inside CE: 30</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Quiz + Assignment contribution inside CE: 30</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>SEE contribution in final subject score: 40</div>
          </div>
        </Card>

        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 12 }}>Configurable CE / SEE Inputs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
            <select aria-label="Quiz weight" value={quizWeight} disabled={!canEdit} onChange={event => setQuizWeight(Number(event.target.value))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
              <option value={0}>Quiz weight 0</option>
              <option value={10}>Quiz weight 10</option>
              <option value={20}>Quiz weight 20</option>
              <option value={30}>Quiz weight 30</option>
            </select>
            <select aria-label="Assignment weight" value={assignmentWeight} disabled={!canEdit} onChange={event => setAssignmentWeight(Number(event.target.value))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
              <option value={0}>Assignment weight 0</option>
              <option value={10}>Assignment weight 10</option>
              <option value={20}>Assignment weight 20</option>
              <option value={30}>Assignment weight 30</option>
            </select>
            <select aria-label="Quiz count" value={quizCount} disabled={!canEdit} onChange={event => setQuizCount(Number(event.target.value) as 0 | 1 | 2)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
              <option value={0}>Quiz count 0</option>
              <option value={1}>Quiz count 1</option>
              <option value={2}>Quiz count 2</option>
            </select>
            <select aria-label="Assignment count" value={assignmentCount} disabled={!canEdit} onChange={event => setAssignmentCount(Number(event.target.value) as 0 | 1 | 2)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
              <option value={0}>Assignment count 0</option>
              <option value={1}>Assignment count 1</option>
              <option value={2}>Assignment count 2</option>
            </select>
            <select aria-label="Finals max" value={finalsMax} disabled={!canEdit} onChange={event => setFinalsMax(Number(event.target.value) as 50 | 100)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
              <option value={50}>SEE raw max 50</option>
              <option value={100}>SEE raw max 100</option>
            </select>
            <div style={{ ...mono, fontSize: 11, color: quizWeight + assignmentWeight === 30 ? T.success : T.danger, display: 'flex', alignItems: 'center' }}>
              Remaining CE split: {quizWeight + assignmentWeight}/30
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>Quiz Components</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {quizComponents.length === 0 && <div style={{ ...mono, fontSize: 11, color: T.dim }}>No quiz components in this scheme.</div>}
                {quizComponents.map((component, index) => (
                  <div key={component.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 8 }}>
                    <input aria-label={`Quiz component ${index + 1} label`} disabled={!canEdit} value={component.label} onChange={event => setQuizComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                    <input aria-label={`Quiz component ${index + 1} raw max`} disabled={!canEdit} type="number" min={1} max={100} value={component.rawMax} onChange={event => setQuizComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, rawMax: clampNumber(Number(event.target.value) || 1, 1, 100) } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>Assignment Components</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {assignmentComponents.length === 0 && <div style={{ ...mono, fontSize: 11, color: T.dim }}>No assignment components in this scheme.</div>}
                {assignmentComponents.map((component, index) => (
                  <div key={component.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 8 }}>
                    <input aria-label={`Assignment component ${index + 1} label`} disabled={!canEdit} value={component.label} onChange={event => setAssignmentComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                    <input aria-label={`Assignment component ${index + 1} raw max`} disabled={!canEdit} type="number" min={1} max={100} value={component.rawMax} onChange={event => setAssignmentComponents(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, rawMax: clampNumber(Number(event.target.value) || 1, 1, 100) } : item))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Btn size="sm" variant="ghost" onClick={onBack}>Cancel</Btn>
          <Btn size="sm" onClick={() => {
            if (quizWeight + assignmentWeight !== 30) return
            onSave({
              finalsMax,
              quizWeight,
              assignmentWeight,
              quizCount,
              assignmentCount,
              quizComponents: sanitizeAssessmentComponents('quiz', quizCount, quizComponents),
              assignmentComponents: sanitizeAssessmentComponents('assignment', assignmentCount, assignmentComponents),
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

export function UploadPage({
  role,
  offering,
  defaultKind,
  onOpenWorkspace,
  lockByOffering,
  onRequestUnlock,
  availableOfferings,
  onOpenSchemeSetup,
}: {
  role: Role
  offering: Offering | null
  defaultKind: EntryKind
  onOpenWorkspace: (offeringId: string, kind: EntryKind) => void
  lockByOffering: Record<string, EntryLockMap>
  onRequestUnlock: (offeringId: string, kind: EntryKind) => void
  availableOfferings?: Offering[]
  onOpenSchemeSetup: (offering?: Offering) => void
}) {
  const { getOfferingAttendancePatched, getSchemeForOffering } = useAppSelectors()
  const visibleOfferings = (availableOfferings && availableOfferings.length > 0 ? availableOfferings : OFFERINGS)
  const [selectedKind, setSelectedKind] = useState<EntryKind>(defaultKind)
  const [selectedOffId, setSelectedOffId] = useState<string>(offering?.offId ?? visibleOfferings[0].offId)
  const [unlockRequested, setUnlockRequested] = useState<EntryKind | null>(null)

  const selected = ENTRY_CATALOG.find(item => item.kind === selectedKind) ?? ENTRY_CATALOG[0]
  const selectedOffering = visibleOfferings.find(item => item.offId === selectedOffId) ?? offering ?? visibleOfferings[0]
  const scheme = getSchemeForOffering(selectedOffering)
  const selectedCourseCode = selectedOffering.code
  const classOfferings = visibleOfferings.filter(item => item.code === selectedCourseCode)
  const lockMap = lockByOffering[selectedOffering.offId] ?? getEntryLockMap(selectedOffering)
  const hasInFlightEvaluation = !!selectedOffering.tt1Done || !!selectedOffering.tt2Done || !!lockMap.tt1 || !!lockMap.tt2 || !!lockMap.quiz || !!lockMap.assignment
  const schemeReady = scheme.status !== 'Needs Setup' || hasInFlightEvaluation
  const shouldShowSchemePrompt = !schemeReady && !hasInFlightEvaluation

  const completion = {
    tt1: !!selectedOffering.tt1Locked,
    tt2: !!selectedOffering.tt2Locked,
    quiz: !!selectedOffering.quizLocked,
    assignment: !!selectedOffering.asgnLocked,
    attendance: getOfferingAttendancePatched(selectedOffering) >= 75,
    finals: selectedOffering.stageInfo.stage >= 3,
  }

  return (
    <PageShell size="narrow">
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>Data Entry Hub</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 6 }}>Single consistent entry route from dashboard. CSV import is disabled in v1.</div>
      <div style={{ ...mono, fontSize: 11, color: T.accent, marginBottom: 12 }}>{selectedOffering.code} · {selectedOffering.title} · {selectedOffering.year} · Stage {selectedOffering.stageInfo.stage}</div>
      {role !== 'Mentor' && lockMap[selectedKind] && (
        <Card style={{ marginBottom: 12, padding: '12px 14px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>This entry is locked. You cannot modify {selected.title}.</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn size="sm" variant="ghost" onClick={() => { setUnlockRequested(selectedKind); onRequestUnlock(selectedOffering.offId, selectedKind) }}>Request unlock from HoD</Btn>
            {unlockRequested === selectedKind && <Chip color={T.success} size={9}>Governance action recorded</Chip>}
          </div>
        </Card>
      )}
      {shouldShowSchemePrompt && (
        <Card style={{ marginBottom: 12, padding: '12px 14px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>Set up the evaluation scheme before first marks entry for this class.</div>
          <div style={{ marginTop: 8 }}><Btn size="sm" variant="ghost" onClick={() => onOpenSchemeSetup(selectedOffering)}>Open Scheme Setup</Btn></div>
        </Card>
      )}
      <div style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label htmlFor="entry-course-select" style={{ ...mono, fontSize: 10, color: T.muted, marginRight: 8 }}>Course:</label>
          <select id="entry-course-select" aria-label="Select course" title="Select course" value={selectedCourseCode} onChange={event => {
            const code = event.target.value
            const firstClass = visibleOfferings.find(item => item.code === code)
            if (firstClass) setSelectedOffId(firstClass.offId)
          }} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px' }}>
            {Array.from(new Set(visibleOfferings.map(item => item.code))).map(code => {
              const first = visibleOfferings.find(item => item.code === code)
              return <option key={code} value={code}>{code} · {first?.title ?? 'Course'}</option>
            })}
          </select>
        </div>
        <div>
          <label htmlFor="entry-class-select" style={{ ...mono, fontSize: 10, color: T.muted, marginRight: 8 }}>Class:</label>
          <select id="entry-class-select" aria-label="Select class" title="Select class" value={selectedOffId} onChange={event => setSelectedOffId(event.target.value)} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px' }}>
            {classOfferings.map(item => <option key={item.offId} value={item.offId}>{item.year} · Sec {item.section} · {item.count} students</option>)}
          </select>
        </div>
        <Btn size="sm" onClick={() => setSelectedOffId(selectedOffId)}>Select Class</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {ENTRY_CATALOG.map(item => {
          const access = getEntryAccessState({
            stage: selectedOffering.stageInfo.stage,
            kind: item.kind,
            isLocked: lockMap[item.kind],
            canEditMarks: role === 'Course Leader',
          })
          return (
            <Card
              key={item.kind}
              glow={selectedKind === item.kind ? T.accent : undefined}
              style={{ padding: '18px 20px', cursor: (!access.isApplicableForStage || access.isLocked) ? 'not-allowed' : 'pointer', opacity: access.isLocked ? 0.8 : 1 }}
              onClick={() => {
                setSelectedKind(item.kind)
                if (!access.isApplicableForStage) return
                if (!schemeReady) {
                  onOpenSchemeSetup(selectedOffering)
                  return
                }
                if (!access.canOpenWorkspace) return
                onOpenWorkspace(selectedOffId, item.kind)
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4 }}>{item.title}</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>{item.desc}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip color={completion[item.kind] ? T.success : T.warning} size={10}>{completion[item.kind] ? 'Completed' : 'Pending Entry'}</Chip>
                {access.isLocked && <Chip color={T.danger} size={10}>Locked</Chip>}
                {!access.isApplicableForStage && <Chip color={T.warning} size={10}>Stage N/A</Chip>}
              </div>
            </Card>
          )
        })}
      </div>
      {role === 'Mentor' && <div style={{ ...mono, fontSize: 11, color: T.warning, marginTop: 12 }}>Read-only role. Only Course Leaders can edit marks.</div>}
      {!getEntryAccessState({ stage: selectedOffering.stageInfo.stage, kind: selectedKind, isLocked: lockMap[selectedKind], canEditMarks: role === 'Course Leader' }).isApplicableForStage && (
        <div style={{ ...mono, fontSize: 11, color: T.warning, marginTop: 8 }}>Current selected type is not applicable at stage {selectedOffering.stageInfo.stage}.</div>
      )}
    </PageShell>
  )
}

export function EntryWorkspacePage({
  capabilities,
  offeringId,
  kind,
  onBack,
  lockByOffering,
  draftBySection,
  onSaveDraft,
  onSubmitLock,
  onRequestUnlock,
  cellValues,
  onCellValueChange,
  onOpenStudent,
  onOpenTaskComposer,
  onUpdateStudentAttendance,
  schemeByOffering,
  ttBlueprintsByOffering,
  lockAuditByTarget,
}: {
  capabilities: FacultyCapabilitySet
  offeringId: string
  kind: EntryKind
  onBack: () => void
  lockByOffering: Record<string, EntryLockMap>
  draftBySection: Record<string, number>
  onSaveDraft: (offeringId: string, kind: EntryKind) => void
  onSubmitLock: (offeringId: string, kind: EntryKind) => void
  onRequestUnlock: (offeringId: string, kind: EntryKind) => void
  cellValues: Record<string, number>
  onCellValueChange: (key: string, value: number | undefined) => void
  onOpenStudent: (student: Student, offering: Offering) => void
  onOpenTaskComposer: (input?: { offeringId?: string; studentId?: string; taskType?: TaskType }) => void
  onUpdateStudentAttendance: (offeringId: string, studentId: string, patch: StudentRuntimePatch) => void
  schemeByOffering: Record<string, SchemeState>
  ttBlueprintsByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  lockAuditByTarget: Record<string, QueueTransition[]>
}) {
  const { deriveAcademicProjection, getStudentsPatched } = useAppSelectors()
  const selectedOffering = OFFERINGS.find(item => item.offId === offeringId) ?? OFFERINGS[0]
  const groupedSections = OFFERINGS.filter(item => item.code === selectedOffering.code && item.year === selectedOffering.year)
  const [selectedClassOffId, setSelectedClassOffId] = useState<string>('all')
  const selected = ENTRY_CATALOG.find(item => item.kind === kind) ?? ENTRY_CATALOG[0]
  const lockMap = lockByOffering[selectedOffering.offId] ?? getEntryLockMap(selectedOffering)
  const access = getEntryAccessState({
    stage: selectedOffering.stageInfo.stage,
    kind,
    isLocked: lockMap[kind],
    canEditMarks: capabilities.canEditMarks,
  })
  const visibleSections = selectedClassOffId === 'all' ? groupedSections : groupedSections.filter(section => section.offId === selectedClassOffId)
  const latestAudit = lockAuditByTarget[`${selectedOffering.offId}::${kind}`]?.at(-1)

  useEffect(() => {
    setSelectedClassOffId(offeringId)
  }, [offeringId])

  return (
    <PageShell size="wide">
      <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back to Data Entry Hub</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>{selected.title} — Direct Entry Workspace</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>{selectedOffering.code} · {selectedOffering.title} · {selectedOffering.year} · Stage {selectedOffering.stageInfo.stage}</div>
        </div>
        <div style={{ minWidth: 280 }}>
          <label htmlFor="entry-workspace-class" style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 4 }}>Class</label>
          <select id="entry-workspace-class" value={selectedClassOffId} onChange={event => setSelectedClassOffId(event.target.value)} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
            <option value="all">All mapped classes for {selectedOffering.code}</option>
            {groupedSections.map(section => <option key={section.offId} value={section.offId}>{section.year} · Sec {section.section} · {section.count} students</option>)}
          </select>
        </div>
      </div>
      {!capabilities.canEditMarks && <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 10 }}>Read-only for this role. Only Course Leaders can edit marks.</div>}
      {access.isLocked && (
        <Card style={{ marginBottom: 10, padding: '10px 12px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>This dataset is locked. Corrections require a governed unlock flow.</div>
          {latestAudit && <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>Latest audit note: {latestAudit.note}</div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => onRequestUnlock(selectedOffering.offId, kind)}>Request unlock from HoD</Btn>
          </div>
        </Card>
      )}
      {!access.isApplicableForStage && <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 10 }}>Not applicable at current stage ({selectedOffering.stageInfo.stage}).</div>}

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {visibleSections.map(section => {
          const students = getStudentsPatched(section)
          const sectionLocks = lockByOffering[section.offId] ?? getEntryLockMap(section)
          const sectionAccess = getEntryAccessState({
            stage: section.stageInfo.stage,
            kind,
            isLocked: sectionLocks[kind],
            canEditMarks: capabilities.canEditMarks,
          })
          const currentScheme = schemeByOffering[section.offId] ?? defaultSchemeForOffering(section)
          const blueprint = kind === 'tt1' || kind === 'tt2'
            ? (ttBlueprintsByOffering[section.offId]?.[kind] ?? seedBlueprintFromPaper(kind, PAPER_MAP[section.code] || PAPER_MAP.default))
            : null
          const leaves = blueprint ? flattenBlueprintLeaves(blueprint.nodes) : []
          const dynamicComponents = kind === 'quiz' ? currentScheme.quizComponents : kind === 'assignment' ? currentScheme.assignmentComponents : []
          const draftKey = `${section.offId}::${kind}`

          return (
            <Card key={section.offId} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{section.code} · Sec {section.section}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{students.length} students</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip color={sectionAccess.isApplicableForStage ? T.blue : T.dim} size={9}>{sectionAccess.isApplicableForStage ? 'Stage Applicable' : 'Locked by Stage'}</Chip>
                  {draftBySection[draftKey] && <Chip color={T.success} size={9}>Draft saved</Chip>}
                  <Btn size="sm" onClick={() => onSaveDraft(section.offId, kind)} variant="ghost">Save Draft</Btn>
                  <Btn size="sm" onClick={() => onSubmitLock(section.offId, kind)}>{sectionAccess.canEdit ? 'Submit & Lock' : sectionAccess.isLocked ? 'Locked' : 'View Only'}</Btn>
                </div>
              </div>

              <HScrollArea>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>USN</TH><TH>Name</TH>
                      {(kind === 'tt1' || kind === 'tt2') && leaves.map(leaf => <TH key={leaf.id}>{leaf.label}/{leaf.maxMarks}</TH>)}
                      {(kind === 'quiz' || kind === 'assignment') && dynamicComponents.map(component => <TH key={component.id}>{component.label} /{component.rawMax}</TH>)}
                      {kind === 'attendance' && <TH>Present</TH>}
                      {kind === 'attendance' && <TH>Total Classes</TH>}
                      {kind === 'finals' && <TH>SEE /{currentScheme.finalsMax}</TH>}
                      <TH>Current</TH><TH>Profile</TH><TH>Task</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 25).map(student => {
                      const projection = deriveAcademicProjection({ offering: section, student, scheme: currentScheme })
                      return (
                        <tr key={student.id}>
                          <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                          <TD style={{ ...sora, fontSize: 11, color: T.text }}>{student.name}</TD>
                          {(kind === 'tt1' || kind === 'tt2') && leaves.map(leaf => {
                            const rawTotal = kind === 'tt1' ? student.tt1Score : student.tt2Score
                            const maxTotal = kind === 'tt1' ? student.tt1Max : student.tt2Max
                            const fallbackValue = rawTotal !== null ? clampNumber(Math.round((rawTotal / Math.max(1, maxTotal)) * leaf.maxMarks), 0, leaf.maxMarks) : undefined
                            return (
                              <TD key={leaf.id}>
                                <input
                                  aria-label={`${kind.toUpperCase()} marks for ${student.name}, ${leaf.label}`}
                                  title={`Enter ${kind.toUpperCase()} marks for ${student.name}, ${leaf.label}`}
                                  placeholder="0"
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={leaf.maxMarks}
                                  disabled={!sectionAccess.canEdit}
                                  value={cellValues[toCellKey(section.offId, kind, student.id, leaf.id)] ?? fallbackValue ?? ''}
                                  onKeyDown={shouldBlockNumericKey}
                                  onChange={event => onCellValueChange(toCellKey(section.offId, kind, student.id, leaf.id), parseInputValue(event.target.value, 0, leaf.maxMarks))}
                                  style={{ width: 58, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                                />
                              </TD>
                            )
                          })}
                          {(kind === 'quiz' || kind === 'assignment') && dynamicComponents.map((component, index) => {
                            const max = component.rawMax
                            const currentScore = kind === 'quiz' ? (index === 0 ? student.quiz1 : student.quiz2) : (index === 0 ? student.asgn1 : student.asgn2)
                            return (
                              <TD key={component.id}>
                                <input
                                  aria-label={`${component.label} marks for ${student.name}`}
                                  title={`Enter ${component.label} marks for ${student.name}`}
                                  placeholder="0"
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={max}
                                  disabled={!sectionAccess.canEdit}
                                  value={cellValues[toCellKey(section.offId, kind, student.id, component.id)] ?? (currentScore ?? '')}
                                  onKeyDown={shouldBlockNumericKey}
                                  onChange={event => onCellValueChange(toCellKey(section.offId, kind, student.id, component.id), parseInputValue(event.target.value, 0, max))}
                                  style={{ width: 72, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                                />
                              </TD>
                            )
                          })}
                          {kind === 'attendance' && (
                            <TD>
                              <input
                                aria-label={`Attendance present classes for ${student.name}`}
                                title={`Enter attendance present count for ${student.name}`}
                                placeholder="0"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={999}
                                disabled={!sectionAccess.canEdit}
                                value={cellValues[toCellKey(section.offId, kind, student.id, 'present')] ?? student.present}
                                onKeyDown={shouldBlockNumericKey}
                                onChange={event => {
                                  const next = parseInputValue(event.target.value, 0, 999)
                                  onCellValueChange(toCellKey(section.offId, kind, student.id, 'present'), next)
                                  onUpdateStudentAttendance(section.offId, student.id, { present: next })
                                }}
                                style={{ width: 64, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                              />
                            </TD>
                          )}
                          {kind === 'attendance' && (
                            <TD>
                              <input
                                aria-label={`Total classes for ${student.name}`}
                                title={`Enter total classes conducted for ${student.name}`}
                                placeholder="0"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={999}
                                disabled={!sectionAccess.canEdit}
                                value={cellValues[toCellKey(section.offId, kind, student.id, 'total')] ?? student.totalClasses}
                                onKeyDown={shouldBlockNumericKey}
                                onChange={event => {
                                  const nextTotal = parseInputValue(event.target.value, 1, 999)
                                  onCellValueChange(toCellKey(section.offId, kind, student.id, 'total'), nextTotal)
                                  onUpdateStudentAttendance(section.offId, student.id, { totalClasses: nextTotal })
                                }}
                                style={{ width: 84, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                              />
                            </TD>
                          )}
                          {kind === 'finals' && (
                            <TD>
                              <input
                                aria-label={`SEE marks for ${student.name}`}
                                title={`Enter SEE marks for ${student.name}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={currentScheme.finalsMax}
                                disabled={!sectionAccess.canEdit}
                                value={cellValues[toCellKey(section.offId, kind, student.id, 'see')] ?? ''}
                                onKeyDown={shouldBlockNumericKey}
                                onChange={event => onCellValueChange(toCellKey(section.offId, kind, student.id, 'see'), parseInputValue(event.target.value, 0, currentScheme.finalsMax))}
                                placeholder="Enter"
                                style={{ width: 72, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                              />
                            </TD>
                          )}
                          <TD><div style={{ ...mono, fontSize: 10, color: T.muted }}>CE {projection.ce60.toFixed(1)}/60<br />CGPA {projection.predictedCgpa.toFixed(2)}</div></TD>
                          <TD><button aria-label={`Open ${student.name} profile`} title="Open profile" onClick={() => onOpenStudent(student, section)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Eye size={13} /></button></TD>
                          <TD><button aria-label={`Add task for ${student.name}`} title="Add task" onClick={() => onOpenTaskComposer({ offeringId: section.offId, studentId: student.id, taskType: 'Follow-up' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.success, ...mono, fontSize: 11 }}>+Task</button></TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </HScrollArea>
            </Card>
          )
        })}
      </div>
    </PageShell>
  )
}
