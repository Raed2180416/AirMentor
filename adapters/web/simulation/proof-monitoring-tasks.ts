import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import type { ApiAcademicFacultyProfile } from '@web/shared/api/types'
import {
  toDueLabel,
  type RiskBand,
  type Role,
  type SharedTask,
} from '@kernel/shared/domain'

export type ProofMonitoringQueueItem = ApiAcademicFacultyProfile['proofOperations']['monitoringQueue'][number]

function sanitizeTaskIdPart(value: unknown) {
  return String(value ?? 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '-')
}

export function getProofMonitoringTaskId(input: {
  item: Pick<ProofMonitoringQueueItem, 'riskAssessmentId' | 'simulationRunId' | 'studentId' | 'offeringId'>
  semesterNumber?: number | string | null
  stageKey?: string | null
}) {
  const stableTaskScope = [
    input.item.riskAssessmentId,
    input.item.simulationRunId ?? 'active-run',
    input.item.studentId,
    input.item.offeringId,
    input.semesterNumber ?? 'active-semester',
    input.stageKey ?? 'active-stage',
  ].map(sanitizeTaskIdPart).join('-')
  return `proof-monitoring-${stableTaskScope}`
}

function getLegacyProofMonitoringTaskId(input: {
  item: Pick<ProofMonitoringQueueItem, 'studentId' | 'offeringId'>
  semesterNumber?: number | string | null
  stageKey?: string | null
}) {
  const stableTaskScope = [
    input.item.studentId,
    input.item.offeringId,
    input.semesterNumber ?? 'active-semester',
    input.stageKey ?? 'active-stage',
  ].map(sanitizeTaskIdPart).join('-')
  return `proof-monitoring-${stableTaskScope}`
}

export function getProofMonitoringTaskSuppressionIds(input: {
  item: Pick<ProofMonitoringQueueItem, 'riskAssessmentId' | 'simulationRunId' | 'studentId' | 'offeringId'>
  semesterNumber?: number | string | null
  stageKey?: string | null
}) {
  return [
    getProofMonitoringTaskId(input),
    getLegacyProofMonitoringTaskId(input),
  ]
}

function normalizeProofQueueStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? ''
}

export function isOpenProofMonitoringQueueItem(item: ProofMonitoringQueueItem) {
  return !item.resolution && normalizeProofQueueStatus(item.reassessmentStatus) !== 'resolved'
}

export function materializeProofMonitoringTask(input: {
  item: ProofMonitoringQueueItem
  role: Role
  proofVirtualDateISO?: string | null
  semesterNumber?: number | string | null
  stageKey?: string | null
  now?: number
}): SharedTask {
  const { item, role } = input
  const riskBand: RiskBand = item.riskBand === 'High' || item.riskBand === 'Medium' || item.riskBand === 'Low' ? item.riskBand : 'Medium'
  const dueDateISO = item.dueAt?.slice(0, 10)
  const id = getProofMonitoringTaskId({
    item,
    semesterNumber: input.semesterNumber,
    stageKey: input.stageKey,
  })
  const timestamp = item.dueAt ? Date.parse(item.dueAt) : input.now ?? Date.now()

  return {
    id,
    studentId: item.studentId,
    studentName: item.studentName,
    studentUsn: item.usn,
    offeringId: item.offeringId,
    courseCode: item.courseCode,
    courseName: item.courseTitle,
    year: item.sectionCode ? `Section ${item.sectionCode}` : 'Proof scope',
    riskProb: item.riskProbScaled / 100,
    riskBand,
    title: `Proof follow-up: ${humanLabelForActionCode(item.recommendedAction) ?? item.recommendedAction}`,
    due: dueDateISO ? toDueLabel(dueDateISO, 'This week', input.proofVirtualDateISO ?? undefined) : 'This week',
    dueDateISO: dueDateISO ?? undefined,
    status: item.acknowledgement ? 'In Progress' : 'New',
    actionHint: item.decisionNote ?? item.drivers[0]?.label ?? 'Review the proof monitoring queue item and confirm the intervention path.',
    priority: Math.max(1, Math.round(item.riskProbScaled)),
    createdAt: timestamp,
    updatedAt: timestamp,
    assignedTo: role,
    taskType: 'Follow-up',
    sourceRole: 'System',
    manual: false,
    transitionHistory: [{
      id: `transition-${id}`,
      at: timestamp,
      actorRole: 'System',
      action: 'Queued from proof monitoring',
      toOwner: role,
      note: item.decisionNote ?? item.drivers[0]?.label ?? 'Proof monitoring queue item is active.',
    }],
  }
}

export function materializeProofMonitoringTasks(input: {
  queue: ProofMonitoringQueueItem[]
  role: Role
  proofVirtualDateISO?: string | null
  semesterNumber?: number | string | null
  stageKey?: string | null
  suppressedTaskIds?: ReadonlySet<string>
  now?: number
}) {
  return input.queue
    .filter(isOpenProofMonitoringQueueItem)
    .filter(item => !getProofMonitoringTaskSuppressionIds({
      item,
      semesterNumber: input.semesterNumber,
      stageKey: input.stageKey,
    }).some(taskId => input.suppressedTaskIds?.has(taskId)))
    .map(item => materializeProofMonitoringTask({
      item,
      role: input.role,
      proofVirtualDateISO: input.proofVirtualDateISO,
      semesterNumber: input.semesterNumber,
      stageKey: input.stageKey,
      now: input.now,
    }))
}
