/**
 * Proof-workflow -> action-queue task projection helpers.
 *
 * These build a shared action-queue task (and its date/label derivations) from a
 * simulation-stage queue projection joined with student/offering rows. They
 * reference db/schema row types, so they live in the persistence layer; the
 * bodies are moved verbatim from modules/academic.ts and their exported names are
 * preserved (re-exported by modules/academic.ts).
 */
import {
  sectionOfferings,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageQueueProjections,
  students,
} from '../../../../db/schema.js'
import { parseJson } from '../../../../lib/json.js'
import { humanLabelForActionCode } from '../../../../lib/proof-recommendation-text-generator.js'
import { isoToMillis } from '../../../../application/use-cases/academic/academic-utils.js'
import {
  riskBandSchema,
  sharedTaskSchema,
  taskTypeSchema,
  uiRoleSchema,
} from '../../../../application/use-cases/academic/academic-task-contracts.js'

export const PROOF_WORKFLOW_TASK_ID_PREFIX = 'proof-workflow-task::'

export function proofWorkflowTaskIdFromQueueCaseId(queueCaseId: string) {
  return `${PROOF_WORKFLOW_TASK_ID_PREFIX}${queueCaseId}`
}

export function taskDateISOFromTimestamp(value: string | null | undefined) {
  if (typeof value !== 'string' || value.length < 10) return null
  const dateISO = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? dateISO : null
}

export function taskDueLabelFromDate(dueDateISO: string | null, anchorDateISO: string | null) {
  if (!dueDateISO) return 'This week'
  if (!anchorDateISO) return dueDateISO
  const dueAt = Date.parse(`${dueDateISO}T00:00:00.000Z`)
  const anchorAt = Date.parse(`${anchorDateISO}T00:00:00.000Z`)
  if (!Number.isFinite(dueAt) || !Number.isFinite(anchorAt)) return dueDateISO
  const dayDelta = Math.round((dueAt - anchorAt) / 86_400_000)
  if (dayDelta === 0) return 'Today'
  if (dayDelta === 1) return 'Tomorrow'
  if (dayDelta > 1 && dayDelta < 7) return 'This week'
  if (dayDelta < 0) return 'Overdue'
  return dueDateISO
}

export function proofPlaybackCurrentDateISO(input: {
  checkpoint?: typeof simulationStageCheckpoints.$inferSelect | null
  run?: typeof simulationRuns.$inferSelect | null
}) {
  return taskDateISOFromTimestamp(input.run?.simulatedDateIso)
    ?? taskDateISOFromTimestamp(input.checkpoint?.createdAt)
    ?? null
}

export function buildProofWorkflowTaskFromQueueProjection(input: {
  queueProjection: typeof simulationStageQueueProjections.$inferSelect
  studentById: Record<string, typeof students.$inferSelect>
  offeringById: Record<string, typeof sectionOfferings.$inferSelect>
  anchorDateISO: string | null
}) {
  const detail = parseJson(input.queueProjection.detailJson, {} as Record<string, unknown>)
  if (detail.primaryCase !== true) return null
  if (detail.countsTowardCapacity !== true) return null
  if (input.queueProjection.status !== 'Open') return null
  if (!input.queueProjection.offeringId || !input.queueProjection.simulationStageQueueCaseId) return null

  const taskId = proofWorkflowTaskIdFromQueueCaseId(input.queueProjection.simulationStageQueueCaseId)
  const student = input.studentById[input.queueProjection.studentId]
  const offering = input.offeringById[input.queueProjection.offeringId]
  const dueDateISO = taskDateISOFromTimestamp(typeof detail.dueAt === 'string' ? detail.dueAt : null)
  const assignedTo = uiRoleSchema.safeParse(input.queueProjection.assignedToRole).success
    ? input.queueProjection.assignedToRole
    : 'Course Leader'
  const taskType = taskTypeSchema.safeParse(input.queueProjection.taskType).success
    ? input.queueProjection.taskType
    : 'Follow-up'
  const queueNote = typeof detail.note === 'string'
    ? detail.note
    : humanLabelForActionCode(input.queueProjection.recommendedAction) ?? 'Review the proof queue case and confirm the next intervention step.'
  const priorityRank = Number.isFinite(Number(detail.priorityRank)) ? Number(detail.priorityRank) : null
  return sharedTaskSchema.parse({
    id: taskId,
    studentId: input.queueProjection.studentId,
    studentName: student?.name ?? input.queueProjection.studentId,
    studentUsn: student?.usn ?? input.queueProjection.studentId,
    offeringId: input.queueProjection.offeringId,
    courseCode: input.queueProjection.courseCode,
    courseName: input.queueProjection.courseTitle,
    year: offering?.yearLabel ?? offering?.sectionCode ?? `Semester ${input.queueProjection.semesterNumber}`,
    riskProb: input.queueProjection.riskProbScaled / 100,
    riskBand: riskBandSchema.parse(input.queueProjection.riskBand),
    title: humanLabelForActionCode(input.queueProjection.recommendedAction)
      ? `Follow-up: ${humanLabelForActionCode(input.queueProjection.recommendedAction)}`
      : `Follow-up: ${input.queueProjection.courseCode} proof queue case`,
    due: taskDueLabelFromDate(dueDateISO, input.anchorDateISO),
    dueDateISO: dueDateISO ?? undefined,
    status: 'New',
    actionHint: queueNote,
    priority: priorityRank != null ? Math.max(1, 100 - priorityRank) : Math.max(1, input.queueProjection.riskProbScaled),
    createdAt: isoToMillis(input.queueProjection.createdAt),
    updatedAt: isoToMillis(input.queueProjection.updatedAt),
    assignedTo,
    taskType,
    sourceRole: 'System',
    manual: false,
    transitionHistory: [
      {
        id: `transition-${taskId}`,
        at: isoToMillis(input.queueProjection.createdAt),
        actorRole: 'System',
        action: 'Queued from proof workflow',
        toOwner: assignedTo,
        note: queueNote,
      },
    ],
  })
}
