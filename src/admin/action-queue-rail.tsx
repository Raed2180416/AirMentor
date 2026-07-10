import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Plus } from 'lucide-react'

import type { ApiAdminReminder, ApiAdminRequestSummary } from '../api/types'
import { T, mono, sora } from '../data'
import type { LiveAdminRoute } from '../system-admin-live-data'
import { InfoBanner, QueueBulkActions, formatDateTime } from '../system-admin-ui'
import { Chip, getPrimaryActionButtonStyle } from '../ui-primitives'
import { fadeColor } from './live-app-model'
import { ActionQueueCard } from './live-app-chrome'

export type ActionQueueHiddenItem = {
  key: string
  label: string
  meta: string
  updatedAt: string
  onRestore: () => Promise<void>
}

type ActionQueueRailProps = {
  isRendered: boolean
  isVisible: boolean
  actionCount: number
  remindersSupported: boolean
  visibleQueueDismissKeys: string[]
  dismissedQueueItemKeys: string[]
  openRequests: ApiAdminRequestSummary[]
  pendingReminders: ApiAdminReminder[]
  visibleHiddenItems: ActionQueueHiddenItem[]
  onHideAll: () => void
  onRestoreAll: () => void
  onDismissItem: (key: string) => void
  onNavigate: (route: LiveAdminRoute) => void
  onToggleReminderStatus: (reminder: ApiAdminReminder) => void | Promise<void>
  onRestoreHiddenItem: (item: ActionQueueHiddenItem) => void
  onCreateReminder: () => void | Promise<void>
}

export function ActionQueueRail({
  isRendered,
  isVisible,
  actionCount,
  remindersSupported,
  visibleQueueDismissKeys,
  dismissedQueueItemKeys,
  openRequests,
  pendingReminders,
  visibleHiddenItems,
  onHideAll,
  onRestoreAll,
  onDismissItem,
  onNavigate,
  onToggleReminderStatus,
  onRestoreHiddenItem,
  onCreateReminder,
}: ActionQueueRailProps) {
  return (
    <AnimatePresence initial={false}>
      {isRendered ? (
        <motion.div
          key="system-admin-inline-action-queue"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 18 }}
          exit={{ opacity: 0, x: 18 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="scroll-pane scroll-pane--dense"
          style={{ position: 'sticky', top: 92, height: 'calc(100vh - 92px)', overflowY: 'auto', padding: '18px 16px', borderLeft: `1px solid ${T.border}`, background: T.surface, transition: 'background-color 220ms ease, border-color 220ms ease, color 220ms ease' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Bell size={16} color={T.accent} />
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Action Queue</div>
            <Chip color={T.danger} size={10}>{actionCount} visible</Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>
            Requests go first. {remindersSupported ? 'Personal reminders stay private to the signed-in system admin.' : 'Private reminders are hidden until the live API supports `/api/admin/reminders`.'}
          </div>
          <QueueBulkActions
            canHideAll={visibleQueueDismissKeys.length > 0}
            hiddenCount={dismissedQueueItemKeys.length}
            onHideAll={onHideAll}
            onRestoreAll={onRestoreAll}
          />

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Requests</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {openRequests.slice(0, 8).map(request => (
              <ActionQueueCard
                key={request.adminRequestId}
                title={request.summary}
                subtitle={`${request.requestType} · ${request.requesterName ?? request.requestedByFacultyId} · due ${formatDateTime(request.dueAt)}`}
                chips={[request.status, request.priority]}
                tone={request.status === 'Implemented' ? T.success : T.warning}
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <Chip color={request.status === 'Implemented' ? T.success : T.warning} size={9}>{request.status}</Chip>
                    <button type="button" onClick={event => { event.stopPropagation(); onDismissItem(`request:${request.adminRequestId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
                  </div>
                }
                onClick={() => onNavigate({ section: 'requests', requestId: request.adminRequestId })}
              />
            ))}
            {openRequests.length === 0 ? <InfoBanner message="No open HoD or governance requests right now." /> : null}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Personal Tasks</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {remindersSupported ? pendingReminders.map(reminder => (
              <ActionQueueCard
                key={reminder.reminderId}
                title={reminder.title}
                subtitle={`${reminder.body} · due ${formatDateTime(reminder.dueAt)}`}
                chips={[reminder.status]}
                tone={T.accent}
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <button type="button" onClick={event => { event.stopPropagation(); void onToggleReminderStatus(reminder) }} style={{ ...mono, fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>
                    <button type="button" onClick={event => { event.stopPropagation(); onDismissItem(`reminder:${reminder.reminderId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
                  </div>
                }
              />
            )) : null}
            {remindersSupported
              ? (pendingReminders.length === 0 ? <InfoBanner message="No private admin reminders. Use the quick add button below." /> : null)
              : <InfoBanner message="This backend does not expose private reminders yet, so the queue is running in request-only mode." />}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Hidden Records</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {visibleHiddenItems.slice(0, 4).map(item => (
              <ActionQueueCard
                key={item.key}
                title={item.label}
                subtitle={`${item.meta} · ${item.key.startsWith('archived:') ? 'archived' : 'deleted'} ${formatDateTime(item.updatedAt)}${item.key.startsWith('archived:') ? '' : ' · restore window 60 days'}`}
                chips={[item.meta]}
                tone={item.key.startsWith('archived:') ? T.warning : T.danger}
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <button type="button" onClick={event => { event.stopPropagation(); onRestoreHiddenItem(item) }} style={{ ...mono, fontSize: 10, color: T.success, background: 'none', border: 'none', cursor: 'pointer' }}>Restore</button>
                    <button type="button" onClick={event => { event.stopPropagation(); onDismissItem(`hidden:${item.key}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
                  </div>
                }
              />
            ))}
            {visibleHiddenItems.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>Nothing hidden right now.</div> : null}
          </div>
          {actionCount === 0 && dismissedQueueItemKeys.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <InfoBanner message="Everything in this action queue is currently hidden. Use Restore all hidden to bring requests, reminders, and restore-ready records back into view." />
            </div>
          ) : null}

          <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, marginTop: 16, background: `linear-gradient(180deg, ${fadeColor(T.surface, '00')} 0%, ${T.surface} 35%)` }}>
            <button
              type="button"
              onClick={() => void onCreateReminder()}
              disabled={!remindersSupported}
              style={getPrimaryActionButtonStyle({ disabled: !remindersSupported, fullWidth: true })}
            >
              <Plus size={14} />
              {remindersSupported ? 'Quick Add Reminder' : 'Reminder API Unavailable'}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
