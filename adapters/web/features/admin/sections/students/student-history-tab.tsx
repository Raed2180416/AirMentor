import { T, mono, sora } from '@web/simulation/fixtures'
import { Card, Chip } from '@web/shared/ui/primitives'
import {
  EmptyState,
  InfoBanner,
  SectionHeading,
  formatDateTime,
} from '../../system-admin-ui'
import { summarizeAuditEvent } from '../../live-app-model'
import type { StudentsSectionProps } from './types'

type StudentHistoryTabProps = Pick<
  StudentsSectionProps,
  | 'studentAuditLoading'
  | 'studentAuditEvents'
>

export function StudentHistoryTab({
  studentAuditLoading,
  studentAuditEvents,
}: StudentHistoryTabProps) {
  return (
              <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                <SectionHeading title="History" eyebrow="Audit Trail" caption="Every student, enrollment, and mentor change lands here so deletions and corrections stay traceable." />
                {studentAuditLoading ? <InfoBanner message="Loading audit history…" /> : null}
                {!studentAuditLoading && studentAuditEvents.length === 0 ? <EmptyState title="No audit trail yet" body="Student create/update activity will appear here." /> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {studentAuditEvents.slice(0, 16).map(item => (
                      <Card key={item.auditEventId} style={{ padding: 12, background: T.surface2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{item.entityType} · {summarizeAuditEvent(item)}</div>
                          <Chip color={T.accent} size={9}>{formatDateTime(item.createdAt)}</Chip>
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.entityId}{item.actorRole ? ` · ${item.actorRole}` : ''}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
  )
}
