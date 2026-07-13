import { useCallback, useEffect } from 'react'
import { T } from '@web/simulation/fixtures'
import type { FacultyTimetableClassBlock, SharedTask, TaskCalendarPlacement } from '@kernel/shared/domain'
import {
  DEFAULT_TASK_DURATION_MINUTES,
  MIN_EVENT_DURATION_MINUTES,
  getWeekdayForDateISO,
  minutesToTimeString,
  normalizeTimedRange,
} from '@web/shared/state/calendar-utils'
import { AGENDA_PIXELS_PER_MINUTE, DRAG_THRESHOLD_PX } from './constants'
import { normalizeTimeValue, normalizeTimedAddTarget } from './calendar-helpers'
import type { CalendarBaseState } from './use-calendar-base-state'
import type { CalendarColumns } from './use-calendar-columns'
import type {
  AddTargetState,
  CalendarTimetablePageProps,
  ExtraClassDraftState,
  InteractionState,
  TimedEventCard,
} from './types'

export function useCalendarInteractions(props: CalendarTimetablePageProps, base: CalendarBaseState, columns: CalendarColumns) {
  const { timetable, onScheduleTask, onMoveClassBlock, onResizeClassBlock, onEditClassTiming, onUpdateTimetableBounds } = props
  const {
    interaction,
    setInteraction,
    suppressDetailClickUntilRef,
    dayStartMinutes,
    dayEndMinutes,
    isEditable,
    classEdit,
    setClassEdit,
    setDetailsState,
    setAddTarget,
    setExtraClassDraft,
    boundsDraft,
    setBoundsDraft,
    setBoundsDirty,
  } = base
  const { resolveDragPreview, resolveResizePreview } = columns

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
            dateISO: interaction.preview.dateISO,
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

      if (interaction.mode === 'active') suppressDetailClickUntilRef.current = Date.now() + 220
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

  const openClassEdit = useCallback((block: FacultyTimetableClassBlock) => {
    if (!isEditable) return
    setClassEdit({
      blockId: block.id,
      title: `${block.courseCode} · Sec ${block.section}`,
      subtitle: block.courseName,
      day: block.day,
      dateISO: block.dateISO,
      start: minutesToTimeString(block.startMinutes),
      end: minutesToTimeString(block.endMinutes),
    })
  }, [isEditable])

  const openEventDetails = useCallback((event: TimedEventCard) => {
    if (Date.now() < suppressDetailClickUntilRef.current) return
    if (event.eventType === 'class' && event.classBlock) {
      setDetailsState({ type: 'class', blockId: event.classBlock.id, dateISO: event.dateISO })
      return
    }
    if (event.eventType === 'marker' && event.marker) {
      setDetailsState({ type: 'marker', markerId: event.marker.markerId, dateISO: event.dateISO })
      return
    }
    if (event.eventType === 'task' && event.task) {
      setDetailsState({
        type: 'task',
        taskId: event.task.id,
        dateISO: event.dateISO,
        placementMode: event.placement?.placementMode ?? 'timed',
      })
      return
    }
    if (event.eventType === 'meeting' && event.meeting) {
      setDetailsState({
        type: 'meeting',
        meetingId: event.meeting.meetingId,
        dateISO: event.dateISO,
      })
    }
  }, [])

  const handleSaveClassEdit = useCallback(() => {
    if (!classEdit) return
    onEditClassTiming(classEdit.blockId, {
      day: classEdit.day,
      dateISO: classEdit.dateISO,
      startMinutes: normalizeTimeValue(classEdit.start, dayStartMinutes),
      endMinutes: normalizeTimeValue(classEdit.end, dayEndMinutes),
    })
    setClassEdit(null)
  }, [classEdit, dayEndMinutes, dayStartMinutes, onEditClassTiming])

  const handleChangeAddTarget = useCallback((next: Partial<AddTargetState>) => {
    setAddTarget(current => {
      if (!current) return current
      const draft = { ...current, ...next }
      return draft.placementMode === 'timed'
        ? normalizeTimedAddTarget(draft, dayStartMinutes, dayEndMinutes)
        : draft
    })
  }, [dayEndMinutes, dayStartMinutes])

  const handleChangeExtraClassDraft = useCallback((next: Partial<ExtraClassDraftState>) => {
    setExtraClassDraft(current => {
      if (!current) return current
      const draft = {
        ...current,
        ...next,
      }
      const normalizedDateISO = draft.dateISO
      const normalizedDay = getWeekdayForDateISO(normalizedDateISO) ?? draft.day
      const normalizedRange = normalizeTimedRange(
        draft.startMinutes,
        draft.endMinutes,
        dayStartMinutes,
        dayEndMinutes,
      )
      const nextDraft = {
        ...draft,
        day: normalizedDay,
        startMinutes: normalizedRange.startMinutes,
        endMinutes: normalizedRange.endMinutes,
      }
      setAddTarget({
        dateISO: nextDraft.dateISO,
        placementMode: 'timed',
        startMinutes: nextDraft.startMinutes,
        endMinutes: nextDraft.endMinutes,
      })
      return nextDraft
    })
  }, [dayEndMinutes, dayStartMinutes])

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

  return {
    startTaskDrag,
    startClassDrag,
    startClassResize,
    openClassEdit,
    openEventDetails,
    handleSaveClassEdit,
    handleChangeAddTarget,
    handleChangeExtraClassDraft,
    handleApplyBounds,
  }
}
