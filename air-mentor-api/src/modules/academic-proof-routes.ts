import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  alertAcknowledgements,
  alertOutcomes,
  reassessmentEvents,
  reassessmentResolutions,
  simulationRuns,
  studentAgentSessions,
} from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { AppError, badRequest, notFound } from '../lib/http-errors.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import {
  buildHodProofAnalytics,
  buildStudentAgentCard,
  buildStudentRiskExplorer,
  advanceProofSimulationDay,
  advanceProofSimulationPreviousDay,
  advanceProofSimulationStage,
  listStudentAgentTimeline,
  recomputeObservedOnlyRisk,
  sendStudentAgentMessage,
  startStudentAgentSession,
  stopProofSimulationRun,
} from '../lib/msruas-proof-control-plane.js'
import { buildCounterfactualReport } from '../lib/proof-counterfactual-reader.js'
import { fetchCounterfactualSnapshotRows } from '../lib/proof-counterfactual-fetcher.js'
import { buildSimulatorCounterfactualReport } from '../lib/proof-counterfactual-simulator-aggregator.js'
import { fetchSimulatorProjectionRows } from '../lib/proof-counterfactual-simulator-fetcher.js'
import {
  assertAcademicAccess,
  evaluateActiveProofRunAccess,
  evaluateFacultyContextAccess,
  evaluateStudentShellSessionMessageAccess,
} from './academic-access.js'
import type { AcademicRouteDependencies } from './academic.js'
import {
  emitAuditEvent,
  parseOrThrow,
  requireRole,
} from './support.js'

async function resolveScopedAcademicProofRun(
  context: RouteContext,
  auth: ReturnType<typeof requireRole>,
  simulationRunId: string,
) {
  const [run] = await context.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, simulationRunId))
  if (!run) throw notFound('Simulation run not found')
  if ((run.demoWorkspaceId ?? null) !== (auth.demoWorkspaceId ?? null)) {
    throw new AppError(403, 'PROOF_RUN_SCOPE_MISMATCH', 'Proof run is not available in this workspace scope.')
  }
  return run
}

export async function registerAcademicProofRoutes(
  app: FastifyInstance,
  context: RouteContext,
  deps: AcademicRouteDependencies,
) {
  const {
    academicRoleCodes,
    assertStudentShellScope,
    hodProofCourseQuerySchema,
    hodProofFacultyQuerySchema,
    hodProofReassessmentQuerySchema,
    hodProofStudentQuerySchema,
    hodProofSummaryQuerySchema,
    proofReassessmentAcknowledgeSchema,
    proofReassessmentParamsSchema,
    proofReassessmentResolveSchema,
    proofResolutionCreditByOutcome,
    proofResolutionRecoveryState,
    resolveBatchPolicy,
    resolveAcademicStageCheckpoint,
    resolveProofReassessmentAccess,
    resolveStudentShellRun,
    studentShellMessageSchema,
    studentShellQuerySchema,
    studentShellSessionCreateSchema,
  } = deps

  const proofAdvanceSchema = z.object({
    mode: z.enum(['day', 'previous-day', 'stage']),
  })

  app.get('/api/academic/hod/proof-summary', {
    schema: {
      tags: ['academic'],
      summary: 'Return the live HoD proof summary sourced from the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const facultyId = auth.facultyId as string
    const query = parseOrThrow(hodProofSummaryQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId,
      roleScopeType: auth.activeRoleGrant.scopeType,
      roleScopeId: auth.activeRoleGrant.scopeId,
      now: context.now(),
      filters: query,
    })
    return result.summary
  })

  app.get('/api/academic/hod/proof-bundle', {
    schema: {
      tags: ['academic'],
      summary: 'Return the full live HoD proof analytics bundle sourced from the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const facultyId = auth.facultyId as string
    const query = parseOrThrow(hodProofReassessmentQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId,
      roleScopeType: auth.activeRoleGrant.scopeType,
      roleScopeId: auth.activeRoleGrant.scopeId,
      now: context.now(),
      filters: query,
    })
    return {
      summary: result.summary,
      courses: result.courses,
      faculty: result.faculty,
      students: result.students,
      reassessments: result.reassessments,
    }
  })

  app.get('/api/academic/hod/proof-courses', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD course hotspot rollups for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const facultyId = auth.facultyId as string
    const query = parseOrThrow(hodProofCourseQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId,
      roleScopeType: auth.activeRoleGrant.scopeType,
      roleScopeId: auth.activeRoleGrant.scopeId,
      now: context.now(),
      filters: query,
    })
    return { items: result.courses }
  })

  app.get('/api/academic/hod/proof-faculty', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD faculty operations rollups for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const facultyId = auth.facultyId as string
    const query = parseOrThrow(hodProofFacultyQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId,
      roleScopeType: auth.activeRoleGrant.scopeType,
      roleScopeId: auth.activeRoleGrant.scopeId,
      now: context.now(),
      filters: query,
    })
    return { items: result.faculty }
  })

  app.get('/api/academic/hod/proof-students', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD student watch rows for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const facultyId = auth.facultyId as string
    const query = parseOrThrow(hodProofStudentQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId,
      roleScopeType: auth.activeRoleGrant.scopeType,
      roleScopeId: auth.activeRoleGrant.scopeId,
      now: context.now(),
      filters: query,
    })
    return { items: result.students }
  })

  app.get('/api/academic/hod/proof-reassessments', {
    schema: {
      tags: ['academic'],
      summary: 'Return live HoD reassessment audit rows for the active proof run',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const facultyId = auth.facultyId as string
    const query = parseOrThrow(hodProofReassessmentQuerySchema, request.query)
    const result = await buildHodProofAnalytics(context.db, {
      facultyId,
      roleScopeType: auth.activeRoleGrant.scopeType,
      roleScopeId: auth.activeRoleGrant.scopeId,
      now: context.now(),
      filters: query,
    })
    return { items: result.reassessments }
  })

  app.get('/api/academic/hod/proof-counterfactual', {
    schema: {
      tags: ['academic'],
      summary: 'DIAGNOSTIC ONLY — flag-diff baseline-vs-realized across two proof runs. For final demo analytics use /proof-counterfactual-simulator.',
    },
  }, async request => {
    // Temporary diagnostic per prompt §G.6. Final Sem-6 demo analytics MUST
    // use the simulator-based no-intervention branch exposed by the sibling
    // route /proof-counterfactual-simulator below.
    const auth = requireRole(request, ['SYSTEM_ADMIN', 'HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const querySchema = z.object({
      runIdBaseline: z.string().min(1),
      runIdRealized: z.string().min(1),
    })
    const query = parseOrThrow(querySchema, request.query)
    if (query.runIdBaseline === query.runIdRealized) {
      throw badRequest('runIdBaseline and runIdRealized must be two distinct simulation runs')
    }
    await Promise.all([
      resolveScopedAcademicProofRun(context, auth, query.runIdBaseline),
      resolveScopedAcademicProofRun(context, auth, query.runIdRealized),
    ])
    const [baselineRows, realizedRows] = await Promise.all([
      fetchCounterfactualSnapshotRows(context.db, { simulationRunId: query.runIdBaseline }),
      fetchCounterfactualSnapshotRows(context.db, { simulationRunId: query.runIdRealized }),
    ])
    const report = buildCounterfactualReport({
      runIdBaseline: query.runIdBaseline,
      runIdRealized: query.runIdRealized,
      baselineRows,
      realizedRows,
    })
    return report
  })

  app.get('/api/academic/hod/proof-counterfactual-simulator', {
    schema: {
      tags: ['academic'],
      summary: 'Phase-11 simulator-based counterfactual — projected with-vs-without intervention report for ONE run. Authoritative Sem-6 analytics path.',
    },
  }, async request => {
    // Phase-11 final analytics path. Reads stored simulation_stage_student_projections
    // (noActionRiskProbScaled + realized marks) for the given run and produces
    // per-(student, stage) counterfactuals plus projected Sem-6 rollups.
    //
    // Access: HOD or SYSTEM_ADMIN. Prompt §B.8 HOD owns oversight analytics.
    const auth = requireRole(request, ['SYSTEM_ADMIN', 'HOD'])
    assertAcademicAccess(evaluateFacultyContextAccess(auth))
    const querySchema = z.object({
      runId: z.string().min(1),
    })
    const query = parseOrThrow(querySchema, request.query)
    await resolveScopedAcademicProofRun(context, auth, query.runId)
    const rows = await fetchSimulatorProjectionRows(context.db, { simulationRunId: query.runId })
    const report = buildSimulatorCounterfactualReport({
      runId: query.runId,
      generatedAt: context.now(),
      rows,
    })
    return report
  })

  app.post('/api/academic/proof-runs/:simulationRunId/advance', {
    schema: {
      tags: ['academic'],
      summary: 'Advance the active proof run from the academic workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    assertAcademicAccess(evaluateFacultyContextAccess(auth, { allowSystemAdmin: true }))
    const params = parseOrThrow(z.object({ simulationRunId: z.string().min(1) }), request.params)
    const body = parseOrThrow(proofAdvanceSchema, request.body ?? {})
    const run = await resolveScopedAcademicProofRun(context, auth, params.simulationRunId)
    assertAcademicAccess(evaluateActiveProofRunAccess(auth, run.activeFlag === 1, 'Academic proof controls may advance only the active proof run'))

    const input = {
      simulationRunId: params.simulationRunId,
      actorFacultyId: auth.facultyId ?? null,
      now: context.now(),
    }
    if (body.mode === 'day') return advanceProofSimulationDay(context.db, input)
    if (body.mode === 'previous-day') return advanceProofSimulationPreviousDay(context.db, input)
    return advanceProofSimulationStage(context.db, input)
  })

  app.post('/api/academic/proof-runs/:simulationRunId/stop', {
    schema: {
      tags: ['academic'],
      summary: 'Stop the active proof run from the academic workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    assertAcademicAccess(evaluateFacultyContextAccess(auth, { allowSystemAdmin: true }))
    const params = parseOrThrow(z.object({ simulationRunId: z.string().min(1) }), request.params)
    const run = await resolveScopedAcademicProofRun(context, auth, params.simulationRunId)
    assertAcademicAccess(evaluateActiveProofRunAccess(auth, run.activeFlag === 1, 'Academic proof controls may stop only the active proof run'))
    return stopProofSimulationRun(context.db, {
      simulationRunId: params.simulationRunId,
      actorFacultyId: auth.facultyId ?? null,
      now: context.now(),
    })
  })

  app.post('/api/academic/proof-runs/:simulationRunId/recompute-risk', {
    schema: {
      tags: ['academic'],
      summary: 'Recompute observable-only risk for the active proof run from the academic workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    assertAcademicAccess(evaluateFacultyContextAccess(auth, { allowSystemAdmin: true }))
    const params = parseOrThrow(z.object({ simulationRunId: z.string().min(1) }), request.params)
    const run = await resolveScopedAcademicProofRun(context, auth, params.simulationRunId)
    assertAcademicAccess(evaluateActiveProofRunAccess(auth, run.activeFlag === 1, 'Academic proof controls may recompute only the active proof run'))
    const resolved = await resolveBatchPolicy(context, run.batchId)
    await recomputeObservedOnlyRisk(context.db, {
      simulationRunId: params.simulationRunId,
      policy: resolved.effectivePolicy,
      actorFacultyId: auth.facultyId ?? null,
      now: context.now(),
      rebuildModelArtifacts: false,
    })
    return { ok: true }
  })

  app.post('/api/academic/proof-reassessments/:reassessmentEventId/acknowledge', {
    schema: {
      tags: ['academic'],
      summary: 'Acknowledge one proof reassessment without resolving it',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(proofReassessmentParamsSchema, request.params)
    const body = parseOrThrow(proofReassessmentAcknowledgeSchema, request.body ?? {})
    const { event, run, alert } = await resolveProofReassessmentAccess({
      context,
      auth,
      reassessmentEventId: params.reassessmentEventId,
    })
    if (!alert) throw badRequest('Proof reassessment has no matching alert decision to acknowledge')

    const now = context.now()
    const acknowledgementId = createId('alert_ack')
    await context.db.insert(alertAcknowledgements).values({
      alertAcknowledgementId: acknowledgementId,
      alertDecisionId: alert.alertDecisionId,
      batchId: run.batchId,
      acknowledgedByFacultyId: auth.facultyId ?? null,
      status: 'Acknowledged',
      note: body.note ?? null,
      createdAt: now,
      updatedAt: now,
    })
    await context.db.update(alertOutcomes).set({
      outcomeStatus: 'Acknowledged',
      acknowledgedByFacultyId: auth.facultyId ?? null,
      acknowledgedAt: now,
      outcomeNote: body.note ?? null,
      updatedAt: now,
    }).where(eq(alertOutcomes.alertDecisionId, alert.alertDecisionId))

    const response = {
      reassessmentEventId: event.reassessmentEventId,
      acknowledgement: {
        acknowledgementId,
        alertDecisionId: alert.alertDecisionId,
        acknowledgedByFacultyId: auth.facultyId ?? null,
        status: 'Acknowledged',
        note: body.note ?? null,
        createdAt: now,
      },
    }
    await emitAuditEvent(context, {
      entityType: 'proof_reassessment',
      entityId: event.reassessmentEventId,
      action: 'ACKNOWLEDGE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      metadata: response,
    })
    return response
  })

  app.post('/api/academic/proof-reassessments/:reassessmentEventId/resolve', {
    schema: {
      tags: ['academic'],
      summary: 'Resolve one proof reassessment with a bounded outcome classification',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(proofReassessmentParamsSchema, request.params)
    const body = parseOrThrow(proofReassessmentResolveSchema, request.body ?? {})
    const { event, run, alert } = await resolveProofReassessmentAccess({
      context,
      auth,
      reassessmentEventId: params.reassessmentEventId,
    })

    const outcome = body.outcome
    const now = context.now()
    const resolutionJson = {
      outcome,
      temporaryResponseCredit: proofResolutionCreditByOutcome[outcome],
      recoveryState: proofResolutionRecoveryState(outcome),
      queueCaseId: String(parseJson(event.payloadJson, {} as Record<string, unknown>).queueCaseId ?? ''),
      actorRole: auth.activeRoleGrant.roleCode,
      resolvedAt: now,
      version: 1,
    }
    const resolutionId = createId('reassessment_resolution')
    await context.db.insert(reassessmentResolutions).values({
      reassessmentResolutionId: resolutionId,
      reassessmentEventId: event.reassessmentEventId,
      batchId: run.batchId,
      resolvedByFacultyId: auth.facultyId ?? null,
      resolutionStatus: 'Resolved',
      note: body.note ?? null,
      resolutionJson: stringifyJson(resolutionJson),
      createdAt: now,
      updatedAt: now,
    })
    await context.db.update(reassessmentEvents).set({
      status: 'Resolved',
      payloadJson: stringifyJson({
        ...parseJson(event.payloadJson, {} as Record<string, unknown>),
        recoveryState: resolutionJson.recoveryState,
        lastResolutionOutcome: outcome,
        temporaryResponseCredit: resolutionJson.temporaryResponseCredit,
        resolvedAt: now,
      }),
      updatedAt: now,
    }).where(eq(reassessmentEvents.reassessmentEventId, event.reassessmentEventId))
    if (alert) {
      await context.db.update(alertOutcomes).set({
        outcomeStatus: 'Resolved',
        outcomeNote: body.note ?? null,
        updatedAt: now,
      }).where(eq(alertOutcomes.alertDecisionId, alert.alertDecisionId))
    }

    const response = {
      reassessmentEventId: event.reassessmentEventId,
      resolution: {
        reassessmentResolutionId: resolutionId,
        resolutionStatus: 'Resolved',
        note: body.note ?? null,
        resolutionJson,
        createdAt: now,
      },
    }
    await emitAuditEvent(context, {
      entityType: 'proof_reassessment',
      entityId: event.reassessmentEventId,
      action: 'RESOLVE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      metadata: response,
    })
    return response
  })

  app.get('/api/academic/student-shell/students/:studentId/card', {
    schema: {
      tags: ['academic'],
      summary: 'Return the deterministic student-agent card for one proof-scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const query = parseOrThrow(studentShellQuerySchema, request.query)
    const run = await resolveStudentShellRun(context, auth, query.simulationRunId, query.simulationStageCheckpointId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, query.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId, query.simulationStageCheckpointId)
    return buildStudentAgentCard(context.db, {
      simulationRunId: run.simulationRunId,
      studentId: params.studentId,
      simulationStageCheckpointId: query.simulationStageCheckpointId,
    })
  })

  app.get('/api/academic/students/:studentId/risk-explorer', {
    schema: {
      tags: ['academic'],
      summary: 'Return the proof-backed student risk explorer payload for one scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const query = parseOrThrow(studentShellQuerySchema, request.query)
    const run = await resolveStudentShellRun(context, auth, query.simulationRunId, query.simulationStageCheckpointId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, query.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId, query.simulationStageCheckpointId)
    return buildStudentRiskExplorer(context.db, {
      simulationRunId: run.simulationRunId,
      studentId: params.studentId,
      simulationStageCheckpointId: query.simulationStageCheckpointId,
    })
  })

  app.get('/api/academic/student-shell/students/:studentId/timeline', {
    schema: {
      tags: ['academic'],
      summary: 'Return the deterministic student-agent timeline for one proof-scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const query = parseOrThrow(studentShellQuerySchema, request.query)
    const run = await resolveStudentShellRun(context, auth, query.simulationRunId, query.simulationStageCheckpointId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, query.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId, query.simulationStageCheckpointId)
    return {
      items: await listStudentAgentTimeline(context.db, {
        simulationRunId: run.simulationRunId,
        studentId: params.studentId,
        simulationStageCheckpointId: query.simulationStageCheckpointId,
      }),
    }
  })

  app.post('/api/academic/student-shell/students/:studentId/sessions', {
    schema: {
      tags: ['academic'],
      summary: 'Start a deterministic student-agent session for one proof-scoped student',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(studentShellSessionCreateSchema, request.body ?? {})
    const run = await resolveStudentShellRun(context, auth, body.simulationRunId, body.simulationStageCheckpointId)
    await resolveAcademicStageCheckpoint(context, auth, run.simulationRunId, body.simulationStageCheckpointId)
    await assertStudentShellScope(context, auth, run.simulationRunId, params.studentId, body.simulationStageCheckpointId)
    return startStudentAgentSession(context.db, {
      simulationRunId: run.simulationRunId,
      simulationStageCheckpointId: body.simulationStageCheckpointId,
      studentId: params.studentId,
      viewerFacultyId: auth.facultyId,
      viewerRole: auth.activeRoleGrant.roleCode,
    })
  })

  app.post('/api/academic/student-shell/sessions/:sessionId/messages', {
    schema: {
      tags: ['academic'],
      summary: 'Send a bounded deterministic message to the student-agent shell',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
    const params = parseOrThrow(z.object({ sessionId: z.string().min(1) }), request.params)
    const body = parseOrThrow(studentShellMessageSchema, request.body)
    const [session] = await context.db.select().from(studentAgentSessions).where(eq(studentAgentSessions.studentAgentSessionId, params.sessionId))
    if (!session) throw notFound('Student shell session not found')
    const [sessionRun] = auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN'
      ? await context.db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, session.simulationRunId))
      : [null]
    assertAcademicAccess(evaluateStudentShellSessionMessageAccess({
      auth,
      sessionViewerFacultyId: session.viewerFacultyId,
      sessionViewerRole: session.viewerRole,
      activeRunMatches: !sessionRun || sessionRun.activeFlag === 1,
    }))
    return {
      items: await sendStudentAgentMessage(context.db, {
        studentAgentSessionId: params.sessionId,
        prompt: body.prompt,
      }),
    }
  })
}
