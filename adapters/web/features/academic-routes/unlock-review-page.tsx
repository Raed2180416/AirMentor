import { T, mono, sora, type Offering } from '@web/simulation/fixtures'
import { type SharedTask } from '@kernel/shared/domain'
import { Btn, Card, Chip, PageBackButton, PageShell } from '@web/shared/ui/primitives'
import { formatDateTime } from './format-date-time'

type UnlockReviewPageProps = {
  task: SharedTask
  offering: Offering | null
  onBack: () => void
  onApprove: () => void
  onReject: () => void
  onResetComplete: () => void
}

export function UnlockReviewPage({ task, offering, onBack, onApprove, onReject, onResetComplete }: UnlockReviewPageProps) {
  return (
    <PageShell size="narrow">
      <PageBackButton onClick={onBack} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Unlock Review</div>
        <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 4 }}>{task.courseCode} · {offering?.title ?? task.courseName} · {task.unlockRequest?.kind.toUpperCase()}</div>
      </div>
      <Card glow={task.unlockRequest?.status === 'Rejected' ? T.danger : T.warning} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Chip color={T.accent} size={9}>Requested by: {task.unlockRequest?.requestedByRole ?? task.sourceRole}</Chip>
          <Chip color={task.unlockRequest?.status === 'Rejected' ? T.danger : task.unlockRequest?.status === 'Reset Completed' ? T.success : T.warning} size={9}>Status: {task.unlockRequest?.status ?? 'Pending'}</Chip>
          <Chip color={T.dim} size={9}>Submitted: {formatDateTime(task.unlockRequest?.requestedAt)}</Chip>
        </div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{task.actionHint}</div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Request Details</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Offering: {offering?.code ?? task.courseCode} · Sec {offering?.section ?? '—'}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Current owner: {task.assignedTo}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Reason: {task.actionHint}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Teacher note: {task.unlockRequest?.requestNote ?? task.requestNote ?? 'No request note captured'}</div>
            {task.unlockRequest?.handoffNote ? <div style={{ ...mono, fontSize: 11, color: T.muted }}>Handoff note: {task.unlockRequest.handoffNote}</div> : null}
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Latest review note: {task.unlockRequest?.reviewNote ?? 'No review note yet'}</div>
          </div>
        </Card>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Decision Flow</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 10 }}>Approve to allow a correction cycle, reject if the lock should stand, and then complete reset/unlock explicitly.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {task.unlockRequest?.status === 'Pending' ? (
              <>
                <Btn size="sm" onClick={onApprove}>Approve</Btn>
                <Btn size="sm" variant="danger" onClick={onReject}>Reject</Btn>
              </>
            ) : null}
            {task.unlockRequest?.status === 'Approved' ? <Btn size="sm" onClick={onResetComplete}>Reset & Unlock</Btn> : null}
            {task.unlockRequest?.status === 'Rejected' || task.unlockRequest?.status === 'Reset Completed' ? <Chip color={task.unlockRequest.status === 'Rejected' ? T.danger : T.success} size={9}>Decision completed</Chip> : null}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Transition History</div>
        <div style={{ display: 'grid', gap: 8 }}>
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
      </Card>
    </PageShell>
  )
}
