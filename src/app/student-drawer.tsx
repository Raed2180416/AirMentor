import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  Eye,
  GraduationCap,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  Target,
  TrendingDown,
  Users,
  X,
} from 'lucide-react'
import { CO_COLORS, T, mono, sora, type Offering, type Student, type StudentHistoryRecord } from '../data'
import { toTodayISO, type AcademicMeeting, type Role, type TaskType } from '../domain'
import { minutesToDisplayLabel } from '../calendar-utils'
import { useAppSelectors } from '../selectors'
import { Bar, Btn, Chip, UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from '../ui-primitives'
import { type StudentCheckpointCoreMetrics } from '../student-checkpoint-parity'
import {
  buildHistoryProfile,
  getStudentAttendancePct,
  getVisibleCeTargetForStage,
  hasStudentRiskEvidence,
  isPostSeeEvidenceStage,
  parseTimeToMinutes,
} from './workspace-helpers'

/* ══════════════════════════════════════════════════════════════
   STUDENT DRAWER — OBSERVABLE WATCH, CO, INTERVENTIONS
   ══════════════════════════════════════════════════════════════ */

export function StudentDrawer({
  student,
  offering,
  historyByUsn,
  role,
  meetings,
  onClose,
  onEscalate,
  onOpenTaskComposer,
  onAssignToMentor,
  onOpenHistory,
  onOpenStudentShell,
  onOpenRiskExplorer,
  onScheduleMeeting,
  proofStageKey,
  coreMetricsOverride,
}: {
  student: Student | null
  offering?: Offering
  historyByUsn?: Record<string, StudentHistoryRecord> | null
  role: Role
  meetings: AcademicMeeting[]
  onClose: () => void
  onEscalate: (s: Student, o?: Offering) => void
  onOpenTaskComposer: (s: Student, o?: Offering, taskType?: TaskType) => void
  onAssignToMentor: (s: Student, o?: Offering) => void
  onOpenHistory: (s: Student, o?: Offering) => void
  onOpenStudentShell: (studentId: string) => void
  onOpenRiskExplorer: (studentId: string) => void
  onScheduleMeeting: (input: { student: Student; offering?: Offering; title: string; notes?: string; dateISO: string; startMinutes: number; endMinutes: number }) => Promise<void> | void
  proofStageKey?: string | null
  coreMetricsOverride?: StudentCheckpointCoreMetrics | null
}) {
  const { deriveAcademicProjection, getSchemeForOffering } = useAppSelectors()
  const studentSeedName = student?.name.split(' ')[0] ?? 'Student'
  const normalizedStudentId = student?.id.split('::').at(-1) ?? ''
  const [meetingTitle, setMeetingTitle] = useState(() => `Student meeting · ${studentSeedName}`)
  const [meetingDateISO, setMeetingDateISO] = useState(() => toTodayISO())
  const [meetingStart, setMeetingStart] = useState('15:30')
  const [meetingEnd, setMeetingEnd] = useState('16:00')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [showMeetingComposer, setShowMeetingComposer] = useState(false)
  const studentMeetings = useMemo(
    () => meetings
      .filter(meeting => meeting.studentUsn === student?.usn || meeting.studentId === normalizedStudentId)
      .sort((left, right) => `${right.dateISO}-${right.startMinutes}`.localeCompare(`${left.dateISO}-${left.startMinutes}`)),
    [meetings, normalizedStudentId, student?.usn],
  )
  if (!student) return null
  const s = student
  const effectiveRiskBand = coreMetricsOverride?.riskBand ?? s.riskBand
  const effectiveRiskProbScaled = coreMetricsOverride?.riskProbScaled ?? (s.riskProb !== null ? Math.round(s.riskProb * 100) : null)
  const attPct = coreMetricsOverride?.evidence.attendancePct ?? getStudentAttendancePct(s)
  const riskAvailable = hasStudentRiskEvidence(offering, s, proofStageKey)
  const riskCol = effectiveRiskBand === 'High' ? T.danger : effectiveRiskBand === 'Medium' ? T.warning : T.success
  const canSeeDetailedMarks = role !== 'Mentor'
  const drawerHistory = buildHistoryProfile({ student: s, historyByUsn })
  const activeScheme = offering ? getSchemeForOffering(offering) : null
  const ceSummary = offering && activeScheme ? deriveAcademicProjection({ offering, student: s, scheme: activeScheme, history: drawerHistory, stageKey: proofStageKey }) : null
  const visibleCeTarget = activeScheme ? getVisibleCeTargetForStage(activeScheme, offering, proofStageKey) : 0
  const ceSignalRatio = ceSummary && visibleCeTarget > 0 ? ceSummary.ce60 / visibleCeTarget : null
  const ceSignalValue = ceSummary && visibleCeTarget > 0 ? `${ceSummary.ce60.toFixed(1)}/${visibleCeTarget}` : 'Not applicable yet'
  const ceSignalColor = ceSignalRatio === null
    ? T.dim
    : ceSignalRatio >= 0.75
      ? T.success
      : ceSignalRatio >= 0.6
        ? T.warning
        : T.danger
  const postSeeEvidenceStage = isPostSeeEvidenceStage(offering, proofStageKey)
  const riskStageLabel = postSeeEvidenceStage ? 'Post-SEE Status' : 'SEE Readiness'
  const riskStageValue = riskAvailable
    ? postSeeEvidenceStage
      ? (effectiveRiskBand === 'High' ? 'Needs follow-up' : effectiveRiskBand === 'Medium' ? 'Review outcome' : 'On track')
      : (effectiveRiskBand === 'High' ? 'Needs support' : effectiveRiskBand === 'Medium' ? 'Watch' : 'On track')
    : 'Not applicable yet'
  const predictedCgpaColor = ceSummary?.predictedCgpa != null
    ? (ceSummary.predictedCgpa >= 7 ? T.success : ceSummary.predictedCgpa >= 6 ? T.warning : T.danger)
    : T.dim

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
    >
      <motion.div
        initial={{ x: 360, opacity: 0.98 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 360, opacity: 0.98 }}
        transition={UI_TRANSITION_MEDIUM}
        onClick={e => e.stopPropagation()}
        className="scroll-pane scroll-pane--dense"
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

        {/* Watch Gauge */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            {riskAvailable && effectiveRiskProbScaled !== null ? (
              <div style={{ background: `${riskCol}0c`, border: `1px solid ${riskCol}30`, borderRadius: 12, padding: '18px 22px', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ ...sora, fontWeight: 800, fontSize: 42, color: riskCol }}>{effectiveRiskProbScaled}%</div>
                  <div>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: riskCol }}>Academic Watch Score — {effectiveRiskBand}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>Observable-only score from attendance, term tests, transcript history, and course outcomes.</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {s.flags.backlog && <Chip color={T.danger} size={9}>Backlog history</Chip>}
                      {s.flags.lowAttendance && <Chip color={T.warning} size={9}>Low attendance</Chip>}
                      {s.flags.declining && <Chip color={T.warning} size={9}>Declining trend</Chip>}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}><Bar val={effectiveRiskProbScaled} color={riskCol} h={8} /></div>
              </div>
            ) : (
              <div style={{ background: T.surface2, borderRadius: 12, padding: '18px 22px', marginBottom: 18, textAlign: 'center' }}>
                <div style={{ ...mono, fontSize: 12, color: T.muted }}>Watch score unavailable because the current evidence window is incomplete.</div>
                <div style={{ ...mono, fontSize: 11, color: T.dim, marginTop: 4 }}>Showing attendance and transcript context only.</div>
              </div>
            )}
        </div>

        {/* Observable Drivers */}
        {riskAvailable && s.reasons.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={14} color={T.danger} /> Observable Drivers
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

        {/* Academic Snapshot */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} color={T.accent} /> Academic Snapshot
          </div>
          {!canSeeDetailedMarks && (
            <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 8 }}>Mentor view shows summary academics only. Raw entry fields remain restricted.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { lbl: 'Attendance', val: attPct == null ? 'Not applicable yet' : `${attPct}%`, col: attPct == null ? T.dim : attPct >= 75 ? T.success : attPct >= 65 ? T.warning : T.danger },
              { lbl: 'TT Summary', val: canSeeDetailedMarks ? `${s.tt1Score ?? '—'}/${s.tt1Max ?? 25} / ${s.tt2Score ?? '—'}/${s.tt2Max ?? 25}` : ceSummary ? `${(ceSummary.tt1Scaled + ceSummary.tt2Scaled).toFixed(1)}/30` : '—', col: ceSummary && ceSummary.tt1Scaled + ceSummary.tt2Scaled >= 15 ? T.success : T.warning },
              { lbl: 'CE Signal', val: ceSignalValue, col: ceSignalColor },
              { lbl: 'Primary Signal', val: riskAvailable ? (s.reasons[0]?.feature?.toUpperCase() ?? 'None') : 'Not applicable yet', col: riskAvailable && s.reasons[0] ? T.warning : riskAvailable ? T.success : T.dim },
              { lbl: riskStageLabel, val: riskStageValue, col: riskAvailable ? (effectiveRiskBand === 'High' ? T.danger : effectiveRiskBand === 'Medium' ? T.warning : T.success) : T.dim },
              { lbl: 'Pred CGPA', val: ceSummary?.predictedCgpa != null ? ceSummary.predictedCgpa.toFixed(2) : '—', col: predictedCgpaColor },
            ].map((x, i) => (
              <div key={i} style={{ background: T.surface2, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: x.col }}>{x.val}</div>
                <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {drawerHistory?.electiveRecommendation ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <GraduationCap size={14} color={T.accent} /> Semester 6 Elective Fit
            </div>
            <div style={{ background: T.surface2, borderRadius: 10, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
              <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{drawerHistory.electiveRecommendation.recommendedTitle}</div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 4 }}>{drawerHistory.electiveRecommendation.recommendedCode} · {drawerHistory.electiveRecommendation.stream}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.7 }}>{drawerHistory.electiveRecommendation.rationale || 'Recommended from the current proof-batch elective basket using accumulated readiness signals.'}</div>
              {drawerHistory.electiveRecommendation.alternatives.length > 0 ? (
                <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 8 }}>
                  Alternates: {drawerHistory.electiveRecommendation.alternatives.map(option => `${option.title} (${option.code})`).join(' · ')}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

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

        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} color={T.accent} /> Meetings
          </div>
          {studentMeetings.length > 0 ? studentMeetings.map(meeting => (
            <div key={meeting.meetingId} style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{meeting.title}</div>
                <Chip color={meeting.status === 'completed' ? T.success : meeting.status === 'cancelled' ? T.danger : T.accent} size={9}>{meeting.status}</Chip>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                {meeting.dateISO} · {minutesToDisplayLabel(meeting.startMinutes)} - {minutesToDisplayLabel(meeting.endMinutes)}
                {meeting.courseCode ? ` · ${meeting.courseCode}` : ''}
              </div>
              {meeting.notes ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>{meeting.notes}</div> : null}
            </div>
          )) : (
            <div style={{ ...mono, fontSize: 11, color: T.dim, padding: '12px 0' }}>No meetings scheduled yet</div>
          )}

          {showMeetingComposer && (
            <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, display: 'grid', gap: 10 }}>
              <input aria-label="Meeting title" value={meetingTitle} onChange={event => setMeetingTitle(event.target.value)} placeholder="Meeting title" style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input aria-label="Meeting date" type="date" value={meetingDateISO} onChange={event => setMeetingDateISO(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
                <input aria-label="Meeting start time" type="time" value={meetingStart} onChange={event => setMeetingStart(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
                <input aria-label="Meeting end time" type="time" value={meetingEnd} onChange={event => setMeetingEnd(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
              </div>
              <textarea aria-label="Meeting notes" value={meetingNotes} onChange={event => setMeetingNotes(event.target.value)} rows={3} placeholder="Add context, agenda, or follow-up notes" style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px', resize: 'vertical' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn size="sm" variant="ghost" onClick={() => setShowMeetingComposer(false)}>Cancel</Btn>
                <Btn size="sm" onClick={() => {
                  void onScheduleMeeting({
                    student: s,
                    offering,
                    title: meetingTitle.trim() || `Student meeting · ${s.name.split(' ')[0]}`,
                    notes: meetingNotes.trim(),
                    dateISO: meetingDateISO,
                    startMinutes: parseTimeToMinutes(meetingStart, 15 * 60),
                    endMinutes: parseTimeToMinutes(meetingEnd, (15 * 60) + 30),
                  })
                  setShowMeetingComposer(false)
                  setMeetingNotes('')
                }}>Schedule Meeting</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" onClick={() => navigator.clipboard.writeText(s.phone)}><Phone size={12} /> Call</Btn>
          <Btn size="sm" variant="ghost"><Mail size={12} /> Email</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onOpenTaskComposer(s, offering, riskAvailable && effectiveRiskBand === 'High' ? 'Remedial' : 'Follow-up')}><MessageSquare size={12} /> Add Task</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setShowMeetingComposer(current => !current)}><Calendar size={12} /> {showMeetingComposer ? 'Hide Meeting Form' : 'Schedule Meeting'}</Btn>
          {(role === 'Course Leader' || role === 'HoD') && <Btn size="sm" variant="ghost" onClick={() => onAssignToMentor(s, offering)}><Users size={12} /> Defer to Mentor</Btn>}
          <Btn size="sm" variant="ghost" onClick={() => onOpenHistory(s, offering)}><Eye size={12} /> Open Full Profile</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onOpenStudentShell(normalizedStudentId)}><Shield size={12} /> Student Shell</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onOpenRiskExplorer(normalizedStudentId)}><Activity size={12} /> Risk Explorer</Btn>
          {role !== 'HoD' && <Btn size="sm" variant="danger" onClick={() => onEscalate(s, offering)}><AlertTriangle size={12} /> Escalate to HoD</Btn>}
        </div>
      </motion.div>
    </motion.div>
  )
}
