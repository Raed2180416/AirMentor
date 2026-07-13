import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { FacultyTimetableClassBlock } from '@kernel/shared/domain'
import {
  DEFAULT_TASK_DURATION_MINUTES,
  assignAgendaLanes,
  buildTimeGuides,
  clampMinuteValue,
  minutesToTimeString,
  resolveTimedHoverRange,
} from '@web/shared/state/calendar-utils'
import { Btn, HScrollArea } from '@web/shared/ui/primitives'
import { AGENDA_PIXELS_PER_MINUTE, DAY_COLUMN_MIN_WIDTH } from './constants'
import { hoverUntimedBucket } from './calendar-helpers'
import { describeMarkerType } from './marker-utils'
import { TaskActionStrip } from './task-action-strip'
import { TimedEventBlock } from './timed-event-block'
import type { AgendaBoardProps } from './types'

export function AgendaBoard({
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
  onOpenEventDetails,
  onOpenMarkerDetails,
  onMoveTaskToUntimed,
  onDismissTask,
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
                transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
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
          const classTouchMap = layout
            .filter((event): event is typeof layout[number] & { eventType: 'class'; classBlock: FacultyTimetableClassBlock } => event.eventType === 'class' && !!event.classBlock)
            .sort((left, right) => {
              if (left.lane !== right.lane) return left.lane - right.lane
              if (left.startMinutes !== right.startMinutes) return left.startMinutes - right.startMinutes
              if (left.endMinutes !== right.endMinutes) return left.endMinutes - right.endMinutes
              return left.entityId.localeCompare(right.entityId)
            })
            .reduce<Record<string, { touchesPrevious: boolean; touchesNext: boolean }>>((acc, event, index, all) => {
              const previous = index > 0 ? all[index - 1] : null
              const next = index < all.length - 1 ? all[index + 1] : null
              acc[event.entityId] = {
                touchesPrevious: !!previous && previous.lane === event.lane && previous.endMinutes === event.startMinutes,
                touchesNext: !!next && next.lane === event.lane && event.endMinutes === next.startMinutes,
              }
              return acc
            }, {})
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

              {column.allDayMarkers.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {column.allDayMarkers.map(markerChip => (
                    <button
                      key={markerChip.markerId}
                      type="button"
                      onClick={() => onOpenMarkerDetails(markerChip.marker, column.dateISO)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        borderRadius: 12,
                        border: `1px solid ${markerChip.accent}38`,
                        background: `${markerChip.accent}16`,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div style={{ ...mono, fontSize: 10, color: markerChip.accent }}>{describeMarkerType(markerChip.marker.markerType)}</div>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{markerChip.title}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>{markerChip.subtitle}</div>
                    </button>
                  ))}
                </div>
              )}

              <div
                ref={node => setColumnRef(column.dateISO, node)}
                onMouseLeave={() => onHoverColumn(hoverAdd?.dateISO === column.dateISO ? null : hoverAdd)}
                onMouseMove={event => {
                  if (!editable || interaction) return
                  const target = event.target as HTMLElement
                  if (target.closest('[data-event-card="true"]')) {
                    onHoverColumn(hoverAdd?.dateISO === column.dateISO ? null : hoverAdd)
                    return
                  }
                  const rect = event.currentTarget.getBoundingClientRect()
                  const relativeMinute = clampMinuteValue((event.clientY - rect.top) / AGENDA_PIXELS_PER_MINUTE, 0, dayEndMinutes - dayStartMinutes)
                  const minute = dayStartMinutes + relativeMinute
                  const range = resolveTimedHoverRange(
                    minute,
                    column.events
                      .filter(item => item.eventType !== 'preview')
                      .map(item => ({ startMinutes: item.startMinutes, endMinutes: item.endMinutes })),
                    dayStartMinutes,
                    dayEndMinutes,
                  )
                  if (!range) {
                    onHoverColumn(hoverAdd?.dateISO === column.dateISO ? null : hoverAdd)
                    return
                  }
                  onHoverColumn({
                    dateISO: column.dateISO,
                    day: column.day,
                    cursorTopPx: event.clientY - rect.top,
                    gapStartMinutes: range.gapStartMinutes,
                    gapEndMinutes: range.gapEndMinutes,
                    startMinutes: range.startMinutes,
                    endMinutes: range.endMinutes,
                  })
                }}
                onClick={event => {
                  if (!editable || interaction || hoverAdd?.dateISO !== column.dateISO) return
                  const target = event.target as HTMLElement
                  if (target.closest('[data-event-card="true"], button, input, select, textarea')) return
                  onOpenAdd({
                    dateISO: column.dateISO,
                    placementMode: 'timed',
                    startMinutes: hoverAdd.startMinutes,
                    endMinutes: hoverAdd.endMinutes,
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
                    aria-label={`Add task on ${column.label}`}
                    onClick={event => {
                      event.stopPropagation()
                      onOpenAdd({
                        dateISO: column.dateISO,
                        placementMode: 'timed',
                        startMinutes: hoverAdd.startMinutes,
                        endMinutes: hoverAdd.endMinutes,
                      })
                    }}
                    style={{
                      position: 'absolute',
                      top: (() => {
                        const buttonHeight = 36
                        const gapTopPx = Math.max(8, ((hoverAdd.gapStartMinutes - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE) + 6)
                        const gapBottomPx = Math.min(boardHeight - buttonHeight - 8, ((hoverAdd.gapEndMinutes - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE) - buttonHeight - 6)
                        return Math.max(gapTopPx, Math.min(gapBottomPx, hoverAdd.cursorTopPx - (buttonHeight / 2)))
                      })(),
                      left: 10,
                      right: 10,
                      zIndex: 4,
                      height: 36,
                      borderRadius: 12,
                      border: `1px solid ${T.accent}48`,
                      background: `${T.accent}16`,
                      color: T.accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: `0 6px 20px ${T.accent}15`,
                      cursor: 'pointer',
                      ...mono,
                      fontSize: 10,
                    }}
                  >
                    <Plus size={13} />
                    Add task here
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
                    onOpenEventDetails={onOpenEventDetails}
                    onMoveTaskToUntimed={onMoveTaskToUntimed}
                    onDismissTask={onDismissTask}
                    onDismissSeries={onDismissSeries}
                    editable={editable}
                    touchesPreviousClass={!!classTouchMap[event.entityId]?.touchesPrevious}
                    touchesNextClass={!!classTouchMap[event.entityId]?.touchesNext}
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
                  transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>Untimed Day Tasks</div>
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>No preferred time</div>
                  </div>
                  {editable && (
                    <Btn size="sm" variant="ghost" onClick={() => onOpenAdd({ dateISO: column.dateISO, placementMode: 'untimed' })}>
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
                  onClick={event => {
                    event.stopPropagation()
                    onOpenEventDetails({
                      id: `untimed-${task.id}`,
                      renderId: `untimed-${task.id}`,
                      entityId: task.id,
                      eventType: 'task',
                      dateISO: column.dateISO,
                      day: column.day,
                      startMinutes: dayStartMinutes,
                      endMinutes: dayStartMinutes + DEFAULT_TASK_DURATION_MINUTES,
                      title: task.title,
                      subtitle: `${task.studentName} · ${task.taskType ?? 'Task'}`,
                      accent: T.warning,
                      task,
                    })
                  }}
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
