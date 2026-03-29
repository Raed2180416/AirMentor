import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { badRequest } from '../lib/http-errors.js'
import { emitOperationalEvent, forwardTelemetryPayload, persistOperationalEvent } from '../lib/telemetry.js'

const clientTelemetrySchema = z.object({
  type: z.literal('airmentor-client-event'),
  name: z.string().min(1),
  level: z.enum(['info', 'warn', 'error']),
  timestamp: z.string().min(1),
}).passthrough()

export async function registerClientTelemetryRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.post('/api/client-telemetry', {
    schema: {
      hide: true,
    },
  }, async (request, reply) => {
    const parsed = clientTelemetrySchema.safeParse(request.body)
    if (!parsed.success) {
      emitOperationalEvent('client.telemetry.invalid', {
        issues: parsed.error.issues.slice(0, 5).map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }, { level: 'warn' })
      throw badRequest('Invalid client telemetry payload')
    }

    const clientEvent = parsed.data
    await persistOperationalEvent({
      source: 'client',
      name: clientEvent.name,
      level: clientEvent.level,
      timestamp: clientEvent.timestamp,
      details: clientEvent.details ?? {},
    })
    emitOperationalEvent('client.telemetry.received', {
      name: clientEvent.name,
      level: clientEvent.level,
      timestamp: clientEvent.timestamp,
      relayed: Boolean(context.config.telemetrySinkUrl),
    }, {
      level: 'info',
      sinkUrl: null,
    })

    const relayed = await forwardTelemetryPayload(clientEvent, context.config.telemetrySinkUrl, {
      bearerToken: context.config.telemetrySinkBearerToken ?? undefined,
    })
    return reply.status(202).send({
      accepted: true,
      relayed: Boolean(relayed),
    })
  })
}
