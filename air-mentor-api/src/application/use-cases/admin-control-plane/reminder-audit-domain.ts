/**
 * Reminder + audit domain shapes.
 *
 * `Reminder` is the mapped shape the repository returns (from `mapReminder`).
 * `AuditEventRow` mirrors every audit_events column the injected `mapAuditEvent`
 * reads, so the recent-audit repository can hand raw rows to the controller's
 * mapper without the application layer importing db/schema.
 */
export type Reminder = {
  reminderId: string
  facultyId: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
  version: number
  createdAt: string
  updatedAt: string
}

export type AuditEventRow = {
  auditEventId: string
  entityType: string
  entityId: string
  action: string
  actorRole: string
  actorId: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  createdAt: string
}
