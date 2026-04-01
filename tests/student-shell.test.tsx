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
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_001',
          label: 'Aarav Sharma · Section A · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'A',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_001',
          simulationStageCheckpointId: 'checkpoint_001',
          studentId: 'mnc_student_001',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_001',
          label: 'Post TT1 · Proof Run 1',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 6,
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
    expect(markup).toContain('data-proof-shell="shared"')
    expect(markup).toContain('data-proof-launcher="floating"')
    expect(markup).toContain('data-proof-action="student-shell-back"')
    expect(markup).toContain('data-proof-section="authority-banner"')
    expect(markup).toContain('data-proof-section="summary-rail"')
    expect(markup).toContain('data-proof-section="chat-panel"')
    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('data-proof-shell-tabs="shared"')
    expect(markup).toContain('aria-label="Student shell sections"')
    expect(markup).toContain('role="tab"')
    expect(markup).toContain('aria-controls="student-shell-panel-chat"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('role="tabpanel"')
    expect(markup).toContain('data-proof-shell-panel="shared"')
    expect(markup).toContain('deterministic proof explainer')
    expect(markup).toContain('Simulation UX only. Formal academic status remains policy-derived')
    expect(markup).toContain('Authoritative bounded proof explainer for the selected checkpoint')
    expect(markup).toContain('Checkpoint-bound proof counts')
    expect(markup).toContain('operational semester 6')
    expect(markup).toContain('Post TT1')
    expect(markup).toContain('Deterministic shell chat')
    expect(markup).toContain('Student shell does not make future-certainty claims.')
    expect(markup).toContain('Shell guardrail boundary')
    expect(markup).toContain('Session Intro')
    expect(markup).toContain('Deterministic Reply')
    expect(markup).toContain('Policy Derived')
    expect(markup).not.toContain('AI says')
  })

  it('renders early-semester overview coverage for semesters 1 through 3', () => {
    const markup = renderToStaticMarkup(createElement(StudentShellPage, {
      role: 'HoD',
      studentId: 'mnc_student_003',
      onBack: () => {},
      initialActiveTab: 'timeline',
      initialCard: {
        studentAgentCardId: 'agent_card_003',
        simulationRunId: 'run_003',
        simulationStageCheckpointId: 'checkpoint_003',
        cardVersion: 1,
        sourceSnapshotHash: 'hash_003',
        disclaimer: 'Simulation UX only. Formal academic status remains policy-derived, and this shell cannot change institutional records.',
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_003',
          label: 'Aarav Sharma · Section A · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'A',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_003',
          simulationStageCheckpointId: 'checkpoint_003',
          studentId: 'mnc_student_003',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_003',
          label: 'Semester 3 · Proof Run 3',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 3,
        runContext: {
          simulationRunId: 'run_003',
          runLabel: 'Proof Run 3',
          status: 'active',
          seed: 303,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: {
          simulationStageCheckpointId: 'checkpoint_003',
          semesterNumber: 3,
          stageKey: 'semester-3',
          stageLabel: 'Semester 3',
          stageDescription: 'Early-semester checkpoint used to verify activation determinism.',
          stageOrder: 3,
          previousCheckpointId: 'checkpoint_002',
          nextCheckpointId: null,
        },
        student: {
          studentId: 'mnc_student_003',
          studentName: 'Aarav Sharma',
          usn: '1MS23MC003',
          sectionCode: 'A',
          currentSemester: 3,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        allowedIntents: ['Explain current semester performance'],
        summaryRail: {
          currentRiskBand: 'Medium',
          currentRiskProbScaled: 58,
          primaryCourseCode: 'MC301',
          primaryCourseTitle: 'Graphs and Combinatorics',
          nextDueAt: null,
          currentReassessmentStatus: 'Watch',
          currentCgpa: 7.3,
          backlogCount: 0,
          electiveFit: {
            recommendedCode: 'MC3E01',
            recommendedTitle: 'Applied Foundations',
            stream: 'Data Intelligence',
            rationale: ['Stable foundational signal'],
            alternatives: [],
          },
        },
        overview: {
          observedLabel: 'Observed',
          policyLabel: 'Policy Derived',
          currentEvidence: {
            attendancePct: 84,
            tt1Pct: 72,
            tt2Pct: 68,
            quizPct: 65,
            assignmentPct: 70,
            seePct: 63,
            weakCoCount: 0,
            weakQuestionCount: 1,
            interventionRecoveryStatus: 'stable',
            coEvidenceMode: 'synthetic-blueprint',
          },
          currentStatus: {
            riskBand: 'Medium',
            riskProbScaled: 58,
            reassessmentStatus: 'Watch',
            nextDueAt: null,
            recommendedAction: 'structured-study-plan',
            queueState: 'watch',
            simulatedActionTaken: 'structured-study-plan',
            attentionAreas: ['Maintaining progress in early semesters'],
          },
          semesterSummaries: [
            {
              semesterNumber: 1,
              riskBands: ['Low'],
              sgpa: 7.6,
              cgpaAfterSemester: 7.6,
              backlogCount: 0,
              weakCoCount: 0,
              questionResultCoverage: 18,
              interventionCount: 0,
            },
            {
              semesterNumber: 2,
              riskBands: ['Low'],
              sgpa: 7.4,
              cgpaAfterSemester: 7.5,
              backlogCount: 0,
              weakCoCount: 0,
              questionResultCoverage: 18,
              interventionCount: 0,
            },
            {
              semesterNumber: 3,
              riskBands: ['Medium'],
              sgpa: 6.9,
              cgpaAfterSemester: 7.3,
              backlogCount: 0,
              weakCoCount: 1,
              questionResultCoverage: 18,
              interventionCount: 1,
            },
          ],
        },
        topicAndCo: {
          panelLabel: 'Simulation Internal',
          topicBuckets: {
            known: ['Foundations'],
            partial: ['Graph Traversal'],
            blocked: ['Optimization Constraints'],
            highUncertainty: ['Graph Traversal'],
          },
          weakCourseOutcomes: [
            {
              coCode: 'MC301-CO2',
              coTitle: 'Foundations competency',
              trend: 'flat',
              topics: ['Foundations'],
              tt1Pct: 72,
              tt2Pct: 68,
              seePct: 63,
              transferGap: -0.02,
            },
          ],
          questionPatterns: {
            weakQuestionCount: 1,
            carelessErrorCount: 0,
            transferGapCount: 0,
            commonWeakTopics: ['Foundations'],
            commonWeakCourseOutcomes: ['MC301-CO2'],
          },
          simulationTags: ['Archetype: stable-foundation'],
        },
        assessmentEvidence: {
          panelLabel: 'Observed',
          components: [
            {
              courseCode: 'MC301',
              courseTitle: 'Graphs and Combinatorics',
              sectionCode: 'A',
              attendancePct: 84,
              tt1Pct: 72,
              tt2Pct: 68,
              quizPct: 65,
              assignmentPct: 70,
              seePct: 63,
              weakCoCount: 0,
              weakQuestionCount: 1,
              drivers: [{ label: 'Early-semester stability', impact: 0.12, feature: 'attendancePct' }],
            },
          ],
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
          noActionRiskProbScaled: 61,
          counterfactualLiftScaled: 3,
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
          detail: 'SGPA 7.60.',
          occurredAt: '2026-03-16T00:00:00.000Z',
          semesterNumber: 1,
          citations: [],
        },
        {
          timelineItemId: 'semester-2',
          panelLabel: 'Observed',
          kind: 'semester-summary',
          title: 'Semester 2 summary',
          detail: 'SGPA 7.40.',
          occurredAt: '2026-03-16T00:00:00.000Z',
          semesterNumber: 2,
          citations: [],
        },
        {
          timelineItemId: 'semester-3',
          panelLabel: 'Observed',
          kind: 'semester-summary',
          title: 'Semester 3 summary',
          detail: 'SGPA 6.90.',
          occurredAt: '2026-03-16T00:00:00.000Z',
          semesterNumber: 3,
          citations: [],
        },
      ],
      initialSession: null,
    }))

    expect(markup).toContain('Sem 3')
    expect(markup).toContain('operational semester 3')
    expect(markup).toContain('Semester 1')
    expect(markup).toContain('Semester 2')
    expect(markup).toContain('Semester 3')
  })

  it('renders final-stage student shell coverage for semesters 4 through 6', () => {
    const markup = renderToStaticMarkup(createElement(StudentShellPage, {
      role: 'Course Leader',
      studentId: 'mnc_student_006',
      onBack: () => {},
      initialActiveTab: 'overview',
      initialCard: {
        studentAgentCardId: 'agent_card_006',
        simulationRunId: 'run_006',
        simulationStageCheckpointId: 'checkpoint_006',
        cardVersion: 1,
        sourceSnapshotHash: 'hash_006',
        disclaimer: 'Simulation UX only. Formal academic status remains policy-derived, and this shell cannot change institutional records.',
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_006',
          label: 'Aarav Sharma · Section A · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'A',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_006',
          simulationStageCheckpointId: 'checkpoint_006',
          studentId: 'mnc_student_006',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_006',
          label: 'Post SEE · Proof Run 6',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 6,
        runContext: {
          simulationRunId: 'run_006',
          runLabel: 'Proof Run 6',
          status: 'active',
          seed: 606,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: {
          simulationStageCheckpointId: 'checkpoint_006',
          semesterNumber: 6,
          stageKey: 'post-see',
          stageLabel: 'Post SEE',
          stageDescription: 'Final evidence checkpoint after SEE lands.',
          stageOrder: 5,
          previousCheckpointId: 'checkpoint_005',
          nextCheckpointId: null,
          stageAdvanceBlocked: false,
          blockingQueueItemCount: 0,
        },
        student: {
          studentId: 'mnc_student_006',
          studentName: 'Aarav Sharma',
          usn: '1MS23MC006',
          sectionCode: 'A',
          currentSemester: 6,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        allowedIntents: ['Explain current semester performance'],
        summaryRail: {
          currentRiskBand: 'Medium',
          currentRiskProbScaled: 54,
          primaryCourseCode: 'MC601',
          primaryCourseTitle: 'Graph Theory',
          nextDueAt: null,
          currentReassessmentStatus: 'Watch',
          currentCgpa: 7.12,
          backlogCount: 0,
          electiveFit: {
            recommendedCode: 'MC6E01',
            recommendedTitle: 'Applied Optimization',
            stream: 'Data Intelligence',
            rationale: ['Observed final-stage math signal'],
            alternatives: [],
          },
        },
        overview: {
          observedLabel: 'Observed',
          policyLabel: 'Policy Derived',
          currentEvidence: {
            attendancePct: 81,
            tt1Pct: 58,
            tt2Pct: 55,
            quizPct: 62,
            assignmentPct: 66,
            seePct: 61,
            weakCoCount: 1,
            weakQuestionCount: 2,
            interventionRecoveryStatus: 'stable',
            coEvidenceMode: 'synthetic-blueprint',
          },
          currentStatus: {
            riskBand: 'Medium',
            riskProbScaled: 54,
            reassessmentStatus: 'Watch',
            nextDueAt: null,
            recommendedAction: 'structured-study-plan',
            queueState: 'watch',
            simulatedActionTaken: 'structured-study-plan',
            attentionAreas: ['Final-stage review remains advisory'],
            counterfactualLiftScaled: 6,
          },
          semesterSummaries: [
            {
              semesterNumber: 4,
              riskBands: ['Medium'],
              sgpa: 6.9,
              cgpaAfterSemester: 7.0,
              backlogCount: 0,
              weakCoCount: 1,
              questionResultCoverage: 18,
              interventionCount: 1,
            },
            {
              semesterNumber: 5,
              riskBands: ['Medium'],
              sgpa: 7.0,
              cgpaAfterSemester: 7.0,
              backlogCount: 0,
              weakCoCount: 1,
              questionResultCoverage: 18,
              interventionCount: 1,
            },
            {
              semesterNumber: 6,
              riskBands: ['Medium'],
              sgpa: 7.4,
              cgpaAfterSemester: 7.1,
              backlogCount: 0,
              weakCoCount: 1,
              questionResultCoverage: 18,
              interventionCount: 1,
            },
          ],
        },
        topicAndCo: {
          panelLabel: 'Simulation Internal',
          topicBuckets: {
            known: ['Optimization Foundations'],
            partial: ['SEE revision'],
            blocked: [],
            highUncertainty: [],
          },
          weakCourseOutcomes: [],
          questionPatterns: {
            weakQuestionCount: 2,
            carelessErrorCount: 0,
            transferGapCount: 1,
            commonWeakTopics: ['SEE revision'],
            commonWeakCourseOutcomes: ['MC601-CO3'],
          },
          simulationTags: ['Archetype: steady-finish'],
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
          noActionRiskProbScaled: 60,
          counterfactualLiftScaled: 6,
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
      initialTimeline: [],
      initialSession: null,
    }))

    expect(markup).toContain('Sem 6')
    expect(markup).toContain('operational semester 6')
    expect(markup).toContain('MC6E01')
    expect(markup).toContain('No-action comparator')
    expect(markup).toContain('Semester 4')
    expect(markup).toContain('Semester 5')
    expect(markup).toContain('Semester 6')
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
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_003',
          label: 'Meera Iyer · Section B · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'B',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_003',
          simulationStageCheckpointId: 'checkpoint_003',
          studentId: 'mnc_student_003',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_003',
          label: 'Checkpoint 003 · Proof Run 3',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 6,
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
