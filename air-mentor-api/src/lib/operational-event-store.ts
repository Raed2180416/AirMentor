import { desc } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import { operationalTelemetryEvents } from '../db/schema.js'
import { createId } from './ids.js'
import { parseJson, stringifyJson } from './json.js'
import type { PersistableOperationalEvent } from './telemetry.js'

export async function persistOperationalTelemetryEvent(
  db: AppDb,
  event: PersistableOperationalEvent,
  createdAt = new Date().toISOString(),
) {
  await db.insert(operationalTelemetryEvents).values({
    operationalTelemetryEventId: createId('ops_evt'),
    source: event.source,
    name: event.name,
    level: event.level,
    eventTimestamp: event.timestamp,
    payloadJson: stringifyJson(event.details ?? {}),
    createdAt,
  })
}

export async function listRecentOperationalTelemetryEvents(
  db: AppDb,
  limit = 12,
) {
  const rows = await db.select().from(operationalTelemetryEvents)
    .orderBy(desc(operationalTelemetryEvents.eventTimestamp), desc(operationalTelemetryEvents.createdAt))
    .limit(limit)
  return rows.map(row => ({
    operationalTelemetryEventId: row.operationalTelemetryEventId,
    source: row.source as 'backend' | 'client',
    name: row.name,
    level: row.level as 'info' | 'warn' | 'error',
    timestamp: row.eventTimestamp,
    details: parseJson(row.payloadJson, {} as Record<string, unknown>),
    createdAt: row.createdAt,
  }))
}
