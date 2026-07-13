/**
 * PUT /api/academic/offerings/:offeringId/assessment-entries/:kind — persist
 * teaching-workspace assessment score rows.
 *
 * Moved verbatim from modules/academic-runtime-routes.ts. DB access goes through
 * the repository; the shared academic functions (scope guard, offering context,
 * policy resolution, scheme/blueprint builders + validators, outcome resolution,
 * runtime-state accessors, audit emit) arrive via the deps bundle.
 *
 * R5: `deps.triggerActiveRunRecompute` (adapters/simulation/msruas-proof-control-plane
 * triggerActiveRunRecomputeIfPresent, context-bound in the controller) fires
 * only AFTER every DB write commits and the audit event is emitted — the exact
 * ordering the legacy handler used. Optimistic-lock / stage-gate checks are
 * unchanged.
 */
import type { z } from 'zod'
import { badRequest, forbidden } from '../../../lib/http-errors.js'
import { parseJson } from '../../../lib/json.js'
import type {
  OfferingLockField,
  OfferingWritePatch,
} from '../../ports/academic-runtime-repository.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'
import { upsertStudentPatchShadow } from './runtime-shadow.js'

export async function commitAssessmentEntries(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  params: z.infer<AcademicRuntimeUseCaseDeps['assessmentCommitParamsSchema']>,
  body: z.infer<AcademicRuntimeUseCaseDeps['assessmentCommitSchema']>,
) {
  await deps.assertCourseLeaderCanManageOffering(facultyId, params.offeringId)
  const { offering, term, course, department } = await deps.getOfferingContext(params.offeringId)
  const policy = term.batchId
    ? (await deps.resolveBatchPolicy(term.batchId, { sectionCode: offering.sectionCode })).effectivePolicy
    : deps.DEFAULT_POLICY
  const schemeRow = await deps.repo.getSchemeByOffering(params.offeringId)
  const scheme = schemeRow
    ? deps.canonicalizeSchemeState(deps.schemeStateSchema.parse(parseJson(schemeRow.schemeJson, {})), policy)
    : deps.buildDefaultSchemeFromPolicy(policy)
  const evaluatedAt = body.evaluatedAt ?? deps.now()
  const now = deps.now()
  const studentPatchUpdates: Record<string, Record<string, unknown>> = {}

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
  if (lockField && offering[lockField] === 1) {
    throw forbidden('This assessment dataset is locked')
  }

  // GAP-2: Prevent locking evidence for a stage that hasn't been reached yet.
  // Stage orders: pre-tt1=1, post-tt1=2, post-tt2=3, post-assignments=4, post-see=5.
  // Locking future evidence bypasses the proof stage-gate and corrupts the sim timeline.
  if (body.lock) {
    const minimumStageToLock: Record<string, number> = {
      attendance: 1,
      tt1: 1,
      tt2: 2,
      quiz: 2,
      assignment: 3,
      finals: 4,
    }
    const requiredStage = minimumStageToLock[params.kind] ?? 1
    if (offering.stage < requiredStage) {
      throw forbidden(`Cannot lock ${params.kind} evidence before the class has reached the required stage (current: ${offering.stage}, required: ${requiredStage})`)
    }
  }

  const allowedComponents = new Map<string, { maxScore: number; storageType: string }>()
  if (params.kind === 'tt1' || params.kind === 'tt2') {
    const courseOutcomeRows = await deps.repo.listActiveCourseOutcomeOverrides(offering.courseId)
    const resolvedOutcomes = deps.resolveCourseOutcomesForOffering({
      institutionId: department.institutionId,
      branchId: offering.branchId,
      batchId: term.batchId,
      offeringId: offering.offeringId,
      courseId: offering.courseId,
      courseCode: course.courseCode,
      courseTitle: course.title,
      overrides: courseOutcomeRows,
    })
    const paperRow = await deps.repo.getQuestionPaperByOfferingKind(params.offeringId, params.kind)
    const blueprint = paperRow
      ? deps.termTestBlueprintSchema.parse(parseJson(paperRow.blueprintJson, {}))
      : deps.buildDefaultQuestionPaper(params.kind, resolvedOutcomes)
    for (const leaf of deps.flattenTermTestLeaves(blueprint.nodes)) {
      allowedComponents.set(leaf.id, { maxScore: leaf.maxMarks, storageType: `${params.kind}_leaf` })
    }
  } else if (params.kind === 'quiz') {
    scheme.quizComponents.forEach((component, index) => {
      allowedComponents.set(component.id, { maxScore: component.rawMax, storageType: `quiz${index + 1}` })
    })
  } else if (params.kind === 'assignment') {
    scheme.assignmentComponents.forEach((component, index) => {
      allowedComponents.set(component.id, { maxScore: component.rawMax, storageType: `asgn${index + 1}` })
    })
  } else {
    allowedComponents.set('see', { maxScore: scheme.finalsMax, storageType: 'sem_end' })
  }
  let replacementComponentTypes = Array.from(new Set([
    ...Array.from(allowedComponents.values()).map(component => component.storageType),
    ...((params.kind === 'tt1' || params.kind === 'tt2') ? [params.kind] : []),
  ]))
  if (params.kind === 'quiz' || params.kind === 'assignment') {
    const legacyComponentTypePattern = params.kind === 'quiz' ? /^quiz\d+$/ : /^asgn\d+$/
    const existingScoreRows = await deps.repo.listScoreComponentTypes(params.offeringId)
    replacementComponentTypes = Array.from(new Set([
      ...replacementComponentTypes,
      ...existingScoreRows
        .map(row => row.componentType)
        .filter(componentType => legacyComponentTypePattern.test(componentType)),
    ]))
  }
  const enrollmentByStudentId = new Map<string, Awaited<ReturnType<AcademicRuntimeUseCaseDeps['assertStudentEnrolledInOffering']>>>()
  const submittedCanonicalStudentIds: string[] = []
  const seenCanonicalStudentIds = new Set<string>()
  for (const entry of body.entries) {
    const enrollment = await deps.assertStudentEnrolledInOffering(offering, entry.studentId)
    if (seenCanonicalStudentIds.has(enrollment.studentId)) {
      throw badRequest('Assessment payload contains duplicate student entries', { studentId: enrollment.studentId })
    }
    seenCanonicalStudentIds.add(enrollment.studentId)
    submittedCanonicalStudentIds.push(enrollment.studentId)
    enrollmentByStudentId.set(entry.studentId, enrollment)
  }
  for (const entry of body.entries) {
    const seenComponentCodes = new Set<string>()
    for (const component of entry.components) {
      if (seenComponentCodes.has(component.componentCode)) {
        throw badRequest('Assessment entry contains duplicate component scores', {
          componentCode: component.componentCode,
          studentId: entry.studentId,
        })
      }
      seenComponentCodes.add(component.componentCode)
      const allowed = allowedComponents.get(component.componentCode)
      if (!allowed) {
        throw badRequest('Assessment entry references a component outside the configured scheme', {
          componentCode: component.componentCode,
          kind: params.kind,
        })
      }
      if (component.maxScore > allowed.maxScore || component.score > component.maxScore) {
        throw badRequest('Assessment entry exceeds the configured component max score', {
          componentCode: component.componentCode,
          allowedMax: allowed.maxScore,
        })
      }
    }
  }
  const patchFieldForKind = params.kind === 'tt1'
    ? 'tt1LeafScores'
    : params.kind === 'tt2'
      ? 'tt2LeafScores'
      : params.kind === 'quiz'
        ? 'quizScores'
        : params.kind === 'assignment'
          ? 'assignmentScores'
          : params.kind === 'finals'
            ? 'seeScore'
            : null
  const submittedStudentIds = submittedCanonicalStudentIds
  const submittedPatchKeys = new Set(submittedStudentIds.map(studentId => `${params.offeringId}::${studentId}`))
  const shouldReplaceAssessmentEntries = body.entries.length > 0 || !body.lock
  if (patchFieldForKind && shouldReplaceAssessmentEntries) {
    const currentStudentPatches = await deps.getAcademicRuntimeState('studentPatches') as Record<string, Record<string, unknown>>
    for (const [patchKey, patch] of Object.entries(currentStudentPatches)) {
      if (!patchKey.startsWith(`${params.offeringId}::`)) continue
      if (submittedPatchKeys.has(patchKey)) continue
      if (patch && typeof patch === 'object' && patch[patchFieldForKind] != null) {
        studentPatchUpdates[patchKey] = {
          ...(studentPatchUpdates[patchKey] ?? {}),
          [patchFieldForKind]: null,
        }
      }
    }
    await deps.repo.deleteStaleScores(params.offeringId, replacementComponentTypes, submittedStudentIds)
  }

  for (const entry of body.entries) {
    const enrollment = enrollmentByStudentId.get(entry.studentId)
    if (!enrollment) throw badRequest('Assessment entry references a student outside the offering', { studentId: entry.studentId })
    await deps.repo.deleteStudentScores(enrollment.studentId, params.offeringId, replacementComponentTypes)
    let aggregateScore = 0
    let aggregateMax = 0
    for (const component of entry.components) {
      const allowed = allowedComponents.get(component.componentCode)
      if (!allowed) {
        throw badRequest('Assessment entry references a component outside the configured scheme', {
          componentCode: component.componentCode,
          kind: params.kind,
        })
      }
      if (component.maxScore > allowed.maxScore || component.score > component.maxScore) {
        throw badRequest('Assessment entry exceeds the configured component max score', {
          componentCode: component.componentCode,
          allowedMax: allowed.maxScore,
        })
      }
      aggregateScore += component.score
      aggregateMax += component.maxScore
      await deps.repo.insertAssessmentScore({
        studentId: enrollment.studentId,
        offeringId: params.offeringId,
        termId: term.termId,
        componentType: allowed.storageType,
        componentCode: component.componentCode,
        score: component.score,
        maxScore: component.maxScore,
        evaluatedAt,
      }, now, now)
    }
    const patchKey = `${params.offeringId}::${enrollment.studentId}`
    if (params.kind === 'tt1') {
      studentPatchUpdates[patchKey] = {
        ...(studentPatchUpdates[patchKey] ?? {}),
        tt1LeafScores: Object.fromEntries(entry.components.map(component => [component.componentCode, component.score])),
      }
    } else if (params.kind === 'tt2') {
      studentPatchUpdates[patchKey] = {
        ...(studentPatchUpdates[patchKey] ?? {}),
        tt2LeafScores: Object.fromEntries(entry.components.map(component => [component.componentCode, component.score])),
      }
    } else if (params.kind === 'quiz') {
      studentPatchUpdates[patchKey] = {
        ...(studentPatchUpdates[patchKey] ?? {}),
        quizScores: Object.fromEntries(entry.components.map(component => [component.componentCode, component.score])),
      }
    } else if (params.kind === 'assignment') {
      studentPatchUpdates[patchKey] = {
        ...(studentPatchUpdates[patchKey] ?? {}),
        assignmentScores: Object.fromEntries(entry.components.map(component => [component.componentCode, component.score])),
      }
    } else if (params.kind === 'finals') {
      studentPatchUpdates[patchKey] = {
        ...(studentPatchUpdates[patchKey] ?? {}),
        seeScore: aggregateScore,
      }
    }
    if (params.kind === 'tt1' || params.kind === 'tt2') {
      await deps.repo.insertAssessmentScore({
        studentId: enrollment.studentId,
        offeringId: params.offeringId,
        termId: term.termId,
        componentType: params.kind,
        componentCode: null,
        score: aggregateScore,
        maxScore: aggregateMax,
        evaluatedAt,
      }, now, now)
    }
  }
  await upsertStudentPatchShadow(deps, studentPatchUpdates)

  if (params.kind === 'tt1' || params.kind === 'tt2' || body.lock) {
    const nextOfferingPatch: OfferingWritePatch = {
      ...(params.kind === 'tt1' ? { tt1Done: 1 } : {}),
      ...(params.kind === 'tt2' ? { tt2Done: 1 } : {}),
      version: offering.version + 1,
      updatedAt: now,
    }
    if (body.lock && lockField) nextOfferingPatch[lockField] = 1
    if (Object.keys(nextOfferingPatch).length > 0) {
      await deps.repo.updateOfferingFields(params.offeringId, nextOfferingPatch)
    }
  }

  await deps.emitAudit({
    entityType: 'offering_assessment_commit',
    entityId: `${params.offeringId}:${params.kind}`,
    action: 'UPSERT',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    metadata: {
      kind: params.kind,
      offeringId: params.offeringId,
      entryCount: body.entries.length,
      evaluatedAt,
      locked: !!body.lock,
    },
  })
  await deps.triggerActiveRunRecompute(facultyId)
  return {
    ok: true,
    offeringId: params.offeringId,
    kind: params.kind,
    evaluatedAt,
    locked: !!body.lock,
  }
}
