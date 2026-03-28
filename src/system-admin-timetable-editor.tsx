import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Clock3, GripVertical, Plus, Save, Sparkles, Trash2, X } from 'lucide-react'
import type { Offering } from './data'
import { T, mono, sora } from './data'
import type { FacultyAccount, FacultyTimetableClassBlock, FacultyTimetableTemplate, Weekday } from './domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType, ApiAdminFacultyCalendar } from './api/types'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_TIMETABLE_SLOTS,
  MIN_EVENT_DURATION_MINUTES,
  addDaysISO,
  assignAgendaLanes,
  classBlockOccursOnDate,
  formatShortDate,
  formatWeekRange,
  getWeekDates,
  getWeekdayForDateISO,
  minutesToDisplayLabel,
  minutesToTimeString,
  normalizeFacultyTimetableTemplate,
  normalizeTimedRange,
  reflowClassDayRanges,
  startOfWeekISO,
  timeStringToMinutes,
} from './calendar-utils'
import { Btn, Card, Chip } from './ui-primitives'

const PIXELS_PER_MINUTE = 1.02
const DRAG_THRESHOLD_PX = 4

type SystemAdminTimetableEditorProps = {
  facultyId: string
  facultyName: string
  offerings: Offering[]
  calendar: ApiAdminFacultyCalendar | null
  onSave: (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => Promise<void>
}

type HoverTarget = {
  dateISO: string
  day: Weekday
}

type PlannerEventCard = {
  id: string
  eventType: 'class' | 'marker'
  title: string
  subtitle: string
  accent: string
  startMinutes: number
  endMinutes: number
  dateISO: string
  day: Weekday
  classBlock?: FacultyTimetableClassBlock
  marker?: ApiAdminCalendarMarker
  lane: number
  laneCount: number
}

type InteractionPreview = {
  dateISO: string
  day: Weekday
  startMinutes: number
  endMinutes: number
}

type PendingDrag = {
  mode: 'pending'
  kind: 'drag'
  eventType: 'class' | 'marker'
  entityId: string
  durationMinutes: number
  offsetMinutes: number
  startedAt: { x: number; y: number }
  cursor: { x: number; y: number }
}

type ActiveDrag = Omit<PendingDrag, 'mode'> & {
  mode: 'active'
  preview: InteractionPreview | null
}

type PendingResize = {
  mode: 'pending'
  kind: 'resize'
  eventType: 'class' | 'marker'
  entityId: string
  edge: 'start' | 'end'
  dateISO: string
  day: Weekday
  startedAt: { x: number; y: number }
  cursor: { x: number; y: number }
}

type ActiveResize = Omit<PendingResize, 'mode'> & {
  mode: 'active'
  preview: InteractionPreview | null
}

type InteractionState = PendingDrag | ActiveDrag | PendingResize | ActiveResize

type MarkerDraft = {
  markerId: string
  markerType: ApiAdminCalendarMarkerType
  title: string
  note: string
  dateISO: string
  endDateISO: string
  allDay: boolean
  start: string
  end: string
  color: string
}

type ExtraClassDraft = {
  blockId: string
  offeringId: string
  dateISO: string
  start: string
  end: string
}

type EditorSheetState =
  | { type: 'marker'; mode: 'create' | 'edit'; draft: MarkerDraft }
  | { type: 'extra-class'; mode: 'create' | 'edit'; draft: ExtraClassDraft }
  | { type: 'class-info'; block: FacultyTimetableClassBlock }

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'AM'
}

function buildPlannerFaculty(facultyId: string, facultyName: string, offerings: Offering[]): FacultyAccount {
  return {
    facultyId,
    name: facultyName,
    initials: toInitials(facultyName),
    email: '',
    dept: '',
    roleTitle: 'System Admin Timetable',
    allowedRoles: ['Course Leader'],
    courseCodes: offerings.map(offering => offering.code),
    offeringIds: offerings.map(offering => offering.offId),
    menteeIds: [],
  }
}

function createFallbackTemplate(facultyId: string, facultyName: string, offerings: Offering[], template: FacultyTimetableTemplate | null): FacultyTimetableTemplate {
  if (offerings.length > 0) {
    return normalizeFacultyTimetableTemplate(template ?? undefined, buildPlannerFaculty(facultyId, facultyName, offerings), offerings) as FacultyTimetableTemplate
  }
  return {
    facultyId,
    slots: DEFAULT_TIMETABLE_SLOTS,
    dayStartMinutes: template?.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES,
    dayEndMinutes: template?.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES,
    classBlocks: template?.classBlocks ?? [],
    updatedAt: template?.updatedAt ?? Date.now(),
  }
}

function markerTypeLabel(markerType: ApiAdminCalendarMarkerType) {
  switch (markerType) {
    case 'semester-start': return 'Semester Start'
    case 'semester-end': return 'Semester End'
    case 'term-test-start': return 'Term Test Start'
    case 'term-test-end': return 'Term Test End'
    case 'holiday': return 'Holiday'
    default: return 'Event'
  }
}

function markerTypeColor(markerType: ApiAdminCalendarMarkerType) {
  switch (markerType) {
    case 'semester-start': return T.success
    case 'semester-end': return T.orange
    case 'term-test-start': return T.blue
    case 'term-test-end': return T.accent
    case 'holiday': return T.danger
    default: return T.pink
  }
}

function markerDefaultTitle(markerType: ApiAdminCalendarMarkerType) {
  switch (markerType) {
    case 'semester-start': return 'Semester begins'
    case 'semester-end': return 'Semester closes'
    case 'term-test-start': return 'Term test window opens'
    case 'term-test-end': return 'Term test window closes'
    case 'holiday': return 'University holiday'
    default: return 'University event'
  }
}

function markerSpansDate(marker: Pick<ApiAdminCalendarMarker, 'dateISO' | 'endDateISO'>, dateISO: string) {
  const endDateISO = marker.endDateISO || marker.dateISO
  return dateISO >= marker.dateISO && dateISO <= endDateISO
}

function sortMarkers(markers: ApiAdminCalendarMarker[]) {
  return [...markers].sort((left, right) => {
    if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
    if ((left.startMinutes ?? -1) !== (right.startMinutes ?? -1)) return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    return left.title.localeCompare(right.title)
  })
}

function createMarkerDraft(input: { markerType: ApiAdminCalendarMarkerType; facultyId: string; dateISO: string; timed?: { startMinutes: number; endMinutes: number } }) {
  const color = markerTypeColor(input.markerType)
  return {
    markerId: `marker-${Date.now()}`,
    markerType: input.markerType,
    title: markerDefaultTitle(input.markerType),
    note: '',
    dateISO: input.dateISO,
    endDateISO: '',
    allDay: !input.timed,
    start: minutesToTimeString(input.timed?.startMinutes ?? DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(input.timed?.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 60)),
    color,
  }
}

function createMarkerFromDraft(facultyId: string, draft: MarkerDraft, existing?: ApiAdminCalendarMarker): ApiAdminCalendarMarker {
  return {
    markerId: existing?.markerId ?? draft.markerId,
    facultyId,
    markerType: draft.markerType,
    title: draft.title.trim() || markerDefaultTitle(draft.markerType),
    note: draft.note.trim() || null,
    dateISO: draft.dateISO,
    endDateISO: draft.endDateISO.trim() || null,
    allDay: draft.allDay,
    startMinutes: draft.allDay ? null : timeStringToMinutes(draft.start),
    endMinutes: draft.allDay ? null : timeStringToMinutes(draft.end),
    color: draft.color,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
}

function createExtraClassDraft(dateISO: string, offerings: Offering[], timed?: { startMinutes: number; endMinutes: number }, existing?: FacultyTimetableClassBlock) {
  return {
    blockId: existing?.id ?? '',
    offeringId: existing?.offeringId ?? offerings[0]?.offId ?? '',
    dateISO,
    start: minutesToTimeString(existing?.startMinutes ?? timed?.startMinutes ?? DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(existing?.endMinutes ?? timed?.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 50)),
  }
}

function renderAllDayMarkerChip(marker: ApiAdminCalendarMarker) {
  return (
    <Chip key={marker.markerId} color={marker.color} size={9}>
      {marker.title}
    </Chip>
  )
}

function getColumnMinuteValue(event: PointerEvent, rect: DOMRect, dayStartMinutes: number, dayEndMinutes: number) {
  const relativeY = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
  const minutes = dayStartMinutes + Math.round(relativeY / PIXELS_PER_MINUTE)
  return normalizeTimedRange(minutes, minutes + MIN_EVENT_DURATION_MINUTES, dayStartMinutes, dayEndMinutes).startMinutes
}

function computeTimedLayout(items: PlannerEventCard[]) {
  const laidOut = assignAgendaLanes(items.map(item => ({
    id: item.id,
    startMinutes: item.startMinutes,
    endMinutes: item.endMinutes,
  })))
  const layoutById = Object.fromEntries(laidOut.map(item => [item.id, item]))
  return items.map(item => ({
    ...item,
    lane: layoutById[item.id]?.lane ?? 0,
    laneCount: layoutById[item.id]?.laneCount ?? 1,
  }))
}

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

  const allDayMarkersByDate = useMemo(() => {
    return Object.fromEntries(weekDates.map(dateISO => [
      dateISO,
      draftWorkspace.markers.filter(marker => marker.allDay && markerSpansDate(marker, dateISO)),
    ]))
  }, [draftWorkspace.markers, weekDates])

  const timedEventsByDate = useMemo(() => {
    return Object.fromEntries(weekDates.map(dateISO => {
      const day = getWeekdayForDateISO(dateISO)
      if (!day) return [dateISO, [] as PlannerEventCard[]]
      const classEvents: PlannerEventCard[] = draftTemplate.classBlocks
        .filter(block => classBlockOccursOnDate(block, dateISO, day))
        .map(block => ({
          id: `class:${block.id}`,
          eventType: 'class' as const,
          title: `${block.courseCode} · Sec ${block.section}`,
          subtitle: block.kind === 'extra' ? `${block.courseName} · extra class` : block.courseName,
          accent: block.kind === 'extra' ? T.orange : T.accent,
          startMinutes: block.startMinutes,
          endMinutes: block.endMinutes,
          dateISO,
          day,
          classBlock: block,
          lane: 0,
          laneCount: 1,
        }))
      const markerEvents: PlannerEventCard[] = draftWorkspace.markers
        .filter(marker => !marker.allDay && markerSpansDate(marker, dateISO) && marker.startMinutes != null && marker.endMinutes != null)
        .map(marker => ({
          id: `marker:${marker.markerId}`,
          eventType: 'marker' as const,
          title: marker.title,
          subtitle: markerTypeLabel(marker.markerType),
          accent: marker.color,
          startMinutes: marker.startMinutes ?? dayStartMinutes,
          endMinutes: marker.endMinutes ?? (dayStartMinutes + 60),
          dateISO,
          day,
          marker,
          lane: 0,
          laneCount: 1,
        }))
      return [dateISO, computeTimedLayout([...classEvents, ...markerEvents])]
    }))
  }, [dayStartMinutes, draftTemplate.classBlocks, draftWorkspace.markers, weekDates])

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
    setDraftTemplate(current => {
      const block = current.classBlocks.find(item => item.id === blockId)
      if (!block) return current
      const nextBlock: FacultyTimetableClassBlock = {
        ...block,
        day: preview.day,
        dateISO: block.kind === 'extra' ? preview.dateISO : undefined,
        startMinutes: preview.startMinutes,
        endMinutes: preview.endMinutes,
      }
      const collisionPool = current.classBlocks.filter(item => item.id === blockId || classBlockOccursOnDate(item, preview.dateISO, preview.day))
      const reflowed = reflowClassDayRanges({
        blocks: collisionPool.map(item => item.id === blockId ? nextBlock : item),
        targetId: blockId,
        desiredStartMinutes: preview.startMinutes,
        desiredEndMinutes: preview.endMinutes,
        dayStartMinutes: current.dayStartMinutes,
        dayEndMinutes: current.dayEndMinutes,
        snapThresholdMinutes: 14,
      })
      if (!reflowed) return current
      return {
        ...current,
        updatedAt: Date.now(),
        classBlocks: current.classBlocks.map(item => {
          if (!reflowed.rangesById[item.id] && item.id !== blockId) return item
          const range = reflowed.rangesById[item.id]
          if (item.id === blockId) {
            return {
              ...nextBlock,
              startMinutes: range?.startMinutes ?? preview.startMinutes,
              endMinutes: range?.endMinutes ?? preview.endMinutes,
            }
          }
          if (!range) return item
          return {
            ...item,
            startMinutes: range.startMinutes,
            endMinutes: range.endMinutes,
          }
        }),
      }
    })
  }, [classEditingLocked])

  const applyClassResize = useCallback((blockId: string, preview: InteractionPreview) => {
    if (classEditingLocked) return
    setDraftTemplate(current => {
      const block = current.classBlocks.find(item => item.id === blockId)
      if (!block) return current
      const nextBlock: FacultyTimetableClassBlock = {
        ...block,
        startMinutes: preview.startMinutes,
        endMinutes: preview.endMinutes,
      }
      const focusDateISO = block.dateISO ?? preview.dateISO
      const collisionPool = current.classBlocks.filter(item => item.id === blockId || classBlockOccursOnDate(item, focusDateISO, block.day))
      const reflowed = reflowClassDayRanges({
        blocks: collisionPool.map(item => item.id === blockId ? nextBlock : item),
        targetId: blockId,
        desiredStartMinutes: preview.startMinutes,
        desiredEndMinutes: preview.endMinutes,
        dayStartMinutes: current.dayStartMinutes,
        dayEndMinutes: current.dayEndMinutes,
        snapThresholdMinutes: 14,
      })
      if (!reflowed) return current
      return {
        ...current,
        updatedAt: Date.now(),
        classBlocks: current.classBlocks.map(item => {
          const range = reflowed.rangesById[item.id]
          if (item.id === blockId) {
            return {
              ...item,
              startMinutes: range?.startMinutes ?? preview.startMinutes,
              endMinutes: range?.endMinutes ?? preview.endMinutes,
            }
          }
          if (!range) return item
          return {
            ...item,
            startMinutes: range.startMinutes,
            endMinutes: range.endMinutes,
          }
        }),
      }
    })
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
      draft: {
        markerId: marker.markerId,
        markerType: marker.markerType,
        title: marker.title,
        note: marker.note ?? '',
        dateISO: marker.dateISO,
        endDateISO: marker.endDateISO ?? '',
        allDay: marker.allDay,
        start: minutesToTimeString(marker.startMinutes ?? dayStartMinutes),
        end: minutesToTimeString(marker.endMinutes ?? (dayStartMinutes + 60)),
        color: marker.color,
      },
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
    setDraftTemplate(current => {
      if (editorSheet.mode === 'edit' && editorSheet.draft.blockId) {
        return {
          ...current,
          updatedAt: Date.now(),
          classBlocks: current.classBlocks.map(block => block.id === editorSheet.draft.blockId ? ({
            ...block,
            offeringId: offering.offId,
            courseCode: offering.code,
            courseName: offering.title,
            section: offering.section,
            year: offering.year,
            day,
            dateISO: editorSheet.draft.dateISO,
            kind: 'extra' as const,
            startMinutes: normalized.startMinutes,
            endMinutes: normalized.endMinutes,
          }) : block),
        }
      }
      const nextBlock: FacultyTimetableClassBlock = {
        id: `extra-${offering.offId}-${Date.now()}`,
        facultyId,
        offeringId: offering.offId,
        courseCode: offering.code,
        courseName: offering.title,
        section: offering.section,
        year: offering.year,
        day,
        dateISO: editorSheet.draft.dateISO,
        kind: 'extra',
        startMinutes: normalized.startMinutes,
        endMinutes: normalized.endMinutes,
      }
      return {
        ...current,
        updatedAt: Date.now(),
        classBlocks: [
          ...current.classBlocks,
          nextBlock,
        ],
      }
    })
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CalendarDays size={16} color={T.accent} />
            <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Timetable Planner</div>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Uses the teaching-style drag board for real class blocks, while semester windows, holidays, and events live in a dedicated planner layer so they read like schedule context instead of fake classes.
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip color={T.accent}>{offerings.length} owned classes</Chip>
            <Chip color={classEditingLocked ? T.danger : T.success}>{classEditingLocked ? 'Class editing locked' : 'Class editing open'}</Chip>
            <Chip color={draftWorkspace.publishedAt ? T.blue : T.warning}>
              {draftWorkspace.publishedAt ? `Published ${formatShortDate(draftWorkspace.publishedAt.slice(0, 10))}` : 'Not published yet'}
            </Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>
            {calendar?.directEditWindowEndsAt
              ? `Direct class edits close on ${formatShortDate(calendar.directEditWindowEndsAt.slice(0, 10))}`
              : 'First save starts the 14-day direct-edit window for class timetable changes.'}
          </div>
        </div>
      </div>

      {classEditingLocked ? (
        <Card style={{ padding: 12, background: `${T.warning}14`, border: `1px solid ${T.warning}44` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={14} color={T.warning} />
            <div style={{ ...mono, fontSize: 10, color: T.text }}>
              Recurring class moves are now read-only here. Institutional markers remain editable, but permanent timetable changes should continue through approved HoD requests.
            </div>
          </div>
        </Card>
      ) : null}

      {saveError ? (
        <Card style={{ padding: 12, background: `${T.danger}14`, border: `1px solid ${T.danger}44` }}>
          <div style={{ ...mono, fontSize: 10, color: T.text }}>{saveError}</div>
        </Card>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" aria-label="Previous week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, -7))} style={iconButtonStyle()}>
            <ChevronLeft size={14} />
          </button>
          <Chip color={T.blue}>{formatWeekRange(selectedWeekStart)}</Chip>
          <button type="button" aria-label="Next week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, 7))} style={iconButtonStyle()}>
            <ChevronRight size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!classEditingLocked ? (
            <Btn type="button" size="sm" variant="ghost" onClick={() => openExtraClassEditor(selectedDateISO)}>
              <Plus size={12} /> Extra Class
            </Btn>
          ) : null}
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('semester-start', selectedDateISO)}>
            <Sparkles size={12} /> Semester Start
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('semester-end', selectedDateISO)}>
            <Sparkles size={12} /> Semester End
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('term-test-start', selectedDateISO)}>
            <Clock3 size={12} /> TT Start
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('term-test-end', selectedDateISO)}>
            <Clock3 size={12} /> TT End
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('holiday', selectedDateISO)}>
            <CalendarDays size={12} /> Holiday
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('event', selectedDateISO)}>
            <Plus size={12} /> Event
          </Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ ...mono, fontSize: 10, color: T.muted }}>Day bounds</span>
        <input
          type="time"
          value={minutesToTimeString(dayStartMinutes)}
          disabled={classEditingLocked}
          onChange={event => {
            if (classEditingLocked) return
            const nextStart = timeStringToMinutes(event.target.value)
            setDraftTemplate(current => ({
              ...current,
              dayStartMinutes: normalizeTimedRange(nextStart, current.dayEndMinutes, 0, 24 * 60, 120).startMinutes,
            }))
          }}
          style={timeInputStyle(classEditingLocked)}
        />
        <input
          type="time"
          value={minutesToTimeString(dayEndMinutes)}
          disabled={classEditingLocked}
          onChange={event => {
            if (classEditingLocked) return
            const nextEnd = timeStringToMinutes(event.target.value)
            setDraftTemplate(current => ({
              ...current,
              dayEndMinutes: normalizeTimedRange(current.dayStartMinutes, nextEnd, 0, 24 * 60, 120).endMinutes,
            }))
          }}
          style={timeInputStyle(classEditingLocked)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '88px repeat(6, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
        <div />
        {weekDates.map(dateISO => {
          const day = getWeekdayForDateISO(dateISO)
          if (!day) return null
          return (
            <Card key={dateISO} style={{ padding: 10, background: hoverTarget?.dateISO === dateISO ? `${T.accent}12` : T.surface2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <button type="button" onClick={() => setSelectedDateISO(dateISO)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{day}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatShortDate(dateISO)}</div>
                </button>
                <button
                  type="button"
                  aria-label={`Add planner block to ${day}`}
                  onClick={() => {
                    setHoverTarget({ dateISO, day })
                    openMarkerEditor('event', dateISO)
                  }}
                  style={iconButtonStyle()}
                >
                  <Plus size={12} />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 10, minHeight: 32 }}>
                {allDayMarkersByDate[dateISO]?.length
                  ? allDayMarkersByDate[dateISO].map(marker => (
                      <button
                        key={marker.markerId}
                        type="button"
                        onClick={() => openMarkerFromExisting(marker)}
                        style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        {renderAllDayMarkerChip(marker)}
                      </button>
                    ))
                  : <div style={{ ...mono, fontSize: 10, color: T.dim }}>No day markers</div>}
              </div>
            </Card>
          )
        })}

        <div style={{ display: 'grid', gap: 0, paddingTop: 8 }}>
          {timeGuides.map(guide => (
            <div key={guide} style={{ height: guide === dayEndMinutes ? 0 : 60 * PIXELS_PER_MINUTE, position: 'relative' }}>
              <div style={{ position: 'absolute', top: -8, left: 0, ...mono, fontSize: 10, color: T.dim }}>{minutesToDisplayLabel(guide)}</div>
            </div>
          ))}
        </div>

        {weekDates.map(dateISO => {
          const day = getWeekdayForDateISO(dateISO)
          if (!day) return null
          const events = timedEventsByDate[dateISO] ?? []
          const gridHeight = (dayEndMinutes - dayStartMinutes) * PIXELS_PER_MINUTE
          return (
            <div
              key={`grid-${dateISO}`}
              ref={node => { columnRefs.current[dateISO] = node }}
              onPointerMove={() => setHoverTarget({ dateISO, day })}
              onPointerLeave={() => setHoverTarget(current => current?.dateISO === dateISO ? null : current)}
              style={{
                position: 'relative',
                minHeight: gridHeight,
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
                overflow: 'hidden',
              }}
            >
              {timeGuides.map(guide => (
                <div
                  key={`${dateISO}-${guide}`}
                  style={{
                    position: 'absolute',
                    top: (guide - dayStartMinutes) * PIXELS_PER_MINUTE,
                    left: 0,
                    right: 0,
                    borderTop: `1px dashed ${T.border}`,
                  }}
                />
              ))}

              {events.map(event => {
                const top = (event.startMinutes - dayStartMinutes) * PIXELS_PER_MINUTE
                const height = Math.max(28, (event.endMinutes - event.startMinutes) * PIXELS_PER_MINUTE)
                const width = `calc(${100 / event.laneCount}% - 8px)`
                const left = `calc(${(100 / event.laneCount) * event.lane}% + 4px)`
                return (
                  <div
                    key={event.id}
                    onClick={() => {
                      if (event.eventType === 'marker' && event.marker) {
                        openMarkerFromExisting(event.marker)
                        return
                      }
                      if (event.classBlock?.kind === 'extra') {
                        openExtraClassEditor(event.dateISO, { startMinutes: event.startMinutes, endMinutes: event.endMinutes }, event.classBlock)
                        return
                      }
                      if (event.classBlock) {
                        setEditorSheet({ type: 'class-info', block: event.classBlock })
                      }
                    }}
                    onPointerDown={inputEvent => {
                      if (event.eventType === 'class' && classEditingLocked) return
                      if (!event.classBlock && !event.marker) return
                      setInteraction({
                        mode: 'pending',
                        kind: 'drag',
                        eventType: event.eventType,
                        entityId: event.eventType === 'class' ? event.classBlock!.id : event.marker!.markerId,
                        durationMinutes: event.endMinutes - event.startMinutes,
                        offsetMinutes: Math.max(10, Math.round((inputEvent.clientY - inputEvent.currentTarget.getBoundingClientRect().top) / PIXELS_PER_MINUTE)),
                        startedAt: { x: inputEvent.clientX, y: inputEvent.clientY },
                        cursor: { x: inputEvent.clientX, y: inputEvent.clientY },
                      })
                    }}
                    style={{
                      position: 'absolute',
                      top,
                      left,
                      width,
                      height,
                      borderRadius: 12,
                      border: `1px solid ${event.accent}55`,
                      background: `${event.accent}22`,
                      boxShadow: `0 12px 28px ${event.accent}22`,
                      padding: '8px 10px',
                      cursor: event.eventType === 'class' && classEditingLocked ? 'default' : 'grab',
                      display: 'grid',
                      alignContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 11, fontWeight: 700, color: T.text }}>{event.title}</div>
                        <div style={{ ...mono, fontSize: 9, color: T.muted, marginTop: 2 }}>{event.subtitle}</div>
                      </div>
                      <GripVertical size={12} color={event.accent} />
                    </div>
                    <div style={{ ...mono, fontSize: 9, color: event.accent }}>
                      {minutesToDisplayLabel(event.startMinutes)} - {minutesToDisplayLabel(event.endMinutes)}
                    </div>
                    <button
                      type="button"
                      aria-label="Resize block"
                      onPointerDown={(inputEvent: ReactPointerEvent<HTMLButtonElement>) => {
                        inputEvent.preventDefault()
                        inputEvent.stopPropagation()
                        if (event.eventType === 'class' && classEditingLocked) return
                        setInteraction({
                          mode: 'pending',
                          kind: 'resize',
                          eventType: event.eventType,
                          entityId: event.eventType === 'class' ? event.classBlock!.id : event.marker!.markerId,
                          edge: 'end',
                          dateISO,
                          day,
                          startedAt: { x: inputEvent.clientX, y: inputEvent.clientY },
                          cursor: { x: inputEvent.clientX, y: inputEvent.clientY },
                        })
                      }}
                      style={{
                        justifySelf: 'end',
                        width: 22,
                        height: 10,
                        borderRadius: 999,
                        border: 'none',
                        cursor: event.eventType === 'class' && classEditingLocked ? 'default' : 'ns-resize',
                        background: `${event.accent}66`,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          Regular class blocks inherit the teacher-style drag board. Institutional markers stay separate so admin can place semester boundaries, test windows, holidays, and events without confusing them for actual teaching load.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn type="button" size="sm" variant="ghost" onClick={() => {
            setDraftTemplate(baseTemplate)
            setDraftWorkspace(baseWorkspace)
          }} disabled={!dirty || saving}>
            Reset
          </Btn>
          <Btn type="button" size="sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
            <Save size={12} /> {saving ? 'Saving…' : 'Save Planner'}
          </Btn>
        </div>
      </div>

      {editorSheet ? (
        <div onClick={() => setEditorSheet(null)} style={sheetBackdropStyle}>
          <div onClick={event => event.stopPropagation()} style={sheetCardStyle(editorSheet.type === 'class-info' ? 420 : 560)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>
                  {editorSheet.type === 'marker'
                    ? `${editorSheet.mode === 'edit' ? 'Edit' : 'Create'} ${markerTypeLabel(editorSheet.draft.markerType)}`
                    : editorSheet.type === 'extra-class'
                      ? `${editorSheet.mode === 'edit' ? 'Edit' : 'Schedule'} Extra Class`
                      : `${editorSheet.block.courseCode} · Sec ${editorSheet.block.section}`}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  {editorSheet.type === 'class-info'
                    ? 'Recurring teaching block. Drag or resize it directly on the planner to change timing.'
                    : 'Changes stay local until you press Save Planner.'}
                </div>
              </div>
              <button type="button" onClick={() => setEditorSheet(null)} style={iconButtonStyle()}>
                <X size={14} />
              </button>
            </div>

            {editorSheet.type === 'class-info' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <Card style={{ padding: 12, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{editorSheet.block.courseName}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                    {editorSheet.block.day} · {minutesToDisplayLabel(editorSheet.block.startMinutes)} - {minutesToDisplayLabel(editorSheet.block.endMinutes)}
                  </div>
                </Card>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Btn type="button" size="sm" variant="ghost" onClick={() => setEditorSheet(null)}>Close</Btn>
                </div>
              </div>
            ) : editorSheet.type === 'marker' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div>
                    <FieldLabel>Type</FieldLabel>
                    <select value={editorSheet.draft.markerType} onChange={event => setEditorSheet(current => current?.type === 'marker' ? {
                      ...current,
                      draft: {
                        ...current.draft,
                        markerType: event.target.value as ApiAdminCalendarMarkerType,
                        title: markerDefaultTitle(event.target.value as ApiAdminCalendarMarkerType),
                        color: markerTypeColor(event.target.value as ApiAdminCalendarMarkerType),
                      },
                    } : current)} style={fieldStyle}>
                      <option value="semester-start">Semester Start</option>
                      <option value="semester-end">Semester End</option>
                      <option value="term-test-start">Term Test Start</option>
                      <option value="term-test-end">Term Test End</option>
                      <option value="holiday">Holiday</option>
                      <option value="event">Event</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Title</FieldLabel>
                    <input value={editorSheet.draft.title} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, title: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input type="date" value={editorSheet.draft.dateISO} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, dateISO: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>End Date</FieldLabel>
                    <input type="date" value={editorSheet.draft.endDateISO} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, endDateISO: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                      <input type="checkbox" checked={editorSheet.draft.allDay} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, allDay: event.target.checked } } : current)} />
                      All-day planner marker
                    </label>
                  </div>
                  {!editorSheet.draft.allDay ? (
                    <>
                      <div>
                        <FieldLabel>Start</FieldLabel>
                        <input type="time" value={editorSheet.draft.start} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, start: event.target.value } } : current)} style={fieldStyle} />
                      </div>
                      <div>
                        <FieldLabel>End</FieldLabel>
                        <input type="time" value={editorSheet.draft.end} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, end: event.target.value } } : current)} style={fieldStyle} />
                      </div>
                    </>
                  ) : null}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <FieldLabel>Note</FieldLabel>
                    <textarea value={editorSheet.draft.note} onChange={event => setEditorSheet(current => current?.type === 'marker' ? { ...current, draft: { ...current.draft, note: event.target.value } } : current)} rows={3} style={textAreaStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>{editorSheet.mode === 'edit' ? <Btn type="button" size="sm" variant="danger" onClick={deleteEditorSheetItem}><Trash2 size={12} /> Delete</Btn> : null}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => setEditorSheet(null)}>Cancel</Btn>
                    <Btn type="button" size="sm" onClick={saveEditorSheet}>Apply Marker</Btn>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div>
                    <FieldLabel>Class</FieldLabel>
                    <select value={editorSheet.draft.offeringId} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, offeringId: event.target.value } } : current)} style={fieldStyle}>
                      <option value="">Select class</option>
                      {offerings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · Sec {offering.section} · {offering.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input type="date" value={editorSheet.draft.dateISO} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, dateISO: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>Start</FieldLabel>
                    <input type="time" value={editorSheet.draft.start} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, start: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                  <div>
                    <FieldLabel>End</FieldLabel>
                    <input type="time" value={editorSheet.draft.end} onChange={event => setEditorSheet(current => current?.type === 'extra-class' ? { ...current, draft: { ...current.draft, end: event.target.value } } : current)} style={fieldStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>{editorSheet.mode === 'edit' ? <Btn type="button" size="sm" variant="danger" onClick={deleteEditorSheetItem}><Trash2 size={12} /> Delete</Btn> : null}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => setEditorSheet(null)}>Cancel</Btn>
                    <Btn type="button" size="sm" onClick={saveEditorSheet}>Apply Class</Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>{children}</div>
}

function iconButtonStyle() {
  return {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: T.surface2,
    color: T.muted,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } satisfies CSSProperties
}

function timeInputStyle(disabled: boolean) {
  return {
    minHeight: 36,
    borderRadius: 10,
    border: `1px solid ${T.border2}`,
    background: disabled ? T.surface2 : T.surface,
    color: disabled ? T.dim : T.text,
    padding: '0 12px',
    ...mono,
    fontSize: 11,
  } satisfies CSSProperties
}

const fieldStyle: CSSProperties = {
  width: '100%',
  minHeight: 40,
  borderRadius: 10,
  border: `1px solid ${T.border2}`,
  background: T.surface2,
  color: T.text,
  padding: '0 12px',
  ...mono,
  fontSize: 11,
}

const textAreaStyle: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: `1px solid ${T.border2}`,
  background: T.surface2,
  color: T.text,
  padding: '10px 12px',
  ...mono,
  fontSize: 11,
  resize: 'vertical',
}

const sheetBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 6, 23, 0.62)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 160,
}

function sheetCardStyle(maxWidth: number): CSSProperties {
  return {
    width: '100%',
    maxWidth,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 18,
    padding: 18,
    display: 'grid',
    gap: 16,
    boxShadow: '0 28px 70px rgba(2, 6, 23, 0.34)',
  }
}
