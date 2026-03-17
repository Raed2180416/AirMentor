import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarDays, Clock3, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import type { Offering } from './data'
import { T, mono, sora } from './data'
import type { FacultyAccount, FacultyTimetableClassBlock, FacultyTimetableTemplate } from './domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType, ApiAdminFacultyCalendar } from './api/types'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_TIMETABLE_SLOTS,
  classBlockOccursOnDate,
  formatShortDate,
  getWeekdayForDateISO,
  minutesToTimeString,
  normalizeFacultyTimetableTemplate,
  normalizeTimedRange,
  reflowClassDayRanges,
  timeStringToMinutes,
} from './calendar-utils'
import { Btn, Card, Chip } from './ui-primitives'
import { FieldLabel, InfoBanner, ModalFrame, SelectInput, TextAreaInput, TextInput } from './system-admin-ui'

const CalendarTimetablePage = lazy(async () => {
  const module = await import('./pages/calendar-pages')
  return { default: module.CalendarTimetablePage }
})

type SystemAdminFacultyCalendarWorkspaceProps = {
  facultyId: string
  facultyName: string
  offerings: Offering[]
  calendar: ApiAdminFacultyCalendar | null
  onSave: (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => Promise<void>
}

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

function sortMarkers(markers: ApiAdminCalendarMarker[]) {
  return [...markers].sort((left, right) => {
    if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
    if ((left.startMinutes ?? -1) !== (right.startMinutes ?? -1)) return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    return left.title.localeCompare(right.title)
  })
}

function createMarkerDraft(input: { markerType: ApiAdminCalendarMarkerType; dateISO: string }) {
  return {
    markerId: `marker-${Date.now()}`,
    markerType: input.markerType,
    title: markerDefaultTitle(input.markerType),
    note: '',
    dateISO: input.dateISO,
    endDateISO: '',
    allDay: true,
    start: minutesToTimeString(DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(DEFAULT_DAY_START_MINUTES + 60),
    color: markerTypeColor(input.markerType),
  } satisfies MarkerDraft
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

function createMarkerEditorDraft(marker: ApiAdminCalendarMarker): MarkerDraft {
  return {
    markerId: marker.markerId,
    markerType: marker.markerType,
    title: marker.title,
    note: marker.note ?? '',
    dateISO: marker.dateISO,
    endDateISO: marker.endDateISO ?? '',
    allDay: marker.allDay,
    start: minutesToTimeString(marker.startMinutes ?? DEFAULT_DAY_START_MINUTES),
    end: minutesToTimeString(marker.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 60)),
    color: marker.color,
  }
}

function formatMarkerWindow(marker: ApiAdminCalendarMarker) {
  if (marker.allDay) {
    return marker.endDateISO ? `${formatShortDate(marker.dateISO)} to ${formatShortDate(marker.endDateISO)}` : formatShortDate(marker.dateISO)
  }
  return `${formatShortDate(marker.dateISO)} · ${minutesToTimeString(marker.startMinutes ?? DEFAULT_DAY_START_MINUTES)} - ${minutesToTimeString(marker.endMinutes ?? (DEFAULT_DAY_START_MINUTES + 60))}`
}

function resolveCollisionPool(blocks: FacultyTimetableClassBlock[], candidateBlock: FacultyTimetableClassBlock) {
  if (candidateBlock.kind === 'extra' && candidateBlock.dateISO) {
    return blocks.filter(item => item.id === candidateBlock.id || classBlockOccursOnDate(item, candidateBlock.dateISO!, candidateBlock.day))
  }
  return blocks.filter(item => item.id === candidateBlock.id || (item.day === candidateBlock.day && !item.dateISO))
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
      <Card style={{ padding: 18, display: 'grid', gap: 14, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={16} color={T.accent} />
              <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Teaching Portfolio Timetable</div>
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              This is the same calendar and timetable workspace pattern used in the teaching portfolio, with admin-only semester marker editing layered around it.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip color={T.accent}>{offerings.length} mapped classes</Chip>
            <Chip color={classEditingLocked ? T.danger : T.success}>{classEditingLocked ? 'Class editing locked' : 'Class editing open'}</Chip>
            <Chip color={draftWorkspace.publishedAt ? T.blue : T.warning}>
              {draftWorkspace.publishedAt ? `Published ${formatShortDate(draftWorkspace.publishedAt.slice(0, 10))}` : 'Not published yet'}
            </Chip>
          </div>
        </div>

        {classEditingLocked ? (
          <InfoBanner tone="error" message={calendar?.directEditWindowEndsAt ? `Recurring class edits are locked here until the next direct-edit window. Current lock date: ${formatShortDate(calendar.directEditWindowEndsAt.slice(0, 10))}.` : 'Recurring class edits are currently locked here. Markers remain editable.'} />
        ) : null}
        {saveError ? <InfoBanner tone="error" message={saveError} /> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <button type="button" data-pressable="true" onClick={() => openNewMarker('semester-start')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.success }}><Sparkles size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>Semester Start</span></div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>Add the semester opening marker directly into the same planner context.</div>
          </button>
          <button type="button" data-pressable="true" onClick={() => openNewMarker('term-test-start')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.blue }}><Clock3 size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>Term Test Window</span></div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>Map CE / SEE windows and other assessment periods into the faculty planner.</div>
          </button>
          <button type="button" data-pressable="true" onClick={() => openNewMarker('holiday')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.danger }}><BellRing size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>Holiday / Closure</span></div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>Keep non-teaching interruptions visible in the exact weekly and calendar views faculty use.</div>
          </button>
          <button type="button" data-pressable="true" onClick={() => openNewMarker('event')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.accent }}><Plus size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>University Event</span></div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>Add one-off events without leaving the shared timetable workspace.</div>
          </button>
        </div>
      </Card>

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
          resolvedTaskIds={{}}
          timetable={draftTemplate}
          adminMarkers={draftWorkspace.markers}
          taskPlacements={{}}
          editableOverride={!classEditingLocked}
          canOpenCourseWorkspaceOverride={false}
          allowTaskCreation={false}
          onBack={() => {}}
          onScheduleTask={() => {}}
          onMoveClassBlock={updateClassBlockTiming}
          onResizeClassBlock={resizeClassBlock}
          onEditClassTiming={updateClassBlockTiming}
          onCreateExtraClass={createExtraClass}
          onOpenTaskComposer={() => {}}
          onOpenCourse={() => {}}
          onOpenActionQueue={() => {}}
          onUpdateTimetableBounds={updateBounds}
          onDismissTask={() => {}}
          onDismissSeries={() => {}}
          onEditMarker={openExistingMarker}
        />
      </Suspense>

      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Institution Markers</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
              Marker edits stay explicit here and also open from the shared calendar detail sheet.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn type="button" size="sm" variant="ghost" onClick={() => {
              setDraftTemplate(baseTemplate)
              setDraftWorkspace(baseWorkspace)
              setSaveError('')
            }} disabled={!dirty || saving}>Reset</Btn>
            <Btn type="button" size="sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
              <Save size={12} /> {saving ? 'Saving…' : 'Save Planner'}
            </Btn>
          </div>
        </div>

        {upcomingMarkers.length === 0 ? (
          <InfoBanner message="No semester markers, holiday closures, or university events are mapped yet." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {upcomingMarkers.map(marker => (
              <Card key={marker.markerId} style={{ padding: 14, background: T.surface2, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{marker.title}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{markerTypeLabel(marker.markerType)} · {formatMarkerWindow(marker)}</div>
                  </div>
                  <Chip color={marker.color} size={9}>{marker.allDay ? 'All day' : 'Timed'}</Chip>
                </div>
                {marker.note ? <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>{marker.note}</div> : null}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Btn type="button" size="sm" variant="ghost" onClick={() => openExistingMarker(marker)}>Edit Marker</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {markerDraft ? (
        <ModalFrame
          eyebrow="Institution Marker"
          title={editingMarkerId ? 'Edit Marker' : `Create ${markerTypeLabel(markerDraft.markerType)}`}
          caption="These markers appear in the same calendar and timetable views faculty use."
          onClose={() => {
            setMarkerDraft(null)
            setEditingMarkerId(null)
          }}
          actions={editingMarkerId ? <Btn type="button" size="sm" variant="danger" onClick={deleteMarkerDraft}><Trash2 size={12} /> Delete</Btn> : undefined}
          width={640}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <FieldLabel>Type</FieldLabel>
                <SelectInput value={markerDraft.markerType} onChange={event => setMarkerDraft(current => current ? {
                  ...current,
                  markerType: event.target.value as ApiAdminCalendarMarkerType,
                  title: markerDefaultTitle(event.target.value as ApiAdminCalendarMarkerType),
                  color: markerTypeColor(event.target.value as ApiAdminCalendarMarkerType),
                } : current)}>
                  <option value="semester-start">Semester Start</option>
                  <option value="semester-end">Semester End</option>
                  <option value="term-test-start">Term Test Start</option>
                  <option value="term-test-end">Term Test End</option>
                  <option value="holiday">Holiday</option>
                  <option value="event">Event</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Title</FieldLabel>
                <TextInput value={markerDraft.title} onChange={event => setMarkerDraft(current => current ? { ...current, title: event.target.value } : current)} />
              </div>
              <div>
                <FieldLabel>Date</FieldLabel>
                <TextInput type="date" value={markerDraft.dateISO} onChange={event => setMarkerDraft(current => current ? { ...current, dateISO: event.target.value } : current)} />
              </div>
              <div>
                <FieldLabel>End Date</FieldLabel>
                <TextInput type="date" value={markerDraft.endDateISO} onChange={event => setMarkerDraft(current => current ? { ...current, endDateISO: event.target.value } : current)} />
              </div>
              <div>
                <FieldLabel>Start</FieldLabel>
                <TextInput type="time" value={markerDraft.start} onChange={event => setMarkerDraft(current => current ? { ...current, start: event.target.value, allDay: false } : current)} />
              </div>
              <div>
                <FieldLabel>End</FieldLabel>
                <TextInput type="time" value={markerDraft.end} onChange={event => setMarkerDraft(current => current ? { ...current, end: event.target.value, allDay: false } : current)} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 12px', borderRadius: 12, border: `1px solid ${T.border2}`, background: T.surface, ...mono, fontSize: 11, color: T.text }}>
              <input type="checkbox" checked={markerDraft.allDay} onChange={event => setMarkerDraft(current => current ? { ...current, allDay: event.target.checked } : current)} />
              All-day marker
            </label>
            <div>
              <FieldLabel>Note</FieldLabel>
              <TextAreaInput rows={4} value={markerDraft.note} onChange={event => setMarkerDraft(current => current ? { ...current, note: event.target.value } : current)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Btn type="button" size="sm" variant="ghost" onClick={() => {
                setMarkerDraft(null)
                setEditingMarkerId(null)
              }}>Cancel</Btn>
              <Btn type="button" size="sm" onClick={saveMarkerDraft}>Save Marker</Btn>
            </div>
          </div>
        </ModalFrame>
      ) : null}
    </div>
  )
}
