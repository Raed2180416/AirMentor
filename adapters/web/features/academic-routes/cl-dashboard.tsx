import { useMemo } from 'react'
import { AlertTriangle, Phone } from 'lucide-react'
import { T, mono, sora, yearColor, type Offering, type Student } from '@web/simulation/fixtures'
import { type EntryKind } from '@kernel/shared/domain'
import type { ApiAcademicFacultyProfile, ApiProofReassessmentResolveResponse, ApiStudentAgentCard, ApiStudentRiskExplorer } from '@web/shared/api/types'
import type { ProofAdvanceControlMode, ProofPlaybackControlDirection } from '@web/simulation/proof-simulation-controls'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { useAppSelectors } from '@web/shared/state/selectors'
import { Btn, Card, PageShell } from '@web/shared/ui/primitives'
import { YearSection } from './dashboard-year-section'

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
  onOpenStudents?: () => void
  onOpenUpload: (offering?: Offering, kind?: EntryKind) => void
  onOpenCalendar: () => void
  onOpenFacultyProfile?: () => void
  onOpenPendingActions: () => void
  loadStudentRiskExplorer?: (studentId: string) => Promise<ApiStudentRiskExplorer>
  loadStudentAgentCard?: (studentId: string) => Promise<ApiStudentAgentCard>
  onCommitDemoAttendanceEdit?: (offeringId: string, studentId: string, nextAttendancePct: number) => Promise<void>
  onRecomputeProofRunRisk?: (simulationRunId: string, options?: { refreshWorkspace?: boolean }) => Promise<void>
  onResolveProofReassessment?: (reassessmentEventId: string, options?: { refreshWorkspace?: boolean }) => Promise<ApiProofReassessmentResolveResponse>
  onAdvanceProofRun?: (simulationRunId: string, mode: ProofAdvanceControlMode, options?: { refreshWorkspace?: boolean }) => Promise<void> | void
  onStopProofRun?: (simulationRunId: string) => void
  onStepProofPlayback?: (direction: ProofPlaybackControlDirection) => void
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
  onOpenStudents,
  onOpenUpload,
  onOpenCalendar,
  onOpenFacultyProfile,
  onOpenPendingActions,
  loadStudentRiskExplorer: _loadStudentRiskExplorer,
  loadStudentAgentCard: _loadStudentAgentCard,
  onCommitDemoAttendanceEdit: _onCommitDemoAttendanceEdit,
  onRecomputeProofRunRisk: _onRecomputeProofRunRisk,
  onResolveProofReassessment: _onResolveProofReassessment,
  onAdvanceProofRun: _onAdvanceProofRun,
  onStopProofRun: _onStopProofRun,
  onStepProofPlayback: _onStepProofPlayback,
  teacherInitials,
  greetingHeadline,
  greetingMeta,
  greetingSubline,
}: CLDashboardProps) {
  const { getStudentsPatched } = useAppSelectors()
  const proofCheckpoint = proofProfile?.proofOperations?.scopeMode === 'proof'
    ? proofProfile.proofOperations.selectedCheckpoint
    : null
  const activeProofRun = proofProfile?.proofOperations?.activeRunContexts[0] ?? null
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
        reasonLabel: item.drivers[0]?.label ?? humanLabelForActionCode(item.recommendedAction) ?? null,
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
    if (proofProfile?.proofOperations?.scopeMode === 'proof') return []
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
  }, [getStudentsPatched, offerings, proofProfile])
  const highRiskAlertItems = proofProfile?.proofOperations?.scopeMode === 'proof'
    ? proofAlertItems
    : fallbackAlertItems
  const highRiskCount = highRiskAlertItems.length
  const yearGroups = useMemo(() => {
    return Array.from(new Set(offerings.map(offering => offering.year))).map(year => {
      const sample = offerings.find(offering => offering.year === year) ?? offerings[0]
      return { year, color: yearColor(year), stageInfo: sample.stageInfo, offerings: offerings.filter(offering => offering.year === year) }
    })
  }, [offerings])

  return (
    <PageShell size="wide">
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
          { icon: '👥', label: 'Total Students', val: total, color: T.accent, action: onOpenStudents },
          { icon: '‼️', label: 'High Watch Students', val: highRiskCount, color: T.danger },
          { icon: '🎯', label: 'Pending Actions', val: pendingTaskCount, color: T.warning, action: onOpenPendingActions },
        ].map((stat, index) => (
          <Card key={index} style={{ padding: '14px 18px', cursor: stat.action ? 'pointer' : 'default', borderColor: `${stat.color}22` }} onClick={stat.action}>
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

      {(proofCheckpoint || activeProofRun) && (
        <Card data-proof-section="dashboard-proof-controls-cta" style={{ padding: '16px 18px', marginBottom: 24, display: 'grid', gap: 10, borderColor: `${T.accent}2f` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Shared Proof Controls
              </div>
              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text, marginTop: 6 }}>
                {proofCheckpoint
                  ? `Semester ${proofCheckpoint.semesterNumber} · ${proofCheckpoint.stageLabel}`
                  : activeProofRun?.runLabel ?? 'Active proof run'}
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                Advance stages and review the shared proof panel from Faculty Profile. The dashboard stays stage-aware, but the authoritative controls live there.
              </div>
            </div>
            {onOpenFacultyProfile ? <Btn size="sm" onClick={onOpenFacultyProfile}>Open Faculty Profile</Btn> : null}
          </div>
        </Card>
      )}

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
                    data-testid="priority-alert-card"
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
