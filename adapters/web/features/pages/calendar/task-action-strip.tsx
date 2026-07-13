import type { SharedTask } from '@kernel/shared/domain'
import { taskTextButtonStyle } from './styles'

export function TaskActionStrip({
  task,
  compact = false,
  onDismissTask,
  onDismissSeries,
}: {
  task: SharedTask
  compact?: boolean
  onDismissTask: (taskId: string) => void
  onDismissSeries: (taskId: string) => void
}) {
  const recurring = task.scheduleMeta?.mode === 'scheduled'

  return (
    <div style={{ display: 'flex', gap: compact ? 4 : 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {!recurring && (
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={event => {
          event.stopPropagation()
          onDismissTask(task.id)
        }} style={taskTextButtonStyle(compact)}>
          Dismiss
        </button>
      )}
      {recurring && (
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={event => {
          event.stopPropagation()
          onDismissSeries(task.id)
        }} style={taskTextButtonStyle(compact)}>
          Dismiss
        </button>
      )}
    </div>
  )
}
