import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, CheckCircle, ListTodo } from 'lucide-react'
import { T, mono, sora } from '../data'
import {
  getRemedialProgress,
  isTaskActiveForQueue,
  toTodayISO,
  type Role,
  type SharedTask,
  type TaskType,
} from '../domain'
import { Chip, RiskBadge, UI_TRANSITION_FAST, withAlpha } from '../ui-primitives'
import { formatDateTime, getLatestTransition } from './workspace-helpers'

const subtleDividerStyle = {
  height: 1,
  background: `linear-gradient(90deg, transparent, ${withAlpha(T.border2, '26')} 14%, ${withAlpha(T.border2, '62')} 50%, ${withAlpha(T.border2, '26')} 86%, transparent)`,
  opacity: 0.9,
}

/* ══════════════════════════════════════════════════════════════
   ACTION QUEUE (Right Sidebar)
   ══════════════════════════════════════════════════════════════ */

export function ActionQueue({ role, tasks, resolvedTaskIds, simulatedDateISO, onResolveTask, onUndoTask, onOpenStudent, onOpenTaskComposer, onRemedialCheckIn, onReassignTask, onOpenUnlockReview, onOpenQueueHistory, onApproveUnlock, onRejectUnlock, onResetComplete, onToggleSchedulePause, onEditSchedule, onDismissTask, onDismissSeries }: { role: Role; tasks: SharedTask[]; resolvedTaskIds: Record<string, number>; simulatedDateISO?: string; onResolveTask: (id: string) => void; onUndoTask: (id: string) => void; onOpenStudent: (task: SharedTask) => void; onOpenTaskComposer: (input?: { offeringId?: string; studentId?: string; taskType?: TaskType }) => void; onRemedialCheckIn: (taskId: string) => void; onReassignTask: (taskId: string, toRole: Role) => void; onOpenUnlockReview: (taskId: string) => void; onOpenQueueHistory: () => void; onApproveUnlock: (taskId: string) => void; onRejectUnlock: (taskId: string) => void; onResetComplete: (taskId: string) => void; onToggleSchedulePause: (taskId: string) => void; onEditSchedule: (taskId: string) => void; onDismissTask: (taskId: string) => void; onDismissSeries: (taskId: string) => void }) {
  // §B.14 + audit §5.2: queue visibility must honor the simulated date (the
  // proof-playback currentDateISO from the backend), not wall-clock time.
  // toTodayISO() is only the fallback for non-proof sessions (e.g. live mode).
  const todayISO = simulatedDateISO ?? toTodayISO()
  const [showQueueHelp, setShowQueueHelp] = useState(false)
  const active = tasks
    .filter(t => isTaskActiveForQueue(t, resolvedTaskIds, todayISO))
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  const done = tasks.filter(t => !!resolvedTaskIds[t.id] && !t.dismissal).sort((a, b) => (resolvedTaskIds[b.id] ?? 0) - (resolvedTaskIds[a.id] ?? 0))
  const buttonStyle = (color: string, variant: 'ghost' | 'filled' = 'ghost', disabled = false) => ({
    ...mono,
    fontSize: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${disabled ? T.border2 : `${color}${variant === 'filled' ? '44' : '30'}`}`,
    background: disabled ? T.surface3 : variant === 'filled' ? `${color}16` : `${color}10`,
    color: disabled ? T.dim : color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
  })

  return (
    <div className="scroll-pane scroll-pane--dense" style={{ width: 320, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ListTodo size={16} color={T.accent} />
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Action Queue</div>
        <button
          type="button"
          aria-label={showQueueHelp ? 'Hide queue help' : 'Show queue help'}
          aria-expanded={showQueueHelp}
          title={showQueueHelp ? 'Hide queue help' : 'Show queue help'}
          onClick={() => setShowQueueHelp(current => !current)}
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            border: `1px solid ${T.border2}`,
            background: showQueueHelp ? `${T.accent}16` : T.surface2,
            color: showQueueHelp ? T.accent : T.muted,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            ...mono,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          i
        </button>
        <button aria-label="Open queue history" title="Open queue history" onClick={onOpenQueueHistory} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.accent, ...mono, fontSize: 10 }}>History</button>
        <Chip color={T.danger} size={10}>{active.length} pending</Chip>
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>Single-owner queue with visible reassignment trail.</div>
      <AnimatePresence initial={false}>
        {showQueueHelp && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}
          >
            <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Queue shortcuts</div>
            <div style={{ ...mono, fontSize: 10, color: T.text, marginBottom: 8 }}>Click any task card to open the full student or task context.</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip color={T.success} size={9}>Mark done</Chip>
                <span style={{ ...mono, fontSize: 10, color: T.dim }}>Completes the current work. Recurring tasks come back on their next scheduled date.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip color={T.muted} size={9}>Dismiss</Chip>
                <span style={{ ...mono, fontSize: 10, color: T.dim }}>Stops it from active work. On recurring tasks, this ends the series and keeps it restorable in history.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {active.map(t => {
        const progress = getRemedialProgress(t.remedialPlan)
        const hasRemedialFlow = (t.taskType === 'Remedial' || !!t.remedialPlan) && progress.total > 0
        const latestTransition = getLatestTransition(t)
        return (
          <motion.div
            key={t.id}
            data-testid="action-queue-item"
            layout
            role="button"
            tabIndex={0}
            aria-label={`Open details for ${t.title}`}
            title="Open details"
            onClick={() => onOpenStudent(t)}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpenStudent(t)
              }
            }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ y: -1, scale: 0.992 }}
            transition={UI_TRANSITION_FAST}
            style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: `0 14px 28px ${T.bg}22` }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ ...sora, fontWeight: 600, fontSize: 12, color: T.text, lineHeight: 1.3 }}>{t.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{t.courseCode || 'Mentor'} · {t.year}</div>
              </div>
              <RiskBadge band={t.riskBand} prob={t.riskProb} />
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 8 }}>{t.actionHint}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip color={t.status === 'New' ? T.danger : T.warning} size={9}>{t.status}</Chip>
              <Chip color={T.accent} size={9}>Owner: {t.assignedTo}</Chip>
              <Chip color={T.dim} size={9}>Due: {t.due}</Chip>
              {t.scheduleMeta?.mode === 'scheduled' && <Chip color={t.scheduleMeta.status === 'paused' ? T.warning : t.scheduleMeta.status === 'ended' ? T.danger : T.success} size={9}>Recurring: {t.scheduleMeta.preset} · {t.scheduleMeta.status ?? 'active'}</Chip>}
              {t.unlockRequest && <Chip color={t.unlockRequest.status === 'Rejected' ? T.danger : t.unlockRequest.status === 'Reset Completed' ? T.success : T.warning} size={9}>Unlock: {t.unlockRequest.status}</Chip>}
            </div>
            {latestTransition && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ ...mono, fontSize: 9, color: T.muted }}>
                  Last transition: {latestTransition.action} · {formatDateTime(latestTransition.at)}
                </div>
                <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 3 }}>{latestTransition.note}</div>
              </div>
            )}
            {hasRemedialFlow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Chip color={progress.completed === progress.total ? T.success : T.warning} size={9}>Plan {progress.completed}/{progress.total}</Chip>
                <span style={{ ...mono, fontSize: 9, color: T.dim }}>Next check-in: {t.remedialPlan?.checkInDatesISO.find(d => new Date(`${d}T00:00:00`).getTime() >= Date.now()) ?? 'Schedule pending'}</span>
              </div>
            )}
            <div style={{ ...mono, fontSize: 9, color: T.dim, marginBottom: 8 }}>
              {t.scheduleMeta?.mode === 'scheduled'
                ? 'Recurring task: Mark done clears only this occurrence. Dismiss ends the recurring task.'
                : 'One-time task: Mark done completes it. Dismiss removes it from the active queue without marking it complete.'}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(t.taskType === 'Remedial' || !!t.remedialPlan) && (
                  <button
                    aria-label="Log remedial check-in"
                    title="Log remedial check-in"
                    onClick={event => {
                      event.stopPropagation()
                      onRemedialCheckIn(t.id)
                    }}
                    style={buttonStyle(T.warning)}
                  >
                    <Activity size={12} />
                    Check-in
                  </button>
                )}
                {t.unlockRequest && role === 'HoD' && (
                  <>
                    <button aria-label="Review unlock request" title="Review unlock" onClick={event => { event.stopPropagation(); onOpenUnlockReview(t.id) }} style={buttonStyle(T.warning)}>Review</button>
                    {t.unlockRequest.status === 'Pending' && <button aria-label="Approve unlock request" title="Approve unlock" onClick={event => { event.stopPropagation(); onApproveUnlock(t.id) }} style={buttonStyle(T.success)}>Approve</button>}
                    {t.unlockRequest.status === 'Pending' && <button aria-label="Reject unlock request" title="Reject unlock" onClick={event => { event.stopPropagation(); onRejectUnlock(t.id) }} style={buttonStyle(T.danger)}>Reject</button>}
                    {t.unlockRequest.status === 'Approved' && <button aria-label="Reset and unlock dataset" title="Reset and unlock" onClick={event => { event.stopPropagation(); onResetComplete(t.id) }} style={buttonStyle(T.success)}>Reset</button>}
                  </>
                )}
                {role === 'Course Leader' && !t.unlockRequest && <button aria-label="Reassign task to mentor" title="Defer to Mentor" onClick={event => { event.stopPropagation(); onReassignTask(t.id, 'Mentor') }} style={buttonStyle(T.blue)}>Mentor</button>}
                {role !== 'HoD' && !t.unlockRequest && <button aria-label="Reassign task to hod" title="Defer to HoD" onClick={event => { event.stopPropagation(); onReassignTask(t.id, 'HoD') }} style={buttonStyle(T.danger)}>HoD</button>}
                {role === 'HoD' && !t.unlockRequest && <button aria-label="Return task to course leader" title="Return to Course Leader" onClick={event => { event.stopPropagation(); onReassignTask(t.id, 'Course Leader') }} style={buttonStyle(T.blue)}>CL</button>}
                {t.scheduleMeta?.mode === 'scheduled' && t.scheduleMeta.status !== 'ended' && <button aria-label="Pause or resume recurrence" title={t.scheduleMeta.status === 'paused' ? 'Resume recurrence' : 'Pause recurrence'} onClick={event => { event.stopPropagation(); onToggleSchedulePause(t.id) }} style={buttonStyle(T.warning)}>{t.scheduleMeta.status === 'paused' ? 'Resume' : 'Pause'}</button>}
                {t.scheduleMeta?.mode === 'scheduled' && t.scheduleMeta.status !== 'ended' && <button aria-label="Edit recurrence" title="Edit recurrence" onClick={event => { event.stopPropagation(); onEditSchedule(t.id) }} style={buttonStyle(T.accent)}>Edit schedule</button>}
              </div>
              <div style={subtleDividerStyle} aria-hidden="true" />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!t.scheduleMeta && <button aria-label="Dismiss task" title="Dismiss task to history" onClick={event => { event.stopPropagation(); onDismissTask(t.id) }} style={buttonStyle(T.muted)}>Dismiss</button>}
                  {t.scheduleMeta?.mode === 'scheduled' && <button aria-label="Dismiss recurring task" title="Dismiss recurring task" onClick={event => { event.stopPropagation(); onDismissSeries(t.id) }} style={buttonStyle(T.danger)}>Dismiss</button>}
                </div>
                <button aria-label={t.scheduleMeta?.mode === 'scheduled' ? 'Mark current occurrence as done' : 'Mark task as done'} title={t.scheduleMeta?.mode === 'scheduled' ? 'Mark current occurrence as done' : 'Mark task as done'} onClick={event => { event.stopPropagation(); onResolveTask(t.id) }} style={buttonStyle(T.success, 'filled')}>
                  <CheckCircle size={12} />
                  Mark done
                </button>
              </div>
            </div>
          </motion.div>
        )
      })}

      {done.length > 0 && (
        <>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Resolved history</div>
          {done.slice(0, 6).map(t => (
            <div key={t.id} style={{ background: `${T.success}08`, border: `1px solid ${T.success}20`, borderRadius: 8, padding: '8px 12px', marginBottom: 6, opacity: 0.75 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...mono, fontSize: 11, color: T.success, textDecoration: 'line-through', flex: 1 }}>{t.title}</div>
                <button aria-label="Undo resolved task" title="Undo" onClick={() => onUndoTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, ...mono, fontSize: 10 }}>Undo</button>
              </div>
              <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 2 }}>Kept in queue history for audit continuity.</div>
            </div>
          ))}
        </>
      )}

      {active.length === 0 && done.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
          <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.success }}>All clear!</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>No pending actions right now</div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 10, background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${T.surface} 35%)` }}>
        <button aria-label="Add quick task" title="Add quick task" onClick={() => onOpenTaskComposer()} style={{ width: '100%', border: 'none', borderRadius: 10, cursor: 'pointer', background: T.accent, color: '#fff', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...sora, fontWeight: 700, fontSize: 12 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Quick Add Task
        </button>
      </div>
    </div>
  )
}
