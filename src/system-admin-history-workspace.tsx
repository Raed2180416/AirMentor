import { useState } from 'react'
import type { ApiAuditEvent } from './api/types'
import { T, mono, sora } from './data'
import type { LiveAdminRoute } from './system-admin-live-data'
import { EmptyState, InfoBanner, SectionHeading, formatDateTime } from './system-admin-ui'
import { Btn, Card, Chip } from './ui-primitives'

type RestorableHistoryItem = {
  key: string
  label: string
  meta: string
  updatedAt: string
  onRestore: () => Promise<void>
}

type SystemAdminHistoryWorkspaceProps = {
  archivedItems: RestorableHistoryItem[]
  deletedItems: RestorableHistoryItem[]
  recentAuditEvents: ApiAuditEvent[]
  recentAuditLoading: boolean
  toneColor: string
  summarizeAuditEvent: (event: ApiAuditEvent) => string
  getAuditEventRoute: (event: ApiAuditEvent) => LiveAdminRoute | null
  onOpenRoute: (route: LiveAdminRoute) => void
  onRestoreItem: (item: RestorableHistoryItem) => void
}

export function SystemAdminHistoryWorkspace({
  archivedItems,
  deletedItems,
  recentAuditEvents,
  recentAuditLoading,
  toneColor,
  summarizeAuditEvent,
  getAuditEventRoute,
  onOpenRoute,
  onRestoreItem,
}: SystemAdminHistoryWorkspaceProps) {
  const [renderedAtMs] = useState(() => Date.now())

  return (
    <div data-history-workspace="true" style={{ display: 'grid', gap: 16 }}>
      <SectionHeading
        title="History And Restore"
        eyebrow="Audit + Recycle Bin"
        caption="Use one page for archived faculties, restore-ready deletions, and the exact records that changed."
        toneColor={toneColor}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(420px, 1.1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Archive</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Archived faculties stay out of daily sysadmin views until you restore them here.</div>
              </div>
              <Chip color={T.warning}>{archivedItems.length}</Chip>
            </div>
            {archivedItems.length === 0 ? (
              <EmptyState title="Nothing archived right now" body="Archived academic faculties will appear here for quick restore." />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {archivedItems.map(item => (
                  <Card key={item.key} style={{ padding: 12, background: T.surface2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.label}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.meta} · archived {formatDateTime(item.updatedAt)}</div>
                      </div>
                      <Btn type="button" size="sm" onClick={() => onRestoreItem(item)}>Restore</Btn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Recycle Bin</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Deletes stay soft for 60 days. Restore is blocked only when a required parent still remains deleted.</div>
              </div>
              <Chip color={T.danger}>{deletedItems.length}</Chip>
            </div>
            {deletedItems.length === 0 ? (
              <EmptyState title="Nothing deleted right now" body="Soft-deleted records will appear here with their restore window." />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {deletedItems.map(item => {
                  const deletedDays = Math.floor((renderedAtMs - new Date(item.updatedAt).getTime()) / 86_400_000)
                  const restoreDaysLeft = Math.max(0, 60 - deletedDays)
                  return (
                    <Card key={item.key} style={{ padding: 12, background: T.surface2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.label}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                            {item.meta} · deleted {formatDateTime(item.updatedAt)} · {restoreDaysLeft} day{restoreDaysLeft === 1 ? '' : 's'} left
                          </div>
                        </div>
                        <Btn type="button" size="sm" onClick={() => onRestoreItem(item)}>Restore</Btn>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Recent Audit</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Recent admin changes across hierarchy, people, requests, and timetable planning.</div>
            </div>
            <Chip color={T.accent}>{recentAuditEvents.length}</Chip>
          </div>
          {recentAuditLoading ? <InfoBanner message="Loading recent audit activity…" /> : null}
          {!recentAuditLoading && recentAuditEvents.length === 0 ? (
            <EmptyState title="No recent audit activity" body="New creates, updates, restores, and planner saves will surface here." />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {recentAuditEvents.map(event => {
                const nextRoute = getAuditEventRoute(event)
                return (
                  <Card key={event.auditEventId} style={{ padding: 12, background: T.surface2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{event.entityType} · {summarizeAuditEvent(event)}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{event.entityId}{event.actorRole ? ` · ${event.actorRole}` : ''} · {formatDateTime(event.createdAt)}</div>
                      </div>
                      {nextRoute ? <Btn type="button" size="sm" variant="ghost" onClick={() => onOpenRoute(nextRoute)}>Open</Btn> : null}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
