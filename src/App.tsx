import { useState, useMemo, useCallback, useEffect, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight, Bell, Calendar, CheckCircle, Filter,
  LayoutDashboard, ListTodo, Mail, Phone, Shield, Upload, Users, X,
  AlertTriangle, TrendingDown, BookOpen, Target, Activity, Eye, MessageSquare,
} from 'lucide-react'
import {
  T, mono, sora, yearColor, stageColor, CO_COLORS,
  PROFESSOR, OFFERINGS, YEAR_GROUPS, CO_MAP, PAPER_MAP,
  getStudents, getAllAtRiskStudents, generateTasks, MENTEES, TEACHERS, CALENDAR_EVENTS,
  type Offering, type Student, type Role, type Stage, type Task, type YearGroup,
  type Mentee, type RiskBand, type CODef, type PaperQ,
} from './data'
import './App.css'

type ThemeMode = 'light' | 'dark'
type EntryKind = 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'attendance' | 'finals'
type EntryLockMap = Record<EntryKind, boolean>
type SharedTask = Task & {
  createdAt: number
  assignedTo: Role
  escalated?: boolean
  sourceRole?: Role | 'Auto' | 'System'
  manual?: boolean
}

type TeacherAccount = {
  teacherId: string
  name: string
  initials: string
  permissions: Role[]
  courseCodes: string[]
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

const TEACHER_ACCOUNTS: TeacherAccount[] = [
  { teacherId: 't1', name: 'Dr. Kavitha Rao', initials: 'KR', permissions: ['Course Leader', 'Mentor', 'HoD'], courseCodes: ['CS401', 'CS403'] },
  { teacherId: 't2', name: 'Dr. Arvind Kumar', initials: 'AK', permissions: ['Course Leader'], courseCodes: ['CS601'] },
  { teacherId: 't3', name: 'Prof. Sneha Nair', initials: 'SN', permissions: ['Mentor'], courseCodes: ['MA101'] },
  { teacherId: 't4', name: 'Dr. Rajesh Bhat', initials: 'RB', permissions: ['Course Leader', 'Mentor'], courseCodes: ['CS702'] },
  { teacherId: 't5', name: 'Prof. Ananya Iyer', initials: 'AI', permissions: ['Course Leader'], courseCodes: ['CS101'] },
  { teacherId: 't6', name: 'Dr. Vikram Nair', initials: 'VN', permissions: ['Mentor'], courseCodes: ['CS603', 'MA301'] },
]

const THEME_PRESETS: Record<ThemeMode, typeof T> = {
  light: {
    ...T,
    bg: '#f5f8fc', surface: '#ffffff', surface2: '#f1f6fd', surface3: '#e9f0fa',
    border: '#dbe5f1', border2: '#c9d8ea',
    text: '#0f172a', muted: '#475569', dim: '#94a3b8',
    accent: '#006DDD', accentLight: '#1F7FE0',
  },
  dark: {
    ...T,
    bg: '#07090f', surface: '#0d1017', surface2: '#111520', surface3: '#161b28',
    border: '#1c2333', border2: '#242d40',
    text: '#e2e8f4', muted: '#8892a4', dim: '#3d4a60',
    accent: '#006DDD', accentLight: '#2D8AF0',
  },
}

function applyThemePreset(mode: ThemeMode) {
  Object.assign(T, THEME_PRESETS[mode])
}

function toCellKey(offId: string, kind: EntryKind, studentId: string, field: string) {
  return `${offId}::${kind}::${studentId}::${field}`
}

function clampNumber(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function parseInputValue(raw: string, min: number, max: number): number | undefined {
  if (raw.trim() === '') return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return undefined
  return clampNumber(Math.round(parsed), min, max)
}

function shouldBlockNumericKey(e: React.KeyboardEvent<HTMLInputElement>) {
  const blocked = ['e', 'E', '+', '-', '.', ',']
  if (blocked.includes(e.key)) e.preventDefault()
}

/* ══════════════════════════════════════════════════════════════
   PRIMITIVES
   ══════════════════════════════════════════════════════════════ */

const Chip = ({ children, color = T.muted, size = 11 }: { children: ReactNode; color?: string; size?: number }) => (
  <span style={{ ...mono, fontSize: size, padding: '2px 8px', borderRadius: 4, background: `${color}12`, color, border: `1px solid ${color}26`, whiteSpace: 'nowrap' as const, display: 'inline-block' }}>{children}</span>
)

const Bar = ({ val, max = 100, color, h = 5 }: { val: number; max?: number; color: string; h?: number }) => (
  <div style={{ background: T.border, borderRadius: 99, height: h, overflow: 'hidden', flex: 1 }}>
    <div style={{ height: h, borderRadius: 99, width: `${Math.min(100, (val / max) * 100)}%`, background: color, transition: 'width 0.5s ease' }} />
  </div>
)

const Card = ({ children, style = {}, glow, onClick }: { children: ReactNode; style?: CSSProperties; glow?: string; onClick?: () => void }) => (
  <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${glow ? glow + '24' : T.border}`, borderRadius: 12, padding: 20, boxShadow: glow ? `0 4px 16px ${glow}0f` : 'none', cursor: onClick ? 'pointer' : undefined, ...style }}>{children}</div>
)

const Btn = ({ children, onClick, variant = 'primary', size = 'md' }: { children: ReactNode; onClick?: () => void; variant?: string; size?: string }) => {
  const p = size === 'sm' ? '6px 14px' : '10px 22px'
  const fs = size === 'sm' ? 11 : 13
  const base: CSSProperties = { ...sora, fontWeight: 600, fontSize: fs, padding: p, borderRadius: 7, cursor: 'pointer', border: 'none', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 5 }
  if (variant === 'primary') return <button onClick={onClick} style={{ ...base, background: T.accent, color: '#fff' }}>{children}</button>
  if (variant === 'ghost') return <button onClick={onClick} style={{ ...base, background: 'transparent', color: T.muted, border: `1px solid ${T.border2}` }}>{children}</button>
  if (variant === 'danger') return <button onClick={onClick} style={{ ...base, background: '#ef444418', color: '#ef4444', border: '1px solid #ef444435' }}>{children}</button>
  return <button onClick={onClick} style={{ ...base, background: T.surface3, color: T.text, border: `1px solid ${T.border2}` }}>{children}</button>
}

const TH = ({ children }: { children: ReactNode }) => (
  <th style={{ ...mono, fontSize: 9, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '11px 12px', textAlign: 'left' as const, background: T.surface2, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' as const }}>{children}</th>
)
const TD = ({ children, style = {}, ...rest }: { children: ReactNode; style?: CSSProperties; colSpan?: number }) => (
  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${T.border}`, ...style }} {...rest}>{children}</td>
)

const RiskBadge = ({ band, prob }: { band: RiskBand | null; prob: number | null }) => {
  if (!band || prob === null) return <Chip color={T.dim} size={10}>No data</Chip>
  const col = band === 'High' ? T.danger : band === 'Medium' ? T.warning : T.success
  return <Chip color={col} size={10}>{band} · {Math.round(prob * 100)}%</Chip>
}

const StagePips = ({ current }: { current: Stage }) => (
  <div style={{ display: 'flex', gap: 3, maxWidth: 80 }}>
    {([1, 2, 3] as Stage[]).map(s => <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= current ? stageColor(s) : T.border }} />)}
  </div>
)

function LoginPage({ onLogin }: { onLogin: (teacherId: string) => void }) {
  const [teacherId, setTeacherId] = useState<string>(TEACHER_ACCOUNTS[0].teacherId)
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 420, padding: 24 }} glow={T.accent}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.text, marginBottom: 6 }}>AirMentor Login</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 16 }}>Use password <span style={{ color: T.accent }}>1234</span> for mock flow.</div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="teacher-login" style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 5 }}>Teacher</label>
          <select id="teacher-login" value={teacherId} onChange={e => setTeacherId(e.target.value)} style={{ width: '100%', ...mono, fontSize: 12, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '9px 10px' }}>
            {TEACHER_ACCOUNTS.map(t => <option key={t.teacherId} value={t.teacherId}>{t.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="teacher-password" style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 5 }}>Password</label>
          <input id="teacher-password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', ...mono, fontSize: 12, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '9px 10px' }} />
        </div>

        {err && <div style={{ ...mono, fontSize: 11, color: T.danger, marginBottom: 10 }}>{err}</div>}
        <Btn onClick={() => {
          if (password !== '1234') {
            setErr('Invalid password')
            return
          }
          setErr('')
          onLogin(teacherId)
        }}><Shield size={14} /> Login</Btn>
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   STUDENT DRAWER — SHAP, What-If, CO, Interventions
   ══════════════════════════════════════════════════════════════ */

function StudentDrawer({ student, offering, role, onClose, onEscalate, onAssignRemedial, onAddManualTask }: { student: Student | null; offering?: Offering; role: Role; onClose: () => void; onEscalate: (s: Student, o?: Offering) => void; onAssignRemedial: (s: Student, o?: Offering) => void; onAddManualTask: (s: Student, o?: Offering) => void }) {
  if (!student) return null
  const s = student
  const attPct = Math.round(s.present / s.totalClasses * 100)
  const riskCol = s.riskBand === 'High' ? T.danger : s.riskBand === 'Medium' ? T.warning : T.success
  const canSeeMarks = role !== 'Mentor'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <motion.div initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} transition={{ type: 'spring', damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ width: 520, maxWidth: '100vw', height: '100vh', overflowY: 'auto', background: T.surface, borderLeft: `1px solid ${T.border}`, padding: '24px 28px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: T.text }}>{s.name}</div>
            <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 2 }}>{s.usn}</div>
            {offering && <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{offering.code} · {offering.title} · Sec {offering.section}</div>}
          </div>
          <button aria-label="Close student details" title="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 4 }}><X size={18} /></button>
        </div>

        {/* Risk Gauge */}
        {s.riskProb !== null ? (
          <div style={{ background: `${riskCol}0c`, border: `1px solid ${riskCol}30`, borderRadius: 12, padding: '18px 22px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ ...sora, fontWeight: 800, fontSize: 42, color: riskCol }}>{Math.round(s.riskProb * 100)}%</div>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: riskCol }}>Failure Risk — {s.riskBand}</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>P(subject grade &lt; 7.5 or backlog)</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {s.flags.backlog && <Chip color={T.danger} size={9}>Backlog history</Chip>}
                  {s.flags.lowAttendance && <Chip color={T.warning} size={9}>Low attendance</Chip>}
                  {s.flags.declining && <Chip color={T.warning} size={9}>Declining trend</Chip>}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}><Bar val={s.riskProb * 100} color={riskCol} h={8} /></div>
          </div>
        ) : (
          <div style={{ background: T.surface2, borderRadius: 12, padding: '18px 22px', marginBottom: 18, textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 12, color: T.muted }}>Risk prediction unavailable — TT1 not yet completed</div>
            <div style={{ ...mono, fontSize: 11, color: T.dim, marginTop: 4 }}>Showing attendance data only</div>
          </div>
        )}

        {/* SHAP — Top Risk Drivers */}
        {s.reasons.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={14} color={T.danger} /> Top Risk Drivers
            </div>
            {s.reasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...mono, fontSize: 11, color: T.text, marginBottom: 3 }}>{r.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ height: 6, borderRadius: 3, background: r.impact > 0.25 ? T.danger : r.impact > 0.15 ? T.warning : T.blue, width: `${Math.min(100, r.impact * 300)}%`, minWidth: 20, transition: 'width 0.4s ease' }} />
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>{Math.round(r.impact * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CO Attainment */}
        {s.coScores.length > 0 && s.coScores[0].attainment > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={14} color={T.accent} /> CO Attainment
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {s.coScores.map((co, i) => {
                const col = CO_COLORS[i % CO_COLORS.length]
                return (
                  <div key={co.coId} style={{ background: T.surface2, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ ...mono, fontSize: 10, color: col, marginBottom: 2 }}>{co.coId}</div>
                    <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: co.attainment >= 60 ? T.success : co.attainment >= 40 ? T.warning : T.danger }}>{co.attainment}%</div>
                    <Bar val={co.attainment} color={co.attainment >= 60 ? T.success : co.attainment >= 40 ? T.warning : T.danger} h={4} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* What-If Scenarios */}
        {s.whatIf.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={14} color={T.blue} /> What Could Change
            </div>
            {s.whatIf.map((w, i) => (
              <div key={i} style={{ background: `${T.blue}0a`, border: `1px solid ${T.blue}25`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{w.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ ...mono, fontSize: 12, color: T.muted }}>{w.current}</span>
                  <span style={{ ...mono, fontSize: 10, color: T.dim }}>→</span>
                  <span style={{ ...mono, fontSize: 12, color: T.success }}>{w.target}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.danger }}>{Math.round(w.currentRisk * 100)}%</span>
                    <span style={{ ...mono, fontSize: 10, color: T.dim }}>→</span>
                    <span style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.success }}>{Math.round(w.newRisk * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Academic Snapshot */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} color={T.accent} /> Academic Snapshot
          </div>
          {!canSeeMarks && (
            <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 8 }}>Marks visibility is restricted for Mentor role.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { lbl: 'Attendance', val: `${attPct}%`, col: attPct >= 75 ? T.success : attPct >= 65 ? T.warning : T.danger },
              { lbl: 'TT1', val: canSeeMarks && s.tt1Score !== null ? `${s.tt1Score}/${s.tt1Max}` : 'Restricted', col: canSeeMarks && s.tt1Score !== null ? (s.tt1Score / s.tt1Max >= 0.5 ? T.success : T.danger) : T.dim },
              { lbl: 'TT2', val: canSeeMarks && s.tt2Score !== null ? `${s.tt2Score}/${s.tt2Max}` : 'Restricted', col: canSeeMarks && s.tt2Score !== null ? (s.tt2Score / s.tt2Max >= 0.5 ? T.success : T.danger) : T.dim },
              { lbl: 'Quiz 1', val: canSeeMarks && s.quiz1 !== null ? `${s.quiz1}/10` : 'Restricted', col: canSeeMarks && s.quiz1 !== null ? (s.quiz1 >= 5 ? T.success : T.warning) : T.dim },
              { lbl: 'Assignment 1', val: canSeeMarks && s.asgn1 !== null ? `${s.asgn1}/10` : 'Restricted', col: canSeeMarks && s.asgn1 !== null ? (s.asgn1 >= 6 ? T.success : T.warning) : T.dim },
              { lbl: 'Prev CGPA', val: s.prevCgpa > 0 ? s.prevCgpa.toFixed(1) : '—', col: s.prevCgpa >= 7 ? T.success : s.prevCgpa >= 6 ? T.warning : T.danger },
            ].map((x, i) => (
              <div key={i} style={{ background: T.surface2, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: x.col }}>{x.val}</div>
                <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Intervention History */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={14} color={T.warning} /> Intervention Log
          </div>
          {s.interventions.length > 0 ? s.interventions.map((iv, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 50 }}>{iv.date}</div>
              <Chip color={T.warning} size={9}>{iv.type}</Chip>
              <div style={{ ...mono, fontSize: 11, color: T.muted, flex: 1 }}>{iv.note}</div>
            </div>
          )) : (
            <div style={{ ...mono, fontSize: 11, color: T.dim, padding: '12px 0' }}>No interventions logged yet</div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" onClick={() => navigator.clipboard.writeText(s.phone)}><Phone size={12} /> Call</Btn>
          <Btn size="sm" variant="ghost"><Mail size={12} /> Email</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onAddManualTask(s, offering)}><MessageSquare size={12} /> Add Task</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onAssignRemedial(s, offering)}><BookOpen size={12} /> Assign Remedial</Btn>
          <Btn size="sm" variant="danger" onClick={() => onEscalate(s, offering)}><AlertTriangle size={12} /> Escalate to HoD</Btn>
        </div>
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ACTION QUEUE (Right Sidebar)
   ══════════════════════════════════════════════════════════════ */

function ActionQueue({ tasks, resolvedTaskIds, onResolveTask, onUndoTask, onOpenStudent }: { tasks: SharedTask[]; resolvedTaskIds: Record<string, number>; onResolveTask: (id: string) => void; onUndoTask: (id: string) => void; onOpenStudent: (id: string) => void }) {
  const active = tasks.filter(t => !resolvedTaskIds[t.id])
  const done = tasks.filter(t => !!resolvedTaskIds[t.id])

  return (
    <div style={{ width: 310, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ListTodo size={16} color={T.accent} />
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Action Queue</div>
        <div style={{ marginLeft: 'auto' }}><Chip color={T.danger} size={10}>{active.length} pending</Chip></div>
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>Priority = risk × urgency × opportunity</div>

      {active.map(t => (
        <div key={t.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ ...sora, fontWeight: 600, fontSize: 12, color: T.text, lineHeight: 1.3 }}>{t.title}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{t.courseCode} · {t.year}</div>
            </div>
            <RiskBadge band={t.riskBand} prob={t.riskProb} />
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 8 }}>{t.actionHint}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Chip color={t.status === 'New' ? T.danger : T.warning} size={9}>{t.status}</Chip>
            {t.escalated && <Chip color={T.danger} size={9}>Escalated</Chip>}
            <Chip color={T.dim} size={9}>Due: {t.due}</Chip>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button aria-label="Open student details" title="Open student" onClick={() => onOpenStudent(t.studentId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, padding: 2 }}><Eye size={13} /></button>
              <button aria-label="Mark task as resolved" title="Resolve task" onClick={() => onResolveTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.success, padding: 2 }}><CheckCircle size={13} /></button>
            </div>
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Done — awaiting next assessment</div>
          {done.map(t => (
            <div key={t.id} style={{ background: `${T.success}08`, border: `1px solid ${T.success}20`, borderRadius: 8, padding: '8px 12px', marginBottom: 6, opacity: 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...mono, fontSize: 11, color: T.success, textDecoration: 'line-through', flex: 1 }}>{t.title}</div>
                {Date.now() - (resolvedTaskIds[t.id] ?? 0) < TWO_DAYS_MS && (
                  <button aria-label="Undo resolved task" title="Undo" onClick={() => onUndoTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, ...mono, fontSize: 10 }}>Undo</button>
                )}
              </div>
              <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 2 }}>Auto-removes permanently after 2 days</div>
            </div>
          ))}
        </>
      )}

      {active.length === 0 && done.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
          <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.success }}>All clear!</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>No pending actions right now</div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COURSE LEADER: DASHBOARD
   ══════════════════════════════════════════════════════════════ */

function inferKindFromPendingAction(pending: string | null): EntryKind {
  if (!pending) return 'tt1'
  const p = pending.toLowerCase()
  if (p.includes('tt2')) return 'tt2'
  if (p.includes('attendance')) return 'attendance'
  if (p.includes('quiz')) return 'quiz'
  if (p.includes('assignment')) return 'assignment'
  if (p.includes('final')) return 'finals'
  return 'tt1'
}

function CLDashboard({ onOpenCourse, onOpenStudent, onOpenUpload }: { onOpenCourse: (o: Offering) => void; onOpenStudent: (s: Student, o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void }) {
  const total = OFFERINGS.reduce((a, o) => a + o.count, 0)
  const allAtRisk = useMemo(() => getAllAtRiskStudents(), [])
  const highRiskCount = allAtRisk.filter(s => s.riskBand === 'High').length
  const pending = OFFERINGS.filter(o => o.pendingAction).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, animation: 'fadeUp 0.35s ease' }}>
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 18, color: '#fff' }}>{PROFESSOR.initials}</div>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>Good morning, {PROFESSOR.name.split(' ')[0]}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{PROFESSOR.dept} · {PROFESSOR.role}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Academic Year</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Odd Sem 2025–26</div>
          <div style={{ marginTop: 8 }}><Btn size="sm" onClick={() => onOpenUpload()}>Open Data Entry Hub</Btn></div>
        </div>
      </div>

      {/* Stat Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '📚', label: 'Course Offerings', val: OFFERINGS.length, color: T.accent },
          { icon: '👥', label: 'Total Students', val: total, color: T.success },
          { icon: '🔴', label: 'High Risk Students', val: highRiskCount, color: T.danger },
          { icon: '⚡', label: 'Pending Actions', val: pending, color: T.warning },
        ].map((s, i) => (
          <Card key={i} glow={s.color} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <div style={{ ...sora, fontWeight: 800, fontSize: 24, color: s.color }}>{s.val}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Priority Alerts */}
      {highRiskCount > 0 && (
        <Card glow={T.danger} style={{ padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} color={T.danger} />
            <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.danger }}>Priority Alerts</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>— {highRiskCount} high-risk students need immediate attention</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {allAtRisk.filter(s => s.riskBand === 'High').slice(0, 6).map(s => {
              const off = OFFERINGS.find(o => o.offId === s.offId)
              return (
                <div key={s.id} onClick={() => off && onOpenStudent(s as unknown as Student, off)}
                  style={{ background: T.surface2, border: `1px solid ${T.danger}25`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.danger + '60')} onMouseLeave={e => (e.currentTarget.style.borderColor = T.danger + '25')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>{s.name}</div>
                    <div style={{ ...sora, fontWeight: 800, fontSize: 16, color: T.danger }}>{Math.round(s.riskProb! * 100)}%</div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{s.courseCode} · {s.year} · Sec {s.section}</div>
                  {s.reasons[0] && <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>↳ {s.reasons[0].label}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <button aria-label="Copy student phone number" title="Copy phone" onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(s.phone) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, padding: 0 }}><Phone size={11} /></button>
                    <span style={{ ...mono, fontSize: 9, color: T.accent }}>Contact →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Year Sections */}
      {YEAR_GROUPS.map(g => <YearSection key={g.year} group={g} onOpenCourse={onOpenCourse} onOpenUpload={onOpenUpload} />)}

      {/* Summary Table */}
      <SummaryTable onOpenCourse={onOpenCourse} onOpenUpload={onOpenUpload} />
    </div>
  )
}

function YearSection({ group, onOpenCourse, onOpenUpload }: { group: YearGroup; onOpenCourse: (o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void }) {
  const { year, color, stageInfo, offerings } = group
  const [collapsed, setCollapsed] = useState(false)
  const totalStudents = offerings.reduce((a, o) => a + o.count, 0)
  const avgAtt = Math.round(offerings.reduce((a, o) => a + o.attendance, 0) / (offerings.length || 1))
  const highRiskCount = offerings.filter(o => o.stage >= 2).reduce((a, o) => a + getStudents(o).filter(s => s.riskBand === 'High').length, 0)
  const pendingCount = offerings.filter(o => o.pendingAction).length

  return (
    <div style={{ marginBottom: 22 }}>
      <div onClick={() => setCollapsed(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: `${color}0c`, border: `1px solid ${color}28`, borderRadius: collapsed ? 10 : '10px 10px 0 0', marginBottom: collapsed ? 0 : 12, cursor: 'pointer', transition: 'all 0.2s', flexWrap: 'wrap' }}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 13, color, background: `${color}18`, border: `1px solid ${color}40`, padding: '3px 12px', borderRadius: 6 }}>{year}</div>
        <Chip color={stageInfo.color}>{stageInfo.label} · {stageInfo.desc}</Chip>
        <StagePips current={stageInfo.stage} />
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{offerings.length} offering{offerings.length > 1 ? 's' : ''} · {totalStudents} students · {avgAtt}% att</div>
        {highRiskCount > 0 && <Chip color={T.danger} size={9}>🔴 {highRiskCount} high risk</Chip>}
        {pendingCount > 0 && <Chip color={T.warning} size={9}>⚡ {pendingCount} pending</Chip>}
        <div style={{ ...mono, fontSize: 12, color: T.dim, marginLeft: 'auto' }}>{collapsed ? '▸' : '▾'}</div>
      </div>
      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12, animation: 'fadeUp 0.25s ease' }}>
          {offerings.map(o => <OfferingCard key={o.offId} o={o} yc={color} onOpen={onOpenCourse} onOpenUpload={onOpenUpload} />)}
        </div>
      )}
    </div>
  )
}

function OfferingCard({ o, yc, onOpen, onOpenUpload }: { o: Offering; yc: string; onOpen: (o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void }) {
  const [hov, setHov] = useState(false)
  const sc = o.stageInfo.color
  const ac = o.attendance >= 75 ? T.success : o.attendance >= 65 ? T.warning : T.danger
  const checks = [o.tt1Done, o.tt2Done, o.attendance >= 75]
  const highRisk = o.stage >= 2 ? getStudents(o).filter(s => s.riskBand === 'High').length : 0

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={() => onOpen(o)}
      style={{ background: T.surface, border: `1px solid ${hov ? yc + '50' : T.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s', transform: hov ? 'translateY(-2px)' : 'none', boxShadow: hov ? `0 8px 24px ${yc}12` : 'none', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${yc},${sc})` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ ...mono, fontSize: 10, color: yc, marginBottom: 2 }}>{o.code} · {o.dept} · Sec {o.section}</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, lineHeight: 1.25 }}>{o.title}</div>
        </div>
        <Chip color={sc} size={10}>{o.stageInfo.label}</Chip>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip color={T.dim} size={9}>{o.count} students</Chip>
        <Chip color={ac} size={9}>{o.attendance}% att</Chip>
        {highRisk > 0 && <Chip color={T.danger} size={9}>🔴 {highRisk} at risk</Chip>}
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8 }}>
        {['TT1', 'TT2', 'Att'].map((lbl, i) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: checks[i] ? T.success : T.border2, border: `1.5px solid ${checks[i] ? T.success : T.dim}` }} />
            <span style={{ ...mono, fontSize: 9, color: T.dim }}>{lbl}</span>
          </div>
        ))}
        <StagePips current={o.stageInfo.stage} />
      </div>
      {o.pendingAction
        ? <div style={{ background: '#f59e0b0c', border: '1px solid #f59e0b25', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>⚡</span>
            <span style={{ ...mono, fontSize: 10, color: T.warning }}>{o.pendingAction}</span>
            <button onClick={(e) => { e.stopPropagation(); onOpenUpload(o, inferKindFromPendingAction(o.pendingAction)) }} style={{ ...mono, fontSize: 9, color: T.accent, marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Open in Hub →</button>
          </div>
        : <div style={{ background: '#10b9810c', border: '1px solid #10b98125', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>✓</span>
            <span style={{ ...mono, fontSize: 10, color: T.success }}>All caught up</span>
          </div>
      }
    </div>
  )
}

function SummaryTable({ onOpenCourse, onOpenUpload }: { onOpenCourse: (o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void }) {
  return (
    <Card style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>All Offerings — Quick View</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Year', 'Code', 'Course', 'Sec', 'Students', 'Attendance', 'Stage', 'TT1', 'TT2', 'High Risk', 'Action', 'Entry'].map(h => <TH key={h}>{h}</TH>)}</tr>
          </thead>
          <tbody>
            {OFFERINGS.map(o => {
              const ac = o.attendance >= 75 ? T.success : o.attendance >= 65 ? T.warning : T.danger
              const yc = yearColor(o.year)
              const hr = o.stage >= 2 ? getStudents(o).filter(s => s.riskBand === 'High').length : 0
              return (
                <tr key={o.offId} onClick={() => onOpenCourse(o)} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.surface2)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <TD><Chip color={yc} size={9}>{o.year}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 11, color: yc }}>{o.code}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{o.title}</TD>
                  <TD style={{ ...mono, fontSize: 11, color: T.muted }}>Sec {o.section}</TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 600, color: T.text }}>{o.count}</TD>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
                      <Bar val={o.attendance} color={ac} h={4} />
                      <span style={{ ...mono, fontSize: 10, color: ac }}>{o.attendance}%</span>
                    </div>
                  </TD>
                  <TD><Chip color={o.stageInfo.color} size={9}>{o.stageInfo.label}</Chip></TD>
                  <TD style={{ textAlign: 'center' }}><span style={{ color: o.tt1Done ? T.success : T.dim, fontSize: 13 }}>{o.tt1Done ? '✓' : '—'}</span></TD>
                  <TD style={{ textAlign: 'center' }}><span style={{ color: o.tt2Done ? T.success : T.dim, fontSize: 13 }}>{o.tt2Done ? '✓' : '—'}</span></TD>
                  <TD>{hr > 0 ? <Chip color={T.danger} size={9}>{hr} students</Chip> : <span style={{ ...mono, fontSize: 10, color: T.dim }}>—</span>}</TD>
                  <TD>{o.pendingAction ? <Chip color={T.warning} size={9}>{o.pendingAction}</Chip> : <Chip color={T.success} size={9}>✓</Chip>}</TD>
                  <TD><button onClick={(e) => { e.stopPropagation(); onOpenUpload(o, inferKindFromPendingAction(o.pendingAction)) }} style={{ ...mono, fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Open Hub</button></TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════════
   COURSE DETAIL — 9 Tabs (overview, risk, attendance, TT1/TT2, quizzes, assignments, CO, gradebook)
   ══════════════════════════════════════════════════════════════ */

const TAB_DEFS = [
  { id: 'overview', icon: '🏠', label: 'Overview' },
  { id: 'risk', icon: '🎯', label: 'Risk Analysis' },
  { id: 'attendance', icon: '📅', label: 'Attendance' },
  { id: 'tt1', icon: '📝', label: 'TT1' },
  { id: 'tt2', icon: '📝', label: 'TT2' },
  { id: 'quizzes', icon: '❓', label: 'Quizzes' },
  { id: 'assignments', icon: '📄', label: 'Assignments' },
  { id: 'co', icon: '🎯', label: 'CO Attainment' },
  { id: 'gradebook', icon: '📊', label: 'Grade Book' },
]

function CourseDetail({ offering: o, onBack, onOpenStudent, onOpenEntryHub, initialTab }: { offering: Offering; onBack: () => void; onOpenStudent: (s: Student) => void; onOpenEntryHub: (kind: EntryKind) => void; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab ?? 'overview')
  const yc = yearColor(o.year)
  const students = useMemo(() => getStudents(o), [o.offId])
  const cos = CO_MAP[o.code] || CO_MAP['default']
  const paper = PAPER_MAP[o.code] || PAPER_MAP['default']
  const tabLocked = (t: string) => (t === 'tt2' && o.stageInfo.stage < 2) || (t === 'risk' && o.stage < 2)

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '16px 32px' }}>
        <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>← Back to Dashboard</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
              <Chip color={yc}>{o.year}</Chip><Chip color={T.muted}>{o.dept}</Chip>
              <Chip color={T.muted}>Sem {o.sem}</Chip><Chip color={T.muted}>Sec {o.section}</Chip>
              <Chip color={o.stageInfo.color}>{o.stageInfo.label} · {o.stageInfo.desc}</Chip>
            </div>
            <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: T.text }}>
              <span style={{ color: yc }}>{o.code}</span> — {o.title}
            </div>
          </div>
          <Btn variant="ghost" size="sm">📥 Export</Btn>
        </div>
        {/* Stage stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 14, maxWidth: 420 }}>
          {['Term Start', 'TT1', 'TT2', 'Finals'].map((lbl, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 10, fontWeight: 700, background: i < o.stageInfo.stage ? stageColor((i + 1) as Stage) : T.border2, border: `2px solid ${i < o.stageInfo.stage ? stageColor((i + 1) as Stage) : T.dim}`, color: i < o.stageInfo.stage ? '#fff' : T.dim }}>
                {i < o.stageInfo.stage ? '✓' : i + 1}
              </div>
              <span style={{ ...mono, fontSize: 8, color: T.dim, marginLeft: 4, whiteSpace: 'nowrap' }}>{lbl}</span>
              {i < 3 && <div style={{ flex: 1, height: 2, background: i < o.stageInfo.stage - 1 ? stageColor((i + 1) as Stage) : T.border, margin: '0 6px' }} />}
            </div>
          ))}
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginTop: 14, borderBottom: `1px solid ${T.border}`, marginBottom: -17, marginLeft: -32, marginRight: -32, paddingLeft: 32, overflowX: 'auto' }}>
          {TAB_DEFS.map(t => {
            const locked = tabLocked(t.id)
            return (
              <button key={t.id} onClick={() => !locked && setTab(t.id)}
                style={{ ...mono, fontSize: 11, padding: '9px 13px', background: 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', color: tab === t.id ? T.accentLight : locked ? T.dim : T.muted, borderBottom: `2px solid ${tab === t.id ? T.accent : 'transparent'}`, opacity: locked ? 0.35 : 1, whiteSpace: 'nowrap', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 4 }}>
                {t.icon} {t.label}{locked ? ' 🔒' : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
        {tab === 'overview' && <OverviewTab o={o} cos={cos} students={students} setTab={setTab} />}
        {tab === 'risk' && <RiskTab o={o} students={students} onOpenStudent={onOpenStudent} />}
        {tab === 'attendance' && <AttendanceTab o={o} students={students} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('attendance')} />}
        {tab === 'tt1' && <TTTab o={o} ttNum={1} cos={cos} paper={paper} students={students} onOpenEntryHub={onOpenEntryHub} />}
        {tab === 'tt2' && <TTTab o={o} ttNum={2} cos={cos} paper={paper} students={students} onOpenEntryHub={onOpenEntryHub} />}
        {tab === 'quizzes' && <QuizzesTab students={students} tt1Done={o.tt1Done} onOpenEntryHub={() => onOpenEntryHub('quiz')} />}
        {tab === 'assignments' && <AssignmentsTab students={students} tt1Done={o.tt1Done} onOpenEntryHub={() => onOpenEntryHub('assignment')} />}
        {tab === 'co' && <COTab cos={cos} />}
        {tab === 'gradebook' && <GradeBookTab o={o} students={students} onOpenEntryHub={() => onOpenEntryHub('finals')} />}
      </div>
    </div>
  )
}

/* ─── Overview Tab ─── */
function OverviewTab({ o, cos, students, setTab }: { o: Offering; cos: CODef[]; students: Student[]; setTab: (t: string) => void }) {
  const det = students.filter(s => s.present / s.totalClasses < 0.65).length
  const risk = students.filter(s => { const p = s.present / s.totalClasses; return p >= 0.65 && p < 0.75 }).length
  const good = students.length - det - risk
  const highRisk = students.filter(s => s.riskBand === 'High').length
  const checks = [
    { lbl: 'Attendance tracked', done: true, tab: 'attendance' },
    { lbl: 'TT1 paper CO mapped', done: o.tt1Done, tab: 'tt1' },
    { lbl: 'TT1 marks entered', done: o.tt1Done, tab: 'tt1' },
    { lbl: 'Quiz 1 marks entered', done: o.tt1Done, tab: 'quizzes' },
    { lbl: 'Assignment 1 entered', done: false, tab: 'assignments' },
    { lbl: 'TT2 paper CO mapped', done: o.stageInfo.stage > 2, tab: 'tt2' },
    { lbl: 'TT2 marks entered', done: o.tt2Done, tab: 'tt2' },
    { lbl: 'Attendance finalised', done: o.stageInfo.stage >= 3, tab: 'attendance' },
  ]
  const doneCount = checks.filter(c => c.done).length

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Semester Checklist */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>Semester Checklist</div>
            <div style={{ ...mono, fontSize: 11, color: T.success }}>{doneCount}/{checks.length}</div>
          </div>
          <Bar val={doneCount} max={checks.length} color={T.success} h={6} />
          <div style={{ height: 12 }} />
          {checks.map((c, i) => (
            <div key={i} onClick={() => setTab(c.tab)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < checks.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}>
              <div style={{ width: 17, height: 17, borderRadius: '50%', flexShrink: 0, background: c.done ? '#10b98120' : T.surface3, border: `2px solid ${c.done ? T.success : T.dim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: T.success }}>{c.done ? '✓' : ''}</div>
              <span style={{ ...mono, fontSize: 11, color: c.done ? T.muted : T.text, flex: 1, textDecoration: c.done ? 'line-through' : 'none' }}>{c.lbl}</span>
              {!c.done && <span style={{ ...mono, fontSize: 10, color: T.accent }}>→</span>}
            </div>
          ))}
        </Card>
        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 12 }}>Class Health</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ lbl: 'Enrolled', val: o.count, col: T.accent }, { lbl: 'Good (≥75%)', val: good, col: T.success }, { lbl: 'At Risk (<75%)', val: risk, col: T.warning }, { lbl: 'Detained (<65%)', val: det, col: T.danger }].map((x, i) => (
                <div key={i} style={{ background: T.surface2, borderRadius: 7, padding: '10px 12px', border: `1px solid ${x.col}18` }}>
                  <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: x.col }}>{x.val}</div>
                  <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 0, height: 7, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
              {[{ val: good, col: T.success }, { val: risk, col: T.warning }, { val: det, col: T.danger }].map((x, i) => (
                <div key={i} style={{ flex: x.val || 0.1, background: x.col, minWidth: x.val > 0 ? 2 : 0 }} />
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
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 8 }}>{students.filter(s => s.riskBand === 'Medium').length} at medium risk</div>
              <Btn size="sm" onClick={() => setTab('risk')} variant="ghost">View Risk Analysis →</Btn>
            </Card>
          )}
          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Course Outcomes</div>
            {cos.slice(0, 4).map((co, i) => (
              <div key={co.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: i < Math.min(cos.length, 4) - 1 ? `1px solid ${T.border}` : 'none' }}>
                <Chip color={CO_COLORS[i % CO_COLORS.length]} size={9}>{co.id}</Chip>
                <div style={{ ...mono, fontSize: 10, color: T.muted, flex: 1, lineHeight: 1.4 }}>{co.desc.slice(0, 55)}…</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ─── Risk Analysis Tab ─── */
function RiskTab({ o, students, onOpenStudent }: { o: Offering; students: Student[]; onOpenStudent: (s: Student) => void }) {
  const [filter, setFilter] = useState<'all' | RiskBand>('all')
  const atRisk = students.filter(s => s.riskProb !== null)
  const filtered = filter === 'all' ? atRisk : atRisk.filter(s => s.riskBand === filter)
  const sorted = [...filtered].sort((a, b) => (b.riskProb ?? 0) - (a.riskProb ?? 0))
  const high = atRisk.filter(s => s.riskBand === 'High').length
  const med = atRisk.filter(s => s.riskBand === 'Medium').length
  const low = atRisk.filter(s => s.riskBand === 'Low').length
  const avgRisk = atRisk.length ? Math.round(atRisk.reduce((a, s) => a + (s.riskProb ?? 0), 0) / atRisk.length * 100) : 0

  return (
    <div style={{ padding: '24px 32px', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color={T.accent} /> Risk Analysis — {o.code} Sec {o.section}
          </div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>XGBoost prediction after TT1 · TreeSHAP explanations · {atRisk.length} students scored</div>
        </div>
      </div>

      {/* Risk distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { lbl: 'Average Risk', val: `${avgRisk}%`, col: avgRisk > 50 ? T.danger : avgRisk > 30 ? T.warning : T.success, f: 'all' as const },
          { lbl: 'High Risk (≥70%)', val: String(high), col: T.danger, f: 'High' as const },
          { lbl: 'Medium (35-70%)', val: String(med), col: T.warning, f: 'Medium' as const },
          { lbl: 'Low (<35%)', val: String(low), col: T.success, f: 'Low' as const },
        ].map((x, i) => (
          <Card key={i} glow={x.col} style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => setFilter(x.f)}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: x.col }}>{x.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
          </Card>
        ))}
      </div>

      {/* Distribution bar */}
      <Card style={{ padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>Risk Distribution</div>
        <div style={{ display: 'flex', gap: 0, height: 20, borderRadius: 6, overflow: 'hidden' }}>
          {[{ val: high, col: T.danger, lbl: 'High' }, { val: med, col: T.warning, lbl: 'Med' }, { val: low, col: T.success, lbl: 'Low' }].map((x, i) => (
            <div key={i} style={{ flex: x.val || 0.1, background: x.col, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: x.val > 0 ? 30 : 0 }}>
              {x.val > 0 && <span style={{ ...mono, fontSize: 9, color: '#fff', fontWeight: 700 }}>{x.val}</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Student risk table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Students by Risk ({filter === 'all' ? 'All' : filter})</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'High', 'Medium', 'Low'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ ...mono, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${filter === f ? T.accent : T.border}`, background: filter === f ? T.accent + '18' : 'transparent', color: filter === f ? T.accentLight : T.muted, cursor: 'pointer' }}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['USN', 'Student', 'Risk', 'Attendance', 'TT1', 'Top Driver', 'What-If', ''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {sorted.map(s => {
                const attPct = Math.round(s.present / s.totalClasses * 100)
                return (
                  <tr key={s.id} onClick={() => onOpenStudent(s)} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.surface2)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{s.usn}</TD>
                    <TD style={{ ...sora, fontSize: 12, color: T.text, whiteSpace: 'nowrap' }}>{s.name}</TD>
                    <TD><RiskBadge band={s.riskBand} prob={s.riskProb} /></TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                        <Bar val={attPct} color={attPct >= 75 ? T.success : attPct >= 65 ? T.warning : T.danger} h={4} />
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>{attPct}%</span>
                      </div>
                    </TD>
                    <TD style={{ ...mono, fontSize: 11, color: s.tt1Score !== null ? (s.tt1Score / s.tt1Max >= 0.5 ? T.success : T.danger) : T.dim }}>{s.tt1Score !== null ? `${s.tt1Score}/${s.tt1Max}` : '—'}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.muted, maxWidth: 180 }}>{s.reasons[0]?.label || '—'}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.blue }}>{s.whatIf[0] ? `→ ${Math.round(s.whatIf[0].newRisk * 100)}%` : '—'}</TD>
                    <TD><button aria-label={`Open ${s.name} details`} title="Open student" onClick={e => { e.stopPropagation(); onOpenStudent(s) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><ArrowUpRight size={13} /></button></TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ─── Attendance Tab ─── */
function AttendanceTab({ o, students, onOpenStudent, onOpenEntryHub }: { o: Offering; students: Student[]; onOpenStudent: (s: Student) => void; onOpenEntryHub: () => void }) {
  const sorted = [...students].sort((a, b) => a.present / a.totalClasses - b.present / b.totalClasses)
  const stats = { good: students.filter(s => s.present / s.totalClasses >= 0.75).length, risk: students.filter(s => { const p = s.present / s.totalClasses; return p >= 0.65 && p < 0.75 }).length, det: students.filter(s => s.present / s.totalClasses < 0.65).length }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Attendance Register — {o.count} students</div>
        <Btn size="sm" onClick={onOpenEntryHub}>Enter Attendance via Data Entry Hub →</Btn>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {[{ lbl: 'Good ≥75%', val: stats.good, col: T.success }, { lbl: 'At Risk', val: stats.risk, col: T.warning }, { lbl: 'Detained <65%', val: stats.det, col: T.danger }].map((x, i) => (
          <Card key={i} style={{ flex: 1, padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: x.col }}>{x.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', 'Present / 45', 'Attendance', 'Risk', 'Status'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {sorted.map((s, i) => {
                const pct = Math.round(s.present / s.totalClasses * 100)
                const col = pct >= 75 ? T.success : pct >= 65 ? T.warning : T.danger
                return (
                  <tr key={s.id} onClick={() => onOpenStudent(s)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.surface2)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{i + 1}</TD>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{s.usn}</TD>
                    <TD style={{ ...sora, fontSize: 12, color: T.text, whiteSpace: 'nowrap' }}>{s.name}</TD>
                    <TD style={{ ...mono, fontSize: 12, color: T.text }}>{s.present} / {s.totalClasses}</TD>
                    <TD><div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}><Bar val={pct} color={col} h={4} /><span style={{ ...mono, fontSize: 10, color: col }}>{pct}%</span></div></TD>
                    <TD><RiskBadge band={s.riskBand} prob={s.riskProb} /></TD>
                    <TD><Chip color={col} size={9}>{pct >= 75 ? 'Good' : pct >= 65 ? 'At Risk' : 'Detained'}</Chip></TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ─── TT Tab ─── */
function TTTab({ o, ttNum, cos, paper, students, onOpenEntryHub }: { o: Offering; ttNum: number; cos: CODef[]; paper: PaperQ[]; students: Student[]; onOpenEntryHub: (kind: EntryKind) => void }) {
  const [step, setStep] = useState<'paper' | 'marks'>('paper')
  const [isLocked, setIsLocked] = useState(ttNum === 1 ? !!o.tt1Locked : !!o.tt2Locked)
  const prePopulated = ttNum === 1 ? o.tt1Done : o.tt2Done
  const totalMax = paper.reduce((a, q) => a + q.maxMarks, 0)
  const coColorMap = Object.fromEntries(cos.map((c, i) => [c.id, CO_COLORS[i % CO_COLORS.length]]))
  const coIds = [...new Set(paper.flatMap(q => q.cos))]

  const handleLock = () => {
    if (confirm('Are you sure you want to Submit & Lock? This cannot be undone and will trigger ML Risk analysis updating.')) {
      setIsLocked(true)
    }
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {([{ id: 'paper' as const, lbl: '① Question Paper & CO Map' }, { id: 'marks' as const, lbl: '② Marks Entry' }]).map(s => (
          <button key={s.id} onClick={() => s.id === 'marks' ? onOpenEntryHub(ttNum === 1 ? 'tt1' : 'tt2') : setStep('paper')} style={{ ...mono, fontSize: 11, padding: '7px 14px', borderRadius: 7, cursor: 'pointer', background: step === s.id ? T.accent + '18' : 'transparent', border: `1px solid ${step === s.id ? T.accent : T.border}`, color: step === s.id ? T.accentLight : T.muted }}>{s.lbl}</button>
        ))}
      </div>

      {step === 'paper' && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text, marginBottom: 4 }}>TT{ttNum} — Question Paper & CO Mapping</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 14 }}>Each question is mapped to COs. Total must equal 30.</div>
          {isLocked && <div style={{ marginBottom: 12, padding: '10px 14px', background: T.success + '1a', color: T.success, ...mono, fontSize: 11, borderRadius: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Shield size={14} /> Data Locked. ML Risk predictions updated.</div>}
          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Q#', 'Question', 'Max', 'Mapped COs'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {paper.map((q, i) => (
                  <tr key={q.id}>
                    <TD style={{ ...mono, fontSize: 12, color: T.accent, fontWeight: 700 }}>Q{i + 1}</TD>
                    <TD style={{ ...sora, fontSize: 12, color: T.text }}>{q.text}</TD>
                    <TD style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.text }}>{q.maxMarks}</TD>
                    <TD><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{q.cos.map(co => <Chip key={co} color={coColorMap[co] || T.muted} size={9}>{co}</Chip>)}</div></TD>
                  </tr>
                ))}
                <tr style={{ background: T.surface2 }}>
                  <TD colSpan={2} style={{ ...mono, fontSize: 11, color: T.muted }}>Total</TD>
                  <TD style={{ ...mono, fontSize: 13, fontWeight: 800, color: totalMax === 30 ? T.success : T.danger }}>{totalMax} / 30</TD>
                  <TD>&nbsp;</TD>
                </tr>
              </tbody>
            </table>
          </Card>
          {totalMax === 30 ? <Btn onClick={() => onOpenEntryHub(ttNum === 1 ? 'tt1' : 'tt2')}>Proceed to Data Entry Hub →</Btn> : <div style={{ ...mono, fontSize: 11, color: T.danger }}>⚠ Total must be 30</div>}
        </div>
      )}

      {step === 'marks' && (
        <>
          <Card style={{ marginBottom: 14, padding: '16px 18px' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 6 }}>Marks entry is routed through Data Entry Hub in v1.</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 10 }}>Use one consistent workflow for TT, quizzes, assignments, attendance, and finals.</div>
            <Btn size="sm" onClick={() => onOpenEntryHub(ttNum === 1 ? 'tt1' : 'tt2')}>Open Data Entry Hub</Btn>
          </Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>TT{ttNum} Marks Entry</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{o.count} students · {isLocked ? 'Submitted & Locked' : prePopulated ? 'Draft' : 'Not Started'}</div>
            </div>
            {!isLocked && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" size="sm">💾 Save Draft</Btn>
                <Btn size="sm" onClick={handleLock}>Submit & Lock 🔒</Btn>
              </div>
            )}
          </div>
          {isLocked && <div style={{ marginBottom: 14, padding: '10px 14px', background: T.success + '1a', color: T.success, ...mono, fontSize: 11, borderRadius: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Shield size={14} /> Data Locked. ML Risk predictions updated.</div>}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH>USN</TH><TH>Name</TH>
                    {paper.map((q, i) => (
                      <th key={q.id} style={{ ...mono, fontSize: 9, color: T.accent, textAlign: 'center' as const, padding: '10px 6px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                        Q{i + 1} /{q.maxMarks}
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2 }}>{q.cos.map(co => <Chip key={co} color={coColorMap[co]} size={8}>{co}</Chip>)}</div>
                      </th>
                    ))}
                    <TH>Total</TH><TH>Risk</TH>
                  </tr>
                </thead>
                <tbody>
                  {students.slice(0, 20).map(s => {
                    const tt = ttNum === 1 ? s.tt1Score : s.tt2Score
                    return (
                      <tr key={s.id}>
                        <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{s.usn}</TD>
                        <TD style={{ ...sora, fontSize: 11, color: T.text, whiteSpace: 'nowrap' }}>{s.name}</TD>
                        {paper.map(q => (
                          <td key={q.id} style={{ padding: '4px 6px', textAlign: 'center', borderBottom: `1px solid ${T.border}` }}>
                            <input aria-label={`Marks for ${s.name}, question ${q.id}`} title={`Enter marks for ${q.id}`} type="number" min={0} max={q.maxMarks} defaultValue={prePopulated && tt !== null ? Math.min(q.maxMarks, Math.max(0, Math.round(tt / paper.length))) : undefined}
                              disabled={isLocked}
                              style={{ width: 42, textAlign: 'center', borderRadius: 4, background: T.surface2, border: `1px solid ${T.border2}`, color: T.text, opacity: isLocked ? 0.6 : 1, ...mono, fontSize: 12, padding: '3px', outline: 'none' }} />
                          </td>
                        ))}
                        <TD style={{ ...mono, fontSize: 12, fontWeight: 700, textAlign: 'center', color: tt !== null && tt >= totalMax * 0.5 ? T.success : T.danger }}>{tt ?? '—'}</TD>
                        <TD><RiskBadge band={s.riskBand} prob={s.riskProb} /></TD>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {students.length > 20 && <div style={{ ...mono, fontSize: 11, color: T.muted, padding: '12px 18px', textAlign: 'center' }}>Showing 20 of {students.length} · Scroll or export for full list</div>}
          </Card>
          {/* Live CO Preview */}
          <Card style={{ marginTop: 14 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 10 }}>Live CO Attainment Preview</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {coIds.map((co) => {
                const col = coColorMap[co] || T.muted
                const att = 40 + Math.round(Math.random() * 40)
                return (
                  <div key={co} style={{ background: T.surface2, borderRadius: 8, padding: '10px 14px', flex: '1 1 80px', textAlign: 'center' }}>
                    <div style={{ ...mono, fontSize: 10, color: col }}>{co}</div>
                    <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: att >= 60 ? T.success : T.danger }}>{att}%</div>
                    <Bar val={att} color={att >= 60 ? T.success : T.danger} h={5} />
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

/* ─── Quizzes Tab ─── */
function QuizzesTab({ students, tt1Done, onOpenEntryHub }: { students: Student[]; tt1Done: boolean; onOpenEntryHub: () => void }) {
  const quizzes = [{ id: 'q1', name: 'Quiz 1', entered: tt1Done }, { id: 'q2', name: 'Quiz 2', entered: false }, { id: 'q3', name: 'Quiz 3', entered: false }]
  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Quizzes <span style={{ ...mono, fontSize: 11, color: T.muted }}>— Best 2 of 3 counted</span></div>
        <Btn size="sm" onClick={onOpenEntryHub}>Enter Quiz Scores via Data Entry Hub →</Btn>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {quizzes.map(q => (
          <Card key={q.id} style={{ flex: 1, padding: '14px 16px' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{q.name}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Max: 10 marks</div>
            <div style={{ marginTop: 8 }}><Chip color={q.entered ? T.success : T.warning}>{q.entered ? 'Entered' : 'Pending'}</Chip></div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', 'Quiz 1', 'Quiz 2', 'Quiz 3', 'Best 2 Avg'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {students.slice(0, 15).map((s, i) => (
                <tr key={s.id}>
                  <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{i + 1}</TD>
                  <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{s.usn}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{s.name}</TD>
                  <TD style={{ ...mono, fontSize: 12, color: s.quiz1 !== null ? T.text : T.dim }}>{s.quiz1 ?? '—'}</TD>
                  <TD style={{ ...mono, fontSize: 12, color: T.dim }}>—</TD>
                  <TD style={{ ...mono, fontSize: 12, color: T.dim }}>—</TD>
                  <TD style={{ ...mono, fontSize: 12, color: T.muted }}>{s.quiz1 !== null ? s.quiz1 : '—'}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ─── Assignments Tab ─── */
function AssignmentsTab({ students, tt1Done, onOpenEntryHub }: { students: Student[]; tt1Done: boolean; onOpenEntryHub: () => void }) {
  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Assignments</div>
        <Btn size="sm" onClick={onOpenEntryHub}>Enter Assignment Scores via Data Entry Hub →</Btn>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {[{ name: 'Assignment 1', topic: 'Complexity Analysis', entered: tt1Done, cos: ['CO1'] }, { name: 'Assignment 2', topic: 'DP and Graphs', entered: false, cos: ['CO3', 'CO4'] }].map((a, i) => (
          <Card key={i} style={{ flex: 1, padding: '14px 16px' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{a.name}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{a.topic}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>{a.cos.map(c => <Chip key={c} color={T.accent} size={9}>{c}</Chip>)}<Chip color={a.entered ? T.success : T.warning}>{a.entered ? 'Entered' : 'Pending'}</Chip></div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#', 'USN', 'Name', 'Asgn 1 /10', 'Asgn 2 /10'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {students.slice(0, 15).map((s, i) => (
                <tr key={s.id}>
                  <TD style={{ ...mono, fontSize: 10, color: T.dim }}>{i + 1}</TD>
                  <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{s.usn}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{s.name}</TD>
                  <TD style={{ ...mono, fontSize: 12, color: s.asgn1 !== null ? T.text : T.dim }}>{s.asgn1 ?? '—'}</TD>
                  <TD style={{ ...mono, fontSize: 12, color: T.dim }}>—</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ─── CO Attainment Tab ─── */
function COTab({ cos }: { cos: CODef[] }) {
  const target = 60
  const mockAtts: Record<string, { tt1: number | null; asgn: number | null }> = {
    CO1: { tt1: 72, asgn: 78 }, CO2: { tt1: 58, asgn: 65 }, CO3: { tt1: 48, asgn: null }, CO4: { tt1: null, asgn: null }, CO5: { tt1: null, asgn: null },
  }
  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text, marginBottom: 16 }}>CO Attainment Report</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {cos.map((co, i) => {
          const a = mockAtts[co.id]; const val = a?.tt1; const col = CO_COLORS[i % CO_COLORS.length]
          return (
            <Card key={co.id} glow={col} style={{ textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ ...mono, fontSize: 10, color: col, marginBottom: 4 }}>{co.id}</div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 28, color: val == null ? T.dim : val >= target ? T.success : T.danger }}>{val != null ? `${val}%` : '—'}</div>
              <div style={{ ...mono, fontSize: 9, color: T.dim, marginBottom: 6 }}>{val != null ? (val >= target ? '✓ Met' : '✗ Below') : 'No data'}</div>
              <div style={{ position: 'relative' }}>
                <Bar val={val ?? 0} color={val == null ? T.border : val >= target ? T.success : T.danger} h={6} />
                <div style={{ position: 'absolute', top: -1, left: `${target}%`, width: 1.5, height: 8, background: T.warning }} />
              </div>
            </Card>
          )
        })}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['CO', 'Description', 'Bloom', 'TT1', 'Assignment', 'Status'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {cos.map((co, i) => {
              const a = mockAtts[co.id]; const col = CO_COLORS[i % CO_COLORS.length]
              return (
                <tr key={co.id}>
                  <TD><Chip color={col} size={9}>{co.id}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 11, color: T.text, maxWidth: 200 }}>{co.desc}</TD>
                  <TD><Chip color={T.dim} size={9}>{co.bloom}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 700, color: a?.tt1 != null ? (a.tt1 >= target ? T.success : T.danger) : T.dim }}>{a?.tt1 != null ? `${a.tt1}%` : '—'}</TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 700, color: a?.asgn != null ? (a.asgn >= target ? T.success : T.danger) : T.dim }}>{a?.asgn != null ? `${a.asgn}%` : '—'}</TD>
                  <TD>{a?.tt1 != null ? (a.tt1 >= target ? <Chip color={T.success} size={9}>✓ Met</Chip> : <Chip color={T.danger} size={9}>✗ Below</Chip>) : <Chip color={T.dim} size={9}>Pending</Chip>}</TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ─── Grade Book Tab ─── */
function GradeBookTab({ students, onOpenEntryHub }: { o: Offering; students: Student[]; onOpenEntryHub: () => void }) {
  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text }}>Grade Book — CE Marks</div>
        <Btn size="sm" onClick={onOpenEntryHub}>Enter SEE/Finals via Data Entry Hub →</Btn>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['USN', 'Name', 'Att /10', 'TT1 /15', 'TT2 /15', 'Quiz /10', 'Asgn /10', 'CE /50', 'SEE', 'Risk'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {students.slice(0, 20).map(s => {
                const attPct = Math.round(s.present / s.totalClasses * 100)
                const attM = attPct >= 75 ? 10 : attPct >= 65 ? Math.round((attPct - 65) / 10 * 10) : 0
                const tt1s = s.tt1Score !== null ? Math.round(s.tt1Score / s.tt1Max * 15) : null
                const tt2s = s.tt2Score !== null ? Math.round(s.tt2Score / s.tt2Max * 15) : null
                const ce = attM + (tt1s ?? 0) + (tt2s ?? 0) + (s.quiz1 ?? 0) + (s.asgn1 ?? 0)
                return (
                  <tr key={s.id}>
                    <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{s.usn}</TD>
                    <TD style={{ ...sora, fontSize: 11, color: T.text, whiteSpace: 'nowrap' }}>{s.name}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: attM >= 8 ? T.success : T.warning }}>{attM}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: tt1s !== null ? T.text : T.dim }}>{tt1s ?? '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: tt2s !== null ? T.text : T.dim }}>{tt2s ?? '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: s.quiz1 !== null ? T.text : T.dim }}>{s.quiz1 ?? '—'}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: s.asgn1 !== null ? T.text : T.dim }}>{s.asgn1 ?? '—'}</TD>
                    <TD style={{ ...mono, fontSize: 12, fontWeight: 700, textAlign: 'center', color: ce >= 25 ? T.success : ce >= 20 ? T.warning : T.danger }}>{ce}</TD>
                    <TD style={{ ...mono, fontSize: 11, textAlign: 'center', color: T.dim }}>—</TD>
                    <TD><RiskBadge band={s.riskBand} prob={s.riskProb} /></TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MENTOR VIEW — Student-centric, cross-subject risk
   ══════════════════════════════════════════════════════════════ */

function MentorView({ onOpenMentee }: { onOpenMentee: (m: Mentee) => void }) {
  const sorted = [...MENTEES].sort((a, b) => b.avs - a.avs)
  const highRisk = MENTEES.filter(m => m.avs >= 0.6).length
  const medRisk = MENTEES.filter(m => m.avs >= 0.35 && m.avs < 0.6).length
  const noData = MENTEES.filter(m => m.avs < 0).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, animation: 'fadeUp 0.35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Users size={22} color={T.accent} />
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>My Mentees</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Student-centric view · Aggregate vulnerability across all courses</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { lbl: 'Total Mentees', val: MENTEES.length, col: T.accent },
          { lbl: 'High Vulnerability', val: highRisk, col: T.danger },
          { lbl: 'Medium Risk', val: medRisk, col: T.warning },
          { lbl: 'Awaiting Data', val: noData, col: T.dim },
        ].map((x, i) => (
          <Card key={i} glow={x.col} style={{ padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: x.col }}>{x.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(m => {
          const avsBand = m.avs >= 0.6 ? 'High' : m.avs >= 0.35 ? 'Medium' : m.avs >= 0 ? 'Low' : null
          const avsCol = avsBand === 'High' ? T.danger : avsBand === 'Medium' ? T.warning : avsBand === 'Low' ? T.success : T.dim
          return (
            <Card key={m.id} glow={avsCol} style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => onOpenMentee(m)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>{m.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 1 }}>{m.usn} · {m.year} · Sec {m.section} · {m.dept}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {m.avs >= 0 ? (
                    <>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: avsCol }}>{Math.round(m.avs * 100)}%</div>
                      <div style={{ ...mono, fontSize: 9, color: T.muted }}>Aggregate Vulnerability</div>
                    </>
                  ) : (
                    <Chip color={T.dim} size={10}>Awaiting TT1</Chip>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {m.courseRisks.map(cr => {
                  const rCol = cr.risk >= 0.7 ? T.danger : cr.risk >= 0.35 ? T.warning : cr.risk >= 0 ? T.success : T.dim
                  return (
                    <div key={cr.code} style={{ flex: '1 1 140px', background: T.surface2, borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>{cr.code}</span>
                        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: rCol }}>{cr.risk >= 0 ? `${Math.round(cr.risk * 100)}%` : '—'}</span>
                      </div>
                      <Bar val={cr.risk >= 0 ? cr.risk * 100 : 0} color={rCol} h={4} />
                      <div style={{ ...mono, fontSize: 8, color: T.dim, marginTop: 2 }}>{cr.title.slice(0, 25)}</div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {m.interventions.length > 0 ? (
                  <>
                    <Chip color={T.warning} size={9}>Last: {m.interventions[m.interventions.length - 1].date}</Chip>
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>{m.interventions[m.interventions.length - 1].note.slice(0, 40)}…</span>
                  </>
                ) : (
                  <span style={{ ...mono, fontSize: 10, color: T.dim }}>No interventions logged</span>
                )}
                {m.prevCgpa > 0 && <Chip color={T.dim} size={9}>CGPA: {m.prevCgpa.toFixed(1)}</Chip>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button aria-label={`Copy ${m.name} phone number`} title="Copy phone" onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(m.phone) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Phone size={13} /></button>
                  <button aria-label={`Email ${m.name}`} title="Email" onClick={e => e.stopPropagation()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Mail size={13} /></button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   HOD VIEW — Teacher-centric with drill-down
   ══════════════════════════════════════════════════════════════ */

function HodView({ onOpenUpload, onOpenCourse, onOpenStudent, tasks }: { onOpenUpload: (o?: Offering, kind?: EntryKind) => void; onOpenCourse: (o: Offering) => void; onOpenStudent: (s: Student, o?: Offering) => void; tasks: SharedTask[] }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  const teacherCourseMap: Record<string, string[]> = useMemo(
    () => Object.fromEntries(TEACHER_ACCOUNTS.map(t => [t.teacherId, t.courseCodes])) as Record<string, string[]>,
    []
  )

  const teacherOfferingsById = useMemo(() => {
    const map: Record<string, Offering[]> = Object.fromEntries(TEACHERS.map(t => [t.id, [] as Offering[]]))
    OFFERINGS.forEach(o => {
      const mappedTeacher = TEACHERS.find(t => (teacherCourseMap[t.id] || []).includes(o.code))
      const teacherId = mappedTeacher
        ? mappedTeacher.id
        : TEACHERS[o.offId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % TEACHERS.length].id
      map[teacherId].push(o)
    })
    return map
  }, [teacherCourseMap])

  const teacherStats = useMemo(() => {
    return TEACHERS.map(t => {
      const offerings = teacherOfferingsById[t.id] ?? []
      const students = offerings.reduce((a, o) => a + o.count, 0)
      const highRisk = offerings.reduce((a, o) => a + getStudents(o).filter(s => s.riskBand === 'High').length, 0)
      const avgAtt = offerings.length > 0 ? Math.round(offerings.reduce((a, o) => a + o.attendance, 0) / offerings.length) : 0
      const lockChecks = offerings.flatMap(o => [o.tt1Locked ? 1 : 0, o.tt2Locked ? 1 : 0])
      const completeness = lockChecks.length > 0 ? Math.round(lockChecks.reduce((a, x) => a + x, 0) / lockChecks.length * 100) : 0
      const pendingTasks = offerings.filter(o => !!o.pendingAction).length
      return { ...t, offerings, students, highRisk, avgAtt, completeness, pendingTasks }
    })
  }, [teacherOfferingsById])

  const selectedTeacher = useMemo(() => teacherStats.find(t => t.id === selectedTeacherId) ?? null, [teacherStats, selectedTeacherId])
  const mentorTasks = useMemo(() => {
    return MENTEES
      .filter(m => m.avs >= 0.5)
      .flatMap(m => m.courseRisks
        .filter(cr => cr.risk >= 0.5)
        .map(cr => ({
          id: `mentor-${m.id}-${cr.code}`,
          studentId: `mentee-${m.id}`,
          offeringId: OFFERINGS.find(o => o.code === cr.code)?.offId ?? '',
          studentName: m.name,
          studentUsn: m.usn,
          courseCode: cr.code,
          courseName: cr.title,
          year: m.year,
          riskBand: cr.risk >= 0.7 ? 'High' as RiskBand : cr.risk >= 0.35 ? 'Medium' as RiskBand : 'Low' as RiskBand,
          title: `Mentor follow-up: ${Math.round(cr.risk * 100)}% vulnerability in ${cr.code}`,
          due: 'This week',
          status: m.interventions.length > 0 ? 'In Progress' : 'New',
          riskProb: cr.risk,
          actionHint: 'Mentor-generated follow-up task',
          priority: Math.round(cr.risk * 100),
        })))
  }, [])

  const selectedTeacherTasks = useMemo(() => {
    if (!selectedTeacher) return []
    const offIds = new Set(selectedTeacher.offerings.map(o => o.offId))
    const courseCodes = new Set(selectedTeacher.offerings.map(o => o.code))
    const courseLeaderTasks = tasks.filter(t => offIds.has(t.offeringId))
    const mentorLinked = mentorTasks.filter(t => courseCodes.has(t.courseCode))
    return [...courseLeaderTasks, ...mentorLinked]
      .sort((a, b) => b.riskProb - a.riskProb)
      .slice(0, 8)
  }, [tasks, mentorTasks, selectedTeacher])

  const totalStudents = teacherStats.reduce((a, t) => a + t.students, 0)
  const totalHighRisk = teacherStats.reduce((a, t) => a + t.highRisk, 0)
  const avgAttendance = teacherStats.length > 0 ? Math.round(teacherStats.reduce((a, t) => a + t.avgAtt, 0) / teacherStats.length) : 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, animation: 'fadeUp 0.35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Shield size={22} color={T.accent} />
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>Department Overview — CSE</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Head of Department view · All faculty and students</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Btn size="sm" onClick={() => onOpenUpload()}>Open Data Entry Hub</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { lbl: 'Faculty', val: teacherStats.length, col: T.accent },
          { lbl: 'Total Students', val: totalStudents, col: T.success },
          { lbl: 'High Risk (dept)', val: totalHighRisk, col: T.danger },
          { lbl: 'Avg Attendance', val: `${avgAttendance}%`, col: T.blue },
        ].map((x, i) => (
          <Card key={i} glow={x.col} style={{ padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: x.col }}>{x.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
          </Card>
        ))}
      </div>

      <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 12 }}>Faculty Members</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 22 }}>
        {teacherStats.map(t => {
          const isSelected = selectedTeacher?.id === t.id
          return (
            <Card key={t.id} glow={isSelected ? T.accent : undefined} style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setSelectedTeacherId(isSelected ? null : t.id)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 13, color: '#fff' }}>{t.initials}</div>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{t.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{t.role}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { lbl: 'Offerings', val: t.offerings.length, col: T.accent },
                  { lbl: 'Students', val: t.students, col: T.text },
                  { lbl: 'High Risk', val: t.highRisk, col: t.highRisk > 10 ? T.danger : T.warning },
                ].map((x, i) => (
                  <div key={i} style={{ background: T.surface2, borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: x.col }}>{x.val}</div>
                    <div style={{ ...mono, fontSize: 8, color: T.dim }}>{x.lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>Data:</div>
                <div style={{ flex: 1 }}><Bar val={t.completeness} color={t.completeness >= 80 ? T.success : t.completeness >= 60 ? T.warning : T.danger} h={4} /></div>
                <span style={{ ...mono, fontSize: 10, color: T.muted }}>{t.completeness}%</span>
                {t.pendingTasks > 0 && <Chip color={T.warning} size={9}>{t.pendingTasks} tasks</Chip>}
              </div>
            </Card>
          )
        })}
      </div>

      {selectedTeacher && (
        <Card glow={T.accent} style={{ animation: 'fadeUp 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>
              {selectedTeacher.name} — Detail View
            </div>
            <Btn size="sm" variant="ghost" onClick={() => setSelectedTeacherId(null)}>Close</Btn>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            {selectedTeacher.offerings.map(o => (
              <div key={`${o.code}-${o.section}`} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px', cursor: 'pointer' }} onClick={() => onOpenCourse(o)}>
                <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 4 }}>{o.code} - Sec {o.section}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>{o.title}</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                   <Chip color={o.tt1Locked ? T.success : T.warning} size={9}>TT1: {o.tt1Locked ? 'Locked' : 'Pending'}</Chip>
                   <Chip color={o.tt2Locked ? T.success : T.warning} size={9}>TT2: {o.tt2Locked ? 'Locked' : 'Pending'}</Chip>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...mono, fontSize: 10, color: T.danger }}>{getStudents(o).filter(s => s.riskBand === 'High').length} High Risk</span>
                  <span style={{ ...mono, fontSize: 10, color: T.text }}>{o.attendance}% Avg Att · Open →</span>
                </div>
              </div>
            ))}
            {selectedTeacher.offerings.length === 0 && (
              <div style={{ ...mono, fontSize: 11, color: T.muted }}>No course offerings mapped for this faculty yet.</div>
            )}
          </div>

          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 12 }}>Top Assigned Tasks (Overdue)</div>
          <div style={{ background: T.surface2, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Student', 'Course', 'Task', 'Due', 'Status', ''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {selectedTeacherTasks.map(task => (
                  <tr key={task.id}>
                    <TD><span style={{ ...sora, fontSize: 11, color: T.text }}>{task.studentName}</span> <span style={{ ...mono, fontSize: 10, color: T.accent }}>{task.studentUsn}</span></TD>
                    <TD style={{ ...mono, fontSize: 11 }}>{task.courseCode}</TD>
                    <TD style={{ ...mono, fontSize: 11 }}>{task.title}</TD>
                    <TD style={{ ...mono, fontSize: 11, color: task.due === 'Today' ? T.danger : T.warning }}>{task.due}</TD>
                    <TD><Chip color={task.status === 'New' ? T.danger : task.status === 'In Progress' ? T.warning : T.blue} size={9}>{task.status}</Chip></TD>
                    <TD><button aria-label={`View ${task.studentName} profile`} title="View profile" onClick={() => {
                      const off = OFFERINGS.find(o => o.offId === task.offeringId)
                      if (!off) return
                      const s = getStudents(off).find(st => st.id === task.studentId)
                      if (s) onOpenStudent(s, off)
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Eye size={13} /></button></TD>
                  </tr>
                ))}
                {selectedTeacherTasks.length === 0 && (
                  <tr>
                    <TD colSpan={6} style={{ ...mono, fontSize: 11, color: T.muted, textAlign: 'center' }}>No overdue tasks for mapped offerings.</TD>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}


    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CALENDAR PAGE
   ══════════════════════════════════════════════════════════════ */

function CalendarPage() {
  const tCol: Record<string, string> = { tt: T.accent, quiz: T.warning, asgn: T.success, att: T.pink, see: T.danger }
  const tLbl: Record<string, string> = { tt: 'Term Test', quiz: 'Quiz', asgn: 'Assignment', att: 'Attendance', see: 'Finals' }
  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, animation: 'fadeUp 0.35s ease' }}>
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>Academic Calendar</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 20 }}>Odd Semester 2025–26</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {CALENDAR_EVENTS.map((ev, i) => {
          const col = tCol[ev.type] || T.muted
          const yc = ev.year === 'All' ? T.muted : yearColor(ev.year)
          return (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 18px', background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${col}`, borderRadius: i === 0 ? '10px 10px 0 0' : i === CALENDAR_EVENTS.length - 1 ? '0 0 10px 10px' : '0' }}>
              <div style={{ ...mono, fontSize: 11, color: T.muted, minWidth: 52 }}>{ev.date}</div>
              <div style={{ flex: 1, ...sora, fontSize: 13, color: T.text }}>{ev.label}</div>
              <Chip color={col} size={9}>{tLbl[ev.type] || ev.type}</Chip>
              <Chip color={yc} size={9}>{ev.year}</Chip>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ENTRY_CATALOG: { kind: EntryKind; icon: string; title: string; desc: string; tabId: string }[] = [
  { kind: 'tt1', icon: '📝', title: 'TT1 Marks', desc: 'Question-wise marks entry and final submit/lock for TT1.', tabId: 'tt1' },
  { kind: 'tt2', icon: '📝', title: 'TT2 Marks', desc: 'Question-wise marks entry and final submit/lock for TT2.', tabId: 'tt2' },
  { kind: 'quiz', icon: '❓', title: 'Quiz Scores', desc: 'Enter quiz marks across all students in a consistent sheet.', tabId: 'quizzes' },
  { kind: 'assignment', icon: '📄', title: 'Assignment Scores', desc: 'Enter assignment evaluations and update CO evidence.', tabId: 'assignments' },
  { kind: 'attendance', icon: '📅', title: 'Attendance', desc: 'Weekly attendance capture and final attendance lock.', tabId: 'attendance' },
  { kind: 'finals', icon: '🎓', title: 'SEE / Finals', desc: 'Final exam marks and gradebook completion flow.', tabId: 'gradebook' },
]

const getEntryLockMap = (o: Offering) => ({
  tt1: !!o.tt1Locked,
  tt2: !!o.tt2Locked,
  quiz: !!o.quizLocked,
  assignment: !!o.asgnLocked,
  attendance: false,
  finals: false,
})

/* ══════════════════════════════════════════════════════════════
   UPLOAD PAGE
   ══════════════════════════════════════════════════════════════ */

function UploadPage({ role, offering, defaultKind, onOpenWorkspace, lockByOffering, availableOfferings }: { role: Role; offering: Offering | null; defaultKind: EntryKind; onOpenWorkspace: (offeringId: string, kind: EntryKind) => void; lockByOffering: Record<string, EntryLockMap>; availableOfferings?: Offering[] }) {
  const visibleOfferings = (availableOfferings && availableOfferings.length > 0 ? availableOfferings : OFFERINGS)
  const [selectedKind, setSelectedKind] = useState<EntryKind>(defaultKind)
  const [selectedOffId, setSelectedOffId] = useState<string>(offering?.offId ?? visibleOfferings[0].offId)
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(offering?.code ?? visibleOfferings[0].code)
  const [selectedClassOffId, setSelectedClassOffId] = useState<string>(offering?.offId ?? visibleOfferings[0].offId)
  const [unlockRequested, setUnlockRequested] = useState<EntryKind | null>(null)
  useEffect(() => setSelectedKind(defaultKind), [defaultKind])
  useEffect(() => {
    if (offering?.offId) setSelectedOffId(offering.offId)
  }, [offering])
  useEffect(() => {
    const selected = visibleOfferings.find(o => o.offId === selectedOffId) ?? visibleOfferings[0]
    if (!selected) return
    setSelectedCourseCode(selected.code)
    setSelectedClassOffId(selected.offId)
  }, [selectedOffId, visibleOfferings])

  const selected = ENTRY_CATALOG.find(x => x.kind === selectedKind) ?? ENTRY_CATALOG[0]
  const selectedOffering = visibleOfferings.find(o => o.offId === selectedOffId) ?? offering ?? visibleOfferings[0]
  const classOfferings = visibleOfferings.filter(o => o.code === selectedCourseCode)
  const lockMap = lockByOffering[selectedOffering.offId] ?? getEntryLockMap(selectedOffering)
  const stageRequired: Record<EntryKind, number> = { tt1: 1, tt2: 2, quiz: 2, assignment: 2, attendance: 1, finals: 3 }
  const isApplicableForStage = selectedOffering.stageInfo.stage >= stageRequired[selectedKind]

  const completion = useMemo(() => {
    if (!selectedOffering) return { tt1: false, tt2: false, quiz: false, assignment: false, attendance: true, finals: false }
    return {
      tt1: !!selectedOffering.tt1Locked,
      tt2: !!selectedOffering.tt2Locked,
      quiz: !!selectedOffering.quizLocked,
      assignment: !!selectedOffering.asgnLocked,
      attendance: selectedOffering.attendance >= 75,
      finals: selectedOffering.stageInfo.stage >= 3,
    }
  }, [selectedOffering])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, animation: 'fadeUp 0.35s ease' }}>
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>Data Entry Hub</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 6 }}>Single consistent entry route from dashboard. CSV import is disabled in v1.</div>
      <div style={{ ...mono, fontSize: 11, color: T.accent, marginBottom: 12 }}>{selectedOffering.code} · {selectedOffering.title} · {selectedOffering.year} · Stage {selectedOffering.stageInfo.stage}</div>
      {role === 'Course Leader' && lockMap[selectedKind] && (
        <Card style={{ marginBottom: 12, padding: '12px 14px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>This entry is locked. You cannot modify {selected.title}.</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn size="sm" variant="ghost" onClick={() => setUnlockRequested(selectedKind)}>Request unlock from HoD</Btn>
            {unlockRequested === selectedKind && <Chip color={T.success} size={9}>Request submitted</Chip>}
          </div>
        </Card>
      )}
      <div style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label htmlFor="entry-course-select" style={{ ...mono, fontSize: 10, color: T.muted, marginRight: 8 }}>Course:</label>
          <select id="entry-course-select" aria-label="Select course" title="Select course" value={selectedCourseCode} onChange={e => {
            const code = e.target.value
            setSelectedCourseCode(code)
            const firstClass = visibleOfferings.find(o => o.code === code)
            if (firstClass) setSelectedClassOffId(firstClass.offId)
          }} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px' }}>
            {Array.from(new Set(visibleOfferings.map(o => o.code))).map(code => {
              const first = visibleOfferings.find(o => o.code === code)
              return <option key={code} value={code}>{code} · {first?.title ?? 'Course'}</option>
            })}
          </select>
        </div>
        <div>
          <label htmlFor="entry-class-select" style={{ ...mono, fontSize: 10, color: T.muted, marginRight: 8 }}>Class:</label>
          <select id="entry-class-select" aria-label="Select class" title="Select class" value={selectedClassOffId} onChange={e => setSelectedClassOffId(e.target.value)} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px' }}>
            {classOfferings.map(o => <option key={o.offId} value={o.offId}>{o.year} · Sec {o.section} · {o.count} students</option>)}
          </select>
        </div>
        <Btn size="sm" onClick={() => setSelectedOffId(selectedClassOffId)}>Select Class</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {ENTRY_CATALOG.map((x) => (
          <Card key={x.kind} glow={selectedKind === x.kind ? T.accent : undefined} style={{ padding: '18px 20px', cursor: 'pointer', opacity: role === 'Course Leader' && lockMap[x.kind] ? 0.8 : 1 }} onClick={() => {
            setSelectedKind(x.kind)
            if (role === 'Course Leader' && lockMap[x.kind]) return
            onOpenWorkspace(selectedOffId, x.kind)
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{x.icon}</div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4 }}>{x.title}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>{x.desc}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip color={completion[x.kind] ? T.success : T.warning} size={10}>{completion[x.kind] ? 'Completed' : 'Pending Entry'}</Chip>
              {lockMap[x.kind] && <Chip color={T.danger} size={10}>Locked</Chip>}
            </div>
          </Card>
        ))}
      </div>
      {role === 'Mentor' && <div style={{ ...mono, fontSize: 11, color: T.warning, marginTop: 12 }}>Read-only role. Only Course Leaders and HoD can edit marks.</div>}
      {!isApplicableForStage && <div style={{ ...mono, fontSize: 11, color: T.warning, marginTop: 8 }}>Current selected type is not applicable at stage {selectedOffering.stageInfo.stage}.</div>}
    </div>
  )
}

function EntryWorkspacePage({ role, offeringId, kind, onBack, lockByOffering, draftBySection, onSaveDraft, onSubmitLock, cellValues, onCellValueChange, onOpenStudent }: { role: Role; offeringId: string; kind: EntryKind; onBack: () => void; lockByOffering: Record<string, EntryLockMap>; draftBySection: Record<string, number>; onSaveDraft: (offId: string, kind: EntryKind) => void; onSubmitLock: (offId: string, kind: EntryKind) => void; cellValues: Record<string, number>; onCellValueChange: (key: string, value: number | undefined) => void; onOpenStudent: (s: Student, o: Offering) => void }) {
  const [unlockRequested, setUnlockRequested] = useState(false)
  const selectedOffering = OFFERINGS.find(o => o.offId === offeringId) ?? OFFERINGS[0]
  const groupedSections = OFFERINGS.filter(o => o.code === selectedOffering.code && o.year === selectedOffering.year)
  const selected = ENTRY_CATALOG.find(x => x.kind === kind) ?? ENTRY_CATALOG[0]
  const lockMap = lockByOffering[selectedOffering.offId] ?? getEntryLockMap(selectedOffering)
  const isLockedForCourseLeader = role === 'Course Leader' && lockMap[kind]
  const canEdit = (role === 'Course Leader' || role === 'HoD') && !isLockedForCourseLeader
  const stageRequired: Record<EntryKind, number> = { tt1: 1, tt2: 2, quiz: 2, assignment: 2, attendance: 1, finals: 3 }
  const isApplicableForStage = selectedOffering.stageInfo.stage >= stageRequired[kind]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, animation: 'fadeUp 0.35s ease' }}>
      <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back to Data Entry Hub</button>
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>{selected.title} — Dedicated Entry</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 6 }}>{selectedOffering.code} · {selectedOffering.title} · {selectedOffering.year} · Stage {selectedOffering.stageInfo.stage}</div>
      {!canEdit && <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 10 }}>Read-only for this role. Only Course Leaders and HoD can edit marks.</div>}
      {isLockedForCourseLeader && (
        <Card style={{ marginBottom: 10, padding: '10px 12px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>This dataset is locked. You cannot edit it as Course Leader.</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn size="sm" variant="ghost" onClick={() => setUnlockRequested(true)}>Defer unlock request to HoD</Btn>
            {unlockRequested && <Chip color={T.success} size={9}>Request sent</Chip>}
          </div>
        </Card>
      )}
      {!isApplicableForStage && <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 10 }}>Not applicable at current stage ({selectedOffering.stageInfo.stage}).</div>}

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {groupedSections.map(sec => {
          const students = getStudents(sec)
          const paper = PAPER_MAP[sec.code] || PAPER_MAP.default
          const secLocks = lockByOffering[sec.offId] ?? getEntryLockMap(sec)
          const secLockedForCourseLeader = role === 'Course Leader' && secLocks[kind]
          const canEditSection = (role === 'Course Leader' || role === 'HoD') && !secLockedForCourseLeader && isApplicableForStage
          const draftKey = `${sec.offId}::${kind}`
          return (
            <Card key={sec.offId} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{sec.code} · Sec {sec.section}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{students.length} students</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Chip color={isApplicableForStage ? T.blue : T.dim} size={9}>{isApplicableForStage ? 'Stage Applicable' : 'Locked by Stage'}</Chip>
                  {draftBySection[draftKey] && <Chip color={T.success} size={9}>Draft saved</Chip>}
                  <Btn size="sm" onClick={() => onSaveDraft(sec.offId, kind)} variant="ghost">Save Draft</Btn>
                  <Btn size="sm" onClick={() => onSubmitLock(sec.offId, kind)}>{canEditSection ? 'Submit & Lock' : 'View Only'}</Btn>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>USN</TH><TH>Name</TH>
                      {(kind === 'tt1' || kind === 'tt2') && paper.map((q, i) => <TH key={q.id}>Q{i + 1}/{q.maxMarks}</TH>)}
                      {kind === 'quiz' && <TH>Quiz 1 /10</TH>}
                      {kind === 'assignment' && <TH>Asgn 1 /10</TH>}
                      {kind === 'attendance' && <TH>Present /45</TH>}
                      {kind === 'finals' && <TH>SEE /50</TH>}
                      <TH>Profile</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 25).map(s => (
                      <tr key={s.id}>
                        <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{s.usn}</TD>
                        <TD style={{ ...sora, fontSize: 11, color: T.text }}>{s.name}</TD>
                        {(kind === 'tt1' || kind === 'tt2') && paper.map(q => (
                          <TD key={q.id}>
                            <input aria-label={`${kind.toUpperCase()} marks for ${s.name}, ${q.id}`} title={`Enter ${kind.toUpperCase()} marks for ${s.name}, ${q.id}`} placeholder="0" type="number" inputMode="numeric" min={0} max={q.maxMarks} disabled={!canEditSection} value={cellValues[toCellKey(sec.offId, kind, s.id, q.id)] ?? ((kind === 'tt1' ? s.tt1Score : s.tt2Score) != null ? Math.round(((kind === 'tt1' ? s.tt1Score! : s.tt2Score!) / paper.length)) : '')} onKeyDown={shouldBlockNumericKey} onChange={(e) => onCellValueChange(toCellKey(sec.offId, kind, s.id, q.id), parseInputValue(e.target.value, 0, q.maxMarks))}
                              style={{ width: 52, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }} />
                          </TD>
                        ))}
                        {kind === 'quiz' && <TD><input aria-label={`Quiz 1 marks for ${s.name}`} title={`Enter Quiz 1 marks for ${s.name}`} placeholder="0" type="number" inputMode="numeric" min={0} max={10} disabled={!canEditSection} value={cellValues[toCellKey(sec.offId, kind, s.id, 'quiz1')] ?? (s.quiz1 ?? '')} onKeyDown={shouldBlockNumericKey} onChange={(e) => onCellValueChange(toCellKey(sec.offId, kind, s.id, 'quiz1'), parseInputValue(e.target.value, 0, 10))} style={{ width: 64, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }} /></TD>}
                        {kind === 'assignment' && <TD><input aria-label={`Assignment 1 marks for ${s.name}`} title={`Enter Assignment 1 marks for ${s.name}`} placeholder="0" type="number" inputMode="numeric" min={0} max={10} disabled={!canEditSection} value={cellValues[toCellKey(sec.offId, kind, s.id, 'asgn1')] ?? (s.asgn1 ?? '')} onKeyDown={shouldBlockNumericKey} onChange={(e) => onCellValueChange(toCellKey(sec.offId, kind, s.id, 'asgn1'), parseInputValue(e.target.value, 0, 10))} style={{ width: 64, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }} /></TD>}
                        {kind === 'attendance' && <TD><input aria-label={`Attendance present classes for ${s.name}`} title={`Enter attendance present count for ${s.name}`} placeholder="0" type="number" inputMode="numeric" min={0} max={45} disabled={!canEditSection} value={cellValues[toCellKey(sec.offId, kind, s.id, 'present')] ?? s.present} onKeyDown={shouldBlockNumericKey} onChange={(e) => onCellValueChange(toCellKey(sec.offId, kind, s.id, 'present'), parseInputValue(e.target.value, 0, 45))} style={{ width: 64, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }} /></TD>}
                        {kind === 'finals' && <TD><input aria-label={`SEE marks for ${s.name}`} title={`Enter SEE marks for ${s.name}`} type="number" inputMode="numeric" min={0} max={50} disabled={!canEditSection} value={cellValues[toCellKey(sec.offId, kind, s.id, 'see')] ?? ''} onKeyDown={shouldBlockNumericKey} onChange={(e) => onCellValueChange(toCellKey(sec.offId, kind, s.id, 'see'), parseInputValue(e.target.value, 0, 50))} placeholder="Enter" style={{ width: 64, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }} /></TD>}
                        <TD><button aria-label={`Open ${s.name} profile`} title="Open profile" onClick={() => onOpenStudent(s, sec)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Eye size={13} /></button></TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ROOT APP
   ══════════════════════════════════════════════════════════════ */

const CL_NAV = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'upload', icon: Upload, label: 'Data Entry Hub' },
]
const MENTOR_NAV = [
  { id: 'mentees', icon: Users, label: 'My Mentees' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
]
const HOD_NAV = [
  { id: 'department', icon: Shield, label: 'Department' },
  { id: 'upload', icon: Upload, label: 'Data Entry Hub' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
]

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('airmentor-theme') as ThemeMode) || 'light')
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(() => localStorage.getItem('airmentor-current-teacher-id'))
  const currentTeacher = useMemo(() => currentTeacherId ? (TEACHER_ACCOUNTS.find(t => t.teacherId === currentTeacherId) ?? null) : null, [currentTeacherId])
  const [role, setRole] = useState<Role>('Course Leader')
  const [page, setPage] = useState('dashboard')
  const [offering, setOffering] = useState<Offering | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showActionQueue, setShowActionQueue] = useState(true)
  const [uploadOffering, setUploadOffering] = useState<Offering | null>(null)
  const [uploadKind, setUploadKind] = useState<EntryKind>('tt1')
  const [entryOfferingId, setEntryOfferingId] = useState<string>(OFFERINGS[0].offId)
  const [entryKind, setEntryKind] = useState<EntryKind>('tt1')
  const [courseInitialTab, setCourseInitialTab] = useState<string | undefined>(undefined)

  const allowedRoles = currentTeacher?.permissions ?? []
  const assignedOfferings = useMemo(() => {
    if (!currentTeacher) return OFFERINGS
    if (currentTeacher.permissions.includes('HoD')) return OFFERINGS
    return OFFERINGS.filter(o => currentTeacher.courseCodes.includes(o.code))
  }, [currentTeacher])

  const [lockByOffering, setLockByOffering] = useState<Record<string, EntryLockMap>>(() => {
    try {
      const saved = localStorage.getItem('airmentor-locks')
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return Object.fromEntries(OFFERINGS.map(o => [o.offId, getEntryLockMap(o)])) as Record<string, EntryLockMap>
  })
  const [draftBySection, setDraftBySection] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('airmentor-drafts')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [cellValues, setCellValues] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('airmentor-cell-values')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [allTasksList, setAllTasksList] = useState<SharedTask[]>(() => {
    try {
      const saved = localStorage.getItem('airmentor-all-tasks')
      if (saved) {
        const parsed = JSON.parse(saved) as Array<SharedTask | (Task & { createdAt?: number })>
        return parsed.map(t => ({
          ...t,
          createdAt: 'createdAt' in t && typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
          assignedTo: 'assignedTo' in t && (t as SharedTask).assignedTo ? (t as SharedTask).assignedTo : 'Course Leader',
        }))
      }
    } catch {
      // ignore
    }
    const courseLeaderTasks: SharedTask[] = generateTasks().map(t => ({ ...t, createdAt: Date.now(), assignedTo: 'Course Leader' }))
    const mentorTasks: SharedTask[] = MENTEES
      .filter(m => m.avs >= 0.5)
      .slice(0, 8)
      .map((m, i) => ({
        id: `mentor-seed-${m.id}-${i}`,
        studentId: `mentee-${m.id}`,
        studentName: m.name,
        studentUsn: m.usn,
        offeringId: '',
        courseCode: m.courseRisks[0]?.code ?? 'GEN',
        courseName: m.courseRisks[0]?.title ?? 'Mentor Follow-up',
        year: m.year,
        riskProb: m.avs,
        riskBand: m.avs >= 0.7 ? 'High' : m.avs >= 0.35 ? 'Medium' : 'Low',
        title: `Mentor follow-up with ${m.name.split(' ')[0]}`,
        due: 'This week',
        status: m.interventions.length > 0 ? 'In Progress' : 'New',
        actionHint: 'Mentor intervention and counselling review',
        priority: Math.round(m.avs * 100),
        createdAt: Date.now(),
        assignedTo: 'Mentor',
      }))
    return [...courseLeaderTasks, ...mentorTasks]
  })
  const [resolvedTasks, setResolvedTasks] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('airmentor-resolved-tasks')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => { localStorage.setItem('airmentor-locks', JSON.stringify(lockByOffering)) }, [lockByOffering])
  useEffect(() => { localStorage.setItem('airmentor-drafts', JSON.stringify(draftBySection)) }, [draftBySection])
  useEffect(() => { localStorage.setItem('airmentor-cell-values', JSON.stringify(cellValues)) }, [cellValues])
  useEffect(() => { localStorage.setItem('airmentor-all-tasks', JSON.stringify(allTasksList)) }, [allTasksList])
  useEffect(() => { localStorage.setItem('airmentor-resolved-tasks', JSON.stringify(resolvedTasks)) }, [resolvedTasks])

  useEffect(() => {
    const cutoff = Date.now() - TWO_DAYS_MS
    const expiredResolved = Object.entries(resolvedTasks).filter(([, ts]) => ts < cutoff).map(([id]) => id)
    if (expiredResolved.length === 0) return
    setResolvedTasks(prev => {
      const next = { ...prev }
      expiredResolved.forEach(id => delete next[id])
      return next
    })
    setAllTasksList(prev => prev.filter(t => !expiredResolved.includes(t.id)))
  }, [resolvedTasks])

  const roleTasks = useMemo(() => allTasksList.filter(t => t.assignedTo === role), [allTasksList, role])
  const pendingActionCount = roleTasks.filter(t => !resolvedTasks[t.id]).length
  
  const navItems = role === 'Course Leader' ? CL_NAV : role === 'Mentor' ? MENTOR_NAV : HOD_NAV

  // IMMEDIATELY apply the theme *before* rendering any components so child elements pick up the correct T colors
  applyThemePreset(themeMode)

  useEffect(() => {
    localStorage.setItem('airmentor-theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    if (currentTeacherId) localStorage.setItem('airmentor-current-teacher-id', currentTeacherId)
    else localStorage.removeItem('airmentor-current-teacher-id')
  }, [currentTeacherId])

  useEffect(() => {
    if (!currentTeacher) return
    if (!currentTeacher.permissions.includes(role)) {
      const nextRole = currentTeacher.permissions[0]
      setRole(nextRole)
      setPage(nextRole === 'Course Leader' ? 'dashboard' : nextRole === 'Mentor' ? 'mentees' : 'department')
    }
  }, [currentTeacher, role])

  const handleOpenCourse = useCallback((o: Offering) => {
    setOffering(o)
    setCourseInitialTab(undefined)
    setPage('course')
  }, [])
  const handleBack = useCallback(() => {
    setOffering(null)
    setCourseInitialTab(undefined)
    setPage(role === 'HoD' ? 'department' : 'dashboard')
  }, [role])
  const handleOpenStudent = useCallback((s: Student, o?: Offering) => { setSelectedStudent(s); setSelectedOffering(o || null) }, [])
  const handleOpenEntryHub = useCallback((o: Offering, kind: EntryKind) => {
    setUploadOffering(o)
    setUploadKind(kind)
    setPage('upload')
  }, [])
  const handleOpenUpload = useCallback((o?: Offering, kind: EntryKind = 'tt1') => {
    if (o) setUploadOffering(o)
    else setUploadOffering(assignedOfferings[0] ?? OFFERINGS[0])
    setUploadKind(kind)
    setPage('upload')
  }, [assignedOfferings])
  const handleOpenWorkspace = useCallback((offeringId: string, kind: EntryKind) => {
    setEntryOfferingId(offeringId)
    setEntryKind(kind)
    setPage('entry-workspace')
  }, [])

  const handleRoleChange = useCallback((r: Role) => {
    if (!allowedRoles.includes(r)) return
    setRole(r)
    setPage(r === 'Course Leader' ? 'dashboard' : r === 'Mentor' ? 'mentees' : 'department')
    setOffering(null)
    setSelectedStudent(null)
    setCourseInitialTab(undefined)
  }, [allowedRoles])

  const handleSaveDraft = useCallback((offId: string, kind: EntryKind) => {
    setDraftBySection(prev => ({ ...prev, [`${offId}::${kind}`]: Date.now() }))
  }, [])

  const handleSubmitLock = useCallback((offId: string, kind: EntryKind) => {
    setLockByOffering(prev => ({
      ...prev,
      [offId]: { ...(prev[offId] ?? getEntryLockMap(OFFERINGS.find(o => o.offId === offId) ?? OFFERINGS[0])), [kind]: true },
    }))
  }, [])

  const handleCellValueChange = useCallback((key: string, value: number | undefined) => {
    setCellValues(prev => {
      const next = { ...prev }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next
    })
  }, [])

  const handleResolveTask = useCallback((id: string) => {
    setResolvedTasks(prev => ({ ...prev, [id]: Date.now() }))
  }, [])

  const handleUndoTask = useCallback((id: string) => {
    setResolvedTasks(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const upsertTaskFromStudent = useCallback((s: Student, o: Offering | undefined, mode: 'escalate' | 'remedial' | 'manual') => {
    const off = o ?? OFFERINGS.find(x => getStudents(x).some(st => st.id === s.id))
    const offId = off?.offId ?? ''
    const code = off?.code ?? 'GEN'
    const name = off?.title ?? 'General Follow-up'
    const riskProb = s.riskProb ?? 0.5
    const id = `${mode}-${s.id}-${offId || 'na'}`
    const title = mode === 'escalate'
      ? `Escalated: ${s.name.split(' ')[0]} requires HoD intervention`
      : mode === 'remedial'
        ? `Assign remedial plan to ${s.name.split(' ')[0]}`
        : `Manual follow-up for ${s.name.split(' ')[0]}`

    setAllTasksList(prev => {
      if (prev.some(t => t.id === id)) return prev
      const next: SharedTask = {
        id,
        studentId: s.id,
        studentName: s.name,
        studentUsn: s.usn,
        offeringId: offId,
        courseCode: code,
        courseName: name,
        year: off?.year ?? 'N/A',
        riskProb,
        riskBand: (s.riskBand ?? 'Medium') as RiskBand,
        title,
        due: mode === 'escalate' ? 'Today' : 'This week',
        status: 'New',
        actionHint: mode === 'escalate' ? 'Escalation raised and visible across all role queues' : 'User-generated action item',
        priority: Math.round(riskProb * 100),
        createdAt: Date.now(),
        assignedTo: mode === 'escalate' ? 'HoD' : role,
        escalated: mode === 'escalate',
        sourceRole: role,
        manual: mode !== 'escalate',
      }
      return [next, ...prev]
    })
  }, [role])

  if (!currentTeacher) {
    return <LoginPage onLogin={(teacherId) => {
      const account = TEACHER_ACCOUNTS.find(t => t.teacherId === teacherId)
      if (!account) return
      setCurrentTeacherId(account.teacherId)
      const firstRole = account.permissions[0]
      setRole(firstRole)
      setPage(firstRole === 'Course Leader' ? 'dashboard' : firstRole === 'Mentor' ? 'mentees' : 'department')
      setOffering(null)
      setSelectedStudent(null)
      setCourseInitialTab(undefined)
    }} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg, color: T.text }}>
      {/* ═══ TOP BAR ═══ */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', background: themeMode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(7,9,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 13, color: '#fff' }}>{currentTeacher.initials}</div>
          <div>
            <div style={{ ...sora, fontWeight: 800, fontSize: 14, color: T.text }}>AirMentor</div>
            <div style={{ ...mono, fontSize: 9, color: T.dim }}>AI Mentor Intelligence</div>
          </div>
        </div>

        {/* Role Switcher */}
        <div style={{ display: 'flex', gap: 0, marginLeft: 32, background: T.surface2, borderRadius: 8, padding: 2, border: `1px solid ${T.border}` }}>
          {allowedRoles.map(r => (
            <button key={r} onClick={() => handleRoleChange(r)}
              style={{ ...sora, fontWeight: 600, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: role === r ? T.accent : 'transparent', color: role === r ? '#fff' : T.muted, transition: 'all 0.15s' }}>
              {r}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button aria-label={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={themeMode === 'light' ? 'Dark mode' : 'Light mode'} onClick={() => setThemeMode(m => m === 'light' ? 'dark' : 'light')} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: T.muted }}>{themeMode === 'light' ? '🌙' : '☀️'}</button>
          <button aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed(c => !c)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: T.muted }}><Filter size={14} /></button>
          <button aria-label={showActionQueue ? 'Hide action queue' : 'Show action queue'} title={showActionQueue ? 'Hide action queue' : 'Show action queue'} onClick={() => setShowActionQueue(v => !v)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: T.muted, position: 'relative' }}>
            <Bell size={14} />
            {pendingActionCount > 0 && <div style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: T.danger, color: '#fff', ...mono, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{pendingActionCount}</div>}
          </button>
          <button aria-label="Logout" title="Logout" onClick={() => {
            setCurrentTeacherId(null)
            setRole('Course Leader')
            setPage('dashboard')
            setOffering(null)
            setSelectedStudent(null)
            setCourseInitialTab(undefined)
          }} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 10 }}>Logout</button>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 10, color: '#fff' }}>{currentTeacher.initials}</div>
        </div>
      </div>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Sidebar */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 210, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 54, height: 'calc(100vh - 54px)', flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', minWidth: 210 }}>
                {/* Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 10, color: '#fff', flexShrink: 0 }}>{PROFESSOR.initials}</div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTeacher.name}</div>
                    <div style={{ ...mono, fontSize: 9, color: T.dim }}>{role}</div>
                  </div>
                </div>

                {/* Nav */}
                <nav>
                  {navItems.map(item => {
                    const Icon = item.icon
                    const active = page === item.id || (page === 'course' && item.id === 'dashboard')
                    return (
                      <button key={item.id} onClick={() => { setPage(item.id); setOffering(null) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: active ? T.accent + '18' : 'transparent', color: active ? T.accentLight : T.muted, ...sora, fontWeight: 500, fontSize: 12, marginBottom: 2, transition: 'all 0.15s', textAlign: 'left' as const }}>
                        <Icon size={15} /> {item.label}
                      </button>
                    )
                  })}
                </nav>

                {/* Year Stages — Course Leader only */}
                {role === 'Course Leader' && (
                  <div style={{ padding: '12px 0', borderTop: `1px solid ${T.border}`, marginTop: 12 }}>
                    <div style={{ ...mono, fontSize: 8, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Year Stages</div>
                    {YEAR_GROUPS.map(g => (
                      <div key={g.year} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                        <span style={{ ...mono, fontSize: 9, color: T.muted, flex: 1 }}>{g.year}</span>
                        <span style={{ ...mono, fontSize: 8, color: g.stageInfo.color }}>{g.stageInfo.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Data completeness */}
                {role === 'Course Leader' && (
                  <div style={{ padding: '10px 0', borderTop: `1px solid ${T.border}` }}>
                    <div style={{ ...mono, fontSize: 8, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Data Completeness</div>
                    {[
                      { lbl: 'TT1 Marks', pct: 64 },
                      { lbl: 'Attendance', pct: 82 },
                      { lbl: 'Quizzes', pct: 36 },
                    ].map(d => (
                      <div key={d.lbl} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ ...mono, fontSize: 9, color: T.muted }}>{d.lbl}</span>
                          <span style={{ ...mono, fontSize: 9, color: d.pct >= 80 ? T.success : d.pct >= 50 ? T.warning : T.danger }}>{d.pct}%</span>
                        </div>
                        <Bar val={d.pct} color={d.pct >= 80 ? T.success : d.pct >= 50 ? T.warning : T.danger} h={3} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Content */}
        <div style={{ flex: 1, overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
          {role === 'Course Leader' && page === 'dashboard' && <CLDashboard onOpenCourse={handleOpenCourse} onOpenStudent={handleOpenStudent} onOpenUpload={handleOpenUpload} />}
          {role === 'Course Leader' && page === 'course' && offering && <CourseDetail offering={offering} onBack={handleBack} onOpenStudent={s => handleOpenStudent(s, offering)} onOpenEntryHub={(kind) => handleOpenEntryHub(offering, kind)} initialTab={courseInitialTab} />}
          {role === 'Course Leader' && page === 'calendar' && <CalendarPage />}
          {role === 'Course Leader' && page === 'upload' && <UploadPage role={role} offering={uploadOffering} defaultKind={uploadKind} onOpenWorkspace={handleOpenWorkspace} lockByOffering={lockByOffering} availableOfferings={assignedOfferings} />}
          {role === 'Course Leader' && page === 'entry-workspace' && <EntryWorkspacePage role={role} offeringId={entryOfferingId} kind={entryKind} onBack={() => setPage('upload')} lockByOffering={lockByOffering} draftBySection={draftBySection} onSaveDraft={handleSaveDraft} onSubmitLock={handleSubmitLock} cellValues={cellValues} onCellValueChange={handleCellValueChange} onOpenStudent={handleOpenStudent} />}

          {role === 'Mentor' && page === 'mentees' && <MentorView onOpenMentee={() => {}} />}
          {role === 'Mentor' && page === 'calendar' && <CalendarPage />}

          {role === 'HoD' && page === 'department' && <HodView onOpenUpload={handleOpenUpload} onOpenCourse={handleOpenCourse} onOpenStudent={handleOpenStudent} tasks={allTasksList} />}
          {role === 'HoD' && page === 'course' && offering && <CourseDetail offering={offering} onBack={handleBack} onOpenStudent={s => handleOpenStudent(s, offering)} onOpenEntryHub={(kind) => handleOpenEntryHub(offering, kind)} initialTab={courseInitialTab} />}
          {role === 'HoD' && page === 'upload' && <UploadPage role={role} offering={uploadOffering} defaultKind={uploadKind} onOpenWorkspace={handleOpenWorkspace} lockByOffering={lockByOffering} availableOfferings={assignedOfferings} />}
          {role === 'HoD' && page === 'entry-workspace' && <EntryWorkspacePage role={role} offeringId={entryOfferingId} kind={entryKind} onBack={() => setPage('upload')} lockByOffering={lockByOffering} draftBySection={draftBySection} onSaveDraft={handleSaveDraft} onSubmitLock={handleSubmitLock} cellValues={cellValues} onCellValueChange={handleCellValueChange} onOpenStudent={handleOpenStudent} />}
          {role === 'HoD' && page === 'calendar' && <CalendarPage />}
        </div>

        {/* Right Sidebar — Action Queue */}
        {showActionQueue && (
          <ActionQueue tasks={roleTasks} resolvedTaskIds={resolvedTasks} onResolveTask={handleResolveTask} onUndoTask={handleUndoTask} onOpenStudent={(id) => {
            for (const off of OFFERINGS) {
              const s = getStudents(off).find(st => st.id === id)
              if (s) {
                handleOpenStudent(s, off)
                return
              }
            }
          }} />
        )}
      </div>

      {/* ═══ STUDENT DRAWER ═══ */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDrawer student={selectedStudent} offering={selectedOffering || undefined} role={role} onClose={() => { setSelectedStudent(null); setSelectedOffering(null) }} onEscalate={(s, o) => upsertTaskFromStudent(s, o, 'escalate')} onAssignRemedial={(s, o) => upsertTaskFromStudent(s, o, 'remedial')} onAddManualTask={(s, o) => upsertTaskFromStudent(s, o, 'manual')} />
        )}
      </AnimatePresence>
    </div>
  )
}
