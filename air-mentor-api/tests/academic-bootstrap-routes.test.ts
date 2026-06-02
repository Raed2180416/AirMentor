import fastify, { type FastifyRequest } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { simulationRuns, simulationStageCheckpoints } from '../src/db/schema.js'
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
          where: async () => (
            table === simulationStageCheckpoints
              ? [checkpoint]
              : table === simulationRuns
                ? [{
                    simulationRunId: 'sim_mnc_2023_active',
                    runLabel: 'Active Sem 1 proof run',
                    status: 'active',
                    activeFlag: 1,
                    lifecycleState: 'active',
                    activeOperationalSemester: 1,
                    createdAt: '2026-03-31T00:00:00.000Z',
                    updatedAt: '2026-03-31T00:00:00.000Z',
                  }]
                : []
          ),
        }),
      }),
    }
    const context = {
      db,
      now: () => '2026-03-31T00:00:00.000Z',
    }

    app = fastify()
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.auth = {
        sessionId: 'session_course_leader',
        userId: 'mnc_t1',
        username: 'mnc_t1',
        email: 'mnc_t1@msruas.ac.in',
        demoWorkspaceId: null,
        facultyId: 'mnc_t1',
        facultyName: 'Faculty MNC T1',
        activeRoleGrant: {
          grantId: 'grant_course_leader',
          facultyId: 'mnc_t1',
          roleCode: 'COURSE_LEADER',
          scopeType: 'branch',
          scopeId: 'branch_mnc_btech',
          status: 'active',
          version: 1,
        },
        availableRoleGrants: [],
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
      demoWorkspaceId: null,
    })
  })

  it('blocks the legacy seeded sem6 sandbox row until a proof run lifecycle is actually active', async () => {
    const buildAcademicBootstrap = vi.fn()
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: async () => (
            table === simulationRuns
              ? [{
                  simulationRunId: 'sim_mnc_2023_first6_v1',
                  runLabel: 'Legacy seeded Sem 6 sandbox',
                  status: 'active',
                  activeFlag: 1,
                  lifecycleState: null,
                  activeOperationalSemester: 6,
                  createdAt: '2026-03-31T00:00:00.000Z',
                  updatedAt: '2026-03-31T00:00:00.000Z',
                }]
              : []
          ),
        }),
      }),
    }
    const context = {
      db,
      now: () => '2026-03-31T00:00:00.000Z',
    }

    app = fastify()
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.auth = {
        sessionId: 'session_mentor',
        userId: 'mnc_t2',
        username: 'mnc_t2',
        email: 'mnc_t2@msruas.ac.in',
        demoWorkspaceId: null,
        facultyId: 'mnc_t2',
        facultyName: 'Faculty MNC T2',
        activeRoleGrant: {
          grantId: 'grant_mentor',
          facultyId: 'mnc_t2',
          roleCode: 'MENTOR',
          scopeType: 'branch',
          scopeId: 'branch_mnc_btech',
          status: 'active',
          version: 1,
        },
        availableRoleGrants: [],
      }
    })

    await registerAcademicBootstrapRoutes(app, context as never, {
      academicBootstrapQuerySchema: z.object({
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
      academicRoleCodes: ['COURSE_LEADER', 'MENTOR', 'HOD'],
      buildAcademicBootstrap,
      buildPublicFacultyList: vi.fn().mockResolvedValue([]),
      resolveAcademicStageCheckpoint: vi.fn(),
    } as never)

    const response = await app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json().code).toBe('NO_ACTIVE_PROOF_RUN')
    expect(buildAcademicBootstrap).not.toHaveBeenCalled()
  })
})
