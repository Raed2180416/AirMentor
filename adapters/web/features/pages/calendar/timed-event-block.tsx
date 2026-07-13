import { motion } from 'framer-motion'
import { Clock3, GripVertical } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { minutesToDisplayLabel } from '@web/shared/state/calendar-utils'
import { AGENDA_PIXELS_PER_MINUTE } from './constants'
import { edgeHandleStyle, miniIconButtonStyle } from './styles'
import { TaskActionStrip } from './task-action-strip'
import type { AgendaBoardProps, TimedEventCard } from './types'

export function TimedEventBlock({
  event,
  dayStartMinutes,
  lane,
  laneCount,
  isGhosted,
  onTaskDragStart,
  onClassDragStart,
  onClassResizeStart,
  onOpenEventDetails,
  onMoveTaskToUntimed,
  onDismissTask,
  onDismissSeries,
  editable,
  touchesPreviousClass,
  touchesNextClass,
}: {
  event: TimedEventCard & { laneCount: number; lane: number }
  dayStartMinutes: number
  lane: number
  laneCount: number
  isGhosted: boolean
  onTaskDragStart: AgendaBoardProps['onTaskDragStart']
  onClassDragStart: AgendaBoardProps['onClassDragStart']
  onClassResizeStart: AgendaBoardProps['onClassResizeStart']
  onOpenEventDetails: AgendaBoardProps['onOpenEventDetails']
  onMoveTaskToUntimed: AgendaBoardProps['onMoveTaskToUntimed']
  onDismissTask: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
  editable: boolean
  touchesPreviousClass: boolean
  touchesNextClass: boolean
}) {
  const top = (event.startMinutes - dayStartMinutes) * AGENDA_PIXELS_PER_MINUTE
  const height = Math.max(40, (event.endMinutes - event.startMinutes) * AGENDA_PIXELS_PER_MINUTE)
  const laneWidthPercent = laneCount <= 1 ? 100 : 100 / laneCount
  const width = laneCount <= 1 ? 'calc(100% - 16px)' : `calc(${laneWidthPercent}% - 6px)`
  const left = laneCount <= 1 ? 8 : `calc(${lane * laneWidthPercent}% + ${lane * 6 + 8}px)`
  const isTask = event.eventType === 'task' && !!event.task
  const isMeeting = event.eventType === 'meeting' && !!event.meeting
  const isClass = event.eventType === 'class' && !!event.classBlock
  const isMarker = event.eventType === 'marker' && !!event.marker
  const narrowLane = laneCount > 1 || laneWidthPercent < 68
  const compact = height < 78 || narrowLane
  const minimalChrome = height < 64 || laneWidthPercent < 70
  const renderedHeight = isClass ? height : Math.max(40, height)

  const baseStyle = {
    position: 'absolute' as const,
    top,
    left,
    width,
    height: isClass ? renderedHeight : undefined,
    minHeight: isClass ? undefined : renderedHeight,
    borderRadius: isClass ? 0 : 14,
    borderTopLeftRadius: isClass ? (touchesPreviousClass ? 0 : 14) : undefined,
    borderTopRightRadius: isClass ? (touchesPreviousClass ? 0 : 14) : undefined,
    borderBottomLeftRadius: isClass ? (touchesNextClass ? 0 : 14) : undefined,
    borderBottomRightRadius: isClass ? (touchesNextClass ? 0 : 14) : undefined,
    border: `1px solid ${event.invalid ? T.danger : `${event.accent}30`}`,
    borderTopColor: isClass && touchesPreviousClass ? 'transparent' : undefined,
    background: event.invalid ? `${T.danger}18` : `${event.accent}${isClass ? '14' : '18'}`,
    boxShadow: event.invalid
      ? `0 0 0 1px ${T.danger}20 inset`
      : isClass
        ? (touchesPreviousClass ? `inset 0 1px 0 ${event.accent}26` : `0 8px 18px ${event.accent}0a`)
        : `0 10px 24px ${event.accent}12`,
    padding: minimalChrome ? '5px 7px' : compact ? '7px 9px' : '10px 12px',
    display: 'grid',
    gap: compact ? 4 : 6,
    opacity: isGhosted ? 0.24 : 1,
    cursor: editable && (isTask || isClass) ? 'grab' : 'default',
    overflow: 'hidden',
  }

  const dragHandler = editable && isTask
    ? (evt: React.PointerEvent<HTMLDivElement>) => onTaskDragStart(evt, event.task!, event.placement ?? null, event.dateISO)
    : editable && isClass
      ? (evt: React.PointerEvent<HTMLDivElement>) => onClassDragStart(evt, event.classBlock!, event.dateISO)
      : undefined

  return (
    <motion.div
      data-event-card="true"
      layout
      whileHover={event.eventType !== 'preview' ? { y: isClass ? -1 : -2, scale: isClass ? 1.002 : 1.01 } : undefined}
      whileTap={event.eventType !== 'preview' && editable ? { scale: 0.994 } : undefined}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onPointerDown={dragHandler}
      onClick={evt => {
        if (event.eventType === 'preview') return
        evt.stopPropagation()
        onOpenEventDetails(event)
      }}
      style={baseStyle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...sora,
              fontWeight: 700,
              fontSize: minimalChrome ? 11 : 12,
              color: T.text,
              lineHeight: minimalChrome ? 1.15 : 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: minimalChrome ? 2 : compact ? 2 : 3,
            }}
          >
            {event.title}
          </div>
          {!compact && !minimalChrome && <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{event.subtitle}</div>}
        </div>
        {event.eventType !== 'preview' && editable && !isMarker && !isMeeting && !minimalChrome && (
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

      {!compact && !minimalChrome && event.eventType !== 'preview' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {isMeeting ? <Clock3 size={10} /> : <GripVertical size={10} />} {isMeeting ? 'Meeting slot' : editable ? 'Drag to move' : 'Scheduled'}
          </div>
          {isTask && editable && (
            <TaskActionStrip
              task={event.task!}
              onDismissTask={onDismissTask}
              onDismissSeries={onDismissSeries}
            />
          )}
        </div>
      )}
    </motion.div>
  )
}
