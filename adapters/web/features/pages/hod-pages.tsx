import { useMemo, useState } from 'react'
import type { Offering, Student } from '@web/simulation/fixtures'
import type { CalendarAuditEvent, SharedTask } from '@kernel/shared/domain'
import type {
  ApiAcademicHodProofCourseRollup,
  ApiAcademicHodProofFacultyRollup,
  ApiAcademicHodProofReassessment,
  ApiAcademicHodProofStudentWatch,
  ApiAcademicHodProofSummary,
} from '@web/shared/api/types'
import { ProofSurfaceTabPanel, ProofSurfaceTabs } from '@web/simulation/proof-surface-shell'
import { PageShell } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner } from '@web/features/admin/system-admin-ui'
import { resolveGovernedQueueState, toRiskBand, type HodTabId } from './hod/hod-helpers'
import { HodProofHeader } from './hod/hod-proof-header'
import { HodMetrics } from './hod/hod-metrics'
import { HodOverviewTab } from './hod/hod-overview-tab'
import { HodCoursesTab } from './hod/hod-courses-tab'
import { HodFacultyTab } from './hod/hod-faculty-tab'
import { HodReassessmentsTab } from './hod/hod-reassessments-tab'
import { HodStudentModal } from './hod/hod-student-modal'
import { HodCourseModal } from './hod/hod-course-modal'
import { HodFacultyModal } from './hod/hod-faculty-modal'

export function HodView({
  onOpenQueueHistory,
  onOpenStudentShell,
  onOpenRiskExplorer,
  onRecomputeProofRunRisk,
  summary,
  courseRollups,
  facultyRollups,
  studentWatchRows,
  reassessmentRows,
  loading,
  error,
  counterfactualPanel,
}: {
  onOpenQueueHistory: () => void
  onOpenCourse: (offering: Offering) => void
  onOpenStudent: (student: Student, offering?: Offering) => void
  onOpenStudentShell: (studentId: string) => void
  onOpenRiskExplorer: (studentId: string) => void
  onRecomputeProofRunRisk?: (runId: string, opts?: { refreshWorkspace?: boolean }) => Promise<void> | void
  tasks: SharedTask[]
  calendarAuditEvents: CalendarAuditEvent[]
  summary: ApiAcademicHodProofSummary | null
  courseRollups: ApiAcademicHodProofCourseRollup[]
  facultyRollups: ApiAcademicHodProofFacultyRollup[]
  studentWatchRows: ApiAcademicHodProofStudentWatch[]
  reassessmentRows: ApiAcademicHodProofReassessment[]
  loading: boolean
  error: string
  counterfactualPanel?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<HodTabId>('overview')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null)
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null)
  const [showActionNeededOnly, setShowActionNeededOnly] = useState(true)
  const [overviewRiskFilter, setOverviewRiskFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [facultyFilter, setFacultyFilter] = useState<'all' | 'overloaded'>('all')

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
    let rows = studentWatchRows
    if (showActionNeededOnly) {
      rows = rows.filter(row => resolveGovernedQueueState(row.currentReassessmentStatus) === 'open')
    }
    if (overviewRiskFilter === 'high') {
      rows = rows.filter(row => toRiskBand(row.currentRiskBand) === 'High')
    } else if (overviewRiskFilter === 'medium') {
      rows = rows.filter(row => toRiskBand(row.currentRiskBand) === 'Medium')
    }
    return rows
  }, [overviewRiskFilter, showActionNeededOnly, studentWatchRows])

  const visibleFacultyRollups = useMemo(() => (
    facultyFilter === 'overloaded'
      ? facultyRollups.filter(row => row.overloadFlag)
      : facultyRollups
  ), [facultyFilter, facultyRollups])

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

  const activeRunContext = summary.activeRunContext
  const proofProvenanceSummary: ApiAcademicHodProofSummary = summary

  return (
    <PageShell size="wide">
      <div style={{ display: 'grid', gap: 18, paddingBottom: 24 }}>
        <HodProofHeader
          summary={summary}
          activeRunContext={activeRunContext}
          checkpointContext={checkpointContext}
          proofProvenanceSummary={proofProvenanceSummary}
          onOpenQueueHistory={onOpenQueueHistory}
          onRecomputeProofRunRisk={onRecomputeProofRunRisk}
        />

        <HodMetrics
          summary={summary}
          setActiveTab={setActiveTab}
          setShowActionNeededOnly={setShowActionNeededOnly}
          setOverviewRiskFilter={setOverviewRiskFilter}
          setFacultyFilter={setFacultyFilter}
        />

        <ProofSurfaceTabs
          controlId="hod-proof-controls"
          idBase="hod"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'courses', label: 'Course Hotspots' },
            { id: 'faculty', label: 'Faculty Operations' },
            { id: 'reassessments', label: 'Reassessment Audit' },
            { id: 'counterfactual', label: 'Counterfactual Impact' },
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
          <HodOverviewTab
            summary={summary}
            overviewStudents={overviewStudents}
            showActionNeededOnly={showActionNeededOnly}
            setShowActionNeededOnly={setShowActionNeededOnly}
            overviewRiskFilter={overviewRiskFilter}
            setOverviewRiskFilter={setOverviewRiskFilter}
            setSelectedStudentId={setSelectedStudentId}
            onOpenRiskExplorer={onOpenRiskExplorer}
            onOpenStudentShell={onOpenStudentShell}
          />
        ) : null}

        {activeTab === 'courses' ? (
          <HodCoursesTab
            courseRollups={courseRollups}
            setSelectedCourseCode={setSelectedCourseCode}
          />
        ) : null}

        {activeTab === 'faculty' ? (
          <HodFacultyTab
            facultyFilter={facultyFilter}
            setFacultyFilter={setFacultyFilter}
            visibleFacultyRollups={visibleFacultyRollups}
            setSelectedFacultyId={setSelectedFacultyId}
          />
        ) : null}

        {activeTab === 'counterfactual' ? (
          counterfactualPanel ?? (
            <EmptyState
              title="Counterfactual panel not wired"
              body="Pass a `counterfactualPanel` prop into HodView with a <HodCounterfactualPanel/> element configured with the two proof runs to diff. For the current demo flow, the panel is mounted from the academic workspace route surface."
            />
          )
        ) : null}

        {activeTab === 'reassessments' ? (
          <HodReassessmentsTab
            reassessmentRows={reassessmentRows}
            setSelectedStudentId={setSelectedStudentId}
            onOpenRiskExplorer={onOpenRiskExplorer}
            onOpenStudentShell={onOpenStudentShell}
          />
        ) : null}
        </ProofSurfaceTabPanel>
      </div>

      {selectedStudent ? (
        <HodStudentModal
          selectedStudent={selectedStudent}
          setSelectedStudentId={setSelectedStudentId}
          onOpenRiskExplorer={onOpenRiskExplorer}
          onOpenStudentShell={onOpenStudentShell}
        />
      ) : null}

      {selectedCourse ? (
        <HodCourseModal
          selectedCourse={selectedCourse}
          selectedCourseStudents={selectedCourseStudents}
          setSelectedCourseCode={setSelectedCourseCode}
          setSelectedStudentId={setSelectedStudentId}
          onOpenRiskExplorer={onOpenRiskExplorer}
          onOpenStudentShell={onOpenStudentShell}
        />
      ) : null}

      {selectedFaculty ? (
        <HodFacultyModal
          selectedFaculty={selectedFaculty}
          selectedFacultyReassessments={selectedFacultyReassessments}
          setSelectedFacultyId={setSelectedFacultyId}
        />
      ) : null}
    </PageShell>
  )
}
