import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ApiAcademicFacultyProfile, ApiProofReassessmentResolveResponse, ApiStudentAgentCard, ApiStudentRiskExplorer } from '../src/api/types'
import type { Offering } from '../src/data'
import { DemoRealityLoopPanel } from '../src/demo-reality-loop'
import { buildDemoRealityLoopSnapshot, formatDemoDelta } from '../src/demo-reality-loop-utils'

function makeProofProfile(overrides: Partial<ApiAcademicFacultyProfile['proofOperations']> = {}) {
  return {
    facultyId: 'mnc_t1',
    displayName: 'Dr. Asha Rao',
    designation: 'Professor',
    employeeCode: 'F001',
    joinedOn: '2020-06-01',
    email: 'asha.rao@example.edu',
    phone: '9999999999',
    primaryDepartment: { departmentId: 'dept_mnc', name: 'Mathematics and Computing', code: 'MNC' },
    appointments: [],
    permissions: [],
    subjectRunCourseLeaderScope: [],
    mentorScope: { activeStudentCount: 1, studentIds: ['student_001'] },
    currentOwnedClasses: [],
    currentBatchContexts: [],
    timetableStatus: { hasTemplate: true, publishedAt: '2026-03-10T00:00:00.000Z', directEditWindowEndsAt: null },
    requestSummary: { openCount: 0, recent: [] },
    reassessmentSummary: { openCount: 1, nextDueAt: null, recentDecisionTypes: [] },
    proofOperations: {
      scopeDescriptor: {
        scopeType: 'proof',
        scopeId: 'checkpoint_001',
        label: '2023 Mathematics and Computing',
        batchId: 'batch_mnc_2023',
        sectionCode: null,
        branchName: 'B.Tech Mathematics and Computing',
        simulationRunId: 'run_001',
        simulationStageCheckpointId: 'checkpoint_001',
        studentId: null,
      },
      resolvedFrom: { kind: 'proof-checkpoint', scopeType: 'proof', scopeId: 'checkpoint_001', label: 'Post TT1' },
      scopeMode: 'proof',
      countSource: 'proof-checkpoint',
      activeOperationalSemester: 3,
      activeRunContexts: [{ batchId: 'batch_mnc_2023', batchLabel: '2023', branchName: 'B.Tech Mathematics and Computing', simulationRunId: 'run_001', runLabel: 'Demo Run', status: 'active', seed: 42, createdAt: '2026-03-01T00:00:00.000Z' }],
      selectedCheckpoint: {
        simulationStageCheckpointId: 'checkpoint_001',
        simulationRunId: 'run_001',
        semesterNumber: 3,
        stageKey: 'post-tt1',
        stageLabel: 'Post TT1',
        stageDescription: 'TT1 evidence is visible.',
        stageOrder: 2,
        previousCheckpointId: null,
        nextCheckpointId: 'checkpoint_002',
        studentCount: 60,
        highRiskCount: 1,
        openQueueCount: 1,
      },
      monitoringQueue: [{
        riskAssessmentId: 'risk_001',
        simulationRunId: 'run_001',
        batchId: 'batch_mnc_2023',
        batchLabel: '2023',
        branchName: 'B.Tech Mathematics and Computing',
        studentId: 'student_001',
        studentName: 'Aarav Sharma',
        usn: '1MS23MC001',
        offeringId: 'off_mc301_a',
        courseCode: 'MC301',
        courseTitle: 'Discrete Mathematics',
        sectionCode: 'A',
        riskBand: 'High',
        riskProbScaled: 72,
        recommendedAction: 'attendance_recovery_plan',
        drivers: [{ label: 'Attendance below threshold', impact: 0.24, feature: 'attendance' }],
        dueAt: '2026-03-20T00:00:00.000Z',
        reassessmentStatus: 'Open',
        decisionType: 'Intervention',
        decisionNote: 'Create an attendance recovery plan.',
        observedEvidence: {
          attendancePct: 68,
          tt1Pct: 42,
          tt2Pct: null,
          quizPct: null,
          assignmentPct: null,
          seePct: null,
          cgpa: 6.9,
          backlogCount: 0,
          weakCoCount: 2,
          weakQuestionCount: 3,
          interventionRecoveryStatus: null,
        },
        override: null,
        acknowledgement: null,
        resolution: null,
      }],
      electiveFits: [],
      ...overrides,
    },
  } as ApiAcademicFacultyProfile
}

const offering = {
  offId: 'off_mc301_a',
  id: 'off_mc301_a',
  code: 'MC301',
  title: 'Discrete Mathematics',
  year: 'II Year',
  dept: 'MNC',
  sem: 3,
  section: 'A',
  count: 60,
  attendance: 82,
  stage: 2,
  stageInfo: { stage: 2, label: 'Post TT1', desc: 'TT1 evidence visible.', color: '#2563eb' },
  tt1Done: true,
  tt2Done: false,
  pendingAction: null,
  sections: ['A'],
  enrolled: [60],
  att: [82],
} as Offering

const riskExplorer = {
  currentEvidence: { attendancePct: 68, tt1Pct: 42, tt2Pct: null, quizPct: null, assignmentPct: null, seePct: null, weakCoCount: 2, weakQuestionCount: 3, interventionRecoveryStatus: null },
  currentStatus: { riskBand: 'High', riskProbScaled: 72, reassessmentStatus: 'Open', nextDueAt: null, recommendedAction: 'attendance_recovery_plan', queueState: 'open', simulatedActionTaken: null, attentionAreas: ['attendance'] },
} as ApiStudentRiskExplorer

const agentCard = {
  overview: riskExplorer,
  interventions: {
    currentReassessments: [{ reassessmentEventId: 'reassessment_001', courseCode: 'MC301', courseTitle: 'Discrete Mathematics', status: 'Open', dueAt: '2026-03-20T00:00:00.000Z', assignedToRole: 'COURSE_LEADER' }],
  },
} as unknown as ApiStudentAgentCard

describe('DemoRealityLoopPanel', () => {
  it('renders the guided synthetic proof loop for a queued proof student', () => {
    const markup = renderToStaticMarkup(createElement(DemoRealityLoopPanel, {
      proofProfile: makeProofProfile(),
      offerings: [offering],
      loadStudentRiskExplorer: vi.fn(async () => riskExplorer),
      loadStudentAgentCard: vi.fn(async () => agentCard),
      onCommitAttendanceEdit: vi.fn(async () => undefined),
      onRecomputeProofRunRisk: vi.fn(async () => undefined),
      onResolveReassessment: vi.fn(async () => ({ reassessmentEventId: 'reassessment_001', resolution: { reassessmentResolutionId: 'resolution_001', resolvedByFacultyId: 'mnc_t1', resolutionStatus: 'Resolved', note: null, createdAt: '2026-03-20T00:00:00.000Z', resolutionJson: { outcome: 'completed_improving', temporaryResponseCredit: 0.05, recoveryState: 'confirmed_improvement', queueCaseId: 'queue_001', actorRole: 'COURSE_LEADER', resolvedAt: '2026-03-20T00:00:00.000Z', version: 1 } } } as unknown as ApiProofReassessmentResolveResponse)),
      onAdvanceProofRun: vi.fn(async () => undefined),
    }))

    expect(markup).toContain('data-proof-surface="demo-reality-loop"')
    expect(markup).toContain('Demo Reality Loop')
    expect(markup).toContain('synthetic MSRUAS demo')
    expect(markup).toContain('Aarav Sharma')
    expect(markup).toContain('Attendance')
    expect(markup).toContain('Risk')
    expect(markup).toContain('Queue')
    expect(markup).toContain('This is a deterministic simulated-world response')
  })

  it('formats evidence and risk deltas without causal overclaiming', () => {
    expect(formatDemoDelta(68, 54, '%')).toBe('68% -> 54% (-14%)')
    expect(formatDemoDelta(72, 72, '%')).toBe('72% -> 72% (no change)')
    expect(formatDemoDelta(null, 60, '%')).toBe('Not recorded -> 60%')
  })

  it('builds compact snapshots from proof risk explorer data', () => {
    expect(buildDemoRealityLoopSnapshot(riskExplorer)).toEqual({
      attendancePct: 68,
      riskBand: 'High',
      riskProbScaled: 72,
      queueState: 'open',
      reassessmentStatus: 'Open',
    })
  })

  it('renders a typed empty state when no active proof run is available', () => {
    const markup = renderToStaticMarkup(createElement(DemoRealityLoopPanel, {
      proofProfile: makeProofProfile({ activeRunContexts: [], selectedCheckpoint: null, monitoringQueue: [] }),
      offerings: [],
    }))

    expect(markup).toContain('Start/provision a demo run first')
  })
})
