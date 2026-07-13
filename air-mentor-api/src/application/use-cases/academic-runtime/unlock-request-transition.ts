/**
 * POST /api/academic/unlock-requests/:taskId/transition — Phase-6 HOD
 * correction-cycle state machine. Validates the requested transition through
 * proof-hod-correction-cycle-engine.ts (pure) and persists the new unlockRequest
 * payload onto the underlying academic task.
 *
 * Moved verbatim from modules/academic-runtime-routes.ts; DB reads go through the
 * repository and the shared academic mappers arrive via the deps bundle.
 */
import { z } from 'zod'
import { badRequest, forbidden, notFound } from '../../../lib/http-errors.js'
import { createId } from '../../../lib/ids.js'
import {
  applyCorrectionCycleTransition,
  describeCorrectionCycle,
  type CorrectionCycleActorRole,
  type UnlockRequestAction,
  type UnlockRequestKind,
  type UnlockRequestStatus,
} from '../../../lib/proof-hod-correction-cycle-engine.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'
import { persistAcademicTask } from './tasks.js'

// HOD correction-cycle unlock-request transition body.
// Prompt §D.6 + §C.6 + §C.15. The engine validates the transition against
// the task's current unlockRequest.status; the route only persists the
// approved next state back into the task payload.
const unlockRequestActionSchema = z.enum([
  'request', 'approve', 'reject', 'reset-complete', 'teacher-edit-submit', 'relock',
]) satisfies z.ZodType<UnlockRequestAction>
const unlockRequestKindSchema = z.enum([
  'tt1', 'tt2', 'quiz', 'assignment', 'attendance', 'finals', 'scheme', 'blueprint',
]) satisfies z.ZodType<UnlockRequestKind>
export const unlockRequestTransitionBodySchema = z.object({
  action: unlockRequestActionSchema,
  // kind must be provided on 'request' (new unlock); for later transitions
  // we can infer from the stored payload, but allowing override keeps
  // the route symmetric and lets the client assert intent explicitly.
  kind: unlockRequestKindSchema.optional(),
  note: z.string().max(2_000).optional(),
  reviewNote: z.string().max(2_000).optional(),
  handoffNote: z.string().max(2_000).optional(),
  offeringId: z.string().min(1).optional(),
})

export type UnlockRequestTransitionBody = z.infer<typeof unlockRequestTransitionBodySchema>

export async function transitionUnlockRequest(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  taskId: string,
  body: UnlockRequestTransitionBody,
) {
  const taskRow = await deps.repo.getTaskById(taskId)
  if (!taskRow) throw notFound(`Task ${taskId} not found`)
  const transitionRows = await deps.repo.getTaskTransitionsOrderedAsc(taskId)
  const currentTask = deps.mapAcademicTaskRow(taskRow, transitionRows.map(deps.mapTaskTransitionRow))

  const existing = currentTask.unlockRequest ?? null
  const effectiveKind = (body.kind ?? (existing?.kind as UnlockRequestKind | undefined)) as UnlockRequestKind | undefined
  if (!effectiveKind) {
    throw badRequest('Unlock-request kind is required on the first request (no stored kind found).')
  }
  const currentStatus = (existing?.status as UnlockRequestStatus | undefined) ?? null
  const engineResult = applyCorrectionCycleTransition({
    currentStatus,
    kind: effectiveKind,
    action: body.action,
    actorRole: auth.activeRoleGrant.roleCode as CorrectionCycleActorRole,
    actorFacultyId: facultyId,
  })
  if (!engineResult.ok) {
    // Engine codes map cleanly onto HTTP: forbidden-role → 403, everything
    // else (illegal-transition, missing-faculty-id, reopen-without-scope,
    // invalid-request) is a client contract violation → 400.
    if (engineResult.code === 'forbidden-role') {
      throw forbidden(engineResult.reason)
    }
    throw badRequest(engineResult.reason)
  }

  const nowMillis = Date.parse(deps.now())
  // Translate role-codes → UI role strings ('Course Leader' / 'Mentor' /
  // 'HoD') to satisfy sharedTaskSchema + unlockRequestSchema which the
  // persistAcademicTask pipeline will re-validate downstream.
  const toUiRole = (code: string): 'Course Leader' | 'Mentor' | 'HoD' => {
    if (code === 'MENTOR') return 'Mentor'
    if (code === 'COURSE_LEADER') return 'Course Leader'
    return 'HoD'
  }
  const actorUiRole = toUiRole(auth.activeRoleGrant.roleCode)
  const fromOwnerUiRole = currentTask.assignedTo ?? actorUiRole
  const toOwnerUiRole: 'Course Leader' | 'Mentor' | 'HoD' = (
    engineResult.next === 'Approved' || engineResult.next === 'Reset Completed'
      ? 'HoD'
      : fromOwnerUiRole
  )

  // Build the next unlockRequest payload. 'request' opens a fresh payload;
  // every other action updates the existing one in place with role audit.
  // Shape matches `unlockRequestSchema` in academic.ts (UI role strings);
  // the engine's UnlockRequestPayload type uses role codes for policy
  // reasoning and is deliberately not used as the persistence shape.
  const nextUnlockRequest = body.action === 'request'
    ? {
        offeringId: body.offeringId ?? existing?.offeringId ?? currentTask.offeringId,
        kind: effectiveKind,
        status: engineResult.next,
        requestedByRole: actorUiRole,
        requestedByFacultyId: facultyId,
        requestedAt: nowMillis,
        requestNote: body.note,
        handoffNote: body.handoffNote,
      }
    : {
        offeringId: existing?.offeringId ?? body.offeringId ?? currentTask.offeringId,
        kind: effectiveKind,
        status: engineResult.next,
        requestedByRole: (existing?.requestedByRole as 'Course Leader' | 'Mentor' | 'HoD' | undefined) ?? actorUiRole,
        requestedByFacultyId: existing?.requestedByFacultyId ?? facultyId,
        requestedAt: existing?.requestedAt ?? nowMillis,
        reviewedAt: ['approve', 'reject'].includes(body.action) ? nowMillis : existing?.reviewedAt,
        requestNote: existing?.requestNote,
        reviewNote: body.reviewNote ?? existing?.reviewNote,
        handoffNote: body.handoffNote ?? existing?.handoffNote,
      }

  // Append a transition-history entry so both the queue audit banner and
  // the HOD workflow tab can show the exact role/action sequence.
  const transitionEntry = {
    id: createId('task_transition'),
    at: nowMillis,
    actorRole: actorUiRole,
    actorTeacherId: facultyId,
    action: `unlock-request:${body.action}`,
    fromOwner: fromOwnerUiRole,
    toOwner: toOwnerUiRole,
    note: body.reviewNote ?? body.note ?? `unlock-request transitioned to ${engineResult.next}`,
  }

  const nextTask = {
    ...currentTask,
    unlockRequest: nextUnlockRequest,
    transitionHistory: [...(currentTask.transitionHistory ?? []), transitionEntry],
    updatedAt: nowMillis,
  }

  const persisted = await persistAcademicTask(deps, auth, nextTask, {
    writeRuntimeShadow: false,
  })

  return {
    ...persisted,
    unlockRequest: nextUnlockRequest,
    engine: {
      nextStatus: engineResult.next,
      scope: engineResult.scope,
      nextActions: engineResult.nextActions,
      surfaceReopens: engineResult.surfaceReopens,
      triggersRecompute: engineResult.triggersRecompute,
    },
    cycleDescription: describeCorrectionCycle({
      status: engineResult.next,
      kind: effectiveKind,
    }),
  }
}
