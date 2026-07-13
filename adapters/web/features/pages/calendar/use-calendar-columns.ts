import { useCallback, useMemo } from 'react'
import { T } from '@web/simulation/fixtures'
import {
  WEEKDAY_ORDER,
  classBlockOccursOnDate,
  clampMinuteValue,
  clampRangeToDayBounds,
  formatShortDate,
  getWeekdayForDateISO,
  reflowClassDayRanges,
} from '@web/shared/state/calendar-utils'
import { AGENDA_PIXELS_PER_MINUTE, SNAP_THRESHOLD_MINUTES } from './constants'
import type { CalendarBaseState } from './use-calendar-base-state'
import type {
  ActiveDrag,
  ActiveResize,
  CalendarTimetablePageProps,
  PendingDrag,
  PendingResize,
  PreviewState,
  TimedColumnData,
} from './types'

export function useCalendarColumns(props: CalendarTimetablePageProps, base: CalendarBaseState) {
  const { timetable, meetings, adminMarkers, taskPlacements } = props
  const {
    taskPlacementsByDate,
    activeTasksById,
    offeringsById,
    dayStartMinutes,
    dayEndMinutes,
    selectedDateISO,
    selectedWeekday,
    weekDates,
    detailsState,
    buildTimedEventsForDate,
    buildAllDayMarkersForDate,
    buildUntimedTasksForDate,
    columnRefs,
    untimedBucketRefs,
  } = base

  const getTimedNeighbors = useCallback((dateISO: string, exclude: { taskId?: string; classId?: string } = {}) => {
    const weekday = getWeekdayForDateISO(dateISO)
    const classNeighbors = weekday
      ? timetable.classBlocks
          .filter(block => block.id !== exclude.classId)
          .filter(block => classBlockOccursOnDate(block, dateISO, weekday))
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

  const buildClassPreviewState = useCallback((dateISO: string, classId: string, desiredStartMinutes: number, desiredEndMinutes: number): PreviewState => {
    const day = getWeekdayForDateISO(dateISO)
    const targetBlock = timetable.classBlocks.find(block => block.id === classId)
    if (!day) {
      return {
        placementMode: 'timed' as const,
        dateISO,
        valid: false,
      }
    }
    if (!targetBlock) {
      return {
        placementMode: 'timed' as const,
        dateISO,
        day,
        startMinutes: desiredStartMinutes,
        endMinutes: desiredEndMinutes,
        valid: false,
      }
    }
    const reflowed = reflowClassDayRanges({
      blocks: [
        ...timetable.classBlocks.filter(block => block.id !== classId && classBlockOccursOnDate(block, dateISO, day)),
        { ...targetBlock, day, dateISO: targetBlock.kind === 'extra' ? dateISO : targetBlock.dateISO },
      ],
      targetId: classId,
      desiredStartMinutes,
      desiredEndMinutes,
      dayStartMinutes,
      dayEndMinutes,
      snapThresholdMinutes: SNAP_THRESHOLD_MINUTES,
    })
    if (!reflowed) {
      return {
        placementMode: 'timed' as const,
        dateISO,
        day,
        startMinutes: desiredStartMinutes,
        endMinutes: desiredEndMinutes,
        valid: false,
      }
    }

    return {
      placementMode: 'timed' as const,
      dateISO,
      day,
      startMinutes: reflowed.targetRange.startMinutes,
      endMinutes: reflowed.targetRange.endMinutes,
      valid: true,
      shiftedClassPreviews: reflowed.changedBlockIds
        .filter(id => id !== classId)
        .flatMap(id => {
          const block = timetable.classBlocks.find(item => item.id === id)
          const nextRange = reflowed.rangesById[id]
          if (!block || !nextRange) return []
          return [{
            entityId: block.id,
            dateISO,
            day,
            startMinutes: nextRange.startMinutes,
            endMinutes: nextRange.endMinutes,
            title: `${block.courseCode} · Sec ${block.section}`,
            subtitle: block.courseName,
            accent: T.accent,
          }]
        }),
    }
  }, [dayEndMinutes, dayStartMinutes, timetable.classBlocks])

  const weekColumns = useMemo<TimedColumnData[]>(() => weekDates.map(dateISO => ({
    dateISO,
    day: getWeekdayForDateISO(dateISO) ?? WEEKDAY_ORDER[0],
    label: formatShortDate(dateISO).split(', ').slice(1).join(', '),
    selected: dateISO === selectedDateISO,
    allDayMarkers: buildAllDayMarkersForDate(dateISO),
    events: buildTimedEventsForDate(dateISO),
    untimedTasks: buildUntimedTasksForDate(dateISO),
  })), [buildAllDayMarkersForDate, buildTimedEventsForDate, buildUntimedTasksForDate, selectedDateISO, weekDates])

  const dayColumns = useMemo<TimedColumnData[]>(() => {
    if (!selectedWeekday) return []
    return [{
      dateISO: selectedDateISO,
      day: selectedWeekday,
      label: formatShortDate(selectedDateISO),
      selected: true,
      allDayMarkers: buildAllDayMarkersForDate(selectedDateISO),
      events: buildTimedEventsForDate(selectedDateISO),
      untimedTasks: buildUntimedTasksForDate(selectedDateISO),
    }]
  }, [buildAllDayMarkersForDate, buildTimedEventsForDate, buildUntimedTasksForDate, selectedDateISO, selectedWeekday])

  const detailClassBlock = useMemo(() => detailsState?.type === 'class'
    ? (timetable.classBlocks.find(block => block.id === detailsState.blockId) ?? null)
    : null, [detailsState, timetable.classBlocks])
  const detailTask = useMemo(() => detailsState?.type === 'task'
    ? (activeTasksById[detailsState.taskId] ?? null)
    : null, [activeTasksById, detailsState])
  const detailMeeting = useMemo(() => detailsState?.type === 'meeting'
    ? (meetings.find(meeting => meeting.meetingId === detailsState.meetingId) ?? null)
    : null, [detailsState, meetings])
  const detailMarker = useMemo(() => detailsState?.type === 'marker'
    ? (adminMarkers.find(marker => marker.markerId === detailsState.markerId) ?? null)
    : null, [adminMarkers, detailsState])
  const detailOffering = useMemo(() => {
    if (detailClassBlock) return offeringsById[detailClassBlock.offeringId] ?? null
    if (detailTask) return offeringsById[detailTask.offeringId] ?? null
    if (detailMeeting?.offeringId) return offeringsById[detailMeeting.offeringId] ?? null
    return null
  }, [detailClassBlock, detailMeeting, detailTask, offeringsById])
  const detailPlacement = useMemo(() => {
    if (detailsState?.type !== 'task') return null
    return taskPlacements[detailsState.taskId] ?? null
  }, [detailsState, taskPlacements])

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
        cursorTopPx: clientY - rect.top,
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
      return buildClassPreviewState(
        timedTarget.dateISO,
        draft.entityId,
        normalized.startMinutes,
        normalized.endMinutes,
      )
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
  }, [buildClassPreviewState, dayEndMinutes, dayStartMinutes, findTimedColumnTarget, findUntimedTarget, snapRangeToNeighbors])

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
    return buildClassPreviewState(
      draft.dateISO,
      draft.entityId,
      draft.edge === 'start' ? nextMinute : draft.originalStartMinutes,
      draft.edge === 'end' ? nextMinute : draft.originalEndMinutes,
    )
  }, [buildClassPreviewState, findTimedColumnTarget])

  return {
    weekColumns,
    dayColumns,
    detailClassBlock,
    detailTask,
    detailMeeting,
    detailMarker,
    detailOffering,
    detailPlacement,
    resolveDragPreview,
    resolveResizePreview,
  }
}

export type CalendarColumns = ReturnType<typeof useCalendarColumns>
