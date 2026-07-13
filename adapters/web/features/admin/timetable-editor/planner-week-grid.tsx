import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { FacultyTimetableClassBlock } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker, ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import { formatShortDate, getWeekdayForDateISO, minutesToDisplayLabel } from '@web/shared/state/calendar-utils'
import { Card, Chip } from '@web/shared/ui/primitives'
import { PIXELS_PER_MINUTE } from './helpers'
import { iconButtonStyle } from './styles'
import type { EditorSheetState, HoverTarget, InteractionState, PlannerEventCard } from './types'

function renderAllDayMarkerChip(marker: ApiAdminCalendarMarker) {
  return (
    <Chip key={marker.markerId} color={marker.color} size={9}>
      {marker.title}
    </Chip>
  )
}

export function PlannerWeekGrid({
  weekDates,
  hoverTarget,
  setHoverTarget,
  setSelectedDateISO,
  openMarkerEditor,
  openMarkerFromExisting,
  openExtraClassEditor,
  allDayMarkersByDate,
  timeGuides,
  dayStartMinutes,
  dayEndMinutes,
  timedEventsByDate,
  columnRefs,
  classEditingLocked,
  setInteraction,
  setEditorSheet,
}: {
  weekDates: string[]
  hoverTarget: HoverTarget | null
  setHoverTarget: Dispatch<SetStateAction<HoverTarget | null>>
  setSelectedDateISO: Dispatch<SetStateAction<string>>
  openMarkerEditor: (markerType: ApiAdminCalendarMarkerType, dateISO: string, timed?: { startMinutes: number; endMinutes: number }) => void
  openMarkerFromExisting: (marker: ApiAdminCalendarMarker) => void
  openExtraClassEditor: (dateISO: string, timed?: { startMinutes: number; endMinutes: number }, existing?: FacultyTimetableClassBlock) => void
  allDayMarkersByDate: Record<string, ApiAdminCalendarMarker[]>
  timeGuides: number[]
  dayStartMinutes: number
  dayEndMinutes: number
  timedEventsByDate: Record<string, PlannerEventCard[]>
  columnRefs: MutableRefObject<Record<string, HTMLDivElement | null>>
  classEditingLocked: boolean
  setInteraction: Dispatch<SetStateAction<InteractionState | null>>
  setEditorSheet: Dispatch<SetStateAction<EditorSheetState | null>>
}) {
  return (
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
  )
}
