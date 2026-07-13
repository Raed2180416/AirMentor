/**
 * Shared infrastructure types for the curriculum-graph use-cases.
 *
 * A use-case returns the exact HTTP status + body it wants; the controller is a
 * thin mapper that does `reply.status(result.status).send(result.body)`. Audit
 * emission is injected (fire-and-forget, exactly as the legacy handlers did).
 */
export type UseCaseResponse = { status: number; body: unknown }

export type AuditEmitter = (params: {
  entityType: string
  entityId: string
  action: string
  actorRole: string
  actorId?: string | null
  before?: unknown
  after?: unknown
  metadata?: unknown
}) => unknown
