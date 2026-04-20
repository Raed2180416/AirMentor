import type { FastifyInstance } from 'fastify'
import type { RouteContext } from '../app.js'
import { emitOperationalEvent } from '../lib/telemetry.js'
import { parseOrThrow, requireRole } from './support.js'
import type { AcademicRouteDependencies } from './academic.js'
import { AppError, notFound } from '../lib/http-errors.js'
import { eq } from 'drizzle-orm'
import { simulationRuns, simulationStageCheckpoints } from '../db/schema.js'

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
    // GAP-5: Gate academic access on an active proof run.
    // Without an active run: no offerings are seeded, no students exist — teacher
    // would see a blank interface with no actionable state. Block early with a
    // clear error code so the frontend can show an explicit "waiting for sim" screen.
    const activeRuns = await context.db.select({ simulationRunId: simulationRuns.simulationRunId })
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    if (activeRuns.length === 0) {
      throw new AppError(403, 'NO_ACTIVE_PROOF_RUN', 'No simulation is currently active. Ask your administrator to start a proof run.')
    }
    const query = parseOrThrow(academicBootstrapQuerySchema, request.query)
    if (query.simulationStageCheckpointId) {
      const [checkpoint] = await context.db
        .select()
        .from(simulationStageCheckpoints)
        .where(eq(simulationStageCheckpoints.simulationStageCheckpointId, query.simulationStageCheckpointId))
      if (!checkpoint) throw notFound('Simulation stage checkpoint not found')
      await resolveAcademicStageCheckpoint(context, auth, checkpoint.simulationRunId, query.simulationStageCheckpointId)
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
