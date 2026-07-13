import { Suspense, lazy } from 'react'
import type { Offering } from '@web/simulation/fixtures'
import type { FacultyAccount, FacultyTimetableClassBlock, FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker } from '@web/shared/api/types'
import { Card } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'

const CalendarTimetablePage = lazy(async () => {
  const module = await import('@web/features/pages/calendar-pages')
  return { default: module.CalendarTimetablePage }
})

export function CalendarWorkspacePlanner({
  plannerFaculty,
  offerings,
  classEditingLocked,
  timetable,
  adminMarkers,
  onMoveClassBlock,
  onResizeClassBlock,
  onEditClassTiming,
  onCreateExtraClass,
  onUpdateTimetableBounds,
  onEditMarker,
}: {
  plannerFaculty: FacultyAccount
  offerings: Offering[]
  classEditingLocked: boolean
  timetable: FacultyTimetableTemplate
  adminMarkers: ApiAdminCalendarMarker[]
  onMoveClassBlock: (blockId: string, input: { day: FacultyTimetableClassBlock['day']; dateISO?: string; startMinutes: number; endMinutes: number }) => void
  onResizeClassBlock: (blockId: string, input: { startMinutes: number; endMinutes: number }) => void
  onEditClassTiming: (blockId: string, input: { day: FacultyTimetableClassBlock['day']; dateISO?: string; startMinutes: number; endMinutes: number }) => void
  onCreateExtraClass: (input: { offeringId: string; dateISO: string; startMinutes: number; endMinutes: number }) => void
  onUpdateTimetableBounds: (input: { dayStartMinutes: number; dayEndMinutes: number }) => void
  onEditMarker: (marker: ApiAdminCalendarMarker) => void
}) {
  return (
    <Suspense fallback={<Card style={{ padding: 18 }}><InfoBanner message="Loading shared timetable workspace…" /></Card>}>
      <CalendarTimetablePage
        embedded
        hideBackButton
        title="Calendar / Timetable"
        subtitle={`Shared teaching-workspace planner for ${plannerFaculty.name}. Tasks are hidden here so sysadmin can focus on class structure and institutional markers.`}
        currentTeacher={plannerFaculty}
        activeRole="Course Leader"
        allowedRoles={plannerFaculty.allowedRoles}
        facultyOfferings={offerings}
        mergedTasks={[]}
        meetings={[]}
        resolvedTaskIds={{}}
        timetable={timetable}
        adminMarkers={adminMarkers}
        taskPlacements={{}}
        editableOverride={!classEditingLocked}
        canOpenCourseWorkspaceOverride={false}
        allowTaskCreation={false}
        calendarModeLayout="month-only"
        onBack={() => {}}
        onScheduleTask={() => {}}
        onUpdateMeeting={() => {}}
        onMoveClassBlock={onMoveClassBlock}
        onResizeClassBlock={onResizeClassBlock}
        onEditClassTiming={onEditClassTiming}
        onCreateExtraClass={onCreateExtraClass}
        onOpenTaskComposer={() => {}}
        onOpenCourse={() => {}}
        onOpenActionQueue={() => {}}
        onUpdateTimetableBounds={onUpdateTimetableBounds}
        onDismissTask={() => {}}
        onDismissSeries={() => {}}
        onEditMarker={onEditMarker}
      />
    </Suspense>
  )
}
