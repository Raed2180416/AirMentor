import fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { simulationRuns, studentAgentSessions } from '../src/db/schema.js'

const proofRouteMocks = vi.hoisted(() => ({
  buildHodProofAnalytics: vi.fn(),
  buildStudentAgentCard: vi.fn(),
  buildStudentRiskExplorer: vi.fn(),
  listStudentAgentTimeline: vi.fn(),
  sendStudentAgentMessage: vi.fn(),
  startStudentAgentSession: vi.fn(),
}))

vi.mock('../src/lib/msruas-proof-control-plane.js', () => ({
  buildHodProofAnalytics: proofRouteMocks.buildHodProofAnalytics,
  buildStudentAgentCard: proofRouteMocks.buildStudentAgentCard,
  buildStudentRiskExplorer: proofRouteMocks.buildStudentRiskExplorer,
  listStudentAgentTimeline: proofRouteMocks.listStudentAgentTimeline,
  sendStudentAgentMessage: proofRouteMocks.sendStudentAgentMessage,
  startStudentAgentSession: proofRouteMocks.startStudentAgentSession,
}))

import { registerAcademicProofRoutes } from '../src/modules/academic-proof-routes.js'

describe('academic proof routes', () => {
  let app: ReturnType<typeof fastify> | null = null

  beforeEach(() => {
    vi.resetAllMocks()
    proofRouteMocks.buildHodProofAnalytics.mockResolvedValue({ summary: {}, courses: [], faculty: [], students: [], reassessments: [] })
    proofRouteMocks.buildStudentAgentCard.mockResolvedValue({ student: { studentId: 'mnc_student_101' } })
    proofRouteMocks.buildStudentRiskExplorer.mockResolvedValue({ student: { studentId: 'mnc_student_101' } })
    proofRouteMocks.listStudentAgentTimeline.mockResolvedValue([{ timelineItemId: 'semester-6' }])
    proofRouteMocks.sendStudentAgentMessage.mockResolvedValue([])
    proofRouteMocks.startStudentAgentSession.mockResolvedValue({
      studentAgentSessionId: 'agent_session_001',
      simulationRunId: 'sim_parallel_active_checkpoint_scope',
      simulationStageCheckpointId: 'checkpoint_sem6_post_see',
      studentId: 'mnc_student_101',
      viewerFacultyId: 'faculty_hod',
      viewerRole: 'HOD',
      status: 'active',
      responseMode: 'deterministic',
      cardVersion: 1,
      messages: [],
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:00.000Z',
    })
  })

  afterEach(async () => {
    if (app) await app.close()
    app = null
  })

  function extractWhereColumnName(condition: unknown) {
    if (!condition || typeof condition !== 'object' || !('queryChunks' in condition)) return null
    const queryChunks = (condition as { queryChunks?: unknown[] }).queryChunks
    if (!Array.isArray(queryChunks)) return null
    const match = queryChunks.find(chunk => !!chunk && typeof chunk === 'object' && 'name' in chunk && typeof (chunk as { name?: unknown }).name === 'string')
    return match ? (match as { name: string }).name : null
  }

  it('passes checkpoint playback identity through student-shell proof scope checks', async () => {
    const checkpoint = {
      simulationStageCheckpointId: 'checkpoint_sem6_post_see',
      simulationRunId: 'sim_parallel_active_checkpoint_scope',
    }
    const resolveAcademicStageCheckpoint = vi.fn().mockResolvedValue(checkpoint)
    const resolveStudentShellRun = vi.fn().mockResolvedValue({
      simulationRunId: checkpoint.simulationRunId,
    })
    const assertStudentShellScope = vi.fn().mockResolvedValue(undefined)
    const context = {
      db: {},
      now: () => '2026-03-31T00:00:00.000Z',
    }

    app = fastify()
    app.addHook('onRequest', async request => {
      ;(request as typeof request & { auth: unknown }).auth = {
        facultyId: 'faculty_hod',
        userId: 'faculty_hod',
        activeRoleGrant: {
          roleCode: 'HOD',
          scopeType: 'department',
          scopeId: 'dept_cse',
        },
      }
    })

    await registerAcademicProofRoutes(app, context as never, {
      academicRoleCodes: ['COURSE_LEADER', 'MENTOR', 'HOD'],
      assertStudentShellScope,
      hodProofCourseQuerySchema: z.object({}).passthrough(),
      hodProofFacultyQuerySchema: z.object({}).passthrough(),
      hodProofReassessmentQuerySchema: z.object({}).passthrough(),
      hodProofStudentQuerySchema: z.object({}).passthrough(),
      hodProofSummaryQuerySchema: z.object({}).passthrough(),
      proofReassessmentAcknowledgeSchema: z.object({}).passthrough(),
      proofReassessmentParamsSchema: z.object({ reassessmentEventId: z.string().min(1) }),
      proofReassessmentResolveSchema: z.object({}).passthrough(),
      proofResolutionCreditByOutcome: vi.fn(),
      proofResolutionRecoveryState: vi.fn(),
      resolveAcademicStageCheckpoint,
      resolveProofReassessmentAccess: vi.fn(),
      resolveStudentShellRun,
      studentShellMessageSchema: z.object({ prompt: z.string().min(1) }),
      studentShellQuerySchema: z.object({
        simulationRunId: z.string().min(1).optional(),
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
      studentShellSessionCreateSchema: z.object({
        simulationRunId: z.string().min(1).optional(),
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
    } as never)

    const checkpointQuery = `simulationStageCheckpointId=${encodeURIComponent(checkpoint.simulationStageCheckpointId)}`
    const [cardResponse, riskExplorerResponse, timelineResponse, sessionResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/mnc_student_101/card?${checkpointQuery}`,
      }),
      app.inject({
        method: 'GET',
        url: `/api/academic/students/mnc_student_101/risk-explorer?${checkpointQuery}`,
      }),
      app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/mnc_student_101/timeline?${checkpointQuery}`,
      }),
      app.inject({
        method: 'POST',
        url: '/api/academic/student-shell/students/mnc_student_101/sessions',
        payload: { simulationStageCheckpointId: checkpoint.simulationStageCheckpointId },
      }),
    ])

    expect(cardResponse.statusCode).toBe(200)
    expect(riskExplorerResponse.statusCode).toBe(200)
    expect(timelineResponse.statusCode).toBe(200)
    expect(sessionResponse.statusCode).toBe(200)

    expect(resolveStudentShellRun).toHaveBeenCalledTimes(4)
    for (const call of resolveStudentShellRun.mock.calls) {
      expect(call[0]).toBe(context)
      expect(call[1]).toMatchObject({
        facultyId: 'faculty_hod',
        activeRoleGrant: expect.objectContaining({ roleCode: 'HOD' }),
      })
      expect(call[3]).toBe(checkpoint.simulationStageCheckpointId)
    }

    expect(resolveAcademicStageCheckpoint).toHaveBeenCalledTimes(4)
    for (const call of resolveAcademicStageCheckpoint.mock.calls) {
      expect(call[0]).toBe(context)
      expect(call[1]).toMatchObject({
        facultyId: 'faculty_hod',
        activeRoleGrant: expect.objectContaining({ roleCode: 'HOD' }),
      })
      expect(call[2]).toBe(checkpoint.simulationRunId)
      expect(call[3]).toBe(checkpoint.simulationStageCheckpointId)
    }

    expect(assertStudentShellScope).toHaveBeenCalledTimes(4)
    for (const call of assertStudentShellScope.mock.calls) {
      expect(call[0]).toBe(context)
      expect(call[1]).toMatchObject({
        facultyId: 'faculty_hod',
        activeRoleGrant: expect.objectContaining({ roleCode: 'HOD' }),
      })
      expect(call[2]).toBe(checkpoint.simulationRunId)
      expect(call[3]).toBe('mnc_student_101')
    }
  })

  it('resolves checkpoint session messages against the session run instead of the first active proof row', async () => {
    const runLookups: string[] = []
    const context = {
      db: {
        select: () => ({
          from: (table: unknown) => ({
            where: async (condition: unknown) => {
              if (table === studentAgentSessions) {
                return [{
                  studentAgentSessionId: 'agent_session_001',
                  simulationRunId: 'sim_parallel_active_checkpoint_scope',
                  viewerFacultyId: 'faculty_hod',
                  viewerRole: 'HOD',
                }]
              }
              if (table === simulationRuns) {
                const columnName = extractWhereColumnName(condition) ?? 'unknown'
                runLookups.push(columnName)
                if (columnName === 'simulation_run_id') {
                  return [{
                    simulationRunId: 'sim_parallel_active_checkpoint_scope',
                    activeFlag: 1,
                  }]
                }
                if (columnName === 'active_flag') {
                  return [{
                    simulationRunId: 'sim_distractor_active_run',
                    activeFlag: 1,
                  }]
                }
              }
              return []
            },
          }),
        }),
      },
      now: () => '2026-03-31T00:00:00.000Z',
    }

    app = fastify()
    app.addHook('onRequest', async request => {
      ;(request as typeof request & { auth: unknown }).auth = {
        facultyId: 'faculty_hod',
        userId: 'faculty_hod',
        activeRoleGrant: {
          roleCode: 'HOD',
          scopeType: 'department',
          scopeId: 'dept_cse',
        },
      }
    })

    await registerAcademicProofRoutes(app, context as never, {
      academicRoleCodes: ['COURSE_LEADER', 'MENTOR', 'HOD'],
      assertStudentShellScope: vi.fn().mockResolvedValue(undefined),
      hodProofCourseQuerySchema: z.object({}).passthrough(),
      hodProofFacultyQuerySchema: z.object({}).passthrough(),
      hodProofReassessmentQuerySchema: z.object({}).passthrough(),
      hodProofStudentQuerySchema: z.object({}).passthrough(),
      hodProofSummaryQuerySchema: z.object({}).passthrough(),
      proofReassessmentAcknowledgeSchema: z.object({}).passthrough(),
      proofReassessmentParamsSchema: z.object({ reassessmentEventId: z.string().min(1) }),
      proofReassessmentResolveSchema: z.object({}).passthrough(),
      proofResolutionCreditByOutcome: vi.fn(),
      proofResolutionRecoveryState: vi.fn(),
      resolveAcademicStageCheckpoint: vi.fn(),
      resolveProofReassessmentAccess: vi.fn(),
      resolveStudentShellRun: vi.fn(),
      studentShellMessageSchema: z.object({ prompt: z.string().min(1) }),
      studentShellQuerySchema: z.object({
        simulationRunId: z.string().min(1).optional(),
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
      studentShellSessionCreateSchema: z.object({
        simulationRunId: z.string().min(1).optional(),
        simulationStageCheckpointId: z.string().min(1).optional(),
      }),
    } as never)

    const response = await app.inject({
      method: 'POST',
      url: '/api/academic/student-shell/sessions/agent_session_001/messages',
      payload: { prompt: 'Explain the comparator' },
    })

    expect(response.statusCode).toBe(200)
    expect(runLookups).toEqual(['simulation_run_id'])
    expect(proofRouteMocks.sendStudentAgentMessage).toHaveBeenCalledWith(context.db, {
      studentAgentSessionId: 'agent_session_001',
      prompt: 'Explain the comparator',
    })
  })
})
