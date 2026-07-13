import { useState } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { type Role, type SharedTask } from '@kernel/shared/domain'
import type { ApiAcademicFacultyProfile } from '@web/shared/api/types'
import { Btn, Card, Chip, PageBackButton, PageShell } from '@web/shared/ui/primitives'
import { formatDateTime } from './format-date-time'

type QueueHistoryPageProps = {
  role: Role
  tasks: SharedTask[]
  resolvedTaskIds: Record<string, number>
  proofProfile?: ApiAcademicFacultyProfile | null
  onBack: () => void
  onOpenTaskStudent: (task: SharedTask) => void
  onOpenUnlockReview: (taskId: string) => void
  onRestoreTask: (taskId: string) => void
  onOpenStudentShell?: (studentId: string) => void
  onOpenRiskExplorer?: (studentId: string) => void
}

export function QueueHistoryPage({
  role,
  tasks,
  resolvedTaskIds,
  proofProfile: _proofProfile,
  onBack,
  onOpenTaskStudent,
  onOpenUnlockReview,
  onRestoreTask,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: QueueHistoryPageProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved' | 'dismissed'>('all')
  const visible = tasks
    .filter(task => {
      if (filter === 'all') return true
      if (filter === 'active') return !resolvedTaskIds[task.id] && !task.dismissal
      if (filter === 'resolved') return !!resolvedTaskIds[task.id] && !task.dismissal
      return !!task.dismissal
    })
    .sort((left, right) => (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt))

  return (
    <PageShell size="standard">
      <PageBackButton onClick={onBack} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Queue History</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{role} view of active, resolved, and reassigned items.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'resolved', 'dismissed'] as const).map(option => (
            <button key={option} data-tab="true" onClick={() => setFilter(option)} style={{ ...mono, fontSize: 10, padding: '5px 8px', borderRadius: 4, border: `1px solid ${filter === option ? T.accent : T.border}`, background: filter === option ? `${T.accent}18` : 'transparent', color: filter === option ? T.accentLight : T.muted, cursor: 'pointer' }}>
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {visible.map(task => (
          <Card key={task.id} onClick={() => onOpenTaskStudent(task)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{task.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName} · {task.studentUsn} · {task.courseCode || 'Mentor context'}</div>
                <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 4 }}>Open the related student context directly from anywhere on this card.</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip color={task.dismissal ? T.muted : resolvedTaskIds[task.id] ? T.success : T.warning} size={9}>{task.dismissal ? 'Dismissed' : resolvedTaskIds[task.id] ? 'Resolved' : 'Active'}</Chip>
                {task.dismissal ? <Chip color={task.dismissal.kind === 'series' ? T.danger : T.muted} size={9}>{task.dismissal.kind === 'series' ? 'Series dismissed' : 'Dismissed'}</Chip> : null}
                <Chip color={task.assignedTo === 'HoD' ? T.danger : task.assignedTo === 'Mentor' ? T.warning : T.accent} size={9}>{task.assignedTo}</Chip>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
              {(task.transitionHistory ?? []).map(transition => (
                <div key={transition.id} style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 112 }}>{formatDateTime(transition.at)}</div>
                  <div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{transition.action}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>{transition.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div onClick={event => event.stopPropagation()}><Btn size="sm" variant="ghost" onClick={() => onOpenTaskStudent(task)}>Open Student</Btn></div>
              {onOpenRiskExplorer ? <div onClick={event => event.stopPropagation()}><Btn size="sm" variant="ghost" onClick={() => onOpenRiskExplorer(task.studentId)}>Risk Explorer</Btn></div> : null}
              {onOpenStudentShell ? <div onClick={event => event.stopPropagation()}><Btn size="sm" variant="ghost" onClick={() => onOpenStudentShell(task.studentId)}>Student Shell</Btn></div> : null}
              {task.dismissal ? <div onClick={event => event.stopPropagation()}><Btn size="sm" onClick={() => onRestoreTask(task.id)}>{task.dismissal.kind === 'series' ? 'Resume series' : 'Restore'}</Btn></div> : null}
              {task.unlockRequest && role === 'HoD' ? <div onClick={event => event.stopPropagation()}><Btn size="sm" onClick={() => onOpenUnlockReview(task.id)}>Open Unlock Review</Btn></div> : null}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}
