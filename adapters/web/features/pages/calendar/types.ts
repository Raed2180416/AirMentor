import type { Offering } from '@web/simulation/fixtures'
import type { ApiAdminCalendarMarker } from '@web/shared/api/types'
import type {
  AcademicMeeting,
  FacultyAccount,
  FacultyTimetableClassBlock,
  FacultyTimetableTemplate,
  Role,
  SharedTask,
  TaskCalendarPlacement,
  TaskPlacementMode,
  Weekday,
} from '@kernel/shared/domain'

export type ScheduleInput = {
  dateISO: string
  placementMode: TaskPlacementMode
  startMinutes?: number
  endMinutes?: number
}

export type AddTargetState = {
  dateISO: string
  placementMode: TaskPlacementMode
  startMinutes?: number
  endMinutes?: number
}

export type ClassEditState = {
  blockId: string
  title: string
  subtitle: string
  day: Weekday
  dateISO?: string
  start: string
  end: string
}

export type ExtraClassDraftState = {
  offeringId: string
  dateISO: string
  day: Weekday
  startMinutes: number
  endMinutes: number
}

export type BlockDetailsState =
  | { type: 'class'; blockId: string; dateISO: string }
  | { type: 'task'; taskId: string; dateISO: string; placementMode: TaskPlacementMode }
  | { type: 'meeting'; meetingId: string; dateISO: string }
  | { type: 'marker'; markerId: string; dateISO: string }

export type MarkerChip = {
  markerId: string
  title: string
  subtitle: string
  accent: string
  marker: ApiAdminCalendarMarker
}

export type TimedEventCard = {
  id: string
  renderId: string
  entityId: string
  eventType: 'class' | 'task' | 'meeting' | 'marker' | 'preview'
  dateISO: string
  day: Weekday
  startMinutes: number
  endMinutes: number
  title: string
  subtitle: string
  accent: string
  placement?: TaskCalendarPlacement
  task?: SharedTask
  meeting?: AcademicMeeting
  classBlock?: FacultyTimetableClassBlock
  marker?: ApiAdminCalendarMarker
  invalid?: boolean
}

export type TimedColumnData = {
  dateISO: string
  day: Weekday
  label: string
  selected: boolean
  allDayMarkers: MarkerChip[]
  events: TimedEventCard[]
  untimedTasks: SharedTask[]
}

export type PreviewState = {
  placementMode: TaskPlacementMode
  dateISO: string
  day?: Weekday
  startMinutes?: number
  endMinutes?: number
  valid: boolean
  shiftedClassPreviews?: Array<{
    entityId: string
    dateISO: string
    day: Weekday
    startMinutes: number
    endMinutes: number
    title: string
    subtitle: string
    accent: string
  }>
}

export type PendingDrag = {
  mode: 'pending'
  kind: 'drag'
  itemType: 'class' | 'task'
  entityId: string
  title: string
  subtitle: string
  accent: string
  sourceDay?: Weekday
  sourceDateISO?: string
  sourceStartMinutes?: number
  sourceEndMinutes?: number
  durationMinutes: number
  offsetMinutes: number
  startedAt: { x: number; y: number }
  cursor: { x: number; y: number }
}

export type ActiveDrag = Omit<PendingDrag, 'mode'> & {
  mode: 'active'
  preview: PreviewState | null
}

export type PendingResize = {
  mode: 'pending'
  kind: 'resize'
  entityId: string
  edge: 'start' | 'end'
  day: Weekday
  dateISO: string
  title: string
  subtitle: string
  accent: string
  originalStartMinutes: number
  originalEndMinutes: number
  startedAt: { x: number; y: number }
  cursor: { x: number; y: number }
}

export type ActiveResize = Omit<PendingResize, 'mode'> & {
  mode: 'active'
  preview: PreviewState | null
}

export type InteractionState = PendingDrag | ActiveDrag | PendingResize | ActiveResize

export type HoverAddState = {
  dateISO: string
  day: Weekday
  cursorTopPx: number
  gapStartMinutes: number
  gapEndMinutes: number
  startMinutes: number
  endMinutes: number
}

export type AgendaBoardProps = {
  columns: TimedColumnData[]
  dayStartMinutes: number
  dayEndMinutes: number
  editable: boolean
  variant: 'day' | 'week'
  hoverAdd: HoverAddState | null
  interaction: InteractionState | null
  onHoverColumn: (input: HoverAddState | null) => void
  onSelectDate?: (dateISO: string) => void
  onOpenAdd: (target: AddTargetState) => void
  onTaskDragStart: (event: React.PointerEvent<HTMLDivElement>, task: SharedTask, placement: TaskCalendarPlacement | null, dateISO: string) => void
  onClassDragStart: (event: React.PointerEvent<HTMLDivElement>, block: FacultyTimetableClassBlock, dateISO: string) => void
  onClassResizeStart: (event: React.PointerEvent<HTMLButtonElement>, block: FacultyTimetableClassBlock, dateISO: string, edge: 'start' | 'end') => void
  onOpenEventDetails: (event: TimedEventCard) => void
  onOpenMarkerDetails: (marker: ApiAdminCalendarMarker, dateISO: string) => void
  onMoveTaskToUntimed: (taskId: string, dateISO: string) => void
  onDismissTask: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
  setColumnRef: (dateISO: string, node: HTMLDivElement | null) => void
  setUntimedBucketRef: (dateISO: string, node: HTMLDivElement | null) => void
}

export type CalendarTimetablePageProps = {
  onBack: () => void
  currentTeacher: FacultyAccount
  activeRole: Role
  allowedRoles: Role[]
  facultyOfferings: Offering[]
  mergedTasks: SharedTask[]
  meetings: AcademicMeeting[]
  resolvedTaskIds: Record<string, number>
  timetable: FacultyTimetableTemplate
  adminMarkers: ApiAdminCalendarMarker[]
  taskPlacements: Record<string, TaskCalendarPlacement>
  onScheduleTask: (taskId: string, input: ScheduleInput) => void
  onUpdateMeeting: (meetingId: string, input: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status: AcademicMeeting['status']; version: number }) => void
  onMoveClassBlock: (blockId: string, input: { day: Weekday; dateISO?: string; startMinutes: number; endMinutes: number }) => void
  onResizeClassBlock: (blockId: string, input: { startMinutes: number; endMinutes: number }) => void
  onEditClassTiming: (blockId: string, input: { day: Weekday; dateISO?: string; startMinutes: number; endMinutes: number }) => void
  onCreateExtraClass: (input: { offeringId: string; dateISO: string; startMinutes: number; endMinutes: number }) => void
  onOpenTaskComposer: (input: {
    dueDateISO: string
    availableOfferingIds: string[]
    placement: ScheduleInput
  }) => void
  onOpenCourse: (offeringId: string) => void
  onOpenActionQueue: () => void
  onUpdateTimetableBounds: (input: { dayStartMinutes: number; dayEndMinutes: number }) => void
  onDismissTask: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
  embedded?: boolean
  hideBackButton?: boolean
  title?: string
  subtitle?: string
  currentDateISO?: string
  editableOverride?: boolean
  canOpenCourseWorkspaceOverride?: boolean
  allowTaskCreation?: boolean
  calendarModeLayout?: 'split' | 'month-only'
  onEditMarker?: (marker: ApiAdminCalendarMarker) => void
}
