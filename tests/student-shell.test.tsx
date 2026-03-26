import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StudentShellPage } from '../src/pages/student-shell'

describe('StudentShellPage', () => {
  it('renders deterministic disclaimer, panel labels, and bounded chat citations', () => {
    const markup = renderToStaticMarkup(createElement(StudentShellPage, {
      role: 'HoD',
      studentId: 'mnc_student_001',
      onBack: () => {},
      initialActiveTab: 'chat',
      initialCard: {
        studentAgentCardId: 'agent_card_001',
        simulationRunId: 'run_001',
        simulationStageCheckpointId: 'checkpoint_001',
        cardVersion: 1,
        sourceSnapshotHash: 'hash_001',
        disclaimer: 'Simulation UX only. Formal academic status remains policy-derived, and this shell cannot change institutional records.',
        runContext: {
          simulationRunId: 'run_001',
          runLabel: 'Proof Run 1',
          status: 'active',
          seed: 42,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: {
          simulationStageCheckpointId: 'checkpoint_001',
          semesterNumber: 6,
          stageKey: 'post-tt1',
          stageLabel: 'Post TT1',
          stageDescription: 'First major risk checkpoint after TT1 evidence lands and the first queue decision is made.',
          stageOrder: 2,
          previousCheckpointId: 'checkpoint_000',
          nextCheckpointId: 'checkpoint_002',
        },
        student: {
          studentId: 'mnc_student_001',
          studentName: 'Aarav Sharma',
          usn: '1MS23MC001',
          sectionCode: 'A',
          currentSemester: 6,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        allowedIntents: ['Explain current semester performance'],
        summaryRail: {
          currentRiskBand: 'High',
          currentRiskProbScaled: 82,
          primaryCourseCode: 'MC601',
          primaryCourseTitle: 'Graph Theory',
          nextDueAt: '2026-03-18T09:00:00.000Z',
          currentReassessmentStatus: 'Open',
          currentCgpa: 6.74,
          backlogCount: 2,
          electiveFit: {
            recommendedCode: 'MC6E01',
            recommendedTitle: 'Applied Optimization',
            stream: 'Data Intelligence',
            rationale: ['Stable math signal'],
            alternatives: [],
          },
        },
        overview: {
          observedLabel: 'Observed',
          policyLabel: 'Policy Derived',
          currentEvidence: {
            attendancePct: 68,
            tt1Pct: 34,
            tt2Pct: 41,
            quizPct: 52,
            assignmentPct: 61,
            seePct: 46,
            weakCoCount: 2,
            weakQuestionCount: 4,
            interventionRecoveryStatus: 'watch',
          },
          currentStatus: {
            riskBand: 'High',
            riskProbScaled: 82,
            reassessmentStatus: 'Open',
            nextDueAt: '2026-03-18T09:00:00.000Z',
            recommendedAction: 'Reassessment',
            queueState: 'open',
            simulatedActionTaken: 'targeted-tutoring',
            attentionAreas: ['Attendance below threshold'],
          },
          semesterSummaries: [
            {
              semesterNumber: 1,
              riskBands: ['Low'],
              sgpa: 7.1,
              cgpaAfterSemester: 7.1,
              backlogCount: 0,
              weakCoCount: 0,
              questionResultCoverage: 20,
              interventionCount: 0,
            },
          ],
        },
        topicAndCo: {
          panelLabel: 'Simulation Internal',
          topicBuckets: {
            known: ['Linear Algebra'],
            partial: ['Graph Traversal'],
            blocked: ['Optimization Constraints'],
            highUncertainty: ['Graph Traversal'],
          },
          weakCourseOutcomes: [
            {
              coCode: 'MC601-CO2',
              coTitle: 'Graph application competency',
              trend: 'flat',
              topics: ['Graph Traversal'],
              tt1Pct: 34,
              tt2Pct: 41,
              seePct: 46,
              transferGap: -0.1,
            },
          ],
          questionPatterns: {
            weakQuestionCount: 4,
            carelessErrorCount: 1,
            transferGapCount: 2,
            commonWeakTopics: ['Graph Traversal'],
            commonWeakCourseOutcomes: ['MC601-CO2'],
          },
          simulationTags: ['Archetype: strategic-fragile'],
        },
        assessmentEvidence: {
          panelLabel: 'Observed',
          components: [
            {
              courseCode: 'MC601',
              courseTitle: 'Graph Theory',
              sectionCode: 'A',
              attendancePct: 68,
              tt1Pct: 34,
              tt2Pct: 41,
              quizPct: 52,
              assignmentPct: 61,
              seePct: 46,
              weakCoCount: 2,
              weakQuestionCount: 4,
              drivers: [{ label: 'Attendance below threshold', impact: 0.4, feature: 'attendancePct' }],
            },
          ],
        },
        interventions: {
          panelLabel: 'Human Action Log',
          currentReassessments: [
            {
              reassessmentEventId: 'reassessment_001',
              courseCode: 'MC601',
              courseTitle: 'Graph Theory',
              status: 'Open',
              dueAt: '2026-03-18T09:00:00.000Z',
              assignedToRole: 'MENTOR',
            },
          ],
          interventionHistory: [
            {
              interventionId: 'intervention_001',
              interventionType: 'targeted-tutoring',
              note: 'Generated targeted tutoring.',
              occurredAt: '2026-03-16T00:00:00.000Z',
              accepted: true,
              completed: false,
              recoveryConfirmed: false,
              observedResidual: -0.05,
            },
          ],
          humanActionLog: [
            {
              title: 'Intervention · targeted-tutoring',
              detail: 'Generated targeted tutoring.',
              occurredAt: '2026-03-16T00:00:00.000Z',
            },
          ],
        },
        counterfactual: {
          panelLabel: 'Policy Derived',
          noActionRiskBand: 'High',
          noActionRiskProbScaled: 89,
          counterfactualLiftScaled: -7,
          note: 'Advisory comparison only. This shows the local no-action comparator for the selected checkpoint and does not change the proof record.',
        },
        citations: [
          {
            citationId: 'guardrail-scope',
            label: 'Shell guardrail boundary',
            panelLabel: 'Policy Derived',
            summary: 'This shell explains the current proof record only.',
          },
        ],
      },
      initialTimeline: [
        {
          timelineItemId: 'semester-1',
          panelLabel: 'Observed',
          kind: 'semester-summary',
          title: 'Semester 1 summary',
          detail: 'SGPA 7.10.',
          occurredAt: '2026-03-16T00:00:00.000Z',
          semesterNumber: 1,
          citations: [],
        },
      ],
      initialSession: {
        studentAgentSessionId: 'session_001',
        simulationRunId: 'run_001',
        simulationStageCheckpointId: 'checkpoint_001',
        studentId: 'mnc_student_001',
        viewerFacultyId: 'mnc_t1',
        viewerRole: 'HOD',
        status: 'active',
        responseMode: 'deterministic',
        cardVersion: 1,
        createdAt: '2026-03-16T00:00:00.000Z',
        updatedAt: '2026-03-16T00:00:00.000Z',
        messages: [
          {
            studentAgentMessageId: 'message_001',
            actorType: 'assistant',
            messageType: 'guardrail',
            body: 'Student shell does not make future-certainty claims.',
            citations: [
              {
                citationId: 'guardrail-scope',
                label: 'Shell guardrail boundary',
                panelLabel: 'Policy Derived',
                summary: 'This shell explains the current proof record only.',
              },
            ],
            guardrailCode: 'no-future-certainty',
            createdAt: '2026-03-16T00:00:00.000Z',
            updatedAt: '2026-03-16T00:00:00.000Z',
          },
        ],
      },
    }))

    expect(markup).toContain('data-proof-surface="student-shell"')
    expect(markup).toContain('data-proof-action="student-shell-back"')
    expect(markup).toContain('data-proof-section="authority-banner"')
    expect(markup).toContain('data-proof-section="summary-rail"')
    expect(markup).toContain('data-proof-section="chat-panel"')
    expect(markup).toContain('deterministic proof explainer')
    expect(markup).toContain('Simulation UX only. Formal academic status remains policy-derived')
    expect(markup).toContain('Authoritative bounded proof explainer for the selected checkpoint')
    expect(markup).toContain('Post TT1')
    expect(markup).toContain('Deterministic shell chat')
    expect(markup).toContain('Student shell does not make future-certainty claims.')
    expect(markup).toContain('Shell guardrail boundary')
    expect(markup).toContain('Policy Derived')
    expect(markup).not.toContain('AI says')
  })

  it('renders an explicit proof load error before the unavailable empty state', () => {
    const markup = renderToStaticMarkup(createElement(StudentShellPage, {
      role: 'Mentor',
      studentId: 'mnc_student_404',
      onBack: () => {},
      initialCard: null,
      initialError: 'You do not have access to this student shell.',
    }))

    expect(markup).toContain('data-proof-surface="student-shell"')
    expect(markup).toContain('data-proof-state="load-error"')
    expect(markup).toContain('data-proof-section="load-error"')
    expect(markup).toContain('You do not have access to this student shell.')
    expect(markup).toContain('Student shell unavailable')
    expect(markup).toContain('failed to load')
  })

  it('renders band-only shell risk state with calibration and support messaging when top-level probability is suppressed', () => {
    const markup = renderToStaticMarkup(createElement(StudentShellPage, {
      role: 'Course Leader',
      studentId: 'mnc_student_003',
      onBack: () => {},
      initialCard: {
        studentAgentCardId: 'agent_card_003',
        simulationRunId: 'run_003',
        simulationStageCheckpointId: 'checkpoint_003',
        cardVersion: 1,
        sourceSnapshotHash: 'hash_003',
        disclaimer: 'Simulation UX only. Formal academic status remains policy-derived, and this shell cannot change institutional records.',
        runContext: {
          simulationRunId: 'run_003',
          runLabel: 'Proof Run 3',
          status: 'active',
          seed: 303,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: null,
        student: {
          studentId: 'mnc_student_003',
          studentName: 'Meera Iyer',
          usn: '1MS23MC003',
          sectionCode: 'B',
          currentSemester: 5,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        allowedIntents: ['Explain current semester performance'],
        summaryRail: {
          currentRiskBand: 'Medium',
          currentRiskProbScaled: null,
          currentRiskDisplayProbabilityAllowed: false,
          currentRiskSupportWarning: 'Overall course risk does not meet the support gate for raw percentage display.',
          currentRiskCalibrationMethod: 'sigmoid',
          primaryCourseCode: 'MC501',
          primaryCourseTitle: 'Algorithms',
          nextDueAt: null,
          currentReassessmentStatus: 'Watch',
          currentCgpa: 7.12,
          backlogCount: 0,
          electiveFit: null,
        },
        overview: {
          observedLabel: 'Observed',
          policyLabel: 'Policy Derived',
          currentEvidence: {
            attendancePct: 78,
            tt1Pct: 48,
            tt2Pct: 45,
            quizPct: 58,
            assignmentPct: 63,
            seePct: 51,
            weakCoCount: 1,
            weakQuestionCount: 2,
            interventionRecoveryStatus: 'watch',
            coEvidenceMode: 'synthetic-blueprint',
          },
          currentStatus: {
            riskBand: 'Medium',
            riskProbScaled: null,
            reassessmentStatus: 'Watch',
            nextDueAt: null,
            recommendedAction: 'structured-study-plan',
            queueState: 'open',
            simulatedActionTaken: null,
            attentionAreas: ['Weak course outcomes present'],
          },
          semesterSummaries: [],
        },
        topicAndCo: {
          panelLabel: 'Simulation Internal',
          topicBuckets: { known: [], partial: [], blocked: [], highUncertainty: [] },
          weakCourseOutcomes: [],
          questionPatterns: {
            weakQuestionCount: 2,
            carelessErrorCount: 0,
            transferGapCount: 1,
            commonWeakTopics: [],
            commonWeakCourseOutcomes: [],
          },
          simulationTags: [],
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
        counterfactual: null,
        citations: [],
      },
      initialTimeline: [],
      initialSession: null,
    }))

    expect(markup).toContain('Band only')
    expect(markup).toContain('Cal sigmoid')
    expect(markup).toContain('Overall course risk does not meet the support gate')
    expect(markup).toContain('in band-only mode')
  })
})
