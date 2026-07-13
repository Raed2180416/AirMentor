import { useEffect, useMemo, useRef, useState } from 'react'
import { T, type Offering } from '@web/simulation/fixtures'
import type { SharedTask, TaskCalendarPlacement } from '@kernel/shared/domain'
import { isTaskDismissed } from '@kernel/shared/domain'
import {
  WEEKDAY_ORDER,
  buildMonthGrid,
  classBlockOccursOnDate,
  getWeekDates,
  getWeekdayForDateISO,
  minutesToTimeString,
  startOfWeekISO,
} from '@web/shared/state/calendar-utils'
import { resolveCalendarAnchorDateISO } from './calendar-helpers'
import { describeMarkerType, markerAccent, markerSpansDate } from './marker-utils'
import type {
  AddTargetState,
  BlockDetailsState,
  CalendarTimetablePageProps,
  ClassEditState,
  ExtraClassDraftState,
  HoverAddState,
  InteractionState,
} from './types'

export function useCalendarBaseState(props: CalendarTimetablePageProps) {
  const {
    currentDateISO,
    editableOverride,
    activeRole,
    canOpenCourseWorkspaceOverride,
    calendarModeLayout = 'split',
    facultyOfferings,
    mergedTasks,
    meetings,
    resolvedTaskIds,
    timetable,
    adminMarkers,
    taskPlacements,
  } = props

  const calendarAnchorDateISO = resolveCalendarAnchorDateISO(currentDateISO)
  const [mode, setMode] = useState<'calendar' | 'timetable'>('calendar')
  const [selectedDateISO, setSelectedDateISO] = useState(() => calendarAnchorDateISO)
  const [monthAnchorISO, setMonthAnchorISO] = useState(() => `${calendarAnchorDateISO.slice(0, 7)}-01`)
  // Track the last proof anchor we synced so we can detect checkpoint changes
  // and update selection during the render phase (no effect needed).
  const [syncedAnchor, setSyncedAnchor] = useState(calendarAnchorDateISO)
  if (currentDateISO && syncedAnchor !== calendarAnchorDateISO) {
    setSyncedAnchor(calendarAnchorDateISO)
    setSelectedDateISO(calendarAnchorDateISO)
    setMonthAnchorISO(`${calendarAnchorDateISO.slice(0, 7)}-01`)
  }
  const [addTarget, setAddTarget] = useState<AddTargetState | null>(null)
  const [extraClassDraft, setExtraClassDraft] = useState<ExtraClassDraftState | null>(null)
  const [detailsState, setDetailsState] = useState<BlockDetailsState | null>(null)
  const [classEdit, setClassEdit] = useState<ClassEditState | null>(null)
  const [hoverAdd, setHoverAdd] = useState<HoverAddState | null>(null)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [boundsDraft, setBoundsDraft] = useState(() => ({
    start: minutesToTimeString(timetable.dayStartMinutes),
    end: minutesToTimeString(timetable.dayEndMinutes),
  }))
  const [boundsDirty, setBoundsDirty] = useState(false)

  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const untimedBucketRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Ref-map setters co-located with their useRef so the mutation is on a locally
  // owned ref (react-hooks/immutability), then passed through by the coordinator.
  const setColumnRef = (dateISO: string, node: HTMLDivElement | null) => { columnRefs.current[dateISO] = node }
  const setUntimedBucketRef = (dateISO: string, node: HTMLDivElement | null) => { untimedBucketRefs.current[dateISO] = node }
  const shellRef = useRef<HTMLDivElement | null>(null)
  const suppressDetailClickUntilRef = useRef(0)
  const [pageWidth, setPageWidth] = useState(1400)

  const isEditable = editableOverride ?? activeRole === 'Course Leader'
  const canOpenCourseWorkspace = canOpenCourseWorkspaceOverride ?? activeRole !== 'Mentor'
  const showCalendarDayPanel = calendarModeLayout !== 'month-only'
  const offeringIds = useMemo(() => new Set(facultyOfferings.map(offering => offering.offId)), [facultyOfferings])
  const offeringsById = useMemo(() => Object.fromEntries(facultyOfferings.map(offering => [offering.offId, offering])) as Record<string, Offering>, [facultyOfferings])
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
    const summary = {} as Record<string, { classCount: number; taskCount: number; markerCount: number }>
    monthCells.forEach(cell => {
      const weekday = getWeekdayForDateISO(cell.dateISO)
      const classCount = weekday ? timetable.classBlocks.filter(block => classBlockOccursOnDate(block, cell.dateISO, weekday)).length : 0
      const taskCount = (taskPlacementsByDate[cell.dateISO] ?? []).length
      const markerCount = adminMarkers.filter(marker => markerSpansDate(marker, cell.dateISO)).length
      summary[cell.dateISO] = { classCount, taskCount, markerCount }
    })
    return summary
  }, [adminMarkers, monthCells, taskPlacementsByDate, timetable.classBlocks])

  const buildTimedEventsForDate = useMemo(() => {
    return (dateISO: string) => {
      const weekday = getWeekdayForDateISO(dateISO)
      const previewHiddenEntityIds = interaction?.mode === 'active'
        ? new Set([
            interaction.entityId,
            ...(interaction.preview?.shiftedClassPreviews?.map(item => item.entityId) ?? []),
          ])
        : null
      const classEvents = weekday
        ? timetable.classBlocks
            .filter(block => !previewHiddenEntityIds?.has(block.id))
            .filter(block => classBlockOccursOnDate(block, dateISO, weekday))
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
              subtitle: block.kind === 'extra' ? `${block.courseName} · Extra class` : block.courseName,
              accent: T.accent,
              classBlock: block,
            }))
        : []
      const taskEvents = (taskPlacementsByDate[dateISO] ?? [])
        .filter(placement => placement.placementMode === 'timed')
        .filter(placement => !previewHiddenEntityIds?.has(placement.taskId))
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
      const markerEvents = adminMarkers
        .filter(marker => !marker.allDay)
        .filter(marker => markerSpansDate(marker, dateISO))
        .flatMap(marker => {
          const day = getWeekdayForDateISO(dateISO)
          if (!day || marker.startMinutes == null || marker.endMinutes == null) return []
          return [{
            id: `marker-${marker.markerId}-${dateISO}`,
            renderId: `marker-${marker.markerId}-${dateISO}`,
            entityId: marker.markerId,
            eventType: 'marker' as const,
            dateISO,
            day,
            startMinutes: marker.startMinutes,
            endMinutes: marker.endMinutes,
            title: marker.title,
            subtitle: `${describeMarkerType(marker.markerType)}${marker.note ? ` · ${marker.note}` : ''}`,
            accent: markerAccent(marker.markerType),
            marker,
          }]
        })
      const meetingEvents = meetings
        .filter(meeting => meeting.dateISO === dateISO)
        .map(meeting => ({
          id: `meeting-${meeting.meetingId}`,
          renderId: `meeting-${meeting.meetingId}`,
          entityId: meeting.meetingId,
          eventType: 'meeting' as const,
          dateISO,
          day: getWeekdayForDateISO(dateISO) ?? WEEKDAY_ORDER[0],
          startMinutes: meeting.startMinutes,
          endMinutes: meeting.endMinutes,
          title: meeting.title,
          subtitle: `${meeting.studentName}${meeting.courseCode ? ` · ${meeting.courseCode}` : ''}`,
          accent: meeting.status === 'completed' ? T.success : meeting.status === 'cancelled' ? T.danger : T.blue,
          meeting,
        }))

      const previewEvents = interaction?.mode === 'active' && interaction.preview?.placementMode === 'timed' && interaction.preview.dateISO === dateISO && interaction.preview.day
        && typeof interaction.preview.startMinutes === 'number' && typeof interaction.preview.endMinutes === 'number'
        ? [
            {
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
            },
            ...(interaction.preview.shiftedClassPreviews
              ?.filter(item => item.dateISO === dateISO)
              .map(item => ({
                id: `preview-linked-${item.entityId}`,
                renderId: `preview-linked-${item.entityId}`,
                entityId: item.entityId,
                eventType: 'preview' as const,
                dateISO,
                day: item.day,
                startMinutes: item.startMinutes,
                endMinutes: item.endMinutes,
                title: item.title,
                subtitle: item.subtitle,
                accent: item.accent,
                invalid: !(interaction.preview?.valid ?? false),
              })) ?? []),
          ]
        : []

      const addTargetPreview = addTarget?.placementMode === 'timed' && addTarget.dateISO === dateISO
        && typeof addTarget.startMinutes === 'number' && typeof addTarget.endMinutes === 'number' && weekday
        ? [{
            id: `preview-add-${dateISO}`,
            renderId: `preview-add-${dateISO}`,
            entityId: `preview-add-${dateISO}`,
            eventType: 'preview' as const,
            dateISO,
            day: weekday,
            startMinutes: addTarget.startMinutes,
            endMinutes: addTarget.endMinutes,
            title: 'New task placement',
            subtitle: 'Adjust time, then choose an existing task or create a new one.',
            accent: T.success,
          }]
        : []

      return [...classEvents, ...taskEvents, ...meetingEvents, ...markerEvents, ...previewEvents, ...addTargetPreview]
    }
  }, [activeTasksById, addTarget, adminMarkers, interaction, meetings, taskPlacementsByDate, timetable.classBlocks])

  const buildAllDayMarkersForDate = useMemo(() => {
    return (dateISO: string) => adminMarkers
      .filter(marker => marker.allDay)
      .filter(marker => markerSpansDate(marker, dateISO))
      .map(marker => ({
        markerId: marker.markerId,
        title: marker.title,
        subtitle: marker.note ?? describeMarkerType(marker.markerType),
        accent: markerAccent(marker.markerType),
        marker,
      }))
  }, [adminMarkers])

  const buildUntimedTasksForDate = useMemo(() => {
    return (dateISO: string) => (taskPlacementsByDate[dateISO] ?? [])
      .filter(placement => placement.placementMode === 'untimed')
      .map(placement => activeTasksById[placement.taskId])
      .filter((task): task is SharedTask => !!task)
  }, [activeTasksById, taskPlacementsByDate])

  return {
    mode,
    setMode,
    selectedDateISO,
    setSelectedDateISO,
    monthAnchorISO,
    setMonthAnchorISO,
    addTarget,
    setAddTarget,
    extraClassDraft,
    setExtraClassDraft,
    detailsState,
    setDetailsState,
    classEdit,
    setClassEdit,
    hoverAdd,
    setHoverAdd,
    interaction,
    setInteraction,
    boundsDraft,
    setBoundsDraft,
    boundsDirty,
    setBoundsDirty,
    columnRefs,
    untimedBucketRefs,
    setColumnRef,
    setUntimedBucketRef,
    shellRef,
    suppressDetailClickUntilRef,
    pageWidth,
    isEditable,
    canOpenCourseWorkspace,
    showCalendarDayPanel,
    offeringsById,
    activeTasksById,
    queueCandidates,
    weekDates,
    monthCells,
    selectedWeekStart,
    selectedWeekday,
    dayStartMinutes,
    dayEndMinutes,
    visibleBounds,
    taskPlacementsByDate,
    monthSummaryByDate,
    buildTimedEventsForDate,
    buildAllDayMarkersForDate,
    buildUntimedTasksForDate,
  }
}

export type CalendarBaseState = ReturnType<typeof useCalendarBaseState>
