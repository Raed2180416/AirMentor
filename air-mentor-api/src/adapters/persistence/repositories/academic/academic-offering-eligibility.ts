/**
 * Offering context loader + stage-advancement eligibility evaluator.
 *
 * DB-touching orchestration that reads the offering + its course/term/branch/
 * department and aggregates evidence/lock/queue/task state to decide whether an
 * offering may advance to its next stage. Keeps the `context: RouteContext`
 * signature. Moved verbatim from modules/academic.ts.
 */
import { and, eq } from 'drizzle-orm'
import type { RouteContext } from '../../../../app.js'
import {
  academicTasks,
  academicTerms,
  branches,
  courses,
  departments,
  facultyOfferingOwnerships,
  offeringAssessmentSchemes,
  sectionOfferings,
  simulationRuns,
  simulationStageQueueCases,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentEnrollments,
  transcriptSubjectResults,
  transcriptTermResults,
} from '../../../../db/schema.js'
import { notFound } from '../../../../lib/http-errors.js'
import { parseJson } from '../../../../lib/json.js'
import {
  DEFAULT_POLICY,
  resolveBatchPolicy,
  resolveBatchStagePolicy,
} from '../../../../modules/admin-structure.js'
import { schemeStateSchema } from '../../../../application/use-cases/academic/academic-contracts.js'
import {
  assessmentTypeMatches,
  stagePolicyForOffering,
} from '../../../../application/use-cases/academic/academic-utils.js'
import { canonicalizeSchemeState } from '../../../../application/use-cases/academic/academic-scheme.js'
import { getAcademicRuntimeState } from './academic-runtime-state.js'
import { offeringStageSnapshot } from './academic-projections.js'

export async function getOfferingContext(context: RouteContext, offeringId: string) {
  const [offering] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, offeringId))
  if (!offering) throw notFound('Offering not found')
  const [course, term, branch] = await Promise.all([
    context.db.select().from(courses).where(eq(courses.courseId, offering.courseId)).then(rows => rows[0] ?? null),
    context.db.select().from(academicTerms).where(eq(academicTerms.termId, offering.termId)).then(rows => rows[0] ?? null),
    context.db.select().from(branches).where(eq(branches.branchId, offering.branchId)).then(rows => rows[0] ?? null),
  ])
  if (!course) throw notFound('Course not found for offering')
  if (!term) throw notFound('Academic term not found for offering')
  if (!branch) throw notFound('Branch not found for offering')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found for offering')
  return { offering, course, term, branch, department }
}

export async function buildOfferingStageEligibility(context: RouteContext, offeringId: string) {
  const { offering, course, term } = await getOfferingContext(context, offeringId)
  const resolvedPolicy = term.batchId
    ? await resolveBatchPolicy(context, term.batchId, { sectionCode: offering.sectionCode })
    : null
  const resolvedStagePolicy = term.batchId
    ? await resolveBatchStagePolicy(context, term.batchId, { sectionCode: offering.sectionCode })
    : null
  const policy = stagePolicyForOffering(resolvedStagePolicy)
  const { currentStage, nextStage } = offeringStageSnapshot(offering, policy)
  const targetStage = nextStage
  const runtimeLockByOffering = await getAcademicRuntimeState(context, 'lockByOffering') as Record<string, Record<string, boolean>>
  const runtimeLock = runtimeLockByOffering[offeringId] ?? {}
  const activeEnrollments = await context.db.select().from(studentEnrollments).where(and(
    eq(studentEnrollments.termId, offering.termId),
    eq(studentEnrollments.sectionCode, offering.sectionCode),
    eq(studentEnrollments.academicStatus, 'active'),
  ))
  const activeStudentIds = activeEnrollments.map(row => row.studentId)
  const [attendanceRows, assessmentRows, termResults, subjectResults, taskRows, batchRunRows, queueCaseRows, ownershipRows, schemeRows] = await Promise.all([
    context.db.select().from(studentAttendanceSnapshots).where(eq(studentAttendanceSnapshots.offeringId, offeringId)),
    context.db.select().from(studentAssessmentScores).where(eq(studentAssessmentScores.offeringId, offeringId)),
    context.db.select().from(transcriptTermResults).where(eq(transcriptTermResults.termId, offering.termId)),
    context.db.select().from(transcriptSubjectResults),
    context.db.select().from(academicTasks).where(eq(academicTasks.offeringId, offeringId)),
    term.batchId ? context.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, term.batchId)) : Promise.resolve([]),
    context.db.select().from(simulationStageQueueCases).where(eq(simulationStageQueueCases.primaryOfferingId, offeringId)),
    context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.offeringId, offeringId)),
    context.db.select().from(offeringAssessmentSchemes).where(eq(offeringAssessmentSchemes.offeringId, offeringId)),
  ])
  const transcriptByStudentId = new Map(termResults.map(row => [row.studentId, row]))
  const subjectResultSet = new Set(subjectResults
    .filter(row => row.courseCode.toLowerCase() === course.courseCode.toLowerCase())
    .map(row => row.transcriptTermResultId))
  const expectedCount = activeStudentIds.length
  const hasScoresFor = (types: string[]) => {
    const students = new Set(
      assessmentRows
        .filter(row => activeStudentIds.includes(row.studentId) && assessmentTypeMatches(row.componentType, types))
        .map(row => row.studentId),
    )
    return students.size
  }
  const transcriptCount = activeStudentIds.filter(studentId => {
    const termResult = transcriptByStudentId.get(studentId)
    return termResult ? subjectResultSet.has(termResult.transcriptTermResultId) : false
  }).length
  const activeRun = batchRunRows
    .filter(row => row.activeFlag === 1)
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const openQueueCases = activeRun
    ? queueCaseRows.filter(row =>
      row.simulationRunId === activeRun.simulationRunId
      && row.status !== 'resolved'
      && row.status !== 'idle')
    : []
  const activeOwnerships = ownershipRows.filter(row => row.status === 'active')
  const explicitScheme = schemeRows[0]
    ? canonicalizeSchemeState(
        schemeStateSchema.parse(parseJson(schemeRows[0].schemeJson, {})),
        resolvedPolicy?.effectivePolicy ?? DEFAULT_POLICY,
      )
    : null

  const evidenceStatus = {
    attendance: {
      required: !!targetStage?.requiredEvidence.includes('attendance'),
      presentCount: new Set(attendanceRows.filter(row => activeStudentIds.includes(row.studentId)).map(row => row.studentId)).size,
      expectedCount,
      locked: !!runtimeLock.attendance,
    },
    tt1: {
      required: !!targetStage?.requiredEvidence.includes('tt1'),
      presentCount: hasScoresFor(['tt1', 'tt1_leaf']),
      expectedCount,
      locked: !!offering.tt1Locked,
    },
    tt2: {
      required: !!targetStage?.requiredEvidence.includes('tt2'),
      presentCount: hasScoresFor(['tt2', 'tt2_leaf']),
      expectedCount,
      locked: !!offering.tt2Locked,
    },
    quiz: {
      required: !!targetStage?.requiredEvidence.includes('quiz'),
      presentCount: hasScoresFor(['quiz*']),
      expectedCount,
      locked: !!offering.quizLocked,
    },
    assignment: {
      required: !!targetStage?.requiredEvidence.includes('assignment'),
      presentCount: hasScoresFor(['asgn*']),
      expectedCount,
      locked: !!offering.assignmentLocked,
    },
    finals: {
      required: !!targetStage?.requiredEvidence.includes('finals'),
      presentCount: hasScoresFor(['sem_end', 'see']),
      expectedCount,
      locked: !!offering.finalsLocked,
    },
    transcript: {
      required: !!targetStage?.requiredEvidence.includes('transcript'),
      presentCount: transcriptCount,
      expectedCount,
      locked: transcriptCount >= expectedCount && expectedCount > 0,
    },
  }
  const blockingTaskRows = taskRows.filter(row => row.status !== 'Resolved' && row.status !== 'Completed' && row.status !== 'Closed')
  const blockingReasons: string[] = []
  if (activeOwnerships.length === 0) {
    blockingReasons.push('No active faculty owner is assigned for this class')
  }
  if (expectedCount === 0) {
    blockingReasons.push('No active roster is enrolled for this class')
  }
  if (!explicitScheme || explicitScheme.status === 'Needs Setup') {
    blockingReasons.push('Assessment scheme is not configured for this class')
  }
  Object.entries(evidenceStatus).forEach(([kind, evidence]) => {
    if (!evidence.required) return
    if (evidence.presentCount < evidence.expectedCount) {
      blockingReasons.push(`${kind} evidence is incomplete (${evidence.presentCount}/${evidence.expectedCount})`)
    }
    if (!evidence.locked) {
      blockingReasons.push(`${kind} is not locked`)
    }
  })
  if (targetStage?.requireTaskClearance && blockingTaskRows.length > 0) {
    blockingReasons.push(`${blockingTaskRows.length} faculty action queue item(s) remain open`)
  }
  if (targetStage?.requireQueueClearance && openQueueCases.length > 0) {
    blockingReasons.push(`${openQueueCases.length} proof queue case(s) remain open for this class`)
  }
  if (!targetStage) {
    blockingReasons.push('The offering is already at the final configured stage')
  }
  const evidenceStatusList = Object.entries(evidenceStatus).map(([kind, evidence]) => ({
    kind: kind as 'attendance' | 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'finals' | 'transcript',
    required: evidence.required,
    present: evidence.presentCount >= evidence.expectedCount && evidence.expectedCount > 0,
    presentCount: evidence.presentCount,
    expectedCount: evidence.expectedCount,
    locked: evidence.locked,
  }))
  return {
    offeringId,
    batchId: term.batchId ?? null,
    policy,
    currentStage,
    nextStage,
    eligible: blockingReasons.length === 0,
    blockingReasons,
    queueBurden: blockingTaskRows.length + openQueueCases.length,
    evidenceStatus: evidenceStatusList,
  }
}
