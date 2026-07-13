import { minutesToDisplayLabel } from '@web/shared/state/calendar-utils'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAdminCalendarMarker } from '@web/shared/api/types'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { Card } from '@web/shared/ui/primitives'
import {
  describeCalendarMarkerType,
  formatDateLabel,
  type FacultyProfile,
  type ProofBatchContext,
  type ProofCheckpoint,
  type ProofCourseLeaderScopeItem,
  type ProofMonitoringItem,
  type ProofOps,
} from './profile-helpers'

type FacultyScopeCardsProps = {
  proofModeActive: boolean
  proofScopedOfferings: ProofMonitoringItem[]
  profile: FacultyProfile | null
  selectedProofCheckpoint: ProofCheckpoint | null
  proofOps: ProofOps | null
  proofBatchContexts: ProofBatchContext[]
  proofCourseLeaderScope: ProofCourseLeaderScopeItem[]
  proofScopedStudentIds: string[]
  displayNextReassessmentValue: string
  timetableWindow: string | null
  nextReassessmentWindow: string | null
  upcomingMarkers: ApiAdminCalendarMarker[]
}

export function FacultyScopeCards({
  proofModeActive,
  proofScopedOfferings,
  profile,
  selectedProofCheckpoint,
  proofOps,
  proofBatchContexts,
  proofCourseLeaderScope,
  proofScopedStudentIds,
  displayNextReassessmentValue,
  timetableWindow,
  nextReassessmentWindow,
  upcomingMarkers,
}: FacultyScopeCardsProps) {
  return (
    <>
      <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Teaching Scope</div>
        {(proofModeActive && proofScopedOfferings.length > 0 ? proofScopedOfferings.map(item => ({
          key: item.offeringId || `${item.courseCode}:${item.sectionCode ?? 'NA'}`,
          title: `${item.courseCode} · ${item.courseTitle}`,
          meta: `Checkpoint-bound · Section ${item.sectionCode ?? 'NA'} · ${item.riskBand} · ${item.riskProbScaled}% · ${humanLabelForActionCode(item.recommendedAction) ?? 'No action'}`,
        })) : profile?.currentOwnedClasses?.length ? profile.currentOwnedClasses.map(item => ({
          key: item.offeringId,
          title: `${item.courseCode} · ${item.title}`,
          meta: `${item.yearLabel} · Section ${item.sectionCode} · ${item.ownershipRole}${item.branchName ? ` · ${item.branchName}` : ''}`,
        })) : []).slice(0, 8).map(item => (
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
        ) : !profile?.currentOwnedClasses?.length ? <div style={{ ...mono, fontSize: 10, color: T.muted }}>No admin-managed class ownership is mapped for this faculty profile yet.</div> : null}
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
            : `Mentor scope: ${profile?.mentorScope.activeStudentCount ?? 0} active students`}
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
        <div style={{ ...mono, fontSize: 10, color: T.text }}>Timetable template: {profile?.timetableStatus.hasTemplate ? 'Configured' : 'Not configured'}</div>
        <div style={{ ...mono, fontSize: 10, color: T.text }}>Direct edit window: {timetableWindow ?? 'Unavailable in current mode'}</div>
        <div style={{ ...mono, fontSize: 10, color: T.text }}>Open reassessments: {profile?.reassessmentSummary?.openCount ?? 0}</div>
        <div style={{ ...mono, fontSize: 10, color: T.text }}>Next reassessment due: {nextReassessmentWindow ?? 'None'}</div>
        {profile?.requestSummary ? (
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            {profile.requestSummary.openCount} linked governed requests. Recent: {profile.requestSummary.recent.map(item => `${item.summary} (${item.status})`).join(' · ') || 'none'}.
          </div>
        ) : (
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Timetable governance, mentor scope, and request ledgers are unavailable until the admin-managed faculty profile is provisioned.
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
    </>
  )
}
