// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiStudentAgentCard } from '../src/api/types'
import { StudentShellPage } from '../src/pages/student-shell'

afterEach(() => {
  cleanup()
})

function buildCard(): ApiStudentAgentCard {
  return {
    studentAgentCardId: 'agent_card_loading',
    simulationRunId: 'run_loading',
    simulationStageCheckpointId: 'checkpoint_loading',
    cardVersion: 1,
    sourceSnapshotHash: 'hash_loading',
    disclaimer: 'Simulation UX only. Formal academic status remains policy-derived, and this shell cannot change institutional records.',
    scopeDescriptor: {
      scopeType: 'student',
      scopeId: 'mnc_student_101',
      label: 'Aarav Sharma · Section A · 2023 Mathematics and Computing',
      batchId: 'batch_branch_mnc_btech_2023',
      sectionCode: 'A',
      branchName: 'Mathematics and Computing',
      simulationRunId: 'run_loading',
      simulationStageCheckpointId: 'checkpoint_loading',
      studentId: 'mnc_student_101',
    },
    resolvedFrom: {
      kind: 'proof-checkpoint',
      scopeType: 'proof',
      scopeId: 'checkpoint_loading',
      label: 'Post SEE · Proof Run',
    },
    scopeMode: 'proof',
    countSource: 'proof-checkpoint',
    activeOperationalSemester: 3,
    runContext: {
      simulationRunId: 'run_loading',
      runLabel: 'Proof Run',
      status: 'active',
      seed: 42,
      createdAt: '2026-03-16T00:00:00.000Z',
      batchLabel: '2023 Proof',
      branchName: 'Mathematics and Computing',
    },
    checkpointContext: {
      simulationStageCheckpointId: 'checkpoint_loading',
      semesterNumber: 3,
      stageKey: 'post-see',
      stageLabel: 'Post SEE',
      stageDescription: 'Final evidence checkpoint after SEE lands.',
      stageOrder: 5,
      previousCheckpointId: 'checkpoint_prev',
      nextCheckpointId: null,
      stageAdvanceBlocked: false,
      blockingQueueItemCount: 0,
      playbackAccessible: true,
      blockedByCheckpointId: null,
      blockedProgressionReason: null,
    },
    student: {
      studentId: 'mnc_student_101',
      studentName: 'Aarav Sharma',
      usn: '1MS23MC101',
      sectionCode: 'A',
      currentSemester: 3,
      programScopeVersion: 'mnc-first-6-sem-v1',
      mentorTrack: 'mixed',
    },
    allowedIntents: ['Explain current semester performance'],
    summaryRail: {
      currentRiskBand: 'Medium',
      currentRiskProbScaled: 58,
      previousRiskBand: 'Medium',
      previousRiskProbScaled: 62,
      riskChangeFromPreviousCheckpointScaled: -4,
      counterfactualLiftScaled: 6,
      currentRiskDisplayProbabilityAllowed: true,
      currentRiskSupportWarning: null,
      currentRiskCalibrationMethod: 'isotonic',
      primaryCourseCode: 'MC301',
      primaryCourseTitle: 'Discrete Structures',
      nextDueAt: null,
      currentReassessmentStatus: 'Watch',
      currentQueueState: 'watch',
      currentRecoveryState: null,
      currentCgpa: 6.92,
      backlogCount: 1,
      electiveFit: null,
    },
    overview: {
      observedLabel: 'Observed',
      policyLabel: 'Policy Derived',
      currentEvidence: {
        attendancePct: 78,
        tt1Pct: 55,
        tt2Pct: 57,
        quizPct: 61,
        assignmentPct: 64,
        seePct: 59,
        weakCoCount: 1,
        weakQuestionCount: 2,
        coEvidenceMode: 'graph-aware',
        interventionRecoveryStatus: 'watch',
      },
      currentStatus: {
        riskBand: 'Medium',
        riskProbScaled: 58,
        previousRiskBand: 'Medium',
        previousRiskProbScaled: 62,
        riskChangeFromPreviousCheckpointScaled: -4,
        counterfactualLiftScaled: 6,
        reassessmentStatus: 'Watch',
        resolutionStatus: null,
        nextDueAt: null,
        recommendedAction: 'structured-study-plan',
        queueState: 'watch',
        queueCaseId: 'queue_case_101',
        primaryCase: true,
        countsTowardCapacity: true,
        priorityRank: 1,
        governanceReason: 'priority-case',
        supportingCourseCount: 1,
        assignedFacultyId: 'fac_hod',
        recoveryState: null,
        observedResidual: null,
        simulatedActionTaken: 'structured-study-plan',
        policyComparison: null,
        attentionAreas: ['Attendance below threshold'],
      },
      semesterSummaries: [{
        semesterNumber: 3,
        riskBands: ['Medium'],
        sgpa: 6.9,
        cgpaAfterSemester: 6.92,
        backlogCount: 1,
        weakCoCount: 1,
        questionResultCoverage: 18,
        interventionCount: 1,
      }],
    },
    topicAndCo: {
      panelLabel: 'Simulation Internal',
      topicBuckets: {
        known: ['Sets'],
        partial: ['Graphs'],
        blocked: [],
        highUncertainty: [],
      },
      weakCourseOutcomes: [],
      questionPatterns: {
        weakQuestionCount: 2,
        carelessErrorCount: 0,
        transferGapCount: 1,
        commonWeakTopics: ['Graphs'],
        commonWeakCourseOutcomes: ['MC301-CO2'],
      },
      simulationTags: ['Archetype: mixed'],
    },
    assessmentEvidence: {
      panelLabel: 'Observed',
      components: [],
    },
    interventions: {
      panelLabel: 'Human Action Log',
      currentReassessments: [],
      interventionHistory: [],
      humanActionLog: [],
    },
    counterfactual: {
      panelLabel: 'Policy Derived',
      noActionRiskBand: 'Medium',
      noActionRiskProbScaled: 64,
      counterfactualLiftScaled: 6,
      note: 'Advisory comparison only. This shows the local no-action comparator for the selected checkpoint and does not change the proof record.',
    },
    citations: [{
      citationId: 'guardrail-scope',
      label: 'Shell guardrail boundary',
      panelLabel: 'Policy Derived',
      summary: 'This shell explains the current proof record only.',
    }],
  }
}

describe('StudentShellPage timeline loading', () => {
  it('defers timeline loading until the timeline tab is opened', async () => {
    const loadCard = vi.fn(async () => buildCard())
    const loadTimeline = vi.fn(async () => ({
      items: [{
        timelineItemId: 'semester-3',
        panelLabel: 'Observed' as const,
        kind: 'semester-summary' as const,
        title: 'Semester 3 summary',
        detail: 'SGPA 6.90.',
        occurredAt: '2026-03-16T00:00:00.000Z',
        semesterNumber: 3,
        citations: [],
      }],
    }))

    render(createElement(StudentShellPage, {
      role: 'HoD',
      studentId: 'mnc_student_101',
      onBack: () => {},
      loadCard,
      loadTimeline,
      startSession: async () => { throw new Error('not used') },
      sendMessage: async () => ({ items: [] }),
      initialCard: null,
      initialTimeline: [],
      initialSession: null,
      initialActiveTab: 'overview',
      initialError: '',
    }))

    await waitFor(() => {
      expect(screen.getByText(/proof snapshot/i)).toBeTruthy()
    })
    expect(loadCard).toHaveBeenCalledTimes(1)
    expect(loadTimeline).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }))

    await waitFor(() => {
      expect(loadTimeline).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByText('Semester 3 summary')).toBeTruthy()
    })
  })
})
