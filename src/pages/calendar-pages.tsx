import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, GripVertical, Plus, Rows4, X } from 'lucide-react'
import { T, mono, sora, type Offering } from '../data'
import type {
  FacultyAccount,
  FacultyTimetableClassBlock,
  FacultyTimetableTemplate,
  Role,
  SharedTask,
  TaskCalendarPlacement,
  TaskPlacementMode,
  Weekday,
} from '../domain'
import { canDismissCurrentOccurrence, isTaskDismissed } from '../domain'
import {
  DEFAULT_TASK_DURATION_MINUTES,
  MIN_EVENT_DURATION_MINUTES,
  WEEKDAY_ORDER,
  addDaysISO,
  assignAgendaLanes,
  buildMonthGrid,
  buildTimeGuides,
  clampMinuteValue,
  clampRangeToDayBounds,
  formatMonthLabel,
  formatShortDate,
  formatWeekRange,
  getWeekDates,
  getWeekdayForDateISO,
  minutesToDisplayLabel,
  minutesToTimeString,
  normalizeTimedRange,
  startOfWeekISO,
} from '../calendar-utils'
import { Btn, Card, Chip, HScrollArea, PageShell } from '../ui-primitives'

const AGENDA_PIXELS_PER_MINUTE = 1.15
const DAY_COLUMN_MIN_WIDTH = 180
const DRAG_THRESHOLD_PX = 4
const SNAP_THRESHOLD_MINUTES = 14

type ScheduleInput = {
  dateISO: string
  placementMode: TaskPlacementMode
  startMinutes?: number
  endMinutes?: number
}

type AddTargetState = {
  dateISO: string
  initialMode: TaskPlacementMode
  startMinutes?: number
  endMinutes?: number
}

type TimedEventCard = {
  id: string
  renderId: string
  entityId: string
  eventType: 'class' | 'task' | 'preview'
  dateISO: string
  day: Weekday
  startMinutes: number
  endMinutes: number
  title: string
  subtitle: string
  accent: string
  placement?: TaskCalendarPlacement
  task?: SharedTask
  classBlock?: FacultyTimetableClassBlock
  invalid?: boolean
}

type TimedColumnData = {
  dateISO: string
  day: Weekday
  label: string
  selected: boolean
  events: TimedEventCard[]
  untimedTasks: SharedTask[]
}

type PreviewState = {
  placementMode: TaskPlacementMode
  dateISO: string
  day?: Weekday
  startMinutes?: number
  endMinutes?: number
  valid: boolean
}

type PendingDrag = {
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

type ActiveDrag = Omit<PendingDrag, 'mode'> & {
  mode: 'active'
  preview: PreviewState | null
}

type PendingResize = {
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

type ActiveResize = Omit<PendingResize, 'mode'> & {
  mode: 'active'
  preview: PreviewState | null
}

type InteractionState = PendingDrag | ActiveDrag | PendingResize | ActiveResize

type HoverAddState = {
  dateISO: string
  day: Weekday
  topPx: number
  startMinutes: number
  endMinutes: number
}

type AgendaBoardProps = {
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
  onMoveTaskToUntimed: (taskId: string, dateISO: string) => void
  onDismissTask: (taskId: string) => void
  onDismissCurrentOccurrence: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
  setColumnRef: (dateISO: string, node: HTMLDivElement | null) => void
  setUntimedBucketRef: (dateISO: string, node: HTMLDivElement | null) => void
}

export function CalendarTimetablePage({
  currentTeacher,
  activeRole,
  allowedRoles,
  facultyOfferings,
  mergedTasks,
  resolvedTaskIds,
  timetable,
  taskPlacements,
  onScheduleTask,
  onMoveClassBlock,
  onResizeClassBlock,
  onOpenTaskComposer,
  onUpdateTimetableBounds,
  onDismissTask,
  onDismissCurrentOccurrence,
  onDismissSeries,
}: {
  currentTeacher: FacultyAccount
  activeRole: Role
  allowedRoles: Role[]
  facultyOfferings: Offering[]
  mergedTasks: SharedTask[]
  resolvedTaskIds: Record<string, number>
  timetable: FacultyTimetableTemplate
  taskPlacements: Record<string, TaskCalendarPlacement>
  onScheduleTask: (taskId: string, input: ScheduleInput) => void
  onMoveClassBlock: (blockId: string, input: { day: Weekday; startMinutes: number; endMinutes: number }) => void
  onResizeClassBlock: (blockId: string, input: { startMinutes: number; endMinutes: number }) => void
  onOpenTaskComposer: (input: {
    dueDateISO: string
    availableOfferingIds: string[]
    placement: ScheduleInput
  }) => void
  onUpdateTimetableBounds: (input: { dayStartMinutes: number; dayEndMinutes: number }) => void
  onDismissTask: (taskId: string) => void
  onDismissCurrentOccurrence: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
}) {
  const [mode, setMode] = useState<'calendar' | 'timetable'>('calendar')
  const [selectedDateISO, setSelectedDateISO] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = `${today.getMonth() + 1}`.padStart(2, '0')
    const day = `${today.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [monthAnchorISO, setMonthAnchorISO] = useState(() => `${selectedDateISO.slice(0, 7)}-01`)
  const [addTarget, setAddTarget] = useState<AddTargetState | null>(null)
  const [hoverAdd, setHoverAdd] = useState<HoverAddState | null>(null)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [boundsDraft, setBoundsDraft] = useState(() => ({
    start: minutesToTimeString(timetable.dayStartMinutes),
    end: minutesToTimeString(timetable.dayEndMinutes),
  }))
  const [boundsDirty, setBoundsDirty] = useState(false)

  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const untimedBucketRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [pageWidth, setPageWidth] = useState(1400)

  const isEditable = activeRole === 'Course Leader'
  const offeringIds = useMemo(() => new Set(facultyOfferings.map(offering => offering.offId)), [facultyOfferings])
  const activeTasks = useMemo(() => mergedTasks.filter(task => !resolvedTaskIds[task.id] && !isTaskDismissed(task)), [mergedTasks, resolvedTaskIds])
  const activeTasksById = useMemo(() => Object.fromEntries(activeTasks.map(task => [task.id, task])) as Record<string, SharedTask>, [activeTasks])
  const queueCandidates = useMemo(() => {
    return activeTasks
      .filter(task => task.status !== 'Resolved')
      .filter(task => !task.unlockRequest)
      .filter(task => offeringIds.has(task.offeringId))
      .sort((left, right) => {
        if ((right.updatedAt ?? right.createdAt) !== (left.updatedAt ?? left.createdAt)) {
          return (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt)
        }
        return right.priority - left.priority
      })
  }, [activeTasks, offeringIds])

  const weekDates = useMemo(() => getWeekDates(selectedDateISO), [selectedDateISO])
  const monthCells = useMemo(() => buildMonthGrid(monthAnchorISO), [monthAnchorISO])
  const selectedWeekStart = useMemo(() => startOfWeekISO(selectedDateISO), [selectedDateISO])
  const selectedWeekday = useMemo(() => getWeekdayForDateISO(selectedDateISO), [selectedDateISO])
  const dayStartMinutes = timetable.dayStartMinutes
  const dayEndMinutes = timetable.dayEndMinutes
  const visibleBounds = boundsDirty
    ? boundsDraft
    : {
        start: minutesToTimeString(timetable.dayStartMinutes),
        end: minutesToTimeString(timetable.dayEndMinutes),
      }

  useEffect(() => {
    const node = shellRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      setPageWidth(entry.contentRect.width)
    })
    observer.observe(node)
    setPageWidth(node.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  const taskPlacementsByDate = useMemo(() => {
    const grouped = {} as Record<string, TaskCalendarPlacement[]>
    Object.values(taskPlacements).forEach(placement => {
      const task = activeTasksById[placement.taskId]
      if (!task) return
      grouped[placement.dateISO] = [...(grouped[placement.dateISO] ?? []), placement]
    })
    return grouped
  }, [activeTasksById, taskPlacements])

  const monthSummaryByDate = useMemo(() => {
    const summary = {} as Record<string, { classCount: number; taskCount: number }>
    monthCells.forEach(cell => {
      const weekday = getWeekdayForDateISO(cell.dateISO)
      const classCount = weekday ? timetable.classBlocks.filter(block => block.day === weekday).length : 0
      const taskCount = (taskPlacementsByDate[cell.dateISO] ?? []).length
      summary[cell.dateISO] = { classCount, taskCount }
    })
    return summary
  }, [monthCells, taskPlacementsByDate, timetable.classBlocks])

  const buildTimedEventsForDate = useMemo(() => {
    return (dateISO: string) => {
      const weekday = getWeekdayForDateISO(dateISO)
      const classEvents = weekday
        ? timetable.classBlocks
            .filter(block => block.day === weekday)
            .map(block => ({
              id: `class-${block.id}`,
              renderId: `class-${block.id}`,
              entityId: block.id,
              eventType: 'class' as const,
              dateISO,
              day: weekday,
              startMinutes: block.startMinutes,
              endMinutes: block.endMinutes,
              title: `${block.courseCode} · Sec ${block.section}`,
              subtitle: block.courseName,
              accent: T.accent,
              classBlock: block,
            }))
        : []
      const taskEvents = (taskPlacementsByDate[dateISO] ?? [])
        .filter(placement => placement.placementMode === 'timed')
        .flatMap(placement => {
          const task = activeTasksById[placement.taskId]
          const day = getWeekdayForDateISO(dateISO)
          if (!task || !day || typeof placement.startMinutes !== 'number' || typeof placement.endMinutes !== 'number') return []
          return [{
            id: `task-${task.id}`,
            renderId: `task-${task.id}`,
            entityId: task.id,
            eventType: 'task' as const,
            dateISO,
            day,
            startMinutes: placement.startMinutes,
            endMinutes: placement.endMinutes,
            title: task.title,
            subtitle: `${task.studentName} · ${task.taskType ?? 'Task'}`,
            accent: T.warning,
            task,
            placement,
          }]
        })

      const previewEvent = interaction?.mode === 'active' && interaction.preview?.placementMode === 'timed' && interaction.preview.dateISO === dateISO && interaction.preview.day
        && typeof interaction.preview.startMinutes === 'number' && typeof interaction.preview.endMinutes === 'number'
        ? [{
            id: `preview-${interaction.kind}-${interaction.entityId}`,
            renderId: `preview-${interaction.kind}-${interaction.entityId}`,
            entityId: interaction.entityId,
            eventType: 'preview' as const,
            dateISO,
            day: interaction.preview.day,
            startMinutes: interaction.preview.startMinutes,
            endMinutes: interaction.preview.endMinutes,
            title: interaction.title,
            subtitle: interaction.subtitle,
            accent: interaction.accent,
            invalid: !interaction.preview.valid,
          }]
        : []

      return [...classEvents, ...taskEvents, ...previewEvent]
    }
  }, [activeTasksById, interaction, taskPlacementsByDate, timetable.classBlocks])

  const buildUntimedTasksForDate = useMemo(() => {
    return (dateISO: string) => (taskPlacementsByDate[dateISO] ?? [])
      .filter(placement => placement.placementMode === 'untimed')
      .map(placement => activeTasksById[placement.taskId])
      .filter((task): task is SharedTask => !!task)
  }, [activeTasksById, taskPlacementsByDate])

  const getTimedNeighbors = useCallback((dateISO: string, exclude: { taskId?: string; classId?: string } = {}) => {
    const weekday = getWeekdayForDateISO(dateISO)
    const classNeighbors = weekday
      ? timetable.classBlocks
          .filter(block => block.day === weekday && block.id !== exclude.classId)
          .map(block => ({ startMinutes: block.startMinutes, endMinutes: block.endMinutes, kind: 'class' as const }))
      : []
    const taskNeighbors = (taskPlacementsByDate[dateISO] ?? [])
      .filter(placement => placement.placementMode === 'timed')
      .filter(placement => placement.taskId !== exclude.taskId)
      .filter(placement => typeof placement.startMinutes === 'number' && typeof placement.endMinutes === 'number')
      .map(placement => ({ startMinutes: placement.startMinutes as number, endMinutes: placement.endMinutes as number, kind: 'task' as const }))
    return [...classNeighbors, ...taskNeighbors].sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes)
  }, [taskPlacementsByDate, timetable.classBlocks])

  const snapRangeToNeighbors = useCallback((range: { startMinutes: number; endMinutes: number }, dateISO: string, exclude: { taskId?: string; classId?: string } = {}) => {
    const duration = range.endMinutes - range.startMinutes
    const candidates = getTimedNeighbors(dateISO, exclude).flatMap(item => [item.startMinutes, item.endMinutes])
    let best: { startMinutes: number; endMinutes: number } | null = null
    let bestDistance = SNAP_THRESHOLD_MINUTES + 1

    candidates.forEach(edge => {
      const startDistance = Math.abs(range.startMinutes - edge)
      if (startDistance < bestDistance) {
        bestDistance = startDistance
        best = { startMinutes: edge, endMinutes: edge + duration }
      }
      const endDistance = Math.abs(range.endMinutes - edge)
      if (endDistance < bestDistance) {
        bestDistance = endDistance
        best = { startMinutes: edge - duration, endMinutes: edge }
      }
    })

    if (best === null) return range
    const snapped: { startMinutes: number; endMinutes: number } = best
    return clampRangeToDayBounds(snapped.startMinutes, snapped.endMinutes, dayStartMinutes, dayEndMinutes)
  }, [dayEndMinutes, dayStartMinutes, getTimedNeighbors])

  const fitClassRangeIntoGap = useCallback((dateISO: string, durationMinutes: number, draftStartMinutes: number, excludeClassId?: string) => {
    const day = getWeekdayForDateISO(dateISO)
    if (!day) {
      return {
        placementMode: 'timed' as const,
        dateISO,
        valid: false,
      }
    }
    const neighbors = getTimedNeighbors(dateISO, { classId: excludeClassId })
      .filter(item => item.kind === 'class')
      .sort((left, right) => left.startMinutes - right.startMinutes)
    const gaps = [] as Array<{ startMinutes: number; endMinutes: number }>
    let cursor = dayStartMinutes
    neighbors.forEach(item => {
      gaps.push({ startMinutes: cursor, endMinutes: item.startMinutes })
      cursor = Math.max(cursor, item.endMinutes)
    })
    gaps.push({ startMinutes: cursor, endMinutes: dayEndMinutes })

    const draftCenter = draftStartMinutes + (durationMinutes / 2)
    const targetGap = gaps
      .filter(gap => (gap.endMinutes - gap.startMinutes) >= durationMinutes)
      .sort((left, right) => {
        const leftDistance = left.startMinutes <= draftCenter && draftCenter <= left.endMinutes
          ? 0
          : Math.min(Math.abs(draftCenter - left.startMinutes), Math.abs(draftCenter - left.endMinutes))
        const rightDistance = right.startMinutes <= draftCenter && draftCenter <= right.endMinutes
          ? 0
          : Math.min(Math.abs(draftCenter - right.startMinutes), Math.abs(draftCenter - right.endMinutes))
        if (leftDistance !== rightDistance) return leftDistance - rightDistance
        return left.startMinutes - right.startMinutes
      })[0]

    if (!targetGap) {
      return {
        placementMode: 'timed' as const,
        dateISO,
        day,
        startMinutes: draftStartMinutes,
        endMinutes: draftStartMinutes + durationMinutes,
        valid: false,
      }
    }

    const clampedStart = clampMinuteValue(draftStartMinutes, targetGap.startMinutes, targetGap.endMinutes - durationMinutes)
    let startMinutes = clampedStart
    const distanceToGapStart = Math.abs(clampedStart - targetGap.startMinutes)
    const distanceToGapEnd = Math.abs((clampedStart + durationMinutes) - targetGap.endMinutes)
    if (distanceToGapStart <= SNAP_THRESHOLD_MINUTES) startMinutes = targetGap.startMinutes
    else if (distanceToGapEnd <= SNAP_THRESHOLD_MINUTES) startMinutes = targetGap.endMinutes - durationMinutes

    return {
      placementMode: 'timed' as const,
      dateISO,
      day,
      startMinutes,
      endMinutes: startMinutes + durationMinutes,
      valid: true,
    }
  }, [dayEndMinutes, dayStartMinutes, getTimedNeighbors])

  const getClassResizeBounds = useCallback((dateISO: string, classId: string, anchorStart: number, anchorEnd: number) => {
    const neighbors = getTimedNeighbors(dateISO, { classId })
      .filter(item => item.kind === 'class')
      .sort((left, right) => left.startMinutes - right.startMinutes)
    const previousEnd = neighbors.filter(item => item.endMinutes <= anchorStart).map(item => item.endMinutes).sort((a, b) => b - a)[0] ?? dayStartMinutes
    const nextStart = neighbors.filter(item => item.startMinutes >= anchorEnd).map(item => item.startMinutes).sort((a, b) => a - b)[0] ?? dayEndMinutes
    return { previousEnd, nextStart }
  }, [dayEndMinutes, dayStartMinutes, getTimedNeighbors])

  const weekColumns = useMemo<TimedColumnData[]>(() => weekDates.map(dateISO => ({
    dateISO,
    day: getWeekdayForDateISO(dateISO) ?? WEEKDAY_ORDER[0],
    label: formatShortDate(dateISO).split(', ').slice(1).join(', '),
    selected: dateISO === selectedDateISO,
    events: buildTimedEventsForDate(dateISO),
    untimedTasks: buildUntimedTasksForDate(dateISO),
  })), [buildTimedEventsForDate, buildUntimedTasksForDate, selectedDateISO, weekDates])

  const dayColumns = useMemo<TimedColumnData[]>(() => {
    if (!selectedWeekday) return []
    return [{
      dateISO: selectedDateISO,
      day: selectedWeekday,
      label: formatShortDate(selectedDateISO),
      selected: true,
      events: buildTimedEventsForDate(selectedDateISO),
      untimedTasks: buildUntimedTasksForDate(selectedDateISO),
    }]
  }, [buildTimedEventsForDate, buildUntimedTasksForDate, selectedDateISO, selectedWeekday])

  const findTimedColumnTarget = useCallback((clientX: number, clientY: number) => {
    for (const [dateISO, node] of Object.entries(columnRefs.current)) {
      if (!node) continue
      const rect = node.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue
      const day = getWeekdayForDateISO(dateISO)
      if (!day) continue
      const relativeY = clampMinuteValue((clientY - rect.top) / AGENDA_PIXELS_PER_MINUTE, 0, dayEndMinutes - dayStartMinutes)
      return {
        dateISO,
        day,
        minute: dayStartMinutes + relativeY,
        topPx: clientY - rect.top,
      }
    }
    return null
  }, [dayEndMinutes, dayStartMinutes])

  const findUntimedTarget = useCallback((clientX: number, clientY: number) => {
    for (const [dateISO, node] of Object.entries(untimedBucketRefs.current)) {
      if (!node) continue
      const rect = node.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return { dateISO, day: getWeekdayForDateISO(dateISO) ?? undefined }
      }
    }
    return null
  }, [])

  const resolveDragPreview = useCallback((draft: PendingDrag | ActiveDrag, clientX: number, clientY: number): PreviewState | null => {
    const untimedTarget = findUntimedTarget(clientX, clientY)
    if (draft.itemType === 'task' && untimedTarget) {
      return {
        placementMode: 'untimed',
        dateISO: untimedTarget.dateISO,
        day: untimedTarget.day,
        valid: true,
      }
    }

    const timedTarget = findTimedColumnTarget(clientX, clientY)
    if (!timedTarget) return null
    const startMinutes = timedTarget.minute - draft.offsetMinutes
    const normalized = clampRangeToDayBounds(
      startMinutes,
      startMinutes + draft.durationMinutes,
      dayStartMinutes,
      dayEndMinutes,
    )
    if (draft.itemType === 'class') {
      return fitClassRangeIntoGap(timedTarget.dateISO, draft.durationMinutes, normalized.startMinutes, draft.entityId)
    }

    const snapped = snapRangeToNeighbors(normalized, timedTarget.dateISO, { taskId: draft.entityId })
    return {
      placementMode: 'timed',
      dateISO: timedTarget.dateISO,
      day: timedTarget.day,
      startMinutes: snapped.startMinutes,
      endMinutes: snapped.endMinutes,
      valid: true,
    }
  }, [dayEndMinutes, dayStartMinutes, findTimedColumnTarget, findUntimedTarget, fitClassRangeIntoGap, snapRangeToNeighbors])

  const resolveResizePreview = useCallback((draft: PendingResize | ActiveResize, clientX: number, clientY: number): PreviewState | null => {
    const timedTarget = findTimedColumnTarget(clientX, clientY)
    if (!timedTarget || timedTarget.dateISO !== draft.dateISO) {
      return {
        placementMode: 'timed',
        dateISO: draft.dateISO,
        day: draft.day,
        startMinutes: draft.originalStartMinutes,
        endMinutes: draft.originalEndMinutes,
        valid: true,
      }
    }

    const nextMinute = timedTarget.minute
    const { previousEnd, nextStart } = getClassResizeBounds(draft.dateISO, draft.entityId, draft.originalStartMinutes, draft.originalEndMinutes)
    const raw = draft.edge === 'start'
      ? normalizeTimedRange(
          clampMinuteValue(nextMinute, previousEnd, draft.originalEndMinutes - MIN_EVENT_DURATION_MINUTES),
          draft.originalEndMinutes,
          dayStartMinutes,
          dayEndMinutes,
          MIN_EVENT_DURATION_MINUTES,
        )
      : normalizeTimedRange(
          draft.originalStartMinutes,
          clampMinuteValue(nextMinute, draft.originalStartMinutes + MIN_EVENT_DURATION_MINUTES, nextStart),
          dayStartMinutes,
          dayEndMinutes,
          MIN_EVENT_DURATION_MINUTES,
        )
    const snapped = draft.edge === 'start'
      ? {
          startMinutes: Math.abs(raw.startMinutes - previousEnd) <= SNAP_THRESHOLD_MINUTES ? previousEnd : raw.startMinutes,
          endMinutes: raw.endMinutes,
        }
      : {
          startMinutes: raw.startMinutes,
          endMinutes: Math.abs(raw.endMinutes - nextStart) <= SNAP_THRESHOLD_MINUTES ? nextStart : raw.endMinutes,
        }
    return {
      placementMode: 'timed',
      dateISO: draft.dateISO,
      day: draft.day,
      startMinutes: snapped.startMinutes,
      endMinutes: snapped.endMinutes,
      valid: true,
    }
  }, [dayEndMinutes, dayStartMinutes, findTimedColumnTarget, getClassResizeBounds])

  useEffect(() => {
    if (!interaction) return undefined

    const handlePointerMove = (event: PointerEvent) => {
      if (interaction.mode === 'pending') {
        const distance = Math.hypot(event.clientX - interaction.startedAt.x, event.clientY - interaction.startedAt.y)
        if (distance < DRAG_THRESHOLD_PX) {
          setInteraction(prev => prev ? { ...prev, cursor: { x: event.clientX, y: event.clientY } } as InteractionState : prev)
          return
        }
        if (interaction.kind === 'drag') {
          const preview = resolveDragPreview(interaction, event.clientX, event.clientY)
          setInteraction({
            ...interaction,
            mode: 'active',
            cursor: { x: event.clientX, y: event.clientY },
            preview,
          })
          return
        }
        const preview = resolveResizePreview(interaction, event.clientX, event.clientY)
        setInteraction({
          ...interaction,
          mode: 'active',
          cursor: { x: event.clientX, y: event.clientY },
          preview,
        })
        return
      }

      if (interaction.kind === 'drag') {
        const preview = resolveDragPreview(interaction, event.clientX, event.clientY)
        setInteraction(prev => prev && prev.kind === 'drag' && prev.mode === 'active'
          ? { ...prev, cursor: { x: event.clientX, y: event.clientY }, preview }
          : prev)
        return
      }

      const preview = resolveResizePreview(interaction, event.clientX, event.clientY)
      setInteraction(prev => prev && prev.kind === 'resize' && prev.mode === 'active'
        ? { ...prev, cursor: { x: event.clientX, y: event.clientY }, preview }
        : prev)
    }

    const handlePointerUp = () => {
      if (interaction.mode !== 'active') {
        setInteraction(null)
        return
      }

      if (interaction.kind === 'drag' && interaction.preview?.valid) {
        if (interaction.itemType === 'task') {
          if (interaction.preview.placementMode === 'untimed') {
            onScheduleTask(interaction.entityId, {
              dateISO: interaction.preview.dateISO,
              placementMode: 'untimed',
            })
          } else if (interaction.preview.day && typeof interaction.preview.startMinutes === 'number' && typeof interaction.preview.endMinutes === 'number') {
            onScheduleTask(interaction.entityId, {
              dateISO: interaction.preview.dateISO,
              placementMode: 'timed',
              startMinutes: interaction.preview.startMinutes,
              endMinutes: interaction.preview.endMinutes,
            })
          }
        } else if (interaction.preview.day && typeof interaction.preview.startMinutes === 'number' && typeof interaction.preview.endMinutes === 'number') {
          onMoveClassBlock(interaction.entityId, {
            day: interaction.preview.day,
            startMinutes: interaction.preview.startMinutes,
            endMinutes: interaction.preview.endMinutes,
          })
        }
      }

      if (interaction.kind === 'resize' && interaction.preview?.valid && typeof interaction.preview.startMinutes === 'number' && typeof interaction.preview.endMinutes === 'number') {
        onResizeClassBlock(interaction.entityId, {
          startMinutes: interaction.preview.startMinutes,
          endMinutes: interaction.preview.endMinutes,
        })
      }

      setInteraction(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInteraction(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dayEndMinutes, dayStartMinutes, interaction, onMoveClassBlock, onResizeClassBlock, onScheduleTask, resolveDragPreview, resolveResizePreview, timetable.classBlocks])

  const startTaskDrag = (event: React.PointerEvent<HTMLDivElement>, task: SharedTask, placement: TaskCalendarPlacement | null, dateISO: string) => {
    if (!isEditable) return
    event.preventDefault()
    const startMinutes = placement?.placementMode === 'timed' && typeof placement.startMinutes === 'number'
      ? placement.startMinutes
      : dayStartMinutes + 60
    const endMinutes = placement?.placementMode === 'timed' && typeof placement.endMinutes === 'number'
      ? placement.endMinutes
      : (startMinutes + DEFAULT_TASK_DURATION_MINUTES)
    const sourceDay = getWeekdayForDateISO(dateISO) ?? undefined
    setInteraction({
      mode: 'pending',
      kind: 'drag',
      itemType: 'task',
      entityId: task.id,
      title: task.title,
      subtitle: `${task.studentName} · ${task.taskType ?? 'Task'}`,
      accent: T.warning,
      sourceDay,
      sourceDateISO: dateISO,
      sourceStartMinutes: startMinutes,
      sourceEndMinutes: endMinutes,
      durationMinutes: Math.max(MIN_EVENT_DURATION_MINUTES, endMinutes - startMinutes),
      offsetMinutes: Math.max(MIN_EVENT_DURATION_MINUTES / 2, Math.min(endMinutes - startMinutes - 5, ((event.clientY - event.currentTarget.getBoundingClientRect().top) / AGENDA_PIXELS_PER_MINUTE))),
      startedAt: { x: event.clientX, y: event.clientY },
      cursor: { x: event.clientX, y: event.clientY },
    })
  }

  const startClassDrag = (event: React.PointerEvent<HTMLDivElement>, block: FacultyTimetableClassBlock, dateISO: string) => {
    if (!isEditable) return
    event.preventDefault()
    setInteraction({
      mode: 'pending',
      kind: 'drag',
      itemType: 'class',
      entityId: block.id,
      title: `${block.courseCode} · Sec ${block.section}`,
      subtitle: block.courseName,
      accent: T.accent,
      sourceDay: block.day,
      sourceDateISO: dateISO,
      sourceStartMinutes: block.startMinutes,
      sourceEndMinutes: block.endMinutes,
      durationMinutes: Math.max(MIN_EVENT_DURATION_MINUTES, block.endMinutes - block.startMinutes),
      offsetMinutes: Math.max(MIN_EVENT_DURATION_MINUTES / 2, Math.min(block.endMinutes - block.startMinutes - 5, ((event.clientY - event.currentTarget.getBoundingClientRect().top) / AGENDA_PIXELS_PER_MINUTE))),
      startedAt: { x: event.clientX, y: event.clientY },
      cursor: { x: event.clientX, y: event.clientY },
    })
  }

  const startClassResize = (event: React.PointerEvent<HTMLButtonElement>, block: FacultyTimetableClassBlock, dateISO: string, edge: 'start' | 'end') => {
    if (!isEditable) return
    event.preventDefault()
    event.stopPropagation()
    setInteraction({
      mode: 'pending',
      kind: 'resize',
      entityId: block.id,
      edge,
      day: block.day,
      dateISO,
      title: `${block.courseCode} · Sec ${block.section}`,
      subtitle: block.courseName,
      accent: T.accent,
      originalStartMinutes: block.startMinutes,
      originalEndMinutes: block.endMinutes,
      startedAt: { x: event.clientX, y: event.clientY },
      cursor: { x: event.clientX, y: event.clientY },
    })
  }

  const handleApplyBounds = () => {
    if (!isEditable) return
    const startMinutes = normalizeTimeValue(boundsDraft.start, dayStartMinutes)
    const endMinutes = normalizeTimeValue(boundsDraft.end, dayEndMinutes)
    const next = normalizeTimedRange(startMinutes, endMinutes, 0, 24 * 60, MIN_EVENT_DURATION_MINUTES * 2)
    if ((next.endMinutes - next.startMinutes) < 120) return
    onUpdateTimetableBounds({ dayStartMinutes: next.startMinutes, dayEndMinutes: next.endMinutes })
    setBoundsDraft({
      start: minutesToTimeString(next.startMinutes),
      end: minutesToTimeString(next.endMinutes),
    })
    setBoundsDirty(false)
  }

  return (
    <PageShell size="wide">
      <div ref={shellRef} style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 0, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <CalendarDays size={20} color={T.accent} />
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.text }}>Calendar / Timetable</div>
          </div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>
            Personal planning workspace for {currentTeacher.name} · merged role scope across {allowedRoles.join(' / ')}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
          <div style={{ display: 'inline-flex', gap: 6, padding: 4, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface2 }}>
            <button type="button" aria-label="Calendar mode" onClick={() => setMode('calendar')} style={segmentedButtonStyle(mode === 'calendar')}>
              <CalendarDays size={14} /> Calendar
            </button>
            <button type="button" aria-label="Timetable mode" onClick={() => setMode('timetable')} style={segmentedButtonStyle(mode === 'timetable')}>
              <Rows4 size={14} /> Timetable
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip color={T.accent} size={9}>Active role: {activeRole}</Chip>
            <Chip color={isEditable ? T.success : T.warning} size={9}>{isEditable ? 'Editable' : 'Read-only in this role'}</Chip>
            <Chip color={T.blue} size={9}>{mode === 'calendar' ? formatMonthLabel(monthAnchorISO) : formatWeekRange(selectedWeekStart)}</Chip>
          </div>
        </div>
      </div>

      {mode === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: pageWidth < 1180 ? 'minmax(0, 1fr)' : 'minmax(0, 1.7fr) minmax(360px, 1fr)', gap: 16, alignItems: 'start' }}>
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{formatMonthLabel(monthAnchorISO)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Select a date to open the detailed day plan.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" aria-label="Previous month" onClick={() => setMonthAnchorISO(addDaysISO(`${monthAnchorISO.slice(0, 7)}-15`, -31).slice(0, 7) + '-01')} style={iconButtonStyle()}>
                  <ChevronLeft size={15} />
                </button>
                <button type="button" aria-label="Next month" onClick={() => setMonthAnchorISO(addDaysISO(`${monthAnchorISO.slice(0, 7)}-15`, 31).slice(0, 7) + '-01')} style={iconButtonStyle()}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => (
                <div key={label} style={{ ...mono, fontSize: 10, color: T.dim, padding: '0 6px 6px' }}>{label}</div>
              ))}
              {monthCells.map(cell => {
                const summary = monthSummaryByDate[cell.dateISO] ?? { classCount: 0, taskCount: 0 }
                const isSelected = cell.dateISO === selectedDateISO
                const dayNumber = Number(cell.dateISO.slice(8, 10))
                return (
                  <button
                    key={cell.dateISO}
                    type="button"
                    aria-label={`Open ${cell.dateISO}`}
                    onClick={() => {
                      setSelectedDateISO(cell.dateISO)
                      setMonthAnchorISO(`${cell.dateISO.slice(0, 7)}-01`)
                    }}
                    style={{
                      minHeight: 106,
                      borderRadius: 14,
                      border: `1px solid ${isSelected ? T.accent : T.border}`,
                      background: isSelected ? `${T.accent}18` : cell.inCurrentMonth ? T.surface : T.surface2,
                      color: cell.inCurrentMonth ? T.text : T.muted,
                      padding: '10px 10px 12px',
                      cursor: 'pointer',
                      display: 'grid',
                      alignContent: 'space-between',
                      textAlign: 'left',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 14 }}>{dayNumber}</div>
                      {isSelected && <Chip color={T.accent} size={8}>Selected</Chip>}
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ ...mono, fontSize: 10, color: summary.classCount > 0 ? T.accent : T.dim }}>{summary.classCount} class{summary.classCount === 1 ? '' : 'es'}</div>
                      <div style={{ ...mono, fontSize: 10, color: summary.taskCount > 0 ? T.warning : T.dim }}>{summary.taskCount} task{summary.taskCount === 1 ? '' : 's'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card style={{ padding: '16px 18px', position: pageWidth < 1180 ? 'relative' : 'sticky', top: pageWidth < 1180 ? undefined : 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{formatShortDate(selectedDateISO)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Detailed day plan</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label="Previous day" onClick={() => {
                  const next = addDaysISO(selectedDateISO, -1)
                  setSelectedDateISO(next)
                  setMonthAnchorISO(`${next.slice(0, 7)}-01`)
                }} style={iconButtonStyle()}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" aria-label="Next day" onClick={() => {
                  const next = addDaysISO(selectedDateISO, 1)
                  setSelectedDateISO(next)
                  setMonthAnchorISO(`${next.slice(0, 7)}-01`)
                }} style={iconButtonStyle()}>
                  <ChevronRight size={14} />
                </button>
                <Btn size="sm" variant="ghost" onClick={() => setMode('timetable')}>Expand</Btn>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <Chip color={selectedWeekday ? T.success : T.warning} size={9}>{selectedWeekday ? `${selectedWeekday} plan` : 'Sunday view'}</Chip>
              <Chip color={T.accent} size={9}>{facultyOfferings.length} mapped classes</Chip>
            </div>

            {selectedWeekday ? (
              <AgendaBoard
                columns={dayColumns}
                dayStartMinutes={dayStartMinutes}
                dayEndMinutes={dayEndMinutes}
                editable={isEditable}
                variant="day"
                hoverAdd={hoverAdd}
                interaction={interaction}
                onHoverColumn={setHoverAdd}
                onOpenAdd={setAddTarget}
                onTaskDragStart={startTaskDrag}
                onClassDragStart={startClassDrag}
                onClassResizeStart={startClassResize}
                onMoveTaskToUntimed={(taskId, dateISO) => onScheduleTask(taskId, { dateISO, placementMode: 'untimed' })}
                onDismissTask={onDismissTask}
                onDismissCurrentOccurrence={onDismissCurrentOccurrence}
                onDismissSeries={onDismissSeries}
                setColumnRef={(dateISO, node) => { columnRefs.current[dateISO] = node }}
                setUntimedBucketRef={(dateISO, node) => { untimedBucketRefs.current[dateISO] = node }}
              />
            ) : (
              <Card style={{ padding: '14px 16px' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4 }}>Sunday stays unscheduled</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Select any Monday to Saturday date for freeform timetable planning.</div>
              </Card>
            )}
          </Card>
        </div>
      )}

      {mode === 'timetable' && (
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Weekly Timetable</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Exact-time weekly canvas for recurring classes and scheduled queue work.</div>
            </div>
            <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" aria-label="Previous week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, -7))} style={iconButtonStyle()}>
                  <ChevronLeft size={15} />
                </button>
                <Chip color={T.blue} size={10}>{formatWeekRange(selectedWeekStart)}</Chip>
                <button type="button" aria-label="Next week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, 7))} style={iconButtonStyle()}>
                  <ChevronRight size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ ...mono, fontSize: 10, color: T.muted }}>Day bounds</span>
                <input aria-label="Timetable day start" type="time" value={visibleBounds.start} onChange={event => {
                  setBoundsDirty(true)
                  setBoundsDraft(prev => ({ ...prev, start: event.target.value }))
                }} disabled={!isEditable} style={timeInputStyle(!isEditable)} />
                <input aria-label="Timetable day end" type="time" value={visibleBounds.end} onChange={event => {
                  setBoundsDirty(true)
                  setBoundsDraft(prev => ({ ...prev, end: event.target.value }))
                }} disabled={!isEditable} style={timeInputStyle(!isEditable)} />
                {isEditable && <Btn size="sm" variant="ghost" onClick={handleApplyBounds}>Update bounds</Btn>}
              </div>
            </div>
          </div>

          <AgendaBoard
            columns={weekColumns}
            dayStartMinutes={dayStartMinutes}
            dayEndMinutes={dayEndMinutes}
            editable={isEditable}
            variant="week"
            hoverAdd={hoverAdd}
            interaction={interaction}
            onHoverColumn={setHoverAdd}
            onSelectDate={setSelectedDateISO}
            onOpenAdd={setAddTarget}
            onTaskDragStart={startTaskDrag}
            onClassDragStart={startClassDrag}
            onClassResizeStart={startClassResize}
            onMoveTaskToUntimed={(taskId, dateISO) => onScheduleTask(taskId, { dateISO, placementMode: 'untimed' })}
            onDismissTask={onDismissTask}
            onDismissCurrentOccurrence={onDismissCurrentOccurrence}
            onDismissSeries={onDismissSeries}
            setColumnRef={(dateISO, node) => { columnRefs.current[dateISO] = node }}
            setUntimedBucketRef={(dateISO, node) => { untimedBucketRefs.current[dateISO] = node }}
          />
        </Card>
      )}

      {addTarget && (
        <TaskPlacementSheet
          target={addTarget}
          queueCandidates={queueCandidates}
          onClose={() => setAddTarget(null)}
          onPlaceTask={taskId => {
            onScheduleTask(taskId, {
              dateISO: addTarget.dateISO,
              placementMode: addTarget.initialMode,
              startMinutes: addTarget.startMinutes,
              endMinutes: addTarget.endMinutes,
            })
            setAddTarget(null)
          }}
          onCreateNewTask={() => {
            onOpenTaskComposer({
              dueDateISO: addTarget.dateISO,
              availableOfferingIds: facultyOfferings.map(offering => offering.offId),
              placement: {
                dateISO: addTarget.dateISO,
                placementMode: addTarget.initialMode,
                startMinutes: addTarget.startMinutes,
                endMinutes: addTarget.endMinutes,
              },
            })
            setAddTarget(null)
          }}
        />
      )}

      <AnimatePresence>
        {interaction?.mode === 'active' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 0.98, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: interaction.cursor.x + 16,
              top: interaction.cursor.y + 12,
              zIndex: 180,
              pointerEvents: 'none',
              width: 220,
              borderRadius: 14,
              border: `1px solid ${interaction.accent}55`,
              background: `${T.surface}`,
              boxShadow: `0 18px 40px ${interaction.accent}20`,
              padding: '10px 12px',
            }}
          >
            <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {interaction.kind === 'resize' ? 'Resizing' : 'Moving'}
            </div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{interaction.title}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{interaction.subtitle}</div>
            {interaction.preview?.placementMode === 'timed' && typeof interaction.preview.startMinutes === 'number' && typeof interaction.preview.endMinutes === 'number' && (
              <div style={{ ...mono, fontSize: 10, color: interaction.preview.valid ? T.accent : T.danger, marginTop: 6 }}>
                {interaction.preview.dateISO} · {minutesToDisplayLabel(interaction.preview.startMinutes)} - {minutesToDisplayLabel(interaction.preview.endMinutes)}
              </div>
            )}
            {interaction.preview?.placementMode === 'untimed' && (
              <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 6 }}>
                {interaction.preview.dateISO} · No preferred time
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </PageShell>
  )
}

function AgendaBoard({
  columns,
  dayStartMinutes,
  dayEndMinutes,
  editable,
  variant,
  hoverAdd,
  interaction,
  onHoverColumn,
  onSelectDate,
  onOpenAdd,
  onTaskDragStart,
  onClassDragStart,
  onClassResizeStart,
  onMoveTaskToUntimed,
  onDismissTask,
  onDismissCurrentOccurrence,
  onDismissSeries,
  setColumnRef,
  setUntimedBucketRef,
}: AgendaBoardProps) {
  const guides = useMemo(() => buildTimeGuides(dayStartMinutes, dayEndMinutes), [dayEndMinutes, dayStartMinutes])
  const boardHeight = Math.max(420, (dayEndMinutes - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {variant === 'week' && (
        <HScrollArea style={{ paddingBottom: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `86px repeat(${columns.length}, minmax(${DAY_COLUMN_MIN_WIDTH}px, 1fr))`, gap: 10, minWidth: 86 + columns.length * DAY_COLUMN_MIN_WIDTH + Math.max(0, columns.length - 1) * 10 }}>
          <div />
          {columns.map(column => (
            <button
              key={`${column.dateISO}-header`}
              type="button"
              onClick={() => onSelectDate?.(column.dateISO)}
              style={{
                borderRadius: 12,
                border: `1px solid ${column.selected ? T.accent : T.border}`,
                background: column.selected ? `${T.accent}16` : T.surface2,
                padding: '10px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>{column.day}</div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginTop: 2 }}>{column.label}</div>
            </button>
          ))}
        </div>
        </HScrollArea>
      )}

      <HScrollArea style={{ paddingBottom: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `86px repeat(${columns.length}, minmax(${DAY_COLUMN_MIN_WIDTH}px, 1fr))`, gap: 10, alignItems: 'start', minWidth: 86 + columns.length * DAY_COLUMN_MIN_WIDTH + Math.max(0, columns.length - 1) * 10 }}>
        <div style={{ position: 'relative', height: boardHeight }}>
          {guides.map(minute => (
            <div key={`guide-${minute}`} style={{ position: 'absolute', top: (minute - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE - 8, left: 0, right: 0 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>{minutesToTimeString(minute)}</div>
            </div>
          ))}
        </div>

        {columns.map(column => {
          const layout = assignAgendaLanes(column.events)
          return (
            <div key={column.dateISO} style={{ display: 'grid', gap: 10 }}>
              {variant === 'day' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>{column.day}</div>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{column.label}</div>
                  </div>
                </div>
              )}

              <div
                ref={node => setColumnRef(column.dateISO, node)}
                onMouseLeave={() => onHoverColumn(hoverAdd?.dateISO === column.dateISO ? null : hoverAdd)}
                onMouseMove={event => {
                  if (!editable || interaction) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  const relativeMinute = clampMinuteValue((event.clientY - rect.top) / AGENDA_PIXELS_PER_MINUTE, 0, dayEndMinutes - dayStartMinutes)
                  const startMinutes = clampMinuteValue(dayStartMinutes + relativeMinute, dayStartMinutes, dayEndMinutes - DEFAULT_TASK_DURATION_MINUTES)
                  const range = normalizeTimedRange(startMinutes, startMinutes + DEFAULT_TASK_DURATION_MINUTES, dayStartMinutes, dayEndMinutes)
                  onHoverColumn({
                    dateISO: column.dateISO,
                    day: column.day,
                    topPx: (range.startMinutes - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE,
                    startMinutes: range.startMinutes,
                    endMinutes: range.endMinutes,
                  })
                }}
                style={{
                  position: 'relative',
                  height: boardHeight,
                  borderRadius: 16,
                  border: `1px solid ${column.selected ? T.accent : T.border}`,
                  background: column.selected ? `${T.accent}08` : T.surface,
                  overflow: 'hidden',
                }}
              >
                {guides.map(minute => (
                  <div
                    key={`${column.dateISO}-${minute}`}
                    style={{
                      position: 'absolute',
                      top: (minute - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE,
                      left: 0,
                      right: 0,
                      borderTop: `1px solid ${minute === dayStartMinutes ? 'transparent' : T.border2}`,
                    }}
                  />
                ))}

                {editable && hoverAdd?.dateISO === column.dateISO && !interaction && (
                  <button
                    type="button"
                    aria-label={`Add timed task on ${column.dateISO}`}
                    onClick={() => onOpenAdd({
                      dateISO: column.dateISO,
                      initialMode: 'timed',
                      startMinutes: hoverAdd.startMinutes,
                      endMinutes: hoverAdd.endMinutes,
                    })}
                    style={{
                      position: 'absolute',
                      top: Math.max(8, Math.min(boardHeight - 32, hoverAdd.topPx)),
                      right: 10,
                      zIndex: 4,
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      border: `1px solid ${T.accent}48`,
                      background: `${T.accent}16`,
                      color: T.accent,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 6px 20px ${T.accent}15`,
                    }}
                  >
                    <Plus size={13} />
                  </button>
                )}

                {layout.map(event => (
                  <TimedEventBlock
                    key={event.renderId}
                    event={event}
                    dayStartMinutes={dayStartMinutes}
                    lane={event.lane}
                    laneCount={event.laneCount}
                    isGhosted={interaction?.mode === 'active' && interaction.entityId === event.entityId && event.eventType !== 'preview'}
                    onTaskDragStart={onTaskDragStart}
                    onClassDragStart={onClassDragStart}
                    onClassResizeStart={onClassResizeStart}
                    onMoveTaskToUntimed={onMoveTaskToUntimed}
                    onDismissTask={onDismissTask}
                    onDismissCurrentOccurrence={onDismissCurrentOccurrence}
                    onDismissSeries={onDismissSeries}
                    editable={editable}
                  />
                ))}
              </div>

              <div
                ref={node => setUntimedBucketRef(column.dateISO, node)}
                style={{
                  minHeight: 112,
                  borderRadius: 14,
                  border: `1px dashed ${T.border2}`,
                  background: hoverUntimedBucket(interaction, column.dateISO) ? `${T.warning}12` : T.surface2,
                  padding: '12px 12px 14px',
                  display: 'grid',
                  gap: 8,
                  alignContent: 'start',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>Untimed Day Tasks</div>
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>No preferred time</div>
                  </div>
                  {editable && (
                    <Btn size="sm" variant="ghost" onClick={() => onOpenAdd({ dateISO: column.dateISO, initialMode: 'untimed' })}>
                      <Plus size={12} /> Add
                    </Btn>
                  )}
                </div>

                {column.untimedTasks.map(task => (
                  <motion.div
                    key={`untimed-${task.id}`}
                    layout
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    onPointerDown={event => onTaskDragStart(event, task, null, column.dateISO)}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${T.warning}32`,
                      background: `${T.warning}18`,
                      padding: '10px 12px',
                      cursor: editable ? 'grab' : 'default',
                      opacity: interaction?.mode === 'active' && interaction.entityId === task.id ? 0.28 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{task.title}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{task.studentName} · {task.taskType ?? 'Task'}</div>
                      </div>
                      {editable && (
                        <TaskActionStrip
                          task={task}
                          compact
                          onDismissTask={onDismissTask}
                          onDismissCurrentOccurrence={onDismissCurrentOccurrence}
                          onDismissSeries={onDismissSeries}
                        />
                      )}
                    </div>
                  </motion.div>
                ))}
                {column.untimedTasks.length === 0 && (
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>No untimed tasks for this day.</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      </HScrollArea>
    </div>
  )
}

function TimedEventBlock({
  event,
  dayStartMinutes,
  lane,
  laneCount,
  isGhosted,
  onTaskDragStart,
  onClassDragStart,
  onClassResizeStart,
  onMoveTaskToUntimed,
  onDismissTask,
  onDismissCurrentOccurrence,
  onDismissSeries,
  editable,
}: {
  event: TimedEventCard & { laneCount: number; lane: number }
  dayStartMinutes: number
  lane: number
  laneCount: number
  isGhosted: boolean
  onTaskDragStart: AgendaBoardProps['onTaskDragStart']
  onClassDragStart: AgendaBoardProps['onClassDragStart']
  onClassResizeStart: AgendaBoardProps['onClassResizeStart']
  onMoveTaskToUntimed: AgendaBoardProps['onMoveTaskToUntimed']
  onDismissTask: (taskId: string) => void
  onDismissCurrentOccurrence: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
  editable: boolean
}) {
  const top = (event.startMinutes - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE
  const height = Math.max(46, (event.endMinutes - event.startMinutes) * AGENDA_PIXELS_PER_MINUTE)
  const width = laneCount <= 1 ? 'calc(100% - 16px)' : `calc(${100 / laneCount}% - 8px)`
  const left = laneCount <= 1 ? 8 : `calc(${lane * (100 / laneCount)}% + ${lane * 8 + 8}px)`
  const isTask = event.eventType === 'task' && !!event.task
  const isClass = event.eventType === 'class' && !!event.classBlock
  const compact = height < 78

  const baseStyle = {
    position: 'absolute' as const,
    top,
    left,
    width,
    minHeight: height,
    borderRadius: 14,
    border: `1px solid ${event.invalid ? T.danger : `${event.accent}48`}`,
    background: event.invalid ? `${T.danger}18` : `${event.accent}18`,
    boxShadow: event.invalid ? `0 0 0 1px ${T.danger}20 inset` : `0 10px 24px ${event.accent}14`,
    padding: '10px 12px',
    display: 'grid',
    gap: 6,
    opacity: isGhosted ? 0.24 : 1,
    cursor: editable && event.eventType !== 'preview' ? 'grab' : 'default',
    overflow: 'hidden',
  }

  const dragHandler = editable && isTask
    ? (evt: React.PointerEvent<HTMLDivElement>) => onTaskDragStart(evt, event.task!, event.placement ?? null, event.dateISO)
    : editable && isClass
      ? (evt: React.PointerEvent<HTMLDivElement>) => onClassDragStart(evt, event.classBlock!, event.dateISO)
      : undefined

  return (
    <motion.div layout transition={{ duration: 0.18, ease: 'easeOut' }} onPointerDown={dragHandler} style={baseStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text, lineHeight: 1.25 }}>{event.title}</div>
          {!compact && <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{event.subtitle}</div>}
        </div>
        {event.eventType !== 'preview' && editable && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {isClass && (
              <>
                <button type="button" aria-label={`Resize start of ${event.title}`} onPointerDown={evt => onClassResizeStart(evt, event.classBlock!, event.dateISO, 'start')} style={edgeHandleStyle()}>
                  <GripVertical size={11} />
                </button>
                <button type="button" aria-label={`Resize end of ${event.title}`} onPointerDown={evt => onClassResizeStart(evt, event.classBlock!, event.dateISO, 'end')} style={edgeHandleStyle()}>
                  <GripVertical size={11} />
                </button>
              </>
            )}
            {isTask && (
              <button
                type="button"
                aria-label={`Move ${event.title} to untimed`}
                onPointerDown={evt => evt.stopPropagation()}
                onClick={evt => {
                  evt.stopPropagation()
                  onMoveTaskToUntimed(event.task!.id, event.dateISO)
                }}
                style={miniIconButtonStyle()}
              >
                <Clock3 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ ...mono, fontSize: 10, color: event.invalid ? T.danger : T.dim }}>
        {minutesToDisplayLabel(event.startMinutes)} - {minutesToDisplayLabel(event.endMinutes)}
      </div>

      {!compact && event.eventType !== 'preview' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <GripVertical size={10} /> {editable ? 'Drag to move' : 'Scheduled'}
          </div>
          {isTask && editable && (
            <TaskActionStrip
              task={event.task!}
              onDismissTask={onDismissTask}
              onDismissCurrentOccurrence={onDismissCurrentOccurrence}
              onDismissSeries={onDismissSeries}
            />
          )}
        </div>
      )}
    </motion.div>
  )
}

function TaskActionStrip({
  task,
  compact = false,
  onDismissTask,
  onDismissCurrentOccurrence,
  onDismissSeries,
}: {
  task: SharedTask
  compact?: boolean
  onDismissTask: (taskId: string) => void
  onDismissCurrentOccurrence: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
}) {
  const recurring = task.scheduleMeta?.mode === 'scheduled'
  const canDismissOccurrence = canDismissCurrentOccurrence(task)

  return (
    <div style={{ display: 'flex', gap: compact ? 4 : 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {!recurring && (
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={event => {
          event.stopPropagation()
          onDismissTask(task.id)
        }} style={taskTextButtonStyle(compact)}>
          Dismiss
        </button>
      )}
      {recurring && (
        <>
          <button type="button" disabled={!canDismissOccurrence} onPointerDown={event => event.stopPropagation()} onClick={event => {
            event.stopPropagation()
            if (!canDismissOccurrence) return
            onDismissCurrentOccurrence(task.id)
          }} style={taskTextButtonStyle(compact, !canDismissOccurrence)}>
            Dismiss current
          </button>
          <button type="button" onPointerDown={event => event.stopPropagation()} onClick={event => {
            event.stopPropagation()
            onDismissSeries(task.id)
          }} style={taskTextButtonStyle(compact)}>
            Dismiss series
          </button>
        </>
      )}
    </div>
  )
}

function TaskPlacementSheet({
  target,
  queueCandidates,
  onClose,
  onPlaceTask,
  onCreateNewTask,
}: {
  target: AddTargetState
  queueCandidates: SharedTask[]
  onClose: () => void
  onPlaceTask: (taskId: string) => void
  onCreateNewTask: () => void
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '82vh', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16 }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Add to {formatShortDate(target.dateISO)}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {target.initialMode === 'untimed'
                  ? 'No preferred time for this date'
                  : `${minutesToDisplayLabel(target.startMinutes ?? 0)} - ${minutesToDisplayLabel(target.endMinutes ?? 0)} · exact timed placement`}
              </div>
            </div>
            <button type="button" aria-label="Close add sheet" onClick={onClose} style={iconButtonStyle()}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="scroll-pane scroll-pane--dense" style={{ overflowY: 'auto', padding: 18, display: 'grid', gap: 10 }}>
          {queueCandidates.map(task => (
            <div key={task.id} style={{ borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, padding: '12px 14px', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{task.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{task.studentName} · {task.courseCode} · {task.taskType ?? 'Task'}</div>
                </div>
                <Chip color={task.scheduleMeta?.mode === 'scheduled' ? T.warning : T.success} size={9}>{task.scheduleMeta?.mode === 'scheduled' ? 'Recurring' : 'One-time'}</Chip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim }}>This updates the same queue item and places it directly into the workspace.</div>
                <Btn size="sm" onClick={() => onPlaceTask(task.id)}>Place here</Btn>
              </div>
            </div>
          ))}
          {queueCandidates.length === 0 && (
            <div style={{ ...mono, fontSize: 11, color: T.dim, textAlign: 'center', padding: '24px 12px' }}>
              No active queue items are available in your current merged scope.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Need something new instead of reusing queue state?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
            <Btn size="sm" onClick={onCreateNewTask}>
              <Plus size={12} /> Create New Task
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function hoverUntimedBucket(interaction: InteractionState | null, dateISO: string) {
  return interaction?.mode === 'active' && interaction.preview?.placementMode === 'untimed' && interaction.preview.dateISO === dateISO
}

function normalizeTimeValue(value: string, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallback
  return (hours * 60) + minutes
}

function segmentedButtonStyle(active: boolean) {
  return {
    border: 'none',
    borderRadius: 999,
    background: active ? T.accent : 'transparent',
    color: active ? '#fff' : T.muted,
    padding: '8px 14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    ...mono,
    fontSize: 11,
    transition: 'all 0.15s ease',
  } as const
}

function iconButtonStyle() {
  return {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface2,
    color: T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

function miniIconButtonStyle() {
  return {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface,
    color: T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

function edgeHandleStyle() {
  return {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface,
    color: T.muted,
    cursor: 'ns-resize',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

function taskTextButtonStyle(compact: boolean, disabled = false) {
  return {
    border: 'none',
    background: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? T.dim : T.muted,
    ...mono,
    fontSize: compact ? 9 : 10,
    padding: 0,
    opacity: disabled ? 0.5 : 1,
  } as const
}

function timeInputStyle(disabled: boolean) {
  return {
    ...mono,
    fontSize: 10,
    background: disabled ? T.surface3 : T.surface2,
    color: disabled ? T.dim : T.text,
    border: `1px solid ${T.border2}`,
    borderRadius: 8,
    padding: '6px 8px',
  } as const
}
