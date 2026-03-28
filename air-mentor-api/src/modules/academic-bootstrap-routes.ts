import type { FastifyInstance } from 'fastify'
import type { RouteContext } from '../app.js'
import { emitOperationalEvent } from '../lib/telemetry.js'
import { parseOrThrow, requireRole } from './support.js'
import type { AcademicRouteDependencies } from './academic.js'
import { notFound } from '../lib/http-errors.js'
import { eq } from 'drizzle-orm'
import { simulationRuns } from '../db/schema.js'

export async function registerAcademicBootstrapRoutes(
  app: FastifyInstance,
  context: RouteContext,
  deps: AcademicRouteDependencies,
) {
  const {
    academicBootstrapQuerySchema,
    academicRoleCodes,
    buildAcademicBootstrap,
    buildPublicFacultyList,
    resolveAcademicStageCheckpoint,
  } = deps

  app.get('/api/academic/public/faculty', {
    schema: {
      tags: ['academic'],
      summary: 'List academic faculty accounts for the teaching portal login selector',
    },
  }, async () => buildPublicFacultyList(context))

  app.get('/api/academic/bootstrap', {
    schema: {
      tags: ['academic'],
      summary: 'Return the full academic portal parity snapshot',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const query = parseOrThrow(academicBootstrapQuerySchema, request.query)
    if (query.simulationStageCheckpointId) {
      const [activeRun] = await context.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
      if (!activeRun) throw notFound('Active proof run not found')
      await resolveAcademicStageCheckpoint(context, auth, activeRun.simulationRunId, query.simulationStageCheckpointId)
    }
    const snapshot = await buildAcademicBootstrap(context, {
      facultyId: auth.facultyId ?? null,
      roleCode: auth.activeRoleGrant.roleCode ?? null,
      simulationStageCheckpointId: query.simulationStageCheckpointId,
    })
    emitOperationalEvent('academic.bootstrap.loaded', {
      facultyId: auth.facultyId ?? null,
      roleCode: auth.activeRoleGrant.roleCode,
      simulationStageCheckpointId: query.simulationStageCheckpointId ?? null,
      offeringCount: snapshot.offerings.length,
      facultyCount: snapshot.faculty.length,
      menteeCount: snapshot.mentees.length,
      proofPlaybackCheckpointId: snapshot.proofPlayback?.simulationStageCheckpointId ?? null,
    })
    return snapshot
  })
}
