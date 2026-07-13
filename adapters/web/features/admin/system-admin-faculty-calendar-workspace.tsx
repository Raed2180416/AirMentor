import { useEffect, useMemo, useState } from 'react'
import type { Offering } from '@web/simulation/fixtures'
import type { FacultyTimetableClassBlock, FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType, ApiAdminFacultyCalendar } from '@web/shared/api/types'
import {
  getWeekdayForDateISO,
  normalizeTimedRange,
  reflowClassDayRanges,
} from '@web/shared/state/calendar-utils'
import {
  buildPlannerFaculty,
  createFallbackTemplate,
  createMarkerDraft,
  createMarkerEditorDraft,
  createMarkerFromDraft,
  resolveCollisionPool,
  sortMarkers,
  type MarkerDraft,
} from './faculty-calendar-workspace/calendar-workspace-helpers'
import { CalendarWorkspaceHeader } from './faculty-calendar-workspace/calendar-workspace-header'
import { CalendarWorkspacePlanner } from './faculty-calendar-workspace/calendar-workspace-planner'
import { CalendarWorkspaceMarkersPanel } from './faculty-calendar-workspace/calendar-workspace-markers-panel'
import { CalendarWorkspaceMarkerModal } from './faculty-calendar-workspace/calendar-workspace-marker-modal'

type SystemAdminFacultyCalendarWorkspaceProps = {
  facultyId: string
  facultyName: string
  offerings: Offering[]
  calendar: ApiAdminFacultyCalendar | null
  onSave: (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => Promise<void>
}

export function SystemAdminFacultyCalendarWorkspace({
  facultyId,
  facultyName,
  offerings,
  calendar,
  onSave,
}: SystemAdminFacultyCalendarWorkspaceProps) {
  const plannerFaculty = useMemo(() => buildPlannerFaculty(facultyId, facultyName, offerings), [facultyId, facultyName, offerings])
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [markerDraft, setMarkerDraft] = useState<MarkerDraft | null>(null)
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null)

  useEffect(() => {
    setDraftTemplate(baseTemplate)
    setDraftWorkspace(baseWorkspace)
  }, [baseTemplate, baseWorkspace])

  const dirty = useMemo(
    () => JSON.stringify({ draftTemplate, draftWorkspace }) !== JSON.stringify({ baseTemplate, baseWorkspace }),
    [baseTemplate, baseWorkspace, draftTemplate, draftWorkspace],
  )
  const classEditingLocked = calendar?.classEditingLocked ?? false
  const upcomingMarkers = useMemo(() => sortMarkers(draftWorkspace.markers).slice(0, 8), [draftWorkspace.markers])

  const updateClassBlockTiming = (blockId: string, input: { day: FacultyTimetableClassBlock['day']; dateISO?: string; startMinutes: number; endMinutes: number }) => {
    if (classEditingLocked) return
    setDraftTemplate(current => {
      const block = current.classBlocks.find(item => item.id === blockId)
      if (!block) return current
      const nextBlock: FacultyTimetableClassBlock = {
        ...block,
        day: input.day,
        dateISO: block.kind === 'extra' ? input.dateISO : undefined,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
      }
      const collisionPool = resolveCollisionPool(current.classBlocks, nextBlock)
      const reflowed = reflowClassDayRanges({
        blocks: collisionPool.map(item => item.id === blockId ? nextBlock : item),
        targetId: blockId,
        desiredStartMinutes: input.startMinutes,
        desiredEndMinutes: input.endMinutes,
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
              ...nextBlock,
              startMinutes: range?.startMinutes ?? input.startMinutes,
              endMinutes: range?.endMinutes ?? input.endMinutes,
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
  }

  const resizeClassBlock = (blockId: string, input: { startMinutes: number; endMinutes: number }) => {
    if (classEditingLocked) return
    setDraftTemplate(current => {
      const block = current.classBlocks.find(item => item.id === blockId)
      if (!block) return current
      const nextBlock: FacultyTimetableClassBlock = {
        ...block,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
      }
      const collisionPool = resolveCollisionPool(current.classBlocks, nextBlock)
      const reflowed = reflowClassDayRanges({
        blocks: collisionPool.map(item => item.id === blockId ? nextBlock : item),
        targetId: blockId,
        desiredStartMinutes: input.startMinutes,
        desiredEndMinutes: input.endMinutes,
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
              ...nextBlock,
              startMinutes: range?.startMinutes ?? input.startMinutes,
              endMinutes: range?.endMinutes ?? input.endMinutes,
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
  }

  const createExtraClass = (input: { offeringId: string; dateISO: string; startMinutes: number; endMinutes: number }) => {
    if (classEditingLocked) return
    const offering = offerings.find(item => item.offId === input.offeringId)
    const day = getWeekdayForDateISO(input.dateISO)
    if (!offering || !day) return
    setDraftTemplate(current => {
      const nextBlock: FacultyTimetableClassBlock = {
        id: `extra-${offering.offId}-${Date.now()}`,
        facultyId,
        offeringId: offering.offId,
        courseCode: offering.code,
        courseName: offering.title,
        section: offering.section,
        year: offering.year,
        day,
        dateISO: input.dateISO,
        kind: 'extra',
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
      }
      const collisionPool = resolveCollisionPool(current.classBlocks, nextBlock)
      const reflowed = reflowClassDayRanges({
        blocks: [...collisionPool.filter(item => item.id !== nextBlock.id), nextBlock],
        targetId: nextBlock.id,
        desiredStartMinutes: input.startMinutes,
        desiredEndMinutes: input.endMinutes,
        dayStartMinutes: current.dayStartMinutes,
        dayEndMinutes: current.dayEndMinutes,
        snapThresholdMinutes: 14,
      })
      if (!reflowed) return current
      return {
        ...current,
        updatedAt: Date.now(),
        classBlocks: [
          ...current.classBlocks.map(item => {
            const range = reflowed.rangesById[item.id]
            if (!range) return item
            return {
              ...item,
              startMinutes: range.startMinutes,
              endMinutes: range.endMinutes,
            }
          }),
          {
            ...nextBlock,
            startMinutes: reflowed.targetRange.startMinutes,
            endMinutes: reflowed.targetRange.endMinutes,
          },
        ],
      }
    })
  }

  const updateBounds = (input: { dayStartMinutes: number; dayEndMinutes: number }) => {
    if (classEditingLocked) return
    setDraftTemplate(current => {
      const normalized = normalizeTimedRange(input.dayStartMinutes, input.dayEndMinutes, 0, 24 * 60, 120)
      return {
        ...current,
        updatedAt: Date.now(),
        dayStartMinutes: normalized.startMinutes,
        dayEndMinutes: normalized.endMinutes,
        classBlocks: current.classBlocks.map(block => ({
          ...block,
          ...normalizeTimedRange(block.startMinutes, block.endMinutes, normalized.startMinutes, normalized.endMinutes),
        })),
      }
    })
  }

  const openNewMarker = (markerType: ApiAdminCalendarMarkerType) => {
    const today = new Date().toISOString().slice(0, 10)
    setEditingMarkerId(null)
    setMarkerDraft(createMarkerDraft({ markerType, dateISO: today }))
  }

  const openExistingMarker = (marker: ApiAdminCalendarMarker) => {
    setEditingMarkerId(marker.markerId)
    setMarkerDraft(createMarkerEditorDraft(marker))
  }

  const saveMarkerDraft = () => {
    if (!markerDraft) return
    const existing = editingMarkerId ? draftWorkspace.markers.find(marker => marker.markerId === editingMarkerId) : undefined
    const nextMarker = createMarkerFromDraft(facultyId, markerDraft, existing)
    setDraftWorkspace(current => ({
      ...current,
      markers: sortMarkers(existing
        ? current.markers.map(marker => marker.markerId === existing.markerId ? nextMarker : marker)
        : [...current.markers, nextMarker]),
    }))
    setMarkerDraft(null)
    setEditingMarkerId(null)
  }

  const deleteMarkerDraft = () => {
    if (!editingMarkerId) return
    setDraftWorkspace(current => ({
      ...current,
      markers: current.markers.filter(marker => marker.markerId !== editingMarkerId),
    }))
    setMarkerDraft(null)
    setEditingMarkerId(null)
  }

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

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CalendarWorkspaceHeader
        offerings={offerings}
        classEditingLocked={classEditingLocked}
        publishedAt={draftWorkspace.publishedAt}
        directEditWindowEndsAt={calendar?.directEditWindowEndsAt}
        saveError={saveError}
        onOpenNewMarker={openNewMarker}
      />

      <CalendarWorkspacePlanner
        plannerFaculty={plannerFaculty}
        offerings={offerings}
        classEditingLocked={classEditingLocked}
        timetable={draftTemplate}
        adminMarkers={draftWorkspace.markers}
        onMoveClassBlock={updateClassBlockTiming}
        onResizeClassBlock={resizeClassBlock}
        onEditClassTiming={updateClassBlockTiming}
        onCreateExtraClass={createExtraClass}
        onUpdateTimetableBounds={updateBounds}
        onEditMarker={openExistingMarker}
      />

      <CalendarWorkspaceMarkersPanel
        upcomingMarkers={upcomingMarkers}
        dirty={dirty}
        saving={saving}
        onReset={() => {
          setDraftTemplate(baseTemplate)
          setDraftWorkspace(baseWorkspace)
          setSaveError('')
        }}
        onSave={() => void handleSave()}
        onEditMarker={openExistingMarker}
      />

      {markerDraft ? (
        <CalendarWorkspaceMarkerModal
          markerDraft={markerDraft}
          editingMarkerId={editingMarkerId}
          setMarkerDraft={setMarkerDraft}
          onClose={() => {
            setMarkerDraft(null)
            setEditingMarkerId(null)
          }}
          onDelete={deleteMarkerDraft}
          onSave={saveMarkerDraft}
        />
      ) : null}
    </div>
  )
}
