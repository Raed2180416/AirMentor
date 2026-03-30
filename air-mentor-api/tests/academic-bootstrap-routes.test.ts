import fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { simulationStageCheckpoints } from '../src/db/schema.js'
import { registerAcademicBootstrapRoutes } from '../src/modules/academic-bootstrap-routes.js'

describe('academic bootstrap routes', () => {
  let app: ReturnType<typeof fastify> | null = null

  afterEach(async () => {
    if (app) await app.close()
    app = null
  })

  it('validates a requested playback checkpoint against the checkpoint run instead of the first active run row', async () => {
    const checkpoint = {
      simulationStageCheckpointId: 'checkpoint_sem6_post_see',
      simulationRunId: 'sim_mnc_2023_first6_v1',
    }
    const resolveAcademicStageCheckpoint = vi.fn().mockResolvedValue(checkpoint)
    const buildAcademicBootstrap = vi.fn().mockResolvedValue({
      offerings: [],
      faculty: [],
      mentees: [],
      proofPlayback: {
        simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
      },
    })
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: async () => (table === simulationStageCheckpoints ? [checkpoint] : []),
        }),
      }),
    }
    const context = {
      db,
      now: () => '2026-03-31T00:00:00.000Z',
    }

    app = fastify()
    app.addHook('onRequest', async request => {
      ;(request as typeof request & { auth: unknown }).auth = {
        facultyId: 'mnc_t1',
        activeRoleGrant: {
          roleCode: 'COURSE_LEADER',
        },
      }
    })

    await registerAcademicBootstrapRoutes(app, context as never, {
      academicBootstrapQuerySchema: z.object({
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
      academicRoleCodes: ['COURSE_LEADER', 'MENTOR', 'HOD'],
      buildAcademicBootstrap,
      buildPublicFacultyList: vi.fn().mockResolvedValue([]),
      resolveAcademicStageCheckpoint,
    } as never)

    const response = await app.inject({
      method: 'GET',
      url: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(checkpoint.simulationStageCheckpointId)}`,
    })

    expect(response.statusCode).toBe(200)
    expect(resolveAcademicStageCheckpoint).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        facultyId: 'mnc_t1',
        activeRoleGrant: expect.objectContaining({ roleCode: 'COURSE_LEADER' }),
      }),
      checkpoint.simulationRunId,
      checkpoint.simulationStageCheckpointId,
    )
    expect(buildAcademicBootstrap).toHaveBeenCalledWith(context, {
      facultyId: 'mnc_t1',
      roleCode: 'COURSE_LEADER',
      simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
    })
  })
})
