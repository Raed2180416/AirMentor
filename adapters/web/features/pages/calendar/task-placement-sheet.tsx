import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { SharedTask } from '@kernel/shared/domain'
import { DEFAULT_TASK_DURATION_MINUTES, formatShortDate, minutesToDisplayLabel, minutesToTimeString } from '@web/shared/state/calendar-utils'
import { Btn, Card, Chip, UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from '@web/shared/ui/primitives'
import { normalizeTimeValue } from './calendar-helpers'
import { iconButtonStyle, sheetFieldStyle } from './styles'
import type { AddTargetState } from './types'

export function TaskPlacementSheet({
  target,
  queueCandidates,
  allowTaskCreation,
  onClose,
  onChangeTarget,
  onPlaceTask,
  onCreateNewTask,
  onScheduleExtraClass,
}: {
  target: AddTargetState
  queueCandidates: SharedTask[]
  allowTaskCreation: boolean
  onClose: () => void
  onChangeTarget: (next: Partial<AddTargetState>) => void
  onPlaceTask: (taskId: string) => void
  onCreateNewTask: () => void
  onScheduleExtraClass: () => void
}) {
  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        onClick={event => event.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.985 }}
        transition={UI_TRANSITION_MEDIUM}
        style={{ width: '100%', maxWidth: 720, maxHeight: '82vh', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: '0 26px 68px rgba(2, 6, 23, 0.34)' }}
      >
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Add to {formatShortDate(target.dateISO)}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                {target.placementMode === 'untimed'
                  ? 'No preferred time for this date'
                  : `${minutesToDisplayLabel(target.startMinutes ?? 0)} - ${minutesToDisplayLabel(target.endMinutes ?? 0)} · exact timed placement`}
              </div>
            </div>
            <button type="button" aria-label="Close add sheet" onClick={onClose} style={iconButtonStyle()}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="scroll-pane scroll-pane--dense" style={{ overflowY: 'auto', padding: 18, display: 'grid', gap: 10 }}>
          {target.placementMode === 'timed' && (
            <div style={{ borderRadius: 12, border: `1px solid ${T.accent}28`, background: `${T.accent}10`, padding: '12px 14px', display: 'grid', gap: 10 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Placement</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>The preview block updates as you edit start and end time.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 10, color: T.muted }}>Start</span>
                  <input
                    type="time"
                    value={minutesToTimeString(target.startMinutes ?? 0)}
                    onChange={event => onChangeTarget({ startMinutes: normalizeTimeValue(event.target.value, target.startMinutes ?? 0) })}
                    style={sheetFieldStyle()}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 10, color: T.muted }}>End</span>
                  <input
                    type="time"
                    value={minutesToTimeString(target.endMinutes ?? ((target.startMinutes ?? 0) + DEFAULT_TASK_DURATION_MINUTES))}
                    onChange={event => onChangeTarget({ endMinutes: normalizeTimeValue(event.target.value, target.endMinutes ?? ((target.startMinutes ?? 0) + DEFAULT_TASK_DURATION_MINUTES)) })}
                    style={sheetFieldStyle()}
                  />
                </label>
              </div>
            </div>
          )}

          {queueCandidates.map(task => (
            <Card key={task.id} style={{ background: T.surface2, padding: '12px 14px', display: 'grid', gap: 8, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{task.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{task.studentName} · {task.courseCode} · {task.taskType ?? 'Task'}</div>
                </div>
                <Chip color={task.scheduleMeta?.mode === 'scheduled' ? T.warning : T.success} size={9}>{task.scheduleMeta?.mode === 'scheduled' ? 'Recurring' : 'One-time'}</Chip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim }}>This updates the same queue item and places it directly into the workspace.</div>
                <Btn size="sm" onClick={() => onPlaceTask(task.id)}>Place here</Btn>
              </div>
            </Card>
          ))}
          {queueCandidates.length === 0 && (
            <div style={{ ...mono, fontSize: 11, color: T.dim, textAlign: 'center', padding: '24px 12px' }}>
              No active queue items are available in your current merged scope.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>
            {allowTaskCreation ? 'Need something new instead of reusing queue state or want to add a one-off extra class?' : 'Use this placement for a one-off extra class in the shared timetable canvas.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
            {target.placementMode === 'timed' && (
              <Btn size="sm" variant="ghost" onClick={onScheduleExtraClass}>
                <Plus size={12} /> Schedule Extra Class
              </Btn>
            )}
            {allowTaskCreation ? (
              <Btn size="sm" onClick={onCreateNewTask}>
                <Plus size={12} /> Create New Task
              </Btn>
            ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
