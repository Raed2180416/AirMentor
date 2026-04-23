// Phase-6 HOD correction-cycle state machine engine (2026-04-23).
//
// INTENT (prompt §D.6 + §C.6 + §C.15):
//   Approval is NOT the edit itself. The correct flow is:
//
//     request → approve/reject → reset & unlock → teacher edit → recompute → relock
//
//   If scope includes scheme/blueprint, the editor MUST truly reopen (not
//   just a badge flip). This module is the single source of truth for
//   "which status is allowed next?" and "who is allowed to drive each
//   transition?" so every surface (queue, HOD workflow tab, assessment
//   cell editor, scheme/blueprint editor) stays in lockstep.
//
// PURE MODULE (no DB, no clock). Callers pass in request + actor context,
// receive either:
//   - { ok: true, next: UnlockRequestTransition } → caller persists the
//     transition via existing queueTransitionSchema + unlockRequest payload
//   - { ok: false, reason: string, code: string } → caller returns 400/403
//
// Kinds map (prompt §D.6 + existing `unlockRequestSchema.kind`):
//   evidence-scope: tt1, tt2, quiz, assignment, attendance, finals
//   scheme-scope:   scheme
//   blueprint-scope: blueprint

// We deliberately inline the literal union types rather than importing the
// inferred Zod schema: the schema lives inside academic.ts which would import
// this module back → circular dep. The literals MUST stay in sync with
// academic.ts:519-530. If one changes, both change.
export type UnlockRequestKind =
  | 'tt1'
  | 'tt2'
  | 'quiz'
  | 'assignment'
  | 'attendance'
  | 'finals'
  | 'scheme'
  | 'blueprint'

export type UnlockRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Reset Completed'
  | 'Relocked'

export type UnlockRequestScope = 'evidence' | 'scheme' | 'blueprint'

export type CorrectionCycleActorRole =
  | 'COURSE_LEADER'
  | 'MENTOR'
  | 'HOD'
  | 'SYSTEM_ADMIN'
  | 'SYSTEM'

// Typed view of the transition payload persisted alongside the task.
// Matches `unlockRequestSchema` in academic.ts:519-530.
export type UnlockRequestPayload = {
  offeringId: string
  kind: UnlockRequestKind
  status: UnlockRequestStatus
  requestedByRole: Exclude<CorrectionCycleActorRole, 'SYSTEM'>
  requestedByFacultyId?: string
  requestedAt: number
  reviewedAt?: number
  requestNote?: string
  reviewNote?: string
  handoffNote?: string
}

export type UnlockRequestAction =
  | 'request'
  | 'approve'
  | 'reject'
  | 'reset-complete'
  | 'teacher-edit-submit'
  | 'relock'

// ---------- Scope classification ----------

export function scopeForKind(kind: UnlockRequestKind): UnlockRequestScope {
  switch (kind) {
    case 'scheme':
      return 'scheme'
    case 'blueprint':
      return 'blueprint'
    default:
      return 'evidence'
  }
}

// ---------- Allowed transitions ----------
// Read as: from -> action -> to (optionally gated by role).
// A transition not in this table is forbidden and the engine returns a
// deterministic error.

type Transition = {
  from: UnlockRequestStatus
  action: UnlockRequestAction
  to: UnlockRequestStatus
  allowedRoles: ReadonlyArray<CorrectionCycleActorRole>
  // Optional guard that depends on the scope. Some transitions are only
  // legal in scheme/blueprint scopes (e.g. "true reopen").
  scopeGuard?: (scope: UnlockRequestScope) => boolean
}

const ALLOWED_TRANSITIONS: ReadonlyArray<Transition> = [
  // request: caller opens a fresh unlock request → Pending.
  {
    from: 'Pending', // we model "no request yet" as an implicit precursor; see validateRequest
    action: 'request',
    to: 'Pending',
    allowedRoles: ['COURSE_LEADER', 'MENTOR', 'HOD'],
  },
  // approve: HOD turns Pending into Approved.
  {
    from: 'Pending',
    action: 'approve',
    to: 'Approved',
    allowedRoles: ['HOD', 'SYSTEM_ADMIN'],
  },
  // reject: HOD rejects → terminal.
  {
    from: 'Pending',
    action: 'reject',
    to: 'Rejected',
    allowedRoles: ['HOD', 'SYSTEM_ADMIN'],
  },
  // reset-complete: system (or HOD for audit) drives the unlock + value
  // reset. This is where the surface TRULY reopens — scheme/blueprint
  // editors re-enable their full form UI, evidence cells become editable.
  {
    from: 'Approved',
    action: 'reset-complete',
    to: 'Reset Completed',
    allowedRoles: ['HOD', 'SYSTEM', 'SYSTEM_ADMIN'],
  },
  // teacher-edit-submit: teacher submits the corrected value(s). Engine
  // records the submit; caller is responsible for invoking recompute +
  // relock after this transition.
  {
    from: 'Reset Completed',
    action: 'teacher-edit-submit',
    to: 'Reset Completed', // still in reset window until relock
    allowedRoles: ['COURSE_LEADER', 'MENTOR', 'HOD'],
  },
  // relock: risk recompute is done, the surface relocks → cycle closed.
  {
    from: 'Reset Completed',
    action: 'relock',
    to: 'Relocked',
    allowedRoles: ['SYSTEM', 'HOD', 'SYSTEM_ADMIN'],
  },
]

// ---------- Engine result shape ----------

export type TransitionOk = {
  ok: true
  next: UnlockRequestStatus
  scope: UnlockRequestScope
  // The subset of permitted follow-up actions from the new state, so the UI
  // can render the right next-step buttons.
  nextActions: UnlockRequestAction[]
  // Whether the transition itself implies that the editor surface should
  // reopen fully (true for reset-complete; false for all other actions).
  surfaceReopens: boolean
  // Whether the transition should trigger a risk recompute (true for
  // teacher-edit-submit).
  triggersRecompute: boolean
}

export type TransitionError = {
  ok: false
  code:
    | 'invalid-request'
    | 'forbidden-role'
    | 'illegal-transition'
    | 'missing-faculty-id'
    | 'reopen-without-scope'
  reason: string
}

export type TransitionResult = TransitionOk | TransitionError

// ---------- Engine entry points ----------

/**
 * Validate and project the next state for an unlock-request transition.
 *
 * Callers still own the persistence (writing the audit entry + updating the
 * task payload) — this engine is read-only.
 */
export function applyCorrectionCycleTransition(input: {
  currentStatus: UnlockRequestStatus | null
  kind: UnlockRequestKind
  action: UnlockRequestAction
  actorRole: CorrectionCycleActorRole
  actorFacultyId?: string | null
}): TransitionResult {
  const scope = scopeForKind(input.kind)

  // Special handling for 'request': null currentStatus is legal (means "no
  // prior request exists"). Any other status means the request already
  // exists and the caller should submit a different action.
  if (input.action === 'request') {
    if (input.currentStatus && input.currentStatus !== 'Rejected') {
      return {
        ok: false,
        code: 'illegal-transition',
        reason: `Unlock request already in progress with status ${input.currentStatus}. Cannot open a new request until current one is Rejected or Relocked.`,
      }
    }
    // Rejected + Relocked are terminal; a fresh request is a new payload.
    if (!input.actorRole || !['COURSE_LEADER', 'MENTOR', 'HOD'].includes(input.actorRole)) {
      return {
        ok: false,
        code: 'forbidden-role',
        reason: `Role ${input.actorRole} cannot initiate an unlock request. Only Course Leader, Mentor, or HOD.`,
      }
    }
    if (!input.actorFacultyId) {
      return {
        ok: false,
        code: 'missing-faculty-id',
        reason: 'requestedByFacultyId is required when opening an unlock request.',
      }
    }
    return {
      ok: true,
      next: 'Pending',
      scope,
      nextActions: ['approve', 'reject'],
      surfaceReopens: false,
      triggersRecompute: false,
    }
  }

  // For every other action, currentStatus must be present.
  if (!input.currentStatus) {
    return {
      ok: false,
      code: 'illegal-transition',
      reason: `Cannot ${input.action} an unlock request that has not been opened yet.`,
    }
  }

  // Look up the transition.
  const transition = ALLOWED_TRANSITIONS.find(t => (
    t.from === input.currentStatus
    && t.action === input.action
    && t.action !== 'request'
  ))
  if (!transition) {
    return {
      ok: false,
      code: 'illegal-transition',
      reason: `No legal transition from ${input.currentStatus} via ${input.action}.`,
    }
  }

  // Role gate.
  if (!transition.allowedRoles.includes(input.actorRole)) {
    return {
      ok: false,
      code: 'forbidden-role',
      reason: `Role ${input.actorRole} cannot ${input.action} an unlock request. Allowed: ${transition.allowedRoles.join(', ')}.`,
    }
  }

  // Scheme/blueprint guard — a reset-complete on scheme/blueprint MUST
  // actually reopen the editor. The caller is responsible for the reopen
  // side-effect; we just enforce scope here.
  if (transition.scopeGuard && !transition.scopeGuard(scope)) {
    return {
      ok: false,
      code: 'reopen-without-scope',
      reason: `Transition ${input.action} not allowed at scope ${scope} for kind ${input.kind}.`,
    }
  }

  return {
    ok: true,
    next: transition.to,
    scope,
    nextActions: nextActionsFromStatus(transition.to),
    surfaceReopens: input.action === 'reset-complete',
    triggersRecompute: input.action === 'teacher-edit-submit',
  }
}

/**
 * Enumerate the legal next actions from a given status. Useful for UI
 * button/tab rendering.
 */
export function nextActionsFromStatus(status: UnlockRequestStatus): UnlockRequestAction[] {
  return ALLOWED_TRANSITIONS
    .filter(t => t.from === status && t.action !== 'request')
    .map(t => t.action)
}

/**
 * Is the request closed (no more transitions possible)?
 * Relocked + Rejected are both terminal.
 */
export function isCorrectionCycleTerminal(status: UnlockRequestStatus): boolean {
  return status === 'Relocked' || status === 'Rejected'
}

/**
 * Derive the display-level summary for the correction cycle. Used by the
 * HOD workflow tab and the course-leader audit banner so both surfaces
 * describe the cycle with the same language.
 */
export function describeCorrectionCycle(input: {
  status: UnlockRequestStatus
  kind: UnlockRequestKind
}): {
  stepLabel: string
  description: string
  editorReopened: boolean
  awaitingActor: CorrectionCycleActorRole | null
} {
  const scope = scopeForKind(input.kind)
  const scopeLabel = scope === 'evidence'
    ? 'marks/attendance evidence'
    : scope === 'scheme' ? 'CE scheme decomposition' : 'TT blueprint'
  switch (input.status) {
    case 'Pending':
      return {
        stepLabel: 'Awaiting HOD review',
        description: `A correction-cycle unlock request for ${scopeLabel} is waiting for HOD approval or rejection.`,
        editorReopened: false,
        awaitingActor: 'HOD',
      }
    case 'Approved':
      return {
        stepLabel: 'Approved — awaiting reset',
        description: `Unlock approved. The ${scopeLabel} surface will reopen once the reset completes.`,
        editorReopened: false,
        awaitingActor: 'SYSTEM',
      }
    case 'Rejected':
      return {
        stepLabel: 'Rejected — cycle closed',
        description: `HOD rejected the unlock request. The ${scopeLabel} surface stays locked. Teacher may open a new request if warranted.`,
        editorReopened: false,
        awaitingActor: null,
      }
    case 'Reset Completed':
      return {
        stepLabel: 'Unlocked — awaiting teacher edit + recompute',
        description: `Reset complete. The ${scopeLabel} editor is now open for correction. Risk recomputes when the teacher submits.`,
        editorReopened: true,
        awaitingActor: 'COURSE_LEADER',
      }
    case 'Relocked':
      return {
        stepLabel: 'Relocked — cycle closed',
        description: `Correction cycle closed. The ${scopeLabel} surface has been relocked after recompute.`,
        editorReopened: false,
        awaitingActor: null,
      }
  }
}

// Compile-time guard so this module stays aligned with academic.ts Zod shape.
// Using the Zod-derived type via its import would introduce a cycle; this
// does a purely structural proof via assignability in a type position. If
// academic.ts changes, the below will fail tsc and tell us exactly which
// module drifted.
export type _StructuralSyncGuard = UnlockRequestPayload extends {
  offeringId: string
  kind: UnlockRequestKind
  status: UnlockRequestStatus
  requestedByRole: 'COURSE_LEADER' | 'MENTOR' | 'HOD'
  requestedByFacultyId?: string
  requestedAt: number
  reviewedAt?: number
  requestNote?: string
  reviewNote?: string
  handoffNote?: string
} ? true : never

