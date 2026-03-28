import { lazy } from 'react'
import { AcademicWorkspaceContentShell } from './academic-workspace-content-shell'
import { FacultyProfilePage } from './App'
import { CLDashboard, MentorView, MenteeDetailPage, UnlockReviewPage, QueueHistoryPage } from './academic-route-pages'
import type { LayoutMode } from './domain'
import type { Role } from './domain'

const LazyCourseDetail = lazy(() => import('./pages/course-pages').then(module => ({ default: module.CourseDetail })))
const LazyAllStudentsPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.AllStudentsPage })))
const LazyStudentHistoryPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.StudentHistoryPage })))
const LazyStudentShellPage = lazy(() => import('./pages/student-shell').then(module => ({ default: module.StudentShellPage })))
const LazyRiskExplorerPage = lazy(() => import('./pages/risk-explorer').then(module => ({ default: module.RiskExplorerPage })))
const LazySchemeSetupPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.SchemeSetupPage })))
const LazyUploadPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.UploadPage })))
const LazyEntryWorkspacePage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.EntryWorkspacePage })))
const LazyHodView = lazy(() => import('./pages/hod-pages').then(module => ({ default: module.HodView })))
const LazyCalendarTimetablePage = lazy(() => import('./pages/calendar-pages').then(module => ({ default: module.CalendarTimetablePage })))

type AcademicWorkspaceRouteSurfaceProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace: any
  layoutMode: LayoutMode
  proofPlaybackNotice: { tone: 'neutral' | 'error'; message: string } | null | undefined
  routeError: string
  routeLoadingLabel: string
  onResetProofPlaybackSelection: () => Promise<void> | void
}

export function AcademicWorkspaceRouteSurface({
  workspace,
  layoutMode,
  proofPlaybackNotice,
  routeError,
  routeLoadingLabel,
  onResetProofPlaybackSelection,
}: AcademicWorkspaceRouteSurfaceProps) {
  const role: Role = workspace.role
  const page = workspace.page as string

  return (
    <AcademicWorkspaceContentShell
      layoutMode={layoutMode}
      proofPlaybackNotice={proofPlaybackNotice}
      routeError={routeError}
      routeLoadingLabel={routeLoadingLabel}
      onResetProofPlaybackSelection={onResetProofPlaybackSelection}
    >
      {page === 'faculty-profile' && (
        <FacultyProfilePage
          currentTeacher={workspace.currentTeacher}
          activeRole={role}
          profile={workspace.facultyProfile}
          calendarMarkers={workspace.currentFacultyCalendarMarkers}
          loading={workspace.facultyProfileLoading}
          error={workspace.facultyProfileError}
          pendingTaskCount={workspace.pendingActionCount}
          assignedOfferings={workspace.assignedOfferings}
          currentFacultyTimetable={workspace.filteredCurrentFacultyTimetable}
          onBack={workspace.handleNavigateBack}
          onOpenStudentShell={workspace.handleOpenStudentShell}
          onOpenRiskExplorer={workspace.handleOpenRiskExplorer}
        />
      )}
      {role === 'Course Leader' && page === 'dashboard' && (
        <CLDashboard
          offerings={workspace.assignedOfferings}
          pendingTaskCount={workspace.pendingActionCount}
          onOpenCourse={workspace.handleOpenCourse}
          onOpenStudent={workspace.handleOpenStudent}
          onOpenUpload={workspace.handleOpenUpload}
          onOpenCalendar={workspace.handleOpenCalendar}
          onOpenPendingActions={workspace.handleToggleActionQueue}
          teacherInitials={workspace.currentTeacher.initials}
          greetingHeadline={workspace.greetingHeadline}
          greetingMeta={workspace.greetingMeta}
          greetingSubline={workspace.greetingSubline}
        />
      )}
      {role === 'Course Leader' && page === 'students' && (
        <LazyAllStudentsPage offerings={workspace.assignedOfferings} onBack={workspace.handleNavigateBack} onOpenStudent={workspace.handleOpenStudent} onOpenHistory={workspace.handleOpenHistoryFromStudent} onOpenUpload={workspace.handleOpenUpload} />
      )}
      {role === 'Course Leader' && page === 'course' && workspace.offering && (
        <LazyCourseDetail
          key={`${workspace.offering.offId}-${workspace.courseInitialTab ?? 'overview'}`}
          offering={workspace.offering}
          scheme={workspace.schemeByOffering[workspace.offering.offId] ?? workspace.defaultSchemeForOffering(workspace.offering)}
          lockMap={workspace.lockByOffering[workspace.offering.offId] ?? workspace.getEntryLockMap(workspace.offering)}
          blueprints={workspace.ttBlueprintsByOffering[workspace.offering.offId] ?? workspace.getFallbackBlueprintSet(workspace.offering.offId)}
          courseOutcomes={workspace.academicBootstrap?.courseOutcomesByOffering?.[workspace.offering.offId]}
          coAttainmentRows={workspace.academicBootstrap?.coAttainmentByOffering?.[workspace.offering.offId]}
          onUpdateBlueprint={(kind: string, next: unknown) => workspace.handleUpdateBlueprint(workspace.offering.offId, kind, next)}
          onBack={workspace.handleNavigateBack}
          onOpenStudent={(student: unknown) => workspace.handleOpenStudent(student, workspace.offering)}
          onOpenEntryHub={(kind: string) => workspace.handleOpenEntryHub(workspace.offering, kind)}
          onOpenSchemeSetup={() => workspace.handleOpenSchemeSetup(workspace.offering)}
          initialTab={workspace.courseInitialTab}
        />
      )}
      {role === 'Course Leader' && page === 'scheme-setup' && workspace.selectedSchemeOffering && (
        <LazySchemeSetupPage
          role={role}
          offering={workspace.selectedSchemeOffering}
          scheme={workspace.schemeByOffering[workspace.selectedSchemeOffering.offId] ?? workspace.defaultSchemeForOffering(workspace.selectedSchemeOffering)}
          hasEntryStarted={workspace.hasEntryStartedForOffering(workspace.selectedSchemeOffering.offId)}
          onSave={(next: unknown) => workspace.handleSaveScheme(workspace.selectedSchemeOffering.offId, next)}
          onBack={workspace.handleNavigateBack}
        />
      )}
      {role === 'Course Leader' && page === 'calendar' && workspace.filteredCurrentFacultyTimetable && (
        <LazyCalendarTimetablePage
          currentTeacher={workspace.currentTeacher}
          activeRole={role}
          allowedRoles={workspace.allowedRoles}
          facultyOfferings={workspace.calendarOfferings}
          mergedTasks={workspace.mergedCalendarTasks}
          meetings={workspace.calendarMeetings}
          resolvedTaskIds={workspace.resolvedTasks}
          timetable={workspace.filteredCurrentFacultyTimetable}
          adminMarkers={workspace.currentFacultyCalendarMarkers}
          taskPlacements={workspace.taskPlacements}
          onBack={workspace.handleNavigateBack}
          onScheduleTask={workspace.handleScheduleTask}
          onUpdateMeeting={workspace.handleUpdateMeeting}
          onMoveClassBlock={workspace.handleMoveClassBlock}
          onResizeClassBlock={workspace.handleResizeClassBlock}
          onEditClassTiming={workspace.handleEditClassTiming}
          onCreateExtraClass={workspace.handleCreateExtraClass}
          onOpenTaskComposer={workspace.handleOpenTaskComposer}
          onOpenCourse={workspace.handleOpenCourseFromCalendar}
          onOpenActionQueue={workspace.handleOpenActionQueueFromCalendar}
          onUpdateTimetableBounds={workspace.handleUpdateTimetableBounds}
          onDismissTask={workspace.handleDismissTask}
          onDismissSeries={workspace.handleDismissSeries}
        />
      )}
      {role === 'Course Leader' && page === 'upload' && (
        <LazyUploadPage
          key={`${workspace.uploadOffering?.offId ?? 'default'}-${workspace.uploadKind}`}
          role={role}
          offering={workspace.uploadOffering}
          defaultKind={workspace.uploadKind}
          onBack={workspace.handleNavigateBack}
          onOpenWorkspace={workspace.handleOpenWorkspace}
          lockByOffering={workspace.lockByOffering}
          onRequestUnlock={workspace.handleRequestUnlock}
          availableOfferings={workspace.assignedOfferings}
          onOpenSchemeSetup={workspace.handleOpenSchemeSetup}
        />
      )}
      {role === 'Course Leader' && page === 'entry-workspace' && (
        <LazyEntryWorkspacePage
          capabilities={workspace.capabilities}
          offeringId={workspace.entryOfferingId}
          kind={workspace.entryKind}
          onBack={workspace.handleNavigateBack}
          lockByOffering={workspace.lockByOffering}
          draftBySection={workspace.draftBySection}
          onSaveDraft={workspace.handleSaveDraft}
          onSubmitLock={workspace.handleSubmitLock}
          onRequestUnlock={workspace.handleRequestUnlock}
          cellValues={workspace.cellValues}
          onCellValueChange={workspace.handleCellValueChange}
          onOpenStudent={workspace.handleOpenStudent}
          onOpenTaskComposer={workspace.handleOpenTaskComposer}
          onUpdateStudentAttendance={workspace.handleUpdateStudentAttendance}
          schemeByOffering={workspace.schemeByOffering}
          ttBlueprintsByOffering={workspace.ttBlueprintsByOffering}
          lockAuditByTarget={workspace.lockAuditByTarget}
          availableOfferings={workspace.assignedOfferings}
        />
      )}
      {role === 'Course Leader' && page === 'queue-history' && (
        <QueueHistoryPage role={role} tasks={workspace.roleTasks} resolvedTaskIds={workspace.resolvedTasks} onBack={workspace.handleNavigateBack} onOpenTaskStudent={workspace.handleOpenTaskStudent} onOpenUnlockReview={workspace.handleOpenUnlockReview} onRestoreTask={workspace.handleRestoreTask} />
      )}

      {role === 'Mentor' && page === 'mentees' && <MentorView mentees={workspace.assignedMentees} tasks={workspace.roleTasks} onOpenMentee={workspace.handleOpenMentee} />}
      {role === 'Mentor' && page === 'mentee-detail' && workspace.selectedMentee && workspace.selectedMenteeHistory && (
        <MenteeDetailPage mentee={workspace.selectedMentee} history={workspace.selectedMenteeHistory} onBack={workspace.handleNavigateBack} onOpenHistory={workspace.handleOpenHistoryFromMentee} />
      )}
      {role === 'Mentor' && page === 'queue-history' && (
        <QueueHistoryPage role={role} tasks={workspace.roleTasks} resolvedTaskIds={workspace.resolvedTasks} onBack={workspace.handleNavigateBack} onOpenTaskStudent={workspace.handleOpenTaskStudent} onOpenUnlockReview={workspace.handleOpenUnlockReview} onRestoreTask={workspace.handleRestoreTask} />
      )}
      {role === 'Mentor' && page === 'calendar' && workspace.filteredCurrentFacultyTimetable && (
        <LazyCalendarTimetablePage
          currentTeacher={workspace.currentTeacher}
          activeRole={role}
          allowedRoles={workspace.allowedRoles}
          facultyOfferings={workspace.calendarOfferings}
          mergedTasks={workspace.mergedCalendarTasks}
          meetings={workspace.calendarMeetings}
          resolvedTaskIds={workspace.resolvedTasks}
          timetable={workspace.filteredCurrentFacultyTimetable}
          adminMarkers={workspace.currentFacultyCalendarMarkers}
          taskPlacements={workspace.taskPlacements}
          onBack={workspace.handleNavigateBack}
          onScheduleTask={workspace.handleScheduleTask}
          onUpdateMeeting={workspace.handleUpdateMeeting}
          onMoveClassBlock={workspace.handleMoveClassBlock}
          onResizeClassBlock={workspace.handleResizeClassBlock}
          onEditClassTiming={workspace.handleEditClassTiming}
          onCreateExtraClass={workspace.handleCreateExtraClass}
          onOpenTaskComposer={workspace.handleOpenTaskComposer}
          onOpenCourse={workspace.handleOpenCourseFromCalendar}
          onOpenActionQueue={workspace.handleOpenActionQueueFromCalendar}
          onUpdateTimetableBounds={workspace.handleUpdateTimetableBounds}
          onDismissTask={workspace.handleDismissTask}
          onDismissSeries={workspace.handleDismissSeries}
        />
      )}

      {role === 'HoD' && page === 'department' && (
        <LazyHodView
          onOpenQueueHistory={workspace.handleOpenQueueHistory}
          onOpenStudentShell={workspace.handleOpenStudentShell}
          onOpenRiskExplorer={workspace.handleOpenRiskExplorer}
          onOpenCourse={workspace.handleOpenCourse}
          onOpenStudent={workspace.handleOpenStudent}
          tasks={workspace.allTasksList}
          calendarAuditEvents={workspace.calendarAuditEvents}
          summary={workspace.hodProofAnalytics?.summary ?? null}
          courseRollups={workspace.hodProofAnalytics?.courses ?? []}
          facultyRollups={workspace.hodProofAnalytics?.faculty ?? []}
          studentWatchRows={workspace.hodProofAnalytics?.students ?? []}
          reassessmentRows={workspace.hodProofAnalytics?.reassessments ?? []}
          loading={workspace.hodProofLoading}
          error={workspace.hodProofError}
        />
      )}
      {role === 'HoD' && page === 'course' && workspace.offering && (
        <LazyCourseDetail
          key={`${workspace.offering.offId}-${workspace.courseInitialTab ?? 'overview'}`}
          offering={workspace.offering}
          scheme={workspace.schemeByOffering[workspace.offering.offId] ?? workspace.defaultSchemeForOffering(workspace.offering)}
          lockMap={workspace.lockByOffering[workspace.offering.offId] ?? workspace.getEntryLockMap(workspace.offering)}
          blueprints={workspace.ttBlueprintsByOffering[workspace.offering.offId] ?? workspace.getFallbackBlueprintSet(workspace.offering.offId)}
          courseOutcomes={workspace.academicBootstrap?.courseOutcomesByOffering?.[workspace.offering.offId]}
          coAttainmentRows={workspace.academicBootstrap?.coAttainmentByOffering?.[workspace.offering.offId]}
          onUpdateBlueprint={(kind: string, next: unknown) => workspace.handleUpdateBlueprint(workspace.offering.offId, kind, next)}
          onBack={workspace.handleNavigateBack}
          onOpenStudent={(student: unknown) => workspace.handleOpenStudent(student, workspace.offering)}
          onOpenEntryHub={(kind: string) => workspace.handleOpenEntryHub(workspace.offering, kind)}
          onOpenSchemeSetup={() => workspace.handleOpenSchemeSetup(workspace.offering)}
          initialTab={workspace.courseInitialTab}
        />
      )}
      {role === 'HoD' && page === 'unlock-review' && workspace.selectedUnlockTask && (
        <UnlockReviewPage task={workspace.selectedUnlockTask} offering={workspace.selectedUnlockTaskOffering} onBack={workspace.handleNavigateBack} onApprove={() => workspace.handleApproveUnlock(workspace.selectedUnlockTask.id)} onReject={() => workspace.handleRejectUnlock(workspace.selectedUnlockTask.id)} onResetComplete={() => workspace.handleResetComplete(workspace.selectedUnlockTask.id)} />
      )}
      {role === 'HoD' && page === 'queue-history' && (
        <QueueHistoryPage role={role} tasks={workspace.roleTasks} resolvedTaskIds={workspace.resolvedTasks} onBack={workspace.handleNavigateBack} onOpenTaskStudent={workspace.handleOpenTaskStudent} onOpenUnlockReview={workspace.handleOpenUnlockReview} onRestoreTask={workspace.handleRestoreTask} />
      )}
      {role === 'HoD' && page === 'calendar' && workspace.filteredCurrentFacultyTimetable && (
        <LazyCalendarTimetablePage
          currentTeacher={workspace.currentTeacher}
          activeRole={role}
          allowedRoles={workspace.allowedRoles}
          facultyOfferings={workspace.calendarOfferings}
          mergedTasks={workspace.mergedCalendarTasks}
          meetings={workspace.calendarMeetings}
          resolvedTaskIds={workspace.resolvedTasks}
          timetable={workspace.filteredCurrentFacultyTimetable}
          adminMarkers={workspace.currentFacultyCalendarMarkers}
          taskPlacements={workspace.taskPlacements}
          onBack={workspace.handleNavigateBack}
          onScheduleTask={workspace.handleScheduleTask}
          onUpdateMeeting={workspace.handleUpdateMeeting}
          onMoveClassBlock={workspace.handleMoveClassBlock}
          onResizeClassBlock={workspace.handleResizeClassBlock}
          onEditClassTiming={workspace.handleEditClassTiming}
          onCreateExtraClass={workspace.handleCreateExtraClass}
          onOpenTaskComposer={workspace.handleOpenTaskComposer}
          onOpenCourse={workspace.handleOpenCourseFromCalendar}
          onOpenActionQueue={workspace.handleOpenActionQueueFromCalendar}
          onUpdateTimetableBounds={workspace.handleUpdateTimetableBounds}
          onDismissTask={workspace.handleDismissTask}
          onDismissSeries={workspace.handleDismissSeries}
        />
      )}

      {page === 'student-history' && workspace.historyProfile && (
        <LazyStudentHistoryPage role={role} history={workspace.historyProfile} studentId={workspace.historyStudentId} onBack={workspace.handleNavigateBack} onOpenStudentShell={workspace.handleOpenStudentShellFromHistory} onOpenRiskExplorer={workspace.handleOpenRiskExplorerFromHistory} />
      )}
      {page === 'student-shell' && workspace.studentShellStudentId && (
        <LazyStudentShellPage role={role} studentId={workspace.studentShellStudentId} onBack={workspace.handleNavigateBack} loadCard={workspace.loadStudentAgentCard} loadTimeline={workspace.loadStudentAgentTimeline} startSession={workspace.startStudentAgentSession} sendMessage={workspace.sendStudentAgentMessage} />
      )}
      {page === 'risk-explorer' && workspace.studentShellStudentId && (
        <LazyRiskExplorerPage role={role} studentId={workspace.studentShellStudentId} onBack={workspace.handleNavigateBack} loadExplorer={workspace.loadStudentRiskExplorer} />
      )}
    </AcademicWorkspaceContentShell>
  )
}
