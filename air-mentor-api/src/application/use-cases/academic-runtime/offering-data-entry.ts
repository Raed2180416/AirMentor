/**
 * Offering data-entry use-cases: attendance commit, assessment-lock clearing
 * (HOD), scheme upsert, and question-paper upsert. Moved verbatim from
 * modules/academic-runtime-routes.ts; DB access goes through the repository and
 * the shared academic functions (scope guards, offering context, policy
 * resolution, scheme/blueprint validators, runtime-state accessors, audit emit)
 * arrive via the deps bundle. `facultyId` is passed already-guarded by the
 * controller so its null-check keeps firing before request parsing.
 */
import type { z } from 'zod'
import { badRequest } from '../../../lib/http-errors.js'
import { parseJson, stringifyJson } from '../../../lib/json.js'
import type {
  OfferingLockField,
  OfferingWritePatch,
} from '../../ports/academic-runtime-repository.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'
import { upsertStudentPatchShadow } from './runtime-shadow.js'

export async function commitAttendance(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  offeringId: string,
  body: z.infer<AcademicRuntimeUseCaseDeps['attendanceCommitSchema']>,
) {
  await deps.assertCourseLeaderCanManageOffering(facultyId, offeringId)
  const { offering } = await deps.getOfferingContext(offeringId)
  const capturedAt = body.capturedAt ?? deps.now()
  const now = deps.now()
  const studentPatchUpdates: Record<string, Record<string, unknown>> = {}

  for (const entry of body.entries) {
    if (entry.presentClasses > entry.totalClasses) {
      throw badRequest('Present classes cannot exceed total classes')
    }
    const enrollment = await deps.assertStudentEnrolledInOffering(offering, entry.studentId)
    await deps.repo.insertAttendanceSnapshot({
      studentId: enrollment.studentId,
      offeringId,
      presentClasses: entry.presentClasses,
      totalClasses: entry.totalClasses,
      attendancePercent: Math.round((entry.presentClasses / Math.max(1, entry.totalClasses)) * 100),
      source: 'teacher-workspace',
      capturedAt,
    }, now, now)
    studentPatchUpdates[`${offeringId}::${enrollment.studentId}`] = {
      present: entry.presentClasses,
      totalClasses: entry.totalClasses,
    }
  }

  const averageAttendance = body.entries.length > 0
    ? Math.round(body.entries.reduce((sum, entry) => sum + ((entry.presentClasses / Math.max(1, entry.totalClasses)) * 100), 0) / body.entries.length)
    : offering.attendance

  await deps.repo.updateOfferingFields(offeringId, {
    attendance: averageAttendance,
    version: offering.version + 1,
    updatedAt: now,
  })
  await upsertStudentPatchShadow(deps, studentPatchUpdates)

  if (body.lock) {
    const currentLockPayload = await deps.getAcademicRuntimeState('lockByOffering') as Record<string, Record<string, boolean>>
    await deps.saveAcademicRuntimeState('lockByOffering', {
      ...currentLockPayload,
      [offeringId]: {
        ...(currentLockPayload[offeringId] ?? {}),
        attendance: true,
      },
    })
  }

  await deps.emitAudit({
    entityType: 'offering_attendance_commit',
    entityId: offeringId,
    action: 'UPSERT',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    metadata: {
      entryCount: body.entries.length,
      capturedAt,
      locked: !!body.lock,
    },
  })
  return {
    ok: true,
    offeringId,
    capturedAt,
    averageAttendance,
    locked: !!body.lock,
  }
}

export async function clearAssessmentLock(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  params: z.infer<AcademicRuntimeUseCaseDeps['assessmentCommitParamsSchema']>,
) {
  const { offering } = await deps.getOfferingContext(params.offeringId)
  const lockField: OfferingLockField | null = params.kind === 'tt1'
    ? 'tt1Locked'
    : params.kind === 'tt2'
      ? 'tt2Locked'
      : params.kind === 'quiz'
        ? 'quizLocked'
        : params.kind === 'assignment'
          ? 'assignmentLocked'
          : params.kind === 'finals'
            ? 'finalsLocked'
            : null
  if (!lockField) throw badRequest(`Invalid kind: ${params.kind}`)
  if (offering[lockField] !== 1) {
    return { ok: true as const, offeringId: params.offeringId, kind: params.kind, cleared: false, reason: 'already-unlocked' }
  }
  const patch: OfferingWritePatch = {
    version: offering.version + 1,
    updatedAt: deps.now(),
  }
  patch[lockField] = 0
  await deps.repo.updateOfferingFields(params.offeringId, patch)
  const currentLockPayload = await deps.getAcademicRuntimeState('lockByOffering') as Record<string, Record<string, boolean>>
  await deps.saveAcademicRuntimeState('lockByOffering', {
    ...currentLockPayload,
    [params.offeringId]: {
      ...(currentLockPayload[params.offeringId] ?? {}),
      [params.kind]: false,
    },
  })
  await deps.emitAudit({
    entityType: 'offering_assessment_lock',
    entityId: `${params.offeringId}:${params.kind}`,
    action: 'CLEAR_LOCK',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    metadata: { kind: params.kind, offeringId: params.offeringId },
  })
  return { ok: true as const, offeringId: params.offeringId, kind: params.kind, cleared: true }
}

export async function saveOfferingScheme(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  offeringId: string,
  body: z.infer<AcademicRuntimeUseCaseDeps['offeringSchemeUpsertSchema']>,
) {
  await deps.assertCourseLeaderCanManageOffering(facultyId, offeringId)
  const { offering, term } = await deps.getOfferingContext(offeringId)
  const policy = term.batchId
    ? (await deps.resolveBatchPolicy(term.batchId, { sectionCode: offering.sectionCode })).effectivePolicy
    : deps.DEFAULT_POLICY
  const canonicalScheme = deps.canonicalizeSchemeState(body.scheme, policy)
  deps.validateSchemeAgainstPolicy(canonicalScheme, policy)
  const now = deps.now()
  const current = await deps.repo.getSchemeByOffering(offeringId)

  if (current) {
    await deps.repo.updateScheme(offeringId, {
      configuredByFacultyId: facultyId,
      schemeJson: stringifyJson(canonicalScheme),
      policySnapshotJson: stringifyJson(policy),
      status: current.status,
    }, current.version + 1, now)
  } else {
    await deps.repo.insertScheme(offering.offeringId, {
      configuredByFacultyId: facultyId,
      schemeJson: stringifyJson(canonicalScheme),
      policySnapshotJson: stringifyJson(policy),
      status: 'active',
    }, now, now)
  }

  const saved = (await deps.repo.getSchemeByOffering(offeringId))!

  const previousScheme = current
    ? deps.schemeStateSchema.safeParse(parseJson(current.schemeJson, {}))
    : null
  await deps.emitAudit({
    entityType: 'offering_assessment_scheme',
    entityId: offeringId,
    action: current ? 'UPDATE' : 'CREATE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    before: previousScheme?.success ? deps.canonicalizeSchemeState(previousScheme.data, policy) : null,
    after: canonicalScheme,
    metadata: { offeringId },
  })

  return {
    offeringId: saved.offeringId,
    scheme: deps.canonicalizeSchemeState(deps.schemeStateSchema.parse(parseJson(saved.schemeJson, {})), policy),
    version: saved.version,
    policySnapshot: parseJson(saved.policySnapshotJson, {}),
  }
}

export async function saveQuestionPaper(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  params: z.infer<AcademicRuntimeUseCaseDeps['questionPaperParamsSchema']>,
  body: z.infer<AcademicRuntimeUseCaseDeps['offeringQuestionPaperUpsertSchema']>,
) {
  await deps.assertCourseLeaderCanManageOffering(facultyId, params.offeringId)
  const { offering, course, term, department } = await deps.getOfferingContext(params.offeringId)
  const rows = await deps.repo.listActiveCourseOutcomeOverrides(offering.courseId)
  const resolvedOutcomes = deps.resolveCourseOutcomesForOffering({
    institutionId: department.institutionId,
    branchId: offering.branchId,
    batchId: term.batchId,
    offeringId: offering.offeringId,
    courseId: offering.courseId,
    courseCode: course.courseCode,
    courseTitle: course.title,
    overrides: rows,
  })
  deps.validateQuestionPaperBlueprint(params.kind, body.blueprint, new Set(resolvedOutcomes.map(item => item.id)))
  const now = deps.now()
  const current = await deps.repo.getQuestionPaperByOfferingKind(params.offeringId, params.kind)

  if (current) {
    await deps.repo.updateQuestionPaper(current.paperId, stringifyJson(body.blueprint), facultyId, current.version + 1, now)
  } else {
    await deps.repo.insertQuestionPaper({
      offeringId: params.offeringId,
      kind: params.kind,
      blueprintJson: stringifyJson(body.blueprint),
      updatedByFacultyId: facultyId,
    }, now, now)
  }

  const saved = (await deps.repo.getQuestionPaperByOfferingKind(params.offeringId, params.kind))!

  const previousBlueprint = current
    ? deps.termTestBlueprintSchema.safeParse(parseJson(current.blueprintJson, {}))
    : null
  await deps.emitAudit({
    entityType: 'offering_question_paper',
    entityId: saved.paperId,
    action: current ? 'UPDATE' : 'CREATE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    before: previousBlueprint?.success ? previousBlueprint.data : null,
    after: body.blueprint,
    metadata: { offeringId: params.offeringId, kind: params.kind },
  })

  return {
    paperId: saved.paperId,
    offeringId: saved.offeringId,
    kind: saved.kind,
    blueprint: deps.termTestBlueprintSchema.parse(parseJson(saved.blueprintJson, {})),
    version: saved.version,
  }
}
