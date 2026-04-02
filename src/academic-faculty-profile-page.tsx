import { minutesToDisplayLabel } from './calendar-utils'
import { T, mono, sora, type Offering } from './data'
import {
  type FacultyAccount,
  type FacultyTimetableTemplate,
  type Role,
} from './domain'
import type {
  ApiAcademicFacultyProfile,
  ApiAdminCalendarMarker,
} from './api/types'
import { describeProofAvailability, describeProofProvenance } from './proof-provenance'
import { ProofSurfaceHero, ProofSurfaceLauncher } from './proof-surface-shell'
import { InfoBanner, MetricCard } from './system-admin-ui'
import {
  Btn,
  Card,
  Chip,
  PageBackButton,
  PageShell,
  withAlpha,
} from './ui-primitives'

const subtleDividerStyle = {
  height: 1,
  background: `linear-gradient(90deg, transparent, ${withAlpha(T.border2, '26')} 14%, ${withAlpha(T.border2, '62')} 50%, ${withAlpha(T.border2, '26')} 86%, transparent)`,
  opacity: 0.9,
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'Not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function describeCalendarMarkerType(markerType: ApiAdminCalendarMarker['markerType']) {
  if (markerType === 'semester-start') return 'Semester Start'
  if (markerType === 'semester-end') return 'Semester End'
  if (markerType === 'term-test-start') return 'Term Test Start'
  if (markerType === 'term-test-end') return 'Term Test End'
  if (markerType === 'holiday') return 'Holiday'
  return 'Event'
}

export type FacultyProfilePageProps = {
  currentTeacher: FacultyAccount
  activeRole: Role
  profile: ApiAcademicFacultyProfile | null
  calendarMarkers: ApiAdminCalendarMarker[]
  loading: boolean
  error: string
  pendingTaskCount: number
  assignedOfferings: Offering[]
  currentFacultyTimetable: FacultyTimetableTemplate | null
  onBack: () => void
  onOpenStudentProfile: (studentId: string, offeringId?: string | null) => void
  onOpenStudentShell: (studentId: string) => void
  onOpenRiskExplorer: (studentId: string) => void
}

export function FacultyProfilePage({
  currentTeacher,
  activeRole,
  profile,
  calendarMarkers,
  loading,
  error,
  pendingTaskCount,
  assignedOfferings,
  currentFacultyTimetable,
  onBack,
  onOpenStudentProfile,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: FacultyProfilePageProps) {
  const livePermissions = profile?.permissions.filter(item => item.status === 'active') ?? []
  const effectivePermissions = (livePermissions.length > 0
    ? Array.from(new Set(livePermissions.map(item => item.roleCode)))
    : currentTeacher.allowedRoles
  ).filter(permission => permission !== 'SYSTEM_ADMIN')
  const effectiveDepartment = profile?.primaryDepartment?.name ?? currentTeacher.dept
  const effectivePhone = profile?.phone ?? 'Not set'
  const employeeCode = profile?.employeeCode ?? 'Not available'
  const proofOps = profile?.proofOperations ?? null
  const proofModeActive = proofOps?.scopeMode === 'proof'
  const activeProofRun = proofOps?.activeRunContexts[0] ?? null
  const selectedProofCheckpoint = proofOps?.selectedCheckpoint ?? null
  const leadingProofQueueItem = proofOps?.monitoringQueue[0] ?? null
  const leadingElectiveFit = proofOps?.electiveFits[0] ?? null
  const proofScopedStudentIds = Array.from(new Set([
    ...(proofOps?.monitoringQueue.map(item => item.studentId) ?? []),
    ...(proofOps?.electiveFits.map(item => item.studentId) ?? []),
  ])).sort((left, right) => left.localeCompare(right))
  const proofScopedOfferings = Array.from(new Map(
    (proofOps?.monitoringQueue ?? []).map(item => [
      item.offeringId || `${item.courseCode}:${item.sectionCode ?? 'NA'}`,
      item,
    ] as const),
  ).values())
  const proofRoleCoverage = Array.from(new Set([
    ...(proofScopedOfferings.length > 0 ? ['COURSE_LEADER'] : []),
    ...(proofScopedStudentIds.length > 0 ? ['MENTOR'] : []),
    ...(activeRole === 'HoD' ? ['HOD'] : []),
  ]))
  const proofSemesterLabel = selectedProofCheckpoint?.semesterNumber ?? proofOps?.activeOperationalSemester ?? 'NA'
  const proofBatchContexts = proofModeActive
    ? [{
        batchId: activeProofRun?.batchId ?? proofOps?.scopeDescriptor.batchId ?? 'proof-scope',
        batchLabel: activeProofRun?.batchLabel ?? proofOps?.scopeDescriptor.label ?? 'Proof scope',
        branchName: activeProofRun?.branchName ?? proofOps?.scopeDescriptor.branchName ?? null,
        currentSemester: Number(selectedProofCheckpoint?.semesterNumber ?? proofOps?.activeOperationalSemester ?? 0),
        sectionCodes: Array.from(new Set([
          ...(proofScopedOfferings.map(item => item.sectionCode).filter((value): value is string => !!value)),
          ...(proofOps?.scopeDescriptor.sectionCode ? [proofOps.scopeDescriptor.sectionCode] : []),
        ])).sort((left, right) => left.localeCompare(right)),
        roleCoverage: proofRoleCoverage.length > 0 ? proofRoleCoverage : [activeRole === 'Course Leader' ? 'COURSE_LEADER' : activeRole === 'Mentor' ? 'MENTOR' : 'HOD'],
      }]
    : []
  const proofCourseLeaderScope = Array.from(new Map(
    proofScopedOfferings.map(item => {
      const subjectRunId = `${item.courseCode}:${item.courseTitle}`
      return [subjectRunId, {
        subjectRunId,
        courseCode: item.courseCode,
        title: item.courseTitle,
        yearLabel: `Semester ${proofSemesterLabel}`,
        sectionCodes: new Set([item.sectionCode ?? 'NA']),
      }] as const
    }),
  ).values()).map(item => ({
    ...item,
    sectionCodes: Array.from(item.sectionCodes).sort((left, right) => left.localeCompare(right)),
  }))
  const proofNextDueAt = (proofOps?.monitoringQueue ?? [])
    .map(item => item.dueAt)
    .filter((value): value is string => !!value)
    .sort()[0] ?? null
  const proofQueueMetricLabel = proofModeActive ? 'Proof Queue Items' : 'Queue Items'
  const proofQueueMetricValue = String(proofModeActive ? (proofOps?.monitoringQueue.length ?? 0) : pendingTaskCount)
  const proofQueueMetricHelper = proofModeActive
    ? 'Checkpoint-bound monitoring items for this faculty proof scope.'
    : 'Current action queue count for this faculty context.'
  const scopeMetricLabel = proofModeActive ? 'Monitored Students' : 'Batch Contexts'
  const scopeMetricValue = String(proofModeActive ? proofScopedStudentIds.length : (profile?.currentBatchContexts.length ?? 0))
  const scopeMetricHelper = proofModeActive
    ? 'Distinct students represented in the selected proof queue or elective-fit scope.'
    : 'Active year or section scopes connected to teaching and mentoring.'
  const timetableWindow = profile?.timetableStatus.directEditWindowEndsAt
    ? new Date(profile.timetableStatus.directEditWindowEndsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const nextReassessmentWindow = profile?.reassessmentSummary?.nextDueAt
    ? new Date(profile.reassessmentSummary.nextDueAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const displayNextReassessmentValue = proofModeActive
    ? (proofNextDueAt ? new Date(proofNextDueAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'None')
    : (nextReassessmentWindow ?? 'None')
  const displayNextReassessmentHelper = proofModeActive
    ? 'Earliest checkpoint-bound follow-up due in the active proof scope.'
    : 'Earliest governed reassessment due in the active faculty scope.'
  const upcomingMarkers = [...calendarMarkers]
    .sort((left, right) => {
      if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
      return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    })
    .slice(0, 5)
  const displayPermission = (permission: string) => {
    if (permission === 'COURSE_LEADER') return 'Course Leader'
    if (permission === 'SYSTEM_ADMIN') return 'System Admin'
    if (permission === 'HOD') return 'HoD'
    if (permission === 'MENTOR') return 'Mentor'
    return permission
  }

  return (
    <PageShell size="standard">
      <div style={{ display: 'grid', gap: 16, paddingTop: 18, paddingBottom: 26 }}>
        <PageBackButton onClick={onBack} />

        <Card style={{ padding: 20, display: 'grid', gap: 14, background: `linear-gradient(160deg, ${T.surface}, ${T.surface2})` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Teaching Profile</div>
              <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 8 }}>{profile?.displayName ?? currentTeacher.name}</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
                Inspect-first faculty profile powered by the system-admin master record when available. Operational edits still happen in their existing teaching or admin workflows.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={T.accent}>{activeRole}</Chip>
              {effectivePermissions.map(permission => <Chip key={permission} color={T.success}>{permission}</Chip>)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <MetricCard label="Primary Department" value={effectiveDepartment} helper="Current teaching-side home context." />
            <MetricCard label="Designation" value={profile?.designation ?? currentTeacher.roleTitle} helper="Admin-managed teaching title and academic responsibility label." />
            <MetricCard label="Employee Code" value={employeeCode} helper="Read-only faculty identity key from the admin master record." />
            <MetricCard label="Email" value={profile?.email ?? currentTeacher.email} helper="Read-only identity field from the faculty record." />
            <MetricCard label="Phone" value={effectivePhone} helper="Shown here so faculty can verify admin-owned contact data." />
            <MetricCard label={proofQueueMetricLabel} value={proofQueueMetricValue} helper={proofQueueMetricHelper} />
            <MetricCard label={scopeMetricLabel} value={scopeMetricValue} helper={scopeMetricHelper} />
            <MetricCard label="Next Reassessment" value={displayNextReassessmentValue} helper={displayNextReassessmentHelper} />
            <MetricCard label="Active Proof Runs" value={String(proofOps?.activeRunContexts.length ?? 0)} helper="Simulation runs currently linked to this faculty context." />
            <MetricCard label="Proof Queue" value={String(proofOps?.monitoringQueue.length ?? 0)} helper="Observed-only risk items available for review and follow-up." />
            <MetricCard label="Elective Fits" value={String(proofOps?.electiveFits.length ?? 0)} helper="Semester-6 elective recommendations derived from observed performance." />
          </div>
        </Card>

        {proofOps ? (
          <div data-proof-section="proof-mode-authority">
            <InfoBanner message="Proof mode is active. Use the Proof Control Plane, Risk Explorer, and Student Shell for checkpoint-bound evidence. Proof-aware summary and scope cards on this page now stay aligned to the selected checkpoint; permissions, appointments, and timetable-governance details remain operational context." />
            <InfoBanner tone="neutral" message={describeProofProvenance(proofOps)} />
            <InfoBanner tone="neutral" message={describeProofAvailability(proofOps)} />
          </div>
        ) : null}

        {loading ? <InfoBanner message="Loading faculty profile..." /> : null}
        {error ? <InfoBanner tone="error" message={error} /> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Permissions</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {effectivePermissions.length > 0 ? effectivePermissions.map(permission => <Chip key={permission} color={T.accent}>{displayPermission(permission)}</Chip>) : <Chip color={T.dim}>No permissions</Chip>}
            </div>
            {profile?.permissions?.filter(permission => permission.roleCode !== 'SYSTEM_ADMIN').length ? profile.permissions.filter(permission => permission.roleCode !== 'SYSTEM_ADMIN').map(permission => (
              <Card key={permission.grantId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{displayPermission(permission.roleCode)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  {(permission.scopeLabel ?? `${permission.scopeType}:${permission.scopeId}`)} · {formatDateLabel(permission.startDate)} to {permission.endDate ? formatDateLabel(permission.endDate) : 'Active'} · {permission.status}
                </div>
              </Card>
            )) : null}
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              HoD, mentor, and course-leader visibility now comes from the same admin-managed permission source instead of separate mock-only assumptions.
            </div>
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Appointments</div>
            {profile?.appointments?.length ? profile.appointments.map(appointment => (
              <Card key={appointment.appointmentId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>
                  {appointment.departmentName ?? appointment.departmentCode ?? appointment.departmentId}
                  {appointment.branchName ?? appointment.branchCode ?? appointment.branchId ? ` · ${appointment.branchName ?? appointment.branchCode ?? appointment.branchId}` : ''}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  {appointment.isPrimary ? 'Primary appointment' : 'Supporting appointment'} · {formatDateLabel(appointment.startDate)} to {appointment.endDate ? formatDateLabel(appointment.endDate) : 'Active'} · {appointment.status}
                </div>
              </Card>
            )) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No explicit appointment projection available in the current mode.</div>
            )}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Teaching Scope</div>
            {(proofModeActive && proofScopedOfferings.length > 0 ? proofScopedOfferings.map(item => ({
              key: item.offeringId || `${item.courseCode}:${item.sectionCode ?? 'NA'}`,
              title: `${item.courseCode} · ${item.courseTitle}`,
              meta: `Checkpoint-bound · Section ${item.sectionCode ?? 'NA'} · ${item.riskBand} · ${item.riskProbScaled}% · ${item.recommendedAction}`,
            })) : profile?.currentOwnedClasses?.length ? profile.currentOwnedClasses.map(item => ({
              key: item.offeringId,
              title: `${item.courseCode} · ${item.title}`,
              meta: `${item.yearLabel} · Section ${item.sectionCode} · ${item.ownershipRole}${item.branchName ? ` · ${item.branchName}` : ''}`,
            })) : assignedOfferings.map(item => ({
              key: item.offId,
              title: `${item.code} · ${item.title}`,
              meta: `${item.year} · Section ${item.section}`,
            }))).slice(0, 8).map(item => (
              <Card key={item.key} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.meta}</div>
              </Card>
            ))}
            {proofModeActive ? (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                {proofScopedOfferings.length > 0
                  ? `Checkpoint-bound teaching scope across ${proofScopedOfferings.length} monitored offering${proofScopedOfferings.length === 1 ? '' : 's'} in semester ${selectedProofCheckpoint?.semesterNumber ?? proofOps?.activeOperationalSemester ?? 'NA'}.`
                  : 'No checkpoint-bound monitored offerings are currently linked to this profile.'}
              </div>
            ) : assignedOfferings.length === 0 && !profile?.currentOwnedClasses?.length ? <div style={{ ...mono, fontSize: 10, color: T.muted }}>No current class ownership is mapped in this mode.</div> : null}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Current Batch Context</div>
            {(proofModeActive && proofBatchContexts.length > 0 ? proofBatchContexts : profile?.currentBatchContexts ?? []).length ? (proofModeActive && proofBatchContexts.length > 0 ? proofBatchContexts : profile?.currentBatchContexts ?? []).map(batchContext => (
              <Card key={batchContext.batchId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{batchContext.batchLabel}{batchContext.branchName ? ` · ${batchContext.branchName}` : ''}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  Semester {batchContext.currentSemester} · Sections {batchContext.sectionCodes.join(', ')} · {batchContext.roleCoverage.join(', ')}
                </div>
              </Card>
            )) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No batch context is currently mapped for this faculty profile.</div>
            )}
            {proofModeActive ? (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                Checkpoint-bound batch context derived from the active proof scope.
              </div>
            ) : null}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Course Leader Scope</div>
            {(proofModeActive && proofCourseLeaderScope.length > 0 ? proofCourseLeaderScope : profile?.subjectRunCourseLeaderScope?.slice(0, 8) ?? []).length ? (proofModeActive && proofCourseLeaderScope.length > 0 ? proofCourseLeaderScope : profile?.subjectRunCourseLeaderScope?.slice(0, 8) ?? []).map(subjectRun => (
              <Card key={subjectRun.subjectRunId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{subjectRun.courseCode} · {subjectRun.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{subjectRun.yearLabel} · Sections {subjectRun.sectionCodes.join(', ')}</div>
              </Card>
            )) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No subject-run course-leader scope is currently assigned.</div>
            )}
            {proofModeActive ? (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                Checkpoint-bound course-leader scope derived from monitored proof offerings.
              </div>
            ) : null}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Mentoring And Timetable</div>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>
              {proofModeActive
                ? `Checkpoint proof scope: ${proofScopedStudentIds.length} monitored student${proofScopedStudentIds.length === 1 ? '' : 's'}`
                : `Mentor scope: ${profile?.mentorScope.activeStudentCount ?? currentTeacher.menteeIds.length} active students`}
            </div>
            {proofModeActive ? (
              <>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>Proof queue items: {proofOps?.monitoringQueue.length ?? 0}</div>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>Elective-fit students: {proofOps?.electiveFits.length ?? 0}</div>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>Next proof follow-up due: {displayNextReassessmentValue}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                  Operational timetable publishing and governed-request details remain below; the counts above are derived from the active proof checkpoint or run.
                </div>
              </>
            ) : null}
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Timetable template: {(profile?.timetableStatus.hasTemplate ?? !!currentFacultyTimetable) ? 'Configured' : 'Not configured'}</div>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Direct edit window: {timetableWindow ?? 'Unavailable in current mode'}</div>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Open reassessments: {profile?.reassessmentSummary?.openCount ?? 0}</div>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Next reassessment due: {nextReassessmentWindow ?? 'None'}</div>
            {profile?.requestSummary ? (
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                {profile.requestSummary.openCount} linked governed requests. Recent: {profile.requestSummary.recent.map(item => `${item.summary} (${item.status})`).join(' · ') || 'none'}.
              </div>
            ) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                Timetable and request summaries fall back to local teaching context when the live academic profile endpoint is not in use.
              </div>
            )}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Institution Calendar</div>
            {upcomingMarkers.length > 0 ? upcomingMarkers.map(marker => (
              <Card key={marker.markerId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{describeCalendarMarkerType(marker.markerType)} · {marker.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  {formatDateLabel(marker.dateISO)}{marker.endDateISO ? ` to ${formatDateLabel(marker.endDateISO)}` : ''}{marker.allDay ? ' · All day' : marker.startMinutes != null && marker.endMinutes != null ? ` · ${minutesToDisplayLabel(marker.startMinutes)} - ${minutesToDisplayLabel(marker.endMinutes)}` : ''}
                </div>
                {marker.note ? <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{marker.note}</div> : null}
              </Card>
            )) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                No institutional semester markers, holidays, term-test windows, or events are currently mapped for this faculty calendar.
              </div>
            )}
          </Card>

          <ProofSurfaceLauncher
            targetId="teacher-proof-panel-surface"
            label="Jump to teacher proof controls"
            dataProofEntityId={currentTeacher.facultyId}
          />
          <ProofSurfaceHero
            surface="teacher-proof-panel"
            entityId={selectedProofCheckpoint?.simulationStageCheckpointId ?? undefined}
            eyebrow="Proof Control Plane"
            title="Proof Control Plane"
            description="This panel only surfaces rerunnable proof data: active simulation runs, observed risk queue items, and elective-fit summaries. It does not expose latent-state internals."
            notices={(
              <div data-proof-section="proof-authority-note" style={{ display: 'grid', gap: 8 }}>
                <InfoBanner message="Authoritative proof panel for this faculty scope. Use this card and the linked proof routes for checkpoint-bound evidence; nearby summary and scope cards stay checkpoint-bound where possible, while permissions, appointments, and timetable-governance details remain operational context." />
                {proofOps ? <InfoBanner tone="neutral" message={describeProofProvenance(proofOps)} /> : null}
              </div>
            )}
          >
            {proofOps ? (
              <>
                <div style={{ display: 'grid', gap: 10, minHeight: 320, alignContent: 'start' }}>
                  <Card data-proof-section="active-run-contexts" style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>Active run contexts</div>
                    {proofOps.activeRunContexts.length > 0 ? proofOps.activeRunContexts.slice(0, 3).map(run => (
                      <div key={run.simulationRunId} style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                        {run.batchLabel} · {run.runLabel} · {run.status} · Seed {run.seed} · Created {formatDateLabel(run.createdAt)}
                      </div>
                    )) : (
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>No active run is linked to this faculty context.</div>
                    )}
                  </Card>

                  {selectedProofCheckpoint ? (
                    <Card
                      data-proof-section="checkpoint-overlay"
                      data-proof-entity-id={selectedProofCheckpoint.simulationStageCheckpointId}
                      style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}
                    >
                      <div style={{ ...mono, fontSize: 10, color: T.text }}>Checkpoint overlay</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                        Sem {selectedProofCheckpoint.semesterNumber} · {selectedProofCheckpoint.stageLabel} · {selectedProofCheckpoint.stageDescription}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Chip color={T.warning}>{`${selectedProofCheckpoint.highRiskCount ?? 0} high watch`}</Chip>
                        <Chip color={T.accent}>{`${selectedProofCheckpoint.openQueueCount ?? 0} open queue`}</Chip>
                        {selectedProofCheckpoint.stageAdvanceBlocked ? <Chip color={T.danger}>Stage blocked</Chip> : null}
                        {selectedProofCheckpoint.blockedProgressionReason ? <Chip color={T.dim}>{selectedProofCheckpoint.blockedProgressionReason}</Chip> : null}
                      </div>
                    </Card>
                  ) : null}

                  <Card data-proof-section="monitoring-queue" style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>Monitoring queue</div>
                    {proofOps.monitoringQueue.length > 0 ? proofOps.monitoringQueue.slice(0, 3).map(item => (
                      <div key={item.riskAssessmentId} style={{ display: 'grid', gap: 8 }}>
                        <div style={subtleDividerStyle} aria-hidden="true" />
                        <div
                          data-proof-row="teacher-monitoring-item"
                          data-proof-student-id={item.studentId}
                          style={{ display: 'grid', gap: 4 }}
                        >
                          <div style={{ ...mono, fontSize: 10, color: T.text }}>
                            {item.studentName} · {item.courseCode} · {item.riskBand} · {item.recommendedAction}
                          </div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                            Evidence: attendance {item.observedEvidence.attendancePct}%, TT1 {item.observedEvidence.tt1Pct}%, TT2 {item.observedEvidence.tt2Pct}%, quiz {item.observedEvidence.quizPct}%, assignment {item.observedEvidence.assignmentPct}%, SEE {item.observedEvidence.seePct}%, weak COs {item.observedEvidence.weakCoCount}, weak questions {item.observedEvidence.weakQuestionCount}, CGPA {item.observedEvidence.cgpa}, backlogs {item.observedEvidence.backlogCount}.
                          </div>
                          {item.observedEvidence.interventionRecoveryStatus ? (
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>
                              Intervention recovery status: {item.observedEvidence.interventionRecoveryStatus}.
                            </div>
                          ) : null}
                          {item.observedEvidence.coEvidenceMode ? (
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>
                              CO evidence mode: {item.observedEvidence.coEvidenceMode}.
                            </div>
                          ) : null}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {item.drivers.slice(0, 3).map(driver => (
                              <Chip key={`${item.riskAssessmentId}-${driver.feature}`} color={driver.impact >= 0 ? T.danger : T.success}>{driver.label}</Chip>
                            ))}
                            {item.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={item.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : item.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${item.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${item.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                            {item.counterfactualLiftScaled != null ? <Chip color={item.counterfactualLiftScaled > 0 ? T.success : item.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${item.counterfactualLiftScaled > 0 ? '+' : ''}${item.counterfactualLiftScaled}`}</Chip> : null}
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="teacher-proof-open-partial-profile"
                              dataProofEntityId={item.studentId}
                              onClick={() => onOpenStudentProfile(item.studentId, item.offeringId)}
                            >
                              Open Student
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="teacher-proof-open-risk-explorer"
                              dataProofEntityId={item.studentId}
                              onClick={() => onOpenRiskExplorer(item.studentId)}
                            >
                              Open Risk Explorer
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="teacher-proof-open-student-shell"
                              dataProofEntityId={item.studentId}
                              onClick={() => onOpenStudentShell(item.studentId)}
                            >
                              Open Student Shell
                            </Btn>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>No governed queue items are currently linked to this profile.</div>
                    )}
                  </Card>

                  <Card data-proof-section="elective-fit" style={{ padding: 10, background: T.surface2, display: 'grid', gap: 6 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>Semester-6 elective fit</div>
                    {leadingElectiveFit ? (
                      <>
                        <div style={{ ...mono, fontSize: 10, color: T.text }}>
                          {leadingElectiveFit.studentName} · {leadingElectiveFit.recommendedCode} · {leadingElectiveFit.recommendedTitle}
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
                          Stream {leadingElectiveFit.stream}. Rationale: {leadingElectiveFit.rationale.slice(0, 3).join(' · ') || 'Observed performance and prerequisite fit.'}
                        </div>
                        <div
                          data-proof-row="teacher-elective-fit"
                          data-proof-student-id={leadingElectiveFit.studentId}
                          style={{ display: 'flex', justifyContent: 'flex-end' }}
                        >
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="teacher-proof-open-partial-profile"
                              dataProofEntityId={leadingElectiveFit.studentId}
                              onClick={() => onOpenStudentProfile(leadingElectiveFit.studentId)}
                            >
                              Open Student
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="teacher-proof-open-risk-explorer"
                              dataProofEntityId={leadingElectiveFit.studentId}
                              onClick={() => onOpenRiskExplorer(leadingElectiveFit.studentId)}
                            >
                              Open Risk Explorer
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="teacher-proof-open-student-shell"
                              dataProofEntityId={leadingElectiveFit.studentId}
                              onClick={() => onOpenStudentShell(leadingElectiveFit.studentId)}
                            >
                              Open Student Shell
                            </Btn>
                          </div>
                        </div>
                        {leadingElectiveFit.alternatives.length > 0 ? (
                          <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                            Alternatives: {leadingElectiveFit.alternatives.slice(0, 3).map(option => option.code).join(' · ')}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>No elective recommendation is currently available for this profile.</div>
                    )}
                  </Card>

                  {activeProofRun ? (
                    <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                      Active proof context: {activeProofRun.batchLabel} · {activeProofRun.runLabel} · {activeProofRun.status} · {activeProofRun.branchName ?? 'Branch unavailable'}.
                    </div>
                  ) : null}
                  {selectedProofCheckpoint ? (
                    <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>
                      Stage overlay active: semester {selectedProofCheckpoint.semesterNumber}, {selectedProofCheckpoint.stageLabel}. This read-only view is aligned to the sysadmin playback checkpoint{selectedProofCheckpoint.stageAdvanceBlocked ? ' and is currently blocked for forward progression.' : ''}.
                    </div>
                  ) : null}
                  {leadingProofQueueItem ? (
                    <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>
                      Latest queue item: {leadingProofQueueItem.studentName} in {leadingProofQueueItem.courseCode} is marked {leadingProofQueueItem.riskBand} with a follow-up window of {leadingProofQueueItem.dueAt ? formatDateLabel(leadingProofQueueItem.dueAt) : 'unspecified'}.
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof sandbox is attached to this faculty profile yet.</div>
            )}
          </ProofSurfaceHero>
        </div>
      </div>
    </PageShell>
  )
}
