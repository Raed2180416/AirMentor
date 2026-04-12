import { useMemo, useState } from 'react'
import { AlertTriangle, Eye, Mail, Phone, Search, Users, X } from 'lucide-react'
import { T, mono, sora, yearColor, type Mentee, type Offering, type Student, type StudentHistoryRecord, type YearGroup } from './data'
import { type EntryKind, type Role, type SharedTask } from './domain'
import type { ApiAcademicFacultyProfile } from './api/types'
import { AcademicProofSummaryStrip } from './academic-proof-summary-strip'
import { useAppSelectors } from './selectors'
import { inferKindFromPendingAction } from './page-utils'
import { Bar, Btn, Card, Chip, PageBackButton, PageShell, StagePips } from './ui-primitives'

function formatDateTime(timestamp?: number) {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function normalizeStudentProjectionId(studentId: string) {
  return studentId.includes('::') ? (studentId.split('::').at(-1) ?? studentId) : studentId
}

type DashboardAlertItem = {
  studentId: string
  student: Student | null
  offering: Offering | null
  studentName: string
  phone: string
  riskProbScaled: number
  reasonLabel: string | null
  courseCode: string | null
  yearLabel: string | null
  sectionCode: string | null
}

type CLDashboardProps = {
  offerings: Offering[]
  pendingTaskCount: number
  proofProfile?: ApiAcademicFacultyProfile | null
  onOpenCourse: (offering: Offering) => void
  onOpenStudent: (student: Student, offering: Offering) => void
  onOpenUpload: (offering?: Offering, kind?: EntryKind) => void
  onOpenCalendar: () => void
  onOpenPendingActions: () => void
  teacherInitials: string
  greetingHeadline: string
  greetingMeta: string
  greetingSubline: string
}

export function CLDashboard({
  offerings,
  pendingTaskCount,
  proofProfile,
  onOpenCourse,
  onOpenStudent,
  onOpenUpload,
  onOpenCalendar,
  onOpenPendingActions,
  teacherInitials,
  greetingHeadline,
  greetingMeta,
  greetingSubline,
}: CLDashboardProps) {
  const { getStudentsPatched } = useAppSelectors()
  const proofCheckpoint = proofProfile?.proofOperations?.scopeMode === 'proof'
    ? proofProfile.proofOperations.selectedCheckpoint
    : null
  const proofScopedStudentCount = proofCheckpoint?.studentCount ?? null
  const total = proofScopedStudentCount ?? offerings.reduce((count, offering) => count + getStudentsPatched(offering).length, 0)
  const proofAlertItems = useMemo<DashboardAlertItem[]>(() => {
    if (proofProfile?.proofOperations?.scopeMode !== 'proof') return []
    const queueItems = proofProfile.proofOperations.monitoringQueue.filter(item => item.riskBand === 'High')
    if (queueItems.length === 0) return []
    const itemsByStudentId = new Map<string, DashboardAlertItem>()
    for (const item of queueItems) {
      const offering = offerings.find(candidate => candidate.offId === item.offeringId)
        ?? offerings.find(candidate => candidate.code === item.courseCode && (item.sectionCode == null || candidate.section === item.sectionCode))
        ?? null
      const student = offering
        ? getStudentsPatched(offering).find(candidate => normalizeStudentProjectionId(candidate.id) === item.studentId || candidate.usn === item.usn) ?? null
        : null
      const nextItem: DashboardAlertItem = {
        studentId: item.studentId,
        student,
        offering,
        studentName: item.studentName,
        phone: student?.phone ?? '',
        riskProbScaled: item.riskProbScaled,
        reasonLabel: item.drivers[0]?.label ?? item.recommendedAction ?? null,
        courseCode: item.courseCode,
        yearLabel: offering?.year ?? null,
        sectionCode: item.sectionCode ?? offering?.section ?? null,
      }
      const current = itemsByStudentId.get(item.studentId)
      if (!current || nextItem.riskProbScaled > current.riskProbScaled) {
        itemsByStudentId.set(item.studentId, nextItem)
      }
    }
    return Array.from(itemsByStudentId.values()).sort((left, right) => right.riskProbScaled - left.riskProbScaled || left.studentName.localeCompare(right.studentName))
  }, [getStudentsPatched, offerings, proofProfile])
  const fallbackAlertItems = useMemo<DashboardAlertItem[]>(() => {
    const itemsByStudentId = new Map<string, DashboardAlertItem>()
    for (const offering of offerings) {
      for (const student of getStudentsPatched(offering)) {
        if (student.riskBand !== 'High') continue
        const studentId = normalizeStudentProjectionId(student.id)
        const nextItem: DashboardAlertItem = {
          studentId,
          student,
          offering,
          studentName: student.name,
          phone: student.phone,
          riskProbScaled: Math.round((student.riskProb ?? 0) * 100),
          reasonLabel: student.reasons[0]?.label ?? null,
          courseCode: offering.code,
          yearLabel: offering.year,
          sectionCode: offering.section,
        }
        const current = itemsByStudentId.get(studentId)
        if (!current || nextItem.riskProbScaled > current.riskProbScaled) {
          itemsByStudentId.set(studentId, nextItem)
        }
      }
    }
    return Array.from(itemsByStudentId.values()).sort((left, right) => right.riskProbScaled - left.riskProbScaled || left.studentName.localeCompare(right.studentName))
  }, [getStudentsPatched, offerings])
  const highRiskAlertItems = proofAlertItems.length > 0 ? proofAlertItems : fallbackAlertItems
  const highRiskCount = highRiskAlertItems.length
  const yearGroups = useMemo(() => {
    return Array.from(new Set(offerings.map(offering => offering.year))).map(year => {
      const sample = offerings.find(offering => offering.year === year) ?? offerings[0]
      return { year, color: yearColor(year), stageInfo: sample.stageInfo, offerings: offerings.filter(offering => offering.year === year) }
    })
  }, [offerings])

  return (
    <PageShell size="wide">
      <AcademicProofSummaryStrip profile={proofProfile ?? null} surfaceId="course-leader-dashboard" surfaceLabel="Course Leader Dashboard" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 18, color: '#fff' }}>{teacherInitials}</div>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 18, color: T.text }}>{greetingHeadline}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{greetingSubline}</div>
          <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 3 }}>{greetingMeta}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Btn size="sm" onClick={onOpenCalendar}>Open Calendar / Timetable</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '👥', label: 'Total Students', val: total, color: T.success },
          { icon: '‼️', label: 'High Watch Students', val: highRiskCount, color: T.danger },
          { icon: '🎯', label: 'Pending Actions', val: pendingTaskCount, color: T.warning, action: onOpenPendingActions },
        ].map((stat, index) => (
          <Card key={index} glow={stat.color} style={{ padding: '14px 18px', cursor: stat.action ? 'pointer' : 'default' }} onClick={stat.action}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{stat.icon}</span>
              <div>
                <div style={{ ...sora, fontWeight: 800, fontSize: 24, color: stat.color }}>{stat.val}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{stat.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {highRiskCount > 0 && (
        <Card glow={T.danger} style={{ padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} color={T.danger} />
            <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.danger }}>Priority Alerts</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>
              — {highRiskCount} students are above the alert threshold on the {proofAlertItems.length > 0 ? 'selected proof checkpoint' : 'current evidence window'}
            </div>
          </div>
          <div className="scroll-pane scroll-pane--dense" style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {highRiskAlertItems.map(item => {
                return (
                  <div
                    key={`${item.studentId}:${item.courseCode ?? 'course'}`}
                    onClick={() => item.student && item.offering && onOpenStudent(item.student, item.offering)}
                    style={{ background: T.surface2, border: `1px solid ${T.danger}25`, borderRadius: 8, padding: '10px 14px', cursor: item.student && item.offering ? 'pointer' : 'default', transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease' }}
                    onMouseEnter={event => (event.currentTarget.style.borderColor = `${T.danger}60`)}
                    onMouseLeave={event => (event.currentTarget.style.borderColor = `${T.danger}25`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>{item.studentName}</div>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 16, color: T.danger }}>{item.riskProbScaled}%</div>
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>{item.courseCode ?? 'Course'} · {item.yearLabel ?? ''} · Sec {item.sectionCode ?? ''}</div>
                    {item.reasonLabel ? <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>↳ {item.reasonLabel}</div> : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <button
                        aria-label="Copy student phone number"
                        title="Copy phone"
                        onClick={event => {
                          event.stopPropagation()
                          void navigator.clipboard.writeText(item.phone)
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, padding: 0 }}
                      >
                        <Phone size={11} />
                      </button>
                      <span style={{ ...mono, fontSize: 9, color: T.accent }}>Contact →</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {yearGroups.map(group => <YearSection key={group.year} group={group} onOpenCourse={onOpenCourse} onOpenUpload={onOpenUpload} />)}
    </PageShell>
  )
}

function YearSection({
  group,
  onOpenCourse,
  onOpenUpload,
}: {
  group: YearGroup
  onOpenCourse: (offering: Offering) => void
  onOpenUpload: (offering?: Offering, kind?: EntryKind) => void
}) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  const { year, color, stageInfo, offerings } = group
  const [collapsed, setCollapsed] = useState(false)
  const totalStudents = offerings.reduce((count, offering) => count + getStudentsPatched(offering).length, 0)
  const avgAtt = Math.round(offerings.reduce((count, offering) => count + getOfferingAttendancePatched(offering), 0) / (offerings.length || 1))
  const highRiskCount = offerings.filter(offering => offering.stage >= 2).reduce((count, offering) => count + getStudentsPatched(offering).filter(student => student.riskBand === 'High').length, 0)
  const pendingCount = offerings.filter(offering => offering.pendingAction).length

  return (
    <div style={{ marginBottom: 22 }}>
      <div data-pressable="true" onClick={() => setCollapsed(current => !current)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: `${color}0c`, border: `1px solid ${color}28`, borderRadius: collapsed ? 10 : '10px 10px 0 0', marginBottom: collapsed ? 0 : 12, cursor: 'pointer', transition: 'background-color 0.2s ease, border-color 0.2s ease, border-radius 0.2s ease, margin-bottom 0.2s ease', flexWrap: 'wrap' }}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 13, color, background: `${color}18`, border: `1px solid ${color}40`, padding: '3px 12px', borderRadius: 6 }}>{year}</div>
        <Chip color={stageInfo.color}>{stageInfo.label} · {stageInfo.desc}</Chip>
        <StagePips current={stageInfo.stage} />
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{offerings.length} class{offerings.length > 1 ? 'es' : ''} · {totalStudents} students · {avgAtt}% att</div>
        {highRiskCount > 0 ? <Chip color={T.danger} size={9}>🔴 {highRiskCount} high risk</Chip> : null}
        {pendingCount > 0 ? <Chip color={T.warning} size={9}>⚡ {pendingCount} data flags</Chip> : null}
        <div style={{ ...mono, fontSize: 12, color: T.dim, marginLeft: 'auto' }}>{collapsed ? '▸' : '▾'}</div>
      </div>
      {!collapsed ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {offerings.map(offering => <OfferingCard key={offering.offId} offering={offering} yearColorTone={color} onOpen={onOpenCourse} onOpenUpload={onOpenUpload} />)}
        </div>
      ) : null}
    </div>
  )
}

function OfferingCard({
  offering,
  yearColorTone,
  onOpen,
  onOpenUpload,
}: {
  offering: Offering
  yearColorTone: string
  onOpen: (offering: Offering) => void
  onOpenUpload: (offering?: Offering, kind?: EntryKind) => void
}) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  const stageColor = offering.stageInfo.color
  const avgAtt = getOfferingAttendancePatched(offering)
  const attendanceColor = avgAtt >= 75 ? T.success : avgAtt >= 65 ? T.warning : T.danger
  const studentCount = getStudentsPatched(offering).length
  const checks = [offering.tt1Done, offering.tt2Done, avgAtt >= 75]
  const highRisk = offering.stage >= 2 ? getStudentsPatched(offering).filter(student => student.riskBand === 'High').length : 0

  return (
    <Card onClick={() => onOpen(offering)} glow={yearColorTone} style={{ position: 'relative', overflow: 'hidden', padding: '16px 18px', borderRadius: 12 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${yearColorTone},${stageColor})` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ ...mono, fontSize: 10, color: yearColorTone, marginBottom: 2 }}>{offering.code} · {offering.dept} · Sec {offering.section}</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, lineHeight: 1.25 }}>{offering.title}</div>
        </div>
        <Chip color={stageColor} size={10}>{offering.stageInfo.label}</Chip>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip color={T.dim} size={9}>{studentCount} students</Chip>
        <Chip color={attendanceColor} size={9}>{avgAtt}% att</Chip>
        {highRisk > 0 ? <Chip color={T.danger} size={9}>🔴 {highRisk} at risk</Chip> : null}
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8 }}>
        {['TT1', 'TT2', 'Att'].map((label, index) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: checks[index] ? T.success : T.border2, border: `1.5px solid ${checks[index] ? T.success : T.dim}` }} />
            <span style={{ ...mono, fontSize: 9, color: T.dim }}>{label}</span>
          </div>
        ))}
        <StagePips current={offering.stageInfo.stage} />
      </div>
      {offering.pendingAction ? (
        <div style={{ background: '#f59e0b0c', border: '1px solid #f59e0b25', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>⚡</span>
          <span style={{ ...mono, fontSize: 10, color: T.warning }}>{offering.pendingAction}</span>
          <button
            onClick={event => {
              event.stopPropagation()
              onOpenUpload(offering, inferKindFromPendingAction(offering.pendingAction))
            }}
            style={{ ...mono, fontSize: 9, color: T.accent, marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Open in Hub →
          </button>
        </div>
      ) : (
        <div style={{ background: '#10b9810c', border: '1px solid #10b98125', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>✓</span>
          <span style={{ ...mono, fontSize: 10, color: T.success }}>All caught up</span>
        </div>
      )}
    </Card>
  )
}

type MentorViewProps = {
  mentees: Mentee[]
  tasks: SharedTask[]
  proofProfile?: ApiAcademicFacultyProfile | null
  onOpenMentee: (mentee: Mentee) => void
  onOpenStudentShell?: (studentId: string) => void
  onOpenRiskExplorer?: (studentId: string) => void
}

export function MentorView({
  mentees,
  tasks,
  proofProfile,
  onOpenMentee,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: MentorViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const sorted = [...mentees].sort((left, right) => right.avs - left.avs)
  const highRisk = mentees.filter(mentee => mentee.avs >= 0.6).length
  const medRisk = mentees.filter(mentee => mentee.avs >= 0.35 && mentee.avs < 0.6).length
  const lowRisk = mentees.filter(mentee => mentee.avs >= 0 && mentee.avs < 0.35).length
  const filteredMentees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sorted.filter(mentee => {
      const byRisk =
        activeFilter === 'all'
          ? true
          : activeFilter === 'high'
            ? mentee.avs >= 0.6
            : activeFilter === 'medium'
              ? mentee.avs >= 0.35 && mentee.avs < 0.6
              : mentee.avs >= 0 && mentee.avs < 0.35
      if (!byRisk) return false
      if (!query) return true
      const matchesText = [
        mentee.name,
        mentee.usn,
        mentee.dept,
        mentee.year,
        mentee.section,
        ...mentee.courseRisks.map(risk => `${risk.code} ${risk.title}`),
      ].join(' ').toLowerCase()
      return matchesText.includes(query)
    })
  }, [activeFilter, searchQuery, sorted])
  const pendingMentorActions = useMemo(() => {
    const menteeByUsn = new Map(mentees.map(mentee => [mentee.usn, mentee]))
    return tasks
      .filter(task =>
        task.assignedTo === 'Mentor'
        && !task.dismissal
        && task.status !== 'Resolved'
        && menteeByUsn.has(task.studentUsn),
      )
      .sort((left, right) => {
        if (left.priority !== right.priority) return right.priority - left.priority
        const leftDue = left.dueDateISO ?? '9999-12-31'
        const rightDue = right.dueDateISO ?? '9999-12-31'
        return leftDue.localeCompare(rightDue)
      })
      .slice(0, 6)
  }, [mentees, tasks])

  return (
    <PageShell size="standard">
      <AcademicProofSummaryStrip profile={proofProfile ?? null} surfaceId="mentor-view" surfaceLabel="Mentor View" />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={22} color={T.accent} />
          <div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>My Mentees</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Student-centric view · Cross-course watchlist summary from current observable evidence</div>
          </div>
        </div>
        <div style={{ minWidth: 220, flex: '1 1 280px', maxWidth: 360, position: 'relative' }}>
          <Search size={14} color={T.dim} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search mentee, USN, or course"
            style={{
              width: '100%',
              padding: '9px 34px 9px 30px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.surface2,
              color: T.text,
              ...mono,
              fontSize: 10,
              outline: 'none',
            }}
          />
          {searchQuery ? (
            <button
              aria-label="Clear mentee search"
              title="Clear search"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: T.dim, cursor: 'pointer', display: 'flex' }}
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { lbl: 'Total Mentees', val: mentees.length, col: T.accent, key: 'all' as const, clickable: true },
          { lbl: 'High Vulnerability', val: highRisk, col: T.danger, key: 'high' as const, clickable: true },
          { lbl: 'Medium Risk', val: medRisk, col: T.warning, key: 'medium' as const, clickable: true },
          { lbl: 'Low Risk', val: lowRisk, col: T.success, key: 'low' as const, clickable: true },
        ].map((stat, index) => (
          <Card
            key={index}
            glow={stat.col}
            onClick={stat.clickable ? () => setActiveFilter(stat.key) : undefined}
            style={{
              padding: '12px 16px',
              cursor: stat.clickable ? 'pointer' : 'default',
              border: stat.clickable && activeFilter === stat.key ? `1px solid ${stat.col}` : undefined,
              boxShadow: stat.clickable && activeFilter === stat.key ? `0 0 0 1px ${stat.col}25 inset` : undefined,
            }}
          >
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: stat.col }}>{stat.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{stat.lbl}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Action Queue (Pending Actions)</div>
          <Chip color={pendingMentorActions.length > 0 ? T.warning : T.success} size={9}>
            {pendingMentorActions.length} active
          </Chip>
        </div>
        {pendingMentorActions.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {pendingMentorActions.map(task => {
              const target = mentees.find(mentee => mentee.usn === task.studentUsn || mentee.id === task.studentId)
              return (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, border: `1px solid ${T.border}`, background: T.surface2, borderRadius: 8, padding: '9px 10px' }}>
                  <div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{task.title}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName} · {task.courseCode} · {task.due}</div>
                  </div>
                  {target ? (
                    <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                      <button
                        onClick={() => onOpenMentee(target)}
                        style={{ ...mono, fontSize: 10, color: T.accent, border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 6, height: 28, padding: '0 10px', cursor: 'pointer' }}
                      >
                        Open Student
                      </button>
                      {onOpenRiskExplorer ? (
                        <button
                          onClick={() => onOpenRiskExplorer(target.id.replace(/^mentee-/, ''))}
                          style={{ ...mono, fontSize: 10, color: T.accent, border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 6, height: 28, padding: '0 10px', cursor: 'pointer' }}
                        >
                          Risk Explorer
                        </button>
                      ) : null}
                      {onOpenStudentShell ? (
                        <button
                          onClick={() => onOpenStudentShell(target.id.replace(/^mentee-/, ''))}
                          style={{ ...mono, fontSize: 10, color: T.accent, border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 6, height: 28, padding: '0 10px', cursor: 'pointer' }}
                        >
                          Student Shell
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ ...mono, fontSize: 11, color: T.dim }}>No pending mentor actions right now.</div>
        )}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredMentees.map(mentee => {
          const avsBand = mentee.avs >= 0.6 ? 'High' : mentee.avs >= 0.35 ? 'Medium' : mentee.avs >= 0 ? 'Low' : null
          const avsColor = avsBand === 'High' ? T.danger : avsBand === 'Medium' ? T.warning : avsBand === 'Low' ? T.success : T.dim
          return (
            <Card key={mentee.id} glow={avsColor} style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => onOpenMentee(mentee)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>{mentee.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 1 }}>{mentee.usn} · {mentee.year} · Sec {mentee.section} · {mentee.dept}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {mentee.avs >= 0 ? (
                    <>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: avsColor }}>{Math.round(mentee.avs * 100)}%</div>
                      <div style={{ ...mono, fontSize: 9, color: T.muted }}>Aggregate Vulnerability</div>
                    </>
                  ) : (
                    <Chip color={T.dim} size={10}>Awaiting TT1</Chip>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {mentee.courseRisks.map(courseRisk => {
                  const riskColor = courseRisk.risk >= 0.7 ? T.danger : courseRisk.risk >= 0.35 ? T.warning : courseRisk.risk >= 0 ? T.success : T.dim
                  return (
                    <div key={courseRisk.code} style={{ flex: '1 1 140px', background: T.surface2, borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>{courseRisk.code}</span>
                        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: riskColor }}>{courseRisk.risk >= 0 ? `${Math.round(courseRisk.risk * 100)}%` : '—'}</span>
                      </div>
                      <Bar val={courseRisk.risk >= 0 ? courseRisk.risk * 100 : 0} color={riskColor} h={4} />
                      <div style={{ ...mono, fontSize: 8, color: T.dim, marginTop: 2 }}>{courseRisk.title.slice(0, 25)}</div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {mentee.interventions.length > 0 ? (
                  <>
                    <Chip color={T.warning} size={9}>Last: {mentee.interventions[mentee.interventions.length - 1].date}</Chip>
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>{mentee.interventions[mentee.interventions.length - 1].note.slice(0, 40)}…</span>
                  </>
                ) : (
                  <span style={{ ...mono, fontSize: 10, color: T.dim }}>No interventions logged</span>
                )}
                {mentee.prevCgpa > 0 ? <Chip color={T.dim} size={9}>CGPA: {mentee.prevCgpa.toFixed(1)}</Chip> : null}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {onOpenRiskExplorer ? (
                    <button
                      aria-label={`Open ${mentee.name} in risk explorer`}
                      title="Risk Explorer"
                      onClick={event => {
                        event.stopPropagation()
                        onOpenRiskExplorer(mentee.id.replace(/^mentee-/, ''))
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}
                    >
                      <AlertTriangle size={13} />
                    </button>
                  ) : null}
                  {onOpenStudentShell ? (
                    <button
                      aria-label={`Open ${mentee.name} in student shell`}
                      title="Student Shell"
                      onClick={event => {
                        event.stopPropagation()
                        onOpenStudentShell(mentee.id.replace(/^mentee-/, ''))
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}
                    >
                      <Eye size={13} />
                    </button>
                  ) : null}
                  <button aria-label={`Copy ${mentee.name} phone number`} title="Copy phone" onClick={event => { event.stopPropagation(); void navigator.clipboard.writeText(mentee.phone) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Phone size={13} /></button>
                  <button aria-label={`Email ${mentee.name}`} title="Email" onClick={event => event.stopPropagation()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Mail size={13} /></button>
                </div>
              </div>
            </Card>
          )
        })}
        {filteredMentees.length === 0 ? (
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>No mentees found for this filter.</div>
          </Card>
        ) : null}
      </div>
    </PageShell>
  )
}

type MenteeDetailPageProps = {
  mentee: Mentee
  history: StudentHistoryRecord | null
  onBack: () => void
  onOpenHistory: (mentee: Mentee) => void
  onOpenStudentShell?: (studentId: string) => void
  onOpenRiskExplorer?: (studentId: string) => void
}

export function MenteeDetailPage({
  mentee,
  history,
  onBack,
  onOpenHistory,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: MenteeDetailPageProps) {
  const [activeInsight, setActiveInsight] = useState<'risk' | 'cgpa'>('risk')
  const avgCourseRisk = mentee.avs >= 0 ? Math.round(mentee.courseRisks.filter(risk => risk.risk >= 0).reduce((sum, risk) => sum + risk.risk, 0) / Math.max(1, mentee.courseRisks.filter(risk => risk.risk >= 0).length) * 100) : null
  const sgpaSeries = useMemo(
    () => history
      ? [...history.terms]
          .sort((left, right) => left.semesterNumber - right.semesterNumber)
          .map(term => ({ label: `S${term.semesterNumber}`, value: term.sgpa }))
      : [],
    [history],
  )
  const maxSgpa = sgpaSeries.reduce((best, point) => point.value > best.value ? point : best, sgpaSeries[0] ?? { label: 'S1', value: 0 })
  const minSgpa = sgpaSeries.reduce((worst, point) => point.value < worst.value ? point : worst, sgpaSeries[0] ?? { label: 'S1', value: 0 })
  const subjectStats = useMemo(() => {
    const allSubjects = history ? history.terms.flatMap(term => term.subjects.map(subject => ({ ...subject, termLabel: term.label }))) : []
    const best = allSubjects.reduce((winner, subject) => subject.score > (winner?.score ?? Number.NEGATIVE_INFINITY) ? subject : winner, allSubjects[0] ?? null)
    const lowest = allSubjects.reduce((loser, subject) => subject.score < (loser?.score ?? Number.POSITIVE_INFINITY) ? subject : loser, allSubjects[0] ?? null)
    return { best, lowest }
  }, [history])
  const riskDrivers = [...mentee.courseRisks]
    .filter(risk => risk.risk >= 0)
    .sort((left, right) => right.risk - left.risk)
    .slice(0, 3)
  const prioritizedCourseRisks = useMemo(
    () => [...mentee.courseRisks].filter(risk => risk.risk >= 0).sort((left, right) => right.risk - left.risk),
    [mentee.courseRisks],
  )
  const totalRiskWeight = useMemo(
    () => prioritizedCourseRisks.reduce((sum, risk) => sum + risk.risk, 0),
    [prioritizedCourseRisks],
  )

  if (!history) {
    return (
      <PageShell size="standard">
        <PageBackButton onClick={onBack} />
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 18, color: T.text }}>Student History Unavailable</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
            The backend did not return a transcript history for {mentee.name}. No local fallback is shown in the live teaching workspace.
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn size="sm" variant="ghost" onClick={onBack}>Back</Btn>
          </div>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell size="standard">
      <PageBackButton onClick={onBack} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 22, color: T.text }}>{mentee.name}</div>
          <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 3 }}>{mentee.usn} · {mentee.year} · Sec {mentee.section} · {mentee.dept}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Mentor workspace with intervention context, summary academics, and transcript entry point.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(mentee.phone)}><Phone size={12} /> Copy Phone</Btn>
          <Btn size="sm" disabled={!history} onClick={() => onOpenHistory(mentee)}><Eye size={12} /> View Student History</Btn>
          {onOpenRiskExplorer ? <Btn size="sm" variant="ghost" onClick={() => onOpenRiskExplorer(mentee.id.replace(/^mentee-/, ''))}><AlertTriangle size={12} /> Risk Explorer</Btn> : null}
          {onOpenStudentShell ? <Btn size="sm" variant="ghost" onClick={() => onOpenStudentShell(mentee.id.replace(/^mentee-/, ''))}><Eye size={12} /> Student Shell</Btn> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card
          glow={mentee.avs >= 0.6 ? T.danger : mentee.avs >= 0.35 ? T.warning : T.success}
          onClick={() => setActiveInsight('risk')}
          style={{ padding: '12px 16px', cursor: 'pointer', border: activeInsight === 'risk' ? `1px solid ${T.accent}` : undefined }}
        >
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: mentee.avs >= 0.6 ? T.danger : mentee.avs >= 0.35 ? T.warning : T.success }}>
            {mentee.avs >= 0 ? `${Math.round(mentee.avs * 100)}%` : 'Awaiting TT1'}
          </div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Aggregate Watch Score (click for why)</div>
        </Card>
        <Card
          glow={mentee.prevCgpa >= 7 ? T.success : mentee.prevCgpa >= 6 ? T.warning : T.danger}
          onClick={() => setActiveInsight('cgpa')}
          style={{ padding: '12px 16px', cursor: 'pointer', border: activeInsight === 'cgpa' ? `1px solid ${T.accent}` : undefined }}
        >
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: mentee.prevCgpa >= 7 ? T.success : mentee.prevCgpa >= 6 ? T.warning : T.danger }}>
            {mentee.prevCgpa > 0 ? mentee.prevCgpa.toFixed(1) : '—'}
          </div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Prev CGPA (click for trend)</div>
        </Card>
        <Card glow={T.accent} style={{ padding: '12px 16px' }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.accent }}>{mentee.courseRisks.length}</div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Tracked Courses</div>
        </Card>
        <Card glow={T.warning} style={{ padding: '12px 16px' }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.warning }}>{mentee.interventions.length}</div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Interventions Logged</div>
        </Card>
      </div>

      {activeInsight === 'risk' ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Why The Aggregate Watch Score Is {mentee.avs >= 0 ? `${Math.round(mentee.avs * 100)}%` : 'unavailable'}</div>
          {riskDrivers.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {riskDrivers.map(driver => {
                const color = driver.risk >= 0.7 ? T.danger : driver.risk >= 0.35 ? T.warning : T.success
                const contribution = totalRiskWeight > 0 ? Math.round((driver.risk / totalRiskWeight) * 100) : 0
                return (
                  <div key={driver.code} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{driver.code} · {driver.title}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>
                          {driver.risk >= 0.7 ? 'Major contributor' : driver.risk >= 0.35 ? 'Medium contributor' : 'Minor contributor'} · ~{contribution}% of current total
                        </div>
                      </div>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 16, color }}>{Math.round(driver.risk * 100)}%</div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Bar val={driver.risk * 100} color={color} h={4} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ ...mono, fontSize: 11, color: T.dim }}>Risk breakdown will appear after course-level data is available.</div>
          )}
        </Card>
      ) : null}

      {activeInsight === 'cgpa' ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Previous GPA Trend & Subject Highlights</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>SGPA by semester</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                {sgpaSeries.map(point => (
                  <div key={point.label} style={{ flex: 1, minWidth: 30 }}>
                    <div style={{ height: `${Math.max(10, Math.round((point.value / 10) * 100))}%`, background: `${T.accent}aa`, border: `1px solid ${T.accent}66`, borderRadius: '6px 6px 3px 3px' }} />
                    <div style={{ ...mono, fontSize: 9, color: T.muted, textAlign: 'center', marginTop: 5 }}>{point.label}</div>
                    <div style={{ ...mono, fontSize: 8, color: T.dim, textAlign: 'center' }}>{point.value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 7, alignContent: 'start' }}>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Max SGPA: <span style={{ color: T.success }}>{maxSgpa.value.toFixed(2)}</span> ({maxSgpa.label})</div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Min SGPA: <span style={{ color: T.danger }}>{minSgpa.value.toFixed(2)}</span> ({minSgpa.label})</div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Best Subject: <span style={{ color: T.success }}>{subjectStats.best ? `${subjectStats.best.code} (${subjectStats.best.score})` : '—'}</span></div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Lowest Subject: <span style={{ color: T.warning }}>{subjectStats.lowest ? `${subjectStats.lowest.code} (${subjectStats.lowest.score})` : '—'}</span></div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{subjectStats.best?.title ?? 'No subject data'} | {subjectStats.lowest?.title ?? 'No subject data'}</div>
            </div>
          </div>
        </Card>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 10 }}>Mentor Priority Queue</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {prioritizedCourseRisks.map((risk, index) => {
              const color = risk.risk >= 0.7 ? T.danger : risk.risk >= 0.35 ? T.warning : risk.risk >= 0 ? T.success : T.dim
              const guidance = risk.risk >= 0.7
                ? 'Immediate 1:1 check-in and weekly follow-up'
                : risk.risk >= 0.5
                  ? 'Create remedial task and review after next assessment'
                  : risk.risk >= 0.35
                    ? 'Monitor attendance and assign targeted practice'
                    : 'Keep under watch and reinforce consistency'
              return (
                <div key={risk.code} style={{ background: T.surface2, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div>
                      <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>P{index + 1} · {risk.code}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>{risk.title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 18, color }}>{risk.risk >= 0 ? `${Math.round(risk.risk * 100)}%` : '—'}</div>
                      <div style={{ ...mono, fontSize: 9, color: T.dim }}>{risk.risk >= 0 ? `${risk.band} watch band` : 'Awaiting data'}</div>
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>{guidance}</div>
                  <Bar val={risk.risk >= 0 ? risk.risk * 100 : 0} color={color} h={5} />
                </div>
              )
            })}
            {prioritizedCourseRisks.length === 0 ? <div style={{ ...mono, fontSize: 11, color: T.dim }}>Course priorities will appear once risk inputs are available.</div> : null}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 14 }}>
          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Mentor Summary</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              {avgCourseRisk !== null ? `Average course risk is ${avgCourseRisk}%.` : 'No score-based risk yet.'} Previous-semester CGPA is {history.currentCgpa > 0 ? history.currentCgpa.toFixed(2) : 'not yet available'}.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {mentee.courseRisks.filter(risk => risk.risk >= 0.5).map(risk => <Chip key={risk.code} color={risk.risk >= 0.7 ? T.danger : T.warning} size={9}>{risk.code}</Chip>)}
              {mentee.courseRisks.every(risk => risk.risk < 0.5) ? <Chip color={T.success} size={9}>No current high-risk courses</Chip> : null}
            </div>
          </Card>

          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Intervention Timeline</div>
            {mentee.interventions.length > 0 ? mentee.interventions.map((entry, index) => (
              <div key={`${entry.date}-${index}`} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: index < mentee.interventions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 56 }}>{entry.date}</div>
                <Chip color={T.warning} size={9}>{entry.type}</Chip>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>{entry.note}</div>
              </div>
            )) : (
              <div style={{ ...mono, fontSize: 11, color: T.dim }}>No interventions logged for this mentee yet.</div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

type UnlockReviewPageProps = {
  task: SharedTask
  offering: Offering | null
  onBack: () => void
  onApprove: () => void
  onReject: () => void
  onResetComplete: () => void
}

export function UnlockReviewPage({ task, offering, onBack, onApprove, onReject, onResetComplete }: UnlockReviewPageProps) {
  return (
    <PageShell size="narrow">
      <PageBackButton onClick={onBack} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Unlock Review</div>
        <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 4 }}>{task.courseCode} · {offering?.title ?? task.courseName} · {task.unlockRequest?.kind.toUpperCase()}</div>
      </div>
      <Card glow={task.unlockRequest?.status === 'Rejected' ? T.danger : T.warning} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Chip color={T.accent} size={9}>Requested by: {task.unlockRequest?.requestedByRole ?? task.sourceRole}</Chip>
          <Chip color={task.unlockRequest?.status === 'Rejected' ? T.danger : task.unlockRequest?.status === 'Reset Completed' ? T.success : T.warning} size={9}>Status: {task.unlockRequest?.status ?? 'Pending'}</Chip>
          <Chip color={T.dim} size={9}>Submitted: {formatDateTime(task.unlockRequest?.requestedAt)}</Chip>
        </div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{task.actionHint}</div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Request Details</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Offering: {offering?.code ?? task.courseCode} · Sec {offering?.section ?? '—'}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Current owner: {task.assignedTo}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Reason: {task.actionHint}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Teacher note: {task.unlockRequest?.requestNote ?? task.requestNote ?? 'No request note captured'}</div>
            {task.unlockRequest?.handoffNote ? <div style={{ ...mono, fontSize: 11, color: T.muted }}>Handoff note: {task.unlockRequest.handoffNote}</div> : null}
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Latest review note: {task.unlockRequest?.reviewNote ?? 'No review note yet'}</div>
          </div>
        </Card>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Decision Flow</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 10 }}>Approve to allow a correction cycle, reject if the lock should stand, and then complete reset/unlock explicitly.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {task.unlockRequest?.status === 'Pending' ? (
              <>
                <Btn size="sm" onClick={onApprove}>Approve</Btn>
                <Btn size="sm" variant="danger" onClick={onReject}>Reject</Btn>
              </>
            ) : null}
            {task.unlockRequest?.status === 'Approved' ? <Btn size="sm" onClick={onResetComplete}>Reset & Unlock</Btn> : null}
            {task.unlockRequest?.status === 'Rejected' || task.unlockRequest?.status === 'Reset Completed' ? <Chip color={task.unlockRequest.status === 'Rejected' ? T.danger : T.success} size={9}>Decision completed</Chip> : null}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Transition History</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(task.transitionHistory ?? []).map(transition => (
            <div key={transition.id} style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 112 }}>{formatDateTime(transition.at)}</div>
              <div>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{transition.action}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{transition.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  )
}

type QueueHistoryPageProps = {
  role: Role
  tasks: SharedTask[]
  resolvedTaskIds: Record<string, number>
  proofProfile?: ApiAcademicFacultyProfile | null
  onBack: () => void
  onOpenTaskStudent: (task: SharedTask) => void
  onOpenUnlockReview: (taskId: string) => void
  onRestoreTask: (taskId: string) => void
  onOpenStudentShell?: (studentId: string) => void
  onOpenRiskExplorer?: (studentId: string) => void
}

export function QueueHistoryPage({
  role,
  tasks,
  resolvedTaskIds,
  proofProfile,
  onBack,
  onOpenTaskStudent,
  onOpenUnlockReview,
  onRestoreTask,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: QueueHistoryPageProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved' | 'dismissed'>('all')
  const visible = tasks
    .filter(task => {
      if (filter === 'all') return true
      if (filter === 'active') return !resolvedTaskIds[task.id] && !task.dismissal
      if (filter === 'resolved') return !!resolvedTaskIds[task.id]
      return !!task.dismissal
    })
    .sort((left, right) => (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt))

  return (
    <PageShell size="standard">
      <PageBackButton onClick={onBack} />
      <AcademicProofSummaryStrip profile={proofProfile ?? null} surfaceId="queue-history" surfaceLabel="Queue History" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Queue History</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{role} view of active, resolved, and reassigned items.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'resolved', 'dismissed'] as const).map(option => (
            <button key={option} data-tab="true" onClick={() => setFilter(option)} style={{ ...mono, fontSize: 10, padding: '5px 8px', borderRadius: 4, border: `1px solid ${filter === option ? T.accent : T.border}`, background: filter === option ? `${T.accent}18` : 'transparent', color: filter === option ? T.accentLight : T.muted, cursor: 'pointer' }}>
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {visible.map(task => (
          <Card key={task.id} onClick={() => onOpenTaskStudent(task)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{task.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName} · {task.studentUsn} · {task.courseCode || 'Mentor context'}</div>
                <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 4 }}>Open the related student context directly from anywhere on this card.</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip color={resolvedTaskIds[task.id] ? T.success : task.dismissal ? T.muted : T.warning} size={9}>{resolvedTaskIds[task.id] ? 'Resolved' : task.dismissal ? 'Dismissed' : 'Active'}</Chip>
                {task.dismissal ? <Chip color={task.dismissal.kind === 'series' ? T.danger : T.muted} size={9}>{task.dismissal.kind === 'series' ? 'Series dismissed' : 'Dismissed'}</Chip> : null}
                <Chip color={task.assignedTo === 'HoD' ? T.danger : task.assignedTo === 'Mentor' ? T.warning : T.accent} size={9}>{task.assignedTo}</Chip>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
              {(task.transitionHistory ?? []).map(transition => (
                <div key={transition.id} style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 112 }}>{formatDateTime(transition.at)}</div>
                  <div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{transition.action}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>{transition.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div onClick={event => event.stopPropagation()}><Btn size="sm" variant="ghost" onClick={() => onOpenTaskStudent(task)}>Open Student</Btn></div>
              {onOpenRiskExplorer ? <div onClick={event => event.stopPropagation()}><Btn size="sm" variant="ghost" onClick={() => onOpenRiskExplorer(task.studentId)}>Risk Explorer</Btn></div> : null}
              {onOpenStudentShell ? <div onClick={event => event.stopPropagation()}><Btn size="sm" variant="ghost" onClick={() => onOpenStudentShell(task.studentId)}>Student Shell</Btn></div> : null}
              {task.dismissal ? <div onClick={event => event.stopPropagation()}><Btn size="sm" onClick={() => onRestoreTask(task.id)}>{task.dismissal.kind === 'series' ? 'Resume series' : 'Restore'}</Btn></div> : null}
              {task.unlockRequest && role === 'HoD' ? <div onClick={event => event.stopPropagation()}><Btn size="sm" onClick={() => onOpenUnlockReview(task.id)}>Open Unlock Review</Btn></div> : null}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}
