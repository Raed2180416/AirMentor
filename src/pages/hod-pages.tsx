import { useMemo, useState } from 'react'
import { Shield } from 'lucide-react'
import type { Offering, Student } from '../data'
import { T, mono, sora } from '../data'
import type { CalendarAuditEvent, RiskBand, SharedTask } from '../domain'
import type {
  ApiAcademicHodProofCourseRollup,
  ApiAcademicHodProofFacultyRollup,
  ApiAcademicHodProofReassessment,
  ApiAcademicHodProofStudentWatch,
  ApiAcademicHodProofSummary,
} from '../api/types'
import { describeProofAvailability, describeProofProvenance } from '../proof-provenance'
import { ProofSurfaceHero, ProofSurfaceLauncher, ProofSurfaceTabPanel, ProofSurfaceTabs } from '../proof-surface-shell'
import { Btn, Card, Chip, ModalWorkspace, PageShell, RiskBadge, TH, TD } from '../ui-primitives'
import { EmptyState, InfoBanner, MetricCard, SectionHeading, formatDateTime, getStatusColor } from '../system-admin-ui'

type HodTabId = 'overview' | 'courses' | 'faculty' | 'reassessments'

function toRiskBand(band?: string | null): RiskBand | null {
  const normalized = band?.trim().toLowerCase()
  if (normalized === 'high') return 'High'
  if (normalized === 'medium') return 'Medium'
  if (normalized === 'low') return 'Low'
  return null
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function formatHours(value: number) {
  return `${value.toFixed(1)} h`
}

function sectionColor(_sectionCode: string) {
  return T.muted
}

type GovernedQueueState = 'open' | 'watching' | 'resolved' | null

function resolveGovernedQueueState(status?: string | null): GovernedQueueState {
  const normalized = status?.trim().toLowerCase()
  if (normalized === 'open' || normalized === 'opened') return 'open'
  if (normalized === 'watch' || normalized === 'watching') return 'watching'
  if (normalized === 'resolved') return 'resolved'
  return null
}

function governedQueueLabel(state: Exclude<GovernedQueueState, null>) {
  if (state === 'open') return 'Action Needed'
  if (state === 'watching') return 'Watching'
  return 'Resolved'
}

function governedQueueColor(state: Exclude<GovernedQueueState, null>) {
  if (state === 'open') return T.danger
  if (state === 'watching') return T.warning
  return T.success
}

function PanelLabel({ children, color = T.accent }: { children: string; color?: string }) {
  return (
    <span style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
      {children}
    </span>
  )
}

function TableCard({
  title,
  caption,
  children,
  ...rest
}: {
  title: string
  caption: string
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>) {
  return (
    <Card style={{ padding: 16, display: 'grid', gap: 12 }} {...rest}>
      <div>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{title}</div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{caption}</div>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </Card>
  )
}

export function HodView({
  onOpenQueueHistory,
  onOpenStudentShell,
  onOpenRiskExplorer,
  summary,
  courseRollups,
  facultyRollups,
  studentWatchRows,
  reassessmentRows,
  loading,
  error,
}: {
  onOpenQueueHistory: () => void
  onOpenCourse: (offering: Offering) => void
  onOpenStudent: (student: Student, offering?: Offering) => void
  onOpenStudentShell: (studentId: string) => void
  onOpenRiskExplorer: (studentId: string) => void
  tasks: SharedTask[]
  calendarAuditEvents: CalendarAuditEvent[]
  summary: ApiAcademicHodProofSummary | null
  courseRollups: ApiAcademicHodProofCourseRollup[]
  facultyRollups: ApiAcademicHodProofFacultyRollup[]
  studentWatchRows: ApiAcademicHodProofStudentWatch[]
  reassessmentRows: ApiAcademicHodProofReassessment[]
  loading: boolean
  error: string
}) {
  const [activeTab, setActiveTab] = useState<HodTabId>('overview')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null)
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null)
  const [showActionNeededOnly, setShowActionNeededOnly] = useState(true)

  const selectedStudent = useMemo(
    () => studentWatchRows.find(row => row.studentId === selectedStudentId) ?? null,
    [selectedStudentId, studentWatchRows],
  )
  const selectedCourse = useMemo(
    () => courseRollups.find(row => row.courseCode === selectedCourseCode) ?? null,
    [courseRollups, selectedCourseCode],
  )
  const selectedFaculty = useMemo(
    () => facultyRollups.find(row => row.facultyId === selectedFacultyId) ?? null,
    [facultyRollups, selectedFacultyId],
  )

  const selectedCourseStudents = useMemo(() => {
    if (!selectedCourse) return []
    return studentWatchRows.filter(row =>
      row.courseSnapshots.some(snapshot => snapshot.courseCode === selectedCourse.courseCode),
    )
  }, [selectedCourse, studentWatchRows])

  const selectedFacultyReassessments = useMemo(() => {
    if (!selectedFaculty) return []
    return reassessmentRows.filter(row => row.assignedToRole.toLowerCase() === 'hod' || selectedFaculty.permissions.includes(row.assignedToRole))
  }, [reassessmentRows, selectedFaculty])
  const checkpointContext = summary?.activeRunContext?.checkpointContext ?? null

  const filteredStudents = useMemo(() => {
    if (showActionNeededOnly) {
      return studentWatchRows.filter(row => resolveGovernedQueueState(row.currentReassessmentStatus) === 'open')
    }
    return studentWatchRows
  }, [studentWatchRows, showActionNeededOnly])

  const overviewStudents = filteredStudents.slice(0, 16)

  if (loading) {
    return (
      <PageShell size="wide">
        <InfoBanner message="Loading live HoD proof analytics..." />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell size="wide">
        <InfoBanner tone="error" message={error} />
      </PageShell>
    )
  }

  if (!summary?.activeRunContext) {
    return (
      <PageShell size="wide">
        <EmptyState
          title="No active proof run"
          body="HoD analytics becomes available when sysadmin activates a proof run for the supervised batch. This page remains read-only and sourced only from live proof records."
        />
      </PageShell>
    )
  }

  return (
    <PageShell size="wide">
      <div style={{ display: 'grid', gap: 18, paddingBottom: 24 }}>
        <ProofSurfaceHero
          surface="hod-proof-analytics"
          entityId={checkpointContext?.simulationStageCheckpointId ?? undefined}
          eyebrow="Live HoD Analytics"
          title="Department proof records for the active simulation run"
          description="Read-only oversight view sourced from the same active proof run used by sysadmin and faculty profile. Formal academic status remains policy-derived; this surface does not expose latent-state internals."
          icon={<Shield size={22} color={T.accent} />}
          headerActions={<Btn size="sm" variant="ghost" onClick={onOpenQueueHistory}>Queue History</Btn>}
          badges={(
            <>
              <Chip color={T.accent}>{summary.activeRunContext.batchLabel}</Chip>
              <Chip color={T.success}>{summary.activeRunContext.branchName ?? 'Branch scope pending'}</Chip>
              <Chip color={T.warning}>{summary.activeRunContext.status}</Chip>
              {checkpointContext ? <Chip color={T.orange}>{`Sem ${checkpointContext.semesterNumber} · ${checkpointContext.stageLabel}`}</Chip> : null}
              {summary.scope.departmentNames.map(name => <Chip key={name} color={T.muted}>{name}</Chip>)}
              {summary.scope.branchNames.map(name => <Chip key={name} color={T.dim}>{name}</Chip>)}
            </>
          )}
          notices={(
            <>
              <InfoBanner message={`Active run ${summary.activeRunContext.runLabel} · seed ${summary.activeRunContext.seed} · created ${formatDateTime(summary.activeRunContext.createdAt)} · sourced from live proof records${checkpointContext ? ` · checkpoint ${checkpointContext.stageLabel} (semester ${checkpointContext.semesterNumber})` : ''}.`} />
              <InfoBanner tone="neutral" message={describeProofProvenance(summary)} />
              <InfoBanner tone="neutral" message={describeProofAvailability(summary)} />
            </>
          )}
        >
          {checkpointContext ? (
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              Read-only checkpoint overlay active: {checkpointContext.stageDescription}. This HoD surface shows the same selected playback checkpoint as the teaching proof overlay{checkpointContext.stageAdvanceBlocked ? ' and respects the blocked progression state.' : ''}.
            </div>
          ) : null}
        </ProofSurfaceHero>

        <ProofSurfaceLauncher targetId="hod-proof-controls" label="Jump to HoD proof controls" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <MetricCard label="Students Covered" value={String(summary.totals.studentsCovered)} helper="Students visible in the active HoD scope." />
          <MetricCard label="High Watch" value={String(summary.totals.highRiskCount)} helper="Current high-priority watchlist count for the active semester." />
          <MetricCard label="Medium Watch" value={String(summary.totals.mediumRiskCount)} helper="Students requiring review but not yet in the highest watch band." />
          <MetricCard label="Open Reassessments" value={String(summary.monitoringSummary.activeReassessmentCount)} helper="Read-only count of currently open reassessment events." />
          <MetricCard label="Unresolved Alerts" value={String(summary.totals.unresolvedAlertCount)} helper="Alert decisions without acknowledgement in the current active run." />
          <MetricCard label="Average Queue Age" value={formatHours(summary.totals.averageQueueAgeHours)} helper="Mean age of open reassessments in the current view." />
          <MetricCard label="Faculty In Scope" value={String(summary.facultyLoadSummary.facultyCount)} helper="Faculty rows visible in the supervised proof scope." />
          <MetricCard label="Overload Flags" value={String(summary.facultyLoadSummary.overloadedFacultyCount)} helper="Faculty load profiles exceeding the current semester threshold." />
        </div>

        <ProofSurfaceTabs
          controlId="hod-proof-controls"
          idBase="hod"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'courses', label: 'Course Hotspots' },
            { id: 'faculty', label: 'Faculty Operations' },
            { id: 'reassessments', label: 'Reassessment Audit' },
          ]}
          activeTab={activeTab}
          onChange={tabId => setActiveTab(tabId as HodTabId)}
          ariaLabel="HoD proof sections"
          actionName="hod-proof-tab"
          style={{ borderBottom: 'none', paddingBottom: 0 }}
        />

        <ProofSurfaceTabPanel
          idBase="hod"
          tabId={activeTab}
          activeTab={activeTab}
          sectionId={`hod-panel-${activeTab}`}
          minHeight={420}
          style={{ gap: 16 }}
        >
        {activeTab === 'overview' ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <SectionHeading
              eyebrow="Overview"
              title="Run-wide oversight"
              caption="Section comparison, backlog distribution, and the top watchlist rows for the current active run."
              actions={
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip color={T.accent}>{`${summary.monitoringSummary.riskAssessmentCount} risk assessments`}</Chip>
                  <Chip color={T.warning}>{`${summary.monitoringSummary.alertDecisionCount} alert decisions`}</Chip>
                  <Chip color={T.success}>{`${summary.monitoringSummary.resolutionCount} resolutions`}</Chip>
                </div>
              }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <TableCard title="Section Comparison" caption="Observed attendance and open reassessment counts for section A and B.">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>Section</TH>
                      <TH>Students</TH>
                      <TH>High</TH>
                      <TH>Medium</TH>
                      <TH>Attendance</TH>
                      <TH>Open Reassessments</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sectionComparison.map(row => (
                      <tr key={row.sectionCode}>
                        <TD><Chip color={sectionColor(row.sectionCode)}>{row.sectionCode}</Chip></TD>
                        <TD>{row.studentCount}</TD>
                        <TD>{row.highRiskCount}</TD>
                        <TD>{row.mediumRiskCount}</TD>
                        <TD>{formatPercent(row.averageAttendancePct)}</TD>
                        <TD>{row.openReassessmentCount}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableCard>

              <TableCard title="Semester Distribution" caption="Backlog-based semester pressure derived from transcript records.">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>Semester</TH>
                      <TH>High Pressure</TH>
                      <TH>Review</TH>
                      <TH>Stable</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.semesterRiskDistribution.map(row => (
                      <tr key={row.semesterNumber}>
                        <TD>Sem {row.semesterNumber}</TD>
                        <TD>{row.highPressureCount}</TD>
                        <TD>{row.reviewCount}</TD>
                        <TD>{row.stableCount}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
                <PanelLabel color={T.warning}>Policy Derived</PanelLabel>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Backlog distribution</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {summary.backlogDistribution.map(item => (
                    <Chip key={item.bucket} color={item.bucket === '0' ? T.success : item.bucket === '1' ? T.warning : T.danger}>
                      {`${item.bucket} backlog · ${item.studentCount}`}
                    </Chip>
                  ))}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                  These buckets come from transcript rollups in the active run and help reconcile semester pressure with course-level watch states.
                </div>
              </Card>

              <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
                <PanelLabel color={T.success}>Observed</PanelLabel>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Elective readiness distribution</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {summary.electiveDistribution.length > 0 ? summary.electiveDistribution.map(item => (
                    <Chip key={item.stream} color={T.success}>{`${item.stream} · ${item.recommendationCount}`}</Chip>
                  )) : <Chip color={T.dim}>No semester-6 recommendations in the active slice</Chip>}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                  Semester-6 elective fit remains advisory and is derived from observed prior performance, not from hidden simulation variables.
                </div>
              </Card>

              <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
                <PanelLabel color={T.accent}>Human Action Log</PanelLabel>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Governance summary</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip color={T.accent}>{`${summary.monitoringSummary.acknowledgementCount} acknowledgements`}</Chip>
                  <Chip color={T.warning}>{`${summary.totals.manualOverrideCount} overrides`}</Chip>
                  <Chip color={T.success}>{`${summary.totals.resolvedAlertCount} resolved alerts`}</Chip>
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                  Sysadmin remains the owner of run lifecycle and proof governance. This HoD surface is read-only and shows only persisted audit outcomes.
                </div>
              </Card>
            </div>

            <TableCard
              title="Current Watchlist"
              caption="Priority rows by current risk probability. Action Needed now keys off governed open cases; View All keeps Watching rows visible without treating them as blocking work."
              data-proof-section="hod-overview-students"
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <Btn
                  size="sm"
                  variant={showActionNeededOnly ? 'primary' : 'ghost'}
                  onClick={() => setShowActionNeededOnly(true)}
                >
                  Action Needed
                </Btn>
                <Btn
                  size="sm"
                  variant={!showActionNeededOnly ? 'primary' : 'ghost'}
                  onClick={() => setShowActionNeededOnly(false)}
                  >
                  View All
                </Btn>
              </div>
              {overviewStudents.length === 0 ? (
                <EmptyState
                  title="No students in the current HoD watchlist"
                  body="No students are in the current HoD watchlist for this scope."
                />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>Student</TH>
                      <TH>Section</TH>
                      <TH>Primary Course</TH>
                      <TH>Risk</TH>
                      <TH>Attendance</TH>
                      <TH>TT Window</TH>
                      <TH>Elective Fit</TH>
                      <TH>Actions</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewStudents.map(row => {
                    const governedQueueState = resolveGovernedQueueState(row.currentReassessmentStatus)
                    const actionNeeded = governedQueueState === 'open'
                    return (
                      <tr key={row.studentId} data-proof-row="hod-student-row" data-proof-student-id={row.studentId}>
                        <TD>
                          <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.studentName}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.usn}</div>
                        </TD>
                        <TD><Chip color={sectionColor(row.sectionCode)}>{row.sectionCode}</Chip></TD>
                        <TD>{row.primaryCourseCode}</TD>
                        <TD>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <RiskBadge band={toRiskBand(row.currentRiskBand)} prob={row.currentRiskProbScaled / 100} />
                            {governedQueueState ? (
                              <Chip color={governedQueueColor(governedQueueState)}>{governedQueueLabel(governedQueueState)}</Chip>
                            ) : null}
                          </div>
                        </TD>
                        <TD>{formatPercent(row.observedEvidence.attendancePct)}</TD>
                        <TD>{`${formatPercent(row.observedEvidence.tt1Pct)} / ${formatPercent(row.observedEvidence.tt2Pct)}`}</TD>
                        <TD>{row.electiveFit ? `${row.electiveFit.recommendedCode} · ${row.electiveFit.stream}` : 'Pending'}</TD>
                        <TD>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {actionNeeded ? (
                              <Btn size="sm" variant="ghost">Acknowledge</Btn>
                            ) : null}
                            <Btn size="sm" variant="ghost" onClick={() => setSelectedStudentId(row.studentId)}>Inspect</Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="hod-open-risk-explorer"
                              dataProofEntityId={row.studentId}
                              onClick={() => onOpenRiskExplorer(row.studentId)}
                            >
                              Success Profile
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="hod-open-student-shell"
                              dataProofEntityId={row.studentId}
                              onClick={() => onOpenStudentShell(row.studentId)}
                            >
                              Shell
                            </Btn>
                          </div>
                        </TD>
                      </tr>
                    )
                    })}
                  </tbody>
                </table>
              )}
            </TableCard>
          </div>
        ) : null}

        {activeTab === 'courses' ? (
          <TableCard title="Course Hotspots" caption="Course-level view of risk concentration, attendance pressure, TT1/TT2 weakness, question weakness, and reassessment burden.">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Course</TH>
                  <TH>Sections</TH>
                  <TH>Risk</TH>
                  <TH>Attendance</TH>
                  <TH>Assessment Weakness</TH>
                  <TH>Backlog Carryover</TH>
                  <TH>Reassessments</TH>
                  <TH>Open</TH>
                </tr>
              </thead>
              <tbody>
                {courseRollups.map(row => (
                  <tr key={row.courseCode}>
                    <TD>
                      <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.courseCode}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.title}</div>
                    </TD>
                    <TD>{row.sectionCodes.join(', ') || 'NA'}</TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Chip color={T.danger}>{`High ${row.riskCountHigh}`}</Chip>
                        <Chip color={T.warning}>{`Medium ${row.riskCountMedium}`}</Chip>
                      </div>
                    </TD>
                    <TD>{formatPercent(row.averageAttendancePct)}</TD>
                    <TD>{`TT1 ${row.tt1WeakCount} · TT2 ${row.tt2WeakCount} · SEE ${row.seeWeakCount} · Q ${row.weakQuestionSignalCount}`}</TD>
                    <TD>{row.backlogCarryoverCount}</TD>
                    <TD>{`${row.openReassessmentCount} open · ${row.resolvedReassessmentCount} resolved`}</TD>
                    <TD><Btn size="sm" variant="ghost" onClick={() => setSelectedCourseCode(row.courseCode)}>Inspect</Btn></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        ) : null}

        {activeTab === 'faculty' ? (
          <TableCard title="Faculty Operations" caption="Proof-scope load and monitoring metrics for faculty inside the supervised department or branch.">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Faculty</TH>
                  <TH>Permissions</TH>
                  <TH>Weekly Load</TH>
                  <TH>Sections</TH>
                  <TH>Queue</TH>
                  <TH>Ack Lag</TH>
                  <TH>Closure Rate</TH>
                  <TH>Open</TH>
                </tr>
              </thead>
              <tbody>
                {facultyRollups.map(row => (
                  <tr key={row.facultyId}>
                    <TD>
                      <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.facultyName}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.designation}</div>
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {row.permissions.map(permission => <Chip key={`${row.facultyId}-${permission}`} color={permission === 'HOD' ? T.warning : permission === 'MENTOR' ? T.success : T.accent}>{permission}</Chip>)}
                      </div>
                    </TD>
                    <TD>
                      <div style={{ ...mono, fontSize: 11, color: T.text }}>{formatHours(row.weeklyContactHours)}</div>
                      {row.overloadFlag ? <div style={{ ...mono, fontSize: 10, color: T.danger, marginTop: 2 }}>Over threshold</div> : null}
                    </TD>
                    <TD>{row.assignedSections.join(', ') || 'None'}</TD>
                    <TD>{row.queueLoad}</TD>
                    <TD>{formatHours(row.avgAcknowledgementLagHours)}</TD>
                    <TD>{`${row.reassessmentClosureRate}%`}</TD>
                    <TD><Btn size="sm" variant="ghost" onClick={() => setSelectedFacultyId(row.facultyId)}>Inspect</Btn></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        ) : null}

        {activeTab === 'reassessments' ? (
          <TableCard title="Reassessment Audit" caption="Run-scoped reassessment records with current status, acknowledgement, and resolution visibility.">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Student</TH>
                  <TH>Course</TH>
                  <TH>Assigned Role</TH>
                  <TH>Risk</TH>
                  <TH>Due</TH>
                  <TH>Status</TH>
                  <TH>Acknowledgement</TH>
                  <TH>Resolution</TH>
                  <TH>Open</TH>
                </tr>
              </thead>
              <tbody>
                {reassessmentRows.map(row => (
                  <tr key={row.reassessmentEventId}>
                    <TD>
                      <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.studentName}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.usn}</div>
                    </TD>
                    <TD>
                      <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.courseCode}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.sectionCode ?? 'NA'}</div>
                    </TD>
                    <TD><Chip color={row.assignedToRole === 'HOD' ? T.warning : T.accent}>{row.assignedToRole}</Chip></TD>
                    <TD><RiskBadge band={toRiskBand(row.riskBand)} prob={row.riskProbScaled / 100} /></TD>
                    <TD>{formatDateTime(row.dueAt)}</TD>
                    <TD><Chip color={getStatusColor(row.status)}>{row.status}</Chip></TD>
                    <TD>{row.acknowledgement ? <Chip color={getStatusColor(row.acknowledgement.status)}>{row.acknowledgement.status}</Chip> : <Chip color={T.dim}>Pending</Chip>}</TD>
                    <TD>{row.resolution ? <Chip color={getStatusColor(row.resolution.resolutionStatus)}>{row.resolution.resolutionStatus}</Chip> : <Chip color={T.dim}>Open</Chip>}</TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn size="sm" variant="ghost" onClick={() => setSelectedStudentId(row.studentId)}>Inspect</Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          dataProofAction="hod-open-risk-explorer"
                          dataProofEntityId={row.studentId}
                          onClick={() => onOpenRiskExplorer(row.studentId)}
                        >
                          Risk Explorer
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          dataProofAction="hod-open-student-shell"
                          dataProofEntityId={row.studentId}
                          onClick={() => onOpenStudentShell(row.studentId)}
                        >
                          Student Shell
                        </Btn>
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        ) : null}
        </ProofSurfaceTabPanel>
      </div>

      {selectedStudent ? (
        <ModalWorkspace
          eyebrow="Student Drilldown"
          title={`${selectedStudent.studentName} · ${selectedStudent.usn}`}
          caption="Observed evidence, policy-derived status, semester timeline, and elective-fit context for the active proof run."
          onClose={() => setSelectedStudentId(null)}
          size="xl"
        >
          <div data-proof-surface="hod-student-drilldown" data-proof-student-id={selectedStudent.studentId} style={{ display: 'grid', gap: 16 }}>
            {(() => {
              const governedQueueState = resolveGovernedQueueState(selectedStudent.currentReassessmentStatus)
              return governedQueueState ? (
                <InfoBanner
                  tone={governedQueueState === 'open' ? 'error' : governedQueueState === 'watching' ? 'neutral' : 'success'}
                  message={`${governedQueueLabel(governedQueueState)}${selectedStudent.nextDueAt ? ` · due ${formatDateTime(selectedStudent.nextDueAt)}` : ''}. Watching remains visible here but does not count as a blocking open case.`}
                />
              ) : null
            })()}
            <div data-proof-section="hod-student-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn
                  size="sm"
                  variant="ghost"
                  dataProofAction="hod-open-risk-explorer"
                  dataProofEntityId={selectedStudent.studentId}
                  onClick={() => onOpenRiskExplorer(selectedStudent.studentId)}
                >
                  Open Risk Explorer
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  dataProofAction="hod-open-student-shell"
                  dataProofEntityId={selectedStudent.studentId}
                  onClick={() => onOpenStudentShell(selectedStudent.studentId)}
                >
                  Open Student Shell
                </Btn>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <MetricCard label="Section" value={selectedStudent.sectionCode} helper="Current section in the active run." />
              <MetricCard label="Risk" value={`${selectedStudent.currentRiskBand} · ${selectedStudent.currentRiskProbScaled}%`} helper="Current risk band from the observable-only inference layer." />
              {selectedStudent.riskChangeFromPreviousCheckpointScaled != null ? (
                <MetricCard label="Risk Change" value={`${selectedStudent.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${selectedStudent.riskChangeFromPreviousCheckpointScaled}`} helper="Stage-to-stage risk delta from the selected playback checkpoint." />
              ) : null}
              {selectedStudent.counterfactualLiftScaled != null ? (
                <MetricCard label="Counterfactual Lift" value={`${selectedStudent.counterfactualLiftScaled > 0 ? '+' : ''}${selectedStudent.counterfactualLiftScaled}`} helper="Checkpoint replay lift over no-action." />
              ) : null}
              <MetricCard label="Attendance" value={formatPercent(selectedStudent.observedEvidence.attendancePct)} helper="Current observed attendance in the active semester slice." />
              <MetricCard label="Backlogs" value={String(selectedStudent.observedEvidence.backlogCount)} helper="Transcript-backed backlog count available in the active run context." />
              <MetricCard label="Weak COs" value={String(selectedStudent.observedEvidence.weakCoCount)} helper="Observed COs under the current support threshold." />
              <MetricCard label="Weak Questions" value={String(selectedStudent.observedEvidence.weakQuestionCount)} helper="Question-level weakness count in the active evidence window." />
            </div>

            <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
              <PanelLabel color={T.accent}>Observed</PanelLabel>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current evidence</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip color={T.accent}>{`TT1 ${formatPercent(selectedStudent.observedEvidence.tt1Pct)}`}</Chip>
                <Chip color={T.accent}>{`TT2 ${formatPercent(selectedStudent.observedEvidence.tt2Pct)}`}</Chip>
                <Chip color={T.success}>{`Quiz ${formatPercent(selectedStudent.observedEvidence.quizPct)}`}</Chip>
                <Chip color={T.warning}>{`Assignment ${formatPercent(selectedStudent.observedEvidence.assignmentPct)}`}</Chip>
                <Chip color={T.warning}>{`SEE ${formatPercent(selectedStudent.observedEvidence.seePct)}`}</Chip>
                <Chip color={T.muted}>{`CGPA ${selectedStudent.observedEvidence.cgpa.toFixed(2)}`}</Chip>
              </div>
              {selectedStudent.observedEvidence.interventionRecoveryStatus ? (
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                  Intervention recovery status: {selectedStudent.observedEvidence.interventionRecoveryStatus}.
                </div>
              ) : null}
              {selectedStudent.observedEvidence.coEvidenceMode ? (
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                  CO evidence mode: {selectedStudent.observedEvidence.coEvidenceMode}.
                </div>
              ) : null}
            </Card>

            <TableCard title="Course snapshots" caption="Course-specific watch rows available for this student in the active semester.">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH>Course</TH>
                    <TH>Risk</TH>
                    <TH>Attendance</TH>
                    <TH>Assessment Window</TH>
                    <TH>Recommended Action</TH>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudent.courseSnapshots.map(snapshot => (
                    <tr key={snapshot.riskAssessmentId}>
                      <TD>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{snapshot.courseCode}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{snapshot.courseTitle}</div>
                      </TD>
                      <TD><RiskBadge band={toRiskBand(snapshot.riskBand)} prob={snapshot.riskProbScaled / 100} /></TD>
                      <TD>{formatPercent(snapshot.observedEvidence.attendancePct)}</TD>
                      <TD>{`TT1 ${formatPercent(snapshot.observedEvidence.tt1Pct)} · TT2 ${formatPercent(snapshot.observedEvidence.tt2Pct)} · SEE ${formatPercent(snapshot.observedEvidence.seePct)}`}</TD>
                      <TD>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <div>{snapshot.recommendedAction}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {snapshot.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={snapshot.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : snapshot.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${snapshot.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${snapshot.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                            {snapshot.counterfactualLiftScaled != null ? <Chip color={snapshot.counterfactualLiftScaled > 0 ? T.success : snapshot.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${snapshot.counterfactualLiftScaled > 0 ? '+' : ''}${snapshot.counterfactualLiftScaled}`}</Chip> : null}
                            {snapshot.observedEvidence.coEvidenceMode ? <Chip color={T.dim}>{snapshot.observedEvidence.coEvidenceMode}</Chip> : null}
                          </div>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>

            <TableCard title="Semester evidence timeline" caption="Semester-grouped evidence windows already persisted for this student in the proof run.">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH>Semester</TH>
                    <TH>Section</TH>
                    <TH>Risk Bands</TH>
                    <TH>Evidence Windows</TH>
                    <TH>Updated</TH>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudent.evidenceTimeline.map(item => {
                    const riskBands = Array.isArray(item.observedState.riskBands)
                      ? item.observedState.riskBands.filter((value): value is string => typeof value === 'string')
                      : []
                    const evidenceWindowCount = typeof item.observedState.evidenceWindowCount === 'number'
                      ? item.observedState.evidenceWindowCount
                      : 1
                    return (
                      <tr key={item.studentObservedSemesterStateId}>
                        <TD>{`Sem ${item.semesterNumber}`}</TD>
                        <TD>{item.sectionCode}</TD>
                        <TD>{riskBands.length > 0 ? riskBands.join(', ') : 'Recorded'}</TD>
                        <TD>{evidenceWindowCount}</TD>
                        <TD>{formatDateTime(item.updatedAt)}</TD>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableCard>

            <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
              <PanelLabel color={T.success}>Policy Derived</PanelLabel>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Elective fit</div>
              {selectedStudent.electiveFit ? (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={T.success}>{selectedStudent.electiveFit.recommendedCode}</Chip>
                    <Chip color={T.accent}>{selectedStudent.electiveFit.stream}</Chip>
                    <Chip color={T.muted}>{selectedStudent.electiveFit.recommendedTitle}</Chip>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                    {selectedStudent.electiveFit.rationale.join(' · ')}
                  </div>
                </>
              ) : (
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>No elective recommendation is available for this student in the current proof run.</div>
              )}
            </Card>
          </div>
        </ModalWorkspace>
      ) : null}

      {selectedCourse ? (
        <ModalWorkspace
          eyebrow="Course Hotspot"
          title={`${selectedCourse.courseCode} · ${selectedCourse.title}`}
          caption="Read-only course rollup derived from live proof records for the active run."
          onClose={() => setSelectedCourseCode(null)}
          size="lg"
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <MetricCard label="Sections" value={selectedCourse.sectionCodes.join(', ') || 'NA'} helper="Sections carrying this course in the active semester." />
              <MetricCard label="Students" value={String(selectedCourse.studentCount)} helper="Distinct students represented in the current evidence slice." />
              <MetricCard label="Attendance" value={formatPercent(selectedCourse.averageAttendancePct)} helper="Average observed attendance across current evidence rows." />
              <MetricCard label="Reassessments" value={`${selectedCourse.openReassessmentCount} open`} helper={`${selectedCourse.resolvedReassessmentCount} resolved in the active run`} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={T.danger}>{`High watch ${selectedCourse.riskCountHigh}`}</Chip>
              <Chip color={T.warning}>{`Medium watch ${selectedCourse.riskCountMedium}`}</Chip>
              <Chip color={T.accent}>{`TT1 weak ${selectedCourse.tt1WeakCount}`}</Chip>
              <Chip color={T.accent}>{`TT2 weak ${selectedCourse.tt2WeakCount}`}</Chip>
              <Chip color={T.warning}>{`SEE weak ${selectedCourse.seeWeakCount}`}</Chip>
              <Chip color={T.warning}>{`Weak questions ${selectedCourse.weakQuestionSignalCount}`}</Chip>
              <Chip color={T.muted}>{`Backlog carryover ${selectedCourse.backlogCarryoverCount}`}</Chip>
            </div>
            <TableCard title="Linked student rows" caption="Students in the current HoD watchlist who carry this course as a risk-bearing snapshot.">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH>Student</TH>
                    <TH>Section</TH>
                    <TH>Risk</TH>
                    <TH>Attendance</TH>
                    <TH>TT Window</TH>
                    <TH>Open</TH>
                  </tr>
                </thead>
                <tbody>
                  {selectedCourseStudents.map(row => (
                    <tr key={row.studentId}>
                      <TD>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{row.studentName}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{row.usn}</div>
                      </TD>
                      <TD>{row.sectionCode}</TD>
                      <TD><RiskBadge band={toRiskBand(row.currentRiskBand)} prob={row.currentRiskProbScaled / 100} /></TD>
                      <TD>{formatPercent(row.observedEvidence.attendancePct)}</TD>
                      <TD>{`${formatPercent(row.observedEvidence.tt1Pct)} / ${formatPercent(row.observedEvidence.tt2Pct)}`}</TD>
                      <TD>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Btn size="sm" variant="ghost" onClick={() => setSelectedStudentId(row.studentId)}>Inspect Student</Btn>
                          <Btn
                            size="sm"
                            variant="ghost"
                            dataProofAction="hod-open-risk-explorer"
                            dataProofEntityId={row.studentId}
                            onClick={() => onOpenRiskExplorer(row.studentId)}
                          >
                            Risk Explorer
                          </Btn>
                          <Btn
                            size="sm"
                            variant="ghost"
                            dataProofAction="hod-open-student-shell"
                            dataProofEntityId={row.studentId}
                            onClick={() => onOpenStudentShell(row.studentId)}
                          >
                            Student Shell
                          </Btn>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        </ModalWorkspace>
      ) : null}

      {selectedFaculty ? (
        <ModalWorkspace
          eyebrow="Faculty Rollup"
          title={selectedFaculty.facultyName}
          caption="Faculty-level load and monitoring metrics visible in the current HoD proof scope."
          onClose={() => setSelectedFacultyId(null)}
          size="lg"
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <MetricCard label="Designation" value={selectedFaculty.designation} helper="Current faculty title from the proof-linked profile." />
              <MetricCard label="Weekly Load" value={formatHours(selectedFaculty.weeklyContactHours)} helper="Current semester contact-hour load projection." />
              <MetricCard label="Queue Load" value={String(selectedFaculty.queueLoad)} helper="In-scope queue burden derived from current proof records." />
              <MetricCard label="Closure Rate" value={`${selectedFaculty.reassessmentClosureRate}%`} helper="Resolved reassessments divided by relevant reassessment rows." />
            </div>
            <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
              <PanelLabel color={T.accent}>Observed</PanelLabel>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Faculty scope</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedFaculty.permissions.map(permission => <Chip key={permission} color={permission === 'HOD' ? T.warning : permission === 'MENTOR' ? T.success : T.accent}>{permission}</Chip>)}
                {selectedFaculty.assignedSections.map(section => <Chip key={section} color={sectionColor(section)}>{`Section ${section}`}</Chip>)}
                {selectedFaculty.overloadFlag ? <Chip color={T.danger}>Load threshold exceeded</Chip> : <Chip color={T.success}>Within load threshold</Chip>}
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                Average acknowledgement lag is {formatHours(selectedFaculty.avgAcknowledgementLagHours)} and the current intervention count is {selectedFaculty.interventionCount}.
              </div>
            </Card>
            <TableCard title="Relevant reassessment sample" caption="Run-scoped reassessment rows aligned to the visible faculty permissions.">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH>Student</TH>
                    <TH>Course</TH>
                    <TH>Assigned Role</TH>
                    <TH>Status</TH>
                    <TH>Due</TH>
                  </tr>
                </thead>
                <tbody>
                  {selectedFacultyReassessments.slice(0, 10).map(row => (
                    <tr key={row.reassessmentEventId}>
                      <TD>{row.studentName}</TD>
                      <TD>{row.courseCode}</TD>
                      <TD>{row.assignedToRole}</TD>
                      <TD>{row.status}</TD>
                      <TD>{formatDateTime(row.dueAt)}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        </ModalWorkspace>
      ) : null}
    </PageShell>
  )
}
