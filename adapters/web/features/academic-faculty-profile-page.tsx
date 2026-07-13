import { type Offering } from '@web/simulation/fixtures'
import {
  type FacultyAccount,
  type FacultyTimetableTemplate,
  type Role,
} from '@kernel/shared/domain'
import type {
  ApiAcademicFacultyProfile,
  ApiAdminCalendarMarker,
} from '@web/shared/api/types'
import { type ProofPlaybackControlDirection } from '@web/simulation/proof-simulation-controls'
import { clearProofPlaybackSelection, writeProofPlaybackSelection } from '@web/simulation/proof-playback'
import { PageBackButton, PageShell } from '@web/shared/ui/primitives'
import { FacultyProofInlineControls } from './academic-faculty-profile/faculty-proof-inline-controls'
import { FacultyProfileHeader } from './academic-faculty-profile/faculty-profile-header'
import { FacultyProfileBanners } from './academic-faculty-profile/faculty-profile-banners'
import { FacultyIdentityCards } from './academic-faculty-profile/faculty-identity-cards'
import { FacultyScopeCards } from './academic-faculty-profile/faculty-scope-cards'
import { FacultyProofLauncher } from './academic-faculty-profile/faculty-proof-launcher'
import { FacultyProofPanel } from './academic-faculty-profile/faculty-proof-panel'

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
  onAdvanceProofRun?: (simulationRunId: string, mode: 'day' | 'previous-day' | 'stage') => void
  onStopProofRun?: (simulationRunId: string) => void
  onStepProofPlayback?: (direction: ProofPlaybackControlDirection) => void
}

export function FacultyProfilePage({
  activeRole,
  profile,
  calendarMarkers,
  loading,
  error,
  pendingTaskCount,
  onBack,
  onOpenStudentProfile,
  onOpenStudentShell,
  onOpenRiskExplorer,
  onAdvanceProofRun,
  onStopProofRun,
  onStepProofPlayback,
}: FacultyProfilePageProps) {
  const liveProfilePresent = profile != null
  const livePermissions = profile?.permissions.filter(item => item.status === 'active') ?? []
  const effectivePermissions = Array.from(new Set(livePermissions.map(item => item.roleCode)))
    .filter(permission => permission !== 'SYSTEM_ADMIN')
  const effectiveDepartment = profile?.primaryDepartment?.name ?? 'Not provisioned in the admin faculty record'
  const effectiveDesignation = profile?.designation?.trim() || 'Not provisioned in the admin faculty record'
  const effectiveEmail = profile?.email?.trim() || 'Not provisioned in the admin faculty record'
  const effectivePhone = profile?.phone?.trim() || 'Not set in the admin faculty record'
  const employeeCode = profile?.employeeCode?.trim() || 'Not provisioned in the admin faculty record'
  const displayName = profile?.displayName?.trim() || 'Not provisioned in the admin faculty record'
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
    .slice(0, 4)
  const activeRunCheckpoints = proofOps?.activeRunCheckpoints?.length
    ? proofOps.activeRunCheckpoints
    : selectedProofCheckpoint ? [selectedProofCheckpoint] : []
  const handleProofPlaybackStep = (direction: ProofPlaybackControlDirection) => {
    if (activeProofRun && selectedProofCheckpoint) {
      const targetCheckpointId = direction === 'previous'
        ? selectedProofCheckpoint.previousCheckpointId
        : direction === 'next'
          ? selectedProofCheckpoint.nextCheckpointId
          : direction === 'start'
            ? activeRunCheckpoints[0]?.simulationStageCheckpointId
            : null
      if (targetCheckpointId) {
        writeProofPlaybackSelection({
          simulationRunId: activeProofRun.simulationRunId,
          simulationStageCheckpointId: targetCheckpointId,
          updatedAt: new Date().toISOString(),
          workspace: 'academic',
          source: 'teacher-profile',
        })
      } else if (direction === 'end') {
        clearProofPlaybackSelection()
      }
    }
    onStepProofPlayback?.(direction)
  }

  return (
    <PageShell size="standard">
      <div style={{ display: 'grid', gap: 16, paddingTop: 18, paddingBottom: 26 }}>
        <PageBackButton onClick={onBack} />

        {proofOps && activeProofRun && onAdvanceProofRun ? (
          <FacultyProofInlineControls
            proofOps={proofOps}
            activeProofRun={activeProofRun}
            activeRunCheckpoints={activeRunCheckpoints}
            selectedProofCheckpoint={selectedProofCheckpoint}
            onAdvanceProofRun={onAdvanceProofRun}
            onStopProofRun={onStopProofRun}
            onStepProofPlayback={handleProofPlaybackStep}
          />
        ) : null}

        <FacultyProfileHeader
          displayName={displayName}
          activeRole={activeRole}
          effectivePermissions={effectivePermissions}
          effectiveDepartment={effectiveDepartment}
          effectiveDesignation={effectiveDesignation}
          employeeCode={employeeCode}
          effectiveEmail={effectiveEmail}
          effectivePhone={effectivePhone}
          proofQueueMetricLabel={proofQueueMetricLabel}
          proofQueueMetricValue={proofQueueMetricValue}
          proofQueueMetricHelper={proofQueueMetricHelper}
          scopeMetricLabel={scopeMetricLabel}
          scopeMetricValue={scopeMetricValue}
          scopeMetricHelper={scopeMetricHelper}
          displayNextReassessmentValue={displayNextReassessmentValue}
          displayNextReassessmentHelper={displayNextReassessmentHelper}
          proofOps={proofOps}
        />

        <FacultyProfileBanners
          liveProfilePresent={liveProfilePresent}
          proofOps={proofOps}
          loading={loading}
          error={error}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <FacultyIdentityCards
            effectivePermissions={effectivePermissions}
            profile={profile}
          />

          <FacultyScopeCards
            proofModeActive={proofModeActive}
            proofScopedOfferings={proofScopedOfferings}
            profile={profile}
            selectedProofCheckpoint={selectedProofCheckpoint}
            proofOps={proofOps}
            proofBatchContexts={proofBatchContexts}
            proofCourseLeaderScope={proofCourseLeaderScope}
            proofScopedStudentIds={proofScopedStudentIds}
            displayNextReassessmentValue={displayNextReassessmentValue}
            timetableWindow={timetableWindow}
            nextReassessmentWindow={nextReassessmentWindow}
            upcomingMarkers={upcomingMarkers}
          />

          <FacultyProofLauncher
            profile={profile}
            proofModeActive={proofModeActive}
            selectedProofCheckpoint={selectedProofCheckpoint}
            proofOps={proofOps}
            leadingProofQueueItem={leadingProofQueueItem}
          />
          <FacultyProofPanel
            proofOps={proofOps}
            proofModeActive={proofModeActive}
            selectedProofCheckpoint={selectedProofCheckpoint}
            activeProofRun={activeProofRun}
            activeRunCheckpoints={activeRunCheckpoints}
            leadingElectiveFit={leadingElectiveFit}
            leadingProofQueueItem={leadingProofQueueItem}
            onOpenStudentProfile={onOpenStudentProfile}
            onOpenStudentShell={onOpenStudentShell}
            onOpenRiskExplorer={onOpenRiskExplorer}
            onAdvanceProofRun={onAdvanceProofRun}
            onStopProofRun={onStopProofRun}
            onStepProofPlayback={handleProofPlaybackStep}
          />
        </div>
      </div>
    </PageShell>
  )
}
