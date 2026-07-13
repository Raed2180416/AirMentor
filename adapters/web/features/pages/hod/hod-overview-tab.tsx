import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofStudentWatch, ApiAcademicHodProofSummary } from '@web/shared/api/types'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { Btn, Card, Chip, RiskBadge, TH, TD } from '@web/shared/ui/primitives'
import { EmptyState, SectionHeading } from '@web/features/admin/system-admin-ui'
import { PanelLabel, TableCard } from './hod-shared-components'
import {
  formatPercent,
  governedQueueColor,
  governedQueueLabel,
  resolveGovernedQueueState,
  sectionColor,
  toRiskBand,
} from './hod-helpers'

export function HodOverviewTab({
  summary,
  overviewStudents,
  showActionNeededOnly,
  setShowActionNeededOnly,
  overviewRiskFilter,
  setOverviewRiskFilter,
  setSelectedStudentId,
  onOpenRiskExplorer,
  onOpenStudentShell,
}: {
  summary: ApiAcademicHodProofSummary
  overviewStudents: ApiAcademicHodProofStudentWatch[]
  showActionNeededOnly: boolean
  setShowActionNeededOnly: React.Dispatch<React.SetStateAction<boolean>>
  overviewRiskFilter: 'all' | 'high' | 'medium'
  setOverviewRiskFilter: React.Dispatch<React.SetStateAction<'all' | 'high' | 'medium'>>
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string | null>>
  onOpenRiskExplorer: (studentId: string) => void
  onOpenStudentShell: (studentId: string) => void
}) {
  return (
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
        <TableCard title="Section Comparison" caption="Observed attendance, open reassessments, and deferred risk pressure by section.">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Section</TH>
                <TH>Students</TH>
                <TH>High</TH>
                <TH>Medium</TH>
                <TH>Attendance</TH>
                <TH>Open Reassessments</TH>
                <TH>Deferred</TH>
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
                  <TD>{row.deferredQueueCount ?? 0}</TD>
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
            <Chip color={T.accent}>{`${summary.totals.deferredQueueCount ?? 0} capacity deferred`}</Chip>
            <Chip color={T.success}>{`${summary.totals.resolvedAlertCount} resolved alerts`}</Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Sysadmin remains the owner of run lifecycle and proof governance. This HoD surface is read-only and shows only persisted audit outcomes.
          </div>
        </Card>
      </div>

      <TableCard
        title="Current Watchlist"
        caption="Priority rows by current risk probability. Action Needed keys off governed open cases; View All keeps Watching and Capacity Deferred rows visible without treating them as blocking work."
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
          <Btn
            size="sm"
            variant={overviewRiskFilter === 'all' ? 'primary' : 'ghost'}
            onClick={() => setOverviewRiskFilter('all')}
          >
            All Bands
          </Btn>
          <Btn
            size="sm"
            variant={overviewRiskFilter === 'high' ? 'primary' : 'ghost'}
            onClick={() => {
              setShowActionNeededOnly(false)
              setOverviewRiskFilter('high')
            }}
          >
            High Only
          </Btn>
          <Btn
            size="sm"
            variant={overviewRiskFilter === 'medium' ? 'primary' : 'ghost'}
            onClick={() => {
              setShowActionNeededOnly(false)
              setOverviewRiskFilter('medium')
            }}
          >
            Medium Only
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
              const governedQueueState = resolveGovernedQueueState(row.currentQueueState ?? row.currentReassessmentStatus)
              const actionNeeded = governedQueueState === 'open'
              const primaryAction = row.courseSnapshots.find(snapshot => snapshot.courseCode === row.primaryCourseCode)?.recommendedAction
                ?? row.courseSnapshots[0]?.recommendedAction
                ?? null
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
                      <Chip color={T.accent}>{humanLabelForActionCode(primaryAction) ?? 'No action'}</Chip>
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
  )
}
