import { describe, expect, it } from 'vitest'
import {
  getProofMonitoringTaskId,
  materializeProofMonitoringTasks,
  type ProofMonitoringQueueItem,
} from '../src/proof-monitoring-tasks'

function buildQueueItem(overrides: Partial<ProofMonitoringQueueItem> = {}): ProofMonitoringQueueItem {
  return {
    riskAssessmentId: 'risk_001',
    simulationRunId: 'run_001',
    batchId: 'batch_mnc_2023',
    batchLabel: '2023 Proof',
    branchName: 'B.Tech Mathematics and Computing',
    studentId: 'student_001',
    studentName: 'Aarav Sharma',
    usn: '1MS23MC001',
    offeringId: 'off_mc601_a',
    courseCode: 'MC601',
    courseTitle: 'Graph Theory',
    sectionCode: 'A',
    riskBand: 'High',
    riskProbScaled: 82,
    recommendedAction: 'mentor_recovery_plan',
    riskChangeFromPreviousCheckpointScaled: 8,
    counterfactualLiftScaled: 12,
    drivers: [{ label: 'Attendance pressure', impact: 0.24, feature: 'attendance' }],
    dueAt: '2026-03-20T00:00:00.000Z',
    reassessmentStatus: 'Open',
    decisionType: 'open',
    decisionNote: null,
    observedEvidence: {
      attendancePct: 62,
      tt1Pct: 38,
      tt2Pct: null,
      quizPct: null,
      assignmentPct: null,
      seePct: null,
      cgpa: 6.8,
      backlogCount: 1,
      weakCoCount: 2,
      weakQuestionCount: 4,
      interventionRecoveryStatus: null,
      coEvidenceMode: 'checkpoint-observed',
    },
    override: null,
    acknowledgement: null,
    resolution: null,
    ...overrides,
  }
}

describe('proof monitoring task materialization', () => {
  it('builds stable task ids from reassessment, run, student, offering, and checkpoint scope', () => {
    const item = buildQueueItem()

    expect(getProofMonitoringTaskId({
      item,
      semesterNumber: 6,
      stageKey: 'post-tt1',
    })).toBe('proof-monitoring-risk_001-run_001-student_001-off_mc601_a-6-post-tt1')
  })

  it('suppresses generated proof queue tasks by legacy dismissed ids', () => {
    const item = buildQueueItem()
    const legacyDismissedId = 'proof-monitoring-student_001-off_mc601_a-6-post-tt1'

    const tasks = materializeProofMonitoringTasks({
      queue: [item],
      role: 'Mentor',
      semesterNumber: 6,
      stageKey: 'post-tt1',
      suppressedTaskIds: new Set([legacyDismissedId]),
      now: 1_710_000_000_000,
    })

    expect(tasks).toEqual([])
  })

  it('filters resolved proof queue items case-insensitively', () => {
    const tasks = materializeProofMonitoringTasks({
      queue: [buildQueueItem({ reassessmentStatus: ' resolved ' })],
      role: 'Course Leader',
      semesterNumber: 6,
      stageKey: 'post-tt1',
      now: 1_710_000_000_000,
    })

    expect(tasks).toEqual([])
  })
})
