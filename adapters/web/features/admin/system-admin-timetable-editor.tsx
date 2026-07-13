import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FacultyTimetableClassBlock, FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import { getWeekDates, getWeekdayForDateISO, normalizeTimedRange, startOfWeekISO, timeStringToMinutes } from '@web/shared/state/calendar-utils'
import { Card } from '@web/shared/ui/primitives'
import {
  DRAG_THRESHOLD_PX,
  buildAllDayMarkersByDate,
  buildTimedEventsByDate,
  createExtraClassDraft,
  createFallbackTemplate,
  createMarkerDraft,
  createMarkerFromDraft,
  getColumnMinuteValue,
  markerDraftFromMarker,
  sortMarkers,
} from './timetable-editor/helpers'
import { applyClassChangeToTemplate, applyClassResizeToTemplate, buildTemplateAfterExtraClassSave } from './timetable-editor/state-updaters'
import { PlannerHeader } from './timetable-editor/planner-header'
import { PlannerToolbar } from './timetable-editor/planner-toolbar'
import { PlannerWeekGrid } from './timetable-editor/planner-week-grid'
import { PlannerFooter } from './timetable-editor/planner-footer'
import { EditorSheet } from './timetable-editor/editor-sheet'
import type { EditorSheetState, HoverTarget, InteractionPreview, InteractionState, SystemAdminTimetableEditorProps } from './timetable-editor/types'

export function SystemAdminTimetableEditor({
  facultyId,
  facultyName,
  offerings,
  calendar,
  onSave,
}: SystemAdminTimetableEditorProps) {
  const baseTemplate = useMemo(
    () => createFallbackTemplate(facultyId, facultyName, offerings, calendar?.template ?? null),
    [calendar?.template, facultyId, facultyName, offerings],
  )
  const baseWorkspace = useMemo(
    () => ({
      publishedAt: calendar?.workspace.publishedAt ?? null,
      markers: sortMarkers(calendar?.workspace.markers ?? []),
    }),
    [calendar?.workspace.markers, calendar?.workspace.publishedAt],
  )

  const [draftTemplate, setDraftTemplate] = useState<FacultyTimetableTemplate>(baseTemplate)
  const [draftWorkspace, setDraftWorkspace] = useState(baseWorkspace)
  const [selectedDateISO, setSelectedDateISO] = useState(() => new Date().toISOString().slice(0, 10))
  const [editorSheet, setEditorSheet] = useState<EditorSheetState | null>(null)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null)
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    setDraftTemplate(baseTemplate)
    setDraftWorkspace(baseWorkspace)
  }, [baseTemplate, baseWorkspace])

  const classEditingLocked = calendar?.classEditingLocked ?? false
  const dayStartMinutes = draftTemplate.dayStartMinutes
  const dayEndMinutes = draftTemplate.dayEndMinutes
  const selectedWeekStart = useMemo(() => startOfWeekISO(selectedDateISO), [selectedDateISO])
  const weekDates = useMemo(() => getWeekDates(selectedWeekStart), [selectedWeekStart])
  const dirty = useMemo(
    () => JSON.stringify({ draftTemplate, draftWorkspace }) !== JSON.stringify({ baseTemplate, baseWorkspace }),
    [baseTemplate, baseWorkspace, draftTemplate, draftWorkspace],
  )

  const allDayMarkersByDate = useMemo(
    () => buildAllDayMarkersByDate(weekDates, draftWorkspace.markers),
    [draftWorkspace.markers, weekDates],
  )

  const timedEventsByDate = useMemo(
    () => buildTimedEventsByDate(weekDates, draftTemplate.classBlocks, draftWorkspace.markers, dayStartMinutes),
    [dayStartMinutes, draftTemplate.classBlocks, draftWorkspace.markers, weekDates],
  )

  const resolvePreview = useCallback((pointerEvent: PointerEvent, sourceInteraction: InteractionState | null): InteractionPreview | null => {
    const entry = Object.entries(columnRefs.current).find(([, node]) => {
      if (!node) return false
      const rect = node.getBoundingClientRect()
      return pointerEvent.clientX >= rect.left && pointerEvent.clientX <= rect.right && pointerEvent.clientY >= rect.top && pointerEvent.clientY <= rect.bottom
    })
    if (!entry) return null
    const [dateISO, node] = entry
    if (!node) return null
    const rect = node.getBoundingClientRect()
    const day = getWeekdayForDateISO(dateISO)
    if (!day) return null
    const snappedStart = getColumnMinuteValue(pointerEvent, rect, dayStartMinutes, dayEndMinutes)
    if (sourceInteraction?.kind === 'drag') {
      const next = normalizeTimedRange(snappedStart - sourceInteraction.offsetMinutes, snappedStart - sourceInteraction.offsetMinutes + sourceInteraction.durationMinutes, dayStartMinutes, dayEndMinutes)
      return { dateISO, day, startMinutes: next.startMinutes, endMinutes: next.endMinutes }
    }
    if (sourceInteraction?.kind === 'resize') {
      const blockEvent = Object.values(timedEventsByDate).flat().find(item => item.classBlock?.id === sourceInteraction.entityId || item.marker?.markerId === sourceInteraction.entityId)
      if (!blockEvent) return null
      const next = sourceInteraction.edge === 'start'
        ? normalizeTimedRange(snappedStart, blockEvent.endMinutes, dayStartMinutes, dayEndMinutes)
        : normalizeTimedRange(blockEvent.startMinutes, snappedStart, dayStartMinutes, dayEndMinutes)
      return { dateISO, day, startMinutes: next.startMinutes, endMinutes: next.endMinutes }
    }
    return null
  }, [dayEndMinutes, dayStartMinutes, timedEventsByDate])

  const applyClassChange = useCallback((blockId: string, preview: InteractionPreview) => {
    if (classEditingLocked) return
    setDraftTemplate(current => applyClassChangeToTemplate(current, blockId, preview))
  }, [classEditingLocked])

  const applyClassResize = useCallback((blockId: string, preview: InteractionPreview) => {
    if (classEditingLocked) return
    setDraftTemplate(current => applyClassResizeToTemplate(current, blockId, preview))
  }, [classEditingLocked])

  const applyMarkerChange = useCallback((markerId: string, preview: InteractionPreview) => {
    setDraftWorkspace(current => ({
      ...current,
      markers: sortMarkers(current.markers.map(marker => marker.markerId === markerId ? {
        ...marker,
        dateISO: preview.dateISO,
        startMinutes: preview.startMinutes,
        endMinutes: preview.endMinutes,
        updatedAt: Date.now(),
      } : marker)),
    }))
  }, [])

  const applyMarkerResize = useCallback((markerId: string, preview: InteractionPreview) => {
    setDraftWorkspace(current => ({
      ...current,
      markers: sortMarkers(current.markers.map(marker => marker.markerId === markerId ? {
        ...marker,
        startMinutes: preview.startMinutes,
        endMinutes: preview.endMinutes,
        updatedAt: Date.now(),
      } : marker)),
    }))
  }, [])

  useEffect(() => {
    if (!interaction) return undefined

    const handlePointerMove = (event: PointerEvent) => {
      setInteraction(current => {
        if (!current) return current
        if (current.mode === 'pending') {
          const deltaX = event.clientX - current.startedAt.x
          const deltaY = event.clientY - current.startedAt.y
          if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
            return {
              ...current,
              cursor: { x: event.clientX, y: event.clientY },
            }
          }
          const preview = resolvePreview(event, current)
          return {
            ...current,
            mode: 'active',
            cursor: { x: event.clientX, y: event.clientY },
            preview,
          }
        }
        return {
          ...current,
          cursor: { x: event.clientX, y: event.clientY },
          preview: resolvePreview(event, current),
        }
      })
    }

    const handlePointerUp = () => {
      setInteraction(current => {
        if (!current || current.mode !== 'active' || !current.preview) return null
        if (current.eventType === 'class') {
          if (current.kind === 'drag') {
            applyClassChange(current.entityId, current.preview)
          } else {
            applyClassResize(current.entityId, current.preview)
          }
        } else {
          if (current.kind === 'drag') {
            applyMarkerChange(current.entityId, current.preview)
          } else {
            applyMarkerResize(current.entityId, current.preview)
          }
        }
        return null
      })
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInteraction(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [applyClassChange, applyClassResize, applyMarkerChange, applyMarkerResize, interaction, resolvePreview])

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await onSave({
        template: draftTemplate,
        workspace: draftWorkspace,
      })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Planner save failed.')
    } finally {
      setSaving(false)
    }
  }

  const openMarkerEditor = (markerType: ApiAdminCalendarMarkerType, dateISO: string, timed?: { startMinutes: number; endMinutes: number }) => {
    setEditorSheet({
      type: 'marker',
      mode: 'create',
      draft: createMarkerDraft({ markerType, facultyId, dateISO, timed }),
    })
  }

  const openMarkerFromExisting = (marker: ApiAdminCalendarMarker) => {
    setEditorSheet({
      type: 'marker',
      mode: 'edit',
      draft: markerDraftFromMarker(marker, dayStartMinutes),
    })
  }

  const openExtraClassEditor = (dateISO: string, timed?: { startMinutes: number; endMinutes: number }, existing?: FacultyTimetableClassBlock) => {
    setEditorSheet({
      type: 'extra-class',
      mode: existing ? 'edit' : 'create',
      draft: createExtraClassDraft(dateISO, offerings, timed, existing),
    })
  }

  const saveEditorSheet = () => {
    if (!editorSheet) return
    if (editorSheet.type === 'marker') {
      const existing = draftWorkspace.markers.find(marker => marker.markerId === editorSheet.draft.markerId)
      const nextMarker = createMarkerFromDraft(facultyId, editorSheet.draft, existing)
      setDraftWorkspace(current => ({
        ...current,
        markers: sortMarkers(existing
          ? current.markers.map(marker => marker.markerId === existing.markerId ? nextMarker : marker)
          : [...current.markers, nextMarker]),
      }))
      setEditorSheet(null)
      return
    }
    if (editorSheet.type !== 'extra-class') return

    const offering = offerings.find(item => item.offId === editorSheet.draft.offeringId)
    const day = getWeekdayForDateISO(editorSheet.draft.dateISO)
    if (!offering || !day) return
    const normalized = normalizeTimedRange(
      timeStringToMinutes(editorSheet.draft.start),
      timeStringToMinutes(editorSheet.draft.end),
      dayStartMinutes,
      dayEndMinutes,
    )
    setDraftTemplate(current => buildTemplateAfterExtraClassSave(current, {
      mode: editorSheet.mode,
      draft: editorSheet.draft,
      offering,
      day,
      normalized,
      facultyId,
    }))
    setEditorSheet(null)
  }

  const deleteEditorSheetItem = () => {
    if (!editorSheet) return
    if (!window.confirm('Delete this block?')) return
    if (editorSheet.type === 'marker') {
      setDraftWorkspace(current => ({
        ...current,
        markers: current.markers.filter(marker => marker.markerId !== editorSheet.draft.markerId),
      }))
      setEditorSheet(null)
      return
    }
    if (editorSheet.type !== 'extra-class') return
    if (editorSheet.type === 'extra-class' && editorSheet.draft.blockId) {
      setDraftTemplate(current => ({
        ...current,
        updatedAt: Date.now(),
        classBlocks: current.classBlocks.filter(block => block.id !== editorSheet.draft.blockId),
      }))
      setEditorSheet(null)
    }
  }

  const timeGuides = useMemo(() => {
    const guides: number[] = []
    for (let minute = dayStartMinutes; minute <= dayEndMinutes; minute += 60) guides.push(minute)
    if (!guides.includes(dayEndMinutes)) guides.push(dayEndMinutes)
    return guides
  }, [dayEndMinutes, dayStartMinutes])

  return (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <PlannerHeader
        offerings={offerings}
        classEditingLocked={classEditingLocked}
        draftWorkspace={draftWorkspace}
        calendar={calendar}
        saveError={saveError}
      />

      <PlannerToolbar
        selectedDateISO={selectedDateISO}
        setSelectedDateISO={setSelectedDateISO}
        selectedWeekStart={selectedWeekStart}
        classEditingLocked={classEditingLocked}
        openExtraClassEditor={openExtraClassEditor}
        openMarkerEditor={openMarkerEditor}
        dayStartMinutes={dayStartMinutes}
        dayEndMinutes={dayEndMinutes}
        setDraftTemplate={setDraftTemplate}
      />

      <PlannerWeekGrid
        weekDates={weekDates}
        hoverTarget={hoverTarget}
        setHoverTarget={setHoverTarget}
        setSelectedDateISO={setSelectedDateISO}
        openMarkerEditor={openMarkerEditor}
        openMarkerFromExisting={openMarkerFromExisting}
        openExtraClassEditor={openExtraClassEditor}
        allDayMarkersByDate={allDayMarkersByDate}
        timeGuides={timeGuides}
        dayStartMinutes={dayStartMinutes}
        dayEndMinutes={dayEndMinutes}
        timedEventsByDate={timedEventsByDate}
        columnRefs={columnRefs}
        classEditingLocked={classEditingLocked}
        setInteraction={setInteraction}
        setEditorSheet={setEditorSheet}
      />

      <PlannerFooter
        dirty={dirty}
        saving={saving}
        baseTemplate={baseTemplate}
        baseWorkspace={baseWorkspace}
        setDraftTemplate={setDraftTemplate}
        setDraftWorkspace={setDraftWorkspace}
        handleSave={handleSave}
      />

      {editorSheet ? (
        <EditorSheet
          editorSheet={editorSheet}
          setEditorSheet={setEditorSheet}
          saveEditorSheet={saveEditorSheet}
          deleteEditorSheetItem={deleteEditorSheetItem}
          offerings={offerings}
        />
      ) : null}
    </Card>
  )
}
